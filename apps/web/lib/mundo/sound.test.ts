import { DEFAULT_SETTINGS } from '@boia/engine/ui';
import { FEEDBACK_SOUNDS } from '@boia/world';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AMBIENT_LEVEL } from './ambient';
import type * as SoundModule from './sound';

/** Web Audio de mentira: cuenta contextos y lo que cada uno pone a sonar. */
class FakeParam {
  value = 0;
  setValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  type = '';
  buffer: unknown = null;
  loop = false;
  constructor(
    readonly ctx: FakeContext,
    readonly kind: string,
  ) {}
  connect<T>(n: T) {
    return n;
  }
  start() {
    this.ctx.started.push(this);
  }
  stop() {
    this.ctx.stopped.push(this);
  }
}

class FakeContext {
  static created: FakeContext[] = [];
  state: 'suspended' | 'running' = 'suspended';
  currentTime = 0;
  sampleRate = 48000;
  destination = {};
  started: FakeNode[] = [];
  stopped: FakeNode[] = [];
  constructor() {
    FakeContext.created.push(this);
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  createGain() {
    return new FakeNode(this, 'gain');
  }
  createOscillator() {
    return new FakeNode(this, 'oscillator');
  }
  createBiquadFilter() {
    return new FakeNode(this, 'filter');
  }
  createBufferSource() {
    return new FakeNode(this, 'source');
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { length, getChannelData: () => data };
  }
}

/** Un `window`/`document` mínimos para los oyentes del ciclo de vida. */
function fakePage() {
  const target = () => {
    const listeners = new Map<string, Set<() => void>>();
    return {
      listeners,
      addEventListener: (t: string, f: () => void) => {
        if (!listeners.has(t)) listeners.set(t, new Set());
        listeners.get(t)!.add(f);
      },
      removeEventListener: (t: string, f: () => void) => listeners.get(t)?.delete(f),
      fire: (t: string) => [...(listeners.get(t) ?? [])].forEach((f) => f()),
    };
  };
  const win = target();
  const doc = { ...target(), visibilityState: 'visible' as 'visible' | 'hidden' };
  return { win, doc };
}

async function freshSound(): Promise<typeof SoundModule> {
  vi.resetModules();
  return import('./sound');
}

describe('sonido del juego', () => {
  beforeEach(() => {
    FakeContext.created = [];
    vi.stubGlobal('AudioContext', FakeContext);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('antes del primer gesto no hay audio: ni contexto, ni efectos, ni música', async () => {
    const s = await freshSound();
    s.applyAudioSettings(DEFAULT_SETTINGS);
    s.setAmbientWorld('arcilla');
    for (const id of FEEDBACK_SOUNDS) s.playSound(id);
    s.bump(1);
    expect(FakeContext.created).toHaveLength(0);
    expect(s.audioUnlocked()).toBe(false);
  });

  it('el primer gesto desbloquea (búfer mudo para iOS) y arranca el ambiente al 30 %', async () => {
    const s = await freshSound();
    const { win, doc } = fakePage();
    s.applyAudioSettings(DEFAULT_SETTINGS);
    s.setAmbientWorld('arcilla');
    const off = s.installAudioLifecycle(win as unknown as Window, doc as unknown as Document);
    expect(FakeContext.created).toHaveLength(0);
    win.fire('pointerdown');
    expect(s.audioUnlocked()).toBe(true);
    const [ctx] = FakeContext.created;
    expect(FakeContext.created).toHaveLength(1);
    expect(ctx!.state).toBe('running');
    const loop = ctx!.started.find((n) => n.kind === 'source' && n.loop);
    expect(loop).toBeDefined();
    // Los oyentes del gesto se quitan: el siguiente toque no hace nada nuevo.
    win.fire('pointerdown');
    expect(FakeContext.created).toHaveLength(1);
    off();
    expect(AMBIENT_LEVEL).toBe(0.3);
  });

  it('con la música apagada no arranca el ambiente; al encenderla, sí', async () => {
    const s = await freshSound();
    const quiet = { ...DEFAULT_SETTINGS, music: { ...DEFAULT_SETTINGS.music, enabled: false } };
    s.applyAudioSettings(quiet);
    s.setAmbientWorld('arcilla');
    s.unlockAudio();
    const ctx = FakeContext.created[0]!;
    expect(ctx.started.some((n) => n.loop)).toBe(false);
    s.applyAudioSettings(DEFAULT_SETTINGS);
    expect(ctx.started.some((n) => n.loop)).toBe(true);
    s.setAmbientWorld(null);
    expect(ctx.stopped.some((n) => n.loop)).toBe(true);
  });

  it('con la pestaña oculta se pausa y los efectos no se acumulan', async () => {
    const s = await freshSound();
    const { win, doc } = fakePage();
    s.installAudioLifecycle(win as unknown as Window, doc as unknown as Document);
    win.fire('keydown');
    const ctx = FakeContext.created[0]!;
    doc.visibilityState = 'hidden';
    doc.fire('visibilitychange');
    expect(ctx.state).toBe('suspended');
    const before = ctx.started.length;
    s.ping();
    expect(ctx.started.length).toBe(before);
    doc.visibilityState = 'visible';
    doc.fire('visibilitychange');
    expect(ctx.state).toBe('running');
    s.ping();
    expect(ctx.started.length).toBeGreaterThan(before);
  });

  it('cada sonido de serie que declara un comportamiento tiene con qué sonar', async () => {
    const s = await freshSound();
    expect(Object.keys(s.SOUNDS).sort()).toEqual([...FEEDBACK_SOUNDS].sort());
    s.unlockAudio();
    const ctx = FakeContext.created[0]!;
    for (const id of FEEDBACK_SOUNDS) {
      const before = ctx.started.length;
      s.playSound(id);
      expect(ctx.started.length, id).toBeGreaterThan(before);
    }
  });
});
