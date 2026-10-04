import type { DefeatStyle, EnemyId, NoteFigure } from '@boia/engine/survivors';
import type { QualityTier } from '@boia/engine/streaming';
import {
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  type Material,
  MeshBasicMaterial,
  type MeshLambertMaterial,
  Object3D,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  BoxGeometry,
} from 'three';
import { litMaterial } from './characters';
import { Kit } from './kit';
import { C } from './palette';

/**
 * Las piezas de la beta del Cañón en el mar 3D (plan 010, T117), hechas en
 * código como las de Los Rápidos (`race-props.ts`: `Kit` y la paleta `C`):
 * la piraña, el cangrejo acorazado, la bola del cañón de agua y las notas
 * por figura (corchea, negra, blanca, redonda) flotando en el agua. Y lo que
 * pasa al derrotar un enemigo, en los dos estilos que se comparan en la beta
 * (`defeatStyle` de la config): `puf` (una nubecilla que estalla, todas en
 * una sola pieza instanciada) y `sumergirse` (el enemigo salta y se hunde con
 * un chapoteo, sin heridas: REQ-AVE-037). Con movimiento reducido, un efecto
 * mínimo sin saltos ni partículas, el barco no parpadea y la cámara no tiembla.
 *
 * Todo en unidades de escena; cada modelo mira a +x (rumbo 0 del motor), con
 * el agua en y = 0. Nada se crea por fotograma: las piezas viven en
 * `InstancedMesh` del tamaño del tope de la calidad y en piscinas fijas.
 */

// --- Colores ------------------------------------------------------------------

/** Colores de los enemigos: rojo la piraña, naranja con coraza de hierro el cangrejo. */
export const ENEMY_COLORS = {
  piranha: { body: C.red, back: C.navy, belly: C.yellow, teeth: C.white },
  crab: { shell: C.orange, armour: C.rockLight, rivet: C.iron, claw: C.orangeDeep },
} as const;

/** El color de cada figura de nota (de menos a más valor); el aro del agua, blanco. */
export const NOTE_COLORS: Readonly<Record<NoteFigure, string>> = {
  corchea: C.yellow,
  negra: '#7ee05a',
  blanca: '#ff8fd0',
  redonda: '#b0f0ff',
};
const NOTE_FOAM = C.white;
const BALL_COLOR = '#bfe9ff';
const EYE = '#1a1020';

// --- Modelos ---------------------------------------------------------------------

/**
 * La piraña: cuerpo rojo alto y corto, lomo azul marino con aleta, vientre
 * amarillo, boca abierta con dientes blancos y cola en V. Largo ~2.4, va
 * medio fuera del agua. Radio 1 ≈ su radio de choque.
 */
export function piranhaGeometry(): BufferGeometry {
  const c = ENEMY_COLORS.piranha;
  const k = new Kit();
  k.add(new SphereGeometry(0.8, 8, 6), c.body, { p: [0, 0.25, 0], s: [1.25, 0.95, 0.62] });
  k.add(new SphereGeometry(0.6, 7, 5), c.belly, { p: [0.15, 0.02, 0], s: [1.2, 0.6, 0.55] });
  // Lomo y aleta.
  k.add(new SphereGeometry(0.62, 7, 4), c.back, { p: [-0.1, 0.55, 0], s: [1.2, 0.5, 0.5] });
  k.add(new ConeGeometry(0.35, 0.7, 4), c.back, { p: [-0.25, 1.05, 0], s: [1.2, 1, 0.35] });
  // Cola en V.
  for (const s of [-1, 1]) {
    k.add(new ConeGeometry(0.28, 0.8, 4), c.back, {
      p: [-1.2, 0.3 + s * 0.28, 0],
      r: [0, 0, Math.PI / 2 + s * 0.55],
      s: [1, 1, 0.4],
    });
  }
  // Boca: mandíbula y dientes.
  k.add(new BoxGeometry(0.5, 0.14, 0.62), c.body, { p: [0.9, -0.05, 0] });
  for (let i = 0; i < 3; i++) {
    for (const s of [-1, 1]) {
      k.add(new ConeGeometry(0.07, 0.2, 3), c.teeth, { p: [0.78 + i * 0.13, 0.1, s * 0.22] });
    }
  }
  // Ojos grandes (que se vea de lejos hacia dónde va).
  for (const s of [-1, 1]) {
    k.add(new SphereGeometry(0.17, 6, 5), C.white, { p: [0.62, 0.48, s * 0.4] });
    k.add(new SphereGeometry(0.09, 5, 4), EYE, { p: [0.7, 0.5, s * 0.47] });
  }
  return k.build();
}

