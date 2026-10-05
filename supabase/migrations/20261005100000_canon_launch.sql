-- El Cañón «Que no pare la música», versión definitiva (plan 013 T153).
-- Escrita y probada en local; NO aplicada a ningún proyecto (lo hace Hernán).
--
-- 1. Condiciones de logro: el enum `achievement_trigger` gana las del catálogo
--    aprobado de T36 (que hasta ahora sólo existían en el navegador) y las dos
--    del Cañón: `play_minigame` (jugar una partida) y `defeat_boss` (vencer a
--    un boss). Mismo orden que `ACHIEVEMENT_TRIGGERS_DB` de @boia/contracts.
-- 2. Premio por medalla: cada medalla del Cañón se cobra una vez al día por
--    separado, con su origen `minigame:canon:bronce|plata|oro` y la política
--    `daily` (la clave queda `minigame:canon:oro@2026-10-05`). El premio de la
--    beta (`minigame:canon`, una vez por temporada) deja de pedirse; lo ya
--    cobrado sigue en el libro. Cantidades `muestra` (bronce 30 + 10, plata
--    60 + 20, oro 100 + 40): caben en el tope por acción (150 + 50) y, con el
--    Faro (150 + 50 al día), en el tope diario (450 + 150).
-- 3. Ranura `mascot` en el catálogo de cosméticos, para que el logro
--    `canon-kraken` deje en el libro la mascota minikraken (la siembra
--    `seeds/20261003100100_economy.sql`, como la bandera fantasma de
--    `canon-fantasma`). Equiparla (`equipped_cosmetics`, `equip_cosmetic`) es
--    de T154.

alter type public.achievement_trigger add value if not exists 'win_minigame';
alter type public.achievement_trigger add value if not exists 'complete_encounter';
alter type public.achievement_trigger add value if not exists 'read_bottle';
alter type public.achievement_trigger add value if not exists 'throw_bottle';
alter type public.achievement_trigger add value if not exists 'create_carnet';
alter type public.achievement_trigger add value if not exists 'answer_question';
alter type public.achievement_trigger add value if not exists 'visit_world';
alter type public.achievement_trigger add value if not exists 'play_minigame';
alter type public.achievement_trigger add value if not exists 'defeat_boss';

update public.point_actions
set description = 'Partida ganada de un minijuego (faro) o medalla del Cañón (bronce, plata, oro).',
    ref_pattern = '^minigame:[a-z0-9_-]+(:(bronce|plata|oro))?$'
where action = 'minigame';

alter table public.cosmetics drop constraint if exists cosmetics_slot_check;
alter table public.cosmetics add constraint cosmetics_slot_check
  check (slot in ('flag', 'accessory', 'skin', 'wake', 'ship', 'mascot'));
