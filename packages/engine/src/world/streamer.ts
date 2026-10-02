import {
  type ArtManifest,
  type Sector,
  type Vec2,
  type WorldConfig,
  type WorldObject,
} from '@boia/world';
import type { Container } from 'pixi.js';
import { artKey } from './art-plan';
import { type AtlasWorld, sectorSheets } from './atlas-index';
import {
  type ArtManifestCache,
  type ArtUrl,
  type FrameLoader,
  type LoadedArt,
  loadArt,
} from './assets';
import { ObjectView } from './object-view';
import type { ObjectRuntimeState } from './runtime';
import {
  type QualityTier,
  STREAM_TUNING,
  type StreamTuning,
  type ViewExtent,
  onScreen,
  planObjects,
  planSectors,
  sectorsOf,
} from './sectors';
import type { TextureStore } from './texture-store';
import { resolveObjectVisual } from './visual';

interface ViewSlot {
  /** Vista lista, o `null` mientras carga. */
  view: ObjectView | null;
  ready: Promise<void>;
  release: (() => void)[];
  dropped: boolean;
}

export interface StreamerOptions {
  world: WorldConfig;
  /** `null`: sin arte, todo con marcadores (como `GameOptions.artUrl`). */
  artUrl: ArtUrl | null | undefined;
  artScale: number;
  tier: QualityTier;
  store: TextureStore;
  /** Atlas del mundo en el índice, si lo hay. */
  atlas: AtlasWorld | null;
}

export interface StreamStatus {
  /** Sectores con su atlas pedido (o sin atlas, a la vista). */
  sectors: string[];
  /** Vistas de objetos listas y cargando. */
  views: number;
  loading: number;
}

/**
 * El arte del mundo por sectores (T47, REQ-MUN-012): crea las vistas de los
 * objetos que quedan cerca del barco (o por delante, según su velocidad) y
 * suelta las lejanas con sus texturas; pide los atlas de los sectores a la
 * vista antes que las vistas, para que los fotogramas salgan de la hoja y no
 * de un PNG suelto. La simulación no depende de esto: un objeto sin vista
 * choca y se comporta igual (§48.1).
 */
export class SectorStreamer {
  private readonly sectors: Sector[];
  private readonly objects = new Map<string, WorldObject>();
  private readonly slots = new Map<string, ViewSlot>();
  private readonly sheetsHeld = new Map<string, () => void>();
  private readonly art = new Map<string, Promise<LoadedArt | null>>();
  private readonly manifests: ArtManifestCache = new Map();
  private parent: Container | null = null;
  private destroyed = false;
  readonly tuning: StreamTuning;

  constructor(private readonly opts: StreamerOptions) {
    this.sectors = sectorsOf(opts.world);
    for (const o of opts.world.objects) if (o.identity.active) this.objects.set(o.identity.id, o);
    this.tuning = STREAM_TUNING[opts.tier];
  }

  get world(): WorldConfig {
    return this.opts.world;
  }

  /** Vista de un objeto, si está lista. */
  view(id: string): ObjectView | undefined {
    return this.slots.get(id)?.view ?? undefined;
  }

  /** Las vistas listas. */
  *views(): Iterable<ObjectView> {
    for (const s of this.slots.values()) if (s.view) yield s.view;
  }

  /** Pone las vistas (las que hay y las que vengan) en `parent`. */
  attach(parent: Container): void {
    this.parent = parent;
    for (const v of this.views()) parent.addChild(v.view);
  }

  /**
   * Pide lo que hace falta para estos puntos (el barco primero) y suelta lo
   * lejano. Barato: se puede llamar en cada fotograma.
   */
  update(points: readonly Vec2[], view: ViewExtent, states: readonly ObjectRuntimeState[]): void {
    if (this.destroyed) return;
    const plan = planSectors(this.sectors, points, view, new Set(this.sheetsHeld.keys()), this.tuning);
    for (const id of plan.release) this.releaseSector(id);
    for (const id of plan.want) this.holdSector(id);
    const { want, keep } = planObjects(states, points, view, this.tuning);
    for (const id of want) if (!this.slots.has(id)) this.createView(id);
    for (const [id, slot] of this.slots) if (!keep.has(id)) this.dropView(id, slot);
  }

