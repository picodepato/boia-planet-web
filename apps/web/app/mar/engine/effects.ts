import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NormalBlending,
  Object3D,
  PlaneGeometry,
  Points,
  RingGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';
import { rng, smooth, wobble } from './kit';
import { C } from './palette';
import type { Glows } from './props';
import { wrapD } from './wrap';

/**
 * Efectos del mar 3D, todos baratos: la estela (una cinta que se ensancha y
 * se desvanece), los resplandores (un solo `Points` aditivo), la marca de
 * destino y la ruta, la línea de la ruta de boyas en el mapa, el confeti,
 * las nubes y el remolino.
 */

// --- Estela -----------------------------------------------------------------

const WAKE_N = 56;

export class Wake {
  readonly mesh: Mesh;
  private readonly pts: { x: number; z: number; hx: number; hz: number; age: number; s: number }[] =
    [];
  private readonly pos: Float32Array;
  private readonly alpha: Float32Array;
  private readonly side: Float32Array;
  private acc = 0;

  constructor() {
    const g = new BufferGeometry();
    this.pos = new Float32Array(WAKE_N * 2 * 3);
    this.alpha = new Float32Array(WAKE_N * 2);
    this.side = new Float32Array(WAKE_N * 2);
    const idx: number[] = [];
    for (let i = 0; i < WAKE_N - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    for (let i = 0; i < WAKE_N; i++) {
      this.side[i * 2] = -1;
      this.side[i * 2 + 1] = 1;
    }
    g.setIndex(idx);
    g.setAttribute('position', new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage));
    g.setAttribute('aAlpha', new BufferAttribute(this.alpha, 1).setUsage(DynamicDrawUsage));
    g.setAttribute('aSide', new BufferAttribute(this.side, 1));
    const m = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: { uColor: { value: new Color('#ffffff') }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        attribute float aSide;
        varying float vAlpha;
        varying float vSide;
        varying vec2 vW;
        void main() {
          vAlpha = aAlpha;
          vSide = aSide;
          vW = position.xz;
          gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uTime;
        varying float vAlpha;
        varying float vSide;
        varying vec2 vW;
        void main() {
          float edge = 1.0 - abs(vSide);
          float streak = 0.55 + 0.45 * sin(vW.x * 3.1 + vW.y * 2.7 + uTime * 4.0);
          float a = vAlpha * (0.35 + 0.65 * smoothstep(0.0, 0.5, 1.0 - edge)) * streak;
          gl_FragColor = vec4(uColor, a * 0.85);
        }
      `,
    });
    this.mesh = new Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  /** Color de la espuma: el cosmético de estela (T40); null, blanca. */
  setTint(color: number | null): void {
    ((this.mesh.material as ShaderMaterial).uniforms.uColor!.value as Color).set(color ?? 0xffffff);
  }

  /** Avanza la estela: `x, z` la popa, `heading` el rumbo, `speed01` 0..1 (más con turbo). */
  update(dt: number, x: number, z: number, heading: number, speed01: number, time: number): void {
    (this.mesh.material as ShaderMaterial).uniforms.uTime!.value = time;
    // El barco pasó a otra copia del planeta (vista de mapa): la estela va con él.
    const head = this.pts[0];
    if (head && Math.hypot(x - head.x, z - head.z) > 20) {
      const dx = x - head.x;
      const dz = z - head.z;
      for (const p of this.pts) {
        p.x += dx;
        p.z += dz;
      }
    }
    for (const p of this.pts) p.age += dt;
    this.acc += dt;
    if (this.acc > 0.045) {
      this.acc = 0;
      this.pts.unshift({ x, z, hx: Math.cos(heading), hz: Math.sin(heading), age: 0, s: speed01 });
      if (this.pts.length > WAKE_N) this.pts.pop();
    }
    const life = 2.4;
    for (let i = 0; i < WAKE_N; i++) {
      const p = this.pts[i] ?? this.pts[this.pts.length - 1];
      const o = i * 6;
      if (!p) {
        this.alpha[i * 2] = 0;
        this.alpha[i * 2 + 1] = 0;
        continue;
      }
      const k = Math.min(1, p.age / life);
      const w = (0.35 + k * 2.2) * (0.4 + p.s * 0.8);
      // Perpendicular al rumbo en el plano del agua.
      const nx = -p.hz;
      const nz = p.hx;
      const head = i === 0 ? { x, z } : p;
      this.pos[o] = head.x - nx * w;
      this.pos[o + 1] = 0.05;
      this.pos[o + 2] = head.z - nz * w;
      this.pos[o + 3] = head.x + nx * w;
      this.pos[o + 4] = 0.05;
      this.pos[o + 5] = head.z + nz * w;
      const a = (1 - k) * (1 - k) * p.s;
      this.alpha[i * 2] = a;
      this.alpha[i * 2 + 1] = a;
    }
    const g = this.mesh.geometry;
    g.getAttribute('position').needsUpdate = true;
    g.getAttribute('aAlpha').needsUpdate = true;
  }
}

// --- Resplandores --------------------------------------------------------------

export function glowPoints(glows: Glows[]): Points {
  const pos: number[] = [];
  const col: number[] = [];
  const size: number[] = [];
  const phase: number[] = [];
  for (const g of glows) {
    pos.push(...g.pos);
    col.push(...g.col);
    size.push(...g.size);
    phase.push(...g.phase);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  geo.setAttribute('aSize', new BufferAttribute(new Float32Array(size), 1));
  geo.setAttribute('aPhase', new BufferAttribute(new Float32Array(phase), 1));
  const m = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexColors: true,
    uniforms: { uGlow: { value: 1 }, uTime: { value: 0 }, uScale: { value: 600 } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uScale;
      varying vec3 vColor;
      varying float vFlicker;
      void main() {
        vColor = color;
        vFlicker = 0.82 + 0.18 * sin(uTime * 7.0 + aPhase * 5.0) * sin(uTime * 3.1 + aPhase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aSize * uScale / -mv.z, 1.5, 160.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uGlow;
      varying vec3 vColor;
      varying float vFlicker;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        float a = pow(max(0.0, 1.0 - d), 2.2) * uGlow * vFlicker;
        gl_FragColor = vec4(vColor * a, a);
      }
    `,
  });
  const pts = new Points(geo, m);
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  return pts;
}

/** Dónde empieza cada grupo de `glows` dentro de los puntos de `glowPoints` (índice de punto). */
export function glowOffsets(glows: readonly Glows[]): number[] {
  let at = 0;
  return glows.map((g) => {
    const start = at;
    at += g.size.length;
    return start;
  });
}

/**
 * Enciende o apaga un grupo de resplandores (el de una isla cuando se ve su
 * modelo de Blender, T75): apagado, su color es negro y, como se suman, no
 * se ve. Encendido, vuelve a su color (`g.col`).
 */
export function showGlows(points: Points, start: number, g: Glows, on: boolean): void {
  const n = g.size.length;
  if (n === 0) return;
  const attr = points.geometry.getAttribute('color') as BufferAttribute;
  const arr = attr.array as Float32Array;
  for (let i = 0; i < n * 3; i++) arr[start * 3 + i] = on ? g.col[i]! : 0;
  attr.needsUpdate = true;
}

// --- Destino y ruta ------------------------------------------------------------

export class CourseMarker {
  readonly group = new Group();
  private readonly ring: Mesh;
  private readonly ring2: Mesh;
  private readonly dots: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly N = 40;

