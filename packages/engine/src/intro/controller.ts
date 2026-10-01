import type { Viewport } from './math';
import { EASING_FNS } from './math';
import {
  actDuration,
  frameAt,
  landingSpin,
  spinRate,
  type IntroAct,
  type IntroFrame,
  type IntroMode,
  type PlanetIntroConfig,
} from './planet';

/**
 * Máquina de estados de la entrada 3D (T57; D-19, D-21). Sin DOM ni three.js:
 * recibe eventos (botón de entrar, saltar, pestaña oculta o visible, cambio
 * de ruta, Atrás, rotación) y decide qué fotograma pintar y cuándo se muestra
 * la landing. Garantías (REQ-ENT-008, 014, 019, 020):
 * - crea como mucho una escena en toda su vida, pase lo que pase;
 * - la landing se muestra una sola vez (`onLanded` se llama una vez);
 * - la pausa no avanza sin el botón (o el avance automático, si está activo);
 * - entrar, saltar, interrumpir y destruir son idempotentes;
 * - el plazo de carga empieza al arrancar (el montaje), no al cargar la
 *   página, y sólo corre con la pestaña a la vista (`suspend`/`resume`):
 *   una carga en segundo plano espera y reproduce la entrada al volver;
 * - la escena cuenta como lista cuando lo dice `createScene` (con su primer
 *   fotograma ya pintado), no cuando llega su código.
 *
 * Fases: `waiting` (acto 0: escena cargando) → `appearing` (acto 1) →
 * `paused` (acto 2) → `landing` (acto 3) → `landed`; `destroyed` al
 * desmontar. Con movimiento reducido no hay acto 1 (el planeta sale quieto)
 * y el acto 3 es un fundido. Un enlace directo o una visita posterior nacen
 * ya en `landed`: la escena, si llega, se pinta en el encuadre del hero.
 */

/**
 * Un fotograma nunca adelanta la secuencia más de esto: tras un tirón la
 * animación sigue donde iba en vez de saltar.
 */
export const MAX_FRAME_STEP_MS = 250;

export type IntroPhase =
  'idle' | 'waiting' | 'appearing' | 'paused' | 'landing' | 'landed' | 'destroyed';
export type SceneStatus = 'none' | 'loading' | 'ready' | 'failed' | 'disposed';
export type IntroOutcome = 'played' | 'skipped' | 'none';
export type EnterSource = 'button' | 'auto';

export interface IntroSceneHandle {
  render(frame: IntroFrame, clockSeconds: number): void;
  destroy(): void;
}

export interface IntroControllerDeps<S extends IntroSceneHandle> {
  mode: IntroMode;
  config: PlanetIntroConfig;
  /** El planeta no gira (movimiento reducido del sistema), también en la landing. */
  still?: boolean;
  /** Reloj en ms (performance.now en el navegador). */
  now(): number;
  /** Crea la escena y pinta su primer fotograma. Puede fallar: se queda la landing ligera. */
  createScene(): Promise<S>;
  setTimer(fn: () => void, ms: number): () => void;
  /** Se muestra la landing. Exactamente una vez. */
  onLanded(outcome: IntroOutcome): void;
  /** Cualquier cambio de fase o de escena (para depurar y para las pruebas). */
  onChange?(): void;
}

const ACT_OF: Partial<Record<IntroPhase, IntroAct>> = {
  appearing: 'appear',
  paused: 'pause',
  landing: 'landing',
};

export class IntroController<S extends IntroSceneHandle = IntroSceneHandle> {
  phase: IntroPhase = 'idle';
  sceneStatus: SceneStatus = 'none';
  outcome: IntroOutcome | null = null;
  scenesCreated = 0;
  scenesDestroyed = 0;
  /** Cómo se pidió el aterrizaje (botón o avance automático); `null` si no se pidió. */
  enteredBy: EnterSource | null = null;
  /** ms de reloj que duró la aparición (acto 1), si se vio entera. */
  appearedMs: number | null = null;
  /** ms de reloj que duró «Zarpar» (acto 3), si se vio entero. */
  playedMs: number | null = null;
  /** ms desde `start()` hasta tener la escena lista. */
  sceneReadyMs: number | null = null;
  /** ms de plazo que quedaban al llegar la escena (o 0 si se agotó). */
  budgetLeftMs: number | null = null;

