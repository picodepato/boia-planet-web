import type { DefeatStyle, EnemyId, NoteFigure } from '@boia/engine/survivors';
import type { QualityTier } from '@boia/engine/streaming';
import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
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
 * T126 (plan 011) suma los enemigos de la beta 2: la gaviota (vuela sobre
 * las islas, con su sombra), el pirata en su botecito, el pez espada y la
 * medusa (sus trozos, la misma pieza más pequeña); el aro dorado de las
 * élites, la línea de aviso del pez espada en el agua y los disparos de la
 * pistola de agua del pirata.
 *
 * Todo en unidades de escena; cada modelo mira a +x (rumbo 0 del motor), con
 * el agua en y = 0. Nada se crea por fotograma: las piezas viven en
 * `InstancedMesh` del tamaño del tope de la calidad y en piscinas fijas.
 */

// --- Colores ------------------------------------------------------------------

/**
 * Colores de los enemigos: rojo la piraña, naranja con coraza de hierro el
 * cangrejo; blanca y gris la gaviota, rayas rojas y sombrero negro el
 * pirata, azul con espada clara el pez espada y lila la medusa (T126).
 */
export const ENEMY_COLORS = {
  piranha: { body: C.red, back: C.navy, belly: C.yellow, teeth: C.white },
  crab: { shell: C.orange, armour: C.rockLight, rivet: C.iron, claw: C.orangeDeep },
  gull: { body: C.white, wing: '#b4c0d4', tip: '#22232b', beak: C.yellow },
  pirate: {
    hull: C.woodDark,
    rim: C.wood,
    stripe: C.red,
    hat: '#1b1820',
    beard: C.iron,
    pistol: C.yellow,
    tank: '#36c2ff',
  },
  swordfish: { back: '#2a5fa8', belly: '#d9e3ec', sword: '#eef3f6', fin: '#1d3f7a' },
  jellyfish: { bell: '#b38cff', rim: '#8a5ee6', core: '#e3d2ff', spot: C.cream },
} as const;

/** El brillo propio de la medusa (se lee de noche y de lejos). */
export const JELLY_GLOW = '#9d6bff';

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

/**
 * La gaviota aguafiestas (T126): cuerpo blanco, alas grises muy abiertas con
 * puntas negras, pico amarillo y cola corta. Vista desde arriba es una cruz
 * ancha: no se confunde con nada del agua. El cuerpo en y = 0; la pantalla
 * la sube a su altura de vuelo. Envergadura ~4,4. Radio 1 ≈ su radio de choque.
 */
export function gullGeometry(): BufferGeometry {
  const c = ENEMY_COLORS.gull;
  const k = new Kit();
  k.add(new SphereGeometry(0.55, 8, 6), c.body, { s: [1.7, 0.75, 0.75] });
  k.add(new SphereGeometry(0.36, 7, 5), c.body, { p: [0.8, 0.18, 0] });
  // Pico amarillo con la punta naranja.
  k.add(new ConeGeometry(0.12, 0.5, 5), c.beak, { p: [1.25, 0.12, 0], r: [0, 0, -Math.PI / 2] });
  k.add(new SphereGeometry(0.06, 4, 3), C.orange, { p: [1.47, 0.1, 0] });
  for (const s of [-1, 1]) {
    // Alas en dos tramos (algo en V), punta negra.
    k.add(new BoxGeometry(0.75, 0.08, 1.0), c.wing, {
      p: [0.05, 0.12, s * 0.75],
      r: [s * -0.18, 0, 0],
    });
    k.add(new BoxGeometry(0.6, 0.07, 0.8), c.wing, {
      p: [-0.08, 0.3, s * 1.55],
      r: [s * -0.32, s * 0.2, 0],
    });
    k.add(new ConeGeometry(0.3, 0.6, 4), c.tip, {
      p: [-0.18, 0.44, s * 2.15],
      r: [(s * Math.PI) / 2, 0, 0],
      s: [1, 1, 0.25],
    });
    k.add(new SphereGeometry(0.07, 4, 3), EYE, { p: [0.98, 0.3, s * 0.22] });
  }
  // Cola en abanico.
  k.add(new ConeGeometry(0.35, 0.6, 4), c.wing, {
    p: [-1.05, 0.05, 0],
    r: [0, 0, Math.PI / 2],
    s: [1, 1, 0.3],
  });
  return k.build();
}

