import { vecinoRingArcs, type SurvivorsSnapshot } from '@boia/engine/survivors';
import type { QualityTier } from '@boia/engine/streaming';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  type Material,
} from 'three';
import { t } from '../../../lib/i18n';
import { litMaterial } from './characters';
import { toScene } from './compress';
import type { EnemyModel, EnemyModelState } from './enemy-models';
import { Kit, type Place } from './kit';

/** Colores muestra: barcaza naranja, megáfono crema con boca oscura. */
export const VECINO_COLORS = {
  hull: '#b95926',
  deck: '#f2bd70',
  rail: '#67472e',
  horn: '#fff1ce',
  mouth: '#332e3e',
  coat: '#5b7894',
  skin: '#e7b887',
  warning: '#edb34e',
  hit: '#ff7350',
} as const;
export const VECINO_SCALE = 1;

/** Una sola geometría low-poly: barcaza plana, vecino y enorme megáfono hacia +x. */
export function vecinoGeometry(): BufferGeometry {
  const k = new Kit();
  const c = VECINO_COLORS;
  const add = (g: BufferGeometry, color: string, at: Place) => {
    k.add(g, color, at);
    g.dispose();
  };
  add(new BoxGeometry(2.5, 0.45, 1.25), c.hull, { p: [0, 0.15, 0] });
  add(new BoxGeometry(2.6, 0.12, 1.35), c.deck, { p: [0, 0.43, 0] });
  for (const side of [-1, 1]) {
    add(new BoxGeometry(2.5, 0.16, 0.09), c.rail, { p: [0, 0.62, side * 0.62] });
    for (const x of [-0.9, 0.9])
      add(new CylinderGeometry(0.055, 0.055, 0.5, 4), c.rail, { p: [x, 0.67, side * 0.62] });
  }
  add(new BoxGeometry(0.65, 0.62, 0.55), c.coat, { p: [-0.7, 0.8, 0] });
  add(new SphereGeometry(0.24, 6, 4), c.skin, { p: [-0.7, 1.32, 0] });
  add(new BoxGeometry(0.46, 0.08, 0.45), c.mouth, { p: [-0.7, 1.54, 0] });
  add(new CylinderGeometry(0.08, 0.1, 0.8, 5), c.rail, { p: [0.25, 0.92, 0] });
  // La boca ancha apunta hacia delante. Abierta y con interior oscuro legible.
  add(new CylinderGeometry(0.65, 0.16, 1.15, 8, 1, true), c.horn, {
    p: [0.35, 1.45, 0],
    r: [0, 0, -Math.PI / 2],
  });
  add(new CylinderGeometry(0.5, 0.5, 0.04, 8), c.mouth, {
    p: [0.81, 1.45, 0],
    r: [0, 0, -Math.PI / 2],
  });
  add(new CylinderGeometry(0.68, 0.68, 0.08, 8, 1, true), c.horn, {
    p: [0.94, 1.45, 0],
    r: [0, 0, -Math.PI / 2],
  });
  return k.build();
}

/** Grito por clave: una textura estática compartida por toda la pelea, sin destellos. */
function shoutTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#fff1ce';
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = '#332e3e';
  ctx.font = '900 36px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t('survivors.boss.vecino.grito'), 256, 48, 490);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * Barcaza + un lote de arcos, sin crear geometrías/materiales durante update.
 *
 * La barcaza empieza con la geometría de a mano (`vecinoGeometry`) y, si se
 * le da el modelo de Blender (T174, `enemy-models.ts`), cambia a su
 * geometría cuando llega: la misma `Mesh`, el mismo material y el mismo
 * vaivén, giro y escala (el radio de choque no cambia). Si falla, se queda
 * la de a mano. `modelState` lo dice (`data-canon-vecino`).
 */
export class SurvivorsVecino {
  readonly group = new Group();
  readonly barge = new Mesh(vecinoGeometry(), litMaterial());
  readonly rings: Mesh<BufferGeometry, MeshBasicMaterial>;
  readonly placard: Mesh<PlaneGeometry, MeshBasicMaterial> | null;
  private readonly texture = shoutTexture();
  private readonly positions: BufferAttribute;
  private readonly colors: BufferAttribute;
  private readonly segments: number;
  private readonly warning = new Color(VECINO_COLORS.warning);
  private readonly hit = new Color(VECINO_COLORS.hit);
  private readonly model: EnemyModel | null;
  /** La geometría del modelo puesta en la barcaza (es del modelo: no se destruye aquí). */
  private glb: BufferGeometry | null = null;
  private disposed = false;
  modelState: EnemyModelState = 'procedural';

