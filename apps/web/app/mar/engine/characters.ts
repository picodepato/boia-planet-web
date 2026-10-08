import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  IcosahedronGeometry,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Quaternion,
  SRGBColorSpace,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { Kit, paint } from './kit';
import { C } from './palette';

/**
 * Lo que se mueve en el mar 3D: el barco, la mascota de BOIA (capitana del
 * barco y boia de la entrada), la Boia Fiestera, cocodrilos, delfín y
 * medusas. El frente de cada modelo mira a +x (rumbo 0 del motor).
 */

/** Barro pintado: color por vértice y caras planas. Doble cara: las piezas hechas a mano no
 * siempre traen el orden de vértices bien, y con caras planas la luz sale igual. */
export const litMaterial = () =>
  new MeshLambertMaterial({ vertexColors: true, flatShading: true, side: DoubleSide });

// --- Casco ----------------------------------------------------------------

interface Section {
  x: number;
  hw: number;
  top: number;
  bot: number;
}

/** Casco low-poly por secciones: franja naranja, franja crema y fondo azul marino. */
function hullGeometry(): BufferGeometry {
  const S: Section[] = [
    { x: -1.42, hw: 0.5, top: 0.44, bot: 0.02 },
    { x: -0.85, hw: 0.64, top: 0.42, bot: -0.24 },
    { x: 0.15, hw: 0.64, top: 0.44, bot: -0.3 },
    { x: 0.95, hw: 0.44, top: 0.52, bot: -0.2 },
    { x: 1.58, hw: 0.02, top: 0.68, bot: 0.12 },
  ];
  // Anillo de cada sección: arriba izq., medio izq., abajo izq., quilla, abajo der., medio der., arriba der.
  const ring = (s: Section): [number, number, number][] => {
    const mid = s.top - (s.top - s.bot) * 0.42;
    return [
      [s.x, s.top, -s.hw],
      [s.x, mid, -s.hw * 0.96],
      [s.x, s.bot, -s.hw * 0.6],
      [s.x, s.bot - 0.1, 0],
      [s.x, s.bot, s.hw * 0.6],
      [s.x, mid, s.hw * 0.96],
      [s.x, s.top, s.hw],
    ];
  };
  const bands = [C.orange, C.cream, C.navy, C.navy, C.cream, C.orange];
  const pos: number[] = [];
  const col: number[] = [];
  const color = (hex: string) => {
    const c = parseInt(hex.slice(1), 16);
    return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255] as const;
  };
  const tri = (a: number[], b: number[], c: number[], hex: string, cx: number) => {
    // Normal hacia fuera del eje del casco.
    const ux = b[0]! - a[0]!;
    const uy = b[1]! - a[1]!;
    const uz = b[2]! - a[2]!;
    const vx = c[0]! - a[0]!;
    const vy = c[1]! - a[1]!;
    const vz = c[2]! - a[2]!;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const mx = (a[0]! + b[0]! + c[0]!) / 3 - cx;
    const my = (a[1]! + b[1]! + c[1]!) / 3 - 0.15;
    const mz = (a[2]! + b[2]! + c[2]!) / 3;
    const flip = nx * mx + ny * my + nz * mz < 0;
    const [p, q] = flip ? [c, b] : [b, c];
    pos.push(...a, ...p, ...q);
    const k = color(hex);
    col.push(...k, ...k, ...k);
  };
  for (let i = 0; i < S.length - 1; i++) {
    const A = ring(S[i]!);
    const B = ring(S[i + 1]!);
    const cx = (S[i]!.x + S[i + 1]!.x) / 2;
    for (let j = 0; j < A.length - 1; j++) {
      tri(A[j]!, B[j]!, B[j + 1]!, bands[j]!, cx);
      tri(A[j]!, B[j + 1]!, A[j + 1]!, bands[j]!, cx);
    }
  }
  // Espejo de popa.
  const st = ring(S[0]!);
  for (let j = 1; j < st.length - 1; j++) tri(st[0]!, st[j]!, st[j + 1]!, C.orangeDeep, 0);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.computeVertexNormals();
  return g;
}