/**
 * El cangrejo acorazado: caparazón naranja ancho y bajo con una coraza de
 * hierro remachada encima, dos pinzas grandes delante, patas y ojos en
 * palitos. Ancho ~2.6. Radio 1 ≈ su radio de choque.
 */
export function crabGeometry(): BufferGeometry {
  const c = ENEMY_COLORS.crab;
  const k = new Kit();
  k.add(new CylinderGeometry(0.95, 1.05, 0.45, 8), c.shell, { p: [0, 0.2, 0], s: [0.85, 1, 1.1] });
  // La coraza: una cúpula de hierro con remaches.
  k.add(new SphereGeometry(0.85, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), c.armour, {
    p: [0, 0.4, 0],
    s: [0.85, 0.55, 1.05],
  });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.add(new SphereGeometry(0.09, 4, 3), c.rivet, {
      p: [Math.cos(a) * 0.55, 0.62, Math.sin(a) * 0.7],
    });
  }
  k.add(new BoxGeometry(0.16, 0.12, 1.3), c.rivet, { p: [0, 0.82, 0] });
  for (const s of [-1, 1]) {
    // Pinzas: brazo, mano y dos dedos.
    k.add(new BoxGeometry(0.6, 0.18, 0.2), c.shell, {
      p: [0.75, 0.25, s * 0.75],
      r: [0, s * 0.5, 0],
    });
    k.add(new SphereGeometry(0.36, 6, 5), c.claw, { p: [1.15, 0.3, s * 1.0], s: [1.2, 0.8, 0.9] });
    k.add(new ConeGeometry(0.14, 0.55, 4), c.claw, {
      p: [1.55, 0.42, s * 0.92],
      r: [0, 0, -Math.PI / 2 + 0.25],
    });
    k.add(new ConeGeometry(0.12, 0.45, 4), c.shell, {
      p: [1.5, 0.18, s * 1.05],
      r: [0, 0, -Math.PI / 2 - 0.25],
    });
    // Patas.
    for (let i = 0; i < 3; i++) {
      k.add(new BoxGeometry(0.12, 0.1, 0.7), c.claw, {
        p: [0.25 - i * 0.35, 0.05, s * 1.15],
        r: [s * 0.35, 0, 0],
      });
    }
    // Ojos en palitos.
    k.add(new CylinderGeometry(0.05, 0.05, 0.4, 4), c.shell, { p: [0.6, 0.65, s * 0.25] });
    k.add(new SphereGeometry(0.12, 5, 4), C.white, { p: [0.62, 0.88, s * 0.25] });
    k.add(new SphereGeometry(0.07, 4, 3), EYE, { p: [0.7, 0.9, s * 0.25] });
  }
  return k.build();
}

/** Un enemigo sin modelo propio todavía (las betas siguientes): una boya oscura con ojos. */
export function genericEnemyGeometry(): BufferGeometry {
  const k = new Kit();
  k.add(new SphereGeometry(0.9, 7, 5), C.speaker, { p: [0, 0.3, 0], s: [1.2, 0.8, 0.9] });
  for (const s of [-1, 1]) {
    k.add(new SphereGeometry(0.16, 5, 4), C.white, { p: [0.75, 0.55, s * 0.35] });
  }
  return k.build();
}

