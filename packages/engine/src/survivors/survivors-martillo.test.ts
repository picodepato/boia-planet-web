import { describe, expect, it } from 'vitest';
import { rng } from '../minigames/rng';
import type { ShipInput } from '../ship/controller';
import { validateBoss } from './bosses';
import { chestCandidates, eligibleEvolutions } from './cards';
import {
  SURVIVORS_CONFIG,
  SURVIVORS_STEP_S,
  type SurvivorsConfig,
  actOf,
  bossHpFor,
} from './config';
import { type SurvivorsEvent, type SurvivorsGame, type SurvivorsInput, createSurvivors } from './sim';
import type { SurvivorsWorld } from './world';

/**
 * El Tiburón Martillo y el cofre (plan 012 T139): el miniboss del 4:30 sobre
 * el sistema genérico de T137 (embestidas en línea, siempre avisadas, y
 * llamadas de pirañas entre medias; más fuerte en el acto 2), y el cofre que
 * sueltan los dos minibosses: tocarlo abre una carta de una sola opción,
 * gratis, con la evolución si su condición se cumple o una mejora del mazo
 * si no. Los números se leen de la config, nunca escritos a mano.
 */

const MARTILLO = SURVIVORS_CONFIG.bosses.martillo!;

function openSea(obstacles: SurvivorsWorld['obstacles'] = []): SurvivorsWorld {
  return { bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 }, obstacles, start: { x: 0, y: 0, heading: 0 } };
}

function archipelago(seed: number): SurvivorsWorld {
  const r = rng(seed);
  const obstacles = [];
  for (let i = 0; i < 45; i++) {
    const x = -1800 + r() * 3600;
    const y = -1800 + r() * 3600;
    if (Math.hypot(x, y) < 260) continue;
    obstacles.push({ x, y, radius: 40 + r() * 150 });
  }
  return { bounds: { left: -1800, right: 1800, top: -1800, bottom: 1800 }, obstacles, start: { x: 0, y: 0 } };
}

function withConfig(patch: (c: SurvivorsConfig) => void): SurvivorsConfig {
  const c = structuredClone(SURVIVORS_CONFIG);
  patch(c);
  return c;
}

/** El guion de verdad con el barco insumergible (el boss no acaba la partida antes de verlo entero). */
const unsinkable = (patch: (c: SurvivorsConfig) => void = () => {}) =>
  withConfig((c) => {
    c.player.waterCapacity = 1e12;
    c.salvavidas.offerChance = 0;
    patch(c);
  });

/** Sin guion: sólo lo que la prueba pone. */
const quiet = (patch: (c: SurvivorsConfig) => void = () => {}) =>
  unsinkable((c) => {
    c.acts = [{ act: 1, durationS: c.durationS, tracks: [], events: [] }];
    patch(c);
  });

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

interface Timed {
  t: number;
  e: SurvivorsEvent;
}

/** Juega `seconds` s con `input`, guardando cada suceso (menos los disparos) con su segundo. */
function playTimed(game: SurvivorsGame, seconds: number, input: (step: number) => SurvivorsInput): Timed[] {
  const out: Timed[] = [];
  const steps = Math.round(seconds / SURVIVORS_STEP_S);
  for (let i = 0; i < steps && !game.ended; i++) {
    for (const e of game.step(input(i))) if (e.type !== 'fire') out.push({ t: game.activeS, e: { ...e } });
  }
  return out;
}

function run(game: SurvivorsGame, seconds: number, input: SurvivorsInput = {}): SurvivorsEvent[] {
  return playTimed(game, seconds, () => input).map((x) => x.e);
}

const of = <T extends SurvivorsEvent['type']>(events: readonly SurvivorsEvent[], type: T) =>
  events.filter((e): e is Extract<SurvivorsEvent, { type: T }> => e.type === type);

/** Quema al primer boss (gancho de la Llama) hasta dejarle `fraction` de vida (0: 1 punto). */
function burnTo(game: SurvivorsGame, fraction: number): void {
  const b = game.snapshot().bosses[0]!;
  const want = b.hp - Math.max(1, b.maxHp * fraction);
  game.flameBosses(b.x, b.y, 1, want / game.config.bossFight.flameDps);
}

const lineAttacks = Object.entries(MARTILLO.attacks).filter(([, a]) => a.kind === 'line');
const summonAttacks = Object.entries(MARTILLO.attacks).filter(([, a]) => a.kind === 'summon');

// --- Datos ---------------------------------------------------------------------

