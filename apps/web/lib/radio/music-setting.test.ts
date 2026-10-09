import { describe, expect, it } from 'vitest';
import { SOUND_SETTINGS_KEY, withSound } from '../landing/sound-pref';
import { MUSIC_SETTINGS_KEY, musicOn, withMusic } from './music-setting';

/** «Música» de los ajustes guardados, desde la radio (plan 022 T247). */
describe('radio: el canal «Música» de boia.ajustes', () => {
  it('escribe en la misma clave que el 🔊 de la cabecera', () => {
    expect(MUSIC_SETTINGS_KEY).toBe(SOUND_SETTINGS_KEY);
  });

  it('por defecto está encendida; lee lo guardado', () => {
    expect(musicOn(null)).toBe(true);
    expect(musicOn('{}')).toBe(true);
    expect(musicOn('no es json')).toBe(true);
    expect(musicOn(JSON.stringify({ music: { enabled: false } }))).toBe(false);
    expect(musicOn(withSound(null, false))).toBe(false);
  });

  it('la enciende sin tocar los efectos ni el resto', () => {
    const before = JSON.stringify({
      language: 'es',
      music: { enabled: false, volume: 0.4 },
      sfx: { enabled: false, volume: 0.9 },
    });
    const after = JSON.parse(withMusic(before, true)) as Record<string, unknown>;
    expect(after).toEqual({
      language: 'es',
      music: { enabled: true, volume: 0.4 },
      sfx: { enabled: false, volume: 0.9 },
    });
    expect(musicOn(withMusic(null, false))).toBe(false);
  });
});
