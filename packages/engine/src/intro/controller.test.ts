import { describe, expect, it, vi } from 'vitest';
import {
  IntroController,
  MAX_FRAME_STEP_MS,
  type IntroOutcome,
  type IntroSceneHandle,
} from './controller';
import {
  DEFAULT_PLANET_INTRO as CFG,
  viewMoved,
  type IntroFrame,
  type IntroMode,
  type PlanetIntroConfig,
} from './planet';

const VP = { width: 360, height: 640 };
const APPEAR = CFG.appear.durationMs;
const LAND = CFG.landing.durationMs;
const BUDGET = CFG.loadBudgetMs;
/** Configuración de prueba con el avance automático encendido. */
const AUTO: PlanetIntroConfig = {
  ...CFG,
  pause: { ...CFG.pause, autoAdvance: { enabled: true, afterMs: 8000 } },
};

class FakeScene implements IntroSceneHandle {
  static alive = 0;
  /** El puerto de salida de /mar en el planeta (T64). */
  readonly focus = { lon: 2.2, lat: -0.55 };
  frames: IntroFrame[] = [];
  destroyed = 0;
  constructor() {
    FakeScene.alive++;
  }
  render(f: IntroFrame) {
    this.frames.push(f);
  }
  destroy() {
    this.destroyed++;
    if (this.destroyed === 1) FakeScene.alive--;
  }
}

/** Controlador con reloj, temporizadores y escena de mentira. */
function setup(
  mode: IntroMode = 'intro',
  opts: { config?: PlanetIntroConfig; still?: boolean } = {},
) {
  FakeScene.alive = 0;
  let now = 0;
  const timers: Array<{ at: number; fn: () => void; cancelled: boolean }> = [];
  const landed: IntroOutcome[] = [];
  let resolveScene!: (s: FakeScene) => void;
  let rejectScene!: (e: Error) => void;
  const createScene = vi.fn(
    () =>
      new Promise<FakeScene>((res, rej) => {
        resolveScene = res;
        rejectScene = rej;
      }),
  );
  const c = new IntroController<FakeScene>({
    mode,
    config: opts.config ?? CFG,
    still: !!opts.still,
    now: () => now,
    createScene,
    setTimer: (fn, ms) => {
      const t = { at: now + ms, fn, cancelled: false };
      timers.push(t);
      return () => (t.cancelled = true);
    },
    onLanded: (o) => landed.push(o),
  });
  const advance = (ms: number) => {
    now += ms;
    for (const t of timers) {
      if (!t.cancelled && t.at <= now) {
        t.cancelled = true;
        t.fn();
      }
    }
  };
  const sceneReady = async () => {
    const s = new FakeScene();
    resolveScene(s);
    await Promise.resolve();
    await Promise.resolve();
    return s;
  };
  const sceneFails = async () => {
    rejectScene(new Error('sin WebGL'));
    await Promise.resolve();
    await Promise.resolve();
  };
  /** Pinta fotogramas cada 16 ms durante `ms`. */
  const play = (ms: number) => {
    for (let t = 0; t < ms; t += 16) {
      advance(16);
      c.render(VP, now / 1000);
    }
  };
  /** Hasta la pausa: escena lista y la aparición entera. */
  const toPause = async () => {
    c.start();
    const scene = await sceneReady();
    play(APPEAR + 32);
    expect(c.phase).toBe('paused');
    return scene;
  };
  const pending = () => timers.filter((t) => !t.cancelled).length;
  const moves = (frames: IntroFrame[]) =>
    frames.reduce((n, f, i) => n + (i > 0 && viewMoved(frames[i - 1]!, f) ? 1 : 0), 0);
  return {
    c,
    advance,
    sceneReady,
    sceneFails,
    play,
    toPause,
    pending,
    landed,
    createScene,
    moves,
  };
}

/** Invariantes que ningún evento puede romper (REQ-ENT-008, 014, 020). */
function expectInvariants(h: ReturnType<typeof setup>) {
  expect(h.createScene).toHaveBeenCalledTimes(1);
  expect(h.c.scenesCreated).toBe(1);
  expect(h.c.worldsAlive).toBeLessThanOrEqual(1);
  expect(FakeScene.alive).toBeLessThanOrEqual(1);
  expect(h.landed.length).toBeLessThanOrEqual(1);
}

