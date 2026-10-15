import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_REF,
  assertTarget,
  buildSums,
  cleanSchemaSql,
  decodeCopyField,
  encodeCopyField,
  envSource,
  envWith,
  parseCopyHeader,
  parseDump,
  refFromDbUrl,
  storageRel,
  verifySums,
  // @ts-expect-error: herramienta de Node sin tipos
} from '../../../tools/backup/lib.mjs';

/**
 * Herramientas de restauración de copias (plan 032 T302, REQ-ARQ-013): el
 * formato COPY de los volcados, la comprobación de SHA256SUMS y que nunca
 * apunten al proyecto de producción. La prueba con base de datos real se hizo
 * en el proyecto de desarrollo (ESTADO.md).
 */

const ROOT = path.resolve(__dirname, '../../..');
const DEV = 'abcdefghijklmnopqrst';
const dbUrl = (ref: string) =>
  `postgresql://postgres.${ref}:pw@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;

describe('formato COPY', () => {
  it('codifica y decodifica sin perder nada (tabuladores, saltos, barras, nulos)', () => {
    for (const v of ['hola', 'a\tb', 'línea\nnueva\r', 'c:\\ruta\\x', '\\N', '', 'ñandú 🌊']) {
      expect(decodeCopyField(encodeCopyField(v))).toBe(v);
    }
    expect(encodeCopyField(null)).toBe('\\N');
    expect(decodeCopyField('\\N')).toBeNull();
    expect(decodeCopyField('a\\101\\x42')).toBe('aAB');
  });

  it('pg_dump 17.6+: \\restrict / \\unrestrict no se pegan a la sentencia siguiente', () => {
    const dump = [
      '\\restrict AbCdEf123',
      '',
      'SET statement_timeout = 0;',
      'COPY public.t (a) FROM stdin;',
      'uno',
      '\\.',
      'SELECT 2;',
      '\\unrestrict AbCdEf123',
      '',
    ].join('\n');
    expect(parseDump(dump)).toEqual([
      { kind: 'sql', text: 'SET statement_timeout = 0;' },
      { kind: 'copy', table: 'public.t', columns: ['a'], rows: [['uno']] },
      { kind: 'sql', text: 'SELECT 2;' },
    ]);
  });

  it('cleanSchemaSql quita los metacomandos y CREATE SCHEMA public', () => {
    const schema = [
      '\\restrict k',
      'CREATE SCHEMA public;',
      'CREATE SCHEMA private;',
      'CREATE TABLE public.t (id int);',
      '\\unrestrict k',
    ].join('\n');
    expect(cleanSchemaSql(schema)).toBe('CREATE SCHEMA private;\nCREATE TABLE public.t (id int);');
  });

  it('lee la cabecera de COPY', () => {
    expect(parseCopyHeader('COPY public.events (id, "name") FROM stdin;')).toEqual({
      table: 'public.events',
      columns: ['id', 'name'],
    });
    expect(parseCopyHeader('SELECT 1;')).toBeNull();
  });

  it('parte un volcado en sentencias y bloques COPY', () => {
    const dump = [
      '--',
      '-- comentario',
      '',
      "SELECT pg_catalog.setval('public.s', 5, true);",
      'COPY public.t (a, b) FROM stdin;',
      '1\tx\\ty',
      '2\t\\N',
      '\\.',
      '',
      'SELECT 1;',
    ].join('\n');
    expect(parseDump(dump)).toEqual([
      { kind: 'sql', text: "SELECT pg_catalog.setval('public.s', 5, true);" },
      {
        kind: 'copy',
        table: 'public.t',
        columns: ['a', 'b'],
        rows: [
          ['1', 'x\ty'],
          ['2', null],
        ],
      },
      { kind: 'sql', text: 'SELECT 1;' },
    ]);
    expect(() => parseDump('SELECT 1')).toThrow(/sin cerrar/);
  });
});

describe('SHA256SUMS', () => {
  it('buildSums y verifySums: cuadra, y avisa si un archivo cambia', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'boia-sums-'));
    try {
      mkdirSync(path.join(dir, 'storage', 'cubo'), { recursive: true });
      writeFileSync(path.join(dir, 'data.sql'), 'x');
      writeFileSync(path.join(dir, 'storage', 'cubo', 'a.png'), 'png');
      writeFileSync(path.join(dir, 'SHA256SUMS'), buildSums(dir));
      expect(verifySums(dir)).toEqual({ checked: 2, bad: [] });
      writeFileSync(path.join(dir, 'data.sql'), 'y');
      expect(verifySums(dir).bad).toEqual(['data.sql']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('storageRel no sale de la carpeta storage/<cubo>', () => {
    expect(storageRel('b', '../../etc/./passwd')).toBe('storage/b/etc/passwd');
    expect(storageRel('b', 'a/b c.png')).toBe('storage/b/a/b c.png');
  });
});

describe('destino', () => {
  it('saca la referencia de la cadena y rechaza producción', () => {
    expect(refFromDbUrl(dbUrl(DEV))).toBe(DEV);
    expect(assertTarget({ SUPABASE_DB_URL: dbUrl(DEV) })).toBe(DEV);
    expect(() => assertTarget({ SUPABASE_DB_URL: dbUrl(PRODUCTION_REF) })).toThrow(/producción/);
    expect(() =>
      assertTarget({
        SUPABASE_DB_URL: dbUrl(DEV),
        NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co`,
      }),
    ).toThrow(/no coinciden/);
    expect(() => assertTarget({})).toThrow(/SUPABASE_DB_URL/);
  });

  it('una cadena con ?user= o ?host= no esquiva la guarda de producción', () => {
    const base = dbUrl(DEV);
    expect(() =>
      assertTarget({ SUPABASE_DB_URL: `${base}?user=postgres.${PRODUCTION_REF}` }),
    ).toThrow(/parámetro "user"/);
    expect(() =>
      assertTarget({ SUPABASE_DB_URL: `${base}?host=db.${PRODUCTION_REF}.supabase.co` }),
    ).toThrow(/parámetro "host"/);
    expect(() => assertTarget({ SUPABASE_DB_URL: `${base}?sslmode=require` })).not.toThrow();
  });

  it('el archivo --env manda sobre las variables del shell', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'boia-env-'));
    try {
      const file = path.join(dir, '.env');
      writeFileSync(file, `SUPABASE_DB_URL=${dbUrl(DEV)}\n`);
      const env = envWith(file, { SUPABASE_DB_URL: dbUrl(PRODUCTION_REF), OTRA: 'x' });
      expect(env.SUPABASE_DB_URL).toBe(dbUrl(DEV));
      expect(env.OTRA).toBe('x');
      expect(envSource(file)).toContain(file);
      expect(envWith(path.join(dir, 'no-existe'), { A: '1' })).toEqual({ A: '1' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('restore.mjs lee y valida toda la copia antes de conectarse o vaciar nada', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'boia-restore-test-'));
    try {
      const copia = path.join(dir, 'boia-backup-x');
      mkdirSync(copia);
      writeFileSync(path.join(copia, 'storage.json'), '[]');
      writeFileSync(path.join(copia, 'auth.sql'), '');
      // Sentencia sin cerrar: falla al leer, no al conectar.
      writeFileSync(path.join(copia, 'data.sql'), 'SELECT 1');
      writeFileSync(path.join(copia, 'SHA256SUMS'), buildSums(copia));
      const env = path.join(dir, '.env');
      writeFileSync(
        env,
        [
          // Nada escucha ahí: si intentara conectarse, el error sería otro.
          `SUPABASE_DB_URL=postgresql://postgres.${DEV}:pw@127.0.0.1:1/postgres`,
          `NEXT_PUBLIC_SUPABASE_URL=https://${DEV}.supabase.co`,
          'SUPABASE_SERVICE_ROLE_KEY=test',
        ].join('\n'),
      );
      const r = spawnSync(
        process.execPath,
        [
          path.join(ROOT, 'tools/backup/restore.mjs'),
          copia,
          '--env',
          env,
          '--wipe',
          '--confirm-ref',
          DEV,
        ],
        { encoding: 'utf8' },
      );
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/sin cerrar/);
      expect(r.stderr).not.toMatch(/ECONNREFUSED/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('en restore.mjs el vaciado va después de leer la copia y de las comprobaciones', () => {
    const src = readFileSync(path.join(ROOT, 'tools/backup/restore.mjs'), 'utf8');
    const at = (s: string) => src.indexOf(s);
    expect(at('parseDump(readFileSync(join(root, f)')).toBeGreaterThan(0);
    expect(at('parseDump(readFileSync(join(root, f)')).toBeLessThan(
      at('connect(env.SUPABASE_DB_URL)'),
    );
    expect(at('connect(env.SUPABASE_DB_URL)')).toBeLessThan(at('truncate '));
    expect(at('begin')).toBeLessThan(at('truncate '));
    expect(at('truncate ')).toBeLessThan(at('await wipeStorage('));
    expect(at("'commit'")).toBeLessThan(at('await wipeStorage('));
  });

  it('el workflow de copias sigue cifrando y la guía enseña la herramienta', () => {
    const wf = readFileSync(path.join(ROOT, '.github/workflows/supabase-backup.yml'), 'utf8');
    for (const s of ['--symmetric', 'schema.sql', 'data.sql', 'auth.sql', 'AES256']) {
      expect(wf).toContain(s);
    }
    const guide = readFileSync(path.join(ROOT, 'docs/propuestas/2026-10-08-backups.md'), 'utf8');
    expect(guide).toContain('tools/backup/restore.mjs');
    expect(guide).toContain('Probar la restauración');
  });
});
