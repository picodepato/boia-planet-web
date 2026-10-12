import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error: script de Node sin tipos
import { CHECKS, checkHost, evaluate, main, normalizeBase } from './check-hosts.mjs';
// @ts-expect-error: script de Node sin tipos
import { SHA_ENV_VARS, buildVersion } from './version.mjs';

/**
 * Marca de versión y paridad de hosts (plan 027 T263): `/version.json` sale del
 * commit del host o de git, y `check:hosts` compara lo que sirve cada URL.
 */

const WEB = path.resolve(__dirname, '..');
const ROOT = path.resolve(WEB, '../..');
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const NOW = new Date('2026-10-12T10:00:00Z');

describe('version.mjs: el commit del build', () => {
  const noGit = () => '';

  it('usa la variable del host, en el orden de SHA_ENV_VARS', () => {
    for (const [i, name] of (SHA_ENV_VARS as string[]).entries()) {
      const env = Object.fromEntries(
        (SHA_ENV_VARS as string[]).slice(i).map((n, j) => [n, (j === 0 ? 'C' : 'd').repeat(40)]),
      );
      const v = buildVersion({ env, git: () => SHA_B, now: NOW });
      expect(v).toEqual({
        sha: 'c'.repeat(40),
        shortSha: 'ccccccc',
        builtAt: NOW.toISOString(),
        source: name,
      });
    }
  });

  it('sin variable (o con una que no es un commit), sale de git', () => {
    const v = buildVersion({
      env: { VERCEL_GIT_COMMIT_SHA: 'main' },
      git: () => `${SHA_A}\n`,
      now: NOW,
    });
    expect(v.sha).toBe(SHA_A);
    expect(v.source).toBe('git');
  });

  it('sin variable ni git: "unknown"', () => {
    const v = buildVersion({ env: {}, git: noGit, now: NOW });
    expect(v).toMatchObject({ sha: 'unknown', shortSha: 'unknown', source: 'unknown' });
  });

  it('corre antes de next build y de next dev, y su salida no se sube', () => {
    const pkg = JSON.parse(readFileSync(path.join(WEB, 'package.json'), 'utf8'));
    // `cf:build` (OpenNext) corre `pnpm build`: los dos hosts pasan por aquí.
    expect(pkg.scripts.build).toMatch(/node scripts\/version\.mjs && next build/);
    expect(pkg.scripts.dev).toMatch(/node scripts\/version\.mjs && next dev/);
    expect(pkg.scripts['cf:build']).toMatch(/^opennextjs-cloudflare build/);
    const ignore = readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split(/\r?\n/);
    expect(ignore).toContain('apps/web/public/version.json');
  });
});

type Route = { status: number; body?: string; headers?: Record<string, string> };

/** Un `fetch` de mentira: una tabla ruta → respuesta por host. */
function fakeFetch(hosts: Record<string, Record<string, Route | Error>>) {
  return vi.fn(async (url: string) => {
    const u = new URL(url);
    const r = hosts[u.origin]?.[u.pathname];
    if (r instanceof Error) throw r;
    if (!r) return new Response('no', { status: 404 });
    return new Response(r.body ?? '', { status: r.status, headers: r.headers ?? {} });
  });
}

const CSP = { 'content-security-policy': "default-src 'self'" };
function healthy(sha: string, extra: Record<string, Route | Error> = {}) {
  return {
    '/version.json': { status: 200, body: JSON.stringify({ sha, builtAt: NOW.toISOString() }) },
    '/': { status: 200, body: '<html>', headers: CSP },
    '/mar': { status: 200, body: '<html>', headers: CSP },
    [CHECKS.find((c: { name: string }) => c.name === 'art').path]: {
      status: 200,
      body: '{"sprites":[]}',
    },
    ...extra,
  };
}

const PUB = 'https://boiaplanet.net';
const BAK = 'https://boia-planet-roan.vercel.app';

async function run(hosts: Record<string, Record<string, Route | Error>>) {
  const f = fakeFetch(hosts);
  const results = [];
  for (const u of Object.keys(hosts)) results.push(await checkHost(u, f, 1));
  return { results, verdict: evaluate(results), fetch: f };
}

