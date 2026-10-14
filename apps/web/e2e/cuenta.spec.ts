import { MemoryStorage, STORE_KEY, createLocalRepository } from '@boia/store';
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { SETTINGS_KEY, SHIP_SKIN_STORAGE_KEY } from '@boia/engine/ui';
import { PRIVACY_POLICY_VERSION } from '../lib/account/config';
import { MOOD_STORAGE_KEY } from '../lib/mundo/mar-keys';
import { CANON_BEST_KEY } from '../lib/mundo/ranking-canon';
import { SHIP_POSITION_KEY } from '../lib/mundo/ship-position';
import { t } from '../lib/i18n';
import { openMar } from './mar-helpers';
import {
  E2E_SUPABASE,
  createMember,
  deleteMembers,
  serviceClient,
  signInPage,
  signInSession,
  testEmail,
  type TestMember,
} from './supabase';
import { supabaseTestEnv } from './supabase-env';

/**
 * La cuenta con email (plan 008, T89, decisiones 1–5), en /mar: «Crear mi
 * Carnet» pide el email, llega el código de 6 cifras (aquí, sacado con
 * auth.admin.generateLink; el envío del navegador se responde sin mandar
 * correo), la cuenta nueva elige un apodo libre y acepta la política; lo del
 * invitado pasa a la cuenta; se cierra sesión y se vuelve a entrar; se borra
 * la cuenta. Sólo con E2E_SUPABASE=1; cada prueba borra sus cuentas.
 */
test.skip(!E2E_SUPABASE, 'sólo con E2E_SUPABASE=1');
test.describe.configure({ timeout: 240_000 });

const created: TestMember[] = [];

test.afterAll(async () => {
  await deleteMembers(created);
});

