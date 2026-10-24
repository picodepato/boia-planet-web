-- Ajustes de cada pieza de la Galería desde el Admin (plan 048 T329). Aplicada
-- sólo a boia-planet-dev; producción la recibe con las demás del plan.
--
-- Cada foto o clip (los que van en el código, álbum real `album-boia`, y los
-- que el Admin sube a `event_photos`) se identifica por su id. Por pieza:
--
-- - `on_home`: sale en la portada (además de en la galería). null: lo que
--   diga el código (la portada por defecto de T328; lo subido, no).
-- - `sort`: su puesto en el orden de la portada y la galería (0, 1, 2…).
--   null: el orden del contenido, detrás de las ordenadas.
-- - `hidden`: borrada. Una pieza del código no se puede borrar del repo: se
--   oculta. Una subida se borra de verdad (`admin_media_delete`: su fila de
--   `event_photos`; el archivo del bucket lo quita el Admin con su sesión).
--
-- Lectura pública sólo de lo que la web necesita (id, portada, orden,
-- oculta); quién y cuándo, no. Escribir, sólo con las RPC del Admin (admin
-- con segundo factor): envoltura en `public` que llama a la privada SECURITY
-- DEFINER, search_path vacío y fila en la auditoría.
-- Reejecutable.

create table if not exists public.media_settings (
  piece_id text primary key check (piece_id ~ '^[A-Za-z0-9_-]{1,160}$'),
  on_home boolean,
  sort integer check (sort between 0 and 100000),
  hidden boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.media_settings enable row level security;
revoke all on public.media_settings from anon, authenticated, service_role;
grant select (piece_id, on_home, sort, hidden) on public.media_settings to anon, authenticated;
grant select, insert, update, delete on public.media_settings to service_role;
drop policy if exists media_settings_read on public.media_settings;
create policy media_settings_read on public.media_settings
  for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Ayuda: apunta el cambio de una pieza en la auditoría. Sin SECURITY
-- DEFINER y sin permiso para las cuentas: sólo la llaman las RPC de abajo.

create or replace function private.media_settings_audit(
  p_actor uuid, p_action text, p_piece text, p_old jsonb, p_new jsonb
) returns void
language sql
set search_path = ''
as $$
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason,
                                old_value, new_value)
  values (p_actor, 'authenticated', p_action, 'media_settings', p_piece, 'galería', p_old, p_new)
$$;

-- ---------------------------------------------------------------------------
-- En portada sí/no.

