-- El Admin sobre datos reales (plan 008, T94, decisión 11): la imagen del
-- sello de cada fiesta (subida a Storage o traída de una URL, siempre una
-- copia propia), la retirada de botellas con su reporte, anular un tiempo de
-- carrera o una entrada de puntos con motivo, el rol de quien entra (para la
-- pantalla de acceso) y el cierre de la posición de las botellas: sólo
-- place_bottle la fija (T93 vio que la RLS dejaba al autor mover x/y a mano).
-- Convenciones: las de 20261003100000_accounts.sql. Todo lo del Admin pide
-- rol con segundo factor (aal2) y deja su fila en audit_log con el motivo.

-- ---------------------------------------------------------------------------
-- Rol de quien llama (la pantalla de entrada del Admin y la ruta que trae
-- imágenes por URL). Con aal1 devuelve null: sin TOTP no hay rol.

create function public.my_staff_role() returns text
language sql stable
set search_path = ''
as $$
  select private.staff_role()::text
$$;

revoke all on function public.my_staff_role() from public, anon;
grant execute on function public.my_staff_role() to authenticated;

-- ---------------------------------------------------------------------------
-- La imagen del sello de una fiesta (T87 «Image stamps»). Sólo una copia en
-- el bucket `stamp-images` de este proyecto: el Carnet nunca enlaza una URL
-- de fuera. La escribe sólo admin_set_stamp_image.

alter table public.events
  add column stamp_image_url text
    check (stamp_image_url is null
           or stamp_image_url ~ '^https://[^/\s]+/storage/v1/object/public/stamp-images/[A-Za-z0-9._/-]+$');

