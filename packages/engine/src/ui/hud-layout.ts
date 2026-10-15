import type { KeyValueStore } from './storage';

/**
 * Colocación del HUD sobre el mundo, en px CSS, sin DOM. La aplicación pinta
 * cada elemento en el rectángulo que sale de aquí y las pruebas comprueban
 * las mismas cuentas: nada tapa la zona del joystick ni se pisa entre sí.
 *
 * Fila superior: a la izquierda Inicio (y los datos de depuración), a la
 * derecha brújula y ancla del Menú de a bordo. El minimapa vive en una de las
 * zonas seguras de debajo y se puede mover entre ellas (REQ-MUN-021).
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Viewport {
  width: number;
  height: number;
  /** Zonas seguras del dispositivo (`env(safe-area-inset-*)`). */
  insets?: Insets;
}

export const HUD_MARGIN = 8;
export const HUD_GAP = 8;
/** Botones del HUD: 44 px, el mínimo táctil. */
export const HUD_BUTTON = 44;
/**
 * Caja de datos de depuración (FPS, velocidad) junto a Inicio. Sólo con
 * `?debug` (O11, REQ-PRO-009). muestra
 */
export const HUD_STATS = { w: 120, h: 44 };
/**
 * Saldos (puntos y monedas, REQ-IDE-027) junto a Inicio, antes que los datos
 * de depuración: si no caben los dos, se quedan los saldos. muestra
 */
export const HUD_BALANCES = { w: 56, h: 44 };

/** D-07: 96 px en móvil sin pasar del 22 % del ancho; 128 px en escritorio. */
export const MINIMAP_MOBILE = 96;
export const MINIMAP_DESKTOP = 128;
export const MINIMAP_MAX_WIDTH_FRACTION = 0.22;
export const DESKTOP_MIN_WIDTH = 1024;

/**
 * Zona del joystick: la franja inferior de la pantalla, donde apoyan los
 * pulgares. El joystick nace donde toque el primer dedo (D-12), pero el HUD
 * deja libre esta franja entera para que nunca haya que esquivarlo. muestra
 */
export const JOYSTICK_ZONE_FRACTION = 0.45;

/** Aviso: arriba, centrado, encima de la fila superior mientras dura. */
export const NOTICE_MAX_WIDTH = 420;
export const NOTICE_HEIGHT = 56;

export const MINIMAP_ZONES = ['top-right', 'top-left', 'middle-right', 'middle-left'] as const;
export type MinimapZone = (typeof MINIMAP_ZONES)[number];
export const DEFAULT_MINIMAP_ZONE: MinimapZone = 'top-right';

export function isMinimapZone(v: unknown): v is MinimapZone {
  return typeof v === 'string' && (MINIMAP_ZONES as readonly string[]).includes(v);
}

export function minimapSize(width: number): number {
  if (width >= DESKTOP_MIN_WIDTH) return MINIMAP_DESKTOP;
  return Math.min(MINIMAP_MOBILE, Math.floor(width * MINIMAP_MAX_WIDTH_FRACTION));
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function inside(a: Rect, vp: Viewport): boolean {
  return a.x >= 0 && a.y >= 0 && a.x + a.w <= vp.width && a.y + a.h <= vp.height;
}

const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

function margins(vp: Viewport) {
  const i = vp.insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    top: Math.max(HUD_MARGIN, i.top),
    right: Math.max(HUD_MARGIN, i.right),
    left: Math.max(HUD_MARGIN, i.left),
  };
}

export function joystickZone(vp: Viewport): Rect {
  const y = Math.round(vp.height * (1 - JOYSTICK_ZONE_FRACTION));
  return { x: 0, y, w: vp.width, h: vp.height - y };
}

export interface HudOptions {
  /** `?debug`: enseña la caja de fps y velocidad (O11). Sin él, no hay caja. */
  debug?: boolean;
}

