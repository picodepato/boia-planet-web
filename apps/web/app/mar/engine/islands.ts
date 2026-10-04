import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three';
import { Kit, type Vec3, lerp, rng, seedOf, wobble } from './kit';
import { LABEL_GAP } from './labels';
import { C } from './palette';
import {
  Glows,
  type Parts,
  bush,
  crowdGeometry,
  festoon,
  flag,
  palm,
  person,
  pine,
  pier,
  rock,
  torch,
} from './props';

/**
 * Las islas del mapa compartido en 3D: cada lugar con su composición (el
 * escenario del All Day, el Puerto de Alicante, el faro…), hecha de
 * piezas low-poly. Medidas en unidades de escena, con el centro de la isla en
 * el origen y el sur (hacia el puerto) en +z.
 */

export interface IslandBuild {
  parts: Parts;
  /** Lo que se anima (luces del escenario, haz del faro, humo…). */
  animated: Object3D[];
  update?: (t: number, glow: number) => void;
  /** Altura del terreno en un punto local (para poner encima a la Fiestera). */
  heightAt: (x: number, z: number) => number;
  /** Altura a la que va su rótulo. */
  labelY: number;
  /**
   * Su orilla en el agua (bajío y espuma), en círculos locales. Sin ella, un
   * círculo del radio de la isla. El puerto (T108) deja su dársena sin bajío.
   */
  shores?: { dx: number; dz: number; r: number; w: number }[];
}

/** La orilla de una isla en el agua: la suya o un círculo de su radio (escena). */
export function islandShores(
  build: Pick<IslandBuild, 'shores'>,
  R: number,
): { dx: number; dz: number; r: number; w: number }[] {
  return build.shores ?? [{ dx: 0, dz: 0, r: R, w: Math.min(11, 3 + R * 0.7) }];
}

interface Ring {
  f: number;
  y: number;
  c: string;
}

/** El terreno de una isla: anillos con la orilla irregular y caras de barro pintado. */
export function terrain(
  k: Kit,
  R: number,
  rings: Ring[],
  rnd: () => number,
  n = 26,
): (x: number, z: number) => number {
  const noise: number[] = [];
  const p1 = rnd() * 6;
  const p2 = rnd() * 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    noise.push(1 + 0.1 * Math.sin(3 * a + p1) + 0.06 * Math.sin(5 * a + p2) + (rnd() - 0.5) * 0.05);
  }
  const pt = (ri: number, i: number): Vec3 => {
    const ring = rings[ri]!;
    const a = ((i % n) / n) * Math.PI * 2;
    const r = ring.f * R * noise[i % n]!;
    const dy = ring.f > 0 && ring.f < 1 ? (rnd() - 0.5) * 0.12 : 0;
    return [Math.cos(a) * r, ring.y + dy, Math.sin(a) * r];
  };
  const grid: Vec3[][] = rings.map((_, ri) => Array.from({ length: n }, (_, i) => pt(ri, i)));
  const pos: number[] = [];
  const colors: string[] = [];
  const push = (a: Vec3, b: Vec3, c: Vec3, color: string) => {
    pos.push(...a, ...b, ...c);
    colors.push(color);
  };
  for (let ri = 0; ri < rings.length - 1; ri++) {
    const outer = grid[ri]!;
    const inner = grid[ri + 1]!;
    const color = rings[ri + 1]!.c;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (rings[ri + 1]!.f === 0) {
        push(outer[i]!, inner[0]!, outer[j]!, color);
      } else {
        push(outer[i]!, inner[i]!, outer[j]!, color);
        push(outer[j]!, inner[i]!, inner[j]!, color);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const col: number[] = [];
  const tmp = new Color();
  for (const c of colors) {
    tmp.set(c);
    const j = 1 + (rnd() - 0.5) * 0.14;
    for (let v = 0; v < 3; v++) col.push(tmp.r * j, tmp.g * j, tmp.b * j);
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  k.addPainted(g);
  return (x: number, z: number) => {
    const f = Math.hypot(x, z) / R;
    for (let ri = rings.length - 1; ri > 0; ri--) {
      const a = rings[ri]!;
      const b = rings[ri - 1]!;
      if (f <= b.f) {
        const t = (f - a.f) / (b.f - a.f || 1);
        return lerp(a.y, b.y, Math.max(0, Math.min(1, t)));
      }
    }
    return rings[0]!.y;
  };
}

export const sandy = (H: number, top: string = C.grass): Ring[] => [
  { f: 1.22, y: -1.4, c: C.sandWet },
  { f: 1.0, y: 0.12, c: C.sandWet },
  { f: 0.86, y: H * 0.3, c: C.sand },
  { f: 0.7, y: H * 0.62, c: C.sand },
  { f: 0.55, y: H * 0.9, c: C.grassDark },
  { f: 0.25, y: H, c: top },
  { f: 0, y: H * 1.02, c: top },
];

export const rocky = (H: number): Ring[] => [
  { f: 1.2, y: -1.6, c: C.rockDark },
  { f: 1.0, y: 0.2, c: C.rockDark },
  { f: 0.9, y: H * 0.55, c: C.rock },
  { f: 0.72, y: H * 0.92, c: C.rockLight },
  { f: 0.5, y: H, c: C.grassDark },
  { f: 0, y: H * 1.04, c: C.grass },
];

export function shoreRocks(
  k: Kit,
  R: number,
  count: number,
  rnd: () => number,
  skipAngle?: number,
): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rnd() * 0.4;
    if (
      skipAngle !== undefined &&
      Math.abs(Math.atan2(Math.sin(a - skipAngle), Math.cos(a - skipAngle))) < 0.45
    ) {
      continue;
    }
    const f = 0.96 + rnd() * 0.1;
    rock(
      k,
      Math.cos(a) * R * f,
      0.1,
      Math.sin(a) * R * f,
      R * (0.06 + rnd() * 0.07),
      rnd,
      rnd() > 0.5 ? C.rock : C.rockDark,
    );
  }
}

