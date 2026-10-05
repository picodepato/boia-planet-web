-- El ranking del Cañón por boss final (plan 013 T155, §9 del diseño).
-- Escrita y probada en local; NO aplicada a ningún proyecto (lo hace Hernán).
--
-- Una tabla por boss final (`fantasma`, acto 1; `kraken`, acto 2) y versión
-- de la fórmula de puntuación (`CANON_RANKING_VERSION` de
-- apps/web/lib/mundo/ranking-canon.ts): la mejor partida de cada cuenta.
-- Puntuación = enemigos + notas + medalla + rapidez al vencer al boss final,
-- × la dificultad; la calcula el navegador y la base sólo pone el
-- antitrampas básico del plan 008 (como `submit_race_time`):
--   - duración mínima plausible (`min_ms`) y máxima (la noche, `max_ms`);
--   - el oro no antes de que entre el boss final (`gold_min_ms`, 5:30), ni el
--     bronce o la plata antes del amanecer (`dawn_ms`, 7:00);
--   - un máximo de puntuación por versión (`max_score`).
-- Las partidas con atajo de desarrollo y las de «Terminar partida» no se
-- mandan nunca (lo decide el navegador). Los números son los de
-- `CANON_RANKING_LIMITS` y la config del modo (lo prueba
-- apps/web/lib/mundo/ranking-canon-sql.test.ts).
--
-- `ranking_canon` devuelve JSON con la forma de `RankingPage`
-- (packages/db/src/rpc.ts), como `ranking_race`, de la puntuación más alta a
-- la más baja; sólo salen las cuentas con Carnet.

create table public.canon_boards (
  boss text not null,
  version integer not null check (version > 0),
  name text not null,
  min_ms integer not null check (min_ms > 0),
  gold_min_ms integer not null,
  dawn_ms integer not null,
  max_ms integer not null,
  max_score integer not null check (max_score > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (boss, version),
  check (min_ms <= gold_min_ms and gold_min_ms <= dawn_ms and dawn_ms <= max_ms)
);

comment on table public.canon_boards is
  'Tablas del ranking del Cañón: una por boss final y versión de la fórmula, con su antitrampas.';

-- muestra: los dos bosses finales de la v1 (acto 3 sin construir).
insert into public.canon_boards (boss, version, name, min_ms, gold_min_ms, dawn_ms, max_ms, max_score) values
  ('fantasma', 1, 'Barco Pirata Fantasma', 30000, 330000, 420000, 421000, 170000),
  ('kraken', 1, 'Kraken', 30000, 330000, 420000, 421000, 170000);

alter table public.canon_boards enable row level security;
revoke all on public.canon_boards from anon, authenticated, service_role;
grant select on public.canon_boards to anon, authenticated;
grant select, insert, update, delete on public.canon_boards to service_role;
create policy canon_boards_read on public.canon_boards for select to anon, authenticated using (true);

create table public.canon_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  boss text not null,
  board_version integer not null,
  best_score integer not null check (best_score > 0),
  best_at timestamptz not null default now(),
  -- La partida de la mejor puntuación.
  medal text check (medal in ('bronce', 'plata', 'oro')),
  difficulty text not null check (difficulty in ('tranquila', 'normal', 'tormenta')),
  duration_ms integer not null check (duration_ms > 0),
  attempts integer not null default 1 check (attempts > 0),
  -- Anulada por el Admin: sale del ranking hasta la próxima partida.
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text,
  updated_at timestamptz not null default now(),
  primary key (user_id, boss, board_version),
  foreign key (boss, board_version) references public.canon_boards (boss, version)
);
create index canon_scores_rank_idx on public.canon_scores (boss, board_version, best_score desc, best_at)
  where voided_at is null;

