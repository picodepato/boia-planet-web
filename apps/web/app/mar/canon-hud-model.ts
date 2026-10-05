import {
  type BossId,
  type CardKind,
  type CardOption,
  type DifficultyId,
  type DropId,
  type EndReason,
  type EvolutionId,
  type LevelUpCard,
  type PassiveId,
  type SurvivorsMedal,
  type SurvivorsSnapshot,
  type SurvivorsStatus,
  type UpgradeId,
  type WeaponId,
  SURVIVORS_CONFIG,
  actFinalBoss,
  survivorsMedal,
} from '@boia/engine/survivors';
import type { RewardOutcome } from '@boia/engine/minigames';
import type { MessageKey } from '../../lib/i18n';
import type { CanonIconName } from './canon-icons';

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

// --- Bosses (T143) -------------------------------------------------------------

/** Cuánto se queda el aviso de llegada / retirada / caída de un boss (ms). */
export const BOSS_BANNER_MS = 3500;
/** Más lejos que esto (u del mundo) un boss está casi seguro fuera de pantalla. */
export const BOSS_FAR_U = 420;

/** Qué le pasa al boss ahora, para enseñarlo en la barra (cosas que no reciben daño, T140/T141). */
export type BossBarState = 'normal' | 'ghost' | 'shielded' | 'submerged' | 'exposed';

export interface BossBarView {
  id: number;
  boss: BossId;
  kind: 'miniboss' | 'boss';
  nameKey: MessageKey;
  /** % de vida (0…100, entero) y los % donde cambia de fase (marcas en la barra). */
  hpPct: number;
  marks: readonly number[];
  phase: number;
  phaseCount: number;
  state: BossBarState;
  /** Dirección del boss respecto al barco, en grados (0 = derecha, 90 = abajo en pantalla) y si está lejos. */
  angleDeg: number;
  far: boolean;
}

/** Las marcas de fase de un boss: dónde su vida cruza de una fase a otra (por vida, sin la última). */
export function phaseMarks(boss: BossId): number[] {
  const def = SURVIVORS_CONFIG.bosses[boss];
  if (!def) return [];
  const out: number[] = [];
  for (const p of def.phases.slice(0, -1)) {
    const pct = Math.round(p.untilHpFraction * 100);
    if (pct > 0 && pct < 100 && !out.includes(pct)) out.push(pct);
  }
  return out.sort((a, b) => b - a);
}

/** El estado visible del boss: fantasma (invulnerable), sumergido o cabeza expuesta del Kraken, o escudado. */
export function bossBarState(b: SurvivorsSnapshot['bosses'][number]): BossBarState {
  if (b.fantasma) return b.fantasma.ghostness >= 0.5 ? 'ghost' : 'normal';
  if (b.kraken) return b.kraken.exposed ? 'exposed' : 'submerged';
  return b.invulnerable ? 'shielded' : 'normal';
}

/** La barra del boss que se enseña: el más importante (final antes que miniboss), o null. */
export function bossBarView(s: SurvivorsSnapshot): BossBarView | null {
  if (!s.bosses.length) return null;
  const b = s.bosses.find((x) => x.kind === 'boss') ?? s.bosses[0]!;
  const dx = b.x - s.player.x;
  const dy = b.y - s.player.y;
  return {
    id: b.id,
    boss: b.boss,
    kind: b.kind,
    nameKey: b.nameKey as MessageKey,
    hpPct: percent(b.hp, b.maxHp),
    marks: phaseMarks(b.boss),
    phase: b.phase,
    phaseCount: b.phaseCount,
    state: bossBarState(b),
    angleDeg: Math.round((Math.atan2(dy, dx) * 180) / Math.PI),
    far: Math.hypot(dx, dy) > BOSS_FAR_U,
  };
}

export function sameBossBar(a: BossBarView | null, b: BossBarView | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.hpPct === b.hpPct &&
    a.phase === b.phase &&
    a.state === b.state &&
    a.far === b.far &&
    Math.abs(a.angleDeg - b.angleDeg) < 4
  );
}

