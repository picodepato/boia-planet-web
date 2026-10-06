import {
  DEFENSE_CONFIG,
  DEFENSE_TOWER_KINDS,
  buildDefensePath,
} from '@boia/engine/defense';
import { CASTLE_PLACE_ID, WORLD_REGISTRY } from '@boia/world';
import { Box3, Group, Scene } from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DefenseRun } from '../castillo';
import { ROAD_HALF_WIDTH } from '../road';
import { CASTLE_OPEN_SEA_BEARING, marWorld, periodOfWorld } from './compact';
import { fromScene, toScene } from './compress';
import {
  ARENA_ELEVATION,
  ArenaSink,
  BARRIER_MAX_GAP,
  SINK_DEPTH,
  SINK_S,
  SinkOffsets,
  arenaCameraPose,
  arenaFrame,
  barrierLines,
  cornerBuoys,
  islandFootprint,
  islandLevelScale,
  islandScaleFor,
  vortexSpot,
} from './defense-arena';
import { footprintOf, islandTemplate, towerObject, towerScale } from './defense-islands';
import { DefenseView } from './defense-view';

/**
 * La arena de «Defensa del Castillo» (plan 014 T160): dónde cae la partida
 * en el mar (el vórtice hacia el mar abierto, lejos de la Boia 7 y de la
 * carrera), el hundimiento y su vuelta, la cámara alta, las barreras del
 * camino y el tamaño común de las islas construidas (decisión 8).
 */

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const period = periodOfWorld(world);
const byId = (id: string) => world.objects.find((o) => o.identity.id === id)!;
const castle = byId(CASTLE_PLACE_ID);
const path = buildDefensePath(DEFENSE_CONFIG.path, DEFENSE_CONFIG.castle.radius);
const frame = arenaFrame(castle.position, path);

/** Las boias de la carrera por orden (0 = la salida), como en `compact.test.ts`. */
const course = [
  'circuito',
  ...world.objects
    .flatMap((o) =>
      o.behaviors.flatMap((b) =>
        b.type === 'checkpoint' && b.params.order > 0 && o.identity.active
          ? [{ id: o.identity.id, order: b.params.order }]
          : [],
      ),
    )
    .sort((a, b) => a.order - b.order)
    .map((g) => g.id),
].map((id) => byId(id).position);

/** Distancia por el camino corto del planeta de un punto a otro y a un tramo. */
const around = (p: { x: number; y: number }, q: { x: number; y: number }) => {
  let best = Infinity;
  for (const ox of [-period.w, 0, period.w])
    for (const oy of [-period.h, 0, period.h]) best = Math.min(best, Math.hypot(p.x + ox - q.x, p.y + oy - q.y));
  return best;
};
const toLeg = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
  let best = Infinity;
  for (const ox of [-period.w, 0, period.w]) {
    for (const oy of [-period.h, 0, period.h]) {
      const q = { x: p.x + ox, y: p.y + oy };
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(a.x + dx * t - q.x, a.y + dy * t - q.y));
    }
  }
  return best;
};

