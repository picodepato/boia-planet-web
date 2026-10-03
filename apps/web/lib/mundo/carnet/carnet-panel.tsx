'use client';

import { CARNET_QUESTIONS } from '@boia/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AccountSection } from '../../account/account-section';
import { requireAccount } from '../../account/gate';
import { accountSnapshot } from '../../account/session';
import { useAccount } from '../../account/use-account';
import { INVITE_COPY } from '../../landing/invitations';
import { t } from '../../i18n';
import { useRepoData } from '../repo';
import { CarnetEditor, LOCAL_ONLY_NOTICE, draftFrom, saveCarnet } from './carnet-editor';
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
 * - `startEditing`: entra ya en el alta (p. ej. desde «Crear mi Carnet»).
 * - `onCreated`: se acaba de crear el Carnet (p. ej. para volver a la compra, T66).
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
  const [editing, setEditing] = useState(startEditing);
  const account = useAccount();
  const [creating, setCreating] = useState(false);
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
        onDone={() => {
          setEditing(false);
          if (!carnet) onCreated?.();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  if (!carnet && account.status !== 'local') {
    // Con cuentas (plan 008, T89): «Crear mi Carnet» pide antes el email
    // (decisión 1); al volver, el Carnet nace con el apodo de la cuenta.
    const create = async () => {
      setCreating(true);
      try {
        if (!(await requireAccount('carnet'))) return;
        if (await repo.carnet.mine()) return;
        const profile = accountSnapshot().profile;
        if (!profile) return;
        await saveCarnet(
          repo,
          null,
          {
            ...draftFrom(null),
            nickname: profile.nickname,
            ...(profile.avatarKey ? { avatarKey: profile.avatarKey } : {}),
          },
          CARNET_QUESTIONS,
        );
        onCreated?.();
      } catch {
        // p. ej. el apodo choca con uno de muestra de este navegador: a mano.
        setEditing(true);
      } finally {
        setCreating(false);
      }
    };
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
