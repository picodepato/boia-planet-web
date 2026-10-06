-- La Vigilancia del faro sale de la web (plan 014 T157, decisión 2 del 2026-10-05).
-- Escrita y probada en local; NO aplicada a ningún proyecto (lo hace Hernán).
--
-- Quien ganó su logro («Vigía del faro», `faro`) no lo conserva:
-- 1. La copia de cada cuenta (`account_snapshots`, la que viaja con
--    `save_snapshot`) pierde el logro completado (`player.achievements.faro`)
--    y la huella de la victoria (`player.discoveries."minijuego:faro"`), como
--    la migración v8 → v9 del documento del navegador (`packages/store`). El
--    navegador también los quita al hidratar una copia que aún los tenga.
-- 2. El libro no se toca: es historia. Lo cobrado (la fila `world_reward` de
--    la acción `achievement` con origen `faro`, y los premios `minigame:faro`)
--    sigue sumando; el repositorio ya no enseña el logro retirado.
-- 3. La acción `minigame` deja de nombrar el faro en su descripción; su patrón
--    de origen no cambia (lo cobrado con `minigame:faro` sigue siendo válido).

update public.account_snapshots
set data = jsonb_set(data, '{player,achievements}', (data #> '{player,achievements}') - 'faro')
where jsonb_typeof(data #> '{player,achievements}') = 'object'
  and (data #> '{player,achievements}') ? 'faro';

update public.account_snapshots
set data = jsonb_set(data, '{player,discoveries}', (data #> '{player,discoveries}') - 'minijuego:faro')
where jsonb_typeof(data #> '{player,discoveries}') = 'object'
  and (data #> '{player,discoveries}') ? 'minijuego:faro';

update public.point_actions
set description = 'Partida ganada de un minijuego o medalla del Cañón (bronce, plata, oro).'
where action = 'minigame';
