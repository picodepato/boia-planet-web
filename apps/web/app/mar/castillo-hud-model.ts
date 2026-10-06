import {
  DEFENSE_TOWER_KINDS,
  type DefenseBuildCheck,
  type DefenseBuildReason,
  type DefenseConfig,
  type DefenseEndReason,
  type DefenseResult,
  type DefenseSnapshot,
  type DefenseSpawn,
  type DefenseStatus,
  type DefenseTowerKind,
  defenseTowerSellValue,
  defenseTowerUpgradeCost,
} from '@boia/engine/defense';
import { type BossId, SURVIVORS_CONFIG } from '@boia/engine/survivors';
import type { MessageKey } from '../../lib/i18n';
import { type BossBarView, formatClock, formatPlayed, percent } from './canon-hud-model';

/**
 * Lo que la interfaz de «Defensa del Castillo» (plan 014 T161) enseña, sin
 * React: arriba la vida del castillo, el tiempo, la oleada y las monedas (y
 * la barra del boss del Cañón); abajo «Construir» con las siete islas y su
 * precio, la vista previa al colocar (verde o roja con el motivo de T159),
 * la ficha de una isla construida (nivel, Mejorar, Vender) y la mejora del
 * avión. Los componentes de `castillo-hud.tsx` sólo lo pintan. Todo `muestra`.
 */

export { formatClock, formatPlayed };

// --- Islas ----------------------------------------------------------------------

/** El orden de las siete islas en «Construir» (el de la config). */
export const CASTLE_TOWERS: readonly DefenseTowerKind[] = DEFENSE_TOWER_KINDS;
/** El nivel más alto de una isla y del avión. */
export const MAX_LEVEL = 3;

/** El nombre de cada isla (decisión 9 del plan 014). */
export const TOWER_NAME_KEYS: Readonly<Record<DefenseTowerKind, MessageKey>> = {
  faro: 'mar.castillo.isla.faro',
  ultima: 'mar.castillo.isla.ultima',
  halloween: 'mar.castillo.isla.halloween',
  cala: 'mar.castillo.isla.cala',
  tienda: 'mar.castillo.isla.tienda',
  allday: 'mar.castillo.isla.allday',
  fotos: 'mar.castillo.isla.fotos',
};

/** Una línea de lo que hace cada isla. */
export const TOWER_ROLE_KEYS: Readonly<Record<DefenseTowerKind, MessageKey>> = {
  faro: 'mar.castillo.isla.faro.hace',
  ultima: 'mar.castillo.isla.ultima.hace',
  halloween: 'mar.castillo.isla.halloween.hace',
  cala: 'mar.castillo.isla.cala.hace',
  tienda: 'mar.castillo.isla.tienda.hace',
  allday: 'mar.castillo.isla.allday.hace',
  fotos: 'mar.castillo.isla.fotos.hace',
};

/** Por qué no se puede construir ahí (los motivos de `defenseBuildCheck`, T159). */
export const BUILD_REASON_KEYS: Readonly<Record<DefenseBuildReason, MessageKey>> = {
  ended: 'mar.castillo.motivo.ended',
  ring: 'mar.castillo.motivo.ring',
  arena: 'mar.castillo.motivo.arena',
  path: 'mar.castillo.motivo.path',
  vortex: 'mar.castillo.motivo.vortex',
  castle: 'mar.castillo.motivo.castle',
  overlap: 'mar.castillo.motivo.overlap',
  coins: 'mar.castillo.motivo.coins',
};

export interface BuildOption {
  kind: DefenseTowerKind;
  nameKey: MessageKey;
  roleKey: MessageKey;
  cost: number;
  /** ¿Llega el dinero? (si no, el botón va en gris y no se puede elegir). */
  affordable: boolean;
}

/** Las siete islas de «Construir» con su precio y si llega el dinero. */
export function buildOptions(config: DefenseConfig, coins: number): BuildOption[] {
  return CASTLE_TOWERS.map((kind) => {
    const cost = config.towers.kinds[kind].cost;
    return {
      kind,
      nameKey: TOWER_NAME_KEYS[kind],
      roleKey: TOWER_ROLE_KEYS[kind],
      cost,
      affordable: Math.floor(coins) >= cost,
    };
  });
}

export interface PlacementView {
  ok: boolean;
  cost: number;
  /** El texto de la vista previa: «Aquí se puede» o el motivo. */
  key: MessageKey;
  reason: DefenseBuildReason | null;
}

