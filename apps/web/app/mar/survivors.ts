import type { ShipConfig, ShipInput } from '@boia/engine/headless';
import type { QualityTier } from '@boia/engine/streaming';
import {
  type DefeatStyle,
  type EndReason,
  SURVIVORS_CONFIG,
  SurvivorsClock,
  type SurvivorsConfig,
  type SurvivorsEvent,
  type SurvivorsGame,
  type SurvivorsSnapshot,
  type SurvivorsStatus,
  type SurvivorsWorld,
  createSurvivors,
  survivorsWorldOf,
} from '@boia/engine/survivors';
import type { Rect, WorldConfig, WorldObject } from '@boia/world';

/**
 * El Cañón «Que no pare la música» dentro de `/mar` (plan 009, T99), sin
 * three.js ni React: la simulación de `@boia/engine/survivors` jugada en el
 * mismo mundo donde está el barco, como Los Rápidos. Aquí:
 *
 * - los atajos de desarrollo (`?minijuego=canon&t=<s>&seed=<n>`) y el único
 *   interruptor que los deja pasar (`devShortcutsEnabled`);
 * - lo que se esconde del mundo durante la partida y cómo vuelve igual;
 * - el mar de la partida a partir del de `/mar` (sin lo escondido);
 * - `SurvivorsRun`: la partida con su reloj (tiempo real, pestaña oculta)
 *   que el bucle de `Mar3D` paso a paso, y su estado para las pruebas.
 */

/** El minijuego que se juega en el mundo (no en la capa 2D). */
export const CANON_GAME_ID = 'canon';
/** Los minijuegos del registro que se juegan en el mar 3D y no se montan en la capa 2D. */
export const WORLD_GAMES: readonly string[] = [CANON_GAME_ID];

// --- Atajos de desarrollo (decisión 2 del plan 009) ------------------------------

/** Los parámetros de la URL de los atajos del modo. */
export const CANON_PARAMS = {
  game: 'minijuego',
  t: 't',
  seed: 'seed',
  /** `oferta=1`: en vez de empezar, el panel de la isla del Cañón (pruebas del bloqueo). */
  offer: 'oferta',
  /** `derrota=puf|sumergirse`: empezar con ese estilo de derrota (T117). */
  defeat: 'derrota',
  /** `carta=1`: empezar con una carta de nivel abierta (T118, para probar las cartas). */
  card: 'carta',
  dev: 'dev',
} as const;

export interface DevEnv {
  /** `process.env.NODE_ENV` del build. */
  nodeEnv: string | undefined;
  /** El navegador lo maneja un programa (las e2e: `navigator.webdriver`). */
  webdriver: boolean;
  /** `location.search` de ahora. */
  search: string;
}

/** El entorno de ahora (en el servidor, sin navegador). */
export function devEnv(): DevEnv {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  return {
    nodeEnv: process.env.NODE_ENV,
    webdriver: nav?.webdriver === true,
    search: typeof window === 'undefined' ? '' : window.location.search,
  };
}

/**
 * El único interruptor de los atajos del modo (decisión 2): siempre en
 * `pnpm dev` y en el servidor de las e2e; en un build de producción sólo si
 * la URL trae `?dev=1` (sin enlace visible). Se quitan al lanzar (plan 013).
 */
export function devShortcutsEnabled(env: DevEnv = devEnv()): boolean {
  if (env.nodeEnv !== 'production') return true;
  if (env.webdriver) return true;
  return new URLSearchParams(env.search).get(CANON_PARAMS.dev) === '1';
}

/**
 * ¿Puede una partida de prueba (empezada con un atajo que la cambia) dar el
 * premio de verdad? (T121) En `pnpm dev` y en el servidor de las e2e (un
 * build de producción que maneja Playwright: `navigator.webdriver`), sí;
 * en producción, nunca, tampoco con `?dev=1`: si no, cualquiera cobraría
 * 150 puntos y 50 monedas con `?dev=1&minijuego=canon&t=419`.
 */
export function devStartRewards(env: DevEnv = devEnv()): boolean {
  return env.nodeEnv !== 'production' || env.webdriver;
}

