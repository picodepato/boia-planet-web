-- La lista de una fiesta (plan 034 T308, Álvaro 2026-10-21). Aplicada sólo a
-- boia-planet-dev; producción la recibe con las demás del plan.
--
-- Una fiesta puede ir «en lista» en vez de vender entradas: quien tiene Carnet
-- se apunta («Apuntarse en la lista») con un nombre de lista y en la puerta se
-- ve si está apuntado. Reglas:
--
-- - Ajustes por fiesta (`event_guest_lists`): modo lista sí/no, tope de
--   personas, hora de cierre de la lista (Halloween: 22:30 del 31 de octubre,
--   Europe/Madrid) y un interruptor abierta/cerrada para el Admin.
-- - A la hora de cierre la lista se cierra sola: nadie se apunta ni se borra
--   después. El Admin la puede cerrar antes con el interruptor.
-- - Una inscripción por cuenta y fiesta (`guest_list_signups`): nombre de
--   lista de 2 a 30 caracteres (por defecto, el apodo del Carnet; texto libre,
--   puede repetirse) y cuándo.
-- - Apuntarse pide una cuenta con Carnet (`not_member` sin cuenta o anónima,
--   `carnet_required` sin Carnet). Si ya estaba, devuelve su inscripción tal
--   cual, sin crear otra. Llena → `full`; cerrada → `closed`; la fiesta no va
--   en lista → `not_enabled`.
-- - Cada cual se borra mientras la lista siga abierta y antes de la hora de
--   cierre, y puede volver a apuntarse (libera el sitio).
-- - No hay contador público: a los socios sólo se les dice si está llena.
-- - El Admin (rol admin con segundo factor) lee la lista con apodo, email y si
--   esa cuenta entró por la puerta (`event_attendance`), borra inscripciones y
--   cambia los ajustes. La puerta (editor, como el lector) pregunta si un
--   Carnet está en la lista, con qué nombre y si ya pasó la hora de cierre:
--   la puerta decide, no se bloquea nada.
-- - Escribir, sólo con las RPC (envoltura en `public` que llama a la privada
--   SECURITY DEFINER, como `staff_stamp` en 20261008100300_door_stamps.sql).
-- Reejecutable.

-- ---------------------------------------------------------------------------
-- Ajustes de la lista de cada fiesta. Sin fila: la fiesta no va en lista.

create table if not exists public.event_guest_lists (
  event_id uuid primary key references public.events (id) on delete cascade,
  enabled boolean not null default false,
  cap integer not null default 100 check (cap between 1 and 100000),
  -- Hora de cierre de la lista; null: sólo la cierra el interruptor.
  closes_at timestamptz,
  open boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- Los ajustes no son secretos (el tope no es un contador): los lee cualquiera
-- en una fiesta publicada, y el equipo en todas. Nadie los escribe a mano.
alter table public.event_guest_lists enable row level security;
revoke all on public.event_guest_lists from anon, authenticated, service_role;
grant select on public.event_guest_lists to anon, authenticated;
grant select, insert, update, delete on public.event_guest_lists to service_role;
drop policy if exists event_guest_lists_read on public.event_guest_lists;
create policy event_guest_lists_read on public.event_guest_lists
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.published_at is not null and e.state <> 'draft'
        and e.archived_at is null
    )
    or (select private.has_staff_role('editor'))
  );

-- ---------------------------------------------------------------------------
-- Inscripciones: una por cuenta y fiesta.

create table if not exists public.guest_list_signups (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  list_name text not null
    check (char_length(list_name) between 2 and 30 and list_name = btrim(list_name)),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists guest_list_signups_user_idx on public.guest_list_signups (user_id);
create index if not exists guest_list_signups_order_idx
  on public.guest_list_signups (event_id, created_at);

-- Cada cual lee la suya; el equipo, todas. Nadie la escribe a mano.
alter table public.guest_list_signups enable row level security;
revoke all on public.guest_list_signups from anon, authenticated, service_role;
grant select on public.guest_list_signups to authenticated;
grant select, insert, update, delete on public.guest_list_signups to service_role;
drop policy if exists guest_list_signups_read on public.guest_list_signups;
create policy guest_list_signups_read on public.guest_list_signups
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_staff_role('editor')));

