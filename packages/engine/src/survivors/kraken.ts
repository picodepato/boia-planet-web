import type { Rect } from '@boia/world';
import type { CircleObstacle } from '../ship/controller';
import { wrapDelta, wrapInto } from '../world/wrap';
import type { BossDef, KrakenDef } from './config';
import type { BossWarningView } from './sim';

/**
 * El Kraken (§7, T141): el boss final del acto 2, en la simulación pura. Su
 * `BossDef` lleva `kraken` y entonces la simulación (`sim.ts`, sección
 * «Bosses») no usa los ataques genéricos ni el movimiento de la fase: cada
 * paso llama a `stepKraken`, pregunta `krakenVulnerable` / `krakenSolid`, y
 * hiere los tentáculos con `hurtTentacle`. Todo lo que ve la pantalla sale
 * de `krakenView` y `krakenWarnings`. Las fases (por vida) siguen siendo las
 * genéricas de `BossDef.phases`; cada una lee sus números de
 * `kraken.phases[i]`.
 *
 * Estados (`KrakenMode`):
 * - `submerged`: una sombra bajo el agua persigue al barco pasando por
 *   debajo de las islas; no se le puede golpear ni moja. Cuando lleva al
 *   menos `minSubmergedS` y está a `emergeDistance` (o lleva
 *   `maxSubmergedS`), emerge donde está, en agua.
 * - `emerging` / `diving`: sale o se hunde (`emergeS` / `diveS` s); no se le
 *   puede golpear ni moja.
 * - `emerged`: saca tentáculos alrededor del barco cada `tentacle.everyS` s;
 *   cada uno avisa con su círculo (`telegraphS`), sube (`riseS`; moja a quien
 *   esté dentro, un golpe por salida) y se queda arriba `upS` s, donde las
 *   armas lo pueden tumbar. Tumbar uno expone la cabeza `exposeS` s: la
 *   ventana de daño. Pasados `emergedS` s (y sin ventana abierta) se hunde.
 * - `grabbing`: si la fase lo permite, la salida anterior no fue un agarre y
 *   hay una isla a `grab.range` u, emerge agarrado a su borde y cada
 *   `grab.everyS` s lanza rocas que caen alrededor del barco: el círculo de
 *   caída avisa durante todo el vuelo (`rock.flightS`). Con
 *   `grab.exposesHead` la cabeza recibe daño mientras está agarrado.
 */
export type KrakenMode = 'submerged' | 'emerging' | 'emerged' | 'grabbing' | 'diving';

/** Un tentáculo: avisa, sube (golpea), se queda arriba (se le puede tumbar) y baja. */
export type TentacleStage = 'warning' | 'rising' | 'up' | 'down';

export interface Tentacle {
  id: number;
  x: number;
  y: number;
  radius: number;
  stage: TentacleStage;
  /** s que quedan de la etapa. */
  timer: number;
  hp: number;
  maxHp: number;
  dead: boolean;
}

/** Una roca en vuelo: de (fromX, fromY) a (x, y), donde cae al acabar `timer`. */
export interface Rock {
  id: number;
  fromX: number;
  fromY: number;
  x: number;
  y: number;
  radius: number;
  timer: number;
  flightS: number;
}

export interface KrakenState {
  readonly def: KrakenDef;
  mode: KrakenMode;
  /** s en el modo. */
  modeS: number;
  /** s que quedan de cabeza expuesta (tumbar un tentáculo la renueva). */
  exposedS: number;
  /** s hasta la próxima salida de tentáculos / andanada de rocas. */
  tentacleTimer: number;
  rockTimer: number;
  /** Isla agarrada (índice en `obstacles`); -1 si ninguna. */
  island: number;
  /** La última salida fue un agarre (se alternan). */
  lastGrab: boolean;
  /** Aguante de cada tentáculo, ya escalado por acto y dificultad. */
  readonly tentacleHp: number;
  tentacles: Tentacle[];
  rocks: Rock[];
  /** La salida de tentáculos / andanada en curso ya mojó (un golpe por salida) y ya golpeó (suceso). */
  volleyLanded: boolean;
  volleyStruck: boolean;
  rockVolleyLanded: boolean;
  rockVolleyStruck: boolean;
}