create function private.admin_set_stamp_image(p_event text, p_url text, p_reason text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  ev public.events;
  url text := nullif(btrim(coalesce(p_url, '')), '');
begin
  select * into ev from public.events where slug = p_event;
  if not found then
    raise exception 'unknown_event' using detail = format('Fiesta desconocida: %s', p_event);
  end if;
  if url is not null
     and url !~ '^https://[^/\s]+/storage/v1/object/public/stamp-images/[A-Za-z0-9._/-]+$' then
    raise exception 'invalid_image' using
      detail = 'La imagen del sello tiene que ser una copia del bucket stamp-images.';
  end if;
  perform set_config('boia.audit_reason', coalesce(nullif(btrim(p_reason), ''), 'imagen del sello'), true);
  update public.events set stamp_image_url = url where id = ev.id;
  return jsonb_build_object('event', ev.slug, 'stamp_image_url', url, 'by', actor);
end;
$$;

create function public.admin_set_stamp_image(p_event text, p_url text default null, p_reason text default null)
returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_set_stamp_image(p_event, p_url, p_reason)
$$;

revoke all on function private.admin_set_stamp_image(text, text, text) from public;
grant execute on function private.admin_set_stamp_image(text, text, text) to authenticated;
revoke all on function public.admin_set_stamp_image(text, text, text) from public, anon;
grant execute on function public.admin_set_stamp_image(text, text, text) to authenticated;

-- Storage: lectura pública (el Carnet la pinta sin sesión), escritura sólo
-- del equipo con aal2. Las copias son WebP (o PNG si el navegador no sabe
-- codificar WebP) de 512 × 512. Sin el esquema storage (el PostgreSQL local
-- de `pnpm db:test`) esta parte no se aplica.
do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('stamp-images', 'stamp-images', true, 2097152, array['image/webp', 'image/png'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute $p$create policy stamp_images_staff_read on storage.objects
    for select to authenticated
    using (bucket_id = 'stamp-images' and (select private.has_staff_role('admin')))$p$;
  execute $p$create policy stamp_images_staff_insert on storage.objects
    for insert to authenticated
    with check (bucket_id = 'stamp-images' and (select private.has_staff_role('admin')))$p$;
  execute $p$create policy stamp_images_staff_update on storage.objects
    for update to authenticated
    using (bucket_id = 'stamp-images' and (select private.has_staff_role('admin')))
    with check (bucket_id = 'stamp-images' and (select private.has_staff_role('admin')))$p$;
  execute $p$create policy stamp_images_staff_delete on storage.objects
    for delete to authenticated
    using (bucket_id = 'stamp-images' and (select private.has_staff_role('admin')))$p$;
end
$$;

-- ---------------------------------------------------------------------------
-- Botellas: sólo place_bottle fija la posición (con su comprobación). El
-- autor sigue pudiendo cambiar el mensaje (pasa el filtro) y retirarla.

revoke insert (user_id, message, x, y) on public.bottles from authenticated;
revoke update (x, y) on public.bottles from authenticated;
drop policy bottles_insert_own on public.bottles;

-- Retirar una botella por moderación: estado `removed`, sus reportes
-- abiertos resueltos y una fila de auditoría con el motivo.
create function private.admin_remove_bottle(p_bottle uuid, p_reason text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  why text := btrim(coalesce(p_reason, ''));
  b public.bottles;
  n integer;
begin
  if char_length(why) < 3 then
    raise exception 'reason_required' using detail = 'Retirar una botella pide un motivo.';
  end if;
  select * into b from public.bottles where id = p_bottle for update;
  if not found then
    raise exception 'unknown_bottle' using detail = 'Esa botella no existe.';
  end if;
  perform set_config('boia.audit_reason', why, true);
  if b.status <> 'removed' then
    update public.bottles set status = 'removed' where id = b.id;
  end if;
  update public.bottle_reports
  set resolved_at = now(), resolved_by = actor, resolution = 'retirada: ' || why
  where bottle_id = b.id and resolved_at is null;
  get diagnostics n = row_count;
  return jsonb_build_object('bottle', b.id, 'status', 'removed', 'resolved_reports', n);
end;
$$;

-- Descartar un reporte (la botella sigue en el mar).
create function private.admin_dismiss_bottle_report(p_report uuid, p_reason text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  why text := nullif(btrim(coalesce(p_reason, '')), '');
  r public.bottle_reports;
begin
  select * into r from public.bottle_reports where id = p_report for update;
  if not found then
    raise exception 'unknown_report' using detail = 'Ese reporte no existe.';
  end if;
  if r.resolved_at is null then
    update public.bottle_reports
    set resolved_at = now(), resolved_by = actor, resolution = 'descartado' || coalesce(': ' || why, '')
    where id = r.id;
    insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value)
    values (actor, 'authenticated', 'dismiss_report', 'bottle_reports', r.id::text, why,
            jsonb_build_object('bottle_id', r.bottle_id, 'reason', r.reason));
  end if;
  return jsonb_build_object('report', r.id, 'resolved', true);
end;
$$;

create function public.admin_remove_bottle(p_bottle uuid, p_reason text) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_remove_bottle(p_bottle, p_reason)
$$;

create function public.admin_dismiss_bottle_report(p_report uuid, p_reason text default null)
returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_dismiss_bottle_report(p_report, p_reason)
$$;

-- ---------------------------------------------------------------------------
-- Rankings: anular un tiempo (sale del ranking hasta su próximo tiempo) o
-- una entrada de puntos (una compensación del libro que la deshace).

create function private.admin_void_race_time(
  p_user uuid, p_circuit text, p_version integer, p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  why text := btrim(coalesce(p_reason, ''));
  t public.race_times;
begin
  if char_length(why) < 3 then
    raise exception 'reason_required' using detail = 'Anular un tiempo pide un motivo.';
  end if;
  select * into t from public.race_times
  where user_id = p_user and circuit_id = p_circuit and circuit_version = p_version
  for update;
  if not found then
    raise exception 'unknown_time' using detail = 'Esa cuenta no tiene tiempo en ese circuito.';
  end if;
  if t.voided_at is null then
    update public.race_times
    set voided_at = now(), voided_by = actor, void_reason = why, updated_at = now()
    where user_id = t.user_id and circuit_id = t.circuit_id and circuit_version = t.circuit_version;
    insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value)
    values (actor, 'authenticated', 'void_time', 'race_times',
            format('%s|%s|%s', t.user_id, t.circuit_id, t.circuit_version), why,
            jsonb_build_object('best_ms', t.best_ms, 'best_at', t.best_at));
  end if;
  return jsonb_build_object('user_id', t.user_id, 'circuit', t.circuit_id,
                            'version', t.circuit_version, 'best_ms', t.best_ms, 'voided', true);
end;
$$;

create function private.admin_void_points(p_tx uuid, p_reason text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  why text := btrim(coalesce(p_reason, ''));
  orig public.ledger_transactions;
  coins integer;
  tx uuid;
begin
  if char_length(why) < 3 then
    raise exception 'reason_required' using detail = 'Anular puntos pide un motivo.';
  end if;
  select * into orig from public.ledger_transactions where id = p_tx;
  if not found then
    raise exception 'unknown_entry' using detail = 'Esa entrada del libro no existe.';
  end if;
  if orig.kind = 'compensation' then
    raise exception 'invalid_entry' using detail = 'Una compensación no se anula.';
  end if;
  perform private.lock_account(orig.user_id);
  if exists (select 1 from public.ledger_transactions where compensates_id = orig.id) then
    return jsonb_build_object('tx_id', null, 'voided', false, 'reason', 'already_voided');
  end if;
  -- Las monedas que dio y ya se gastaron no se pueden quitar.
  coins := coalesce((select c.coins from public.coin_balances c where c.user_id = orig.user_id), 0);
  if coins - orig.coins_delta < 0 then
    raise exception 'insufficient_coins' using
      detail = 'Las monedas de esa entrada ya se gastaron: no se puede deshacer entera.';
  end if;
  tx := private.stable_uuid('void|' || orig.id::text);
  insert into public.ledger_transactions (id, user_id, kind, compensates_id, reason, created_by, source_ref)
  values (tx, orig.user_id, 'compensation', orig.id, why, actor, 'admin:void');
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value)
  values (actor, 'authenticated', 'void_points', 'ledger_transactions', orig.id::text, why,
          jsonb_build_object('user_id', orig.user_id, 'kind', orig.kind,
                             'points_delta', orig.points_delta, 'coins_delta', orig.coins_delta));
  return jsonb_build_object('tx_id', tx, 'voided', true, 'points_delta', -orig.points_delta,
                            'coins_delta', -orig.coins_delta);
end;
$$;

create function public.admin_void_race_time(
  p_user uuid, p_circuit text, p_version integer, p_reason text
) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_void_race_time(p_user, p_circuit, p_version, p_reason)
$$;

create function public.admin_void_points(p_tx uuid, p_reason text) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_void_points(p_tx, p_reason)
$$;

revoke all on function private.admin_remove_bottle(uuid, text) from public;
revoke all on function private.admin_dismiss_bottle_report(uuid, text) from public;
revoke all on function private.admin_void_race_time(uuid, text, integer, text) from public;
revoke all on function private.admin_void_points(uuid, text) from public;
grant execute on function private.admin_remove_bottle(uuid, text) to authenticated;
grant execute on function private.admin_dismiss_bottle_report(uuid, text) to authenticated;
grant execute on function private.admin_void_race_time(uuid, text, integer, text) to authenticated;
grant execute on function private.admin_void_points(uuid, text) to authenticated;

revoke all on function public.admin_remove_bottle(uuid, text) from public, anon;
revoke all on function public.admin_dismiss_bottle_report(uuid, text) from public, anon;
revoke all on function public.admin_void_race_time(uuid, text, integer, text) from public, anon;
revoke all on function public.admin_void_points(uuid, text) from public, anon;
grant execute on function public.admin_remove_bottle(uuid, text) to authenticated;
grant execute on function public.admin_dismiss_bottle_report(uuid, text) to authenticated;
grant execute on function public.admin_void_race_time(uuid, text, integer, text) to authenticated;
grant execute on function public.admin_void_points(uuid, text) to authenticated;
