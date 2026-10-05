import {
  DROP_IDS,
  type DropId,
  type SurvivorsConfig,
  type SurvivorsSnapshot,
} from '@boia/engine/survivors';
import type { QualityTier } from '@boia/engine/streaming';
import {
  BoxGeometry,
  type BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  type InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  TorusGeometry,
} from 'three';
import { toScene } from './compress';
import { Kit } from './kit';
import { C } from './palette';
import { instanced, propsMaterial } from './survivors-props';

/**
 * El botín de las élites en el mar 3D (plan 012, T135): los tres objetos que
 * flotan (Imán total, Llama y Salvavidas), hechos en código con el `Kit` como
 * las demás piezas del Cañón, y la llama delante del barco mientras dura.
 * Todo instanciado (una pieza por tipo, del tamaño del tope del botín) y sin
 * crear nada por fotograma. La llama es un abanico de lenguas planas y una
 * mancha en el agua, de opacidad fija (sin destellos, REQ-AVE-039); con
 * movimiento reducido, ni vaivén ni chisporroteo.
 */

/** Colores del botín: el aro dorado que lo distingue de las notas y los de cada objeto. */
export const PICKUP_COLORS = {
  ring: C.gold,
  magnet: '#e8303f',
  magnetTip: '#dfe6ee',
  brazier: '#3a3340',
  flame: '#ff8a1f',
  flameCore: '#ffd650',
  lifeRing: '#ff4a2e',
  lifeBand: '#ffffff',
} as const;

/** Las lenguas de la llama, de dentro afuera: amarillo, naranja y rojo. */
export const FLAME_COLORS = ['#ffe066', '#ff9a1f', '#ff4a1f'] as const;
/** Opacidad fija de la llama y de su mancha en el agua. */
export const FLAME_OPACITY = { tongue: 0.85, glow: 0.4 } as const;
/** La mancha en el agua: naranja claro (sobre el azul del mar, uno oscuro se ve gris). */
export const FLAME_GLOW = '#ffc04d';

/** Lenguas de la llama por calidad. */
export function flameTongues(quality: QualityTier): number {
  return quality === 'baja' ? 4 : 7;
}

/** Tamaño de un objeto en la escena sobre su radio de toque. */
export const PICKUP_SCALE = 1.15;
/** Altura a la que flota (escena) y cuánto se mece sin movimiento reducido. */
export const PICKUP_Y = 0.25;
export const PICKUP_BOB = 0.15;
/** s finales en que un objeto que se va a hundir encoge (sin parpadear). */
export const PICKUP_SINK_S = 3;
/** Altura de la llama sobre el agua (escena). */
export const FLAME_Y = 0.6;

/** El aro dorado del botín sobre el agua (radio 1): lo que dice «esto se coge». */
function goldRing(k: Kit): void {
  const ring = new TorusGeometry(0.95, 0.08, 4, 20);
  k.add(ring, PICKUP_COLORS.ring, { p: [0, -0.15, 0], r: [Math.PI / 2, 0, 0] });
  ring.dispose();
}

/** Imán total: un imán de herradura rojo con las puntas plateadas, de pie. Radio ~1. */
export function imanGeometry(): BufferGeometry {
  const k = new Kit();
  const arc = new TorusGeometry(0.42, 0.17, 6, 12, Math.PI);
  k.add(arc, PICKUP_COLORS.magnet, { p: [0, 0.95, 0] });
  arc.dispose();
  const leg = new BoxGeometry(0.34, 0.5, 0.34);
  const tip = new BoxGeometry(0.36, 0.2, 0.36);
  for (const x of [-0.42, 0.42]) {
    k.add(leg, PICKUP_COLORS.magnet, { p: [x, 0.7, 0] });
    k.add(tip, PICKUP_COLORS.magnetTip, { p: [x, 0.38, 0] });
  }
  leg.dispose();
  tip.dispose();
  goldRing(k);
  return k.build();
}

