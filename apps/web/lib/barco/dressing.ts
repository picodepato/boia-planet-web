/**
 * Cómo se ve cada bandera y cada estela de la tienda «Barco» (T40): colores
 * `muestra` hasta que haya arte de Blender para ellas. El mar 3D (three.js)
 * pinta la bandera en el tope del mástil y la estela con este tinte. Nada de
 * esto llega a la física del barco (REQ-IDE-032).
 */

export type FlagPattern = 'solid' | 'stripes' | 'checker';

export interface FlagLook {
  colors: readonly [number, number];
  pattern: FlagPattern;
}

/** Las mascotas de cubierta que sabe pintar el mar 3D (T154). */
export type MascotKind = 'minikraken';

export interface ShipDressing {
  flag: FlagLook | null;
  wakeTint: number | null;
  /** La mascota de cubierta (ranura `mascot`); null: sin mascota. */
  mascot: MascotKind | null;
}

/** Banderas por id de cosmético. Una sin entrada se pinta con los colores de BOIA. muestra */
export const FLAG_LOOKS: Readonly<Record<string, FlagLook>> = {
  'bandera-boia': { colors: [0xec4f24, 0x36278a], pattern: 'solid' },
  'bandera-fiestera': { colors: [0xf2557a, 0xffd23f], pattern: 'stripes' },
  'bandera-cuadros': { colors: [0x16122e, 0xfff4e2], pattern: 'checker' },
  // El premio de vencer al Barco Fantasma (logro `canon-fantasma`, T153).
  'bandera-fantasma': { colors: [0x2a3a4a, 0x9fe8d8], pattern: 'stripes' },
};
const DEFAULT_FLAG: FlagLook = { colors: [0xec4f24, 0x36278a], pattern: 'solid' };

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

/** Lo que se pinta con lo equipado (`progress.equipped()`): bandera, estela y mascota. */
export function dressingFor(equipped: Readonly<Record<string, string>>): ShipDressing {
  const flag = equipped.flag;
  const wake = equipped.wake;
  const mascot = equipped.mascot;
  return {
    flag: flag ? (FLAG_LOOKS[flag] ?? DEFAULT_FLAG) : null,
    wakeTint: wake ? (WAKE_TINTS[wake] ?? DEFAULT_WAKE) : null,
    mascot: mascot ? (MASCOT_KINDS[mascot] ?? null) : null,
  };
}

/** Clave estable de lo que se pinta, para no rehacer el barco si no cambia. */
export function dressingKey(d: ShipDressing): string {
  const f = d.flag ? `${d.flag.pattern}:${d.flag.colors.join(',')}` : '-';
  return `${f}|${d.wakeTint ?? '-'}|${d.mascot ?? '-'}`;
}

export const hexOf = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
