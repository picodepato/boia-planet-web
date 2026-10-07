import type { RankingPage, RankingRow } from '@boia/db/rpc';
import { circuitFromWorld } from '@boia/engine/circuit';
import { CIRCUIT_ID, WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it, vi } from 'vitest';
import { circuitName } from './ranking-circuit';
import {
  type GlobalRow,
  RANKING_PAGE_SIZE,
  type RankingClient,
  appendPage,
  boardKey,
  circuitOptions,
  fetchRankingPage,
  hasMore,
  memberFinishStanding,
  pinnedMine,
  raceLeader,
  raceStanding,
} from './ranking-global';

/** Una tabla de servidor de `n` cuentas (la 1 la más alta) y quien mira, `me`. */
function serverTable(n: number, me: string | null) {
  return Array.from({ length: n }, (_, i): RankingRow => ({
    position: i + 1,
    user_id: `u${i + 1}`,
    nickname: `Socio ${i + 1}`,
    member_number: i + 1,
    is_artist: false,
    value: 60_000 + i * 100,
    is_mine: `u${i + 1}` === me,
  }));
}

/** Un cliente falso con las RPC de T86 (`ranking_points`, `ranking_race`) por páginas. */
function fakeClient(n: number, me: string | null, opts: { failAvatars?: boolean } = {}) {
  const table = serverTable(n, me);
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const client: RankingClient = {
    rpc(fn, args) {
      calls.push({ fn, args });
      if (fn === 'ranking_race' && args.p_circuit !== 'el-freu') {
        return Promise.resolve({ data: null, error: { message: 'unknown_circuit' } });
      }
      const limit = Number(args.p_limit);
      const offset = Number(args.p_offset);
      const page: RankingPage = {
        total: table.length,
        limit,
        offset,
        rows: table.slice(offset, offset + limit),
        mine: table.find((r) => r.is_mine) ?? null,
      };
      return Promise.resolve({ data: page, error: null });
    },
    from: () => ({
      select: () => ({
        in: (_c, ids) =>
          opts.failAvatars
            ? Promise.reject(new Error('sin red'))
            : Promise.resolve({
                data: ids.map((id) => ({ user_id: id, avatar_key: `avatar-neutro-${id.length}` })),
                error: null,
              }),
      }),
    }),
  };
  return { client, calls };
}

const row = (id: string, position: number, isMine = false): GlobalRow => ({
  position,
  userId: id,
  nickname: id,
  memberNumber: position,
  isArtist: false,
  value: position,
  isMine,
  avatarKey: null,
});

