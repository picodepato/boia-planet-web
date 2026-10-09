import { z } from 'zod';
import { Behavior } from '../behaviors';
import {
  ObjectAppearance,
  ObjectGeometry,
  ObjectPosition,
  ObjectState,
  Sector,
  WorldBounds,
} from '../schema';

/**
 * El mapa compartido (D-20, Hernán 2026-09-28): una sola lista de lugares
 * común a todos los mundos. Un lugar es un punto con id estable, posición,
 * geometría (huella y colisión), comportamientos y parámetros; cada mundo
 * pone encima su skin (`./skin`): arte, nombre, textos y bocadillos. Mover
 * un lugar aquí lo mueve en todos los mundos a la vez; añadir una isla es
 * añadir un lugar y dejar sus archivos en `art/mundos/<mundo>/<lugar>/`.
 *
 * Correspondencia con `mundos/arcilla/mapa.json` (la fuente de T20):
 * - `zonas[].id` y `zonas[].lugares[].id` → `Place.id` (ids estables, con
 *   guion o guion bajo);
 * - `zonas[].id` → `position.zone` de cada lugar de la zona;
 * - `centro` / `pos` (u_maq) × `ritmo.factor_juego` → `position` (u de motor);
 * - `islas[]` (a, b, giro) → `geometry.collision`, el círculo que colisiona;
 * - `proximidad[].radio` → `geometry.proximityRadius`;
 * - `comportamientos` → `behaviors` del catálogo con sus parámetros;
 * - `nombre` → `name` (común); `propuesta_nombre` → `name` de la skin del
 *   mundo si cambia en él; `texto` y `encuentro` → la skin de cada mundo.
 * - la salida (`salida`), el puerto y el punto de aterrizaje de la entrada
 *   → `spawn`, `port` e `introLanding` del mapa.
 */

const finite = z.number().finite();

/** Id estable de un lugar. Es la clave del progreso y de las carpetas de arte. */
export const PlaceId = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'id de lugar: minúsculas, dígitos, «-» o «_»');

export const Place = z.object({
  id: PlaceId,
  /**
   * Nombre común a todos los mundos. Cada mundo puede cambiarlo para sí con
   * `name` en su skin (ver `renamePlace`).
   */
  name: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  position: ObjectPosition,
  geometry: ObjectGeometry,
  behaviors: z.array(Behavior).default([]),
  /** Escala, capa y profundidad comunes; el asset lo pone cada mundo. */
  appearance: ObjectAppearance.omit({ asset: true }).partial().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  state: ObjectState.optional(),
  reward: z.record(z.string(), z.unknown()).optional(),
  /**
   * De dónde sale el lugar: rutas de `mapa.json` (`zonas/cala/islas/isla`) o
   * piezas de arte (`art:fiestera#cocodrilo_1`). La primera da la posición.
   * No llega al motor: sirve para comprobar el mapa contra su fuente.
   */
  source: z.array(z.string().min(1)).default([]),
});
export type Place = z.infer<typeof Place>;
export type PlaceInput = z.input<typeof Place>;

/**
 * Una isla de evento o de entradas: abre un evento o vende sus entradas. En
 * los datos de muestra sólo llevan el nombre común.
 */
export function isEventPlace(p: Pick<Place, 'behaviors'>): boolean {
  return p.behaviors.some(
    (b) => b.type === 'ticket' || (b.type === 'content' && b.params.target === 'event'),
  );
}

const Point = z.object({ x: finite, y: finite });

export const SharedMap = z
  .object({
    id: z.string().min(1),
    /** Revisión del contenido del mapa. */
    version: z.number().int().nonnegative(),
    bounds: WorldBounds,
    /** Donde aparece el barco (el anillo de salida). */
    spawn: z.object({ x: finite, y: finite, heading: finite.default(-Math.PI / 2) }),
    /** El puerto de salida, si lo hay (y el lugar que lo representa). */
    port: Point.extend({ place: PlaceId.optional() }).optional(),
    /** Donde aterriza la cámara de la entrada (D-19). */
    introLanding: Point,
    sectors: z.array(Sector).default([]),
    places: z.array(Place).min(1),
  })
  .superRefine((m, ctx) => {
    const seen = new Set<string>();
    m.places.forEach((p, i) => {
      if (seen.has(p.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `lugar repetido: ${p.id}`,
          path: ['places', i, 'id'],
        });
      }
      seen.add(p.id);
    });
    if (m.port?.place && !seen.has(m.port.place)) {
      ctx.addIssue({
        code: 'custom',
        message: `el puerto apunta a un lugar que no existe: ${m.port.place}`,
        path: ['port', 'place'],
      });
    }
  });
export type SharedMap = z.infer<typeof SharedMap>;
export type SharedMapInput = z.input<typeof SharedMap>;

export function parseSharedMap(input: unknown): SharedMap {
  return SharedMap.parse(input);
}

/**
 * El mapa con cada texto visible pasado por `translate` (nombres de lugares y
 * sectores, bocadillos de sus diálogos). Los textos del mapa de Arcilla son
 * claves del catálogo i18n de la web (plan 022 T242); `translate` devuelve el
 * texto de la clave, o el mismo valor si no es una clave.
 */
export function translateMapTexts(map: SharedMap, translate: (value: string) => string): SharedMap {
  return {
    ...map,
    sectors: map.sectors.map((s) => ({ ...s, name: translate(s.name) })),
    places: map.places.map((p) => ({
      ...p,
      name: translate(p.name),
      behaviors: p.behaviors.map((b) =>
        b.type === 'dialogue'
          ? {
              ...b,
              params: {
                ...b.params,
                lines: b.params.lines.map((l) => ({ ...l, text: translate(l.text) })),
              },
            }
          : b,
      ),
    })),
  };
}