/** La vista previa al colocar: verde («Aquí se puede») o roja con el motivo. */
export function placementView(check: DefenseBuildCheck): PlacementView {
  if (check.ok) return { ok: true, cost: check.cost, key: 'mar.castillo.colocar.ok', reason: null };
  return {
    ok: false,
    cost: check.cost,
    key: BUILD_REASON_KEYS[check.reason],
    reason: check.reason,
  };
}

/** Una isla construida, para su ficha: nivel, Mejorar (precio) y Vender (lo que devuelve). */
export interface TowerPanelView {
  id: number;
  kind: DefenseTowerKind;
  nameKey: MessageKey;
  roleKey: MessageKey;
  level: number;
  maxLevel: number;
  /** Lo que cuesta el siguiente nivel; null en el 3. */
  upgradeCost: number | null;
  /** ¿Se puede mejorar ya? (no está en el 3 y llega el dinero). */
  canUpgrade: boolean;
  sellValue: number;
}

export function towerPanel(
  config: DefenseConfig,
  s: Pick<DefenseSnapshot, 'towers' | 'coins'>,
  id: number | null,
): TowerPanelView | null {
  if (id === null) return null;
  const t = s.towers.find((x) => x.id === id);
  if (!t) return null;
  const upgradeCost = defenseTowerUpgradeCost(config, t);
  return {
    id: t.id,
    kind: t.kind,
    nameKey: TOWER_NAME_KEYS[t.kind],
    roleKey: TOWER_ROLE_KEYS[t.kind],
    level: t.level,
    maxLevel: MAX_LEVEL,
    upgradeCost,
    canUpgrade: upgradeCost !== null && Math.floor(s.coins) >= upgradeCost,
    sellValue: defenseTowerSellValue(config, t),
  };
}

/** Un texto con sus valores (para `t(key, params)`). */
export interface Line {
  key: MessageKey;
  params?: Record<string, string | number>;
}

/** «Mejorar · 80» o «Nivel máximo». */
export function upgradeLine(p: Pick<TowerPanelView, 'upgradeCost'>): Line {
  return p.upgradeCost === null
    ? { key: 'mar.castillo.isla.max' }
    : { key: 'mar.castillo.isla.mejorar', params: { coste: p.upgradeCost } };
}

/** «Vender · +54». */
export function sellLine(p: Pick<TowerPanelView, 'sellValue'>): Line {
  return { key: 'mar.castillo.isla.vender', params: { monedas: p.sellValue } };
}

/** «Nivel 2/3». */
export function levelLine(level: number, max: number = MAX_LEVEL): Line {
  return { key: 'mar.castillo.nivel', params: { n: level, max } };
}

// --- El avión -------------------------------------------------------------------

export interface PlaneView {
  level: number;
  maxLevel: number;
  damage: number;
  /** Lo que cuesta el siguiente nivel de daño; null en el 3. */
  nextCost: number | null;
  affordable: boolean;
}

export function planeView(s: Pick<DefenseSnapshot, 'plane' | 'coins'>): PlaneView {
  const next = s.plane.nextUpgradeCost;
  return {
    level: s.plane.level,
    maxLevel: MAX_LEVEL,
    damage: s.plane.damage,
    nextCost: next,
    affordable: next !== null && Math.floor(s.coins) >= next,
  };
}

/** «Avión · daño 2 → 3 · 180» o «Avión · daño máximo». */
export function planeLine(p: PlaneView): Line {
  return p.nextCost === null
    ? { key: 'mar.castillo.avion.max' }
    : { key: 'mar.castillo.avion.mejorar', params: { n: p.level + 1, coste: p.nextCost } };
}

// --- La vida del castillo -------------------------------------------------------

/**
 * Cómo va el castillo: `ok`, `alerta` por debajo de la mitad y `peligro` por
 * debajo de un cuarto. Además del color, cada tramo cambia el dibujo de la
 * barra (como el agua a bordo del Cañón: un patrón además del color).
 */
export type LifeLevel = 'ok' | 'alerta' | 'peligro';
export const LIFE_ALERT = 50;
export const LIFE_DANGER = 25;

export function lifeLevelOf(pct: number): LifeLevel {
  if (pct <= LIFE_DANGER) return 'peligro';
  if (pct <= LIFE_ALERT) return 'alerta';
  return 'ok';
}

// --- Oleadas --------------------------------------------------------------------

/** La oleada en curso (1…, 0 antes de la primera) y cuántas hay en la partida. */
export function waveAt(
  schedule: readonly Pick<DefenseSpawn, 'atS' | 'wave'>[],
  activeS: number,
): { wave: number; total: number } {
  let wave = -1;
  let total = -1;
  for (const s of schedule) {
    if (s.wave > total) total = s.wave;
    if (s.atS <= activeS + 1e-9 && s.wave > wave) wave = s.wave;
  }
  return { wave: wave + 1, total: total + 1 };
}

