import type { WorldConfig } from '@boia/world';
import type { BufferGeometry } from 'three';
import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  Vector4,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
// Las islas y los colores son los de /mar: el mismo mundo, ahora visto desde fuera.
import { toScene } from '../../app/mar/engine/compress';
import { buildIsland, buildSandbank } from '../../app/mar/engine/islands';
import { rng } from '../../app/mar/engine/kit';
import { moods } from '../../app/mar/engine/palette';
import { planetRect } from '../../app/mar/engine/wrap';
import { type Vec3, dirOf, frameAt, lonLat, sphereMap, wrapPoint } from './sphere-map';

/**
 * El planeta de `/mar` en miniatura, entero y redondo (T57): el agua en una
 * esfera, las islas del mundo (las mismas composiciones low-poly que en
 * `/mar`, dobladas sobre la superficie), nubes que dan vueltas y un halo.
 * Lo usa la entrada de la landing; sirve para cualquier vista del planeta
 * desde fuera. Unidades de escena del mar 3D; `group` se escala y se mueve
 * desde fuera. Todo `muestra`.
 */

export interface MiniPlanetOptions {
  /** El mundo ya a la escala de /mar (`marWorld`). */
  world: WorldConfig;
  /** El mar del tema del mundo (Arcilla, Acuarela). */
  sea?: { base: string; wave: string; crest: string };
  islands: { scale: number; latTopDeg: number; latBottomDeg: number };
  clouds: { count: number; seed: number; lift: number };
  /** Dirección hacia el sol en el espacio de la cámara. */
  sunDir: Vec3;
}

export interface MiniPlanet {
  /** Inclinación (rotation.x) → giro (rotation.y) → el planeta. */
  readonly group: Group;
  /** Radio del agua, unidades de escena. */
  readonly radius: number;
  /** Islas puestas en la esfera. */
  readonly islands: number;
  /** Gira el planeta (rad), lo inclina hacia la cámara (rad) y mueve el agua y las nubes. */
  pose(spin: number, tilt: number, cloudSpin: number, time: number): void;
  setOpacity(alpha: number): void;
  dispose(): void;
}

/** Islas con orilla que pinta el agua (el resto, sin espuma). */
const MAX_SHORES = 24;

