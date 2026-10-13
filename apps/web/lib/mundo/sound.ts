'use client';

import { type Settings, channelGain } from '@boia/engine/ui';
import type { HornVoice } from '@boia/engine/toys';
import type { WeatherEvent, WeatherKind } from '@boia/engine/weather';
import type { FeedbackSound } from '@boia/world';
import { AMBIENT_LEVEL, AMBIENT_RATE, renderAmbient } from './ambient';
import { onRadioPlaying, radioPlaying, setMusicEnabledForRadio } from '../radio/bridge';

/**
 * Sonido del juego con dos canales separados (§20, REQ-IDE-037): música y
 * efectos. Aún no hay audio grabado: los efectos se sintetizan y la música
 * es un loop de ambiente generado por mundo (O10, `ambient.ts`).
 *
 * Nada suena ni se crea un `AudioContext` antes del primer gesto del
 * jugador (`unlockAudio`, que conecta `installAudioLifecycle`): así lo piden
 * los navegadores y, en iOS, el desbloqueo tiene que ocurrir dentro del
 * gesto. Con la pestaña oculta todo se pausa.
 */

interface Graph {
  ctx: AudioContext;
  sfx: GainNode;
  music: GainNode;
}

let graph: Graph | null = null;
let unlocked = false;
let hidden = false;
let gains = { sfx: 0.8, music: 0.6 };
let noise: AudioBuffer | null = null;

/** Mundo cuyo loop debe sonar (null: ninguno, p. ej. fuera del mar). */
let ambientWorld: string | null = null;
let ambient: { world: string; source: AudioBufferSourceNode; gain: GainNode } | null = null;
const ambientBuffers = new Map<string, AudioBuffer>();

// Mientras suena la radio (plan 022 T247) el loop del mundo se calla.
onRadioPlaying(() => syncAmbient());

type AudioContextCtor = new () => AudioContext;

