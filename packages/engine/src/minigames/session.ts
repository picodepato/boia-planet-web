import { configHash, freshSeed } from './rng';
import type { BaseConfig, EndReason, MinigameDefinition, MinigameId, Outcome } from './types';

/**
 * Sesiones de minijuego (REQ-AVE-038). En la versión final las crea y
 * valida el servidor; en la de prueba (D-20) lo hace esta autoridad local,
 * con las mismas reglas: ID, juego, versión, semilla, configuración, inicio
 * y límites. Vive en memoria: recargar la página olvida las sesiones
 * abiertas, así que una partida recargada no cuenta.
 *
 * Una sesión se liquida una sola vez. Es válida si no se abandonó, ni se
 * ocultó la pestaña, ni cambió la configuración; si el resultado trae su
 * misma semilla; y si la duración es posible: ni más que el límite, ni más
 * que el tiempo real transcurrido, ni menos que el mínimo para esa marca con
 * esa semilla (`minPlausibleMs`).
 */

export interface MinigameSession {
  id: string;
  gameId: MinigameId;
  version: number;
  seed: number;
  configHash: string;
  /** ms de reloj (Date.now) al empezar. */
  startedAt: number;
  limits: { timeLimitMs: number; goal: number };
}

export interface MinigameResult {
  sessionId: string;
  gameId: MinigameId;
  version: number;
  seed: number;
  configHash: string;
  outcome: Outcome;
  reason: EndReason;
  score: number;
  /** ms de juego (sin pausas). */
  elapsedMs: number;
}

export type InvalidReason =
  | 'unknown_session'
  | 'replayed'
  | 'abandoned'
  | 'hidden'
  | 'config_changed'
  | 'mismatch'
  | 'implausible_duration'
  | 'implausible_score';

export type Validation = { valid: true } | { valid: false; reason: InvalidReason };

/** Márgenes de redondeo del paso fijo y del reloj. */
const STEP_SLACK_MS = 100;
const CLOCK_SLACK_MS = 1000;

interface Entry {
  session: MinigameSession;
  def: MinigameDefinition<BaseConfig>;
  config: BaseConfig;
  invalid: InvalidReason | null;
  settled: boolean;
}

export class LocalSessionAuthority {
  private readonly sessions = new Map<string, Entry>();
  private counter = 0;

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly seeds: () => number = freshSeed,
  ) {}

  open<C extends BaseConfig>(def: MinigameDefinition<C>, config: C): MinigameSession {
    const seed = this.seeds();
    const session: MinigameSession = {
      id: `mg-${def.id}-${this.now().toString(36)}-${(++this.counter).toString(36)}-${seed.toString(36)}`,
      gameId: def.id,
      version: config.version,
      seed,
      configHash: configHash(config),
      startedAt: this.now(),
      limits: { timeLimitMs: config.timeLimitS * 1000, goal: config.goal },
    };
    this.sessions.set(session.id, {
      session,
      def: def as unknown as MinigameDefinition<BaseConfig>,
      config: structuredClone(config),
      invalid: null,
      settled: false,
    });
    return session;
  }

  /** Abandonar, ocultar la pestaña o cambiar la configuración invalida la marca. */
  invalidate(sessionId: string, reason: 'abandoned' | 'hidden' | 'config_changed'): void {
    const e = this.sessions.get(sessionId);
    if (e && !e.settled && !e.invalid) e.invalid = reason;
  }

  isValid(sessionId: string): boolean {
    const e = this.sessions.get(sessionId);
    return !!e && !e.settled && !e.invalid;
  }

  /** Liquida una sesión: una sola vez, pase lo que pase. */
  settle(result: MinigameResult, currentConfig?: BaseConfig): Validation {
    const e = this.sessions.get(result.sessionId);
    if (!e) return { valid: false, reason: 'unknown_session' };
    if (e.settled) return { valid: false, reason: 'replayed' };
    e.settled = true;
    if (e.invalid) return { valid: false, reason: e.invalid };
    const s = e.session;
    if (currentConfig && configHash(currentConfig) !== s.configHash) {
      return { valid: false, reason: 'config_changed' };
    }
    if (
      result.gameId !== s.gameId ||
      result.version !== s.version ||
      result.seed !== s.seed ||
      result.configHash !== s.configHash
    ) {
      return { valid: false, reason: 'mismatch' };
    }
    const score = result.score;
    if (!Number.isInteger(score) || score < 0) return { valid: false, reason: 'implausible_score' };
    // Se gana con la marca del objetivo o más, acabe como acabe la partida.
    const won = score >= s.limits.goal;
    if ((result.outcome === 'won') !== won) return { valid: false, reason: 'implausible_score' };
    const ms = result.elapsedMs;
    if (!Number.isFinite(ms) || ms < 0) return { valid: false, reason: 'implausible_duration' };
    if (ms > s.limits.timeLimitMs + STEP_SLACK_MS) {
      return { valid: false, reason: 'implausible_duration' };
    }
    // No se juega más rápido que el reloj.
    if (ms > this.now() - s.startedAt + CLOCK_SLACK_MS) {
      return { valid: false, reason: 'implausible_duration' };
    }
    // Ni se llega a esa marca antes de lo posible con esa semilla.
    if (ms + STEP_SLACK_MS < e.def.minPlausibleMs(score, s.seed, e.config)) {
      return { valid: false, reason: 'implausible_duration' };
    }
    return { valid: true };
  }
}

/** Textos (muestra) de por qué una partida no cuenta. */
export const INVALID_TEXT: Record<InvalidReason, string> = {
  unknown_session: 'La partida no es de esta visita (¿se recargó la página?).',
  replayed: 'Esta partida ya se contó.',
  abandoned: 'La partida se abandonó.',
  hidden: 'La pestaña se ocultó durante la partida.',
  config_changed: 'Las reglas del juego cambiaron durante la partida.',
  mismatch: 'La partida no coincide con su sesión.',
  implausible_duration: 'La duración de la partida no es posible.',
  implausible_score: 'La marca no es posible.',
};
