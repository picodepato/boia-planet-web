/** Aspecto de la estela y la mascota de la tienda Barco. muestra */

/** Las mascotas de cubierta que sabe pintar el mar 3D (T154). */
export type MascotKind = 'minikraken';

export interface ShipDressing {
  wakeTint: number | null;
  /** La mascota de cubierta (ranura `mascot`); null: sin mascota. */
  mascot: MascotKind | null;
}

/** Tinte de la espuma por id de cosmético. Una sin entrada, naranja BOIA. muestra */
export const WAKE_TINTS: Readonly<Record<string, number>> = {
  'estela-naranja': 0xff8a3d,
  'estela-burbujas': 0x8fe3ff,
  'estela-rayo': 0xffe14a,
};
const DEFAULT_WAKE = 0xff8a3d;

/**
 * Mascotas por id de cosmético (ranura `mascot`, plan 013 T154): el modelo
 * que va en cubierta. Una sin entrada no se pinta. Para añadir otra, su
 * cosmético en el catálogo, su modelo en `app/mar/engine/` y su fila aquí.
 */
export const MASCOT_KINDS: Readonly<Record<string, MascotKind>> = {
  'mascota-minikraken': 'minikraken',
};

/**
 * Colores del minikraken: los del Kraken del Cañón (`KRAKEN_COLORS` de
 * `app/mar/engine/survivors-kraken.ts`) en pequeño, con la franja naranja de
 * BOIA. Los usan el modelo de cubierta y el dibujo de Mi Barco. muestra
 */
export const MINIKRAKEN_COLORS = {
  skin: '#6d2f63',
  spots: '#4d1f47',
  belly: '#c47aa6',
  tentacle: '#7d3a71',
  sucker: '#e3a9c4',
  eye: '#fff4d6',
  pupil: '#1d1724',
  band: '#ec4f24',
} as const;

/** Lo que se pinta con lo equipado (`progress.equipped()`): estela y mascota. */
export function dressingFor(equipped: Readonly<Record<string, string>>): ShipDressing {
  const wake = equipped.wake;
  const mascot = equipped.mascot;
  return {
    wakeTint: wake ? (WAKE_TINTS[wake] ?? DEFAULT_WAKE) : null,
    mascot: mascot ? (MASCOT_KINDS[mascot] ?? null) : null,
  };
}

/** Clave estable de lo que se pinta, para no rehacer el barco si no cambia. */
export function dressingKey(d: ShipDressing): string {
  return `${d.wakeTint ?? '-'}|${d.mascot ?? '-'}`;
}

export const hexOf = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
