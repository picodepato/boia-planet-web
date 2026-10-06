/** Aspecto de la estela y la mascota de la tienda Barco. muestra */

/**
 * Las mascotas que sabe pintar el mar 3D: el minikraken de cubierta (T154),
 * el «Cañoncito» de cubierta y la «Tortuga turbo» que nada detrás del barco
 * (plan 015 T175, decisión 16).
 */
export type MascotKind = 'minikraken' | 'canoncito' | 'tortuga-turbo';

/** Cómo se dibuja la estela: espuma de un color, o el remolino lila y negro (T175). */
export type WakeStyle = 'espuma' | 'vortice';

export interface ShipDressing {
  wakeTint: number | null;
  wakeStyle: WakeStyle;
  /** La mascota (ranura `mascot`); null: sin mascota. */
  mascot: MascotKind | null;
}

/** Los dos colores de la «Estela del vórtice» (plan 015 T175): lila y negro. muestra */
export const VORTEX_COLORS = { lilac: 0xb98cff, ink: 0x15081f } as const;

/** Tinte de la espuma por id de cosmético. Una sin entrada, naranja BOIA. muestra */
export const WAKE_TINTS: Readonly<Record<string, number>> = {
  'estela-naranja': 0xff8a3d,
  'estela-burbujas': 0x8fe3ff,
  'estela-rayo': 0xffe14a,
  'estela-vortice': VORTEX_COLORS.lilac,
};
const DEFAULT_WAKE = 0xff8a3d;

/** Estelas que no son espuma de un color: su estilo por id de cosmético. */
export const WAKE_STYLES: Readonly<Record<string, WakeStyle>> = {
  'estela-vortice': 'vortice',
};

/**
 * Mascotas por id de cosmético (ranura `mascot`, plan 013 T154): el modelo
 * que va con el barco. Una sin entrada no se pinta. Para añadir otra, su
 * cosmético en el catálogo, su modelo en `app/mar/engine/` y su fila aquí.
 */
export const MASCOT_KINDS: Readonly<Record<string, MascotKind>> = {
  'mascota-minikraken': 'minikraken',
  'mascota-canoncito': 'canoncito',
  'mascota-tortuga-turbo': 'tortuga-turbo',
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

/**
 * Colores del Cañoncito y de la Tortuga turbo para el dibujo de Mi Barco: los
 * `ROLES` de sus scripts de Blender (`tools/blender/mascotas/*.py`; la prueba
 * de `mascot-icon.test.tsx` los compara). muestra
 */
export const CANONCITO_COLORS = {
  wood: '#A86A3A',
  woodDark: '#6E4224',
  iron: '#4A5468',
  ironDark: '#2F3647',
  band: '#EC4F24',
  hub: '#F2C230',
  spark: '#FFD23F',
} as const;
export const TORTUGA_COLORS = {
  shell: '#3F8F5A',
  plate: '#2E6E44',
  rim: '#6FB06A',
  skin: '#8CC86B',
  stripe: '#EC4F24',
  goggle: '#F2C230',
  lens: '#9ED7F5',
} as const;

/** Lo que se pinta con lo equipado (`progress.equipped()`): estela y mascota. */
export function dressingFor(equipped: Readonly<Record<string, string>>): ShipDressing {
  const wake = equipped.wake;
  const mascot = equipped.mascot;
  return {
    wakeTint: wake ? (WAKE_TINTS[wake] ?? DEFAULT_WAKE) : null,
    wakeStyle: wake ? (WAKE_STYLES[wake] ?? 'espuma') : 'espuma',
    mascot: mascot ? (MASCOT_KINDS[mascot] ?? null) : null,
  };
}

/** Clave estable de lo que se pinta, para no rehacer el barco si no cambia. */
export function dressingKey(d: ShipDressing): string {
  return `${d.wakeTint ?? '-'}|${d.wakeStyle}|${d.mascot ?? '-'}`;
}

export const hexOf = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/** La muestra de color de una estela en Mi Barco (fondo CSS); null si no tiene. */
export function wakeSwatch(id: string): string | null {
  if (WAKE_STYLES[id] === 'vortice')
    return `linear-gradient(135deg, ${hexOf(VORTEX_COLORS.ink)} 0%, ${hexOf(VORTEX_COLORS.lilac)} 55%, ${hexOf(VORTEX_COLORS.ink)} 100%)`;
  const t = WAKE_TINTS[id];
  return t !== undefined ? hexOf(t) : null;
}