/** La bola del cañón de agua: una gota azul clara con brillo y una estela corta. Radio 1. */
export function cannonBallGeometry(): BufferGeometry {
  const k = new Kit();
  k.add(new IcosahedronGeometry(1, 1), BALL_COLOR);
  k.add(new IcosahedronGeometry(0.35, 0), C.white, { p: [0.35, 0.5, 0.3] });
  k.add(new ConeGeometry(0.7, 1.4, 6), '#8fd6ff', { p: [-1.1, 0, 0], r: [0, 0, Math.PI / 2] });
  return k.build();
}

/** Cabeza rellena (negra y corchea): un óvalo inclinado, de cara a +z. */
function filledHead(): BufferGeometry {
  const g = new CylinderGeometry(0.4, 0.4, 0.24, 10);
  g.rotateX(Math.PI / 2);
  g.scale(1.3, 1, 1);
  g.rotateZ(0.35);
  return g;
}

/** Cabeza hueca (blanca y redonda): un aro ovalado inclinado, de cara a +z. */
function hollowHead(r = 0.36, tube = 0.12): BufferGeometry {
  const g = new TorusGeometry(r, tube, 6, 14);
  g.scale(1.3, 1, 1);
  g.rotateZ(0.35);
  return g;
}

/** Inclinación de las notas hacia atrás: miran a la cámara, que va detrás y arriba. */
export const NOTE_TILT = 0.5;

/**
 * Una nota musical por figura, de pie sobre el agua: la figura (de cara a
 * +z, recostada hacia la cámara) en su color y un aro de espuma blanco en
 * el agua debajo. Alto ~2 (la redonda, ~1.2), el agua en y = 0.
 */
export function noteGeometry(figure: NoteFigure): BufferGeometry {
  const color = NOTE_COLORS[figure];
  const glyph = new Kit();
  const stem = figure !== 'redonda';
  if (figure === 'redonda') glyph.add(hollowHead(0.46, 0.17), color);
  else if (figure === 'blanca') glyph.add(hollowHead(), color);
  else glyph.add(filledHead(), color);
  if (stem) glyph.add(new BoxGeometry(0.17, 1.55, 0.18), color, { p: [0.48, 0.78, 0] });
  if (figure === 'corchea') {
    // El corchete: dos tramos que bajan desde lo alto de la plica.
    glyph.add(new BoxGeometry(0.13, 0.55, 0.14), color, { p: [0.68, 1.33, 0], r: [0, 0, 0.75] });
    glyph.add(new BoxGeometry(0.13, 0.45, 0.14), color, { p: [0.82, 0.98, 0], r: [0, 0, -0.2] });
  }
  const g = glyph.build();
  g.rotateX(-NOTE_TILT);
  g.translate(0, 0.5, 0);
  const k = new Kit();
  k.addPainted(g);
  g.dispose();
  k.add(new TorusGeometry(0.62, 0.07, 4, 16), NOTE_FOAM, {
    p: [0, 0.04, 0],
    r: [Math.PI / 2, 0, 0],
  });
  return k.build();
}

// --- Cómo se ven por tipo ---------------------------------------------------------

export interface EnemyModel {
  build: () => BufferGeometry;
  /** Tamaño de la pieza sobre su radio de choque (más grande que el choque: se lee de lejos). */
  scale: number;
  /** Cuánto se mece arriba y abajo (escena). */
  bob: number;
}

/** El modelo de cada enemigo de la beta; los que llegan después usan `genericEnemyGeometry`. */
export const ENEMY_MODELS: Readonly<Partial<Record<EnemyId, EnemyModel>>> = {
  piranha: { build: piranhaGeometry, scale: 1.6, bob: 0.08 },
  crab: { build: crabGeometry, scale: 1.2, bob: 0.03 },
};
const GENERIC_MODEL: EnemyModel = { build: genericEnemyGeometry, scale: 1.2, bob: 0.05 };

export function enemyModel(id: EnemyId): EnemyModel {
  return ENEMY_MODELS[id] ?? GENERIC_MODEL;
}

