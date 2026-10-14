import { describe, expect, it } from 'vitest';
import { t } from '../i18n/web';
import { accountMenuView } from './account-menu';
import { type AccountState, accountSnapshot, resetAccountForTests } from './session';

function state(patch: Partial<AccountState>): AccountState {
  resetAccountForTests(patch);
  return accountSnapshot();
}

describe('la cuenta en los menús (plan 029 T284)', () => {
  it('en modo local o mientras se lee la sesión, nada', () => {
    expect(accountMenuView(state({ status: 'local' }))).toEqual({ kind: 'none' });
    expect(accountMenuView(state({ status: 'loading' }))).toEqual({ kind: 'none' });
  });

  it('sin sesión, «Entrar»', () => {
    expect(accountMenuView(state({ status: 'guest' }))).toEqual({ kind: 'signIn' });
    expect(accountMenuView(state({ status: 'guest', signedOut: true }))).toEqual({
      kind: 'signIn',
    });
  });

  it('con Carnet, el apodo y el número; sin terminarlo, que aún no hay Carnet', () => {
    const member = state({
      status: 'member',
      profile: {
        nickname: 'Grumete',
        memberNumber: 7,
        memberSince: '2026-10-01',
        avatarKey: null,
        isArtist: false,
      },
    });
    expect(accountMenuView(member)).toEqual({
      kind: 'member',
      nickname: 'Grumete',
      line: t('cuenta.menu.miembro', { nickname: 'Grumete', number: 7 }),
    });
    expect(accountMenuView(state({ status: 'incomplete' }))).toEqual({
      kind: 'member',
      nickname: '',
      line: t('cuenta.menu.sinCarnet'),
    });
  });
});
