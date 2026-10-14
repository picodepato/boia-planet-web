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
 * enlaces, el minimapa, los saldos, los botones de los lados (también la
 * Radio), el zoom, lo de abajo y, en la vista de mapa, su «Cerrar» (T280).
 * Un rótulo que caería debajo baja sobre su isla o se apaga.
 */
export const PIN_AVOID =
  '.mar-links, .mar-globe, .mar-balances, .mar-menu-btn, .mar-ayuda-btn, .radio-btn--mar, .mar-chips > *, .mar-rail, .mar-speed, .mar-turbo, .mar-horn, .mar-tickets__btn, .mar-mapclose';

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
   * de mapa; desde T280, todas las islas): si cae encima de otro, se aparta lo
   * justo (`nudgeClear`) o mengua un poco (`KEEP_SHRINK`). Se pone después de
   * los eventos (T279), así que nunca les quita el sitio, y antes que lo que no
   * es `keep`; si no hay hueco, cede como uno cualquiera. Los mandos sí lo apartan.
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
  /**
   * Colgado debajo de su isla, con la punta hacia arriba (T280: en la vista de
   * mapa, un `keep` sin hueco encima): `y` es entonces el borde de abajo de la isla.
   */
  below?: boolean;
}

/** Un sitio para la punta de un rótulo: encima de su lugar o, con `below`, debajo. */
export interface Spot {
  x: number;
  y: number;
  below?: boolean;
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

/**
 * La caja del rótulo en pantalla, escalado `scale` desde su punta: encima de
 * la punta o, con `below` (T280), colgando debajo.
 */
export function pinBox(
  p: Pick<PinSight, 'x' | 'y' | 'w' | 'h'> & { below?: boolean },
  scale = 1,
): Rect {
  const w = p.w * scale;
  const h = p.h * scale;
  if (p.below) {
    const top = p.y + PIN_TIP;
    return { left: p.x - w / 2, right: p.x + w / 2, top, bottom: top + h };
  }
  const bottom = p.y - PIN_TIP;
  return { left: p.x - w / 2, right: p.x + w / 2, top: bottom - h, bottom };
}

/** La caja de un rótulo tal y como queda (`layoutPins`). */
export const lookBox = (p: Pick<PinSight, 'w' | 'h'>, look: Spot & { scale: number }): Rect =>
  pinBox({ w: p.w, h: p.h, x: look.x, y: look.y, below: !!look.below }, look.scale);

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
 * Los lugares cuyo rótulo se ve entero en la vista de mapa (`keep`): T275
 * empezó por el Puig Campana, que con la isla del ALL DAY delante sólo salía
 * al acercarse; desde T280, todas las islas (el Castillo de Santa Bárbara y
 * Las Calitas tampoco salían). Lo demás (el náufrago, la salida de la carrera)
 * se pone si cabe.
 */
export const mapKeeps = (category: string): boolean => category === 'isla';

/**
 * Lo más que sube un rótulo `keep` para encontrar hueco (px): en un móvil de
 * 360 px, entre el minimapa, la barra de arriba y el rótulo del ALL DAY, el
 * del Puig Campana sólo cabe unos 50 px más arriba. muestra
 */
export const NUDGE_UP = 64;
/**
 * Lo que mengua, como mucho, un rótulo `keep` que no cabe a su tamaño (T280:
 * en un móvil de 360 px, el Castillo de Santa Bárbara); antes prueba
 * `KEEP_SHRINK_STEPS`, de más grande a más pequeño. Un rótulo de lejos fuera
 * del mapa mengua más (`FAR_SCALE`). muestra
 */
export const KEEP_SHRINK = 0.7;
const KEEP_SHRINK_STEPS: readonly number[] = [0.9, 0.8, KEEP_SHRINK];
/** Paso (px) con el que se buscan los huecos de un rótulo `keep`. */
const NUDGE_STEP = 4;

/**
 * Un hueco para el rótulo `keep` que pisa un mando o lo de un lugar más
 * cercano (T275): de lado, con la punta aún dentro de su caja (como la dibuja
 * `.mar-pin`, hasta medio ancho menos 10 px), y si no basta, más arriba
 * (hasta `NUDGE_UP`) y, si tampoco (T280), colgado debajo de su isla; lo más
 * cerca posible de su sitio, sin pisar mandos ni salirse de la pantalla, y si
 * puede ser sin tapar tampoco las islas de detrás (`spare`). null si no hay.
 */
export function nudgeClear(
  p: PinSight,
  at: { x: number; y: number },
  scale: number,
  taken: readonly Rect[],
  hud: readonly Rect[],
  width?: number,
  spare: readonly Rect[] = [],
): Spot | null {
  // T280: se llama muchas veces por fotograma en la vista de mapa: sin copiar
  // objetos por cada sitio probado (una caja que se reescribe).
  const hw = (p.w * scale) / 2;
  const h = p.h * scale;
  const room = Math.max(0, hw - 10);
  const box: Rect = { left: 0, top: 0, right: 0, bottom: 0 };
  const fits = (x: number, tip: number, below: boolean, extra: readonly Rect[]) => {
    box.left = x - hw;
    box.right = x + hw;
    if (width !== undefined && (box.left < SCREEN_EDGE || box.right > width - SCREEN_EDGE))
      return false;
    box.top = below ? tip + PIN_TIP : tip - PIN_TIP - h;
    box.bottom = box.top + h;
    for (const r of hud) if (intersects(box, r, HUD_MARGIN)) return false;
    for (const r of taken) if (intersects(box, r)) return false;
    for (const r of extra) if (intersects(box, r)) return false;
    return true;
  };
  // Primero, un hueco que tampoco tape las islas de detrás (`spare`); si no hay, uno que sí.
  for (const extra of spare.length ? [spare, []] : [[]]) {
    for (const o of NUDGE_OFFSETS)
      if (Math.abs(o.dx) <= room && fits(p.x + o.dx, at.y - o.dy, false, extra))
        return { x: p.x + o.dx, y: at.y - o.dy };
    if (p.body)
      for (const o of NUDGE_OFFSETS)
        if (
          o.dy <= BELOW_DOWN &&
          Math.abs(o.dx) <= room &&
          fits(p.x + o.dx, p.body.bottom + o.dy, true, extra)
        )
          return { x: p.x + o.dx, y: p.body.bottom + o.dy, below: true };
  }
  return null;
}

/**
 * Cuántos sitios, como mucho, prueba `shoveClear` (los más cercanos): cada uno
 * busca otro hueco para lo que aparta, y en la vista de mapa va en cada fotograma.
 */
const SHOVE_TRIES = 240;

/** Lo más que se desliza de lado un rótulo `keep` (px; su caja lo limita antes). */
const NUDGE_SIDE = 200;

/**
 * Los desplazamientos que prueba `nudgeClear`, del más cercano al más lejano
 * (de lado cuesta 1 por px, hacia arriba 2): se ordenan una vez (T280: se
 * prueban muchas veces por fotograma en la vista de mapa).
 */
const NUDGE_OFFSETS: readonly { dx: number; dy: number; cost: number }[] = (() => {
  const all: { dx: number; dy: number; cost: number }[] = [];
  for (let dy = 0; dy <= NUDGE_UP; dy += NUDGE_STEP)
    for (let dx = 0; dx <= NUDGE_SIDE; dx += NUDGE_STEP)
      for (const sx of dx ? [-dx, dx] : [0]) all.push({ dx: sx, dy, cost: dx + 2 * dy });
  return all.sort((a, b) => a.cost - b.cost);
})();

/**
 * Los sitios que prueba `nudgeClear`, del más cercano al más lejano: encima
 * de su lugar y, después (T280), colgado debajo de su isla (si se ve).
 */
function nudgeTries(p: PinSight, at: { x: number; y: number }, scale: number): Spot[] {
  const room = Math.max(0, (p.w * scale) / 2 - 10);
  const tries: Spot[] = [];
  for (const o of NUDGE_OFFSETS)
    if (Math.abs(o.dx) <= room) tries.push({ x: p.x + o.dx, y: at.y - o.dy });
  if (p.body) {
    const under = p.body.bottom;
    for (const o of NUDGE_OFFSETS)
      if (Math.abs(o.dx) <= room && o.dy <= BELOW_DOWN)
        tries.push({ x: p.x + o.dx, y: under + o.dy, below: true });
  }
  return tries;
}

/** Lo más que baja (px) un rótulo colgado debajo de su isla para encontrar hueco (T280). muestra */
const BELOW_DOWN = 24;

/** Sin pisar mandos ni salirse por los lados. */
const onScreen = (box: Rect, hud: readonly Rect[], width?: number) =>
  (width === undefined || (box.left >= SCREEN_EDGE && box.right <= width - SCREEN_EDGE)) &&
  !hud.some((r) => intersects(box, r, HUD_MARGIN));

/**
 * Último recurso de un `keep` sin hueco (T279: el Puig Campana en un móvil,
 * entre la Isla de Nochevieja y el ALL DAY): un sitio donde sólo pisa
 * rótulos `keep` ya puestos que, a su vez, caben en otro hueco sin él
 * encima. Devuelve su sitio y los nuevos de los que se apartan, o null.
 */
function shoveClear(
  p: PinSight,
  at: { x: number; y: number },
  scale: number,
  bodiesFor: (q: PinSight) => Rect[],
  labels: ReadonlyMap<number, { pin: PinSight; at: Spot; scale: number }>,
  hud: readonly Rect[],
  width?: number,
): { at: Spot; moved: Map<number, Spot> } | null {
  const boxOf = (q: PinSight, a: Spot, sc: number) => lookBox(q, { ...a, scale: sc });
  // Lo que no cambia de un sitio a otro, una vez (T280: va en cada fotograma del mapa).
  const mine = bodiesFor(p);
  const placed = [...labels].map(([j, l]) => ({ j, l, box: boxOf(l.pin, l.at, l.scale) }));
  const tries = nudgeTries(p, at, scale);
  for (let t = 0; t < tries.length && t < SHOVE_TRIES; t++) {
    const c = tries[t]!;
    const box = boxOf(p, c, scale);
    if (!onScreen(box, hud, width) || mine.some((r) => intersects(box, r))) continue;
    const hit = placed.filter((q) => intersects(box, q.box));
    if (hit.length === 0 || hit.some((q) => !q.l.pin.keep)) continue;
    const moved = new Map<number, Spot>();
    const ok = hit.every(({ j, l }) => {
      const rest = placed
        .filter((q) => q.j !== j)
        .map((q) => (moved.has(q.j) ? boxOf(q.l.pin, moved.get(q.j)!, q.l.scale) : q.box));
      const to = nudgeClear(l.pin, l.at, l.scale, [...bodiesFor(l.pin), ...rest, box], hud, width);
      if (to) moved.set(j, to);
      return to !== null;
    });
    if (ok) return { at: c, moved };
  }
  return null;
}

/**
 * Cómo se pone cada rótulo (en el orden de `pins`). Ninguno pisa los mandos
 * (`hud`): baja por debajo, sobre su isla, o se apaga. Los más cercanos
 * mandan: uno que pisa la isla o el rótulo de otro más cercano se apaga
 * (o, si es de lo que vende, se queda pequeño y tenue); uno `keep` (T275:
 * en la vista de mapa, los eventos y, desde T280, todas las islas) se aparta a
 * un hueco libre (T279) y, si no lo hay a su tamaño, a uno un poco más pequeño
 * (`KEEP_SHRINK`, T280). Con `width` (el ancho de la pantalla, T226), ninguno
 * se sale por los lados.
 */
export function layoutPins(
  pins: readonly PinSight[],
  hud: readonly Rect[],
  width?: number,
): PinLook[] {
  const looks = layoutOnce(pins, hud, width, new Set());
  // T280: si algún `keep` se queda sin sitio (en un móvil, con todas las islas
  // en la vista de mapa), otra pasada con esos antes que los otros `keep`
  // (nunca antes que los eventos); vale si se pierden menos.
  const lost = lostKeeps(pins, looks);
  if (lost.size === 0) return looks;
  const again = layoutOnce(pins, hud, width, lost);
  return lostKeeps(pins, again).size < lost.size ? again : looks;
}

/** Los `keep` que no se ven enteros (apagados o tenues). */
function lostKeeps(pins: readonly PinSight[], looks: readonly PinLook[]): Set<number> {
  const out = new Set<number>();
  pins.forEach((p, i) => {
    if (p.keep && p.label !== false && !(looks[i]!.on && !looks[i]!.behind)) out.add(i);
  });
  return out;
}

/** Una pasada de `layoutPins`; los de `first` van antes que los demás `keep` que no son eventos. */
function layoutOnce(
  pins: readonly PinSight[],
  hud: readonly Rect[],
  width: number | undefined,
  first: ReadonlySet<number>,
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
  // Primero lo que vende con `keep` (en la vista de mapa, los eventos, T279),
  // después los otros `keep` (las demás islas, T275/T280), que buscan un hueco
  // libre entre lo ya puesto, y al final los demás (el náufrago, la salida de
  // la carrera), si caben; en cada grupo, de cerca a lejos.
  const rank = (p: PinSight) => (p.keep ? (p.always ? 0 : 1) : 2);
  const order = pins
    .map((_, i) => i)
    .sort(
      (a, b) =>
        rank(pins[a]!) - rank(pins[b]!) ||
        +!first.has(a) - +!first.has(b) ||
        pins[a]!.depth - pins[b]!.depth,
    );
  // Lo ya puesto: las islas (tapan a lo de detrás) y los rótulos (a todos).
  // Las de lo que no es `keep` van después pero tapan desde el principio (T280).
  const bodies = pins.flatMap((q) => (q.body && !q.keep ? [{ rect: q.body, depth: q.depth }] : []));
  const labels = new Map<number, { pin: PinSight; at: Spot; scale: number }>();
  const nearer = (q: PinSight) => bodies.filter((b) => b.depth < q.depth).map((b) => b.rect);
  const takenNow = (q: PinSight) => [
    ...nearer(q),
    ...[...labels.values()].map((l) => lookBox(l.pin, { ...l.at, scale: l.scale })),
  ];
  // Los ya puestos (T280: la isla de un `keep` aún sin poner no se tapa si se puede).
  const done = new Set<PinSight>();
  for (const i of order) {
    const p = pins[i]!;
    done.add(p);
    if (p.body && p.keep) bodies.push({ rect: p.body, depth: p.depth });
    const far = farness(p);
    let scale = 1 - (1 - FAR_SCALE) * far;
    let alpha = 1 - (1 - FAR_ALPHA) * far;
    const place = (s: number) => {
      const a = placeClearOfHud(p, s, hud);
      return a && width ? { x: insideScreen(p, a, s, width, hud), y: a.y } : a;
    };
    const taken = takenNow(p);
    let at: Spot | null = place(scale);
    let behind = at !== null && taken.some((r) => intersects(pinBox({ ...p, ...at! }, scale), r));
    if (p.keep && (behind || at === null)) {
      // T275: ni tenue ni apagado: se aparta a un hueco si lo hay. Si no hay
      // (T279), aparta otro `keep` que quepa en otro sitio o cede como
      // cualquier otro: nunca tapa el rótulo de un evento.
      // T280: antes que tapar otra isla, mengua un poco (`KEEP_SHRINK_STEPS`),
      // salvo que la isla ya tenga su rótulo puesto; nunca tapa la de un `keep`
      // que aún no se ha puesto (le quitaría el sitio) si no es a la desesperada.
      const others = pins.filter((q) => q !== p && q.body);
      const spare = others.map((q) => q.body!);
      const pending = others
        .filter((q) => q.keep && !done.has(q))
        .map((q) => q.body!);
      const seek = (k: number, avoid: readonly Rect[]) =>
        nudgeClear(p, place(scale * k) ?? at ?? p, scale * k, [...taken, ...avoid], hud, width);
      const shrink = [...KEEP_SHRINK_STEPS];
      let found: { spot: Spot; k: number } | null = null;
      const full = seek(1, spare);
      if (full) found = { spot: full, k: 1 };
      if (!found) {
        const shove = shoveClear(p, at ?? p, scale, nearer, labels, hud, width);
        if (shove) {
          for (const [j, to] of shove.moved) {
            labels.get(j)!.at = to;
            out[j] = {
              ...out[j]!,
              x: to.x,
              y: to.y,
              lowered: !to.below && to.y > pins[j]!.y,
              below: !!to.below,
            };
          }
          found = { spot: shove.at, k: 1 };
        }
      }
      const plan: [number, readonly Rect[]][] = [
        [1, pending],
        ...shrink.map((k): [number, readonly Rect[]] => [k, spare]),
        ...shrink.map((k): [number, readonly Rect[]] => [k, pending]),
        [1, []],
        ...shrink.map((k): [number, readonly Rect[]] => [k, []]),
      ];
      for (const [k, avoid] of plan) {
        if (found) break;
        const spot = seek(k, avoid);
        if (spot) found = { spot, k };
      }
      if (found) {
        scale *= found.k;
        at = found.spot;
        behind = false;
      }
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
      lowered: at !== null && !at.below && at.y > p.y,
      below: !!at?.below,
    };
    if (on && !behind) labels.set(i, { pin: p, at: at!, scale });
  }
  return out;
}

/** La altura (escena) del rótulo sobre una isla de Blender: su alto real, escalado, y un respiro. */
export function modelLabelY(entry: { height?: number; radius: number }, R: number): number | null {
  if (typeof entry.height !== 'number' || !(entry.height > 0)) return null;
  return entry.height * (R / entry.radius) + LABEL_GAP;
}
