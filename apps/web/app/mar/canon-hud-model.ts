import {
  type BossId,
  type CardKind,
  type CardOption,
  type DifficultyId,
  type EndReason,
  type EvolutionId,
  type LevelUpCard,
  type PassiveId,
  type SurvivorsMedal,
  type SurvivorsSnapshot,
  type SurvivorsStatus,
  type UpgradeId,
  type WeaponId,
  survivorsMedal,
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
  /** La fila de armas y vinilos (T130), en texto para comparar sin más. */
  slotsKey: string;
  /** s que le quedan a la Llama del botín (T135), enteros hacia arriba; 0 apagada. */
  flameS: number;
  /** % que le queda a la Llama (para su barrita). */
  flamePct: number;
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
    slotsKey: slotsKey(s),
    flameS: s.flame ? Math.max(0, Math.ceil(s.flame.leftS - 1e-6)) : 0,
    flamePct: s.flame ? percent(s.flame.leftS, s.flame.durationS) : 0,
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
    a.card === b.card &&
    a.slotsKey === b.slotsKey &&
    a.flameS === b.flameS &&
    a.flamePct === b.flamePct
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

/** El icono de cada arma (T130; simple, como los de las mejoras). muestra */
export const WEAPON_ICON: Readonly<Record<WeaponId, string>> = {
  canon: '💦',
  subwoofer: '🔊',
  laser: '🔦',
  buoys: '🛟',
  confetti: '🎊',
  fireworks: '🧨',
  acidRain: '🌧️',
};

/** El icono de cada vinilo (T130). muestra */
export const VINYL_ICON: Readonly<Record<PassiveId, string>> = {
  techno: '⏩',
  reggaeton: '🔆',
  house: '🛡️',
  dnb: '⛵',
  disco: '🧲',
  chill: '🪣',
  hardstyle: '💥',
  pop: '⭐',
  rumba: '🔱',
};

/** El icono de cada evolución y del Salvavidas (T130). muestra */
export const EVOLUTION_ICON: Readonly<Record<EvolutionId, string>> = {
  drop: '🌊',
  soundWall: '🔈',
  laserShow: '🌈',
  discoBall: '🪩',
};
export const SALVAVIDAS_ICON = '🛟';
/** El aviso de la Llama del botín mientras dura (T135). */
export const FLAME_ICON = '🔥';
export const FALLBACK_ICON = '🪣';

/** Lo que una carta enseña, ya resuelto para pintarla (T130). */
export interface CardView {
  /** Único en la oferta: la clave de React y `data-carta`. */
  id: string;
  kind: CardKind;
  icon: string;
  title: MessageKey;
  effect: MessageKey;
  /** El nivel al que sube (1 = nueva) y el máximo, para los puntos. */
  level: number;
  maxLevel: number;
  /** Una carta nueva (arma, vinilo, Salvavidas, achique): lleva la etiqueta «Nueva». */
  fresh: boolean;
  /** Las evoluciones destacan. */
  evolution: boolean;
  /** La etiqueta de lo que es (arma, vinilo, evolución…), por clave. */
  tag: MessageKey;
}

const CARD_TAGS: Readonly<Record<CardKind, MessageKey>> = {
  'weapon-new': 'mar.canon.carta.tipo.arma',
  'weapon-level': 'mar.canon.carta.tipo.arma',
  'vinyl-new': 'mar.canon.carta.tipo.vinilo',
  'vinyl-level': 'mar.canon.carta.tipo.vinilo',
  evolution: 'mar.canon.carta.tipo.evolucion',
  salvavidas: 'mar.canon.carta.tipo.salvavidas',
  fallback: 'mar.canon.carta.tipo.achique',
};

/** El icono de una opción según lo que es (arma, vinilo, evolución…). */
export function cardIcon(o: Pick<CardOption, 'kind' | 'weaponId' | 'vinylId' | 'evolutionId'>): string {
  switch (o.kind) {
    case 'weapon-new':
    case 'weapon-level':
      return (o.weaponId && WEAPON_ICON[o.weaponId]) || '🎵';
    case 'vinyl-new':
    case 'vinyl-level':
      return (o.vinylId && VINYL_ICON[o.vinylId]) || '💿';
    case 'evolution':
      return (o.evolutionId && EVOLUTION_ICON[o.evolutionId]) || '✨';
    case 'salvavidas':
      return SALVAVIDAS_ICON;
    case 'fallback':
      return FALLBACK_ICON;
  }
}

/** Una opción de la carta de nivel, lista para pintar (T130). */
export function cardView(o: CardOption): CardView {
  const keys = cardKeys(o);
  return {
    id: o.id,
    kind: o.kind,
    icon: cardIcon(o),
    title: keys.title,
    effect: keys.effect,
    level: o.targetLevel,
    maxLevel: o.kind === 'evolution' ? 1 : o.maxStacks,
    fresh: o.kind === 'weapon-new' || o.kind === 'vinyl-new' || o.kind === 'salvavidas' || o.kind === 'fallback',
    evolution: o.kind === 'evolution',
    tag: CARD_TAGS[o.kind],
  };
}

// --- La fila de armas y vinilos (T130) -------------------------------------------

export interface SlotView {
  /** null: hueco libre. */
  id: string | null;
  icon: string;
  name: MessageKey | null;
  level: number;
  maxLevel: number;
  /** El arma evolucionada. */
  evolved: boolean;
}

export interface SlotsView {
  weapons: SlotView[];
  vinyls: SlotView[];
  salvavidas: boolean;
}

const emptySlot = (): SlotView => ({
  id: null,
  icon: '',
  name: null,
  level: 0,
  maxLevel: 0,
  evolved: false,
});

/** Cada fila con sus huecos libres hasta completar los que da la config. */
export function slotsView(s: Pick<SurvivorsSnapshot, 'weapons' | 'vinyls' | 'slots' | 'salvavidas'>): SlotsView {
  const fill = (items: SlotView[], count: number): SlotView[] => {
    const out = items.slice(0, Math.max(count, items.length));
    while (out.length < count) out.push(emptySlot());
    return out;
  };
  return {
    weapons: fill(
      s.weapons.map((w) => ({
        id: w.id,
        icon: w.evolutionId ? EVOLUTION_ICON[w.evolutionId] : WEAPON_ICON[w.id],
        name: w.nameKey as MessageKey,
        level: w.level,
        maxLevel: w.maxLevel,
        evolved: !!w.evolutionId,
      })),
      s.slots.weapons,
    ),
    vinyls: fill(
      s.vinyls.map((v) => ({
        id: v.id,
        icon: VINYL_ICON[v.id],
        name: v.nameKey as MessageKey,
        level: v.level,
        maxLevel: v.maxLevel,
        evolved: false,
      })),
      s.slots.vinyls,
    ),
    salvavidas: s.salvavidas === 'held',
  };
}

/** Lo que cambia en la fila, en una cadena (para no repintar sin motivo). */
export function slotsKey(s: Pick<SurvivorsSnapshot, 'weapons' | 'vinyls' | 'slots' | 'salvavidas'>): string {
  return [
    s.slots.weapons,
    s.slots.vinyls,
    s.salvavidas,
    s.weapons.map((w) => `${w.id}:${w.level}:${w.evolutionId ?? ''}`).join(','),
    s.vinyls.map((v) => `${v.id}:${v.level}`).join(','),
  ].join('|');
}

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
  /** La medalla (T144): bronce al amanecer, plata con los minibosses, oro con el boss final; null inundado. */
  medal: SurvivorsMedal | null;
  /** El acto y la dificultad jugados (T144). */
  act: number;
  difficulty: DifficultyId;
  /** Los bosses vencidos, en orden. */
  bosses: readonly BossId[];
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
    medal: survivorsMedal({ end: reason, bossesDefeated: s.bossesDefeated, act: s.act }),
    act: s.act,
    difficulty: s.difficulty,
    bosses: [...s.bossesDefeated],
  };
}

/** Los textos de la pantalla final según cómo acabó. */
export const END_KEYS: Readonly<Record<CanonEndReason, { title: MessageKey; line: MessageKey }>> = {
  survived: { title: 'mar.canon.fin.amanece', line: 'mar.canon.fin.amanece.texto' },
  flooded: { title: 'mar.canon.fin.inundado', line: 'mar.canon.fin.inundado.texto' },
  // El boss final del acto vencido (T140): el final especial; la medalla y la tarjeta, T144/T145.
  victory: { title: 'mar.canon.fin.victoria', line: 'mar.canon.fin.victoria.texto' },
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
  // Partida de prueba (atajo de desarrollo) en producción: sin premio (T121).
  if (reward.reason === 'test_start') return { key: 'mar.canon.premio.prueba' };
  return { key: 'mar.canon.premio.no' };
}
