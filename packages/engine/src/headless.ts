/**
 * El mar sin Pixi ni DOM (mar 3D): el runtime de comportamientos del mundo y
 * la física del barco, para vistas que no son la de Pixi. Se importa como
 * `@boia/engine/headless`; así /mar no arrastra el motor 2D.
 */
export type { WorldEvent, WorldEventType } from './world/events';
export {
  WorldRuntime,
  type DialogueView,
  type ObjectRuntimeState,
  type RuntimeOptions,
} from './world/runtime';
export { MemoryRewardStore, type RewardStore } from './world/rewards';
export { DEFAULT_SHIP_CONFIG, type ShipConfig } from './ship/config';
export {
  IDLE_INPUT,
  createShipState,
  shipSpeed,
  stepShip,
  type CircleObstacle,
  type ShipInput,
  type ShipState,
} from './ship/controller';
// Cambio de mundo por agujero negro (T41), sin Pixi: el reloj y quién cambia
// el mundo. /mar pinta el mismo vórtice con three.js (T51).
export {
  FADE_MS,
  IDLE_POSE,
  SwitchTimeline,
  VORTEX_IN_MS,
  VORTEX_OUT_MS,
  vortexPose,
  type SwitchMode,
  type SwitchPhase,
  type VortexPose,
} from './transition/timeline';
export { WorldSwitcher, type SwitchScene, type SwitcherHooks } from './transition/switcher';
