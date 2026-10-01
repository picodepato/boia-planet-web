import type { VortexPose } from '@boia/engine/headless';
import {
  type Camera,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Vector2,
  type WebGLRenderer,
  WebGLRenderTarget,
} from 'three';

/**
 * El agujero negro del cambio de mundo en el mar 3D (T41 en el 2D, T51 aquí):
 * la escena se pinta en una textura y un cuadro a pantalla completa la
 * enrosca y la encoge hacia el barco, abre el agujero y apaga todo; es el
 * mismo sombreador que el filtro de Pixi, con la pose de `SwitchTimeline`.
 * Con movimiento reducido, una foto del mundo de antes que se funde sobre el
 * nuevo (`fade`). Sin transición, la escena se pinta directa: no cuesta nada.
 */

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uScene;
uniform sampler2D uSnap;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uAngle;
uniform float uPull;
uniform float uHole;
uniform float uDark;
uniform float uFade;
varying vec2 vUv;

void main() {
  // Píxel de la pantalla (del búfer de dibujo), con el origen abajo.
  vec2 p = vUv * uRes;
  vec2 d = p - uCenter;
  float dist = length(d);
  // Remolino: gira más cerca del centro; y todo cae hacia él.
  float r = clamp(1.0 - dist / uRadius, 0.0, 1.0);
  float a = uAngle * r * r;
  float s = sin(a);
  float c = cos(a);
  vec2 q = uCenter + vec2(d.x * c - d.y * s, d.x * s + d.y * c) * uPull;
  vec2 g = q / uRes;
  vec3 color = texture2D(uScene, clamp(g, 0.0, 1.0)).rgb;
  // Más allá del borde de la pantalla, espacio negro.
  float inside = step(0.0, g.x) * step(g.x, 1.0) * step(0.0, g.y) * step(g.y, 1.0);
  // El agujero: negro dentro, con un borde suave.
  float hole = smoothstep(uHole, uHole * 1.15 + 2.0, dist);
  float k = inside * hole * (1.0 - uDark);
  vec3 outc = color * k;
  if (uFade > 0.0) outc = mix(outc, texture2D(uSnap, vUv).rgb, uFade);
  gl_FragColor = vec4(outc, 1.0);
  #include <colorspace_fragment>
}
`;

const target = () => {
  const t = new WebGLRenderTarget(1, 1, { depthBuffer: true, stencilBuffer: false });
  t.texture.colorSpace = SRGBColorSpace;
  return t;
};

export class VortexPass {
  private readonly scene = target();
  private snap: WebGLRenderTarget | null = null;
  private readonly quadScene = new Scene();
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: ShaderMaterial;
  private readonly size = new Vector2(1, 1);

  constructor() {
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uScene: { value: this.scene.texture },
        uSnap: { value: null },
        uRes: { value: new Vector2(1, 1) },
        uCenter: { value: new Vector2() },
        uRadius: { value: 1 },
        uAngle: { value: 0 },
        uPull: { value: 1 },
        uHole: { value: 0 },
        uDark: { value: 0 },
        uFade: { value: 0 },
      },
    });
    const quad = new Mesh(new PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.quadScene.add(quad);
  }

  /** Tamaño del búfer de dibujo (px reales). */
  private sync(renderer: WebGLRenderer): void {
    renderer.getDrawingBufferSize(this.size);
    const w = Math.max(1, Math.round(this.size.x));
    const h = Math.max(1, Math.round(this.size.y));
    if (this.scene.width !== w || this.scene.height !== h) this.scene.setSize(w, h);
    (this.material.uniforms.uRes!.value as Vector2).set(w, h);
  }

  /** Foto de la escena tal como se ve ahora: el fundido parte de aquí. */
  capture(renderer: WebGLRenderer, scene: Scene, camera: Camera): void {
    this.sync(renderer);
    this.snap ??= target();
    if (this.snap.width !== this.scene.width || this.snap.height !== this.scene.height) {
      this.snap.setSize(this.scene.width, this.scene.height);
    }
    renderer.setRenderTarget(this.snap);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    this.material.uniforms.uSnap!.value = this.snap.texture;
  }

  /**
   * Pinta la escena con la pose; `center` es el barco en la pantalla, en
   * fracción (0–1, origen abajo a la izquierda).
   */
  render(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    pose: VortexPose,
    center: { x: number; y: number },
  ): void {
    const fading = pose.fade > 0 && this.snap !== null;
    if (pose.depth <= 0 && !fading) {
      this.dropSnap();
      renderer.render(scene, camera);
      return;
    }
    this.sync(renderer);
    renderer.setRenderTarget(this.scene);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    const u = this.material.uniforms;
    const w = this.scene.width;
    const h = this.scene.height;
    const half = Math.hypot(w, h) / 2;
    (u.uCenter!.value as Vector2).set(center.x * w, center.y * h);
    u.uRadius!.value = half * 1.6;
    u.uAngle!.value = pose.angle;
    u.uPull!.value = pose.pull;
    u.uHole!.value = pose.hole * half;
    u.uDark!.value = pose.dark;
    u.uFade!.value = fading ? pose.fade : 0;
    renderer.render(this.quadScene, this.quadCamera);
  }

  private dropSnap(): void {
    if (!this.snap) return;
    this.snap.dispose();
    this.snap = null;
    this.material.uniforms.uSnap!.value = null;
  }

  dispose(): void {
    this.dropSnap();
    this.scene.dispose();
    this.material.dispose();
    for (const c of this.quadScene.children) (c as Mesh).geometry.dispose();
  }
}
