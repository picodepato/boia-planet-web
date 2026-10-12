#!/usr/bin/env node
/**
 * Recordatorios de cosas que caducan (plan 028 T266). Lee
 * `scripts/caducidades.json` y abre issues en GitHub:
 *
 * - por cada caducidad con fecha, cuando faltan 60, 30 o 7 días (`avisos`):
 *   un issue por cosa; si ya hay uno abierto y se llega a un aviso más
 *   cercano, comenta en él en vez de abrir otro. Pasada la fecha sigue
 *   avisando (como el aviso más cercano) hasta que se cambie la fecha;
 * - por cada recordatorio mensual: un issue por mes; si el del mes anterior
 *   sigue abierto, comenta en él en vez de abrir otro.
 *
 * No cierra nada: los issues los cierra Álvaro al hacerlo. Cada issue y cada
 * comentario llevan marcas ocultas (`<!-- recordatorio:… -->`) para que correr
 * el script dos veces no repita nada.
 *
 * Uso:
 *   node apps/web/scripts/recordatorios.mjs              (en Actions: hace)
 *   node apps/web/scripts/recordatorios.mjs --dry-run [--fecha 2027-08-20]
 * Con --dry-run sólo escribe lo que haría; si además hay GITHUB_TOKEN y
 * GITHUB_REPOSITORY, lee los issues abiertos (sin cambiar nada); si no, hace
 * como si no hubiera ninguno. Variables: GITHUB_TOKEN, GITHUB_REPOSITORY
 * (`dueño/repo`). En GitHub Actions: .github/workflows/recordatorios.yml.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DATA_PATH = join(HERE, 'caducidades.json');
const API = 'https://api.github.com';
const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function loadData(file = DATA_PATH) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** `2027-10-12` → milisegundos UTC; lanza si no es una fecha válida. */
export function parseDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) throw new Error(`fecha no válida: ${s}`);
  const ms = Date.parse(`${s}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== s) {
    throw new Error(`fecha no válida: ${s}`);
  }
  return ms;
}

/** La fecha de hoy (UTC) como `AAAA-MM-DD`. */
export function todayUtc(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** Días enteros de `today` a `date` (negativo si ya pasó). */
export function daysUntil(date, today) {
  return Math.round((parseDate(date) - parseDate(today)) / DAY_MS);
}

/**
 * El aviso que toca: el más cercano (menor) de `avisos` que ya se alcanzó, o
 * `null` si aún falta más que el mayor. Pasada la fecha, el menor.
 */
export function thresholdFor(days, avisos) {
  const sorted = [...avisos].sort((a, b) => a - b);
  return sorted.find((t) => days <= t) ?? null;
}

/** `2027-10-12` → `12 de octubre de 2027`. */
export function fechaLarga(s) {
  const [y, m, d] = s.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

/** `2026-10` → `octubre de 2026`. */
export function mesLargo(month) {
  const [y, m] = month.split('-').map(Number);
  return `${MESES[m - 1]} de ${y}`;
}

const itemMarker = (id) => `<!-- recordatorio:${id} -->`;
const avisoMarker = (t) => `<!-- aviso:${t} -->`;
const mesMarker = (month) => `<!-- mes:${month} -->`;

/** Los textos (cuerpo y comentarios) de un issue. */
const texts = (issue) => [issue.body ?? '', ...(issue.comments ?? [])];

/** Los avisos ya dados en un issue (marcas `aviso:N` en cuerpo y comentarios). */
export function avisosDados(issue) {
  const out = new Set();
  for (const t of texts(issue)) {
    for (const m of t.matchAll(/<!-- aviso:(\d+) -->/g)) out.add(Number(m[1]));
  }
  return out;
}

/** El primer issue abierto que lleva la marca de `id`. */
export function findIssue(openIssues, id) {
  return openIssues.find((i) => (i.body ?? '').includes(itemMarker(id)));
}

function lista(pasos) {
  return pasos.map((p, i) => `${i + 1}. ${p}`).join('\n');
}

function cuandoTexto(days) {
  if (days > 1) return `faltan **${days} días**`;
  if (days === 1) return 'falta **1 día**';
  if (days === 0) return 'caduca **hoy**';
  return `**caducó hace ${-days} día${days === -1 ? '' : 's'}**`;
}

export function caducidadTitle(item, fecha = item.fecha) {
  return `Caduca el ${fecha}: ${item.que.replace(/`/g, '')}`;
}

export function caducidadBody(item, days, aviso) {
  return [
    itemMarker(item.id),
    avisoMarker(aviso),
    `**Qué caduca:** ${item.que}`,
    '',
    `**Cuándo:** ${fechaLarga(item.fecha)} (${item.fecha}); ${cuandoTexto(days)}.${item.detalle ? ` ${item.detalle}` : ''}`,
    '',
    `**Qué se rompe:** ${item.rompe}`,
    '',
    '**Cómo se renueva** (docs/DESPLIEGUE.md §8):',
    '',
    lista(item.renovar),
    '',
    '---',
    'Abierto por `.github/workflows/recordatorios.yml` (avisa a 60, 30 y 7 días; no cierra nada). La lista de caducidades está en `apps/web/scripts/caducidades.json`.',
  ].join('\n');
}

export function caducidadComment(item, days, aviso) {
  return [
    avisoMarker(aviso),
    `Aviso de ${aviso} días: ${cuandoTexto(days)} para el ${fechaLarga(item.fecha)} (${item.fecha}). Sigue sin hacer; los pasos están arriba.`,
  ].join('\n');
}

export function mensualTitle(item, month) {
  return `${item.que.replace(/`/g, '')} (${mesLargo(month)})`;
}

export function mensualBody(item, month) {
  return [
    itemMarker(item.id),
    mesMarker(month),
    `**Qué hacer en ${mesLargo(month)}:** ${item.que}`,
    '',
    `**Por qué:** ${item.rompe}`,
    '',
    '**Cómo:**',
    '',
    lista(item.hacer),
    '',
    '---',
    'Abierto cada mes por `.github/workflows/recordatorios.yml`; si sigue abierto el mes siguiente, comenta aquí en vez de abrir otro. La lista está en `apps/web/scripts/caducidades.json`.',
  ].join('\n');
}

export function mensualComment(item, month) {
  return [
    mesMarker(month),
    `Sigue abierto en ${mesLargo(month)}: ${item.que}. Cuando esté hecho, cerrar este issue.`,
  ].join('\n');
}

/**
 * Lo que hay que hacer en `today` con los issues abiertos que hay. Pura: no
 * llama a nada. `openIssues`: `[{ number, body, comments: [texto…] }]`.
 * Devuelve `[{ type: 'open', id, title, body } | { type: 'comment', id,
 * number, body } | { type: 'skip', id, reason }]`; las caducidades fuera de
 * plazo no salen.
 */
export function planReminders(data, today, openIssues = []) {
  const actions = [];
  const avisos = data.avisos ?? [60, 30, 7];
  for (const item of data.caducidades ?? []) {
    const days = daysUntil(item.fecha, today);
    const aviso = thresholdFor(days, avisos);
    if (aviso === null) continue;
    const issue = findIssue(openIssues, item.id);
    if (!issue) {
      actions.push({
        type: 'open',
        id: item.id,
        title: caducidadTitle(item),
        body: caducidadBody(item, days, aviso),
      });
    } else if (avisosDados(issue).has(aviso)) {
      actions.push({
        type: 'skip',
        id: item.id,
        reason: `#${issue.number} ya avisa a ${aviso} días`,
      });
    } else {
      actions.push({
        type: 'comment',
        id: item.id,
        number: issue.number,
        body: caducidadComment(item, days, aviso),
      });
    }
  }
  const month = today.slice(0, 7);
  for (const item of data.mensuales ?? []) {
    const issue = findIssue(openIssues, item.id);
    if (!issue) {
      actions.push({
        type: 'open',
        id: item.id,
        title: mensualTitle(item, month),
        body: mensualBody(item, month),
      });
    } else if (texts(issue).some((t) => t.includes(mesMarker(month)))) {
      actions.push({ type: 'skip', id: item.id, reason: `#${issue.number} ya es de ${month}` });
    } else {
      actions.push({
        type: 'comment',
        id: item.id,
        number: issue.number,
        body: mensualComment(item, month),
      });
    }
  }
  return actions;
}

