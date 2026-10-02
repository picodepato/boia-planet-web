import { circuitFromWorld, circuitRecordId, readRecord } from '@boia/engine/circuit';
import { FAST_LAP_MS, createLocalRepository, isStableKey } from '@boia/store';
import { CIRCUIT_ID, WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { finishLap, lapNotices } from './circuit-hud';

/**
 * La vuelta de El Freu y sus logros (T36): una vuelta completa «Por El
 * Freu»; por el arco del atajo, el oculto del atajo; por debajo del tiempo de
 * «Rayo del Freu», ése. Se completan (listos para reclamar), no se conceden.
 */

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
const spec = circuitFromWorld(world, CIRCUIT_ID)!;
const repo = () => createLocalRepository({ storage: null, watch: false });
const defs = await repo().content.list('achievements');
const circuitDefs = defs.filter((d) => d.trigger === 'complete_circuit');
const param = (id: string, k: string) =>
  (circuitDefs.find((d) => d.id === id)?.triggerParams as Record<string, unknown>)[k];
const byParam = (k: string) =>
  circuitDefs.find((d) => (d.triggerParams as Record<string, unknown>)[k] !== undefined)!;

describe('finishLap', () => {
  it('una vuelta lenta por la ruta segura sólo completa la vuelta', async () => {
    const r = repo();
    const safe = spec.gates.filter((g) => g.order === 2).map((g) => g.objectId);
    const shortcutGate = param(byParam('via').id, 'via');
    const route = [safe.find((g) => g !== shortcutGate)!];
    const res = await finishLap(r.progress, spec, FAST_LAP_MS * 2, route);
    const plain = circuitDefs.find((d) => Object.keys(d.triggerParams).length === 1)!;
    expect(res.achievements.map((n) => n.id)).toEqual([`logro:${plain.id}`]);
    expect(res.achievement).toBe(plain.title);
    expect(lapNotices(FAST_LAP_MS * 2, res).map((n) => n.kind)).toEqual(['info', 'achievement']);
    expect((await r.progress.ledger()).filter((e) => e.kind === 'achievement')).toEqual([]);
  });

  it('por el atajo y por debajo del tiempo completa los otros dos', async () => {
    const r = repo();
    const via = byParam('via');
    const fast = byParam('maxMs');
    const maxMs = param(fast.id, 'maxMs') as number;
    expect(maxMs).toBe(FAST_LAP_MS);
    const res = await finishLap(r.progress, spec, maxMs - 1, [param(via.id, 'via') as string]);
    expect(res.achievements.map((n) => n.id).sort()).toEqual(
      circuitDefs.map((d) => `logro:${d.id}`).sort(),
    );
    // Otra vuelta igual no repite nada.
    expect((await finishLap(r.progress, spec, maxMs - 1)).achievements).toEqual([]);
  });
});

describe('récord de la vuelta (T37)', () => {
  it('se guarda con una clave estable y sólo mejora', async () => {
    const r = repo();
    expect(isStableKey(circuitRecordId(spec))).toBe(true);
    expect(await finishLap(r.progress, spec, 60_000)).toMatchObject({ best: true, bestMs: 60_000 });
    expect(await finishLap(r.progress, spec, 70_000)).toMatchObject({
      best: false,
      bestMs: 60_000,
    });
    expect((await r.progress.record(circuitRecordId(spec)))?.bestMs).toBe(60_000);
    expect(await readRecord(r.progress, spec)).toMatchObject({ bestMs: 60_000 });
  });
});
