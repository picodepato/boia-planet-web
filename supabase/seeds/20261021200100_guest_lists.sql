-- Muestra (plan 034 T308, Álvaro 2026-10-21): Halloween va en lista, tope
-- 100, la lista cierra a las 22:30 del 31 de octubre (Europe/Madrid) y está
-- abierta, como en el contenido de la web (packages/store/src/sample/content.ts,
-- `guestList`). Sólo la fila de muestra; no pisa lo que haya cambiado el Admin.
-- Reejecutable.
insert into public.event_guest_lists (event_id, enabled, cap, closes_at, open)
select e.id, true, 100, timestamp '2026-10-31 22:30' at time zone 'Europe/Madrid', true
from public.events e
where e.slug = 'halloween-2026'
  and e.is_sample
on conflict (event_id) do nothing;
