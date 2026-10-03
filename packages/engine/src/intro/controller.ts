import type { Viewport } from './math';
import {
  actDuration,
  frameAt,
  spinRate,
  type IntroAct,
  type IntroFrame,
  type IntroMode,
  type PlanetFocus,
  type PlanetIntroConfig,
} from './planet';

/**
 * State machine of the landing hero (T57; D-19, D-21; plan 007 T79). No DOM
 * and no three.js: it gets events («Zarpar», a scroll during the appearance,
 * tab hidden or visible, route change) and decides which frame to paint.
 * Guarantees (REQ-ENT-008, 014, 019, 020):
 * - at most one scene in its whole life, whatever happens;
 * - the rest is reached once (`onRest`), and «Zarpar» enters the game once
 *   (`onLanded`);
 * - nothing advances on its own: from the rest only «Zarpar» moves on, and
 *   the scroll position (passed to `frame`) drives the hero;
 * - «Zarpar», fast-forward, interrupt and destroy are idempotent;
 * - the load budget starts at `start()` (the mount), only runs with the tab
 *   in view (`suspend`/`resume`) and, when it runs out, the hero falls back
 *   to the static version (`fallback`) instead of waiting longer;
 * - the scene is ready when `createScene` says so (first frame painted).
 *
 * Phases: `waiting` (act 0: scene loading) → `appearing` (act 1) → `paused`
 * (the rest: the page scrolls from here) → `landing` («Zarpar»: the dive into
 * the port of `/mar`, T64) → `landed` (off to the game); `destroyed` when the
 * hero unmounts. A direct URL (`?intro=0`, `/#tickets`, a return from `/mar`)
 * is born at rest without the appearance. With reduced motion (`reduced`),
 * no WebGL, a scene that misses its budget or one that fails, the hero is the
 * static version: no scene, and «Zarpar» is a fade to the veil.
 */

/**
 * Un fotograma nunca adelanta la secuencia más de esto: tras un tirón la
 * animación sigue donde iba en vez de saltar.
 */
export const MAX_FRAME_STEP_MS = 250;

export type IntroPhase =
  'idle' | 'waiting' | 'appearing' | 'paused' | 'landing' | 'landed' | 'destroyed';
export type SceneStatus = 'none' | 'loading' | 'ready' | 'failed' | 'disposed';
/** How the rest was reached: after the whole appearance, fast-forwarded, or without one. */
export type IntroOutcome = 'played' | 'skipped' | 'none';
/** Which «Zarpar»: the hero pill (the dive) or the header pill (the veil only). */
export type EnterSource = 'button' | 'header';

export interface IntroSceneHandle {
  render(frame: IntroFrame, clockSeconds: number): void;
  destroy(): void;
  /** El puerto de salida de `/mar` en el planeta: «Zarpar» se zambulle en él (T64). */
  readonly focus?: PlanetFocus | null;
}

export interface IntroControllerDeps<S extends IntroSceneHandle> {
  mode: IntroMode;
  config: PlanetIntroConfig;
  /** The planet does not spin (reduced motion of the system). */
  still?: boolean;
  /** Reloj en ms (performance.now en el navegador). */
  now(): number;
  /** Crea la escena y pinta su primer fotograma. Puede fallar: versión estática. */
  createScene(): Promise<S>;
  setTimer(fn: () => void, ms: number): () => void;
  /** The hero is at rest for the first time (the page is shown). Exactly once. */
  onRest?(outcome: IntroOutcome): void;
  /** «Zarpar» finished with the veil on: enter the game. Exactly once. */
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
  /** How the rest was reached; `null` until then. */
  outcome: IntroOutcome | null = null;
  /** The static version: no scene (reduced motion, no WebGL, budget missed). */
  fallback = false;
  scenesCreated = 0;
  scenesDestroyed = 0;
  /** Which «Zarpar» was pressed; `null` if none. */
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
  /** «Zarpar» without a live scene: a fade to the veil (static version, header pill). */
  private fade = false;
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