describe('check-hosts.mjs: paridad', () => {
  it('normaliza la URL base', () => {
    expect(normalizeBase('https://boiaplanet.net/')).toBe(PUB);
    expect(normalizeBase('boiaplanet.net')).toBe(PUB);
  });

  it('coinciden: mismo commit, todo 200 con CSP → bien', async () => {
    const { results, verdict, fetch } = await run({ [PUB]: healthy(SHA_A), [BAK]: healthy(SHA_A) });
    expect(verdict).toEqual({ ok: true, sha: SHA_A, problems: [] });
    expect(results[0].checks.find((c: { name: string }) => c.name === 'home').csp).toBe(true);
    // version.json lleva una marca contra cachés.
    expect(fetch.mock.calls.some(([u]) => String(u).endsWith('/version.json?t=1'))).toBe(true);
    // Sin .well-known en ninguno: no es un problema.
    expect(results[0].checks.find((c: { name: string }) => c.name === 'well-known').present).toBe(
      false,
    );
  });

  it('no coinciden: commits distintos → falla', async () => {
    const { verdict } = await run({ [PUB]: healthy(SHA_A), [BAK]: healthy(SHA_B) });
    expect(verdict.ok).toBe(false);
    expect(verdict.sha).toBeUndefined();
    expect(verdict.problems.join('\n')).toMatch(/commits distintos/);
  });

  it('.well-known en un host y no en el otro → falla', async () => {
    const wk = { '/.well-known/assetlinks.json': { status: 200, body: '[]' } };
    const { verdict } = await run({ [PUB]: healthy(SHA_A, wk), [BAK]: healthy(SHA_A) });
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.join('\n')).toMatch(/existe en unos hosts/);
  });

  it('fallos: falta version.json, sin CSP, arte roto, sin red → falla y lo dice', async () => {
    const { results, verdict } = await run({
      [PUB]: healthy(SHA_A, {
        '/version.json': { status: 404 },
        '/mar': { status: 200, body: '<html>' },
        [CHECKS.find((c: { name: string }) => c.name === 'art').path]: {
          status: 200,
          body: '<html>',
        },
      }),
      [BAK]: healthy(SHA_A, { '/': new TypeError('fetch failed') }),
    });
    expect(verdict.ok).toBe(false);
    const text = verdict.problems.join('\n');
    expect(text).toMatch(/falta \/version\.json/);
    expect(text).toMatch(/sin Content-Security-Policy/);
    expect(text).toMatch(/no es JSON/);
    expect(text).toMatch(/sin respuesta: fetch failed/);
    // Un solo commit conocido: no hay "distintos", pero tampoco se da por igual.
    expect(text).not.toMatch(/commits distintos/);
    expect(verdict.sha).toBeUndefined();
    expect(results[0].sha).toBeUndefined();
  });

  it('main: 0 si todo bien, 1 si algo falla, 2 sin URL', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(
        await main([PUB, BAK], fakeFetch({ [PUB]: healthy(SHA_A), [BAK]: healthy(SHA_A) })),
      ).toBe(0);
      expect(
        await main([PUB, BAK], fakeFetch({ [PUB]: healthy(SHA_A), [BAK]: healthy(SHA_B) })),
      ).toBe(1);
      expect(await main(['http://[nope'], fakeFetch({}))).toBe(1);
      expect(await main([], fakeFetch({}))).toBe(2);
    } finally {
      log.mockRestore();
      err.mockRestore();
    }
  });
});

describe('hosts-parity.yml', () => {
  const wf = readFileSync(path.join(ROOT, '.github', 'workflows', 'hosts-parity.yml'), 'utf8');

  it('a mano y cada 6 h, con PUBLIC_URL y BACKUP_URL, y sin ellas no hace nada', () => {
    expect(wf).toMatch(/workflow_dispatch:/);
    expect(wf).toMatch(/cron: '\d+ \*\/6 \* \* \*'/);
    expect(wf).toContain('vars.PUBLIC_URL');
    expect(wf).toContain('vars.BACKUP_URL');
    expect(wf).toContain('::notice::');
    expect(wf).toContain('node apps/web/scripts/check-hosts.mjs');
  });
});
