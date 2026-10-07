import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { circuitFromWorld } from '@boia/engine/circuit';
import { CIRCUIT_ID, WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { PRIVACY_POLICY_VERSION } from '../lib/account/config';
import { t } from '../lib/i18n';
import { RANKING_PAGE } from '../lib/landing/access';
import { canonBoardOptions, castleBoardOptions } from '../lib/mundo/ranking-boards';
import { CANON_BEST_KEY, canonBoardKey, canonRanking } from '../lib/mundo/ranking-canon';
import { CASTLE_BEST_KEY, castleBoardKey, castleRanking } from '../lib/mundo/ranking-castle';
import { translateSkinText } from '../lib/mundo/demo-world';
import { circuitName } from '../lib/mundo/ranking-circuit';
import { RANKING_PAGE_SIZE } from '../lib/mundo/ranking-global';
import { pastHero, tap } from './hero-helpers';
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
 * Rankings globales (plan 008, T92, decisión 8; REQ-AVE-034): con Supabase,
 * el panel del Menú lee las RPC de T86. Se siembran en el proyecto de
 * desarrollo dos miembros con tiempo y puntos (Rápida delante de Lenta),
 * más de 50 cuentas con tiempo (la «tripulación») y quien mira, el más
 * lento y sin puntos, para que quede fuera del top. El proyecto puede tener
 * otras cuentas: se comparan las sembradas entre sí, nunca puestos
 * absolutos. Sólo con E2E_SUPABASE=1; las cuentas se borran al acabar.
 */
test.describe('con Supabase', () => {
test.skip(!E2E_SUPABASE, 'sólo con E2E_SUPABASE=1');
test.describe.configure({ mode: 'serial', timeout: 300_000 });

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
const spec = circuitFromWorld(world, CIRCUIT_ID)!;
/** Más de una página: «Mostrar más» tiene que cargar el resto. */
const CREW = RANKING_PAGE_SIZE + 2;

interface Seeded extends TestMember {
  nickname: string;
}

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);

/** Capturas para el informe, sólo con RECORD_T92=1. */
async function snap(page: Page, name: string) {
  if (!process.env.RECORD_T92) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({
    path: path.join(OUT, `p008-t92-${name}-${test.info().project.name}.png`),
  });
}

const created: TestMember[] = [];
let fast: Seeded;
let slow: Seeded;
let viewer: Seeded;
let crewIds: string[] = [];

/** Una cuenta con sesión y Carnet (por la RPC, con la política aceptada). */
async function member(label: string, nickname: string) {
  const m = await createMember(label);
  created.push(m);
  const env = supabaseTestEnv()!;
  const session = await signInSession(m);
  const client = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  const profile = await client.rpc('save_profile', {
    p_nickname: nickname,
    p_privacy_version: PRIVACY_POLICY_VERSION,
  });
  if (profile.error) throw new Error(`save_profile: ${profile.error.message}`);
  return { m: { ...m, nickname }, client };
}

async function must(call: PromiseLike<{ error: { message: string } | null }>, what: string) {
  const { error } = await call;
  if (error) throw new Error(`${what}: ${error.message}`);
}

test.beforeAll(async () => {
  const run = randomBytes(3).toString('hex');
  const a = await member('ranking-rapida', `Rápida ${run}`);
  const b = await member('ranking-lenta', `Lenta ${run}`);
  fast = a.m;
  slow = b.m;
  // Puntos y tiempos por las RPC validadas, como en el juego.
  await must(
    a.client.rpc('award_points', {
      p_action: 'mission',
      p_ref: 'mision:fiestera:entrega',
      p_points: 200,
    }),
    'award_points',
  );
  await must(
    b.client.rpc('award_points', { p_action: 'world', p_ref: 'lugar:cala:points', p_points: 20 }),
    'award_points',
  );
  const race = (c: typeof a.client, ms: number) =>
    must(
      c.rpc('submit_race_time', { p_circuit: spec.id, p_version: spec.version, p_ms: ms }),
      'submit_race_time',
    );
  await race(a.client, 46_000);
  await race(b.client, 47_000);

  // La tripulación: Carnet y tiempo puestos con la clave de servicio, más lentos que las dos.
  const service = serviceClient();
  const crew: TestMember[] = [];
  for (let i = 0; i < CREW; i += 10) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(10, CREW - i) }, () => createMember('ranking-gente')),
    );
    created.push(...batch);
    crew.push(...batch);
    crewIds = crew.map((c) => c.id);
  }
  await must(
    service
      .from('carnets')
      .insert(crew.map((c, i) => ({ user_id: c.id, nickname: `Gente ${run} ${i + 1}` }))),
    'carnets',
  );
  await must(
    service.from('race_times').insert(
      crew.map((c, i) => ({
        user_id: c.id,
        circuit_id: spec.id,
        circuit_version: spec.version,
        best_ms: 60_000 + i * 1000,
      })),
    ),
    'race_times',
  );

  // Quien mira: el último en sacarse el Carnet, sin puntos y con el tiempo más lento.
  const v = await member('ranking-yo', `Yo ${run}`);
  viewer = v.m;
  await race(v.client, 299_000);
});

