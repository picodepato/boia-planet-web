-- Cuentas con email (plan 008, decisiones 2, 3, 5 y 11): el Carnet como
-- perfil público (apodo único con filtro, número de socio, artista), los
-- consentimientos con fecha y versión de la política, la copia del resto del
-- documento del navegador y el borrado de la cuenta. El email vive sólo en
-- auth.users y no sale nunca por la Data API salvo al Admin con TOTP.
--
-- Convenciones de las RPC de este plan (también en las migraciones
-- siguientes):
--   - La lógica vive en `private` con SECURITY DEFINER y search_path = '';
--     en `public` sólo hay una envoltura SECURITY INVOKER del mismo nombre,
--     que es lo que llama el cliente (supabase.rpc).
--   - Un rechazo es una excepción con SQLSTATE P0001 (o 42501 si falta
--     cuenta o rol) y un mensaje que es una clave estable en inglés
--     (`nickname_taken`, `limit_daily`…); el detalle va en DETAIL. La lista
--     está en packages/db/src/rpc.ts.
--   - Lo repetido no es un error: devuelve `granted: false` con su motivo.
--   - Las funciones privadas que reciben la cuenta (`p_user`) tienen EXECUTE
--     para authenticated sólo porque la envoltura es INVOKER y se la pasa con
--     private.require_member(); la Data API no expone `private`, así que
--     nadie las llama con otra cuenta.

-- ---------------------------------------------------------------------------
-- Ayudas comunes

-- Id estable a partir de una clave (idempotencia del libro, REQ-ARQ-007).
create function private.stable_uuid(key text) returns uuid
language sql immutable
set search_path = ''
as $$
  select md5(key)::uuid
$$;

-- Inicio del día natural de BOIA que contiene `ts` (Europe/Madrid).
create function private.madrid_day_start(ts timestamptz) returns timestamptz
language sql stable
set search_path = ''
as $$
  select date_trunc('day', ts at time zone 'Europe/Madrid') at time zone 'Europe/Madrid'
$$;

-- La cuenta de quien llama; rechaza sin sesión o con identidad anónima.
create function private.require_member() returns uuid
language plpgsql stable
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or not private.is_member() then
    raise exception 'not_member' using errcode = '42501', detail = 'Hace falta una cuenta con email.';
  end if;
  return uid;
end;
$$;