  constructor(private readonly deps: IntroControllerDeps<S>) {
    this.spin = this.still ? deps.config.reduced.spinDeg * (Math.PI / 180) : 0;
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

  /** The scene is painting (not the static version). */
  get live(): boolean {
    return this.sceneStatus === 'ready' && !this.fallback;
  }

  /** «Zarpar» finished: the page goes to the game (T64). */
  get toGame(): boolean {
    return this.phase === 'landed';
  }

  start(): void {
    if (this.phase !== 'idle') return;
    this.startedAt = this.deps.now();
    if (this.deps.mode === 'reduced') {
      // Static from the first paint: no scene at all.
      this.fallback = true;
      this.rest('none');
      return;
    }
    if (this.deps.mode === 'intro') {
      this.phase = 'waiting';
    } else this.rest('none');
    this.budgetLeft = this.deps.config.loadBudgetMs;
    if (!this.suspended) this.runBudget();
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
    if (this.sceneStatus === 'loading' && !this.fallback) this.runBudget();
  }

  /**
   * «Zarpar». The hero pill dives into the port when the scene is live (from
   * the appearance it first jumps to the rest); without a scene, and from the
   * header pill, it is a fade to the veil. Returns whether it started; a
   * second press does nothing.
   */
  enter(source: EnterSource = 'button'): boolean {
    const from = this.phase;
    if (from !== 'waiting' && from !== 'appearing' && from !== 'paused') return false;
    this.enteredBy = source;
    this.fade = source === 'header' || !this.live;
    if (from === 'appearing') this.rest('skipped');
    this.toAct('landing');
    // Cuenta desde la pulsación, no desde el fotograma anterior.
    this.lastNow = this.actStartedAt = this.deps.now();
    return true;
  }

  /**
   * Fast-forward (a scroll, a key or a link during the appearance): the hero
   * jumps to the rest. While the scene loads, it will be born at rest. No-op
   * afterwards. Idempotent.
   */
  skip(): void {
    if (this.phase === 'waiting') this.rest('skipped');
    else if (this.phase === 'appearing') {
      this.rest('skipped');
      // Título y botón ya visibles: nada a medias.
      this.actMs = this.deps.config.pause.uiInMs;
    }
  }

  /**
   * Pestaña oculta, rotación o vuelta desde la caché del navegador: lo que se
   * estaba animando termina en su estado final. La aparición acaba en el
   * reposo; «Zarpar», en el juego (T64).
   */
  interrupt(): void {
    if (this.phase === 'appearing') {
      this.rest('played');
      this.actMs = this.deps.config.pause.uiInMs;
    } else if (this.phase === 'landing') this.finish();
  }

  /**
   * Frame for now at scroll `s` (viewport heights) with the sea `light`, or
   * `null` when there is nothing to paint. Finishing the appearance reaches
   * the rest; finishing «Zarpar» enters the game.
   */
  frame(vp: Viewport, s = 0, light = 0): IntroFrame | null {
    if (this.phase === 'destroyed') return null;
    const fading = this.phase === 'landing' && this.fade;
    if (!fading && !this.live) return null;
    const { config } = this.deps;
    const now = this.deps.now();
    // El acto empieza en su primer fotograma, no al llegar la escena.
    if (this.lastNow === null) this.lastNow = now;
    const dt = Math.min(Math.max(0, now - this.lastNow), MAX_FRAME_STEP_MS);
    this.lastNow = now;
    // The planet spins at rest; it holds still while diving (scroll or «Zarpar»).
    if (!this.still && this.phase !== 'landing' && s <= 0) this.spin += dt * spinRate(config);

    const act = ACT_OF[this.phase];
    if (!act) return null;
    if (this.actStartedAt === null) this.actStartedAt = now;
    this.actMs += dt;

    const mode: IntroMode = fading ? 'reduced' : 'intro';
    if (act === 'appear' && this.actMs >= actDuration(config, act, mode)) {
      this.appearedMs = now - this.actStartedAt;
      const extra = this.actMs - config.appear.durationMs;
      this.rest('played');
      this.actStartedAt = now;
      this.actMs = extra;
    }
    const f = frameAt(
      config,
      vp,
      {
        act: ACT_OF[this.phase]!,
        t: this.actMs,
        spin: this.spin,
        focus: this.scene?.focus ?? null,
        s,
        light,
      },
      mode,
    );
    if (act === 'landing' && f.done) {
      // Duración real, de reloj.
      this.playedMs = now - this.actStartedAt;
      this.finish();
    }
    return f;
  }

  /** Pinta el fotograma de ahora en la escena, si la hay. */
  render(vp: Viewport, clockSeconds: number, s = 0, light = 0): IntroFrame | null {
    const f = this.frame(vp, s, light);
    if (f && this.scene && this.live) this.scene.render(f, clockSeconds);
    return f;
  }

  /** Cambio de ruta o desmontaje. Idempotente. */
  destroy(): void {
    if (this.phase === 'destroyed') return;
    this.phase = 'destroyed';
    this.stopBudget();
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
        // The scene did not make it: the static version, without waiting longer.
        if (this.sceneStatus === 'loading') this.toFallback();
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

  /** No scene: the static version, at rest. */
  private toFallback(): void {
    if (this.fallback) return;
    this.fallback = true;
    this.stopBudget();
    if (this.phase === 'waiting' || this.phase === 'appearing') this.rest('none');
    this.changed();
  }

  /** The rest (once): the page is shown and scrolls from here. */
  private rest(outcome: IntroOutcome): void {
    if (this.outcome === null) this.outcome = outcome;
    if (this.phase === 'waiting' || this.phase === 'appearing' || this.phase === 'idle') {
      this.toAct('paused');
      this.deps.onRest?.(this.outcome);
    }
  }

  private toAct(phase: 'appearing' | 'paused' | 'landing'): void {
    this.phase = phase;
    this.actMs = 0;
    this.actStartedAt = null;
    this.changed();
  }

  private loadScene(): void {
    if (this.scenesCreated > 0) return;
    this.scenesCreated++;
    this.sceneStatus = 'loading';
    this.deps.createScene().then(
      (scene) => {
        if (this.phase === 'destroyed' || this.fallback) {
          // Llegó tarde: se desmontó o ya se ve la versión estática.
          scene.destroy();
          this.scenesDestroyed++;
          this.sceneStatus = 'disposed';
          this.changed();
          return;
        }
        this.scene = scene;
        this.sceneStatus = 'ready';
        this.sceneReadyMs = this.deps.now() - this.startedAt;
        this.stopBudget();
        this.budgetLeftMs = this.budgetLeft;
        this.lastNow = null;
        if (this.phase === 'waiting') {
          this.toAct('appearing');
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
        // Motor o recursos fallan: no hay escena, la versión estática.
        this.sceneStatus = 'failed';
        this.toFallback();
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

  private finish(): void {
    if (this.phase !== 'landing') return;
    this.phase = 'landed';
    this.stopBudget();
    this.deps.onLanded('played');
    this.changed();
  }

  private changed(): void {
    this.deps.onChange?.();
  }
}
