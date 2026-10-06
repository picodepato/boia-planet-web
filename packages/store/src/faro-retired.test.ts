import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySnapshot } from './member/hydrate';
import { V9_RETIRED_ACHIEVEMENT, V9_RETIRED_DISCOVERY, migrate } from './migrations';
import {
  RETIRED_ACHIEVEMENTS,
  RETIRED_DISCOVERIES,
  isRetiredAchievement,
} from './retired-achievements';
import { SAMPLE_ACHIEVEMENTS } from './sample';
import { SCHEMA_VERSION, emptyDoc } from './schema';
import { STORE_KEY } from './storage';
import { makeRepo } from './test-helpers';

/**
 * v8 → v9 (plan 014 T157): la Vigilancia del faro sale de la web y quien ganó
 * su logro («Vigía del faro», `faro`) no lo conserva. La migración quita el
 * logro completado y la huella de la victoria; todo lo demás (otros logros,
 * descubrimientos, contadores, el libro y sus saldos) queda igual, y el
 * repositorio no enseña el logro aunque su fila cobrada siga en el libro.
 */
const at = '2026-10-05T19:00:00.000Z';

function v8Doc() {
  const claim = (id: string, points: number, coins: number) => ({
    id: `achievement:${id}`,
    userId: 'yo',
    kind: 'achievement',
    pointsDelta: points,
    coinsDelta: coins,
    seasonId: 'arcilla',
    achievementId: id,
    sourceRef: `achievement:${id}@1`,
    metadata: { version: 1 },
    createdAt: at,
  });
  return {
    ...emptyDoc(8),
    schemaVersion: 8,
    identity: { id: 'yo', kind: 'guest', createdAt: '2026-09-30T10:00:00.000Z' },
    players: {
      yo: {
        discoveries: {
          [V9_RETIRED_DISCOVERY]: { at, worldId: 'arcilla' },
          'minijuego:canon': { at, worldId: 'arcilla' },
          'partida:canon': { at, worldId: 'arcilla' },
          'isla:faro': { at, worldId: 'arcilla' },
        },
        discounts: {},
        missions: {},
        records: {},
        counters: { 'tiempo-jugado-s': 600 },
        equipped: {},
        prefs: {},
        achievements: {
          [V9_RETIRED_ACHIEVEMENT]: {
            completedAt: at,
            version: 1,
            worldId: 'arcilla',
            metadata: {},
          },
          canon: { completedAt: at, version: 1, worldId: 'arcilla', metadata: {} },
          'canon-zarpa': { completedAt: at, version: 1, worldId: 'arcilla', metadata: {} },
        },
      },
    },
    ledger: [claim('faro', 60, 30), claim('canon', 60, 30)],
  };
}

const open = (doc: unknown) => {
  const { storage } = makeRepo();
  storage.setItem(STORE_KEY, JSON.stringify(doc));
  return makeRepo({ storage }).reload();
};

describe('migración v8 → v9: sin la Vigilancia del faro (plan 014 T157)', () => {
  it('el catálogo ya no tiene el logro del faro ni nada que pida ganar el faro', () => {
    expect(RETIRED_ACHIEVEMENTS.has(V9_RETIRED_ACHIEVEMENT)).toBe(true);
    expect(RETIRED_DISCOVERIES.has(V9_RETIRED_DISCOVERY)).toBe(true);
    expect(SAMPLE_ACHIEVEMENTS.some((a) => isRetiredAchievement(a.id))).toBe(false);
    for (const a of SAMPLE_ACHIEVEMENTS) {
      expect(Object.values(a.triggerParams ?? {}), a.id).not.toContain('faro');
    }
    // Guardacostas (v3): basta con jugar el Cañón.
    const g = SAMPLE_ACHIEVEMENTS.find((a) => a.id === 'guardacostas')!;
    expect(g).toMatchObject({ trigger: 'play_minigame', triggerParams: { game: 'canon' } });
  });

  it('quita el logro del faro y su huella, y deja todo lo demás igual', () => {
    const before = v8Doc();
    const m = migrate(before, 9);
    expect(m.status).toBe('ok');
    if (m.status !== 'ok') return;
    expect(m.applied).toHaveLength(1);
    const players = m.doc.players as Record<string, Record<string, unknown>>;
    const without = (v: Record<string, unknown>, key: string) =>
      Object.fromEntries(Object.entries(v).filter(([k]) => k !== key));
    expect(players.yo!.achievements).toEqual(
      without(before.players.yo.achievements, V9_RETIRED_ACHIEVEMENT),
    );
    expect(players.yo!.discoveries).toEqual(
      without(before.players.yo.discoveries, V9_RETIRED_DISCOVERY),
    );
    // La visita a la isla del faro (`isla:faro`) no es la victoria: se queda.
    expect(players.yo!.discoveries).toHaveProperty(['isla:faro']);
    // Lo demás, igual: el libro, los contadores, la identidad.
    expect(m.doc.ledger).toEqual(before.ledger);
    expect(players.yo!.counters).toEqual(before.players.yo.counters);
    expect({ ...m.doc, players: undefined, schemaVersion: 8 }).toEqual({
      ...before,
      players: undefined,
    });
  });

  it('al abrirlo: sin el logro ni su insignia, con los saldos del libro como estaban', async () => {
    const repo = open(v8Doc());
    expect(repo.status().schemaVersion).toBe(SCHEMA_VERSION);
    const list = await repo.progress.achievements();
    expect(list.map((a) => a.definition.id)).not.toContain('faro');
    expect(list.find((a) => a.definition.id === 'canon')?.state).toBe('claimed');
    expect(list.find((a) => a.definition.id === 'canon-zarpa')?.state).toBe('ready');
    expect((await repo.progress.badges()).map((b) => b.achievementId)).not.toContain('faro');
    expect(await repo.progress.balances()).toMatchObject({ points: 120, coins: 60 });
    const keys = (await repo.progress.discoveries()).map((d) => d.key);
    expect(keys).not.toContain(V9_RETIRED_DISCOVERY);
    expect(keys).toEqual(expect.arrayContaining(['minijuego:canon', 'isla:faro']));
  });

  it('una copia de la cuenta (Supabase) que aún lo tenga no lo trae de vuelta', () => {
    const doc = emptyDoc();
    const player = v8Doc().players.yo;
    expect(
      applySnapshot(doc, 'yo', {
        format: 1,
        player: { achievements: player.achievements, discoveries: player.discoveries },
      }),
    ).toBe(true);
    expect(Object.keys(doc.players.yo!.achievements).sort()).toEqual(['canon', 'canon-zarpa']);
    expect(doc.players.yo!.discoveries).not.toHaveProperty([V9_RETIRED_DISCOVERY]);
    expect(doc.players.yo!.discoveries).toHaveProperty(['minijuego:canon']);
  });

  it('la migración de Supabase (escrita, sin aplicar) quita lo mismo de las copias', () => {
    const sql = readFileSync(
      new URL('../../../supabase/migrations/20261006100000_faro_retired.sql', import.meta.url),
      'utf8',
    );
    expect(sql).toContain(`'{player,achievements}') - '${V9_RETIRED_ACHIEVEMENT}'`);
    expect(sql).toContain(`'{player,discoveries}') - '${V9_RETIRED_DISCOVERY}'`);
    // Sólo copias y la descripción de la acción: el libro no se toca.
    expect(sql).not.toMatch(/ledger_transactions/);
    expect(sql).not.toMatch(/\bdelete\b/i);
  });
});
