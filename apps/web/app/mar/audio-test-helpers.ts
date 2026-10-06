import { CanonAudio } from './canon-audio';
import { createSoundPreferences } from './canon-sound-preferences';

/** Un AudioContext de mentira: cuenta lo que se crea y a qué se conecta. */
class FakeParam {
  value = 1;
  readonly calls: { kind: string; value: number; time: number }[] = [];
  private log(kind: string, value: number, time: number) {
    this.calls.push({ kind, value, time });
    return this;
  }
  setValueAtTime(v: number, t: number) {
    this.value = v;
    return this.log('set', v, t);
  }
  linearRampToValueAtTime(v: number, t: number) {
    return this.log('linear', v, t);
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    return this.log('exp', v, t);
  }
  setTargetAtTime(v: number, t: number) {
    this.value = v;
    return this.log('target', v, t);
  }
  cancelScheduledValues(t: number) {
    return this.log('cancel', 0, t);
  }
  /** El último valor al que se lleva el parámetro. */
  get target(): number {
    return this.calls.at(-1)?.value ?? this.value;
  }
}

class FakeNode {
  inputs = 0;
  readonly out: FakeNode[] = [];
  constructor(
    readonly ctx: FakeContext,
    readonly kind: string,
  ) {}
  connect<T extends FakeNode>(n: T): T {
    this.out.push(n);
    n.inputs++;
    return n;
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeSource extends FakeNode {
  frequency = new FakeParam();
  Q = new FakeParam();
  type = '';
  buffer: unknown = null;
  starts: number[] = [];
  start(t = 0) {
    this.starts.push(t);
    this.ctx.started.push({ node: this, t });
  }
  stop() {}
}

export class FakeContext {
  currentTime = 0;
  sampleRate = 8000;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  readonly destination = new FakeNode(this, 'destination');
  readonly gains: FakeGain[] = [];
  readonly started: { node: FakeSource; t: number }[] = [];
  createGain() {
    const g = new FakeGain(this, 'gain');
    this.gains.push(g);
    return g;
  }
  createOscillator() {
    return new FakeSource(this, 'osc');
  }
  createBufferSource() {
    return new FakeSource(this, 'buffer');
  }
  createBiquadFilter() {
    return new FakeSource(this, 'filter');
  }
  createBuffer(_c: number, n: number) {
    const data = new Float32Array(n);
    return { getChannelData: () => data };
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

/** ¿El nodo acaba (siguiendo sus salidas) en `bus`? */
export function reaches(n: FakeNode, bus: FakeNode, seen = new Set<FakeNode>()): boolean {
  if (n === bus) return true;
  if (seen.has(n)) return false;
  seen.add(n);
  return n.out.some((o) => reaches(o, bus, seen));
}

export function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    access: () => ({
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    }),
  };
}

export function setup() {
  const contexts: FakeContext[] = [];
  const sea: boolean[] = [];
  const pumps: (() => void)[] = [];
  const storage = memoryStorage();
  const prefs = createSoundPreferences(storage.access);
  const audio = new CanonAudio({
    createContext: () => {
      const c = new FakeContext();
      contexts.push(c);
      return c as unknown as AudioContext;
    },
    prefs,
    sea: (on) => sea.push(on),
    every: (_ms, fn) => {
      pumps.push(fn);
      return () => undefined;
    },
    random: () => 0.5,
  });
  const ctx = () => contexts[0]!;
  /** Los buses de las capas: los creados en `unlock` tras master, sfx y music. */
  const bus = (layer: 'battle' | 'boss') => ctx().gains[layer === 'battle' ? 3 : 4]!;
  const sfxBus = () => ctx().gains[1]!;
  const master = () => ctx().gains[0]!;
  return { audio, contexts, sea, pumps, storage, prefs, ctx, bus, sfxBus, master };
}
