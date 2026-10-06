import { describe, expect, it } from 'vitest';
import { SURVIVORS_CONFIG } from '../survivors/config';
import { chasePlaneBot, idlePlaneBot } from './bots';
import {
  DEFENSE_CONFIG,
  DEFENSE_CONFIG_VERSION,
  DEFENSE_DIFFICULTY_IDS,
  DEFENSE_PLANE_MAX_LEVEL,
  DEFENSE_RUN_MINS,
  DEFENSE_STEP_S,
  DEFENSE_TOWER_KINDS,
  type DefenseConfig,
  type DefenseEnemyKind,
  asDefenseRunMin,
  defenseCastleMaxLife,
  defenseCastleMaxLives,
  defenseClampToArena,
  defenseConfigHash,
  defenseEnemyDef,
  defenseTowerStats,
} from './config';
import { defenseSiteReason } from './build';
import { DefenseClock } from './clock';
import { defenseMedal, defenseScore } from './medals';
import { buildDefensePath } from './path';
import { type DefenseEvent, type DefenseGame, type DefenseOptions, createDefense } from './sim';
import type { DefenseTowerHooks } from './towers';
import { defenseSchedule, defenseWaveStarts } from './waves';

/**
 * «Defensa del Castillo» (plan 014 T158): el camino, las oleadas, el
 * castillo, el avión, las monedas, las medallas y la puntuación. Las cifras
 * se leen de la configuración, nunca a mano.
 */

const CFG = DEFENSE_CONFIG;
const PATH = buildDefensePath(CFG.path, CFG.castle.radius);
const stepsFor = (s: number) => Math.round(s / DEFENSE_STEP_S);

/** Una copia de la configuración con `patch` aplicado. */
function withConfig(patch: (c: DefenseConfig) => void): DefenseConfig {
  const c = structuredClone(CFG);
  patch(c);
  return c;
}

/** Sin oleadas ni bosses: sólo lo que pongan las pruebas. */
function emptyRuns(c: DefenseConfig): void {
  c.waves.mix = [];
  for (const m of DEFENSE_RUN_MINS) c.runs[m].bosses = [];
}

/** Sólo un enemigo de `kind` (común) a los `firstAtS` s. */
function single(
  kind: 'pirate' | 'piranha' | 'crab',
  patch?: (c: DefenseConfig) => void,
): DefenseConfig {
  return withConfig((c) => {
    emptyRuns(c);
    c.waves.mix = [{ kind, fromFrac: 0, weight: 1 }];
    c.waves.baseCount = 1;
    c.waves.countPerWave = 0;
    c.waves.everyS = 1e6;
    patch?.(c);
  });
}

function run(
  g: DefenseGame,
  maxS: number,
  onEvent?: (e: DefenseEvent, t: number) => void,
  input = {},
): void {
  for (let i = 0; i < stepsFor(maxS) && !g.ended; i++) {
    const evs = g.step(input);
    if (onEvent) for (const e of evs) onEvent(e, g.activeS);
  }
}

/** Distancia entre los segmentos pq y rs. */
function segDist(
  p: { x: number; y: number },
  q: { x: number; y: number },
  r: { x: number; y: number },
  s: { x: number; y: number },
): number {
  const ptSeg = (a: typeof p, b: typeof p, c: typeof p) => {
    const dx = c.x - b.x;
    const dy = c.y - b.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.min(1, Math.max(0, ((a.x - b.x) * dx + (a.y - b.y) * dy) / l2)) : 0;
    return Math.hypot(a.x - (b.x + dx * t), a.y - (b.y + dy * t));
  };
  const cross = (a: typeof p, b: typeof p, c: typeof p) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = cross(r, s, p);
  const d2 = cross(r, s, q);
  const d3 = cross(p, q, r);
  const d4 = cross(p, q, s);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  return Math.min(ptSeg(p, r, s), ptSeg(q, r, s), ptSeg(r, p, q), ptSeg(s, p, q));
}

describe('config', () => {
  it('versionada, con huella estable y las duraciones y dificultades del plan', () => {
    expect(CFG.version).toBe(DEFENSE_CONFIG_VERSION);
    expect(defenseConfigHash()).toBe(defenseConfigHash(structuredClone(CFG)));
    expect(defenseConfigHash(withConfig((c) => (c.startCoins += 1)))).not.toBe(defenseConfigHash());
    expect(DEFENSE_RUN_MINS.map((m) => CFG.runs[m].durationS)).toEqual(
      DEFENSE_RUN_MINS.map((m) => m * 60),
    );
    expect(DEFENSE_DIFFICULTY_IDS).toEqual(['tranquila', 'normal', 'tormenta']);
    expect(asDefenseRunMin('7')).toBe(7);
    expect(asDefenseRunMin(6)).toBeNull();
  });

  it('los enemigos y bosses son los del Cañón (mismos ids)', () => {
    for (const k of Object.keys(CFG.enemies)) expect(SURVIVORS_CONFIG.enemies).toHaveProperty(k);
    for (const k of Object.keys(CFG.bosses)) expect(SURVIVORS_CONFIG.bosses).toHaveProperty(k);
    expect(Object.keys(CFG.enemies).sort()).toEqual(Object.keys(SURVIVORS_CONFIG.enemies).sort());
  });

  it('la huella de una isla es cerca de 1/3 del diámetro del castillo (decisión 8)', () => {
    const ratio = (2 * CFG.islandRadius) / (2 * CFG.castle.radius);
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(0.37);
  });
});