/** Llama: un brasero bajo con una llama de dos conos. Radio ~1. */
export function llamaGeometry(): BufferGeometry {
  const k = new Kit();
  const cup = new CylinderGeometry(0.5, 0.32, 0.4, 8);
  k.add(cup, PICKUP_COLORS.brazier, { p: [0, 0.2, 0] });
  cup.dispose();
  const outer = new ConeGeometry(0.42, 1.1, 7);
  k.add(outer, PICKUP_COLORS.flame, { p: [0, 0.95, 0] });
  outer.dispose();
  const inner = new ConeGeometry(0.24, 0.7, 6);
  k.add(inner, PICKUP_COLORS.flameCore, { p: [0, 0.8, 0.12] });
  inner.dispose();
  goldRing(k);
  return k.build();
}

/** Salvavidas: un aro rojo con cuatro bandas blancas, recostado hacia la cámara. Radio ~1. */
export function salvavidasGeometry(): BufferGeometry {
  const k = new Kit();
  const tube = new TorusGeometry(0.55, 0.2, 6, 16);
  k.add(tube, PICKUP_COLORS.lifeRing, { p: [0, 0.6, 0], r: [-0.5, 0, 0] });
  tube.dispose();
  const band = new BoxGeometry(0.2, 0.46, 0.46);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    // En el plano del aro (x, y antes de recostarlo), recostado igual que él.
    const x = Math.cos(a) * 0.55;
    const y = Math.sin(a) * 0.55;
    k.add(band, PICKUP_COLORS.lifeBand, {
      p: [x, 0.6 + y * Math.cos(0.5), -y * Math.sin(0.5)],
      r: [-0.5, 0, a],
    });
  }
  band.dispose();
  goldRing(k);
  return k.build();
}

const BUILDERS: Readonly<Record<DropId, () => BufferGeometry>> = {
  iman: imanGeometry,
  llama: llamaGeometry,
  salvavidas: salvavidasGeometry,
};

export function pickupGeometry(item: DropId): BufferGeometry {
  return BUILDERS[item]();
}

/** Una lengua de la llama: un cono plano que nace en x = 0 y acaba en punta en x = 1. */
export function flameTongueGeometry(): BufferGeometry {
  const g = new ConeGeometry(0.5, 1, 6);
  g.rotateZ(-Math.PI / 2);
  g.translate(0.5, 0, 0);
  g.scale(1, 0.35, 1);
  return g;
}

/** La mancha de la llama en el agua: el sector de radio 1 y medio ángulo `halfAngle`, hacia +x. */
export function flameGlowGeometry(halfAngle: number): BufferGeometry {
  const g = new CircleGeometry(1, 12, -halfAngle, halfAngle * 2);
  g.rotateX(-Math.PI / 2);
  return g;
}

function flameMaterial(opacity: number, color: string): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: DoubleSide,
  });
}

export class SurvivorsPickups {
  readonly quality: QualityTier;
  private readonly items: InstancedMesh[];
  private readonly tongues: InstancedMesh;
  private readonly glow: InstancedMesh;
  private readonly counts: number[];
  private readonly size: number;
  private readonly dummy = new Object3D();
  private readonly groundAt: (x: number, z: number) => number;

  constructor(
    config: SurvivorsConfig,
    quality: QualityTier = 'alta',
    groundAt: (x: number, z: number) => number = () => 0,
  ) {
    this.quality = quality;
    this.groundAt = groundAt;
    this.dummy.rotation.order = 'YXZ';
    const cap = Math.max(1, config.drops.max);
    this.items = DROP_IDS.map((id) =>
      instanced(pickupGeometry(id), propsMaterial(), cap, `survivors-pickup-${id}`),
    );
    this.counts = DROP_IDS.map(() => 0);
    this.size = toScene(config.drops.radius) * PICKUP_SCALE;
    const n = flameTongues(quality);
    this.tongues = instanced(
      flameTongueGeometry(),
      flameMaterial(FLAME_OPACITY.tongue, '#ffffff'),
      n,
      'survivors-flame',
    );
    for (let i = 0; i < n; i++) {
      this.tongues.setColorAt(i, new Color(FLAME_COLORS[i % FLAME_COLORS.length]!));
    }
    this.glow = instanced(
      flameGlowGeometry(config.drops.llama.halfAngle),
      flameMaterial(FLAME_OPACITY.glow, FLAME_GLOW),
      1,
      'survivors-flame-glow',
    );
  }

