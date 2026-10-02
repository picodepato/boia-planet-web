import { type CoastArt, type Rect, artFrames, worldToScreen } from '@boia/world';
import { Container, Graphics, Sprite, type Texture, TilingSprite } from 'pixi.js';
import { drawCoasts } from '../views';
import { type FrameLoader, type LoadedArt, loadFrames } from './assets';

/** u de tierra que se pintan más allá de los límites. */
const FAR = 4000;

function hex(color: string): number {
  return Number.parseInt(color.slice(1), 16);
}

/**
 * Costas laterales con el arte de T01 (losas que se repiten en vertical): la
 * línea `collision_x_px` de cada losa cae exactamente sobre el límite del
 * mundo, donde el casco se para. Más allá, el color de tierra del manifiesto.
 * El borde inferior (T01 no tiene costa inferior) y la marca del borde
 * superior abierto se dibujan por código. Sin arte, todo por código.
 */
export async function createCoastView(
  bounds: Rect,
  coast: LoadedArt | undefined,
  artScale: number,
  load: FrameLoader = loadFrames,
): Promise<Container> {
  const variants = coast?.manifest.tile?.variants;
  const sides = variants ? Object.values(variants) : [];
  if (!coast || sides.length === 0) return drawCoasts(bounds);

  const view = new Container();
  const top = worldToScreen({ x: 0, y: bounds.top - FAR }).y;
  const bottom = worldToScreen({ x: 0, y: bounds.bottom }).y;
  const land = new Graphics();
  view.addChild(land);
  let fill = 0xb1d181;

  try {
    for (const v of sides) {
      const [texture] = await load(coast, [v.file]);
      if (!texture) continue;
      fill = hex(v.outer_fill);
      const edge = v.land_side === 'left' ? bounds.left : bounds.right;
      const x = edge - v.collision_x_px * artScale;
      const w = texture.width * artScale;
      const tile = new TilingSprite({
        texture,
        width: texture.width,
        height: (bottom - top) / artScale,
      });
      tile.scale.set(artScale);
      tile.position.set(x, top);
      view.addChild(tile);
      // Tierra más allá de la losa (1 px de solape para que no quede costura).
      if (v.land_side === 'left') land.rect(x - FAR, top, FAR + 1, bottom - top);
      else land.rect(x + w - 1, top, FAR, bottom - top);
      land.fill({ color: fill });
    }
  } catch (err) {
    console.warn('[boia] costas sin arte; se dibujan por código', err);
    return drawCoasts(bounds);
  }

  // Borde inferior: orilla clara y tierra.
  const g = new Graphics();
  const l = bounds.left - FAR;
  const r = bounds.right + FAR;
  g.rect(l, bottom, r - l, FAR).fill({ color: fill });
  g.rect(l, bottom, r - l, 6).fill({ color: 0xf6e6c4 });
  // Borde superior publicado: abierto, sólo una marca tenue.
  const a = worldToScreen({ x: bounds.left, y: bounds.top });
  const b = worldToScreen({ x: bounds.right, y: bounds.top });
  for (let x = a.x; x < b.x; x += 28) g.moveTo(x, a.y).lineTo(Math.min(x + 14, b.x), a.y);
  g.stroke({ width: 2, color: 0xffffff, alpha: 0.25 });
  view.addChild(g);
  return view;
}

/**
 * Costas del mundo según su arte (`WorldConfig.coast`). Con `asset`, las losas
 * de T01 (`createCoastView`). Con piezas de lugar de T18 (`west`, `east`,
 * `south` y las esquinas), `createStripCoastView`. Sin arte, por código.
 */
export async function createWorldCoastView(
  bounds: Rect,
  coast: CoastArt | undefined,
  art: ReadonlyMap<string, LoadedArt>,
  artScale: number,
  load: FrameLoader = loadFrames,
): Promise<Container> {
  if (!coast) return drawCoasts(bounds);
  if (coast.asset) return createCoastView(bounds, art.get(coast.asset), artScale, load);
  const get = (id: string | undefined) => (id ? art.get(id) : undefined);
  const sides = {
    west: get(coast.west),
    east: get(coast.east),
    south: get(coast.south),
    cornerWest: get(coast.cornerWest),
    cornerEast: get(coast.cornerEast),
  };
  if (!sides.west && !sides.east && !sides.south) return drawCoasts(bounds);
  try {
    return await createStripCoastView(bounds, sides, artScale, load);
  } catch (err) {
    console.warn('[boia] costas sin arte; se dibujan por código', err);
    return drawCoasts(bounds);
  }
}