describe('el camino', () => {
  it('empieza en el vórtice, en el borde de la arena, y acaba en la muralla', () => {
    const a = CFG.path.startAngleRad;
    expect(PATH.start.x).toBeCloseTo(Math.cos(a) * CFG.path.outerRadius, 6);
    expect(PATH.start.y).toBeCloseTo(Math.sin(a) * CFG.path.outerRadius, 6);
    expect(Math.hypot(PATH.end.x, PATH.end.y)).toBeCloseTo(CFG.castle.radius, 6);
    const startR = Math.hypot(PATH.start.x, PATH.start.y);
    expect(startR + CFG.vortexRadius).toBeLessThanOrEqual(CFG.arenaRadius);
    expect(startR).toBeGreaterThan(CFG.arenaRadius * 0.8);
    // Todo el carril dentro de la arena y fuera del castillo (salvo la llegada).
    for (let i = 0; i < PATH.points.length; i++) {
      const r = Math.hypot(PATH.points[i]!.x, PATH.points[i]!.y);
      expect(r + CFG.path.width / 2).toBeLessThanOrEqual(CFG.arenaRadius);
      expect(r).toBeGreaterThanOrEqual(CFG.castle.radius - 1e-6);
    }
  });

  it('se muestrea por distancia: puntos a la distancia pedida, rumbo y normal unitarios', () => {
    const s0 = PATH.sampleAt(0);
    expect(s0.x).toBeCloseTo(PATH.start.x, 6);
    const sEnd = PATH.sampleAt(PATH.length + 500);
    expect(sEnd.x).toBeCloseTo(PATH.end.x, 6);
    expect(sEnd.y).toBeCloseTo(PATH.end.y, 6);
    let prev = PATH.sampleAt(0);
    for (let d = 10; d <= PATH.length; d += 10) {
      const s = PATH.sampleAt(d);
      const chord = Math.hypot(s.x - prev.x, s.y - prev.y);
      expect(chord).toBeLessThanOrEqual(10 + 1e-6);
      expect(chord).toBeGreaterThan(5); // sólo las esquinas lo acortan
      expect(Math.hypot(s.nx, s.ny)).toBeCloseTo(1, 6);
      expect(s.nx * Math.cos(s.heading) + s.ny * Math.sin(s.heading)).toBeCloseTo(0, 6);
      expect(PATH.distanceTo(s.x, s.y)).toBeLessThan(1e-6);
      prev = s;
    }
    expect(PATH.cum[PATH.cum.length - 1]).toBe(PATH.length);
  });

  it('no se cruza consigo mismo', () => {
    const pts = PATH.points;
    for (let i = 0; i < pts.length - 1; i++)
      for (let j = i + 2; j < pts.length - 1; j++) {
        expect(segDist(pts[i]!, pts[i + 1]!, pts[j]!, pts[j + 1]!)).toBeGreaterThan(0);
      }
  });

  it('entre dos pasadas del carril cabe siempre una isla', () => {
    // Una isla con su agua libre a los dos lados: el carril más su huella.
    const need = CFG.path.width + 2 * (CFG.islandRadius + CFG.towers.pathClearance);
    let min = Infinity;
    let pairs = 0;
    const pts = PATH.points;
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        // Lo bastante lejos por el camino para ser otra pasada (no la misma curva).
        if (PATH.cum[j]! - PATH.cum[i]! < 2 * need) continue;
        pairs++;
        min = Math.min(min, Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y));
      }
    expect(pairs).toBeGreaterThan(0);
    expect(min).toBeGreaterThanOrEqual(need);
  });

  it('más largo que el de la espiral: más de vuelta y media del círculo del vórtice', () => {
    expect(PATH.length).toBeGreaterThan(1.5 * 2 * Math.PI * CFG.path.outerRadius);
    // Un enemigo normal sigue tardando unos 40 s (decisión 5 del plan 014): va más deprisa.
    expect(CFG.path.normalWalkS).toBeGreaterThanOrEqual(35);
    expect(CFG.path.normalWalkS).toBeLessThanOrEqual(45);
  });

  /** Las islas de ataque, ordenadas por alcance a nivel 1: la de en medio. */
  const midRange = (() => {
    const ranges = DEFENSE_TOWER_KINDS.filter((k) => k !== 'tienda')
      .map((k) => defenseTowerStats(CFG, k, 1).range)
      .sort((a, b) => a - b);
    return ranges[Math.floor(ranges.length / 2)]!;
  })();
  /** Las muestras del camino (cada 5 u) entre dos distancias. */
  const samplesBetween = (from: number, to: number) => {
    const out: { x: number; y: number }[] = [];
    for (let d = Math.max(0, from); d <= Math.min(PATH.length, to); d += 5)
      out.push(PATH.sampleAt(d));
    return out;
  };
  /** u de un tramo (muestras) que quedan al alcance `r` de (x, y). */
  const covered = (pts: readonly { x: number; y: number }[], x: number, y: number, r: number) =>
    pts.filter((p) => Math.hypot(p.x - x, p.y - y) <= r).length * 5;

  it('curvas en U marcadas: dentro de cada una cabe una isla que alcanza los dos lados', () => {
    const us = PATH.uTurns;
    expect(us.length).toBe(CFG.path.legs.filter((l) => l.kind === 'u').length);
    expect(us.length).toBeGreaterThanOrEqual(4);
    for (const u of us) {
      // Media vuelta de verdad (más cerrada que las eses de antes): su radio, el de la U.
      expect(u.radius).toBeLessThan(CFG.path.width / 2 + CFG.islandRadius * 2 + 20);
      // La isla, en el centro de la media vuelta: el sitio vale.
      expect(defenseSiteReason(CFG, PATH, [], u.x, u.y)).toBeNull();
      // Y una isla de alcance medio cubre buena parte de los dos lados rectos.
      const half = (Math.PI * u.radius) / 2;
      const legIn = samplesBetween(u.distance - half - u.depth, u.distance - half);
      const legOut = samplesBetween(u.distance + half, u.distance + half + u.depth);
      expect(covered(legIn, u.x, u.y, midRange)).toBeGreaterThanOrEqual(u.depth / 2);
      expect(covered(legOut, u.x, u.y, midRange)).toBeGreaterThanOrEqual(u.depth / 2);
      // Hacia el castillo: su fondo, a menos de la mitad que el vórtice.
      expect(Math.hypot(u.x, u.y) - u.radius).toBeLessThan(CFG.path.outerRadius / 2);
    }
    // Entre dos U seguidas, otra U al revés (abierta al castillo): también cabe una isla
    // que alcanza sus dos lados.
    for (let i = 0; i + 1 < us.length; i++) {
      const a = us[i]!;
      const b = us[i + 1]!;
      const legA = samplesBetween(
        a.distance + (Math.PI * a.radius) / 2,
        a.distance + (Math.PI * a.radius) / 2 + a.depth,
      );
      const legB = samplesBetween(
        b.distance - (Math.PI * b.radius) / 2 - b.depth,
        b.distance - (Math.PI * b.radius) / 2,
      );
      const mid = Math.atan2(a.y + b.y, a.x + b.x);
      let ok = false;
      for (let r = CFG.castle.radius; r <= CFG.arenaRadius && !ok; r += 10) {
        const x = Math.cos(mid) * r;
        const y = Math.sin(mid) * r;
        if (defenseSiteReason(CFG, PATH, [], x, y) !== null) continue;
        // Es más ancha que la U de dentro: basta con una buena parte de cada lado.
        ok =
          covered(legA, x, y, midRange) >= a.depth / 3 &&
          covered(legB, x, y, midRange) >= b.depth / 3;
      }
      expect(ok, `entre la U ${i} y la ${i + 1}`).toBe(true);
    }
  });

  it('el zigzag tiene tramos largos y en cada ángulo cabe una isla', () => {
    const zi = CFG.path.legs.findIndex((l) => l.kind === 'zigzag');
    const zig = CFG.path.legs[zi]!;
    if (zig.kind !== 'zigzag') throw new Error('sin zigzag');
    const minPath = CFG.path.width / 2 + CFG.islandRadius + CFG.towers.pathClearance;
    // Tramos donde cabe una isla a lo largo.
    expect(zig.legLength).toBeGreaterThanOrEqual(2 * minPath - CFG.path.width);
    const inner = PATH.corners.filter((c) => {
      const i = PATH.cum.indexOf(c.distance);
      return PATH.legOf[i] === zi && PATH.legOf[i - 1] === zi && PATH.legOf[i + 1] === zi;
    });
    expect(inner.length).toBe(zig.legs);
    for (const c of inner) {
      const i = PATH.cum.indexOf(c.distance);
      const p = PATH.points[i - 1]!;
      const q = PATH.points[i]!;
      const r = PATH.points[i + 1]!;
      const inL = Math.hypot(q.x - p.x, q.y - p.y);
      const outL = Math.hypot(r.x - q.x, r.y - q.y);
      // Por dentro del ángulo: entre el tramo que entra (al revés) y el que sale.
      let bx = (p.x - q.x) / inL + (r.x - q.x) / outL;
      let by = (p.y - q.y) / inL + (r.y - q.y) / outL;
      const bl = Math.hypot(bx, by);
      bx /= bl;
      by /= bl;
      const legs = samplesBetween(c.distance - zig.legLength / 2, c.distance + zig.legLength / 2);
      let ok = false;
      for (let d = minPath; d <= 2 * zig.legLength && !ok; d += 5) {
        const x = q.x + bx * d;
        const y = q.y + by * d;
        if (defenseSiteReason(CFG, PATH, [], x, y) !== null) continue;
        ok = covered(legs, x, y, midRange) >= zig.legLength * 0.75;
      }
      expect(ok, `esquina en ${Math.round(c.distance)}`).toBe(true);
    }
  });
});

