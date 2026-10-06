import type { DefenseEnemyView } from '@boia/engine/defense';
import {
  CanvasTexture,
  Color,
  DataTexture,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  type Material,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  RGBAFormat,
  ShaderMaterial,
  type Texture,
  Vector4,
} from 'three';
import { PLANET_PARS, planetUniforms } from './planet';

/**
 * Las barras de vida de los enemigos y los números de daño que flotan en la
 * arena del castillo (plan 015 T170, decisión 11): baratos (una
 * `InstancedMesh` de tope fijo para cada cosa, sin crear nada por fotograma)
 * y con su interruptor en las opciones de la pausa (los dos encendidos al
 * principio y guardados en el dispositivo). La partida no cuenta el daño de
 * cada golpe: se lee de la vida de cada enemigo entre fotogramas. Escena
 * salvo donde se diga. muestra
 */

// --- Las opciones (guardadas en el dispositivo) --------------------------------------

export interface DefenseOverlayPrefs {
  /** Barras de vida encima de los enemigos tocados. */
  bars: boolean;
  /** Números de daño que flotan. */
  numbers: boolean;
}

export const DEFAULT_DEFENSE_OVERLAYS: Readonly<DefenseOverlayPrefs> = { bars: true, numbers: true };

/** La clave en el almacenamiento del dispositivo. */
export const DEFENSE_OVERLAYS_KEY = 'boia:castillo:marcas';

type PrefsStorage = Pick<Storage, 'getItem' | 'setItem'>;

function deviceStorage(): PrefsStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Lo guardado (o lo de siempre: las dos encendidas). */
export function readDefenseOverlays(
  storage: PrefsStorage | null = deviceStorage(),
): DefenseOverlayPrefs {
  try {
    const raw = storage?.getItem(DEFENSE_OVERLAYS_KEY);
    if (!raw) return { ...DEFAULT_DEFENSE_OVERLAYS };
    const v = JSON.parse(raw) as Partial<DefenseOverlayPrefs> | null;
    return {
      bars: typeof v?.bars === 'boolean' ? v.bars : DEFAULT_DEFENSE_OVERLAYS.bars,
      numbers: typeof v?.numbers === 'boolean' ? v.numbers : DEFAULT_DEFENSE_OVERLAYS.numbers,
    };
  } catch {
    return { ...DEFAULT_DEFENSE_OVERLAYS };
  }
}

/** Guarda las opciones en el dispositivo (si se puede). */
export function saveDefenseOverlays(
  prefs: DefenseOverlayPrefs,
  storage: PrefsStorage | null = deviceStorage(),
): void {
  try {
    storage?.setItem(
      DEFENSE_OVERLAYS_KEY,
      JSON.stringify({ bars: prefs.bars, numbers: prefs.numbers }),
    );
  } catch {
    // Sin almacenamiento (modo privado): vale para esta visita.
  }
}

// --- El daño, leído de la vida de cada enemigo ---------------------------------------

/** s como poco entre dos números del mismo enemigo (el fuego y el haz suman en ese rato). muestra */
export const DAMAGE_GAP_S = 0.4;
/** Al desaparecer antes de esta parte del camino, cayó (no llegó a la muralla). */
const REACHED_PROGRESS = 0.985;

interface Tracked {
  hp: number;
  acc: number;
  last: number;
  x: number;
  y: number;
  radius: number;
  progress: number;
  seen: number;
}

/**
 * Cuánto daño se lleva cada enemigo (u de la partida): lo que baja su vida
 * entre fotogramas, juntado en `DAMAGE_GAP_S` (un número por golpe o por
 * rato de fuego, no uno por fotograma). Al caer, el último golpe (la vida
 * que le quedaba). `emit` recibe dónde y cuánto.
 */
export class DamageTracker {
  private readonly map = new Map<number, Tracked>();
  private frame = 0;

