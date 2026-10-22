-- «Entraron» (plan 037 T317): todas las personas cuyo Carnet se leyó en la
-- puerta de una fiesta (lector del equipo, enlace de la puerta o sello a
-- mano), estén o no en la lista. Sólo lectura, rol admin con segundo factor.
-- Cada cuenta sale una vez (`event_attendance` tiene una fila por fiesta y
-- cuenta: la del primer escaneo). `source`: door (lector), link (enlace de la
-- puerta, `door_link_id`) o manual. `list_name`: el nombre con el que se
-- apuntó a la lista de esa fiesta, o null si no estaba.

create or replace function private.admin_event_attendees(p_event text) returns table (
  user_id uuid,
  nickname text,
  email text,
  scanned_at timestamptz,
  source text,
  list_name text
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
  select a.user_id, c.nickname, u.email::text, a.scanned_at,
         case when a.door_link_id is not null then 'link' else a.source end,
         s.list_name
  from public.event_attendance a
  left join public.carnets c on c.user_id = a.user_id
  left join auth.users u on u.id = a.user_id
  left join public.guest_list_signups s on s.event_id = a.event_id and s.user_id = a.user_id
  where a.event_id = ev.id
  order by a.scanned_at desc, a.user_id;
end;
$$;

create or replace function public.admin_event_attendees(p_event text) returns table (
  user_id uuid,
  nickname text,
  email text,
  scanned_at timestamptz,
  source text,
  list_name text
)
language sql stable
set search_path = ''
as $$
  select * from private.admin_event_attendees(p_event)
$$;

revoke all on function private.admin_event_attendees(text) from public;
grant execute on function private.admin_event_attendees(text) to authenticated;
revoke all on function public.admin_event_attendees(text) from public, anon;
grant execute on function public.admin_event_attendees(text) to authenticated;
