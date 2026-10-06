import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  V10_CASTLE_DIFFICULTIES,
  V10_CASTLE_RUN_MINS,
  migrate,
  v10CastleMedalCounter,
  v10CastleWinKeys,
} from './migrations';
import {
  CANONCITO,
  CASTLE_GAME,
  CASTLE_LONG_RUN_MIN,
  CASTLE_STORM_ACHIEVEMENT,
  CASTLE_VORTEX_ACHIEVEMENT,
  ESTELA_VORTICE,
  FAST_LAP_MS,
  RACE_FAST_ACHIEVEMENT,
  RACE_FAST_MS,
  SAMPLE_ACHIEVEMENTS,
  SAMPLE_COSMETICS,
  TORTUGA_TURBO,
} from './sample';
import { SCHEMA_VERSION, emptyDoc } from './schema';
import { STORE_KEY } from './storage';
import { makeRepo } from './test-helpers';

/**
 * Los premios del castillo y de la carrera (plan 015 T176, decisión 16): los
 * logros del catálogo, lo que regalan al reclamarlos, la migración v9 → v10
 * (las victorias de antes dejan su huella; nada más cambia) y la migración
 * de Supabase (escrita, sin aplicar), que dice lo mismo.
 */

const def = (id: string) => SAMPLE_ACHIEVEMENTS.find((a) => a.id === id)!;
const castle = SAMPLE_ACHIEVEMENTS.filter(
  (a) => a.trigger === 'win_minigame' && a.triggerParams?.game === CASTLE_GAME,
);

describe('catálogo: castillo y carrera (T176)', () => {
  it('un logro por dificultad del castillo, más Tormenta de 10 min', () => {
    const byDifficulty = V10_CASTLE_DIFFICULTIES.map((d) =>
      castle.filter((a) => a.triggerParams?.difficulty === d && a.triggerParams?.runMin === undefined),
    );
    for (const list of byDifficulty) expect(list).toHaveLength(1);
    const storm = def(CASTLE_STORM_ACHIEVEMENT);
    expect(storm.triggerParams).toEqual({ game: CASTLE_GAME, difficulty: 'tormenta' });
    expect(storm.cosmeticKey).toBe(CANONCITO);
    const vortex = def(CASTLE_VORTEX_ACHIEVEMENT);
    expect(vortex.triggerParams).toEqual({
      game: CASTLE_GAME,
      difficulty: 'tormenta',
      runMin: CASTLE_LONG_RUN_MIN,
    });
    expect(vortex.cosmeticKey).toBe(ESTELA_VORTICE);
    // Los que regalan algo dan también monedas (decisión 16); todos, puntos.
    for (const a of castle) expect(a.points, a.id).toBeGreaterThan(0);
    for (const a of [storm, vortex]) expect(a.coins, a.id).toBeGreaterThan(0);
  });

  it('«Primera regata» es terminar la regata; «Rápido» pide menos que el bronce y más que el Rayo', () => {
    const first = def('circuito');
    expect(first.title).toBe('Primera regata');
    expect(first.trigger).toBe('complete_circuit');
    expect(first.triggerParams).not.toHaveProperty('maxMs');
    expect(first.points).toBeGreaterThan(0);
    expect(first.coins).toBeGreaterThan(0);
    const fast = def(RACE_FAST_ACHIEVEMENT);
    expect(fast.title).toBe('Rápido');
    expect(fast.triggerParams).toMatchObject({ maxMs: RACE_FAST_MS });
    expect(fast.cosmeticKey).toBe(TORTUGA_TURBO);
    expect(fast.coins).toBeGreaterThan(0);
    // «Rayo de Los Rápidos» sigue siendo el reto de arriba: no choca con «Rápido».
    const rayo = def('circuito-rapido');
    expect(rayo.triggerParams).toMatchObject({ maxMs: FAST_LAP_MS });
    expect(RACE_FAST_MS).toBeGreaterThan(FAST_LAP_MS);
    expect(fast.description).toContain(String(RACE_FAST_MS / 1000));
  });

  it('cada premio es de un solo logro, que da puntos, monedas y el cosmético al reclamarlo', async () => {
    for (const key of [CANONCITO, TORTUGA_TURBO, ESTELA_VORTICE]) {
      expect(SAMPLE_ACHIEVEMENTS.filter((a) => a.cosmeticKey === key), key).toHaveLength(1);
    }
    const { repo } = makeRepo();
    for (const id of [CASTLE_STORM_ACHIEVEMENT, CASTLE_VORTEX_ACHIEVEMENT, RACE_FAST_ACHIEVEMENT]) {
      const a = def(id);
      expect(await repo.progress.balances()).toBeDefined();
      const before = await repo.progress.balances();
      expect((await repo.progress.completeAchievement(id)).completed).toBe(true);
      expect((await repo.progress.completeAchievement(id)).completed).toBe(false);
      const r = await repo.progress.claimAchievement(id);
      expect(r.claimed, id).toBe(true);
      if (r.claimed) expect(r.cosmetic?.cosmeticKey, id).toBe(a.cosmeticKey);
      expect((await repo.progress.claimAchievement(id)).claimed).toBe(false);
      expect(await repo.progress.balances()).toMatchObject({
        points: before.points + a.points,
        coins: before.coins + (a.coins ?? 0),
      });
    }
    const shop = await repo.progress.shop();
    for (const key of [CANONCITO, TORTUGA_TURBO, ESTELA_VORTICE]) {
      expect(shop.find((i) => i.cosmetic.id === key)?.owned, key).toBe(true);
    }
  });
});

