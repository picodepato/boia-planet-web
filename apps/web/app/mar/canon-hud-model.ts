import type {
  CardOption,
  EndReason,
  LevelUpCard,
  SurvivorsSnapshot,
  SurvivorsStatus,
  UpgradeId,
} from '@boia/engine/survivors';
import type { RewardOutcome } from '@boia/engine/minigames';
import type { MessageKey } from '../../lib/i18n';

/**
 * Lo que la interfaz del Cañón (T118) enseña, sin React: la cuenta atrás,
 * el nivel y su barra, el agua a bordo, las cartas de nivel (y su teclado)
 * y la pantalla final. Los componentes de `canon-hud.tsx` sólo lo pintan.
 */

// --- Tiempo --------------------------------------------------------------------

/** «m:ss» de unos segundos (hacia arriba: la cuenta atrás llega a 0:00 justo al amanecer). */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds - 1e-6));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** «m:ss» de un tiempo jugado (hacia abajo: no se cuenta lo que no se jugó). */
export function formatPlayed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds + 1e-6));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// --- Barras --------------------------------------------------------------------

/** Una fracción 0…1 como porcentaje entero (acotado). */
export function percent(value: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(value)) return 0;
  return Math.round(Math.min(1, Math.max(0, value / max)) * 100);
}

/**
 * Cómo va el agua a bordo: `ok`, `alerta` desde la mitad y `peligro` desde
 * tres cuartos. Además del color, cada tramo cambia el dibujo de la barra
 * (REQ-AVE-039: un patrón además del color).
 */
export type WaterLevel = 'ok' | 'alerta' | 'peligro';
export const WATER_ALERT = 50;
export const WATER_DANGER = 75;

export function waterLevelOf(pct: number): WaterLevel {
  if (pct >= WATER_DANGER) return 'peligro';
  if (pct >= WATER_ALERT) return 'alerta';
  return 'ok';
}

// --- Lo que pinta el HUD -------------------------------------------------------

export interface CanonView {
  status: SurvivorsStatus;
  /** s que faltan para amanecer (enteros, hacia arriba). */
  timeLeftS: number;
  level: number;
  /** % de la barra de experiencia hacia el nivel siguiente. */
  xpPct: number;
  /** % de agua a bordo. */
  waterPct: number;
  /** El agua con que el barco se inunda (la de la config). */
  waterCapacity: number;
  /** La carta de nivel abierta (la misma mientras siga abierta), o null. */
  card: LevelUpCard | null;
}

/** El HUD desde el estado de la partida (se lee varias veces por segundo). */
export function canonView(s: SurvivorsSnapshot): CanonView {
  return {
    status: s.status,
    timeLeftS: Math.max(0, Math.ceil(s.timeLeftS - 1e-6)),
    level: s.xp.level,
    xpPct: percent(s.xp.xp, s.xp.toNext),
    waterPct: percent(s.water.level, s.water.capacity),
    waterCapacity: s.water.capacity,
    card: s.card,
  };
}

/** ¿Cambia lo que se ve? (para no volver a pintar sin motivo). */
export function sameView(a: CanonView | null, b: CanonView | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.status === b.status &&
    a.timeLeftS === b.timeLeftS &&
    a.level === b.level &&
    a.xpPct === b.xpPct &&
    a.waterPct === b.waterPct &&
    a.waterCapacity === b.waterCapacity &&
    a.card === b.card
  );
}

// --- Cartas de nivel -----------------------------------------------------------

/** El icono de cada mejora en su carta. */
export const UPGRADE_ICON: Readonly<Record<UpgradeId, string>> = {
  damage: '💥',
  fireRate: '⏩',
  projectiles: '🔱',
  speed: '⛵',
  magnet: '🧲',
  bailing: '🪣',
};

/**
 * Lo que da una opción, en número para su texto: los `…Bonus` son
 * fracciones (`0.25` = «+25 %»); las bolas por disparo y el achique por
 * segundo van tal cual.
 */
export function cardAmount(option: Pick<CardOption, 'stat' | 'amount'>): number {
  if (option.stat === 'extraProjectiles' || option.stat === 'bailPerS') {
    return Math.round(option.amount * 100) / 100;
  }
  return Math.round(option.amount * 100);
}

