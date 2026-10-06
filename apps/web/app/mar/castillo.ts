import type { QualityTier } from '@boia/engine/streaming';
import {
  DEFAULT_DEFENSE_RUN_MIN,
  DEFENSE_CONFIG,
  DEFENSE_TOWER_KINDS,
  DefenseClock,
  type DefenseConfig,
  type DefenseEndReason,
  type DefenseBuildCheck,
  type DefenseEvent,
  type DefenseGame,
  type DefenseInput,
  type DefensePlaneStat,
  type DefenseRunMin,
  type DefenseSnapshot,
  type DefenseStatus,
  type DefenseTargetPriority,
  type DefenseTimeScale,
  type DefenseTowerKind,
  type DifficultyId,
  asDefenseRunMin,
  createDefense,
  defenseClampToArena,
  defenseSiteReason,
} from '@boia/engine/defense';
import { asDifficulty } from '@boia/engine/survivors';
import { CASTLE_GAME_ID } from '@boia/world';
import { nextTowerByKeyboard, towerAt } from './castillo-hud-model';
import { CANON_PARAMS, type DevEnv, devEnv, devShortcutsEnabled } from './survivors';

/**
 * «Defensa del Castillo» dentro de `/mar` (plan 014 T160), sin three.js ni
 * React: la partida de `@boia/engine/defense` con su reloj de tiempo real,
 * que el bucle de `Mar3D` da paso a paso con el mando del avión, y el atajo
 * de desarrollo que la empieza (`?minijuego=castillo`). El pop-up, la
 * tarjeta final y las medallas son de T162 (`castillo-previa.tsx`,
 * `castillo-mode.tsx`); el HUD, de T161.
 */

export { CASTLE_GAME_ID };

/** Los parámetros del atajo (`minijuego`, `t`, `seed` y `dificultad`, los del Cañón). */
export const CASTLE_PARAMS = {
  game: CANON_PARAMS.game,
  t: CANON_PARAMS.t,
  seed: CANON_PARAMS.seed,
  difficulty: CANON_PARAMS.difficulty,
  /** `duracion=5|7|10`: los minutos de la partida. */
  duration: 'duracion',
  /**
   * `islas=1`: empezar con las siete islas construidas a nivel 3 (vista y
   * rendimiento); `islas=lleno` (T165): la arena llena de islas a nivel 3,
   * todas las que caben (sin tope), para medir el peor caso.
   */
  islands: 'islas',
  /** `monedas=N`: N monedas más en el monedero al empezar (pruebas del HUD, T161). */
  coins: 'monedas',
  /**
   * `vencer=1` (T162, como el del Cañón): la partida empieza a
   * `DEV_WIN_LEAD_S` del final, así el castillo aguanta entero (oro) sin
   * jugar; para probar la tarjeta, las medallas y el tablón.
   */
  win: CANON_PARAMS.win,
  /**
   * `oferta=1` (T162): en vez de empezar, el panel de la isla del castillo;
   * los demás atajos de la URL se guardan para la partida que se empiece
   * desde su pop-up (que entonces tampoco entra en el ranking).
   */
  offer: CANON_PARAMS.offer,
} as const;

/** `vencer=1`: los segundos que quedan de partida al empezar. */
export const DEV_WIN_LEAD_S = 3;

export interface CastleShortcut {
  t: number;
  seed: number | null;
  difficulty: DifficultyId | null;
  runMin: DefenseRunMin | null;
  islands: boolean;
  /** `islas=lleno`: todas las islas que caben en la arena, no sólo siete. */
  fullArena: boolean;
  /** Monedas de más al empezar (`monedas=`), o null. */
  coins: number | null;
  /** `vencer=1`: empezar a punto de aguantar. */
  win: boolean;
  /** `oferta=1`: abrir el panel de la isla en vez de empezar. */
  offer: boolean;
}

