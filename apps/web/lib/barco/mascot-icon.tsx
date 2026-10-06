import {
  CANONCITO_COLORS as CN,
  MASCOT_KINDS,
  MINIKRAKEN_COLORS as K,
  TORTUGA_COLORS as TT,
} from './dressing';

/**
 * El dibujo de una mascota en la lista de Mi Barco (T154, T175): el
 * minikraken, el Cañoncito y la Tortuga turbo de frente, en el estilo de los
 * iconos del menú (formas redondas, contorno grueso). Sin modelo 3D: la
 * tienda no carga three.js. Una mascota sin dibujo propio no pinta nada.
 */
export function MascotIcon({ id, size = 28 }: { id: string; size?: number }) {
  const kind = MASCOT_KINDS[id];
  if (kind === 'minikraken') return <MinikrakenIcon id={id} size={size} />;
  if (kind === 'canoncito') return <CanoncitoIcon id={id} size={size} />;
  if (kind === 'tortuga-turbo') return <TortugaIcon id={id} size={size} />;
  return null;
}

const line = '#1d1724';

function MinikrakenIcon({ id, size }: { id: string; size: number }) {
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

/** El Cañoncito de lado: la cureña con dos ruedas, el tubo con su franja y los ojos, la mecha con chispa. */
function CanoncitoIcon({ id, size }: { id: string; size: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      data-mascota={id}
    >
      {/* La cureña y las ruedas. */}
      <path d="M9 17h12l1.5 5H8.5z" fill={CN.wood} stroke={line} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="11" cy="24" r="3.4" fill={CN.woodDark} stroke={line} strokeWidth="1.6" />
      <circle cx="20" cy="24" r="3.4" fill={CN.woodDark} stroke={line} strokeWidth="1.6" />
      <circle cx="11" cy="24" r="1" fill={CN.hub} />
      <circle cx="20" cy="24" r="1" fill={CN.hub} />
      {/* El tubo, apuntando a la derecha y algo arriba. */}
      <path
        d="M6 15.5c0-2.4 1.8-3.8 4-3.8l16-2.2c1.6-.2 2.6.8 2.6 2.2v1.6c0 1.4-1 2.4-2.6 2.2L10 13.8c-2.2 0-4 1.4-4 3.8z"
        fill={CN.iron}
        stroke={line}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M18 10.4v5.2" stroke={CN.band} strokeWidth="2.2" />
      <path d="M13 11.6v4.4" stroke={CN.ironDark} strokeWidth="1.6" />
      {/* Los ojos sobre el tubo, cerca de la boca. */}
      <ellipse cx="23" cy="8.6" rx="1.7" ry="2" fill="#fff4d6" stroke={line} strokeWidth="1.1" />
      <ellipse cx="26.6" cy="8.1" rx="1.7" ry="2" fill="#fff4d6" stroke={line} strokeWidth="1.1" />
      <circle cx="23.5" cy="9" r=".8" fill={line} />
      <circle cx="27.1" cy="8.5" r=".8" fill={line} />
      {/* La mecha con su chispa. */}
      <path d="M6.5 14.5c-1.5-1-2.5-2.5-1.5-4.5" fill="none" stroke={CN.woodDark} strokeWidth="1.4" />
      <circle cx="5" cy="9" r="1.8" fill={CN.spark} stroke={line} strokeWidth="1" />
    </svg>
  );
}

/** La Tortuga turbo desde arriba: el caparazón con el rayo, la cabeza con gafas y las cuatro aletas. */
function TortugaIcon({ id, size }: { id: string; size: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      data-mascota={id}
    >
      {/* Aletas. */}
      <g fill={TT.skin} stroke={line} strokeWidth="1.5" strokeLinejoin="round">
        <path d="M9 13l-5-4c-1.5 1-1.2 3 .5 4.5z" />
        <path d="M23 13l5-4c1.5 1 1.2 3-.5 4.5z" />
        <path d="M9.5 23l-4 3.5c.5 1.4 2.2 1.8 3.8.8z" />
        <path d="M22.5 23l4 3.5c-.5 1.4-2.2 1.8-3.8.8z" />
      </g>
      {/* La cola. */}
      <path d="M16 27.5l-1.2 3h2.4z" fill={TT.skin} stroke={line} strokeWidth="1.2" />
      {/* El caparazón con su borde, y el rayo de BOIA. */}
      <ellipse cx="16" cy="19" rx="8.5" ry="9.5" fill={TT.rim} stroke={line} strokeWidth="1.8" />
      <ellipse cx="16" cy="19" rx="6.6" ry="7.6" fill={TT.shell} />
      <path d="M16.5 12.5l-3 6h2.5l-1.5 6 4-7h-2.5z" fill={TT.stripe} stroke={line} strokeWidth=".9" strokeLinejoin="round" />
      {/* La cabeza con las gafas. */}
      <circle cx="16" cy="7" r="4.2" fill={TT.skin} stroke={line} strokeWidth="1.6" />
      <circle cx="14.2" cy="6.4" r="1.7" fill={TT.lens} stroke={TT.goggle} strokeWidth="1.1" />
      <circle cx="17.8" cy="6.4" r="1.7" fill={TT.lens} stroke={TT.goggle} strokeWidth="1.1" />
      <path d="M14.5 9.2c1 .8 2 .8 3 0" fill="none" stroke={line} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
