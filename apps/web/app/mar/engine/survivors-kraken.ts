import {
  type BossView,
  type KrakenView,
  ROCK_ATTACK,
  type SurvivorsSnapshot,
  type SurvivorsWorld,
} from '@boia/engine/survivors';
import type { QualityTier } from '@boia/engine/streaming';
import {
  type BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  type InstancedMesh,
  type Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  RingGeometry,
  SphereGeometry,
} from 'three';
import { litMaterial } from './characters';
import { toScene } from './compress';
import { Kit, type Place } from './kit';
import { instanced } from './survivors-props';
import { wrapD } from './wrap';

/**
 * El Kraken en el mar 3D (plan 012 T142): lo que la simulación cuenta en
 * `BossView.kraken` (T141), pintado barato y legible.
 *
 * - **Sumergido**: una sombra oscura bajo el agua que persigue al barco
 *   (un disco alargado, opacidad fija). Al salir o hundirse, la sombra se
 *   encoge o crece y la cabeza sube o baja con el progreso del modo.
 * - **Fuera** (`emerged` / `grabbing`): la cabeza (una pieza low-poly con
 *   ojos) asomando; con la cabeza **expuesta** sube un poco más y la rodea
 *   un aro dorado fijo (sin parpadeos: es la ventana de daño).
 * - **Tentáculos**: cada aviso de la simulación es un círculo en el agua
 *   (aro y relleno que crece con el progreso); al subir, el tentáculo sale
 *   del círculo (dos piezas instanciadas, base y punta, que se doblan); con
 *   movimiento reducido no se mecen.
 * - **Rocas**: un círculo de caída por roca (otro color) y la roca volando
 *   en arco desde el Kraken; con movimiento reducido no giran.
 * - **Agarre**: dos brazos tendidos sobre la isla agarrada.
 *
 * Seis piezas en total (cabeza, sombra, aro, tentáculos ×2, rocas, avisos
 * ×2), nada se crea durante `update`. Una pieza vacía no se pinta.
 */

/** Colores muestra: morado de pulpo, ventosas claras, ojos de pez, rocas grises. */
export const KRAKEN_COLORS = {
  skin: '#6d2f63',
  spots: '#4d1f47',
  belly: '#c47aa6',
  eye: '#fff4d6',
  pupil: '#1d1724',
  tentacle: '#7d3a71',
  sucker: '#e3a9c4',
  rock: '#77706a',
  shadow: '#07101d',
  exposed: '#ffd23f',
  tentacleWarning: '#ff4a2e',
  rockWarning: '#ffb02e',
} as const;

/** Escala de la cabeza sobre el radio del boss (escena). */
export const KRAKEN_HEAD_SCALE = 1;
/** Altura de la cabeza (sobre el radio): fuera, expuesta y del todo bajo el agua. */
export const KRAKEN_HEAD_Y = { out: -0.3, exposed: 0.15, under: -2.4 } as const;
/** La sombra: largo y ancho sobre el radio, y su opacidad fija. */
export const KRAKEN_SHADOW = { length: 1.7, width: 1.15, opacity: 0.5 } as const;
/** Alto y grueso de un tentáculo sobre el radio de su círculo. */
export const TENTACLE_SIZE = { height: 2.6, width: 0.55 } as const;
/** Tamaño de una roca sobre el radio de su círculo de caída; altura del arco sobre el vuelo (escena). */
export const ROCK_SIZE = 0.38;
export const ROCK_ARC = 0.35;
/** Topes de piezas: tentáculos (más los dos brazos del agarre), rocas y círculos de aviso. */
export const KRAKEN_TENTACLE_CAP = 10;
export const KRAKEN_ROCK_CAP = 8;
export const KRAKEN_CIRCLE_CAP = 16;
/** Brazos tendidos sobre la isla al agarrarla. */
export const GRAB_ARMS = 2;
/** Opacidad del relleno de los círculos de aviso y del aro. */
const FILL_OPACITY = 0.35;
const TRACK_OPACITY = 0.9;
/** Altura sobre el agua de lo plano (escena). */
const FLAT_Y = { shadow: 0.04, fill: 0.09, track: 0.11, ring: 0.13 } as const;
/** Lo que tarda la cabeza en subir o bajar entre «fuera» y «expuesta» (escena/s, en radios). */
const HEAD_RISE_PER_S = 1.6;

function addTo(k: Kit, g: BufferGeometry, color: string, at: Place): void {
  k.add(g, color, at);
  g.dispose();
}

