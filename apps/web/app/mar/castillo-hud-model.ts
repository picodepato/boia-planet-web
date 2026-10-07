import {
  DEFENSE_CONFIG,
  DEFENSE_TARGET_PRIORITIES,
  DEFENSE_TOWER_KINDS,
  type DefenseBuildCheck,
  type DefenseBuildReason,
  type DefenseConfig,
  type DefenseEndReason,
  type DefenseEnemyKind,
  type DefenseMedal,
  type DefenseResult,
  type DefenseRunMin,
  type DefenseSnapshot,
  type DefenseSpawn,
  type DefenseStatus,
  type DefenseTargetPriority,
  type DefenseTowerKind,
  type DefenseWaveInfo,
  defenseCastleMaxLife,
  defenseFarmPayout,
  defenseFarmShare,
  defenseTowerStats,
  defenseTowerSellValue,
  defenseTowerUpgradeCost,
} from '@boia/engine/defense';
import { type BossId, type EnemyId, SURVIVORS_CONFIG } from '@boia/engine/survivors';
import type { MessageKey } from '../../lib/i18n';
import { type CastleIslandImage, CASTLE_ISLAND_IMAGES } from '../../lib/mundo/castle-island-images';
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
/** El nivel más alto de una isla (el del avión, en `DefensePlaneView.maxLevel`). */
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
  /** ¿Llega el dinero? (si no, el botón va en gris y no se puede colocar). */
  affordable: boolean;
  /** La foto de su modelo de frente (plan 015 T172, decisión 13). */
  image: CastleIslandImage;
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
      image: CASTLE_ISLAND_IMAGES[kind],
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

// --- El detalle de una isla (plan 015 T171, decisión 13) --------------------------

/** Lo que hace cada isla, con sus números (`towerHowLine`). */
export const TOWER_HOW_KEYS: Readonly<Record<DefenseTowerKind, MessageKey>> = {
  faro: 'mar.castillo.detalle.faro',
  ultima: 'mar.castillo.detalle.ultima',
  halloween: 'mar.castillo.detalle.halloween',
  cala: 'mar.castillo.detalle.cala',
  tienda: 'mar.castillo.detalle.tienda',
  allday: 'mar.castillo.detalle.allday',
  fotos: 'mar.castillo.detalle.fotos',
};

/** Cómo hace daño (o da monedas) la isla `kind` a su nivel, con los números de la config. */
export function towerHowLine(config: DefenseConfig, kind: DefenseTowerKind, level: number): Line {
  const key = TOWER_HOW_KEYS[kind];
  const f = formatNum;
  switch (kind) {
    case 'faro': {
      const st = defenseTowerStats(config, 'faro', level);
      return { key, params: { haces: st.beams, dps: f(st.damagePerS), alcance: f(st.range) } };
    }
    case 'ultima': {
      const st = defenseTowerStats(config, 'ultima', level);
      return {
        key,
        params: {
          dano: f(st.damage),
          cada: f(st.cooldownS),
          para: f(st.stunS),
          alcance: f(st.range),
        },
      };
    }
    case 'halloween': {
      const st = defenseTowerStats(config, 'halloween', level);
      return {
        key,
        params: {
          dano: f(st.damage),
          cada: f(st.cooldownS),
          quema: f(st.burnDps),
          durante: f(st.burnS),
          alcance: f(st.range),
        },
      };
    }
    case 'cala': {
      const st = defenseTowerStats(config, 'cala', level);
      return {
        key,
        params: {
          dano: f(st.damage),
          cada: f(st.cooldownS),
          area: f(st.blastRadius),
          alcance: f(st.range),
        },
      };
    }
    case 'tienda': {
      const st = defenseTowerStats(config, 'tienda', level);
      return { key, params: { monedas: f(st.coins), cada: f(st.cooldownS) } };
    }
    case 'allday': {
      const st = defenseTowerStats(config, 'allday', level);
      return { key, params: { dano: f(st.damage), cada: f(st.cooldownS), alcance: f(st.range) } };
    }
    case 'fotos': {
      const st = defenseTowerStats(config, 'fotos', level);
      return { key, params: { dano: f(st.damage), cada: f(st.cooldownS), alcance: f(st.range) } };
    }
  }
}