/**
 * El pirata en su botecito (T126): un bote de madera oscura con la proa
 * hacia +x, el pirata de pie con camiseta a rayas rojas, sombrero de tres
 * picos negro y la pistola de agua amarilla apuntando al frente, y una
 * banderita negra en popa. Alto ~2,4, largo ~2,6. Radio 1 ≈ su radio de choque.
 */
export function pirateGeometry(): BufferGeometry {
  const c = ENEMY_COLORS.pirate;
  const k = new Kit();
  // El bote: casco, borda clara y proa en punta.
  k.add(new BoxGeometry(1.7, 0.5, 1.1), c.hull, { p: [-0.15, 0.15, 0] });
  k.add(new ConeGeometry(0.55, 0.8, 4), c.hull, {
    p: [1.1, 0.15, 0],
    r: [Math.PI / 4, 0, -Math.PI / 2],
    s: [1, 1, 0.65],
  });
  k.add(new BoxGeometry(1.8, 0.08, 1.2), c.rim, { p: [-0.15, 0.42, 0] });
  // El pirata: piernas, camiseta a rayas, cabeza, barba y sombrero.
  k.add(new BoxGeometry(0.4, 0.4, 0.45), C.navy, { p: [-0.1, 0.62, 0] });
  for (let i = 0; i < 4; i++) {
    k.add(new CylinderGeometry(0.3, 0.32, 0.16, 8), i % 2 === 0 ? c.stripe : C.white, {
      p: [-0.1, 0.9 + i * 0.16, 0],
    });
  }
  k.add(new SphereGeometry(0.28, 7, 6), C.skin, { p: [-0.1, 1.72, 0] });
  k.add(new ConeGeometry(0.22, 0.3, 5), c.beard, { p: [0.04, 1.52, 0], r: [0, 0, Math.PI] });
  // Parche en un ojo, el otro abierto.
  k.add(new BoxGeometry(0.06, 0.12, 0.14), c.hat, { p: [0.17, 1.78, 0.1] });
  k.add(new SphereGeometry(0.05, 4, 3), EYE, { p: [0.17, 1.78, -0.1] });
  k.add(new CylinderGeometry(0.62, 0.62, 0.1, 3), c.hat, { p: [-0.1, 1.95, 0] });
  k.add(new ConeGeometry(0.3, 0.4, 6), c.hat, { p: [-0.1, 2.18, 0] });
  // El brazo y la pistola de agua (depósito azul), apuntando al frente.
  k.add(new BoxGeometry(0.6, 0.14, 0.14), C.skin, { p: [0.3, 1.25, 0.28] });
  k.add(new BoxGeometry(0.45, 0.22, 0.18), c.pistol, { p: [0.7, 1.28, 0.28] });
  k.add(new BoxGeometry(0.14, 0.26, 0.14), c.pistol, { p: [0.58, 1.08, 0.28] });
  k.add(new SphereGeometry(0.16, 6, 5), c.tank, { p: [0.62, 1.48, 0.28] });
  k.add(new CylinderGeometry(0.05, 0.05, 0.3, 5), c.pistol, {
    p: [1.05, 1.3, 0.28],
    r: [0, 0, Math.PI / 2],
  });
  // Banderita negra en popa con su calavera (un punto blanco).
  k.add(new CylinderGeometry(0.03, 0.03, 1.5, 4), C.woodDark, { p: [-0.9, 1.1, 0] });
  k.add(new BoxGeometry(0.6, 0.4, 0.04), c.hat, { p: [-1.2, 1.65, 0] });
  k.add(new SphereGeometry(0.09, 5, 4), C.white, { p: [-1.2, 1.68, 0.03] });
  return k.build();
}

/**
 * El pez espada (T126): largo y estrecho, lomo azul y vientre plateado, la
 * espada larga al frente, una vela alta en el lomo y la cola en media luna.
 * Largo ~4,6 (unas cuatro veces su ancho): la silueta más larga del mar.
 * Radio 1 ≈ su radio de choque.
 */
