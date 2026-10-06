-- Números de socio por orden de llegada y enlace de artistas (plan 016 T186,
-- Hernán 2026-10-06). Escrita y probada en local, NO aplicada a ningún
-- proyecto (la aplica Hernán).
--
-- 1. El número de socio deja de ser una identidad (una secuencia quema un
--    número cada vez que un alta falla) y sale de un contador de una fila
--    que se sube DENTRO de la misma transacción que crea el Carnet: si el
--    alta falla, la subida se deshace con ella y el número no se pierde.
--    Artistas y socios comparten la misma serie. Los números que ya existen
--    no cambian; el contador sigue desde el mayor.
-- 2. El Admin cambia el número de un socio sólo a uno libre; queda en la
--    auditoría con el anterior y el nuevo.
-- 3. Un único enlace de artistas: su código se guarda con hash (SHA-256),
--    el Admin lo rota (el código nuevo se ve una vez, al rotar) y quien crea
--    su Carnet con el código vigente queda marcado como artista. Un código
--    viejo o equivocado no da nada: el Carnet se crea como socio normal.

-- ---------------------------------------------------------------------------
-- 1. Contador sin huecos

create table private.member_counter (
  id boolean primary key default true check (id),
  last_number bigint not null check (last_number >= 0)
);
revoke all on private.member_counter from public, anon, authenticated, service_role;

alter table public.carnets alter column member_number drop identity if exists;

insert into private.member_counter (id, last_number)
select true, coalesce(max(member_number), 0) from public.carnets;

-- El siguiente número libre. Bloquea la fila del contador hasta el final de
-- la transacción: dos altas a la vez salen en orden y, si la transacción se
-- deshace, el contador vuelve atrás con ella. Salta los números que el
-- Admin haya dado a mano por delante del contador.
create function private.next_member_number() returns bigint
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  n bigint;
begin
  update private.member_counter set last_number = last_number + 1 where id
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

-- Cada Carnet nuevo toma el siguiente número en su misma sentencia.
alter table public.carnets alter column member_number set default private.next_member_number();

-- ---------------------------------------------------------------------------
-- 3. Enlace de artistas (una sola fila; sin fila, ningún código vale)

create table private.artist_link (
  id boolean primary key default true check (id),
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  rotated_at timestamptz not null default now(),
  rotated_by uuid
);
revoke all on private.artist_link from public, anon, authenticated, service_role;

create function private.artist_code_hash(p_code text) returns text
language sql immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(lower(btrim(coalesce(p_code, ''))), 'UTF8')), 'hex')
$$;

-- ¿Es el código vigente del enlace de artistas?
create function private.artist_code_ok(p_code text) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(btrim(p_code), '') <> ''
     and exists (
       select 1 from private.artist_link l
       where l.code_hash = private.artist_code_hash(p_code)
     )
$$;

-- ---------------------------------------------------------------------------
-- save_profile con el código del enlace de artistas (sólo cuenta al crear)

drop function public.save_profile(text, text, text, text, boolean);
drop function private.save_profile(uuid, text, text, text, text, boolean);

create function private.save_profile(
  p_user uuid,
  p_nickname text,
  p_avatar_key text,
  p_avatar_image text,
  p_privacy_version text,
  p_news boolean,
  p_artist_code text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  nick text := btrim(coalesce(p_nickname, ''));
  problem text;
  privacy public.consents;
  artist boolean;
  broken text;
  created public.carnets;
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
    -- Un Carnet que ya existe no se hace artista con el enlace (lo hace el Admin).
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
    artist := private.artist_code_ok(p_artist_code);
    -- El número sale del contador en esta misma sentencia (valor por defecto):
    -- si el alta falla, el contador se deshace con ella.
    begin
      insert into public.carnets (user_id, nickname, avatar_key, avatar_image, is_artist)
      values (p_user, nick, p_avatar_key, p_avatar_image, artist)
      returning * into created;
    exception when unique_violation then
      get stacked diagnostics broken = constraint_name;
      if broken = 'carnets_member_number_key' then
        raise exception 'member_number_busy' using detail = 'Inténtalo otra vez.';
      end if;
      raise exception 'nickname_taken' using detail = 'Ese apodo ya es de otra persona.';
    end;
    if artist then
      insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, new_value)
      values (p_user, 'authenticated', 'artist_link_join', 'carnets', p_user::text, 'enlace de artistas',
              jsonb_build_object('is_artist', true, 'member_number', created.member_number));
    end if;
  end if;

  if p_news is not null then
    privacy := private.current_consent(p_user, 'privacy');
    insert into public.consents (user_id, kind, granted, policy_version)
    values (p_user, 'news', p_news, coalesce(privacy.policy_version, 'sin-version'));
  end if;
  return private.profile_json(p_user);
end;
$$;

create function public.save_profile(
  p_nickname text,
  p_avatar_key text default null,
  p_avatar_image text default null,
  p_privacy_version text default null,
  p_news boolean default null,
  p_artist_code text default null
) returns jsonb
language sql
set search_path = ''
as $$
  select private.save_profile(private.require_member(), p_nickname, p_avatar_key, p_avatar_image,
                              p_privacy_version, p_news, p_artist_code)
