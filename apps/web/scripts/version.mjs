#!/usr/bin/env node
/**
 * Marca de versión del build (plan 027 T263): escribe `public/version.json`
 * con el commit y la hora de construcción, para comprobar que Cloudflare y
 * Vercel sirven el mismo build (`pnpm check:hosts`, scripts/check-hosts.mjs).
 *
 * Corre junto a la copia del arte, antes de `next build`; los dos hosts pasan
 * por ahí (`pnpm build` en Vercel; `pnpm cf:build` → `opennextjs-cloudflare
 * build` → `pnpm build` en Cloudflare). El archivo está en `.gitignore`.
 *
 * El commit sale de la variable del host (`VERCEL_GIT_COMMIT_SHA`;
 * `WORKERS_CI_COMMIT_SHA` en Workers Builds; `CF_PAGES_COMMIT_SHA` en Pages)
 * y, si no hay, de `git rev-parse HEAD`. Sin ninguno: `"unknown"`, y
 * `check:hosts` lo da por fallo.
 *
 * Uso: node scripts/version.mjs [--print]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const VERSION_FILE = join(WEB, 'public', 'version.json');

/** Variables de entorno con el commit, en orden de preferencia. */
export const SHA_ENV_VARS = [
  'VERCEL_GIT_COMMIT_SHA',
  'WORKERS_CI_COMMIT_SHA',
  'CF_PAGES_COMMIT_SHA',
];

const SHA_RE = /^[0-9a-f]{40}$/;

function gitHead() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: WEB,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

/**
 * El modo de cuentas del build (plan 032 T302), con la misma regla que
 * `lib/supabase/config.ts`: hay Supabase si están `NEXT_PUBLIC_SUPABASE_URL`
 * (https, o localhost) y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Devuelve
 * `{ accounts: 'on' | 'off', accountsRef }`; la referencia es el subdominio
 * de supabase.co (público: va en el JavaScript de la web), nunca una clave.
 */
export function accountsMode(env = process.env) {
  const off = { accounts: 'off', accountsRef: null };
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = String(env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  if (!url || !key) return off;
  let host;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') {
      return off;
    }
    host = u.hostname;
  } catch {
    return off;
  }
  const m = /^([a-z0-9]{20})\.supabase\.(?:co|in)$/.exec(host);
  return { accounts: 'on', accountsRef: m ? m[1] : null };
}

/**
 * El contenido de `/version.json`: `{ sha, shortSha, builtAt, source,
 * accounts, accountsRef }`. `source` dice de dónde salió el commit (la
 * variable, `git` o `unknown`); `accounts`, si el build lleva el modo de
 * cuentas (`on`) o el local (`off`).
 */
export function buildVersion({ env = process.env, git = gitHead, now = new Date() } = {}) {
  let sha = '';
  let source = 'unknown';
  for (const name of SHA_ENV_VARS) {
    const v = String(env[name] ?? '')
      .trim()
      .toLowerCase();
    if (SHA_RE.test(v)) {
      sha = v;
      source = name;
      break;
    }
  }
  if (!sha) {
    const v = String(git() ?? '')
      .trim()
      .toLowerCase();
    if (SHA_RE.test(v)) {
      sha = v;
      source = 'git';
    }
  }
  if (!sha) sha = 'unknown';
  return {
    sha,
    shortSha: sha === 'unknown' ? sha : sha.slice(0, 7),
    builtAt: now.toISOString(),
    source,
    ...accountsMode(env),
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const v = buildVersion();
  const text = `${JSON.stringify(v, null, 2)}\n`;
  if (process.argv.includes('--print')) {
    process.stdout.write(text);
  } else {
    mkdirSync(dirname(VERSION_FILE), { recursive: true });
    writeFileSync(VERSION_FILE, text);
    console.log(`version: ${v.shortSha} (${v.source}) en public/version.json`);
  }
}
