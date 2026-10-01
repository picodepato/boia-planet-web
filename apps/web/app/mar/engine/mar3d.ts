import {
  type DialogueView,
  DEFAULT_SHIP_CONFIG,
  IDLE_INPUT,
  type RuntimeOptions,
  type ShipConfig,
  type ShipInput,
  type ShipState,
  type SwitchMode,
  type WorldEvent,
  WorldRuntime,
  WorldSwitcher,
  createShipState,
  shipSpeed,
  stepShip,
} from '@boia/engine/headless';
import type { MissionHost } from '@boia/engine/mission';
import type { WorldConfig, WorldObject } from '@boia/world';
import type { Color, ShaderMaterial } from 'three';
import {
  Box3,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Frustum,
  Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Sphere,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  type Boat,
  type FaceTextures,
  chestGeometry,
  createBoat,
  createCoin,
  createCroc,
  createDolphin,
  createFaceTextures,
  createJelly,
  createMascot,
  debrisGeometry,
  litMaterial,
} from './characters';
import { fromScene, toScene } from './compress';
import { FOCUS_RATE, lookAhead, startZoom } from './framing';
import { buildDecor } from './decor';
import type { ShipDressing } from '../../../lib/barco/dressing';
import { Clouds, Confetti, CourseMarker, RouteLine, Wake, glowPoints, whirlpool } from './effects';
import {
  FLIGHT,
  FlightClouds,
  type FlightPlan,
  type FlightPose,
  Sparks,
  Splash,
  Wings,
  flightPlan,
  flightPose,
} from './flight';
import {
  type IslandBuild,
  amphora,
  buildIsland,
  buildSandbank,
  sleepingRing,
  textTexture,
} from './islands';
import { Kit, clamp01, lerp, rng, seedOf, smooth } from './kit';
import { type SeaRoute, decorSpots, seaRoute } from './compact';
import { C, type Mood, type MoodId, cloneMood, mixMood, moods } from './palette';
import { Sky, curveMaterial, curveTree, planetUniforms } from './planet';
import { Glows, buoy, crag, rock } from './props';
import { type ShipModel, createFlag, modelLength, topPoint } from './ship-model';
import { type ModelKey, ModelStore, fitHeight, modelFor, modelSlot, planModels } from './models';
import { VortexPass } from './vortex';
import { createWater } from './water';
import {
  type Circle,
  type Period,
  behindPlanet,
  bendDrop,
  periodOf,
  planetRect,
  pushOut,
  rayOnPlanet,
  steer,
  wrapD,
  wrapIn,
} from './wrap';

/** Rectángulo en unidades de escena. */
interface SceneRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * El mar 3D: three.js sobre el mismo `WorldRuntime` que /juego. Aquí sólo
 * vive la vista y el control: cámara con zoom continuo desde el barco hasta
 * el mapa entero, joystick táctil desde el punto tocado, pellizco y rueda,
 * rumbo por toque (piloto automático que esquiva islas), turbo y los tres
 * momentos del día. Lo que pasa en el mundo (premios, paneles, misión,
 * circuito) llega a la web por `onWorldEvent`, igual que en el 2D.
 *
 * Es un pequeño planeta de agua (D-22, REQ-MUN-038): sin costas, el mar da
 * la vuelta (el runtime con `wrap`: quien sale por un lado vuelve por el
 * opuesto y el piloto automático toma el camino más corto), la superficie se
 * curva hacia el horizonte y encima está el cielo con estrellas, que gira
 * despacio. Cada cosa se dibuja en su copia más cercana al foco de la
 * cámara; el foco nunca salta, así que la vuelta no se nota.
 */

export interface PinSpec {
  id: string;
  text: string;
  icon: string;
  /** Rótulo destacado (la isla del evento). */
  accent?: boolean;
  /** Siempre visible, también de cerca (lo que vende). */
  always?: boolean;
}

export interface Stats {
  fps: number;
  /** Nudos de juego (velocidad en u/s ÷ 10). */
  knots: number;
  zoom: number;
  mapMode: boolean;
  turbo: number;
  /** 0..1: listo cuando llega a 1. */
  turboReady: number;
  course: CourseInfo | null;
  /** Barco lejos del centro de la vista (vista de mapa desplazada). */
  panned: boolean;
  /** Lugar al que va el viaje en turbo del botón «Entradas», o null. */
  voyage: string | null;
  /** Fase del vuelo de «Entradas» (experimento), o null si no vuela. */
  flight: FlightPose['phase'] | null;
  /** Dónde está el barco (u de motor) y hacia dónde mira (rad). */
  x: number;
  y: number;
  heading: number;
  /** Modelos de Blender puestos ahora (carga por distancia, T51). */
  models: number;
}

/** Cómo terminó un viaje en turbo: llegó, tardó demasiado o el jugador tomó el timón. */
export type VoyageEnd = 'arrived' | 'timeout' | 'cancelled';

export interface CourseInfo {
  placeId: string | null;
  /** Metros de juego hasta el destino. */
  meters: number;
}

export interface Mar3DOptions {
  canvas: HTMLCanvasElement;
  overlay: HTMLElement;
  world: WorldConfig;
  runtime: RuntimeOptions;
  mood: MoodId;
  sea?: { base: string; wave: string; crest: string };
  pins: PinSpec[];
  onWorldEvent(e: WorldEvent): void;
  onStep?(ship: ShipState, dt: number): void;
  onPin?(id: string): void;
  onStats?(s: Stats): void;
  /** El barco empezó a moverse por primera vez (para quitar la ayuda). */
  onFirstMove?(): void;
  /** Terminó el viaje en turbo de `startVoyage` (REQ-ENT-040). */
  onVoyageEnd?(placeId: string, how: VoyageEnd): void;
  /** Empieza (`vortex`/`fade`) o termina (null) un cambio de mundo (T41, T51). */
  onSwitch?(mode: SwitchMode | null): void;
  /** Un golpe contra algo sólido: velocidad perdida (u/s). Para el sonido (T46). */
  onImpact?(speed: number): void;
}

/** Un mundo en el mar 3D: su configuración y su runtime (el resto no cambia, D-20.7). */
interface MarScene {
  world: WorldConfig;
  runtime: WorldRuntime;
  sea: { base: string; wave: string; crest: string } | undefined;
  destroy(): void;
}

/** Un lugar con modelo de Blender (T39), cargado por distancia (T51). */
interface ModelView {
  key: ModelKey;
  slot: Group;
  fallback: Object3D;
  model: Object3D | null;
  acquired: boolean;
}

/** s entre dos repasos de qué modelos cargar. */
const MODEL_PLAN_S = 0.3;
/** u/s perdidas de golpe a partir de las que suena y salpica un choque. muestra */
const IMPACT_MIN = 40;

/** A partir de este zoom el arrastre mueve el mapa en vez del barco. */
export const MAP_ZOOM = 0.55;
/**
 * px que sube el planeta en la vista de mapa (T50): así el puerto y el
 * final de la ruta de boyas quedan por encima de la barra de abajo.
 */
const MAP_LIFT_PX = 48;
const BOAT_ZOOM = 0.2;
/**
 * Curva del planeta (1/unidad de escena) de cerca y en la vista de mapa: la
 * superficie cae `bend · r²` con la distancia r a la cámara. De cerca se ve
 * el horizonte curvo con cielo encima; en el mapa, casi plano. muestra
 */
const BEND_NEAR = 0.0045;
/** Inclinación de la cámara de cerca (rad bajo la horizontal): deja ver el horizonte. muestra */
const ELEV_NEAR = 0.64;
const BEND_MAP = 0.00016;
/** Eslora del barco en la escena (unidades): algo mayor que la del motor, para leerse en el móvil. */
const SHIP_LENGTH = 3.9;
const STEP = 1 / 60;
const TURBO_S = 2.4;
const TURBO_COOLDOWN_S = 7;
/** Velocidad del viaje en turbo de «Entradas» (× la máxima): más que el turbo, que llegue pronto. muestra */
const VOYAGE_SPEED = 2.6;
/** Tope de un viaje en turbo: si no llega (encajonado), se da por llegado. muestra */
const VOYAGE_MAX_S = 20;
const METERS_PER_U = 0.25;
/** Zoom de la cámara mientras vuela: se aleja para ver el planeta pasar por debajo. muestra */
const FLIGHT_ZOOM = 0.34;
/** Zoom mientras levita y le salen las alas: algo más cerca que al navegar. muestra */
const TRANSFORM_ZOOM = 0.15;

interface FlightState {
  placeId: string;
  t: number;
  plan: FlightPlan;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  h0: number;
  h1: number;
  pose: FlightPose;
  /** El barco que ve el runtime mientras vuela: quieto donde despegó. */
  ghost: ShipState;
}

interface View {
  id: string;
  obj: Object3D;
  kind: string;
  /** Sitio en el mapa (escena), para los que no se mueven solos. */
  bx: number;
  bz: number;
  /** Radio y altura que ocupa (para ocultarlo tras el horizonte o fuera de la vista). */
  radius: number;
  top: number;
  /** Altura base (sobre el agua) y fase de balanceo. */
  y: number;
  phase: number;
  update?: (
    v: View,
    t: number,
    dt: number,
    present: boolean,
    x: number,
    z: number,
    h: number,
  ) => void;
  labelY: number;
  shown: number;
}

interface PinView {
  spec: PinSpec;
  el: HTMLButtonElement;
  /** Sitio en el mapa (escena) y, tras cada fotograma, su copia en pantalla (rx, rz). */
  x: number;
  z: number;
  y: number;
  rx: number;
  rz: number;
  vis: boolean;
}

interface Anchor {
  el: HTMLElement;
  target: string;
  dy: number;
}

const tmpV = new Vector3();
const tmpM = new Matrix4();
const tmpV2 = new Vector2();
const tmpSphere = new Sphere();

export class Mar3D {
  /** El mundo de ahora (cambia de piel con `setWorld`; los lugares son los mismos). */
  world: WorldConfig;
  private rt: WorldRuntime;
  readonly ship: ShipState;
  readonly missionHost: MissionHost;

  private readonly opts: Mar3DOptions;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(40, 1, 0.5, 5000);
  private readonly hemi = new HemisphereLight();
  private readonly sun = new DirectionalLight();
  private readonly sky = new Sky();
  private readonly water;
  private readonly boat: Boat;
  /** Cosméticos pintados (T40) y dónde va la bandera (null: barco provisional). */
  private dressing: ShipDressing = { flag: null, wakeTint: null };
  private mastTop: Vector3 | null = null;
  private flag: Mesh | null = null;
  private readonly faces: FaceTextures;
  private readonly wake = new Wake();
  private readonly marker = new CourseMarker();
  private readonly confetti = new Confetti();
  private readonly clouds: Clouds;
  /** La ruta de boyas (T50): las boyas en el agua y la línea que se ve en el mapa. */
  readonly route: SeaRoute;
  private readonly routeLine: RouteLine;
  private readonly glow;
  private readonly views = new Map<string, View>();
  private readonly islands: { x: number; z: number; R: number; build: IslandBuild }[] = [];
  private readonly animated: ((t: number, glow: number) => void)[] = [];
  private readonly pins: PinView[] = [];
  private readonly anchors: Anchor[] = [];
  /** El planeta: su rectángulo (escena) y su periodo en u de motor y en escena. */
  private readonly b: SceneRect;
  private readonly periodU: Period;
  private readonly periodS: Period;
  /** Decorado propio de /mar que no se atraviesa (u de motor). */
  private readonly decorSolids: Circle[] = [];
  private readonly islandRadius = new Map<string, number>();
  /** Curva actual y dónde está su centro (la cámara). */
  private bend = BEND_NEAR;
  /** Centro del mapa en la copia de la vista de mapa (se elige al alejarse). */
  private readonly mapC = new Vector2();
  private readonly frustum = new Frustum();
  // Radio de choque acorde con el barco que se ve (más grande que en el 2D).
  private readonly cfg: ShipConfig = { ...DEFAULT_SHIP_CONFIG, radius: 18 };
  private sternX = -1.3;
  private moods: Record<MoodId, Mood>;
  private moodId: MoodId;
  private mood: Mood;
  private moodFrom: Mood;
  private moodTo: Mood;
  private moodT = 1;
  private crew: Group | null = null;
  private prev = { x: 0, y: 0, heading: 0 };
  private acc = 0;
  private time = 0;
  private last = 0;
  private raf = 0;
  private destroyed = false;

