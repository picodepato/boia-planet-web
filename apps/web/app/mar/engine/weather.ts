import type { WeatherKind } from '@boia/engine/weather';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineSegments,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { rng } from './kit';
import { type Mood, mixMood } from './palette';

/**
 * Cómo se ve y se nota cada episodio del tiempo (plan 029 T268) encima del
 * momento del día: el reloj (cuándo y cuánto) es `@boia/engine/weather`;
 * aquí, sólo el aspecto. Todos los números son `muestra`, en este sitio.
 */
export interface WeatherLook {
  /** 0..1: cuánto se apaga y se agrisa el cielo (tormenta). */
  gloom: number;
  /** 0..1: cuánto tira el cielo hacia `haze` (calima). */
  haze: number;
  hazeColor: string;
  /** Multiplica la distancia de la niebla con el episodio entero (<1: más cerca). */
  fog: number;
  /** Fracción del sol que se pierde. */
  sunCut: number;
  /** Fracción de la luz del cielo que se pierde. */
  hemiCut: number;
  /** Fracción de las estrellas que tapa. */
  starCut: number;
  /** Agua más rápida: +fracción de la velocidad del oleaje. */
  flow: number;
  /** 0..1: rayas de espuma del viento sobre el agua. */
  streaks: number;
  /** u de motor/s que el viento empuja el barco (hacia el oeste: el levante viene del este). */
  drift: number;
  /** 0..1: cuánta lluvia. */
  rain: number;
}

export const WEATHER_LOOK: Record<WeatherKind, WeatherLook> = {
  levante: {
    gloom: 0,
    haze: 0.08,
    hazeColor: '#dbe9f0',
    fog: 0.9,
    sunCut: 0,
    hemiCut: 0,
    starCut: 0,
    flow: 0.9,
    streaks: 1,
    drift: 8,
    rain: 0,
  },
  tormenta: {
    gloom: 0.62,
    haze: 0,
    hazeColor: '#9aa3b5',
    fog: 0.55,
    sunCut: 0.6,
    hemiCut: 0.3,
    starCut: 1,
    flow: 0.45,
    streaks: 0.45,
    drift: 0,
    rain: 1,
  },
  calima: {
    gloom: 0,
    haze: 0.7,
    hazeColor: '#e3a25e',
    fog: 0.5,
    sunCut: 0.45,
    hemiCut: 0.05,
    starCut: 0.75,
    flow: 0,
    streaks: 0,
    drift: 0,
    rain: 0,
  },
};

/** Hacia dónde empuja el viento (u de motor): el levante sopla hacia el oeste. */
export const WIND_DIR = { x: -1, y: 0 } as const;

/** El destello de un rayo nunca pasa de este tanto hacia el blanco (nada de pantalla blanca). */
export const FLASH_MAX = 0.35;
/** Cuánto sube la luz del cielo en el pico de un destello. */
const FLASH_HEMI = 1.1;
const FLASH_COLOR = new Color('#e6e8ff');
/** El sol de la calima: apagado y anaranjado. */
const HAZE_SUN = new Color('#ffc890');

const tmpC = new Color();
const tmpHaze = new Color();

function luma(c: Color): number {
  return c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
}

/** `c` hacia su gris, más oscuro y algo azulado: el cielo de tormenta. */
function gloomy(c: Color, k: number): void {
  if (k <= 0) return;
  const l = luma(c) * 0.62;
  tmpC.setRGB(l * 0.92, l * 0.97, l * 1.1);
  c.lerp(tmpC, k);
}

/** `c` hacia la calima, con su brillo (de noche, una calima oscura). */
function hazy(c: Color, haze: Color, k: number): void {
  if (k <= 0) return;
  const s = Math.min(1, Math.max(0.3, luma(c) / Math.max(0.01, luma(haze))));
  tmpC.copy(haze).multiplyScalar(s);
  c.lerp(tmpC, k);
}

/**
 * El momento del día con el tiempo encima: `base` (el del menú) no se toca;
 * con `k` = 0 y sin destello, `out` es `base` tal cual.
 */
export function weatherMood(
  out: Mood,
  base: Mood,
  kind: WeatherKind | null,
  k: number,
  flash = 0,
): Mood {
  mixMood(out, base, base, 0);
  out.stars = base.stars;
  out.hemi = base.hemi;
  out.sunI = base.sunI;
  out.glow = base.glow;
  if (kind && k > 0) {
    const look = WEATHER_LOOK[kind];
    const g = look.gloom * k;
    for (const c of [out.sky, out.zenith, out.fog, out.hemiSky]) gloomy(c, g);
    gloomy(out.deep, g * 0.5);
    gloomy(out.shallow, g * 0.5);
    tmpHaze.set(look.hazeColor);
    const h = look.haze * k;
    for (const c of [out.sky, out.fog, out.hemiSky]) hazy(c, tmpHaze, h);
    hazy(out.zenith, tmpHaze, h * 0.6);
    hazy(out.shallow, tmpHaze, h * 0.2);
    if (look.haze > 0.3) out.sun.lerp(HAZE_SUN, h);
    out.stars *= 1 - look.starCut * k;
    out.sunI *= 1 - look.sunCut * k;
    out.hemi *= 1 - look.hemiCut * k;
  }
  const f = Math.max(0, Math.min(1, flash));
  if (f > 0) {
    out.hemi += FLASH_HEMI * f;
    const w = FLASH_MAX * f;
    out.sky.lerp(FLASH_COLOR, w);
    out.zenith.lerp(FLASH_COLOR, w * 0.6);
    out.fog.lerp(FLASH_COLOR, w * 0.5);
  }
  return out;
}

