import { describe, expect, it } from 'vitest';
import { buildingBot } from './bots';
import {
  type DefenseBuildWorld,
  defenseBuildCheck,
  defenseSiteReason,
  defenseTowerSellValue,
} from './build';
import {
  DEFENSE_CONFIG,
  DEFENSE_RUN_MINS,
  DEFENSE_STEP_S,
  DEFENSE_TARGET_PRIORITIES,
  DEFENSE_TOWER_KINDS,
  type DefenseConfig,
  type DefenseTowerKind,
  defenseTowerStats,
} from './config';
import { beamTouches, coneTouches } from './geometry';
import { buildDefensePath } from './path';
import { type DefenseEvent, type DefenseGame, createDefense } from './sim';
import {
  DEFENSE_TOWER_HOOKS,
  type DefenseEnemyView,
  type DefenseTowerContext,
  type DefenseTowerState,
  pickTarget,
  strongestEnemy,
} from './towers';

/**
 * Las siete islas de «Defensa del Castillo» (plan 014 T159): lo que hace
 * cada una, la regla de construir, mejorar y vender, y el bot que construye.
 * Las cifras se leen de la configuración, nunca a mano.
 */

const CFG = DEFENSE_CONFIG;
const PATH = buildDefensePath(CFG.path, CFG.castle.radius);
const DT = DEFENSE_STEP_S;
const R = CFG.islandRadius;

// --- Un contexto de mentira: enemigos quietos donde la prueba los pone ------------

type FakeEnemy = { -readonly [K in keyof DefenseEnemyView]: DefenseEnemyView[K] };

let nextId = 1;
function enemy(p: Partial<FakeEnemy> & { x: number; y: number }): FakeEnemy {
  return {
    id: nextId++,
    kind: 'pirate',
    tier: 'common',
    boss: false,
    heading: 0,
    distance: 0,
    progress: 0,
    laneOffset: 0,
    hp: 1000,
    maxHp: 1000,
    radius: 20,
    speed: 100,
    stunS: 0,
    burnS: 0,
    burnDps: 0,
    ageS: 0,
    dead: false,
    ...p,
  };
}

interface FakeCtx extends Omit<DefenseTowerContext, 'enemies'> {
  enemies: readonly DefenseEnemyView[];
  activeS: number;
  damage: { id: number; amount: number; towerId: number | undefined }[];
  stuns: { id: number; seconds: number }[];
  burns: { id: number; dps: number; seconds: number }[];
  coins: number[];
}

function fakeCtx(enemies: FakeEnemy[], config: DefenseConfig = CFG): FakeCtx {
  const ctx: FakeCtx = {
    activeS: 0,
    config,
    enemies,
    path: PATH,
    damage: [],
    stuns: [],
    burns: [],
    coins: [],
    rng: () => 0.5,
    enemiesInRange: (x, y, r) =>
      (ctx.enemies as FakeEnemy[]).filter(
        (e) => !e.dead && Math.hypot(e.x - x, e.y - y) <= r + e.radius,
      ),
    damageEnemy: (e, amount, _s, towerId) => {
      ctx.damage.push({ id: e.id, amount, towerId });
      return false;
    },
    stunEnemy: (e, seconds) => {
      ctx.stuns.push({ id: e.id, seconds });
    },
    burnEnemy: (e, dps, seconds) => {
      ctx.burns.push({ id: e.id, dps, seconds });
    },
    addCoins: (amount) => {
      ctx.coins.push(amount);
    },
    farmRank: () => 0,
  };
  return ctx;
}

function tower(kind: DefenseTowerKind, level = 1, x = 0, y = 0): DefenseTowerState {
  const priority = CFG.towers.kinds[kind].priority;
  return { id: 99, kind, x, y, level, priority, spent: 0, targets: [], lastShot: null, data: {} };
}