// --- Lo de arriba ---------------------------------------------------------------

export interface CastleView {
  status: DefenseStatus;
  /** s que faltan (enteros, hacia arriba). */
  timeLeftS: number;
  life: number;
  maxLife: number;
  lifePct: number;
  lifeLevel: LifeLevel;
  wave: number;
  waves: number;
  /** Monedas del monedero (enteras, hacia abajo). */
  coins: number;
  plane: PlaneView;
  /** Las islas construidas (en texto, para comparar sin más). */
  towersKey: string;
}

export function castleView(
  s: DefenseSnapshot,
  schedule: readonly Pick<DefenseSpawn, 'atS' | 'wave'>[],
): CastleView {
  const lifePct = percent(s.castle.life, s.castle.maxLife);
  const { wave, total } = waveAt(schedule, s.activeS);
  return {
    status: s.status,
    timeLeftS: Math.max(0, Math.ceil(s.timeLeftS - 1e-6)),
    life: Math.max(0, Math.ceil(s.castle.life - 1e-6)),
    maxLife: s.castle.maxLife,
    lifePct,
    lifeLevel: lifeLevelOf(lifePct),
    wave,
    waves: total,
    coins: Math.max(0, Math.floor(s.coins)),
    plane: planeView(s),
    towersKey: s.towers.map((t) => `${t.id}:${t.level}`).join(' '),
  };
}

export function sameCastleView(a: CastleView | null, b: CastleView | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.status === b.status &&
    a.timeLeftS === b.timeLeftS &&
    a.life === b.life &&
    a.maxLife === b.maxLife &&
    a.wave === b.wave &&
    a.waves === b.waves &&
    a.coins === b.coins &&
    a.plane.level === b.plane.level &&
    a.plane.affordable === b.plane.affordable &&
    a.plane.nextCost === b.plane.nextCost &&
    a.towersKey === b.towersKey
  );
}

// --- Bosses ---------------------------------------------------------------------

/** El nombre de un boss o miniboss del Cañón. */
export function bossNameKey(boss: BossId): MessageKey {
  return (SURVIVORS_CONFIG.bosses[boss]?.i18nKey ?? 'mar.castillo.boss') as MessageKey;
}

/**
 * La barra del boss del Cañón (T143) para el que va por el camino: el boss
 * antes que el miniboss, y de ésos el más adelantado. Aquí no hay fases ni
 * estados (decisión 6: sólo siguen el camino).
 */
export function defenseBossBar(s: Pick<DefenseSnapshot, 'enemies'>): BossBarView | null {
  let best: DefenseSnapshot['enemies'][number] | null = null;
  for (const e of s.enemies) {
    if (!e.boss || e.dead) continue;
    if (
      !best ||
      (e.tier === 'boss' && best.tier !== 'boss') ||
      (e.tier === best.tier && e.distance > best.distance)
    )
      best = e;
  }
  if (!best) return null;
  return {
    id: best.id,
    boss: best.kind as BossId,
    kind: best.tier === 'boss' ? 'boss' : 'miniboss',
    nameKey: bossNameKey(best.kind as BossId),
    hpPct: percent(best.hp, best.maxHp),
    marks: [],
    phase: 0,
    phaseCount: 1,
    state: 'normal',
    angleDeg: 0,
    far: false,
  };
}

export type CastleNoticeKind = 'arrival' | 'defeated' | 'reached';
export interface CastleBossNotice {
  kind: CastleNoticeKind;
  boss: BossId;
  bossKind: 'miniboss' | 'boss';
  nameKey: MessageKey;
  atMs: number;
}

export const CASTLE_NOTICE_KEYS: Readonly<Record<CastleNoticeKind, MessageKey>> = {
  arrival: 'mar.canon.boss.llega',
  defeated: 'mar.canon.boss.cae',
  reached: 'mar.castillo.boss.golpea',
};

/** Los bosses vivos de una lectura, por id (para comparar con la siguiente). */
export type SeenBosses = ReadonlyMap<number, { boss: BossId; kind: 'miniboss' | 'boss' }>;

export function seenBosses(
  s: Pick<DefenseSnapshot, 'enemies'>,
): Map<number, { boss: BossId; kind: 'miniboss' | 'boss' }> {
  const out = new Map<number, { boss: BossId; kind: 'miniboss' | 'boss' }>();
  for (const e of s.enemies) {
    if (e.boss && !e.dead)
      out.set(e.id, { boss: e.kind as BossId, kind: e.tier === 'boss' ? 'boss' : 'miniboss' });
  }
  return out;
}

