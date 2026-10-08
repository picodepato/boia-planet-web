-- Límite del acceso completo al Admin e interruptor de la analítica (plan
-- 019 T223, reunión del 2026-10-08, decisión 17). Escrita y probada en
-- local como texto, NO aplicada a ningún proyecto (la aplica Hernán).
-- Convenciones: las de 20261003100000_accounts.sql.
--
-- 1. Como mucho 3 personas con acceso completo (rol admin u owner; el
--    propietario, el del Carnet 000, es una de ellas). Los editores no
--    cuentan. Lo impide la base de datos: ni el editor SQL ni service_role
--    pueden dar un cuarto acceso completo. Las filas que ya hubiera no se
--    tocan: si al aplicar ya hay más de 3, nadie más entra hasta que se
--    quiten.
-- 2. La analítica de visitas (PostHog, D-04) se enciende y se apaga desde el
--    Admin: `site_settings.analytics_enabled`, que la web lee sin sesión
--    (como el resto de `site_settings`). Apagada por defecto.

-- ---------------------------------------------------------------------------
-- 1. Acceso completo: como mucho 3

create function private.full_access_limit() returns integer
language sql
immutable
set search_path = ''
as $$
  select 3
$$;

create function private.guard_full_access_limit() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  others integer;
begin
  if new.role not in ('admin', 'owner') then
    return new;
  end if;
  -- Pasar de admin a owner (o al revés) no suma a nadie.
  if tg_op = 'UPDATE' and old.role in ('admin', 'owner') and old.user_id = new.user_id then
    return new;
  end if;
  -- Dos altas a la vez no se cuelan: la segunda cuenta tras la primera.
  perform pg_advisory_xact_lock(hashtext('boia.staff_roles.full_access'));
  select count(*) into others
  from public.staff_roles s
  where s.role in ('admin', 'owner')
    and s.user_id <> new.user_id;
  if others >= private.full_access_limit() then
    raise exception 'full_access_limit' using errcode = 'P0001',
      detail = format(
        'Como mucho %s personas con acceso completo al Admin (admin u owner). Quita a una antes de dar el acceso a otra.',
        private.full_access_limit()
      );
  end if;
  return new;
end;
$$;

create trigger staff_roles_full_access_limit
  before insert or update of role, user_id on public.staff_roles
  for each row execute function private.guard_full_access_limit();

-- Cuántas personas tienen acceso completo y el límite, para que el Admin lo
-- explique. Sólo el equipo con segundo factor.
create function private.admin_full_access() returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_staff('editor');
  return jsonb_build_object(
    'count', (select count(*) from public.staff_roles s where s.role in ('admin', 'owner')),
    'limit', private.full_access_limit()
  );
end;
$$;

create function public.admin_full_access() returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_full_access()
$$;

-- ---------------------------------------------------------------------------
-- 2. Analítica de visitas

alter table public.site_settings
  add column analytics_enabled boolean not null default false;

-- Enciende o apaga la analítica. Admin con segundo factor y motivo en la
-- auditoría (site_settings_audit).
create function private.admin_set_analytics(p_enabled boolean, p_reason text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
begin
  if p_enabled is null then
    raise exception 'invalid_input' using detail = 'Falta si la analítica va encendida o apagada.';
  end if;
  perform set_config(
    'boia.audit_reason',
    coalesce(nullif(btrim(p_reason), ''), 'analítica de visitas'),
    true
  );
  update public.site_settings set analytics_enabled = p_enabled where id;
  return jsonb_build_object('analytics_enabled', p_enabled, 'by', actor);
end;
$$;

create function public.admin_set_analytics(
  p_enabled boolean,
  p_reason text default null
) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_set_analytics(p_enabled, p_reason)
$$;

-- ---------------------------------------------------------------------------
-- Permisos

revoke all on function private.full_access_limit() from public;
revoke all on function private.guard_full_access_limit() from public;
revoke all on function private.admin_full_access() from public;
revoke all on function private.admin_set_analytics(boolean, text) from public;
grant execute on function private.admin_full_access() to authenticated;
grant execute on function private.admin_set_analytics(boolean, text) to authenticated;

revoke all on function public.admin_full_access() from public, anon;
revoke all on function public.admin_set_analytics(boolean, text) from public, anon;
grant execute on function public.admin_full_access() to authenticated;
grant execute on function public.admin_set_analytics(boolean, text) to authenticated;