/** Un paso de la torre con sus hooks de verdad. */
function tick(t: DefenseTowerState, ctx: FakeCtx): void {
  const hooks = DEFENSE_TOWER_HOOKS[t.kind]!;
  t.targets = hooks.targets(t, ctx);
  hooks.onTick(t, ctx, DT);
  ctx.activeS += DT;
}

const total = (ctx: FakeCtx, id: number) =>
  ctx.damage.filter((d) => d.id === id).reduce((s, d) => s + d.amount, 0);

describe('las siete islas (decisión 9)', () => {
  it('cada tipo tiene su enganche y sus tres niveles, que suben el daño', () => {
    for (const kind of DEFENSE_TOWER_KINDS) {
      expect(DEFENSE_TOWER_HOOKS[kind]).toBeDefined();
      const levels = CFG.towers.kinds[kind].levels as readonly Record<string, number>[];
      expect(levels).toHaveLength(3);
      const key = kind === 'faro' ? 'damagePerS' : kind === 'tienda' ? 'coins' : 'damage';
      expect(levels[1]![key]).toBeGreaterThan(levels[0]![key]!);
      expect(levels[2]![key]).toBeGreaterThan(levels[1]![key]!);
    }
  });

  it('Faro: el haz gira y hiere por segundo sólo lo que toca', () => {
    const st = defenseTowerStats(CFG, 'faro', 1);
    const e = enemy({ x: st.range * 0.6, y: 0 });
    const far = enemy({ x: st.range + 200, y: 0 });
    const ctx = fakeCtx([e, far]);
    const t = tower('faro');
    let hits = 0;
    const turnSteps = Math.ceil((2 * Math.PI) / st.sweepRadPerS / DT);
    for (let i = 0; i < turnSteps; i++) {
      const angle = t.data.angle ?? 0;
      const touching = beamTouches(0, 0, angle, st.range, st.beamWidth, e.x, e.y, e.radius);
      const before = ctx.damage.length;
      tick(t, ctx);
      expect(ctx.damage.length - before).toBe(touching ? 1 : 0);
      if (touching) {
        hits++;
        expect(ctx.damage.at(-1)!.amount).toBeCloseTo(st.damagePerS * DT, 9);
      }
      expect(t.data.angle).toBeCloseTo((angle + st.sweepRadPerS * DT) % (2 * Math.PI), 9);
    }
    // Una vuelta: lo toca un rato (no siempre), y lo de fuera de alcance nunca.
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(turnSteps / 2);
    expect(total(ctx, far.id)).toBe(0);
    expect(t.lastShot?.radius).toBe(st.range);

    // Con más haces (nivel 3) lo toca más veces por vuelta.
    const st3 = defenseTowerStats(CFG, 'faro', 3);
    const ctx3 = fakeCtx([enemy({ x: st.range * 0.6, y: 0 })]);
    const t3 = tower('faro', 3);
    let hits3 = 0;
    for (let i = 0; i < Math.ceil((2 * Math.PI) / st3.sweepRadPerS / DT); i++) {
      const n = ctx3.damage.length;
      tick(t3, ctx3);
      if (ctx3.damage.length > n) hits3++;
    }
    expect(st3.beams).toBeGreaterThan(st.beams);
    expect(hits3).toBeGreaterThan(hits);
  });

  it('Nochevieja: aturde el tiempo de su nivel y cambia de blanco en cada tiro si puede', () => {
    const st = defenseTowerStats(CFG, 'ultima', 2);
    const a = enemy({ x: 100, y: 0, distance: 500 });
    const b = enemy({ x: -100, y: 0, distance: 300 });
    const ctx = fakeCtx([a, b]);
    const t = tower('ultima', 2);
    const shots: number[] = [];
    const shotSteps: number[] = [];
    for (let i = 0; i < Math.round((st.cooldownS * 4) / DT) + 2; i++) {
      const n = ctx.damage.length;
      tick(t, ctx);
      if (ctx.damage.length > n) {
        shots.push(ctx.damage.at(-1)!.id);
        shotSteps.push(i);
      }
    }
    expect(shots.slice(0, 4)).toEqual([a.id, b.id, a.id, b.id]);
    expect(ctx.damage[0]!.amount).toBe(st.damage);
    expect(ctx.stuns[0]).toEqual({ id: a.id, seconds: st.stunS });
    expect((shotSteps[1]! - shotSteps[0]!) * DT).toBeCloseTo(st.cooldownS, 1);

    // Solo uno: le tira siempre a él; a un boss lo aturde menos.
    const boss = enemy({ x: 50, y: 0, boss: true, tier: 'boss', kind: 'kraken' });
    const ctx2 = fakeCtx([boss]);
    const t2 = tower('ultima', 2);
    for (let i = 0; i < Math.round((st.cooldownS * 2.5) / DT); i++) tick(t2, ctx2);
    expect(new Set(ctx2.damage.map((d) => d.id))).toEqual(new Set([boss.id]));
    expect(ctx2.damage.length).toBeGreaterThanOrEqual(2);
    expect(ctx2.stuns[0]!.seconds).toBeCloseTo(st.stunS * CFG.towers.bossStunScale, 9);
  });

  it('Halloween: el cono quema lo que tiene delante, no lo de detrás', () => {
    const st = defenseTowerStats(CFG, 'halloween', 1);
    const front = enemy({ x: st.range * 0.7, y: 0, distance: 900 });
    const side = enemy({
      x: st.range * 0.7,
      y: st.range * 0.7 * Math.tan(st.coneRad * 0.5),
      distance: 800,
    });
    const back = enemy({ x: -st.range * 0.5, y: 0, distance: 100 });
    const ctx = fakeCtx([front, side, back]);
    const t = tower('halloween');
    tick(t, ctx);
    expect(ctx.damage.map((d) => d.id).sort()).toEqual([front.id, side.id].sort());
    expect(ctx.burns).toEqual([
      { id: front.id, dps: st.burnDps, seconds: st.burnS },
      { id: side.id, dps: st.burnDps, seconds: st.burnS },
    ]);
    expect(t.lastShot?.angle).toBeCloseTo(0, 9);
    expect(coneTouches(0, 0, 0, st.range, st.coneRad, back.x, back.y, back.radius)).toBe(false);
    // Hasta pasar el enfriamiento no vuelve a echar fuego.
    const n = ctx.damage.length;
    for (let i = 0; i < Math.round(st.cooldownS / DT) - 2; i++) tick(t, ctx);
    expect(ctx.damage.length).toBe(n);
  });

  it('Halloween en la partida: lo quemado pierde burnDps por segundo durante burnS, y la caída es de la torre', () => {
    const st = defenseTowerStats(CFG, 'halloween', 1);
    const cfg = structuredClone(CFG);
    cfg.waves.mix = [{ kind: 'crab', fromFrac: 0, weight: 1 }];
    cfg.waves.baseCount = 1;
    cfg.waves.countPerWave = 0;
    cfg.waves.everyS = 1e6;
    for (const m of DEFENSE_RUN_MINS) cfg.runs[m].bosses = [];
    let lit = false;
    const g = createDefense(cfg, 1, {
      towerHooks: {
        halloween: {
          targets: (_t, ctx) => ctx.enemies.slice(0, 1),
          onTick: (t, ctx) => {
            if (!lit && t.targets[0]) {
              ctx.burnEnemy(t.targets[0], st.burnDps, st.burnS, t.id);
              lit = true;
            }
          },
        },
      },
    });
    const tw = g.addTower('halloween', 0, 0);
    while (!lit) g.step();
    const e = g.snapshot().enemies[0]!;
    const hp0 = e.hp;
    expect(e.burnS).toBe(st.burnS);
    for (let i = 0; i < Math.round(st.burnS / DT) + 30; i++) g.step();
    expect(e.burnS).toBe(0);
    expect(hp0 - e.hp).toBeCloseTo(st.burnDps * st.burnS, 6);

    // Mucho fuego: muere quemado y la caída se apunta a la torre.
    const g2 = createDefense(cfg, 1, {
      towerHooks: {
        halloween: {
          targets: (_t, ctx) => ctx.enemies.slice(0, 1),
          onTick: (t, ctx) => {
            if (t.targets[0]) ctx.burnEnemy(t.targets[0], 1e6, 1, t.id);
          },
        },
      },
    });
    const tw2 = g2.addTower('halloween', 0, 0);
    let kill: Extract<DefenseEvent, { type: 'kill' }> | null = null;
    for (let i = 0; i < Math.round(10 / DT) && !kill; i++)
      for (const ev of g2.step()) if (ev.type === 'kill') kill = ev;
    expect(kill).toMatchObject({ source: 'tower', towerId: tw2.id });
    expect(tw.id).toBeGreaterThan(0);
  });

  it('Puerto: el cohete cae donde estará el blanco y el estallido hiere todo en su radio', () => {
    const st = defenseTowerStats(CFG, 'cala', 1);
    const d = 2000;
    const s = PATH.sampleAt(d);
    const target = enemy({ x: s.x, y: s.y, distance: d, speed: 100 });
    const ctx = fakeCtx([target]);
    const tw = tower('cala', 1, s.x + 200, s.y);
    tick(tw, ctx);
    const launch = tw.lastShot!;
    const land = PATH.sampleAt(d + st.flightS * target.speed);
    expect(launch.flightS).toBe(st.flightS);
    expect(launch.x).toBeCloseTo(land.x, 6);
    expect(launch.y).toBeCloseTo(land.y, 6);
    expect(ctx.damage).toHaveLength(0);
    // Al caer: lo de dentro del radio sí, lo de fuera no.
    const inside = enemy({ x: land.x + st.blastRadius * 0.8, y: land.y });
    const outside = enemy({ x: land.x + st.blastRadius + 40, y: land.y });
    target.x = land.x;
    target.y = land.y;
    ctx.enemies = [target, inside, outside];
    for (let i = 0; i < Math.round(st.flightS / DT); i++) tick(tw, ctx);
    expect(ctx.damage.map((h) => h.id).sort()).toEqual([target.id, inside.id].sort());
    expect(ctx.damage.every((h) => h.amount === st.damage)).toBe(true);
    expect(tw.lastShot!.flightS).toBeUndefined();
    expect(tw.lastShot!.radius).toBe(st.blastRadius);
  });

  it('Ibiza: da sus monedas cada pocos segundos, más a más nivel', () => {
    for (const level of [1, 3]) {
      const st = defenseTowerStats(CFG, 'tienda', level);
      const ctx = fakeCtx([]);
      const t = tower('tienda', level);
      for (let i = 0; i < Math.round((st.cooldownS * 3) / DT); i++) tick(t, ctx);
      expect(ctx.coins).toEqual([st.coins, st.coins, st.coins]);
      expect(ctx.damage).toHaveLength(0);
    }
  });

  it('Isla del Sonido: la onda hiere a todo lo que tiene alrededor, a su ritmo', () => {
    const st = defenseTowerStats(CFG, 'allday', 1);
    const near = [enemy({ x: 50, y: 0 }), enemy({ x: 0, y: -st.range }), enemy({ x: -80, y: 60 })];
    const far = enemy({ x: st.range + 100, y: 0 });
    const ctx = fakeCtx([...near, far]);
    const t = tower('allday');
    for (let i = 0; i < Math.round((st.cooldownS * 2) / DT) - 1; i++) tick(t, ctx);
    for (const e of near) expect(total(ctx, e.id)).toBe(st.damage * 2);
    expect(total(ctx, far.id)).toBe(0);
    expect(t.lastShot).toMatchObject({ x: 0, y: 0, radius: st.range });
  });

  it('Benidorm: dispara al más fuerte a su alcance (bosses primero)', () => {
    const st = defenseTowerStats(CFG, 'fotos', 1);
    const common = enemy({ x: 100, y: 0, hp: 500, distance: 3000 });
    const tough = enemy({ x: 200, y: 0, hp: 900, distance: 100 });
    const mini = enemy({ x: 300, y: 0, hp: 300, boss: true, tier: 'miniboss' });
    const bossFar = enemy({ x: st.range + 300, y: 0, hp: 9000, boss: true, tier: 'boss' });
    expect(strongestEnemy([common, tough])).toBe(tough);
    const ctx = fakeCtx([common, tough, mini, bossFar]);
    const t = tower('fotos');
    tick(t, ctx);
    expect(ctx.damage).toEqual([{ id: mini.id, amount: st.damage, towerId: t.id }]);
    expect(st.range).toBeGreaterThan(defenseTowerStats(CFG, 'ultima', 3).range);
    // Sin el miniboss, el de más aguante (aunque vaya atrás).
    mini.dead = true;
    for (let i = 0; i < Math.round(st.cooldownS / DT); i++) tick(t, ctx);
    expect(ctx.damage.at(-1)!.id).toBe(tough.id);
  });
});

