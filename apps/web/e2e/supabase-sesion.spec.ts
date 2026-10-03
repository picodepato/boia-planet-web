import { expect, test } from '@playwright/test';
import { SUPABASE_AUTH_STORAGE_KEY } from '../lib/supabase/config';
import { E2E_SUPABASE, anonClient, createMember, deleteMembers, signInPage } from './supabase';

/**
 * El interruptor E2E_SUPABASE y la ayuda de entrada (plan 008, T86): una
 * cuenta de prueba entra con su código de 6 cifras (sacado con
 * auth.admin.generateLink) y la página arranca con esa sesión donde la busca
 * el cliente de la web. Sin E2E_SUPABASE=1 se salta.
 */
test.skip(!E2E_SUPABASE, 'sólo con E2E_SUPABASE=1');

test('una cuenta de prueba entra con su código y la página tiene su sesión', async ({ page }) => {
  const member = await createMember('sesion');
  try {
    await signInPage(page, member);
    await page.goto('/');
    const stored = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      SUPABASE_AUTH_STORAGE_KEY,
    );
    expect(stored).not.toBeNull();
    const session = JSON.parse(stored!) as { access_token: string; user: { email: string } };
    expect(session.user.email).toBe(member.email);
    const { data, error } = await anonClient().auth.getUser(session.access_token);
    expect(error).toBeNull();
    expect(data.user?.id).toBe(member.id);
  } finally {
    await deleteMembers([member]);
  }
});
