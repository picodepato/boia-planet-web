import type {
  DefeatStyle,
  EnemyId,
  EnemyView,
  QualityCaps,
  SurvivorsConfig,
  SurvivorsSnapshot,
} from '@boia/engine/survivors';
import { NOTE_FIGURES } from '@boia/engine/survivors';
import type { QualityTier } from '@boia/engine/streaming';
import { Group, type InstancedMesh, type Material, Object3D } from 'three';
import { toScene } from './compress';
import { curveTree } from './planet';
import {
  BALL_MIN,
  BALL_SCALE,
  NOTE_SIZE,
  PufFx,
  SinkFx,
  ballMaterial,
  cannonBallGeometry,
  defeatPlan,
  enemyModel,
  instanced,
  noteGeometry,
  propsMaterial,
} from './survivors-props';

/**
 * Lo que se pinta de una partida del Cañón en el mar 3D (T116, T117):
 * enemigos, bolas del cañón y notas con los modelos de la beta
 * (`survivors-props.ts`), y el efecto de derrota del estilo elegido. Un
 * `InstancedMesh` por tipo (y por figura de nota), del tamaño del tope de la
 * calidad: pintar es mover matrices, sin crear nada por fotograma. Cada
 * pieza va en su sitio del mapa (u de motor → escena) y el material la lleva
 * a la copia más cercana al foco (`curveTree` con la vuelta del planeta).
 */

const EMPTY: readonly EnemyView[] = [];

export interface SurvivorsViewOptions {
  /** Calidad de `/mar` (efectos más baratos en `baja`). Sin valor, `alta`. */
  quality?: QualityTier;
  /** Estilo de derrota (sin valor, el de la config). */
  defeatStyle?: DefeatStyle;
  /** Movimiento reducido (efecto mínimo). */
  reduced?: boolean;
}

export class SurvivorsView {
  readonly group = new Group();
  readonly quality: QualityTier;
  /** Movimiento reducido ahora (se puede cambiar en vivo). */
  reduced: boolean;
  private style: DefeatStyle;
  private readonly enemyIds: EnemyId[] = [];
  private readonly enemyMeshes: InstancedMesh[] = [];
  private readonly enemyScale: number[] = [];
  private readonly enemyBob: number[] = [];
  private readonly enemyRadius: number[] = [];
  private readonly balls: InstancedMesh;
  private readonly noteMeshes: InstancedMesh[];
  private readonly noteCounts: number[];
  private readonly puf: PufFx;
  private readonly sink: SinkFx;
  private readonly dummy = new Object3D();
  private last: SurvivorsSnapshot | null = null;
  private now = 0;

  constructor(config: SurvivorsConfig, caps: QualityCaps, opts: SurvivorsViewOptions = {}) {
    this.quality = opts.quality ?? 'alta';
    this.reduced = opts.reduced ?? false;
    this.style = opts.defeatStyle ?? config.defeatStyle;
    const kinds: { geometry: InstancedMesh['geometry']; material: Material; name: string }[] = [];
    for (const id of Object.keys(config.enemies) as EnemyId[]) {
      const model = enemyModel(id);
      const mesh = instanced(model.build(), propsMaterial(), caps.enemies, `survivors-${id}`);
      this.enemyIds.push(id);
      this.enemyMeshes.push(mesh);
      this.enemyScale.push(model.scale);
      this.enemyBob.push(model.bob);
      this.enemyRadius.push(config.enemies[id]?.radius ?? 10);
      kinds.push({ geometry: mesh.geometry, material: mesh.material as Material, name: mesh.name });
      this.group.add(mesh);
    }
    this.balls = instanced(
      cannonBallGeometry(),
      ballMaterial(),
      caps.projectiles,
      'survivors-balls',
    );
    this.noteMeshes = NOTE_FIGURES.map((f) =>
      instanced(noteGeometry(f), propsMaterial(), caps.notes, `survivors-note-${f}`),
    );
    this.noteCounts = NOTE_FIGURES.map(() => 0);
    this.puf = new PufFx(this.quality);
    this.sink = new SinkFx(this.quality, kinds);
    this.group.add(
      this.balls,
      ...this.noteMeshes,
      this.puf.mesh,
      ...this.sink.meshes,
      this.sink.rings,
    );
    curveTree(this.group, true);
  }

  /** El estilo de derrota de ahora. */
  get defeatStyle(): DefeatStyle {
    return this.style;
  }

  /** Cambia el estilo de derrota en vivo (el interruptor de desarrollo); lo que estaba en curso se apaga. */
  setDefeatStyle(style: DefeatStyle): void {
    if (style === this.style) return;
    this.style = style;
    this.puf.clear();
    this.sink.clear();
  }

  /** Cuántas piezas de cada tipo caben (el tope de la calidad), para las pruebas. */
  capacity(): Record<string, number> {
    const out: Record<string, number> = { projectiles: this.balls.instanceMatrix.count };
    this.enemyIds.forEach((id, i) => {
      out[id] = this.enemyMeshes[i]!.instanceMatrix.count;
    });
    NOTE_FIGURES.forEach((f, i) => {
      out[`note-${f}`] = this.noteMeshes[i]!.instanceMatrix.count;
    });
    return out;
  }