describe('el vórtice (decisión 5)', () => {
  const v = vortexSpot(frame, path);

  it('está en el principio del camino, en el borde de la arena', () => {
    const start = frame.toWorld(path.start.x, path.start.y);
    expect(v.x).toBeCloseTo(start.x, 6);
    expect(v.y).toBeCloseTo(start.y, 6);
    expect(Math.hypot(v.x - castle.position.x, v.y - castle.position.y)).toBeCloseTo(
      DEFENSE_CONFIG.path.outerRadius,
      3,
    );
    // Y el marco vuelve: del mar a la partida, el mismo punto.
    const back = frame.toSim(v.x, v.y);
    expect(back.x).toBeCloseTo(path.start.x, 6);
    expect(back.y).toBeCloseTo(path.start.y, 6);
  });

  it('cae hacia el mar abierto (`CASTLE_OPEN_SEA_BEARING`)', () => {
    const a = Math.atan2(v.y - castle.position.y, v.x - castle.position.x);
    expect(Math.abs(Math.atan2(Math.sin(a - CASTLE_OPEN_SEA_BEARING), Math.cos(a - CASTLE_OPEN_SEA_BEARING)))).toBeLessThan(1e-9);
  });

  it('lejos de la Boia 7 (más que el castillo del borde de la arena) y fuera de los tramos 6 → 7 y 7 → 8', () => {
    const b7 = course[7]!;
    expect(around(v, b7)).toBeGreaterThan(DEFENSE_CONFIG.path.outerRadius);
    const reach = DEFENSE_CONFIG.vortexRadius * 1.45 + ROAD_HALF_WIDTH;
    expect(toLeg(v, course[6]!, b7)).toBeGreaterThan(reach);
    expect(toLeg(v, b7, course[8]!)).toBeGreaterThan(reach);
  });

  it('se pinta en su sitio y se va al acabar la partida', () => {
    const scene = new Scene();
    const view = new DefenseView({ config: DEFENSE_CONFIG, path, frame, quality: 'baja' });
    scene.add(view.group);
    const mesh = scene.getObjectByName('defense-vortex')!;
    expect(mesh).toBeTruthy();
    expect(fromScene(mesh.position.x)).toBeCloseTo(v.x, 3);
    expect(fromScene(mesh.position.z)).toBeCloseTo(v.y, 3);
    view.dispose();
    expect(scene.getObjectByName('defense-vortex')).toBeUndefined();
    expect(scene.getObjectByName('defense-barrier')).toBeUndefined();
  });
});

describe('el mundo se hunde y vuelve (decisión 4)', () => {
  it('se hunde en `SINK_S` s y vuelve igual; con movimiento reducido, de golpe', () => {
    const sink = new ArenaSink();
    expect(sink.active).toBe(false);
    sink.set(true);
    sink.step(SINK_S / 2, false);
    expect(sink.level).toBeCloseTo(0.5, 6);
    expect(sink.depth).toBeGreaterThan(0);
    expect(sink.under).toBe(false);
    sink.step(SINK_S, false);
    expect(sink.level).toBe(1);
    expect(sink.under).toBe(true);
    expect(sink.depth).toBe(SINK_DEPTH);
    sink.set(false);
    sink.step(SINK_S / 4, false);
    expect(sink.level).toBeCloseTo(0.75, 6);
    sink.step(SINK_S, false);
    expect(sink.level).toBe(0);
    expect(sink.depth).toBe(0);
    expect(sink.active).toBe(false);
    sink.set(true);
    sink.step(0.001, true);
    expect(sink.under).toBe(true);
    sink.set(false);
    sink.step(0.001, true);
    expect(sink.level).toBe(0);
  });

  it('cada pieza baja sin perder su altura y vuelve exacta (se mueva sola o no)', () => {
    const offsets = new SinkOffsets();
    const still = { position: { y: 0.05 } };
    const bobbing = { position: { y: 0 } };
    const frameAt = (t: number, depth: number) => {
      offsets.lift(still);
      offsets.lift(bobbing);
      // La animación de la pieza que se mece pone su altura de nuevo.
      bobbing.position.y = Math.sin(t) * 0.1;
      offsets.sink(still, depth);
      offsets.sink(bobbing, depth);
    };
    for (let i = 0; i <= 10; i++) {
      frameAt(i, i * 4);
      expect(still.position.y).toBeCloseTo(0.05 - i * 4, 9);
      expect(bobbing.position.y).toBeCloseTo(Math.sin(i) * 0.1 - i * 4, 9);
    }
    frameAt(11, 0);
    expect(still.position.y).toBeCloseTo(0.05, 12);
    expect(bobbing.position.y).toBeCloseTo(Math.sin(11) * 0.1, 12);
    expect(offsets.size).toBe(0);
  });
});

