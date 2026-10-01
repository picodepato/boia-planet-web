import { between, rng } from './rng';
import { outline, wash } from './skin';
import type {
  BaseConfig,
  DrawOptions,
  Ending,
  EndReason,
  MinigameDefinition,
  MinigameInput,
  MinigameSim,
  MinigameSkin,
  Point,
  SimEvent,
  StatusItem,
} from './types';

/**
 * Vigilancia del faro (REQ-AVE-036, T60). Es de noche: los barcos piratas
 * salen del horizonte rumbo a la costa y sólo se ven en silueta. Barriendo
 * el mar con el haz del faro, la luz se acumula sobre cada barco; cuando se
 * llena, el pirata queda descubierto y da media vuelta. Si uno llega a la
 * costa, se pierde una vida. El DESTELLO (uno por oleada) descubre de golpe
 * a todos los que caen en un cono ancho.
 *
 * Oleadas cada vez más rápidas y nutridas; racha de descubiertos seguidos
 * que multiplica los puntos; tres vidas. Fin: sin vidas, o tras la última
 * oleada. Se gana el premio con `goal` puntos o más. Todo `muestra`.
 */

export type FaroKind = 'sloop' | 'brig' | 'galleon';

export interface FaroKindRule {
  /** s de luz continua que hacen falta para descubrirlo. */
  spotS: number;
  points: number;
  /** Multiplica la velocidad de la oleada. */
  speed: number;
}

export interface FaroConfig extends BaseConfig {
  lives: number;
  /** Oleadas de la noche; tras la última, la partida acaba. */
  waves: number;
  /** Semiancho del haz, en radianes (generoso: no exige precisión de un píxel). */
  beamHalfWidth: number;
  /** rad/s del haz con el teclado. */
  turnSpeed: number;
  /** rad/s máximos del haz siguiendo al dedo. */
  followSpeed: number;
  beamMin: number;
  beamMax: number;
  /** Fracción de luz que pierde por s un barco fuera del haz. */
  fade: number;
  flash: { halfWidth: number; perWave: number; max: number };
  kinds: Record<FaroKind, FaroKindRule>;
  wave: {
    /** Barcos de la primera oleada y cuántos más en cada una. */
    ships: number;
    more: number;
    /** Altura de escena por s en la primera oleada, y cuánto sube por oleada. */
    speed: number;
    speedUp: number;
    /** s entre barcos, cuánto baja por oleada y su mínimo. */
    intervalS: number;
    intervalDown: number;
    intervalMin: number;
    /** s de respiro entre oleadas. */
    breakS: number;
  };
  /** La racha: cada `every` descubiertos seguidos, +1 al multiplicador, hasta `max`. */
  combo: { every: number; max: number };
}

export const FARO_DEFAULTS: FaroConfig = {
  version: 2,
  goal: 600,
  timeLimitS: 600,
  lives: 3,
  waves: 10,
  beamHalfWidth: 0.1,
  turnSpeed: 1.8,
  followSpeed: 4.5,
  beamMin: -1.35,
  beamMax: 1.35,
  fade: 0.8,
  flash: { halfWidth: 0.5, perWave: 1, max: 2 },
  kinds: {
    sloop: { spotS: 0.3, points: 10, speed: 1.35 },
    brig: { spotS: 0.5, points: 15, speed: 1 },
    galleon: { spotS: 0.9, points: 25, speed: 0.7 },
  },
  wave: {
    ships: 4,
    more: 2,
    speed: 0.055,
    speedUp: 0.15,
    intervalS: 2.4,
    intervalDown: 0.15,
    intervalMin: 0.9,
    breakS: 2.5,
  },
  combo: { every: 4, max: 4 },
  reward: { policy: 'daily', points: 15, coins: 5, maxPoints: 30, maxCoins: 10 },
};

/** Faro: la lámpara, en coordenadas lógicas de la escena. */
export const LAMP: Point = { x: 0.5, y: 0.86 };
export const HORIZON = 0.14;
/** Un barco que llega a esta altura ha tocado costa. */
export const COAST_Y = 0.76;

export interface FaroShipPlan {
  kind: FaroKind;
  /** s desde el principio de la oleada. */
  delay: number;
  /** x de salida en el horizonte y x de la costa adonde va. */
  x0: number;
  tx: number;
}