/** Lo que el Kraken necesita de la partida; lo implementa la simulación. */
export interface KrakenHost {
  readonly bounds: Rect;
  readonly obstacles: readonly CircleObstacle[];
  player(): { x: number; y: number };
  shipRadius(): number;
  rng(): number;
  nextId(): number;
  /** Lleva el círculo al agua; null si sigue en tierra. */
  toWater(x: number, y: number, r: number): { x: number; y: number } | null;
  /** ¿Moja ahora un golpe avisado? (la invulnerabilidad larga del barco lo salva). */
  hitLands(): boolean;
  hitPlayer(water: number, attack: string, x: number, y: number): void;
  /** Los sucesos genéricos de aviso y golpe (`bossTelegraph`, `bossAttack`, forma `circles`). */
  telegraph(attack: string, x: number, y: number): void;
  attack(attack: string, x: number, y: number): void;
  emit(ev: KrakenEvent): void;
}

/** El cuerpo del boss que el Kraken mueve (la entidad de la simulación). */
export interface KrakenBody {
  readonly id: number;
  readonly def: BossDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  radius: number;
  phase: number;
}

/** Los sucesos propios del Kraken (además de los genéricos de boss). `id` es el del boss. */
export type KrakenEvent =
  /** Cambia de estado; `island` es la agarrada (-1 si ninguna). */
  | { type: 'krakenState'; id: number; state: KrakenMode; x: number; y: number; island: number }
  | { type: 'krakenTentacle'; id: number; tentacle: number; stage: 'warning' | 'rise' | 'down' | 'destroyed'; x: number; y: number }
  | { type: 'krakenTentacleHit'; id: number; tentacle: number; damage: number; hp: number; x: number; y: number }
  /** Una roca sale (`thrown`, con su punto de caída) o cae (`landed`). */
  | { type: 'krakenRock'; id: number; rock: number; stage: 'thrown' | 'landed'; x: number; y: number; fromX: number; fromY: number }
  /** La cabeza queda expuesta `exposedS` s. */
  | { type: 'krakenExposed'; id: number; exposedS: number; x: number; y: number };

export interface KrakenTentacleView {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly stage: TentacleStage;
  /** 0→1 dentro de la etapa (`down`: 1→0, lo que queda fuera del agua). */
  readonly progress: number;
  readonly hp: number;
  readonly maxHp: number;
}

export interface KrakenRockView {
  readonly id: number;
  readonly fromX: number;
  readonly fromY: number;
  /** Dónde cae. */
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** 0→1 del vuelo. */
  readonly progress: number;
}

/** El Kraken para la pantalla: va en `BossView.kraken`; la posición es la del boss (bajo el agua, la sombra). */
export interface KrakenView {
  readonly mode: KrakenMode;
  /** 0→1 dentro del modo (`emerging`/`diving`: cuánto ha salido o se ha hundido). */
  readonly progress: number;
  /** La cabeza recibe daño ahora y cuánto le queda de ventana (s). */
  readonly exposed: boolean;
  readonly exposedS: number;
  /** Isla agarrada (índice en `world.obstacles`), -1 si ninguna. */
  readonly island: number;
  readonly tentacles: readonly KrakenTentacleView[];
  readonly rocks: readonly KrakenRockView[];
}

export const TENTACLE_ATTACK = 'tentaculos';
export const ROCK_ATTACK = 'rocas';

export function createKraken(def: KrakenDef, tentacleHp: number): KrakenState {
  return {
    def,
    mode: 'submerged',
    modeS: 0,
    exposedS: 0,
    tentacleTimer: 0,
    rockTimer: 0,
    island: -1,
    lastGrab: false,
    tentacleHp,
    tentacles: [],
    rocks: [],
    volleyLanded: false,
    volleyStruck: false,
    rockVolleyLanded: false,
    rockVolleyStruck: false,
  };
}