/** `?minijuego=castillo&…`: qué pide la URL, o null (otro juego o atajos apagados). */
export function castleShortcut(
  search: string,
  env: DevEnv = devEnv(),
  config: DefenseConfig = DEFENSE_CONFIG,
): CastleShortcut | null {
  const q = new URLSearchParams(search);
  if (q.get(CASTLE_PARAMS.game) !== CASTLE_GAME_ID) return null;
  if (!devShortcutsEnabled({ ...env, search })) return null;
  const runMin = asDefenseRunMin(q.get(CASTLE_PARAMS.duration));
  const duration = config.runs[runMin ?? 5].durationS;
  const t = Number(q.get(CASTLE_PARAMS.t));
  const seed = Math.floor(Number(q.get(CASTLE_PARAMS.seed)));
  const coins = Math.floor(Number(q.get(CASTLE_PARAMS.coins)));
  return {
    t: Number.isFinite(t) && t > 0 ? Math.min(t, duration - 1) : 0,
    seed: Number.isFinite(seed) && seed > 0 ? seed : null,
    difficulty: asDifficulty(q.get(CASTLE_PARAMS.difficulty)),
    runMin,
    islands: ['1', 'lleno'].includes(q.get(CASTLE_PARAMS.islands) ?? ''),
    fullArena: q.get(CASTLE_PARAMS.islands) === 'lleno',
    coins: Number.isFinite(coins) && coins > 0 ? Math.min(coins, 99999) : null,
    win: q.get(CASTLE_PARAMS.win) === '1',
    offer: q.get(CASTLE_PARAMS.offer) === '1',
  };
}

/** La URL sin el atajo del castillo (se consume al usarlo); `dev` se queda. */
export function withoutCastleShortcut(href: string): string {
  const url = new URL(href);
  for (const p of Object.values(CASTLE_PARAMS)) url.searchParams.delete(p);
  return url.href;
}

/**
 * Sitios para las siete islas del atajo `islas=1`: junto al camino (a los
 * dos lados, repartidas por su largo) donde la regla de construir las deja
 * (sin contar el avión ni el dinero). Siempre los mismos.
 */
export function devTowerSpots(
  game: Pick<DefenseGame, 'path' | 'config'>,
  n: number = DEFENSE_TOWER_KINDS.length,
): { x: number; y: number }[] {
  const { path, config } = game;
  const out: { x: number; y: number }[] = [];
  const off = path.width / 2 + config.islandRadius + config.towers.pathClearance + 6;
  const tries = 64;
  for (let i = 0; i < tries && out.length < n; i++) {
    const s = path.sampleAt(path.length * (0.12 + (0.8 * i) / tries));
    for (const side of [1, -1]) {
      const x = s.x + s.nx * off * side;
      const y = s.y + s.ny * off * side;
      if (defenseSiteReason(config, path, out, x, y) !== null) continue;
      // Repartidas: lejos de las que ya hay.
      if (out.some((p) => Math.hypot(p.x - x, p.y - y) < config.islandRadius * 5)) continue;
      out.push({ x, y });
      break;
    }
  }
  return out;
}

/**
 * Sitios para el atajo `islas=lleno` (T165): una rejilla por toda la arena
 * donde la regla de construir deja poner una isla junto a las ya puestas
 * (sin contar el avión ni el dinero): todas las que caben. Siempre los mismos.
 */
export function devArenaSpots(
  game: Pick<DefenseGame, 'path' | 'config'>,
): { x: number; y: number }[] {
  const { path, config } = game;
  const out: { x: number; y: number }[] = [];
  const step = config.islandRadius / 2;
  const r = config.arenaRadius;
  for (let y = -r; y <= r; y += step)
    for (let x = -r; x <= r; x += step)
      if (defenseSiteReason(config, path, out, x, y) === null) out.push({ x, y });
  return out;
}

/**
 * La isla que se está colocando (T161): su tipo y dónde va (u de la
 * partida). Al elegirla va justo debajo del avión y lo sigue (con el
 * teclado se lleva volando); un toque en el agua la deja en ese sitio de la
 * arena (`at`, plan 015 T170, decisión 6) y ahí se queda.
 */
export interface CastlePlacing {
  kind: DefenseTowerKind;
  /** El sitio tocado, o null: debajo del avión. */
  at: { x: number; y: number } | null;
}

/**
 * Lo que hizo un toque en el agua de la arena (plan 015 T170, decisión 6):
 * mover la isla que se coloca, elegir una isla construida (el HUD abre su
 * ficha) o mandar el avión allí (ya acotado a la arena).
 */
export type CastleTap =
  | { type: 'place'; x: number; y: number }
  | { type: 'select'; towerId: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'none' };

/** La vista previa: dónde caería la isla y si se puede (con el motivo de T159). */
export interface CastlePlacement {
  kind: DefenseTowerKind;
  x: number;
  y: number;
  check: DefenseBuildCheck;
}

/** Holgura del toque para elegir una isla construida (× su radio). */
export const TOWER_TAP_SLACK = 1.25;