function contextCtor(): AudioContextCtor | null {
  const g = globalThis as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

function build(): Graph | null {
  if (graph) return graph;
  const Ctor = contextCtor();
  if (!Ctor) return null;
  try {
    const ctx = new Ctor();
    const sfx = ctx.createGain();
    const music = ctx.createGain();
    sfx.connect(ctx.destination);
    music.connect(ctx.destination);
    sfx.gain.value = gains.sfx;
    music.gain.value = gains.music;
    graph = { ctx, sfx, music };
    return graph;
  } catch {
    // Sin Web Audio: el juego sigue en silencio.
    return null;
  }
}

/** Si ya hubo gesto y hay audio. */
export function audioUnlocked(): boolean {
  return unlocked;
}

/**
 * Primer gesto del jugador: crea el contexto y lo desbloquea. En iOS hace
 * falta reanudarlo y hacer sonar algo dentro del mismo gesto: un búfer mudo.
 */
export function unlockAudio(): void {
  if (unlocked) return;
  const g = build();
  if (!g) return;
  unlocked = true;
  try {
    const silent = g.ctx.createBufferSource();
    silent.buffer = g.ctx.createBuffer(1, 1, 22050);
    silent.connect(g.ctx.destination);
    silent.start(0);
  } catch {
    // Sin búfer mudo sigue valiendo el resume de abajo.
  }
  if (!hidden) resume(g.ctx);
  syncAmbient();
}

function resume(ctx: AudioContext): void {
  if (ctx.state === 'running') return;
  ctx.resume().catch(() => undefined);
}

/** Pestaña oculta: todo en pausa; al volver, sigue donde estaba. */
export function setAudioHidden(isHidden: boolean): void {
  hidden = isHidden;
  if (!graph || !unlocked) return;
  if (isHidden) graph.ctx.suspend().catch(() => undefined);
  else resume(graph.ctx);
}

/**
 * Si la página ya tuvo un gesto aunque nadie llamara a `unlockAudio` (una
 * pantalla sin `installAudioLifecycle`, como `/mar`): entonces se puede sonar.
 */
function pageWasActivated(): boolean {
  const nav = (globalThis as { navigator?: { userActivation?: { hasBeenActive?: boolean } } })
    .navigator;
  return nav?.userActivation?.hasBeenActive === true;
}

/** Contexto listo para sonar ahora mismo, o null (antes del gesto u oculto). */
function live(): Graph | null {
  if (!unlocked && pageWasActivated()) unlockAudio();
  return unlocked && !hidden ? graph : null;
}

export function applyAudioSettings(s: Settings): void {
  gains = { sfx: channelGain(s.sfx), music: channelGain(s.music) };
  // «Música» de Ajustes manda también en la radio (plan 022 T247).
  setMusicEnabledForRadio(s.music.enabled);
  if (graph) {
    graph.sfx.gain.value = gains.sfx;
    graph.music.gain.value = gains.music;
  }
  syncAmbient();
}

// --- Ambiente ---------------------------------------------------------------

/** El loop del mundo que se juega; `null` lo apaga (la landing no suena, O10). */
export function setAmbientWorld(worldId: string | null): void {
  ambientWorld = worldId;
  syncAmbient();
}

function ambientBuffer(ctx: AudioContext, world: string): AudioBuffer {
  let b = ambientBuffers.get(world);
  if (!b) {
    const samples = renderAmbient(world, AMBIENT_RATE);
    b = ctx.createBuffer(1, samples.length, AMBIENT_RATE);
    b.getChannelData(0).set(samples);
    ambientBuffers.set(world, b);
  }
  return b;
}

/** Arranca, cambia o apaga el loop según gesto, mundo y música activa. */
function syncAmbient(): void {
  const g = unlocked ? graph : null;
  const want = g && gains.music > 0 && !radioPlaying() ? ambientWorld : null;
  if (ambient?.world === want) return;
  if (!g) return;
  const now = g.ctx.currentTime;
  if (ambient) {
    const old = ambient;
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(old.gain.gain.value, now);
    old.gain.gain.linearRampToValueAtTime(0, now + 1.2);
    old.source.stop(now + 1.3);
    ambient = null;
  }
  if (!want) return;
  try {
    const source = g.ctx.createBufferSource();
    source.buffer = ambientBuffer(g.ctx, want);
    source.loop = true;
    const gain = g.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(AMBIENT_LEVEL, now + 2);
    source.connect(gain).connect(g.music);
    source.start(now);
    ambient = { world: want, source, gain };
  } catch {
    // Sin búfer: el juego sigue sin música.
  }
}

/**
 * Conecta el audio a la página: el primer gesto (toque, clic o tecla)
 * desbloquea; ocultar la pestaña pausa. Devuelve la desconexión.
 */
export function installAudioLifecycle(win: Window = window, doc: Document = document): () => void {
  const gestures = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;
  const onGesture = () => {
    unlockAudio();
    if (unlocked) for (const t of gestures) win.removeEventListener(t, onGesture, true);
  };
  const onVisibility = () => setAudioHidden(doc.visibilityState === 'hidden');
  if (!unlocked) for (const t of gestures) win.addEventListener(t, onGesture, true);
  doc.addEventListener('visibilitychange', onVisibility);
  onVisibility();
  return () => {
    for (const t of gestures) win.removeEventListener(t, onGesture, true);
    doc.removeEventListener('visibilitychange', onVisibility);
  };
}

// --- Efectos ----------------------------------------------------------------

function tone(
  freqFrom: number,
  freqTo: number,
  at: number,
  length: number,
  peak: number,
  type: OscillatorType = 'sine',
): void {
  if (gains.sfx === 0) return;
  const a = live();
  if (!a) return;
  const t = a.ctx.currentTime + at;
  const o = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freqFrom, t);
  o.frequency.exponentialRampToValueAtTime(freqTo, t + length * 0.75);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  o.connect(g).connect(a.sfx);
  o.start(t);
  o.stop(t + length + 0.01);
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noise) {
    const n = Math.round(ctx.sampleRate * 0.6);
    noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** Ruido filtrado con barrido de banda: el aire del WHOOSH y el chapoteo del golpe. */
function noiseSweep(fromHz: number, toHz: number, length: number, peak: number, q = 1.2): void {
  if (gains.sfx === 0) return;
  const a = live();
  if (!a) return;
  const t = a.ctx.currentTime;
  const src = a.ctx.createBufferSource();
  src.buffer = noiseBuffer(a.ctx);
  const band = a.ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = q;
  band.frequency.setValueAtTime(fromHz, t);
  band.frequency.exponentialRampToValueAtTime(toHz, t + length);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + length * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  src.connect(band).connect(g).connect(a.sfx);
  src.start(t);
  src.stop(t + length + 0.02);
}

/** «Plop» corto de cada bocadillo (REQ-AVE-001). */
export function plop(): void {
  tone(620, 180, 0, 0.12, 0.18);
}

/** Aviso de descubrimiento o logro: dos notas cortas, ascendentes (REQ-IDE-026). */
export function chime(): void {
  tone(660, 700, 0, 0.12, 0.14);
  tone(990, 1040, 0.09, 0.18, 0.14);
}

/** Celebración de la entrega de la Fiestera: arpegio corto hacia arriba (REQ-AVE-008). */
export function fanfare(): void {
  const notes = [523, 659, 784, 1047, 1319];
  notes.forEach((f, i) => tone(f, f * 1.01, i * 0.11, 0.22, 0.16));
  tone(1047, 1568, notes.length * 0.11, 0.5, 0.12);
}

/** «Ping» de recoger algo: una nota alta y limpia con su octava. */
export function ping(): void {
  tone(1319, 1397, 0, 0.16, 0.16);
  tone(2637, 2794, 0.015, 0.12, 0.05);
}

/** WHOOSH del boost: aire que sube. */
export function whoosh(): void {
  noiseSweep(380, 2600, 0.5, 0.3, 0.9);
}

/** Golpe contra la costa o una roca; `strength` 0..1 según la velocidad del choque. */
export function bump(strength = 1): void {
  const k = Math.min(1, Math.max(0.15, strength));
  tone(120, 48, 0, 0.2, 0.35 * k, 'triangle');
  noiseSweep(900, 300, 0.16, 0.18 * k, 0.7);
}

// --- Juguetes del barco (plan 029 T271) -------------------------------------

/**
 * La bocina de un barco: dos notas a la vez (`voice.low` y `voice.high`) con
 * la onda, la duración, la caída y el vibrato de su voz (`hornVoice`).
 */
export function horn(voice: HornVoice): void {
  if (gains.sfx === 0) return;
  const a = live();
  if (!a) return;
  const t = a.ctx.currentTime;
  const len = voice.length;
  try {
    const mix = a.ctx.createGain();
    mix.gain.setValueAtTime(0.0001, t);
    mix.gain.exponentialRampToValueAtTime(0.2, t + 0.04);
    mix.gain.setValueAtTime(0.2, t + len * 0.7);
    mix.gain.exponentialRampToValueAtTime(0.0001, t + len);
    // Un paso bajo quita lo áspero de las ondas de sierra y cuadrada.
    const soft = a.ctx.createBiquadFilter();
    soft.type = 'lowpass';
    soft.frequency.value = 1500;
    mix.connect(soft).connect(a.sfx);
    for (const f of [voice.low, voice.high]) {
      const o = a.ctx.createOscillator();
      o.type = voice.wave;
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * (1 - voice.droop), t + len);
      o.connect(mix);
      if (voice.wobble > 0) {
        const lfo = a.ctx.createOscillator();
        const depth = a.ctx.createGain();
        lfo.frequency.value = voice.wobble;
        depth.gain.value = f * 0.02;
        lfo.connect(depth).connect(o.frequency);
        lfo.start(t);
        lfo.stop(t + len + 0.02);
      }
      o.start(t);
      o.stop(t + len + 0.02);
    }
  } catch {
    // Sin audio: la bocina queda muda.
  }
}