$$;

-- ---------------------------------------------------------------------------
-- 2. El Admin cambia un número de socio (sólo a uno libre, con auditoría)

create function private.admin_set_member_number(p_user uuid, p_number bigint, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  before public.carnets;
  after public.carnets;
begin
  if p_number is null or p_number < 1 or p_number > 99999999 then
    raise exception 'invalid_number' using detail = 'El número es un entero de 1 en adelante.';
  end if;
  -- Mismo cerrojo que las altas: nadie toma el número entre la comprobación y el cambio.
  perform 1 from private.member_counter where id for update;
  select * into before from public.carnets where user_id = p_user for update;
  if not found then
    raise exception 'unknown_member' using detail = 'Esa cuenta no tiene Carnet.';
  end if;
  if before.member_number = p_number then
    return private.profile_json(p_user);
  end if;
  if exists (select 1 from public.carnets where member_number = p_number) then
    raise exception 'number_taken' using detail = 'Ese número ya es de otro socio.';
  end if;
  update public.carnets set member_number = p_number
  where user_id = p_user returning * into after;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (actor, 'authenticated', 'set_member_number', 'carnets', p_user::text, p_reason,
          jsonb_build_object('member_number', before.member_number),
          jsonb_build_object('member_number', after.member_number));
  return private.profile_json(p_user);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. El Admin rota el enlace de artistas y ve cuándo se rotó

-- Un código nuevo (32 cifras hexadecimales). Se devuelve una sola vez; sólo
-- se guarda su hash. El anterior deja de valer en ese momento.
create function private.admin_rotate_artist_link(p_reason text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  code text := replace(gen_random_uuid()::text, '-', '');
  old_at timestamptz;
  res private.artist_link;
begin
  select rotated_at into old_at from private.artist_link where id;
  insert into private.artist_link as l (id, code_hash, rotated_at, rotated_by)
  values (true, private.artist_code_hash(code), now(), actor)
  on conflict (id) do update
    set code_hash = excluded.code_hash, rotated_at = excluded.rotated_at, rotated_by = excluded.rotated_by
  returning * into res;
  -- La auditoría nunca guarda el código.
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (actor, 'authenticated', 'rotate_artist_link', 'artist_link', null, p_reason,
          case when old_at is null then null else jsonb_build_object('rotated_at', old_at) end,
          jsonb_build_object('rotated_at', res.rotated_at));
  return jsonb_build_object('code', code, 'rotated_at', res.rotated_at);
end;
$$;

create function private.admin_artist_link_info() returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  res jsonb;
begin
  perform private.require_staff('admin');
  select jsonb_build_object('active', true, 'rotated_at', l.rotated_at) into res
  from private.artist_link l where l.id;
  return coalesce(res, jsonb_build_object('active', false, 'rotated_at', null));
end;
$$;

create function public.admin_set_member_number(p_user uuid, p_number bigint, p_reason text default null)
returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_set_member_number(p_user, p_number, p_reason)
$$;

create function public.admin_rotate_artist_link(p_reason text default null) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_rotate_artist_link(p_reason)
$$;

create function public.admin_artist_link_info() returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_artist_link_info()
$$;

-- ---------------------------------------------------------------------------
-- Permisos: nada para PUBLIC ni anon.

revoke all on function private.next_member_number() from public;
revoke all on function private.artist_code_hash(text) from public;
revoke all on function private.artist_code_ok(text) from public;
revoke all on function private.save_profile(uuid, text, text, text, text, boolean, text) from public;
revoke all on function private.admin_set_member_number(uuid, bigint, text) from public;
revoke all on function private.admin_rotate_artist_link(text) from public;
revoke all on function private.admin_artist_link_info() from public;

-- service_role inserta Carnets directamente (pruebas, mantenimiento): el valor
-- por defecto del número se evalúa con su rol.
grant execute on function private.next_member_number() to service_role;
grant execute on function private.save_profile(uuid, text, text, text, text, boolean, text) to authenticated;
grant execute on function private.admin_set_member_number(uuid, bigint, text) to authenticated;
grant execute on function private.admin_rotate_artist_link(text) to authenticated;
grant execute on function private.admin_artist_link_info() to authenticated;

revoke all on function public.save_profile(text, text, text, text, boolean, text) from public, anon;
revoke all on function public.admin_set_member_number(uuid, bigint, text) from public, anon;
revoke all on function public.admin_rotate_artist_link(text) from public, anon;
revoke all on function public.admin_artist_link_info() from public, anon;

grant execute on function public.save_profile(text, text, text, text, boolean, text) to authenticated;
grant execute on function public.admin_set_member_number(uuid, bigint, text) to authenticated;
grant execute on function public.admin_rotate_artist_link(text) to authenticated;
grant execute on function public.admin_artist_link_info() to authenticated;
