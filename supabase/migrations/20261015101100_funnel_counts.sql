-- Contadores propios del embudo (plan 032 T301, REQ-ARQ-019 sin terceros).
-- Aplicada sólo a boia-planet-dev; producción la recibe con las demás del
-- plan (docs/propuestas/2026-10-03-produccion-supabase.md).
--
-- - Una fila por día y paso: (día, evento, cuántas). Sin cookies, sin datos
--   personales y sin ningún identificador de visitante: sólo la suma.
-- - El día es el de Alicante (Europe/Madrid), el mismo que pinta el Admin.
-- - La web suma con `funnel_hit(p_event)`, que puede llamar cualquiera (anon)
--   pero sólo acepta los cinco pasos del navegador (nada de texto libre):
--   landing_view → explore_start → discount_found → tickets_panel_open →
--   ticket_click_out. `purchase_confirmed` cabe en la tabla para el webhook de
--   la ticketera (REQ-COM-017, sin construir), pero no entra por aquí.
-- - Con la analítica apagada en el Admin (`site_settings.analytics_enabled`)
--   no suma nada, aunque alguien llame a mano.
-- - Que alguien infle los números llamando muchas veces se acepta (no hay
--   nada que proteger salvo la propia cuenta); la tabla no crece por ello:
--   como mucho seis filas al día.
-- - Leer: sólo un admin, con `admin_funnel_counts(p_days)`.
-- Reejecutable.

create table if not exists private.funnel_counts (
  day date not null,
  event text not null check (event in (
    'landing_view', 'explore_start', 'discount_found',
    'tickets_panel_open', 'ticket_click_out', 'purchase_confirmed'
  )),
  count bigint not null default 0 check (count >= 0),
  primary key (day, event)
);
revoke all on private.funnel_counts from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Sumar un paso (cualquiera, sin cuenta)

create or replace function private.funnel_hit(p_event text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev text := coalesce(p_event, '');
begin
  if ev not in (
    'landing_view', 'explore_start', 'discount_found', 'tickets_panel_open', 'ticket_click_out'
  ) then
    raise exception 'unknown_event' using detail = 'Ese paso del embudo no existe.';
  end if;
  if not coalesce((select s.analytics_enabled from public.site_settings s where s.id), false) then
    return false;
  end if;
  insert into private.funnel_counts as f (day, event, count)
  values ((now() at time zone 'Europe/Madrid')::date, ev, 1)
  on conflict (day, event) do update set count = f.count + 1;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- El Admin lee los últimos días (1 a 90, hoy incluido)

create or replace function private.admin_funnel_counts(p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  days integer := least(greatest(coalesce(p_days, 30), 1), 90);
  today date := (now() at time zone 'Europe/Madrid')::date;
begin
  perform private.require_staff('admin');
  return jsonb_build_object(
    'today', today,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object('day', f.day, 'event', f.event, 'count', f.count)
        order by f.day, f.event)
      from private.funnel_counts f
      where f.day > today - days and f.day <= today
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.funnel_hit(p_event text)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.funnel_hit(p_event)
$$;

create or replace function public.admin_funnel_counts(p_days integer default 30)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_funnel_counts(p_days)
$$;

-- ---------------------------------------------------------------------------
-- Permisos: sumar, cualquiera (anon incluido); leer, sólo authenticated (el
-- rol de admin con segundo factor lo comprueba la privada).

revoke all on function private.funnel_hit(text) from public, anon, authenticated;
revoke all on function private.admin_funnel_counts(integer) from public, anon, authenticated;
grant execute on function private.funnel_hit(text) to anon, authenticated;
grant execute on function private.admin_funnel_counts(integer) to authenticated;

revoke all on function public.funnel_hit(text) from public, anon, authenticated;
revoke all on function public.admin_funnel_counts(integer) from public, anon, authenticated;
grant execute on function public.funnel_hit(text) to anon, authenticated;
grant execute on function public.admin_funnel_counts(integer) to authenticated;
