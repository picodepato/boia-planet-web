#!/usr/bin/env node
/**
 * Autor de los commits (plan 028 T267): Vercel Hobby sólo despliega commits
 * cuyo autor es el dueño de la cuenta (`picodepato`); con un commit de otro
 * autor en `main`, la copia de Vercel deja de desplegarse sin avisar. Este
 * script mira los commits de un rango y falla si alguno tiene un autor que no
 * está en `ALLOWED_AUTHORS` (la lista, sólo aquí).
 *
 * Qué rango mira:
 * - push: `--before <sha> --after <sha>` → `before..after`. Si `before` es
 *   todo ceros (primer push de la rama) o no existe (push forzado que lo
 *   borró), sólo el commit `after`.
 * - pull request: `--base <sha> --head <sha>` → los commits del PR,
 *   `base..head`.
 * El historial anterior al plan 028 tiene commits de otros autores
 * (p. ej. hernandiazz9): no se miran, sólo lo que se sube.
 *
 * Uso: node apps/web/scripts/check-authors.mjs --before <sha> --after <sha>
 *      node apps/web/scripts/check-authors.mjs --base <sha> --head <sha>
 * Sale con 1 si hay algún autor de fuera, con 2 si faltan argumentos o git
 * falla. En GitHub Actions: .github/workflows/commit-author.yml.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Autores permitidos, por email (sin distinguir mayúsculas). `picodepato` es
 * la cuenta de GitHub de Álvaro; sus commits salen como
 * `picodepato <admin@boiaplanet.net>` (CLAUDE.md). El email «noreply» de
 * GitHub de la misma cuenta (lo usan las fusiones hechas desde la web) también
 * vale. Para añadir a alguien: una línea más aquí.
 */
export const ALLOWED_AUTHORS = [
  { name: 'picodepato', email: 'admin@boiaplanet.net' },
  { name: 'picodepato', email: 'picodepato@users.noreply.github.com' },
  { name: 'picodepato', email: /^\d+\+picodepato@users\.noreply\.github\.com$/i },
];

const ZERO_SHA = /^0+$/;
/** Separador de campos en `git log` (no aparece en nombres ni emails). */
const SEP = '\x1f';

/** Si el email está en la lista. */
export function isAllowed(email, allowed = ALLOWED_AUTHORS) {
  const e = String(email).trim().toLowerCase();
  return allowed.some((a) =>
    a.email instanceof RegExp ? a.email.test(e) : a.email.toLowerCase() === e,
  );
}

/**
 * Qué pasar a `git log` según el evento. Devuelve `{ args, note }` o lanza si
 * faltan los argumentos. `exists(sha)` dice si git conoce ese commit.
 */
export function resolveRange({ before, after, base, head }, exists = () => true) {
  if (base || head) {
    if (!base || !head) throw new Error('--base y --head van juntos');
    return { args: [`${base}..${head}`], note: `commits del PR (${short(base)}..${short(head)})` };
  }
  if (!after) throw new Error('falta --after (o --base y --head)');
  if (!before || ZERO_SHA.test(before)) {
    return { args: ['-1', after], note: `primer push de la rama: sólo ${short(after)}` };
  }
  if (!exists(before)) {
    return {
      args: ['-1', after],
      note: `${short(before)} ya no existe (¿push forzado?): sólo ${short(after)}`,
    };
  }
  return { args: [`${before}..${after}`], note: `push ${short(before)}..${short(after)}` };
}

/** Formato de `git log` que entiende `parseLog`. */
export const LOG_FORMAT = `%H${SEP}%an${SEP}%ae${SEP}%s`;

/** Commits de la salida de `git log --format=LOG_FORMAT`. */
export function parseLog(text) {
  return String(text)
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => {
      const [sha, name, email, subject] = l.split(SEP);
      return { sha, name, email, subject: subject ?? '' };
    });
}

/** Los commits cuyo autor no está en la lista. */
export function foreignCommits(commits, allowed = ALLOWED_AUTHORS) {
  return commits.filter((c) => !isAllowed(c.email, allowed));
}

/** Mensaje para Álvaro cuando hay commits de otro autor. */
export function explain(foreign) {
  const lines = foreign.map((c) => `  ${short(c.sha)} ${c.name} <${c.email}>  ${c.subject}`);
  return [
    `Hay ${foreign.length} commit(s) con un autor que no es picodepato <admin@boiaplanet.net>:`,
    ...lines,
    '',
    'Por qué importa: Vercel Hobby sólo despliega commits del dueño de la cuenta.',
    'Con uno de otro autor en main, la copia de Vercel deja de desplegarse.',
    '',
    'Cómo arreglarlo (antes de subir; si ya está subido hace falta un push forzado):',
    '  git config user.name picodepato',
    '  git config user.email admin@boiaplanet.net',
    '  - sólo el último commit:  git commit --amend --no-edit --reset-author',
    '  - varios:  git rebase <commit-de-antes> --exec "git commit --amend --no-edit --reset-author"',
    'Si esa persona debe poder subir, añádela a ALLOWED_AUTHORS en apps/web/scripts/check-authors.mjs.',
  ].join('\n');
}

function short(sha) {
  return String(sha).slice(0, 7);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--(before|after|base|head)$/.exec(argv[i]);
    if (m) out[m[1]] = argv[++i] ?? '';
  }
  return out;
}

function git(args) {
  return spawnSync('git', args, { encoding: 'utf8' });
}

/** Corre la comprobación; devuelve el código de salida. */
export function main(argv, { log = console.log, error = console.error, runGit = git } = {}) {
  let range;
  try {
    range = resolveRange(
      parseArgs(argv),
      (sha) => runGit(['cat-file', '-e', `${sha}^{commit}`]).status === 0,
    );
  } catch (e) {
    error(`check-authors: ${e.message}`);
    return 2;
  }
  const r = runGit(['log', `--format=${LOG_FORMAT}`, ...range.args]);
  if (r.status !== 0) {
    error(`check-authors: git log falló: ${r.stderr}`);
    return 2;
  }
  const commits = parseLog(r.stdout);
  log(`check-authors: ${range.note}; ${commits.length} commit(s)`);
  const foreign = foreignCommits(commits);
  if (foreign.length === 0) {
    log('check-authors: todos los autores están permitidos');
    return 0;
  }
  const msg = explain(foreign);
  if (process.env.GITHUB_ACTIONS === 'true') {
    // Una anotación por commit; el mensaje entero, en el registro.
    for (const c of foreign) {
      log(
        `::error title=Autor no permitido::${short(c.sha)} es de ${c.name} <${c.email}>: Vercel Hobby no desplegará este push. Rehaz el commit con autor picodepato <admin@boiaplanet.net> (ver el registro).`,
      );
    }
  }
  error(msg);
  return 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exit(main(process.argv.slice(2)));
