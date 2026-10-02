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
 * Cañón contra tiburones (REQ-AVE-037, T60). Vista de lado: el cañón está
 * en lo alto de la torre, a la izquierda; por la derecha llegan tiburones y
 * barcos piratas rumbo a la playa. Se apunta arrastrando (la dirección es el
 * ángulo; la longitud, la potencia) y al soltar sale una bola de agua que
 * vuela en parábola. La salpicadura asusta a los tiburones que están en
 * superficie (los sumergidos no se enteran) y dos impactos hacen que un
 * pirata se retire. Nunca hay heridas: sólo sustos y mojaduras.
 *
 * Oleadas cada vez más rápidas; disparos seguidos que aciertan suben el
 * multiplicador (combo); tres vidas: cada intruso que llega a la playa se
 * lleva una. Se gana el premio con `goal` puntos o más. Todo `muestra`.
 */

export type CanonFoeKind = 'shark' | 'pirate';

export interface CanonConfig extends BaseConfig {
  lives: number;
  waves: number;
  /** Gravedad (alto de escena por s²) y velocidad de salida a toda potencia. */
  gravity: number;
  maxSpeed: number;
  /** Ángulo de tiro (rad sobre la horizontal) y potencia mínima. */
  angleMin: number;
  angleMax: number;
  powerMin: number;
  /** Arrastre (unidades de escena) que da toda la potencia. */
  dragFull: number;
  /** Teclado: rad/s del ángulo y potencia/s. */
  aimSpeed: { angle: number; power: number };
  reloadS: number;
  /** Radio de la salpicadura (lógico): generoso, no exige precisión de un píxel. */
  splashRadius: number;
  /** Parte del vuelo que dibuja la ayuda de trayectoria (0..1). */
  preview: number;
  shark: {
    radius: number;
    points: number;
    speed: number;
    diveEveryS: readonly [number, number];
    diveForS: readonly [number, number];
  };
  pirate: {
    halfWidth: number;
    height: number;
    hp: number;
    hitPoints: number;
    points: number;
    speed: number;
  };
  wave: {
    foes: number;
    more: number;
    speedUp: number;
    intervalS: number;
    intervalDown: number;
    intervalMin: number;
    breakS: number;
  };
  /** Multiplicador máximo del combo. */
  combo: { max: number };
}

/**
 * Versión 3 (decisión 2026-10-02, T72): 3 oleadas con intrusos más rápidos;
 * terminarla (llegar a `goal`) da 150 puntos y 50 monedas. Se rediseñará más
 * adelante. muestra
 */
export const CANON_DEFAULTS: CanonConfig = {
  version: 3,
  goal: 200,
  timeLimitS: 300,
  lives: 3,
  waves: 3,
  gravity: 2.2,
  maxSpeed: 1.45,
  angleMin: 0.08,
  angleMax: 1.45,
  powerMin: 0.15,
  dragFull: 0.45,
  aimSpeed: { angle: 0.9, power: 0.6 },
  reloadS: 0.55,
  splashRadius: 0.05,
  preview: 0.45,
  shark: { radius: 0.028, points: 10, speed: 0.075, diveEveryS: [3, 6], diveForS: [0.8, 1.5] },
  pirate: { halfWidth: 0.05, height: 0.12, hp: 2, hitPoints: 5, points: 25, speed: 0.05 },
  wave: {
    foes: 3,
    more: 2,
    speedUp: 0.2,
    intervalS: 2.6,
    intervalDown: 0.15,
    intervalMin: 1,
    breakS: 2.5,
  },
  combo: { max: 4 },
  reward: { policy: 'season', points: 150, coins: 50, maxPoints: 150, maxCoins: 50 },
};

/** Boca del cañón, en lo alto de la torre. */
export const MUZZLE: Point = { x: 0.12, y: 0.56 };
/** Línea del agua: ahí caen las bolas y nadan los intrusos. */
export const WATER_Y = 0.74;
/** La playa: un intruso que llega aquí se lleva una vida. */
export const COAST_X = 0.2;
const SPAWN_X = 1.06;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// --- Tiro parabólico ---------------------------------------------------------

export interface Shot {
  vx: number;
  /** Positiva hacia abajo, como la y de la escena. */
  vy: number;
  /** s hasta tocar el agua y x donde cae. */
  tLand: number;
  landX: number;
}

