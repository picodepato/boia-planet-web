/**
 * PRUEBA DE TÉCNICA (T13): opción A de la intro «mini-mundo»
 * (docs/propuestas/2026-09-28-intro-mini-mundo.md §6, §8). Calidad de usar y
 * tirar, sólo para medir fps y decidir A/B; la carga la ruta de desarrollo
 * `/sphere-probe`. No es la entrada: T14 la construye sobre `timeline.ts`.
 *
 * Cómo funciona:
 * 1. Pinta una vez el mundo real (el mismo `WorldConfig`, arte, costas y
 *    barco que `/juego`) en una textura 2:1 que cubre el mundo entero.
 * 2. Un shader de Pixi (malla a pantalla completa) proyecta esa textura en un
 *    disco como si fuera un planeta: proyección ortográfica de una esfera de
 *    radio `rho / k`, con giro en longitud, inclinación, luz y atmósfera.
 * 3. Aterrizar es bajar `k` de 1 a 0 a la vez que sube el zoom
 *    (`sphere-probe-pose.ts`); en k = 0 el shader es la cámara plana del
 *    juego. Al final entra encima el mundo vivo, en el mismo encuadre.
 */
import { type WorldConfig } from '@boia/world';
import type {
  Application} from 'pixi.js';
import {
  Container,
  Geometry,
  Mesh,
  RenderTexture,
  Shader,
  type UniformGroup,
} from 'pixi.js';
import { loadShipManifest } from '../manifest-loader';
import { ShipSprite } from '../ship/view';
import { newApplication } from '../pixi-app';
import { Water } from '../water';
import { loadArt, manifestsOf } from '../world/assets';
import { createCoastView } from '../world/coast-view';
import { ObjectView } from '../world/object-view';
import { resolveObjectVisual, shipArtScale } from '../world/visual';
import {
  type SphereProbeParams,
  type SpherePose,
  type View,
  appearPose,
  landingPose,
  landingProgressForK,
  rhoOf,
  sphereProbeParams,
  spinAt,
} from './sphere-probe-pose';

const SPACE = 0x0b1830;
const SHIP_URL = '/api/art/barco/manifest.json?optional=1';
/** Barco de la prueba: al sureste de la isla de evento, mirando al oeste. muestra */
const SHIP_OFFSET = { x: 150, y: 110 };

const VERTEX = /* glsl */ `
in vec2 aPosition;
out vec2 vPos;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec2 uView;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vPos = aPosition * uView;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vPos;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec2 uCenter;     // px CSS donde está el punto delantero
uniform float uZoom;      // px CSS por px de mundo
uniform float uK;         // curvatura
uniform float uFlat;      // 1 = cámara plana exacta
uniform float uRho;       // radio a k = 1 (px de mundo)
uniform vec2 uFront;      // longitud y latitud del punto delantero (rad)
uniform vec2 uTexCenter;  // centro de la textura (px de mundo)
uniform vec2 uTexSize;    // px de mundo que cubre la textura
uniform vec2 uLanding;    // punto de aterrizaje (px de mundo)
uniform vec3 uSpace;

void main() {
  vec2 s = (vPos - uCenter) / uZoom;
  vec2 tp;
  float shade = 1.0;
  float rim = 0.0;
  if (uFlat > 0.5) {
    tp = uLanding + s;
  } else {
    float R = uRho / uK;
    vec2 q = s / R;
    float r2 = dot(q, q);
    if (r2 >= 1.0) {
      // Fuera del disco: espacio con un halo de atmósfera que se va con k.
      float d = (sqrt(r2) - 1.0) * R * uZoom;
      float glow = uK * 0.55 * exp(-d / 14.0);
      finalColor = vec4(mix(uSpace, vec3(0.55, 0.8, 1.0), glow), 1.0);
      return;
    }
    float z = sqrt(1.0 - r2);
    float cl = cos(uFront.y);
    float sl = sin(uFront.y);
    vec3 g = vec3(q.x, q.y * cl + z * sl, -q.y * sl + z * cl);
    float lon = uFront.x + atan(g.x, g.z);
    float lat = asin(clamp(g.y, -1.0, 1.0));
    tp = uTexCenter + vec2(lon, lat) * R;
    float diff = max(dot(vec3(q, z), normalize(vec3(-0.45, -0.55, 0.7))), 0.0);
    shade = mix(1.0, 0.5 + 0.6 * diff, uK);
    rim = uK * pow(1.0 - z, 3.0);
  }
  vec4 c = texture(uTexture, (tp - uTexCenter) / uTexSize + 0.5);
  vec3 col = mix(c.rgb * shade, vec3(0.62, 0.85, 1.0), rim * 0.6);
  finalColor = vec4(col, 1.0);
}
`;

