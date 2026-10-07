import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '@boia/store';
import {
  ADMIN_CARNET_NUMBER,
  DEMO_ADMIN_PASSWORD,
  DEMO_ADMIN_SESSION_KEY,
  DEMO_ADMIN_SESSION_MS,
  type PasswordHash,
  checkDemoAdmin,
  checkPassword,
  derivePasswordHash,
  endDemoSession,
  hasDemoSession,
  parseCarnetNumber,
  startDemoSession,
} from './demo-auth';
import {
  BACKUP_CODE_ALPHABET,
  backupCodesText,
  looksLikeBackupCode,
  normalizeBackupCode,
} from './backup-codes';

/**
 * Entrar al Admin de la demo con el Carnet 000 (plan 017 T193, decisión 9).
 * La contraseña de verdad nunca está en el repositorio: el caso «correcta»
 * contra el hash guardado la lee de ADMIN_DEMO_PASSWORD (sólo en la terminal
 * de quien la sabe) y sin ella se salta; lo demás se prueba con otras.
 */
const REAL = process.env.ADMIN_DEMO_PASSWORD;

function hashOf(password: string, iterations = 1000): PasswordHash {
  const salt = randomBytes(16);
  return {
    algorithm: 'PBKDF2-SHA-256',
    iterations,
    salt: salt.toString('base64'),
    hash: pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64'),
  };
}

describe('el número del Carnet', () => {
  it('000, 0, «Nº 000» y «#000» son el Carnet 0; otra cosa no', () => {
    for (const s of ['000', '0', ' 000 ', 'Nº 000', 'nº000', '#000', 'No 000']) {
      expect(parseCarnetNumber(s), s).toBe(ADMIN_CARNET_NUMBER);
    }
    expect(parseCarnetNumber('007')).toBe(7);
    for (const s of ['', 'admin', '0a', '-1', '1.5', '0000000000']) {
      expect(parseCarnetNumber(s), s).toBeNull();
    }
  });
});

describe('la contraseña contra un hash con sal (PBKDF2-SHA-256)', () => {
  it('Web Crypto da lo mismo que node:crypto', async () => {
    const salt = randomBytes(16);
    const expected = pbkdf2Sync('otra-clave', salt, 2000, 32, 'sha256').toString('base64');
    expect(await derivePasswordHash('otra-clave', salt.toString('base64'), 2000)).toBe(expected);
  });

  it('la correcta entra; una equivocada, vacía o con otra sal, no', async () => {
    const stored = hashOf('clave de prueba');
    expect(await checkPassword('clave de prueba', stored)).toBe(true);
    expect(await checkPassword('clave de prueba ', stored)).toBe(false);
    expect(await checkPassword('Clave de prueba', stored)).toBe(false);
    expect(await checkPassword('', stored)).toBe(false);
    const otherSalt = hashOf('clave de prueba');
    expect(otherSalt.hash).not.toBe(stored.hash);
    expect(await checkPassword('clave de prueba', otherSalt)).toBe(true);
  });

  it('sólo el Carnet 000 entra, aunque la contraseña sea buena', async () => {
    const stored = hashOf('clave de prueba');
    expect(await checkDemoAdmin('000', 'clave de prueba', stored)).toBe(true);
    expect(await checkDemoAdmin('001', 'clave de prueba', stored)).toBe(false);
    expect(await checkDemoAdmin('admin', 'clave de prueba', stored)).toBe(false);
    expect(await checkDemoAdmin('000', 'otra', stored)).toBe(false);
  });

  it('el hash guardado: sal de 16 bytes, 32 bytes derivados y muchas vueltas', () => {
    expect(DEMO_ADMIN_PASSWORD.algorithm).toBe('PBKDF2-SHA-256');
    expect(DEMO_ADMIN_PASSWORD.iterations).toBeGreaterThanOrEqual(100_000);
    expect(Buffer.from(DEMO_ADMIN_PASSWORD.salt, 'base64')).toHaveLength(16);
    expect(Buffer.from(DEMO_ADMIN_PASSWORD.hash, 'base64')).toHaveLength(32);
  });

  it('el hash guardado rechaza una contraseña equivocada', async () => {
    expect(await checkDemoAdmin('000', 'boia')).toBe(false);
    expect(await checkDemoAdmin('000', 'admin')).toBe(false);
  });

  it.skipIf(!REAL)('el hash guardado acepta la contraseña de Hernán (ADMIN_DEMO_PASSWORD)', async () => {
    expect(await checkDemoAdmin('000', REAL!)).toBe(true);
    expect(await checkDemoAdmin('001', REAL!)).toBe(false);
    expect(await checkDemoAdmin('000', `${REAL!}x`)).toBe(false);
  });
});

describe('la sesión del Admin de la demo', () => {
  it('dura 12 horas y se cierra al salir', () => {
    const store = new MemoryStorage();
    const t0 = Date.parse('2026-10-07T10:00:00Z');
    expect(hasDemoSession(store, t0)).toBe(false);
    startDemoSession(store, t0);
    expect(hasDemoSession(store, t0 + 1000)).toBe(true);
    expect(hasDemoSession(store, t0 + DEMO_ADMIN_SESSION_MS)).toBe(false);
    endDemoSession(store);
    expect(hasDemoSession(store, t0 + 1000)).toBe(false);
  });

  it('una marca rota o de otro Carnet no vale', () => {
    const store = new MemoryStorage();
    const now = Date.now();
    store.setItem(DEMO_ADMIN_SESSION_KEY, 'no es json');
    expect(hasDemoSession(store, now)).toBe(false);
    store.setItem(DEMO_ADMIN_SESSION_KEY, JSON.stringify({ carnet: '001', at: now }));
    expect(hasDemoSession(store, now)).toBe(false);
    store.setItem(DEMO_ADMIN_SESSION_KEY, JSON.stringify({ carnet: '000', at: now + 60_000 }));
    expect(hasDemoSession(store, now)).toBe(false);
  });
});

describe('los códigos de respaldo (lo que escribe el Admin)', () => {
  it('se limpian como en el servidor: sin guiones ni espacios y en mayúsculas', () => {
    expect(normalizeBackupCode(' abcde-fghjk ')).toBe('ABCDEFGHJK');
    expect(looksLikeBackupCode('abcde-fghjk')).toBe(true);
    expect(looksLikeBackupCode('ABCDE FGHJ')).toBe(false);
    // I, O, 0 y 1 no están en el alfabeto.
    expect(looksLikeBackupCode('ABCDE-FGHJI')).toBe(false);
    expect(looksLikeBackupCode('ABCDE-FGHJ0')).toBe(false);
    expect(BACKUP_CODE_ALPHABET).toHaveLength(32);
    expect(new Set(BACKUP_CODE_ALPHABET).size).toBe(32);
  });

  it('el alfabeto es el mismo que el de la migración', async () => {
    const { readFileSync } = await import('node:fs');
    const sql = readFileSync(
      new URL(
        '../../../../supabase/migrations/20261007100400_admin_access_export.sql',
        import.meta.url,
      ),
      'utf8',
    );
    expect(sql).toContain(`alphabet constant text := '${BACKUP_CODE_ALPHABET}';`);
  });

  it('el .txt lleva un código por línea', () => {
    const text = backupCodesText(['AAAAA-BBBBB', 'CCCCC-DDDDD'], 'Códigos', new Date('2026-10-07'));
    expect(text.split('\n')).toEqual(['Códigos', '2026-10-07', '', 'AAAAA-BBBBB', 'CCCCC-DDDDD', '']);
  });
});
