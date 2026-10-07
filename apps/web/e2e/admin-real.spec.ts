import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PNG } from 'pngjs';
import { PRIVACY_POLICY_VERSION } from '../lib/account/config';
import { t } from '../lib/i18n';
import {
  E2E_SUPABASE,
  anonClient,
  createMember,
  deleteMembers,
  otpFor,
  serviceClient,
  signInPage,
  signInSession,
  totp,
  type TestMember,
} from './supabase';
import { supabaseTestEnv } from './supabase-env';

/**
 * /admin con cuentas (plan 008, T94, decisión 11, REQ-ADM-002/004/027/028):
 * - un miembro sin rol del equipo ve «Sin acceso»;
 * - un admin dado de alta con `pnpm admin:grant` entra con el código del
 *   email y el TOTP (alta con el secreto que enseña la pantalla, el código se
 *   calcula aquí);
 * - Fiestas y QR: regenera el código de una fiesta (el QR viejo deja de
 *   valer), sube la imagen del sello de una y trae la de otra por URL; las
 *   dos salen en el Carnet de un miembro;
 * - Socios y emails: el CSV sólo trae a quien aceptó noticias; marca a un
 *   miembro como artista (su Carnet público lo dice) y borra un duplicado
 *   (sale del ranking y ya no entra con lo suyo);
 * - Moderación: retira una botella reportada y oculta y vuelve a mostrar un
 *   Carnet (T191);
 * - Rankings: anula un tiempo y sale del ranking del circuito.
 * Cuentas y fiestas de usar y tirar. Sólo con E2E_SUPABASE=1, en escritorio.
 */
test.skip(!E2E_SUPABASE, 'sólo con E2E_SUPABASE=1');
test.describe.configure({ timeout: 420_000 });

const run = Math.random().toString(36).slice(2, 8);
const created: TestMember[] = [];
const events: string[] = [];
const CIRCUIT = { id: 'el-freu', version: 3 };
const GRANT_SCRIPT = fileURLToPath(
  new URL('../../../packages/db/src/cli/admin-grant.ts', import.meta.url),
);

interface Party {
  id: string;
  slug: string;
  code: string;
  title: string;
}

interface Member extends TestMember {
  nickname: string;
  client: SupabaseClient;
  refreshToken: string;
}

function clientFor(accessToken: string): SupabaseClient {
  const env = supabaseTestEnv()!;
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

async function member(label: string, opts: { carnet?: boolean; news?: boolean } = {}) {
  const m = await createMember(label);
  created.push(m);
  const session = await signInSession(m);
  const client = clientFor(session.access_token);
  const nickname = `T94 ${label} ${run}`.slice(0, 30);
  if (opts.carnet !== false) {
    const { error } = await client.rpc('save_profile', {
      p_nickname: nickname,
      p_privacy_version: PRIVACY_POLICY_VERSION,
      p_news: opts.news ?? false,
    });
    if (error) throw new Error(`save_profile: ${error.message}`);
  }
  return { ...m, nickname, client, refreshToken: session.refresh_token } satisfies Member;
}

async function party(label: string): Promise<Party> {
  const service = serviceClient();
  const now = Date.now();
  const slug = `e2e-t94-${run}-${label}`;
  const title = `Fiesta T94 ${label} ${run}`;
  const { data, error } = await service
    .from('events')
    .insert({
      slug,
      title,
      state: 'on_sale',
      published_at: new Date(now).toISOString(),
      starts_at: new Date(now - 3600_000).toISOString(),
      ends_at: new Date(now + 3 * 3600_000).toISOString(),
      venue_public: 'Alicante',
      is_sample: true,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`evento: ${error?.message}`);
  events.push(data.id);
  const code = `T94${run.toUpperCase()}${label.toUpperCase()}`.replace(/[^A-Z0-9]/g, 'X');
  const { error: e2 } = await service.from('event_stamp_codes').insert({
    event_id: data.id,
    code,
    valid_from: new Date(now - 3600_000).toISOString(),
    valid_until: new Date(now + 4 * 3600_000).toISOString(),
  });
  if (e2) throw new Error(`código: ${e2.message}`);
  return { id: data.id, slug, code, title };
}

/** Un PNG de 640 × 640 con un círculo negro (una «imagen de sello» de prueba). */
function stampPng(): Buffer {
  const side = 640;
  const img = new PNG({ width: side, height: side });
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const i = (y * side + x) * 4;
      const inside = (x - 320) ** 2 + (y - 320) ** 2 < 220 ** 2;
      const v = inside ? 0 : 255;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(img);
}

async function inRaceRanking(userId: string): Promise<boolean> {
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await anonClient().rpc('ranking_race', {
      p_circuit: CIRCUIT.id,
      p_version: CIRCUIT.version,
      p_limit: 100,
      p_offset: offset,
    });
    if (error) throw new Error(error.message);
    const page = data as { total: number; rows: { user_id: string }[] };
    if (page.rows.some((r) => r.user_id === userId)) return true;
    if (offset + 100 >= page.total) return false;
  }
}

async function inPointsRanking(userId: string): Promise<boolean> {
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await anonClient().rpc('ranking_points', {
      p_limit: 100,
      p_offset: offset,
    });
    if (error) throw new Error(error.message);
    const page = data as { total: number; rows: { user_id: string }[] };
    if (page.rows.some((r) => r.user_id === userId)) return true;
    if (offset + 100 >= page.total) return false;
  }
}

