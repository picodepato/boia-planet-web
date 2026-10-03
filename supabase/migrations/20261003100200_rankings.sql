-- Rankings globales (plan 008, decisión 8): tiempos por circuito (el mejor de
-- cada cuenta), puntos de siempre y puntos de la temporada. Cada lista sale
-- por páginas (p_limit, p_offset) en un orden estable y trae la fila de
-- quien llama aunque quede fuera de la página. Sólo aparecen las cuentas con
-- Carnet (se enseña el apodo, nunca el email). Las pueden leer anon y
-- cualquier cuenta.
--
-- Devuelven JSON (tipo RankingPage de packages/db/src/rpc.ts):
--   { total, limit, offset, rows: [fila], mine: fila | null, … }
--   fila = { position, user_id, nickname, member_number, is_artist, value,
--            is_mine }
-- `position` es el puesto con empates compartidos (1, 2, 2, 4…); `value`,
-- los puntos o los milisegundos.

create function private.page_limit(p_limit integer) returns integer
language sql immutable
set search_path = ''
as $$
  select least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

create function private.ranking_points(p_all boolean, p_season uuid, p_limit integer, p_offset integer)
returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  with base as (
    select c.user_id, c.nickname, c.member_number, c.is_artist,
           coalesce(case when p_all then pb.points else sp.points end, 0)::bigint as value
    from public.carnets c
    left join public.point_balances pb on pb.user_id = c.user_id
    left join public.season_points sp on sp.user_id = c.user_id and sp.season_id = p_season
  ), ranked as (
    select b.*,
           rank() over (order by b.value desc) as position,
           row_number() over (order by b.value desc, b.member_number asc) as ord
    from base b
  ), lim as (
    select private.page_limit(p_limit) as l, greatest(coalesce(p_offset, 0), 0) as o
  )
  select jsonb_build_object(
    'total', (select count(*) from ranked),
    'limit', lim.l,
    'offset', lim.o,
    'season_id', case when p_all then null else p_season end,
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object('position', r.position, 'user_id', r.user_id, 'nickname', r.nickname,
                           'member_number', r.member_number, 'is_artist', r.is_artist,
                           'value', r.value, 'is_mine', coalesce(r.user_id = (select auth.uid()), false))
        order by r.ord)
      from ranked r where r.ord > lim.o and r.ord <= lim.o + lim.l
    ), '[]'::jsonb),
    'mine', (
      select jsonb_build_object('position', r.position, 'user_id', r.user_id, 'nickname', r.nickname,
                                'member_number', r.member_number, 'is_artist', r.is_artist,
                                'value', r.value, 'is_mine', true)
      from ranked r where r.user_id = (select auth.uid())
    )
  )
  from lim
$$;

create function private.ranking_race(
  p_circuit text, p_version integer, p_limit integer, p_offset integer
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
    select max(c.version) into v from public.circuits c where c.id = p_circuit and c.is_active;
  end if;
  if v is null or not exists (select 1 from public.circuits c where c.id = p_circuit and c.version = v) then
    raise exception 'unknown_circuit' using detail = format('Circuito desconocido: %s', p_circuit);
  end if;
  with base as (
    select c.user_id, c.nickname, c.member_number, c.is_artist, t.best_ms::bigint as value, t.best_at
    from public.race_times t
    join public.carnets c on c.user_id = t.user_id
    where t.circuit_id = p_circuit and t.circuit_version = v and t.voided_at is null
  ), ranked as (
    select b.*,
           rank() over (order by b.value asc) as position,
           row_number() over (order by b.value asc, b.best_at asc, b.member_number asc) as ord
    from base b
  ), lim as (
    select private.page_limit(p_limit) as l, greatest(coalesce(p_offset, 0), 0) as o
  )
  select jsonb_build_object(
    'total', (select count(*) from ranked),
    'limit', lim.l,
    'offset', lim.o,
    'circuit', p_circuit,
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

create function public.ranking_points(p_limit integer default 50, p_offset integer default 0)
returns jsonb
language sql stable
set search_path = ''
as $$
  select private.ranking_points(true, null, p_limit, p_offset)
$$;

-- Sin temporada, la activa (sin temporada activa, todos a 0 y season_id null).
create function public.ranking_season(
  p_season uuid default null, p_limit integer default 50, p_offset integer default 0
) returns jsonb
language sql stable
set search_path = ''
as $$
  select private.ranking_points(
    false, coalesce(p_season, (select s.id from public.seasons s where s.is_active)), p_limit, p_offset)
$$;

-- Sin versión, la más alta activa del circuito.
create function public.ranking_race(
  p_circuit text, p_version integer default null, p_limit integer default 50, p_offset integer default 0
) returns jsonb
language sql stable
set search_path = ''
as $$
  select private.ranking_race(p_circuit, p_version, p_limit, p_offset)
$$;

revoke all on function private.page_limit(integer) from public;
revoke all on function private.ranking_points(boolean, uuid, integer, integer) from public;
revoke all on function private.ranking_race(text, integer, integer, integer) from public;
grant execute on function private.page_limit(integer) to anon, authenticated;
grant execute on function private.ranking_points(boolean, uuid, integer, integer) to anon, authenticated;
grant execute on function private.ranking_race(text, integer, integer, integer) to anon, authenticated;

revoke all on function public.ranking_points(integer, integer) from public;
revoke all on function public.ranking_season(uuid, integer, integer) from public;
revoke all on function public.ranking_race(text, integer, integer, integer) from public;
grant execute on function public.ranking_points(integer, integer) to anon, authenticated;
grant execute on function public.ranking_season(uuid, integer, integer) to anon, authenticated;
grant execute on function public.ranking_race(text, integer, integer, integer) to anon, authenticated;