/**
 * Los avisos al pasar de una lectura a otra: sale un boss del vórtice; uno
 * que ya no está, o cayó (sube la cuenta de `bossesDefeated` de su tipo) o
 * llegó a la muralla.
 */
export function defenseBossNotices(
  prev: SeenBosses,
  prevDefeated: readonly string[],
  s: Pick<DefenseSnapshot, 'enemies' | 'bossesDefeated'>,
  nowMs: number,
): CastleBossNotice[] {
  const out: CastleBossNotice[] = [];
  const now = seenBosses(s);
  for (const [id, b] of now) {
    if (!prev.has(id))
      out.push({
        kind: 'arrival',
        boss: b.boss,
        bossKind: b.kind,
        nameKey: bossNameKey(b.boss),
        atMs: nowMs,
      });
  }
  // Las caídas nuevas, por tipo (puede haber dos del mismo).
  const fresh = new Map<string, number>();
  for (const k of s.bossesDefeated) fresh.set(k, (fresh.get(k) ?? 0) + 1);
  for (const k of prevDefeated) fresh.set(k, (fresh.get(k) ?? 0) - 1);
  for (const [id, b] of prev) {
    if (now.has(id)) continue;
    const left = fresh.get(b.boss) ?? 0;
    if (left > 0) fresh.set(b.boss, left - 1);
    out.push({
      kind: left > 0 ? 'defeated' : 'reached',
      boss: b.boss,
      bossKind: b.kind,
      nameKey: bossNameKey(b.boss),
      atMs: nowMs,
    });
  }
  return out;
}

// --- Elegir una isla ------------------------------------------------------------

/** La isla bajo un toque (u de la partida), con un poco de holgura para el dedo; o null. */
export function towerAt(
  towers: readonly { id: number; x: number; y: number }[],
  x: number,
  y: number,
  radius: number,
): number | null {
  let best: { id: number; d: number } | null = null;
  for (const t of towers) {
    const d = Math.hypot(t.x - x, t.y - y);
    if (d <= radius && (!best || d < best.d)) best = { id: t.id, d };
  }
  return best ? best.id : null;
}

/**
 * Con el teclado (tecla I): la isla más cercana al avión; si ya hay una
 * elegida, la siguiente por distancia (y de la última, otra vez la primera).
 */
export function nextTowerByKeyboard(
  towers: readonly { id: number; x: number; y: number }[],
  plane: { x: number; y: number },
  current: number | null,
): number | null {
  if (!towers.length) return null;
  const order = [...towers]
    .map((t) => ({ id: t.id, d: Math.hypot(t.x - plane.x, t.y - plane.y) }))
    .sort((a, b) => a.d - b.d || a.id - b.id);
  const i = current === null ? -1 : order.findIndex((o) => o.id === current);
  return order[(i + 1) % order.length]!.id;
}

/** Un punto de la vista previa respecto al avión, dentro de su anillo de construir. */
export function clampToRing(dx: number, dy: number, ring: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  const max = ring * 0.98;
  if (!(len > max)) return { x: dx, y: dy };
  return { x: (dx / len) * max, y: (dy / len) * max };
}

// --- El final -------------------------------------------------------------------

/** El título de la tarjeta final por cómo acabó (T162 añade la medalla y la puntuación). */
export const END_TITLE_KEYS: Readonly<Record<DefenseEndReason, MessageKey>> = {
  held: 'mar.castillo.fin.held',
  fallen: 'mar.castillo.fin.fallen',
  abandoned: 'mar.castillo.fin.abandoned',
  quit: 'mar.castillo.fin.quit',
};

export interface CastleEndView {
  reason: DefenseEndReason;
  title: MessageKey;
  played: string;
  kills: number;
  lifePct: number;
  /** «Terminar partida»: sin medalla ni ranking. */
  short: boolean;
  ranked: boolean;
}

export function castleEndView(r: DefenseResult): CastleEndView {
  return {
    reason: r.end,
    title: END_TITLE_KEYS[r.end],
    played: formatPlayed(r.playedS),
    kills: r.kills,
    lifePct: percent(r.castleLife, r.castleMaxLife),
    short: r.end === 'quit' || r.end === 'abandoned',
    ranked: r.ranked,
  };
}

/** Lo que se lee en voz alta al acabar (`aria-live`). */
export function endAnnouncement(r: DefenseResult): Line {
  return { key: END_TITLE_KEYS[r.end] };
}
