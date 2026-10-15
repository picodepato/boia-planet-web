/**
 * Piezas comunes de las herramientas de copia (plan 032 T302, REQ-ARQ-013):
 * `dump.mjs`, `restore.mjs` y `counts.mjs`. Sin dependencias propias: `pg`
 * sale de packages/db. Ninguna imprime una clave ni una contraseña.
 *
 * El formato de la copia es el del flujo `supabase-backup.yml`: `schema.sql`,
 * `data.sql` y `auth.sql` (volcados de `pg_dump`, con los datos en bloques
 * `COPY … FROM stdin`), `storage.json` (la lista de `storage.objects`),
 * `storage/<cubo>/<ruta>` y `SHA256SUMS`, todo en una carpeta
 * `boia-backup-<fecha>` que va en un `.tar.gz` cifrado con GPG.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';

/** El proyecto de producción: estas herramientas nunca se conectan a él. */
export const PRODUCTION_REF = 'kzxdywtysrcnqqjfhhnc';

/** Tablas de cuentas que lleva `auth.sql` (igual que el flujo). */
export const AUTH_TABLES = ['auth.users', 'auth.identities', 'auth.mfa_factors'];

/** Esquemas de la web cuyos datos lleva `data.sql`. */
export const WEB_SCHEMAS = ['public', 'private'];

export function loadPg() {
  const req = createRequire(new URL('../../packages/db/package.json', import.meta.url));
  return req('pg');
}

