import { MASCOT_KINDS, MINIKRAKEN_COLORS as K } from './dressing';

/**
 * El dibujo de una mascota en la lista de Mi Barco (T154): el minikraken de
 * frente, en el estilo de los iconos del menú (formas redondas, contorno
 * grueso). Sin modelo 3D: la tienda no carga three.js. Una mascota sin
 * dibujo propio no pinta nada.
 */
export function MascotIcon({ id, size = 28 }: { id: string; size?: number }) {
  if (MASCOT_KINDS[id] !== 'minikraken') return null;
  const line = '#1d1724';
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      data-mascota={id}
    >
      {/* Tentáculos, rizados hacia fuera. */}
      <g fill={K.tentacle} stroke={line} strokeWidth="1.6" strokeLinejoin="round">
        <path d="M8 20c-3 2-4 5-1.5 7 1 .8 2.4 0 2-1.4-.4-1.3 1-2.6 2.5-3.6z" />
        <path d="M24 20c3 2 4 5 1.5 7-1 .8-2.4 0-2-1.4.4-1.3-1-2.6-2.5-3.6z" />
        <path d="M12.5 22c-1 2.5-1 5 .8 6.4 1 .7 2.2-.2 1.8-1.4-.4-1.2.2-2.6 1-3.8z" />
        <path d="M19.5 22c1 2.5 1 5-.8 6.4-1 .7-2.2-.2-1.8-1.4.4-1.2-.2-2.6-1-3.8z" />
      </g>
      {/* Cabeza: la cúpula del pulpo con su franja de BOIA. */}
      <path
        d="M16 3.5c-6.4 0-10 5-10 10.5 0 4.6 3.6 8 10 8s10-3.4 10-8c0-5.5-3.6-10.5-10-10.5z"
        fill={K.skin}
        stroke={line}
        strokeWidth="1.8"
      />
      <path d="M7 17.6c5.6 2.2 12.4 2.2 18 0" fill="none" stroke={K.band} strokeWidth="2.2" />
      <circle cx="12" cy="7.5" r="1.4" fill={K.spots} />
      <circle cx="20.5" cy="6.6" r="1" fill={K.spots} />
      {/* Ojos grandes, mirando un poco al lado. */}
      <ellipse cx="12.4" cy="12.6" rx="2.9" ry="3.3" fill={K.eye} stroke={line} strokeWidth="1.3" />
      <ellipse cx="19.6" cy="12.6" rx="2.9" ry="3.3" fill={K.eye} stroke={line} strokeWidth="1.3" />
      <circle cx="13.1" cy="13.3" r="1.5" fill={K.pupil} />
      <circle cx="20.3" cy="13.3" r="1.5" fill={K.pupil} />
      <circle cx="9.4" cy="16" r="1.1" fill={K.belly} />
      <circle cx="22.6" cy="16" r="1.1" fill={K.belly} />
    </svg>
  );
}