describe('martillo T139: datos', () => {
  it('es un miniboss coherente: embiste en línea con aviso, llama pirañas y suelta el cofre', () => {
    expect(validateBoss(MARTILLO)).toEqual([]);
    expect(MARTILLO.kind).toBe('miniboss');
    expect(MARTILLO.chest).toBe(true);
    expect(MARTILLO.kraken).toBeUndefined();
    expect(lineAttacks.length).toBeGreaterThanOrEqual(1);
    for (const [name, a] of lineAttacks) {
      expect(a.telegraphS, name).toBeGreaterThan(0.5);
      expect(a.still, name).toBe(true);
    }
    expect(summonAttacks.length).toBeGreaterThanOrEqual(1);
    for (const [, a] of summonAttacks) expect(a.summon!.enemy).toBe('piranha');
    // Cada fase: varias embestidas y, entre ellas, una llamada.
    for (const p of MARTILLO.phases) {
      const kinds = p.attacks.map((n) => MARTILLO.attacks[n]!.kind);
      expect(kinds.filter((k) => k === 'line').length).toBeGreaterThanOrEqual(2);
      expect(kinds).toContain('summon');
    }
  });

  it('su hueco del 4:30 del acto 1 va encendido (y el del acto 2 también)', () => {
    for (const act of SURVIVORS_CONFIG.acts) {
      const slot = act.events.find((e) => e.type === 'miniboss' && e.ref === 'martillo')!;
      expect(slot).toBeDefined();
      expect(slot.enabled).not.toBe(false);
    }
  });

  it('en el acto 2 es más fuerte: más aguante y pirañas más duras', () => {
    const a1 = actOf(SURVIVORS_CONFIG, 1)!;
    const a2 = actOf(SURVIVORS_CONFIG, 2)!;
    const normal = SURVIVORS_CONFIG.difficulties.normal;
    expect(bossHpFor(MARTILLO, a2, normal)).toBeGreaterThan(bossHpFor(MARTILLO, a1, normal));
    const acts = () => {
      const c = quiet();
      c.acts = SURVIVORS_CONFIG.acts.map((a) => ({ ...a, tracks: [], events: [] }));
      return c;
    };
    const hp = (act: number) => {
      const g = createSurvivors(acts(), 1, openSea(), { act });
      const b = g.spawnBoss('martillo', 400, 0)!;
      return b.maxHp;
    };
    expect(hp(2)).toBeGreaterThan(hp(1));
    // Las pirañas que llama aguantan como las del guion de su acto.
    const summoned = (act: number) => {
      const g = createSurvivors(acts(), 1, openSea(), { act });
      g.spawnBoss('martillo', 600, 0);
      for (let i = 0; i < 60 * 20; i++) {
        g.step({ choose: 0 });
        const p = g.snapshot().enemies.find((e) => e.type === 'piranha');
        if (p) return p.maxHp;
      }
      return 0;
    };
    const p1 = summoned(1);
    expect(p1).toBeGreaterThan(0);
    expect(summoned(2)).toBeGreaterThan(p1);
  });
});

// --- Pelea ---------------------------------------------------------------------

