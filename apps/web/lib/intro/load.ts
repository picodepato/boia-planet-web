import {
  DEFAULT_INTRO_CONFIG,
  INTRO_MANIFEST_IDS,
  TITLE_MANIFEST_ID,
  resolveIntroAssets,
  resolveTitleSheet,
  tryShipImage,
  validateIntroConfig,
  type ArtImage,
  type IntroAssets,
  type IntroConfig,
  type IntroGeometry,
  type PortReveal,
  type ShipView,
  type TitleSheet,
} from '@boia/engine/intro';
import {
  type WorldConfig,
  artFrames,
  coastAssets,
  parseArtManifest,
  parseAssetRef,
  placePartArt,
  worldToScreen,
} from '@boia/world';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { worlds } from '../mundo/demo-world';
import { introForWorld } from './worlds';

/**
 * Sólo servidor (se ejecuta al construir la landing estática): valida la
 * configuración de la entrada, lee los manifiestos de `art/` (D-16) para la
 * ilustración ligera y prepara la entrada del mundo por defecto (T28): su
 * punto de aterrizaje, el trozo de mapa enrollado en el mini-mundo y su
 * puerto. En el navegador, la escena mira el mundo de ese navegador
 * (`lib/intro/active.ts`). Si algo no cuadra, devuelve `null` y la landing
 * sale sin cinemática, con su versión ligera (REQ-ENT-017).
 */

export const ART_BASE_URL = '/api/art';
const ART_ROOT = path.resolve(process.cwd(), '../../art');

/** Una pieza de la ilustración ligera, en px de juego a zoom 1 respecto al aterrizaje. */
export interface StillPiece {
  art: ArtImage;
  x: number;
  y: number;
}

