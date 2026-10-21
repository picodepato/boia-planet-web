-- El enlace de la puerta (plan 034 T307, decisión de Álvaro 2026-10-21).
-- Detrás de 20261008100300_door_stamps.sql (`staff_stamp`, asistencia).
-- Aplicada sólo a boia-planet-dev; producción la recibe con las demás.
--
-- - Un enlace secreto por fiesta, sin caducidad, revocable. Quien lo tiene
--   abre el lector de la puerta sin cuenta (`/puerta/<código>`) y sella los
--   Carnets que escanea, como el lector del equipo (`staff_stamp` con
--   `door`): un sello por fiesta y cuenta, los mismos puntos.
-- - Sólo se guarda el hash del código (SHA-256); el código se devuelve una
--   vez, al crearlo. Crear otro para la misma fiesta revoca el anterior.
-- - Deja de valer al revocarlo y cuando la fiesta se archiva, se cancela o
--   deja de estar publicada.
-- - Sólo escanear: nada de sellar por apodo; tras cada lectura, el apodo y
--   el resultado (lo mismo que enseña el lector del equipo).
-- - Cada lectura queda en `event_attendance` (`door`, con el enlace en
--   `door_link_id` y sin `scanned_by`) y en la auditoría.
-- - Crear, listar y revocar: el rol admin con segundo factor.

-- ---------------------------------------------------------------------------
-- Los enlaces (nadie de fuera los lee: todo va por las RPC)

create table public.door_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by uuid,
  revoked_at timestamptz,
  revoked_by uuid
);
-- Uno vivo por fiesta.
create unique index door_links_live_idx on public.door_links (event_id) where revoked_at is null;

alter table public.door_links enable row level security;
revoke all on public.door_links from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.door_links to service_role;

-- La asistencia apunta qué enlace la escaneó (el lector del equipo: null).
alter table public.event_attendance
  add column door_link_id uuid references public.door_links (id) on delete set null;

create function private.door_token_hash(p_token text) returns text
language sql immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(lower(btrim(coalesce(p_token, ''))), 'UTF8')), 'hex')
$$;

-- El enlace vivo de un código, con su fiesta abierta (publicada, sin
-- archivar, ni borrador ni cancelada). Nada si no vale.
create function private.live_door_link(p_token text)
returns table (link_id uuid, event_id uuid)
language sql stable
security definer
set search_path = ''
as $$
  select l.id, e.id
  from public.door_links l
  join public.events e on e.id = l.event_id
  where btrim(coalesce(p_token, '')) <> ''
    and l.token_hash = private.door_token_hash(p_token)
    and l.revoked_at is null
    and e.published_at is not null and e.archived_at is null
    and e.state not in ('draft', 'cancelled')
$$;

-- ---------------------------------------------------------------------------
-- El Admin: crear (sustituye al vivo), listar y revocar

create function private.admin_create_door_link(p_event text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  ev public.events;
  token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  old_id uuid;
  res public.door_links;
begin
  select * into ev from public.events e
  where e.slug = p_event and e.published_at is not null and e.archived_at is null
    and e.state not in ('draft', 'cancelled');
  if not found then
    raise exception 'unknown_event' using detail = format('Fiesta desconocida: %s', p_event);
  end if;
  update public.door_links
  set revoked_at = now(), revoked_by = actor
  where event_id = ev.id and revoked_at is null
  returning id into old_id;
  insert into public.door_links (event_id, token_hash, created_by)
  values (ev.id, private.door_token_hash(token), actor)
  returning * into res;
  -- La auditoría nunca guarda el código.
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (actor, 'authenticated', 'create_door_link', 'door_links', res.id::text, p_reason,
          case when old_id is null then null else jsonb_build_object('revoked', old_id) end,
          jsonb_build_object('event', ev.slug, 'created_at', res.created_at));
  return jsonb_build_object('token', token, 'id', res.id, 'event', ev.slug, 'title', ev.title,
                            'created_at', res.created_at);
end;
$$;

-- Los enlaces vivos (nunca el código).
create function private.admin_door_links()
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
      'id', l.id, 'event', e.slug, 'title', e.title, 'created_at', l.created_at
    ) order by l.created_at desc)
    from public.door_links l
    join public.events e on e.id = l.event_id
    where l.revoked_at is null
  ), '[]'::jsonb);
end;
$$;

create function private.admin_revoke_door_link(p_event text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  ev_id uuid;
  gone uuid;
begin
  select e.id into ev_id from public.events e where e.slug = p_event;
  if not found then
    raise exception 'unknown_event' using detail = format('Fiesta desconocida: %s', p_event);
  end if;
  update public.door_links
  set revoked_at = now(), revoked_by = actor
  where event_id = ev_id and revoked_at is null
  returning id into gone;
  if gone is not null then
    insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
    values (actor, 'authenticated', 'revoke_door_link', 'door_links', gone::text, p_reason,
            null, jsonb_build_object('event', p_event));
  end if;
  return jsonb_build_object('revoked', gone is not null, 'event', p_event);
end;
$$;

-- ---------------------------------------------------------------------------
-- La página del enlace: ¿vale este código? ¿de qué fiesta es?

create function private.door_link_info(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('valid', true, 'title', e.title, 'starts_at', e.starts_at)
     from private.live_door_link(p_token) l
     join public.events e on e.id = l.event_id),
    jsonb_build_object('valid', false)
  )
