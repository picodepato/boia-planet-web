import { type BossId, SURVIVORS_CONFIG, type SurvivorsConfig, actOf } from './config';
import type { EndReason } from './sim';

/**
 * Las medallas de una partida (§8 del diseño de referencia, T144), como en
 * la carrera:
 *
 * - **bronce**: llegar al amanecer (7:00; el boss final, si sigue vivo, se retira);
 * - **plata**: llegar al amanecer y haber vencido a los minibosses del acto;
 * - **oro**: vencer al boss final del acto (la partida acaba en ese momento, `victory`).
 *
 * Inundarse o abandonar no da medalla. El `won` de la sesión del minijuego
 * es bronce o más (decisión 7 del plan 012): `medalWon`.
 */

export type SurvivorsMedal = 'bronce' | 'plata' | 'oro';

/** Las medallas, de menos a más. */
export const MEDALS: readonly SurvivorsMedal[] = ['bronce', 'plata', 'oro'];

/** Lo que hace falta de una partida para su medalla (cabe un `SurvivorsSnapshot`). */
export interface MedalInput {
  readonly end: EndReason | null;
  readonly bossesDefeated: readonly BossId[];
  /** El acto jugado (sin valor, el 1). */
  readonly act?: number;
}

/** Los minibosses del guion del acto `act`: sus huecos encendidos cuyo boss existe, en orden. */
export function actMinibosses(act: number, cfg: SurvivorsConfig = SURVIVORS_CONFIG): BossId[] {
  const script = actOf(cfg, act);
  if (!script) return [];
  return script.events
    .filter((ev) => ev.type === 'miniboss' && ev.enabled !== false && cfg.bosses[ev.ref as BossId])
    .map((ev) => ev.ref as BossId);
}

/** El boss final del guion del acto `act` (su hueco encendido), o null. */
export function actFinalBoss(act: number, cfg: SurvivorsConfig = SURVIVORS_CONFIG): BossId | null {
  const ev = actOf(cfg, act)?.events.find(
    (e) => e.type === 'boss' && e.enabled !== false && cfg.bosses[e.ref as BossId],
  );
  return ev ? (ev.ref as BossId) : null;
}

/**
 * La medalla de una partida acabada, o null (inundada, abandonada o sin
 * acabar). La plata pide todos los minibosses del acto (un acto sin
 * minibosses no la da: sólo bronce u oro).
 */
export function survivorsMedal(r: MedalInput, cfg: SurvivorsConfig = SURVIVORS_CONFIG): SurvivorsMedal | null {
  if (r.end === 'victory') return 'oro';
  if (r.end !== 'survived') return null;
  const minis = actMinibosses(r.act ?? 1, cfg);
  const beaten = new Set(r.bossesDefeated);
  return minis.length > 0 && minis.every((id) => beaten.has(id)) ? 'plata' : 'bronce';
}

/** ¿Cuenta como ganada (`won`)? Bronce o más. */
export function medalWon(medal: SurvivorsMedal | null): boolean {
  return medal !== null;
}
