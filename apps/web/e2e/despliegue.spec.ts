import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openTickets, pastHero } from './hero-helpers';

/**
 * Lo que necesita el despliegue en Vercel (T30, D-04, D-16), contra el build
 * de producción de la suite (`next build` + `next start`, sin variables de
 * entorno): `/api/art` sirve el arte de `art/` y la función lleva en su traza
 * todo `art/` (en Vercel sólo existe lo trazado); sin clave de PostHog no sale
 * ninguna petición de analítica.
 */

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ART = path.resolve(WEB, '../../art');
const NFT = path.join(WEB, '.next/server/app/api/art/[...path]/route.js.nft.json');

/** Ruta relativa a `art/` con `/`, también en Windows (donde `path.relative` usa `\`). */
const fromArt = (p: string) => path.relative(ART, p).split(path.sep).join('/');

/** Todos los archivos de `art/`, relativos a `art/`. */
function artFiles(dir = ART): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? artFiles(p) : [fromArt(p)];
  });
}

const files = artFiles();
const manifests = files.filter((f) => path.basename(f) === 'manifest.json');
/** Lo que el despliegue no puede perder: los dos mundos, la entrada y el barco. */
const REQUIRED = ['mundos/arcilla/', 'mundos/acuarela/', 'intro/', 'barco/'];

test('la función /api/art lleva todo art/ en su traza', () => {
  test.skip(test.info().project.name !== 'desktop', 'una vez basta');
  const nft = JSON.parse(readFileSync(NFT, 'utf8')) as { files: string[] };
  const traced = new Set(
    nft.files
      .map((f) => path.resolve(path.dirname(NFT), f))
      .filter((f) => f.startsWith(ART + path.sep))
      .map(fromArt),
  );
  for (const prefix of REQUIRED) {
    expect(
      files.some((f) => f.startsWith(prefix)),
      `hay arte en art/${prefix}`,
    ).toBe(true);
  }
  expect(files.filter((f) => !traced.has(f))).toEqual([]);
});

test('/api/art sirve cada manifiesto y una imagen de cada parte esencial', async ({ request }) => {
  test.skip(test.info().project.name !== 'desktop', 'una vez basta');
  for (const m of manifests) {
    const res = await request.get(`/api/art/${m}`);
    expect(res.status(), m).toBe(200);
    expect(res.headers()['content-type'], m).toBe('application/json');
    expect(res.headers()['cache-control'], m).toContain('s-maxage');
  }
  for (const prefix of REQUIRED) {
    const png = files.find((f) => f.startsWith(prefix) && f.endsWith('.png'))!;
    const res = await request.get(`/api/art/${png.split('/').map(encodeURIComponent).join('/')}`);
    expect(res.status(), png).toBe(200);
    expect(res.headers()['content-type'], png).toBe('image/png');
  }
  // Fuera de art/ o con otra extensión, no.
  expect((await request.get('/api/art/..%2Fpackage.json')).status()).toBe(400);
});

test('sin clave de PostHog no sale ninguna petición de analítica', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/?intro=0');
  // `landing_view` is sent when the visitor scrolls past the hero (plan 007
  // T79), no longer on load: scroll past it, back to the top, and open the panel.
  await pastHero(page);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window.__boiaAnalytics ?? []).filter((e) => e.event === 'landing_view').length,
      ),
    )
    .toBe(1);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await openTickets(page);
  await expect(page.getByRole('dialog', { name: 'Elige tu evento' })).toBeVisible();
  // Los eventos se registran en la página (para depurar), pero no salen.
  await expect
    .poll(() => page.evaluate(() => (window.__boiaAnalytics ?? []).length))
    .toBeGreaterThan(1);
  expect(requests.filter((u) => /posthog|\/i\/v0\/e\//i.test(u))).toEqual([]);
});
