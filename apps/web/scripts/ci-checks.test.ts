import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_AUTHORS,
  LOG_FORMAT,
  explain,
  foreignCommits,
  isAllowed,
  main,
  parseLog,
  resolveRange,
  // @ts-expect-error: script de Node sin tipos
} from './check-authors.mjs';
import {
  ASSETS_MAX_FILE_BYTES,
  ASSETS_MAX_FILES,
  BUDGET_GZIP,
  limitProblems,
  // @ts-expect-error: script de Node sin tipos
} from './cf-measure.mjs';

/**
 * Comprobaciones de CI (plan 028 T267): el tamaño del Worker de Cloudflare y
 * el autor de los commits que se suben a `main`.
 */

const ROOT = path.resolve(__dirname, '../../..');
const SEP = '\x1f';
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const ZERO = '0'.repeat(40);
const OK = ALLOWED_AUTHORS[0] as { name: string; email: string };

type Call = string[];
/** Un git falso: `log` devuelve `logOut`; `cat-file -e` dice si existe. */
function fakeGit(logOut: string, known: string[] = [SHA_A, SHA_B]) {
  const calls: Call[] = [];
  const runGit = (args: string[]) => {
    calls.push(args);
    if (args[0] === 'cat-file') {
      const sha = (args[2] ?? '').replace('^{commit}', '');
      return { status: known.includes(sha) ? 0 : 1, stdout: '', stderr: '' };
    }
    return { status: 0, stdout: logOut, stderr: '' };
  };
  return { runGit, calls };
}
const line = (sha: string, name: string, email: string, subject = 'algo') =>
  [sha, name, email, subject].join(SEP);
function run(argv: string[], logOut: string, known?: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const g = fakeGit(logOut, known);
  const code = main(argv, {
    log: (s: string) => out.push(s),
    error: (s: string) => err.push(s),
    runGit: g.runGit,
  });
  return { code, out: out.join('\n'), err: err.join('\n'), calls: g.calls };
}

describe('check-authors: el autor de los commits subidos', () => {
  it('todos permitidos → 0, y mira before..after', () => {
    const log = [line(SHA_B, OK.name, OK.email), line(SHA_A, OK.name, OK.email.toUpperCase())];
    const r = run(['--before', SHA_A, '--after', SHA_B], log.join('\n'));
    expect(r.code).toBe(0);
    const logCall = r.calls.find((c) => c[0] === 'log');
    expect(logCall).toEqual(['log', `--format=${LOG_FORMAT}`, `${SHA_A}..${SHA_B}`]);
  });

  it('un autor de fuera → 1, y explica Vercel Hobby y cómo rehacer el autor', () => {
    const log = [
      line(SHA_B, OK.name, OK.email),
      line(SHA_A, 'hernandiazz9', 'hernan@example.com', 'cambio'),
    ];
    const r = run(['--before', 'c'.repeat(40), '--after', SHA_B], log.join('\n'), [
      SHA_B,
      'c'.repeat(40),
    ]);
    expect(r.code).toBe(1);
    expect(r.err).toContain('hernandiazz9 <hernan@example.com>');
    expect(r.err).toContain('aaaaaaa');
    expect(r.err).not.toContain(`bbbbbbb ${OK.name}`);
    expect(r.err).toMatch(/Vercel Hobby/);
    expect(r.err).toMatch(/--reset-author/);
    expect(r.err).toContain('ALLOWED_AUTHORS');
  });

  it('rango vacío (nada nuevo) → 0', () => {
    const r = run(['--before', SHA_A, '--after', SHA_A], '');
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/0 commit/);
  });

  it('primer push (before todo ceros) → sólo el commit after', () => {
    expect(resolveRange({ before: ZERO, after: SHA_B }).args).toEqual(['-1', SHA_B]);
    const r = run(['--before', ZERO, '--after', SHA_B], line(SHA_B, OK.name, OK.email));
    expect(r.code).toBe(0);
    expect(r.calls.find((c) => c[0] === 'log')?.slice(2)).toEqual(['-1', SHA_B]);
    // Y si ese commit es de fuera, falla igual.
    const bad = run(['--before', ZERO, '--after', SHA_B], line(SHA_B, 'x', 'x@example.com'));
    expect(bad.code).toBe(1);
  });

  it('before que ya no existe (push forzado) → sólo after', () => {
    const range = resolveRange({ before: 'c'.repeat(40), after: SHA_B }, () => false);
    expect(range.args).toEqual(['-1', SHA_B]);
  });

  it('pull request → base..head; sin argumentos → 2', () => {
    expect(resolveRange({ base: SHA_A, head: SHA_B }).args).toEqual([`${SHA_A}..${SHA_B}`]);
    expect(() => resolveRange({ base: SHA_A })).toThrow();
    expect(run([], '').code).toBe(2);
  });

  it('la lista: picodepato <admin@boiaplanet.net> y su noreply de GitHub, nadie más', () => {
    expect(isAllowed('admin@boiaplanet.net')).toBe(true);
    expect(isAllowed(' Admin@BoiaPlanet.net ')).toBe(true);
    expect(isAllowed('12345+picodepato@users.noreply.github.com')).toBe(true);
    expect(isAllowed('12345+otro@users.noreply.github.com')).toBe(false);
    expect(isAllowed('admin@boiaplanet.net.evil.com')).toBe(false);
    for (const a of ALLOWED_AUTHORS as { name: string }[]) expect(a.name).toBe('picodepato');
  });

  it('parseLog y foreignCommits', () => {
    const commits = parseLog(
      `${line(SHA_A, OK.name, OK.email, 'a|b')}\r\n\n${line(SHA_B, 'z', 'z@z.z')}\n`,
    );
    expect(commits).toHaveLength(2);
    expect(commits[0].subject).toBe('a|b');
    expect(foreignCommits(commits).map((c: { sha: string }) => c.sha)).toEqual([SHA_B]);
    expect(explain(foreignCommits(commits))).toMatch(/^Hay 1 commit/);
  });

  it('el flujo llama al script con el rango del evento y sólo lee el repo', () => {
    const yml = readFileSync(path.join(ROOT, '.github/workflows/commit-author.yml'), 'utf8');
    expect(yml).toContain('node apps/web/scripts/check-authors.mjs');
    expect(yml).toMatch(/github\.event\.before/);
    expect(yml).toMatch(/github\.event\.pull_request\.base\.sha/);
    expect(yml).toMatch(/permissions:\s*\n\s*contents: read/);
  });
});