/** El ronquido que suena ahora (su salida), para cortarlo al despertar o al salir del mar. */
let snoreOut: GainNode | null = null;

/** Un ronquido suave: ruido grave que sube al respirar y baja al soltar. */
export function snore(): void {
  if (gains.sfx === 0) return;
  const a = live();
  if (!a) return;
  const t = a.ctx.currentTime;
  try {
    stopSnore();
    const out = a.ctx.createGain();
    out.connect(a.sfx);
    snoreOut = out;
    const src = a.ctx.createBufferSource();
    src.buffer = bedBuffer(a.ctx);
    src.loop = true;
    const low = a.ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.setValueAtTime(180, t);
    low.frequency.linearRampToValueAtTime(420, t + 0.9);
    low.frequency.linearRampToValueAtTime(140, t + 1.6);
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    src.connect(low).connect(g).connect(out);
    src.start(t);
    src.stop(t + 1.75);
    // El silbido al soltar el aire.
    const o = a.ctx.createOscillator();
    const og = a.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(150, t + 0.95);
    o.frequency.exponentialRampToValueAtTime(95, t + 0.95 + 0.375);
    og.gain.setValueAtTime(0.0001, t + 0.95);
    og.gain.exponentialRampToValueAtTime(0.05, t + 0.96);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 1.45);
    o.connect(og).connect(out);
    o.start(t + 0.95);
    o.stop(t + 1.46);
  } catch {
    // Sin búfer: duerme en silencio.
  }
}

