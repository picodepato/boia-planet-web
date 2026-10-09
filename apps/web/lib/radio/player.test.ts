import type { RadioCatalog, RadioSong } from '@boia/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  musicEnabledForRadio,
  radioPlaying,
  resetRadioBridge,
  setMusicEnabledForRadio,
} from './bridge';
import { SAMPLE_RADIO_CATALOG } from './muestra';
import { RADIO_SESSION_KEY, type RadioAudio, RadioPlayer, type RadioPlayerDeps } from './player';

/**
 * El reproductor sin navegador (plan 022 T247): un `<audio>` de mentira que
 * avisa de lo que se le pide (play, pause, ended…), un catálogo de muestra y
 * un azar fijo. Se comprueba el orden (la primera, luego al azar sin
 * repetir), aleatorio y repetir, el aviso «Sonando» sólo con el reproductor
 * cerrado, la precarga al final y el enlace con «Música» de Ajustes.
 */

class FakeAudio implements RadioAudio {
  src = '';
  preload = '';
  volume = 1;
  currentTime = 0;
  duration = Number.NaN;
  paused = true;
  plays = 0;
  /** `play()` rechaza (el navegador bloquea sin gesto). */
  blocked = false;
  private handlers = new Map<string, Set<() => void>>();

  async play(): Promise<void> {
    if (this.blocked) throw new Error('NotAllowedError');
    this.paused = false;
    this.plays += 1;
    this.emit('play');
    this.emit('playing');
  }
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.emit('pause');
  }
  addEventListener(type: string, fn: () => void): void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn);
  }
  removeEventListener(type: string, fn: () => void): void {
    this.handlers.get(type)?.delete(fn);
  }
  emit(type: string): void {
    for (const fn of [...(this.handlers.get(type) ?? [])]) fn();
  }
  /** Avanza hasta `t` segundos (con la duración conocida). */
  at(t: number, duration: number): void {
    this.duration = duration;
    this.currentTime = t;
    this.emit('timeupdate');
  }
  end(): void {
    this.paused = true;
    this.emit('ended');
  }
}

