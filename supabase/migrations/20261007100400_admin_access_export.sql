-- Acceso del Admin y datos de la cuenta (plan 017 T193, decisiones 6 y 9,
-- REQ-ADM-002, REQ-IDE-050). Escrita y probada en local como texto, NO
-- aplicada a ningún proyecto (la aplica Hernán).
--
-- 1. El Carnet 000 es el del Admin: sólo lo lleva una cuenta con rol admin u
--    owner, lo pone service_role (`assign_admin_carnet`), y el contador de
--    socios nunca lo da (empieza en 1 y el Admin no puede poner el 0 a mano).
-- 2. Entrar con el Carnet 000: el Admin escribe «000» y la contraseña de su
--    cuenta; `admin_sign_in_email(0)` da el email de esa cuenta para que
--    Supabase Auth compruebe la contraseña (y después el TOTP, aal2). Nada
--    más: otro número no da nada.
-- 3. Códigos de respaldo del TOTP: 10 de un solo uso, generados aquí, que se
--    enseñan una vez; sólo se guarda su hash (SHA-256 con sal por código).
--    Usar uno (con la contraseña ya puesta, aal1) quita el TOTP perdido y el
--    siguiente paso da de alta uno nuevo con su QR.
-- 4. «Descargar mis datos» (REQ-IDE-050): todo lo de la cuenta de quien
--    llama, sin secretos ni ids de otras personas.
-- Convenciones: las de 20261003100000_accounts.sql.

-- ---------------------------------------------------------------------------
-- 1. Carnet 000

alter table public.carnets
  add constraint carnets_member_number_nonneg check (member_number >= 0);

-- Un Carnet con el número 0 sólo puede ser de una cuenta admin u owner (lo
-- pone `assign_admin_carnet`). Ni un alta ni un cambio lo dan a un socio.
create function private.guard_carnet_zero() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.member_number = 0
     and (tg_op = 'INSERT' or old.member_number is distinct from 0)
     and not exists (
       select 1 from public.staff_roles s
       where s.user_id = new.user_id and s.role in ('admin', 'owner')
     )
  then
    raise exception 'carnet_zero_reserved' using errcode = '42501',
      detail = 'El Carnet 000 es del Admin.';
  end if;
  return new;
end;
$$;

create trigger carnets_zero_reserved before insert or update of member_number on public.carnets
  for each row execute function private.guard_carnet_zero();

-- Da el Carnet 000 a la cuenta del Admin (que ya tiene Carnet y rol admin u
-- owner). Su número anterior queda libre. Sólo service_role (o el editor SQL).
create function private.assign_admin_carnet(p_user uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  role_name text := coalesce(nullif(current_setting('role', true), 'none'), current_user);
  before public.carnets;
  holder uuid;
begin
  if not exists (
    select 1 from public.staff_roles s
    where s.user_id = p_user and s.role in ('admin', 'owner')
  ) then
    raise exception 'not_admin' using detail = 'El Carnet 000 es para una cuenta con rol admin u owner.';
  end if;
  -- Mismo cerrojo que las altas y los cambios de número.
  perform 1 from private.member_counter where id for update;
  select * into before from public.carnets where user_id = p_user for update;
  if not found then
    raise exception 'unknown_member' using detail = 'Esa cuenta no tiene Carnet: créalo primero.';
  end if;
  select c.user_id into holder from public.carnets c where c.member_number = 0;
  if holder is not null and holder <> p_user then
    raise exception 'number_taken' using detail = 'El Carnet 000 ya es de otra cuenta.';
  end if;
  if before.member_number <> 0 then
    update public.carnets set member_number = 0 where user_id = p_user;
    insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
    values (null, role_name, 'assign_admin_carnet', 'carnets', p_user::text, 'Carnet 000 del Admin',
            jsonb_build_object('member_number', before.member_number),
            jsonb_build_object('member_number', 0));
  end if;
  return private.profile_json(p_user);
end;
$$;

create function public.assign_admin_carnet(p_user uuid) returns jsonb
language sql
set search_path = ''
as $$
  select private.assign_admin_carnet(p_user)
$$;

-- ---------------------------------------------------------------------------
-- 2. Entrar con el Carnet 000

-- El email de la cuenta del Carnet 000 si es admin u owner; null para
-- cualquier otro número (los socios no entran con su número).
create function public.admin_sign_in_email(p_number bigint) returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text
  from public.carnets c
  join auth.users u on u.id = c.user_id
  join public.staff_roles s on s.user_id = c.user_id and s.role in ('admin', 'owner')
  where p_number = 0 and c.member_number = 0
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- 3. Códigos de respaldo del TOTP

create table private.admin_backup_codes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  salt text not null check (salt ~ '^[0-9a-f]{32}$'),
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index admin_backup_codes_user_idx on private.admin_backup_codes (user_id)
  where used_at is null;
alter table private.admin_backup_codes enable row level security;
revoke all on private.admin_backup_codes from public, anon, authenticated, service_role;

-- Hash de un código: sin guiones ni espacios y en mayúsculas, con su sal.
create function private.backup_code_hash(p_salt text, p_code text) returns text
language sql
immutable
set search_path = ''
as $$
  select encode(
    sha256(convert_to(
      p_salt || ':' || upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g')),
      'UTF8'
    )),
    'hex'
  )
$$;

-- 10 códigos nuevos (los anteriores dejan de valer). Cada uno son 10
-- caracteres de un alfabeto de 32 (sin I, O, 0 ni 1), 50 bits, «XXXXX-XXXXX».
-- Se devuelven una sola vez; sólo se guarda su hash.
create function private.admin_generate_backup_codes() returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  p_user uuid := private.require_staff('editor');
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  -- Bytes del uuid v4 sin los bits fijos de versión (6) y variante (8).
  picks constant int[] := array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11];
  codes text[] := '{}';
  raw bytea;
  code text;
  salt text;
  i int;
  j int;
