/**
 * El canal «Música» de los ajustes guardados (`boia.ajustes`, los de
 * `@boia/engine/ui`), leído y escrito a mano como hace `sound-pref.ts` con
 * el 🔊 de la cabecera, pero desde el trozo perezoso de la radio (plan 022
 * T247): la landing no carga esto en su ruta crítica.
 */

/** = `MUSIC_SETTINGS_KEY` de `sound-pref.ts` (lo comprueba music-setting.test.ts); aquí a mano para no pedirle nada al trozo de la landing. */
export const MUSIC_SETTINGS_KEY = 'boia.ajustes';

type Raw = Record<string, unknown>;

function parse(text: string | null): Raw {
  if (!text) return {};
  try {
    const v: unknown = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {};
  } catch {
    return {};
  }
}

const obj = (v: unknown): Raw =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {};

/** ¿Está encendida la música (sólo ese canal)? Por defecto, sí. */
export function musicOn(text: string | null): boolean {
  const e = obj(parse(text).music).enabled;
  return typeof e === 'boolean' ? e : true;
}

/** Los mismos ajustes con la música encendida o apagada (los efectos, como estaban). */
export function withMusic(text: string | null, on: boolean): string {
  const s = parse(text);
  return JSON.stringify({ ...s, music: { ...obj(s.music), enabled: on } });
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** ¿La música está encendida en los ajustes guardados? */
export function readMusicOn(): boolean {
  return musicOn(storage()?.getItem(MUSIC_SETTINGS_KEY) ?? null);
}

/** La radio va a sonar: enciende «Música» si estaba apagada y avisa a la cabecera. */
export function enableMusic(): void {
  const store = storage();
  if (!store) return;
  const text = store.getItem(MUSIC_SETTINGS_KEY);
  if (musicOn(text)) return;
  try {
    store.setItem(MUSIC_SETTINGS_KEY, withMusic(text, true));
    // El 🔊 de la cabecera escucha `storage` con esta clave (sound-pref.ts):
    // un aviso igual al de otra pestaña, sin añadir nada a la ruta crítica.
    window.dispatchEvent(new StorageEvent('storage', { key: MUSIC_SETTINGS_KEY }));
  } catch {
    return;
  }
}