export function swordfishGeometry(): BufferGeometry {
  const c = ENEMY_COLORS.swordfish;
  const k = new Kit();
  k.add(new SphereGeometry(0.6, 9, 6), c.back, { p: [0, 0.3, 0], s: [2.1, 0.8, 0.75] });
  k.add(new SphereGeometry(0.5, 8, 5), c.belly, { p: [0.1, 0.12, 0], s: [2.2, 0.6, 0.75] });
  // La espada.
  k.add(new ConeGeometry(0.11, 1.9, 5), c.sword, { p: [2.15, 0.36, 0], r: [0, 0, -Math.PI / 2] });
  // La vela del lomo (alta, se ve desde lejos) y las aletas.
  k.add(new ConeGeometry(0.55, 1.1, 3), c.fin, {
    p: [0.1, 1.1, 0],
    r: [0, 0, 0.35],
    s: [1.4, 1, 0.2],
  });
  for (const s of [-1, 1]) {
    k.add(new ConeGeometry(0.2, 0.7, 3), c.fin, {
      p: [0.4, 0.05, s * 0.45],
      r: [s * 1.2, 0, 0.6],
      s: [1, 1, 0.3],
    });
    // Cola en media luna.
    k.add(new ConeGeometry(0.22, 0.9, 4), c.fin, {
      p: [-1.55, 0.3 + s * 0.38, 0],
      r: [0, 0, Math.PI / 2 + s * 0.85],
      s: [1, 1, 0.3],
    });
    k.add(new SphereGeometry(0.12, 5, 4), C.white, { p: [0.95, 0.48, s * 0.28] });
    k.add(new SphereGeometry(0.07, 4, 3), EYE, { p: [1.02, 0.49, s * 0.32] });
  }
  return k.build();
}

/**
 * La medusa (T126): una campana lila que asoma del agua con lunares claros,
 * un borde ondulado y tentáculos cortos que flotan detrás. Brilla un poco
 * (`JELLY_GLOW`). Ancho ~2,6, alto ~1,1. Sus trozos usan la misma pieza, más
 * pequeños (`scale` del enemigo). Radio 1 ≈ su radio de choque.
 */
export function jellyfishGeometry(): BufferGeometry {
  const c = ENEMY_COLORS.jellyfish;
  const k = new Kit();
  k.add(new SphereGeometry(0.95, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), c.bell, {
    p: [0, 0.1, 0],
    s: [1, 1.05, 1],
  });
  k.add(new TorusGeometry(0.92, 0.12, 4, 14), c.rim, { p: [0, 0.12, 0], r: [Math.PI / 2, 0, 0] });
  k.add(new SphereGeometry(0.4, 7, 5), c.core, { p: [0, 0.6, 0], s: [1, 0.8, 1] });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    k.add(new SphereGeometry(0.13, 5, 4), c.spot, {
      p: [Math.cos(a) * 0.62, 0.72, Math.sin(a) * 0.62],
    });
  }
  // Tentáculos sobre el agua, hacia atrás y a los lados (avanza hacia +x).
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * 0.55 + (i / 5) * Math.PI * 0.9;
    k.add(new ConeGeometry(0.1, 1.1, 4), c.rim, {
      p: [Math.cos(a) * 1.25, 0.06, Math.sin(a) * 1.25],
      r: [0, -a, Math.PI / 2],
    });
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
  /** Vuela: altura (escena) sobre el suelo que tiene debajo (agua o isla). */
  fly?: number;
  /** Late (la campana de la medusa): cuánto se estira en alto, sin movimiento reducido. */
  pulse?: number;
  /** Brillo propio (`emissive`) del material. */
  glow?: string;
}

/**
 * El modelo de cada enemigo; los que lleguen después usan
 * `genericEnemyGeometry`. La gaviota vuela por encima de las islas (T126).
 */
