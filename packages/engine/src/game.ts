import {
  type BottleMarker,
  type Direction,
  type SeaPalette,
  type Vec2,
  type WorldConfig,
  GROUND_Y_SCALE,
  artFrames,
  coastAssets,
  worldToScreen,
} from '@boia/world';
import type { Application} from 'pixi.js';
import { Container } from 'pixi.js';
import { BottleLayer } from './bottles/view';
import { Camera } from './camera';
import {
  type KeyboardMode,
  KeyboardControls,
  TouchControls,
  readShipInput,
} from './input/controls';
import { bindInput } from './input/dom';
import { FixedStepLoop, lerp } from './loop';
import type { LoadedShipManifest } from './manifest-loader';
import { wrapAngle } from './math';
import { DEFAULT_SHIP_CONFIG, type ShipConfig } from './ship/config';
import {
  type CircleObstacle,
  type ShipState,
  createShipState,
  shipSpeed,
  stepShip,
} from './ship/controller';
import { type CrewArt, ShipSprite } from './ship/view';
import { newApplication } from './pixi-app';
import { WorldSwitcher } from './transition/switcher';
import type { SwitchMode } from './transition/timeline';
import { VortexView } from './transition/vortex-view';
import { JoystickOverlay, WakeView } from './views';
import { WakeSystem } from './wake';
import { Water } from './water';
import { artKey } from './world/art-plan';
import { type AtlasIndex, parseAtlasIndex } from './world/atlas-index';
import { type ArtUrl, type FrameLoader, loadArt, loadTextures } from './world/assets';
import { BubbleView } from './world/bubble';
import { createWorldCoastView } from './world/coast-view';
import type { WorldEvent } from './world/events';
import { MemoryRewardStore } from './world/rewards';
import {
  type ObjectRuntimeState,
  type RuntimeOptions,
  WorldRuntime,
  solidObstaclesOf,
} from './world/runtime';
import { type QualityTier, detectQuality, lookaheadPoints, viewExtent } from './world/sectors';
import { SectorStreamer } from './world/streamer';
import { TextureStore } from './world/texture-store';
import { bubbleAnchor, shipArtScale } from './world/visual';

export interface GameOptions {
  world: WorldConfig;
  /** Sprites del encargo 01. Sin él (o si falla), barco provisional. */
  manifest?: LoadedShipManifest | null;
  ship?: Partial<ShipConfig>;
  /**
   * Dónde están los manifiestos del arte del mundo. Sin valor, `/api/art`
   * (D-16); `null`, sin arte: todo con marcadores.
   */
  artUrl?: ArtUrl | null;
  /** Opciones del motor de comportamientos (temporada, sesión, recompensas…). */
  runtime?: RuntimeOptions;
  /** Colores del mar del mundo (T17). Sin valor, los de la demo. */
  sea?: SeaPalette;
  /** Cada evento del mundo, en orden, una vez por imagen. */
  onWorldEvent?: (e: WorldEvent) => void;
  /** Se llama ~4 veces por segundo con los datos del HUD. */
  onStats?: (s: GameStats) => void;
  /**
   * Cada paso fijo de la simulación (60 por segundo), después de mover el
   * barco y el mundo: para encuentros guionizados desde fuera (la misión de
   * la Fiestera, T21). No debe hacer trabajo pesado.
   */
  onStep?: (ship: Readonly<ShipState>, dt: number) => void;
  /** Modo del teclado (D-14); por defecto, dirección de pantalla. */
  keyboardMode?: KeyboardMode;
  /**
   * Superficie ya creada que el juego adopta en vez de crear otra: la de la
   * entrada al pulsar EXPLORAR (REQ-ENT-012). El mismo canvas, el mismo
   * contexto WebGL y el mismo mar siguen en pantalla; el juego vacía el
   * escenario y pinta su mundo encima. `canvas` debe ser `surface.app.canvas`.
   */
  surface?: GameSurface | null;
  /** Arte de las botellas (T22); sin valor, el marcador por código. */
  bottleAsset?: string;
  /**
   * Dónde empieza el barco (y lo primero que se carga, T47). Sin valor, el
   * `spawn` del mundo. Siempre en agua navegable, como `moveShip`.
   */
  start?: { x: number; y: number; heading?: number } | null;
  /** Puntos que se cargan también antes de jugar (el destino de una llegada). */
  preload?: readonly Vec2[];
  /**
   * URL del índice de atlas por sector (`tools/atlas`). Sin valor o `null`,
   * sin atlas: cada PNG de `/api/art`.
   */
  atlas?: string | null;
  /** Calidad del arte; sin valor, según el dispositivo (`detectQuality`). */
  quality?: QualityTier | null;
  /**
   * Empieza (`mode`) o termina (`null`) un cambio de mundo (T41): mientras
   * dura, la entrada del motor está bloqueada y el barco quieto.
   */
  onSwitch?: (mode: SwitchMode | null) => void;
}

