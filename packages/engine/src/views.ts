import { type Rect, worldToScreen } from '@boia/world';
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { CircleObstacle } from './ship/controller';
import type { JoystickView } from './input/controls';
import { BOIA_NAVY } from './ship/provisional';
import type { WakeSystem } from './wake';

/** Costas y bordes del mundo, provisionales (sin arte). */
export function drawCoasts(bounds: Rect): Graphics {
  const g = new Graphics();
  const far = 4000;
  const tl = (x: number, y: number) => worldToScreen({ x, y });
  const rect = (x0: number, y0: number, x1: number, y1: number, color: number) => {
    const a = tl(x0, y0);
    const b = tl(x1, y1);
    g.rect(a.x, a.y, b.x - a.x, b.y - a.y).fill({ color });
  };
  const top = bounds.top - far;
  const bottom = bounds.bottom + far;
  // Arena y una franja de orilla más clara pegada al agua.
  rect(bounds.left - far, top, bounds.left, bottom, 0xe7c88f);
  rect(bounds.right, top, bounds.right + far, bottom, 0xe7c88f);
  rect(bounds.left - far, bounds.bottom, bounds.right + far, bottom, 0xe7c88f);
  rect(bounds.left - 10, top, bounds.left, bounds.bottom, 0xf6e6c4);
  rect(bounds.right, top, bounds.right + 10, bounds.bottom, 0xf6e6c4);
  rect(bounds.left - 10, bounds.bottom, bounds.right + 10, bounds.bottom + 10, 0xf6e6c4);
  // Borde superior publicado: abierto, sólo una marca tenue para las pruebas.
  const a = tl(bounds.left, bounds.top);
  const b = tl(bounds.right, bounds.top);
  for (let x = a.x; x < b.x; x += 28) {
    g.moveTo(x, a.y).lineTo(Math.min(x + 14, b.x), a.y);
  }
  g.stroke({ width: 2, color: 0xffffff, alpha: 0.25 });
  return g;
}

/** Roca provisional para un obstáculo circular: base elíptica 2:1 y lomo. */
export function drawRock(o: CircleObstacle): Graphics {
  const g = new Graphics();
  const r = o.radius;
  g.ellipse(0, 0, r * 1.08, r * 0.54).fill({ color: 0xd9f3f7, alpha: 0.5 });
  g.ellipse(0, -r * 0.18, r, r * 0.5).fill({ color: 0x3b4a5c });
  g.ellipse(-r * 0.1, -r * 0.38, r * 0.72, r * 0.42).fill({ color: 0x55677b });
  g.ellipse(-r * 0.25, -r * 0.52, r * 0.3, r * 0.16).fill({ color: 0x8397ab });
  const p = worldToScreen(o);
  g.position.set(p.x, p.y);
  g.zIndex = o.y;
  return g;
}

function dotTexture(): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas 2D no disponible');
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  return Texture.from(c);
}

/** Dibuja las partículas de `WakeSystem` con un pool de sprites. */
export class WakeView {
  readonly view = new Container();
  private readonly pool: Sprite[] = [];
  private readonly texture = dotTexture();

  /** `tint`: color de la espuma (el cosmético de estela, T40); blanca por defecto. */
  sync(wake: WakeSystem, tint = 0xffffff): void {
    const ps = wake.particles;
    while (this.pool.length < ps.length) {
      const s = new Sprite(this.texture);
      s.anchor.set(0.5);
      this.pool.push(s);
      this.view.addChild(s);
    }
    for (let i = 0; i < this.pool.length; i++) {
      const s = this.pool[i]!;
      const p = ps[i];
      if (!p) {
        s.visible = false;
        continue;
      }
      const k = p.age / p.life;
      const sp = worldToScreen(p);
      s.visible = true;
      s.position.set(sp.x, sp.y);
      const size = (p.size * (1 + k * 1.6)) / 16;
      s.scale.set(size, size * 0.5);
      s.alpha = (1 - k) * 0.75;
      s.tint = tint;
    }
  }
}

/** Joystick táctil: aro donde tocó el primer dedo y pomo que sigue al dedo. */
export class JoystickOverlay {
  readonly view = new Graphics();

  constructor(private readonly radius: number) {}

  draw(j: JoystickView | null, drifting: boolean): void {
    const g = this.view;
    g.clear();
    if (!j) return;
    g.circle(j.originX, j.originY, this.radius)
      .fill({ color: 0xffffff, alpha: 0.1 })
      .stroke({ width: 2, color: 0xffffff, alpha: 0.45 });
    g.circle(j.knobX, j.knobY, 22).fill({ color: drifting ? 0xf26a1b : 0xffffff, alpha: 0.8 });
    g.circle(j.knobX, j.knobY, 22).stroke({ width: 2, color: BOIA_NAVY, alpha: 0.6 });
  }
}
