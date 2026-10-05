import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { rng } from '../minigames/rng';
import { type BotKind, type BotRun, killShare, levelGaps, runBot } from './bots';
import {
  DIFFICULTY_IDS,
  type DifficultyId,
  type EnemyId,
  SURVIVORS_CONFIG,
  type SurvivorsConfig,
  trackAt,
} from './config';
import { createSurvivors } from './sim';
import { type SurvivorsWorld, survivorsWorldOf } from './world';

/**
 * Equilibrio de la beta 2 con pilotos (plan 011 T132): partidas enteras
 * aceleradas por dificultad y semilla, contra la config de verdad. Las cifras
 * medidas (las curvas) están en la sección de T132 de `ESTADO.md`; aquí sólo
 * se fija la forma: el barco parado pierde pronto, el que esquiva llega a los
 * últimos minutos en Normal, Tranquila es claramente más fácil y Tormenta más
 * difícil, y los niveles llegan a buen ritmo.
 *
 * Es el equilibrio del bucle **sin bosses** (la beta 2): los pilotos juegan
 * con los huecos de boss del guion apagados (`WAVES_ONLY`). El equilibrio con
 * los bosses (el Barco Pirata Fantasma entra a las 5:30 desde T140) se mide
 * aparte, en `survivors-boss-balance.test.ts` (T147).
 */

/** La config de verdad con los huecos de boss apagados: sólo las oleadas. */
const WAVES_ONLY: SurvivorsConfig = {
  ...SURVIVORS_CONFIG,
  acts: SURVIVORS_CONFIG.acts.map((a) => ({
    ...a,
    events: a.events.map((ev) =>
      ev.type === 'boss' || ev.type === 'miniboss' ? { ...ev, enabled: false } : ev,
    ),
  })),
};

/** El mapa compartido, con sus islas. */
function arcillaWorld(): SurvivorsWorld {
  const w = WORLD_REGISTRY.get('arcilla').config;
  return survivorsWorldOf(w, w.bounds, { x: 0, y: 0 });
}

/** Un archipiélago denso en un mar pequeño que da la vuelta. */
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

/** Semillas impares en el mapa de verdad, pares en un archipiélago. */
const SEEDS = [1, 2, 3, 4, 5, 6];
const worldFor = (seed: number): SurvivorsWorld =>
  seed % 2 === 1 ? arcillaWorld() : archipelago(30 + seed);

const cache = new Map<string, BotRun[]>();
/** Las partidas de un piloto en una dificultad (una por semilla), medidas una vez. */
function runs(difficulty: DifficultyId, bot: BotKind, quality: 'alta' | 'baja' = 'alta'): BotRun[] {
  const key = `${difficulty}/${bot}/${quality}`;
  let out = cache.get(key);
  if (!out) {
    out = SEEDS.map((seed) =>
      runBot(WAVES_ONLY, bot, seed, worldFor(seed), { difficulty, quality }),
    );
    cache.set(key, out);
  }
  return out;
}

const mean = (xs: readonly number[]): number =>
  xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const survived = (rs: readonly BotRun[]): number => rs.filter((r) => r.end === 'survived').length;
/**
 * Lo bien que acabó una partida: los s aguantados y, si amaneció, el agua
 * que quedaba por llenar. Más es más fácil.
 */
const score = (r: BotRun): number =>
  r.endS + (r.end === 'survived' ? SURVIVORS_CONFIG.player.waterCapacity - r.finalWater : 0);

/** Una partida entera con piloto puede tardar bajo carga: tope holgado por prueba. */
const SLOW = 240_000;