test.afterAll(async () => {
  await deleteMembers(created);
});

async function openRanking(page: Page): Promise<Locator> {
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu').getByTestId('mar-ranking-abrir').click();
  const ranking = page.getByTestId('mar-ranking').getByTestId('ranking');
  await expect(ranking).toHaveAttribute('data-modo', 'global');
  return ranking;
}

const rowsOf = (ranking: Locator) =>
  ranking.getByTestId('ranking-lista').locator('li.ranking-row:not([data-fijada])');

/** Rápida delante de Lenta, cada una en su sitio de la lista. */
async function expectOrder(ranking: Locator) {
  const a = ranking.getByTestId(`ranking-fila-${fast.id}`);
  const b = ranking.getByTestId(`ranking-fila-${slow.id}`);
  await expect(a).toContainText(fast.nickname);
  await expect(b).toContainText(slow.nickname);
  const pa = Number(await a.getAttribute('data-puesto'));
  const pb = Number(await b.getAttribute('data-puesto'));
  expect(pa).toBeLessThan(pb);
  const ids = await rowsOf(ranking).evaluateAll((els) => els.map((e) => e.dataset.testid));
  expect(ids.indexOf(`ranking-fila-${fast.id}`)).toBeLessThan(
    ids.indexOf(`ranking-fila-${slow.id}`),
  );
}

/**
 * «Tú» fuera del top: fijada debajo, tras «···», con su puesto y la línea
 * «Vas n.º de N». En los tiempos su puesto pasa de 50; en los puntos, con 0
 * comparte puesto con todos los de 0 (empates, 1, 2, 3, 3…) aunque quede
 * fuera de la página por orden de Carnet.
 */
async function expectPinnedMine(
  ranking: Locator,
  value: string | RegExp,
  beyondTop: boolean,
): Promise<number> {
  const mine = ranking.getByTestId('ranking-fila-mia');
  await expect(mine).toHaveAttribute('data-fijada', 'si');
  await expect(mine).toHaveAttribute('aria-current', 'true');
  await expect(mine).toContainText(viewer.nickname);
  await expect(mine).toContainText(t('ranking.youChip'));
  await expect(mine).toContainText(value);
  if (beyondTop) {
    expect(Number(await mine.getAttribute('data-puesto'))).toBeGreaterThan(RANKING_PAGE_SIZE);
  }
  await expect(rowsOf(ranking)).toHaveCount(RANKING_PAGE_SIZE);
  const line = (await ranking.getByTestId('ranking-mi-puesto').textContent()) ?? '';
  const m = /Vas (\d+)\.º de (\d+)/.exec(line);
  expect(m, line).not.toBeNull();
  expect(Number(m![1])).toBe(Number(await mine.getAttribute('data-puesto')));
  return Number(m![2]);
}

/**
 * «Mostrar más» hasta listar a todos: entonces desaparece, están todas las
 * cuentas sembradas y «tú» sale en su sitio. Otras pruebas pueden estar
 * creando o borrando cuentas en el mismo proyecto a la vez, así que el total
 * puede moverse entre páginas: se pulsa mientras el botón siga y se cuentan
 * las sembradas, no un total fijo.
 */
