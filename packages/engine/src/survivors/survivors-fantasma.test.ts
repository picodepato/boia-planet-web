import { describe, expect, it } from 'vitest';
import { rng } from '../minigames/rng';
import type { ShipInput } from '../ship/controller';
import { phaseMarks, validateBoss } from './bosses';
import { runBot } from './bots';
import {
  SURVIVORS_CONFIG,
  SURVIVORS_CONFIG_VERSION,
  SURVIVORS_STEP_S,
  type SurvivorsConfig,
  actOf,
} from './config';
import { ghostPhase, validateGhostShip } from './fantasma';
import { type SurvivorsEvent, type SurvivorsGame, type SurvivorsInput, createSurvivors } from './sim';
import type { SurvivorsWorld } from './world';

/**
 * El Barco Pirata Fantasma (plan 012 T140): el boss final del acto 1 en el
 * hueco del guion; sus ventanas fantasma (invulnerable, no toca, no dispara);
 * las andanadas avisadas por los costados, que las islas paran; la
 * tripulación de piratas fantasma; vencerlo acaba la partida con `victory`;
 * y el determinismo de una partida entera del acto 1.
 */

// --- Mundos y ayudantes -------------------------------------------------------

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

function openSea(obstacles: SurvivorsWorld['obstacles'] = []): SurvivorsWorld {
  return { bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 }, obstacles, start: { x: 0, y: 0, heading: 0 } };
}

/** Un anillo cerrado de islas alrededor del origen (ninguna bala pasa). */
function islandRing(r: number, count: number, radius: number): SurvivorsWorld['obstacles'] {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, radius });
  }
  return out;
}

function withConfig(patch: (c: SurvivorsConfig) => void): SurvivorsConfig {
  const c = structuredClone(SURVIVORS_CONFIG);
  patch(c);
  return c;
}

const FANTASMA = SURVIVORS_CONFIG.bosses.fantasma!;
const F = FANTASMA.fantasma!;
const ACT1 = actOf(SURVIVORS_CONFIG, 1)!;
const SLOT = ACT1.events.find((e) => e.type === 'boss')!;

/** Sin guion ni hitos, barco insumergible: sólo el Fantasma que la prueba pone. */
const quiet = (patch: (c: SurvivorsConfig) => void = () => {}) =>
  withConfig((c) => {
    c.acts = [{ act: 1, durationS: c.durationS, tracks: [], events: [] }];
    c.player.waterCapacity = 1e12;
    c.salvavidas.offerChance = 0;
    patch(c);
  });

/** El acto 1 de verdad con el barco insumergible. */
const unsinkable = (patch: (c: SurvivorsConfig) => void = () => {}) =>
  withConfig((c) => {
    c.player.waterCapacity = 1e12;
    c.salvavidas.offerChance = 0;
    patch(c);
  });

/** El Fantasma quieto, sin ataques de fase, con estas ventanas. */
function stillGhost(c: SurvivorsConfig, solidS: number, ghostS: number, ghostAttacks: string[] = []): void {
  const b = c.bosses.fantasma!;
  b.phases = [
    {
      untilHpFraction: 0,
      untilS: 0,
      movement: 'still',
      standoff: 0,
      speedScale: 1,
      invulnerable: false,
      attacks: [],
      attackEveryS: 0,
      firstAttackS: 0,
    },
  ];
  b.fantasma = { ...b.fantasma!, ghostAttacks, phases: [{ solidS, ghostS }] };
}

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

const IDLE: SurvivorsInput = { ship: { dirX: 0, dirY: 0, throttle: 0, drift: false }, choose: 0 };

/** Un suceso con el segundo de partida en que salió. */
type Timed = SurvivorsEvent & { atS: number };

function play(
  game: SurvivorsGame,
  input: (step: number) => SurvivorsInput,
  each: (game: SurvivorsGame, ev: readonly SurvivorsEvent[]) => void = () => {},
  maxSteps = 40_000,
): Timed[] {
  const events: Timed[] = [];
  let steps = 0;
  while (!game.ended && steps < maxSteps) {
    const ev = game.step(input(steps));
    const atS = game.activeS;
    for (const e of ev) if (e.type !== 'fire') events.push({ ...e, atS });
    each(game, ev);
    steps++;
  }
  return events;
}