describe('máquina de estados de la entrada 3D (T57)', () => {
  it('carga → aparición → pausa → (Zarpar) → zambullida en el puerto → juego (T64)', async () => {
    const h = setup();
    h.c.start();
    expect(h.c.phase).toBe('waiting');
    const scene = await h.sceneReady();
    expect(h.c.phase).toBe('appearing');
    h.play(APPEAR + 32);
    expect(h.c.phase).toBe('paused');
    expect(h.c.appearedMs).toBeGreaterThanOrEqual(APPEAR);
    expect(h.c.appearedMs).toBeLessThan(APPEAR + 20);
    expect(h.c.enter()).toBe(true);
    expect(h.c.phase).toBe('landing');
    h.play(LAND + 50);
    expect(h.c.phase).toBe('landed');
    expect(h.landed).toEqual(['played']);
    expect(h.c.enteredBy).toBe('button');
    expect(h.c.playedMs).toBeGreaterThanOrEqual(LAND);
    expect(h.c.playedMs).toBeLessThan(LAND + 20);
    // Zarpar entra en el juego, no en la landing.
    expect(h.c.toGame).toBe(true);
    // Termina con el velo del mar puesto y el puerto de cara (su latitud, inclinada).
    const done = scene.frames.find((f) => f.done)!;
    expect(done.act).toBe('landing');
    expect(done.cover).toBe(1);
    expect(done.content).toBe(0);
    expect(done.pose.tilt).toBeCloseTo(scene.focus.lat);
    // Mientras se zambulle, el planeta sólo gira hacia el puerto (sin su giro de siempre).
    const dive = scene.frames.filter((f) => f.act === 'landing');
    const turn = dive.map((f) => f.pose.spin - dive[0]!.pose.spin);
    const sign = Math.sign(turn.at(-1)!);
    expect(turn.every((d, i) => i === 0 || sign * d >= sign * turn[i - 1]! - 1e-12)).toBe(true);
    expect(h.moves(scene.frames)).toBeGreaterThan(0);
    expectInvariants(h);
  });

  it('la pausa nunca avanza sin el botón (configuración de serie: sin avance automático)', async () => {
    const h = setup();
    const scene = await h.toPause();
    h.play(60_000);
    h.advance(10 * 60_000);
    h.play(100);
    expect(h.c.phase).toBe('paused');
    expect(h.landed).toEqual([]);
    expect(h.pending()).toBe(0);
    const last = scene.frames.at(-1)!;
    expect(last.act).toBe('pause');
    expect(last.content).toBe(0);
    expect(last.title).toBe(1);
    expectInvariants(h);
  });

  it('con el avance automático encendido, zarpa solo tras el tiempo configurado', async () => {
    const h = setup('intro', { config: AUTO });
    await h.toPause();
    h.play(AUTO.pause.autoAdvance.afterMs - 100);
    expect(h.c.phase).toBe('paused');
    h.play(200);
    expect(h.c.phase).toBe('landing');
    expect(h.c.enteredBy).toBe('auto');
    h.play(LAND + 50);
    expect(h.landed).toEqual(['played']);
    expect(h.c.toGame).toBe(true);
    expectInvariants(h);
  });

  it('avance automático: tocar la pantalla vuelve a contar desde cero', async () => {
    const h = setup('intro', { config: AUTO });
    await h.toPause();
    const after = AUTO.pause.autoAdvance.afterMs;
    h.play(after - 1000);
    h.c.touch();
    h.play(after - 1000);
    expect(h.c.phase).toBe('paused');
    h.play(1100);
    expect(h.c.phase).toBe('landing');
    expectInvariants(h);
  });

  it('el botón pulsado dos veces (y cinco) zarpa una sola vez', async () => {
    const h = setup();
    const scene = await h.toPause();
    expect(h.c.enter()).toBe(true);
    for (let i = 0; i < 4; i++) expect(h.c.enter()).toBe(false);
    h.play(LAND / 2);
    expect(h.c.enter()).toBe(false);
    h.play(LAND);
    expect(h.c.enter()).toBe(false);
    expect(h.landed).toEqual(['played']);
    // «Zarpar» no volvió a empezar: el planeta sólo crece.
    const r = scene.frames.filter((f) => f.act === 'landing').map((f) => f.pose.radius);
    expect(r.every((v, i) => i === 0 || v >= r[i - 1]!)).toBe(true);
    expectInvariants(h);
  });

  it('el botón no hace nada durante la aparición, antes de la escena ni tras llegar', async () => {
    const h = setup();
    h.c.start();
    expect(h.c.enter()).toBe(false);
    await h.sceneReady();
    h.play(APPEAR / 2);
    expect(h.c.enter()).toBe(false);
    expect(h.c.phase).toBe('appearing');
    h.play(APPEAR);
    h.c.skip();
    expect(h.c.enter()).toBe(false);
    expect(h.c.phase).toBe('landed');
    expectInvariants(h);
  });

  it('«Saltar» durante la pausa o durante «Zarpar»: una vez, al encuadre del hero', async () => {
    for (const during of ['paused', 'landing'] as const) {
      const h = setup();
      const scene = await h.toPause();
      if (during === 'landing') {
        h.c.enter();
        h.play(LAND / 3);
      }
      for (let i = 0; i < 5; i++) h.c.skip();
      h.c.enter();
      expect(h.c.phase).toBe('landed');
      expect(h.landed).toEqual(['skipped']);
      // Saltar lleva a la landing, no al juego (T64).
      expect(h.c.toGame).toBe(false);
      h.play(100);
      const last = scene.frames.at(-1)!;
      expect(last.done).toBe(true);
      expect(last.source).toBe('hero');
      expectInvariants(h);
    }
  });

  it('saltar antes de que llegue la escena también es idempotente', async () => {
    const h = setup();
    h.c.start();
    h.c.skip();
    h.c.skip();
    const scene = await h.sceneReady();
    expect(h.c.phase).toBe('landed');
    h.play(50);
    expect(scene.frames.every((f) => f.done)).toBe(true);
    expectInvariants(h);
  });

  it('Atrás / cambio de ancla durante la pausa: sale a la landing sin repetir ni duplicar', async () => {
    const h = setup();
    await h.toPause();
    h.c.skip(); // popstate
    h.c.skip(); // hashchange justo después
    h.c.interrupt(); // vuelta desde la caché del navegador
    h.c.start();
    expect(h.c.phase).toBe('landed');
    expect(h.landed).toEqual(['skipped']);
    expectInvariants(h);
  });

  it('pestaña oculta en la aparición: al volver, pausa con título y botón (no zarpa sola)', async () => {
    const h = setup();
    h.c.start();
    const scene = await h.sceneReady();
    h.play(APPEAR / 2);
    h.c.interrupt(); // visibilitychange → hidden
    expect(h.c.phase).toBe('paused');
    h.advance(60_000);
    h.play(32);
    const last = scene.frames.at(-1)!;
    expect(last.act).toBe('pause');
    expect(last.title).toBe(1);
    expect(last.button).toBe(1);
    expect(h.landed).toEqual([]);
    expectInvariants(h);
  });

  it('pestaña oculta en la pausa: sigue esperando; durante «Zarpar»: termina, rumbo al juego', async () => {
    const h = setup();
    const scene = await h.toPause();
    h.c.interrupt();
    expect(h.c.phase).toBe('paused');
    h.c.enter();
    h.play(LAND / 2);
    h.c.interrupt();
    h.c.interrupt();
    h.advance(60_000);
    h.play(32);
    expect(scene.frames.at(-1)!.done).toBe(true);
    expect(h.landed).toEqual(['played']);
    expect(h.c.toGame).toBe(true);
    expect(h.c.playedMs).toBeNull();
    expectInvariants(h);
  });

  it('cambio de ruta mientras carga: la escena que llega tarde se destruye', async () => {
    const h = setup();
    h.c.start();
    h.c.destroy();
    h.c.destroy();
    const late = await h.sceneReady();
    expect(late.destroyed).toBe(1);
    expect(h.c.worldsAlive).toBe(0);
    expect(FakeScene.alive).toBe(0);
    expect(h.landed).toEqual([]);
    h.c.skip();
    h.c.enter();
    h.c.interrupt();
    expect(h.c.render(VP, 1)).toBeNull();
    expectInvariants(h);
  });

  it('cambio de ruta en la pausa o durante «Zarpar»: se destruye una vez y no queda escena', async () => {
    for (const during of ['paused', 'landing'] as const) {
      const h = setup('intro', { config: AUTO });
      const scene = await h.toPause();
      if (during === 'landing') {
        h.c.enter();
        h.play(LAND / 2);
      }
      h.c.destroy();
      h.c.destroy();
      h.c.enter();
      h.advance(60_000); // el avance automático ya no dispara
      expect(scene.destroyed).toBe(1);
      expect(h.c.worldsAlive).toBe(0);
      expect(h.c.phase).toBe('destroyed');
      expect(h.pending()).toBe(0);
      expectInvariants(h);
    }
  });

  it('el plazo de carga cuenta desde el montaje, no desde la carga de la página', async () => {
    const h = setup();
    // La página lleva un buen rato cargando antes de montar: no cuenta.
    h.advance(BUDGET * 3);
    h.c.start();
    h.advance(BUDGET - 1);
    expect(h.c.phase).toBe('waiting');
    // Una escena lenta, pero dentro del plazo: la entrada se ve entera.
    await h.sceneReady();
    expect(h.c.phase).toBe('appearing');
    expect(h.c.sceneReadyMs).toBe(BUDGET - 1);
    expect(h.c.budgetLeftMs).toBe(1);
    expect(h.pending()).toBe(0);
    expectInvariants(h);
  });

  it('una escena que no llega en el plazo: landing ligera; si llega luego, el hero quieto en su sitio', async () => {
    const h = setup();
    h.c.start();
    h.advance(BUDGET);
    expect(h.c.phase).toBe('landed');
    expect(h.landed).toEqual(['none']);
    const scene = await h.sceneReady();
    h.play(50);
    expect(scene.frames.every((f) => f.done && f.source === 'hero')).toBe(true);
    expectInvariants(h);
  });

  it('pestaña oculta mientras carga: el plazo se para y la entrada se ve al volver', async () => {
    const h = setup();
    h.c.suspend(); // la página se abrió en segundo plano
    h.c.start();
    h.advance(BUDGET * 10);
    expect(h.c.phase).toBe('waiting');
    const scene = await h.sceneReady();
    expect(h.c.phase).toBe('appearing');
    // Sin pintar en segundo plano: al volver, la aparición empieza desde el principio.
    h.advance(60_000);
    h.c.resume();
    h.play(64);
    expect(scene.frames[0]!.act).toBe('appear');
    expect(scene.frames[0]!.t).toBe(0);
    h.play(APPEAR);
    expect(h.c.phase).toBe('paused');
    expect(h.landed).toEqual([]);
    expectInvariants(h);
  });

  it('pestaña oculta y vuelta durante la carga: el plazo sigue donde iba', async () => {
    const h = setup();
    h.c.start();
    h.advance(BUDGET - 2000);
    h.c.suspend();
    h.advance(BUDGET * 5);
    h.c.resume();
    h.c.resume();
    h.advance(1999);
    expect(h.c.phase).toBe('waiting');
    h.advance(1);
    expect(h.c.phase).toBe('landed');
    expect(h.landed).toEqual(['none']);
    expectInvariants(h);
  });

  it('motor que falla: landing ligera, sin escena', async () => {
    const h = setup();
    h.c.start();
    await h.sceneFails();
    expect(h.c.phase).toBe('landed');
    expect(h.c.sceneStatus).toBe('failed');
    expect(h.c.worldsAlive).toBe(0);
    expect(h.landed).toEqual(['none']);
    expectInvariants(h);
  });

  it('un tirón largo no se come la aparición: sigue donde iba', async () => {
    const h = setup();
    h.c.start();
    await h.sceneReady();
    h.play(300);
    h.advance(2500); // un fotograma de 2,5 s (subir geometría, un móvil lento)
    const f = h.c.render(VP, 0)!;
    expect(f.act).toBe('appear');
    expect(f.t).toBeLessThanOrEqual(304 + MAX_FRAME_STEP_MS);
    expectInvariants(h);
  });

  it('movimiento reducido: sin aparición; planeta quieto; al pulsar, fundido sin mover nada (REQ-ENT-010)', async () => {
    const h = setup('reduced');
    h.c.start();
    expect(h.landed).toEqual([]);
    const scene = await h.sceneReady();
    expect(h.c.phase).toBe('paused');
    h.play(3000);
    expect(h.c.phase).toBe('paused');
    expect(h.c.enter()).toBe(true);
    h.play(CFG.reduced.fadeMs + 500);
    expect(h.landed).toEqual(['played']);
    expect(h.c.toGame).toBe(true);
    expect(scene.frames.find((f) => f.done)!.cover).toBe(1);
    expect(scene.frames.some((f) => f.act === 'appear')).toBe(false);
    expect(h.moves(scene.frames)).toBe(0);
    const spins = new Set(scene.frames.map((f) => f.pose.spin));
    expect(spins.size).toBe(1);
    expectInvariants(h);
  });

  it('una visita directa con movimiento reducido del sistema: el hero no gira', async () => {
    const h = setup('direct', { still: true });
    h.c.start();
    expect(h.landed).toEqual(['none']);
    const scene = await h.sceneReady();
    h.play(2000);
    expect(h.moves(scene.frames)).toBe(0);
    const g = setup('direct');
    g.c.start();
    const moving = await g.sceneReady();
    g.play(2000);
    expect(g.moves(moving.frames)).toBeGreaterThan(0);
  });
});