describe('la cámara de la arena (decisión 4)', () => {
  const R = toScene(DEFENSE_CONFIG.arenaRadius);
  const fov = 40;
  const t = Math.tan((fov * Math.PI) / 360);

  it('alta y casi cenital, centrada en el castillo; en apaisado cabe la arena entera', () => {
    for (const plane of [
      { x: 0, z: 0 },
      { x: R, z: 0 },
      { x: 0, z: -R },
    ]) {
      const pose = arenaCameraPose({ aspect: 16 / 9, fovDeg: fov, arenaRadius: R, plane });
      expect(pose.elevation).toBe(ARENA_ELEVATION);
      expect(pose.elevation).toBeGreaterThan(1);
      expect(Math.abs(pose.fx)).toBeLessThan(1e-9);
      expect(Math.abs(pose.fz)).toBeLessThan(1e-9);
      expect(pose.distance * t).toBeGreaterThanOrEqual(R);
    }
  });

  it('en vertical, toda la altura y el avión siempre dentro (el foco se corre lo justo)', () => {
    const aspect = 390 / 844;
    for (const plane of [
      { x: R, z: 0 },
      { x: -R, z: 0 },
      { x: R * 0.7, z: R * 0.7 },
      { x: 0, z: 0 },
    ]) {
      const pose = arenaCameraPose({ aspect, fovDeg: fov, arenaRadius: R, plane });
      expect(pose.distance * t).toBeGreaterThanOrEqual(R);
      const halfW = pose.distance * t * aspect;
      expect(Math.abs(plane.x - pose.fx)).toBeLessThanOrEqual(halfW);
      // Nunca más allá del avión ni del castillo.
      expect(Math.abs(pose.fx)).toBeLessThanOrEqual(Math.abs(plane.x) + 1e-9);
    }
  });
});

describe('las barreras flotantes del camino (decisión 5)', () => {
  const lines = barrierLines(path, DEFENSE_CONFIG.castle.radius);
  const half = path.width / 2;

  it('a los dos lados, sin huecos, del vórtice a la muralla', () => {
    for (const side of [lines.left, lines.right]) {
      expect(side.length).toBeGreaterThan(100);
      for (let i = 1; i < side.length; i++) {
        const a = side[i - 1]!;
        const b = side[i]!;
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThanOrEqual(BARRIER_MAX_GAP + 1e-9);
      }
      const first = side[0]!;
      const last = side[side.length - 1]!;
      expect(Math.hypot(first.x - path.start.x, first.y - path.start.y)).toBeLessThan(path.width);
      expect(Math.hypot(last.x - path.end.x, last.y - path.end.y)).toBeLessThan(path.width * 1.5);
    }
  });

  it('nunca en el carril ni en el castillo', () => {
    // Lo de dentro de una esquina viva se corta en recto: roza el borde, no entra (u).
    const slack = 3;
    for (const side of [lines.left, lines.right]) {
      for (const p of side) {
        expect(path.distanceTo(p.x, p.y)).toBeGreaterThanOrEqual(half - slack);
        expect(Math.hypot(p.x, p.y)).toBeGreaterThan(DEFENSE_CONFIG.castle.radius);
      }
    }
  });

  it('las boyas de la carrera sólo en las esquinas vivas, por fuera', () => {
    const buoys = cornerBuoys(path);
    expect(buoys.length).toBe(path.corners.length);
    expect(buoys.length).toBeGreaterThan(0);
    for (const b of buoys) expect(path.distanceTo(b.x, b.y)).toBeGreaterThan(half);
  });
});

