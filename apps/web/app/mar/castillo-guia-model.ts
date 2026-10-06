import type { DefenseEvent } from '@boia/engine/defense';
import type { MessageKey } from '../../lib/i18n';

/**
 * La guía de la primera partida de «Defensa del Castillo» (plan 015 T173,
 * decisión 14), sin React: lo que se pregunta antes de la primera partida,
 * los pasos y cuándo pasa cada uno.
 *
 * Antes de la primera partida el pop-up pregunta «¿Empezar con la guía?»; la
 * respuesta se guarda en una preferencia del progreso (`castillo:guia`, 'si'
 * o 'no'): en modo local en este navegador y, con cuenta, en la copia que
 * viaja con `save_snapshot`. Ya respondida, no se vuelve a preguntar; la guía
 * se puede repetir desde el mismo pop-up.
 *
 * Cada paso es un bocadillo sobre la partida de verdad que apunta a lo que
 * nombra (un `data-testid` del HUD) o, si eso no está en pantalla, flota
 * solo. Pasa al siguiente con su ✕ o haciendo lo que pide; «Saltar guía» la
 * acaba. La guía sólo lee la partida (la instantánea y sus eventos): nunca la
 * cambia, así que una partida guiada entra en el ranking como cualquiera.
 */

/** La preferencia del progreso con la respuesta a «¿Empezar con la guía?». */
export const CASTLE_GUIDE_PREF = 'castillo:guia';

export type CastleGuideAnswer = 'si' | 'no';

/** La respuesta guardada, o null si aún no se ha preguntado (o lo guardado no vale). */
export function guideAnswer(value: unknown): CastleGuideAnswer | null {
  return value === 'si' || value === 'no' ? value : null;
}

/**
 * Qué hace «Jugar» en el pop-up: preguntar (la primera vez) o empezar, con
 * la guía si se pidió repetirla.
 */
export function playChoice(
  answer: CastleGuideAnswer | null,
  replay: boolean,
): { ask: true } | { ask: false; guide: boolean } {
  if (answer === null) return { ask: true };
  return { ask: false, guide: replay };
}

/** Lo que enseña la franja de abajo del HUD (`castillo-hud.tsx`). */
export type CastleHudMode = 'idle' | 'tray' | 'detail' | 'placing' | 'tower' | 'upgrades';

/** Lo que la guía cuenta de la partida desde que empezó (de sus eventos). */
export interface CastleGuideTally {
  built: number;
  upgraded: number;
  priority: number;
  called: number;
}

export const EMPTY_GUIDE_TALLY: CastleGuideTally = { built: 0, upgraded: 0, priority: 0, called: 0 };

/** Suma a la cuenta lo que hizo el jugador en un paso de la partida. */
export function tallyGuide(
  tally: CastleGuideTally,
  events: readonly DefenseEvent[],
): CastleGuideTally {
  let { built, upgraded, priority, called } = tally;
  for (const e of events) {
    if (e.type === 'towerBuilt') built++;
    else if (
      e.type === 'towerUpgrade' ||
      e.type === 'planeUpgrade' ||
      e.type === 'castleUpgrade'
    )
      upgraded++;
    else if (e.type === 'towerPriority') priority++;
    else if (e.type === 'waveCalled') called++;
  }
  if (
    built === tally.built &&
    upgraded === tally.upgraded &&
    priority === tally.priority &&
    called === tally.called
  )
    return tally;
  return { built, upgraded, priority, called };
}

/** Lo que la guía mira de la partida en cada lectura. */
export interface CastleGuideObs {
  mode: CastleHudMode;
  /** Dónde está el avión (u de la partida). */
  plane: { x: number; y: number };
  tally: CastleGuideTally;
  /** La ficha abierta es de una isla que elige a quién apunta. */
  hasPriority: boolean;
}

export type CastleGuideStepId =
  | 'mover'
  | 'construir'
  | 'elegir'
  | 'colocar'
  | 'instalar'
  | 'ficha'
  | 'prioridad'
  | 'mejorar'
  | 'oleada';

export interface CastleGuideStep {
  id: CastleGuideStepId;
  text: MessageKey;
  /**
   * A qué apunta el bocadillo: los `data-testid` del HUD, el primero que se
   * vea; vacío (o ninguno en pantalla), flota solo en el centro.
   */
  anchors: readonly string[];
  /** Ya se hizo lo que pide (pasa al siguiente). */
  done(o: CastleGuideObs, from: { x: number; y: number }): boolean;
  /** Ahora no tiene sentido (se salta). */
  skip?(o: CastleGuideObs): boolean;
}

/** Cuánto tiene que moverse el avión para dar por hecho «muévelo» (u de la partida). */
export const GUIDE_PLANE_MOVE_U = 60;

const placingOrLater = (o: CastleGuideObs) => o.mode === 'placing' || o.tally.built > 0;

