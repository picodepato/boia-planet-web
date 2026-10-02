import {
  IntroController,
  mountMode,
  titlePoses,
  viewMoved,
  type BootEntry,
  type IntroFrame,
  type IntroOutcome,
} from '@boia/engine/intro';
import { track } from '../analytics';
import type { IntroScene } from '../planeta/intro-scene';
import type { IntroDiagnostics } from './bridge';
import type { IntroData } from './load';
import { clearTitle, drawTitle, fitTitle, sizeTitleCanvas } from './title-canvas';

/** Radios de «Zarpar» guardados en el diagnóstico (tope). */
const MAX_SAMPLES = 600;
/** Píxeles de dispositivo por px CSS, como mucho (como /mar al arrancar). */
const MAX_DPR = 1.5;
/** El giro del hero, ya en la landing: un fotograma cada tanto como poco. */
const IDLE_FRAME_MS = 1000 / 30;
/** Visita directa: cuánto espera, como mucho, a que la página esté tranquila. */
const DIRECT_IDLE_MS = 1500;

/** Cuando el navegador esté libre (o pasados `maxMs`). */
function whenIdle(maxMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => resolve(), { timeout: maxMs });
    } else window.setTimeout(resolve, Math.min(maxMs, 300));
  });
}

/** Los elementos de la escena del hero que pinta la entrada (refs de React: se leen al usarlos). */
export interface IntroView {
  host: { readonly current: HTMLDivElement | null };
  title: { readonly current: HTMLParagraphElement | null };
  title3d: { readonly current: HTMLCanvasElement | null };
  enter: { readonly current: HTMLButtonElement | null };
  /** Velo con el color del mar de /mar: cubre la vista al final de «Zarpar» (T64). */
  cover: { readonly current: HTMLDivElement | null };
  /** La landing ya se ve: fuera la capa de la entrada. */
  onLanded(): void;
  /** Acto 2: el planeta espera a «Zarpar» (buen momento para ir pidiendo /mar). */
  onPaused?(): void;
  /** «Zarpar» terminó con el velo puesto: a /mar, sin pasar por la landing (T64). */
  onEnterGame(): void;
}

/**
 * Una entrada en curso (T57): el controlador, la escena three.js, el bucle de
 * pintado y los oyentes de la página. Vive mientras dure la carga de `/`, no
 * lo que dure el bloque del hero: si React vuelve a montar el hero (el
 * contenido del repositorio llega con otro bloque, un remontaje de
 * desarrollo…), el nuevo montaje recoge la misma entrada donde iba, con su
 * canvas, en vez de cortarla o empezarla otra vez. Sólo se desmonta si el
 * hero se va del todo (otra ruta): entonces, si no había terminado, la
 * landing se muestra.
 */
class IntroRun {
  readonly controller: IntroController<IntroScene>;
  readonly diag: IntroDiagnostics;
  disposed = false;
  private view: IntroView | null = null;
  /** El host del montaje actual (el ref de React ya puede estar vacío al desmontar). */
  private hostEl: HTMLDivElement | null = null;
  private scene: IntroScene | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private raf = 0;
  private idleTimer = 0;
  /** ms que costó pintar el último fotograma. */
  private renderCost = 0;
  private visible = true;
  private lastFrame: IntroFrame | null = null;
  private lastSize = '';
  private lastFrameAt = 0;
  private focused = false;
  private pausedSeen = false;
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
  // Título 3D (T27): la hoja se pide cuando el planeta ya está listo.
  private titleImg: HTMLImageElement | null = null;
  private titleFrom = 0;
  private pauseMs = 0;
  private lastWidth = window.innerWidth;

  constructor(private readonly data: IntroData) {
    const entry = window.__boiaEntry;
    this.entry = entry;
    // La entrada sólo se reproduce en la carga completa en la que el script
    // de arranque la pidió y aún no se resolvió; volver a `/` dentro de la
    // app no la repite (D-21).
    const mode = mountMode(entry);
    if (entry) {
      entry.claimed = true;
      clearTimeout(entry.timer);
      entry.timer = 0;
    }
    this.still = mode === 'reduced' || prefersReducedMotion();
    this.t0 = entry?.t0 ?? performance.now();
    this.mountedAt = performance.now();
    const { config } = data;

    this.diag = {
      mode,
      phase: 'idle',
      sceneStatus: 'none',
      outcome: null,
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
      landedAtMs: null,
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
    };
    window.__boiaIntro = this.diag;

    this.controller = new IntroController<IntroScene>({
      mode,
      config,
      still: this.still,
      now: () => performance.now(),
      createScene: () => this.createScene(),
      setTimer(fn, ms) {
        const id = window.setTimeout(fn, ms);
        return () => window.clearTimeout(id);
      },
      onLanded: (o) => this.landed(o),
      onChange: () => this.sync(),
    });

    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onOrientation);
    window.addEventListener('popstate', this.onNavigate);
    window.addEventListener('hashchange', this.onNavigate);
    window.addEventListener('pageshow', this.onPageShow);
    document.addEventListener('keydown', this.onKey);
    document.addEventListener('pointerdown', this.onPointer);
    this.io =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(([e]) => {
            this.visible = !!e?.isIntersecting;
            if (this.visible) this.kick();
          })
        : null;

