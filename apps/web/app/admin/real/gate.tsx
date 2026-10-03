'use client';

import Link from 'next/link';
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  type AdminStep,
  type TotpEnrollment,
  adminSignOut,
  adminStep,
  enrollTotp,
  sendAdminCode,
  verifiedTotp,
  verifyAdminCode,
  verifyTotp,
} from '../../../lib/account/admin-auth';
import { authProblem, looksLikeEmail } from '../../../lib/account/errors';
import { t } from '../../../lib/i18n';
import { AdminApp } from '../admin-app';

type GateState = AdminStep | { step: 'loading' } | { step: 'error' };

/**
 * /admin con cuentas (T94, decisión 11): el código del email, después el
 * TOTP (alta con QR la primera vez) y dentro. Sin rol del equipo, «sin
 * acceso». Sin Supabase no se usa: /admin es la demo local de siempre.
 */
export function RealAdminGate() {
  const [state, setState] = useState<GateState>({ step: 'loading' });
  const refresh = useCallback(async () => {
    try {
      setState(await adminStep());
    } catch (e) {
      console.warn('[boia] admin: no se pudo leer la sesión', e);
      setState({ step: 'error' });
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const signOut = useCallback(async () => {
    await adminSignOut().catch(() => undefined);
    setState({ step: 'email' });
  }, []);

  if (state.step === 'ready') {
    return (
      <AdminApp real={{ email: state.email, role: state.role, userId: state.userId, signOut }} />
    );
  }
  return (
    <Shell>
      {state.step === 'loading' ? <p>{t('admin.real.login.loading')}</p> : null}
      {state.step === 'error' ? (
        <p role="alert" className="admin-status admin-status--error">
          {t('admin.real.login.loadError')}
        </p>
      ) : null}
      {state.step === 'email' ? <EmailCode onDone={refresh} /> : null}
      {state.step === 'mfa' ? (
        <Totp email={state.email} onDone={refresh} onSignOut={signOut} />
      ) : null}
      {state.step === 'noAccess' ? <NoAccess email={state.email} onSignOut={signOut} /> : null}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="admin" data-testid="admin-login">
      <header className="admin-top">
        <h1>{t('admin.adminApp.boiaAdmin')}</h1>
        <nav className="admin-top__links" aria-label={t('admin.adminApp.verLosCambios')}>
          <Link href="/?intro=0" prefetch={false}>
            {t('admin.adminApp.verLaWeb')}
          </Link>
        </nav>
      </header>
      <main className="admin-login">
        <div className="admin-card admin-login__card">{children}</div>
      </main>
    </div>
  );
}

function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <p className="admin-status admin-status--error" role="alert" data-testid="admin-login-error">
      {text}
    </p>
  ) : (
    <p className="admin-status" role="status" />
  );
}

function problemText(e: unknown, sentAt: number | null): string {
  switch (authProblem(e, sentAt)) {
    case 'wrong':
      return t('admin.real.login.wrong');
    case 'expired':
      return t('admin.real.login.expired');
    case 'tooMany':
      return t('admin.real.login.tooMany');
    case 'invalidEmail':
      return t('admin.real.login.invalidEmail');
    case 'network':
      return t('admin.real.login.network');
    default:
      return t('admin.real.login.unknown');
  }
}

function EmailCode({ onDone }: { onDone: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!looksLikeEmail(email)) {
      setError(t('admin.real.login.invalidEmail'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendAdminCode(email);
      setSentAt(Date.now());
    } catch (err) {
      setError(problemText(err, null));
    } finally {
      setBusy(false);
    }
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyAdminCode(email, code.replace(/\D/g, ''));
      await onDone();
    } catch (err) {
      setError(problemText(err, sentAt));
      setBusy(false);
    }
  };

  return (
    <>
      <h2>{t('admin.real.login.title')}</h2>
      <p className="admin-lead">{t('admin.real.login.lead')}</p>
      {sentAt === null ? (
        <form className="admin-form" onSubmit={send}>
          <label className="admin-field">
            <span className="admin-field__label">{t('admin.real.login.email')}</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="admin-login-email"
            />
          </label>
          <button
            type="submit"
            className="admin-button"
            disabled={busy}
            data-testid="admin-login-enviar"
          >
            {t('admin.real.login.send')}
          </button>
        </form>
      ) : (
        <form className="admin-form" onSubmit={verify}>
          <p className="admin-meta" data-testid="admin-login-enviado">
            {t('admin.real.login.sent', { email: email.trim() })}
          </p>
          <label className="admin-field">
            <span className="admin-field__label">{t('admin.real.login.code')}</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              data-testid="admin-login-codigo"
            />
          </label>
          <div className="admin-row">
            <button
              type="submit"
              className="admin-button"
              disabled={busy || code.length !== 6}
              data-testid="admin-login-entrar"
            >
              {t('admin.real.login.enter')}
            </button>
            <button
              type="button"
              className="admin-button admin-button--ghost"
              disabled={busy}
              onClick={() => {
                setSentAt(null);
                setCode('');
              }}
            >
              {t('admin.real.login.otherEmail')}
            </button>
          </div>
        </form>
      )}
      <ErrorLine text={error} />
    </>
  );
}

function Totp({
  email,
  onDone,
  onSignOut,
}: {
  email: string | null;
  onDone: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [factor, setFactor] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const verified = await verifiedTotp();
        if (verified) {
          setFactor(verified);
          return;
        }
        const e = await enrollTotp();
        setEnrollment(e);
        setFactor(e.factorId);
      } catch (err) {
        console.warn('[boia] admin: TOTP', err);
        setError(t('admin.real.totp.setupError'));
      }
    })();
  }, []);

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!factor) return;
    setBusy(true);
    setError(null);
    try {
      await verifyTotp(factor, code);
      await onDone();
    } catch {
      setError(t('admin.real.totp.wrong'));
      setBusy(false);
    }
  };

  return (
    <>
      <h2>{t('admin.real.totp.title')}</h2>
      <p className="admin-meta">{t('admin.real.signedInAs', { email: email ?? '—' })}</p>
      {enrollment ? (
        <div className="admin-totp" data-testid="admin-totp-alta">
          <p className="admin-lead">{t('admin.real.totp.enrollLead')}</p>
          {/* El QR lo da Supabase como SVG en data: (nada se carga de fuera). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrollment.qrCode}
            alt={t('admin.real.totp.qrAlt')}
            width={200}
            height={200}
            className="admin-totp__qr"
            data-testid="admin-totp-qr"
          />
          <p className="admin-meta">
            {t('admin.real.totp.secret')}{' '}
            <code data-testid="admin-totp-secreto">{enrollment.secret}</code>
          </p>
        </div>
      ) : factor ? (
        <p className="admin-lead">{t('admin.real.totp.verifyLead')}</p>
      ) : (
        <p>{t('admin.real.login.loading')}</p>
      )}
      {factor ? (
        <form className="admin-form" onSubmit={verify}>
          <label className="admin-field">
            <span className="admin-field__label">{t('admin.real.totp.code')}</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              data-testid="admin-totp-codigo"
            />
          </label>
          <button
            type="submit"
            className="admin-button"
            disabled={busy || code.length !== 6}
            data-testid="admin-totp-entrar"
          >
            {t('admin.real.login.enter')}
          </button>
        </form>
      ) : null}
      <ErrorLine text={error} />
      <button type="button" className="admin-link" onClick={() => void onSignOut()}>
        {t('admin.real.signOut')}
      </button>
    </>
  );
}

function NoAccess({ email, onSignOut }: { email: string | null; onSignOut: () => Promise<void> }) {
  return (
    <div data-testid="admin-sin-acceso">
      <h2>{t('admin.real.noAccess.title')}</h2>
      <p className="admin-lead">{t('admin.real.noAccess.lead', { email: email ?? '—' })}</p>
      <div className="admin-row">
        <button
          type="button"
          className="admin-button admin-button--ghost"
          onClick={() => void onSignOut()}
          data-testid="admin-salir"
        >
          {t('admin.real.signOut')}
        </button>
        <Link href="/?intro=0" prefetch={false}>
          {t('admin.adminApp.verLaWeb')}
        </Link>
      </div>
    </div>
  );
}
