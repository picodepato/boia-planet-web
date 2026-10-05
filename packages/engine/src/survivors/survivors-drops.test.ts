import { describe, expect, it } from 'vitest';
import { SURVIVORS_CONFIG, SURVIVORS_STEP_S, type SurvivorsConfig } from './config';
import { DROP_IDS, type DropId, flameDamage, inFlame } from './drops';
import { createSurvivors, type SurvivorsEvent, type SurvivorsGame } from './sim';
import type { SurvivorsWorld } from './world';

/**
 * El botín de las élites (plan 012 T135): la tirada (5 % y el tipo a partes
 * iguales, con el azar de la partida), los objetos que flotan y se cogen
 * tocándolos, y lo que hace cada uno: Imán total, Llama y Salvavidas.
 */

const world: SurvivorsWorld = {
  bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
  obstacles: [],
  start: { x: 0, y: 0, heading: 0 },
};
const DROPS = SURVIVORS_CONFIG.drops;

/** Sin guion ni enemigos que se muevan, el Cañón sin daño: sólo lo que la prueba pone. */
const quiet = (patch: (c: SurvivorsConfig) => void = () => {}): SurvivorsConfig => {
  const c = structuredClone(SURVIVORS_CONFIG);
  c.acts = [];
  c.salvavidas.offerChance = 0;
  c.weapons.canon!.base.damage = 0;
  for (const e of Object.values(c.enemies)) {
    e!.speed = 0;
    e!.acceleration = 0;
    e!.growthPerMinute = { hp: 0, speed: 0 };
  }
  patch(c);
  return c;
};

function run(game: SurvivorsGame, seconds: number): SurvivorsEvent[] {
  const events: SurvivorsEvent[] = [];
  for (let i = 0; i < Math.round(seconds / SURVIVORS_STEP_S) && !game.ended; i++) {
    // Las notas suben de nivel: la carta se elige sola para que el tiempo siga.
    events.push(...game.step({ choose: 0 }));
  }
  return events;
}

/** Enciende la Llama: un objeto encima del barco, que se coge en el paso. */
function light(game: SurvivorsGame): void {
  const p = game.snapshot().player;
  game.spawnPickup('llama', p.x, p.y);
  const ev = game.step();
  expect(ev.some((e) => e.type === 'pickup' && e.item === 'llama')).toBe(true);
}

/**
 * `perSeed` élites de un golpe dentro de la Llama, por semilla: las que
 * sueltan objeto y de qué tipo.
 */
function dropsOver(seeds: number, perSeed: number, cfg: SurvivorsConfig) {
  const counts: Record<DropId, number> = { iman: 0, llama: 0, salvavidas: 0 };
  let elites = 0;
  let drops = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const game = createSurvivors(cfg, seed, world);
    light(game);
    for (let k = 0; k < perSeed; k++) {
      const a = ((k % 7) - 3) * 0.08;
      const d = 50 + (k % 5) * 12;
      expect(game.spawnEnemy('piranha', Math.cos(a) * d, Math.sin(a) * d, true)).not.toBeNull();
    }
    // La Llama tarda `killS` s en cualquiera (quita su vida máxima por tramos).
    for (const e of run(game, DROPS.llama.killS + 2 * SURVIVORS_STEP_S)) {
      if (e.type === 'defeated' && e.elite) elites++;
      if (e.type === 'drop') {
        drops++;
        counts[e.item]++;
      }
    }
  }
  return { elites, drops, counts };
}