export const ENEMY_MODELS: Readonly<Partial<Record<EnemyId, EnemyModel>>> = {
  piranha: { build: piranhaGeometry, scale: 1.6, bob: 0.08 },
  crab: { build: crabGeometry, scale: 1.2, bob: 0.03 },
  gull: { build: gullGeometry, scale: 1.1, bob: 0.25, fly: 3.2 },
  pirate: { build: pirateGeometry, scale: 1.2, bob: 0.06 },
  swordfish: { build: swordfishGeometry, scale: 1.2, bob: 0.05 },
  jellyfish: { build: jellyfishGeometry, scale: 1.25, bob: 0.04, pulse: 0.12, glow: JELLY_GLOW },
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

/** El material de un enemigo: el de las piezas, con su brillo si lo tiene (la medusa). */
export function enemyMaterial(model: EnemyModel): MeshLambertMaterial {
  const m = litMaterial();
  if (model.glow) {
    m.emissive = new Color(model.glow);
    m.emissiveIntensity = 0.3;
  }
  return m;
}

// --- Disparos, élites, avisos y sombras (T126) -----------------------------------------

/** Rosa de peligro de los disparos enemigos (la bola del barco es azul clara). */
export const ENEMY_SHOT_COLOR = C.pink;

/**
 * El disparo de la pistola de agua del pirata: un chorro rosa alargado con
 * el centro claro y una estela, mirando a +x. Radio 1. Se distingue de la
 * bola del barco por el color y la forma de chorro.
 */
export function enemyShotGeometry(): BufferGeometry {
  const k = new Kit();
  k.add(new IcosahedronGeometry(1, 1), ENEMY_SHOT_COLOR, { s: [1.5, 0.85, 0.85] });
  k.add(new IcosahedronGeometry(0.45, 0), C.white, { p: [0.55, 0.3, 0] });
  k.add(new ConeGeometry(0.6, 1.8, 6), '#ff9fc0', { p: [-1.5, 0, 0], r: [0, 0, Math.PI / 2] });
  return k.build();
}

export function enemyShotMaterial(): MeshLambertMaterial {
  const m = litMaterial();
  m.emissive = new Color(ENEMY_SHOT_COLOR);
  m.emissiveIntensity = 0.45;
  return m;
}

/** Tamaño del disparo enemigo sobre su radio, y su mínimo (escena). */
export const SHOT_SCALE = 1.4;
export const SHOT_MIN = 0.3;

/** Dorado de las élites. */
export const ELITE_COLOR = C.gold;

/**
 * El brillo de una élite: un aro dorado plano alrededor del enemigo (a su
 * altura: en el agua o, la gaviota, en el aire). Radio exterior 1.
 */
export function eliteHaloGeometry(): BufferGeometry {
  const g = new RingGeometry(0.72, 1, 20);
  g.rotateX(-Math.PI / 2);
  return g;
}

export function eliteHaloMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: ELITE_COLOR,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: DoubleSide,
  });
}

/** Tamaño del aro sobre el tamaño del enemigo, y cuánto late (sin movimiento reducido). */
export const HALO_SCALE = 1.35;
export const HALO_PULSE = 0.12;

/** Colores de la línea de aviso del pez espada: el tramo entero y lo que ya se ha llenado. */
export const WARNING_COLORS = { track: '#7a1d24', fill: '#ff4a2e' } as const;

/**
 * La línea de aviso de una embestida: una franja plana sobre el agua que va
 * de x = 0 a x = 1 (ancho 1, centrada en z) con la punta en flecha; la
 * pantalla la estira al largo de la embestida. Cada aviso pinta dos: el
 * tramo entero, oscuro, y encima el que se llena con el progreso, vivo.
 */
export function warningLineGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  // Franja de 0 a 0,9 y punta de 0,9 a 1 (en el plano y = 0, de cara arriba).
  const v = [
    0, 0, -0.5, 0.9, 0, 0.5, 0.9, 0, -0.5, 0, 0, -0.5, 0, 0, 0.5, 0.9, 0, 0.5, 0.9, 0, -0.8, 0.9, 0,
    0.8, 1, 0, 0,
  ];
  g.setAttribute('position', new BufferAttribute(new Float32Array(v), 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function warningLineMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: DoubleSide,
  });
}

/** Ancho de la línea de aviso sobre el diámetro del enemigo. */
export const WARNING_WIDTH = 0.9;