export type FaroShipState = 'waiting' | 'sailing' | 'retreating' | 'landed' | 'gone';

export interface FaroShip {
  id: number;
  wave: number;
  kind: FaroKind;
  spawnAt: number;
  x0: number;
  tx: number;
  x: number;
  y: number;
  /** Velocidad vertical (altura de escena por s). */
  speed: number;
  /** Luz acumulada, 0..1: a 1 queda descubierto. */
  light: number;
  state: FaroShipState;
}

interface Mark {
  kind: 'hit' | 'escape';
  x: number;
  y: number;
  text: string;
  age: number;
}

/** Ritmo de la oleada `n` (desde 1): más rápida y más apretada cada vez. */
export function faroWave(
  c: FaroConfig,
  n: number,
): { speed: number; intervalS: number; ships: number } {
  const w = c.wave;
  return {
    speed: w.speed * (1 + w.speedUp * (n - 1)),
    intervalS: Math.max(w.intervalMin, w.intervalS - w.intervalDown * (n - 1)),
    ships: w.ships + w.more * (n - 1),
  };
}

/** Las oleadas de una semilla: siempre las mismas. */
export function faroPlan(seed: number, c: FaroConfig): FaroShipPlan[][] {
  const r = rng(seed);
  const plan: FaroShipPlan[][] = [];
  for (let n = 1; n <= c.waves; n++) {
    const w = faroWave(c, n);
    const ships: FaroShipPlan[] = [];
    let t = n === 1 ? 0.8 : 0.4;
    for (let i = 0; i < w.ships; i++) {
      const roll = r();
      const galleon = n >= 3 ? 0.2 : 0;
      const sloop = Math.min(0.5, 0.15 + 0.05 * n);
      const kind: FaroKind = roll < galleon ? 'galleon' : roll < galleon + sloop ? 'sloop' : 'brig';
      ships.push({ kind, delay: t, x0: between(r, 0.06, 0.94), tx: between(r, 0.08, 0.92) });
      t += w.intervalS * between(r, 0.75, 1.25);
    }
    plan.push(ships);
  }
  return plan;
}

/** Multiplicador de la racha tras `streak` descubiertos seguidos. */
export function faroMultiplier(c: FaroConfig, streak: number): number {
  return Math.min(c.combo.max, 1 + Math.floor(streak / c.combo.every));
}