export type SphereProbeMode = 'cycle' | 'spin' | 'landing' | 'still';

export interface FrameStats {
  frames: number;
  ms: number;
  fps: number;
  /** Percentil 95 del tiempo entre fotogramas. */
  p95Ms: number;
  maxMs: number;
  /** Percentil 95 del tiempo de JS del fotograma (pose + `app.render()`). */
  p95JsMs: number;
  /** Fotogramas de más de 50 ms y la pose que se estaba pintando. */
  slow: { ms: number; k: number; live: number; jsMs: number }[];
  /** fps por tramo de lo que se pintaba: sólo esfera, cruce con el mundo vivo, sólo mundo vivo. */
  byPhase: Partial<Record<'esfera' | 'cruce' | 'vivo', { frames: number; fps: number }>>;
}

export interface SphereProbe {
  readonly renderer: string;
  readonly texturePx: readonly [number, number];
  readonly resolution: number;
  readonly params: SphereProbeParams;
  /** Modo del bucle: ciclo completo, sólo giro, aterrizajes repetidos o pose fija. */
  setMode(mode: Exclude<SphereProbeMode, 'still'>): void;
  /** Pose fija para capturas: curvatura `k` del aterrizaje (1 = mini-mundo en reposo). */
  still(k: number, spinDeg?: number): void;
  /** Mide el bucle actual durante `ms`. */
  measure(ms: number): Promise<FrameStats>;
  readonly pose: SpherePose | null;
  destroy(): void;
}

export interface CreateSphereProbeOptions {
  canvas: HTMLCanvasElement;
  world: WorldConfig;
  /** Ancho de la textura en px (alto = la mitad). muestra: 2048. */
  texturePx?: number | undefined;
  resolution?: number;
}

/** Nombre de la GPU (o de SwiftShader, si se pinta por software). */
function glRenderer(app: Application): string {
  const gl = (app.renderer as unknown as { gl?: WebGLRenderingContext }).gl;
  if (!gl) return 'desconocido';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
}