-- Rol mínimo del equipo con segundo factor (aal2, D-10).
create function private.require_staff(min_role public.staff_role) returns uuid
language plpgsql stable
set search_path = ''
as $$
begin
  if not private.has_staff_role(min_role) then
    raise exception 'forbidden' using errcode = '42501',
      detail = format('Hace falta el rol %s con segundo factor (aal2).', min_role);
  end if;
  return (select auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- Filtro de texto (apodos y botellas, decisiones 5 y 12): enlaces, emails,
-- teléfonos y una lista básica de palabras ofensivas. La lista es mínima y
-- ampliable con service_role; se compara sin tildes ni mayúsculas y con las
-- sustituciones de cifras más comunes (0→o, 1→i, 3→e, 4→a, 5→s, 7→t).

create table private.blocked_words (
  word text primary key check (word ~ '^[a-z]+( [a-z]+)*$'),
  created_at timestamptz not null default now()
);

insert into private.blocked_words (word) values
  ('puta'), ('puto'), ('putas'), ('putos'), ('hijoputa'), ('hijaputa'), ('hdp'),
  ('gilipollas'), ('gilipolla'), ('cabron'), ('cabrona'), ('cabrones'),
  ('mierda'), ('polla'), ('pollas'), ('zorra'), ('zorras'),
  ('maricon'), ('maricones'), ('marica'), ('bollera'), ('subnormal'), ('retrasado'),
  ('retrasada'), ('mongolo'), ('mongola'), ('imbecil'), ('idiota'), ('capullo'),
  ('follar'), ('folla'), ('joder'), ('jodete'), ('chupamela'), ('pendejo'), ('pendeja'),
  ('malparido'), ('gonorrea'), ('negrata'), ('sudaca'), ('moro de mierda'), ('panchito'),
  ('nazi'), ('nazis'), ('hitler'), ('violador'), ('violacion'), ('pederasta'),
  ('fuck'), ('fucker'), ('fucking'), ('shit'), ('bitch'), ('cunt'), ('dick'), ('cock'),
  ('pussy'), ('whore'), ('slut'), ('nigger'), ('nigga'), ('faggot'), ('fag'), ('retard'),
  ('rape'), ('rapist')
on conflict do nothing;
-- Se guardan sin tildes ni eñes: la comparación también las quita.

-- Texto en minúsculas, sin tildes ni eñes.
create function private.fold_text(p text) returns text
language sql immutable
set search_path = ''
as $$
  select translate(lower(p), 'áàâäéèêëíìîïóòôöúùûüñç', 'aaaaeeeeiiiioooouuuunc')
$$;

-- Qué tiene de prohibido un texto: 'link', 'email', 'phone', 'offensive' o
-- null si nada.
create function private.text_problem(p text) returns text
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  t text := private.fold_text(coalesce(p, ''));
  w text;
begin
  if t ~ '[a-z0-9._%+-]+[[:space:]]*(@|\(at\)|\[at\]|\(arroba\)|\[arroba\])[[:space:]]*[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}' then
    return 'email';
  end if;
  if t ~ '(https?://|www\.|\m[a-z0-9-]+\.(com|es|net|org|io|me|app|link|ly|co|info|xyz|gg|tv|eu|cat|dev|site|online|shop|store|club|live|fm|to|be|it|fr|de|uk)\M|\m(t\.me|wa\.me|bit\.ly)\M)' then
    return 'link';
  end if;
  -- Siete cifras o más seguidas, admitiendo espacios, puntos, guiones y paréntesis.
  if t ~ '[0-9]([[:space:].()-]*[0-9]){6,}' then
    return 'phone';
  end if;
  w := translate(t, '013457$', 'oieasts');
  if exists (
    select 1 from private.blocked_words b
    where w ~ ('\m' || replace(b.word, ' ', '[[:space:]]+') || '\M')
  ) then
    return 'offensive';
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- El Carnet como perfil público (decisiones 5 y 10)

alter table public.carnets
  add column member_number bigint generated always as identity (start with 1),
  add column is_artist boolean not null default false,
  -- Foto propia como data URL (AVATAR_IMAGE_MAX de @boia/store).
  add column avatar_image text
    check (avatar_image is null or (char_length(avatar_image) <= 300000 and avatar_image like 'data:image/%'));
alter table public.carnets add constraint carnets_member_number_key unique (member_number);
alter table public.carnets add constraint carnets_avatar_key_check
  check (avatar_key is null or (char_length(avatar_key) <= 80 and avatar_key ~ '^[a-z0-9]+([-_:./][a-z0-9]+)*$'));

-- Desde ahora el Carnet sólo se escribe con save_profile (decisión 6): la RPC
-- aplica el filtro del apodo y exige la política aceptada.
drop policy carnets_insert_own on public.carnets;
drop policy carnets_update_own on public.carnets;
revoke insert, update on public.carnets from authenticated;

-- ---------------------------------------------------------------------------
-- Consentimientos (RGPD, decisión 3): historial de sólo altas. El vigente de
-- cada tipo es el último. Nadie los lee salvo su dueño y el Admin con TOTP.

create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('privacy', 'news')),
  granted boolean not null,
  policy_version text not null check (char_length(policy_version) between 1 and 40),
  created_at timestamptz not null default now()
);
create index consents_user_idx on public.consents (user_id, kind, created_at desc, id desc);

create trigger consents_append_only before update or delete on public.consents
  for each row when (pg_trigger_depth() = 0)
  execute function private.forbid_change();

alter table public.consents enable row level security;
revoke all on public.consents from anon, authenticated, service_role;
grant select on public.consents to authenticated;
grant select, insert on public.consents to service_role;

