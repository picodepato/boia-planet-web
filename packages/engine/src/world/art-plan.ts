import {
  type ArtManifest,
  type CoastArt,
  type Vec2,
  type WorldConfig,
  type WorldObject,
  artFrames,
  coastAssets,
  parseAssetRef,
} from '@boia/world';
import {
  REFERENCE_VIEW,
  STREAM_TUNING,
  type StreamTuning,
  type ViewExtent,
  objectsBySector,
  planSectors,
  sectorsOf,
  withinView,
} from './sectors';
import { resolveObjectVisual } from './visual';

/**
 * Qué archivos de arte usa cada sector de un mundo (T47), sin Pixi ni red:
 * lo comparten el motor (clave de cada textura en los atlas), el script que
 * construye los atlas por sector (`tools/atlas`) y el presupuesto de bytes
 * antes de jugar (`apps/web/scripts/world-budget.mjs`).
 */

/** Un archivo de arte: `key` es su ruta dentro de `art/` (`mundos/arcilla/puerto/puerto.png`). */
export interface ArtFile {
  key: string;
  /** Carpeta del asset (`mundos/arcilla/puerto`), la parte de su id antes de `#`. */
  base: string;
  /** Ruta del archivo relativa a la carpeta, como en el manifiesto. */
  file: string;
}

/** Clave de un archivo: su ruta dentro de `art/`, sin `./` ni `..`. */
export function artKey(base: string, file: string): string {
  const out: string[] = [];
  for (const seg of `${base}/${file}`.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

function fileOf(base: string, file: string): ArtFile {
  return { key: artKey(base, file), base, file };
}

/** Los archivos que dibuja un objeto: los fotogramas de su animación y los de sumergirse. */
export function objectArtFiles(
  o: WorldObject,
  manifests: ReadonlyMap<string, ArtManifest>,
): ArtFile[] {
  const v = resolveObjectVisual(o, manifests, 1);
  if (v.kind !== 'sprite') return [];
  const { base } = parseAssetRef(v.assetId);
  return [...v.frames, ...(v.dive?.frames ?? [])].map((f) => fileOf(base, f));
}

/** Los archivos de las costas: las losas de T01 (todas sus variantes) o la imagen fija de cada pieza. */
export function coastArtFiles(
  coast: CoastArt | undefined,
  manifests: ReadonlyMap<string, ArtManifest>,
): ArtFile[] {
  const out: ArtFile[] = [];
  for (const id of coastAssets(coast)) {
    const m = manifests.get(id);
    if (!m) continue;
    const { base } = parseAssetRef(id);
    const variants = m.tile?.variants;
    if (variants) for (const v of Object.values(variants)) out.push(fileOf(base, v.file));
    else {
      const still = artFrames(m).files[0];
      if (still) out.push(fileOf(base, still));
    }
  }
  return dedupe(out);
}

function dedupe(files: ArtFile[]): ArtFile[] {
  const seen = new Set<string>();
  return files.filter((f) => (seen.has(f.key) ? false : (seen.add(f.key), true)));
}

/** Ids de arte que usan los objetos y las costas de un mundo (sin marcadores). */
export function worldAssetIds(world: Pick<WorldConfig, 'objects' | 'coast'>): string[] {
  return [
    ...new Set([
      ...world.objects.filter((o) => o.identity.active).map((o) => o.appearance.asset),
      ...coastAssets(world.coast),
    ]),
  ].filter((id) => !id.startsWith('placeholder:'));
}

export interface WorldArtPlan {
  /** Archivos de los objetos de cada sector (por su posición en el mapa), sin repetir. */
  sectors: Map<string, ArtFile[]>;
  /** Archivos de las costas: se cargan siempre, fuera de los atlas (losas que se repiten). */
  coast: ArtFile[];
}

export function worldArtPlan(
  world: Pick<WorldConfig, 'sectors' | 'bounds' | 'objects' | 'coast'>,
  manifests: ReadonlyMap<string, ArtManifest>,
): WorldArtPlan {
  const sectors = new Map<string, ArtFile[]>();
  for (const [id, objects] of objectsBySector(world)) {
    sectors.set(id, dedupe(objects.flatMap((o) => objectArtFiles(o, manifests))));
  }
  return { sectors, coast: coastArtFiles(world.coast, manifests) };
}

export interface StartArt {
  /** Sectores cuyo atlas se pide antes de jugar. */
  sectors: string[];
  /** Objetos que se dibujan antes de jugar (por su posición en el mapa). */
  objects: WorldObject[];
  /** Archivos de esos objetos y de las costas. */
  files: ArtFile[];
}

/**
 * Lo que se carga antes de poder jugar con el barco parado en `at`: los
 * sectores y objetos a la vista (más la precarga) y las costas. Es lo que
 * mide el presupuesto de REQ-ARQ-014 (≤ 5 MB el primer sector).
 */
export function startArt(
  world: Pick<WorldConfig, 'sectors' | 'bounds' | 'objects' | 'coast'>,
  manifests: ReadonlyMap<string, ArtManifest>,
  at: Vec2,
  view: ViewExtent = REFERENCE_VIEW,
  tuning: StreamTuning = STREAM_TUNING.alta,
): StartArt {
  const points = [at];
  const { want } = planSectors(sectorsOf(world), points, view, new Set(), tuning);
  const objects = world.objects.filter(
    (o) => o.identity.active && withinView(o.position, points, view, tuning.preload),
  );
  const files = dedupe([
    ...objects.flatMap((o) => objectArtFiles(o, manifests)),
    ...coastArtFiles(world.coast, manifests),
  ]);
  return { sectors: want, objects, files };
}
