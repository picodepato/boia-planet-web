import type { BootEntry, EnterSource, IntroOutcome, ScrollPhase } from '@boia/engine/intro';

/** Diagnóstico de la entrada, legible desde la consola y desde las pruebas e2e. */
export interface IntroDiagnostics {
  mode: string;
  phase: string;
  sceneStatus: string;
  /** How the rest was reached (`played`, `skipped`, `none`); `null` before. */
  outcome: IntroOutcome | null;
  /** The static version (T78's still): reduced motion, no WebGL, budget missed, low power. */
  fallback: boolean;
  scenesCreated: number;
  worldsAlive: number;
  framesRendered: number;
  /** Fotogramas en los que el planeta visible se movió o giró, o la cámara bajó. */
  cameraMoves: number;
  /** Radio del planeta (px) en los fotogramas de «Zarpar»: sólo crece. */
  landingRadius: number[];
  /** Which «Zarpar» was pressed: the hero pill (the dive) or the header pill (the veil). */
  enteredBy: EnterSource | null;
  /** ms de reloj de la aparición y de «Zarpar» (sólo si se vieron enteros). */
  appearedMs: number | null;
  playedMs: number | null;
  /** GPU con la que pinta la escena (SwiftShader = por software). */
  renderer: string | null;
  /** ms desde el montaje hasta tener la escena lista (con su primer fotograma). */
  sceneReadyMs: number | null;
  /** ms de plazo de carga que sobraban al llegar la escena. */
  budgetLeftMs: number | null;
  /** ms from the load (boot script) to the rest. */
  restAtMs: number | null;
  /** Fotograma más largo durante la animación y cuántos pasaron de 50 ms. */
  longestFrameMs: number;
  slowFrames: number;
  /** Fases vistas, en orden. */
  history: string[];
  /** Veces que se montó la escena del hero (un remontaje no repite ni corta la entrada). */
  mounts: number;
  /** Título del acto 2 (T27). */
  title: TitleDiagnostics;
  /** Mundo del planeta (el de /mar en este navegador) y cuántas islas lleva. */
  world: string | null;
  islands: number | null;
  /** Ids de esas islas: las mismas que en /mar (T64). */
  islandIds: string[] | null;
  /** `game` once «Zarpar» enters /mar (T64); `null` before. */
  exit: 'game' | null;
  /** Velo del mar del último fotograma (0–1): llega a 1 antes de entrar en el juego. */
  cover: number;
  /** Último fotograma pintado: el planeta en px CSS de la vista (centro, radio) y su giro. */
  pose: { x: number; y: number; radius: number; tilt: number; spin: number } | null;
  /**
   * The scroll hero (plan 007): `s` in viewport heights (smoothed), the
   * phase it shows (`rest`, `dive`, `sea`) and the light of the sea (0
   * golden hour → 1 night).
   */
  scroll: { s: number; phase: ScrollPhase; light: number };
  /**
   * The order of the hero (plan 020 T227): `globe` (only the globe or the
   * still), `title` («BOIA» comes in), `ready` (the buttons and the hint).
   */
  stage: 'globe' | 'title' | 'ready';
  /** The stages seen, in order. */
  stages: string[];
  /** Sea props (T78 GLBs) placed in the scene. */
  props: number;
  /** Frame cost and render quality (plan 007 T80). */
  quality: QualityDiagnostics;
}

export interface QualityDiagnostics {
  /** ms per frame, GPU included, per quality level (`null`: not measured by the first-frames probe). */
  probeMs: (number | null)[] | null;
  /** Quality level of the frames in motion (0 = full; frames at rest are always 0). */
  motion: number | null;
  /** The probe saw under 30 fps at the lowest level: the static version. */
  lowFps: boolean;
  /** Times the frames in motion came too slow and the level went down. */
  stepDowns: number;
}

export interface TitleDiagnostics {
  /** `3d`: letras de Blender en el canvas; `flat`: el texto plano (sin hoja o aún sin cargar). */
  mode: 'flat' | '3d';
  /** ms desde la carga hasta tener la hoja decodificada, y desde cuándo se pidió. */
  requestedMs: number | null;
  loadedMs: number | null;
  /** Veces que se pintó el canvas. */
  draws: number;
  /** Pose del último pintado (columna, desplazamiento y opacidad de cada letra), para comparar. */
  pose: string | null;
}

declare global {
  interface Window {
    __boiaEntry?: BootEntry;
    __boiaIntro?: IntroDiagnostics;
  }
}