const waterVertex = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vNormalV;
  void main() {
    vObj = position;
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const waterFragment = /* glsl */ `
  #define MAX_SHORES ${MAX_SHORES}
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  uniform vec3 uSunDir;
  uniform vec4 uShores[MAX_SHORES];
  uniform int uShoreCount;
  uniform float uTime;
  uniform float uOpacity;
  varying vec3 vObj;
  varying vec3 vNormalV;

  void main() {
    vec3 p = normalize(vObj);
    // Distancia angular a la orilla más cercana (negativa dentro de la isla).
    float d = 10.0;
    for (int i = 0; i < MAX_SHORES; i++) {
      if (i >= uShoreCount) break;
      float a = acos(clamp(dot(p, uShores[i].xyz), -1.0, 1.0)) - uShores[i].w;
      d = min(d, a);
    }
    float shallow = 1.0 - smoothstep(0.0, 0.11, d);
    vec3 col = mix(uDeep, uShallow, shallow * 0.9);
    // Espuma en la orilla, que respira.
    float wob = 0.006 * sin(uTime * 1.6 + p.x * 37.0 + p.z * 23.0);
    float foam = 1.0 - smoothstep(0.004, 0.022, abs(d - 0.012 + wob));
    col = mix(col, uFoam, foam * 0.75);
    // Olas suaves en mar abierto.
    float w = sin(p.x * 9.0 + p.y * 5.0 + uTime * 0.5) + sin(p.z * 11.0 - p.x * 4.0 - uTime * 0.4)
      + 0.5 * sin(p.y * 17.0 + p.z * 7.0 + uTime * 0.7);
    col += 0.022 * w * (1.0 - shallow);

    vec3 n = normalize(vNormalV);
    vec3 v = vec3(0.0, 0.0, 1.0);
    float diff = max(dot(n, uSunDir), 0.0);
    vec3 h = normalize(uSunDir + v);
    float spec = pow(max(dot(n, h), 0.0), 70.0) * 0.45;
    float rim = pow(1.0 - max(dot(n, v), 0.0), 2.4);
    col = col * (0.5 + 0.62 * diff) + vec3(spec) + uShallow * rim * 0.55;
    gl_FragColor = vec4(col, uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const haloVertex = /* glsl */ `
  varying float vFacing;
  void main() {
    vFacing = abs(normalize(normalMatrix * normal).z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const haloFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uEdge;
  uniform float uOpacity;
  varying float vFacing;
  void main() {
    // Más fuerte junto al borde del agua, nada en el borde del halo.
    float g = smoothstep(0.0, uEdge, vFacing);
    gl_FragColor = vec4(uColor * g * g * 0.9 * uOpacity, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Una nube low-poly: unas bolas fusionadas, aplastadas. */
function cloudGeometry(rnd: () => number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const g = new IcosahedronGeometry(0.55 + rnd() * 0.45, 1);
    g.scale(1, 0.62, 1);
    g.translate((i - (n - 1) / 2) * 0.75 + (rnd() - 0.5) * 0.3, rnd() * 0.25, (rnd() - 0.5) * 0.5);
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  return merged;
}

/** Dobla una pieza (ya construida en el origen) sobre la esfera, en su sitio. */
function wrapGeometry(
  geo: BufferGeometry,
  frame: ReturnType<typeof frameAt>,
  radius: number,
  scale: number,
): BufferGeometry {
  const pos = geo.getAttribute('position');
  const out: Vec3 = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    wrapPoint(frame, radius, pos.getX(i) * scale, pos.getY(i) * scale, pos.getZ(i) * scale, out);
    pos.setXYZ(i, out[0], out[1], out[2]);
  }
  pos.needsUpdate = true;
  geo.deleteAttribute('normal');
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export function buildMiniPlanet(opts: MiniPlanetOptions): MiniPlanet {
  const { world } = opts;
  const r = planetRect(world.bounds);
  const map = sphereMap(
    {
      left: toScene(r.left),
      right: toScene(r.right),
      top: toScene(r.top),
      bottom: toScene(r.bottom),
    },
    opts.islands.latTopDeg,
    opts.islands.latBottomDeg,
  );
  const radius = map.radius;
  const scale = opts.islands.scale;
  const day = moods(opts.sea).dia;

  const group = new Group();
  const spinGroup = new Group();
  group.add(spinGroup);
  const disposables: { dispose(): void }[] = [];

  // Islas: las composiciones de /mar, dobladas sobre la esfera.
  const lit = new MeshLambertMaterial({ vertexColors: true, flatShading: true, side: DoubleSide });
  const glow = new MeshBasicMaterial({ vertexColors: true });
  disposables.push(lit, glow);
  const shores: Vector4[] = [];
  let islands = 0;
  for (const o of world.objects) {
    if (!o.identity.active) continue;
    const cat = o.identity.category;
    if (cat !== 'isla' && cat !== 'naufrago') continue;
    const id = o.identity.id;
    const R0 = toScene(o.geometry.collision?.radius ?? o.geometry.activation?.radius ?? 12);
    const R = cat === 'isla' ? R0 : Math.max(1.5, R0 * 1.2);
    const build = cat === 'isla' ? buildIsland(id, R) : buildSandbank(R);
    const { lon, lat } = lonLat(map, toScene(o.position.x), toScene(o.position.y));
    const up = dirOf(lon, lat);
    const frame = frameAt(up);
    const litGeo = wrapGeometry(build.parts.lit.build(), frame, radius, scale);
    spinGroup.add(new Mesh(litGeo, lit));
    disposables.push(litGeo);
    if (!build.parts.glow.empty) {
      const glowGeo = wrapGeometry(build.parts.glow.build(), frame, radius, scale);
      spinGroup.add(new Mesh(glowGeo, glow));
      disposables.push(glowGeo);
    }
    if (shores.length < MAX_SHORES)
      shores.push(new Vector4(up[0], up[1], up[2], (R * scale) / radius));
    islands++;
  }

  // El agua.
  const shoreUniform = Array.from({ length: MAX_SHORES }, (_, i) => shores[i] ?? new Vector4());
  const water = new ShaderMaterial({
    vertexShader: waterVertex,
    fragmentShader: waterFragment,
    transparent: false,
    uniforms: {
      uDeep: { value: new Color().copy(day.deep) },
      uShallow: { value: new Color().copy(day.shallow) },
      uFoam: { value: new Color().copy(day.foam) },
      uSunDir: { value: new Vector3(...opts.sunDir).normalize() },
      uShores: { value: shoreUniform },
      uShoreCount: { value: shores.length },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
    },
  });
  const waterGeo = new SphereGeometry(radius, 128, 96);
  spinGroup.add(new Mesh(waterGeo, water));
  disposables.push(water, waterGeo);

  // Nubes: giran por su cuenta, un poco por encima del agua.
  const clouds = new Group();
  const cloudMat = new MeshLambertMaterial({
    color: '#ffffff',
    flatShading: true,
    transparent: true,
    opacity: 0.92,
  });
  disposables.push(cloudMat);
  const rnd = rng(opts.clouds.seed);
  for (let i = 0; i < opts.clouds.count; i++) {
    const geo = cloudGeometry(rnd);
    disposables.push(geo);
    const m = new Mesh(geo, cloudMat);
    const lon = rnd() * Math.PI * 2;
    const lat = (rnd() * 2 - 1) * 1.05;
    const d = dirOf(lon, lat);
    const lift = radius * (1 + opts.clouds.lift * (0.8 + rnd() * 0.4));
    m.position.set(d[0] * lift, d[1] * lift, d[2] * lift);
    m.lookAt(0, 0, 0);
    m.rotateX(-Math.PI / 2);
    m.scale.setScalar(radius * (0.07 + rnd() * 0.05));
    clouds.add(m);
  }
  group.add(clouds);

  // Halo: el aire alrededor del agua.
  const haloR = radius * 1.09;
  const halo = new ShaderMaterial({
    vertexShader: haloVertex,
    fragmentShader: haloFragment,
    side: BackSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uColor: { value: new Color('#9fdcff') },
      uEdge: { value: Math.sqrt(1 - (radius / haloR) ** 2) },
      uOpacity: { value: 1 },
    },
  });
  const haloGeo = new SphereGeometry(haloR, 64, 32);
  group.add(new Mesh(haloGeo, halo));
  disposables.push(halo, haloGeo);

  return {
    group,
    radius,
    islands,
    pose(spin, tilt, cloudSpin, time) {
      group.rotation.set(tilt, 0, 0);
      spinGroup.rotation.set(0, spin, 0);
      clouds.rotation.set(0, cloudSpin, 0);
      water.uniforms.uTime!.value = time;
    },
    setOpacity(alpha) {
      const a = Math.max(0, Math.min(1, alpha));
      group.visible = a > 0.001;
      const fading = a < 0.999;
      for (const m of [lit, glow, water, cloudMat]) {
        if (m.transparent !== fading && m !== cloudMat) {
          m.transparent = fading;
          m.needsUpdate = true;
        }
      }
      lit.opacity = a;
      glow.opacity = a;
      cloudMat.opacity = 0.92 * a;
      water.uniforms.uOpacity!.value = a;
      halo.uniforms.uOpacity!.value = a;
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
