import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector4,
} from 'three';
import { PLANET_PARS, planetUniforms } from './planet';
import { SEA_WAVE_MAX, WAVES_GLSL } from './waves';
import { wrapD } from './wrap';

/**
 * El agua del planeta de `/mar` (D-22): una malla en anillos alrededor de la
 * cámara (densa cerca, rala lejos) que se curva hacia el horizonte con el
 * resto del planeta, con un shader propio, sin texturas ni geometría de olas
 * (en móvil, lo que cuenta es el píxel). Bajíos turquesa alrededor de cada
 * isla (en su copia más cercana: el mar da la vuelta), espuma que late en la
 * orilla, bandas de ola y destellos que se apagan de lejos. Sin costas: el
 * mar no se acaba. Niebla de three.js para que el horizonte se funda.
 *
 * Con olas (T298, `waves.ts`): el vértice sube y baja con unas pocas olas
 * suaves (calmadas junto a las orillas) y el píxel se aclara u oscurece con
 * su pendiente. Sin olas, los shaders son los de antes, letra por letra.
 */

export const MAX_SHORES = 32;

/** Radio de la malla del agua (unidades de escena): cubre también la vista de mapa. */
const WATER_RADIUS = 2600;
const RINGS = 56;
const SEGMENTS = 128;

/** Lo que mide el paso entre anillos a `r` de la cámara, en fracción de `r` (ver `ringGrid`). */
const RING_STEP = 0.165;

