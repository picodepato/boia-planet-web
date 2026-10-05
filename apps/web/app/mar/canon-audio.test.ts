import type { SurvivorsEvent } from '@boia/engine/survivors';
import { describe, expect, it } from 'vitest';
import {
  BATTLE_PHRASES,
  BOSS_PHRASES,
  CANON_SFX,
  CROSSFADE_S,
  CanonAudio,
  SEA_FADE_S,
  STEP_S,
  barAt,
} from './canon-audio';
import {
  DEFAULT_SOUND,
  SOUND_STORAGE_KEY,
  createSoundPreferences,
  readSoundPreferences,
} from './canon-sound-preferences';

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

class FakeContext {
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
function reaches(n: FakeNode, bus: FakeNode, seen = new Set<FakeNode>()): boolean {
  if (n === bus) return true;
  if (seen.has(n)) return false;
  seen.add(n);
  return n.out.some((o) => reaches(o, bus, seen));
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    access: () => ({
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    }),
  };
}

function setup() {
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

const someEvents: SurvivorsEvent[] = [
  { type: 'fire', weapon: 'canon', x: 0, y: 0, count: 1 },
  { type: 'levelUp', level: 2 },
  { type: 'hit', enemy: 'piranha', x: 0, y: 0, water: 5 },
];

describe('sonido del Cañón (T152)', () => {
  it('antes del primer gesto no crea contexto ni programa nada', () => {
    const { audio, contexts, pumps } = setup();
    audio.setMusic('battle');
    for (const id of CANON_SFX) audio.play(id);
    audio.events(someEvents);
    audio.setBoss(true);
    audio.end('flooded', null);
    expect(contexts).toHaveLength(0);
    expect(pumps).toHaveLength(0);
    expect(audio.state().unlocked).toBe(false);
  });

  it('con el gesto arranca el bucle que tocaba y los efectos suenan en su bus', () => {
    const { audio, contexts, pumps, ctx, bus, sfxBus } = setup();
    audio.setMusic('battle');
    audio.unlock();
    expect(contexts).toHaveLength(1);
    expect(audio.state()).toMatchObject({ unlocked: true, music: 'battle' });
    expect(pumps).toHaveLength(1);
    pumps[0]!();
    const looped = ctx().started.filter((s) => reaches(s.node, bus('battle')));
    expect(looped.length).toBeGreaterThan(0);
    // El primer paso del bucle es un bombo en el primer tiempo.
    expect(looped[0]!.t).toBeCloseTo(0.05, 5);
    const before = ctx().started.length;
    audio.play('levelUp');
    const sfx = ctx().started.slice(before);
    expect(sfx.length).toBeGreaterThan(0);
    expect(sfx.every((s) => reaches(s.node, sfxBus()))).toBe(true);
    // Un segundo gesto no crea otro contexto.
    audio.unlock();
    expect(contexts).toHaveLength(1);
  });

  it('cada efecto de la lista suena (con contexto) y los repetidos se espacian', () => {
    const { audio, ctx } = setup();
    audio.unlock();
    for (const id of CANON_SFX) {
      const before = ctx().started.length;
      audio.play(id);
      expect(ctx().started.length, id).toBeGreaterThan(before);
    }
    ctx().currentTime = 10;
    audio.play('shot');
    const n = ctx().started.length;
    audio.play('shot');
    expect(ctx().started.length).toBe(n);
    ctx().currentTime = 10.2;
    audio.play('shot');
    expect(ctx().started.length).toBeGreaterThan(n);
  });

  it('el bucle cambia batalla → boss → mar con fundidos y el mar vuelve', () => {
    const { audio, sea, pumps, ctx, bus } = setup();
    audio.unlock();
    expect(audio.state().music).toBe('sea');
    audio.setMusic('battle');
    expect(sea).toEqual([false]);
    pumps[0]!();
    expect(bus('battle').gain.target).toBe(1);

    // Llega un boss: la capa de boss entra y la de batalla se funde.
    ctx().currentTime = 8;
    audio.events([
      { type: 'bossSpawn', boss: 'vecino', id: 1, kind: 'miniboss', nameKey: 'x', x: 0, y: 0 },
    ]);
    expect(audio.state().music).toBe('boss');
    expect(bus('boss').gain.target).toBe(1);
    expect(bus('battle').gain.target).toBe(0);
    expect(bus('boss').gain.calls.at(-1)!.time).toBeCloseTo(8 + CROSSFADE_S, 5);
    const at = ctx().started.length;
    pumps[0]!();
    const fresh = ctx().started.slice(at);
    expect(fresh.some((s) => reaches(s.node, bus('boss')))).toBe(true);
    // Durante el fundido las dos capas siguen sonando.
    expect(fresh.some((s) => reaches(s.node, bus('battle')))).toBe(true);
    ctx().currentTime = 8 + CROSSFADE_S + 0.5;
    const later = ctx().started.length;
    pumps[0]!();
    const afterFade = ctx().started.slice(later);
    expect(afterFade.length).toBeGreaterThan(0);
    expect(afterFade.some((s) => reaches(s.node, bus('battle')))).toBe(false);

    // Sin boss vivo vuelve la batalla.
    audio.setBoss(false);
    expect(audio.state().music).toBe('battle');
    expect(bus('battle').gain.target).toBe(1);

    // Acaba la partida: el bucle se funde y el mar vuelve; luego no se programa nada.
    ctx().currentTime = 20;
    audio.end('survived', 'oro');
    expect(audio.state().music).toBe('sea');
    expect(sea).toEqual([false, true]);
    expect(bus('battle').gain.target).toBe(0);
    expect(bus('boss').gain.target).toBe(0);
    ctx().currentTime = 20 + SEA_FADE_S + 1;
    const done = ctx().started.length;
    pumps[0]!();
    expect(ctx().started.length).toBe(done);
    // En el mar, un boss que llegara tarde no vuelve a encender el bucle.
    audio.setBoss(true);
    expect(audio.state().music).toBe('sea');
  });

  it('con la pestaña oculta suspende y no programa; al volver sigue', () => {
    const { audio, pumps, ctx } = setup();
    audio.setMusic('battle');
    audio.unlock();
    audio.setHidden(true);
    expect(ctx().state).toBe('suspended');
    const n = ctx().started.length;
    pumps[0]!();
    audio.play('hit');
    expect(ctx().started.length).toBe(n);
    audio.setHidden(false);
    expect(ctx().state).toBe('running');
    pumps[0]!();
    expect(ctx().started.length).toBeGreaterThan(n);
  });

  it('volumen y silencio de la pausa: se aplican y se recuerdan por navegador', () => {
    const { audio, prefs, storage, master, ctx } = setup();
    audio.unlock();
    expect(master().gain.target).toBe(DEFAULT_SOUND.volume);
    prefs.setVolume(0.35);
    expect(master().gain.target).toBeCloseTo(0.35);
    prefs.toggleMuted();
    expect(master().gain.target).toBe(0);
    // En silencio no se programa ningún efecto.
    const n = ctx().started.length;
    audio.play('medal');
    expect(ctx().started.length).toBe(n);
    // Otra visita lee lo mismo.
    expect(readSoundPreferences(storage.access)).toEqual({ volume: 0.35, muted: true });
    expect(createSoundPreferences(storage.access).get()).toEqual({ volume: 0.35, muted: true });
    expect(JSON.parse(storage.map.get(SOUND_STORAGE_KEY)!)).toEqual({ volume: 0.35, muted: true });
    // Subir el volumen quita el silencio.
    prefs.setVolume(0.5);
    expect(prefs.get()).toEqual({ volume: 0.5, muted: false });
  });

  it('el silencio global de la web (Ajustes) también calla los efectos y la música', () => {
    const { audio, ctx, sfxBus } = setup();
    audio.unlock();
    audio.setGlobal({ music: 0, sfx: 0 });
    const music = ctx().gains[2]!;
    expect(music.gain.target).toBe(0);
    expect(sfxBus().gain.target).toBe(0);
    const n = ctx().started.length;
    audio.play('levelUp');
    expect(ctx().started.length).toBe(n);
  });

  it('las preferencias toleran un almacenamiento que falla o trae basura', () => {
    const throwing = () => {
      throw new Error('denied');
    };
    expect(readSoundPreferences(throwing)).toEqual(DEFAULT_SOUND);
    const store = createSoundPreferences(throwing);
    store.setVolume(0.2);
    expect(store.get().volume).toBeCloseTo(0.2);
    const junk = memoryStorage();
    junk.map.set(SOUND_STORAGE_KEY, '{"volume":7,"muted":"si"}');
    expect(readSoundPreferences(junk.access)).toEqual({ volume: 1, muted: false });
    junk.map.set(SOUND_STORAGE_KEY, 'no es json');
    expect(readSoundPreferences(junk.access)).toEqual(DEFAULT_SOUND);
  });

  it('el bucle tiene variaciones: frases distintas y relleno al final de cada una', () => {
    const bars = (phrases: typeof BATTLE_PHRASES, count: number) =>
      Array.from({ length: count }, (_, b) => barAt(phrases, b * 16));
    const battle = bars(BATTLE_PHRASES, 8 * BATTLE_PHRASES.length);
    expect(new Set(battle).size).toBeGreaterThanOrEqual(4);
    for (let p = 0; p < BATTLE_PHRASES.length; p++) {
      expect(new Set(BATTLE_PHRASES[p]).size, `frase ${p}`).toBeGreaterThan(1);
    }
    // Ninguna frase se repite tal cual seguida.
    expect(BATTLE_PHRASES[0]).not.toEqual(BATTLE_PHRASES[1]);
    expect(new Set(bars(BOSS_PHRASES, 16)).size).toBeGreaterThanOrEqual(3);
    // ~170 BPM: una negra son cuatro pasos.
    expect(60 / (STEP_S * 4)).toBeCloseTo(170, 5);
  });

  it('al soltarlo devuelve el mar y cierra el contexto', () => {
    const { audio, sea, ctx } = setup();
    audio.unlock();
    audio.setMusic('battle');
    audio.dispose();
    expect(sea.at(-1)).toBe(true);
    expect(ctx().state).toBe('closed');
    audio.unlock();
    expect(audio.state().unlocked).toBe(false);
  });
});
