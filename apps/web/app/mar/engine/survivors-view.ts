import type {
  DefeatStyle,
  EnemyId,
  EnemyView,
  QualityCaps,
  SurvivorsConfig,
  SurvivorsSnapshot,
  SurvivorsWorld,
} from '@boia/engine/survivors';
import { NOTE_FIGURES } from '@boia/engine/survivors';
import type { QualityTier } from '@boia/engine/streaming';
import { Color, Group, type InstancedMesh, type Material, Mesh, Object3D } from 'three';
import { toScene } from './compress';
import { SurvivorsPickups } from './survivors-pickups';
import { SurvivorsReadouts } from './survivors-readouts';
import { SurvivorsShark } from './survivors-shark';
import { SurvivorsWeapons } from './survivors-weapons';
import { SurvivorsVecino } from './survivors-vecino';
import { SurvivorsKraken } from './survivors-kraken';
import { curveTree } from './planet';
import {
  BOSS_WARNING_CAP,
  BOSS_WARNING_MIN_WIDTH,
  GHOST_HOVER,
  GHOST_PIRATE_CAP,
  GHOST_SHIP_SCALE,
  HALO_PULSE,
  HALO_SCALE,
  NOTE_SIZE,
  PufFx,
  SHOT_MIN,
  SHOT_SCALE,
  SinkFx,
  WARNING_COLORS,
  WARNING_WIDTH,
  defeatPlan,
  eliteHaloGeometry,
  eliteHaloMaterial,
  enemyMaterial,
  enemyModel,
  enemyShotGeometry,
  enemyShotMaterial,
  ghostPirateMaterial,
  ghostShipGeometry,
  ghostShipMaterial,
  instanced,
  noteGeometry,
  propsMaterial,
  shadowGeometry,
  shadowMaterial,
  warningLineGeometry,
  warningLineMaterial,
} from './survivors-props';

/**
 * Lo que se pinta de una partida del Cañón en el mar 3D (T116, T117):
 * enemigos, bolas del cañón y notas con los modelos de la beta
 * (`survivors-props.ts`), y el efecto de derrota del estilo elegido. Un
 * `InstancedMesh` por tipo (y por figura de nota), del tamaño del tope de la
 * calidad: pintar es mover matrices, sin crear nada por fotograma. Cada
 * pieza va en su sitio del mapa (u de motor → escena) y el material la lleva
 * a la copia más cercana al foco (`curveTree` con la vuelta del planeta).
 *
 * T126: los enemigos de la beta 2 con sus modelos (la gaviota vuela a su
 * altura sobre el agua o la isla que tenga debajo, con su sombra), el aro
 * dorado de las élites, la línea de aviso del pez espada y los disparos del
 * pirata; cada cosa, una pieza instanciada más (y una pieza vacía no se
 * pinta: no gasta llamada de dibujo).
 */

/** Pone cuántas piezas se pintan; vacía, ni se dibuja. */
function show(mesh: InstancedMesh, n: number): void {
  mesh.count = n;
  mesh.visible = n > 0;
  mesh.instanceMatrix.needsUpdate = true;
}

/** Cuánto sube o baja por segundo lo que vuela para seguir el suelo (escena/s). */
const FLY_RISE = 12;
const FLY_FALL = 3;
/** s por delante en que lo que vuela mira el suelo (sube antes de llegar a la isla). */
const FLY_LOOKAHEAD_S = 0.6;
/** Altura de los disparos enemigos sobre el agua (escena). */
const SHOT_Y = 0.9;

const EMPTY: readonly EnemyView[] = [];

export interface SurvivorsViewOptions {
  /** Calidad de `/mar` (efectos más baratos en `baja`). Sin valor, `alta`. */
  quality?: QualityTier;
  /** Estilo de derrota (sin valor, el de la config). */
  defeatStyle?: DefeatStyle;
  /** Movimiento reducido (efecto mínimo). */
  reduced?: boolean;
  /**
   * Altura del suelo (escena) en un punto del mapa (escena): lo que vuela
   * pasa por encima de las islas. Sin valor, agua en todas partes.
   */
  groundAt?: (x: number, z: number) => number;
  /**
   * El mar de la partida (u): sus límites y sus islas, para que el Kraken
   * tienda los brazos hacia la isla que agarra (T142). Sin valor, a su espalda.
   */
  sea?: Pick<SurvivorsWorld, 'bounds' | 'obstacles'>;
}