// --- Construir ----------------------------------------------------------------------

/** Un sitio libre (sin contar el dinero) cerca de (x, y). */
function freeSiteNear(x: number, y: number, towers: { x: number; y: number }[] = []) {
  for (let r = 0; r < 400; r += 10)
    for (let a = 0; a < 2 * Math.PI; a += 0.1) {
      const px = x + r * Math.cos(a);
      const py = y + r * Math.sin(a);
      if (!defenseSiteReason(CFG, PATH, towers, px, py)) return { x: px, y: py };
    }
  throw new Error('sin sitio');
}

function world(p: Partial<DefenseBuildWorld> = {}): DefenseBuildWorld {
  return {
    config: CFG,
    path: PATH,
    towers: [],
    coins: 1e6,
    ...p,
  };
}

describe('la regla de construir (decisión 8; plan 015, decisión 5)', () => {
  it('todas las islas tienen la misma huella: no hay radio por tipo', () => {
    for (const kind of DEFENSE_TOWER_KINDS)
      expect(Object.keys(CFG.towers.kinds[kind])).not.toContain('radius');
    const site = freeSiteNear(600, 0);
    const besidePath = PATH.sampleAt(1500);
    for (const kind of DEFENSE_TOWER_KINDS) {
      expect(defenseBuildCheck(world(), kind, site.x, site.y).ok).toBe(true);
      expect(defenseBuildCheck(world(), kind, besidePath.x, besidePath.y)).toMatchObject({
        ok: false,
        reason: 'path',
      });
    }
  });

  it('rechaza el camino, el vórtice, el castillo, otra isla y fuera de la arena (su borde)', () => {
    const minPath = CFG.path.width / 2 + R + CFG.towers.pathClearance;
    const s = PATH.sampleAt(PATH.length * 0.4);
    const reason = (w: DefenseBuildWorld, x: number, y: number) => {
      const c = defenseBuildCheck(w, 'faro', x, y);
      return c.ok ? null : c.reason;
    };
    // El camino: a un pelo menos de la distancia mínima, no; a la distancia, sí (si nada más estorba).
    const close = { x: s.x + s.nx * (minPath - 2), y: s.y + s.ny * (minPath - 2) };
    expect(reason(world(), close.x, close.y)).toBe('path');
    expect(PATH.distanceTo(close.x, close.y)).toBeLessThan(minPath);
    // El vórtice: fuera del carril pero pegado a él.
    const st = PATH.start;
    const nearVortex = {
      x: st.x - Math.sin(st.heading) * (minPath + 5),
      y: st.y + Math.cos(st.heading) * (minPath + 5),
    };
    expect(PATH.distanceTo(nearVortex.x, nearVortex.y)).toBeGreaterThanOrEqual(minPath);
    expect(reason(world(), nearVortex.x, nearVortex.y)).toBe('vortex');
    expect(reason(world(), st.x, st.y)).toBe('vortex');
    // El castillo.
    const onCastle = { x: 0, y: CFG.castle.radius + R - 1 };
    expect(reason(world(), onCastle.x, onCastle.y)).toBe('castle');
    // Otra isla: a menos de dos huellas, no; a dos, sí.
    const site = freeSiteNear(600, 0);
    const other = [{ x: site.x + 2 * R - 1, y: site.y }];
    expect(reason(world({ towers: other }), site.x, site.y)).toBe('overlap');
    const apart = [{ x: site.x + 2 * R, y: site.y }];
    expect(reason(world({ towers: apart }), site.x, site.y)).toBeNull();
    // El borde de la arena: la isla entera tiene que caber. Donde el borde
    // queda libre del camino, justo dentro sí y un pelo más fuera no.
    const edgeR = CFG.arenaRadius - R;
    let free = 0;
    for (let a = 0; a < 2 * Math.PI; a += 0.05) {
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      if (reason(world(), ux * edgeR, uy * edgeR) !== null) continue;
      free++;
      expect(reason(world(), ux * (edgeR + 1), uy * (edgeR + 1))).toBe('arena');
    }
    expect(free).toBeGreaterThan(0);
    expect(reason(world(), 0, -(CFG.arenaRadius + 500))).toBe('arena');
    expect(reason(world(), Number.NaN, 0)).toBe('arena');
    // Sin dinero (el sitio vale) y partida acabada.
    const cost = CFG.towers.kinds.faro.cost;
    expect(reason(world({ coins: cost - 1 }), site.x, site.y)).toBe('coins');
    expect(reason(world({ coins: cost }), site.x, site.y)).toBeNull();
    expect(reason(world({ ended: true }), site.x, site.y)).toBe('ended');
  });

  it('en cualquier sitio de la arena: sin anillo alrededor del avión', () => {
    // Islas por toda la arena, lejos y cerca del avión: vale cualquier sitio libre.
    const g = createDefense({ ...structuredClone(CFG), startCoins: 1e6 }, 3);
    const p = g.snapshot().plane;
    let far = 0;
    for (let a = 0; a < 2 * Math.PI; a += Math.PI / 8)
      for (const r of [CFG.castle.radius + R + 5, 600, CFG.arenaRadius - R]) {
        const x = r * Math.cos(a);
        const y = r * Math.sin(a);
        const site = defenseSiteReason(CFG, PATH, g.towers, x, y);
        const check = g.buildCheck('cala', x, y);
        expect(check.ok ? null : (check as { reason: string }).reason).toBe(site);
        if (check.ok && Math.hypot(x - p.x, y - p.y) > CFG.arenaRadius * 0.75) {
          expect(g.build('cala', x, y)).not.toBeNull();
          far++;
        }
      }
    expect(far).toBeGreaterThan(0);
  });

  it('no hay tope de islas: sólo dinero y sitio', () => {
    const site = freeSiteNear(600, 0);
    const many = Array.from({ length: 60 }, (_, i) => ({ x: -5000 - i * 200, y: 0 }));
    expect(defenseBuildCheck(world({ towers: many }), 'cala', site.x, site.y).ok).toBe(true);
  });
});

