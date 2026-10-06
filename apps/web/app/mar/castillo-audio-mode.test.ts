import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@boia/engine/ui';
import { DefenseRun } from './castillo';
import { useCastleAudio } from './castillo-audio-mode';

// El hook se ejecuta sin DOM; dejamos intacta su carga asíncrona y sus callbacks.
const harness = vi.hoisted(() => ({
  cleanups: [] as (() => void)[],
  create: vi.fn(),
  setSound: vi.fn(),
}));
vi.mock('react', () => ({
  useRef: <T>(current: T) => ({ current }),
  useState: <T>(initial: T) => [initial, harness.setSound],
  useCallback: <T>(fn: T) => fn,
  useMemo: <T>(fn: () => T) => fn(),
  useEffect: (fn: () => () => void) => {
    harness.cleanups.push(fn());
  },
}));
vi.mock('./castillo-audio', () => ({ createPageCastleAudio: harness.create }));

function setup() {
  const audio = {
    loop: {
      setGlobal: vi.fn(),
      setPaused: vi.fn(),
      subscribe: vi.fn(),
      state: () => ({ unlocked: false, music: 'sea', hidden: false }),
    },
    start: vi.fn(),
    events: vi.fn(),
    sync: vi.fn(),
    end: vi.fn(),
    dispose: vi.fn(),
  };
  harness.create.mockReturnValue(audio);
  const runRef = { current: new DefenseRun({ seed: 7, quality: 'baja' }) as DefenseRun | null };
  const sea = vi.fn();
  // eslint-disable-next-line react-hooks/rules-of-hooks -- El harness sustituye los hooks de React.
  const hook = useCastleAudio(runRef, sea);
  return { audio, runRef, sea, hook, cleanup: () => harness.cleanups.at(-1)!() };
}

beforeEach(() => {
  vi.clearAllMocks();
  harness.cleanups.length = 0;
  vi.stubGlobal('window', { localStorage: { getItem: () => null } });
});

describe('carga y ciclo del audio del castillo', () => {
  it('ignora la importación que termina después de desmontar', async () => {
    const { hook, cleanup } = setup();
    hook.prepare();
    cleanup();
    await vi.dynamicImportSettled();
    expect(harness.create).not.toHaveBeenCalled();
    expect(harness.setSound).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('carga una vez, sincroniza la partida y la pausa actuales y libera el audio', async () => {
    const { hook, audio, runRef, sea, cleanup } = setup();
    hook.start();
    hook.prepare();
    hook.setPaused(true);
    hook.setAudioSettings(DEFAULT_SETTINGS);
    await vi.dynamicImportSettled();
    expect(sea).toHaveBeenCalledWith(false);
    expect(harness.create).toHaveBeenCalledTimes(1);
    expect(audio.start).toHaveBeenCalledWith(runRef.current!.snapshot(), runRef.current!.config);
    expect(audio.loop.setPaused).toHaveBeenCalledWith(true);
    expect(audio.loop.setGlobal).toHaveBeenCalledWith({ music: 0.6, sfx: 0.8 });
    hook.setAudioSettings({ ...DEFAULT_SETTINGS, sfx: { enabled: false, volume: 0.8 } });
    expect(audio.loop.setGlobal).toHaveBeenLastCalledWith({ music: 0.6, sfx: 0 });
    const events = [{ type: 'planeUpgrade' as const, level: 2, cost: 100 }];
    hook.events(events);
    expect(audio.events).toHaveBeenCalledWith(events);
    expect(audio.sync).toHaveBeenCalledWith(runRef.current!.snapshot());
    hook.end('held');
    expect(audio.end).toHaveBeenCalledWith('held');
    // La tarjeta final mantiene el contexto para que suenen el final y el fundido.
    expect(audio.dispose).not.toHaveBeenCalled();
    cleanup();
    expect(audio.dispose).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('no arranca el bucle si la partida termina o sale mientras se carga', async () => {
    const { hook, audio, runRef, sea, cleanup } = setup();
    hook.start();
    runRef.current!.quit();
    hook.end('quit');
    runRef.current = null;
    await vi.dynamicImportSettled();
    expect(audio.start).not.toHaveBeenCalled();
    expect(sea.mock.calls.map(([on]) => on)).toEqual([false, true]);
    cleanup();
    vi.unstubAllGlobals();
  });
});