/** Aplicación Pixi viva (y su mar) que otra escena cede al juego. */
export interface GameSurface {
  app: Application;
  water?: Water;
}

export interface GameStats {
  fps: number;
  /** u/s */
  speed: number;
  drifting: boolean;
  direction: Direction;
  x: number;
  y: number;
  /** Rumbo del casco en el plano del agua (rad). */
  heading: number;
  shipSource: 'manifest' | 'provisional';
  /** Multiplicador de velocidad por efectos (ralentizar, boost). */
  speedFactor: number;
  /** Carga por sectores (T47): sectores pedidos, vistas cargando y calidad. */
  sectors: string[];
  artLoading: number;
  quality: QualityTier;
  /** Fotogramas pintados con algún objeto a la vista sin su arte (debe quedarse en 0). */
  artMissingFrames: number;
  /**
   * Dónde queda en pantalla el origen del mundo (px): un punto del mundo se
   * ve en `worldToScreen(p) + view`. Para comprobar que un cambio de mundo
   * deja cada lugar en su sitio (T41).
   */
  view: { x: number; y: number };
}

export interface Game {
  stats(): GameStats;
  readonly runtime: WorldRuntime;
  /**
   * Cambia de mundo en caliente (T17): otro `WorldConfig` sobre el mismo mapa
   * compartido. El barco sigue donde está, con su rumbo y su pasajera; las
   * recompensas ya concedidas siguen concedidas (van por id de lugar, con el
   * mismo almacén). `sea` pone los colores del mar del mundo nuevo. Resuelve
   * `true` si quedó el pedido y `false` si otra petición lo adelantó.
   *
   * Con transición (T41): el mundo cae a un agujero negro centrado en el
   * barco, se cambia a oscuras con el arte de alrededor ya cargado y el nuevo
   * se despliega desde el mismo punto (`vortex`, por defecto); con movimiento
   * reducido, un fundido de 300 ms (`fade`). Resuelve al cambiar (a oscuras);
   * `switching` dice si la transición sigue.
   */
  setWorld(
    world: WorldConfig,
    opts?: { sea?: SeaPalette; transition?: SwitchMode },
  ): Promise<boolean>;
  /** Hay un cambio de mundo en curso: entrada bloqueada (T41). */
  readonly switching: boolean;
  /**
   * Pone el barco en (x, y), parado, en el agua navegable más cercana (nunca
   * en tierra, como TELETRANSPORTE). Para empezar junto a un lugar
   * (`/juego?cerca=`) y para las pruebas. Devuelve dónde quedó.
   */
  moveShip(x: number, y: number, heading?: number): { x: number; y: number };
  /** Bocadillo: siguiente línea (o cierra la última). */
  advanceDialogue(): void;
  /** Bocadillo: cierra el diálogo entero. */
  skipDialogue(): void;
  /** Slot TRIPULANTE del barco (Boia Fiestera a bordo). */
  setPassenger(on: boolean): void;
  /** Si el slot TRIPULANTE está ocupado. */
  readonly hasPassenger: boolean;
  /**
   * Arte de la tripulante: la pieza `tripulante` del mundo
   * (`mundos/<mundo>/<lugar>#tripulante`, T18), animada sobre el slot del
   * barco que se lleve. `null` vuelve a la figura del barco. Resuelve `true`
   * si quedó puesto.
   */
  setCrewArt(assetId: string | null): Promise<boolean>;
  /** Cambia el modo del teclado en caliente (D-14). */
  setKeyboardMode(mode: KeyboardMode): void;
  /**
   * Cambia el aspecto del barco en caliente (estilo o skin): mismo barco en
   * el agua, misma posición, rumbo y pasajera. `null` pone el provisional.
   * Resuelve `true` si quedó el pedido y `false` si no cargó (se queda el de antes).
   */
  setShip(manifest: LoadedShipManifest | null): Promise<boolean>;
  /**
   * Botellas en el agua (T22): pinta exactamente éstas, sin tocar el mundo
   * ni su estado. No colisionan; leerlas lo decide la interfaz.
   */
  setBottles(bottles: readonly BottleMarker[]): Promise<void>;
  /**
   * Carga ya el arte alrededor de esos puntos (T47) y lo retiene hasta que el
   * barco pase cerca o pasen 30 s: el destino de una llegada o de un viaje.
   */
  preload(points: readonly Vec2[]): Promise<void>;
  /** true si el juego adoptó una superficie existente en vez de crear la suya. */
  readonly adoptedSurface: boolean;
  destroy(): void;
}

