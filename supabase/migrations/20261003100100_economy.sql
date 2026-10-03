-- Lo de valor de una cuenta (plan 008, decisiones 6, 7 y 9): puntos y
-- monedas por acciones conocidas con tope por acción y por día, cosméticos
-- comprados y equipados, sellos por QR de la fiesta, tiempos de carrera con
-- un mínimo plausible, descuentos encontrados y usados, la copia del resto
-- del documento y la fusión del progreso del invitado. El cliente nunca
-- escribe estas tablas: sólo llama a las RPC de abajo (ver la cabecera de
-- 20261003100000_accounts.sql para las convenciones).

-- ---------------------------------------------------------------------------
-- El libro: acción de origen, cuándo ocurrió y sellos sin compra (QR)

alter table public.ledger_transactions
  add column action text,
  -- Cuándo ocurrió (en una fusión, la fecha del invitado); los topes diarios
  -- cuentan por este día. created_at sigue siendo cuándo se apuntó.
  add column occurred_at timestamptz not null default now();
create index ledger_user_action_idx on public.ledger_transactions (user_id, action, occurred_at);

-- El sello de la fiesta por QR (decisión 9) no tiene compra.
do $$
declare
  con text;
begin
  select conname into strict con from pg_constraint
  where conrelid = 'public.ledger_transactions'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%''stamp''::%';
  execute format('alter table public.ledger_transactions drop constraint %I', con);
end
$$;
alter table public.ledger_transactions add constraint ledger_stamp_check
  check (kind <> 'stamp' or (event_id is not null and points_delta >= 0 and coins_delta >= 0));
alter table public.stamps alter column purchase_id drop not null;

create or replace function private.ledger_prepare() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  orig public.ledger_transactions;
  ach public.achievements;
  pur public.purchases;
begin
  if new.kind = 'compensation' then
    select * into orig from public.ledger_transactions where id = new.compensates_id;
    if not found then
      raise exception 'La transacción que se compensa no existe' using errcode = '23503';
    end if;
    if orig.kind = 'compensation' then
      raise exception 'Una compensación no se compensa: se registra una transacción nueva'
        using errcode = '23514';
    end if;
    if orig.user_id <> new.user_id then
      raise exception 'La compensación tiene que ser de la misma cuenta' using errcode = '23514';
    end if;
    new.points_delta := -orig.points_delta;
    new.coins_delta := -orig.coins_delta;
    new.season_id := orig.season_id;
    return new;
  end if;

  if new.kind = 'achievement' then
    select * into ach from public.achievements where id = new.achievement_id;
    if not found or not ach.is_active
       or (ach.starts_at is not null and now() < ach.starts_at)
       or (ach.ends_at is not null and now() >= ach.ends_at) then
      raise exception 'El logro no está activo' using errcode = '23514';
    end if;
    new.points_delta := ach.points;
    new.coins_delta := ach.coins;
    if ach.scope = 'season' then
      new.season_id := ach.season_id;
    end if;
  end if;

  -- Con compra (ticketera), tiene que estar confirmada y ser de esta cuenta y
  -- este evento. Sin compra, sólo lo inserta claim_stamp o service_role.
  if new.kind = 'stamp' and new.purchase_id is not null then
    select * into pur from public.purchases where id = new.purchase_id;
    if not found or pur.status <> 'confirmed' or pur.user_id is distinct from new.user_id
       or pur.event_id <> new.event_id then
      raise exception 'El sello exige una compra confirmada de esta cuenta y este evento'
        using errcode = '23514';
    end if;
  end if;

  if new.season_id is null then
    new.season_id := (select s.id from public.seasons s where s.is_active);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Acciones que dan puntos o monedas (decisión 7). El cliente propone la
-- cantidad (la del mundo o la del logro) y la RPC la acepta si la acción
-- existe, el origen tiene la forma de esa acción, la política es una de las
-- suyas, no pasa del tope por acción y el día no pasa del tope diario.
-- Las cantidades son `muestra` y cubren todo lo que da hoy el juego local
-- (packages/world, minijuegos, misión, encuentros y catálogo de logros).