/** El navegador pide el código: se responde «enviado» sin mandar ningún correo. */
async function stubCodeEmail(page: Page) {
  await page.route('**/auth/v1/otp**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
}

/**
 * El código que llegaría al buzón. Supabase deja pedir uno por email cada
 * 60 s: si es pronto, se espera y se vuelve a pedir. Crea la cuenta si no existe.
 */
async function codeFor(email: string): Promise<{ otp: string; id: string }> {
  const deadline = Date.now() + 90_000;
  for (;;) {
    const { data, error } = await serviceClient().auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    const otp = data?.properties?.email_otp;
    if (!error && otp && data.user) return { otp, id: data.user.id };
    if (Date.now() > deadline) throw new Error(`generateLink: ${error?.message ?? 'sin código'}`);
    await new Promise((r) => setTimeout(r, 5_000));
  }
}

/** Una cuenta que ya tiene su Carnet (apodo único de esta ejecución). */
async function memberWithCarnet(label: string): Promise<TestMember & { nickname: string }> {
  const m = await createMember(label);
  created.push(m);
  const env = supabaseTestEnv()!;
  const session = await signInSession(m);
  const client = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  const nickname = `${label} ${m.id.slice(0, 6)}`;
  const { error } = await client.rpc('save_profile', {
    p_nickname: nickname,
    p_privacy_version: PRIVACY_POLICY_VERSION,
  });
  if (error) throw new Error(`save_profile: ${error.message}`);
  return { ...m, nickname };
}

async function openCarnet(page: Page) {
  await page.getByTestId('mar-enlace-carnet').click();
  const sheet = page.getByTestId('mar-carnet');
  await expect(sheet).toBeVisible();
  return sheet;
}

/** Paso 1 y 2 de la hoja: email y código. */
async function signInWithCode(page: Page, email: string): Promise<string> {
  const sheet = page.getByTestId('acceso');
  await expect(sheet).toHaveAttribute('data-paso', 'email');
  await sheet.getByTestId('acceso-email-input').fill(email);
  await sheet.getByTestId('acceso-enviar').click();
  await expect(sheet).toHaveAttribute('data-paso', 'code');
  await expect(sheet.getByTestId('acceso-codigo')).toContainText(email);
  const { otp, id } = await codeFor(email);
  await sheet.getByTestId('acceso-codigo-input').fill(otp);
  return id;
}

test('cuenta nueva: código, apodo libre, ocupado no; sin la política no se crea', async ({
  page,
}, info) => {
  const other = await memberWithCarnet(`Ocupado ${info.project.name}`);
  await stubCodeEmail(page);
  const errors = await openMar(page);
  const carnet = await openCarnet(page);
  // Invitado: el hueco del Carnet y la invitación (marco 4).
  await expect(carnet.getByTestId('carnet-invitacion')).toContainText(t('carnet.guest.slotTitle'));
  await carnet.getByTestId('carnet-crear').click();

  const sheet = page.getByTestId('acceso');
  await expect(sheet).toHaveAttribute('data-motivo', 'carnet');
  await expect(sheet.getByTestId('acceso-por-que')).toContainText(t('auth.why.carnet'));
  // El email se valida al enviar.
  await sheet.getByTestId('acceso-email-input').fill('grumete@example');
  await sheet.getByTestId('acceso-enviar').click();
  await expect(sheet.getByTestId('acceso-error')).toHaveText(t('auth.email.invalid'));

  const email = testEmail(`nueva-${info.project.name}`);
  const id = await signInWithCode(page, email);
  created.push({ id, email });

  // Paso 3: la cuenta no tiene Carnet.
  await expect(sheet).toHaveAttribute('data-paso', 'nickname');
  const create = sheet.getByTestId('acceso-crear');
  const nick = sheet.getByTestId('acceso-apodo');
  await nick.fill(other.nickname.toUpperCase());
  await expect(sheet.getByTestId('acceso-apodo-error')).toHaveText(t('auth.new.nicknameTaken'));
  await expect(create).toBeDisabled();

  const mine = `Grumete ${id.slice(0, 8)}`;
  await nick.fill(mine);
  await expect(sheet.getByTestId('acceso-apodo-libre')).toBeVisible();
  // Sin la política no se crea, y se dice por qué.
  await expect(sheet.getByTestId('acceso-privacidad')).not.toBeChecked();
  await expect(sheet.getByTestId('acceso-noticias')).not.toBeChecked();
  await expect(create).toBeDisabled();
  await expect(sheet.getByTestId('acceso-falta')).toHaveText(t('auth.new.missingPrivacy'));

  await sheet.getByTestId('acceso-privacidad').check();
  await expect(create).toBeEnabled();
  await create.click();
  await expect(sheet.getByTestId('acceso-numero')).toContainText('Ya eres miembro de BOIA, nº');
  await sheet.getByTestId('acceso-seguir').click();
  await expect(sheet).toBeHidden();

  // Un alta nueva sigue en las preguntas opcionales del Carnet (plan 019
  // T218, decisión 11), con el apodo de la cuenta; se guardan sin contestar.
  const form = carnet.getByTestId('carnet-form');
  await expect(form).toBeVisible();
  await expect(form.getByTestId('carnet-apodo-input')).toHaveValue(mine);
  await form.getByTestId('carnet-guardar').click();

  // El Carnet nace con el apodo de la cuenta y «Tu cuenta» enseña el email.
  await expect(carnet.getByTestId('carnet-apodo')).toHaveText(mine);
  await expect(carnet.getByTestId('cuenta-email')).toHaveText(email);
  await expect(carnet.getByTestId('cuenta-politica')).toContainText(PRIVACY_POLICY_VERSION);

  // En el servidor: el Carnet y los consentimientos con su versión.
  const service = serviceClient();
  const { data: row } = await service.from('carnets').select('nickname').eq('user_id', id).single();
  expect(row?.nickname).toBe(mine);
  const { data: consents } = await service
    .from('consents')
    .select('kind, granted, policy_version')
    .eq('user_id', id);
  expect(consents).toEqual(
    expect.arrayContaining([
      { kind: 'privacy', granted: true, policy_version: PRIVACY_POLICY_VERSION },
      { kind: 'news', granted: false, policy_version: PRIVACY_POLICY_VERSION },
    ]),
  );
  expect(errors).toEqual([]);
});

test('un invitado con puntos entra en su cuenta y los puntos pasan a ella', async ({
  page,
}, info) => {
  const m = await memberWithCarnet(`Puntos ${info.project.name}`);
  // Este navegador ya había jugado: dos premios del mundo, 20 + 30 puntos.
  const storage = new MemoryStorage();
  const repo = createLocalRepository({ storage, watch: false });
  await repo.progress.grantWorldReward({ sourceRef: 'lugar:cala:points', points: 20 });
  await repo.progress.grantWorldReward({ sourceRef: 'lugar:roca:points', points: 30 });
  const doc = storage.getItem(STORE_KEY)!;
  await page.addInitScript(
    ([key, value]) => {
      if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
    },
    [STORE_KEY, doc] as const,
  );
  await stubCodeEmail(page);
  await openMar(page);
  const carnet = await openCarnet(page);
  await carnet.getByTestId('carnet-crear').click();
  await signInWithCode(page, m.email);

  // Cuenta con Carnet: sin paso 3; avisa y termina lo que hacía.
  await expect(page.getByTestId('acceso')).toBeHidden();
  await expect(page.getByTestId('cuenta-aviso')).toHaveText(
    t('auth.signedIn', { nickname: m.nickname }),
  );
  await expect(carnet.getByTestId('carnet-apodo')).toHaveText(m.nickname);

  const { data } = await serviceClient()
    .from('point_balances')
    .select('points')
    .eq('user_id', m.id)
    .single();
  expect(data?.points).toBe(50);
});

test('cerrar sesión y volver a entrar', async ({ page }, info) => {
  const m = await memberWithCarnet(`Vuelve ${info.project.name}`);
  await signInPage(page, m);
  await stubCodeEmail(page);
  await openMar(page);
  const carnet = await openCarnet(page);
  await expect(carnet.getByTestId('cuenta-email')).toHaveText(m.email);
  // El Carnet sale de la cuenta (T90): nada que crear en este navegador.
  await expect(carnet.getByTestId('carnet-apodo')).toHaveText(m.nickname);

  await carnet.getByTestId('cuenta-cerrar-sesion').click();
  // Plan 029 T284: primero pregunta.
  await expect(page.getByTestId('cuenta-salir-texto')).toHaveText(t('cuenta.salir.texto'));
  await page.getByTestId('cuenta-salir-si').click();
  await expect(page.getByTestId('cuenta-aviso')).toHaveText(t('account.signedOut'));
  // Este navegador vuelve a ser invitado: el hueco con «Entrar».
  await expect(carnet.getByTestId('carnet-invitacion')).toContainText(t('account.signInToSee'));
  await expect(carnet.getByTestId('cuenta')).toHaveCount(0);
  await carnet.getByTestId('carnet-crear').click();
  await signInWithCode(page, m.email);
  await expect(page.getByTestId('acceso')).toBeHidden();
  await expect(page.getByTestId('cuenta-aviso')).toHaveText(
    t('auth.signedIn', { nickname: m.nickname }),
  );
  await expect(carnet.getByTestId('carnet-apodo')).toHaveText(m.nickname);
  await expect(carnet.getByTestId('cuenta-email')).toHaveText(m.email);
});

/** Lo guardado en este navegador, para ver qué queda tras cerrar sesión. */
async function deviceKeys(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const out: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      out[k] = localStorage.getItem(k)!;
    }
    return out;
  });
}