function vertexShader(waves: boolean): string {
  const pars = waves
    ? `
  uniform float uTime;
  uniform float uWaveAmp;
  uniform vec4 uShores[${MAX_SHORES}];
  uniform int uShoreCount;
  ${WAVES_GLSL}`
    : '';
  const lift = waves
    ? `
    if (uWaveAmp > 0.001) {
      // El oleaje (T298): la malla sigue a la cámara, así que cada vértice
      // apaga las olas que su paso entre anillos ya no puede dibujar.
      float d = 1e4;
      for (int i = 0; i < ${MAX_SHORES}; i++) {
        if (i >= uShoreCount) break;
        vec4 s = uShores[i];
        d = min(d, length(world.xz - s.xy) - s.z);
      }
      float spacing = ${RING_STEP} * length(world.xz - cameraPosition.xz);
      world.y += seaWave(world.xz, uTime, spacing).x * uWaveAmp * seaCalm(d);
    }`
    : '';
  return /* glsl */ `
  #include <fog_pars_vertex>
  ${PLANET_PARS}
  varying vec3 vWorld;${pars}
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;${lift}
    vec3 bent = planetCurve(world.xyz);
    vec4 mvPosition = viewMatrix * vec4(bent, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
}

function fragmentShader(waves: boolean): string {
  const pars = waves
    ? `
  uniform float uWaveAmp;
  ${WAVES_GLSL}`
    : '';
  const shade = waves
    ? `

    // El oleaje (T298): la cara que mira a la cámara, más clara; el seno,
    // más oscuro; las crestas, hacia el bajío. Calmado junto a la orilla.
    if (uWaveAmp > 0.001) {
      vec3 sw = seaWave(p, uTime, fwidth(p.x) * 6.0) * uWaveAmp * seaCalm(d);
      col *= 1.0 + clamp(-sw.z * 1.6 + sw.y * 0.5, -0.18, 0.18);
      col = mix(col, uShallow * 1.12, smoothstep(0.25, 0.85, sw.x / ${SEA_WAVE_MAX.toFixed(4)}) * 0.22);
    }`
    : '';
  return /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  uniform vec4 uShores[${MAX_SHORES}];
  uniform int uShoreCount;
  uniform float uSparkle;
  // Viento del tiempo (T268): rayas de espuma a favor del viento (0: nada).
  uniform float uWind;
  uniform vec2 uWindDir;
  varying vec3 vWorld;${pars}

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    vec2 p = vWorld.xz;
    // d: distancia a la orilla más cercana; dn: la misma, en anchos de bajío
    // de esa orilla (una roca tiene un bajío corto, una isla uno ancho).
    float d = 1e4;
    float dn = 1e4;
    for (int i = 0; i < ${MAX_SHORES}; i++) {
      if (i >= uShoreCount) break;
      // Ya en su copia más cercana y sólo las que se ven (Water.update).
      vec4 s = uShores[i];
      float di = length(p - s.xy) - s.z;
      d = min(d, di);
      dn = min(dn, di / s.w);
    }

    float n = noise(p * 0.35 + uTime * 0.05);
    float dd = d + (n - 0.5) * 1.4;
    float shallow = 1.0 - smoothstep(0.0, 1.0, dn + (n - 0.5) * 0.14);
    vec3 col = mix(uDeep, uShallow, shallow * 0.9);

    // Manchas grandes: el mar no es un color plano.
    float big = noise(p * 0.018 + vec2(uTime * 0.008, 0.0));
    col *= 0.9 + big * 0.2;${shade}

    // Olitas dibujadas: trazos cortos y casi horizontales que se mecen,
    // más visibles cerca (la derivada dice cuánto mide un píxel).
    float fw = fwidth(p.x);
    float detail = 1.0 - smoothstep(0.12, 0.7, fw);
    float w1 = sin(dot(p, vec2(0.22, 0.975)) * 1.5 + uTime * 1.1 + noise(p * 0.18) * 5.0);
    float w2 = sin(dot(p, vec2(-0.3, 0.95)) * 1.1 - uTime * 0.8 + noise(p * 0.13 + 7.0) * 5.0);
    float dash1 = smoothstep(0.6, 0.74, noise(p * vec2(1.1, 1.6) + vec2(uTime * 0.06, 0.0)));
    float dash2 = smoothstep(0.62, 0.76, noise(p * vec2(1.0, 1.5) + vec2(3.0, uTime * 0.05)));
    float crest = max(smoothstep(0.93, 0.99, w1) * dash1, smoothstep(0.94, 0.995, w2) * dash2 * 0.7);
    col = mix(col, uFoam, crest * detail * 0.45 * uSparkle);

    // Levante (T268): rayas largas de espuma que corren con el viento.
    if (uWind > 0.001) {
      vec2 wa = vec2(dot(p, uWindDir), dot(p, vec2(-uWindDir.y, uWindDir.x)));
      float streak = noise(vec2(wa.x * 0.07 - uTime * 0.9, wa.y * 0.9));
      streak = smoothstep(0.72, 0.9, streak) * smoothstep(0.35, 0.7, noise(p * 0.05 + 11.0));
      col = mix(col, uFoam, streak * uWind * (0.25 + detail * 0.35));
    }

    // Espuma de la orilla: una línea que respira y salpicones.
    float breathe = sin(uTime * 1.3 + n * 6.0) * 0.4;
    float foamLine = 1.0 - smoothstep(0.0, 0.75 + fw, abs(dd - 0.6 - breathe));
    float spray = (1.0 - smoothstep(0.0, 2.8, dd)) * step(0.58, noise(p * 1.7 + uTime * 0.3));
    col = mix(col, uFoam, clamp(foamLine * 0.85 + spray * 0.45, 0.0, 1.0) * (dd > -0.5 ? 1.0 : 0.0));

    // Destellos: estrellitas que parpadean sobre el agua.
    vec2 q = p * 0.8;
    vec2 cell = floor(q);
    vec2 f = fract(q);
    float h = hash(cell);
    vec2 c = vec2(hash(cell + 3.1), hash(cell + 7.7)) * 0.7 + 0.15;
    float tw = sin(uTime * 2.2 + h * 40.0) * 0.5 + 0.5;
    vec2 e = (f - c) * vec2(1.0, 2.4);
    float sp = smoothstep(0.1, 0.0, length(e)) * step(0.7, h) * tw;
    col += uFoam * sp * detail * uSparkle;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;
}

/** Los dos shaders del agua, con o sin olas (las pruebas comparan las dos versiones). */
export function waterShaders(waves: boolean): { vertex: string; fragment: string } {
  return { vertex: vertexShader(waves), fragment: fragmentShader(waves) };
}

export interface Water {
  mesh: Mesh;
  material: ShaderMaterial;
  /** Si el shader lleva olas (T298): entonces `uWaveAmp` dice cuántas. */
  waves: boolean;
  /** Orillas: centro (en el mapa), radio y ancho del bajío. */
  setShores(shores: readonly { x: number; z: number; r: number; w?: number }[]): void;
  /**
   * Cada fotograma: cada orilla en su copia más cercana a `focus` (el mar da
   * la vuelta) y sólo las que quedan a menos de `reach` de `eye`, las más
   * cercanas primero: el agua hace menos cuentas por píxel.
   */
  update(
    focus: { x: number; z: number },
    period: { w: number; h: number },
    eye: { x: number; z: number },
    reach: number,
  ): void;
}

/** Anillos alrededor del origen, cada vez más separados: la curva es suave cerca y barata lejos. */
function ringGrid(): BufferGeometry {
  const pos: number[] = [0, 0, 0];
  const r0 = 0.6;
  const k = Math.pow(WATER_RADIUS / r0, 1 / (RINGS - 1));
  for (let i = 0; i < RINGS; i++) {
    const r = r0 * Math.pow(k, i);
    for (let j = 0; j < SEGMENTS; j++) {
      const a = (j / SEGMENTS) * Math.PI * 2;
      pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < SEGMENTS; j++) idx.push(0, 1 + ((j + 1) % SEGMENTS), 1 + j);
  for (let i = 0; i < RINGS - 1; i++) {
    const a = 1 + i * SEGMENTS;
    const b = a + SEGMENTS;
    for (let j = 0; j < SEGMENTS; j++) {
      const j1 = (j + 1) % SEGMENTS;
      idx.push(a + j, a + j1, b + j, a + j1, b + j1, b + j);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  return g;
}

export function createWater(opts: { waves?: boolean } = {}): Water {
  const waves = opts.waves ?? false;
  const shaders = waterShaders(waves);
  const shores = Array.from({ length: MAX_SHORES }, () => new Vector4(0, 0, 0, 0));
  const material = new ShaderMaterial({
    vertexShader: shaders.vertex,
    fragmentShader: shaders.fragment,
    fog: true,
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDeep: { value: new Color('#1a7aa6') },
        uShallow: { value: new Color('#3aa3c4') },
        uFoam: { value: new Color('#f4efe6') },
        uShores: { value: shores },
        uShoreCount: { value: 0 },
        uSparkle: { value: 0.9 },
        uWind: { value: 0 },
        uWindDir: { value: new Vector2(-1, 0) },
        ...(waves ? { uWaveAmp: { value: 0 } } : {}),
      },
    ]),
  });
  // UniformsUtils.merge clona: se vuelven a poner el array y los del planeta para editarlos en sitio.
  material.uniforms.uShores!.value = shores;
  Object.assign(material.uniforms, planetUniforms);
  material.userData.planet = 'skip';
  // La malla sigue a la cámara (Mar3D la mueve): el dibujo del agua va en coordenadas del mundo.
  const mesh = new Mesh(ringGrid(), material);
  mesh.frustumCulled = false;
  let all: { x: number; z: number; r: number; w: number }[] = [];
  const near: { x: number; z: number; r: number; w: number; d: number }[] = [];
  return {
    mesh,
    material,
    waves,
    setShores(list) {
      all = list.map((s) => ({ x: s.x, z: s.z, r: s.r, w: s.w ?? 10 }));
    },
    update(focus, period, eye, reach) {
      near.length = 0;
      for (const s of all) {
        const x = focus.x + wrapD(s.x - focus.x, period.w);
        const z = focus.z + wrapD(s.z - focus.z, period.h);
        const d = Math.hypot(x - eye.x, z - eye.z) - s.r - s.w;
        if (d < reach) near.push({ x, z, r: s.r, w: s.w, d });
      }
      near.sort((a, b) => a.d - b.d);
      const n = Math.min(near.length, MAX_SHORES);
      for (let i = 0; i < n; i++) {
        const s = near[i]!;
        shores[i]!.set(s.x, s.z, s.r, s.w);
      }
      material.uniforms.uShoreCount!.value = n;
    },
  };
}
