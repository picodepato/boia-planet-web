import {
  BOTTLE_PLACEHOLDER_ASSET,
  BOTTLE_RADIUS,
  type BottleMarker,
  bottleObject,
  worldToScreen,
} from '@boia/world';
import { Container, Graphics } from 'pixi.js';
import { BOIA_NAVY, BOIA_ORANGE } from '../ship/provisional';
import { type ArtUrl, type LoadedArt, loadArt, manifestsOf } from '../world/assets';
import { ObjectView } from '../world/object-view';
import { resolveObjectVisual } from '../world/visual';

/**
 * Las botellas en el agua (T22). Se pintan en la misma capa que los objetos
 * del mundo, ordenadas por profundidad con el barco, y cabecean un poco.
 * Con arte (`asset` distinto del marcador) usan el mismo contrato que el
 * resto de objetos; sin él, una botella dibujada por código.
 */

/** Botella tumbada flotando, dibujada por código hasta que haya arte (T18). muestra */
function drawBottle(mine: boolean): Container {
  const r = BOTTLE_RADIUS;
  const c = new Container();
  const ripple = new Graphics();
  ripple.ellipse(0, 0, r * 2.1, r * 0.9).fill({ color: 0xd9f3f7, alpha: 0.35 });
  ripple.ellipse(0, 0, r * 2.1, r * 0.9).stroke({ width: 1, color: 0xffffff, alpha: 0.55 });
  const body = new Graphics();
  // Cuerpo de cristal, cuello y tapón; el mensaje enrollado se ve dentro.
  body.roundRect(-r * 1.5, -r * 1.25, r * 2.3, r * 1.1, r * 0.5).fill({
    color: 0x7fc8a9,
    alpha: 0.95,
  });
  body.rect(r * 0.75, -r * 1.02, r * 0.7, r * 0.64).fill({ color: 0x7fc8a9, alpha: 0.95 });
  body.rect(r * 1.4, -r * 1.06, r * 0.45, r * 0.72).fill({ color: mine ? BOIA_ORANGE : 0xb5835a });
  body.roundRect(-r * 1.1, -r * 1.05, r * 1.5, r * 0.7, r * 0.3).fill({ color: 0xfffaf0 });
  body.moveTo(-r * 1.3, -r * 1.12).lineTo(r * 0.6, -r * 1.12);
  body.stroke({ width: 1, color: 0xffffff, alpha: 0.8 });
  body.roundRect(-r * 1.5, -r * 1.25, r * 2.3, r * 1.1, r * 0.5).stroke({
    width: 1.2,
    color: BOIA_NAVY,
    alpha: 0.7,
  });
  body.rotation = -0.18;
  c.addChild(ripple, body);
  return c;
}

interface Entry {
  marker: BottleMarker;
  view: Container;
  inner: Container;
  phase: number;
}

export interface BottleLayerOptions {
  /** Id del arte de la botella; por defecto, el marcador por código. */
  asset?: string;
  artUrl?: ArtUrl | null;
  /** px de pantalla por px de imagen (la del barco). */
  artScale: number;
}

export class BottleLayer {
  private readonly entries = new Map<string, Entry>();
  private art: Promise<Map<string, LoadedArt>> | null = null;
  private request = 0;
  private readonly asset: string;

  constructor(
    private readonly parent: Container,
    private readonly opts: BottleLayerOptions,
  ) {
    this.asset = opts.asset ?? BOTTLE_PLACEHOLDER_ASSET;
  }

  private loadArtOnce(): Promise<Map<string, LoadedArt>> {
    if (this.asset.startsWith('placeholder:') || this.opts.artUrl === null) {
      return Promise.resolve(new Map());
    }
    this.art ??= loadArt([this.asset], this.opts.artUrl);
    return this.art;
  }

  private async build(m: BottleMarker): Promise<Container> {
    const art = await this.loadArtOnce();
    const o = bottleObject(m, this.asset);
    const visual = resolveObjectVisual(o, manifestsOf(art), this.opts.artScale);
    if (visual.kind === 'sprite') {
      const v = await ObjectView.create(o, visual, art);
      v.view.position.set(0, 0);
      return v.view;
    }
    return drawBottle(!!m.mine);
  }

  /** Pone en el agua exactamente estas botellas (quita las que ya no están). */
  async set(markers: readonly BottleMarker[]): Promise<void> {
    const request = ++this.request;
    const want = new Map(markers.map((m) => [m.id, m]));
    const built = await Promise.all(
      markers
        .filter((m) => {
          const e = this.entries.get(m.id);
          return !e || e.marker.mine !== m.mine;
        })
        .map(async (m) => ({ m, inner: await this.build(m) })),
    );
    if (request !== this.request || this.parent.destroyed) {
      for (const b of built) b.inner.destroy({ children: true });
      return;
    }
    for (const [id, e] of this.entries) {
      const next = want.get(id);
      if (!next || built.some((b) => b.m.id === id)) {
        this.parent.removeChild(e.view);
        e.view.destroy({ children: true });
        this.entries.delete(id);
      } else {
        e.marker = next;
      }
    }
    for (const { m, inner } of built) {
      const view = new Container();
      view.label = `botella:${m.id}`;
      view.addChild(inner);
      this.parent.addChild(view);
      this.entries.set(m.id, { marker: m, view, inner, phase: (hash(m.id) % 628) / 100 });
    }
    for (const e of this.entries.values()) {
      const p = worldToScreen(e.marker);
      e.view.position.set(p.x, p.y);
      e.view.zIndex = e.marker.y;
    }
  }

  /** Cabeceo suave (`t` en s de juego). */
  animate(t: number): void {
    for (const e of this.entries.values()) {
      e.inner.position.y = Math.sin(t * 2.2 + e.phase) * 1.4;
      e.inner.rotation = Math.sin(t * 1.3 + e.phase) * 0.06;
    }
  }

  get size(): number {
    return this.entries.size;
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
