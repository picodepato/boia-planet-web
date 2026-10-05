export interface ReadoutPreferences {
  readonly health: boolean;
  readonly damage: boolean;
}

export const READOUT_STORAGE_KEY = 'boia.canon.readouts.v1';
export const DEFAULT_READOUTS: ReadoutPreferences = { health: false, damage: false };
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'> | null;

/** The getter itself can throw (private browsing/security settings). */
export function readReadoutPreferences(storage: StorageAccess): ReadoutPreferences {
  try {
    const raw = storage()?.getItem(READOUT_STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== 'object') return DEFAULT_READOUTS;
    const prefs = value as Partial<ReadoutPreferences>;
    return { health: prefs.health === true, damage: prefs.damage === true };
  } catch {
    return DEFAULT_READOUTS;
  }
}

export function writeReadoutPreferences(prefs: ReadoutPreferences, storage: StorageAccess): void {
  try {
    storage()?.setItem(READOUT_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // The in-memory choice still works when persistence is unavailable.
  }
}

const browserStorage: StorageAccess = () => window.localStorage;

/** Browser-local display settings, independent of the local/Supabase repository. */
export function createReadoutPreferences(storage: StorageAccess) {
  let value = readReadoutPreferences(storage);
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    toggle(key: keyof ReadoutPreferences) {
      value = { ...value, [key]: !value[key] };
      writeReadoutPreferences(value, storage);
      for (const listener of listeners) listener();
    },
  };
}

let browserPreferences: ReturnType<typeof createReadoutPreferences> | undefined;
export function readoutPreferences() {
  // Do not cache an SSR default as the browser's persisted settings.
  if (typeof window === 'undefined') return createReadoutPreferences(() => null);
  return (browserPreferences ??= createReadoutPreferences(browserStorage));
}
