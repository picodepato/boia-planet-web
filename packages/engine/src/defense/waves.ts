import type { BossId, EnemyId } from '../survivors/config';
import type { DefenseConfig, DefenseEnemyKind, DefenseRunMin, DifficultyId } from './config';

/**
 * El calendario de una partida: qué sale del vórtice y cuándo (decisiones 6
 * y 10 del plan 014). Depende sólo de la duración y la dificultad, no de la
 * semilla: todos los de una tabla del ranking ven las mismas oleadas.
 *
 * - Una oleada cada `waves.everyS` s desde `firstAtS`, hasta `quietTailS`
 *   antes del final; la oleada n trae `baseCount + countPerWave·n` comunes
 *   (por la dificultad), saliendo de uno en uno cada `spacingS` (más juntos
 *   si no caben antes de la oleada siguiente).
 * - Los tipos entran en la mezcla a su fracción de la partida y se reparten
 *   por peso (turno ponderado, sin azar).
 * - Los minibosses y bosses de la duración, a su fracción (los gordos cerca
 *   del final).
 */

export interface DefenseSpawn {
  /** s de tiempo activo. */
  atS: number;
  kind: DefenseEnemyKind;
  boss: boolean;
  /** La oleada (0…); los bosses, −1. */
  wave: number;
}

export function defenseSchedule(
  cfg: DefenseConfig,
  runMin: DefenseRunMin,
  difficulty: DifficultyId,
): DefenseSpawn[] {
  const run = cfg.runs[runMin];
  const diff = cfg.difficulties[difficulty];
  const w = cfg.waves;
  const out: DefenseSpawn[] = [];
  const credit = new Map<EnemyId, number>();
  let wave = 0;
  for (let t = w.firstAtS; t <= run.durationS - w.quietTailS + 1e-9; t += w.everyS, wave++) {
    const frac = t / run.durationS;
    const pool = w.mix.filter((m) => m.fromFrac <= frac + 1e-9 && cfg.enemies[m.kind]);
    if (pool.length === 0) continue;
    const total = pool.reduce((s, m) => s + m.weight, 0);
    const count = Math.max(1, Math.round((w.baseCount + w.countPerWave * wave) * diff.enemyCount));
    // Una oleada no pisa a la siguiente: si no caben, salen más juntos.
    const spacing = Math.min(w.spacingS, w.everyS / count);
    for (let i = 0; i < count; i++) {
      // Turno ponderado: cada tipo suma su peso; sale el que más tiene y paga el total.
      let pick = pool[0]!;
      let best = -Infinity;
      for (const m of pool) {
        const c = (credit.get(m.kind) ?? 0) + m.weight;
        credit.set(m.kind, c);
        if (c > best) {
          best = c;
          pick = m;
        }
      }
      credit.set(pick.kind, best - total);
      out.push({ atS: t + i * spacing, kind: pick.kind, boss: false, wave });
    }
  }
  for (const b of run.bosses) {
    if (!cfg.bosses[b.kind]) continue;
    out.push({ atS: b.atFrac * run.durationS, kind: b.kind as BossId, boss: true, wave: -1 });
  }
  return out.sort((a, b) => a.atS - b.atS || Number(b.boss) - Number(a.boss));
}