    // Abierta en segundo plano: el plazo de carga no corre hasta que se mire.
    if (document.hidden) this.controller.suspend();
    this.controller.start();
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
    if (this.controller.phase === 'landed' && !this.leaving) view.onLanded();
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

  enter(): void {
    this.controller.enter('button');
  }

  skip(): void {
    this.controller.skip();
  }

  private async createScene(): Promise<IntroScene> {
    // Sin entrada que reproducir, el planeta del hero espera a que la página
    // esté tranquila: primero el contenido de la landing.
    if (this.controller.mode === 'direct') await whenIdle(DIRECT_IDLE_MS);
    if (this.disposed) throw new Error('la entrada ya se fue');
    const { createIntroScene } = await import('../planeta/intro-scene');
    const canvas = document.createElement('canvas');
    canvas.className = 'hero__canvas';
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
      });
      this.scene = scene;
      this.lastSize = `${vp.width}x${vp.height}`;
      this.diag.renderer = scene.renderer;
      this.diag.world = scene.worldId;
      this.diag.islands = scene.islands;
      this.diag.islandIds = [...scene.islandIds];
      return scene;
    } catch (err) {
      console.warn('[boia] la escena de entrada no arrancó; se queda la landing ligera', err);
      canvas.remove();
      this.canvas = null;
      throw err;
    }
  }

  private viewport() {
    const host = this.hostEl;
    return {
      width: Math.max(1, host?.clientWidth ?? window.innerWidth),
      height: Math.max(1, host?.clientHeight ?? window.innerHeight),
    };
  }

  private sync(): void {
    const c = this.controller;
    const d = this.diag;
    if (d.phase !== c.phase) d.history.push(c.phase);
    d.phase = c.phase;
    d.sceneStatus = c.sceneStatus;
    d.outcome = c.outcome;
    d.scenesCreated = c.scenesCreated;
    d.worldsAlive = c.worldsAlive;
    d.enteredBy = c.enteredBy;
    d.appearedMs = c.appearedMs;
    d.playedMs = c.playedMs;
    d.sceneReadyMs = c.sceneReadyMs;
    d.budgetLeftMs = c.budgetLeftMs;
    const host = this.hostEl;
    if (host) host.dataset.phase = c.phase;
    // Acto en curso, para el CSS de la capa de la entrada (carga, título, botón).
    if (c.phase === 'destroyed' || c.phase === 'landed') delete this.html.dataset.introAct;
    else this.html.dataset.introAct = c.phase;
    // El canvas sale en cuanto la escena tiene su primer fotograma.
    if (c.sceneStatus === 'ready') {
      if (host) host.dataset.ready = '';
      this.requestTitle();
    } else if (host) delete host.dataset.ready;
    // Acto 2: el botón recibe el foco (Enter lo activa).
    if (c.phase === 'paused' && !this.focused) {
      const enter = this.view?.enter.current;
      if (enter) {
        this.focused = true;
        enter.focus({ preventScroll: true });
      }
    }
    if (c.phase === 'paused' && !this.pausedSeen) {
      this.pausedSeen = true;
      this.view?.onPaused?.();
    }
    // «Zarpar» (botón o avance automático) empieza a explorar el mundo (T64).
    if (c.phase === 'landing' && !this.sailed) {
      this.sailed = true;
      track('explore_start', { source: 'intro' });
    }
    this.kick();
  }

  private landed(outcome: IntroOutcome): void {
    this.diag.landedAtMs = performance.now() - this.t0;
    if (this.controller.toGame) {
      // «Zarpar» (T64): el velo del mar se queda puesto y se entra en /mar,
      // sin enseñar la landing (ni contarla como vista).
      this.diag.exit = 'game';
      this.leaving = true;
      this.diag.cover = 1;
      const cover = this.view?.cover.current;
      if (cover) cover.style.opacity = '1';
      this.view?.onEnterGame();
      return;
    }
    this.diag.exit = 'landing';
    this.view?.onLanded();
    if (this.entry) this.entry.reveal(outcome);
    else this.html.removeAttribute('data-intro');
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
        this.titleFrom = c.phase === 'paused' && !this.still ? this.pauseMs : 0;
        d.mode = '3d';
        d.loadedMs = performance.now() - this.t0;
        const title = this.view?.title.current;
        if (title) title.dataset.title = '3d';
        this.lastFrame = null;
        this.kick();
      })
      .catch(() => {
        console.warn('[boia] no cargó la hoja del título; se queda el título plano');
      });
  }

  private paintTitle(f: IntroFrame): boolean {
    const sheet = this.data.title;
    const canvas = this.view?.title3d.current;
    const ctx = canvas?.getContext('2d');
    if (!sheet || !this.titleImg || !canvas || !ctx) return false;
    const title = this.view?.title.current;
    if (title && title.dataset.title !== '3d') title.dataset.title = '3d';
    if (f.act === 'pause') this.pauseMs = f.t;
    if (f.act !== 'pause' && f.act !== 'landing') {
      clearTitle(ctx);
      return true;
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
    return true;
  }

  /** Bucle de pintado: sólo mientras haya algo que mover y se vea. */
  private loop = () => {
    this.raf = 0;
    const c = this.controller;
    if (document.hidden || c.phase === 'destroyed' || this.disposed || !this.view) return;
    if (this.leaving) return;
    const d = this.diag;
    const vp = this.viewport();
    const size = `${vp.width}x${vp.height}`;
    if (size !== this.lastSize) {
      this.scene?.resize(vp.width, vp.height);
      this.lastFrame = null;
    }
    const clock = this.still ? 0 : (performance.now() - this.mountedAt) / 1000;
    const before = performance.now();
    const phase = c.phase;
    const f = c.render(vp, clock);
    this.renderCost = performance.now() - before;
    if (phase === 'appearing' || phase === 'landing') {
      const dt = this.lastFrameAt ? before - this.lastFrameAt : 0;
      d.longestFrameMs = Math.max(d.longestFrameMs, dt);
      if (dt > 50) d.slowFrames++;
      this.lastFrameAt = before;
    } else this.lastFrameAt = 0;
    if (f) {
      d.framesRendered++;
      d.pose = { ...f.pose };
      if (f.act === 'landing' && d.landingRadius.length < MAX_SAMPLES)
        d.landingRadius.push(f.pose.radius);
      if (this.lastFrame && size === this.lastSize && viewMoved(this.lastFrame, f)) d.cameraMoves++;
      this.lastFrame = f;
      // Con el título 3D las letras llevan su propia entrada y salida; en
      // movimiento reducido se funde como el texto.
      const own = this.paintTitle(f) && !this.still;
      const title = this.view.title.current;
      const enter = this.view.enter.current;
      const cover = this.view.cover.current;
      if (title) title.style.opacity = own ? '1' : String(f.title);
      if (enter) enter.style.opacity = String(f.button);
      d.cover = this.leaving ? 1 : f.cover;
      if (cover) cover.style.opacity = String(d.cover);
      if (c.phase === 'landing' && f.content > 0) this.html.setAttribute('data-intro', 'arrive');
    }
    this.lastSize = size;
    const next = c.phase;
    // Movimiento reducido: la pausa es un planeta quieto; sólo se pinta
    // mientras entran título y botón. En la landing, el planeta sigue girando.
    const moving =
      next === 'waiting' ||
      next === 'appearing' ||
      next === 'landing' ||
      (next === 'paused' && (!this.still || (f?.title ?? 0) < 1));
    const idle = !this.still && c.sceneStatus === 'ready' && this.visible;
    if (moving) this.raf = requestAnimationFrame(this.loop);
    else if (idle) {
      // El planeta del hero gira sin comerse la página: a 30 fps como mucho y,
      // si pintar cuesta (un móvil flojo, WebGL por software), más despacio,
      // para no pasar de una cuarta parte del tiempo.
      const wait = Math.max(IDLE_FRAME_MS, this.renderCost * 4) - (performance.now() - before);
      this.idleTimer = window.setTimeout(
        () => {
          this.idleTimer = 0;
          if (!this.raf && !this.disposed) this.raf = requestAnimationFrame(this.loop);
        },
        Math.max(0, wait),
      );
    }
  };

  private kick(): void {
    if (this.idleTimer) {
      window.clearTimeout(this.idleTimer);
      this.idleTimer = 0;
    }
    if (!this.raf && !document.hidden && !this.disposed) {
      this.raf = requestAnimationFrame(this.loop);
    }
  }

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
    this.kick();
  };

  private onOrientation = () => {
    if (this.animating()) this.controller.interrupt();
    this.kick();
  };

  private onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted) {
      this.controller.interrupt();
      this.kick();
    }
  };

  // Atrás o un cambio de ancla durante la entrada: se sale de ella.
  private onNavigate = () => {
    this.controller.skip();
    this.kick();
  };

  private onKey = (e: KeyboardEvent) => {
    this.controller.touch();
    if (e.key === 'Escape') this.controller.skip();
  };

  private onPointer = () => this.controller.touch();

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
    document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('pointerdown', this.onPointer);
    this.io?.disconnect();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.clearTimeout(this.idleTimer);
    this.idleTimer = 0;
    const unfinished = this.controller.phase !== 'landed' && this.controller.phase !== 'destroyed';
    this.controller.destroy();
    this.canvas?.remove();
    this.canvas = null;
    this.scene = null;
    delete this.html.dataset.introAct;
    // Ya en /mar tras «Zarpar»: la marca de la entrada no se queda en <html>.
    if (this.leaving) this.html.removeAttribute('data-intro');
    // El hero se fue sin terminar la entrada (otra ruta): la página no se queda oculta.

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

/** «Zarpar». */
export function enterIntro(): void {
  current?.enter();
}

/** «Saltar animación» y «Solo quiero ver las entradas». */
export function skipIntro(): void {
  current?.skip();
}