describe('enemigos por el camino', () => {
  it('cada uno avanza a su velocidad y al llegar quita vida al castillo y desaparece', () => {
    for (const kind of ['pirate', 'piranha', 'crab'] as const) {
      // Aguantón: que el avión no lo pare.
      const cfg = single(kind, (c) => (c.enemies[kind].hp = 1e9));
      const def = cfg.enemies[kind];
      const g = createDefense(cfg, 3);
      let spawnAt = -1;
      let hitAt = -1;
      let hit: Extract<DefenseEvent, { type: 'castleHit' }> | null = null;
      run(g, 200, (e, t) => {
        if (e.type === 'spawn') spawnAt = t;
        if (e.type === 'castleHit') {
          hitAt = t;
          hit = e;
        }
      });
      expect(spawnAt).toBeCloseTo(cfg.waves.firstAtS, 1);
      const expected = cfg.path.normalWalkS / def.pace;
      expect(Math.abs(hitAt - spawnAt - expected)).toBeLessThanOrEqual(2 * DEFENSE_STEP_S);
      expect(hit!.damage).toBe(def.castleDamage * cfg.difficulties.normal.castleDamage);
      expect(g.life).toBe(cfg.castle.life - def.castleDamage);
      expect(g.snapshot().enemies).toHaveLength(0);
    }
  });

  it('se quedan en su carril y siguen el camino', () => {
    const g = createDefense(CFG, 11, { difficulty: 'tormenta' });
    for (let i = 0; i < stepsFor(90); i++) {
      g.step();
      if (i % 30 !== 0) continue; // cada medio segundo basta
      for (const e of g.snapshot().enemies) {
        expect(PATH.distanceTo(e.x, e.y)).toBeLessThanOrEqual(Math.abs(e.laneOffset) + 1e-6);
        expect(Math.abs(e.laneOffset) + e.radius).toBeLessThanOrEqual(
          Math.max(e.radius, CFG.path.width / 2) + 1e-6,
        );
      }
    }
  });

  it('la dificultad sube el daño al castillo', () => {
    const cfg = single('pirate', (c) => (c.enemies.pirate.hp = 1e9));
    const lost = (difficulty: 'tranquila' | 'tormenta') => {
      const g = createDefense(cfg, 3, { difficulty });
      run(g, 100);
      return cfg.castle.life - g.life;
    };
    expect(lost('tranquila')).toBeCloseTo(
      cfg.enemies.pirate.castleDamage * cfg.difficulties.tranquila.castleDamage,
      6,
    );
    expect(lost('tormenta')).toBeCloseTo(
      cfg.enemies.pirate.castleDamage * cfg.difficulties.tormenta.castleDamage,
      6,
    );
  });
});