/**
 * ¿La partida es de prueba? Lo es si un atajo cambia el juego: `&t=` (se
 * salta tiempo), `&seed=` (una semilla elegida se puede ensayar) o
 * `&carta=1` (un nivel regalado). `&derrota=` sólo cambia cómo se ve: no.
 */
export function isDevStart(s: { t?: number; seed?: number | null; card?: boolean }): boolean {
  return (s.t ?? 0) > 0 || (s.seed ?? null) !== null || s.card === true;
}

export interface CanonShortcut {
  /** Segundo de la partida en el que empieza (0: desde el principio). */
  t: number;
  /** Semilla pedida, o null (una al azar). */
  seed: number | null;
  /** Sólo abrir el panel de la isla del Cañón, sin empezar. */
  offer: boolean;
  /** Estilo de derrota pedido (`&derrota=`), o null (el de la config). */
  defeatStyle: DefeatStyle | null;
  /** Empezar con una carta de nivel abierta (`&carta=1`). */
  card: boolean;
}

/**
 * `?minijuego=canon&t=<s>&seed=<n>` (y `&oferta=1`): qué pide la URL, o null
 * si no pide el Cañón o los atajos están apagados. `t` se acota a la partida.
 */
export function canonShortcut(
  search: string,
  env: DevEnv = devEnv(),
  config: SurvivorsConfig = SURVIVORS_CONFIG,
): CanonShortcut | null {
  const q = new URLSearchParams(search);
  if (q.get(CANON_PARAMS.game) !== CANON_GAME_ID) return null;
  if (!devShortcutsEnabled({ ...env, search })) return null;
  const t = Number(q.get(CANON_PARAMS.t));
  const seed = Math.floor(Number(q.get(CANON_PARAMS.seed)));
  return {
    t: Number.isFinite(t) && t > 0 ? Math.min(t, config.durationS - 1) : 0,
    seed: Number.isFinite(seed) && seed > 0 ? seed : null,
    offer: q.get(CANON_PARAMS.offer) === '1',
    defeatStyle: asDefeatStyle(q.get(CANON_PARAMS.defeat)),
    card: q.get(CANON_PARAMS.card) === '1',
  };
}

/** La URL sin el atajo (se consume al usarlo, como la ruta de prueba de antes); `dev` se queda. */
export function withoutCanonShortcut(href: string): string {
  const url = new URL(href);
  for (const p of [
    CANON_PARAMS.game,
    CANON_PARAMS.t,
    CANON_PARAMS.seed,
    CANON_PARAMS.offer,
    CANON_PARAMS.defeat,
    CANON_PARAMS.card,
  ]) {
    url.searchParams.delete(p);
  }
  return url.href;
}

// --- Estilo de derrota (T117) ----------------------------------------------------------

/** Los dos estilos de derrota que la beta compara, en el orden del interruptor. */
export const DEFEAT_STYLES: readonly DefeatStyle[] = ['puf', 'sumergirse'];

/** El estilo si `v` es uno de ellos; si no, null. */
export function asDefeatStyle(v: string | null | undefined): DefeatStyle | null {
  return DEFEAT_STYLES.find((s) => s === v) ?? null;
}

/** El estilo siguiente al pulsar el interruptor (de uno al otro). */
export function nextDefeatStyle(style: DefeatStyle): DefeatStyle {
  const i = DEFEAT_STYLES.indexOf(style);
  return DEFEAT_STYLES[(i + 1) % DEFEAT_STYLES.length]!;
}

/**
 * El estilo con que empieza una partida: el que se eligió con el
 * interruptor (o `&derrota=`) si los atajos de desarrollo están encendidos;
 * si no, siempre el de la config.
 */
export function startDefeatStyle(
  chosen: DefeatStyle | null,
  config: SurvivorsConfig = SURVIVORS_CONFIG,
  env: DevEnv = devEnv(),
): DefeatStyle {
  return chosen && devShortcutsEnabled(env) ? chosen : config.defeatStyle;
}

// --- Lo que se esconde durante la partida ----------------------------------------

