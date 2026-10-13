/**
 * Dónde y cómo se ven los rótulos de los lugares del mar 3D (T75): cada
 * rótulo es de su isla y se lee. Nunca queda debajo de la barra de enlaces
 * ni de otro mando (se apaga mientras los pisaría); los lejanos se ven más
 * pequeños y tenues, y uno que cae encima de un lugar más cercano (su isla o
 * su rótulo) casi se apaga, para que no parezca el nombre de ese otro. Sin
 * three.js: el motor da lo que ve en pantalla y aquí se decide.
 */

/**
 * Los mandos de /mar que los rótulos no pisan (selector CSS): la barra de
 * enlaces, el minimapa, los saldos, los botones de los lados, el zoom y lo
 * de abajo. Un rótulo que caería debajo baja sobre su isla o se apaga.
 */
export const PIN_AVOID =
  '.mar-links, .mar-globe, .mar-balances, .mar-menu-btn, .mar-ayuda-btn, .mar-chips > *, .mar-rail, .mar-speed, .mar-turbo, .mar-horn, .mar-tickets__btn';

/** Un rectángulo en px del lienzo. */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** px entre la punta del rótulo (su sitio en pantalla) y el borde de abajo de su caja (`.mar-pin`). */
export const PIN_TIP = 8;
/** px que se deja libres alrededor de cada mando. */
export const HUD_MARGIN = 4;
/**
 * Lejanía (distancia a la cámara ÷ la del barco) desde la que el rótulo
 * empieza a menguar y a la que ya está en su tamaño más pequeño. muestra
 */
export const FAR_FROM = 1.6;
export const FAR_TO = 4;
/** Lo más pequeño y tenue que se pone un rótulo lejano. muestra */
export const FAR_SCALE = 0.72;
export const FAR_ALPHA = 0.62;
/** Un rótulo que cae encima de un lugar más cercano: así de pequeño y tenue. muestra */
export const BEHIND_SCALE = 0.68;
export const BEHIND_ALPHA = 0.32;
/** Altura (escena) que se deja entre la cima del modelo de Blender y la punta del rótulo. muestra */
export const LABEL_GAP = 1.4;

/** Lo que el motor ve de un rótulo en este fotograma. */
export interface PinSight {
  /** Punta del rótulo en pantalla (px del lienzo). */
  x: number;
  y: number;
  /** Tamaño de la caja a escala 1 (px). */
  w: number;
  h: number;
  /** Distancia a la cámara ÷ la del barco (1: tan lejos como el barco). */
  depth: number;
  /** Asomado al horizonte (su isla queda detrás del planeta). */
  horizon: boolean;
  /** Lo que vende: se queda, aunque tenue, cuando cae sobre otro lugar. */
  always: boolean;
  /** Lo que ocupa su lugar en pantalla (la isla, el modelo), o null si no se ve. */
  body: Rect | null;
  /** false: no se enseña el rótulo (lejos, de cerca); su lugar sí tapa a los de detrás. */
  label?: boolean;
  /**
   * Nunca tenue ni apagado por otro lugar (T275: el Puig Campana en la vista
   * de mapa): si cae encima de uno más cercano, se aparta lo justo (`nudgeClear`);
   * si no hay hueco, se queda entero donde está. Los mandos sí lo apartan.
   */
  keep?: boolean;
}