/** Los números de la fase `phase` (la última si se pasa). */
export function krakenPhase(def: KrakenDef, phase: number): KrakenDef['phases'][number] {
  return def.phases[Math.min(Math.max(0, phase), def.phases.length - 1)]!;
}

/** ¿Recibe daño la cabeza ahora? */
export function krakenVulnerable(k: KrakenState): boolean {
  if (k.mode === 'emerged') return k.exposedS > 0;
  if (k.mode === 'grabbing') return k.def.grab.exposesHead || k.exposedS > 0;
  return false;
}

/** ¿Está fuera del agua (toca el casco y se ve entero)? */
export function krakenSolid(k: KrakenState): boolean {
  return k.mode === 'emerged' || k.mode === 'grabbing';
}

/** ¿Se puede golpear este tentáculo ahora? */
export function tentacleHittable(t: Tentacle): boolean {
  return !t.dead && (t.stage === 'rising' || t.stage === 'up');
}

function toPlayer(body: KrakenBody, host: KrakenHost): { dx: number; dy: number; dist: number } {
  const p = host.player();
  const w = host.bounds.right - host.bounds.left;
  const h = host.bounds.bottom - host.bounds.top;
  const dx = wrapDelta(p.x - body.x, w);
  const dy = wrapDelta(p.y - body.y, h);
  return { dx, dy, dist: Math.hypot(dx, dy) };
}

function place(body: KrakenBody, host: KrakenHost, x: number, y: number): void {
  body.x = wrapInto(x, host.bounds.left, host.bounds.right);
  body.y = wrapInto(y, host.bounds.top, host.bounds.bottom);
}

function setMode(k: KrakenState, body: KrakenBody, host: KrakenHost, mode: KrakenMode): void {
  k.mode = mode;
  k.modeS = 0;
  host.emit({ type: 'krakenState', id: body.id, state: mode, x: body.x, y: body.y, island: k.island });
}

/** Un paso del Kraken: mueve el cuerpo, saca tentáculos, lanza rocas, cambia de estado. */
export function stepKraken(k: KrakenState, body: KrakenBody, host: KrakenHost, dt: number): void {
  const def = k.def;
  k.modeS += dt;
  if (k.exposedS > 0) k.exposedS = Math.max(0, k.exposedS - dt);
  const ph = krakenPhase(def, body.phase);
  const speed = body.def.speed * (body.def.phases[body.phase]?.speedScale ?? 1);
  stepTentacles(k, body, host, dt);
  stepRocks(k, body, host, dt);
  switch (k.mode) {
    case 'submerged': {
      const { dist } = chase(body, host, speed * def.submergedSpeedScale, dt);
      if (k.modeS >= def.minSubmergedS && (dist <= def.emergeDistance || k.modeS >= def.maxSubmergedS)) {
        tryEmerge(k, body, host, ph);
      }
      break;
    }
    case 'emerging':
      faceShip(body, host);
      if (k.modeS >= def.emergeS) {
        if (k.island >= 0) {
          k.rockTimer = 0.3;
          setMode(k, body, host, 'grabbing');
        } else {
          k.tentacleTimer = 0.2;
          setMode(k, body, host, 'emerged');
        }
      }
      break;
    case 'emerged': {
      faceShip(body, host);
      k.tentacleTimer -= dt;
      const { dist } = toPlayer(body, host);
      const inReach = dist <= def.tentacle.reach;
      if (k.tentacleTimer <= 0 && k.modeS < def.emergedS && inReach) {
        tentacleVolley(k, body, host, ph.tentacles);
        k.tentacleTimer = def.tentacle.everyS;
      }
      // Se hunde al acabar su tiempo o si el barco se le fue lejos; nunca con la cabeza expuesta.
      const done = k.modeS >= def.emergedS || (!inReach && k.tentacles.length === 0);
      if (done && k.exposedS <= 0) dive(k, body, host);
      break;
    }
    case 'grabbing':
      faceShip(body, host);
      k.rockTimer -= dt;
      if (k.rockTimer <= 0 && k.modeS < def.grab.holdS) {
        throwRocks(k, body, host, ph.rocks);
        k.rockTimer = def.grab.everyS;
      }
      if (k.modeS >= def.grab.holdS && (def.grab.exposesHead || k.exposedS <= 0)) dive(k, body, host);
      break;
    case 'diving':
      if (k.modeS >= def.diveS) {
        k.island = -1;
        for (const t of k.tentacles) t.dead = true;
        k.tentacles.length = 0;
        setMode(k, body, host, 'submerged');
      }
      break;
    default:
      break;
  }
}

