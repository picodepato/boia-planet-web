import { MemoryRewardStore, WorldRuntime, simulate } from '@boia/engine';
import { IDLE_INPUT } from '@boia/engine/headless';
import { WORLD_REGISTRY, type WorldConfig } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { marWorld } from './engine/compact';

/**
 * Los restos y los cofres fugaces del mar de /mar (Arcilla, con su mapa
 * compacto y el planeta que da la vuelta, como `Mar3D`). Cada carga de /mar
 * es una semilla nueva (`mar-client.tsx`: `Date.now()`), así que «recargar»
 * es un runtime nuevo con otra semilla y otra sesión.
 */

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const ofId = (id: string) => world.objects.find((o) => o.identity.id === id)!;
const spawnOf = (id: string) => {
  const b = ofId(id).behaviors.find((x) => x.type === 'spawn')!;
  return b.params as {
    positions: { x: number; y: number }[];
    probability?: number;
    lifetime?: number;
    every?: number;
  };
};
const runtime = (seed: number, sessionId: string, rewards = new MemoryRewardStore()) =>
  new WorldRuntime(world, { seed, sessionId, rewards, wrap: true });
const RESTOS = world.objects.filter((o) => o.identity.category === 'restos').map((o) => o.identity.id);
const key = (p: { x: number; y: number }) => `${Math.round(p.x)},${Math.round(p.y)}`;

/** Lejos de todo: el barco quieto, a medio planeta del objeto. */
const farFrom = (w: WorldConfig, p: { x: number; y: number }) => ({
  x: p.x + (w.bounds.right - w.bounds.left) / 2,
  y: p.y + (w.bounds.bottom - w.bounds.top) / 2,
});

describe('restos regenerables (REQ-AVE-016)', () => {
  it('recoger, recargar y ver los restos en posiciones nuevas', () => {
    expect(RESTOS.length).toBeGreaterThan(3);
    const rewards = new MemoryRewardStore();
    // Primera visita: se recoge el primero pasando por encima.
    const first = runtime(11, 'visita-1', rewards);
    const r1 = first.objectState(RESTOS[0]!)!;
    expect(r1.present).toBe(true);
    const visit = simulate(world, {
      runtime: first,
      seconds: 1,
      start: { x: r1.x, y: r1.y },
      input: () => IDLE_INPUT,
    });
    expect(visit.events).toContainEqual({ type: 'collected', objectId: RESTOS[0] });
    expect(visit.events.some((e) => e.type === 'reward' && e.objectId === RESTOS[0])).toBe(true);
    expect(first.objectState(RESTOS[0]!)!.present).toBe(false);

    // Recargar: otra semilla y otra sesión. Vuelven todos, cada uno en uno de sus sitios.
    const before = RESTOS.map((id) => key(first.objectState(id)!));
    const reloads = [12, 13, 14, 15].map((seed) => runtime(seed, `visita-${seed}`, rewards));
    for (const rt of reloads) {
      for (const id of RESTOS) {
        const s = rt.objectState(id)!;
        expect(s.present, id).toBe(true);
        expect(spawnOf(id).positions.map(key)).toContain(key(s));
      }
    }
    // Y no en los mismos: alguna recarga los pone en sitios distintos de la primera visita.
    expect(
      reloads.some((rt) => RESTOS.some((id, i) => key(rt.objectState(id)!) !== before[i])),
    ).toBe(true);

    // En la visita nueva, el resto recogido antes vuelve a dar su premio (uno por sesión).
    const again = reloads[0]!;
    const r2 = again.objectState(RESTOS[0]!)!;
    const next = simulate(world, {
      runtime: again,
      seconds: 1,
      start: { x: r2.x, y: r2.y },
      input: () => IDLE_INPUT,
    });
    expect(next.events.some((e) => e.type === 'reward' && e.objectId === RESTOS[0])).toBe(true);
  });
});

describe('cofres fugaces (REQ-AVE-017)', () => {
  const COFRE = 'cofre-1';
  const { lifetime } = spawnOf(COFRE);
  /** Una semilla con el cofre a la vista al empezar. */
  const seed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find((s) => runtime(s, 'x').objectState(COFRE)!.present)!;

  it('el cofre desaparece a su tiempo si nadie lo alcanza', () => {
    expect(lifetime).toBeGreaterThan(0);
    const rt = runtime(seed, 'quieto');
    const at = rt.objectState(COFRE)!;
    let goneAt: number | null = null;
    const r = simulate(world, {
      runtime: rt,
      seconds: lifetime! + 1,
      start: farFrom(world, at),
      input: () => IDLE_INPUT,
      before: (t, run) => {
        if (goneAt === null && !run.objectState(COFRE)!.present) goneAt = t;
      },
    });
    expect(goneAt).not.toBeNull();
    expect(Math.abs(goneAt! - lifetime!)).toBeLessThan(0.1);
    expect(r.events).toContainEqual({ type: 'disappeared', objectId: COFRE });
    expect(r.events.some((e) => e.type === 'reward' && e.objectId === COFRE)).toBe(false);
  });

  it('alcanzarlo antes de que desaparezca da su premio, una vez', () => {
    const rt = runtime(seed, 'rapido');
    const at = rt.objectState(COFRE)!;
    const r = simulate(world, {
      runtime: rt,
      seconds: 2,
      start: { x: at.x, y: at.y },
      input: () => IDLE_INPUT,
    });
    expect(r.events.filter((e) => e.type === 'collected' && e.objectId === COFRE)).toHaveLength(1);
    const prizes = r.events.filter((e) => e.type === 'reward' && e.objectId === COFRE);
    expect(prizes.map((e) => (e.type === 'reward' ? e.kind : '')).sort()).toEqual(['coins', 'points']);
  });
});
