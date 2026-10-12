#!/usr/bin/env node
/**
 * Cabeceras y reescrituras de los archivos estáticos en Cloudflare (plan 027
 * T262).
 *
 * En Cloudflare Workers los archivos de `.open-next/assets` (`public/`, el
 * arte copiado y `/_next/static`) se sirven sin pasar por el Worker, así que
 * ni las cabeceras de `next.config.ts` (`headers()`) ni sus `rewrites()` les
 * llegan. Este script corre al final de `pnpm cf:build` y escribe en
 * `.open-next/assets`:
 *
 * - `_headers`: las mismas cabeceras que pone Next en Vercel (las de seguridad
 *   de `lib/security-headers.ts` para todo, la caché inmutable de
 *   `/_next/static` y la del arte, `lib/art-url.ts`).
 * - `_redirects`: la reescritura (200) de las URL viejas del arte,
 *   `/api/art/...` → `/art/...`, que en Vercel hace el rewrite de Next.
 *
 * Las páginas HTML y los `redirects()` de Next los sirve el Worker, con las
 * cabeceras de Next. Formato:
 * https://developers.cloudflare.com/workers/static-assets/headers/
 * https://developers.cloudflare.com/workers/static-assets/redirects/
 *
 * Uso: node scripts/cf-assets.mjs [--print]
 */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(WEB, '.open-next', 'assets');

// Node 24 ejecuta TypeScript sin tipos (type stripping): los mismos módulos
// que lee next.config.ts, sin duplicar la CSP ni la caché del arte.
const { securityHeaders } = await import('../lib/security-headers.ts');
const { ART_BASE_URL, ART_CACHE_CONTROL, LEGACY_ART_BASE_URL } = await import('../lib/art-url.ts');

const GENERATED = '# Generado por scripts/cf-assets.mjs al construir; no editar a mano.';

/** `_headers`: las reglas, como las escribe `next.config.ts` para producción. */
export function headersFile(env = process.env) {
  const security = securityHeaders({
    dev: false,
    analyticsHost: env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
  });
  const art = [{ key: 'Cache-Control', value: ART_CACHE_CONTROL }];
  const rules = [
    ['/*', security],
    ['/_next/static/*', [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]],
    [`${ART_BASE_URL}/*`, art],
    // La reescritura de `_redirects` conserva la ruta pedida: también la caché.
    [`${LEGACY_ART_BASE_URL}/*`, art],
  ];
  const lines = [GENERATED];
  for (const [path, headers] of rules) {
    lines.push(path, ...headers.map((h) => `  ${h.key}: ${h.value}`));
  }
  return `${lines.join('\n')}\n`;
}

/** `_redirects`: las URL viejas del arte sirven el archivo nuevo (200, sin salto). */
export function redirectsFile() {
  return `${LEGACY_ART_BASE_URL}/* ${ART_BASE_URL}/:splat 200\n`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const headers = headersFile();
  const redirects = redirectsFile();
  if (process.argv.includes('--print')) {
    process.stdout.write(`${headers}\n${redirects}`);
  } else {
    if (!existsSync(ASSETS)) {
      console.error(`cf-assets: no existe ${ASSETS}; ¿se corrió opennextjs-cloudflare build?`);
      process.exit(1);
    }
    writeFileSync(join(ASSETS, '_headers'), headers);
    writeFileSync(join(ASSETS, '_redirects'), redirects);
    console.log(
      `cf-assets: ${headers.split('\n').length - 1} líneas en .open-next/assets/_headers, ${
        redirects.split('\n').length - 1
      } en _redirects`,
    );
  }
}
