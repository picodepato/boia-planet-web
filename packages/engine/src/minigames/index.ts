/**
 * Minijuegos de INICIAR_MINIJUEGO (REQ-AVE-035…039, D-20): Vigilancia del
 * faro (`faro`, capa 2D, rehecho en T60) y el Cañón «Que no pare la música»
 * (`canon`), que desde el plan 010 se juega en el mar de `/mar` con
 * `@boia/engine/survivors`: aquí sólo su sesión y su premio
 * (`WorldMinigameSession`). Se importa como `@boia/engine/minigames`: sin
 * Pixi, para que la capa HTML no arrastre el motor del mar.
 * `MINIGAME_REGISTRY` va al motor como `runtime.minigames`; `mountMinigame`
 * abre la capa del Faro sobre el mar.
 */
export * from './types';
export { MINIGAME_IDS, MINIGAME_REGISTRY, isMinigameId, layerMinigame, minigame } from './registry';
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
  CANON_VERSION,
  canon,
  canonConfigFor,
  canonEnd,
  canonOutcome,
  canonEarliestWinS,
  canonScore,
  type CanonConfig,
} from './world-canon';
export {
  WorldMinigameSession,
  type WorldGameEnd,
  type WorldSessionOptions,
  type WorldSettlement,
} from './world-session';
export {
  INVALID_TEXT,
  LocalSessionAuthority,
  type InvalidReason,
  type MinigameResult,
  type MinigameSession,
  type OpenOptions,
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
