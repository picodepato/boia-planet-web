import { z } from 'zod';
import { DialogueLine } from '../behaviors';
import { CoastArt } from '../schema';

/**
 * La skin de un mundo sobre el mapa compartido (D-20): para cada lugar, su
 * arte, su nombre, sus textos y sus bocadillos; y para el mundo entero, el
 * estilo del barco (de `art/barco`), la paleta del mar, el acento de la
 * interfaz y la ranura de música. La skin no mueve nada ni cambia ningún
 * comportamiento: eso es del mapa.
 *
 * Arte por convención: sin `asset`, el de un lugar es
 * `mundos/<mundo>/<lugar>` (el manifiesto en
 * `art/mundos/<mundo>/<lugar>/manifest.json`). Un lugar sin skin se ve con
 * un marcador claro y lo lista `pnpm world:check`; ocultarlo en un mundo
 * exige `hidden: true`.
 */

export const WorldId = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'id de mundo: minúsculas, dígitos o «-»');

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color #rrggbb');

/** Colores del mar del motor: fondo, olas de fondo y crestas. */
export const SeaPalette = z.object({
  base: Hex,
  wave: Hex,
  crest: Hex,
});
export type SeaPalette = z.infer<typeof SeaPalette>;

/** El mar de la demo de plan 001 (el de `Water`). muestra */
export const DEFAULT_SEA: SeaPalette = { base: '#0f5f7d', wave: '#2a8fae', crest: '#d9f3f7' };

export const PlaceSkin = z.strictObject({
  /** Id del asset de `art/`. Sin él, `mundos/<mundo>/<lugar>`. */
  asset: z.string().min(1).optional(),
  /** Textos del lugar en este mundo (panel, cartel…), por clave. */
  texts: z.record(z.string(), z.string()).optional(),
  /** Bocadillos del lugar en este mundo: sustituyen a los de su DIÁLOGO. */
  lines: z.array(DialogueLine).min(1).max(30).optional(),
  /** Multiplica la escala común del lugar (arte con otro tamaño). */
  scale: z.number().finite().positive().optional(),
  /** Oculta el lugar en este mundo. Es la única forma de quitarlo. */
  hidden: z.literal(true).optional(),
});
export type PlaceSkin = z.infer<typeof PlaceSkin>;
export type PlaceSkinInput = z.input<typeof PlaceSkin>;

export const WorldSkin = z.object({
  id: WorldId,
  name: z.string().min(1),
  /** Una línea de historia para el selector de mundos. */
  tagline: z.string().min(1).optional(),
  /** Todo es `muestra` hasta que Álvaro lo apruebe. */
  status: z.string().default('muestra'),
  /** Estilo del barco de `art/barco` (id de `style` o de `style_variants`) y skin. */
  ship: z.object({ style: z.string().min(1), skin: z.string().min(1).optional() }),
  sea: SeaPalette.default(DEFAULT_SEA),
  /** Acento de la interfaz y el color de texto que va encima. */
  ui: z.object({ accent: Hex, onAccent: Hex.default('#ffffff') }),
  /** Ranura de música del mundo; `null` sin música. */
  music: z.string().min(1).nullable().default(null),
  /** Arte de las costas (ver `CoastArt`); sin él, costas por código. */
  coast: CoastArt.optional(),
  /** Skin de cada lugar, por id del mapa compartido. */
  places: z.record(z.string(), PlaceSkin).default({}),
  /**
   * Nombres propios de este mundo, por id de lugar: sustituyen al nombre
   * común del mapa sólo aquí. Van aparte del arte, así renombrar no cambia
   * si un lugar tiene skin.
   */
  names: z.record(z.string(), z.string().min(1)).default({}),
});
export type WorldSkin = z.infer<typeof WorldSkin>;
export type WorldSkinInput = z.input<typeof WorldSkin>;

/** Lo que el mundo aporta fuera de los lugares: barco, mar, interfaz y música. */
export type WorldTheme = Pick<WorldSkin, 'id' | 'name' | 'ship' | 'sea' | 'ui' | 'music'> & {
  tagline?: string;
};

/**
 * La skin con cada texto visible pasado por `translate` (nombre, historia,
 * nombres de lugar, bocadillos y textos de panel). Los textos de una skin son
 * claves del catálogo i18n de la web (plan 017 T195); `translate` devuelve el
 * texto de la clave, o el mismo valor si no es una clave (texto ya escrito,
 * por ejemplo uno editado en el Admin).
 */
export function resolveSkinTexts(skin: WorldSkin, translate: (value: string) => string): WorldSkin {
  const places: WorldSkin['places'] = {};
  for (const [id, p] of Object.entries(skin.places)) {
    places[id] = {
      ...p,
      ...(p.texts
        ? {
            texts: Object.fromEntries(Object.entries(p.texts).map(([k, v]) => [k, translate(v)])),
          }
        : {}),
      ...(p.lines ? { lines: p.lines.map((l) => ({ ...l, text: translate(l.text) })) } : {}),
    };
  }
  return {
    ...skin,
    name: translate(skin.name),
    ...(skin.tagline ? { tagline: translate(skin.tagline) } : {}),
    places,
    names: Object.fromEntries(Object.entries(skin.names).map(([k, v]) => [k, translate(v)])),
  };
}

/** Carpeta de arte de un lugar en un mundo, por convención. */
export function conventionAsset(worldId: string, placeId: string): string {
  return `mundos/${worldId}/${placeId}`;
}

/** Asset con el que se dibuja un lugar si el mundo tiene skin para él. */
export function skinAsset(worldId: string, placeId: string, skin: PlaceSkin): string {
  return skin.asset ?? conventionAsset(worldId, placeId);
}