export type TowerStatId =
  'dps' | 'haces' | 'dano' | 'cada' | 'para' | 'quema' | 'area' | 'monedas' | 'alcance';

export const TOWER_STAT_KEYS: Readonly<Record<TowerStatId, MessageKey>> = {
  dps: 'mar.castillo.dato.dps',
  haces: 'mar.castillo.dato.haces',
  dano: 'mar.castillo.dato.dano',
  cada: 'mar.castillo.dato.cada',
  para: 'mar.castillo.dato.para',
  quema: 'mar.castillo.dato.quema',
  area: 'mar.castillo.dato.area',
  monedas: 'mar.castillo.dato.monedas',
  alcance: 'mar.castillo.dato.alcance',
};

/** Qué número de la config va en cada fila de la tabla de una isla. */
const STAT_FIELDS: { [K in DefenseTowerKind]: readonly [TowerStatId, string][] } = {
  faro: [
    ['dps', 'damagePerS'],
    ['haces', 'beams'],
    ['alcance', 'range'],
  ],
  ultima: [
    ['dano', 'damage'],
    ['cada', 'cooldownS'],
    ['para', 'stunS'],
    ['alcance', 'range'],
  ],
  halloween: [
    ['dano', 'damage'],
    ['quema', 'burnDps'],
    ['cada', 'cooldownS'],
    ['alcance', 'range'],
  ],
  cala: [
    ['dano', 'damage'],
    ['area', 'blastRadius'],
    ['cada', 'cooldownS'],
    ['alcance', 'range'],
  ],
  tienda: [
    ['monedas', 'coins'],
    ['cada', 'cooldownS'],
  ],
  allday: [
    ['dano', 'damage'],
    ['cada', 'cooldownS'],
    ['alcance', 'range'],
  ],
  fotos: [
    ['dano', 'damage'],
    ['cada', 'cooldownS'],
    ['alcance', 'range'],
  ],
};

/** Una fila de la tabla: el dato y su valor a nivel 1, 2 y 3. */
export interface TowerStatRow {
  id: TowerStatId;
  labelKey: MessageKey;
  values: string[];
}

/** La tabla de una isla por niveles (los números de la config, sin tocar). */
export function towerStatRows(config: DefenseConfig, kind: DefenseTowerKind): TowerStatRow[] {
  const levels = config.towers.kinds[kind].levels as readonly Record<string, number>[];
  return STAT_FIELDS[kind].map(([id, field]) => ({
    id,
    labelKey: TOWER_STAT_KEYS[id],
    values: levels.map((l) => formatNum(l[field] ?? 0)),
  }));
}

/** El detalle de una isla de «Construir» antes de colocarla. */
export interface TowerDetailView extends BuildOption {
  how: Line;
  rows: TowerStatRow[];
  /** A quién apunta al construirla, o null si no elige blanco. */
  priority: DefenseTargetPriority | null;
}

export function towerDetail(
  config: DefenseConfig,
  kind: DefenseTowerKind,
  coins: number,
  farmCount = 0,
): TowerDetailView {
  const option = buildOptions(config, coins).find((o) => o.kind === kind)!;
  const how = towerHowLine(config, kind, 1);
  const rows = towerStatRows(config, kind);
  // La siguiente Ibiza ocupa el puesto posterior a las que siguen en pie.
  // Usar el mismo cálculo del motor también en la tabla por niveles.
  if (kind === 'tienda') {
    how.params = { ...how.params, monedas: formatNum(defenseFarmPayout(config, 1, farmCount)) };
    const money = rows.find((r) => r.id === 'monedas')!;
    money.values = money.values.map((_, i) =>
      formatNum(defenseFarmPayout(config, i + 1, farmCount)),
    );
  }
  return {
    ...option,
    how,
    rows,
    priority: config.towers.kinds[kind].priority,
  };
}

// --- A quién apunta (decisión 12) ---------------------------------------------------

