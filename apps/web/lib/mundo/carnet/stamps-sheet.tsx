'use client';

import { useEffect, useRef } from 'react';
import { t } from '../../i18n';
import { type StampArt, stampDateLabel } from './id-card-model';
import { RubberStamp } from './stamp';

/**
 * «Tus sellos · N» (T87, marco 03): todos los sellos a 132 px, dos columnas
 * (cuatro desde 768 px), con el nombre y la fecha de la fiesta en texto. Es
 * también la versión legible y accesible de la colección.
 */
export function StampsSheet({ stamps, onClose }: { stamps: StampArt[]; onClose: () => void }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <section
      className="idc-sheet"
      data-testid="carnet-tus-sellos"
      aria-labelledby="idc-sheet-title"
    >
      <div className="idc-sheet-head">
        <h3 id="idc-sheet-title" ref={ref} tabIndex={-1}>
          {t('carnet.stamps.sheetTitle', { n: stamps.length })}
        </h3>
        <button
          type="button"
          className="idc-x"
          aria-label={t('carnet.stamps.closeSheet')}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <ul className="idc-sheet-list">
        {stamps.map((s) => (
          <li key={s.eventId}>
            <RubberStamp art={s} decorative />
            <b>{s.name}</b>
            <span>{stampDateLabel(s.date)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
