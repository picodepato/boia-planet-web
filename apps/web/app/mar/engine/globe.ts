/**
 * El minimapa redondo de /mar (T34): el planeta entero pintado como un globo
 * pequeño que gira despacio (el mismo giro que el cielo de T33,
 * `Mar3D.planetSpin`). Sin three.js: un lienzo 2D pequeño que se repinta a
 * pocos fotogramas por segundo.
 *
 * Proyección: el periodo del planeta (lo que da la vuelta) ocupa el disco
 * entero una sola vez, así que todo (el barco, cada isla) sale siempre y
 * nunca repetido; el cuadrado pasa al disco con el mapeo elíptico
 * (biyectivo) y se abomba un poco hacia el centro, como una esfera vista de
 * frente.
 *
 * Centrado como el mapa grande (T68, decisión del 2026-10-02): el centro del
 * planeta va siempre al centro del disco. Antes el giro del cielo arrastraba
 * también las islas, el barco y la ruta hacia el este y, al rato, lo que
 * enseñaba se veía corrido a la derecha; ahora el giro sólo mueve los
 * meridianos (se sigue leyendo como un globo que gira). muestra
 */

export interface GlobeRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface GlobePoint {
  /** En el disco unidad (centro 0,0; radio 1), x a la derecha e y hacia abajo (el sur). */
  x: number;
  y: number;
  /** Coordenadas en el cuadrado, [-1, 1): para cortar las líneas en la costura. */
  u: number;
  v: number;
}

/** Cuánto se abomba hacia el centro (0 = plano, 1 = esfera ortográfica). muestra */
export const GLOBE_BULGE = 0.45;

const HALF_PI = Math.PI / 2;

/** De (u, v) en el cuadrado [-1, 1]² al disco unidad, abombado. */
export function discOf(u: number, v: number, out: GlobePoint = { x: 0, y: 0, u, v }): GlobePoint {
  // Cuadrado → disco (mapeo elíptico de Fong): los bordes van al círculo.
  const dx = u * Math.sqrt(Math.max(0, 1 - (v * v) / 2));
  const dy = v * Math.sqrt(Math.max(0, 1 - (u * u) / 2));
  const r = Math.hypot(dx, dy);
  // Radial monótono con f(0) = 0 y f(1) = 1: el centro más grande, el borde apretado.
  const k =
    r > 1e-9
      ? (r + (Math.sin(r * HALF_PI) - r) * GLOBE_BULGE) / r
      : 1 + (HALF_PI - 1) * GLOBE_BULGE;
  out.x = dx * k;
  out.y = dy * k;
  out.u = u;
  out.v = v;
  return out;
}

/**
 * Un punto del mundo (u de motor) en el globo. `spin` (rad) desplaza el mar
 * hacia el este: una vuelta entera del planeta por cada 2π.
 */
export function globeProject(
  x: number,
  y: number,
  rect: GlobeRect,
  spin: number,
  out: GlobePoint = { x: 0, y: 0, u: 0, v: 0 },
): GlobePoint {
  const fx = (x - rect.left) / (rect.right - rect.left) + spin / (2 * Math.PI);
  const fy = (y - rect.top) / (rect.bottom - rect.top);
  const u = (fx - Math.floor(fx)) * 2 - 1;
  const v = (fy - Math.floor(fy)) * 2 - 1;
  return discOf(u, v, out);
}

/** Dos puntos seguidos de una línea quedan a los dos lados de la costura: no se unen. */
export const acrossSeam = (a: GlobePoint, b: GlobePoint): boolean =>
  Math.abs(a.u - b.u) > 1 || Math.abs(a.v - b.v) > 1;

/**
 * Rumbo en el disco (rad, como `atan2` en pantalla) de algo que va con
 * `heading` (rad de motor) desde (x, y). Mira un paso por delante o, si ese
 * paso cae al otro lado de la costura, uno por detrás.
 */
export function globeHeading(
  x: number,
  y: number,
  heading: number,
  rect: GlobeRect,
  spin: number,
): number {
  const step = Math.min(rect.right - rect.left, rect.bottom - rect.top) * 0.01;
  const a = globeProject(x, y, rect, spin);
  const ahead = globeProject(
    x + Math.cos(heading) * step,
    y + Math.sin(heading) * step,
    rect,
    spin,
  );
  if (!acrossSeam(a, ahead)) return Math.atan2(ahead.y - a.y, ahead.x - a.x);
  const back = globeProject(x - Math.cos(heading) * step, y - Math.sin(heading) * step, rect, spin);
  return Math.atan2(a.y - back.y, a.x - back.x);
}

