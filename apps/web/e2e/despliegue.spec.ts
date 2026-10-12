import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openTickets, pastHero } from './hero-helpers';

/**
 * Lo que necesita el despliegue (T30, D-04, D-16; plan 027 T261), contra el
 * build de producción de la suite (`next build` + `next start`, sin variables
 * de entorno): el arte de `art/` se sirve como archivos estáticos desde `/art`
 * (copiados a `public/art/` por `scripts/copy-art.mjs`, los mismos en Vercel y
 * en Cloudflare), las URL `/api/art/...` viejas siguen respondiendo, los
 * vídeos van por trozos y sin clave de PostHog no sale ninguna petición de
 * analítica.
 */

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ART = path.resolve(WEB, '../../art');
const COPY = path.join(WEB, 'public', 'art');
/** Lo que se sirve (scripts/copy-art.mjs); el resto de art/ son fuentes de Blender. */
const SERVED = new Set(['.json', '.png', '.webp', '.glb', '.mp4']);

/** Ruta relativa a `base` con `/`, también en Windows (donde `path.relative` usa `\`). */
const from = (base: string, p: string) => path.relative(base, p).split(path.sep).join('/');

/** Todos los archivos bajo `base`, relativos a `base`. */
function filesUnder(base: string, dir = base): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? filesUnder(base, p) : [from(base, p)];
  });
}

const files = filesUnder(ART).filter((f) => SERVED.has(path.extname(f).toLowerCase()));
const manifests = files.filter((f) => path.basename(f) === 'manifest.json');
/** Lo que el despliegue no puede perder: los dos mundos, la entrada y el barco. */
const REQUIRED = ['mundos/arcilla/', 'mundos/acuarela/', 'intro/', 'barco/'];
const url = (f: string) => `/art/${f.split('/').map(encodeURIComponent).join('/')}`;

test('public/art/ es un espejo exacto de lo servible de art/', () => {
  test.skip(test.info().project.name !== 'desktop', 'una vez basta');
  for (const prefix of REQUIRED) {
    expect(
      files.some((f) => f.startsWith(prefix)),
      `hay arte en art/${prefix}`,
    ).toBe(true);
  }
  const copied = new Set(filesUnder(COPY));
  expect(files.filter((f) => !copied.has(f))).toEqual([]);
  expect([...copied].filter((f) => !files.includes(f))).toEqual([]);
  for (const f of manifests) {
    expect(readFileSync(path.join(COPY, f)).equals(readFileSync(path.join(ART, f))), f).toBe(true);
  }
});

test('/art sirve cada manifiesto y una imagen de cada parte esencial', async ({ request }) => {
  test.skip(test.info().project.name !== 'desktop', 'una vez basta');
  for (const m of manifests) {
    const res = await request.get(url(m));
    expect(res.status(), m).toBe(200);
    expect(res.headers()['content-type'], m).toContain('application/json');
    expect(res.headers()['cache-control'], m).toContain('s-maxage');
  }
  for (const prefix of REQUIRED) {
    const png = files.find((f) => f.startsWith(prefix) && f.endsWith('.png'))!;
    const res = await request.get(url(png));
    expect(res.status(), png).toBe(200);
    expect(res.headers()['content-type'], png).toBe('image/png');
  }
  // Lo que falta es un 404 (un host estático no da 204; el motor lo trata como «no hay»).
  expect((await request.get('/art/islas/3d/no-existe.glb')).status()).toBe(404);
  // Las URL de antes del plan 027 siguen sirviendo lo mismo.
  expect((await request.get(`/api/art/${manifests[0]}`)).status()).toBe(200);
});

test('los vídeos del arte se sirven por trozos (Safari pide 206)', async ({ request }) => {
  test.skip(test.info().project.name !== 'desktop', 'una vez basta');
  const mp4 = files.find((f) => f.endsWith('.mp4'))!;
  const res = await request.get(url(mp4), { headers: { range: 'bytes=0-15' } });
  expect(res.status(), mp4).toBe(206);
  expect(res.headers()['content-range'], mp4).toMatch(/^bytes 0-15\//);
  expect((await res.body()).length).toBe(16);
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