/** Persigue al barco bajo el agua, pasando por debajo de las islas. */
function chase(body: KrakenBody, host: KrakenHost, speed: number, dt: number): { dist: number } {
  const { dx, dy, dist } = toPlayer(body, host);
  const ux = dist > 1e-6 ? dx / dist : 1;
  const uy = dist > 1e-6 ? dy / dist : 0;
  const wantX = ux * speed;
  const wantY = uy * speed;
  const ddx = wantX - body.vx;
  const ddy = wantY - body.vy;
  const dl = Math.hypot(ddx, ddy);
  const maxDv = body.def.acceleration * dt;
  if (dl > maxDv) {
    body.vx += (ddx / dl) * maxDv;
    body.vy += (ddy / dl) * maxDv;
  } else {
    body.vx = wantX;
    body.vy = wantY;
  }
  const sp = Math.hypot(body.vx, body.vy);
  if (sp > speed) {
    body.vx *= speed / sp;
    body.vy *= speed / sp;
  }
  place(body, host, body.x + body.vx * dt, body.y + body.vy * dt);
  body.heading = sp > 1 ? Math.atan2(body.vy, body.vx) : Math.atan2(uy, ux);
  return { dist };
}

function faceShip(body: KrakenBody, host: KrakenHost): void {
  body.vx = 0;
  body.vy = 0;
  const { dx, dy } = toPlayer(body, host);
  body.heading = Math.atan2(dy, dx);
}

/**
 * La isla al alcance del agarre más cercana (por su borde); -1 si ninguna.
 * Sólo cuenta si el Kraken cabe en agua pegado a su borde.
 */
export function reachableIsland(k: KrakenState, body: KrakenBody, host: KrakenHost): number {
  const w = host.bounds.right - host.bounds.left;
  const h = host.bounds.bottom - host.bounds.top;
  let best = -1;
  let bestD = k.def.grab.range;
  host.obstacles.forEach((o, i) => {
    const d = Math.hypot(wrapDelta(o.x - body.x, w), wrapDelta(o.y - body.y, h)) - o.radius;
    if (d <= bestD && (best < 0 || d < bestD)) {
      if (!grabSpot(body, host, i)) return;
      best = i;
      bestD = d;
    }
  });
  return best;
}

/** Dónde se pone el Kraken agarrado a la isla `i`: pegado a su borde, del lado del Kraken, en agua. */
function grabSpot(body: KrakenBody, host: KrakenHost, i: number): { x: number; y: number } | null {
  const o = host.obstacles[i]!;
  const w = host.bounds.right - host.bounds.left;
  const h = host.bounds.bottom - host.bounds.top;
  const dx = wrapDelta(body.x - o.x, w);
  const dy = wrapDelta(body.y - o.y, h);
  const d = Math.hypot(dx, dy);
  const ux = d > 1e-6 ? dx / d : 1;
  const uy = d > 1e-6 ? dy / d : 0;
  const out = o.radius + body.radius + 4;
  return host.toWater(o.x + ux * out, o.y + uy * out, body.radius);
}

