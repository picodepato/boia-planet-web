import type { ReactNode } from 'react';

/**
 * Los iconos del menú del juego (T114): una familia pequeña hecha en código,
 * con el dibujo de la mascota de BOIA (formas redondas, contorno grueso,
 * naranja y el morado de su gorra) en lugar de los emoji genéricos. Cada uno
 * es un SVG de 32×32 sin texto ni imágenes; el contorno va en `currentColor`
 * (tinta sobre la hoja crema, blanco sobre el cristal del botón del menú) y
 * los rellenos salen de `ICON_PALETTE`. Son decorativos: el nombre lo da
 * siempre la etiqueta de texto de al lado (`aria-hidden`). Miden 1em salvo
 * que el CSS del sitio diga otra cosa (`.boia-icon` en app/mar/mar.css); el
 * módulo no importa CSS, así lo pueden leer también las pruebas e2e.
 *
 * «Welcome Aboard» no se redibuja: es la mascota original
 * (`app/(landing)/_marca/boia-mascota.svg`, la misma de la bienvenida), que
 * pinta `.boia-icon--mascota`.
 */

/** Los colores de relleno de la familia: los de la marca en mar.css (+ el sol del objetivo). */
export const ICON_PALETTE = {
  orange: '#ec4f24',
  purple: '#36278a',
  cream: '#fff4e2',
  white: '#ffffff',
  sun: '#ffd23f',
} as const;

const { orange: O, purple: P, cream: C, white: W, sun: S } = ICON_PALETTE;

/** Segmentos radiales alrededor del centro (dientes del engranaje, rayos del sol). */
function rays(count: number, from: number, to: number, offset = 0): string {
  const r = (n: number) => Math.round(n * 100) / 100;
  return Array.from({ length: count }, (_, i) => {
    const a = offset + (i * 2 * Math.PI) / count;
    const [s, c] = [Math.sin(a), Math.cos(a)];
    return `M${r(16 + s * from)} ${r(16 - c * from)}L${r(16 + s * to)} ${r(16 - c * to)}`;
  }).join('');
}

const GEAR_TEETH = rays(8, 8, 11, Math.PI / 8);
const SUN_RAYS = rays(8, 10, 13);
/** El anillo del planeta entero (detrás) y su mitad de abajo (delante). */
const RING = 'M3 16a13 4.6 0 0 1 26 0a13 4.6 0 0 1-26 0z';
const RING_FRONT = 'M29 16a13 4.6 0 0 1-26 0';

