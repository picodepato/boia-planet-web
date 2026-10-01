import type { IntroFrame, IntroSceneHandle, PlanetIntroConfig } from '@boia/engine/intro';
import {
  BufferGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  HemisphereLight,
  OrthographicCamera,
  Points,
  PointsMaterial,
  Scene,
  WebGLRenderer,
} from 'three';
import { marWorld } from '../../app/mar/engine/compact';
import { liveWorld } from '../admin/live-world';
import { worlds } from '../mundo/demo-world';
import { gameRepository } from '../mundo/repo';
import { adminWorldId, currentWorld } from '../mundo/world-choice';
import { buildMiniPlanet } from './mini-planet';
import { rng } from '../../app/mar/engine/kit';
import type { Vec3 } from './sphere-map';

/**
 * La escena de la entrada de la landing (T57): el planeta de `/mar` entero,
 * con three.js, sobre el espacio. Se carga bajo demanda (nada de esto va en
 * la ruta crítica de la landing) y sólo pinta lo que dice el fotograma de la
 * línea de tiempo (`@boia/engine/intro`): dónde está el planeta, cuánto mide,
 * cuánto gira y se inclina. Cámara ortográfica en px CSS de la vista: el
 * fotograma y la escena hablan en las mismas unidades.
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
}

export interface IntroScene extends IntroSceneHandle {
  /** GPU con la que pinta (SwiftShader = por software). */
  readonly renderer: string;
  readonly worldId: string;
  readonly islands: number;
  resize(width: number, height: number): void;
}

/** Hacia el sol, en el espacio de la cámara: arriba a la izquierda y por delante. */
const SUN: Vec3 = [-0.55, 0.65, 0.75];
const STARS = 160;

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
    const b = 0.35 + rnd() * 0.65;
    col.push(b, b, b * (0.9 + rnd() * 0.1));
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  const mat = new PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true });
  const points = new Points(geo, mat);
  points.position.z = -9000;
  points.frustumCulled = false;
  return points;
}

export async function createIntroScene(opts: IntroSceneOptions): Promise<IntroScene> {
  const { canvas, config } = opts;
  const chosen = currentWorld(opts.search, await adminWorldId());
  const live = await liveWorld(gameRepository(), worlds, chosen);
  const world = marWorld(live.config);

  // Sin WebGL, esto lanza: el controlador se queda con la landing ligera.
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
    stencil: false,
  });
  canvas.dataset.scene = INTRO_SCENE_MARK;
  renderer.setPixelRatio(opts.resolution);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 1, 20000);
  camera.position.set(0, 0, 10000);
  camera.lookAt(0, 0, 0);

  const hemi = new HemisphereLight('#fff3e2', '#3b4f8f', 1.35);
  const sun = new DirectionalLight('#fff1d6', 2.2);
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
  };
  resize(opts.width, opts.height);

  // Lista de verdad: shaders compilados y geometría en la GPU antes de la
  // aparición, para que el primer fotograma no se coma el principio.
  planet.group.scale.setScalar(Math.min(width, height) / 2 / planet.radius);
  await renderer.compileAsync(scene, camera);
  renderer.render(scene, camera);
  renderer.clear();

  let destroyed = false;
  return {
    renderer: gpuName(renderer),
    worldId: live.id,
    islands: planet.islands,
    resize,
    render(f: IntroFrame, clock: number) {
      if (destroyed) return;
      const p = f.pose;
      planet.group.position.set(p.x - width / 2, height / 2 - p.y, 0);
      planet.group.scale.setScalar(p.radius / planet.radius);
      planet.pose(p.spin, p.tilt, p.spin * config.clouds.speed, clock);
      planet.setOpacity(f.planet);
      renderer.render(scene, camera);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      planet.dispose();
      stars.geometry.dispose();
      (stars.material as PointsMaterial).dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
