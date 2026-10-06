/**
 * Minijuegos de INICIAR_MINIJUEGO (REQ-AVE-035…039, D-20): el Cañón «Que no
 * pare la música» (`canon`), que desde el plan 010 se juega en el mar de
 * `/mar` con `@boia/engine/survivors`: aquí sólo su sesión y su premio
 * (`WorldMinigameSession`). La capa 2D del minijuego del faro se quitó en
 * el plan 014 (T157). Se importa como `@boia/engine/minigames`, sin el motor
 * del mar. `MINIGAME_REGISTRY` va al motor como `runtime.minigames`.
 */
export * from './types';
export { MINIGAME_IDS, MINIGAME_REGISTRY, isMinigameId, minigame } from './registry';
export {
  CANON_DEFAULTS,
  CANON_MEDAL_PRIZES,
  CANON_VERSION,
  canon,
  canonConfigFor,
  canonEnd,
  canonOutcome,
  canonEarliestWinS,
  canonReward,
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
  pageAuthority,
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
  minigameTierRef,
  policyText,
  readBest,
  rewardText,
  saveBest,
  type MinigameRewardSink,
  type RewardOutcome,
} from './rewards';
export { configHash } from './rng';
