import type { BossDef, BossPhase, GhostShipDef } from './config';

/**
 * El Barco Pirata Fantasma (§7, T140): el boss final del acto 1, en la
 * simulación pura. Encima del sistema genérico (fases por vida, ataques
 * avisados, llamadas, movimiento por fase) sólo añade **el ciclo fantasma**:
 * a ratos es sólido (se le puede herir, dispara andanadas por los costados
 * y toca el casco) y a ratos fantasma (translúcido: nada lo daña, no toca y
 * sólo llama a su tripulación de piratas fantasma). La simulación
 * (`sim.ts`, sección «Bosses») lo lleva paso a paso con `stepGhostShip`,
 * pregunta `ghostInvulnerable` / `ghostSolid` y elige los ataques con
 * `ghostAttackPlan`; la pantalla lee `ghostShipView`.
 *
 * Las ventanas se leen bien: cada fase dice cuánto dura sólido (`solidS`) y
 * cuánto fantasma (`ghostS`); el cambio a fantasma espera a que acabe el
 * ataque en curso (ninguna andanada se corta a medias) y suelta un suceso
 * `fantasmaState` para la pantalla y el HUD.
 */
export type GhostMode = 'solid' | 'ghost';

export interface GhostShipState {
  readonly def: GhostShipDef;
  mode: GhostMode;
  /** s en el modo. */
  modeS: number;
  /** Veces que cambió de modo (para las pruebas y el hash). */
  changes: number;
}

/** El cuerpo del boss que el ciclo mira (la entidad de la simulación). */
export interface GhostShipBody {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly phase: number;
}

export interface GhostShipHost {
  emit(ev: GhostShipEvent): void;
}

/** Los sucesos propios del Fantasma (además de los genéricos de boss). `id` es el del boss. */
export type GhostShipEvent = { type: 'fantasmaState'; id: number; state: GhostMode; x: number; y: number };

/** El Fantasma para la pantalla: va en `BossView.fantasma`. */
export interface GhostShipView {
  readonly mode: GhostMode;
  /** 0→1 dentro del modo. */
  readonly progress: number;
  /** s que quedan del modo (sólido: hasta desvanecerse; fantasma: hasta volver). */
  readonly leftS: number;
  /**
   * 0 sólido → 1 fantasma, con la rampa de `fadeS` en cada cambio: la
   * pantalla no la usa para animar la opacidad (una opacidad fija por
   * material), pero el HUD puede avisar de que se va a desvanecer.
   */
  readonly ghostness: number;
}

export function createGhostShip(def: GhostShipDef): GhostShipState {
  return { def, mode: 'solid', modeS: 0, changes: 0 };
}

/** Los números de la fase `phase` (la última si se pasa). */
export function ghostPhase(def: GhostShipDef, phase: number): GhostShipDef['phases'][number] {
  return def.phases[Math.min(Math.max(0, phase), def.phases.length - 1)]!;
}

/** Fantasma: nada lo daña. */
export function ghostInvulnerable(g: GhostShipState): boolean {
  return g.mode === 'ghost';
}

/** Sólido: toca el casco y se le puede herir. */
export function ghostSolid(g: GhostShipState): boolean {
  return g.mode === 'solid';
}

/** Velocidad de ahora sobre la de la fase (fantasma, `ghostSpeedScale`). */
export function ghostSpeedScale(g: GhostShipState): number {
  return g.mode === 'ghost' ? g.def.ghostSpeedScale : 1;
}

/**
 * Los ataques que toca lanzar ahora y su cadencia: sólido, los de la fase;
 * fantasma, las llamadas de `ghostAttacks`.
 */
export function ghostAttackPlan(
  g: GhostShipState,
  phase: BossPhase,
): { attacks: readonly string[]; everyS: number; firstS: number } {
  if (g.mode === 'ghost') {
    return { attacks: g.def.ghostAttacks, everyS: g.def.ghostAttackEveryS, firstS: g.def.ghostFirstAttackS };
  }
  return { attacks: phase.attacks, everyS: phase.attackEveryS, firstS: phase.firstAttackS };
}

/**
 * Un paso del ciclo: sólido → fantasma al cumplir `solidS` (si no hay un
 * ataque en curso, `busy`), fantasma → sólido al cumplir `ghostS`. Devuelve
 * true si cambió de modo (la simulación reinicia entonces su reloj de ataque).
 */
export function stepGhostShip(g: GhostShipState, body: GhostShipBody, host: GhostShipHost, dt: number, busy: boolean): boolean {
  g.modeS += dt;
  const ph = ghostPhase(g.def, body.phase);
  if (g.mode === 'solid') {
    if (g.modeS < ph.solidS - 1e-9 || busy) return false;
    setMode(g, body, host, 'ghost');
    return true;
  }
  if (g.modeS < ph.ghostS - 1e-9) return false;
  setMode(g, body, host, 'solid');
  return true;
}

function setMode(g: GhostShipState, body: GhostShipBody, host: GhostShipHost, mode: GhostMode): void {
  g.mode = mode;
  g.modeS = 0;
  g.changes++;
  host.emit({ type: 'fantasmaState', id: body.id, state: mode, x: body.x, y: body.y });
}

export function ghostShipView(g: GhostShipState, body: GhostShipBody): GhostShipView {
  const ph = ghostPhase(g.def, body.phase);
  const total = g.mode === 'solid' ? ph.solidS : ph.ghostS;
  const progress = total > 0 ? Math.min(1, Math.max(0, g.modeS / total)) : 1;
  const leftS = Math.max(0, total - g.modeS);
  const fade = g.def.fadeS > 0 ? Math.min(1, g.modeS / g.def.fadeS) : 1;
  return {
    mode: g.mode,
    progress,
    leftS,
    ghostness: g.mode === 'ghost' ? fade : 1 - fade,
  };
}

/** Lo que entra en `stateHash`. */
export function ghostHash(g: GhostShipState): unknown[] {
  return [g.mode, g.modeS, g.changes];
}

/** Comprueba los datos del Fantasma de un boss; devuelve los problemas (vacío si va bien). */
export function validateGhostShip(def: BossDef): string[] {
  const f = def.fantasma;
  if (!f) return [];
  const out: string[] = [];
  if (!(f.fadeS >= 0)) out.push(`${def.id}: fantasma fadeS`);
  if (!(f.ghostSpeedScale > 0)) out.push(`${def.id}: fantasma ghostSpeedScale`);
  if (f.ghostAttacks.length > 0 && !(f.ghostAttackEveryS > 0)) out.push(`${def.id}: fantasma ghostAttackEveryS`);
  if (!(f.ghostFirstAttackS >= 0)) out.push(`${def.id}: fantasma ghostFirstAttackS`);
  for (const a of f.ghostAttacks) if (!def.attacks[a]) out.push(`${def.id}: fantasma ataque ${a} no existe`);
  if (f.phases.length !== def.phases.length) out.push(`${def.id}: fantasma.phases (${f.phases.length}) ≠ phases (${def.phases.length})`);
  f.phases.forEach((p, i) => {
    if (!(p.solidS > 0)) out.push(`${def.id}: fantasma fase ${i} solidS`);
    if (!(p.ghostS > 0)) out.push(`${def.id}: fantasma fase ${i} ghostS`);
  });
  return out;
}