async function goSection(page: Page, id: string) {
  await page.getByTestId(`admin-nav-${id}`).click();
  await expect(page.getByTestId(`admin-seccion-${id}`)).toBeVisible();
}

let admin: TestMember;
let noRole: Member;
let fan: Member; // con noticias: sellos de las dos fiestas, artista
let quiet: Member; // sin noticias: echa la botella, corre
let dup: Member; // el duplicado que se borra
let partyA: Party;
let partyB: Party;
let bottleId: string;

/** Cuentas, fiestas, sellos, tiempos y la botella reportada de la prueba. */
async function setup(): Promise<void> {
  partyA = await party('a');
  partyB = await party('b');
  admin = await createMember('admin');
  created.push(admin);
  // El rol con el script de verdad (`pnpm admin:grant -- <email> admin`).
  const out = execFileSync(process.execPath, [GRANT_SCRIPT, '--', admin.email, 'admin'], {
    encoding: 'utf8',
  });
  expect(out).toContain('admin:grant OK');
  noRole = await member('sinrol', { carnet: false });
  fan = await member('fan', { news: true });
  quiet = await member('quiet', { news: false });
  dup = await member('dup', { news: true });
  for (const p of [partyA, partyB]) {
    const { error } = await fan.client.rpc('claim_stamp', { p_event: p.slug, p_code: p.code });
    if (error) throw new Error(`claim_stamp: ${error.message}`);
  }
  // El duplicado tiene puntos y un tiempo; quiet, un tiempo y una botella reportada.
  await dup.client.rpc('award_points', {
    p_action: 'world',
    p_ref: `lugar:t94-${run}:points`,
    p_points: 20,
  });
  for (const m of [dup, quiet]) {
    const { error } = await m.client.rpc('submit_race_time', {
      p_circuit: CIRCUIT.id,
      p_version: CIRCUIT.version,
      p_ms: 45_001 + Math.floor(Math.random() * 50),
    });
    if (error) throw new Error(`submit_race_time: ${error.message}`);
  }
  const b = await quiet.client.rpc('place_bottle', {
    p_message: `Botella reportada ${run}`,
    p_x: 10,
    p_y: 20,
  });
  if (b.error) throw new Error(`place_bottle: ${b.error.message}`);
  bottleId = (b.data as { id: string }).id;
  const r = await noRole.client
    .from('bottle_reports')
    .insert({ bottle_id: bottleId, reporter_id: noRole.id, reason: 'spam de prueba' });
  if (r.error) throw new Error(`report: ${r.error.message}`);
}