async function showAll(ranking: Locator, total: number) {
  const more = ranking.getByTestId('ranking-mas');
  await more.click();
  // El foco va a la primera fila nueva.
  await expect(rowsOf(ranking).nth(RANKING_PAGE_SIZE).getByRole('link')).toBeFocused();
  const busy = ranking.locator('[data-testid="ranking-mas"][aria-busy="true"]');
  for (let guard = 0; guard < 40; guard++) {
    await expect(busy).toHaveCount(0);
    if ((await more.count()) === 0) break;
    await more.click();
  }
  await expect(more).toHaveCount(0);
  const ids = new Set(
    await rowsOf(ranking).evaluateAll((els) => els.map((e) => e.dataset.testid ?? '')),
  );
  expect(ids.size).toBeGreaterThanOrEqual(Math.min(total, CREW + 3));
  for (const id of [fast.id, slow.id, ...crewIds]) expect(ids).toContain(`ranking-fila-${id}`);
  expect(ids).toContain('ranking-fila-mia');
  const mine = ranking.getByTestId('ranking-fila-mia');
  await expect(mine).toHaveCount(1);
  await expect(mine).not.toHaveAttribute('data-fijada', 'si');
}

test('REQ-AVE-034: un miembro ve los tiempos del circuito y los puntos de siempre de todos, en orden, con su fila «tú» fuera del top y «Mostrar más» hasta el final', async ({
  page,
}) => {
  await signInPage(page, viewer);
  const errors = await openMar(page);
  const ranking = await openRanking(page);
  await expect(ranking).toHaveAttribute('data-cuenta', 'miembro');
  // Cuatro pestañas (plan 017 T188), sin la de temporada (decisión 8).
  await expect(ranking.getByRole('tab')).toHaveCount(4);
  await expect(ranking.getByTestId('ranking-invitado')).toHaveCount(0);

  // Circuito: el del mundo que se juega, tiempos de menos a más.
  const circuitTab = ranking.getByTestId('ranking-tab-circuito');
  await expect(circuitTab).toHaveAttribute('aria-selected', 'true');
  // Un solo circuito: su nombre, sin desplegable (plan 017 T188).
  await expect(ranking.getByTestId('ranking-tabla-nombre')).toHaveText(
    translateSkinText(circuitName(world, CIRCUIT_ID) ?? spec.id),
  );
  await expect(ranking.locator('select')).toHaveCount(0);
  await expect(ranking.getByTestId('ranking-lista')).toHaveAttribute('data-scope', 'circuit');
  await expectOrder(ranking);
  await expect(ranking.getByTestId(`ranking-fila-${fast.id}`)).toContainText('46,0 s');
  const timesTotal = await expectPinnedMine(ranking, '4:59,0', true);
  await snap(page, 'circuito-tu-fuera');
  expect(timesTotal).toBeGreaterThanOrEqual(CREW + 3);
  await showAll(ranking, timesTotal);

  // De siempre: los puntos de todos los Carnets.
  await ranking.getByTestId('ranking-tab-siempre').click();
  await expect(ranking.getByTestId('ranking-lista')).toHaveAttribute('data-scope', 'all');
  await expectOrder(ranking);
  await expect(ranking.getByTestId(`ranking-fila-${fast.id}`)).toContainText('200');
  const pointsTotal = await expectPinnedMine(ranking, /\b0$/, false);
  expect(pointsTotal).toBeGreaterThanOrEqual(CREW + 3);
  await showAll(ranking, pointsTotal);
  await snap(page, 'siempre-todos');
  expect(errors).toEqual([]);
});

