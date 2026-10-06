import type { DefenseTowerKind } from '@boia/engine/defense';
import type { ReactNode } from 'react';
import { CANON_ICON_PALETTE } from './canon-icons';

/**
 * Los iconos de «Defensa del Castillo» (plan 014 T161): las siete islas que
 * se construyen y los del HUD (castillo, monedas, oleada, avión, construir),
 * en la familia de los del Cañón (T150, `canon-icons.tsx`): SVG de 32×32 en
 * código, contorno grueso en `currentColor` y rellenos de la misma paleta.
 * Decorativos (`aria-hidden`): el nombre va siempre en el texto de al lado.
 * Todo `muestra`.
 */

const { orange: O, purple: P, cream: C, white: W, sun: S, water: A, red: R } = CANON_ICON_PALETTE;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Una estrella de `n` puntas centrada en (cx, cy). */
function star(n: number, outer: number, inner: number, cx: number, cy: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i * Math.PI) / n;
    const rad = i % 2 === 0 ? outer : inner;
    pts.push(`${r2(cx + Math.sin(a) * rad)} ${r2(cy - Math.cos(a) * rad)}`);
  }
  return `M${pts.join('L')}z`;
}

const GLYPHS = {
  // --- Las siete islas ------------------------------------------------------------
  // Faro: la torre a franjas, la linterna encendida y su haz.
  'isla-faro': (
    <>
      <path fill={S} stroke="none" opacity={0.85} d="M19.5 8.5l10-4.2v9.4z" />
      <path fill={C} d="M11.6 27.5l2-15.5h4.8l2 15.5z" />
      <path stroke={O} strokeWidth={2.6} strokeLinecap="butt" d="M13 17.6h6M12.4 22.6h7.2" />
      <rect fill={S} x="12.6" y="6.4" width="6.8" height="5.6" rx="1.6" />
      <path d="M11.8 6.4h8.4M16 3.6v2.8M7 27.8h18" />
    </>
  ),
  // Nochevieja: la bola de nieve que sale disparada, con su estrella de fin de año.
  'isla-ultima': (
    <>
      <path stroke={A} strokeWidth={2.2} d="M3.6 12.5h5.4M3 17.5h4.6M4.4 22.5h5" />
      <circle fill={W} cx="18.5" cy="17.5" r="8.4" />
      <path stroke={A} strokeWidth={1.6} d="M15 14.2a4.6 4.6 0 0 1 3.4-1.8" />
      <path fill={S} strokeWidth={1.6} d={star(4, 4.6, 1.7, 25.6, 6.6)} />
    </>
  ),
  // Halloween: la calabaza que echa fuego.
  'isla-halloween': (
    <>
      <path
        fill={O}
        d="M16 11.2c-6.4 0-10.8 3.6-10.8 8.2S9.6 28 16 28s10.8-4 10.8-8.6S22.4 11.2 16 11.2z"
      />
      <path strokeWidth={1.8} d="M16 11.8c-1.8 2.6-1.8 13 0 15.6" />
      <path d="M15.4 11.2c0-2.2.8-4.4 3-5.8" />
      <path
        fill={S}
        stroke="none"
        d="M9.6 18.6l3-2.4 1.6 3zM22.4 18.6l-3-2.4-1.6 3zM11.6 22.6h8.8l-1.6 2.2h-5.6z"
      />
    </>
  ),
  // Puerto de Alicante: el cohete de feria y su estallido.
  'isla-cala': (
    <>
      <path strokeWidth={1.8} strokeDasharray="1.6 2.6" d="M6 27.5c1.8-5 4.4-9 8-12" />
      <path fill={R} d="M11.4 22.6l6.8-9.4 3.4 2.4-6.8 9.4z" />
      <path fill={S} strokeWidth={1.6} d={star(8, 6.8, 2.6, 22.4, 9.4)} />
    </>
  ),
  // Ibiza: la granja de monedas (una pila y una que sale).
  'isla-tienda': (
    <>
      <rect fill={S} x="5.6" y="20" width="16" height="6.4" rx="3.2" />
      <rect fill={S} x="5.6" y="14.2" width="16" height="6.4" rx="3.2" />
      <circle fill={S} cx="22.4" cy="9.4" r="5.6" />
      <path strokeWidth={2} d="M22.4 7v4.8" />
    </>
  ),
  // Isla del Sonido: el altavoz y la onda de graves.
  'isla-allday': (
    <>
      <rect fill={P} x="3.8" y="7.6" width="12" height="17" rx="3" />
      <circle fill={O} cx="9.8" cy="18.6" r="3.8" />
      <circle fill={C} stroke="none" cx="9.8" cy="11.6" r="1.6" />
      <path d="M20.2 11.6a7.4 7.4 0 0 1 0 9.6M24.6 7.8a13 13 0 0 1 0 17.2" />
    </>
  ),
  // Benidorm: el rascacielos y la mira del francotirador.
  'isla-fotos': (
    <>
      <rect fill={C} x="4.4" y="5.4" width="9.2" height="22.4" rx="1.6" />
      <path strokeWidth={1.8} d="M7.4 10h3.2M7.4 14.6h3.2M7.4 19.2h3.2" />
      <circle fill={W} fillOpacity={0.35} cx="22" cy="15" r="6.2" />
      <path stroke={R} strokeWidth={2.2} d="M22 5.6v4.6M22 19.8v4.6M12.6 15h4.6M26.8 15h3.6" />
      <circle fill={R} stroke="none" cx="22" cy="15" r="1.7" />
    </>
  ),

  // --- El HUD ---------------------------------------------------------------------
  // La vida del castillo: la torre almenada.
  castillo: (
    <>
      <path fill={C} d="M6 27.5V9.5h4v3h3.4v-3h5.2v3H22v-3h4v18z" />
      <path fill={O} d="M13 27.5v-6a3 3 0 0 1 6 0v6z" />
    </>
  ),
  // Una moneda.
  moneda: (
    <>
      <circle fill={S} cx="16" cy="16" r="11.5" />
      <circle stroke={O} strokeWidth={1.8} cx="16" cy="16" r="7.4" />
      <path strokeWidth={2.2} d="M16 12v8" />
    </>
  ),
  // La oleada: una ola.
  oleada: (
    <>
      <path
        fill={A}
        d="M3.5 23.5c3-1 4.5-3.2 4.5-6.8 0-5.6 4.2-9.2 9.4-9.2 4.6 0 7.8 2.8 8.6 6.6-2.6-1.6-6.6-1-7 2.6-.4 3.6 3.4 5 6.8 4 1.8-.6 2.6-1.8 2.6-1.8v4.6z"
      />
    </>
  ),
  // El avión: el barco con las alas de «Entradas».
  avion: (
    <>
      <path fill={C} d="M3.6 15.6l12.4-4.2 12.4 4.2-12.4 1.8z" />
      <path fill={O} d="M10 17.6h12l-2 5.6h-8z" />
      <path d="M16 11.4V6.4" />
    </>
  ),
  // Construir: una isla con su «+».
  construir: (
    <>
      <path fill={O} d="M4 24.5c1.6-4.6 5.6-7.4 10.4-7.4s8.8 2.8 10.4 7.4z" />
      <path stroke={A} strokeWidth={2.2} d="M2.8 27.6h20.4" />
      <circle fill={S} cx="23" cy="9" r="6.4" />
      <path strokeWidth={2.2} d="M23 6v6M20 9h6" />
    </>
  ),
  // Mejoras (plan 015 T171): una flecha hacia arriba sobre una base.
  mejorar: (
    <>
      <path fill={O} d="M16 4.5l9 9.5h-5.4v8.6h-7.2V14H7z" />
      <path stroke={A} strokeWidth={2.2} d="M7 27.4h18" />
    </>
  ),
  // Velocidad de ataque del avión: un rayo.
  rapidez: (
    <>
      <path fill={S} d="M18.6 3.5L7.5 18h7.2l-2.4 10.5L24.5 13h-7.4z" />
    </>
  ),
  // Daño del avión: una bala que estalla.
  dano: (
    <>
      <path fill={O} strokeWidth={2} d={star(8, 11.5, 5.4, 16, 16)} />
      <circle fill={C} cx="16" cy="16" r="3.4" />
    </>
  ),
  // Un jefe en la oleada: la calavera con su corona.
  jefe: (
    <>
      <path fill={S} d="M8 10.5l2.6-6 3.4 3.6L16 3.5l2 4.6 3.4-3.6 2.6 6z" />
      <path
        fill={W}
        d="M7.4 18.4c0-4.8 3.8-7.4 8.6-7.4s8.6 2.6 8.6 7.4c0 3-1.6 4.6-3.4 5.4v4.2H10.8v-4.2c-1.8-.8-3.4-2.4-3.4-5.4z"
      />
      <circle fill={P} stroke="none" cx="12.6" cy="18.6" r="2.2" />
      <circle fill={P} stroke="none" cx="19.4" cy="18.6" r="2.2" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type CastleIconName = keyof typeof GLYPHS;
export const CASTLE_ICON_NAMES = Object.keys(GLYPHS) as CastleIconName[];

/** El icono de cada isla en «Construir» y en su ficha. */
export const TOWER_ICON: Readonly<Record<DefenseTowerKind, CastleIconName>> = {
  faro: 'isla-faro',
  ultima: 'isla-ultima',
  halloween: 'isla-halloween',
  cala: 'isla-cala',
  tienda: 'isla-tienda',
  allday: 'isla-allday',
  fotos: 'isla-fotos',
};

/** Un icono del castillo; mide 1em salvo que el CSS diga otra cosa (`.canon-icon`). */
export function CastleIcon({ name, className }: { name: CastleIconName; className?: string }) {
  return (
    <svg
      className={`canon-icon castle-icon--${name}${className ? ` ${className}` : ''}`}
      data-icon={name}
      viewBox="0 0 32 32"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GLYPHS[name]}
    </svg>
  );
}
