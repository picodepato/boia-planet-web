import {
  type DefenseConfig,
  type DefenseEnemyKind,
  type DefenseTargetPriority,
  type DefenseTowerKind,
  defenseFarmPayout,
  defenseTowerStats,
} from './config';
import { beamTouches, coneTouches, wrapAngle } from './geometry';
import type { DefensePath } from './path';

/**
 * El enganche de las torres (las islas construidas, decisiones 8 y 9 del
 * plan 014). La partida (`sim.ts`) lleva la lista de torres y, en cada paso
 * activo, para cada una pregunta a su tipo `targets` (a quién apunta ahora:
 * la vista lo pinta) y luego llama a `onTick` con esos blancos. Lo que hace
 * cada tipo (haz, bolas de nieve, fuego, mortero, granja, onda, francotirador)
 * está en `DEFENSE_TOWER_HOOKS` (T159, decisión 9), con los números de
 * `DefenseConfig.towers`; sin entrada, la torre no hace nada. La partida
 * corre igual con cero torres.
 */

/** Lo que la vista sabe de un enemigo en el camino. Se actualiza en su sitio. */
export interface DefenseEnemyView {
  readonly id: number;
  readonly kind: DefenseEnemyKind;
  readonly tier: 'common' | 'miniboss' | 'boss';
  /** Miniboss o boss. */
  readonly boss: boolean;
  readonly x: number;
  readonly y: number;
  /** rad: hacia dónde avanza. */
  readonly heading: number;
  /** u recorridas desde el vórtice. */
  readonly distance: number;
  /** 0…1 del camino. */
  readonly progress: number;
  /** u a un lado de la línea central (fijo para cada enemigo). */
  readonly laneOffset: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly radius: number;
  /** u/s por el camino. */
  readonly speed: number;
  /** s de aturdimiento que quedan (no avanza). */
  readonly stunS: number;
  /** s que le quedan ardiendo (Halloween) y lo que le quita por segundo. */
  readonly burnS: number;
  readonly burnDps: number;
  /** s desde que salió del vórtice (la vista hace el efecto de salida). */
  readonly ageS: number;
  readonly dead: boolean;
}

/**
 * El último disparo o efecto de una torre, para la vista y el sonido. Un
 * objeto nuevo por disparo (la partida avisa con `towerShot`), salvo el haz
 * del Faro, que es continuo: el mismo objeto se pone al día en cada paso.
 *
 * - Faro: `angle` (el primer haz; los demás a ángulos iguales), `radius` =
 *   alcance, `targetIds` = lo que tocan ahora.
 * - Nochevieja: `targetIds` = [el blanco], `x, y` = donde le dio.
 * - Halloween: `angle` y `radius` del cono, `targetIds` = lo que quemó.
 * - Puerto: al lanzar, `flightS` (cae a los `atS + flightS`), `x, y` y
 *   `radius` del estallido, `targetIds` = [al que apunta]; al estallar, otro
 *   sin `flightS` con `targetIds` = lo que alcanzó.
 * - Ibiza: `amount` = monedas, sin blancos.
 * - Isla del Sonido: `x, y`, `radius` de la onda, `targetIds` = lo que tocó.
 * - Benidorm: `targetIds` = [el blanco], `x, y` = donde le dio, `angle`.
 */
export interface TowerShotView {
  /** s de tiempo activo del disparo. */
  atS: number;
  /** A quién (ids de enemigo), si a alguien. */
  targetIds: readonly number[];
  /** Punto y radio del efecto, si lo tiene (estallido, onda). */
  x?: number;
  y?: number;
  radius?: number;
  /** rad del haz o del cono, si lo tiene. */
  angle?: number;
  /** s del lanzamiento al estallido (mortero). */
  flightS?: number;
  /** Daño a cada blanco, o monedas de la granja. */
  amount?: number;
}

