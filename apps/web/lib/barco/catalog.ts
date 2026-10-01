import { readShipStyleIndex, shipSkins } from '@boia/engine/ui';
import { findShipImage, parseShipManifest } from '@boia/world';
import { resolveRef, scriptConstants, toHex } from './python-constants';
import { t } from '../i18n';

/**
 * Catálogo de la sección «Barco» del Menú de a bordo (T12): los estilos del
 * barco de `art/barco/manifest.json` (el por defecto y los de exploración de
 * T11) con las skins que trae el manifiesto de cada uno. Nombre, descripción,
 * paleta y notas salen del registro `docs/barcos/barcos.json`:
 * - `estilo` es el nombre visible (`nombre` es null hasta que Álvaro los bautice);
 * - `aspecto`, la descripción;
 * - la paleta se resuelve en el script de Blender de cada barco, como
 *   `tools/barcos/guia_colores.py` (los colores no se copian);
 * - `notas_render` quita skins que el estilo no admite (ver SKIN_RULES).
 *
 * Además, las variantes del registro (`variantes`, T59): barcos sin arte
 * nuevo, hechos con el arte de otro estilo en una de sus skins y el tono
 * girado (el barco exclusivo de la Boia Fiestera). Se ofrecen con una sola
 * skin, la suya.
 *
 * `buildShipCatalog` es puro; `loadShipCatalog` (lib/barco/load.ts) lee los
 * archivos del repo al construir la página.
 */

export const SHIP_ART_URL = '/api/art/barco';
/** Vista de la miniatura: tres cuartos, la que mejor enseña casco y cubierta. */
export const PREVIEW_DIRECTION = 'SE';

export interface ShipSwatch {
  hex: string;
  /** «Grupo: uso», para el título de la muestra. */
  label: string;
}

export interface ShipSkinEntry {
  id: string;
  label: string;
  /** Miniatura de la skin (vista SE, sin pasajera). */
  preview: string;
}

export interface ShipStyleEntry {
  id: string;
  name: string;
  description: string | null;
  /** Id del registro (B01…B08); null para el estilo por defecto. */
  barco: string | null;
  isDefault: boolean;
  swatches: ShipSwatch[];
  /** Skins que se ofrecen, en orden (base, fiesta, noche, otras). */
  skins: ShipSkinEntry[];
  /**
   * Variante sin arte propio (T59): el estilo y la skin cuyo arte usa y el
   * giro de tono (grados) que se le aplica, en 3D y en las miniaturas.
   */
  variant?: ShipVariantLook;
}

export interface ShipVariantLook {
  of: string;
  skin: string;
  hue: number;
}

export interface ShipCatalog {
  defaultId: string;
  styles: ShipStyleEntry[];
}

export const SKIN_LABELS: Record<string, string> = {
  base: t('barco.catalog.base'),
  fiesta: t('barco.catalog.fiesta'),
  noche: t('barco.catalog.noche'),
};
const SKIN_ORDER = ['base', 'fiesta', 'noche'];

/**
 * Skins que un estilo no admite según sus `notas_render`. Cada regla sólo se
 * aplica mientras la nota siga escrita en el registro: si se borra la nota
 * (p. ej. porque B05 se remodela), la skin vuelve a ofrecerse si existe.
 */
export const SKIN_RULES: ReadonlyArray<{
  barco: string;
  note: RegExp;
  /** Sólo estas skins… */
  only?: readonly string[];
  /** …o todas menos éstas. */
  except?: readonly string[];
}> = [
  // «Monocromo: no admite skins de color.»
  { barco: 'B01', note: /no admite skins de color/i, only: ['base'] },
  // B05 y B06 ya no se recortan: T39 les hizo sus skins noche y fiesta y la
  // tienda (T40, O5) las vende, aunque sus notas del registro sigan escritas.
];

interface RegistryColor {
  ref: (string | number)[];
  uso: string;
}
interface RegistryShip {
  id: string;
  nombre: string | null;
  estilo: string;
  aspecto: string;
  script: string;
  notas_render?: string[];
  paleta?: { grupo: string; colores: RegistryColor[] }[];
}
/** Una variante del registro (`variantes`, T59): arte de otro estilo, tono girado. */
interface RegistryVariant {
  id: string;
  nombre: string;
  aspecto: string;
  /** Estilo cuyo arte usa. */
  de: string;
  /** Skin de ese estilo. */
  skin: string;
  /** Giro de tono, en grados. */
  tono: number;
}
export interface ShipRegistry {
  referencias?: { marca?: { nombre: string; hex: string }[] };
  barcos: RegistryShip[];
  variantes?: RegistryVariant[];
}

