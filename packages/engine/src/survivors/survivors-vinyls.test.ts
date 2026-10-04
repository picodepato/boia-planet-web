import { describe, expect, it } from 'vitest';
import { esMar } from '../../../../apps/web/lib/i18n/es-mar';
import { DEFAULT_SHIP_CONFIG } from '../ship/config';
import { shipSpeed } from '../ship/controller';
import { buildCardPool, eligibleEvolutions, type Inventory } from './cards';
import {
  SURVIVORS_CONFIG,
  SURVIVORS_CONFIG_VERSION,
  SURVIVORS_STEP_S,
  resolveWeaponStats,
  type EvolutionDef,
  type PassiveId,
  type SurvivorsConfig,
  type WeaponId,
} from './config';
import { createSurvivors, type SurvivorsEvent, type SurvivorsGame } from './sim';
import type { SurvivorsWorld } from './world';

const world: SurvivorsWorld = {
  bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
  obstacles: [],
  start: { x: 0, y: 0, heading: 0 },
};
const weaponIds = Object.keys(SURVIVORS_CONFIG.weapons) as WeaponId[];
const vinylIds = Object.keys(SURVIVORS_CONFIG.passives) as PassiveId[];
const quiet = (patch: (c: SurvivorsConfig) => void = () => {}): SurvivorsConfig => {
  const c = structuredClone(SURVIVORS_CONFIG);
  c.acts = [];
  c.salvavidas.offerChance = 0;
  for (const e of Object.values(c.enemies)) {
    e!.speed = 0;
    e!.acceleration = 0;
    e!.growthPerMinute = { hp: 0, speed: 0 };
  }
  patch(c);
  return c;
};
const inventory = (game: SurvivorsGame): Inventory => ({
  weapons: game.snapshot().weapons,
  vinyls: game.heldVinyls,
  salvavidas: game.snapshot().salvavidas,
});
function nextCard(game: SurvivorsGame) {
  const s = game.snapshot();
  game.spawnNote(s.player.x, s.player.y, s.xp.toNext - s.xp.xp);
  game.step();
  expect(game.status).toBe('card');
  return game.snapshot().card!;
}
function run(game: SurvivorsGame, seconds: number): SurvivorsEvent[] {
  const events: SurvivorsEvent[] = [];
  for (let i = 0; i < Math.ceil(seconds / SURVIVORS_STEP_S) && !game.ended; i++) {
    events.push(...game.step());
  }
  return events;
}
function evolutionGame(e: EvolutionDef) {
  const cfg = quiet((c) => {
    c.startingWeapon = e.weapon;
    c.player.waterCapacity = 1e12;
    for (const enemy of Object.values(c.enemies)) enemy!.hp = 1e6;
  });
  const game = createSurvivors(cfg, 42, world);
  while (game.levelUpWeapon(e.weapon)) {
    /* source maximum */
  }
  game.addVinyl(e.passive);
  expect(game.evolveWeapon(e.id)).toBe(true);
  return game;
}

