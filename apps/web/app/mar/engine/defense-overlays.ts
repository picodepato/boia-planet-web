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

interface FloatNumber {
  x: number;
  z: number;
  y: number;
  value: number;
  t0: number;
  live: boolean;
}

/** Las cifras (0…9) en una fila: crema con borde oscuro. Sin `document` (pruebas), un píxel. */
function digitAtlas(): Texture {
  if (typeof document === 'undefined') {
    const t = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const cw = 48;
  const ch = 64;
  const c = document.createElement('canvas');
  c.width = cw * 10;
  c.height = ch;
  const g = c.getContext('2d');
  if (g) {
    g.font = `900 ${Math.round(ch * 0.82)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 9;
    g.strokeStyle = '#2a1640';
    g.fillStyle = '#fff4e2';
    for (let i = 0; i < 10; i++) {
      g.strokeText(String(i), cw * (i + 0.5), ch * 0.54);
      g.fillText(String(i), cw * (i + 0.5), ch * 0.54);
    }
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

/**
 * Los números de daño: un grupo fijo de `cap` números (el más viejo se
 * reutiliza si no queda sitio) y una `InstancedMesh` de cifras que miran
 * siempre a la cámara, suben y se apagan. Con movimiento reducido, no suben.
 */
export class DamageNumbers {
  readonly mesh: InstancedMesh;
  readonly cap: number;
  /** Números vivos en el último `update`. */
  live = 0;
  private readonly pool: FloatNumber[];
  private next = 0;
  private readonly digit: InstancedBufferAttribute;
  private readonly offset: InstancedBufferAttribute;
  private readonly alpha: InstancedBufferAttribute;
  private readonly d = new Object3D();

  constructor(cap: number) {
    this.cap = Math.max(1, cap);
    this.pool = Array.from({ length: this.cap }, () => ({ x: 0, z: 0, y: 0, value: 0, t0: 0, live: false }));
    const n = this.cap * NUMBER_DIGITS;
    const geo = new PlaneGeometry(0.75, 1);
    this.digit = new InstancedBufferAttribute(new Float32Array(n), 1);
    this.offset = new InstancedBufferAttribute(new Float32Array(n), 1);
    this.alpha = new InstancedBufferAttribute(new Float32Array(n), 1);
    geo.setAttribute('aDigit', this.digit);
    geo.setAttribute('aOffset', this.offset);
    geo.setAttribute('aAlpha', this.alpha);
    const mat = new ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      defines: { PLANET_WRAP: '' },
      uniforms: { uMap: { value: digitAtlas() }, ...planetUniforms },
      vertexShader: /* glsl */ `
        attribute float aDigit;
        attribute float aOffset;
        attribute float aAlpha;
        varying vec2 vUv;
        varying float vAlpha;
        ${PLANET_PARS}
        void main() {
          vUv = vec2((uv.x + aDigit) / 10.0, uv.y);
          vAlpha = aAlpha;
          vec4 w = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          w.xyz = planetCurve(w.xyz);
          vec4 mv = viewMatrix * w;
          float s = length(instanceMatrix[0].xyz);
          mv.xy += vec2(position.x + aOffset * 0.62, position.y) * s;
          gl_Position = projectionMatrix * mv;
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
    this.mesh.name = 'defense-damage-numbers';
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 8;
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
    p.y = NUMBER_Y + lift;
    p.value = value;
    p.t0 = t;
    p.live = true;
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
    for (const p of this.pool) {
      if (!p.live) continue;
      const k = (t - p.t0) / NUMBER_S;
      if (!on || k >= 1 || k < 0) {
        p.live = false;
        continue;
      }
      live++;
      const ds = digitsOf(p.value);
      const a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      const y = p.y + (reduced ? 0 : NUMBER_RISE * (1 - (1 - k) * (1 - k)));
      const s = DIGIT_H * (reduced ? 1 : k < 0.15 ? 0.7 + 2 * k : 1);
      for (let i = 0; i < ds.length; i++) {
        d.position.set(p.x, y, p.z);
        d.scale.setScalar(s);
        d.updateMatrix();
        this.mesh.setMatrixAt(n, d.matrix);
        this.digit.setX(n, ds[i]!);
        this.offset.setX(n, i - (ds.length - 1) / 2);
        this.alpha.setX(n, a);
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
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    const m = this.mesh.material as ShaderMaterial;
    (m.uniforms.uMap!.value as Texture).dispose();
    m.dispose();
  }
}
