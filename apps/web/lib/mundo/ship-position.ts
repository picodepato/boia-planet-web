/**
 * Posición del barco guardada en el dispositivo (REQ-IDE-004, T44): dónde
 * estaba y hacia dónde miraba, para que una recarga de /juego siga en el
 * mismo sitio. El mapa es común a todos los mundos (D-20), así que vale
 * aunque se cambie de mundo. Se guarda aparte del repositorio: se escribe a
 * menudo y no es progreso que haya que fusionar con una cuenta.
 *
 * Al volver se pone con `moveShip`, que siempre deja el barco en agua
 * navegable: la posición restaurada es segura aunque el mapa cambie.
 */

/** Lo mínimo de `Storage` que hace falta (localStorage o uno en memoria). */
export interface PositionStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SHIP_POSITION_KEY = 'boia.barco.posicion';
/** Cada cuánto se guarda mientras se navega. */
export const SHIP_POSITION_SAVE_MS = 2000;
/** u mínimas de cambio para volver a guardar (parado no escribe). */
export const SHIP_POSITION_MIN_MOVE = 8;

export interface ShipPosition {
  x: number;
  y: number;
  /** Rumbo del casco (rad). */
  heading: number;
  savedAt: string;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function parseShipPosition(raw: unknown): ShipPosition | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!finite(r.x) || !finite(r.y)) return null;
  return {
    x: r.x,
    y: r.y,
    heading: finite(r.heading) ? r.heading : 0,
    savedAt: typeof r.savedAt === 'string' ? r.savedAt : '',
  };
}

export function loadShipPosition(store: PositionStore): ShipPosition | null {
  try {
    const text = store.getItem(SHIP_POSITION_KEY);
    return text ? parseShipPosition(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

export function saveShipPosition(
  store: PositionStore,
  p: { x: number; y: number; heading: number },
  now: Date = new Date(),
): void {
  if (!finite(p.x) || !finite(p.y)) return;
  const value: ShipPosition = {
    x: Math.round(p.x * 10) / 10,
    y: Math.round(p.y * 10) / 10,
    heading: finite(p.heading) ? Math.round(p.heading * 1000) / 1000 : 0,
    savedAt: now.toISOString(),
  };
  try {
    store.setItem(SHIP_POSITION_KEY, JSON.stringify(value));
  } catch {
    // Sin almacenamiento (modo privado lleno): se navega igual, sin recordar.
  }
}

/** ¿Merece la pena volver a guardar? Sólo si el barco se movió o giró. */
export function movedEnough(
  last: { x: number; y: number; heading: number } | null,
  now: { x: number; y: number; heading: number },
): boolean {
  if (!last) return true;
  return (
    Math.hypot(now.x - last.x, now.y - last.y) >= SHIP_POSITION_MIN_MOVE ||
    Math.abs(now.heading - last.heading) >= 0.05
  );
}

/**
 * ¿Se restaura la posición al arrancar? Sí al recargar /juego (o volver con
 * Atrás/Adelante) y al volver a /juego sin recargar desde otra página de la
 * web; no cuando se llega desde EXPLORAR (el barco sale del puerto, D-20),
 * ni con `?ir=` o `?cerca=`, que ya dicen dónde empezar.
 */
export function shouldRestorePosition(opts: {
  navigationType: string | undefined;
  /** El juego ya arrancó antes en este documento (navegación sin recarga). */
  bootedBefore: boolean;
  /** La superficie vino de la landing (EXPLORAR). */
  handedOver: boolean;
  /** La URL pide un sitio (`?ir=`, `?cerca=`). */
  placeRequested: boolean;
}): boolean {
  if (opts.handedOver || opts.placeRequested) return false;
  if (opts.bootedBefore) return true;
  return opts.navigationType === 'reload' || opts.navigationType === 'back_forward';
}

/**
 * Al arrancar /juego: pone el barco donde se guardó si toca
 * (`shouldRestorePosition`). Devuelve dónde quedó, o `null` si no se movió.
 */
export function restoreShipPosition(
  game: { moveShip(x: number, y: number, heading?: number): { x: number; y: number } },
  store: PositionStore | null,
  when: Parameters<typeof shouldRestorePosition>[0],
): { x: number; y: number } | null {
  if (!store || !shouldRestorePosition(when)) return null;
  const saved = loadShipPosition(store);
  return saved ? game.moveShip(saved.x, saved.y, saved.heading) : null;
}

/** Tipo de la navegación que cargó este documento (`navigate`, `reload`…). */
export function documentNavigationType(): string | undefined {
  try {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return nav?.type;
  } catch {
    return undefined;
  }
}