function run(game: SurvivorsGame, seconds: number, input: SurvivorsInput = IDLE): Timed[] {
  const out: Timed[] = [];
  for (let i = 0; i < Math.round(seconds / SURVIVORS_STEP_S) && !game.ended; i++) {
    const ev = game.step(input);
    const atS = game.activeS;
    for (const e of ev) if (e.type !== 'fire') out.push({ ...e, atS });
  }
  return out;
}

const of = <T extends SurvivorsEvent['type']>(events: readonly Timed[], type: T) =>
  events.filter((e): e is Extract<Timed, { type: T }> => e.type === type);

const body = (g: SurvivorsGame) => g.snapshot().bosses.find((b) => b.boss === 'fantasma') ?? null;

/** Quema al boss (por el gancho de la Llama) hasta dejarle `fraction` de vida (con 0, un punto). */
function burnTo(g: SurvivorsGame, fraction: number): void {
  const b = body(g)!;
  const want = b.hp - Math.max(1, b.maxHp * fraction);
  g.flameBosses(b.x, b.y, 1, want / g.config.bossFight.flameDps);
}

// --- Datos ---------------------------------------------------------------------

describe('fantasma T140: datos', () => {
  it('la versión sube; el Fantasma es un boss final coherente, en el hueco del acto 1, encendido', () => {
    expect(SURVIVORS_CONFIG_VERSION).toBeGreaterThanOrEqual(11);
    expect(FANTASMA.kind).toBe('boss');
    expect(FANTASMA.chest).toBe(false);
    expect(validateBoss(FANTASMA)).toEqual([]);
    expect(SLOT).toMatchObject({ ref: 'fantasma', atS: 330 });
    expect(SLOT.enabled).not.toBe(false);
    // Fases por vida, con ventanas sólidas más cortas y más prisa cuanto peor está.
    expect(phaseMarks(FANTASMA)).toEqual([0.6, 0.25]);
    expect(F.phases.length).toBe(FANTASMA.phases.length);
    for (let i = 1; i < F.phases.length; i++) {
      expect(F.phases[i]!.solidS).toBeLessThan(F.phases[i - 1]!.solidS);
      expect(FANTASMA.phases[i]!.speedScale).toBeGreaterThan(FANTASMA.phases[i - 1]!.speedScale);
      expect(FANTASMA.phases[i]!.attackEveryS).toBeLessThan(FANTASMA.phases[i - 1]!.attackEveryS);
    }
    // Sólido: andanadas (las islas las paran); fantasma: la tripulación de piratas fantasma.
    for (const p of FANTASMA.phases) expect(p.attacks).toEqual(['andanada']);
    expect(FANTASMA.attacks.andanada).toMatchObject({ kind: 'broadside', blockedByIslands: true });
    expect(FANTASMA.attacks.andanada!.telegraphS).toBeGreaterThan(0);
    expect(F.ghostAttacks).toEqual(['tripulacion']);
    expect(FANTASMA.attacks.tripulacion!.summon).toMatchObject({ enemy: 'pirate', ghost: true });
    expect(ghostPhase(F, 99)).toBe(F.phases.at(-1));
    // La validación propia pilla lo roto.
    const broken = structuredClone(FANTASMA);
    broken.fantasma!.phases = [{ solidS: 0, ghostS: 1 }];
    broken.fantasma!.ghostAttacks = ['nada'];
    expect(validateGhostShip(broken).length).toBeGreaterThanOrEqual(3);
  });

  it('en el acto 1 de verdad entra a su segundo, sólido, delante del barco; empezando después del hueco también', () => {
    const g = createSurvivors(unsinkable(), 5, openSea(), { startAtS: SLOT.atS - 1 });
    const ev = run(g, 2);
    expect(of(ev, 'bossSpawn').map((e) => [e.boss, e.kind, e.nameKey])).toEqual([['fantasma', 'boss', 'survivors.boss.fantasma']]);
    const b = body(g)!;
    expect(b.fantasma).toMatchObject({ mode: 'solid' });
    expect(b.invulnerable).toBe(false);
    expect(b.kraken).toBeNull();
    const late = createSurvivors(unsinkable(), 5, openSea(), { startAtS: 400 });
    run(late, 1);
    expect(body(late)?.boss).toBe('fantasma');
  });
});

