import {
  type BufferAttribute,
  type BufferGeometry,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  PlaneGeometry,
  SphereGeometry,
} from 'three';
import { type IslandBuild, newParts, rocky, sandy, shoreRocks, terrain } from './islands';
import { rng, seedOf, wobble } from './kit';
import { DECOR_SIZE, DECOR_SOLIDS, type DecorKind } from './compact';
import { C } from './palette';
import { crag, flag, house, palm, pier, pine } from './props';

/**
 * Medidas de la Explanada (unidades de escena = del modelo, escala 1): las
 * mismas constantes que `tools/blender/islas/explanada.py` (allí, en Blender,
 * el frente es −Y; aquí, +z). Los x son a lo largo del paseo.
 */
export const EXPLANADA = {
  /** Cima de la tierra, donde se apoya el paseo. */
  top: 0.9,
  /** El pavimento, a lo largo, y hasta dónde llega el mosaico (la tarima de la Concha). */
  x0: -15.2,
  x1: 15.2,
  walkX1: 11.3,
  /** Semiancho del pavimento entero. */
  sideHalf: 3.7,
  /** Las dos hileras de palmeras, a cada lado del paseo (±z). */
  rowZ: 2.3,
  /** El muro de mar, al frente (+z). */
  wallZ: 3.95,
  /** Las fachadas, por detrás (−z), y su fondo. */
  facadeZ0: 4.4,
  facadeD: 1.9,
  lampH: 2.4,
  /** La Concha: centro (x, z), radio y alto de la media cúpula. */
  concha: { x: 13.6, z: -0.35, r: 2.3, h: 2.5 },
  /** Las olas del mosaico: periodo y amplitud. */
  wave: { len: 4.4, amp: 0.3 },
  /** Las fachadas: x, semiancho, alto, color, plantas. */
  facades: [
    [-13.3, 1.9, 3.6, '#f6eedf', 3],
    [-9.3, 1.9, 4.6, '#e9c9a4', 4],
    [-5.3, 1.85, 3.1, '#e6b9a8', 3],
    [-1.5, 1.8, 4.2, '#f6eedf', 4],
    [2.3, 1.85, 3.4, '#e9c9a4', 3],
    [6.2, 1.95, 4.8, '#f6eedf', 4],
    [10.2, 1.9, 3.3, '#e6b9a8', 3],
    [14.0, 1.75, 4.0, '#e9c9a4', 4],
  ] as const,
} as const;

/**
 * El decorado propio del planeta de agua de `/mar` (D-22, REQ-MUN-038): lo
 * que en el 2D es costa aquí son islas en el mar. La Explanada con su mosaico
 * de olas (Alicante) flanquea la salida del puerto, y el islote de la cueva
 * guarda el secreto que en el 2D está en el acantilado oeste. No son lugares
 * del mapa compartido (sin id, sin comportamientos, fuera del runtime): sólo
 * se ven y no se atraviesan. Dónde va cada pieza y sus círculos sólidos están
 * en `compact.ts` (T50: se mueven con el mundo compacto). Unidades de escena.
 * La Explanada tiene además su modelo de Blender (plan 023, T252:
 * `art/islas/3d/explanada.glb`, `DECOR_MODELS` de `compact.ts`), que
 * sustituye de cerca a la composición de aquí. Todo `muestra`.
 *
 * El castillo en su monte se construye aquí igual, pero desde el plan 014
 * (T157) no es decorado: es la isla del minijuego `castillo` del mapa, junto a
 * la Boia 7 (`mar3d.ts` la dibuja con `buildDecor('castillo')`).
 */

export interface DecorBuild extends IslandBuild {
  /** Círculos sólidos, respecto al centro. */
  solids: { dx: number; dz: number; r: number }[];
}

