import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three';

/**
 * La ola grande de `/mar` (plan 029 T269), dibujada: una cresta de baja
 * poligonación sobre el agua que ya hay, más oscura y verdosa que el mar al
 * pie, clara arriba y con un labio de espuma blanca dentada que se inclina
 * hacia el barco, con una cara hacia el barco (la rampa) y una caída corta
 * por detrás. Sin texturas ni shaders propios (colores por vértice, sin luces): una malla unitaria que se escala a lo largo, a lo alto y a lo
 * ancho. Se curva con el planeta como el resto
 * de la escena (`curveTree`). Medidas en unidades de escena.
 */

/** Altura de la cresta (escena): más alta que el barco es largo, para que se lea como «ola grande». muestra */
export const SWELL_HEIGHT = 3.4;
/** Medio ancho, de la cara hacia el barco a la caída de detrás (escena). muestra */
export const SWELL_WIDTH = 6;

/** s que tarda en hundirse una ola que se fue (cruzada o pasada), en vez de desaparecer de golpe. muestra */
export const SWELL_SETTLE_S = 0.6;

const ALONG = 40;
const ACROSS = 18;

/** Colores de la ola: más oscura y verdosa que el mar (contraste), clara arriba, espuma blanca. */
const TROUGH = new Color('#08345a');
const FACE = new Color('#0b6f8e');
const GLASS = new Color('#4fdbe6');
const FOAM = new Color('#ffffff');
const BACK = new Color('#0f4a74');

/** Perfil de la cresta a lo ancho (u en -1…1; +1 mira al barco): cara suave delante, caída corta detrás. */
export function swellProfile(u: number): number {
  const k = u >= 0 ? 1.9 : 3.2;
  return Math.exp(-((u * k) ** 2));
}

/** Contorno a lo largo de la cresta (s en -1…1): sube de las puntas hacia el centro. */
export function swellTaper(s: number): number {
  return Math.max(0, 1 - s * s) ** 0.6;
}

/** Borde de la espuma (0…1 de altura) a lo largo de la cresta: dentado, de dibujo animado. */
function foamLine(s: number): number {
  return 0.84 + 0.06 * Math.sin(s * 23) + 0.035 * Math.sin(s * 57 + 1.3);
}

function buildGeometry(): BufferGeometry {
  const n = (ALONG + 1) * (ACROSS + 1);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 4);
  const idx: number[] = [];
  const c = new Color();
  for (let i = 0; i <= ALONG; i++) {
    const s = (i / ALONG) * 2 - 1;
    const line = foamLine(s);
    for (let j = 0; j <= ACROSS; j++) {
      const u = (j / ACROSS) * 2 - 1;
      const top = swellTaper(s);
      const h = swellProfile(u) * top;
      // El labio se inclina hacia el barco: la ola «rompe» hacia él.
      const lean = 0.28 * h ** 3;
      const v = i * (ACROSS + 1) + j;
      pos.set([s, h, u + lean], v * 3);
      const rel = top > 0 ? h / top : 0;
      if (u >= 0) {
        // Cara hacia el barco: seno oscuro al pie, agua verdosa, cristal claro y espuma arriba.
        c.copy(TROUGH).lerp(FACE, Math.min(1, rel * 2));
        c.lerp(GLASS, Math.min(1, Math.max(0, (rel - 0.45) / 0.35)));
        // Vetas a lo largo: la cara no es una pared lisa.
        c.multiplyScalar(1 + 0.08 * Math.sin(s * 31 + u * 9));
      } else {
        c.copy(BACK).lerp(FACE, Math.min(1, Math.max(0, (rel - 0.5) / 0.4)));
      }
      if (rel > line) c.copy(FOAM);
      // Espuma también a los pies de la cara: el contorno se ve sobre el mar.
      else if (u > 0.6 && u < 0.72 && top > 0.25) c.lerp(FOAM, 0.6);
      // Opaca dentro; se funde con el mar en las puntas y en el borde de atrás.
      const edge = Math.min(1, (1 - Math.abs(s)) * 6, (1 - Math.abs(u)) * 5);
      col.set([c.r, c.g, c.b, Math.max(0, Math.min(1, edge))], v * 4);
    }
  }
  for (let i = 0; i < ALONG; i++) {
    for (let j = 0; j < ACROSS; j++) {
      const a = i * (ACROSS + 1) + j;
      const b = a + 1;
      const d = a + ACROSS + 1;
      const e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('color', new BufferAttribute(col, 4));
  g.setIndex(idx);
  return g;
}

export class SwellView {
  readonly group = new Group();
  private readonly mesh: Mesh;
  private readonly material: MeshBasicMaterial;
  /** Lo levantada que se pintó la última vez y cuándo (para hundirla al irse). */
  private shown = 0;
  private lastT = 0;

  constructor() {
    // Sin luces: los colores son los de la ola a cualquier hora (la luz del
    // atardecer la volvía rosa y se confundía con la arena).
    this.material = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    this.mesh = new Mesh(buildGeometry(), this.material);
    this.mesh.renderOrder = 3;
    this.group.add(this.mesh);
    this.group.visible = false;
  }

  /**
   * Pone la ola. `x`, `z`: su centro (escena); `facing`: rad de `rotation.y`
   * para que su cara suave mire al barco; `halfLength`: medio largo (escena);
   * `strength` 0…1: lo levantada que está; `t`: s de juego (un vaivén suave).
   */
  place(
    x: number,
    z: number,
    facing: number,
    halfLength: number,
    strength: number,
    t: number,
    reduced: boolean,
  ): void {
    this.shown = strength;
    this.lastT = t;
    this.group.visible = strength > 0.001;
    if (!this.group.visible) return;
    const bob = reduced ? 0 : Math.sin(t * 2.4) * 0.05;
    this.group.position.set(x, -0.1, z);
    this.group.rotation.y = facing;
    this.group.scale.set(halfLength, SWELL_HEIGHT * strength * (1 + bob), SWELL_WIDTH);
    this.material.opacity = Math.min(1, strength * 1.5);
  }

  /** Ya no hay ola (cruzada, pasada o quitada): se hunde en `SWELL_SETTLE_S` s donde estaba. */
  settle(t: number): void {
    if (!this.group.visible) return;
    const dt = Math.max(0, t - this.lastT);
    this.lastT = t;
    this.shown = Math.max(0, this.shown - dt / SWELL_SETTLE_S);
    if (this.shown <= 0.001) {
      this.group.visible = false;
      return;
    }
    this.group.scale.y = SWELL_HEIGHT * this.shown;
    this.material.opacity = Math.min(1, this.shown * 1.5);
  }

  hide(): void {
    this.shown = 0;
    this.group.visible = false;
  }
}
