import type {
  DefenseConfig,
  DefenseEnemyKind,
  DefensePath,
  DefenseSnapshot,
  DefenseTowerKind,
} from '@boia/engine/defense';
import type { BossId, EnemyId } from '@boia/engine/survivors';
import type { QualityTier } from '@boia/engine/streaming';
import {
  BoxGeometry,
  type BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  type InstancedMesh,
  type Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  ShaderMaterial,
} from 'three';
import { litMaterial } from './characters';
import { toScene } from './compress';
import {
  type ArenaFrame,
  barrierLines,
  cornerBuoys,
  towerRangeScene,
  uTurnBuoys,
} from './defense-arena';
import { ArenaClouds } from './defense-clouds';
import {
  DEFAULT_DEFENSE_OVERLAYS,
  DamageNumbers,
  DamageTracker,
  type DefenseOverlayPrefs,
  HealthBars,
} from './defense-overlays';
import type { EnemyModel, EnemyModelState } from './enemy-models';
import { DefenseFx } from './defense-fx';
import { TowerIslands } from './defense-islands';
import { Kit } from './kit';
import { C } from './palette';
import { curveMaterial, curveTree } from './planet';
import { buoy } from './props';
import { ROAD_BUOY } from './race-props';
import { GHOST_SHIP_SCALE, PufFx, defeatPlan, enemyMaterial, enemyModel, ghostShipGeometry, ghostShipMaterial, instanced, propsMaterial } from './survivors-props';
import { KRAKEN_HEAD_SCALE, KRAKEN_HEAD_Y, krakenHeadGeometry } from './survivors-kraken';
import { SHARK_SCALE, hammerheadGeometry } from './survivors-shark';
import { VECINO_SCALE, vecinoGeometry } from './survivors-vecino';

/**
 * Lo que se pinta de «Defensa del Castillo» en el mar 3D (plan 014 T160):
 * las dos barreras flotantes del camino y las boyas de la carrera en sus
 * esquinas, el vórtice del que sale todo, los enemigos y los bosses del
 * Cañón por el camino (con su salida del vórtice), el golpe al castillo, las
 * islas construidas y sus efectos. Plan 015 T170: el círculo de alcance de
 * la isla que se coloca o de la elegida, el punto al que vuela el avión, las
 * boyas de las U del camino v2, las barras de vida, los números de daño
 * (`defense-overlays.ts`) y las nubes (`defense-clouds.ts`). Sin lógica de
 * juego: todo sale de la instantánea de la partida.
 * Lo fijo (barreras, boyas, vórtice) se construye una vez en su sitio del
 * mar; lo que se mueve son matrices de `InstancedMesh`. Escena salvo donde
 * se diga; cada vértice va a la copia del planeta más cercana al foco.
 */

/** s que tarda un enemigo en salir del vórtice (sube y crece). muestra */
export const EMERGE_S = 0.6;
/** s que se ve el golpe al castillo. muestra */
export const CASTLE_HIT_S = 0.6;
/** Escena: el vórtice es algo mayor que su radio de la partida (el halo). muestra */
const VORTEX_HALO = 1.45;
const VORTEX_LIFT = 0.18;
/** Alto de la barrera (escena) y lo que asoma del agua. muestra */
const RAIL_Y = 0.35;
const RAIL_W = 0.28;
const BUOY_SIZE = 1.7;

const BOSS_SCALE: Readonly<Partial<Record<BossId, number>>> = {
  vecino: VECINO_SCALE,
  martillo: SHARK_SCALE,
  fantasma: GHOST_SHIP_SCALE,
  kraken: KRAKEN_HEAD_SCALE,
};
const BOSS_CAP = 4;

/** La espiral del vórtice: lila y negro, gira y brilla un poco en el borde. */
function vortexMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 c = vUv - 0.5;
        float r = length(c) * 2.0 * ${VORTEX_HALO.toFixed(2)};
        float a = atan(c.y, c.x);
        float arms = sin(a * 3.0 - log(max(r, 0.02)) * 7.0 + uTime * 2.6);
        float band = smoothstep(-0.15, 0.55, arms);
        vec3 lilac = vec3(0.70, 0.52, 1.0);
        vec3 dark = vec3(0.04, 0.02, 0.08);
        vec3 col = mix(dark, lilac, band * smoothstep(0.05, 0.9, r));
        // El ojo negro, el disco y el halo suave de fuera.
        float disc = 1.0 - smoothstep(0.92, 1.0, r);
        float halo = (1.0 - smoothstep(1.0, ${VORTEX_HALO.toFixed(2)}, r)) * (1.0 - disc);
        col += vec3(0.55, 0.35, 0.9) * halo * 0.9;
        float alpha = disc * 0.92 + halo * 0.45;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