/** El tiro con este ángulo y esta potencia: velocidad, tiempo de vuelo y punto de caída. */
export function canonShot(angle: number, power: number, c: CanonConfig): Shot {
  const v = power * c.maxSpeed;
  const vx = v * Math.cos(angle);
  const up = v * Math.sin(angle);
  const h = WATER_Y - MUZZLE.y;
  const tLand = (up + Math.sqrt(up * up + 2 * c.gravity * h)) / c.gravity;
  return { vx, vy: -up, tLand, landX: MUZZLE.x + vx * tLand };
}

/** Dónde está la bola `t` s después de salir (parábola exacta). */
export function ballAt(shot: Shot, t: number, c: CanonConfig): Point {
  return { x: MUZZLE.x + shot.vx * t, y: MUZZLE.y + shot.vy * t + 0.5 * c.gravity * t * t };
}

/**
 * La potencia que hace caer la bola en `targetX` con este ángulo, o null si
 * no se llega (o sobra) con la potencia del cañón.
 */
export function powerFor(angle: number, targetX: number, c: CanonConfig): number | null {
  const d = targetX - MUZZLE.x;
  const h = WATER_Y - MUZZLE.y;
  const cos = Math.cos(angle);
  const den = 2 * cos * cos * (h + d * Math.tan(angle));
  if (d <= 0 || den <= 0) return null;
  const power = Math.sqrt((c.gravity * d * d) / den) / c.maxSpeed;
  return power >= c.powerMin && power <= 1 ? power : null;
}

/** Ángulo y potencia de un arrastre (dirección y longitud, en unidades de escena). */
export function aimFromPull(pull: Point, c: CanonConfig): { angle: number; power: number } {
  const len = Math.hypot(pull.x, pull.y);
  return {
    angle: clamp(Math.atan2(-pull.y, pull.x), c.angleMin, c.angleMax),
    power: clamp(len / c.dragFull, c.powerMin, 1),
  };
}

/** El arrastre que da este ángulo y esta potencia (para las pruebas y los bots). */
export function pullFor(angle: number, power: number, c: CanonConfig): Point {
  const len = power * c.dragFull;
  return { x: Math.cos(angle) * len, y: -Math.sin(angle) * len };
}

// --- Oleadas -----------------------------------------------------------------

export interface CanonFoePlan {
  kind: CanonFoeKind;
  delay: number;
}

export interface CanonFoe {
  id: number;
  wave: number;
  kind: CanonFoeKind;
  spawnAt: number;
  x: number;
  speed: number;
  hp: number;
  submerged: boolean;
  diveTimer: number;
  state: 'waiting' | 'swimming' | 'fleeing' | 'landed' | 'gone';
}

interface Ball {
  shot: Shot;
  age: number;
  hits: number;
}

interface Mark {
  kind: 'hit' | 'miss' | 'escape';
  x: number;
  y: number;
  text: string;
  age: number;
}

/** Ritmo de la oleada `n` (desde 1): más rápida y más apretada cada vez. */
export function canonWave(
  c: CanonConfig,
  n: number,
): { speed: number; intervalS: number; foes: number } {
  const w = c.wave;
  return {
    speed: 1 + w.speedUp * (n - 1),
    intervalS: Math.max(w.intervalMin, w.intervalS - w.intervalDown * (n - 1)),
    foes: w.foes + w.more * (n - 1),
  };
}

/** Las oleadas de una semilla: siempre las mismas. Piratas desde la segunda. */
export function canonPlan(seed: number, c: CanonConfig): CanonFoePlan[][] {
  const r = rng(seed);
  const plan: CanonFoePlan[][] = [];
  for (let n = 1; n <= c.waves; n++) {
    const w = canonWave(c, n);
    const foes: CanonFoePlan[] = [];
    let t = n === 1 ? 0.8 : 0.4;
    for (let i = 0; i < w.foes; i++) {
      const kind: CanonFoeKind = n >= 2 && r() < Math.min(0.35, 0.1 * n) ? 'pirate' : 'shark';
      foes.push({ kind, delay: t });
      t += w.intervalS * between(r, 0.75, 1.25);
    }
    plan.push(foes);
  }
  return plan;
}

