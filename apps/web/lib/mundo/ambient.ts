/**
 * Música de ambiente generada (O10, `muestra`): un loop por mundo, calculado
 * en el navegador hasta que haya música con licencia (P18). Sin Web Audio ni
 * DOM: devuelve las muestras y `sound.ts` las pone a sonar en bucle.
 *
 * Cada mundo saca de su id una tónica, una progresión de cuatro acordes y
 * unas notas de campana. El loop empalma sin chasquido: cada voz se calcula
 * con el tiempo dado la vuelta al final del bucle, así lo que suena al
 * acabar sigue exactamente al volver a empezar.
 */

/** Nivel del loop dentro del canal de música: arranca al 30 % (O10). */
export const AMBIENT_LEVEL = 0.3;
/** s del loop: cuatro acordes de 4 s. muestra */
export const AMBIENT_SECONDS = 16;
/** Muestras por segundo del loop (el contexto lo remuestrea). muestra */
export const AMBIENT_RATE = 22050;
/** Pico del loop antes del nivel y del volumen del canal. */
export const AMBIENT_PEAK = 0.8;

/** Tónicas posibles (Hz): Re3, Mi3, Fa3, Sol3, La3. */
const ROOTS = [146.83, 164.81, 174.61, 196, 220];
/** Progresiones de cuatro acordes, en semitonos desde la tónica. */
const PROGRESSIONS = [
  [
    [0, 4, 7],
    [-3, 0, 4],
    [-7, -3, 0],
    [-5, -1, 2],
  ],
  [
    [0, 4, 7],
    [-5, -1, 2],
    [-3, 0, 4],
    [-7, -3, 0],
  ],
  [
    [0, 4, 7],
    [2, 5, 9],
    [-3, 0, 4],
    [-7, -3, 0],
  ],
  [
    [0, 3, 7],
    [-4, 0, 3],
    [-2, 2, 5],
    [-5, -2, 2],
  ],
];
/** Pentatónica para las campanas, en semitonos. */
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16];

export interface AmbientRecipe {
  /** Hz de la tónica. */
  root: number;
  /** Cuatro acordes, en semitonos desde la tónica. */
  chords: number[][];
  /** Campanas: segundo de inicio y semitono. */
  bells: { at: number; semitone: number }[];
}

/** FNV-1a de 32 bits: la misma semilla para el mismo id de mundo. */
export function worldSeed(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function random(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function ambientRecipe(worldId: string): AmbientRecipe {
  const rnd = random(worldSeed(worldId));
  const root = ROOTS[Math.floor(rnd() * ROOTS.length)]!;
  const chords = PROGRESSIONS[Math.floor(rnd() * PROGRESSIONS.length)]!;
  const bells: AmbientRecipe['bells'] = [];
  const count = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < count; i++) {
    bells.push({
      at: rnd() * AMBIENT_SECONDS,
      semitone: 12 + PENTATONIC[Math.floor(rnd() * PENTATONIC.length)]!,
    });
  }
  return { root, chords, bells };
}

const hz = (root: number, semitone: number) => root * 2 ** (semitone / 12);

/** Envolvente del pad: sube 1,5 s, se mantiene y se apaga del todo a los 6 s. */
function padEnvelope(tau: number): number {
  const attack = 1.5;
  const length = 6;
  if (tau < attack) return Math.sin((tau / attack) * (Math.PI / 2)) ** 2;
  if (tau < 4) return 1;
  return Math.max(0, 1 - (tau - 4) / (length - 4)) ** 2;
}

/** Campana: ataque corto, cola exponencial, a cero antes de 3 s. */
function bellEnvelope(tau: number): number {
  const length = 3;
  if (tau >= length) return 0;
  const attack = Math.min(1, tau / 0.01);
  return attack * Math.exp(-tau * 2.2) * (1 - tau / length);
}

/**
 * Muestras del loop de un mundo, mono, con pico `AMBIENT_PEAK`. Mismo id,
 * mismas muestras.
 */
export function renderAmbient(
  worldId: string,
  sampleRate = AMBIENT_RATE,
  seconds = AMBIENT_SECONDS,
): Float32Array {
  const recipe = ambientRecipe(worldId);
  const n = Math.round(sampleRate * seconds);
  const loop = n / sampleRate;
  const out = new Float32Array(n);
  const TAU = Math.PI * 2;
  const chordLength = loop / recipe.chords.length;

  // Cada voz: inicio, frecuencia, nivel, ventana y envolvente.
  const voices: {
    start: number;
    f: number;
    level: number;
    window: number;
    env: (t: number) => number;
  }[] = [];
  recipe.chords.forEach((chord, k) => {
    for (const semi of chord) {
      const f = hz(recipe.root, semi);
      // Dos osciladores apenas desafinados: el pad respira.
      voices.push({
        start: k * chordLength,
        f: f * 0.997,
        level: 0.5,
        window: 6,
        env: padEnvelope,
      });
      voices.push({
        start: k * chordLength,
        f: f * 1.003,
        level: 0.5,
        window: 6,
        env: padEnvelope,
      });
    }
    // Bajo: la nota más grave del acorde, una octava abajo.
    const low = hz(recipe.root, Math.min(...chord) - 12);
    voices.push({ start: k * chordLength, f: low, level: 0.6, window: 6, env: padEnvelope });
  });
  for (const b of recipe.bells) {
    voices.push({
      start: b.at,
      f: hz(recipe.root, b.semitone),
      level: 0.35,
      window: 3,
      env: bellEnvelope,
    });
  }

  for (const v of voices) {
    const w = TAU * v.f;
    for (let i = 0; i < n; i++) {
      // Tiempo desde el inicio de la voz, dando la vuelta al loop: continuo en el empalme.
      let tau = i / sampleRate - v.start;
      if (tau < 0) tau += loop;
      if (tau >= v.window) continue;
      out[i]! += v.level * v.env(tau) * Math.sin(w * tau);
    }
  }

  // Oleaje: ruido muy filtrado con una ola cada 8 s (divide el loop: empalma).
  const rnd = random(worldSeed(worldId) ^ 0x5eed);
  const noise = new Float32Array(n);
  for (let i = 0; i < n; i++) noise[i] = rnd() * 2 - 1;
  const k = 1 - Math.exp((-TAU * 220) / sampleRate);
  let y = 0;
  // Dos pasadas: en la segunda, el filtro llega al inicio con el estado del final.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      y += k * (noise[i]! - y);
      if (pass === 1) {
        const swell = 0.5 - 0.5 * Math.cos((TAU * i) / (n / 2));
        out[i]! += y * 1.6 * (0.25 + 0.75 * swell);
      }
    }
  }

  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]!));
  if (peak > 0) {
    const g = AMBIENT_PEAK / peak;
    for (let i = 0; i < n; i++) out[i]! *= g;
  }
  return out;
}