  update(
    enemies: readonly DefenseEnemyView[],
    t: number,
    emit: (x: number, y: number, radius: number, amount: number) => void,
  ): void {
    const f = ++this.frame;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]!;
      if (e.dead) continue;
      let k = this.map.get(e.id);
      if (!k) {
        k = { hp: e.hp, acc: 0, last: t, x: e.x, y: e.y, radius: e.radius, progress: e.progress, seen: f };
        this.map.set(e.id, k);
        continue;
      }
      const d = k.hp - e.hp;
      if (d > 0) k.acc += d;
      k.hp = e.hp;
      k.x = e.x;
      k.y = e.y;
      k.progress = e.progress;
      k.seen = f;
      if (k.acc >= 1 && t - k.last >= DAMAGE_GAP_S) {
        emit(e.x, e.y, e.radius, k.acc);
        k.acc = 0;
        k.last = t;
      }
    }
    for (const [id, k] of this.map) {
      if (k.seen === f) continue;
      this.map.delete(id);
      // Cayó (no llegó al castillo): el último golpe, lo que le quedaba.
      const amount = k.acc + (k.progress < REACHED_PROGRESS ? Math.max(0, k.hp) : 0);
      if (amount >= 1) emit(k.x, k.y, k.radius, amount);
    }
  }

  /** Enemigos seguidos ahora (pruebas). */
  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}

// --- Las barras de vida -----------------------------------------------------------------

/** Escena: alto de la barra, ancho mínimo y lo que sube sobre el enemigo. muestra */
const BAR_H = 0.7;
const BAR_MIN_W = 4.2;
const BAR_LIFT = 1.6;
const BAR_BACK = '#1b1230';
const BAR_FULL = new Color('#3ddc84');
const BAR_MID = new Color('#ffc53d');
const BAR_LOW = new Color('#ff4d3d');

/** El color de la barra a esa parte de vida (verde, amarillo, rojo). */
export function barColor(frac: number, out = new Color()): Color {
  const f = Math.min(1, Math.max(0, frac));
  return f > 0.5 ? out.copy(BAR_MID).lerp(BAR_FULL, (f - 0.5) * 2) : out.copy(BAR_LOW).lerp(BAR_MID, f * 2);
}

/**
 * Una barra encima de cada enemigo tocado (con la vida entera no se pinta):
 * el fondo oscuro y lo que le queda, de verde a rojo, plana sobre el agua
 * (la cámara de la arena mira casi desde arriba). Dos `InstancedMesh` de
 * tope fijo: lo que pasa del tope no se pinta.
 */
export class HealthBars {
  readonly back: InstancedMesh;
  readonly fill: InstancedMesh;
  readonly cap: number;
  /** Barras pintadas en el último `update`. */
  drawn = 0;
  private readonly d = new Object3D();
  private readonly color = new Color();

  constructor(cap: number) {
    this.cap = Math.max(1, cap);
    const geo = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mat = (color: string) =>
      new MeshBasicMaterial({ color, transparent: true, opacity: 0.92, depthTest: false, depthWrite: false });
    this.back = new InstancedMesh(geo, mat(BAR_BACK), this.cap);
    this.fill = new InstancedMesh(geo, mat('#ffffff'), this.cap);
    this.fill.instanceColor = new InstancedBufferAttribute(new Float32Array(this.cap * 3), 3);
    this.back.name = 'defense-health-back';
    this.fill.name = 'defense-health-fill';
    for (const m of [this.back, this.fill]) {
      m.count = 0;
      m.visible = false;
      m.frustumCulled = false;
    }
    this.back.renderOrder = 6;
    this.fill.renderOrder = 7;
  }

  get meshes(): InstancedMesh[] {
    return [this.back, this.fill];
  }

  /** Empieza un fotograma. */
  begin(): void {
    this.drawn = 0;
  }

  /** Una barra: el enemigo en la escena (x, z), su tamaño (escena), su altura y su vida. */
  add(x: number, z: number, size: number, y: number, hp: number, maxHp: number): void {
    if (this.drawn >= this.cap || !(maxHp > 0) || hp >= maxHp) return;
    const frac = Math.max(0, hp / maxHp);
    const w = Math.max(BAR_MIN_W, size * 1.6);
    const by = y + size * 0.8 + BAR_LIFT;
    // Hacia arriba de la pantalla (la cámara de la arena mira hacia −z).
    const bz = z - size * 0.6;
    const d = this.d;
    const n = this.drawn++;
    d.position.set(x, by, bz);
    d.scale.set(w + 0.12, 1, BAR_H + 0.12);
    d.updateMatrix();
    this.back.setMatrixAt(n, d.matrix);
    d.position.set(x - (w * (1 - frac)) / 2, by + 0.01, bz);
    d.scale.set(Math.max(1e-3, w * frac), 1, BAR_H);
    d.updateMatrix();
    this.fill.setMatrixAt(n, d.matrix);
    this.fill.setColorAt(n, barColor(frac, this.color));
  }

