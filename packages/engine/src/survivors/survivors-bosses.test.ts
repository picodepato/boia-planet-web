import { describe, expect, it } from 'vitest';
import { rng } from '../minigames/rng';
import type { ShipInput } from '../ship/controller';
import { runBot } from './bots';
import { inRingGap, nextPhase, phaseMarks, validateBoss } from './bosses';
import {
  type BossDef,
  type BossId,
  SURVIVORS_CONFIG,
  SURVIVORS_CONFIG_VERSION,
  SURVIVORS_STEP_S,
  type SurvivorsConfig,
  actOf,
  bossHpFor,
  harderAct,
} from './config';
import { type SurvivorsEvent, type SurvivorsGame, type SurvivorsInput, createSurvivors } from './sim';
import type { SurvivorsWorld } from './world';

/**
 * El sistema genérico de bosses (plan 012 T137): fases por vida y por
 * tiempo, ataques avisados, llamadas, ventanas invulnerables, los huecos del
 * guion, los comunes más despacio, la retirada al amanecer, los actos como
 * datos y el determinismo. Con el boss de pruebas `prueba`: los de verdad son
 * T138–T141. En la config de producción ningún hueco lo llama.
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

function withConfig(patch: (c: SurvivorsConfig) => void): SurvivorsConfig {
  const c = structuredClone(SURVIVORS_CONFIG);
  patch(c);
  return c;
}

const PRUEBA = SURVIVORS_CONFIG.bosses.prueba!;

/** Sin guion ni hitos, barco insumergible: sólo lo que la prueba pone. */
const quiet = (patch: (c: SurvivorsConfig) => void = () => {}) =>
  withConfig((c) => {
    c.acts = [{ act: 1, durationS: c.durationS, tracks: [], events: [] }];
    c.player.waterCapacity = 1e12;
    c.salvavidas.offerChance = 0;
    patch(c);
  });

/** El guion de verdad con los tres huecos encendidos y el boss de pruebas en todos. */
const scripted = (patch: (c: SurvivorsConfig) => void = () => {}) =>
  withConfig((c) => {
    c.player.waterCapacity = 1e12;
    c.salvavidas.offerChance = 0;
    c.acts = c.acts.map((a) => ({
      ...a,
      events: a.events.map((ev) =>
        ev.type === 'miniboss' || ev.type === 'boss' ? { ...ev, ref: 'prueba', enabled: true } : ev,
      ),
    }));
    patch(c);
  });

