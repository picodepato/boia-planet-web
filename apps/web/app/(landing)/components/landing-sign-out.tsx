'use client';

import { usePathname } from 'next/navigation';
import { accountMenuView } from '../../../lib/account/account-menu';
import { useSignOutFlow } from '../../../lib/account/sign-out-flow';
import { useAccount } from '../../../lib/account/use-account';
import { t } from '../../../lib/i18n/web';
import { CARNET_PATH, CREATE_PARAM } from '../../../lib/scanner/carnet-url';

/** «Entrar» de la landing: el alta del Carnet, que con cuentas empieza por el email y su código. */
const SIGN_IN_HREF = `${CARNET_PATH}?${CREATE_PARAM}=1`;

/**
 * La cuenta en la cabecera de la landing, la que aparece al bajar (decisión
 * 10, T199; plan 029 T284), sólo en la home y sólo con cuentas: con sesión,
 * «Tu cuenta» (apodo y número del Carnet; en la fila de escritorio, en el
 * título del icono) y «Cerrar sesión», que pregunta y deja este dispositivo
 * de cero (`useSignOutFlow`); sin sesión, «Entrar».
 */
export function LandingSignOut() {
  const account = useAccount();
  const pathname = usePathname();
  const out = useSignOutFlow();
  const view = accountMenuView(account);
  if (pathname !== '/' || view.kind === 'none') return null;

  if (view.kind === 'signIn') {
    return (
      <li>
        <a
          href={SIGN_IN_HREF}
          data-testid="landing-entrar"
          aria-label={t('cuenta.menu.entrarAria')}
        >
          {t('cuenta.menu.entrar')}
        </a>
      </li>
    );
  }

  const label = view.nickname
    ? `${t('cuenta.menu.titulo')}: ${view.line}. ${t('cuenta.menu.salirAria', { nickname: view.nickname })}`
    : t('landing.signOut');
  return (
    <>
      <li className="site-header__account" data-testid="landing-cuenta">
        <small>{t('cuenta.menu.titulo')}</small>
        <span>{view.line}</span>
      </li>
      <li>
        <button
          type="button"
          className="site-header__sign-out"
          data-testid="landing-sign-out"
          disabled={out.busy}
          title={label}
          aria-haspopup="dialog"
          onClick={out.ask}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          <span>{t('landing.signOut')}</span>
        </button>
        {out.dialog}
      </li>
    </>
  );
}
