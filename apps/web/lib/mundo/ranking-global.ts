import type { RankingPage, RankingRow as ServerRow } from '@boia/db/rpc';
import { circuitFromWorld } from '@boia/engine/circuit';
import { CIRCUIT_ID, type WorldConfig } from '@boia/world';
import { accountClient } from '../account/session';
import { circuitName } from './ranking-circuit';

/**
 * Los rankings globales (plan 008, T92, decisión 8) sobre las RPC de T86
 * (`ranking_race`, `ranking_points`; `supabase/migrations/…_rankings.sql`):
 * tiempos por circuito (el mejor de cada cuenta) y puntos de siempre, por
 * páginas de `RANKING_PAGE_SIZE`, con la fila de quien mira aunque quede
 * fuera de la página. La temporada (`ranking_season`) no sale en la interfaz
 * hasta que Hernán defina qué es una temporada.
 *
 * Sólo se usa con Supabase; en modo local el panel sigue con los tiempos de
 * muestra (`ranking-circuit.ts`) y el ranking del navegador (D-20).
 */

/** Filas por página: el top y cada «Mostrar más». */
export const RANKING_PAGE_SIZE = 50;

/**
 * Qué tabla: puntos de siempre, los tiempos de un circuito (su versión) o
 * las puntuaciones del Cañón contra un boss final (plan 013 T155).
 */
export type RankingBoard =
  | { kind: 'points' }
  | { kind: 'circuit'; circuit: string; version: number }
  | { kind: 'canon'; boss: string; version: number };

export function boardKey(b: RankingBoard): string {
  if (b.kind === 'points') return 'points';
  return b.kind === 'circuit' ? `circuit:${b.circuit}:v${b.version}` : `canon:${b.boss}:v${b.version}`;
}

export interface GlobalRow {
  /** Puesto con empates compartidos (1, 2, 2, 4…). */
  position: number;
  userId: string;
  nickname: string;
  memberNumber: number;
  isArtist: boolean;
  /** Puntos, milisegundos en un circuito o la puntuación del Cañón. */
  value: number;
  isMine: boolean;
  /** Avatar neutro del Carnet (la foto no viaja en la lista). */
  avatarKey: string | null;
}

export interface GlobalPage {
  total: number;
  offset: number;
  rows: GlobalRow[];
  /** La fila de quien mira; null sin sesión, sin Carnet o sin tiempo aquí. */
  mine: GlobalRow | null;
}

interface Result<T> {
  data: T | null;
  error: { message?: string; code?: string } | null;
}

/** Lo que se usa del cliente de Supabase (el de la web o uno falso en las pruebas). */
export interface RankingClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<Result<unknown>>;
  from(table: 'carnets'): {
    select(columns: 'user_id, avatar_key'): {
      in(
        column: 'user_id',
        values: string[],
      ): PromiseLike<Result<{ user_id: string; avatar_key: string | null }[]>>;
    };
  };
}

function toRow(r: ServerRow, avatars: ReadonlyMap<string, string | null>): GlobalRow {
  return {
    position: Number(r.position),
    userId: r.user_id,
    nickname: r.nickname,
    memberNumber: Number(r.member_number),
    isArtist: !!r.is_artist,
    value: Number(r.value),
    isMine: !!r.is_mine,
    avatarKey: avatars.get(r.user_id) ?? null,
  };
}

const EMPTY: Omit<GlobalPage, 'offset'> = { total: 0, rows: [], mine: null };

/**
 * Una página de `board` desde `offset`. Un circuito que el servidor no
 * conoce (otra versión del trazado aún sin dar de alta) es una tabla vacía;
 * cualquier otro error se lanza.
 */
export async function fetchRankingPage(
  client: RankingClient,
  board: RankingBoard,
  offset = 0,
  limit = RANKING_PAGE_SIZE,
): Promise<GlobalPage> {
  const res =
    board.kind === 'points'
      ? await client.rpc('ranking_points', { p_limit: limit, p_offset: offset })
      : board.kind === 'circuit'
        ? await client.rpc('ranking_race', {
            p_circuit: board.circuit,
            p_version: board.version,
            p_limit: limit,
            p_offset: offset,
          })
        : await client.rpc('ranking_canon', {
            p_boss: board.boss,
            p_version: board.version,
            p_limit: limit,
            p_offset: offset,
          });
  if (res.error) {
    // Una tabla que el servidor aún no tiene (otro trazado, otro boss o versión): vacía.
    if (res.error.message === 'unknown_circuit' || res.error.message === 'unknown_board') {
      return { ...EMPTY, offset };
    }
    throw new Error(`ranking: ${res.error.message ?? 'error'}`);
  }
  const page = res.data as RankingPage;
  const ids = [...new Set([...page.rows, ...(page.mine ? [page.mine] : [])].map((r) => r.user_id))];
  const avatars = new Map<string, string | null>();
  if (ids.length > 0) {
    // Sin avatares la lista se lee igual (con el neutro de serie).
    const a = await client
      .from('carnets')
      .select('user_id, avatar_key')
      .in('user_id', ids)
      .then(
        (r) => r,
        () => null,
      );
    for (const c of a?.data ?? []) avatars.set(c.user_id, c.avatar_key);
  }
  return {
    total: Number(page.total),
    offset: Number(page.offset),
    rows: page.rows.map((r) => toRow(r, avatars)),
    mine: page.mine ? toRow(page.mine, avatars) : null,
  };
}