/** El filtro CSS de una miniatura de variante (el mismo giro de tono que en 3D). */
export function variantFilter(style: Pick<ShipStyleEntry, 'variant'> | undefined): string | undefined {
  return style?.variant ? `hue-rotate(${style.variant.hue}deg)` : undefined;
}

export interface ShipCatalogSources {
  /** JSON de `art/barco/manifest.json`. */
  root: unknown;
  /** JSON de cada manifiesto de estilo, por su ruta relativa a `art/barco`. */
  styleManifests: Record<string, unknown>;
  registry: ShipRegistry;
  /** Texto de cada script de Blender, por la ruta que da el registro. */
  scripts: Record<string, string>;
}

/** Skins que el estilo ofrece: las del manifiesto, menos lo que excluyen sus notas. */
export function allowedSkins(skins: readonly string[], ship: RegistryShip | undefined): string[] {
  const notes = ship?.notas_render ?? [];
  let out = [...skins];
  for (const rule of SKIN_RULES) {
    if (rule.barco !== ship?.id || !notes.some((n) => rule.note.test(n))) continue;
    if (rule.only) out = out.filter((s) => rule.only!.includes(s));
    if (rule.except) out = out.filter((s) => !rule.except!.includes(s));
  }
  const rank = (s: string) => {
    const i = SKIN_ORDER.indexOf(s);
    return i < 0 ? SKIN_ORDER.length : i;
  };
  return out.sort((a, b) => rank(a) - rank(b));
}

/** Una muestra por grupo de la paleta (el primer color de cada uno). */
function swatchesOf(ship: RegistryShip, script: string | undefined): ShipSwatch[] {
  if (!script || !ship.paleta) return [];
  const env = scriptConstants(script);
  const out: ShipSwatch[] = [];
  for (const group of ship.paleta) {
    const first = group.colores[0];
    if (!first) continue;
    try {
      out.push({ hex: toHex(resolveRef(env, first.ref)), label: `${group.grupo}: ${first.uso}` });
    } catch (err) {
      console.warn(`[boia] ${ship.id}: ${(err as Error).message}`);
    }
  }
  return out;
}

export function buildShipCatalog(src: ShipCatalogSources): ShipCatalog {
  const index = readShipStyleIndex(src.root);
  const rawVariants = ((src.root as { style_variants?: unknown }).style_variants ?? []) as {
    id?: string;
    barco?: string;
  }[];
  const barcoOf = new Map(rawVariants.map((v) => [v.id, v.barco]));
  const styles: ShipStyleEntry[] = [];

  for (const option of index.options) {
    const isDefault = option.id === index.defaultId;
    const json = isDefault ? src.root : src.styleManifests[option.manifest];
    const parsed = parseShipManifest(json);
    if (!parsed.ok) continue;
    const dir = option.manifest.includes('/')
      ? option.manifest.slice(0, option.manifest.lastIndexOf('/') + 1)
      : '';
    const barco = isDefault ? null : (barcoOf.get(option.id) ?? null);
    const ship = barco ? src.registry.barcos.find((b) => b.id === barco) : undefined;

    const skins = allowedSkins(shipSkins(parsed.manifest), ship).flatMap((skin) => {
      const img = findShipImage(parsed.manifest, skin, PREVIEW_DIRECTION, false);
      if (!img) return [];
      return [
        {
          id: skin,
          label: SKIN_LABELS[skin] ?? skin[0]!.toUpperCase() + skin.slice(1),
          preview: `${SHIP_ART_URL}/${dir}${img.file}`,
        },
      ];
    });
    if (skins.length === 0) continue;

    const swatches = ship
      ? swatchesOf(ship, src.scripts[ship.script])
      : (src.registry.referencias?.marca ?? []).map((m) => ({ hex: m.hex, label: m.nombre }));

    styles.push({
      id: option.id,
      // El registro manda; si no hay entrada (estilo por defecto), el rótulo del manifiesto.
      name: ship?.nombre ?? ship?.estilo ?? option.label,
      description: ship?.aspecto ?? option.description ?? null,
      barco,
      isDefault,
      swatches,
      skins,
    });
  }
  for (const v of src.registry.variantes ?? []) {
    if (styles.some((st) => st.id === v.id)) continue;
    const base = styles.find((st) => st.id === v.de);
    const look = base?.skins.find((k) => k.id === v.skin);
    // Sin el arte del que sale, la variante no se ofrece.
    if (!base || !look) continue;
    styles.push({
      id: v.id,
      name: v.nombre,
      description: v.aspecto,
      barco: null,
      isDefault: false,
      swatches: [],
      skins: [{ id: 'base', label: SKIN_LABELS.base!, preview: look.preview }],
      variant: { of: base.id, skin: look.id, hue: v.tono },
    });
  }
  return { defaultId: index.defaultId, styles };
}
