import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
} from 'three';
import { type IslandBuild, newParts, rocky, sandy, shoreRocks, terrain } from './islands';
import { rng, seedOf, wobble } from './kit';
import { DECOR_SIZE, DECOR_SOLIDS, type DecorKind } from './compact';
import { C } from './palette';
import { crag, flag, house, palm, pine } from './props';

/**
 * El decorado propio del planeta de agua de `/mar` (D-22, REQ-MUN-038): lo
 * que en el 2D es costa aquí son islas en el mar. La Explanada con su mosaico
 * de olas (Alicante) flanquea la salida del puerto, y el islote de la cueva
 * guarda el secreto que en el 2D está en el acantilado oeste. No son lugares
 * del mapa compartido (sin id, sin comportamientos, fuera del runtime): sólo
 * se ven y no se atraviesan. Dónde va cada pieza y sus círculos sólidos están
 * en `compact.ts` (T50: se mueven con el mundo compacto). Unidades de escena.
 * Todo `muestra`.
 *
 * El castillo en su monte se construye aquí igual, pero desde el plan 014
 * (T157) no es decorado: es la isla del minijuego `castillo` del mapa, junto a
 * la Boia 7 (`mar3d.ts` la dibuja con `buildDecor('castillo')`).
 */

export interface DecorBuild extends IslandBuild {
  /** Círculos sólidos, respecto al centro. */
  solids: { dx: number; dz: number; r: number }[];
}

/** El mosaico de olas de la Explanada (rojo, crema y negro), en canvas. */
function mosaicTexture(): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 64;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#f1e2c8';
  g.fillRect(0, 0, 256, 64);
  const band = (y: number, color: string, amp: number) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 4) g.lineTo(x, y + Math.sin((x / 256) * Math.PI * 4) * amp);
    g.lineTo(256, y + 8);
    for (let x = 256; x >= 0; x -= 4) g.lineTo(x, y + 8 + Math.sin((x / 256) * Math.PI * 4) * amp);
    g.closePath();
    g.fill();
  };
  band(8, '#b8332b', 6);
  band(26, '#2b2327', 6);
  band(44, '#b8332b', 6);
  const t = new CanvasTexture(cv);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
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

/** La Explanada: el paseo de las palmeras y el mosaico de olas, como isla alargada. */
function explanada(rnd: () => number): DecorBuild {
  const L = DECOR_SIZE.explanadaL;
  const W = DECOR_SIZE.explanadaW;
  const parts = newParts();
  const k = parts.lit;
  // Isla alargada: el terreno de siempre, estirado en x.
  const ground = newParts();
  terrain(ground.lit, W, sandy(0.9, C.grassDark), rnd, 28);
  k.addPainted(ground.lit.build(), { s: [L / W, 1, 1] });
  const top = 0.9;
  const heightAt = (x: number, z: number) => (Math.hypot(x / (L / W), z) < W * 0.8 ? top : 0);
  // El paseo: una franja de mosaico al sur, mirando al puerto.
  const tex = mosaicTexture();
  tex.repeat.set(9, 1);
  const walk = new Mesh(new PlaneGeometry(L * 1.45, 2.4), new MeshLambertMaterial({ map: tex }));
  walk.rotation.x = -Math.PI / 2;
  walk.position.set(0, top + 0.04, 2.2);
  // Palmeras a los dos lados del paseo y farolas.
  for (let i = 0; i < 9; i++) {
    const x = -L * 0.66 + (i / 8) * L * 1.32;
    palm(k, x + (rnd() - 0.5) * 0.4, top, 3.8, 3 + rnd(), rnd);
    palm(k, x + (rnd() - 0.5) * 0.4, top, 0.6, 3 + rnd(), rnd);
    if (i % 2 === 0) {
      k.add(new CylinderGeometry(0.05, 0.07, 1.8, 5), C.iron, { p: [x + 0.9, top + 0.9, 2.2] });
      k.add(new SphereGeometry(0.16, 6, 5), C.bulb, { p: [x + 0.9, top + 1.85, 2.2] });
      parts.glows.add([x + 0.9, top + 1.85, 2.2], C.bulb, 2);
    }
  }
  // Fachadas blancas detrás.
  for (let x = -L * 0.62; x <= L * 0.62; x += 2.1 + rnd() * 0.6) {
    const hh = 1.6 + rnd() * 2.2;
    house(k, x, top, -1.8 - rnd() * 0.6, 1.9 + rnd() * 0.4, 2, hh, (rnd() - 0.5) * 0.08, rnd);
    if (rnd() > 0.6) parts.glows.add([x, top + hh * 0.6, -0.7], C.bulb, 1.2);
  }
  return { parts, animated: [walk], heightAt, labelY: 6, solids: [...DECOR_SOLIDS.explanada] };
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