-- ---------------------------------------------------------------------------
-- Ayudas

-- La fiesta abierta al público (publicada, sin archivar, ni borrador ni cancelada).
create or replace function private.guest_list_party(p_event text) returns public.events
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  ev public.events;
begin
  select * into ev from public.events e
  where e.slug = p_event and e.published_at is not null and e.archived_at is null
    and e.state not in ('draft', 'cancelled');
  if not found then
    raise exception 'unknown_event' using detail = format('Fiesta desconocida: %s', p_event);
  end if;
  return ev;
end;
$$;

-- El estado de la lista de una fiesta, con la inscripción de `p_user` (o null).
-- `count` sólo para el equipo: quien llama a la pública no lo recibe.
create or replace function private.guest_list_state(
  p_event_id uuid, p_slug text, p_user uuid, p_with_count boolean
) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  gl public.event_guest_lists;
  n integer;
  mine public.guest_list_signups;
  past boolean;
  res jsonb;
begin
  select * into gl from public.event_guest_lists g where g.event_id = p_event_id;
  if not found then
    return jsonb_build_object('event', p_slug, 'enabled', false, 'cap', null, 'closes_at', null,
                              'open', false, 'past_closing', false, 'closed', true,
                              'full', false, 'mine', null);
  end if;
  select count(*) into n from public.guest_list_signups s where s.event_id = p_event_id;
  past := gl.closes_at is not null and now() >= gl.closes_at;
  if p_user is not null then
    select * into mine from public.guest_list_signups s
    where s.event_id = p_event_id and s.user_id = p_user;
  end if;
  res := jsonb_build_object(
    'event', p_slug, 'enabled', gl.enabled, 'cap', gl.cap, 'closes_at', gl.closes_at,
    'open', gl.open, 'past_closing', past,
    'closed', not gl.enabled or not gl.open or past,
    'full', n >= gl.cap,
    'mine', case when mine.user_id is null then null
                 else jsonb_build_object('list_name', mine.list_name,
                                         'created_at', mine.created_at) end
  );
  if p_with_count then
    res := res || jsonb_build_object('count', n);
  end if;
  return res;
end;
$$;

-- ---------------------------------------------------------------------------
-- Para todos: el estado de la lista (sin cuenta, `mine` es null).

create or replace function private.guest_list_status(p_event text) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  ev public.events := private.guest_list_party(p_event);
begin
  return private.guest_list_state(
    ev.id, ev.slug, case when private.is_member() then (select auth.uid()) end, false
  );
end;
$$;

create or replace function public.guest_list_status(p_event text) returns jsonb
language sql stable
set search_path = ''
as $$
  select private.guest_list_status(p_event)
$$;

-- ---------------------------------------------------------------------------
-- Apuntarse. Devuelve {created, list_name, created_at}: created=false si ya
-- estaba (su inscripción de antes, sin tocar).

