import { bottlePositionValidator, settleInSea } from '@boia/engine/bottles';
import {
  type BoiaRepository,
  type LocalRepositoryOptions,
  SAMPLE_BOTTLES,
  type SwitchableRepository,
  browserRepository,
  createSwitchableRepository,
} from '@boia/store';
import { BOTTLE_SPOTS, type WorldConfig } from '@boia/world';
import { worlds } from './mundo/demo-world';
import { isSupabaseConfigured } from './supabase/config';

/**
 * El repositorio de la demo (T16, D-20): todo en este navegador. Lo usan
 * el 2D, /carnet y la compra de prueba de la landing (T25). Las botellas se
 * validan contra el mar del mapa compartido (el mismo en todos los mundos) y
 * las de muestra, cuyas coordenadas son del mapa de Arcilla, se dejan en el
 * mar del mapa que se juega hoy.
 *
 * `browserRepository` se queda con las opciones de la primera llamada, y la
 * landing y el 2D comparten pestaña (EXPLORAR navega sin recargar): en la
 * web, toda llamada tiene que pasar por aquí.
 *
 * Con cuentas (plan 008, T90): `gameRepository()` es una referencia estable
 * que va al invitado de este navegador o, con sesión y Carnet, al
 * repositorio de la cuenta (`repo-member.ts`, que se carga sólo con
 * Supabase). Entrar o salir cambia de uno a otro sin recargar. Sin las
 * variables de Supabase es el repositorio local de siempre.
 */

/** El mar donde flotan las botellas: el del mapa compartido. */
export function seaWorld(): WorldConfig {
  return worlds.get(worlds.defaultId).config;
}

let sampleBottles: typeof SAMPLE_BOTTLES | null = null;

/**
 * Las botellas de muestra, en los sitios de botella del mapa (T20,
 * `BOTTLE_SPOTS`: la bocana del puerto y las de mapa.json), por orden; las
 * que sobren o no caigan en el mar se recolocan como en T22.
 */
function placeSampleBottles(): typeof SAMPLE_BOTTLES {
  const placed = SAMPLE_BOTTLES.map((b, i) => {
    const spot = BOTTLE_SPOTS[i];
    return spot ? { ...b, x: spot.x, y: spot.y } : b;
  });
  return settleInSea(seaWorld(), placed);
}

/** Opciones de todo repositorio local de la web (el invitado y la copia de una cuenta). */
export function repoOptions(): Pick<LocalRepositoryOptions, 'validate' | 'sample'> {
  sampleBottles ??= placeSampleBottles();
  return {
    validate: { bottlePosition: bottlePositionValidator(seaWorld) },
    sample: { bottles: sampleBottles },
  };
}

/** El invitado de este navegador (el repositorio local de siempre, D-20). */
export function guestRepository(): BoiaRepository {
  return browserRepository(repoOptions());
}

let switcher: SwitchableRepository | null = null;

export function gameRepository(): BoiaRepository {
  if (typeof window === 'undefined' || !isSupabaseConfigured()) return guestRepository();
  if (!switcher) {
    const sw = createSwitchableRepository(guestRepository());
    switcher = sw;
    // Hasta saber si hay sesión, lo de un jugador espera (el contenido no).
    sw.hold(import('./repo-member').then((m) => m.startMemberSync(sw)));
  }
  return switcher.repo;
}
