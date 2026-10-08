-- Ficha del evento y código común de la ticketera (plan 019 T215, reunión
-- del 2026-10-08, decisiones 1, 5, 6 y 7). Convenciones: las de
-- 20261003100000_accounts.sql.
--
-- - events: si el lugar está anunciado, si el evento es «Solo en puerta» y
--   su precio en la puerta con Carnet, y el precio de la entrada. La
--   ticketera que se enseña en la ficha es `ticket_provider`, que ya existía.
-- - ticketing_settings: el código común de la ticketera. Fijado, todos los
--   descuentos de entradas enseñan ese código; vacío, cada uno el suyo. Sólo
--   lo ve el equipo; quien encontró un descuento lo recibe con
--   `discount_code_for` (nunca el catálogo entero, REQ-COM-021).

-- ---------------------------------------------------------------------------
-- Campos de la ficha del evento.

alter table public.events
  add column place_announced boolean not null default true,
  add column price_cents integer check (price_cents is null or price_cents >= 0),
  add column door_only boolean not null default false,
  add column door_price_cents integer check (door_price_cents is null or door_price_cents >= 0),
  add constraint events_door_price_check check (door_only or door_price_cents is null),
  add constraint events_ticket_provider_check
    check (ticket_provider is null or char_length(btrim(ticket_provider)) between 1 and 60);

-- Los edita el equipo, como el resto del evento (políticas events_*_staff).
grant insert (place_announced, price_cents, door_only, door_price_cents)
  on public.events to authenticated;
grant update (place_announced, price_cents, door_only, door_price_cents)
  on public.events to authenticated;

-- ---------------------------------------------------------------------------
-- Código común de la ticketera: una sola fila, sólo el equipo la lee.

create table public.ticketing_settings (
  id boolean primary key default true check (id),
  common_discount_code text
    check (common_discount_code is null
           or char_length(btrim(common_discount_code)) between 1 and 40),
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
insert into public.ticketing_settings (id) values (true);

create trigger ticketing_settings_touch before update on public.ticketing_settings
  for each row execute function private.touch_version();
create trigger ticketing_settings_audit after update on public.ticketing_settings
  for each row execute function private.audit_row('id');

alter table public.ticketing_settings enable row level security;
revoke all on public.ticketing_settings from anon, authenticated, service_role;
grant select on public.ticketing_settings to authenticated;
grant select, update on public.ticketing_settings to service_role;

create policy ticketing_settings_read_staff on public.ticketing_settings
  for select to authenticated
  using ((select private.has_staff_role('editor')));

-- Fija (o, vacío, quita) el código común. Admin con segundo factor y motivo
-- en la auditoría.
create function private.admin_set_common_discount_code(p_code text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  code text := nullif(upper(btrim(coalesce(p_code, ''))), '');
begin
  if code is not null and char_length(code) > 40 then
    raise exception 'invalid_code' using detail = 'El código común tiene como mucho 40 caracteres.';
  end if;
  perform set_config(
    'boia.audit_reason',
    coalesce(nullif(btrim(p_reason), ''), 'código común de la ticketera'),
    true
  );
  update public.ticketing_settings set common_discount_code = code where id;
  return jsonb_build_object('common_discount_code', code, 'by', actor);
end;
$$;

create function public.admin_set_common_discount_code(
  p_code text default null,
  p_reason text default null
) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_set_common_discount_code(p_code, p_reason)
$$;

revoke all on function private.admin_set_common_discount_code(text, text) from public;
grant execute on function private.admin_set_common_discount_code(text, text) to authenticated;
revoke all on function public.admin_set_common_discount_code(text, text) from public, anon;
grant execute on function public.admin_set_common_discount_code(text, text) to authenticated;

-- El código común para un descuento de entradas que quien llama ya encontró;
-- null si no lo encontró, si es de la tienda o si no hay código común (la
-- web enseña entonces el suyo).
create function public.discount_code_for(p_discount text) returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.common_discount_code
  from public.ticketing_settings s
  join public.discounts d on d.id = p_discount and d.scope = 'event'
  join public.user_discounts u on u.discount_id = d.id and u.user_id = (select auth.uid())
  where s.id
$$;

revoke all on function public.discount_code_for(text) from public, anon;
grant execute on function public.discount_code_for(text) to authenticated;
