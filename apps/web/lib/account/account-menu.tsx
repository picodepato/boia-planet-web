'use client';

import { t } from '../i18n/web';
import { requireAccount } from './gate';
import type { AccountState } from './session';
import { useSignOutFlow } from './sign-out-flow';
import { useAccount } from './use-account';

/**
 * La cuenta en los menús (plan 029 T284): con sesión, «Tu cuenta» con el
 * apodo y el número del Carnet y «Cerrar sesión» (el mismo de siempre, con
 * su pregunta); sin sesión, «Entrar». En modo local (D-20) o mientras se lee
 * la sesión no se pinta nada.
 */
export type AccountMenuView =
  | { kind: 'none' }
  | { kind: 'signIn' }
  | { kind: 'member'; line: string; nickname: string };

export function accountMenuView(account: AccountState): AccountMenuView {
  if (account.status === 'guest') return { kind: 'signIn' };
  if (account.status === 'member' && account.profile) {
    const { nickname, memberNumber } = account.profile;
    return {
      kind: 'member',
      nickname,
      line: t('cuenta.menu.miembro', { nickname, number: memberNumber }),
    };
  }
  if (account.status === 'member' || account.status === 'incomplete') {
    return { kind: 'member', nickname: '', line: t('cuenta.menu.sinCarnet') };
  }
  return { kind: 'none' };
}

/**
 * «Tu cuenta» dentro del menú de /mar (el Menú de a bordo). «Entrar» abre la
 * hoja de acceso del mar (email y código); una cuenta nueva sigue en su
 * Carnet (`onRegistered`).
 */
export function MarAccountMenu({ onRegistered }: { onRegistered?: () => void }) {
  const view = accountMenuView(useAccount());
  const out = useSignOutFlow();
  if (view.kind === 'none') return null;
  return (
    <section
      className="mar-menu__group mar-menu__cuenta"
      data-testid="mar-menu-cuenta"
      data-estado={view.kind}
    >
      <h3 className="mar-menu__label">{t('cuenta.menu.titulo')}</h3>
      {view.kind === 'signIn' ? (
        <button
          type="button"
          className="mar-menu__mood"
          data-testid="mar-menu-cuenta-entrar"
          aria-label={t('cuenta.menu.entrarAria')}
          aria-haspopup="dialog"
          onClick={() =>
            void requireAccount('carnet', onRegistered ? { onRegistered } : {})
          }
        >
          {t('cuenta.menu.entrar')}
        </button>
      ) : (
        <div className="mar-menu__cuenta-fila">
          <span className="mar-menu__cuenta-quien" data-testid="mar-menu-cuenta-quien">
            {view.line}
          </span>
          <button
            type="button"
            className="mar-menu__mood"
            data-testid="mar-menu-cuenta-salir"
            aria-haspopup="dialog"
            disabled={out.busy}
            onClick={out.ask}
          >
            {t('cuenta.salir.si')}
          </button>
        </div>
      )}
      {out.dialog}
    </section>
  );
}
