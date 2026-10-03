import { describe, expect, it } from 'vitest';
import { BOTTLES_IN_SEA_MAX } from '@boia/contracts';
import { isStoreError } from '../errors';
import { createLocalRepository } from '../local';
import type { RepositoryChange } from '../repository';
import { MemoryStorage } from '../storage';
import { createGlobalBottles, type GlobalBottles } from './bottles';
import type { SupabaseLike, SupabaseQueryLike, SupabaseResult } from './server';
import { createSwitchableRepository } from './switchable';

/**
 * Las botellas globales (T93, decisión 12) contra un Supabase de mentira con
 * las reglas de T86: `latest_bottles` (las 10 activas más recientes, de
 * cuentas con Carnet), `place_bottle` (una activa por cuenta, filtro de
 * texto), y las tablas `bottles`, `bottle_reads` y `bottle_reports`.
 */

type Row = Record<string, unknown>;

interface FakeBottle {
  id: string;
  user_id: string;
  message: string;
  x: number;
  y: number;
  status: 'active' | 'retired' | 'removed';
  created_at: string;
  updated_at: string;
}

class Query implements SupabaseQueryLike<Row[]> {
  filters: Array<[string, unknown]> = [];
  constructor(private readonly exec: (q: Query) => SupabaseResult<Row[]>) {}
  eq(c: string, v: unknown) {
    this.filters.push([c, v]);
    return this;
  }
  order() {
    return this;
  }
  range() {
    return this;
  }
  select() {
    return this;
  }
  match(row: Row) {
    return this.filters.every(([c, v]) => row[c] === v);
  }
  then<A = SupabaseResult<Row[]>, B = never>(
    ok?: ((v: SupabaseResult<Row[]>) => A | PromiseLike<A>) | null,
    ko?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.exec(this))
      .then(ok, ko);
  }
}

class FakeSea implements SupabaseLike {
  /** La cuenta de la sesión (null: anon). */
  session: string | null = null;
  nicknames = new Map<string, string>();
  bottles: FakeBottle[] = [];
  reads: Array<{ bottle_id: string; reader_id: string }> = [];
  reports: Array<{ bottle_id: string; reporter_id: string; reason: string | null }> = [];
  calls: string[] = [];
  private clock = Date.parse('2026-10-03T10:00:00Z');
  private seq = 0;

  tick(): string {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }

  seed(user: string, message: string): FakeBottle {
    const at = this.tick();
    const b: FakeBottle = {
      id: `b${++this.seq}`,
      user_id: user,
      message,
      x: 10,
      y: 20,
      status: 'active',
      created_at: at,
      updated_at: at,
    };
    for (const old of this.bottles) {
      if (old.user_id === user && old.status === 'active') old.status = 'retired';
    }
    this.bottles.push(b);
    return b;
  }