/** La cabeza: un manto en cúpula con manchas, el morro claro y dos ojos mirando a +x. Radio ≈ 1. */
export function krakenHeadGeometry(quality: QualityTier = 'alta'): BufferGeometry {
  const k = new Kit();
  const c = KRAKEN_COLORS;
  const seg = quality === 'baja' ? 7 : 9;
  addTo(k, new SphereGeometry(1, seg, 6), c.skin, { p: [-0.15, 0.55, 0], s: [1.05, 1.25, 0.95] });
  addTo(k, new SphereGeometry(0.7, seg, 5), c.belly, { p: [0.35, 0.2, 0], s: [0.9, 0.7, 1.1] });
  for (const [x, y, z, r] of [
    [-0.5, 1.5, 0.3, 0.2],
    [-0.1, 1.65, -0.35, 0.17],
    [-0.75, 1.0, -0.55, 0.16],
  ] as const) {
    addTo(k, new SphereGeometry(r, 5, 4), c.spots, { p: [x, y, z] });
  }
  for (const side of [-1, 1]) {
    addTo(k, new SphereGeometry(0.26, 7, 5), c.eye, { p: [0.62, 0.8, side * 0.42] });
    addTo(k, new SphereGeometry(0.13, 5, 4), c.pupil, { p: [0.84, 0.8, side * 0.42] });
  }
  return k.build();
}

/** Base de un tentáculo: de y = 0 a y = 1, gruesa abajo, con ventosas del lado +x. */
export function tentacleBaseGeometry(quality: QualityTier = 'alta'): BufferGeometry {
  const k = new Kit();
  const c = KRAKEN_COLORS;
  const radial = quality === 'baja' ? 5 : 6;
  addTo(k, new CylinderGeometry(0.62, 1, 1, radial), c.tentacle, { p: [0, 0.5, 0] });
  for (const y of [0.3, 0.7]) addTo(k, new SphereGeometry(0.2, 4, 3), c.sucker, { p: [0.8 - y * 0.2, y, 0] });
  return k.build();
}

/** Punta de un tentáculo: de y = 0 a y = 1, afilada, con una ventosa. */
export function tentacleTipGeometry(quality: QualityTier = 'alta'): BufferGeometry {
  const k = new Kit();
  const c = KRAKEN_COLORS;
  const radial = quality === 'baja' ? 5 : 6;
  addTo(k, new CylinderGeometry(0.08, 0.62, 1, radial), c.tentacle, { p: [0, 0.5, 0] });
  addTo(k, new SphereGeometry(0.15, 4, 3), c.sucker, { p: [0.45, 0.35, 0] });
  return k.build();
}

export function rockGeometry(): BufferGeometry {
  const k = new Kit();
  addTo(k, new IcosahedronGeometry(1, 0), KRAKEN_COLORS.rock, { s: [1, 0.8, 0.9] });
  return k.build();
}

/** Plano de cara arriba (en y = 0). */
function flat<G extends BufferGeometry>(g: G): G {
  g.rotateX(-Math.PI / 2);
  return g;
}

function basic(color: string, opacity: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: DoubleSide,
  });
}

/** El Kraken del snapshot (el primero), o null. */
export function krakenOf(s: Pick<SurvivorsSnapshot, 'bosses'>): (BossView & { kraken: KrakenView }) | null {
  for (const b of s.bosses) if (b.kraken) return b as BossView & { kraken: KrakenView };
  return null;
}

/** Cuánto asoma la cabeza (0 bajo el agua … 1 fuera) en un modo con su progreso. */
export function headOut(mode: KrakenView['mode'], progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  if (mode === 'emerging') return p;
  if (mode === 'diving') return 1 - p;
  return mode === 'submerged' ? 0 : 1;
}

/** Suavizado de entrada/salida (0…1). */
const ease = (p: number) => {
  const x = Math.min(1, Math.max(0, p));
  return x * x * (3 - 2 * x);
};

export class SurvivorsKraken {
  readonly group = new Group();
  readonly head: Mesh;
  readonly shadow: Mesh;
  readonly exposedRing: Mesh;
  readonly tentacleBase: InstancedMesh;
  readonly tentacleTip: InstancedMesh;
  readonly rocks: InstancedMesh;
  readonly circleTrack: InstancedMesh;
  readonly circleFill: InstancedMesh;
  private readonly sea: Pick<SurvivorsWorld, 'bounds' | 'obstacles'> | null;
  private readonly base = new Object3D();
  private readonly tip = new Object3D();
  private readonly d = new Object3D();
  private readonly tentacleColor = new Color(KRAKEN_COLORS.tentacleWarning);
  private readonly rockColor = new Color(KRAKEN_COLORS.rockWarning);
  /** Altura de la cabeza ahora (en radios), para subir y bajar suave entre «fuera» y «expuesta». */
  private headLift: number = KRAKEN_HEAD_Y.out;
  private lastT = 0;