describe('oleadas', () => {
  it('más enemigos en las partidas largas y en las difíciles; siempre las mismas', () => {
    for (const d of DEFENSE_DIFFICULTY_IDS) {
      const n = DEFENSE_RUN_MINS.map((m) => defenseSchedule(CFG, m, d).length);
      expect(n[0]!).toBeLessThan(n[1]!);
      expect(n[1]!).toBeLessThan(n[2]!);
      for (const m of DEFENSE_RUN_MINS)
        expect(defenseSchedule(CFG, m, d)).toEqual(defenseSchedule(CFG, m, d));
    }
    for (const m of DEFENSE_RUN_MINS) {
      const n = DEFENSE_DIFFICULTY_IDS.map((d) => defenseSchedule(CFG, m, d).length);
      expect(n[0]!).toBeLessThan(n[1]!);
      expect(n[1]!).toBeLessThan(n[2]!);
    }
  });

  it('salen los tipos del Cañón y sus bosses, el gordo cerca del final', () => {
    for (const m of DEFENSE_RUN_MINS) {
      const sch = defenseSchedule(CFG, m, 'normal');
      const dur = CFG.runs[m].durationS;
      const kinds = new Set(sch.filter((s) => !s.boss).map((s) => s.kind));
      for (const mix of CFG.waves.mix) expect(kinds).toContain(mix.kind);
      const bosses = sch.filter((s) => s.boss);
      expect(bosses.map((b) => b.kind)).toEqual(CFG.runs[m].bosses.map((b) => b.kind));
      for (const b of bosses) expect(SURVIVORS_CONFIG.bosses).toHaveProperty(b.kind);
      const last = bosses[bosses.length - 1]!;
      expect(defenseEnemyDef(CFG, last.kind)!.tier).toBe('boss');
      expect(last.atS).toBeGreaterThanOrEqual(dur * 0.7);
      for (let i = 1; i < sch.length; i++)
        expect(sch[i]!.atS).toBeGreaterThanOrEqual(sch[i - 1]!.atS);
      expect(sch[sch.length - 1]!.atS).toBeLessThan(dur);
    }
  });

  it('los bosses sólo siguen el camino, con mucho más aguante y más daño al castillo', () => {
    const commons = Object.values(CFG.enemies);
    const maxHp = Math.max(...commons.map((e) => e.hp));
    const maxDmg = Math.max(...commons.map((e) => e.castleDamage));
    for (const b of Object.values(CFG.bosses)) {
      expect(b!.hp).toBeGreaterThan(maxHp * 5);
      expect(b!.castleDamage).toBeGreaterThan(maxDmg * 2);
      expect(b!.coins).toBeGreaterThan(Math.max(...commons.map((e) => e.coins)));
    }
  });
});

describe('el castillo: perder y ganar', () => {
  it('cae cuando su vida llega a 0', () => {
    const cfg = withConfig((c) => (c.castle.life = 10));
    const g = createDefense(cfg, 5);
    let ended: string | null = null;
    run(g, 300, (e) => {
      if (e.type === 'end') ended = e.reason;
    });
    expect(ended).toBe('fallen');
    expect(g.life).toBe(0);
    expect(g.result()!.medal).toBeNull(); // antes de la mitad
  });

  it('aguantar 5, 7 o 10 min gana en el segundo justo', () => {
    const cfg = withConfig(emptyRuns);
    for (const m of DEFENSE_RUN_MINS) {
      const g = createDefense(cfg, 1, { runMin: m });
      run(g, m * 60 + 5);
      const r = g.result()!;
      expect(r.end).toBe('held');
      expect(r.playedS).toBeCloseTo(m * 60, 6);
      expect(r.runMin).toBe(m);
      expect(r.medal).toBe('oro');
      expect(r.ranked).toBe(true);
    }
  });

  it('una partida sin torres se pierde en Normal (avión quieto o persiguiendo)', () => {
    for (const bot of [idlePlaneBot, chasePlaneBot]) {
      const g = createDefense(CFG, 21, { difficulty: 'normal', runMin: 5 });
      while (!g.ended) g.step(bot(g.snapshot()));
      expect(g.end).toBe('fallen');
    }
  });
});