export interface IntroData {
  /** La configuración con el aterrizaje, la llegada y el barco del mundo por defecto. */
  config: IntroConfig;
  assets: IntroAssets;
  geometry: IntroGeometry;
  /** EXPLORAR en el mundo por defecto (el navegador lo vuelve a calcular con el suyo). */
  reveal: PortReveal;
  worldId: string;
  /** Ilustración ligera: lo que hay junto al aterrizaje (el puerto), como lo pinta la escena. */
  still: StillPiece[];
  /** La vista quieta del barco en cada estilo (el juego lleva el pedido o el del mundo). */
  ships: Record<string, ArtImage>;
  /**
   * Imágenes que la escena va a pedir (arte del mundo y barco): el script de
   * arranque las pide ya, antes de hidratar, sólo si toca la entrada.
   */
  preload: string[];
  /**
   * Título 3D «BOIA» (T27): la hoja de sprites de Blender. Se pide después
   * del mini-mundo (no va en `preload`); sin ella, el título es texto plano.
   */
  title: TitleSheet | null;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const artUrl = (id: string, file: string) =>
  `${ART_BASE_URL}/${id}/${file.split('/').map(encodeURIComponent).join('/')}`;

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

const manifestCache = new Map<string, unknown>();
function manifestOf(base: string): unknown {
  if (!manifestCache.has(base)) {
    manifestCache.set(base, readJson(path.join(ART_ROOT, base, 'manifest.json')));
  }
  return manifestCache.get(base);
}

/**
 * El arte de un asset (`<carpeta>` o `<carpeta>#<pieza>[@variante]`, T18): su
 * manifiesto ya normalizado y el tamaño de su imagen.
 */
function assetArt(id: string) {
  const ref = parseAssetRef(id);
  const raw = manifestOf(ref.base);
  const parsed = parseArtManifest(raw);
  if (!parsed.ok) return null;
  if (!ref.part) {
    return { base: ref.base, manifest: parsed.manifest, image: isObj(raw) ? raw.image : null };
  }
  const manifest = placePartArt(parsed.manifest, ref.part, ref.variant);
  const part =
    isObj(raw) && Array.isArray(raw.parts)
      ? raw.parts.find((p: unknown) => isObj(p) && p.id === ref.part)
      : null;
  return manifest ? { base: ref.base, manifest, image: isObj(part) ? part.image : null } : null;
}

/** Imágenes de `art/` que usa un mundo (sus objetos y sus costas). */
function worldImages(world: WorldConfig): string[] {
  const ids = new Set([
    ...world.objects.filter((o) => o.identity.active).map((o) => o.appearance.asset),
    ...coastAssets(world.coast),
  ]);
  const urls: string[] = [];
  for (const id of ids) {
    const a = assetArt(id);
    if (!a) continue; // sin arte: la escena dibuja un marcador
    for (const i of a.manifest.images) urls.push(artUrl(a.base, i.file));
    for (const v of Object.values(a.manifest.tile?.variants ?? {})) {
      urls.push(artUrl(a.base, v.file));
    }
  }
  return urls;
}

/** Hasta dónde (u) del aterrizaje entra en la ilustración ligera: lo que se ve al llegar. muestra */
const STILL_REACH = { x: 700, y: 900 };

/** La ilustración ligera: las piezas junto al aterrizaje, en el orden en que las pinta la escena. */
function stillPieces(world: WorldConfig, landing: { x: number; y: number }): StillPiece[] {
  const l = worldToScreen(landing);
  const out: (StillPiece & { z: number })[] = [];
  for (const o of world.objects) {
    if (!o.identity.active) continue;
    if (Math.abs(o.position.x - landing.x) > STILL_REACH.x) continue;
    if (Math.abs(o.position.y - landing.y) > STILL_REACH.y) continue;
    const a = assetArt(o.appearance.asset);
    const file = a ? artFrames(a.manifest).files[0] : undefined;
    const pivot = a?.manifest.pivot_px ?? a?.manifest.anchors.pivot;
    const image = a && isObj(a.image) ? a.image : null;
    if (!a || !file || !pivot || !image) continue;
    if (typeof image.width !== 'number' || typeof image.height !== 'number') continue;
    const p = worldToScreen(o.position);
    out.push({
      art: {
        url: artUrl(a.base, file),
        width: image.width,
        height: image.height,
        pivot: [pivot.x, pivot.y],
        // Como el motor: escala de juego × escala del objeto.
        scale: o.appearance.scale,
      },
      x: p.x - l.x,
      y: p.y - l.y,
      // Como `ObjectView`: el agua debajo de todo, el resto por su y.
      z: o.appearance.layer === 'water' ? -1e7 + o.position.y : o.position.y,
    });
  }
  return out.sort((a, b) => a.z - b.z).map(({ z: _z, ...piece }) => piece);
}

/** La vista quieta del barco en cada estilo de `art/barco` (y la del manifiesto raíz). */
function shipImages(root: unknown, view: ShipView): Record<string, ArtImage> {
  const out: Record<string, ArtImage> = {};
  if (!isObj(root)) return out;
  const rootImage = tryShipImage(root, ART_BASE_URL, 'barco', view);
  if (rootImage && typeof root.style === 'string') out[root.style] = rootImage;
  const variants = Array.isArray(root.style_variants) ? root.style_variants.filter(isObj) : [];
  for (const v of variants) {
    if (typeof v.id !== 'string' || typeof v.manifest !== 'string') continue;
    const dir = path.posix.join('barco', path.posix.dirname(v.manifest));
    const img = tryShipImage(manifestOf(dir), ART_BASE_URL, dir, view);
    if (img) out[v.id] = img;
  }
  return out;
}

export function loadIntroData(): IntroData | null {
  const checked = validateIntroConfig(DEFAULT_INTRO_CONFIG);
  if (!checked.ok) {
    console.warn(
      '[boia] configuración de entrada inválida; landing sin cinemática\n' + checked.error,
    );
    return null;
  }
  const manifests: Record<string, unknown> = {};
  for (const id of INTRO_MANIFEST_IDS) {
    const m = manifestOf(id);
    // resolveIntroAssets dirá cuál falta.
    if (m !== null) manifests[id] = m;
  }
  const resolved = resolveIntroAssets(manifests, ART_BASE_URL, checked.config);
  if (!resolved.ok) {
    console.warn(
      '[boia] recursos de entrada incompletos; landing sin cinemática: ' + resolved.error,
    );
    return null;
  }
  // El mundo por defecto, sin los cambios del Admin (viven en cada navegador).
  const world = worlds.get(worlds.defaultId);
  const setup = introForWorld(
    world.id,
    world.config,
    worlds.map,
    {},
    checked.config,
    resolved.assets.artScale,
  );
  if (!setup) {
    console.warn('[boia] el aterrizaje o la salida caen fuera del mundo; landing sin cinemática');
    return null;
  }
  const ships = shipImages(manifests.barco, setup.config.ship.view);
  const ship = ships[world.theme.ship.style] ?? resolved.assets.ship;
  return {
    config: setup.config,
    assets: { ...resolved.assets, ship },
    geometry: setup.geometry,
    reveal: setup.reveal,
    worldId: world.id,
    still: stillPieces(setup.world, setup.config.landingPoint),
    ships,
    preload: [...new Set([ship.url, ...worldImages(setup.world)])],
    title: titleSheet(checked.config),
  };
}

function titleSheet(config: IntroConfig): TitleSheet | null {
  // Sin hoja, resolveTitleSheet dice que falta.
  const r = resolveTitleSheet(manifestOf(TITLE_MANIFEST_ID), ART_BASE_URL, config.copy.title);
  if (!r.ok) {
    console.warn('[boia] sin título 3D; la entrada usa el título plano: ' + r.error);
    return null;
  }
  return r.sheet;
}

const pct = (f: number) => `${(f * 100).toFixed(3)}%`;
const media = (minWidth: number, css: string) =>
  minWidth > 0 ? `@media (min-width:${minWidth}px){${css}}` : css;

/**
 * CSS de la ilustración ligera del hero (las piezas junto al aterrizaje y el
 * barco en `<img>`), con el mismo encuadre por dispositivo que el último
 * fotograma de la escena: al llegar el motor, el canvas cubre la ilustración
 * sin salto (REQ-ENT-038).
 */
export function stillCss({ config, assets, still }: IntroData): string {
  const rules = config.framings.map((f) => {
    const z = f.zoom * assets.artScale;
    // (x, y): px de juego a zoom 1 respecto al punto de aterrizaje.
    const place = (sel: string, art: ArtImage, x: number, y: number) =>
      `${sel}{width:${(art.width * art.scale * z).toFixed(2)}px;` +
      `left:calc(${pct(f.anchor[0])} + ${(x * f.zoom - art.pivot[0] * art.scale * z).toFixed(2)}px);` +
      `top:calc(${pct(f.anchor[1])} + ${(y * f.zoom - art.pivot[1] * art.scale * z).toFixed(2)}px)}`;
    const css =
      still
        .map((p, i) => place(`.hero__still-piece[data-piece="${i}"]`, p.art, p.x, p.y))
        .join('') + place('.hero__still-ship', assets.ship, config.ship.dx, config.ship.dy);
    return media(f.minWidth, css);
  });
  return rules.join('\n');
}

/**
 * CSS de la entrada que sale de su configuración (REQ-ENT-015): posición del
 * título y del botón por encuadre, y cuándo aparece la carga del acto 0.
 */
export function introCss({ config }: IntroData): string {
  const rules = config.framings.map((f) =>
    media(
      f.minWidth,
      `.intro-overlay__title{top:${pct(f.titleY)}}` +
        `.intro-overlay__enter{top:${pct(f.buttonY)}}`,
    ),
  );
  rules.push(`.intro-loading{animation-delay:${config.loading.showAfterMs}ms}`);
  return rules.join('\n');
}
