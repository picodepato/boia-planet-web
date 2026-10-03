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
import type { BoiaRepository, ChangeArea, RepositoryChange } from '../repository';

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
    bottles: routed('bottles'),
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
      emit(ALL, false);
    },
    hold(until) {
      gate = until.then(
        () => undefined,
        () => undefined,
      );
    },
  };
}
