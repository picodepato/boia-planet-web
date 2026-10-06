import {
  DEFENSE_CONFIG,
  DEFENSE_TOWER_KINDS,
  type DefenseEnemyView,
  buildDefensePath,
  defenseTowerStats,
} from '@boia/engine/defense';
import { CASTLE_PLACE_ID, WORLD_REGISTRY } from '@boia/world';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DefenseRun } from '../castillo';
import { marWorld } from './compact';
import { toScene } from './compress';
import {
  ARENA_FIT,
  ARENA_ZOOM_NEAR,
  ArenaZoom,
  arenaCameraPose,
  arenaFrame,
  towerRangeScene,
  uTurnBuoys,
} from './defense-arena';
import { ARENA_CLOUD_ZOOM, ArenaClouds } from './defense-clouds';
import {
  COIN_POP_S,
  COIN_POP_STYLE,
  DAMAGE_GAP_S,
  DEFAULT_DEFENSE_OVERLAYS,
  DEFENSE_OVERLAYS_KEY,
  DamageNumbers,
  DamageTracker,
  HealthBars,
  NUMBER_DIGITS,
  NUMBER_S,
  digitsOf,
  glyphsOf,
  readDefenseOverlays,
  saveDefenseOverlays,
} from './defense-overlays';
import { DefenseView } from './defense-view';

/**
 * La arena del castillo v2 (plan 015 T170): el zoom de la cámara (nunca más
 * abierto que la vista de salida ni fuera de la arena), los toques (colocar,
 * elegir, volar), el círculo de alcance, los acentos de las U del camino v2,
 * las barras de vida y los números de daño (grupos fijos y sus
 * interruptores) y las nubes.
 */

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const castle = world.objects.find((o) => o.identity.id === CASTLE_PLACE_ID)!;
const path = buildDefensePath(DEFENSE_CONFIG.path, DEFENSE_CONFIG.castle.radius);
const frame = arenaFrame(castle.position, path);
const R = toScene(DEFENSE_CONFIG.arenaRadius);
const FOV = 40;
const T = Math.tan((FOV * Math.PI) / 360);

describe('el zoom de la arena (decisiones 3 y 4)', () => {
  const aspects = [16 / 9, 1440 / 900, 390 / 844, 360 / 640, 768 / 1024];

  it('la vista más abierta es la de salida; lo más cerca, `ARENA_ZOOM_NEAR` de ella; fuera de 0…1 se acota', () => {
    for (const aspect of aspects) {
      const plane = { x: R * 0.3, z: -R * 0.2 };
      const start = arenaCameraPose({ aspect, fovDeg: FOV, arenaRadius: R, plane });
      const wide = arenaCameraPose({ aspect, fovDeg: FOV, arenaRadius: R, plane, zoom: 1 });
      const near = arenaCameraPose({ aspect, fovDeg: FOV, arenaRadius: R, plane, zoom: 0 });
      expect(wide).toEqual(start);
      expect(near.distance).toBeCloseTo(start.distance * ARENA_ZOOM_NEAR, 9);
      expect(arenaCameraPose({ aspect, fovDeg: FOV, arenaRadius: R, plane, zoom: 3 })).toEqual(wide);
      expect(arenaCameraPose({ aspect, fovDeg: FOV, arenaRadius: R, plane, zoom: -2 })).toEqual(near);
      // Cuanto más zoom, más cerca.
      let last = Infinity;
      for (let z = 1; z >= 0; z -= 0.1) {
        const d = arenaCameraPose({ aspect, fovDeg: FOV, arenaRadius: R, plane, zoom: z }).distance;
        expect(d).toBeLessThan(last);
        last = d;
      }
    }
  });

  it('sin seguir al avión lo que se ve no pasa del borde de la arena; a cualquier zoom el avión está dentro', () => {
    const fit = R * ARENA_FIT;
    for (const aspect of aspects) {
      for (let z = 0; z <= 1.0001; z += 0.25) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
          for (const r of [0, R * 0.5, R]) {
            const plane = { x: Math.cos(a) * r, z: Math.sin(a) * r };
            const p = arenaCameraPose({ aspect, fovDeg: FOV, arenaRadius: R, plane, zoom: z });
            const halfW = p.distance * T * aspect;
            const halfH = p.distance * T;
            // Lo que cabe en la arena (con su margen): nunca se ve más allá de su borde
            // mientras no sigue al avión (de más cerca lo centra: plan 016, decisión 2).
            if (p.follow === 0) {
              if (halfW <= fit) expect(Math.abs(p.fx) + halfW).toBeLessThanOrEqual(fit + 1e-9);
              if (halfH <= fit) expect(Math.abs(p.fz) + halfH).toBeLessThanOrEqual(fit + 1e-9);
            }
            // Y el avión, dentro de lo que se ve.
            expect(Math.abs(plane.x - p.fx)).toBeLessThanOrEqual(halfW + 1e-9);
            expect(Math.abs(plane.z - p.fz)).toBeLessThanOrEqual(halfH + 1e-9);
          }
        }
      }
    }
  });

  it('de cerca sigue al avión; en la vista de salida (apaisado) se queda en el castillo', () => {
    const plane = { x: R * 0.8, z: R * 0.3 };
    const wide = arenaCameraPose({ aspect: 16 / 9, fovDeg: FOV, arenaRadius: R, plane, zoom: 1 });
    const near = arenaCameraPose({ aspect: 16 / 9, fovDeg: FOV, arenaRadius: R, plane, zoom: 0 });
    expect(Math.hypot(wide.fx, wide.fz)).toBeLessThan(1e-9);
    // El foco se va hacia el avión (sin pasarse del borde de la arena).
    expect(Math.hypot(near.fx, near.fz)).toBeGreaterThan(Math.hypot(plane.x, plane.z) * 0.4);
    expect(near.fx * plane.x + near.fz * plane.z).toBeGreaterThan(0);
  });

  it('los mandos lo mueven acotado a 0…1; «Construir» vuelve a la vista de salida', () => {
    const z = new ArenaZoom();
    expect(z.value).toBe(1);
    z.by(0.5);
    expect(z.goal).toBe(1);
    for (let i = 0; i < 20; i++) z.by(-0.14);
    expect(z.goal).toBe(0);
    for (let i = 0; i < 120; i++) z.step(1 / 60);
    expect(z.value).toBeCloseTo(0, 3);
    z.by(Number.NaN);
    expect(z.goal).toBe(0);
    z.set(0.4);
    z.step(0, true);
    expect(z.value).toBe(0.4);
    z.reset();
    expect(z.goal).toBe(1);
    z.step(0, true);
    expect(z.value).toBe(1);
  });
});