export type BossNoticeKind = 'arrival' | 'defeated' | 'retreated';
export interface BossNotice {
  kind: BossNoticeKind;
  boss: BossId;
  bossKind: 'miniboss' | 'boss';
  nameKey: MessageKey;
  /** Instante (ms) en que se levantó. */
  atMs: number;
}

/**
 * Los avisos que nacen al pasar de los bosses de antes a los de ahora: llega
 * uno nuevo; uno que ya no está, o cayó (`bossesDefeated`) o se retiró.
 * `prev` es lo visto en la lectura anterior (por id).
 */
export function bossNotices(
  prev: ReadonlyMap<number, { boss: BossId; kind: 'miniboss' | 'boss'; nameKey: string }>,
  s: Pick<SurvivorsSnapshot, 'bosses' | 'bossesDefeated'>,
  nowMs: number,
): BossNotice[] {
  const out: BossNotice[] = [];
  const alive = new Set(s.bosses.map((b) => b.id));
  for (const b of s.bosses) {
    if (!prev.has(b.id))
      out.push({ kind: 'arrival', boss: b.boss, bossKind: b.kind, nameKey: b.nameKey as MessageKey, atMs: nowMs });
  }
  for (const [id, b] of prev) {
    if (alive.has(id)) continue;
    out.push({
      kind: s.bossesDefeated.includes(b.boss) ? 'defeated' : 'retreated',
      boss: b.boss,
      bossKind: b.kind,
      nameKey: b.nameKey as MessageKey,
      atMs: nowMs,
    });
  }
  return out;
}

/** ¿Sigue puesto el aviso? */
export function noticeActive(n: Pick<BossNotice, 'atMs'>, nowMs: number): boolean {
  return nowMs - n.atMs < BOSS_BANNER_MS;
}

/** La clave del texto de un aviso. */
export const BOSS_NOTICE_KEYS: Readonly<Record<BossNoticeKind, MessageKey>> = {
  arrival: 'mar.canon.boss.llega',
  defeated: 'mar.canon.boss.cae',
  retreated: 'mar.canon.boss.huye',
};

// --- Cartas de nivel -----------------------------------------------------------

// Los iconos son SVG propios (T150, `canon-icons.tsx`), por nombre; ningún emoji.

/** El icono de cada mejora (la carta de achique cuando ya no queda nada, T130). */
export const UPGRADE_ICON: Readonly<Record<UpgradeId, CanonIconName>> = {
  damage: 'mejora-damage',
  fireRate: 'mejora-fireRate',
  projectiles: 'mejora-projectiles',
  speed: 'mejora-speed',
  magnet: 'mejora-magnet',
  bailing: 'mejora-bailing',
};

/** El icono de cada arma (T130). muestra */
export const WEAPON_ICON: Readonly<Record<WeaponId, CanonIconName>> = {
  canon: 'arma-canon',
  subwoofer: 'arma-subwoofer',
  laser: 'arma-laser',
  buoys: 'arma-buoys',
  confetti: 'arma-confetti',
  fireworks: 'arma-fireworks',
  acidRain: 'arma-acidRain',
};

/** El icono de cada vinilo (T130): todos sobre el disco morado. muestra */
export const VINYL_ICON: Readonly<Record<PassiveId, CanonIconName>> = {
  techno: 'vinilo-techno',
  reggaeton: 'vinilo-reggaeton',
  house: 'vinilo-house',
  dnb: 'vinilo-dnb',
  disco: 'vinilo-disco',
  chill: 'vinilo-chill',
  hardstyle: 'vinilo-hardstyle',
  pop: 'vinilo-pop',
  rumba: 'vinilo-rumba',
};

/** El icono de cada evolución (T130). muestra */
export const EVOLUTION_ICON: Readonly<Record<EvolutionId, CanonIconName>> = {
  drop: 'evo-drop',
  soundWall: 'evo-soundWall',
  laserShow: 'evo-laserShow',
  discoBall: 'evo-discoBall',
};

