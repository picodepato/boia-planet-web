import { BOTTLES_IN_SEA_MAX } from '@boia/contracts';
import { BOTTLE_SPOTS } from '@boia/world';
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { PRIVACY_POLICY_VERSION } from '../lib/account/config';
import { t } from '../lib/i18n';
import { openMar } from './mar-helpers';
import {
  E2E_SUPABASE,
  createMember,
  deleteMembers,
  serviceClient,
  signInPage,
  signInSession,
  type TestMember,
} from './supabase';
import { supabaseTestEnv } from './supabase-env';

/**
 * Botellas globales (plan 008, T93, decisión 12; REQ-IDE-040…044): con
 * Supabase, la botella que echa un miembro la ve, la lee y la reporta otro
 * desde su navegador, y el invitado la lee sin cuenta (echar una le pide la
 * cuenta); el filtro no deja echar un mensaje con un enlace o un teléfono; y
 * de 11 botellas, en el mar flotan las 10 más recientes. Sólo con
 * E2E_SUPABASE=1; cada prueba borra sus cuentas (y con ellas sus botellas).
 */
test.skip(!E2E_SUPABASE, 'sólo con E2E_SUPABASE=1');
test.describe.configure({ timeout: 240_000 });

interface Sailor extends TestMember {
  nickname: string;
}

/** Una cuenta con Carnet (por la RPC, con la política aceptada). */
async function sailor(label: string, mine: TestMember[]): Promise<Sailor> {
  const m = await createMember(label);
  mine.push(m);
  const env = supabaseTestEnv()!;
  const session = await signInSession(m);
  const client = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  const nickname = `${label} ${m.id.slice(0, 6)}`;
  const profile = await client.rpc('save_profile', {
    p_nickname: nickname,
    p_privacy_version: PRIVACY_POLICY_VERSION,
  });
  if (profile.error) throw new Error(`save_profile: ${profile.error.message}`);
  return { ...m, nickname };
}

/** Ids de las botellas que el motor tiene en el agua. */
async function bottlesInSea(page: Page): Promise<string[]> {
  const v = await page.getByTestId('mar-canvas').getAttribute('data-bottles');
  return (v ?? '').split(' ').filter(Boolean);
}

async function openMenuEntry(page: Page, testId: string) {
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu').getByTestId(testId).click();
}

/** Las botellas activas de una cuenta, en el servidor. */
async function activeBottles(userId: string) {
  const { data, error } = await serviceClient()
    .from('bottles')
    .select('id, message')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) throw new Error(error.message);
  return data ?? [];
}

const contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

/** Un navegador nuevo del mismo tipo que el proyecto (móvil o escritorio), con o sin sesión. */
async function newPage(
  browser: Browser,
  baseURL: string | undefined,
  who: TestMember | null,
): Promise<Page> {
  const u = test.info().project.use;
  const o: BrowserContextOptions = { baseURL: baseURL ?? '' };
  if (u.viewport) o.viewport = u.viewport;
  if (u.deviceScaleFactor) o.deviceScaleFactor = u.deviceScaleFactor;
  if (u.isMobile !== undefined) o.isMobile = u.isMobile;
  if (u.hasTouch !== undefined) o.hasTouch = u.hasTouch;
  if (u.userAgent) o.userAgent = u.userAgent;
  const context = await browser.newContext(o);
  contexts.push(context);
  const page = await context.newPage();
  if (who) await signInPage(page, who);
  return page;
}

