import type { EndReason, SurvivorsEvent, SurvivorsMedal } from '@boia/engine/survivors';
import { type SoundPreferences, soundLevel } from './canon-sound-preferences';

/**
 * El sonido del Cañón (T152, decisión 7 del plan 013): todo sintetizado con
 * Web Audio, sin archivos ni licencias (`muestra`; la música de verdad de
 * BOIA es de Álvaro, más adelante).
 *
 * - Efectos: disparo, golpe recibido, enemigo abajo, nota, subir de nivel,
 *   elegir carta, botín de élite, aviso y caída de boss, medalla, barco
 *   inundado (y un aviso suave por cada ataque de boss que se telegrafía).
 * - Un bucle de batalla estilo drum and bass (170 BPM, break-beat y sub
 *   bajo) con varias frases para que no canse, y su variante de boss, más
 *   pesada, que entra con un fundido mientras hay un boss vivo. Al acabar la
 *   partida el bucle se funde y vuelve el ambiente del mar (`sea`), que pone
 *   y quita `/mar` (`lib/mundo/sound.ts`).
 *
 * Nada se crea ni se programa antes del primer gesto (`unlock`); con la
 * pestaña oculta el contexto se suspende. El volumen y el silencio de la
 * pausa (`canon-sound-preferences.ts`) y los Ajustes de la web (música y
 * efectos, el silencio global) se multiplican. Este módulo se carga aparte
 * (import dinámico al abrir el pop-up o al empezar), fuera de la primera carga.
 */

export type CanonSfx =
  | 'shot'
  | 'hit'
  | 'down'
  | 'note'
  | 'levelUp'
  | 'card'
  | 'elite'
  | 'bossWarn'
  | 'telegraph'
  | 'bossDown'
  | 'medal'
  | 'flooded';

export const CANON_SFX: readonly CanonSfx[] = [
  'shot',
  'hit',
  'down',
  'note',
  'levelUp',
  'card',
  'elite',
  'bossWarn',
  'telegraph',
  'bossDown',
  'medal',
  'flooded',
];

/** Qué suena de fondo: el bucle de batalla, el de boss o el mar de siempre. */
export type CanonMusic = 'battle' | 'boss' | 'sea';

export interface CanonAudioState {
  /** Ya hubo gesto y hay contexto. */
  unlocked: boolean;
  music: CanonMusic;
  hidden: boolean;
}

/** Lo justo de las preferencias de la pausa (la tienda de `canon-sound-preferences`). */
export interface SoundPrefsSource {
  get(): SoundPreferences;
  subscribe(listener: () => void): () => void;
}

export interface CanonAudioDeps {
  /** Crea el contexto (sólo se llama dentro de `unlock`); null sin Web Audio. */
  createContext: () => AudioContext | null;
  prefs: SoundPrefsSource;
  /** El ambiente del mar de `/mar`: suena (true) o se calla (false). */
  sea: (on: boolean) => void;
  /** Un temporizador que repite `fn` cada `ms`; devuelve cómo pararlo. */
  every?: (ms: number, fn: () => void) => () => void;
  random?: () => number;
}

// --- El bucle ---------------------------------------------------------------------

export const BPM = 170;
/** Una semicorchea (s): 16 por compás. */
export const STEP_S = 60 / BPM / 4;
/** Cuánto por delante se programa (s) y cada cuánto se mira (ms). */
const LOOKAHEAD_S = 0.14;
const PUMP_MS = 30;
/** Fundidos (s): entre batalla y boss, y al volver al mar. */
export const CROSSFADE_S = 1.6;
export const SEA_FADE_S = 2.2;
/** La música en pausa (el menú encima): más baja, sin pararla. */
const PAUSE_DUCK = 0.3;
const MUSIC_LEVEL = 0.55;
const SFX_LEVEL = 0.9;

/**
 * Un compás: bombo (`k`), caja (`s`), charles (`h`) y bajo (`b`) en 16
 * pasos. `x` golpe, `o` golpe flojo (caja fantasma, charles abierto), `.`
 * nada; en el bajo, `x` empieza nota y `-` la alarga.
 */