/** Comprueba el archivo de datos; devuelve la lista de problemas. */
export function validateData(data) {
  const problems = [];
  const ids = new Set();
  const avisos = data.avisos ?? [];
  if (!avisos.length || !avisos.every((a) => Number.isInteger(a) && a > 0)) {
    problems.push('avisos: tienen que ser días enteros positivos');
  }
  for (const [kind, fields] of [
    ['caducidades', ['id', 'que', 'fecha', 'rompe', 'renovar']],
    ['mensuales', ['id', 'que', 'rompe', 'hacer']],
  ]) {
    for (const item of data[kind] ?? []) {
      for (const f of fields) {
        const v = item[f];
        if (!v || (Array.isArray(v) && v.length === 0))
          problems.push(`${kind}/${item.id}: falta ${f}`);
      }
      if (ids.has(item.id)) problems.push(`${kind}/${item.id}: id repetido`);
      ids.add(item.id);
      if (kind === 'caducidades') {
        try {
          parseDate(item.fecha);
        } catch (e) {
          problems.push(`${kind}/${item.id}: ${e.message}`);
        }
      }
    }
  }
  return problems;
}

/** El resumen legible de un plan. */
export function formatPlan(actions, today) {
  const lines = [`recordatorios para ${today}:`];
  if (actions.length === 0) lines.push('  nada que avisar');
  for (const a of actions) {
    if (a.type === 'open') lines.push(`  abrir issue  [${a.id}] ${a.title}`);
    else if (a.type === 'comment') lines.push(`  comentar #${a.number}  [${a.id}]`);
    else lines.push(`  nada  [${a.id}] ${a.reason}`);
  }
  return lines.join('\n');
}