const GLYPHS = {
  // Trofeo: copa naranja, peana morada.
  logros: (
    <>
      <path d="M16 18v6" />
      <path d="M9.4 7.5H7.2a3 3 0 0 0-3 3.1c.1 2.6 2.4 4.4 5.7 4.6M22.6 7.5h2.2a3 3 0 0 1 3 3.1c-.1 2.6-2.4 4.4-5.7 4.6" />
      <path fill={O} d="M9 4.5h14V11a7 7 0 0 1-14 0z" />
      <rect fill={P} x="9.5" y="23.5" width="13" height="5" rx="1.6" />
      <path stroke={W} strokeWidth={1.8} d="M12.7 8.2v2.6" />
    </>
  ),
  // Carnet: tarjeta crema con la banda morada y una cara naranja.
  carnet: (
    <>
      <rect fill={C} x="3" y="6.5" width="26" height="19" rx="3.5" />
      <path fill={P} d="M3 12v-2a3.5 3.5 0 0 1 3.5-3.5h19A3.5 3.5 0 0 1 29 10v2z" />
      <circle fill={O} cx="10.5" cy="18.6" r="3.4" />
      <path d="M17 17.2h7.5M17 21.2h4.5" />
    </>
  ),
  // Barco: velas naranja y crema, casco morado.
  barco: (
    <>
      <path fill={O} d="M14.5 3.5c5.6 3.4 10.2 9.2 12 14.7h-12z" />
      <path fill={C} d="M14.5 8c-3.8 2.9-7 6.4-8.8 10.2h8.8z" />
      <path d="M14.5 3.5v17.7" />
      <path fill={P} d="M3.5 21.2h25l-3.2 4.9a2 2 0 0 1-1.7.9H8.4a2 2 0 0 1-1.7-.9z" />
    </>
  ),
  // Mis códigos: etiqueta naranja con su agujero y un «%».
  codigos: (
    <>
      <path
        fill={O}
        d="M17.2 4H26a2 2 0 0 1 2 2v8.8a2 2 0 0 1-.6 1.4L16.2 27.4a2 2 0 0 1-2.8 0l-8.8-8.8a2 2 0 0 1 0-2.8L15.8 4.6a2 2 0 0 1 1.4-.6z"
      />
      <circle fill={C} cx="22.6" cy="9.4" r="2.2" />
      <path stroke={C} strokeWidth={2} d="M11.6 20.2l6.6-6.6" />
      <circle fill={C} stroke="none" cx="11.9" cy="14.6" r="1.7" />
      <circle fill={C} stroke="none" cx="17.9" cy="19.2" r="1.7" />
    </>
  ),
  // Mi botella: botella blanca inclinada, tapón morado y el mensaje naranja dentro.
  botella: (
    <g transform="rotate(35 16 16)">
      <rect fill={P} x="13.6" y="2.6" width="4.8" height="4.2" rx="1.2" />
      <path
        fill={W}
        d="M13.8 6.8h4.4v3.4c2.7 1.3 4.3 3.8 4.3 6.8v8.4a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3V17c0-3 1.6-5.5 4.3-6.8z"
      />
      <rect fill={O} x="12.3" y="16.6" width="7.4" height="8.4" rx="1.6" />
      <path stroke={C} strokeWidth={1.8} d="M12.6 20.8h6.8" />
    </g>
  ),
  // Ranking: podio (el primero naranja) con una estrella.
  ranking: (
    <>
      <rect fill={P} x="3.5" y="18.5" width="8" height="9.5" rx="1.2" />
      <rect fill={P} x="20.5" y="21.5" width="8" height="6.5" rx="1.2" />
      <rect fill={O} x="11.5" y="13.5" width="9" height="14.5" rx="1.2" />
      <path
        fill={S}
        strokeWidth={1.8}
        d="M16 2.8l1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5z"
      />
    </>
  ),
  // Ajustes: engranaje de dientes redondos (contorno en dos capas).
  ajustes: (
    <>
      <path strokeWidth={6} d={GEAR_TEETH} />
      <circle fill="currentColor" stroke="none" cx="16" cy="16" r="8.7" />
      <path stroke={O} strokeWidth={3.6} d={GEAR_TEETH} />
      <circle fill={O} stroke="none" cx="16" cy="16" r="7.5" />
      <circle fill={C} cx="16" cy="16" r="3.2" />
    </>
  ),
  // Controles: mando morado con la cruceta crema y dos botones naranja.
  controles: (
    <>
      <path
        fill={P}
        d="M10 9.5h12a6.5 6.5 0 0 1 6.4 7.6l-.9 5.2a3.3 3.3 0 0 1-5.8 1.5l-2.3-3h-6.8l-2.3 3a3.3 3.3 0 0 1-5.8-1.5l-.9-5.2A6.5 6.5 0 0 1 10 9.5z"
      />
      <path stroke={C} strokeWidth={2.2} d="M10.5 13.4v5.4M7.8 16.1h5.4" />
      <circle fill={O} stroke="none" cx="21.4" cy="14.4" r="1.8" />
      <circle fill={O} stroke="none" cx="24.3" cy="17.6" r="1.8" />
    </>
  ),
  // Mundos: planeta naranja con anillo morado (BOIA.PLANET).
  mundos: (
    <>
      <g transform="rotate(-20 16 16)" strokeLinecap="butt">
        <path strokeWidth={5} d={RING} />
        <path stroke={P} strokeWidth={2.4} d={RING} />
      </g>
      <circle fill={O} cx="16" cy="16" r="8" />
      <path stroke={W} strokeWidth={1.6} d="M11.9 12.6a5.5 5.5 0 0 1 3.4-2.2" />
      <g transform="rotate(-20 16 16)" strokeLinecap="butt">
        <path strokeWidth={5} d={RING_FRONT} />
        <path stroke={P} strokeWidth={2.4} d={RING_FRONT} />
      </g>
    </>
  ),
  // Momento del día: sol, atardecer y luna.
  dia: (
    <>
      <path d={SUN_RAYS} />
      <circle fill={S} cx="16" cy="16" r="6.5" />
    </>
  ),
  tarde: (
    <>
      <path d="M16 10.5V8M8.6 13.6l-1.8-1.8M23.4 13.6l1.8-1.8" />
      <path fill={O} d="M8 21a8 8 0 0 1 16 0z" />
      <path d="M3.5 21h25M7.5 25.5h6M18.5 25.5h6" />
    </>
  ),
  noche: (
    <>
      <path fill={P} d="M18.5 4.6a11.5 11.5 0 1 0 9 17.6 9.4 9.4 0 0 1-9-17.6z" />
      <path fill={S} strokeWidth={1.4} d="M24.8 5.2l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" />
    </>
  ),
} satisfies Record<string, ReactNode>;

/** Los iconos dibujados en código; `bienvenida` es la mascota original. */
export type GlyphName = keyof typeof GLYPHS;
export type MenuIconName = GlyphName | 'bienvenida';

export const MENU_ICON_NAMES: readonly MenuIconName[] = [
  ...(Object.keys(GLYPHS) as GlyphName[]),
  'bienvenida',
];

export function MenuIcon({ name }: { name: MenuIconName }) {
  if (name === 'bienvenida') {
    return (
      <span
        className="boia-icon boia-icon--bienvenida boia-icon--mascota"
        data-icon={name}
        aria-hidden="true"
      />
    );
  }
  return (
    <svg
      className={`boia-icon boia-icon--${name}`}
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