begin
  delete from private.admin_backup_codes where user_id = p_user;
  for i in 1..10 loop
    raw := uuid_send(gen_random_uuid());
    code := '';
    foreach j in array picks loop
      code := code || substr(alphabet, (get_byte(raw, j) % 32) + 1, 1);
    end loop;
    salt := replace(gen_random_uuid()::text, '-', '');
    insert into private.admin_backup_codes (user_id, salt, code_hash)
    values (p_user, salt, private.backup_code_hash(salt, code));
    codes := codes || (substr(code, 1, 5) || '-' || substr(code, 6, 5));
  end loop;
  -- La auditoría nunca guarda los códigos.
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, new_value)
  values (p_user, 'authenticated', 'generate_backup_codes', 'account', p_user::text,
          jsonb_build_object('count', 10));
  return jsonb_build_object('codes', to_jsonb(codes), 'created_at', now());
end;
$$;

-- Usa un código (una sola vez): con la contraseña ya puesta (aal1) y una fila
-- en staff_roles. Quita el TOTP perdido para dar de alta otro.
create function private.admin_use_backup_code(p_user uuid, p_code text) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  hit bigint;
  left_count integer;
begin
  if not exists (select 1 from public.staff_roles s where s.user_id = p_user) then
    raise exception 'forbidden' using errcode = '42501',
      detail = 'Sólo el equipo del Admin tiene códigos de respaldo.';
  end if;
  select b.id into hit
  from private.admin_backup_codes b
  where b.user_id = p_user
    and b.used_at is null
    and b.code_hash = private.backup_code_hash(b.salt, p_code)
  limit 1
  for update;
  if hit is null then
    raise exception 'backup_code_invalid' using detail = 'Ese código no vale o ya se usó.';
  end if;
  update private.admin_backup_codes set used_at = now() where id = hit and used_at is null;
  -- El TOTP perdido se va: el paso siguiente da de alta uno nuevo con su QR.
  delete from auth.mfa_factors where user_id = p_user and factor_type = 'totp';
  select count(*) into left_count
  from private.admin_backup_codes where user_id = p_user and used_at is null;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, new_value)
  values (p_user, 'authenticated', 'use_backup_code', 'account', p_user::text,
          jsonb_build_object('left', left_count));
  return jsonb_build_object('left', left_count);
end;
$$;

create function private.admin_backup_codes_left() returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p_user uuid := private.require_staff('editor');
begin
  return (select count(*)::integer from private.admin_backup_codes
          where user_id = p_user and used_at is null);
end;
$$;

create function public.admin_generate_backup_codes() returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_generate_backup_codes()
$$;

create function public.admin_use_backup_code(p_code text) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_use_backup_code(private.require_member(), p_code)
$$;

create function public.admin_backup_codes_left() returns integer
language sql
set search_path = ''
as $$
  select private.admin_backup_codes_left()
$$;

-- ---------------------------------------------------------------------------
-- 4. «Descargar mis datos» (REQ-IDE-050)