create table public.point_actions (
  action text primary key check (action ~ '^[a-z_]+$'),
  description text not null,
  -- Expresión regular que tiene que cumplir el origen (`ref`).
  ref_pattern text not null,
  policies text[] not null check (policies <@ array['once', 'daily', 'season']),
  max_points integer not null check (max_points >= 0),
  max_coins integer not null check (max_coins >= 0),
  daily_points integer not null check (daily_points >= 0),
  daily_coins integer not null check (daily_coins >= 0),
  -- false: sólo la da el servidor (el sello de la fiesta), nunca award_points.
  client_allowed boolean not null default true,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create trigger point_actions_touch before update on public.point_actions
  for each row execute function private.touch_version();
create trigger point_actions_audit after insert or update or delete on public.point_actions
  for each row execute function private.audit_row('action');

insert into public.point_actions
  (action, description, ref_pattern, policies, max_points, max_coins, daily_points, daily_coins, client_allowed)
values
  ('world', 'Premio de un lugar del mundo: islas, secretos, restos y cofres (por visita).',
   '^lugar:[a-z0-9_.-]+:(points|coins)(:visita:[a-z0-9-]+)?$', array['once', 'season'],
   50, 50, 600, 1200, true),
  ('encounter', 'Encuentro de la web: seguir al delfín, aguantar en el remolino.',
   '^lugar:[a-z0-9_.-]+:(seguir|[0-9]+s)$', array['once', 'daily'],
   0, 100, 0, 300, true),
  ('mission', 'Entrega de la misión central (Boia Fiestera).',
   '^mision:[a-z0-9_-]+:entrega$', array['once'],
   200, 200, 400, 400, true),
  ('minigame', 'Partida ganada de un minijuego (faro, cañón).',
   '^minigame:[a-z0-9_-]+$', array['once', 'daily', 'season'],
   150, 50, 450, 150, true),
  ('achievement', 'Logro reclamado; el origen es el id del logro.',
   '^[a-z0-9]+(-[a-z0-9]+)*$', array['once'],
   300, 50, 2500, 600, true),
  ('stamp', 'Sello de la fiesta por QR (claim_stamp): max_points es lo que da.',
   '^qr:[a-z0-9-]+$', array['once'],
   50, 0, 50, 0, false);

alter table public.point_actions enable row level security;
revoke all on public.point_actions from anon, authenticated, service_role;
grant select on public.point_actions to anon, authenticated;
grant select, insert, update, delete on public.point_actions to service_role;
create policy point_actions_read on public.point_actions for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Cosméticos (tienda «Barco»): el catálogo y lo equipado. La propiedad sale
-- del libro (user_cosmetics), de ser de base o de llegar a unos puntos.

create table public.cosmetics (
  id text primary key check (id ~ '^[a-z0-9]+([-_:./][a-z0-9]+)*$'),
  name text not null,
  slot text not null check (slot in ('flag', 'accessory', 'skin', 'wake', 'ship')),
  price_coins integer check (price_coins is null or price_coins > 0),
  unlock_points integer check (unlock_points is null or unlock_points > 0),
  -- Logro (id del catálogo) o misión que lo regala al cobrarse.
  unlock_achievement text,
  unlock_mission text,
  -- Skin: el barco al que va.
  for_ship text references public.cosmetics (id),
  base boolean not null default false,
  is_active boolean not null default true,
  is_sample boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (for_ship is null or slot = 'skin')
);

create trigger cosmetics_touch before update on public.cosmetics
  for each row execute function private.touch_version();

alter table public.cosmetics enable row level security;
revoke all on public.cosmetics from anon, authenticated, service_role;
grant select on public.cosmetics to anon, authenticated;
grant select, insert, update, delete on public.cosmetics to service_role;
create policy cosmetics_read on public.cosmetics for select to anon, authenticated using (true);

create table public.equipped_cosmetics (
  user_id uuid not null references auth.users (id) on delete cascade,
  slot text not null check (slot in ('flag', 'accessory', 'skin', 'wake', 'ship')),
  cosmetic_id text not null references public.cosmetics (id),
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);

-- Lo equipado se ve en el Carnet público.
alter table public.equipped_cosmetics enable row level security;
revoke all on public.equipped_cosmetics from anon, authenticated, service_role;
grant select on public.equipped_cosmetics to anon, authenticated;
grant select, insert, update, delete on public.equipped_cosmetics to service_role;
create policy equipped_cosmetics_read on public.equipped_cosmetics
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Descuentos escondidos (REQ-COM-021): el catálogo no se lee desde el
-- cliente; cada cuenta ve los suyos, encontrados y usados una vez.

create table public.discounts (
  id text primary key check (id ~ '^[a-z0-9]+([-_:./][a-z0-9]+)*$'),
  -- Evento del contenido al que se aplica (p. ej. sonido-2026); null: a todos.
  event_ref text,
  scope text not null default 'event' check (scope in ('event', 'store')),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  is_sample boolean not null default false,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create trigger discounts_touch before update on public.discounts
  for each row execute function private.touch_version();

alter table public.discounts enable row level security;
revoke all on public.discounts from anon, authenticated, service_role;
grant select, insert, update, delete on public.discounts to service_role;

create table public.user_discounts (
  user_id uuid not null references auth.users (id) on delete cascade,
  discount_id text not null references public.discounts (id),
  found_at timestamptz not null default now(),
  used_at timestamptz,
  used_event text,
  primary key (user_id, discount_id)
);
create index user_discounts_discount_idx on public.user_discounts (discount_id);

alter table public.user_discounts enable row level security;
revoke all on public.user_discounts from anon, authenticated, service_role;
grant select on public.user_discounts to authenticated;
grant select, insert, update, delete on public.user_discounts to service_role;
create policy user_discounts_read_own on public.user_discounts
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Circuitos y tiempos (decisiones 7 y 8). Un tiempo por cuenta, circuito y
-- versión: el mejor. El mínimo plausible es por versión del trazado.

create table public.circuits (
  id text not null check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  version integer not null check (version > 0),
  name text not null,
  laps integer not null default 1 check (laps between 1 and 9),
  min_ms integer not null check (min_ms > 0),
  max_ms integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (id, version),
  check (max_ms > min_ms)
);

-- El Freu v3 (CIRCUIT_ID y CIRCUIT_VERSION de packages/world, 3 vueltas): el
-- oro son 60 s con turbo, placas y rampas; por debajo de 45 s no es una
-- vuelta limpia. El máximo es CIRCUIT_MAX_DURATION_S del motor (300 s).
insert into public.circuits (id, version, name, laps, min_ms, max_ms) values
  ('el-freu', 3, 'El Freu', 3, 45000, 300000);

alter table public.circuits enable row level security;
revoke all on public.circuits from anon, authenticated, service_role;
grant select on public.circuits to anon, authenticated;
grant select, insert, update, delete on public.circuits to service_role;
create policy circuits_read on public.circuits for select to anon, authenticated using (true);

create table public.race_times (
  user_id uuid not null references auth.users (id) on delete cascade,
  circuit_id text not null,
  circuit_version integer not null,
  best_ms integer not null check (best_ms > 0),
  best_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts > 0),
  -- Anulado por el Admin (T94): sale del ranking hasta el próximo tiempo.
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text,
  updated_at timestamptz not null default now(),
  primary key (user_id, circuit_id, circuit_version),
  foreign key (circuit_id, circuit_version) references public.circuits (id, version)
);
create index race_times_rank_idx on public.race_times (circuit_id, circuit_version, best_ms, best_at)
  where voided_at is null;

alter table public.race_times enable row level security;
revoke all on public.race_times from anon, authenticated, service_role;
grant select on public.race_times to anon, authenticated;
grant select, insert, update, delete on public.race_times to service_role;
create policy race_times_read on public.race_times
  for select to anon, authenticated
  using (voided_at is null or user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Código secreto del QR de cada fiesta (decisión 9). Sólo lo lee el Admin.

create table public.event_stamp_codes (
  event_id uuid primary key references public.events (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9]{6,32}$'),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until > valid_from)
);

create trigger event_stamp_codes_touch before update on public.event_stamp_codes
  for each row execute function private.touch_version();
create trigger event_stamp_codes_audit after insert or update or delete on public.event_stamp_codes
  for each row execute function private.audit_row('event_id');

alter table public.event_stamp_codes enable row level security;
revoke all on public.event_stamp_codes from anon, authenticated, service_role;
grant select on public.event_stamp_codes to authenticated;
grant select, insert, update, delete on public.event_stamp_codes to service_role;
create policy event_stamp_codes_admin_read on public.event_stamp_codes
  for select to authenticated using ((select private.has_staff_role('admin')));

-- Código nuevo: 12 caracteres hexadecimales en mayúsculas.
create function private.new_stamp_code() returns text
language sql volatile
set search_path = ''
as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
$$;

-- ---------------------------------------------------------------------------
-- Ayudas internas (sin permisos de cliente)

create function private.lock_account(p_user uuid) returns void
language sql volatile
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('boia:value:' || p_user::text, 0))
$$;

create function private.owns_cosmetic(p_user uuid, p_cosmetic text) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cosmetics c
    where c.id = p_cosmetic
      and (c.base or (c.unlock_points is not null and coalesce(
        (select b.points from public.point_balances b where b.user_id = p_user), 0) >= c.unlock_points))
  ) or exists (
    select 1 from public.user_cosmetics uc
    where uc.user_id = p_user and uc.cosmetic_key = p_cosmetic and uc.revoked_at is null
  )
