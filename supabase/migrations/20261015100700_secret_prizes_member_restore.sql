-- Restos de las cuentas (plan 032 T300). Detrás de
-- 20261015100400_artist_claim_requests.sql. Aplicada sólo a boia-planet-dev;
-- producción la recibe con las demás del plan
-- (docs/propuestas/2026-10-03-produccion-supabase.md).
--
-- 1. El progreso del servidor conoce los logros secretos del plan 029 y el
--    barco del after. Los secretos nuevos (`fiestera-bailando`,
--    `salto-mortal`, `gaviota-pillada`, `capeaste-temporal`, `horoscopado`)
--    ya cabían en la acción `achievement` (300 puntos y 50 monedas por logro,
--    20261003100100_economy.sql). Faltaba:
--    - el cosmético `barco-after` (ranura `ship`, no se vende, `muestra`) con
--      el logro que lo regala, `siempre-hay-after`: al reclamarlo, la base lo
--      concede (`unlock_achievement`) y luego se puede equipar. Como
--      `SAMPLE_COSMETICS` de @boia/store;
--    - el premio de `siempre-hay-after` (150 puntos y 500 monedas, muestra,
--      `AFTER_POINTS`/`AFTER_COINS` de @boia/store) pasa del tope por logro y
--      el servidor lo rechazaba (`limit_action`). Tabla
--      `private.achievement_prizes`: los logros con tope propio. Un logro de
--      la tabla se cobra hasta su tope, una sola vez (la acción `achievement`
--      sólo admite `once`) y no cuenta para el tope diario de la acción (ni
--      lo gasta): así reclamarlo no deja sin cobrar los demás logros del día.
--      Los logros que no están en la tabla, como siempre.
--    `private.award_points` se redefine con eso; nada más cambia.
-- 2. Devolver de la papelera a un socio cuyo número de Carnet tiene ya otra
--    persona (la papelera saca el Carnet de `public.carnets` y el número
--    queda libre para el siguiente alta o para «Cambiar nº»): antes no se
--    podía (`number_taken`); ahora vuelve con un número nuevo (el siguiente
--    del contador, `private.next_member_number`), la fila de auditoría
--    `restore_member` guarda el nuevo y el de antes
--    (`previous_member_number`), y la respuesta lo dice (`renumbered`). La
--    papelera del Admin (`admin_list_trash`) avisa antes de devolver
--    (`number_taken` en cada socio). Lo demás de devolver, igual.
-- Reejecutable.

-- ---------------------------------------------------------------------------
-- 1. Logros con tope propio y el barco del after

