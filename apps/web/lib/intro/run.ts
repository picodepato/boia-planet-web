import {
  IntroController,
  mountMode,
  scrollState,
  titlePoses,
  viewMoved,
  type BootEntry,
  type EnterSource,
  type IntroFrame,
  type IntroOutcome,
} from '@boia/engine/intro';
import { track } from '../analytics';
import type { IntroScene } from '../planeta/intro-scene';
import { QUALITY } from '../planeta/quality';
import type { IntroDiagnostics } from './bridge';
import type { IntroData } from './load';
import { lowPower } from './low-power';
import { clearTitle, drawTitle, fitTitle, sizeTitleCanvas } from './title-canvas';

/** Radios de «Zarpar» guardados en el diagnóstico (tope). */
const MAX_SAMPLES = 600;
/** Píxeles de dispositivo por px CSS, como mucho (como /mar al arrancar). */
const MAX_DPR = 1.5;
/** Time-based motion at rest (the planet's spin, the water): at most 30 fps. */
const IDLE_FRAME_MS = 1000 / 30;
/**
 * …and at most a quarter of the time (T57): the wait is 4× what a frame
 * costs the main thread; at rest the scene itself paints at most once per
 * 4× what a full-quality frame costs the GPU (the probe, T80).
 */
const IDLE_COST_FACTOR = 4;
/** Frames in motion whose intervals decide a step down in quality (T80). */
const MOTION_SAMPLES = 12;
/** A median interval over this (ms) in motion: one quality level down. */
const MOTION_SLOW_MS = 30;
/** Lowest motion quality level. */
const LOWEST_QUALITY = QUALITY.length - 1;
/** The props of the sea come once the page is calm after the rest (or on a scroll). */
const PROPS_IDLE_MS = 2000;
/** Visita directa: cuánto espera, como mucho, a que la página esté tranquila. */
const DIRECT_IDLE_MS = 1500;
/** Smoothing of the scroll position (time constant, ms): no jank from coarse wheels. */
const SMOOTH_MS = 90;
/** The hero UI stops taking taps from here (viewport heights of scroll). */
const UI_TAPS_UNTIL = 0.08;
/** The header comes in from here. */
const HEADER_FROM = 0.95;

/** Cuando el navegador esté libre (o pasados `maxMs`). */
function whenIdle(maxMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => resolve(), { timeout: maxMs });
    } else window.setTimeout(resolve, Math.min(maxMs, 300));
  });
}

type Ref<T> = { readonly current: T | null };

/** What the hero paints into (refs or DOM lookups: read when used). */
export interface IntroView {
  /** The fixed layer under the page: the CSS sky and planet, the still, the canvas. */
  host: Ref<HTMLDivElement>;
  /** The hero section (`data-scroll-phase`). */
  hero: Ref<HTMLElement>;
  /** The sticky UI (title, pills, hint, corner labels): fades out with the scroll. */
  ui: Ref<HTMLElement>;
  /** «BOIA» (flat text, with the 3D letters canvas inside). */
  title: Ref<HTMLElement>;
  title3d: Ref<HTMLCanvasElement>;
  /** «Zarpar» of the hero: focused at the rest. */
  enter: Ref<HTMLElement>;
  /** Velo con el color del mar de /mar: cubre la vista al final de «Zarpar» (T64). */
  cover: Ref<HTMLDivElement>;
  /** The rest: a good moment to prefetch /mar. */
  onPaused?(): void;
  /** «Zarpar» terminó con el velo puesto: a /mar, sin pasar por la landing (T64). */
  onEnterGame(): void;
}

/**
 * The landing hero of one load of `/` (T57; plan 007 T79): the controller,
 * the three.js scene, the paint loop, the scroll and the page listeners. It
 * lives as long as the load of `/`, not the hero block: a remount picks it up
 * where it was. The scene state is a function of the scroll position (plus
 * the planet's spin and the water's time), so a direct URL, a reload or a
 * return opens at the right frame.
 */