/** La sombra de lo que vuela: un disco oscuro en el suelo. Radio 1. */
export function shadowGeometry(): BufferGeometry {
  const g = new CircleGeometry(1, 12);
  g.rotateX(-Math.PI / 2);
  return g;
}

export function shadowMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: '#0b1a2c',
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
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
  /** Altura (escena) donde cae: 0 en el agua; la gaviota, en el aire. */
  y: number;
  z: number;
  heading: number;
  size: number;
  start: number;
}

function slots(n: number): Slot[] {
  const out: Slot[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ on: false, type: 0, x: 0, y: 0, z: 0, heading: 0, size: 1, start: 0 });
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

  spawn(x: number, z: number, size: number, now: number, y = 0): void {
    const s = this.pool[this.next]!;
    this.next = (this.next + 1) % this.pool.length;
    s.on = true;
    s.x = x;
    s.y = y;
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
          s.y + 0.4 + easeOut(k) * s.size * 0.8,
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

  /** Una derrota de la pieza `type`; `y`: la altura donde cae (lo que vuela, cae al agua). */
  spawn(
    type: number,
    x: number,
    z: number,
    heading: number,
    size: number,
    now: number,
    y = 0,
  ): void {
    const s = this.pool[this.next]!;
    this.next = (this.next + 1) % this.pool.length;
    s.on = true;
    s.type = type;
    s.x = x;
    s.y = y;
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
        // Saltito con la nariz hacia arriba (lo que vuela, cae desde su altura).
        const h = k / hopEnd;
        y = s.y * (1 - h) + Math.sin(h * Math.PI) * s.size * 0.9;
        pitch = 0.6 * (1 - h) - 0.9 * h;
      } else {
        // Se hunde de cabeza.
        const d = (k - hopEnd) / (1 - hopEnd);
        y = (plan.hop ? 0 : s.y * (1 - Math.min(1, d * 2))) - d * s.size * 1.8;
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

// --- El Barco Pirata Fantasma (T140) ------------------------------------------------

/**
 * Colores del Barco Pirata Fantasma: casco azul noche desteñido, velas
 * hechas jirones de un celeste pálido, farol de popa que brilla y bandera
 * negra. Los piratas que llama son el modelo del pirata teñido de ese celeste.
 */
export const GHOST_COLORS = {
  hull: '#2b3650',
  rim: '#5d7392',
  deck: '#3c4a66',
  mast: '#1c2436',
  sail: '#cfe8ff',
  sailTorn: '#9fc8ea',
  flag: '#0f131c',
  lantern: '#9bf3ff',
  skull: C.white,
  /** Brillo propio: se lee de noche y de lejos, en los dos modos. */
  glow: '#5fd9ff',
  /** Tinte de los piratas fantasma (multiplica el color del modelo). */
  tint: '#a6dcff',
} as const;

/** Opacidad fija de cada material translúcido (una por material, sin animar: T128). */
export const GHOST_OPACITY = 0.38;
export const GHOST_PIRATE_OPACITY = 0.55;

/** Tamaño de la pieza sobre su radio de choque. */
export const GHOST_SHIP_SCALE = 1.15;
/** Lo que flota por encima del agua desvanecido (escena; fijo, sin animar). */
export const GHOST_HOVER = 0.35;

/**
 * El Barco Pirata Fantasma: un galeón bajo y largo (~3 de largo, mira a +x)
 * con casco azul noche, dos mástiles con velas rasgadas, castillo de popa con
 * su farol brillante y bandera negra con calavera. Radio 1 ≈ su radio de
 * choque. El mismo modelo sirve sólido y desvanecido: cambia el material.
 */
export function ghostShipGeometry(): BufferGeometry {
  const c = GHOST_COLORS;
  const k = new Kit();
  // Casco: caja larga, proa en punta y popa alta.
  k.add(new BoxGeometry(2.2, 0.55, 0.9), c.hull, { p: [-0.1, 0.2, 0] });
  k.add(new ConeGeometry(0.46, 1, 4), c.hull, {
    p: [1.45, 0.2, 0],
    r: [Math.PI / 4, 0, -Math.PI / 2],
    s: [1, 1, 0.55],
  });
  k.add(new BoxGeometry(0.7, 0.75, 0.86), c.hull, { p: [-1.1, 0.5, 0] });
  k.add(new BoxGeometry(2.3, 0.08, 1), c.rim, { p: [-0.1, 0.5, 0] });
  k.add(new BoxGeometry(0.72, 0.08, 0.95), c.rim, { p: [-1.1, 0.9, 0] });
  k.add(new BoxGeometry(2, 0.05, 0.7), c.deck, { p: [0, 0.53, 0] });
  // Mástiles, vergas y velas rasgadas (dos jirones por vela, de cara a +x).
  for (const [x, h] of [
    [0.45, 1.9],
    [-0.45, 2.2],
  ] as const) {
    k.add(new CylinderGeometry(0.05, 0.07, h, 5), c.mast, { p: [x, 0.5 + h / 2, 0] });
    k.add(new CylinderGeometry(0.035, 0.035, 1.3, 4), c.mast, {
      p: [x, 0.5 + h * 0.8, 0],
      r: [Math.PI / 2, 0, 0],
    });
    k.add(new BoxGeometry(0.04, h * 0.42, 1.15), c.sail, { p: [x + 0.09, 0.5 + h * 0.57, 0] });
    k.add(new BoxGeometry(0.04, h * 0.2, 0.5), c.sailTorn, { p: [x + 0.11, 0.5 + h * 0.3, 0.3] });
    k.add(new BoxGeometry(0.04, h * 0.14, 0.32), c.sailTorn, { p: [x + 0.11, 0.5 + h * 0.3, -0.38] });
  }
  // Bauprés con su vela pequeña, en proa.
  k.add(new CylinderGeometry(0.035, 0.035, 0.9, 4), c.mast, {
    p: [1.6, 0.75, 0],
    r: [0, 0, Math.PI / 2 - 0.35],
  });
  k.add(new BoxGeometry(0.5, 0.35, 0.04), c.sailTorn, { p: [1.35, 0.95, 0], r: [0, 0, -0.5] });
  // Farol de popa (brilla) y bandera negra con calavera en el palo mayor.
  k.add(new CylinderGeometry(0.03, 0.03, 0.5, 4), c.mast, { p: [-1.5, 1.15, 0] });
  k.add(new SphereGeometry(0.14, 6, 5), c.lantern, { p: [-1.5, 1.45, 0] });
  k.add(new BoxGeometry(0.55, 0.36, 0.04), c.flag, { p: [-0.72, 2.75, 0] });
  k.add(new SphereGeometry(0.08, 5, 4), c.skull, { p: [-0.72, 2.78, 0.03] });
  return k.build();
}

/**
 * El material del Fantasma. Sólido: el de las piezas con el brillo celeste
 * (se le puede herir: se ve entero). Desvanecido: translúcido con una
 * opacidad fija y más brillo, sin escribir profundidad (barato y sin
 * parpadeo). Nunca se anima la opacidad.
 */
export function ghostShipMaterial(ghost: boolean): MeshLambertMaterial {
  const m = litMaterial();
  m.emissive = new Color(GHOST_COLORS.glow);
  m.emissiveIntensity = ghost ? 0.55 : 0.2;
  if (ghost) {
    m.transparent = true;
    m.opacity = GHOST_OPACITY;
    m.depthWrite = false;
  }
  return m;
}

/** Los piratas fantasma: el modelo del pirata teñido de celeste, translúcido con opacidad fija. */
export function ghostPirateMaterial(): MeshLambertMaterial {
  const m = litMaterial();
  m.color = new Color(GHOST_COLORS.tint);
  m.emissive = new Color(GHOST_COLORS.glow);
  m.emissiveIntensity = 0.3;
  m.transparent = true;
  m.opacity = GHOST_PIRATE_OPACITY;
  m.depthWrite = false;
  return m;
}

/** Tope de piratas fantasma pintados a la vez (los llama el boss de tres en tres). */
export const GHOST_PIRATE_CAP = 24;
/** Tope de líneas de aviso de boss (andanadas: dos costados por ataque). */
export const BOSS_WARNING_CAP = 8;
/** Ancho mínimo (escena) de una línea de aviso de boss. */
export const BOSS_WARNING_MIN_WIDTH = 0.5;