describe('martillo T139: embestidas y llamadas', () => {
  it('cada embestida avisa con su línea, quieto, al menos `telegraphS` antes; entre ellas llama pirañas', () => {
    let charges = 0;
    let summons = 0;
    let warned = 0;
    for (const seed of [1, 2, 3]) {
      const g = createSurvivors(unsinkable(), seed, archipelago(seed), { startAtS: 268 });
      const timed: Timed[] = [];
      const steps = Math.round(60 / SURVIVORS_STEP_S);
      for (let i = 0; i < steps && !g.ended; i++) {
        const ev = g.step(scriptedInput(i));
        const s = g.snapshot();
        for (const e of ev) if (e.type.startsWith('boss') || e.type === 'chest') timed.push({ t: g.activeS, e: { ...e } });
        // Mientras avisa una embestida: la línea en el agua, el tiburón quieto.
        for (const w of s.bossWarnings) {
          if (w.boss !== 'martillo' || w.kind !== 'line' || w.hit) continue;
          warned++;
          const b = s.bosses.find((x) => x.id === w.id)!;
          expect(Math.hypot(b.vx, b.vy)).toBe(0);
          expect(w.length).toBe(MARTILLO.attacks[w.attack]!.length);
        }
      }
      expect(timed.some(({ e }) => e.type === 'bossSpawn' && e.boss === 'martillo')).toBe(true);
      const armed = new Map<string, number>();
      const order: string[] = [];
      for (const { t, e } of timed) {
        if (e.type === 'bossTelegraph' && e.boss === 'martillo') armed.set(`${e.id}:${e.attack}`, t);
        if (e.type === 'bossAttack' && e.boss === 'martillo') {
          const def = MARTILLO.attacks[e.attack]!;
          const at = armed.get(`${e.id}:${e.attack}`);
          expect(at).toBeDefined();
          expect(t - at!).toBeGreaterThanOrEqual(def.telegraphS - 2 * SURVIVORS_STEP_S);
          armed.delete(`${e.id}:${e.attack}`);
          order.push(def.kind);
          if (def.kind === 'line') charges++;
        }
        // Un golpe de embestida sólo tras su aviso.
        if (e.type === 'bossHit' && e.boss === 'martillo' && e.attack !== null) {
          expect(MARTILLO.attacks[e.attack]!.telegraphS).toBeGreaterThan(0);
        }
        if (e.type === 'bossSummon' && e.boss === 'martillo') {
          expect(e.enemy).toBe('piranha');
          expect(e.count).toBeGreaterThan(0);
          summons++;
        }
      }
      // Entre dos llamadas siempre hay embestidas.
      const calls = order.flatMap((k, i) => (k === 'summon' ? [i] : []));
      for (let i = 1; i < calls.length; i++) expect(calls[i]! - calls[i - 1]!).toBeGreaterThan(1);
    }
    expect(charges).toBeGreaterThanOrEqual(6);
    expect(summons).toBeGreaterThanOrEqual(2);
    expect(warned).toBeGreaterThan(0);
  });

  it('la embestida recorre su línea y moja al barco que se queda en ella', () => {
    const name = MARTILLO.phases[0]!.attacks.find((n) => MARTILLO.attacks[n]!.kind === 'line')!;
    const g = createSurvivors(quiet(), 1, openSea());
    g.spawnBoss('martillo', 450, 0);
    const ev = run(g, 6);
    const hits = of(ev, 'bossHit').filter((e) => e.attack === name);
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0]!.water).toBeGreaterThan(0);
  });

  it('con media vida se enfurece: cambia de fase y sus ataques son los de la segunda', () => {
    const g = createSurvivors(quiet(), 1, openSea());
    g.spawnBoss('martillo', 450, 0);
    run(g, 0.1);
    burnTo(g, MARTILLO.phases[0]!.untilHpFraction - 0.05);
    const ev = run(g, 8);
    expect(of(ev, 'bossPhase').map((e) => e.phase)).toEqual([1]);
    const names = new Set(of(ev, 'bossTelegraph').map((e) => e.attack));
    for (const n of names) expect(MARTILLO.phases[1]!.attacks).toContain(n);
    expect(names.size).toBeGreaterThan(0);
  });

  it('al caer suelta el cofre y la nota grande', () => {
    const g = createSurvivors(quiet(), 1, openSea());
    g.spawnBoss('martillo', 300, 0);
    burnTo(g, 0);
    const ev = run(g, 1);
    expect(of(ev, 'bossDefeated').map((e) => e.boss)).toEqual(['martillo']);
    expect(of(ev, 'chest').map((e) => e.boss)).toEqual(['martillo']);
    expect(g.snapshot().bossesDefeated).toEqual(['martillo']);
  });
});

// --- El cofre --------------------------------------------------------------------

