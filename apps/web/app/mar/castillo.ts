import type { QualityTier } from '@boia/engine/streaming';
import {
  DEFENSE_CONFIG,
  DEFENSE_TOWER_KINDS,
  DefenseClock,
  type DefenseConfig,
  type DefenseEndReason,
  type DefenseEvent,
  type DefenseGame,
  type DefenseInput,
  type DefenseRunMin,
  type DefenseSnapshot,
  type DefenseStatus,
  type DefenseTowerKind,
  type DifficultyId,
  asDefenseRunMin,
  createDefense,
  defenseSiteReason,
} from '@boia/engine/defense';
import { asDifficulty } from '@boia/engine/survivors';
import { CASTLE_GAME_ID } from '@boia/world';
import { CANON_PARAMS, type DevEnv, devEnv, devShortcutsEnabled } from './survivors';

/**
 * «Defensa del Castillo» dentro de `/mar` (plan 014 T160), sin three.js ni
 * React: la partida de `@boia/engine/defense` con su reloj de tiempo real,
 * que el bucle de `Mar3D` da paso a paso con el mando del avión, y el atajo
 * de desarrollo que la empieza (`?minijuego=castillo`). El pop-up, la
 * tarjeta final y las medallas son de T162; el HUD, de T161.
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
  /** `islas=1`: empezar con las siete islas construidas a nivel 3 (vista y rendimiento). */
  islands: 'islas',
} as const;

export interface CastleShortcut {
  t: number;
  seed: number | null;
  difficulty: DifficultyId | null;
  runMin: DefenseRunMin | null;
  islands: boolean;
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
  return {
    t: Number.isFinite(t) && t > 0 ? Math.min(t, duration - 1) : 0,
    seed: Number.isFinite(seed) && seed > 0 ? seed : null,
    difficulty: asDifficulty(q.get(CASTLE_PARAMS.difficulty)),
    runMin,
    islands: q.get(CASTLE_PARAMS.islands) === '1',
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

export interface DefenseRunOptions {
  seed: number;
  quality: QualityTier;
  runMin?: DefenseRunMin;
  difficulty?: DifficultyId;
  /** Atajo `&t=`: empieza en ese segundo (no entra en el ranking). */
  startAtS?: number;
  /** Atajo `islas=1`: las siete islas a nivel 3 desde el principio (no entra en el ranking). */
  devIslands?: boolean;
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
    this.game = createDefense(this.config, opts.seed, {
      ...(opts.runMin ? { runMin: opts.runMin } : {}),
      ...(opts.difficulty ? { difficulty: opts.difficulty } : {}),
      ...(opts.startAtS ? { startAtS: opts.startAtS } : {}),
      ...(dev ? { unranked: true } : {}),
    });
    if (dev) {
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
    const s = this.game.snapshot();
    this.onEnd?.(s.end!, s);
  }
}