describe('el avión', () => {
  /** Un pirata aguantón y casi quieto; el avión vuela hasta el vórtice y le dispara. */
  function target(patch?: (c: DefenseConfig) => void) {
    return single('pirate', (c) => {
      c.enemies.pirate.hp = 1e6;
      c.enemies.pirate.pace = 0.01;
      c.startCoins = 10_000;
      patch?.(c);
    });
  }

  it('vuela libre dentro de la arena', () => {
    const g = createDefense(withConfig(emptyRuns), 1);
    run(g, 20, undefined, { move: { x: 1, y: 1 } });
    const p = g.snapshot().plane;
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(CFG.arenaRadius, 3);
    expect(Math.hypot(p.vx, p.vy)).toBeLessThanOrEqual(CFG.plane.maxSpeed + 1e-6);
    run(g, 2, undefined, { move: { x: -1, y: 0 } });
    expect(g.snapshot().plane.vx).toBeCloseTo(-CFG.plane.maxSpeed, 6);
  });

  it('vuela hasta el punto pedido y se para; fuera de la arena, hasta su borde', () => {
    const g = createDefense(withConfig(emptyRuns), 1);
    const to = { x: -300, y: 450 };
    g.step({ moveTo: to });
    expect(g.snapshot().plane.target).toEqual(to);
    run(g, 10);
    let p = g.snapshot().plane;
    expect(Math.hypot(p.x - to.x, p.y - to.y)).toBeLessThanOrEqual(CFG.plane.arriveRadius + 1);
    expect(Math.hypot(p.vx, p.vy)).toBeLessThan(1);
    expect(p.target).toBeNull();
    // Un punto fuera de la arena se acota a su borde, y el avión nunca sale.
    const far = { x: 0, y: -5 * CFG.arenaRadius };
    g.step({ moveTo: far });
    expect(g.snapshot().plane.target).toEqual(defenseClampToArena(CFG, far.x, far.y));
    expect(Math.hypot(g.snapshot().plane.target!.x, g.snapshot().plane.target!.y)).toBeCloseTo(
      CFG.arenaRadius,
      6,
    );
    for (let i = 0; i < stepsFor(10); i++) {
      g.step();
      p = g.snapshot().plane;
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(CFG.arenaRadius + 1e-6);
    }
    expect(Math.hypot(p.x, p.y)).toBeGreaterThan(CFG.arenaRadius - CFG.plane.arriveRadius - 1);
    // El mando que empuja cancela el punto; null también.
    g.step({ moveTo: { x: 0, y: 0 } });
    g.step({ move: { x: 1, y: 0 } });
    expect(g.snapshot().plane.target).toBeNull();
    g.step({ moveTo: { x: 0, y: 0 } });
    g.step({ moveTo: null });
    expect(g.snapshot().plane.target).toBeNull();
  });

  it('dispara solo al más cercano a su alcance, con el daño de su nivel (1…5)', () => {
    const cfg = target();
    const g = createDefense(cfg, 2);
    // Al vórtice: ahí sale el pirata.
    const to = { x: PATH.start.x, y: PATH.start.y };
    for (let i = 0; i < stepsFor(4); i++) {
      const p = g.snapshot().plane;
      const d = Math.hypot(to.x - p.x, to.y - p.y);
      g.step(d > 20 ? { move: { x: (to.x - p.x) / d, y: (to.y - p.y) / d } } : {});
    }
    const damages: number[] = [];
    for (let level = 1; level <= DEFENSE_PLANE_MAX_LEVEL; level++) {
      if (level > 1) {
        const before = g.purse;
        expect(g.upgradePlane('damage')).toBe(true);
        expect(before - g.purse).toBe(cfg.plane.damageCost[level - 2]);
      }
      expect(g.snapshot().plane.damageLevel).toBe(level);
      expect(g.snapshot().plane.speedLevel).toBe(1);
      const e = () => g.snapshot().enemies[0];
      // Espera un golpe.
      let hp = e()?.hp ?? 0;
      let hits = 0;
      let shots = 0;
      for (let i = 0; i < stepsFor(3) && hits === 0; i++) {
        for (const ev of g.step()) if (ev.type === 'planeShot') shots++;
        const now = e()?.hp ?? hp;
        if (now < hp) {
          damages.push(hp - now);
          hits++;
        }
        hp = now;
      }
      expect(shots).toBeGreaterThan(0);
      expect(hits).toBe(1);
    }
    expect(damages).toEqual([...cfg.plane.damage]);
    expect(cfg.plane.damage).toHaveLength(DEFENSE_PLANE_MAX_LEVEL);
    for (let i = 1; i < damages.length; i++) expect(damages[i]!).toBeGreaterThan(damages[i - 1]!);
    expect(g.upgradePlane('damage')).toBe(false); // ya en el 5
    expect(g.snapshot().plane.nextDamageCost).toBeNull();
    expect(g.snapshot().plane.nextSpeedCost).toBe(cfg.plane.speedCost[0]);
  });

  it('la velocidad de ataque sube del 1 al 5: menos tiempo entre disparos, cada nivel con su precio', () => {
    const cfg = target();
    const g = createDefense(cfg, 2);
    const to = { x: PATH.start.x, y: PATH.start.y };
    for (let i = 0; i < stepsFor(4); i++) {
      const p = g.snapshot().plane;
      const d = Math.hypot(to.x - p.x, to.y - p.y);
      g.step(d > 20 ? { move: { x: (to.x - p.x) / d, y: (to.y - p.y) / d } } : {});
    }
    const gaps: number[] = [];
    for (let level = 1; level <= DEFENSE_PLANE_MAX_LEVEL; level++) {
      if (level > 1) {
        const before = g.purse;
        const evs = [...g.step({ upgradePlane: 'speed' })];
        expect(evs).toContainEqual({
          type: 'planeUpgrade',
          stat: 'speed',
          level,
          cost: cfg.plane.speedCost[level - 2],
        });
        expect(before - g.purse).toBe(cfg.plane.speedCost[level - 2]);
      }
      const p = g.snapshot().plane;
      expect(p.speedLevel).toBe(level);
      expect(p.cooldownS).toBe(cfg.plane.cooldownS[level - 1]);
      // Dos disparos seguidos: los separa su enfriamiento.
      const at: number[] = [];
      for (let i = 0; i < stepsFor(3) && at.length < 3; i++)
        for (const ev of g.step()) if (ev.type === 'planeShot') at.push(g.activeS);
      expect(at.length).toBe(3);
      gaps.push(at[2]! - at[1]!);
    }
    for (let i = 0; i < gaps.length; i++)
      expect(Math.abs(gaps[i]! - cfg.plane.cooldownS[i]!)).toBeLessThanOrEqual(
        DEFENSE_STEP_S + 1e-9,
      );
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]!).toBeLessThan(gaps[i - 1]!);
    expect(g.upgradePlane('speed')).toBe(false);
    expect(g.snapshot().plane.nextSpeedCost).toBeNull();
  });

  it('no dispara a lo que está fuera de alcance; no sube sin dinero', () => {
    const cfg = target((c) => (c.startCoins = 0));
    const g = createDefense(cfg, 2);
    let shots = 0;
    run(g, 10, (e) => {
      if (e.type === 'planeShot') shots++;
    });
    expect(shots).toBe(0); // el pirata sigue lejos (vuelta de fuera)
    expect(g.upgradePlane('damage')).toBe(false);
    expect(g.upgradePlane('speed')).toBe(false);
    expect(g.upgradeCastle()).toBe(false);
    expect(g.snapshot().plane).toMatchObject({ damageLevel: 1, speedLevel: 1 });
    expect(g.snapshot().castle.level).toBe(1);
  });

  it('cada caída da sus monedas al monedero y sus puntos', () => {
    const g = createDefense(CFG, 8);
    let kills = 0;
    let coins = 0;
    let points = 0;
    const start = g.purse;
    while (!g.ended) {
      for (const e of g.step(chasePlaneBot(g.snapshot()))) {
        if (e.type === 'kill') {
          kills++;
          coins += e.coins;
          points += e.points;
          expect(e.coins).toBe(defenseEnemyDef(CFG, e.kind as DefenseEnemyKind)!.coins);
          expect(e.source).toBe('plane');
        }
        if (e.type === 'planeUpgrade') coins -= e.cost;
      }
    }
    const r = g.result()!;
    expect(kills).toBeGreaterThan(0);
    expect(r.kills).toBe(kills);
    expect(g.purse).toBe(start + coins);
    expect(r.killPoints).toBe(points);
  });
});

