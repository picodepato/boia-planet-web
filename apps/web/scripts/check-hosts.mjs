#!/usr/bin/env node
/**
 * Paridad de hosts (plan 027 T263): comprueba que cada URL (Cloudflare, Vercel
 * o las que sean) sirve la web entera y que todas sirven el mismo build.
 *
 * Por cada URL pide, sólo con GET:
 * - `/version.json` (scripts/version.mjs): 200 y un commit válido;
 * - `/` y `/mar`: 200 y con cabecera Content-Security-Policy;
 * - un manifiesto del arte estático (`/art/…/manifest.json`): 200 y JSON;
 * - `/.well-known/assetlinks.json` si existe (404 en todos = no hay; si unos
 *   lo tienen y otros no, es una diferencia).
 * Al final compara los commits: tienen que ser el mismo en todas las URL, y
 * también el modo de cuentas (`accounts`: `on` con Supabase, `off` en local,
 * y `accountsRef`, el proyecto; plan 032 T302): si uno sirve cuentas y el
 * otro no, es un fallo. Si algún `/version.json` aún no lleva el campo
 * (build anterior), avisa pero no falla.
 * Sale con 1 si algo falla o no coincide; con 2 si no se le pasa ninguna URL.
 * No se cae si la URL no responde o le falta algo: lo informa.
 *
 * Uso: pnpm check:hosts <url> [<url>…] [--json]
 * En GitHub Actions: .github/workflows/hosts-parity.yml.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Lo que se pide a cada host. `kind` dice cómo se juzga la respuesta. */
export const CHECKS = [
  { name: 'version', path: '/version.json', kind: 'version' },
  { name: 'home', path: '/', kind: 'page' },
  { name: 'mar', path: '/mar', kind: 'page' },
  { name: 'art', path: '/art/barco/manifest.json', kind: 'json' },
  { name: 'well-known', path: '/.well-known/assetlinks.json', kind: 'optional' },
];

export const TIMEOUT_MS = 20_000;
const SHA_RE = /^[0-9a-f]{40}$/;

/** `https://x.app/` o `x.app` → `https://x.app` (sin barra final). */
export function normalizeBase(url) {
  const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const u = new URL(withProto);
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
}

