-- Un Carnet de artista unido a su ficha de /artistas (plan 031 T295).
-- Detrás de 20261015100100_carnet_questions_audience.sql. Aplicada sólo a
-- boia-planet-dev; producción la recibe con las demás del plan
-- (docs/propuestas/2026-10-03-produccion-supabase.md).
--
-- Las fichas de artista son contenido (el área `artists` del repositorio,
-- con un id que es el slug del nombre: `alba-fitz`), no una tabla. La unión
-- vive en el Carnet: `carnets.artist_profile_id`, el id de la ficha, única
-- (una ficha, un Carnet). No hay clave foránea porque la ficha no está en la
-- base: si el Admin borra la ficha, el Carnet sigue y se enseña solo.
--
-- - `admin_join_artist_profile(p_user, p_profile, p_reason)`: el Admin une
--   un Carnet a una ficha libre. También lo marca como artista.
-- - `admin_unjoin_artist_profile(p_user, p_reason)`: deshace la unión; el
--   Carnet sigue siendo de artista.
-- - `admin_set_artist(.., false)`: quitar «artista» también deshace la unión.
-- - Todo deja su fila en `audit_log`.
-- - `private.join_artist_profile` es la unión sin comprobar el rol, para las
--   RPC de este plan (T296, T297): nadie la ejecuta desde fuera.
-- Reejecutable.

-- ---------------------------------------------------------------------------
-- La columna

alter table public.carnets
  add column if not exists artist_profile_id text;

alter table public.carnets
  drop constraint if exists carnets_artist_profile_id_check;
alter table public.carnets
  add constraint carnets_artist_profile_id_check
  check (artist_profile_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(artist_profile_id) <= 120);

alter table public.carnets
  drop constraint if exists carnets_artist_profile_id_key;
alter table public.carnets
  add constraint carnets_artist_profile_id_key unique (artist_profile_id);

-- ---------------------------------------------------------------------------
-- La unión (sin comprobar el rol: la llaman las RPC que sí lo comprueban)

create or replace function private.join_artist_profile(
  p_user uuid, p_profile text, p_actor uuid, p_action text, p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile text := btrim(coalesce(p_profile, ''));
  before public.carnets;
  after public.carnets;
begin
  if profile !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(profile) > 120 then
    raise exception 'invalid_profile' using detail = 'Esa ficha de artista no existe.';
  end if;
  select * into before from public.carnets where user_id = p_user for update;
  if not found then
    raise exception 'unknown_member' using detail = 'Esa cuenta no tiene Carnet.';
  end if;
  if before.artist_profile_id = profile then
    -- Lo repetido no es un error.
    return jsonb_build_object(
      'user_id', p_user, 'artist_profile_id', profile, 'is_artist', before.is_artist, 'joined', false
    );
  end if;
  if before.artist_profile_id is not null then
    raise exception 'already_joined'
      using detail = 'Este Carnet ya está unido a otra ficha: primero, deshacer la unión.';
  end if;
  if exists (select 1 from public.carnets c where c.artist_profile_id = profile) then
    raise exception 'profile_claimed' using detail = 'Esa ficha ya es de otro Carnet.';
  end if;
  begin
    update public.carnets
    set artist_profile_id = profile, is_artist = true
    where user_id = p_user
    returning * into after;
  exception when unique_violation then
    raise exception 'profile_claimed' using detail = 'Esa ficha ya es de otro Carnet.';
  end;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (
    p_actor, 'authenticated', p_action, 'carnets', p_user::text, p_reason,
    jsonb_build_object('is_artist', before.is_artist, 'artist_profile_id', before.artist_profile_id),
    jsonb_build_object('is_artist', after.is_artist, 'artist_profile_id', after.artist_profile_id)
  );
  return jsonb_build_object(
    'user_id', p_user, 'artist_profile_id', profile, 'is_artist', true, 'joined', true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC del Admin

create or replace function private.admin_join_artist_profile(
  p_user uuid, p_profile text, p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
begin
  return private.join_artist_profile(p_user, p_profile, actor, 'join_artist_profile', p_reason);
end;
$$;

create or replace function private.admin_unjoin_artist_profile(p_user uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  before public.carnets;
begin
  select * into before from public.carnets where user_id = p_user for update;
  if not found then
    raise exception 'unknown_member' using detail = 'Esa cuenta no tiene Carnet.';
  end if;
  if before.artist_profile_id is null then
    return jsonb_build_object('user_id', p_user, 'artist_profile_id', null, 'unjoined', false);
  end if;
  update public.carnets set artist_profile_id = null where user_id = p_user;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (
    actor, 'authenticated', 'unjoin_artist_profile', 'carnets', p_user::text, p_reason,
    jsonb_build_object('artist_profile_id', before.artist_profile_id),
    jsonb_build_object('artist_profile_id', null)
  );
  return jsonb_build_object('user_id', p_user, 'artist_profile_id', null, 'unjoined', true);
end;
$$;

-- Quitar «artista» también deshace la unión (una ficha no queda tomada por un
-- Carnet que ya no sale en /artistas).
create or replace function private.admin_set_artist(p_user uuid, p_is_artist boolean, p_reason text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  before public.carnets;
  after public.carnets;
  artist boolean := coalesce(p_is_artist, false);
begin
  select * into before from public.carnets where user_id = p_user;
  if not found then
    raise exception 'unknown_member' using detail = 'Esa cuenta no tiene Carnet.';
  end if;
  update public.carnets
  set is_artist = artist,
      artist_profile_id = case when artist then artist_profile_id else null end
  where user_id = p_user returning * into after;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (actor, 'authenticated', 'set_artist', 'carnets', p_user::text, p_reason,
          jsonb_build_object('is_artist', before.is_artist, 'artist_profile_id', before.artist_profile_id),
          jsonb_build_object('is_artist', after.is_artist, 'artist_profile_id', after.artist_profile_id));
  return private.profile_json(p_user);
end;
$$;

create or replace function public.admin_join_artist_profile(
  p_user uuid, p_profile text, p_reason text default null
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_join_artist_profile(p_user, p_profile, p_reason)
$$;

create or replace function public.admin_unjoin_artist_profile(p_user uuid, p_reason text default null)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_unjoin_artist_profile(p_user, p_reason)
$$;

-- ---------------------------------------------------------------------------
-- Permisos: la unión sin rol, para nadie de fuera; las del Admin, para
-- authenticated (las privadas comprueban el rol con segundo factor).

revoke all on function private.join_artist_profile(uuid, text, uuid, text, text)
  from public, anon, authenticated;
revoke all on function private.admin_join_artist_profile(uuid, text, text) from public, anon;
revoke all on function private.admin_unjoin_artist_profile(uuid, text) from public, anon;
grant execute on function private.admin_join_artist_profile(uuid, text, text) to authenticated;
grant execute on function private.admin_unjoin_artist_profile(uuid, text) to authenticated;

revoke all on function public.admin_join_artist_profile(uuid, text, text) from public, anon;
revoke all on function public.admin_unjoin_artist_profile(uuid, text) from public, anon;
grant execute on function public.admin_join_artist_profile(uuid, text, text) to authenticated;
grant execute on function public.admin_unjoin_artist_profile(uuid, text) to authenticated;