// --- Ventanas fantasma ------------------------------------------------------------

describe('fantasma T140: ventanas', () => {
  it('alterna sólido y fantasma con los segundos de la fase; desvanecido nada lo daña ni le hieren las bolas', () => {
    const g = createSurvivors(quiet((c) => stillGhost(c, 2, 1.5)), 1, openSea());
    g.spawnBoss('fantasma', 200, 0);
    const first = body(g)!;
    expect(first.fantasma!.mode).toBe('solid');
    // Sólido: la Llama le quita vida.
    g.flameBosses(first.x, first.y, 1, 1);
    expect(body(g)!.hp).toBeLessThan(first.maxHp);
    const ev = run(g, 7.2);
    const states = of(ev, 'fantasmaState');
    expect(states.map((e) => e.state)).toEqual(['ghost', 'solid', 'ghost', 'solid']);
    expect(states[0]!.atS).toBeCloseTo(2, 1);
    expect(states[1]!.atS - states[0]!.atS).toBeCloseTo(1.5, 1);
    expect(states[2]!.atS - states[1]!.atS).toBeCloseTo(2, 1);
    // Ahora mismo (7.2 s) está sólido otra vez (desde los 7); a los 9, fantasma hasta los 10,5.
    expect(body(g)!.fantasma!.mode).toBe('solid');
    run(g, 1.9);
    const ghost = body(g)!;
    expect(ghost.fantasma!.mode).toBe('ghost');
    expect(ghost.invulnerable).toBe(true);
    expect(ghost.fantasma!.leftS).toBeLessThanOrEqual(1.5);
    // Recién desvanecido: la rampa de `fadeS` va subiendo hacia 1 (la pantalla no la anima; el HUD puede leerla).
    expect(ghost.fantasma!.ghostness).toBeGreaterThan(0);
    expect(ghost.fantasma!.ghostness).toBeCloseTo(Math.min(1, ghost.fantasma!.progress * 1.5 / F.fadeS), 5);
    // Desvanecido: ni la Llama ni el cañón del barco (a tiro) le quitan nada.
    const hpBefore = ghost.hp;
    expect(g.flameBosses(ghost.x, ghost.y, 1, 1)).toBe(0);
    const during = run(g, 1.2);
    expect(of(during, 'bossDamaged')).toEqual([]);
    expect(body(g)!.hp).toBe(hpBefore);
    // De vuelta a sólido, las bolas del cañón vuelven a herirlo.
    const after = run(g, 1.5);
    expect(of(after, 'fantasmaState').map((e) => e.state)).toEqual(['solid']);
    expect(of(after, 'bossDamaged').length).toBeGreaterThan(0);
    expect(body(g)!.hp).toBeLessThan(hpBefore);
  });

  it('sólido toca el casco; desvanecido pasa por el barco sin mojar', () => {
    const g = createSurvivors(quiet((c) => stillGhost(c, 1, 60)), 2, openSea());
    g.spawnBoss('fantasma', 0, 0);
    const solid = run(g, 0.9);
    const hits = of(solid, 'bossHit');
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(h).toMatchObject({ boss: 'fantasma', attack: null });
    run(g, 0.2);
    expect(body(g)!.fantasma!.mode).toBe('ghost');
    const ghost = run(g, 3);
    expect(of(ghost, 'bossHit')).toEqual([]);
  });

  it('el desvanecimiento espera a que acabe la andanada en curso: ningún ataque se corta', () => {
    const g = createSurvivors(
      quiet((c) => {
        stillGhost(c, 1, 2);
        c.bosses.fantasma!.phases[0]!.attacks = ['andanada'];
        c.bosses.fantasma!.phases[0]!.attackEveryS = 1;
        c.bosses.fantasma!.phases[0]!.firstAttackS = 0.8;
      }),
      3,
      openSea(),
    );
    g.spawnBoss('fantasma', 300, 0);
    const ev = run(g, 6);
    const tele = of(ev, 'bossTelegraph');
    const hits = of(ev, 'bossAttack');
    const states = of(ev, 'fantasmaState');
    expect(tele.length).toBeGreaterThan(1);
    expect(states.filter((s) => s.state === 'ghost').length).toBeGreaterThan(0);
    // Cada aviso acaba en golpe antes del cambio a fantasma que le sigue (el
    // último puede quedar a medias al acabar la prueba), y ningún golpe ni
    // aviso cae dentro de una ventana fantasma.
    for (const t of tele) {
      const change = states.find((s) => s.atS > t.atS && s.state === 'ghost');
      if (!change) continue;
      const hit = hits.find((h) => h.atS >= t.atS);
      expect(hit, `aviso a los ${t.atS} s`).toBeDefined();
      expect(hit!.atS).toBeLessThanOrEqual(change.atS);
    }
    for (const e of [...tele, ...hits]) {
      const last = states.filter((s) => s.atS <= e.atS).at(-1);
      expect(last?.state ?? 'solid').toBe('solid');
    }
  });
});

