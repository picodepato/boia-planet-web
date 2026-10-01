import {
  DEFAULT_PLANET_INTRO,
  TITLE_MANIFEST_ID,
  resolveTitleSheet,
  validatePlanetIntro,
  type PlanetIntroConfig,
  type TitleSheet,
} from '@boia/engine/intro';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Sólo servidor (se ejecuta al construir la landing estática): valida la
 * configuración de la entrada 3D (T57) y lee la hoja del título «BOIA» de
 * `art/` (D-16). El planeta lo monta el navegador con three.js, bajo demanda.
 * Si la configuración no cuadra, devuelve `null` y la landing sale sin
 * cinemática, con su versión ligera (REQ-ENT-017).
 */

export const ART_BASE_URL = '/api/art';
const ART_ROOT = path.resolve(process.cwd(), '../../art');

export interface IntroData {
  config: PlanetIntroConfig;
  /**
   * Título 3D «BOIA» (T27): la hoja de sprites de Blender. Se pide cuando el
   * planeta ya está listo; sin ella, el título es texto plano.
   */
  title: TitleSheet | null;
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function loadIntroData(): IntroData | null {
  const checked = validatePlanetIntro(DEFAULT_PLANET_INTRO);
  if (!checked.ok) {
    console.warn(
      '[boia] configuración de entrada inválida; landing sin cinemática\n' + checked.error,
    );
    return null;
  }
  return { config: checked.config, title: titleSheet(checked.config) };
}

function titleSheet(config: PlanetIntroConfig): TitleSheet | null {
  const manifest = readJson(path.join(ART_ROOT, TITLE_MANIFEST_ID, 'manifest.json'));
  // Sin hoja, resolveTitleSheet dice que falta.
  const r = resolveTitleSheet(manifest, ART_BASE_URL, config.copy.title);
  if (!r.ok) {
    console.warn('[boia] sin título 3D; la entrada usa el título plano: ' + r.error);
    return null;
  }
  return r.sheet;
}

const pct = (f: number) => `${(f * 100).toFixed(3)}%`;
const media = (minWidth: number, css: string) =>
  minWidth > 0 ? `@media (min-width:${minWidth}px){${css}}` : css;

/**
 * CSS del planeta ligero del hero (sin motor ni JavaScript): un disco con el
 * mar del planeta en el mismo sitio y del mismo tamaño que el horizonte del
 * último fotograma de la escena, por encuadre. Al llegar el motor, el canvas
 * lo sustituye sin salto (REQ-ENT-038). El tamaño va en `cqmin` (el lado
 * corto del hero), como el de la escena.
 */
export function stillCss({ config }: IntroData): string {
  return config.framings
    .map((f) => {
      const { fit, anchor } = f.hero;
      const size = `${(fit * 100).toFixed(3)}cqmin`;
      return media(
        f.minWidth,
        `.hero__planet{width:${size};height:${size};` +
          `left:calc(${pct(anchor[0])} - ${size} / 2);top:calc(${pct(anchor[1])} - ${size} / 2)}`,
      );
    })
    .join('\n');
}

/**
 * CSS de la entrada que sale de su configuración (REQ-ENT-015): posición del
 * título y del botón por encuadre, y cuándo aparece la carga del acto 0.
 */
export function introCss({ config }: IntroData): string {
  const rules = config.framings.map((f) =>
    media(
      f.minWidth,
      `.intro-overlay__title{top:${pct(f.titleY)}}` +
        `.intro-overlay__enter{top:${pct(f.buttonY)}}`,
    ),
  );
  rules.push(`.intro-loading{animation-delay:${config.loading.showAfterMs}ms}`);
  return rules.join('\n');
}