async function pointsOf(id: string): Promise<number> {
  const { data } = await serviceClient()
    .from('point_balances')
    .select('points')
    .eq('user_id', id)
    .maybeSingle();
  return Number(data?.points ?? 0);
}

test('cerrar sesión deja este móvil de cero; cada cuenta ve sólo lo suyo (plan 029 T284)', async ({
  page,
}, info) => {
  const a = await memberWithCarnet(`DeCeroA ${info.project.name}`);
  const b = await memberWithCarnet(`DeCeroB ${info.project.name}`);
  // A ya había jugado en este móvil como invitado: 20 + 30 puntos.
  const storage = new MemoryStorage();
  const repo = createLocalRepository({ storage, watch: false });
  await repo.progress.grantWorldReward({ sourceRef: 'lugar:cala:points', points: 20 });
  await repo.progress.grantWorldReward({ sourceRef: 'lugar:roca:points', points: 30 });
  const doc = storage.getItem(STORE_KEY)!;
  await page.addInitScript(
    ([key, value]) => {
      if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
    },
    [STORE_KEY, doc] as const,
  );
  await stubCodeEmail(page);
  await openMar(page);
  // Preferencias del móvil y cosas del juego guardadas aquí.
  await page.evaluate(
    ([prefs, game]) => {
      for (const [k, v] of prefs) localStorage.setItem(k, v);
      for (const k of game) localStorage.setItem(k, '{"de":"A"}');
    },
    [
      [
        [MOOD_STORAGE_KEY, 'noche'],
        [SETTINGS_KEY, JSON.stringify({ music: { enabled: false, volume: 0.2 } })],
      ],
      [CANON_BEST_KEY, SHIP_SKIN_STORAGE_KEY, SHIP_POSITION_KEY],
    ] as const,
  );

  // A entra: lo del invitado pasa a su cuenta.
  let carnet = await openCarnet(page);
  await carnet.getByTestId('carnet-crear').click();
  await signInWithCode(page, a.email);
  await expect(page.getByTestId('acceso')).toBeHidden();
  await expect(carnet.getByTestId('carnet-apodo')).toHaveText(a.nickname);
  await expect.poll(() => pointsOf(a.id), { timeout: 20_000 }).toBeGreaterThanOrEqual(50);
  const pointsA = await pointsOf(a.id);

  // Sale desde el menú del mar: «Tu cuenta» con su apodo y número, y la pregunta.
  await page.getByTestId('mar-carnet-cerrar').click();
  await page.getByTestId('mar-logros').click();
  const cuenta = page.getByTestId('mar-menu-cuenta');
  await expect(cuenta).toHaveAttribute('data-estado', 'member');
  await expect(cuenta.getByTestId('mar-menu-cuenta-quien')).toContainText(a.nickname);
  await cuenta.getByTestId('mar-menu-cuenta-salir').click();
  await expect(page.getByTestId('cuenta-salir-texto')).toHaveText(t('cuenta.salir.texto'));
  await page.getByTestId('cuenta-salir-si').click();
  await expect(page.getByTestId('cuenta-aviso')).toHaveText(t('account.signedOut'));
  await expect(cuenta).toHaveAttribute('data-estado', 'signIn');
  await expect(cuenta.getByTestId('mar-menu-cuenta-entrar')).toBeVisible();

  // El móvil, de cero: ni la cuenta ni el juego de A; las preferencias, sí.
  const after = await deviceKeys(page);
  expect(after[MOOD_STORAGE_KEY]).toBe('noche');
  expect(after[SETTINGS_KEY]).toBeTruthy();
  for (const k of [CANON_BEST_KEY, SHIP_SKIN_STORAGE_KEY]) expect(after[k], k).toBeUndefined();
  expect(Object.keys(after).filter((k) => k.startsWith('boia.cuenta.'))).toEqual([]);
  const fresh = JSON.parse(after[STORE_KEY] ?? '{}') as { ledger?: unknown[]; carnets?: object };
  expect(fresh.ledger ?? []).toEqual([]);
  expect(Object.keys(fresh.carnets ?? {})).toEqual([]);
  // Al volver a abrir el mar, sigue de cero.
  await openMar(page);
  carnet = await openCarnet(page);
  await expect(carnet.getByTestId('carnet-invitacion')).toBeVisible();
  await expect(carnet.getByTestId('carnet-apodo')).toHaveCount(0);

  // B entra en este móvil: ve lo suyo y nada de A pasa a su cuenta.
  await carnet.getByTestId('carnet-crear').click();
  await signInWithCode(page, b.email);
  await expect(page.getByTestId('acceso')).toBeHidden();
  await expect(carnet.getByTestId('carnet-apodo')).toHaveText(b.nickname);
  expect(await pointsOf(b.id)).toBeLessThan(50);
  // B sale desde «Tu cuenta» de Mi Carnet (el mismo «Cerrar sesión»).
  await carnet.getByTestId('cuenta-cerrar-sesion').click();
  await page.getByTestId('cuenta-salir-si').click();
  await expect(page.getByTestId('cuenta-aviso')).toHaveText(t('account.signedOut'));

  // A vuelve: lo tiene todo, de su cuenta.
  await carnet.getByTestId('carnet-crear').click();
  await signInWithCode(page, a.email);
  await expect(page.getByTestId('acceso')).toBeHidden();
  await expect(carnet.getByTestId('carnet-apodo')).toHaveText(a.nickname);
  expect(await pointsOf(a.id)).toBe(pointsA);
  await expect(page.getByTestId('mar-saldos')).toContainText(`★ ${pointsA}`, { timeout: 20_000 });
});