  /** Las piezas, para que la vista las cuelgue de su grupo. */
  get meshes(): InstancedMesh[] {
    return [...this.items, this.glow, this.tongues];
  }

  update(s: SurvivorsSnapshot, t: number, reduced: boolean): void {
    this.updateItems(s, t, reduced);
    this.updateFlame(s, t, reduced);
  }

  private updateItems(s: SurvivorsSnapshot, t: number, reduced: boolean): void {
    const d = this.dummy;
    const counts = this.counts;
    for (let i = 0; i < counts.length; i++) counts[i] = 0;
    for (const o of s.pickups) {
      const k = DROP_IDS.indexOf(o.item);
      const mesh = this.items[k];
      if (!mesh || counts[k]! >= mesh.instanceMatrix.count) continue;
      const x = toScene(o.x);
      const z = toScene(o.y);
      const bob = reduced ? 0 : Math.sin(t * 2.4 + o.id) * PICKUP_BOB;
      d.position.set(x, PICKUP_Y + bob, z);
      d.rotation.set(0, reduced ? 0 : t * 1.2 + o.id, 0);
      // Se va hundiendo: encoge en sus últimos segundos (sin parpadear).
      const sink = Math.min(1, Math.max(0.35, o.lifeS / PICKUP_SINK_S));
      d.scale.setScalar(this.size * sink);
      d.updateMatrix();
      mesh.setMatrixAt(counts[k]!++, d.matrix);
    }
    this.items.forEach((m, i) => show(m, counts[i]!));
  }

  private updateFlame(s: SurvivorsSnapshot, t: number, reduced: boolean): void {
    const f = s.flame;
    if (!f || f.leftS <= 0) {
      show(this.tongues, 0);
      show(this.glow, 0);
      return;
    }
    const d = this.dummy;
    const x = toScene(f.x);
    const z = toScene(f.y);
    const range = toScene(f.range);
    // Entra y se apaga en un instante corto: crece y encoge, nunca parpadea.
    const fade = Math.min(1, f.leftS / 0.3, (f.durationS - f.leftS) / 0.15 + 0.2);
    const ground = Math.max(0, this.groundAt(x, z));
    d.position.set(x, ground + 0.12, z);
    d.rotation.set(0, -f.heading, 0);
    d.scale.set(range * fade, 1, range * fade);
    d.updateMatrix();
    this.glow.setMatrixAt(0, d.matrix);
    show(this.glow, 1);
    const n = this.tongues.instanceMatrix.count;
    const width = range * Math.tan(f.halfAngle) * (2 / Math.max(2, n - 1));
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
      const a = f.heading + u * f.halfAngle * 0.85;
      const flicker = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 17 + i * 2.3);
      // Las de los lados, algo más cortas: la llama acaba en punta.
      const len = range * fade * flicker * (1 - 0.25 * u * u);
      d.position.set(x, ground + FLAME_Y, z);
      d.rotation.set(0, -a, 0);
      d.scale.set(len, Math.max(0.6, width), Math.max(0.6, width));
      d.updateMatrix();
      this.tongues.setMatrixAt(i, d.matrix);
    }
    show(this.tongues, n);
  }
}

function show(mesh: InstancedMesh, n: number): void {
  mesh.count = n;
  mesh.visible = n > 0;
  mesh.instanceMatrix.needsUpdate = true;
}
