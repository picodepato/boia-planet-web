-- Moderación con datos reales (plan 017 T191, decisión 5, REQ-ADM-031):
-- ocultar y devolver un Carnet público entero, su apodo y su foto; devolver
-- al mar una botella retirada; y anular o devolver una entrada de cualquier
-- ranking (carrera, Cañón, Castillo). Las de antes (T94) siguen igual:
-- retirar botellas, descartar reportes, anular un tiempo o unos puntos.
-- Convenciones: las de 20261003100000_accounts.sql. Todo pide rol admin con
-- segundo factor (aal2) y deja su fila en audit_log con el motivo.

-- ---------------------------------------------------------------------------
-- Carnets: el estado de moderación es público (sólo marcas); lo retirado se
-- guarda aparte, en private, para poder devolverlo. Retirar el apodo o la
-- foto los cambia en la fila (por «Miembro de BOIA <nº>» y por nada): así el
-- ranking, las botellas y el Carnet los muestran ya moderados sin tocar cada
-- lectura. Ocultar el Carnet entero lo saca de la lectura pública (RLS) y
-- además retira su apodo y su foto.

alter table public.carnets
  add column hidden_at timestamptz,
  add column nickname_moderated boolean not null default false,
  add column avatar_moderated boolean not null default false;

create table private.carnet_moderation (
  user_id uuid primary key references public.carnets (user_id) on delete cascade,
  -- Lo retirado, para devolverlo; null si no hay nada retirado.
  nickname text,
  avatar_key text,
  avatar_image text,
  updated_at timestamptz not null default now()
);
alter table private.carnet_moderation enable row level security;
revoke all on private.carnet_moderation from public, anon, authenticated;

-- Lo que su dueño vuelve a guardar: lo retirado no vuelve (save_profile
-- manda apodo y foto juntos), lo nuevo sí y quita la marca.
create function private.carnet_moderation_guard() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m private.carnet_moderation;
begin
  if current_setting('boia.moderating', true) = 'on' then
    return new;
  end if;
  if not (old.nickname_moderated or old.avatar_moderated) then
    return new;
  end if;
  select * into m from private.carnet_moderation where user_id = old.user_id;
  if old.nickname_moderated and new.nickname is distinct from old.nickname then
    if m.nickname is not null and lower(new.nickname) = lower(m.nickname) then
      new.nickname := old.nickname;
    else
      new.nickname_moderated := false;
      update private.carnet_moderation set nickname = null, updated_at = now()
      where user_id = old.user_id;
    end if;
  end if;
  if old.avatar_moderated
     and (new.avatar_key is distinct from old.avatar_key
          or new.avatar_image is distinct from old.avatar_image) then
    if new.avatar_key is not distinct from m.avatar_key
       and new.avatar_image is not distinct from m.avatar_image then
      new.avatar_key := old.avatar_key;
      new.avatar_image := old.avatar_image;
    else
      new.avatar_moderated := false;
      update private.carnet_moderation set avatar_key = null, avatar_image = null, updated_at = now()
      where user_id = old.user_id;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.carnet_moderation_guard() from public;

create trigger carnets_moderation_guard before update of nickname, avatar_key, avatar_image
  on public.carnets
  for each row execute function private.carnet_moderation_guard();

-- Un Carnet oculto no se lee (ni sus respuestas) salvo su dueño y el equipo.
drop policy carnets_read on public.carnets;
create policy carnets_read on public.carnets
  for select to anon, authenticated
  using (hidden_at is null
         or user_id = (select auth.uid())
         or (select private.has_staff_role('admin')));

drop policy carnet_answers_read on public.carnet_answers;
create policy carnet_answers_read on public.carnet_answers
  for select to anon, authenticated
  using (user_id = (select auth.uid())
         or (select private.has_staff_role('admin'))
         or exists (select 1 from public.carnets c
                    where c.user_id = carnet_answers.user_id and c.hidden_at is null));

