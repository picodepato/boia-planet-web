import { type WorldObject, worldToScreen } from '@boia/world';
import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { BOIA_NAVY, BOIA_ORANGE } from '../ship/provisional';
import { type FrameLoader, type LoadedArt, loadFrames } from './assets';
import type { ObjectRuntimeState } from './runtime';
import type { ObjectVisual } from './visual';

/** Marcador dibujado por código para un objeto sin arte: base 2:1 sobre el agua. */
function drawPlaceholder(shape: string, r: number): Graphics {
  const g = new Graphics();
  g.ellipse(0, 0, r * 1.08, r * 0.54).fill({ color: 0xd9f3f7, alpha: 0.45 });
  switch (shape) {
    case 'sin-skin': {
      // Lugar sin skin en este mundo (T17): a propósito llamativo, para que se vea
      // que falta arte. Huella a escala, rayada, con un aro discontinuo.
      g.clear();
      g.ellipse(0, 0, r, r * 0.5).fill({ color: 0xff2bd6, alpha: 0.35 });
      for (let x = -r; x < r; x += Math.max(6, r / 4)) {
        g.moveTo(x, -r * 0.5).lineTo(x + r * 0.5, r * 0.5);
      }
      g.stroke({ width: 2, color: 0xff2bd6, alpha: 0.6 });
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const b = a + Math.PI / 16;
        g.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.5).lineTo(
          Math.cos(b) * r,
          Math.sin(b) * r * 0.5,
        );
      }
      g.stroke({ width: 3, color: 0xffffff });
      // Un «!» encima de la huella.
      const top = -r * 0.5 - 10;
      g.rect(-2.5, top - 30, 5, 20).fill({ color: 0xff2bd6 });
      g.circle(0, top - 3, 3.5).fill({ color: 0xff2bd6 });
      break;
    }
    case 'secreto': {
      // Secreto sin arte (T18 no lo dibujó): burbujas y un destello, discreto a propósito.
      g.clear();
      for (const [x, y, rr] of [
        [-r * 0.3, -r * 0.1, r * 0.22],
        [r * 0.25, -r * 0.35, r * 0.16],
        [0, -r * 0.7, r * 0.12],
      ] as const) {
        g.circle(x, y, rr).stroke({ width: 1.5, color: 0xffffff, alpha: 0.75 });
      }
      g.star(r * 0.45, -r * 0.95, 4, r * 0.2, r * 0.07).fill({ color: 0xffe45c, alpha: 0.9 });
      break;
    }
    case 'isla':
      g.ellipse(0, -r * 0.08, r, r * 0.5).fill({ color: 0xe7c88f });
      g.ellipse(-r * 0.1, -r * 0.2, r * 0.7, r * 0.35).fill({ color: 0x8fbf6a });
      break;
    case 'boia':
      g.ellipse(0, -r * 0.3, r, r * 0.6)
        .fill({ color: BOIA_ORANGE })
        .stroke({ width: 1.5, color: BOIA_NAVY });
      g.rect(-r * 0.15, -r * 2.2, r * 0.3, r * 1.9).fill({ color: BOIA_NAVY });
      break;
    default:
      // Roca, obstáculo y cualquier otra categoría.
      g.ellipse(0, -r * 0.18, r, r * 0.5).fill({ color: 0x3b4a5c });
      g.ellipse(-r * 0.1, -r * 0.38, r * 0.72, r * 0.42).fill({ color: 0x55677b });
      g.ellipse(-r * 0.25, -r * 0.52, r * 0.3, r * 0.16).fill({ color: 0x8397ab });
  }
  return g;
}

/** s que duran las ondas al sumergirse o emerger. muestra */
const RIPPLE_SECONDS = 0.9;

/**
 * Vista Pixi de un objeto del mundo: sprite (con bucle si el asset lo trae)
 * o marcador. Sigue la posición y la presencia que da el runtime. Si el arte
 * trae `sumergirse` (los cocodrilos), al desaparecer lo reproduce con ondas
 * antes de ocultarse, y al volver lo reproduce al revés (REQ-AVE-005).
 */
export class ObjectView {
  readonly view = new Container();
  private readonly sprite: Sprite | null;
  private readonly ripples = new Graphics();
  private present = true;
  /** Sumergirse (`out`) o emerger (`in`) en curso; `start` se fija en el primer `animate`. */
  private dive: { dir: 'out' | 'in'; start: number | null } | null = null;