create or replace function private.guest_list_join(p_event text, p_name text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_member();
  ev public.events := private.guest_list_party(p_event);
  gl public.event_guest_lists;
  nick text;
  lname text;
  prev public.guest_list_signups;
  n integer;
  created timestamptz;
begin
  select c.nickname into nick from public.carnets c where c.user_id = uid;
  if not found then
    raise exception 'carnet_required' using detail = 'Apuntarse en la lista pide el Carnet.';
  end if;
  -- Bloquea los ajustes de la fiesta: dos que se apuntan a la vez no pasan del tope.
  select * into gl from public.event_guest_lists g where g.event_id = ev.id for update;
  if not found or not gl.enabled then
    raise exception 'not_enabled' using detail = 'Esta fiesta no va en lista.';
  end if;
  select * into prev from public.guest_list_signups s
  where s.event_id = ev.id and s.user_id = uid;
  if found then
    return jsonb_build_object('created', false, 'event', ev.slug,
                              'list_name', prev.list_name, 'created_at', prev.created_at);
  end if;
  if not gl.open or (gl.closes_at is not null and now() >= gl.closes_at) then
    raise exception 'closed' using detail = 'La lista está cerrada.';
  end if;
  lname := btrim(coalesce(nullif(btrim(coalesce(p_name, '')), ''), nick));
  lname := regexp_replace(lname, '\s+', ' ', 'g');
  if char_length(lname) not between 2 and 30 then
    raise exception 'invalid_input' using detail = 'El nombre de la lista va de 2 a 30 caracteres.';
  end if;
  select count(*) into n from public.guest_list_signups s where s.event_id = ev.id;
  if n >= gl.cap then
    raise exception 'full' using detail = 'La lista está completa.';
  end if;
  insert into public.guest_list_signups (event_id, user_id, list_name)
  values (ev.id, uid, lname)
  returning created_at into created;
  return jsonb_build_object('created', true, 'event', ev.slug,
                            'list_name', lname, 'created_at', created);
end;
$$;

create or replace function public.guest_list_join(p_event text, p_name text default null)
returns jsonb
language sql
set search_path = ''
as $$
  select private.guest_list_join(p_event, p_name)
$$;

-- ---------------------------------------------------------------------------
-- Borrarse. Devuelve {removed}: false si no estaba.

create or replace function private.guest_list_leave(p_event text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_member();
  ev public.events := private.guest_list_party(p_event);
  gl public.event_guest_lists;
  gone integer;
begin
  select * into gl from public.event_guest_lists g where g.event_id = ev.id for update;
  if not found or not gl.enabled then
    raise exception 'not_enabled' using detail = 'Esta fiesta no va en lista.';
  end if;
  if not gl.open or (gl.closes_at is not null and now() >= gl.closes_at) then
    raise exception 'closed' using detail = 'La lista está cerrada.';
  end if;
  delete from public.guest_list_signups s where s.event_id = ev.id and s.user_id = uid;
  get diagnostics gone = row_count;
  return jsonb_build_object('removed', gone > 0, 'event', ev.slug);
end;
$$;

create or replace function public.guest_list_leave(p_event text) returns jsonb
language sql
set search_path = ''
as $$
  select private.guest_list_leave(p_event)
$$;

-- ---------------------------------------------------------------------------
-- Admin: la fiesta (cualquiera sin archivar, también un borrador).

create or replace function private.guest_list_admin_party(p_event text) returns public.events
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  ev public.events;
begin
  select * into ev from public.events e where e.slug = p_event and e.archived_at is null;
  if not found then
    raise exception 'unknown_event' using detail = format('Fiesta desconocida: %s', p_event);
  end if;
  return ev;
end;
$$;

-- Admin: el estado con el número de apuntados.
create or replace function private.admin_guest_list_status(p_event text) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  ev public.events;
begin
  perform private.require_staff('admin');
  ev := private.guest_list_admin_party(p_event);
  return private.guest_list_state(ev.id, ev.slug, null, true);
end;
$$;

create or replace function public.admin_guest_list_status(p_event text) returns jsonb
language sql stable
set search_path = ''
as $$
  select private.admin_guest_list_status(p_event)
$$;

-- Admin: la lista, con apodo, email y si entró por la puerta.
create or replace function private.admin_guest_list(p_event text) returns table (
  user_id uuid,
  list_name text,
  nickname text,
  email text,
  created_at timestamptz,
  attended boolean,
  attended_at timestamptz
)
language plpgsql stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  ev public.events;
begin
  perform private.require_staff('admin');
  ev := private.guest_list_admin_party(p_event);
  return query
  select s.user_id, s.list_name, c.nickname, u.email::text, s.created_at,
         a.user_id is not null, a.scanned_at
  from public.guest_list_signups s
  left join public.carnets c on c.user_id = s.user_id
  left join auth.users u on u.id = s.user_id
  left join public.event_attendance a on a.event_id = s.event_id and a.user_id = s.user_id
  where s.event_id = ev.id
  order by s.created_at, s.user_id;
end;
$$;

create or replace function public.admin_guest_list(p_event text) returns table (
  user_id uuid,
  list_name text,
  nickname text,
  email text,
  created_at timestamptz,
  attended boolean,
  attended_at timestamptz
)
language sql stable
set search_path = ''
as $$
  select * from private.admin_guest_list(p_event)
$$;

-- Admin: borrar la inscripción de alguien (aunque la lista esté cerrada).
create or replace function private.admin_guest_list_remove(
  p_event text, p_member uuid, p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  ev public.events := private.guest_list_admin_party(p_event);
  prev public.guest_list_signups;
begin
  delete from public.guest_list_signups s
  where s.event_id = ev.id and s.user_id = p_member
  returning * into prev;
  if not found then
    return jsonb_build_object('removed', false, 'event', ev.slug);
  end if;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (actor, 'authenticated', 'guest_list_remove', 'guest_list_signups', p_member::text,
          coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'lista de ' || ev.slug),
          jsonb_build_object('event', ev.slug, 'list_name', prev.list_name,
                             'created_at', prev.created_at), null);
  return jsonb_build_object('removed', true, 'event', ev.slug);
end;
$$;

create or replace function public.admin_guest_list_remove(
  p_event text, p_member uuid, p_reason text default null
) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_guest_list_remove(p_event, p_member, p_reason)
$$;

-- Admin: los ajustes de la lista (todos a la vez; closes_at null: sin hora).
create or replace function private.admin_guest_list_settings(
  p_event text, p_enabled boolean, p_cap integer, p_closes_at timestamptz, p_open boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  ev public.events := private.guest_list_admin_party(p_event);
  prev public.event_guest_lists;
  cur public.event_guest_lists;
begin
  if p_enabled is null or p_open is null or p_cap is null or p_cap not between 1 and 100000 then
    raise exception 'invalid_input' using detail = 'Ajustes de la lista: modo, tope (1 a 100000) y abierta.';
  end if;
  select * into prev from public.event_guest_lists g where g.event_id = ev.id;
  insert into public.event_guest_lists as g (event_id, enabled, cap, closes_at, open, updated_at, updated_by)
  values (ev.id, p_enabled, p_cap, p_closes_at, p_open, now(), actor)
  on conflict (event_id) do update
    set enabled = excluded.enabled, cap = excluded.cap, closes_at = excluded.closes_at,
        open = excluded.open, updated_at = now(), updated_by = actor
  returning * into cur;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (actor, 'authenticated', 'guest_list_settings', 'event_guest_lists', ev.id::text,
          'lista de ' || ev.slug,
          case when prev.event_id is null then null
               else jsonb_build_object('enabled', prev.enabled, 'cap', prev.cap,
                                       'closes_at', prev.closes_at, 'open', prev.open) end,
          jsonb_build_object('enabled', cur.enabled, 'cap', cur.cap,
                             'closes_at', cur.closes_at, 'open', cur.open));
  return private.guest_list_state(ev.id, ev.slug, null, true);
end;
$$;

create or replace function public.admin_guest_list_settings(
  p_event text, p_enabled boolean, p_cap integer, p_closes_at timestamptz, p_open boolean
) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_guest_list_settings(p_event, p_enabled, p_cap, p_closes_at, p_open)
$$;

-- ---------------------------------------------------------------------------
-- La puerta (editor, como el lector): ¿está en la lista? Nunca bloquea nada.
-- {enabled, on_list, list_name, created_at, closes_at, past_closing}

create or replace function private.guest_list_door(p_member uuid, p_event text) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  ev public.events;
  gl public.event_guest_lists;
  s public.guest_list_signups;
begin
  perform private.require_staff('editor');
  ev := private.guest_list_admin_party(p_event);
  select * into gl from public.event_guest_lists g where g.event_id = ev.id;
  select * into s from public.guest_list_signups x
  where x.event_id = ev.id and x.user_id = p_member;
  return jsonb_build_object(
    'event', ev.slug,
    'enabled', coalesce(gl.enabled, false),
    'on_list', s.user_id is not null,
    'list_name', s.list_name,
    'created_at', s.created_at,
    'closes_at', gl.closes_at,
    'past_closing', gl.closes_at is not null and now() >= gl.closes_at
  );
end;
$$;

create or replace function public.guest_list_door(p_member uuid, p_event text) returns jsonb
language sql stable
set search_path = ''
as $$
  select private.guest_list_door(p_member, p_event)
$$;

-- ---------------------------------------------------------------------------
-- Permisos: envoltura SECURITY INVOKER en public que llama a la privada (que
-- comprueba la cuenta o el rol). El estado lo pide cualquiera; lo demás, con
-- cuenta.

revoke all on function private.guest_list_party(text) from public;
revoke all on function private.guest_list_admin_party(text) from public;
revoke all on function private.guest_list_state(uuid, text, uuid, boolean) from public;
grant execute on function private.guest_list_party(text) to anon, authenticated;
grant execute on function private.guest_list_admin_party(text) to authenticated;
grant execute on function private.guest_list_state(uuid, text, uuid, boolean) to anon, authenticated;

revoke all on function private.guest_list_status(text) from public;
grant execute on function private.guest_list_status(text) to anon, authenticated;
revoke all on function public.guest_list_status(text) from public;
grant execute on function public.guest_list_status(text) to anon, authenticated;

revoke all on function private.guest_list_join(text, text) from public;
grant execute on function private.guest_list_join(text, text) to authenticated;
revoke all on function public.guest_list_join(text, text) from public, anon;
grant execute on function public.guest_list_join(text, text) to authenticated;

revoke all on function private.guest_list_leave(text) from public;
grant execute on function private.guest_list_leave(text) to authenticated;
revoke all on function public.guest_list_leave(text) from public, anon;
grant execute on function public.guest_list_leave(text) to authenticated;

revoke all on function private.admin_guest_list_status(text) from public;
grant execute on function private.admin_guest_list_status(text) to authenticated;
revoke all on function public.admin_guest_list_status(text) from public, anon;
grant execute on function public.admin_guest_list_status(text) to authenticated;

revoke all on function private.admin_guest_list(text) from public;
grant execute on function private.admin_guest_list(text) to authenticated;
revoke all on function public.admin_guest_list(text) from public, anon;
grant execute on function public.admin_guest_list(text) to authenticated;

revoke all on function private.admin_guest_list_remove(text, uuid, text) from public;
grant execute on function private.admin_guest_list_remove(text, uuid, text) to authenticated;
revoke all on function public.admin_guest_list_remove(text, uuid, text) from public, anon;
grant execute on function public.admin_guest_list_remove(text, uuid, text) to authenticated;

revoke all on function private.admin_guest_list_settings(text, boolean, integer, timestamptz, boolean) from public;
grant execute on function private.admin_guest_list_settings(text, boolean, integer, timestamptz, boolean) to authenticated;
revoke all on function public.admin_guest_list_settings(text, boolean, integer, timestamptz, boolean) from public, anon;
grant execute on function public.admin_guest_list_settings(text, boolean, integer, timestamptz, boolean) to authenticated;

revoke all on function private.guest_list_door(uuid, text) from public;
grant execute on function private.guest_list_door(uuid, text) to authenticated;
revoke all on function public.guest_list_door(uuid, text) from public, anon;
grant execute on function public.guest_list_door(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Halloween va en lista (Álvaro 2026-10-21): tope 100, cierre a las 22:30 del
-- 31 de octubre en Alicante, abierta. Si la fila de la fiesta ya existe (en
-- producción); en una base nueva lo pone la semilla 20261021200100.

insert into public.event_guest_lists (event_id, enabled, cap, closes_at, open)
select e.id, true, 100, timestamp '2026-10-31 22:30' at time zone 'Europe/Madrid', true
from public.events e
where e.slug = 'halloween-2026'
on conflict (event_id) do nothing;