test('borrar la cuenta escribiendo el apodo', async ({ page }, info) => {
  const m = await memberWithCarnet(`Borra ${info.project.name}`);
  await signInPage(page, m);
  await openMar(page);
  const carnet = await openCarnet(page);
  await expect(carnet.getByTestId('carnet-apodo')).toHaveText(m.nickname);

  await carnet.getByTestId('cuenta-borrar').click();
  const dialog = page.getByTestId('cuenta-borrar-dialogo');
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByTestId('cuenta-borrar-confirmar');
  await expect(confirm).toBeDisabled();
  await dialog.getByTestId('cuenta-borrar-apodo').fill(m.nickname.slice(0, 3));
  await expect(confirm).toBeDisabled();
  await dialog.getByTestId('cuenta-borrar-apodo').fill(m.nickname.toLowerCase());
  await confirm.click();

  await expect(page.getByTestId('cuenta-aviso')).toHaveText(t('account.deleted'));
  await expect(dialog).toBeHidden();
  // Un invitado nuevo: sin Carnet en este navegador.
  await expect(carnet.getByTestId('carnet-invitacion')).toBeVisible();
  const { data, error } = await serviceClient().auth.admin.getUserById(m.id);
  expect(data.user).toBeNull();
  expect(error).not.toBeNull();
});

test('la política de privacidad dice qué se recoge y para qué', async ({ page }) => {
  await page.goto('/legal/privacidad');
  await expect(page.getByTestId('legal-muestra')).toBeVisible();
  await expect(page.getByText(t('legal.privacy.account.what'))).toBeVisible();
  await expect(page.getByText(t('legal.privacy.account.retention'))).toBeVisible();
  await expect(page.getByText(t('legal.privacy.notAsked'))).toHaveCount(0);
});