export interface DrumBar {
  k: string;
  s: string;
  h: string;
  b: string;
  /** Sólo boss: el «stab» de alarma en el primer tiempo. */
  alarm?: boolean;
}

const BAR = {
  // Batalla: dos pasos, amen, rodando, relleno y el respiro (sólo charles y bajo).
  two: {
    k: 'x.........x.....',
    s: '....x.......x...',
    h: 'x.x.x.x.x.x.x.x.',
    b: 'x-----x---x-----',
  },
  amen: {
    k: 'x.x.......x.....',
    s: '....x..o.o..x..o',
    h: 'x.x.x.xox.x.x.xo',
    b: 'x-----x---x-----',
  },
  roll: {
    k: 'x.........x..x..',
    s: '....x.o.....x.o.',
    h: 'xoxoxoxoxoxoxoxo',
    b: 'x--x------x--x--',
  },
  fill: {
    k: 'x.x.......x.x...',
    s: '....x..o.o..xoxx',
    h: 'x.x.x.x.x.x.....',
    b: 'x-----x---x-x-x-',
  },
  air: {
    k: 'x...............',
    s: '................',
    h: '..x...x...x...x.',
    b: 'x---------------',
  },
  // Boss: más bombo, bajo «reese» y una alarma cada dos compases.
  bossA: {
    k: 'x.x...x...x..x..',
    s: '....x.......x...',
    h: 'x.x.x.x.x.x.x.x.',
    b: 'x---x---x---x---',
    alarm: true,
  },
  bossB: {
    k: 'x.x...x.x.x..x..',
    s: '....x..o.o..x.xo',
    h: 'xoxoxoxoxoxoxoxo',
    b: 'x-x-x---x-x-x---',
  },
  bossFill: {
    k: 'x.x.x.x.x.x.xxxx',
    s: '....x...x.x.xxxx',
    h: 'x.x.x.x.........',
    b: 'x---x---x-x-x-x-',
  },
} satisfies Record<string, DrumBar>;

/** Frases de 8 compases que se van turnando: nunca suena lo mismo más de 8 compases. */
export const BATTLE_PHRASES: readonly (readonly DrumBar[])[] = [
  [BAR.two, BAR.two, BAR.amen, BAR.two, BAR.two, BAR.roll, BAR.amen, BAR.fill],
  [BAR.amen, BAR.roll, BAR.amen, BAR.roll, BAR.two, BAR.roll, BAR.amen, BAR.fill],
  [BAR.air, BAR.air, BAR.two, BAR.amen, BAR.roll, BAR.roll, BAR.amen, BAR.fill],
];
export const BOSS_PHRASES: readonly (readonly DrumBar[])[] = [
  [BAR.bossA, BAR.bossB, BAR.bossA, BAR.bossB, BAR.bossA, BAR.bossB, BAR.bossB, BAR.bossFill],
  [BAR.bossB, BAR.bossB, BAR.bossA, BAR.bossB, BAR.bossA, BAR.bossA, BAR.bossB, BAR.bossFill],
];
/** La raíz del bajo por compás (Hz): mi, sol, re, la; el boss, en re y medio tono que aprieta. */
const BATTLE_ROOTS = [41.2, 49.0, 36.71, 55.0];
const BOSS_ROOTS = [36.71, 38.89, 36.71, 32.7];

/** El compás que toca en el paso `step` (desde que empezó el bucle). */
export function barAt(phrases: readonly (readonly DrumBar[])[], step: number): DrumBar {
  const bar = Math.floor(step / 16);
  const phrase = phrases[Math.floor(bar / 8) % phrases.length]!;
  return phrase[bar % 8]!;
}

/** Cuántos pasos dura la nota de bajo que empieza en `i` (hasta el siguiente que no sea `-`). */
function noteSteps(line: string, i: number): number {
  let n = 1;
  while (i + n < line.length && line[i + n] === '-') n++;
  return n;
}

// --- Efectos: separación mínima entre dos iguales (s), para no saturar ---------------