describe('los toques en la arena (decisión 6)', () => {
  const freeSpot = (run: DefenseRun) => {
    for (let a = 0; a < Math.PI * 2; a += 0.1)
      for (let r = 400; r <= 1000; r += 20) {
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (run.game.buildCheck('cala', x, y).ok) return { x, y };
      }
    throw new Error('sin sitio');
  };

  it('en el mar el avión vuela allí, acotado a la arena (también tocando fuera)', () => {
    const run = new DefenseRun({ seed: 7, quality: 'alta' });
    const far = { x: 5000, y: -3000 };
    const what = run.tap(far.x, far.y);
    expect(what.type).toBe('move');
    if (what.type !== 'move') return;
    const r = DEFENSE_CONFIG.arenaRadius;
    expect(Math.hypot(what.x, what.y)).toBeCloseTo(r, 6);
    expect(what.x / what.y).toBeCloseTo(far.x / far.y, 6);
    run.step(null);
    const target = run.snapshot().plane.target!;
    expect(target.x).toBeCloseTo(what.x, 6);
    expect(target.y).toBeCloseTo(what.y, 6);
    // Vuela hacia allí y nunca sale de la arena.
    const d0 = Math.hypot(target.x - run.snapshot().plane.x, target.y - run.snapshot().plane.y);
    for (let i = 0; i < 600; i++) {
      run.step(null);
      const pl = run.snapshot().plane;
      expect(Math.hypot(pl.x, pl.y)).toBeLessThanOrEqual(r + 1e-6);
    }
    const pl = run.snapshot().plane;
    expect(Math.hypot(what.x - pl.x, what.y - pl.y)).toBeLessThan(d0);
    // Un punto dentro de la arena se queda tal cual.
    expect(run.tap(100, -200)).toEqual({ type: 'move', x: 100, y: -200 });
  });

  it('en una isla construida, la elige (el HUD abre su ficha); en el mar, la ficha se cierra', () => {
    const run = new DefenseRun({ seed: 7, quality: 'alta', devIslands: true });
    const tw = run.snapshot().towers[0]!;
    expect(run.tap(tw.x + 10, tw.y - 10)).toEqual({ type: 'select', towerId: tw.id });
    expect(run.selected).toBe(tw.id);
    expect(run.tap(0, -DEFENSE_CONFIG.arenaRadius + 10).type).toBe('move');
    expect(run.selected).toBeNull();
  });

  it('construyendo, el toque deja ahí la isla (y ahí se queda aunque el avión vuele); antes, va bajo el avión', () => {
    const run = new DefenseRun({ seed: 7, quality: 'alta', devCoins: 1000 });
    expect(run.building).toBe(false);
    run.setBuildMenu(true);
    expect(run.building).toBe(true);
    run.setBuildMenu(false);
    run.startPlacing('cala');
    expect(run.building).toBe(true);
    const plane = run.snapshot().plane;
    expect(run.placement()).toMatchObject({ x: plane.x, y: plane.y });
    const spot = freeSpot(run);
    expect(run.tap(spot.x, spot.y)).toEqual({ type: 'place', ...spot });
    for (let i = 0; i < 60; i++) run.step({ x: 1, y: 0 });
    expect(run.placement()).toMatchObject({ kind: 'cala', ...spot, check: { ok: true } });
    // El avión no recibió ningún punto al que volar.
    expect(run.snapshot().plane.target).toBeNull();
    expect(run.confirmPlacing()).toBe(true);
    expect(run.building).toBe(false);
  });

  it('sin partida (acabada) un toque no hace nada', () => {
    const run = new DefenseRun({ seed: 7, quality: 'alta' });
    run.quit();
    expect(run.tap(10, 10)).toEqual({ type: 'none' });
  });
});