describe('medallas y puntuación (decisión 12)', () => {
  const base = { castleMaxLife: 100, durationS: 300 };
  it('oro con más del 50 %, plata con el 50 % o menos, bronce si cae pasada la mitad', () => {
    expect(defenseMedal({ ...base, end: 'held', castleLife: 51, activeS: 300 })).toBe('oro');
    expect(defenseMedal({ ...base, end: 'held', castleLife: 50, activeS: 300 })).toBe('plata');
    expect(defenseMedal({ ...base, end: 'held', castleLife: 1, activeS: 300 })).toBe('plata');
    expect(defenseMedal({ ...base, end: 'fallen', castleLife: 0, activeS: 150 })).toBe('bronce');
    expect(defenseMedal({ ...base, end: 'fallen', castleLife: 0, activeS: 149.9 })).toBeNull();
    for (const end of ['quit', 'abandoned', null] as const) {
      expect(defenseMedal({ ...base, end, castleLife: 100, activeS: 300 })).toBeNull();
    }
  });

  it('puntos por caída y bono por la vida que queda si aguanta', () => {
    const lb = CFG.score.lifeBonus;
    expect(
      defenseScore({ end: 'held', killPoints: 500, castleLife: 100, castleMaxLife: 100 }),
    ).toEqual({
      killPoints: 500,
      lifeBonus: lb,
      total: 500 + lb,
    });
    expect(
      defenseScore({ end: 'held', killPoints: 500, castleLife: 25, castleMaxLife: 100 }).total,
    ).toBe(500 + Math.round(lb / 4));
    expect(
      defenseScore({ end: 'fallen', killPoints: 500, castleLife: 0, castleMaxLife: 100 }).total,
    ).toBe(500);
    // Los bosses valen más que cualquier común.
    const maxCommon = Math.max(...Object.values(CFG.enemies).map((e) => e.points));
    for (const b of Object.values(CFG.bosses)) expect(b!.points).toBeGreaterThan(maxCommon);
  });

  it('la partida que cae pasada la mitad se lleva el bronce; el resultado está listo para el ranking', () => {
    const g = createDefense(CFG, 4, { runMin: 5, difficulty: 'normal' });
    while (!g.ended) g.step(chasePlaneBot(g.snapshot()));
    const r = g.result()!;
    expect(r.end).toBe('fallen');
    expect(r.medal).toBe(r.playedS >= r.durationS / 2 ? 'bronce' : null);
    expect(r.score).toBe(r.killPoints);
    expect(r).toMatchObject({
      runMin: 5,
      difficulty: 'normal',
      ranked: true,
      configVersion: CFG.version,
    });
  });
});

describe('pausa, «Terminar partida» y atajos', () => {
  it('en pausa no corre el tiempo; una pausa larga abandona', () => {
    const g = createDefense(CFG, 1);
    run(g, 5);
    const t = g.activeS;
    const hash = g.stateHash();
    run(g, 10, undefined, { pause: true });
    expect(g.status).toBe('paused');
    expect(g.activeS).toBe(t);
    expect(g.stateHash()).toBe(hash);
    g.step({ pause: false });
    expect(g.activeS).toBeGreaterThan(t);
    g.setPaused(true);
    g.elapsePause(CFG.maxPauseS + 1);
    expect(g.end).toBe('abandoned');
    expect(g.result()!.ranked).toBe(false);
    expect(g.result()!.medal).toBeNull();
  });

  it('«Terminar partida» acaba con quit, sin medalla ni ranking', () => {
    const g = createDefense(withConfig(emptyRuns), 1);
    run(g, 200);
    g.quit();
    const r = g.result()!;
    expect(r.end).toBe('quit');
    expect(r.ranked).toBe(false);
    expect(r.medal).toBeNull();
    expect(r.lifeBonus).toBe(0);
    expect(g.step()).toHaveLength(0);
  });

  it('un atajo de desarrollo nunca entra en el ranking', () => {
    for (const opts of [{ startAtS: 120 }, { unranked: true }] as DefenseOptions[]) {
      const g = createDefense(withConfig(emptyRuns), 1, opts);
      run(g, 400);
      expect(g.end).toBe('held');
      expect(g.result()!.ranked).toBe(false);
    }
    const g = createDefense(CFG, 1, { startAtS: 120 });
    expect(g.activeS).toBeCloseTo(120, 6);
    expect(g.snapshot().pending).toBe(g.schedule.filter((s) => s.atS >= 120).length);
    expect(g.purse).toBeGreaterThan(CFG.startCoins);
  });

  it('el reloj da pasos fijos y cuenta lo oculto como pausa', () => {
    const g = createDefense(CFG, 1);
    const clock = new DefenseClock();
    expect(clock.frame(g, 0.1)).toBe(6);
    expect(clock.frame(g, 1, true)).toBe(0);
    expect(g.snapshot().pauseRunS).toBeCloseTo(1, 6);
  });
});