/** Emerge: agarrado a una isla si toca, si no donde está (en agua); si no hay agua, sigue sumergido. */
function tryEmerge(k: KrakenState, body: KrakenBody, host: KrakenHost, ph: KrakenDef['phases'][number]): void {
  if (ph.grabs && !k.lastGrab) {
    const island = reachableIsland(k, body, host);
    if (island >= 0) {
      const spot = grabSpot(body, host, island)!;
      k.island = island;
      k.lastGrab = true;
      place(body, host, spot.x, spot.y);
      faceShip(body, host);
      setMode(k, body, host, 'emerging');
      return;
    }
  }
  // Donde está, pero nunca justo debajo del barco: a `emergeMinDistance` como poco, apartándose.
  const p = host.player();
  const w = host.bounds.right - host.bounds.left;
  const h = host.bounds.bottom - host.bounds.top;
  let dx = wrapDelta(body.x - p.x, w);
  let dy = wrapDelta(body.y - p.y, h);
  let d = Math.hypot(dx, dy);
  if (d < 1e-6) {
    dx = -Math.cos(body.heading);
    dy = -Math.sin(body.heading);
    d = 1;
  }
  const min = k.def.emergeMinDistance;
  let spot =
    d >= min
      ? host.toWater(body.x, body.y, body.radius)
      : host.toWater(p.x + (dx / d) * min, p.y + (dy / d) * min, body.radius);
  if (!spot) {
    // Bajo una isla: prueba alrededor del barco, a la distancia de emerger.
    const base = Math.atan2(dy, dx);
    for (let j = 0; j < 8 && !spot; j++) {
      const a = base + (j * Math.PI) / 4;
      spot = host.toWater(p.x + Math.cos(a) * k.def.emergeDistance, p.y + Math.sin(a) * k.def.emergeDistance, body.radius);
    }
    if (!spot) return;
  }
  k.island = -1;
  k.lastGrab = false;
  place(body, host, spot.x, spot.y);
  faceShip(body, host);
  setMode(k, body, host, 'emerging');
}

function dive(k: KrakenState, body: KrakenBody, host: KrakenHost): void {
  // Los tentáculos que aún no subieron no suben (nada golpea sin aviso cumplido); los de arriba bajan.
  for (const t of k.tentacles) {
    if (t.dead) continue;
    if (t.stage === 'warning') t.dead = true;
    else if (t.stage !== 'down') {
      t.stage = 'down';
      t.timer = k.def.tentacle.riseS;
      host.emit({ type: 'krakenTentacle', id: body.id, tentacle: t.id, stage: 'down', x: t.x, y: t.y });
    }
  }
  k.exposedS = 0;
  setMode(k, body, host, 'diving');
}

/** Una salida de `n` tentáculos alrededor del barco (el primero, encima), sólo en agua. */
function tentacleVolley(k: KrakenState, body: KrakenBody, host: KrakenHost, n: number): void {
  const def = k.def.tentacle;
  const p = host.player();
  let made = 0;
  for (let i = 0; i < n; i++) {
    const ang = host.rng() * Math.PI * 2;
    const r = i === 0 ? 0 : Math.sqrt(host.rng()) * def.spread;
    const spot = host.toWater(p.x + Math.cos(ang) * r, p.y + Math.sin(ang) * r, def.radius);
    if (!spot) continue;
    const t: Tentacle = {
      id: host.nextId(),
      x: wrapInto(spot.x, host.bounds.left, host.bounds.right),
      y: wrapInto(spot.y, host.bounds.top, host.bounds.bottom),
      radius: def.radius,
      stage: 'warning',
      timer: def.telegraphS,
      hp: k.tentacleHp,
      maxHp: k.tentacleHp,
      dead: false,
    };
    k.tentacles.push(t);
    host.emit({ type: 'krakenTentacle', id: body.id, tentacle: t.id, stage: 'warning', x: t.x, y: t.y });
    made++;
  }
  if (made === 0) return;
  k.volleyLanded = false;
  k.volleyStruck = false;
  host.telegraph(TENTACLE_ATTACK, p.x, p.y);
}