  /** Acaba el fotograma (o lo esconde todo con `on` false). */
  end(on: boolean): void {
    if (!on) this.drawn = 0;
    const n = this.drawn;
    for (const m of this.meshes) {
      m.count = n;
      m.visible = n > 0;
      if (n > 0) m.instanceMatrix.needsUpdate = true;
    }
    if (n > 0 && this.fill.instanceColor) this.fill.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.back.geometry.dispose();
    for (const m of this.meshes) (m.material as Material).dispose();
  }
}

// --- Los números de daño ------------------------------------------------------------------

/** s que se ve un número (sube y se apaga). muestra */
export const NUMBER_S = 0.85;
/** Cifras como mucho de un número (más: 9999). */
export const NUMBER_DIGITS = 4;
/** Escena: alto de una cifra, lo que sube al flotar y su altura de salida. muestra */
const DIGIT_H = 3.2;
const NUMBER_RISE = 3.5;
const NUMBER_Y = 3;

/** Las piezas del atlas: las cifras 0…9, el «+» y la moneda. */
const GLYPH_PLUS = 10;
const GLYPH_COIN = 11;
const GLYPHS = 12;

/**
 * Cómo se ve un grupo de números: los de daño (crema, cortos) o las monedas
 * que paga Ibiza (plan 015 T178: «+N» y una moneda, dorados, más grandes y
 * más rato, para leerse desde la cámara alta). muestra
 */
export interface FloatNumberStyle {
  fill: string;
  stroke: string;
  /** s que se ve. */
  durationS: number;
  /** Escena: alto de una pieza, lo que sube y la altura de salida. */
  height: number;
  rise: number;
  y: number;
  /** «+» delante y una moneda detrás (las monedas de la granja). */
  coin: boolean;
  /**
   * 0: `height` y `rise` en la escena. Más: el alto de una pieza en la
   * pantalla, en partes de su alto (se ve igual de grande con cualquier
   * zoom), y `rise` en altos de pieza (plan 016 T183).
   */
  screen: number;
}

export const DAMAGE_NUMBER_STYLE: Readonly<FloatNumberStyle> = {
  fill: '#fff4e2',
  stroke: '#2a1640',
  durationS: NUMBER_S,
  height: DIGIT_H,
  rise: NUMBER_RISE,
  y: NUMBER_Y,
  coin: false,
  screen: 0,
};

/** s que se ve el «+N» de Ibiza. muestra */
export const COIN_POP_S = 1.8;
/**
 * El «+N» de Ibiza (plan 016 T183, decisión 7): grande y dorado, del mismo
 * tamaño en la pantalla con cualquier zoom (el alto de una cifra, en partes
 * del alto de la pantalla), sube desde la isla y se pinta encima de todos los
 * efectos. muestra
 */
export const COIN_POP_SCREEN = 0.065;
export const COIN_POP_STYLE: Readonly<FloatNumberStyle> = {
  fill: '#ffd23d',
  stroke: '#3a1f05',
  durationS: COIN_POP_S,
  height: 1,
  rise: 1.4,
  y: 4,
  coin: true,
  screen: COIN_POP_SCREEN,
};
/**
 * Dónde puede salir el «+N» en la pantalla (NDC: x mín., y mín., x máx., y
 * máx.): una isla bajo el HUD de arriba o la barra de abajo lo saca algo más
 * adentro, para que se lea entero al subir. muestra
 */
export const COIN_POP_KEEP: readonly [number, number, number, number] = [-0.8, -0.45, 0.8, 0.3];
/** Por encima de las barras (6, 7) y los números de daño (8): nada lo tapa. */
export const COIN_POP_ORDER = 20;

interface FloatNumber {
  x: number;
  z: number;
  y: number;
  value: number;
  t0: number;
  live: boolean;
}

/**
 * Las piezas en una fila: las cifras (0…9), el «+» y una moneda, del color
 * del estilo con borde oscuro. Sin `document` (pruebas), un píxel.
 */