/** Una isla construida. `data` es libre para el tipo (enfriamientos, ángulo del haz…). */
export interface DefenseTowerState {
  readonly id: number;
  readonly kind: DefenseTowerKind;
  readonly x: number;
  readonly y: number;
  /** 1…3. */
  level: number;
  /** A quién apunta (decisión 12 del plan 015); null en las que no eligen blanco. */
  priority: DefenseTargetPriority | null;
  /** Monedas gastadas en ella (construir y mejorar): vender devuelve una parte. */
  spent: number;
  /** Los blancos de este paso (lo que devolvió `targets`). */
  targets: readonly DefenseEnemyView[];
  lastShot: TowerShotView | null;
  data: Record<string, number>;
}

/** De dónde sale un daño o unas monedas (la tarjeta final y las pruebas lo cuentan). */
export type DefenseSource = 'plane' | 'tower';

/** Lo que una torre puede leer y hacer en su paso. */
export interface DefenseTowerContext {
  /** s de tiempo activo. */
  readonly activeS: number;
  readonly config: DefenseConfig;
  /** Los enemigos vivos, en orden de salida del vórtice. */
  readonly enemies: readonly DefenseEnemyView[];
  readonly path: DefensePath;
  /** El azar de la partida (determinista por semilla). */
  rng(): number;
  /** Los vivos con el borde a menos de `r` de (x, y). */
  enemiesInRange(x: number, y: number, r: number): DefenseEnemyView[];
  /** Quita aguante; true si lo mata (las monedas y los puntos van solos). */
  damageEnemy(
    enemy: DefenseEnemyView,
    amount: number,
    source: DefenseSource,
    towerId?: number,
  ): boolean;
  /** Lo deja quieto `seconds` s (no se suma: se queda el mayor). */
  stunEnemy(enemy: DefenseEnemyView, seconds: number): void;
  /**
   * Lo deja ardiendo `seconds` s a `dps` por segundo (no se suma: se quedan
   * el mayor tiempo y el mayor daño). Si muere quemado, la caída es de la torre.
   */
  burnEnemy(enemy: DefenseEnemyView, dps: number, seconds: number, towerId?: number): void;
  /** Monedas al monedero (la granja de Ibiza). */
  addCoins(amount: number, towerId?: number): void;
  /**
   * El puesto de una Ibiza entre las que están en pie, por orden de
   * construcción (0 = la primera): decide qué parte de su pago da (plan 016).
   */
  farmRank(tower: DefenseTowerState): number;
}

export interface DefenseTowerHooks {
  /** A quién apunta la torre ahora (en alcance, por su criterio). */
  targets(tower: DefenseTowerState, ctx: DefenseTowerContext): readonly DefenseEnemyView[];
  /** Un paso activo de la torre, con los blancos que dio `targets`. */
  onTick(tower: DefenseTowerState, ctx: DefenseTowerContext, dt: number): void;
}

// --- Las siete islas (T159, decisión 9) ----------------------------------------

const TIER_RANK = { common: 0, miniboss: 1, boss: 2 } as const;

/** El más adelantado por el camino (el que antes llegaría al castillo). */
function mostAdvanced(list: readonly DefenseEnemyView[]): DefenseEnemyView | null {
  let best: DefenseEnemyView | null = null;
  for (const e of list) if (!best || e.distance > best.distance) best = e;
  return best;
}

/** El más atrasado por el camino (el último en salir que sigue vivo). */
function leastAdvanced(list: readonly DefenseEnemyView[]): DefenseEnemyView | null {
  let best: DefenseEnemyView | null = null;
  for (const e of list) if (!best || e.distance < best.distance) best = e;
  return best;
}

/** El más cercano a (x, y) por su borde; a la par, el más adelantado. */
function closestTo(
  list: readonly DefenseEnemyView[],
  x: number,
  y: number,
): DefenseEnemyView | null {
  let best: DefenseEnemyView | null = null;
  let bestD = Infinity;
  for (const e of list) {
    const d = Math.hypot(e.x - x, e.y - y) - e.radius;
    if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && best && e.distance > best.distance)) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