function stepTentacles(k: KrakenState, body: KrakenBody, host: KrakenHost, dt: number): void {
  if (k.tentacles.length === 0) return;
  const def = k.def.tentacle;
  for (const t of k.tentacles) {
    if (t.dead) continue;
    t.timer -= dt;
    if (t.timer > 0) continue;
    switch (t.stage) {
      case 'warning': {
        t.stage = 'rising';
        t.timer = def.riseS;
        host.emit({ type: 'krakenTentacle', id: body.id, tentacle: t.id, stage: 'rise', x: t.x, y: t.y });
        if (!k.volleyStruck) {
          k.volleyStruck = true;
          host.attack(TENTACLE_ATTACK, t.x, t.y);
        }
        if (!k.volleyLanded && host.hitLands()) {
          const p = host.player();
          const w = host.bounds.right - host.bounds.left;
          const h = host.bounds.bottom - host.bounds.top;
          const reach = t.radius + host.shipRadius();
          const dx = wrapDelta(p.x - t.x, w);
          const dy = wrapDelta(p.y - t.y, h);
          if (dx * dx + dy * dy <= reach * reach) {
            k.volleyLanded = true;
            host.hitPlayer(def.water, TENTACLE_ATTACK, t.x, t.y);
          }
        }
        break;
      }
      case 'rising':
        t.stage = 'up';
        t.timer = def.upS;
        break;
      case 'up':
        t.stage = 'down';
        t.timer = def.riseS;
        host.emit({ type: 'krakenTentacle', id: body.id, tentacle: t.id, stage: 'down', x: t.x, y: t.y });
        break;
      case 'down':
        t.dead = true;
        break;
      default:
        break;
    }
  }
  let n = 0;
  for (const t of k.tentacles) if (!t.dead) k.tentacles[n++] = t;
  k.tentacles.length = n;
}

/** Hiere un tentáculo (si se puede golpear); al tumbarlo, la cabeza queda expuesta. */
export function hurtTentacle(k: KrakenState, body: KrakenBody, host: KrakenHost, t: Tentacle, damage: number): void {
  if (!tentacleHittable(t) || damage <= 0) return;
  t.hp -= damage;
  host.emit({ type: 'krakenTentacleHit', id: body.id, tentacle: t.id, damage, hp: Math.max(0, t.hp), x: t.x, y: t.y });
  if (t.hp > 0) return;
  t.dead = true;
  host.emit({ type: 'krakenTentacle', id: body.id, tentacle: t.id, stage: 'destroyed', x: t.x, y: t.y });
  if (k.mode === 'emerged' || k.mode === 'grabbing') {
    k.exposedS = Math.max(k.exposedS, k.def.exposeS);
    host.emit({ type: 'krakenExposed', id: body.id, exposedS: k.exposedS, x: body.x, y: body.y });
  }
}

/** Una andanada de `n` rocas desde el Kraken a alrededor del barco (la primera, encima). */
function throwRocks(k: KrakenState, body: KrakenBody, host: KrakenHost, n: number): void {
  const def = k.def.grab.rock;
  const p = host.player();
  for (let i = 0; i < n; i++) {
    const ang = host.rng() * Math.PI * 2;
    const r = i === 0 ? 0 : Math.sqrt(host.rng()) * def.spread;
    const rock: Rock = {
      id: host.nextId(),
      fromX: body.x,
      fromY: body.y,
      x: wrapInto(p.x + Math.cos(ang) * r, host.bounds.left, host.bounds.right),
      y: wrapInto(p.y + Math.sin(ang) * r, host.bounds.top, host.bounds.bottom),
      radius: def.radius,
      timer: def.flightS,
      flightS: def.flightS,
    };
    k.rocks.push(rock);
    host.emit({ type: 'krakenRock', id: body.id, rock: rock.id, stage: 'thrown', x: rock.x, y: rock.y, fromX: rock.fromX, fromY: rock.fromY });
  }
  if (n <= 0) return;
  k.rockVolleyLanded = false;
  k.rockVolleyStruck = false;
  host.telegraph(ROCK_ATTACK, p.x, p.y);
}