  private constructor(
    readonly object: WorldObject,
    readonly visual: ObjectVisual,
    private readonly frames: Texture[],
    private readonly diveFrames: Texture[] = [],
  ) {
    if (visual.kind === 'sprite' && frames.length > 0) {
      const s = new Sprite(frames[0]!);
      const t = frames[0]!;
      s.anchor.set(visual.pivot.x / t.width, visual.pivot.y / t.height);
      s.scale.set(visual.scale);
      this.sprite = s;
      this.view.addChild(s);
    } else {
      this.sprite = null;
      const r = visual.kind === 'placeholder' ? visual.radius : 20;
      const shape = visual.kind === 'placeholder' ? visual.shape : object.identity.category;
      this.view.addChild(drawPlaceholder(shape, r));
    }
    this.view.addChild(this.ripples);
    this.sync({
      id: object.identity.id,
      x: object.position.x,
      y: object.position.y,
      present: true,
      inProximity: false,
    });
  }

  static async create(
    object: WorldObject,
    visual: ObjectVisual,
    art: ReadonlyMap<string, LoadedArt>,
    load: FrameLoader = loadFrames,
  ): Promise<ObjectView> {
    let frames: Texture[] = [];
    let dive: Texture[] = [];
    if (visual.kind === 'sprite') {
      const a = art.get(visual.assetId);
      try {
        if (a) frames = await load(a, visual.frames);
      } catch (err) {
        console.warn(`[boia] imágenes de «${visual.assetId}» incompletas; marcador`, err);
        frames = [];
      }
      try {
        if (a && visual.dive && frames.length > 0) dive = await load(a, visual.dive.frames);
      } catch (err) {
        console.warn(`[boia] «${visual.assetId}» sin fotogramas de sumergirse`, err);
        dive = [];
      }
    }
    return new ObjectView(object, visual, frames, dive);
  }

  sync(state: ObjectRuntimeState): void {
    const p = worldToScreen(state);
    this.view.position.set(p.x, p.y);
    // Lo que va a ras de agua (anillo de salida, remolino, posidonia) queda
    // siempre debajo del barco; lo demás se ordena por profundidad.
    this.view.zIndex = this.object.appearance.layer === 'water' ? -1e7 + state.y : state.y;
    if (state.present !== this.present) {
      this.present = state.present;
      // Con fotogramas de sumergirse, se ve el paso; sin ellos, aparece o desaparece.
      this.dive = this.diveFrames.length > 1 ? { dir: state.present ? 'in' : 'out', start: null } : null;
    }
    this.view.visible = state.present || this.dive?.dir === 'out';
  }

  /** Avanza el bucle del asset (`t` en s de juego). */
  animate(t: number): void {
    const v = this.visual;
    if (!this.sprite || v.kind !== 'sprite') return;
    if (this.dive && v.dive) {
      this.dive.start ??= t;
      const e = t - this.dive.start;
      const n = this.diveFrames.length;
      const i = Math.min(n - 1, Math.floor(e * v.dive.fps));
      this.sprite.texture = this.diveFrames[this.dive.dir === 'out' ? i : n - 1 - i]!;
      this.drawRipples(e);
      const done = e >= n / v.dive.fps && e >= RIPPLE_SECONDS;
      if (!done) return;
      if (this.dive.dir === 'out') this.view.visible = false;
      this.dive = null;
      this.ripples.clear();
    }
    if (this.frames.length < 2 || v.fps <= 0) return;
    const n = this.frames.length;
    const i = Math.floor(t * v.fps);
    this.sprite.texture = this.frames[v.loop ? i % n : Math.min(i, n - 1)]!;
  }

  /** Anillos de onda que se abren en el agua al sumergirse o emerger. */
  private drawRipples(e: number): void {
    const g = this.ripples;
    g.clear();
    const v = this.visual;
    if (v.kind !== 'sprite') return;
    const base = (this.sprite?.width ?? 80) * 0.35;
    for (const delay of [0, 0.25]) {
      const k = (e - delay) / RIPPLE_SECONDS;
      if (k <= 0 || k >= 1) continue;
      const r = base * (0.5 + k);
      g.ellipse(0, 0, r, r * 0.5).stroke({ width: 2, color: 0xffffff, alpha: 0.7 * (1 - k) });
    }
  }
}
