import { describe, expect, it, vi } from 'vitest';
import { DIFFICULTY_IDS, SURVIVORS_CONFIG, type SurvivorsConfig } from '../survivors/config';
import { actFinalBoss, actMinibosses, survivorsMedal } from '../survivors/medals';
import { createSurvivors } from '../survivors/sim';
import type { SurvivorsWorld } from '../survivors/world';
import { faro } from './faro';
import { mountMinigame } from './host';
import { MINIGAME_REGISTRY, layerMinigame, minigame } from './registry';
import type { MinigameRewardSink } from './rewards';
import { configHash } from './rng';
import { LocalSessionAuthority, type MinigameResult } from './session';
import { isLayerMinigame } from './types';
import {
  CANON_DEFAULTS,
  CANON_VERSION,
  type CanonConfig,
  canon,
  canonConfigFor,
  canonEarliestWinS,
  canonEnd,
  canonOutcome,
  canonScore,
} from './world-canon';
import { WorldMinigameSession } from './world-session';

/**
 * El Cañón en el mar (plan 010, T119): el registro lo guarda sólo para su
 * id, su sesión, su validación y su premio; la sesión valida el tiempo
 * activo de la partida (sin pausas) y el premio sigue siendo 150 puntos y
 * 50 monedas una vez por temporada.
 */

/** Reloj de la autoridad (ms), que la prueba avanza a mano. */
function clock(start = Date.UTC(2026, 9, 4, 18)) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

/**
 * Un libro como el local para el premio del minijuego: con política
 * `season`, una sola vez por origen y temporada (aquí, una temporada).
 */
function seasonLedger() {
  const paid = new Set<string>();
  const calls: Parameters<MinigameRewardSink['grantWorldReward']>[0][] = [];
  const sink: MinigameRewardSink = {
    grantWorldReward: vi.fn(async (input) => {
      calls.push(input);
      const key = `${input.sourceRef}@${input.policy}:temporada-1`;
      if (paid.has(key)) return { granted: false, reason: 'duplicate' };
      paid.add(key);
      return { granted: true };
    }),
  };
  return { sink, calls };
}

/** Un mar sin islas y sin guion: el barco llega al amanecer sin que nadie le moleste. */
const openSea: SurvivorsWorld = {
  bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
  obstacles: [],
  start: { x: 0, y: 0, heading: 0 },
};
const quiet: SurvivorsConfig = (() => {
  const c = structuredClone(SURVIVORS_CONFIG);
  c.acts = [{ act: 1, durationS: c.durationS, tracks: [], events: [] }];
  return c;
})();

/** Juega con la simulación de verdad hasta el final, moviendo el reloj al ritmo del juego. */
function playToEnd(
  cfg: SurvivorsConfig,
  seed: number,
  advance: (ms: number) => void,
  startAtS = 0,
) {
  const game = createSurvivors(cfg, seed, openSea, startAtS ? { startAtS } : {});
  const skippedS = game.activeS;
  let steps = 0;
  while (!game.ended && steps < 40_000) {
    game.step({ choose: 0 });
    advance(1000 / 60);
    steps++;
  }
  return { game, skippedS };
}

