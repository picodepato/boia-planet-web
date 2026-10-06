import type { BaseConfig, MinigameEntry, MinigameId } from './types';
import { canon } from './world-canon';

/**
 * Registro de INICIAR_MINIJUEGO (REQ-MUN-026, D-20): `start_minigame` con
 * `gameId` `canon`. Se pasa al motor como `runtime.minigames` para que el
 * evento `minigame` llegue con `available: true`.
 *
 * El Cañón se juega, desde el plan 010, en el propio mar de `/mar`: aquí
 * sólo queda su id, su sesión, su validación y su premio (`world-canon.ts`).
 * El minijuego del faro (capa 2D) se quitó en el plan 014 (T157); el
 * Castillo («Defensa del Castillo», `castillo`) entra cuando T162 lo conecte.
 */
export const MINIGAME_REGISTRY: ReadonlyMap<string, MinigameEntry<BaseConfig>> = new Map<
  string,
  MinigameEntry<BaseConfig>
>([['canon', canon as unknown as MinigameEntry<BaseConfig>]]);

export const MINIGAME_IDS: readonly MinigameId[] = ['canon'];

export function isMinigameId(v: unknown): v is MinigameId {
  return typeof v === 'string' && (MINIGAME_IDS as readonly string[]).includes(v);
}

export function minigame(id: string): MinigameEntry<BaseConfig> | null {
  return MINIGAME_REGISTRY.get(id) ?? null;
}
