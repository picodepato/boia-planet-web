import type {
  EvolutionDef,
  EvolutionId,
  PassiveId,
  StatId,
  SurvivorsConfig,
  UpgradeId,
  WeaponGain,
  WeaponId,
} from './config';

export type CardKind =
  | 'weapon-new'
  | 'weapon-level'
  | 'vinyl-new'
  | 'vinyl-level'
  | 'evolution'
  | 'fallback'
  | 'salvavidas';
export type SalvavidasState = 'absent' | 'held' | 'consumed';

export interface Inventory {
  weapons: readonly { id: WeaponId; level: number; evolutionId?: EvolutionId | null }[];
  vinyls: readonly { id: PassiveId; level: number }[];
  salvavidas: SalvavidasState;
}

export interface CardOption {
  /** Canonical, unique within the offer; use as the UI key. */
  readonly id: string;
  readonly kind: CardKind;
  readonly weaponId?: WeaponId;
  readonly vinylId?: PassiveId;
  readonly evolutionId?: EvolutionId;
  readonly targetLevel: number;
  readonly nameKey: string;
  readonly textKey: string;
  readonly gains: readonly (WeaponGain | { stat: StatId; amount: number })[];
  readonly waterRemoved?: number;
  /** Transitional beta-1 HUD fields. upgrade is only an icon alias, not an identity. */
  readonly upgrade: UpgradeId;
  readonly i18nKey: string;
  readonly stat: StatId;
  readonly amount: number;
  readonly nextStack: number;
  readonly maxStacks: number;
}

/** Shared eligibility hook for level-up cards now and miniboss chests later. */
export function eligibleEvolutions(config: SurvivorsConfig, inventory: Inventory): EvolutionDef[] {
  return config.evolutions.filter((e) => {
    const w = inventory.weapons.find((w) => w.id === e.weapon);
    return (
      w !== undefined &&
      !w.evolutionId &&
      w.level === config.weapons[e.weapon]?.maxLevel &&
      inventory.vinyls.some((v) => v.id === e.passive && v.level > 0)
    );
  });
}

const legacyIcon = (stat: StatId): UpgradeId => {
  switch (stat) {
    case 'fireRateBonus':
      return 'fireRate';
    case 'extraProjectiles':
      return 'projectiles';
    case 'speedBonus':
      return 'speed';
    case 'magnetBonus':
      return 'magnet';
    case 'bailPerS':
      return 'bailing';
    default:
      return 'damage';
  }
};

const card = (
  id: string,
  kind: CardKind,
  nameKey: string,
  textKey: string,
  targetLevel: number,
  maxLevel: number,
  rest: Partial<CardOption> = {},
): CardOption => ({
  id,
  kind,
  nameKey,
  textKey,
  targetLevel,
  gains: [],
  upgrade: 'damage',
  i18nKey: textKey.match(/\.l\d$/) ? `${textKey}.card` : nameKey,
  stat: 'damageBonus',
  amount: 0,
  nextStack: targetLevel,
  maxStacks: maxLevel,
  ...rest,
});

/** La carta de una evolución (la de nivel y la del cofre son la misma). */
function evolutionCard(e: EvolutionDef): CardOption {
  return card(
    `evolution:${e.id}`,
    'evolution',
    e.i18nKey,
    `${e.i18nKey}.efecto`,
    e.evolvedWeapon.maxLevel,
    e.evolvedWeapon.maxLevel,
    { weaponId: e.weapon, vinylId: e.passive, evolutionId: e.id },
  );
}

/** Pure pool builder. Random draws and rare-item rolls belong to the seeded simulation. */
export function buildCardPool(
  config: SurvivorsConfig,
  inventory: Inventory,
  includeSalvavidas = false,
): CardOption[] {
  const pool: CardOption[] = [];
  for (const def of Object.values(config.weapons)) {
    if (!def) continue;
    const held = inventory.weapons.find((w) => w.id === def.id);
    if (held?.evolutionId || (held && held.level >= def.maxLevel)) continue;
    if (!held && inventory.weapons.length >= config.slots.weapons) continue;
    const level = (held?.level ?? 0) + 1;
    const textKey = level === 1 ? `${def.i18nKey}.l1` : def.levels[level - 2]!.i18nKey;
    pool.push(
      card(
        `weapon:${def.id}:${level}`,
        held ? 'weapon-level' : 'weapon-new',
        def.i18nKey,
        textKey,
        level,
        def.maxLevel,
        {
          weaponId: def.id,
          gains: held ? def.levels[level - 2]!.gains : [],
        },
      ),
    );
  }
  for (const def of Object.values(config.passives)) {
    if (!def) continue;
    const held = inventory.vinyls.find((v) => v.id === def.id);
    if (held && held.level >= def.maxLevel) continue;
    if (!held && inventory.vinyls.length >= config.slots.vinyls) continue;
    const level = (held?.level ?? 0) + 1;
    const gain = def.levels[level - 1]!;
    pool.push(
      card(
        `vinyl:${def.id}:${level}`,
        held ? 'vinyl-level' : 'vinyl-new',
        def.i18nKey,
        gain.i18nKey,
        level,
        def.maxLevel,
        {
          vinylId: def.id,
          gains: [{ stat: def.stat, amount: gain.amount }],
          upgrade: legacyIcon(def.stat),
          stat: def.stat,
          amount: gain.amount,
        },
      ),
    );
  }
  if (config.evolutionSource === 'level-up') {
    for (const e of eligibleEvolutions(config, inventory)) pool.push(evolutionCard(e));
  }
  if (includeSalvavidas && inventory.salvavidas === 'absent') {
    pool.push(
      card('salvavidas', 'salvavidas', config.salvavidas.i18nKey, config.salvavidas.textKey, 1, 1),
    );
  }
  if (pool.length === 0) {
    const f = config.fallback;
    pool.push(
      card(`fallback:${f.id}`, 'fallback', f.i18nKey, f.textKey, 1, 1, {
        upgrade: 'bailing',
        stat: 'bailPerS',
        waterRemoved: f.waterRemoved,
      }),
    );
  }
  return pool;
}

/**
 * Lo que puede dar el cofre de un miniboss (§4, T139): las evoluciones cuya
 * condición se cumple (el mismo gancho que las cartas de nivel,
 * `eligibleEvolutions`, venga de donde venga `evolutionSource`); si no hay
 * ninguna, una mejora gratis del mazo: subir de nivel un arma o vinilo que
 * llevas y, si no queda ninguna, lo nuevo que quepa. Nunca el Salvavidas;
 * con el mazo vacío, el achique de siempre. El sorteo entre las candidatas
 * lo hace la simulación con su azar.
 */
export function chestCandidates(config: SurvivorsConfig, inventory: Inventory): CardOption[] {
  const evolutions = eligibleEvolutions(config, inventory);
  if (evolutions.length > 0) return evolutions.map(evolutionCard);
  const pool = buildCardPool({ ...config, evolutionSource: 'chest' }, inventory, false);
  const levels = pool.filter((o) => o.kind === 'weapon-level' || o.kind === 'vinyl-level');
  return levels.length > 0 ? levels : pool;
}