describe('el Cañón en el registro (plan 010, T119)', () => {
  it('sigue en el registro con su id, pero ya no se monta en la capa 2D; el Faro sí', () => {
    expect([...MINIGAME_REGISTRY.keys()]).toEqual(['faro', 'canon']);
    expect(minigame('canon')).toBe(canon);
    expect(isLayerMinigame(canon)).toBe(false);
    expect(layerMinigame('canon')).toBeNull();
    expect(layerMinigame('faro')).toBe(faro);
    expect(() => mountMinigame({} as HTMLElement, { gameId: 'canon', onExit: () => {} })).toThrow(
      /capa/,
    );
  });

  it('una versión nueva cuya huella cubre la configuración entera del modo', () => {
    expect(CANON_VERSION).toBeGreaterThan(3);
    expect(CANON_DEFAULTS.version).toBe(CANON_VERSION);
    // Ganar es aguantar los 7:00 enteros, y una partida no dura más.
    expect(CANON_DEFAULTS.goal).toBe(SURVIVORS_CONFIG.durationS);
    expect(CANON_DEFAULTS.timeLimitS).toBe(SURVIVORS_CONFIG.durationS);
    // El premio de siempre.
    expect(CANON_DEFAULTS.reward).toEqual({
      policy: 'season',
      points: 150,
      coins: 50,
      maxPoints: 150,
      maxCoins: 50,
    });
    // Cualquier cambio de equilibrio del modo cambia la huella de la sesión.
    expect(configHash(canonConfigFor(SURVIVORS_CONFIG))).toBe(configHash(CANON_DEFAULTS));
    const faster = structuredClone(SURVIVORS_CONFIG);
    faster.enemies.piranha!.speed += 1;
    expect(configHash(canonConfigFor(faster))).not.toBe(configHash(CANON_DEFAULTS));
    const camera = structuredClone(SURVIVORS_CONFIG);
    camera.camera.distanceScale += 0.1;
    expect(configHash(canonConfigFor(camera))).not.toBe(configHash(CANON_DEFAULTS));
  });

  it('la marca son los segundos enteros de tiempo activo; sólo el amanecer gana', () => {
    expect(canonScore(419.99)).toBe(419);
    expect(canonScore(420 - 1e-9)).toBe(420);
    expect(canonEnd('survived', 420)).toEqual({
      outcome: 'won',
      reason: 'survived',
      score: 420,
      elapsedMs: 420_000,
    });
    expect(canonEnd('flooded', 61.5)).toMatchObject({ outcome: 'lost', score: 61 });
    expect(canon.minPlausibleMs(300, 1, CANON_DEFAULTS)).toBe(300_000);
  });

  it('vencer al boss final (T140) gana con la marca del objetivo; no se puede ganar antes de que entre el boss', () => {
    const boss = SURVIVORS_CONFIG.acts[0]!.events.find((e) => e.type === 'boss')!;
    expect(boss.enabled).not.toBe(false);
    expect(canonEarliestWinS()).toBe(boss.atS);
    expect(canonEarliestWinS({ ...SURVIVORS_CONFIG, acts: [] })).toBe(SURVIVORS_CONFIG.durationS);
    expect(canonEnd('victory', 352.4)).toEqual({
      outcome: 'won',
      reason: 'victory',
      score: SURVIVORS_CONFIG.durationS,
      elapsedMs: 352_400,
    });
    // La cota de duración: la marca del amanecer se puede tener desde que entra el boss, no antes.
    expect(canon.minPlausibleMs(SURVIVORS_CONFIG.durationS, 1, CANON_DEFAULTS)).toBe(boss.atS * 1000);
    expect(canon.minPlausibleMs(200, 1, CANON_DEFAULTS)).toBe(200_000);
  });
});