/** Corta el ronquido que esté sonando (al despertar, al salir del mar). */
export function stopSnore(): void {
  const out = snoreOut;
  snoreOut = null;
  if (!out) return;
  try {
    const now = out.context.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setValueAtTime(out.gain.value, now);
    out.gain.linearRampToValueAtTime(0, now + 0.08);
    setTimeout(() => out.disconnect(), 150);
  } catch {
    // Ya no hay audio: nada que cortar.
  }
}

/** El susto de despertarse: un sobresalto agudo y corto. */
export function startle(): void {
  tone(520, 1040, 0, 0.12, 0.14, 'square');
  tone(780, 1240, 0.08, 0.14, 0.1, 'square');
}

// --- Los personajes del agua (plan 029 T270) --------------------------------

/**
 * El graznido de la gaviota ladrona: un chillido agudo que cae, con aire
 * ronco detrás. `laugh`: tres seguidos, cada vez más cortos (se ríe al escapar).
 */
export function squawk(laugh = false): void {
  const n = laugh ? 3 : 1;
  for (let i = 0; i < n; i++) {
    const at = i * 0.22;
    const len = laugh ? 0.16 - i * 0.03 : 0.3;
    tone(1750, 820, at, len, 0.13, 'sawtooth');
    tone(2600, 1300, at + 0.02, len * 0.7, 0.05, 'square');
    noiseSweep(3200, 900, len, 0.06, 0.8);
  }
}

// --- Tiempo (plan 029 T268) ------------------------------------------------

let bedNoise: AudioBuffer | null = null;