  rpc(fn: string, args: Record<string, unknown> = {}) {
    this.calls.push(fn);
    const res = (data: unknown, error: SupabaseResult['error'] = null) =>
      Promise.resolve({ data: error ? null : data, error });
    if (fn === 'latest_bottles') {
      const limit = Math.min(10, Math.max(1, Number(args.p_limit ?? 10)));
      const rows = this.bottles
        .filter((b) => b.status === 'active' && this.nicknames.has(b.user_id))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit)
        .map((b) => ({
          id: b.id,
          message: b.message,
          x: b.x,
          y: b.y,
          author_id: b.user_id,
          author_nickname: this.nicknames.get(b.user_id) ?? null,
          is_mine: b.user_id === this.session,
          created_at: b.created_at,
          updated_at: b.updated_at,
        }));
      return res(rows);
    }
    if (fn === 'place_bottle') {
      if (!this.session) return res(null, { code: '42501', message: 'not_member' });
      if (!this.nicknames.has(this.session))
        return res(null, { code: 'P0001', message: 'carnet_required' });
      if (/https?:|www\./.test(String(args.p_message)))
        return res(null, { code: 'P0001', message: 'text_link' });
      const b = this.seed(this.session, String(args.p_message));
      b.x = Number(args.p_x);
      b.y = Number(args.p_y);
      return res({
        id: b.id,
        message: b.message,
        x: b.x,
        y: b.y,
        status: b.status,
        created_at: b.created_at,
      });
    }
    return res(null, { code: 'PGRST202', message: `no existe ${fn}` });
  }

  from(table: string) {
    this.calls.push(`from:${table}`);
    const rows = (): Row[] =>
      table === 'bottles'
        ? (this.bottles as unknown as Row[])
        : table === 'bottle_reads'
          ? this.reads
          : (this.reports as unknown as Row[]);
    return {
      select: () =>
        new Query((q) => {
          if (table === 'bottles') {
            return {
              data: rows().filter((r) => r.user_id === this.session && q.match(r)),
              error: null,
            };
          }
          return { data: rows().filter((r) => q.match(r)), error: null };
        }),
      insert: (row: Row) =>
        new Query(() => {
          if (!this.session) return { data: null, error: { code: '42501', message: 'rls' } };
          if (table === 'bottle_reads') {
            if (
              this.reads.some((r) => r.bottle_id === row.bottle_id && r.reader_id === row.reader_id)
            )
              return { data: null, error: { code: '23505', message: 'duplicate' } };
            this.reads.push(row as { bottle_id: string; reader_id: string });
          } else if (table === 'bottle_reports') {
            if (!this.bottles.some((b) => b.id === row.bottle_id))
              return { data: null, error: { code: '23503', message: 'fk' } };
            if (
              this.reports.some(
                (r) => r.bottle_id === row.bottle_id && r.reporter_id === row.reporter_id,
              )
            )
              return { data: null, error: { code: '23505', message: 'duplicate' } };
            this.reports.push(row as (typeof this.reports)[number]);
          }
          return { data: null, error: null };
        }),
      update: (patch: Row) =>
        new Query((q) => {
          const hit = this.bottles.filter(
            (b) => b.user_id === this.session && q.match(b as unknown as Row),
          );
          for (const b of hit) Object.assign(b, patch, { updated_at: this.tick() });
          return { data: hit as unknown as Row[], error: null };
        }),
      delete: () => new Query(() => ({ data: null, error: null })),
    };
  }
}

const A = 'aaaaaaaa-0000-0000-0000-000000000001';
const B = 'bbbbbbbb-0000-0000-0000-000000000002';

function setup(opts: { viewer?: string | null; maxAgeMs?: number } = {}) {
  const sea = new FakeSea();
  sea.nicknames.set(A, 'Marinera A');
  sea.nicknames.set(B, 'Grumete B');
  let viewer = opts.viewer ?? null;
  sea.session = viewer;
  let t = 0;
  const bottles = createGlobalBottles({
    client: sea,
    viewer: () => viewer,
    validatePosition: (p) => (p.x < 0 ? 'en tierra' : null),
    maxAgeMs: opts.maxAgeMs ?? 60_000,
    now: () => t,
  });
  return {
    sea,
    bottles,
    api: bottles.api,
    as(user: string | null) {
      viewer = user;
      sea.session = user;
    },
    advance(ms: number) {
      t += ms;
    },
  };
}

const rejected = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('no se rechazó');
};

describe('botellas globales: lo que hay en el mar', () => {
  it('todos ven las 10 más recientes de todas las cuentas, el invitado también', async () => {
    const { sea, api } = setup();
    const seeded = Array.from({ length: BOTTLES_IN_SEA_MAX + 1 }, (_, i) => {
      const user = `cccccccc-0000-0000-0000-${String(i).padStart(12, '0')}`;
      sea.nicknames.set(user, `Tripulante ${i}`);
      return sea.seed(user, `Mensaje ${i}`);
    });
    const list = await api.list();
    expect(list).toHaveLength(BOTTLES_IN_SEA_MAX);
    expect(list.map((b) => b.id)).toEqual(
      seeded
        .slice(1)
        .reverse()
        .map((b) => b.id),
    );
    expect(list[0]).toMatchObject({
      authorNickname: `Tripulante ${BOTTLES_IN_SEA_MAX}`,
      isMine: false,
      isSample: false,
      read: false,
    });
    await expect(api.mine()).resolves.toBeNull();
  });

  it('se lee una vez y se sirve de lo leído hasta que pasa el tiempo o se pide', async () => {
    const { sea, api, bottles, advance } = setup({ maxAgeMs: 1000 });
    sea.seed(A, 'Hola');
    await api.list();
    await api.list();
    expect(sea.calls.filter((c) => c === 'latest_bottles')).toHaveLength(1);
    sea.seed(B, 'Otra');
    expect(await api.list()).toHaveLength(1);
    advance(1001);
    expect(await api.list()).toHaveLength(2);
    sea.seed(A, 'La nueva de A');
    let changes = 0;
    bottles.subscribe(() => changes++);
    await bottles.refresh();
    expect(changes).toBe(1);
    expect((await api.list()).map((b) => b.message)).toEqual(['La nueva de A', 'Otra']);
    await bottles.refresh();
    expect(changes).toBe(1);
  });

  it('sin red, el mar se queda como estaba y nada falla', async () => {
    const { sea, api, bottles } = setup();
    sea.seed(A, 'Hola');
    await api.list();
    sea.rpc = () => Promise.reject(new Error('sin red'));
    const warn = console.warn;
    console.warn = () => {};
    try {
      await bottles.refresh();
    } finally {
      console.warn = warn;
    }
    expect(await api.list()).toHaveLength(1);
  });
});

