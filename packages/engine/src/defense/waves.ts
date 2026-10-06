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

/** El principio (s del calendario) de cada oleada común, por su número. */
export function defenseWaveStarts(schedule: readonly DefenseSpawn[]): number[] {
  const out: number[] = [];
  for (const s of schedule) {
    if (s.wave < 0) continue;
    const at = out[s.wave];
    if (at === undefined || s.atS < at) out[s.wave] = s.atS;
  }
  return out;
}

/** Lo que trae la oleada siguiente (el aviso del HUD: decisión 10 del plan 015). */
export interface DefenseWaveInfo {
  /** Número de la oleada (0…). */
  readonly wave: number;
  /** s del calendario a las que empieza. */
  readonly startS: number;
  /** s de partida que faltan para que empiece. */
  readonly inS: number;
  /** Cuántos de cada tipo, en el orden en que salen (los bosses, con `boss`). */
  readonly kinds: readonly {
    readonly kind: DefenseEnemyKind;
    readonly count: number;
    readonly boss: boolean;
  }[];
  readonly count: number;
  /** ¿Trae un miniboss o un boss? */
  readonly boss: boolean;
}

/**
 * La oleada siguiente con el reloj del calendario en `waveS` y lo que falta
 * por salir desde `fromIndex`: la primera oleada común que aún no ha
 * empezado, con sus comunes y los bosses que salen antes de la que la sigue.
 * null si no quedan oleadas.
 */
export function defenseNextWave(
  schedule: readonly DefenseSpawn[],
  starts: readonly number[],
  fromIndex: number,
  waveS: number,
): DefenseWaveInfo | null {
  const eps = 1e-9;
  let wave = -1;
  for (let w = 0; w < starts.length; w++) {
    const at = starts[w];
    if (at !== undefined && at > waveS + eps) {
      wave = w;
      break;
    }
  }
  if (wave < 0) return null;
  const startS = starts[wave]!;
  const nextStart = starts[wave + 1] ?? Infinity;
  const counts = new Map<
    DefenseEnemyKind,
    { kind: DefenseEnemyKind; count: number; boss: boolean }
  >();
  let count = 0;
  let boss = false;
  for (let i = Math.max(0, fromIndex); i < schedule.length; i++) {
    const s = schedule[i]!;
    if (s.wave !== wave && !(s.boss && s.atS < nextStart - eps)) continue;
    const c = counts.get(s.kind) ?? { kind: s.kind, count: 0, boss: s.boss };
    c.count++;
    counts.set(s.kind, c);
    count++;
    if (s.boss) boss = true;
  }
  return {
    wave,
    startS,
    inS: Math.max(0, startS - waveS),
    kinds: [...counts.values()],
    count,
    boss,
  };
}