export interface FixedHud {
  home: Rect;
  /** Puntos y monedas; null si no cabe entre Inicio y la brújula. */
  balances: Rect | null;
  /** null sin `debug` o si no cabe entre Inicio (y los saldos) y la brújula. */
  stats: Rect | null;
  compass: Rect;
  menu: Rect;
}

export function fixedHud(vp: Viewport, opts: HudOptions = {}): FixedHud {
  const m = margins(vp);
  const B = HUD_BUTTON;
  const home = { x: m.left, y: m.top, w: B, h: B };
  const menu = { x: vp.width - m.right - B, y: m.top, w: B, h: B };
  const compass = { x: menu.x - HUD_GAP - B, y: m.top, w: B, h: B };
  const fits = (r: Rect) => r.x + r.w + HUD_GAP <= compass.x;
  const balances = { x: home.x + B + HUD_GAP, y: m.top, ...HUD_BALANCES };
  const hasBalances = fits(balances);
  const stats = {
    x: hasBalances ? balances.x + balances.w + HUD_GAP : balances.x,
    y: m.top,
    ...HUD_STATS,
  };
  return {
    home,
    balances: hasBalances ? balances : null,
    stats: opts.debug && fits(stats) ? stats : null,
    compass,
    menu,
  };
}

/** Rectángulo de cada zona del minimapa, válida o no. */
export function minimapZoneRects(vp: Viewport): Record<MinimapZone, Rect> {
  const m = margins(vp);
  const s = minimapSize(vp.width);
  const top = m.top + HUD_BUTTON + HUD_GAP;
  const joy = joystickZone(vp);
  // La zona media queda centrada en el hueco libre, nunca encima de la de arriba.
  const middle = Math.max(top + s + HUD_GAP, Math.round((top + joy.y - s) / 2));
  const right = vp.width - m.right - s;
  return {
    'top-right': { x: right, y: top, w: s, h: s },
    'top-left': { x: m.left, y: top, w: s, h: s },
    'middle-right': { x: right, y: middle, w: s, h: s },
    'middle-left': { x: m.left, y: middle, w: s, h: s },
  };
}

/** Rectángulos del HUD fijo (sin el minimapa ni el aviso). */
function fixedRects(vp: Viewport, opts: HudOptions): Rect[] {
  const f = fixedHud(vp, opts);
  return [
    f.home,
    f.compass,
    f.menu,
    ...(f.stats ? [f.stats] : []),
    ...(f.balances ? [f.balances] : []),
  ];
}

/**
 * Zonas seguras donde puede quedar el minimapa en este viewport: dentro de la
 * pantalla, fuera de la zona del joystick (con un hueco) y sin pisar el HUD
 * fijo. En horizontal, por ejemplo, las medias desaparecen.
 */
export function safeMinimapZones(vp: Viewport, opts: HudOptions = {}): MinimapZone[] {
  const joy = joystickZone(vp);
  const guard = { ...joy, y: joy.y - HUD_GAP, h: joy.h + HUD_GAP };
  const rects = minimapZoneRects(vp);
  const fixed = fixedRects(vp, opts);
  return MINIMAP_ZONES.filter((z) => {
    const r = rects[z];
    return inside(r, vp) && !intersects(r, guard) && !fixed.some((f) => intersects(r, f));
  });
}

/**
 * La zona que se usa con la preferencia guardada: ella misma si es segura en
 * este viewport; si no, la de arriba de su mismo lado; si tampoco, la de por
 * defecto. La preferencia no se toca: al volver a vertical, vuelve.
 */
export function resolveMinimapZone(
  vp: Viewport,
  preferred: MinimapZone | null,
  opts: HudOptions = {},
): MinimapZone {
  const safe = safeMinimapZones(vp, opts);
  if (preferred && safe.includes(preferred)) return preferred;
  const side = preferred?.endsWith('left') ? 'top-left' : 'top-right';
  if (safe.includes(side)) return side;
  return safe[0] ?? DEFAULT_MINIMAP_ZONE;
}

