import { Container, Graphics, Text } from 'pixi.js';
import { BOIA_NAVY, BOIA_ORANGE } from '../ship/provisional';
import type { DialogueView } from './runtime';

const MAX_W = 230;
const PAD = 10;
const TAIL = 10;
const MARGIN = 8;
const SKIP_W = 64;
const SKIP_H = 30;
/** Radio del × de cerrar (D-22), en la esquina de arriba a la derecha. */
const CLOSE_R = 13;

/**
 * Bocadillo del diálogo en coordenadas de pantalla, encima del anclaje del
 * objeto que habla. Tocar el bocadillo avanza; tocar «Saltar» o el × de la
 * esquina (D-22) lo cierran.
 * No es modal: el resto de la pantalla sigue siendo el joystick (§7).
 */
export class BubbleView {
  readonly view = new Container();
  private readonly bg = new Graphics();
  private readonly text: Text;
  private readonly skip = new Container();
  private readonly close = new Container();
  private box = { x: 0, y: 0, w: 0, h: 0 };
  private closeAt = { x: 0, y: 0 };
  private skipBox = { x: 0, y: 0, w: SKIP_W, h: SKIP_H };
  private current: string | null = null;

  constructor() {
    this.text = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 19,
        fill: BOIA_NAVY,
        wordWrap: true,
        wordWrapWidth: MAX_W - PAD * 2,
      },
    });
    const skipBg = new Graphics()
      .roundRect(0, 0, SKIP_W, SKIP_H, SKIP_H / 2)
      .fill({ color: BOIA_NAVY, alpha: 0.85 });
    const skipText = new Text({
      text: 'Saltar',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        fontWeight: '700',
        fill: 0xffffff,
      },
    });
    skipText.anchor.set(0.5);
    skipText.position.set(SKIP_W / 2, SKIP_H / 2);
    this.skip.addChild(skipBg, skipText);
    const closeBg = new Graphics()
      .circle(0, 0, CLOSE_R)
      .fill({ color: BOIA_NAVY })
      .stroke({ width: 2, color: 0xfffaf0 });
    const cross = new Graphics()
      .moveTo(-4.5, -4.5)
      .lineTo(4.5, 4.5)
      .moveTo(4.5, -4.5)
      .lineTo(-4.5, 4.5)
      .stroke({ width: 2.4, color: 0xffffff, cap: 'round' });
    this.close.addChild(closeBg, cross);
    this.view.addChild(this.bg, this.text, this.skip, this.close);
    this.view.visible = false;
  }

  /**
   * Muestra `d` con la cola apuntando a (ax, ay) en px de pantalla, dentro de
   * una pantalla de `width` px. `null` oculta el bocadillo.
   */
  show(d: DialogueView | null, ax: number, ay: number, width: number): void {
    if (!d) {
      this.view.visible = false;
      this.current = null;
      return;
    }
    const key = `${d.objectId}|${d.index}|${d.reaction}|${d.text}`;
    if (key !== this.current) {
      this.current = key;
      this.text.text = d.text;
    }
    const w = Math.min(MAX_W, Math.ceil(this.text.width) + PAD * 2);
    const h = Math.ceil(this.text.height) + PAD * 2;
    const x = Math.min(Math.max(ax - w / 2, MARGIN), Math.max(MARGIN, width - w - MARGIN));
    const y = Math.max(MARGIN, ay - TAIL - h);
    const tipX = Math.min(Math.max(ax, x + 12), x + w - 12);
    this.box = { x, y, w, h };

    const g = this.bg;
    g.clear();
    g.roundRect(x, y, w, h, 12)
      .fill({ color: 0xfffaf0 })
      .stroke({ width: 2, color: d.reaction ? BOIA_ORANGE : BOIA_NAVY });
    g.poly([tipX - 7, y + h - 1, tipX + 7, y + h - 1, ax, Math.max(y + h + 2, ay)])
      .fill({ color: 0xfffaf0 })
      .stroke({ width: 2, color: d.reaction ? BOIA_ORANGE : BOIA_NAVY });
    // Tapa la costura entre la cola y el borde inferior del globo.
    g.rect(tipX - 6, y + h - 3, 12, 3).fill({ color: 0xfffaf0 });
    this.text.position.set(x + PAD, y + PAD);

    // «Saltar» debajo a la derecha, lejos de la cola si se puede.
    const sx = tipX > x + w / 2 ? x : x + w - SKIP_W;
    const sy = y + h + 6;
    this.skipBox = { x: sx, y: sy, w: SKIP_W, h: SKIP_H };
    this.skip.position.set(sx, sy);
    this.skip.visible = !d.reaction && d.index < d.count - 1;
    // × en la esquina de arriba a la derecha, siempre (también en la última línea).
    this.closeAt = { x: x + w - 4, y: Math.max(CLOSE_R + 2, y + 4) };
    this.close.position.set(this.closeAt.x, this.closeAt.y);
    this.view.visible = true;
  }

  /** Qué hay bajo el punto (px de pantalla): avanzar, saltar (o el ×) o nada. */
  hit(px: number, py: number): 'advance' | 'skip' | null {
    if (!this.view.visible) return null;
    if (Math.hypot(px - this.closeAt.x, py - this.closeAt.y) <= CLOSE_R + 8) return 'skip';
    const inside = (b: { x: number; y: number; w: number; h: number }, pad: number) =>
      px >= b.x - pad && px <= b.x + b.w + pad && py >= b.y - pad && py <= b.y + b.h + pad;
    if (this.skip.visible && inside(this.skipBox, 6)) return 'skip';
    if (inside(this.box, 6)) return 'advance';
    return null;
  }
}