function ringOfPalms(
  k: Kit,
  h: (x: number, z: number) => number,
  R: number,
  count: number,
  f: number,
  rnd: () => number,
  from = 0,
  to = Math.PI * 2,
): void {
  for (let i = 0; i < count; i++) {
    const a = from + ((i + 0.5) / count) * (to - from) + (rnd() - 0.5) * 0.3;
    const x = Math.cos(a) * R * f;
    const z = Math.sin(a) * R * f;
    palm(k, x, h(x, z) - 0.05, z, 2.8 + rnd() * 1.6, rnd);
  }
}

/** Un canvas con texto (letreros, pantalla del escenario). */
export function textTexture(
  lines: string[],
  opts: { w?: number; h?: number; bg: string; fg: string; font?: string },
): CanvasTexture {
  const w = opts.w ?? 512;
  const h = opts.h ?? 256;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  g.fillStyle = opts.bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = opts.fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const size = Math.floor((h / (lines.length + 0.6)) * 0.8);
  g.font = opts.font ?? `900 ${size}px system-ui, -apple-system, sans-serif`;
  lines.forEach((l, i) => g.fillText(l, w / 2, (h / (lines.length + 1)) * (i + 1)));
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export const newParts = (): Parts => ({ lit: new Kit(), glow: new Kit(), glows: new Glows() });

// --- Isla del Sonido (`allday`): el escenario -----------------------------

function allday(R: number, rnd: () => number): IslandBuild {
  const parts = newParts();
  const k = parts.lit;
  const H = 1.5;
  const h = terrain(k, R, sandy(H, '#86b84a'), rnd, 30);
  shoreRocks(k, R, 16, rnd, Math.PI / 2);
  const top = h(0, 0);
  const sz = -R * 0.2;
  // Tarima, cabina y altavoces.
  k.add(new BoxGeometry(7.2, 0.55, 3.4), C.woodDark, { p: [0, top + 0.27, sz] });
  k.add(new BoxGeometry(7.4, 0.08, 3.6), C.wood, { p: [0, top + 0.58, sz] });
  k.add(new BoxGeometry(2.2, 0.8, 0.8), C.cream, { p: [0, top + 0.98, sz + 0.5] });
  k.add(new BoxGeometry(2.3, 0.08, 0.9), C.speaker, { p: [0, top + 1.4, sz + 0.5] });
  for (const s of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      k.add(new BoxGeometry(1.0, 1.1, 0.9), C.speaker, {
        p: [s * 3.0, top + 1.15 + i * 1.12, sz + 0.6],
      });
      k.add(new CylinderGeometry(0.3, 0.3, 0.05, 10), '#11182c', {
        p: [s * 3.0, top + 1.15 + i * 1.12, sz + 1.06],
        r: [Math.PI / 2, 0, 0],
      });
    }
  }
  // Estructura: dos torres de celosía y el arco.
  for (const s of [-1, 1]) {
    for (let y = 0; y < 5; y++) {
      k.add(new BoxGeometry(0.5, 0.06, 0.5), C.iron, {
        p: [s * 3.8, top + 0.9 + y * 0.8, sz - 1.2],
      });
    }
    for (const dx of [-0.22, 0.22]) {
      for (const dz of [-0.22, 0.22]) {
        k.add(new BoxGeometry(0.06, 4.4, 0.06), C.iron, {
          p: [s * 3.8 + dx, top + 2.7, sz - 1.2 + dz],
        });
      }
    }
  }
  k.add(new BoxGeometry(8.1, 0.45, 0.45), C.iron, { p: [0, top + 4.9, sz - 1.2] });
  // Telón morado y banderolas naranjas.
  k.add(new BoxGeometry(7.2, 0.9, 0.08), C.purple, { p: [0, top + 4.3, sz - 1.05] });
  for (let i = 0; i < 8; i++) {
    k.add(new ConeGeometry(0.22, 0.5, 3), i % 2 ? C.orange : C.yellow, {
      p: [-3.3 + i * 0.95, top + 3.7, sz - 1.0],
      r: [Math.PI, 0, 0],
      s: [1, 1, 0.3],
    });
  }
  // Público: bajo el escenario, en la explanada.
  ringOfPalms(k, h, R, 9, 0.72, rnd, Math.PI * 0.9, Math.PI * 2.1);
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2;
    bush(
      k,
      Math.cos(a) * R * 0.6,
      h(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6),
      Math.sin(a) * R * 0.6,
      0.5,
      rnd,
    );
  }
  // Antorchas por el camino del muelle.
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      const z = R * 0.35 + i * R * 0.14;
      torch(parts, s * 1.3, h(s * 1.3, z), z);
    }
  }
  festoon(
    parts,
    [-3.8, top + 4.6, sz - 1.2],
    [-R * 0.62, h(-R * 0.62, R * 0.3) + 2.8, R * 0.3],
    10,
    [C.bulb, C.orange, '#b69cff'],
  );
  festoon(parts, [3.8, top + 4.6, sz - 1.2], [R * 0.62, h(R * 0.62, R * 0.3) + 2.8, R * 0.3], 10, [
    C.bulb,
    C.orange,
    '#b69cff',
  ]);
  pier(k, 0, R * 0.9, Math.PI / 2, R * 0.55);
  flag(k, -R * 0.25, h(-R * 0.25, R * 0.75), R * 0.75, 2.2, C.orange);
  flag(k, R * 0.25, h(R * 0.25, R * 0.75), R * 0.75, 2.2, C.purple);

  const animated: Object3D[] = [];
  // Pantalla LED con el nombre (se desplaza el color).
  const screenTex = textTexture(['BOIA'], { w: 512, h: 192, bg: '#1b0f4a', fg: '#ff5219' });
  const screen = new Mesh(new PlaneGeometry(5.6, 2.1), new MeshBasicMaterial({ map: screenTex }));
  screen.position.set(0, top + 2.6, sz - 1.12);
  animated.push(screen);
  // Bola de discoteca naranja.
  const ball = new Mesh(
    new IcosahedronGeometry(0.62, 1),
    new MeshLambertMaterial({ color: '#ff9a3d', emissive: '#7a2a00', flatShading: true }),
  );
  ball.position.set(0, top + 4.15, sz + 0.2);
  animated.push(ball);
  // Haces de luz.
  const beamMat = new MeshBasicMaterial({
    color: '#ffb35c',
    transparent: true,
    opacity: 0.22,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
  const beams: Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const cone = new Mesh(
      new ConeGeometry(1.1, 7, 12, 1, true).translate(0, -3.5, 0),
      beamMat.clone(),
    );
    cone.position.set(-2.4 + i * 1.6, top + 4.8, sz - 1.0);
    (cone.material as MeshBasicMaterial).color.set(i % 2 ? '#b69cff' : '#ffb35c');
    beams.push(cone);
    animated.push(cone);
  }
  // Público que baila (instanciado).
  const crowd = new InstancedMesh(
    crowdGeometry(),
    new MeshLambertMaterial({ vertexColors: true }),
    42,
  );
  const shirts = [C.orange, C.purpleSoft, C.yellow, C.pink, C.cream, '#4cc3d9'];
  const spots: Vec3[] = [];
  for (let i = 0; i < 42; i++) {
    const x = (rnd() - 0.5) * 6.5;
    const z = sz + 2.2 + rnd() * R * 0.35;
    spots.push([x, h(x, z), z]);
    crowd.setColorAt(i, new Color(shirts[i % shirts.length]!));
  }
  animated.push(crowd);
  const m = new Matrix4();
  const update = (t: number, glow: number) => {
    ball.rotation.y = t * 0.8;
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i]!;
      b.rotation.z = Math.sin(t * 0.9 + i * 1.3) * 0.55;
      b.rotation.x = 0.35 + Math.cos(t * 0.7 + i) * 0.25;
      (b.material as MeshBasicMaterial).opacity = 0.05 + 0.2 * glow;
    }
    screenTex.offset.x = Math.sin(t * 0.6) * 0.04;
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i]!;
      const jump = Math.max(0, Math.sin(t * 7 + i * 1.7)) * 0.16;
      m.makeRotationY(Math.PI + Math.sin(t + i) * 0.4);
      m.setPosition(s[0], s[1] + jump, s[2]);
      crowd.setMatrixAt(i, m);
    }
    crowd.instanceMatrix.needsUpdate = true;
  };
  return { parts, animated, update, heightAt: h, labelY: top + 6.4 };
}

