'use client';

import { type Settings, channelGain } from '@boia/engine/ui';
import type { FeedbackSound } from '@boia/world';
import { AMBIENT_LEVEL, AMBIENT_RATE, renderAmbient } from './ambient';

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

/** Mundo cuyo loop debe sonar (null: ninguno, p. ej. fuera de /juego). */
let ambientWorld: string | null = null;
let ambient: { world: string; source: AudioBufferSourceNode; gain: GainNode } | null = null;
const ambientBuffers = new Map<string, AudioBuffer>();

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
  const want = g && gains.music > 0 ? ambientWorld : null;
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
