import { describe, expect, it } from 'vitest';
import { rng } from '../minigames/rng';
import type { ShipInput } from '../ship/controller';
import {
  type EnemyId,
  NO_WEAPON_MODIFIERS,
  SURVIVORS_CONFIG,
  SURVIVORS_STEP_S,
  type SurvivorsConfig,
  type WeaponId,
  type WeaponKind,
  resolveWeaponStats,
  weaponStatsAt,
} from './config';
import {
  type SurvivorsEvent,
  type SurvivorsGame,
  type SurvivorsInput,
  createSurvivors,
} from './sim';
import type { SurvivorsWorld } from './world';

/**
 * Beta 2 (plan 011, T127): el sistema de armas por datos con las 7 armas
 * del diseño (§5) y su tabla fija por nivel. Cada arma tiene su prueba: a
 * qué pega según su forma, que la tabla de niveles se aplica y que las
 * islas sólo paran lo recto. Los ayudantes se repiten de los otros archivos.
 */

// --- Mundos y ayudantes -------------------------------------------------------

const WEAPONS: readonly WeaponId[] = [
  'canon',
  'subwoofer',
  'laser',
  'buoys',
  'confetti',
  'fireworks',
  'acidRain',
];

function archipelago(seed: number): SurvivorsWorld {
  const r = rng(seed);
  const obstacles = [];
  for (let i = 0; i < 45; i++) {
    const x = -1800 + r() * 3600;
    const y = -1800 + r() * 3600;
    if (Math.hypot(x, y) < 260) continue;
    obstacles.push({ x, y, radius: 40 + r() * 150 });
  }
  return {
    bounds: { left: -1800, right: 1800, top: -1800, bottom: 1800 },
    obstacles,
    start: { x: 0, y: 0 },
  };
}

function openSea(obstacles: SurvivorsWorld['obstacles'] = []): SurvivorsWorld {
  return {
    bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
    obstacles,
    start: { x: 0, y: 0, heading: 0 },
  };
}

function withConfig(patch: (c: SurvivorsConfig) => void): SurvivorsConfig {
  const c = structuredClone(SURVIVORS_CONFIG);
  patch(c);
  return c;
}

/**
 * Sin guion ni hitos, barco insumergible y sólo el arma `weapon` (como arma
 * inicial): lo que la prueba pone es lo único que hay.
 */
const only = (weapon: WeaponId, patch: (c: SurvivorsConfig) => void = () => {}) =>
  withConfig((c) => {
    c.acts = [{ act: 1, durationS: c.durationS, tracks: [], events: [] }];
    c.player.waterCapacity = 1e12;
    c.startingWeapon = weapon;
    // Un enemigo quieto: así la prueba mide la forma del arma, no la persecución.
    for (const e of Object.values(c.enemies)) {
      if (!e) continue;
      e.speed = 0;
      e.acceleration = 0;
      e.growthPerMinute = { hp: 0, speed: 0 };
    }
    patch(c);
  });

const idle: SurvivorsInput = { ship: { dirX: 0, dirY: 0, throttle: 0, drift: false } };

function scriptedInput(step: number): SurvivorsInput {
  const a = step * 0.01;
  const ship: ShipInput = {
    dirX: Math.cos(a) + 0.3 * Math.sin(step * 0.05),
    dirY: Math.sin(a),
    throttle: 0.8,
    drift: false,
  };
  return { ship, choose: 0 };
}

/** Juega `seconds` s (o hasta el final) con `input`, juntando los sucesos. */
function run(
  game: SurvivorsGame,
  seconds: number,
  input: (step: number) => SurvivorsInput = () => idle,
  each: (game: SurvivorsGame, ev: readonly SurvivorsEvent[]) => void = () => {},
): SurvivorsEvent[] {
  const events: SurvivorsEvent[] = [];
  const steps = Math.round(seconds / SURVIVORS_STEP_S);
  for (let i = 0; i < steps && !game.ended; i++) {
    const ev = game.step(input(i));
    for (const e of ev) events.push({ ...e });
    each(game, ev);
  }
  return events;
}

const lvl = (id: WeaponId, level: number) =>
  resolveWeaponStats(SURVIVORS_CONFIG.weapons[id]!, level);

// --- Tabla por nivel ----------------------------------------------------------