/**
 * Lo que la partida aparta del mundo, por capas (todo vuelve al acabar):
 * - `route`: las marcas amarillas que guían entre islas;
 * - `sheets`: las fichas y paneles de las islas, y que se abran solas;
 * - `bottles`: las botellas (y su aviso de «leer» cerca);
 * - `discounts`: los descuentos escondidos (secretos, cofres, restos) y sus «?» del minimapa;
 * - `encounters`: la Fiestera, cocodrilos, delfín, medusas y remolinos, y sus rótulos;
 * - `minimap`: el minimapa enseña sólo las islas (nunca los enemigos comunes);
 * - `objective`: el «!» de objetivos, su panel y el objetivo marcado (su rótulo
 *   en el mar y su marca en el minimapa), que se conserva para después (T120);
 * - `wildlife`: los peces que saltan y las gaviotas (T120): no se confunden con enemigos.
 */
export type HideLayer =
  | 'route'
  | 'sheets'
  | 'bottles'
  | 'discounts'
  | 'encounters'
  | 'minimap'
  | 'objective'
  | 'wildlife';
export const HIDE_LAYERS: readonly HideLayer[] = [
  'route',
  'sheets',
  'bottles',
  'discounts',
  'encounters',
  'minimap',
  'objective',
  'wildlife',
];

/** Lo que cada capa esconde en el mar 3D: el `kind` de las vistas de `Mar3D`. */
export const LAYER_KINDS: Readonly<Partial<Record<HideLayer, readonly string[]>>> = {
  bottles: ['botella'],
  discounts: ['secreto', 'cofre', 'restos'],
  encounters: ['encuentro', 'cocodrilo', 'delfin', 'medusa', 'remolino'],
};

/** Categorías del mundo que la partida aparta (lo que pintan las capas de arriba). */
const HIDDEN_CATEGORIES = new Set([
  'secreto',
  'cofre',
  'restos',
  'encuentro',
  'cocodrilo',
  'delfin',
  'remolino',
]);

/** ¿Lo aparta la partida? (las medusas son `obstaculo` con «medusa» en el nombre, como en `Mar3D`). */
export function hiddenDuringGame(o: WorldObject): boolean {
  if (HIDDEN_CATEGORIES.has(o.identity.category)) return true;
  return o.identity.category === 'obstaculo' && o.identity.name.toLowerCase().includes('medusa');
}

export interface HideHost {
  isHidden(layer: HideLayer): boolean;
  setHidden(layer: HideLayer, hidden: boolean): void;
}

/**
 * Esconde para la partida cada capa de `layers` que no estuviera ya
 * escondida. Devuelve cómo dejarlo todo como estaba: vuelve a mostrar sólo
 * lo que escondió (en orden inverso), una vez.
 */
export function hideForGame(
  host: HideHost,
  layers: readonly HideLayer[] = HIDE_LAYERS,
): () => void {
  const hid: HideLayer[] = [];
  for (const l of layers) {
    if (host.isHidden(l)) continue;
    host.setHidden(l, true);
    hid.push(l);
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    for (const l of [...hid].reverse()) host.setHidden(l, false);
  };
}

/** Lo que `Mar3D` ofrece para esconder (las marcas de la ruta, la fauna y vistas por `kind`). */
export interface EngineHideTarget {
  readonly routeHidden: boolean;
  setRouteHidden(hidden: boolean): void;
  readonly wildlifeHidden: boolean;
  setWildlifeHidden(hidden: boolean): void;
  isKindsHidden(layer: string): boolean;
  setKindsHidden(layer: string, kinds: readonly string[] | null): void;
}

/**
 * El anfitrión de `/mar`: las marcas y las vistas del 3D en el motor; el
 * resto (fichas, botellas cerca, «?», rótulos) en `ui`, el conjunto de
 * capas escondidas que lee la interfaz.
 */
export function marHideHost(
  engine: EngineHideTarget,
  ui: { get(): ReadonlySet<HideLayer>; set(next: ReadonlySet<HideLayer>): void },
): HideHost {
  return {
    isHidden: (l) => {
      if (l === 'route') return engine.routeHidden;
      if (l === 'wildlife') return engine.wildlifeHidden;
      if (LAYER_KINDS[l]) return engine.isKindsHidden(l);
      return ui.get().has(l);
    },
    setHidden: (l, hidden) => {
      if (l === 'route') engine.setRouteHidden(hidden);
      if (l === 'wildlife') engine.setWildlifeHidden(hidden);
      const kinds = LAYER_KINDS[l];
      if (kinds) engine.setKindsHidden(l, hidden ? kinds : null);
      const next = new Set(ui.get());
      if (hidden) next.add(l);
      else next.delete(l);
      ui.set(next);
    },
  };
}

