import {
  DEFENSE_CONFIG,
  type DefenseConfig,
  type DefenseTowerKind,
  type DefenseTowerState,
} from '@boia/engine/defense';
import {
  Box3,
  type BufferGeometry,
  Group,
  type InstancedMesh,
  type Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
} from 'three';
import { litMaterial } from './characters';
import { toScene } from './compress';
import { islandScaleFor } from './defense-arena';
import { buildIsland } from './islands';
import { C } from './palette';
import { curveMaterial, curveTree } from './planet';
import { instanced } from './survivors-props';

/**
 * Las islas construidas de «Defensa del Castillo» (plan 014 T160, decisión
 * 8): cada tipo es la isla de siempre (`buildIsland`, la composición a mano
 * del mapa), hecha a su tamaño normal, medida una vez (su caja en el agua) y
 * guardada; cada torre la usa a la escala que la lleva a la huella común de
 * su nivel (`islandScaleFor`: +10 % por nivel, la de nivel 3 = la de la
 * regla de construir). Encima, una marca de nivel (una perla dorada por
 * nivel). Las torres comparten geometría: construir no crea mallas nuevas.
 */

/** Tamaño (escena) al que se construye cada isla para medirla: el de una isla del mapa. muestra */
export const TEMPLATE_RADIUS = 8;

export interface IslandTemplate {
  readonly kind: DefenseTowerKind;
  readonly lit: BufferGeometry;
  readonly glow: BufferGeometry | null;
  /** Radio que cubre en el agua a su tamaño normal (escena; su caja). */
  readonly measured: number;
  /** Lo más alto (escena) a su tamaño normal. */
  readonly top: number;
}

const templates = new Map<DefenseTowerKind, IslandTemplate>();

/** El radio en el agua de una geometría: lo más lejos que llega su caja del centro, en x o en z. */
export function footprintOf(box: Box3): number {
  return Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z));
}

/** La isla de ese tipo a su tamaño normal, medida una vez (y guardada para las siguientes). */
export function islandTemplate(kind: DefenseTowerKind): IslandTemplate {
  const cached = templates.get(kind);
  if (cached) return cached;
  const build = buildIsland(kind, TEMPLATE_RADIUS);
  const lit = build.parts.lit.build();
  const glow = build.parts.glow.empty ? null : build.parts.glow.build();
  const box = new Box3();
  lit.computeBoundingBox();
  box.copy(lit.boundingBox!);
  if (glow) {
    glow.computeBoundingBox();
    box.union(glow.boundingBox!);
  }
  const t: IslandTemplate = { kind, lit, glow, measured: footprintOf(box), top: box.max.y };
  templates.set(kind, t);
  return t;
}

/** La escala de una isla de ese tipo a ese nivel (decisión 8). */
export function towerScale(
  kind: DefenseTowerKind,
  level: number,
  cfg: Pick<DefenseConfig, 'islandRadius'> = DEFENSE_CONFIG,
): number {
  return islandScaleFor(islandTemplate(kind).measured, level, cfg);
}

/** Una isla construida en la escena (su grupo, ya escalado). */
export function towerObject(kind: DefenseTowerKind, materials: TowerMaterials): Group {
  const t = islandTemplate(kind);
  const g = new Group();
  g.add(new Mesh(t.lit, materials.lit));
  if (t.glow) g.add(new Mesh(t.glow, materials.glow));
  // El material lleva cada vértice a la copia cercana del planeta: sin recorte por caja.
  for (const c of g.children) c.frustumCulled = false;
  return g;
}

export interface TowerMaterials {
  lit: Material;
  glow: Material;
}

/** Perlas de nivel que caben (más torres, sin marca: nunca falla). */
const PIP_CAP = 3 * 160;
const PIP_SIZE = 0.45;
const PIP_GAP = 1.1;

interface Placed {
  obj: Group;
  kind: DefenseTowerKind;
  level: number;
}