describe('sesión y premio del Cañón en el mar (REQ-AVE-038, T119)', () => {
  it('una partida que llega al amanecer valida y da 150 puntos y 50 monedas una vez por temporada', async () => {
    const c = clock();
    const authority = new LocalSessionAuthority(c.now);
    const { sink, calls } = seasonLedger();
    const config = canonConfigFor(quiet);

    const first = new WorldMinigameSession({ def: canon, config, authority, sink, seed: 11 });
    const { game } = playToEnd(quiet, first.seed, c.advance);
    expect(game.snapshot().end).toBe('survived');
    const won = await first.finish(canonEnd('survived', game.activeS));
    expect(won.validation).toEqual({ valid: true });
    expect(won.reward).toEqual({ granted: true, points: 150, coins: 50 });
    expect(calls[0]).toMatchObject({
      sourceRef: 'minigame:canon',
      points: 150,
      coins: 50,
      policy: 'season',
      metadata: { version: CANON_VERSION, configHash: configHash(config), score: 420 },
    });

    // Otra partida ganada la misma temporada: vale, pero el premio ya se cobró.
    const second = new WorldMinigameSession({ def: canon, config, authority, sink });
    const again = playToEnd(quiet, second.seed, c.advance);
    const r = await second.finish(canonEnd('survived', again.game.activeS));
    expect(r.validation).toEqual({ valid: true });
    expect(r.reward).toEqual({ granted: false, reason: 'duplicate' });
    expect(sink.grantWorldReward).toHaveBeenCalledTimes(2);
  });

  it('las pausas no cuentan ni invalidan: se valida el tiempo activo, no el de reloj', async () => {
    const c = clock();
    const authority = new LocalSessionAuthority(c.now);
    const { sink } = seasonLedger();
    const s = new WorldMinigameSession({ def: canon, authority, sink });
    // 7:00 activos y casi 5 min de menú, cartas y pestaña oculta: 11:50 de reloj.
    c.advance(420_000 + 290_000);
    const r = await s.finish(canonEnd('survived', 420));
    expect(r.validation).toEqual({ valid: true });
    expect(r.reward.granted).toBe(true);
  });

  it('un tiempo activo imposible no vale', async () => {
    const c = clock();
    const authority = new LocalSessionAuthority(c.now);
    const { sink } = seasonLedger();
    const open = () => new WorldMinigameSession({ def: canon, authority, sink });

    // 7:00 de juego en 1 min de reloj.
    const fast = open();
    c.advance(60_000);
    expect((await fast.finish(canonEnd('survived', 420))).validation).toEqual({
      valid: false,
      reason: 'implausible_duration',
    });

    // Más de lo que dura una partida.
    const long = open();
    c.advance(900_000);
    expect(
      (await long.finish({ ...canonEnd('survived', 420), elapsedMs: 600_000 })).validation,
    ).toEqual({ valid: false, reason: 'implausible_duration' });

    // Una marca mayor que el tiempo jugado.
    const forged = open();
    c.advance(500_000);
    expect(
      (await forged.finish({ ...canonEnd('survived', 420), elapsedMs: 200_000 })).validation,
    ).toEqual({ valid: false, reason: 'implausible_duration' });

    // «Ganada» sin llegar al amanecer.
    const early = open();
    c.advance(500_000);
    expect(
      (await early.finish({ ...canonEnd('flooded', 300), outcome: 'won' })).validation,
    ).toEqual({ valid: false, reason: 'implausible_score' });
    expect(sink.grantWorldReward).not.toHaveBeenCalled();

    // Vencer al boss final (T140) a los 5:52 vale la noche entera y da el premio;
    // «vencerlo» antes de que entre el boss, no.
    const gold = open();
    c.advance(360_000);
    const g = await gold.finish(canonEnd('victory', 352));
    expect(g.validation).toEqual({ valid: true });
    expect(g.reward.granted).toBe(true);
    const tooEarly = open();
    c.advance(200_000);
    expect((await tooEarly.finish(canonEnd('victory', 200))).validation).toEqual({
      valid: false,
      reason: 'implausible_duration',
    });
  });

  it('inundarse no da premio; abandonar (5 min en pausa o salir) invalida la sesión', async () => {
    const c = clock();
    const authority = new LocalSessionAuthority(c.now);
    const { sink } = seasonLedger();

    const lost = new WorldMinigameSession({ def: canon, authority, sink });
    c.advance(90_000);
    const l = await lost.finish(canonEnd('flooded', 80.4));
    expect(l.validation).toEqual({ valid: true });
    expect(l.result).toMatchObject({ outcome: 'lost', reason: 'flooded', score: 80 });
    expect(l.reward).toEqual({ granted: false, reason: 'not_won' });

    const paused = new WorldMinigameSession({ def: canon, authority, sink });
    c.advance(400_000);
    const p = await paused.finish(canonEnd('abandoned', 60));
    expect(p.validation).toEqual({ valid: false, reason: 'abandoned' });
    expect(p.reward).toEqual({ granted: false, reason: 'abandoned' });

    const left = new WorldMinigameSession({ def: canon, authority, sink });
    expect(left.counts()).toBe(true);
    left.abandon();
    expect(left.counts()).toBe(false);
    c.advance(500_000);
    expect((await left.finish(canonEnd('survived', 420))).validation).toEqual({
      valid: false,
      reason: 'abandoned',
    });
    expect(sink.grantWorldReward).not.toHaveBeenCalled();
  });

  it('se liquida una sola vez; otra configuración u otra semilla no valen', async () => {
    const c = clock();
    const authority = new LocalSessionAuthority(c.now);
    const { sink } = seasonLedger();
    const s = new WorldMinigameSession({ def: canon, authority, sink, seed: 5 });
    expect(s.seed).toBe(5);
    c.advance(430_000);
    const end = canonEnd('survived', 420);
    const first = s.finish(end);
    expect(s.finish(end)).toBe(first);
    expect((await first).validation).toEqual({ valid: true });
    const replay: MinigameResult = { ...(await first).result };
    expect(authority.settle(replay)).toEqual({ valid: false, reason: 'replayed' });

    // Las reglas cambiaron durante la partida.
    let live: CanonConfig = CANON_DEFAULTS;
    const changed = new WorldMinigameSession({
      def: canon,
      authority,
      sink,
      currentConfig: () => live,
    });
    live = canonConfigFor(quiet);
    c.advance(430_000);
    expect((await changed.finish(end)).validation).toEqual({
      valid: false,
      reason: 'config_changed',
    });

    // Un resultado con otra semilla.
    const other = new WorldMinigameSession({ def: canon, authority, sink, seed: 8 });
    c.advance(430_000);
    expect(
      authority.settle({ ...replay, sessionId: other.session.id, seed: 9, skippedMs: 0 }),
    ).toEqual({ valid: false, reason: 'mismatch' });
  });

  it('el atajo `&t=` (donde da premio: dev y e2e): lo saltado cuenta para la marca pero no frente al reloj, y queda en el libro', async () => {
    const c = clock();
    const authority = new LocalSessionAuthority(c.now);
    const { sink, calls } = seasonLedger();
    const config = canonConfigFor(quiet);
    const seed = 21;
    const game = createSurvivors(quiet, seed, openSea, { startAtS: 415 });
    const s = new WorldMinigameSession({
      def: canon,
      config,
      authority,
      sink,
      seed,
      skippedS: game.activeS,
      devStartRewards: true,
    });
    while (!game.ended) {
      game.step({ choose: 0 });
      c.advance(1000 / 60);
    }
    expect(game.snapshot().end).toBe('survived');
    const r = await s.finish(canonEnd('survived', game.activeS));
    expect(r.validation).toEqual({ valid: true });
    expect(r.reward.granted).toBe(true);
    expect(calls[0]?.metadata).toMatchObject({ skippedMs: 415_000 });

    expect(s.testStart).toBe(true);

    // Sin decirlo a la sesión, 7:00 en 5 s de reloj no son posibles.
    const hidden = new WorldMinigameSession({ def: canon, config, authority, sink, seed });
    c.advance(5_000);
    expect((await hidden.finish(canonEnd('survived', 420))).validation).toEqual({
      valid: false,
      reason: 'implausible_duration',
    });
  });
  it('una partida de prueba sin permiso (producción) se liquida pero no toca el libro (T121)', async () => {
    const c = clock();
    const authority = new LocalSessionAuthority(c.now);
    const { sink } = seasonLedger();
    const config = canonConfigFor(quiet);
    const won = async (o: { skippedS?: number; devStart?: boolean }) => {
      const game = createSurvivors(quiet, 31, openSea, o.skippedS ? { startAtS: o.skippedS } : {});
      const s = new WorldMinigameSession({
        def: canon,
        config,
        authority,
        sink,
        seed: 31,
        skippedS: game.activeS,
        ...(o.devStart ? { devStart: true } : {}),
      });
      while (!game.ended) {
        game.step({ choose: 0 });
        c.advance(1000 / 60);
      }
      expect(s.testStart).toBe(true);
      return s.finish(canonEnd(game.snapshot().end!, game.activeS));
    };
    // Por defecto no se permite: `&t=` o una semilla elegida no cobran.
    for (const o of [{ skippedS: 415 }, { devStart: true }]) {
      const r = await won(o);
      expect(r.validation).toEqual({ valid: true });
      expect(r.reward).toEqual({ granted: false, reason: 'test_start' });
    }
    expect(sink.grantWorldReward).not.toHaveBeenCalled();

    // Una partida de prueba perdida dice que se perdió, no que era de prueba.
    const lost = new WorldMinigameSession({ def: canon, config, authority, sink, skippedS: 200 });
    c.advance(10_000);
    expect((await lost.finish(canonEnd('flooded', 210))).reward).toEqual({
      granted: false,
      reason: 'not_won',
    });

    // Una partida normal sigue cobrando.
    const normal = new WorldMinigameSession({ def: canon, config, authority, sink });
    expect(normal.testStart).toBe(false);
    const { game } = playToEnd(quiet, normal.seed, c.advance);
    expect((await normal.finish(canonEnd('survived', game.activeS))).reward.granted).toBe(true);
    expect(sink.grantWorldReward).toHaveBeenCalledTimes(1);
  });
});