/** Las claves de una opción: su nombre (la de la config) y lo que da (`…efecto`). */
export function cardKeys(option: Pick<CardOption, 'i18nKey'>): {
  title: MessageKey;
  effect: MessageKey;
} {
  return {
    title: option.i18nKey as MessageKey,
    effect: `${option.i18nKey}.efecto` as MessageKey,
  };
}

/**
 * Las teclas de las cartas (T118): flechas para moverse entre ellas (dan la
 * vuelta), un número para ir a la suya, e Intro o espacio para elegir la que
 * tiene el foco. `null`: la tecla no es de las cartas (Escape abre el menú).
 */
export type CardKeyAction = { kind: 'focus'; index: number } | { kind: 'choose'; index: number };

export function cardKeyAction(key: string, focused: number, count: number): CardKeyAction | null {
  if (count <= 0) return null;
  const at = Math.min(count - 1, Math.max(0, focused));
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      return { kind: 'focus', index: (at - 1 + count) % count };
    case 'ArrowRight':
    case 'ArrowDown':
      return { kind: 'focus', index: (at + 1) % count };
    case 'Home':
      return { kind: 'focus', index: 0 };
    case 'End':
      return { kind: 'focus', index: count - 1 };
    case 'Enter':
    case ' ':
    case 'Spacebar':
      return { kind: 'choose', index: at };
  }
  if (/^[1-9]$/.test(key)) {
    const n = Number(key) - 1;
    return n < count ? { kind: 'focus', index: n } : null;
  }
  return null;
}

/**
 * Tras abrirse una carta, un momento en que no se puede elegir (ms): quien
 * venía gobernando con el dedo o con Intro no elige sin querer.
 */
export const CARD_ARM_MS = 350;

// --- Final ---------------------------------------------------------------------

/** Las razones con pantalla final (el abandono sólo deja un aviso corto). */
export type CanonEndReason = Exclude<EndReason, 'abandoned'>;

export interface CanonResult {
  reason: CanonEndReason;
  /** s de tiempo activo jugado. */
  playedS: number;
  defeated: number;
  notes: number;
  level: number;
}

/** El resumen de la pantalla final, o null si la partida no la tiene (abandono). */
export function canonResult(reason: EndReason, s: SurvivorsSnapshot): CanonResult | null {
  if (reason === 'abandoned') return null;
  return {
    reason,
    playedS: s.activeS,
    defeated: s.defeated,
    notes: s.notesPicked,
    level: s.xp.level,
  };
}

/** Los textos de la pantalla final según cómo acabó. */
export const END_KEYS: Readonly<Record<CanonEndReason, { title: MessageKey; line: MessageKey }>> = {
  survived: { title: 'mar.canon.fin.amanece', line: 'mar.canon.fin.amanece.texto' },
  flooded: { title: 'mar.canon.fin.inundado', line: 'mar.canon.fin.inundado.texto' },
};

// --- Premio (T119) ---------------------------------------------------------------

/**
 * El premio de la partida, para la pantalla final y las pruebas: `pending`
 * mientras se liquida la sesión; después, `granted` o el motivo de que no
 * (`not_won`, `duplicate`, `abandoned`, `implausible_duration`…).
 */
export type CanonPrize =
  'pending' | 'granted' | Exclude<RewardOutcome, { granted: true }>['reason'];

export function canonPrize(reward: RewardOutcome | null): CanonPrize {
  if (!reward) return 'pending';
  return reward.granted ? 'granted' : reward.reason;
}

/**
 * La línea del premio en la pantalla final, o null si no hay nada que decir
 * (aún liquidándose, o la partida no se ganó: el final ya lo dice).
 */
export function prizeLine(
  reward: RewardOutcome | null,
): { key: MessageKey; params?: Record<string, number> } | null {
  if (!reward) return null;
  if (reward.granted) {
    return {
      key: 'mar.canon.premio.ganado',
      params: { puntos: reward.points, monedas: reward.coins },
    };
  }
  if (reward.reason === 'not_won') return null;
  if (reward.reason === 'duplicate') return { key: 'mar.canon.premio.repetido' };
  return { key: 'mar.canon.premio.no' };
}
