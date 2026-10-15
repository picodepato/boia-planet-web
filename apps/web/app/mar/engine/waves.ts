import { WIND_DIR } from './weather';
import { wrapD } from './wrap';

/**
 * El oleaje suave de `/mar` (plan 032 T298, REQ-MUN-003): unas pocas olas
 * direccionales sumadas, alineadas con el viento, que levantan de verdad la
 * malla del agua (`water.ts`) y mecen el barco (cabeceo y balanceo según la
 * pendiente bajo el casco). Sólo se ve: la simulación, los choques, la ola
 * grande (T269) y la cámara no lo saben. Se calma cerca de las islas y los
 * muelles, y desaparece con `prefers-reduced-motion`, en la vista de mapa y en
 * calidad `baja`.
 *
 * Sin three.js ni DOM: las mismas cuentas sirven al shader (que se genera
 * desde estas constantes, `WAVES_GLSL`) y al barco, y se prueban solas.
 * Medidas en unidades de escena (el barco mide unas 3). Todo `muestra`.
 */

/**
 * EL INTERRUPTOR. `false` deja el mar y el barco exactamente como antes de
 * T298 (agua plana, sin código de olas en el shader, el barco con su vaivén
 * de siempre). Una línea para apagarlo si la prueba a mano encuentra algo.
 */
export const LIVELY_SEA = true;

export interface SeaWave {
  /** Dirección hacia la que avanza (unitaria, en x/z de escena). */
  dx: number;
  dz: number;
  /** Longitud de onda (escena). */
  length: number;
  /** Altura de la cresta sobre el nivel medio (escena). */
  amp: number;
  /** Periodo (s de agua). */
  period: number;
  /** Desfase (rad), para que no coincidan las crestas. */
  phase: number;
}

function wave(turn: number, length: number, amp: number, period: number, phase: number): SeaWave {
  const a = Math.atan2(WIND_DIR.y, WIND_DIR.x) + turn;
  return { dx: Math.cos(a), dz: Math.sin(a), length, amp, period, phase };
}

/** Tres olas a favor del viento (la mayor, recta; las otras, abiertas). muestra */
export const SEA_WAVES: readonly SeaWave[] = [
  wave(0, 26, 0.2, 4.6, 0),
  wave(0.5, 17, 0.12, 3.6, 1.7),
  wave(-0.8, 11, 0.06, 2.8, 4.1),
];

/** Lo más alto que puede subir el agua con amplitud 1 (la suma de las crestas). */
export const SEA_WAVE_MAX = SEA_WAVES.reduce((s, w) => s + w.amp, 0);

/** Distancia a la orilla (escena) a la que el agua ya está quieta y a la que ya se mueve entera. muestra */
export const CALM_NEAR = 1;
export const CALM_FAR = 15;

/** Topes del barco (rad): un vaivén que se nota y no marea. muestra */
export const MAX_PITCH = 0.08;
export const MAX_ROLL = 0.1;

/** Con viento (Levante, tormenta) las olas crecen algo, como mucho este tanto más. muestra */
export const WIND_SWELL = 0.5;

const TAU = Math.PI * 2;

export interface WaveSample {
  /** Altura del agua (escena). */
  h: number;
  /** Pendiente: dh/dx y dh/dz. */
  gx: number;
  gz: number;
}

/**
 * Altura y pendiente del agua en (x, z) a los `t` s de agua, con la amplitud
 * `amp` (0: plano). Determinista: lo mismo en cada llamada y en el shader.
 */
export function waveAt(x: number, z: number, t: number, amp: number): WaveSample {
  if (amp <= 0) return { h: 0, gx: 0, gz: 0 };
  let h = 0;
  let gx = 0;
  let gz = 0;
  for (const w of SEA_WAVES) {
    const k = TAU / w.length;
    const ph = k * (w.dx * x + w.dz * z) - (TAU / w.period) * t + w.phase;
    const c = Math.cos(ph) * w.amp * k;
    h += Math.sin(ph) * w.amp;
    gx += c * w.dx;
    gz += c * w.dz;
  }
  return { h: h * amp, gx: gx * amp, gz: gz * amp };
}

