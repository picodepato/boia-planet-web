/**
 * Volumen y silencio del Cañón (T152): el control de la pausa, recordado por
 * navegador (como las lecturas de combate, `canon-readout-preferences.ts`).
 * Es pequeño y se carga con el HUD; el sintetizador (`canon-audio.ts`) se
 * carga aparte, al empezar la primera partida, y se suscribe a esto.
 */

export interface SoundPreferences {
  /** 0…1. */
  readonly volume: number;
  readonly muted: boolean;
}

export const SOUND_STORAGE_KEY = 'boia.canon.sonido.v1';
export const DEFAULT_SOUND: SoundPreferences = { volume: 0.7, muted: false };
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'> | null;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** El getter del almacenamiento también puede fallar (navegación privada, permisos). */
export function readSoundPreferences(storage: StorageAccess): SoundPreferences {
  try {
    const raw = storage()?.getItem(SOUND_STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== 'object') return DEFAULT_SOUND;
    const p = value as Partial<Record<keyof SoundPreferences, unknown>>;
    return {
      volume:
        typeof p.volume === 'number' && Number.isFinite(p.volume)
          ? clamp01(p.volume)
          : DEFAULT_SOUND.volume,
      muted: p.muted === true,
    };
  } catch {
    return DEFAULT_SOUND;
  }
}

export function writeSoundPreferences(prefs: SoundPreferences, storage: StorageAccess): void {
  try {
    storage()?.setItem(SOUND_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Sin almacenamiento la elección sigue valiendo en esta visita.
  }
}

/** Lo que de verdad suena: 0 en silencio. */
export function soundLevel(p: SoundPreferences): number {
  return p.muted ? 0 : p.volume;
}

export type SoundPreferencesStore = ReturnType<typeof createSoundPreferences>;

export function createSoundPreferences(storage: StorageAccess) {
  let value = readSoundPreferences(storage);
  const listeners = new Set<() => void>();
  const set = (next: SoundPreferences) => {
    value = next;
    writeSoundPreferences(value, storage);
    for (const listener of [...listeners]) listener();
  };
  return {
    get: () => value,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setVolume(volume: number) {
      if (!Number.isFinite(volume)) return;
      // Subir el volumen con el silencio puesto lo quita: se espera oír algo.
      set({ volume: clamp01(volume), muted: volume > 0 ? false : value.muted });
    },
    toggleMuted() {
      set({ ...value, muted: !value.muted });
    },
  };
}

const browserStorage: StorageAccess = () => window.localStorage;

let browserPreferences: SoundPreferencesStore | undefined;
export function soundPreferences(): SoundPreferencesStore {
  if (typeof window === 'undefined') return createSoundPreferences(() => null);
  return (browserPreferences ??= createSoundPreferences(browserStorage));
}