/** Tamaño (escena) de cada figura de nota: más valor, algo más grande. */
export const NOTE_SIZE: Readonly<Record<NoteFigure, number>> = {
  corchea: 0.7,
  negra: 0.78,
  blanca: 0.88,
  redonda: 0.98,
};

/** Tamaño de la bola sobre su radio de choque, y su mínimo (escena). */
export const BALL_SCALE = 1.3;
export const BALL_MIN = 0.25;

/** Material de las piezas: barro pintado (color por vértice, caras planas). */
export function propsMaterial(): MeshLambertMaterial {
  return litMaterial();
}

/** La bola brilla un poco: se ve volar aunque sea pequeña. */
export function ballMaterial(): MeshLambertMaterial {
  const m = litMaterial();
  m.emissive = new Color(BALL_COLOR);
  m.emissiveIntensity = 0.35;
  return m;
}

/** Una `InstancedMesh` vacía de `cap` piezas. */
export function instanced(
  geometry: BufferGeometry,
  material: Material,
  cap: number,
  name: string,
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, Math.max(1, cap));
  mesh.count = 0;
  mesh.name = name;
  return mesh;
}

// --- Derrota ------------------------------------------------------------------------

/**
 * Cómo es el efecto de derrota según el estilo, la calidad y el movimiento
 * reducido: `baja` tiene menos piezas a la vez; con movimiento reducido,
 * `puf` es una sola nubecilla que se apaga en su sitio y `sumergirse` un
 * hundimiento corto sin salto ni chapoteo.
 */
export interface DefeatPlan {
  /** s que dura. */
  lifeS: number;
  /** Cuántos efectos caben a la vez (después, el más viejo se reusa). */
  pool: number;
  /** `puf`: partículas por derrota. */
  parts: number;
  /** `puf`: hasta dónde vuelan (veces el tamaño); 0 = en su sitio. */
  spread: number;
  /** `sumergirse`: salta antes de hundirse. */
  hop: boolean;
  /** `sumergirse`: aro de espuma al entrar en el agua. */
  splash: boolean;
  /** Efecto mínimo de movimiento reducido. */
  reduced: boolean;
}

const POOL: Readonly<Record<QualityTier, number>> = { alta: 24, baja: 10 };
const PUF_PARTS: Readonly<Record<QualityTier, number>> = { alta: 7, baja: 4 };

function plans(q: QualityTier): Record<DefeatStyle, Record<'on' | 'reduced', DefeatPlan>> {
  return {
    puf: {
      on: {
        lifeS: 0.45,
        pool: POOL[q],
        parts: PUF_PARTS[q],
        spread: 1.5,
        hop: false,
        splash: false,
        reduced: false,
      },
      reduced: {
        lifeS: 0.3,
        pool: POOL[q],
        parts: 1,
        spread: 0,
        hop: false,
        splash: false,
        reduced: true,
      },
    },
    sumergirse: {
      on: {
        lifeS: 0.85,
        pool: POOL[q],
        parts: 0,
        spread: 0,
        hop: true,
        splash: true,
        reduced: false,
      },
      reduced: {
        lifeS: 0.45,
        pool: POOL[q],
        parts: 0,
        spread: 0,
        hop: false,
        splash: false,
        reduced: true,
      },
    },
  };
}
const PLANS: Readonly<Record<QualityTier, ReturnType<typeof plans>>> = {
  alta: plans('alta'),
  baja: plans('baja'),
};

/** El plan del efecto de derrota (sin crear nada: devuelve uno de una tabla fija). */
export function defeatPlan(
  style: DefeatStyle,
  opts: { quality: QualityTier; reduced: boolean },
): DefeatPlan {
  return PLANS[opts.quality][style][opts.reduced ? 'reduced' : 'on'];
}

/** Cuántas partículas de `puf` caben en su pieza instanciada (la piscina por las de la calidad). */
export function pufCapacity(quality: QualityTier): number {
  return POOL[quality] * PUF_PARTS[quality];
}

// --- Golpe en el barco ----------------------------------------------------------------