const angleTo = (x: number, y: number) => Math.atan2(x - LAMP.x, LAMP.y - y);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export class FaroSim implements MinigameSim {
  time = 0;
  score = 0;
  lives: number;
  /** Oleada en curso (desde 1). */
  wave = 1;
  /** Descubiertos seguidos sin perder una vida. */
  streak = 0;
  flashes: number;
  ended: Ending | null = null;
  beam = 0;
  readonly ships: FaroShip[] = [];
  readonly plan: FaroShipPlan[][];
  /** s de respiro antes de la oleada siguiente; null en plena oleada. */
  breakLeft: number | null = null;
  /** s desde el último destello (para dibujarlo). */
  flashAge = Infinity;
  private nextId = 0;
  private marks: Mark[] = [];

  constructor(
    seed: number,
    readonly config: FaroConfig,
  ) {
    this.plan = faroPlan(seed, config);
    this.lives = config.lives;
    this.flashes = Math.min(config.flash.max, config.flash.perWave);
    this.launchWave(0);
  }

  get multiplier(): number {
    return faroMultiplier(this.config, this.streak);
  }

  private launchWave(at: number) {
    const w = faroWave(this.config, this.wave);
    for (const p of this.plan[this.wave - 1] ?? []) {
      this.ships.push({
        id: this.nextId++,
        wave: this.wave,
        kind: p.kind,
        spawnAt: at + p.delay,
        x0: p.x0,
        tx: p.tx,
        x: p.x0,
        y: HORIZON,
        speed: w.speed * this.config.kinds[p.kind].speed,
        light: 0,
        state: 'waiting',
      });
    }
  }

  aim(): Point {
    return { x: LAMP.x + Math.sin(this.beam) * 0.5, y: LAMP.y - Math.cos(this.beam) * 0.5 };
  }

  /** ¿Cae el barco dentro de un cono de semiancho `half` alrededor del haz? */
  inCone(s: FaroShip, half: number): boolean {
    if (s.state !== 'sailing') return false;
    const dist = Math.max(0.05, Math.hypot(s.x - LAMP.x, LAMP.y - s.y));
    return Math.abs(angleTo(s.x, s.y) - this.beam) <= half + 0.03 / dist;
  }

  /** ¿Ilumina el haz este barco? */
  isLit(s: FaroShip): boolean {
    return this.inCone(s, this.config.beamHalfWidth);
  }

  /** Descubre un barco: media vuelta, puntos con el multiplicador de la racha. */
  private spot(s: FaroShip, out: SimEvent[]) {
    const mult = this.multiplier;
    const points = this.config.kinds[s.kind].points * mult;
    this.score += points;
    this.streak++;
    s.light = 1;
    s.state = 'retreating';
    const ev: SimEvent = { kind: 'hit', x: s.x, y: s.y, points, combo: mult };
    out.push(ev);
    this.marks.push({ kind: 'hit', x: s.x, y: s.y, text: `+${points}`, age: 0 });
  }

  step(dt: number, input: MinigameInput): SimEvent[] {
    if (this.ended) return [];
    const c = this.config;
    const out: SimEvent[] = [];
    this.time += dt;
    this.flashAge += dt;
    for (const m of this.marks) m.age += dt;
    this.marks = this.marks.filter((m) => m.age < 1.2);

    // Haz: el teclado lo gira; el dedo o el puntero lo llevan hacia sí.
    if (input.turn) this.beam += clamp(input.turn, -1, 1) * c.turnSpeed * dt;
    if (input.aim) {
      const want =
        input.aim.y >= LAMP.y
          ? Math.sign(input.aim.x - LAMP.x) * c.beamMax
          : angleTo(input.aim.x, input.aim.y);
      const d = want - this.beam;
      const max = c.followSpeed * dt;
      this.beam += clamp(d, -max, max);
    }
    this.beam = clamp(this.beam, c.beamMin, c.beamMax);

    for (const s of this.ships) {
      if (s.state === 'waiting' && this.time >= s.spawnAt) s.state = 'sailing';
      if (s.state === 'sailing') {
        s.y += s.speed * dt;
        const k = clamp((s.y - HORIZON) / (COAST_Y - HORIZON), 0, 1);
        s.x = s.x0 + (s.tx - s.x0) * k;
        if (s.y >= COAST_Y) {
          s.state = 'landed';
          this.lives = Math.max(0, this.lives - 1);
          this.streak = 0;
          const ev: SimEvent = { kind: 'escape', x: s.x, y: COAST_Y };
          out.push(ev);
          this.marks.push({ kind: 'escape', x: s.x, y: COAST_Y - 0.03, text: '−1', age: 0 });
          continue;
        }
        if (this.isLit(s)) {
          s.light += dt / c.kinds[s.kind].spotS;
          if (s.light >= 1) this.spot(s, out);
        } else {
          s.light = Math.max(0, s.light - c.fade * dt);
        }
      } else if (s.state === 'retreating') {
        s.y -= s.speed * 1.6 * dt;
        if (s.y < HORIZON - 0.06) s.state = 'gone';
      }
    }

    // DESTELLO: descubre a todos los del cono ancho. Uno por oleada.
    if (input.action) {
      if (this.flashes > 0) {
        this.flashes--;
        this.flashAge = 0;
        out.push({ kind: 'flash' });
        for (const s of this.ships) if (this.inCone(s, c.flash.halfWidth)) this.spot(s, out);
      } else {
        out.push({ kind: 'false_alarm' });
      }
    }

    this.advanceWaves(dt, out);
    this.ended = this.checkEnd();
    if (this.ended) out.push({ kind: 'end' });
    return out;
  }

  private advanceWaves(dt: number, out: SimEvent[]) {
    const c = this.config;
    if (this.breakLeft === null) {
      const live = this.ships.some(
        (s) => s.wave === this.wave && (s.state === 'waiting' || s.state === 'sailing'),
      );
      if (!live && this.wave < c.waves) this.breakLeft = c.wave.breakS;
      return;
    }
    this.breakLeft -= dt;
    if (this.breakLeft > 0) return;
    this.breakLeft = null;
    this.wave++;
    this.flashes = Math.min(c.flash.max, this.flashes + c.flash.perWave);
    this.launchWave(this.time);
    out.push({ kind: 'wave', wave: this.wave });
  }

  private checkEnd(): Ending | null {
    const c = this.config;
    let reason: EndReason | null = null;
    if (this.lives <= 0) reason = 'lives';
    else if (this.time >= c.timeLimitS) reason = 'time';
    else if (
      this.wave >= c.waves &&
      this.breakLeft === null &&
      this.ships.every((s) => s.state !== 'waiting' && s.state !== 'sailing')
    ) {
      reason = 'waves';
    }
    if (!reason) return null;
    return { outcome: this.score >= c.goal ? 'won' : 'lost', reason };
  }

  status(): StatusItem[] {
    const c = this.config;
    return [
      { label: 'Puntos', value: String(this.score) },
      { label: 'Vidas', value: `${this.lives}/${c.lives}` },
      { label: 'Oleada', value: `${this.wave}/${c.waves}` },
      { label: 'Racha', value: `x${this.multiplier}` },
      { label: 'Destellos', value: String(this.flashes) },
    ];
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, skin: MinigameSkin, o: DrawOptions) {
    drawFaro(this, ctx, w, h, skin, o);
  }

  get drawMarks(): readonly Mark[] {
    return this.marks;
  }
}

