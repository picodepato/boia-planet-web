-- Números de Carnet seguidos desde el 10 (plan 029 T282, Álvaro 2026-10-14).
-- Detrás de 20261014100110_carnet_answers_active_only.sql. Aplicada sólo a
-- boia-planet-dev; producción la recibe con las demás al encender las
-- cuentas (docs/propuestas/2026-10-03-produccion-supabase.md).
--
-- El 0 es del Admin (Carnet 000, 20261007100400_admin_access_export.sql) y
-- del 1 al 9 quedan reservados: ningún alta los toma. El Admin sí puede dar
-- uno a mano (`admin_set_member_number`: entero ≥ 1 y libre, auditado; sin
-- cambios aquí).
--
-- 1. `private.next_member_number()` no baja nunca del 10: el siguiente es el
--    primero libre por encima de max(contador, 9). Sigue en la misma
--    sentencia del alta, con el cerrojo de la fila del contador (dos altas a
--    la vez salen en orden) y saltando los números ocupados.
-- 2. El contador se pone una vez: sigue tras el mayor número ya dado en el
--    tramo 10–999; si no hay ninguno, o el mayor es de 1000 en adelante
--    (restos de pruebas o números puestos a mano), vuelve a 9 y el siguiente
--    alta toma el primer libre desde el 10. Nadie cambia de número.

-- ---------------------------------------------------------------------------
-- 1. Nunca por debajo del 10

create or replace function private.next_member_number() returns bigint
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  n bigint;
begin
  update private.member_counter set last_number = greatest(last_number, 9) + 1 where id
  returning last_number into n;
  if n is null then
    raise exception 'member_counter_missing';
  end if;
  while exists (select 1 from public.carnets c where c.member_number = n) loop
    update private.member_counter set last_number = last_number + 1 where id
    returning last_number into n;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. El contador, una vez

update private.member_counter
set last_number = coalesce(
  (select case when max(c.member_number) < 1000 then max(c.member_number) else 9 end
   from public.carnets c
   where c.member_number >= 10),
  9)
where id;