describe('T129: vinyl tables and slots', () => {
  it('versions the rules once and defines every design vinyl with fixed increments', () => {
    expect(SURVIVORS_CONFIG_VERSION).toBe(4);
    expect(vinylIds.sort()).toEqual(
      ['techno', 'reggaeton', 'house', 'dnb', 'disco', 'chill', 'hardstyle', 'pop', 'rumba'].sort(),
    );
    for (const def of Object.values(SURVIVORS_CONFIG.passives)) {
      expect(def!.levels).toHaveLength(def!.maxLevel);
      expect(def!.levels.every((l) => l.amount > 0)).toBe(true);
      const game = createSurvivors(quiet(), 1, world);
      expect(game.addVinyl(def!.id)).toBe(true);
      for (let level = 1; level <= def!.maxLevel; level++) {
        const total = def!.levels.slice(0, level).reduce((sum, l) => sum + l.amount, 0);
        expect(game.snapshot().stats[def!.stat]).toBeCloseTo(total);
        expect(game.vinylLevel(def!.id)).toBe(level);
        if (level < def!.maxLevel) expect(game.levelUpVinyl(def!.id)).toBe(true);
      }
      expect(game.levelUpVinyl(def!.id)).toBe(false);
      expect(game.addVinyl(def!.id)).toBe(false);
    }
  });

  it('enforces independent slot limits in public APIs and the pool', () => {
    const cfg = quiet();
    const game = createSurvivors(cfg, 1, world);
    for (const id of weaponIds.filter((id) => id !== cfg.startingWeapon)) {
      const free = game.heldWeapons.length < cfg.slots.weapons;
      expect(game.addWeapon(id, cfg.weapons[id]!.maxLevel + 1)).toBe(free);
    }
    for (const id of vinylIds) {
      const free = game.heldVinyls.length < cfg.slots.vinyls;
      expect(game.addVinyl(id, cfg.passives[id]!.maxLevel + 1)).toBe(free);
    }
    expect(game.heldWeapons).toHaveLength(cfg.slots.weapons);
    expect(game.heldVinyls).toHaveLength(cfg.slots.vinyls);
    const pool = buildCardPool(cfg, inventory(game));
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.some((o) => o.kind === 'weapon-new' || o.kind === 'vinyl-new')).toBe(false);
    expect(game.addVinyl('rumba', Number.NaN)).toBe(false);
    expect(game.addWeapon('canon', Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('returns and applies fallback when all held equipment is maxed', () => {
    const cfg = quiet((c) => {
      c.evolutions = [];
    });
    const game = createSurvivors(cfg, 1, world);
    for (const id of weaponIds) {
      game.addWeapon(id, cfg.weapons[id]!.maxLevel);
      while (game.levelUpWeapon(id)) {
        /* max */
      }
    }
    for (const id of vinylIds) game.addVinyl(id, cfg.passives[id]!.maxLevel);
    expect(buildCardPool(cfg, inventory(game))).toMatchObject([{ kind: 'fallback' }]);
    game.spawnEnemy('crab', 0, 0);
    game.step();
    const before = game.snapshot().water.level;
    const offer = nextCard(game);
    expect(offer.options.length).toBeGreaterThan(0);
    expect(offer.options[0]).toMatchObject({
      kind: 'fallback',
      waterRemoved: cfg.fallback.waterRemoved,
      nameKey: cfg.fallback.i18nKey,
      textKey: cfg.fallback.textKey,
    });
    game.step({ choose: 0 });
    expect(game.snapshot().water.level).toBe(Math.max(0, before - cfg.fallback.waterRemoved));
  });
});

describe('T129: evolution conditions and behaviors', () => {
  for (const e of SURVIVORS_CONFIG.evolutions) {
    it(`${e.id} requires its own max-level weapon and held pair, and replaces once`, () => {
      const cfg = quiet((c) => {
        c.startingWeapon = e.weapon;
      });
      const game = createSurvivors(cfg, 1, world);
      const max = cfg.weapons[e.weapon]!.maxLevel;
      while (game.weaponLevel(e.weapon) < max - 1) game.levelUpWeapon(e.weapon);
      expect(game.evolveWeapon(e.id)).toBe(false);
      game.addVinyl(e.passive);
      expect(game.evolveWeapon(e.id)).toBe(false);
      game.levelUpWeapon(e.weapon);
      const offer = nextCard(game);
      const pick = offer.options.findIndex((o) => o.evolutionId === e.id);
      expect(pick).toBeGreaterThanOrEqual(0);
      expect(offer.options[pick]).toMatchObject({
        kind: 'evolution',
        weaponId: e.weapon,
        vinylId: e.passive,
        targetLevel: max,
      });
      const slots = game.heldWeapons.length;
      const events = game.step({ choose: pick });
      expect(events).toContainEqual({ type: 'evolved', weapon: e.weapon, evolutionId: e.id });
      expect(game.heldWeapons).toHaveLength(slots);
      expect(game.snapshot().weapons[0]).toMatchObject({
        id: e.weapon,
        evolutionId: e.id,
        nameKey: e.i18nKey,
        level: max,
        stats: resolveWeaponStats(e.evolvedWeapon, max, game.snapshot().stats),
      });
      expect(game.evolveWeapon(e.id)).toBe(false);
      expect(game.levelUpWeapon(e.weapon)).toBe(false);
      expect(eligibleEvolutions(cfg, inventory(game))).toEqual([]);

      const absent = createSurvivors(cfg, 1, world);
      while (absent.levelUpWeapon(e.weapon)) {
        /* max */
      }
      expect(absent.evolveWeapon(e.id)).toBe(false);
      absent.addVinyl(vinylIds.find((id) => id !== e.passive)!);
      expect(absent.evolveWeapon(e.id)).toBe(false);
      const noWeapon: Inventory = {
        weapons: [],
        vinyls: [{ id: e.passive, level: 1 }],
        salvavidas: 'absent',
      };
      expect(eligibleEvolutions(cfg, noWeapon)).toEqual([]);
      const chestCfg = { ...cfg, evolutionSource: 'chest' as const };
      const ready: Inventory = {
        weapons: [{ id: e.weapon, level: max }],
        vinyls: noWeapon.vinyls,
        salvavidas: 'absent',
      };
      expect(eligibleEvolutions(chestCfg, ready).map((e) => e.id)).toContain(e.id);
      expect(buildCardPool(chestCfg, ready).some((o) => o.kind === 'evolution')).toBe(false);
    });
  }

  it('El Drop damages nearby enemies with actual explosions, and islands stop its balls', () => {
    const e = SURVIVORS_CONFIG.evolutions.find((e) => e.id === 'drop')!;
    const game = evolutionGame(e);
    game.spawnEnemy('crab', 220, 0);
    const beside = game.spawnEnemy('crab', 220, 55)!;
    const events = run(game, 0.6);
    expect(beside.hp).toBeLessThan(beside.maxHp);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'explode',
        weapon: e.weapon,
        radius: game.snapshot().weapons[0]!.stats.area,
      }),
    );
    const blockedWorld = { ...world, obstacles: [{ x: 110, y: 0, radius: 45 }] };
    const blocked = createSurvivors(game.config, 1, blockedWorld);
    while (blocked.levelUpWeapon(e.weapon)) {
      /* max */
    }
    blocked.addVinyl(e.passive);
    blocked.evolveWeapon(e.id);
    const target = blocked.spawnEnemy('crab', 220, 0)!;
    expect(run(blocked, 1).some((ev) => ev.type === 'blocked')).toBe(true);
    expect(target.hp).toBe(target.maxHp);
  });

  it('Muro de Sonido enlarges the aura and really pushes enemies', () => {
    const e = SURVIVORS_CONFIG.evolutions.find((e) => e.id === 'soundWall')!;
    const game = evolutionGame(e);
    const enemy = game.spawnEnemy('crab', 100, 0)!;
    game.step();
    expect(enemy.x).toBeCloseTo(100 + e.evolvedWeapon.effects!.pushDistance!);
    expect(enemy.hp).toBeLessThan(enemy.maxHp);
    expect(game.snapshot().auras[0]!.radius).toBe(game.snapshot().weapons[0]!.stats.area);
  });

  it('Show de Laseres has its configured rays and applies Techno to their cadence', () => {
    const e = SURVIVORS_CONFIG.evolutions.find((e) => e.id === 'laserShow')!;
    const game = evolutionGame(e);
    const enemy = game.spawnEnemy('crab', 180, 0)!;
    game.step();
    expect(game.snapshot().beams).toHaveLength(e.evolvedWeapon.base.count);
    expect(enemy.hp).toBeLessThan(enemy.maxHp);
    expect(game.snapshot().weapons[0]!.stats.tickS).toBeCloseTo(
      e.evolvedWeapon.base.tickS / (1 + game.snapshot().stats.fireRateBonus),
    );
  });

  it('Bola de Discoteca is a giant orbital that emits damaging flashes within caps', () => {
    const e = SURVIVORS_CONFIG.evolutions.find((e) => e.id === 'discoBall')!;
    const game = evolutionGame(e);
    game.step();
    const s = game.snapshot();
    const f = e.evolvedWeapon.effects!.flashes!;
    expect(s.orbitals).toHaveLength(e.evolvedWeapon.base.count);
    expect(s.orbitals[0]!.radius).toBe(e.evolvedWeapon.base.area);
    expect(s.projectiles).toHaveLength(f.count);
    const flash = s.projectiles[0]!;
    const enemy = game.spawnEnemy(
      'crab',
      flash.x + flash.vx * SURVIVORS_STEP_S * 3,
      flash.y + flash.vy * SURVIVORS_STEP_S * 3,
    )!;
    run(game, 0.1);
    expect(enemy.hp).toBeLessThan(enemy.maxHp);
    for (let i = 0; i < 600; i++) {
      game.step();
      expect(game.snapshot().projectiles.length).toBeLessThanOrEqual(game.caps.projectiles);
    }
  });
});