-- Ocultar o devolver: hide | show | hide_nickname | restore_nickname |
-- hide_avatar | restore_avatar. Retirar pide motivo; «show» devuelve el
-- Carnet entero (también el apodo y la foto).
create function private.admin_moderate_carnet(p_user uuid, p_action text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  why text := btrim(coalesce(p_reason, ''));
  c public.carnets;
  after public.carnets;
  m private.carnet_moderation;
  placeholder text;
begin
  if p_action is null or p_action not in
     ('hide', 'show', 'hide_nickname', 'restore_nickname', 'hide_avatar', 'restore_avatar') then
    raise exception 'invalid_action' using detail = format('Acción desconocida: %s', p_action);
  end if;
  if p_action in ('hide', 'hide_nickname', 'hide_avatar') and char_length(why) < 3 then
    raise exception 'reason_required' using detail = 'Retirar algo de un Carnet pide un motivo.';
  end if;
  select * into c from public.carnets where user_id = p_user for update;
  if not found then
    raise exception 'unknown_member' using detail = 'Esa cuenta no tiene Carnet.';
  end if;
  insert into private.carnet_moderation (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into m from private.carnet_moderation where user_id = p_user for update;
  perform set_config('boia.moderating', 'on', true);

  if p_action in ('hide', 'hide_nickname') and not c.nickname_moderated then
    placeholder := 'Miembro de BOIA ' || coalesce(c.member_number::text, left(p_user::text, 8));
    if exists (select 1 from public.carnets x
               where lower(x.nickname) = lower(placeholder) and x.user_id <> p_user) then
      placeholder := 'Miembro de BOIA ' || left(replace(p_user::text, '-', ''), 10);
    end if;
    update private.carnet_moderation set nickname = c.nickname, updated_at = now()
    where user_id = p_user;
    update public.carnets set nickname = placeholder, nickname_moderated = true
    where user_id = p_user;
  end if;
  if p_action in ('hide', 'hide_avatar') and not c.avatar_moderated
     and (c.avatar_key is not null or c.avatar_image is not null) then
    update private.carnet_moderation
    set avatar_key = c.avatar_key, avatar_image = c.avatar_image, updated_at = now()
    where user_id = p_user;
    update public.carnets set avatar_key = null, avatar_image = null, avatar_moderated = true
    where user_id = p_user;
  end if;
  if p_action = 'hide' and c.hidden_at is null then
    update public.carnets set hidden_at = now() where user_id = p_user;
  end if;

  if p_action in ('show', 'restore_nickname') and c.nickname_moderated then
    begin
      update public.carnets
      set nickname = coalesce(m.nickname, nickname), nickname_moderated = false
      where user_id = p_user;
    exception when unique_violation then
      raise exception 'nickname_taken' using detail = 'Su apodo ya es de otra persona.';
    end;
    update private.carnet_moderation set nickname = null, updated_at = now() where user_id = p_user;
  end if;
  if p_action in ('show', 'restore_avatar') and c.avatar_moderated then
    update public.carnets
    set avatar_key = m.avatar_key, avatar_image = m.avatar_image, avatar_moderated = false
    where user_id = p_user;
    update private.carnet_moderation set avatar_key = null, avatar_image = null, updated_at = now()
    where user_id = p_user;
  end if;
  if p_action = 'show' and c.hidden_at is not null then
    update public.carnets set hidden_at = null where user_id = p_user;
  end if;

  perform set_config('boia.moderating', '', true);
  select * into after from public.carnets where user_id = p_user;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (actor, 'authenticated', 'moderate_carnet:' || p_action, 'carnets', p_user::text, nullif(why, ''),
          jsonb_build_object('hidden', c.hidden_at is not null, 'nickname', c.nickname,
                             'nickname_moderated', c.nickname_moderated,
                             'avatar_moderated', c.avatar_moderated),
          jsonb_build_object('hidden', after.hidden_at is not null, 'nickname', after.nickname,
                             'nickname_moderated', after.nickname_moderated,
                             'avatar_moderated', after.avatar_moderated));
  return jsonb_build_object('user_id', p_user, 'hidden', after.hidden_at is not null,
                            'nickname', after.nickname,
                            'nickname_moderated', after.nickname_moderated,
                            'avatar_moderated', after.avatar_moderated);
end;
$$;

-- Los Carnets para la moderación: busca por apodo (también el retirado) o
-- nº de miembro; los ocultos o con algo retirado primero.
create function private.admin_list_carnets(
  p_search text, p_moderated_only boolean, p_limit integer, p_offset integer
) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  q text := nullif(btrim(coalesce(p_search, '')), '');
  out jsonb;
begin
  perform private.require_staff('admin');
  with f as (
    select c.user_id, c.nickname, c.member_number, c.member_since, c.is_artist,
           c.hidden_at, c.nickname_moderated, c.avatar_moderated,
           (c.avatar_key is not null or c.avatar_image is not null) as has_avatar,
           m.nickname as original_nickname,
           (m.avatar_key is not null or m.avatar_image is not null) as has_original_avatar
    from public.carnets c
    left join private.carnet_moderation m on m.user_id = c.user_id
    where (q is null
           or c.nickname ilike '%' || q || '%'
           or m.nickname ilike '%' || q || '%'
           or c.member_number::text = q)
      and (not coalesce(p_moderated_only, false)
           or c.hidden_at is not null or c.nickname_moderated or c.avatar_moderated)
  ), lim as (
    select least(greatest(coalesce(p_limit, 50), 1), 200) as l, greatest(coalesce(p_offset, 0), 0) as o
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.ord)
      from (
        select f.*, row_number() over (
          order by (f.hidden_at is not null or f.nickname_moderated or f.avatar_moderated) desc,
                   f.member_number, f.user_id) as ord
        from f
      ) p, lim
      where p.ord > lim.o and p.ord <= lim.o + lim.l
    ), '[]'::jsonb)
  ) into out;
  return out;