  constructor(quality: QualityTier, sea: Pick<SurvivorsWorld, 'bounds' | 'obstacles'> | null = null) {
    this.sea = sea;
    this.group.name = 'survivors-kraken';
    this.head = new Mesh(krakenHeadGeometry(quality), litMaterial());
    this.head.name = 'survivors-boss-kraken';
    this.head.rotation.order = 'YXZ';
    this.shadow = new Mesh(flat(new CircleGeometry(1, quality === 'baja' ? 12 : 20)), basic(KRAKEN_COLORS.shadow, KRAKEN_SHADOW.opacity));
    this.shadow.name = 'survivors-kraken-shadow';
    this.shadow.renderOrder = -1;
    this.exposedRing = new Mesh(
      flat(new RingGeometry(1.05, 1.3, quality === 'baja' ? 20 : 32)),
      basic(KRAKEN_COLORS.exposed, TRACK_OPACITY),
    );
    this.exposedRing.name = 'survivors-kraken-exposed';
    const tentacleMat = litMaterial();
    this.tentacleBase = instanced(tentacleBaseGeometry(quality), tentacleMat, KRAKEN_TENTACLE_CAP, 'survivors-kraken-tentacle');
    this.tentacleTip = instanced(tentacleTipGeometry(quality), tentacleMat, KRAKEN_TENTACLE_CAP, 'survivors-kraken-tentacle-tip');
    this.rocks = instanced(rockGeometry(), litMaterial(), KRAKEN_ROCK_CAP, 'survivors-kraken-rock');
    const seg = quality === 'baja' ? 20 : 32;
    this.circleTrack = instanced(
      flat(new RingGeometry(0.9, 1, seg)),
      basic('#ffffff', TRACK_OPACITY),
      KRAKEN_CIRCLE_CAP,
      'survivors-kraken-circle',
    );
    this.circleFill = instanced(
      flat(new CircleGeometry(1, seg)),
      basic('#ffffff', FILL_OPACITY),
      KRAKEN_CIRCLE_CAP,
      'survivors-kraken-circle-fill',
    );
    for (let i = 0; i < KRAKEN_CIRCLE_CAP; i++) {
      this.circleTrack.setColorAt(i, this.tentacleColor);
      this.circleFill.setColorAt(i, this.tentacleColor);
    }
    this.base.add(this.tip);
    this.base.rotation.order = 'YXZ';
    this.d.rotation.order = 'YXZ';
    for (const m of [this.head, this.shadow, this.exposedRing]) m.visible = false;
    for (const m of this.instancedMeshes()) m.visible = false;
    this.group.add(
      this.shadow,
      this.circleFill,
      this.circleTrack,
      this.exposedRing,
      this.head,
      this.tentacleBase,
      this.tentacleTip,
      this.rocks,
    );
  }

  instancedMeshes(): InstancedMesh[] {
    return [this.tentacleBase, this.tentacleTip, this.rocks, this.circleTrack, this.circleFill];
  }

  /** ¿Se ve ahora algo del Kraken (la cabeza o su sombra)? El modo, para las pruebas. */
  shown(): { mesh: Mesh; mode: string } | null {
    if (this.head.visible) return { mesh: this.head, mode: 'head' };
    if (this.shadow.visible) return { mesh: this.shadow, mode: 'shadow' };
    return null;
  }

