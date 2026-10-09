-- La radio de la web (plan 022 T246, Hernán 2026-10-09): el catálogo de
-- canciones por género que el Admin sube, ordena y marca, y que el
-- reproductor (T247) lee. Escrita y probada como texto en local, NO aplicada
-- a ningún proyecto (la aplica Hernán en boia-planet-dev, detrás de
-- 20261008200200_member_party_trash.sql).
--
-- - `radio_genres`: los géneros, editables. Empieza con los cuatro de
--   muestra (techno, house, reggaetón, indie). Una canción nombra su género
--   por id: renombrar un género lo cambia en todas sus canciones; borrar uno
--   que aún tiene canciones no se deja (la clave ajena, `on delete restrict`).
-- - `radio_songs`: título, artista, género, duración, archivo (bucket
--   `radio-songs`), posición en la lista y si es «la primera» (la que suena
--   al encender la radio). Exactamente una primera si hay canciones: como
--   mucho una por el índice único parcial, y al menos una porque la primera
--   canción que entra lo es, al borrar la primera pasa a serlo la de arriba
--   y una comprobación diferida lo mira al cerrar cada transacción.
-- - Lectura pública (anon incluido); escritura sólo del equipo (admin u
--   owner con segundo factor, `private.has_staff_role('admin')`).
--
-- Mismas reglas que packages/contracts/src/radio.ts.

-- ---------------------------------------------------------------------------
-- Géneros

create table public.radio_genres (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);

-- Dos géneros no se llaman igual (sin mirar mayúsculas).
create unique index radio_genres_name_key on public.radio_genres (lower(btrim(name)));

insert into public.radio_genres (id, name) values
  ('techno', 'Techno'),
  ('house', 'House'),
  ('reggaeton', 'Reggaetón'),
  ('indie', 'Indie')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Canciones

create table public.radio_songs (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  artist text not null check (char_length(btrim(artist)) between 1 and 120),
  genre_id text not null references public.radio_genres (id) on delete restrict,
  duration_seconds numeric(7, 2) not null check (duration_seconds > 0 and duration_seconds <= 1200),
  url text not null
    check (url ~ '^https://[^/\s]+/storage/v1/object/public/radio-songs/[A-Za-z0-9._/-]+$'),
  position integer not null check (position >= 0),
  is_first boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);

create index radio_songs_position_idx on public.radio_songs (position, id);
create index radio_songs_genre_idx on public.radio_songs (genre_id);

-- Como mucho una primera.
create unique index radio_songs_one_first on public.radio_songs (is_first) where is_first;

-- La primera canción que entra en una lista sin primera, lo es.
create function private.radio_song_default_first() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.radio_songs s where s.is_first) then
    new.is_first := true;
  end if;
  return new;
end;
$$;

create trigger radio_songs_default_first
  before insert on public.radio_songs
  for each row execute function private.radio_song_default_first();

-- Al borrar la primera, pasa a serlo la de arriba de la lista.
create function private.radio_song_promote_first() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_first and not exists (select 1 from public.radio_songs s where s.is_first) then
    update public.radio_songs
    set is_first = true
    where id = (select s.id from public.radio_songs s order by s.position, s.id limit 1);
  end if;
  return null;
end;
$$;

create trigger radio_songs_promote_first
  after delete on public.radio_songs
  for each row execute function private.radio_song_promote_first();

-- Al cerrar la transacción: exactamente una primera si hay canciones.
create function private.radio_check_first() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  total integer;
  firsts integer;
begin
  select count(*), count(*) filter (where s.is_first) into total, firsts from public.radio_songs s;
  if total > 0 and firsts <> 1 then
    raise exception 'first_count' using detail = 'La radio necesita exactamente una primera canción.';
  end if;
  return null;
end;
$$;

create constraint trigger radio_songs_check_first
  after insert or update or delete on public.radio_songs
  deferrable initially deferred
  for each row execute function private.radio_check_first();

-- ---------------------------------------------------------------------------
-- RPC del equipo: marcar la primera y reordenar la lista entera.