test('un invitado lee los rankings globales y «Entrar en el ranking» abre el acceso con su motivo', async ({
  page,
}) => {
  const errors = await openMar(page);
  const ranking = await openRanking(page);
  await expect(ranking).toHaveAttribute('data-cuenta', 'invitado');
  await expectOrder(ranking);
  await expect(ranking.getByTestId('ranking-fila-mia')).toHaveCount(0);
  await expect(ranking.getByTestId('ranking-mas')).toBeVisible();
  const box = ranking.getByTestId('ranking-invitado');
  await expect(box).toContainText(t('ranking.guest.none'));
  await snap(page, 'invitado');

  await ranking.getByTestId('ranking-tab-siempre').click();
  await expectOrder(ranking);
  await expect(ranking.getByTestId('ranking-fila-mia')).toHaveCount(0);

  await box.getByTestId('ranking-entrar').click();
  await expect(page.getByTestId('acceso-por-que')).toContainText(t('auth.why.ranking'));
  await expect(page.getByTestId('acceso-email-input')).toBeVisible();
  expect(errors).toEqual([]);
});
});

/**
 * El ranking del menú en modo local (plan 017 T188, decisión 2): cuatro
 * pestañas (carrera, Cañón, Castillo y puntos), desplegable sólo en el Cañón
 * (sus bosses) y en el Castillo (duración × dificultad), desde el menú de
 * /mar y desde el menú de la web (/ranking). Las tablas salen de la
 * configuración de cada juego (`ranking-boards.ts`), no de cuentas a mano.
 * Con `RECORD_T188=<carpeta>` guarda las capturas para Hernán.
 */
