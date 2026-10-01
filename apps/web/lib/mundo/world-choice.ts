import {
  type ComposedWorld,
  WORLD_PARAM,
  WORLD_STORAGE_KEY,
  type WorldChoice,
  activeWorld,
  storedWorldChoice,
} from '@boia/world';
import { createAdminActions } from '../admin/actions';
import { gameRepository } from '../repo';
import { worlds } from './demo-world';

/**
 * Qué mundo se juega en el 2D (T17, T24): `?mundo=<id>`, si no el elegido
 * en este navegador (menú «Mundos»), si no el activo que fije el Admin
 * (T26), si no el por defecto. La elección del visitante vive en
 * `localStorage` (`boia:mundo`); el mundo activo, en el repositorio local
 * (`repo.content.activeWorldId`, que el Admin cambia con `setActiveWorld`),
 * que es lo que Supabase sustituirá.
 */

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Mundo elegido por el visitante. */
export function visitorWorldChoice(): WorldChoice {
  return storedWorldChoice(storage(), WORLD_STORAGE_KEY);
}

/** El mundo activo que fijó el Admin; null si no fijó ninguno o no se puede leer. */
export async function adminWorldId(): Promise<string | null> {
  try {
    return await gameRepository().content.activeWorldId();
  } catch (err) {
    console.warn('[boia] no se pudo leer el mundo activo', err);
    return null;
  }
}

/**
 * Fija el mundo activo para quien no ha elegido; null vuelve al por defecto
 * del registro. Es la acción del Admin (T26, `createAdminActions`): rechaza
 * un id que no está registrado y queda en la auditoría del repositorio local.
 */
export async function setActiveWorld(id: string | null): Promise<void> {
  await createAdminActions({ repo: gameRepository(), registry: worlds }).setActiveWorld(id);
}

/** La elección del Admin ya leída (`adminWorldId`), con la forma de `WorldChoice`. */
export function adminWorldChoice(id: string | null): WorldChoice {
  return {
    get: () => id,
    set: (next) => void setActiveWorld(next),
  };
}

/** El mundo de esta carga; `adminId` es el mundo activo del Admin ya leído. */
export function currentWorld(search: string, adminId: string | null = null): ComposedWorld {
  return activeWorld(worlds, {
    search,
    visitor: visitorWorldChoice(),
    admin: adminWorldChoice(adminId),
  });
}

/** Si la URL trae `?mundo=`, lo pone al día sin recargar (si no, al recargar ganaría). */
export function syncWorldParam(id: string): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(WORLD_PARAM) || url.searchParams.get(WORLD_PARAM) === id) return;
  url.searchParams.set(WORLD_PARAM, id);
  window.history.replaceState(window.history.state, '', url.href);
}