create policy consents_read_own on public.consents
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_staff_role('admin')));

-- Consentimiento vigente de un tipo.
create function private.current_consent(p_user uuid, p_kind text) returns public.consents
language sql stable
security definer
set search_path = ''
as $$
  select c.* from public.consents c
  where c.user_id = p_user and c.kind = p_kind
  order by c.created_at desc, c.id desc
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- Copia del resto del documento del navegador (decisión 6): casa, ajustes y
-- demás estado sin valor. Lo de valor va en sus tablas.

create table public.account_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_snapshots enable row level security;
revoke all on public.account_snapshots from anon, authenticated, service_role;
grant select on public.account_snapshots to authenticated;
grant select, insert, update, delete on public.account_snapshots to service_role;

create policy account_snapshots_read_own on public.account_snapshots
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- RPC: perfil y consentimientos

-- Carnet propio como JSON, con el consentimiento de noticias.
create function private.profile_json(p_user uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select to_jsonb(c) || jsonb_build_object(
    'news', coalesce((private.current_consent(p_user, 'news')).granted, false),
    'privacy_version', (private.current_consent(p_user, 'privacy')).policy_version
  )
  from public.carnets c
  where c.user_id = p_user
$$;

create function private.save_profile(
  p_user uuid,
  p_nickname text,
  p_avatar_key text,
  p_avatar_image text,
  p_privacy_version text,
  p_news boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  nick text := btrim(coalesce(p_nickname, ''));
  problem text;
  privacy public.consents;
begin
  if char_length(nick) not between 2 and 30 then
    raise exception 'nickname_invalid' using detail = 'El apodo tiene de 2 a 30 caracteres.';
  end if;
  problem := private.text_problem(nick);
  if problem is not null then
    raise exception 'text_%', problem using detail = 'El apodo no pasa el filtro.';
  end if;
  if p_avatar_key is not null
     and (char_length(p_avatar_key) > 80 or p_avatar_key !~ '^[a-z0-9]+([-_:./][a-z0-9]+)*$') then
    raise exception 'avatar_invalid' using detail = 'Avatar desconocido.';
  end if;
  if p_avatar_image is not null
     and (char_length(p_avatar_image) > 300000 or p_avatar_image not like 'data:image/%') then
    raise exception 'avatar_invalid' using detail = 'La foto tiene que ser una imagen de 300 000 caracteres como mucho.';
  end if;
  if p_privacy_version is not null then
    if char_length(btrim(p_privacy_version)) not between 1 and 40 then
      raise exception 'invalid_policy_version';
    end if;
    insert into public.consents (user_id, kind, granted, policy_version)
    values (p_user, 'privacy', true, btrim(p_privacy_version));
  end if;

  if exists (select 1 from public.carnets where user_id = p_user) then
    begin
      update public.carnets
      set nickname = nick, avatar_key = p_avatar_key, avatar_image = p_avatar_image
      where user_id = p_user;
    exception when unique_violation then
      raise exception 'nickname_taken' using detail = 'Ese apodo ya es de otra persona.';
    end;
  else
    privacy := private.current_consent(p_user, 'privacy');
    if privacy.id is null or not privacy.granted then
      raise exception 'privacy_required' using detail = 'Hay que aceptar la política de privacidad.';
    end if;
    begin
      insert into public.carnets (user_id, nickname, avatar_key, avatar_image)
      values (p_user, nick, p_avatar_key, p_avatar_image);
    exception when unique_violation then
      raise exception 'nickname_taken' using detail = 'Ese apodo ya es de otra persona.';
    end;
  end if;

  if p_news is not null then
    privacy := private.current_consent(p_user, 'privacy');
    insert into public.consents (user_id, kind, granted, policy_version)
    values (p_user, 'news', p_news, coalesce(privacy.policy_version, 'sin-version'));
  end if;
  return private.profile_json(p_user);
end;
$$;

create function private.set_news_opt_in(p_user uuid, p_news boolean) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  privacy public.consents := private.current_consent(p_user, 'privacy');
begin
  if p_news is null then
    raise exception 'invalid_input' using detail = 'Falta sí o no.';
  end if;
  insert into public.consents (user_id, kind, granted, policy_version)
  values (p_user, 'news', p_news, coalesce(privacy.policy_version, 'sin-version'));
  return jsonb_build_object('news', p_news);
end;
$$;

-- Borra la cuenta y, en cascada, todo lo suyo. Queda una fila de auditoría
-- sin datos personales.
create function private.delete_account(p_user uuid, p_actor uuid, p_reason text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  role_name text := coalesce(nullif(current_setting('role', true), 'none'), current_user);
begin
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'unknown_member';
  end if;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value)
  values (
    p_actor, role_name, 'delete_account', 'account', p_user::text, p_reason,
    (select jsonb_build_object('nickname', c.nickname, 'member_number', c.member_number)
     from public.carnets c where c.user_id = p_user)
  );
  delete from auth.users where id = p_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC del Admin (staff con aal2, decisión 11)

create function private.admin_set_artist(p_user uuid, p_is_artist boolean, p_reason text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  before public.carnets;
  after public.carnets;
begin
  select * into before from public.carnets where user_id = p_user;
  if not found then
    raise exception 'unknown_member' using detail = 'Esa cuenta no tiene Carnet.';
  end if;
  update public.carnets set is_artist = coalesce(p_is_artist, false)
  where user_id = p_user returning * into after;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (actor, 'authenticated', 'set_artist', 'carnets', p_user::text, p_reason,
          jsonb_build_object('is_artist', before.is_artist), jsonb_build_object('is_artist', after.is_artist));
  return private.profile_json(p_user);
end;
$$;

create function private.admin_delete_member(p_user uuid, p_reason text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
begin
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required' using detail = 'Borrar una cuenta pide un motivo.';
  end if;
  if exists (select 1 from public.staff_roles where user_id = p_user) then
    raise exception 'forbidden' using errcode = '42501',
      detail = 'Una cuenta del equipo no se borra desde aquí.';
  end if;
  perform private.delete_account(p_user, actor, btrim(p_reason));
end;
$$;

-- Socios con su email y consentimientos (export de noticias, T94).
create function private.admin_list_members(
  p_search text, p_news_only boolean, p_limit integer, p_offset integer
) returns table (
  user_id uuid,
  email text,
  nickname text,
  member_number bigint,
  member_since timestamptz,
  signed_up_at timestamptz,
  is_artist boolean,
  news boolean,
  news_at timestamptz,
  news_version text,
  privacy_version text,
  privacy_at timestamptz,
  total bigint
)
language plpgsql stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.require_staff('admin');
  return query
  with m as (
    select u.id as user_id, u.email::text as email, c.nickname, c.member_number, c.member_since,
           u.created_at as signed_up_at, coalesce(c.is_artist, false) as is_artist,
           n.granted as news, n.created_at as news_at, n.policy_version as news_version,
           p.policy_version as privacy_version, p.created_at as privacy_at
    from auth.users u
    left join public.carnets c on c.user_id = u.id
    left join lateral (select * from private.current_consent(u.id, 'news')) n on true
    left join lateral (select * from private.current_consent(u.id, 'privacy')) p on true
    where coalesce(u.is_anonymous, false) = false
  ), f as (
    select * from m
    where (not coalesce(p_news_only, false) or m.news is true)
      and (p_search is null or btrim(p_search) = ''
           or m.email ilike '%' || btrim(p_search) || '%'
           or m.nickname ilike '%' || btrim(p_search) || '%')
  )
  select f.user_id, f.email, f.nickname, f.member_number, f.member_since, f.signed_up_at,
         f.is_artist, coalesce(f.news, false), f.news_at, f.news_version, f.privacy_version,
         f.privacy_at, count(*) over ()
  from f
  order by f.signed_up_at, f.user_id
  limit least(greatest(coalesce(p_limit, 100), 1), 1000)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Envolturas públicas (lo que llama supabase.rpc)

create function public.save_profile(
  p_nickname text,
  p_avatar_key text default null,
  p_avatar_image text default null,
  p_privacy_version text default null,
  p_news boolean default null
) returns jsonb
language sql
set search_path = ''
as $$
  select private.save_profile(private.require_member(), p_nickname, p_avatar_key, p_avatar_image,
                              p_privacy_version, p_news)
$$;

create function public.set_news_opt_in(p_news boolean) returns jsonb
language sql
set search_path = ''
as $$
  select private.set_news_opt_in(private.require_member(), p_news)
$$;

create function public.delete_my_account() returns void
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not_member' using errcode = '42501';
  end if;
  perform private.delete_account(uid, uid, 'delete_my_account');
end;
$$;

create function public.admin_set_artist(p_user uuid, p_is_artist boolean, p_reason text default null)
returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_set_artist(p_user, p_is_artist, p_reason)
$$;

create function public.admin_delete_member(p_user uuid, p_reason text) returns void
language sql
set search_path = ''
as $$
  select private.admin_delete_member(p_user, p_reason)
$$;

create function public.admin_list_members(
  p_search text default null,
  p_news_only boolean default false,
  p_limit integer default 100,
  p_offset integer default 0
) returns table (
  user_id uuid,
  email text,
  nickname text,
  member_number bigint,
  member_since timestamptz,
  signed_up_at timestamptz,
  is_artist boolean,
  news boolean,
  news_at timestamptz,
  news_version text,
  privacy_version text,
  privacy_at timestamptz,
  total bigint
)
language sql
set search_path = ''
as $$
  select * from private.admin_list_members(p_search, p_news_only, p_limit, p_offset)
$$;

-- ---------------------------------------------------------------------------
-- Permisos: nada para PUBLIC ni anon; las RPC de cuenta, para authenticated.

revoke all on function private.stable_uuid(text) from public;
revoke all on function private.madrid_day_start(timestamptz) from public;
revoke all on function private.require_member() from public;
revoke all on function private.require_staff(public.staff_role) from public;
revoke all on function private.fold_text(text) from public;
revoke all on function private.text_problem(text) from public;
revoke all on function private.current_consent(uuid, text) from public;
revoke all on function private.profile_json(uuid) from public;
revoke all on function private.save_profile(uuid, text, text, text, text, boolean) from public;
revoke all on function private.set_news_opt_in(uuid, boolean) from public;
revoke all on function private.delete_account(uuid, uuid, text) from public;
revoke all on function private.admin_set_artist(uuid, boolean, text) from public;
revoke all on function private.admin_delete_member(uuid, text) from public;
revoke all on function private.admin_list_members(text, boolean, integer, integer) from public;

grant execute on function private.require_member() to authenticated;
grant execute on function private.save_profile(uuid, text, text, text, text, boolean) to authenticated;
grant execute on function private.set_news_opt_in(uuid, boolean) to authenticated;
grant execute on function private.delete_account(uuid, uuid, text) to authenticated;
grant execute on function private.admin_set_artist(uuid, boolean, text) to authenticated;
grant execute on function private.admin_delete_member(uuid, text) to authenticated;
grant execute on function private.admin_list_members(text, boolean, integer, integer) to authenticated;

revoke all on function public.save_profile(text, text, text, text, boolean) from public, anon;
revoke all on function public.set_news_opt_in(boolean) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.admin_set_artist(uuid, boolean, text) from public, anon;
revoke all on function public.admin_delete_member(uuid, text) from public, anon;
revoke all on function public.admin_list_members(text, boolean, integer, integer) from public, anon;

grant execute on function public.save_profile(text, text, text, text, boolean) to authenticated;
grant execute on function public.set_news_opt_in(boolean) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.admin_set_artist(uuid, boolean, text) to authenticated;
grant execute on function public.admin_delete_member(uuid, text) to authenticated;
grant execute on function public.admin_list_members(text, boolean, integer, integer) to authenticated;