/** Multiplicador tras `combo` disparos seguidos que acertaron. */
export function canonMultiplier(c: CanonConfig, combo: number): number {
  return Math.min(c.combo.max, 1 + combo);
}

export class CanonSim implements MinigameSim {
  time = 0;
  score = 0;
  lives: number;
  wave = 1;
  /** Disparos seguidos que han acertado. */
  combo = 0;
  angle = 0.75;
  power = 0.55;
  ended: Ending | null = null;
  readonly foes: CanonFoe[] = [];
  readonly balls: Ball[] = [];
  readonly plan: CanonFoePlan[][];
  breakLeft: number | null = null;
  /** s que faltan para poder disparar otra vez. */
  reload = 0;
  private nextId = 0;
  private marks: Mark[] = [];
  /** Azar del juego en marcha (inmersiones); el de las oleadas va aparte. */
  private readonly r: () => number;

  constructor(
    seed: number,
    readonly config: CanonConfig,
  ) {
    this.plan = canonPlan(seed, config);
    this.r = rng(seed ^ 0x5bd1e995);
    this.lives = config.lives;
    this.launchWave(0);
  }

  get multiplier(): number {
    return canonMultiplier(this.config, this.combo);
  }

  /** El tiro tal como está apuntado ahora. */
  shot(): Shot {
    return canonShot(this.angle, this.power, this.config);
  }

  aim(): Point {
    return { x: this.shot().landX, y: WATER_Y };
  }

  private launchWave(at: number) {
    const c = this.config;
    const w = canonWave(c, this.wave);
    for (const p of this.plan[this.wave - 1] ?? []) {
      const base = p.kind === 'shark' ? c.shark.speed : c.pirate.speed;
      this.foes.push({
        id: this.nextId++,
        wave: this.wave,
        kind: p.kind,
        spawnAt: at + p.delay,
        x: SPAWN_X,
        speed: base * w.speed,
        hp: p.kind === 'pirate' ? c.pirate.hp : 1,
        submerged: false,
        diveTimer: between(this.r, c.shark.diveEveryS[0], c.shark.diveEveryS[1]),
        state: 'waiting',
      });
    }
  }

  /** Medio ancho de un intruso, para la salpicadura. */
  private reach(f: CanonFoe): number {
    return f.kind === 'pirate' ? this.config.pirate.halfWidth : this.config.shark.radius;
  }

  private hitFoe(f: CanonFoe, ball: Ball, mult: number, out: SimEvent[]) {
    const c = this.config;
    let points: number;
    if (f.kind === 'shark') {
      // Se asusta y se va mar adentro. Sin heridas.
      f.state = 'fleeing';
      f.submerged = false;
      points = c.shark.points * mult;
    } else {
      f.hp--;
      if (f.hp <= 0) {
        f.state = 'fleeing';
        points = c.pirate.points * mult;
      } else {
        // Tocado: retrocede un poco.
        f.x = Math.min(SPAWN_X, f.x + 0.04);
        points = c.pirate.hitPoints * mult;
      }
    }
    ball.hits++;
    this.score += points;
    out.push({
      kind: f.kind === 'shark' ? 'scare' : 'hit',
      x: f.x,
      y: WATER_Y,
      points,
      combo: mult,
    });
    this.marks.push({ kind: 'hit', x: f.x, y: WATER_Y - 0.08, text: `+${points}`, age: 0 });
  }

  /** La bola ha caído (o ha dado en un barco): cuenta para el combo. */
  private resolve(ball: Ball, at: Point, out: SimEvent[]) {
    out.push({ kind: 'splash', x: at.x, y: at.y });
    if (ball.hits > 0) {
      this.combo++;
    } else {
      this.combo = 0;
      out.push({ kind: 'miss', x: at.x, y: WATER_Y });
      this.marks.push({ kind: 'miss', x: at.x, y: WATER_Y - 0.05, text: '', age: 0 });
    }
  }