describe('cf-measure: límites de Cloudflare', () => {
  const worker = (gzip: number) => ({ raw: gzip * 4, gzip, files: [] });
  const assets = (count: number, largest: number) => ({
    count,
    bytes: count * 1000,
    largest: { file: 'art/grande.webp', bytes: largest },
  });

  it('dentro de los límites → sin problemas (justo en el límite vale)', () => {
    expect(
      limitProblems(worker(BUDGET_GZIP), assets(ASSETS_MAX_FILES, ASSETS_MAX_FILE_BYTES)),
    ).toEqual([]);
  });

  it('Worker por encima del presupuesto', () => {
    const p = limitProblems(worker(BUDGET_GZIP + 1), assets(10, 10));
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/Worker.*presupuesto de 2,800 KiB/);
  });

  it('demasiados archivos estáticos', () => {
    const p = limitProblems(worker(1), assets(ASSETS_MAX_FILES + 1, 10));
    expect(p).toHaveLength(1);
    expect(p[0]).toContain(String(ASSETS_MAX_FILES + 1));
  });

  it('un archivo estático demasiado grande', () => {
    const p = limitProblems(worker(1), assets(10, ASSETS_MAX_FILE_BYTES + 1));
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('art/grande.webp');
    expect(p[0]).toMatch(/25 MiB/);
  });

  it('el flujo corre cf:measure en Linux con el Node y el pnpm de Workers Builds', () => {
    const yml = readFileSync(path.join(ROOT, '.github/workflows/cf-size.yml'), 'utf8');
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(yml).toContain('pnpm cf:measure');
    expect(yml).toMatch(/runs-on: ubuntu-/);
    // pnpm/action-setup sin `version` lee `packageManager`; Workers Builds usa
    // PNPM_VERSION, que DESPLIEGUE.md fija al mismo valor.
    expect(yml).toContain('pnpm/action-setup@v4');
    expect(yml).not.toMatch(/^\s+version:/m);
    const despliegue = readFileSync(path.join(ROOT, 'docs/DESPLIEGUE.md'), 'utf8');
    expect(despliegue).toContain(
      `| \`PNPM_VERSION\` | \`${pkg.packageManager.replace('pnpm@', '')}\` |`,
    );
    expect(yml).toMatch(/node-version: '24'/);
    expect(yml).toMatch(/permissions:\s*\n\s*contents: read/);
  });
});