create table if not exists private.achievement_prizes (
  achievement text primary key check (achievement ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  max_points integer not null check (max_points >= 0),
  max_coins integer not null check (max_coins >= 0),
  note text
);
revoke all on private.achievement_prizes from public, anon, authenticated;
grant select, insert, update, delete on private.achievement_prizes to service_role;

insert into private.achievement_prizes (achievement, max_points, max_coins, note)
values ('siempre-hay-after', 150, 500, 'La isla del after (plan 029 T273), muestra')
on conflict (achievement) do update
  set max_points = excluded.max_points, max_coins = excluded.max_coins, note = excluded.note;

insert into public.cosmetics
  (id, name, slot, price_coins, unlock_points, unlock_achievement, unlock_mission, for_ship, base, is_sample)
values
  ('barco-after', 'After', 'ship', null, null, 'siempre-hay-after', null, null, false, true)
on conflict (id) do update set unlock_achievement = excluded.unlock_achievement;

-- La de 20261003100100_economy.sql con el tope propio de los logros de
-- `private.achievement_prizes` (marcado «T300»).
create or replace function private.award_points(
  p_user uuid,
  p_action text,
  p_ref text,
  p_points integer,
  p_coins integer,
  p_policy text,
  p_metadata jsonb,
  p_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.point_actions;
  pts integer := coalesce(p_points, 0);
  cns integer := coalesce(p_coins, 0);
  pol text := coalesce(p_policy, 'once');
  meta jsonb := coalesce(p_metadata, '{}'::jsonb);
  at_ts timestamptz := least(coalesce(p_at, now()), now());
  season uuid := (select s.id from public.seasons s where s.is_active);
  day_start timestamptz;
  day_end timestamptz;
  k text;
  tx uuid;
  used_points bigint;
  used_coins bigint;
  unlocked text[] := '{}';
  cid text;
  mission text;
  -- T300: el tope de este premio y si es un logro con tope propio.
  cap_points integer;
  cap_coins integer;
  prize private.achievement_prizes;
  own_cap boolean := false;
begin
  select * into a from public.point_actions pa where pa.action = p_action;
  if not found or not a.client_allowed then
    raise exception 'unknown_action' using detail = format('Acción desconocida: %s', p_action);
  end if;
  if p_ref is null or char_length(p_ref) > 120 or p_ref !~ a.ref_pattern then
    raise exception 'invalid_ref' using detail = format('Origen no válido para %s: %s', p_action, p_ref);
  end if;
  if not (pol = any (a.policies)) then
    raise exception 'invalid_policy' using detail = format('%s no admite la política %s', p_action, pol);
  end if;
  if pts < 0 or cns < 0 or pts + cns = 0 then
    raise exception 'invalid_amount' using detail = 'Puntos y monedas no negativos, y alguno mayor que 0.';
  end if;
  cap_points := a.max_points;
  cap_coins := a.max_coins;
  if p_action = 'achievement' then
    select * into prize from private.achievement_prizes z where z.achievement = p_ref;
    if found then
      own_cap := true;
      cap_points := greatest(cap_points, prize.max_points);
      cap_coins := greatest(cap_coins, prize.max_coins);
    end if;
  end if;
  if pts > cap_points or cns > cap_coins then
    raise exception 'limit_action' using
      detail = format('Como mucho %s puntos y %s monedas por %s.', cap_points, cap_coins, p_action);
  end if;
  if jsonb_typeof(meta) <> 'object' or octet_length(meta::text) > 2000 then
    raise exception 'invalid_metadata' using detail = 'metadata: un objeto JSON de 2000 bytes como mucho.';
  end if;
  -- Una fusión no trae nada de hace más de 400 días.
  at_ts := greatest(at_ts, now() - interval '400 days');
  day_start := private.madrid_day_start(at_ts);
  day_end := private.madrid_day_start(day_start + interval '25 hours');
  k := case pol
    when 'daily' then p_ref || '@' || to_char(day_start at time zone 'Europe/Madrid', 'YYYY-MM-DD')
    when 'season' then p_ref || '@season:' || coalesce(season::text, 'none')
    else p_ref
  end;
  tx := private.stable_uuid(format('award|%s|%s|%s', p_user, p_action, k));

  perform private.lock_account(p_user);
  if exists (select 1 from public.ledger_transactions l where l.id = tx) then
    return jsonb_build_object('granted', false, 'reason', 'duplicate', 'tx_id', tx);
  end if;

  -- El tope diario no cuenta los logros con tope propio (T300).
  if not own_cap then
    select coalesce(sum(l.points_delta), 0), coalesce(sum(l.coins_delta), 0)
    into used_points, used_coins
    from public.ledger_transactions l
    where l.user_id = p_user and l.action = p_action and l.kind = 'world_reward'
      and l.occurred_at >= day_start and l.occurred_at < day_end
      and (p_action <> 'achievement'
           or not exists (select 1 from private.achievement_prizes z
                          where z.achievement = l.source_ref));
    if used_points + pts > a.daily_points or used_coins + cns > a.daily_coins then
      raise exception 'limit_daily' using
        detail = format('Tope diario de %s: %s puntos y %s monedas.', p_action, a.daily_points, a.daily_coins);
    end if;
  end if;

  insert into public.ledger_transactions
    (id, user_id, kind, points_delta, coins_delta, season_id, source_ref, action, occurred_at, metadata)
  values
    (tx, p_user, 'world_reward', pts, cns, season, p_ref, p_action, at_ts,
     meta || jsonb_build_object('policy', pol, 'key', k));

  -- Lo que regala un logro o la entrega de una misión.
  if p_action = 'achievement' then
    for cid in
      select c.id from public.cosmetics c
      where c.unlock_achievement = p_ref and c.is_active order by c.id
    loop
      if private.grant_cosmetic(p_user, cid, 'achievement:' || p_ref) then
        unlocked := unlocked || cid;
      end if;
    end loop;
  elsif p_action = 'mission' then
    mission := substring(p_ref from '^mision:([a-z0-9_-]+):entrega$');
    for cid in
      select c.id from public.cosmetics c
      where c.unlock_mission = mission and c.is_active order by c.id
    loop
      if private.grant_cosmetic(p_user, cid, 'mission:' || mission) then
        unlocked := unlocked || cid;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'granted', true, 'tx_id', tx, 'points', pts, 'coins', cns, 'season_id', season,
    'cosmetics', to_jsonb(unlocked)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Devolver un socio cuyo número ya es de otra persona

-- La de 20261008200200_member_party_trash.sql: si su número ya lo tiene otra
-- persona, vuelve con uno nuevo (marcado «T300»).
create or replace function private.admin_restore_member(p_user uuid, p_reason text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  why text := nullif(btrim(coalesce(p_reason, '')), '');
  t public.member_trash;
  cname text;
  carnet jsonb;
  old_number bigint;
  new_number bigint;
begin
  perform private.purge_expired_trash();
  select * into t from public.member_trash where user_id = p_user for update;
  if not found then
    raise exception 'unknown_trash' using detail = 'Esa cuenta no está en la papelera o ya pasó su plazo.';
  end if;
  carnet := t.carnet;
  if carnet is not null then
    -- T300: su número ya es de otra persona → el siguiente libre.
    old_number := nullif(carnet ->> 'member_number', '')::bigint;
    new_number := old_number;
    if old_number is not null and exists (
      select 1 from public.carnets c where c.member_number = old_number and c.user_id <> p_user
    ) then
      new_number := private.next_member_number();
      carnet := carnet || jsonb_build_object('member_number', new_number);
    end if;
    begin
      insert into public.carnets
      select * from jsonb_populate_record(null::public.carnets, carnet);
    exception when unique_violation then
      get stacked diagnostics cname = constraint_name;
      if cname = 'carnets_member_number_key' then
        raise exception 'number_taken' using detail = 'Su número de socio ya es de otra persona.';
      end if;
      raise exception 'nickname_taken' using detail = 'Su apodo ya es de otra persona.';
    end;
    insert into public.carnet_answers
    select * from jsonb_populate_recordset(null::public.carnet_answers, t.answers);
    if t.moderation is not null then
      insert into private.carnet_moderation
      select * from jsonb_populate_record(null::private.carnet_moderation, t.moderation);
    end if;
    -- Quien moderó puede ya no existir: su id vuelve como null (on delete set null).
    insert into private.carnet_moderation_trash
      (id, user_id, kind, question_id, before, after, reason, actor_id, created_at, undone_at, undone_by)
    select r.id, r.user_id, r.kind, r.question_id, r.before, r.after, r.reason,
           (select u.id from auth.users u where u.id = r.actor_id), r.created_at, r.undone_at,
           (select u.id from auth.users u where u.id = r.undone_by)
    from jsonb_populate_recordset(null::private.carnet_moderation_trash, t.moderation_trash) r;
  end if;
  update auth.users set banned_until = t.banned_until_before where id = p_user;
  delete from public.member_trash where user_id = p_user;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (actor, 'authenticated', 'restore_member', 'account', p_user::text, why,
          case when new_number is distinct from old_number
               then jsonb_build_object('member_number', old_number) end,
          case when carnet is null then null
               else jsonb_build_object('nickname', carnet ->> 'nickname',
                                       'member_number', new_number)
                    || case when new_number is distinct from old_number
                            then jsonb_build_object('previous_member_number', old_number)
                            else '{}'::jsonb end
          end);
  return jsonb_build_object('user_id', p_user, 'restored', true,
                            'nickname', carnet ->> 'nickname',
                            'member_number', new_number,
                            'previous_member_number', old_number,
                            'renumbered', new_number is distinct from old_number);
end;
$$;

-- La de 20261008200200_member_party_trash.sql con `number_taken` en cada
-- socio: su número ya es de otra persona y volverá con uno nuevo (T300).
create or replace function private.admin_list_trash(p_limit integer) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  lim integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  n_days integer := private.trash_days();
  members jsonb;
  parties jsonb;
begin
  perform private.require_staff('admin');
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', x.user_id, 'email', x.email, 'nickname', x.carnet ->> 'nickname',
    'member_number', (x.carnet ->> 'member_number')::bigint,
    'number_taken', exists (
      select 1 from public.carnets c
      where c.member_number = (x.carnet ->> 'member_number')::bigint and c.user_id <> x.user_id),
    'reason', x.reason, 'deleted_at', x.deleted_at,
    'expires_at', x.deleted_at + make_interval(days => n_days))
    order by x.deleted_at desc), '[]'::jsonb)
  into members
  from (
    select t.*, u.email::text as email
    from public.member_trash t
    join auth.users u on u.id = t.user_id
    order by t.deleted_at desc
    limit lim
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'slug', e.slug, 'title', e.title, 'starts_at', e.starts_at,
    'reason', e.delete_reason, 'deleted_at', e.deleted_at,
    'expires_at', e.deleted_at + make_interval(days => n_days),
    'kept', e.has_history)
    order by e.deleted_at desc), '[]'::jsonb)
  into parties
  from (
    select ev.*,
           (exists (select 1 from public.purchases p where p.event_id = ev.id)
            or exists (select 1 from public.stamps s where s.event_id = ev.id)
            or exists (select 1 from public.ledger_transactions l where l.event_id = ev.id))
             as has_history
    from public.events ev
    where ev.deleted_at is not null
    order by ev.deleted_at desc
    limit lim
  ) e;

  return jsonb_build_object('days', n_days, 'members', members, 'events', parties);
end;
$$;

-- `create or replace` conserva los permisos de las tres (sólo authenticated,
-- con el rol comprobado dentro las del Admin); se repiten por claridad.
revoke all on function private.award_points(uuid, text, text, integer, integer, text, jsonb, timestamptz) from public;
revoke all on function private.admin_restore_member(uuid, text) from public;
revoke all on function private.admin_list_trash(integer) from public;
grant execute on function private.award_points(uuid, text, text, integer, integer, text, jsonb, timestamptz) to authenticated;
grant execute on function private.admin_restore_member(uuid, text) to authenticated;
grant execute on function private.admin_list_trash(integer) to authenticated;