const MIN_GAP: Partial<Record<CanonSfx, number>> = {
  shot: 0.09,
  down: 0.05,
  note: 0.04,
  hit: 0.15,
  telegraph: 0.6,
  bossWarn: 1.5,
  elite: 0.2,
};
/** Notas seguidas (s) que suben de tono, como las gemas de VS. */
const NOTE_COMBO_S = 0.6;

type Layer = 'battle' | 'boss';

interface Graph {
  ctx: AudioContext;
  master: GainNode;
  sfx: GainNode;
  music: GainNode;
  layers: Record<Layer, GainNode>;
  noise: AudioBuffer;
}

const defaultEvery = (ms: number, fn: () => void) => {
  const id = setInterval(fn, ms);
  return () => clearInterval(id);
};

export class CanonAudio {
  private readonly deps: CanonAudioDeps;
  private graph: Graph | null = null;
  private music: CanonMusic = 'sea';
  private hidden = false;
  private paused = false;
  private global = { music: 1, sfx: 1 };
  private readonly listeners = new Set<() => void>();
  private stopPump: (() => void) | null = null;
  private readonly offPrefs: () => void;
  /** El siguiente paso del bucle por programar: su número y cuándo suena (s del contexto). */
  private step = 0;
  private nextAt = 0;
  /** Hasta cuándo suena cada capa (s del contexto; Infinity mientras es la que toca). */
  private readonly until: Record<Layer, number> = { battle: -Infinity, boss: -Infinity };
  private readonly lastAt = new Map<CanonSfx, number>();
  private combo = 0;
  private disposed = false;
  private readonly cleanups: (() => void)[] = [];

  constructor(deps: CanonAudioDeps) {
    this.deps = deps;
    this.offPrefs = deps.prefs.subscribe(() => this.applyLevels());
  }

  // --- Estado -----------------------------------------------------------------------