async function request(fetchImpl, url) {
  try {
    const res = await fetchImpl(url, {
      redirect: 'follow',
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.text();
    return { status: res.status, headers: res.headers, body };
  } catch (e) {
    return { status: 0, headers: new Headers(), body: '', error: e?.message ?? String(e) };
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Juzga una respuesta según el tipo de comprobación. */
export function judge(check, res) {
  const out = { name: check.name, path: check.path, status: res.status, ok: true };
  if (res.error) {
    return { ...out, ok: false, note: `sin respuesta: ${res.error}` };
  }
  if (check.kind === 'optional') {
    if (res.status === 200) return { ...out, present: true };
    if (res.status === 404) return { ...out, present: false, note: 'no existe' };
    return { ...out, ok: false, present: false, note: `estado inesperado ${res.status}` };
  }
  if (res.status !== 200) {
    const missing = {
      version: 'falta /version.json (¿sin desplegar desde plan 027 T263?)',
      json: 'falta el arte estático /art/ (¿sin desplegar desde plan 027 T261?)',
    };
    const note = (res.status === 404 && missing[check.kind]) || `estado ${res.status}`;
    return { ...out, ok: false, note };
  }
  if (check.kind === 'page') {
    const csp = res.headers.has('content-security-policy');
    return csp ? { ...out, csp } : { ...out, csp, ok: false, note: 'sin Content-Security-Policy' };
  }
  const data = parseJson(res.body);
  if (data === undefined) return { ...out, ok: false, note: 'no es JSON' };
  if (check.kind === 'version') {
    const sha = typeof data.sha === 'string' ? data.sha.toLowerCase() : '';
    if (!SHA_RE.test(sha)) return { ...out, ok: false, note: `commit no válido: ${data.sha}` };
    const accounts = data.accounts === 'on' || data.accounts === 'off' ? data.accounts : undefined;
    const accountsRef = typeof data.accountsRef === 'string' ? data.accountsRef : null;
    return { ...out, sha, builtAt: data.builtAt, accounts, accountsRef };
  }
  return out;
}

/** Todas las comprobaciones de un host. */
export async function checkHost(url, fetchImpl = globalThis.fetch, now = Date.now()) {
  const base = normalizeBase(url);
  const checks = [];
  for (const check of CHECKS) {
    // `version.json` no puede llegar de ninguna caché: lleva una marca única.
    const query = check.kind === 'version' ? `?t=${now}` : '';
    checks.push(judge(check, await request(fetchImpl, `${base}${check.path}${query}`)));
  }
  const version = checks.find((c) => c.name === 'version');
  return {
    url: base,
    sha: version?.sha,
    accounts: version?.accounts,
    accountsRef: version?.accountsRef ?? null,
    checks,
  };
}

/**
 * Junta los resultados de todos los hosts: los fallos de cada uno, si los
 * commits coinciden y si `.well-known` está en unos sí y en otros no.
 */
export function evaluate(results) {
  const problems = [];
  for (const r of results) {
    for (const c of r.checks) {
      if (!c.ok) problems.push(`${r.url}${c.path}: ${c.note ?? `estado ${c.status}`}`);
    }
  }
  const shas = [...new Set(results.map((r) => r.sha).filter(Boolean))];
  if (shas.length > 1) {
    problems.push(
      `commits distintos: ${results.map((r) => `${r.url}=${r.sha?.slice(0, 7) ?? '?'}`).join(', ')}`,
    );
  }
  // Modo de cuentas (plan 032 T302): el mismo en todos los hosts.
  const warnings = [];
  const withMode = results.filter((r) => r.accounts);
  for (const r of results) {
    if (!r.accounts && r.sha) {
      warnings.push(
        `${r.url}: /version.json sin el campo "accounts" (build anterior): no se compara el modo de cuentas`,
      );
    }
  }
  const modes = [...new Set(withMode.map((r) => r.accounts))];
  if (modes.length > 1) {
    problems.push(
      `modo de cuentas distinto: ${withMode.map((r) => `${r.url}=${r.accounts}`).join(', ')}`,
    );
  } else if (modes[0] === 'on') {
    const refs = [...new Set(withMode.map((r) => r.accountsRef ?? '?'))];
    if (refs.length > 1) {
      problems.push(
        `proyecto de cuentas distinto: ${withMode.map((r) => `${r.url}=${r.accountsRef ?? '?'}`).join(', ')}`,
      );
    }
  }
  for (const check of CHECKS.filter((c) => c.kind === 'optional')) {
    const present = results.map((r) => r.checks.find((c) => c.name === check.name)?.present);
    if (present.includes(true) && present.includes(false)) {
      problems.push(`${check.path} existe en unos hosts y en otros no`);
    }
  }
  const allHaveSha = results.length > 0 && results.every((r) => r.sha);
  return {
    ok: problems.length === 0,
    sha: shas.length === 1 && allHaveSha ? shas[0] : undefined,
    accounts: modes.length === 1 && withMode.length === results.length ? modes[0] : undefined,
    problems,
    warnings,
  };
}

/** El informe legible. */
export function formatReport(results, verdict) {
  const lines = [];
  for (const r of results) {
    lines.push(`${r.url}  commit ${r.sha ? r.sha.slice(0, 7) : '—'}`);
    for (const c of r.checks) {
      const mark = c.ok ? 'ok ' : 'MAL';
      const csp = c.csp === undefined ? '' : c.csp ? '  CSP sí' : '  CSP no';
      const note = c.note ? `  (${c.note})` : '';
      lines.push(`  ${mark} ${String(c.status).padStart(3)}  ${c.path}${csp}${note}`);
    }
  }
  if (results.length > 1) {
    lines.push(
      verdict.sha
        ? `mismo commit en los ${results.length} hosts: ${verdict.sha.slice(0, 7)}`
        : 'los hosts NO sirven el mismo commit (o a alguno le falta /version.json)',
    );
  }
  if (results.length > 1 && verdict.accounts) {
    lines.push(`mismo modo de cuentas en los ${results.length} hosts: ${verdict.accounts}`);
  }
  for (const w of verdict.warnings ?? []) lines.push(`aviso: ${w}`);
  lines.push(
    verdict.ok ? 'check:hosts: todo bien' : `check:hosts: ${verdict.problems.length} problema(s)`,
  );
  for (const p of verdict.problems) lines.push(`  - ${p}`);
  return lines.join('\n');
}

export async function main(argv, fetchImpl = globalThis.fetch) {
  const urls = argv.filter((a) => !a.startsWith('--'));
  if (urls.length === 0) {
    console.error('Uso: pnpm check:hosts <url> [<url>…] [--json]');
    return 2;
  }
  const results = [];
  for (const u of urls) {
    try {
      results.push(await checkHost(u, fetchImpl));
    } catch (e) {
      // URL mal escrita: cuenta como un host que falla entero.
      results.push({
        url: u,
        sha: undefined,
        checks: [
          {
            name: 'url',
            path: '',
            status: 0,
            ok: false,
            note: `URL no válida: ${e?.message ?? e}`,
          },
        ],
      });
    }
  }
  const verdict = evaluate(results);
  if (argv.includes('--json')) console.log(JSON.stringify({ ...verdict, results }));
  else console.log(formatReport(results, verdict));
  return verdict.ok ? 0 : 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  process.exitCode = await main(process.argv.slice(2));
}