/**
 * El tiempo mínimo para llegar a `score` con esta semilla: ningún barco se
 * descubre antes de salir, cada uno da como mucho sus puntos por el
 * multiplicador máximo, y una oleada no empieza antes de que salga el último
 * barco de la anterior y pase el respiro.
 */
export function faroMinPlausibleMs(score: number, seed: number, c: FaroConfig): number {
  if (score <= 0) return 0;
  const spawns: { t: number; max: number }[] = [];
  let start = 0;
  for (const wave of faroPlan(seed, c)) {
    for (const p of wave)
      spawns.push({ t: start + p.delay, max: c.kinds[p.kind].points * c.combo.max });
    start += Math.max(0, ...wave.map((p) => p.delay)) + c.wave.breakS;
  }
  spawns.sort((a, b) => a.t - b.t);
  let sum = 0;
  for (const s of spawns) {
    sum += s.max;
    if (sum >= score) return s.t * 1000;
  }
  return Infinity;
}

export const faro: MinigameDefinition<FaroConfig> = {
  id: 'faro',
  title: 'Vigilancia del faro',
  summary:
    'Es de noche y los piratas vienen a oscuras hacia la costa. Bárrelos con el haz del faro: un pirata iluminado da media vuelta.',
  instructions: [
    'Mueve el haz con el dedo, el ratón o las flechas.',
    'Deja la luz sobre un barco hasta que se llene su círculo: descubierto, se va.',
    'Si un pirata toca costa, pierdes una de tus tres vidas. Descubrir varios seguidos multiplica los puntos.',
    'DESTELLO (o Espacio): ilumina de golpe un cono ancho. Uno por oleada.',
  ],
  actionLabel: 'DESTELLO',
  hint: '← → haz · Espacio destello · Esc pausa',
  defaults: FARO_DEFAULTS,
  create: (seed, config) => new FaroSim(seed, config),
  minPlausibleMs: faroMinPlausibleMs,
  endText(e) {
    if (e.reason === 'waves') return '¡Amanece! Has guardado la costa toda la noche.';
    if (e.reason === 'time') return 'Se acabó la guardia de esta noche.';
    return 'Tres piratas han tocado costa: se acabó la guardia.';
  },
  feedback(ev) {
    switch (ev.kind) {
      case 'hit':
        return {
          text:
            ev.combo && ev.combo > 1
              ? `¡Descubierto! +${ev.points} (x${ev.combo})`
              : `¡Descubierto! +${ev.points}`,
          tone: 'good',
        };
      case 'escape':
        return { text: 'Un pirata ha tocado costa: −1 vida.', tone: 'bad' };
      case 'wave':
        return { text: `Oleada ${ev.wave}: vienen más rápido.`, tone: 'good' };
      case 'false_alarm':
        return { text: 'Sin destellos: llega otro con la próxima oleada.', tone: 'bad' };
      default:
        return null;
    }
  },
};