class IntroRun {
  readonly controller: IntroController<IntroScene>;
  readonly diag: IntroDiagnostics;
  disposed = false;
  private view: IntroView | null = null;
  private hostEl: HTMLDivElement | null = null;
  private scene: IntroScene | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private raf = 0;
  private idleTimer = 0;
  /** ms que costó pintar el último fotograma. */
  private renderCost = 0;
  /** When the last full-quality frame at rest was painted (T80). */
  private lastFullAt = 0;
  private visible = true;
  private lastFrame: IntroFrame | null = null;
  private lastSize = '';
  private lastFrameAt = 0;
  private focused = false;
  private sailed = false;
  /** «Zarpar» terminó y la página se va a /mar: el velo se queda y no se pinta más. */
  private leaving = false;
  private disposeTimer = 0;
  private readonly entry: BootEntry | undefined;
  private readonly t0: number;
  private readonly mountedAt: number;
  private readonly still: boolean;
  private readonly io: IntersectionObserver | null;
  private readonly html = document.documentElement;
  // Scroll (plan 007): target from the page, smoothed `s`, light of the sea.
  private sTarget = 0;
  private s = 0;
  private light = 0;
  private tick = 0;
  // Título 3D (T27): la hoja se pide cuando el planeta ya está listo.
  private titleImg: HTMLImageElement | null = null;
  private titleFrom = 0;
  private pauseMs = 0;
  private lastWidth = window.innerWidth;
  // Quality of the frames in motion (T80): the probe's level, lowered when
  // the frames in motion come too slow.
  private motionLevel = 0;
  private motionDts: number[] = [];
  private propsAsked = false;

  constructor(private readonly data: IntroData) {
    const entry = window.__boiaEntry;
    this.entry = entry;
    // The appearance only plays on the full load whose boot script asked for
    // it and nobody resolved yet; going back to `/` inside the app does not
    // replay it (D-21). Reduced motion and low power: the static version.
    let mode = mountMode(entry);
    if (entry) {
      entry.claimed = true;
      clearTimeout(entry.timer);
      entry.timer = 0;
    }
    this.still = prefersReducedMotion();
    if (this.still || lowPower()) mode = 'reduced';
    this.t0 = entry?.t0 ?? performance.now();
    this.mountedAt = performance.now();

    this.diag = {
      mode,
      phase: 'idle',
      sceneStatus: 'none',
      outcome: null,
      fallback: false,
      scenesCreated: 0,
      worldsAlive: 0,
      framesRendered: 0,
      cameraMoves: 0,
      landingRadius: [],
      enteredBy: null,
      appearedMs: null,
      playedMs: null,
      renderer: null,
      sceneReadyMs: null,
      budgetLeftMs: null,
      restAtMs: null,
      longestFrameMs: 0,
      slowFrames: 0,
      history: [],
      mounts: 0,
      title: { mode: 'flat', requestedMs: null, loadedMs: null, draws: 0, pose: null },
      world: null,
      islands: null,
      islandIds: null,
      exit: null,
      cover: 0,
      pose: null,
      scroll: { s: 0, phase: 'rest', light: 0 },
      props: 0,
      quality: { probeMs: null, motion: null, lowFps: false, stepDowns: 0 },
    };
    window.__boiaIntro = this.diag;

    this.controller = new IntroController<IntroScene>({
      mode,
      config: data.config,
      still: this.still,
      now: () => performance.now(),
      createScene: () => this.createScene(),
      setTimer(fn, ms) {
        const id = window.setTimeout(fn, ms);
        return () => window.clearTimeout(id);
      },
      onRest: (o) => this.rested(o),
      onLanded: () => this.landed(),
      onChange: () => this.sync(),
    });

    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onOrientation);
    window.addEventListener('popstate', this.onNavigate);
    window.addEventListener('hashchange', this.onNavigate);
    window.addEventListener('pageshow', this.onPageShow);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    document.addEventListener('keydown', this.onKey);
    this.io =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(([e]) => {
            this.visible = !!e?.isIntersecting;
            if (this.visible) this.kick();
          })
        : null;