/**
 * El blanco de una isla según su prioridad (decisión 12 del plan 015): el
 * primero por el camino, el último, el más fuerte (`strongestEnemy`) o el
 * más cercano a la isla. Sin prioridad, el primero.
 */
export function pickTarget(
  list: readonly DefenseEnemyView[],
  priority: DefenseTargetPriority | null,
  from: { readonly x: number; readonly y: number },
): DefenseEnemyView | null {
  switch (priority) {
    case 'last':
      return leastAdvanced(list);
    case 'strongest':
      return strongestEnemy(list);
    case 'closest':
      return closestTo(list, from.x, from.y);
    default:
      return mostAdvanced(list);
  }
}

/** El más fuerte: bosses, luego minibosses; dentro, el de más aguante; luego el más adelantado. */
export function strongestEnemy(list: readonly DefenseEnemyView[]): DefenseEnemyView | null {
  let best: DefenseEnemyView | null = null;
  for (const e of list) {
    if (!best) {
      best = e;
      continue;
    }
    const dt = TIER_RANK[e.tier] - TIER_RANK[best.tier];
    if (
      dt > 0 ||
      (dt === 0 && (e.hp > best.hp || (e.hp === best.hp && e.distance > best.distance)))
    )
      best = e;
  }
  return best;
}

/**
 * Baja el enfriamiento `key` de la torre; true si está listo (y entonces lo
 * pone a `cooldownS`). Sin `fire`, sólo baja (espera a tener a quién).
 */
function cooldown(t: DefenseTowerState, dt: number, fire: boolean, cooldownS: number): boolean {
  const cd = Math.max(0, (t.data.cd ?? 0) - dt);
  if (cd > 1e-9 || !fire) {
    t.data.cd = cd;
    return false;
  }
  t.data.cd = cooldownS;
  return true;
}

/** Lo que está a su alcance (borde del enemigo a `range` del centro de la isla). */
function inRange(t: DefenseTowerState, ctx: DefenseTowerContext, range: number) {
  return ctx.enemiesInRange(t.x, t.y, range);
}

/** Faro: haces que giran sin parar y hieren cada paso lo que tocan. */
const faroHooks: DefenseTowerHooks = {
  targets(t, ctx) {
    const st = defenseTowerStats(ctx.config, 'faro', t.level);
    const base = t.data.angle ?? 0;
    const near = inRange(t, ctx, st.range);
    if (near.length === 0) return near;
    return near.filter((e) => {
      for (let k = 0; k < st.beams; k++) {
        const a = base + (k / st.beams) * Math.PI * 2;
        if (beamTouches(t.x, t.y, a, st.range, st.beamWidth, e.x, e.y, e.radius)) return true;
      }
      return false;
    });
  },
  onTick(t, ctx, dt) {
    const st = defenseTowerStats(ctx.config, 'faro', t.level);
    const angle = t.data.angle ?? 0;
    const ids: number[] = [];
    for (const e of t.targets) {
      ids.push(e.id);
      ctx.damageEnemy(e, st.damagePerS * dt, 'tower', t.id);
    }
    const shot = t.lastShot ?? { atS: 0, targetIds: [] };
    shot.atS = ctx.activeS;
    shot.targetIds = ids;
    shot.angle = angle;
    shot.radius = st.range;
    shot.amount = st.damagePerS;
    t.lastShot = shot;
    t.data.angle = wrapAngle(angle + st.sweepRadPerS * dt);
  },
};

