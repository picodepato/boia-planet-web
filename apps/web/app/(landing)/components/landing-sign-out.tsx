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
        onClick={() => void leave()}
      >
        {t('landing.signOut')}
      </button>
      {failed ? <p role="alert">{t('landing.signOut.failed')}</p> : null}
    </li>
  );
}
