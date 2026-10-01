/**
 * Minijuegos de INICIAR_MINIJUEGO (REQ-AVE-035…039, D-20): Vigilancia del
 * faro (`faro`) y Cañón contra tiburones (`canon`), rehechos en T60. Se importa como
 * `@boia/engine/minigames`: sin Pixi, para que la capa HTML no arrastre el
 * motor del mar. `MINIGAME_REGISTRY` va al motor como `runtime.minigames`;
 * `mountMinigame` abre la capa sobre el mar.
 */
export * from './types';
export { MINIGAME_IDS, MINIGAME_REGISTRY, isMinigameId, minigame } from './registry';
export {
  COAST_Y,
  FARO_DEFAULTS,
  FaroSim,
  LAMP,
  faro,
  faroMinPlausibleMs,
  faroMultiplier,
  faroPlan,
  faroWave,
  type FaroConfig,
  type FaroKind,
  type FaroShip,
} from './faro';
export {
  CANON_DEFAULTS,
  COAST_X,
  CanonSim,
  MUZZLE,
  WATER_Y,
  aimFromPull,
  ballAt,
  canon,
  canonMinPlausibleMs,
  canonMultiplier,
  canonPlan,
  canonShot,
  canonWave,
  powerFor,
  pullFor,
  type CanonConfig,
  type CanonFoe,
  type Shot,
} from './canon';
export {
  INVALID_TEXT,
  LocalSessionAuthority,
  type InvalidReason,
  type MinigameResult,
  type MinigameSession,
  type Validation,
} from './session';
export {
  RECORDS_KEY,
  grantMinigameReward,
  minigameSourceRef,
  policyText,
  readBest,
  rewardText,
  saveBest,
  type MinigameRewardSink,
  type RewardOutcome,
} from './rewards';
export { MinigameController, STEP_S, type EndSummary, type Phase } from './controller';
export { minigameSkin, type WorldLook } from './skin';
export { mountMinigame, pageAuthority, type MountOptions, type MountedMinigame } from './host';
export { configHash } from './rng';
