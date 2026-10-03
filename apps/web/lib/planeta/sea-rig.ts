import type { Material, Mesh, MeshStandardMaterial, Object3D } from 'three';
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  Color,
  ConeGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh as ThreeMesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * The sea of the landing hero (plan 007 T79; T77 §3, §6, §7): the port of
 * Alicante at golden hour, then open water into the night, seen from the
 * deck of a boat. Code paints the water (fresnel sky reflection, the sun or
 * moon path), the sky (gradient by mood, sun, moon, stars) and the horizon
 * islands; T78's GLB props (costa, puerto, barco, boya) come after the first
 * frame, laid out by the manifest's `escena` block. Everything is a function
 * of the scroll `s` (viewport heights), the light (0 golden hour → 1 night)
 * and the clock (water and bobbing). Art is `muestra` until Álvaro approves.
 */

const ART = '/api/art/landing/3d';
const DEG = Math.PI / 180;

/** A mood of the hero's cinematic grade (T77 §3.1), sRGB hex. */
interface MoodHex {
  zenith: string;
  sky: string;
  horizon: string;
  haze: string;
  deep: string;
  far: string;
  glint: string;
  key: string;
}

const GOLDEN: MoodHex = {
  zenith: '#1e2250',
  sky: '#6a4a78',
  horizon: '#e49a6a',
  haze: '#d8a08a',
  deep: '#0a1a33',
  far: '#2a3f66',
  glint: '#ffc98a',
  key: '#ffd9a0',
};
const DUSK: MoodHex = {
  zenith: '#0b0e2c',
  sky: '#2c2650',
  horizon: '#8a5a62',
  haze: '#6a4a5c',
  deep: '#07122a',
  far: '#1b2a4d',
  glint: '#d8a07a',
  key: '#d8a07a',
};
const NIGHT: MoodHex = {
  zenith: '#02030a',
  sky: '#070b22',
  horizon: '#141a3a',
  haze: '#11183a',
  deep: '#040a18',
  far: '#0d1a36',
  glint: '#9fb0e8',
  key: '#c8d4ff',
};
const KEYS = Object.keys(GOLDEN) as (keyof MoodHex)[];
type Mood = Record<keyof MoodHex, Color>;
const toMood = (m: MoodHex): Mood =>
  Object.fromEntries(KEYS.map((k) => [k, new Color(m[k])])) as Mood;
const MOODS = [toMood(GOLDEN), toMood(DUSK), toMood(NIGHT)] as const;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const u = clamp01((v - a) / (b - a));
  return u * u * (3 - 2 * u);
};

/** Camera framing per width (T77 §5.2): vertical FOV and where the horizon sits. */
function framing(width: number): { fov: number; horizon: number } {
  if (width >= 900) return { fov: 40, horizon: 0.42 };
  if (width >= 600) return { fov: 48, horizon: 0.4 };
  return { fov: 55, horizon: 0.38 };
}

/** Metres sailed at scroll `s` (≥ 1): out of the harbour mouth, then slowly on. */
export function sailed(s: number): number {
  const t = Math.max(0, s - 1);
  return 230 * (1 - Math.exp(-t / 0.9)) + 25 * t;
}

