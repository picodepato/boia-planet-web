import {
  type DialogueView,
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
import {
  BoatJump,
  TURBO_S,
  TURBO_COOLDOWN_S,
  type JumpEvent,
  type JumpSpec,
  rampsOf,
} from '@boia/engine/circuit';
import type { MissionHost } from '@boia/engine/mission';
import {
  type ControlSensitivity,
  browserStore,
  controlSensitivity,
  loadSettings,
  setControlSensitivity,
} from '@boia/engine/ui';
import { type QualityTier, detectQuality } from '@boia/engine/streaming';
import type { DefeatStyle, SurvivorsConfig } from '@boia/engine/survivors';
import { CASTLE_PLACE_ID, type WorldConfig, type WorldObject } from '@boia/world';
import type { Color, Material, ShaderMaterial } from 'three';
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
import { DecorModel } from './decor-model';
import { EnemyModel } from './enemy-models';
import { Wildlife, waterClear } from './wildlife';
import type { MascotKind, ShipDressing } from '../../../lib/barco/dressing';
import {
  Clouds,
  Confetti,
  CourseMarker,
  RouteLine,
  WHIRLPOOL_LIFT,
  Wake,
  glowOffsets,
  glowPoints,
  showGlows,
  whirlpool,
} from './effects';
import { HUD_MARGIN, LABEL_GAP, type PinSight, type Rect, layoutPins, modelLabelY } from './labels';
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
  islandShores,
  sleepingRing,
  textTexture,
} from './islands';
import { Kit, clamp01, lerp, rng, seedOf, smooth } from './kit';
import { type SeaRoute, decorSpots, seaRoute } from './compact';
import { C, type Mood, type MoodId, cloneMood, mixMood, moods } from './palette';
import { Sky, curveMaterial, curveTree, planetUniforms } from './planet';
import { Glows, buoy, crag, rock } from './props';
import { BROWSER_OBJECT_ART, artBox, hasUploadedArt } from './object-art';
import { type ObjectArtState, mountObjectArt, objectArtFallback } from './object-art-view';
import { type ShipModel, modelLength, surfaceY } from './ship-model';
import {
  type ModelKey,
  ModelStore,
  fitHeight,
  loadGltf,
  modelFor,
  modelSlot,
  planModels,
} from './models';
import {
  PLACE_SCREENS,
  type PlaceMotion,
  batchAnimatedNodes,
  placeMotion,
  placeMotionStates,
} from './place-motion';
import {
  ISLAND_MODEL_TUNING,
  type IslandModelEntry,
  type IslandModelState,
  islandGlow,
  islandModelUrl,
  islandScale,
  islandStates,
  loadIslandModels,
} from './island-models';
import {
  ShipHandling,
  TURBO_SPEED,
  VOYAGE_SPEED,
  keysInput,
  stepShipConfig,
  stickInput,
} from './steering';
import { VortexPass } from './vortex';
import {
  type BoostPad,
  type JumpRamp,
  type RaceBuoy,
  boostPad,
  ghostBoat,
  jumpRamp,
  raceBuoy,
  roadMarkers,
} from './race-props';
import { createWater } from './water';
import { type Canoncito, createCanoncito } from './canoncito';
import { MascotModelStore } from './mascot-models';
import { MINIKRAKEN_WAVE_DISTANCE, type Minikraken, createMinikraken } from './minikraken';
import { type Tortuga, createTortuga } from './tortuga';
import { boatVisible, hitShake } from './survivors-props';
import { SurvivorsView } from './survivors-view';
import type { SurvivorsRun } from '../survivors';
import type { DefenseRun } from '../castillo';
import {
  ARENA_CAMERA_S,
  ARENA_ZOOM_NEAR,
  type ArenaFrame,
  ArenaSink,
  ArenaZoom,
  SinkOffsets,
  arenaCameraPose,
  arenaFrame,
  vortexSpot,
} from './defense-arena';
import {
  DEFAULT_DEFENSE_OVERLAYS,
  type DefenseOverlayPrefs,
} from './defense-overlays';
import { DefenseView } from './defense-view';
import {
  type Circle,
  type Period,
  behindPlanet,
  bendDrop,
  mapPanLimit,
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
 * El mar 3D: three.js sobre el mismo `WorldRuntime` que el 2D. Aquí sólo
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
  /** La sensibilidad del giro con que gobierna ahora (Ajustes, `turnScale`, T55). */
  sensitivity: ControlSensitivity;
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
  /** Rótulo del arco de salida y meta del circuito (T61; la web lo da traducido). */
  raceStartLabel?: string;
  /**
   * ¿Corre el cronómetro de la carrera? Con él, la física de 22 nudos (T109);
   * se pregunta antes de cada paso, así que nada la deja puesta al acabar.
   */
  racing?(): boolean;
  /** Los mandos que los rótulos no pisan (la barra de enlaces, el minimapa…; T75). */
  avoid?(): Iterable<Element>;
  /** Una rampa del circuito lanzó el barco o el barco cayó al agua (T73). Para el sonido. */
  onJump?(e: JumpEvent): void;
}

/** Dónde está y hacia dónde mira un barco (u de motor, rad): el fantasma, la salida. */
/** Un punto del mar en u de motor. */
type Point2 = { x: number; y: number };

export interface ShipPose {
  x: number;
  y: number;
  heading: number;
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

/** Una isla del mapa con modelo de Blender (T69): su composición a mano hasta que llega. */
interface IslandModelView {
  slot: Group;
  fallback: Object3D;
  /** Radio de la isla en escena (el modelo se escala a él). */
  R: number;
  entry: IslandModelEntry | null;
  model: Object3D | null;
  acquired: boolean;
  state: IslandModelState;
  glow: ((glow: number) => void) | null;
  /** Los resplandores de la composición a mano: se apagan mientras se ve el modelo (T75). */
  glows: { g: Glows; start: number } | null;
  /** Lo que se mueve del modelo puesto (T112: la boia del club de Benidorm, sus pantallas). */
  motion: PlaceMotion | null;
}

/** s entre dos escrituras de `data-lugares-pose` (para las pruebas). */
const PLACE_POSE_S = 0.25;

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
/** Dónde va la mascota (T154), en esloras desde el centro: hacia popa y a estribor. */
const MASCOT_BACK = 0.43;
const MASCOT_SIDE = 0;
/** Hacia dónde mira la mascota: a popa, un poco a estribor (rad). */
const MASCOT_YAW = Math.PI * 0.8;
/**
 * Hacia dónde miran las boias y la Fiestera (T220): la cara (+x del modelo)
 * a +z de la escena, hacia quien llega desde el puerto, para que se vea la
 * mascota del logo y no su espalda (antes, π/2: de espaldas a la cámara).
 */
export const BOIA_FACING = -Math.PI / 2;
const STEP = 1 / 60;
/** Tope de un viaje en turbo: si no llega (encajonado), se da por llegado. muestra */
const VOYAGE_MAX_S = 20;
const METERS_PER_U = 0.25;
/** Zoom de la cámara mientras vuela: se aleja para ver el planeta pasar por debajo. muestra */
const FLIGHT_ZOOM = 0.34;
/** Zoom mientras levita y le salen las alas: algo más cerca que al navegar. muestra */
const TRANSFORM_ZOOM = 0.15;
/** Altura (escena) a la que vuela el avión de «Defensa del Castillo» (T160). muestra */
const PLANE_ALT = 4.5;

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
  /** Tamaño de su caja (px, sin escalar) y cómo se puso la última vez (T75). */
  w: number;
  h: number;
  look: string;
  /** Lo que se desplaza la punta para seguir señalando su lugar (px, T226). */
  tip?: number;
}

interface Anchor {
  el: HTMLElement;
  target: string;
  dy: number;
}

/** Prefijo de las vistas de botella (T56): no son lugares del mapa. */
const BOTTLE_VIEW = 'botella:';