export interface GlobePin {
  id: string;
  x: number;
  y: number;
  /** La isla del evento: más grande y en naranja. */
  accent?: boolean;
}

export interface GlobeScene {
  rect: GlobeRect;
  /** El giro del planeta (rad): sólo mueve los meridianos; lo demás queda centrado. */
  spin: number;
  ship: { x: number; y: number; heading: number };
  pins: readonly GlobePin[];
  /**
   * Los «?» (T59): los descuentos por encontrar (el náufrago, el ánfora y el
   * premio de la Boia Fiestera). Se pintan encima de las islas.
   */
  marks?: readonly GlobePin[];
  /** La ruta (sus marcas en el agua), seguida (puede salirse del periodo: se envuelve aquí). */
  route: readonly { x: number; y: number }[];
  course: { x: number; y: number } | null;
}

export const GLOBE_COLORS = {
  sea: 'rgba(38, 140, 190, 0.55)',
  seaDeep: 'rgba(22, 16, 70, 0.72)',
  grid: 'rgba(255, 255, 255, 0.13)',
  rim: 'rgba(255, 244, 226, 0.55)',
  route: '#ffd23f',
  island: '#fff4e2',
  islandEdge: 'rgba(27, 20, 64, 0.85)',
  // Naranja de la marca (T50, `C.orange`).
  accent: '#ec4f24',
  ship: '#ffffff',
  course: '#ffd23f',
  // Los «?» de los descuentos (T59): amarillo de la ruta con tinta de la marca.
  mark: '#ffd23f',
  markInk: '#1b1440',
} as const;

/** Paralelos y meridianos del globo (en el cuadrado), para que se lea redondo y girando. */
const GRID = [-0.5, 0, 0.5];

/**
 * Pinta el globo en un lienzo cuadrado de `size` px (de dispositivo). Barato:
 * unas pocas decenas de trazos; quien lo usa lo llama a pocos fps. Devuelve
 * dónde quedó pintado el centro del planeta (px del lienzo): el centro del
 * lienzo, como en el mapa grande.
 */