/** Lo cargado más la página siguiente, sin repetir a nadie (por si la tabla se movió). */
export function appendPage(rows: readonly GlobalRow[], next: readonly GlobalRow[]): GlobalRow[] {
  const seen = new Set(rows.map((r) => r.userId));
  return [...rows, ...next.filter((r) => !seen.has(r.userId))];
}

/** ¿Queda alguien por listar? Sin filas nuevas tampoco (la tabla encogió). */
export function hasMore(loaded: number, total: number, lastPageSize: number): boolean {
  return loaded < total && lastPageSize > 0;
}

/** La fila propia fijada bajo la lista: sólo si aún no está entre las cargadas. */
export function pinnedMine(rows: readonly GlobalRow[], mine: GlobalRow | null): GlobalRow | null {
  if (!mine) return null;
  return rows.some((r) => r.userId === mine.userId) ? null : mine;
}

export interface CircuitOption {
  /** `circuit:<id>:v<versión>` (`boardKey`). */
  key: string;
  circuit: string;
  version: number;
  /** Nombre del circuito en ese mundo («El Freu»). */
  place: string;
  worldId: string;
  worldName: string;
}

/**
 * Las opciones del selector: un circuito por mundo y, si dos mundos
 * comparten trazado y versión (el mapa es el mismo en todos), una sola
 * opción, con el nombre del mundo que se juega (o el primero que lo tenga).
 * El que se juega va primero.
 */
export function circuitOptions(
  worlds: readonly { id: string; name: string; config: WorldConfig }[],
  currentWorld: string,
  circuitId: string = CIRCUIT_ID,
): CircuitOption[] {
  const ordered = [
    ...worlds.filter((w) => w.id === currentWorld),
    ...worlds.filter((w) => w.id !== currentWorld),
  ];
  const out = new Map<string, CircuitOption>();
  for (const w of ordered) {
    const spec = circuitFromWorld(w.config, circuitId);
    if (!spec) continue;
    const key = boardKey({ kind: 'circuit', circuit: spec.id, version: spec.version });
    if (out.has(key)) continue;
    out.set(key, {
      key,
      circuit: spec.id,
      version: spec.version,
      place: circuitName(w.config, circuitId) ?? spec.id,
      worldId: w.id,
      worldName: w.name,
    });
  }
  return [...out.values()];
}

/** Lo que sale en la tarjeta de meta de un miembro: su puesto y de cuántos. */
export interface RaceStanding {
  position: number;
  total: number;
  /** Su mejor tiempo en el servidor (ms). */
  bestMs: number;
}

/** El puesto de quien mira en un circuito; null si no tiene tiempo allí. */
export async function raceStanding(
  client: RankingClient,
  circuit: string,
  version: number,
): Promise<RaceStanding | null> {
  const page = await fetchRankingPage(client, { kind: 'circuit', circuit, version }, 0, 1);
  return page.mine
    ? { position: page.mine.position, total: page.total, bestMs: page.mine.value }
    : null;
}

/** El más rápido de un circuito (para la tarjeta de la salida), o null. */
export async function raceLeader(
  client: RankingClient,
  circuit: string,
  version: number,
): Promise<{ name: string; ms: number } | null> {
  const page = await fetchRankingPage(client, { kind: 'circuit', circuit, version }, 0, 1);
  const first = page.rows[0];
  return first ? { name: first.nickname, ms: first.value } : null;
}

/** El cliente de la web con la sesión de quien mira (anon sin ella); null en modo local. */
export async function rankingClient(): Promise<RankingClient | null> {
  const sb = await accountClient();
  return sb as unknown as RankingClient | null;
}

/**
 * El puesto de un miembro al acabar una carrera (T92): espera a que su
 * tiempo llegue a la cuenta (`flush`, la cola del repositorio) y lee su
 * puesto en el circuito. `unavailable` si no se pudo (sin red, o el servidor
 * no aceptó el tiempo y no tiene ninguno).
 */
export async function memberFinishStanding(
  circuit: string,
  version: number,
  flush: () => Promise<void>,
  client: () => Promise<RankingClient | null> = rankingClient,
): Promise<{ kind: 'global'; position: number; total: number } | { kind: 'unavailable' }> {
  try {
    await flush();
    const c = await client();
    const s = c ? await raceStanding(c, circuit, version) : null;
    return s ? { kind: 'global', position: s.position, total: s.total } : { kind: 'unavailable' };
  } catch (err) {
    console.warn('[boia] no se pudo leer el puesto de la carrera', err);
    return { kind: 'unavailable' };
  }
}

/** El más rápido del circuito para la tarjeta de la salida; null si nadie o sin red. */
export async function globalRaceLeader(
  circuit: string,
  version: number,
): Promise<{ name: string; ms: number } | null> {
  try {
    const client = await rankingClient();
    return client ? await raceLeader(client, circuit, version) : null;
  } catch {
    return null;
  }
}
