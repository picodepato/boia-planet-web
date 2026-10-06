import { describe, expect, it } from 'vitest';
import { V8_CAMPAIGN_BOSSES, V8_PLAYED_CANON, V8_WON_CANON, migrate } from './migrations';
import { SCHEMA_VERSION } from './schema';
import { STORE_KEY } from './storage';
import { makeRepo } from './test-helpers';

/**
 * v7 → v8 (plan 013 T153): los logros del Cañón definitivo cuentan partidas
 * jugadas y bosses vencidos. Quien en la beta ganó el Cañón o venció al boss
 * final de un acto lo conserva como huella; saldos, premios cobrados y logros
 * (completados y reclamados) quedan como estaban.
 */
const at = '2026-10-04T19:00:00.000Z';
const [act1Counter, act1Boss] = Object.entries(V8_CAMPAIGN_BOSSES)[0]!;

function v7Doc() {
  return {
    schemaVersion: 7,
    identity: { id: 'yo', kind: 'guest', createdAt: '2026-09-30T10:00:00.000Z' },
    carnets: {},
    players: {
      yo: {
        discoveries: {
          [V8_WON_CANON]: { at, worldId: 'arcilla' },
          'minijuego:faro': { at, worldId: 'arcilla' },
          'boia:roca': { at, worldId: 'arcilla' },
        } as Record<string, unknown>,
        discounts: {},
        missions: {},
        records: {},
        counters: { [act1Counter]: 2, 'tiempo-jugado-s': 600 } as Record<string, number>,
        equipped: { flag: 'bandera-boia' },
        prefs: {},
        achievements: {
          canon: { completedAt: at, version: 1, worldId: 'arcilla', metadata: {} },
          guardacostas: { completedAt: at, version: 1, worldId: 'arcilla', metadata: {} },
          faro: { completedAt: at, version: 1, worldId: 'arcilla', metadata: {} },
        },
      },
    },
    ledger: [
      {
        // El premio de la beta: 150 + 50 una vez por temporada.
        id: 'world_reward:minigame:canon@season:arcilla',
        userId: 'yo',
        kind: 'world_reward',
        pointsDelta: 150,
        coinsDelta: 50,
        seasonId: 'arcilla',
        sourceRef: 'minigame:canon',
        metadata: { policy: 'season' },
        createdAt: at,
      },
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
      {
        id: 'achievement:guardacostas',
        userId: 'yo',
        kind: 'achievement',
        pointsDelta: 150,
        coinsDelta: 0,
        seasonId: 'arcilla',
        achievementId: 'guardacostas',
        sourceRef: 'achievement:guardacostas@1',
        metadata: { version: 1 },
        createdAt: at,
      },
      {
        id: 'cosmetic:barco-cel-shaded',
        userId: 'yo',
        kind: 'cosmetic',
        pointsDelta: 0,
        coinsDelta: 0,
        seasonId: 'arcilla',
        cosmeticKey: 'barco-cel-shaded',
        sourceRef: 'achievement:guardacostas',
        metadata: {},
        createdAt: at,
      },
    ],
    purchases: [],
    bottles: [],
    bottleReads: [],
    bottleReports: [],
    carnetReports: [],
    carnetModeration: {},
    content: {
      items: {},
      order: {},
      places: {},
      skins: {},
      texts: {},
      drafts: { items: {}, order: {}, texts: {} },
      revision: 0,
      settings: { trashRetentionDays: 30 },
      missionDestinations: {},
    },
    audit: [],
  };
}

const open = (doc: unknown) => {
  const { storage } = makeRepo();
  storage.setItem(STORE_KEY, JSON.stringify(doc));
  return makeRepo({ storage }).reload();
};

describe('migración v7 → v8 (T153)', () => {
  it('añade las huellas de la beta (jugado, boss vencido) sin tocar nada más', () => {
    const before = v7Doc();
    const m = migrate(before, 8);
    expect(m.status).toBe('ok');
    if (m.status !== 'ok') return;
    const players = m.doc.players as Record<string, Record<string, unknown>>;
    const discoveries = players.yo!.discoveries as Record<string, unknown>;
    expect(discoveries[V8_PLAYED_CANON]).toEqual({ at, worldId: 'arcilla' });
    expect(discoveries[act1Boss]).toEqual({ at: before.identity.createdAt, worldId: null });
    // El acto 2 no se venció: sin huella de su boss.
    expect(Object.keys(discoveries).filter((k) => k.startsWith('jefe:'))).toEqual([act1Boss]);
    // Lo demás, igual.
    expect(m.doc.ledger).toEqual(before.ledger);
    expect(players.yo!.achievements).toEqual(before.players.yo.achievements);
    expect(players.yo!.counters).toEqual(before.players.yo.counters);
  });

  it('al abrirlo, los saldos, los logros y lo ganado siguen como estaban', async () => {
    const repo = open(v7Doc());
    expect(repo.status().schemaVersion).toBe(SCHEMA_VERSION);
    expect(await repo.progress.balances()).toMatchObject({ points: 360, coins: 80 });
    const state = async (id: string) =>
      (await repo.progress.achievements()).find((a) => a.definition.id === id)?.state;
    expect(await state('canon')).toBe('claimed');
    expect(await state('guardacostas')).toBe('claimed');
    // El logro del faro se retiró después (v8 → v9, plan 014 T157): ya no está.
    expect(await state('faro')).toBeUndefined();
    expect(
      (await repo.progress.shop()).find((i) => i.cosmetic.id === 'barco-cel-shaded')?.owned,
    ).toBe(true);
    const keys = (await repo.progress.discoveries()).map((d) => d.key);
    expect(keys).toEqual(expect.arrayContaining([V8_PLAYED_CANON, act1Boss, 'boia:roca']));
  });

  it('un documento sin nada del Cañón migra sin huellas nuevas', () => {
    const doc = v7Doc();
    doc.players.yo.discoveries = {};
    doc.players.yo.counters = {};
    const m = migrate(doc, 8);
    expect(m.status).toBe('ok');
    if (m.status !== 'ok') return;
    const players = m.doc.players as Record<string, Record<string, unknown>>;
    expect(players.yo!.discoveries).toEqual({});
  });
});