/** Nochevieja: una bola de nieve cada `cooldownS` que aturde; cada vez a otro si lo hay. */
const ultimaHooks: DefenseTowerHooks = {
  targets(t, ctx) {
    const st = defenseTowerStats(ctx.config, 'ultima', t.level);
    const near = inRange(t, ctx, st.range);
    const last = t.data.lastTarget;
    const others = last === undefined ? near : near.filter((e) => e.id !== last);
    const pick = pickTarget(others.length > 0 ? others : near, t.priority, t);
    return pick ? [pick] : [];
  },
  onTick(t, ctx, dt) {
    const st = defenseTowerStats(ctx.config, 'ultima', t.level);
    const e = t.targets[0];
    if (!cooldown(t, dt, !!e, st.cooldownS) || !e) return;
    const x = e.x;
    const y = e.y;
    ctx.damageEnemy(e, st.damage, 'tower', t.id);
    ctx.stunEnemy(e, e.boss ? st.stunS * ctx.config.towers.bossStunScale : st.stunS);
    t.data.lastTarget = e.id;
    t.lastShot = { atS: ctx.activeS, targetIds: [e.id], x, y, amount: st.damage };
  },
};

/**
 * Halloween: una bocanada en cono hacia su blanco (por su prioridad; de
 * serie, el más adelantado); lo que toca queda ardiendo.
 */
const halloweenHooks: DefenseTowerHooks = {
  targets(t, ctx) {
    const st = defenseTowerStats(ctx.config, 'halloween', t.level);
    const near = inRange(t, ctx, st.range);
    const aim = pickTarget(near, t.priority, t);
    if (!aim) return [];
    const angle = Math.atan2(aim.y - t.y, aim.x - t.x);
    t.data.aim = angle;
    return near.filter((e) =>
      coneTouches(t.x, t.y, angle, st.range, st.coneRad, e.x, e.y, e.radius),
    );
  },
  onTick(t, ctx, dt) {
    const st = defenseTowerStats(ctx.config, 'halloween', t.level);
    if (!cooldown(t, dt, t.targets.length > 0, st.cooldownS)) return;
    const ids: number[] = [];
    for (const e of t.targets) {
      ids.push(e.id);
      ctx.burnEnemy(e, st.burnDps, st.burnS, t.id);
      ctx.damageEnemy(e, st.damage, 'tower', t.id);
    }
    t.lastShot = {
      atS: ctx.activeS,
      targetIds: ids,
      angle: t.data.aim ?? 0,
      radius: st.range,
      amount: st.damage,
    };
  },
};

/**
 * Puerto: un cohete al sitio donde estará su blanco (por su prioridad; de
 * serie, el más adelantado) al caer (`flightS` después) y un estallido que hiere todo lo que pille en
 * `blastRadius`. Un cohete en el aire a la vez.
 */
const calaHooks: DefenseTowerHooks = {
  targets(t, ctx) {
    const st = defenseTowerStats(ctx.config, 'cala', t.level);
    const pick = pickTarget(inRange(t, ctx, st.range), t.priority, t);
    return pick ? [pick] : [];
  },
  onTick(t, ctx, dt) {
    const st = defenseTowerStats(ctx.config, 'cala', t.level);
    const flying = t.data.shellT ?? 0;
    if (flying > 0) {
      const left = flying - dt;
      t.data.shellT = Math.max(0, left);
      if (left <= 1e-9) {
        const x = t.data.shellX ?? t.x;
        const y = t.data.shellY ?? t.y;
        const r = t.data.shellR ?? st.blastRadius;
        const dmg = t.data.shellDmg ?? st.damage;
        const hit = ctx.enemiesInRange(x, y, r);
        for (const e of hit) ctx.damageEnemy(e, dmg, 'tower', t.id);
        t.lastShot = {
          atS: ctx.activeS,
          targetIds: hit.map((e) => e.id),
          x,
          y,
          radius: r,
          amount: dmg,
        };
      }
    }
    const e = t.targets[0];
    if (!cooldown(t, dt, !!e && (t.data.shellT ?? 0) <= 0, st.cooldownS) || !e) return;
    // Donde estará al caer (si no está aturdido), en su carril.
    const ahead = Math.max(0, st.flightS - e.stunS) * e.speed;
    const s = ctx.path.sampleAt(e.distance + ahead);
    const off = e.distance + ahead >= ctx.path.length ? 0 : e.laneOffset;
    const x = s.x + s.nx * off;
    const y = s.y + s.ny * off;
    t.data.shellT = st.flightS;
    t.data.shellX = x;
    t.data.shellY = y;
    t.data.shellR = st.blastRadius;
    t.data.shellDmg = st.damage;
    t.lastShot = {
      atS: ctx.activeS,
      targetIds: [e.id],
      x,
      y,
      radius: st.blastRadius,
      flightS: st.flightS,
      amount: st.damage,
    };
  },
};