/**
 * Los rótulos durante la partida: sólo los de las islas (fuera la Fiestera,
 * el náufrago, la salida del circuito…), en el mar y en el minimapa.
 */
export function islandPinsOnly<P extends { id: string }>(
  world: WorldConfig,
  pins: readonly P[],
): P[] {
  const islands = new Set(
    world.objects.filter((o) => o.identity.category === 'isla').map((o) => o.identity.id),
  );
  return pins.filter((p) => islands.has(p.id));
}

// --- Bloqueo -----------------------------------------------------------------------

/** Por qué no se puede empezar ahora (la clave i18n que lo explica), o null. */
export function canonBlockKey(s: { raceActive: boolean }): 'mar.canon.lock.race' | null {
  return s.raceActive ? 'mar.canon.lock.race' : null;
}

// --- El mar de la partida ----------------------------------------------------------

/**
 * El mar de la partida desde el de `/mar`: el periodo del planeta, las islas
 * y el decorado sólido con los que choca el barco (sin lo que la partida
 * aparta: un cocodrilo escondido no es una pared invisible) y el barco
 * donde está.
 */
export function survivorsSea(
  world: WorldConfig,
  period: Rect,
  start: SurvivorsWorld['start'],
  extraSolids: readonly { x: number; y: number; radius: number }[] = [],
): SurvivorsWorld {
  const shown = { ...world, objects: world.objects.filter((o) => !hiddenDuringGame(o)) };
  return survivorsWorldOf(shown, period, start, extraSolids);
}

// --- La partida ---------------------------------------------------------------------

export interface SurvivorsRunOptions {
  seed: number;
  quality: QualityTier;
  /** La física del barco de `/mar` (la config le aplica su maniobrabilidad). */
  ship: ShipConfig;
  /** Empezar en ese segundo (atajo `&t=`). */
  startAtS?: number;
  config?: SurvivorsConfig;
  /**
   * Elegir sola la primera carta de nivel (sólo para pruebas y bots: en
   * `/mar` las elige el jugador con `choose`, T118). Por defecto, no.
   */
  autoPickCards?: boolean;
  /** Al acabar (una vez): la razón y el estado final. */
  onEnd?: (reason: EndReason, snapshot: SurvivorsSnapshot) => void;
}

/** El estado de la partida para las pruebas (atributos `data-*`, como el cronómetro de la carrera). */
export interface CanonHook {
  estado: SurvivorsStatus;
  /** s que faltan para amanecer (enteros, hacia arriba). */
  tiempo: number;
  /** s de tiempo activo (una décima). */
  activo: number;
  /** Agua a bordo (entera) y su tope. */
  agua: number;
  aguaMax: number;
  nivel: number;
  enemigos: number;
  derrotados: number;
  notas: number;
  fin: EndReason | null;
  semilla: number;
  calidad: QualityTier;
  /** Dónde va el barco de la partida (u, enteros): «x,y». */
  barco: string;
  /** Las mejoras elegidas en las cartas, «id:veces» separadas por comas, en orden (T118). */
  mejoras: string;
  /** Opciones de la carta de nivel abierta (0 sin carta). */
  carta: number;
}

/**
 * Una partida en `/mar`: la simulación, su reloj de tiempo real y la
 * entrada. `tick` (con el reloj del navegador) dice cuántos pasos fijos dar
 * y cuenta como pausa la pestaña oculta y los huecos largos; `step` da uno
 * con el mando del barco.
 */
export class SurvivorsRun {
  readonly game: SurvivorsGame;
  readonly config: SurvivorsConfig;
  readonly seed: number;
  readonly quality: QualityTier;
  private readonly clock = new SurvivorsClock();
  private readonly autoPick: boolean;
  private readonly onEnd: SurvivorsRunOptions['onEnd'];
  private lastMs: number | null = null;
  private notified = false;
  /** La opción de la carta que el jugador eligió, para el paso siguiente. */
  private pendingChoice: number | null = null;

