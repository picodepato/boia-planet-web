import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { PRIVACY_POLICY_VERSION } from '../lib/account/config';
import { SUPABASE_AUTH_STORAGE_KEY } from '../lib/supabase/config';
import { t } from '../lib/i18n/web';
import { E2E_SUPABASE, createMember, deleteMembers, signInSession } from './supabase';
import { supabaseTestEnv } from './supabase-env';
import { pastHero, tap } from './hero-helpers';
import { openMar } from './mar-helpers';

/**
 * «Cerrar sesión» de la landing (plan 017 T199, decisión 10): junto a
 * «Carnet», sólo con sesión y sólo en la home, nunca en /mar. Sin Supabase
 * (modo local, D-20) no hay sesión y no sale; con `E2E_SUPABASE=1`, el
 * recorrido entero con una cuenta de prueba.
 */
test('sin sesión, la landing no tiene logout (también en modo local)', async ({ page }) => {
  await page.goto('/?intro=0');
  await expect(page.getByTestId('cabecera-carnet').first()).toBeAttached();
  await expect(page.getByTestId('landing-sign-out')).toHaveCount(0);
});

for (const withCarnet of [false, true]) {
  test(`con sesión ${withCarnet ? 'y Carnet' : 'sin terminar el Carnet'}: logout sólo en landing y persiste al recargar`, async ({ page }, info) => {
    test.skip(!E2E_SUPABASE, 'sólo con E2E_SUPABASE=1');
    test.setTimeout(120_000);
    const member = await createMember('t199-logout');
    try {
      const session = await signInSession(member);
      if (withCarnet) {
        const env = supabaseTestEnv()!;
        const client = createClient(env.url, env.anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${session.access_token}` } },
        });
        const { error } = await client.rpc('save_profile', {
          p_nickname: `Logout ${info.project.name} ${member.id.slice(0, 6)}`,
          p_privacy_version: PRIVACY_POLICY_VERSION,
        });
        if (error) throw error;
      }
      // Una sola inyección: recargar después de salir no restaura la sesión.
      await page.goto('/?intro=0');
      await page.evaluate(
        ([key, value]) => localStorage.setItem(key, value),
        [SUPABASE_AUTH_STORAGE_KEY, JSON.stringify(session)] as const,
      );
      await page.reload();
      const buttons = page.getByTestId('landing-sign-out');
      await expect(buttons).toHaveCount(2, { timeout: 30_000 });

      await openMar(page, '?menu=carnet');
      await expect(page.getByTestId('landing-sign-out')).toHaveCount(0);
      await expect(page.getByTestId('mar-carnet')).toBeVisible();
      await page.goto('/?intro=0');
      await expect(buttons).toHaveCount(2, { timeout: 30_000 });
      // La cabecera sale al dejar el hero (T79); en móvil, dentro de «Menú».
      await pastHero(page);
      const header = page.locator('.site-header');
      if (info.project.name === 'mobile') await tap(page, header.getByText('Menú', { exact: true }));
      const logout = buttons.filter({ visible: true });
      await expect(logout).toHaveText(t('landing.signOut'));
      const list = logout.locator('..').locator('..');
      await expect(list.getByTestId('cabecera-carnet')).toBeVisible();
      await logout.click();
      await expect(buttons).toHaveCount(0);
      await page.reload();
      await expect(buttons).toHaveCount(0);
      await expect(page.getByTestId('cabecera-carnet').first()).toBeAttached();
    } finally {
      await deleteMembers([member]);
    }
  });
}

/**
 * T203: con «Cerrar sesión» la cabecera de escritorio no se parte en dos líneas.
 * Se inyecta el `li` del logout (mismas clases que el real) para probarlo sin
 * Supabase; `T203_SHOTS=<dir>` guarda capturas.
 */
for (const width of [390, 1024, 1200, 1280, 1440]) {
  test(`cabecera con logout sin saltos de línea a ${width} px`, async ({ page }, info) => {
    test.skip(info.project.name !== (width < 600 ? 'mobile' : 'desktop'), 'un proyecto por ancho');
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/?intro=0');
    await pastHero(page);
    await page.evaluate((label) => {
      const li = document.createElement('li');
      // Mismo marcado que `LandingSignOut`: icono + texto.
      li.innerHTML = `<button type="button" class="site-header__sign-out" data-testid="landing-sign-out"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" fill="none" stroke="currentColor" stroke-width="2"/></svg><span>${label}</span></button>`;
      for (const list of document.querySelectorAll('.site-header__links, .site-header__menu-list')) {
        const clone = li.cloneNode(true);
        list.querySelector('[data-testid="cabecera-carnet"]')!.closest('li')!.after(clone);
      }
    }, t('landing.signOut'));
    // En móvil y hasta 1199 px, lo secundario vive en «Menú»: se abre para comprobarlo.
    if (width < 1200) await tap(page, page.locator('.site-header__menu summary'));
    const items = page.locator(
      '.site-header__links a, .site-header__links button, .site-header__menu-list a, .site-header__menu-list button, .site-header__nav > .button',
    );
    await expect(page.getByTestId('landing-sign-out').filter({ visible: true })).toHaveCount(1);
    const lines = await items.evaluateAll((els) =>
      els
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => {
          // El logout de la fila es un icono (texto sólo para lectores): se mide su caja.
          if (el.matches('.site-header__links button')) {
            return { text: el.textContent, lines: el.getBoundingClientRect().width <= 48 ? 1 : 2 };
          }
          const range = document.createRange();
          range.selectNodeContents(el);
          // Una línea nueva empieza al menos media línea más abajo (el emoji y el texto del
          // sonido difieren unos píxeles en vertical sin ser dos líneas).
          const tops = [...range.getClientRects()].map((r) => r.top).sort((a, b) => a - b);
          const lines = tops.filter((top, i) => i === 0 || top - tops[i - 1]! > 8).length;
          return { text: el.textContent, lines };
        }),
    );
    for (const l of lines) expect(l.lines, l.text ?? '').toBe(1);
    // La fila cabe en la cabecera: nada se sale por la derecha ni solapa al logo.
    const fit = await page.evaluate(() => {
      const brand = document.querySelector('.site-header__brand')!.getBoundingClientRect();
      const nav = document.querySelector('.site-header__nav')!.getBoundingClientRect();
      return { navRight: nav.right, navLeft: nav.left, brandRight: brand.right, vw: innerWidth };
    });
    expect(fit.navRight).toBeLessThanOrEqual(fit.vw);
    expect(fit.navLeft).toBeGreaterThanOrEqual(fit.brandRight);
    if (process.env.T203_SHOTS) {
      await page.screenshot({
        path: `${process.env.T203_SHOTS}/header-${width}.png`,
        clip: { x: 0, y: 0, width, height: width < 1200 ? 520 : 90 },
      });
    }
  });
}