/** 2 s de ruido para los fondos en bucle (más largo que el del golpe: no se oye el empalme). */
function bedBuffer(ctx: AudioContext): AudioBuffer {
  if (!bedNoise) {
    const n = Math.round(ctx.sampleRate * 2);
    bedNoise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = bedNoise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  return bedNoise;
}

/**
 * Trueno sintetizado: retumbo grave de ruido filtrado que crece y se va
 * despacio; los fuertes, con un chasquido delante. `strength` 0..1.
 */
export function thunder(strength = 1): void {
  if (gains.sfx === 0) return;
  const a = live();
  if (!a) return;
  const k = Math.min(1, Math.max(0.2, strength));
  const t = a.ctx.currentTime;
  const length = 2.2 + k * 1.3;
  try {
    const src = a.ctx.createBufferSource();
    src.buffer = bedBuffer(a.ctx);
    src.loop = true;
    const low = a.ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.Q.value = 0.7;
    low.frequency.setValueAtTime(420 * k + 120, t);
    low.frequency.exponentialRampToValueAtTime(70, t + length);
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * k, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.22 * k, t + length * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.connect(low).connect(g).connect(a.sfx);
    src.start(t);
    src.stop(t + length + 0.05);
  } catch {
    // Sin búfer: la tormenta sigue muda.
  }
  if (k > 0.8) noiseSweep(2400, 300, 0.3, 0.16 * k, 0.6);
}

/** El fondo de cada tiempo: lluvia, viento de levante o la brisa caliente de la calima. */
export type WeatherBed = 'lluvia' | 'viento' | 'brisa';

const BEDS: Record<WeatherBed, { type: BiquadFilterType; hz: number; q: number; level: number }> = {
  lluvia: { type: 'highpass', hz: 1400, q: 0.4, level: 0.12 },
  viento: { type: 'bandpass', hz: 520, q: 0.9, level: 0.16 },
  brisa: { type: 'bandpass', hz: 340, q: 0.8, level: 0.07 },
};

let bed: {
  kind: WeatherBed;
  ctx: AudioContext;
  source: AudioBufferSourceNode;
  gain: GainNode;
  lfo: OscillatorNode | undefined;
} | null = null;

/**
 * Pone (o, con null, quita) el fondo del tiempo con un fundido de `fadeS`
 * s. Va al canal de efectos. Si el audio aún no está desbloqueado, no suena.
 */
export function setWeatherBed(kind: WeatherBed | null, fadeS = 3): void {
  const fade = Math.max(0.05, fadeS);
  if (bed && bed.kind !== kind) {
    const old = bed;
    bed = null;
    try {
      const now = old.ctx.currentTime;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + fade);
      old.source.stop(now + fade + 0.05);
      old.lfo?.stop(now + fade + 0.05);
    } catch {
      // Ya parado.
    }
  }
  if (!kind || bed) return;
  if (gains.sfx === 0) return;
  const a = live();
  if (!a) return;
  const spec = BEDS[kind];
  try {
    const now = a.ctx.currentTime;
    const source = a.ctx.createBufferSource();
    source.buffer = bedBuffer(a.ctx);
    source.loop = true;
    const filter = a.ctx.createBiquadFilter();
    filter.type = spec.type;
    filter.frequency.value = spec.hz;
    filter.Q.value = spec.q;
    const gain = a.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(spec.level, now + fade);
    source.connect(filter).connect(gain).connect(a.sfx);
    let lfo: OscillatorNode | undefined;
    if (kind !== 'lluvia') {
      // El viento va y viene: el filtro sube y baja despacio.
      lfo = a.ctx.createOscillator();
      lfo.frequency.value = kind === 'viento' ? 0.18 : 0.09;
      const depth = a.ctx.createGain();
      depth.gain.value = spec.hz * 0.45;
      lfo.connect(depth).connect(filter.frequency);
      lfo.start(now);
    }
    source.start(now);
    bed = { kind, ctx: a.ctx, source, gain, lfo };
  } catch {
    // Sin búfer: el tiempo sigue mudo.
  }
}

/** El fondo de cada episodio del tiempo. */
export const WEATHER_BEDS: Record<WeatherKind, WeatherBed> = {
  levante: 'viento',
  tormenta: 'lluvia',
  calima: 'brisa',
};

/** s del fundido de entrada del fondo (el del episodio, `WEATHER_TUNING.fade`). */
const BED_FADE_IN = 4;

/** Lo que suena con cada aviso del tiempo del mar 3D (T268). */
export function weatherSound(e: WeatherEvent): void {
  if (e.type === 'start') setWeatherBed(WEATHER_BEDS[e.kind], BED_FADE_IN);
  else if (e.type === 'ending') setWeatherBed(null, e.fadeS);
  else if (e.type === 'end') setWeatherBed(null, 0.5);
  else if (e.type === 'thunder') thunder(e.strength);
}

/** El fondo que suena ahora (para las pruebas). */
export function weatherBed(): WeatherBed | null {
  return bed?.kind ?? null;
}

/** Cada sonido de serie que un comportamiento puede declarar (REQ-PRO-011). */
export const SOUNDS: Record<FeedbackSound, (strength?: number) => void> = {
  ping,
  whoosh,
  bump,
  plop,
  chime,
  fanfare,
};

export function playSound(id: FeedbackSound, strength?: number): void {
  SOUNDS[id](strength);
}
