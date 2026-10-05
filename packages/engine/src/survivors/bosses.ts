import type { BossAttackDef, BossDef, BossPhase } from './config';
import { validateGhostShip } from './fantasma';
import { validateKraken } from './kraken';

/**
 * Las reglas puras del sistema genérico de bosses (§7, T137): la máquina de
 * fases y la geometría de los avisos, sin estado. La simulación (`sim.ts`,
 * sección «Bosses») las usa paso a paso; las pruebas las miran solas.
 */

const TWO_PI = Math.PI * 2;

/** Ángulo llevado a [0, 2π). */
export function normAngle(a: number): number {
  return ((a % TWO_PI) + TWO_PI) % TWO_PI;
}

/**
 * ¿Cae `angle` en uno de los `gaps` huecos de un anillo? Los huecos están
 * a ángulos iguales desde `gapPhase`, cada uno de `gapRad` rad de ancho.
 */
export function inRingGap(angle: number, gaps: number, gapRad: number, gapPhase: number): boolean {
  if (gaps <= 0 || gapRad <= 0) return false;
  const pitch = TWO_PI / gaps;
  const rel = normAngle(angle - gapPhase);
  const toCentre = Math.abs(rel - Math.round(rel / pitch) * pitch);
  return toCentre < gapRad / 2;
}

/** El radio de la onda de un `ring` cuando lleva `progress` (0→1) del golpe. */
export function ringRadiusAt(attack: BossAttackDef, progress: number): number {
  return attack.radius * Math.min(1, Math.max(0, progress));
}

/**
 * ¿La onda de radio `ringRadius` y grosor `thickness` pasa por encima de un
 * círculo de radio `r` a distancia `dist` del centro?
 */
export function ringTouches(ringRadius: number, thickness: number, dist: number, r: number): boolean {
  return Math.abs(dist - ringRadius) <= thickness / 2 + r;
}

/**
 * La fase a la que pasa el boss desde `index`, o null si se queda: por vida
 * (`untilHpFraction` > 0 y la fracción no la pasa) o por tiempo (`untilS` >
 * 0 y la fase lleva al menos esos s). Si las dos tocan, manda la vida. El
 * destino que apunte fuera de la lista no vale (se queda).
 */
export function nextPhase(def: BossDef, index: number, hpFraction: number, phaseS: number): number | null {
  const phase = def.phases[index];
  if (!phase) return null;
  const n = def.phases.length;
  const byHp = phase.untilHpFraction > 0 && hpFraction <= phase.untilHpFraction;
  const byTime = phase.untilS > 0 && phaseS >= phase.untilS - 1e-9;
  let next: number | null = null;
  if (byHp) next = phase.nextByHp ?? index + 1;
  else if (byTime) next = phase.nextByTime ?? index + 1;
  if (next === null || next === index || next < 0 || next >= n) return null;
  return next;
}

/** El ataque `k` (cíclico) de una fase; null si la fase no ataca. */
export function attackAt(def: BossDef, phase: BossPhase, k: number): { name: string; def: BossAttackDef } | null {
  return attackFrom(def, phase.attacks, k);
}

/** El ataque `k` (cíclico) de una lista de nombres; null si está vacía (el Fantasma cambia de lista por modo, T140). */
export function attackFrom(def: BossDef, names: readonly string[], k: number): { name: string; def: BossAttackDef } | null {
  if (names.length === 0) return null;
  const name = names[((k % names.length) + names.length) % names.length]!;
  const attack = def.attacks[name];
  return attack ? { name, def: attack } : null;
}

/**
 * Las fracciones de vida en que el boss cambia de fase por vida, de mayor a
 * menor (las marcas de la barra del HUD).
 */
export function phaseMarks(def: BossDef): number[] {
  const marks = def.phases.map((p) => p.untilHpFraction).filter((f) => f > 0 && f < 1);
  return [...new Set(marks)].sort((a, b) => b - a);
}

/** Comprueba que los datos de un boss son coherentes; devuelve los problemas (vacío si va bien). */
export function validateBoss(def: BossDef): string[] {
  const out: string[] = [];
  if (def.phases.length === 0) out.push(`${def.id}: sin fases`);
  if (!(def.hp > 0)) out.push(`${def.id}: hp`);
  if (!(def.radius > 0)) out.push(`${def.id}: radius`);
  def.phases.forEach((p, i) => {
    for (const a of p.attacks) if (!def.attacks[a]) out.push(`${def.id}: fase ${i} ataque ${a} no existe`);
    if (p.attacks.length > 0 && !(p.attackEveryS > 0)) out.push(`${def.id}: fase ${i} attackEveryS`);
    if (p.untilHpFraction === 0 && p.untilS === 0 && i < def.phases.length - 1) {
      out.push(`${def.id}: fase ${i} no sale nunca y no es la última`);
    }
    for (const n of [p.nextByHp, p.nextByTime]) {
      if (n !== undefined && (n < 0 || n >= def.phases.length)) out.push(`${def.id}: fase ${i} destino ${n}`);
    }
  });
  for (const [name, a] of Object.entries(def.attacks)) {
    if (a.kind !== 'summon' && !(a.telegraphS > 0)) out.push(`${def.id}: ${name} sin aviso`);
    if (!(a.activeS > 0)) out.push(`${def.id}: ${name} activeS`);
    if (a.kind === 'summon' && !a.summon) out.push(`${def.id}: ${name} sin summon`);
    if (a.kind === 'ring' && !(a.radius > 0 && a.thickness > 0)) out.push(`${def.id}: ${name} anillo`);
    if (a.kind === 'line' && !(a.length > 0 && a.speed > 0)) out.push(`${def.id}: ${name} embestida`);
    if (a.kind === 'circles' && !(a.count > 0 && a.radius > 0)) out.push(`${def.id}: ${name} círculos`);
    if (a.kind === 'broadside' && !(a.count > 0 && a.speed > 0 && a.length > 0)) out.push(`${def.id}: ${name} andanada`);
  }
  // El Kraken (T141) y el Fantasma (T140) traen sus propios números.
  out.push(...validateKraken(def));
  out.push(...validateGhostShip(def));
  return out;
}
