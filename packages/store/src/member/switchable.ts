/**
 * Un repositorio que cambia de dueño sin recargar (plan 008, T90): el del
 * invitado (local) o el de un miembro (su cuenta). Quien lo usa guarda una
 * sola referencia (`gameRepository()`), y al entrar o salir de la cuenta
 * todo vuelve a leer: se avisa de un cambio en todas las áreas.
 *
 * El contenido y el Admin de la demo son siempre los del repositorio base
 * (el del navegador): no dependen de quién juega.
 *
 * `hold(p)` hace que las llamadas esperen a `p` (p. ej. a saber si hay
 * sesión) antes de elegir a quién van: lo de un miembro nunca se apunta al
 * invitado por llegar antes de tiempo.
 */
import type { BoiaRepository, BottleApi, ChangeArea, RepositoryChange } from '../repository';
import type { GlobalBottles } from './bottles';

export interface SwitchableRepository {
  /** La referencia estable que usa la app. */
  readonly repo: BoiaRepository;
  /** A quién van ahora las llamadas. */
  current(): BoiaRepository;
  readonly base: BoiaRepository;
  /** Cambia de repositorio y avisa de un cambio en todas las áreas. */
  switchTo(next: BoiaRepository): void;
  /** Las llamadas esperan a `until` (sin bloquear el contenido ni el Admin). */
  hold(until: Promise<unknown>): void;
  /**
   * Las botellas de todos (T93, con Supabase): las mismas para el invitado y
   * el miembro, en vez de las del repositorio de cada uno. null: las de cada uno.
   */
  useBottles(source: GlobalBottles | null): void;
}

const ALL: ChangeArea[] = [
  'identity',
  'carnet',
  'progress',
  'purchases',
  'bottles',
  'content',
  'audit',
  'storage',
];
/** Lo del repositorio base que importa aunque juegue un miembro. */
const BASE_AREAS = new Set<ChangeArea>(['content', 'audit']);

type ApiName = 'identity' | 'carnet' | 'progress' | 'purchases' | 'bottles';

export function createSwitchableRepository(base: BoiaRepository): SwitchableRepository {
  let current = base;
  let rev = 0;
  let gate: Promise<unknown> = Promise.resolve();
  const listeners = new Set<(c: RepositoryChange) => void>();

  const emit = (areas: ChangeArea[], external: boolean) => {
    rev++;
    const change: RepositoryChange = { areas, revision: rev, external };
    for (const l of [...listeners]) {
      try {
        l(change);
      } catch {
        // un oyente roto no rompe a los demás
      }
    }
  };

  // Del base: todo mientras juega el invitado; si juega un miembro, sólo contenido y auditoría.
  base.subscribe((c) => {
    if (current === base) emit(c.areas, c.external);
    else {
      const areas = c.areas.filter((a) => BASE_AREAS.has(a));
      if (areas.length > 0) emit(areas, c.external);
    }
  });
  let offCurrent: (() => void) | null = null;
  let shared: GlobalBottles | null = null;
  let offShared: (() => void) | null = null;

  const routed = <K extends ApiName>(name: K): BoiaRepository[K] => {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(base[name])) {
      out[key] = async (...args: unknown[]) => {
        await gate;
        const api = current[name] as unknown as Record<string, (...a: unknown[]) => unknown>;
        return api[key]!(...args);
      };
    }
    return out as unknown as BoiaRepository[K];
  };

  /** Las botellas: las de todos si las hay; si no, las del repositorio de quien juega. */
  function bottlesApi(): BottleApi {
    const own = routed('bottles') as unknown as Record<string, (...a: unknown[]) => unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(own)) {
      out[key] = async (...args: unknown[]) => {
        await gate;
        if (!shared) return own[key]!(...args);
        const api = shared.api as unknown as Record<string, (...a: unknown[]) => unknown>;
        return api[key]!(...args);
      };
    }
    return out as unknown as BottleApi;
  }

  const repo: BoiaRepository = {
    status: () => current.status(),
    revision: () => rev,
    subscribe: (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    identity: routed('identity'),
    carnet: routed('carnet'),
    progress: routed('progress'),
    purchases: routed('purchases'),
    bottles: bottlesApi(),
    content: base.content,
    admin: base.admin,
  };

  return {
    repo,
    base,
    current: () => current,
    switchTo(next) {
      if (next === current) return;
      offCurrent?.();
      offCurrent = null;
      current = next;
      if (next !== base) offCurrent = next.subscribe((c) => emit(c.areas, c.external));
      // Lo mío y lo leído dependen de la sesión: las botellas se vuelven a leer.
      shared?.invalidate();
      emit(ALL, false);
    },
    useBottles(source) {
      offShared?.();
      offShared = null;
      shared = source;
      if (source) offShared = source.subscribe(() => emit(['bottles'], false));
      emit(['bottles'], false);
    },
    hold(until) {
      gate = until.then(
        () => undefined,
        () => undefined,
      );
    },
  };
}
