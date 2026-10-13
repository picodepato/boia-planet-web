/**
 * El puente entre la radio (plan 022 T247) y el sonido del juego, sin que
 * ninguno importe al otro: `sound.ts` (el ambiente de `/mar`) y la landing
 * lo cargan siempre, el reproductor sólo cuando se toca. Dos señales:
 *
 * - `radioPlaying`: la radio suena → el loop de ambiente del mundo se calla
 *   (vuelve al parar la radio).
 * - `musicEnabled`: el interruptor «Música» de Ajustes (T236) y el 🔊 de la
 *   cabecera: apagado, la radio se calla también; encendido, sigue.
 */

type Listener = () => void;

let playing = false;
let musicEnabled = true;
const playingListeners = new Set<Listener>();
const musicListeners = new Set<Listener>();

export function radioPlaying(): boolean {
  return playing;
}

export function setRadioPlaying(on: boolean): void {
  if (playing === on) return;
  playing = on;
  for (const l of [...playingListeners]) l();
}

export function onRadioPlaying(l: Listener): () => void {
  playingListeners.add(l);
  return () => playingListeners.delete(l);
}

export function musicEnabledForRadio(): boolean {
  return musicEnabled;
}

/** Ajustes (o el 🔊 de la landing) dicen si la música puede sonar. */
export function setMusicEnabledForRadio(on: boolean): void {
  if (musicEnabled === on) return;
  musicEnabled = on;
  for (const l of [...musicListeners]) l();
}

export function onMusicEnabledForRadio(l: Listener): () => void {
  musicListeners.add(l);
  return () => musicListeners.delete(l);
}

// --- Por dónde va la canción (plan 029 T270): el compás del cangrejo bailarín.
// El reproductor lo apunta en cada `timeupdate`; entre dos avisos se extrapola
// con el reloj (`now`), sin que el motor toque el audio ni el reproductor.

let elapsedAt: { elapsed: number; at: number } | null = null;

/** El reproductor dice por dónde va la canción (s). */
export function setRadioElapsed(elapsed: number, at: number = performance.now()): void {
  elapsedAt = { elapsed, at };
}

/** Si suena la radio y los s de canción ahora (extrapolados), o null si no suena. */
export function radioBeat(
  now: number = performance.now(),
): { playing: boolean; elapsed: number } | null {
  if (!playing || !elapsedAt) return null;
  return { playing: true, elapsed: elapsedAt.elapsed + Math.max(0, now - elapsedAt.at) / 1000 };
}

/** Sólo pruebas. */
export function resetRadioBridge(): void {
  playing = false;
  musicEnabled = true;
  elapsedAt = null;
  playingListeners.clear();
  musicListeners.clear();
}
