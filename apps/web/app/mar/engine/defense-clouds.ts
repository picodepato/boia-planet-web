import { Group, IcosahedronGeometry, type Material, Mesh, MeshLambertMaterial } from 'three';
import { rng, wobble } from './kit';

/**
 * Nubes que pasan por encima de la arena del castillo (plan 015 T170,
 * decisión 17): pocas, bajas y medio transparentes, para que el juego se
 * siga leyendo; derivan despacio y al salir por un lado de la arena vuelven
 * a entrar por el otro. Al acercar el zoom se apagan para no tapar la vista.
 * Con movimiento reducido no se mueven. Escena, respecto al castillo. muestra
 */

/** Altura (escena) de las nubes de la arena. muestra */
export const ARENA_CLOUD_Y = 30;
/** Opacidad con la cámara de la vista entera. muestra */
export const ARENA_CLOUD_OPACITY = 0.3;
/** Zoom de la arena (1 la vista de salida) por debajo del que ya no se ven, y desde el que se ven del todo. muestra */
export const ARENA_CLOUD_ZOOM = { off: 0.45, on: 0.8 } as const;
/** Escena/s que derivan. muestra */
const DRIFT = 2.2;
/** Rumbo de la deriva (rad, en la escena). muestra */
const DRIFT_DIR = 0.5;

export class ArenaClouds {
  readonly group = new Group();
  private readonly mat: MeshLambertMaterial;
  private readonly half: number;
  private readonly spots: { x: number; z: number }[] = [];
  /** Opacidad ahora (pruebas). */
  opacity = 0;

  /** `radius`: el de la arena (escena); `count`, cuántas. */
  constructor(radius: number, count: number) {
    this.half = radius * 1.15;
    this.group.name = 'defense-clouds';
    this.mat = new MeshLambertMaterial({
      color: '#ffffff',
      emissive: '#8f86b8',
      transparent: true,
      opacity: 0,
      flatShading: true,
      depthWrite: false,
    });
    const rnd = rng(1170);
    for (let i = 0; i < count; i++) {
      const c = new Group();
      const puffs = 3 + Math.floor(rnd() * 3);
      for (let j = 0; j < puffs; j++) {
        const s = 2.2 + rnd() * 2.8;
        const m = new Mesh(wobble(new IcosahedronGeometry(s, 1), s * 0.15, rnd), this.mat);
        m.position.set(j * s * 0.9 - puffs * s * 0.4, (rnd() - 0.5) * s * 0.4, (rnd() - 0.5) * s * 0.6);
        m.scale.set(1, 0.5, 0.8);
        c.add(m);
      }
      // Repartidas por la arena (una por franja, para que no se junten).
      this.spots.push({
        x: -this.half + ((i + rnd() * 0.6) / count) * 2 * this.half,
        z: (rnd() * 2 - 1) * this.half * 0.8,
      });
      c.position.y = ARENA_CLOUD_Y + rnd() * 6;
      this.group.add(c);
    }
  }

  /**
   * Un fotograma: `center` el castillo en la escena, `zoom` el de la arena
   * (1 la vista de salida; de cerca se apagan), `reduced` sin moverse.
   */
  update(dt: number, center: { x: number; z: number }, zoom: number, reduced: boolean): void {
    const k = Math.min(1, Math.max(0, (zoom - ARENA_CLOUD_ZOOM.off) / (ARENA_CLOUD_ZOOM.on - ARENA_CLOUD_ZOOM.off)));
    this.opacity = ARENA_CLOUD_OPACITY * k;
    this.mat.opacity = this.opacity;
    this.group.visible = this.opacity > 0.01;
    const span = 2 * this.half;
    const vx = Math.cos(DRIFT_DIR) * DRIFT;
    const vz = Math.sin(DRIFT_DIR) * DRIFT;
    const wrap = (v: number) => ((((v + this.half) % span) + span) % span) - this.half;
    this.group.children.forEach((c, i) => {
      const p = this.spots[i]!;
      if (!reduced) {
        p.x = wrap(p.x + vx * dt);
        p.z = wrap(p.z + vz * dt);
      }
      c.position.x = center.x + p.x;
      c.position.z = center.z + p.z;
    });
  }

  /** Dónde va cada nube respecto al castillo (pruebas). */
  get offsets(): readonly { x: number; z: number }[] {
    return this.spots;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => (o as Mesh).geometry?.dispose());
    (this.mat as Material).dispose();
  }
}
