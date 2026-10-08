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
  '.mar-links, .mar-globe, .mar-balances, .mar-menu-btn, .mar-ayuda-btn, .mar-chips > *, .mar-rail, .mar-speed, .mar-turbo, .mar-tickets__btn';

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
 * Cómo se pone cada rótulo (en el orden de `pins`). Ninguno pisa los mandos
 * (`hud`): baja por debajo, sobre su isla, o se apaga. Los más cercanos
 * mandan: uno que pisa la isla o el rótulo de otro más cercano se apaga
 * (o, si es de lo que vende, se queda pequeño y tenue). Con `width` (el
 * ancho de la pantalla, T226), ninguno se sale por los lados.
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
    const behind = at !== null && taken.some((r) => intersects(pinBox({ ...p, ...at! }, scale), r));
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
      lowered: at !== null && at.y !== p.y,
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
