'use client';

import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  checkDemoAdmin,
  endDemoSession,
  hasDemoSession,
  startDemoSession,
} from '../../lib/admin/demo-auth';
import { t } from '../../lib/i18n';
import { AdminApp } from './admin-app';

/**
 * /admin en modo local (D-20) con la puerta del Carnet 000 (plan 017 T193,
 * decisión 9): el número 000 y la contraseña, comprobada en el navegador
 * contra un hash con sal. Dentro, el «Probar admin» de siempre.
 */
export function DemoAdminGate() {
  const [inside, setInside] = useState<boolean | null>(null);
  useEffect(() => setInside(hasDemoSession()), []);
  const signOut = useCallback(() => {
    endDemoSession();
    setInside(false);
  }, []);

  if (inside === null) {
    return (
      <div className="admin" data-testid="admin-login">
        <main className="admin-login">
          <div className="admin-card admin-login__card">
            <p>{t('admin.real.login.loading')}</p>
          </div>
        </main>
      </div>
    );
  }
  if (inside) return <AdminApp demo={{ signOut }} />;
  return <DemoLogin onDone={() => setInside(true)} />;
}

function DemoLogin({ onDone }: { onDone: () => void }) {
  const [carnet, setCarnet] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setWrong(false);
    let ok = false;
    try {
      ok = await checkDemoAdmin(carnet, password);
    } catch (err) {
      console.warn('[boia] admin demo: no se pudo comprobar', err);
    }
    if (ok) {
      startDemoSession();
      onDone();
      return;
    }
    setWrong(true);
    setBusy(false);
  };

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
        <div className="admin-card admin-login__card">
          <h2>{t('admin.demoLogin.title')}</h2>
          <p className="admin-lead">{t('admin.demoLogin.lead')}</p>
          <form className="admin-form" onSubmit={(e) => void submit(e)}>
            <label className="admin-field">
              <span className="admin-field__label">{t('admin.demoLogin.carnet')}</span>
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
              <span className="admin-field__label">{t('admin.demoLogin.password')}</span>
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
              {busy ? t('admin.demoLogin.checking') : t('admin.demoLogin.enter')}
            </button>
          </form>
          {wrong ? (
            <p className="admin-status admin-status--error" role="alert" data-testid="admin-login-error">
              {t('admin.demoLogin.wrong')}
            </p>
          ) : (
            <p className="admin-status" role="status" />
          )}
        </div>
      </main>
    </div>
  );
}