describe('el alcance al construir (decisión 5) y el camino v2 (decisión 7)', () => {
  beforeAll(() => {
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true });
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
    });
  });

  it('el radio del círculo es el alcance de la isla en la partida, a cada nivel', () => {
    for (const kind of DEFENSE_TOWER_KINDS)
      for (const level of [1, 2, 3])
        expect(towerRangeScene(DEFENSE_CONFIG, kind, level)).toBe(
          toScene(defenseTowerStats(DEFENSE_CONFIG, kind, level).range),
        );
  });

  it('la vista pinta el alcance de la isla que se coloca (de su color) y el de la elegida a su nivel', () => {
    const run = new DefenseRun({ seed: 7, quality: 'alta', devIslands: true });
    const view = new DefenseView({ config: DEFENSE_CONFIG, path, frame });
    const s = run.snapshot();
    for (const kind of DEFENSE_TOWER_KINDS) {
      const want = toScene(defenseTowerStats(DEFENSE_CONFIG, kind, 1).range);
      view.update(s, 0, { x: 0, z: 0 }, {
        preview: { x: 0, y: -900, ok: false, kind, reason: 'path' },
        selected: null,
      });
      expect(view.range, kind).toBe(want);
      expect(view.marked).toMatchObject({ preview: 'no', reason: 'path' });
    }
    const tw = s.towers.find((t) => towerRangeScene(DEFENSE_CONFIG, t.kind, t.level) > 0)!;
    view.update(s, 0, { x: 0, z: 0 }, {
      preview: null,
      selected: { x: tw.x, y: tw.y, kind: tw.kind, level: tw.level },
    });
    expect(tw.level).toBe(3);
    expect(view.range).toBe(toScene(defenseTowerStats(DEFENSE_CONFIG, tw.kind, tw.level).range));
    // Sin tipo (o Ibiza, que no ataca), sin círculo.
    view.update(s, 0, { x: 0, z: 0 }, { preview: { x: 0, y: 0, ok: true }, selected: null });
    expect(view.range).toBe(0);
    view.dispose();
  });

  it('una boya de acento por fuera de cada U del camino, fuera del carril', () => {
    const buoys = uTurnBuoys(path);
    expect(path.uTurns.length).toBeGreaterThan(0);
    expect(buoys).toHaveLength(path.uTurns.length);
    buoys.forEach((b, i) => {
      const u = path.uTurns[i]!;
      expect(path.distanceTo(b.x, b.y)).toBeGreaterThan(path.width / 2);
      // Por fuera de la U: más lejos de su centro que el camino.
      expect(Math.hypot(b.x - u.x, b.y - u.y)).toBeGreaterThan(u.radius + path.width / 2);
    });
  });
});