  state(): CanonAudioState {
    return { unlocked: this.graph !== null, music: this.music, hidden: this.hidden };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const l of [...this.listeners]) l();
  }

  /**
   * El primer gesto: crea el contexto (en iOS tiene que ser dentro del gesto)
   * y, si ya toca bucle, lo arranca. Más gestos sólo reanudan si hace falta.
   */
  unlock(): void {
    if (this.disposed) return;
    if (this.graph) {
      this.resume();
      return;
    }
    let ctx: AudioContext | null = null;
    try {
      ctx = this.deps.createContext();
    } catch {
      ctx = null;
    }
    if (!ctx) return;
    try {
      const master = ctx.createGain();
      const sfx = ctx.createGain();
      const music = ctx.createGain();
      const battle = ctx.createGain();
      const boss = ctx.createGain();
      master.connect(ctx.destination);
      sfx.connect(master);
      music.connect(master);
      battle.connect(music);
      boss.connect(music);
      battle.gain.value = 0;
      boss.gain.value = 0;
      const n = Math.round(ctx.sampleRate * 1);
      const noise = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = noise.getChannelData(0);
      const rnd = this.deps.random ?? Math.random;
      for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1;
      this.graph = { ctx, master, sfx, music, layers: { battle, boss }, noise };
    } catch {
      this.graph = null;
      return;
    }
    this.applyLevels();
    this.resume();
    if (this.music !== 'sea') this.enter(this.music, true);
    this.stopPump = (this.deps.every ?? defaultEvery)(PUMP_MS, () => this.pump());
    this.notify();
  }

  private resume(): void {
    const g = this.graph;
    if (!g || this.hidden || g.ctx.state === 'running') return;
    g.ctx.resume().catch(() => undefined);
  }

  /** Pestaña oculta: todo en pausa; al volver sigue. */
  setHidden(hidden: boolean): void {
    if (this.hidden === hidden) return;
    this.hidden = hidden;
    const g = this.graph;
    if (g) {
      if (hidden) g.ctx.suspend().catch(() => undefined);
      else this.resume();
    }
    this.notify();
  }

  /** Los Ajustes de la web (música y efectos, 0…1; 0 es el silencio global). */
  setGlobal(levels: { music: number; sfx: number }): void {
    this.global = { music: levels.music, sfx: levels.sfx };
    this.applyLevels();
  }

  /** La partida en pausa (el menú encima): la música baja. */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.applyLevels();
  }

  private applyLevels(): void {
    const g = this.graph;
    if (!g) return;
    const now = g.ctx.currentTime;
    const set = (node: GainNode, v: number) => {
      node.gain.cancelScheduledValues(now);
      node.gain.setTargetAtTime(v, now, 0.05);
    };
    set(g.master, soundLevel(this.deps.prefs.get()));
    set(g.sfx, SFX_LEVEL * this.global.sfx);
    set(g.music, MUSIC_LEVEL * this.global.music * (this.paused ? PAUSE_DUCK : 1));
  }

  // --- Música -----------------------------------------------------------------------

  /** Batalla, boss o mar: con fundido. Antes del gesto sólo se apunta. */
  setMusic(music: CanonMusic): void {
    if (this.music === music) return;
    const from = this.music;
    this.music = music;
    if (music === 'sea') {
      this.fadeOutLayers(SEA_FADE_S);
      this.deps.sea(true);
    } else {
      if (from === 'sea') this.deps.sea(false);
      if (this.graph) this.enter(music, from === 'sea');
    }
    this.notify();
  }

  /** Hay boss vivo (o no) en la partida: cambia entre batalla y boss si suena bucle. */
  setBoss(alive: boolean): void {
    if (this.music === 'sea') return;
    this.setMusic(alive ? 'boss' : 'battle');
  }

  /** Entra la capa `layer`; la otra se funde. `fresh`: el bucle empieza ahora desde el primer compás. */
  private enter(layer: Layer, fresh: boolean): void {
    const g = this.graph!;
    const now = g.ctx.currentTime;
    const other: Layer = layer === 'battle' ? 'boss' : 'battle';
    const fade = fresh ? 0.4 : CROSSFADE_S;
    if (fresh || this.nextAt < now) {
      this.step = 0;
      this.nextAt = now + 0.05;
    }
    this.until[layer] = Infinity;
    if (this.until[other] > now) this.until[other] = now + fade + 0.1;
    ramp(g.layers[layer], now, 1, fade);
    ramp(g.layers[other], now, 0, fade);
  }

  private fadeOutLayers(seconds: number): void {
    const g = this.graph;
    if (!g) {
      this.until.battle = -Infinity;
      this.until.boss = -Infinity;
      return;
    }
    const now = g.ctx.currentTime;
    for (const layer of ['battle', 'boss'] as const) {
      if (this.until[layer] > now) this.until[layer] = now + seconds + 0.1;
      ramp(g.layers[layer], now, 0, seconds);
    }
  }

  /**
   * Programa los pasos del bucle que caen en la ventana de delante (lo llama
   * el temporizador; las pruebas, a mano). Sin capa sonando, nada.
   */
  pump(): void {
    const g = this.graph;
    if (!g || this.hidden) return;
    const now = g.ctx.currentTime;
    const active = (t: number) => t < this.until.battle || t < this.until.boss;
    if (!active(now)) return;
    // Tras un parón largo (temporizador frenado), seguir desde ahora sin ráfagas.
    if (this.nextAt < now - 0.1) this.nextAt = now + 0.02;
    while (this.nextAt < now + LOOKAHEAD_S && active(this.nextAt)) {
      const t = this.nextAt;
      if (t < this.until.battle) this.playStep('battle', this.step, t);
      if (t < this.until.boss) this.playStep('boss', this.step, t);
      this.step++;
      this.nextAt += STEP_S;
    }
  }

  private playStep(layer: Layer, step: number, t: number): void {
    const g = this.graph!;
    const bus = g.layers[layer];
    const boss = layer === 'boss';
    const bar = barAt(boss ? BOSS_PHRASES : BATTLE_PHRASES, step);
    const i = step % 16;
    const barN = Math.floor(step / 16);
    const k = bar.k[i];
    const s = bar.s[i];
    const h = bar.h[i];
    const b = bar.b[i];
    if (k === 'x') this.kick(bus, t, boss ? 1 : 0.9);
    if (s === 'x' || s === 'o') this.snare(bus, t, s === 'x' ? 1 : 0.3);
    if (h === 'x' || h === 'o') this.hat(bus, t, h === 'o' ? 0.6 : 1, h === 'o');
    if (b === 'x') {
      const roots = boss ? BOSS_ROOTS : BATTLE_ROOTS;
      const root = roots[barN % roots.length]!;
      // La última nota del compás, en los impares, sube una cuarta.
      const last = bar.b.lastIndexOf('x') === i && barN % 2 === 1 && i > 0;
      const f = last ? root * 1.335 : root;
      const len = noteSteps(bar.b, i) * STEP_S;
      if (boss) this.reese(bus, t, f, len);
      else this.sub(bus, t, f, len);
    }
    if (boss && bar.alarm && i === 0 && barN % 2 === 0) this.alarm(bus, t);
  }

  // --- Voces del bucle --------------------------------------------------------------

  private kick(bus: GainNode, t: number, v: number): void {
    const { ctx } = this.graph!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    env(g, t, 0.9 * v, 0.004, 0.28);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + 0.3);
  }

  private snare(bus: GainNode, t: number, v: number): void {
    const { ctx } = this.graph!;
    const src = this.noiseSource(t, 0.18);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1900;
    band.Q.value = 0.7;
    const g = ctx.createGain();
    env(g, t, 0.45 * v, 0.002, 0.16);
    src.connect(band).connect(g).connect(bus);
    if (v >= 0.5) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(210, t);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.07);
      env(og, t, 0.25 * v, 0.002, 0.09);
      o.connect(og).connect(bus);
      o.start(t);
      o.stop(t + 0.1);
    }
  }

  private hat(bus: GainNode, t: number, v: number, open: boolean): void {
    const { ctx } = this.graph!;
    const len = open ? 0.12 : 0.035;
    const src = this.noiseSource(t, len + 0.02);
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 7500;
    const g = ctx.createGain();
    env(g, t, 0.14 * v, 0.001, len);
    src.connect(high).connect(g).connect(bus);
  }

  /** Sub bajo: el seno grave y un armónico suave para que se oiga en altavoces pequeños. */
  private sub(bus: GainNode, t: number, f: number, len: number): void {
    const { ctx } = this.graph!;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const g2 = ctx.createGain();
    o.type = 'sine';
    o2.type = 'triangle';
    o.frequency.value = f;
    o2.frequency.value = f * 2;
    hold(g, t, 0.55, len);
    hold(g2, t, 0.12, len);
    o.connect(g).connect(bus);
    o2.connect(g2).connect(bus);
    o.start(t);
    o2.start(t);
    o.stop(t + len + 0.05);
    o2.stop(t + len + 0.05);
  }

  /** Bajo «reese» del boss: dos sierras desafinadas por un filtro que gruñe, más el sub. */
  private reese(bus: GainNode, t: number, f: number, len: number): void {
    const { ctx } = this.graph!;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.Q.value = 4;
    low.frequency.setValueAtTime(900, t);
    low.frequency.exponentialRampToValueAtTime(260, t + len);
    const g = ctx.createGain();
    hold(g, t, 0.2, len);
    low.connect(g).connect(bus);
    for (const detune of [0.994, 1.006]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f * 2 * detune;
      o.connect(low);
      o.start(t);
      o.stop(t + len + 0.05);
    }
    this.sub(bus, t, f, len);
  }

  private alarm(bus: GainNode, t: number): void {
    const { ctx } = this.graph!;
    for (const [at, f] of [
      [0, 880],
      [STEP_S * 2, 831],
    ] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = f;
      env(g, t + at, 0.05, 0.005, STEP_S * 1.8);
      o.connect(g).connect(bus);
      o.start(t + at);
      o.stop(t + at + STEP_S * 2);
    }
  }

  private noiseSource(t: number, len: number): AudioBufferSourceNode {
    const g = this.graph!;
    const src = g.ctx.createBufferSource();
    src.buffer = g.noise;
    const offset = ((this.deps.random ?? Math.random)() * 0.8) % 0.8;
    src.start(t, offset);
    src.stop(t + len);
    return src;
  }

  // --- Efectos ------------------------------------------------------------------------

  /** Un efecto ahora (si hay contexto, se oye algo y no acaba de sonar el mismo). */
  play(id: CanonSfx, strength = 1): void {
    const g = this.graph;
    if (!g || this.hidden) return;
    if (soundLevel(this.deps.prefs.get()) === 0 || this.global.sfx === 0) return;
    const now = g.ctx.currentTime;
    const gap = MIN_GAP[id] ?? 0;
    const last = this.lastAt.get(id);
    if (gap && last !== undefined && now - last < gap) return;
    if (id === 'note') {
      const chained = last !== undefined && now - last < NOTE_COMBO_S;
      this.combo = chained ? Math.min(12, this.combo + 1) : 0;
    }
    this.lastAt.set(id, now);
    const k = Math.max(0.2, Math.min(1.5, strength));
    switch (id) {
      case 'shot':
        this.tone(560, 280, 0, 0.05, 0.035, 'triangle');
        this.noise(2400, 900, 0.05, 0.03);
        break;
      case 'hit':
        this.tone(150, 55, 0, 0.22, 0.35 * k, 'triangle');
        this.noise(900, 250, 0.2, 0.22 * k, 'lowpass');
        break;
      case 'down':
        this.tone(720 * k, 300, 0, 0.08, 0.05 * k, 'square');
        break;
      case 'note': {
        const f = 1046.5 * 2 ** (this.combo / 12);
        this.tone(f, f * 1.03, 0, 0.09, 0.06);
        break;
      }
      case 'levelUp':
        [523.3, 659.3, 784, 1046.5].forEach((f, i) =>
          this.tone(f, f, i * 0.07, 0.16, 0.1, 'triangle'),
        );
        break;
      case 'card':
        this.tone(660, 990, 0, 0.1, 0.1, 'triangle');
        this.tone(1320, 1320, 0.08, 0.14, 0.07);
        break;
      case 'elite':
        [1046.5, 1318.5, 1568].forEach((f, i) =>
          this.tone(f, f * 1.01, i * 0.06, 0.25, 0.07, 'triangle'),
        );
        break;
      case 'bossWarn':
        for (let i = 0; i < 4; i++)
          this.tone(i % 2 ? 330 : 440, i % 2 ? 320 : 430, i * 0.22, 0.2, 0.08, 'square');
        break;
      case 'telegraph':
        this.tone(220, 180, 0, 0.25, 0.08, 'sawtooth');
        break;
      case 'bossDown':
        this.tone(110, 35, 0, 0.9, 0.5, 'triangle');
        this.noise(1200, 120, 1, 0.3, 'lowpass');
        [523.3, 784, 1046.5].forEach((f, i) =>
          this.tone(f, f, 0.35 + i * 0.1, 0.3, 0.09, 'triangle'),
        );
        break;
      case 'medal':
        [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) =>
          this.tone(f, f * 1.01, i * 0.11, 0.24, 0.11, 'triangle'),
        );
        this.tone(1046.5, 1568, 0.55, 0.6, 0.09);
        break;
      case 'flooded':
        this.tone(420, 70, 0, 1.3, 0.25);
        this.noise(700, 90, 1.4, 0.25, 'lowpass');
        break;
    }
  }

  private tone(
    from: number,
    to: number,
    at: number,
    length: number,
    peak: number,
    type: OscillatorType = 'sine',
  ): void {
    const { ctx, sfx } = this.graph!;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t + length * 0.8);
    env(g, t, peak, 0.008, length);
    o.connect(g).connect(sfx);
    o.start(t);
    o.stop(t + length + 0.02);
  }

  private noise(
    from: number,
    to: number,
    length: number,
    peak: number,
    type: BiquadFilterType = 'bandpass',
  ): void {
    const { ctx, sfx } = this.graph!;
    const t = ctx.currentTime;
    const src = this.noiseSource(t, length + 0.02);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + length);
    const g = ctx.createGain();
    env(g, t, peak, 0.005, length);
    src.connect(f).connect(g).connect(sfx);
  }

  /** Lo que la simulación cuenta en un paso, en efectos (y el bucle de boss al llegar uno). */
  events(events: readonly SurvivorsEvent[]): void {
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      switch (e.type) {
        case 'fire':
          this.play('shot');
          break;
        case 'hit':
        case 'bossHit':
          this.play('hit');
          break;
        case 'defeated':
          this.play(e.elite ? 'elite' : 'down', e.elite ? 1.3 : 1);
          break;
        case 'note':
          this.play('note');
          break;
        case 'levelUp':
          this.play('levelUp');
          break;
        case 'drop':
        case 'chest':
          this.play('elite');
          break;
        case 'bossSpawn':
          this.play('bossWarn');
          this.setBoss(true);
          break;
        case 'bossTelegraph':
          this.play('telegraph');
          break;
        case 'bossDefeated':
          this.play('bossDown');
          break;
        default:
          break;
      }
    }
  }

  /** Acaba la partida: medalla o inundado, y el bucle se funde hacia el mar. */
  end(reason: EndReason, medal: SurvivorsMedal | null): void {
    if (reason === 'flooded') this.play('flooded');
    else if (medal && reason !== 'quit') this.play('medal');
    this.setMusic('sea');
  }

  /** Algo más que soltar al acabar (los oyentes de la página). */
  onDispose(fn: () => void): void {
    this.cleanups.push(fn);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const fn of this.cleanups.splice(0)) fn();
    this.offPrefs();
    this.stopPump?.();
    this.stopPump = null;
    if (this.music !== 'sea') this.deps.sea(true);
    this.music = 'sea';
    const g = this.graph;
    this.graph = null;
    g?.ctx.close().catch(() => undefined);
    this.listeners.clear();
  }
}

