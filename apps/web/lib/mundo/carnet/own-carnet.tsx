'use client';

import type { CarnetView } from '@boia/store';
import Link from 'next/link';
import { type ComponentType, type ReactNode, useState } from 'react';
import { useAccount } from '../../account/use-account';
import { t } from '../../i18n';
import type { ScanLayerProps } from '../../scanner/scan-layer';
import { type CarnetExtras, CarnetCard } from './carnet-card';
import { type ClaimOutcome, claimStamp } from './claim';
import type { CardFace } from './id-card';
import { carnetPath } from './share';
import { StampsSheet } from './stamps-sheet';
import { StampFeedback } from './stamp-feedback';

/**
 * El Carnet propio con sus acciones (plan 008, T91; T87, «Card» y «Scan
 * flow»): bajo la tarjeta, «Escanear sello» (con cuentas), «Editar mi
 * Carnet» y «Compartir»; con el reverso a la vista y algún sello, «Ver tus
 * sellos». Lo usan la hoja «Mi Carnet» de /mar y /carnet.
 *
 * Escanear abre la cámara (`scan-layer`, cargada a demanda); un sello
 * concedido gira la tarjeta al reverso, el sello cae en la primera celda y
 * un aviso lo dice con los puntos. En modo local no hay a quién reclamar:
 * el botón no aparece y los sellos llegan con la compra de prueba.
 */
export function OwnCarnet({
  carnet,
  extras,
  onEdit,
  editHref,
  afterAnswers,
  dark = false,
}: {
  carnet: CarnetView;
  extras: CarnetExtras;
  /** Editar aquí mismo (/mar). */
  onEdit?: (() => void) | undefined;
  /** O ir a editar (/carnet → /mar). */
  editHref?: string | undefined;
  /** Bajo las respuestas (T251). */
  afterAnswers?: ReactNode | undefined;
  dark?: boolean | undefined;
}) {
  const account = useAccount();
  const [face, setFace] = useState<CardFace>('front');
  const [sheet, setSheet] = useState(false);
  const [Scanner, setScanner] = useState<ComponentType<ScanLayerProps> | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<Extract<ClaimOutcome, { kind: 'granted' }> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [flipKey, setFlipKey] = useState(0);
  const stamps = extras.stamps ?? [];
  const canScan = account.status !== 'local';
  const openScanner = async () => {
    const m = await import('../../scanner/scan-layer');
    setScanner(() => m.default);
  };

  const granted = (o: Extract<ClaimOutcome, { kind: 'granted' }>) => {
    setClaimed(o);
    setNotice(t('stamp.received', { event: o.event.name, points: o.points }));
    setFresh(o.event.slug);
  };

  const share = async () => {
    const url = `${window.location.origin}${carnetPath(carnet.userId)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: t('carnet.card.aria', { nickname: carnet.nickname }), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNotice(t('carnet.share.copied'));
    } catch {
      // compartir cancelado
    }
  };

  const controls = (
    <div className="idc-actions">
      {canScan ? (
        <button
          type="button"
          className="idc-btn is-wide"
          data-testid="carnet-escanear"
          onClick={() => void openScanner()}
        >
          {t('scan.button')}
        </button>
      ) : null}
      {editHref ? (
        <Link className="idc-btn is-ghost" href={editHref} data-testid="carnet-editar">
          {t('carnet.edit')}
        </Link>
      ) : (
        <button
          type="button"
          className="idc-btn is-ghost"
          data-testid="carnet-editar"
          onClick={onEdit}
        >
          {t('carnet.edit')}
        </button>
      )}
      <button
        type="button"
        className="idc-btn is-ghost"
        data-testid="carnet-compartir"
        onClick={() => void share()}
      >
        {t('carnet.share')}
      </button>
      {face === 'back' && stamps.length > 0 && !sheet ? (
        <button
          type="button"
          className="idc-btn is-ghost is-wide"
          data-testid="carnet-ver-sellos"
          onClick={() => setSheet(true)}
        >
          {t('carnet.stamps.seeAll')}
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <CarnetCard
        key={flipKey}
        carnet={carnet}
        extras={extras}
        fresh={fresh}
        afterAnswers={afterAnswers}
        dark={dark}
        controls={
          <>
            {notice ? (
              <p className="idc-notice" role="status" data-testid="carnet-sello-aviso">
                {notice}
              </p>
            ) : null}
            {claimed ? <StampFeedback outcome={claimed} /> : null}
            {controls}
            {sheet ? <StampsSheet stamps={stamps} onClose={() => setSheet(false)} /> : null}
          </>
        }
        onFaceChange={setFace}
        initialFace={flipKey > 0 ? 'back' : 'front'}
      />
      {Scanner ? (
        <Scanner
          claim={claimStamp}
          onGranted={granted}
          onSeeStamps={() => {
            setFlipKey((k) => k + 1);
            setSheet(true);
          }}
          onClose={() => setScanner(null)}
        />
      ) : null}
    </>
  );
}
