-- «Tickets todavía no disponibles» (plan 030 T292, Álvaro 2026-10-14): un
-- evento a la venta cuyas entradas aún no se venden. «Comprar entradas» se
-- queda en su sitio y dice eso, sin checkout ni ticketera. El equipo lo quita
-- (Admin) para abrir la venta. Es el campo `ticketsNotYet` de @boia/contracts.
-- Convenciones: las de 20261003100000_accounts.sql.

alter table public.events
  add column tickets_not_yet boolean not null default false;

-- Lo edita el equipo, como el resto del evento (políticas events_*_staff); lo
-- lee cualquiera, como el resto de la ficha (grant select de la tabla).
grant insert (tickets_not_yet) on public.events to authenticated;
grant update (tickets_not_yet) on public.events to authenticated;