/** El icono de cada objeto del botín de las élites (T135), cada uno el suyo (T150). */
export const DROP_ICON: Readonly<Record<DropId, CanonIconName>> = {
  iman: 'botin-iman',
  llama: 'botin-llama',
  salvavidas: 'botin-salvavidas',
};

/** La Segunda vida (la carta rara y su hueco en la fila): ya no comparte la boya. */
export const SALVAVIDAS_ICON: CanonIconName = 'segunda-vida';
/** El aviso de la Llama del botín mientras dura (T135). */
export const FLAME_ICON: CanonIconName = 'llama';
/** La carta de achique: la mejora de achique. */
export const FALLBACK_ICON: CanonIconName = UPGRADE_ICON.bailing;
/** El cofre de un miniboss (T139). */
export const CHEST_ICON: CanonIconName = 'cofre';

/** Lo que una carta enseña, ya resuelto para pintarla (T130). */
export interface CardView {
  /** Único en la oferta: la clave de React y `data-carta`. */
  id: string;
  kind: CardKind;
  icon: CanonIconName;
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
export function cardIcon(
  o: Pick<CardOption, 'kind' | 'weaponId' | 'vinylId' | 'evolutionId'>,
): CanonIconName {
  switch (o.kind) {
    case 'weapon-new':
    case 'weapon-level':
      return (o.weaponId && WEAPON_ICON[o.weaponId]) || FALLBACK_ICON;
    case 'vinyl-new':
    case 'vinyl-level':
      return (o.vinylId && VINYL_ICON[o.vinylId]) || FALLBACK_ICON;
    case 'evolution':
      return (o.evolutionId && EVOLUTION_ICON[o.evolutionId]) || FALLBACK_ICON;
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
  /** null: hueco libre. */
  icon: CanonIconName | null;
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
  icon: null,
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
  /**
   * ¿Cuenta para el ranking? (T148) false si se acabó con «Terminar partida»
   * (`quit`): ni medalla, ni premio, ni puesto. El envío al ranking (T155)
   * debe saltarse las que no cuentan.
   */
  ranked: boolean;
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
  /** Las armas y los vinilos con que acabó (T145), en el orden en que se cogieron. */
  weapons: readonly CanonGearItem[];
  vinyls: readonly CanonGearItem[];
}

/** Un arma o vinilo de la tarjeta final, con su nivel. */
export interface CanonGearItem {
  id: string;
  /** Su icono (T150): el de la evolución si evolucionó. */
  icon: CanonIconName;
  name: MessageKey;
  level: number;
  maxLevel: number;
  /** El arma evolucionada. */
  evolved: boolean;
}

/** El resumen de la pantalla final, o null si la partida no la tiene (abandono). */
export function canonResult(reason: EndReason, s: SurvivorsSnapshot): CanonResult | null {
  if (reason === 'abandoned') return null;
  return {
    reason,
    ranked: reason !== 'quit',
    playedS: s.activeS,
    defeated: s.defeated,
    notes: s.notesPicked,
    level: s.xp.level,
    medal: survivorsMedal({ end: reason, bossesDefeated: s.bossesDefeated, act: s.act }),
    act: s.act,
    difficulty: s.difficulty,
    bosses: [...s.bossesDefeated],
    weapons: s.weapons.map((w) => ({
      id: w.evolutionId ?? w.id,
      icon: w.evolutionId ? EVOLUTION_ICON[w.evolutionId] : WEAPON_ICON[w.id],
      name: w.nameKey as MessageKey,
      level: w.level,
      maxLevel: w.maxLevel,
      evolved: !!w.evolutionId,
    })),
    vinyls: s.vinyls.map((v) => ({
      id: v.id,
      icon: VINYL_ICON[v.id],
      name: v.nameKey as MessageKey,
      level: v.level,
      maxLevel: v.maxLevel,
      evolved: false,
    })),
  };
}

/** Los textos de la pantalla final según cómo acabó. */
export const END_KEYS: Readonly<Record<CanonEndReason, { title: MessageKey; line: MessageKey }>> = {
  survived: { title: 'mar.canon.fin.amanece', line: 'mar.canon.fin.amanece.texto' },
  flooded: { title: 'mar.canon.fin.inundado', line: 'mar.canon.fin.inundado.texto' },
  // El boss final del acto vencido (T140): el final especial; la medalla y la tarjeta, T144/T145.
  victory: { title: 'mar.canon.fin.victoria', line: 'mar.canon.fin.victoria.texto' },
  // «Terminar partida» desde la pausa (T148): sin medalla, premio ni ranking.
  quit: { title: 'mar.canon.fin.terminada', line: 'mar.canon.fin.terminada.texto' },
};

/** Los textos de cada medalla (T145). */
export const MEDAL_KEYS: Readonly<Record<SurvivorsMedal, MessageKey>> = {
  bronce: 'mar.canon.fin.medalla.bronce',
  plata: 'mar.canon.fin.medalla.plata',
  oro: 'mar.canon.fin.medalla.oro',
};

/** El final especial de cada boss final (T145); el resto, el genérico de `END_KEYS.victory`. */
export const VICTORY_KEYS: Readonly<Partial<Record<BossId, { title: MessageKey; line: MessageKey }>>> = {
  fantasma: { title: 'mar.canon.fin.victoria.fantasma', line: 'mar.canon.fin.victoria.fantasma.texto' },
  kraken: { title: 'mar.canon.fin.victoria.kraken', line: 'mar.canon.fin.victoria.kraken.texto' },
};

/** Lo que la tarjeta final pinta, sin React (T145). */
export interface EndCardModel {
  title: MessageKey;
  line: MessageKey;
  /** La medalla (o «Sin medalla» si se inundó). */
  medal: { key: MessageKey; id: SurvivorsMedal | null };
  act: { key: 'mar.canon.acto'; n: number };
  difficulty: MessageKey;
  /** Los nombres de los bosses vencidos, en orden. */
  bosses: MessageKey[];
  /** El acto que esta partida abrió (T144), o null. */
  unlock: { key: 'mar.canon.fin.desbloqueo'; n: number } | null;
}

/**
 * El modelo de la tarjeta final: título y línea (el final de su boss final si
 * se venció), medalla, acto y dificultad, bosses y el aviso del acto abierto.
 */
export function endCardModel(
  result: CanonResult,
  unlockedAct: number | null = null,
  cfg: typeof SURVIVORS_CONFIG = SURVIVORS_CONFIG,
): EndCardModel {
  const final = result.reason === 'victory' ? actFinalBoss(result.act, cfg) : null;
  const keys = (final && VICTORY_KEYS[final]) || END_KEYS[result.reason];
  return {
    title: keys.title,
    line: keys.line,
    medal: {
      key: result.medal ? MEDAL_KEYS[result.medal] : 'mar.canon.fin.medalla.ninguna',
      id: result.medal,
    },
    act: { key: 'mar.canon.acto', n: result.act },
    difficulty: `mar.canon.dificultad.${result.difficulty}` as MessageKey,
    bosses: result.bosses.map((id) => (cfg.bosses[id]?.i18nKey ?? `survivors.boss.${id}`) as MessageKey),
    unlock: unlockedAct ? { key: 'mar.canon.fin.desbloqueo', n: unlockedAct } : null,
  };
}

// --- Premio (T119) ---------------------------------------------------------------

/**
 * El premio de la partida, para la pantalla final y las pruebas: `pending`
 * mientras se liquida la sesión; después, `granted` o el motivo de que no
 * (`not_won`, `duplicate`, `abandoned`, `implausible_duration`…).
 */
export type CanonPrize =
  | 'pending'
  | 'granted'
  | Exclude<RewardOutcome, { granted: true }>['reason']
  // «Terminar partida» (T148): la sesión se abandonó sin liquidar.
  | 'quit';

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
