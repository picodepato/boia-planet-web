import type {
  EnemyId,
  NoteFigure,
  QualityCaps,
  SurvivorsConfig,
  SurvivorsSnapshot,
} from '@boia/engine/survivors';
import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  ConeGeometry,
  Group,
  InstancedMesh,
  MeshLambertMaterial,
  Object3D,
  SphereGeometry,
} from 'three';
import { toScene } from './compress';
import { C } from './palette';
import { curveTree } from './planet';

/**
 * Lo que se pinta de una partida del Cañón en el mar 3D (T99): enemigos,
 * bolas del cañón y notas, con piezas PROVISIONALES sencillas (T100 las
 * cambia por los modelos de la beta). Un `InstancedMesh` por tipo, del
 * tamaño del tope de la calidad: pintar es mover matrices, sin crear nada
 * por fotograma. Cada pieza va en su sitio del mapa (u de motor → escena) y
 * el material la lleva a la copia más cercana al foco (`curveTree` con la
 * vuelta del planeta).
 */

/** Cómo se ve, provisionalmente, cada enemigo (forma, color, altura sobre el agua). */
const ENEMY_LOOK: Readonly<Record<EnemyId, { shape: 'cone' | 'box'; color: string }>> = {
  piranha: { shape: 'cone', color: C.red },
  crab: { shape: 'box', color: C.orange },
  gull: { shape: 'cone', color: C.white },
  pirate: { shape: 'box', color: C.navy },
  swordfish: { shape: 'cone', color: C.blueDoor },
  jellyfish: { shape: 'box', color: C.purple },
};

/** El color de cada figura de nota (de menos a más valor). */
const NOTE_COLOR: Readonly<Record<NoteFigure, string>> = {
  corchea: C.yellow,
  negra: C.white,
  blanca: '#7fe3e0',
  redonda: C.pink,
};

const BALL_COLOR = '#bfe9ff';

function enemyGeometry(shape: 'cone' | 'box'): BufferGeometry {
  if (shape === 'cone') {
    // Radio 1, la punta hacia +x (hacia donde nada).
    const g = new ConeGeometry(0.8, 2.2, 6);
    g.rotateZ(-Math.PI / 2);
    return g;
  }
  return new BoxGeometry(2, 0.9, 1.6);
}

export class SurvivorsView {
  readonly group = new Group();
  private readonly enemies = new Map<EnemyId, InstancedMesh>();
  private readonly balls: InstancedMesh;
  private readonly notes: InstancedMesh;
  private readonly dummy = new Object3D();
  private readonly color = new Color();
  private readonly noteColors: Record<NoteFigure, Color>;

  constructor(config: SurvivorsConfig, caps: QualityCaps) {
    for (const id of Object.keys(config.enemies) as EnemyId[]) {
      const look = ENEMY_LOOK[id];
      const mesh = new InstancedMesh(
        enemyGeometry(look.shape),
        new MeshLambertMaterial({ color: look.color }),
        caps.enemies,
      );
      mesh.count = 0;
      mesh.name = `survivors-${id}`;
      this.enemies.set(id, mesh);
      this.group.add(mesh);
    }
    this.balls = new InstancedMesh(
      new SphereGeometry(1, 8, 6),
      new MeshLambertMaterial({ color: BALL_COLOR, emissive: BALL_COLOR, emissiveIntensity: 0.4 }),
      caps.projectiles,
    );
    this.balls.count = 0;
    this.notes = new InstancedMesh(
      new SphereGeometry(1, 8, 6),
      new MeshLambertMaterial({ color: '#ffffff', emissive: '#333333' }),
      caps.notes,
    );
    this.notes.count = 0;
    this.noteColors = {
      corchea: new Color(NOTE_COLOR.corchea),
      negra: new Color(NOTE_COLOR.negra),
      blanca: new Color(NOTE_COLOR.blanca),
      redonda: new Color(NOTE_COLOR.redonda),
    };
    // Que exista el color por pieza antes del primer pintado.
    this.notes.setColorAt(0, this.color.set('#ffffff'));
    this.group.add(this.balls, this.notes);
    curveTree(this.group, true);
  }

  /** Cuántas piezas de cada tipo caben (el tope de la calidad), para las pruebas. */
  capacity(): Record<string, number> {
    const out: Record<string, number> = {
      projectiles: this.balls.instanceMatrix.count,
      notes: this.notes.instanceMatrix.count,
    };
    for (const [id, m] of this.enemies) out[id] = m.instanceMatrix.count;
    return out;
  }

  /** Pinta la partida de ahora (`t`: s de la escena, para el vaivén). */
  update(s: SurvivorsSnapshot, t: number): void {
    const d = this.dummy;
    for (const [id, mesh] of this.enemies) {
      const list = s.enemiesByType[id] ?? [];
      const n = Math.min(list.length, mesh.instanceMatrix.count);
      for (let i = 0; i < n; i++) {
        const e = list[i]!;
        const r = toScene(e.radius);
        d.position.set(toScene(e.x), 0.25 + Math.sin(t * 6 + e.id) * 0.06, toScene(e.y));
        d.rotation.set(0, -e.heading, 0);
        d.scale.setScalar(r);
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
      d.rotation.set(0, 0, 0);
      d.scale.setScalar(Math.max(0.2, toScene(p.radius)));
      d.updateMatrix();
      this.balls.setMatrixAt(i, d.matrix);
    }
    this.balls.count = nb;
    this.balls.instanceMatrix.needsUpdate = true;
    const nn = Math.min(s.notes.length, this.notes.instanceMatrix.count);
    for (let i = 0; i < nn; i++) {
      const note = s.notes[i]!;
      const size = 0.25 + Math.min(0.35, note.value * 0.02);
      d.position.set(toScene(note.x), 0.35 + Math.sin(t * 3 + note.id) * 0.1, toScene(note.y));
      d.rotation.set(0, 0, 0);
      d.scale.setScalar(size);
      d.updateMatrix();
      this.notes.setMatrixAt(i, d.matrix);
      this.notes.setColorAt(i, this.noteColors[note.figure]);
    }
    this.notes.count = nn;
    this.notes.instanceMatrix.needsUpdate = true;
    if (this.notes.instanceColor) this.notes.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      const m = o as InstancedMesh;
      if (!m.isInstancedMesh) return;
      m.geometry.dispose();
      (m.material as MeshLambertMaterial).dispose();
      m.dispose();
    });
  }
}