// --- Envolventes ---------------------------------------------------------------------

function env(g: GainNode, t: number, peak: number, attack: number, length: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
}

/** Nota sostenida: sube rápido, se queda y se apaga al final. */
function hold(g: GainNode, t: number, peak: number, length: number): void {
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.006);
  g.gain.setValueAtTime(peak, t + Math.max(0.01, length - 0.03));
  g.gain.linearRampToValueAtTime(0, t + length);
}

function ramp(node: GainNode, now: number, to: number, seconds: number): void {
  node.gain.cancelScheduledValues(now);
  node.gain.setValueAtTime(node.gain.value, now);
  node.gain.linearRampToValueAtTime(to, now + seconds);
}

// --- En la página -------------------------------------------------------------------

type AudioContextCtor = new () => AudioContext;

function browserContext(): AudioContext | null {
  const g = globalThis as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

/**
 * El sonido del Cañón en la página: el primer gesto (toque, clic o tecla)
 * después de cargarse lo desbloquea y cada gesto lo reanuda si el navegador
 * lo paró; ocultar la pestaña lo suspende. El módulo se carga al abrir el
 * pop-up, así que el «Jugar» de la partida ya es ese gesto; con un atajo de
 * URL, la primera tecla o toque.
 */
export function createPageCanonAudio(
  prefs: SoundPrefsSource,
  sea: (on: boolean) => void,
  win: Window = window,
  doc: Document = document,
): CanonAudio {
  const audio = new CanonAudio({ createContext: browserContext, prefs, sea });
  const gestures = ['pointerdown', 'touchend', 'click', 'keydown'] as const;
  // Sólo gestos de verdad: los clics que el propio código lanza no cuentan.
  const onGesture = (e: Event) => {
    if (e.isTrusted) audio.unlock();
  };
  const onVisibility = () => audio.setHidden(doc.visibilityState === 'hidden');
  for (const t of gestures) win.addEventListener(t, onGesture, true);
  doc.addEventListener('visibilitychange', onVisibility);
  onVisibility();
  audio.onDispose(() => {
    for (const t of gestures) win.removeEventListener(t, onGesture, true);
    doc.removeEventListener('visibilitychange', onVisibility);
  });
  return audio;
}