// --- Puerto de Alicante: la dársena (T108) ---------------------------------

/**
 * Las medidas del puerto, en radios de la isla y con el frente (hacia El
 * Varadero) en +z: las del modelo de Blender (`tools/blender/places/cala.py`,
 * cuya fuente usa z arriba y el frente en −y), para que la composición a
 * mano (lejos, mientras llega o si falla el GLB) tenga la misma huella. Sólo
 * la mitad de atrás es tierra; la dársena de delante es agua, sin bajío.
 */
export const HARBOR_LAYOUT = {
  /** Radio de la tierra (el semicírculo de atrás) y su alto sobre el agua. */
  land: 0.93,
  landTop: 0.045,
  /** El paseo del muelle que cierra la dársena por atrás. */
  promenade: { z: -0.08, depth: 0.22, top: 0.122 },
  /** Los dos muelles de fuera, en x = ±x, de z0 a z1. */
  quays: { x: 0.77, z0: -0.05, z1: 0.47, width: 0.16, top: 0.1 },
  /** Los tres pantalanes de madera. */
  piers: [-0.43, 0, 0.43],
  pierZ: [-0.04, 0.56] as const,
  /** Los seis barcos amarrados (x, z). */
  berths: [
    [-0.57, 0.3],
    [-0.28, 0.25],
    [-0.14, 0.3],
    [0.15, 0.28],
    [0.29, 0.32],
    [0.57, 0.26],
  ] as [number, number][],
  palms: [
    [-0.65, -0.33],
    [0.64, -0.33],
    [-0.46, -0.59],
    [0.46, -0.59],
  ] as [number, number][],
  lamps: [-0.71, 0.71],
} as const;