  step(dt: number, input: MinigameInput): SimEvent[] {
    if (this.ended) return [];
    const c = this.config;
    const out: SimEvent[] = [];
    this.time += dt;
    this.reload = Math.max(0, this.reload - dt);
    for (const m of this.marks) m.age += dt;
    this.marks = this.marks.filter((m) => m.age < 1.2);

    // Puntería: el arrastre manda; el teclado ajusta ángulo (↑↓) y potencia (←→).
    if (input.pull && Math.hypot(input.pull.x, input.pull.y) >= 0.02) {
      const a = aimFromPull(input.pull, c);
      this.angle = a.angle;
      this.power = a.power;
    }
    if (input.lift) this.angle += clamp(input.lift, -1, 1) * c.aimSpeed.angle * dt;
    if (input.turn) this.power += clamp(input.turn, -1, 1) * c.aimSpeed.power * dt;
    this.angle = clamp(this.angle, c.angleMin, c.angleMax);
    this.power = clamp(this.power, c.powerMin, 1);

    // Intrusos.
    for (const f of this.foes) this.advanceFoe(f, dt, out);

    if (input.action && this.reload === 0) {
      this.reload = c.reloadS;
      const shot = this.shot();
      this.balls.push({ shot, age: 0, hits: 0 });
      out.push({ kind: 'fire', x: shot.landX, y: WATER_Y });
    }

    // Bolas: dan en un barco por el camino o caen al agua y salpican.
    for (const b of [...this.balls]) {
      b.age = Math.min(b.age + dt, b.shot.tLand);
      const p = ballAt(b.shot, b.age, c);
      const ship = this.foes.find(
        (f) =>
          f.kind === 'pirate' &&
          f.state === 'swimming' &&
          p.y >= WATER_Y - c.pirate.height &&
          Math.abs(p.x - f.x) <= c.pirate.halfWidth,
      );
      const landed = b.age >= b.shot.tLand;
      if (!ship && !landed) continue;
      this.balls.splice(this.balls.indexOf(b), 1);
      const mult = this.multiplier;
      if (ship) {
        this.hitFoe(ship, b, mult, out);
      } else {
        for (const f of this.foes) {
          if (f.state !== 'swimming' || f.submerged) continue;
          if (Math.abs(f.x - p.x) <= c.splashRadius + this.reach(f)) this.hitFoe(f, b, mult, out);
        }
      }
      this.resolve(b, p, out);
    }

    this.advanceWaves(dt, out);
    this.ended = this.checkEnd();
    if (this.ended) out.push({ kind: 'end' });
    return out;
  }

  private advanceFoe(f: CanonFoe, dt: number, out: SimEvent[]) {
    const c = this.config;
    if (f.state === 'waiting') {
      if (this.time < f.spawnAt) return;
      f.state = 'swimming';
    }
    if (f.state === 'fleeing') {
      f.x += Math.max(0.2, f.speed * 4) * dt;
      if (f.x > SPAWN_X + 0.04) f.state = 'gone';
      return;
    }
    if (f.state !== 'swimming') return;
    if (f.kind === 'shark') {
      f.diveTimer -= dt;
      if (f.diveTimer <= 0) {
        f.submerged = !f.submerged;
        const [a, b] = f.submerged ? c.shark.diveForS : c.shark.diveEveryS;
        f.diveTimer = between(this.r, a, b);
      }
    }
    f.x -= f.speed * dt;
    if (f.x <= COAST_X) {
      f.state = 'landed';
      this.lives = Math.max(0, this.lives - 1);
      this.combo = 0;
      out.push({ kind: 'escape', x: COAST_X, y: WATER_Y });
      this.marks.push({ kind: 'escape', x: COAST_X + 0.04, y: WATER_Y - 0.1, text: '−1', age: 0 });
    }
  }

  private advanceWaves(dt: number, out: SimEvent[]) {
    const c = this.config;
    if (this.breakLeft === null) {
      const live = this.foes.some(
        (f) => f.wave === this.wave && (f.state === 'waiting' || f.state === 'swimming'),
      );
      if (!live && this.wave < c.waves) this.breakLeft = c.wave.breakS;
      return;
    }
    this.breakLeft -= dt;
    if (this.breakLeft > 0) return;
    this.breakLeft = null;
    this.wave++;
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
      this.balls.length === 0 &&
      this.foes.every((f) => f.state !== 'waiting' && f.state !== 'swimming')
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
      { label: 'Combo', value: `x${this.multiplier}` },
    ];
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, skin: MinigameSkin, o: DrawOptions) {
    drawCanon(this, ctx, w, h, skin, o);
  }

  get drawMarks(): readonly Mark[] {
    return this.marks;
  }
}

