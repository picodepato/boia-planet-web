import type { IntroFrame, IntroSceneHandle, PlanetIntroConfig } from '@boia/engine/intro';
import {
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  HalfFloatType,
  HemisphereLight,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { marWorld } from '../../app/mar/engine/compact';
import { liveWorld } from '../admin/live-world';
import { worlds } from '../mundo/demo-world';
import { gameRepository } from '../mundo/repo';
import { adminWorldId, currentWorld } from '../mundo/world-choice';
import { buildMiniPlanet } from './mini-planet';
import { rng } from '../../app/mar/engine/kit';
import { buildSeaRig } from './sea-rig';
import type { Vec3 } from './sphere-map';

/**
 * The landing hero's scene (T57; plan 007 T79): one renderer, two rigs. The
 * orthographic rig is `/mar`'s whole planet over space (its pose comes from
 * the frame in CSS px of the view); the perspective rig is the sea by the
 * port (`sea-rig.ts`). The frame says how much of each (`sea`), the golden
 * haze of the dive (`haze`), the scroll `s` and the light. A post pass mixes
 * the two, adds the haze, a vignette and film grain (T77 §6 L2d). Loaded on
 * demand (nothing here is in the landing's critical path).
 *
 * El mundo es el de este navegador (`?mundo=`, el elegido o el activo del
 * Admin, con sus cambios), a la escala de `/mar`: las mismas islas que se
 * ven al zarpar.
 */

/** Marca del bundle de la escena (las pruebas la bloquean por ella). */
export const INTRO_SCENE_MARK = 'boia-intro-scene';

export interface IntroSceneOptions {
  canvas: HTMLCanvasElement;
  config: PlanetIntroConfig;
  width: number;
  height: number;
  /** Píxeles de dispositivo por px CSS (con tope). */
  resolution: number;
  /** `location.search`: el mundo pedido con `?mundo=`. */
  search: string;
  /** The sea props arrived (how many were placed). */
  onProps?(count: number): void;
}

export interface IntroScene extends IntroSceneHandle {
  /** GPU con la que pinta (SwiftShader = por software). */
  readonly renderer: string;
  readonly worldId: string;
  readonly islands: number;
  /** Ids de las islas del planeta: las de `/mar` (T64). */
  readonly islandIds: readonly string[];
  resize(width: number, height: number): void;
}

/**
 * Hacia el sol, en el espacio de la cámara: from the upper left and to the
 * side, so the planet shows its terminator (plan 007 T79, T77 frame 01).
 */
const SUN: Vec3 = [-0.78, 0.5, 0.38];
const STARS = 160;
/** Space behind the planet (T77 §3.1, `--scene-space-sky`). */
const SPACE = '#070a1c';
const HAZE = '#d8a08a';

function gpuName(renderer: WebGLRenderer): string {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  } catch {
    return 'desconocido';
  }
}

/** Estrellas fijas en la vista, en [-0,5, 0,5]² (se escalan al tamaño de la vista). */
function starField(): Points {
  const rnd = rng(20261001);
  const pos: number[] = [];
  const col: number[] = [];
  for (let i = 0; i < STARS; i++) {
    pos.push(rnd() - 0.5, rnd() - 0.5, 0);
    const b = 0.25 + rnd() * 0.55;
    col.push(b, b, b * (0.9 + rnd() * 0.1));
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  const mat = new PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true });
  const points = new Points(geo, mat);
  points.position.z = -9000;
  points.frustumCulled = false;
  return points;
}

const postVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/** Mix of the two rigs, golden haze, vignette and grain (T77 §3.1: 0.45 and 6–8 %). */
const postFragment = /* glsl */ `
  uniform sampler2D tPlanet;
  uniform sampler2D tSea;
  uniform float uSea;
  uniform float uHaze;
  uniform vec3 uHazeColor;
  uniform float uAtmos;
  uniform float uTime;
  uniform vec2 uRes;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec3 planet = texture2D(tPlanet, vUv).rgb;
    // The hero's grade of /mar's planet (T77 frame 01): cooler, less saturated,
    // darker; the game's colours stay a hint under the night.
    float luma = dot(planet, vec3(0.2126, 0.7152, 0.0722));
    planet = mix(vec3(luma), planet, 0.7) * vec3(0.7, 0.78, 0.98);
    // Through the atmosphere (T77 §7.2, s 0.25 → 0.85): the blue band thickens
    // and the exposure rises; the planet's surface goes soft under it.
    vec3 atmos = mix(vec3(0.11, 0.17, 0.36), vec3(0.42, 0.52, 0.72), 1.0 - vUv.y);
    planet = mix(planet * (1.0 + 0.4 * uAtmos), atmos, uAtmos * 0.78);
    vec3 col = mix(planet, texture2D(tSea, vUv).rgb, uSea);
    // The golden haze of the atmosphere: thicker low on the screen.
    col = mix(col, uHazeColor * (0.85 + 0.3 * (1.0 - vUv.y)), uHaze * 0.92);
    vec2 c = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    col *= 1.0 - 0.45 * smoothstep(0.35, 1.05, length(c) * 1.15);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    gl_FragColor.rgb += (hash(vUv * uRes + fract(uTime) * 61.0) - 0.5) * 0.07;
  }
`;

