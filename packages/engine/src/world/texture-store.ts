import { Assets, Spritesheet, type SpritesheetData, type Texture } from 'pixi.js';
import type { AtlasSheetRef, AtlasWorld } from './atlas-index';

/**
 * Texturas del mundo con recuento de usos (T47): hojas de atlas por sector y
 * PNG sueltos de `/api/art`. Lo que nadie usa se descarga de la GPU y de la
 * caché de Assets (liberar texturas lejanas, REQ-MUN-012). Lo que ya estaba
 * en la caché cuando se pidió (lo cargó otro, p. ej. la tripulante) no se
 * descarga nunca desde aquí.
 */

interface SheetEntry {
  ref: AtlasSheetRef;
  json: string;
  image: string;
  refs: number;
  /** Terminó de cargar (bien o mal). */
  loaded: boolean;
  sheet: Spritesheet | null;
  ready: Promise<Spritesheet | null>;
}

interface RawEntry {
  refs: number;
  external: boolean;
  ready: Promise<Texture>;
}

/** Un archivo pedido: su clave de atlas y la URL del PNG por si no está en ninguno. */
export interface FrameRequest {
  key: string;
  url: string;
}

export interface Acquired {
  textures: Texture[];
  release: () => void;
}

export class TextureStore {
  private readonly sheets = new Map<string, SheetEntry>();
  /** Clave → hoja (pedida o cargada) que la lleva. */
  private readonly byKey = new Map<string, SheetEntry>();
  private readonly raw = new Map<string, RawEntry>();
  private readonly singles = new Map<string, string>();
  private destroyed = false;

  /** Hojas del mundo; `base` es la URL del índice (las rutas del índice son relativas a ella). */
  constructor(
    private readonly atlas: AtlasWorld | null = null,
    private readonly base = '',
  ) {
    for (const [key, s] of Object.entries(atlas?.singles ?? {})) {
      this.singles.set(key, this.url(s.url));
    }
  }

  get hasAtlas(): boolean {
    return this.atlas !== null;
  }

  private url(rel: string): string {
    return new URL(rel, new URL(this.base || '/', location.href)).href;
  }

  /** Pide (o retiene) una hoja; resuelve cuando está cargada. */
  acquireSheet(ref: AtlasSheetRef): Promise<unknown> {
    const json = this.url(ref.url);
    let e = this.sheets.get(json);
    if (!e) {
      const entry: SheetEntry = {
        ref,
        json,
        image: this.url(ref.image),
        refs: 0,
        loaded: false,
        sheet: null,
        ready: Promise.resolve(null),
      };
      entry.ready = this.loadSheet(entry);
      e = entry;
      this.sheets.set(json, e);
      for (const k of ref.keys) if (!this.byKey.has(k)) this.byKey.set(k, e);
    }
    e.refs++;
    return e.ready;
  }

  releaseSheet(ref: AtlasSheetRef): void {
    const e = this.sheets.get(this.url(ref.url));
    if (e) this.dropSheet(e);
  }

  private async loadSheet(e: SheetEntry): Promise<Spritesheet | null> {
    try {
      const res = await fetch(e.json);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SpritesheetData;
      const texture = await Assets.load<Texture>(e.image);
      const sheet = new Spritesheet({ texture, data });
      await sheet.parse();
      e.sheet = sheet;
    } catch (err) {
      console.warn(`[boia] atlas «${e.ref.url}» no disponible; se usan los PNG`, err);
    }
    e.loaded = true;
    // Soltada mientras cargaba (o el almacén ya no existe): fuera.
    if (this.destroyed || e.refs <= 0) {
      this.finishSheet(e);
      return null;
    }
    return e.sheet;
  }

  private dropSheet(e: SheetEntry): void {
    e.refs--;
    // Mientras carga se queda en el índice: si se vuelve a pedir, es la misma.
    if (e.refs > 0 || !e.loaded) return;
    this.finishSheet(e);
  }

  /** Quita la hoja del índice y descarga su imagen. */
  private finishSheet(e: SheetEntry): void {
    if (this.sheets.get(e.json) === e) this.sheets.delete(e.json);
    for (const k of e.ref.keys) if (this.byKey.get(k) === e) this.byKey.delete(k);
    if (e.sheet) {
      e.sheet.destroy(false);
      e.sheet = null;
      void Assets.unload(e.image);
    }
  }

  private acquireRaw(url: string): Promise<Texture> {
    let e = this.raw.get(url);
    if (!e) {
      e = { refs: 0, external: Assets.cache.has(url), ready: Assets.load<Texture>(url) };
      this.raw.set(url, e);
    }
    e.refs++;
    return e.ready;
  }

  private releaseRaw(url: string): void {
    const e = this.raw.get(url);
    if (!e) return;
    e.refs--;
    if (e.refs > 0) return;
    // Se descarga cuando termine de cargar, si nadie la ha vuelto a pedir.
    void e.ready
      .then(() => {
        if (e.refs > 0 || this.raw.get(url) !== e) return;
        this.raw.delete(url);
        if (!e.external) return Assets.unload(url);
      })
      .catch(() => {
        if (this.raw.get(url) === e && e.refs <= 0) this.raw.delete(url);
      });
  }

  /** Los fotogramas pedidos, del atlas si lo llevan y si no del PNG (o de su versión comprimida). */
  async frames(files: readonly FrameRequest[]): Promise<Acquired> {
    const held: (() => void)[] = [];
    const release = () => {
      for (const r of held.splice(0)) r();
    };
    try {
      const textures = await Promise.all(
        files.map(async (f) => {
          const e = this.byKey.get(f.key);
          if (e) {
            e.refs++;
            const sheet = await e.ready;
            const t = sheet?.textures[f.key];
            if (t) {
              held.push(() => this.dropSheet(e));
              return t;
            }
            this.dropSheet(e);
          }
          const url = this.singles.get(f.key) ?? f.url;
          const t = await this.acquireRaw(url);
          held.push(() => this.releaseRaw(url));
          return t;
        }),
      );
      return { textures, release };
    } catch (err) {
      release();
      throw err;
    }
  }

  /** Suelta todas las hojas y los PNG que cargó este almacén. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const e of [...this.sheets.values()]) {
      e.refs = 0;
      if (e.loaded) this.finishSheet(e);
    }
    for (const [url, e] of [...this.raw]) {
      e.refs = 1;
      this.releaseRaw(url);
    }
  }
}
