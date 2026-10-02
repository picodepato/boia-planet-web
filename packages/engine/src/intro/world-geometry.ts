import { type WorldConfig, worldToScreen } from '@boia/world';
import type { IntroConfig } from './config';
import {
  introConfigForWorld,
  portReveal,
  type IntroPoints,
  type PortReveal,
  type WorldIntro,
} from './port';
import { introGeometry, type IntroGeometry } from './sphere';

/**
 * Geometría de la esfera para un mundo (`@boia/world`). Aparte del punto de
 * entrada puro (`@boia/engine/intro`) porque arrastra `@boia/world` (y zod):
 * la web la llama al construir la página y al cargar la escena, fuera de la
 * ruta crítica.
 *
 * Devuelve `null` si el punto de aterrizaje de la configuración cae fuera
 * del mundo: entonces la entrada no se juega y sale la landing ligera.
 *
 * Con `span`, el mini-mundo no es el mapa entero sino un cuadrado de `span`
 * u de lado centrado en el aterrizaje (T28): un mapa como el de Arcilla
 * (decenas de miles de u) no cabe en una textura con detalle, ni su arte en
 * lo que tarda la entrada en cargar.
 */
export function worldIntroGeometry(
  world: WorldConfig,
  config: IntroConfig,
  artScale: number,
  span?: number,
): IntroGeometry | null {
  const b = world.bounds;
  const p = config.landingPoint;
  if (p.x < b.left || p.x > b.right || p.y < b.top || p.y > b.bottom) return null;
  const area =
    span === undefined
      ? b
      : {
          left: p.x - span / 2,
          right: p.x + span / 2,
          top: p.y - span / 2,
          bottom: p.y + span / 2,
        };
  const top = worldToScreen({ x: area.left, y: area.top });
  const bottom = worldToScreen({ x: area.right, y: area.bottom });
  return introGeometry({
    artScale,
    box: { left: top.x, right: bottom.x, top: top.y, bottom: bottom.y },
    landing: worldToScreen(p),
  });
}

/** Todo lo que la entrada de un mundo necesita (T28). */
export interface WorldIntroSetup {
  /** La configuración con el aterrizaje, el encuadre de llegada y el barco del mundo. */
  config: IntroConfig;
  geometry: IntroGeometry;
  /** EXPLORAR: del aterrizaje al puerto. */
  reveal: PortReveal;
  /** El mundo con sólo los objetos cerca del aterrizaje y de la salida (lo que se ve). */
  world: WorldConfig;
}

const inside = (w: WorldConfig, p: { x: number; y: number }) =>
  p.x >= w.bounds.left && p.x <= w.bounds.right && p.y >= w.bounds.top && p.y <= w.bounds.bottom;

/**
 * Lo que la entrada pinta: los objetos a `reach` (o a medio mini-mundo) del
 * aterrizaje o de la salida, y sólo las costas que caen tan cerca (en
 * Arcilla, el paseo del puerto: las laterales quedan a miles de u).
 */
export function nearbyWorld(
  world: WorldConfig,
  intro: WorldIntro,
  points: IntroPoints,
): WorldConfig {
  const r = Math.max(intro.miniWorld.span / 2, intro.miniWorld.reach);
  const ps = [points.landing, points.spawn];
  const near = (o: WorldConfig['objects'][number]) =>
    ps.some((p) => Math.abs(o.position.x - p.x) <= r && Math.abs(o.position.y - p.y) <= r);
  const { coast, ...rest } = world;
  const b = world.bounds;
  let nearCoast = coast;
  if (coast && !coast.asset) {
    const left = ps.some((p) => p.x - r <= b.left);
    const right = ps.some((p) => p.x + r >= b.right);
    const bottom = ps.some((p) => p.y + r >= b.bottom);
    const picked = {
      ...(left && coast.west ? { west: coast.west } : {}),
      ...(right && coast.east ? { east: coast.east } : {}),
      ...(bottom && coast.south ? { south: coast.south } : {}),
      ...(left && bottom && coast.cornerWest ? { cornerWest: coast.cornerWest } : {}),
      ...(right && bottom && coast.cornerEast ? { cornerEast: coast.cornerEast } : {}),
    };
    nearCoast = Object.keys(picked).length > 0 ? picked : undefined;
  }
  return {
    ...rest,
    ...(nearCoast ? { coast: nearCoast } : {}),
    objects: world.objects.filter(near),
  };
}

/**
 * La entrada de un mundo: aterriza en su punto, se enrolla su trozo de mapa y,
 * al explorar, se aleja hasta el puerto con el barco en la salida. `null` si
 * el aterrizaje o la salida caen fuera del mundo.
 */
export function worldIntroSetup(
  world: WorldConfig,
  base: IntroConfig,
  intro: WorldIntro,
  points: IntroPoints,
  artScale: number,
): WorldIntroSetup | null {
  if (!inside(world, points.spawn)) return null;
  const config = introConfigForWorld(base, intro, points, worldToScreen);
  const geometry = worldIntroGeometry(world, config, artScale, intro.miniWorld.span);
  if (!geometry) return null;
  return {
    config,
    geometry,
    reveal: portReveal(intro, points, world.bounds.bottom, worldToScreen),
    world: nearbyWorld(world, intro, points),
  };
}