/** Vela triangular a franjas naranja y crema. */
function sailGeometry(): BufferGeometry {
  const kit = new Kit();
  const bands = 4;
  const h = 2.1;
  const base = 1.25;
  for (let i = 0; i < bands; i++) {
    const y0 = (i / bands) * h;
    const y1 = ((i + 1) / bands) * h;
    const w0 = base * (1 - y0 / h);
    const w1 = base * (1 - y1 / h);
    const g = new BufferGeometry();
    // Trapecio en el plano XY (la vela va a lo largo del barco).
    const v = [0, y0, 0, -w0, y0, 0, -w1, y1, 0, 0, y0, 0, -w1, y1, 0, 0, y1, 0];
    g.setAttribute('position', new BufferAttribute(new Float32Array(v), 3));
    g.computeVertexNormals();
    kit.add(g, i % 2 ? C.cream : C.orange);
  }
  return kit.build();
}

export interface Boat {
  group: Group;
  /** El casco y lo que va encima: se inclina con el oleaje y los giros. */
  body: Group;
  /** Sólo en el barco provisional (hasta que llega el del 2D). */
  sail: Mesh | null;
  captain: Group | null;
  /** Hueco de la tripulante (la Fiestera a bordo). */
  crewSlot: Group;
}

export function createBoat(faceTextures: FaceTextures): Boat {
  const group = new Group();
  const body = new Group();
  group.add(body);
  const mat = litMaterial();
  const hull = new Mesh(hullGeometry(), mat);
  body.add(hull);

  const deck = new Kit();
  deck.add(new BoxGeometry(2.3, 0.06, 1.0), C.wood, { p: [-0.15, 0.4, 0] });
  deck.add(new BoxGeometry(0.9, 0.06, 0.6), C.wood, { p: [1.0, 0.46, 0], s: [1, 1, 0.9] });
  // Borda crema.
  deck.add(new BoxGeometry(2.6, 0.08, 0.07), C.cream, { p: [-0.1, 0.47, -0.6] });
  deck.add(new BoxGeometry(2.6, 0.08, 0.07), C.cream, { p: [-0.1, 0.47, 0.6] });
  // Mástil, botavara y banderín morado.
  deck.add(new CylinderGeometry(0.05, 0.06, 2.7, 6), C.woodDark, { p: [0.35, 1.75, 0] });
  deck.add(new CylinderGeometry(0.035, 0.035, 1.35, 5), C.woodDark, {
    p: [-0.3, 0.72, 0],
    r: [0, 0, Math.PI / 2],
  });
  deck.add(new ConeGeometry(0.16, 0.5, 3), C.purple, {
    p: [0.6, 2.96, 0],
    r: [0, 0, -Math.PI / 2],
    s: [1, 1, 0.3],
  });
  // Salvavidas en la popa.
  deck.add(new TorusGeometry(0.16, 0.06, 5, 10), C.white, {
    p: [-1.44, 0.34, 0],
    r: [0, Math.PI / 2, 0],
  });
  body.add(new Mesh(deck.build(), mat));

  const sail = new Mesh(
    sailGeometry(),
    new MeshLambertMaterial({ vertexColors: true, side: DoubleSide }),
  );
  sail.position.set(0.32, 0.72, 0);
  body.add(sail);

  const captain = createMascot(faceTextures.orange, { cap: 'beanie', scale: 0.34 });
  captain.position.set(-0.85, 0.66, 0);
  body.add(captain);

  const crewSlot = new Group();
  crewSlot.position.set(0.95, 0.72, 0);
  body.add(crewSlot);

  return { group, body, sail, captain, crewSlot };
}

// --- Mascota --------------------------------------------------------------

/**
 * La mascota de BOIA a mano (T220: rehecha sobre el logo, `art/marca/boia-mascota.jpg`):
 * bola naranja con el trazo negro del logo, gorro azul marino en punta ladeado
 * a la izquierda con su agujero cerca de la punta, ojos grandes y altos y la
 * sonrisa ancha con dientes. Es la capitana del barco, la boia mientras llega
 * su modelo de Blender y la Boia Fiestera (con pompón y coloretes).
 */

/** Colores del logo (los mismos papeles que `tools/blender/mascota.py`). */
export const MASCOT_COLORS = {
  body: C.orange,
  cap: C.purple,
  ink: '#16101f',
  pompom: C.white,
} as const;

export interface FaceTextures {
  /** La cara del logo. */
  orange: CanvasTexture;
  /** La de la Boia Fiestera: la misma con coloretes. */
  party: CanvasTexture;
}

