import { damp } from './math';

export interface CameraConfig {
  /** s de anticipación: la cámara mira adonde estará el barco. muestra */
  lookAhead: number;
  /** u máximas de anticipación. muestra */
  maxLead: number;
  /** 1/s: rigidez del seguimiento. muestra */
  stiffness: number;
}

export const DEFAULT_CAMERA: CameraConfig = { lookAhead: 0.55, maxLead: 150, stiffness: 3.5 };

/** Cámara en coordenadas de mundo que sigue al barco con anticipación. */
export class Camera {
  x: number;
  y: number;

  constructor(
    x: number,
    y: number,
    readonly cfg: CameraConfig = DEFAULT_CAMERA,
  ) {
    this.x = x;
    this.y = y;
  }

  update(tx: number, ty: number, vx: number, vy: number, dt: number): void {
    let lx = vx * this.cfg.lookAhead;
    let ly = vy * this.cfg.lookAhead;
    const lead = Math.hypot(lx, ly);
    if (lead > this.cfg.maxLead) {
      lx *= this.cfg.maxLead / lead;
      ly *= this.cfg.maxLead / lead;
    }
    const k = damp(this.cfg.stiffness, dt);
    this.x += (tx + lx - this.x) * k;
    this.y += (ty + ly - this.y) * k;
  }
}