  // Cámara.
  private zoom = BOAT_ZOOM;
  private zoomGoal = BOAT_ZOOM;
  private lastBoatZoom = BOAT_ZOOM;
  private readonly pan = new Vector2();
  private readonly focus = new Vector3();
  private readonly look = new Vector3();
  private dFar = 700;
  /** px tapados abajo por la ficha: la cámara sube el barco por encima. */
  private insetGoal = 0;
  private inset = 0;
  private shake = 0;
  private fovKick = 0;
  /**
   * Giro de la cámara (rad; 0 = mirando al norte, como siempre). Sólo gira
   * en el vuelo de «Entradas», para ir detrás del barco; al posarse vuelve.
   */
  private camYaw = 0;

  // Control.
  private readonly pointers = new Map<
    number,
    { x: number; y: number; sx: number; sy: number; t: number }
  >();
  private mode: 'none' | 'pending' | 'stick' | 'pan' | 'pinch' = 'none';
  private stick = { ox: 0, oy: 0, dx: 0, dy: 0 };
  private pinch = { d: 0, zoom: 0 };
  private readonly keys = new Set<string>();
  private readonly stickEl: HTMLDivElement;
  private readonly knobEl: HTMLDivElement;
  private course: { x: number; y: number; placeId: string | null } | null = null;
  /** Viaje en turbo del botón «Entradas» (REQ-ENT-040): destino y s navegados. */
  private voyage: { placeId: string; t: number } | null = null;
  /**
   * Vuelo del botón «Entradas» (experimento): destino, s desde el despegue,
   * de dónde sale y cuánto se desplaza (u de motor, por el camino corto),
   * rumbo de salida y de llegada.
   */
  private flight: FlightState | null = null;
  /** Altura del barco sobre el agua (escena) en este fotograma. */
  private air = 0;
  private readonly wings: Wings;
  private readonly sparks = new Sparks();
  private readonly splash = new Splash();
  private readonly flightClouds = new FlightClouds();
  private readonly tipsAt: [Vector3, Vector3] = [new Vector3(), new Vector3()];
  private moved = false;
  private turboLeft = 0;
  private turboCool = 0;
  private turnRate = 0;
  private statsAt = 0;
  private frames = 0;
  private fps = 60;
  private perfWindow: number[] = [];
  private dpr = 1;
  private readonly maxDpr: number;
  private readonly raycaster = new Raycaster();
  private semaphore: MeshBasicMaterial[] = [];
  /** Sin control (un diálogo modal encima: la compra de prueba). */
  inputEnabled = true;
  /** Sin simular ni pintar (un minijuego a pantalla completa encima). */
  paused = false;
  private gates = new Map<number, MeshBasicMaterial[]>();
  // Cambio de mundo por agujero negro (T41 en /juego; aquí T51).
  private readonly vortex = new VortexPass();
  private readonly switcher: WorldSwitcher<MarScene>;
  private switchingMode: SwitchMode | null = null;
  // Modelos de Blender por distancia (T51).
  private readonly modelStore = new ModelStore();
  private readonly modelViews = new Map<string, ModelView>();
  private modelClock = MODEL_PLAN_S;

