import type { ReactNode } from 'react';
import { ICON_PALETTE } from '../../lib/mundo/menu/icons';

/**
 * Los iconos del Cañón «Que no pare la música» (plan 013, T150): armas,
 * vinilos, evoluciones, mejoras, el botín de las élites, la Segunda vida, la
 * llama y el cofre, en la familia de los del menú (T114,
 * `lib/mundo/menu/icons.tsx`): SVG de 32×32 hechos en código, formas
 * redondas, contorno grueso en `currentColor` y rellenos de `ICON_PALETTE`
 * (más el agua, el ácido y el rojo del Cañón). Sin texto ni imágenes; se
 * leen a 20 px. Los vinilos llevan todos el disco morado detrás, para que la
 * fila de vinilos se reconozca de un vistazo. Son decorativos
 * (`aria-hidden`): el nombre lo da siempre la etiqueta o el `aria-label` de
 * al lado. Todo es `muestra`.
 */

/** La paleta: la de la marca (menú) más tres colores del Cañón (`canon-hud.css`). */
export const CANON_ICON_PALETTE = {
  ...ICON_PALETTE,
  water: '#3fb6ff',
  acid: '#8bd64a',
  red: '#ff4d3d',
  ink: '#1b1440',
} as const;

const { orange: O, purple: P, cream: C, white: W, sun: S, water: A, acid: G, red: R } =
  CANON_ICON_PALETTE;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Una estrella de `n` puntas centrada en (cx, cy). */
function star(n: number, outer: number, inner: number, cx = 16, cy = 16, offset = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = offset + (i * Math.PI) / n;
    const rad = i % 2 === 0 ? outer : inner;
    pts.push(`${r2(cx + Math.sin(a) * rad)} ${r2(cy - Math.cos(a) * rad)}`);
  }
  return `M${pts.join('L')}z`;
}

/** El disco de todos los vinilos: morado, con dos surcos. El dibujo va encima. */
function vinyl(glyph: ReactNode): ReactNode {
  return (
    <>
      <circle fill={P} cx="16" cy="16" r="13.6" />
      <path
        stroke={C}
        strokeOpacity={0.4}
        strokeWidth={1.1}
        d="M5.8 12.2a10.8 10.8 0 0 1 6.4-6.4M26.2 19.8a10.8 10.8 0 0 1-6.4 6.4"
      />
      {glyph}
    </>
  );
}

/** Un contorno de dos capas: el de `currentColor` debajo y el color encima. */
function twoTone(d: string, color: string, width = 2.6): ReactNode {
  return (
    <>
      <path strokeWidth={width + 2.2} d={d} />
      <path stroke={color} strokeWidth={width} d={d} />
    </>
  );
}

const FLAME = 'M16 3.5c1.6 4 6.9 7.4 6.9 13.6a6.9 6.9 0 0 1-13.8 0c0-3.2 1.6-5.4 3.3-7 .2 2.4 1 3.7 2.2 4.4-.4-4.4.4-8 1.4-11z';
const FLAME_CORE = 'M16 15.2c1.4 2 3.2 3.3 3.2 5.4a3.2 3.2 0 0 1-6.4 0c0-2 1.6-3.4 3.2-5.4z';
const HEART = 'M16 27.5C9 23 4.5 18.6 4.5 13.4a5.9 5.9 0 0 1 11.5-1.8 5.9 5.9 0 0 1 11.5 1.8c0 5.2-4.5 9.6-11.5 14.1z';

