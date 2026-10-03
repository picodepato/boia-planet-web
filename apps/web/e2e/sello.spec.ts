import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { PRIVACY_POLICY_VERSION } from '../lib/account/config';
import { t } from '../lib/i18n';
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
 * El sello de la fiesta por QR (plan 008, T91, decisión 9): el QR es la URL
 * `/sello?e=<fiesta>&c=<código>`, que abre la cámara del móvil.
 * - Un miembro la abre: el sello cae en el reverso del Carnet y suma los
 *   puntos del sello; la misma URL otra vez dice «Ya tienes este sello».
 * - Un código fuera de la ventana de la fiesta: «Este sello abre durante la
 *   fiesta».
 * - Un invitado: la hoja de acceso (motivo `stamp`) y, al terminar, el sello.
 * Las fiestas y las cuentas son de usar y tirar (se borran al acabar). Sólo
 * con E2E_SUPABASE=1.
 */
test.skip(!E2E_SUPABASE, 'sólo con E2E_SUPABASE=1');
test.describe.configure({ timeout: 240_000 });

const run = Math.random().toString(36).slice(2, 8);
const created: TestMember[] = [];
const events: string[] = [];

interface TestParty {
  id: string;
  slug: string;
  code: string;
  title: string;
}

/** Una fiesta publicada con su código de sello y su ventana. */
async function party(label: string, from: Date, until: Date): Promise<TestParty> {
  const service = serviceClient();
  const slug = `e2e-t91-${run}-${label}`;
  const title = `Fiesta e2e ${label} ${run}`;
  const { data, error } = await service
    .from('events')
    .insert({
      slug,
      title,
      state: 'on_sale',
      published_at: new Date().toISOString(),
      starts_at: from.toISOString(),
      ends_at: until.toISOString(),
      venue_public: 'Alicante',
      is_sample: true,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`evento: ${error?.message}`);
  events.push(data.id);
  const code = `E2E${run.toUpperCase()}${label.slice(0, 3).toUpperCase()}`.replace(
    /[^A-Z0-9]/g,
    'X',
  );
  const { error: e2 } = await service.from('event_stamp_codes').insert({
    event_id: data.id,
    code,
    valid_from: from.toISOString(),
    valid_until: until.toISOString(),
  });
  if (e2) throw new Error(`código: ${e2.message}`);
  return { id: data.id, slug, code, title };
}

let open: TestParty;
let later: TestParty;

test.beforeAll(async () => {
  const now = Date.now();
  open = await party('abierta', new Date(now - 3600_000), new Date(now + 3 * 3600_000));
  later = await party('luego', new Date(now + 24 * 3600_000), new Date(now + 30 * 3600_000));
});

test.afterAll(async () => {
  // Primero las cuentas (con ellas, sus sellos), después las fiestas.
  await deleteMembers(created);
  if (events.length) await serviceClient().from('events').delete().in('id', events);
});

const selloPath = (p: TestParty) => `/sello?e=${p.slug}&c=${p.code}`;

/** Una cuenta que ya tiene su Carnet. */
async function memberWithCarnet(label: string): Promise<TestMember & { nickname: string }> {
  const m = await createMember(label);
  created.push(m);
  const env = supabaseTestEnv()!;
  const session = await signInSession(m);
  const client = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  const nickname = `Sello ${label} ${m.id.slice(0, 6)}`.slice(0, 30);
  const { error } = await client.rpc('save_profile', {
    p_nickname: nickname,
    p_privacy_version: PRIVACY_POLICY_VERSION,
  });
  if (error) throw new Error(`save_profile: ${error.message}`);
  return { ...m, nickname };
}

async function points(userId: string): Promise<number> {
  const { data } = await serviceClient()
    .from('point_balances')
    .select('points')
    .eq('user_id', userId)
    .maybeSingle();
  return Number(data?.points ?? 0);
}

async function stampPoints(): Promise<number> {
  const { data } = await serviceClient()
    .from('point_actions')
    .select('max_points')
    .eq('action', 'stamp')
    .single();
  return Number(data!.max_points);
}

/** El sello está en el reverso de la tarjeta y los puntos en el anverso. */
async function expectStamped(page: Page, p: TestParty, total: number, gained: number) {
  const done = page.getByTestId('sello-hecho');
  await expect(done).toBeVisible({ timeout: 60_000 });
  await expect(done.getByTestId('sello-aviso')).toHaveText(t('sello.done', { points: gained }));
  const card = done.getByTestId('carnet-tarjeta');
  await expect(card).toHaveAttribute('data-cara', 'back', { timeout: 30_000 });
  const back = card.getByTestId('carnet-reverso');
  await expect(back.getByTestId(`carnet-sello-${p.slug}`)).toBeVisible();
  await expect(back.getByTestId('carnet-sellos')).toContainText(p.title);
  await expect(card.getByTestId('carnet-puntos')).toHaveAttribute('data-puntos', String(total));
}

test('un miembro abre el QR de la fiesta: el sello cae en su Carnet con sus puntos; otra vez, ya lo tiene', async ({
  page,
  browser,
}, info) => {
  const m = await memberWithCarnet(`m ${info.project.name}`);
  const before = await points(m.id);
  const gained = await stampPoints();
  await signInPage(page, m);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(selloPath(open));
  await expect(page.getByTestId('sello-fiesta')).toHaveText(open.title, { timeout: 30_000 });
  await expectStamped(page, open, before + gained, gained);
  // El código ya no está en la barra: un enlace copiado no lo lleva.
  expect(new URL(page.url()).searchParams.get('c')).toBeNull();
  expect(new URL(page.url()).searchParams.get('e')).toBe(open.slug);
  // En el servidor: un sello y los puntos.
  expect(await points(m.id)).toBe(before + gained);

  // La misma URL otra vez: «Ya tienes este sello», sin más puntos.
  await page.goto(selloPath(open));
  const err = page.getByTestId('sello-error');
  await expect(err).toHaveAttribute('data-motivo', 'already', { timeout: 30_000 });
  await expect(err).toContainText(t('stamp.err.already.title'));
  await expect(err).toContainText(open.title);
  expect(await points(m.id)).toBe(before + gained);

  // Y en su Carnet (/carnet), en el reverso.
  await page.goto('/carnet');
  const card = page.getByTestId('carnet-tarjeta');
  await expect(
    card.getByTestId('carnet-reverso').getByTestId(`carnet-sello-${open.slug}`),
  ).toBeAttached({ timeout: 30_000 });
  await card.getByTestId('carnet-girar').click();
  await expect(card).toHaveAttribute('data-cara', 'back');
  await expect(
    card.getByTestId('carnet-reverso').getByTestId(`carnet-sello-${open.slug}`),
  ).toBeVisible();

  // Su Carnet público (/carnet/<id>), visto por otra persona sin cuenta: el
  // apodo, su nº, el sello y nada del email.
  const other = await browser.newContext();
  try {
    const guest = await other.newPage();
    await guest.goto(`/carnet/${m.id}`);
    const pub = guest.getByTestId('carnet-tarjeta');
    await expect(pub.getByTestId('carnet-apodo')).toHaveText(m.nickname, { timeout: 30_000 });
    await expect(pub.getByTestId('carnet-numero')).toHaveText(/^\d{4,}$/);
    await expect(pub.getByTestId('carnet-puntos')).toHaveAttribute(
      'data-puntos',
      String(before + gained),
    );
    await expect(pub.getByTestId(`carnet-sello-${open.slug}`)).toBeAttached();
    await expect(guest.getByTestId('carnet-escanear')).toHaveCount(0);
    expect(await guest.content()).not.toContain(m.email);
  } finally {
    await other.close();
  }
  expect(errors).toEqual([]);
});

test('un código fuera de la ventana de la fiesta: «Este sello abre durante la fiesta»', async ({
  page,
}, info) => {
  const m = await memberWithCarnet(`h ${info.project.name}`);
  const before = await points(m.id);
  await signInPage(page, m);
  await page.goto(selloPath(later));
  const err = page.getByTestId('sello-error');
  await expect(err).toHaveAttribute('data-motivo', 'early', { timeout: 30_000 });
  await expect(err).toContainText(t('stamp.err.early.title'));
  await expect(err).toContainText(later.title);
  expect(await points(m.id)).toBe(before);

  // Un código que no es el de la fiesta: «Este QR no es un sello de BOIA».
  await page.goto(`/sello?e=${open.slug}&c=MAL000CODIGO`);
  await expect(page.getByTestId('sello-error')).toHaveAttribute('data-motivo', 'invalid', {
    timeout: 30_000,
  });
  await expect(page.getByTestId('sello-error')).toContainText(t('stamp.err.invalid.title'));
});

/** El navegador pide el código: se responde «enviado» sin mandar ningún correo. */
async function stubCodeEmail(page: Page) {
  await page.route('**/auth/v1/otp**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
}

/** El código que llegaría al buzón (Supabase deja pedir uno por email cada 60 s). */
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

test('un invitado abre el QR: entra con su email y después el sello', async ({ page }, info) => {
  await stubCodeEmail(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(selloPath(open));

  // La hoja de acceso con el motivo del sello y la fiesta en el «por qué».
  const sheet = page.getByTestId('acceso');
  await expect(sheet).toHaveAttribute('data-motivo', 'stamp', { timeout: 30_000 });
  await expect(sheet.getByTestId('acceso-por-que')).toContainText(open.title);
  await expect(page.getByTestId('sello-invitado')).toBeVisible();

  const email = testEmail(`sello-${info.project.name}`);
  await sheet.getByTestId('acceso-email-input').fill(email);
  await sheet.getByTestId('acceso-enviar').click();
  await expect(sheet).toHaveAttribute('data-paso', 'code');
  const { otp, id } = await codeFor(email);
  created.push({ id, email });
  await sheet.getByTestId('acceso-codigo-input').fill(otp);

  // Cuenta nueva: apodo, la política y a seguir.
  await expect(sheet).toHaveAttribute('data-paso', 'nickname', { timeout: 30_000 });
  await sheet.getByTestId('acceso-apodo').fill(`Sellada ${id.slice(0, 8)}`);
  await expect(sheet.getByTestId('acceso-apodo-libre')).toBeVisible();
  await sheet.getByTestId('acceso-privacidad').check();
  await sheet.getByTestId('acceso-crear').click();
  await sheet.getByTestId('acceso-seguir').click();
  await expect(sheet).toBeHidden();

  const gained = await stampPoints();
  await expectStamped(page, open, await points(id), gained);
  expect(await points(id)).toBeGreaterThanOrEqual(gained);
  const { data: stamps } = await serviceClient()
    .from('stamps')
    .select('event_id')
    .eq('user_id', id)
    .is('revoked_at', null);
  expect(stamps).toEqual([{ event_id: open.id }]);
  expect(errors).toEqual([]);
});
