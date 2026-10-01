import {
  MENU_PARAM,
  PLACE_EVENT_PARAM,
  PLACE_PARAM,
  readPlaceRequest,
} from '../../lib/world-handoff';

/**
 * Los enlaces profundos del mar 3D (T55), sin React ni three.js: lo que la
 * landing, las fichas de evento, el Carnet y el Admin piden al abrir /mar.
 *
 * - `?ir=<lugar>` (con `&evento=<id>` en una isla de evento): el mar arranca
 *   con el barco navegando hacia ese lugar y abre su ficha al llegar.
 * - `?evento=<id o slug>` sin `ir`: lo mismo, hacia la isla de ese evento.
 * - `?menu=<panel>`: abre ese panel de a bordo (p. ej. `carnet`).
 *
 * Se consumen una vez y se quitan de la URL: una recarga no repite el viaje.
 */

/** Paneles de a bordo del mar que se abren por enlace (y desde el Menú). */
export const MAR_PANELS = ['carnet', 'ajustes', 'controles', 'bienvenida', 'logros'] as const;
export type MarPanel = (typeof MAR_PANELS)[number];

/** Nombres de sección del Menú de a bordo del 2D que siguen valiendo en el mar. */
const PANEL_ALIAS: Readonly<Record<string, MarPanel>> = {
  welcome: 'bienvenida',
  settings: 'ajustes',
  controls: 'controles',
};

/** Parámetro del 2D que arrancaba el viaje (`?evento=…&piloto=1`): en el mar sobra. */
const LEGACY_PILOT_PARAM = 'piloto';

export interface MarSail {
  /** El lugar al que ir (`?ir=`). */
  placeId?: string;
  /** El evento (`?evento=`): el que enseña la isla, o la isla a la que ir. */
  eventId?: string;
}

export interface MarLinks {
  /** Adónde navega el barco al arrancar, o null. */
  sail: MarSail | null;
  /** Qué panel de a bordo abre al arrancar, o null. */
  menu: MarPanel | null;
}

export function marPanel(name: string | null | undefined): MarPanel | null {
  const id = name?.trim().toLowerCase();
  if (!id) return null;
  if ((MAR_PANELS as readonly string[]).includes(id)) return id as MarPanel;
  return PANEL_ALIAS[id] ?? null;
}

/** Lo que pide la URL de /mar. */
export function readMarLinks(search: string): MarLinks {
  const q = new URLSearchParams(search);
  const place = readPlaceRequest(search);
  const eventId = q.get(PLACE_EVENT_PARAM)?.trim();
  const sail: MarSail | null = place ?? (eventId ? { eventId } : null);
  return { sail, menu: marPanel(q.get(MENU_PARAM)) };
}

/** ¿La URL trae algún enlace profundo que consumir? */
export function hasMarLinks(links: MarLinks): boolean {
  return !!links.sail || !!links.menu;
}

/** La misma ruta sin los enlaces profundos (se quitan al consumirlos). */
export function withoutMarLinks(href: string): string {
  const url = new URL(href, 'http://boia.invalid');
  for (const p of [PLACE_PARAM, PLACE_EVENT_PARAM, MENU_PARAM, LEGACY_PILOT_PARAM]) {
    url.searchParams.delete(p);
  }
  return url.pathname + url.search + url.hash;
}
