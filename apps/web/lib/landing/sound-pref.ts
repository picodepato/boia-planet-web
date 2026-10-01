/**
 * Sonido desde la cabecera de la landing (T44, REQ-ENT-029). La landing no
 * suena (O10): el interruptor cambia los ajustes que usan el 2D y /mar
 * (música y efectos, `boia.ajustes`, los de `@boia/engine/ui`). Se leen y
 * escriben aquí a mano para no cargar el HUD del juego en la landing; el
 * juego los vuelve a validar al leerlos (`parseSettings`).
 */

/** = `SETTINGS_KEY` de `@boia/engine/ui` (lo comprueba sound-pref.test.ts). */
export const SOUND_SETTINGS_KEY = 'boia.ajustes';

type Raw = Record<string, unknown>;

function parse(text: string | null): Raw {
  if (!text) return {};
  try {
    const v: unknown = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {};
  } catch {
    return {};
  }
}

const enabled = (channel: unknown): boolean => {
  if (!channel || typeof channel !== 'object') return true; // por defecto, activado
  const e = (channel as Raw).enabled;
  return typeof e === 'boolean' ? e : true;
};

/** ¿Suena algo? Música o efectos activados (por defecto, sí). */
export function soundOn(text: string | null): boolean {
  const s = parse(text);
  return enabled(s.music) || enabled(s.sfx);
}

/** Los mismos ajustes con música y efectos encendidos o apagados a la vez. */
export function withSound(text: string | null, on: boolean): string {
  const s = parse(text);
  const channel = (c: unknown): Raw => ({
    ...(c && typeof c === 'object' && !Array.isArray(c) ? (c as Raw) : {}),
    enabled: on,
  });
  return JSON.stringify({ ...s, music: channel(s.music), sfx: channel(s.sfx) });
}

// Estado compartido por los dos interruptores de la cabecera (fila y menú móvil).
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SOUND_SETTINGS_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function readSound(): boolean {
  return soundOn(storage()?.getItem(SOUND_SETTINGS_KEY) ?? null);
}

export function toggleSound(): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(
      SOUND_SETTINGS_KEY,
      withSound(store.getItem(SOUND_SETTINGS_KEY), !soundOn(store.getItem(SOUND_SETTINGS_KEY))),
    );
  } catch {
    return;
  }
  for (const l of [...listeners]) l();
}