  constructor(opts: Mar3DOptions) {
    this.opts = opts;
    this.world = opts.world;
    // El planeta: el mapa con su margen da la vuelta (sólo en /mar; /juego conserva sus costas).
    const rect = planetRect(opts.world.bounds);
    this.rt = new WorldRuntime({ ...opts.world, bounds: rect }, { ...opts.runtime, wrap: true });
    this.switcher = new WorldSwitcher<MarScene>({ swap: (next) => this.adoptWorld(next) });
    this.periodU = periodOf(rect);
    const spawn = opts.world.spawn ?? { x: 0, y: 0, heading: -Math.PI / 2 };
    this.ship = createShipState(spawn.x, spawn.y, spawn.heading);
    Object.assign(this.prev, { x: spawn.x, y: spawn.y, heading: spawn.heading });
    this.b = {
      left: toScene(rect.left),
      right: toScene(rect.right),
      top: toScene(rect.top),
      bottom: toScene(rect.bottom),
    };
    this.periodS = periodOf(this.b);
    planetUniforms.uPlanetPeriod.value.set(this.periodS.w, this.periodS.h);

    this.maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = Math.min(this.maxDpr, 1.5);
    this.renderer = new WebGLRenderer({
      canvas: opts.canvas,
      antialias: this.maxDpr < 2,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(this.dpr);

    this.moods = moods(opts.sea);
    this.moodId = opts.mood;
    this.mood = cloneMood(this.moods[opts.mood]);
    this.moodFrom = cloneMood(this.mood);
    this.moodTo = this.moods[opts.mood];

    this.scene.fog = new Fog(this.mood.fog, 60, 400);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.scene.add(this.sky.mesh);

    this.water = createWater();
    this.scene.add(this.water.mesh);

    this.faces = createFaceTextures();
    this.boat = createBoat(this.faces);
    this.boat.body.scale.setScalar(SHIP_LENGTH / 3);
    this.scene.add(this.boat.group);
    this.scene.add(this.wake.mesh, this.marker.group, this.confetti.mesh);
    this.wings = new Wings(SHIP_LENGTH / 3);
    this.boat.group.add(this.wings.group);
    this.scene.add(this.sparks.mesh, this.splash.group, this.flightClouds.group);

    const glows: Glows[] = [];
    const shores = this.buildPlaces(glows);
    shores.push(...this.buildDecor(glows));
    this.route = seaRoute(this.world);
    this.routeLine = new RouteLine(
      this.route.dashes.map((d) => ({ x: toScene(d.x), z: toScene(d.y), angle: d.angle })),
    );
    curveMaterial(this.routeLine.mesh.material as MeshBasicMaterial, true);
    this.scene.add(this.routeLine.mesh);
    this.buildRouteBuoys(glows);
    // Para las pruebas: cuántas boyas hay en el agua.
    opts.canvas.dataset.routeBuoys = String(this.route.buoys.length);
    this.water.setShores(shores);
    this.glow = glowPoints(glows);
    // Los resplandores no tienen sitio propio: cada uno va a su copia más cercana.
    curveMaterial(this.glow.material as ShaderMaterial, true);
    this.scene.add(this.glow);

    this.clouds = new Clouds(this.b);
    this.scene.add(this.clouds.group);
    // Todo lo demás se curva con el planeta (lo que ya está curvado se queda como está).
    curveTree(this.scene);

    this.missionHost = {
      moveObject: (id, x, y, z) => this.runtime.moveObject(id, x, y, z),
      setObjectPresent: (id, on) => this.runtime.setObjectPresent(id, on),
      setObjectInteractive: (id, on) => this.runtime.setObjectInteractive(id, on),
      setPassenger: (on) => this.setPassenger(on),
    };

    // Joystick visible donde se toca.
    this.stickEl = document.createElement('div');
    this.stickEl.className = 'mar-stick';
    this.knobEl = document.createElement('div');
    this.knobEl.className = 'mar-stick__knob';
    this.stickEl.append(this.knobEl);
    opts.overlay.append(this.stickEl);
    this.setPins(opts.pins);

    this.bindInput();
    this.resize();
    window.addEventListener('resize', this.resize);
    // Zoom de salida según la forma de la pantalla (en un móvil en vertical, algo más lejos).
    this.zoom = this.zoomGoal = this.lastBoatZoom = startZoom(this.camera.aspect);
    this.applyMood();
    this.updateCamera(0, true);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  // --- API -------------------------------------------------------------------

  /** El runtime del mundo de ahora (otro tras `setWorld`). */
  get runtime(): WorldRuntime {
    return this.rt;
  }

  setMood(id: MoodId): void {
    this.moodId = id;
    this.moodFrom = cloneMood(this.mood);
    this.moodTo = this.moods[id];
    this.moodT = 0;
  }

  /** Lo que tapa la ficha de abajo (px): el barco se ve por encima de ella. */
  setBottomInset(px: number): void {
    this.insetGoal = Math.max(0, px);
  }

  zoomBy(d: number): void {
    this.zoomGoal = clamp01(this.zoomGoal + d);
    if (this.zoomGoal < MAP_ZOOM) this.lastBoatZoom = this.zoomGoal;
  }

  get zoomLevel(): number {
    return this.zoom;
  }

  /** Vista de mapa ↔ vista de barco. */
  toggleMap(): void {
    if (this.zoomGoal >= MAP_ZOOM) this.backToBoat();
    else {
      this.lastBoatZoom = this.zoomGoal;
      this.zoomGoal = 1;
    }
  }

  backToBoat(): void {
    this.zoomGoal = Math.min(this.lastBoatZoom, MAP_ZOOM - 0.1);
    this.pan.set(0, 0);
  }

  /**
   * Fija rumbo a un lugar (hasta su orilla) o a un punto; null lo quita. Un
   * viaje en turbo en curso termina como `cancelled`.
   */
  setCourse(target: { placeId: string } | { x: number; y: number } | null): void {
    // En el aire no se cambia de rumbo (se puede «Saltar»).
    if (this.flight) return;
    this.endVoyage('cancelled');
    if (!target) {
      this.clearCourse();
      return;
    }
    if ('placeId' in target) {
      const o = this.world.objects.find((x) => x.identity.id === target.placeId);
      if (!o) return;
      const st = this.runtime.objectState(o.identity.id);
      const px = st?.x ?? o.position.x;
      const py = st?.y ?? o.position.y;
      const reach =
        Math.max(o.geometry.collision?.radius ?? 0, o.geometry.activation?.radius ?? 0) +
        this.cfg.radius +
        40;
      // Hasta la orilla del lado por el que se llega (dando la vuelta si es más corto).
      const { dx, dy } = this.runtime.delta(px, py, this.ship.x, this.ship.y);
      const d = Math.hypot(dx, dy) || 1;
      const p = this.inPlanet(px + (dx / d) * reach, py + (dy / d) * reach);
      this.course = { x: p.x, y: p.y, placeId: o.identity.id };
    } else {
      const p = this.freePoint(target.x, target.y);
      this.course = { x: p.x, y: p.y, placeId: null };
    }
    this.marker.show(true);
  }

  /**
   * Cambia de mundo (T41, D-23 punto 4) por un agujero negro centrado en el
   * barco; con `fade`, un fundido de 300 ms. Los lugares son los mismos: sólo
   * cambian los nombres, los diálogos y el color del mar. El barco se queda
   * donde está, con su rumbo; mientras dura no se gobierna. Resuelve `true`
   * si quedó puesto y `false` si otra petición lo adelantó.
   */
  setWorld(
    world: WorldConfig,
    opts: {
      sea?: { base: string; wave: string; crest: string };
      runtime?: Partial<RuntimeOptions>;
      transition?: SwitchMode;
    } = {},
  ): Promise<boolean> {
    if (this.destroyed) return Promise.resolve(false);
    // Se deja el vuelo o el viaje donde iban: el cambio empieza con el barco en el agua.
    if (this.flight) this.finishFlight(false);
    this.endVoyage('cancelled');
    this.clearCourse();
    return this.switcher.switchTo(async () => {
      const runtime = new WorldRuntime(
        { ...world, bounds: planetRect(world.bounds) },
        { ...this.opts.runtime, ...opts.runtime, wrap: true },
      );
      return { world, runtime, sea: opts.sea, destroy: () => undefined };
    }, opts.transition ?? 'vortex');
  }

  /** Hay cambio de mundo en curso (entrada bloqueada). */
  get switching(): boolean {
    return this.switcher.locked;
  }

  /** Con la pantalla a oscuras (o antes de fundir): el mundo nuevo ocupa el sitio del viejo. */
  private adoptWorld(next: MarScene): void {
    if (this.switcher.timeline.mode === 'fade') {
      this.vortex.capture(this.renderer, this.scene, this.camera);
    }
    // Lo que el mundo de antes tenía pendiente sale antes del cambio.
    for (const e of this.rt.drainEvents()) this.opts.onWorldEvent(e);
    this.rt = next.runtime;
    this.world = next.world;
    if (next.sea) {
      this.moods = moods(next.sea);
      this.moodTo = this.moods[this.moodId];
      this.mood = cloneMood(this.moodTo);
      this.moodFrom = cloneMood(this.mood);
      this.moodT = 1;
      this.applyMood();
    }
  }

  /**
   * Pone el barco en (x, y), parado, en el agua libre más cercana (la
   * posición guardada de una recarga, «Saltar» un viaje). Devuelve dónde quedó.
   */
  moveShip(x: number, y: number, heading?: number): { x: number; y: number } {
    const p = this.freePoint(x, y);
    const h = heading ?? this.ship.heading;
    Object.assign(this.ship, { x: p.x, y: p.y, vx: 0, vy: 0, heading: h });
    Object.assign(this.prev, { x: p.x, y: p.y, heading: h });
    this.updateCamera(0, true);
    return p;
  }

  /** Pone el barco al sur de un lugar, fuera de su radio (`?cerca=` y enlaces). */
  startNear(placeId: string): boolean {
    const o = this.world.objects.find((x) => x.identity.id === placeId);
    if (!o) return false;
    const reach = Math.max(
      o.geometry.proximityRadius ?? 0,
      o.geometry.activation?.radius ?? 0,
      o.geometry.collision?.radius ?? 0,
    );
    const p = this.freePoint(o.position.x, o.position.y + reach + 90);
    Object.assign(this.ship, { x: p.x, y: p.y, vx: 0, vy: 0, heading: -Math.PI / 2 });
    Object.assign(this.prev, { x: p.x, y: p.y, heading: -Math.PI / 2 });
    this.updateCamera(0, true);
    return true;
  }

  /** Un punto dentro del periodo del planeta (u de motor). */
  private inPlanet(x: number, y: number): { x: number; y: number } {
    const b = this.runtime.bounds;
    return { x: wrapIn(x, b.left, b.right), y: wrapIn(y, b.top, b.bottom) };
  }

  /** Agua libre más cercana, fuera también del decorado propio (castillo, Explanada…). */
  private freePoint(x: number, y: number, extra = 6): { x: number; y: number } {
    const r = this.cfg.radius + extra;
    const p = this.runtime.safePoint(x, y, r);
    const q = { ...p, vx: 0, vy: 0 };
    if (pushOut(q, this.decorSolids, r + 4, this.periodU)) {
      const again = this.runtime.safePoint(q.x, q.y, r);
      return this.inPlanet(again.x, again.y);
    }
    return p;
  }

  /** El rectángulo del planeta (u de motor): lo que da la vuelta. Para el minimapa. */
  get planetBounds(): { left: number; right: number; top: number; bottom: number } {
    return { ...this.runtime.bounds };
  }

  /** Cuánto ha girado el planeta por su cuenta (rad). Para el minimapa redondo. */
  get planetSpin(): number {
    return this.sky.spin;
  }

  /** Adónde va el rumbo marcado (u de motor), o null. Para el minimapa. */
  get courseTarget(): { x: number; y: number } | null {
    return this.course ? { x: this.course.x, y: this.course.y } : null;
  }

  /** En la vista de mapa (o yendo hacia ella). */
  get mapMode(): boolean {
    return this.zoomGoal >= MAP_ZOOM;
  }

  /**
   * Viaje del botón «Entradas» (REQ-ENT-040): rumbo al lugar, turbo sostenido
   * con estela y la cámara de vuelta al barco, siguiéndolo. Al llegar (o al
   * tope de tiempo) avisa con `onVoyageEnd`; si el jugador toma el timón,
   * termina como `cancelled`. Devuelve false si el lugar no existe.
   */
  startVoyage(placeId: string): boolean {
    this.setCourse({ placeId });
    if (this.course?.placeId !== placeId) return false;
    this.voyage = { placeId, t: 0 };
    this.fovKick = 1;
    this.backToBoat();
    return true;
  }

  /** Corta el viaje (o el vuelo) sin avisar (Saltar: quien llama ya sabe qué hacer). */
  stopVoyage(): void {
    if (this.flight) {
      // Se posa ya en su destino.
      this.finishFlight(false);
      return;
    }
    if (!this.voyage) return;
    this.voyage = null;
    this.clearCourse();
  }

  get voyaging(): string | null {
    return this.flight?.placeId ?? this.voyage?.placeId ?? null;
  }

  /**
   * Ir en nave a un lugar (experimento; lo usan «Entradas» y la ficha): el
   * barco levita, despliega alas de nave, vuela sobre el planeta por el
   * camino corto hasta la orilla del lugar y se posa en el agua. Al posarse
   * avisa con `onVoyageEnd` ('arrived'). Mientras vuela no se gobierna
   * (sólo «Saltar», que lo posa ya). Devuelve false si el lugar no existe.
   */
  startFlight(placeId: string): boolean {
    if (this.flight) return this.flight.placeId === placeId;
    this.endVoyage('cancelled');
    this.clearCourse();
    this.setCourse({ placeId });
    const c = this.course;
    if (c?.placeId !== placeId) return false;
    // Se posa en agua libre (fuera también del decorado).
    const land = this.freePoint(c.x, c.y);
    c.x = land.x;
    c.y = land.y;
    this.marker.show(false);
    const s = this.ship;
    const { dx, dy } = this.runtime.delta(s.x, s.y, land.x, land.y);
    const dist = Math.hypot(dx, dy);
    const h1 = dist > 1 ? Math.atan2(dy, dx) : s.heading;
    const plan = flightPlan(dist);
    this.flight = {
      placeId,
      t: 0,
      plan,
      x0: s.x,
      y0: s.y,
      dx,
      dy,
      h0: s.heading,
      h1,
      pose: flightPose(0, plan),
      ghost: { ...s, vx: 0, vy: 0 },
    };
    s.vx = 0;
    s.vy = 0;
    this.backToBoat();
    this.lastBoatZoom = this.zoomGoal;
    // La transformación se ve de cerca; se aleja al arrancar a volar.
    this.zoomGoal = Math.min(this.zoomGoal, TRANSFORM_ZOOM);
    this.splash.burst(this.boat.group.position.x, this.boat.group.position.z, 0.6);
    return true;
  }

  /** Un paso del vuelo: el barco va por su curva; el runtime ve al barco quieto donde despegó. */
  private stepFlight(dt: number): void {
    const f = this.flight!;
    const s = this.ship;
    f.t += dt;
    const was = f.pose;
    const p = flightPose(f.t, f.plan);
    f.pose = p;
    const b = this.runtime.bounds;
    const nx = wrapIn(f.x0 + f.dx * p.travel, b.left, b.right);
    const ny = wrapIn(f.y0 + f.dy * p.travel, b.top, b.bottom);
    s.vx = wrapD(nx - s.x, this.periodU.w) / dt;
    s.vy = wrapD(ny - s.y, this.periodU.h) / dt;
    s.x = nx;
    s.y = ny;
    const dh = Math.atan2(Math.sin(f.h1 - f.h0), Math.cos(f.h1 - f.h0));
    s.heading = f.h0 + dh * p.turn;
    if (was.phase === 'lift' && p.phase === 'cruise') {
      this.fovKick = 1;
      this.zoomGoal = FLIGHT_ZOOM;
    }
    if (p.phase === 'cruise') this.fovKick = Math.max(this.fovKick, 0.55 * p.thrust);
    // Al llegar encima, la cámara vuelve a acercarse mientras baja.
    if (was.phase === 'cruise' && p.phase === 'land') this.zoomGoal = this.lastBoatZoom;
    this.runtime.step(f.ghost, this.cfg, dt);
    this.opts.onStep?.(f.ghost, dt);
    if (p.phase === 'done') this.finishFlight(true);
  }

  /** Se posa en el destino; con `notify`, avisa de que llegó. */
  private finishFlight(notify: boolean): void {
    const f = this.flight;
    if (!f) return;
    const s = this.ship;
    const b = this.runtime.bounds;
    s.x = wrapIn(f.x0 + f.dx, b.left, b.right);
    s.y = wrapIn(f.y0 + f.dy, b.top, b.bottom);
    s.vx = Math.cos(f.h1) * 20;
    s.vy = Math.sin(f.h1) * 20;
    s.heading = f.h1;
    Object.assign(this.prev, { x: s.x, y: s.y, heading: s.heading });
    this.flight = null;
    this.air = 0;
    this.wings.set(0, 0, this.time);
    this.zoomGoal = this.lastBoatZoom;
    this.clearCourse();
    this.shake = Math.max(this.shake, 0.35);
    if (notify) {
      // El chapoteo en la copia del barco que se ve.
      this.placeShip(1);
      this.splash.burst(this.boat.group.position.x, this.boat.group.position.z, 1);
      this.opts.onVoyageEnd?.(f.placeId, 'arrived');
    }
  }

  private endVoyage(how: VoyageEnd): void {
    const v = this.voyage;
    if (!v) return;
    this.voyage = null;
    this.opts.onVoyageEnd?.(v.placeId, how);
  }

  private clearCourse(): void {
    this.course = null;
    this.marker.show(false);
  }

  /** El jugador toma el timón: fuera rumbo y viaje. */
  private dropCourse(): void {
    if (this.flight) return;
    this.endVoyage('cancelled');
    this.clearCourse();
  }

  turbo(): boolean {
    if (this.turboCool > 0) return false;
    this.turboLeft = TURBO_S;
    this.turboCool = TURBO_COOLDOWN_S;
    this.fovKick = 1;
    return true;
  }

  /**
   * Bandera y estela del barco (T40): la bandera en lo más alto del modelo,
   * ondeando hacia popa, y la espuma con su tinte. No tocan la física.
   */
  setShipDressing(d: ShipDressing): void {
    this.dressing = d;
    this.wake.setTint(d.wakeTint);
    this.placeFlag();
  }

  private removeFlag(): void {
    if (this.flag) {
      this.flag.parent?.remove(this.flag);
      this.flag.geometry.dispose();
      const mat = this.flag.material as MeshBasicMaterial;
      mat.map?.dispose();
      mat.dispose();
      this.flag = null;
    }
  }

  private placeFlag(): void {
    this.removeFlag();
    const look = this.dressing.flag;
    if (!look || !this.mastTop) return;
    const flag = createFlag(look, SHIP_LENGTH * 0.3);
    flag.position.copy(this.mastTop);
    this.boat.body.add(flag);
    this.flag = flag;
  }

  /** Pone el barco del 2D (su modelo de Blender) en lugar del provisional. */
  setShipModel(m: ShipModel): void {
    this.removeFlag();
    const body = this.boat.body;
    for (const c of [...body.children]) {
      if (c === this.boat.crewSlot) continue;
      body.remove(c);
      c.traverse((o) => (o as Mesh).geometry?.dispose());
    }
    this.boat.sail = null;
    this.boat.captain = null;
    body.scale.setScalar(1);
    m.object.scale.setScalar(1);
    m.object.position.set(0, 0, 0);
    m.object.updateMatrixWorld(true);
    const { length, minX, maxX } = modelLength(m.object);
    const k = SHIP_LENGTH / (length || 1);
    m.object.scale.setScalar(k);
    m.object.position.set(-((minX + maxX) / 2) * k, 0, 0);
    body.add(m.object);
    curveTree(m.object);
    this.boat.crewSlot.position.set(m.slot.x * k + m.object.position.x, m.slot.y * k, m.slot.z * k);
    this.sternX = -SHIP_LENGTH / 2;
    // Tope del modelo, en coordenadas del casco: ahí cuelga la bandera (T40).
    const top = topPoint(m.object);
    this.mastTop = new Vector3(top.x * k + m.object.position.x, top.y * k, top.z * k);
    this.placeFlag();
  }

  setPassenger(on: boolean): void {
    if (on && !this.crew) {
      this.crew = createMascot(this.faces.pink, { cap: 'party', band: C.yellow, scale: 0.32 });
      curveTree(this.crew);
      this.boat.crewSlot.add(this.crew);
    } else if (!on && this.crew) {
      this.boat.crewSlot.remove(this.crew);
      this.crew = null;
    }
  }

  /** Confeti sobre un lugar (la entrega de la Fiestera, una meta). */
  celebrate(placeId: string | null): void {
    const v = placeId ? this.views.get(placeId) : null;
    const x = v ? v.obj.position.x : this.boat.group.position.x;
    const z = v ? v.obj.position.z : this.boat.group.position.z;
    this.confetti.burst(x, (v?.labelY ?? 3) * 0.6, z);
  }

  /** Pone un elemento HTML sobre un lugar (o sobre el barco) y lo sigue. */
  anchor(el: HTMLElement | null, target: string, dy = 0): void {
    const i = this.anchors.findIndex((a) => a.target === target);
    if (i >= 0) this.anchors.splice(i, 1);
    if (el) this.anchors.push({ el, target, dy });
  }

  release(el: HTMLElement): void {
    const i = this.anchors.findIndex((a) => a.el === el);
    if (i >= 0) this.anchors.splice(i, 1);
  }

  setPins(pins: PinSpec[]): void {
    for (const p of this.pins) p.el.remove();
    this.pins.length = 0;
    for (const spec of pins) {
      const v = this.views.get(spec.id);
      if (!v) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `mar-pin${spec.accent ? ' mar-pin--accent' : ''}`;
      el.dataset.pin = spec.id;
      el.innerHTML = `<span class="mar-pin__icon" aria-hidden="true">${spec.icon}</span><span class="mar-pin__text"></span>`;
      el.querySelector('.mar-pin__text')!.textContent = spec.text;
      el.setAttribute('aria-label', spec.text);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.opts.onPin?.(spec.id);
      });
      this.opts.overlay.append(el);
      this.pins.push({
        spec,
        el,
        x: v.bx,
        z: v.bz,
        y: v.labelY,
        rx: v.obj.position.x,
        rz: v.obj.position.z,
        vis: false,
      });
    }
  }

  /** Semáforo del circuito: apagado, rojo, ámbar o verde. */
  setSemaphore(state: 'off' | 'red' | 'amber' | 'green'): void {
    const on = { off: -1, red: 0, amber: 1, green: 2 }[state];
    const base = ['#5a1a1a', '#5a4a1a', '#1a4a2a'];
    const lit = ['#ff3b30', '#ffc53d', '#3dff7a'];
    this.semaphore.forEach((m, i) => m.color.set(i === on ? lit[i]! : base[i]!));
  }

  /** Resalta el arco que toca pasar (null: ninguno). */
  setNextGate(order: number | null): void {
    for (const [o, mats] of this.gates) {
      for (const m of mats) m.color.set(o === order ? '#ffd23f' : '#fff4e2');
    }
  }

  dialogue(): DialogueView | null {
    return this.runtime.dialogue();
  }

  destroy(): void {
    this.destroyed = true;
    this.switcher.destroy();
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.unbindInput();
    for (const p of this.pins) p.el.remove();
    this.stickEl.remove();
    this.scene.traverse((o) => {
      const m = o as Mesh;
      m.geometry?.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.modelStore.destroy();
    this.vortex.dispose();
    this.renderer.dispose();
  }

  // --- Mundo ----------------------------------------------------------------

  private addView(v: Omit<View, 'shown' | 'bx' | 'bz' | 'radius' | 'top'>): void {
    const box = new Box3().setFromObject(v.obj);
    const p = v.obj.position;
    const radius = box.isEmpty()
      ? 3
      : Math.max(
          Math.abs(box.max.x - p.x),
          Math.abs(box.min.x - p.x),
          Math.abs(box.max.z - p.z),
          Math.abs(box.min.z - p.z),
        ) + 3;
    const top = box.isEmpty() ? v.labelY : Math.max(box.max.y, v.labelY);
    this.views.set(v.id, { ...v, bx: p.x, bz: p.z, radius, top, shown: 1 });
    this.scene.add(v.obj);
  }

  /**
   * El decorado propio del planeta (castillo, Explanada, islote de la cueva):
   * vistas sin lugar del mapa, sólidas para el barco. Devuelve sus orillas.
   */
  private buildDecor(glows: Glows[]): { x: number; z: number; r: number; w: number }[] {
    const shores: { x: number; z: number; r: number; w: number }[] = [];
    const lit = litMaterial();
    for (const spot of decorSpots(this.world)) {
      const build = buildDecor(spot.kind);
      const g = new Group();
      g.position.set(spot.x, 0, spot.z);
      g.add(new Mesh(build.parts.lit.build(), lit));
      for (const a of build.animated) g.add(a);
      const gl = build.parts.glows;
      for (let i = 0; i < gl.pos.length; i += 3) {
        gl.pos[i] = gl.pos[i]! + spot.x;
        gl.pos[i + 2] = gl.pos[i + 2]! + spot.z;
      }
      glows.push(gl);
      build.solids.forEach((c, i) => {
        this.decorSolids.push({
          x: fromScene(spot.x + c.dx),
          y: fromScene(spot.z + c.dz),
          radius: fromScene(c.r),
        });
        // Bajíos: uno de cada dos círculos basta (se solapan) y el agua hace menos cuentas.
        if (i % 2 === 0) {
          shores.push({
            x: spot.x + c.dx,
            z: spot.z + c.dz,
            r: c.r,
            w: Math.min(9, 3 + c.r * 0.6),
          });
        }
      });
      this.addView({
        id: `decorado:${spot.kind}`,
        obj: g,
        kind: 'decorado',
        y: 0,
        phase: 0,
        labelY: build.labelY,
      });
    }
    return shores;
  }

  /**
   * Las boyas de la ruta (T50): una boya con farolillo cada tramo, en el
   * orden de la historia. Sólo decorado (sin choques ni premios): piezas
   * fusionadas que se dibujan en su copia más cercana, y su luz.
   */
  private buildRouteBuoys(glows: Glows[]): void {
    const k = new Kit();
    const lights = new Glows();
    for (const b of this.route.buoys) {
      const x = toScene(b.x);
      const z = toScene(b.y);
      k.add(new CylinderGeometry(0.42, 0.58, 0.55, 10), C.yellow, { p: [x, 0.12, z] });
      k.add(new CylinderGeometry(0.44, 0.44, 0.14, 10), C.purple, { p: [x, 0.3, z] });
      k.add(new CylinderGeometry(0.1, 0.13, 1.3, 6), C.purple, { p: [x, 1, z] });
      k.add(new SphereGeometry(0.24, 10, 8), C.bulb, { p: [x, 1.72, z] });
      lights.add([x, 1.72, z], C.yellow, 3.2);
    }
    glows.push(lights);
    if (k.empty) return;
    const m = new Mesh(k.build(), litMaterial());
    curveMaterial(m.material, true);
    m.frustumCulled = false;
    this.scene.add(m);
  }

  /** Construye cada lugar; devuelve las orillas para el agua. */
  private buildPlaces(glows: Glows[]): { x: number; z: number; r: number; w: number }[] {
    const shores: { x: number; z: number; r: number; w: number }[] = [];
    const statics = new Kit();
    const staticGlows = new Glows();
    glows.push(staticGlows);
    const lit = litMaterial();

    const gateList = this.circuitGates();

    for (const o of this.world.objects) {
      if (!o.identity.active) continue;
      const id = o.identity.id;
      const cat = o.identity.category;
      const x = toScene(o.position.x);
      const z = toScene(o.position.y);
      const r = toScene(o.geometry.collision?.radius ?? o.geometry.activation?.radius ?? 12);
      const rnd = rng(seedOf(id));
      const phase = rnd() * Math.PI * 2;

      if (cat === 'isla' || cat === 'naufrago') {
        const R = cat === 'isla' ? r : Math.max(1.5, r * 1.2);
        const build = cat === 'isla' ? buildIsland(id, R) : buildSandbank(R);
        const g = new Group();
        g.position.set(x, 0, z);
        g.add(new Mesh(build.parts.lit.build(), lit));
        if (!build.parts.glow.empty) {
          g.add(new Mesh(build.parts.glow.build(), new MeshBasicMaterial({ vertexColors: true })));
        }
        for (const a of build.animated) g.add(a);
        if (build.update) this.animated.push(build.update);
        const gl = build.parts.glows;
        for (let i = 0; i < gl.pos.length; i += 3) {
          gl.pos[i] = gl.pos[i]! + x;
          gl.pos[i + 2] = gl.pos[i + 2]! + z;
        }
        glows.push(gl);
        this.islands.push({ x, z, R, build });
        this.islandRadius.set(id, R);
        shores.push({ x, z, r: R, w: Math.min(11, 3 + R * 0.7) });
        this.addView({ id, obj: g, kind: cat, y: 0, phase, labelY: build.labelY });
        continue;
      }
      if (id === 'puerto') continue;

      switch (cat) {
        case 'boia': {
          if (id.includes('whatsapp')) {
            const g = new Group();
            const k = new Kit();
            buoy(k, 0, 0, C.green, C.white, 1.1);
            k.add(new SphereGeometry(0.45, 10, 8), C.white, {
              p: [0, 1.45, 0],
              s: [1.2, 0.9, 0.5],
            });
            k.add(new ConeGeometry(0.16, 0.3, 4), C.white, {
              p: [-0.35, 1.05, 0],
              r: [0, 0, -0.6],
            });
            // La mascota de WhatsApp (T39) llega por distancia; mientras, la boya verde.
            const fallback = new Mesh(k.build(), lit);
            g.add(this.modelSlotFor(o, fallback));
            g.position.set(x, 0, z);
            this.addView({ id, obj: g, kind: 'boia', y: 0, phase, labelY: 2.6, update: bob(0.08) });
          } else {
            const g = new Group();
            const k = new Kit();
            k.add(new CylinderGeometry(0.9, 1.1, 0.5, 12), C.white, { p: [0, 0.1, 0] });
            k.add(new CylinderGeometry(0.2, 0.2, 0.2, 8), C.orange, { p: [0, 0.4, 0] });
            const fallback = new Group();
            fallback.add(new Mesh(k.build(), lit));
            const mascot = createMascot(this.faces.orange, {
              cap: 'beanie',
              band: C.white,
              scale: 0.75,
            });
            mascot.position.y = 0.35;
            mascot.rotation.y = Math.PI / 2;
            fallback.add(mascot);
            // La mascota de Blender (T39: primera o informativa) llega por distancia.
            const m = this.modelSlotFor(o, fallback);
            g.add(m);
            g.position.set(x, 0, z);
            this.addView({
              id,
              obj: g,
              kind: 'boia',
              y: 0,
              phase,
              labelY: 3.2,
              update: (v, t) => {
                v.obj.position.y = Math.sin(t * 1.8 + v.phase) * 0.12;
                m.rotation.z = Math.sin(t * 2.4) * 0.08;
              },
            });
          }
          break;
        }
        case 'encuentro': {
          const g = new Group();
          const mascot = createMascot(this.faces.pink, {
            cap: 'party',
            band: C.yellow,
            scale: 0.55,
          });
          mascot.rotation.y = Math.PI / 2;
          // La Boia Fiestera de Blender (T39) llega por distancia.
          const m = this.modelSlotFor(o, mascot);
          g.add(m);
          g.position.set(x, 0, z);
          this.addView({
            id,
            obj: g,
            kind: 'encuentro',
            y: 0,
            phase,
            labelY: 3,
            update: (v, t, _dt, present, px, pz, h) => {
              v.obj.visible = present;
              v.obj.position.set(px, h + Math.abs(Math.sin(t * 3 + v.phase)) * 0.25, pz);
              m.rotation.z = Math.sin(t * 3) * 0.15;
            },
          });
          break;
        }
        case 'cocodrilo': {
          const g = createCroc();
          g.position.set(x, 0, z);
          g.rotation.y = phase;
          g.scale.setScalar(0.9);
          let lastX = x;
          let lastZ = z;
          this.addView({
            id,
            obj: g,
            kind: 'cocodrilo',
            y: 0,
            phase,
            labelY: 2,
            update: (v, t, dt, present, px, pz) => {
              const target = present ? 0 : -1.2;
              v.y += (target - v.y) * Math.min(1, dt * 4);
              const dx = px - lastX;
              const dz = pz - lastZ;
              if (Math.hypot(dx, dz) > 0.002) v.obj.rotation.y = -Math.atan2(dz, dx);
              else v.obj.rotation.y = v.phase + Math.sin(t * 0.4 + v.phase) * 0.6;
              lastX = px;
              lastZ = pz;
              v.obj.position.set(px, v.y + Math.sin(t * 2 + v.phase) * 0.05, pz);
              v.obj.visible = v.y > -1.1;
            },
          });
          break;
        }
        case 'restos':
        case 'cofre':
        case 'secreto': {
          if (id === 'secreto-cueva') {
            staticGlows.add([x + 1.5, 1.2, z], '#9fe8ff', 2);
            break;
          }
          if (id === 'secreto-circulo') {
            const k = new Kit();
            sleepingRing(k, 2.4);
            const g = new Group();
            g.add(new Mesh(k.build(), lit));
            g.position.set(x, 0, z);
            this.addView({ id, obj: g, kind: cat, y: 0, phase, labelY: 2, update: bob(0.05) });
            break;
          }
          if (id === 'secreto-campana') {
            staticGlows.add([x, 0.3, z], '#bfe8ff', 3.5);
            break;
          }
          const collectible = o.behaviors.some((b) => b.type === 'collectible');
          const g = new Group();
          let body: Mesh;
          if (cat === 'cofre') body = new Mesh(chestGeometry(), lit);
          else if (id === 'secreto-anfora') body = new Mesh(amphora(), lit);
          else body = new Mesh(debrisGeometry(rnd), lit);
          g.add(body);
          const coin = collectible ? createCoin() : null;
          if (coin) {
            coin.position.y = cat === 'cofre' ? 2 : 1.4;
            coin.rotation.x = Math.PI / 2;
            g.add(coin);
          }
          g.position.set(x, 0, z);
          this.addView({
            id,
            obj: g,
            kind: cat,
            y: 0,
            phase,
            labelY: 2.4,
            update: (v, t, dt, present, px, pz) => {
              v.shown += ((present ? 1 : 0) - v.shown) * Math.min(1, dt * 6);
              v.obj.visible = v.shown > 0.02;
              v.obj.scale.setScalar(v.shown);
              v.obj.position.set(px, Math.sin(t * 1.6 + v.phase) * 0.1 - 0.05, pz);
              body.rotation.set(
                Math.sin(t + v.phase) * 0.06,
                v.phase,
                Math.cos(t * 0.8 + v.phase) * 0.06,
              );
              if (coin) {
                coin.rotation.z = t * 2.4;
                coin.position.y = (cat === 'cofre' ? 2 : 1.4) + Math.sin(t * 2.2 + v.phase) * 0.15;
              }
            },
          });
          break;
        }
        case 'delfin': {
          const g = new Group();
          const d = createDolphin();
          g.add(d);
          g.position.set(x, 0, z);
          this.addView({
            id,
            obj: g,
            kind: 'delfin',
            y: 0,
            phase,
            labelY: 2,
            update: (v, t, _dt, present, px, pz) => {
              v.obj.visible = present;
              // Salta en arcos alrededor de su sitio.
              const cycle = (t * 0.45 + v.phase) % 1;
              const a = t * 0.35 + v.phase;
              const cx = px + Math.cos(a) * 3;
              const cz = pz + Math.sin(a) * 3;
              const jump = Math.sin(cycle * Math.PI);
              v.obj.position.set(cx, jump * 2.2 - 0.6, cz);
              v.obj.rotation.y = -(a + Math.PI / 2);
              d.rotation.z = Math.cos(cycle * Math.PI) * 0.9;
            },
          });
          break;
        }
        case 'remolino': {
          const R = toScene(o.geometry.proximityRadius ?? 80) * 1.1;
          const m = whirlpool(R);
          m.position.set(x, 0.08, z);
          this.addView({
            id,
            obj: m,
            kind: 'remolino',
            y: 0,
            phase,
            labelY: 2,
            update: (v, t) => {
              ((v.obj as Mesh).material as ShaderMaterial).uniforms.uTime!.value = t;
            },
          });
          break;
        }
        case 'circuito': {
          const gate = gateList.get(id);
          if (!gate) break;
          const g = new Group();
          const k = new Kit();
          const half = Math.max(2.6, r * 0.9);
          for (const s of [-1, 1]) {
            for (let i = 0; i < 4; i++) {
              k.add(new CylinderGeometry(0.22, 0.24, 0.9, 8), i % 2 ? C.white : C.orange, {
                p: [0, 0.45 + i * 0.9, s * half],
              });
            }
            k.add(new CylinderGeometry(0.5, 0.6, 0.4, 8), C.purple, { p: [0, 0, s * half] });
          }
          g.add(new Mesh(k.build(), lit));
          const bannerMat = new MeshBasicMaterial({ color: '#fff4e2' });
          const text =
            gate.order === 0 ? 'SALIDA · EL FREU' : gate.finish ? 'META' : `CP ${gate.order}`;
          const banner = new Mesh(new BoxGeometry(0.2, 0.9, half * 2 + 0.4), bannerMat);
          banner.position.y = 3.7;
          g.add(banner);
          const tex = textTexture([text], { w: 512, h: 96, bg: C.purple, fg: '#fff4e2' });
          for (const s of [-1, 1]) {
            const face = new Mesh(
              new BoxGeometry(0.02, 0.7, half * 2),
              new MeshBasicMaterial({ map: tex }),
            );
            face.position.set(s * 0.12, 3.7, 0);
            face.rotation.y = s > 0 ? 0 : Math.PI;
            g.add(face);
          }
          const mats = this.gates.get(gate.order) ?? [];
          mats.push(bannerMat);
          this.gates.set(gate.order, mats);
          g.position.set(x, 0, z);
          g.rotation.y = -gate.dir;
          this.addView({ id, obj: g, kind: 'circuito', y: 0, phase, labelY: 5 });
          break;
        }
        case 'carril':
          buoy(
            statics,
            x,
            z,
            id.endsWith('d') ? C.red : C.white,
            id.endsWith('d') ? C.white : C.red,
            0.8,
          );
          break;
        case 'decorado': {
          if (id === 'puerto-anillo') {
            const k = new Kit();
            k.add(new TorusGeometry(3.2, 0.22, 6, 28), C.orange, { r: [Math.PI / 2, 0, 0] });
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2;
              k.add(new SphereGeometry(0.3, 8, 6), i % 2 ? C.white : C.orange, {
                p: [Math.cos(a) * 3.2, 0.1, Math.sin(a) * 3.2],
              });
            }
            const g = new Group();
            g.add(new Mesh(k.build(), lit));
            g.position.set(x, 0.05, z);
            this.addView({
              id,
              obj: g,
              kind: 'decorado',
              y: 0.05,
              phase,
              labelY: 2,
              update: bob(0.04),
            });
          } else if (id.includes('posidonia')) {
            for (let i = 0; i < 14; i++) {
              const a = rnd() * Math.PI * 2;
              const d = 1 + rnd() * 3;
              statics.add(new ConeGeometry(0.08, 0.7, 3), C.leafDark, {
                p: [x + Math.cos(a) * d, 0.15, z + Math.sin(a) * d],
                r: [(rnd() - 0.5) * 0.6, 0, (rnd() - 0.5) * 0.6],
              });
            }
          } else if (id.includes('semaforo')) {
            statics.add(new CylinderGeometry(0.1, 0.12, 4.2, 6), C.iron, { p: [x, 2.1, z] });
            statics.add(new BoxGeometry(0.7, 2, 0.5), C.speaker, { p: [x, 4.4, z] });
            const g = new Group();
            for (let i = 0; i < 3; i++) {
              const mat = new MeshBasicMaterial({ color: '#333' });
              const lamp = new Mesh(new SphereGeometry(0.24, 10, 8), mat);
              lamp.position.set(0, 5.05 - i * 0.62, 0.26);
              g.add(lamp);
              this.semaphore.push(mat);
            }
            g.position.set(x, 0, z);
            this.addView({ id, obj: g, kind: 'decorado', y: 0, phase, labelY: 6 });
            this.setSemaphore('off');
          }
          break;
        }
        case 'obstaculo': {
          const name = o.identity.name.toLowerCase();
          if (id.includes('baliza')) {
            const color = id.includes('verde') ? C.green : C.red;
            statics.add(new CylinderGeometry(0.35, 0.5, 2.4, 8), color, { p: [x, 1.0, z] });
            statics.add(new CylinderGeometry(0.4, 0.4, 0.2, 8), C.white, { p: [x, 2.3, z] });
            statics.add(new SphereGeometry(0.22, 8, 6), color, { p: [x, 2.6, z] });
            staticGlows.add([x, 2.65, z], id.includes('verde') ? '#5bff9a' : '#ff5a4a', 2.2);
          } else if (id.includes('escollera')) {
            for (let i = 0; i < 6; i++) {
              rock(
                statics,
                x + (rnd() - 0.5) * r * 2.4,
                0.2,
                z + (rnd() - 0.5) * r * 1.2,
                r * (0.55 + rnd() * 0.5),
                rnd,
              );
            }
            shores.push({ x, z, r: r * 1.1, w: 2.5 });
          } else if (name.includes('medusa')) {
            const g = createJelly();
            g.position.set(x, 0, z);
            this.addView({
              id,
              obj: g,
              kind: 'medusa',
              y: 0,
              phase,
              labelY: 2,
              update: (v, t, _dt, present, px, pz) => {
                v.obj.visible = present;
                v.obj.position.set(px, Math.sin(t * 2 + v.phase) * 0.2, pz);
                v.obj.scale.set(1, 0.9 + Math.sin(t * 3) * 0.1, 1);
              },
            });
            staticGlows.add([x, 0.4, z], '#d99bff', 2);
          } else if (name.includes('cartel')) {
            statics.add(new CylinderGeometry(0.08, 0.1, 2.4, 5), C.woodDark, { p: [x, 1.0, z] });
            const tex = textTexture(['ATAJO →'], { w: 256, h: 96, bg: '#ffd23f', fg: '#231c1a' });
            const sign = new Mesh(new BoxGeometry(2.2, 0.8, 0.1), [
              new MeshLambertMaterial({ color: '#e0b92f' }),
              new MeshLambertMaterial({ color: '#e0b92f' }),
              new MeshLambertMaterial({ color: '#e0b92f' }),
              new MeshLambertMaterial({ color: '#e0b92f' }),
              new MeshLambertMaterial({ map: tex }),
              new MeshLambertMaterial({ map: tex }),
            ]);
            const g = new Group();
            sign.position.set(0, 2.3, 0);
            g.add(sign);
            g.position.set(x, 0, z);
            this.addView({ id, obj: g, kind: 'obstaculo', y: 0, phase, labelY: 3 });
          } else {
            const big = r > 1.2;
            if (big) {
              crag(statics, x, z, r, rnd);
              shores.push({ x, z, r: r * 0.9, w: 3.5 });
            } else {
              rock(statics, x, 0.1, z, r * 1.1, rnd);
              if (r > 0.5) shores.push({ x, z, r: r * 0.7, w: 1.6 });
            }
          }
          break;
        }
        default:
          break;
      }
    }
    if (!statics.empty) {
      // Piezas fusionadas sin sitio propio: cada vértice va a su copia más cercana.
      const m = new Mesh(statics.build(), litMaterial());
      curveMaterial(m.material, true);
      m.frustumCulled = false;
      this.scene.add(m);
    }
    return shores;
  }

  /** Arcos del circuito: orden y rumbo de paso (del arco anterior al siguiente). */
  private circuitGates(): Map<string, { order: number; dir: number; finish: boolean }> {
    const list: { id: string; order: number; x: number; y: number }[] = [];
    for (const o of this.world.objects) {
      if (o.identity.category !== 'circuito') continue;
      for (const b of o.behaviors) {
        if (b.type === 'checkpoint')
          list.push({ id: o.identity.id, order: b.params.order, x: o.position.x, y: o.position.y });
      }
    }
    const max = Math.max(0, ...list.map((g) => g.order));
    const avg = (order: number) => {
      const g = list.filter((x) => x.order === order);
      if (g.length === 0) return null;
      return {
        x: g.reduce((s, x) => s + x.x, 0) / g.length,
        y: g.reduce((s, x) => s + x.y, 0) / g.length,
      };
    };
    const out = new Map<string, { order: number; dir: number; finish: boolean }>();
    for (const g of list) {
      const prev = avg(g.order - 1) ?? g;
      const next = avg(g.order + 1) ?? g;
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      out.set(g.id, { order: g.order, dir: Math.atan2(dy, dx), finish: g.order === max });
    }
    return out;
  }

  private groundAt(x: number, z: number): number {
    for (const i of this.islands) {
      const dx = x - i.x;
      const dz = z - i.z;
      if (dx * dx + dz * dz < i.R * i.R * 1.1) return Math.max(0, i.build.heightAt(dx, dz));
    }
    return 0;
  }

  // --- Control ----------------------------------------------------------------

  private bindInput(): void {
    const c = this.opts.canvas;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onUp);
    c.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  private unbindInput(): void {
    const c = this.opts.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onUp);
    c.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  private readonly onBlur = () => {
    this.keys.clear();
    this.pointers.clear();
    this.endStick();
    this.mode = 'none';
  };

  private readonly onDown = (e: PointerEvent) => {
    if (!this.inputEnabled || this.switcher.locked) return;
    this.opts.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      sx: e.clientX,
      sy: e.clientY,
      t: performance.now(),
    });
    if (this.pointers.size === 1) {
      this.mode = 'pending';
    } else if (this.pointers.size === 2) {
      this.endStick();
      this.mode = 'pinch';
      this.pinch = { d: this.pinchDistance(), zoom: this.zoomGoal };
    }
  };