export interface DefenseRunOptions {
  seed: number;
  quality: QualityTier;
  runMin?: DefenseRunMin;
  difficulty?: DifficultyId;
  /** Atajo `&t=`: empieza en ese segundo (no entra en el ranking). */
  startAtS?: number;
  /** Atajo `islas=1`: las siete islas a nivel 3 desde el principio (no entra en el ranking). */
  devIslands?: boolean;
  /** Atajo `islas=lleno`: todas las islas que caben, a nivel 3, por turno de tipo. */
  devFullArena?: boolean;
  /** Atajo `monedas=`: monedas de más al empezar (no entra en el ranking). */
  devCoins?: number;
  /** Atajo `vencer=1`: empezar a `DEV_WIN_LEAD_S` del final (no entra en el ranking). */
  devWin?: boolean;
  /**
   * La partida la empezó un atajo de desarrollo (cualquiera: también
   * `duracion=` o `dificultad=` solos, T162): nunca entra en el ranking.
   */
  devStart?: boolean;
  config?: DefenseConfig;
  onEnd?: (reason: DefenseEndReason, snapshot: DefenseSnapshot) => void;
  /** Lo que pasó en cada paso fijo (el sonido, T164); no debe tocar la partida. */
  onEvents?: (events: readonly DefenseEvent[]) => void;
}

/** El estado de la partida para las pruebas (`data-*` de `data-testid="mar-castillo"`). */
export interface CastleHook {
  estado: DefenseStatus;
  /** s que faltan (enteros, hacia arriba). */
  tiempo: number;
  activo: number;
  vida: number;
  vidaMax: number;
  monedas: number;
  enemigos: number;
  derrotados: number;
  /** Islas construidas. */
  islas: number;
  /** La isla que se coloca (tipo) o ''; la isla elegida (id) o ''. T161. */
  colocando: string;
  seleccion: string;
  /** Nivel de daño del avión. */
  avionNivel: number;
  /** Nivel de velocidad de ataque del avión (plan 015 T171). */
  avionVelocidad: number;
  /** Nivel del castillo (sus mejoras de vida). */
  castilloNivel: number;
  /** ×1 o ×2. */
  escala: DefenseTimeScale;
  /** s que «Llamar oleada» ha adelantado el calendario (enteros). */
  adelanto: number;
  /** Dónde va el avión en la partida (u, enteros): «x,y». */
  avion: string;
  fin: DefenseEndReason | null;
  semilla: number;
  dificultad: DifficultyId;
  duracion: DefenseRunMin;
  calidad: QualityTier;
}

/**
 * Una partida en `/mar`: la simulación, su reloj de tiempo real y la
 * entrada. `tick` (con el reloj del navegador) dice cuántos pasos fijos dar
 * (la pestaña oculta y los huecos largos son pausa); `step` da uno con el
 * mando del avión (ya en el marco de la partida).
 */
export class DefenseRun {
  readonly game: DefenseGame;
  readonly config: DefenseConfig;
  readonly seed: number;
  readonly quality: QualityTier;
  /** La empezó un atajo de desarrollo: no entra en el ranking (T162). */
  readonly devStart: boolean;
  private readonly clock = new DefenseClock();
  private lastMs: number | null = null;
  private notified = false;
  private readonly onEnd: DefenseRunOptions['onEnd'];
  private readonly onEvents: DefenseRunOptions['onEvents'];
  /** Lo que se pide para el paso siguiente (construir, mejorar…: el HUD de T161). */
  private pending: Omit<DefenseInput, 'move'> = {};

  constructor(opts: DefenseRunOptions) {
    this.config = opts.config ?? DEFENSE_CONFIG;
    this.seed = opts.seed;
    this.quality = opts.quality;
    this.onEnd = opts.onEnd;
    this.onEvents = opts.onEvents;
    const dev = opts.devIslands === true;
    const devCoins = Math.max(0, Math.floor(opts.devCoins ?? 0));
    const devWin = opts.devWin === true;
    const durationS = this.config.runs[opts.runMin ?? DEFAULT_DEFENSE_RUN_MIN].durationS;
    const startAtS = devWin
      ? Math.max(opts.startAtS ?? 0, durationS - DEV_WIN_LEAD_S)
      : (opts.startAtS ?? 0);
    this.devStart =
      opts.devStart === true ||
      dev ||
      opts.devFullArena === true ||
      devCoins > 0 ||
      devWin ||
      startAtS > 0;
    this.game = createDefense(this.config, opts.seed, {
      ...(opts.runMin ? { runMin: opts.runMin } : {}),
      ...(opts.difficulty ? { difficulty: opts.difficulty } : {}),
      ...(startAtS > 0 ? { startAtS } : {}),
      ...(this.devStart ? { unranked: true } : {}),
    });
    if (devCoins > 0) this.game.refund(devCoins);
    if (opts.devFullArena === true) {
      devArenaSpots(this.game).forEach((p, i) => {
        const kind = DEFENSE_TOWER_KINDS[i % DEFENSE_TOWER_KINDS.length]!;
        this.game.addTower(kind, p.x, p.y, { level: 3 });
      });
    } else if (dev) {
      const spots = devTowerSpots(this.game);
      DEFENSE_TOWER_KINDS.forEach((kind: DefenseTowerKind, i) => {
        const p = spots[i];
        if (p) this.game.addTower(kind, p.x, p.y, { level: 3 });
      });
    }
  }

