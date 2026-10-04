import type { ComposedWorld } from './compose';
import type { WorldRegistry } from './registry';

/**
 * Qué mundo se juega. Dos elecciones guardadas con la misma forma:
 * - la del visitante (menú «Mundos», T24), que gana;
 * - el mundo activo que fija el Admin para quien no ha elegido (T26).
 * Por encima de ambas, `?mundo=<id>` en la URL (pruebas y enlaces). Un id
 * desconocido se ignora y se pasa al siguiente; al final, el por defecto
 * del registro.
 *
 * La del visitante vive en el almacenamiento del navegador; en la web, el
 * mundo activo vive en el repositorio local (`repo.content.activeWorldId`,
 * T24) y llega aquí ya leído, con esta misma interfaz.
 */
export interface WorldChoice {
  get(): string | null;
  set(id: string): void;
}

export const WORLD_PARAM = 'mundo';
/** Mundo elegido por el visitante en este navegador. */
export const WORLD_STORAGE_KEY = 'boia:mundo';
/** Mundo activo fijado desde el Admin (sin repositorio; la web usa el repositorio local). */
export const ACTIVE_WORLD_STORAGE_KEY = 'boia:mundo-activo';

/** Lo mínimo de `Storage` que hace falta (las pruebas pasan un mapa). */
export interface ChoiceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Una elección guardada bajo `key`; sin almacenamiento, sólo en memoria. */
export function storedWorldChoice(storage: ChoiceStorage | null, key: string): WorldChoice {
  let memory: string | null = null;
  return {
    get() {
      try {
        return storage?.getItem(key) ?? memory;
      } catch {
        return memory;
      }
    },
    set(id) {
      memory = id;
      try {
        storage?.setItem(key, id);
      } catch {
        // Modo privado o almacenamiento bloqueado: vale para esta visita.
      }
    },
  };
}

export interface WorldSources {
  /** `location.search` de la página (con o sin `?`). */
  search?: string;
  visitor?: WorldChoice | null;
  admin?: WorldChoice | null;
}

/** El mundo a jugar: URL, elección del visitante, mundo activo del Admin o el por defecto. */
export function activeWorld(registry: WorldRegistry, sources: WorldSources = {}): ComposedWorld {
  const fromUrl = sources.search ? new URLSearchParams(sources.search).get(WORLD_PARAM) : null;
  return registry.resolve(fromUrl, sources.visitor?.get(), sources.admin?.get());
}

/**
 * Cambia la elección del visitante si el mundo existe. Devuelve el mundo
 * elegido o `null` si el id no está registrado (no se guarda nada).
 */
export function chooseWorld(
  registry: WorldRegistry,
  choice: WorldChoice,
  id: string,
): ComposedWorld | null {
  if (!registry.isPlayable(id)) return null;
  choice.set(id);
  return registry.get(id);
}