describe('construir, mejorar y vender en la partida', () => {
  function richGame(): DefenseGame {
    const cfg = structuredClone(CFG);
    cfg.startCoins = 5000;
    return createDefense(cfg, 3);
  }

  it('construir cobra su coste; mejorar hasta el 3 cobra cada nivel; vender devuelve una parte', () => {
    const g = richGame();
    const p = g.snapshot().plane;
    const site = freeSiteNear(p.x, p.y);
    const def = CFG.towers.kinds.cala;
    const start = g.purse;
    expect(g.buildCheck('cala', site.x, site.y)).toEqual({ ok: true, cost: def.cost });
    const t = g.build('cala', site.x, site.y)!;
    expect(t).toMatchObject({ kind: 'cala', level: 1, spent: def.cost });
    expect(g.purse).toBe(start - def.cost);
    // Encima de otra, no.
    expect(g.build('faro', site.x, site.y)).toBeNull();
    expect(g.buildCheck('faro', site.x, site.y)).toMatchObject({ ok: false, reason: 'overlap' });

    expect(g.towerUpgradeCost(t.id)).toBe(def.upgradeCost[0]);
    expect(g.upgradeTower(t.id)).toBe(true);
    expect(g.towerUpgradeCost(t.id)).toBe(def.upgradeCost[1]);
    expect(g.upgradeTower(t.id)).toBe(true);
    expect(t.level).toBe(3);
    expect(g.towerUpgradeCost(t.id)).toBeNull();
    expect(g.upgradeTower(t.id)).toBe(false);
    const spent = def.cost + def.upgradeCost[0] + def.upgradeCost[1];
    expect(t.spent).toBe(spent);
    expect(g.purse).toBe(start - spent);

    const refund = Math.floor(spent * CFG.towers.sellRefund);
    expect(g.towerSellValue(t.id)).toBe(refund);
    expect(defenseTowerSellValue(CFG, t)).toBe(refund);
    expect(g.sellTower(t.id)).toBe(refund);
    expect(g.towers).toHaveLength(0);
    expect(g.purse).toBe(start - spent + refund);
    expect(g.sellTower(t.id)).toBeNull();
    // El sitio vuelve a estar libre.
    expect(g.buildCheck('faro', site.x, site.y).ok).toBe(true);
  });

  it('sin dinero no construye ni mejora; por la entrada del paso, igual que llamando', () => {
    const cfg = structuredClone(CFG);
    cfg.startCoins = CFG.towers.kinds.ultima.cost;
    const g = createDefense(cfg, 3);
    const p = g.snapshot().plane;
    const site = freeSiteNear(p.x, p.y);
    const evs = [...g.step({ build: { kind: 'ultima', x: site.x, y: site.y } })];
    expect(evs.find((e) => e.type === 'towerBuilt')).toMatchObject({ kind: 'ultima' });
    expect(g.purse).toBe(0);
    const t = g.towers[0]!;
    g.step({ upgradeTower: t.id });
    expect(t.level).toBe(1);
    const other = freeSiteNear(p.x, p.y, [t]);
    expect(g.buildCheck('faro', other.x, other.y)).toMatchObject({ ok: false, reason: 'coins' });
    const sold = [...g.step({ sellTower: t.id })];
    expect(sold.find((e) => e.type === 'towerSold')).toMatchObject({
      towerId: t.id,
      refund: Math.floor(CFG.towers.kinds.ultima.cost * CFG.towers.sellRefund),
    });
  });

  it('cada disparo deja su último efecto en la torre y un aviso towerShot', () => {
    const g = richGame();
    const p = g.snapshot().plane;
    const site = freeSiteNear(p.x, p.y);
    const t = g.build('tienda', site.x, site.y)!;
    const st = defenseTowerStats(CFG, 'tienda', 1);
    const shots: Extract<DefenseEvent, { type: 'towerShot' }>[] = [];
    const coins: number[] = [];
    for (let i = 0; i < Math.round((st.cooldownS * 2) / DT) + 1; i++)
      for (const e of g.step()) {
        if (e.type === 'towerShot') shots.push(e);
        if (e.type === 'coins' && e.towerId === t.id) coins.push(e.amount);
      }
    expect(shots).toHaveLength(2);
    expect(shots[1]!.shot).toBe(t.lastShot);
    expect(t.lastShot).toMatchObject({ amount: st.coins, targetIds: [] });
    expect(coins).toEqual([st.coins, st.coins]);
  });
});

