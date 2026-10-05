import type { BossDef } from './config';

/** El Vecino Quejica (T138). Todo muestra; usa fases y ondas del sistema T137. */
export const VECINO: BossDef = {
  id: 'vecino',
  kind: 'miniboss',
  i18nKey: 'survivors.boss.vecino',
  // T147: 750 → 1200 (caía en ~10 s).
  hp: 1200,
  radius: 38,
  speed: 125,
  acceleration: 180,
  contactWater: 12,
  ignoresIslands: false,
  noteValue: 60,
  chest: true,
  attacks: {
    onda: {
      kind: 'ring',
      telegraphS: 1.4,
      activeS: 1.8,
      water: 16,
      radius: 440,
      thickness: 22,
      gaps: 3,
      gapRad: 0.65,
      length: 0,
      speed: 0,
      count: 0,
      spread: 0,
      blockedByIslands: true,
      invulnerable: false,
      still: true,
    },
    bronca: {
      kind: 'ring',
      telegraphS: 1.2,
      activeS: 1.6,
      water: 20,
      radius: 480,
      thickness: 26,
      gaps: 3,
      gapRad: 0.55,
      length: 0,
      speed: 0,
      count: 0,
      spread: 0,
      blockedByIslands: true,
      invulnerable: false,
      still: true,
    },
  },
  phases: [
    {
      untilHpFraction: 0.5,
      untilS: 0,
      movement: 'chase',
      standoff: 270,
      speedScale: 1,
      invulnerable: false,
      attacks: ['onda'],
      attackEveryS: 3,
      firstAttackS: 3,
    },
    {
      untilHpFraction: 0,
      untilS: 0,
      movement: 'orbit',
      standoff: 250,
      speedScale: 1.15,
      invulnerable: false,
      attacks: ['bronca', 'onda'],
      attackEveryS: 1.8,
      firstAttackS: 1.5,
    },
  ],
};

/** Obstáculo circular relativo al origen fijo de la onda (la copia más cercana). */
export interface RingObstacle {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}
export interface RingArc {
  from: number;
  to: number;
}

/**
 * Arcos visibles exactos: resta los huecos y la sombra radial de las islas.
 * La sombra empieza cuando el frente llega a la isla y persiste detrás de ella.
 * Sólo geometría pura; el daño sigue usando el tramo boss → barco de T137.
 */
export function vecinoRingArcs(
  radius: number,
  gaps: number,
  gapRad: number,
  gapPhase: number,
  obstacles: readonly RingObstacle[] = [],
): RingArc[] {
  const tau = Math.PI * 2;
  let arcs: RingArc[] = [{ from: 0, to: tau }];
  const cut = (centre: number, half: number) => {
    if (half >= Math.PI) {
      arcs = [];
      return;
    }
    const angle = ((centre % tau) + tau) % tau;
    for (const shift of [-tau, 0, tau]) {
      const lo = angle + shift - half;
      const hi = angle + shift + half;
      const next: RingArc[] = [];
      for (const arc of arcs) {
        if (hi <= arc.from || lo >= arc.to) next.push(arc);
        else {
          if (lo > arc.from) next.push({ from: arc.from, to: lo });
          if (hi < arc.to) next.push({ from: hi, to: arc.to });
        }
      }
      arcs = next;
    }
  };
  for (let k = 0; k < gaps; k++) cut(gapPhase + (k * tau) / gaps, gapRad / 2);
  for (const o of obstacles) {
    const d = Math.hypot(o.x, o.y);
    if (d <= o.radius) return [];
    if (radius <= d - o.radius) continue;
    const tangent = Math.sqrt(d * d - o.radius * o.radius);
    const half =
      radius >= tangent
        ? Math.asin(o.radius / d)
        : Math.acos(
            Math.min(
              1,
              Math.max(-1, (d * d + radius * radius - o.radius * o.radius) / (2 * d * radius)),
            ),
          );
    cut(Math.atan2(o.y, o.x), half);
  }
  return arcs;
}
