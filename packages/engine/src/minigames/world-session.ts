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
 */

export interface WorldGameEnd {
  outcome: Outcome;
  reason: ResultReason;
  score: number;
  /** ms de tiempo activo, contando lo saltado con `&t=`. */
  elapsedMs: number;
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
  /** s de juego saltados al empezar (atajo `&t=`). */
  skippedS?: number;
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
    if (end.reason === 'abandoned') {
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
    };
    this.settling = this.settle(result);
    return this.settling;
  }

  private async settle(result: MinigameResult): Promise<WorldSettlement> {
    const validation = this.o.authority.settle(result, this.o.currentConfig?.());
    const reward = await grantMinigameReward(this.o.sink, this.config.reward, result, validation);
    return { result, validation, reward };
  }
}
