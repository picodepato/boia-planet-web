import { describe, expect, it } from 'vitest';
import { migrate, MIGRATIONS, type Migration } from './migrations';
import { SCHEMA_VERSION } from './schema';
import {
  MemoryStorage,
  STORAGE_MESSAGES,
  STORE_BACKUP_KEY,
  STORE_KEY,
  type StorageLike,
} from './storage';
import { makeRepo } from './test-helpers';
import type { RepositoryChange } from './repository';

class BlockedStorage implements StorageLike {
  getItem(): string | null {
    throw new DOMException('denied', 'SecurityError');
  }
  setItem(): void {
    throw new DOMException('denied', 'SecurityError');
  }
  removeItem(): void {
    throw new DOMException('denied', 'SecurityError');
  }
}

/** Deja escribir hasta que se llena. */
class FillingStorage extends MemoryStorage {
  full = false;
  override setItem(key: string, value: string): void {
    if (this.full) throw new DOMException('full', 'QuotaExceededError');
    super.setItem(key, value);
  }
}

describe('almacenamiento bloqueado o borrado', () => {
  it('bloqueado: pasa a memoria, lo dice y todo sigue funcionando', async () => {
    const { repo } = makeRepo({ storage: new BlockedStorage() });
    const s = repo.status();
    expect(s).toMatchObject({ persistence: 'memory', issue: 'blocked' });
    expect(s.message).toBe(STORAGE_MESSAGES.blocked);
    await repo.carnet.create({ nickname: 'Sin disco' });
    await repo.progress.grantWorldReward({ sourceRef: 'boia-1', points: 5 });
    expect((await repo.progress.balances()).points).toBe(5);
    expect((await repo.carnet.mine())?.nickname).toBe('Sin disco');
  });

  it('sin almacenamiento (servidor o navegador sin localStorage): memoria', async () => {
    const { repo } = makeRepo({ storage: null });
    expect(repo.status()).toMatchObject({ persistence: 'memory', issue: 'unavailable' });
    expect((await repo.progress.discover('puerto')).first).toBe(true);
  });

  it('cuota llena a mitad de visita: pasa a memoria, avisa con «storage» y no pierde lo hecho', async () => {
    const storage = new FillingStorage();
    const { repo } = makeRepo({ storage });
    expect(repo.status()).toMatchObject({ persistence: 'local', issue: null, message: null });
    const changes: RepositoryChange[] = [];
    repo.subscribe((c) => changes.push(c));
    await repo.progress.discover('puerto');
    storage.full = true;
    await repo.progress.discover('cala');
    expect(repo.status()).toMatchObject({ persistence: 'memory', issue: 'quota' });
    expect(changes.at(-1)?.areas).toContain('storage');
    expect((await repo.progress.discoveries()).map((d) => d.key).sort()).toEqual([
      'cala',
      'puerto',
    ]);
  });

  it('subscribe, revision y status se pueden pasar sueltas (useSyncExternalStore)', async () => {
    const { repo } = makeRepo();
    const { subscribe, revision, status } = repo;
    let calls = 0;
    const off = subscribe(() => calls++);
    const r0 = revision();
    await repo.progress.discover('puerto');
    await repo.progress.discover('puerto'); // repetido: no cambia nada
    expect([calls, revision() - r0]).toEqual([1, 1]);
    off();
    await repo.progress.discover('cala');
    expect(calls).toBe(1);
    expect(status().persistence).toBe('local');
  });

  it('datos ilegibles: guarda una copia, empieza de cero y lo dice', async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORE_KEY, '{esto no es json');
    const { repo } = makeRepo({ storage });
    expect(repo.status()).toMatchObject({ persistence: 'local', issue: 'corrupt' });
    expect(storage.getItem(STORE_BACKUP_KEY)).toBe('{esto no es json');
    expect(await repo.identity.current()).toBeNull();
  });

  it('borrados desde fuera (otra pestaña o el navegador): lo siguiente se vuelve a guardar', async () => {
    const { repo, storage, reload } = makeRepo();
    await repo.progress.discover('puerto');
    storage.removeItem(STORE_KEY);
    await repo.progress.discover('cala');
    const later = reload();
    expect((await later.progress.discoveries()).map((d) => d.key).sort()).toEqual([
      'cala',
      'puerto',
    ]);
  });
});

