/**
 * «Cerrar sesión» deja este dispositivo como en la primera visita (plan 029
 * T284, decisión de Álvaro del 2026-10-14). Sólo con cuentas: en modo local
 * (D-20) no hay sesión y nada de esto corre.
 *
 * El orden: lo pendiente se manda a la cuenta (`onBeforeSignOut`, dentro de
 * `signOut`), se cierra la sesión (la partida vuelve al invitado y la copia
 * de la cuenta ya reconocida se borra, `repo-member.ts`) y después se borra
 * de este navegador todo lo del juego y de la cuenta: el documento del
 * invitado (Carnet, puntos, monedas, barcos, logros, sellos, botellas,
 * misiones…), las copias de cuentas, los récords del Cañón, el castillo, los
 * minijuegos y las carreras, el barco elegido y su posición, el mundo, las
 * invitaciones y el horóscopo del día.
 *
 * Se queda sólo lo que es del dispositivo (`DEVICE_PREFERENCE_KEYS`): volumen
 * y música, idioma, teclado y sensibilidad (`boia.ajustes`), la radio, el
 * momento del día, cómo se ven el Cañón y el castillo, dónde va el minimapa
 * y el aviso de instalar la app. La sesión de Supabase la gestiona su cliente
 * (`boia.supabase.auth…`) y no se toca. No se borra nada del servidor.
 *
 * Una copia de cuenta con cambios aún sin mandar (sin red al salir) se queda:
 * nadie la ve (es de su cuenta y sólo se lee con su sesión) y se manda cuando
 * esa cuenta vuelva a entrar; así «tu progreso queda guardado» es verdad.
 *
 * Este módulo viaja con el «Cerrar sesión» de la landing (un trozo aparte):
 * no importa nada pesado (ni three ni el catálogo entero de textos).
 */
import {
  type BoiaRepository,
  type ChangeArea,
  STORE_KEY,
  type StorageLike,
  emptyDoc,
  localDocAccess,
} from '@boia/store';
import { unsentMemberCopies } from '../member-cache';
import { signOut } from './session';

/** Un `Storage` que se puede recorrer (`localStorage`, `sessionStorage`). */
export interface DeviceStorage extends StorageLike {
  readonly length: number;
  key(index: number): string | null;
}

/**
 * Lo único que sobrevive a «Cerrar sesión»: preferencias del dispositivo.
 * La prueba (`reset-device.test.ts`) las compara con las claves de verdad.
 */
export const DEVICE_PREFERENCE_KEYS: readonly string[] = [
  // Idioma, música y efectos (volumen), teclado y sensibilidad (SETTINGS_KEY).
  'boia.ajustes',
  // La radio: volumen, repetir, aleatorio (RADIO_SESSION_KEY, sessionStorage).
  'boia.radio',
  // El momento del día de /mar: día, tarde o noche (MOOD_STORAGE_KEY).
  'boia:mar3d:momento',
  // Sonido del Cañón (canon-sound-preferences.ts).
  'boia.canon.sonido.v1',
  // Barras de vida y números de daño del Cañón y del castillo.
  'boia.canon.readouts.v1',
  'boia:castillo:marcas',
  // Dónde va el minimapa (MINIMAP_ZONE_KEY).
  'boia.minimapa.zona',
  // «Instalar la app» ya descartado (PWA_DISMISS_KEY).
  'boia.pwa.aviso',
];

/** La sesión de Supabase (`SUPABASE_AUTH_STORAGE_KEY` y sus variantes): la lleva su cliente. */
const SESSION_PREFIX = 'boia.supabase.auth';

/** Lo que es del juego o de la cuenta: todo lo de BOIA que no es una preferencia. */
const OURS = /^boia[.:_-]/;

/**
 * El documento del invitado no se borra a mano: lo vacía `resetGuestDoc`
 * por su repositorio (que guarda el contenido del Admin de la demo).
 */
const VIA_REPOSITORY = new Set([STORE_KEY]);

