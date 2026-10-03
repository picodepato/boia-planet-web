import { describe, expect, it, vi } from 'vitest';
import {
  IntroController,
  MAX_FRAME_STEP_MS,
  type IntroOutcome,
  type IntroSceneHandle,
} from './controller';
import {
  DEFAULT_PLANET_INTRO as CFG,
  pickPlanetFraming,
  poseOf,
  viewMoved,
  type IntroFrame,
  type IntroMode,
  type PlanetIntroConfig,
} from './planet';

const VP = { width: 360, height: 640 };
const APPEAR = CFG.appear.durationMs;
const LAND = CFG.landing.durationMs;
const BUDGET = CFG.loadBudgetMs;

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
  const rests: IntroOutcome[] = [];
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
    onRest: (o) => rests.push(o),
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
  /** Pinta fotogramas cada 16 ms durante `ms`, con el scroll en `s`. */
  const play = (ms: number, s = 0) => {
    for (let t = 0; t < ms; t += 16) {
      advance(16);
      c.render(VP, now / 1000, s);
    }
  };
  /** Hasta el reposo: escena lista y la aparición entera. */
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
    rests,
    createScene,
    moves,
  };
}

/** Invariantes que ningún evento puede romper (REQ-ENT-008, 014, 020). */
function expectInvariants(h: ReturnType<typeof setup>, scenes = 1) {
  expect(h.createScene).toHaveBeenCalledTimes(scenes);
  expect(h.c.scenesCreated).toBe(scenes);
  expect(h.c.worldsAlive).toBeLessThanOrEqual(1);
  expect(FakeScene.alive).toBeLessThanOrEqual(1);
  expect(h.landed.length).toBeLessThanOrEqual(1);
  expect(h.rests.length).toBeLessThanOrEqual(1);
}

