-- Fotos de las islas (plan 017 T189, decisión 4; REQ-COM-005, REQ-COM-006,
-- REQ-COM-031, REQ-ADM-019, D-23 puntos 6 y 7).
--
-- En el Admin se elige una isla y un evento, se suben fotos (copia propia en
-- WebP, o JPEG si el navegador no sabe, con el lado largo en 1600 px) y el
-- evento pasa a «pasado»: la isla lo enseña como recuerdo con su galería.
-- Sin aprobación: lo que sube el equipo se publica (Hernán, 2026-10-07).
--
-- El evento y la isla son los del mapa y el contenido de la web (ids de
-- texto: `halloween-2026`, `allday`…), no las filas de public.events, que
-- son las fiestas de los sellos. Lectura pública; escritura sólo del equipo
-- (admin u owner con segundo factor), con su fila en la auditoría.

-- ---------------------------------------------------------------------------
-- Álbum de un evento: uno por evento (`album-<evento>`), con su isla y si el
-- evento ya pasó (`event_finished`: la web lo enseña como finalizado).

create table public.event_albums (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{1,160}$'),
  event_id text not null check (event_id ~ '^[A-Za-z0-9_-]{1,120}$'),
  island_id text not null check (island_id ~ '^[A-Za-z0-9_:-]{1,120}$'),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  event_date timestamptz,
  event_finished boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index event_albums_one_per_event on public.event_albums (event_id);

create trigger event_albums_touch before update on public.event_albums
  for each row execute function private.touch_version();
create trigger event_albums_audit after insert or update or delete on public.event_albums
  for each row execute function private.audit_row('id');

alter table public.event_albums enable row level security;
revoke all on public.event_albums from anon, authenticated, service_role;
grant select on public.event_albums to anon, authenticated;
grant insert (id, event_id, island_id, title, event_date, event_finished)
  on public.event_albums to authenticated;
grant update (island_id, title, event_date, event_finished) on public.event_albums to authenticated;
grant delete on public.event_albums to authenticated;
grant select, insert, update, delete on public.event_albums to service_role;

create policy event_albums_read on public.event_albums
  for select to anon, authenticated
  using (true);
create policy event_albums_staff_insert on public.event_albums
  for insert to authenticated
  with check ((select private.has_staff_role('admin')));
create policy event_albums_staff_update on public.event_albums
  for update to authenticated
  using ((select private.has_staff_role('admin')))
  with check ((select private.has_staff_role('admin')));
create policy event_albums_staff_delete on public.event_albums
  for delete to authenticated
  using ((select private.has_staff_role('admin')));

-- ---------------------------------------------------------------------------
-- Fotos: sólo copias del bucket `event-photos` de este proyecto, con su
-- texto alternativo (obligatorio, REQ-COM-031) y su tamaño.

create table public.event_photos (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{1,160}$'),
  album_id text not null references public.event_albums (id) on delete cascade,
  url text not null
    check (url ~ '^https://[^/\s]+/storage/v1/object/public/event-photos/[A-Za-z0-9._/-]+$'),
  alt text not null check (char_length(btrim(alt)) between 1 and 300),
  width integer not null check (width between 1 and 1600),
  height integer not null check (height between 1 and 1600),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index event_photos_album_idx on public.event_photos (album_id, created_at);

create trigger event_photos_audit after insert or update or delete on public.event_photos
  for each row execute function private.audit_row('id');

alter table public.event_photos enable row level security;
revoke all on public.event_photos from anon, authenticated, service_role;
grant select on public.event_photos to anon, authenticated;
grant insert (id, album_id, url, alt, width, height) on public.event_photos to authenticated;
grant update (alt) on public.event_photos to authenticated;
grant delete on public.event_photos to authenticated;
grant select, insert, update, delete on public.event_photos to service_role;

create policy event_photos_read on public.event_photos
  for select to anon, authenticated
  using (true);
create policy event_photos_staff_insert on public.event_photos
  for insert to authenticated
  with check ((select private.has_staff_role('admin')));
create policy event_photos_staff_update on public.event_photos
  for update to authenticated
  using ((select private.has_staff_role('admin')))
  with check ((select private.has_staff_role('admin')));
create policy event_photos_staff_delete on public.event_photos
  for delete to authenticated
  using ((select private.has_staff_role('admin')));

-- ---------------------------------------------------------------------------
-- Storage: bucket público (la isla las pinta sin sesión), escritura sólo del
-- equipo con aal2. Copias WebP o JPEG de 4 MB como mucho. Sin el esquema
-- storage (el PostgreSQL local de `pnpm db:test`) esta parte no se aplica.

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('event-photos', 'event-photos', true, 4194304, array['image/webp', 'image/jpeg'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute $p$create policy event_photos_staff_read on storage.objects
    for select to authenticated
    using (bucket_id = 'event-photos' and (select private.has_staff_role('admin')))$p$;
  execute $p$create policy event_photos_staff_insert on storage.objects
    for insert to authenticated
    with check (bucket_id = 'event-photos' and (select private.has_staff_role('admin')))$p$;
  execute $p$create policy event_photos_staff_update on storage.objects
    for update to authenticated
    using (bucket_id = 'event-photos' and (select private.has_staff_role('admin')))
    with check (bucket_id = 'event-photos' and (select private.has_staff_role('admin')))$p$;
  execute $p$create policy event_photos_staff_delete on storage.objects
    for delete to authenticated
    using (bucket_id = 'event-photos' and (select private.has_staff_role('admin')))$p$;
end
$$;
