-- La puerta de la fiesta (plan 019 T218, decisión 11). Escrita y probada
-- como texto en local, NO aplicada a ningún proyecto (la aplica Hernán en
-- boia-planet-dev).
--
-- Cada Carnet lleva su QR (la URL de su Carnet público). En la puerta de
-- cada fiesta, alguien del equipo lo escanea con el lector del Admin: queda
-- apuntado que vino (`event_attendance`) y el Carnet recibe el sello de la
-- fiesta, con los mismos puntos que el sello por QR (`point_actions.stamp`).
-- El Admin también puede sellar un Carnet a mano, con motivo. El camino de
-- siempre (el socio escanea el QR de la fiesta, `claim_stamp`) sigue igual.
--
-- - El lector pide el rol editor (o más) con segundo factor; a mano, admin.
-- - Un sello por fiesta y cuenta, como siempre (stamps_once): si ya lo
--   tenía, la asistencia se apunta igual y no se da nada más.
-- - La fiesta tiene que estar publicada, sin archivar y no cancelada.

-- ---------------------------------------------------------------------------
-- Asistencia: quién entró a cada fiesta, cuándo y por dónde.

create table public.event_attendance (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('door', 'manual')),
  scanned_by uuid references auth.users (id) on delete set null,
  scanned_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_attendance_user_idx on public.event_attendance (user_id);

-- La lee el equipo (y cada cual la suya); nadie la escribe a mano.
alter table public.event_attendance enable row level security;
revoke all on public.event_attendance from anon, authenticated, service_role;
grant select on public.event_attendance to authenticated;
grant select, insert, update, delete on public.event_attendance to service_role;
create policy event_attendance_read on public.event_attendance
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_staff_role('editor')));

-- ---------------------------------------------------------------------------
-- staff_stamp: el lector de la puerta (`door`) o el Admin a mano (`manual`).

create function private.staff_stamp(
  p_member uuid, p_event text, p_source text, p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  why text := nullif(btrim(coalesce(p_reason, '')), '');
  ev public.events;
  nick text;
  prev timestamptz;
  pts integer;
  n integer;
  tx uuid;
begin
  if p_source is null or p_source not in ('door', 'manual') then
    raise exception 'invalid_input' using detail = 'El origen es door o manual.';
  end if;
  actor := private.require_staff(
    case when p_source = 'manual' then 'admin' else 'editor' end::public.staff_role
  );
  if p_source = 'manual' and char_length(coalesce(why, '')) < 3 then
    raise exception 'reason_required' using detail = 'Sellar a mano pide un motivo.';
  end if;
  select * into ev from public.events e
  where e.slug = p_event and e.published_at is not null and e.archived_at is null
    and e.state not in ('draft', 'cancelled');
  if not found then
    raise exception 'unknown_event' using detail = format('Fiesta desconocida: %s', p_event);
  end if;
  select c.nickname into nick from public.carnets c where c.user_id = p_member;
  if not found then
    raise exception 'unknown_member' using detail = 'Esa cuenta no tiene Carnet.';
  end if;

  perform private.lock_account(p_member);
  insert into public.event_attendance (event_id, user_id, source, scanned_by)
  values (ev.id, p_member, p_source, actor)
  on conflict (event_id, user_id) do nothing;

  select s.granted_at into prev from public.stamps s
  where s.user_id = p_member and s.event_id = ev.id and s.revoked_at is null;
  if found then
    return jsonb_build_object('granted', false, 'reason', 'already_stamped', 'event', ev.slug,
                              'title', ev.title, 'member', p_member, 'nickname', nick,
                              'at', prev, 'points', 0);
  end if;

  pts := coalesce((select pa.max_points from public.point_actions pa where pa.action = 'stamp'), 0);
  select count(*) into n from public.ledger_transactions
  where user_id = p_member and kind = 'stamp' and event_id = ev.id;
  tx := private.stable_uuid(format('stamp|%s|%s|%s', p_member, ev.id, n));
  insert into public.ledger_transactions
    (id, user_id, kind, points_delta, event_id, source_ref, action, reason, created_by, metadata)
  values (tx, p_member, 'stamp', pts, ev.id,
          case when p_source = 'door' then 'puerta:' else 'admin:' end || ev.slug,
          'stamp', why, actor, jsonb_build_object('source', p_source));
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (actor, 'authenticated', 'staff_stamp:' || p_source, 'stamps', p_member::text,
          coalesce(why, 'puerta de ' || ev.slug), null,
          jsonb_build_object('event', ev.slug, 'tx_id', tx, 'points', pts));
  return jsonb_build_object('granted', true, 'tx_id', tx, 'event', ev.slug, 'title', ev.title,
                            'member', p_member, 'nickname', nick, 'at', now(), 'points', pts);
end;
$$;

create function public.staff_stamp(
  p_member uuid, p_event text, p_source text default 'door', p_reason text default null
) returns jsonb
language sql
set search_path = ''
as $$
  select private.staff_stamp(p_member, p_event, p_source, p_reason)
$$;

-- ---------------------------------------------------------------------------
-- Permisos: como el resto de RPC del Admin (envoltura SECURITY INVOKER que
-- llama a la privada; la privada comprueba el rol con segundo factor).

revoke all on function private.staff_stamp(uuid, text, text, text) from public;
grant execute on function private.staff_stamp(uuid, text, text, text) to authenticated;

revoke all on function public.staff_stamp(uuid, text, text, text) from public, anon;
grant execute on function public.staff_stamp(uuid, text, text, text) to authenticated;