describe('las islas construidas, todas de la misma huella (decisión 8)', () => {
  // Los rótulos de algunas islas se pintan en un lienzo: aquí, uno de mentira.
  beforeAll(() => {
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true });
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
    });
  });
  /** Lo que cubre en el agua la isla `kind` a nivel `level`, medido en su malla ya escalada. */
  const measure = (kind: (typeof DEFENSE_TOWER_KINDS)[number], level: number) => {
    const g = new Group();
    const obj = towerObject(kind, { lit: undefined as never, glow: undefined as never });
    obj.scale.setScalar(towerScale(kind, level));
    g.add(obj);
    obj.updateMatrixWorld(true);
    return footprintOf(new Box3().setFromObject(obj));
  };

  it('los siete tipos cubren lo mismo (±5 %) en cada nivel, y es la huella de la regla de construir', () => {
    for (const level of [1, 2, 3]) {
      const want = islandFootprint(DEFENSE_CONFIG, level);
      for (const kind of DEFENSE_TOWER_KINDS) {
        const got = measure(kind, level);
        expect(Math.abs(got - want) / want, `${kind} nivel ${level}`).toBeLessThan(0.05);
      }
    }
    // Nivel 3: el radio de la regla de construir (`islandRadius`, 1/3 del diámetro del castillo).
    expect(islandFootprint(DEFENSE_CONFIG, 3)).toBeCloseTo(toScene(DEFENSE_CONFIG.islandRadius), 9);
  });

  it('+10 % por nivel: el nivel 3 es 1,2 veces el 1; la altura queda libre', () => {
    expect(islandLevelScale(1)).toBe(1);
    expect(islandLevelScale(3) / islandLevelScale(1)).toBeCloseTo(1.2, 9);
    for (const kind of DEFENSE_TOWER_KINDS) {
      expect(measure(kind, 3) / measure(kind, 1)).toBeCloseTo(1.2, 6);
    }
    // Uniforme: Benidorm sigue más alta que Ibiza.
    const top = (k: 'fotos' | 'tienda') => islandTemplate(k).top * towerScale(k, 1);
    expect(top('fotos')).toBeGreaterThan(top('tienda'));
  });

  it('la misma regla con el radio del manifiesto de un modelo de Blender', () => {
    for (const radius of [1, 3.7, 12]) {
      for (const level of [1, 2, 3]) {
        expect(radius * islandScaleFor(radius, level, DEFENSE_CONFIG)).toBeCloseTo(
          islandFootprint(DEFENSE_CONFIG, level),
          9,
        );
      }
    }
  });
});

describe('la vista de la partida', () => {
  beforeAll(() => {
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true });
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
    });
  });

  /** Juega `seconds` s pintando cada 5 pasos; con `chase`, el avión va hacia el vórtice. */
  const play = (run: DefenseRun, view: DefenseView, seconds: number, chase: boolean) => {
    const seen = new Set<string>();
    const kinds = new Set<string>();
    let most = 0;
    for (let i = 0; i < 60 * seconds; i++) {
      const pl = run.snapshot().plane;
      const dx = path.start.x - pl.x;
      const dy = path.start.y - pl.y;
      const d = Math.hypot(dx, dy);
      run.step(chase && d > 250 ? { x: dx / d, y: dy / d } : null);
      if (i % 5 === 0) {
        view.update(run.snapshot(), i / 60, { x: 0, z: 0 });
        for (const [k, n] of Object.entries(view.fx.drawn)) if (n > 0) seen.add(k);
        for (const k of view.drawnKinds()) kinds.add(k);
        most = Math.max(most, view.drawn);
      }
    }
    return { seen, kinds, most };
  };

  it('pinta los enemigos por el camino, las siete islas con su marca y sus efectos', () => {
    const run = new DefenseRun({ seed: 7, quality: 'baja', devIslands: true, startAtS: 150 });
    const view = new DefenseView({ config: DEFENSE_CONFIG, path, frame, quality: 'baja' });
    const { seen, kinds, most } = play(run, view, 90, false);
    expect(most).toBeGreaterThan(0);
    expect(kinds.size).toBeGreaterThan(1);
    expect(view.islands.count).toBe(DEFENSE_TOWER_KINDS.length);
    expect(view.islands.kinds()).toEqual(
      Object.fromEntries(DEFENSE_TOWER_KINDS.map((k) => [k, 1])),
    );
    // Cada isla a nivel 3, a su escala; y sus efectos (el haz del Faro, la granja de Ibiza…).
    for (const t of run.snapshot().towers)
      expect(view.islands.scaleOf(t.id)).toBeCloseTo(towerScale(t.kind, 3), 9);
    for (const k of ['haz', 'monedas']) expect(seen, k).toContain(k);
    expect(seen.size).toBeGreaterThanOrEqual(6);
    view.dispose();
  });

  it('las balas del avión', () => {
    const run = new DefenseRun({ seed: 7, quality: 'alta' });
    const view = new DefenseView({ config: DEFENSE_CONFIG, path, frame });
    expect(play(run, view, 20, true).seen).toContain('balas');
    view.dispose();
  });
});