describe('cofre T139', () => {
  const evo = SURVIVORS_CONFIG.evolutions[0]!;

  /** Arma de la evolución al máximo y su vinilo: la condición se cumple. */
  function ready(g: SurvivorsGame): void {
    g.addWeapon(evo.weapon);
    while (g.levelUpWeapon(evo.weapon)) {
      /* al máximo */
    }
    g.addVinyl(evo.passive);
  }

  it('tocarlo abre una carta de cofre con una sola opción; con la condición, la evolución', () => {
    for (const source of ['level-up', 'chest'] as const) {
      const g = createSurvivors(quiet((c) => (c.evolutionSource = source)), 1, openSea());
      ready(g);
      g.spawnChest('martillo', 0, 0);
      const ev = run(g, SURVIVORS_STEP_S);
      expect(of(ev, 'chestOpened')).toHaveLength(1);
      const card = g.snapshot().card!;
      expect(g.snapshot().status).toBe('card');
      expect(card.source).toBe('chest');
      expect(card.boss).toBe('martillo');
      expect(card.options).toHaveLength(1);
      expect(card.options[0]).toMatchObject({ kind: 'evolution', evolutionId: evo.id });
      const level = g.snapshot().xp.level;
      const ev2 = run(g, SURVIVORS_STEP_S, { choose: 0 });
      expect(of(ev2, 'evolved')).toEqual([{ type: 'evolved', weapon: evo.weapon, evolutionId: evo.id }]);
      expect(g.snapshot().weapons.find((w) => w.id === evo.weapon)!.evolutionId).toBe(evo.id);
      // Gratis: no gasta nivel ni abre otra carta.
      expect(g.snapshot().xp.level).toBe(level);
      expect(g.snapshot().card).toBeNull();
      expect(g.snapshot().status).toBe('running');
    }
  });

  it('sin la condición, una mejora del mazo: subir de nivel algo que llevas', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = createSurvivors(quiet(), seed, openSea());
      expect(eligibleEvolutions(g.config, { weapons: [], vinyls: [], salvavidas: 'absent' })).toEqual([]);
      const before = g.snapshot().weapons.map((w) => [w.id, w.level]);
      g.spawnChest('vecino', 0, 0);
      run(g, SURVIVORS_STEP_S);
      const card = g.snapshot().card!;
      expect(card.source).toBe('chest');
      expect(card.options).toHaveLength(1);
      const opt = card.options[0]!;
      expect(['weapon-level', 'vinyl-level']).toContain(opt.kind);
      run(g, SURVIVORS_STEP_S, { choose: 0 });
      const after = g.snapshot().weapons.map((w) => [w.id, w.level]);
      expect(after).not.toEqual(before);
      expect(g.snapshot().card).toBeNull();
    }
  });

  it('las candidatas: la evolución si se cumple, si no lo que se puede subir; nunca el Salvavidas', () => {
    const cfg = SURVIVORS_CONFIG;
    const start = { weapons: [{ id: cfg.startingWeapon, level: 1 }], vinyls: [], salvavidas: 'absent' as const };
    const up = chestCandidates(cfg, start);
    expect(up.length).toBeGreaterThan(0);
    for (const o of up) expect(['weapon-level', 'vinyl-level']).toContain(o.kind);
    const max = cfg.weapons[evo.weapon]!.maxLevel;
    const evolved = chestCandidates(cfg, {
      weapons: [{ id: evo.weapon, level: max }],
      vinyls: [{ id: evo.passive, level: 1 }],
      salvavidas: 'absent',
    });
    expect(evolved.map((o) => o.kind)).toEqual(['evolution']);
    // Sin nada que subir (nada llevado), lo nuevo; nunca el Salvavidas.
    const empty = chestCandidates(cfg, { weapons: [], vinyls: [], salvavidas: 'absent' });
    expect(empty.length).toBeGreaterThan(0);
    for (const o of empty) expect(o.kind).not.toBe('salvavidas');
  });

  it('una carta de nivel pendiente espera a que se conteste la del cofre', () => {
    const g = createSurvivors(quiet(), 1, openSea());
    const s0 = g.snapshot();
    // Una nota que da un nivel justo encima del barco y el cofre al lado.
    g.spawnNote(0, 0, Math.max(1, s0.xp.toNext - s0.xp.xp));
    g.spawnChest('martillo', 0, 0);
    run(g, SURVIVORS_STEP_S * 3);
    expect(g.snapshot().card!.source).toBe('chest');
    run(g, SURVIVORS_STEP_S, { choose: 0 });
    const next = g.snapshot().card!;
    expect(next.source).toBe('level');
    expect(next.options.length).toBeGreaterThan(1);
  });
});

// --- Determinismo ------------------------------------------------------------------

describe('martillo T139: determinismo', () => {
  it('una partida desde antes del 4:30 con el tiburón y su cofre es determinista', () => {
    const go = (seed: number) => {
      const g = createSurvivors(unsinkable(), seed, archipelago(4), { startAtS: 260 });
      const hashes: string[] = [];
      let chestCards = 0;
      let k = 0;
      while (!g.ended && k < 60 * 60) {
        const s = g.snapshot();
        // Si cayó, el barco va a por su cofre; si no, a vueltas.
        const chest = s.chests.find((c) => c.boss === 'martillo');
        const input = chest
          ? { ship: { dirX: chest.x - s.player.x, dirY: chest.y - s.player.y, throttle: 1, drift: false }, choose: 0 }
          : scriptedInput(k);
        // A los 20 s, la Llama lo tumba (fuera del paso: sin sucesos, pero suelta el cofre).
        const boss = s.bosses.find((b) => b.boss === 'martillo');
        if (boss && k === 60 * 20) g.flameBosses(boss.x, boss.y, 1, (boss.hp + 1) / g.config.bossFight.flameDps);
        if (s.card?.source === 'chest' && s.card.boss === 'martillo') chestCards++;
        g.step(input);
        if (k % 600 === 0) hashes.push(g.stateHash());
        k++;
      }
      hashes.push(g.stateHash());
      return { hashes, chestCards, defeated: g.snapshot().bossesDefeated };
    };
    const a = go(11);
    const b = go(11);
    expect(b.hashes).toEqual(a.hashes);
    // (Empezando a las 4:20 entra también la pelea del Vecino, el último hueco pasado.)
    expect(a.defeated).toContain('martillo');
    expect(a.chestCards).toBeGreaterThan(0);
    expect(go(12).hashes.at(-1)).not.toBe(a.hashes.at(-1));
  }, 120_000);
});
