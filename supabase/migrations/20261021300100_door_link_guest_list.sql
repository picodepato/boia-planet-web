-- La lista de la fiesta en el enlace de la puerta (plan 034 T310). Aplicada
-- sólo a boia-planet-dev; producción la recibe con las demás del plan.
--
-- El lector del enlace (`/puerta/<código>`, 20261021100100_door_links.sql)
-- no tiene cuenta, así que no puede usar `guest_list_door` (pide editor).
-- Esta RPC toma el código del enlace y el Carnet escaneado y dice sólo lo que
-- la puerta necesita: si la fiesta va en lista, si ese Carnet está, con qué
-- nombre de lista, la hora de cierre y si ya pasó. Nada de email, apodo ni
-- fecha de inscripción. Nunca bloquea nada: la puerta decide.
-- El código es la llave: uno revocado, equivocado o de una fiesta que ya no
-- está abierta da `door_link_invalid`. Reejecutable.

create or replace function private.door_link_guest_list(p_token text, p_member uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ev_id uuid;
  gl public.event_guest_lists;
  name text;
begin
  select l.event_id into ev_id from private.live_door_link(p_token) l;
  if ev_id is null then
    raise exception 'door_link_invalid'
      using detail = 'Este enlace de la puerta ya no vale: pide uno nuevo al equipo.';
  end if;
  select * into gl from public.event_guest_lists g where g.event_id = ev_id;
  select s.list_name into name from public.guest_list_signups s
  where s.event_id = ev_id and s.user_id = p_member;
  return jsonb_build_object(
    'enabled', coalesce(gl.enabled, false),
    'on_list', name is not null,
    'list_name', name,
    'closes_at', gl.closes_at,
    'past_closing', gl.closes_at is not null and now() >= gl.closes_at
  );
end;
$$;

create or replace function public.door_link_guest_list(p_token text, p_member uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.door_link_guest_list(p_token, p_member)
$$;

revoke all on function private.door_link_guest_list(text, uuid) from public, anon, authenticated;
grant execute on function private.door_link_guest_list(text, uuid) to anon, authenticated;
revoke all on function public.door_link_guest_list(text, uuid) from public, anon, authenticated;
grant execute on function public.door_link_guest_list(text, uuid) to anon, authenticated;
