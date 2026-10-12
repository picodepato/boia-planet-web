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
 * El contenido de `/version.json`: `{ sha, shortSha, builtAt, source }`.
 * `source` dice de dónde salió el commit (la variable, `git` o `unknown`).
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