describe('ranking global por páginas (T92, decisión 8)', () => {
  it('T194: los ceros no tienen puesto, tampoco la fila fijada; mantiene empates y páginas', async () => {
    const { client } = fakeClient(62, 'u62', { failAvatars: true });
    const table = serverTable(62, 'u62').map((r, i) => ({
      ...r,
      value: i < 2 ? 100 : i === 2 ? 50 : 0,
      position: i < 2 ? 1 : i === 2 ? 3 : 4,
      // El apodo ya moderado del servidor no se reconstruye en el lector.
      nickname: i === 3 ? 'Miembro de BOIA 4' : r.nickname,
    }));
    client.rpc = (_fn, args) =>
      Promise.resolve({
        data: {
          total: table.length,
          offset: args.p_offset,
          rows: table.slice(Number(args.p_offset), Number(args.p_offset) + Number(args.p_limit)),
          mine: table.at(-1),
        },
        error: null,
      });
    const page = await fetchRankingPage(client, { kind: 'points' });
    expect(page.total).toBe(62);
    expect(page.rows).toHaveLength(50);
    expect(page.rows.slice(0, 3).map((r) => r.position)).toEqual([1, 1, 3]);
    expect(page.rows.slice(3).every((r) => r.position === null)).toBe(true);
    expect(page.rows[3]).toMatchObject({ nickname: 'Miembro de BOIA 4', avatarKey: null });
    expect(pinnedMine(page.rows, page.mine)).toMatchObject({
      userId: 'u62',
      position: null,
      value: 0,
    });
    const next = await fetchRankingPage(client, { kind: 'points' }, 50);
    expect(next.offset).toBe(50);
    expect(next.rows).toHaveLength(12);
    expect(next.rows.every((r) => r.position === null)).toBe(true);
    expect(pinnedMine(appendPage(page.rows, next.rows), next.mine)).toBeNull();
    // Esta política sólo se aplica a los puntos de siempre.
    const circuit = await fetchRankingPage(client, {
      kind: 'circuit',
      circuit: 'el-freu',
      version: 3,
    });
    expect(circuit.mine?.position).toBe(4);
  });

  it('el top de RANKING_PAGE_SIZE con la fila propia aunque quede fuera', async () => {
    const { client, calls } = fakeClient(RANKING_PAGE_SIZE + 7, `u${RANKING_PAGE_SIZE + 5}`);
    const p = await fetchRankingPage(client, { kind: 'circuit', circuit: 'el-freu', version: 3 });
    expect(calls[0]).toEqual({
      fn: 'ranking_race',
      args: { p_circuit: 'el-freu', p_version: 3, p_limit: RANKING_PAGE_SIZE, p_offset: 0 },
    });
    expect(p.rows).toHaveLength(RANKING_PAGE_SIZE);
    expect(p.total).toBe(RANKING_PAGE_SIZE + 7);
    expect(p.mine).toMatchObject({ userId: `u${RANKING_PAGE_SIZE + 5}`, isMine: true });
    expect(pinnedMine(p.rows, p.mine)).toBe(p.mine);
    expect(p.rows[0]!.avatarKey).toBe('avatar-neutro-2');
  });

  it('«Mostrar más» recorre a todos sin repetir y entonces ya no hay más', async () => {
    const n = RANKING_PAGE_SIZE * 2 + 3;
    const { client, calls } = fakeClient(n, 'u3');
    let rows: GlobalRow[] = [];
    let last = await fetchRankingPage(client, { kind: 'points' });
    rows = appendPage(rows, last.rows);
    while (hasMore(rows.length, last.total, last.rows.length)) {
      last = await fetchRankingPage(client, { kind: 'points' }, rows.length);
      rows = appendPage(rows, last.rows);
    }
    expect(calls.map((c) => c.args.p_offset)).toEqual([
      0,
      RANKING_PAGE_SIZE,
      RANKING_PAGE_SIZE * 2,
    ]);
    expect(calls.every((c) => c.fn === 'ranking_points')).toBe(true);
    expect(rows.map((r) => r.userId)).toEqual(serverTable(n, null).map((r) => r.user_id));
    // Ya cargada, la fila propia no se fija debajo.
    expect(pinnedMine(rows, last.mine)).toBeNull();
  });

  it('una página repetida no duplica filas; una página vacía corta «Mostrar más»', () => {
    expect(
      appendPage([row('a', 1), row('b', 2)], [row('b', 2), row('c', 3)]).map((r) => r.userId),
    ).toEqual(['a', 'b', 'c']);
    expect(hasMore(50, 120, 50)).toBe(true);
    expect(hasMore(120, 120, 20)).toBe(false);
    expect(hasMore(50, 120, 0)).toBe(false);
    expect(pinnedMine([row('a', 1)], null)).toBeNull();
  });

  it('un circuito que el servidor no conoce es una tabla vacía; sin avatares la lista sigue', async () => {
    const { client } = fakeClient(3, null, { failAvatars: true });
    const none = await fetchRankingPage(client, { kind: 'circuit', circuit: 'otro', version: 1 });
    expect(none).toEqual({ total: 0, offset: 0, rows: [], mine: null });
    const p = await fetchRankingPage(client, { kind: 'points' });
    expect(p.rows.map((r) => r.avatarKey)).toEqual([null, null, null]);
  });

  it('la tarjeta de meta: manda la cola y lee el puesto; el de la salida, el más rápido', async () => {
    const { client } = fakeClient(12, 'u7');
    expect(await raceStanding(client, 'el-freu', 3)).toEqual({
      position: 7,
      total: 12,
      bestMs: 60_600,
    });
    expect(await raceLeader(client, 'el-freu', 3)).toEqual({ name: 'Socio 1', ms: 60_000 });
    const order: string[] = [];
    const flush = vi.fn(async () => {
      order.push('flush');
    });
    const standing = await memberFinishStanding('el-freu', 3, flush, async () => {
      order.push('client');
      return client;
    });
    expect(standing).toEqual({ kind: 'global', position: 7, total: 12 });
    expect(order).toEqual(['flush', 'client']);
    const failing = await memberFinishStanding('el-freu', 3, () => Promise.reject(new Error('x')));
    expect(failing).toEqual({ kind: 'unavailable' });
    const noTime = await memberFinishStanding(
      'el-freu',
      3,
      flush,
      async () => fakeClient(4, null).client,
    );
    expect(noTime).toEqual({ kind: 'unavailable' });
  });
});

describe('selector de circuito (T87: uno por circuito y mundo)', () => {
  const list = WORLD_REGISTRY.list().map((w) => ({
    id: w.id,
    name: w.name,
    config: WORLD_REGISTRY.get(w.id).config,
  }));

  it('el del mundo que se juega primero, con su nombre; un trazado compartido, una sola opción', () => {
    for (const current of list) {
      const opts = circuitOptions(list, current.id);
      const spec = circuitFromWorld(current.config, CIRCUIT_ID)!;
      expect(opts[0]).toMatchObject({
        key: boardKey({ kind: 'circuit', circuit: spec.id, version: spec.version }),
        circuit: spec.id,
        version: spec.version,
        worldId: current.id,
        worldName: current.name,
        place: circuitName(current.config),
      });
      const distinct = new Set(
        list.map((w) => {
          const s = circuitFromWorld(w.config, CIRCUIT_ID)!;
          return `${s.id}:${s.version}`;
        }),
      );
      expect(opts).toHaveLength(distinct.size);
      expect(new Set(opts.map((o) => o.key)).size).toBe(opts.length);
    }
  });
});
