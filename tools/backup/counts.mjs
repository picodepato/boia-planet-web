#!/usr/bin/env node
/**
 * Cuenta lo que hay en un proyecto Supabase (plan 032 T302): filas por tabla
 * de public/private, las tres tablas de cuentas, y los archivos de Storage
 * con su tamaño y su SHA-256 (se bajan de la URL pública). Escribe JSON en la
 * salida estándar, para comparar el antes y el después de una restauración:
 *   node tools/backup/counts.mjs --env <.env> > antes.json
 *   node tools/backup/counts.mjs --env <.env> > despues.json
 *   node tools/backup/counts.mjs --diff antes.json despues.json
 * Sólo lee. Nunca se conecta al proyecto de producción.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTH_TABLES, WEB_SCHEMAS, assertTarget, connect, envWith, quoteTable } from './lib.mjs';

const DEFAULT_ENV = resolve(dirname(fileURLToPath(import.meta.url)), '../../apps/web/.env.local');

export async function collect(env) {
  const ref = assertTarget(env);
  const client = await connect(env.SUPABASE_DB_URL);
  try {
    const { rows } = await client.query(
      `select table_schema || '.' || table_name as t from information_schema.tables
       where table_type = 'BASE TABLE' and table_schema = any($1) order by 1`,
      [WEB_SCHEMAS],
    );
    const tables = {};
    for (const t of [...rows.map((r) => r.t), ...AUTH_TABLES]) {
      tables[t] = (await client.query(`select count(*)::int as n from ${quoteTable(t)}`)).rows[0].n;
    }
    const objs = (
      await client.query(
        `select bucket_id as bucket, name, metadata->>'size' as size from storage.objects order by 1, 2`,
      )
    ).rows;
    const base = (env.NEXT_PUBLIC_SUPABASE_URL ?? `https://${ref}.supabase.co`).replace(/\/+$/, '');
    const storage = {};
    for (const o of objs) {
      const url = `${base}/storage/v1/object/public/${encodeURIComponent(o.bucket)}/${o.name.split('/').map(encodeURIComponent).join('/')}`;
      const res = await fetch(url);
      storage[`${o.bucket}/${o.name}`] = {
        size: Number(o.size ?? 0),
        sha256: res.ok ? createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex') : `HTTP ${res.status}`,
      };
    }
    return { ref, tables, storage };
  } finally {
    await client.end();
  }
}

/** Diferencias entre dos resultados de `collect` (vacío = iguales). */
export function diff(a, b) {
  const out = [];
  for (const t of new Set([...Object.keys(a.tables), ...Object.keys(b.tables)])) {
    if (a.tables[t] !== b.tables[t]) out.push(`${t}: ${a.tables[t]} → ${b.tables[t]}`);
  }
  for (const f of new Set([...Object.keys(a.storage), ...Object.keys(b.storage)])) {
    const x = a.storage[f];
    const y = b.storage[f];
    if (!x || !y || x.sha256 !== y.sha256 || x.size !== y.size) out.push(`storage ${f}: ${x?.sha256 ?? 'falta'} → ${y?.sha256 ?? 'falta'}`);
  }
  return out;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argv = process.argv.slice(2);
  try {
    if (argv[0] === '--diff') {
      const [a, b] = argv.slice(1).map((f) => JSON.parse(readFileSync(f, 'utf8')));
      const d = diff(a, b);
      const rows = Object.values(a.tables).reduce((x, y) => x + y, 0);
      console.log(d.length ? `DIFERENCIAS:\n${d.join('\n')}` : `iguales: ${Object.keys(a.tables).length} tablas, ${rows} filas, ${Object.keys(a.storage).length} archivos de Storage`);
      process.exitCode = d.length ? 1 : 0;
    } else {
      const i = argv.indexOf('--env');
      const env = envWith(i >= 0 ? argv[i + 1] : DEFAULT_ENV);
      console.log(JSON.stringify(await collect(env), null, 2));
    }
  } catch (e) {
    console.error(`counts FALLA: ${e?.message ?? e}`);
    process.exitCode = 1;
  }
}