/** `CLAVE=valor` por línea; ignora comentarios y quita comillas. */
export function parseEnvFile(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

/**
 * Variables del entorno con las de un archivo `.env` por encima: si el
 * archivo existe, GANA a las variables del shell (así no se restaura por
 * error en el proyecto de una variable que se quedó puesta).
 */
export function envWith(file, env = process.env) {
  const fromFile = file && existsSync(file) ? parseEnvFile(readFileSync(file, 'utf8')) : {};
  return { ...Object.fromEntries(Object.entries(env).filter(([, v]) => v)), ...fromFile };
}

/** De dónde salen las variables (para decirlo al usuario). */
export function envSource(file) {
  return file && existsSync(file) ? `el archivo ${file}` : 'las variables del entorno';
}

/** Parámetros de la cadena que cambian a qué servidor o usuario se conecta. */
const FORBIDDEN_URL_PARAMS = ['user', 'host', 'hostaddr', 'service', 'port', 'dbname', 'password'];

/** La referencia del proyecto, del usuario `postgres.<ref>` de la cadena. */
export function refFromDbUrl(dbUrl) {
  try {
    const params = new URL(dbUrl).searchParams;
    for (const k of FORBIDDEN_URL_PARAMS) {
      if (params.has(k)) {
        throw new Error(`la cadena de conexión no puede llevar el parámetro "${k}"`);
      }
    }
    const user = decodeURIComponent(new URL(dbUrl).username);
    if (user.startsWith('postgres.')) return user.slice('postgres.'.length);
    const m = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(new URL(dbUrl).hostname);
    return m ? m[1] : null;
  } catch (e) {
    if (String(e?.message).startsWith('la cadena')) throw e;
    return null;
  }
}

export function refFromProjectUrl(url) {
  try {
    const m = /^([a-z0-9]{20})\.supabase\.(?:co|in)$/.exec(new URL(url).hostname);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Comprueba el destino (o el origen) antes de tocar nada: la cadena de la base
 * y la URL del proyecto tienen que ser del mismo proyecto, y no el de
 * producción. Devuelve la referencia o lanza.
 */
export function assertTarget(env) {
  const dbUrl = env.SUPABASE_DB_URL;
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
  if (!dbUrl) throw new Error('falta SUPABASE_DB_URL (la cadena del Session pooler)');
  const refDb = refFromDbUrl(dbUrl);
  if (!refDb) throw new Error('SUPABASE_DB_URL no es de un proyecto Supabase (postgres.<ref>)');
  if (url) {
    const refUrl = refFromProjectUrl(url);
    if (refUrl && refUrl !== refDb) {
      throw new Error(`SUPABASE_DB_URL (${refDb}) y la URL del proyecto (${refUrl}) no coinciden`);
    }
  }
  if (refDb === PRODUCTION_REF) {
    throw new Error('es el proyecto de producción: estas herramientas no se conectan a él');
  }
  return refDb;
}

export async function connect(dbUrl) {
  const pg = loadPg();
  // El pooler de Supabase usa TLS con su propia CA, que Node no trae.
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query('set client_min_messages = warning');
  return client;
}

// ---------------------------------------------------------------------------
// Formato COPY de texto de Postgres

/** Un valor (o null) al texto de una línea de COPY. */
export function encodeCopyField(value) {
  if (value === null || value === undefined) return '\\N';
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\t/g, '\\t')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

const COPY_ESCAPES = { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' };

/** El texto de un campo de COPY a su valor (`null` si es `\N`). */
export function decodeCopyField(field) {
  if (field === '\\N') return null;
  if (!field.includes('\\')) return field;
  let out = '';
  for (let i = 0; i < field.length; i++) {
    const ch = field[i];
    if (ch !== '\\' || i === field.length - 1) {
      out += ch;
      continue;
    }
    const next = field[++i];
    if (next in COPY_ESCAPES) out += COPY_ESCAPES[next];
    else if (/[0-7]/.test(next)) {
      let oct = next;
      while (oct.length < 3 && /[0-7]/.test(field[i + 1] ?? '')) oct += field[++i];
      out += String.fromCharCode(parseInt(oct, 8));
    } else if (next === 'x' && /[0-9a-fA-F]/.test(field[i + 1] ?? '')) {
      let hex = '';
      while (hex.length < 2 && /[0-9a-fA-F]/.test(field[i + 1] ?? '')) hex += field[++i];
      out += String.fromCharCode(parseInt(hex, 16));
    } else out += next;
  }
  return out;
}

const COPY_RE = /^COPY\s+(.+?)\s*\(([^)]*)\)\s+FROM\s+stdin;?\s*$/i;

/** `COPY public.x (a, b) FROM stdin;` → `{ table, columns }` (o null). */
export function parseCopyHeader(line) {
  const m = COPY_RE.exec(line.trim());
  if (!m) return null;
  return {
    table: m[1],
    columns: m[2].split(',').map((c) => c.trim().replace(/^"|"$/g, '')),
  };
}

/**
 * Parte un volcado de `pg_dump --data-only` (o un `.sql` parecido) en pasos:
 * `{ kind: 'sql', text }` y `{ kind: 'copy', table, columns, rows }` (las filas
 * ya decodificadas). Los comentarios y las líneas en blanco se saltan; cada
 * sentencia acaba en `;` al final de línea.
 */
export function parseDump(text) {
  const steps = [];
  const lines = text.split(/\r?\n/);
  let buf = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // `\restrict <clave>` / `\unrestrict <clave>` (pg_dump 17.6+) y demás
    // metacomandos de psql: no son SQL.
    if (line.startsWith('\\')) continue;
    if (buf.length === 0) {
      if (!line.trim() || line.startsWith('--')) continue;
      const head = parseCopyHeader(line);
      if (head) {
        const rows = [];
        for (i++; i < lines.length && lines[i] !== '\\.'; i++) {
          rows.push(lines[i].split('\t').map(decodeCopyField));
        }
        steps.push({ kind: 'copy', ...head, rows });
        continue;
      }
    }
    buf.push(line);
    if (line.trimEnd().endsWith(';')) {
      steps.push({ kind: 'sql', text: buf.join('\n') });
      buf = [];
    }
  }
  if (buf.length) throw new Error(`sentencia sin cerrar al final del archivo: ${buf[0].slice(0, 60)}`);
  return steps;
}

/**
 * El `schema.sql` de pg_dump listo para enviar entero: sin metacomandos de
 * psql (`\restrict`…) y sin `CREATE SCHEMA public;`, que ya existe en un
 * proyecto Supabase nuevo.
 */
export function cleanSchemaSql(text) {
  return text
    .split(/\r?\n/)
    .filter((l) => !l.startsWith('\\') && !/^CREATE SCHEMA public;\s*$/i.test(l))
    .join('\n');
}

export function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

/** `schema.tabla` → `"schema"."tabla"` (acepta ya entrecomillado). */
export function quoteTable(table) {
  if (table.includes('"')) return table;
  return table
    .split('.')
    .map((p) => quoteIdent(p))
    .join('.');
}

/** Filas de un bloque COPY → INSERTs por lotes (parámetros de texto). */
export async function insertCopyRows(client, step, batch = 500) {
  const cols = step.columns.map(quoteIdent).join(', ');
  const table = quoteTable(step.table);
  let n = 0;
  for (let i = 0; i < step.rows.length; i += batch) {
    const chunk = step.rows.slice(i, i + batch);
    const params = [];
    const tuples = chunk.map((row) => {
      if (row.length !== step.columns.length) {
        throw new Error(`${step.table}: una fila trae ${row.length} campos y se esperaban ${step.columns.length}`);
      }
      return `(${row.map((v) => (params.push(v), `$${params.length}`)).join(', ')})`;
    });
    await client.query(
      `insert into ${table} (${cols}) overriding system value values ${tuples.join(', ')}`,
      params,
    );
    n += chunk.length;
  }
  return n;
}

// ---------------------------------------------------------------------------
// SHA256SUMS

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function walkFiles(root, dir = root) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkFiles(root, p));
    else out.push(relative(root, p).split('\\').join('/'));
  }
  return out.sort();
}

/** El texto de `SHA256SUMS` de una carpeta (sin él mismo), como `sha256sum`. */
export function buildSums(root) {
  return walkFiles(root)
    .filter((f) => f !== 'SHA256SUMS')
    .map((f) => `${sha256File(join(root, f))}  ./${f}`)
    .join('\n')
    .concat('\n');
}

/** Comprueba `SHA256SUMS`: devuelve `{ checked, bad }` (rutas que no cuadran). */
export function verifySums(root) {
  const file = join(root, 'SHA256SUMS');
  if (!existsSync(file)) throw new Error('la copia no trae SHA256SUMS');
  const bad = [];
  let checked = 0;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = /^([0-9a-f]{64}) [ *](.+)$/.exec(line);
    if (!m) {
      bad.push(`línea ilegible: ${line.slice(0, 40)}`);
      continue;
    }
    const rel = m[2].replace(/^\.\//, '');
    const p = join(root, rel);
    checked++;
    if (!existsSync(p) || sha256File(p) !== m[1]) bad.push(rel);
  }
  return { checked, bad };
}

/** Ruta segura dentro de `storage/<cubo>/`: sin `..` ni vacíos. */
export function storageRel(bucket, name) {
  const parts = String(name)
    .split('/')
    .filter((p) => p !== '' && p !== '.' && p !== '..');
  return ['storage', bucket, ...parts].join('/');
}