test.afterAll(async () => {
  await deleteMembers(created);
  const service = serviceClient();
  for (const p of [partyA, partyB]) {
    if (!p) continue;
    const { data } = await service.storage.from('stamp-images').list(p.slug);
    const files = (data ?? []).map((f) => `${p.slug}/${f.name}`);
    if (files.length) await service.storage.from('stamp-images').remove(files);
  }
  if (events.length) await service.from('events').delete().in('id', events);
});

test('/admin con cuentas: código + TOTP y las cuatro secciones sobre datos reales', async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'un recorrido largo: sólo en escritorio');
  await test.step('cuentas, fiestas y datos de la prueba', setup);

  await test.step('un miembro sin rol del equipo ve «Sin acceso»', async () => {
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await signInPage(other, noRole);
    await other.goto('/admin');
    await expect(other.getByTestId('admin-sin-acceso')).toBeVisible({ timeout: 30_000 });
    await expect(other.getByTestId('admin-sin-acceso')).toContainText(
      t('admin.real.noAccess.title'),
    );
    await expect(other.getByTestId('admin')).toHaveCount(0);
    await ctx.close();
  });

  await test.step('el admin entra con el código del email y da de alta el TOTP', async () => {
    // El navegador pide el código: se responde «enviado» sin mandar correo.
    await page.route('**/auth/v1/otp**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );
    await page.goto('/admin');
    await page.getByTestId('admin-login-email').fill(admin.email);
    await page.getByTestId('admin-login-enviar').click();
    await expect(page.getByTestId('admin-login-enviado')).toBeVisible();
    await page.getByTestId('admin-login-codigo').fill(await otpFor(admin.email));
    await page.getByTestId('admin-login-entrar').click();
    await expect(page.getByTestId('admin-totp-qr')).toBeVisible({ timeout: 30_000 });
    const secret = (await page.getByTestId('admin-totp-secreto').textContent())!.trim();
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
    await page.getByTestId('admin-totp-codigo').fill(totp(secret));
    await page.getByTestId('admin-totp-entrar').click();
    await expect(page.getByTestId('admin')).toHaveAttribute('data-admin', 'real', {
      timeout: 30_000,
    });
    await expect(page.getByTestId('admin-quien')).toContainText(admin.email);
  });

  await test.step('Fiestas y QR: regenerar el código invalida el QR anterior', async () => {
    await goSection(page, 'fiestas');
    await page.getByTestId('fiestas-buscar').fill(`e2e-t94-${run}`);
    const row = page.getByTestId(`fiesta-${partyA.slug}`);
    const url = row.getByTestId(`fiesta-url-${partyA.slug}`);
    await expect(url).toContainText(`c=${partyA.code}`, { timeout: 30_000 });
    await row.getByTestId(`fiesta-regenerar-${partyA.slug}`).click();
    await row.getByTestId(`fiesta-regenerar-confirmar-${partyA.slug}`).click();
    await expect(row.getByTestId('admin-ok')).toHaveText(t('admin.real.fiestas.regenerated'));
    await expect(url).not.toContainText(`c=${partyA.code}`);
    const fresh = new URL((await url.textContent())!.trim()).searchParams.get('c')!;
    expect(fresh).toMatch(/^[A-Z0-9]{12}$/);
    // El QR viejo ya no da sello; el nuevo, sí.
    const old = await quiet.client.rpc('claim_stamp', {
      p_event: partyA.slug,
      p_code: partyA.code,
    });
    expect(old.error?.message).toBe('invalid_code');
    const ok = await quiet.client.rpc('claim_stamp', { p_event: partyA.slug, p_code: fresh });
    expect(ok.error).toBeNull();
    expect((ok.data as { granted: boolean }).granted).toBe(true);
  });

  await test.step('Fiestas y QR: la imagen del sello, subida y por URL', async () => {
    const rowA = page.getByTestId(`fiesta-${partyA.slug}`);
    await rowA.getByTestId(`fiesta-sello-archivo-${partyA.slug}`).setInputFiles({
      name: 'sello.png',
      mimeType: 'image/png',
      buffer: stampPng(),
    });
    await expect(rowA.getByTestId('admin-ok')).toHaveText(t('admin.real.fiestas.imageSaved'), {
      timeout: 30_000,
    });
    await expect(rowA.getByTestId(`fiesta-sello-${partyA.slug}`)).toHaveAttribute(
      'data-imagen',
      'si',
    );
    const service = serviceClient();
    const a = await service.from('events').select('stamp_image_url').eq('id', partyA.id).single();
    const urlA = a.data!.stamp_image_url as string;
    expect(urlA).toMatch(/\/storage\/v1\/object\/public\/stamp-images\/e2e-t94-.+\.(webp|png)$/);

    // La otra fiesta trae la imagen de una URL https (la copia de la primera):
    // el servidor la descarga una vez y se guarda otra copia propia.
    const rowB = page.getByTestId(`fiesta-${partyB.slug}`);
    await rowB.getByTestId(`fiesta-sello-url-${partyB.slug}`).fill(urlA);
    await rowB.getByTestId(`fiesta-sello-traer-${partyB.slug}`).click();
    await expect(rowB.getByTestId('admin-ok')).toHaveText(t('admin.real.fiestas.imageSaved'), {
      timeout: 30_000,
    });
    const b = await service.from('events').select('stamp_image_url').eq('id', partyB.id).single();
    const urlB = b.data!.stamp_image_url as string;
    expect(urlB).toContain(`/stamp-images/${partyB.slug}/`);
    expect(urlB).not.toBe(urlA);

    // Las dos salen en el Carnet del miembro, dentro del sello de goma.
    const ctx = await browser.newContext();
    const carnet = await ctx.newPage();
    await carnet.goto(`/carnet/${fan.id}`);
    const back = carnet.getByTestId('carnet-reverso');
    for (const p of [partyA, partyB]) {
      await expect(back.getByTestId(`carnet-sello-${p.slug}`).locator('svg')).toHaveAttribute(
        'data-imagen',
        'si',
        { timeout: 30_000 },
      );
    }
    await ctx.close();
  });

  await test.step('Socios y emails: el CSV sólo con noticias', async () => {
    await goSection(page, 'socios');
    const download = page.waitForEvent('download');
    await page.getByTestId('socios-csv').click();
    const file = await download;
    const csv = readFileSync((await file.path())!, 'utf8');
    expect(csv.split('\r\n')[0]).toContain('email,apodo');
    expect(csv).toContain(fan.email);
    expect(csv).toContain(dup.email);
    expect(csv).not.toContain(quiet.email);
    expect(csv).not.toContain(noRole.email);
  });

  await test.step('Socios y emails: marcar artista; su Carnet público lo dice', async () => {
    await page.getByTestId('socios-buscar').fill(fan.nickname);
    await page.getByTestId('socios-buscar-ok').click();
    const card = page.getByTestId(`socio-${fan.id}`);
    await expect(card).toHaveAttribute('data-artista', 'no', { timeout: 30_000 });
    await expect(card).toContainText(fan.email);
    await expect(page.getByTestId(`socio-noticias-${fan.id}`)).toContainText(
      PRIVACY_POLICY_VERSION,
    );
    await card.getByTestId(`socio-artista-${fan.id}`).click();
    await expect(page.getByTestId(`socio-${fan.id}`)).toHaveAttribute('data-artista', 'si', {
      timeout: 30_000,
    });
    const ctx = await browser.newContext();
    const carnet = await ctx.newPage();
    await carnet.goto(`/carnet/${fan.id}`);
    await expect(carnet.getByTestId('carnet-anverso')).toContainText(t('carnet.card.docArtist'), {
      timeout: 30_000,
    });
    await ctx.close();
  });

  await test.step('Socios y emails: borrar un duplicado', async () => {
    expect(await inPointsRanking(dup.id)).toBe(true);
    await page.getByTestId('socios-buscar').fill(dup.nickname);
    await page.getByTestId('socios-buscar-ok').click();
    const card = page.getByTestId(`socio-${dup.id}`);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.getByTestId(`socio-borrar-${dup.id}`).click();
    await card.getByTestId('socio-borrar-motivo').fill('duplicado de prueba');
    await expect(card.getByTestId('socio-borrar-confirmar')).toBeDisabled();
    await card.getByTestId('socio-borrar-nombre').fill(dup.nickname);
    await card.getByTestId('socio-borrar-confirmar').click();
    await expect(page.getByTestId(`socio-${dup.id}`)).toHaveCount(0, { timeout: 30_000 });
    // Fuera de los rankings y sin cuenta: su sesión ya no se renueva.
    expect(await inPointsRanking(dup.id)).toBe(false);
    expect(await inRaceRanking(dup.id)).toBe(false);
    const gone = await serviceClient().auth.admin.getUserById(dup.id);
    expect(gone.data.user).toBeNull();
    const refresh = await anonClient().auth.refreshSession({ refresh_token: dup.refreshToken });
    expect(refresh.error).not.toBeNull();
    const carnetRow = await serviceClient().from('carnets').select('user_id').eq('user_id', dup.id);
    expect(carnetRow.data).toEqual([]);
  });

  await test.step('Moderación: retirar una botella reportada', async () => {
    await goSection(page, 'moderacion');
    const card = page.getByTestId(`botella-real-${bottleId}`);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText(`Botella reportada ${run}`);
    await card.getByTestId(`botella-real-motivo-${bottleId}`).fill('spam de prueba');
    await card.getByTestId(`botella-real-retirar-${bottleId}`).click();
    await expect(page.getByTestId(`botella-real-${bottleId}`)).toHaveCount(0, {
      timeout: 30_000,
    });
    const sea = await anonClient().rpc('latest_bottles', { p_limit: 10 });
    expect((sea.data as { id: string }[]).some((b) => b.id === bottleId)).toBe(false);
    const row = await serviceClient().from('bottles').select('status').eq('id', bottleId).single();
    expect(row.data!.status).toBe('removed');
  });

  await test.step('Moderación: ocultar un Carnet y volver a mostrarlo (T191)', async () => {
    const card = page.getByTestId(`carnet-real-${fan.id}`);
    await page.getByTestId('carnets-reales-buscar').fill(fan.nickname);
    await page.getByTestId('carnets-reales-buscar-ok').click();
    await expect(card).toHaveAttribute('data-oculto', 'no', { timeout: 30_000 });
    await card.getByTestId(`carnet-real-motivo-${fan.id}`).fill('spam de prueba');
    await card.getByTestId(`carnet-real-hide-${fan.id}`).click();
    await expect(page.getByTestId(`carnet-real-${fan.id}`)).toHaveAttribute('data-oculto', 'si', {
      timeout: 30_000,
    });
    const hidden = await anonClient().from('carnets').select('user_id').eq('user_id', fan.id);
    expect(hidden.data).toEqual([]);
    await page
      .getByTestId(`carnet-real-${fan.id}`)
      .getByTestId(`carnet-real-show-${fan.id}`)
      .click();
    await expect(page.getByTestId(`carnet-real-${fan.id}`)).toHaveAttribute('data-oculto', 'no', {
      timeout: 30_000,
    });
    const back = await anonClient().from('carnets').select('nickname').eq('user_id', fan.id);
    expect(back.data).toEqual([{ nickname: fan.nickname }]);
  });

  await test.step('Rankings: anular un tiempo lo saca del ranking', async () => {
    expect(await inRaceRanking(quiet.id)).toBe(true);
    await goSection(page, 'rankings');
    const row = page.getByTestId(`rankings-tiempo-${quiet.id}`);
    await expect(row).toBeVisible({ timeout: 30_000 });
    const id = `rankings-anular-tiempo-${quiet.id}`;
    await row.getByTestId(id).click();
    await row.getByTestId(`${id}-motivo`).fill('tiempo imposible');
    await row.getByTestId(`${id}-confirmar`).click();
    await expect(page.getByTestId(`rankings-tiempo-${quiet.id}`)).toHaveCount(0, {
      timeout: 30_000,
    });
    expect(await inRaceRanking(quiet.id)).toBe(false);
    const audit = await serviceClient()
      .from('audit_log')
      .select('action, reason')
      .eq('action', 'void_time')
      .like('entity_id', `${quiet.id}|%`);
    expect(audit.data).toEqual([{ action: 'void_time', reason: 'tiempo imposible' }]);
  });
});
