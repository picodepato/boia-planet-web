/**
 * La pista «Toca una isla para ver qué hay» de la vista de mapa (T275). Aparece
 * al abrir el mapa y se va sola a los 2,5 s, o al tocarla, o al abrir una
 * ficha. Una vez por apertura del mapa. El mapa sigue abierto y su «Cerrar»
 * es otro control. Sin React: la pantalla usa `useReducer` con este mismo
 * `mapHintReducer`.
 */

/** Cuánto se queda la pista en pantalla si nadie la toca. muestra */
export const MAP_HINT_MS = 2500;

export type MapHintEvent =
  /** El mapa se ha abierto: la pista sale (una vez por apertura). */
  | 'map-opened'
  /** El mapa se ha cerrado: la pista no se ve, sea como sea. */
  | 'map-closed'
  /** Han pasado `MAP_HINT_MS` desde que salió. */
  | 'timeout'
  /** Se ha tocado la pista. */
  | 'tap'
  /** Se ha abierto una ficha encima del mapa. */
  | 'sheet-opened';

/** Si la pista se ve: sólo al abrir el mapa; cualquier otro evento la quita. */
export function mapHintReducer(_visible: boolean, event: MapHintEvent): boolean {
  return event === 'map-opened';
}

/** Los relojes que usa la pista (inyectables en las pruebas). */
export interface MapHintTimers {
  set(fn: () => void, ms: number): number;
  clear(id: number): void;
}

const windowTimers: MapHintTimers = {
  set: (fn, ms) => window.setTimeout(fn, ms),
  clear: (id) => window.clearTimeout(id),
};

/**
 * Lo que hace la pista cuando el mapa se abre o se cierra (el cuerpo del
 * efecto de la pantalla): abierto, sale y se programa su salida a los
 * `MAP_HINT_MS`; cerrado, se quita. Devuelve con qué se cancela lo
 * programado. Nunca cierra el mapa: eso es de su «Cerrar».
 */
export function scheduleMapHint(
  mapOpen: boolean,
  send: (event: MapHintEvent) => void,
  timers: MapHintTimers = windowTimers,
): () => void {
  if (!mapOpen) {
    send('map-closed');
    return () => {};
  }
  send('map-opened');
  const id = timers.set(() => send('timeout'), MAP_HINT_MS);
  return () => timers.clear(id);
}