    // Abierta en segundo plano: el plazo de carga no corre hasta que se mire.
    if (document.hidden) this.controller.suspend();
    this.readScroll();
    this.s = this.sTarget;
    this.controller.start();
    // A reload or a scroll restored mid-page: no appearance over the page.
    if (this.sTarget > 0) this.controller.skip();
  }

  /** Un montaje de la escena del hero toma la entrada (el primero o uno nuevo). */
  attach(view: IntroView): void {
    window.clearTimeout(this.disposeTimer);
    this.disposeTimer = 0;
    this.view = view;
    this.diag.mounts++;
    const host = view.host.current;
    this.hostEl = host;
    if (host) {
      if (this.canvas) host.appendChild(this.canvas);
      this.io?.observe(host);
    }
    this.lastFrame = null;
    this.lastSize = '';
    this.focused = false;
    this.sync();
  }

  /** El montaje se va. Si nadie la recoge enseguida, la entrada se termina. */
  detach(view: IntroView): void {
    if (this.view !== view) return;
    if (this.hostEl) this.io?.unobserve(this.hostEl);
    this.hostEl = null;
    this.view = null;
    window.clearTimeout(this.disposeTimer);
    this.disposeTimer = window.setTimeout(() => {
      if (!this.view) this.dispose();
    }, 0);
  }

  /** «Zarpar»: whether the hero took it (also when it is already sailing). */
  enter(source: EnterSource): boolean {
    const c = this.controller;
    const ok = c.enter(source) || c.phase === 'landing' || c.phase === 'landed';
    this.kick();
    return ok;
  }

  private async createScene(): Promise<IntroScene> {
    // Sin entrada que reproducir, el planeta del hero espera a que la página
    // esté tranquila: primero el contenido de la landing.
    if (this.controller.mode === 'direct') await whenIdle(DIRECT_IDLE_MS);
    // three.js after the page's own load (T80: the runtime now arrives in its
    // own chunk, possibly before `load`; the scene must not hold that event).
    if (document.readyState !== 'complete')
      await new Promise<void>((r) => window.addEventListener('load', () => r(), { once: true }));
    if (this.disposed) throw new Error('la entrada ya se fue');
    const { createIntroScene } = await import('../planeta/intro-scene');
    const canvas = document.createElement('canvas');
    canvas.className = 'hero__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');
    this.canvas = canvas;
    this.hostEl?.appendChild(canvas);
    const vp = this.viewport();
    try {
      const scene = await createIntroScene({
        canvas,
        config: this.data.config,
        width: vp.width,
        height: vp.height,
        resolution: Math.min(window.devicePixelRatio || 1, MAX_DPR),
        search: window.location.search,
        onProps: (n) => {
          this.diag.props = n;
          this.kick();
        },
      });
      this.scene = scene;
      this.motionLevel = scene.probe.motion;
      this.diag.quality.probeMs = roundCosts(scene.probe.costs);
      this.diag.quality.motion = scene.probe.motion;
      this.lastSize = `${vp.width}x${vp.height}`;
      this.diag.renderer = scene.renderer;
      this.diag.world = scene.worldId;
      this.diag.islands = scene.islands;
      this.diag.islandIds = [...scene.islandIds];
      return scene;
    } catch (err) {
      // The first-frames probe: under 30 fps even at the lowest quality (low power).
      const probe = (err as { name?: string; probe?: { costs: (number | null)[] } })?.probe;
      if ((err as { name?: string })?.name === 'LowPowerError' && probe) {
        this.diag.quality.lowFps = true;
        this.diag.quality.probeMs = roundCosts(probe.costs);
      }
      console.warn('[boia] la escena del hero no arrancó; se queda la versión estática', err);
      canvas.remove();
      this.canvas = null;
      throw err;
    }
  }

  /** The canvas covers the whole viewport (fixed, sized from CSS). */
  private viewport() {
    const host = this.hostEl;
    return {
      width: Math.max(1, host?.clientWidth || window.innerWidth),
      height: Math.max(1, host?.clientHeight || window.innerHeight),
    };
  }

  private sync(): void {
    const c = this.controller;
    const d = this.diag;
    if (d.phase !== c.phase) d.history.push(c.phase);
    d.phase = c.phase;
    d.sceneStatus = c.sceneStatus;
    d.outcome = c.outcome;
    d.fallback = c.fallback;
    d.scenesCreated = c.scenesCreated;
    d.worldsAlive = c.worldsAlive;
    d.enteredBy = c.enteredBy;
    d.appearedMs = c.appearedMs;
    d.playedMs = c.playedMs;
    d.sceneReadyMs = c.sceneReadyMs;
    d.budgetLeftMs = c.budgetLeftMs;
    const host = this.hostEl;
    if (host) host.dataset.phase = c.phase;
    // Acto en curso, para el CSS del hero (carga, título, pista).
    if (c.phase === 'destroyed' || c.phase === 'landed') delete this.html.dataset.introAct;
    else this.html.dataset.introAct = c.phase;
    // The static version (T78's still) or the live scene.
    if (c.fallback) {
      this.html.dataset.hero = 'still';
      if (this.canvas) {
        this.canvas.remove();
        this.canvas = null;
      }
    } else if (c.live) this.html.dataset.hero = 'scene';
    // El canvas sale en cuanto la escena tiene su primer fotograma.
    if (c.live) {
      if (host) host.dataset.ready = '';
      this.requestTitle();
      if (c.phase === 'paused') this.askProps(false);
    } else if (host) delete host.dataset.ready;
    // The rest after the appearance: «Zarpar» gets the focus (Enter sails).
    if (c.phase === 'paused' && c.mode === 'intro' && c.outcome === 'played' && !this.focused) {
      const enter = this.view?.enter.current;
      if (enter && this.s < UI_TAPS_UNTIL) {
        this.focused = true;
        enter.focus({ preventScroll: true });
      }
    }
    // «Zarpar» empieza a explorar el mundo (T64).
    if (c.phase === 'landing' && !this.sailed) {
      this.sailed = true;
      track('explore_start', { source: c.enteredBy === 'header' ? 'hero' : 'intro' });
    }
    this.kick();
  }

  /** The rest, once: the page shows (D-21) and /mar can be prefetched. */
  private rested(outcome: IntroOutcome): void {
    this.diag.restAtMs = performance.now() - this.t0;
    if (this.entry) this.entry.reveal(outcome);
    else this.html.removeAttribute('data-intro');
    this.view?.onPaused?.();
  }

  private landed(): void {
    // «Zarpar» (T64): el velo del mar se queda puesto y se entra en /mar.
    this.diag.exit = 'game';
    this.leaving = true;
    this.diag.cover = 1;
    const cover = this.view?.cover.current;
    if (cover) cover.style.opacity = '1';
    this.view?.onEnterGame();
  }

  private requestTitle(): void {
    const sheet = this.data.title;
    const d = this.diag.title;
    if (!sheet || d.requestedMs !== null) return;
    d.requestedMs = performance.now() - this.t0;
    const img = new Image();
    img.decoding = 'async';
    img.src = sheet.url;
    img
      .decode()
      .then(() => {
        const c = this.controller;
        // Si ya se está zarpando (o se fue), se queda el título plano.
        if (c.phase !== 'waiting' && c.phase !== 'appearing' && c.phase !== 'paused') return;
        this.titleImg = img;
        // Born at rest (direct URL, fast-forward): the letters are already in place.
        const settled = c.mode !== 'intro' || c.outcome === 'skipped';
        this.titleFrom = settled ? this.pauseMs - 1e6 : c.phase === 'paused' ? this.pauseMs : 0;
        d.mode = '3d';
        d.loadedMs = performance.now() - this.t0;
        const title = this.view?.title.current;
        if (title) title.dataset.title = '3d';
        this.kick();
      })
      .catch(() => {
        console.warn('[boia] no cargó la hoja del título; se queda el título plano');
      });
  }

  private paintTitle(f: IntroFrame): void {
    const sheet = this.data.title;
    const canvas = this.view?.title3d.current;
    const ctx = canvas?.getContext('2d');
    if (!sheet || !this.titleImg || !canvas || !ctx) return;
    if (f.act === 'pause') this.pauseMs = f.t;
    // Off screen (scrolled away) or before the rest: nothing to draw.
    if ((f.act !== 'pause' && f.act !== 'landing') || f.title <= 0) {
      if (this.diag.title.pose !== null) clearTitle(ctx);
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const layout = fitTitle(sheet, window.innerWidth, window.innerHeight);
    sizeTitleCanvas(canvas, layout, dpr);
    const exiting = f.act === 'landing';
    const poses = titlePoses(this.data.config.title, sheet, sheet.letters.length, {
      shownMs: this.pauseMs - this.titleFrom + (exiting ? f.t : 0),
      exitMs: exiting ? f.t : null,
      reduced: this.still,
    });
    drawTitle(ctx, this.titleImg, sheet, poses, layout, dpr);
    this.diag.title.draws++;
    this.diag.title.pose = poses
      .map((p) => `${p.frame}:${p.y.toFixed(3)}:${p.roll.toFixed(3)}:${p.alpha.toFixed(2)}`)
      .join('|');
  }

  /** Scroll position from the page, in viewport heights, and the light of the sea. */
  private readScroll(): void {
    const H = window.innerHeight || 1;
    const y = window.scrollY;
    this.sTarget = Math.max(0, y / H);
    // T77 §7.3: night arrives with the photos, whatever the block order;
    // without a Fotos band, over three viewports after the dive.
    const photos = document.getElementById('fotos');
    const top = photos ? photos.getBoundingClientRect().top + y : 0;
    const span = photos ? top - H / 2 - H : 3 * H;
    this.light = Math.min(1, Math.max(0, (y - H) / Math.max(span, H / 2)));
    // toggleAttribute with a force does nothing when it is already so (no style work).
    this.html.toggleAttribute('data-hero-top', y < window.innerHeight * HEADER_FROM);
  }

  /** T78's props: when the page is calm after the rest, or right away on a scroll. */
  private askProps(now: boolean): void {
    const scene = this.scene;
    if (!scene || this.propsAsked) return;
    if (now) {
      this.propsAsked = true;
      scene.loadProps();
      return;
    }
    if (this.propsTimer) return;
    this.propsTimer = true;
    void whenIdle(PROPS_IDLE_MS).then(() => {
      if (!this.disposed) this.askProps(true);
    });
  }
  private propsTimer = false;

  /** The hero's DOM follows the (smoothed) scroll: phase, UI fade, night. */
  private applyScroll(): void {
    const sc = scrollState(this.data.config, this.s);
    const d = this.diag.scroll;
    d.s = this.s;
    d.phase = sc.phase;
    d.light = this.light;
    const hero = this.view?.hero.current;
    if (hero && hero.dataset.scrollPhase !== sc.phase) hero.dataset.scrollPhase = sc.phase;
    const ui = this.view?.ui.current;
    if (ui) {
      ui.style.opacity = sc.ui >= 1 ? '' : sc.ui.toFixed(3);
      ui.style.visibility = sc.ui <= 0 ? 'hidden' : '';
      ui.style.pointerEvents = this.s > UI_TAPS_UNTIL ? 'none' : '';
    }
    const host = this.hostEl;
    if (host) {
      const night = this.light >= 0.5;
      if (night !== host.hasAttribute('data-night')) host.toggleAttribute('data-night', night);
    }
  }

  /**
   * Bucle de pintado: sólo mientras haya algo que mover y se vea. A frame is
   * painted when the scroll position or a time-based animation changed; at
   * rest at full quality, in motion at the level the GPU holds (T80).
   */
  private loop = () => {
    this.raf = 0;
    const c = this.controller;
    if (document.hidden || c.phase === 'destroyed' || this.disposed || !this.view) return;
    if (this.leaving) return;
    const d = this.diag;
    const now = performance.now();
    // Read the size before the writes of the frame: no forced layout.
    const vp = this.viewport();
    // Smooth the scroll towards the page's position.
    const wasMoving = this.tick !== 0;
    const interval = wasMoving ? now - this.tick : 0;
    const dt = wasMoving ? Math.min(100, interval) : 16;
    this.tick = now;
    const gap = this.sTarget - this.s;
    this.s = Math.abs(gap) < 5e-4 ? this.sTarget : this.s + gap * (1 - Math.exp(-dt / SMOOTH_MS));
    this.applyScroll();

    const size = `${vp.width}x${vp.height}`;
    if (size !== this.lastSize) {
      this.scene?.resize(vp.width, vp.height);
      this.lastFrame = null;
    }
    const clock = this.still ? 0 : (now - this.mountedAt) / 1000;
    const phase = c.phase;
    const animating = phase === 'appearing' || phase === 'landing';
    const inMotion = animating || this.s !== this.sTarget;
    if (inMotion && wasMoving) this.sampleMotion(interval);
    // At rest, a full-quality frame at most once per 4× what one costs the GPU
    // (T57's quarter, T80): on a slow GPU the time-based motion of the scene
    // goes slower, the title's letters keep their pace, and no frame queues
    // behind another one. A held frame is painted when its turn comes.
    const restGap = (this.scene?.probe.costs[0] ?? 0) * IDLE_COST_FACTOR;
    const sinceFull = now - this.lastFullAt;
    const hold = !inMotion && c.live && this.lastFrame !== null && sinceFull < restGap;
    this.scene?.setQuality(inMotion ? this.motionLevel : 0);
    const f = hold ? c.frame(vp, this.s, this.light) : c.render(vp, clock, this.s, this.light);
    if (f && !hold && !inMotion && c.live) this.lastFullAt = now;
    this.renderCost = performance.now() - now;
    if (animating) {
      const step = this.lastFrameAt ? now - this.lastFrameAt : 0;
      d.longestFrameMs = Math.max(d.longestFrameMs, step);
      if (step > 50) d.slowFrames++;
      this.lastFrameAt = now;
    } else this.lastFrameAt = 0;
    if (f && !hold) {
      d.framesRendered++;
      d.pose = { ...f.pose };
      if (f.act === 'landing' && d.landingRadius.length < MAX_SAMPLES)
        d.landingRadius.push(f.pose.radius);
      if (this.lastFrame && size === this.lastSize && viewMoved(this.lastFrame, f)) d.cameraMoves++;
      this.lastFrame = f;
    }
    if (f) {
      this.paintTitle(f);
      if (f.act === 'landing') {
        const ui = this.view.ui.current;
        if (ui) ui.style.opacity = String(Math.min(f.title, 1));
      }
      const cover = this.view.cover.current;
      d.cover = this.leaving ? 1 : f.cover;
      if (cover) cover.style.opacity = d.cover > 0 ? String(d.cover) : '';
    }
    this.lastSize = size;
    const next = c.phase;
    const scrolling = this.s !== this.sTarget;
    const moving = next === 'appearing' || next === 'landing' || scrolling;
    // Time-based motion at rest: the planet spins (s = 0), the sea moves (s ≥ dive end).
    const idle = !this.still && c.live && this.visible && (this.s <= 0 || (f?.sea ?? 0) > 0);
    if (moving) this.raf = requestAnimationFrame(this.loop);
    else {
      this.tick = 0;
      if (idle || hold) {
        // Sin comerse la página: a 30 fps como mucho y, si pintar cuesta (un
        // móvil flojo, WebGL por software), más despacio, para no pasar de
        // una cuarta parte del tiempo. A held frame comes back when its turn does.
        const wait =
          hold && !idle
            ? restGap - sinceFull
            : Math.max(IDLE_FRAME_MS, this.renderCost * IDLE_COST_FACTOR) -
              (performance.now() - now);
        this.idleTimer = window.setTimeout(
          () => {
            this.idleTimer = 0;
            if (!this.raf && !this.disposed) this.raf = requestAnimationFrame(this.loop);
          },
          Math.max(0, wait),
        );
      }
    }
  };

  /**
   * Frames in motion that come too slow (median interval over
   * `MOTION_SLOW_MS`): one quality level down for the frames in motion. Only
   * down, never back up within the load (no back and forth).
   */
  private sampleMotion(intervalMs: number): void {
    if (this.motionLevel >= LOWEST_QUALITY) return;
    const xs = this.motionDts;
    xs.push(intervalMs);
    if (xs.length > MOTION_SAMPLES) xs.shift();
    if (xs.length < MOTION_SAMPLES) return;
    const sorted = [...xs].sort((a, b) => a - b);
    if (sorted[MOTION_SAMPLES >> 1]! <= MOTION_SLOW_MS) return;
    this.motionLevel++;
    this.diag.quality.motion = this.motionLevel;
    this.diag.quality.stepDowns++;
    xs.length = 0;
  }

  private kick(): void {
    if (this.idleTimer) {
      window.clearTimeout(this.idleTimer);
      this.idleTimer = 0;
    }
    if (!this.raf && !document.hidden && !this.disposed) {
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  private onScroll = () => {
    this.readScroll();
    if (this.sTarget > 0) this.askProps(true);
    // Scrolling during the appearance fast-forwards it (plan 007).
    if (this.sTarget > 0) this.controller.skip();
    this.kick();
  };

  // Lo que interrumpe una animación la termina en su estado final.
  private onVisibility = () => {
    if (document.hidden) {
      this.controller.interrupt();
      this.controller.suspend();
    } else {
      this.controller.resume();
      this.kick();
    }
  };

  private animating = () =>
    this.controller.phase === 'appearing' || this.controller.phase === 'landing';

  // Rotar o cambiar el ancho termina la animación; un cambio sólo de alto
  // (barras del navegador móvil al cargar) no la corta.
  private onResize = () => {
    if (window.innerWidth !== this.lastWidth && this.animating()) this.controller.interrupt();
    this.lastWidth = window.innerWidth;
    this.readScroll();
    this.kick();
  };

  private onOrientation = () => {
    if (this.animating()) this.controller.interrupt();
    this.kick();
  };

  private onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted) {
      this.controller.interrupt();
      this.readScroll();
      this.kick();
    }
  };

  // Atrás o un cambio de ancla durante la aparición: al reposo.
  private onNavigate = () => {
    this.controller.skip();
    this.readScroll();
    this.kick();
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.controller.skip();
  };

  private dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (current === this) current = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onOrientation);
    window.removeEventListener('popstate', this.onNavigate);
    window.removeEventListener('hashchange', this.onNavigate);
    window.removeEventListener('pageshow', this.onPageShow);
    window.removeEventListener('scroll', this.onScroll);
    document.removeEventListener('keydown', this.onKey);
    this.io?.disconnect();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.clearTimeout(this.idleTimer);
    this.idleTimer = 0;
    const unfinished = this.controller.outcome === null;
    this.controller.destroy();
    this.canvas?.remove();
    this.canvas = null;
    this.scene = null;
    delete this.html.dataset.introAct;
    delete this.html.dataset.hero;
    this.html.removeAttribute('data-hero-top');
    // Ya en /mar tras «Zarpar»: la marca de la entrada no se queda en <html>.
    if (this.leaving) this.html.removeAttribute('data-intro');
    // El hero se fue sin llegar al reposo (otra ruta): la página no se queda oculta.
    if (unfinished) {
      if (this.entry) this.entry.reveal('none');
      else this.html.removeAttribute('data-intro');
    }
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** The probe's costs for the diagnostics (0.1 ms; `null`: level not measured). */
function roundCosts(costs: readonly (number | null)[]): (number | null)[] {
  return costs.map((c) => (c === null ? null : Math.round(c * 10) / 10));
}

/** La entrada de esta carga de `/`, mientras haya un hero que la muestre. */
let current: IntroRun | null = null;

/**
 * Engancha un montaje de la escena del hero a la entrada en curso (o la
 * empieza). Devuelve la baja para el desmontaje.
 */
export function attachIntro(data: IntroData, view: IntroView): () => void {
  const run = current && !current.disposed ? current : (current = new IntroRun(data));
  run.attach(view);
  return () => run.detach(view);
}

/** «Entradas» during the appearance: the hero jumps to the rest (fast-forward). */
export function skipIntro(): void {
  current?.controller.skip();
}

/** «Zarpar» (hero pill: the dive; header pill: the veil). Whether the hero took it. */
export function enterIntro(source: EnterSource = 'button'): boolean {
  return current ? current.enter(source) : false;
}