function cala(R: number, rnd: () => number): IslandBuild {
  const parts = newParts();
  const k = parts.lit;
  const L = HARBOR_LAYOUT;
  const top = L.landTop * R;
  // La tierra: medio disco atrás (z ≤ 0), cerrado por delante; nada en la dársena.
  k.add(
    new CylinderGeometry(L.land * R, L.land * R, top + 0.4, 24, 1, false, Math.PI / 2, Math.PI),
    C.sand,
    { p: [0, top / 2 - 0.2, 0] },
  );
  k.add(new BoxGeometry(2 * L.land * R, top + 0.4, 0.05), C.sandWet, {
    p: [0, top / 2 - 0.2, -0.025],
  });
  // El paseo del muelle y los dos muelles de fuera (de piedra, con su paseo encima).
  const pr = L.promenade;
  k.add(new BoxGeometry(1.75 * R, pr.top * R + 0.3, pr.depth * R), C.wall, {
    p: [0, (pr.top * R - 0.3) / 2, pr.z * R],
  });
  const q = L.quays;
  for (const side of [-1, 1]) {
    const len = (q.z1 - q.z0) * R;
    k.add(new BoxGeometry(q.width * R, q.top * R + 0.3, len), C.cliff, {
      p: [side * q.x * R, (q.top * R - 0.3) / 2, ((q.z0 + q.z1) / 2) * R],
    });
    k.add(new BoxGeometry(q.width * R * 0.9, 0.06, len * 0.98), C.wall, {
      p: [side * q.x * R, q.top * R + 0.03, ((q.z0 + q.z1) / 2) * R],
    });
  }
  // Los pantalanes de madera, unidos al paseo.
  for (const x of L.piers) {
    const len = (L.pierZ[1] - L.pierZ[0]) * R;
    k.add(new BoxGeometry(0.065 * R, 0.4, len), C.wood, {
      p: [x * R, 0.1 * R - 0.2, ((L.pierZ[0] + L.pierZ[1]) / 2) * R],
    });
  }
  // Los barcos amarrados: casco blanco, cabina y, uno sí y otro no, mástil.
  L.berths.forEach(([x, z], i) => {
    k.add(new SphereGeometry(1, 10, 6), C.white, {
      p: [x * R, 0.02 * R, z * R],
      s: [0.05 * R, 0.035 * R, 0.13 * R],
    });
    k.add(new BoxGeometry(0.06 * R, 0.046 * R, 0.072 * R), C.wall, {
      p: [x * R, 0.075 * R, (z - 0.015) * R],
    });
    k.add(new BoxGeometry(0.046 * R, 0.016 * R, 0.01 * R), C.blueDoor, {
      p: [x * R, 0.081 * R, (z + 0.024) * R],
    });
    if (i % 2 === 0) {
      k.add(new CylinderGeometry(0.03, 0.03, 0.29 * R, 4), C.white, {
        p: [x * R, 0.2 * R, (z + 0.014) * R],
      });
    }
  });
  // La marina: un edificio blanco y bajo con su planta azul y el toldo naranja de BOIA.
  k.add(new BoxGeometry(0.88 * R, 0.34 * R, 0.29 * R), C.wall, { p: [0, 0.225 * R, -0.42 * R] });
  k.add(new BoxGeometry(0.38 * R, 0.16 * R, 0.3 * R), C.blueDoor, {
    p: [0, 0.37 * R, -0.42 * R],
  });
  for (const side of [-1, 1]) {
    k.add(new BoxGeometry(0.3 * R, 0.04 * R, 0.33 * R), C.white, {
      p: [side * 0.32 * R, 0.402 * R, -0.42 * R],
    });
  }
  for (let i = 0; i < 7; i++) {
    k.add(new BoxGeometry(0.076 * R, 0.15 * R, 0.02), C.navy, {
      p: [(i - 3) * 0.113 * R, 0.2 * R, -0.274 * R],
    });
  }
  k.add(new BoxGeometry(0.72 * R, 0.022 * R, 0.16 * R), C.orange, {
    p: [0, 0.303 * R, -0.185 * R],
  });
  for (const x of [-0.31, 0.31]) {
    k.add(new CylinderGeometry(0.05, 0.05, 0.17 * R, 5), C.white, {
      p: [x * R, 0.215 * R, -0.176 * R],
    });
  }
  // Palmeras en sus jardineras y las dos farolas del paseo (de noche, sus luces).
  for (const [x, z] of L.palms) {
    k.add(new CylinderGeometry(0.085 * R, 0.085 * R, 0.06 * R, 10), C.cliff, {
      p: [x * R, top + 0.03 * R, z * R],
    });
    palm(k, x * R, top + 0.05 * R, z * R, 0.42 * R, rnd);
  }
  for (const x of L.lamps) {
    k.add(new CylinderGeometry(0.05, 0.06, 0.24 * R, 5), C.navy, {
      p: [x * R, (0.12 + 0.12) * R, -0.2 * R],
    });
    parts.glow.add(new SphereGeometry(0.022 * R, 8, 6), C.bulb, { p: [x * R, 0.37 * R, -0.2 * R] });
    parts.glows.add([x * R, 0.37 * R, -0.2 * R], '#ffcf7a', 2.6);
  }
  // Sobre la tierra, su alto; en la dársena (z > 0), el agua.
  const heightAt = (x: number, z: number) =>
    z <= 0 && Math.hypot(x, z) <= L.land * R ? top : 0;
  return {
    parts,
    animated: [],
    heightAt,
    labelY: 0.56 * R + 1.6,
    // El bajío sólo bajo la tierra de atrás, corto: la dársena queda en agua honda.
    shores: [
      { dx: 0, dz: -0.47 * R, r: 0.45 * R, w: 2 },
      { dx: -0.5 * R, dz: -0.3 * R, r: 0.3 * R, w: 2 },
      { dx: 0.5 * R, dz: -0.3 * R, r: 0.3 * R, w: 2 },
    ],
  };
}

// --- Isla de Benidorm: el skyline y el club (T112) ------------------------

/**
 * Las medidas de Benidorm, en radios de la isla, con el frente en +z: las
 * del modelo de Blender (`tools/blender/places/fotos.py`, cuya fuente usa z
 * arriba y el frente en −y; aquí x, alto, −y), para que la composición a mano
 * (lejos, mientras llega o si falla el GLB) tenga su misma silueta: las
 * torres atrás, el club abierto delante. El GLB la sustituye entera.
 */
export const BENIDORM_LAYOUT = {
  /** La isla redonda y su paseo claro. */
  land: 0.94,
  landTop: 0.045,
  promenade: { r: 0.88, top: 0.064 },
  /** Lo más alto (la corona del Intempo): el alto del manifiesto. */
  height: 1.343,
  /** Las dos torres del Intempo y su rombo de arriba. */
  intempo: { x: -0.32, gap: 0.135, z: -0.47, w: 0.115, d: 0.16, top: 1.305, crown: 1.343 },
  /** Las demás torres: x, z, alto, ancho (escalonadas, no una fila igual). */
  towers: [
    [0.2, -0.51, 1.1, 0.18],
    [0.46, -0.46, 0.81, 0.14],
    [0.66, -0.32, 0.63, 0.12],
    [-0.69, -0.31, 0.66, 0.13],
    [0.04, -0.7, 0.76, 0.12],
  ] as [number, number, number, number][],
  /** El club: su pared de atrás, el escenario redondo con la barra y las dos pantallas. */
  club: { z: -0.04, w: 1.1, d: 0.1, h: 0.31 },
  stage: { z: 0.33, r: 0.4, top: 0.15 },
  pole: { z: 0.33, top: 1.03 },
  screens: { x: 0.55, z: 0.025, y: 0.57, size: 0.3 },
} as const;