/** El castillo de Santa Bárbara en el monte Benacantil, ahora isla. */
function castillo(rnd: () => number): DecorBuild {
  const R = DECOR_SIZE.castillo;
  const parts = newParts();
  const k = parts.lit;
  const h = terrain(k, R, rocky(1.4), rnd, 24);
  shoreRocks(k, R, 12, rnd, Math.PI / 2);
  // El monte: un cono de arcilla con la cara al mar.
  k.add(wobble(new ConeGeometry(9.5, 15, 9, 3), 1.6, rnd), C.cliff, {
    p: [-1, 8.2, -1.5],
    s: [1, 1, 0.85],
  });
  k.add(wobble(new ConeGeometry(6, 8, 7, 2), 1, rnd), C.cliffDark, { p: [3.5, 5, 1.5] });
  const cy = 15.4;
  k.add(new BoxGeometry(6.5, 1.8, 3.6), '#e3cfa8', { p: [-1, cy, -1.5] });
  for (const [dx, dz] of [
    [-3.3, -1.8],
    [3.3, -1.8],
    [-3.3, 1.8],
    [3.3, 1.8],
  ] as const) {
    k.add(new CylinderGeometry(0.65, 0.75, 2.8, 8), '#dcc49a', {
      p: [-1 + dx, cy + 0.5, -1.5 + dz],
    });
  }
  for (let i = 0; i < 6; i++) {
    k.add(new BoxGeometry(0.5, 0.45, 0.3), '#e3cfa8', { p: [-3.5 + i * 1, cy + 1.1, 0.25] });
  }
  flag(k, -1, cy + 0.9, -1.5, 2.6, C.purple);
  parts.glows.add([-1, cy + 0.6, 0.4], C.bulb, 4);
  // Casitas blancas al pie, hacia el puerto, y pinos por la ladera de atrás.
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * 0.12 + (i / 6) * Math.PI * 0.62;
    const x = Math.cos(a) * R * 0.74;
    const z = Math.sin(a) * R * 0.74;
    house(k, x, h(x, z) - 0.1, z, 1.3 + rnd() * 0.5, 1.4, 1.1 + rnd() * 0.8, -a + Math.PI / 2, rnd);
    if (rnd() > 0.5) parts.glows.add([x, h(x, z) + 1, z + 0.8], C.bulb, 1.3);
  }
  for (let i = 0; i < 6; i++) {
    const a = Math.PI + (i / 5) * Math.PI * 0.9;
    pine(k, Math.cos(a) * 7.5, 4 + rnd() * 2, Math.sin(a) * 6.5 - 1.5, 2.2 + rnd());
  }
  return {
    parts,
    animated: [],
    heightAt: h,
    labelY: cy + 4,
    solids: [...DECOR_SOLIDS.castillo],
    // La orilla de cuando era decorado: el bajío de su círculo, 9 de ancho.
    shores: [{ dx: 0, dz: 0, r: R, w: 9 }],
  };
}

/**
 * La Explanada de España de Alicante (plan 023, T252): la composición a mano
 * del decorado `explanada`, con la silueta de su modelo de Blender
 * (`tools/blender/islas/explanada.py`, que la sustituye de cerca): la isla
 * alargada, el paseo con el mosaico de olas rojo, crema y negro, dos hileras
 * de palmeras con bancos y farolas, la balaustrada y el muelle al frente, la
 * Concha en el extremo este y las fachadas de la ciudad por detrás. Sin
 * rótulo. Mismas medidas que el modelo (escala 1).
 */
