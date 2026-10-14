-- «¿Eres uno de estos artistas?»: la solicitud para reclamar una ficha que
-- revisa el Admin (plan 031 T297, la vía 2). Detrás de
-- 20261015100300_artist_claim_links.sql. Aplicada sólo a boia-planet-dev;
-- producción la recibe con las demás del plan
-- (docs/propuestas/2026-10-03-produccion-supabase.md).
--
-- El enlace general de artistas lo comparte cualquiera: quien crea su Carnet
-- con él NO puede unirse a una ficha por su cuenta (podría hacerse pasar por
-- otro). Elige una ficha sin reclamar y eso deja una SOLICITUD pendiente;
-- sólo el Admin la aprueba (y entonces une, con la unión de T295) o la
-- rechaza (el Carnet sigue siendo de artista, sin ficha).
--
-- - `request_artist_profile(p_profile, p_name)`: el Carnet de la sesión (de
--   artista y sin ficha) pide una ficha libre. Una solicitud pendiente por
--   Carnet y por ficha a la vez (índices únicos parciales).
-- - `my_artist_claim_request()`: la solicitud pendiente propia, o null.
-- - `cancel_artist_claim_request()`: la retira quien la hizo.
-- - `admin_artist_claim_requests()`: las pendientes, con apodo, email, ficha
--   y fecha (rol admin con segundo factor).
-- - `admin_decide_artist_claim_request(p_request, p_approve, p_reason)`:
--   aprobar une (auditoría `claim_request_approved`); rechazar la cierra
--   (`claim_request_rejected`).
-- - `private.join_artist_profile` (T295) se redefine: al unir una ficha por
--   cualquier vía, se cierran las solicitudes pendientes de esa ficha y las
--   del Carnet unido.
-- - Nadie sin cuenta ve ni toca las solicitudes; la tabla no se lee de fuera.
-- Reejecutable.

-- ---------------------------------------------------------------------------
-- La tabla

create table if not exists private.artist_claim_requests (
  id uuid primary key default gen_random_uuid(),
  -- La cuenta (no el Carnet): un socio en la papelera conserva su solicitud
  -- hasta que se purga; mientras, no sale en la lista del Admin.
  user_id uuid not null references auth.users (id) on delete cascade,
  profile_id text not null
    check (profile_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(profile_id) <= 120),
  profile_name text not null check (char_length(profile_name) between 1 and 120),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled', 'closed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);
revoke all on private.artist_claim_requests from public, anon, authenticated, service_role;

create unique index if not exists artist_claim_requests_one_pending_per_user
  on private.artist_claim_requests (user_id) where status = 'pending';
create unique index if not exists artist_claim_requests_one_pending_per_profile
  on private.artist_claim_requests (profile_id) where status = 'pending';

-- ---------------------------------------------------------------------------
-- La unión de T295, que ahora cierra las solicitudes pendientes de la ficha
-- (otra vía la ha reclamado) y las del Carnet unido. Igual que la de
-- 20261015100200_artist_profile_join.sql con ese cierre.

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
  -- Plan 031 T297: la ficha ya es de alguien y este Carnet ya tiene ficha.
  update private.artist_claim_requests
  set status = 'closed', decided_at = now(), decided_by = p_actor
  where status = 'pending' and (profile_id = profile or user_id = p_user);
  return jsonb_build_object(
    'user_id', p_user, 'artist_profile_id', profile, 'is_artist', true, 'joined', true
  );
end;
$$;

revoke all on function private.join_artist_profile(uuid, text, uuid, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- El artista: pedir, ver la suya, retirarla

create or replace function private.request_artist_profile(p_profile text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p_user uuid := private.require_member();
  profile text := btrim(coalesce(p_profile, ''));
  pname text := btrim(coalesce(p_name, ''));
  me public.carnets;
  res private.artist_claim_requests;
begin
  if profile !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(profile) > 120
     or char_length(pname) not between 1 and 120 then
    raise exception 'invalid_profile' using detail = 'Esa ficha de artista no existe.';
  end if;
  select * into me from public.carnets where user_id = p_user for update;
  if not found then
    raise exception 'unknown_member' using detail = 'Esa cuenta no tiene Carnet.';
  end if;
  if not coalesce(me.is_artist, false) then
    raise exception 'artist_required' using detail = 'Sólo un Carnet de artista puede pedir una ficha.';
  end if;
  if me.artist_profile_id is not null then
    raise exception 'already_joined' using detail = 'Tu Carnet ya está unido a una ficha.';
  end if;
  if exists (select 1 from public.carnets c where c.artist_profile_id = profile) then
    raise exception 'profile_claimed' using detail = 'Esa ficha ya es de otro Carnet.';
  end if;
  if exists (select 1 from private.artist_claim_requests r
             where r.user_id = p_user and r.status = 'pending') then
    raise exception 'request_pending'
      using detail = 'Ya tienes una solicitud pendiente: retírala antes de pedir otra.';
  end if;
  begin
    insert into private.artist_claim_requests (user_id, profile_id, profile_name)
    values (p_user, profile, pname)
    returning * into res;
  exception when unique_violation then
    raise exception 'profile_requested'
      using detail = 'Otra persona ya ha pedido esa ficha: BOIA la está revisando.';
  end;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (
    p_user, 'authenticated', 'claim_request_created', 'artist_claim_requests', res.id::text, null,
    null, jsonb_build_object('user_id', p_user, 'profile_id', profile, 'status', 'pending')
  );
  return jsonb_build_object(
    'id', res.id, 'profile_id', res.profile_id, 'profile_name', res.profile_name,
    'status', res.status, 'created_at', res.created_at
  );
end;
$$;

create or replace function private.my_artist_claim_request()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p_user uuid := private.require_member();
begin
  return (
    select jsonb_build_object(
      'id', r.id, 'profile_id', r.profile_id, 'profile_name', r.profile_name,
      'status', r.status, 'created_at', r.created_at
    )
    from private.artist_claim_requests r
    where r.user_id = p_user and r.status = 'pending'
  );
end;
$$;

create or replace function private.cancel_artist_claim_request()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p_user uuid := private.require_member();
  res private.artist_claim_requests;
begin
  update private.artist_claim_requests
  set status = 'cancelled', decided_at = now(), decided_by = p_user
  where user_id = p_user and status = 'pending'
  returning * into res;
  if not found then
    return jsonb_build_object('cancelled', false);
  end if;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (
    p_user, 'authenticated', 'claim_request_cancelled', 'artist_claim_requests', res.id::text, null,
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'cancelled')
  );
  return jsonb_build_object('cancelled', true, 'id', res.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- El Admin: la lista de pendientes y la decisión

create or replace function private.admin_artist_claim_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_staff('admin');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'user_id', r.user_id, 'nickname', c.nickname, 'email', u.email::text,
      'profile_id', r.profile_id, 'profile_name', r.profile_name, 'created_at', r.created_at
    ) order by r.created_at, r.id)
    from private.artist_claim_requests r
    join public.carnets c on c.user_id = r.user_id
    join auth.users u on u.id = r.user_id
    where r.status = 'pending'
  ), '[]'::jsonb);