function fotos(R: number, rnd: () => number): IslandBuild {
  const parts = newParts();
  const k = parts.lit;
  const L = BENIDORM_LAYOUT;
  const ground = L.promenade.top * R;
  k.add(new CylinderGeometry(L.land * R, L.land * R, L.landTop * R + 0.4, 24), C.sand, {
    p: [0, (L.landTop * R - 0.4) / 2, 0],
  });
  k.add(new CylinderGeometry(L.promenade.r * R, L.promenade.r * R, 0.1, 24), C.wall, {
    p: [0, ground - 0.05, 0],
  });
  // El Intempo: dos torres doradas con un rombo arriba; sus cristales, azules.
  const it = L.intempo;
  for (const s of [-1, 1]) {
    const x = (it.x + s * it.gap) * R;
    const h = it.top * R - ground;
    k.add(new BoxGeometry(it.w * R, h, it.d * R), C.gold, { p: [x, ground + h / 2, it.z * R] });
    k.add(new BoxGeometry(it.w * R * 0.6, h * 0.94, 0.05), C.blueDoor, {
      p: [x, ground + h / 2, (it.z + it.d / 2) * R + 0.03],
    });
    k.add(new BoxGeometry(it.w * R * 1.15, (it.crown - it.top) * R, it.d * R * 1.1), C.wall, {
      p: [x, ((it.top + it.crown) / 2) * R, it.z * R],
    });
  }
  k.add(new ConeGeometry(0.17 * R, 0.25 * R, 4), C.gold, {
    p: [it.x * R, 1.17 * R, it.z * R],
    r: [Math.PI, Math.PI / 4, 0],
    s: [1, 1, 0.5],
  });
  // Las demás torres, blancas con su franja de cristal.
  for (const [x, z, h, w] of L.towers) {
    k.add(new BoxGeometry(w * R, h * R, 0.14 * R), rnd() > 0.5 ? C.white : C.wall, {
      p: [x * R, ground + (h * R) / 2, z * R],
    });
    k.add(new BoxGeometry(w * R * 0.59, h * R * 0.89, 0.05), C.blueDoor, {
      p: [x * R, ground + (h * R) / 2, (z + 0.07) * R + 0.03],
    });
  }
  // El club: pared morada con su franja rosa, el escenario y la barra con su pórtico.
  const cl = L.club;
  k.add(new BoxGeometry(cl.w * R, cl.h * R, cl.d * R), C.purpleSoft, {
    p: [0, ground + (cl.h * R) / 2, cl.z * R],
  });
  const st = L.stage;
  k.add(new CylinderGeometry(st.r * R, st.r * R, st.top * R - ground, 16), C.navy, {
    p: [0, (ground + st.top * R) / 2, st.z * R],
  });
  k.add(new CylinderGeometry(0.014 * R, 0.014 * R, (L.pole.top - st.top) * R, 6), C.wall, {
    p: [0, ((L.pole.top + st.top) / 2) * R, L.pole.z * R],
  });
  for (const s of [-1, 1]) {
    k.add(new CylinderGeometry(0.016 * R, 0.016 * R, L.pole.top * R - ground, 5), C.navy, {
      p: [s * 0.49 * R, (L.pole.top * R + ground) / 2, 0.23 * R],
    });
  }
  k.add(new BoxGeometry(1.03 * R, 0.035 * R, 0.045 * R), C.navy, {
    p: [0, L.pole.top * R, 0.23 * R],
  });
  // Las dos pantallas: marco azul marino y panel que brilla (cian y rosa).
  const sc = L.screens;
  for (const s of [-1, 1]) {
    k.add(new BoxGeometry(sc.size * R, sc.size * R, 0.055 * R), C.navy, {
      p: [s * sc.x * R, sc.y * R, sc.z * R],
    });
    parts.glow.add(
      new BoxGeometry(sc.size * R * 0.88, sc.size * R * 0.88, 0.02),
      s < 0 ? '#3fd6e0' : C.pink,
      {
        p: [s * sc.x * R, sc.y * R, (sc.z + 0.03) * R + 0.01],
      },
    );
    parts.glows.add([s * sc.x * R, sc.y * R, (sc.z + 0.08) * R], s < 0 ? '#3fd6e0' : C.pink, 3);
  }
  const heightAt = (x: number, z: number) => (Math.hypot(x, z) <= L.land * R ? ground : 0);
  return { parts, animated: [], heightAt, labelY: L.height * R + LABEL_GAP };
}

// --- Ibiza: el pueblo blanco y su cala (T112) ------------------------------

/**
 * Las medidas de Ibiza, en radios de la isla y con el frente en +z: las del
 * modelo de Blender (`tools/blender/places/tienda.py`; aquí x, alto, −y). La
 * cala se abre hacia delante; el pueblo blanco sube por detrás hasta la
 * iglesia, y el quiosco de la tienda está en la playa. La composición a mano
 * (lejos, mientras llega o si falla el GLB) lo resume; el GLB la sustituye.
 */