/** El boss de pruebas con una sola fase quieta y estos ataques (o ninguno). */
function stillBoss(c: SurvivorsConfig, attacks: string[], every = 1, first = 0.1): void {
  const b = c.bosses.prueba!;
  b.phases = [
    {
      untilHpFraction: 0,
      untilS: 0,
      movement: 'still',
      standoff: 0,
      speedScale: 1,
      invulnerable: false,
      attacks,
      attackEveryS: every,
      firstAttackS: first,
    },
  ];
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

function play(
  game: SurvivorsGame,
  input: (step: number) => SurvivorsInput,
  each: (game: SurvivorsGame, ev: readonly SurvivorsEvent[]) => void = () => {},
  maxSteps = 40_000,
): SurvivorsEvent[] {
  const events: SurvivorsEvent[] = [];
  let steps = 0;
  while (!game.ended && steps < maxSteps) {
    const ev = game.step(input(steps));
    for (const e of ev) if (e.type !== 'fire') events.push({ ...e });
    each(game, ev);
    steps++;
  }
  return events;
}

function run(game: SurvivorsGame, seconds: number, input: SurvivorsInput = {}): SurvivorsEvent[] {
  const out: SurvivorsEvent[] = [];
  for (let i = 0; i < Math.round(seconds / SURVIVORS_STEP_S) && !game.ended; i++) {
    for (const e of game.step(input)) if (e.type !== 'fire') out.push({ ...e });
  }
  return out;
}

const of = <T extends SurvivorsEvent['type']>(events: readonly SurvivorsEvent[], type: T) =>
  events.filter((e): e is Extract<SurvivorsEvent, { type: T }> => e.type === type);

/**
 * Quema al boss (por el gancho de la Llama) hasta dejarle `fraction` de vida;
 * con 0, le deja 1 punto para que lo remate el cañón dentro de un paso (lo
 * que pasa fuera de `step` no deja sucesos).
 */
function burnTo(game: SurvivorsGame, fraction: number): void {
  const b = game.snapshot().bosses[0]!;
  const want = b.hp - Math.max(1, b.maxHp * fraction);
  game.flameBosses(b.x, b.y, 1, want / game.config.bossFight.flameDps);
}

// --- Datos ---------------------------------------------------------------------

describe('bosses T137: datos', () => {
  it('la versión de la config sube; el boss de pruebas existe y es coherente; nada lo llama en producción', () => {
    expect(SURVIVORS_CONFIG_VERSION).toBeGreaterThanOrEqual(8);
    expect(PRUEBA.kind).toBe('miniboss');
    expect(validateBoss(PRUEBA)).toEqual([]);
    for (const def of Object.values(SURVIVORS_CONFIG.bosses)) expect(validateBoss(def!)).toEqual([]);
    const kinds = new Set(Object.values(PRUEBA.attacks).map((a) => a.kind));
    expect([...kinds].sort()).toEqual(['broadside', 'circles', 'line', 'ring', 'summon']);
    // Los huecos de los bosses que aún no existen van apagados; sólo el Kraken
    // (T141, acto 2) está encendido, y el acto 2 no se juega en producción
    // hasta la campaña (T144).
    for (const act of SURVIVORS_CONFIG.acts) {
      const slots = act.events.filter((e) => e.type === 'miniboss' || e.type === 'boss');
      expect(slots.length).toBe(3);
      for (const s of slots) {
        expect(s.enabled).toBe(s.ref === 'kraken' && act.act === 2);
        expect(s.ref).not.toBe('prueba');
        if (s.enabled) expect(SURVIVORS_CONFIG.bosses[s.ref as BossId]).toBeDefined();
      }
    }
    // Y la simulación de verdad no saca ningún boss en ningún hueco del acto
    // 1, ni empezando después del último; en el 2, el Kraken.
    const g1 = createSurvivors(SURVIVORS_CONFIG, 3, openSea(), { startAtS: 400, act: 1 });
    run(g1, 2);
    expect(g1.snapshot().bosses).toEqual([]);
    const g2 = createSurvivors(SURVIVORS_CONFIG, 3, openSea(), { startAtS: 400, act: 2 });
    run(g2, 2);
    expect(g2.snapshot().bosses.map((b) => b.boss)).toEqual(['kraken']);
  });

  it('el acto 2 es el guion del 1 más duro: tipos peligrosos antes, más aguante, el Kraken al final', () => {
    const a1 = actOf(SURVIVORS_CONFIG, 1)!;
    const a2 = actOf(SURVIVORS_CONFIG, 2)!;
    expect(SURVIVORS_CONFIG.acts.map((a) => a.act)).toEqual([1, 2]);
    expect(actOf(SURVIVORS_CONFIG, 3)).toBeNull();
    expect(a2.durationS).toBe(a1.durationS);
    expect(a2.tracks.map((t) => t.enemy)).toEqual(a1.tracks.map((t) => t.enemy));
    const from = (a: typeof a1) => Object.fromEntries(a.tracks.map((t) => [t.enemy, t.fromS]));
    const f1 = from(a1);
    const f2 = from(a2);
    for (const id of ['crab', 'pirate', 'swordfish'] as const) expect(f2[id]!).toBeLessThan(f1[id]!);
    for (const id of ['piranha', 'jellyfish', 'gull'] as const) expect(f2[id]).toBe(f1[id]);
    // Las curvas se adelantan lo mismo que la pista, sin bajar de 0.
    const p1 = a1.tracks.find((t) => t.enemy === 'pirate')!;
    const p2 = a2.tracks.find((t) => t.enemy === 'pirate')!;
    expect(p2.keys.map((k) => k.atS)).toEqual(p1.keys.map((k) => Math.max(0, k.atS - (p1.fromS - p2.fromS))));
    expect(a2.enemyHpScale!).toBeGreaterThan(1);
    expect(a2.bossHpScale!).toBeGreaterThan(1);
    expect(a2.events.find((e) => e.type === 'boss')!.ref).toBe('kraken');
    expect(a2.events.filter((e) => e.type !== 'boss')).toEqual(a1.events.filter((e) => e.type !== 'boss'));
    // `harderAct` compone: un acto 3 sobre el 2 multiplica otra vez.
    const a3 = harderAct(a2, { act: 3, enemyHpScale: 1.2, bossHpScale: 1.2, earlierS: { pirate: 1000 }, finalBoss: 'capitan' });
    expect(a3.enemyHpScale!).toBeCloseTo(a2.enemyHpScale! * 1.2);
    expect(a3.tracks.find((t) => t.enemy === 'pirate')!.fromS).toBe(0);
  });

  it('el acto se elige al crear la partida; el aguante de lo que echa el guion y el de los bosses escalan por acto y dificultad', () => {
    expect(createSurvivors(SURVIVORS_CONFIG, 1, openSea()).snapshot().act).toBe(1);
    expect(createSurvivors(SURVIVORS_CONFIG, 1, openSea(), { act: 2 }).snapshot().act).toBe(2);
    expect(() => createSurvivors(SURVIVORS_CONFIG, 1, openSea(), { act: 3 })).toThrow(/act 3/);
    const still = withConfig((c) => {
      c.player.waterCapacity = 1e12;
      for (const e of Object.values(c.enemies)) {
        e!.speed = 0;
        e!.acceleration = 0;
      }
    });
    const maxHp = (act: number) => {
      const g = createSurvivors(still, 7, openSea(), { act });
      run(g, 8);
      const p = g.snapshot().enemies.filter((e) => e.type === 'piranha');
      expect(p.length).toBeGreaterThan(0);
      return p[0]!.maxHp;
    };
    expect(maxHp(2) / maxHp(1)).toBeCloseTo(actOf(SURVIVORS_CONFIG, 2)!.enemyHpScale!, 5);
    const d = SURVIVORS_CONFIG.difficulties;
    expect(bossHpFor(PRUEBA, actOf(SURVIVORS_CONFIG, 1), d.normal)).toBe(PRUEBA.hp);
    expect(bossHpFor(PRUEBA, actOf(SURVIVORS_CONFIG, 2), d.tormenta)).toBeCloseTo(
      PRUEBA.hp * actOf(SURVIVORS_CONFIG, 2)!.bossHpScale! * d.tormenta.enemyHp,
    );
    const g = createSurvivors(quiet(), 1, openSea(), { act: 1, difficulty: 'tranquila' });
    const b = g.spawnBoss('prueba', 400, 0)!;
    expect(b.maxHp).toBeCloseTo(PRUEBA.hp * d.tranquila.enemyHp);
    expect(b.hpFraction).toBe(1);
    expect(g.spawnBoss('capitan', 400, 0)).toBeNull();
  });

  it('las reglas puras: huecos del anillo, fases y marcas', () => {
    // 3 huecos de 0,5 rad desde 0: en 0 (centro), 2π/3, 4π/3; fuera, no.
    expect(inRingGap(0, 3, 0.5, 0)).toBe(true);
    expect(inRingGap(0.2, 3, 0.5, 0)).toBe(true);
    expect(inRingGap(0.3, 3, 0.5, 0)).toBe(false);
    expect(inRingGap((Math.PI * 2) / 3 + 0.1, 3, 0.5, 0)).toBe(true);
    expect(inRingGap(Math.PI / 3, 3, 0.5, 0)).toBe(false);
    expect(inRingGap(1 + 0.1, 3, 0.5, 1)).toBe(true);
    expect(inRingGap(0, 0, 0.5, 0)).toBe(false);
    expect(nextPhase(PRUEBA, 0, 1, 100)).toBeNull();
    expect(nextPhase(PRUEBA, 0, 0.5, 0)).toBe(1);
    expect(nextPhase(PRUEBA, 1, 0.2, 1)).toBeNull();
    expect(nextPhase(PRUEBA, 1, 0.2, 2)).toBe(2);
    expect(nextPhase(PRUEBA, 2, 0, 1000)).toBeNull();
    const cyc: BossDef = {
      ...PRUEBA,
      phases: [
        { ...PRUEBA.phases[1]!, untilS: 1, nextByTime: 1 },
        { ...PRUEBA.phases[1]!, untilS: 1, nextByTime: 0, untilHpFraction: 0.3 },
      ],
    };
    expect(nextPhase(cyc, 1, 1, 1)).toBe(0);
    expect(nextPhase(cyc, 1, 0.3, 0)).toBeNull(); // por vida iría a la 2, que no existe: se queda
    expect(phaseMarks(PRUEBA)).toEqual([0.5]);
    expect(validateBoss({ ...PRUEBA, phases: [{ ...PRUEBA.phases[0]!, attacks: ['nada'] }] })).toContain(
      'prueba: fase 0 ataque nada no existe',
    );
  });
});

// --- Fases, invulnerabilidad y armas ----------------------------------------------

describe('bosses T137: fases y daño', () => {
  it('las fases pasan por vida y por tiempo; la fase invulnerable no recibe daño; los sucesos lo cuentan', () => {
    const g = createSurvivors(quiet(), 1, openSea());
    g.spawnBoss('prueba', 500, 0);
    expect(g.snapshot().bosses[0]).toMatchObject({ boss: 'prueba', phase: 0, phaseCount: 3, invulnerable: false });
    burnTo(g, 0.5);
    const ev = run(g, 0.1);
    expect(of(ev, 'bossPhase').map((e) => e.phase)).toEqual([1]);
    const s = g.snapshot();
    expect(s.bosses[0]!.phase).toBe(1);
    expect(s.bosses[0]!.invulnerable).toBe(true);
    expect(s.bosses[0]!.hpFraction).toBeCloseTo(0.5, 2);
    // Invulnerable: la llama no le hace nada.
    const hpBefore = s.bosses[0]!.hp;
    expect(g.flameBosses(s.bosses[0]!.x, s.bosses[0]!.y, 10, 1)).toBe(0);
    expect(of(run(g, 0.1), 'bossDamaged')).toEqual([]);
    expect(g.snapshot().bosses[0]!.hp).toBe(hpBefore);
    // A los 2 s de fase pasa a la tercera, ya vulnerable.
    const ev2 = run(g, 2);
    expect(of(ev2, 'bossPhase').map((e) => e.phase)).toEqual([2]);
    expect(g.snapshot().bosses[0]).toMatchObject({ phase: 2, invulnerable: false });
  });

  it('las armas del barco hieren al boss (el cañón le dispara si es lo único a tiro) y lo vencen', () => {
    const g = createSurvivors(quiet((c) => stillBoss(c, [])), 1, openSea());
    g.spawnBoss('prueba', 200, 0);
    const ev = run(g, 4);
    const dmg = of(ev, 'bossDamaged');
    expect(dmg.length).toBeGreaterThan(3);
    expect(g.snapshot().bosses[0]!.hp).toBeLessThan(PRUEBA.hp);
    expect(dmg.at(-1)!.hp).toBe(g.snapshot().bosses[0]!.hp);
  });

  it('al caer un miniboss: suceso, nota grande, cofre que flota y se abre al tocarlo; lo vencido queda en el snapshot', () => {
    const g = createSurvivors(quiet((c) => stillBoss(c, [])), 1, openSea());
    // Pegado al barco: el cofre cae a su alcance.
    g.spawnBoss('prueba', 30, 0);
    burnTo(g, 0);
    const ev = run(g, 1);
    expect(of(ev, 'bossDamaged').length).toBeGreaterThan(0);
    expect(of(ev, 'bossDefeated')).toHaveLength(1);
    expect(of(ev, 'bossDefeated')[0]).toMatchObject({ boss: 'prueba', kind: 'miniboss' });
    expect(of(ev, 'chest')).toHaveLength(1);
    expect(of(ev, 'chestOpened')).toHaveLength(1);
    expect(of(ev, 'chestOpened')[0]!.id).toBe(of(ev, 'chest')[0]!.id);
    const s = g.snapshot();
    expect(s.bosses).toEqual([]);
    expect(s.chests).toEqual([]);
    expect(s.bossesDefeated).toEqual(['prueba']);
    expect(s.finalBossDefeated).toBe(false);
    // La nota grande: su valor es el del boss (la figura mayor que no lo pasa).
    const big = Math.max(...s.notes.map((n) => n.value), ...of(ev, 'note').map((n) => n.value));
    expect(big).toBeGreaterThanOrEqual(PRUEBA.noteValue);
    // Lejos, el cofre se queda flotando hasta que el barco llega.
    const far = createSurvivors(quiet((c) => stillBoss(c, [])), 1, openSea());
    far.spawnBoss('prueba', 250, 0);
    burnTo(far, 0);
    const ev2 = run(far, 1.5);
    expect(of(ev2, 'chest')).toHaveLength(1);
    expect(of(ev2, 'chestOpened')).toHaveLength(0);
    expect(far.snapshot().chests).toHaveLength(1);
    expect(far.snapshot().chests[0]).toMatchObject({ boss: 'prueba', radius: SURVIVORS_CONFIG.bossFight.chestRadius });
    // La nota grande sube de nivel: la carta se contesta para que el barco navegue.
    const ev3 = run(far, 4, { ship: { dirX: 1, dirY: 0, throttle: 1, drift: false }, choose: 0 });
    expect(of(ev3, 'chestOpened')).toHaveLength(1);
    expect(far.snapshot().chests).toEqual([]);
  });

  it('un boss final vencido marca `finalBossDefeated`', () => {
    const g = createSurvivors(
      quiet((c) => {
        stillBoss(c, []);
        c.bosses.prueba!.kind = 'boss';
        c.bosses.prueba!.chest = false;
      }),
      1,
      openSea(),
    );
    g.spawnBoss('prueba', 300, 0);
    burnTo(g, 0);
    const ev = run(g, 1.5);
    expect(of(ev, 'bossDefeated')[0]!.kind).toBe('boss');
    expect(of(ev, 'chest')).toEqual([]);
    expect(g.snapshot().finalBossDefeated).toBe(true);
    expect(g.snapshot().end).toBeNull();
  });
});

// --- Ataques avisados -------------------------------------------------------------

describe('bosses T137: ataques', () => {
  it('cada golpe de ataque va precedido de su aviso, al menos `telegraphS` antes', () => {
    const kinds = new Set<string>();
    for (const seed of [1, 2, 3]) {
      const g = createSurvivors(scripted(), seed, openSea(), { startAtS: 140 });
      // Cada suceso con su segundo: el aviso de cada ataque y, después, su golpe.
      const timed: { t: number; e: SurvivorsEvent }[] = [];
      play(
        g,
        () => ({ choose: 0 }),
        (game, ev) => {
          for (const e of ev) if (e.type.startsWith('boss')) timed.push({ t: game.activeS, e: { ...e } });
        },
        60 * 120,
      );
      const armed = new Map<string, number>();
      let hits = 0;
      for (const { t, e } of timed) {
        if (e.type === 'bossTelegraph') armed.set(`${e.id}:${e.attack}`, t);
        if (e.type === 'bossAttack') {
          const at = armed.get(`${e.id}:${e.attack}`);
          expect(at).toBeDefined();
          expect(t - at!).toBeGreaterThanOrEqual(PRUEBA.attacks[e.attack]!.telegraphS - 2 * SURVIVORS_STEP_S);
        }
        if (e.type === 'bossHit' && e.attack !== null) {
          hits++;
          kinds.add(PRUEBA.attacks[e.attack]!.kind);
          const at = [...armed.entries()].filter(([k]) => k.endsWith(`:${e.attack}`)).map(([, v]) => v);
          expect(at.length).toBeGreaterThan(0);
          expect(t - Math.max(...at)).toBeGreaterThanOrEqual(PRUEBA.attacks[e.attack]!.telegraphS - 2 * SURVIVORS_STEP_S);
        }
      }
      expect(timed.filter(({ e }) => e.type === 'bossSpawn').length).toBeGreaterThanOrEqual(1);
      expect(hits).toBeGreaterThan(0);
    }
    // El barco quieto recibe golpes de más de una forma de ataque.
    expect(kinds.size).toBeGreaterThanOrEqual(2);
  });

  it('el anillo: progreso de aviso y de golpe en el snapshot; los huecos y las islas lo paran', () => {
    const hits = (obstacles: SurvivorsWorld['obstacles'], gaps: number, gapPhase?: number) => {
      const g = createSurvivors(
        quiet((c) => {
          stillBoss(c, ['onda'], 10, 0.1);
          c.bosses.prueba!.attacks.onda!.gaps = gaps;
          c.bosses.prueba!.attacks.onda!.gapRad = 1;
        }),
        1,
        openSea(obstacles),
      );
      g.spawnBoss('prueba', 0, -300);
      let warned = 0;
      let active = 0;
      let maxRing = 0;
      const ev: SurvivorsEvent[] = [];
      for (let i = 0; i < 60 * 3; i++) {
        ev.push(...game_step(g));
        const w = g.snapshot().bossWarnings;
        for (const x of w) {
          expect(x.kind).toBe('ring');
          if (!x.hit) warned++;
          else {
            active++;
            maxRing = Math.max(maxRing, x.ringRadius);
          }
          expect(x.progress).toBeGreaterThanOrEqual(0);
          expect(x.progress).toBeLessThanOrEqual(1);
          if (gapPhase !== undefined) expect(x.gapPhase).toBeCloseTo(gapPhase);
        }
      }
      expect(warned).toBeGreaterThan(0);
      expect(active).toBeGreaterThan(0);
      expect(maxRing).toBeGreaterThan(PRUEBA.attacks.onda!.radius * 0.9);
      return of(ev, 'bossHit').length;
    };
    const game_step = (g: SurvivorsGame) => g.step().filter((e) => e.type !== 'fire').map((e) => ({ ...e }));
    // Sin huecos y sin islas: moja.
    expect(hits([], 0)).toBe(1);
    // Una isla entre el boss y el barco: la onda no llega.
    expect(hits([{ x: 0, y: -150, radius: 50 }], 0)).toBe(0);
    // Una isla a un lado: no estorba.
    expect(hits([{ x: 200, y: -150, radius: 50 }], 0)).toBe(1);
  });

  it('el anillo con huecos: el barco en un hueco no se moja', () => {
    // Un solo hueco muy ancho (casi toda la vuelta) frente a uno estrecho: con el ancho casi siempre toca hueco.
    const count = (gapRad: number) => {
      let n = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const g = createSurvivors(
          quiet((c) => {
            stillBoss(c, ['onda'], 10, 0.1);
            c.bosses.prueba!.attacks.onda!.gaps = 1;
            c.bosses.prueba!.attacks.onda!.gapRad = gapRad;
          }),
          seed,
          openSea(),
        );
        g.spawnBoss('prueba', 0, -300);
        n += of(run(g, 3), 'bossHit').length;
      }
      return n;
    };
    expect(count(0.01)).toBe(12);
    expect(count(Math.PI * 2 - 0.02)).toBe(0);
  });

  it('los círculos caen donde estaba el barco (el primero encima) y mojan; en el snapshot va uno por círculo', () => {
    const g = createSurvivors(quiet((c) => stillBoss(c, ['rocas'], 10, 0.1)), 2, openSea());
    g.spawnBoss('prueba', 0, -400);
    run(g, 0.2);
    const w = g.snapshot().bossWarnings;
    expect(w).toHaveLength(PRUEBA.attacks.rocas!.count);
    expect(w.every((x) => x.kind === 'circles' && !x.hit)).toBe(true);
    expect(Math.hypot(w[0]!.x, w[0]!.y)).toBeLessThan(1);
    for (const x of w) expect(Math.hypot(x.x, x.y)).toBeLessThanOrEqual(PRUEBA.attacks.rocas!.spread + 1);
    const ev = run(g, 2);
    expect(of(ev, 'bossAttack')[0]).toMatchObject({ attack: 'rocas', kind: 'circles' });
    expect(of(ev, 'bossHit')).toHaveLength(1);
    expect(of(ev, 'bossHit')[0]!.attack).toBe('rocas');
  });

  it('la embestida: avisa con la línea hacia el barco y luego el boss recorre `length` u (y se para en una isla)', () => {
    const charge = (obstacles: SurvivorsWorld['obstacles']) => {
      const g = createSurvivors(quiet((c) => stillBoss(c, ['embestida'], 10, 0.1)), 1, openSea(obstacles));
      g.spawnBoss('prueba', 500, 0);
      run(g, 0.2);
      const w = g.snapshot().bossWarnings[0]!;
      expect(w).toMatchObject({ kind: 'line', hit: false, length: PRUEBA.attacks.embestida!.length });
      expect(Math.abs(Math.cos(w.heading) + 1)).toBeLessThan(1e-6); // hacia el barco (−x)
      const x0 = g.snapshot().bosses[0]!.x;
      const ev = run(g, 2.5);
      return { ev, travelled: x0 - g.snapshot().bosses[0]!.x };
    };
    const open = charge([]);
    // Pasa por encima del barco y lo moja por contacto con el agua del ataque.
    expect(of(open.ev, 'bossHit').length).toBeGreaterThanOrEqual(1);
    expect(of(open.ev, 'bossHit')[0]!.attack).toBe('embestida');
    expect(open.travelled).toBeGreaterThan(PRUEBA.attacks.embestida!.length * 0.9);
    const blocked = charge([{ x: 300, y: 0, radius: 60 }]);
    expect(blocked.travelled).toBeLessThan(200);
    expect(of(blocked.ev, 'bossHit')).toEqual([]);
  });

  it('la andanada: disparos rectos por los dos costados, que las islas paran', () => {
    const g = createSurvivors(quiet((c) => stillBoss(c, ['andanada'], 10, 0.1)), 1, openSea([{ x: 300, y: 250, radius: 60 }]));
    // El boss mira al barco (−x) al entrar: los costados tiran hacia ±y.
    g.spawnBoss('prueba', 300, 0);
    run(g, 0.2);
    const w = g.snapshot().bossWarnings;
    expect(w).toHaveLength(2);
    expect(w.map((x) => x.kind)).toEqual(['broadside', 'broadside']);
    const ev: SurvivorsEvent[] = [];
    let maxShots = 0;
    let down = false;
    for (let i = 0; i < 60 * 3; i++) {
      for (const e of g.step()) if (e.type !== 'fire') ev.push({ ...e });
      const shots = g.snapshot().enemyProjectiles;
      maxShots = Math.max(maxShots, shots.length);
      for (const s of shots) {
        expect(Math.abs(s.vx)).toBeLessThan(Math.abs(s.vy));
        if (s.vy < 0) down = true;
      }
    }
    expect(of(ev, 'bossAttack')[0]!.kind).toBe('broadside');
    expect(maxShots).toBe(PRUEBA.attacks.andanada!.count * 2);
    // El costado de la isla (+y) pierde disparos; el otro (−y) llega al mar abierto.
    const blocked = of(ev, 'blocked').filter((b) => b.owner === 'enemy');
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.length).toBeLessThan(maxShots);
    expect(down).toBe(true);
    expect(of(ev, 'bossHit')).toEqual([]);
  });

  it('la llamada: aparecen enemigos alrededor del boss por el sistema de aparición, bajo el tope', () => {
    const g = createSurvivors(quiet((c) => stillBoss(c, ['refuerzos'], 10, 0.1)), 1, openSea(), { quality: 'baja' });
    g.spawnBoss('prueba', 500, 0);
    expect(g.snapshot().enemies).toEqual([]);
    const ev = run(g, 0.5);
    const s = of(ev, 'bossSummon');
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ enemy: 'piranha', count: PRUEBA.attacks.refuerzos!.summon!.count });
    // Sin aviso (telegraphS 0): el aviso y el golpe van juntos.
    expect(of(ev, 'bossTelegraph')).toHaveLength(1);
    expect(of(ev, 'bossAttack')).toHaveLength(1);
    const alive = g.snapshot().enemies.filter((e) => e.type === 'piranha');
    expect(alive.length).toBeGreaterThanOrEqual(1);
    for (const e of alive) expect(Math.hypot(e.x - 500, e.y)).toBeLessThan(200);
    // El tope manda: lleno, no llama a nadie más.
    const full = createSurvivors(quiet((c) => stillBoss(c, ['refuerzos'], 10, 0.1)), 1, openSea(), { quality: 'baja' });
    for (let i = 0; i < SURVIVORS_CONFIG.caps.baja.enemies; i++) full.spawnEnemy('crab', -1500 + i * 40, -1500);
    full.spawnBoss('prueba', 500, 0);
    expect(of(run(full, 0.5), 'bossSummon')).toEqual([]);
  });

  it('un ataque invulnerable protege al boss mientras dura y las bolas lo atraviesan', () => {
    const g = createSurvivors(
      quiet((c) => {
        stillBoss(c, ['onda'], 10, 0.1);
        c.bosses.prueba!.attacks.onda!.invulnerable = true;
        c.bosses.prueba!.attacks.onda!.telegraphS = 2;
      }),
      1,
      openSea(),
    );
    g.spawnBoss('prueba', 200, 0);
    const ev = run(g, 1.5);
    expect(of(ev, 'bossTelegraph')).toHaveLength(1);
    expect(g.snapshot().bosses[0]!.invulnerable).toBe(true);
    expect(of(ev, 'bossDamaged')).toEqual([]);
    expect(g.snapshot().bosses[0]!.hp).toBe(PRUEBA.hp);
  });
});