// --- Andanadas -------------------------------------------------------------------

describe('fantasma T140: andanadas', () => {
  const broadsideSetup = (world: SurvivorsWorld) => {
    const g = createSurvivors(
      quiet((c) => {
        // Sólido todo el rato, sin tripulación: sólo las andanadas.
        const b = c.bosses.fantasma!;
        b.fantasma = { ...b.fantasma!, ghostAttacks: [], phases: b.phases.map(() => ({ solidS: 1e6, ghostS: 1 })) };
      }),
      4,
      world,
    );
    g.spawnBoss('fantasma', 300, 0);
    return g;
  };

  it('cada andanada avisa con dos líneas (una por costado) antes de disparar, y ningún disparo sale sin aviso', () => {
    const g = broadsideSetup(openSea());
    let shotsBeforeFirstAttack = 0;
    let firstAttackS = Infinity;
    let warningsSeen = 0;
    const ev = play(
      g,
      () => IDLE,
      (game, step) => {
        const s = game.snapshot();
        if (step.some((e) => e.type === 'bossAttack') && firstAttackS === Infinity) firstAttackS = s.activeS;
        if (s.activeS < firstAttackS) shotsBeforeFirstAttack += s.enemyProjectiles.length;
        const lines = s.bossWarnings.filter((w) => w.kind === 'broadside');
        if (lines.length > 0) {
          warningsSeen++;
          expect(lines.length).toBe(2);
          // Perpendiculares al rumbo, una a cada costado, del alcance de la andanada.
          // (El rumbo del boss sigue girando durante los disparos: con margen.)
          const b = s.bosses[0]!;
          const angles = lines
            .map((l) => Math.atan2(Math.sin(l.heading - b.heading), Math.cos(l.heading - b.heading)))
            .sort((p, q) => p - q);
          expect(angles[0]).toBeCloseTo(-Math.PI / 2, 1);
          expect(angles[1]).toBeCloseTo(Math.PI / 2, 1);
          for (const l of lines) expect(l.length).toBe(FANTASMA.attacks.andanada!.length);
        }
      },
      Math.round(20 / SURVIVORS_STEP_S),
    );
    const tele = of(ev, 'bossTelegraph').filter((e) => e.attack === 'andanada');
    const hits = of(ev, 'bossAttack').filter((e) => e.attack === 'andanada');
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(warningsSeen).toBeGreaterThan(0);
    expect(shotsBeforeFirstAttack).toBe(0);
    for (const h of hits) {
      const t = [...tele].reverse().find((e) => e.atS <= h.atS)!;
      expect(h.atS - t.atS).toBeGreaterThanOrEqual(FANTASMA.attacks.andanada!.telegraphS - SURVIVORS_STEP_S * 1.5);
    }
  });

  it('las andanadas mojan a un barco quieto en mar abierto; un anillo de islas las para todas', () => {
    const open = broadsideSetup(openSea());
    const evOpen = run(open, 40);
    expect(of(evOpen, 'bossHit').filter((e) => e.attack === 'andanada').length).toBeGreaterThan(0);
    // Un anillo cerrado de islas alrededor del barco: los disparos chocan con la isla, ninguno llega.
    const walled = broadsideSetup(openSea(islandRing(150, 12, 50)));
    expect(body(walled)).not.toBeNull();
    const evWalled = run(walled, 40);
    expect(of(evWalled, 'bossAttack').filter((e) => e.attack === 'andanada').length).toBeGreaterThan(0);
    expect(of(evWalled, 'blocked').filter((e) => e.owner === 'enemy').length).toBeGreaterThan(0);
    expect(of(evWalled, 'bossHit')).toEqual([]);
  });
});