end;
$$;

create function public.admin_moderate_carnet(p_user uuid, p_action text, p_reason text default null)
returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_moderate_carnet(p_user, p_action, p_reason)
$$;

create function public.admin_list_carnets(
  p_search text default null, p_moderated_only boolean default false,
  p_limit integer default 50, p_offset integer default 0
) returns jsonb
language sql stable
set search_path = ''
as $$
  select private.admin_list_carnets(p_search, p_moderated_only, p_limit, p_offset)
$$;

-- ---------------------------------------------------------------------------
-- Botellas: devolver al mar una retirada por moderación. Si su autor ya
-- tiene otra en el mar (una activa por persona), no vuelve.

create function private.admin_restore_bottle(p_bottle uuid, p_reason text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  why text := nullif(btrim(coalesce(p_reason, '')), '');
  b public.bottles;
begin
  select * into b from public.bottles where id = p_bottle for update;
  if not found then
    raise exception 'unknown_bottle' using detail = 'Esa botella no existe.';
  end if;
  if b.status <> 'removed' then
    raise exception 'invalid_status' using detail = 'Sólo vuelve al mar una botella retirada por moderación.';
  end if;
  begin
    update public.bottles
    set status = 'active', moderated_by = null, moderated_at = null
    where id = b.id;
  exception when unique_violation then
    raise exception 'bottle_conflict' using detail = 'Su autor ya tiene otra botella en el mar.';
  end;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (actor, 'authenticated', 'restore_bottle', 'bottles', b.id::text, why,
          jsonb_build_object('status', b.status), jsonb_build_object('status', 'active'));
  return jsonb_build_object('bottle', b.id, 'status', 'active');
end;
$$;

create function public.admin_restore_bottle(p_bottle uuid, p_reason text default null) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_restore_bottle(p_bottle, p_reason)
$$;

-- ---------------------------------------------------------------------------
-- Rankings: el Castillo también se puede anular (como la carrera y el
-- Cañón). Una partida mejor que la anulada la vuelve a meter.

alter table public.castle_scores
  add column voided_at timestamptz,
  add column voided_by uuid references auth.users (id) on delete set null,
  add column void_reason text;

drop policy castle_scores_read on public.castle_scores;
create policy castle_scores_read on public.castle_scores
  for select to anon, authenticated
  using (voided_at is null or user_id = (select auth.uid()));

create function private.castle_score_unvoid() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.voided_at is not null
     and (new.best_score is distinct from old.best_score or new.best_at is distinct from old.best_at) then
    new.voided_at := null;
    new.voided_by := null;
    new.void_reason := null;
  end if;
  return new;
end;
$$;
revoke all on function private.castle_score_unvoid() from public;

create trigger castle_scores_unvoid before update on public.castle_scores
  for each row execute function private.castle_score_unvoid();

-- La tabla de un Castillo sin las anuladas (igual que la de 20261006100300
-- con `s.voided_at is null`).
create or replace function private.ranking_castle(
  p_run_min integer, p_difficulty text, p_version integer, p_limit integer, p_offset integer
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v integer := p_version;
  out jsonb;
begin
  if v is null then
    select max(b.version) into v from public.castle_boards b
      where b.run_min = p_run_min and b.difficulty = p_difficulty and b.is_active;
  end if;
  if v is null or not exists (select 1 from public.castle_boards b
    where b.run_min = p_run_min and b.difficulty = p_difficulty and b.version = v) then
    raise exception 'unknown_board';
  end if;
  with base as (
    select c.user_id, c.nickname, c.member_number, c.is_artist, s.best_score::bigint as value, s.best_at
    from public.castle_scores s join public.carnets c on c.user_id = s.user_id
    where s.run_min = p_run_min and s.difficulty = p_difficulty and s.board_version = v
      and s.voided_at is null
  ), ranked as (
    select b.*, rank() over (order by b.value desc) as position,
      row_number() over (order by b.value desc, b.best_at asc, b.member_number asc) as ord from base b
  ), lim as (
    select private.page_limit(p_limit) as l, greatest(coalesce(p_offset, 0), 0) as o
  )
  select jsonb_build_object(
    'total', (select count(*) from ranked), 'limit', lim.l, 'offset', lim.o,
    'run_min', p_run_min, 'difficulty', p_difficulty, 'version', v,
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'position', r.position, 'user_id', r.user_id, 'nickname', r.nickname,
      'member_number', r.member_number, 'is_artist', r.is_artist, 'value', r.value, 'best_at', r.best_at,
      'is_mine', coalesce(r.user_id = (select auth.uid()), false)) order by r.ord)
      from ranked r where r.ord > lim.o and r.ord <= lim.o + lim.l), '[]'::jsonb),
    'mine', (select jsonb_build_object('position', r.position, 'user_id', r.user_id, 'nickname', r.nickname,
      'member_number', r.member_number, 'is_artist', r.is_artist, 'value', r.value, 'best_at', r.best_at,
      'is_mine', true) from ranked r where r.user_id = (select auth.uid()))
  ) into out from lim;
  return out;