describe('T129: vinyl effects actually apply', () => {
  for (const id of ['techno', 'reggaeton', 'hardstyle', 'rumba'] as const) {
    it(`${id} changes resolved weapon stats and attacks`, () => {
      const game = createSurvivors(quiet(), 1, world);
      const before = structuredClone(game.snapshot().weapons[0]!.stats);
      game.addVinyl(id);
      const def = SURVIVORS_CONFIG.weapons.canon!;
      const stats = game.snapshot().weapons[0]!.stats;
      expect(stats).toEqual(resolveWeaponStats(def, 1, game.snapshot().stats));
      const gain = SURVIVORS_CONFIG.passives[id]!.levels[0]!.amount;
      if (id === 'techno') expect(stats.cooldownS).toBeCloseTo(before.cooldownS / (1 + gain));
      if (id === 'reggaeton') expect(stats.area).toBeCloseTo(before.area * (1 + gain));
      if (id === 'hardstyle') expect(stats.damage).toBeCloseTo(before.damage * (1 + gain));
      if (id === 'rumba') expect(stats.count).toBe(before.count + gain);
      const enemy = game.spawnEnemy('crab', 220, 0)!;
      const events = run(game, stats.cooldownS * 0.99);
      const fire = events.find((e) => e.type === 'fire');
      expect(fire).toMatchObject({ count: stats.count });
      expect(enemy.hp).toBeLessThan(enemy.maxHp);
      for (const shot of game.snapshot().projectiles) expect(shot.radius).toBe(stats.area);
    });
  }

  it('Drum & Bass changes the actual boat speed', () => {
    const game = createSurvivors(quiet(), 1, world);
    game.addVinyl('dnb');
    const input = { ship: { dirX: 1, dirY: 0, throttle: 1, drift: false } };
    for (let i = 0; i < 300; i++) game.step(input);
    expect(shipSpeed(game.snapshot().player)).toBeCloseTo(
      DEFAULT_SHIP_CONFIG.maxSpeed * (1 + game.snapshot().stats.speedBonus),
    );
  });

  it('House reduces contact and enemy-projectile water', () => {
    for (const shooter of [false, true]) {
      const cfg = quiet((c) => {
        c.weapons.canon!.base.damage = 0;
        c.enemies.pirate!.shooter!.firstShotS = SURVIVORS_STEP_S;
      });
      const plain = createSurvivors(cfg, 1, world);
      const house = createSurvivors(cfg, 1, world);
      house.addVinyl('house');
      for (const g of [plain, house])
        g.spawnEnemy(shooter ? 'pirate' : 'crab', shooter ? 200 : 0, 0);
      const hits = [plain, house].map((g) =>
        run(g, shooter ? 1 : SURVIVORS_STEP_S).filter((e) => e.type === 'hit'),
      );
      expect(hits[0]!.length).toBeGreaterThan(0);
      expect(hits[1]).toHaveLength(hits[0]!.length);
      for (let i = 0; i < hits[0]!.length; i++) {
        const a = hits[0]![i]!;
        const b = hits[1]![i]!;
        if (a.type === 'hit' && b.type === 'hit')
          expect(b.water).toBeCloseTo(a.water * (1 - house.snapshot().stats.hullBonus));
      }
    }
  });

  it('Disco attracts notes outside the base magnet radius', () => {
    const cfg = quiet();
    const game = createSurvivors(cfg, 1, world);
    game.addVinyl('disco');
    const radius = cfg.player.magnetRadius * (1 + game.snapshot().stats.magnetBonus);
    const x = (cfg.player.magnetRadius + radius) / 2;
    game.spawnNote(x, 0, cfg.notes.values.corchea);
    game.step();
    expect(game.snapshot().notes[0]).toMatchObject({ magnet: true });
    expect(game.snapshot().notes[0]!.x).toBeLessThan(x);
  });

  it('Chill bails actual water each fixed step and Pop multiplies XP but not raw notes', () => {
    const cfg = quiet();
    const game = createSurvivors(cfg, 1, world);
    game.spawnEnemy('crab', 0, 0);
    game.step();
    const before = game.snapshot().water.level;
    game.addVinyl('chill');
    game.step();
    expect(game.snapshot().water.level).toBeCloseTo(
      before - game.snapshot().stats.bailPerS * SURVIVORS_STEP_S,
    );
    const pop = createSurvivors(cfg, 1, world);
    pop.addVinyl('pop');
    pop.spawnNote(0, 0, cfg.notes.values.corchea);
    pop.step();
    expect(pop.snapshot().xp.xp).toBeCloseTo(
      cfg.notes.values.corchea * (1 + pop.snapshot().stats.xpBonus),
    );
    expect(pop.snapshot().notesValue).toBe(cfg.notes.values.corchea);
  });
});

