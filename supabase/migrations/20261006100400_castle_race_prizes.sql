-- Los premios del castillo y de la carrera (plan 015 T176, decisión 16).
-- Escrita y probada en local; NO aplicada a ningún proyecto (lo hace Hernán).
--
-- 1. Los tres cosméticos nuevos (T175) en el catálogo, cada uno con el logro
--    que lo regala: al reclamarlo (`award`, acción `achievement` con el id del
--    logro) la base concede el cosmético (`unlock_achievement`), como el
--    minikraken de `canon-kraken`. No se venden. Son `muestra` (is_sample:
--    `supabase/sample/remove-sample.sql` los retira con lo demás); los mismos
--    que `SAMPLE_COSMETICS` de @boia/store y que la siembra
--    `seeds/20261003100100_economy.sql`.
--      castillo-tormenta → mascota-canoncito
--      castillo-vortice  → estela-vortice
--      regata-rapida     → mascota-tortuga-turbo
--    Los premios de los logros (puntos y monedas, `muestra`) caben en el tope
--    de la acción `achievement` (300 puntos y 50 monedas por logro).
-- 2. La copia de cada cuenta (`account_snapshots`) gana las huellas de las
--    partidas del castillo ya ganadas, como la migración v9 → v10 del
--    documento del navegador: cada par duración × dificultad con plata u oro
--    guardada (`player.counters."castillo:<min>-<dificultad>:medalla"` ≥ 2)
--    deja `minijuego:castillo`, `minijuego:castillo:<dificultad>` y
--    `minijuego:castillo:<dificultad>:<min>` en `player.discoveries`. Las que
--    ya estaban no se tocan. El libro no cambia.

insert into public.cosmetics
  (id, name, slot, price_coins, unlock_points, unlock_achievement, unlock_mission, for_ship, base, is_sample)
values
  ('mascota-canoncito', 'Cañoncito', 'mascot', null, null, 'castillo-tormenta', null, null, false, true),
  ('mascota-tortuga-turbo', 'Tortuga turbo', 'mascot', null, null, 'regata-rapida', null, null, false, true),
  ('estela-vortice', 'Estela del vórtice', 'wake', null, null, 'castillo-vortice', null, null, false, true)
on conflict (id) do update set unlock_achievement = excluded.unlock_achievement;

with won as (
  select distinct s.user_id, k.key
  from public.account_snapshots s
  cross join (values (5), (7), (10)) as m (run_min)
  cross join (values ('tranquila'), ('normal'), ('tormenta')) as d (difficulty)
  cross join lateral (values
    ('minijuego:castillo'),
    ('minijuego:castillo:' || d.difficulty),
    ('minijuego:castillo:' || d.difficulty || ':' || m.run_min)
  ) as k (key)
  where jsonb_typeof(s.data #> '{player,discoveries}') = 'object'
    and jsonb_typeof(
      s.data #> array['player', 'counters', format('castillo:%s-%s:medalla', m.run_min, d.difficulty)]
    ) = 'number'
    and (
      s.data #>> array['player', 'counters', format('castillo:%s-%s:medalla', m.run_min, d.difficulty)]
    )::numeric >= 2
),
found as (
  select w.user_id,
         jsonb_object_agg(
           w.key,
           jsonb_build_object(
             'at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             'worldId', null
           )
         ) as keys
  from won w
  group by w.user_id
)
update public.account_snapshots s
set data = jsonb_set(s.data, '{player,discoveries}', f.keys || (s.data #> '{player,discoveries}')),
    updated_at = now()
from found f
where f.user_id = s.user_id;
