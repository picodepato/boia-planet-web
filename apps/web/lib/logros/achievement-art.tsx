import type { ReactNode } from 'react';
import { ICON_PALETTE } from '../mundo/menu/icons';

/**
 * El dibujo de los logros (plan 029 T274), en la misma familia que los iconos
 * del menú (`lib/mundo/menu/icons.tsx`): SVG de 32×32 hechos en código, sin
 * texto ni imágenes, contorno en `currentColor` y rellenos de `ICON_PALETTE`.
 * Cada dibujo se elige con `iconKey` del logro (las claves de
 * `ACHIEVEMENT_ICONS`, lib/admin/actions.ts). Es decorativo (`aria-hidden`): el
 * nombre lo da el título del logro. `muestra`.
 */

const { orange: O, purple: P, cream: C, white: W, sun: S } = ICON_PALETTE;

const GLYPHS = {
  // Salto mortal: el barco (el del menú) en el aire, dando la vuelta sobre la ola.
  ola: (
    <>
      <path fill={P} d="M3 29v-3.5c3.5 0 5-4.5 9-4.5s5.5 4.5 9 4.5c3.5 0 4.5-2 8-2V29z" />
      <path stroke={O} d="M6.8 16.5a10.2 10.2 0 1 1 19.4 0M26.2 16.5l-3-1M26.2 16.5l1.1-2.9" />
      <g
        transform="translate(15.5 12) rotate(-35) scale(0.55) translate(-16 -15)"
        strokeWidth={3.6}
      >
        <path fill={O} d="M14.5 3.5c5.6 3.4 10.2 9.2 12 14.7h-12z" />
        <path fill={C} d="M14.5 8c-3.8 2.9-7 6.4-8.8 10.2h8.8z" />
        <path d="M14.5 3.5v17.7" />
        <path fill={P} d="M3.5 21.2h25l-3.2 4.9a2 2 0 0 1-1.7.9H8.4a2 2 0 0 1-1.7-.9z" />
      </g>
    </>
  ),
  // Gaviota pillada: la gaviota con la moneda en el pico.
  gaviota: (
    <>
      <path
        fill={W}
        d="M3 12.5c4-2.4 8.5-1.6 13 2.5 4.5-4.1 9-4.9 13-2.5-4.2.2-8 2.4-10.5 6.5h-5C11 14.9 7.2 12.7 3 12.5z"
      />
      <circle fill={W} cx="16" cy="17.8" r="3.4" />
      <circle fill={P} stroke="none" cx="17.2" cy="17.2" r="1" />
      <path fill={O} d="M19.2 17.8l3.4 1.2-3.2 1.3z" />
      <circle fill={S} cx="24.8" cy="21.2" r="2.8" />
    </>
  ),
  // Fiestera bailando: la boia redonda con su gorra morada, de lado, y dos notas.
  fiesta: (
    <>
      <path d="M3 28.5c2 0 2.5-1.4 4.5-1.4s2.5 1.4 4.5 1.4 2.5-1.4 4.5-1.4 2.5 1.4 4.5 1.4 2.5-1.4 4.5-1.4 2.5 1.4 3.5 1.4" />
      <g transform="rotate(-14 15 19)">
        <path fill={P} d="M11.2 13.4a3.8 3.8 0 0 1 7.6 0z" />
        <circle fill={O} cx="15" cy="19.2" r="6.6" />
        <path fill={W} d="M8.6 17.6h12.8a6.6 6.6 0 0 1 .2 3.4H8.4a6.6 6.6 0 0 1 .2-3.4z" />
      </g>
      <path d="M26.5 4.5v8.2l2.8-1" />
      <circle fill={S} cx="24.6" cy="13" r="2.1" />
      <path d="M5.5 4.5v6" />
      <circle fill={S} cx="4" cy="10.8" r="1.7" />
    </>
  ),
  // There's always an after: los cascos de la isla del after y la luna de madrugada.
  after: (
    <>
      <path d="M6.5 19v-3a9.5 9.5 0 0 1 19 0v3" />
      <rect fill={O} x="4" y="17" width="6.5" height="10" rx="2.4" />
      <rect fill={O} x="21.5" y="17" width="6.5" height="10" rx="2.4" />
      <path fill={S} d="M17.6 9.6a3.6 3.6 0 1 0 3 5.6 3 3 0 0 1-3-5.6z" />
    </>
  ),
  // Capeaste el temporal: nube con rayo y lluvia.
  temporal: (
    <>
      <path fill={C} d="M8.5 19h15a5 5 0 0 0 0-10 7 7 0 0 0-13.5 1.6A4.2 4.2 0 0 0 8.5 19z" />
      <path fill={S} d="M17.6 15.5 13.4 22h3.4l-1.9 6.5 6.3-8.6h-3.6l2.2-4.4z" />
      <path d="M8.6 22.5l-1.4 3.2M11.4 24.5l-1 2.4M24.4 22.5l-1.2 3" />
    </>
  ),
  // Horoscopado: bola de cristal con una estrella, sobre su peana.
  horoscopo: (
    <>
      <circle fill={P} cx="16" cy="14" r="10" />
      <path stroke={W} strokeWidth={1.8} d="M10.2 12.2a6.2 6.2 0 0 1 3.4-4.4" />
      <path fill={S} d="M16 8.6l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z" />
      <rect fill={O} x="9.5" y="24.2" width="13" height="4.4" rx="1.6" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type AchievementArtName = keyof typeof GLYPHS;

/** Las claves con dibujo (las de `iconKey` que se ven en el panel de logros). */
export const ACHIEVEMENT_ART_NAMES = Object.keys(GLYPHS) as AchievementArtName[];

/** El dibujo de esa clave, o null si la clave no tiene dibujo. */
export function achievementArtName(iconKey: string | null | undefined): AchievementArtName | null {
  return iconKey && (ACHIEVEMENT_ART_NAMES as string[]).includes(iconKey)
    ? (iconKey as AchievementArtName)
    : null;
}

export function AchievementArt({ name }: { name: AchievementArtName }) {
  return (
    <svg
      className={`logro-art logro-art--${name}`}
      data-icon={name}
      viewBox="0 0 32 32"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GLYPHS[name]}
    </svg>
  );
}