export async function createIntroScene(opts: IntroSceneOptions): Promise<IntroScene> {
  const { canvas, config } = opts;
  const chosen = currentWorld(opts.search, await adminWorldId());
  const live = await liveWorld(gameRepository(), worlds, chosen);
  const world = marWorld(live.config);

  // Sin WebGL, esto lanza: el controlador se queda con la versión estática.
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
    depth: false,
  });
  canvas.dataset.scene = INTRO_SCENE_MARK;
  renderer.setPixelRatio(opts.resolution);

  // The planet over space (orthographic, CSS px of the view).
  const scene = new Scene();
  scene.background = new Color(SPACE);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 1, 20000);
  camera.position.set(0, 0, 10000);
  camera.lookAt(0, 0, 0);
  // A key from the upper left and little fill: the planet against the light (T77 frame 01).
  const hemi = new HemisphereLight('#c8d4ff', '#0b1230', 0.4);
  const sun = new DirectionalLight('#fff1d6', 2.6);
  sun.position.set(SUN[0], SUN[1], SUN[2]);
  scene.add(hemi, sun);
  const planet = buildMiniPlanet({
    world,
    sea: live.theme.sea,
    islands: config.islands,
    clouds: config.clouds,
    sunDir: SUN,
  });
  scene.add(planet.group);
  const stars = starField();
  scene.add(stars);

  // The sea by the port (perspective).
  const sea = buildSeaRig(opts.width, opts.height);

  // Render targets (with MSAA) and the post pass.
  const rtOpts = { samples: 4, type: HalfFloatType, depthBuffer: true } as const;
  const rtPlanet = new WebGLRenderTarget(1, 1, rtOpts);
  const rtSea = new WebGLRenderTarget(1, 1, rtOpts);
  const post = new ShaderMaterial({
    vertexShader: postVertex,
    fragmentShader: postFragment,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tPlanet: { value: rtPlanet.texture },
      tSea: { value: rtSea.texture },
      uSea: { value: 0 },
      uHaze: { value: 0 },
      uHazeColor: { value: new Color(HAZE) },
      uAtmos: { value: 0 },
      uTime: { value: 0 },
      uRes: { value: new Vector2(1, 1) },
    },
  });
  const quadGeo = new PlaneGeometry(2, 2);
  const quad = new Mesh(quadGeo, post);
  quad.frustumCulled = false;
  const postScene = new Scene();
  postScene.add(quad);

  let width = 1;
  let height = 1;
  const resize = (w: number, h: number) => {
    width = Math.max(1, w);
    height = Math.max(1, h);
    renderer.setSize(width, height, false);
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    stars.scale.set(width, height, 1);
    sea.resize(width, height);
    const px = Math.round(width * opts.resolution);
    const py = Math.round(height * opts.resolution);
    rtPlanet.setSize(px, py);
    rtSea.setSize(px, py);
    (post.uniforms.uRes!.value as Vector2).set(px, py);
  };
  resize(opts.width, opts.height);

  const draw = (f: IntroFrame, clock: number) => {
    const p = f.pose;
    const seaAmt = f.sea;
    if (seaAmt < 1) {
      planet.group.position.set(p.x - width / 2, height / 2 - p.y, 0);
      planet.group.scale.setScalar(p.radius / planet.radius);
      planet.pose(p.spin, p.tilt, p.spin * config.clouds.speed, clock);
      renderer.setRenderTarget(rtPlanet);
      renderer.render(scene, camera);
    }
    if (seaAmt > 0) {
      sea.update(Math.max(f.s, 0.84), f.light, clock);
      renderer.setRenderTarget(rtSea);
      renderer.render(sea.scene, sea.camera);
    }
    const u = post.uniforms;
    u.tPlanet!.value = (seaAmt < 1 ? rtPlanet : rtSea).texture;
    u.tSea!.value = (seaAmt > 0 ? rtSea : rtPlanet).texture;
    u.uSea!.value = seaAmt;
    u.uHaze!.value = f.haze;
    const a = Math.min(1, Math.max(0, (f.s - 0.12) / 0.5));
    u.uAtmos!.value = a * a * (3 - 2 * a);
    u.uTime!.value = clock;
    renderer.setRenderTarget(null);
    renderer.render(postScene, camera);
  };

  // Lista de verdad: shaders compilados y geometría en la GPU antes de la
  // aparición, para que el primer fotograma no se coma el principio.
  planet.group.scale.setScalar(Math.min(width, height) / 2 / planet.radius);
  sea.update(1, 0, 0);
  await Promise.all([
    renderer.compileAsync(scene, camera),
    renderer.compileAsync(sea.scene, sea.camera),
    renderer.compileAsync(postScene, camera),
  ]);

  let destroyed = false;
  // The props come after the first frame (T79): nothing waits for them.
  window.setTimeout(() => {
    if (destroyed) return;
    void sea.loadProps().then((n) => {
      if (!destroyed) opts.onProps?.(n);
    });
  }, 0);

  return {
    renderer: gpuName(renderer),
    worldId: live.id,
    islands: planet.islands,
    islandIds: planet.islandIds,
    // «Zarpar» se zambulle en el puerto de salida de /mar (T64).
    focus: planet.focus,
    resize,
    render(f: IntroFrame, clock: number) {
      if (!destroyed) draw(f, clock);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      planet.dispose();
      sea.dispose();
      stars.geometry.dispose();
      (stars.material as PointsMaterial).dispose();
      rtPlanet.dispose();
      rtSea.dispose();
      post.dispose();
      quadGeo.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