describe('máquina de estados del hero (T57; plan 007 T79)', () => {
  it('carga → aparición → reposo → (Zarpar) → zambullida en el puerto → juego (T64)', async () => {
    const h = setup();
    h.c.start();
    expect(h.c.phase).toBe('waiting');
    const scene = await h.sceneReady();
    expect(h.c.phase).toBe('appearing');
    h.play(APPEAR + 32);
    expect(h.c.phase).toBe('paused');
    expect(h.rests).toEqual(['played']);
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
    expect(h.c.toGame).toBe(true);
    // Termina con el velo del mar puesto y el puerto de cara (su latitud, inclinada).
    const done = scene.frames.find((f) => f.done)!;
    expect(done.act).toBe('landing');
    expect(done.cover).toBe(1);
    expect(done.pose.tilt).toBeCloseTo(scene.focus.lat);
    // Mientras se zambulle, el planeta sólo gira hacia el puerto (sin su giro de siempre).
    const dive = scene.frames.filter((f) => f.act === 'landing');
    const turn = dive.map((f) => f.pose.spin - dive[0]!.pose.spin);
    const sign = Math.sign(turn.at(-1)!);
    expect(turn.every((d, i) => i === 0 || sign * d >= sign * turn[i - 1]! - 1e-12)).toBe(true);
    expect(h.moves(scene.frames)).toBeGreaterThan(0);
    expectInvariants(h);
  });

  it('el reposo nunca avanza solo: sin avance automático (plan 007)', async () => {
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
    expect(last.title).toBe(1);
    expect(last.sea).toBe(0);
    expectInvariants(h);
  });

  it('en reposo, el scroll lleva la escena: la zambullida y el mar, y de vuelta (plan 007)', async () => {
    const h = setup();
    const scene = await h.toPause();
    const rest = poseOf(pickPlanetFraming(CFG, VP.width).intro, VP, 0);
    h.play(100, 0.5);
    const mid = scene.frames.at(-1)!;
    expect(mid.act).toBe('pause');
    expect(mid.pose.radius).toBeGreaterThan(rest.radius);
    expect(mid.title).toBe(0);
    expect(mid.sea).toBe(0);
    h.play(100, 1);
    const sea = scene.frames.at(-1)!;
    expect(sea.sea).toBe(1);
    expect(sea.s).toBe(1);
    // Scrolling never sails: still at rest, nothing for the game.
    h.play(100, 3);
    expect(h.c.phase).toBe('paused');
    h.play(100, 0);
    const back = scene.frames.at(-1)!;
    expect(back.sea).toBe(0);
    expect(back.title).toBe(1);
    expect(back.pose.radius).toBeCloseTo(rest.radius);
    expect(h.landed).toEqual([]);
    expectInvariants(h);
  });

  it('bajando, el planeta no gira (el giro sólo corre en reposo arriba)', async () => {
    const h = setup();
    const scene = await h.toPause();
    h.play(500, 0.4);
    const a = scene.frames.at(-1)!;
    h.play(2000, 0.4);
    const b = scene.frames.at(-1)!;
    expect(b.pose).toEqual(a.pose);
    h.play(500, 0);
    expect(scene.frames.at(-1)!.pose.spin).not.toBe(a.pose.spin);
  });

  it('un scroll durante la aparición la adelanta al reposo; antes de la escena, nace en reposo', async () => {
    const h = setup();
    h.c.start();
    await h.sceneReady();
    h.play(APPEAR / 3);
    h.c.skip();
    h.c.skip();
    expect(h.c.phase).toBe('paused');
    expect(h.rests).toEqual(['skipped']);
    const g = setup();
    g.c.start();
    g.c.skip();
    expect(g.c.phase).toBe('paused');
    const scene = await g.sceneReady();
    g.play(100);
    expect(scene.frames.some((f) => f.act === 'appear')).toBe(false);
    expect(g.rests).toEqual(['skipped']);
    expectInvariants(h);
    expectInvariants(g);
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

  it('«Zarpar» durante la aparición: al reposo y se zambulle', async () => {
    const h = setup();
    h.c.start();
    await h.sceneReady();
    h.play(APPEAR / 2);
    expect(h.c.enter()).toBe(true);
    expect(h.rests).toEqual(['skipped']);
    h.play(LAND + 50);
    expect(h.landed).toEqual(['played']);
    expectInvariants(h);
  });

  it('«Zarpar» sin escena (aún cargando) o desde la cabecera: un fundido al velo, al juego', async () => {
    for (const how of ['loading', 'header'] as const) {
      const h = setup();
      if (how === 'loading') h.c.start();
      else await h.toPause();
      expect(h.c.enter(how === 'header' ? 'header' : 'button')).toBe(true);
      const frames: IntroFrame[] = [];
      for (let t = 0; t < CFG.reduced.fadeMs + 100; t += 16) {
        h.advance(16);
        const f = h.c.render(VP, 0);
        if (f) frames.push(f);
      }
      expect(h.landed).toEqual(['played']);
      expect(frames.at(-1)!.cover).toBe(1);
      expect(h.moves(frames)).toBe(0);
      expect(h.c.playedMs!).toBeLessThan(LAND);
      expectInvariants(h);
    }
  });

  it('Escape / cambio de ancla en reposo: nada cambia ni se duplica', async () => {
    const h = setup();
    await h.toPause();
    h.c.skip(); // popstate
    h.c.skip(); // hashchange justo después
    h.c.interrupt(); // vuelta desde la caché del navegador
    h.c.start();
    expect(h.c.phase).toBe('paused');
    expect(h.rests).toEqual(['played']);
    expect(h.landed).toEqual([]);
    expectInvariants(h);
  });

  it('pestaña oculta en la aparición: al volver, reposo con título y botón (no zarpa sola)', async () => {
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

  it('pestaña oculta durante «Zarpar»: termina, rumbo al juego', async () => {
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
    expect(scene.frames.filter((f) => f.act === 'landing').length).toBeGreaterThan(0);
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

  it('cambio de ruta en reposo o durante «Zarpar»: se destruye una vez y no queda escena', async () => {
    for (const during of ['paused', 'landing'] as const) {
      const h = setup();
      const scene = await h.toPause();
      if (during === 'landing') {
        h.c.enter();
        h.play(LAND / 2);
      }
      h.c.destroy();
      h.c.destroy();
      h.c.enter();
      h.advance(60_000);
      expect(scene.destroyed).toBe(1);
      expect(h.c.worldsAlive).toBe(0);
      expect(h.c.phase).toBe('destroyed');
      expect(h.pending()).toBe(0);
      expect(h.landed).toEqual([]);
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

  it('una escena que no llega en el plazo: la versión estática; si llega luego, se descarta', async () => {
    const h = setup();
    h.c.start();
    h.advance(BUDGET);
    expect(h.c.fallback).toBe(true);
    expect(h.c.phase).toBe('paused');
    expect(h.rests).toEqual(['none']);
    const scene = await h.sceneReady();
    expect(scene.destroyed).toBe(1);
    expect(h.c.worldsAlive).toBe(0);
    h.play(50);
    expect(scene.frames).toEqual([]);
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
    expect(h.c.fallback).toBe(false);
    expect(h.c.phase).toBe('waiting');
    h.advance(1);
    expect(h.c.fallback).toBe(true);
    expect(h.rests).toEqual(['none']);
    expectInvariants(h);
  });

  it('motor que falla: la versión estática, sin escena', async () => {
    const h = setup();
    h.c.start();
    await h.sceneFails();
    expect(h.c.phase).toBe('paused');
    expect(h.c.fallback).toBe(true);
    expect(h.c.sceneStatus).toBe('failed');
    expect(h.c.worldsAlive).toBe(0);
    expect(h.rests).toEqual(['none']);
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

  it('movimiento reducido: la versión estática, sin escena; «Zarpar» es un fundido (REQ-ENT-010)', async () => {
    const h = setup('reduced');
    h.c.start();
    expect(h.c.phase).toBe('paused');
    expect(h.c.fallback).toBe(true);
    expect(h.rests).toEqual(['none']);
    expect(h.createScene).not.toHaveBeenCalled();
    expect(h.c.render(VP, 1, 2)).toBeNull();
    expect(h.c.enter()).toBe(true);
    const frames: IntroFrame[] = [];
    for (let t = 0; t < CFG.reduced.fadeMs + 100; t += 16) {
      h.advance(16);
      const f = h.c.render(VP, 0);
      if (f) frames.push(f);
    }
    expect(h.landed).toEqual(['played']);
    expect(h.c.toGame).toBe(true);
    expect(frames.find((f) => f.done)!.cover).toBe(1);
    expect(h.moves(frames)).toBe(0);
    expectInvariants(h, 0);
  });

  it('una visita directa nace en reposo, sin aparición; con movimiento reducido del sistema no gira', async () => {
    const h = setup('direct', { still: true });
    h.c.start();
    expect(h.c.phase).toBe('paused');
    expect(h.rests).toEqual(['none']);
    const scene = await h.sceneReady();
    h.play(2000);
    expect(scene.frames.some((f) => f.act === 'appear')).toBe(false);
    expect(h.moves(scene.frames)).toBe(0);
    const g = setup('direct');
    g.c.start();
    const moving = await g.sceneReady();
    g.play(2000);
    expect(g.moves(moving.frames)).toBeGreaterThan(0);
  });
});