/** Las piezas de las barreras de un lado: un listón a franjas y sus flotadores, una sola malla. */
function barrierGeometry(line: readonly { x: number; z: number }[], low: boolean): BufferGeometry {
  const k = new Kit();
  const rail = new BoxGeometry(1, RAIL_W, RAIL_W);
  const float = new CylinderGeometry(0.42, 0.5, 0.5, low ? 6 : 8);
  const every = low ? 4 : 2;
  for (let i = 0; i < line.length; i++) {
    const p = line[i]!;
    const q = line[i + 1];
    if (q) {
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      const len = Math.hypot(dx, dz);
      if (len > 1e-3) {
        k.add(rail, i % 2 ? C.white : ROAD_BUOY.body, {
          p: [(p.x + q.x) / 2, RAIL_Y, (p.z + q.z) / 2],
          r: [0, -Math.atan2(dz, dx), 0],
          s: [len + RAIL_W, 1, 1],
        });
      }
    }
    if (i % every === 0) k.add(float, i % (every * 2) ? C.white : ROAD_BUOY.body, { p: [p.x, 0.12, p.z] });
  }
  rail.dispose();
  float.dispose();
  return k.build();
}

/** La vista previa al construir: verde si se puede, roja si no. muestra */
export const PREVIEW_OK = '#3ddc84';
export const PREVIEW_BAD = '#ff4d3d';

/**
 * Lo que el HUD (T161) marca en el agua (u de la partida): la isla que se
 * coloca (verde o roja, con el motivo de la partida, y el círculo de su
 * alcance si se da su tipo: plan 015 T170), la isla elegida (con su alcance a
 * su nivel) y el punto al que vuela el avión tras un toque.
 */
export interface DefenseMarks {
  preview: {
    x: number;
    y: number;
    ok: boolean;
    kind?: DefenseTowerKind;
    /** Por qué no se puede (`DefenseBuildReason`), o null. */
    reason?: string | null;
  } | null;
  selected: { x: number; y: number; kind?: DefenseTowerKind; level?: number } | null;
  target?: { x: number; y: number } | null;
}

/** Cuántas nubes pasan por la arena. muestra */
const CLOUDS = { baja: 3, other: 4 } as const;
/** Tope de barras de vida y de números de daño a la vez. muestra */
const BARS_CAP = { baja: 96, other: 160 } as const;
const NUMBERS_CAP = { baja: 24, other: 48 } as const;

export interface DefenseViewOptions {
  config: DefenseConfig;
  path: DefensePath;
  frame: ArenaFrame;
  quality?: QualityTier;
  reduced?: boolean;
  /** El modelo de Blender del Vecino (T174); sin él, la barcaza de a mano. */
  vecinoModel?: EnemyModel | null;
}

export class DefenseView {
  readonly group = new Group();
  readonly vortex: Mesh;
  readonly islands: TowerIslands;
  readonly fx: DefenseFx;
  /** Movimiento reducido (en vivo): vórtice quieto, sin vaivén ni salida animada. */
  reduced: boolean;
  private readonly frame: ArenaFrame;
  private readonly cfg: DefenseConfig;
  private readonly quality: QualityTier;
  private readonly kinds: DefenseEnemyKind[] = [];
  private readonly meshes = new Map<DefenseEnemyKind, InstancedMesh>();
  private readonly scale = new Map<DefenseEnemyKind, number>();
  private readonly bob = new Map<DefenseEnemyKind, number>();
  private readonly fly = new Map<DefenseEnemyKind, number>();
  private readonly lift = new Map<DefenseEnemyKind, number>();
  private readonly counts = new Map<DefenseEnemyKind, number>();
  private readonly castleRing: Mesh;
  private readonly preview: Mesh;
  private readonly previewEdge: Mesh;
  private readonly selectRing: Mesh;
  private readonly rangeRing: Mesh;
  private readonly rangeFill: Mesh;
  private readonly targetRing: Mesh;
  /** Escena: de la copia del castillo en el mapa a la que se ve (lo que no da la vuelta). */
  private readonly seen = { x: 0, z: 0 };
  readonly bars: HealthBars;
  readonly numbers: DamageNumbers;
  readonly clouds: ArenaClouds;
  private readonly damage = new DamageTracker();
  /** Barras de vida y números de daño (decisión 11): los dos al principio. */
  overlays: DefenseOverlayPrefs = { ...DEFAULT_DEFENSE_OVERLAYS };
  private readonly puf: PufFx;
  private readonly d = new Object3D();
  private readonly tmp = { x: 0, y: 0 };
  private castleHitAt = -1e9;
  /** Enemigos pintados en el último `update` (pruebas). */
  drawn = 0;
  /** El modelo de Blender del Vecino (T174) y su geometría puesta en su pieza (del modelo: no se destruye aquí). */
  private readonly vecinoModel: EnemyModel | null;
  private vecinoGlb: BufferGeometry | null = null;
  private disposed = false;
  vecinoState: EnemyModelState = 'procedural';