describe('T129: Salvavidas, card contract and determinism', () => {
  it('rare card acquires a slot-free item, saves once, and can never be reacquired', () => {
    const cfg = quiet((c) => {
      c.salvavidas.offerChance = 1;
      c.enemies.crab!.contactWater = c.player.waterCapacity;
      c.weapons.canon!.base.damage = 0;
    });
    const game = createSurvivors(cfg, 1, world);
    const card = nextCard(game);
    const pick = card.options.findIndex((o) => o.kind === 'salvavidas');
    expect(pick).toBeGreaterThanOrEqual(0);
    const slots = [game.heldWeapons.length, game.heldVinyls.length];
    game.step({ choose: pick });
    expect(game.snapshot().salvavidas).toBe('held');
    expect([game.heldWeapons.length, game.heldVinyls.length]).toEqual(slots);
    game.spawnEnemy('crab', 0, 0);
    const saved = game.step();
    expect(saved).toContainEqual({
      type: 'saved',
      item: 'salvavidas',
      x: 0,
      y: 0,
      water: cfg.player.waterCapacity * cfg.salvavidas.waterFractionAfterSave,
    });
    expect(game.snapshot().salvavidas).toBe('consumed');
    expect(game.snapshot().player.invulnerableS).toBe(cfg.salvavidas.invulnerableS);
    expect(game.addSalvavidas()).toBe(false);
    expect(buildCardPool(cfg, inventory(game), true).some((o) => o.kind === 'salvavidas')).toBe(
      false,
    );
    const later = run(game, cfg.salvavidas.invulnerableS + cfg.player.invulnerableS);
    expect(later.some((e) => e.type === 'saved')).toBe(false);
    expect(game.snapshot().end).toBe('flooded');
    const ordinary = createSurvivors(cfg, 1, world);
    ordinary.spawnEnemy('crab', 0, 0);
    expect(ordinary.step()).toContainEqual({ type: 'end', reason: 'flooded' });
  });

  it('every offered name and per-level effect has Spanish muestra text, including legacy HUD aliases', () => {
    const texts: Record<string, string> = esMar;
    const cfg = SURVIVORS_CONFIG;
    const fixtures: Inventory[] = [{ weapons: [], vinyls: [], salvavidas: 'absent' }];
    for (
      let level = 1;
      level <= Math.max(...Object.values(cfg.weapons).map((w) => w!.maxLevel));
      level++
    ) {
      for (const weapon of weaponIds)
        fixtures.push({ weapons: [{ id: weapon, level }], vinyls: [], salvavidas: 'absent' });
      for (const vinyl of vinylIds)
        fixtures.push({ weapons: [], vinyls: [{ id: vinyl, level }], salvavidas: 'absent' });
    }
    fixtures.push({
      weapons: cfg.evolutions.map((e) => ({
        id: e.weapon,
        level: cfg.weapons[e.weapon]!.maxLevel,
      })),
      vinyls: cfg.evolutions.map((e) => ({
        id: e.passive,
        level: cfg.passives[e.passive]!.maxLevel,
      })),
      salvavidas: 'consumed',
    });
    for (const inv of fixtures) {
      for (const opt of buildCardPool(cfg, inv, true)) {
        for (const key of [opt.nameKey, opt.textKey, opt.i18nKey, `${opt.i18nKey}.efecto`]) {
          expect(texts[key], key).toBeTruthy();
        }
      }
    }
    const full = fixtures.at(-1)!;
    expect(texts[buildCardPool({ ...cfg, evolutions: [] }, full)[0]!.textKey]).toBeTruthy();
  });

  it('a seeded card-choosing bot never exceeds slots, always gets a card, and replays identical snapshots', () => {
    const cfg = quiet((c) => {
      c.salvavidas.offerChance = SURVIVORS_CONFIG.salvavidas.offerChance;
    });
    const play = (seed: number) => {
      const game = createSurvivors(cfg, seed, world);
      const checkpoints = [];
      for (let i = 0; i < 100; i++) {
        const card = nextCard(game);
        expect(card.options.length).toBeGreaterThan(0);
        expect(card.options.length).toBeLessThanOrEqual(cfg.cardChoices);
        expect(new Set(card.options.map((o) => o.id)).size).toBe(card.options.length);
        const s = game.snapshot();
        for (const o of card.options) {
          if (o.kind === 'weapon-new') expect(s.weapons.length).toBeLessThan(cfg.slots.weapons);
          if (o.kind === 'vinyl-new') expect(s.vinyls.length).toBeLessThan(cfg.slots.vinyls);
          if (o.kind === 'weapon-level')
            expect(o.targetLevel).toBe(game.weaponLevel(o.weaponId!) + 1);
          if (o.kind === 'vinyl-level') expect(o.targetLevel).toBe(game.vinylLevel(o.vinylId!) + 1);
        }
        const choose = card.options.findIndex((o) => o.kind === 'evolution');
        game.step({
          choose: choose >= 0 ? choose : i % card.options.length,
          ship: { dirX: Math.cos(i), dirY: Math.sin(i), throttle: 1, drift: false },
          turbo: i % 7 === 0,
        });
        expect(game.heldWeapons.length).toBeLessThanOrEqual(cfg.slots.weapons);
        expect(game.heldVinyls.length).toBeLessThanOrEqual(cfg.slots.vinyls);
        checkpoints.push(structuredClone(game.snapshot()));
      }
      return checkpoints;
    };
    const first = play(777);
    expect(play(777)).toEqual(first);
    expect(play(778)).not.toEqual(first);
    expect(first.at(-1)!.card).toBeNull();
  });
});
