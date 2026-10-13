import {
  Box3,
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  type Object3D,
  Raycaster,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { PLANET_PARS, planetUniforms } from './planet';

/**
 * Lo que se ve del barco aburrido (plan 029 T271): las «Zzz» que suben de la
 * cabeza del capitán y la gaviota que se posa en la proa. Procedural, de baja
 * poligonación (estilo de `wildlife.ts`); un solo grupo hijo del casco (se
 * mueve, cabecea y gira con él). La lógica de cuándo es de `@boia/engine/toys`.
 *
 * Dónde se posa la gaviota y de dónde salen las Zzz se mide en cada barco
 * (`findPerch`, al cambiar de modelo): cada casco tiene su proa y su altura.
 */

/** La proa y la cabeza dormida, en coordenadas del casco (`boat.body`). */
export interface Perch {
  bowX: number;
  bowY: number;
  bowZ: number;
  zzzX: number;
  zzzY: number;
}

/** Hasta dónde de la eslora se busca la proa (0 = centro, 1 = la punta). */
const BOW_AT = 0.85;
/** Cuánto por encima o por debajo de la cubierta puede posarse la gaviota. */
const DECK_ABOVE = 0.45;
const DECK_BELOW = 0.45;
/** Tamaño de la gaviota: grande de más, para que se vea desde la cámara de popa. */
const GULL_SCALE = 2.2;
/** Medio cuerpo de la gaviota (escala incluida): de su centro a las patas. */
const GULL_HALF = 0.2 * 0.85 * GULL_SCALE;
/** Por encima de la cabeza del capitán, o de lo más alto del barco si no hay capitán. */
const ZZZ_OVER_HEAD = 0.15;
const ZZZ_OVER_TOP = 0.35;
/** Sin capitán, las Zzz salen de aquí (fracción de eslora hacia popa). */
const ZZZ_AFT = 0.18;
/** Las Zzz salen un poco a un costado del barco. */
const ZZZ_SIDE = 0.35;
const ZZZ_COUNT = 3;
/** s que tarda cada «Z» en subir y apagarse. */
const ZZZ_LIFE = 2.4;
/** s que tarda la gaviota en posarse y en irse volando. */
const GULL_LAND_S = 1.1;
const GULL_FLEE_S = 1.2;

/** La caja de unas mallas en coordenadas de `body` (sin contar su giro ni el del barco). */
function localBox(
  body: Object3D,
  roots: readonly Object3D[],
  skip: readonly (Object3D | null)[],
): Box3 {
  body.updateMatrixWorld(true);
  const inv = new Matrix4().copy(body.matrixWorld).invert();
  const box = new Box3();
  const part = new Box3();
  const m4 = new Matrix4();
  const visit = (o: Object3D): void => {
    if (skip.includes(o)) return;
    const m = o as Mesh;
    if (m.isMesh && m.geometry) {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      if (m.geometry.boundingBox) {
        part.copy(m.geometry.boundingBox).applyMatrix4(m4.multiplyMatrices(inv, m.matrixWorld));
        box.union(part);
      }
    }
    for (const c of o.children) visit(c);
  };
  for (const r of roots) visit(r);
  return box;
}

/** Las alturas (del casco) de todo lo que hay en (x, z) del casco, de arriba abajo. */
function heightsAt(body: Object3D, meshes: Object3D[], x: number, z: number, box: Box3): number[] {
  const from = body.localToWorld(new Vector3(x, box.max.y + 1, z));
  const dir = body
    .localToWorld(new Vector3(x, box.min.y - 1, z))
    .sub(from)
    .normalize();
  return new Raycaster(from, dir)
    .intersectObjects(meshes, false)
    .map((h) => body.worldToLocal(h.point.clone()).y);
}

/**
 * Dónde se posa la gaviota (en la proa, sobre lo que haya: cubierta, borda o
 * techo) y de dónde salen las Zzz (sobre la cabeza del capitán o, sin él,
 * sobre la cubierta hacia popa), medido en el modelo que lleva el barco.
 * `hull`: lo que es barco; `skip`: lo que cuelga del casco y no es barco (la
 * tripulación, la mascota, los juguetes); `deckY`: la altura de la cubierta
 * (la del sitio de la pasajera). Se llama al cambiar de modelo, nunca por
 * fotograma.
 */
export function findPerch(
  body: Object3D,
  hull: readonly Object3D[],
  skip: readonly (Object3D | null)[],
  captain: Object3D | null,
  deckY: number,
): Perch | null {
  const box = localBox(body, hull, skip);
  if (box.isEmpty()) return null;
  const meshes: Object3D[] = [];
  const collect = (o: Object3D): void => {
    if (skip.includes(o)) return;
    if ((o as Mesh).isMesh) meshes.push(o);
    for (const c of o.children) collect(c);
  };
  for (const r of hull) collect(r);
  const len = box.max.x - box.min.x;
  const midX = (box.min.x + box.max.x) / 2;
  const z = (box.min.z + box.max.z) / 2;
  // La proa: desde BOW_AT de la eslora hacia el centro, el primer sitio con
  // cubierta (o borda) cerca de la altura de la cubierta; nunca en lo alto de
  // un mástil, un toldo o una guirnalda.
  let bowX = midX + (len / 2) * BOW_AT;
  let bowY: number | null = null;
  for (let i = 0; i < 10 && bowY === null; i++) {
    for (const y of heightsAt(body, meshes, bowX, z, box)) {
      if (y <= deckY + DECK_ABOVE && y >= deckY - DECK_BELOW) {
        bowY = y;
        break;
      }
    }
    if (bowY === null) bowX -= len * 0.04;
  }
  let zzzX: number;
  let zzzY: number;
  if (captain) {
    const head = localBox(body, [captain], []);
    zzzX = (head.min.x + head.max.x) / 2;
    zzzY = head.max.y + ZZZ_OVER_HEAD;
  } else {
    // Sin capitán: sobre lo más alto del barco hacia popa (el techo, si lo hay), a la vista.
    zzzX = midX - len * ZZZ_AFT;
    zzzY = (heightsAt(body, meshes, zzzX, z, box)[0] ?? deckY) + ZZZ_OVER_TOP;
  }
  return { bowX, bowY: (bowY ?? deckY) + GULL_HALF, bowZ: z, zzzX, zzzY };
}

/**
 * Un `Sprite` que se dobla con el planeta como todo lo demás (los materiales
 * de `curveTree` no saben de sprites): sin esto, las Zzz flotarían donde el
 * barco estaría sin curva, varios cuerpos por delante de él.
 */
function curveSprite(m: SpriteMaterial): void {
  m.userData.planet = 'bend';
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, planetUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PLANET_PARS}`)
      .replace(
        'vec4 mvPosition = modelViewMatrix[ 3 ];',
        'vec4 mvPosition = viewMatrix * vec4( planetCurve( modelMatrix[ 3 ].xyz ), 1.0 );',
      );
  };
  m.customProgramCacheKey = () => 'planet-sprite';
}

function zTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  if (!g) return null;
  g.font = 'bold 54px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 8;
  g.strokeStyle = '#2a1b6b';
  g.strokeText('Z', 32, 34);
  g.fillStyle = '#ffffff';
  g.fillText('Z', 32, 34);
  return new CanvasTexture(c);
}

export class ToysView {
  readonly group = new Group();
  private readonly zs: Sprite[] = [];
  private readonly gull = new Group();
  private readonly wing = { l: new Mesh(), r: new Mesh() };
  private readonly texture: CanvasTexture | null;
  private readonly owned: { dispose(): void }[] = [];
  private zzzAge = 0;
  private sleeping = false;
  /** 0 = no está; sube a 1 al posarse; el valor negativo cuenta la huida. */
  private gullState: 'away' | 'landing' | 'perched' | 'fleeing' = 'away';
  private gullT = 0;
  /** Susto al despertar: s que quedan. */
  private startleT = 0;
  /** Dónde se posa la gaviota y de dónde salen las Zzz (lo mide `findPerch`). */
  private readonly perch: Perch = { bowX: 1.2, bowY: 0.7, bowZ: 0, zzzX: -0.85, zzzY: 1.5 };

  constructor() {
    this.group.visible = false;
    this.texture = zTexture();
    for (let i = 0; i < ZZZ_COUNT; i++) {
      const mat = new SpriteMaterial({
        map: this.texture,
        transparent: true,
        depthWrite: false,
        fog: false,
      });
      curveSprite(mat);
      this.owned.push(mat);
      const s = new Sprite(mat);
      s.visible = false;
      this.zs.push(s);
      this.group.add(s);
    }
    this.buildGull();
    this.group.add(this.gull);
    this.gull.visible = false;
    if (this.texture) this.owned.push(this.texture);
  }

  private buildGull(): void {
    const white = new MeshLambertMaterial({ color: 0xffffff });
    const grey = new MeshLambertMaterial({ color: 0xb9c4d2 });
    const orange = new MeshLambertMaterial({ color: 0xff9f2e });
    const body = new SphereGeometry(0.2, 8, 6);
    const head = new SphereGeometry(0.11, 8, 6);
    const beak = new ConeGeometry(0.04, 0.14, 5);
    const wing = new BoxGeometry(0.22, 0.02, 0.34);
    this.owned.push(white, grey, orange, body, head, beak, wing);
    const b = new Mesh(body, white);
    b.scale.set(1.3, 0.85, 0.8);
    const h = new Mesh(head, white);
    h.position.set(0.25, 0.12, 0);
    const k = new Mesh(beak, orange);
    k.rotation.z = -Math.PI / 2;
    k.position.set(0.38, 0.11, 0);
    const l = new Mesh(wing, grey);
    l.position.set(-0.02, 0.06, 0.2);
    const r = new Mesh(wing, grey);
    r.position.set(-0.02, 0.06, -0.2);
    this.wing.l = l;
    this.wing.r = r;
    this.gull.add(b, h, k, l, r);
    this.gull.scale.setScalar(GULL_SCALE);
  }

  /** Pone la proa y la cabeza del barco que se lleva ahora. */
  setPerch(p: Perch | null): void {
    if (p) Object.assign(this.perch, p);
  }

  /** El capitán se duerme (o despierta). */
  setSleeping(on: boolean, startle: boolean): void {
    if (on === this.sleeping) return;
    this.sleeping = on;
    if (on) {
      this.zzzAge = 0;
    } else {
      for (const s of this.zs) s.visible = false;
      if (startle) this.startleT = 0.55;
      if (this.gullState === 'landing' || this.gullState === 'perched') {
        this.gullState = 'fleeing';
        this.gullT = 0;
      }
    }
  }

  /** La gaviota empieza a posarse. */
  landGull(): void {
    if (this.gullState === 'perched' || this.gullState === 'landing') return;
    this.gullState = 'landing';
    this.gullT = 0;
    this.gull.visible = true;
  }

  get asleep(): boolean {
    return this.sleeping;
  }

  get gullShown(): boolean {
    return this.gullState === 'landing' || this.gullState === 'perched';
  }

  /** Lo que se menea el capitán por el susto (0 sin susto): salto en y (escena). */
  get startleHop(): number {
    return this.startleT > 0 ? Math.sin((this.startleT / 0.55) * Math.PI) * 0.35 : 0;
  }

  /**
   * Un fotograma. `reduced`: sin vaivén extra (las Zzz se quedan quietas y la
   * gaviota se va sin aleteo).
   */
  update(t: number, dt: number, reduced: boolean): void {
    if (this.startleT > 0) this.startleT = Math.max(0, this.startleT - dt);
    const gullBusy = this.gullState !== 'away';
    this.group.visible = this.sleeping || gullBusy || this.startleT > 0;
    if (this.sleeping) {
      const { zzzX, zzzY, bowZ } = this.perch;
      this.zzzAge += dt;
      for (let i = 0; i < this.zs.length; i++) {
        const s = this.zs[i]!;
        const phase = (this.zzzAge / ZZZ_LIFE + i / ZZZ_COUNT) % 1;
        const grow = 0.45 + phase * 0.6;
        s.visible = true;
        s.scale.set(grow, grow, 1);
        const rise = reduced ? 0.3 + phase * 0.3 : phase * 1.1;
        // Suben y se van de lado (no hacia proa): así no tapan a la gaviota.
        s.position.set(
          zzzX - phase * 0.2,
          zzzY + rise,
          bowZ + ZZZ_SIDE + phase * 0.6 + (reduced ? 0 : Math.sin(t * 2 + i) * 0.06),
        );
        (s.material as SpriteMaterial).opacity = Math.sin(phase * Math.PI) * 0.95;
      }
    }
    this.stepGull(t, dt, reduced);
  }

  private stepGull(t: number, dt: number, reduced: boolean): void {
    const g = this.gull;
    if (this.gullState === 'away') return;
    this.gullT += dt;
    const flap = reduced ? 0 : Math.sin(t * 30) * 0.7;
    const { bowX, bowY, bowZ } = this.perch;
    if (this.gullState === 'landing') {
      const k = Math.min(1, this.gullT / GULL_LAND_S);
      const ease = 1 - (1 - k) ** 2;
      g.position.set(bowX + (1 - ease) * 1.6, bowY + (1 - ease) * 1.4, bowZ + 0.25 * (1 - ease));
      // Llega desde proa y se queda mirando a popa (al capitán y a la cámara).
      g.rotation.y = Math.PI;
      this.wing.l.rotation.x = this.wing.r.rotation.x = k < 1 ? flap : 0;
      this.wing.l.rotation.z = this.wing.r.rotation.z = k < 1 ? 0 : -0.05;
      if (k >= 1) this.gullState = 'perched';
    } else if (this.gullState === 'perched') {
      g.position.set(bowX, bowY + (reduced ? 0 : Math.sin(t * 1.7) * 0.015), bowZ);
      g.rotation.y = Math.PI;
      this.wing.l.rotation.x = this.wing.r.rotation.x = 0;
    } else {
      const k = Math.min(1, this.gullT / GULL_FLEE_S);
      g.position.set(bowX + k * 2.4, bowY + k * 2.2, bowZ + k * 0.8);
      g.rotation.y = 0;
      this.wing.l.rotation.x = this.wing.r.rotation.x = reduced ? 0 : flap;
      if (k >= 1) {
        this.gullState = 'away';
        g.visible = false;
      }
    }
  }

  dispose(): void {
    for (const d of this.owned) d.dispose();
  }
}