export const IBIZA_LAYOUT = {
  /** Lo más alto (la torre de la iglesia): el alto del manifiesto. */
  height: 0.587481,
  /** Alto del terreno en el centro de la isla. */
  ground: 0.2,
  /** El centro de la cala (en +z, hacia el frente) y su radio. */
  cove: { z: 0.34, r: 0.33 },
  /** Las casas: ángulo (grados desde atrás hacia +x) y distancia desde la cala, ancho, fondo y alto. */
  houses: [
    [-49, 0.585, 0.135, 0.11, 0.095],
    [-27, 0.575, 0.125, 0.105, 0.1],
    [41, 0.585, 0.13, 0.105, 0.1],
    [62, 0.6, 0.12, 0.1, 0.09],
    [-37, 0.725, 0.14, 0.11, 0.105],
    [-15, 0.715, 0.13, 0.11, 0.11],
    [13, 0.72, 0.14, 0.11, 0.105],
    [34, 0.725, 0.13, 0.105, 0.1],
    [-30, 0.885, 0.13, 0.11, 0.1],
    [18, 0.86, 0.135, 0.11, 0.105],
  ] as [number, number, number, number, number][],
  church: [-5, 0.875] as [number, number],
  shop: [12, 0.45] as [number, number],
  /** Pinos de los cabos y de atrás (x, z, alto en radios). */
  pines: [
    [-0.66, 0.3, 0.2],
    [-0.56, 0.52, 0.17],
    [0.64, 0.28, 0.2],
    [0.52, 0.5, 0.17],
    [-0.62, -0.3, 0.18],
    [0.64, -0.3, 0.18],
    [-0.16, -0.74, 0.17],
    [0.12, -0.76, 0.16],
  ] as [number, number, number][],
} as const;

/** Un punto de Ibiza a `d` radios de la cala, `deg` grados desde atrás hacia +x (escena, en radios). */
export function ibizaAround(deg: number, d: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [d * Math.sin(a), IBIZA_LAYOUT.cove.z - d * Math.cos(a)];
}

function tienda(R: number, rnd: () => number): IslandBuild {
  const parts = newParts();
  const k = parts.lit;
  const L = IBIZA_LAYOUT;
  const h = terrain(k, R, sandy(L.ground * R, C.grass), rnd);
  shoreRocks(k, R, 10, rnd, Math.PI / 2);
  // La playa de la cala, delante.
  const cz = L.cove.z * R;
  k.add(new CylinderGeometry(L.cove.r * R, L.cove.r * R, 0.1, 16), C.sand, {
    p: [0, h(0, cz) + 0.06, cz],
  });
  // Las casas blancas, con su azotea o su teja y una puerta.
  L.houses.forEach(([deg, d, w, dd, hh], i) => {
    const [x, z] = ibizaAround(deg, d);
    const y = h(x * R, z * R);
    const face = Math.atan2(-x, L.cove.z - z);
    k.add(new BoxGeometry(w * R, hh * R, dd * R), C.white, {
      p: [x * R, y + (hh * R) / 2, z * R],
      r: [0, face, 0],
    });
    k.add(new BoxGeometry(w * R * 1.04, 0.012 * R, dd * R * 1.04), i % 2 ? C.terracotta : C.sand, {
      p: [x * R, y + hh * R, z * R],
      r: [0, face, 0],
    });
  });
  // La iglesia del Puig de Missa, arriba: nave blanca, torre y cúpula de teja.
  {
    const [x, z] = ibizaAround(...L.church);
    const y = h(x * R, z * R);
    k.add(new BoxGeometry(0.16 * R, 0.16 * R, 0.24 * R), C.white, {
      p: [x * R, y + 0.08 * R, z * R],
    });
    k.add(new BoxGeometry(0.08 * R, L.height * R - y, 0.08 * R), C.white, {
      p: [(x + 0.1) * R, (y + L.height * R) / 2, (z + 0.06) * R],
    });
    k.add(new SphereGeometry(0.06 * R, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), C.terracotta, {
      p: [x * R, y + 0.16 * R, (z - 0.06) * R],
    });
  }
  // El quiosco de la tienda en la playa: mostrador y toldo a franjas de BOIA.
  {
    const [x, z] = ibizaAround(...L.shop);
    const y = h(x * R, z * R);
    k.add(new BoxGeometry(0.18 * R, 0.09 * R, 0.1 * R), C.wood, {
      p: [x * R, y + 0.045 * R, z * R],
    });
    for (let i = 0; i < 4; i++) {
      k.add(new BoxGeometry(0.05 * R, 0.01 * R, 0.13 * R), i % 2 ? C.white : C.orange, {
        p: [(x - 0.075 + i * 0.05) * R, y + 0.13 * R, (z + 0.03) * R],
        r: [0.3, 0, 0],
      });
    }
    parts.glow.add(new SphereGeometry(0.012 * R, 6, 4), C.bulb, {
      p: [x * R, y + 0.11 * R, (z + 0.07) * R],
    });
    parts.glows.add([x * R, y + 0.11 * R, (z + 0.07) * R], C.bulb, 3);
  }
  for (const [x, z, s] of L.pines) pine(k, x * R, h(x * R, z * R) - 0.05, z * R, s * R);
  return { parts, animated: [], heightAt: h, labelY: L.height * R + LABEL_GAP };
}

// --- Isla de Nochevieja (`ultima`, donde baja la Fiestera) ---------------

function ultima(R: number, rnd: () => number): IslandBuild {
  const parts = newParts();
  const k = parts.lit;
  const h = terrain(k, R, sandy(1.4, '#a8c95c'), rnd);
  shoreRocks(k, R, 12, rnd, Math.PI / 2);
  const top = h(0, 0);
  // Círculo de piedras con la hoguera.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const x = Math.cos(a) * 2.4;
    const z = Math.sin(a) * 2.4 - 0.6;
    k.add(wobble(new BoxGeometry(0.45, 1.2 + rnd() * 0.6, 0.35), 0.08, rnd), C.rockLight, {
      p: [x, h(x, z) + 0.5, z],
      r: [0, -a, (rnd() - 0.5) * 0.2],
    });
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    k.add(new CylinderGeometry(0.06, 0.06, 0.8, 4), C.woodDark, {
      p: [Math.cos(a) * 0.3, top + 0.25, Math.sin(a) * 0.3 - 0.6],
      r: [Math.sin(a) * 0.8, 0, Math.cos(a) * 0.8],
    });
  }
  parts.glow.add(new ConeGeometry(0.35, 0.9, 6), C.flame, { p: [0, top + 0.5, -0.6] });
  parts.glows.add([0, top + 0.8, -0.6], '#ff9a3a', 6);
  // Cojines.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const x = Math.cos(a) * 1.5;
    const z = Math.sin(a) * 1.5 - 0.6;
    k.add(new BoxGeometry(0.5, 0.2, 0.5), i % 2 ? C.purpleSoft : C.orange, {
      p: [x, h(x, z) + 0.1, z],
      r: [0, a, 0],
    });
  }
  // El nicho de la Fiestera, en la orilla sur.
  const nz = R * 0.78;
  k.add(new BoxGeometry(1.4, 1.4, 0.5), C.wall, { p: [0, h(0, nz) + 0.7, nz - 0.4] });
  k.add(new CylinderGeometry(0.7, 0.7, 0.5, 10, 1, false, 0, Math.PI), C.wall, {
    p: [0, h(0, nz) + 1.4, nz - 0.4],
    r: [Math.PI / 2, 0, Math.PI / 2],
  });
  ringOfPalms(k, h, R, 7, 0.7, rnd, Math.PI * 0.8, Math.PI * 2.2);
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 1.1 + i * 0.35;
    const x = Math.cos(a) * R * 0.5;
    const z = Math.sin(a) * R * 0.5;
    torch(parts, x, h(x, z), z, 0.9);
  }
  pier(k, R * 0.4, R * 0.85, Math.PI / 2, R * 0.5);
  return { parts, animated: [], heightAt: h, labelY: top + 4.5 };
}