/** La copia de una cuenta (`boia.cuenta.<id>`) y su cola (`….sync`). */
const MEMBER_COPY = /^boia\.cuenta\.(.+?)(\.sync)?$/;

export function isDevicePreferenceKey(key: string): boolean {
  return DEVICE_PREFERENCE_KEYS.includes(key) || key.startsWith(SESSION_PREFIX);
}

/** La cola de una copia aún tiene operaciones sin mandar. */
function queueHasOps(storage: StorageLike, copyKey: string): boolean {
  try {
    const raw = storage.getItem(`${copyKey}.sync`);
    const meta: unknown = raw ? JSON.parse(raw) : null;
    const ops = (meta as { ops?: unknown } | null)?.ops;
    return Array.isArray(ops) && ops.length > 0;
  } catch {
    return false;
  }
}

/** Qué claves de BOIA se borran de `storage` (las que no son preferencias). */
export function keysToWipe(
  storage: DeviceStorage,
  unsent: ReadonlySet<string> = new Set(),
): string[] {
  const out: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key || !OURS.test(key) || isDevicePreferenceKey(key) || VIA_REPOSITORY.has(key))
      continue;
    const copy = MEMBER_COPY.exec(key);
    if (copy) {
      const copyKey = `boia.cuenta.${copy[1]}`;
      if (unsent.has(copyKey) || queueHasOps(storage, copyKey)) continue;
    }
    out.push(key);
  }
  return out;
}

/** Borra de `storage` todo lo del juego y de la cuenta; devuelve lo borrado. */
export function wipeDeviceStorage(
  storage: DeviceStorage,
  unsent: ReadonlySet<string> = new Set(),
): string[] {
  const keys = keysToWipe(storage, unsent);
  for (const key of keys) {
    try {
      storage.removeItem(key);
    } catch {
      // Almacenamiento bloqueado: no hay nada que borrar.
    }
  }
  return keys;
}

const GUEST_AREAS: ChangeArea[] = ['identity', 'carnet', 'progress', 'purchases', 'bottles'];

/**
 * El documento del invitado vuelve a estar vacío (sin identidad, Carnet,
 * libro de puntos y monedas, compras, botellas ni reportes). Se queda el
 * contenido del Admin de la demo (y su auditoría), que no es de nadie.
 * Se escribe por el repositorio, no borrando la clave: así la pestaña (y
 * las demás, que lo vigilan) lo ven ya.
 */
export function resetGuestDoc(guest: BoiaRepository): void {
  const access = localDocAccess(guest);
  if (!access) return;
  access.write(GUEST_AREAS, (d) => {
    const fresh = emptyDoc(d.schemaVersion);
    fresh.content = d.content;
    fresh.audit = d.audit;
    Object.assign(d, fresh);
  });
}

function browserStorages(): DeviceStorage[] {
  const out: DeviceStorage[] = [];
  for (const pick of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const s = pick();
      if (s) out.push(s);
    } catch {
      // Modo privado o almacenamiento bloqueado.
    }
  }
  return out;
}

/**
 * Este dispositivo empieza de cero: el invitado vacío y fuera todo lo del
 * juego y de la cuenta, menos las preferencias. Llamar con la sesión ya
 * cerrada (lo hace `signOutAndReset`).
 */
export async function resetDevice(
  target: { guest?: BoiaRepository; storages?: DeviceStorage[] } = {},
): Promise<void> {
  const guest = target.guest ?? (await import('../repo')).guestRepository();
  resetGuestDoc(guest);
  const unsent = unsentMemberCopies();
  for (const storage of target.storages ?? browserStorages()) wipeDeviceStorage(storage, unsent);
}

/**
 * El único «Cerrar sesión» (landing, Mi Carnet, los menús): manda lo
 * pendiente, cierra la sesión y deja el dispositivo como en la primera visita.
 */
export async function signOutAndReset(): Promise<void> {
  await signOut();
  await resetDevice();
}