  private scene: S | null = null;
  /** ms avanzados dentro del acto (con el tope por fotograma). */
  private actMs = 0;
  /** Giro acumulado, radianes. */
  private spin = 0;
  private lastNow: number | null = null;
  private actStartedAt: number | null = null;
  private startedAt = 0;
  // Plazo de carga: lo que queda y desde cuándo corre (null: parado).
  private budgetLeft = 0;
  private budgetSince: number | null = null;
  private cancelBudget: (() => void) | null = null;
  private suspended = false;
  private cancelAuto: (() => void) | null = null;

  constructor(private readonly deps: IntroControllerDeps<S>) {
    const { config } = deps;
    this.spin = this.still ? config.reduced.spinDeg * (Math.PI / 180) : 0;
  }

  get mode(): IntroMode {
    return this.deps.mode;
  }

  /** Sin giro: movimiento reducido (de la entrada o del sistema). */
  get still(): boolean {
    return this.deps.mode === 'reduced' || !!this.deps.still;
  }

  /** Escenas vivas (0 o 1). */
  get worldsAlive(): number {
    return this.scenesCreated - this.scenesDestroyed;
  }

  start(): void {
    if (this.phase !== 'idle') return;
    this.startedAt = this.deps.now();
    if (this.deps.mode === 'direct') {
      this.land('none');
    } else {
      this.phase = 'waiting';
      this.budgetLeft = this.deps.config.loadBudgetMs;
      if (!this.suspended) this.runBudget();
    }
    this.loadScene();
    this.changed();
  }

  /** Pestaña oculta: el plazo de carga se para (la carga sigue). */
  suspend(): void {
    if (this.suspended) return;
    this.suspended = true;
    this.stopBudget();
  }

  /** Pestaña visible otra vez: el plazo sigue donde estaba. */
  resume(): void {
    if (!this.suspended) return;
    this.suspended = false;
    if (this.phase === 'waiting') this.runBudget();
  }

  /**
   * Botón de entrar (o avance automático): empieza «Zarpar». Sólo desde la
   * pausa; devuelve si lo empezó. Pulsarlo otra vez no hace nada.
   */
  enter(source: EnterSource = 'button'): boolean {
    if (this.phase !== 'paused') return false;
    this.clearAuto();
    this.enteredBy = source;
    this.toAct('landing');
    // Cuenta desde la pulsación, no desde el fotograma anterior.
    this.lastNow = this.actStartedAt = this.deps.now();
    return true;
  }

  /** Hubo interacción en la pausa: el avance automático vuelve a contar desde cero. */
  touch(): void {
    if (this.phase === 'paused') this.scheduleAuto();
  }

  /** «Saltar animación»: lleva al mismo estado final. Idempotente. */
  skip(): void {
    if (
      this.phase === 'waiting' ||
      this.phase === 'appearing' ||
      this.phase === 'paused' ||
      this.phase === 'landing'
    ) {
      this.land('skipped');
    }
  }

  /**
   * Pestaña oculta, rotación o vuelta desde la caché del navegador: lo que se
   * estaba animando termina en su estado final y no se retoma a medias. La
   * aparición acaba en la pausa (con título y botón); «Zarpar», en la landing.
   * La carga y la pausa siguen esperando.
   */
  interrupt(): void {
    if (this.phase === 'appearing') {
      this.toAct('paused');
      // Título y botón ya visibles: al volver no hay nada a medias.
      this.actMs = this.deps.config.pause.uiInMs;
    } else if (this.phase === 'landing') this.land('played');
  }

  /**
   * Fotograma para ahora, o `null` si no hay escena que pintar. Terminar un
   * acto pasa al siguiente; terminar «Zarpar» muestra la landing.
   */
  frame(vp: Viewport): IntroFrame | null {
    if (this.sceneStatus !== 'ready' || this.phase === 'destroyed') return null;
    const { config, mode } = this.deps;
    const now = this.deps.now();
    // El acto empieza en su primer fotograma, no al llegar la escena.
    if (this.lastNow === null) this.lastNow = now;
    const dt = Math.min(Math.max(0, now - this.lastNow), MAX_FRAME_STEP_MS);
    this.lastNow = now;
    if (!this.still) this.spin += dt * spinRate(config);

    const act = ACT_OF[this.phase];
    if (!act) return frameAt(config, vp, { act: 'landed', t: 0, spin: this.spin }, 'direct');
    if (this.actStartedAt === null) this.actStartedAt = now;
    this.actMs += dt;

    const duration = actDuration(config, act, mode);
    if (act === 'appear' && this.actMs >= duration) {
      this.appearedMs = now - this.actStartedAt;
      const extra = this.actMs - duration;
      this.toAct('paused');
      this.actStartedAt = now;
      this.actMs = extra;
    }
    const f = frameAt(
      config,
      vp,
      { act: ACT_OF[this.phase]!, t: this.actMs, spin: this.spin },
      mode,
    );
    if (act === 'landing' && f.done) {
      // Duración real, de reloj.
      this.playedMs = now - this.actStartedAt;
      this.land('played');
    }
    return f;
  }