  /** El reloj del navegador ahora (ms) y si la pestaña está oculta: los pasos fijos que tocan. */
  tick(nowMs: number, hidden: boolean): number {
    const dt = this.lastMs === null ? 0 : Math.max(0, (nowMs - this.lastMs) / 1000);
    this.lastMs = nowMs;
    const n = this.clock.frame(this.game, dt, hidden);
    this.notifyEnd();
    return n;
  }

  get alpha(): number {
    return this.clock.alpha;
  }

  /** Pide algo para el paso siguiente (construir, mejorar, vender, subir el avión). */
  request(input: Omit<DefenseInput, 'move' | 'pause'>): void {
    this.pending = { ...this.pending, ...input };
  }

  // --- Construir, elegir, mejorar y vender (el HUD de T161) ---------------------

  /** La isla que se está colocando, o null. */
  placing: CastlePlacing | null = null;
  /** La isla construida que está elegida (su ficha abierta), o null. */
  selected: number | null = null;

  /** La lista de «Construir» está abierta (el HUD lo dice: la cámara va a la vista de salida). */
  buildMenu = false;

  /** Se está construyendo: la lista abierta o una isla colocándose (plan 015 T170, decisión 4). */
  get building(): boolean {
    return this.buildMenu || this.placing !== null;
  }

  /** El HUD abre o cierra la lista de «Construir». */
  setBuildMenu(open: boolean): void {
    this.buildMenu = open;
  }

  /** Empieza a colocar una isla: debajo del avión. */
  startPlacing(kind: DefenseTowerKind): void {
    this.placing = { kind, at: null };
    this.selected = null;
  }

  cancelPlacing(): void {
    this.placing = null;
  }

  /** Dónde caería la isla que se coloca ahora (con el avión de `s`), o null. */
  placement(s: Pick<DefenseSnapshot, 'plane'> = this.game.snapshot()): CastlePlacement | null {
    const p = this.placing;
    if (!p) return null;
    const x = p.at ? p.at.x : s.plane.x;
    const y = p.at ? p.at.y : s.plane.y;
    return { kind: p.kind, x, y, check: this.game.buildCheck(p.kind, x, y) };
  }

  /** Construye la isla que se coloca, si se puede ahí (el paso siguiente la levanta). */
  confirmPlacing(): boolean {
    const at = this.placement();
    if (!at || !at.check.ok) return false;
    this.request({ build: { kind: at.kind, x: at.x, y: at.y } });
    this.placing = null;
    return true;
  }

  /**
   * Un toque en el agua de la arena (u de la partida; plan 015 T170,
   * decisión 6): colocando, deja ahí la isla (se construye en cualquier
   * sitio de la arena; el sitio lo juzga `buildCheck`); si no, en una isla
   * construida la elige (el HUD abre su ficha), y en el mar manda el avión
   * allí (`moveTo`, acotado a la arena) y cierra la ficha que hubiera.
   */
  tap(x: number, y: number): CastleTap {
    if (!Number.isFinite(x) || !Number.isFinite(y) || this.ended) return { type: 'none' };
    const s = this.game.snapshot();
    if (this.placing) {
      this.placing = { ...this.placing, at: { x, y } };
      return { type: 'place', x, y };
    }
    const hit = towerAt(s.towers, x, y, this.config.islandRadius * TOWER_TAP_SLACK);
    if (hit !== null) {
      this.selected = hit;
      return { type: 'select', towerId: hit };
    }
    this.selected = null;
    const to = defenseClampToArena(this.config, x, y);
    this.request({ moveTo: to });
    return { type: 'move', x: to.x, y: to.y };
  }