  /** Como `update`, y resuelve cuando todo lo pedido para esos puntos está listo. */
  async settle(
    points: readonly Vec2[],
    view: ViewExtent,
    states: readonly ObjectRuntimeState[],
  ): Promise<void> {
    this.update(points, view, states);
    const { want } = planObjects(states, points, view, this.tuning);
    await Promise.all([...want].map((id) => this.slots.get(id)?.ready));
  }

  /**
   * Objetos presentes cuyo arte asoma a la pantalla (centrada en `camera`) y
   * aún no tiene vista: un fotograma con textura ausente si es > 0.
   */
  missingOnScreen(camera: Vec2, view: ViewExtent, states: readonly ObjectRuntimeState[]): number {
    let n = 0;
    for (const s of states) {
      if (!s.present || !this.objects.has(s.id)) continue;
      if (this.slots.get(s.id)?.view) continue;
      if (onScreen(s, camera, view)) n++;
    }
    return n;
  }

  status(): StreamStatus {
    let views = 0;
    let loading = 0;
    for (const s of this.slots.values()) {
      if (s.view) views++;
      else loading++;
    }
    return { sectors: [...this.sheetsHeld.keys()], views, loading };
  }

  private holdSector(id: string): void {
    if (this.sheetsHeld.has(id)) return;
    const sheets = sectorSheets(this.opts.atlas, id, this.opts.tier);
    for (const s of sheets) void this.opts.store.acquireSheet(s);
    this.sheetsHeld.set(id, () => {
      for (const s of sheets) this.opts.store.releaseSheet(s);
    });
  }

  private releaseSector(id: string): void {
    this.sheetsHeld.get(id)?.();
    this.sheetsHeld.delete(id);
  }

  private loadAsset(assetId: string): Promise<LoadedArt | null> {
    let p = this.art.get(assetId);
    if (!p) {
      const url = this.opts.artUrl;
      p =
        url === null || assetId.startsWith('placeholder:')
          ? Promise.resolve(null)
          : loadArt([assetId], url, this.manifests).then((m) => m.get(assetId) ?? null);
      this.art.set(assetId, p);
    }
    return p;
  }

  private createView(id: string): void {
    const o = this.objects.get(id);
    if (!o) return;
    const slot: ViewSlot = { view: null, ready: Promise.resolve(), release: [], dropped: false };
    const load: FrameLoader = async (a, files) => {
      const got = await this.opts.store.frames(
        files.map((f) => ({ key: artKey(a.base, f), url: new URL(f, a.baseUrl).href })),
      );
      slot.release.push(got.release);
      return got.textures;
    };
    const build = async () => {
      const art = await this.loadAsset(o.appearance.asset);
      const loaded = new Map<string, LoadedArt>(art ? [[o.appearance.asset, art]] : []);
      const manifests = new Map<string, ArtManifest>(art ? [[o.appearance.asset, art.manifest]] : []);
      const visual = resolveObjectVisual(o, manifests, this.opts.artScale);
      return ObjectView.create(o, visual, loaded, load);
    };
    // Si algo falla, el marcador: el objeto se ve y se comporta igual (§48.1).
    const marker = () =>
      ObjectView.create(o, resolveObjectVisual(o, new Map(), this.opts.artScale), new Map());
    slot.ready = build()
      .catch((err: unknown) => {
        console.warn(`[boia] arte de «${id}» no disponible; marcador`, err);
        for (const r of slot.release.splice(0)) r();
        return marker();
      })
      .then((view) => {
        if (slot.dropped || this.destroyed) {
          view.view.destroy({ children: true });
          for (const r of slot.release.splice(0)) r();
          return;
        }
        slot.view = view;
        this.parent?.addChild(view.view);
      });
    this.slots.set(id, slot);
  }

  private dropView(id: string, slot: ViewSlot): void {
    slot.dropped = true;
    this.slots.delete(id);
    if (!slot.view) return;
    slot.view.view.removeFromParent();
    slot.view.view.destroy({ children: true });
    slot.view = null;
    for (const r of slot.release.splice(0)) r();
  }

  destroy(): void {
    if (this.destroyed) return;
    for (const [id, slot] of [...this.slots]) this.dropView(id, slot);
    for (const id of [...this.sheetsHeld.keys()]) this.releaseSector(id);
    this.destroyed = true;
  }
}
