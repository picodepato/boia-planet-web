import type { IntroConfig, IntroPoints, WorldIntro } from '@boia/engine/intro';
import { type WorldIntroSetup, worldIntroSetup } from '@boia/engine/intro/world-geometry';
import type { PlacePatch } from '@boia/store';
import type { SharedMap, WorldConfig } from '@boia/world';
import { mapPoint } from '../admin/world';

/**
 * La entrada de cada mundo (T28, D-20 punto 6; REQ-ENT-012, 015): cómo
 * aterriza y cómo EXPLORAR descubre su puerto. Son datos, como la
 * configuración de la entrada: un mundo sin entrada propia usa la de
 * `DEFAULT_WORLD_INTRO`. Los puntos (aterrizaje, salida, puerto) no van aquí:
 * son del mapa compartido y el Admin los mueve (`mapa:entrada`,
 * `mapa:salida`, `mapa:puerto`, T26).
 *
 * muestra: zoom, anclas, tamaño del mini-mundo y duración, hasta verlo con
 * Hernán y Álvaro en móviles reales.
 */
export const DEFAULT_WORLD_INTRO: WorldIntro = {
  // Llegada algo más cerca que el juego (que va a 1): EXPLORAR se aleja un
  // poco, menos que las primeras versiones, hasta el encuadre del juego.
  arrival: [
    { minWidth: 0, zoom: 1.3, anchor: [0.5, 0.3] },
    { minWidth: 900, zoom: 1.45, anchor: [0.5, 0.34] },
  ],
  // El puerto y su mar: un mini-mundo de 2400 u de lado; se carga lo que hay
  // a 2600 u (lo que enseña la cámara del juego al empezar, también en escritorio).
  miniWorld: { span: 2400, reach: 2600 },
  explore: { durationMs: 1300, easing: 'easeInOutSine' },
};

export const WORLD_INTROS: Readonly<Record<string, WorldIntro>> = {
  // El Varadero: el aterrizaje cae en la bocana, entre las balizas.
  arcilla: DEFAULT_WORLD_INTRO,
  // La Explanada (T24): el mismo mapa, así que el mismo aterrizaje en la
  // bocana y el mismo encuadre del puerto; sólo cambian el arte y el mar.
  acuarela: DEFAULT_WORLD_INTRO,
};

export function worldIntroFor(worldId: string): WorldIntro {
  return WORLD_INTROS[worldId] ?? DEFAULT_WORLD_INTRO;
}

/** Aterrizaje, salida y puerto del mapa, con lo que dejó el Admin de la demo. */
export function introPoints(
  map: SharedMap,
  places: Readonly<Record<string, PlacePatch>> = {},
): IntroPoints {
  const spawn = mapPoint(map, 'spawn', places)!;
  const landing = mapPoint(map, 'introLanding', places)!;
  return {
    landing,
    spawn: { ...spawn, heading: map.spawn.heading },
    port: mapPoint(map, 'port', places) ?? spawn,
  };
}

/** La entrada de un mundo ya compuesto (con los cambios del Admin, si los hay). */
export function introForWorld(
  worldId: string,
  world: WorldConfig,
  map: SharedMap,
  places: Readonly<Record<string, PlacePatch>>,
  base: IntroConfig,
  artScale: number,
): WorldIntroSetup | null {
  return worldIntroSetup(world, base, worldIntroFor(worldId), introPoints(map, places), artScale);
}
