'use client';

import { CARNET_QUESTIONS } from '@boia/contracts';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AccountSection } from '../../account/account-section';
import { requireAccount } from '../../account/gate';
import { useAccount } from '../../account/use-account';
import { INVITE_COPY } from '../../landing/invitations';
import { isSupabaseConfigured } from '../../supabase/config';
import { t } from '../../i18n';
import { useRepoData } from '../repo';
import { CarnetEditor, LOCAL_ONLY_NOTICE } from './carnet-editor';
import { OwnCarnet } from './own-carnet';
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
 * - `startEditing`: entra ya en el alta (p. ej. desde «Crear mi Carnet» o el
 *   QR de alta). Con cuentas, el alta empieza por el email y su código.
 * - `onCreated`: se acaba de crear el Carnet (p. ej. para volver a la compra, T66).
 *
 * Con cuentas (plan 019 T218, decisión 11) crear el Carnet empieza siempre
 * por el email → el código de 6 cifras → el Carnet (apodo y política, en la
 * hoja de acceso); después, las preguntas opcionales. Sin Supabase no se pide
 * email: el alta va directa al formulario.
 */
export function CarnetPanel({
  onTop,
  onBottles,
  startEditing = false,
  onCreated,
}: {
  onTop?: () => void;
  onBottles?: () => void;
  startEditing?: boolean;
  onCreated?: () => void;
}) {
  const { data, repo } = useCarnet(null);
  const { data: bottle } = useRepoData((r) => r.bottles.mine());
  // Con cuentas, el alta no abre el formulario: abre antes la hoja del email.
  const [editing, setEditing] = useState(startEditing && !isSupabaseConfigured());
  const account = useAccount();
  const [creating, setCreating] = useState(false);
  const autoStarted = useRef(false);
  useEffect(() => {
    onTop?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, data?.carnet?.userId]);

  const create = async () => {
    if (!repo) return;
    setCreating(true);
    try {
      if (!(await requireAccount('carnet', { onRegistered: () => setEditing(true) }))) return;
      if (!(await repo.carnet.mine())) setEditing(true);
    } finally {
      setCreating(false);
    }
  };

  // «Crear carnet» ya pedido (el QR de alta, la compra): con cuentas, la hoja
  // del email se abre sola una vez, en cuanto se sabe que no hay Carnet.
  const guestWithoutCarnet =
    !!data && !data.carnet && (account.status === 'guest' || account.status === 'incomplete');
  useEffect(() => {
    if (!startEditing || !isSupabaseConfigured() || !guestWithoutCarnet || autoStarted.current)
      return;
    autoStarted.current = true;
    void create();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startEditing, guestWithoutCarnet]);

  if (!data || !repo) return <p className="juego-muted">{t('juego.carnet.cargandoTuCarnet')}</p>;
  const { carnet, extras } = data;

  if (editing) {
    return (
      <CarnetEditor
        repo={repo}
        questions={CARNET_QUESTIONS}
        before={carnet}
        onDone={() => {
          setEditing(false);
          if (!carnet) onCreated?.();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  if (!carnet && account.status !== 'local') {
    // Email first (decision 11): the account sheet asks for the email, the
    // 6-digit code and, for a new account, the Carnet itself; a new
    // registration then continues into the optional questions. Signing into
    // an existing card just shows it.
    return (
      <div data-testid="carnet-invitacion">
        <div className="carnet-hueco">
          <strong>{t('carnet.guest.slotTitle')}</strong>
          <p>{account.signedOut ? t('account.signInToSee') : t('carnet.guest.slotBody')}</p>
        </div>
        <p>{t('carnet.guest.body')}</p>
        <button
          type="button"
          className="acceso-primary"
          data-testid="carnet-crear"
          disabled={creating}
          onClick={() => void create()}
        >
          {account.signedOut ? t('account.signIn') : t('carnet.create')}
        </button>
        <p className="juego-muted">{t('carnet.guest.emailNote')}</p>
        <AccountSection />
      </div>
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
      <OwnCarnet carnet={carnet} extras={extras} onEdit={() => setEditing(true)} />
      <p className="juego-muted" data-testid="carnet-aviso-local">
        {account.status === 'local'
          ? t('juego.carnet.asiLoVeranLos', { LOCAL_ONLY_NOTICE })
          : t('carnet.card.economyNotice')}
      </p>
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
      <AccountSection />
    </div>
  );
}