/** Cómo se pone: si se ve, dónde va su punta (px), su opacidad y su escala (desde la punta). */
export interface PinLook {
  on: boolean;
  /** La punta en pantalla (px): `x` sólo cambia si se desliza para librar un mando de un lado. */
  x: number;
  y: number;
  alpha: number;
  scale: number;
  /** Cae encima de un lugar más cercano. */
  behind: boolean;
  /** Bajado para no pisar un mando (va sobre su propia isla, no encima). */
  lowered: boolean;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const intersects = (a: Rect, b: Rect, margin = 0): boolean =>
  a.left < b.right + margin &&
  a.right > b.left - margin &&
  a.top < b.bottom + margin &&
  a.bottom > b.top - margin;

/** La caja del rótulo en pantalla, escalado `scale` desde su punta. */
export function pinBox(p: Pick<PinSight, 'x' | 'y' | 'w' | 'h'>, scale = 1): Rect {
  const w = p.w * scale;
  const h = p.h * scale;
  const bottom = p.y - PIN_TIP;
  return { left: p.x - w / 2, right: p.x + w / 2, top: bottom - h, bottom };
}

/** Lejos: 0 (cerca, tamaño entero) … 1 (tan pequeño y tenue como se pone). */
export const farness = (p: Pick<PinSight, 'depth' | 'horizon'>): number =>
  p.horizon ? 1 : smooth(FAR_FROM, FAR_TO, p.depth);

/**
 * Dónde va la punta para no pisar ningún mando: si alguno queda encima, el
 * rótulo baja justo por debajo, mientras siga sobre su propia isla en
 * pantalla (de cerca, una isla alta llega hasta la barra de arriba). Si no
 * cabe, null: no se enseña.
 */
export function clearOfHud(p: PinSight, scale: number, hud: readonly Rect[]): number | null {
  return placeClearOfHud(p, scale, hud)?.y ?? null;
}

/**
 * Como `clearOfHud`, pero si lo que pisa es un mando que queda a un lado de
 * la punta (los de la izquierda en el móvil), antes de bajar más prueba a
 * deslizar el rótulo hacia el otro lado, poco (un cuarto de su ancho como
 * mucho) y con la punta aún sobre su isla (T165: un rótulo ancho, centrado
 * en un móvil de 375 px, rozaba por 1 px la columna de la izquierda y se
 * apagaba).
 */
export function placeClearOfHud(
  p: PinSight,
  scale: number,
  hud: readonly Rect[],
): { x: number; y: number } | null {
  let y = p.y;
  const w = p.w * scale;
  for (let k = 0; k < 4; k++) {
    const box = pinBox({ ...p, y }, scale);
    const hit = hud.find((r) => intersects(box, r, HUD_MARGIN));
    if (!hit) return { x: p.x, y };
    if (p.body) {
      const nx =
        hit.right < p.x
          ? hit.right + HUD_MARGIN + w / 2 + 1
          : hit.left > p.x
            ? hit.left - HUD_MARGIN - w / 2 - 1
            : null;
      if (
        nx !== null &&
        Math.abs(nx - p.x) <= w / 4 &&
        nx >= p.body.left &&
        nx <= p.body.right &&
        !hud.some((r) => intersects(pinBox({ ...p, x: nx, y }, scale), r, HUD_MARGIN))
      )
        return { x: nx, y };
    }
    const below = hit.bottom + HUD_MARGIN + p.h * scale + PIN_TIP + 1;
    if (!p.body || below <= y || below > p.body.bottom) return null;
    y = below;
  }
  return null;
}

/** px que se dejan entre un rótulo y el borde de la pantalla, a cada lado (T226). */
export const SCREEN_EDGE = 6;

/**
 * Dentro de la pantalla por los lados (T226): la `x` de la punta para que la
 * caja (a escala `scale`) no se salga por la izquierda ni por la derecha de
 * una pantalla de `width` px. Si apartarlo hacia dentro le hace pisar un
 * mando, se queda donde estaba; si no cabe de ancho, centrado.
 */
export function insideScreen(
  p: Pick<PinSight, 'w' | 'h'>,
  at: { x: number; y: number },
  scale: number,
  width: number,
  hud: readonly Rect[],
): number {
  const half = (p.w * scale) / 2;
  const x =
    2 * (half + SCREEN_EDGE) > width
      ? width / 2
      : Math.min(width - SCREEN_EDGE - half, Math.max(SCREEN_EDGE + half, at.x));
  if (x === at.x) return x;
  const box = pinBox({ ...p, x, y: at.y }, scale);
  return hud.some((r) => intersects(box, r, HUD_MARGIN)) ? at.x : x;
}

/**
 * Los lugares cuyo rótulo se ve entero en la vista de mapa (`keep`, T275):
 * el Puig Campana, que con la isla del ALL DAY delante sólo salía al acercarse.
 */
export const MAP_KEEP: readonly string[] = ['canon'];

/**
 * Lo más que sube un rótulo `keep` para encontrar hueco (px): en un móvil de
 * 360 px, entre el minimapa, la barra de arriba y el rótulo del ALL DAY, el
 * del Puig Campana sólo cabe unos 50 px más arriba. muestra
 */
export const NUDGE_UP = 64;
/** Paso (px) con el que se buscan los huecos de un rótulo `keep`. */
const NUDGE_STEP = 4;

/**
 * Un hueco para el rótulo `keep` que pisa un mando o lo de un lugar más
 * cercano (T275): de lado, con la punta aún dentro de su caja (como la dibuja
 * `.mar-pin`, hasta medio ancho menos 10 px), y si no basta, más arriba
 * (hasta `NUDGE_UP`); lo más cerca posible de su sitio, sin pisar mandos ni
 * salirse de la pantalla, y si puede ser sin tapar tampoco las islas de
 * detrás (`spare`). null si no hay.
 */
export function nudgeClear(
  p: PinSight,
  at: { x: number; y: number },
  scale: number,
  taken: readonly Rect[],
  hud: readonly Rect[],
  width?: number,
  spare: readonly Rect[] = [],
): { x: number; y: number } | null {
  const room = Math.max(0, (p.w * scale) / 2 - 10);
  const tries: { x: number; y: number; cost: number }[] = [];
  for (let dy = 0; dy <= NUDGE_UP; dy += NUDGE_STEP)
    for (let dx = 0; dx <= room; dx += NUDGE_STEP)
      for (const sx of dx ? [-dx, dx] : [0])
        tries.push({ x: p.x + sx, y: at.y - dy, cost: dx + 2 * dy });
  tries.sort((a, b) => a.cost - b.cost);
  // Primero, un hueco que tampoco tape las islas de detrás (`spare`); si no hay, uno que sí.
  for (const avoid of spare.length ? [[...taken, ...spare], taken] : [taken]) {
    for (const c of tries) {
      const box = pinBox({ ...p, ...c }, scale);
      if (width !== undefined && (box.left < SCREEN_EDGE || box.right > width - SCREEN_EDGE))
        continue;
      if (avoid.some((r) => intersects(box, r))) continue;
      if (hud.some((r) => intersects(box, r, HUD_MARGIN))) continue;
      return { x: c.x, y: c.y };
    }
  }
  return null;
}

/**
 * Cómo se pone cada rótulo (en el orden de `pins`). Ninguno pisa los mandos
 * (`hud`): baja por debajo, sobre su isla, o se apaga. Los más cercanos
 * mandan: uno que pisa la isla o el rótulo de otro más cercano se apaga
 * (o, si es de lo que vende, se queda pequeño y tenue); uno `keep` (T275)
 * se aparta a un hueco y se queda entero. Con `width` (el ancho de la
 * pantalla, T226), ninguno se sale por los lados.
 */
export function layoutPins(
  pins: readonly PinSight[],
  hud: readonly Rect[],
  width?: number,
): PinLook[] {
  const out: PinLook[] = pins.map((p) => ({
    on: false,
    x: p.x,
    y: p.y,
    alpha: 1,
    scale: 1,
    behind: false,
    lowered: false,
  }));
  const order = pins.map((_, i) => i).sort((a, b) => pins[a]!.depth - pins[b]!.depth);
  // Lo que ya ocupan los más cercanos: sus islas y sus rótulos.
  const taken: Rect[] = [];
  for (const i of order) {
    const p = pins[i]!;
    const far = farness(p);
    let scale = 1 - (1 - FAR_SCALE) * far;
    let alpha = 1 - (1 - FAR_ALPHA) * far;
    const place = (s: number) => {
      const a = placeClearOfHud(p, s, hud);
      return a && width ? { x: insideScreen(p, a, s, width, hud), y: a.y } : a;
    };
    let at = place(scale);
    let behind = at !== null && taken.some((r) => intersects(pinBox({ ...p, ...at! }, scale), r));
    if (p.keep && (behind || at === null)) {
      // T275: ni tenue ni apagado: se aparta a un hueco si lo hay; si no, se
      // queda entero donde está (o apagado, si lo único que tiene son mandos).
      const farther = pins.filter((q) => q !== p && q.body && q.depth >= p.depth);
      const free = nudgeClear(
        p,
        at ?? p,
        scale,
        taken,
        hud,
        width,
        farther.map((q) => q.body!),
      );
      if (free) at = free;
      behind = false;
    }
    if (behind) {
      scale = Math.min(scale, BEHIND_SCALE);
      alpha = Math.min(alpha, BEHIND_ALPHA);
      at = place(scale);
    }
    const on = p.label !== false && at !== null && (!behind || p.always);
    out[i] = {
      on,
      x: at?.x ?? p.x,
      y: at?.y ?? p.y,
      alpha,
      scale,
      behind,
      lowered: at !== null && at.y > p.y,
    };
    if (p.body) taken.push(p.body);
    if (on && !behind) taken.push(pinBox({ ...p, ...at! }, scale));
  }
  return out;
}

/** La altura (escena) del rótulo sobre una isla de Blender: su alto real, escalado, y un respiro. */
export function modelLabelY(
  entry: { height?: number; radius: number },
  R: number,
): number | null {
  if (typeof entry.height !== 'number' || !(entry.height > 0)) return null;
  return entry.height * (R / entry.radius) + LABEL_GAP;
}