function digitAtlas(style: FloatNumberStyle): Texture {
  if (typeof document === 'undefined') {
    const t = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const cw = 48;
  const ch = 64;
  const c = document.createElement('canvas');
  c.width = cw * GLYPHS;
  c.height = ch;
  const g = c.getContext('2d');
  if (g) {
    g.font = `900 ${Math.round(ch * 0.82)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 9;
    g.strokeStyle = style.stroke;
    g.fillStyle = style.fill;
    for (let i = 0; i <= GLYPH_PLUS; i++) {
      const glyph = i === GLYPH_PLUS ? '+' : String(i);
      g.strokeText(glyph, cw * (i + 0.5), ch * 0.54);
      g.fillText(glyph, cw * (i + 0.5), ch * 0.54);
    }
    // La moneda: un disco dorado con borde y un aro dentro.
    const cx = cw * (GLYPH_COIN + 0.5);
    const cy = ch * 0.52;
    const r = cw * 0.4;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fillStyle = '#ffc53d';
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = style.stroke;
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, r * 0.58, 0, Math.PI * 2);
    g.lineWidth = 4;
    g.strokeStyle = '#c98a12';
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.minFilter = LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/** Cifras de un número entero ≥ 0 (como mucho `NUMBER_DIGITS`, el resto 9). */
export function digitsOf(value: number): number[] {
  const v = Math.min(10 ** NUMBER_DIGITS - 1, Math.max(0, Math.round(value)));
  return String(v).split('').map(Number);
}

/** Las piezas que se pintan de un número: sus cifras, o «+», las cifras y la moneda. */
export function glyphsOf(value: number, coin: boolean): number[] {
  const ds = digitsOf(value);
  return coin ? [GLYPH_PLUS, ...ds, GLYPH_COIN] : ds;
}

/**
 * Los números de daño: un grupo fijo de `cap` números (el más viejo se
 * reutiliza si no queda sitio) y una `InstancedMesh` de cifras que miran
 * siempre a la cámara, suben y se apagan. Con movimiento reducido, no suben.
 * Con `COIN_POP_STYLE`, las monedas que paga Ibiza («+N» y una moneda).
 */
export class DamageNumbers {
  readonly mesh: InstancedMesh;
  readonly cap: number;
  readonly style: Readonly<FloatNumberStyle>;
  /** Números lanzados desde el principio (pruebas). */
  spawned = 0;
  /** El último número lanzado (pruebas). */
  lastValue = 0;
  /** Números vivos en el último `update`. */
  live = 0;
  private readonly pool: FloatNumber[];
  private next = 0;
  private readonly digit: InstancedBufferAttribute;
  private readonly offset: InstancedBufferAttribute;
  private readonly alpha: InstancedBufferAttribute;
  private readonly lift: InstancedBufferAttribute;
  private readonly d = new Object3D();

  constructor(cap: number, style: Readonly<FloatNumberStyle> = DAMAGE_NUMBER_STYLE) {
    this.cap = Math.max(1, cap);
    this.style = style;
    this.pool = Array.from({ length: this.cap }, () => ({ x: 0, z: 0, y: 0, value: 0, t0: 0, live: false }));
    const n = this.cap * (NUMBER_DIGITS + (style.coin ? 2 : 0));
    const geo = new PlaneGeometry(0.75, 1);
    this.digit = new InstancedBufferAttribute(new Float32Array(n), 1);
    this.offset = new InstancedBufferAttribute(new Float32Array(n), 1);
    this.alpha = new InstancedBufferAttribute(new Float32Array(n), 1);
    this.lift = new InstancedBufferAttribute(new Float32Array(n), 1);
    geo.setAttribute('aDigit', this.digit);
    geo.setAttribute('aLift', this.lift);
    geo.setAttribute('aOffset', this.offset);
    geo.setAttribute('aAlpha', this.alpha);
    const mat = new ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      defines: { PLANET_WRAP: '' },
      uniforms: {
        uMap: { value: digitAtlas(style) },
        uScreen: { value: style.screen },
        uKeep: { value: new Vector4(...COIN_POP_KEEP) },
        ...planetUniforms,
      },
      vertexShader: /* glsl */ `
        attribute float aDigit;
        attribute float aOffset;
        attribute float aAlpha;
        attribute float aLift;
        uniform float uScreen;
        uniform vec4 uKeep;
        varying vec2 vUv;
        varying float vAlpha;
        ${PLANET_PARS}
        void main() {
          vUv = vec2((uv.x + aDigit) / ${GLYPHS}.0, uv.y);
          vAlpha = aAlpha;
          vec4 w = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          w.xyz = planetCurve(w.xyz);
          vec4 mv = viewMatrix * w;
          float s = length(instanceMatrix[0].xyz);
          vec2 q = vec2(position.x + aOffset * 0.62, position.y + aLift);
          if (uScreen > 0.0) {
            // On screen: a glyph is uScreen of the view height, and its anchor
            // stays inside uKeep (NDC min x, min y, max x, max y), clear of the HUD.
            vec4 c = projectionMatrix * mv;
            vec2 ndc = clamp(c.xy / c.w, uKeep.xy, uKeep.zw);
            float a = projectionMatrix[0][0] / projectionMatrix[1][1];
            ndc += vec2(q.x * a, q.y) * s * uScreen * 2.0;
            gl_Position = vec4(ndc * c.w, c.z, c.w);
          } else {
            mv.xy += q * s;
            gl_Position = projectionMatrix * mv;
          }
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec2 vUv;
        varying float vAlpha;
        void main() {
          vec4 c = texture2D(uMap, vUv);
          if (c.a * vAlpha < 0.02) discard;
          gl_FragColor = vec4(c.rgb, c.a * vAlpha);
        }
      `,
    });
    // Ya lleva la curva del planeta (con la vuelta): `curveTree` no la toca.
    mat.userData.planet = 'wrap';
    this.mesh = new InstancedMesh(geo, mat, n);
    this.mesh.name = style.coin ? 'defense-coin-pops' : 'defense-damage-numbers';
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = style.coin ? COIN_POP_ORDER : 8;
  }

  /** Un número nuevo en la escena (x, z) a la hora `t`; si no hay sitio, el más viejo. */
  spawn(x: number, z: number, value: number, t: number, lift = 0): void {
    let slot = -1;
    for (let i = 0; i < this.cap; i++) {
      const j = (this.next + i) % this.cap;
      if (!this.pool[j]!.live) {
        slot = j;
        break;
      }
    }
    if (slot < 0) {
      // Lleno: el más viejo.
      let old = 0;
      for (let i = 1; i < this.cap; i++) if (this.pool[i]!.t0 < this.pool[old]!.t0) old = i;
      slot = old;
    }
    this.next = (slot + 1) % this.cap;
    const p = this.pool[slot]!;
    p.x = x;
    p.z = z;
    p.y = this.style.y + lift;
    p.value = value;
    p.t0 = t;
    p.live = true;
    this.spawned++;
    this.lastValue = value;
  }

  /** Números vivos ahora en el grupo (sin contar los que se apagan en `update`). */
  get pooled(): number {
    let n = 0;
    for (const p of this.pool) if (p.live) n++;
    return n;
  }

  /** Un fotograma: suben, se apagan y se escriben sus cifras. `on` false: ninguno. */
  update(t: number, on: boolean, reduced: boolean): void {
    let n = 0;
    let live = 0;
    const d = this.d;
    const st = this.style;
    for (const p of this.pool) {
      if (!p.live) continue;
      const k = (t - p.t0) / st.durationS;
      if (!on || k >= 1 || k < 0) {
        p.live = false;
        continue;
      }
      live++;
      const ds = glyphsOf(p.value, st.coin);
      const a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      const up = reduced ? 0 : st.rise * (1 - (1 - k) * (1 - k));
      // En la pantalla sube en altos de pieza; si no, en la escena.
      const y = p.y + (st.screen > 0 ? 0 : up);
      const lift = st.screen > 0 ? up : 0;
      const s = st.height * (reduced ? 1 : k < 0.15 ? 0.7 + 2 * k : 1);
      for (let i = 0; i < ds.length; i++) {
        d.position.set(p.x, y, p.z);
        d.scale.setScalar(s);
        d.updateMatrix();
        this.mesh.setMatrixAt(n, d.matrix);
        this.digit.setX(n, ds[i]!);
        this.offset.setX(n, i - (ds.length - 1) / 2);
        this.alpha.setX(n, a);
        this.lift.setX(n, lift);
        n++;
      }
    }
    this.live = live;
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.digit.needsUpdate = true;
      this.offset.needsUpdate = true;
      this.alpha.needsUpdate = true;
      this.lift.needsUpdate = true;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    const m = this.mesh.material as ShaderMaterial;
    (m.uniforms.uMap!.value as Texture).dispose();
    m.dispose();
  }
}