describe('survivors: equilibrio de la beta 2 con pilotos (T132)', () => {
  it('los pilotos son deterministas: misma semilla, misma partida', () => {
    const a = runBot(SURVIVORS_CONFIG, 'greedy', 9, archipelago(9), {}, 90);
    const b = runBot(SURVIVORS_CONFIG, 'greedy', 9, archipelago(9), {}, 90);
    expect(b).toEqual(a);
    expect(a.levelUpsS.length).toBeGreaterThan(0);
  });

  it(
    'un barco parado se inunda pronto en todas, antes cuanto más difícil',
    () => {
      const byDiff = Object.fromEntries(DIFFICULTY_IDS.map((d) => [d, runs(d, 'idle')])) as Record<
        DifficultyId,
        BotRun[]
      >;
      // Normal y Tormenta: siempre. Tranquila: siempre en el mapa de verdad
      // (semillas impares); con las armas de T133 un barco parado en Tranquila
      // puede aguantar entre las islas de un archipiélago denso.
      for (const d of DIFFICULTY_IDS) {
        for (const r of byDiff[d]) {
          if (d === 'tranquila' && r.seed % 2 === 0) continue;
          expect(r.end, `${d} semilla ${r.seed}`).toBe('flooded');
        }
      }
      // Normal: dentro de los dos primeros minutos (antes de T133, del primero)
      // en todas las semillas menos una como mucho, y ninguna llega al boss
      // (T134: los Focos apuntan solos, y en el archipiélago denso de la
      // semilla 6, que con T133 se inundaba justo a los 119 s, un barco
      // parado aguanta hasta sacar el Show de Láseres).
      const late = byDiff.normal.filter((r) => r.endS >= 120);
      expect(late.length, late.map((r) => `semilla ${r.seed}`).join(', ')).toBeLessThanOrEqual(1);
      for (const r of byDiff.normal) expect(r.endS, `semilla ${r.seed}`).toBeLessThan(330);
      // Tranquila: de media no pasa de la mitad de la partida sin moverse.
      expect(mean(byDiff.tranquila.map((r) => r.endS))).toBeLessThan(
        SURVIVORS_CONFIG.durationS / 2,
      );
      const t = byDiff.tranquila.map((r) => r.endS);
      const n = byDiff.normal.map((r) => r.endS);
      const s = byDiff.tormenta.map((r) => r.endS);
      // Mediana en Normal: la semilla que puede aguantar (arriba) no cuenta doble.
      expect(mean(t)).toBeGreaterThan(median(n) * 1.5);
      expect(mean(s)).toBeLessThan(mean(n));
    },
    SLOW,
  );

  it(
    'en Normal, el que esquiva llega a los últimos minutos',
    () => {
      const rs = runs('normal', 'dodge');
      for (const r of rs) expect(r.endS, `semilla ${r.seed}`).toBeGreaterThanOrEqual(240);
      expect(mean(rs.map((r) => r.endS))).toBeGreaterThanOrEqual(330);
      expect(survived(rs)).toBeGreaterThanOrEqual(SEEDS.length / 2);
      // Y quien además recoge notas y elige bien, más aún.
      const greedy = runs('normal', 'greedy');
      for (const r of greedy) expect(r.endS, `semilla ${r.seed}`).toBeGreaterThanOrEqual(270);
      expect(survived(greedy)).toBeGreaterThanOrEqual(survived(rs));
    },
    SLOW,
  );

  it(
    'Tranquila es claramente más fácil y Tormenta más difícil (esquivando y eligiendo bien)',
    () => {
      for (const bot of ['dodge', 'greedy'] as const) {
        const t = runs('tranquila', bot);
        const n = runs('normal', bot);
        const s = runs('tormenta', bot);
        expect(mean(t.map(score)), bot).toBeGreaterThan(mean(n.map(score)));
        expect(mean(n.map(score)), bot).toBeGreaterThan(mean(s.map(score)));
        expect(survived(t), bot).toBeGreaterThanOrEqual(survived(n));
        expect(survived(n), bot).toBeGreaterThanOrEqual(survived(s));
        expect(survived(t), bot).toBe(SEEDS.length);
        expect(survived(s), bot).toBeLessThan(SEEDS.length);
      }
    },
    SLOW,
  );

  it(
    'los niveles llegan a buen ritmo (Normal, eligiendo bien)',
    () => {
      for (const r of runs('normal', 'greedy')) {
        const label = `semilla ${r.seed}`;
        // El primer nivel, pronto.
        expect(r.levelUpsS[0], label).toBeLessThan(30);
        // Una subida cada medio minuto o menos de media mientras se juega.
        expect(r.endS / r.levelUpsS.length, label).toBeLessThan(35);
        // Ningún hueco de más de minuto y medio entre dos subidas.
        expect(Math.max(...levelGaps(r)), label).toBeLessThan(90);
        // A los 3:00 ya hay varias armas o vinilos que probar.
        expect(r.levelByMinute[2] ?? 0, label).toBeGreaterThanOrEqual(8);
      }
    },
    SLOW,
  );

  it(
    'en `baja` el guion tardío sigue enseñando los demás tipos (sin subir el tope)',
    () => {
      const caps = SURVIVORS_CONFIG.caps.baja;
      const piranhaMax = Math.floor(
        caps.enemies * (SURVIVORS_CONFIG.enemies.piranha!.capShare ?? 1),
      );
      expect(piranhaMax).toBeLessThan(caps.enemies);
      const act = SURVIVORS_CONFIG.acts[0]!;
      // Empezar tarde (atajo `&t=`): cada tipo que el guion echa a esa hora está en el mar.
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        for (const t of [240, 360]) {
          const game = createSurvivors(SURVIVORS_CONFIG, seed, arcillaWorld(), {
            quality: 'baja',
            startAtS: t,
          });
          const s = game.snapshot();
          expect(s.enemies.length).toBeLessThanOrEqual(caps.enemies);
          const want = act.tracks.filter((tr) => trackAt(tr, t)).map((tr) => tr.enemy);
          for (const type of want) {
            expect(
              s.enemiesByType[type]?.length ?? 0,
              `${type} a ${t}s, semilla ${seed}`,
            ).toBeGreaterThan(0);
          }
          expect(s.enemiesByType.piranha!.length).toBeLessThanOrEqual(piranhaMax);
        }
      }
      // Jugando entera en `baja`: en el último minuto sigue habiendo cangrejos y varios tipos.
      for (const r of runs('normal', 'greedy', 'baja')) {
        const last = r.enemiesByMinute.at(-1) ?? {};
        const types = (Object.keys(last) as EnemyId[]).filter((k) => (last[k] ?? 0) > 0);
        expect(last.crab ?? 0, `semilla ${r.seed}`).toBeGreaterThan(0);
        expect(types.length, `semilla ${r.seed}`).toBeGreaterThanOrEqual(4);
      }
    },
    SLOW,
  );
});

