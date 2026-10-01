import type { BoiaRepository } from '@boia/store';
import type { ComposedWorld, WorldRegistry } from '@boia/world';
import { refreshLiveContent } from '../landing/live-content';
import { composeLiveWorld } from './world';

/**
 * El mundo que se juega en el 2D con lo que dejó el Admin de la demo (T26):
 * lugares movidos, desactivados u ocultos, nombres y textos por mundo y cada
 * isla con su evento, los códigos escondidos donde los dejó (T43) y el
 * destino de la Fiestera para las partidas nuevas de ese mundo (T45). Deja
 * además el contenido (eventos) a mano en `liveContent()`. Si algo guardado ya no compone un mundo válido, se juega
 * el mundo sin cambios (y se avisa en la consola).
 */
export async function liveWorld(
  repo: BoiaRepository,
  registry: WorldRegistry,
  world: ComposedWorld,
): Promise<ComposedWorld> {
  try {
    const [places, skins, content, discounts, missionDestinations] = await Promise.all([
      repo.content.places(),
      repo.content.skins(),
      refreshLiveContent(repo),
      repo.content.list('discounts'),
      repo.content.missionDestinations(),
    ]);
    return composeLiveWorld(registry, world.id, {
      places,
      skins,
      events: content.events,
      discounts,
      missionDestinations,
    });
  } catch (err) {
    console.warn('[boia] cambios del Admin sin aplicar al mundo', err);
    return world;
  }
}
