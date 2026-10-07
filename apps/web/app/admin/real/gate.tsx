'use client';

import Link from 'next/link';
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  type AdminStep,
  type TotpEnrollment,
  adminSignOut,
  adminStep,
  WrongCarnetLogin,
  enrollTotp,
  redeemBackupCode,
  sendAdminCode,
  signInWithCarnet,
  verifiedTotp,
  verifyAdminCode,
  verifyTotp,
} from '../../../lib/account/admin-auth';
import { authProblem, looksLikeEmail } from '../../../lib/account/errors';
import { looksLikeBackupCode } from '../../../lib/admin/backup-codes';
import { t } from '../../../lib/i18n';
import { AdminApp } from '../admin-app';

type GateState = AdminStep | { step: 'loading' } | { step: 'error' };

/**
 * /admin con cuentas (T94, decisión 11): el código del email, después el
 * TOTP (alta con QR la primera vez) y dentro. Sin rol del equipo, «sin
 * acceso». Sin Supabase no se usa: /admin es la demo local de siempre.
 *
 * Plan 017 T193 (decisión 9): lo primero es el Carnet 000 con la contraseña
 * de su cuenta; el código del email queda para el resto del equipo. En el
 * paso del TOTP, un código de respaldo de un solo uso da de alta otro.
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
      {state.step === 'email' ? <SignIn onDone={refresh} /> : null}
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

function SignIn({ onDone }: { onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<'carnet' | 'email'>('carnet');
  return (
    <>
      {mode === 'carnet' ? <CarnetPassword onDone={onDone} /> : <EmailCode onDone={onDone} />}
      <button
        type="button"
        className="admin-link"
        data-testid={mode === 'carnet' ? 'admin-login-usar-email' : 'admin-login-usar-carnet'}
        onClick={() => setMode(mode === 'carnet' ? 'email' : 'carnet')}
      >
        {mode === 'carnet' ? t('admin.real.carnet.useEmail') : t('admin.real.carnet.useCarnet')}
      </button>
    </>
  );
}

function CarnetPassword({ onDone }: { onDone: () => Promise<void> }) {
  const [carnet, setCarnet] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithCarnet(carnet, password);
      await onDone();
    } catch (err) {
      setError(
        err instanceof WrongCarnetLogin ? t('admin.real.carnet.wrong') : problemText(err, null),
      );
      setBusy(false);
    }
  };

  return (
    <>
      <h2>{t('admin.real.carnet.title')}</h2>
      <p className="admin-lead">{t('admin.real.carnet.lead')}</p>
      <form className="admin-form" onSubmit={(e) => void submit(e)}>
        <label className="admin-field">
          <span className="admin-field__label">{t('admin.real.carnet.number')}</span>
          <input
            inputMode="numeric"
            autoComplete="username"
            placeholder="000"
            value={carnet}
            onChange={(e) => setCarnet(e.target.value)}
            data-testid="admin-login-carnet"
          />
        </label>
        <label className="admin-field">
          <span className="admin-field__label">{t('admin.real.carnet.password')}</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="admin-login-password"
          />
        </label>
        <button
          type="submit"
          className="admin-button"
          disabled={busy || !carnet.trim() || !password}
          data-testid="admin-login-carnet-entrar"
        >
          {t('admin.real.carnet.enter')}
        </button>
      </form>
      <ErrorLine text={error} />
    </>
  );
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
  const [backup, setBackup] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const started = useRef(false);

  // El TOTP verificado o, si no hay (primera vez o tras un código de
  // respaldo), un alta nueva con su QR.
  const start = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  const submitBackup = async (backupCode: string) => {
    setBusy(true);
    setError(null);
    try {
      const left = await redeemBackupCode(backupCode);
      setBackup(false);
      setFactor(null);
      setEnrollment(null);
      setCode('');
      setNotice(t('admin.real.backup.used', { left }));
      await start();
    } catch {
      setError(t('admin.real.backup.wrong'));
    } finally {
      setBusy(false);
    }
  };

  if (backup) {
    return (
      <>
        <h2>{t('admin.real.backup.useTitle')}</h2>
        <p className="admin-meta">{t('admin.real.signedInAs', { email: email ?? '—' })}</p>
        <BackupCodeForm busy={busy} onSubmit={(c) => void submitBackup(c)} />
        <ErrorLine text={error} />
        <button
          type="button"
          className="admin-link"
          onClick={() => {
            setBackup(false);
            setError(null);
          }}
        >
          {t('admin.real.backup.back')}
        </button>
      </>
    );
  }

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
      {notice ? (
        <p className="admin-status" role="status" data-testid="admin-respaldo-aceptado">
          {notice}
        </p>
      ) : null}
      <ErrorLine text={error} />
      {!enrollment ? (
        <button
          type="button"
          className="admin-link"
          data-testid="admin-respaldo-usar"
          onClick={() => {
            setBackup(true);
            setError(null);
          }}
        >
          {t('admin.real.backup.useLink')}
        </button>
      ) : null}
      <button type="button" className="admin-link" onClick={() => void onSignOut()}>
        {t('admin.real.signOut')}
      </button>
    </>
  );
}

function BackupCodeForm({ busy, onSubmit }: { busy: boolean; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('');
  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(code);
      }}
    >
      <p className="admin-lead">{t('admin.real.backup.useLead')}</p>
      <label className="admin-field">
        <span className="admin-field__label">{t('admin.real.backup.code')}</span>
        <input
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={16}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          data-testid="admin-respaldo-codigo"
        />
      </label>
      <button
        type="submit"
        className="admin-button"
        disabled={busy || !looksLikeBackupCode(code)}
        data-testid="admin-respaldo-entrar"
      >
        {t('admin.real.backup.use')}
      </button>
    </form>
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