/**
 * Las notas de la beta 2 (plan 012 T133): jugando en Tranquila las armas no
 * limpiaban ninguna oleada y nunca se llegaba a una evolución. Partidas con
 * el piloto que esquiva y elige bien (`greedy`, que va a por una evolución).
 */
describe('survivors: armas más fuertes y evoluciones a mano (T133)', () => {
  /**
   * Parte de los enemigos aparecidos que el piloto `greedy` hundía con la
   * config v6 (las armas de la beta 2), medida con estos mismos pilotos,
   * semillas y mundos antes de subir el daño (ver la sección de T133 en
   * `ESTADO.md`). Es historia: no cambia con la config.
   */
  const V6_KILL_SHARE: Record<DifficultyId, number> = {
    tranquila: 0.94,
    normal: 0.916,
    tormenta: 0.798,
  };
  /** s activos: la evolución debe llegar antes de esto (las 5:00). */
  const EVOLVE_BY_S = 300;

  it(
    'en cada dificultad, quien esquiva y elige bien hunde claramente más que con la v6',
    () => {
      for (const d of DIFFICULTY_IDS) {
        const k = mean(runs(d, 'greedy').map(killShare));
        expect(k, d).toBeGreaterThan(V6_KILL_SHARE[d]);
        // «Claramente»: lo que se queda sin hundir baja al menos un 30 %.
        expect(1 - k, d).toBeLessThanOrEqual((1 - V6_KILL_SHARE[d]) * 0.7);
      }
    },
    SLOW,
  );

  it(
    'en Tranquila se limpia la pantalla al menos una vez en los 2 primeros minutos',
    () => {
      for (const r of runs('tranquila', 'greedy')) {
        const early = r.screenClearsS.filter((t) => t < 120);
        expect(early.length, `semilla ${r.seed}`).toBeGreaterThanOrEqual(1);
      }
    },
    SLOW,
  );

  it(
    'yendo a por un arma y su vinilo, la evolución llega antes de las 5:00',
    () => {
      // Normal: en la mayoría de semillas (y, si llega, antes de acabar).
      const normal = runs('normal', 'greedy');
      const early = normal.filter((r) => r.evolvedS !== null && r.evolvedS < EVOLVE_BY_S);
      expect(early.length).toBeGreaterThan(SEEDS.length / 2);
      expect(early.length).toBeGreaterThanOrEqual(SEEDS.length - 2);
      // Tranquila, igual o mejor; Tormenta, al menos en la mitad.
      const tranquila = runs('tranquila', 'greedy').filter(
        (r) => r.evolvedS !== null && r.evolvedS < EVOLVE_BY_S,
      );
      expect(tranquila.length).toBeGreaterThanOrEqual(early.length);
      const tormenta = runs('tormenta', 'greedy').filter(
        (r) => r.evolvedS !== null && r.evolvedS < EVOLVE_BY_S,
      );
      expect(tormenta.length).toBeGreaterThanOrEqual(SEEDS.length / 2);
    },
    SLOW,
  );

  it('las cartas de lo que ya llevas salen más (pesos de la oferta)', () => {
    const w = SURVIVORS_CONFIG.cardWeights;
    expect(w.owned).toBeGreaterThan(w.new);
    expect(w.pairedVinyl).toBeGreaterThan(w.new);
    // Con sólo el arma inicial, su carta de nivel sale mucho más que 3 de 16 a la par.
    const pool =
      Object.keys(SURVIVORS_CONFIG.weapons).length + Object.keys(SURVIVORS_CONFIG.passives).length;
    let seen = 0;
    const N = 400;
    for (let seed = 1; seed <= N; seed++) {
      const game = createSurvivors(SURVIVORS_CONFIG, seed, archipelago(seed));
      const s = game.snapshot();
      game.spawnNote(s.player.x, s.player.y, s.xp.toNext - s.xp.xp);
      game.step();
      const card = game.snapshot().card;
      expect(card).not.toBeNull();
      const start = SURVIVORS_CONFIG.startingWeapon;
      if (card?.options.some((o) => o.kind === 'weapon-level' && o.weaponId === start)) seen++;
    }
    expect(seen / N).toBeGreaterThan((SURVIVORS_CONFIG.cardChoices / pool) * 1.5);
  });
});
