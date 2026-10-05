import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_READOUTS,
  READOUT_STORAGE_KEY,
  createReadoutPreferences,
  readReadoutPreferences,
} from './canon-readout-preferences';

describe('browser combat readout preferences', () => {
  it('both options default off', () => {
    expect(readReadoutPreferences(() => null)).toEqual(DEFAULT_READOUTS);
    expect(readReadoutPreferences(() => ({ getItem: () => null, setItem: vi.fn() }))).toEqual(
      DEFAULT_READOUTS,
    );
  });

  it.each(['{', 'null', '[]', '123', '{"health":"true","damage":1}'])(
    'ignores invalid data: %s',
    (raw) => {
      expect(readReadoutPreferences(() => ({ getItem: () => raw, setItem: vi.fn() }))).toEqual(
        DEFAULT_READOUTS,
      );
    },
  );

  it('persists each independent toggle across a new browser store', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const prefs = createReadoutPreferences(() => storage);
    const listener = vi.fn();
    const unsubscribe = prefs.subscribe(listener);
    prefs.toggle('health');
    expect(createReadoutPreferences(() => storage).get()).toEqual({ health: true, damage: false });
    prefs.toggle('damage');
    expect(JSON.parse(values.get(READOUT_STORAGE_KEY)!)).toEqual({ health: true, damage: true });
    prefs.toggle('health');
    expect(createReadoutPreferences(() => storage).get()).toEqual({ health: false, damage: true });
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    prefs.toggle('damage');
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it.each(['absent', 'access', 'read', 'write'])('works without storage (%s)', (failure) => {
    const storage = () => {
      if (failure === 'access') throw new Error('security');
      if (failure === 'absent') return null;
      return {
        getItem: () => {
          if (failure === 'read') throw new Error('security');
          return null;
        },
        setItem: () => {
          if (failure === 'write') throw new Error('quota');
        },
      };
    };
    const prefs = createReadoutPreferences(storage);
    prefs.toggle('damage');
    prefs.toggle('health');
    expect(prefs.get()).toEqual({ health: true, damage: true });
    prefs.toggle('damage');
    expect(prefs.get()).toEqual({ health: true, damage: false });
  });
});
