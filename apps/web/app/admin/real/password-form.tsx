'use client';

import { type FormEvent, useState } from 'react';
import { passwordChangeFailure } from '../../../lib/account/admin-auth';
import {
  MIN_PASSWORD_LENGTH,
  type PasswordChangeResult,
  runPasswordChange,
} from '../../../lib/admin/password-change';
import { type MessageKey, t } from '../../../lib/i18n';

const MESSAGE: Record<Exclude<PasswordChangeResult, 'ok'>, MessageKey> = {
  empty: 'admin.real.password.empty',
  short: 'admin.real.password.short',
  mismatch: 'admin.real.password.mismatch',
  weak: 'admin.real.password.weak',
  same: 'admin.real.password.same',
  needsAal2: 'admin.real.password.needsAal2',
  error: 'admin.real.password.error',
};

/**
 * Contraseña nueva escrita dos veces (plan 029 T283). Sirve para «Seguridad»
 * y para la página de recuperación: cada una pasa su `change`.
 */
export function PasswordForm({
  change,
  onDone,
  submitLabel,
}: {
  change: (password: string) => Promise<void>;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    const result = await runPasswordChange(password, again, {
      change,
      classify: passwordChangeFailure,
    });
    setBusy(false);
    if (result === 'ok') {
      setPassword('');
      setAgain('');
      setDone(true);
      onDone?.();
      return;
    }
    setError(t(MESSAGE[result], { min: MIN_PASSWORD_LENGTH }));
  };

  return (
    <form className="admin-form" onSubmit={(e) => void submit(e)} data-testid="admin-password-form">
      <label className="admin-field">
        <span className="admin-field__label">{t('admin.real.password.new')}</span>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-testid="admin-password-nueva"
        />
      </label>
      <label className="admin-field">
        <span className="admin-field__label">{t('admin.real.password.again')}</span>
        <input
          type="password"
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          data-testid="admin-password-repetir"
        />
      </label>
      <button
        type="submit"
        className="admin-button"
        disabled={busy}
        data-testid="admin-password-guardar"
      >
        {busy ? t('admin.real.password.saving') : (submitLabel ?? t('admin.real.password.save'))}
      </button>
      {error ? (
        <p
          className="admin-status admin-status--error"
          role="alert"
          data-testid="admin-password-error"
        >
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="admin-status" role="status" data-testid="admin-password-hecho">
          {t('admin.real.password.done')}
        </p>
      ) : null}
    </form>
  );
}
