import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import {
  DOLPHIN_TUNING,
  type DolphinAction,
  DolphinGuide,
  findDolphinGuide,
  inOpenSea,
  undiscoveredTarget,
} from './encounters';

/**
 * El delfín guía (O15, REQ-AVE-018): aparece junto al barco cada 2–4 minutos
 * de mar abierto, avanza a saltos hacia algo sin descubrir y se va; seguirlo
 * hasta el final da premio.
 */

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
const DT = 0.25;

/** Corre el delfín `seconds` segundos; el barco lo sigue si `follow`. */
function run(
  guide: DolphinGuide,
  seconds: number,
  opts: { openSea?: boolean; follow?: boolean; ship?: { x: number; y: number } } = {},
) {
  const ship = { x: 0, y: 0, heading: 0, ...opts.ship };
  const target = { id: 'secreto-prueba', x: 1500, y: 0 };
  const out: { t: number; action: DolphinAction }[] = [];
  for (let t = 0; t < seconds; t += DT) {
    if (opts.follow && guide.active) {
      const p = guide.position;
      ship.x = p.x - 40;
      ship.y = p.y;
    }
    for (const action of guide.step(DT, ship, { openSea: opts.openSea ?? true, target })) {
      out.push({ t, action });
    }
  }
  return out;
}

describe('el delfín guía', () => {
  it('el mapa tiene su delfín, fuera del minimapa y de la brújula', () => {
    const o = world.objects.find((x) => x.identity.category === 'delfin')!;
    expect(o.identity.tags).toContain('oculto');
    expect(findDolphinGuide(world.objects)?.objectId).toBe(o.identity.id);
  });

  it('aparece junto al barco entre 2 y 4 minutos de mar abierto, nunca antes', () => {
    for (const r of [0, 0.5, 0.999]) {
      const guide = new DolphinGuide(
        world.objects.find((x) => x.identity.id === 'delfin')!,
        {
          random: () => r,
        },
      );
      const wait =
        DOLPHIN_TUNING.minInterval + (DOLPHIN_TUNING.maxInterval - DOLPHIN_TUNING.minInterval) * r;
      expect(guide.untilNext).toBeCloseTo(wait, 5);
      const first = run(guide, DOLPHIN_TUNING.maxInterval + 1).find(
        (a) => a.action.type === 'place',
      );
      expect(first!.t).toBeGreaterThanOrEqual(DOLPHIN_TUNING.minInterval - DT);
      expect(first!.t).toBeLessThanOrEqual(DOLPHIN_TUNING.maxInterval);
      const p = first!.action as { x: number; y: number };
      // Al costado del barco, no en su sitio de descanso.
      expect(Math.hypot(p.x, p.y)).toBeLessThan(200);
    }
  });

  it('fuera del mar abierto el reloj no corre', () => {
    const guide = new DolphinGuide(
      world.objects.find((x) => x.identity.id === 'delfin')!,
      {
        random: () => 0,
      },
    );
    expect(run(guide, 600, { openSea: false })).toEqual([]);
    expect(guide.untilNext).toBe(DOLPHIN_TUNING.minInterval);
  });

  it('avanza a saltos hacia el objetivo, se sumerge entre saltos y se va', () => {
    const guide = new DolphinGuide(
      world.objects.find((x) => x.identity.id === 'delfin')!,
      {
        random: () => 0,
        tuning: { minInterval: 1, maxInterval: 1 },
      },
    );
    const all = run(guide, 30).map((a) => a.action);
    // Una salida: hasta que se va.
    const actions = all.slice(0, all.findIndex((a) => a.type === 'gone') + 1);
    const surfaces = actions.filter((a) => a.type === 'surface').length;
    expect(surfaces).toBe(DOLPHIN_TUNING.hops);
    const places = actions.filter(
      (a): a is Extract<DolphinAction, { type: 'place' }> => a.type === 'place',
    );
    // Cada salto, más cerca del objetivo (x = 1500).
    const hopsX = places.slice(0, DOLPHIN_TUNING.hops).map((p) => p.x);
    for (let i = 1; i < hopsX.length; i++) expect(hopsX[i]!).toBeGreaterThan(hopsX[i - 1]!);
    const gone = actions.find((a) => a.type === 'gone');
    expect(gone).toMatchObject({ type: 'gone', followed: false, targetId: 'secreto-prueba' });
    // Se sumerge, vuelve a su sitio de descanso y espera otra vez.
    expect(actions.at(-3)).toEqual({ type: 'dive' });
    expect(places.at(-1)).toMatchObject(guide.home);
  });

  it('seguirlo hasta el final cuenta como seguido', () => {
    const guide = new DolphinGuide(
      world.objects.find((x) => x.identity.id === 'delfin')!,
      {
        random: () => 0,
        tuning: { minInterval: 1, maxInterval: 1 },
      },
    );
    const gone = run(guide, 30, { follow: true }).find((a) => a.action.type === 'gone');
    expect(gone?.action).toMatchObject({ followed: true });
  });

  it('guía hacia lo más cercano sin descubrir y sólo en mar abierto', () => {
    const spawn = world.spawn!;
    const t = undiscoveredTarget(world.objects, new Set(), spawn)!;
    expect(t).not.toBeNull();
    const again = undiscoveredTarget(world.objects, new Set([t.id]), spawn)!;
    expect(again.id).not.toBe(t.id);
    // Junto a una isla no es mar abierto; lejos de todo, sí.
    const cala = world.objects.find((o) => o.identity.id === 'cala')!;
    expect(inOpenSea(world.objects, cala.position)).toBe(false);
    expect(inOpenSea(world.objects, { x: cala.position.x - 700, y: cala.position.y + 900 })).toBe(
      true,
    );
  });
});
