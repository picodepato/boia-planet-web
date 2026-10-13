-- Seguridad de las funciones SECURITY DEFINER antes de encender las cuentas
-- (plan 029 T278). Detrás de 20261013100100_gallery_clips_longer.sql.
-- Aplicada sólo a boia-planet-dev; producción la recibe con las demás al
-- encender las cuentas (docs/propuestas/2026-10-03-produccion-supabase.md).
--
-- 1. `admin_sign_in_email` desaparece. La podía llamar cualquiera sin cuenta
--    (anon) y devolvía el email de la cuenta del Carnet 000 (la del Admin):
--    bastaba escribir «000». El Admin entra ahora escribiendo él mismo el
--    email de esa cuenta y su contraseña (después, el TOTP);
--    apps/web/lib/account/admin-auth.ts `signInWithAdminPassword`.
-- 2. Las tres que quedaban con SECURITY DEFINER en `public`
--    (`discount_code_for`, `radio_set_first`, `radio_reorder`) pasan a la
--    convención de 20261003100000_accounts.sql: la lógica en `private` con
--    SECURITY DEFINER y search_path = '', y en `public` una envoltura
--    SECURITY INVOKER del mismo nombre y la misma firma (el cliente no
--    cambia). Ninguna recibe la cuenta como parámetro: la sacan de la sesión
--    (`auth.uid()`, `private.require_staff`), así que ni llamándolas
--    directamente se puede pedir lo de otra persona.
--    - `discount_code_for`: sólo para quien tiene sesión (authenticated); el
--      código común sólo a quien encontró ese descuento de entradas.
--    - `radio_set_first` y `radio_reorder`: sólo admin u owner con segundo
--      factor (`private.require_staff('admin')`, el mismo rechazo `forbidden`
--      42501 que antes).
-- 3. Repaso de todas las funciones de `public` y `private` (catálogo de
--    boia-planet-dev, 2026-10-13): todas las SECURITY DEFINER tienen
--    search_path = ''; ninguna da EXECUTE a PUBLIC; anon sólo ejecuta las
--    de lectura (rankings, botellas, calitas) y las ayudas que usan las
--    políticas de RLS. Nada más que cambiar aquí; lo vigila
--    packages/db/src/supabase/schema.supabase.ts.

-- ---------------------------------------------------------------------------
-- 1. Fuera el email del Carnet 000

drop function public.admin_sign_in_email(bigint);

-- ---------------------------------------------------------------------------
-- 2a. El código común de la ticketera

-- El código común para un descuento de entradas que la cuenta de la sesión
-- ya encontró; null si no lo encontró, si es de la tienda, si no hay código
-- común o si no hay sesión.
create function private.discount_code_for(p_discount text) returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.common_discount_code
  from public.ticketing_settings s
  join public.discounts d on d.id = p_discount and d.scope = 'event'
  join public.user_discounts u on u.discount_id = d.id and u.user_id = (select auth.uid())
  where s.id and (select auth.uid()) is not null
$$;

create or replace function public.discount_code_for(p_discount text) returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select private.discount_code_for(p_discount)
$$;

-- ---------------------------------------------------------------------------
-- 2b. La radio: marcar la primera y reordenar

create function private.radio_set_first(p_song text) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_staff('admin');
  if not exists (select 1 from public.radio_songs s where s.id = p_song) then
    raise exception 'unknown_song' using detail = 'Esa canción no está en la radio.';
  end if;
  update public.radio_songs set is_first = false where is_first and id <> p_song;
  update public.radio_songs set is_first = true where id = p_song;
end;
$$;

-- `p_ids`: todas las canciones, en su orden nuevo (ni una más ni una menos).
create function private.radio_reorder(p_ids text[]) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_staff('admin');
  if coalesce(cardinality(p_ids), 0) <> (select count(*) from public.radio_songs)
     or (select count(distinct x) from unnest(p_ids) x) <> cardinality(p_ids)
     or exists (
       select 1 from unnest(p_ids) x
       where not exists (select 1 from public.radio_songs s where s.id = x)
     ) then
    raise exception 'invalid_order' using detail = 'La lista nueva no es la de la radio.';
  end if;
  update public.radio_songs s
  set position = o.n - 1
  from unnest(p_ids) with ordinality as o (id, n)
  where s.id = o.id;
end;
$$;

create or replace function public.radio_set_first(p_song text) returns void
language sql
security invoker
set search_path = ''
as $$
  select private.radio_set_first(p_song)
$$;

create or replace function public.radio_reorder(p_ids text[]) returns void
language sql
security invoker
set search_path = ''
as $$
  select private.radio_reorder(p_ids)
$$;

-- ---------------------------------------------------------------------------
-- Permisos: nada para PUBLIC ni anon; authenticated, porque las envolturas
-- son INVOKER (las privadas comprueban la sesión y el rol por dentro).

revoke all on function private.discount_code_for(text) from public, anon;
revoke all on function private.radio_set_first(text) from public, anon;
revoke all on function private.radio_reorder(text[]) from public, anon;
grant execute on function private.discount_code_for(text) to authenticated;
grant execute on function private.radio_set_first(text) to authenticated;
grant execute on function private.radio_reorder(text[]) to authenticated;

revoke all on function public.discount_code_for(text) from public, anon;
revoke all on function public.radio_set_first(text) from public, anon;
revoke all on function public.radio_reorder(text[]) from public, anon;
grant execute on function public.discount_code_for(text) to authenticated;
grant execute on function public.radio_set_first(text) to authenticated;
grant execute on function public.radio_reorder(text[]) to authenticated;