/** La cara de la mascota de BOIA, pintada en canvas como en el logo. */
function faceTexture(body: string, blush: string | null): CanvasTexture {
  const W = 512;
  const H = 256;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  g.fillStyle = body;
  g.fillRect(0, 0, W, H);
  // La cara va centrada en u = 0,25 (mira a +z en la esfera; el modelo gira).
  // En la textura, +x es la derecha de la cara vista de frente y +y, abajo.
  const cx = W * 0.25;
  const cy = H * 0.44;
  const ink = MASCOT_COLORS.ink;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = ink;
  // Ojos del logo: óvalos altos, el derecho más grande y más alto, los dos
  // algo a la derecha; pupila abajo a la izquierda con su brillo.
  const eye = (x: number, y: number, rx: number, ry: number, tilt: number) => {
    g.lineWidth = 6;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(x, y, rx, ry, tilt, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = ink;
    g.beginPath();
    g.ellipse(x - rx * 0.32, y + ry * 0.18, rx * 0.5, ry * 0.42, tilt, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(x - rx * 0.42, y + ry * 0.1, rx * 0.16, ry * 0.15, 0, 0, Math.PI * 2);
    g.fill();
  };
  eye(cx - 20, cy - 20, 17, 27, -0.12);
  eye(cx + 22, cy - 32, 19, 30, -0.18);
  // Cejas: dos arcos sobre los ojos.
  g.lineWidth = 5;
  const brow = (x: number, y: number, w: number) => {
    g.beginPath();
    g.moveTo(x - w, y + 4);
    g.quadraticCurveTo(x, y - 6, x + w, y);
    g.stroke();
  };
  brow(cx - 26, cy - 58, 13);
  brow(cx + 24, cy - 74, 15);
  // Sonrisa ancha con dientes: el labio de arriba sube hacia la mejilla derecha.
  g.lineWidth = 6;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(cx - 34, cy + 16);
  g.quadraticCurveTo(cx + 8, cy + 26, cx + 52, cy - 4);
  g.quadraticCurveTo(cx + 40, cy + 48, cx + 4, cy + 54);
  g.quadraticCurveTo(cx - 28, cy + 50, cx - 34, cy + 16);
  g.fill();
  g.stroke();
  // Pliegues de las comisuras.
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(cx + 50, cy - 16);
  g.quadraticCurveTo(cx + 62, cy - 12, cx + 62, cy + 2);
  g.moveTo(cx - 40, cy + 4);
  g.quadraticCurveTo(cx - 48, cy + 14, cx - 42, cy + 28);
  g.stroke();
  if (blush) {
    g.fillStyle = blush;
    g.globalAlpha = 0.45;
    g.beginPath();
    g.ellipse(cx - 56, cy + 2, 11, 7, 0, 0, Math.PI * 2);
    g.ellipse(cx + 72, cy - 10, 11, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 2;
  return t;
}

export function createFaceTextures(): FaceTextures {
  return {
    orange: faceTexture(MASCOT_COLORS.body, null),
    party: faceTexture(MASCOT_COLORS.body, C.pink),
  };
}

/** Grosor del trazo negro del logo, en fracción del radio de la bola. */
export const MASCOT_OUTLINE = 0.07;

/** Material del trazo: casco invertido (sólo las caras de dentro), negro plano. */
const inkMaterial = () =>
  new MeshBasicMaterial({ color: MASCOT_COLORS.ink, side: BackSide });

const UP = new Vector3(0, 1, 0);

/** Orientación (Euler) que lleva el +y de una pieza a la dirección `d`. */
function towards(d: Vector3): [number, number, number] {
  const e = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(UP, d.clone().normalize()));
  return [e.x, e.y, e.z];
}

/**
 * La mascota: bola con cara, gorro azul marino en punta (o el de fiesta, con
 * pompón) y franja de boia, con el contorno negro del logo.
 * Mira a +x; el origen está en su base. +z es su izquierda vista de frente:
 * hacia ahí se ladea el gorro, como en el logo.
 */
export function createMascot(
  face: CanvasTexture,
  opts: { cap: 'beanie' | 'party'; band?: string; scale?: number },
): Group {
  const g = new Group();
  const r = 1;
  const sphereGeo = new SphereGeometry(r, 20, 14);
  const sphere = new Mesh(sphereGeo, new MeshLambertMaterial({ map: face }));
  // La cara (u = 0,25) mira a +z; se gira para que mire a +x.
  sphere.rotation.y = Math.PI / 2;
  sphere.position.y = r;
  sphere.scale.set(1, 0.94, 1);
  g.add(sphere);
  const ink = inkMaterial();
  const rim = new Mesh(sphereGeo, ink);
  rim.position.y = r;
  rim.scale.set(1 + MASCOT_OUTLINE, 0.94 + MASCOT_OUTLINE, 1 + MASCOT_OUTLINE);
  g.add(rim);

  const kit = new Kit();
  const rimKit = new Kit();
  if (opts.band) {
    // La franja va baja, a ras de agua: no tapa la sonrisa.
    kit.add(new CylinderGeometry(r * 0.86, r * 0.6, r * 0.26, 16, 1, true), opts.band, {
      p: [0, r * 0.32, 0],
    });
  }
  // El gorro: un cono ancho asentado arriba a la izquierda de la cabeza, con
  // la punta hacia arriba y afuera (el de fiesta, más estrecho y derecho).
  const party = opts.cap === 'party';
  const dir = party ? new Vector3(-0.08, 0.92, 0.38).normalize() : new Vector3(-0.1, 0.72, 0.68).normalize();
  const capR = r * (party ? 0.42 : 0.62);
  const capH = r * (party ? 1.05 : 1.1);
  const base = new Vector3(0, r, 0).addScaledVector(dir, r * (party ? 0.86 : 0.74));
  const mid = base.clone().addScaledVector(dir, capH / 2);
  const rot = towards(dir);
  kit.add(new ConeGeometry(capR, capH, 16), MASCOT_COLORS.cap, { p: [mid.x, mid.y, mid.z], r: rot });
  rimKit.add(new ConeGeometry(capR + r * MASCOT_OUTLINE, capH + r * MASCOT_OUTLINE * 2.4, 16), MASCOT_COLORS.ink, {
    p: [mid.x, mid.y, mid.z],
    r: rot,
  });
  const tip = base.clone().addScaledVector(dir, capH);
  if (party) {
    kit.add(new SphereGeometry(r * 0.17, 8, 6), MASCOT_COLORS.pompom, { p: [tip.x, tip.y, tip.z] });
  } else {
    // El agujero del gorro, cerca de la punta, en la cara que mira al frente.
    const t = 0.62;
    const out = new Vector3(1, 0, 0).addScaledVector(dir, -dir.x).normalize();
    const hole = base.clone().addScaledVector(dir, capH * t).addScaledVector(out, capR * (1 - t) * 0.98);
    kit.add(new SphereGeometry(r * 0.075, 8, 6), MASCOT_COLORS.ink, {
      p: [hole.x, hole.y, hole.z],
      s: [0.5, 1.2, 1],
    });
  }
  if (!kit.empty) g.add(new Mesh(kit.build(), litMaterial()));
  if (!rimKit.empty) g.add(new Mesh(rimKit.build(), ink));
  g.scale.setScalar(opts.scale ?? 1);
  return g;
}

// --- Fauna ----------------------------------------------------------------

export function createCroc(): Group {
  const g = new Group();
  const k = new Kit();
  k.add(new BoxGeometry(1.5, 0.34, 0.62), C.croc, { p: [0, 0.05, 0] });
  k.add(new BoxGeometry(0.9, 0.2, 0.44), C.croc, { p: [1.05, 0.02, 0] });
  k.add(new BoxGeometry(0.75, 0.1, 0.4), C.crocBelly, { p: [1.08, -0.1, 0] });
  k.add(new ConeGeometry(0.3, 1.2, 4), C.crocDark, {
    p: [-1.25, 0.02, 0],
    r: [0, 0, Math.PI / 2],
    s: [1, 1, 0.6],
  });
  for (let i = 0; i < 5; i++) {
    k.add(new ConeGeometry(0.08, 0.18, 4), C.crocDark, { p: [-0.55 + i * 0.28, 0.28, 0] });
  }
  for (const s of [-1, 1]) {
    k.add(new SphereGeometry(0.11, 6, 5), C.white, { p: [0.72, 0.24, s * 0.16] });
    k.add(new SphereGeometry(0.055, 5, 4), '#1a1020', { p: [0.8, 0.26, s * 0.17] });
    k.add(new BoxGeometry(0.22, 0.1, 0.12), C.crocDark, { p: [0.35, -0.12, s * 0.36] });
    k.add(new BoxGeometry(0.22, 0.1, 0.12), C.crocDark, { p: [-0.4, -0.12, s * 0.36] });
  }
  // Dientes.
  for (let i = 0; i < 4; i++) {
    k.add(new ConeGeometry(0.03, 0.08, 3), C.white, {
      p: [0.8 + i * 0.16, -0.06, 0.2],
      r: [Math.PI, 0, 0],
    });
    k.add(new ConeGeometry(0.03, 0.08, 3), C.white, {
      p: [0.8 + i * 0.16, -0.06, -0.2],
      r: [Math.PI, 0, 0],
    });
  }
  g.add(new Mesh(k.build(), litMaterial()));
  return g;
}

export function createDolphin(): Group {
  const g = new Group();
  const k = new Kit();
  k.add(new IcosahedronGeometry(0.5, 1), C.dolphin, { s: [1.9, 0.62, 0.62] });
  k.add(new IcosahedronGeometry(0.45, 1), C.dolphinBelly, {
    p: [0.1, -0.1, 0],
    s: [1.8, 0.45, 0.5],
  });
  k.add(new ConeGeometry(0.16, 0.5, 4), C.dolphin, {
    p: [1.02, -0.02, 0],
    r: [0, 0, -Math.PI / 2],
    s: [1, 1, 0.8],
  });
  k.add(new ConeGeometry(0.2, 0.45, 3), C.dolphin, {
    p: [-0.1, 0.42, 0],
    r: [0, 0, 0.5],
    s: [1, 1, 0.3],
  });
  k.add(new BoxGeometry(0.28, 0.05, 0.7), C.dolphin, { p: [-1.02, 0, 0] });
  k.add(new ConeGeometry(0.12, 0.35, 3), C.dolphin, {
    p: [0.2, -0.2, 0.32],
    r: [0.9, 0, 0.3],
    s: [1, 1, 0.3],
  });
  k.add(new ConeGeometry(0.12, 0.35, 3), C.dolphin, {
    p: [0.2, -0.2, -0.32],
    r: [-0.9, 0, 0.3],
    s: [1, 1, 0.3],
  });
  k.add(new SphereGeometry(0.05, 5, 4), '#1a1020', { p: [0.7, 0.08, 0.2] });
  k.add(new SphereGeometry(0.05, 5, 4), '#1a1020', { p: [0.7, 0.08, -0.2] });
  g.add(new Mesh(k.build(), litMaterial()));
  return g;
}

export function createJelly(): Group {
  const g = new Group();
  const k = new Kit();
  const dome = new LatheGeometry(
    [0, 0.2, 0.35, 0.45, 0.48, 0.44, 0.3, 0].map((x, i) => new Vector2(x, 0.62 - i * 0.07)),
    8,
  );
  k.add(dome, '#c28ae6', { p: [0, 0, 0] });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.add(new CylinderGeometry(0.025, 0.01, 0.6, 3), '#e3b6ff', {
      p: [Math.cos(a) * 0.25, -0.05, Math.sin(a) * 0.25],
      r: [Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3],
    });
  }
  g.add(new Mesh(k.build(), litMaterial()));
  return g;
}

/** Tapa y moneda: lo recogible flota con una moneda girando encima. */
export function createCoin(): Mesh {
  const geo = paint(new CylinderGeometry(0.36, 0.36, 0.09, 12), C.gold);
  return new Mesh(geo, new MeshLambertMaterial({ vertexColors: true, emissive: '#6b4a00' }));
}

export function debrisGeometry(seed: () => number): BufferGeometry {
  const k = new Kit();
  k.add(new BoxGeometry(1.5, 0.12, 0.3), C.wood, { p: [0, 0.05, -0.2], r: [0, 0.3, 0] });
  k.add(new BoxGeometry(1.3, 0.12, 0.3), '#a86a37', { p: [0.1, 0.05, 0.2], r: [0, -0.2, 0] });
  k.add(new CylinderGeometry(0.28, 0.28, 0.7, 8), C.woodDark, {
    p: [-0.6, 0.12, 0.45],
    r: [Math.PI / 2, seed(), 0],
  });
  k.add(new BoxGeometry(0.5, 0.5, 0.5), C.wood, {
    p: [0.55, 0.2, 0.55],
    r: [0.2, seed() * 2, 0.1],
  });
  return k.build();
}

export function chestGeometry(): BufferGeometry {
  const k = new Kit();
  k.add(new BoxGeometry(1.0, 0.55, 0.7), C.woodDark, { p: [0, 0.25, 0] });
  k.add(new CylinderGeometry(0.35, 0.35, 1.0, 8, 1, false, 0, Math.PI), C.wood, {
    p: [0, 0.52, 0],
    r: [0, 0, Math.PI / 2],
  });
  k.add(new BoxGeometry(1.04, 0.1, 0.74), C.gold, { p: [0, 0.5, 0] });
  k.add(new BoxGeometry(0.12, 0.2, 0.06), C.gold, { p: [0, 0.4, 0.37] });
  k.add(new BoxGeometry(1.2, 0.08, 0.9), C.wood, { p: [0, -0.02, 0] });
  return k.build();
}