create or replace function private.admin_media_set_home(p_piece text, p_on_home boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  prev public.media_settings;
begin
  select * into prev from public.media_settings m where m.piece_id = p_piece;
  insert into public.media_settings as m (piece_id, on_home, updated_by, updated_at)
  values (p_piece, p_on_home, actor, now())
  on conflict (piece_id) do update
    set on_home = excluded.on_home, updated_by = excluded.updated_by, updated_at = now();
  perform private.media_settings_audit(actor, 'media_set_home', p_piece,
    case when prev.piece_id is null then null else jsonb_build_object('on_home', prev.on_home) end,
    jsonb_build_object('on_home', p_on_home));
  return jsonb_build_object('piece', p_piece, 'on_home', p_on_home);
end;
$$;

create or replace function public.admin_media_set_home(p_piece text, p_on_home boolean)
returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_media_set_home(p_piece, p_on_home)
$$;

-- ---------------------------------------------------------------------------
-- El orden: la lista entera de ids, de la primera a la última.

create or replace function private.admin_media_order(p_pieces text[]) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  n integer := coalesce(cardinality(p_pieces), 0);
begin
  if n = 0 or n > 2000 or (select count(distinct x) from unnest(p_pieces) x) <> n then
    raise exception 'invalid_entry' using errcode = '22023',
      detail = 'El orden es una lista de ids sin repetir (1 a 2000).';
  end if;
  insert into public.media_settings as m (piece_id, sort, updated_by, updated_at)
  select x.id, (x.ord - 1)::integer, actor, now()
  from unnest(p_pieces) with ordinality as x (id, ord)
  on conflict (piece_id) do update
    set sort = excluded.sort, updated_by = excluded.updated_by, updated_at = now();
  perform private.media_settings_audit(actor, 'media_order', null, null,
    jsonb_build_object('order', to_jsonb(p_pieces)));
  return jsonb_build_object('count', n);
end;
$$;

create or replace function public.admin_media_order(p_pieces text[]) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_media_order(p_pieces)
$$;

-- ---------------------------------------------------------------------------
-- Ocultar (borrar una pieza del código) o volver a enseñar.

create or replace function private.admin_media_hide(p_piece text, p_hidden boolean) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  prev public.media_settings;
begin
  select * into prev from public.media_settings m where m.piece_id = p_piece;
  insert into public.media_settings as m (piece_id, hidden, updated_by, updated_at)
  values (p_piece, coalesce(p_hidden, true), actor, now())
  on conflict (piece_id) do update
    set hidden = excluded.hidden, updated_by = excluded.updated_by, updated_at = now();
  perform private.media_settings_audit(actor, 'media_hide', p_piece,
    case when prev.piece_id is null then null else jsonb_build_object('hidden', prev.hidden) end,
    jsonb_build_object('hidden', coalesce(p_hidden, true)));
  return jsonb_build_object('piece', p_piece, 'hidden', coalesce(p_hidden, true));
end;
$$;

create or replace function public.admin_media_hide(p_piece text, p_hidden boolean default true)
returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_media_hide(p_piece, p_hidden)
$$;

-- ---------------------------------------------------------------------------
-- Borrar una pieza subida: su fila de `event_photos` y sus ajustes. Devuelve
-- las URL de sus archivos (el clip y su póster) para quitarlos del bucket;
-- {deleted: false} si ya no estaba.

create or replace function private.admin_media_delete(p_piece text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  prev public.event_photos;
begin
  delete from public.event_photos p where p.id = p_piece returning * into prev;
  delete from public.media_settings m where m.piece_id = p_piece;
  if prev.id is null then
    return jsonb_build_object('deleted', false, 'piece', p_piece);
  end if;
  perform private.media_settings_audit(actor, 'media_delete', p_piece,
    jsonb_build_object('album_id', prev.album_id, 'url', prev.url, 'poster_url', prev.poster_url,
                       'alt', prev.alt, 'kind', prev.kind),
    null);
  return jsonb_build_object('deleted', true, 'piece', p_piece, 'url', prev.url,
                            'poster_url', prev.poster_url);
end;
$$;

create or replace function public.admin_media_delete(p_piece text) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_media_delete(p_piece)
$$;

-- ---------------------------------------------------------------------------
-- Permisos: sólo cuentas; la RPC privada comprueba admin con aal2.

revoke all on function private.media_settings_audit(uuid, text, text, jsonb, jsonb)
  from public, anon, authenticated;

revoke all on function private.admin_media_set_home(text, boolean) from public;
grant execute on function private.admin_media_set_home(text, boolean) to authenticated;
revoke all on function public.admin_media_set_home(text, boolean) from public, anon;
grant execute on function public.admin_media_set_home(text, boolean) to authenticated;

revoke all on function private.admin_media_order(text[]) from public;
grant execute on function private.admin_media_order(text[]) to authenticated;
revoke all on function public.admin_media_order(text[]) from public, anon;
grant execute on function public.admin_media_order(text[]) to authenticated;

revoke all on function private.admin_media_hide(text, boolean) from public;
grant execute on function private.admin_media_hide(text, boolean) to authenticated;
revoke all on function public.admin_media_hide(text, boolean) from public, anon;
grant execute on function public.admin_media_hide(text, boolean) to authenticated;

revoke all on function private.admin_media_delete(text) from public;
grant execute on function private.admin_media_delete(text) to authenticated;
revoke all on function public.admin_media_delete(text) from public, anon;
grant execute on function public.admin_media_delete(text) to authenticated;
