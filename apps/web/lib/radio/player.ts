import type { RadioCatalog, RadioSong } from '@boia/contracts';
import { loadRadioCatalog, radioSongUrl } from './catalog';
import {
  musicEnabledForRadio,
  onMusicEnabledForRadio,
  setMusicEnabledForRadio,
  setRadioPlaying,
} from './bridge';
import { type RepeatMode, firstSong, nextSong, previousSong, shouldToast } from './player-model';

/**
 * El reproductor de la radio (plan 022 T247): un solo objeto por página, fuera
 * de React, para que la música siga aunque la interfaz se monte y desmonte.
 * Suena una canción cada vez por un `<audio>` sin precargar
 * (`preload="none"`); la siguiente se decide y se precarga sólo cuando a la
 * que suena le quedan pocos segundos (`PREFETCH_SECONDS`).
 *
 * Nada suena solo: `start()` llega siempre de un toque. Cada carga de página
 * arranca apagada (sin canción); en `sessionStorage` sólo se recuerdan los
 * Ajustes (volumen, aleatorio, repetir y género). Dentro del sitio, con el
 * reproductor montado, la música sigue porque el objeto no se toca.
 *
 * Con «Música» apagada en Ajustes (o el 🔊 de la cabecera) la radio se
 * calla; al encenderla sigue. Un toque de play en la radio con la música
 * apagada la enciende (`deps.enableMusic`).
 */

export type RadioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped';

export interface RadioToast {
  /** Cambia con cada aviso, para que la interfaz vuelva a enseñarlo. */
  key: number;
  song: RadioSong;
}

export interface RadioState {
  status: RadioStatus;
  catalog: RadioCatalog | null;
  song: RadioSong | null;
  elapsed: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** 0..1 */
  volume: number;
  /** El reproductor (la ventana) está abierto. */
  open: boolean;
  genreId: string | null;
  toast: RadioToast | null;
  /** El catálogo no se pudo leer o ninguna canción suena. */
  error: boolean;
}

/** Lo que el reproductor usa de un `<audio>` (así se prueba sin navegador). */
export interface RadioAudio {
  src: string;
  preload: string;
  volume: number;
  currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
}

export interface RadioPlayerDeps {
  createAudio: () => RadioAudio;
  loadCatalog: () => Promise<RadioCatalog>;
  songUrl: (song: RadioSong) => Promise<string | null>;
  random?: () => number;
  /** `sessionStorage`, para seguir en la siguiente página del sitio. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  /** Enciende «Música» en Ajustes (la radio va a sonar porque se tocó play). */
  enableMusic?: () => void;
}

export const PREFETCH_SECONDS = 8;
export const RADIO_SESSION_KEY = 'boia.radio';
const MAX_FAILURES = 3;

/** Sólo los Ajustes: la canción, el segundo y «sonando» no se recuerdan entre cargas. */
interface Saved {
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  genreId: string | null;
}

export class RadioPlayer {
  private state: RadioState = {
    status: 'idle',
    catalog: null,
    song: null,
    elapsed: 0,
    duration: 0,
    shuffle: true,
    repeat: 'all',
    volume: 0.8,
    open: false,
    genreId: null,
    toast: null,
    error: false,
  };
  private listeners = new Set<() => void>();
  private audio: RadioAudio | null = null;
  private handlers = new Map<string, () => void>();
  private upcoming: { song: RadioSong; audio: RadioAudio | null } | null = null;
  private catalogPromise: Promise<RadioCatalog> | null = null;
  private failures = 0;
  private toastKey = 0;
  /** La música de Ajustes la calló; al encenderla, sigue. */
  private mutedBySettings = false;
  /** Lo último que se pidió, para no pisar una carga vieja a una nueva. */
  private loadSeq = 0;
  private offMusic: () => void;

  constructor(private deps: RadioPlayerDeps) {
    this.offMusic = onMusicEnabledForRadio(() => this.onMusicEnabled(musicEnabledForRadio()));
    this.restore();
  }

  // --- Estado ---------------------------------------------------------------