end;
$$;

-- Anular o devolver una entrada. p_board: race | canon | castle; p_key: el
-- circuito, el boss o «<minutos>:<dificultad>» del Castillo.
create function private.admin_set_score_void(
  p_board text, p_user uuid, p_key text, p_version integer, p_void boolean, p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  why text := btrim(coalesce(p_reason, ''));
  v_run integer;
  v_diff text;
  hit boolean;
  was timestamptz;
  entity text := format('%s|%s|%s|%s', p_board, p_user, p_key, p_version);
begin
  if p_board is null or p_board not in ('race', 'canon', 'castle') then
    raise exception 'invalid_board' using detail = format('Ranking desconocido: %s', p_board);
  end if;
  if p_void and char_length(why) < 3 then
    raise exception 'reason_required' using detail = 'Anular una entrada pide un motivo.';
  end if;
  if p_board = 'race' then
    select t.voided_at into was from public.race_times t
    where t.user_id = p_user and t.circuit_id = p_key and t.circuit_version = p_version for update;
    hit := found;
    if hit then
      update public.race_times t
      set voided_at = case when p_void then coalesce(t.voided_at, now()) end,
          voided_by = case when p_void then coalesce(t.voided_by, actor) end,
          void_reason = case when p_void then why end,
          updated_at = now()
      where t.user_id = p_user and t.circuit_id = p_key and t.circuit_version = p_version;
    end if;
  elsif p_board = 'canon' then
    select s.voided_at into was from public.canon_scores s
    where s.user_id = p_user and s.boss = p_key and s.board_version = p_version for update;
    hit := found;
    if hit then
      update public.canon_scores s
      set voided_at = case when p_void then coalesce(s.voided_at, now()) end,
          voided_by = case when p_void then coalesce(s.voided_by, actor) end,
          void_reason = case when p_void then why end,
          updated_at = now()
      where s.user_id = p_user and s.boss = p_key and s.board_version = p_version;
    end if;
  else
    if p_key is null or p_key !~ '^[0-9]+:[a-z]+$' then
      raise exception 'unknown_entry' using detail = 'La tabla del Castillo es «<minutos>:<dificultad>».';
    end if;
    v_run := split_part(p_key, ':', 1)::integer;
    v_diff := split_part(p_key, ':', 2);
    select s.voided_at into was from public.castle_scores s
    where s.user_id = p_user and s.run_min = v_run and s.difficulty = v_diff
      and s.board_version = p_version for update;
    hit := found;
    if hit then
      -- Sin tocar la marca ni la fecha: el disparador sólo la reabre con una partida mejor.
      update public.castle_scores s
      set voided_at = case when p_void then coalesce(s.voided_at, now()) end,
          voided_by = case when p_void then coalesce(s.voided_by, actor) end,
          void_reason = case when p_void then why end,
          updated_at = now()
      where s.user_id = p_user and s.run_min = v_run and s.difficulty = v_diff
        and s.board_version = p_version;
    end if;
  end if;
  if not coalesce(hit, false) then
    raise exception 'unknown_entry' using detail = 'Esa cuenta no tiene entrada en ese ranking.';
  end if;
  if (was is not null) is distinct from p_void then
    insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
    values (actor, 'authenticated', case when p_void then 'void_score' else 'restore_score' end,
            'rankings', entity, nullif(why, ''),
            jsonb_build_object('voided', was is not null), jsonb_build_object('voided', p_void));
  end if;
  return jsonb_build_object('board', p_board, 'user_id', p_user, 'key', p_key,
                            'version', p_version, 'voided', p_void);
end;
$$;

create function public.admin_void_score(
  p_board text, p_user uuid, p_key text, p_version integer, p_reason text
) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_set_score_void(p_board, p_user, p_key, p_version, true, p_reason)
$$;

create function public.admin_restore_score(
  p_board text, p_user uuid, p_key text, p_version integer, p_reason text default null
) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_set_score_void(p_board, p_user, p_key, p_version, false, p_reason)
$$;

-- Las entradas anuladas de todos los rankings, la más reciente primero.
create function private.admin_list_voided(p_limit integer) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  out jsonb;
begin
  perform private.require_staff('admin');
  with v as (
    select 'race'::text as board, t.user_id, t.circuit_id as key, t.circuit_version as version,
           t.best_ms::bigint as value, t.voided_at, t.void_reason
    from public.race_times t where t.voided_at is not null
    union all
    select 'canon', s.user_id, s.boss, s.board_version, s.best_score::bigint, s.voided_at, s.void_reason
    from public.canon_scores s where s.voided_at is not null
    union all
    select 'castle', s.user_id, s.run_min || ':' || s.difficulty, s.board_version,
           s.best_score::bigint, s.voided_at, s.void_reason
    from public.castle_scores s where s.voided_at is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'board', v.board, 'user_id', v.user_id, 'nickname', c.nickname, 'key', v.key,
    'version', v.version, 'value', v.value, 'voided_at', v.voided_at, 'void_reason', v.void_reason)
    order by v.voided_at desc), '[]'::jsonb)
  into out
  from (select * from v order by v.voided_at desc
        limit least(greatest(coalesce(p_limit, 100), 1), 500)) v
  left join public.carnets c on c.user_id = v.user_id;
  return out;
