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

/** Sólo pruebas. */
export function resetRadioBridge(): void {
  playing = false;
  musicEnabled = true;
  playingListeners.clear();
  musicListeners.clear();
}
