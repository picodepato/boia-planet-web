'use client';

import { t as msg } from '../../lib/i18n';

/**
 * Lo de la vista de mapa (T275): la pista, un globo que se va solo o al
 * tocarlo, y aparte el «Cerrar» del mapa, que siempre está mientras el mapa
 * esté abierto sin ficha. Son dos botones distintos: tocar la pista nunca
 * cierra el mapa.
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
      <button type="button" className="mar-mapclose" data-testid="mar-mapa-cerrar" onClick={onClose}>
        {msg('mar.client.cerrar')}
      </button>
    </>
  );
}
