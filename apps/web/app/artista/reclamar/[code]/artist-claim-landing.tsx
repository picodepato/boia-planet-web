'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import '../../../../lib/mundo/hud.css';
import '../../../../lib/mundo/carnet/carnet.css';
import { cleanClaimCode, rememberClaim } from '../../../../lib/account/artist-claim';
import { accountClient, refreshAccount } from '../../../../lib/account/session';
import { useAccount } from '../../../../lib/account/use-account';
import { carnetHref } from '../../../../lib/artists/entries';
import { t } from '../../../../lib/i18n';
import { MAR_CARNET_HREF } from '../../../../lib/world-handoff';

/** Lo que enseña la página del enlace (plan 031 T296). */
export type ClaimView =
  | { kind: 'checking' }
  /** Sin cuentas (modo local, D-20): el enlace no puede valer aquí. */
  | { kind: 'local' }
  /** Equivocado, gastado, caducado o sustituido: lo mismo para todos. */
  | { kind: 'invalid' }
  /** Vale. Con `nickname`, ya hay sesión con Carnet: se une directamente. */
  | { kind: 'valid'; name: string; nickname: string | null }
  | { kind: 'joining'; name: string }
  | { kind: 'joined'; name: string; carnetHref: string | null }
  | { kind: 'rejected'; name: string; detail: string }
  | { kind: 'offline' };

/** La vista, sin efectos (se prueba sola). */
export function ArtistClaimView({
  view,
  onGo,
  onUseMine,
}: {
  view: ClaimView;
  onGo?: () => void;
  onUseMine?: () => void;
}) {
  const normalSignup = (
    <Link className="idc-btn" href={MAR_CARNET_HREF} data-testid="reclamar-alta-normal">
      {t('carnet.claim.normal')}
    </Link>
  );
  let body: ReactNode;
  switch (view.kind) {
    case 'checking':
      body = <p>{t('carnet.claim.checking')}</p>;
      break;
    case 'local':
      body = (
        <>
          <p data-testid="reclamar-local">{t('carnet.claim.local')}</p>
          {normalSignup}
        </>
      );
      break;
    case 'invalid':
      body = (
        <>
          <h1>{t('carnet.claim.invalidTitle')}</h1>
          <p data-testid="reclamar-no-vale">{t('carnet.claim.invalid')}</p>
          {normalSignup}
        </>
      );
      break;
    case 'valid':
      body = (
        <>
          <h1 data-testid="reclamar-titulo">{t('carnet.claim.title', { name: view.name })}</h1>
          <p>{t('carnet.claim.lead')}</p>
          {view.nickname ? (
            <button
              type="button"
              className="idc-btn"
              onClick={onUseMine}
              data-testid="reclamar-unir-mio"
            >
              {t('carnet.claim.useMine', { nickname: view.nickname })}
            </button>
          ) : (
            <button type="button" className="idc-btn" onClick={onGo} data-testid="reclamar-ir">
              {t('carnet.claim.go')}
            </button>
          )}
        </>
      );
      break;
    case 'joining':
      body = (
        <>
          <h1>{t('carnet.claim.title', { name: view.name })}</h1>
          <p>{t('carnet.claim.joining')}</p>
        </>
      );
      break;
    case 'joined':
      body = (
        <>
          <p data-testid="reclamar-hecho">{t('carnet.claim.joined', { name: view.name })}</p>
          {view.carnetHref ? (
            <Link className="idc-btn" href={view.carnetHref}>
              {t('carnet.claim.seeCarnet')}
            </Link>
          ) : null}
        </>
      );
      break;
    case 'rejected':
      body = (
        <>
          <h1>{t('carnet.claim.title', { name: view.name })}</h1>
          <p role="alert" data-testid="reclamar-rechazo">
            {t('carnet.claim.rejected', { detail: view.detail })}
          </p>
        </>
      );
      break;
    case 'offline':
      body = <p role="alert">{t('carnet.claim.offline')}</p>;
      break;
  }
  return (
    <main className="carnet-page" data-testid="reclamar-perfil" data-estado={view.kind}>
      <div className="carnet-page-inner">{body}</div>
    </main>
  );
}

/** Los rechazos del servidor, en palabras (los demás: «no vale»). */
function rejectionDetail(reason: string): string {
  return reason === 'already_joined' ? t('carnet.claim.alreadyJoined') : t('carnet.claim.invalid');
}

/**
 * La página del enlace: pregunta al servidor si el código vale y de qué ficha
 * es. Sin sesión, guarda el código en la pestaña y lleva al alta del Carnet
 * (la sesión une la ficha cuando hay Carnet: `session.ts`). Con sesión y
 * Carnet, une aquí mismo.
 */
export function ArtistClaimLanding({ code: raw }: { code: string }) {
  const router = useRouter();
  const account = useAccount();
  const code = cleanClaimCode(raw);
  const [info, setInfo] = useState<{ name: string } | 'invalid' | 'offline' | null>(null);
  const [step, setStep] = useState<ClaimView | null>(null);
  const local = account.status === 'local';

  useEffect(() => {
    if (local) return;
    if (!code) {
      setInfo('invalid');
      return;
    }
    let alive = true;
    void (async () => {
      const sb = await accountClient();
      if (!sb) return;
      const { claimInfo } = await import('../../../../lib/account/artist-claim-redeem');
      const res = await claimInfo(sb, code);
      if (!alive) return;
      setInfo(res === null ? 'offline' : res.valid ? { name: res.profile_name } : 'invalid');
    })();
    return () => {
      alive = false;
    };
  }, [code, local]);

  let view: ClaimView;
  if (local) view = { kind: 'local' };
  else if (step) view = step;
  else if (info === null || account.status === 'loading') view = { kind: 'checking' };
  else if (info === 'invalid') view = { kind: 'invalid' };
  else if (info === 'offline') view = { kind: 'offline' };
  else
    view = {
      kind: 'valid',
      name: info.name,
      nickname: account.status === 'member' ? (account.profile?.nickname ?? null) : null,
    };

  const name = typeof info === 'object' && info ? info.name : '';
  const onGo = () => {
    if (code && rememberClaim(code, name)) router.push(MAR_CARNET_HREF);
  };
  const onUseMine = () => {
    if (!code) return;
    setStep({ kind: 'joining', name });
    void (async () => {
      const sb = await accountClient();
      if (!sb) return;
      const m = await import('../../../../lib/account/artist-claim-redeem');
      const o = await m.redeemClaim(sb, code);
      if (o.kind === 'joined') {
        setStep({
          kind: 'joined',
          name: o.name,
          carnetHref: account.userId ? carnetHref(account.userId) : null,
        });
        void refreshAccount().catch(() => undefined);
      } else if (o.kind === 'rejected') {
        setStep(
          o.reason === 'claim_invalid'
            ? { kind: 'invalid' }
            : { kind: 'rejected', name, detail: rejectionDetail(o.reason) },
        );
      } else setStep({ kind: 'offline' });
    })();
  };
  return <ArtistClaimView view={view} onGo={onGo} onUseMine={onUseMine} />;
}