// --- El bot que construye -----------------------------------------------------------

/**
 * Lo mínimo del bot que construye; el equilibrio entero (duraciones,
 * dificultades, semillas, estrategias) está en `defense-balance.test.ts`.
 */
describe('el bot que construye', () => {
  function play(difficulty: 'tranquila' | 'normal', runMin: 5 | 7 | 10, seed = 7) {
    const g = createDefense(CFG, seed, { difficulty, runMin });
    const bot = buildingBot(CFG);
    while (!g.ended) g.step(bot(g.snapshot()));
    return g.result()!;
  }

  it('aguanta Tranquila con oro', () => {
    const r = play('tranquila', 5);
    expect(r.end).toBe('held');
    expect(r.medal).toBe('oro');
    expect(r.towersBuilt).toBeGreaterThanOrEqual(DEFENSE_TOWER_KINDS.length);
  });

  it('aguanta Normal (plan 016: islas más fuertes)', () => {
    const r = play('normal', 5);
    expect(r.end).toBe('held');
    expect(r.castleLife).toBeGreaterThan(0);
  });
});

// --- Prioridades (plan 015, decisión 12) ---------------------------------------------

describe('la prioridad de cada isla', () => {
  /** Cuatro enemigos a tiro, cada uno el bueno para una prioridad. */
  function scene() {
    const first = enemy({ x: 150, y: 0, distance: 900 });
    const last = enemy({ x: -150, y: 0, distance: 100 });
    const strongest = enemy({ x: 0, y: 150, distance: 500, tier: 'boss', boss: true, hp: 5000 });
    const closest = enemy({ x: 0, y: -60, distance: 400 });
    return { first, last, strongest, closest, all: [first, last, strongest, closest] };
  }
  const AIMED = DEFENSE_TOWER_KINDS.filter((k) => CFG.towers.kinds[k].priority !== null);

  it('las que eligen blanco tienen su prioridad por defecto (Benidorm: el más fuerte)', () => {
    expect([...AIMED].sort()).toEqual(['cala', 'fotos', 'halloween', 'ultima']);
    expect(CFG.towers.kinds.fotos.priority).toBe('strongest');
    for (const k of ['faro', 'allday', 'tienda'] as const)
      expect(CFG.towers.kinds[k].priority).toBeNull();
    for (const k of AIMED)
      expect(DEFENSE_TARGET_PRIORITIES).toContain(CFG.towers.kinds[k].priority);
  });

  it('cada prioridad elige al suyo, en cada isla que apunta', () => {
    for (const kind of AIMED)
      for (const priority of DEFENSE_TARGET_PRIORITIES) {
        const s = scene();
        const t = tower(kind, 3);
        t.priority = priority;
        const ctx = fakeCtx(s.all);
        const want = s[priority];
        const got = DEFENSE_TOWER_HOOKS[kind]!.targets(t, ctx);
        if (kind === 'halloween')
          expect(t.data.aim, `${kind}/${priority}`).toBeCloseTo(Math.atan2(want.y, want.x), 9);
        else expect(got[0]?.id, `${kind}/${priority}`).toBe(want.id);
        expect(pickTarget(s.all, priority, t)?.id).toBe(want.id);
      }
  });

  it('en la partida se cambia por la entrada del paso (sólo en las que apuntan)', () => {
    const g = createDefense({ ...structuredClone(CFG), startCoins: 1e6 }, 3);
    const a = freeSiteNear(600, 0);
    const b = freeSiteNear(-600, 0, [a]);
    const fotos = g.build('fotos', a.x, a.y)!;
    const faro = g.build('faro', b.x, b.y)!;
    expect(fotos.priority).toBe('strongest');
    expect(faro.priority).toBeNull();
    const evs = [...g.step({ setPriority: { towerId: fotos.id, priority: 'closest' } })];
    expect(evs).toContainEqual({ type: 'towerPriority', towerId: fotos.id, priority: 'closest' });
    expect(fotos.priority).toBe('closest');
    expect(g.setTowerPriority(faro.id, 'last')).toBe(false);
    expect(g.setTowerPriority(fotos.id, 'nada' as never)).toBe(false);
    expect(faro.priority).toBeNull();
  });
});