// --- Faro ---------------------------------------------------------------------

function faro(R: number, rnd: () => number): IslandBuild {
  const parts = newParts();
  const k = parts.lit;
  const h = terrain(k, R, rocky(2.2), rnd, 20);
  shoreRocks(k, R, 10, rnd);
  const top = h(0, 0);
  const tx = -0.4;
  const tz = -0.3;
  for (let i = 0; i < 5; i++) {
    const r0 = 0.95 - i * 0.07;
    k.add(new CylinderGeometry(r0 - 0.07, r0, 1.05, 12), i % 2 ? C.white : C.orange, {
      p: [tx, top + 0.52 + i * 1.05, tz],
    });
  }
  const ly = top + 5.25;
  k.add(new CylinderGeometry(0.75, 0.75, 0.14, 12), C.iron, { p: [tx, ly, tz] });
  parts.glow.add(new CylinderGeometry(0.45, 0.45, 0.7, 10), '#ffe7a3', { p: [tx, ly + 0.42, tz] });
  k.add(new ConeGeometry(0.6, 0.6, 10), C.iron, { p: [tx, ly + 1.07, tz] });
  parts.glows.add([tx, ly + 0.45, tz], '#ffe59a', 9);
  // Casa del farero.
  k.add(new BoxGeometry(1.4, 1.0, 1.1), C.wall, { p: [1.0, top + 0.5, 0.4] });
  k.add(new ConeGeometry(1.05, 0.6, 4), C.roof, {
    p: [1.0, top + 1.3, 0.4],
    r: [0, Math.PI / 4, 0],
    s: [1.05, 1, 0.8],
  });
  pine(k, -1.3, h(-1.3, 0.8), 0.8, 2.1);
  const animated: Object3D[] = [];
  const beam = new Mesh(
    new ConeGeometry(2.4, 16, 16, 1, true).translate(0, -8, 0).rotateZ(Math.PI / 2),
    new MeshBasicMaterial({
      color: '#fff1b8',
      transparent: true,
      opacity: 0.18,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    }),
  );
  const beamPivot = new Group();
  beamPivot.position.set(tx, ly + 0.42, tz);
  beam.position.x = 0;
  beamPivot.add(beam);
  animated.push(beamPivot);
  const update = (t: number, glow: number) => {
    beamPivot.rotation.y = t * 0.9;
    (beam.material as MeshBasicMaterial).opacity = 0.03 + 0.2 * glow;
  };
  return { parts, animated, update, heightAt: h, labelY: top + 7.8 };
}

// --- Cañón --------------------------------------------------------------------

function canon(R: number, rnd: () => number): IslandBuild {
  const parts = newParts();
  const k = parts.lit;
  const h = terrain(k, R, rocky(1.7), rnd, 20);
  shoreRocks(k, R, 9, rnd);
  const top = h(0, 0);
  // Fortín: muro bajo en anillo con almenas.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    k.add(new BoxGeometry(0.9, i % 2 ? 0.7 : 0.9, 0.35), '#c9b79a', {
      p: [Math.cos(a) * 1.7, top + 0.4, Math.sin(a) * 1.7],
      r: [0, -a + Math.PI / 2, 0],
    });
  }
  k.add(new CylinderGeometry(0.22, 0.28, 1.6, 8), C.iron, {
    p: [0.3, top + 0.55, 0.3],
    r: [0, 0.6, Math.PI / 2 - 0.25],
  });
  for (const s of [-1, 1]) {
    k.add(new CylinderGeometry(0.28, 0.28, 0.1, 8), C.woodDark, {
      p: [0.1, top + 0.28, 0.3 + s * 0.3],
      r: [Math.PI / 2, 0, 0],
    });
  }
  for (let i = 0; i < 4; i++) {
    k.add(new SphereGeometry(0.14, 6, 5), C.iron, {
      p: [-0.8 + (i % 2) * 0.28, top + 0.14 + (i > 1 ? 0.22 : 0), -0.5],
    });
  }
  flag(k, -0.6, top, 0.8, 2.4, C.purple);
  torch(parts, 1.3, top, -1.0);
  return { parts, animated: [], heightAt: h, labelY: top + 3.6 };
}

// --- Isla de Halloween (T67): la de a mano bajo el modelo de Blender de T69 ----

/**
 * Una composición sencilla: roca oscura, una calabaza grande con la cara
 * encendida en el centro, árboles secos y antorchas moradas. De cerca la
 * sustituye el modelo de Blender (T69, art/islas/3d/halloween.glb: el club
 * calabaza y las boias disfrazadas); ésta se ve lejos, mientras llega o si
 * falla.
 */