async function stillTexture(a: LoadedArt, load: FrameLoader): Promise<Texture | null> {
  const file = artFrames(a.manifest).files[0];
  if (!file) return null;
  const [t] = await load(a, [file]);
  return t ?? null;
}

/**
 * Costas de losas de T18: laterales (eje y) y paseo (eje x) que se repiten,
 * con la línea `collision_px` de cada losa sobre el límite del mundo, y dos
 * esquinas encima, con el pivote en el cruce de las líneas de costa de
 * mapa.json. Las laterales terminan justo en el borde de arriba de su
 * esquina (en fase, como en la maqueta); el paseo va en fase con x = 0.
 */
export async function createStripCoastView(
  bounds: Rect,
  sides: {
    west?: LoadedArt | undefined;
    east?: LoadedArt | undefined;
    south?: LoadedArt | undefined;
    cornerWest?: LoadedArt | undefined;
    cornerEast?: LoadedArt | undefined;
  },
  artScale: number,
  load: FrameLoader = loadFrames,
): Promise<Container> {
  const view = new Container();
  const land = new Graphics();
  const tiles = new Container();
  const corners = new Container();
  view.addChild(land, tiles, corners);
  const top = worldToScreen({ x: 0, y: bounds.top - FAR }).y;
  const bottom = worldToScreen({ x: 0, y: bounds.bottom }).y;
  const L = bounds.left - FAR;
  const R = bounds.right + FAR;
  const floor = bottom + FAR;

  // Paseo (abajo).
  let southLine = bottom;
  let southFill = 0xb7aa97;
  const s = sides.south?.manifest.strip;
  const sTex = sides.south && s ? await stillTexture(sides.south, load) : null;
  if (s && sTex) {
    southFill = hex(s.outer_fill);
    const tileTop = bottom - s.collision_px * artScale;
    southLine = tileTop + s.map_line_px * artScale;
    const period = s.period_px * artScale;
    const x0 = Math.floor(L / period) * period;
    const tile = new TilingSprite({
      texture: sTex,
      width: (R - x0) / artScale,
      height: sTex.height,
    });
    tile.scale.set(artScale);
    tile.position.set(x0, tileTop);
    tiles.addChild(tile);
    land.rect(L, tileTop + sTex.height * artScale - 1, R - L, FAR).fill({ color: southFill });
  } else {
    land.rect(L, bottom, R - L, FAR).fill({ color: southFill });
    land.rect(L, bottom, R - L, 6).fill({ color: 0xf6e6c4 });
  }

  // Laterales y esquinas.
  for (const side of ['west', 'east'] as const) {
    const a = sides[side];
    const strip = a?.manifest.strip;
    const tex = a && strip ? await stillTexture(a, load) : null;
    if (!strip || !tex) continue;
    const fill = hex(strip.outer_fill);
    const edge = side === 'west' ? bounds.left : bounds.right;
    const x = edge - strip.collision_px * artScale;
    const mapLine = x + strip.map_line_px * artScale;
    const w = tex.width * artScale;
    // La esquina, con el pivote en el cruce de las dos líneas de costa.
    let end = southLine;
    const c = side === 'west' ? sides.cornerWest : sides.cornerEast;
    const cTex = c ? await stillTexture(c, load) : null;
    const pivot = c?.manifest.pivot_px;
    if (c && cTex && pivot) {
      const sprite = new Sprite(cTex);
      sprite.anchor.set(pivot.x / cTex.width, pivot.y / cTex.height);
      sprite.scale.set(artScale);
      sprite.position.set(mapLine, southLine);
      corners.addChild(sprite);
      end = southLine - pivot.y * artScale;
    }
    const period = strip.period_px * artScale;
    const n = Math.ceil((end - top) / period);
    const y0 = end - n * period;
    const tile = new TilingSprite({ texture: tex, width: tex.width, height: n * strip.period_px });
    tile.scale.set(artScale);
    tile.position.set(x, y0);
    tiles.addChild(tile);
    if (side === 'west') land.rect(x - FAR, y0, FAR + 1, floor - y0).fill({ color: fill });
    else land.rect(x + w - 1, y0, FAR, floor - y0).fill({ color: fill });
  }

  // Borde superior publicado: abierto, sólo una marca tenue.
  const g = new Graphics();
  const a = worldToScreen({ x: bounds.left, y: bounds.top });
  const b = worldToScreen({ x: bounds.right, y: bounds.top });
  for (let x = a.x; x < b.x; x += 28) g.moveTo(x, a.y).lineTo(Math.min(x + 14, b.x), a.y);
  g.stroke({ width: 2, color: 0xffffff, alpha: 0.25 });
  view.addChild(g);
  return view;
}
