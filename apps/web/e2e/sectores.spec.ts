import { type Page, expect, test } from '@playwright/test';

/**
 * Carga del mundo por sectores (T47, REQ-MUN-012, REQ-ARQ-014): antes de
 * jugar sólo baja el arte de alrededor del puerto (≤ 5 MB con todo lo
 * demás), el resto llega por el camino y lo lejano se suelta, sin ningún
 * fotograma con un objeto a la vista sin su arte (`data-arte-faltante`).
 */

const FIRST_PLAY_BUDGET = 5 * 1024 * 1024;

const juego = (page: Page) => page.getByTestId('juego');
const attr = async (page: Page, name: string) => (await juego(page).getAttribute(name)) ?? '';
const ship = async (page: Page) =>
  (await attr(page, 'data-barco')).split(',').map(Number) as [number, number];

/** Bytes de cada respuesta terminada (páginas, JS, arte; también las de los workers). */
function recordTransfers(page: Page) {
  const done: { url: string; at: number; bytes: number }[] = [];
  page.on('requestfinished', async (req) => {
    const at = Date.now();
    try {
      const s = await req.sizes();
      done.push({ url: req.url(), at, bytes: s.responseBodySize + s.responseHeadersSize });
    } catch {
      // petición sin respuesta medible
    }
  });
  return done;
}

test('del puerto a la última isla: sólo el primer sector antes de jugar, el resto por el camino y sin arte ausente', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const transfers = recordTransfers(page);
  await page.goto('/juego');
  // Primera jugada: el motor ya pinta y da datos.
  await expect(juego(page)).toHaveAttribute('data-barco', /\d/, { timeout: 30_000 });
  const ready = Date.now();
  const first = (await attr(page, 'data-sectores')).split(' ');
  expect(first).toContain('puerto');
  expect(first).not.toContain('ultima');
  expect(first).not.toContain('allday');

  // Lo transferido hasta poder jugar (HTML, JS, CSS, manifiestos y arte) cabe en 5 MB.
  await page.waitForTimeout(300);
  const before = transfers.filter((t) => t.at <= ready);
  const bytes = before.reduce((s, t) => s + t.bytes, 0);
  test.info().annotations.push({
    type: 'bytes antes de jugar',
    description: `${(bytes / 1024).toFixed(0)} kB en ${before.length} respuestas`,
  });
  expect(bytes).toBeLessThanOrEqual(FIRST_PLAY_BUDGET);
  // Con atlas: el arte del puerto sale de su hoja, no de sus PNG sueltos (la
  // tripulante de la Fiestera va aparte, con el barco).
  const artBefore = before.filter((t) =>
    /\/api\/art\/mundos\/[^/]+\/(puerto|costa_[a-z]+)\/.+\.png/.test(t.url),
  );
  const sheets = before.filter((t) =>
    /\/atlas\/.+\/puerto\.alta\.\d+\.[0-9a-f]+\.webp/.test(t.url),
  );
  expect(sheets.length).toBeGreaterThan(0);
  expect(artBefore).toHaveLength(0);

  // Navega solo (piloto automático, T43; `?piloto=<lugar>`) del puerto a la última isla.
  await page.goto('/juego?piloto=ultima');
  await expect(juego(page)).toHaveAttribute('data-barco', /\d/, { timeout: 30_000 });
  await expect
    .poll(async () => (await ship(page))[1], { timeout: 40_000, intervals: [500] })
    .toBeLessThan(-9000);
  await expect(page.getByTestId('rumbo')).toBeHidden({ timeout: 20_000 });
  const end = (await attr(page, 'data-sectores')).split(' ');
  expect(end).toContain('ultima');
  // Lo lejano se suelta: el puerto ya no está en memoria.
  expect(end).not.toContain('puerto');
  // Ni un fotograma con un objeto a la vista sin su arte en todo el viaje.
  expect(await attr(page, 'data-arte-faltante')).toBe('0');
  // Los sectores del camino llegaron como hojas de atlas.
  const later = transfers.filter((t) => /\/atlas\/.+\/(allday|ultima)\.alta\./.test(t.url));
  expect(later.length).toBeGreaterThan(0);
});

test('calidad baja: atlas a media resolución y el mismo mundo sin arte ausente', async ({
  page,
}) => {
  const transfers = recordTransfers(page);
  await page.goto('/juego?calidad=baja&cerca=allday');
  await expect(juego(page)).toHaveAttribute('data-calidad', 'baja', { timeout: 30_000 });
  await expect(juego(page)).toHaveAttribute('data-sectores', /allday/);
  await expect.poll(() => attr(page, 'data-arte-cargando'), { timeout: 10_000 }).toBe('0');
  expect(await attr(page, 'data-arte-faltante')).toBe('0');
  expect(transfers.some((t) => /\/atlas\/.+\/allday\.baja\./.test(t.url))).toBe(true);
  expect(transfers.some((t) => /\/atlas\/.+\.alta\./.test(t.url))).toBe(false);
});
