import type { ShipConfig, ShipInput } from '@boia/engine/headless';
import type { QualityTier } from '@boia/engine/streaming';
import {
  type DefeatStyle,
  type DifficultyId,
  DROP_IDS,
  type EndReason,
  SURVIVORS_CONFIG,
  SurvivorsClock,
  asDifficulty,
  type SurvivorsConfig,
  type SurvivorsEvent,
  type SurvivorsGame,
  type SurvivorsMedal,
  type SurvivorsSnapshot,
  type SurvivorsStatus,
  type SurvivorsWorld,
  type WeaponId,
  createSurvivors,
  survivorsMedal,
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
  /**
   * `carta=1`: empezar con una carta de nivel abierta (T118, para probar las
   * cartas); `carta=surtido` (T130): una carta con una opción de cada clase
   * (arma nueva, nivel de arma, vinilo nuevo, nivel de vinilo, evolución y Salvavidas).
   */
  card: 'carta',
  /** `armas=1`: empezar con las siete armas a nivel máximo (T128, para probar cómo se ven). */
  weapons: 'armas',
  /** `dificultad=tranquila|normal|tormenta`: empezar con esa dificultad (T131). */
  difficulty: 'dificultad',
  /**
   * `botin=1` (T135): toda élite derrotada suelta objeto (100 %) y la
   * partida empieza con los tres objetos del botín flotando junto al barco.
   */
  loot: 'botin',
  /**
   * `acto=<n>` (T142): jugar el acto `n` del guion (el 2 trae al Kraken).
   * Atajo temporal hasta que el panel elija el acto (T144).
   */
  act: 'acto',
  /**
   * `vencer=1` (T144): cada boss cae en cuanto aparece (los minibosses
   * sueltan su cofre; el final acaba la partida con el oro). Para probar las
   * medallas y la campaña sin luchar.
   */
  win: 'vencer',
  dev: 'dev',
} as const;

/** El valor de `&carta=` que abre la carta con una opción de cada clase (T130). */
export const CARD_MIX = 'surtido';

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
 * salta tiempo), `&seed=` (una semilla elegida se puede ensayar),
 * `&carta=1` (un nivel regalado), `&armas=1` (todas las armas) o `&botin=1`
 * (el botín de regalo, T135), `&acto=` (otro acto, T142) o `&vencer=1`
 * (los bosses caen solos, T144). `&derrota=` sólo cambia cómo se ve: no.
 */
export function isDevStart(s: {
  t?: number;
  seed?: number | null;
  card?: boolean;
  weapons?: boolean;
  loot?: boolean;
  act?: number | null;
  win?: boolean;
}): boolean {
  return (
    (s.t ?? 0) > 0 ||
    (s.seed ?? null) !== null ||
    s.card === true ||
    s.weapons === true ||
    s.loot === true ||
    (s.act ?? null) !== null ||
    s.win === true
  );
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
  /** Empezar con una carta de nivel abierta (`&carta=1` o `&carta=surtido`). */
  card: boolean;
  /** La carta de nivel con una opción de cada clase (`&carta=surtido`, T130). */
  mix: boolean;
  /** Empezar con todas las armas a nivel máximo (`&armas=1`). */
  weapons: boolean;
  /** Dificultad pedida (`&dificultad=`), o null (la elegida en el panel). */
  difficulty: DifficultyId | null;
  /** El botín siempre y de regalo al empezar (`&botin=1`, T135). */
  loot: boolean;
  /** Acto pedido (`&acto=<n>`, T142), o null (el primero). Sólo actos que la config tiene. */
  act: number | null;
  /** Los bosses caen en cuanto aparecen (`&vencer=1`, T144). */
  win: boolean;
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
    card: q.get(CANON_PARAMS.card) === '1' || q.get(CANON_PARAMS.card) === CARD_MIX,
    mix: q.get(CANON_PARAMS.card) === CARD_MIX,
    weapons: q.get(CANON_PARAMS.weapons) === '1',
    difficulty: asDifficulty(q.get(CANON_PARAMS.difficulty)),
    loot: q.get(CANON_PARAMS.loot) === '1',
    act: asAct(q.get(CANON_PARAMS.act), config),
    win: q.get(CANON_PARAMS.win) === '1',
  };
}