export function drawGlobe(
  ctx: CanvasRenderingContext2D,
  size: number,
  s: GlobeScene,
): { x: number; y: number } {
  // px de este lienzo por px de un minimapa de 88: los tamaños no dependen de la resolución.
  const px = size / 88;
  // Un margen para que el barco y las islas del borde no se corten con el lienzo.
  const R = size / 2 - 5 * px;
  const c = size / 2;
  const P = (p: GlobePoint) => [c + p.x * R, c + p.y * R] as const;
  const tmp: GlobePoint = { x: 0, y: 0, u: 0, v: 0 };
  // Lo que hay en el mar se proyecta sin el giro: centrado como el mapa grande.
  const at = (x: number, y: number) => globeProject(x, y, s.rect, 0, tmp);

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.clip();

  // El mar: claro arriba a la izquierda, hondo en el borde (se lee esfera).
  const sea = ctx.createRadialGradient(c - R * 0.35, c - R * 0.4, R * 0.1, c, c, R);
  sea.addColorStop(0, GLOBE_COLORS.sea);
  sea.addColorStop(1, GLOBE_COLORS.seaDeep);
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, size, size);

  // Meridianos que giran con el planeta y paralelos fijos.
  ctx.strokeStyle = GLOBE_COLORS.grid;
  ctx.lineWidth = Math.max(1, px * 0.8);
  const shift = s.spin / Math.PI; // en unidades del cuadrado (2 = una vuelta)
  for (const g of GRID) {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const [x, y] = P(discOf(-1 + (i / 24) * 2, g, tmp));
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  for (let k = 0; k < 4; k++) {
    let u = -0.75 + k * 0.5 + shift;
    u = ((((u + 1) % 2) + 2) % 2) - 1;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const [x, y] = P(discOf(u, -1 + (i / 24) * 2, tmp));
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }

  // La ruta (las marcas en el agua): trazos amarillos, cortados en la costura.
  if (s.route.length > 1) {
    ctx.save();
    ctx.globalAlpha = 0.6; // más transparente (T113)
    ctx.strokeStyle = GLOBE_COLORS.route;
    ctx.lineWidth = Math.max(1, px * 1.4);
    ctx.setLineDash([px * 3, px * 2.5]);
    ctx.beginPath();
    const prev: GlobePoint = { x: 0, y: 0, u: 0, v: 0 };
    for (let i = 0; i < s.route.length; i++) {
      const q = s.route[i]!;
      const [x, y] = P(at(q.x, q.y));
      if (i === 0 || acrossSeam(prev, tmp)) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      Object.assign(prev, tmp);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Brillo arriba a la izquierda y el borde; lo de encima (islas, barco) sin recortar.
  const shine = ctx.createRadialGradient(
    c - R * 0.45,
    c - R * 0.5,
    0,
    c - R * 0.45,
    c - R * 0.5,
    R,
  );
  shine.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  shine.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.strokeStyle = GLOBE_COLORS.rim;
  ctx.lineWidth = Math.max(1, px * 1.2);
  ctx.stroke();

  // Islas: puntos crema; la del evento, naranja y con aro. Más pequeñas hacia el borde.
  const pins = [...s.pins].sort((a, b) => Number(!!a.accent) - Number(!!b.accent));
  for (const pin of pins) {
    const [x, y] = P(at(pin.x, pin.y));
    const depth = Math.sqrt(Math.max(0, 1 - tmp.x * tmp.x - tmp.y * tmp.y));
    const r = (pin.accent ? 4.2 : 2.6) * px * (0.6 + 0.4 * depth);
    if (pin.accent) {
      ctx.beginPath();
      ctx.arc(x, y, r + 2.6 * px, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(242, 106, 27, 0.35)';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = pin.accent ? GLOBE_COLORS.accent : GLOBE_COLORS.island;
    ctx.fill();
    ctx.lineWidth = Math.max(1, px * 0.9);
    ctx.strokeStyle = pin.accent ? GLOBE_COLORS.island : GLOBE_COLORS.islandEdge;
    ctx.stroke();
  }

  // Los «?» de los descuentos por encontrar: un círculo amarillo con su interrogación.
  for (const m of s.marks ?? []) {
    const [x, y] = P(at(m.x, m.y));
    const depth = Math.sqrt(Math.max(0, 1 - tmp.x * tmp.x - tmp.y * tmp.y));
    const r = 5.2 * px * (0.7 + 0.3 * depth);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = GLOBE_COLORS.mark;
    ctx.fill();
    ctx.lineWidth = Math.max(1, px * 1.1);
    ctx.strokeStyle = GLOBE_COLORS.markInk;
    ctx.stroke();
    ctx.fillStyle = GLOBE_COLORS.markInk;
    ctx.font = `bold ${Math.round(r * 1.5)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x, y + r * 0.08);
  }

  // El rumbo marcado: un aro amarillo.
  if (s.course) {
    const [x, y] = P(at(s.course.x, s.course.y));
    ctx.beginPath();
    ctx.arc(x, y, 3.2 * px, 0, Math.PI * 2);
    ctx.strokeStyle = GLOBE_COLORS.course;
    ctx.lineWidth = Math.max(1, px * 1.3);
    ctx.stroke();
  }

  // El barco: flecha blanca con borde oscuro, hacia donde va.
  const [sx, sy] = P(at(s.ship.x, s.ship.y));
  const a = globeHeading(s.ship.x, s.ship.y, s.ship.heading, s.rect, 0);
  const L = 9 * px;
  // Un halo claro: el barco se encuentra de un vistazo, también en el borde.
  ctx.beginPath();
  ctx.arc(sx, sy, L * 0.75, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.fill();
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(L * 0.6, 0);
  ctx.lineTo(-L * 0.45, -L * 0.42);
  ctx.lineTo(-L * 0.2, 0);
  ctx.lineTo(-L * 0.45, L * 0.42);
  ctx.closePath();
  ctx.fillStyle = GLOBE_COLORS.ship;
  ctx.fill();
  ctx.lineWidth = Math.max(1, px * 1.1);
  ctx.strokeStyle = GLOBE_COLORS.islandEdge;
  ctx.stroke();
  ctx.restore();

  const [mx, my] = P(at((s.rect.left + s.rect.right) / 2, (s.rect.top + s.rect.bottom) / 2));
  return { x: mx, y: my };
}
