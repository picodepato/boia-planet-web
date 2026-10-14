'use client';

import { t as msg } from '../../lib/i18n';

/**
 * Lo de la vista de mapa (T275): la pista, un globo que se va solo o al
 * tocarlo, y aparte el «Cerrar» del mapa, que siempre está mientras el mapa
 * esté abierto sin ficha. Son dos botones distintos: tocar la pista nunca
 * cierra el mapa. T280: el «Cerrar» es un botón pequeño con una ✕ (su nombre,
 * en `aria-label`), abajo a la izquierda, para no tapar rótulos.
 */
export function MapHintView({
  hint,
  onHint,
  onClose,
}: {
  /** Si la pista se ve (`mapHintReducer`). */
  hint: boolean;
  /** Tocar la pista: sólo la quita. */
  onHint: () => void;
  /** Cerrar el mapa (vuelta al barco). */
  onClose: () => void;
}) {
  return (
    <>
      {hint ? (
        <button type="button" className="mar-maphint" data-testid="mar-mapa-pista" onClick={onHint}>
          <p>{msg('mar.client.tocaUnaIslaPara')}</p>
        </button>
      ) : null}
      <button
        type="button"
        className="mar-mapclose"
        data-testid="mar-mapa-cerrar"
        aria-label={msg('mar.client.cerrarMapa')}
        title={msg('mar.client.cerrarMapa')}
        onClick={onClose}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path
            d="M3 3l10 10M13 3L3 13"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </>
  );
}
