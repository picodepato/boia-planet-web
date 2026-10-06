-- Castillo (plan 014 T163). Escrita, NO aplicada a ningún proyecto.
-- Nueve tablas: duración × dificultad, con su versión y máximo de puntos
-- del calendario de enemigos. Puntuación de la sim, sin multiplicador.
create table public.castle_boards (
  run_min integer not null check (run_min in (5, 7, 10)),
  difficulty text not null check (difficulty in ('tranquila', 'normal', 'tormenta')),
  version integer not null check (version > 0),
  config_version integer not null,
  min_ms integer not null check (min_ms > 0),
  duration_ms integer not null,
  max_ms integer not null,
  max_kill_points integer not null check (max_kill_points > 0),
  life_bonus integer not null,
  castle_life double precision not null,
  is_active boolean not null default true,
  primary key (run_min, difficulty, version),
  check (min_ms <= duration_ms and duration_ms <= max_ms)
);

-- muestra: mismos topes que castleMaxKillPoints / DEFENSE_CONFIG.
insert into public.castle_boards
  (run_min, difficulty, version, config_version, min_ms, duration_ms, max_ms, max_kill_points, life_bonus, castle_life) values
  (5, 'tranquila', 1, 5, 30000, 300000, 301000, 4193, 1000, 100),
  (5, 'normal', 1, 5, 30000, 300000, 301000, 5178, 1000, 100),
  (5, 'tormenta', 1, 5, 30000, 300000, 301000, 6415, 1000, 100),
  (7, 'tranquila', 1, 5, 30000, 420000, 421000, 7101, 1000, 100),
  (7, 'normal', 1, 5, 30000, 420000, 421000, 8927, 1000, 100),
  (7, 'tormenta', 1, 5, 30000, 420000, 421000, 11184, 1000, 100),
  (10, 'tranquila', 1, 5, 30000, 600000, 601000, 13378, 1000, 100),
  (10, 'normal', 1, 5, 30000, 600000, 601000, 16911, 1000, 100),
  (10, 'tormenta', 1, 5, 30000, 600000, 601000, 21288, 1000, 100);

alter table public.castle_boards enable row level security;
revoke all on public.castle_boards from anon, authenticated, service_role;
grant select on public.castle_boards to anon, authenticated;
grant select, insert, update, delete on public.castle_boards to service_role;
create policy castle_boards_read on public.castle_boards for select to anon, authenticated using (true);

create table public.castle_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  run_min integer not null,
  difficulty text not null,
  board_version integer not null,
  best_score integer not null check (best_score > 0),
  best_at timestamptz not null default now(),
  medal text check (medal in ('bronce', 'plata', 'oro')),
  end_reason text not null check (end_reason in ('held', 'fallen')),
  castle_life double precision not null,
  duration_ms integer not null check (duration_ms > 0),
  attempts integer not null default 1 check (attempts > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, run_min, difficulty, board_version),
  foreign key (run_min, difficulty, board_version) references public.castle_boards (run_min, difficulty, version)
);
create index castle_scores_rank_idx on public.castle_scores (run_min, difficulty, board_version, best_score desc, best_at);
alter table public.castle_scores enable row level security;
revoke all on public.castle_scores from anon, authenticated, service_role;
grant select on public.castle_scores to anon, authenticated;
grant select, insert, update, delete on public.castle_scores to service_role;
create policy castle_scores_read on public.castle_scores for select to anon, authenticated using (true);