-- Todo lo de la cuenta `p_user`, cada fila suya tal cual salvo los ids de
-- otras personas (quién moderó, anuló o dio un rol). Nunca: los hashes de
-- los códigos de respaldo, el TOTP, contraseñas ni tokens.
create function private.export_my_data(p_user uuid) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'format', 'boia-planet-account-export',
    'version', 1,
    'exported_at', now(),
    'account', (
      select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at,
                                'last_sign_in_at', u.last_sign_in_at)
      from auth.users u where u.id = p_user
    ),
    'carnet', (select to_jsonb(c) from public.carnets c where c.user_id = p_user),
    'carnet_answers', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.question_id)
      from public.carnet_answers a where a.user_id = p_user
    ), '[]'::jsonb),
    'consents', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at, c.id)
      from public.consents c where c.user_id = p_user
    ), '[]'::jsonb),
    'snapshot', (select s.data from public.account_snapshots s where s.user_id = p_user),
    'staff_role', (select to_jsonb(s) - 'granted_by' from public.staff_roles s where s.user_id = p_user),
    'purchases', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at)
      from public.purchases p where p.user_id = p_user
    ), '[]'::jsonb),
    'ledger', coalesce((
      select jsonb_agg(to_jsonb(l) - 'created_by' order by l.created_at, l.id)
      from public.ledger_transactions l where l.user_id = p_user
    ), '[]'::jsonb),
    'balances', jsonb_build_object(
      'points', (select b.points from public.point_balances b where b.user_id = p_user),
      'coins', (select b.coins from public.coin_balances b where b.user_id = p_user)
    ),
    'season_points', coalesce((
      select jsonb_agg(to_jsonb(s)) from public.season_points s where s.user_id = p_user
    ), '[]'::jsonb),
    'achievements', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.awarded_at)
      from public.user_achievements a where a.user_id = p_user
    ), '[]'::jsonb),
    'stamps', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.granted_at)
      from public.stamps s where s.user_id = p_user
    ), '[]'::jsonb),
    'cosmetics', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.unlocked_at)
      from public.user_cosmetics c where c.user_id = p_user
    ), '[]'::jsonb),
    'equipped', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.slot)
      from public.equipped_cosmetics e where e.user_id = p_user
    ), '[]'::jsonb),
    'discounts', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.found_at)
      from public.user_discounts d where d.user_id = p_user
    ), '[]'::jsonb),
    'race_times', coalesce((
      select jsonb_agg(to_jsonb(r) - 'voided_by') from public.race_times r where r.user_id = p_user
    ), '[]'::jsonb),
    'canon_scores', coalesce((
      select jsonb_agg(to_jsonb(s) - 'voided_by') from public.canon_scores s where s.user_id = p_user
    ), '[]'::jsonb),
    'castle_scores', coalesce((
      select jsonb_agg(to_jsonb(s) - 'voided_by') from public.castle_scores s where s.user_id = p_user
    ), '[]'::jsonb),
    'bottles', coalesce((
      select jsonb_agg(to_jsonb(b) - 'moderated_by' order by b.created_at)
      from public.bottles b where b.user_id = p_user
    ), '[]'::jsonb),
    'bottle_reads', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.read_at)
      from public.bottle_reads r where r.reader_id = p_user
    ), '[]'::jsonb),
    'bottle_reports', coalesce((
      select jsonb_agg(to_jsonb(r) - 'resolved_by' order by r.created_at)
      from public.bottle_reports r where r.reporter_id = p_user
    ), '[]'::jsonb)
  )
$$;

create function public.export_my_data() returns jsonb
language sql
set search_path = ''
as $$
  select private.export_my_data(private.require_member())
$$;

-- ---------------------------------------------------------------------------
-- Permisos: nada para PUBLIC; anon sólo pide el email del Carnet 000.

revoke all on function private.guard_carnet_zero() from public;
revoke all on function private.assign_admin_carnet(uuid) from public;
revoke all on function private.backup_code_hash(text, text) from public;
revoke all on function private.admin_generate_backup_codes() from public;
revoke all on function private.admin_use_backup_code(uuid, text) from public;
revoke all on function private.admin_backup_codes_left() from public;
revoke all on function private.export_my_data(uuid) from public;

grant execute on function private.assign_admin_carnet(uuid) to service_role;
grant execute on function private.admin_generate_backup_codes() to authenticated;
grant execute on function private.admin_use_backup_code(uuid, text) to authenticated;
grant execute on function private.admin_backup_codes_left() to authenticated;
grant execute on function private.export_my_data(uuid) to authenticated;

revoke all on function public.assign_admin_carnet(uuid) from public, anon, authenticated;
revoke all on function public.admin_sign_in_email(bigint) from public;
revoke all on function public.admin_generate_backup_codes() from public, anon;
revoke all on function public.admin_use_backup_code(text) from public, anon;
revoke all on function public.admin_backup_codes_left() from public, anon;
revoke all on function public.export_my_data() from public, anon;

grant execute on function public.assign_admin_carnet(uuid) to service_role;
grant execute on function public.admin_sign_in_email(bigint) to anon, authenticated;
grant execute on function public.admin_generate_backup_codes() to authenticated;
grant execute on function public.admin_use_backup_code(text) to authenticated;
grant execute on function public.admin_backup_codes_left() to authenticated;
grant execute on function public.export_my_data() to authenticated;
