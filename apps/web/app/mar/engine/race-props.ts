import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { litMaterial } from './characters';
import { textTexture } from './islands';
import { Kit } from './kit';
import { C } from './palette';
import { buoy } from './props';

/**
 * Las piezas del circuito cerrado de Los Rápidos en el mar 3D (T61, T73), en
 * unidades de escena: las boias numeradas que hay que pasar (con su aro en el
 * agua, que se enciende en la que toca), los impulsos (flechas en el agua),
 * las rampas de salto (una plataforma con flechas hacia arriba) y el barco
 * fantasma de la mejor carrera. Sin lógica de carrera: la marca `Mar3D`
 * según lo que le dice la web.
 */

export interface RaceBuoy {
  group: Group;
  /** La boia que toca pasar: aro amarillo y número encendido. */
  setNext(on: boolean): void;
  update(t: number): void;
}

const DIM_RING = '#fff4e2';
const NEXT_RING = '#ffd23f';

/** Una boia de carrera con su número, de alto ~4 y con un aro de radio `reach` en el agua. */
export function raceBuoy(n: number, reach: number): RaceBuoy {
  const group = new Group();
  const body = new Group();
  group.add(body);
  const k = new Kit();
  // Flotador ancho, cuerpo a franjas naranja y blanco, y un remate.
  k.add(new CylinderGeometry(0.85, 1.0, 0.6, 12), C.purple, { p: [0, 0.15, 0] });
  for (let i = 0; i < 4; i++) {
    k.add(
      new CylinderGeometry(0.5 - i * 0.06, 0.56 - i * 0.06, 0.6, 12),
      i % 2 ? C.white : C.orange,
      {
        p: [0, 0.75 + i * 0.6, 0],
      },
    );
  }
  k.add(new ConeGeometry(0.3, 0.5, 10), C.orange, { p: [0, 3.1, 0] });
  body.add(new Mesh(k.build(), litMaterial()));
  // El número, en una placa que se ve desde cualquier lado.
  const plate = textTexture([String(n)], { w: 128, h: 128, bg: C.purple, fg: '#fff4e2' });
  const numberMat = new MeshBasicMaterial({ map: plate });
  const sign = new Mesh(new BoxGeometry(1.1, 1.1, 1.1), numberMat);
  sign.position.y = 3.9;
  body.add(sign);
  // Aro en el agua: hasta dónde cuenta pasar.
  const ringMat = new MeshBasicMaterial({
    color: DIM_RING,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const ring = new Mesh(new TorusGeometry(reach, 0.12, 6, 48), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);
  // Luz de la que toca.
  const lampMat = new MeshBasicMaterial({ color: NEXT_RING });
  const lamp = new Mesh(new SphereGeometry(0.28, 10, 8), lampMat);
  lamp.position.y = 4.75;
  lamp.visible = false;
  body.add(lamp);
  let next = false;
  return {
    group,
    setNext(on) {
      next = on;
      ringMat.color.set(on ? NEXT_RING : DIM_RING);
      ringMat.opacity = on ? 0.85 : 0.35;
      lamp.visible = on;
    },
    update(t) {
      body.position.y = Math.sin(t * 1.7 + n) * 0.1;
      body.rotation.z = Math.sin(t * 1.3 + n) * 0.04;
      const s = next ? 1 + Math.sin(t * 5) * 0.06 : 1;
      ring.scale.set(s, s, 1);
    },
  };
}

export interface BoostPad {
  group: Group;
  update(t: number): void;
}

/** Un impulso: tres flechas en el agua que apuntan hacia `heading` (rad, plano del mar). */
export function boostPad(radius: number, heading: number): BoostPad {
  const group = new Group();
  const shape = new Shape();
  const w = radius * 0.42;
  const d = radius * 0.32;
  shape.moveTo(-d, w);
  shape.lineTo(0, 0);
  shape.lineTo(-d, -w);
  shape.lineTo(-d + 0.45, -w);
  shape.lineTo(0.45, 0);
  shape.lineTo(-d + 0.45, w);
  shape.closePath();
  const geo = new ShapeGeometry(shape);
  const mats: MeshBasicMaterial[] = [];
  for (let i = 0; i < 3; i++) {
    const m = new MeshBasicMaterial({
      color: '#3df2ff',
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: DoubleSide,
    });
    const arrow = new Mesh(geo, m);
    arrow.rotation.x = -Math.PI / 2;
    arrow.position.set((i - 1) * radius * 0.45, 0.07, 0);
    group.add(arrow);
    mats.push(m);
  }
  const base = new MeshBasicMaterial({
    color: '#1fb6d9',
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });
  const disc = new Mesh(new CylinderGeometry(radius, radius, 0.02, 24), base);
  disc.position.y = 0.04;
  group.add(disc);
  group.rotation.y = -heading;
  return {
    group,
    update(t) {
      // Las flechas se encienden una tras otra, hacia delante.
      mats.forEach((m, i) => (m.opacity = 0.35 + 0.6 * Math.max(0, Math.sin(t * 6 - i * 1.2))));
    },
  };
}

export interface JumpRamp {
  group: Group;
  update(t: number): void;
}

/** Inclinación de la rampa (rad). */
const RAMP_SLOPE = 0.26;

/**
 * Una rampa de salto (T73): una plataforma inclinada que sube hacia `heading`
 * (rad, plano del mar), con flechas amarillas hacia arriba que se encienden
 * una tras otra, sobre dos flotadores. Mide `radius` de largo a cada lado del
 * centro.
 */
export function jumpRamp(radius: number, heading: number): JumpRamp {
  const group = new Group();
  const k = new Kit();
  const len = radius * 2;
  const width = radius * 1.3;
  const rise = Math.sin(RAMP_SLOPE) * len;
  // Tablero: baja hasta el agua por detrás y sube por delante.
  k.add(new BoxGeometry(len, 0.18, width), C.orange, {
    p: [0, rise / 2, 0],
    r: [0, 0, RAMP_SLOPE],
  });
  // Bordes blancos y dos flotadores morados debajo.
  for (const s of [-1, 1]) {
    k.add(new BoxGeometry(len, 0.3, 0.16), C.white, {
      p: [0, rise / 2 + 0.12, (s * width) / 2],
      r: [0, 0, RAMP_SLOPE],
    });
    k.add(new CylinderGeometry(0.35, 0.35, len * 0.9, 10), C.purple, {
      p: [0, 0.1, (s * width) / 3],
      r: [0, 0, Math.PI / 2],
    });
  }
  // Puntal bajo el borde alto.
  k.add(new BoxGeometry(0.3, rise, width * 0.8), C.purple, { p: [len / 2 - 0.2, rise / 2, 0] });
  group.add(new Mesh(k.build(), litMaterial()));
  // Las flechas «hacia arriba» sobre el tablero, apuntando cuesta arriba.
  const shape = new Shape();
  const w = width * 0.32;
  const d = radius * 0.3;
  shape.moveTo(-d, w);
  shape.lineTo(0, 0);
  shape.lineTo(-d, -w);
  shape.lineTo(-d + 0.4, -w);
  shape.lineTo(0.4, 0);
  shape.lineTo(-d + 0.4, w);
  shape.closePath();
  const geo = new ShapeGeometry(shape);
  const deck = new Group();
  deck.position.y = rise / 2 + 0.1;
  deck.rotation.z = RAMP_SLOPE;
  group.add(deck);
  const mats: MeshBasicMaterial[] = [];
  for (let i = 0; i < 3; i++) {
    const m = new MeshBasicMaterial({
      color: '#ffd23f',
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: DoubleSide,
    });
    const arrow = new Mesh(geo, m);
    arrow.rotation.x = -Math.PI / 2;
    arrow.position.set((i - 1) * radius * 0.55, 0.02, 0);
    deck.add(arrow);
    mats.push(m);
  }
  group.rotation.y = -heading;
  return {
    group,
    update(t) {
      mats.forEach((m, i) => (m.opacity = 0.4 + 0.6 * Math.max(0, Math.sin(t * 5 - i * 1.1))));
    },
  };
}

/** Los colores de las boyitas de la carretera, los mismos a los dos lados (T96). muestra */
export const ROAD_BUOY = { body: C.orange, band: C.white } as const;

/**
 * Las boyitas que marcan la carretera mientras dura la carrera (T76): naranjas
 * con franja blanca a la derecha y a la izquierda de la marcha (T96; antes,
 * rojas a un lado y blancas al otro). `right` y `left` en unidades de escena
 * (x, z). Un solo grupo: se quita entero al acabar.
 */
export function roadMarkers(right: [number, number][], left: [number, number][]): Group {
  const k = new Kit();
  // Naranjas a los dos lados (T96): el borde se lee igual a babor y a estribor.
  for (const [x, z] of [...right, ...left]) {
    buoy(k, x, z, ROAD_BUOY.body, ROAD_BUOY.band, 1.3);
  }
  const g = new Group();
  g.add(new Mesh(k.build(), litMaterial()));
  return g;
}

/** El barco fantasma: la silueta del barco, translúcida y azulada. Proa hacia +x, eslora `length`. */
export function ghostBoat(length: number): Group {
  const k = new Kit();
  const s = length / 3.9;
  k.add(new BoxGeometry(2.6, 0.55, 1.2), '#cfe8ff', { p: [-0.2, 0.25, 0] });
  k.add(new ConeGeometry(0.6, 1.2, 4), '#cfe8ff', {
    p: [1.6, 0.25, 0],
    r: [Math.PI / 4, 0, -Math.PI / 2],
    s: [1, 1, 0.9],
  });
  k.add(new CylinderGeometry(0.06, 0.07, 2.6, 6), '#ffffff', { p: [0.3, 1.8, 0] });
  k.add(new ConeGeometry(0.9, 2.2, 3), '#ffffff', {
    p: [-0.1, 1.9, 0],
    r: [0, 0.6, 0],
    s: [0.7, 1, 0.12],
  });
  const mat = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    // Se ve bien en carrera (T73) sin confundirse con el barco de verdad.
    opacity: 0.6,
    depthWrite: false,
  });
  const g = new Group();
  const mesh = new Mesh(k.build(), mat);
  mesh.scale.setScalar(s);
  g.add(mesh);
  g.visible = false;
  return g;
}