export const CASTLE_GUIDE_STEPS: readonly CastleGuideStep[] = [
  {
    id: 'mover',
    text: 'mar.castillo.guia.mover',
    anchors: [],
    done: (o, from) => Math.hypot(o.plane.x - from.x, o.plane.y - from.y) >= GUIDE_PLANE_MOVE_U,
  },
  {
    id: 'construir',
    text: 'mar.castillo.guia.construir',
    anchors: ['mar-castillo-construir'],
    done: (o) => o.mode === 'tray' || o.mode === 'detail' || placingOrLater(o),
  },
  {
    id: 'elegir',
    text: 'mar.castillo.guia.elegir',
    anchors: ['mar-castillo-isla', 'mar-castillo-construir'],
    done: (o) => o.mode === 'detail' || placingOrLater(o),
  },
  {
    id: 'colocar',
    text: 'mar.castillo.guia.colocar',
    anchors: ['mar-castillo-detalle-colocar', 'mar-castillo-construir'],
    done: placingOrLater,
  },
  {
    id: 'instalar',
    text: 'mar.castillo.guia.instalar',
    anchors: ['mar-castillo-colocar-si', 'mar-castillo-construir'],
    done: (o) => o.tally.built > 0,
  },
  {
    id: 'ficha',
    text: 'mar.castillo.guia.ficha',
    anchors: [],
    done: (o) => o.mode === 'tower' || o.tally.priority > 0 || o.tally.upgraded > 0,
  },
  {
    id: 'prioridad',
    text: 'mar.castillo.guia.prioridad',
    anchors: ['mar-castillo-prioridad'],
    done: (o) => o.tally.priority > 0,
    // Faro, Ibiza e Isla del Sonido no eligen blanco: con su ficha abierta, no hay nada que elegir.
    skip: (o) => o.mode === 'tower' && !o.hasPriority,
  },
  {
    id: 'mejorar',
    text: 'mar.castillo.guia.mejorar',
    anchors: ['mar-castillo-mejorar', 'mar-castillo-mejoras'],
    done: (o) => o.tally.upgraded > 0,
  },
  {
    id: 'oleada',
    text: 'mar.castillo.guia.oleada',
    anchors: ['mar-castillo-llamar'],
    done: (o) => o.tally.called > 0,
  },
];

/** Por dónde va la guía. `step` = número de pasos: acabada. */
export interface CastleGuideState {
  step: number;
  /** Dónde estaba el avión al empezar el paso (para «muévelo»), o null hasta la primera lectura. */
  from: { x: number; y: number } | null;
}

export const GUIDE_START: CastleGuideState = { step: 0, from: null };

export function guideEnded(s: CastleGuideState): boolean {
  return s.step >= CASTLE_GUIDE_STEPS.length;
}

/** El paso de ahora, o null si la guía acabó. */
export function guideStep(s: CastleGuideState): CastleGuideStep | null {
  return CASTLE_GUIDE_STEPS[s.step] ?? null;
}

/**
 * Con una lectura de la partida: pasa los pasos ya hechos (o sin sentido
 * ahora) y apunta dónde está el avión al empezar el que queda. Devuelve el
 * mismo objeto si nada cambia.
 */
export function advanceGuide(s: CastleGuideState, o: CastleGuideObs): CastleGuideState {
  let step = s.step;
  let from = s.from ?? o.plane;
  for (;;) {
    const cur = CASTLE_GUIDE_STEPS[step];
    if (!cur) break;
    if (!(cur.done(o, from) || cur.skip?.(o))) break;
    step++;
    from = o.plane;
  }
  if (step === s.step && s.from) return s;
  return { step, from };
}

/** La ✕ del bocadillo: el siguiente paso (el avión se vuelve a mirar en la próxima lectura). */
export function closeGuideStep(s: CastleGuideState): CastleGuideState {
  if (guideEnded(s)) return s;
  return { step: s.step + 1, from: null };
}

/** «Saltar guía»: acabada. */
export function skipGuide(): CastleGuideState {
  return { step: CASTLE_GUIDE_STEPS.length, from: null };
}

/** Dónde poner el bocadillo: encima de lo que nombra (o debajo si está arriba), o en el centro. */
export interface GuideBubblePlace {
  /** px desde la izquierda de la ventana. */
  left: number;
  width: number;
  /** 'above': `y` es dónde acaba el bocadillo (su base); 'below': dónde empieza; 'free': su centro. */
  side: 'above' | 'below' | 'free';
  y: number;
  /** Dónde va la punta, en px desde la izquierda del bocadillo (null en 'free'). */
  tail: number | null;
}

/** Ancho del bocadillo (px) y su margen con el borde y con lo que señala. */
export const GUIDE_BUBBLE_W = 260;
const EDGE = 16;
const GAP = 12;
/** Por debajo de esta altura (px) no cabe encima: va debajo. */
const ROOM_ABOVE = 150;

export function placeGuideBubble(
  anchor: { left: number; top: number; width: number; height: number } | null,
  view: { width: number; height: number },
): GuideBubblePlace {
  const width = Math.min(GUIDE_BUBBLE_W, view.width - 2 * EDGE);
  if (!anchor) {
    return {
      left: Math.round((view.width - width) / 2),
      width,
      side: 'free',
      y: Math.round(view.height * 0.3),
      tail: null,
    };
  }
  const cx = anchor.left + anchor.width / 2;
  const left = Math.round(Math.max(EDGE, Math.min(view.width - EDGE - width, cx - width / 2)));
  const tail = Math.round(Math.max(18, Math.min(width - 18, cx - left)));
  if (anchor.top >= ROOM_ABOVE) {
    return { left, width, side: 'above', y: Math.round(anchor.top - GAP), tail };
  }
  const below = Math.round(anchor.top + anchor.height + GAP);
  if (below + ROOM_ABOVE <= view.height) return { left, width, side: 'below', y: below, tail };
  // Ni encima ni debajo cabe (algo que ocupa toda la pantalla): en el centro.
  return placeGuideBubble(null, view);
}