/** Color del mar bajo el agua animada (el mismo que el fondo de /juego). */
const SEA_COLOR = 0x0f5f7d;

/** px de tierra que la cámara deja ver bajo el borde inferior del mundo. muestra */
const BOTTOM_LAND_PX = 56;

/**
 * u que se considera salto (no navegación) de un fotograma a otro: tras uno,
 * la imagen se queda quieta hasta que el arte del destino está (T47). muestra
 */
const TELEPORT_DISTANCE = 1500;
/** Como mucho, lo que se espera al arte tras un salto. muestra */
const HOLD_MAX_MS = 2500;
/** s que se retiene un punto de `preload` si el barco no pasa cerca. muestra */
const PIN_SECONDS = 30;

/** Índice de atlas, o `null` si no hay (sin aviso: los PNG sueltos bastan). */
async function loadAtlasIndex(url: string): Promise<AtlasIndex | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return parseAtlasIndex(await res.json());
  } catch {
    return null;
  }
}

/** Tamaño máximo de textura del contexto WebGL, si se puede leer. */
function maxTextureSize(app: Application): number | undefined {
  const gl = (app.renderer as unknown as { gl?: WebGLRenderingContext }).gl;
  const v: unknown = gl?.getParameter(gl.MAX_TEXTURE_SIZE);
  return typeof v === 'number' ? v : undefined;
}

function deviceQuality(app: Application | null): QualityTier {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return detectQuality({
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    saveData: nav.connection?.saveData,
    touch: nav.maxTouchPoints > 0,
    maxTextureSize: app ? maxTextureSize(app) : undefined,
  });
}

/** Obstáculos sólidos del mundo: objetos activos con una COLISIÓN sólida del catálogo. */
export function obstaclesFromWorld(world: WorldConfig): CircleObstacle[] {
  return solidObstaclesOf(world);
}