export class SurvivorsView {
  readonly group = new Group();
  readonly quality: QualityTier;
  readonly readouts: SurvivorsReadouts;
  /** Movimiento reducido ahora (se puede cambiar en vivo). */
  reduced: boolean;
  private style: DefeatStyle;
  private readonly enemyIds: EnemyId[] = [];
  private readonly enemyMeshes: InstancedMesh[] = [];
  private readonly enemyScale: number[] = [];
  private readonly enemyBob: number[] = [];
  private readonly enemyRadius: number[] = [];
  private readonly enemyFly: number[] = [];
  private readonly enemyPulse: number[] = [];
  readonly weapons: SurvivorsWeapons;
  /** El botín de las élites y la Llama (T135). */
  readonly pickups: SurvivorsPickups;
  /** El Tiburón Martillo, los avisos de sus embestidas y llamadas, y los cofres (T139). */
  readonly shark: SurvivorsShark;
  private readonly shots: InstancedMesh;
  private readonly halos: InstancedMesh;
  private readonly warnings: InstancedMesh;
  private readonly shadows: InstancedMesh;
  /**
   * El Barco Pirata Fantasma (T140): el mismo modelo con dos materiales,
   * sólido y desvanecido; sólo uno se ve. Null si la config no lo tiene.
   */
  private readonly ghostShip: { solid: Mesh; ghost: Mesh } | null;
  readonly vecino: SurvivorsVecino | null;
  /** El Kraken (T142): sombra, cabeza, tentáculos, rocas y avisos. Null si la config no lo tiene. */
  readonly kraken: SurvivorsKraken | null;
  /** Los piratas fantasma que llama (el modelo del pirata teñido y translúcido), por tipo. */
  private readonly ghostMeshes: (InstancedMesh | null)[] = [];
  /** Las líneas de aviso de los bosses (andanadas, embestidas): dos piezas por línea, como `warnings`. */
  private readonly bossWarnings: InstancedMesh;
  private readonly groundAt: (x: number, z: number) => number;
  /** Altura de vuelo de cada enemigo que vuela (por id), y el fotograma en que se vio. */
  private readonly flyY = new Map<number, { y: number; seen: number }>();
  private frame = 0;
  private readonly all: InstancedMesh[];
  private readonly noteMeshes: InstancedMesh[];
  private readonly noteCounts: number[];
  private readonly puf: PufFx;
  private readonly sink: SinkFx;
  private readonly dummy = new Object3D();
  private last: SurvivorsSnapshot | null = null;
  private now = 0;
  private readonly config: SurvivorsConfig;

