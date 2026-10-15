#!/usr/bin/env node
/**
 * Restaura una copia de `supabase-backup.yml` en un proyecto Supabase
 * (plan 032 T302, REQ-ARQ-013). Guía paso a paso:
 * `docs/propuestas/2026-10-08-backups.md`, sección «Restaurar».
 *
 * Uso:
 *   node tools/backup/restore.mjs <copia> --env <.env del destino> [opciones]
 *
 * `<copia>` es el `boia-backup-….tar.gz.gpg` (pide la frase en
 * `BACKUP_PASSPHRASE`, o la pregunta GPG) o la carpeta ya abierta. Hace, en
 * este orden y parando al primer fallo:
 *   1. descifra y desempaqueta (en una carpeta temporal);
 *   2. comprueba `SHA256SUMS`;
 *   3. en UNA transacción, con `session_replication_role = replica` (no
 *      saltan los disparadores): `schema.sql` (si la copia lo trae; con
 *      `--skip-schema` no, p. ej. si el esquema ya salió de las migraciones),
 *      `auth.sql` y `data.sql`. No necesita `psql`: los bloques `COPY` se
 *      cargan con INSERT;
 *   4. sube `storage/<cubo>/<ruta>` por la API de Storage (hace falta
 *      `SUPABASE_SERVICE_ROLE_KEY` y que los cubos existan: los crean las
 *      migraciones);
 *   5. cuenta lo que quedó (filas por tabla, archivos de Storage, tres
 *      archivos con su SHA-256) y lo compara con la copia. Sale con 1 si algo
 *      no cuadra.
 *
 * El destino ha de ser un proyecto nuevo: sin cuentas ni archivos de Storage.
 * Con el esquema ya puesto por las migraciones (`--skip-schema`), las filas
 * de ajustes que dejan las migraciones se sustituyen por las de la copia.
 * Todo se comprueba (y se lee la copia) antes de tocar el destino. `--wipe
 * --confirm-ref <ref>` también vacía cuentas y Storage; sólo para el proyecto
 * de desarrollo. Nunca se conecta al proyecto de producción
 * (`kzxdywtysrcnqqjfhhnc`). No imprime claves ni contraseñas. Si hay un
 * archivo `--env`, sus variables mandan sobre las del shell.
 *
 * Opciones: --env <archivo>  --skip-schema  --skip-storage  --wipe
 *           --confirm-ref <ref>  --keep (no borra la carpeta temporal)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WEB_SCHEMAS,
  assertTarget,
  cleanSchemaSql,
  connect,
  envSource,
  envWith,
  insertCopyRows,
  parseDump,
  quoteTable,
  sha256File,
  storageRel,
  verifySums,
} from './lib.mjs';

const DEFAULT_ENV = resolve(dirname(fileURLToPath(import.meta.url)), '../../apps/web/.env.local');

/** Descifra y desempaqueta; devuelve la carpeta de la copia. */
function open(input, work) {
  if (!input.endsWith('.gpg')) return resolve(input);
  const src = resolve(input);
  const pass = process.env.BACKUP_PASSPHRASE;
  const args = ['--batch', '--yes', '--output', 'copia.tar.gz', '--decrypt', src];
  // Con la frase en el entorno va por stdin; sin ella, GPG la pregunta.
  if (pass) args.unshift('--pinentry-mode', 'loopback', '--passphrase-fd', '0');
  else args.shift();
  const g = spawnSync('gpg', args, { cwd: work, input: pass, stdio: [pass ? 'pipe' : 'inherit', 'inherit', 'inherit'] });
  if (g.status !== 0) throw new Error('GPG no pudo descifrar la copia (¿frase equivocada?)');
  const t = spawnSync('tar', ['-xzf', 'copia.tar.gz'], { cwd: work, stdio: 'inherit' });
  if (t.status !== 0) throw new Error('tar no pudo abrir la copia');
  rmSync(join(work, 'copia.tar.gz'));
  const dir = readdirSync(work).find((n) => n.startsWith('boia-backup-'));
  if (!dir) throw new Error('la copia no trae la carpeta boia-backup-…');
  return join(work, dir);
}

async function webTables(client) {
  const { rows } = await client.query(
    `select table_schema || '.' || table_name as t from information_schema.tables
     where table_type = 'BASE TABLE' and table_schema = any($1) order by 1`,
    [WEB_SCHEMAS],
  );
  return rows.map((r) => r.t);
}

async function countRows(client, table) {
  const { rows } = await client.query(`select count(*)::int as n from ${quoteTable(table)}`);
  return rows[0].n;
}