const tmpV = new Vector3();
const tmpM = new Matrix4();
const tmpV2 = new Vector2();
const tmpSphere = new Sphere();
/** Lo que queda por encima de la pantalla, como un mando más (los rótulos no se van por arriba). */
const ABOVE_SCREEN = { left: -1e6, top: -1e6, right: 1e6, bottom: -HUD_MARGIN };

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
  /** Cosméticos pintados (T40). */
  private dressing: ShipDressing = { wakeTint: null, wakeStyle: 'espuma', mascot: null };
  /** La mascota de cubierta (T154, T175) y su hueco en el casco, aparte del de la pasajera. */
  private mascot: Minikraken | Canoncito | null = null;
  private readonly mascotSlot = new Group();
  /** La Tortuga turbo (T175): nada detrás del barco, en la escena, no en cubierta. */
  private tortuga: Tortuga | null = null;
  private readonly mascotModels = new MascotModelStore();
  private mascotWave = false;
  private mascotCheck = 0;
  private readonly faces: FaceTextures;
  private readonly wake = new Wake();
  private readonly marker = new CourseMarker();
  private readonly confetti = new Confetti();
  private readonly clouds: Clouds;
  private readonly wildlife: Wildlife;
  private readonly wildlifeMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly onWildlifeMotion = () =>
    this.wildlife.setReducedMotion(this.wildlifeMotion.matches);
  /**
   * La ruta (T50): sólo marcas en el agua que guían, de cerca y en el mapa.
   * Desde T59 no hay boyas que unan las islas.
   */
  readonly route: SeaRoute;
  private readonly routeLine: RouteLine;
  private readonly glow;
  private readonly views = new Map<string, View>();
  private readonly islands: { x: number; z: number; R: number; build: IslandBuild }[] = [];
  private readonly animated: ((t: number, glow: number) => void)[] = [];
  private readonly pins: PinView[] = [];
  /** Los mandos que no pisan los rótulos (px del lienzo) y, para las pruebas, las islas de Blender en pantalla (T75). */
  private hudRects: Rect[] = [];
  private readonly islandScreen = new Map<string, Rect>();
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
  /** Crucero (15 nudos) o carrera (22, sólo con el cronómetro corriendo; T109). */
  private readonly handling = new ShipHandling();
  /** La física de base de ahora (sin efectos del mundo ni turbo). */
  private get cfg(): ShipConfig {
    return this.handling.config;
  }
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
  /**
   * Alrededor de qué se da la vuelta al planeta (T65): el foco sin lo que se
   * arrastró la carta. Con el barco es el foco; en el mapa, el centro de la
   * carta, así que arrastrarla no hace saltar islas ni marcas al otro lado.
   */
  private readonly wrapC = new Vector2();
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
  /**
   * La partida del Cañón en curso (T99): la simulación lleva el barco (con
   * su maniobrabilidad) y aquí se pinta; el runtime del mundo no corre.
   */
  private survivors: {
    run: SurvivorsRun;
    view: SurvivorsView;
    turboPending: boolean;
    /** El barco de la partida (vivo: la simulación lo mueve en su sitio). */
    player: { x: number; y: number; vx: number; vy: number; heading: number };
    /** Tipos de enemigo que han salido en pantalla en la partida (T126, para las pruebas). */
    seen: Set<string>;
    weaponsSeen: Set<string>;
    /** s de la escena en que se miró la última vez qué hay en pantalla. */
    seenAt: number;
  } | null = null;
  /** La cámara de la partida (0 la de siempre, 1 la de la partida). */
  private camBlend = 0;
  /**
   * «Defensa del Castillo» en curso (plan 014 T160): la partida lleva el
   * avión (el barco con las alas, a su altura) por la arena alrededor del
   * castillo; el resto del mundo se hunde y la cámara sube. Null sin partida.
   */
  private defense: {
    run: DefenseRun;
    view: DefenseView;
    frame: ArenaFrame;
    /** El castillo en la escena (su sitio del mapa, sin dar la vuelta). */
    castle: { x: number; z: number };
    /** Dónde estaba el barco al empezar: vuelve ahí al acabar. */
    before: { x: number; y: number; heading: number };
    /** s de la escena de la última lectura para las pruebas. */
    seenAt: number;
  } | null = null;
  /** La cámara de la arena (0 la de siempre, 1 la alta sobre el castillo). */
  private arenaBlend = 0;
  /** Radio de la arena (escena) de la última partida del castillo. */
  private arenaRadiusS = 70;
  /** El castillo de la arena en la escena, también mientras la cámara vuelve. */
  private readonly arenaCastle = new Vector2();
  /** Lo mismo, en la copia del planeta que se ve ahora (las nubes de la arena). */
  private readonly arenaCastleSeen = new Vector2();
  /** El zoom de la arena (plan 015 T170): 1 la vista de salida, 0 lo más cerca. */
  private readonly arenaZoom = new ArenaZoom();
  /** Se estaba construyendo en el fotograma anterior (al abrir «Construir», la vista de salida). */
  private arenaBuilding = false;
  /** Las barras de vida y los números de daño de la arena (las opciones de la pausa). */
  private defenseOverlays: DefenseOverlayPrefs = { ...DEFAULT_DEFENSE_OVERLAYS };
  /** El resto del mundo bajo el agua durante la partida del castillo. */
  private readonly sink = new ArenaSink();
  private readonly sinkOffsets = new SinkOffsets();
  /** Las piezas fusionadas sin sitio propio (rocas, balizas…) y las orillas de todo y del castillo. */
  private statics: Mesh | null = null;
  private allShores: { x: number; z: number; r: number; w: number }[] = [];
  private castleShores: { x: number; z: number; r: number; w: number }[] = [];
  private camTuning: SurvivorsConfig['camera'] = { distanceScale: 1, heightScale: 1, blendS: 1 };
  /** Vistas escondidas por capa (`kind` de cada vista) durante la partida. */
  private readonly kindLayers = new Map<string, readonly string[]>();
  private readonly hiddenKinds = new Set<string>();
  private qualityTier: QualityTier | null = null;
  /** Lo que se enciende de cada orden del circuito (arco o boia) cuando toca pasarlo. */
  private gates = new Map<number, ((on: boolean) => void)[]>();
  /** Las boyitas de la carretera de la carrera en curso (T76). */
  private road: Group | null = null;
  /** Dónde va ahora el barco fantasma del circuito (T61); null: no se ve. */
  private ghostAt: ShipPose | null = null;
  /** El barco quieto en la salida durante la cuenta atrás (T61), o null. */
  private hold: ShipPose | null = null;
  /** El salto de las rampas del circuito (T73): sólo se ve, la simulación sigue en el agua. */
  private readonly jump = new BoatJump();
  private rampWorld: WorldConfig | null = null;
  private ramps = new Map<string, JumpSpec>();
  private splashes = 0;
  /** El material de las botellas (T56), compartido por todas. */
  private bottleMaterial: ReturnType<typeof litMaterial> | null = null;
  // Cambio de mundo por agujero negro (T41 en el 2D; aquí T51).
  private readonly vortex = new VortexPass();
  private readonly switcher: WorldSwitcher<MarScene>;
  private switchingMode: SwitchMode | null = null;
  // Modelos de Blender por distancia (T51).
  private readonly modelStore = new ModelStore();
  private readonly castleModel = new DecorModel();
  // El Vecino Quejica de Blender (T174): lo comparten el Cañón y el castillo; se carga al pedirlo la primera vista.
  private readonly vecinoModel = new EnemyModel();
  private readonly modelViews = new Map<string, ModelView>();
  private modelClock = MODEL_PLAN_S;
  // Islas de Blender (T69): cada isla del mapa tiene su hueco; las del manifiesto, modelo por distancia.
  private readonly islandModels = new Map<string, IslandModelView>();
  // Con sus clips (T112): lo que mueve un clip se junta en pocas mallas al cargar.
  private readonly islandStore = new ModelStore<string>(
    async (url) => batchAnimatedNodes(await loadGltf(url)),
    (id) => islandModelUrl(this.islandModels.get(id)?.entry ?? { file: `${id}.glb` }),
  );
  private placePoseClock = 0;

  constructor(opts: Mar3DOptions) {
    this.opts = opts;
    this.world = opts.world;
    // La sensibilidad guardada en Ajustes (REQ-MUN-008); cambiarla allí la cambia ya (T55).
    setControlSensitivity(loadSettings(browserStore()).sensitivity);
    // El planeta: el mapa con su margen da la vuelta (sólo en /mar; el 2D conserva sus costas).
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
    // Mascota en el barco provisional: en cubierta, entre el mástil y la capitana, a estribor.
    this.mascotSlot.position.set(-0.3, 0.43, 0.28);
    // Mirando hacia popa y estribor: a quien lleva el timón (la cámara va detrás).
    this.mascotSlot.rotation.y = MASCOT_YAW;
    this.boat.body.add(this.mascotSlot);
    this.scene.add(this.boat.group);
    this.scene.add(this.wake.mesh, this.marker.group, this.confetti.mesh);
    this.wings = new Wings(SHIP_LENGTH / 3);
    this.boat.group.add(this.wings.group);
    this.scene.add(this.sparks.mesh, this.splash.group, this.flightClouds.group);

    const glows: Glows[] = [];
    const shores = this.buildPlaces(glows);
    shores.push(...this.buildDecor(glows));
    this.buildGhost();
    this.route = seaRoute(this.world);
    this.routeLine = new RouteLine(
      this.route.dashes.map((d) => ({ x: toScene(d.x), z: toScene(d.y), angle: d.angle })),
    );
    curveMaterial(this.routeLine.mesh.material as MeshBasicMaterial, true);
    this.scene.add(this.routeLine.mesh);
    // Para las pruebas: cuántas marcas guían en el agua (T59: ya sin boyas de ruta).
    opts.canvas.dataset.routeMarks = String(this.route.dashes.length);
    // Para las pruebas (T96): cuántos remolinos se pintan en el mar.
    opts.canvas.dataset.remolinos = String(
      [...this.views.values()].filter((v) => v.kind === 'remolino').length,
    );
    opts.canvas.dataset.ruta = 'on';
    opts.canvas.dataset.manejo = 'crucero';
    this.water.setShores(shores);
    this.allShores = shores;
    this.glow = glowPoints(glows);
    // Cada isla con hueco sabe dónde están sus resplandores, para apagarlos con el modelo (T75).
    const starts = glowOffsets(glows);
    for (const v of this.islandModels.values()) {
      const i = v.glows ? glows.indexOf(v.glows.g) : -1;
      if (v.glows && i >= 0) v.glows.start = starts[i]!;
    }
    // Los resplandores no tienen sitio propio: cada uno va a su copia más cercana.
    curveMaterial(this.glow.material as ShaderMaterial, true);
    this.scene.add(this.glow);

    this.clouds = new Clouds(this.b);
    this.scene.add(this.clouds.group);
    this.wildlife = new Wildlife((x, z) => {
      const obstacles = [...this.runtime.solidObstacles(), ...this.decorSolids].map((o) => ({
        x: toScene(o.x),
        z: toScene(o.y),
        radius: toScene(o.radius),
      }));
      // Visual coastlines can extend beyond the collision circle. Exclude their full shore as well.
      for (const island of this.islands)
        obstacles.push({ x: island.x, z: island.z, radius: island.R * 1.15 });
      return waterClear(x, z, obstacles, this.periodS, 1.2);
    });
    this.onWildlifeMotion();
    this.wildlifeMotion.addEventListener('change', this.onWildlifeMotion);
    this.scene.add(this.wildlife.fish);
    // Todo lo demás se curva con el planeta (lo que ya está curvado se queda como está).
    curveTree(this.scene);
    // The flock crosses the camera's cloud plane; it does not bend with the sea surface.
    this.scene.add(this.wildlife.gulls);
    this.watchIslandModels();

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
    // En la arena del castillo, su zoom (plan 015 T170): nunca más abierto que la vista de salida.
    if (this.defense) {
      this.arenaZoom.by(d);
      return;
    }
    this.zoomGoal = clamp01(this.zoomGoal + d);
    // En la partida del Cañón, sin vista de mapa.
    if (this.survivors) this.zoomGoal = Math.min(this.zoomGoal, MAP_ZOOM - 0.1);
    if (this.zoomGoal < MAP_ZOOM) this.lastBoatZoom = this.zoomGoal;
  }

  get zoomLevel(): number {
    return this.zoom;
  }

  /** Vista de mapa ↔ vista de barco. */
  toggleMap(): void {
    if (this.survivors || this.defense) return;
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
    // En el aire no se cambia de rumbo (se puede «Saltar»); en la partida del Cañón, tampoco.
    if (this.flight || ((this.survivors || this.defense) && target)) return;
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
    this.jump.reset();
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
    this.jump.reset();
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
    if (this.survivors || this.defense) return false;
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
    if (this.defense) return false;
    if (this.survivors) {
      const sv = this.survivors;
      if (
        !this.inputEnabled ||
        sv.run.game.status !== 'running' ||
        sv.turboPending ||
        sv.run.snapshot().movement.cooldownS > 1e-6
      )
        return false;
      sv.turboPending = true;
      return true;
    }
    if (this.turboCool > 0) return false;
    this.turboLeft = TURBO_S;
    this.turboCool = TURBO_COOLDOWN_S;
    this.fovKick = 1;
    return true;
  }

  /**
   * Estela del barco con su tinte; no toca la física.
   */
  setShipDressing(d: ShipDressing): void {
    this.dressing = d;
    this.wake.setTint(d.wakeTint);
    this.wake.setStyle(d.wakeStyle);
    this.opts.canvas.dataset.estela = d.wakeStyle;
    this.placeMascot();
  }

  /**
   * La mascota (plan 013 T154, plan 015 T175): va con el barco en todo /mar
   * (navegando, en las carreras y en el Cañón), animada, y no toca la física.
   * El minikraken y el Cañoncito, en cubierta (el mismo hueco); la Tortuga
   * turbo, nadando detrás. Se rehace sólo si cambia. El lienzo lo cuenta en
   * `data-mascota` y, las de Blender, en `data-mascota-modelo` (pruebas).
   */
  private placeMascot(): void {
    const kind = this.dressing.mascot;
    if (this.mascotKind === kind) return;
    if (this.mascot) {
      this.mascotSlot.remove(this.mascot.group);
      this.mascot.dispose();
      this.mascot = null;
    }
    if (this.tortuga) {
      this.scene.remove(this.tortuga.group);
      this.tortuga.dispose();
      this.tortuga = null;
    }
    if (kind === 'minikraken') {
      this.mascot = createMinikraken(this.quality);
      curveTree(this.mascot.group);
      this.mascotSlot.add(this.mascot.group);
    } else if (kind === 'canoncito') {
      this.mascot = createCanoncito(this.quality, this.mascotModels.get('canoncito'));
      curveTree(this.mascot.group);
      this.mascotSlot.add(this.mascot.group);
    } else if (kind === 'tortuga-turbo') {
      this.tortuga = createTortuga(this.quality, this.mascotModels.get('tortuga-turbo'));
      curveTree(this.tortuga.group);
      this.scene.add(this.tortuga.group);
    }
    if (kind) this.opts.canvas.dataset.mascota = kind;
    else delete this.opts.canvas.dataset.mascota;
    this.noteMascotModel();
  }

  /** La mascota puesta ahora (por si `dressing` cambia a la misma). */
  private get mascotKind(): MascotKind | null {
    if (this.tortuga) return 'tortuga-turbo';
    if (!this.mascot) return null;
    return this.mascot.group.name === 'canoncito' ? 'canoncito' : 'minikraken';
  }

  /** `data-mascota-modelo`: cómo va el modelo de Blender de la mascota puesta (si lo tiene). */
  private noteMascotModel(): void {
    const state = this.tortuga?.modelState ?? (this.mascot as Canoncito | null)?.modelState;
    if (state) this.opts.canvas.dataset.mascotaModelo = state;
    else delete this.opts.canvas.dataset.mascotaModelo;
  }

  /** ¿Hay un lugar cerca del barco? (la mascota saluda). Se mira dos veces por segundo. */
  private nearPlace(dt: number): boolean {
    this.mascotCheck -= dt;
    if (this.mascotCheck > 0) return this.mascotWave;
    this.mascotCheck = 0.5;
    const bx = this.boat.group.position.x;
    const bz = this.boat.group.position.z;
    const r2 = MINIKRAKEN_WAVE_DISTANCE * MINIKRAKEN_WAVE_DISTANCE;
    let near = false;
    for (const v of this.views.values()) {
      const dx = v.obj.position.x - bx;
      const dz = v.obj.position.z - bz;
      if (dx * dx + dz * dz < r2) {
        near = true;
        break;
      }
    }
    this.mascotWave = near;
    return near;
  }

  /** Pone el barco del 2D (su modelo de Blender) en lugar del provisional. */
  setShipModel(m: ShipModel): void {
    const body = this.boat.body;
    for (const c of [...body.children]) {
      if (c === this.boat.crewSlot || c === this.mascotSlot) continue;
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
    // La mascota (T154): hacia popa, de cara a la cámara, sobre lo más alto
    // que haya ahí (la cubierta o, si hay toldo, el techo).
    const mx = -SHIP_LENGTH * MASCOT_BACK;
    const mz = SHIP_LENGTH * MASCOT_SIDE;
    this.mascotSlot.position.set(mx, surfaceY(m.object, mx, mz) ?? this.boat.crewSlot.position.y, mz);
    this.sternX = -SHIP_LENGTH / 2;
  }

  setPassenger(on: boolean): void {
    if (on && !this.crew) {
      this.crew = createMascot(this.faces.party, { cap: 'party', band: C.yellow, scale: 0.32 });
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
    this.confetti.burst(x, (v && placeId ? this.labelYOf(placeId, v) : 3) * 0.6, z);
  }

  /** Pone un elemento HTML sobre un lugar (o sobre el barco) y lo sigue. */
  anchor(el: HTMLElement | null, target: string, dy = 0): void {
    const i = this.anchors.findIndex((a) => a.target === target);
    if (i >= 0) this.anchors.splice(i, 1);
    if (el) this.anchors.push({ el, target, dy });
  }

  /** Posición visible en px de la ventana, desde u del mundo o el barco interpolado. */
  screenPosition(
    target: 'boat' | { x: number; y: number; height?: number } | { defense: { x: number; y: number } },
  ): { x: number; y: number } | null {
    let x: number, y: number, z: number;
    if (target === 'boat') {
      const p = this.boat.group.position;
      x = p.x;
      y = p.y + 0.6;
      z = p.z;
    } else if ('defense' in target) {
      if (!this.defense) return null;
      // El mismo marco y la misma copia del mundo que usa el modelo de la isla.
      const p = this.defense.view.at(target.defense.x, target.defense.y);
      x = p.x;
      y = 0.5;
      z = p.z;
    } else {
      x = this.wrapC.x + wrapD(toScene(target.x) - this.wrapC.x, this.periodS.w);
      z = this.wrapC.y + wrapD(toScene(target.y) - this.wrapC.y, this.periodS.h);
      y = target.height ?? 0.5;
    }
    const out = { x: 0, y: 0, on: false };
    this.project(x, y, z, out);
    const canvas = this.opts.canvas;
    if (
      !out.on ||
      out.x < 0 ||
      out.y < 0 ||
      out.x > canvas.clientWidth ||
      out.y > canvas.clientHeight ||
      this.hidden(x, y, z)
    )
      return null;
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + out.x, y: rect.top + out.y };
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
        w: 0,
        h: 0,
        look: '',
      });
    }
  }

  /**
   * Las botellas del mar (T56): una botella de cristal tumbada que flota en
   * cada sitio (u de motor de este mundo), con el corcho naranja la propia.
   * Cambiar la lista las cambia todas. Para las pruebas, sus ids en
   * `data-bottles` del lienzo.
   */
  setBottles(list: readonly { id: string; x: number; y: number; mine: boolean }[]): void {
    for (const [id, v] of this.views) {
      if (!id.startsWith(BOTTLE_VIEW)) continue;
      this.scene.remove(v.obj);
      v.obj.traverse((o) => (o as Mesh).geometry?.dispose());
      this.views.delete(id);
    }
    this.bottleMaterial?.dispose();
    this.bottleMaterial = null;
    if (list.length) {
      const mat = litMaterial();
      this.bottleMaterial = mat;
      for (const b of list) {
        const k = new Kit();
        k.add(new CylinderGeometry(0.3, 0.3, 0.95, 10), '#8fd3b8');
        k.add(new CylinderGeometry(0.13, 0.28, 0.32, 10), '#8fd3b8', { p: [0, 0.62, 0] });
        k.add(new CylinderGeometry(0.12, 0.12, 0.2, 8), b.mine ? C.orange : C.wood, {
          p: [0, 0.86, 0],
        });
        // El mensaje enrollado, dentro.
        k.add(new CylinderGeometry(0.14, 0.14, 0.6, 8), C.cream, { p: [0, 0.02, 0] });
        const body = new Mesh(k.build(), mat);
        body.rotation.z = 1.25;
        body.position.y = 0.12;
        const g = new Group();
        g.add(body);
        g.position.set(toScene(b.x), 0, toScene(b.y));
        curveTree(g);
        this.addView({
          id: BOTTLE_VIEW + b.id,
          obj: g,
          kind: 'botella',
          y: 0,
          phase: (seedOf(b.id) % 628) / 100,
          labelY: 1.2,
          update: bob(0.1),
        });
      }
    }
    this.opts.canvas.dataset.bottles = list.map((b) => b.id).join(' ');
  }

  /** El impulso de una rampa (T73) lanza el barco al aire. */
  private jumpOn(e: WorldEvent): void {
    if (e.type !== 'effect' || e.effect !== 'boost' || this.flight) return;
    if (this.rampWorld !== this.world) {
      this.rampWorld = this.world;
      this.ramps = rampsOf(this.world);
    }
    const spec = this.ramps.get(e.objectId);
    if (!spec) return;
    for (const j of this.jump.launch(e.objectId, spec, this.time)) {
      this.opts.canvas.dataset.salto = 'aire';
      this.opts.onJump?.(j);
    }
  }

  /** Cae al agua: chapuzón alrededor del casco y un golpe de cámara. */
  private landJump(): void {
    for (const j of this.jump.tick(this.time)) {
      const bp = this.boat.group.position;
      this.splash.burst(bp.x, bp.z, 1);
      this.shake = Math.max(this.shake, 0.3);
      this.splashes++;
      this.opts.canvas.dataset.salto = 'agua';
      this.opts.canvas.dataset.chapuzones = String(this.splashes);
      this.opts.onJump?.(j);
    }
  }

  /**
   * Las marcas amarillas de la ruta entre islas, fuera durante la carrera
   * (decisión 13, T88): `true` desde la cuenta atrás; `false` al acabar, al
   * anularse o al cambiar de mundo. Para las pruebas, `data-ruta` del lienzo.
   */
  setRouteHidden(hidden: boolean): void {
    this.routeLine.setSuppressed(hidden);
    const on = hidden ? 'off' : 'on';
    if (this.opts.canvas.dataset.ruta !== on) this.opts.canvas.dataset.ruta = on;
  }

  /** ¿Están fuera las marcas amarillas de la ruta? */
  get routeHidden(): boolean {
    return this.opts.canvas.dataset.ruta === 'off';
  }

  /**
   * Los peces y las gaviotas fuera (T120: durante la partida del Cañón) o de
   * vuelta. Para las pruebas, `data-fauna-oculta` del lienzo.
   */
  setWildlifeHidden(hidden: boolean): void {
    this.wildlife.setHidden(hidden);
    if (hidden) this.opts.canvas.dataset.faunaOculta = 'on';
    else delete this.opts.canvas.dataset.faunaOculta;
  }

  get wildlifeHidden(): boolean {
    return this.wildlife.isHidden;
  }

  /**
   * Esconde (o, con null, vuelve a enseñar) las vistas de esos `kind` bajo
   * el nombre de una capa (T99: botellas, descuentos y encuentros durante la
   * partida del Cañón). Para las pruebas, `data-escondido` del lienzo.
   */
  setKindsHidden(layer: string, kinds: readonly string[] | null): void {
    if (kinds) this.kindLayers.set(layer, kinds);
    else this.kindLayers.delete(layer);
    this.hiddenKinds.clear();
    for (const list of this.kindLayers.values()) for (const k of list) this.hiddenKinds.add(k);
    const names = [...this.kindLayers.keys()].join(' ');
    if (names) this.opts.canvas.dataset.escondido = names;
    else delete this.opts.canvas.dataset.escondido;
  }

  isKindsHidden(layer: string): boolean {
    return this.kindLayers.has(layer);
  }

  /** La calidad de este dispositivo (los topes de la partida del Cañón la usan). */
  get quality(): QualityTier {
    if (!this.qualityTier) {
      const nav = navigator as Navigator & {
        deviceMemory?: number;
        connection?: { saveData?: boolean };
      };
      let touch = false;
      try {
        touch = window.matchMedia('(pointer: coarse)').matches;
      } catch {
        // Sin matchMedia: no se sabe, y lo que no se sabe no baja la calidad.
      }
      this.qualityTier = detectQuality({
        deviceMemory: nav.deviceMemory,
        hardwareConcurrency: nav.hardwareConcurrency,
        saveData: nav.connection?.saveData,
        touch,
        maxTextureSize: this.renderer.capabilities.maxTextureSize,
      });
    }
    return this.qualityTier;
  }

  /** El decorado sólido propio de `/mar` (u de motor), con el que también choca el barco. */
  get solidDecor(): readonly Circle[] {
    return this.decorSolids;
  }

  /**
   * Empieza la partida del Cañón donde está el barco (T99): la simulación
   * lo lleva desde ahora, la cámara se aleja y sube (suave) y sus piezas se
   * pintan. Sin viaje, rumbo ni vista de mapa mientras. false si no
   * se puede (en vuelo, cambiando de mundo o con otra en curso).
   */
  startSurvivors(run: SurvivorsRun): boolean {
    if (this.survivors || this.defense || this.flight || this.switcher.locked) return false;
    this.stopVoyage();
    this.clearCourse();
    this.hold = null;
    this.turboLeft = 0;
    this.jump.reset();
    this.opts.canvas.dataset.salto = 'agua';
    this.backToBoat();
    const view = new SurvivorsView(run.config, run.game.caps, {
      quality: run.quality,
      reduced: this.reducedMotion,
      // La gaviota vuela por encima de las islas (T126).
      groundAt: (x, z) => this.groundAt(x, z),
      // El Kraken tiende los brazos hacia la isla que agarra (T142).
      sea: run.game.world,
      vecinoModel: this.vecinoModel,
    });
    this.scene.add(view.group);
    this.camTuning = run.config.camera;
    this.survivors = {
      run,
      view,
      player: run.snapshot().player,
      turboPending: false,
      seen: new Set(),
      weaponsSeen: new Set(),
      seenAt: -1,
    };
    this.syncHandling();
    run.tick(performance.now(), false);
    this.opts.canvas.dataset.canon = 'on';
    this.opts.canvas.dataset.derrota = view.defeatStyle;
    return true;
  }

  /**
   * El estilo de derrota de la partida en curso (T117): `puf` o
   * `sumergirse`. El interruptor de desarrollo lo cambia en vivo para
   * compararlos; sin partida no hace nada.
   */
  setSurvivorsDefeatStyle(style: DefeatStyle): void {
    const sv = this.survivors;
    if (!sv) return;
    sv.view.setDefeatStyle(style);
    this.opts.canvas.dataset.derrota = style;
  }

  /** El usuario prefiere menos movimiento (sin parpadeo, sin temblor, efectos mínimos). */
  private get reducedMotion(): boolean {
    return this.wildlifeMotion.matches;
  }

  /** Acaba la partida (si la hay): el barco se queda donde acabó y la cámara vuelve suave. */
  stopSurvivors(): void {
    const sv = this.survivors;
    if (!sv) return;
    this.survivors = null;
    sv.view.dispose();
    this.boat.group.visible = true;
    this.opts.canvas.dataset.salto = 'agua';
    delete this.opts.canvas.dataset.canonTurbo;
    delete this.opts.canvas.dataset.canonTurboCooldown;
    delete this.opts.canvas.dataset.canonSpeed;
    delete this.opts.canvas.dataset.derrota;
    delete this.opts.canvas.dataset.canonVista;
    delete this.opts.canvas.dataset.canonVistos;
    delete this.opts.canvas.dataset.canonArmas;
    delete this.opts.canvas.dataset.canonArmasVista;
    delete this.opts.canvas.dataset.canonArmasVistas;
    delete this.opts.canvas.dataset.canonJefesVista;
    delete this.opts.canvas.dataset.canonJefesVistos;
    delete this.opts.canvas.dataset.canonBoss;
    delete this.opts.canvas.dataset.canonBossVista;
    delete this.opts.canvas.dataset.canonVecino;
    this.prev.x = this.ship.x;
    this.prev.y = this.ship.y;
    this.prev.heading = this.ship.heading;
    this.acc = 0;
    this.opts.canvas.dataset.canon = 'off';
  }

  /**
   * Qué tipos de enemigo se ven ahora en pantalla (T126): cada pieza en su
   * copia más cercana al foco, bajada por la curva del planeta, dentro de la
   * vista y no tras el horizonte. Va a `data-canon-vista` (ahora) y
   * `data-canon-vistos` (en toda la partida), para las pruebas.
   */
  private markSurvivorsOnScreen(
    sv: NonNullable<Mar3D['survivors']>,
    t: number,
    fx: number,
    fz: number,
  ): void {
    sv.seenAt = t;
    const P = this.periodS;
    const cam = this.camera.position;
    const bend = this.bend;
    const onScreen = (x: number, y: number, z: number, r: number) => {
      const px = fx + wrapD(x - fx, P.w);
      const pz = fz + wrapD(z - fz, P.h);
      const d = Math.hypot(px - cam.x, pz - cam.z);
      const drop = bendDrop(bend, d);
      tmpSphere.center.set(px, y - drop, pz);
      tmpSphere.radius = r;
      return (
        this.frustum.intersectsSphere(tmpSphere) &&
        !behindPlanet(cam.y, Math.max(0, d - r), y + r - drop, bend)
      );
    };
    const now = sv.view.typesWhere(onScreen);
    for (const id of now) sv.seen.add(id);
    const vista = now.join(' ');
    const ds = this.opts.canvas.dataset;
    if (ds.canonVista !== vista) ds.canonVista = vista;
    const vistos = [...sv.seen].sort().join(' ');
    if (ds.canonVistos !== vistos) ds.canonVistos = vistos;
    // T140: los bosses vivos («fantasma:solid», T142: «kraken:submerged») y los que están en pantalla, para las pruebas.
    const boss = sv.run
      .snapshot()
      .bosses.map((b) =>
        b.fantasma
          ? `${b.boss}:${b.fantasma.mode}`
          : b.kraken
            ? `${b.boss}:${b.kraken.mode}`
            : b.boss,
      )
      .join(' ');
    const bossVista = sv.view.bossesWhere(onScreen).join(' ');
    if (ds.canonBoss !== boss) ds.canonBoss = boss;
    if (ds.canonBossVista !== bossVista) ds.canonBossVista = bossVista;
    // T128: populated mesh matrices, not inventory. Retain intermittent shots.
    const counts = sv.view.weapons.counts();
    const visible = sv.view.weapons.counts(onScreen);
    for (const id of Object.keys(visible)) sv.weaponsSeen.add(id);
    const armas = Object.entries(counts).map(([id, n]) => `${id}:${n}`).sort().join(' ');
    const armasVista = Object.entries(visible).map(([id, n]) => `${id}:${n}`).sort().join(' ');
    const armasVistas = [...sv.weaponsSeen].sort().join(' ');
    if (ds.canonArmas !== armas) ds.canonArmas = armas;
    if (ds.canonArmasVista !== armasVista) ds.canonArmasVista = armasVista;
    if (ds.canonArmasVistas !== armasVistas) ds.canonArmasVistas = armasVistas;
    // T139: el Tiburón Martillo y los cofres, ahora y en toda la partida.
    const jefes = sv.view.shark.markSeen(onScreen);
    const jefesVista = jefes.now.join(' ');
    const jefesVistos = jefes.seen.join(' ');
    if (ds.canonJefesVista !== jefesVista) ds.canonJefesVista = jefesVista;
    if (ds.canonJefesVistos !== jefesVistos) ds.canonJefesVistos = jefesVistos;
  }

  /**
   * Empieza «Defensa del Castillo» (plan 014 T160, decisiones 4, 5 y 7): la
   * partida va en el marco de la isla del castillo (el vórtice hacia el mar
   * abierto); el resto del mundo se hunde, la cámara sube sobre el castillo y
   * el barco vuela con las alas de «Entradas» por la arena. false si no se
   * puede (en vuelo, cambiando de mundo, con otra partida o sin castillo).
   */
  startDefense(run: DefenseRun): boolean {
    if (this.survivors || this.defense || this.flight || this.switcher.locked) return false;
    const castle = this.world.objects.find((o) => o.identity.id === CASTLE_PLACE_ID);
    if (!castle) return false;
    this.stopVoyage();
    this.clearCourse();
    this.hold = null;
    this.turboLeft = 0;
    this.jump.reset();
    this.pan.set(0, 0);
    const frame = arenaFrame(castle.position, run.game.path);
    const view = new DefenseView({
      config: run.config,
      path: run.game.path,
      frame,
      quality: run.quality,
      reduced: this.reducedMotion,
      vecinoModel: this.vecinoModel,
    });
    view.setOverlays(this.defenseOverlays);
    this.scene.add(view.group);
    // Cada partida empieza en la vista de salida (plan 015 T170).
    this.arenaZoom.reset(true);
    this.arenaBuilding = false;
    const s = this.ship;
    this.defense = {
      run,
      view,
      frame,
      castle: { x: toScene(castle.position.x), z: toScene(castle.position.y) },
      before: { x: s.x, y: s.y, heading: s.heading },
      seenAt: -1,
    };
    this.arenaCastle.set(this.defense.castle.x, this.defense.castle.z);
    this.arenaRadiusS = toScene(run.config.arenaRadius);
    this.sink.set(true);
    this.water.setShores(this.castleShores);
    this.placePlane(run);
    Object.assign(this.prev, { x: s.x, y: s.y, heading: s.heading });
    run.tick(performance.now(), false);
    const ds = this.opts.canvas.dataset;
    ds.arena = 'on';
    const v = vortexSpot(frame, run.game.path);
    const vp = this.inPlanet(v.x, v.y);
    ds.vortice = `${Math.round(vp.x)},${Math.round(vp.y)}`;
    return true;
  }

  /**
   * Acaba la partida del castillo (si la hay): el vórtice, el camino y lo
   * demás se van, el mundo vuelve a salir del agua, la cámara baja y el barco
   * vuelve al agua donde estaba al empezar.
   */
  stopDefense(): void {
    const df = this.defense;
    if (!df) return;
    this.defense = null;
    df.view.dispose();
    this.sink.set(false);
    this.water.setShores(this.allShores);
    this.air = 0;
    this.wings.set(0, 0, this.time);
    this.boat.group.visible = true;
    const p = this.freePoint(df.before.x, df.before.y);
    Object.assign(this.ship, { x: p.x, y: p.y, vx: 0, vy: 0, heading: df.before.heading });
    Object.assign(this.prev, { x: p.x, y: p.y, heading: df.before.heading });
    this.acc = 0;
    const ds = this.opts.canvas.dataset;
    ds.arena = 'off';
    for (const k of [
      'vortice',
      'arenaEnemigos',
      'arenaTipos',
      'arenaFuera',
      'arenaIslas',
      'arenaEfectos',
      'castilloVista',
      'arenaAvion',
      'arenaColocar',
      'arenaElegida',
      'arenaIslasPantalla',
      'arenaToque',
      'arenaToqueTipo',
      'arenaVecino',
      'arenaMotivo',
      'arenaZoom',
      'arenaAlcance',
      'arenaDestino',
      'arenaBarras',
      'arenaNumeros',
      'arenaMonedas',
      'arenaMonedaUltima',
      'arenaNubes',
    ])
      delete ds[k];
  }

  /** ¿Hay una partida del castillo en curso? */
  get defenseActive(): boolean {
    return this.defense !== null;
  }

  /** El anillo de construir alrededor del avión (T161 lo enciende al construir). */
  setDefenseBuilding(on: boolean): void {
    this.defense?.view.setBuilding(on);
  }

  /**
   * Las barras de vida y los números de daño de la arena (plan 015 T170,
   * decisión 11): las opciones de la pausa; valen también para la partida
   * siguiente.
   */
  setDefenseOverlays(prefs: DefenseOverlayPrefs): void {
    this.defenseOverlays = { bars: prefs.bars, numbers: prefs.numbers };
    this.defense?.view.setOverlays(this.defenseOverlays);
  }

  /** El zoom de la arena ahora (1 la vista de salida, 0 lo más cerca; pruebas). */
  get arenaZoomLevel(): number {
    return this.arenaZoom.value;
  }

  /** El barco donde está el avión de la partida (u del planeta). */
  private placePlane(run: DefenseRun): void {
    const df = this.defense!;
    const pl = run.game.snapshot().plane;
    const w = df.frame.toWorld(pl.x, pl.y);
    const p = this.inPlanet(w.x, w.y);
    const s = this.ship;
    s.x = p.x;
    s.y = p.y;
    const v = df.frame.toWorld(pl.vx, pl.vy);
    s.vx = v.x - df.frame.cx;
    s.vy = v.y - df.frame.cy;
    s.heading = df.frame.headingToWorld(pl.heading);
  }

  /**
   * Los pasos de la partida del castillo que tocan (T160): el reloj de la
   * partida dice cuántos; cada uno lleva el mando (las flechas o el dedo,
   * como al navegar) girado al marco de la partida. El barco de la escena es
   * el avión. Sin runtime del mundo mientras.
   */
  private stepDefense(now: number): void {
    const df = this.defense!;
    const run = df.run;
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const n = run.tick(now, hidden);
    const s = this.ship;
    for (let i = 0; i < n && this.defense === df && !run.ended; i++) {
      this.prev.x = s.x;
      this.prev.y = s.y;
      this.prev.heading = s.heading;
      const input = this.inputEnabled ? this.readInput() : IDLE_INPUT;
      const len = Math.hypot(input.dirX, input.dirY);
      const move =
        len > 1e-6 && input.throttle > 0
          ? df.frame.dirToSim(
              (input.dirX / len) * input.throttle,
              (input.dirY / len) * input.throttle,
            )
          : null;
      const events = run.step(move);
      for (let k = 0; k < events.length; k++) {
        const e = events[k]!;
        if (e.type === 'castleHit') {
          df.view.castleHit(this.time);
          this.shake = Math.max(this.shake, hitShake(this.reducedMotion) * 0.6);
        } else if (e.type === 'kill') {
          df.view.defeat(e.x, e.y, 16, this.time);
        }
      }
      this.placePlane(run);
      const dh = Math.atan2(
        Math.sin(s.heading - this.prev.heading),
        Math.cos(s.heading - this.prev.heading),
      );
      this.turnRate += (dh / STEP - this.turnRate) * Math.min(1, STEP * 6);
    }
    this.acc = 0;
  }

  /**
   * Lo que se ve de la arena, para las pruebas (cada 0,25 s): el castillo en
   * pantalla (`data-castillo-vista`), los enemigos pintados y sus tipos, los
   * que se salen del carril (`data-arena-fuera`, siempre 0), las islas
   * construidas, los efectos de ahora y el avión.
   */
  private markArena(t: number): void {
    const df = this.defense!;
    df.seenAt = t;
    const ds = this.opts.canvas.dataset;
    const castle = this.views.get(CASTLE_PLACE_ID);
    const set = (k: string, v: string) => {
      if (ds[k] !== v) ds[k] = v;
    };
    set('castilloVista', castle?.obj.visible ? 'si' : 'no');
    set('arenaEnemigos', String(df.view.drawn));
    set('arenaTipos', df.view.drawnKinds().join(' '));
    set('arenaVecino', df.view.vecinoState);
    const snap = df.run.snapshot();
    const path = df.run.game.path;
    let out = 0;
    for (const e of snap.enemies) {
      if (!e.dead && path.distanceTo(e.x, e.y) > path.width / 2 + 1) out++;
    }
    set('arenaFuera', String(out));
    set('arenaIslas', String(df.view.islands.count));
    set(
      'arenaEfectos',
      Object.entries(df.view.fx.drawn)
        .filter(([, n]) => n > 0)
        .map(([k]) => k)
        .sort()
        .join(' '),
    );
    set('arenaAvion', `${Math.round(snap.plane.x)},${Math.round(snap.plane.y)}`);
    // El HUD (T161): la vista previa al colocar ('ok', 'no' o nada), la isla
    // elegida y dónde se ve cada isla en la pantalla (px del lienzo), para tocarla.
    set('arenaColocar', df.view.marked.preview);
    set('arenaElegida', df.view.marked.selected ? 'si' : 'no');
    // Plan 015 T170: el motivo de la vista previa roja, el alcance pintado
    // (u de la partida), el zoom de la arena, adonde vuela el avión tras un
    // toque, las barras de vida y los números de daño pintados y las nubes.
    set('arenaMotivo', df.view.marked.reason);
    set('arenaAlcance', String(Math.round(fromScene(df.view.range))));
    set('arenaZoom', this.arenaZoom.value.toFixed(2));
    const tg = snap.plane.target;
    set('arenaDestino', tg ? `${Math.round(tg.x)},${Math.round(tg.y)}` : '');
    set('arenaBarras', String(df.view.bars.drawn));
    set('arenaNumeros', String(df.view.numbers.live));
    // T178: los «+N» de Ibiza que han saltado desde el principio.
    set('arenaMonedas', String(df.view.coinPops.spawned));
    // Plan 016 T183: lo que pagó la última («+N»).
    set('arenaMonedaUltima', String(df.view.coinPops.lastValue));
    set('arenaNubes', df.view.clouds.group.visible ? 'si' : 'no');
    const spots: string[] = [];
    for (const tw of snap.towers) {
      const p = df.view.at(tw.x, tw.y);
      this.project(p.x, 0.5, p.z, this.scr);
      if (this.scr.on) spots.push(`${tw.id}:${Math.round(this.scr.x)},${Math.round(this.scr.y)}`);
    }
    set('arenaIslasPantalla', spots.join(' '));
  }

  /** ¿Hay una partida del Cañón en curso? */
  get survivorsActive(): boolean {
    return this.survivors !== null;
  }

  /** Cooldown que se registra en el estado inicial de la partida del Cañón. */
  get turboCooldownS(): number {
    return Math.max(0, this.turboCool);
  }

  /** Semáforo del circuito: apagado, rojo, ámbar o verde. */
  setSemaphore(state: 'off' | 'red' | 'amber' | 'green'): void {
    const on = { off: -1, red: 0, amber: 1, green: 2 }[state];
    const base = ['#5a1a1a', '#5a4a1a', '#1a4a2a'];
    const lit = ['#ff3b30', '#ffc53d', '#3dff7a'];
    this.semaphore.forEach((m, i) => m.color.set(i === on ? lit[i]! : base[i]!));
  }

  /** Resalta la boia (o el arco de salida, orden 0) que toca pasar (null: ninguna). */
  setNextGate(order: number | null): void {
    for (const [o, marks] of this.gates) {
      for (const mark of marks) mark(o === order);
    }
  }

  /**
   * Las boyitas de los lados de la carretera de la carrera (T76): en u de
   * motor, las de la derecha y las de la izquierda de la marcha; null las quita.
   */
  setRoad(marks: { right: Point2[]; left: Point2[] } | null): void {
    if (this.road) {
      this.scene.remove(this.road);
      this.road.traverse((o) => {
        const m = o as Mesh;
        m.geometry?.dispose();
        (m.material as { dispose?(): void } | undefined)?.dispose?.();
      });
      this.road = null;
    }
    const on = marks ? 'on' : 'off';
    if (this.opts.canvas.dataset.carretera !== on) this.opts.canvas.dataset.carretera = on;
    if (!marks) return;
    const at = (p: Point2): [number, number] => [toScene(p.x), toScene(p.y)];
    this.road = roadMarkers(marks.right.map(at), marks.left.map(at));
    // Una pieza fusionada sin sitio propio: se curva con el planeta y cada
    // boyita va a la copia más cercana al foco (si no, flotan en el cielo).
    curveTree(this.road, true);
    this.scene.add(this.road);
  }

  /**
   * El barco fantasma del circuito (T61): dónde va ahora la mejor carrera
   * guardada (u de motor), o null para esconderlo.
   */
  setGhost(pose: ShipPose | null): void {
    this.ghostAt = pose;
    const on = pose ? 'on' : 'off';
    if (this.opts.canvas.dataset.ghost !== on) this.opts.canvas.dataset.ghost = on;
  }

  /**
   * Deja el barco quieto en `pose` (la salida durante la cuenta atrás, T61):
   * no se mueve ni gobierna hasta `holdShip(null)`. El mundo sigue vivo.
   */
  holdShip(pose: ShipPose | null): void {
    this.hold = pose;
    // Lo que se pulse durante la cuenta atrás no mueve el barco, pero sigue pulsado al «¡Ya!».
    if (pose) this.stopVoyage();
  }

  dialogue(): DialogueView | null {
    return this.runtime.dialogue();
  }

  destroy(): void {
    this.destroyed = true;
    this.stopSurvivors();
    this.stopDefense();
    this.switcher.destroy();
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.unbindInput();
    for (const p of this.pins) p.el.remove();
    this.stickEl.remove();
    this.wildlifeMotion.removeEventListener('change', this.onWildlifeMotion);
    this.wildlife.dispose();
    this.scene.traverse((o) => {
      const m = o as Mesh;
      m.geometry?.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.modelStore.destroy();
    this.castleModel.destroy();
    this.vecinoModel.destroy();
    this.mascot?.dispose();
    this.tortuga?.dispose();
    this.mascotModels.destroy();
    for (const v of this.islandModels.values()) {
      v.motion?.dispose();
      v.motion = null;
    }
    this.islandStore.destroy();
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
   * El decorado propio del planeta (Explanada, islote de la cueva): vistas
   * sin lugar del mapa, sólidas para el barco. Devuelve sus orillas. El
   * castillo es desde T157 una isla del mapa (`buildPlaces`).
   */
  private buildDecor(glows: Glows[]): { x: number; z: number; r: number; w: number }[] {
    const shores: { x: number; z: number; r: number; w: number }[] = [];
    const lit = litMaterial();
    for (const spot of decorSpots(this.world)) {
      const build = buildDecor(spot.kind);
      const g = new Group();
      g.position.set(spot.x, 0, spot.z);
      const fallback = new Mesh(build.parts.lit.build(), lit);
      g.add(fallback);
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

      // Un objeto nuevo del Admin con su archivo subido (T241): el archivo, no la categoría.
      if (hasUploadedArt(o.appearance.asset)) {
        this.buildUploadedArt(o, x, z, r, phase, lit);
        continue;
      }
      if (cat === 'isla' || cat === 'naufrago') {
        const R = cat === 'isla' ? r : Math.max(1.5, r * 1.2);
        // El castillo (T157): la isla del minijuego es el castillo de Santa Bárbara de
        // siempre (su composición a mano y, al llegar, su modelo de Blender).
        const castle = id === CASTLE_PLACE_ID;
        const build = castle
          ? buildDecor('castillo')
          : cat === 'isla'
            ? buildIsland(id, R)
            : buildSandbank(R);
        const g = new Group();
        g.position.set(x, 0, z);
        // La composición a mano va en un hueco: si la isla tiene modelo de Blender (T69), lo sustituye de cerca.
        const fallback = new Group();
        fallback.add(new Mesh(build.parts.lit.build(), lit));
        if (!build.parts.glow.empty) {
          fallback.add(
            new Mesh(build.parts.glow.build(), new MeshBasicMaterial({ vertexColors: true })),
          );
        }
        for (const a of build.animated) fallback.add(a);
        if (build.update) this.animated.push(build.update);
        // Lo animado que sigue con el modelo puesto (T166: el haz del faro) va fuera de la
        // composición; cuelga del grupo de la isla, así que se hunde y vuelve con ella (T160).
        const keep = build.keep ?? [];
        if (castle) {
          g.add(fallback, ...keep);
          void this.castleModel.mount(g, fallback, curveTree).then((loaded) => {
            if (!this.destroyed)
              this.opts.canvas.dataset.castilloModelo = loaded ? 'glb' : 'procedural';
          });
        } else if (cat === 'isla') {
          const slot = modelSlot(fallback);
          // Sin nada que guardar, nada: `add()` vacío avisa en la consola (T165).
          if (keep.length) slot.add(...keep);
          g.add(slot);
          this.islandModels.set(id, {
            slot,
            fallback,
            R,
            entry: null,
            model: null,
            acquired: false,
            state: 'procedural',
            glow: null,
            glows: { g: build.parts.glows, start: 0 },
            motion: null,
          });
        } else {
          g.add(fallback, ...keep);
        }
        const gl = build.parts.glows;
        for (let i = 0; i < gl.pos.length; i += 3) {
          gl.pos[i] = gl.pos[i]! + x;
          gl.pos[i + 2] = gl.pos[i + 2]! + z;
        }
        glows.push(gl);
        this.islands.push({ x, z, R, build });
        this.islandRadius.set(id, R);
        // Su orilla (el puerto, T108: sólo bajo la tierra de atrás; la dársena, honda).
        for (const sh of islandShores(build, R)) {
          shores.push({ x: x + sh.dx, z: z + sh.dz, r: sh.r, w: sh.w });
          // La del castillo se queda cuando lo demás se hunde (T160).
          if (castle) this.castleShores.push({ x: x + sh.dx, z: z + sh.dz, r: sh.r, w: sh.w });
        }
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
            mascot.rotation.y = BOIA_FACING;
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
          const mascot = createMascot(this.faces.party, {
            cap: 'party',
            band: C.yellow,
            scale: 0.55,
          });
          mascot.rotation.y = BOIA_FACING;
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
          m.position.set(x, WHIRLPOOL_LIFT, z);
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
          if (gate.order > 0) {
            // Las boias que hay que pasar (T61): numeradas, con su aro de paso.
            const reach = toScene(o.geometry.activation?.radius ?? 40);
            const b: RaceBuoy = raceBuoy(gate.order, reach);
            b.group.position.set(x, 0, z);
            const marks = this.gates.get(gate.order) ?? [];
            marks.push((on) => b.setNext(on));
            this.gates.set(gate.order, marks);
            this.addView({
              id,
              obj: b.group,
              kind: 'circuito',
              y: 0,
              phase,
              labelY: 5,
              update: (_v, t) => b.update(t),
            });
            break;
          }
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
          // La salida es también la meta (T61); el rótulo lo da la web traducido.
          const text = this.opts.raceStartLabel ?? 'SALIDA';
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
          const marks = this.gates.get(gate.order) ?? [];
          marks.push((on) => bannerMat.color.set(on ? '#ffd23f' : '#fff4e2'));
          this.gates.set(gate.order, marks);
          g.position.set(x, 0, z);
          g.rotation.y = -gate.dir;
          this.addView({ id, obj: g, kind: 'circuito', y: 0, phase, labelY: 5 });
          break;
        }
        case 'impulso': {
          // Impulsos en el agua del circuito (T61): flechas que se encienden hacia delante.
          const heading = typeof o.params?.heading === 'number' ? o.params.heading : 0;
          const pad: BoostPad = boostPad(toScene(o.geometry.activation?.radius ?? 24), heading);
          pad.group.position.set(x, 0, z);
          this.addView({
            id,
            obj: pad.group,
            kind: 'impulso',
            y: 0,
            phase,
            labelY: 1,
            update: (_v, t) => pad.update(t),
          });
          staticGlows.add([x, 0.3, z], '#3df2ff', 2.4);
          break;
        }
        case 'rampa': {
          // Rampas de salto (T73): suben hacia la boia siguiente.
          const heading = typeof o.params?.heading === 'number' ? o.params.heading : 0;
          const ramp: JumpRamp = jumpRamp(toScene(o.geometry.activation?.radius ?? 27), heading);
          ramp.group.position.set(x, 0, z);
          this.addView({
            id,
            obj: ramp.group,
            kind: 'rampa',
            y: 0,
            phase,
            labelY: 2,
            update: (_v, t) => ramp.update(t),
          });
          staticGlows.add([x, 0.6, z], '#ffd23f', 2.4);
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
      this.statics = m;
    }
    return shores;
  }

  /**
   * El barco fantasma (T61): una vista más, en la copia más cercana al foco,
   * que sigue a `ghostAt` y se esconde sin él.
   */
  private buildGhost(): void {
    const g = ghostBoat(SHIP_LENGTH);
    this.addView({
      id: '__fantasma',
      obj: g,
      kind: 'fantasma',
      y: 0,
      phase: 0,
      labelY: 2,
      update: (v, t) => {
        const p = this.ghostAt;
        v.obj.visible = !!p;
        if (!p) return;
        v.obj.rotation.y = -p.heading;
        v.obj.position.y = Math.sin(t * 1.9) * 0.07;
      },
    });
    this.opts.canvas.dataset.ghost = 'off';
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
      // Circuito cerrado (T61): antes de la salida va la última boia y después de ésta, la salida.
      const prev = avg(g.order === 0 ? max : g.order - 1) ?? g;
      const next = avg(g.order === max ? 0 : g.order + 1) ?? g;
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
      this.pinch = {
        d: this.pinchDistance(),
        zoom: this.defense ? this.arenaZoom.goal : this.zoomGoal,
      };
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
        if (this.defense) {
          // En la arena, su zoom (plan 015 T170): el mismo gesto, entre lo más cerca y la vista de salida.
          // (la distancia de la cámara sigue a los dedos: separarlos el doble, la mitad de lejos).
          this.arenaZoom.set(
            this.pinch.zoom + Math.log(this.pinch.d / d) / Math.log(1 / ARENA_ZOOM_NEAR),
          );
          return;
        }
        this.zoomGoal = clamp01(this.pinch.zoom + ratio);
        if (this.zoomGoal < MAP_ZOOM) this.lastBoatZoom = this.zoomGoal;
      }
      return;
    }
    if (this.mode === 'pending' && Math.hypot(p.x - p.sx, p.y - p.sy) > 9) {
      // En la arena no se arrastra el mapa (nunca se ve fuera de ella): el dedo lleva el avión.
      if (this.zoom >= MAP_ZOOM && !this.defense) {
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
      // A focused button or link keeps its own Enter/Space (the faro board sits near a dialogue, T168).
      if (t && (t.tagName === 'BUTTON' || t.tagName === 'A')) return;
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
    // En la arena del castillo (T161; plan 015 T170, decisión 6): colocando,
    // la isla va ahí; en una isla, se elige; en el mar, el avión vuela ahí.
    if (this.defense) {
      const df = this.defense;
      const dx = wrapD(hit.x - df.castle.x, this.periodS.w);
      const dz = wrapD(hit.z - df.castle.z, this.periodS.h);
      const p = df.frame.toSim(df.frame.cx + fromScene(dx), df.frame.cy + fromScene(dz));
      const what = df.run.tap(p.x, p.y);
      this.opts.canvas.dataset.arenaToque = `${Math.round(p.x)},${Math.round(p.y)}`;
      this.opts.canvas.dataset.arenaToqueTipo = what.type;
      return;
    }
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

  /**
   * La carta no se va de la pantalla (T65): se arrastra hasta ver su borde
   * y, si cabe entera, sólo un poco (`mapPanLimit`). Antes se iba hasta el
   * 60 % del periodo y, muy a un lado, las islas saltaban al otro.
   */
  private clampPan(): void {
    const per = this.worldPerPixel();
    const c = this.opts.canvas;
    const w = mapPanLimit(this.periodS.w, per * (c.clientWidth || 1));
    const h = mapPanLimit(this.periodS.h, per * (c.clientHeight || 1));
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
    // Sensibilidad de Ajustes (REQ-MUN-008): estado del módulo de controles.
    const sens = controlSensitivity();
    if (dx || dy) return keysInput(dx, dy, sens.keyboard);
    if (this.mode === 'stick') {
      return stickInput(this.stick.dx, this.stick.dy, sens.touch) ?? IDLE_INPUT;
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
    if (free && this.survivors) {
      this.stepSurvivors(now);
    } else if (free && this.defense) {
      this.stepDefense(now);
    } else if (free) {
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
    for (const e of this.runtime.drainEvents()) {
      this.jumpOn(e);
      this.opts.onWorldEvent(e);
    }
    if (!this.survivors && !this.defense) this.landJump();
    this.modelClock += dt;
    if (this.modelClock >= MODEL_PLAN_S) {
      this.modelClock = 0;
      this.streamModels();
    }
    this.render(
      dt,
      this.survivors
        ? this.survivors.run.alpha
        : this.defense
          ? this.defense.run.alpha
          : this.acc / STEP,
    );
    this.measure(dt, now);
  };

  /**
   * Los pasos de la partida del Cañón que tocan (T99): el reloj de la
   * partida (tiempo real; la pestaña oculta es pausa) dice cuántos; cada uno
   * lleva el mando del barco a la simulación, y el barco de la escena es el
   * de la partida. Sin runtime: ni fichas, ni premios, ni misión mientras.
   */
  private stepSurvivors(now: number): void {
    const sv = this.survivors!;
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const n = sv.run.tick(now, hidden);
    const s = this.ship;
    for (let i = 0; i < n && this.survivors === sv && !sv.run.ended; i++) {
      this.prev.x = s.x;
      this.prev.y = s.y;
      this.prev.heading = s.heading;
      const turbo = sv.turboPending && this.inputEnabled && sv.run.game.status === 'running';
      sv.turboPending = false;
      const events = sv.run.step(this.inputEnabled ? this.readInput() : IDLE_INPUT, turbo);
      // Golpes y derrotas (T117): temblor (sin él con movimiento reducido) y el efecto de derrota.
      for (let k = 0; k < events.length; k++) {
        const e = events[k]!;
        if (e.type === 'hit') this.shake = Math.max(this.shake, hitShake(this.reducedMotion));
        else if (e.type === 'defeated') sv.view.defeat(e.enemy, e.id, e.x, e.y);
        else if (e.type === 'explode') sv.view.weapons.explode(e.weapon, e.x, e.y, e.radius);
        else if (e.type === 'jump') {
          this.opts.canvas.dataset.salto = 'aire';
          this.opts.onJump?.(e);
        } else if (e.type === 'splash') {
          const bp = this.boat.group.position;
          this.splash.burst(bp.x, bp.z, 1);
          this.shake = Math.max(this.shake, hitShake(this.reducedMotion));
          this.opts.canvas.dataset.salto = 'agua';
          this.opts.canvas.dataset.chapuzones = String(++this.splashes);
          this.opts.onJump?.(e);
        }
      }
      const movement = sv.run.snapshot().movement;
      this.turboLeft = movement.turboS;
      this.turboCool = movement.cooldownS;
      this.opts.canvas.dataset.canonTurbo = String(movement.turboS);
      this.opts.canvas.dataset.canonTurboCooldown = String(movement.cooldownS);
      this.opts.canvas.dataset.canonSpeed = String(Math.hypot(sv.player.vx, sv.player.vy));
      // El Vecino: con su modelo de Blender o con la barcaza de a mano (T174).
      const vecinoState = sv.view.vecino?.modelState ?? 'procedural';
      if (this.opts.canvas.dataset.canonVecino !== vecinoState)
        this.opts.canvas.dataset.canonVecino = vecinoState;
      const p = sv.player;
      s.x = p.x;
      s.y = p.y;
      s.vx = p.vx;
      s.vy = p.vy;
      s.heading = p.heading;
      const dh = Math.atan2(
        Math.sin(s.heading - this.prev.heading),
        Math.cos(s.heading - this.prev.heading),
      );
      this.turnRate += (dh / STEP - this.turnRate) * Math.min(1, STEP * 6);
    }
    this.acc = 0;
  }

  /** La física de este paso: la base, los efectos del mundo y el turbo o el viaje. */
  private stepConfig(base: ShipConfig): ShipConfig {
    const boost = this.voyage ? VOYAGE_SPEED : this.turboLeft > 0 ? TURBO_SPEED : 1;
    return stepShipConfig(base, this.runtime, boost);
  }

  /**
   * Los 22 nudos sólo con el cronómetro corriendo (T109): al dejar la
   * carrera, la velocidad que sobra se recorta al tope de crucero de ahora.
   * La partida del Cañón nunca es carrera.
   */
  private syncHandling(): void {
    const racing = !this.survivors && (this.opts.racing?.() ?? false);
    if (!this.handling.sync(racing, this.ship, (base) => this.stepConfig(base).maxSpeed)) return;
    this.opts.canvas.dataset.manejo = racing ? 'carrera' : 'crucero';
  }

  private simulate(dt: number): void {
    this.syncHandling();
    const s = this.ship;
    this.prev.x = s.x;
    this.prev.y = s.y;
    this.prev.heading = s.heading;
    if (this.flight) {
      this.stepFlight(dt);
      return;
    }
    if (this.hold) {
      Object.assign(s, { ...this.hold, vx: 0, vy: 0 });
      this.prev.x = s.x;
      this.prev.y = s.y;
      this.prev.heading = s.heading;
      this.runtime.step(s, this.cfg, dt);
      this.opts.onStep?.(s, dt);
      return;
    }
    const input = this.readInput();
    const cfg = this.stepConfig(this.cfg);
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
    const x = this.wrapC.x + wrapD(cx - this.wrapC.x, this.periodS.w);
    const z = this.wrapC.y + wrapD(cz - this.wrapC.y, this.periodS.h);
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
    // La partida del Cañón (T99) aleja la cámara y la sube algo; al acabar vuelve suave.
    const blendGoal = this.survivors ? 1 : 0;
    const blendStep = snap ? 1 : dt / Math.max(0.05, this.camTuning.blendS);
    this.camBlend += Math.max(-blendStep, Math.min(blendStep, blendGoal - this.camBlend));
    const cb = smooth(0, 1, this.camBlend);
    let dist = dNear * Math.pow(this.dFar / dNear, z) * lerp(1, this.camTuning.distanceScale, cb);
    let raise = lerp(1, this.camTuning.heightScale, cb);
    let elev = lerp(ELEV_NEAR, 1.28, smooth(0, 1, z));
    // La arena del castillo (T160): la cámara sube, casi cenital, sobre el castillo; al acabar baja.
    const arenaGoal = this.defense ? 1 : 0;
    const arenaStep = snap || this.reducedMotion ? 1 : dt / ARENA_CAMERA_S;
    this.arenaBlend += Math.max(-arenaStep, Math.min(arenaStep, arenaGoal - this.arenaBlend));
    const ab = smooth(0, 1, this.arenaBlend);
    if (snap) {
      // Sin foco previo: el barco en su sitio del mapa.
      this.focus.set(toScene(this.ship.x), 0, toScene(this.ship.y));
      this.wrapC.set(this.focus.x, this.focus.z);
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
    let fx = lerp(bx, this.mapC.x, w) + this.pan.x;
    let fz = lerp(bz, this.mapC.y, w) + this.pan.y + lift;
    // El castillo de la arena, en la copia de alrededor de lo que se ve ahora.
    const acx = this.wrapC.x + wrapD(this.arenaCastle.x - this.wrapC.x, P.w);
    const acz = this.wrapC.y + wrapD(this.arenaCastle.y - this.wrapC.y, P.h);
    this.arenaCastleSeen.set(acx, acz);
    if (this.defense) {
      // Al abrir «Construir» (o empezar a colocar), la vista de salida (plan 015 T170, decisión 4).
      const building = this.defense.run.building;
      if (building && !this.arenaBuilding) this.arenaZoom.reset();
      this.arenaBuilding = building;
    }
    this.arenaZoom.step(dt, snap || this.reducedMotion);
    // Cuánto sigue la cámara de la arena al avión sin retraso (plan 016, decisión 2).
    let follow = 0;
    if (ab > 0) {
      const pose = arenaCameraPose({
        aspect: this.camera.aspect,
        fovDeg: 40,
        arenaRadius: this.arenaRadiusS,
        plane: { x: ship.x - acx, z: ship.z - acz },
        planeY: ship.y,
        zoom: this.arenaZoom.value,
      });
      dist = lerp(dist, pose.distance, ab);
      elev = lerp(elev, pose.elevation, ab);
      raise = lerp(raise, 1, ab);
      fx = lerp(fx, acx + pose.fx, ab);
      fz = lerp(fz, acz + pose.fz, ab);
      follow = pose.follow * ab;
    }
    if (snap) this.focus.set(fx, 0, fz);
    else
      this.focus.lerp(tmpV.set(fx, 0, fz), lerp(1 - Math.exp(-dt * FOCUS_RATE), 1, follow));
    this.wrapC.set(this.focus.x - this.pan.x, this.focus.z - this.pan.y);
    // En la arena, la vuelta del planeta se hace alrededor del castillo: la
    // arena (más ancha que medio planeta) nunca se parte por el borde.
    if (ab > 0) this.wrapC.lerp(tmpV2.set(acx, acz), ab);
    this.look.copy(this.focus);
    // Siguiendo al avión en la arena, nada lo corre del centro (plan 016, decisión 2).
    this.look.z += mapLift * (1 - follow);
    let ox = 0;
    let oz = 0;
    // Movimiento reducido (T152): ningún golpe de cámara (choques, saltos, golpes del Cañón).
    if (this.shake > 0 && this.reducedMotion) this.shake = 0;
    if (this.shake > 0) {
      // Para las pruebas: la cámara ya tembló alguna vez en esta página.
      if (!this.opts.canvas.dataset.temblor) this.opts.canvas.dataset.temblor = 'si';
      ox = (Math.random() - 0.5) * this.shake * 0.5;
      oz = (Math.random() - 0.5) * this.shake * 0.5;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    // En vuelo la cámara sube con el barco.
    const camY = Math.sin(elev) * dist * raise + this.air * 0.85 * (1 - ab);
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
    this.bend = lerp(lerp(BEND_NEAR, BEND_MAP, smooth(0.25, 0.9, z)), BEND_MAP, ab);
    planetUniforms.uBend.value = this.bend;
    planetUniforms.uBendCenter.value.set(camX, camZ);
    planetUniforms.uPlanetFocus.value.set(this.wrapC.x, this.wrapC.y);
    // Se mira al foco ya curvado (baja un poco con la distancia).
    this.look.y = -bendDrop(this.bend, back) + this.air * 0.85 * (1 - ab);
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
      tmpV.set(this.wrapC.x, 0, this.wrapC.y),
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
    const movement = this.survivors?.run.snapshot().movement;
    // El avión del castillo (T160) vuela a su altura; al acabar baja al agua.
    const plane = this.defense !== null;
    this.air = fl
      ? fl.pose.alt
      : plane
        ? PLANE_ALT
        : toScene(movement ? movement.jumpHeight : this.jump.height(t));
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
    } else if (plane) {
      // El avión: se ladea al girar, con un vaivén suave (sin él con movimiento reducido).
      const still = this.reducedMotion;
      body.position.y = still ? 0 : Math.sin(t * 2.6) * 0.05;
      body.rotation.x = Math.max(-0.45, Math.min(0.45, -this.turnRate * 0.2));
      body.rotation.z = still ? 0.04 : 0.04 + Math.sin(t * 1.7) * 0.03;
    } else {
      body.position.y = Math.sin(t * 1.9) * 0.07 + Math.sin(t * 3.3) * 0.03 + v01 * 0.08;
      body.rotation.x =
        Math.max(-0.35, Math.min(0.35, -this.turnRate * 0.14)) + Math.sin(t * 1.5) * 0.03;
      body.rotation.z =
        v01 * 0.07 +
        Math.sin(t * 2.1) * 0.025 +
        (movement ? movement.jumpPitch : this.jump.pitch(t));
    }
    this.wings.group.position.y = body.position.y;
    this.wings.group.rotation.copy(body.rotation);
    if (fl) this.flightEffects(fl, x, z, h, t, dt);
    else if (plane) {
      const top = this.defense!.run.config.plane.maxSpeed;
      this.wings.set(1, Math.min(1, Math.hypot(s.vx, s.vy) / top), t, 0.4);
    }
    this.sparks.update(dt);
    this.splash.update(dt);
    if (this.boat.sail) {
      this.boat.sail.rotation.y =
        Math.max(-0.5, Math.min(0.5, this.turnRate * 0.25)) + Math.sin(t * 0.9) * 0.05;
    }
    if (this.boat.captain) this.boat.captain.rotation.y = Math.sin(t * 1.3) * 0.25;
    if (this.crew) this.crew.position.y = Math.abs(Math.sin(t * 5)) * 0.08;
    if (this.mascot) {
      this.mascot.update(t, dt, {
        waving: this.nearPlace(dt),
        quality: this.mascot.quality,
        reduced: this.reducedMotion,
      });
    }
    const sternX = x + Math.cos(h) * this.sternX;
    const sternZ = z + Math.sin(h) * this.sternX;
    const boost = this.turboLeft > 0 || this.voyage ? 1.4 : 1;
    if (this.tortuga) {
      // Nada detrás de la popa por la estela; escondida mientras el barco vuela o es el avión.
      this.tortuga.update(t, dt, {
        x: sternX,
        z: sternZ,
        heading: h,
        speed: toScene(speed) * boost,
        quality: this.tortuga.quality,
        reduced: this.reducedMotion,
        hidden: fl !== null || plane,
      });
      if (this.opts.canvas.dataset.mascotaModelo !== this.tortuga.modelState) this.noteMascotModel();
    } else if (this.mascot && 'modelState' in this.mascot) {
      if (this.opts.canvas.dataset.mascotaModelo !== this.mascot.modelState) this.noteMascotModel();
    }
    // Al levitar, sólo un rizo de espuma bajo el casco mientras está cerca del agua.
    const hovering = fl ? Math.max(0, 1 - this.air / 1.2) * 0.5 : 0;
    // En el aire de un salto (T73), sin estela.
    const wake = (movement ? movement.airborne : this.jump.airborne) ? 0 : Math.min(1, v01 * boost);
    this.wake.update(dt, sternX, sternZ, h, fl ? hovering : plane ? 0 : wake, t);

    this.updateCamera(dt);

    // Lugares: cada uno en su copia más cercana al foco (en el mapa, al centro
    // de la carta: `wrapC`); lo que queda tras el horizonte o fuera de la
    // vista no se pinta.
    const fx = this.wrapC.x;
    const fz = this.wrapC.y;
    const P = this.periodS;
    const cam = this.camera.position;
    const bend = this.bend;
    this.frustum.setFromProjectionMatrix(
      tmpM.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse),
    );
    const ghostView = this.ghostAt ? this.views.get('__fantasma') : undefined;
    if (ghostView && this.ghostAt) {
      ghostView.bx = toScene(this.ghostAt.x);
      ghostView.bz = toScene(this.ghostAt.y);
    }
    let whirlsShown = 0;
    // La arena del castillo (T160): todo lo demás se hunde (y vuelve a salir al acabar).
    this.sink.step(dt, this.reducedMotion);
    const depth = this.sink.depth;
    const under = this.sink.under;
    const lifting = this.sinkOffsets.size > 0;
    let islandsShown = 0;
    for (const v of this.views.values()) {
      const st = this.runtime.objectState(v.id);
      const cxs = st ? toScene(st.x) : v.bx;
      const czs = st ? toScene(st.y) : v.bz;
      const px = fx + wrapD(cxs - fx, P.w);
      const pz = fz + wrapD(czs - fz, P.h);
      v.obj.position.x = px;
      v.obj.position.z = pz;
      // Lo hundido vuelve a su altura antes de moverse en este fotograma.
      if (lifting) this.sinkOffsets.lift(v.obj);
      // Lo que la partida del Cañón aparta (T99) no se pinta.
      if (this.hiddenKinds.size > 0 && this.hiddenKinds.has(v.kind)) {
        v.obj.visible = false;
        continue;
      }
      const sinks = depth > 0 && v.id !== CASTLE_PLACE_ID;
      // Bajo el agua del todo: ni se mueve ni se pinta.
      if (sinks && under) {
        v.obj.visible = false;
        continue;
      }
      v.obj.visible = true;
      if (v.update) {
        const pzUp = st?.z ? toScene(st.z) : 0;
        const ground = v.kind === 'encuentro' ? Math.max(this.groundAt(cxs, czs), pzUp) : 0;
        v.update(v, t, dt, st ? st.present : true, px, pz, ground);
      }
      if (sinks) this.sinkOffsets.sink(v.obj, depth);
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
      if (v.kind === 'remolino' && v.obj.visible) whirlsShown++;
      if (v.kind === 'isla' && v.id !== CASTLE_PLACE_ID && v.obj.visible) islandsShown++;
    }
    // Las piezas fusionadas (rocas, balizas…) bajan con lo demás; los brillos se apagan.
    if (this.statics) {
      this.statics.position.y = -depth;
      this.statics.visible = !under;
    }
    this.glow.visible = this.sink.level < 0.35;
    // Para las pruebas (T160): cuánto está hundido el mundo y cuántas islas se ven.
    const ds = this.opts.canvas.dataset;
    const sunk = this.sink.level.toFixed(2);
    if (ds.hundido !== sunk) ds.hundido = sunk;
    const shownIslands = String(islandsShown);
    if (ds.islasVista !== shownIslands) ds.islasVista = shownIslands;
    // Para las pruebas (T96): cuántos remolinos se ven ahora en pantalla.
    const shownWhirls = String(whirlsShown);
    if (this.opts.canvas.dataset.remolinosVista !== shownWhirls) {
      this.opts.canvas.dataset.remolinosVista = shownWhirls;
    }
    for (const a of this.animated) a(t, glow);
    if (this.defense) {
      const df = this.defense;
      df.view.reduced = this.reducedMotion;
      const snap = df.run.snapshot();
      const pl = df.run.placement(snap);
      const selId = df.run.selected;
      const sel = selId === null ? undefined : snap.towers.find((tw) => tw.id === selId);
      df.view.update(snap, t, { x, z }, {
        preview: pl
          ? {
              x: pl.x,
              y: pl.y,
              ok: pl.check.ok,
              kind: pl.kind,
              reason: pl.check.ok ? null : pl.check.reason,
            }
          : null,
        selected: sel ? { x: sel.x, y: sel.y, kind: sel.kind, level: sel.level } : null,
        target: snap.plane.target,
      });
      df.view.sky(dt, { x: this.arenaCastleSeen.x, z: this.arenaCastleSeen.y }, this.arenaZoom.value);
      if (t - df.seenAt >= 0.25 || t < df.seenAt) this.markArena(t);
    }
    if (this.survivors) {
      const sv = this.survivors;
      const snap = sv.run.snapshot();
      const reduced = this.reducedMotion;
      sv.view.reduced = reduced;
      sv.view.update(snap, t);
      if (t - sv.seenAt >= 0.25 || t < sv.seenAt) this.markSurvivorsOnScreen(sv, t, fx, fz);
      // El barco golpeado parpadea mientras es invulnerable (T117; nunca con movimiento reducido).
      this.boat.group.visible = boatVisible({
        invulnerableS: snap.player.invulnerableS,
        running: snap.status === 'running',
        reduced,
      });
    }
    this.routeLine.update(this.zoom);
    this.confetti.update(dt);
    // En la arena, las nubes son las suyas (bajas y pocas, plan 015 T170): las del mundo, fuera.
    this.clouds.update(dt, this.defense ? 0 : cam.y, { x: fx, z: fz }, P);
    // El aviso de `change` de la preferencia no siempre llega (T165: con la
    // preferencia cambiada en caliente, la fauna seguía): se mira cada fotograma.
    if (this.reducedMotion !== this.wildlife.isReduced) this.onWildlifeMotion();
    this.wildlife.update(dt, {
      ship: { x, z },
      focus: { x: fx, z: fz },
      period: P,
      camera: this.camera,
      zoom: this.zoom,
      cloudsVisible: this.clouds.group.visible,
      flying: !!fl,
    });
    const animals = this.wildlife.state;
    const fauna = `${animals.fish},${animals.gulls}`;
    if (this.opts.canvas.dataset.fauna !== fauna) this.opts.canvas.dataset.fauna = fauna;
    const motion = animals.reduced ? 'reduced' : 'on';
    if (this.opts.canvas.dataset.faunaMotion !== motion)
      this.opts.canvas.dataset.faunaMotion = motion;
    const clouds = this.clouds.group.visible ? 'on' : 'off';
    if (this.opts.canvas.dataset.faunaClouds !== clouds)
      this.opts.canvas.dataset.faunaClouds = clouds;

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
   * Carga por distancia (T47 en el 2D): los lugares con modelo de Blender
   * cerca del barco lo piden; los lejanos lo sueltan y vuelven a la mascota
   * hecha a mano (que no pesa nada).
   */
  private streamModels(): void {
    this.streamIslandModels();
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
   * Un objeto nuevo del Admin con su archivo subido (T241): la boya de
   * respaldo hasta que llega el modelo o la imagen (y si no llega, se queda).
   * `data-objetos-arte` dice, por id, cómo quedó cada uno.
   */
  private buildUploadedArt(
    o: WorldObject,
    x: number,
    z: number,
    r: number,
    phase: number,
    lit: Material,
  ): void {
    const id = o.identity.id;
    const box = artBox(r, o.appearance.scale);
    const fallback = objectArtFallback(lit);
    const slot = new Group();
    slot.name = 'arte-subido';
    slot.add(fallback);
    const g = new Group();
    g.add(slot);
    g.position.set(x, 0, z);
    let board: Object3D | null = null;
    let loaded = false;
    this.addView({
      id,
      obj: g,
      kind: 'objeto',
      y: 0,
      phase,
      labelY: 2.6,
      update: (v, t, _dt, _present, px, pz) => {
        if (board) {
          // El cartel de una imagen mira siempre a la cámara (sólo gira en vertical).
          board.rotation.y = Math.atan2(this.camera.position.x - px, this.camera.position.z - pz);
        } else if (!loaded) {
          // La boya de respaldo se balancea; un modelo subido se queda quieto.
          slot.position.y = Math.sin(t * 1.8 + v.phase) * 0.1;
        }
      },
    });
    this.setObjectArt(id, 'loading');
    void mountObjectArt(
      slot,
      fallback,
      o.appearance.asset,
      box,
      BROWSER_OBJECT_ART,
      () => !this.destroyed,
    ).then(({ state, art, height }) => {
      if (this.destroyed) return;
      if (art) {
        curveTree(art);
        loaded = true;
        slot.position.y = 0;
        if (state === 'image') board = art;
        const v = this.views.get(id);
        if (v) {
          v.radius = Math.max(v.radius, box.span / 2 + 3);
          v.top = Math.max(v.top, height);
          v.labelY = Math.max(v.labelY, height + 0.6);
        }
      }
      this.setObjectArt(id, state);
    });
  }

  private readonly objectArt = new Map<string, ObjectArtState>();

  private setObjectArt(id: string, state: ObjectArtState): void {
    this.objectArt.set(id, state);
    this.opts.canvas.dataset.objetosArte = [...this.objectArt]
      .map(([k, s]) => `${k}:${s}`)
      .join(' ');
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
      // Blender pone la cara a +X, como la mascota hecha a mano: las dos se giran igual.
      model.rotation.y = BOIA_FACING;
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

  /**
   * Las islas de Blender (T69): el manifiesto dice cuáles tienen modelo; se
   * piden y se sueltan por distancia como las boias, con su propio alcance.
   * Los lugares de `art/places/3d` (T108: el Puerto de Alicante) igual: su
   * modelo sustituye la isla entera (tierra, piezas y luces de a mano).
   */
  private watchIslandModels(): void {
    this.animated.push((t, glow) => {
      const reduced = this.reducedMotion;
      for (const v of this.islandModels.values()) {
        v.glow?.(glow);
        // Después del brillo: las pantallas laten sobre él (T112).
        v.motion?.update(t, glow, reduced);
      }
      if (t - this.placePoseClock >= PLACE_POSE_S || t < this.placePoseClock) {
        this.placePoseClock = t;
        this.showPlaceMotion();
      }
    });
    void loadIslandModels().then((entries) => {
      if (this.destroyed) return;
      for (const [id, entry] of entries) {
        const v = this.islandModels.get(id);
        if (v) v.entry = entry;
      }
      this.showIslandStates();
      this.streamIslandModels();
    });
  }

  private streamIslandModels(): void {
    const withModel = [...this.islandModels].filter(([, v]) => v.entry);
    if (withModel.length === 0) return;
    const ship = this.ship;
    const near = withModel.map(([id]) => {
      const at = this.world.objects.find((x) => x.identity.id === id)?.position;
      const { dx, dy } = this.runtime.delta(ship.x, ship.y, at?.x ?? 0, at?.y ?? 0);
      return { id, x: ship.x + dx, y: ship.y + dy };
    });
    const { want, keep } = planModels(near, ship, ISLAND_MODEL_TUNING);
    for (const [id, v] of withModel) {
      if (want.has(id) && !v.acquired) this.acquireIsland(id, v);
      else if (!keep.has(id) && v.acquired) this.releaseIsland(id, v);
    }
  }

  private acquireIsland(id: string, v: IslandModelView): void {
    v.acquired = true;
    v.state = 'cargando';
    this.showIslandStates();
    void this.islandStore.acquire(id).then((model) => {
      if (this.destroyed || !v.acquired) return;
      if (!model || !v.entry) {
        v.state = 'error';
        this.showIslandStates();
        return;
      }
      // Frente a +z (el puerto), agua en y = 0: sólo se escala al radio de la isla.
      model.scale.setScalar(islandScale(v.entry, v.R));
      curveTree(model);
      v.glow = islandGlow(model);
      v.glow(this.mood.glow);
      // Su movimiento (T112), del reloj de cada fotograma; sin nada que mover, null.
      v.motion = placeMotion(model, v.entry, PLACE_SCREENS[id] ?? []);
      v.slot.remove(v.fallback);
      v.slot.add(model);
      v.model = model;
      v.state = 'glb';
      // Sus luces de a mano no caen en el modelo: se apagan mientras se ve (T75).
      if (v.glows) showGlows(this.glow, v.glows.start, v.glows.g, false);
      // Lo que se ve llega hasta la cima del modelo (para no quitarlo de la vista antes de tiempo).
      const view = this.views.get(id);
      const top = modelLabelY(v.entry, v.R);
      if (view && top !== null) view.top = Math.max(view.top, top);
      this.showIslandStates();
    });
  }

  private releaseIsland(id: string, v: IslandModelView): void {
    v.acquired = false;
    v.motion?.dispose();
    v.motion = null;
    if (v.model) {
      v.slot.remove(v.model);
      v.model = null;
      v.glow = null;
      v.slot.add(v.fallback);
      if (v.glows) showGlows(this.glow, v.glows.start, v.glows.g, true);
    }
    v.state = 'procedural';
    this.islandStore.release(id);
    this.showIslandStates();
  }

  /** Para las pruebas: `data-islas-modelo` en el lienzo, «id:estado» de cada isla con modelo. */
  private showIslandStates(): void {
    const list = [...this.islandModels]
      .filter(([, v]) => v.entry)
      .map(([id, v]) => [id, v.state] as [string, IslandModelState]);
    this.opts.canvas.dataset.islasModelo = islandStates(list);
    // Para las pruebas (T75): las islas con sus luces de a mano apagadas.
    this.opts.canvas.dataset.islasSinLuces = [...this.islandModels]
      .filter(([, v]) => v.model)
      .map(([id]) => id)
      .sort()
      .join(' ');
    this.showPlaceMotion();
  }

  /**
   * Para las pruebas (T112): `data-lugares-movimiento`, «id:baile» o
   * «id:quieto» de cada lugar con su modelo moviéndose, y
   * `data-lugares-pose`, «id:altura» de su nodo que se mueve.
   */
  private showPlaceMotion(): void {
    const { motion, pose } = placeMotionStates(
      [...this.islandModels].map(([id, v]) => [id, v.motion] as const),
      this.reducedMotion,
    );
    const ds = this.opts.canvas.dataset;
    if (ds.lugaresMovimiento !== motion) ds.lugaresMovimiento = motion;
    if (ds.lugaresPose !== pose) ds.lugaresPose = pose;
  }

  /**
   * A qué altura (escena) va el rótulo de un lugar: con su modelo de Blender
   * puesto, sobre su alto real (manifiesto); si no, el de la composición a
   * mano. Lo usan también el confeti de la entrega y lo que se ancla encima (T75).
   */
  private labelYOf(id: string, v: View): number {
    const mv = this.islandModels.get(id);
    const y = mv?.model && mv.entry ? modelLabelY(mv.entry, mv.R) : null;
    return y ?? v.labelY;
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

  /**
   * Lo que ocupa un lugar en pantalla: de lado a lado y abajo, su orilla;
   * arriba, su cima en el centro (null si queda detrás de la cámara).
   */
  private bodyRect(x: number, z: number, r: number, top: number): Rect | null {
    this.project(x, top, z, this.scr);
    if (tmpV.z >= 1) return null;
    const out = { left: this.scr.x, top: this.scr.y, right: this.scr.x, bottom: this.scr.y };
    const pts: [number, number, number][] = [
      [x - r, 0, z],
      [x + r, 0, z],
      [x, 0, z - r],
      [x, 0, z + r],
    ];
    for (const [px, py, pz] of pts) {
      this.project(px, py, pz, this.scr);
      if (tmpV.z >= 1) return null;
      out.left = Math.min(out.left, this.scr.x);
      out.right = Math.max(out.right, this.scr.x);
      out.bottom = Math.max(out.bottom, this.scr.y);
    }
    return out;
  }

  /**
   * Los rótulos (T75): cada uno sobre su lugar (las islas de Blender, sobre
   * su alto real), sin pisar los mandos, más pequeños y tenues los lejanos, y
   * casi apagados los que caen encima de un lugar más cercano (`labels.ts`).
   */
  private placePins(bx: number, bz: number, far: boolean): void {
    const cam = this.camera.position;
    const boatD = Math.max(1, cam.distanceTo(this.boat.group.position));
    const W = this.opts.canvas.clientWidth;
    const H = this.opts.canvas.clientHeight;
    const sights: PinSight[] = [];
    const shown: PinView[] = [];
    this.islandScreen.clear();
    for (const p of this.pins) {
      const v = this.views.get(p.spec.id);
      if (v) {
        p.rx = v.obj.position.x;
        p.rz = v.obj.position.z;
        p.y = this.labelYOf(p.spec.id, v);
      }
      const near = Math.hypot(p.rx - bx, p.rz - bz) < 70;
      const want = far || near || !!p.spec.always;
      const x = p.rx;
      const y = p.y;
      const z = p.rz;
      let atHorizon = false;
      let body: Rect | null = null;
      if (this.hidden(x, y, z)) {
        // Lo que vende se queda asomado al horizonte, en su dirección.
        if (!p.spec.always || !want) continue;
        atHorizon = true;
      } else if (v) {
        const mv = this.islandModels.get(p.spec.id);
        const R = this.islandRadius.get(p.spec.id) ?? Math.max(1, v.radius - 3);
        const top = mv?.model ? y - LABEL_GAP : v.labelY * 0.7;
        body = this.bodyRect(x, z, R, top);
        if (body && (body.right < 0 || body.left > W || body.bottom < 0 || body.top > H))
          body = null;
        if (body && mv?.model) this.islandScreen.set(p.spec.id, body);
      }
      if (atHorizon) this.horizonPoint(x - cam.x, z - cam.z, p.w / 2, this.scr);
      else this.project(x, y, z, this.scr);
      if (!this.scr.on && !body) continue;
      const depth = atHorizon
        ? Number.POSITIVE_INFINITY
        : Math.hypot(x - cam.x, y - cam.y, z - cam.z) / boatD;
      sights.push({
        x: this.scr.x,
        y: this.scr.y,
        w: p.w,
        h: p.h,
        depth,
        horizon: atHorizon,
        always: !!p.spec.always,
        body,
        // Por encima de la pantalla con su isla a la vista (una isla alta, de cerca): baja sobre ella.
        label: want && (this.scr.on || !!body),
      });
      shown.push(p);
    }
    // Tampoco por encima del borde de arriba de la pantalla, ni por los lados (T226).
    const looks = layoutPins(sights, [...this.hudRects, ABOVE_SCREEN], W);
    const seen = new Set<PinView>();
    shown.forEach((p, i) => {
      const look = looks[i]!;
      const s = sights[i]!;
      if (!look.on) return;
      seen.add(p);
      if (!p.vis) {
        p.vis = true;
        p.el.classList.add('is-on');
      }
      p.el.style.transform = `translate3d(${look.x.toFixed(1)}px, ${look.y.toFixed(1)}px, 0) scale(${look.scale.toFixed(3)})`;
      // Apartado de un mando o del borde: la punta sigue señalando su lugar (T226).
      const room = Math.max(0, p.w / 2 - 10);
      const tip = Math.round(Math.max(-room, Math.min(room, (s.x - look.x) / look.scale)));
      if (tip !== (p.tip ?? 0)) {
        p.tip = tip;
        p.el.style.setProperty('--pin-tip', `${tip}px`);
      }
      const key = `${far ? 'm' : ''}${s.horizon ? 'h' : ''}${look.behind ? 'b' : ''}${look.alpha.toFixed(2)}`;
      if (key !== p.look) {
        p.look = key;
        p.el.classList.toggle('is-map', far);
        p.el.classList.toggle('is-horizon', s.horizon);
        p.el.classList.toggle('is-behind', look.behind);
        p.el.style.setProperty('--pin-alpha', look.alpha.toFixed(2));
      }
    });
    for (const p of this.pins) {
      if (p.vis && !seen.has(p)) {
        p.vis = false;
        p.el.classList.remove('is-on');
      }
    }
  }

  private placeOverlay(): void {
    const bx = this.boat.group.position.x;
    const bz = this.boat.group.position.z;
    const far = this.zoom > 0.28;
    this.placePins(bx, bz, far);
    for (const a of this.anchors) {
      let x = bx;
      let y = 2.4;
      let z = bz;
      if (a.target !== 'ship') {
        const v = this.views.get(a.target);
        if (!v) continue;
        x = v.obj.position.x;
        z = v.obj.position.z;
        y = this.labelYOf(a.target, v) * 0.8;
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

  /**
   * Cada cuarto de segundo (antes de mover nada en el fotograma): dónde están
   * los mandos y cuánto mide cada rótulo (T75).
   */
  private measureOverlay(): void {
    const base = this.opts.overlay.getBoundingClientRect();
    const rects: Rect[] = [];
    for (const el of this.opts.avoid?.() ?? []) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      rects.push({
        left: r.left - base.left,
        top: r.top - base.top,
        right: r.right - base.left,
        bottom: r.bottom - base.top,
      });
    }
    this.hudRects = rects;
    for (const p of this.pins) {
      p.w = p.el.offsetWidth;
      p.h = p.el.offsetHeight;
    }
    // Para las pruebas: «id:izq,arriba,der,abajo» de cada isla de Blender que se ve.
    this.opts.canvas.dataset.islasPantalla = [...this.islandScreen]
      .map(([id, r]) => `${id}:${[r.left, r.top, r.right, r.bottom].map(Math.round).join(',')}`)
      .sort()
      .join(' ');
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
    this.measureOverlay();
    // Para las pruebas: dónde queda el barco en la pantalla (px del lienzo). En
    // vuelo el barco está en el aire (y = altura del vuelo), no en el agua.
    const bp = this.boat.group.position;
    this.project(bp.x, bp.y + 0.6, bp.z, this.scr);
    this.opts.canvas.dataset.shipScreen = `${Math.round(this.scr.x)},${Math.round(this.scr.y)}`;
    const c = this.course;
    this.opts.onStats?.({
      fps: Math.round(this.fps),
      knots: Math.round(shipSpeed(this.ship) / 10),
      // En la arena, su zoom (1 la vista de salida): el carril lo enseña igual.
      zoom: this.defense ? this.arenaZoom.value : this.zoom,
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
      sensitivity: controlSensitivity(),
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