create function public.radio_set_first(p_song text) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_staff_role('admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.radio_songs s where s.id = p_song) then
    raise exception 'unknown_song' using detail = 'Esa canción no está en la radio.';
  end if;
  update public.radio_songs set is_first = false where is_first and id <> p_song;
  update public.radio_songs set is_first = true where id = p_song;
end;
$$;

-- `p_ids`: todas las canciones, en su orden nuevo (ni una más ni una menos).
create function public.radio_reorder(p_ids text[]) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_staff_role('admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_ids), 0) <> (select count(*) from public.radio_songs)
     or (select count(distinct x) from unnest(p_ids) x) <> cardinality(p_ids)
     or exists (
       select 1 from unnest(p_ids) x
       where not exists (select 1 from public.radio_songs s where s.id = x)
     ) then
    raise exception 'invalid_order' using detail = 'La lista nueva no es la de la radio.';
  end if;
  update public.radio_songs s
  set position = o.n - 1
  from unnest(p_ids) with ordinality as o (id, n)
  where s.id = o.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS y permisos: lectura pública; escritura del equipo.

alter table public.radio_genres enable row level security;
alter table public.radio_songs enable row level security;

create policy radio_genres_read on public.radio_genres for select to anon, authenticated using (true);
create policy radio_genres_staff_insert on public.radio_genres for insert to authenticated
  with check ((select private.has_staff_role('admin')));
create policy radio_genres_staff_update on public.radio_genres for update to authenticated
  using ((select private.has_staff_role('admin')))
  with check ((select private.has_staff_role('admin')));
create policy radio_genres_staff_delete on public.radio_genres for delete to authenticated
  using ((select private.has_staff_role('admin')));

create policy radio_songs_read on public.radio_songs for select to anon, authenticated using (true);
create policy radio_songs_staff_insert on public.radio_songs for insert to authenticated
  with check ((select private.has_staff_role('admin')));
create policy radio_songs_staff_update on public.radio_songs for update to authenticated
  using ((select private.has_staff_role('admin')))
  with check ((select private.has_staff_role('admin')));
create policy radio_songs_staff_delete on public.radio_songs for delete to authenticated
  using ((select private.has_staff_role('admin')));

revoke all on public.radio_genres from public, anon, authenticated;
revoke all on public.radio_songs from public, anon, authenticated;
grant select on public.radio_genres to anon, authenticated;
grant select on public.radio_songs to anon, authenticated;
grant insert (id, name), update (name), delete on public.radio_genres to authenticated;
-- La primera y la posición sólo cambian con las RPC (y los disparadores).
grant insert (id, title, artist, genre_id, duration_seconds, url, position),
  update (title, artist, genre_id), delete on public.radio_songs to authenticated;

revoke all on function private.radio_song_default_first() from public;
revoke all on function private.radio_song_promote_first() from public;
revoke all on function private.radio_check_first() from public;
revoke all on function public.radio_set_first(text) from public, anon;
revoke all on function public.radio_reorder(text[]) from public, anon;
grant execute on function public.radio_set_first(text) to authenticated;
grant execute on function public.radio_reorder(text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: bucket público de canciones, MP3 de 15 MB como mucho, escritura
-- sólo del equipo con aal2. Sin el esquema storage (el PostgreSQL local de
-- `pnpm db:test`) esta parte no se aplica.

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('radio-songs', 'radio-songs', true, 15728640, array['audio/mpeg'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute $p$create policy radio_songs_staff_read on storage.objects
    for select to authenticated
    using (bucket_id = 'radio-songs' and (select private.has_staff_role('admin')))$p$;
  execute $p$create policy radio_songs_staff_insert on storage.objects
    for insert to authenticated
    with check (bucket_id = 'radio-songs' and (select private.has_staff_role('admin')))$p$;
  execute $p$create policy radio_songs_staff_update on storage.objects
    for update to authenticated
    using (bucket_id = 'radio-songs' and (select private.has_staff_role('admin')))
    with check (bucket_id = 'radio-songs' and (select private.has_staff_role('admin')))$p$;
  execute $p$create policy radio_songs_staff_delete on storage.objects
    for delete to authenticated
    using (bucket_id = 'radio-songs' and (select private.has_staff_role('admin')))$p$;
end
$$;