class StorageApi {
  constructor(env) {
    this.base = (env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? '').replace(/\/+$/, '');
    this.key = env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    if (!this.base || !this.key) {
      throw new Error('Storage pide NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o --skip-storage)');
    }
  }
  headers(extra = {}) {
    return { Authorization: `Bearer ${this.key}`, apikey: this.key, ...extra };
  }
  async buckets() {
    const r = await fetch(`${this.base}/storage/v1/bucket`, { headers: this.headers() });
    if (!r.ok) throw new Error(`Storage: no se pudo listar los cubos (${r.status})`);
    return (await r.json()).map((b) => b.id);
  }
  async upload(bucket, name, body, type) {
    const url = `${this.base}/storage/v1/object/${encodeURIComponent(bucket)}/${name.split('/').map(encodeURIComponent).join('/')}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: this.headers({ 'content-type': type || 'application/octet-stream', 'x-upsert': 'true' }),
      body,
    });
    if (!r.ok) throw new Error(`Storage: no se pudo subir ${bucket}/${name} (${r.status}) ${(await r.text()).slice(0, 120)}`);
  }
  async remove(bucket, names) {
    for (let i = 0; i < names.length; i += 100) {
      const r = await fetch(`${this.base}/storage/v1/object/${encodeURIComponent(bucket)}`, {
        method: 'DELETE',
        headers: this.headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ prefixes: names.slice(i, i + 100) }),
      });
      if (!r.ok) throw new Error(`Storage: no se pudo borrar en ${bucket} (${r.status})`);
    }
  }
  async publicSha(bucket, name) {
    const url = `${this.base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${name.split('/').map(encodeURIComponent).join('/')}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Storage: no se pudo leer ${bucket}/${name} (${r.status})`);
    const { createHash } = await import('node:crypto');
    return createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex');
  }
}

/** Borra los archivos de Storage del destino por la API (no se puede por SQL). */
async function wipeStorage(client, storage) {
  const { rows } = await client.query('select bucket_id as b, name as n from storage.objects');
  const by = new Map();
  for (const r of rows) by.set(r.b, [...(by.get(r.b) ?? []), r.n]);
  for (const [b, names] of by) await storage.remove(b, names);
}

async function main(argv) {
  const flag = (n) => argv.includes(n);
  const val = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : undefined);
  const input = argv.find(
    (a, i) => !a.startsWith('--') && !['--env', '--confirm-ref'].includes(argv[i - 1]),
  );
  if (!input) {
    console.error(
      'Uso: node tools/backup/restore.mjs <copia.tar.gz.gpg | carpeta> --env <.env> [--skip-schema] [--skip-storage] [--wipe --confirm-ref <ref>]',
    );
    return 2;
  }
  const envFile = val('--env') ?? DEFAULT_ENV;
  const env = envWith(envFile);
  const ref = assertTarget(env);
  console.log(`destino: proyecto ${ref} (datos de conexión de ${envSource(envFile)})`);
  const wipe = flag('--wipe');
  if (wipe && val('--confirm-ref') !== ref) {
    throw new Error(`--wipe pide --confirm-ref ${ref} (vacía el proyecto)`);
  }

  const work = mkdtempSync(join(tmpdir(), 'boia-restore-'));
  try {
    // 1. Todo lo que se puede comprobar sin tocar el destino.
    const root = open(input, work);
    const sums = verifySums(root);
    if (sums.bad.length) throw new Error(`SHA256SUMS no cuadra en: ${sums.bad.join(', ')}`);
    console.log(`SHA256SUMS: ${sums.checked} archivos, todos OK`);

    const storageList = JSON.parse(readFileSync(join(root, 'storage.json'), 'utf8') || '[]');
    const useStorage = !flag('--skip-storage');
    const storage = useStorage || wipe ? new StorageApi(env) : undefined;
    const schemaFile = join(root, 'schema.sql');
    const withSchema = existsSync(schemaFile) && !flag('--skip-schema');
    const schemaSql = withSchema ? cleanSchemaSql(readFileSync(schemaFile, 'utf8')) : '';
    const steps = [];
    for (const f of ['auth.sql', 'data.sql']) {
      steps.push([f, parseDump(readFileSync(join(root, f), 'utf8'))]);
    }
    for (const o of storageList) {
      if (!existsSync(join(root, ...storageRel(o.bucket, o.name).split('/')))) {
        throw new Error(`falta en la copia el archivo de Storage ${o.bucket}/${o.name}`);
      }
    }

    // 2. El destino: qué hay y si se puede restaurar encima.
    const client = await connect(env.SUPABASE_DB_URL);
    try {
      const existing = await webTables(client);
      const accounts = await countRows(client, 'auth.users');
      const objects = (await client.query('select count(*)::int as n from storage.objects')).rows[0].n;
      if (withSchema && existing.length) {
        throw new Error(
          `el destino ya tiene tablas (${existing.length}): usa un proyecto nuevo y vacío, o --skip-schema`,
        );
      }
      if (!withSchema && existing.length === 0) {
        throw new Error(
          'el destino no tiene esquema: aplica antes las migraciones (guía, camino A) o usa una copia con schema.sql',
        );
      }
      // Las migraciones dejan filas de ajustes (site_settings…): con el
      // esquema ya puesto y SIN cuentas, esas filas se sustituyen por las de la
      // copia. Con cuentas o archivos de Storage hay datos de verdad: --wipe.
      if (!wipe && accounts) {
        throw new Error(
          `el destino ya tiene ${accounts} cuentas: no se restaura encima; usa un proyecto nuevo, o --wipe --confirm-ref ${ref} en desarrollo`,
        );
      }
      if (!wipe && objects) {
        throw new Error(
          `el destino ya tiene ${objects} archivos de Storage: usa un proyecto nuevo, o --wipe en desarrollo`,
        );
      }
      if (useStorage && storageList.length) {
        const have = await storage.buckets();
        const missing = [...new Set(storageList.map((o) => o.bucket))].filter(
          (x) => !have.includes(x),
        );
        if (missing.length) {
          throw new Error(
            `faltan los cubos de Storage: ${missing.join(', ')} (los crean las migraciones)`,
          );
        }
      }

      // 3. Una transacción: vaciar, esquema, cuentas y datos.
      const expected = {};
      await client.query('begin');
      try {
        await client.query("set local session_replication_role = 'replica'");
        if (existing.length) {
          await client.query(
            `truncate ${existing.map(quoteTable).join(', ')} restart identity cascade`,
          );
        }
        if (wipe) await client.query('truncate auth.users cascade');
        if (withSchema) {
          // El esquema de pg_dump lleva funciones con $$ y varias líneas: va entero.
          await client.query(schemaSql);
          console.log('schema.sql: cargado');
        }
        for (const [file, parsed] of steps) {
          for (const st of parsed) {
            if (st.kind === 'sql') await client.query(st.text);
            else {
              const n = await insertCopyRows(client, st);
              const key = st.table.includes('.') ? st.table : `public.${st.table}`;
              expected[key] = (expected[key] ?? 0) + n;
            }
          }
          console.log(`${file}: cargado`);
        }
        await client.query('commit');
      } catch (e) {
        await client.query('rollback').catch(() => {});
        throw new Error(`la carga falló y no quedó nada a medias: ${e.message}`);
      }

      // 4. Storage (con --wipe, primero se borra lo que hubiera).
      if (wipe) await wipeStorage(client, storage);
      if (useStorage && storageList.length) {
        for (const o of storageList) {
          const file = join(root, ...storageRel(o.bucket, o.name).split('/'));
          await storage.upload(o.bucket, o.name, readFileSync(file), o.type);
        }
        console.log(`Storage: ${storageList.length} archivos subidos`);
      }

      // Comprobación
      let bad = 0;
      let rowsTotal = 0;
      for (const [t, n] of Object.entries(expected)) {
        const got = await countRows(client, t);
        rowsTotal += got;
        if (got !== n) {
          bad++;
          console.log(`  MAL ${t}: copia ${n}, destino ${got}`);
        }
      }
      console.log(`filas: ${rowsTotal} en ${Object.keys(expected).length} tablas${bad ? `, ${bad} NO cuadran` : ', todas cuadran'}`);
      if (useStorage) {
        const { rows } = await client.query('select count(*)::int as n from storage.objects');
        const ok = rows[0].n === storageList.length;
        console.log(`Storage: ${rows[0].n} objetos (copia: ${storageList.length}) ${ok ? 'OK' : 'NO cuadra'}`);
        if (!ok) bad++;
        for (const o of storageList.slice(0, 3)) {
          const want = sha256File(join(root, ...storageRel(o.bucket, o.name).split('/')));
          const got = await storage.publicSha(o.bucket, o.name);
          console.log(`  ${o.bucket}/${o.name}: ${got === want ? 'SHA-256 igual' : 'DISTINTO'}`);
          if (got !== want) bad++;
        }
      }
      await client.query("notify pgrst, 'reload schema'");
      console.log(bad ? 'restore: HAY DIFERENCIAS' : 'restore: todo bien');
      return bad ? 1 : 0;
    } finally {
      await client.end();
    }
  } finally {
    if (!flag('--keep')) rmSync(work, { recursive: true, force: true });
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (e) => {
    console.error(`restore FALLA: ${e?.message ?? e}`);
    process.exitCode = 1;
  },
);