describe('canon T144: acto y dificultad en la sesión; `won` es bronce o más', () => {
  it('el acto y la dificultad van en la configuración de la sesión y cambian su `configHash`', () => {
    expect(CANON_DEFAULTS.survivors.act).toBe(1);
    const acts = SURVIVORS_CONFIG.acts.map((a) => a.act);
    const hashes = new Set<string>();
    for (const act of acts) {
      for (const d of DIFFICULTY_IDS) {
        const cfg = canonConfigFor(SURVIVORS_CONFIG, d, act);
        expect(cfg.survivors).toMatchObject({ act, difficulty: d });
        hashes.add(configHash(cfg));
      }
    }
    // Cada combinación, su huella.
    expect(hashes.size).toBe(acts.length * DIFFICULTY_IDS.length);
    // Sin acto, el 1; el premio y el objetivo no cambian con ellos.
    expect(configHash(canonConfigFor(SURVIVORS_CONFIG, 'normal'))).toBe(
      configHash(canonConfigFor(SURVIVORS_CONFIG, 'normal', 1)),
    );
    for (const act of acts) {
      expect(canonConfigFor(SURVIVORS_CONFIG, 'tormenta', act).reward).toEqual(CANON_DEFAULTS.reward);
      expect(canonConfigFor(SURVIVORS_CONFIG, 'tormenta', act).goal).toBe(CANON_DEFAULTS.goal);
    }
  });

  it('la sesión gana exactamente cuando hay medalla (bronce, plata u oro)', () => {
    for (const act of SURVIVORS_CONFIG.acts.map((a) => a.act)) {
      const all = [...actMinibosses(act), actFinalBoss(act)!];
      for (const reason of ['survived', 'flooded', 'abandoned', 'victory'] as const) {
        for (const beaten of [[], actMinibosses(act), all]) {
          const medal = survivorsMedal({ end: reason, bossesDefeated: beaten, act });
          expect(canonOutcome(reason)).toBe(medal ? 'won' : 'lost');
        }
      }
    }
  });
});
