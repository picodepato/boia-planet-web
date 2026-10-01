import type { IntroConfig } from '@boia/engine/intro';
import type { WorldIntroSetup } from '@boia/engine/intro/world-geometry';
import { requestedShipStyle } from '@boia/engine/ui';
import type { SeaPalette } from '@boia/world';
import { worlds } from '../mundo/demo-world';
import { gameRepository } from '../mundo/repo';
import { adminWorldId, currentWorld } from '../mundo/world-choice';
import { liveWorld } from '../admin/live-world';
import { introForWorld } from './worlds';

/**
 * Sólo navegador: la entrada del mundo que se va a jugar en /juego (T28). La
 * página estática trae la del mundo por defecto; aquí se mira el de este
 * navegador (`?mundo=`, el elegido, el activo del Admin) con los cambios del
 * Admin de la demo (aterrizaje, salida y puerto movidos), para que EXPLORAR
 * deje el barco justo donde el juego lo pone.
 */
export interface ActiveIntro extends WorldIntroSetup {
  worldId: string;
  sea: SeaPalette;
  /** Estilo del barco que llevará el juego: el pedido o el del mundo. */
  shipStyle: string;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function activeIntro(
  search: string,
  base: IntroConfig,
  artScale: number,
): Promise<ActiveIntro | null> {
  const repo = gameRepository();
  const chosen = currentWorld(search, await adminWorldId());
  const [live, places] = await Promise.all([
    liveWorld(repo, worlds, chosen),
    repo.content.places().catch(() => ({})),
  ]);
  const setup = introForWorld(live.id, live.config, worlds.map, places, base, artScale);
  if (!setup) return null;
  return {
    ...setup,
    worldId: live.id,
    sea: live.theme.sea,
    shipStyle: requestedShipStyle(search, storage()) ?? live.theme.ship.style,
  };
}