const at = '2026-10-06T09:00:00.000Z';

function v9Doc(counters: Record<string, number>) {
  return {
    ...emptyDoc(9),
    schemaVersion: 9,
    identity: { id: 'yo', kind: 'guest', createdAt: '2026-09-30T10:00:00.000Z' },
    players: {
      yo: {
        discoveries: {
          'partida:canon': { at, worldId: 'arcilla' },
          // Una huella que ya estaba no se pisa.
          'minijuego:castillo': { at, worldId: 'arcilla' },
        },
        discounts: {},
        missions: {},
        records: {
          'logro-vuelta:el-freu': {
            id: 'logro-vuelta:el-freu',
            bestMs: 79_000,
            bestAt: at,
            attempts: 2,
          },
        },
        counters: { 'tiempo-jugado-s': 600, ...counters },
        equipped: {},
        prefs: {},
        achievements: {
          canon: { completedAt: at, version: 1, worldId: 'arcilla', metadata: {} },
        },
      },
    },
    ledger: [
      {
        id: 'achievement:canon',
        userId: 'yo',
        kind: 'achievement',
        pointsDelta: 60,
        coinsDelta: 30,
        seasonId: 'arcilla',
        achievementId: 'canon',
        sourceRef: 'achievement:canon@1',
        metadata: { version: 1 },
        createdAt: at,
      },
    ],
  };
}

describe('migración v9 → v10: las victorias del castillo de antes (T176)', () => {
  // Oro en 10 min Tormenta, plata en 5 Normal, bronce (cayó) en 7 Tranquila.
  const counters = {
    [v10CastleMedalCounter(10, 'tormenta')]: 3,
    [v10CastleMedalCounter(5, 'normal')]: 2,
    [v10CastleMedalCounter(7, 'tranquila')]: 1,
  };

  it('añade las huellas de cada par ganado (plata u oro) y no toca nada más', () => {
    const before = v9Doc(counters);
    const m = migrate(before, 10);
    expect(m.status).toBe('ok');
    if (m.status !== 'ok') return;
    expect(m.applied).toHaveLength(1);
    const yo = (m.doc.players as Record<string, Record<string, unknown>>).yo!;
    const found = Object.keys(yo.discoveries as object).sort();
    expect(found).toEqual(
      [
        'partida:canon',
        ...new Set([...v10CastleWinKeys(10, 'tormenta'), ...v10CastleWinKeys(5, 'normal')]),
      ].sort(),
    );
    // El bronce no es ganar: Tranquila sin huella.
    expect(found.some((k) => k.includes('tranquila'))).toBe(false);
    // La que ya estaba, igual.
    expect((yo.discoveries as Record<string, unknown>)['minijuego:castillo']).toEqual(
      before.players.yo.discoveries['minijuego:castillo'],
    );
    // Todo lo demás, igual.
    const others = (p: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'discoveries'));
    expect(others(yo)).toEqual(others(before.players.yo));
    expect(m.doc.ledger).toEqual(before.ledger);
    expect({ ...m.doc, players: undefined, schemaVersion: 9 }).toEqual({
      ...before,
      players: undefined,
    });
  });

  it('sin medallas del castillo el documento sale igual', () => {
    const before = v9Doc({});
    const m = migrate(before, 10);
    expect(m.status).toBe('ok');
    if (m.status !== 'ok') return;
    expect({ ...m.doc, schemaVersion: 9 }).toEqual(before);
  });

  it('al abrirlo: versión actual, saldos y contadores como estaban, y las huellas para los logros', async () => {
    const { storage } = makeRepo();
    storage.setItem(STORE_KEY, JSON.stringify(v9Doc(counters)));
    const repo = makeRepo({ storage }).reload();
    expect(repo.status()).toMatchObject({ issue: null, schemaVersion: SCHEMA_VERSION });
    expect(await repo.progress.balances()).toMatchObject({ points: 60, coins: 30 });
    const keys = (await repo.progress.discoveries()).map((d) => d.key);
    expect(keys).toEqual(expect.arrayContaining(v10CastleWinKeys(10, 'tormenta')));
    expect(await repo.progress.counter(v10CastleMedalCounter(10, 'tormenta'))).toBe(3);
    expect(await repo.progress.record('logro-vuelta:el-freu')).toMatchObject({ bestMs: 79_000 });
    const list = await repo.progress.achievements();
    expect(list.find((a) => a.definition.id === 'canon')?.state).toBe('claimed');
  });

  it('copia fija de las medallas: las mismas duraciones y dificultades del castillo', () => {
    expect([...V10_CASTLE_RUN_MINS]).toEqual([5, 7, CASTLE_LONG_RUN_MIN]);
    expect([...V10_CASTLE_DIFFICULTIES]).toEqual(
      castle.flatMap((a) => (a.triggerParams?.runMin === undefined ? [a.triggerParams?.difficulty] : [])),
    );
  });
});