describe('survivors armas: las 7 del diseño con tabla fija por nivel', () => {
  it('cada arma: forma, nombre, 5 niveles con lo que gana cada uno, y lo recto es lo que las islas paran', () => {
    const c = SURVIVORS_CONFIG;
    expect(Object.keys(c.weapons).sort()).toEqual([...WEAPONS].sort());
    const kinds: Record<WeaponId, WeaponKind> = {
      canon: 'projectile',
      subwoofer: 'aura',
      laser: 'beam',
      buoys: 'orbit',
      confetti: 'cone',
      fireworks: 'rocket',
      acidRain: 'zone',
    };
    for (const id of WEAPONS) {
      const w = c.weapons[id]!;
      expect(w.id).toBe(id);
      expect(w.kind).toBe(kinds[id]);
      expect(w.i18nKey).toBe(`survivors.weapon.${id}`);
      expect(w.maxLevel).toBe(5);
      expect(w.levels).toHaveLength(w.maxLevel - 1);
      w.levels.forEach((l, i) => {
        expect(l.i18nKey).toBe(`survivors.weapon.${id}.l${i + 2}`);
        expect(l.gains.length).toBeGreaterThan(0);
        for (const g of l.gains) expect(g.amount).not.toBe(0);
      });
      // Sólo lo recto lo paran las islas.
      expect(w.blockedByIslands).toBe(w.kind === 'projectile' || w.kind === 'cone');
      expect(w.base.damage).toBeGreaterThan(0);
      // Cada nivel mejora: nunca vuelve a los números de antes.
      for (let l = 2; l <= w.maxLevel; l++) {
        expect(weaponStatsAt(w, l)).not.toEqual(weaponStatsAt(w, l - 1));
      }
      // Los tiempos nunca llegan a 0 por la tabla.
      const top = weaponStatsAt(w, w.maxLevel);
      if (w.base.cooldownS > 0) expect(top.cooldownS).toBeGreaterThan(0);
      if (w.base.tickS > 0) expect(top.tickS).toBeGreaterThan(0);
    }
    expect(c.startingWeapon).toBe('canon');
  });

  it('la tabla suma nivel a nivel y los fuera de rango se recortan', () => {
    const w = SURVIVORS_CONFIG.weapons.buoys!;
    const l1 = weaponStatsAt(w, 1);
    expect(l1).toEqual(w.base);
    const l3 = weaponStatsAt(w, 3);
    let expected = { ...w.base };
    for (const l of w.levels.slice(0, 2)) for (const g of l.gains) expected[g.stat] += g.amount;
    expect(l3).toEqual(expected);
    expected = { ...w.base };
    for (const l of w.levels) for (const g of l.gains) expected[g.stat] += g.amount;
    expect(weaponStatsAt(w, 5)).toEqual(expected);
    expect(weaponStatsAt(w, 9)).toEqual(expected);
    expect(weaponStatsAt(w, 0)).toEqual(w.base);
  });

  it('el gancho de mejoras y vinilos: daño, velocidad de ataque, área y proyectiles extra', () => {
    const plain = resolveWeaponStats(SURVIVORS_CONFIG.weapons.canon!, 1);
    expect(plain).toEqual(weaponStatsAt(SURVIVORS_CONFIG.weapons.canon!, 1));
    expect(resolveWeaponStats(SURVIVORS_CONFIG.weapons.canon!, 1, NO_WEAPON_MODIFIERS)).toEqual(
      plain,
    );
    const mods = { damageBonus: 0.5, fireRateBonus: 1, areaBonus: 0.25, extraProjectiles: 2 };
    for (const id of WEAPONS) {
      const w = SURVIVORS_CONFIG.weapons[id]!;
      const base = weaponStatsAt(w, 3);
      const m = resolveWeaponStats(w, 3, mods);
      expect(m.damage).toBeCloseTo(base.damage * 1.5, 9);
      expect(m.area).toBeCloseTo(base.area * 1.25, 9);
      if (base.cooldownS > 0) expect(m.cooldownS).toBeCloseTo(base.cooldownS / 2, 9);
      else expect(m.cooldownS).toBe(0);
      if (base.tickS > 0) expect(m.tickS).toBeCloseTo(base.tickS / 2, 9);
      else expect(m.tickS).toBe(0);
      expect(m.count).toBe(base.count + (w.extraProjectilesApply ? 2 : 0));
      // Lo que no cambia, no cambia.
      expect([m.range, m.speed, m.spreadRad, m.pierce, m.durationS]).toEqual([
        base.range,
        base.speed,
        base.spreadRad,
        base.pierce,
        base.durationS,
      ]);
    }
    // Rumba («+1 proyectil») entra en bolas, confetis y cohetes; no en auras, rayos, boyas ni nubes.
    expect(
      WEAPONS.filter((id) => SURVIVORS_CONFIG.weapons[id]!.extraProjectilesApply).sort(),
    ).toEqual(['canon', 'confetti', 'fireworks'].sort());
    // Un tiempo nunca baja de un paso.
    const fast = resolveWeaponStats(SURVIVORS_CONFIG.weapons.laser!, 5, {
      ...mods,
      fireRateBonus: 1e6,
    });
    expect(fast.tickS).toBe(SURVIVORS_STEP_S);
  });

  it('en la partida, las mejoras de la carta rehacen los números de todas las armas', () => {
    const cfg = only('canon', (c) => {
      c.upgrades = c.upgrades.filter((u) => u.id === 'projectiles');
    });
    const game = createSurvivors(cfg, 1, openSea());
    expect(game.addWeapon('subwoofer')).toBe(true);
    expect(game.addWeapon('subwoofer')).toBe(false);
    expect(game.heldWeapons).toEqual([
      { id: 'canon', level: 1 },
      { id: 'subwoofer', level: 1 },
    ]);
    const before = game.snapshot().weapons.map((w) => w.stats.count);
    game.spawnNote(0, 0, 10_000);
    game.step(idle);
    expect(game.status).toBe('card');
    game.step({ ...idle, choose: 0 });
    const after = game.snapshot().weapons;
    expect(after[0]!.stats.count).toBe(before[0]! + 1);
    expect(after[1]!.stats.count).toBe(before[1]!);
    // Subir de nivel aplica la tabla encima de la mejora.
    expect(game.levelUpWeapon('canon')).toBe(true);
    expect(game.levelUpWeapon('canon')).toBe(true);
    expect(game.weaponLevel('canon')).toBe(3);
    expect(game.snapshot().weapons[0]!.stats.count).toBe(lvl('canon', 3).count + 1);
    for (let i = 0; i < 2; i++) expect(game.levelUpWeapon('canon')).toBe(true);
    expect(game.levelUpWeapon('canon')).toBe(false);
    expect(game.weaponLevel('canon')).toBe(5);
    expect(game.weaponLevel('laser')).toBe(0);
    expect(game.levelUpWeapon('laser')).toBe(false);
  });
});