export async function createGame(canvas: HTMLCanvasElement, opts: GameOptions): Promise<Game> {
  const cfg: ShipConfig = { ...DEFAULT_SHIP_CONFIG, ...opts.ship };
  let world = opts.world;
  // Un solo almacén de recompensas para todos los mundos de la partida: el
  // progreso va por id de lugar y sobrevive al cambio de mundo.
  const runtimeOpts: RuntimeOptions = {
    ...opts.runtime,
    rewards: opts.runtime?.rewards ?? new MemoryRewardStore(),
  };
  let runtime = new WorldRuntime(world, runtimeOpts);
  const worldSpawn = world.spawn ?? {
    x: (world.bounds.left + world.bounds.right) / 2,
    y: world.bounds.bottom - 200,
    heading: -Math.PI / 2,
  };
  const startAt = opts.start
    ? runtime.safePoint(opts.start.x, opts.start.y, cfg.radius)
    : worldSpawn;
  const spawn = {
    x: startAt.x,
    y: startAt.y,
    heading: opts.start?.heading ?? worldSpawn.heading,
  };
  const atlasIndex = opts.atlas ? loadAtlasIndex(opts.atlas) : Promise.resolve(null);
  let quality: QualityTier = opts.quality ?? deviceQuality(null);

  const surface = opts.surface ?? null;
  let app: Application;
  if (surface) {
    // La entrada cede su aplicación: se quita lo suyo y el juego sigue en el mismo canvas.
    app = surface.app;
    for (const c of app.stage.removeChildren()) {
      if (c !== surface.water?.view) c.destroy({ children: true });
    }
    app.renderer.background.color = SEA_COLOR;
    app.resizeTo = canvas.parentElement ?? window;
    app.resize();
  } else {
    app = newApplication();
    await app.init({
      canvas,
      resizeTo: canvas.parentElement ?? window,
      antialias: true,
      autoDensity: true,
      // Calidad baja: sin retina (un cuarto de píxeles que pintar).
      resolution: quality === 'baja' ? 1 : Math.min(window.devicePixelRatio || 1, 2),
      background: SEA_COLOR,
    });
  }

  // Con el contexto WebGL ya creado se sabe también su tamaño máximo de textura.
  if (!opts.quality) quality = deviceQuality(app);

  const ship: ShipState = createShipState(spawn.x, spawn.y, spawn.heading);
  const prev: ShipState = { ...ship };

  let sprite =
    (opts.manifest ? await ShipSprite.fromManifest(opts.manifest, ship.heading) : null) ??
    ShipSprite.provisional(ship.heading);

  // Arte del mundo a la escala del barco (T01: misma densidad de píxeles).
  const artScale = opts.manifest?.displayScale ?? shipArtScale(opts.manifest?.manifest);
  const index = await atlasIndex;
  const extent = () => viewExtent(app.screen.width, app.screen.height);
  /**
   * Centro de la pantalla (en u de mundo) con la cámara sobre `p`. Junto al
   * borde de abajo no coinciden: la cámara no baja más que una franja de
   * tierra, así que por arriba asoma más mundo del que rodea al barco (en
   * una pantalla ancha, la boia de «Espacio» sobre el puerto). Se carga
   * también alrededor de ese centro.
   */
  const screenCenterFor = (p: Vec2, bottom: number): Vec2 => {
    const s = worldToScreen(p);
    const maxY = worldToScreen({ x: 0, y: bottom }).y + BOTTOM_LAND_PX - app.screen.height / 2;
    return { x: s.x, y: Math.min(s.y, maxY) / GROUND_Y_SCALE };
  };
  /**
   * Un mundo listo para pintar alrededor de `at` (T47): sus costas enteras y
   * el arte de los sectores y objetos a la vista; lo demás llega por el camino.
   */
  const buildWorld = async (w: WorldConfig, rt: WorldRuntime, at: readonly Vec2[]) => {
    const atlas = index?.worlds[w.id] ?? null;
    const store = new TextureStore(atlas, opts.atlas ?? '');
    const streamer = new SectorStreamer({
      world: w,
      artUrl: opts.artUrl,
      artScale,
      tier: quality,
      store,
      atlas,
    });
    const load: FrameLoader = async (a, files) =>
      (
        await store.frames(
          files.map((f) => ({ key: artKey(a.base, f), url: new URL(f, a.baseUrl).href })),
        )
      ).textures;
    const coastArt =
      opts.artUrl === null ? new Map() : await loadArt(coastAssets(w.coast), opts.artUrl);
    const [coasts] = await Promise.all([
      createWorldCoastView(w.bounds, w.coast, coastArt, artScale, load),
      streamer.settle(at, extent(), rt.objectStates()),
    ]);
    return {
      streamer,
      coasts,
      destroy() {
        streamer.destroy();
        coasts.destroy({ children: true });
        store.destroy();
      },
    };
  };
  let built = await buildWorld(world, runtime, [
    spawn,
    screenCenterFor(spawn, world.bounds.bottom),
    ...(opts.preload ?? []),
  ]);
  let coasts = built.coasts;

  const water = surface?.water ?? new Water(opts.sea);
  // La superficie adoptada trae el mar de la entrada: toma los colores de este mundo.
  if (surface?.water && opts.sea) water.setPalette(opts.sea);
  // El mar de la entrada llega con su escala y su fundido: vuelve a escala de juego.
  water.view.scale.set(1);
  water.view.alpha = 1;
  water.view.visible = true;
  const worldLayer = new Container();
  const wakeView = new WakeView();
  const objects = new Container();
  objects.sortableChildren = true;
  worldLayer.addChild(coasts, wakeView.view, objects);
  built.streamer.attach(objects);
  objects.addChild(sprite.view);
  const bottles = new BottleLayer(objects, {
    artScale,
    ...(opts.bottleAsset ? { asset: opts.bottleAsset } : {}),
    ...(opts.artUrl !== undefined ? { artUrl: opts.artUrl } : {}),
  });

  const touch = new TouchControls();
  const keys = new KeyboardControls(opts.keyboardMode);
  const joystick = new JoystickOverlay(touch.cfg.radius);
  const bubble = new BubbleView();
  // Lo que cae al agujero negro al cambiar de mundo (T41): el mar y el mundo.
  const scene = new Container();
  scene.addChild(water.view, worldLayer);
  app.stage.addChild(scene, bubble.view, joystick.view);
  canvas.style.touchAction = 'none';

  /** Un mundo en escena: su configuración, su runtime y lo que pinta. */
  interface WorldScene {
    world: WorldConfig;
    runtime: WorldRuntime;
    built: Awaited<ReturnType<typeof buildWorld>>;
    sea: SeaPalette | undefined;
    destroy(): void;
  }
  const vortex = new VortexView(app, scene);
  const switcher = new WorldSwitcher<WorldScene>({
    swap(next) {
      // Con fundido, la foto del mundo de antes se queda encima y se desvanece.
      if (switcher.timeline.mode === 'fade') vortex.takeSnapshot();
      // Lo que el mundo de antes tenía pendiente sale antes del cambio.
      for (const e of runtime.drainEvents()) opts.onWorldEvent?.(e);
      worldLayer.removeChild(coasts);
      built.destroy();
      built = next.built;
      coasts = next.built.coasts;
      worldLayer.addChildAt(coasts, 0);
      next.built.streamer.attach(objects);
      world = next.world;
      runtime = next.runtime;
      if (next.sea) water.setPalette(next.sea);
    },
  });
  let switchingMode: SwitchMode | null = null;

  const onBubble = (x: number, y: number) => {
    if (switcher.locked) return false;
    const h = bubble.hit(x, y);
    if (h === 'advance') runtime.advanceDialogue();
    else if (h === 'skip') runtime.skipDialogue();
    return h !== null;
  };
  const unbind = bindInput(canvas, touch, keys, onBubble);
  // Teclado: Espacio o Intro avanzan el bocadillo; Escape lo salta.
  const onKey = (e: KeyboardEvent) => {
    if (switcher.locked || !runtime.dialogue()) return;
    if (e.code === 'Space' || e.code === 'Enter') runtime.advanceDialogue();
    else if (e.code === 'Escape') runtime.skipDialogue();
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);

  const loop = new FixedStepLoop(60);
  const camera = new Camera(ship.x, ship.y);
  const wake = new WakeSystem();
  let time = 0;
  let frames = 0;
  let fpsWindow = 0;
  let fps = 0;
  let statsTimer = 0;
  // Carga por sectores (T47): velocidad vista en pantalla (también la de los
  // viajes y llegadas, que mueven el barco con `moveShip`), puntos retenidos,
  // espera tras un salto y fotogramas con arte ausente.
  const seen = { x: ship.x, y: ship.y, vx: 0, vy: 0 };
  let pins: { at: Vec2; until: number }[] = (opts.preload ?? []).map((at) => ({
    at,
    until: performance.now() + PIN_SECONDS * 1000,
  }));
  let hold: { until: number; done: boolean } | null = null;
  let artMissingFrames = 0;

  const stats = (): GameStats => ({
    fps,
    speed: shipSpeed(ship),
    drifting: ship.drifting,
    direction: sprite.direction,
    x: ship.x,
    y: ship.y,
    heading: ship.heading,
    shipSource: sprite.source,
    speedFactor: runtime.speedFactor(),
    sectors: built.streamer.status().sectors,
    artLoading: built.streamer.status().loading,
    quality,
    artMissingFrames,
    view: { x: worldLayer.position.x, y: worldLayer.position.y },
  });

  const simulate = (dt: number) => {
    Object.assign(prev, ship);
    const input = readShipInput(touch, keys, ship.heading);
    stepShip(ship, input, runtime.shipConfig(cfg), dt);
    runtime.step(ship, cfg, dt);
    opts.onStep?.(ship, dt);
    const o = sprite.wakeOriginOffset();
    wake.update(dt, {
      x: ship.x + o.x,
      y: ship.y + o.y,
      heading: ship.heading,
      speed: shipSpeed(ship),
      maxSpeed: cfg.maxSpeed,
      drifting: ship.drifting,
    });
  };

  /** Pide el arte de lo que se ve y de lo que viene; suelta lo lejano. */
  const streamWorld = (
    rx: number,
    ry: number,
    dt: number,
    states: ObjectRuntimeState[],
    center: Vec2,
  ) => {
    const dx = rx - seen.x;
    const dy = ry - seen.y;
    if (dt > 0 && Math.hypot(dx, dy) < TELEPORT_DISTANCE) {
      const k = Math.min(1, dt * 4);
      seen.vx += (dx / dt - seen.vx) * k;
      seen.vy += (dy / dt - seen.vy) * k;
    } else {
      seen.vx = 0;
      seen.vy = 0;
    }
    seen.x = rx;
    seen.y = ry;
    const view = extent();
    const now = performance.now();
    pins = pins.filter(
      (p) => now < p.until && (Math.abs(p.at.x - rx) > view.hx || Math.abs(p.at.y - ry) > view.hy),
    );
    const points = [
      ...lookaheadPoints(
        { x: rx, y: ry },
        { x: seen.vx, y: seen.vy },
        built.streamer.tuning.lookahead,
      ),
      ...pins.map((p) => p.at),
      center,
    ];
    built.streamer.update(points, view, states);
  };

  const frame = () => {
    // Tras un salto, la imagen se queda quieta hasta que el arte del destino está.
    if (hold) {
      if (!hold.done && performance.now() < hold.until) return;
      hold = null;
    }
    const dt = app.ticker.deltaMS / 1000;
    time += dt;
    // Cambio de mundo (T41): el barco se queda quieto y la entrada no cuenta.
    const free = switcher.advance(app.ticker.deltaMS);
    const alpha = free ? loop.advance(dt, simulate) : 1;
    const mode = switcher.locked ? switcher.timeline.mode : null;
    if (mode !== switchingMode) {
      switchingMode = mode;
      opts.onSwitch?.(mode);
    }
    for (const e of runtime.drainEvents()) opts.onWorldEvent?.(e);

    const rx = lerp(prev.x, ship.x, alpha);
    const ry = lerp(prev.y, ship.y, alpha);
    const rh = prev.heading + wrapAngle(ship.heading - prev.heading) * alpha;
    camera.update(rx, ry, ship.vx, ship.vy, dt);

    const w = app.screen.width;
    const h = app.screen.height;
    const cam = worldToScreen(camera);
    // El borde inferior es tierra: la cámara no enseña más que una franja.
    cam.y = Math.min(
      cam.y,
      worldToScreen({ x: 0, y: world.bounds.bottom }).y + BOTTOM_LAND_PX - h / 2,
    );
    const ox = Math.round(w / 2 - cam.x);
    const oy = Math.round(h / 2 - cam.y);
    worldLayer.position.set(ox, oy);
    water.update(w, h, cam.x - w / 2, cam.y - h / 2, time);

    bottles.animate(time);
    const states = runtime.objectStates();
    const center = { x: cam.x, y: cam.y / GROUND_Y_SCALE };
    streamWorld(rx, ry, dt, states, center);
    for (const s of states) {
      const v = built.streamer.view(s.id);
      if (!v) continue;
      v.sync(s);
      v.animate(time);
    }
    if (built.streamer.missingOnScreen(center, extent(), states) > 0) artMissingFrames++;

    const sp = worldToScreen({ x: rx, y: ry });
    sprite.view.position.set(sp.x, sp.y);
    sprite.view.zIndex = ry;
    sprite.update(rh, time, shipSpeed(ship));
    wakeView.sync(wake, sprite.wakeTint);

    const d = runtime.dialogue();
    const speaker = d ? built.streamer.view(d.objectId) : undefined;
    const st = d ? runtime.objectState(d.objectId) : undefined;
    if (d && speaker && st && free) {
      const a = bubbleAnchor(speaker.visual);
      const p = worldToScreen(st);
      bubble.show(d, ox + p.x + a.x, oy + p.y + a.y, w);
    } else {
      bubble.show(null, 0, 0, w);
    }
    joystick.draw(free ? touch.view() : null, ship.drifting);
    // El agujero, centrado en el barco (en su sitio de pantalla).
    vortex.apply(switcher.timeline.pose(), { x: ox + sp.x, y: oy + sp.y });

    frames++;
    fpsWindow += dt;
    if (fpsWindow >= 0.5) {
      fps = frames / fpsWindow;
      frames = 0;
      fpsWindow = 0;
    }
    statsTimer += dt;
    if (opts.onStats && statsTimer >= 0.25) {
      statsTimer = 0;
      opts.onStats(stats());
    }
  };
  app.ticker.add(frame);
  // La superficie adoptada llega con el reloj parado (la entrada pinta a demanda).
  if (surface) app.start();

  let destroyed = false;
  let shipRequest = 0;
  let crewRequest = 0;
  return {
    stats,
    get runtime() {
      return runtime;
    },
    setWorld(next, worldOpts = {}) {
      if (destroyed) return Promise.resolve(false);
      // El mundo nuevo se carga mientras el de antes cae: el arte del sector
      // del barco está antes de que el vórtice se abra (T47).
      return switcher.switchTo(async () => {
        const rt = new WorldRuntime(next, runtimeOpts);
        const b = await buildWorld(next, rt, [
          { x: ship.x, y: ship.y },
          screenCenterFor(ship, next.bounds.bottom),
        ]);
        return { world: next, runtime: rt, built: b, sea: worldOpts.sea, destroy: b.destroy };
      }, worldOpts.transition ?? 'vortex');
    },
    get switching() {
      return switcher.locked;
    },
    moveShip(x, y, heading) {
      const p = runtime.safePoint(x, y, cfg.radius);
      if (Math.hypot(p.x - ship.x, p.y - ship.y) >= TELEPORT_DISTANCE) {
        // Un salto: la imagen espera al arte del destino (como mucho HOLD_MAX_MS).
        const h = { until: performance.now() + HOLD_MAX_MS, done: false };
        hold = h;
        const at = [p, screenCenterFor(p, world.bounds.bottom)];
        void built.streamer.settle(at, extent(), runtime.objectStates()).then(() => {
          h.done = true;
        });
      }
      ship.x = p.x;
      ship.y = p.y;
      ship.vx = 0;
      ship.vy = 0;
      if (heading !== undefined) ship.heading = heading;
      Object.assign(prev, ship);
      camera.x = ship.x;
      camera.y = ship.y;
      return p;
    },
    advanceDialogue: () => void runtime.advanceDialogue(),
    skipDialogue: () => void runtime.skipDialogue(),
    setPassenger: (on) => sprite.setPassenger(on),
    get hasPassenger() {
      return sprite.hasPassenger;
    },
    async setCrewArt(assetId) {
      const request = ++crewRequest;
      let art: CrewArt | null = null;
      if (assetId && opts.artUrl !== null) {
        try {
          const loaded = (await loadArt([assetId], opts.artUrl)).get(assetId);
          const m = loaded?.manifest;
          const pivot = m?.pivot_px ?? m?.anchors.pivot;
          if (loaded && m && pivot) {
            const anim = Object.keys(m.animations)[0];
            const f = artFrames(m, anim);
            const frames = await loadTextures(loaded.baseUrl, f.files);
            if (frames.length > 0) art = { frames, fps: f.fps || 8, pivot, scale: artScale };
          }
        } catch (err) {
          console.warn(`[boia] arte de la tripulante «${assetId}» no disponible`, err);
        }
      }
      if (destroyed || request !== crewRequest) return false;
      sprite.setCrewArt(art);
      return art !== null || assetId === null;
    },
    setKeyboardMode: (mode) => {
      keys.mode = mode;
    },
    adoptedSurface: surface !== null,
    async setShip(manifest) {
      const request = ++shipRequest;
      const next = manifest
        ? await ShipSprite.fromManifest(manifest, ship.heading)
        : ShipSprite.provisional(ship.heading);
      // Otra petición más nueva, o el juego ya no existe: ésta no se aplica.
      if (!next || destroyed || request !== shipRequest) {
        next?.view.destroy({ children: true });
        return false;
      }
      next.setPassenger(sprite.hasPassenger);
      next.setCrewArt(sprite.crewArtInUse);
      next.update(ship.heading, time, shipSpeed(ship));
      next.view.position.copyFrom(sprite.view.position);
      next.view.zIndex = sprite.view.zIndex;
      const old = sprite;
      objects.addChild(next.view);
      objects.removeChild(old.view);
      // Las texturas se quedan en la caché de Assets: volver a un estilo es inmediato.
      old.view.destroy({ children: true });
      sprite = next;
      return true;
    },
    setBottles: (list) => (destroyed ? Promise.resolve() : bottles.set(list)),
    preload(points) {
      const until = performance.now() + PIN_SECONDS * 1000;
      pins = [...pins, ...points.map((at) => ({ at, until }))];
      return built.streamer.settle(points, extent(), runtime.objectStates());
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unbind();
      window.removeEventListener('keydown', onKey);
      app.ticker.remove(frame);
      switcher.destroy();
      vortex.destroy();
      built.destroy();
      app.destroy({ removeView: false }, { children: true });
    },
  };
}
