import type { BossId, SurvivorsConfig, SurvivorsSnapshot } from '@boia/engine/survivors';
import {
  BoxGeometry,
  type BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  type InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { toScene } from './compress';
import { Kit } from './kit';
import { C } from './palette';
import { instanced, propsMaterial } from './survivors-props';

/**
 * El Tiburón Martillo y el cofre en el mar 3D (plan 012, T139): el miniboss
 * del 4:30 (`martillo`), el círculo con que avisa de que llama pirañas, y
 * los cofres que
 * sueltan los minibosses (la línea de aviso de sus embestidas la pinta la
 * vista con los demás avisos de boss, T140). Todo hecho en código con el `Kit` e instanciado
 * (una pieza por cosa, de tope fijo): pintar es mover matrices. Sin
 * destellos (REQ-AVE-039): los avisos crecen o se llenan, nunca parpadean;
 * con movimiento reducido el tiburón no se mece ni culebrea y el cofre no
 * gira ni flota arriba y abajo.
 */

/** El boss que pinta este módulo. */
export const SHARK_ID: BossId = 'martillo';

/** Colores del tiburón y del cofre. */
export const SHARK_COLORS = {
  back: '#5f7486',
  belly: '#e4ebef',
  fin: '#4a5d6e',
  eye: '#1b1440',
  chestWood: '#8a4f24',
  chestDark: '#5c3215',
  chestBand: C.gold,
  chestRing: C.gold,
} as const;

/** El círculo de aviso de la llamada de pirañas. */
export const SUMMON_COLOR = '#ff4a2e';
export const SUMMON_OPACITY = 0.75;

/** Tamaño del tiburón sobre su radio de choque, y su vaivén (escena). */
export const SHARK_SCALE = 1.35;
export const SHARK_BOB = 0.06;
/** El cofre: tamaño sobre su radio de toque, altura a la que flota y su vaivén. */
export const CHEST_SCALE = 1.4;
export const CHEST_Y = 0.15;
export const CHEST_BOB = 0.12;
/** Topes: tiburones a la vez y cofres. */
export const SHARK_CAP = 2;
export const CHEST_CAP = 4;

/**
 * El Tiburón Martillo: cuerpo gris azulado de vientre claro, la cabeza en
 * martillo (una barra ancha y plana al frente con un ojo en cada punta),
 * aleta dorsal alta, pectorales y cola en media luna. Mira a +x, como el pez
 * espada. Radio 1 ≈ su radio de choque.
 */
export function hammerheadGeometry(): BufferGeometry {
  const c = SHARK_COLORS;
  const k = new Kit();
  const body = new SphereGeometry(0.6, 10, 7);
  k.add(body, c.back, { p: [0, 0.3, 0], s: [2, 0.8, 0.85] });
  k.add(body, c.belly, { p: [0.1, 0.12, 0], s: [1.9, 0.55, 0.8] });
  body.dispose();
  // El martillo: una barra ancha y aplanada, algo echada hacia delante.
  const hammer = new BoxGeometry(0.45, 0.2, 1.9);
  k.add(hammer, c.back, { p: [1.25, 0.32, 0] });
  hammer.dispose();
  const snout = new ConeGeometry(0.35, 0.6, 6);
  k.add(snout, c.back, { p: [1.05, 0.3, 0], r: [0, 0, -Math.PI / 2], s: [1, 1, 0.6] });
  snout.dispose();
  const eye = new SphereGeometry(0.1, 5, 4);
  for (const s of [-1, 1]) k.add(eye, c.eye, { p: [1.3, 0.38, s * 0.95] });
  eye.dispose();
  // La aleta dorsal (alta: se ve de lejos y por encima del agua) y la segunda.
  const fin = new ConeGeometry(0.45, 1, 3);
  k.add(fin, c.fin, { p: [0.05, 1, 0], r: [0, 0, 0.3], s: [1.2, 1, 0.25] });
  k.add(fin, c.fin, { p: [-0.9, 0.62, 0], r: [0, 0, 0.4], s: [0.5, 0.4, 0.2] });
  for (const s of [-1, 1]) {
    // Pectorales.
    k.add(fin, c.fin, { p: [0.35, 0.05, s * 0.55], r: [s * 1.25, 0, 0.5], s: [0.5, 0.7, 0.25] });
    // Cola en media luna, la mitad de arriba más larga.
    k.add(fin, c.fin, {
      p: [-1.45, 0.32 + s * (s > 0 ? 0.42 : 0.28), 0],
      r: [0, 0, Math.PI / 2 + s * 0.8],
      s: [0.45, s > 0 ? 0.95 : 0.65, 0.25],
    });
  }
  fin.dispose();
  return k.build();
}

/**
 * El cofre de los minibosses: una caja de madera con la tapa abombada,
 * flejes y cierre dorados, sobre el aro dorado del botín (lo que dice «esto
 * se coge»). Radio ~1.
 */
export function chestGeometry(): BufferGeometry {
  const c = SHARK_COLORS;
  const k = new Kit();
  const box = new BoxGeometry(1.3, 0.7, 0.9);
  k.add(box, c.chestWood, { p: [0, 0.35, 0] });
  box.dispose();
  // La tapa: medio cilindro tumbado a lo largo.
  const lid = new CylinderGeometry(0.45, 0.45, 1.3, 8, 1, false, 0, Math.PI);
  k.add(lid, c.chestDark, { p: [0, 0.7, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 1] });
  lid.dispose();
  const band = new BoxGeometry(0.14, 0.74, 0.94);
  for (const x of [-0.42, 0.42]) k.add(band, c.chestBand, { p: [x, 0.35, 0] });
  band.dispose();
  const strap = new TorusGeometry(0.46, 0.06, 4, 8, Math.PI);
  for (const x of [-0.42, 0.42]) k.add(strap, c.chestBand, { p: [x, 0.7, 0], r: [0, Math.PI / 2, 0] });
  strap.dispose();
  const lock = new BoxGeometry(0.1, 0.24, 0.2);
  k.add(lock, c.chestBand, { p: [0.68, 0.62, 0] });
  lock.dispose();
  const ring = new TorusGeometry(1.05, 0.08, 4, 20);
  k.add(ring, c.chestRing, { p: [0, 0.02, 0], r: [Math.PI / 2, 0, 0] });
  ring.dispose();
  return k.build();
}

/** El círculo de aviso de una llamada: un aro plano de radio 1 sobre el agua. */
export function summonRingGeometry(): BufferGeometry {
  const g = new TorusGeometry(1, 0.06, 3, 28);
  g.rotateX(Math.PI / 2);
  return g;
}

function show(mesh: InstancedMesh, n: number): void {
  mesh.count = n;
  mesh.visible = n > 0;
  mesh.instanceMatrix.needsUpdate = true;
}

export class SurvivorsShark {
  private readonly sharks: InstancedMesh;
  private readonly rings: InstancedMesh;
  private readonly chests: InstancedMesh;
  private readonly chestSize: number;
  private readonly dummy = new Object3D();
  /** Lo que se ha visto en pantalla en la partida (`markSeen`). */
  private readonly seen = new Set<string>();

  constructor(config: SurvivorsConfig) {
    this.dummy.rotation.order = 'YXZ';
    this.sharks = instanced(hammerheadGeometry(), propsMaterial(), SHARK_CAP, 'survivors-boss-martillo');
    this.rings = instanced(
      summonRingGeometry(),
      new MeshBasicMaterial({ color: SUMMON_COLOR, transparent: true, opacity: SUMMON_OPACITY, depthWrite: false }),
      SHARK_CAP,
      'survivors-boss-summon-warning',
    );
    this.chests = instanced(chestGeometry(), propsMaterial(), CHEST_CAP, 'survivors-chest');
    this.chestSize = toScene(config.bossFight.chestRadius) * CHEST_SCALE;
  }

  /** Las piezas, para que la vista las cuelgue de su grupo. */
  get meshes(): InstancedMesh[] {
    return [this.rings, this.sharks, this.chests];
  }

  update(s: SurvivorsSnapshot, t: number, reduced: boolean): void {
    const d = this.dummy;
    // El tiburón: quieto mientras avisa; navegando culebrea un poco (nunca con movimiento reducido).
    let n = 0;
    for (const b of s.bosses) {
      if (b.boss !== SHARK_ID || n >= SHARK_CAP) continue;
      const moving = Math.hypot(b.vx, b.vy) > 1;
      const sway = reduced || !moving ? 0 : Math.sin(t * 7 + b.id) * 0.12;
      const bob = reduced ? 0 : Math.sin(t * 2.5 + b.id) * SHARK_BOB;
      d.position.set(toScene(b.x), bob, toScene(b.y));
      d.rotation.set(0, -b.heading + sway, 0);
      d.scale.setScalar(toScene(b.radius) * SHARK_SCALE);
      d.updateMatrix();
      this.sharks.setMatrixAt(n++, d.matrix);
    }
    show(this.sharks, n);
    // El círculo de la llamada del tiburón (la línea de la embestida la pinta la vista).
    let r = 0;
    for (const g of s.bossWarnings) {
      if (g.hit) continue;
      if (g.kind === 'summon' && g.boss === SHARK_ID && r < SHARK_CAP) {
        // Se cierra hacia el tiburón con el progreso (sin parpadeo; igual con movimiento reducido).
        const p = Math.min(1, Math.max(0, g.progress));
        d.position.set(toScene(g.x), 0.08, toScene(g.y));
        d.rotation.set(0, 0, 0);
        d.scale.setScalar(Math.max(0.2, toScene(g.radius) * (1.6 - 0.6 * p)));
        d.updateMatrix();
        this.rings.setMatrixAt(r++, d.matrix);
      }
    }
    show(this.rings, r);
    // Los cofres: flotan meciéndose y giran despacio (quietos con movimiento reducido).
    let c = 0;
    for (const ch of s.chests) {
      if (c >= CHEST_CAP) break;
      const bob = reduced ? 0 : Math.sin(t * 2.2 + ch.id) * CHEST_BOB;
      d.position.set(toScene(ch.x), CHEST_Y + bob, toScene(ch.y));
      d.rotation.set(0, reduced ? 0 : t * 0.8 + ch.id, 0);
      d.scale.setScalar(this.chestSize);
      d.updateMatrix();
      this.chests.setMatrixAt(c++, d.matrix);
    }
    show(this.chests, c);
  }

  /**
   * Qué se pinta ahora donde `test` dice (escena: x, y, z y radio): el
   * tiburón (`martillo`) y el cofre (`cofre`). Lo de ahora y, acumulado, lo
   * visto en la partida (para `data-canon-jefes-*` de las pruebas).
   */
  markSeen(test: (x: number, y: number, z: number, r: number) => boolean): { now: string[]; seen: string[] } {
    const now: string[] = [];
    const any = (mesh: InstancedMesh) => {
      const a = mesh.instanceMatrix.array;
      for (let i = 0; i < mesh.count; i++) {
        const o = i * 16;
        const rad = Math.hypot(a[o]!, a[o + 1]!, a[o + 2]!) * 1.5;
        if (test(a[o + 12]!, a[o + 13]!, a[o + 14]!, rad)) return true;
      }
      return false;
    };
    if (any(this.sharks)) now.push(SHARK_ID);
    if (any(this.chests)) now.push('cofre');
    for (const id of now) this.seen.add(id);
    return { now, seen: [...this.seen].sort() };
  }
}