describe('el castillo sube su vida máxima (plan 015, decisión 9)', () => {
  it('cara y de mucha vida por nivel; suma esa vida; hasta su nivel máximo', () => {
    const cfg = withConfig((c) => {
      emptyRuns(c);
      c.startCoins = 1e5;
    });
    const maxTower = Math.max(...DEFENSE_TOWER_KINDS.map((k) => cfg.towers.kinds[k].cost));
    expect(cfg.castle.upgradeCost[0]!).toBeGreaterThan(maxTower);
    expect(cfg.castle.lifePerLevel).toBeGreaterThanOrEqual(cfg.castle.life / 4);
    const g = createDefense(cfg, 1);
    expect(g.snapshot().castle).toMatchObject({
      level: 1,
      maxLevel: cfg.castle.upgradeCost.length + 1,
      maxLife: cfg.castle.life,
      nextUpgradeCost: cfg.castle.upgradeCost[0],
    });
    for (let i = 0; i < cfg.castle.upgradeCost.length; i++) {
      const before = g.snapshot().castle;
      const purse = g.purse;
      const evs = [...g.step({ upgradeCastle: true })];
      const after = g.snapshot().castle;
      expect(evs).toContainEqual({
        type: 'castleUpgrade',
        level: i + 2,
        maxLife: before.maxLife + cfg.castle.lifePerLevel,
        cost: cfg.castle.upgradeCost[i],
      });
      expect(purse - g.purse).toBe(cfg.castle.upgradeCost[i]);
      expect(after.maxLife).toBe(defenseCastleMaxLife(cfg, i + 2));
      expect(after.life).toBe(before.life + cfg.castle.lifePerLevel);
    }
    expect(g.upgradeCastle()).toBe(false);
    expect(g.snapshot().castle.nextUpgradeCost).toBeNull();
    expect(defenseCastleMaxLives(cfg)).toEqual(
      Array.from(
        { length: cfg.castle.upgradeCost.length + 1 },
        (_, i) => cfg.castle.life + i * cfg.castle.lifePerLevel,
      ),
    );
  });

  it('herido, la mejora suma vida sin pasar del máximo; medalla y bono, sobre la vida mejorada', () => {
    const cfg = single('pirate', (c) => {
      c.enemies.pirate.hp = 1e9;
      c.startCoins = 1e5;
      c.runs[5].durationS = 2 * (c.waves.firstAtS + c.path.normalWalkS);
    });
    const g = createDefense(cfg, 3);
    run(g, cfg.waves.firstAtS + cfg.path.normalWalkS + 1);
    const hit = cfg.enemies.pirate.castleDamage;
    expect(g.life).toBe(cfg.castle.life - hit);
    expect(g.upgradeCastle()).toBe(true);
    expect(g.life).toBe(cfg.castle.life - hit + cfg.castle.lifePerLevel);
    expect(g.maxLife).toBe(cfg.castle.life + cfg.castle.lifePerLevel);
    run(g, cfg.runs[5].durationS);
    const r = g.result()!;
    expect(r).toMatchObject({
      end: 'held',
      castleLevel: 2,
      castleMaxLife: g.maxLife,
      ranked: true,
    });
    expect(r.medal).toBe(defenseMedal({ ...r, activeS: r.playedS }));
    expect(r.lifeBonus).toBe(
      defenseScore({
        end: 'held',
        killPoints: 0,
        castleLife: r.castleLife,
        castleMaxLife: g.maxLife,
      }).lifeBonus,
    );
  });
});

describe('×2 (plan 015, decisión 10)', () => {
  it('un paso de reloj a ×2 da la misma partida que dos a ×1', () => {
    const a = createDefense(CFG, 9, { difficulty: 'tormenta' });
    const b = createDefense(CFG, 9, { difficulty: 'tormenta' });
    const ca = new DefenseClock();
    const cb = new DefenseClock();
    cb.scale = 2;
    expect(cb.scale).toBe(2);
    const dt = 1 / 50;
    for (let f = 0; f < 50 * 30; f++) {
      const na = ca.frame(a, dt) + ca.frame(a, dt);
      const nb = cb.frame(b, dt);
      expect(nb).toBe(na);
      for (let i = 0; i < na; i++) a.step(chasePlaneBot(a.snapshot()));
      for (let i = 0; i < nb; i++) b.step(chasePlaneBot(b.snapshot()));
      if (f % 250 === 0) expect(b.stateHash()).toBe(a.stateHash());
    }
    expect(b.stateHash()).toBe(a.stateHash());
    // 30 s reales a ×2: 60 s de partida.
    expect(b.activeS).toBeCloseTo(60, 1);
    // La pausa se cuenta en tiempo real, también a ×2.
    cb.frame(b, 1, true);
    expect(b.snapshot().pauseRunS).toBeCloseTo(1, 6);
  });
});

describe('«Llamar oleada» y el aviso de la siguiente (plan 015, decisión 10)', () => {
  /** Enemigos que no caen y un castillo que no cae: sólo se mira el calendario. */
  const calm = () =>
    withConfig((c) => {
      for (const e of Object.values(c.enemies)) e.hp = 1e9;
      for (const b of Object.values(c.bosses)) b!.hp = 1e9;
      c.castle.life = 1e9;
    });

  it('el aviso dice qué trae la siguiente, cuántos, si hay boss y cuándo', () => {
    const cfg = calm();
    const g = createDefense(cfg, 1, { runMin: 5, difficulty: 'normal' });
    const sch = g.schedule;
    const starts = defenseWaveStarts(sch);
    const first = g.nextWave()!;
    expect(first).toMatchObject({ wave: 0, startS: cfg.waves.firstAtS, inS: cfg.waves.firstAtS });
    expect(first.count).toBe(sch.filter((s) => s.wave === 0).length);
    expect(first.boss).toBe(false);
    expect(g.snapshot().nextWave).toEqual(first);
    let bossSeen = false;
    while (!g.ended) {
      const info = g.nextWave();
      if (info) {
        expect(info.startS).toBe(starts[info.wave]);
        expect(info.inS).toBeCloseTo(starts[info.wave]! - g.waveS, 9);
        const commons = sch.filter((s) => s.wave === info.wave);
        const bosses = info.kinds.filter((k) => k.boss);
        expect(info.count).toBe(commons.length + bosses.reduce((n, k) => n + k.count, 0));
        for (const k of info.kinds.filter((x) => !x.boss))
          expect(k.count).toBe(commons.filter((s) => s.kind === k.kind).length);
        expect(info.boss).toBe(bosses.length > 0);
        for (const k of bosses) {
          // Un boss del aviso sale antes de la oleada que sigue a esta.
          const at = sch.find((s) => s.boss && s.kind === k.kind)!.atS;
          expect(at).toBeLessThan(starts[info.wave + 1] ?? Infinity);
          bossSeen = true;
        }
      }
      run(g, 5);
    }
    expect(bossSeen).toBe(true);
    expect(g.nextWave()).toBeNull();
  });

  it('la siguiente sale ya, con su bono por lo adelantado; la partida dura lo mismo', () => {
    const cfg = calm();
    const g = createDefense(cfg, 1, { runMin: 5, difficulty: 'normal' });
    run(g, cfg.waves.firstAtS + 1);
    const info = g.nextWave()!;
    expect(info.wave).toBe(1);
    const purse = g.purse;
    const evs = [...g.step({ callWave: true })];
    const skipped = info.inS - DEFENSE_STEP_S;
    const called = evs.find((e) => e.type === 'waveCalled')!;
    expect(called).toMatchObject({ type: 'waveCalled', wave: 1 });
    expect((called as { skippedS: number }).skippedS).toBeCloseTo(skipped, 9);
    const bonus = Math.round(skipped * cfg.waves.callCoinsPerS);
    expect((called as { coins: number }).coins).toBe(bonus);
    expect(bonus).toBeGreaterThan(0);
    expect(g.purse).toBe(purse + bonus);
    // Sale ya: el primero de la oleada 1 en este mismo paso.
    const spawned = evs.filter((e) => e.type === 'spawn').length;
    expect(spawned).toBeGreaterThanOrEqual(1);
    expect(g.waveS).toBeCloseTo(g.activeS + skipped, 9);
    expect(g.nextWave()!.wave).toBe(2);
    // Llamarlas todas: se adelanta el calendario, no el final.
    let calls = 1;
    let ahead = skipped;
    for (;;) {
      const next = g.nextWave();
      if (!next) break;
      const before = g.waveS;
      expect(g.callWave()).toBe(true);
      ahead += next.startS - before;
      calls++;
    }
    expect(g.callWave()).toBe(false);
    expect(calls).toBe(defenseWaveStarts(g.schedule).length - 1);
    run(g, 400);
    const r = g.result()!;
    expect(r.end).toBe('held');
    expect(r.playedS).toBeCloseTo(g.durationS, 6);
    expect(r.wavesAheadS).toBeCloseTo(ahead, 6);
    expect(g.snapshot().pending).toBe(0);
    expect(r.ranked).toBe(true);
  });
});