// --- Una prueba por arma --------------------------------------------------------

describe('survivors armas: Cañón de agua (proyectil recto)', () => {
  it('dispara al más cercano; a nivel 3 salen 2 bolas por disparo', () => {
    for (const level of [1, 3]) {
      const game = createSurvivors(only('canon'), 1, openSea());
      if (level > 1) for (let l = 1; l < level; l++) game.levelUpWeapon('canon');
      const near = game.spawnEnemy('crab', 250, 0)!;
      const far = game.spawnEnemy('crab', -500, 0)!;
      const ev = run(game, 1.2);
      const fires = ev.filter((e) => e.type === 'fire');
      expect(fires.length).toBeGreaterThan(0);
      for (const f of fires) {
        if (f.type === 'fire') {
          expect(f.weapon).toBe('canon');
          expect(f.count).toBe(lvl('canon', level).count);
        }
      }
      expect(near.hp).toBeLessThan(near.maxHp);
      expect(far.hp).toBe(far.maxHp);
      for (const p of game.snapshot().projectiles)
        expect(p).toMatchObject({ weapon: 'canon', kind: 'projectile' });
    }
  });
});

describe('survivors armas: Subwoofer (aura)', () => {
  it('golpea cada tic a lo que entra en el aura, también a través de una isla; a nivel 2 el aura es mayor', () => {
    const l1 = lvl('subwoofer', 1);
    const l2 = lvl('subwoofer', 2);
    expect(l2.area).toBeGreaterThan(l1.area);
    const dist = (l1.area + l2.area) / 2;
    for (const level of [1, 2]) {
      // Isla entre el barco y el enemigo: el aura pasa por encima.
      const game = createSurvivors(
        only('subwoofer'),
        1,
        openSea([{ x: dist / 2, y: 0, radius: 18 }]),
      );
      if (level === 2) game.levelUpWeapon('subwoofer');
      // El aura toca el borde del enemigo: uno pequeño, para que la distancia mande.
      const edge = game.spawnEnemy('piranha', dist, 0)!;
      const inside = game.spawnEnemy('crab', 0, -l1.area * 0.5)!;
      const outside = game.spawnEnemy('crab', -l2.area * 1.5, 0)!;
      const ev = run(game, l1.tickS * 2.5);
      expect(ev.some((e) => e.type === 'blocked')).toBe(false);
      // 3 tics: al empezar, a tickS y a 2·tickS.
      expect(inside.hp).toBeCloseTo(inside.maxHp - 3 * l1.damage, 6);
      expect(outside.hp).toBe(outside.maxHp);
      if (level === 1) expect(edge.hp).toBe(edge.maxHp);
      else expect(edge.hp).toBeLessThan(edge.maxHp);
      const s = game.snapshot();
      expect(s.auras).toHaveLength(1);
      expect(s.auras[0]).toMatchObject({
        weapon: 'subwoofer',
        x: 0,
        y: 0,
        radius: level === 1 ? l1.area : l2.area,
      });
      expect(s.weapons[0]).toMatchObject({ id: 'subwoofer', kind: 'aura', level, maxLevel: 5 });
    }
  });
});