  constructor() {
    const mat = new MeshBasicMaterial({
      color: '#fff4e2',
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.ring = new Mesh(new RingGeometry(0.95, 1.15, 32), mat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring2 = new Mesh(new RingGeometry(0.4, 0.55, 24), mat.clone());
    this.ring2.rotation.x = -Math.PI / 2;
    this.dots = new InstancedMesh(
      new CircleGeometry(0.2, 10).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({
        color: '#fff4e2',
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
      this.N,
    );
    this.dots.frustumCulled = false;
    this.group.add(this.ring, this.ring2, this.dots);
    this.group.visible = false;
    this.group.renderOrder = 2;
  }

  show(on: boolean): void {
    this.group.visible = on;
  }

  update(
    from: { x: number; z: number },
    to: { x: number; z: number },
    t: number,
    scale: number,
  ): void {
    const pulse = 1 + Math.sin(t * 4) * 0.12;
    this.ring.position.set(to.x, 0.12, to.z);
    this.ring.scale.setScalar(pulse * scale);
    this.ring2.position.set(to.x, 0.12, to.z);
    this.ring2.scale.setScalar((2 - pulse) * scale);
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dz);
    const gap = Math.max(1.6, 2.2 * scale);
    const n = Math.min(this.N, Math.floor(len / gap));
    const off = (t * 2.5) % 1;
    for (let i = 0; i < this.N; i++) {
      if (i >= n || len < 3) {
        this.m.makeScale(0, 0, 0);
      } else {
        const k = (i + off) / Math.max(1, n);
        this.m.makeScale(scale, scale, scale);
        this.m.setPosition(from.x + dx * k, 0.1, from.z + dz * k);
      }
      this.dots.setMatrixAt(i, this.m);
    }
    this.dots.instanceMatrix.needsUpdate = true;
  }
}

// --- La ruta de boyas en el mapa (T50) -------------------------------------------

/**
 * Las marcas de la ruta: trazos amarillos sobre el agua, lo único que guía
 * entre islas desde T59 (ya sin boyas). De cerca se ven suaves; al alejarse
 * se afirman y engordan en el mapa para leerse en un móvil. Un solo `InstancedMesh`; quien lo usa lo curva
 * con el planeta (cada vértice en su copia más cercana).
 */
/** Lo que se ven las marcas de cerca (0…1), con el barco. muestra */
export const NEAR_MARKS = 0.4;
/** Y la opacidad máxima de las marcas (más transparentes desde T113). muestra */
export const MARKS_ALPHA = 0.55;

export class RouteLine {
  readonly mesh: InstancedMesh;
  private readonly mat: MeshBasicMaterial;
  private readonly o = new Object3D();
  private k = -1;
  private suppressed = false;

  constructor(private readonly dashes: readonly { x: number; z: number; angle: number }[]) {
    this.mat = new MeshBasicMaterial({
      color: '#ffd23f',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.mesh = new InstancedMesh(
      new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      this.mat,
      Math.max(1, dashes.length),
    );
    this.mesh.count = dashes.length;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.visible = false;
  }

  /**
   * Escondidas durante la carrera (decisión 13, T88): desde la cuenta atrás
   * hasta la meta, la anulación o el cambio de mundo. `update` lo respeta en
   * cada fotograma.
   */
  setSuppressed(on: boolean): void {
    this.suppressed = on;
    if (on) this.mesh.visible = false;
  }

  get isSuppressed(): boolean {
    return this.suppressed;
  }

  /** `zoom` 0 (barco) … 1 (mapa). */
  update(zoom: number): void {
    const a = NEAR_MARKS + (1 - NEAR_MARKS) * smooth(0.3, 0.6, zoom);
    this.mat.opacity = a * MARKS_ALPHA;
    this.mesh.visible = !this.suppressed && a > 0.01 && this.dashes.length > 0;
    if (!this.mesh.visible) return;
    const k = 1 + smooth(0.3, 1, zoom) * 1.2;
    if (Math.abs(k - this.k) < 0.01) return;
    this.k = k;
    this.dashes.forEach((d, i) => {
      this.o.position.set(d.x, 0.15, d.z);
      this.o.rotation.set(0, -d.angle, 0);
      this.o.scale.set(1.45 * k, 1, 0.8 * k);
      this.o.updateMatrix();
      this.mesh.setMatrixAt(i, this.o.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// --- Confeti -------------------------------------------------------------------

export class Confetti {
  readonly mesh: InstancedMesh;
  private readonly N = 90;
  private readonly p: { pos: Vector3; vel: Vector3; rot: Vector3; spin: Vector3; life: number }[] =
    [];
  private readonly o = new Object3D();

  constructor() {
    this.mesh = new InstancedMesh(
      new PlaneGeometry(0.28, 0.16),
      new MeshBasicMaterial({ side: DoubleSide, vertexColors: false }),
      this.N,
    );
    this.mesh.frustumCulled = false;
    const colors = [C.orange, '#ffd23f', '#6a4fc4', '#f2557a', '#fff4e2', '#4cc3d9'];
    for (let i = 0; i < this.N; i++) {
      this.mesh.setColorAt(i, new Color(colors[i % colors.length]!));
      this.p.push({
        pos: new Vector3(),
        vel: new Vector3(),
        rot: new Vector3(),
        spin: new Vector3(),
        life: 0,
      });
      this.o.scale.setScalar(0);
      this.o.updateMatrix();
      this.mesh.setMatrixAt(i, this.o.matrix);
    }
  }

  burst(x: number, y: number, z: number): void {
    for (const q of this.p) {
      q.pos.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * 6;
      q.vel.set(Math.cos(a) * s * 0.5, 7 + Math.random() * 7, Math.sin(a) * s * 0.5);
      q.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      q.spin.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
      q.life = 3 + Math.random() * 1.5;
    }
  }

  update(dt: number): void {
    let any = false;
    for (let i = 0; i < this.N; i++) {
      const q = this.p[i]!;
      if (q.life <= 0) continue;
      any = true;
      q.life -= dt;
      q.vel.y -= 9 * dt;
      q.vel.multiplyScalar(1 - dt * 0.9);
      q.pos.addScaledVector(q.vel, dt);
      if (q.pos.y < 0.05) {
        q.pos.y = 0.05;
        q.vel.set(0, 0, 0);
      }
      q.rot.addScaledVector(q.spin, dt);
      this.o.position.copy(q.pos);
      this.o.rotation.set(q.rot.x, q.rot.y, q.rot.z);
      this.o.scale.setScalar(q.life > 0 ? Math.min(1, q.life) : 0);
      this.o.updateMatrix();
      this.mesh.setMatrixAt(i, this.o.matrix);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// --- Nubes ---------------------------------------------------------------------

/** Nubes bajas que sólo se ven al alejar la cámara (la vista de mapa vuela entre ellas). */
export class Clouds {
  readonly group = new Group();
  private readonly mats: MeshLambertMaterial[] = [];

  constructor(b: { left: number; right: number; top: number; bottom: number }) {
    const rnd = rng(77);
    for (let i = 0; i < 14; i++) {
      const mat = new MeshLambertMaterial({
        color: '#ffffff',
        emissive: '#8f86b8',
        transparent: true,
        opacity: 0,
        flatShading: true,
        depthWrite: false,
        blending: NormalBlending,
      });
      this.mats.push(mat);
      const c = new Group();
      const puffs = 3 + Math.floor(rnd() * 3);
      for (let j = 0; j < puffs; j++) {
        const s = 6 + rnd() * 8;
        const m = new Mesh(wobble(new IcosahedronGeometry(s, 1), s * 0.15, rnd), mat);
        m.position.set(
          j * s * 0.9 - puffs * s * 0.4,
          (rnd() - 0.5) * s * 0.4,
          (rnd() - 0.5) * s * 0.6,
        );
        m.scale.set(1, 0.55, 0.8);
        c.add(m);
      }
      c.userData.x = b.left + rnd() * (b.right - b.left);
      c.userData.z = b.top + rnd() * (b.bottom - b.top);
      c.position.y = 70 + rnd() * 40;
      c.userData.speed = 1 + rnd() * 1.5;
      this.group.add(c);
    }
  }

  /**
   * Aparecen cuando la cámara sube por encima de ellas; derivan hacia el
   * este dando la vuelta al planeta, cada una en su copia más cercana a
   * `focus` (el mar no se acaba).
   */
  update(
    dt: number,
    camHeight: number,
    focus: { x: number; z: number },
    period: { w: number; h: number },
  ): void {
    const k = Math.max(0, Math.min(1, (camHeight - 120) / 200));
    for (const m of this.mats) m.opacity = k * 0.75;
    this.group.visible = k > 0.01;
    for (const c of this.group.children) {
      const u = c.userData as { x: number; z: number; speed: number };
      u.x += u.speed * dt;
      c.position.x = focus.x + wrapD(u.x - focus.x, period.w);
      c.position.z = focus.z + wrapD(u.z - focus.z, period.h);
    }
  }
}

// --- Remolino ------------------------------------------------------------------

/**
 * Cuadros por lado de la malla del remolino. El planeta curva cada vértice
 * (`planetCurve`): con un solo cuadro, su centro quedaba por debajo del agua
 * curvada y el remolino no se veía (T96). Con la malla fina sigue la curva
 * como el agua.
 */
export const WHIRLPOOL_SEGMENTS = 32;

/** Altura del remolino sobre el agua (escena). */
export const WHIRLPOOL_LIFT = 0.15;

export function whirlpool(radius: number): Mesh {
  const m = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // Encima del agua también de lejos (en el mapa, la profundidad da para poco).
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 c = vUv - 0.5;
        float r = length(c) * 2.0;
        float a = atan(c.y, c.x);
        float s = sin(a * 3.0 + r * 14.0 - uTime * 4.0);
        float band = smoothstep(0.3, 0.9, s);
        float fade = smoothstep(1.0, 0.55, r);
        vec3 deep = vec3(0.04, 0.18, 0.35);
        vec3 foam = vec3(0.95, 0.97, 1.0);
        vec3 col = mix(deep, foam, band * (0.35 + r * 0.6));
        float alpha = fade * (0.35 + band * 0.55) * smoothstep(0.0, 0.15, r);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const mesh = new Mesh(
    new PlaneGeometry(radius * 2, radius * 2, WHIRLPOOL_SEGMENTS, WHIRLPOOL_SEGMENTS),
    m,
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = WHIRLPOOL_LIFT;
  mesh.renderOrder = 1;
  return mesh;
}
