'use client';

import { useState } from 'react';
import { t } from '../../../lib/i18n';
import { decodeFrame } from '../../../lib/scanner/decode';
import { type DoorOutcome, outcomeText } from './backend';
import { DoorCamera } from './door-camera';

/**
 * Lo que comparten el lector del equipo (/admin/puerta) y el del enlace de la
 * puerta (/puerta/<código>, plan 034 T307): abrir y cerrar la cámara, el
 * resultado de cada Carnet y leer una foto del QR.
 */
export function DoorScanner({
  onText,
  outcome,
  busy,
  disabled = false,
  photoOnly = false,
}: {
  onText: (text: string) => Promise<void>;
  outcome: DoorOutcome | null;
  busy: boolean;
  disabled?: boolean;
  photoOnly?: boolean;
}) {
  const [camera, setCamera] = useState(false);
  return (
    <>
      {camera ? (
        <>
          <DoorCamera onText={onText} photoOnly={photoOnly} />
          <button
            type="button"
            className="admin-button admin-button--ghost puerta-ancho"
            data-testid="puerta-cerrar-camara"
            onClick={() => setCamera(false)}
          >
            {t('puerta.closeCamera')}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="admin-button puerta-ancho"
          disabled={disabled}
          data-testid="puerta-abrir-camara"
          onClick={() => setCamera(true)}
        >
          {t('puerta.openCamera')}
        </button>
      )}
      <DoorResult outcome={outcome} busy={busy} />
    </>
  );
}

/** «O lee una foto del QR». Lo que no es un QR cuenta como otro QR. */
export function DoorPhoto({
  onText,
  onNoQr,
  disabled,
}: {
  onText: (text: string) => Promise<void>;
  onNoQr: () => void;
  disabled?: boolean;
}) {
  const read = async (file: File) => {
    const text = await qrFromImage(file);
    if (text) await onText(text);
    else onNoQr();
  };
  return (
    <label className="admin-field">
      <span className="admin-field__label">{t('puerta.photo')}</span>
      <input
        type="file"
        accept="image/*"
        disabled={disabled}
        data-testid="puerta-foto"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void read(file);
        }}
      />
    </label>
  );
}

function DoorResult({ outcome, busy }: { outcome: DoorOutcome | null; busy: boolean }) {
  if (busy && !outcome) {
    return (
      <p className="puerta-resultado" role="status">
        {t('puerta.stamping')}
      </p>
    );
  }
  if (!outcome) return <p className="puerta-resultado is-vacio" role="status" />;
  return (
    <p
      className={`puerta-resultado is-${outcome.kind}`}
      role={outcome.kind === 'granted' || outcome.kind === 'already' ? 'status' : 'alert'}
      data-testid="puerta-resultado"
      data-resultado={outcome.kind}
    >
      {outcomeText(outcome)}
    </p>
  );
}

/** El texto del QR de una foto (la cámara del móvil o una captura). */
async function qrFromImage(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const k = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * k);
    canvas.height = Math.round(bitmap.height * k);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return await decodeFrame({ data: img.data, width: img.width, height: img.height });
  } catch {
    return null;
  }
}