function smoothstep(a: number, b: number, x: number): number {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/** Cuánto oleaje hay a `d` (escena) de la orilla más cercana: 0 pegado a ella, 1 en mar abierto. */
export function shoreCalm(d: number): number {
  return smoothstep(CALM_NEAR, CALM_FAR, d);
}

/** Distancia (escena) de (x, z) al borde de la orilla más cercana; el mar da la vuelta (`period`). */
export function shoreDistance(
  x: number,
  z: number,
  shores: readonly { x: number; z: number; r: number }[],
  period: { w: number; h: number },
): number {
  let d = Infinity;
  for (const s of shores) {
    const dd = Math.hypot(wrapD(s.x - x, period.w), wrapD(s.z - z, period.h)) - s.r;
    if (dd < d) d = dd;
  }
  return d;
}

/**
 * La amplitud de este fotograma (0…1 + viento): 0 con el interruptor apagado,
 * con movimiento reducido o en la vista de mapa (`mapK` 1); crece con el viento.
 */
export function waveAmplitude(o: {
  on: boolean;
  reduced: boolean;
  /** 0 de cerca, 1 en la vista de mapa. */
  mapK: number;
  /** Rayas de viento del tiempo (0…1). */
  wind: number;
}): number {
  if (!o.on || o.reduced) return 0;
  const k = 1 - Math.max(0, Math.min(1, o.mapK));
  return k * (1 + WIND_SWELL * Math.max(0, Math.min(1, o.wind)));
}

export interface BoatRock {
  /** Lo que sube o baja el barco con el agua (escena). */
  heave: number;
  /** Cabeceo (rad, + proa arriba: `rotation.z` del cuerpo). */
  pitch: number;
  /** Balanceo (rad: `rotation.x` del cuerpo). */
  roll: number;
}

export const NO_ROCK: BoatRock = Object.freeze({ heave: 0, pitch: 0, roll: 0 });

/**
 * El barco sobre las olas: sube con el agua bajo el casco y se inclina con su
 * pendiente, a lo largo (cabeceo) y de lado (balanceo), con topes. `heading`
 * en rad (proa hacia (cos, sin) en x/z); `amp` ya lleva la calma de la orilla
 * y lo que esté en el aire.
 */
export function boatRock(x: number, z: number, heading: number, t: number, amp: number): BoatRock {
  if (amp <= 0) return NO_ROCK;
  const w = waveAt(x, z, t, amp);
  const fx = Math.cos(heading);
  const fz = Math.sin(heading);
  const along = w.gx * fx + w.gz * fz;
  // El costado (eje z local del cuerpo con `rotation.y = -heading`): (-sin, cos).
  const side = -w.gx * fz + w.gz * fx;
  const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  return {
    heave: w.h,
    pitch: clamp(Math.atan(along), MAX_PITCH),
    roll: clamp(-Math.atan(side), MAX_ROLL),
  };
}

const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : String(n));

/**
 * GLSL de las olas, generado desde `SEA_WAVES` (el shader y el barco no
 * pueden desacordarse). `seaWave(p, t, spacing)` devuelve (altura, dh/dx,
 * dh/dz) con amplitud 1; cada ola se apaga cuando `spacing` (lo que mide un
 * vértice o un píxel, escena) ya no la puede dibujar sin dientes.
 */
export const WAVES_GLSL = /* glsl */ `
  vec3 seaWave(vec2 p, float t, float spacing) {
    vec3 r = vec3(0.0);
    float k; float ph; float fade;
${SEA_WAVES.map((w) => {
  const k = TAU / w.length;
  return `    k = ${f(k)};
    fade = 1.0 - smoothstep(${f(w.length * 0.25)}, ${f(w.length * 0.5)}, spacing);
    ph = k * dot(vec2(${f(w.dx)}, ${f(w.dz)}), p) - ${f(TAU / w.period)} * t + ${f(w.phase)};
    r += fade * ${f(w.amp)} * vec3(sin(ph), k * cos(ph) * vec2(${f(w.dx)}, ${f(w.dz)}));`;
}).join('\n')}
    return r;
  }
  float seaCalm(float d) { return smoothstep(${f(CALM_NEAR)}, ${f(CALM_FAR)}, d); }
`;