export async function createSphereProbe(opts: CreateSphereProbeOptions): Promise<SphereProbe> {
  const { canvas, world } = opts;
  const resolution = opts.resolution ?? Math.min(window.devicePixelRatio || 1, 2);
  const view = (): View => ({
    width: canvas.parentElement?.clientWidth ?? window.innerWidth,
    height: canvas.parentElement?.clientHeight ?? window.innerHeight,
  });
  let v = view();
  let params = sphereProbeParams(world, v.width);

  const app = newApplication();
  await app.init({
    canvas,
    width: v.width,
    height: v.height,
    resolution,
    autoDensity: true,
    antialias: true,
    background: SPACE,
    preference: ['webgl'],
    autoStart: false,
    sharedTicker: false,
  });
  app.ticker.stop();

  // --- El mundo real, como en /juego (arte, costas, barco).
  const ship = await loadShipManifest(SHIP_URL);
  const artScale = ship?.displayScale ?? shipArtScale(ship?.manifest);
  const ids = world.objects.map((o) => o.appearance.asset);
  if (world.coast?.asset) ids.push(world.coast.asset);
  const art = await loadArt(ids);
  const manifests = manifestsOf(art);
  const objectViews = await Promise.all(
    world.objects
      .filter((o) => o.identity.active)
      .map((o) => ObjectView.create(o, resolveObjectVisual(o, manifests, artScale), art)),
  );
  const coasts = await createCoastView(
    world.bounds,
    world.coast?.asset ? art.get(world.coast.asset) : undefined,
    artScale,
  );
  const water = new Water();
  const objects = new Container();
  objects.sortableChildren = true;
  for (const o of objectViews) {
    objects.addChild(o.view);
    o.animate(0);
  }
  const shipPos = { x: params.landing.x + SHIP_OFFSET.x, y: params.landing.y + SHIP_OFFSET.y };
  const shipSprite =
    (ship ? await ShipSprite.fromManifest(ship, Math.PI) : null) ?? ShipSprite.provisional(Math.PI);
  shipSprite.update(Math.PI, 0, 0);
  shipSprite.view.position.set(shipPos.x, shipPos.y);
  // zIndex en y de mundo (las vistas de objetos usan y de mundo = 2·y de pantalla).
  shipSprite.view.zIndex = shipPos.y * 2;
  objects.addChild(shipSprite.view);
  const worldLayer = new Container();
  worldLayer.addChild(water.view, coasts, objects);

  // --- 1. Textura: el mundo entero, una vez.
  const texW = opts.texturePx ?? 2048;
  const texH = texW / 2;
  const tex = RenderTexture.create({ width: texW, height: texH, resolution: 1 });
  // Se repite en las dos direcciones. En longitud es la vuelta al planeta; en
  // latitud, con k < 1, más allá del polo reaparece el borde sur del mundo
  // (se probaron borde estirado y espejo: se ven peor). T14: rellenar de mar.
  tex.source.addressMode = 'repeat';
  tex.source.scaleMode = 'linear';
  const texScale = texW / params.texSize.x;
  const origin = {
    x: params.texCenter.x - params.texSize.x / 2,
    y: params.texCenter.y - params.texSize.y / 2,
  };
  water.view.position.set(origin.x, origin.y);
  water.update(params.texSize.x, params.texSize.y, origin.x, origin.y, 0);
  const bake = new Container();
  bake.addChild(worldLayer);
  bake.scale.set(texScale);
  bake.position.set(-origin.x * texScale, -origin.y * texScale);
  app.renderer.render({ container: bake, target: tex, clear: true, clearColor: [0, 0, 0, 1] });
  bake.removeChild(worldLayer);
  bake.destroy();

  // --- 2. La esfera: malla a pantalla completa con el shader.
  const geometry = new Geometry({
    attributes: { aPosition: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]) },
    indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });
  const shader = Shader.from({
    gl: { vertex: VERTEX, fragment: FRAGMENT, name: 'boia-sphere-probe' },
    resources: {
      uTexture: tex.source,
      sphere: {
        uView: { value: new Float32Array([v.width, v.height]), type: 'vec2<f32>' },
        uCenter: { value: new Float32Array(2), type: 'vec2<f32>' },
        uZoom: { value: 1, type: 'f32' },
        uK: { value: 1, type: 'f32' },
        uFlat: { value: 0, type: 'f32' },
        uRho: { value: rhoOf(params), type: 'f32' },
        uFront: { value: new Float32Array(2), type: 'vec2<f32>' },
        uTexCenter: {
          value: new Float32Array([params.texCenter.x, params.texCenter.y]),
          type: 'vec2<f32>',
        },
        uTexSize: {
          value: new Float32Array([params.texSize.x, params.texSize.y]),
          type: 'vec2<f32>',
        },
        uLanding: {
          value: new Float32Array([params.landing.x, params.landing.y]),
          type: 'vec2<f32>',
        },
        uSpace: {
          value: new Float32Array([0x0b / 255, 0x18 / 255, 0x30 / 255]),
          type: 'vec3<f32>',
        },
      },
    },
  });
  const sphere = new Mesh({ geometry, shader });
  const u = (shader.resources.sphere as UniformGroup).uniforms as Record<string, unknown>;

  // --- 3. El mundo vivo, encima al final.
  const live = new Container();
  live.addChild(worldLayer);
  live.visible = false;
  app.stage.addChild(sphere, live);

  const setView = () => {
    v = view();
    params = { ...sphereProbeParams(world, v.width) };
    app.renderer.resize(v.width, v.height);
    sphere.scale.set(v.width, v.height);
    (u.uView as Float32Array).set([v.width, v.height]);
  };
  setView();

  let pose: SpherePose | null = null;
  // Calentamiento (como la escena de T03): un pintado con la esfera y el
  // mundo vivo a la vez prepara en la GPU lo que el cruce final usa por
  // primera vez; sin él, SwiftShader se para ~300 ms al empezar el cruce.
  const warmUp = () => {
    apply(landingPose(params, v, (params.liveFrom + 1) / 2, 0));
    app.render();
  };
  const apply = (p: SpherePose) => {
    pose = p;
    (u.uCenter as Float32Array).set([p.center.x, p.center.y]);
    u.uZoom = p.zoom;
    u.uK = Math.max(p.k, 1e-6);
    u.uFlat = p.flat ? 1 : 0;
    (u.uFront as Float32Array).set([p.front.x, p.front.y]);
    sphere.visible = p.liveAlpha < 1;
    live.visible = p.liveAlpha > 0;
    live.alpha = p.liveAlpha;
    if (live.visible) {
      // Misma cámara que la esfera plana: el punto de aterrizaje en `center`.
      worldLayer.scale.set(p.zoom);
      worldLayer.position.set(
        p.center.x - params.landing.x * p.zoom,
        p.center.y - params.landing.y * p.zoom,
      );
      const vx = params.landing.x - p.center.x / p.zoom;
      const vy = params.landing.y - p.center.y / p.zoom;
      water.view.position.set(vx, vy);
      water.update(v.width / p.zoom, v.height / p.zoom, vx, vy, 0);
    }
  };

  // --- Bucle propio (como la entrada): ciclo aparición 2 s → reposo 2 s →
  // aterrizaje 2 s → llegada 1 s.
  const APPEAR = 2;
  const IDLE = 2;
  const LAND = 2;
  const HOLD = 1;
  let mode: SphereProbeMode = 'cycle';
  let modeStart = performance.now();
  let stillPose: SpherePose | null = null;
  let raf = 0;
  let destroyed = false;
  let recorder: {
    deltas: number[];
    js: number[];
    slow: FrameStats['slow'];
    last: number;
    prev: { k: number; live: number; jsMs: number } | null;
    phases: Record<string, { frames: number; ms: number }>;
  } | null = null;

  const poseAt = (t: number): SpherePose => {
    if (mode === 'spin') return appearPose(params, v, 1, spinAt(params, t));
    if (mode === 'landing') {
      const e = (t % (LAND + 0.25)) / LAND;
      return landingPose(params, v, e, spinAt(params, 3));
    }
    const c = t % (APPEAR + IDLE + LAND + HOLD);
    if (c < APPEAR + IDLE) return appearPose(params, v, c / APPEAR, spinAt(params, c));
    return landingPose(params, v, (c - APPEAR - IDLE) / LAND, spinAt(params, APPEAR + IDLE));
  };

  const frame = (now: number) => {
    raf = 0;
    if (destroyed) return;
    const dt = recorder ? now - recorder.last : 0;
    if (recorder) {
      recorder.deltas.push(dt);
      recorder.last = now;
      if (dt > 50 && recorder.prev) recorder.slow.push({ ms: dt, ...recorder.prev });
      if (recorder.prev) {
        const l = recorder.prev.live;
        const name = l <= 0 ? 'esfera' : l >= 1 ? 'vivo' : 'cruce';
        const b = (recorder.phases[name] ??= { frames: 0, ms: 0 });
        b.frames++;
        b.ms += dt;
      }
    }
    const t0 = performance.now();
    const vp = view();
    if (vp.width !== v.width || vp.height !== v.height) setView();
    const p = stillPose ?? poseAt((now - modeStart) / 1000);
    apply(p);
    app.render();
    if (recorder) {
      const jsMs = performance.now() - t0;
      recorder.js.push(jsMs);
      recorder.prev = { k: p.k, live: p.liveAlpha, jsMs };
    }
    raf = requestAnimationFrame(frame);
  };
  warmUp();
  raf = requestAnimationFrame(frame);

  return {
    renderer: glRenderer(app),
    texturePx: [texW, texH],
    resolution,
    get params() {
      return params;
    },
    get pose() {
      return pose;
    },
    setMode(m) {
      mode = m;
      stillPose = null;
      modeStart = performance.now();
    },
    still(k, spinDeg = 30) {
      mode = 'still';
      const spin = (spinDeg * Math.PI) / 180;
      stillPose =
        k >= 1
          ? appearPose(params, v, 1, spin)
          : landingPose(params, v, landingProgressForK(k), spin);
    },
    measure(ms) {
      return new Promise((resolve) => {
        const start = performance.now();
        recorder = { deltas: [], js: [], slow: [], last: start, prev: null, phases: {} };
        window.setTimeout(() => {
          const d = recorder?.deltas ?? [];
          const js = [...(recorder?.js ?? [])].sort((a, b) => a - b);
          const slow = recorder?.slow ?? [];
          const byPhase: FrameStats['byPhase'] = {};
          for (const [name, b] of Object.entries(recorder?.phases ?? {})) {
            byPhase[name as keyof FrameStats['byPhase']] = {
              frames: b.frames,
              fps: (b.frames * 1000) / b.ms,
            };
          }
          recorder = null;
          const total = performance.now() - start;
          const sorted = [...d].sort((a, b) => a - b);
          resolve({
            frames: d.length,
            ms: total,
            fps: (d.length * 1000) / total,
            p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
            maxMs: sorted[sorted.length - 1] ?? 0,
            p95JsMs: js[Math.floor(js.length * 0.95)] ?? 0,
            slow,
            byPhase,
          });
        }, ms);
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      tex.destroy(true);
      app.destroy({ removeView: false }, { children: true });
    },
  };
}