/**
 * Las torres de la partida: `sync` con la lista de la simulación (y dónde
 * va cada punto en la escena) pone, mueve, sube de nivel y quita islas.
 */
export class TowerIslands {
  readonly group = new Group();
  private readonly placed = new Map<number, Placed>();
  private readonly materials: TowerMaterials;
  private readonly pips: InstancedMesh;
  private readonly dummy = new Object3D();
  private readonly cfg: Pick<DefenseConfig, 'islandRadius'>;

  constructor(cfg: Pick<DefenseConfig, 'islandRadius'> = DEFENSE_CONFIG) {
    this.cfg = cfg;
    this.group.name = 'defense-islands';
    const lit = litMaterial();
    const glow = new MeshBasicMaterial({ vertexColors: true });
    curveMaterial(lit, true);
    curveMaterial(glow, true);
    this.materials = { lit, glow };
    this.pips = instanced(
      new SphereGeometry(1, 8, 6),
      new MeshBasicMaterial({ color: C.gold }),
      PIP_CAP,
      'defense-level',
    );
    curveTree(this.pips, true);
    this.group.add(this.pips);
  }

  /** Cuántas islas hay puestas. */
  get count(): number {
    return this.placed.size;
  }

  /** Las islas puestas por tipo (pruebas). */
  kinds(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const p of this.placed.values()) out[p.kind] = (out[p.kind] ?? 0) + 1;
    return out;
  }

  /** La escala con que se pinta la torre `id` ahora (pruebas), o null. */
  scaleOf(id: number): number | null {
    return this.placed.get(id)?.obj.scale.x ?? null;
  }

  sync(
    towers: readonly DefenseTowerState[],
    at: (x: number, y: number) => { x: number; z: number },
  ): void {
    const alive = new Set<number>();
    const d = this.dummy;
    let np = 0;
    for (const tw of towers) {
      alive.add(tw.id);
      let p = this.placed.get(tw.id);
      if (!p || p.kind !== tw.kind) {
        if (p) this.drop(tw.id, p);
        const obj = towerObject(tw.kind, this.materials);
        obj.name = `defense-island-${tw.kind}`;
        obj.rotation.y = (tw.id * 2.399) % (Math.PI * 2);
        this.group.add(obj);
        p = { obj, kind: tw.kind, level: 0 };
        this.placed.set(tw.id, p);
      }
      const pos = at(tw.x, tw.y);
      p.obj.position.set(pos.x, 0, pos.z);
      if (p.level !== tw.level) {
        p.level = tw.level;
        p.obj.scale.setScalar(towerScale(tw.kind, tw.level, this.cfg));
      }
      // La marca de nivel: una perla por nivel, encima de la isla.
      const top = islandTemplate(tw.kind).top * p.obj.scale.x + 1.2;
      for (let k = 0; k < tw.level && np < PIP_CAP; k++) {
        d.position.set(pos.x + (k - (tw.level - 1) / 2) * PIP_GAP, top, pos.z);
        d.scale.setScalar(PIP_SIZE);
        d.updateMatrix();
        this.pips.setMatrixAt(np++, d.matrix);
      }
    }
    this.pips.count = np;
    this.pips.visible = np > 0;
    this.pips.instanceMatrix.needsUpdate = true;
    for (const [id, p] of this.placed) if (!alive.has(id)) this.drop(id, p);
  }

  private drop(id: number, p: Placed): void {
    this.group.remove(p.obj);
    this.placed.delete(id);
  }

  dispose(): void {
    for (const [id, p] of this.placed) this.drop(id, p);
    this.pips.geometry.dispose();
    (this.pips.material as Material).dispose();
    this.materials.lit.dispose();
    this.materials.glow.dispose();
  }
}

/** El radio (escena) de la huella de las islas a nivel 3 según la config de la partida. */
export function islandRadiusScene(cfg: Pick<DefenseConfig, 'islandRadius'> = DEFENSE_CONFIG): number {
  return toScene(cfg.islandRadius);
}