describe('botellas globales: echar, una por cuenta y con filtro', () => {
  it('echar una pide cuenta con Carnet', async () => {
    const { api, sea } = setup();
    const e = await rejected(api.place({ message: 'Hola', x: 1, y: 1 }));
    expect(isStoreError(e, 'no_carnet')).toBe(true);
    expect(sea.calls).not.toContain('place_bottle');
  });

  it('la nueva retira la anterior de la cuenta y es la primera del mar', async () => {
    const { api, sea } = setup({ viewer: A });
    sea.seed(B, 'De B');
    const first = await api.place({ message: 'Primera', x: 5, y: 6 });
    expect(first).toMatchObject({ isMine: true, message: 'Primera', x: 5, y: 6, status: 'active' });
    const second = await api.place({ message: '  Segunda  ', x: 7, y: 8 });
    expect(second.message).toBe('Segunda');
    const list = await api.list();
    expect(list.map((b) => b.message)).toEqual(['Segunda', 'De B']);
    expect(list[0]!.authorNickname).toBe('Marinera A');
    await expect(api.mine()).resolves.toMatchObject({ id: second.id, message: 'Segunda' });
    expect(sea.bottles.find((b) => b.id === first.id)!.status).toBe('retired');
  });

  it('el filtro para enlaces, emails, teléfonos y palabras ofensivas antes de mandar nada', async () => {
    const { api, sea } = setup({ viewer: A });
    for (const [message, reason] of [
      ['mira www.ejemplo.es', 'text_link'],
      ['escríbeme a yo@ejemplo.es', 'text_email'],
      ['llámame 612 345 678', 'text_phone'],
      ['eres un cabrón', 'text_offensive'],
    ] as const) {
      const e = await rejected(api.place({ message, x: 1, y: 1 }));
      expect(isStoreError(e, 'invalid') && e.message).toBe(reason);
    }
    const tooLong = await rejected(api.place({ message: 'o'.repeat(141), x: 1, y: 1 }));
    expect(isStoreError(tooLong, 'invalid')).toBe(true);
    const onLand = await rejected(api.place({ message: 'Hola', x: -1, y: 1 }));
    expect(isStoreError(onLand, 'invalid') && onLand.message).toMatch(/tierra/);
    expect(sea.calls).not.toContain('place_bottle');
  });

  it('un rechazo de la base llega como error del repositorio', async () => {
    const { api, sea } = setup({ viewer: A });
    sea.nicknames.delete(A);
    const e = await rejected(api.place({ message: 'Hola', x: 1, y: 1 }));
    expect(isStoreError(e, 'no_carnet')).toBe(true);
  });

  it('editar y retirar la suya', async () => {
    const { api, sea } = setup({ viewer: A });
    const b = await api.place({ message: 'Antes', x: 1, y: 1 });
    const edited = await api.edit(b.id, { message: 'Después' });
    expect(edited.message).toBe('Después');
    expect((await api.list())[0]!.message).toBe('Después');
    const bad = await rejected(api.edit(b.id, { message: 'https://x.io' }));
    expect(isStoreError(bad, 'invalid')).toBe(true);
    await api.retire(b.id);
    expect(await api.list()).toEqual([]);
    await expect(api.mine()).resolves.toBeNull();
    expect(sea.bottles.find((x) => x.id === b.id)!.status).toBe('retired');
  });
});