  /** La pieza instanciada de cada cosa, por nombre (para las pruebas). */
  meshes(): Record<string, InstancedMesh> {
    const out: Record<string, InstancedMesh> = {};
    this.group.traverse((o) => {
      const m = o as InstancedMesh;
      if (m.isInstancedMesh) out[m.name] = m;
    });
    return out;
  }

  /** Efectos de derrota en curso. */
  get defeatsShown(): number {
    return this.style === 'puf' ? this.puf.active : this.sink.active;
  }

  /**
   * Un enemigo derrotado (evento `defeated` de la simulación, en u): su
   * efecto, en el estilo de ahora. El rumbo sale del último pintado.
   */
  defeat(type: EnemyId, id: number, x: number, y: number): void {
    const ti = this.enemyIds.indexOf(type);
    const radius = ti >= 0 ? this.enemyRadius[ti]! : 10;
    const size = toScene(radius) * (ti >= 0 ? this.enemyScale[ti]! : 1.2);
    const sx = toScene(x);
    const sz = toScene(y);
    if (this.style === 'puf') {
      this.puf.spawn(sx, sz, size, this.now);
      return;
    }
    if (ti < 0) return;
    let heading = 0;
    const list = this.last?.enemiesByType[type] ?? EMPTY;
    for (let i = 0; i < list.length; i++) {
      if (list[i]!.id === id) {
        heading = list[i]!.heading;
        break;
      }
    }
    this.sink.spawn(ti, sx, sz, heading, size, this.now);
  }

  /** Pinta la partida de ahora (`t`: s de la escena, para el vaivén y los efectos). */
  update(s: SurvivorsSnapshot, t: number): void {
    this.last = s;
    this.now = t;
    const d = this.dummy;
    for (let ti = 0; ti < this.enemyIds.length; ti++) {
      const mesh = this.enemyMeshes[ti]!;
      const list = s.enemiesByType[this.enemyIds[ti]!] ?? EMPTY;
      const n = Math.min(list.length, mesh.instanceMatrix.count);
      const k = this.enemyScale[ti]!;
      const bob = this.reduced ? 0 : this.enemyBob[ti]!;
      for (let i = 0; i < n; i++) {
        const e = list[i]!;
        d.position.set(toScene(e.x), Math.sin(t * 6 + e.id) * bob, toScene(e.y));
        d.rotation.set(0, -e.heading, 0);
        d.scale.setScalar(toScene(e.radius) * k);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
    const nb = Math.min(s.projectiles.length, this.balls.instanceMatrix.count);
    for (let i = 0; i < nb; i++) {
      const p = s.projectiles[i]!;
      d.position.set(toScene(p.x), 0.6, toScene(p.y));
      d.rotation.set(0, -Math.atan2(p.vy, p.vx), 0);
      d.scale.setScalar(Math.max(BALL_MIN, toScene(p.radius) * BALL_SCALE));
      d.updateMatrix();
      this.balls.setMatrixAt(i, d.matrix);
    }
    this.balls.count = nb;
    this.balls.instanceMatrix.needsUpdate = true;
    this.updateNotes(s, t);
    const plan = defeatPlan(this.style, { quality: this.quality, reduced: this.reduced });
    if (this.style === 'puf') this.puf.update(t, plan);
    else this.sink.update(t, plan);
  }

  private updateNotes(s: SurvivorsSnapshot, t: number): void {
    const d = this.dummy;
    const counts = this.noteCounts;
    for (let i = 0; i < counts.length; i++) counts[i] = 0;
    const bob = this.reduced ? 0 : 0.12;
    for (let i = 0; i < s.notes.length; i++) {
      const note = s.notes[i]!;
      const fi = NOTE_FIGURES.indexOf(note.figure);
      const mesh = this.noteMeshes[fi]!;
      if (counts[fi]! >= mesh.instanceMatrix.count) continue;
      d.position.set(toScene(note.x), 0.05 + Math.sin(t * 3 + note.id) * bob, toScene(note.y));
      d.rotation.set(0, this.reduced ? 0 : Math.sin(t * 1.5 + note.id) * 0.35, 0);
      d.scale.setScalar(NOTE_SIZE[note.figure]);
      d.updateMatrix();
      mesh.setMatrixAt(counts[fi]!++, d.matrix);
    }
    for (let i = 0; i < this.noteMeshes.length; i++) {
      const m = this.noteMeshes[i]!;
      m.count = counts[i]!;
      m.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    const done = new Set<unknown>();
    this.group.traverse((o) => {
      const m = o as InstancedMesh;
      if (!m.isInstancedMesh) return;
      for (const r of [m.geometry, m.material as Material]) {
        if (done.has(r)) continue;
        done.add(r);
        r.dispose();
      }
      m.dispose();
    });
  }
}