function stepRocks(k: KrakenState, body: KrakenBody, host: KrakenHost, dt: number): void {
  if (k.rocks.length === 0) return;
  const def = k.def.grab.rock;
  const w = host.bounds.right - host.bounds.left;
  const h = host.bounds.bottom - host.bounds.top;
  let n = 0;
  for (const rock of k.rocks) {
    rock.timer -= dt;
    if (rock.timer > 0) {
      k.rocks[n++] = rock;
      continue;
    }
    host.emit({ type: 'krakenRock', id: body.id, rock: rock.id, stage: 'landed', x: rock.x, y: rock.y, fromX: rock.fromX, fromY: rock.fromY });
    if (!k.rockVolleyStruck) {
      k.rockVolleyStruck = true;
      host.attack(ROCK_ATTACK, rock.x, rock.y);
    }
    if (!k.rockVolleyLanded && host.hitLands()) {
      const p = host.player();
      const reach = rock.radius + host.shipRadius();
      const dx = wrapDelta(p.x - rock.x, w);
      const dy = wrapDelta(p.y - rock.y, h);
      if (dx * dx + dy * dy <= reach * reach) {
        k.rockVolleyLanded = true;
        host.hitPlayer(def.water, ROCK_ATTACK, rock.x, rock.y);
      }
    }
  }
  k.rocks.length = n;
}

/** Al caer o retirarse el boss: fuera tentáculos y rocas. */
export function clearKraken(k: KrakenState): void {
  for (const t of k.tentacles) t.dead = true;
  k.tentacles.length = 0;
  k.rocks.length = 0;
  k.exposedS = 0;
}

function modeProgress(k: KrakenState): number {
  const def = k.def;
  let total = 0;
  switch (k.mode) {
    case 'emerging':
      total = def.emergeS;
      break;
    case 'diving':
      total = def.diveS;
      break;
    case 'emerged':
      total = def.emergedS;
      break;
    case 'grabbing':
      total = def.grab.holdS;
      break;
    default:
      total = def.maxSubmergedS;
      break;
  }
  return total > 0 ? Math.min(1, Math.max(0, k.modeS / total)) : 1;
}

function tentacleProgress(k: KrakenState, t: Tentacle): number {
  const def = k.def.tentacle;
  const total = t.stage === 'warning' ? def.telegraphS : t.stage === 'up' ? def.upS : def.riseS;
  const done = total > 0 ? Math.min(1, Math.max(0, 1 - t.timer / total)) : 1;
  return t.stage === 'down' ? 1 - done : done;
}

export function krakenView(k: KrakenState): KrakenView {
  return {
    mode: k.mode,
    progress: modeProgress(k),
    exposed: krakenVulnerable(k),
    exposedS: k.exposedS,
    island: k.island,
    tentacles: k.tentacles
      .filter((t) => !t.dead)
      .map((t) => ({
        id: t.id,
        x: t.x,
        y: t.y,
        radius: t.radius,
        stage: t.stage,
        progress: tentacleProgress(k, t),
        hp: Math.max(0, t.hp),
        maxHp: t.maxHp,
      })),
    rocks: k.rocks.map((r) => ({
      id: r.id,
      fromX: r.fromX,
      fromY: r.fromY,
      x: r.x,
      y: r.y,
      radius: r.radius,
      progress: r.flightS > 0 ? Math.min(1, Math.max(0, 1 - r.timer / r.flightS)) : 1,
    })),
  };
}

/**
 * Los avisos en el agua para la pantalla (forma `circles`): un círculo por
 * tentáculo avisando (`hit` false) o subiendo (`hit` true) y uno por roca en
 * vuelo (su punto de caída).
 */
