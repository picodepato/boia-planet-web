/**
 * Piezas comunes de la configuración de la entrada (REQ-ENT-015): curvas,
 * tramos, textos y el movimiento del título 3D «BOIA» (T27). La configuración
 * versionada completa de la entrada 3D con el planeta está en `planet.ts`
 * (T57); la de la entrada 2D «mini-mundo» (T14–T28) se fue con el mundo 2D
 * (T62, D-25). Todos los valores son `muestra` hasta que Hernán y Álvaro
 * revisen la entrada en móviles reales (D-19, P6).
 *
 * Unidades: tiempos en ms; tramos dentro de un acto, fracciones del acto
 * (0..1); distancias del título en alturas de mayúscula; ángulos en grados.
 */

export type Easing = 'linear' | 'easeInOutSine' | 'easeInOutCubic';
export const EASINGS: readonly Easing[] = ['linear', 'easeInOutSine', 'easeInOutCubic'];

/** Tramo [inicio, fin] como fracciones de un acto. */
export type Span = readonly [number, number];

/** Textos de la cinemática. muestra: los aprueba Álvaro (D-19, P9). */
export interface IntroCopy {
  /** Título de la cinemática (REQ-ENT-003). */
  title: string;
  /** Botón de entrar. */
  enter: string;
  /** Enlace a Tickets visible desde el primer momento (REQ-ENT-002). */
  ticketsOnly: string;
  /** Acto 0. */
  loading: string;
}

export const DEFAULT_INTRO_COPY: IntroCopy = {
  title: 'BOIA',
  enter: 'Zarpar',
  ticketsOnly: 'Solo quiero ver las entradas',
  loading: 'Cargando',
};

/**
 * Movimiento del título 3D (T27), al estilo del título de messenger.abeto.co:
 * las letras suben una a una, se balancean y bambolean cada una a su aire
 * con un giro suave que les pasa la luz, y salen al aterrizar.
 */
export interface TitleMotion {
  rise: {
    /** Desde el inicio de la pausa hasta que empieza a subir la primera letra. */
    delayMs: number;
    staggerMs: number;
    durationMs: number;
    /** Sube desde tantas alturas por debajo de su sitio. */
    from: number;
    /** Rebote al llegar (easeOutBack; 0 sin rebote). */
    overshoot: number;
    /** Parte de la subida en la que aparece (opacidad 0 → 1). */
    fadeShare: number;
    scaleFrom: number;
    /** Giro con el que entra, respecto a su guiñada de reposo. */
    spinDeg: number;
  };
  idle: {
    /** Periodo del bucle de reposo: todas las ondas cierran en él. */
    periodMs: number;
    bob: number;
    rollDeg: number;
    yawDeg: number;
    restYawDeg: number;
  };
  exit: {
    staggerMs: number;
    durationMs: number;
    /** Saltito antes de hundirse y cuánto se hunde. */
    hop: number;
    drop: number;
    rollDeg: number;
    /** Cuánto encoge al salir (fracción). */
    shrink: number;
  };
  /** Movimiento reducido: un fotograma quieto con esta guiñada. */
  stillYawDeg: number;
}

export const DEFAULT_TITLE_MOTION: TitleMotion = {
  rise: {
    delayMs: 80,
    staggerMs: 120,
    durationMs: 820,
    from: 0.9,
    overshoot: 1.9,
    fadeShare: 0.3,
    scaleFrom: 0.7,
    spinDeg: -18,
  },
  idle: { periodMs: 6000, bob: 0.05, rollDeg: 3.5, yawDeg: 14, restYawDeg: -6 },
  exit: { staggerMs: 70, durationMs: 460, hop: 0.12, drop: 1.4, rollDeg: 10, shrink: 0.25 },
  stillYawDeg: -8,
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const inRange = (v: unknown, lo: number, hi: number): v is number => isNum(v) && v >= lo && v <= hi;

/**
 * Errores del movimiento del título (`title.*`), con el campo que falla; lista
 * vacía si vale. Lo usa el validador de la configuración de la entrada.
 */
export function titleMotionErrors(input: unknown): string[] {
  const errors: string[] = [];
  const need = (cond: boolean, path: string, what: string) => {
    if (!cond) errors.push(`${path}: ${what}`);
  };
  const obj = (v: unknown, path: string): Obj => {
    if (isObj(v)) return v;
    errors.push(`${path}: objeto`);
    return {};
  };
  const title = obj(input, 'title');
  const rise = obj(title.rise, 'title.rise');
  need(inRange(rise.delayMs, 0, 5000), 'title.rise.delayMs', '0–5000');
  need(inRange(rise.staggerMs, 0, 2000), 'title.rise.staggerMs', '0–2000');
  need(inRange(rise.durationMs, 0, 5000), 'title.rise.durationMs', '0–5000');
  need(inRange(rise.from, 0, 4), 'title.rise.from', '0–4');
  need(inRange(rise.overshoot, 0, 4), 'title.rise.overshoot', '0–4');
  need(
    isNum(rise.fadeShare) && rise.fadeShare > 0 && rise.fadeShare <= 1,
    'title.rise.fadeShare',
    '(0, 1]',
  );
  need(inRange(rise.scaleFrom, 0, 1), 'title.rise.scaleFrom', '0..1');
  need(inRange(rise.spinDeg, -90, 90), 'title.rise.spinDeg', '±90');
  const idle = obj(title.idle, 'title.idle');
  need(inRange(idle.periodMs, 1000, 60_000), 'title.idle.periodMs', '1000–60000');
  need(inRange(idle.bob, 0, 1), 'title.idle.bob', '0–1');
  need(inRange(idle.rollDeg, 0, 30), 'title.idle.rollDeg', '0–30');
  need(inRange(idle.yawDeg, 0, 90), 'title.idle.yawDeg', '0–90');
  need(inRange(idle.restYawDeg, -90, 90), 'title.idle.restYawDeg', '±90');
  const exit = obj(title.exit, 'title.exit');
  need(inRange(exit.staggerMs, 0, 2000), 'title.exit.staggerMs', '0–2000');
  need(inRange(exit.durationMs, 0, 3000), 'title.exit.durationMs', '0–3000');
  need(inRange(exit.hop, 0, 2), 'title.exit.hop', '0–2');
  need(inRange(exit.drop, 0, 6), 'title.exit.drop', '0–6');
  need(inRange(exit.rollDeg, 0, 90), 'title.exit.rollDeg', '0–90');
  need(inRange(exit.shrink, 0, 1), 'title.exit.shrink', '0..1');
  need(inRange(title.stillYawDeg, -90, 90), 'title.stillYawDeg', '±90');
  return errors;
}
