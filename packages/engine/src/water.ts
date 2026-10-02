import { DEFAULT_SEA, type SeaPalette } from '@boia/world';
import { Container, Texture, TilingSprite } from 'pixi.js';

/**
 * Agua viva sin arte: dos texturas pintadas por código que se desplazan a
 * velocidades distintas y ondulan. Siguen a la cámara (están en el plano del
 * agua), así el mar da sensación de avance.
 */

const W = 256;
const H = 128;

function canvasTexture(draw: (ctx: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas 2D no disponible');
  draw(ctx);
  return Texture.from(c);
}

/** Dibuja en las 9 copias vecinas para que la textura empalme sin costura. */
function wrapped(ctx: CanvasRenderingContext2D, fn: (ox: number, oy: number) => void) {
  for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) fn(ox, oy);
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function waveLayer(seed: number, count: number, color: string, alpha: number, base?: string) {
  return canvasTexture((ctx) => {
    if (base) {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, W, H);
    }
    const r = rng(seed);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const x = r() * W;
      const y = r() * H;
      const len = 10 + r() * 22;
      ctx.globalAlpha = alpha * (0.5 + r() * 0.5);
      ctx.lineWidth = 1.5 + r() * 1.5;
      wrapped(ctx, (ox, oy) => {
        ctx.beginPath();
        // Arco aplastado 2:1 como una cresta vista con la cámara del mundo.
        ctx.ellipse(x + ox, y + oy, len, len * 0.3, 0, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      });
    }
  });
}

export class Water {
  readonly view = new Container();
  private readonly deep: TilingSprite;
  private readonly crests: TilingSprite;
  private palette: SeaPalette;

  /** `palette`: los colores del mar del mundo (T17); por defecto, los de la demo. */
  constructor(palette: SeaPalette = DEFAULT_SEA) {
    this.palette = palette;
    this.deep = new TilingSprite({
      texture: waveLayer(11, 38, palette.wave, 0.55, palette.base),
      width: 1,
      height: 1,
    });
    this.crests = new TilingSprite({
      texture: waveLayer(29, 16, palette.crest, 0.55),
      width: 1,
      height: 1,
    });
    this.view.addChild(this.deep, this.crests);
  }

  /** Cambia los colores del mar en caliente (cambio de mundo). */
  setPalette(palette: SeaPalette): void {
    const p = this.palette;
    if (p.base === palette.base && p.wave === palette.wave && p.crest === palette.crest) return;
    this.palette = palette;
    const old = [this.deep.texture, this.crests.texture];
    this.deep.texture = waveLayer(11, 38, palette.wave, 0.55, palette.base);
    this.crests.texture = waveLayer(29, 16, palette.crest, 0.55);
    for (const t of old) t.destroy(true);
  }

  /** `camX/camY`: posición de la cámara en px de pantalla; `t` en segundos. */
  update(width: number, height: number, camX: number, camY: number, t: number): void {
    for (const s of [this.deep, this.crests]) {
      s.width = width;
      s.height = height;
    }
    this.deep.tilePosition.set(-camX + t * 5, -camY + t * 2 + Math.sin(t * 0.7) * 3);
    this.crests.tilePosition.set(-camX - t * 11, -camY + t * 4 + Math.sin(t * 1.3 + 1) * 4);
    this.crests.alpha = 0.75 + Math.sin(t * 0.9) * 0.2;
  }
}