// --- Dibujo ------------------------------------------------------------------

const STARS: readonly [number, number][] = [
  [0.06, 0.03],
  [0.18, 0.08],
  [0.29, 0.02],
  [0.41, 0.06],
  [0.55, 0.03],
  [0.66, 0.09],
  [0.78, 0.04],
  [0.9, 0.08],
  [0.97, 0.02],
];

function drawFaro(
  sim: FaroSim,
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  skin: MinigameSkin,
  o: DrawOptions,
) {
  const u = Math.min(w, h);
  const X = (x: number) => x * w;
  const Y = (y: number) => y * h;
  const c = sim.config;

  // Cielo y mar de noche.
  ctx.fillStyle = skin.night;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = skin.sea;
  ctx.fillRect(0, Y(HORIZON), w, h - Y(HORIZON));
  ctx.restore();
  ctx.fillStyle = skin.crest;
  for (const [sx, sy] of STARS) ctx.fillRect(X(sx), Y(sy), 2, 2);
  // Luna.
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = skin.beam;
  ctx.beginPath();
  ctx.arc(X(0.86), Y(0.06), u * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin.night;
  ctx.beginPath();
  ctx.arc(X(0.86) + u * 0.012, Y(0.06) - u * 0.006, u * 0.026, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Olas en perspectiva: más juntas al fondo.
  ctx.save();
  ctx.strokeStyle = skin.wave;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = Math.max(1, u * 0.003);
  const drift = o.reducedMotion ? 0 : (o.clock * 0.02) % 0.2;
  for (let row = 0; row < 8; row++) {
    const k = row / 7;
    const y = HORIZON + 0.03 + (COAST_Y - HORIZON) * k * k;
    const len = 0.03 + 0.04 * k;
    for (let col = -1; col < 7; col++) {
      const x = col * 0.17 + (row % 2) * 0.085 + drift * (row % 2 ? 1 : -1);
      ctx.beginPath();
      ctx.moveTo(X(x), Y(y));
      ctx.lineTo(X(x + len), Y(y));
      ctx.stroke();
    }
  }
  ctx.restore();

  // Haz: luz atenuada, sin destellos rápidos.
  const R = 1.7;
  const cone = (half: number, alpha: number) => {
    const a0 = sim.beam - half;
    const a1 = sim.beam + half;
    ctx.save();
    const g = ctx.createRadialGradient(X(LAMP.x), Y(LAMP.y), 0, X(LAMP.x), Y(LAMP.y), u * 1.2);
    g.addColorStop(0, skin.beam);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(X(LAMP.x), Y(LAMP.y));
    ctx.lineTo(X(LAMP.x + Math.sin(a0) * R), Y(LAMP.y - Math.cos(a0) * R));
    ctx.lineTo(X(LAMP.x + Math.sin(a1) * R), Y(LAMP.y - Math.cos(a1) * R));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  cone(c.beamHalfWidth, 0.34);
  if (sim.flashAge < 0.6) {
    // El destello se abre y se apaga despacio (sin parpadeos).
    cone(c.flash.halfWidth, 0.3 * (1 - sim.flashAge / 0.6));
  }

  // Barcos: los de más lejos (arriba), primero.
  const ships = sim.ships
    .filter((s) => s.state === 'sailing' || s.state === 'retreating')
    .sort((a, b) => a.y - b.y);
  for (const s of ships) drawShip(ctx, skin, u, X(s.x), Y(s.y), s, sim.isLit(s));

  // Costa con el faro.
  wash(ctx, skin, skin.land, () => {
    ctx.moveTo(0, h);
    ctx.lineTo(0, Y(COAST_Y + 0.04));
    for (let i = 0; i <= 12; i++) {
      ctx.lineTo(X(i / 12), Y(COAST_Y + 0.025 + ((i * 7) % 3) * 0.012));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
  });
  outline(ctx, skin, u);
  const top = LAMP.y + 0.02;
  wash(ctx, skin, skin.crest, () => {
    ctx.moveTo(X(0.47), h);
    ctx.lineTo(X(0.482), Y(top));
    ctx.lineTo(X(0.518), Y(top));
    ctx.lineTo(X(0.53), h);
    ctx.closePath();
  });
  outline(ctx, skin, u);
  ctx.fillStyle = skin.accent;
  for (let i = 0; i < 2; i++) {
    ctx.fillRect(X(0.475 + i * 0.003), Y(top + 0.035 + i * 0.045), X(0.05 - i * 0.006), Y(0.016));
  }
  ctx.fillStyle = skin.beam;
  ctx.beginPath();
  ctx.arc(X(LAMP.x), Y(LAMP.y), u * 0.022, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, skin, u);

  // Vidas sobre la costa: faroles.
  for (let i = 0; i < c.lives; i++) {
    ctx.save();
    ctx.globalAlpha = i < sim.lives ? 1 : 0.25;
    ctx.fillStyle = i < sim.lives ? skin.beam : skin.ink;
    ctx.beginPath();
    ctx.arc(X(0.06 + i * 0.05), Y(0.93), u * 0.016, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Marcas: puntos ganados y vidas perdidas, sin destellos.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(u * 0.05)}px system-ui, sans-serif`;
  for (const m of sim.drawMarks) {
    ctx.globalAlpha = Math.max(0, 1 - m.age / 1.2);
    ctx.fillStyle = m.kind === 'hit' ? skin.good : skin.bad;
    const rise = o.reducedMotion ? 0 : m.age * 0.05;
    ctx.fillText(m.text, X(m.x), Y(m.y - 0.05 - rise));
  }
  ctx.restore();

  // Cartel de oleada durante el respiro.
  if (sim.breakLeft !== null && !sim.ended) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = skin.crest;
    ctx.font = `800 ${Math.round(u * 0.07)}px system-ui, sans-serif`;
    ctx.fillText(`Oleada ${sim.wave + 1}`, X(0.5), Y(0.36));
    ctx.restore();
  }
}

function drawShip(
  ctx: CanvasRenderingContext2D,
  skin: MinigameSkin,
  u: number,
  x: number,
  y: number,
  s: FaroShip,
  lit: boolean,
) {
  // Más lejos (arriba), más pequeño; el galeón, más grande.
  const depth = 0.45 + ((s.y - HORIZON) / (COAST_Y - HORIZON)) * 0.75;
  const size = s.kind === 'galleon' ? 1.35 : s.kind === 'sloop' ? 0.8 : 1;
  const k = u * 0.065 * depth * size;
  const shown = lit || s.state === 'retreating';
  ctx.save();
  ctx.translate(x, y);
  // Casco en silueta; iluminado, se aclara.
  wash(ctx, skin, shown ? '#5d4a3a' : '#222c3a', () => {
    ctx.moveTo(-k, -k * 0.1);
    ctx.lineTo(k, -k * 0.1);
    ctx.lineTo(k * 0.7, k * 0.35);
    ctx.lineTo(-k * 0.7, k * 0.35);
    ctx.closePath();
  });
  if (shown) outline(ctx, skin, u);
  // Velas.
  const masts = s.kind === 'galleon' ? [-0.45, 0.35] : [0];
  for (const m of masts) {
    wash(ctx, skin, shown ? '#e9e1cf' : '#2a3444', () => {
      ctx.moveTo(k * m, -k * 0.15);
      ctx.lineTo(k * m, -k * 1.3);
      ctx.lineTo(k * (m + 0.55), -k * 0.3);
      ctx.closePath();
    });
    if (shown) outline(ctx, skin, u);
  }
  // Bandera pirata sólo cuando se ve: negra con calavera (patrón, no sólo color).
  if (shown) {
    const fw = k * 0.5;
    const fh = k * 0.32;
    const fx = k * (masts[0] ?? 0) - fw;
    const fy = -k * 1.32;
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(fx, fy, fw, fh);
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath();
    ctx.arc(fx + fw / 2, fy + fh * 0.45, fh * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  // Círculo de luz acumulada: cuánto falta para descubrirlo.
  if (s.state === 'sailing' && s.light > 0) {
    ctx.strokeStyle = skin.beam;
    ctx.lineWidth = Math.max(2, u * 0.006);
    ctx.beginPath();
    ctx.arc(0, -k * 0.5, k * 1.25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, s.light));
    ctx.stroke();
  }
  ctx.restore();
}