  constructor(config: SurvivorsConfig, caps: QualityCaps, opts: SurvivorsViewOptions = {}) {
    this.config = config;
    this.groundAt = opts.groundAt ?? (() => 0);
    // Rumbo por fuera: cabeceo y alabeo en los ejes del modelo y después el giro.
    this.dummy.rotation.order = 'YXZ';
    this.quality = opts.quality ?? 'alta';
    this.reduced = opts.reduced ?? false;
    this.style = opts.defeatStyle ?? config.defeatStyle;
    const kinds: { geometry: InstancedMesh['geometry']; material: Material; name: string }[] = [];
    for (const id of Object.keys(config.enemies) as EnemyId[]) {
      const model = enemyModel(id);
      const mesh = instanced(model.build(), enemyMaterial(model), caps.enemies, `survivors-${id}`);
      this.enemyIds.push(id);
      this.enemyMeshes.push(mesh);
      this.enemyScale.push(model.scale);
      this.enemyBob.push(model.bob);
      this.enemyFly.push(model.fly ?? 0);
      this.enemyPulse.push(model.pulse ?? 0);
      this.enemyRadius.push(config.enemies[id]?.radius ?? 10);
      kinds.push({ geometry: mesh.geometry, material: mesh.material as Material, name: mesh.name });
      this.group.add(mesh);
      // Los piratas fantasma (T140): la misma geometría, otro material, en su propia pieza.
      if (id === 'pirate' && config.bosses.fantasma) {
        const ghost = instanced(
          mesh.geometry,
          ghostPirateMaterial(),
          Math.min(caps.enemies, GHOST_PIRATE_CAP),
          `survivors-${id}-ghost`,
        );
        this.ghostMeshes.push(ghost);
        this.group.add(ghost);
      } else this.ghostMeshes.push(null);
    }
    if (config.bosses.fantasma) {
      const geometry = ghostShipGeometry();
      const solid = new Mesh(geometry, ghostShipMaterial(false));
      solid.name = 'survivors-boss-fantasma';
      const ghost = new Mesh(geometry, ghostShipMaterial(true));
      ghost.name = 'survivors-boss-fantasma-ghost';
      solid.rotation.order = ghost.rotation.order = 'YXZ';
      solid.visible = ghost.visible = false;
      this.ghostShip = { solid, ghost };
      this.group.add(solid, ghost);
    } else this.ghostShip = null;
    this.vecino = config.bosses.vecino ? new SurvivorsVecino(this.quality) : null;
    if (this.vecino) this.group.add(this.vecino.group);
    this.kraken = config.bosses.kraken ? new SurvivorsKraken(this.quality, opts.sea ?? null) : null;
    if (this.kraken) this.group.add(this.kraken.group);
    this.bossWarnings = instanced(
      warningLineGeometry(),
      warningLineMaterial(),
      BOSS_WARNING_CAP * 2,
      'survivors-boss-warning',
    );
    {
      const track = new Color(WARNING_COLORS.track);
      const fill = new Color(WARNING_COLORS.fill);
      for (let i = 0; i < BOSS_WARNING_CAP * 2; i++)
        this.bossWarnings.setColorAt(i, i % 2 ? fill : track);
    }
    this.weapons = new SurvivorsWeapons(config, caps, this.groundAt);
    this.pickups = new SurvivorsPickups(config, this.quality, this.groundAt);
    this.shark = new SurvivorsShark(config);
    this.shots = instanced(
      enemyShotGeometry(),
      enemyShotMaterial(),
      caps.enemyProjectiles,
      'survivors-enemy-shots',
    );
    this.halos = instanced(
      eliteHaloGeometry(),
      eliteHaloMaterial(),
      caps.enemies,
      'survivors-elite',
    );
    // Dos por aviso: el tramo entero y lo que ya se ha llenado (el color va por pieza).
    this.warnings = instanced(
      warningLineGeometry(),
      warningLineMaterial(),
      caps.enemies * 2,
      'survivors-warning',
    );
    const track = new Color(WARNING_COLORS.track);
    const fill = new Color(WARNING_COLORS.fill);
    for (let i = 0; i < caps.enemies * 2; i++) this.warnings.setColorAt(i, i % 2 ? fill : track);
    this.shadows = instanced(shadowGeometry(), shadowMaterial(), caps.enemies, 'survivors-shadow');
    this.noteMeshes = NOTE_FIGURES.map((f) =>
      instanced(noteGeometry(f), propsMaterial(), caps.notes, `survivors-note-${f}`),
    );
    this.noteCounts = NOTE_FIGURES.map(() => 0);
    this.puf = new PufFx(this.quality);
    this.sink = new SinkFx(this.quality, kinds);
    this.group.add(
      this.shadows,
      this.warnings,
      this.bossWarnings,
      this.halos,
      this.shots,
      ...Object.values(this.weapons.meshes),
      ...this.noteMeshes,
      ...this.pickups.meshes,
      ...this.shark.meshes,
      this.puf.mesh,
      ...this.sink.meshes,
      this.sink.rings,
    );
    this.readouts = new SurvivorsReadouts(this.quality, (type, id) => this.heightOf(type, id));
    this.group.add(this.readouts.group);
    this.all = Object.values(this.meshes());
    for (const m of this.all) m.visible = false;
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
    const out: Record<string, number> = {
      projectiles: this.weapons.meshes['survivors-balls']!.instanceMatrix.count,
      enemyProjectiles: this.shots.instanceMatrix.count,
      elites: this.halos.instanceMatrix.count,
      warnings: this.warnings.instanceMatrix.count / 2,
      bossWarnings: this.bossWarnings.instanceMatrix.count / 2,
    };
    this.enemyIds.forEach((id, i) => {
      out[id] = this.enemyMeshes[i]!.instanceMatrix.count;
      const ghost = this.ghostMeshes[i];
      if (ghost) out[`${id}-ghost`] = ghost.instanceMatrix.count;
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

  /** La altura (escena) a la que se pinta un enemigo vivo ahora: 0 en el agua; lo que vuela, en el aire. */
  heightOf(type: EnemyId, id: number): number {
    const ti = this.enemyIds.indexOf(type);
    if (ti < 0 || this.enemyFly[ti]! <= 0) return 0;
    return this.flyY.get(id)?.y ?? this.enemyFly[ti]!;
  }

  /**
   * Un enemigo derrotado (evento `defeated` de la simulación, en u): su
   * efecto, en el estilo de ahora. El rumbo, el tamaño (los trozos de medusa
   * son más pequeños) y la altura (la gaviota cae desde el aire) salen del
   * último pintado.
   */
  defeat(type: EnemyId, id: number, x: number, y: number): void {
    const ti = this.enemyIds.indexOf(type);
    let radius = ti >= 0 ? this.enemyRadius[ti]! : 10;
    let heading = 0;
    const list = this.last?.enemiesByType[type] ?? EMPTY;
    for (let i = 0; i < list.length; i++) {
      if (list[i]!.id === id) {
        heading = list[i]!.heading;
        radius = list[i]!.radius;
        break;
      }
    }
    const size = toScene(radius) * (ti >= 0 ? this.enemyScale[ti]! : 1.2);
    const sx = toScene(x);
    const sz = toScene(y);
    const sy = this.heightOf(type, id);
    if (this.style === 'puf') {
      this.puf.spawn(sx, sz, size, this.now, sy);
      return;
    }
    if (ti < 0) return;
    this.sink.spawn(ti, sx, sz, heading, size, this.now, sy);
  }

  /**
   * Los tipos de enemigo con alguno pintado donde `test` dice (escena: x, y,
   * z y radio de la pieza). Lee las matrices ya puestas: no crea nada.
   */
  typesWhere(test: (x: number, y: number, z: number, r: number) => boolean): EnemyId[] {
    const out: EnemyId[] = [];
    for (let ti = 0; ti < this.enemyIds.length; ti++) {
      // Los piratas fantasma cuentan como piratas.
      for (const mesh of [this.enemyMeshes[ti]!, this.ghostMeshes[ti]]) {
        if (!mesh || !instanceWhere(mesh, test)) continue;
        out.push(this.enemyIds[ti]!);
        break;
      }
    }
    return out;
  }

  /**
   * Los bosses con su pieza visible donde `test` dice (escena), para las
   * pruebas: el Fantasma, sólido o desvanecido, como `fantasma:solid`.
   */
  bossesWhere(test: (x: number, y: number, z: number, r: number) => boolean): string[] {
    const out: string[] = [];
    const vecino = this.vecino?.barge;
    if (
      vecino?.visible &&
      test(vecino.position.x, vecino.position.y, vecino.position.z, vecino.scale.x * 1.5)
    )
      out.push('vecino');
    // El Kraken (T142): `kraken:<modo>` si se ve su cabeza o su sombra.
    const kraken = this.kraken?.shown();
    if (kraken && this.last) {
      const p = kraken.mesh.position;
      const mode = this.last.bosses.find((b) => b.kraken)?.kraken?.mode ?? 'submerged';
      if (test(p.x, Math.max(0, p.y), p.z, kraken.mesh.scale.x * 1.5)) out.push(`kraken:${mode}`);
    }
    const g = this.ghostShip;
    if (g) {
      for (const [mesh, mode] of [
        [g.solid, 'solid'],
        [g.ghost, 'ghost'],
      ] as const) {
        if (!mesh.visible) continue;
        const p = mesh.position;
        if (test(p.x, p.y, p.z, mesh.scale.x * 1.5)) out.push(`fantasma:${mode}`);
      }
    }
    return out;
  }

  /** Pinta la partida de ahora (`t`: s de la escena, para el vaivén y los efectos). */
  update(s: SurvivorsSnapshot, t: number): void {
    const dt = Math.min(0.1, Math.max(0, t - this.now));
    this.last = s;
    this.now = t;
    this.frame++;
    this.updateEnemies(s, t, dt);
    this.readouts.update(s, this.reduced);
    const d = this.dummy;
    this.weapons.update(s, t, this.reduced);
    const ns = Math.min(s.enemyProjectiles.length, this.shots.instanceMatrix.count);
    for (let i = 0; i < ns; i++) {
      const p = s.enemyProjectiles[i]!;
      d.position.set(toScene(p.x), SHOT_Y, toScene(p.y));
      d.rotation.set(0, -Math.atan2(p.vy, p.vx), 0);
      d.scale.setScalar(Math.max(SHOT_MIN, toScene(p.radius) * SHOT_SCALE));
      d.updateMatrix();
      this.shots.setMatrixAt(i, d.matrix);
    }
    show(this.shots, ns);
    this.updateWarnings(s);
    this.updateBosses(s, t);
    this.updateNotes(s, t);
    this.pickups.update(s, t, this.reduced);
    this.shark.update(s, t, this.reduced);
    const plan = defeatPlan(this.style, { quality: this.quality, reduced: this.reduced });
    if (this.style === 'puf') this.puf.update(t, plan);
    else this.sink.update(t, plan);
    // Lo que no tiene piezas no se dibuja (los efectos de derrota ponen sólo `count`).
    for (const m of this.all) m.visible = m.count > 0;
  }

  /** Los enemigos, el aro de las élites y la sombra de lo que vuela. */
  private updateEnemies(s: SurvivorsSnapshot, t: number, dt: number): void {
    const d = this.dummy;
    const reduced = this.reduced;
    const haloCap = this.halos.instanceMatrix.count;
    const shadowCap = this.shadows.instanceMatrix.count;
    let nh = 0;
    let nsh = 0;
    for (let ti = 0; ti < this.enemyIds.length; ti++) {
      const mesh = this.enemyMeshes[ti]!;
      const ghostMesh = this.ghostMeshes[ti];
      const list = s.enemiesByType[this.enemyIds[ti]!] ?? EMPTY;
      const cap = mesh.instanceMatrix.count;
      const ghostCap = ghostMesh?.instanceMatrix.count ?? 0;
      const k = this.enemyScale[ti]!;
      const bob = reduced ? 0 : this.enemyBob[ti]!;
      const fly = this.enemyFly[ti]!;
      const pulse = reduced ? 0 : this.enemyPulse[ti]!;
      let n = 0;
      let ng = 0;
      for (let li = 0; li < list.length; li++) {
        const e = list[li]!;
        // Los fantasmas (T140) van a su pieza translúcida; sin ella, con los demás.
        const asGhost = e.ghost && ghostMesh !== null && ghostMesh !== undefined;
        if (asGhost ? ng >= ghostCap : n >= cap) continue;
        const x = toScene(e.x);
        const z = toScene(e.y);
        const size = toScene(e.radius) * k;
        let ground = 0;
        let y = Math.sin(t * 6 + e.id) * bob;
        if (fly > 0) {
          ground = this.groundAt(x, z);
          y += this.flyHeight(e.id, x, z, toScene(e.vx), toScene(e.vy), ground, fly, dt);
        }
        d.position.set(x, y, z);
        // Lo que vuela se ladea un poco al planear (nunca con movimiento reducido).
        d.rotation.set(fly > 0 && !reduced ? Math.sin(t * 1.7 + e.id) * 0.25 : 0, -e.heading, 0);
        if (pulse > 0) {
          const p = Math.sin(t * 3 + e.id) * pulse;
          d.scale.set(size * (1 - p * 0.5), size * (1 + p), size * (1 - p * 0.5));
        } else d.scale.setScalar(size);
        d.updateMatrix();
        if (asGhost) ghostMesh.setMatrixAt(ng++, d.matrix);
        else mesh.setMatrixAt(n++, d.matrix);
        if (e.elite && nh < haloCap) {
          const beat = reduced ? 1 : 1 + Math.sin(t * 4 + e.id) * HALO_PULSE;
          d.position.set(x, y + 0.08, z);
          d.rotation.set(0, 0, 0);
          d.scale.setScalar(size * HALO_SCALE * beat);
          d.updateMatrix();
          this.halos.setMatrixAt(nh++, d.matrix);
        }
        if (fly > 0 && nsh < shadowCap) {
          d.position.set(x, ground + 0.05, z);
          d.rotation.set(0, 0, 0);
          d.scale.setScalar(size * 0.9);
          d.updateMatrix();
          this.shadows.setMatrixAt(nsh++, d.matrix);
        }
      }
      show(mesh, n);
      if (ghostMesh) show(ghostMesh, ng);
    }
    show(this.halos, nh);
    show(this.shadows, nsh);
    // Se olvida la altura de lo que ya no vuela.
    if (this.flyY.size > 0) {
      for (const [id, f] of this.flyY) if (f.seen !== this.frame) this.flyY.delete(id);
    }
  }

  /**
   * La altura de vuelo (escena) de un enemigo que vuela: `fly` por encima del
   * suelo que tiene debajo o un poco por delante (sube antes de llegar a una
   * isla, baja despacio al dejarla).
   */
  private flyHeight(
    id: number,
    x: number,
    z: number,
    vx: number,
    vz: number,
    ground: number,
    fly: number,
    dt: number,
  ): number {
    const ahead = this.groundAt(x + vx * FLY_LOOKAHEAD_S, z + vz * FLY_LOOKAHEAD_S);
    const goal = Math.max(ground, ahead) + fly;
    const f = this.flyY.get(id);
    if (!f) {
      this.flyY.set(id, { y: goal, seen: this.frame });
      return goal;
    }
    f.seen = this.frame;
    f.y = goal > f.y ? Math.min(goal, f.y + FLY_RISE * dt) : Math.max(goal, f.y - FLY_FALL * dt);
    // Nunca se mete en el suelo que tiene justo debajo.
    f.y = Math.max(f.y, ground + fly * 0.5);
    return f.y;
  }

  /**
   * La línea de aviso de cada embestida: el tramo entero (oscuro) y encima
   * lo llenado con el progreso (vivo). Sin parpadeos: avisa igual con
   * movimiento reducido.
   */
  private updateWarnings(s: SurvivorsSnapshot): void {
    const d = this.dummy;
    const cap = this.warnings.instanceMatrix.count;
    let w = 0;
    for (let i = 0; i < s.telegraphs.length && w + 1 < cap; i++) {
      const g = s.telegraphs[i]!;
      const radius = this.config.enemies[g.type]?.radius ?? 10;
      const width = toScene(radius) * 2 * WARNING_WIDTH;
      const len = Math.max(0.01, toScene(g.length));
      const x = toScene(g.x);
      const z = toScene(g.y);
      d.rotation.set(0, -g.heading, 0);
      d.position.set(x, 0.07, z);
      d.scale.set(len, 1, width);
      d.updateMatrix();
      this.warnings.setMatrixAt(w++, d.matrix);
      const p = Math.min(1, Math.max(0, g.progress));
      d.position.set(x, 0.1, z);
      d.scale.set(Math.max(0.001, len * p), 1, width * 0.7);
      d.updateMatrix();
      this.warnings.setMatrixAt(w++, d.matrix);
    }
    show(this.warnings, w);
  }

  /**
   * Los bosses (T140): el Barco Pirata Fantasma en su sitio, con la pieza de
   * su modo (sólido: se le puede herir; desvanecido: translúcido, flotando un
   * poco más alto, fijo), y las líneas de aviso de sus andanadas (una por
   * costado, el tramo entero y lo llenado con el progreso; durante los
   * disparos, llena). Sin parpadeos; con movimiento reducido, sin vaivén.
   */
  private updateBosses(s: SurvivorsSnapshot, t: number): void {
    this.vecino?.update(s, t, this.reduced);
    this.kraken?.update(s, t, this.reduced);
    const g = this.ghostShip;
    if (g) {
      let seen = false;
      for (let i = 0; i < s.bosses.length && !seen; i++) {
        const b = s.bosses[i]!;
        if (b.boss !== 'fantasma' || !b.fantasma) continue;
        seen = true;
        const ghost = b.fantasma.mode === 'ghost';
        const mesh = ghost ? g.ghost : g.solid;
        const other = ghost ? g.solid : g.ghost;
        const bob = this.reduced ? 0 : Math.sin(t * 1.4 + b.id) * 0.08;
        mesh.position.set(toScene(b.x), (ghost ? GHOST_HOVER : 0) + bob, toScene(b.y));
        mesh.rotation.set(0, -b.heading, this.reduced ? 0 : Math.sin(t * 0.9 + b.id) * 0.04);
        mesh.scale.setScalar(toScene(b.radius) * GHOST_SHIP_SCALE);
        mesh.updateMatrix();
        mesh.visible = true;
        other.visible = false;
      }
      if (!seen) g.solid.visible = g.ghost.visible = false;
    }
    const d = this.dummy;
    const cap = this.bossWarnings.instanceMatrix.count;
    let w = 0;
    for (let i = 0; i < s.bossWarnings.length && w + 1 < cap; i++) {
      const v = s.bossWarnings[i]!;
      if (v.kind !== 'broadside' && v.kind !== 'line') continue;
      const width = Math.max(BOSS_WARNING_MIN_WIDTH, toScene(v.thickness) * 2 * WARNING_WIDTH);
      const len = Math.max(0.01, toScene(v.length));
      const x = toScene(v.x);
      const z = toScene(v.y);
      d.rotation.set(0, -v.heading, 0);
      d.position.set(x, 0.07, z);
      d.scale.set(len, 1, width);
      d.updateMatrix();
      this.bossWarnings.setMatrixAt(w++, d.matrix);
      const p = v.hit ? 1 : Math.min(1, Math.max(0, v.progress));
      d.position.set(x, 0.1, z);
      d.scale.set(Math.max(0.001, len * p), 1, width * 0.7);
      d.updateMatrix();
      this.bossWarnings.setMatrixAt(w++, d.matrix);
    }
    show(this.bossWarnings, w);
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
      show(this.noteMeshes[i]!, counts[i]!);
    }
  }

  dispose(): void {
    this.readouts.dispose();
    this.vecino?.dispose();
    this.kraken?.dispose();
    this.weapons.dispose();
    this.group.removeFromParent();
    const done = new Set<unknown>();
    this.group.traverse((o) => {
      const m = o as InstancedMesh;
      if (!(m as Mesh).isMesh) return;
      for (const r of [m.geometry, m.material as Material]) {
        if (done.has(r)) continue;
        done.add(r);
        r.dispose();
      }
      if (m.isInstancedMesh) m.dispose();
    });
  }
}

/** ¿Alguna pieza pintada de `mesh` pasa `test` (escena: x, y, z y radio)? Lee las matrices: no crea nada. */
function instanceWhere(
  mesh: InstancedMesh,
  test: (x: number, y: number, z: number, r: number) => boolean,
): boolean {
  const a = mesh.instanceMatrix.array;
  for (let i = 0; i < mesh.count; i++) {
    const o = i * 16;
    const r = Math.hypot(a[o]!, a[o + 1]!, a[o + 2]!) * 1.5;
    if (test(a[o + 12]!, a[o + 13]!, a[o + 14]!, r)) return true;
  }
  return false;
}
