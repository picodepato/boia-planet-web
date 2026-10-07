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