class MemoryStorage {
  map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

function seeded(seed: number): () => number {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

function setup(opts: { catalog?: RadioCatalog; storage?: MemoryStorage; block?: boolean } = {}) {
  const audios: FakeAudio[] = [];
  const enabled: number[] = [];
  const deps: RadioPlayerDeps = {
    createAudio: () => {
      const a = new FakeAudio();
      a.blocked = opts.block ?? false;
      audios.push(a);
      return a;
    },
    loadCatalog: async () => opts.catalog ?? SAMPLE_RADIO_CATALOG,
    songUrl: async (s: RadioSong) => s.src,
    random: seeded(11),
    storage: opts.storage ?? null,
    enableMusic: () => {
      enabled.push(1);
    },
  };
  const player = new RadioPlayer(deps);
  const current = () => audios[audios.length - 1]!;
  return { player, audios, current, enabled };
}

const first = SAMPLE_RADIO_CATALOG.songs.find((s) => s.first)!;

describe('RadioPlayer (plan 022 T247)', () => {
  let p: ReturnType<typeof setup>;
  beforeEach(() => {
    resetRadioBridge();
  });
  afterEach(() => {
    p?.player.dispose();
  });

  it('el primer toque enciende la radio con la primera del catálogo, sin precargar', async () => {
    p = setup();
    expect(p.player.getState().status).toBe('idle');
    await p.player.tapButton();
    const st = p.player.getState();
    expect(st.status).toBe('playing');
    expect(st.song?.id).toBe(first.id);
    expect(p.audios).toHaveLength(1);
    expect(p.current().preload).toBe('none');
    expect(p.current().src).toBe(first.src);
    expect(radioPlaying()).toBe(true);
  });

  it('el segundo toque abre el reproductor (y el tercero lo cierra), sin tocar la música', async () => {
    p = setup();
    await p.player.tapButton();
    await p.player.tapButton();
    expect(p.player.getState().open).toBe(true);
    expect(p.player.getState().status).toBe('playing');
    await p.player.tapButton();
    expect(p.player.getState().open).toBe(false);
    // En pausa, el botón vuelve a ponerla en vez de abrir.
    p.player.pause();
    await p.player.tapButton();
    expect(p.player.getState().status).toBe('playing');
    expect(p.player.getState().open).toBe(false);
  });

  it('al acabar cada canción sigue otra al azar, nunca la que acaba de sonar', async () => {
    p = setup();
    await p.player.start();
    const ids: string[] = [];
    for (let i = 0; i < 30; i++) {
      const before = p.player.getState().song!.id;
      p.current().end();
      await flush();
      const after = p.player.getState().song!.id;
      expect(after).not.toBe(before);
      expect(p.player.getState().status).toBe('playing');
      ids.push(after);
    }
    expect(new Set(ids).size).toBeGreaterThan(10);
  });

  it('la siguiente se decide y se precarga sólo cerca del final', async () => {
    p = setup();
    await p.player.start();
    const el = p.current();
    el.at(5, 30);
    await flush();
    expect(p.audios).toHaveLength(1);
    el.at(24, 30);
    await flush();
    expect(p.audios).toHaveLength(2);
    const pre = p.audios[1]!;
    expect(pre.preload).toBe('auto');
    expect(pre.src).not.toBe(first.src);
    // Al acabar suena justo la precargada.
    el.end();
    await flush();
    expect(p.current()).toBe(pre);
    expect(pre.plays).toBe(1);
    expect(p.player.getState().song?.src).toBe(pre.src);
  });

  it('sin aleatorio va en orden; con «repetir esta» vuelve la misma; «sin repetir» se para al final', async () => {
    const songs = SAMPLE_RADIO_CATALOG.songs
      .slice(0, 3)
      .map((s, i) => ({ ...s, order: i, first: i === 0 }));
    p = setup({ catalog: { genres: SAMPLE_RADIO_CATALOG.genres, songs } });
    await p.player.start();
    p.player.setShuffle(false);
    p.current().end();
    await flush();
    expect(p.player.getState().song?.id).toBe(songs[1]!.id);
    p.player.setRepeat('one');
    const el = p.current();
    el.end();
    await flush();
    expect(p.player.getState().song?.id).toBe(songs[1]!.id);
    expect(el.plays).toBe(2);
    p.player.setRepeat('off');
    p.current().end();
    await flush();
    expect(p.player.getState().song?.id).toBe(songs[2]!.id);
    p.current().end();
    await flush();
    expect(p.player.getState().status).toBe('stopped');
    expect(radioPlaying()).toBe(false);
  });

  it('el aviso «Sonando» sólo cuando cambia la canción con el reproductor cerrado', async () => {
    p = setup();
    await p.player.start();
    const t1 = p.player.getState().toast;
    expect(t1?.song.id).toBe(first.id);
    p.current().end();
    await flush();
    const t2 = p.player.getState().toast;
    expect(t2?.key).not.toBe(t1?.key);
    expect(t2?.song.id).toBe(p.player.getState().song?.id);
    p.player.open();
    expect(p.player.getState().toast).toBeNull();
    p.current().end();
    await flush();
    expect(p.player.getState().toast).toBeNull();
    p.player.close();
    p.current().end();
    await flush();
    expect(p.player.getState().toast?.song.id).toBe(p.player.getState().song?.id);
  });

  it('pausa, play, parar y elegir una canción de la lista', async () => {
    p = setup();
    await p.player.start();
    p.player.pause();
    expect(p.player.getState().status).toBe('paused');
    expect(radioPlaying()).toBe(false);
    await p.player.play();
    expect(p.player.getState().status).toBe('playing');
    p.current().currentTime = 12;
    p.player.stop();
    expect(p.player.getState().status).toBe('stopped');
    expect(p.current().currentTime).toBe(0);
    const other = SAMPLE_RADIO_CATALOG.songs[7]!;
    await p.player.playSong(other.id);
    expect(p.player.getState().song?.id).toBe(other.id);
    expect(p.player.getState().status).toBe('playing');
  });

  it('«Música» apagada en Ajustes calla la radio; encendida, sigue; play a mano la enciende', async () => {
    p = setup();
    await p.player.start();
    setMusicEnabledForRadio(false);
    expect(p.player.getState().status).toBe('paused');
    expect(p.current().paused).toBe(true);
    setMusicEnabledForRadio(true);
    await flush();
    expect(p.player.getState().status).toBe('playing');
    setMusicEnabledForRadio(false);
    await p.player.play();
    expect(p.enabled).toHaveLength(1);
    expect(musicEnabledForRadio()).toBe(true);
    expect(p.player.getState().status).toBe('playing');
  });

  it('el filtro de género manda en la siguiente', async () => {
    p = setup();
    await p.player.start();
    const genre = SAMPLE_RADIO_CATALOG.genres[1]!.id;
    p.player.setGenre(genre);
    for (let i = 0; i < 10; i++) {
      p.current().end();
      await flush();
      expect(p.player.getState().song?.genreId).toBe(genre);
    }
  });

  it('sólo guarda los Ajustes: nunca la canción, el segundo ni «sonando»', async () => {
    const storage = new MemoryStorage();
    p = setup({ storage });
    await p.player.start();
    p.player.setVolume(0.3);
    p.current().at(2.5, 30);
    p.player.saveNow();
    const saved = JSON.parse(storage.getItem(RADIO_SESSION_KEY)!) as Record<string, unknown>;
    expect(saved).not.toHaveProperty('songId');
    expect(saved).not.toHaveProperty('elapsed');
    expect(saved).not.toHaveProperty('playing');
    expect(saved.volume).toBe(0.3);
    p.player.dispose();
  });

  it('una página nueva arranca apagada, con los Ajustes guardados; datos viejos con canción se ignoran', async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      RADIO_SESSION_KEY,
      JSON.stringify({
        songId: first.id,
        elapsed: 12,
        playing: true,
        volume: 0.3,
        shuffle: false,
        repeat: 'one',
        genreId: null,
      }),
    );
    p = setup({ storage });
    await flush();
    await flush();
    const st = p.player.getState();
    expect(st.song).toBeNull();
    expect(st.status).toBe('idle');
    expect(st.toast).toBeNull();
    expect(st.volume).toBe(0.3);
    expect(st.shuffle).toBe(false);
    expect(st.repeat).toBe('one');
    expect(p.audios).toHaveLength(0);
  });

  it('tras cargar la página, play arranca la primera canción desde el principio', async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      RADIO_SESSION_KEY,
      JSON.stringify({ songId: 'otra', elapsed: 40, playing: true, volume: 0.5 }),
    );
    p = setup({ storage });
    await p.player.play();
    const st = p.player.getState();
    expect(st.song?.id).toBe(first.id);
    expect(st.elapsed).toBe(0);
    expect(st.status).toBe('playing');
    expect(p.current().currentTime).toBe(0);
    expect(p.current().volume).toBe(0.5);
  });
});