describe('T135: el botín de las élites', () => {
  it('la config: 5 % por élite, los tres objetos, y la versión sube', () => {
    expect(DROPS.chance).toBe(0.05);
    expect([...DROPS.types].sort()).toEqual([...DROP_IDS].sort());
    expect(DROPS.lifeS).toBeGreaterThan(0);
    expect(DROPS.llama.durationS).toBe(10);
    expect(DROPS.llama.killS).toBe(0.4);
    expect(DROPS.salvavidas.waterFraction).toBeGreaterThan(0);
    expect(DROPS.salvavidas.waterFraction).toBeLessThanOrEqual(1);
    expect(SURVIVORS_CONFIG.version).toBeGreaterThanOrEqual(9);
  });

  it('sobre muchas semillas, ~5 % de las élites sueltan objeto y el tipo sale a partes iguales', () => {
    // Las piezas mueren en un paso (vida casi nula) para tirar muchas veces.
    const cfg = quiet((c) => {
      c.enemies.piranha!.hp = 1e-6;
    });
    const { elites, drops, counts } = dropsOver(300, 60, cfg);
    expect(elites).toBe(300 * 60);
    const rate = drops / elites;
    expect(rate).toBeGreaterThan(DROPS.chance * 0.8);
    expect(rate).toBeLessThan(DROPS.chance * 1.2);
    for (const id of DROP_IDS) {
      expect(counts[id] / drops, id).toBeGreaterThan(1 / 3 - 0.06);
      expect(counts[id] / drops, id).toBeLessThan(1 / 3 + 0.06);
    }
  });

  it('sólo las élites sueltan objeto; con `chance` 0, nunca; con 1, siempre', () => {
    const commons = quiet((c) => {
      c.enemies.piranha!.hp = 1e-6;
      c.drops.chance = 1;
    });
    const game = createSurvivors(commons, 3, world);
    light(game);
    for (let k = 0; k < 20; k++) game.spawnEnemy('piranha', 60 + k, 0, false);
    const ev = run(game, DROPS.llama.killS + 2 * SURVIVORS_STEP_S);
    expect(ev.filter((e) => e.type === 'defeated')).toHaveLength(20);
    expect(ev.some((e) => e.type === 'drop')).toBe(false);
    expect(dropsOver(5, 20, commons).drops).toBe(100);
    const never = quiet((c) => {
      c.enemies.piranha!.hp = 1e-6;
      c.drops.chance = 0;
    });
    expect(dropsOver(5, 20, never).drops).toBe(0);
  });

  it('el objeto flota donde cayó, el imán de notas no lo arrastra, y se hunde a los `lifeS` s', () => {
    const cfg = quiet((c) => {
      c.player.magnetRadius = 1000;
    });
    const game = createSurvivors(cfg, 1, world);
    game.spawnPickup('iman', 200, 0);
    run(game, 1);
    const s = game.snapshot();
    expect(s.pickups).toHaveLength(1);
    expect([s.pickups[0]!.x, s.pickups[0]!.y]).toEqual([200, 0]);
    expect(s.pickups[0]!.lifeS).toBeCloseTo(DROPS.lifeS - 1, 5);
    run(game, DROPS.lifeS);
    expect(game.snapshot().pickups).toHaveLength(0);
    expect(game.snapshot().pickupsTaken).toBe(0);
  });

  it('tope: con `max` flotando, uno nuevo hunde al más viejo', () => {
    const game = createSurvivors(quiet(), 1, world);
    const ids = Array.from({ length: DROPS.max + 1 }, (_, k) => game.spawnPickup('iman', 300 + k * 40, 300));
    expect(game.snapshot().pickups.map((o) => o.id)).toEqual(ids.slice(1));
  });

  it('se coge al tocarlo con el casco (y no antes)', () => {
    const game = createSurvivors(quiet(), 1, world);
    const s = game.snapshot();
    const reach = DROPS.radius + s.player.radius;
    game.spawnPickup('salvavidas', reach + 5, 0);
    expect(game.step().some((e) => e.type === 'pickup')).toBe(false);
    game.spawnPickup('salvavidas', reach - 1, 0);
    const ev = game.step();
    expect(ev.filter((e) => e.type === 'pickup')).toHaveLength(1);
    expect(game.snapshot().pickupsTaken).toBe(1);
    expect(game.snapshot().pickups).toHaveLength(1);
  });

  it('Imán total: todas las notas del mar vuelan al barco', () => {
    const cfg = quiet((c) => {
      c.notes.mergeRadius = 0;
    });
    const game = createSurvivors(cfg, 1, world);
    const far: [number, number][] = [
      [1500, 0],
      [-1400, 900],
      [0, -1800],
      [1900, 1900],
      [-600, -600],
    ];
    for (const [x, y] of far) game.spawnNote(x, y, 1);
    run(game, 1);
    expect(game.snapshot().notesPicked).toBe(0);
    game.spawnPickup('iman', 0, 0);
    const ev = game.step();
    expect(ev).toContainEqual(expect.objectContaining({ type: 'pickup', item: 'iman' }));
    expect(game.snapshot().notes.every((n) => n.magnet)).toBe(true);
    run(game, 8);
    expect(game.snapshot().notesPicked).toBe(far.length);
    expect(game.snapshot().notes).toHaveLength(0);
  });

  it('Salvavidas: achica `waterFraction` de la capacidad (sin bajar de 0)', () => {
    const cfg = quiet((c) => {
      c.enemies.crab!.contactWater = 60;
    });
    const game = createSurvivors(cfg, 1, world);
    game.spawnEnemy('crab', 0, 0);
    game.step();
    const before = game.snapshot().water.level;
    expect(before).toBe(60);
    game.spawnPickup('salvavidas', 0, 0);
    game.step();
    const cap = cfg.player.waterCapacity;
    expect(game.snapshot().water.level).toBeCloseTo(Math.max(0, before - cap * DROPS.salvavidas.waterFraction), 9);
    run(game, 0.6);
    game.spawnPickup('salvavidas', 0, 0);
    game.spawnPickup('salvavidas', 0, 0);
    game.step();
    expect(game.snapshot().water.level).toBeGreaterThanOrEqual(0);
  });

  it('Llama: un común dentro cae a los 0,4 s de contacto, una élite también; lo de detrás, nada', () => {
    const cfg = quiet((c) => {
      c.enemies.crab!.hp = 500;
    });
    const game = createSurvivors(cfg, 1, world);
    light(game);
    const common = game.spawnEnemy('crab', 70, 0)!;
    const elite = game.spawnEnemy('crab', 60, 25, true)!;
    const behind = game.spawnEnemy('crab', -70, 0)!;
    expect(elite.maxHp).toBeGreaterThan(common.maxHp);
    const steps = Math.round(DROPS.llama.killS / SURVIVORS_STEP_S);
    const fallen = new Set<number>();
    for (let i = 1; i <= steps; i++) {
      for (const e of game.step()) if (e.type === 'defeated') fallen.add(e.id);
      if (i === steps - 1) {
        expect(fallen.has(common.id), 'aún no').toBe(false);
        expect(game.snapshot().enemies.find((e) => e.id === common.id)!.hp).toBeGreaterThan(0);
      }
    }
    expect(fallen.has(common.id)).toBe(true);
    expect(fallen.has(elite.id)).toBe(true);
    const back = game.snapshot().enemies.find((e) => e.id === behind.id)!;
    expect(back.hp).toBe(back.maxHp);
  });

  it('Llama: dura 10 s, sigue el rumbo del barco y se apaga', () => {
    const game = createSurvivors(quiet(), 1, world);
    light(game);
    const f = game.snapshot().flame!;
    expect(f).not.toBeNull();
    expect(f.durationS).toBe(DROPS.llama.durationS);
    expect(f.leftS).toBeCloseTo(DROPS.llama.durationS, 5);
    expect(f.heading).toBe(game.snapshot().player.heading);
    run(game, DROPS.llama.durationS - 0.5);
    expect(game.snapshot().flame?.leftS).toBeCloseTo(0.5, 1);
    run(game, 0.6);
    expect(game.snapshot().flame).toBeNull();
    // Apagada, ya no quema.
    const e = game.spawnEnemy('crab', 60, 0)!;
    run(game, 1);
    expect(game.snapshot().enemies.find((x) => x.id === e.id)!.hp).toBe(e.maxHp);
  });

  it('el gancho de los bosses: daño fijo por segundo, no un % de su vida', () => {
    const def = DROPS.llama;
    const dps = SURVIVORS_CONFIG.bossFight.flameDps;
    expect(flameDamage(def, { maxHp: 1e6, bossDps: dps }, 1)).toBe(dps);
    expect(flameDamage(def, { maxHp: 50, bossDps: dps }, 0.5)).toBe(dps * 0.5);
    expect(flameDamage(def, { maxHp: 80 }, def.killS)).toBeCloseTo(80, 9);
    expect(flameDamage(def, { maxHp: 80 }, 0)).toBe(0);
    // El sector: delante dentro, detrás fuera, el borde del círculo cuenta.
    expect(inFlame(def, 0, def.range - 1, 0, 1)).toBe(true);
    expect(inFlame(def, 0, -20, 0, 5)).toBe(false);
    expect(inFlame(def, 0, def.range + 8, 0, 10)).toBe(true);
    expect(inFlame(def, Math.PI / 2, 0, 50, 1)).toBe(true);
    expect(inFlame(def, Math.PI / 2, 50, 0, 1)).toBe(false);
  });

  it('Llama contra bosses (T137): daño fijo `bossFight.flameDps` por segundo al que está dentro; al de detrás, nada', () => {
    const cfg = quiet((c) => {
      c.player.waterCapacity = 1e12;
      c.bosses.prueba!.speed = 0;
      c.bosses.prueba!.acceleration = 0;
    });
    const game = createSurvivors(cfg, 1, world);
    light(game);
    const ahead = game.spawnBoss('prueba', 100, 0)!;
    const behind = game.spawnBoss('prueba', -400, 0)!;
    const dps = cfg.bossFight.flameDps;
    const hits = run(game, 1).filter(
      (e): e is Extract<SurvivorsEvent, { type: 'bossDamaged' }> => e.type === 'bossDamaged',
    );
    expect(hits.length).toBeGreaterThan(30);
    for (const h of hits) {
      expect(h.id).toBe(ahead.id);
      expect(h.damage).toBeCloseTo(dps * SURVIVORS_STEP_S, 9);
    }
    const bosses = game.snapshot().bosses;
    expect(bosses.find((b) => b.id === behind.id)!.hp).toBe(behind.maxHp);
    // No es un % de su vida: le queda casi toda (la mató la Llama a un común en 0,4 s).
    expect(bosses.find((b) => b.id === ahead.id)!.hpFraction).toBeGreaterThan(0.5);
  });

  it('determinista: misma semilla, mismos objetos y misma partida; el botín no cambia lo que aparece', () => {
    const cfg = structuredClone(SURVIVORS_CONFIG);
    cfg.drops.chance = 0.5;
    const play = (c: SurvivorsConfig, seed: number) => {
      const game = createSurvivors(c, seed, world, { startAtS: 215 });
      const drops: string[] = [];
      for (let i = 0; i < Math.round(25 / SURVIVORS_STEP_S) && !game.ended; i++) {
        for (const e of game.step({ choose: 0 })) {
          if (e.type === 'drop') drops.push(`${e.item}@${e.id}:${Math.round(e.x)},${Math.round(e.y)}`);
        }
      }
      return { drops, hash: game.stateHash() };
    };
    const a = play(cfg, 11);
    const b = play(cfg, 11);
    expect(a.drops.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
    expect(play(cfg, 12).hash).not.toBe(a.hash);
  });
});