  private readonly onMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const px = p.x;
    const py = p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.mode === 'pinch' && this.pointers.size >= 2) {
      const d = this.pinchDistance();
      if (this.pinch.d > 0 && d > 0) {
        const ratio = Math.log(this.pinch.d / d) / Math.log(this.dFar / 16);
        this.zoomGoal = clamp01(this.pinch.zoom + ratio);
        if (this.zoomGoal < MAP_ZOOM) this.lastBoatZoom = this.zoomGoal;
      }
      return;
    }
    if (this.mode === 'pending' && Math.hypot(p.x - p.sx, p.y - p.sy) > 9) {
      if (this.zoom >= MAP_ZOOM) {
        this.mode = 'pan';
      } else {
        this.mode = 'stick';
        this.stick = { ox: p.sx, oy: p.sy, dx: 0, dy: 0 };
        this.dropCourse();
        this.stickEl.classList.add('is-on');
      }
    }
    if (this.mode === 'stick') {
      this.stick.dx = p.x - this.stick.ox;
      this.stick.dy = p.y - this.stick.oy;
      const len = Math.hypot(this.stick.dx, this.stick.dy);
      const max = 64;
      const k = len > max ? max / len : 1;
      const r = this.opts.overlay.getBoundingClientRect();
      this.stickEl.style.transform = `translate(${this.stick.ox - r.left}px, ${this.stick.oy - r.top}px)`;
      this.knobEl.style.transform = `translate(${this.stick.dx * k}px, ${this.stick.dy * k}px)`;
    } else if (this.mode === 'pan') {
      const w = this.worldPerPixel();
      this.pan.x -= (p.x - px) * w;
      this.pan.y -= (p.y - py) * w;
      this.clampPan();
    }
  };

  private readonly onUp = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!p) return;
    if (this.mode === 'pending' && performance.now() - p.t < 400) this.tap(p.x, p.y);
    if (this.pointers.size === 0) {
      this.endStick();
      this.mode = 'none';
    } else if (this.mode === 'pinch' && this.pointers.size === 1) {
      // Queda un dedo: no vuelve a ser joystick hasta soltar.
      this.mode = 'none';
    }
  };

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    this.zoomBy(d * 0.0011);
  };

  private readonly onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (!this.inputEnabled || this.switcher.locked) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
      e.preventDefault();
      this.keys.add(k);
      this.dropCourse();
    } else if (k === '+' || k === '=') this.zoomBy(-0.12);
    else if (k === '-' || k === '_') this.zoomBy(0.12);
    else if (k === 'm') this.toggleMap();
    else if (k === 't' || k === 'shift') this.turbo();
    else if (k === ' ' || k === 'enter') {
      if (this.runtime.dialogue()) {
        e.preventDefault();
        this.runtime.advanceDialogue();
      }
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private endStick(): void {
    this.stick.dx = 0;
    this.stick.dy = 0;
    this.stickEl.classList.remove('is-on');
  }

  private pinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private tap(cx: number, cy: number): void {
    // Un toque con diálogo abierto lo avanza.
    if (this.runtime.dialogue()) {
      this.runtime.advanceDialogue();
      return;
    }
    const r = this.opts.canvas.getBoundingClientRect();
    const ndc = new Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    // El agua curvada; un toque en el cielo pone rumbo hacia el horizonte en esa dirección.
    const ray = this.raycaster.ray;
    const cam = ray.origin;
    const on = rayOnPlanet(cam.y, ray.direction.x, ray.direction.y, ray.direction.z, this.bend);
    const hit = tmpV.copy(ray.direction).multiplyScalar(on.t).add(cam);
    // ¿Cerca de un lugar con rótulo? Rumbo a él.
    let best: { id: string; d: number } | null = null;
    for (const p of this.pins) {
      const d = Math.hypot(p.rx - hit.x, p.rz - hit.z);
      const v = this.views.get(p.spec.id);
      const reach =
        v && (v.kind === 'isla' || v.kind === 'naufrago') ? this.islandR(p.spec.id) + 2 : 3;
      if (d < reach && (!best || d < best.d)) best = { id: p.spec.id, d };
    }
    if (best) {
      this.opts.onPin?.(best.id);
      return;
    }
    // De la copia que se ve al mapa (el runtime lo lleva dentro del periodo).
    this.setCourse({ x: fromScene(hit.x), y: fromScene(hit.z) });
  }

  private islandR(id: string): number {
    return this.islandRadius.get(id) ?? 0;
  }

  private worldPerPixel(): number {
    const h = this.opts.canvas.clientHeight || 1;
    const d = this.camera.position.distanceTo(this.look);
    return (2 * d * Math.tan((this.camera.fov * Math.PI) / 360)) / h;
  }

  private clampPan(): void {
    const w = (this.b.right - this.b.left) * 0.6;
    const h = (this.b.bottom - this.b.top) * 0.6;
    this.pan.x = Math.max(-w, Math.min(w, this.pan.x));
    this.pan.y = Math.max(-h, Math.min(h, this.pan.y));
  }

  private readInput(): ShipInput {
    let dx = 0;
    let dy = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) dx -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) dx += 1;
    if (this.keys.has('arrowup') || this.keys.has('w')) dy -= 1;
    if (this.keys.has('arrowdown') || this.keys.has('s')) dy += 1;
    if (dx || dy) return { dirX: dx, dirY: dy, throttle: 1, drift: false };
    if (this.mode === 'stick') {
      const len = Math.hypot(this.stick.dx, this.stick.dy);
      if (len > 8) {
        return {
          dirX: this.stick.dx,
          dirY: this.stick.dy,
          throttle: Math.min(1, (len - 8) / 56),
          drift: false,
        };
      }
      return IDLE_INPUT;
    }
    if (this.course) return this.autopilot();
    return IDLE_INPUT;
  }

  /** Rumbo al destino por el camino más corto del planeta, apartándose de lo sólido. */
  private autopilot(): ShipInput {
    const r = steer(
      this.ship,
      this.course!,
      [...this.runtime.solidObstacles(), ...this.decorSolids],
      { shipRadius: this.cfg.radius, period: this.periodU },
    );
    if (r.arrived) {
      this.clearCourse();
      this.endVoyage('arrived');
      return IDLE_INPUT;
    }
    return { dirX: r.dirX, dirY: r.dirY, throttle: r.throttle, drift: false };
  }

  // --- Bucle ------------------------------------------------------------------

  private readonly resize = () => {
    const c = this.opts.canvas;
    const w = c.clientWidth || window.innerWidth;
    const h = c.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const t = Math.tan((this.camera.fov * Math.PI) / 360);
    const W = this.b.right - this.b.left;
    const H = this.b.bottom - this.b.top;
    // La vista de mapa enseña el planeta entero una vez (el periodo), sin repetir.
    this.dFar = Math.max((H * 0.56) / t, (W * 0.54) / (t * this.camera.aspect));
    const gm = this.glow.material as ShaderMaterial;
    gm.uniforms.uScale!.value = ((h * this.dpr) / (2 * t)) * 0.5;
  };

  private readonly frame = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.paused) return;
    this.time += dt;
    // Cambio de mundo: el barco se queda quieto y la entrada no cuenta.
    const free = this.switcher.advance(dt * 1000);
    const mode = this.switcher.locked ? this.switcher.timeline.mode : null;
    if (mode !== this.switchingMode) {
      this.switchingMode = mode;
      if (mode) {
        this.keys.clear();
        this.endStick();
      }
      this.opts.onSwitch?.(mode);
    }
    if (free) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 6) {
        this.simulate(STEP);
        this.acc -= STEP;
        steps++;
      }
      if (steps === 6) this.acc = 0;
    } else {
      this.acc = 0;
      this.ship.vx = 0;
      this.ship.vy = 0;
      this.prev.x = this.ship.x;
      this.prev.y = this.ship.y;
      this.prev.heading = this.ship.heading;
    }
    for (const e of this.runtime.drainEvents()) this.opts.onWorldEvent(e);
    this.modelClock += dt;
    if (this.modelClock >= MODEL_PLAN_S) {
      this.modelClock = 0;
      this.streamModels();
    }
    this.render(dt, this.acc / STEP);
    this.measure(dt, now);
  };

  private simulate(dt: number): void {
    const s = this.ship;
    this.prev.x = s.x;
    this.prev.y = s.y;
    this.prev.heading = s.heading;
    if (this.flight) {
      this.stepFlight(dt);
      return;
    }
    const input = this.readInput();
    let cfg = this.runtime.shipConfig(this.cfg);
    if (this.turboLeft > 0 || this.voyage) {
      const k = this.voyage ? VOYAGE_SPEED : 1.6;
      cfg = { ...cfg, maxSpeed: cfg.maxSpeed * k, acceleration: cfg.acceleration * 2.4 };
    }
    if (this.turboLeft > 0) this.turboLeft -= dt;
    if (this.voyage) {
      this.voyage.t += dt;
      this.fovKick = Math.max(this.fovKick, 0.6);
      if (this.voyage.t > VOYAGE_MAX_S) {
        this.clearCourse();
        this.endVoyage('timeout');
      }
    }
    if (this.turboCool > 0) this.turboCool -= dt;
    const before = shipSpeed(s);
    stepShip(s, input, cfg, dt);
    this.runtime.step(s, this.cfg, dt);
    if (pushOut(s, this.decorSolids, this.cfg.radius, this.periodU)) {
      const b = this.runtime.bounds;
      s.x = wrapIn(s.x, b.left, b.right);
      s.y = wrapIn(s.y, b.top, b.bottom);
    }
    const after = shipSpeed(s);
    if (before - after > 60) this.shake = Math.min(1, this.shake + (before - after) / 250);
    // Golpe (T46): lo que el choque le quitó al barco; suena y salpica en la proa.
    const impact = Math.max(s.impact ?? 0, before - after);
    if (impact >= IMPACT_MIN) {
      const bp = this.boat.group.position;
      const h = s.heading;
      this.splash.burst(
        bp.x + Math.cos(h) * SHIP_LENGTH * 0.45,
        bp.z + Math.sin(h) * SHIP_LENGTH * 0.45,
        Math.min(1, impact / 200),
      );
      this.opts.onImpact?.(impact);
    }
    const dh = Math.atan2(
      Math.sin(s.heading - this.prev.heading),
      Math.cos(s.heading - this.prev.heading),
    );
    this.turnRate += (dh / dt - this.turnRate) * Math.min(1, dt * 6);
    if (!this.moved && after > 30) {
      this.moved = true;
      this.opts.onFirstMove?.();
    }
    this.opts.onStep?.(s, dt);
  }

  private applyMood(): void {
    const m = this.mood;
    this.hemi.color.copy(m.hemiSky);
    this.hemi.groundColor.copy(m.hemiGround);
    this.hemi.intensity = m.hemi;
    this.sun.color.copy(m.sun);
    this.sun.intensity = m.sunI;
    this.scene.background = m.fog;
    (this.scene.fog as Fog).color.copy(m.fog);
    this.sky.setMood({
      horizon: m.fog,
      sky: m.sky,
      zenith: m.zenith,
      stars: m.stars,
      sunDir: m.sunDir,
      sun: m.sun,
      glow: m.glow,
    });
    const u = this.water.material.uniforms;
    (u.uDeep!.value as Color).copy(m.deep);
    (u.uShallow!.value as Color).copy(m.shallow);
    (u.uFoam!.value as Color).copy(m.foam);
    u.uSparkle!.value = 0.55 + (1 - m.glow) * 0.45;
    (this.glow.material as ShaderMaterial).uniforms.uGlow!.value = 0.25 + m.glow * 0.95;
  }

  /**
   * El barco en la escena: su sitio interpolado entre pasos, en la copia más
   * cercana al foco (cuando da la vuelta al planeta, no salta). Guarda
   * también su sitio en el mapa (escena), para los rumbos.
   */
  private placeShip(alpha: number): { x: number; z: number; h: number } {
    const s = this.ship;
    // El paso anterior, del mismo lado del borde que el actual.
    const px = s.x - wrapD(s.x - this.prev.x, this.periodU.w);
    const py = s.y - wrapD(s.y - this.prev.y, this.periodU.h);
    const cx = toScene(lerp(px, s.x, alpha));
    const cz = toScene(lerp(py, s.y, alpha));
    const x = this.focus.x + wrapD(cx - this.focus.x, this.periodS.w);
    const z = this.focus.z + wrapD(cz - this.focus.z, this.periodS.h);
    this.shipCanon.set(cx, cz);
    const h =
      this.prev.heading +
      Math.atan2(Math.sin(s.heading - this.prev.heading), Math.cos(s.heading - this.prev.heading)) *
        alpha;
    this.boat.group.position.set(x, this.air, z);
    this.boat.group.rotation.y = -h;
    return { x, z, h };
  }

  private readonly shipCanon = new Vector2();
  /** Hacia dónde mira la cámara por delante del barco (suave; al principio, el norte). */
  private readonly aheadDir = new Vector2(0, -1);

  private updateCamera(dt: number, snap = false): void {
    const k = snap ? 1 : 1 - Math.exp(-dt * 6);
    this.zoom += (this.zoomGoal - this.zoom) * k;
    if (this.zoom < 0.3) this.pan.multiplyScalar(1 - Math.min(1, dt * 3));
    const z = this.zoom;
    const dNear = 17;
    const dist = dNear * Math.pow(this.dFar / dNear, z);
    const elev = lerp(ELEV_NEAR, 1.28, smooth(0, 1, z));
    if (snap) {
      // Sin foco previo: el barco en su sitio del mapa.
      this.focus.set(toScene(this.ship.x), 0, toScene(this.ship.y));
      this.placeShip(1);
    }
    const ship = this.boat.group.position;
    // En un móvil en vertical el barco va en el centro, mirando apenas por delante (T34).
    const framing = lookAhead(this.camera.aspect);
    const w = smooth(0.4, 0.95, z);
    const lead = framing.lead * (1 - smooth(0, 0.4, z)) + framing.catchUp * (1 - w);
    // Se ve más mar hacia donde va el barco (al principio, al norte: el barco en
    // el tercio de abajo). En el planeta se puede ir hacia el sur y dar la vuelta.
    const sp = shipSpeed(this.ship);
    if (sp > this.cfg.maxSpeed * 0.3) {
      const kk = snap ? 1 : 1 - Math.exp(-dt * 1.2);
      this.aheadDir.lerp(tmpV2.set(this.ship.vx / sp, this.ship.vy / sp), kk);
    }
    const ahead = dist * framing.ahead * (1 - w);
    const bx = ship.x + toScene(this.ship.vx) * lead + this.aheadDir.x * ahead;
    const bz = ship.z + toScene(this.ship.vy) * lead + this.aheadDir.y * ahead;
    // El centro del mapa, en la copia de alrededor del barco; al alejarse se queda fijo
    // (la vista de mapa es una carta: el barco da la vuelta por sus bordes).
    const cx = (this.b.left + this.b.right) / 2;
    const cz = (this.b.top + this.b.bottom) / 2;
    const P = this.periodS;
    if (w < 1e-3 || snap) {
      this.mapC.set(ship.x + wrapD(cx - ship.x, P.w), ship.z + wrapD(cz - ship.z, P.h));
    } else {
      if (Math.abs(ship.x - this.mapC.x) > P.w * 0.75)
        this.mapC.x += Math.round((ship.x - this.mapC.x) / P.w) * P.w;
      if (Math.abs(ship.z - this.mapC.y) > P.h * 0.75)
        this.mapC.y += Math.round((ship.z - this.mapC.y) / P.h) * P.h;
    }
    this.inset += (this.insetGoal - this.inset) * (snap ? 1 : 1 - Math.exp(-dt * 5));
    const h = this.opts.canvas.clientHeight || 1;
    const perPx = (2 * dist * Math.tan((this.camera.fov * Math.PI) / 360)) / h;
    const lift = this.inset * 0.5 * perPx * (1 - w);
    // En el mapa la carta sube sin mover su centro (lo que da la vuelta no cambia de copia).
    const mapLift = MAP_LIFT_PX * perPx * w;
    const fx = lerp(bx, this.mapC.x, w) + this.pan.x;
    const fz = lerp(bz, this.mapC.y, w) + this.pan.y + lift;
    if (snap) this.focus.set(fx, 0, fz);
    else this.focus.lerp(tmpV.set(fx, 0, fz), 1 - Math.exp(-dt * FOCUS_RATE));
    this.look.copy(this.focus);
    this.look.z += mapLift;
    let ox = 0;
    let oz = 0;
    if (this.shake > 0) {
      ox = (Math.random() - 0.5) * this.shake * 0.5;
      oz = (Math.random() - 0.5) * this.shake * 0.5;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    // En vuelo la cámara sube con el barco.
    const camY = Math.sin(elev) * dist + this.air * 0.85;
    // En vuelo, la cámara se pone detrás del barco (mirando hacia donde va).
    const fl = this.flight;
    const yawGoal = fl ? Math.atan2(-Math.cos(fl.h1), -Math.sin(fl.h1)) : 0;
    const dYaw = Math.atan2(Math.sin(yawGoal - this.camYaw), Math.cos(yawGoal - this.camYaw));
    this.camYaw += dYaw * (snap ? 1 : 1 - Math.exp(-dt * 2.2));
    if (!fl && Math.abs(this.camYaw) < 1e-4) this.camYaw = 0;
    const back = Math.cos(elev) * dist;
    const camX = this.look.x + Math.sin(this.camYaw) * back;
    const camZ = this.look.z + Math.cos(this.camYaw) * back;
    this.camera.position.set(camX + ox, camY, camZ + oz);
    // La curva: fuerte de cerca (horizonte y cielo), casi plana en el mapa.
    this.bend = lerp(BEND_NEAR, BEND_MAP, smooth(0.25, 0.9, z));
    planetUniforms.uBend.value = this.bend;
    planetUniforms.uBendCenter.value.set(camX, camZ);
    planetUniforms.uPlanetFocus.value.set(this.focus.x, this.focus.z);
    // Se mira al foco ya curvado (baja un poco con la distancia).
    this.look.y = -bendDrop(this.bend, back) + this.air * 0.85;
    this.camera.lookAt(this.look);
    const fov = 40 + this.fovKick * 7;
    if (Math.abs(this.camera.fov - fov) > 0.01) this.camera.fov = fov;
    this.fovKick = Math.max(0, this.fovKick - dt * 0.5);
    // Horizonte: dónde deja de verse el agua; la niebla lo funde con el cielo.
    const horizon = Math.sqrt(camY / this.bend);
    const fog = this.scene.fog as Fog;
    fog.near = Math.min(dist * 1.1, horizon * 0.45);
    fog.far = Math.min(dist * 3.4 + 80, horizon * 1.25 + dist);
    this.camera.far = dist * 4 + 400;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.water.mesh.position.set(camX, 0, camZ);
    // Bajíos: los que se ven (hasta el horizonte y algo más; en el mapa, todos).
    this.water.update(
      this.focus,
      this.periodS,
      { x: camX, z: camZ },
      horizon + 30 + dist * smooth(0.25, 0.9, z) * 3,
    );
    // Sol: sigue al foco para que la luz sea la misma en todo el planeta.
    const d = this.mood.sunDir;
    this.sun.position.set(this.focus.x + d[0] * 100, d[1] * 100, this.focus.z + d[2] * 100);
    this.sun.target.position.copy(this.focus);
    // Cuánto baja el horizonte bajo la horizontal (para el degradado del cielo).
    const a = Math.atan(2 * Math.sqrt(this.bend * camY));
    this.sky.update(this.camera, this.time, dt, Math.sin(a));
    // Sin cielo a la vista (el mapa, mirando al mar), ni se dibuja.
    this.sky.mesh.visible = [-1, 0, 1].some((nx) => {
      const d = tmpV.set(nx, 1, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
      return !rayOnPlanet(camY, d.x, d.y, d.z, this.bend).hit;
    });
  }

  private render(dt: number, alpha: number): void {
    const t = this.time;
    if (this.moodT < 1) {
      this.moodT = Math.min(1, this.moodT + dt / 1.6);
      mixMood(this.mood, this.moodFrom, this.moodTo, smooth(0, 1, this.moodT));
      this.applyMood();
    }
    const glow = this.mood.glow;
    this.water.material.uniforms.uTime!.value = t;
    (this.glow.material as ShaderMaterial).uniforms.uTime!.value = t;

    // Barco (interpolado entre pasos, en la copia más cercana al foco).
    const s = this.ship;
    const fl = this.flight;
    this.air = fl ? fl.pose.alt : 0;
    const { x, z, h } = this.placeShip(alpha);
    const speed = fl ? 0 : shipSpeed(s);
    const v01 = Math.min(1.4, speed / this.cfg.maxSpeed);
    const body = this.boat.body;
    if (fl) {
      // En el aire: cabeceo del vuelo y un balanceo suave, sin oleaje.
      const p = fl.pose;
      body.position.y = Math.sin(t * 2.6) * 0.05;
      body.rotation.x = Math.sin(t * 1.7) * 0.06 * p.wings;
      body.rotation.z = p.pitch;
    } else {
      body.position.y = Math.sin(t * 1.9) * 0.07 + Math.sin(t * 3.3) * 0.03 + v01 * 0.08;
      body.rotation.x =
        Math.max(-0.35, Math.min(0.35, -this.turnRate * 0.14)) + Math.sin(t * 1.5) * 0.03;
      body.rotation.z = v01 * 0.07 + Math.sin(t * 2.1) * 0.025;
    }
    this.wings.group.position.y = body.position.y;
    this.wings.group.rotation.copy(body.rotation);
    if (fl) this.flightEffects(fl, x, z, h, t, dt);
    this.sparks.update(dt);
    this.splash.update(dt);
    if (this.boat.sail) {
      this.boat.sail.rotation.y =
        Math.max(-0.5, Math.min(0.5, this.turnRate * 0.25)) + Math.sin(t * 0.9) * 0.05;
    }
    if (this.boat.captain) this.boat.captain.rotation.y = Math.sin(t * 1.3) * 0.25;
    if (this.crew) this.crew.position.y = Math.abs(Math.sin(t * 5)) * 0.08;
    const sternX = x + Math.cos(h) * this.sternX;
    const sternZ = z + Math.sin(h) * this.sternX;
    const boost = this.turboLeft > 0 || this.voyage ? 1.4 : 1;
    // Al levitar, sólo un rizo de espuma bajo el casco mientras está cerca del agua.
    const hovering = fl ? Math.max(0, 1 - this.air / 1.2) * 0.5 : 0;
    this.wake.update(dt, sternX, sternZ, h, fl ? hovering : Math.min(1, v01 * boost), t);

    this.updateCamera(dt);

    // Lugares: cada uno en su copia más cercana al foco; lo que queda tras el
    // horizonte o fuera de la vista no se pinta.
    const fx = this.focus.x;
    const fz = this.focus.z;
    const P = this.periodS;
    const cam = this.camera.position;
    const bend = this.bend;
    this.frustum.setFromProjectionMatrix(
      tmpM.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse),
    );
    for (const v of this.views.values()) {
      const st = this.runtime.objectState(v.id);
      const cxs = st ? toScene(st.x) : v.bx;
      const czs = st ? toScene(st.y) : v.bz;
      const px = fx + wrapD(cxs - fx, P.w);
      const pz = fz + wrapD(czs - fz, P.h);
      v.obj.position.x = px;
      v.obj.position.z = pz;
      v.obj.visible = true;
      if (v.update) {
        const pzUp = st?.z ? toScene(st.z) : 0;
        const ground = v.kind === 'encuentro' ? Math.max(this.groundAt(cxs, czs), pzUp) : 0;
        v.update(v, t, dt, st ? st.present : true, px, pz, ground);
      }
      if (!v.obj.visible) continue;
      const r = Math.hypot(px - cam.x, pz - cam.z);
      const drop = bendDrop(bend, r);
      tmpSphere.center.set(px, v.top / 2 - drop, pz);
      tmpSphere.radius = Math.hypot(v.radius, v.top / 2);
      if (
        !this.frustum.intersectsSphere(tmpSphere) ||
        behindPlanet(cam.y, Math.max(0, r - v.radius), v.top - drop, bend)
      ) {
        v.obj.visible = false;
      }
    }
    for (const a of this.animated) a(t, glow);
    this.routeLine.update(this.zoom);
    this.confetti.update(dt);
    this.clouds.update(dt, cam.y, { x: fx, z: fz }, P);

    if (this.course) {
      // El destino, en la copia del lado por el que va el barco.
      const tx = x + wrapD(toScene(this.course.x) - this.shipCanon.x, P.w);
      const tz = z + wrapD(toScene(this.course.y) - this.shipCanon.y, P.h);
      this.marker.update({ x, z }, { x: tx, z: tz }, t, 1 + this.zoom * 8);
    }

    // El agujero negro, centrado en el barco (sin cambio de mundo, se pinta directo).
    const bp = this.boat.group.position;
    tmpV.set(bp.x, 0.6 - bendDrop(this.bend, Math.hypot(bp.x - cam.x, bp.z - cam.z)), bp.z);
    tmpV.project(this.camera);
    this.vortex.render(this.renderer, this.scene, this.camera, this.switcher.timeline.pose(), {
      x: tmpV.x * 0.5 + 0.5,
      y: tmpV.y * 0.5 + 0.5,
    });
    this.placeOverlay();
  }

  /**
   * Carga por distancia (T47 en /juego): los lugares con modelo de Blender
   * cerca del barco lo piden; los lejanos lo sueltan y vuelven a la mascota
   * hecha a mano (que no pesa nada).
   */
  private streamModels(): void {
    if (this.modelViews.size === 0) return;
    const ship = this.ship;
    // En el planeta cuenta la copia más cercana: se mide por el camino corto.
    const near = [...this.modelViews.keys()].map((id) => {
      const st = this.runtime.objectState(id);
      const at = st ?? this.world.objects.find((x) => x.identity.id === id)?.position;
      const { dx, dy } = this.runtime.delta(ship.x, ship.y, at?.x ?? 0, at?.y ?? 0);
      return { id, x: ship.x + dx, y: ship.y + dy };
    });
    const { want, keep } = planModels(near, ship);
    for (const [id, mv] of this.modelViews) {
      if (want.has(id) && !mv.acquired) this.acquireModel(mv);
      else if (!keep.has(id) && mv.acquired) this.releaseModel(mv);
    }
  }

  /**
   * El hueco del modelo de Blender de un lugar (T39), con `fallback` dentro
   * hasta que llegue; sin modelo, `fallback` tal cual.
   */
  private modelSlotFor(o: WorldObject, fallback: Object3D): Object3D {
    const key = modelFor(o);
    if (!key) return fallback;
    const slot = modelSlot(fallback);
    this.modelViews.set(o.identity.id, { key, slot, fallback, model: null, acquired: false });
    return slot;
  }

  private acquireModel(mv: ModelView): void {
    mv.acquired = true;
    void this.modelStore.acquire(mv.key).then((model) => {
      if (!model || !mv.acquired || this.destroyed) return;
      // Blender pone la cara a +X, como la mascota hecha a mano ya girada.
      model.rotation.y = Math.PI / 2;
      model.scale.setScalar(fitHeight(model, mv.fallback));
      curveTree(model);
      mv.slot.remove(mv.fallback);
      mv.slot.add(model);
      mv.model = model;
    });
  }

  private releaseModel(mv: ModelView): void {
    mv.acquired = false;
    if (mv.model) {
      mv.slot.remove(mv.model);
      mv.model = null;
      mv.slot.add(mv.fallback);
    }
    this.modelStore.release(mv.key);
  }

  /** Alas, chispas y nubecillas del vuelo (escena), en la copia del barco que se ve. */
  private flightEffects(
    fl: FlightState,
    x: number,
    z: number,
    h: number,
    t: number,
    dt: number,
  ): void {
    const p = fl.pose;
    this.wings.set(p.wings, p.thrust, t, p.phase === 'cruise' ? 0.4 : 1);
    this.boat.group.updateMatrixWorld(true);
    const svx = toScene(this.ship.vx);
    const svz = toScene(this.ship.vy);
    // Estela: chispas en las puntas de las alas (con las alas abiertas) y del
    // propulsor (con empuje). Salen casi quietas: se quedan atrás.
    if (p.wings > 0.6) {
      this.wings.tipsWorld(this.tipsAt);
      const n = p.phase === 'cruise' ? 2 : 1;
      for (let i = 0; i < n; i++) {
        for (const tip of this.tipsAt)
          this.sparks.emit(tip, svx * 0.05, -0.4, svz * 0.05, 0.9, 0.55);
      }
    }
    if (p.thrust > 0.1) {
      const back = -1.9 * (SHIP_LENGTH / 3);
      tmpV.set(x + Math.cos(h) * back, this.air + 0.4, z + Math.sin(h) * back);
      for (let i = 0; i < 3; i++) {
        this.sparks.emit(tmpV, -Math.cos(h) * 6, 0, -Math.sin(h) * 6, 1.4, 0.45);
      }
    }
    // Al levitar gotea agua del casco.
    if (p.phase === 'lift' && Math.random() < dt * 30) {
      tmpV.set(x + (Math.random() - 0.5) * 2.4, this.air, z + (Math.random() - 0.5) * 1.2);
      this.sparks.emit(tmpV, 0, -3, 0, 0.6, 0.5);
    }
    // Nubecillas a lo largo del camino, a la altura del vuelo.
    const k =
      smooth(fl.plan.go - 0.2, fl.plan.go + 0.6, fl.t) *
      (1 - smooth(fl.plan.arrive - 0.6, fl.plan.arrive + 0.3, fl.t));
    const len = toScene(Math.hypot(fl.dx, fl.dy));
    const dirX = len > 0 ? toScene(fl.dx) / len : 1;
    const dirZ = len > 0 ? toScene(fl.dy) / len : 0;
    // Desde donde despegó, en la copia del barco que se ve.
    const fromX = x - dirX * len * p.travel;
    const fromZ = z - dirZ * len * p.travel;
    this.flightClouds.place(fromX, fromZ, dirX, dirZ, len, FLIGHT.cruise - 1.5, k);
  }

  private project(
    x: number,
    y: number,
    z: number,
    out: { x: number; y: number; on: boolean },
  ): void {
    // La curva del planeta también para lo que se pone encima en HTML.
    const cam = this.camera.position;
    const r = Math.hypot(x - cam.x, z - cam.z);
    tmpV.set(x, y - bendDrop(this.bend, r), z).project(this.camera);
    const w = this.opts.canvas.clientWidth;
    const h = this.opts.canvas.clientHeight;
    out.x = (tmpV.x * 0.5 + 0.5) * w;
    out.y = (-tmpV.y * 0.5 + 0.5) * h;
    out.on = tmpV.z < 1 && out.x > -60 && out.x < w + 60 && out.y > -60 && out.y < h + 60;
  }

  private readonly scr = { x: 0, y: 0, on: false };

  /** ¿Lo tapa el planeta? (un rótulo a altura `y` sobre el agua en `x, z`). */
  private hidden(x: number, y: number, z: number): boolean {
    const cam = this.camera.position;
    const r = Math.hypot(x - cam.x, z - cam.z);
    return behindPlanet(cam.y, r, y - bendDrop(this.bend, r), this.bend);
  }

  /**
   * Un rótulo tras el horizonte, asomado en su dirección (dx, dz desde la
   * cámara); si esa dirección cae fuera de la pantalla, en el punto del
   * horizonte más cercano a ella que aún se ve (pegado al borde).
   */
  private horizonPoint(
    dx: number,
    dz: number,
    halfWidth: number,
    out: { x: number; y: number; on: boolean },
  ): void {
    const cam = this.camera.position;
    const rh = Math.sqrt(cam.y / this.bend);
    const W = this.opts.canvas.clientWidth;
    // El rótulo entero dentro de la pantalla.
    const m = Math.min(W / 2, halfWidth + 8);
    // Ángulo respecto a hacia donde mira la cámara (el norte, salvo en vuelo).
    const abs = Math.atan2(dx, -dz) + this.camYaw;
    const want = Math.atan2(Math.sin(abs), Math.cos(abs));
    // Detrás de la cámara: no se ve.
    if (Math.abs(want) > Math.PI / 2) {
      out.on = false;
      return;
    }
    const at = (rel: number) => {
      const a = rel - this.camYaw;
      this.project(cam.x + Math.sin(a) * rh, 1.5, cam.z - Math.cos(a) * rh, out);
    };
    at(want);
    if (out.x >= m && out.x <= W - m) return;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      at(want * mid);
      if (out.x >= m && out.x <= W - m) lo = mid;
      else hi = mid;
    }
    at(want * lo);
  }

  private placeOverlay(): void {
    const bx = this.boat.group.position.x;
    const bz = this.boat.group.position.z;
    const far = this.zoom > 0.28;
    const cam = this.camera.position;
    for (const p of this.pins) {
      const v = this.views.get(p.spec.id);
      if (v) {
        p.rx = v.obj.position.x;
        p.rz = v.obj.position.z;
      }
      const near = Math.hypot(p.rx - bx, p.rz - bz) < 70;
      const want = far || near || !!p.spec.always;
      const x = p.rx;
      const y = p.y;
      const z = p.rz;
      let atHorizon = false;
      if (this.hidden(x, y, z)) {
        if (!p.spec.always) {
          if (p.vis) {
            p.vis = false;
            p.el.classList.remove('is-on');
          }
          continue;
        }
        // Lo que vende se queda asomado al horizonte, en su dirección.
        atHorizon = true;
      }
      if (atHorizon) this.horizonPoint(x - cam.x, z - cam.z, p.el.offsetWidth / 2, this.scr);
      else this.project(x, y, z, this.scr);
      const vis = want && this.scr.on;
      if (vis !== p.vis) {
        p.vis = vis;
        p.el.classList.toggle('is-on', vis);
      }
      if (vis) {
        p.el.style.transform = `translate3d(${this.scr.x.toFixed(1)}px, ${this.scr.y.toFixed(1)}px, 0)`;
        p.el.classList.toggle('is-map', far);
      }
    }
    for (const a of this.anchors) {
      let x = bx;
      let y = 2.4;
      let z = bz;
      if (a.target !== 'ship') {
        const v = this.views.get(a.target);
        if (!v) continue;
        x = v.obj.position.x;
        z = v.obj.position.z;
        y = v.labelY * 0.8;
      }
      this.project(x, y + a.dy, z, this.scr);
      // Que no se salga por los lados ni por arriba.
      const half = a.el.offsetWidth / 2;
      const W = this.opts.canvas.clientWidth;
      const sx = Math.max(half + 8, Math.min(W - half - 8, this.scr.x));
      const sy = Math.max(a.el.offsetHeight + 70, this.scr.y);
      a.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
      a.el.style.visibility = this.scr.on ? 'visible' : 'hidden';
    }
  }

  private measure(dt: number, now: number): void {
    this.frames++;
    this.perfWindow.push(dt);
    if (now - this.statsAt < 250) return;
    const elapsed = (now - this.statsAt) / 1000;
    this.fps = this.statsAt ? this.frames / elapsed : 60;
    this.frames = 0;
    this.statsAt = now;
    // Resolución adaptativa: baja si el móvil no llega, sube con margen.
    if (this.perfWindow.length >= 90) {
      const avg = this.perfWindow.reduce((a, b) => a + b, 0) / this.perfWindow.length;
      this.perfWindow.length = 0;
      let next = this.dpr;
      if (avg > 1 / 40 && this.dpr > 1) next = Math.max(1, this.dpr - 0.25);
      else if (avg < 1 / 58 && this.dpr < this.maxDpr)
        next = Math.min(this.maxDpr, this.dpr + 0.25);
      if (next !== this.dpr) {
        this.dpr = next;
        this.renderer.setPixelRatio(next);
        this.resize();
      }
    }
    // Para las pruebas: dónde queda el barco en la pantalla (px del lienzo). En
    // vuelo el barco está en el aire (y = altura del vuelo), no en el agua.
    const bp = this.boat.group.position;
    this.project(bp.x, bp.y + 0.6, bp.z, this.scr);
    this.opts.canvas.dataset.shipScreen = `${Math.round(this.scr.x)},${Math.round(this.scr.y)}`;
    const c = this.course;
    this.opts.onStats?.({
      fps: Math.round(this.fps),
      knots: Math.round(shipSpeed(this.ship) / 10),
      zoom: this.zoom,
      mapMode: this.zoomGoal >= MAP_ZOOM,
      turbo: this.voyage || this.flight ? 1 : Math.max(0, this.turboLeft / TURBO_S),
      turboReady: 1 - Math.max(0, this.turboCool) / TURBO_COOLDOWN_S,
      course: c
        ? {
            placeId: c.placeId,
            meters: Math.round(
              this.runtime.distance(this.ship.x, this.ship.y, c.x, c.y) * METERS_PER_U,
            ),
          }
        : null,
      panned: this.pan.lengthSq() > 25,
      voyage: this.flight?.placeId ?? this.voyage?.placeId ?? null,
      flight: this.flight?.pose.phase ?? null,
      x: this.ship.x,
      y: this.ship.y,
      heading: this.ship.heading,
      models: [...this.modelViews.values()].filter((m) => m.model).length,
    });
  }
}

/** Balanceo simple sobre el agua. */
function bob(amount: number) {
  return (v: View, t: number) => {
    v.obj.position.y = v.y + Math.sin(t * 1.7 + v.phase) * amount;
    v.obj.rotation.z = Math.sin(t * 1.3 + v.phase) * amount * 0.6;
  };
}