  constructor(o: DefenseViewOptions) {
    this.cfg = o.config;
    this.frame = o.frame;
    this.quality = o.quality ?? 'alta';
    this.reduced = o.reduced ?? false;
    const low = this.quality === 'baja';
    this.group.name = 'defense';
    this.d.rotation.order = 'YXZ';

    // Las barreras de los dos lados y las boyas de las esquinas.
    const lines = barrierLines(o.path, o.config.castle.radius);
    const lit = litMaterial();
    for (const side of [lines.left, lines.right]) {
      const m = new Mesh(barrierGeometry(side.map((p) => this.at(p.x, p.y)), low), lit);
      m.name = 'defense-barrier';
      this.group.add(m);
    }
    const k = new Kit();
    for (const b of [...cornerBuoys(o.path), ...uTurnBuoys(o.path)]) {
      const p = this.at(b.x, b.y);
      buoy(k, p.x, p.z, ROAD_BUOY.body, ROAD_BUOY.band, BUOY_SIZE);
    }
    if (!k.empty) {
      const buoys = new Mesh(k.build(), lit);
      buoys.name = 'defense-corner-buoys';
      this.group.add(buoys);
    }

    // El vórtice, en el principio del camino.
    const v = this.at(o.path.start.x, o.path.start.y);
    const R = toScene(o.config.vortexRadius) * VORTEX_HALO;
    const seg = low ? 12 : 24;
    this.vortex = new Mesh(new PlaneGeometry(R * 2, R * 2, seg, seg).rotateX(-Math.PI / 2), vortexMaterial());
    this.vortex.name = 'defense-vortex';
    this.vortex.position.set(v.x, VORTEX_LIFT, v.z);
    this.vortex.renderOrder = 1;
    this.group.add(this.vortex);

    // Enemigos (los del Cañón) y bosses.
    const common = low ? 96 : 128;
    for (const id of Object.keys(o.config.enemies) as EnemyId[]) {
      const model = enemyModel(id);
      this.addKind(id, instanced(model.build(), enemyMaterial(model), common, `defense-${id}`), model.scale, model.bob, model.fly ?? 0, 0);
    }
    for (const id of Object.keys(o.config.bosses) as BossId[]) {
      const geo =
        id === 'vecino'
          ? vecinoGeometry()
          : id === 'martillo'
            ? hammerheadGeometry()
            : id === 'fantasma'
              ? ghostShipGeometry()
              : id === 'kraken'
                ? krakenHeadGeometry(this.quality)
                : null;
      if (!geo) continue;
      const mat = id === 'fantasma' ? ghostShipMaterial(false) : id === 'martillo' ? propsMaterial() : litMaterial();
      this.addKind(id, instanced(geo, mat, BOSS_CAP, `defense-boss-${id}`), BOSS_SCALE[id] ?? 1, 0.06, 0, id === 'kraken' ? KRAKEN_HEAD_Y.exposed : 0);
    }
    // El Vecino de Blender (T174): cuando llega, su geometría en la misma pieza instanciada.
    this.vecinoModel = o.vecinoModel ?? null;
    const vecinoMesh = this.meshes.get('vecino');
    if (this.vecinoModel && vecinoMesh) {
      this.vecinoState = 'cargando';
      void this.vecinoModel.acquire().then((g) => {
        if (this.disposed) return;
        if (!g) {
          this.vecinoState = 'error';
          return;
        }
        const handmade = vecinoMesh.geometry;
        vecinoMesh.geometry = g;
        this.vecinoGlb = g;
        handmade.dispose();
        this.vecinoState = 'glb';
      });
    }

    // El golpe al castillo y el anillo de construir.
    this.castleRing = new Mesh(
      new RingGeometry(0.92, 1, low ? 32 : 64).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: C.red, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    this.castleRing.name = 'defense-castle-hit';
    const c = this.at(0, 0);
    this.castleRing.position.set(c.x, 0.3, c.z);
    this.castleRing.visible = false;
    // La isla que se coloca (T161): un disco de su huella y su borde, verde o rojo.
    this.preview = new Mesh(
      new CircleGeometry(1, low ? 24 : 48).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: PREVIEW_OK, transparent: true, opacity: 0.32, depthWrite: false }),
    );
    this.preview.name = 'defense-build-preview';
    this.preview.visible = false;
    this.previewEdge = new Mesh(
      new RingGeometry(0.9, 1, low ? 24 : 48).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: PREVIEW_OK, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.previewEdge.name = 'defense-build-preview-edge';
    this.previewEdge.visible = false;
    // La isla elegida: un aro crema a su alrededor.
    this.selectRing = new Mesh(
      new RingGeometry(0.88, 1, low ? 24 : 48).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: '#fff4e2', transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.selectRing.name = 'defense-selected';
    this.selectRing.visible = false;
    // El alcance de la isla que se coloca o de la elegida (plan 015 T170): un aro fino y un velo.
    this.rangeRing = new Mesh(
      new RingGeometry(0.985, 1, low ? 48 : 96).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: PREVIEW_OK, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.rangeRing.name = 'defense-range';
    this.rangeRing.visible = false;
    this.rangeFill = new Mesh(
      new CircleGeometry(1, low ? 48 : 96).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: PREVIEW_OK, transparent: true, opacity: 0.1, depthWrite: false }),
    );
    this.rangeFill.name = 'defense-range-fill';
    this.rangeFill.visible = false;
    // Sin la vuelta del planeta: en el borde de la arena el alcance pasa de
    // medio planeta y sus vértices saltarían a la otra copia. Se pone en la
    // copia del castillo que se ve (`sky`).
    for (const m of [this.rangeRing, this.rangeFill]) curveMaterial(m.material as Material, false);
    // Adonde vuela el avión tras un toque: un aro crema pequeño.
    this.targetRing = new Mesh(
      new RingGeometry(0.7, 1, low ? 16 : 32).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: '#fff4e2', transparent: true, opacity: 0.8, depthWrite: false }),
    );
    this.targetRing.name = 'defense-plane-target';
    this.targetRing.visible = false;
    // Las barras de vida y los números de daño (decisión 11).
    this.bars = new HealthBars(low ? BARS_CAP.baja : BARS_CAP.other);
    this.numbers = new DamageNumbers(low ? NUMBERS_CAP.baja : NUMBERS_CAP.other);
    this.puf = new PufFx(this.quality);
    this.group.add(
      this.castleRing,
      this.preview,
      this.previewEdge,
      this.selectRing,
      this.rangeFill,
      this.rangeRing,
      this.targetRing,
      this.puf.mesh,
      ...this.bars.meshes,
      this.numbers.mesh,
    );

    this.islands = new TowerIslands(o.config);
    this.fx = new DefenseFx(o.config, low);
    this.group.add(this.islands.group, ...this.fx.meshes);
    // Todo con la curva y la vuelta del planeta (las islas y los efectos ya la llevan).
    curveTree(this.group, true);
    curveMaterial(this.vortex.material as ShaderMaterial, true);
    // Las nubes van sin curva (como las del mundo), por encima de todo.
    this.clouds = new ArenaClouds(toScene(o.config.arenaRadius), low ? CLOUDS.baja : CLOUDS.other);
    this.group.add(this.clouds.group);
  }

  /** Las barras de vida y los números de daño, encendidos o no (las opciones de la pausa). */
  setOverlays(prefs: DefenseOverlayPrefs): void {
    this.overlays = { bars: prefs.bars, numbers: prefs.numbers };
  }

  /**
   * Las nubes de la arena (decisión 17): `dt` del fotograma, `center` el
   * castillo en la escena (en la copia que se ve) y `zoom` el de la arena
   * (1 la vista de salida; de cerca se apagan).
   */
  sky(dt: number, center: { x: number; z: number }, zoom: number): void {
    const c = this.at(0, 0);
    this.seen.x = center.x - c.x;
    this.seen.z = center.z - c.z;
    this.clouds.update(dt, center, zoom, this.reduced);
  }

  /** Un punto de la partida (u) en la escena (x, z), seguido alrededor del castillo. */
  at(x: number, y: number): { x: number; z: number } {
    const w = this.frame.toWorld(x, y, this.tmp);
    return { x: toScene(w.x), z: toScene(w.y) };
  }

  private addKind(
    kind: DefenseEnemyKind,
    mesh: InstancedMesh,
    scale: number,
    bob: number,
    fly: number,
    lift: number,
  ): void {
    this.kinds.push(kind);
    this.meshes.set(kind, mesh);
    this.scale.set(kind, scale);
    this.bob.set(kind, bob);
    this.fly.set(kind, fly);
    this.lift.set(kind, lift);
    this.group.add(mesh);
  }

  /** El castillo recibe un golpe: el aro rojo y su latido. */
  castleHit(t: number): void {
    this.castleHitAt = t;
  }

  /** Un enemigo cae: una nubecilla donde estaba (u de la partida). */
  defeat(x: number, y: number, radius: number, t: number): void {
    const p = this.at(x, y);
    this.puf.spawn(p.x, p.z, Math.max(0.6, toScene(radius) * 1.2), t);
  }

  /**
   * Se está construyendo. Ya no hay anillo alrededor del avión (plan 015
   * T169: se construye en cualquier sitio de la arena); el alcance de la isla
   * que se coloca lo pinta T170.
   */
  setBuilding(_on: boolean): void {}

  /** Tipos de enemigo pintados ahora (pruebas). */
  drawnKinds(): string[] {
    const out: string[] = [];
    for (const [k, n] of this.counts) if (n > 0) out.push(k);
    return out.sort();
  }

  /** Lo marcado en el último `update` (pruebas): la vista previa ('ok', 'no' o '') y la isla elegida. */
  marked = { preview: '', reason: '', selected: false };
  /** Radio (escena) del alcance pintado en el último `update`, o 0 (pruebas). */
  range = 0;

  /**
   * Un fotograma: `s` la partida, `t` la hora de la escena, `_plane` dónde
   * se pinta el avión (escena; sin uso desde que no hay anillo de construir,
   * plan 015 T169); `marks`, lo que el HUD marca en el agua (T161).
   */
  update(
    s: DefenseSnapshot,
    t: number,
    _plane: { x: number; z: number },
    marks: DefenseMarks = { preview: null, selected: null },
  ): void {
    const reduced = this.reduced;
    (this.vortex.material as ShaderMaterial).uniforms.uTime!.value = reduced ? 0 : t;
    const d = this.d;
    for (const k of this.kinds) this.counts.set(k, 0);
    let drawn = 0;
    const bars = this.overlays.bars;
    this.bars.begin();
    for (const e of s.enemies) {
      if (e.dead) continue;
      const mesh = this.meshes.get(e.kind);
      if (!mesh) continue;
      const n = this.counts.get(e.kind)!;
      if (n >= mesh.instanceMatrix.count) continue;
      const p = this.at(e.x, e.y);
      const size = toScene(e.radius) * this.scale.get(e.kind)!;
      // La salida del vórtice: sube del agua y crece (con movimiento reducido, ya está).
      const k = reduced ? 1 : Math.min(1, e.ageS / EMERGE_S);
      const bob = reduced ? 0 : Math.sin(t * 6 + e.id) * this.bob.get(e.kind)!;
      const y = this.fly.get(e.kind)! * k + this.lift.get(e.kind)! * size + bob - (1 - k) * 1.5;
      d.position.set(p.x, y, p.z);
      d.rotation.set(0, -this.frame.headingToWorld(e.heading), 0);
      d.scale.setScalar(size * (0.35 + 0.65 * k));
      d.updateMatrix();
      mesh.setMatrixAt(n, d.matrix);
      this.counts.set(e.kind, n + 1);
      drawn++;
      if (bars) this.bars.add(p.x, p.z, size, Math.max(0, y), e.hp, e.maxHp);
    }
    this.bars.end(bars);
    // Los números de daño: lo que bajó la vida de cada uno (se sigue siempre, se pinten o no).
    this.damage.update(s.enemies, s.activeS, (x, y, radius, amount) => {
      if (!this.overlays.numbers) return;
      const q = this.at(x, y);
      this.numbers.spawn(q.x, q.z, amount, t, toScene(radius) * 0.8);
    });
    this.numbers.update(t, this.overlays.numbers, reduced);
    for (const [kind, mesh] of this.meshes) {
      const n = this.counts.get(kind) ?? 0;
      mesh.count = n;
      mesh.visible = n > 0;
      if (n > 0) mesh.instanceMatrix.needsUpdate = true;
    }
    this.drawn = drawn;

    // El golpe al castillo: el aro rojo crece y se apaga.
    const hit = (t - this.castleHitAt) / CASTLE_HIT_S;
    this.castleRing.visible = hit >= 0 && hit < 1;
    if (this.castleRing.visible) {
      const r = toScene(s.castle.radius) * (reduced ? 1.1 : 1 + 0.25 * hit);
      this.castleRing.scale.set(r, 1, r);
    }
    const pv = marks.preview;
    const ir = toScene(this.cfg.islandRadius);
    this.preview.visible = this.previewEdge.visible = pv !== null;
    if (pv) {
      const p = this.at(pv.x, pv.y);
      const color = pv.ok ? PREVIEW_OK : PREVIEW_BAD;
      for (const m of [this.preview, this.previewEdge]) {
        m.position.set(p.x, 0.34, p.z);
        m.scale.set(ir, 1, ir);
        (m.material as MeshBasicMaterial).color.set(color);
      }
    }
    const sel = marks.selected;
    this.selectRing.visible = sel !== null;
    if (sel) {
      const p = this.at(sel.x, sel.y);
      const r = ir * (reduced ? 1.15 : 1.12 + 0.04 * Math.sin(t * 4));
      this.selectRing.position.set(p.x, 0.36, p.z);
      this.selectRing.scale.set(r, 1, r);
    }
    // El alcance (decisión 5): el de la isla que se coloca (nivel 1, de su color) o el de la elegida.
    const rangeAt = pv?.kind ? pv : sel?.kind ? sel : null;
    const range = pv?.kind
      ? towerRangeScene(this.cfg, pv.kind, 1)
      : sel?.kind
        ? towerRangeScene(this.cfg, sel.kind, sel.level ?? 1)
        : 0;
    this.rangeRing.visible = this.rangeFill.visible = range > 0 && rangeAt !== null;
    if (rangeAt && range > 0) {
      const p = this.at(rangeAt.x, rangeAt.y);
      const color = pv ? (pv.ok ? PREVIEW_OK : PREVIEW_BAD) : '#fff4e2';
      for (const m of [this.rangeFill, this.rangeRing]) {
        m.position.set(p.x + this.seen.x, m === this.rangeRing ? 0.33 : 0.32, p.z + this.seen.z);
        m.scale.set(range, 1, range);
        (m.material as MeshBasicMaterial).color.set(color);
      }
    }
    this.range = this.rangeRing.visible ? range : 0;
    const tg = marks.target ?? null;
    this.targetRing.visible = tg !== null;
    if (tg) {
      const p = this.at(tg.x, tg.y);
      const r = reduced ? 1.4 : 1.2 + 0.25 * Math.sin(t * 6);
      this.targetRing.position.set(p.x, 0.35, p.z);
      this.targetRing.scale.set(r, 1, r);
    }
    this.marked = {
      preview: pv ? (pv.ok ? 'ok' : 'no') : '',
      reason: pv && !pv.ok ? (pv.reason ?? '') : '',
      selected: sel !== null,
    };
    this.puf.update(t, defeatPlan('puf', { quality: this.quality, reduced }));
    this.puf.mesh.visible = this.puf.mesh.count > 0;
    this.islands.sync(s.towers, (x, y) => this.at(x, y));
    this.fx.update(s.towers, s.shots, s.activeS, { at: (x, y) => this.at(x, y), heading: (h) => this.frame.headingToWorld(h) }, reduced);
  }

  dispose(): void {
    this.group.removeFromParent();
    // Las islas comparten la geometría de su tipo (se guarda): fuera antes de soltar lo demás.
    this.group.remove(this.islands.group, ...this.fx.meshes);
    this.islands.dispose();
    this.fx.dispose();
    this.group.remove(...this.bars.meshes, this.numbers.mesh, this.clouds.group);
    this.bars.dispose();
    this.numbers.dispose();
    this.clouds.dispose();
    this.disposed = true;
    this.group.traverse((o) => {
      const m = o as Mesh;
      // La geometría del Vecino de Blender es del modelo compartido: la suelta `release`.
      if (m.geometry !== this.vecinoGlb) m.geometry?.dispose();
      const mat = m.material as Material | Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.vecinoGlb = null;
    this.vecinoModel?.release();
  }
}