describe('las barras de vida y los números de daño (decisión 11)', () => {
  const enemy = (id: number, hp: number, extra: Partial<DefenseEnemyView> = {}): DefenseEnemyView => ({
    id,
    kind: 'crab',
    tier: 'common',
    boss: false,
    x: id * 10,
    y: 0,
    heading: 0,
    distance: 100,
    progress: 0.3,
    laneOffset: 0,
    hp,
    maxHp: 100,
    radius: 16,
    speed: 200,
    stunS: 0,
    burnS: 0,
    burnDps: 0,
    ageS: 1,
    dead: false,
    ...extra,
  });

  it('las barras: sólo los tocados, nunca más que el tope, y apagadas no se pinta ninguna', () => {
    const bars = new HealthBars(4);
    bars.begin();
    bars.add(0, 0, 1, 0, 100, 100);
    expect(bars.drawn).toBe(0);
    for (let i = 0; i < 10; i++) bars.add(i, 0, 1, 0, 50, 100);
    bars.end(true);
    expect(bars.drawn).toBe(4);
    expect(bars.fill.count).toBe(4);
    expect(bars.back.count).toBe(4);
    bars.begin();
    bars.add(0, 0, 1, 0, 50, 100);
    bars.end(false);
    expect(bars.drawn).toBe(0);
    expect(bars.fill.visible).toBe(false);
    bars.dispose();
  });

  it('el daño se lee de la vida, juntado en `DAMAGE_GAP_S`; al caer, el último golpe; al llegar al castillo, nada', () => {
    const tr = new DamageTracker();
    const got: number[] = [];
    const emit = (_x: number, _y: number, _r: number, amount: number) => got.push(amount);
    tr.update([enemy(1, 100), enemy(2, 100)], 0, emit);
    expect(got).toEqual([]);
    tr.update([enemy(1, 90), enemy(2, 100)], DAMAGE_GAP_S / 4, emit);
    expect(got).toEqual([]);
    tr.update([enemy(1, 80), enemy(2, 100)], DAMAGE_GAP_S + 0.01, emit);
    expect(got).toEqual([20]);
    // El 1 cae con 80 de vida; el 2 llega al castillo.
    tr.update([enemy(2, 100, { progress: 0.999 })], DAMAGE_GAP_S * 2, emit);
    tr.update([], DAMAGE_GAP_S * 3, emit);
    expect(got).toEqual([20, 80]);
    expect(tr.size).toBe(0);
  });

  it('los números: grupo fijo (el más viejo se reutiliza), se apagan solos y con el interruptor', () => {
    const nums = new DamageNumbers(3);
    expect(nums.mesh.instanceMatrix.count).toBe(3 * NUMBER_DIGITS);
    for (let i = 0; i < 5; i++) nums.spawn(i, 0, 12345, i * 0.01);
    expect(nums.pooled).toBe(3);
    nums.update(0.05, true, false);
    expect(nums.live).toBe(3);
    // 9999 como mucho: cuatro cifras por número.
    expect(nums.mesh.count).toBe(3 * NUMBER_DIGITS);
    nums.update(1 + NUMBER_S, true, false);
    expect(nums.live).toBe(0);
    expect(nums.mesh.visible).toBe(false);
    nums.spawn(0, 0, 7, 2);
    nums.update(2.1, false, false);
    expect(nums.live).toBe(0);
    expect(nums.pooled).toBe(0);
    expect(digitsOf(7)).toEqual([7]);
    expect(digitsOf(48.6)).toEqual([4, 9]);
    expect(digitsOf(123456)).toEqual([9, 9, 9, 9]);
    nums.dispose();
  });

  it('en la partida: con los dos encendidos se pintan; apagados (opciones de la pausa), ninguno', () => {
    const run = new DefenseRun({ seed: 7, quality: 'baja', devIslands: true, startAtS: 150 });
    const view = new DefenseView({ config: DEFENSE_CONFIG, path, frame, quality: 'baja' });
    expect(view.overlays).toEqual(DEFAULT_DEFENSE_OVERLAYS);
    let bars = 0;
    let nums = 0;
    for (let i = 0; i < 60 * 30; i++) {
      run.step(null);
      if (i % 3) continue;
      view.update(run.snapshot(), i / 60, { x: 0, z: 0 });
      bars = Math.max(bars, view.bars.drawn);
      nums = Math.max(nums, view.numbers.live);
      expect(view.bars.drawn).toBeLessThanOrEqual(view.bars.cap);
      expect(view.numbers.live).toBeLessThanOrEqual(view.numbers.cap);
    }
    expect(bars).toBeGreaterThan(0);
    expect(nums).toBeGreaterThan(0);
    view.setOverlays({ bars: false, numbers: false });
    for (let i = 0; i < 60 * 10; i++) {
      run.step(null);
      if (i % 3) continue;
      view.update(run.snapshot(), 30 + i / 60, { x: 0, z: 0 });
      expect(view.bars.drawn).toBe(0);
      expect(view.numbers.live).toBe(0);
    }
    view.dispose();
  });

  it('las opciones se guardan en el dispositivo; sin nada guardado (o roto), las dos encendidas', () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
    };
    expect(readDefenseOverlays(storage)).toEqual({ bars: true, numbers: true });
    saveDefenseOverlays({ bars: false, numbers: true }, storage);
    expect(JSON.parse(mem.get(DEFENSE_OVERLAYS_KEY)!)).toEqual({ bars: false, numbers: true });
    expect(readDefenseOverlays(storage)).toEqual({ bars: false, numbers: true });
    mem.set(DEFENSE_OVERLAYS_KEY, '{roto');
    expect(readDefenseOverlays(storage)).toEqual({ bars: true, numbers: true });
    expect(readDefenseOverlays(null)).toEqual({ bars: true, numbers: true });
  });
});