async function gh(fetchImpl, token, method, path, body) {
  const res = await fetchImpl(`${API}${path}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/** Los issues abiertos del repo con marca de recordatorio, con sus comentarios. */
export async function fetchOpenIssues(fetchImpl, token, repo) {
  const out = [];
  for (let page = 1; ; page++) {
    const batch = await gh(
      fetchImpl,
      token,
      'GET',
      `/repos/${repo}/issues?state=open&per_page=100&page=${page}`,
    );
    for (const i of batch) {
      if (i.pull_request || !(i.body ?? '').includes('<!-- recordatorio:')) continue;
      const comments = i.comments
        ? (
            await gh(
              fetchImpl,
              token,
              'GET',
              `/repos/${repo}/issues/${i.number}/comments?per_page=100`,
            )
          ).map((c) => c.body ?? '')
        : [];
      out.push({ number: i.number, body: i.body, comments });
    }
    if (batch.length < 100) return out;
  }
}

/** Ejecuta un plan contra la API de GitHub. */
export async function applyPlan(actions, fetchImpl, token, repo) {
  const done = [];
  for (const a of actions) {
    if (a.type === 'open') {
      const r = await gh(fetchImpl, token, 'POST', `/repos/${repo}/issues`, {
        title: a.title,
        body: a.body,
      });
      done.push(`abierto #${r.number} [${a.id}]`);
    } else if (a.type === 'comment') {
      await gh(fetchImpl, token, 'POST', `/repos/${repo}/issues/${a.number}/comments`, {
        body: a.body,
      });
      done.push(`comentado #${a.number} [${a.id}]`);
    }
  }
  return done;
}

export async function main(
  argv,
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = new Date(),
) {
  const dryRun = argv.includes('--dry-run');
  const i = argv.indexOf('--fecha');
  const today = i >= 0 ? argv[i + 1] : todayUtc(now);
  try {
    parseDate(today);
  } catch {
    console.error('Uso: recordatorios.mjs [--dry-run] [--fecha AAAA-MM-DD]');
    return 2;
  }
  const data = loadData();
  const problems = validateData(data);
  if (problems.length) {
    console.error(`caducidades.json:\n  - ${problems.join('\n  - ')}`);
    return 1;
  }
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo } = env;
  if (!dryRun && (!token || !repo)) {
    console.error('Faltan GITHUB_TOKEN y GITHUB_REPOSITORY (o usa --dry-run)');
    return 2;
  }
  const open = token && repo ? await fetchOpenIssues(fetchImpl, token, repo) : [];
  const actions = planReminders(data, today, open);
  console.log(formatPlan(actions, today));
  if (dryRun) {
    if (!(token && repo))
      console.log('(--dry-run sin GITHUB_TOKEN: como si no hubiera issues abiertos)');
    console.log('(--dry-run: no se ha cambiado nada)');
    return 0;
  }
  for (const line of await applyPlan(actions, fetchImpl, token, repo)) console.log(line);
  return 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  process.exitCode = await main(process.argv.slice(2));
}