export const PRIORITY_KEYS: Readonly<Record<DefenseTargetPriority, MessageKey>> = {
  first: 'mar.castillo.prioridad.first',
  last: 'mar.castillo.prioridad.last',
  strongest: 'mar.castillo.prioridad.strongest',
  closest: 'mar.castillo.prioridad.closest',
};

/** Lo que explica cada prioridad (el `title` y el lector de pantalla). */
export const PRIORITY_HELP_KEYS: Readonly<Record<DefenseTargetPriority, MessageKey>> = {
  first: 'mar.castillo.prioridad.first.ayuda',
  last: 'mar.castillo.prioridad.last.ayuda',
  strongest: 'mar.castillo.prioridad.strongest.ayuda',
  closest: 'mar.castillo.prioridad.closest.ayuda',
};

/** Las cuatro prioridades para elegir, con la de la isla marcada; vacía si la isla no elige blanco. */
export function priorityOptions(
  current: DefenseTargetPriority | null,
): { priority: DefenseTargetPriority; labelKey: MessageKey; helpKey: MessageKey; on: boolean }[] {
  if (current === null) return [];
  return DEFENSE_TARGET_PRIORITIES.map((p) => ({
    priority: p,
    labelKey: PRIORITY_KEYS[p],
    helpKey: PRIORITY_HELP_KEYS[p],
    on: p === current,
  }));
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
  /** A quién apunta, o null si no elige blanco (Faro, Ibiza, Isla del Sonido). */
  priority: DefenseTargetPriority | null;
  /** Lo que hace a su nivel, con sus números (Ibiza: lo que paga de verdad). */
  how: Line;
  image: CastleIslandImage;
  /** Ibiza: la explicación que se despliega (plan 016, decisión 7); null en las demás. */
  farm: FarmExplainView | null;
}

/** La explicación corta de Ibiza: lo que paga esta y que las de más pagan menos. */
export interface FarmExplainView {
  /** Lo que paga de verdad cada `everyS` (`DefenseGame.farmPayout`). */
  coins: number;
  everyS: number;
  lines: Line[];
}

/**
 * La explicación de una Ibiza: paga `coins` cada `cooldownS` sola, y las de
 * más pagan menos (las partes de la config: la 2.ª y la 3.ª y siguientes).
 */
export function farmExplain(config: DefenseConfig, level: number, coins: number): FarmExplainView {
  const everyS = defenseTowerStats(config, 'tienda', level).cooldownS;
  const pct = (rank: number) => formatNum(Math.round(defenseFarmShare(config, rank) * 100));
  return {
    coins,
    everyS,
    lines: [
      {
        key: 'mar.castillo.ibiza.paga',
        params: { monedas: formatNum(coins), cada: formatNum(everyS) },
      },
      { key: 'mar.castillo.ibiza.mas', params: { segunda: pct(1), resto: pct(2) } },
    ],
  };
}

/**
 * La ficha de la isla `id`. `farmPayout`: lo que paga de verdad una Ibiza
 * (`DefenseGame.farmPayout`, con su parte por orden de construcción); sin él,
 * lo de la config para la primera.
 */
