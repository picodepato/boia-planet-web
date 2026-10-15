import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ART_BASE_URL, ART_CACHE_CONTROL, LEGACY_ART_BASE_URL } from '../lib/art-url';
import { securityHeaders } from '../lib/security-headers';
// @ts-expect-error: script de Node sin tipos
import { headersFile, redirectsFile } from './cf-assets.mjs';
// @ts-expect-error: script de Node sin tipos
import { ASSETS_MAX_FILES, BUDGET_GZIP, shouldCopy } from './cf-measure.mjs';

/**
 * Construcción para Cloudflare (plan 027 T262): el `_headers` de los archivos
 * estáticos repite lo que `next.config.ts` pone en Vercel, la copia que mide
 * `cf:measure` deja fuera lo que no construye, y `wrangler.jsonc` lleva lo
 * que OpenNext exige.
 */

const WEB = path.resolve(__dirname, '..');
const ROOT = path.resolve(WEB, '../..');

describe('cf-headers: las cabeceras de los estáticos son las de Next', () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  };
  const text: string = headersFile(env);
  const expected = securityHeaders({
    dev: false,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
  });

  it('todas las de seguridad, bajo /*, con el Supabase del entorno en la CSP', () => {
    const block = text.split('\n/*\n')[1]!.split('\n/_next/static/*')[0]!;
    for (const h of expected) expect(block).toContain(`  ${h.key}: ${h.value}`);
    expect(block).toContain('https://abc.supabase.co wss://abc.supabase.co');
    expect(block).not.toContain("'unsafe-eval'");
  });

  it('caché inmutable de /_next/static y la del arte de lib/art-url', () => {
    expect(text).toContain('/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable');
    expect(text).toContain(`${ART_BASE_URL}/*\n  Cache-Control: ${ART_CACHE_CONTROL}`);
    expect(text).toContain(`${LEGACY_ART_BASE_URL}/*\n  Cache-Control: ${ART_CACHE_CONTROL}`);
    expect(text.endsWith('\n')).toBe(true);
  });

  it('las URL viejas del arte reescriben (200) a las nuevas, como el rewrite de Next', () => {
    expect(redirectsFile()).toBe(`${LEGACY_ART_BASE_URL}/* ${ART_BASE_URL}/:splat 200\n`);
  });

  it('sin Supabase no se añade nada a connect-src', () => {
    const local: string = headersFile({});
    expect(local).not.toContain('supabase');
  });
});

describe('cf-measure: la copia de trabajo', () => {
  const inRepo = (...p: string[]) => path.join(ROOT, ...p);

  it('deja fuera .git, node_modules, docs, salidas, arte copiado y variables locales', () => {
    for (const p of [
      ['.git', 'HEAD'],
      ['node_modules', 'next', 'package.json'],
      ['apps', 'web', 'node_modules', 'x.js'],
      ['docs', 'spec', '00-indice.md'],
      ['apps', 'web', '.next', 'BUILD_ID'],
      ['apps', 'web', '.open-next', 'worker.js'],
      ['apps', 'web', 'public', 'art', 'x.png'],
      ['apps', 'web', 'public', 'atlas', 'x.png'],
      ['.env'],
      ['.env.local'],
      ['apps', 'web', '.env.production'],
      ['e1.log'],
    ]) {
      expect(shouldCopy(inRepo(...p), ROOT), p.join('/')).toBe(false);
    }
  });

  it('copia lo que construye: fuentes, arte, lockfile, .env.example', () => {
    for (const p of [
      ['package.json'],
      ['pnpm-lock.yaml'],
      ['pnpm-workspace.yaml'],
      ['.env.example'],
      ['apps', 'web', 'package.json'],
      ['apps', 'web', 'wrangler.jsonc'],
      ['art', 'barcos', 'manifest.json'],
      ['packages', 'engine', 'src', 'index.ts'],
      ['tools', 'deck', 'package.json'],
    ]) {
      expect(shouldCopy(inRepo(...p), ROOT), p.join('/')).toBe(true);
    }
    expect(shouldCopy(ROOT, ROOT)).toBe(true);
  });

  it('presupuesto por debajo del límite del plan gratuito (3 MB gzip)', () => {
    expect(BUDGET_GZIP).toBeLessThan(3 * 1024 * 1024);
    expect(ASSETS_MAX_FILES).toBe(20_000);
  });
});

describe('wrangler.jsonc y .gitignore', () => {
  const jsonc = readFileSync(path.join(WEB, 'wrangler.jsonc'), 'utf8');
  // Los comentarios del archivo ocupan líneas enteras; Prettier deja comas finales.
  const config = JSON.parse(jsonc.replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1'));

  it('Worker boia-planet con nodejs_compat, assets y la salida de OpenNext', () => {
    expect(config.name).toBe('boia-planet');
    expect(config.main).toBe('.open-next/worker.js');
    expect(config.compatibility_flags).toContain('nodejs_compat');
    expect(config.assets).toEqual({ directory: '.open-next/assets', binding: 'ASSETS' });
    expect(config.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(config.compatibility_date).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('las salidas de la construcción no se suben', () => {
    const ignore = readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split('\n');
    expect(ignore).toContain('.open-next/');
    expect(ignore).toContain('.wrangler/');
  });
});