export function krakenWarnings(k: KrakenState, body: KrakenBody, out: BossWarningView[]): void {
  const base = {
    id: body.id,
    boss: body.def.id,
    kind: 'circles' as const,
    heading: 0,
    length: 0,
    thickness: 0,
    gaps: 0,
    gapRad: 0,
    gapPhase: 0,
    ringRadius: 0,
  };
  for (const t of k.tentacles) {
    if (t.dead || (t.stage !== 'warning' && t.stage !== 'rising')) continue;
    out.push({
      ...base,
      attack: TENTACLE_ATTACK,
      x: t.x,
      y: t.y,
      radius: t.radius,
      progress: tentacleProgress(k, t),
      hit: t.stage === 'rising',
    });
  }
  for (const r of k.rocks) {
    out.push({
      ...base,
      attack: ROCK_ATTACK,
      x: r.x,
      y: r.y,
      radius: r.radius,
      progress: r.flightS > 0 ? Math.min(1, Math.max(0, 1 - r.timer / r.flightS)) : 1,
      hit: false,
    });
  }
}

/** Lo que entra en `stateHash`. */
export function krakenHash(k: KrakenState): unknown[] {
  return [
    k.mode,
    k.modeS,
    k.exposedS,
    k.tentacleTimer,
    k.rockTimer,
    k.island,
    k.lastGrab ? 1 : 0,
    k.tentacles.map((t) => [t.id, t.x, t.y, t.stage, t.timer, t.hp]),
    k.rocks.map((r) => [r.id, r.x, r.y, r.timer]),
  ];
}

/** Comprueba los datos del Kraken de un boss; devuelve los problemas (vacío si va bien). */
export function validateKraken(def: BossDef): string[] {
  const k = def.kraken;
  if (!k) return [];
  const out: string[] = [];
  const pos = (v: number, name: string) => {
    if (!(v > 0)) out.push(`${def.id}: kraken ${name}`);
  };
  pos(k.emergeDistance, 'emergeDistance');
  pos(k.emergeMinDistance, 'emergeMinDistance');
  if (k.emergeMinDistance > k.emergeDistance) out.push(`${def.id}: kraken emergeMinDistance > emergeDistance`);
  pos(k.tentacle.reach, 'tentacle.reach');
  pos(k.maxSubmergedS, 'maxSubmergedS');
  if (k.minSubmergedS > k.maxSubmergedS) out.push(`${def.id}: kraken minSubmergedS > maxSubmergedS`);
  pos(k.submergedSpeedScale, 'submergedSpeedScale');
  pos(k.emergeS, 'emergeS');
  pos(k.diveS, 'diveS');
  pos(k.emergedS, 'emergedS');
  pos(k.exposeS, 'exposeS');
  pos(k.tentacle.telegraphS, 'tentacle.telegraphS');
  pos(k.tentacle.riseS, 'tentacle.riseS');
  pos(k.tentacle.upS, 'tentacle.upS');
  pos(k.tentacle.hp, 'tentacle.hp');
  pos(k.tentacle.radius, 'tentacle.radius');
  pos(k.tentacle.everyS, 'tentacle.everyS');
  pos(k.grab.range, 'grab.range');
  pos(k.grab.holdS, 'grab.holdS');
  pos(k.grab.everyS, 'grab.everyS');
  pos(k.grab.rock.flightS, 'grab.rock.flightS');
  pos(k.grab.rock.radius, 'grab.rock.radius');
  if (k.phases.length !== def.phases.length) out.push(`${def.id}: kraken.phases (${k.phases.length}) ≠ phases (${def.phases.length})`);
  k.phases.forEach((p, i) => {
    if (!(p.tentacles > 0)) out.push(`${def.id}: kraken fase ${i} sin tentáculos`);
    if (p.grabs && !(p.rocks > 0)) out.push(`${def.id}: kraken fase ${i} agarra sin rocas`);
  });
  for (const p of def.phases) if (p.attacks.length > 0) out.push(`${def.id}: el Kraken no usa ataques genéricos`);
  return out;
}