/** El acto `v` si la config lo tiene (`acts[].act`); si no, null. */
export function asAct(v: string | null | undefined, config: SurvivorsConfig = SURVIVORS_CONFIG): number | null {
  if (v === null || v === undefined || !/^\d+$/.test(v)) return null;
  const n = Number(v);
  return config.acts.some((a) => a.act === n) ? n : null;
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
    CANON_PARAMS.weapons,
    CANON_PARAMS.difficulty,
    CANON_PARAMS.loot,
    CANON_PARAMS.act,
    CANON_PARAMS.win,
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
  /** Sólo atajo `&armas=1`: huecos para todas las armas en esta partida de prueba. */
  devWeapons?: boolean;
  /** Sólo atajo `&carta=surtido` (T130): una config recortada para que salga una carta de cada clase. */
  devMix?: boolean;
  /** Sólo atajo `&botin=1` (T135): toda élite suelta objeto en esta partida de prueba. */
  devLoot?: boolean;
  config?: SurvivorsConfig;
  /** Dificultad (T131); sin valor, Normal. */
  difficulty?: DifficultyId;
  /** Acto del guion (el panel o el atajo `&acto=`, T142/T144); sin valor, el primero. */
  act?: number;
  /** Sólo atajo `&vencer=1` (T144): cada boss cae en cuanto aparece. */
  devWin?: boolean;
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
  /** Dificultad de la partida: tranquila, normal o tormenta (T131). */
  dificultad: DifficultyId;
  calidad: QualityTier;
  /** Dónde va el barco de la partida (u, enteros): «x,y». */
  barco: string;
  /** Las mejoras elegidas en las cartas, «id:veces» separadas por comas, en orden (T118). */
  mejoras: string;
  /** Opciones de la carta de nivel abierta (0 sin carta). */
  carta: number;
  /** Objetos del botín cogidos (T135) y los que flotan ahora. */
  botin: number;
  botinAgua: number;
  /** Dónde flota el objeto del botín más cercano al barco (u, enteros): «x,y»; '' sin ninguno. */
  botinCerca: string;
  /** s que le quedan a la Llama (hacia arriba; 0 apagada). */
  llama: number;
  /** Acto que se juega (T142). */
  acto: number;
  /** La medalla de la partida acabada (T144): bronce, plata u oro; '' sin medalla o sin acabar. */
  medalla: SurvivorsMedal | '';
  /** Los bosses vencidos, en orden (sus `BossId` separados por espacios; '' ninguno, T144). */
  vencidos: string;
  /** Los bosses vivos (sus `BossId`, separados por espacios; '' sin ninguno, T139). */
  jefes: string;
  /** Dónde flota el cofre más cercano al barco (u, enteros): «x,y»; '' sin ninguno (T139). */
  cofreCerca: string;
}

/**
 * Una partida en `/mar`: la simulación, su reloj de tiempo real y la
 * entrada. `tick` (con el reloj del navegador) dice cuántos pasos fijos dar
 * y cuenta como pausa la pestaña oculta y los huecos largos; `step` da uno
 * con el mando del barco.
 */
/**
 * La config recortada del atajo `&carta=surtido`: tres armas, dos vinilos, la
 * evolución del Cañón y el Salvavidas siempre a mano, y seis opciones por
 * carta. Así la carta trae justo una de cada clase.
 */
export function mixConfig(config: SurvivorsConfig): SurvivorsConfig {
  const pick = <T,>(all: Partial<Record<string, T>>, ids: string[]) =>
    Object.fromEntries(ids.filter((id) => all[id]).map((id) => [id, all[id]]));
  return {
    ...config,
    cardChoices: 6,
    weapons: pick(config.weapons, ['canon', 'subwoofer', 'laser']) as SurvivorsConfig['weapons'],
    passives: pick(config.passives, ['hardstyle', 'house']) as SurvivorsConfig['passives'],
    evolutions: config.evolutions.filter((e) => e.id === 'drop'),
    salvavidas: { ...config.salvavidas, offerChance: 1 },
  };
}

/** El objeto del botín más cercano al barco, «x,y» (u, enteros), o '' sin ninguno (para las pruebas). */
export function nearestPickup(s: Pick<SurvivorsSnapshot, 'pickups' | 'player'>): string {
  return nearestOf(s.pickups, s.player);
}

