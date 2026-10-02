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
  if (pool.length === 0) return null;
  const i = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[i]!;
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