describe('botellas globales: leer y reportar', () => {
  it('el miembro deja registrada la lectura una vez; el invitado lee sin registrar', async () => {
    const { api, sea } = setup({ viewer: B });
    const b = sea.seed(A, 'Hola');
    const read = await api.read(b.id);
    expect(read).toMatchObject({ message: 'Hola', read: true, isMine: false });
    await api.read(b.id);
    await new Promise((r) => setTimeout(r, 0));
    expect(sea.reads).toEqual([{ bottle_id: b.id, reader_id: B }]);
    expect((await api.list())[0]!.read).toBe(true);

    const guest = setup();
    const g = guest.sea.seed(A, 'Para el invitado');
    await expect(guest.api.read(g.id)).resolves.toMatchObject({ read: true });
    expect(guest.sea.reads).toEqual([]);
    expect(guest.sea.calls).not.toContain('from:bottle_reads');
    const gone = await rejected(guest.api.read('no-existe'));
    expect(isStoreError(gone, 'not_found')).toBe(true);
  });

  it('las ya leídas en otra visita salen leídas', async () => {
    const { api, sea } = setup({ viewer: B });
    const b = sea.seed(A, 'Hola');
    sea.reads.push({ bottle_id: b.id, reader_id: B });
    expect((await api.list())[0]!.read).toBe(true);
  });

  it('reportar: una vez por persona; la propia no; el invitado necesita cuenta', async () => {
    const { api, sea, as } = setup({ viewer: B });
    const b = sea.seed(A, 'Hola');
    await api.list();
    await expect(api.report(b.id, '  spam ')).resolves.toEqual({ first: true });
    await expect(api.report(b.id)).resolves.toEqual({ first: false });
    expect(sea.reports).toEqual([{ bottle_id: b.id, reporter_id: B, reason: 'spam' }]);
    const missing = await rejected(api.report('no-existe'));
    expect(isStoreError(missing, 'not_found')).toBe(true);

    as(A);
    const own = await api.place({ message: 'Mía', x: 1, y: 1 });
    const mine = await rejected(api.report(own.id));
    expect(isStoreError(mine, 'forbidden')).toBe(true);

    as(null);
    const guest = await rejected(api.report(b.id));
    expect(isStoreError(guest, 'no_carnet')).toBe(true);
  });
});

describe('botellas globales en el repositorio que cambia de dueño', () => {
  async function switchable(bottles: GlobalBottles) {
    const guest = createLocalRepository({ storage: new MemoryStorage(), watch: false });
    const member = createLocalRepository({ storage: new MemoryStorage(), watch: false });
    const sw = createSwitchableRepository(guest);
    sw.useBottles(bottles);
    return { sw, guest, member };
  }

  it('invitado y miembro ven las mismas, no las de su repositorio, y al cambiar se vuelven a leer', async () => {
    const { sea, bottles, as } = setup();
    sea.seed(A, 'De A');
    const { sw, member } = await switchable(bottles);
    const changes: RepositoryChange[] = [];
    sw.repo.subscribe((c) => changes.push(c));

    const asGuest = await sw.repo.bottles.list();
    expect(asGuest.map((b) => [b.message, b.isMine])).toEqual([['De A', false]]);

    as(A);
    sw.switchTo(member);
    const asMember = await sw.repo.bottles.list();
    expect(asMember.map((b) => [b.message, b.isMine])).toEqual([['De A', true]]);
    await expect(sw.repo.bottles.mine()).resolves.toMatchObject({ message: 'De A' });
    expect(sea.calls.filter((c) => c === 'latest_bottles')).toHaveLength(2);

    // Lo que cambia en el mar avisa como un cambio de botellas.
    changes.length = 0;
    sea.seed(B, 'De B');
    await bottles.refresh();
    expect(changes.some((c) => c.areas.includes('bottles'))).toBe(true);
    expect(await member.bottles.list()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ message: 'De B' })]),
    );
  });

  it('sin botellas globales, cada repositorio con las suyas (modo local)', async () => {
    const guest = createLocalRepository({ storage: new MemoryStorage(), watch: false });
    const sw = createSwitchableRepository(guest);
    expect(await sw.repo.bottles.list()).toEqual(await guest.bottles.list());
  });
});