describe('versión de esquema y migraciones', () => {
  it('la cadena real llega a la versión actual sin huecos', () => {
    for (let v = 0; v < SCHEMA_VERSION; v++) {
      const steps = MIGRATIONS.filter((m) => m.from === v);
      // La versión 1 es la primera publicada: no hay nada anterior que migrar.
      if (v === 0) continue;
      expect(steps).toHaveLength(1);
    }
    expect(migrate({ schemaVersion: SCHEMA_VERSION }).status).toBe('ok');
  });

  it('REQ-ARQ-005: base vacía y base con datos llegan a la versión actual sin perder nada', async () => {
    // Base vacía: arranca en la versión actual, sin problemas y sin datos.
    const empty = makeRepo({ storage: new MemoryStorage() });
    expect(empty.repo.status()).toMatchObject({ issue: null, schemaVersion: SCHEMA_VERSION });
    expect(await empty.repo.progress.discoveries()).toEqual([]);

    // Base con datos de la primera versión publicada: la cadena la lleva hasta hoy.
    const v1 = migrate({ schemaVersion: 1, players: {}, ledger: [] });
    expect(v1).toMatchObject({ status: 'ok', from: 1 });
    if (v1.status === 'ok') expect(v1.applied).toHaveLength(SCHEMA_VERSION - 1);
  });

  /** Una subida de versión de ejemplo: v2 mueve las botellas del mundo retirado. */
  const v1to2: Migration = {
    from: SCHEMA_VERSION,
    to: SCHEMA_VERSION + 1,
    name: 'botellas de «muestra» a «arcilla»',
    up: (doc) => ({
      ...doc,
      bottles: ((doc.bottles as Array<Record<string, unknown>>) ?? []).map((b) =>
        b.seasonId === 'muestra' ? { ...b, seasonId: 'arcilla' } : b,
      ),
    }),
  };

  it('subir la versión migra los datos viejos, los guarda y no pierde progreso', async () => {
    const storage = new MemoryStorage();
    const old = makeRepo({ storage });
    await old.repo.admin.setActiveWorld('muestra');
    await old.repo.carnet.create({ nickname: 'De antes' });
    await old.repo.bottles.place({ message: 'vieja', x: 1, y: 2 });
    await old.repo.progress.grantWorldReward({ sourceRef: 'boia-1', coins: 3 });
    expect(JSON.parse(storage.getItem(STORE_KEY) ?? '{}').schemaVersion).toBe(SCHEMA_VERSION);

    const next = old.reload({
      schemaVersion: SCHEMA_VERSION + 1,
      migrations: [...MIGRATIONS, v1to2],
    });
    expect(next.status()).toMatchObject({ issue: null, schemaVersion: SCHEMA_VERSION + 1 });
    const saved = JSON.parse(storage.getItem(STORE_KEY) ?? '{}');
    expect(saved.schemaVersion).toBe(SCHEMA_VERSION + 1);
    expect(saved.bottles[0].seasonId).toBe('arcilla');
    expect((await next.bottles.mine())?.message).toBe('vieja');
    expect((await next.carnet.mine())?.nickname).toBe('De antes');
    expect((await next.progress.balances()).coins).toBe(3);
  });

  it('si falta un paso: copia de seguridad y de cero, sin inventar datos', async () => {
    const storage = new MemoryStorage();
    const old = makeRepo({ storage });
    await old.repo.progress.discover('puerto');
    const raw = storage.getItem(STORE_KEY);
    const next = old.reload({
      schemaVersion: SCHEMA_VERSION + 2,
      migrations: [...MIGRATIONS, v1to2],
    });
    expect(next.status()).toMatchObject({ persistence: 'local', issue: 'migration_failed' });
    expect(storage.getItem(STORE_BACKUP_KEY)).toBe(raw);
    expect(await next.progress.discoveries()).toEqual([]);
  });

  it('datos de una versión más nueva: no se tocan y la visita va en memoria', async () => {
    const storage = new MemoryStorage();
    const future = JSON.stringify({ schemaVersion: SCHEMA_VERSION + 5, algo: 'nuevo' });
    storage.setItem(STORE_KEY, future);
    const { repo } = makeRepo({ storage });
    expect(repo.status()).toMatchObject({ persistence: 'memory', issue: 'newer_schema' });
    await repo.progress.discover('puerto');
    expect(storage.getItem(STORE_KEY)).toBe(future);
  });

  it('migrate() es puro y dice qué aplicó', () => {
    const r = migrate(
      { schemaVersion: SCHEMA_VERSION, bottles: [{ seasonId: 'muestra' }] },
      SCHEMA_VERSION + 1,
      [v1to2],
    );
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.applied).toEqual([v1to2.name]);
      expect(r.doc).toMatchObject({
        schemaVersion: SCHEMA_VERSION + 1,
        bottles: [{ seasonId: 'arcilla' }],
      });
    }
    expect(migrate({ nada: true }).status).toBe('invalid');
  });
});