function explanada(rnd: () => number): DecorBuild {
  const L = DECOR_SIZE.explanadaL;
  const W = DECOR_SIZE.explanadaW;
  const parts = newParts();
  const k = parts.lit;
  // Isla alargada: el terreno de siempre, estirado en x.
  const ground = newParts();
  terrain(ground.lit, W, sandy(0.9, C.sand), rnd, 28);
  k.addPainted(ground.lit.build(), { s: [L / W, 1, 1] });
  const top = EXPLANADA.top;
  const pave = top + 0.12;
  const heightAt = (x: number, z: number) => (Math.hypot(x / (L / W), z) < W * 0.8 ? top : 0);
  const { x0, x1, walkX1, sideHalf, rowZ, wallZ } = EXPLANADA;
  const cx = (x0 + x1) / 2;
  const len = x1 - x0;
  // La losa crema del paseo con su bordillo, y el mosaico de olas (dos franjas rojas y dos negras).
  k.add(new BoxGeometry(len + 0.3, 0.06, sideHalf * 2 + 0.3), C.wall, { p: [cx, top + 0.03, 0] });
  k.add(new BoxGeometry(len, 0.08, sideHalf * 2), '#efe3c9', { p: [cx, pave - 0.04, 0] });
  for (const [z0, color] of [
    [-1.05, '#b8332b'],
    [-0.35, '#2b2327'],
    [0.35, '#b8332b'],
    [1.05, '#2b2327'],
  ] as const) {
    k.add(waveBand(x0 + 0.1, walkX1 - 0.1, 0.3), color, { p: [0, pave + 0.012, z0] });
  }
  // El muro de mar con la balaustrada, la escalera y el muelle.
  k.add(new BoxGeometry(len + 0.3, pave - 0.15, 0.52), '#d9cdb4', {
    p: [cx, (pave + 0.15) / 2, wallZ],
  });
  k.add(new BoxGeometry(len + 0.3, 0.1, 0.34), '#d9cdb4', { p: [cx, pave + 0.78, wallZ] });
  for (let x = x0; x <= x1; x += 1.24) {
    if (Math.abs(x + 2) < 1) continue;
    k.add(new CylinderGeometry(0.06, 0.07, 0.62, 5), '#d9cdb4', { p: [x, pave + 0.47, wallZ] });
  }
  for (let i = 0; i < 4; i++) {
    k.add(new BoxGeometry(1.8, 0.12, 0.28), '#d9cdb4', {
      p: [-2, pave - 0.12 - i * 0.14, wallZ + 0.35 + i * 0.26],
    });
  }
  pier(k, -2, wallZ + 0.1, Math.PI / 2, 2.4, 0.42);
  // Dos hileras de palmeras en sus alcorques; entre ellas, farolas de globos y bancos.
  const xs = Array.from({ length: 9 }, (_, i) => -13.6 + i * 3);
  for (const sz of [-1, 1]) {
    const z = sz * rowZ;
    for (const x of xs) {
      k.add(new CylinderGeometry(0.46, 0.46, 0.16, 10), '#b9a58a', { p: [x, pave + 0.06, z] });
      palm(k, x + (rnd() - 0.5) * 0.2, pave + 0.08, z, 3.3 + rnd() * 0.8, rnd);
    }
    xs.slice(0, -1).forEach((x, i) => {
      const mid = x + 1.5;
      if ((i + (sz > 0 ? 0 : 1)) % 2 === 0) {
        k.add(new CylinderGeometry(0.04, 0.065, EXPLANADA.lampH, 5), '#2e2a2c', {
          p: [mid, pave + EXPLANADA.lampH / 2, z],
        });
        k.add(new SphereGeometry(0.2, 7, 5), C.bulb, { p: [mid, pave + EXPLANADA.lampH + 0.3, z] });
        parts.glows.add([mid, pave + EXPLANADA.lampH + 0.3, z], C.bulb, 2);
      } else {
        k.add(new BoxGeometry(1.5, 0.05, 0.4), C.wood, { p: [mid, pave + 0.42, z] });
        k.add(new BoxGeometry(1.5, 0.36, 0.05), C.wood, { p: [mid, pave + 0.7, z - sz * 0.22] });
      }
    });
  }
  // La Concha: tarima redonda y media cúpula abierta hacia el paseo (−x).
  const cc = EXPLANADA.concha;
  k.add(new CylinderGeometry(cc.r + 0.5, cc.r + 0.5, 0.32, 16), C.rockLight, {
    p: [cc.x, pave + 0.06, cc.z],
  });
  k.add(new SphereGeometry(cc.r, 12, 6, Math.PI / 2, Math.PI, 0, Math.PI / 2), '#f2e6d0', {
    p: [cc.x, pave + 0.3, cc.z],
    s: [1, cc.h / cc.r, 1],
  });
  // Las fachadas de la ciudad por detrás, con cornisa y ventanas (algunas encendidas de noche).
  const fz = -(EXPLANADA.facadeZ0 + EXPLANADA.facadeD / 2);
  for (const [x, hw, h, color, floors] of EXPLANADA.facades) {
    const base = 0.35;
    k.add(new BoxGeometry(hw * 2, h, EXPLANADA.facadeD), color, { p: [x, base + h / 2, fz] });
    k.add(new BoxGeometry(hw * 2 + 0.16, 0.1, EXPLANADA.facadeD + 0.16), '#d9cdb4', {
      p: [x, base + h + 0.05, fz],
    });
    const fh = h / floors;
    const n = hw > 1.8 ? 3 : 2;
    for (let fl = 0; fl < floors; fl++) {
      for (let j = 0; j < n; j++) {
        const wx = x + (j - (n - 1) / 2) * ((hw * 1.5) / n);
        const y = base + fh * (fl + 0.55);
        const lit = fl > 0 && rnd() < 0.45;
        k.add(new BoxGeometry(0.34, 0.52, 0.05), lit ? C.bulb : '#3b4b63', {
          p: [wx, y, -EXPLANADA.facadeZ0 + 0.02],
        });
        if (lit) parts.glows.add([wx, y, -EXPLANADA.facadeZ0 + 0.3], C.bulb, 1.2);
      }
    }
  }
  return { parts, animated: [], heightAt, labelY: 6, solids: [...DECOR_SOLIDS.explanada] };
}

/**
 * Una franja del mosaico de olas: un plano a ras del paseo cuyo borde sigue
 * una senoide a lo largo de x (`EXPLANADA.wave`), de x0 a x1 y semiancho hw.
 */
function waveBand(x0: number, x1: number, hw: number): BufferGeometry {
  const n = Math.round((x1 - x0) / 0.35);
  const g = new PlaneGeometry(x1 - x0, hw * 2, n, 1);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, 0);
  const pos = g.attributes.position as BufferAttribute;
  const { len, amp } = EXPLANADA.wave;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, pos.getZ(i) + amp * Math.sin((2 * Math.PI * x) / len));
  }
  pos.needsUpdate = true;
  return g;
}

/** El islote de la cueva del secreto (en el 2D, un hueco en el acantilado oeste). */
function cueva(rnd: () => number): DecorBuild {
  const R = DECOR_SIZE.cueva;
  const parts = newParts();
  const k = parts.lit;
  const h = terrain(k, R, rocky(3.2), rnd, 16);
  crag(k, -0.8, -0.6, 1.8, rnd);
  // La boca, mirando al este (+x), por donde se asoma el barco.
  k.add(new SphereGeometry(1.5, 10, 6, 0, Math.PI), '#231c1a', {
    p: [R * 0.72, 0.2, 0],
    r: [0, -Math.PI / 2, 0],
    s: [0.6, 1.1, 1],
  });
  return { parts, animated: [], heightAt: h, labelY: 5, solids: [...DECOR_SOLIDS.cueva] };
}

export function buildDecor(kind: DecorKind): DecorBuild {
  const rnd = rng(seedOf(`decorado-${kind}`));
  return kind === 'castillo' ? castillo(rnd) : kind === 'explanada' ? explanada(rnd) : cueva(rnd);
}