const GLSL_COMMON = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uSky;
  uniform vec3 uHorizon;
  uniform vec3 uHaze;
  vec3 skyAt(vec3 d) {
    float e = max(d.y, 0.0);
    vec3 c = mix(uHorizon, uSky, smoothstep(0.0, 0.2, e));
    c = mix(c, uZenith, smoothstep(0.18, 0.8, e));
    return mix(c, uHaze, exp(-e * 16.0) * 0.6);
  }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragment = /* glsl */ `
  ${GLSL_COMMON}
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSun;
  uniform vec3 uMoonDir;
  uniform float uMoon;
  uniform float uStars;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    vec3 col = skyAt(d);
    float s = max(dot(d, uSunDir), 0.0);
    col += uSunColor * uSun * (smoothstep(0.99988, 0.99994, s) * 3.0 + pow(s, 2400.0) * 1.2
      + pow(s, 260.0) * 0.35 + pow(s, 18.0) * 0.12);
    float m = max(dot(d, uMoonDir), 0.0);
    col += vec3(0.86, 0.9, 1.0) * uMoon * (smoothstep(0.99992, 0.99996, m) * 2.0
      + pow(m, 3000.0) * 0.6 + pow(m, 160.0) * 0.12);
    // Fine stars, only above the haze.
    vec2 g = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0))) * 380.0;
    vec2 cell = floor(g);
    float h = hash2(cell);
    float star = step(0.9935, h) * smoothstep(0.34, 0.05, length(fract(g) - 0.5));
    col += vec3(0.85, 0.9, 1.0) * star * uStars * (0.25 + 0.75 * pow(hash2(cell + 3.1), 3.0))
      * smoothstep(0.03, 0.25, d.y);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const waterVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const waterFragment = /* glsl */ `
  ${GLSL_COMMON}
  uniform vec3 uDeep;
  uniform vec3 uFar;
  uniform vec3 uGlint;
  uniform vec3 uSunDir;
  uniform float uSun;
  uniform float uTime;
  uniform float uFog;
  varying vec3 vWorld;
  // Slope of one directional wave (Gerstner-like swell, summed as normals).
  vec2 wave(vec2 p, vec2 dir, float k, float speed, float amp) {
    return amp * k * cos(dot(p, dir) * k + uTime * speed) * dir;
  }
  void main() {
    vec3 toCam = cameraPosition - vWorld;
    float dist = length(toCam);
    vec3 V = toCam / dist;
    vec2 p = vWorld.xz;
    // Fine ripples fade out with distance (no aliasing on the far water).
    float near = 1.0 / (1.0 + dist * 0.012);
    float far = 1.0 / (1.0 + dist * 0.0015);
    vec2 g = (wave(p, vec2(0.287, 0.958), 0.055, 0.8, 0.42)
      + wave(p, vec2(-0.759, 0.651), 0.12, 1.25, 0.16)
      + wave(p, vec2(0.976, 0.217), 0.27, 1.9, 0.07)
      + wave(p, vec2(-0.196, -0.981), 0.6, 2.7, 0.03)) * mix(0.45, 1.0, far)
      + (wave(p, vec2(0.6, 0.8), 1.3, 3.6, 0.016)
      + wave(p, vec2(-0.894, 0.447), 2.3, 4.6, 0.009)
      + wave(p, vec2(0.124, -0.992), 3.7, 5.7, 0.006)
      + wave(p, vec2(0.95, -0.31), 5.9, 7.1, 0.0035)) * near;
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 R = reflect(-V, n);
    R.y = abs(R.y);
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
    float sd = max(dot(R, uSunDir), 0.0);
    vec3 spec = uGlint * uSun * (pow(sd, 1400.0) * 22.0 + pow(sd, 160.0) * 1.4 + pow(sd, 22.0) * 0.12);
    vec3 body = mix(uDeep, uFar, smoothstep(30.0, 1600.0, dist));
    vec3 col = mix(body, skyAt(R) * 0.9, fres) + spec;
    col = mix(col, uHaze, (1.0 - exp(-dist * uFog)) * 0.9);
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** A soft round glow (sprite halos of the lights, the sun's bloom). */
function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

/** A light's reflection on the water: a thin vertical streak. */
function streakTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(4, 0, 8, 128);
  return new CanvasTexture(c);
}

interface Light {
  halo: Sprite;
  streak: Sprite;
  /** World position (updated with its prop). */
  at: Vector3;
  base: number;
  blink: boolean;
}

interface Manifest {
  escena: {
    props: Record<string, { position: [number, number, number]; yaw_deg: number }>;
    sun: { azimuth_deg: number; elevation_deg: number };
    moon: { azimuth_deg: number; elevation_deg: number };
  };
  props: {
    id: string;
    file: string;
    lights: { node: string; color: string; position: [number, number, number] }[];
  }[];
}

const dirOf = (azDeg: number, elDeg: number) =>
  new Vector3(
    Math.sin(azDeg * DEG) * Math.cos(elDeg * DEG),
    Math.sin(elDeg * DEG),
    -Math.cos(azDeg * DEG) * Math.cos(elDeg * DEG),
  );

export interface SeaRig {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** Pose and light for scroll `s`, light 0..1 and the clock (s). */
  update(s: number, light: number, clock: number): void;
  resize(width: number, height: number): void;
  /** T78's props, after the first frame; resolves with how many were placed. */
  loadProps(): Promise<number>;
  dispose(): void;
}

export function buildSeaRig(width: number, height: number): SeaRig {
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, width / height, 0.5, 9000);
  const fog = new Fog(0x000000, 120, 3600);
  scene.fog = fog;
  const disposables: { dispose(): void }[] = [];
  const mood: Mood = toMood(GOLDEN);
  let sunDir = dirOf(10.6, 4);
  let moonDir = dirOf(10.6, 4);

  // Sky dome, centred on the camera.
  const common = {
    uZenith: { value: mood.zenith },
    uSky: { value: mood.sky },
    uHorizon: { value: mood.horizon },
    uHaze: { value: mood.haze },
  };
  const skyMat = new ShaderMaterial({
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      ...common,
      uSunDir: { value: sunDir },
      uSunColor: { value: new Color('#ffd9a0') },
      uSun: { value: 1 },
      uMoonDir: { value: moonDir },
      uMoon: { value: 0 },
      uStars: { value: 0.25 },
    },
  });
  const skyGeo = new SphereGeometry(8000, 32, 16);
  const sky = new ThreeMesh(skyGeo, skyMat);
  sky.renderOrder = -2;
  scene.add(sky);
  disposables.push(skyMat, skyGeo);

  // The water: a big plane that follows the camera.
  const waterMat = new ShaderMaterial({
    vertexShader: waterVertex,
    fragmentShader: waterFragment,
    fog: false,
    uniforms: {
      ...common,
      uDeep: { value: mood.deep },
      uFar: { value: mood.far },
      uGlint: { value: mood.glint },
      uSunDir: { value: sunDir },
      uSun: { value: 1 },
      uTime: { value: 0 },
      uFog: { value: 0.0006 },
    },
  });
  const waterGeo = new PlaneGeometry(16000, 16000);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new ThreeMesh(waterGeo, waterMat);
  water.renderOrder = -1;
  scene.add(water);
  disposables.push(waterMat, waterGeo);

  // Light for the props: the sun (or the moon) against the camera, and the sky.
  const key = new DirectionalLight('#ffd9a0', 1.6);
  const hemi = new HemisphereLight('#6a4a78', '#0a1a33', 0.6);
  scene.add(key, hemi);

  const glowTex = glowTexture();
  const streakTex = streakTexture();
  disposables.push(glowTex, streakTex);

  // The sun's bloom (a big soft sprite) and the moon's.
  const bloomMat = new SpriteMaterial({
    map: glowTex,
    color: '#ffc98a',
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    fog: false,
    sizeAttenuation: false,
  });
  const bloom = new Sprite(bloomMat);
  bloom.renderOrder = -1;
  scene.add(bloom);
  disposables.push(bloomMat);

  // Horizon islands: dark shapes in the haze with warm lights at night.
  const isleMat = new MeshBasicMaterial({ color: '#05070f' });
  disposables.push(isleMat);
  const isles = new Group();
  const lights: Light[] = [];
  const addLight = (parent: Object3D, at: Vector3, color: string, base: number, blink = false) => {
    const mat = new SpriteMaterial({
      map: glowTex,
      color,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
      sizeAttenuation: false,
    });
    const halo = new Sprite(mat);
    halo.position.copy(at);
    parent.add(halo);
    const smat = new SpriteMaterial({
      map: streakTex,
      color,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      fog: false,
      opacity: 0.5,
    });
    const streak = new Sprite(smat);
    streak.center.set(0.5, 1);
    streak.position.set(at.x, 0, at.z);
    parent.add(streak);
    disposables.push(mat, smat);
    lights.push({ halo, streak, at, base, blink });
  };
  const ISLES: [number, number, number, number, string][] = [
    [-1350, -2600, 260, 46, '#ffb070'],
    [-380, -3300, 330, 60, '#ff7a4a'],
    [700, -2900, 280, 52, '#ff5ad0'],
    [1650, -3500, 360, 70, '#ffb070'],
  ];
  for (const [x, z, r, h, color] of ISLES) {
    const geo = new ConeGeometry(r, h, 9, 1, true);
    geo.translate(0, h / 2 - 4, 0);
    geo.scale(1.6, 1, 1);
    disposables.push(geo);
    const isle = new ThreeMesh(geo, isleMat);
    isle.position.set(x, 0, z);
    isles.add(isle);
    addLight(isles, new Vector3(x - r * 0.3, 8, z), color, 0.9);
    addLight(isles, new Vector3(x + r * 0.25, 6, z + 10), color, 0.7);
  }
  scene.add(isles);

  // T78's props (after the first frame).
  const props = new Group();
  scene.add(props);
  let boat: Object3D | null = null;
  let boatZ = -105;
  let loaded: Promise<number> | null = null;

  const placeProps = async (): Promise<number> => {
    const manifest = (await (await fetch(`${ART}/manifest.json`)).json()) as Manifest;
    const esc = manifest.escena;
    sunDir = dirOf(esc.sun.azimuth_deg, esc.sun.elevation_deg);
    moonDir = dirOf(esc.moon.azimuth_deg, esc.moon.elevation_deg);
    const loader = new GLTFLoader();
    let placed = 0;
    await Promise.all(
      manifest.props.map(async (p) => {
        const pose = esc.props[p.id];
        if (!pose) return;
        const root = (await loader.loadAsync(`${ART}/${p.file}`)).scene;
        root.traverse((o) => {
          const m = o as Mesh;
          if (!m.isMesh) return;
          if (!m.geometry.getAttribute('normal')) m.geometry.computeVertexNormals();
          const mat = m.material as MeshStandardMaterial;
          if (o.name.startsWith('luz_')) {
            mat.emissiveIntensity = 2.5;
            mat.fog = false;
          }
        });
        root.position.set(...pose.position);
        root.rotation.y = -pose.yaw_deg * DEG;
        props.add(root);
        for (const l of p.lights) {
          const at = new Vector3(...l.position);
          addLight(
            root,
            at,
            l.color,
            l.node.startsWith('luz_muelle') ? 0.55 : 1,
            l.node === 'luz_boya',
          );
        }
        if (p.id === 'barco') {
          boat = root;
          boatZ = pose.position[2];
        }
        placed++;
      }),
    );
    return placed;
  };

  const mixed = new Color();
  const setMood = (light: number) => {
    const a = light <= 0.5 ? MOODS[0] : MOODS[1];
    const b = light <= 0.5 ? MOODS[1] : MOODS[2];
    const u = light <= 0.5 ? light * 2 : (light - 0.5) * 2;
    for (const k of KEYS) mood[k].copy(a[k]).lerp(b[k], u);
    fog.color.copy(mood.haze);
    key.color.copy(mood.key);
    hemi.color.copy(mood.sky);
    hemi.groundColor.copy(mood.deep);
  };

  const resize = (w: number, h: number) => {
    const f = framing(w);
    camera.fov = f.fov;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Pitch that puts the horizon at its height on screen.
    deckPitch = Math.atan(2 * (0.5 - f.horizon) * Math.tan((f.fov / 2) * DEG));
  };
  let deckPitch = 3.33 * DEG;
  resize(width, height);

  return {
    scene,
    camera,
    update(s, light, clock) {
      setMood(light);
      // The sun sets on the way to the photos; the moon rises for the night.
      const sunUp = 1 - smooth(0.2, 0.5, light);
      const el = 4 - 7 * smooth(0.15, 0.5, light);
      const sun = dirOf(10.6, el);
      sunDir.copy(sun);
      const moon = smooth(0.55, 0.95, light);
      skyMat.uniforms.uSunDir!.value = sunDir;
      skyMat.uniforms.uSun!.value = sunUp;
      skyMat.uniforms.uSunColor!.value = mixed.copy(mood.key);
      skyMat.uniforms.uMoonDir!.value = moonDir;
      skyMat.uniforms.uMoon!.value = moon;
      skyMat.uniforms.uStars!.value = 0.25 + 0.75 * smooth(0.4, 1, light);
      // The water mirrors the sun, then the moon.
      waterMat.uniforms.uSunDir!.value = moon > sunUp ? moonDir : sunDir;
      waterMat.uniforms.uSun!.value = Math.max(sunUp, moon * 0.7);
      waterMat.uniforms.uTime!.value = clock;
      key.position.copy(moon > sunUp ? moonDir : sunDir).multiplyScalar(100);
      key.intensity = 0.4 + 1.2 * sunUp + 0.3 * moon;
      hemi.intensity = 0.25 + 0.45 * (1 - light);

      // Camera: down from the sky onto the deck (s 0.84 → 1), then along the water.
      const d = sailed(s);
      const u = smooth(0.84, 1, s);
      const down = 1 - u;
      const bob = Math.sin(clock * 0.9) * 0.12;
      camera.position.set(0, 10 + 260 * down * down + bob, 90 * down - d);
      camera.rotation.set(-(deckPitch + (58 * DEG - deckPitch) * down), 0, 0, 'YXZ');
      camera.updateMatrixWorld();
      sky.position.copy(camera.position);
      water.position.set(camera.position.x, 0, camera.position.z);
      if (boat) {
        boat.position.z = boatZ - d;
        boat.position.y = Math.sin(clock * 1.1) * 0.15;
        boat.rotation.z = Math.sin(clock * 0.7) * 0.02;
        boat.rotation.x = Math.sin(clock * 0.9 + 1) * 0.012;
      }
      // The sun's bloom: a soft disc around it on screen.
      bloom.position.copy(camera.position).addScaledVector(sunDir, 4000);
      bloom.scale.setScalar(0.55);
      bloomMat.opacity = 0.35 * sunUp;
      bloomMat.color.copy(mood.glint);
      // Lights: half at golden hour, full at night; the buoy blinks every 3 s.
      const glow = 0.5 + 0.5 * smooth(0.3, 0.9, light);
      const isleGlow = smooth(0.45, 0.9, light);
      const tmp = new Vector3();
      for (const l of lights) {
        const isle = l.halo.parent === isles;
        const on = l.blink ? (clock % 3 < 0.6 ? 1 : 0.15) : 1;
        const a = (isle ? isleGlow : glow) * l.base * on;
        (l.halo.material as SpriteMaterial).opacity = a;
        l.halo.getWorldPosition(tmp);
        const dist = tmp.distanceTo(camera.position);
        const size = Math.min(0.05, 0.01 + 2.2 / Math.max(dist, 1));
        l.halo.scale.setScalar(size);
        (l.streak.material as SpriteMaterial).opacity = a * 0.45;
        l.streak.scale.set(Math.max(0.6, dist * 0.004), Math.max(4, l.at.y * 1.8), 1);
      }
    },
    resize,
    loadProps() {
      loaded ??= placeProps().catch((err: unknown) => {
        console.warn('[boia] los modelos del mar no llegaron; el mar sigue sin ellos', err);
        return 0;
      });
      return loaded;
    },
    dispose() {
      props.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        for (const mat of Array.isArray(m.material) ? m.material : [m.material])
          (mat as Material).dispose();
      });
      for (const d of disposables) d.dispose();
    },
  };
}