  update(s: SurvivorsSnapshot, t: number, reduced: boolean): void {
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    const b = krakenOf(s);
    if (!b) {
      this.head.visible = this.shadow.visible = this.exposedRing.visible = false;
      for (const m of this.instancedMeshes()) show(m, 0);
      this.headLift = KRAKEN_HEAD_Y.out;
      return;
    }
    const k = b.kraken;
    const r = toScene(b.radius);
    const x = toScene(b.x);
    const z = toScene(b.y);
    const out = headOut(k.mode, k.progress);
    const solid = k.mode === 'emerged' || k.mode === 'grabbing';

    // La sombra: sumergido, saliendo o hundiéndose; se encoge al salir.
    this.shadow.visible = out < 1;
    if (this.shadow.visible) {
      const wobble = reduced ? 0 : Math.sin(t * 2.2 + b.id) * 0.06;
      const k2 = 1 - 0.45 * ease(out);
      this.shadow.position.set(x, FLAT_Y.shadow, z);
      this.shadow.rotation.set(0, -b.heading, 0);
      this.shadow.scale.set(r * KRAKEN_SHADOW.length * k2 * (1 + wobble), 1, r * KRAKEN_SHADOW.width * k2 * (1 - wobble));
    }

    // La cabeza: sube con el progreso; fuera, más alta con la cabeza expuesta.
    const goal = solid && k.exposed ? KRAKEN_HEAD_Y.exposed : KRAKEN_HEAD_Y.out;
    if (reduced) this.headLift = goal;
    else {
      const step = HEAD_RISE_PER_S * dt;
      this.headLift = goal > this.headLift ? Math.min(goal, this.headLift + step) : Math.max(goal, this.headLift - step);
    }
    this.head.visible = out > 0;
    if (this.head.visible) {
      const lift = KRAKEN_HEAD_Y.under + (this.headLift - KRAKEN_HEAD_Y.under) * ease(out);
      const bob = reduced ? 0 : Math.sin(t * 1.3 + b.id) * 0.05;
      this.head.position.set(x, (lift + bob) * r, z);
      this.head.rotation.set(0, -b.heading, reduced ? 0 : Math.sin(t * 0.8 + b.id) * 0.04);
      this.head.scale.setScalar(r * KRAKEN_HEAD_SCALE);
    }
    this.exposedRing.visible = solid && k.exposed;
    if (this.exposedRing.visible) {
      this.exposedRing.position.set(x, FLAT_Y.ring, z);
      this.exposedRing.scale.setScalar(r);
    }

    this.updateTentacles(b, t, reduced);
    this.updateRocks(b, t, reduced);
    this.updateCircles(s);
  }

  /** Los tentáculos que suben, están arriba o bajan, y los brazos del agarre. */
  private updateTentacles(b: BossView & { kraken: KrakenView }, t: number, reduced: boolean): void {
    const k = b.kraken;
    const cap = this.tentacleBase.instanceMatrix.count;
    let n = 0;
    for (const tv of k.tentacles) {
      if (n >= cap) break;
      if (tv.stage === 'warning') continue;
      // Subiendo, el progreso es lo que ha salido; arriba, entero; bajando, lo que queda fuera.
      const rise = tv.stage === 'up' ? 1 : ease(tv.progress);
      if (rise <= 0.001) continue;
      const tr = toScene(tv.radius);
      const sway = reduced ? 0 : Math.sin(t * 2 + tv.id * 1.7) * 0.18;
      const curl = reduced ? 0.55 : 0.55 + Math.sin(t * 2.6 + tv.id) * 0.3;
      // Mira hacia el centro del Kraken: la ventosa (+x) hacia el barco, que está al otro lado.
      const face = Math.atan2(toScene(b.y) - toScene(tv.y), toScene(b.x) - toScene(tv.x));
      this.placeTentacle(
        n++,
        toScene(tv.x),
        toScene(tv.y),
        face + Math.PI,
        sway,
        reduced ? 0 : Math.cos(t * 1.6 + tv.id) * 0.12,
        curl,
        tr * TENTACLE_SIZE.width,
        tr * TENTACLE_SIZE.height * rise,
      );
    }
    if (k.mode === 'grabbing' && k.island >= 0) {
      const dir = this.islandDir(b, k.island);
      const out = headOut(k.mode, k.progress);
      const r = toScene(b.radius);
      for (let a = 0; a < GRAB_ARMS && n < cap; a++) {
        const side = a === 0 ? -1 : 1;
        const ox = Math.cos(dir + side * 0.55) * r * 0.7;
        const oz = Math.sin(dir + side * 0.55) * r * 0.7;
        const reach = reduced ? 0 : Math.sin(t * 1.1 + a) * 0.05;
        // Tendido hacia la isla: inclinado casi tumbado y la punta doblada hacia abajo.
        this.placeTentacle(n++, toScene(b.x) + ox, toScene(b.y) + oz, dir, 1.15 + reach, 0, 0.5, r * 0.35, r * 1.6 * out);
      }
    }
    show(this.tentacleBase, n);
    show(this.tentacleTip, n);
  }

