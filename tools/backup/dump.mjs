#!/usr/bin/env node
/**
 * Hace una copia con el mismo formato que `supabase-backup.yml`, pero con
 * Node y `pg` (plan 032 T302): sin `pg_dump` ni `psql`. Es para probar la
 * restauración en el proyecto de desarrollo (y para sacar una copia a mano
 * donde no hay cliente de Postgres). Lleva `data.sql` y `auth.sql` (bloques
 * `COPY … FROM stdin` como los de `pg_dump --data-only`), `storage.json`,
 * `storage/<cubo>/<ruta>` y `SHA256SUMS`. No lleva `schema.sql`: el esquema
 * del destino sale de las migraciones (`pnpm db:migrate:dev`).
 *
 * Uso:
 *   node tools/backup/dump.mjs --out <carpeta> [--env <.env>] [--encrypt]
 * Crea `<carpeta>/boia-backup-<fecha>/` (y, con `--encrypt`, el
 * `.tar.gz.gpg` con `BACKUP_PASSPHRASE` del entorno, y borra la carpeta).
 * Nunca se conecta al proyecto de producción. Escribe `<carpeta>` FUERA del
 * repositorio: la copia lleva emails.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTH_TABLES,
  WEB_SCHEMAS,
  assertTarget,
  buildSums,
  connect,
  encodeCopyField,
  envWith,
  quoteTable,
  storageRel,
} from './lib.mjs';

const DEFAULT_ENV = resolve(dirname(fileURLToPath(import.meta.url)), '../../apps/web/.env.local');

/** Tablas base (no vistas) de los esquemas de la web. */
export async function listWebTables(client) {
  const { rows } = await client.query(
    `select table_schema as s, table_name as n from information_schema.tables
     where table_type = 'BASE TABLE' and table_schema = any($1) order by 1, 2`,
    [WEB_SCHEMAS],
  );
  return rows.map((r) => `${r.s}.${r.n}`);
}

async function copyBlock(client, table) {
  const [schema, name] = table.split('.');
  const { rows: cols } = await client.query(
    `select column_name as c from information_schema.columns
     where table_schema = $1 and table_name = $2 and is_generated = 'NEVER'
     order by ordinal_position`,
    [schema, name],
  );
  const names = cols.map((c) => c.c);
  const select = names.map((c) => `"${c}"::text`).join(', ');
  const { rows } = await client.query({
    text: `select ${select} from ${quoteTable(table)}`,
    rowMode: 'array',
  });
  const head = `COPY ${table} (${names.map((c) => `"${c}"`).join(', ')}) FROM stdin;`;
  const body = rows.map((r) => r.map(encodeCopyField).join('\t'));
  return { text: [head, ...body, '\\.', ''].join('\n'), rows: rows.length };
}

async function sequences(client) {
  const { rows } = await client.query(
    `select schemaname as s, sequencename as n, last_value as v from pg_sequences
     where schemaname = any($1) and last_value is not null order by 1, 2`,
    [WEB_SCHEMAS],
  );
  return rows.map((r) => `SELECT pg_catalog.setval('${r.s}.${r.n}', ${r.v}, true);`);
}

async function main(argv) {
  const arg = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const outDir = arg('--out');
  if (!outDir) {
    console.error('Uso: node tools/backup/dump.mjs --out <carpeta> [--env <.env>] [--encrypt]');
    return 2;
  }
  const env = envWith(arg('--env') ?? DEFAULT_ENV);
  const ref = assertTarget(env);
  const stamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z').replace(/[:-]/g, '');
  const name = `boia-backup-${stamp}`;
  const root = resolve(outDir, name);
  mkdirSync(join(root, 'storage'), { recursive: true });

  const client = await connect(env.SUPABASE_DB_URL);
  try {
    await client.query('begin isolation level repeatable read read only');
    const counts = {};
    let data = '-- boia dump.mjs: datos de public y private (formato pg_dump --data-only)\n\n';
    for (const t of await listWebTables(client)) {
      const b = await copyBlock(client, t);
      counts[t] = b.rows;
      if (b.rows) data += `${b.text}\n`;
    }
    data += `${(await sequences(client)).join('\n')}\n`;
    writeFileSync(join(root, 'data.sql'), data);

    let auth = '-- boia dump.mjs: cuentas (auth.users, identities, mfa_factors)\n\n';
    for (const t of AUTH_TABLES) {
      const b = await copyBlock(client, t);
      counts[t] = b.rows;
      if (b.rows) auth += `${b.text}\n`;
    }
    writeFileSync(join(root, 'auth.sql'), auth);

    const { rows } = await client.query(
      `select coalesce(json_agg(json_build_object('bucket', o.bucket_id, 'name', o.name,
         'public', b.public, 'size', o.metadata->>'size', 'type', o.metadata->>'mimetype')
         order by o.bucket_id, o.name), '[]') as j
       from storage.objects o join storage.buckets b on b.id = o.bucket_id`,
    );
    const objects = rows[0].j;
    writeFileSync(join(root, 'storage.json'), JSON.stringify(objects));
    await client.query('commit');

    const base = (env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? `https://${ref}.supabase.co`).replace(/\/+$/, '');
    for (const o of objects) {
      if (!o.public) throw new Error(`cubo privado sin copia: ${o.bucket}`);
      const url = `${base}/storage/v1/object/public/${encodeURIComponent(o.bucket)}/${o.name.split('/').map(encodeURIComponent).join('/')}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`no se pudo bajar ${o.bucket}/${o.name}: ${res.status}`);
      const dest = join(root, ...storageRel(o.bucket, o.name).split('/'));
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    }
    writeFileSync(join(root, 'SHA256SUMS'), buildSums(root));
    console.log(`copia de ${ref}: ${root}`);
    console.log(`  tablas con datos: ${Object.values(counts).filter(Boolean).length}, filas: ${Object.values(counts).reduce((a, b) => a + b, 0)}, archivos de Storage: ${objects.length}`);
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    await client.end();
  }

  if (argv.includes('--encrypt')) {
    const pass = process.env.BACKUP_PASSPHRASE;
    if (!pass) throw new Error('--encrypt pide BACKUP_PASSPHRASE en el entorno');
    const tar = spawnSync('tar', ['-czf', `${name}.tar.gz`, name], { cwd: resolve(outDir), stdio: 'inherit' });
    if (tar.status !== 0) throw new Error('falla tar');
    const gpg = spawnSync(
      'gpg',
      ['--batch', '--yes', '--pinentry-mode', 'loopback', '--passphrase-fd', '0', '--symmetric',
        '--cipher-algo', 'AES256', '--output', `${name}.tar.gz.gpg`, `${name}.tar.gz`],
      { cwd: resolve(outDir), input: pass, stdio: ['pipe', 'inherit', 'inherit'] },
    );
    if (gpg.status !== 0) throw new Error('falla gpg');
    rmSync(`${resolve(outDir)}/${name}.tar.gz`);
    rmSync(root, { recursive: true, force: true });
    console.log(`cifrada: ${resolve(outDir, `${name}.tar.gz.gpg`)}`);
  }
  return 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      console.error(`dump FALLA: ${e?.message ?? e}`);
      process.exitCode = 1;
    },
  );
}
