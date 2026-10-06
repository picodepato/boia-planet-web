import {
  DEFENSE_CONFIG,
  DEFENSE_CONFIG_VERSION,
  type DefenseResult,
  defenseEnemyDef,
  defenseSchedule,
  defenseScore,
  defenseMedal,
} from '@boia/engine/defense';

/** Resultado coherente con las oleadas y la fórmula; las pruebas también juegan una sim real. */
export function castleResult(overrides: Partial<DefenseResult> = {}): DefenseResult {
  const runMin = overrides.runMin ?? 5;
  const difficulty = overrides.difficulty ?? 'normal';
  const durationS = DEFENSE_CONFIG.runs[runMin].durationS;
  const playedS = overrides.playedS ?? durationS;
  const end = overrides.end ?? 'held';
  const castleLife = overrides.castleLife ?? (end === 'held' ? 60 : 0);
  const killsByKind: Record<string, number> = {};
  let killPoints = 0;
  const defeated = defenseSchedule(DEFENSE_CONFIG, runMin, difficulty)
    .filter((s) => s.atS <= playedS)
    .slice(0, 20);
  for (const s of defeated) {
    killsByKind[s.kind] = (killsByKind[s.kind] ?? 0) + 1;
    killPoints += defenseEnemyDef(DEFENSE_CONFIG, s.kind)!.points;
  }
  const castleMaxLife = DEFENSE_CONFIG.castle.life;
  const score = defenseScore({ end, killPoints, castleLife, castleMaxLife });
  return {
    end,
    ranked: true,
    runMin,
    difficulty,
    durationS,
    playedS,
    castleLife,
    castleMaxLife,
    score: score.total,
    killPoints,
    lifeBonus: score.lifeBonus,
    medal: defenseMedal({ end, castleLife, castleMaxLife, activeS: playedS, durationS }),
    kills: defeated.length,
    killsByKind,
    bossesDefeated: [],
    coinsEarned: 100,
    planeLevel: 1,
    towersBuilt: 0,
    configVersion: DEFENSE_CONFIG_VERSION,
    ...overrides,
  };
}

export function memoryCastleStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