  constructor(quality: QualityTier, model: EnemyModel | null = null) {
    this.group.name = 'survivors-vecino';
    this.barge.name = 'survivors-boss-vecino';
    this.barge.rotation.order = 'YXZ';
    this.barge.visible = false;
    this.model = model;
    if (model) {
      this.modelState = 'cargando';
      void model.acquire().then((g) => {
        if (this.disposed) return;
        if (!g) {
          this.modelState = 'error';
          return;
        }
        const handmade = this.barge.geometry;
        this.barge.geometry = g;
        this.glb = g;
        handmade.dispose();
        this.modelState = 'glb';
      });
    }
    this.segments = quality === 'baja' ? 64 : 96;
    const capacity = 4 * (this.segments + 32) * 6;
    this.positions = new BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(
      DynamicDrawUsage,
    );
    this.colors = new BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(DynamicDrawUsage);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', this.positions);
    geometry.setAttribute('color', this.colors);
    geometry.setDrawRange(0, 0);
    this.rings = new Mesh(
      geometry,
      new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }),
    );
    this.rings.name = 'survivors-vecino-rings';
    this.rings.frustumCulled = false;
    this.rings.visible = false;
    this.group.add(this.barge, this.rings);
    this.placard = this.texture
      ? new Mesh(
          new PlaneGeometry(11, 2.1),
          new MeshBasicMaterial({ map: this.texture, side: DoubleSide }),
        )
      : null;
    if (this.placard) {
      this.placard.name = 'survivors-vecino-grito';
      this.placard.rotation.x = -Math.PI / 2;
      this.placard.visible = false;
      this.group.add(this.placard);
    }
  }

  update(s: SurvivorsSnapshot, time: number, reduced: boolean): void {
    const b = s.bosses.find((boss) => boss.boss === 'vecino');
    this.barge.visible = !!b;
    if (b) {
      this.barge.position.set(
        toScene(b.x),
        reduced ? 0 : Math.sin(time * 1.4 + b.id) * 0.06,
        toScene(b.y),
      );
      this.barge.rotation.set(0, -b.heading, reduced ? 0 : Math.sin(time + b.id) * 0.025);
      this.barge.scale.setScalar(toScene(b.radius) * VECINO_SCALE);
    }
    if (this.placard) {
      this.placard.visible = !!b && b.attackStage === 'warning';
      if (b) this.placard.position.set(toScene(b.x), toScene(b.radius) * 2.4, toScene(b.y));
    }
    let vertex = 0;
    const tau = Math.PI * 2;
    for (const w of s.bossWarnings) {
      if (w.boss !== 'vecino' || w.kind !== 'ring') continue;
      const radius = w.hit ? w.ringRadius : w.radius;
      if (radius <= 0) continue;
      const arcs = vecinoRingArcs(radius, w.gaps, w.gapRad, w.gapPhase, w.ringObstacles);
      const half = (w.thickness / 2) * (w.hit ? 1 : 0.25 + 0.75 * w.progress);
      const inner = toScene(Math.max(0, radius - half));
      const outer = toScene(radius + half);
      const x = toScene(w.x);
      const z = toScene(w.y);
      const color = w.hit ? this.hit : this.warning;
      for (const arc of arcs) {
        const count = Math.ceil(((arc.to - arc.from) / tau) * this.segments);
        for (let k = 0; k < count && vertex + 6 <= this.positions.count; k++) {
          const a = arc.from + ((arc.to - arc.from) * k) / count;
          const end = arc.from + ((arc.to - arc.from) * (k + 1)) / count;
          const ca = Math.cos(a),
            sa = Math.sin(a),
            cb = Math.cos(end),
            sb = Math.sin(end);
          for (let v = 0; v < 6; v++) {
            const isEnd = v === 2 || v === 4 || v === 5;
            const r = v === 0 || v === 3 || v === 5 ? inner : outer;
            this.positions.setXYZ(
              vertex,
              x + (isEnd ? cb : ca) * r,
              0.12,
              z + (isEnd ? sb : sa) * r,
            );
            this.colors.setXYZ(vertex++, color.r, color.g, color.b);
          }
        }
      }
    }
    this.rings.geometry.setDrawRange(0, vertex);
    this.positions.needsUpdate = this.colors.needsUpdate = true;
    this.rings.visible = vertex > 0;
  }

  dispose(): void {
    this.disposed = true;
    this.group.removeFromParent();
    this.texture?.dispose();
    this.group.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      // La geometría del modelo es compartida: la suelta `release`, no se destruye aquí.
      if (mesh.geometry !== this.glb) mesh.geometry.dispose();
      (mesh.material as Material).dispose();
    });
    this.glb = null;
    this.model?.release();
  }
}