const GLYPHS = {
  // --- Armas -------------------------------------------------------------------
  // Cañón de agua: cañón morado sobre su rueda, escupiendo una bola de agua.
  'arma-canon': (
    <>
      <rect fill={P} x="4" y="13" width="17" height="8.4" rx="4.2" transform="rotate(-28 12.5 17.2)" />
      <circle fill={O} cx="10.5" cy="23.5" r="4.6" />
      <circle fill={C} stroke="none" cx="10.5" cy="23.5" r="1.4" />
      <path fill={A} d="M25.5 3.8c1.9 2.6 3.2 4.3 3.2 5.9a3.2 3.2 0 0 1-6.4 0c0-1.6 1.3-3.3 3.2-5.9z" />
    </>
  ),
  // Subwoofer: caja morada, un altavoz grande naranja y uno pequeño.
  'arma-subwoofer': (
    <>
      <rect fill={P} x="6" y="3.5" width="20" height="25" rx="3.4" />
      <circle fill={C} cx="16" cy="9" r="2.3" />
      <circle fill={O} cx="16" cy="19.6" r="6.4" />
      <circle fill={C} cx="16" cy="19.6" r="2.2" />
    </>
  ),
  // Focos: un foco de escenario morado en su horquilla, con el haz amarillo hacia abajo.
  'arma-laser': (
    <>
      <path fill={S} strokeWidth={2} d="M11 14.5h10l6.6 12.2a1.6 1.6 0 0 1-1.4 2.3H5.8a1.6 1.6 0 0 1-1.4-2.3z" />
      <path d="M6.5 10.5V4.5h19v6" />
      <rect fill={P} x="9" y="5" width="14" height="10.5" rx="3.6" />
      <path stroke={C} strokeWidth={2} d="M12.5 12.4h7" />
    </>
  ),
  // Boyas orbitales: el barco en medio, la órbita y dos boyas naranja.
  'arma-buoys': (
    <>
      <circle strokeWidth={1.8} strokeDasharray="2.6 3.4" cx="16" cy="16" r="10.2" />
      <circle fill={P} cx="16" cy="16" r="3.6" />
      <circle fill={O} cx="23.2" cy="8.8" r="4.6" />
      <circle fill={C} strokeWidth={1.6} cx="23.2" cy="8.8" r="1.7" />
      <circle fill={O} cx="8.8" cy="23.2" r="4.6" />
      <circle fill={C} strokeWidth={1.6} cx="8.8" cy="23.2" r="1.7" />
    </>
  ),
  // Cañón de confeti: un cono de fiesta naranja con rayas y confeti saliendo.
  'arma-confetti': (
    <>
      <path fill={O} d="M4 28l5.6-14.6 9 9z" />
      <path stroke={C} strokeWidth={2} d="M7.4 19.4l5.2 5.2M5.8 23.6l2.6 2.6" />
      <rect fill={S} strokeWidth={1.6} x="19" y="4" width="4" height="4" rx="1" transform="rotate(20 21 6)" />
      <circle fill={A} strokeWidth={1.6} cx="26" cy="13" r="2.2" />
      <rect fill={P} strokeWidth={1.6} x="13.5" y="7" width="3.6" height="3.6" rx="0.9" transform="rotate(-25 15.3 8.8)" />
      <path stroke={O} strokeWidth={2.2} d="M23.5 19.5l3 1.5" />
    </>
  ),
  // Traca: tres petardos rojos atados por la mecha, con la chispa.
  'arma-fireworks': (
    <>
      <path strokeWidth={1.8} d="M5.5 15.5c3-3 5.5-3 8.5 0s5.5 3 8.5 0c1.4-1.4 2.6-2.4 3.6-3" />
      <rect fill={R} x="3.2" y="15.5" width="5.2" height="12" rx="1.8" />
      <rect fill={O} x="11.6" y="15.5" width="5.2" height="12" rx="1.8" />
      <rect fill={R} x="20" y="15.5" width="5.2" height="12" rx="1.8" />
      <path fill={S} strokeWidth={1.6} d={star(4, 5, 1.9, 26.4, 7.6)} />
    </>
  ),
  // Lluvia ácida: nube crema con tres gotas verdes.
  'arma-acidRain': (
    <>
      <path
        fill={C}
        d="M9 18.5a5 5 0 0 1-.6-10 7 7 0 0 1 13.3-1.4A5.2 5.2 0 0 1 23.8 18.5z"
      />
      <path fill={G} strokeWidth={1.8} d="M9.5 21.5c1.3 1.8 2.2 3 2.2 4.1a2.2 2.2 0 0 1-4.4 0c0-1.1.9-2.3 2.2-4.1z" />
      <path fill={G} strokeWidth={1.8} d="M16.4 22.2c1.3 1.8 2.2 3 2.2 4.1a2.2 2.2 0 0 1-4.4 0c0-1.1.9-2.3 2.2-4.1z" />
      <path fill={G} strokeWidth={1.8} d="M23.3 21.5c1.3 1.8 2.2 3 2.2 4.1a2.2 2.2 0 0 1-4.4 0c0-1.1.9-2.3 2.2-4.1z" />
    </>
  ),

  // --- Vinilos (todos sobre el disco morado) -------------------------------------
  // Techno: avance rápido (más velocidad de ataque).
  'vinilo-techno': vinyl(<path fill={S} strokeWidth={1.8} d="M6.2 9.4l8.6 6.6-8.6 6.6zM15.4 9.4l8.6 6.6-8.6 6.6z" />),
  // Reggaetón: un punto que se ensancha en ondas (más área).
  'vinilo-reggaeton': vinyl(
    <>
      <circle fill={O} strokeWidth={1.8} cx="16" cy="16" r="3.4" />
      <circle stroke={S} strokeWidth={2.2} cx="16" cy="16" r="7.4" />
      <path stroke={S} strokeWidth={2.2} d="M22.8 9.2l2.2-2.2M9.2 9.2L7 7M22.8 22.8l2.2 2.2M9.2 22.8L7 25" />
    </>,
  ),
  // House: escudo crema y naranja (menos agua por golpe).
  'vinilo-house': vinyl(
    <>
      <path fill={C} strokeWidth={1.8} d="M16 6.6l7.6 2.8v5.8c0 5-3.2 8.2-7.6 9.8-4.4-1.6-7.6-4.8-7.6-9.8V9.4z" />
      <path fill={O} stroke="none" d="M16 8.5v14.3c-3.1-1.4-5.6-3.8-5.6-7.6v-4.4z" />
    </>,
  ),
  // Drum & Bass: un rayo (más velocidad del barco).
  'vinilo-dnb': vinyl(<path fill={S} strokeWidth={1.8} d="M18.4 5.4l-8.6 11.8h5.6l-2 9.4 9-12.4h-5.8z" />),
  // Disco: un imán pequeño (más radio del imán de notas).
  'vinilo-disco': vinyl(
    <>
      <path strokeWidth={6.4} strokeLinecap="butt" d="M10.6 8.4v7a5.4 5.4 0 0 0 10.8 0v-7" />
      <path stroke={O} strokeWidth={3.8} strokeLinecap="butt" d="M10.6 11.4v4a5.4 5.4 0 0 0 10.8 0v-4" />
      <path stroke={W} strokeWidth={3.8} strokeLinecap="butt" d="M10.6 8.6v2.8M21.4 8.6v2.8" />
    </>,
  ),
  // Chill / Ambient: una gota de agua con una cruz (achique y escudo).
  'vinilo-chill': vinyl(
    <>
      <path fill={A} strokeWidth={1.8} d="M16 5.6c3.6 4.6 6.4 8 6.4 11.2a6.4 6.4 0 0 1-12.8 0c0-3.2 2.8-6.6 6.4-11.2z" />
      <path stroke={W} strokeWidth={2.2} d="M16 14.2v6M13 17.2h6" />
    </>,
  ),
  // Hardstyle: un estallido naranja (más daño).
  'vinilo-hardstyle': vinyl(
    <>
      <path fill={O} strokeWidth={1.8} d={star(8, 10, 5)} />
      <circle fill={S} stroke="none" cx="16" cy="16" r="3" />
    </>,
  ),
  // Pop: una estrella amarilla (más experiencia).
  'vinilo-pop': vinyl(<path fill={S} strokeWidth={1.8} d={star(5, 10, 4.4, 16, 16.8)} />),
  // Rumba: tres bolas (un proyectil más).
  'vinilo-rumba': vinyl(
    <>
      <circle fill={C} strokeWidth={1.8} cx="16" cy="9.8" r="4" />
      <circle fill={C} strokeWidth={1.8} cx="10.4" cy="19.8" r="4" />
      <circle fill={O} strokeWidth={1.8} cx="21.6" cy="19.8" r="4" />
    </>,
  ),

  // --- Evoluciones (más grandes y brillantes) --------------------------------------
  // El Drop: una ola que rompe.
  'evo-drop': (
    <>
      <path
        fill={A}
        d="M3.5 27.5c0-10 6-19 15-19.6 5.6-.4 10 2.8 10 7.4 0 3.2-2.2 5.4-5 5.4-2.4 0-4-1.8-3.6-3.9.3-1.7-1.6-2.6-3.2-1.6-3.6 2.3-5.2 7-4 12.3z"
      />
      <path stroke={W} strokeWidth={2} d="M14.6 12.4c2.6-1.6 6.2-1.8 8.6.2" />
      <path d="M3.5 27.5h25" />
    </>
  ),
  // Muro de Sonido: una pared de cuatro altavoces.
  'evo-soundWall': (
    <>
      <rect fill={P} x="3.5" y="3.5" width="25" height="25" rx="3.4" />
      <path stroke={C} strokeOpacity={0.5} strokeWidth={1.4} d="M16 5v22M5 16h22" />
      <circle fill={O} cx="9.8" cy="9.8" r="4" />
      <circle fill={O} cx="22.2" cy="9.8" r="4" />
      <circle fill={O} cx="9.8" cy="22.2" r="4" />
      <circle fill={O} cx="22.2" cy="22.2" r="4" />
    </>
  ),
  // Show de Láseres: un abanico de rayos de colores.
  'evo-laserShow': (
    <>
      {twoTone('M16 25L4.5 6', R)}
      {twoTone('M16 25L10 3.8', S)}
      {twoTone('M16 25V3', W)}
      {twoTone('M16 25L22 3.8', A)}
      {twoTone('M16 25L27.5 6', G)}
      <path fill={P} d="M9.5 28.5a6.5 6.5 0 0 1 13 0z" />
    </>
  ),
  // Bola de Discoteca: la bola de espejos colgada, con un destello.
  'evo-discoBall': (
    <>
      <path strokeWidth={2} d="M14 2.5v4.4" />
      <circle fill={W} cx="14" cy="17.5" r="10.6" />
      <path
        stroke={P}
        strokeOpacity={0.55}
        strokeWidth={1.3}
        d="M3.8 14.4h20.4M3.8 20.6h20.4M8 9a16 16 0 0 0 0 17M20 9a16 16 0 0 1 0 17M14 7v21"
      />
      <path fill={A} stroke="none" d="M9.6 10.6h3.2v3.6H8.4zM15.2 15.2h3.6v4.4h-3.6z" />
      <path fill={S} strokeWidth={1.6} d={star(4, 5, 1.8, 26.4, 6.6)} />
    </>
  ),

  // --- Mejoras ---------------------------------------------------------------------
  // Bolas más fuertes: una bola morada delante de un estallido.
  'mejora-damage': (
    <>
      <path fill={S} strokeWidth={1.8} d={star(7, 13, 7, 19, 13)} />
      <circle fill={P} cx="13" cy="19" r="8.4" />
      <path stroke={C} strokeWidth={2} d="M9 16.2a4.6 4.6 0 0 1 3-3" />
    </>
  ),
  // Recarga rápida: un cronómetro crema con la aguja naranja.
  'mejora-fireRate': (
    <>
      <path d="M13 3.5h6M16 3.5v3.4M24.6 8.4l1.8-1.8" />
      <circle fill={C} cx="16" cy="18" r="11" />
      <path fill={O} stroke="none" d="M16 18V9.6a8.4 8.4 0 0 1 7.3 4.2z" />
      <path strokeWidth={2.2} d="M16 18l4.6-4.6" />
      <circle fill="currentColor" stroke="none" cx="16" cy="18" r="1.6" />
    </>
  ),
  // Cañón doble: dos bolas que salen a la vez, con su estela.
  'mejora-projectiles': (
    <>
      <path strokeWidth={2} d="M3.5 9.5h6M5.5 13.5h4M3.5 18.5h6M5.5 22.5h4" />
      <circle fill={P} cx="19.5" cy="11" r="5.4" />
      <circle fill={P} cx="19.5" cy="21.5" r="5.4" />
      <path stroke={C} strokeWidth={1.8} d="M17 9.2a2.6 2.6 0 0 1 1.8-1.3M17 19.7a2.6 2.6 0 0 1 1.8-1.3" />
    </>
  ),
  // Más vela: una vela naranja hinchada y el viento.
  'mejora-speed': (
    <>
      <path d="M12 3.5v24M8 27.5h10" />
      <path fill={O} d="M12 4.5c7.2 2.6 11.6 7.6 11.6 11.4S19.2 24.6 12 26z" />
      <path strokeWidth={2} d="M3 9.5h4.4M2.5 15.5h5M3 21.5h4.4" />
    </>
  ),
  // Imán de notas: un imán inclinado que atrae una nota.
  'mejora-magnet': (
    <g>
      <g transform="rotate(-40 12 17)">
        <path strokeWidth={7.6} strokeLinecap="butt" d="M6 9v8a6 6 0 0 0 12 0V9" />
        <path stroke={O} strokeWidth={5} strokeLinecap="butt" d="M6 12.4v4.6a6 6 0 0 0 12 0v-4.6" />
        <path stroke={W} strokeWidth={5} strokeLinecap="butt" d="M6 9.2v3.2M18 9.2v3.2" />
      </g>
      <path strokeWidth={2.2} d="M26 4.5v8.6" />
      <circle fill={P} cx="23.6" cy="13.4" r="2.8" />
      <path strokeWidth={2.2} d="M26 4.5c1.2.8 2.4 1.4 3.4 1.6" />
    </g>
  ),
  // Achique: un cubo inclinado que echa el agua por la borda.
  'mejora-bailing': (
    <>
      <path fill={A} d="M21.6 8.6c3.6.8 6.4 3.6 6.6 8.6l-.6 6.2-1.6-5.8c-.8-2.6-2.6-4-5-4.4z" />
      <circle fill={A} strokeWidth={1.8} cx="27.6" cy="27" r="1.8" />
      <g transform="rotate(32 13 18)">
        <path d="M4.5 12c0-7 17-7 17 0" />
        <path fill={C} d="M3.5 12h19l-2.4 13.2a2.4 2.4 0 0 1-2.4 2H8.3a2.4 2.4 0 0 1-2.4-2z" />
        <path fill={O} stroke="none" d="M5 17.6h16l-.8 4.4H5.8z" />
      </g>
    </>
  ),

  // --- Botín de las élites -------------------------------------------------------------
  // Imán total: un imán rojo grande, de pie, con chispas alrededor.
  'botin-iman': (
    <>
      <path strokeWidth={8} strokeLinecap="butt" d="M9.4 6.5v10a6.6 6.6 0 0 0 13.2 0v-10" />
      <path stroke={R} strokeWidth={5.4} strokeLinecap="butt" d="M9.4 10.4v6.1a6.6 6.6 0 0 0 13.2 0v-6.1" />
      <path stroke={W} strokeWidth={5.4} strokeLinecap="butt" d="M9.4 6.7v3.7M22.6 6.7v3.7" />
      <path strokeWidth={2} d="M3 3.8l2 2M29 3.8l-2 2M3 13.2h2.4M29 13.2h-2.4" />
    </>
  ),
  // Llama: el brasero morado con su fuego.
  'botin-llama': (
    <>
      <path fill={O} d="M16 2.8c1.2 3 5.6 5.6 5.6 10.6a5.6 5.6 0 0 1-11.2 0c0-2.6 1.3-4.4 2.7-5.6.2 1.9.8 3 1.8 3.5-.3-3.5.3-6.2 1.1-8.5z" />
      <path fill={S} stroke="none" d="M16 11.6c1.1 1.6 2.6 2.6 2.6 4.4a2.6 2.6 0 0 1-5.2 0c0-1.6 1.3-2.8 2.6-4.4z" />
      <path fill={P} d="M4.5 17.5h23a11.5 9.5 0 0 1-23 0z" />
      <path d="M12 27v2M20 27v2" />
    </>
  ),
  // Salvavidas: el aro de siempre, a gajos naranja y blanco.
  'botin-salvavidas': (
    <>
      <circle stroke={W} strokeWidth={6.4} strokeLinecap="butt" cx="16" cy="16" r="9.6" />
      <circle
        stroke={O}
        strokeWidth={6.4}
        strokeLinecap="butt"
        strokeDasharray="7.54 7.54"
        strokeDashoffset="3.77"
        cx="16"
        cy="16"
        r="9.6"
      />
      <circle cx="16" cy="16" r="13" />
      <circle cx="16" cy="16" r="6.2" />
    </>
  ),

  // --- Segunda vida, la llama y el cofre ---------------------------------------------
  // Segunda vida: dos corazones, uno detrás del otro.
  'segunda-vida': (
    <>
      <path fill={P} transform="translate(4.2 -3.6) scale(0.8)" d={HEART} />
      <path fill={O} transform="translate(-1.6 2.4) scale(0.86)" d={HEART} />
      <path stroke={C} strokeWidth={2} d="M6.4 13.4a3.2 3.2 0 0 1 2.6-2.8" />
    </>
  ),
  // La llama encendida (el aviso del HUD mientras dura).
  llama: (
    <>
      <path fill={O} d={FLAME} />
      <path fill={S} stroke="none" d={FLAME_CORE} />
    </>
  ),
  // El cofre de un miniboss.
  cofre: (
    <>
      <path fill={O} d="M4 13.5a9 6 0 0 1 9-6h6a9 6 0 0 1 9 6z" />
      <rect fill={O} x="4" y="13.5" width="24" height="13.5" rx="2" />
      <path stroke={P} strokeWidth={3} strokeLinecap="butt" d="M9.5 8.6v18.2M22.5 8.6v18.2" />
      <path d="M4 13.5h24" />
      <rect fill={S} x="13" y="11" width="6" height="7" rx="1.6" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type CanonIconName = keyof typeof GLYPHS;
export const CANON_ICON_NAMES = Object.keys(GLYPHS) as CanonIconName[];

/** Un icono del Cañón; mide 1em salvo que el CSS diga otra cosa (`.canon-icon`). */
export function CanonIcon({ name, className }: { name: CanonIconName; className?: string }) {
  return (
    <svg
      className={`canon-icon canon-icon--${name}${className ? ` ${className}` : ''}`}
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