  getState = (): RadioState => this.state;

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  private set(patch: Partial<RadioState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of [...this.listeners]) l();
  }

  /** ¿La radio está puesta (suena o está cargando la canción)? */
  get active(): boolean {
    return this.state.status === 'playing' || this.state.status === 'loading';
  }

  /** ¿Se encendió alguna vez en esta página? */
  get started(): boolean {
    return this.state.song !== null;
  }

  // --- Catálogo -------------------------------------------------------------

  /** Pide el catálogo (una vez); la interfaz lo llama en reposo para tenerlo a mano. */
  catalog(): Promise<RadioCatalog> {
    this.catalogPromise ??= this.deps.loadCatalog().then(
      (c) => {
        this.set({ catalog: c, error: false });
        return c;
      },
      (err: unknown) => {
        this.catalogPromise = null;
        this.set({ error: true });
        throw err;
      },
    );
    return this.catalogPromise;
  }

  // --- Mandos ---------------------------------------------------------------

  /**
   * El botón de la landing: el primer toque enciende la radio (la primera
   * canción); en pausa o parada, la vuelve a poner; sonando, abre (o cierra)
   * el reproductor.
   */
  async tapButton(): Promise<void> {
    if (!this.started) return this.start();
    if (!this.active) return this.play();
    this.set({ open: !this.state.open });
  }

  /** Enciende la radio: la primera del catálogo y luego al azar. */
  async start(): Promise<void> {
    if (this.started) return this.play();
    let catalog: RadioCatalog;
    try {
      catalog = await this.catalog();
    } catch {
      return;
    }
    const first = firstSong(catalog.songs);
    if (!first) {
      this.set({ error: true });
      return;
    }
    await this.load(first, true);
  }

  async play(): Promise<void> {
    if (!this.started) return this.start();
    if (!this.audio) return;
    this.wantMusic();
    this.set({ status: 'loading' });
    await this.tryPlay(this.audio);
  }

  pause(): void {
    this.mutedBySettings = false;
    this.audio?.pause();
    this.set({ status: 'paused' });
    this.save();
  }

  togglePlay(): void {
    if (this.active) this.pause();
    else void this.play();
  }

  /** Como en el Winamp: para y vuelve al principio de la canción. */
  stop(): void {
    this.mutedBySettings = false;
    if (this.audio) {
      this.audio.pause();
      try {
        this.audio.currentTime = 0;
      } catch {
        // Sin metadatos aún: ya está al principio.
      }
    }
    this.set({ status: 'stopped', elapsed: 0 });
    this.save();
  }

  async next(): Promise<void> {
    const songs = this.state.catalog?.songs ?? [];
    const song = nextSong(songs, this.state.song, {
      ...this.order(),
      // «Siguiente» a mano con repetir-una sigue cambiando de canción.
      repeat: this.state.repeat === 'one' ? 'all' : this.state.repeat,
    });
    if (song) await this.load(song, this.active || this.state.status === 'idle');
  }

  async previous(): Promise<void> {
    const songs = this.state.catalog?.songs ?? [];
    // Pasados tres segundos, «anterior» vuelve al principio de la misma.
    if (this.audio && this.state.elapsed > 3) {
      this.audio.currentTime = 0;
      this.set({ elapsed: 0 });
      return;
    }
    const song = previousSong(songs, this.state.song, this.state.genreId);
    if (song) await this.load(song, this.active);
  }

  /** Una canción de la lista, a dedo: suena ya. */
  async playSong(id: string): Promise<void> {
    const song = this.state.catalog?.songs.find((s) => s.id === id);
    if (song) await this.load(song, true);
  }

  seek(seconds: number): void {
    if (!this.audio) return;
    const max = this.state.duration || this.state.song?.durationSeconds || 0;
    const t = Math.min(Math.max(0, seconds), max);
    try {
      this.audio.currentTime = t;
    } catch {
      return;
    }
    this.set({ elapsed: t });
  }

  setVolume(volume: number): void {
    const v = Math.min(1, Math.max(0, volume));
    if (this.audio) this.audio.volume = v;
    if (this.upcoming?.audio) this.upcoming.audio.volume = v;
    this.set({ volume: v });
    this.save();
  }

  setShuffle(shuffle: boolean): void {
    this.dropUpcoming();
    this.set({ shuffle });
    this.save();
  }

  setRepeat(repeat: RepeatMode): void {
    this.dropUpcoming();
    this.set({ repeat });
    this.save();
  }

  cycleRepeat(): void {
    const order: RepeatMode[] = ['all', 'one', 'off'];
    this.setRepeat(order[(order.indexOf(this.state.repeat) + 1) % order.length]!);
  }

  setGenre(genreId: string | null): void {
    this.dropUpcoming();
    this.set({ genreId });
    this.save();
  }

  open(): void {
    // Al abrir se va cualquier aviso: la ventana ya dice lo que suena.
    this.set({ open: true, toast: null });
  }

  close(): void {
    this.set({ open: false });
  }

  dismissToast(key: number): void {
    if (this.state.toast?.key === key) this.set({ toast: null });
  }

  /** Suelta el `<audio>` (sólo pruebas o al cerrar del todo). */
  dispose(): void {
    this.offMusic();
    this.detach();
    this.dropUpcoming();
    setRadioPlaying(false);
  }

  // --- Dentro ---------------------------------------------------------------

  private order() {
    return {
      shuffle: this.state.shuffle,
      repeat: this.state.repeat,
      genreId: this.state.genreId,
      random: this.deps.random,
    };
  }

  private wantMusic(): void {
    this.mutedBySettings = false;
    if (!musicEnabledForRadio()) {
      this.deps.enableMusic?.();
      setMusicEnabledForRadio(true);
    }
  }

  /** Quien tenga los Ajustes en la mano (`/mar`) dice cómo encender «Música». */
  setEnableMusic(fn: (() => void) | undefined): void {
    this.deps = { ...this.deps, enableMusic: fn ?? browserEnableMusic };
  }

  /** Pone `song` en el `<audio>` y, si `play`, la hace sonar. */
  private async load(song: RadioSong, play: boolean): Promise<void> {
    const seq = ++this.loadSeq;
    const previous = this.state.song;
    const reuse = this.upcoming?.song.id === song.id ? this.upcoming.audio : null;
    this.dropUpcoming(reuse);
    if (play) this.wantMusic();
    this.set({
      song,
      elapsed: 0,
      duration: song.durationSeconds,
      status: play ? 'loading' : this.state.status === 'idle' ? 'stopped' : 'paused',
      error: false,
      toast: shouldToast(this.state.open, previous?.id ?? null, song.id)
        ? { key: ++this.toastKey, song }
        : this.state.toast,
    });
    this.save();
    let audio = reuse;
    if (!audio) {
      const url = await this.deps.songUrl(song).catch(() => null);
      if (seq !== this.loadSeq) return;
      if (!url) return this.failed();
      audio = this.deps.createAudio();
      audio.preload = 'none';
      audio.volume = this.state.volume;
      audio.src = url;
    }
    this.failures = 0;
    this.attach(audio);
    if (!play) {
      this.audio?.pause();
      return;
    }
    await this.tryPlay(audio);
  }

  private async tryPlay(audio: RadioAudio): Promise<void> {
    try {
      await audio.play();
      if (audio !== this.audio) return;
      this.set({ status: 'playing' });
      setRadioPlaying(true);
      this.save();
    } catch {
      if (audio !== this.audio) return;
      // Bloqueado (sin gesto) o sin poder leerse: en pausa, a un toque.
      this.set({ status: 'paused' });
      setRadioPlaying(false);
      this.save();
    }
  }

  private attach(audio: RadioAudio): void {
    this.detach();
    this.audio = audio;
    const on = (type: string, fn: () => void) => {
      this.handlers.set(type, fn);
      audio.addEventListener(type, fn);
    };
    on('timeupdate', () => this.onTime());
    on('durationchange', () => this.onTime());
    on('ended', () => void this.onEnded());
    on('error', () => this.failed());
    on('play', () => {
      if (this.state.status !== 'loading') this.set({ status: 'playing' });
    });
    on('playing', () => {
      this.set({ status: 'playing' });
      setRadioPlaying(true);
    });
    on('waiting', () => {
      if (this.state.status === 'playing') this.set({ status: 'loading' });
    });
    on('pause', () => {
      if (this.state.status === 'playing' || this.state.status === 'loading') {
        this.set({ status: 'paused' });
      }
      setRadioPlaying(false);
    });
  }

  private detach(): void {
    if (!this.audio) return;
    for (const [type, fn] of this.handlers) this.audio.removeEventListener(type, fn);
    this.handlers.clear();
    this.audio.pause();
    this.audio = null;
  }

  private onTime(): void {
    const a = this.audio;
    if (!a) return;
    const duration =
      Number.isFinite(a.duration) && a.duration > 0
        ? a.duration
        : (this.state.song?.durationSeconds ?? 0);
    this.set({ elapsed: a.currentTime, duration });
    if (this.active && duration - a.currentTime <= PREFETCH_SECONDS) this.prefetch();
  }

  /** Decide la siguiente y la va pidiendo, sólo cuando a ésta le queda poco. */
  private prefetch(): void {
    if (this.upcoming) return;
    const songs = this.state.catalog?.songs ?? [];
    const song = nextSong(songs, this.state.song, this.order());
    if (!song) return;
    const entry: { song: RadioSong; audio: RadioAudio | null } = { song, audio: null };
    this.upcoming = entry;
    if (song.id === this.state.song?.id) return; // repetir una: el mismo archivo.
    void this.deps
      .songUrl(song)
      .catch(() => null)
      .then((url) => {
        if (!url || this.upcoming !== entry) return;
        const audio = this.deps.createAudio();
        audio.preload = 'auto';
        audio.volume = this.state.volume;
        audio.src = url;
        entry.audio = audio;
      });
  }

  private dropUpcoming(keep: RadioAudio | null = null): void {
    if (this.upcoming?.audio && this.upcoming.audio !== keep) {
      this.upcoming.audio.pause();
      this.upcoming.audio.src = '';
    }
    this.upcoming = null;
  }

  private async onEnded(): Promise<void> {
    const songs = this.state.catalog?.songs ?? [];
    const song = this.upcoming?.song ?? nextSong(songs, this.state.song, this.order());
    if (!song) {
      this.set({ status: 'stopped', elapsed: 0 });
      setRadioPlaying(false);
      this.save();
      return;
    }
    if (song.id === this.state.song?.id && this.audio) {
      this.upcoming = null;
      this.audio.currentTime = 0;
      await this.tryPlay(this.audio);
      return;
    }
    await this.load(song, true);
  }

  /** Esta canción no suena: pasa a la siguiente, hasta tres seguidas. */
  private failed(): void {
    this.failures += 1;
    if (this.failures >= MAX_FAILURES) {
      this.set({ status: 'stopped', error: true });
      setRadioPlaying(false);
      return;
    }
    void this.next();
  }

  private onMusicEnabled(enabled: boolean): void {
    if (!enabled && this.active) {
      this.audio?.pause();
      this.set({ status: 'paused' });
      this.mutedBySettings = true;
    } else if (enabled && this.mutedBySettings) {
      this.mutedBySettings = false;
      void this.play();
    }
  }

  // --- Seguir en la página siguiente -----------------------------------------

  /** Guarda los Ajustes para la siguiente página del sitio. */
  private save(): void {
    const st = this.deps.storage;
    if (!st) return;
    const saved: Saved = {
      shuffle: this.state.shuffle,
      repeat: this.state.repeat,
      volume: this.state.volume,
      genreId: this.state.genreId,
    };
    try {
      st.setItem(RADIO_SESSION_KEY, JSON.stringify(saved));
    } catch {
      // Sin sitio: los Ajustes se pierden entre páginas, nada más.
    }
  }

  /** La interfaz lo llama en `pagehide`; los Ajustes ya están guardados. */
  saveNow(): void {
    this.save();
  }

  /**
   * Sólo los Ajustes. Datos viejos de `sessionStorage` con canción, segundo o
   * «sonando» se ignoran: la radio arranca siempre en reposo.
   */
  private restore(): void {
    const st = this.deps.storage;
    if (!st) return;
    let saved: Partial<Saved> | null = null;
    try {
      const raw = st.getItem(RADIO_SESSION_KEY);
      saved = raw ? (JSON.parse(raw) as Partial<Saved>) : null;
    } catch {
      saved = null;
    }
    if (!saved || typeof saved !== 'object') return;
    this.state = {
      ...this.state,
      shuffle: typeof saved.shuffle === 'boolean' ? saved.shuffle : this.state.shuffle,
      repeat: saved.repeat === 'off' || saved.repeat === 'one' ? saved.repeat : 'all',
      volume: typeof saved.volume === 'number' ? Math.min(1, Math.max(0, saved.volume)) : 0.8,
      genreId: typeof saved.genreId === 'string' ? saved.genreId : null,
    };
  }
}

// --- La instancia de la página ---------------------------------------------

let instance: RadioPlayer | null = null;

/** El reproductor de esta página (se crea al primer uso, con el navegador). */
export function radioPlayer(deps?: RadioPlayerDeps): RadioPlayer {
  if (!instance) instance = new RadioPlayer(deps ?? browserDeps());
  return instance;
}

/** Sólo pruebas. */
export function resetRadioPlayer(): void {
  instance?.dispose();
  instance = null;
}

function browserDeps(): RadioPlayerDeps {
  let storage: RadioPlayerDeps['storage'] = null;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = null;
  }
  return {
    createAudio: () => new Audio(),
    loadCatalog: loadRadioCatalog,
    songUrl: radioSongUrl,
    storage,
    enableMusic: browserEnableMusic,
  };
}

/** Sin nadie con los Ajustes en la mano: se escriben en el almacén (la landing). */
function browserEnableMusic(): void {
  void import('./music-setting').then((m) => m.enableMusic());
}
