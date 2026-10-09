import type { CarnetMember } from '@boia/store';

/**
 * «Descubrir a un BOIERO» (T66): un Carnet al azar entre los miembros de
 * muestra y los artistas (`repo.carnet.members()`), sin repetir el que se
 * está viendo si hay otro.
 */
export function pickMember(
  members: readonly CarnetMember[],
  random: () => number,
  current: string | null = null,
): CarnetMember | null {
  const pool = members.length > 1 ? members.filter((m) => m.userId !== current) : members;
  return pickFrom(pool, random);
}

/** Uno al azar de `pool`; null si está vacío. */
function pickFrom<T>(pool: readonly T[], random: () => number): T | null {
  if (pool.length === 0) return null;
  const i = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[i]!;
}

export interface DiscoverFilter {
  /** Carnets que nunca salen (el propio, el artista que se está viendo). */
  exclude?: readonly (string | null | undefined)[] | undefined;
  /** Sólo los de esta clase (p. ej. `artist`: «Descubre un artista»). */
  kind?: CarnetMember['kind'] | undefined;
}

/** Los Carnets que pueden salir con `filter` (plan 023 T251). */
export function discoverPool(
  members: readonly CarnetMember[],
  filter: DiscoverFilter = {},
): CarnetMember[] {
  const exclude = new Set(filter.exclude?.filter((id): id is string => !!id));
  return members.filter(
    (m) => !exclude.has(m.userId) && (filter.kind === undefined || m.kind === filter.kind),
  );
}

/**
 * Los botones «Descubre» bajo las respuestas de un Carnet (plan 023 T251): el
 * mismo azar que «Descubrir a un BOIERO», pero lo excluido no sale nunca,
 * aunque no quede nadie más (entonces null: «Aún no hay Carnets que descubrir»).
 */
export function pickDiscover(
  members: readonly CarnetMember[],
  random: () => number,
  filter: DiscoverFilter = {},
): CarnetMember | null {
  return pickFrom(discoverPool(members, filter), random);
}

/** Generador con semilla (mulberry32): la misma semilla da la misma serie. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

declare global {
  interface Window {
    /**
     * Semilla del azar de «Descubrir a un BOIERO»: las pruebas e2e la fijan
     * antes de cargar para saber qué Carnet sale. Sin ella, `Math.random`.
     */
    __boiaDiscoverSeed?: number;
  }
}

let seeded: { seed: number; next: () => number } | null = null;

/** El azar de «Descubrir»: con `window.__boiaDiscoverSeed`, la serie de esa semilla. */
export function discoverRandom(): number {
  const seed = typeof window === 'undefined' ? undefined : window.__boiaDiscoverSeed;
  if (typeof seed !== 'number') return Math.random();
  if (!seeded || seeded.seed !== seed) seeded = { seed, next: seededRandom(seed) };
  return seeded.next();
}