describe('lo que paga Ibiza se ve (plan 015 T178)', () => {
  it('«+N» y una moneda: más piezas por número que los de daño, y se apagan solos', () => {
    expect(glyphsOf(14, true)).toEqual([10, 1, 4, 11]);
    expect(glyphsOf(14, false)).toEqual([1, 4]);
    const pops = new DamageNumbers(2, COIN_POP_STYLE);
    expect(pops.mesh.instanceMatrix.count).toBe(2 * (NUMBER_DIGITS + 2));
    pops.spawn(0, 0, 59, 1);
    pops.update(1.05, true, false);
    expect(pops.live).toBe(1);
    expect(pops.mesh.count).toBe(glyphsOf(59, true).length);
    pops.update(1 + COIN_POP_S + 1e-6, true, false);
    expect(pops.live).toBe(0);
    pops.dispose();
  });

  it('cada pago de la granja salta una vez encima de la isla, aunque los números de daño estén apagados', () => {
    const run = new DefenseRun({ seed: 3, quality: 'baja' });
    const view = new DefenseView({ config: DEFENSE_CONFIG, path, frame, quality: 'baja' });
    view.setOverlays({ bars: false, numbers: false });
    const farm = run.game.addTower('tienda', -600, -600);
    const payouts = new Set<number>();
    for (let i = 0; i < 60 * 35; i++) {
      run.step(null);
      if (farm.lastShot) payouts.add(farm.lastShot.atS);
      if (i % 3) continue;
      view.update(run.snapshot(), i / 60, { x: 0, z: 0 });
      expect(view.coinPops.live).toBeLessThanOrEqual(view.coinPops.cap);
    }
    const every = DEFENSE_CONFIG.towers.kinds.tienda.levels[0].cooldownS;
    expect(payouts.size).toBe(Math.floor(35 / every));
    expect(view.coinPops.spawned).toBe(payouts.size);
    // Vendida, se olvida y no salta más.
    run.game.removeTower(farm.id);
    for (let i = 0; i < 60 * 12; i++) {
      run.step(null);
      if (i % 3 === 0) view.update(run.snapshot(), 40 + i / 60, { x: 0, z: 0 });
    }
    expect(view.coinPops.spawned).toBe(payouts.size);
    view.dispose();
  });
});

describe('las nubes de la arena (decisión 17)', () => {
  it('pasan por encima en la vista de salida, se apagan al acercar y derivan (quietas con movimiento reducido)', () => {
    const clouds = new ArenaClouds(R, 4);
    const before = clouds.offsets.map((p) => ({ ...p }));
    clouds.update(1, { x: 0, z: 0 }, 1, false);
    expect(clouds.group.visible).toBe(true);
    expect(clouds.offsets.some((p, i) => p.x !== before[i]!.x)).toBe(true);
    for (const p of clouds.offsets) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(R * 1.15 + 1e-9);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(R * 1.15 + 1e-9);
    }
    clouds.update(1, { x: 0, z: 0 }, ARENA_CLOUD_ZOOM.off, false);
    expect(clouds.group.visible).toBe(false);
    const still = clouds.offsets.map((p) => ({ ...p }));
    clouds.update(1, { x: 0, z: 0 }, 1, true);
    expect(clouds.offsets).toEqual(still);
    clouds.dispose();
  });
});