// --- Tripulación -----------------------------------------------------------------

describe('fantasma T140: tripulación', () => {
  it('desvanecido llama piratas fantasma (marcados `ghost`); sólido no llama a nadie', () => {
    const g = createSurvivors(quiet((c) => stillGhost(c, 1, 8, ['tripulacion'])), 6, openSea());
    g.spawnBoss('fantasma', 300, 0);
    const ev = run(g, 9);
    const states = of(ev, 'fantasmaState');
    const summons = of(ev, 'bossSummon');
    expect(summons.length).toBeGreaterThanOrEqual(2);
    for (const s of summons) {
      expect(s).toMatchObject({ boss: 'fantasma', enemy: 'pirate', count: FANTASMA.attacks.tripulacion!.summon!.count });
      const last = states.filter((st) => st.atS <= s.atS).at(-1);
      expect(last?.state).toBe('ghost');
    }
    expect(summons[0]!.atS - states[0]!.atS).toBeCloseTo(F.ghostFirstAttackS, 1);
    // Los llamados: los vivos más los que el cañón del barco ya tumbó.
    const pirates = g.snapshot().enemiesByType.pirate ?? [];
    const sunk = of(ev, 'defeated').filter((e) => e.enemy === 'pirate').length;
    expect(pirates.length).toBeGreaterThan(0);
    expect(pirates.length + sunk).toBe(summons.reduce((n, s) => n + s.count, 0));
    for (const p of pirates) expect(p.ghost).toBe(true);
    // Los piratas del guion no son fantasmas.
    g.spawnEnemy('pirate', 500, 500);
    expect(g.snapshot().enemiesByType.pirate!.some((p) => !p.ghost)).toBe(true);
  });
});

// --- Fases, derrota y determinismo -----------------------------------------------

