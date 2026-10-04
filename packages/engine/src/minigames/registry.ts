import { faro } from './faro';
import type { BaseConfig, MinigameDefinition, MinigameEntry, MinigameId } from './types';
import { isLayerMinigame } from './types';
import { canon } from './world-canon';

/**
 * Registro de INICIAR_MINIJUEGO (REQ-MUN-026, D-20): `start_minigame` con
 * `gameId` `faro` o `canon`. Se pasa al motor como `runtime.minigames` para
 * que el evento `minigame` llegue con `available: true`.
 *
 * El Faro se juega en la capa 2D (`mountMinigame`); el Cañón, desde el plan
 * 010, en el propio mar de `/mar`: aquí sólo queda su id, su sesión, su
 * validación y su premio (`world-canon.ts`), nunca se monta en la capa.
 */
export const MINIGAME_REGISTRY: ReadonlyMap<string, MinigameEntry<BaseConfig>> = new Map<
  string,
  MinigameEntry<BaseConfig>
>([
  ['faro', faro as unknown as MinigameEntry<BaseConfig>],
  ['canon', canon as unknown as MinigameEntry<BaseConfig>],
]);

export const MINIGAME_IDS: readonly MinigameId[] = ['faro', 'canon'];

export function isMinigameId(v: unknown): v is MinigameId {
  return typeof v === 'string' && (MINIGAME_IDS as readonly string[]).includes(v);
}

export function minigame(id: string): MinigameEntry<BaseConfig> | null {
  return MINIGAME_REGISTRY.get(id) ?? null;
}

/** El minijuego `id` si se juega en la capa 2D (el Faro); si no, null. */
export function layerMinigame(id: string): MinigameDefinition<BaseConfig> | null {
  const def = minigame(id);
  return def && isLayerMinigame(def) ? def : null;
}