describe('migración de Supabase (T176, escrita y sin aplicar)', () => {
  const read = (path: string) =>
    readFileSync(new URL(`../../../supabase/${path}`, import.meta.url), 'utf8');
  const SQL = read('migrations/20261006100400_castle_race_prizes.sql');
  const SEEDS = read('seeds/20261003100100_economy.sql');

  it('siembra cada premio con el logro que lo regala, igual que el navegador y la siembra', () => {
    for (const key of [CANONCITO, TORTUGA_TURBO, ESTELA_VORTICE]) {
      const c = SAMPLE_COSMETICS.find((x) => x.id === key)!;
      const a = SAMPLE_ACHIEVEMENTS.find((x) => x.cosmeticKey === key)!;
      const row = `('${c.id}', '${c.name}', '${c.slot}', null, null, '${a.id}', null, null, false, true)`;
      expect(SQL, key).toContain(row);
      expect(SEEDS, key).toContain(row);
      // El premio cabe en el tope de la acción `achievement` (300 puntos y 50 monedas).
      expect(a.points).toBeLessThanOrEqual(300);
      expect(a.coins ?? 0).toBeLessThanOrEqual(50);
      // El origen (el id del logro) cumple el patrón de la acción.
      expect(a.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    for (const a of [...castle, def('circuito')]) {
      expect(a.points).toBeLessThanOrEqual(300);
      expect(a.coins ?? 0).toBeLessThanOrEqual(50);
    }
  });

  it('las copias de las cuentas ganan las mismas huellas que la migración v10', () => {
    expect(SQL).toContain(`format('castillo:%s-%s:medalla', m.run_min, d.difficulty)`);
    expect(SQL).toContain(`>= ${2}`);
    expect(SQL).toContain(`(values (${V10_CASTLE_RUN_MINS.join('), (')}))`);
    expect(SQL).toContain(`(values ('${V10_CASTLE_DIFFICULTIES.join("'), ('")}'))`);
    const [plain, withDiff, withMin] = v10CastleWinKeys(10, 'tormenta');
    expect(SQL).toContain(`('${plain}')`);
    expect(withDiff).toBe(`${plain}:tormenta`);
    expect(withMin).toBe(`${plain}:tormenta:10`);
    expect(SQL).toContain(`('${plain}:' || d.difficulty)`);
    expect(SQL).toContain(`('${plain}:' || d.difficulty || ':' || m.run_min)`);
    // Lo que ya había gana (va a la derecha) y el libro no se toca.
    expect(SQL).toContain(`f.keys || (s.data #> '{player,discoveries}')`);
    expect(SQL).not.toMatch(/ledger_transactions/);
    expect(SQL).not.toMatch(/\bdelete\b/i);
  });
});