describe('survivors armas: Láser de festival (rayo que gira)', () => {
  it('barre una vuelta entera y pega a lo que cruza, por encima de las islas; nivel 2 llega más lejos; nivel 5 son 2 rayos', () => {
    const l1 = lvl('laser', 1);
    const l2 = lvl('laser', 2);
    expect(l2.range).toBeGreaterThan(l1.range);
    const turnS = (Math.PI * 2) / l1.speed;
    const dist = (l1.range + l2.range) / 2;
    for (const level of [1, 2]) {
      const game = createSurvivors(only('laser'), 1, openSea([{ x: 0, y: 90, radius: 30 }]));
      if (level === 2) game.levelUpWeapon('laser');
      const around = (['piranha', 'crab', 'jellyfish', 'pirate'] as EnemyId[]).map((t, i) =>
        game.spawnEnemy(
          t,
          Math.cos((i / 4) * Math.PI * 2) * 180,
          Math.sin((i / 4) * Math.PI * 2) * 180,
        )!,
      );
      const edge = game.spawnEnemy('crab', dist, 0)!;
      const ev = run(game, turnS * 1.1);
      expect(ev.some((e) => e.type === 'blocked')).toBe(false);
      // Los cuatro, también el que tiene la isla delante (0, 180).
      for (const e of around) expect(e.hp).toBeLessThan(e.maxHp);
      if (level === 1) expect(edge.hp).toBe(edge.maxHp);
      else expect(edge.hp).toBeLessThan(edge.maxHp);
      const s = game.snapshot();
      expect(s.beams).toHaveLength(1);
      expect(s.beams[0]).toMatchObject({
        weapon: 'laser',
        length: level === 1 ? l1.range : l2.range,
        halfWidth: l1.area,
      });
      expect(s.projectiles).toHaveLength(0);
    }
    const game = createSurvivors(only('laser'), 1, openSea());
    for (let l = 1; l < 5; l++) game.levelUpWeapon('laser');
    game.step(idle);
    const beams = game.snapshot().beams;
    expect(beams).toHaveLength(lvl('laser', 5).count);
    expect(beams).toHaveLength(2);
    expect(Math.abs(((beams[1]!.angle - beams[0]!.angle) % (Math.PI * 2)) - Math.PI)).toBeLessThan(
      1e-6,
    );
  });

  it('el rayo gira: su ángulo avanza a su velocidad', () => {
    const game = createSurvivors(only('laser'), 1, openSea());
    game.step(idle);
    const a0 = game.snapshot().beams[0]!.angle;
    run(game, 0.5);
    const a1 = game.snapshot().beams[0]!.angle;
    const turned = (((a1 - a0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    expect(turned).toBeCloseTo(lvl('laser', 1).speed * 0.5, 3);
  });
});

describe('survivors armas: Boyas orbitales', () => {
  it('2 boyas en órbita pegan a lo que tocan (3 desde el nivel 3); pasan por encima de una isla', () => {
    const l1 = lvl('buoys', 1);
    const l3 = lvl('buoys', 3);
    expect(l3.count).toBe(l1.count + 1);
    for (const level of [1, 3]) {
      // Isla sobre la propia órbita: las boyas la cruzan.
      const game = createSurvivors(only('buoys'), 1, openSea([{ x: -l1.range, y: 0, radius: 24 }]));
      if (level === 3) for (let l = 1; l < 3; l++) game.levelUpWeapon('buoys');
      const onOrbit = game.spawnEnemy('crab', 0, l1.range)!;
      const farOut = game.spawnEnemy('crab', 0, l1.range + l1.area + 60)!;
      const turnS = (Math.PI * 2) / l1.speed;
      const ev = run(game, turnS * 1.1);
      expect(ev.some((e) => e.type === 'blocked')).toBe(false);
      expect(onOrbit.hp).toBeLessThan(onOrbit.maxHp);
      expect(farOut.hp).toBe(farOut.maxHp);
      const s = game.snapshot();
      expect(s.orbitals).toHaveLength(level === 1 ? l1.count : l3.count);
      for (const o of s.orbitals) {
        expect(o.weapon).toBe('buoys');
        expect(Math.hypot(o.x, o.y)).toBeCloseTo(l1.range, 6);
        expect(o.radius).toBe(l1.area);
      }
    }
  });
});

describe('survivors armas: Cañón de confeti (abanico recto)', () => {
  it('ráfaga hacia donde navega el barco: pega delante, no detrás; nivel 2 tira más confetis', () => {
    const l1 = lvl('confetti', 1);
    const l2 = lvl('confetti', 2);
    expect(l2.count).toBeGreaterThan(l1.count);
    for (const level of [1, 2]) {
      const game = createSurvivors(only('confetti'), 1, openSea());
      if (level === 2) game.levelUpWeapon('confetti');
      const ahead = game.spawnEnemy('crab', 200, 0)!;
      const behind = game.spawnEnemy('crab', -200, 0)!;
      const ev = run(game, 1);
      const fires = ev.filter((e) => e.type === 'fire');
      expect(fires.length).toBeGreaterThan(0);
      for (const f of fires)
        if (f.type === 'fire') expect(f.count).toBe(level === 1 ? l1.count : l2.count);
      expect(ahead.hp).toBeLessThan(ahead.maxHp);
      expect(behind.hp).toBe(behind.maxHp);
    }
  });

  it('una isla delante para el confeti (recto): nada llega detrás', () => {
    const game = createSurvivors(only('confetti'), 1, openSea([{ x: 110, y: 0, radius: 40 }]));
    const ahead = game.spawnEnemy('crab', 220, 0)!;
    const ev = run(game, 3);
    expect(ev.filter((e) => e.type === 'fire').length).toBeGreaterThan(0);
    const blocked = ev.filter((e) => e.type === 'blocked');
    expect(blocked.length).toBeGreaterThan(0);
    for (const b of blocked) if (b.type === 'blocked') expect(b.owner).toBe('player');
    expect(ahead.hp).toBe(ahead.maxHp);
  });
});

describe('survivors armas: Fuegos artificiales (cohetes que explotan)', () => {
  it('el cohete vuela por encima de una isla hasta su blanco y explota en área; a nivel 3 salen 2', () => {
    const l1 = lvl('fireworks', 1);
    const l3 = lvl('fireworks', 3);
    expect(l3.count).toBe(l1.count + 1);
    for (const level of [1, 3]) {
      const game = createSurvivors(only('fireworks'), 1, openSea([{ x: 250, y: 0, radius: 70 }]));
      if (level === 3) for (let l = 1; l < 3; l++) game.levelUpWeapon('fireworks');
      const stats = level === 1 ? l1 : l3;
      const target = game.spawnEnemy('crab', 500, 0)!;
      const beside = game.spawnEnemy('crab', 500 + l1.area * 0.6, 0)!;
      const ev = run(game, 500 / l1.speed + 0.5);
      const fires = ev.filter((e) => e.type === 'fire');
      expect(fires.length).toBeGreaterThan(0);
      if (fires[0]!.type === 'fire') expect(fires[0]!.count).toBe(stats.count);
      expect(ev.some((e) => e.type === 'blocked')).toBe(false);
      const booms = ev.filter((e) => e.type === 'explode');
      expect(booms.length).toBeGreaterThan(0);
      for (const b of booms) {
        if (b.type !== 'explode') continue;
        expect(b.weapon).toBe('fireworks');
        // Nivel 2: «+15 de área».
        expect(b.radius).toBe(stats.area);
        // Estalla encima del blanco.
        expect(Math.hypot(b.x - 500, b.y)).toBeLessThan(l1.area);
      }
      // El blanco y el de al lado (dentro del área) reciben la explosión.
      expect(target.hp).toBeLessThan(target.maxHp);
      expect(beside.hp).toBeLessThan(beside.maxHp);
    }
  });

  it('elige blancos al azar entre los que tiene a tiro (determinista por semilla)', () => {
    const cfg = only('fireworks', (c) => {
      c.weapons.fireworks!.base.damage = 1;
    });
    const hits = (seed: number) => {
      const game = createSurvivors(cfg, seed, openSea());
      const ring = Array.from({ length: 8 }, (_, i) =>
        game.spawnEnemy(
          'crab',
          Math.cos((i / 8) * Math.PI * 2) * 300,
          Math.sin((i / 8) * Math.PI * 2) * 300,
        )!,
      );
      run(game, 30);
      return ring.map((e) => e.maxHp - e.hp);
    };
    const a = hits(3);
    expect(a.filter((d) => d > 0).length).toBeGreaterThan(2);
    expect(hits(3)).toEqual(a);
    expect(hits(4)).not.toEqual(a);
  });

  it('un cohete en vuelo lleva su arma en la foto; si el blanco cae antes, estalla donde está', () => {
    // La nube de la Lluvia ácida (daño enorme) tumba al blanco en el mismo
    // paso en que sale el cohete: al siguiente, el cohete ya no tiene a quién ir.
    const cfg = only('fireworks', (c) => {
      c.weapons.acidRain!.base.damage = 1e6;
    });
    const game = createSurvivors(cfg, 1, openSea());
    game.spawnEnemy('piranha', 550, 0);
    game.step(idle);
    const s = game.snapshot();
    expect(s.projectiles).toHaveLength(1);
    expect(s.projectiles[0]).toMatchObject({ weapon: 'fireworks', kind: 'rocket' });
    expect(s.enemies).toHaveLength(1);
    game.addWeapon('acidRain');
    const ev = run(game, 0.2);
    expect(ev.filter((e) => e.type === 'defeated')).toHaveLength(1);
    const booms = ev.filter((e) => e.type === 'explode');
    expect(booms).toHaveLength(1);
    // Lejos del blanco: estalló donde iba.
    if (booms[0]!.type === 'explode')
      expect(Math.hypot(booms[0]!.x - 550, booms[0]!.y)).toBeGreaterThan(400);
    expect(game.snapshot().projectiles).toHaveLength(0);
  });
});

describe('survivors armas: Lluvia ácida (zona que daña cada segundo)', () => {
  it('la nube cae sobre el grupo más apretado, también detrás de una isla, y daña cada segundo mientras dura', () => {
    const l1 = lvl('acidRain', 1);
    const l4 = lvl('acidRain', 4);
    expect(l4.durationS).toBeGreaterThan(l1.durationS);
    for (const level of [1, 4]) {
      const game = createSurvivors(only('acidRain'), 1, openSea([{ x: 200, y: 0, radius: 60 }]));
      if (level === 4) for (let l = 1; l < 4; l++) game.levelUpWeapon('acidRain');
      // Cangrejos: aguantan los dos tics a cualquier nivel.
      const group = [0, 1, 2, 3].map((i) =>
        game.spawnEnemy('crab', 400 + (i % 2) * 50, (i >> 1) * 50)!,
      );
      const lone = game.spawnEnemy('crab', -400, 0)!;
      const stats = level === 1 ? l1 : l4;
      const seen: number[] = [];
      const ev = run(game, 1.5 * l1.tickS + 0.01, undefined, (g) =>
        seen.push(g.snapshot().zones.length),
      );
      expect(ev.some((e) => e.type === 'blocked')).toBe(false);
      expect(Math.max(...seen)).toBe(1);
      const z = game.snapshot().zones[0]!;
      expect(z).toMatchObject({
        weapon: 'acidRain',
        radius: stats.area,
        durationS: stats.durationS,
      });
      expect(Math.hypot(z.x - 400, z.y)).toBeLessThan(40);
      expect(z.lifeS).toBeLessThan(stats.durationS);
      expect(z.lifeS).toBeGreaterThan(0);
      // Dos tics (al caer y al segundo); el de lejos, nada.
      for (const e of group) expect(e.hp).toBeCloseTo(e.maxHp - 2 * stats.damage, 6);
      expect(lone.hp).toBe(lone.maxHp);
      // Se deshace al acabar (el arma puede haber echado otra nube sobre el de lejos).
      run(game, z.lifeS + 0.05);
      expect(game.snapshot().zones.some((other) => other.id === z.id)).toBe(false);
    }
  });

  it('el tope de zonas de la calidad se toca y nunca se pasa', () => {
    const cfg = only('acidRain', (c) => {
      c.weapons.acidRain!.base.cooldownS = 0.1;
      c.weapons.acidRain!.base.durationS = 60;
      c.weapons.acidRain!.base.damage = 0.001;
      c.weapons.acidRain!.base.area = 10;
    });
    for (const quality of ['alta', 'baja'] as const) {
      const game = createSurvivors(cfg, 1, openSea(), { quality });
      for (let i = 0; i < 40; i++) game.spawnEnemy('crab', -800 + i * 40, (i % 5) * 60 - 120);
      let max = 0;
      run(game, 10, undefined, (g) => {
        max = Math.max(max, g.snapshot().zones.length);
      });
      expect(max).toBe(SURVIVORS_CONFIG.caps[quality].areas);
    }
    expect(SURVIVORS_CONFIG.caps.alta.areas).toBeGreaterThan(SURVIVORS_CONFIG.caps.baja.areas);
  });
});

// --- Partida con las 7 armas --------------------------------------------------

describe('survivors armas: partida con las 7 armas', () => {
  it('7:00 enteros en `baja` con todo a nivel 5: determinista, dentro de los topes, y cae algún enemigo de cada tipo', () => {
    const cfg = withConfig((c) => {
      c.player.waterCapacity = 1e12;
    });
    const make = (seed: number) => {
      const game = createSurvivors(cfg, seed, archipelago(21), { quality: 'baja' });
      for (const id of WEAPONS) {
        if (id !== cfg.startingWeapon) expect(game.addWeapon(id)).toBe(true);
        while (game.levelUpWeapon(id)) {
          /* hasta el máximo */
        }
      }
      return game;
    };
    const a = make(5);
    const b = make(5);
    expect(a.heldWeapons).toHaveLength(7);
    for (const w of a.heldWeapons) expect(w.level).toBe(5);
    const caps = cfg.caps.baja;
    const killed = new Set<EnemyId>();
    let maxProjectiles = 0;
    let maxZones = 0;
    let step = 0;
    while (!a.ended) {
      const input = scriptedInput(step);
      const ev = a.step(input);
      b.step(input);
      for (const e of ev) if (e.type === 'defeated') killed.add(e.enemy);
      const s = a.snapshot();
      maxProjectiles = Math.max(maxProjectiles, s.projectiles.length);
      maxZones = Math.max(maxZones, s.zones.length);
      expect(s.enemies.length).toBeLessThanOrEqual(caps.enemies);
      if (step % 600 === 0) expect(b.stateHash()).toBe(a.stateHash());
      step++;
    }
    expect(a.snapshot().end).toBe('survived');
    expect(b.stateHash()).toBe(a.stateHash());
    expect(maxProjectiles).toBeLessThanOrEqual(caps.projectiles);
    expect(maxZones).toBeLessThanOrEqual(caps.areas);
    expect(maxZones).toBeGreaterThan(0);
    // Con las 7 armas cae de todo (con el cañón solo, la beta 1 sólo tumbaba pirañas y gaviotas).
    expect([...killed].sort()).toEqual((Object.keys(cfg.enemies) as EnemyId[]).sort());
    // La foto trae lo que la pantalla pinta de cada arma.
    const s = a.snapshot();
    expect(s.weapons.map((w) => w.id)).toEqual(WEAPONS);
    expect(s.auras).toHaveLength(1);
    expect(s.beams).toHaveLength(lvl('laser', 5).count);
    expect(s.orbitals).toHaveLength(lvl('buoys', 5).count);
  }, 120_000);

  it('otra semilla da otra partida', () => {
    const make = (seed: number) => {
      const game = createSurvivors(SURVIVORS_CONFIG, seed, archipelago(22), { startAtS: 200 });
      for (const id of WEAPONS) game.addWeapon(id);
      run(game, 20, scriptedInput);
      return game.stateHash();
    };
    expect(make(1)).toBe(make(1));
    expect(make(1)).not.toBe(make(2));
  });
});