/** Parpadeos por segundo del barco golpeado (~4 en el medio segundo de invulnerabilidad). */
export const BLINK_HZ = 8;

/**
 * ¿Se ve el barco ahora? Parpadea mientras es invulnerable tras un golpe,
 * sólo jugando (en pausa o con la carta abierta se ve siempre) y nunca con
 * movimiento reducido. Lo marca el tiempo de invulnerabilidad que queda.
 */
export function boatVisible(s: {
  invulnerableS: number;
  running: boolean;
  reduced: boolean;
}): boolean {
  if (s.reduced || !s.running || !(s.invulnerableS > 0)) return true;
  return Math.floor(s.invulnerableS * BLINK_HZ * 2) % 2 === 0;
}

/** Cuánto tiembla la cámara con un golpe (0 con movimiento reducido). */
export function hitShake(reduced: boolean): number {
  return reduced ? 0 : 0.28;
}

// --- Efectos (piscinas fijas) ------------------------------------------------------------

const PUF_COLORS = [C.white, C.yellow, C.cream, C.orange];

/** Una derrota en curso: dónde, cuándo y de quién (para `sumergirse`). */
interface Slot {
  on: boolean;
  type: number;
  x: number;
  z: number;
  heading: number;
  size: number;
  start: number;
}

function slots(n: number): Slot[] {
  const out: Slot[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ on: false, type: 0, x: 0, z: 0, heading: 0, size: 1, start: 0 });
  }
  return out;
}

const easeOut = (k: number) => 1 - (1 - k) * (1 - k);

/**
 * `puf`: una nubecilla que estalla donde cayó el enemigo. Todas las
 * partículas de todas las derrotas van en una sola `InstancedMesh`.
 */
export class PufFx {
  readonly mesh: InstancedMesh;
  private readonly pool: Slot[];
  private next = 0;
  private readonly o = new Object3D();

  constructor(quality: QualityTier) {
    const cap = pufCapacity(quality);
    this.mesh = instanced(
      new IcosahedronGeometry(1, 0),
      new MeshBasicMaterial({ color: '#ffffff' }),
      cap,
      'survivors-puf',
    );
    const c = new Color();
    for (let i = 0; i < cap; i++) {
      this.mesh.setColorAt(i, c.set(PUF_COLORS[i % PUF_COLORS.length]!));
    }
    this.pool = slots(POOL[quality]);
  }

  spawn(x: number, z: number, size: number, now: number): void {
    const s = this.pool[this.next]!;
    this.next = (this.next + 1) % this.pool.length;
    s.on = true;
    s.x = x;
    s.z = z;
    s.size = size;
    s.start = now;
  }

  get active(): number {
    let n = 0;
    for (const s of this.pool) if (s.on) n++;
    return n;
  }

  update(now: number, plan: DefeatPlan): void {
    const o = this.o;
    const cap = this.mesh.instanceMatrix.count;
    let w = 0;
    for (let i = 0; i < this.pool.length; i++) {
      const s = this.pool[i]!;
      if (!s.on) continue;
      const k = (now - s.start) / plan.lifeS;
      if (k >= 1 || k < 0) {
        s.on = false;
        continue;
      }
      const parts = Math.max(1, plan.parts);
      for (let p = 0; p < parts && w < cap; p++) {
        const a = (p / parts) * Math.PI * 2 + i * 0.7;
        const r = plan.spread * s.size * easeOut(k);
        // Un golpe: crece rápido y se apaga.
        const grow = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
        const big = p === 0 && plan.parts > 1 ? 0.55 : 0.32;
        o.position.set(
          s.x + Math.cos(a) * r,
          0.4 + easeOut(k) * s.size * 0.8,
          s.z + Math.sin(a) * r,
        );
        o.rotation.set(k * 3 + p, k * 2, 0);
        o.scale.setScalar(Math.max(0.001, s.size * big * (plan.reduced ? 1 - k : grow)));
        o.updateMatrix();
        this.mesh.setMatrixAt(w++, o.matrix);
      }
    }
    this.mesh.count = w;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    for (const s of this.pool) s.on = false;
    this.mesh.count = 0;
  }
}