$$;

-- ---------------------------------------------------------------------------
-- Sellar con el enlace: lo mismo que `staff_stamp` con `door`, sin cuenta.

create function private.door_link_stamp(p_token text, p_member uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_id uuid;
  ev_id uuid;
  ev public.events;
  nick text;
  prev timestamptz;
  pts integer;
  n integer;
  tx uuid;
begin
  select l.link_id, l.event_id into link_id, ev_id from private.live_door_link(p_token) l;
  select * into ev from public.events e where e.id = ev_id;
  if link_id is null or ev.id is null then
    raise exception 'door_link_invalid'
      using detail = 'Este enlace de la puerta ya no vale: pide uno nuevo al equipo.';
  end if;
  select c.nickname into nick from public.carnets c where c.user_id = p_member;
  if p_member is null or not found then
    raise exception 'unknown_member' using detail = 'Esa cuenta no tiene Carnet.';
  end if;

  perform private.lock_account(p_member);
  insert into public.event_attendance (event_id, user_id, source, scanned_by, door_link_id)
  values (ev.id, p_member, 'door', null, link_id)
  on conflict (event_id, user_id) do nothing;

  select s.granted_at into prev from public.stamps s
  where s.user_id = p_member and s.event_id = ev.id and s.revoked_at is null;
  if found then
    insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
    values (null, 'door_link', 'door_link_stamp', 'stamps', p_member::text,
            'enlace de la puerta de ' || ev.slug, null,
            jsonb_build_object('event', ev.slug, 'door_link', link_id, 'granted', false));
    return jsonb_build_object('granted', false, 'reason', 'already_stamped',
                              'title', ev.title, 'nickname', nick, 'at', prev);
  end if;

  pts := coalesce((select pa.max_points from public.point_actions pa where pa.action = 'stamp'), 0);
  select count(*) into n from public.ledger_transactions
  where user_id = p_member and kind = 'stamp' and event_id = ev.id;
  tx := private.stable_uuid(format('stamp|%s|%s|%s', p_member, ev.id, n));
  insert into public.ledger_transactions
    (id, user_id, kind, points_delta, event_id, source_ref, action, reason, created_by, metadata)
  values (tx, p_member, 'stamp', pts, ev.id, 'puerta:' || ev.slug, 'stamp', null, null,
          jsonb_build_object('source', 'door', 'door_link', link_id));
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (null, 'door_link', 'door_link_stamp', 'stamps', p_member::text,
          'enlace de la puerta de ' || ev.slug, null,
          jsonb_build_object('event', ev.slug, 'door_link', link_id, 'granted', true,
                             'tx_id', tx, 'points', pts));
  return jsonb_build_object('granted', true, 'title', ev.title, 'nickname', nick, 'at', now());
end;
$$;

-- ---------------------------------------------------------------------------
-- Las envolturas de `public` (SECURITY INVOKER, como el resto)

create function public.admin_create_door_link(p_event text, p_reason text default null)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_create_door_link(p_event, p_reason)
$$;

create function public.admin_door_links()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_door_links()
$$;

create function public.admin_revoke_door_link(p_event text, p_reason text default null)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_revoke_door_link(p_event, p_reason)
$$;

create function public.door_link_info(p_token text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.door_link_info(p_token)
$$;

create function public.door_link_stamp(p_token text, p_member uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.door_link_stamp(p_token, p_member)
$$;

-- ---------------------------------------------------------------------------
-- Permisos: el Admin, sólo authenticated (el rol lo comprueba la privada);
-- la información y el sello del enlace, también sin cuenta (el código es la
-- llave).

revoke all on function private.door_token_hash(text) from public, anon, authenticated;
revoke all on function private.live_door_link(text) from public, anon, authenticated;
revoke all on function private.admin_create_door_link(text, text) from public, anon, authenticated;
revoke all on function private.admin_door_links() from public, anon, authenticated;
revoke all on function private.admin_revoke_door_link(text, text) from public, anon, authenticated;
revoke all on function private.door_link_info(text) from public, anon, authenticated;
revoke all on function private.door_link_stamp(text, uuid) from public, anon, authenticated;
grant execute on function private.admin_create_door_link(text, text) to authenticated;
grant execute on function private.admin_door_links() to authenticated;
grant execute on function private.admin_revoke_door_link(text, text) to authenticated;
grant execute on function private.door_link_info(text) to anon, authenticated;
grant execute on function private.door_link_stamp(text, uuid) to anon, authenticated;

revoke all on function public.admin_create_door_link(text, text) from public, anon, authenticated;
revoke all on function public.admin_door_links() from public, anon, authenticated;
revoke all on function public.admin_revoke_door_link(text, text) from public, anon, authenticated;
revoke all on function public.door_link_info(text) from public, anon, authenticated;
revoke all on function public.door_link_stamp(text, uuid) from public, anon, authenticated;
grant execute on function public.admin_create_door_link(text, text) to authenticated;
grant execute on function public.admin_door_links() to authenticated;
grant execute on function public.admin_revoke_door_link(text, text) to authenticated;
grant execute on function public.door_link_info(text) to anon, authenticated;
grant execute on function public.door_link_stamp(text, uuid) to anon, authenticated;
