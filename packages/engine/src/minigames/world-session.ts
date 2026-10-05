import { configHash } from './rng';
import { type MinigameRewardSink, type RewardOutcome, grantMinigameReward } from './rewards';
import type { LocalSessionAuthority, MinigameResult, MinigameSession, Validation } from './session';
import type { BaseConfig, MinigameEntry, Outcome, ResultReason } from './types';

/**
 * La sesión de una partida de un minijuego que se juega en el mar (el Cañón,
 * plan 010), sin DOM: se abre al empezar (con la semilla de la partida),
 * se liquida una sola vez al acabar y pide el premio (REQ-AVE-038). Es lo
 * que `MinigameController` hace para la capa 2D, sin la simulación: la del
 * mar la lleva `/mar` y aquí sólo llega cómo acabó.
 *
 * Un abandono (más de 5 min en pausa, o salir de la página a mitad) deja la
 * sesión invalidada: no da premio.
 *
 * Una partida de prueba (T121) —empezada con un atajo de desarrollo que
 * cambia el juego: saltar tiempo con `&t=`, una semilla elegida, una carta
 * regalada…— sólo da premio si el build lo permite (`devStartRewards`: en
 * `pnpm dev` y en las e2e, nunca en producción, ni con `?dev=1`). Si no, se
 * liquida igual pero el libro no se toca: ni premio, ni `win_minigame`, ni
 * logros (`test_start`). Por defecto no lo permite.
 */

export interface WorldGameEnd {
  outcome: Outcome;
  reason: ResultReason;
  score: number;
  /** ms de tiempo activo, contando lo saltado con `&t=`. */
  elapsedMs: number;
  /** El escalón del premio (la medalla del Cañón, T153), si lo hay. */
  tier?: string;
}

export interface WorldSettlement {
  result: MinigameResult;
  validation: Validation;
  reward: RewardOutcome;
}

export interface WorldSessionOptions<C extends BaseConfig> {
  def: MinigameEntry<C>;
  config?: C;
  authority: LocalSessionAuthority;
  sink?: MinigameRewardSink | null;
  /** La configuración vigente al liquidar (si cambió, la marca no vale). */
  currentConfig?: () => C;
  /** Semilla pedida (atajo `&seed=`); sin ella, la sesión elige una. */
  seed?: number;
  /** s de juego saltados al empezar (atajo `&t=`): ya la hace partida de prueba. */
  skippedS?: number;
  /**
   * Empezada con otro atajo de desarrollo que cambia la partida (semilla
   * elegida, carta de nivel regalada…): partida de prueba.
   */
  devStart?: boolean;
  /** ¿Una partida de prueba puede dar el premio en este build? Por defecto, no. */
  devStartRewards?: boolean;
}

export class WorldMinigameSession<C extends BaseConfig = BaseConfig> {
  readonly session: MinigameSession;
  readonly config: C;
  private settling: Promise<WorldSettlement> | null = null;
  private closed = false;

  constructor(private readonly o: WorldSessionOptions<C>) {
    this.config = o.config ?? o.def.defaults;
    this.session = o.authority.open(o.def, this.config, {
      ...(o.seed !== undefined ? { seed: o.seed } : {}),
      skippedMs: Math.max(0, (o.skippedS ?? 0) * 1000),
    });
  }

  get seed(): number {
    return this.session.seed;
  }

  /** ¿Es una partida de prueba (algo saltado o empezada con un atajo que la cambia)? */
  get testStart(): boolean {
    return this.session.skippedMs > 0 || this.o.devStart === true;
  }

  /** ¿Sigue contando para premio? */
  counts(): boolean {
    return !this.closed && this.o.authority.isValid(this.session.id);
  }

  /** Salir a mitad (o 5 min en pausa): la sesión queda abandonada. */
  abandon(): void {
    if (this.closed) return;
    this.o.authority.invalidate(this.session.id, 'abandoned');
  }

  /** Acaba la partida: liquida la sesión una vez y pide el premio. Repetir da lo mismo. */
  finish(end: WorldGameEnd): Promise<WorldSettlement> {
    if (this.settling) return this.settling;
    this.closed = true;
    // Abandonada, o terminada desde la pausa (T148): nunca paga.
    if (end.reason === 'abandoned' || end.reason === 'quit') {
      this.o.authority.invalidate(this.session.id, 'abandoned');
    }
    const s = this.session;
    const result: MinigameResult = {
      sessionId: s.id,
      gameId: this.o.def.id,
      version: this.config.version,
      seed: s.seed,
      configHash: configHash(this.config),
      outcome: end.outcome,
      reason: end.reason,
      score: end.score,
      elapsedMs: end.elapsedMs,
      ...(s.skippedMs ? { skippedMs: s.skippedMs } : {}),
      ...(end.tier ? { tier: end.tier } : {}),
    };
    this.settling = this.settle(result);
    return this.settling;
  }

  private async settle(result: MinigameResult): Promise<WorldSettlement> {
    const validation = this.o.authority.settle(result, this.o.currentConfig?.());
    // Partida de prueba sin permiso: el libro ni se entera (nada de `win_minigame`).
    const forfeit = this.testStart && this.o.devStartRewards !== true;
    const reward = await grantMinigameReward(
      forfeit ? null : this.o.sink,
      this.config.reward,
      result,
      validation,
    );
    if (forfeit && !reward.granted && reward.reason === 'no_sink') {
      return { result, validation, reward: { granted: false, reason: 'test_start' } };
    }
    return { result, validation, reward };
  }
}
