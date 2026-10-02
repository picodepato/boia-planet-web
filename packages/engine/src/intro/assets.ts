import type { IntroConfig, ShipView } from './config';

/**
 * Recursos de la ilustración ligera del hero (REQ-ENT-017, 038), resueltos
 * desde los manifiestos de `art/` (T01): la isla de evento y el barco en
 * `<img>`, con el mismo encuadre que el último fotograma de la entrada.
 * Densidad: la de los sprites del mundo (la del barco), 1 px de escena = 1 px
 * de arte de la isla o del barco. La escena Pixi carga el mundo entero por su
 * cuenta (el mismo `WorldConfig` y arte que `/juego`).
 *
 * Es código puro: la web lee los manifiestos del disco al construir la
 * página y le pasa aquí el JSON. Si algo no cuadra, la entrada no se juega
 * y la landing sale en su versión ligera.
 */

export type Point = readonly [number, number];

export interface ArtImage {
  url: string;
  width: number;
  height: number;
  /** Punto de la imagen (px) que se coloca en la posición del objeto. */
  pivot: Point;
  /** px de escena por px de imagen. */
  scale: number;
}

export interface IntroAssets {
  /** px de pantalla por px de escena a escala de juego (barco con `ship.lengthPx` de eslora). */
  artScale: number;
  /** Isla de evento (el punto de aterrizaje de muestra). */
  island: ArtImage;
  ship: ArtImage;
}

/** Manifiesto de la isla de la ilustración ligera. */
export const STILL_ISLAND = 'isla-evento';

export type AssetsResult = { ok: true; assets: IntroAssets } | { ok: false; error: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const point = (v: unknown): Point | null =>
  Array.isArray(v) && v.length === 2 && num(v[0]) !== null && num(v[1]) !== null
    ? [v[0] as number, v[1] as number]
    : null;

class Missing extends Error {}
function must<T>(v: T | null | undefined, what: string): T {
  if (v === null || v === undefined) throw new Missing(what);
  return v;
}

const join = (base: string, id: string, file: string) =>
  `${base.replace(/\/$/, '')}/${id}/${file.split('/').map(encodeURIComponent).join('/')}`;

/**
 * @param manifests JSON de cada manifiesto por id de recurso
 *   (`INTRO_MANIFEST_IDS`).
 * @param baseUrl raíz desde la que se sirve `art/` (hoy `/api/art`, D-16).
 */
export function resolveIntroAssets(
  manifests: Readonly<Record<string, unknown>>,
  baseUrl: string,
  config: IntroConfig,
): AssetsResult {
  try {
    const ship = resolveShip(manifests.barco, baseUrl, config);
    const scenePpu = ship.ppu;

    const m = manifests[STILL_ISLAND];
    if (!isObj(m)) throw new Missing(`manifiesto de ${STILL_ISLAND}`);
    const image = must(isObj(m.image) ? m.image : null, `${STILL_ISLAND}.image`);
    const ppu = must(num(isObj(m.scale) ? m.scale.pixels_per_unit : null), `${STILL_ISLAND}.scale`);
    const images = Array.isArray(m.images) ? m.images.filter(isObj) : [];
    const first = images[0];
    const island: ArtImage = {
      url: join(
        baseUrl,
        STILL_ISLAND,
        must(first && typeof first.file === 'string' ? first.file : null, `${STILL_ISLAND} file`),
      ),
      width: must(num(image.width), `${STILL_ISLAND}.image.width`),
      height: must(num(image.height), `${STILL_ISLAND}.image.height`),
      pivot: must(point(m.pivot_px), `${STILL_ISLAND}.pivot_px`),
      scale: scenePpu / ppu,
    };
    return { ok: true, assets: { artScale: ship.artScale, island, ship: ship.image } };
  } catch (err) {
    if (err instanceof Missing) return { ok: false, error: `falta o no cuadra: ${err.message}` };
    throw err;
  }
}

function resolveShip(m: unknown, baseUrl: string, config: IntroConfig) {
  if (!isObj(m)) throw new Missing('manifiesto de barco');
  const projection = isObj(m.projection) ? m.projection : {};
  const ppu = must(num(projection.pixels_per_unit), 'barco.projection.pixels_per_unit');
  const directions = must(isObj(m.directions) ? m.directions : null, 'barco.directions');
  const anchorsOf = (d: string): Obj | null => {
    const dir = directions[d];
    return isObj(dir) && isObj(dir.anchors) ? dir.anchors : null;
  };

  // Escala de juego: la misma regla que el motor (eslora en la vista W, que no se acorta).
  const w = must(anchorsOf('W'), 'barco.directions.W.anchors');
  const bow = must(point(w.bow), 'barco W.bow');
  const stern = must(point(w.wake_origin), 'barco W.wake_origin');
  const hull = Math.hypot(bow[0] - stern[0], bow[1] - stern[1]);
  if (!(hull > 1)) throw new Missing('barco: eslora de la vista W');

  return {
    ppu,
    artScale: config.ship.lengthPx / hull,
    image: shipImage(m, baseUrl, 'barco', config.ship.view),
  };
}

/**
 * Una vista quieta (skin `base`, sin pasajera) de un manifiesto de barco: el
 * de `barco/` o el de un estilo (`barco/estilos/<estilo>`, T11), que tienen
 * la misma forma. La escala la pone la del barco de `barco/` (como el juego).
 */
export function shipImage(m: unknown, baseUrl: string, dir: string, view: ShipView): ArtImage {
  if (!isObj(m)) throw new Missing(`manifiesto de ${dir}`);
  const image = must(isObj(m.image) ? m.image : null, `${dir}.image`);
  const directions = must(isObj(m.directions) ? m.directions : null, `${dir}.directions`);
  const dirView = directions[view];
  const anchors = must(
    isObj(dirView) && isObj(dirView.anchors) ? dirView.anchors : null,
    `${dir}.directions.${view}.anchors`,
  );
  const images = Array.isArray(m.images) ? m.images.filter(isObj) : [];
  const style = typeof m.style === 'string' ? m.style : undefined;
  const entry = images.find(
    (i) =>
      i.skin === 'base' &&
      i.direction === view &&
      i.passenger !== true &&
      i.animation === undefined &&
      (i.style === undefined || i.style === style),
  );
  const file = must(
    entry && typeof entry.file === 'string' ? entry.file : null,
    `${dir} base/${view}`,
  );
  return {
    url: join(baseUrl, dir, file),
    width: must(num(image.width), `${dir}.image.width`),
    height: must(num(image.height), `${dir}.image.height`),
    pivot: must(point(anchors.pivot), `${dir} ${view}.pivot`),
    scale: 1,
  };
}

/** Como `shipImage`, pero `null` si el manifiesto no cuadra. */
export function tryShipImage(
  m: unknown,
  baseUrl: string,
  dir: string,
  view: ShipView,
): ArtImage | null {
  try {
    return shipImage(m, baseUrl, dir, view);
  } catch (err) {
    if (err instanceof Missing) return null;
    throw err;
  }
}

/** Ids de manifiesto que necesita la ilustración ligera. */
export const INTRO_MANIFEST_IDS: readonly string[] = ['barco', STILL_ISLAND];