/**
 * El tiempo mínimo para llegar a `score` con esta semilla: ningún intruso
 * puntúa antes de salir, cada uno da como mucho todos sus puntos por el
 * multiplicador máximo, y una oleada no empieza antes de que salga el último
 * de la anterior y pase el respiro.
 */
export function canonMinPlausibleMs(score: number, seed: number, c: CanonConfig): number {
  if (score <= 0) return 0;
  const most = (k: CanonFoeKind) =>
    (k === 'shark'
      ? c.shark.points
      : c.pirate.points + c.pirate.hitPoints * Math.max(0, c.pirate.hp - 1)) * c.combo.max;
  const spawns: { t: number; max: number }[] = [];
  let start = 0;
  for (const wave of canonPlan(seed, c)) {
    for (const p of wave) spawns.push({ t: start + p.delay, max: most(p.kind) });
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

export const canon: MinigameDefinition<CanonConfig> = {
  id: 'canon',
  title: 'Cañón contra tiburones',
  summary:
    'Tiburones y piratas vienen hacia la playa. Desde la torre, el cañón dispara bolas de agua en parábola: nadie sale herido, sólo mojado.',
  instructions: [
    'Arrastra en cualquier sitio: la dirección es el ángulo y la longitud, la potencia.',
    'Suelta (o pulsa FUEGO o Espacio) para disparar. Con teclado: ↑↓ ángulo, ←→ potencia.',
    'La salpicadura asusta a los tiburones en superficie; a un pirata hay que darle dos veces.',
    'Si alguien llega a la playa, pierdes una de tus tres vidas. Aciertos seguidos suben el combo.',
  ],
  actionLabel: 'FUEGO',
  hint: '↑↓ ángulo · ←→ potencia · Espacio fuego · Esc pausa',
  defaults: CANON_DEFAULTS,
  create: (seed, config) => new CanonSim(seed, config),
  minPlausibleMs: canonMinPlausibleMs,
  endText(e) {
    if (e.reason === 'waves') return '¡Playa despejada! Has aguantado todas las oleadas.';
    if (e.reason === 'time') return 'Se acabó el tiempo de guardia en la torre.';
    return 'Tres intrusos han llegado a la playa: se acabó la guardia.';
  },
  feedback(ev) {
    switch (ev.kind) {
      case 'scare':
        return { text: comboText('¡Tiburón ahuyentado!', ev), tone: 'good' };
      case 'hit':
        return { text: comboText('¡Pirata mojado!', ev), tone: 'good' };
      case 'miss':
        return { text: 'Al agua. Combo a cero.', tone: 'bad' };
      case 'escape':
        return { text: 'Han llegado a la playa: −1 vida.', tone: 'bad' };
      case 'wave':
        return { text: `Oleada ${ev.wave}: vienen más rápido.`, tone: 'good' };
      default:
        return null;
    }
  },
};

function comboText(what: string, ev: SimEvent): string {
  return ev.combo && ev.combo > 1
    ? `${what} +${ev.points} (x${ev.combo})`
    : `${what} +${ev.points}`;
}

// --- Dibujo ------------------------------------------------------------------

function drawCanon(
  sim: CanonSim,
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

  // Cielo y mar, de lado.
  ctx.fillStyle = skin.night;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = skin.wave;
  ctx.fillRect(0, 0, w, Y(WATER_Y));
  ctx.restore();
  ctx.fillStyle = skin.sea;
  ctx.fillRect(0, Y(WATER_Y), w, h - Y(WATER_Y));
  // Olas en la línea del agua.
  ctx.save();
  ctx.strokeStyle = skin.crest;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = Math.max(1.5, u * 0.004);
  const drift = o.reducedMotion ? 0 : (o.clock * 0.03) % 0.08;
  ctx.beginPath();
  for (let x = -0.08 + drift; x < 1.08; x += 0.08) {
    ctx.moveTo(X(x), Y(WATER_Y));
    ctx.quadraticCurveTo(X(x + 0.02), Y(WATER_Y) - u * 0.012, X(x + 0.04), Y(WATER_Y));
  }
  ctx.stroke();
  ctx.globalAlpha = 0.25;
  for (let row = 1; row < 4; row++) {
    ctx.beginPath();
    for (let x = (row % 2) * 0.06 - drift; x < 1.1; x += 0.14) {
      ctx.moveTo(X(x), Y(WATER_Y + row * 0.06));
      ctx.lineTo(X(x + 0.05), Y(WATER_Y + row * 0.06));
    }
    ctx.stroke();
  }
  ctx.restore();

  // Playa y torre.
  wash(ctx, skin, skin.land, () => {
    ctx.moveTo(0, h);
    ctx.lineTo(0, Y(WATER_Y - 0.03));
    ctx.lineTo(X(COAST_X - 0.03), Y(WATER_Y - 0.01));
    ctx.lineTo(X(COAST_X + 0.02), Y(WATER_Y + 0.05));
    ctx.lineTo(X(COAST_X), h);
    ctx.closePath();
  });
  outline(ctx, skin, u);
  wash(ctx, skin, skin.crest, () => {
    ctx.rect(X(MUZZLE.x - 0.075), Y(MUZZLE.y + 0.02), X(0.09), Y(WATER_Y - MUZZLE.y));
  });
  outline(ctx, skin, u);
  ctx.fillStyle = skin.accent;
  ctx.fillRect(X(MUZZLE.x - 0.075), Y(MUZZLE.y + 0.06), X(0.09), Y(0.02));

  // Intrusos.
  for (const f of sim.foes) {
    if (f.state !== 'swimming' && f.state !== 'fleeing') continue;
    if (f.kind === 'shark') drawShark(ctx, skin, u, X(f.x), Y(WATER_Y), f);
    else drawPirate(ctx, skin, u, X(f.x), Y(WATER_Y), f, c);
  }

  // Ayuda de trayectoria: el principio del arco, punteado.
  const shot = sim.shot();
  if (!sim.ended) {
    ctx.save();
    ctx.strokeStyle = skin.crest;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(2, u * 0.006);
    ctx.setLineDash([u * 0.012, u * 0.016]);
    ctx.beginPath();
    const until = shot.tLand * c.preview;
    for (let i = 0; i <= 20; i++) {
      const p = ballAt(shot, (until * i) / 20, c);
      if (i === 0) ctx.moveTo(X(p.x), Y(p.y));
      else ctx.lineTo(X(p.x), Y(p.y));
    }
    ctx.stroke();
    ctx.restore();
  }

  // Bolas en vuelo.
  for (const b of sim.balls) {
    const p = ballAt(b.shot, b.age, c);
    ctx.fillStyle = skin.crest;
    ctx.beginPath();
    ctx.arc(X(p.x), Y(p.y), u * 0.016, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, skin, u);
  }

  // Cañón, orientado al ángulo; la longitud del fogón marca la potencia.
  const dirX = Math.cos(sim.angle) * w;
  const dirY = -Math.sin(sim.angle) * h;
  const ang = Math.atan2(dirY, dirX);
  ctx.save();
  ctx.translate(X(MUZZLE.x), Y(MUZZLE.y));
  ctx.rotate(ang);
  wash(ctx, skin, '#3a3a3a', () => ctx.rect(-u * 0.02, -u * 0.02, u * 0.08, u * 0.04));
  outline(ctx, skin, u);
  ctx.fillStyle = skin.accent;
  ctx.fillRect(u * 0.065, -u * 0.022, u * 0.01, u * 0.044);
  // Potencia: barra a lo largo del cañón.
  ctx.fillStyle = skin.beam;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(-u * 0.02, u * 0.03, u * 0.12 * sim.power, u * 0.012);
  ctx.restore();
  wash(ctx, skin, skin.accent, () => ctx.arc(X(MUZZLE.x), Y(MUZZLE.y), u * 0.028, 0, Math.PI * 2));
  outline(ctx, skin, u);

  // Vidas: salvavidas en la playa.
  for (let i = 0; i < c.lives; i++) {
    ctx.save();
    ctx.globalAlpha = i < sim.lives ? 1 : 0.25;
    ctx.strokeStyle = i < sim.lives ? skin.accent : skin.ink;
    ctx.lineWidth = Math.max(2, u * 0.008);
    ctx.beginPath();
    ctx.arc(X(0.03 + i * 0.045), Y(0.93), u * 0.014, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Marcas: puntos y salpicones, sin destellos.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(u * 0.05)}px system-ui, sans-serif`;
  for (const m of sim.drawMarks) {
    const alpha = Math.max(0, 1 - m.age / 1.2);
    const rise = o.reducedMotion ? 0 : m.age * 0.05;
    ctx.globalAlpha = alpha;
    if (m.kind === 'miss') {
      ctx.strokeStyle = skin.crest;
      ctx.lineWidth = Math.max(2, u * 0.005);
      ctx.beginPath();
      ctx.ellipse(X(m.x), Y(WATER_Y), c.splashRadius * w, u * 0.012, 0, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = m.kind === 'hit' ? skin.good : skin.bad;
    ctx.fillText(m.text, X(m.x), Y(m.y - rise));
  }
  ctx.restore();

  if (sim.breakLeft !== null && !sim.ended) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = skin.crest;
    ctx.font = `800 ${Math.round(u * 0.07)}px system-ui, sans-serif`;
    ctx.fillText(`Oleada ${sim.wave + 1}`, X(0.55), Y(0.3));
    ctx.restore();
  }
}

function drawShark(
  ctx: CanvasRenderingContext2D,
  skin: MinigameSkin,
  u: number,
  x: number,
  y: number,
  f: CanonFoe,
) {
  const s = u * 0.045;
  ctx.save();
  ctx.translate(x, y);
  if (f.submerged && f.state === 'swimming') {
    // Sumergido: sólo una sombra discontinua; no se le puede asustar.
    ctx.strokeStyle = skin.crest;
    ctx.globalAlpha = 0.45;
    ctx.setLineDash([s * 0.2, s * 0.2]);
    ctx.lineWidth = Math.max(1, u * 0.003);
    ctx.beginPath();
    ctx.ellipse(0, s * 0.5, s, s * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const dir = f.state === 'fleeing' ? 1 : -1;
  // Estela detrás de la aleta.
  ctx.strokeStyle = skin.crest;
  ctx.lineWidth = Math.max(1.5, u * 0.004);
  ctx.globalAlpha = f.state === 'fleeing' ? 0.9 : 0.6;
  ctx.beginPath();
  ctx.moveTo(-dir * s * 0.4, 0);
  ctx.lineTo(-dir * s * (f.state === 'fleeing' ? 1.8 : 1.1), s * 0.06);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Aleta, siempre entera.
  wash(ctx, skin, '#5b6772', () => {
    ctx.moveTo(-dir * s * 0.45, 0);
    ctx.quadraticCurveTo(dir * s * 0.05, -s * 0.9, dir * s * 0.5, -s * 0.85);
    ctx.quadraticCurveTo(dir * s * 0.25, -s * 0.35, dir * s * 0.45, 0);
    ctx.closePath();
  });
  outline(ctx, skin, u);
  ctx.restore();
}

function drawPirate(
  ctx: CanvasRenderingContext2D,
  skin: MinigameSkin,
  u: number,
  x: number,
  y: number,
  f: CanonFoe,
  c: CanonConfig,
) {
  ctx.save();
  ctx.translate(x, y);
  const k = u * 0.06;
  // Casco.
  wash(ctx, skin, '#5d4a3a', () => {
    ctx.moveTo(-k, -k * 0.3);
    ctx.lineTo(k, -k * 0.3);
    ctx.lineTo(k * 0.7, k * 0.2);
    ctx.lineTo(-k * 0.7, k * 0.2);
    ctx.closePath();
  });
  outline(ctx, skin, u);
  // Vela, mojada si ya le dieron.
  wash(ctx, skin, f.hp < c.pirate.hp ? '#a9b8c8' : '#e9e1cf', () => {
    ctx.moveTo(0, -k * 0.35);
    ctx.lineTo(0, -k * 1.9);
    ctx.lineTo(k * 0.8, -k * 0.5);
    ctx.closePath();
  });
  outline(ctx, skin, u);
  // Bandera pirata: negra con calavera (patrón, no sólo color).
  const fw = k * 0.55;
  const fh = k * 0.36;
  ctx.fillStyle = '#0c0c0c';
  ctx.fillRect(-fw, -k * 1.9, fw, fh);
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath();
  ctx.arc(-fw / 2, -k * 1.9 + fh * 0.45, fh * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
