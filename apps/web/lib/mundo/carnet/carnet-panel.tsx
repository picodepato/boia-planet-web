'use client';

import { CARNET_QUESTIONS } from '@boia/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { INVITE_COPY } from '../../landing/invitations';
import { t } from '../../i18n';
import { useRepoData } from '../repo';
import { CarnetCard } from './carnet-card';
import { CarnetEditor, LOCAL_ONLY_NOTICE } from './carnet-editor';
import { carnetPath } from './share';
import { useCarnet } from './use-carnet';

/**
 * 🪪 Mi Carnet (REQ-IDE-011): al entrar se ve primero como lo ven otros, con
 * «Editar mi Carnet»; sin Carnet, la invitación es «Crear mi Carnet». Desde
 * aquí también se comparte y se llega a la botella propia. Lo enseñan el Menú
 * de a bordo del 2D y la hoja «Mi Carnet» del mar 3D (T55), sin salir del mar.
 *
 * - `onTop`: al pasar de ver a editar (o al guardar), se vuelve arriba.
 * - `onBottles`: abre la hoja de la botella propia; sin él, sólo se enseña.
 * - `startEditing`: entra ya en el alta (p. ej. desde «Crear mi Carnet»).
 */
export function CarnetPanel({
  onTop,
  onBottles,
  startEditing = false,
}: {
  onTop?: () => void;
  onBottles?: () => void;
  startEditing?: boolean;
}) {
  const { data, repo } = useCarnet(null);
  const { data: bottle } = useRepoData((r) => r.bottles.mine());
  const [editing, setEditing] = useState(startEditing);
  useEffect(() => {
    onTop?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, data?.carnet?.userId]);

  if (!data || !repo) return <p className="juego-muted">{t('juego.carnet.cargandoTuCarnet')}</p>;
  const { carnet, extras } = data;

  if (editing) {
    return (
      <CarnetEditor
        repo={repo}
        questions={CARNET_QUESTIONS}
        before={carnet}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  if (!carnet) {
    return (
      <div data-testid="carnet-invitacion">
        <p>{t('juego.carnet.tuCarnetBoiaEs')}</p>
        <button
          type="button"
          className="juego-button"
          data-testid="carnet-crear"
          onClick={() => setEditing(true)}
        >
          {t('carnet.create')}
        </button>
        <p className="juego-muted">{t('juego.carnet.sinEmail', { LOCAL_ONLY_NOTICE })}</p>
        {/* REQ-IDE-007 (T44): los límites del progreso local, antes de registrarse. */}
        <p className="juego-muted" data-testid="aviso-progreso-local">
          {INVITE_COPY.localLimit}
        </p>
      </div>
    );
  }

  return (
    <div data-testid="carnet-mio">
      <p className="juego-muted" data-testid="carnet-aviso-local">
        {t('juego.carnet.asiLoVeranLos', { LOCAL_ONLY_NOTICE })}
      </p>
      <CarnetCard carnet={carnet} extras={extras} />
      <div className="carnet-actions">
        <button
          type="button"
          className="juego-button"
          data-testid="carnet-editar"
          onClick={() => setEditing(true)}
        >
          {t('carnet.edit')}
        </button>
      </div>
      <p>
        <Link href={carnetPath(carnet.userId)} className="juego-link">
          {t('carnet.fullScreen')}
        </Link>
      </p>
      <h3>{t('bottle.title.own')}</h3>
      {bottle ? (
        <p data-testid="carnet-botella">
          🍾 «{bottle.message}»{' '}
          {onBottles ? (
            <button type="button" className="juego-link" onClick={onBottles}>
              {t('juego.carnet.editarORetirar')}
            </button>
          ) : null}
        </p>
      ) : (
        <p>
          {t('bottle.empty')}{' '}
          {onBottles ? (
            <button type="button" className="juego-link" onClick={onBottles}>
              {t('juego.carnet.echarUnaBotella')}
            </button>
          ) : null}
        </p>
      )}
    </div>
  );
}