test.describe('modo local: las cuatro tablas del menú', () => {
  test.skip(E2E_SUPABASE, 'el panel local sólo sin Supabase');
  // Las capturas del móvil, a 390 × 844 (lo que pide el plan 017).
  test.beforeEach(async ({ page }, info) => {
    if (process.env.RECORD_T188 && info.project.name === 'mobile') {
      await page.setViewportSize({ width: 390, height: 844 });
    }
  });

  const canon = canonBoardOptions();
  const castle = castleBoardOptions();
  const lastCanon = canon[canon.length - 1]!;
  const lastCastle = castle[castle.length - 1]!;
  /** Tu mejor partida de este navegador en la última tabla de cada juego. */
  const CANON_SCORE = 33_333;
  const CASTLE_SCORE = 4_321;
  const formatScore = (n: number) => new Intl.NumberFormat('es-ES').format(n);

  async function seedBests(page: Page) {
    if (lastCanon.board.kind !== 'canon' || lastCastle.board.kind !== 'castle') {
      throw new Error('tablas del Cañón y del Castillo');
    }
    await page.addInitScript(
      ({ ck, ckey, cs, tk, tkey, ts }) => {
        const at = '2026-10-07T12:00:00Z';
        localStorage.setItem(ck, JSON.stringify({ [ckey]: { score: cs, at, games: 1 } }));
        localStorage.setItem(tk, JSON.stringify({ [tkey]: { score: ts, at, games: 1 } }));
      },
      {
        ck: CANON_BEST_KEY,
        ckey: canonBoardKey(lastCanon.board.boss),
        cs: CANON_SCORE,
        tk: CASTLE_BEST_KEY,
        tkey: castleBoardKey(lastCastle.board.runMin, lastCastle.board.difficulty),
        ts: CASTLE_SCORE,
      },
    );
  }

  async function shot(page: Page, where: string, name: string, select?: Locator) {
    const dir = process.env.RECORD_T188;
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    // Un <select> nativo no se ve abierto en una captura: se despliega en la página.
    if (select) await select.evaluate((el: HTMLSelectElement) => (el.size = el.options.length));
    await page.screenshot({
      path: path.join(dir, `${where}-${name}-${test.info().project.name}.png`),
      fullPage: where === 'web' && name !== 'menu',
    });
    if (select) await select.evaluate((el: HTMLSelectElement) => (el.size = 0));
  }

  /** Recorre las cuatro pestañas y comprueba cada tabla. */
  async function checkBoards(page: Page, ranking: Locator, where: string) {
    await expect(ranking).toHaveAttribute('data-modo', 'local');
    await expect(ranking.getByRole('tab')).toHaveText([
      t('ranking.tab.circuit'),
      t('ranking.tab.canon'),
      t('ranking.tab.castle'),
      t('ranking.tab.allTime'),
    ]);
    const list = ranking.getByTestId('ranking-lista');
    const mine = ranking.getByTestId('ranking-fila-mia');

    // La carrera: un circuito, con su nombre y sin desplegable.
    await expect(ranking.getByTestId('ranking-tab-circuito')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
    await expect(ranking.getByTestId('ranking-tabla-nombre')).toHaveText(
      translateSkinText(circuitName(world, CIRCUIT_ID)!),
    );
    await expect(ranking.locator('select')).toHaveCount(0);
    await expect(list).toHaveAttribute('data-scope', 'circuit');
    await shot(page, where, 'carrera');

    // El Cañón: un desplegable con sus bosses.
    await ranking.getByTestId('ranking-tab-canon').click();
    const canonSelect = ranking.getByTestId('ranking-canon');
    await expect(canonSelect.locator('option')).toHaveText(canon.map((o) => o.label));
    await expect(canonSelect).toHaveValue(canon[0]!.key);
    await expect(list).toHaveAttribute('data-scope', 'canon');
    await expect(mine).toContainText(t('ranking.board.noScore'));
    await canonSelect.selectOption(lastCanon.key);
    if (lastCanon.board.kind !== 'canon') throw new Error('tabla del Cañón');
    const canonTable = canonRanking(
      { nickname: null, bestScore: CANON_SCORE },
      lastCanon.board.boss,
    );
    await expect(list.locator('li.ranking-row')).toHaveCount(canonTable.rows.length);
    await expect(mine).toContainText(formatScore(CANON_SCORE));
    await expect(mine).toHaveAttribute('data-puesto', String(canonTable.mine.position));
    await shot(page, where, 'canon', canonSelect);

    // El Castillo: un desplegable con cada duración y dificultad.
    await ranking.getByTestId('ranking-tab-castillo').click();
    const castleSelect = ranking.getByTestId('ranking-castillo');
    await expect(castleSelect.locator('option')).toHaveText(castle.map((o) => o.label));
    await expect(list).toHaveAttribute('data-scope', 'castle');
    await castleSelect.selectOption(lastCastle.key);
    if (lastCastle.board.kind !== 'castle') throw new Error('tabla del Castillo');
    const castleTable = castleRanking(
      CASTLE_SCORE,
      lastCastle.board.runMin,
      lastCastle.board.difficulty,
    );
    await expect(list.locator('li.ranking-row')).toHaveCount(castleTable.rows.length);
    await expect(mine).toContainText(formatScore(CASTLE_SCORE));
    await expect(mine).toHaveAttribute('data-puesto', String(castleTable.mine.position));
    await shot(page, where, 'castillo', castleSelect);

    // Los puntos de siempre, sin desplegable.
    await ranking.getByTestId('ranking-tab-siempre').click();
    await expect(list).toHaveAttribute('data-scope', 'all');
    await expect(ranking.locator('select')).toHaveCount(0);
    await shot(page, where, 'puntos');
  }

  test('desde el menú de /mar', async ({ page }) => {
    await seedBests(page);
    const errors = await openMar(page);
    await page.getByTestId('mar-logros').click();
    // Con un solo mundo jugable el menú no lo nombra (decisión 3).
    await expect(page.getByTestId('mar-menu')).not.toContainText('Arcilla');
    await page.getByTestId('mar-menu').getByTestId('mar-ranking-abrir').click();
    await checkBoards(page, page.getByTestId('mar-ranking').getByTestId('ranking'), 'mar');
    expect(errors).toEqual([]);
  });

  test('desde el menú de la web: «Ranking» abre /ranking con las mismas tablas', async ({
    page,
  }, info) => {
    await seedBests(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?intro=0');
    await pastHero(page);
    const header = page.locator('.site-header');
    if (info.project.name === 'mobile') {
      await tap(page, header.getByText(t('nav.menu'), { exact: true }));
    }
    const link = header.getByTestId('cabecera-ranking').filter({ visible: true });
    await expect(link).toHaveAttribute('href', RANKING_PAGE);
    await expect(link).toHaveText(t('nav.ranking'));
    await shot(page, 'web', 'menu');
    await tap(page, link);
    await expect(page).toHaveURL(new RegExp(`${RANKING_PAGE}$`));
    const ranking = page.getByTestId('ranking-pagina').getByTestId('ranking');
    await checkBoards(page, ranking, 'web');
    expect(errors).toEqual([]);
  });
});
