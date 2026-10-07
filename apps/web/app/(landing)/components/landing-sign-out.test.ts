import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountSnapshot, resetAccountForTests, type AccountStatus } from '../../../lib/account/session';
import type * as UseAccount from '../../../lib/account/use-account';
import { t } from '../../../lib/i18n/web';
import { SiteHeader } from './site-header';

type UseAccountModule = typeof UseAccount;

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
vi.mock('../../../lib/account/use-account', async (importOriginal) => ({
  ...(await importOriginal<UseAccountModule>()),
  useAccount: () => accountSnapshot(),
}));

afterEach(() => {
  route.pathname = '/';
  resetAccountForTests();
});

function header(status: AccountStatus, pathname = '/') {
  resetAccountForTests({ status });
  route.pathname = pathname;
  return renderToStaticMarkup(createElement(SiteHeader, { sections: new Set<string>() }));
}

describe('logout de la landing (T199, decisión 10)', () => {
  it.each(['local', 'loading', 'guest'] as const)('sin sesión (%s) no se muestra', (status) => {
    expect(header(status)).not.toContain('landing-sign-out');
  });

  it.each(['member', 'incomplete'] as const)('con sesión (%s), junto al Carnet en ambos menús', (status) => {
    const html = header(status);
    expect(html.match(/data-testid="landing-sign-out"/g)).toHaveLength(2);
    expect(html).toContain(t('landing.signOut'));
    for (const list of html.split('cabecera-carnet').slice(1)) {
      expect(list.indexOf('landing-sign-out')).toBeLessThan(list.indexOf('cabecera-ranking'));
    }
  });

  it.each(['/mar', '/mar?juego=canon', '/juego', '/eventos/halloween-2026', '/carnet'])('fuera de la landing (%s) no se muestra aunque haya sesión', (pathname) => {
    expect(header('member', pathname)).not.toContain('landing-sign-out');
  });
});