describe('determinismo', () => {
  it('con las órdenes nuevas (punto, mejoras, prioridad, llamar oleada) también', () => {
    const play = (seed: number) => {
      const g = createDefense({ ...structuredClone(CFG), startCoins: 3000 }, seed, {
        runMin: 5,
        difficulty: 'normal',
      });
      for (let i = 0; i < stepsFor(90); i++) {
        const input = chasePlaneBot(g.snapshot());
        if (i === 60) input.build = { kind: 'fotos', x: -600, y: 600 };
        if (i === 120) input.setPriority = { towerId: g.towers[0]?.id ?? -1, priority: 'first' };
        if (i === 300) input.callWave = true;
        if (i === 400) input.upgradePlane = 'speed';
        if (i === 500) input.upgradeCastle = true;
        if (i === 600) input.moveTo = { x: -400, y: -400 };
        if (i > 600 && i < 900) delete input.move;
        g.step(input);
      }
      return g.stateHash();
    };
    expect(play(5)).toBe(play(5));
  });

  it('misma semilla, misma partida; otra semilla, otros carriles', () => {
    const play = (seed: number) => {
      const g = createDefense(CFG, seed, { runMin: 5, difficulty: 'tormenta' });
      const hashes: string[] = [];
      for (let i = 0; i < stepsFor(120); i++) {
        g.step(chasePlaneBot(g.snapshot()));
        if (i % 600 === 0) hashes.push(g.stateHash());
      }
      return { hashes, end: g.stateHash() };
    };
    expect(play(42)).toEqual(play(42));
    expect(play(42).end).not.toBe(play(43).end);
  });
});

describe('torres (el enganche de T159)', () => {
  it('la partida llama a targets y onTick de cada torre; sus golpes dan monedas y las caídas cuentan', () => {
    let ticks = 0;
    const hooks: DefenseTowerHooks = {
      targets: (t, ctx) => ctx.enemiesInRange(t.x, t.y, 1e6).slice(0, 1),
      onTick: (t, ctx) => {
        ticks++;
        for (const e of t.targets) ctx.damageEnemy(e, 1e9, 'tower', t.id);
      },
    };
    const cfg = single('pirate');
    const g = createDefense(cfg, 1, { towerHooks: { faro: hooks } });
    const tower = g.addTower('faro', 0, 500, { spent: 40 });
    let kill: Extract<DefenseEvent, { type: 'kill' }> | null = null;
    const start = g.purse;
    run(g, 10, (e) => {
      if (e.type === 'kill') kill = e;
    });
    expect(ticks).toBeGreaterThan(0);
    expect(kill).toMatchObject({ source: 'tower', towerId: tower.id, kind: 'pirate' });
    expect(g.purse).toBe(start + cfg.enemies.pirate.coins);
    expect(g.towers).toHaveLength(1);
    expect(g.removeTower(tower.id)).toBe(tower);
    expect(g.towers).toHaveLength(0);
  });

  it('aturdir para al enemigo; la granja suma monedas', () => {
    const cfg = single('pirate');
    let stunned = false;
    const hooks: DefenseTowerHooks = {
      targets: (_t, ctx) => ctx.enemies,
      onTick: (t, ctx) => {
        if (!stunned && t.targets[0]) {
          ctx.stunEnemy(t.targets[0], 2);
          stunned = true;
        }
      },
    };
    const farm: DefenseTowerHooks = {
      targets: () => [],
      onTick: (t, ctx) => {
        if (ctx.activeS >= 1 && !t.data.paid) {
          ctx.addCoins(25, t.id);
          t.data.paid = 1;
        }
      },
    };
    const g = createDefense(cfg, 1, { towerHooks: { ultima: hooks, tienda: farm } });
    g.addTower('ultima', 0, 0);
    g.addTower('tienda', 0, 0);
    const start = g.purse;
    run(g, cfg.waves.firstAtS + 0.1);
    const d0 = g.snapshot().enemies[0]!.distance;
    run(g, 1.5);
    expect(g.snapshot().enemies[0]!.distance).toBe(d0);
    run(g, 1);
    expect(g.snapshot().enemies[0]!.distance).toBeGreaterThan(d0);
    expect(g.purse).toBe(start + 25);
    expect(g.result()).toBeNull();
  });

  it('con cero torres la partida corre igual', () => {
    const g = createDefense(withConfig(emptyRuns), 1, { towerHooks: {} });
    g.addTower('fotos', 0, 400);
    run(g, 330);
    expect(g.end).toBe('held');
  });
});