alter table public.canon_scores enable row level security;
revoke all on public.canon_scores from anon, authenticated, service_role;
grant select on public.canon_scores to anon, authenticated;
grant select, insert, update, delete on public.canon_scores to service_role;
create policy canon_scores_read on public.canon_scores
  for select to anon, authenticated
  using (voided_at is null or user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- RPC: mandar una partida

create function private.submit_canon_score(
  p_user uuid, p_boss text, p_version integer, p_score integer, p_ms integer,
  p_medal text, p_difficulty text, p_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.canon_boards;
  prev public.canon_scores;
  at_ts timestamptz := least(coalesce(p_at, now()), now());
  is_best boolean;
  res public.canon_scores;
begin
  select * into b from public.canon_boards where boss = p_boss and version = p_version;
  if not found or not b.is_active then
    raise exception 'unknown_board' using detail = format('Tabla desconocida: %s v%s', p_boss, p_version);
  end if;
  if p_score is null or p_score <= 0 then
    raise exception 'invalid_score' using detail = 'Puntuación mayor que 0.';
  end if;
  if p_score > b.max_score then
    raise exception 'score_too_high' using detail = format('Por encima de %s puntos no es plausible.', b.max_score);
  end if;
  if p_medal is not null and p_medal not in ('bronce', 'plata', 'oro') then
    raise exception 'invalid_medal' using detail = 'Medalla: bronce, plata, oro o ninguna.';
  end if;
  if p_difficulty is null or p_difficulty not in ('tranquila', 'normal', 'tormenta') then
    raise exception 'invalid_difficulty' using detail = 'Dificultad: tranquila, normal o tormenta.';
  end if;
  if p_ms is null or p_ms < b.min_ms then
    raise exception 'too_fast' using detail = format('Por debajo de %s ms la partida no vale.', b.min_ms);
  end if;
  if p_ms > b.max_ms then
    raise exception 'too_slow' using detail = format('Por encima de %s ms la partida no vale.', b.max_ms);
  end if;
  if p_medal = 'oro' and p_ms < b.gold_min_ms then
    raise exception 'too_fast' using detail = 'El oro no vale antes de que entre el boss final.';
  end if;
  if p_medal in ('bronce', 'plata') and p_ms < b.dawn_ms then
    raise exception 'too_fast' using detail = 'El bronce y la plata no valen antes del amanecer.';
  end if;
  perform private.lock_account(p_user);
  select * into prev from public.canon_scores
  where user_id = p_user and boss = b.boss and board_version = b.version;
  if not found then
    insert into public.canon_scores (user_id, boss, board_version, best_score, best_at, medal, difficulty, duration_ms)
    values (p_user, b.boss, b.version, p_score, at_ts, p_medal, p_difficulty, p_ms)
    returning * into res;
    is_best := true;
  else
    is_best := prev.voided_at is not null or p_score > prev.best_score;
    update public.canon_scores
    set attempts = attempts + 1,
        best_score = case when is_best then p_score else best_score end,
        best_at = case when is_best then at_ts else best_at end,
        medal = case when is_best then p_medal else medal end,
        difficulty = case when is_best then p_difficulty else difficulty end,
        duration_ms = case when is_best then p_ms else duration_ms end,
        voided_at = case when is_best then null else voided_at end,
        voided_by = case when is_best then null else voided_by end,
        void_reason = case when is_best then null else void_reason end,
        updated_at = now()
    where user_id = p_user and boss = b.boss and board_version = b.version
    returning * into res;
  end if;
  return jsonb_build_object('best', is_best, 'best_score', res.best_score, 'best_at', res.best_at,
                            'attempts', res.attempts, 'boss', b.boss, 'version', b.version);
end;
$$;

create function public.submit_canon_score(
  p_boss text, p_version integer, p_score integer, p_ms integer,
  p_medal text default null, p_difficulty text default 'normal'
) returns jsonb
language sql
set search_path = ''
as $$
  select private.submit_canon_score(
    private.require_member(), p_boss, p_version, p_score, p_ms, p_medal, p_difficulty, null)
$$;

-- ---------------------------------------------------------------------------
-- RPC: la tabla de un boss

create function private.ranking_canon(
  p_boss text, p_version integer, p_limit integer, p_offset integer
) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v integer := p_version;
  out jsonb;
begin
  if v is null then
    select max(b.version) into v from public.canon_boards b where b.boss = p_boss and b.is_active;
  end if;
  if v is null or not exists (select 1 from public.canon_boards b where b.boss = p_boss and b.version = v) then
    raise exception 'unknown_board' using detail = format('Tabla desconocida: %s', p_boss);
  end if;
  with base as (
    select c.user_id, c.nickname, c.member_number, c.is_artist, s.best_score::bigint as value, s.best_at
    from public.canon_scores s
    join public.carnets c on c.user_id = s.user_id
    where s.boss = p_boss and s.board_version = v and s.voided_at is null
  ), ranked as (
    select b.*,
           rank() over (order by b.value desc) as position,
           row_number() over (order by b.value desc, b.best_at asc, b.member_number asc) as ord
    from base b
  ), lim as (
    select private.page_limit(p_limit) as l, greatest(coalesce(p_offset, 0), 0) as o
  )
  select jsonb_build_object(
    'total', (select count(*) from ranked),
    'limit', lim.l,
    'offset', lim.o,
    'boss', p_boss,
    'version', v,
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object('position', r.position, 'user_id', r.user_id, 'nickname', r.nickname,
                           'member_number', r.member_number, 'is_artist', r.is_artist,
                           'value', r.value, 'best_at', r.best_at,
                           'is_mine', coalesce(r.user_id = (select auth.uid()), false))
        order by r.ord)
      from ranked r where r.ord > lim.o and r.ord <= lim.o + lim.l
    ), '[]'::jsonb),
    'mine', (
      select jsonb_build_object('position', r.position, 'user_id', r.user_id, 'nickname', r.nickname,
                                'member_number', r.member_number, 'is_artist', r.is_artist,
                                'value', r.value, 'best_at', r.best_at, 'is_mine', true)
      from ranked r where r.user_id = (select auth.uid())
    )
  ) into out
  from lim;
  return out;
end;
$$;

-- Sin versión, la más alta activa del boss.
create function public.ranking_canon(
  p_boss text, p_version integer default null, p_limit integer default 50, p_offset integer default 0
) returns jsonb
language sql stable
set search_path = ''
as $$
  select private.ranking_canon(p_boss, p_version, p_limit, p_offset)
$$;

revoke all on function private.submit_canon_score(uuid, text, integer, integer, integer, text, text, timestamptz) from public;
revoke all on function private.ranking_canon(text, integer, integer, integer) from public;
grant execute on function private.submit_canon_score(uuid, text, integer, integer, integer, text, text, timestamptz) to authenticated;
grant execute on function private.ranking_canon(text, integer, integer, integer) to anon, authenticated;

revoke all on function public.submit_canon_score(text, integer, integer, integer, text, text) from public, anon;
revoke all on function public.ranking_canon(text, integer, integer, integer) from public;
grant execute on function public.submit_canon_score(text, integer, integer, integer, text, text) to authenticated;
grant execute on function public.ranking_canon(text, integer, integer, integer) to anon, authenticated;
