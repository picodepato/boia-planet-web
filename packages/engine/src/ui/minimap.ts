import { type Rect as WorldRect, type Vec2, worldToScreen } from '@boia/world';

/**
 * Minimapa (§10): la misma proyección que el motor (REQ-MUN-014), escalada
 * para que el mundo entero quepa en un cuadrado, y el gesto que distingue
 * toque (ampliar) de pulsación larga (mover).
 */

export interface MinimapProjection {
  /** Escala px de minimapa por px de pantalla del mundo. */
  scale: number;
  /** Mundo → px del minimapa (origen arriba a la izquierda). */
  project(p: Vec2): Vec2;
  /** Tamaño del mundo proyectado, ya escalado, y su desplazamiento para centrarlo. */
  content: { x: number; y: number; w: number; h: number };
}

export function minimapProjection(
  bounds: WorldRect,
  width: number,
  height: number,
  pad = 4,
): MinimapProjection {
  const a = worldToScreen({ x: bounds.left, y: bounds.top });
  const b = worldToScreen({ x: bounds.right, y: bounds.bottom });
  const ww = b.x - a.x;
  const wh = b.y - a.y;
  // Nunca negativa: un hueco más pequeño que el margen (el viewport cambiando)
  // deja el mapa en un punto, no con tamaño negativo (T29).
  const scale = Math.max(
    0,
    Math.min((width - 2 * pad) / ww, (height - 2 * pad) / wh) || 0,
  );
  const cw = ww * scale;
  const ch = wh * scale;
  const ox = (width - cw) / 2;
  const oy = (height - ch) / 2;
  return {
    scale,
    content: { x: ox, y: oy, w: cw, h: ch },
    project(p) {
      const s = worldToScreen(p);
      return { x: ox + (s.x - a.x) * scale, y: oy + (s.y - a.y) * scale };
    },
  };
}

export const LONG_PRESS_MS = 500;
/** Lo que puede moverse el dedo y seguir contando como toque o pulsación. */
export const TAP_SLOP_PX = 8;

export type GestureResult =
  { kind: 'tap' } | { kind: 'drop'; x: number; y: number } | { kind: 'cancel' };

/**
 * Qué hace soltar el minimapa de `/mar` (plan 032 T298). Normal: un toque, o
 * una pulsación larga que no se movió, abre o cierra el mapa grande; lo demás
 * no hace nada. En modo mover (Ajustes → «Mover el minimapa») nunca abre el
 * mapa: arrastrarlo lo suelta en un sitio (`drop`) y tocarlo lo cambia de lado
 * (`swap`). `still`: el dedo no se apartó más de `TAP_SLOP_PX` en todo el gesto.
 */
export type MinimapRelease = 'toggle-map' | 'drop' | 'swap' | 'none';

export function minimapRelease(o: {
  moving: boolean;
  result: GestureResult | null;
  still: boolean;
}): MinimapRelease {
  if (o.moving) return o.still ? 'swap' : 'drop';
  if (!o.result) return 'none';
  if (o.result.kind === 'tap' || (o.result.kind === 'drop' && o.still)) return 'toggle-map';
  return 'none';
}

/**
 * Toque = soltar antes de 500 ms sin moverse; pulsación larga = 500 ms
 * quieto, y entonces el dedo arrastra; si se mueve antes, no es nada (así un
 * roce del minimapa no lo abre). Tiempos en ms, posiciones en px de pantalla.
 */
export class MinimapGesture {
  private state: 'idle' | 'pressing' | 'dragging' = 'idle';
  private t0 = 0;
  private x0 = 0;
  private y0 = 0;
  private x = 0;
  private y = 0;
  private moved = false;

  get dragging(): boolean {
    return this.state === 'dragging';
  }

  get pressing(): boolean {
    return this.state === 'pressing';
  }

  /** Desplazamiento del dedo desde que empezó el arrastre. */
  offset(): { dx: number; dy: number } {
    return this.dragging ? { dx: this.x - this.x0, dy: this.y - this.y0 } : { dx: 0, dy: 0 };
  }

  down(t: number, x: number, y: number): void {
    this.state = 'pressing';
    this.t0 = t;
    this.x0 = this.x = x;
    this.y0 = this.y = y;
    this.moved = false;
  }

  /** Avanza el reloj: devuelve true si en esta llamada empieza el arrastre. */
  tick(t: number): boolean {
    if (this.state !== 'pressing' || this.moved || t - this.t0 < LONG_PRESS_MS) return false;
    this.state = 'dragging';
    // El arrastre cuenta desde donde está el dedo al cumplirse la pulsación.
    this.x0 = this.x;
    this.y0 = this.y;
    return true;
  }

  move(t: number, x: number, y: number): void {
    if (this.state === 'idle') return;
    this.tick(t);
    this.x = x;
    this.y = y;
    if (this.state === 'pressing' && Math.hypot(x - this.x0, y - this.y0) > TAP_SLOP_PX) {
      this.moved = true;
    }
  }

  up(t: number): GestureResult | null {
    if (this.state === 'idle') return null;
    this.tick(t);
    const was = this.state;
    this.state = 'idle';
    if (was === 'dragging') return { kind: 'drop', x: this.x, y: this.y };
    return this.moved ? { kind: 'cancel' } : { kind: 'tap' };
  }

  cancel(): void {
    this.state = 'idle';
  }
}