/** Ibiza: granja; monedas cada `cooldownS` (su parte según el puesto), sin atacar. */
const tiendaHooks: DefenseTowerHooks = {
  targets: () => [],
  onTick(t, ctx, dt) {
    const st = defenseTowerStats(ctx.config, 'tienda', t.level);
    const acc = (t.data.farmT ?? 0) + dt;
    if (acc + 1e-9 < st.cooldownS) {
      t.data.farmT = acc;
      return;
    }
    t.data.farmT = acc - st.cooldownS;
    // La primera paga entera; las demás, su parte (`towers.farm.shares`).
    const coins = defenseFarmPayout(ctx.config, t.level, ctx.farmRank(t));
    ctx.addCoins(coins, t.id);
    t.lastShot = { atS: ctx.activeS, targetIds: [], x: t.x, y: t.y, amount: coins };
  },
};

/** Isla del Sonido: cada `cooldownS`, una onda de graves a todo lo que tiene alrededor. */
const alldayHooks: DefenseTowerHooks = {
  targets(t, ctx) {
    return inRange(t, ctx, defenseTowerStats(ctx.config, 'allday', t.level).range);
  },
  onTick(t, ctx, dt) {
    const st = defenseTowerStats(ctx.config, 'allday', t.level);
    if (!cooldown(t, dt, t.targets.length > 0, st.cooldownS)) return;
    const ids: number[] = [];
    for (const e of t.targets) {
      ids.push(e.id);
      ctx.damageEnemy(e, st.damage, 'tower', t.id);
    }
    t.lastShot = {
      atS: ctx.activeS,
      targetIds: ids,
      x: t.x,
      y: t.y,
      radius: st.range,
      amount: st.damage,
    };
  },
};

/**
 * Benidorm: francotirador; un tiro lento y fuerte a su blanco (por su
 * prioridad; de serie, el más fuerte).
 */
const fotosHooks: DefenseTowerHooks = {
  targets(t, ctx) {
    const st = defenseTowerStats(ctx.config, 'fotos', t.level);
    const pick = pickTarget(inRange(t, ctx, st.range), t.priority ?? 'strongest', t);
    return pick ? [pick] : [];
  },
  onTick(t, ctx, dt) {
    const st = defenseTowerStats(ctx.config, 'fotos', t.level);
    const e = t.targets[0];
    if (!cooldown(t, dt, !!e, st.cooldownS) || !e) return;
    const x = e.x;
    const y = e.y;
    ctx.damageEnemy(e, st.damage, 'tower', t.id);
    t.lastShot = {
      atS: ctx.activeS,
      targetIds: [e.id],
      x,
      y,
      angle: Math.atan2(y - t.y, x - t.x),
      amount: st.damage,
    };
  },
};

/** Lo que hace cada tipo de isla (decisión 9). */
export const DEFENSE_TOWER_HOOKS: Partial<Record<DefenseTowerKind, DefenseTowerHooks>> = {
  faro: faroHooks,
  ultima: ultimaHooks,
  halloween: halloweenHooks,
  cala: calaHooks,
  tienda: tiendaHooks,
  allday: alldayHooks,
  fotos: fotosHooks,
};