/** Cuánto se acerca la niebla ahora (1: como siempre). */
export function weatherFog(kind: WeatherKind | null, k: number): number {
  if (!kind) return 1;
  return 1 - (1 - WEATHER_LOOK[kind].fog) * k;
}

/** Gotas de lluvia: muchas en calidad alta, pocas en baja o con movimiento reducido. */
export const RAIN_DROPS = { alta: 700, baja: 220 } as const;
/** Con movimiento reducido, esta fracción de las gotas (y más lentas). */
export const RAIN_REDUCED = 0.4;

export function rainCount(quality: 'alta' | 'baja', reduced: boolean): number {
  const n = RAIN_DROPS[quality];
  return Math.round(reduced ? n * RAIN_REDUCED : n);
}

const rainVertex = /* glsl */ `
  attribute float aEnd;
  uniform vec3 uCenter;
  uniform vec3 uSize;
  uniform float uTime;
  uniform float uFall;
  uniform float uLen;
  uniform vec2 uSlant;
  varying float vA;
  void main() {
    vec3 s = position;
    // Cada gota cae dentro de una caja alrededor de la cámara; en x/z queda
    // quieta respecto al mar (no se arrastra con la cámara) y el viento la empuja.
    float y = fract(s.y - uTime * uFall / uSize.y);
    vec2 drift = uSlant * uTime * uFall;
    vec2 xz = uCenter.xz + (fract(s.xz - (uCenter.xz - drift) / uSize.xz) - 0.5) * uSize.xz;
    vec3 p = vec3(xz.x, uCenter.y + (y - 0.5) * uSize.y, xz.y);
    // El otro extremo de la raya, arriba y a barlovento.
    p += vec3(-uSlant.x, 1.0, -uSlant.y) * uLen * aEnd;
    vA = 1.0 - aEnd * 0.8;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

const rainFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vA;
  void main() {
    gl_FragColor = vec4(uColor, uOpacity * vA);
  }
`;

/**
 * La lluvia de la tormenta: rayas de una línea, animadas en el shader (la
 * CPU no toca ninguna gota por fotograma). Sin curvar con el planeta: cae
 * cerca de la cámara.
 */
export class Rain {
  readonly mesh: LineSegments;
  private readonly material: ShaderMaterial;
  private readonly max: number;

  constructor(max = RAIN_DROPS.alta, seed = 29) {
    this.max = max;
    const r = rng(seed);
    const pos = new Float32Array(max * 6);
    const end = new Float32Array(max * 2);
    for (let i = 0; i < max; i++) {
      const x = r();
      const y = r();
      const z = r();
      pos.set([x, y, z, x, y, z], i * 6);
      end[i * 2 + 1] = 1;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aEnd', new BufferAttribute(end, 1));
    this.material = new ShaderMaterial({
      vertexShader: rainVertex,
      fragmentShader: rainFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
      uniforms: {
        uCenter: { value: new Vector3() },
        uSize: { value: new Vector3(60, 30, 60) },
        uTime: { value: 0 },
        uFall: { value: 26 },
        uLen: { value: 1.1 },
        uSlant: { value: new Vector2(0.18, 0.05) },
        uColor: { value: new Color('#c9d6ea') },
        uOpacity: { value: 0 },
      },
    });
    this.material.userData.planet = 'skip';
    this.mesh = new LineSegments(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 1001;
  }

  /**
   * Cada fotograma: `amount` 0..1 (episodio y zoom ya dentro), `drops`
   * cuántas gotas, la caja alrededor de `center` con `size` de lado.
   */
  update(
    time: number,
    amount: number,
    drops: number,
    center: { x: number; y: number; z: number },
    size: number,
    height: number,
    reduced: boolean,
  ): void {
    const on = amount > 0.01 && drops > 0;
    this.mesh.visible = on;
    if (!on) return;
    const u = this.material.uniforms;
    u.uTime!.value = time;
    u.uOpacity!.value = 0.55 * amount;
    u.uFall!.value = reduced ? 12 : 26;
    (u.uCenter!.value as Vector3).set(center.x, center.y, center.z);
    (u.uSize!.value as Vector3).set(size, height, size);
    this.mesh.geometry.setDrawRange(0, Math.min(this.max, drops) * 2);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