  constructor(world: SurvivorsWorld, opts: SurvivorsRunOptions) {
    this.config = opts.config ?? SURVIVORS_CONFIG;
    this.seed = opts.seed;
    this.quality = opts.quality;
    this.autoPick = opts.autoPickCards ?? false;
    this.onEnd = opts.onEnd;
    this.game = createSurvivors(this.config, opts.seed, world, {
      quality: opts.quality,
      ship: opts.ship,
      ...(opts.startAtS ? { startAtS: opts.startAtS } : {}),
    });
  }

  /**
   * El reloj del navegador ahora (ms, `performance.now()`) y si la pestaña
   * está oculta: los pasos fijos que tocan (oculta, ninguno: todo es pausa).
   */
  tick(nowMs: number, hidden: boolean): number {
    const dt = this.lastMs === null ? 0 : Math.max(0, (nowMs - this.lastMs) / 1000);
    this.lastMs = nowMs;
    const n = this.clock.frame(this.game, dt, hidden);
    this.notifyEnd();
    return n;
  }

  /** Cuánto del paso siguiente ya pasó (0…1), para pintar entre pasos. */
  get alpha(): number {
    return this.clock.alpha;
  }

  /** Un paso fijo con el mando del barco (y la opción de la carta elegida, si la hay). */
  step(input: ShipInput): readonly SurvivorsEvent[] {
    let choose: number | null = null;
    if (this.game.status === 'card') choose = this.autoPick ? 0 : this.pendingChoice;
    this.pendingChoice = null;
    const events = this.game.step(choose === null ? { ship: input } : { ship: input, choose });
    this.notifyEnd();
    return events;
  }

  /**
   * El jugador elige la opción `index` de la carta de nivel abierta (T118):
   * se aplica en el paso siguiente. Sin carta abierta no hace nada.
   */
  choose(index: number): void {
    if (this.game.status !== 'card') return;
    const card = this.game.snapshot().card;
    if (!card || index < 0 || index >= card.options.length) return;
    this.pendingChoice = index;
  }

  /**
   * Atajo de desarrollo `&carta=1` (T118): una nota con lo que falta para
   * el nivel siguiente, encima del barco; en el primer paso se recoge y se
   * abre la carta.
   */
  devLevelUp(): void {
    const s = this.game.snapshot();
    this.game.spawnNote(s.player.x, s.player.y, Math.max(1, s.xp.toNext - s.xp.xp));
  }

  /** Pausa (un panel encima, el menú): los pasos cuentan como pausa. */
  setPaused(paused: boolean): void {
    this.game.setPaused(paused);
  }

  get ended(): boolean {
    return this.game.ended;
  }

  snapshot(): SurvivorsSnapshot {
    return this.game.snapshot();
  }

  hook(): CanonHook {
    const s = this.game.snapshot();
    return {
      estado: s.status,
      tiempo: Math.ceil(s.timeLeftS - 1e-6),
      activo: Math.round(s.activeS * 10) / 10,
      agua: Math.round(s.water.level),
      aguaMax: s.water.capacity,
      nivel: s.xp.level,
      enemigos: s.enemies.length,
      derrotados: s.defeated,
      notas: s.notesPicked,
      fin: s.end,
      semilla: this.seed,
      calidad: this.quality,
      barco: `${Math.round(s.player.x)},${Math.round(s.player.y)}`,
      mejoras: Object.entries(s.upgrades)
        .map(([id, n]) => `${id}:${n}`)
        .sort()
        .join(','),
      carta: s.card?.options.length ?? 0,
    };
  }

  private notifyEnd(): void {
    if (this.notified || !this.game.ended) return;
    this.notified = true;
    const s = this.game.snapshot();
    this.onEnd?.(s.end!, s);
  }
}

/** Una semilla al azar para una partida sin `&seed=`. */
export function randomSeed(): number {
  return (Math.floor(Math.random() * 2147483646) % 2147483646) + 1;
}