describe('fantasma T140: fases, derrota y determinismo', () => {
  it('las fases van por vida; vencerlo acaba la partida con `victory` y la nota grande', () => {
    const g = createSurvivors(quiet(), 7, openSea());
    g.spawnBoss('fantasma', 150, 0);
    expect(body(g)!.phase).toBe(0);
    burnTo(g, 0.5);
    const ev1 = run(g, SURVIVORS_STEP_S);
    expect(of(ev1, 'bossPhase').map((e) => e.phase)).toEqual([1]);
    expect(body(g)!.phase).toBe(1);
    expect(body(g)!.fantasma!.mode).toBe('solid');
    // Un punto de vida: el cañón del barco lo remata en cuanto dispara.
    burnTo(g, 0);
    expect(body(g)!.hp).toBeCloseTo(1, 6);
    let step: Timed[] = [];
    for (let i = 0; i < Math.round(10 / SURVIVORS_STEP_S) && of(step, 'bossDefeated').length === 0; i++) {
      step = run(g, SURVIVORS_STEP_S);
    }
    expect(of(step, 'bossDefeated')).toHaveLength(1);
    expect(of(step, 'bossDefeated')[0]).toMatchObject({ boss: 'fantasma', kind: 'boss' });
    // El final especial, en el mismo paso.
    expect(of(step, 'end')).toEqual([{ type: 'end', reason: 'victory', atS: step[0]!.atS }]);
    const s = g.snapshot();
    expect(s.end).toBe('victory');
    expect(s.status).toBe('ended');
    expect(s.finalBossDefeated).toBe(true);
    expect(s.bossesDefeated).toEqual(['fantasma']);
    expect(s.bosses).toEqual([]);
    expect(s.chests).toEqual([]);
    expect(s.card).toBeNull();
    expect(s.notes.some((n) => n.value === FANTASMA.noteValue)).toBe(true);
    expect(g.ended).toBe(true);
    expect(g.step(IDLE)).toEqual([]);
  });

  it('al amanecer, un Fantasma vivo se retira: la partida se sobrevive sin oro', () => {
    const g = createSurvivors(unsinkable(), 16, openSea(), { startAtS: 410 });
    expect(body(g)!.boss).toBe('fantasma');
    const ev = run(g, 12);
    expect(g.snapshot().end).toBe('survived');
    expect(of(ev, 'bossRetreated').map((e) => e.boss)).toEqual(['fantasma']);
    expect(g.snapshot().bosses).toEqual([]);
    expect(g.snapshot().finalBossDefeated).toBe(false);
  });

  it('una partida entera del acto 1 es determinista y enseña el Fantasma entero', () => {
    const go = (seed: number) => {
      const g = createSurvivors(unsinkable(), seed, archipelago(7));
      const hashes: string[] = [];
      const modes = new Set<string>();
      let ghostPirates = 0;
      const events = play(g, scriptedInput, (game) => {
        const s = game.snapshot();
        if (Math.round(s.activeS * 60) % 1800 === 0) hashes.push(game.stateHash());
        const f = s.bosses.find((b) => b.boss === 'fantasma')?.fantasma;
        if (f) modes.add(f.mode);
        ghostPirates += (s.enemiesByType.pirate ?? []).filter((p) => p.ghost).length;
      });
      hashes.push(g.stateHash());
      return { hashes, events, modes, ghostPirates, s: g.snapshot() };
    };
    const a = go(31);
    const b = go(31);
    expect(b.hashes).toEqual(a.hashes);
    expect(a.hashes.length).toBeGreaterThan(10);
    expect(go(32).hashes.at(-1)).not.toBe(a.hashes.at(-1));
    expect(['survived', 'victory']).toContain(a.s.end);
    expect(a.s.act).toBe(1);
    const spawns = of(a.events, 'bossSpawn');
    expect(spawns.map((e) => e.boss)).toEqual(['vecino', 'fantasma']);
    expect(spawns.find((e) => e.boss === 'fantasma')!.atS).toBeGreaterThanOrEqual(SLOT.atS);
    expect(a.modes.has('solid')).toBe(true);
    expect(a.modes.has('ghost')).toBe(true);
    expect(a.ghostPirates).toBeGreaterThan(0);
    // Los cambios de modo alternan; cada andanada avisó antes.
    const states = of(a.events, 'fantasmaState');
    expect(states.length).toBeGreaterThan(0);
    for (let i = 1; i < states.length; i++) expect(states[i]!.state).not.toBe(states[i - 1]!.state);
    const tele = of(a.events, 'bossTelegraph');
    for (const h of of(a.events, 'bossAttack').filter((e) => e.attack === 'andanada')) {
      const t = [...tele].reverse().find((e) => e.attack === 'andanada' && e.atS <= h.atS)!;
      expect(h.atS - t.atS).toBeGreaterThanOrEqual(FANTASMA.attacks.andanada!.telegraphS - SURVIVORS_STEP_S * 1.5);
    }
    // Acaba vencido o retirado, nunca en el limbo.
    expect(of(a.events, 'bossDefeated').length + of(a.events, 'bossRetreated').length).toBe(2);
    expect(a.s.bosses).toEqual([]);
    expect(a.s.end === 'victory').toBe(a.s.finalBossDefeated);
  }, 120_000);

  it('el piloto cuenta los golpes del Fantasma: a un barco quieto le llegan; el que esquiva y elige bien aguanta en Tranquila', () => {
    const idle = runBot(SURVIVORS_CONFIG, 'idle', 2, archipelago(5), { startAtS: 329 }, 420);
    expect(idle.bossHits).toBeGreaterThan(0);
    expect(idle.hits).toBeGreaterThanOrEqual(idle.bossHits);
    const greedy = runBot(SURVIVORS_CONFIG, 'greedy', 2, archipelago(5), { difficulty: 'tranquila', startAtS: 329 }, 420);
    expect(greedy.hits).toBeGreaterThanOrEqual(greedy.bossHits);
    expect(['survived', 'victory']).toContain(greedy.end);
  }, 120_000);
});