test('un miembro echa una botella; otro la ve, la lee y la reporta; el invitado la lee', async ({
  browser,
  baseURL,
}) => {
  const mine: TestMember[] = [];
  try {
    const a = await sailor('Echa', mine);
    const b = await sailor('Lee', mine);

    // A echa la suya desde «Mi botella»: con cuenta, sin aviso de «sólo en este navegador».
    const pageA = await newPage(browser, baseURL, a);
    const errorsA = await openMar(pageA);
    await openMenuEntry(pageA, 'mar-mi-botella');
    const panelA = pageA.getByTestId('mar-botella');
    await expect(panelA.getByTestId('botella-aviso-global')).toHaveText(t('mar.botella.global'));
    await expect(panelA.getByTestId('botella-aviso-local')).toHaveCount(0);
    const message = `Botella de todos (${test.info().project.name}): nos vemos en el All Day.`;
    await panelA.getByTestId('botella-texto').fill(message);
    await panelA.getByTestId('botella-echar').click();
    await expect(panelA).toBeHidden();
    await expect.poll(() => activeBottles(a.id), { timeout: 15_000 }).toHaveLength(1);
    const [thrown] = await activeBottles(a.id);
    expect(thrown!.message).toBe(message);
    await expect.poll(() => bottlesInSea(pageA), { timeout: 10_000 }).toContain(thrown!.id);
    await expect(pageA.getByTestId(`mar-botella-cerca-${thrown!.id}`)).toHaveText(
      t('mar.botella.tuyaCerca'),
    );

    // B, en su navegador, la ve flotar junto a la salida, la lee y la reporta.
    const pageB = await newPage(browser, baseURL, b);
    const errorsB = await openMar(pageB);
    await expect.poll(() => bottlesInSea(pageB), { timeout: 15_000 }).toContain(thrown!.id);
    const chip = pageB.getByTestId(`mar-botella-cerca-${thrown!.id}`);
    await expect(chip).toHaveText(t('mar.botella.deCerca', { name: a.nickname }), {
      timeout: 15_000,
    });
    await chip.click();
    const panelB = pageB.getByTestId('mar-botella');
    await expect(panelB.getByTestId('botella-mensaje')).toHaveText(message);
    await expect
      .poll(async () => {
        const { data } = await serviceClient()
          .from('bottle_reads')
          .select('reader_id')
          .eq('bottle_id', thrown!.id);
        return (data ?? []).map((r) => r.reader_id);
      })
      .toEqual([b.id]);
    await panelB.getByTestId('botella-reportar').click();
    await panelB.getByTestId('botella-reportar-enviar').click();
    await expect(panelB.getByTestId('botella-reporte')).toHaveText(t('bottle.report.done'));
    const { data: reports } = await serviceClient()
      .from('bottle_reports')
      .select('reporter_id')
      .eq('bottle_id', thrown!.id);
    expect(reports).toEqual([{ reporter_id: b.id }]);

    // El invitado la lee sin cuenta; echar una le pide entrar con su email.
    const guest = await newPage(browser, baseURL, null);
    const errorsGuest = await openMar(guest);
    await expect.poll(() => bottlesInSea(guest), { timeout: 15_000 }).toContain(thrown!.id);
    await guest.getByTestId(`mar-botella-cerca-${thrown!.id}`).click({ timeout: 15_000 });
    const panelGuest = guest.getByTestId('mar-botella');
    await expect(panelGuest.getByTestId('botella-mensaje')).toHaveText(message);
    await panelGuest.getByTestId('mar-botella-cerrar').click();
    await openMenuEntry(guest, 'mar-mi-botella');
    const ask = panelGuest.getByTestId('botella-sin-carnet');
    await expect(ask).toContainText(t('mar.botella.pideCuenta'));
    await ask.getByRole('button', { name: t('mar.botella.entrar') }).click();
    await expect(guest.getByTestId('acceso-email')).toBeVisible();

    expect([...errorsA, ...errorsB, ...errorsGuest]).toEqual([]);
  } finally {
    await deleteMembers(mine);
  }
});

test('el filtro no deja echar un mensaje con un enlace o un teléfono', async ({
  browser,
  baseURL,
}) => {
  const mine: TestMember[] = [];
  try {
    const a = await sailor('Filtro', mine);
    const page = await newPage(browser, baseURL, a);
    const errors = await openMar(page);
    await openMenuEntry(page, 'mar-mi-botella');
    const panel = page.getByTestId('mar-botella');
    const text = panel.getByTestId('botella-texto');
    const error = panel.getByTestId('botella-error');
    for (const [message, key] of [
      ['Pasaos por www.boia-fiestas.es esta noche', 'mar.botella.filtro.link'],
      ['Escribidme al 612 345 678 y quedamos', 'mar.botella.filtro.phone'],
    ] as const) {
      await text.fill(message);
      await panel.getByTestId('botella-echar').click();
      await expect(error).toHaveText(t(key));
      await expect(panel).toBeVisible();
    }
    expect(await activeBottles(a.id)).toEqual([]);
    // Uno limpio sí sale.
    await text.fill('Sin enlaces ni teléfonos: sólo mar.');
    await panel.getByTestId('botella-echar').click();
    await expect(panel).toBeHidden();
    await expect.poll(() => activeBottles(a.id), { timeout: 15_000 }).toHaveLength(1);
    expect(errors).toEqual([]);
  } finally {
    await deleteMembers(mine);
  }
});

test('de 11 botellas, en el mar flotan las 10 más recientes', async ({ browser, baseURL }) => {
  const mine: TestMember[] = [];
  try {
    const service = serviceClient();
    const crew = await Promise.all(
      Array.from({ length: BOTTLES_IN_SEA_MAX + 1 }, () => createMember('once')),
    );
    mine.push(...crew);
    for (const [i, m] of crew.entries()) {
      const { error } = await service
        .from('carnets')
        .insert({ user_id: m.id, nickname: `Once ${i} ${m.id.slice(0, 6)}` });
      if (error) throw new Error(`carnet: ${error.message}`);
    }
    // Las más recientes del proyecto: fechadas por delante de cualquier otra.
    const base = Date.now() + 60 * 60_000;
    const rows = crew.map((m, i) => {
      const spot = BOTTLE_SPOTS[i % BOTTLE_SPOTS.length]!;
      return {
        user_id: m.id,
        message: `Botella ${i} de once`,
        x: spot.x,
        y: spot.y,
        created_at: new Date(base + i * 1000).toISOString(),
      };
    });
    const { data, error } = await service.from('bottles').insert(rows).select('id, created_at');
    if (error || !data) throw new Error(`bottles: ${error?.message}`);
    const byAge = [...data].sort((x, y) => Date.parse(x.created_at) - Date.parse(y.created_at));
    const oldest = byAge[0]!.id;
    const newest = byAge.slice(1).map((r) => r.id);

    const page = await newPage(browser, baseURL, null);
    const errors = await openMar(page);
    await expect
      .poll(() => bottlesInSea(page), { timeout: 15_000 })
      .toHaveLength(BOTTLES_IN_SEA_MAX);
    const afloat = await bottlesInSea(page);
    expect([...afloat].sort()).toEqual([...newest].sort());
    expect(afloat).not.toContain(oldest);
    expect(errors).toEqual([]);
  } finally {
    await deleteMembers(mine);
  }
});