/**
 * Al soltar el minimapa: la zona segura cuyo centro queda más cerca del
 * centro del minimapa en el punto de suelta.
 */
export function snapMinimap(vp: Viewport, dropCenter: { x: number; y: number }): MinimapZone {
  const rects = minimapZoneRects(vp);
  const safe = safeMinimapZones(vp);
  let best: MinimapZone = resolveMinimapZone(vp, null);
  let bestD = Infinity;
  for (const z of safe) {
    const c = center(rects[z]);
    const d = Math.hypot(c.x - dropCenter.x, c.y - dropCenter.y);
    if (d < bestD) {
      bestD = d;
      best = z;
    }
  }
  return best;
}

export interface HudLayout extends FixedHud {
  minimap: Rect;
  minimapZone: MinimapZone;
  notice: Rect;
  joystick: Rect;
}

export function hudLayout(
  vp: Viewport,
  preferred: MinimapZone | null = null,
  opts: HudOptions = {},
): HudLayout {
  const m = margins(vp);
  const minimapZone = resolveMinimapZone(vp, preferred, opts);
  const w = Math.min(NOTICE_MAX_WIDTH, vp.width - m.left - m.right);
  return {
    ...fixedHud(vp, opts),
    minimap: minimapZoneRects(vp)[minimapZone],
    minimapZone,
    notice: { x: Math.round((vp.width - w) / 2), y: m.top, w, h: NOTICE_HEIGHT },
    joystick: joystickZone(vp),
  };
}

export const MINIMAP_ZONE_KEY = 'boia.minimapa.zona';

export function loadMinimapZone(store: KeyValueStore): MinimapZone | null {
  const v = store.getItem(MINIMAP_ZONE_KEY);
  return isMinimapZone(v) ? v : null;
}

export function saveMinimapZone(store: KeyValueStore, zone: MinimapZone): void {
  store.setItem(MINIMAP_ZONE_KEY, zone);
}

/**
 * El minimapa de `/mar` (plan 032 T298, REQ-MUN-021): vive en la fila de
 * arriba, bajo los enlaces, a la izquierda (por defecto, encima del Menú) o a
 * la derecha (cambiándose el sitio con los saldos). Se mueve con «Mover el
 * minimapa» de Ajustes: allí un toque largo ya abre el mapa grande, así que
 * el gesto de 500 ms no sirve. Su preferencia va aparte de la del 2D.
 */
export const MAR_MINIMAP_ZONES = [
  'top-left',
  'top-right',
] as const satisfies readonly MinimapZone[];
export type MarMinimapZone = (typeof MAR_MINIMAP_ZONES)[number];
export const DEFAULT_MAR_MINIMAP_ZONE: MarMinimapZone = 'top-left';
export const MAR_MINIMAP_ZONE_KEY = 'boia.mar.minimapa.zona';

export function isMarMinimapZone(v: unknown): v is MarMinimapZone {
  return typeof v === 'string' && (MAR_MINIMAP_ZONES as readonly string[]).includes(v);
}

export function loadMarMinimapZone(store: KeyValueStore): MarMinimapZone {
  const v = store.getItem(MAR_MINIMAP_ZONE_KEY);
  return isMarMinimapZone(v) ? v : DEFAULT_MAR_MINIMAP_ZONE;
}

export function saveMarMinimapZone(store: KeyValueStore, zone: MarMinimapZone): void {
  store.setItem(MAR_MINIMAP_ZONE_KEY, zone);
}

/** Al soltar el minimapa de `/mar`: el lado de la pantalla donde quedó su centro. */
export function snapMarMinimap(viewportWidth: number, dropCenterX: number): MarMinimapZone {
  return dropCenterX < viewportWidth / 2 ? 'top-left' : 'top-right';
}

/** El otro sitio (tocar el minimapa en modo mover, o Intro con el teclado). */
export function otherMarMinimapZone(zone: MarMinimapZone): MarMinimapZone {
  return zone === 'top-left' ? 'top-right' : 'top-left';
}