end;
$$;

create function public.admin_list_voided(p_limit integer default 100) returns jsonb
language sql stable
set search_path = ''
as $$
  select private.admin_list_voided(p_limit)
$$;

-- ---------------------------------------------------------------------------
-- Permisos: las privadas, sólo para quien tiene sesión (piden rol dentro);
-- las públicas, nunca para anon.

revoke all on function private.admin_moderate_carnet(uuid, text, text) from public;
revoke all on function private.admin_list_carnets(text, boolean, integer, integer) from public;
revoke all on function private.admin_restore_bottle(uuid, text) from public;
revoke all on function private.admin_set_score_void(text, uuid, text, integer, boolean, text) from public;
revoke all on function private.admin_list_voided(integer) from public;
grant execute on function private.admin_moderate_carnet(uuid, text, text) to authenticated;
grant execute on function private.admin_list_carnets(text, boolean, integer, integer) to authenticated;
grant execute on function private.admin_restore_bottle(uuid, text) to authenticated;
grant execute on function private.admin_set_score_void(text, uuid, text, integer, boolean, text) to authenticated;
grant execute on function private.admin_list_voided(integer) to authenticated;

revoke all on function public.admin_moderate_carnet(uuid, text, text) from public, anon;
revoke all on function public.admin_list_carnets(text, boolean, integer, integer) from public, anon;
revoke all on function public.admin_restore_bottle(uuid, text) from public, anon;
revoke all on function public.admin_void_score(text, uuid, text, integer, text) from public, anon;
revoke all on function public.admin_restore_score(text, uuid, text, integer, text) from public, anon;
revoke all on function public.admin_list_voided(integer) from public, anon;
grant execute on function public.admin_moderate_carnet(uuid, text, text) to authenticated;
grant execute on function public.admin_list_carnets(text, boolean, integer, integer) to authenticated;
grant execute on function public.admin_restore_bottle(uuid, text) to authenticated;
grant execute on function public.admin_void_score(text, uuid, text, integer, text) to authenticated;
grant execute on function public.admin_restore_score(text, uuid, text, integer, text) to authenticated;
grant execute on function public.admin_list_voided(integer) to authenticated;