export function towerPanel(
  config: DefenseConfig,
  s: Pick<DefenseSnapshot, 'towers' | 'coins'>,
  id: number | null,
  farmPayout?: (id: number) => number | null,
): TowerPanelView | null {
  if (id === null) return null;
  const t = s.towers.find((x) => x.id === id);
  if (!t) return null;
  const upgradeCost = defenseTowerUpgradeCost(config, t);
  const pays =
    t.kind === 'tienda' ? (farmPayout?.(t.id) ?? defenseFarmPayout(config, t.level, 0)) : null;
  const how = towerHowLine(config, t.kind, t.level);
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
    priority: t.priority,
    how:
      pays === null ? how : { key: how.key, params: { ...how.params, monedas: formatNum(pays) } },
    image: CASTLE_ISLAND_IMAGES[t.kind],
    farm: pays === null ? null : farmExplain(config, t.level, pays),
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

// --- Mejoras: el avión y el castillo (plan 015 T171, decisiones 8 y 9) ----------

export type UpgradeId = 'speed' | 'damage' | 'castle';
export const UPGRADE_IDS: readonly UpgradeId[] = ['speed', 'damage', 'castle'];

/** Una fila de «Mejoras»: nivel, lo de ahora → lo del siguiente y su precio. */
export interface UpgradeRow {
  id: UpgradeId;
  nameKey: MessageKey;
  level: number;
  maxLevel: number;
  /** Lo que cuesta el siguiente nivel; null en el máximo. */
  cost: number | null;
  affordable: boolean;
  /** «Cada 0,5 s → 0,43 s», «Daño 12 → 20», «Vida 100 → 150» (en el máximo, sólo lo de ahora). */
  value: Line;
}

export const UPGRADE_NAME_KEYS: Readonly<Record<UpgradeId, MessageKey>> = {
  speed: 'mar.castillo.mejora.velocidad',
  damage: 'mar.castillo.mejora.dano',
  castle: 'mar.castillo.mejora.castillo',
};

/** Un número para leer: dos decimales como mucho y coma decimal. */
export function formatNum(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

function valueLine(key: MessageKey, now: number, next: number | null, unit = ''): Line {
  return next === null
    ? { key: `${key}.max` as MessageKey, params: { ahora: formatNum(now) + unit } }
    : { key, params: { ahora: formatNum(now) + unit, luego: formatNum(next) + unit } };
}

/** Las tres mejoras: velocidad de ataque y daño del avión (1–5) y la vida del castillo. */
export function upgradeRows(
  config: DefenseConfig,
  s: Pick<DefenseSnapshot, 'plane' | 'castle' | 'coins'>,
): UpgradeRow[] {
  const coins = Math.floor(s.coins);
  const p = s.plane;
  const at = (list: readonly number[], level: number) =>
    list[Math.min(list.length, Math.max(1, level)) - 1]!;
  const row = (
    id: UpgradeId,
    level: number,
    maxLevel: number,
    cost: number | null,
    value: Line,
  ): UpgradeRow => ({
    id,
    nameKey: UPGRADE_NAME_KEYS[id],
    level,
    maxLevel,
    cost,
    affordable: cost !== null && coins >= cost,
    value,
  });
  const speedNext = p.nextSpeedCost === null ? null : at(config.plane.cooldownS, p.speedLevel + 1);
  const damageNext = p.nextDamageCost === null ? null : at(config.plane.damage, p.damageLevel + 1);
  const c = s.castle;
  const lifeNext = c.nextUpgradeCost === null ? null : defenseCastleMaxLife(config, c.level + 1);
  return [
    row(
      'speed',
      p.speedLevel,
      p.maxLevel,
      p.nextSpeedCost,
      valueLine('mar.castillo.mejora.velocidad.valor', p.cooldownS, speedNext, ' s'),
    ),
    row(
      'damage',
      p.damageLevel,
      p.maxLevel,
      p.nextDamageCost,
      valueLine('mar.castillo.mejora.dano.valor', p.damage, damageNext),
    ),
    row(
      'castle',
      c.level,
      c.maxLevel,
      c.nextUpgradeCost,
      valueLine('mar.castillo.mejora.castillo.valor', c.maxLife, lifeNext),
    ),
  ];
}

/** «Mejorar · 180» o «Máximo». */
export function upgradeRowLine(r: Pick<UpgradeRow, 'cost'>): Line {
  return r.cost === null
    ? { key: 'mar.castillo.mejora.max' }
    : { key: 'mar.castillo.mejora.comprar', params: { coste: r.cost } };
}

/** ¿Hay alguna mejora que ya se pueda pagar? (el botón «Mejoras» lo avisa). */
export function anyUpgradeAffordable(rows: readonly UpgradeRow[]): boolean {
  return rows.some((r) => r.affordable);
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

/**
 * La oleada en curso (1…, 0 antes de la primera) y cuántas hay en la
 * partida, con el reloj del calendario (`snapshot.waveS`: «Llamar oleada» lo
 * adelanta respecto al tiempo jugado).
 */
export function waveAt(
  schedule: readonly Pick<DefenseSpawn, 'atS' | 'wave'>[],
  waveS: number,
): { wave: number; total: number } {
  let wave = -1;
  let total = -1;
  for (const s of schedule) {
    if (s.wave > total) total = s.wave;
    if (s.atS <= waveS + 1e-9 && s.wave > wave) wave = s.wave;
  }
  return { wave: wave + 1, total: total + 1 };
}

/** s antes de una oleada a los que sale su aviso (qué trae y si hay jefe). muestra */
export const WAVE_WARN_S = 6;

/** El nombre de lo que baja por el camino: un común del Cañón o un jefe. */
export const ENEMY_NAME_KEYS: Readonly<Record<EnemyId, MessageKey>> = {
  piranha: 'mar.castillo.enemigo.piranha',
  crab: 'mar.castillo.enemigo.crab',
  gull: 'mar.castillo.enemigo.gull',
  pirate: 'mar.castillo.enemigo.pirate',
  swordfish: 'mar.castillo.enemigo.swordfish',
  jellyfish: 'mar.castillo.enemigo.jellyfish',
};

export function enemyNameKey(kind: DefenseEnemyKind): MessageKey {
  return ENEMY_NAME_KEYS[kind as EnemyId] ?? bossNameKey(kind as BossId);
}

/** La oleada siguiente para el HUD (decisión 10): qué trae, si hay jefe, cuándo y el bono por llamarla. */
export interface NextWaveView {
  /** Número de la oleada (1…). */
  wave: number;
  /** s que faltan (enteros, hacia arriba). */
  inS: number;
  kinds: { kind: DefenseEnemyKind; nameKey: MessageKey; count: number; boss: boolean }[];
  count: number;
  boss: boolean;
  /** El nombre del primer jefe que trae, o null. */
  bossNameKey: MessageKey | null;
  /** Monedas por llamarla ya («Llamar oleada»). */
  bonus: number;
  /** Ya toca avisar (faltan `WAVE_WARN_S` o menos). */
  warn: boolean;
}

export function nextWaveView(
  config: DefenseConfig,
  info: DefenseWaveInfo | null,
): NextWaveView | null {
  if (!info) return null;
  const kinds = info.kinds.map((k) => ({
    kind: k.kind,
    nameKey: enemyNameKey(k.kind),
    count: k.count,
    boss: k.boss,
  }));
  const firstBoss = kinds.find((k) => k.boss) ?? null;
  const inS = Math.max(0, Math.ceil(info.inS - 1e-6));
  return {
    wave: info.wave + 1,
    inS,
    kinds,
    count: info.count,
    boss: info.boss,
    bossNameKey: firstBoss ? firstBoss.nameKey : null,
    bonus: Math.max(0, Math.round(info.inS * config.waves.callCoinsPerS)),
    warn: info.inS <= WAVE_WARN_S + 1e-9,
  };
}

/** «Pirañas ×6, Cangrejos ×2» (los jefes, aparte: `waveWarningLine`). */
export function waveKindsText(
  w: Pick<NextWaveView, 'kinds'>,
  say: (key: MessageKey, params?: Record<string, string | number>) => string,
): string {
  return w.kinds
    .filter((k) => !k.boss)
    .map((k) => say('mar.castillo.aviso.tipo', { nombre: say(k.nameKey), n: k.count }))
    .join(', ');
}

/** El aviso de la oleada siguiente (lo que se ve y se lee en voz alta). */
export function waveWarningLine(
  w: NextWaveView,
  say: (key: MessageKey, params?: Record<string, string | number>) => string,
): Line {
  const params = { n: w.wave, s: w.inS, que: waveKindsText(w, say) };
  return w.bossNameKey
    ? { key: 'mar.castillo.anuncio.aviso.jefe', params: { ...params, jefe: say(w.bossNameKey) } }
    : { key: 'mar.castillo.anuncio.aviso', params };
}

/** «Llamar oleada» y su bono: «+9». */
export function callWaveLine(w: Pick<NextWaveView, 'bonus'>): Line {
  return { key: 'mar.castillo.llamar.bono', params: { monedas: w.bonus } };
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
  /** Las mejoras del avión y del castillo. */
  upgrades: UpgradeRow[];
  /** La oleada siguiente, o null si no quedan. */
  next: NextWaveView | null;
  /** Las islas construidas (en texto, para comparar sin más). */
  towersKey: string;
}

export function castleView(
  s: DefenseSnapshot,
  schedule: readonly Pick<DefenseSpawn, 'atS' | 'wave'>[],
  config: DefenseConfig = DEFENSE_CONFIG,
): CastleView {
  const lifePct = percent(s.castle.life, s.castle.maxLife);
  const { wave, total } = waveAt(schedule, s.waveS);
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
    upgrades: upgradeRows(config, s),
    next: nextWaveView(config, s.nextWave),
    towersKey: s.towers.map((t) => `${t.id}:${t.level}:${t.priority ?? ''}`).join(' '),
  };
}

const upgradesKey = (rows: readonly UpgradeRow[]) =>
  rows.map((r) => `${r.id}:${r.level}:${r.cost}:${r.affordable}`).join(' ');
const nextKey = (n: NextWaveView | null) => (n ? `${n.wave}:${n.inS}:${n.bonus}:${n.warn}` : '');

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
    upgradesKey(a.upgrades) === upgradesKey(b.upgrades) &&
    nextKey(a.next) === nextKey(b.next) &&
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

// --- El final -------------------------------------------------------------------

/** El título de la tarjeta final por cómo acabó. */
export const END_TITLE_KEYS: Readonly<Record<DefenseEndReason, MessageKey>> = {
  held: 'mar.castillo.fin.held',
  fallen: 'mar.castillo.fin.fallen',
  abandoned: 'mar.castillo.fin.abandoned',
  quit: 'mar.castillo.fin.quit',
};

/** La línea bajo el título (T162): sólo al aguantar o caer. */
export const END_LINE_KEYS: Readonly<Partial<Record<DefenseEndReason, MessageKey>>> = {
  held: 'mar.castillo.fin.held.texto',
  fallen: 'mar.castillo.fin.fallen.texto',
};

/** La medalla en la tarjeta final (T162), con el texto de la del Cañón. */
export const END_MEDAL_KEYS: Readonly<Record<DefenseMedal | 'ninguna', MessageKey>> = {
  oro: 'mar.canon.fin.medalla.oro',
  plata: 'mar.canon.fin.medalla.plata',
  bronce: 'mar.canon.fin.medalla.bronce',
  ninguna: 'mar.canon.fin.medalla.ninguna',
};

export interface CastleEndView {
  reason: DefenseEndReason;
  title: MessageKey;
  /** La línea bajo el título, o null («Terminar partida», abandono). */
  line: MessageKey | null;
  played: string;
  kills: number;
  lifePct: number;
  /** «Terminar partida» (o abandono): sin medalla, puntuación ni ranking. */
  short: boolean;
  ranked: boolean;
  /** La medalla de la partida, o null. */
  medal: DefenseMedal | null;
  medalKey: MessageKey;
  /** Los puntos (enemigos + bono del castillo). */
  score: number;
  runMin: DefenseRunMin;
  difficulty: DefenseResult['difficulty'];
}

export function castleEndView(r: DefenseResult): CastleEndView {
  return {
    reason: r.end,
    title: END_TITLE_KEYS[r.end],
    line: END_LINE_KEYS[r.end] ?? null,
    played: formatPlayed(r.playedS),
    kills: r.kills,
    lifePct: percent(r.castleLife, r.castleMaxLife),
    short: r.end === 'quit' || r.end === 'abandoned',
    ranked: r.ranked,
    medal: r.medal,
    medalKey: END_MEDAL_KEYS[r.medal ?? 'ninguna'],
    score: r.score,
    runMin: r.runMin,
    difficulty: r.difficulty,
  };
}

/** Lo que se lee en voz alta al acabar (`aria-live`). */
export function endAnnouncement(r: DefenseResult): Line {
  return { key: END_TITLE_KEYS[r.end] };
}