$$;

-- Regala un cosmético (logro, misión). false si ya lo tenía.
create function private.grant_cosmetic(p_user uuid, p_cosmetic text, p_source text) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if private.owns_cosmetic(p_user, p_cosmetic) then
    return false;
  end if;
  select count(*) into n from public.ledger_transactions
  where user_id = p_user and kind = 'cosmetic' and cosmetic_key = p_cosmetic;
  insert into public.ledger_transactions (id, user_id, kind, cosmetic_key, source_ref, action)
  values (private.stable_uuid(format('cosmetic|%s|%s|%s', p_user, p_cosmetic, n)), p_user,
          'cosmetic', p_cosmetic, p_source, 'unlock');
  return true;
end;
$$;

create function private.equipped_json(p_user uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(e.slot, e.cosmetic_id), '{}'::jsonb)
  from public.equipped_cosmetics e where e.user_id = p_user
$$;

-- ---------------------------------------------------------------------------
-- RPC: puntos y monedas

create function private.award_points(
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
  if pts > a.max_points or cns > a.max_coins then
    raise exception 'limit_action' using
      detail = format('Como mucho %s puntos y %s monedas por %s.', a.max_points, a.max_coins, p_action);
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

  select coalesce(sum(l.points_delta), 0), coalesce(sum(l.coins_delta), 0)
  into used_points, used_coins
  from public.ledger_transactions l
  where l.user_id = p_user and l.action = p_action and l.kind = 'world_reward'
    and l.occurred_at >= day_start and l.occurred_at < day_end;
  if used_points + pts > a.daily_points or used_coins + cns > a.daily_coins then
    raise exception 'limit_daily' using
      detail = format('Tope diario de %s: %s puntos y %s monedas.', p_action, a.daily_points, a.daily_coins);
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
-- RPC: cosméticos

create function private.buy_cosmetic(p_user uuid, p_cosmetic text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cosmetics;
  balance integer;
  n integer;
  tx uuid;
begin
  perform private.lock_account(p_user);
  select * into c from public.cosmetics where id = p_cosmetic;
  if not found then
    raise exception 'unknown_cosmetic' using detail = format('Cosmético desconocido: %s', p_cosmetic);
  end if;
  if private.owns_cosmetic(p_user, c.id) then
    return jsonb_build_object('granted', false, 'reason', 'duplicate');
  end if;
  if not c.is_active or c.price_coins is null then
    raise exception 'not_for_sale' using detail = format('%s no se vende con monedas.', c.id);
  end if;
  if c.for_ship is not null and not private.owns_cosmetic(p_user, c.for_ship) then
    raise exception 'needs_ship' using detail = format('%s necesita el barco %s.', c.id, c.for_ship);
  end if;
  balance := coalesce((select b.coins from public.coin_balances b where b.user_id = p_user), 0);
  if balance < c.price_coins then
    raise exception 'insufficient_coins' using
      detail = format('Cuesta %s monedas y hay %s.', c.price_coins, balance);
  end if;
  select count(*) into n from public.ledger_transactions
  where user_id = p_user and kind = 'cosmetic' and cosmetic_key = c.id;
  tx := private.stable_uuid(format('cosmetic|%s|%s|%s', p_user, c.id, n));
  insert into public.ledger_transactions (id, user_id, kind, coins_delta, cosmetic_key, source_ref, action)
  values (tx, p_user, 'cosmetic', -c.price_coins, c.id, 'coins', 'buy');
  return jsonb_build_object('granted', true, 'tx_id', tx, 'coins', -c.price_coins,
                            'balance', balance - c.price_coins);
end;
$$;

create function private.equip_cosmetic(p_user uuid, p_slot text, p_cosmetic text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cosmetics;
begin
  if p_slot is null or p_slot not in ('flag', 'accessory', 'skin', 'wake', 'ship') then
    raise exception 'invalid_slot' using detail = format('Ranura desconocida: %s', p_slot);
  end if;
  perform private.lock_account(p_user);
  if p_cosmetic is null then
    delete from public.equipped_cosmetics where user_id = p_user and slot = p_slot;
    return private.equipped_json(p_user);
  end if;
  select * into c from public.cosmetics where id = p_cosmetic;
  if not found then
    raise exception 'unknown_cosmetic' using detail = format('Cosmético desconocido: %s', p_cosmetic);
  end if;
  if c.slot <> p_slot then
    raise exception 'wrong_slot' using detail = format('%s va en %s, no en %s.', c.id, c.slot, p_slot);
  end if;
  if not private.owns_cosmetic(p_user, c.id) then
    raise exception 'not_owned' using detail = format('No tienes %s.', c.id);
  end if;
  insert into public.equipped_cosmetics as e (user_id, slot, cosmetic_id)
  values (p_user, p_slot, c.id)
  on conflict (user_id, slot) do update set cosmetic_id = excluded.cosmetic_id, updated_at = now();
  -- Una skin lleva su barco; un barco nuevo no se queda con la skin de otro.
  if p_slot = 'skin' and c.for_ship is not null then
    insert into public.equipped_cosmetics as e (user_id, slot, cosmetic_id)
    values (p_user, 'ship', c.for_ship)
    on conflict (user_id, slot) do update set cosmetic_id = excluded.cosmetic_id, updated_at = now();
  elsif p_slot = 'ship' then
    delete from public.equipped_cosmetics e
    using public.cosmetics s
    where e.user_id = p_user and e.slot = 'skin' and s.id = e.cosmetic_id
      and s.for_ship is distinct from c.id;
  end if;
  return private.equipped_json(p_user);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: sello de la fiesta por QR (decisión 9)

create function private.claim_stamp(p_user uuid, p_event text, p_code text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  pts integer;
  n integer;
  tx uuid;
begin
  select e.id, e.slug, sc.code, sc.valid_from, sc.valid_until into r
  from public.events e
  join public.event_stamp_codes sc on sc.event_id = e.id
  where e.slug = p_event and e.published_at is not null and e.archived_at is null
    and e.state not in ('draft', 'cancelled');
  if not found then
    raise exception 'unknown_event' using detail = format('Fiesta sin sello: %s', p_event);
  end if;
  if upper(btrim(coalesce(p_code, ''))) <> r.code then
    raise exception 'invalid_code' using detail = 'El código del QR no es el de esta fiesta.';
  end if;
  if now() < r.valid_from or now() >= r.valid_until then
    raise exception 'outside_window' using
      detail = format('El sello vale de %s a %s.', r.valid_from, r.valid_until);
  end if;
  perform private.lock_account(p_user);
  if exists (
    select 1 from public.stamps s
    where s.user_id = p_user and s.event_id = r.id and s.revoked_at is null
  ) then
    return jsonb_build_object('granted', false, 'reason', 'already_stamped', 'event', r.slug);
  end if;
  pts := coalesce((select pa.max_points from public.point_actions pa where pa.action = 'stamp'), 0);
  select count(*) into n from public.ledger_transactions
  where user_id = p_user and kind = 'stamp' and event_id = r.id;
  tx := private.stable_uuid(format('stamp|%s|%s|%s', p_user, r.id, n));
  insert into public.ledger_transactions (id, user_id, kind, points_delta, event_id, source_ref, action)
  values (tx, p_user, 'stamp', pts, r.id, 'qr:' || r.slug, 'stamp');
  return jsonb_build_object('granted', true, 'tx_id', tx, 'event', r.slug, 'points', pts);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: tiempos de carrera

create function private.submit_race_time(
  p_user uuid, p_circuit text, p_version integer, p_ms integer, p_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.circuits;
  prev public.race_times;
  at_ts timestamptz := least(coalesce(p_at, now()), now());
  is_best boolean;
  res public.race_times;
begin
  select * into c from public.circuits where id = p_circuit and version = p_version;
  if not found or not c.is_active then
    raise exception 'unknown_circuit' using detail = format('Circuito desconocido: %s v%s', p_circuit, p_version);
  end if;
  if p_ms is null or p_ms <= 0 then
    raise exception 'invalid_time' using detail = 'Milisegundos mayores que 0.';
  end if;
  if p_ms < c.min_ms then
    raise exception 'too_fast' using detail = format('Por debajo de %s ms no es un tiempo plausible.', c.min_ms);
  end if;
  if p_ms > c.max_ms then
    raise exception 'too_slow' using detail = format('Por encima de %s ms la carrera no vale.', c.max_ms);
  end if;
  perform private.lock_account(p_user);
  select * into prev from public.race_times
  where user_id = p_user and circuit_id = c.id and circuit_version = c.version;
  if not found then
    insert into public.race_times (user_id, circuit_id, circuit_version, best_ms, best_at)
    values (p_user, c.id, c.version, p_ms, at_ts)
    returning * into res;
    is_best := true;
  else
    is_best := prev.voided_at is not null or p_ms < prev.best_ms;
    update public.race_times
    set attempts = attempts + 1,
        best_ms = case when is_best then p_ms else best_ms end,
        best_at = case when is_best then at_ts else best_at end,
        voided_at = case when is_best then null else voided_at end,
        voided_by = case when is_best then null else voided_by end,
        void_reason = case when is_best then null else void_reason end,
        updated_at = now()
    where user_id = p_user and circuit_id = c.id and circuit_version = c.version
    returning * into res;
  end if;
  return jsonb_build_object('best', is_best, 'best_ms', res.best_ms, 'best_at', res.best_at,
                            'attempts', res.attempts, 'circuit', c.id, 'version', c.version);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: descuentos

create function private.find_discount(p_user uuid, p_discount text, p_at timestamptz) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.discounts;
  ud public.user_discounts;
  inserted boolean;
begin
  select * into d from public.discounts where id = p_discount;
  if not found or not d.is_active then
    raise exception 'unknown_discount' using detail = format('Descuento desconocido: %s', p_discount);
  end if;
  insert into public.user_discounts (user_id, discount_id, found_at)
  values (p_user, d.id, least(coalesce(p_at, now()), now()))
  on conflict (user_id, discount_id) do nothing;
  inserted := found;
  select * into ud from public.user_discounts where user_id = p_user and discount_id = d.id;
  return jsonb_build_object('first', inserted, 'discount', d.id, 'found_at', ud.found_at,
                            'used_at', ud.used_at);
end;
$$;

create function private.use_discount(p_user uuid, p_discount text, p_event text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.discounts;
  ud public.user_discounts;
begin
  select * into d from public.discounts where id = p_discount;
  if not found or not d.is_active then
    raise exception 'unknown_discount' using detail = format('Descuento desconocido: %s', p_discount);
  end if;
  perform private.lock_account(p_user);
  select * into ud from public.user_discounts where user_id = p_user and discount_id = d.id;
  if not found then
    raise exception 'discount_not_found' using detail = 'Ese descuento todavía no se ha encontrado.';
  end if;
  if ud.used_at is not null then
    raise exception 'discount_used' using detail = 'Ese descuento ya se usó.';
  end if;
  if d.event_ref is not null and p_event is distinct from d.event_ref then
    raise exception 'wrong_event' using detail = format('Ese descuento es de %s.', d.event_ref);
  end if;
  if (d.starts_at is not null and now() < d.starts_at) or (d.ends_at is not null and now() >= d.ends_at) then
    raise exception 'discount_expired' using detail = 'Ese descuento no está vigente.';
  end if;
  update public.user_discounts set used_at = now(), used_event = p_event
  where user_id = p_user and discount_id = d.id
  returning * into ud;
  return jsonb_build_object('used', true, 'discount', d.id, 'used_at', ud.used_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: copia del resto del documento (casa, ajustes…)

create function private.save_snapshot(p_user uuid, p_data jsonb, p_base_version integer) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur public.account_snapshots;
  res public.account_snapshots;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'invalid_snapshot' using detail = 'La copia es un objeto JSON.';
  end if;
  if octet_length(p_data::text) > 524288 then
    raise exception 'snapshot_too_large' using detail = 'La copia ocupa más de 512 KB.';
  end if;
  perform private.lock_account(p_user);
  select * into cur from public.account_snapshots where user_id = p_user;
  -- p_base_version: la versión que el cliente leyó (0: no había ninguna).
  if p_base_version is not null and coalesce(cur.version, 0) <> p_base_version then
    raise exception 'snapshot_conflict' using
      detail = format('La copia del servidor va por la versión %s.', coalesce(cur.version, 0));
  end if;
  insert into public.account_snapshots as s (user_id, data)
  values (p_user, p_data)
  on conflict (user_id) do update
    set data = excluded.data, version = s.version + 1, updated_at = now()
  returning * into res;
  return jsonb_build_object('version', res.version, 'updated_at', res.updated_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: fusión del progreso del invitado (decisión 4). Siempre fusiona: cada
-- elemento pasa por la misma función que la acción en vivo, en su propia
-- subtransacción, así uno rechazado no tira los demás. Forma de p_payload
-- (todas las claves son opcionales; tipos en packages/db/src/rpc.ts):
--   rewards:   [{ action, ref, points, coins, policy, at, metadata }]
--   cosmetics: [id]                       compras con monedas, en orden
--   equipped:  { slot: id }
--   times:     [{ circuit, version, ms, at }]
--   discounts: [{ id, found_at, used, event }]
--   snapshot:  { … }                      sólo si la cuenta no tiene copia

create function private.merge_guest(p_user uuid, p_payload jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  res jsonb;
  rejected jsonb := '[]'::jsonb;
  rewards_granted integer := 0;
  rewards_duplicate integer := 0;
  cosmetics_granted integer := 0;
  cosmetics_duplicate integer := 0;
  times_accepted integer := 0;
  discounts_found integer := 0;
  discounts_used integer := 0;
  snapshot text := 'none';
  slot text;
  cid text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_payload' using detail = 'La fusión recibe un objeto JSON.';
  end if;
  if (select count(*) from jsonb_object_keys(p_payload) k
      where k not in ('rewards', 'cosmetics', 'equipped', 'times', 'discounts', 'snapshot')) > 0 then
    raise exception 'invalid_payload' using detail = 'Claves conocidas: rewards, cosmetics, equipped, times, discounts, snapshot.';
  end if;
  if jsonb_typeof(coalesce(p_payload -> 'rewards', '[]')) <> 'array'
     or jsonb_typeof(coalesce(p_payload -> 'cosmetics', '[]')) <> 'array'
     or jsonb_typeof(coalesce(p_payload -> 'times', '[]')) <> 'array'
     or jsonb_typeof(coalesce(p_payload -> 'discounts', '[]')) <> 'array'
     or jsonb_typeof(coalesce(p_payload -> 'equipped', '{}')) <> 'object' then
    raise exception 'invalid_payload' using detail = 'rewards, cosmetics, times y discounts son listas; equipped, un objeto.';
  end if;
  if jsonb_array_length(coalesce(p_payload -> 'rewards', '[]')) > 2000
     or jsonb_array_length(coalesce(p_payload -> 'cosmetics', '[]')) > 200
     or jsonb_array_length(coalesce(p_payload -> 'times', '[]')) > 200
     or jsonb_array_length(coalesce(p_payload -> 'discounts', '[]')) > 200 then
    raise exception 'payload_too_large' using detail = 'Demasiados elementos en la fusión.';
  end if;

  -- Premios, en el orden en que ocurrieron.
  for item in
    select value from jsonb_array_elements(coalesce(p_payload -> 'rewards', '[]'))
    order by value ->> 'at' nulls last
  loop
    begin
      res := private.award_points(
        p_user, item ->> 'action', item ->> 'ref',
        coalesce((item ->> 'points')::integer, 0), coalesce((item ->> 'coins')::integer, 0),
        coalesce(item ->> 'policy', 'once'), coalesce(item -> 'metadata', '{}'::jsonb),
        (item ->> 'at')::timestamptz);
      if (res ->> 'granted')::boolean then
        rewards_granted := rewards_granted + 1;
      else
        rewards_duplicate := rewards_duplicate + 1;
      end if;
    exception when others then
      rejected := rejected || jsonb_build_object('kind', 'reward', 'ref', item ->> 'ref', 'reason', sqlerrm);
    end;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_payload -> 'discounts', '[]')) loop
    begin
      res := private.find_discount(p_user, item ->> 'id', (item ->> 'found_at')::timestamptz);
      if (res ->> 'first')::boolean then
        discounts_found := discounts_found + 1;
      end if;
      if coalesce((item ->> 'used')::boolean, false) and res ->> 'used_at' is null then
        perform private.use_discount(p_user, item ->> 'id', item ->> 'event');
        discounts_used := discounts_used + 1;
      end if;
    exception when others then
      rejected := rejected || jsonb_build_object('kind', 'discount', 'ref', item ->> 'id', 'reason', sqlerrm);
    end;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_payload -> 'cosmetics', '[]')) loop
    begin
      res := private.buy_cosmetic(p_user, item #>> '{}');
      if (res ->> 'granted')::boolean then
        cosmetics_granted := cosmetics_granted + 1;
      else
        cosmetics_duplicate := cosmetics_duplicate + 1;
      end if;
    exception when others then
      rejected := rejected || jsonb_build_object('kind', 'cosmetic', 'ref', item #>> '{}', 'reason', sqlerrm);
    end;
  end loop;

  for slot, cid in select key, value #>> '{}' from jsonb_each(coalesce(p_payload -> 'equipped', '{}')) loop
    begin
      perform private.equip_cosmetic(p_user, slot, cid);
    exception when others then
      rejected := rejected || jsonb_build_object('kind', 'equip', 'ref', slot || ':' || coalesce(cid, ''), 'reason', sqlerrm);
    end;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_payload -> 'times', '[]')) loop
    begin
      perform private.submit_race_time(
        p_user, item ->> 'circuit', (item ->> 'version')::integer,
        round((item ->> 'ms')::numeric)::integer, (item ->> 'at')::timestamptz);
      times_accepted := times_accepted + 1;
    exception when others then
      rejected := rejected || jsonb_build_object(
        'kind', 'time', 'ref', coalesce(item ->> 'circuit', '') || ':v' || coalesce(item ->> 'version', ''),
        'reason', sqlerrm);
    end;
  end loop;

  if p_payload ? 'snapshot' then
    if exists (select 1 from public.account_snapshots where user_id = p_user) then
      snapshot := 'kept';
    else
      begin
        perform private.save_snapshot(p_user, p_payload -> 'snapshot', 0);
        snapshot := 'saved';
      exception when others then
        rejected := rejected || jsonb_build_object('kind', 'snapshot', 'ref', null, 'reason', sqlerrm);
      end;
    end if;
  end if;

  return jsonb_build_object(
    'rewards', jsonb_build_object('granted', rewards_granted, 'duplicate', rewards_duplicate),
    'cosmetics', jsonb_build_object('granted', cosmetics_granted, 'duplicate', cosmetics_duplicate),
    'times', jsonb_build_object('accepted', times_accepted),
    'discounts', jsonb_build_object('found', discounts_found, 'used', discounts_used),
    'equipped', private.equipped_json(p_user),
    'snapshot', snapshot,
    'rejected', rejected
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC del Admin: código y ventana del QR de una fiesta

create function private.admin_set_stamp_code(
  p_event text, p_valid_from timestamptz, p_valid_until timestamptz, p_regenerate boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev public.events;
  cur public.event_stamp_codes;
  res public.event_stamp_codes;
begin
  perform private.require_staff('admin');
  select * into ev from public.events where slug = p_event;
  if not found then
    raise exception 'unknown_event' using detail = format('Fiesta desconocida: %s', p_event);
  end if;
  if p_valid_from is null or p_valid_until is null or p_valid_until <= p_valid_from then
    raise exception 'invalid_window' using detail = 'La ventana necesita inicio y fin, en ese orden.';
  end if;
  select * into cur from public.event_stamp_codes where event_id = ev.id;
  insert into public.event_stamp_codes as s (event_id, code, valid_from, valid_until)
  values (
    ev.id,
    case when coalesce(p_regenerate, true) or cur.code is null then private.new_stamp_code() else cur.code end,
    p_valid_from, p_valid_until
  )
  on conflict (event_id) do update
    set code = excluded.code, valid_from = excluded.valid_from, valid_until = excluded.valid_until
  returning * into res;
  return jsonb_build_object('event', ev.slug, 'code', res.code, 'valid_from', res.valid_from,
                            'valid_until', res.valid_until);
end;
$$;

-- ---------------------------------------------------------------------------
-- Envolturas públicas

create function public.award_points(
  p_action text,
  p_ref text,
  p_points integer default 0,
  p_coins integer default 0,
  p_policy text default 'once',
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language sql
set search_path = ''
as $$
  select private.award_points(private.require_member(), p_action, p_ref, p_points, p_coins,
                              p_policy, p_metadata, null)
$$;

create function public.buy_cosmetic(p_cosmetic text) returns jsonb
language sql
set search_path = ''
as $$
  select private.buy_cosmetic(private.require_member(), p_cosmetic)
$$;

create function public.equip_cosmetic(p_slot text, p_cosmetic text default null) returns jsonb
language sql
set search_path = ''
as $$
  select private.equip_cosmetic(private.require_member(), p_slot, p_cosmetic)
$$;

create function public.claim_stamp(p_event text, p_code text) returns jsonb
language sql
set search_path = ''
as $$
  select private.claim_stamp(private.require_member(), p_event, p_code)
$$;

create function public.submit_race_time(p_circuit text, p_version integer, p_ms integer) returns jsonb
language sql
set search_path = ''
as $$
  select private.submit_race_time(private.require_member(), p_circuit, p_version, p_ms, null)
$$;

create function public.find_discount(p_discount text) returns jsonb
language sql
set search_path = ''
as $$
  select private.find_discount(private.require_member(), p_discount, null)
$$;

create function public.use_discount(p_discount text, p_event text default null) returns jsonb
language sql
set search_path = ''
as $$
  select private.use_discount(private.require_member(), p_discount, p_event)
$$;

create function public.save_snapshot(p_data jsonb, p_base_version integer default null) returns jsonb
language sql
set search_path = ''
as $$
  select private.save_snapshot(private.require_member(), p_data, p_base_version)
$$;

create function public.merge_guest(p_payload jsonb) returns jsonb
language sql
set search_path = ''
as $$
  select private.merge_guest(private.require_member(), p_payload)
$$;

create function public.admin_set_stamp_code(
  p_event text, p_valid_from timestamptz, p_valid_until timestamptz, p_regenerate boolean default true
) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_set_stamp_code(p_event, p_valid_from, p_valid_until, p_regenerate)
$$;

-- ---------------------------------------------------------------------------
-- Permisos

revoke all on function private.new_stamp_code() from public;
revoke all on function private.lock_account(uuid) from public;
revoke all on function private.owns_cosmetic(uuid, text) from public;
revoke all on function private.grant_cosmetic(uuid, text, text) from public;
revoke all on function private.equipped_json(uuid) from public;
revoke all on function private.award_points(uuid, text, text, integer, integer, text, jsonb, timestamptz) from public;
revoke all on function private.buy_cosmetic(uuid, text) from public;
revoke all on function private.equip_cosmetic(uuid, text, text) from public;
revoke all on function private.claim_stamp(uuid, text, text) from public;
revoke all on function private.submit_race_time(uuid, text, integer, integer, timestamptz) from public;
revoke all on function private.find_discount(uuid, text, timestamptz) from public;
revoke all on function private.use_discount(uuid, text, text) from public;
revoke all on function private.save_snapshot(uuid, jsonb, integer) from public;
revoke all on function private.merge_guest(uuid, jsonb) from public;
revoke all on function private.admin_set_stamp_code(text, timestamptz, timestamptz, boolean) from public;

-- Las envolturas son SECURITY INVOKER: quien llama necesita EXECUTE en la
-- función privada, que fija la cuenta con require_member() en la envoltura.
grant execute on function private.award_points(uuid, text, text, integer, integer, text, jsonb, timestamptz) to authenticated;
grant execute on function private.buy_cosmetic(uuid, text) to authenticated;
grant execute on function private.equip_cosmetic(uuid, text, text) to authenticated;
grant execute on function private.claim_stamp(uuid, text, text) to authenticated;
grant execute on function private.submit_race_time(uuid, text, integer, integer, timestamptz) to authenticated;
grant execute on function private.find_discount(uuid, text, timestamptz) to authenticated;
grant execute on function private.use_discount(uuid, text, text) to authenticated;
grant execute on function private.save_snapshot(uuid, jsonb, integer) to authenticated;
grant execute on function private.merge_guest(uuid, jsonb) to authenticated;
grant execute on function private.admin_set_stamp_code(text, timestamptz, timestamptz, boolean) to authenticated;

revoke all on function public.award_points(text, text, integer, integer, text, jsonb) from public, anon;
revoke all on function public.buy_cosmetic(text) from public, anon;
revoke all on function public.equip_cosmetic(text, text) from public, anon;
revoke all on function public.claim_stamp(text, text) from public, anon;
revoke all on function public.submit_race_time(text, integer, integer) from public, anon;
revoke all on function public.find_discount(text) from public, anon;
revoke all on function public.use_discount(text, text) from public, anon;
revoke all on function public.save_snapshot(jsonb, integer) from public, anon;
revoke all on function public.merge_guest(jsonb) from public, anon;
revoke all on function public.admin_set_stamp_code(text, timestamptz, timestamptz, boolean) from public, anon;

grant execute on function public.award_points(text, text, integer, integer, text, jsonb) to authenticated;
grant execute on function public.buy_cosmetic(text) to authenticated;
grant execute on function public.equip_cosmetic(text, text) to authenticated;
grant execute on function public.claim_stamp(text, text) to authenticated;
grant execute on function public.submit_race_time(text, integer, integer) to authenticated;
grant execute on function public.find_discount(text) to authenticated;
grant execute on function public.use_discount(text, text) to authenticated;
grant execute on function public.save_snapshot(jsonb, integer) to authenticated;
grant execute on function public.merge_guest(jsonb) to authenticated;
grant execute on function public.admin_set_stamp_code(text, timestamptz, timestamptz, boolean) to authenticated;