// --- Guion, comunes y amanecer --------------------------------------------------------

describe('bosses T137: guion', () => {
  it('los huecos encendidos sacan el boss a su segundo, delante del barco; los comunes bajan de ritmo', () => {
    const slow = withConfig((c) => {
      c.player.waterCapacity = 1e12;
      c.salvavidas.offerChance = 0;
      for (const e of Object.values(c.enemies)) {
        e!.speed = 0;
        e!.acceleration = 0;
      }
      stillBoss(c, []);
      // Sin tope que recorte la referencia: lo que se mide es el ritmo del guion.
      c.caps.alta.enemies = 1000;
      c.acts = [{ ...c.acts[0]!, events: [{ atS: 150, type: 'miniboss', ref: 'prueba' }] }];
    });
    const seen = (cfg: SurvivorsConfig) => {
      const g = createSurvivors(cfg, 4, openSea(), { startAtS: 149 });
      const before = new Set(g.snapshot().enemies.map((e) => e.id));
      const ids = new Set<number>();
      let spawn: SurvivorsEvent | undefined;
      for (let i = 0; i < 60 * 31; i++) {
        for (const e of g.step()) if (e.type === 'bossSpawn') spawn = { ...e };
        if (g.activeS > 151) for (const e of g.snapshot().enemies) if (!before.has(e.id)) ids.add(e.id);
      }
      return { ids: ids.size, spawn, g };
    };
    const withBoss = seen(slow);
    expect(withBoss.spawn).toMatchObject({ type: 'bossSpawn', boss: 'prueba', kind: 'miniboss', nameKey: PRUEBA.i18nKey });
    const b = withBoss.g.snapshot().bosses[0]!;
    expect(Math.hypot(b.x, b.y)).toBeCloseTo(SURVIVORS_CONFIG.bossFight.entryDistance, 0);
    const without = seen(withConfig((c) => {
      Object.assign(c, structuredClone(slow));
      c.acts = [{ ...c.acts[0]!, events: [] }];
    }));
    expect(without.spawn).toBeUndefined();
    expect(without.g.snapshot().pressure).toBe(0);
    const ratio = withBoss.ids / without.ids;
    expect(ratio).toBeLessThan(SURVIVORS_CONFIG.bossFight.commonSpawnScale + 0.15);
    expect(ratio).toBeGreaterThan(SURVIVORS_CONFIG.bossFight.commonSpawnScale - 0.15);
  });

  it('con un boss vivo los comunes nadan más despacio (`bossFight.commonSpeedScale`)', () => {
    const travel = (boss: boolean) => {
      const g = createSurvivors(quiet((c) => stillBoss(c, [])), 1, openSea());
      if (boss) g.spawnBoss('prueba', -1200, 0);
      g.spawnEnemy('piranha', 900, 0);
      const x0 = g.snapshot().enemies[0]!.x;
      run(g, 1.5);
      return x0 - g.snapshot().enemies[0]!.x;
    };
    const normal = travel(false);
    const slowed = travel(true);
    expect(normal).toBeGreaterThan(100);
    expect(slowed / normal).toBeCloseTo(SURVIVORS_CONFIG.bossFight.commonSpeedScale, 1);
  });

  it('al amanecer un boss vivo se retira: la partida se sobrevive sin contarlo como vencido', () => {
    const g = createSurvivors(
      scripted((c) => {
        c.bosses.prueba!.hp = 1e9;
        c.bosses.prueba!.kind = 'boss';
      }),
      5,
      openSea(),
      { startAtS: 415 },
    );
    expect(g.snapshot().bosses).toHaveLength(1);
    const ev = play(g, () => ({ choose: 0 }));
    expect(g.snapshot().end).toBe('survived');
    const retreat = of(ev, 'bossRetreated');
    expect(retreat).toHaveLength(1);
    expect(retreat[0]).toMatchObject({ boss: 'prueba', kind: 'boss' });
    expect(ev.indexOf(retreat[0]!)).toBeLessThan(ev.findIndex((e) => e.type === 'end'));
    expect(of(ev, 'bossDefeated')).toEqual([]);
    const s = g.snapshot();
    expect(s.bosses).toEqual([]);
    expect(s.bossesDefeated).toEqual([]);
    expect(s.finalBossDefeated).toBe(false);
  });

  it('el atajo &t= entra en la pelea del último hueco pasado (y en ninguna en producción)', () => {
    const at = (t: number) => createSurvivors(scripted(), 2, archipelago(3), { startAtS: t }).snapshot();
    expect(at(100).bosses).toEqual([]);
    expect(at(200).bosses).toHaveLength(1);
    expect(at(280).bosses).toHaveLength(1);
    expect(at(340).bosses).toHaveLength(1);
    // Determinista: dos partidas iguales, el mismo estado.
    const a = createSurvivors(scripted(), 2, archipelago(3), { startAtS: 340 });
    const b = createSurvivors(scripted(), 2, archipelago(3), { startAtS: 340 });
    for (let i = 0; i < 120; i++) {
      a.step(scriptedInput(i));
      b.step(scriptedInput(i));
    }
    expect(a.stateHash()).toBe(b.stateHash());
  });

  it('una partida entera con el boss de pruebas en los tres huecos es determinista y se ve el sistema entero', () => {
    const go = (seed: number) => {
      const g = createSurvivors(scripted(), seed, archipelago(7));
      const hashes: string[] = [];
      const kinds = new Set<string>();
      let warnings = 0;
      let maxBosses = 0;
      let slowedSteps = 0;
      const events = play(g, scriptedInput, (game, ev) => {
        const s = game.snapshot();
        if (Math.round(s.activeS * 60) % 1800 === 0) hashes.push(game.stateHash());
        warnings += s.bossWarnings.length;
        maxBosses = Math.max(maxBosses, s.bosses.length);
        if (s.bosses.length > 0) slowedSteps++;
        for (const e of ev) if (e.type === 'bossAttack') kinds.add(e.kind);
      });
      hashes.push(g.stateHash());
      return { hashes, events, kinds, warnings, maxBosses, slowedSteps, end: g.snapshot().end, s: g.snapshot() };
    };
    const a = go(21);
    const b = go(21);
    expect(a.end).toBe('survived');
    expect(b.hashes).toEqual(a.hashes);
    expect(a.hashes.length).toBeGreaterThan(10);
    expect(go(22).hashes.at(-1)).not.toBe(a.hashes.at(-1));
    const spawns = of(a.events, 'bossSpawn');
    expect(spawns).toHaveLength(3);
    expect(spawns.map((e) => e.boss)).toEqual(['prueba', 'prueba', 'prueba']);
    expect(a.maxBosses).toBeGreaterThanOrEqual(1);
    expect(a.warnings).toBeGreaterThan(0);
    expect(a.slowedSteps).toBeGreaterThan(0);
    expect(a.kinds.size).toBeGreaterThanOrEqual(3);
    // Cada boss acaba vencido o retirado, nunca en el limbo.
    const gone = of(a.events, 'bossDefeated').length + of(a.events, 'bossRetreated').length;
    expect(gone).toBe(3);
    expect(a.s.bosses).toEqual([]);
    expect(of(a.events, 'chest').length).toBe(of(a.events, 'bossDefeated').length);
  }, 60_000);

  it('el piloto cuenta los golpes de boss y los vencidos', () => {
    const r = runBot(scripted(), 'greedy', 1, openSea(), { startAtS: 140 }, 200);
    expect(r.bossHits + r.bossesDefeated.length).toBeGreaterThan(0);
    expect(r.hits).toBeGreaterThanOrEqual(r.bossHits);
    for (const id of r.bossesDefeated) expect(id satisfies BossId).toBe('prueba');
  }, 60_000);
});
