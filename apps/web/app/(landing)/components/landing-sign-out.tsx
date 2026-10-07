'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { signOut } from '../../../lib/account/session';
import { showAccountNotice, useAccount } from '../../../lib/account/use-account';
import { t } from '../../../lib/i18n/web';

/** Decisión 10 (T199): junto al Carnet, sólo en la home y con sesión. */
export function LandingSignOut() {
  const account = useAccount();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (pathname !== '/' || (account.status !== 'member' && account.status !== 'incomplete'))
    return null;

  const leave = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await signOut();
      const { resetLocalGuest } = await import('../../../lib/account/guest');
      await resetLocalGuest();
      showAccountNotice('account.signedOut');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li>
      <button
        type="button"
        className="site-header__sign-out"
        data-testid="landing-sign-out"
        disabled={busy}
        title={t('landing.signOut')}
        onClick={() => void leave()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
        <span>{t('landing.signOut')}</span>
      </button>
      {failed ? <p role="alert">{t('landing.signOut.failed')}</p> : null}
    </li>
  );
}