function halloween(R: number, rnd: () => number): IslandBuild {
  const parts = newParts();
  const k = parts.lit;
  const h = terrain(k, R, rocky(1.6), rnd, 22);
  shoreRocks(k, R, 10, rnd, Math.PI / 2);
  const top = h(0, 0);
  // La calabaza: gajos aplastados, rabo y la cara que brilla de noche.
  const pr = Math.min(2.2, R * 0.32);
  const cz = -0.4;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.add(new SphereGeometry(pr * 0.55, 10, 8), i % 2 ? C.orange : C.orangeDeep, {
      p: [Math.cos(a) * pr * 0.42, top + pr * 0.62, cz + Math.sin(a) * pr * 0.42],
      s: [1, 1.15, 1],
    });
  }
  k.add(new CylinderGeometry(0.16, 0.24, 0.7, 6), C.leafDark, {
    p: [0, top + pr * 1.38, cz],
    r: [0, 0, 0.25],
  });
  const face = pr * 0.94;
  for (const s of [-1, 1]) {
    parts.glow.add(new ConeGeometry(0.28, 0.42, 3), C.flame, {
      p: [s * 0.45, top + pr * 0.82, cz + face],
      r: [Math.PI / 2, 0, 0],
    });
  }
  parts.glow.add(new BoxGeometry(1.1, 0.22, 0.12), C.flame, { p: [0, top + pr * 0.42, cz + face] });
  parts.glows.add([0, top + pr * 0.6, cz + face + 0.4], '#ff8a2a', 7);
  // Árboles secos.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * 0.95 + i * 0.6 + (rnd() - 0.5) * 0.2;
    const x = Math.cos(a) * R * 0.62;
    const z = Math.sin(a) * R * 0.62;
    const y = h(x, z);
    k.add(new CylinderGeometry(0.08, 0.14, 2.2, 5), C.iron, { p: [x, y + 1.1, z] });
    for (const s of [-1, 1]) {
      k.add(new CylinderGeometry(0.04, 0.07, 0.9, 4), C.iron, {
        p: [x + s * 0.3, y + 1.8, z],
        r: [0, 0, -s * 0.8],
      });
    }
  }
  for (const s of [-1, 1]) {
    torch(parts, s * 1.4, h(s * 1.4, R * 0.5), R * 0.5);
    parts.glows.add([s * 1.4, h(s * 1.4, R * 0.5) + 1.4, R * 0.5], C.purpleSoft, 3);
  }
  pier(k, 0, R * 0.9, Math.PI / 2, R * 0.5);
  return { parts, animated: [], heightAt: h, labelY: top + pr * 1.6 + 2.6 };
}

/** Una isla genérica (lugares de categoría isla que aún no tienen composición). */
function generic(R: number, rnd: () => number): IslandBuild {
  const parts = newParts();
  const h = terrain(parts.lit, R, sandy(1.2), rnd);
  shoreRocks(parts.lit, R, 10, rnd);
  ringOfPalms(parts.lit, h, R, 5, 0.5, rnd);
  return { parts, animated: [], heightAt: h, labelY: h(0, 0) + 4 };
}

const BUILDERS: Record<string, (R: number, rnd: () => number) => IslandBuild> = {
  allday,
  cala,
  fotos,
  tienda,
  ultima,
  faro,
  canon,
  halloween,
};

/** La composición de una isla del mapa (por id; si no hay, una isla genérica). */
export function buildIsland(id: string, R: number): IslandBuild {
  const rnd = rng(seedOf(id));
  return (BUILDERS[id] ?? generic)(R, rnd);
}

// --- El náufrago ---------------------------------------------------------------

export function buildSandbank(R: number): IslandBuild {
  const parts = newParts();
  const rnd = rng(seedOf('naufrago'));
  const h = terrain(
    parts.lit,
    R,
    [
      { f: 1.3, y: -1, c: C.sandWet },
      { f: 1.0, y: 0.1, c: C.sandWet },
      { f: 0.6, y: 0.35, c: C.sand },
      { f: 0, y: 0.45, c: C.sand },
    ],
    rnd,
    14,
  );
  palm(parts.lit, -0.4, 0.35, -0.3, 2.8, rnd);
  person(parts.lit, 0.5, 0.4, 0.3, C.orange);
  // SOS en la arena.
  for (let i = 0; i < 3; i++) {
    parts.lit.add(new BoxGeometry(0.28, 0.04, 0.4), C.woodDark, { p: [-0.5 + i * 0.4, 0.46, 0.7] });
  }
  flag(parts.lit, 0.9, 0.4, -0.3, 1.6, C.white);
  return { parts, animated: [], heightAt: h, labelY: 3.4 };
}

/** Un anillo de boias dormidas (el secreto junto a la Isla de Nochevieja). */
export function sleepingRing(k: Kit, r: number): void {
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    k.add(new SphereGeometry(0.35, 8, 6), C.orange, {
      p: [Math.cos(a) * r, 0.15, Math.sin(a) * r],
      s: [1, 0.8, 1],
    });
    k.add(new BoxGeometry(0.3, 0.03, 0.04), '#1a1020', {
      p: [Math.cos(a) * r * 1.08, 0.3, Math.sin(a) * r * 1.08],
      r: [0, -a, 0],
    });
  }
}

/** Ánfora de barro (el secreto de la Cala). */
export function amphora(): BufferGeometry {
  const k = new Kit();
  const g = new LatheGeometry(
    [0.02, 0.2, 0.34, 0.36, 0.3, 0.14, 0.12, 0.16].map((x, i) => new Vector2(x, i * 0.16)),
    8,
  );
  k.add(g, C.terracotta);
  k.add(new TorusGeometry(0.12, 0.03, 4, 8), '#a8532e', {
    p: [0.16, 0.95, 0],
    r: [0, 0, Math.PI / 2],
  });
  k.add(new TorusGeometry(0.12, 0.03, 4, 8), '#a8532e', {
    p: [-0.16, 0.95, 0],
    r: [0, 0, Math.PI / 2],
  });
  return k.build();
}