/** Lo más cercano de `list` a `from`, «x,y» (u, enteros), o '' si no hay nada. */
function nearestOf(list: readonly { x: number; y: number }[], from: { x: number; y: number }): string {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const o of list) {
    const d = Math.hypot(o.x - from.x, o.y - from.y);
    if (d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best ? `${Math.round(best.x)},${Math.round(best.y)}` : '';
}

/** u del barco a los que el atajo `&botin=1` deja los objetos del botín. */
export const LOOT_DISTANCE = 90;

/** La config del atajo `&botin=1` (T135): toda élite suelta objeto. */
export function lootConfig(config: SurvivorsConfig): SurvivorsConfig {
  return { ...config, drops: { ...config.drops, chance: 1 } };
}

export class SurvivorsRun {
  readonly game: SurvivorsGame;
  readonly config: SurvivorsConfig;
  readonly seed: number;
  readonly quality: QualityTier;
  readonly difficulty: DifficultyId;
  /** El acto que se juega (T144). */
  readonly act: number;
  private readonly clock = new SurvivorsClock();
  private readonly autoPick: boolean;
  private readonly onEnd: SurvivorsRunOptions['onEnd'];
  private lastMs: number | null = null;
  private notified = false;
  private readonly devWin: boolean;
  /** La opción de la carta que el jugador eligió, para el paso siguiente. */
  private pendingChoice: number | null = null;

  constructor(world: SurvivorsWorld, opts: SurvivorsRunOptions) {
    const config = opts.config ?? SURVIVORS_CONFIG;
    const base =
      opts.devWeapons && devShortcutsEnabled()
        ? { ...config, slots: { ...config.slots, weapons: Object.keys(config.weapons).length } }
        : opts.devMix && devShortcutsEnabled()
          ? mixConfig(config)
          : config;
    this.config = opts.devLoot && devShortcutsEnabled() ? lootConfig(base) : base;
    this.seed = opts.seed;
    this.quality = opts.quality;
    this.difficulty = opts.difficulty ?? 'normal';
    this.act = opts.act ?? 1;
    this.devWin = opts.devWin === true && devShortcutsEnabled();
    this.autoPick = opts.autoPickCards ?? false;
    this.onEnd = opts.onEnd;
    this.game = createSurvivors(this.config, opts.seed, world, {
      quality: opts.quality,
      ship: opts.ship,
      ...(opts.difficulty ? { difficulty: opts.difficulty } : {}),
      ...(opts.act ? { act: opts.act } : {}),
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
  step(input: ShipInput, turbo = false): readonly SurvivorsEvent[] {
    let choose: number | null = null;
    if (this.game.status === 'card') choose = this.autoPick ? 0 : this.pendingChoice;
    this.pendingChoice = null;
    const events = this.game.step(
      choose === null ? { ship: input, turbo } : { ship: input, turbo, choose },
    );
    // `&vencer=1` (T144): el boss que haya aparecido cae ya.
    if (this.devWin) this.game.defeatBossesNow();
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

  /**
   * Atajo `&carta=surtido` (T130): con la config recortada de `mixConfig`, el
   * Cañón a nivel 5 y el Subwoofer y el vinilo Hardstyle cogidos; la carta
   * lleva una opción de cada clase. Sólo con los atajos encendidos.
   */
  devMixCard(env: DevEnv = devEnv()): void {
    if (!devShortcutsEnabled(env)) return;
    this.game.addWeapon('subwoofer');
    while (this.game.levelUpWeapon('canon')) {
      /* hasta el último nivel del Cañón */
    }
    this.game.addVinyl('hardstyle');
    this.devLevelUp();
  }

  /**
   * Atajo `&armas=1` (T128): las siete armas a su nivel máximo, por las API de
   * la simulación y sin tocar la config compartida (los huecos de más los da
   * `devWeapons` al crear la partida). Sólo con los atajos encendidos.
   */
  devAllWeapons(env: DevEnv = devEnv()): void {
    if (!devShortcutsEnabled(env)) return;
    for (const id of Object.keys(this.config.weapons) as WeaponId[]) {
      this.game.addWeapon(id);
      while (this.game.levelUpWeapon(id)) {
        /* hasta el último nivel de su tabla */
      }
    }
  }

  /**
   * Atajo `&botin=1` (T135): los tres objetos del botín flotando alrededor
   * del barco, el primero justo delante (a un par de cascos), para verlos y
   * cogerlos sin esperar a una élite. Sólo con los atajos encendidos.
   */
  devLoot(env: DevEnv = devEnv()): void {
    if (!devShortcutsEnabled(env)) return;
    const p = this.game.snapshot().player;
    DROP_IDS.forEach((item, k) => {
      const a = p.heading + (k * Math.PI * 2) / DROP_IDS.length;
      this.game.spawnPickup(item, p.x + Math.cos(a) * LOOT_DISTANCE, p.y + Math.sin(a) * LOOT_DISTANCE);
    });
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
      dificultad: s.difficulty,
      calidad: this.quality,
      barco: `${Math.round(s.player.x)},${Math.round(s.player.y)}`,
      mejoras: Object.entries(s.upgrades)
        .map(([id, n]) => `${id}:${n}`)
        .sort()
        .join(','),
      carta: s.card?.options.length ?? 0,
      botin: s.pickupsTaken,
      botinAgua: s.pickups.length,
      botinCerca: nearestPickup(s),
      llama: s.flame ? Math.ceil(s.flame.leftS - 1e-6) : 0,
      acto: s.act,
      medalla: survivorsMedal(s, this.config) ?? '',
      vencidos: s.bossesDefeated.join(' '),
      jefes: s.bosses.map((b) => b.boss).join(' '),
      cofreCerca: nearestOf(s.chests, s.player),
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
