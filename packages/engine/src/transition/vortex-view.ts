import {
  type Application,
  type Container,
  Filter,
  GlProgram,
  Rectangle,
  Sprite,
  type Texture,
  UniformGroup,
  defaultFilterVert,
} from 'pixi.js';
import { IDLE_POSE, type VortexPose } from './timeline';

/**
 * El vórtice en Pixi (T41): un filtro sobre la escena (mar y mundo) que
 * enrosca y encoge la imagen hacia el barco y abre un agujero negro en él; y,
 * con movimiento reducido, una foto del mundo de antes que se funde sobre el
 * nuevo. Sin WebGL (WebGPU), el mismo efecto con la escena girada y encogida.
 */

const fragment = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uInputClamp;
uniform vec4 uOutputFrame;

uniform vec2 uCenter;
uniform float uRadius;
uniform float uAngle;
uniform float uPull;
uniform float uHole;
uniform float uDark;

void main(void)
{
    // Píxel de pantalla de este fragmento.
    vec2 f = vTextureCoord / (uOutputFrame.zw * uInputSize.zw);
    vec2 p = uOutputFrame.xy + f * uOutputFrame.zw;
    vec2 d = p - uCenter;
    float dist = length(d);

    // Remolino: gira más cerca del centro; y todo cae hacia él.
    float r = clamp(1.0 - dist / uRadius, 0.0, 1.0);
    float a = uAngle * r * r;
    float s = sin(a);
    float c = cos(a);
    vec2 q = uCenter + vec2(d.x * c - d.y * s, d.x * s + d.y * c) * uPull;

    vec2 g = (q - uOutputFrame.xy) / uOutputFrame.zw;
    vec2 uv = clamp(g * uOutputFrame.zw * uInputSize.zw, uInputClamp.xy, uInputClamp.zw);
    vec4 color = texture(uTexture, uv);
    // Más allá del borde del mundo, espacio negro.
    float inside = step(0.0, g.x) * step(g.x, 1.0) * step(0.0, g.y) * step(g.y, 1.0);
    // El agujero: negro dentro, con un borde suave.
    float hole = smoothstep(uHole, uHole * 1.15 + 2.0, dist);
    float k = inside * hole * (1.0 - uDark);
    finalColor = vec4(color.rgb * k, mix(1.0, color.a, k));
}
`;

export class VortexView {
  private readonly filter: Filter | null;
  private readonly uniforms: UniformGroup | null;
  private snapshot: Sprite | null = null;
  private filtered = false;

  constructor(
    private readonly app: Application,
    /** Lo que cae al agujero: el mar y el mundo (no el bocadillo ni el joystick). */
    private readonly scene: Container,
  ) {
    const gl = (app.renderer as unknown as { gl?: unknown }).gl !== undefined;
    if (gl) {
      this.uniforms = new UniformGroup({
        uCenter: { value: new Float32Array(2), type: 'vec2<f32>' },
        uRadius: { value: 1, type: 'f32' },
        uAngle: { value: 0, type: 'f32' },
        uPull: { value: 1, type: 'f32' },
        uHole: { value: 0, type: 'f32' },
        uDark: { value: 0, type: 'f32' },
      });
      this.filter = new Filter({
        glProgram: GlProgram.from({
          vertex: defaultFilterVert,
          fragment,
          name: 'boia-vortex',
          // Píxeles de pantalla: highp, y la misma precisión que el vértice en
          // los uniformes que comparten (si no, el programa no enlaza).
          preferredFragmentPrecision: 'highp',
        }),
        resources: { vortexUniforms: this.uniforms },
      });
      // El filtro cubre la pantalla entera (también lo que queda fuera del mundo).
      scene.filterArea = app.screen;
    } else {
      this.uniforms = null;
      this.filter = null;
    }
  }

  /**
   * Foto de la escena tal como se ve ahora, encima de ella: el fundido parte
   * de aquí. La foto se suelta al terminar (`apply` con `fade` 0).
   */
  takeSnapshot(): void {
    this.dropSnapshot();
    const { width, height } = this.app.screen;
    const texture: Texture = this.app.renderer.generateTexture({
      target: this.scene,
      frame: new Rectangle(0, 0, width, height),
    });
    const sprite = new Sprite(texture);
    const parent = this.scene.parent;
    parent?.addChildAt(sprite, parent.getChildIndex(this.scene) + 1);
    this.snapshot = sprite;
  }

  private dropSnapshot(): void {
    if (!this.snapshot) return;
    this.snapshot.destroy({ texture: true, textureSource: true });
    this.snapshot = null;
  }

  /** Pinta la pose con el agujero en `center` (px de pantalla). */
  apply(pose: VortexPose, center: { x: number; y: number }): void {
    if (this.snapshot) {
      if (pose.fade > 0) this.snapshot.alpha = pose.fade;
      else this.dropSnapshot();
    }
    const on = pose.depth > 0;
    if (this.filter && this.uniforms) {
      if (on !== this.filtered) {
        this.scene.filters = on ? [this.filter] : [];
        this.filtered = on;
      }
      if (!on) return;
      const { width, height } = this.app.screen;
      const half = Math.hypot(width, height) / 2;
      const u = this.uniforms.uniforms as {
        uCenter: Float32Array;
        uRadius: number;
        uAngle: number;
        uPull: number;
        uHole: number;
        uDark: number;
      };
      u.uCenter[0] = center.x;
      u.uCenter[1] = center.y;
      u.uRadius = half * 1.6;
      u.uAngle = pose.angle;
      u.uPull = pose.pull;
      u.uHole = pose.hole * half;
      u.uDark = pose.dark;
      this.uniforms.update();
      return;
    }
    // Sin filtro: la escena gira y se encoge hacia el barco, y se apaga.
    if (!on) {
      if (this.filtered) {
        this.scene.pivot.set(0, 0);
        this.scene.position.set(0, 0);
        this.scene.rotation = 0;
        this.scene.scale.set(1);
        this.scene.alpha = 1;
        this.filtered = false;
      }
      return;
    }
    this.filtered = true;
    this.scene.pivot.set(center.x, center.y);
    this.scene.position.set(center.x, center.y);
    this.scene.rotation = pose.angle * 0.3;
    this.scene.scale.set(1 / pose.pull);
    this.scene.alpha = 1 - pose.dark;
  }

  /** Vuelve a la escena normal y suelta la foto. */
  reset(): void {
    this.apply(IDLE_POSE, { x: 0, y: 0 });
  }

  destroy(): void {
    this.reset();
    this.dropSnapshot();
    this.filter?.destroy();
  }
}