  /** Pinta el fotograma de ahora en la escena, si la hay. */
  render(vp: Viewport, clockSeconds: number): IntroFrame | null {
    const f = this.frame(vp);
    if (f && this.scene) this.scene.render(f, clockSeconds);
    return f;
  }

  /** Cambio de ruta o desmontaje. Idempotente. */
  destroy(): void {
    if (this.phase === 'destroyed') return;
    this.phase = 'destroyed';
    this.stopBudget();
    this.clearAuto();
    this.disposeScene();
    this.changed();
  }

  private runBudget(): void {
    this.stopBudget();
    this.budgetSince = this.deps.now();
    this.cancelBudget = this.deps.setTimer(
      () => {
        this.cancelBudget = null;
        this.budgetSince = null;
        this.budgetLeft = 0;
        // La escena no llegó a tiempo: landing ligera, sin alargar la espera.
        if (this.phase === 'waiting') this.land('none');
      },
      Math.max(0, this.budgetLeft),
    );
  }

  private stopBudget(): void {
    if (this.budgetSince !== null) {
      this.budgetLeft = Math.max(0, this.budgetLeft - (this.deps.now() - this.budgetSince));
      this.budgetSince = null;
    }
    this.cancelBudget?.();
    this.cancelBudget = null;
  }

  private toAct(phase: 'appearing' | 'paused' | 'landing'): void {
    this.phase = phase;
    this.actMs = 0;
    this.actStartedAt = null;
    if (phase === 'paused') this.scheduleAuto();
    this.changed();
  }

  private scheduleAuto(): void {
    this.clearAuto();
    const auto = this.deps.config.pause.autoAdvance;
    if (!auto.enabled) return;
    this.cancelAuto = this.deps.setTimer(() => {
      this.cancelAuto = null;
      this.enter('auto');
    }, auto.afterMs);
  }

  private clearAuto(): void {
    this.cancelAuto?.();
    this.cancelAuto = null;
  }

  private loadScene(): void {
    if (this.scenesCreated > 0) return;
    this.scenesCreated++;
    this.sceneStatus = 'loading';
    this.deps.createScene().then(
      (scene) => {
        if (this.phase === 'destroyed') {
          // Llegó tarde: se desmontó mientras cargaba.
          scene.destroy();
          this.scenesDestroyed++;
          this.sceneStatus = 'disposed';
          this.changed();
          return;
        }
        this.scene = scene;
        this.sceneStatus = 'ready';
        this.sceneReadyMs = this.deps.now() - this.startedAt;
        if (this.phase === 'waiting') {
          this.stopBudget();
          this.budgetLeftMs = this.budgetLeft;
          this.lastNow = null;
          this.toAct(this.deps.mode === 'intro' ? 'appearing' : 'paused');
          return;
        }
        this.changed();
      },
      () => {
        this.scenesDestroyed++;
        if (this.phase === 'destroyed') {
          this.sceneStatus = 'disposed';
          return;
        }
        // Motor o recursos fallan: no hay escena y se queda la landing ligera.
        this.sceneStatus = 'failed';
        if (this.phase === 'waiting') this.land('none');
        this.changed();
      },
    );
  }

  private disposeScene(): void {
    if (this.scene) {
      this.scene.destroy();
      this.scene = null;
      this.scenesDestroyed++;
      this.sceneStatus = 'disposed';
    }
  }

  private land(outcome: IntroOutcome): void {
    if (this.phase === 'landed' || this.phase === 'destroyed') return;
    // La vuelta extra de «Zarpar» se queda: el giro de la landing sigue desde ahí.
    if (this.phase === 'landing' && !this.still) {
      const { config } = this.deps;
      const e = Math.min(1, this.actMs / Math.max(1, config.landing.durationMs));
      this.spin += landingSpin(config) * EASING_FNS[config.landing.easing](e);
    }
    this.phase = 'landed';
    this.outcome = outcome;
    this.stopBudget();
    this.clearAuto();
    this.deps.onLanded(outcome);
    this.changed();
  }

  private changed(): void {
    this.deps.onChange?.();
  }
}
