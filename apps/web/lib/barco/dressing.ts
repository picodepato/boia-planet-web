/**
 * Cómo se ve cada bandera y cada estela de la tienda «Barco» (T40): colores
 * `muestra` hasta que haya arte de Blender para ellas. La vista 2D (Pixi) y la
 * 3D (three.js) pintan lo mismo: la bandera en el tope del mástil y la estela
 * con este tinte. Nada de esto llega a la física del barco (REQ-IDE-032).
 *
 * Mismas formas que `ShipDressing` de `@boia/engine` (ship/dressing.ts), que
 * no se exporta: el motor las lee del manifiesto que recibe.
 */

export type FlagPattern = 'solid' | 'stripes' | 'checker';

export interface FlagLook {
  colors: readonly [number, number];
  pattern: FlagPattern;
}

export interface ShipDressing {
  flag: FlagLook | null;
  wakeTint: number | null;
}

/** Banderas por id de cosmético. Una sin entrada se pinta con los colores de BOIA. muestra */
export const FLAG_LOOKS: Readonly<Record<string, FlagLook>> = {
  'bandera-boia': { colors: [0xec4f24, 0x36278a], pattern: 'solid' },
  'bandera-fiestera': { colors: [0xf2557a, 0xffd23f], pattern: 'stripes' },
  'bandera-cuadros': { colors: [0x16122e, 0xfff4e2], pattern: 'checker' },
};
const DEFAULT_FLAG: FlagLook = { colors: [0xec4f24, 0x36278a], pattern: 'solid' };

/** Tinte de la espuma por id de cosmético. Una sin entrada, naranja BOIA. muestra */
export const WAKE_TINTS: Readonly<Record<string, number>> = {
  'estela-naranja': 0xff8a3d,
  'estela-burbujas': 0x8fe3ff,
  'estela-rayo': 0xffe14a,
};
const DEFAULT_WAKE = 0xff8a3d;

/** Lo que se pinta con lo equipado (`progress.equipped()`): bandera y estela. */
export function dressingFor(equipped: Readonly<Record<string, string>>): ShipDressing {
  const flag = equipped.flag;
  const wake = equipped.wake;
  return {
    flag: flag ? (FLAG_LOOKS[flag] ?? DEFAULT_FLAG) : null,
    wakeTint: wake ? (WAKE_TINTS[wake] ?? DEFAULT_WAKE) : null,
  };
}

/** Clave estable de lo que se pinta, para no rehacer el barco si no cambia. */
export function dressingKey(d: ShipDressing): string {
  const f = d.flag ? `${d.flag.pattern}:${d.flag.colors.join(',')}` : '-';
  return `${f}|${d.wakeTint ?? '-'}`;
}

export const hexOf = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
