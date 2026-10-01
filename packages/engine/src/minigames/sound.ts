import type { SimEvent } from './types';

/**
 * Efectos de los minijuegos, sintetizados (no hay audio grabado aún). Todo
 * lo que suena también se ve: el estado se entiende sin audio (REQ-AVE-039).
 */

let audio: AudioContext | null = null;

function ctx(): AudioContext | null {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    return audio;
  } catch {
    return null;
  }
}

function tone(
  from: number,
  to: number,
  at: number,
  length: number,
  peak: number,
  type: OscillatorType,
) {
  const a = ctx();
  if (!a || peak <= 0) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + length * 0.8);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + length + 0.02);
}

/** Suena un evento a `volume` (0..1). */
export function playCue(kind: SimEvent['kind'], volume: number): void {
  const v = Math.max(0, Math.min(1, volume)) * 0.2;
  if (v <= 0) return;
  switch (kind) {
    case 'hit':
    case 'scare':
      tone(520, 880, 0, 0.16, v, 'triangle');
      tone(780, 1180, 0.1, 0.18, v, 'triangle');
      break;
    case 'flash':
      tone(300, 1200, 0, 0.3, v, 'sine');
      break;
    case 'wave':
      tone(440, 440, 0, 0.12, v, 'triangle');
      tone(550, 550, 0.12, 0.12, v, 'triangle');
      tone(660, 660, 0.24, 0.2, v, 'triangle');
      break;
    case 'miss':
    case 'false_alarm':
      tone(220, 180, 0, 0.3, v, 'square');
      break;
    case 'escape':
      tone(600, 240, 0, 0.35, v, 'sine');
      break;
    case 'fire':
      tone(160, 60, 0, 0.18, v * 1.2, 'sine');
      break;
    case 'splash':
      tone(900, 200, 0, 0.22, v * 0.7, 'sine');
      break;
    case 'end':
      tone(660, 660, 0, 0.14, v, 'triangle');
      tone(990, 990, 0.14, 0.24, v, 'triangle');
      break;
    default:
      break;
  }
}