  /** Elige una isla (o ninguna). */
  select(id: number | null): void {
    this.selected = id;
    if (id !== null) this.placing = null;
  }

  /** Tecla I: la isla más cercana al avión, y luego la siguiente. */
  selectNext(): number | null {
    const s = this.game.snapshot();
    this.select(nextTowerByKeyboard(s.towers, s.plane, this.selected));
    return this.selected;
  }

  /** La isla elegida en la partida (para su aro en la vista), o null. */
  selectedSpot(
    s: Pick<DefenseSnapshot, 'towers'> = this.game.snapshot(),
  ): { x: number; y: number } | null {
    if (this.selected === null) return null;
    const t = s.towers.find((x) => x.id === this.selected);
    return t ? { x: t.x, y: t.y } : null;
  }

  /** Mejora la isla elegida (si llega el dinero; si no, no pasa nada). */
  upgradeSelected(): void {
    if (this.selected !== null) this.request({ upgradeTower: this.selected });
  }

  /** Vende la isla elegida (y se cierra su ficha). */
  sellSelected(): void {
    if (this.selected === null) return;
    this.request({ sellTower: this.selected });
    this.selected = null;
  }

  /** Sube el daño (o la velocidad de ataque) del avión, si llega el dinero. */
  upgradePlane(stat: DefensePlaneStat = 'damage'): void {
    this.request({ upgradePlane: stat });
  }

  /** Sube la vida máxima del castillo (plan 015 T171, decisión 9), si llega el dinero. */
  upgradeCastle(): void {
    this.request({ upgradeCastle: true });
  }

  /** Cambia a quién apunta una isla construida (decisión 12). */
  setPriority(towerId: number, priority: DefenseTargetPriority): void {
    this.request({ setPriority: { towerId, priority } });
  }

  /** «Llamar oleada» (decisión 10): la siguiente sale ya, con su bono. */
  callWave(): void {
    this.request({ callWave: true });
  }

  /** ×1 o ×2 (decisión 10): la misma partida paso a paso, más deprisa. */
  get timeScale(): DefenseTimeScale {
    return this.clock.scale;
  }

  set timeScale(v: DefenseTimeScale) {
    this.clock.scale = v;
  }

  /** Un paso fijo con el mando del avión (dirección en la partida, −1…1). */
  step(move: { x: number; y: number } | null): readonly DefenseEvent[] {
    const input: DefenseInput = { ...this.pending };
    this.pending = {};
    if (move) input.move = move;
    const events = this.game.step(input);
    if (events.length && this.onEvents) {
      try {
        this.onEvents(events);
      } catch (err) {
        // Quien escucha (el sonido) nunca para la partida.
        console.warn('[boia] fallo al escuchar la partida del castillo', err);
      }
    }
    this.notifyEnd();
    return events;
  }

  setPaused(paused: boolean): void {
    this.game.setPaused(paused);
  }

  /** «Terminar partida» (o salir): acaba ya con `quit`. */
  quit(): void {
    this.placing = null;
    this.selected = null;
    this.game.quit();
    this.notifyEnd();
  }

  get ended(): boolean {
    return this.game.ended;
  }

  snapshot(): DefenseSnapshot {
    return this.game.snapshot();
  }

  hook(): CastleHook {
    const s = this.game.snapshot();
    return {
      estado: s.status,
      tiempo: Math.ceil(s.timeLeftS - 1e-6),
      activo: Math.round(s.activeS * 10) / 10,
      vida: Math.round(s.castle.life),
      vidaMax: s.castle.maxLife,
      monedas: Math.floor(s.coins),
      enemigos: s.enemies.length,
      derrotados: s.kills,
      islas: s.towers.length,
      colocando: this.placing?.kind ?? '',
      seleccion: this.selected === null ? '' : String(this.selected),
      avionNivel: s.plane.damageLevel,
      avionVelocidad: s.plane.speedLevel,
      castilloNivel: s.castle.level,
      escala: this.clock.scale,
      adelanto: Math.round(s.waveS - s.activeS),
      avion: `${Math.round(s.plane.x)},${Math.round(s.plane.y)}`,
      fin: s.end,
      semilla: this.seed,
      dificultad: s.difficulty,
      duracion: s.runMin,
      calidad: this.quality,
    };
  }

  private notifyEnd(): void {
    if (this.notified || !this.game.ended) return;
    this.notified = true;
    this.placing = null;
    this.selected = null;
    const s = this.game.snapshot();
    this.onEnd?.(s.end!, s);
  }
}