end;
$$;

create or replace function private.admin_decide_artist_claim_request(
  p_request uuid, p_approve boolean, p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  req private.artist_claim_requests;
  approve boolean := coalesce(p_approve, false);
begin
  select * into req from private.artist_claim_requests where id = p_request for update;
  if not found then
    raise exception 'unknown_request' using detail = 'Esa solicitud no existe.';
  end if;
  if req.status <> 'pending' then
    raise exception 'request_closed' using detail = 'Esa solicitud ya está cerrada.';
  end if;
  if approve then
    -- La unión audita (`claim_request_approved`) y cierra las pendientes de
    -- la ficha y del Carnet (también ésta, que se marca aprobada después).
    perform private.join_artist_profile(
      req.user_id, req.profile_id, actor, 'claim_request_approved', p_reason
    );
    update private.artist_claim_requests
    set status = 'approved', decided_at = now(), decided_by = actor
    where id = req.id;
  else
    update private.artist_claim_requests
    set status = 'rejected', decided_at = now(), decided_by = actor
    where id = req.id;
    insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
    values (
      actor, 'authenticated', 'claim_request_rejected', 'artist_claim_requests', req.id::text, p_reason,
      jsonb_build_object('status', 'pending'),
      jsonb_build_object('status', 'rejected', 'user_id', req.user_id, 'profile_id', req.profile_id)
    );
  end if;
  return jsonb_build_object(
    'id', req.id, 'user_id', req.user_id, 'profile_id', req.profile_id,
    'status', case when approve then 'approved' else 'rejected' end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Las públicas (INVOKER): sólo llaman a la privada

create or replace function public.request_artist_profile(p_profile text, p_name text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.request_artist_profile(p_profile, p_name)
$$;

create or replace function public.my_artist_claim_request()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.my_artist_claim_request()
$$;

create or replace function public.cancel_artist_claim_request()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.cancel_artist_claim_request()
$$;

create or replace function public.admin_artist_claim_requests()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_artist_claim_requests()
$$;

create or replace function public.admin_decide_artist_claim_request(
  p_request uuid, p_approve boolean, p_reason text default null
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_decide_artist_claim_request(p_request, p_approve, p_reason)
$$;

-- ---------------------------------------------------------------------------
-- Permisos: todo, sólo authenticated (la privada mira la sesión o el rol
-- con segundo factor); anon, nada.

revoke all on function private.request_artist_profile(text, text) from public, anon, authenticated;
revoke all on function private.my_artist_claim_request() from public, anon, authenticated;
revoke all on function private.cancel_artist_claim_request() from public, anon, authenticated;
revoke all on function private.admin_artist_claim_requests() from public, anon, authenticated;
revoke all on function private.admin_decide_artist_claim_request(uuid, boolean, text) from public, anon, authenticated;
grant execute on function private.request_artist_profile(text, text) to authenticated;
grant execute on function private.my_artist_claim_request() to authenticated;
grant execute on function private.cancel_artist_claim_request() to authenticated;
grant execute on function private.admin_artist_claim_requests() to authenticated;
grant execute on function private.admin_decide_artist_claim_request(uuid, boolean, text) to authenticated;

revoke all on function public.request_artist_profile(text, text) from public, anon, authenticated;
revoke all on function public.my_artist_claim_request() from public, anon, authenticated;
revoke all on function public.cancel_artist_claim_request() from public, anon, authenticated;
revoke all on function public.admin_artist_claim_requests() from public, anon, authenticated;
revoke all on function public.admin_decide_artist_claim_request(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.request_artist_profile(text, text) to authenticated;
grant execute on function public.my_artist_claim_request() to authenticated;
grant execute on function public.cancel_artist_claim_request() to authenticated;
grant execute on function public.admin_artist_claim_requests() to authenticated;
grant execute on function public.admin_decide_artist_claim_request(uuid, boolean, text) to authenticated;