  /**
   * Un tentáculo en (x, z): mirando a `face` (rad, como el rumbo del motor),
   * inclinado `lean` hacia delante y `roll` de lado, la punta doblada `curl`,
   * con su grueso y su alto (escena).
   */
  private placeTentacle(
    i: number,
    x: number,
    z: number,
    face: number,
    lean: number,
    roll: number,
    curl: number,
    width: number,
    height: number,
  ): void {
    const base = this.base;
    const half = height / 2;
    base.position.set(x, 0, z);
    // Rumbo y luego la inclinación: el eje +x del modelo mira a `face`; la inclinación lo tumba hacia allí.
    base.rotation.set(roll, -face, -lean);
    base.scale.set(width, Math.max(0.001, half), width);
    base.updateMatrix();
    this.tentacleBase.setMatrixAt(i, base.matrix);
    this.tip.position.set(0, 1, 0);
    this.tip.rotation.set(0, 0, -curl);
    this.tip.scale.set(0.9, 1, 0.9);
    this.tip.updateMatrix();
    this.d.matrix.multiplyMatrices(base.matrix, this.tip.matrix);
    this.tentacleTip.setMatrixAt(i, this.d.matrix);
  }

  /** Hacia dónde queda la isla agarrada desde el Kraken (rad); sin el mar, a su espalda. */
  private islandDir(b: BossView, island: number): number {
    const o = this.sea?.obstacles[island];
    if (!o || !this.sea) return b.heading + Math.PI;
    const w = this.sea.bounds.right - this.sea.bounds.left;
    const h = this.sea.bounds.bottom - this.sea.bounds.top;
    return Math.atan2(wrapD(o.y - b.y, h), wrapD(o.x - b.x, w));
  }

  /** Las rocas volando en arco desde donde las lanzó hasta su círculo. */
  private updateRocks(b: BossView & { kraken: KrakenView }, t: number, reduced: boolean): void {
    const d = this.d;
    const cap = this.rocks.instanceMatrix.count;
    const w = this.sea ? this.sea.bounds.right - this.sea.bounds.left : 0;
    const h = this.sea ? this.sea.bounds.bottom - this.sea.bounds.top : 0;
    let n = 0;
    for (const rock of b.kraken.rocks) {
      if (n >= cap) break;
      const p = Math.min(1, Math.max(0, rock.progress));
      const dx = w > 0 ? wrapD(rock.x - rock.fromX, w) : rock.x - rock.fromX;
      const dy = h > 0 ? wrapD(rock.y - rock.fromY, h) : rock.y - rock.fromY;
      const len = toScene(Math.hypot(dx, dy));
      const arc = Math.max(2, len * ROCK_ARC) * 4 * p * (1 - p);
      d.position.set(toScene(rock.x - dx * (1 - p)), arc + 0.2, toScene(rock.y - dy * (1 - p)));
      d.rotation.set(reduced ? 0 : t * 2.3 + rock.id, reduced ? 0 : t * 1.7, 0);
      d.scale.setScalar(Math.max(0.3, toScene(rock.radius) * ROCK_SIZE));
      d.updateMatrix();
      this.rocks.setMatrixAt(n++, d.matrix);
    }
    show(this.rocks, n);
  }

  /** Los círculos de aviso del Kraken (tentáculos y caídas de roca): el aro y el relleno con el progreso. */
  private updateCircles(s: SurvivorsSnapshot): void {
    const d = this.d;
    const cap = this.circleTrack.instanceMatrix.count;
    let n = 0;
    for (const w of s.bossWarnings) {
      if (n >= cap) break;
      if (w.boss !== 'kraken' || w.kind !== 'circles') continue;
      const color = w.attack === ROCK_ATTACK ? this.rockColor : this.tentacleColor;
      const r = Math.max(0.2, toScene(w.radius));
      d.rotation.set(0, 0, 0);
      d.position.set(toScene(w.x), FLAT_Y.track, toScene(w.y));
      d.scale.setScalar(r);
      d.updateMatrix();
      this.circleTrack.setMatrixAt(n, d.matrix);
      this.circleTrack.setColorAt(n, color);
      const p = w.hit ? 1 : Math.min(1, Math.max(0, w.progress));
      d.position.y = FLAT_Y.fill;
      d.scale.setScalar(Math.max(0.001, r * p));
      d.updateMatrix();
      this.circleFill.setMatrixAt(n, d.matrix);
      this.circleFill.setColorAt(n, color);
      n++;
    }
    for (const m of [this.circleTrack, this.circleFill]) {
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      show(m, n);
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    const done = new Set<unknown>();
    this.group.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      for (const r of [mesh.geometry, mesh.material as Material]) {
        if (done.has(r)) continue;
        done.add(r);
        r.dispose();
      }
      if ((mesh as unknown as InstancedMesh).isInstancedMesh) (mesh as unknown as InstancedMesh).dispose();
    });
  }
}

function show(mesh: InstancedMesh, n: number): void {
  mesh.count = n;
  mesh.visible = n > 0;
  mesh.instanceMatrix.needsUpdate = true;
}