create function private.submit_castle_score(
  p_user uuid, p_run_min integer, p_difficulty text, p_version integer,
  p_score integer, p_ms integer, p_medal text, p_end text, p_life double precision, p_ranked boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.castle_boards;
  prev public.castle_scores;
  res public.castle_scores;
  is_best boolean;
  expected_medal text;
  bonus integer := 0;
begin
  -- También al llamar a la función privada: ninguna cuenta puede suplantar otra.
  if p_user is distinct from private.require_member() then
    raise exception 'forbidden';
  end if;
  if p_ranked is distinct from true then raise exception 'unranked_game'; end if;
  if p_end is null or p_end not in ('held', 'fallen') then raise exception 'invalid_end'; end if;
  if p_difficulty is null or p_difficulty not in ('tranquila', 'normal', 'tormenta') then
    raise exception 'invalid_difficulty';
  end if;
  select * into b from public.castle_boards
    where run_min = p_run_min and difficulty = p_difficulty and version = p_version;
  if not found or not b.is_active then raise exception 'unknown_board'; end if;
  if p_score is null or p_score <= 0 then raise exception 'invalid_score'; end if;
  if p_ms is null or p_ms < b.min_ms then raise exception 'too_fast'; end if;
  if p_ms > b.max_ms then raise exception 'too_slow'; end if;
  if p_life is null or not (p_life >= 0 and p_life <= b.castle_life) then
    raise exception 'invalid_life';
  end if;
  if p_end = 'held' then
    if p_ms < b.duration_ms then raise exception 'too_fast'; end if;
    if p_life <= 0 then raise exception 'invalid_life'; end if;
    expected_medal := case when p_life > b.castle_life / 2 then 'oro' else 'plata' end;
    bonus := floor(b.life_bonus * p_life / b.castle_life + 0.5)::integer;
  else
    if p_life <> 0 then raise exception 'invalid_life'; end if;
    expected_medal := case when p_ms >= b.duration_ms / 2 then 'bronce' else null end;
  end if;
  if p_medal is distinct from expected_medal then raise exception 'invalid_medal'; end if;
  if p_score < bonus then raise exception 'invalid_score'; end if;
  if p_score > b.max_kill_points + bonus then raise exception 'score_too_high'; end if;
  perform private.lock_account(p_user);
  select * into prev from public.castle_scores
    where user_id = p_user and run_min = b.run_min and difficulty = b.difficulty and board_version = b.version;
  if not found then
    insert into public.castle_scores (user_id, run_min, difficulty, board_version, best_score, medal, end_reason, castle_life, duration_ms)
      values (p_user, b.run_min, b.difficulty, b.version, p_score, p_medal, p_end, p_life, p_ms) returning * into res;
    is_best := true;
  else
    is_best := p_score > prev.best_score;
    update public.castle_scores set
      attempts = attempts + 1,
      best_score = case when is_best then p_score else best_score end,
      best_at = case when is_best then now() else best_at end,
      medal = case when is_best then p_medal else medal end,
      end_reason = case when is_best then p_end else end_reason end,
      castle_life = case when is_best then p_life else castle_life end,
      duration_ms = case when is_best then p_ms else duration_ms end,
      updated_at = now()
      where user_id = p_user and run_min = b.run_min and difficulty = b.difficulty and board_version = b.version
      returning * into res;
  end if;
  return jsonb_build_object('best', is_best, 'best_score', res.best_score, 'best_at', res.best_at,
    'attempts', res.attempts, 'run_min', b.run_min, 'difficulty', b.difficulty, 'version', b.version);
end;
$$;

create function public.submit_castle_score(
  p_run_min integer, p_difficulty text, p_version integer, p_score integer, p_ms integer,
  p_medal text, p_end text, p_life double precision, p_ranked boolean
) returns jsonb language sql set search_path = '' as $$
  select private.submit_castle_score(private.require_member(), p_run_min, p_difficulty, p_version,
    p_score, p_ms, p_medal, p_end, p_life, p_ranked)
$$;

create function private.ranking_castle(
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

create function public.ranking_castle(
  p_run_min integer, p_difficulty text, p_version integer default null,
  p_limit integer default 50, p_offset integer default 0
) returns jsonb language sql stable set search_path = '' as $$
  select private.ranking_castle(p_run_min, p_difficulty, p_version, p_limit, p_offset)
$$;

revoke all on function private.submit_castle_score(uuid, integer, text, integer, integer, integer, text, text, double precision, boolean) from public;
revoke all on function private.ranking_castle(integer, text, integer, integer, integer) from public;
grant execute on function private.submit_castle_score(uuid, integer, text, integer, integer, integer, text, text, double precision, boolean) to authenticated;
grant execute on function private.ranking_castle(integer, text, integer, integer, integer) to anon, authenticated;
revoke all on function public.submit_castle_score(integer, text, integer, integer, integer, text, text, double precision, boolean) from public, anon;
revoke all on function public.ranking_castle(integer, text, integer, integer, integer) from public;
grant execute on function public.submit_castle_score(integer, text, integer, integer, integer, text, text, double precision, boolean) to authenticated;
grant execute on function public.ranking_castle(integer, text, integer, integer, integer) to anon, authenticated;