/**
 * `sumergirse`: el enemigo da un saltito y se hunde (o, con movimiento
 * reducido, sólo se hunde), con un aro de espuma al entrar. Cada tipo tiene
 * su `InstancedMesh` de hundidos con la misma geometría y material que los
 * vivos (no cuentan en el tope de enemigos); los aros, una sola.
 */
export class SinkFx {
  readonly meshes: InstancedMesh[];
  readonly rings: InstancedMesh;
  private readonly pool: Slot[];
  private next = 0;
  private readonly o = new Object3D();
  private readonly counts: number[];

  constructor(
    quality: QualityTier,
    kinds: readonly { geometry: BufferGeometry; material: Material; name: string }[],
  ) {
    const n = POOL[quality];
    this.meshes = kinds.map((k) => instanced(k.geometry, k.material, n, `${k.name}-sink`));
    const ring = new RingGeometry(0.75, 1, 18);
    ring.rotateX(-Math.PI / 2);
    this.rings = instanced(
      ring,
      new MeshBasicMaterial({
        color: C.white,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        side: DoubleSide,
      }),
      n,
      'survivors-splash',
    );
    this.pool = slots(n);
    this.counts = kinds.map(() => 0);
  }

  spawn(type: number, x: number, z: number, heading: number, size: number, now: number): void {
    const s = this.pool[this.next]!;
    this.next = (this.next + 1) % this.pool.length;
    s.on = true;
    s.type = type;
    s.x = x;
    s.z = z;
    s.heading = heading;
    s.size = size;
    s.start = now;
  }

  get active(): number {
    let n = 0;
    for (const s of this.pool) if (s.on) n++;
    return n;
  }

  update(now: number, plan: DefeatPlan): void {
    const o = this.o;
    const counts = this.counts;
    for (let i = 0; i < counts.length; i++) counts[i] = 0;
    let rings = 0;
    const hopEnd = plan.hop ? 0.4 : 0;
    for (const s of this.pool) {
      if (!s.on) continue;
      const k = (now - s.start) / plan.lifeS;
      const mesh = this.meshes[s.type];
      if (k >= 1 || k < 0 || !mesh) {
        s.on = false;
        continue;
      }
      let y: number;
      let pitch: number;
      if (k < hopEnd) {
        // Saltito con la nariz hacia arriba.
        const h = k / hopEnd;
        y = Math.sin(h * Math.PI) * s.size * 0.9;
        pitch = 0.6 * (1 - h) - 0.9 * h;
      } else {
        // Se hunde de cabeza.
        const d = (k - hopEnd) / (1 - hopEnd);
        y = -d * s.size * 1.8;
        pitch = plan.hop ? -0.9 : -0.3 * d;
      }
      o.position.set(s.x, y, s.z);
      o.rotation.set(0, -s.heading, pitch);
      o.scale.setScalar(Math.max(0.001, s.size * (1 - Math.max(0, k - 0.6) / 0.4)));
      o.updateMatrix();
      mesh.setMatrixAt(counts[s.type]!++, o.matrix);
      if (plan.splash && k >= hopEnd) {
        const r = (k - hopEnd) / (1 - hopEnd);
        o.position.set(s.x, 0.06, s.z);
        o.rotation.set(0, 0, 0);
        o.scale.setScalar(
          Math.max(0.001, s.size * (0.6 + r * 1.4) * (r < 0.7 ? 1 : (1 - r) / 0.3)),
        );
        o.updateMatrix();
        this.rings.setMatrixAt(rings++, o.matrix);
      }
    }
    for (let i = 0; i < this.meshes.length; i++) {
      const m = this.meshes[i]!;
      m.count = counts[i]!;
      m.instanceMatrix.needsUpdate = true;
    }
    this.rings.count = rings;
    this.rings.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    for (const s of this.pool) s.on = false;
    for (const m of this.meshes) m.count = 0;
    this.rings.count = 0;
  }
}
