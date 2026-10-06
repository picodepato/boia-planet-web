import {
  DEFENSE_CONFIG,
  DEFENSE_PLANE_MAX_LEVEL,
  DEFENSE_STEP_S,
  DEFENSE_TARGET_PRIORITIES,
  DEFENSE_TOWER_KINDS,
  type DefenseEnemyKind,
  defenseCastleMaxLevel,
  defenseTowerStats,
  type DefenseResult,
  createDefense,
  defenseSchedule,
} from '@boia/engine/defense';
import { SURVIVORS_CONFIG } from '@boia/engine/survivors';
import { describe, expect, it } from 'vitest';
import { t } from '../../lib/i18n';
import {
  BUILD_REASON_KEYS,
  END_TITLE_KEYS,
  LIFE_ALERT,
  LIFE_DANGER,
  END_LINE_KEYS,
  END_MEDAL_KEYS,
  TOWER_NAME_KEYS,
  buildOptions,
  castleEndView,
  castleView,
  defenseBossBar,
  defenseBossNotices,
  formatClock,
  levelLine,
  lifeLevelOf,
  nextTowerByKeyboard,
  placementView,
  WAVE_WARN_S,
  anyUpgradeAffordable,
  callWaveLine,
  formatNum,
  nextWaveView,
  priorityOptions,
  towerDetail,
  towerHowLine,
  towerStatRows,
  upgradeRowLine,
  upgradeRows,
  waveWarningLine,
  sameCastleView,
  seenBosses,
  sellLine,
  towerAt,
  towerPanel,
  upgradeLine,
  waveAt,
} from './castillo-hud-model';
import { DefenseRun } from './castillo';
import { CASTLE_ISLAND_IMAGES } from '../../lib/mundo/castle-island-images';

/**
 * El modelo del HUD de «Defensa del Castillo» (plan 014 T161): precios y si
 * llega el dinero, la vista previa con su motivo, los textos de Mejorar y
 * Vender, la vida y el tiempo, la oleada, el boss y elegir islas. Los números
 * salen siempre de la config (`DEFENSE_CONFIG`), nunca escritos a mano.
 */

const cfg = DEFENSE_CONFIG;
const kinds = cfg.towers.kinds;

describe('construir: las siete islas con su precio', () => {
  it('salen las siete, en el orden de la config, con el precio de la config', () => {
    const opts = buildOptions(cfg, 1e6);
    expect(opts.map((o) => o.kind)).toEqual([...DEFENSE_TOWER_KINDS]);
    for (const o of opts) {
      expect(o.cost).toBe(kinds[o.kind].cost);
      expect(o.affordable).toBe(true);
      expect(t(o.nameKey)).not.toBe(o.nameKey);
      expect(t(o.roleKey)).not.toBe(o.roleKey);
    }
  });

  it('en gris justo por debajo del precio (las monedas se cuentan enteras)', () => {
    for (const kind of DEFENSE_TOWER_KINDS) {
      const cost = kinds[kind].cost;
      const at = (coins: number) =>
        buildOptions(cfg, coins).find((o) => o.kind === kind)!.affordable;
      expect(at(cost)).toBe(true);
      expect(at(cost - 0.5)).toBe(false);
      expect(at(cost - 1)).toBe(false);
    }
  });
});

describe('la vista previa al colocar', () => {
  it('verde con «Aquí se puede», roja con el motivo de la regla (T159)', () => {
    const ok = placementView({ ok: true, cost: 100 });
    expect(ok).toMatchObject({ ok: true, cost: 100, reason: null, key: 'mar.castillo.colocar.ok' });
    for (const reason of Object.keys(BUILD_REASON_KEYS) as (keyof typeof BUILD_REASON_KEYS)[]) {
      const bad = placementView({ ok: false, reason, cost: 80 });
      expect(bad).toMatchObject({ ok: false, reason, cost: 80, key: BUILD_REASON_KEYS[reason] });
      expect(t(bad.key)).not.toBe(bad.key);
    }
  });

  it('sobre el camino, la partida dice «path» y la vista lo escribe', () => {
    const g = createDefense(cfg, 7);
    const s = g.path.sampleAt(g.path.length * 0.5);
    const check = g.buildCheck('faro', s.x, s.y);
    expect(check).toMatchObject({ ok: false, reason: 'path' });
    // Se construye en cualquier sitio de la arena (plan 015): el motivo es el camino.
    const view = placementView(check);
    expect(view.ok).toBe(false);
    expect(t(view.key)).toBe(t(BUILD_REASON_KEYS.path));
  });
});

describe('la ficha de una isla: nivel, Mejorar y Vender', () => {
  const game = () => {
    const g = createDefense(cfg, 7);
    g.refund(5000);
    return g;
  };

  it('nivel 1 → 2 → 3 con el precio de la config; en el 3, «Nivel máximo»', () => {
    for (const kind of DEFENSE_TOWER_KINDS) {
      const g = game();
      const id = g.addTower(kind, 0, 600, { level: 1 }).id;
      let p = towerPanel(cfg, g.snapshot(), id)!;
      expect(p).toMatchObject({
        kind,
        level: 1,
        maxLevel: 3,
        upgradeCost: kinds[kind].upgradeCost[0],
        canUpgrade: true,
      });
      expect(t(upgradeLine(p).key, upgradeLine(p).params)).toContain(
        String(kinds[kind].upgradeCost[0]),
      );
      g.upgradeTower(id);
      p = towerPanel(cfg, g.snapshot(), id)!;
      expect(p).toMatchObject({ level: 2, upgradeCost: kinds[kind].upgradeCost[1] });
      g.upgradeTower(id);
      p = towerPanel(cfg, g.snapshot(), id)!;
      expect(p).toMatchObject({ level: 3, upgradeCost: null, canUpgrade: false });
      expect(upgradeLine(p).key).toBe('mar.castillo.isla.max');
      expect(t(levelLine(p.level).key, levelLine(p.level).params)).toContain('3/3');
    }
  });

  it('Vender dice lo que devuelve la partida', () => {
    const g = game();
    const id = g.addTower('cala', 0, 600, { level: 1, spent: kinds.cala.cost }).id;
    const p = towerPanel(cfg, g.snapshot(), id)!;
    expect(p.sellValue).toBeGreaterThan(0);
    expect(p.sellValue).toBe(g.towerSellValue(id));
    expect(t(sellLine(p).key, sellLine(p).params)).toContain(`+${p.sellValue}`);
  });

  it('sin dinero no se puede mejorar (y la ficha lo dice)', () => {
    const g = createDefense(cfg, 7);
    const id = g.addTower('fotos', 0, 600, { level: 1 }).id;
    g.spend(Math.floor(g.snapshot().coins));
    expect(towerPanel(cfg, g.snapshot(), id)!.canUpgrade).toBe(false);
  });

  it('una isla que ya no está (vendida) no tiene ficha', () => {
    expect(towerPanel(cfg, { towers: [], coins: 0 }, 3)).toBeNull();
    expect(towerPanel(cfg, { towers: [], coins: 0 }, null)).toBeNull();
  });
});

describe('mejoras: el avión (velocidad y daño, 1–5) y la vida del castillo (plan 015 T171)', () => {
  const row = (rows: ReturnType<typeof upgradeRows>, id: string) => rows.find((r) => r.id === id)!;

  it('las tres filas con el nivel, el precio y lo de ahora → lo del siguiente, de la config', () => {
    const g = createDefense(cfg, 7);
    g.refund(1e5);
    const rows = upgradeRows(cfg, g.snapshot());
    expect(rows.map((r) => r.id)).toEqual(['speed', 'damage', 'castle']);
    expect(row(rows, 'speed')).toMatchObject({
      level: 1,
      maxLevel: DEFENSE_PLANE_MAX_LEVEL,
      cost: cfg.plane.speedCost[0],
      affordable: true,
    });
    expect(row(rows, 'damage')).toMatchObject({ level: 1, cost: cfg.plane.damageCost[0] });
    expect(row(rows, 'castle')).toMatchObject({
      level: 1,
      maxLevel: defenseCastleMaxLevel(cfg),
      cost: cfg.castle.upgradeCost[0],
    });
    const dmg = row(rows, 'damage').value;
    expect(t(dmg.key, dmg.params)).toContain(`${cfg.plane.damage[0]} → ${cfg.plane.damage[1]}`);
    const life = row(rows, 'castle').value;
    expect(t(life.key, life.params)).toContain(
      `${cfg.castle.life} → ${cfg.castle.life + cfg.castle.lifePerLevel}`,
    );
    const spd = row(rows, 'speed').value;
    expect(t(spd.key, spd.params)).toContain(formatNum(cfg.plane.cooldownS[1]!));
    for (const r of rows) {
      const l = upgradeRowLine(r);
      expect(t(l.key, l.params)).toContain(String(r.cost));
      expect(t(r.nameKey)).not.toBe(r.nameKey);
    }
    expect(anyUpgradeAffordable(rows)).toBe(true);
  });

  it('suben hasta el tope (5 el avión, el castillo hasta su último nivel) y allí «Máximo»', () => {
    const g = createDefense(cfg, 7);
    g.refund(1e5);
    for (let i = 0; i < 20; i++) {
      g.upgradePlane('speed');
      g.upgradePlane('damage');
      g.upgradeCastle();
    }
    const rows = upgradeRows(cfg, g.snapshot());
    expect(row(rows, 'speed')).toMatchObject({ level: DEFENSE_PLANE_MAX_LEVEL, cost: null });
    expect(row(rows, 'damage')).toMatchObject({ level: DEFENSE_PLANE_MAX_LEVEL, cost: null });
    expect(row(rows, 'castle')).toMatchObject({ level: defenseCastleMaxLevel(cfg), cost: null });
    for (const r of rows) {
      expect(r.affordable).toBe(false);
      expect(upgradeRowLine(r).key).toBe('mar.castillo.mejora.max');
      expect(t(r.value.key, r.value.params)).not.toContain('→');
    }
    expect(anyUpgradeAffordable(rows)).toBe(false);
  });

  it('sin dinero no se puede pagar (y se dice)', () => {
    const g = createDefense(cfg, 7);
    g.spend(g.purse);
    const rows = upgradeRows(cfg, g.snapshot());
    expect(rows.every((r) => !r.affordable)).toBe(true);
  });

  it('DefenseRun: las mejoras del HUD llegan a la partida en el paso siguiente', () => {
    const run = new DefenseRun({ seed: 7, quality: 'alta', devCoins: 9000 });
    for (let i = 0; i < DEFENSE_PLANE_MAX_LEVEL + 1; i++) {
      run.upgradePlane('speed');
      run.step(null);
      run.upgradePlane('damage');
      run.step(null);
    }
    run.upgradeCastle();
    run.step(null);
    const s = run.snapshot();
    expect(s.plane.speedLevel).toBe(DEFENSE_PLANE_MAX_LEVEL);
    expect(s.plane.damageLevel).toBe(DEFENSE_PLANE_MAX_LEVEL);
    expect(s.castle.level).toBe(2);
    expect(run.hook()).toMatchObject({
      avionVelocidad: DEFENSE_PLANE_MAX_LEVEL,
      avionNivel: DEFENSE_PLANE_MAX_LEVEL,
      castilloNivel: 2,
    });
  });
});

describe('el detalle de cada isla (decisión 13): foto, cómo hace daño y la tabla', () => {
  it('cada isla tiene su foto de T172 en la lista, el detalle, colocar y la ficha', () => {
    for (const o of buildOptions(cfg, 0)) expect(o.image).toBe(CASTLE_ISLAND_IMAGES[o.kind]);
    for (const kind of DEFENSE_TOWER_KINDS)
      expect(towerDetail(cfg, kind, 0).image).toBe(CASTLE_ISLAND_IMAGES[kind]);
  });

  it('el texto lleva los números de la config de su nivel, sin huecos sin rellenar', () => {
    for (const kind of DEFENSE_TOWER_KINDS) {
      for (const level of [1, 2, 3]) {
        const l = towerHowLine(cfg, kind, level);
        const text = t(l.key, l.params);
        expect(text, `${kind} ${level}`).not.toMatch(/[{}]/);
        const st = defenseTowerStats(cfg, kind, level) as unknown as Record<string, number>;
        // El alcance (o las monedas de Ibiza) sale tal cual.
        const shown = kind === 'tienda' ? st.coins! : st.range!;
        expect(text, `${kind} ${level}`).toContain(formatNum(shown));
      }
    }
  });

  it('la tabla tiene un valor por nivel, sacado de la config', () => {
    for (const kind of DEFENSE_TOWER_KINDS) {
      const rows = towerStatRows(cfg, kind);
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(r.values).toHaveLength(3);
        expect(t(r.labelKey)).not.toBe(r.labelKey);
      }
      if (kind !== 'tienda') {
        const range = rows.find((r) => r.id === 'alcance')!;
        expect(range.values).toEqual(kinds[kind].levels.map((l) => formatNum(l.range)));
      }
    }
  });

  it('detalle: precio, si llega el dinero y la prioridad con que se construye', () => {
    const d = towerDetail(cfg, 'fotos', kinds.fotos.cost - 1);
    expect(d).toMatchObject({ kind: 'fotos', cost: kinds.fotos.cost, affordable: false });
    expect(d.priority).toBe(kinds.fotos.priority);
    expect(towerDetail(cfg, 'fotos', kinds.fotos.cost).affordable).toBe(true);
    expect(towerDetail(cfg, 'faro', 1e6).priority).toBeNull();
  });

  it('formatNum: coma decimal y dos decimales como mucho', () => {
    expect(formatNum(0.85)).toBe('0,85');
    expect(formatNum(1 / 3)).toBe('0,33');
    expect(formatNum(63)).toBe('63');
  });
});

describe('a quién apunta (decisión 12)', () => {
  it('las cuatro, con la de la isla marcada; ninguna en las que no eligen blanco', () => {
    const opts = priorityOptions('strongest');
    expect(opts.map((o) => o.priority)).toEqual([...DEFENSE_TARGET_PRIORITIES]);
    expect(opts.filter((o) => o.on).map((o) => o.priority)).toEqual(['strongest']);
    for (const o of opts) {
      expect(t(o.labelKey)).not.toBe(o.labelKey);
      expect(t(o.helpKey)).not.toBe(o.helpKey);
    }
    expect(priorityOptions(null)).toEqual([]);
  });

  it('la ficha dice la prioridad por defecto de su tipo y DefenseRun la cambia', () => {
    const run = new DefenseRun({ seed: 7, quality: 'alta', devIslands: true });
    const s = run.snapshot();
    for (const tw of s.towers) {
      const p = towerPanel(cfg, s, tw.id)!;
      expect(p.priority).toBe(kinds[tw.kind].priority);
      expect(t(p.how.key, p.how.params)).not.toMatch(/[{}]/);
    }
    const benidorm = s.towers.find((tw) => tw.kind === 'fotos')!;
    run.setPriority(benidorm.id, 'closest');
    run.step(null);
    expect(towerPanel(cfg, run.snapshot(), benidorm.id)!.priority).toBe('closest');
  });
});

describe('la oleada siguiente (decisión 10): aviso, jefe y «Llamar oleada»', () => {
  it('qué trae, cuándo, el bono por llamarla y cuándo avisa', () => {
    const g = createDefense(cfg, 7);
    const info = g.nextWave()!;
    const v = nextWaveView(cfg, info)!;
    expect(v.wave).toBe(info.wave + 1);
    expect(v.inS).toBe(Math.ceil(info.inS - 1e-6));
    expect(v.bonus).toBe(Math.round(info.inS * cfg.waves.callCoinsPerS));
    expect(v.warn).toBe(info.inS <= WAVE_WARN_S);
    expect(v.kinds.map((k) => k.count)).toEqual(info.kinds.map((k) => k.count));
    for (const k of v.kinds) expect(t(k.nameKey)).not.toBe(k.nameKey);
    expect(nextWaveView(cfg, null)).toBeNull();
  });

  it('el aviso nombra lo que viene y, si hay jefe, al jefe', () => {
    // Una oleada con jefe, del calendario de 5 min (la del primer jefe).
    const g = createDefense(cfg, 7, { runMin: 5 });
    let withBoss: NonNullable<ReturnType<typeof g.nextWave>> | null = null;
    let plain: NonNullable<ReturnType<typeof g.nextWave>> | null = null;
    for (let i = 0; i < 400 && !(withBoss && plain); i++) {
      const n = g.nextWave();
      if (!n) break;
      if (n.boss) withBoss ??= n;
      else plain ??= n;
      g.callWave();
    }
    expect(withBoss).not.toBeNull();
    expect(plain).not.toBeNull();
    const b = nextWaveView(cfg, withBoss)!;
    const lb = waveWarningLine(b, t);
    expect(lb.key).toBe('mar.castillo.anuncio.aviso.jefe');
    expect(t(lb.key, lb.params)).toContain(t(b.bossNameKey!));
    const p = nextWaveView(cfg, plain)!;
    const lp = waveWarningLine(p, t);
    expect(lp.key).toBe('mar.castillo.anuncio.aviso');
    const text = t(lp.key, lp.params);
    for (const k of p.kinds) expect(text).toContain(`${t(k.nameKey)} ×${k.count}`);
    expect(t(callWaveLine(p).key, callWaveLine(p).params)).toContain(String(p.bonus));
  });

  it('DefenseRun: «Llamar oleada» adelanta el calendario y paga; ×2 da dos pasos por cada uno', () => {
    const run = new DefenseRun({ seed: 7, quality: 'alta' });
    run.step(null);
    const s0 = run.snapshot();
    const next = s0.nextWave!;
    run.callWave();
    run.step(null);
    const s1 = run.snapshot();
    expect(s1.waveS).toBeGreaterThan(s1.activeS + next.inS - 1);
    expect(s1.coins).toBeGreaterThanOrEqual(
      s0.coins + Math.round(next.inS * cfg.waves.callCoinsPerS),
    );
    // La oleada del HUD cuenta con el calendario (no con el tiempo jugado).
    const list = defenseSchedule(cfg, s1.runMin, s1.difficulty);
    expect(castleView(s1, list, cfg).wave).toBe(next.wave + 1);
    expect(run.timeScale).toBe(1);
    run.timeScale = 2;
    expect(run.hook().escala).toBe(2);
    const a = run.tick(1000, false);
    const b = run.tick(1100, false);
    expect(a).toBe(0);
    expect(b).toBe(Math.floor((0.1 * 2) / DEFENSE_STEP_S + 1e-9));
  });
});

describe('arriba: vida, tiempo, oleada y monedas', () => {
  it('el tiempo como «m:ss», hacia arriba', () => {
    expect(formatClock(300)).toBe('5:00');
    expect(formatClock(299.2)).toBe('5:00');
    expect(formatClock(61)).toBe('1:01');
    expect(formatClock(0)).toBe('0:00');
  });

  it('la vida: ok, alerta desde la mitad y peligro desde un cuarto', () => {
    expect(lifeLevelOf(100)).toBe('ok');
    expect(lifeLevelOf(LIFE_ALERT + 1)).toBe('ok');
    expect(lifeLevelOf(LIFE_ALERT)).toBe('alerta');
    expect(lifeLevelOf(LIFE_DANGER + 1)).toBe('alerta');
    expect(lifeLevelOf(LIFE_DANGER)).toBe('peligro');
    expect(lifeLevelOf(0)).toBe('peligro');
  });

  it('la oleada en curso y cuántas hay, del calendario de la partida', () => {
    const list = defenseSchedule(cfg, 5, 'normal');
    const waves = list.filter((s) => s.wave >= 0);
    const total = Math.max(...waves.map((s) => s.wave)) + 1;
    expect(waveAt(list, 0)).toEqual({ wave: 0, total });
    const second = waves.find((s) => s.wave === 1)!;
    expect(waveAt(list, second.atS).wave).toBe(2);
    expect(waveAt(list, second.atS - 0.01).wave).toBe(1);
    expect(waveAt(list, 1e9).wave).toBe(total);
  });

  it('castleView: vida en % y su tramo, segundos que faltan, monedas enteras', () => {
    const g = createDefense(cfg, 7, { runMin: 5 });
    g.refund(0.6);
    const s = g.snapshot();
    const v = castleView(s, defenseSchedule(cfg, 5, s.difficulty));
    expect(v).toMatchObject({
      timeLeftS: cfg.runs[5].durationS,
      lifePct: 100,
      lifeLevel: 'ok',
      coins: Math.floor(s.coins),
      maxLife: cfg.castle.life,
    });
    expect(sameCastleView(v, castleView(s, defenseSchedule(cfg, 5, s.difficulty)))).toBe(true);
    expect(sameCastleView(v, { ...v, coins: v.coins + 1 })).toBe(false);
  });
});

describe('el boss del Cañón en el camino', () => {
  it('la barra va al boss más importante y sus avisos al llegar y al caer', () => {
    const bossKind = Object.keys(cfg.bosses)[0] as keyof typeof cfg.bosses;
    const enemy = (id: number, tier: 'boss' | 'miniboss', kind: string, hp: number) =>
      ({ id, kind, tier, boss: true, hp, maxHp: 200, distance: id, dead: false }) as never;
    const s1 = {
      enemies: [enemy(4, 'miniboss', bossKind, 100)],
      bossesDefeated: [] as DefenseEnemyKind[],
    };
    const bar = defenseBossBar(s1)!;
    expect(bar).toMatchObject({ id: 4, boss: bossKind, kind: 'miniboss', hpPct: 50 });
    expect(bar.nameKey).toBe(SURVIVORS_CONFIG.bosses[bossKind]!.i18nKey);
    const arrivals = defenseBossNotices(new Map(), [], s1, 10);
    expect(arrivals.map((n) => n.kind)).toEqual(['arrival']);
    // Cae: ya no está y su tipo sube en `bossesDefeated`.
    const gone = defenseBossNotices(
      seenBosses(s1),
      [],
      { enemies: [], bossesDefeated: [bossKind] },
      20,
    );
    expect(gone.map((n) => n.kind)).toEqual(['defeated']);
    // Llega a la muralla: ya no está y no cayó.
    const reached = defenseBossNotices(seenBosses(s1), [], { enemies: [], bossesDefeated: [] }, 20);
    expect(reached.map((n) => n.kind)).toEqual(['reached']);
    expect(defenseBossBar({ enemies: [] })).toBeNull();
  });
});

describe('elegir una isla con el dedo o con el teclado', () => {
  const towers = [
    { id: 1, x: 0, y: 500 },
    { id: 2, x: 300, y: 500 },
    { id: 3, x: 900, y: 0 },
  ];
  it('el toque elige la isla bajo el dedo (con holgura) o ninguna', () => {
    expect(towerAt(towers, 20, 510, 80)).toBe(1);
    expect(towerAt(towers, 150, 500, 80)).toBeNull();
  });
  it('la tecla I va de la más cercana al avión a la siguiente, y vuelve a empezar', () => {
    const plane = { x: 280, y: 500 };
    expect(nextTowerByKeyboard(towers, plane, null)).toBe(2);
    expect(nextTowerByKeyboard(towers, plane, 2)).toBe(1);
    expect(nextTowerByKeyboard(towers, plane, 1)).toBe(3);
    expect(nextTowerByKeyboard(towers, plane, 3)).toBe(2);
    expect(nextTowerByKeyboard([], plane, null)).toBeNull();
  });
});

describe('construir, mejorar y vender desde el HUD (DefenseRun)', () => {
  it('la isla va bajo el avión; un toque la mueve a cualquier sitio; Construir la levanta', () => {
    const run = new DefenseRun({ seed: 7, quality: 'alta', devCoins: 2000 });
    const s0 = run.snapshot();
    expect(run.placement()).toBeNull();
    run.startPlacing('tienda');
    const at = run.placement()!;
    expect(at).toMatchObject({ kind: 'tienda', x: s0.plane.x, y: s0.plane.y });
    // Un sitio libre lejos del avión (fuera del camino, del castillo y del vórtice).
    let spot: { x: number; y: number } | null = null;
    for (let a = Math.PI; a < Math.PI * 3 && !spot; a += 0.1) {
      for (let r = cfg.arenaRadius / 2; r <= cfg.arenaRadius && !spot; r += 20) {
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (run.game.buildCheck('tienda', x, y).ok) spot = { x, y };
      }
    }
    expect(spot).not.toBeNull();
    run.tap(spot!.x, spot!.y);
    expect(run.placement()!.check.ok).toBe(true);
    expect(run.confirmPlacing()).toBe(true);
    expect(run.placing).toBeNull();
    run.step(null);
    const s1 = run.snapshot();
    expect(s1.towers).toHaveLength(1);
    expect(s1.coins).toBe(s0.coins - kinds.tienda.cost);
    // Elegir con un toque, mejorar hasta 3 y vender.
    const tw = s1.towers[0]!;
    run.tap(tw.x + 5, tw.y);
    expect(run.selected).toBe(tw.id);
    run.upgradeSelected();
    run.step(null);
    run.upgradeSelected();
    run.step(null);
    expect(run.snapshot().towers[0]!.level).toBe(3);
    const refund = run.game.towerSellValue(tw.id)!;
    const before = run.snapshot().coins;
    run.sellSelected();
    expect(run.selected).toBeNull();
    run.step(null);
    expect(run.snapshot().towers).toHaveLength(0);
    expect(run.snapshot().coins).toBeGreaterThanOrEqual(before + refund);
  });

  it('en el camino no se construye: Construir no hace nada', () => {
    const run = new DefenseRun({ seed: 7, quality: 'alta', devCoins: 2000 });
    const g = run.game;
    // Un trozo del camino lejos del castillo y del vórtice (a media partida del camino).
    const best = g.path.sampleAt(g.path.length / 2);
    run.startPlacing('faro');
    run.tap(best.x, best.y);
    const at = run.placement()!;
    expect(at.check).toMatchObject({ ok: false, reason: 'path' });
    expect(run.confirmPlacing()).toBe(false);
    run.step(null);
    expect(run.snapshot().towers).toHaveLength(0);
  });

  it('el atajo `monedas=` suma al monedero y no entra en el ranking', () => {
    const run = new DefenseRun({ seed: 7, quality: 'alta', devCoins: 500 });
    expect(run.snapshot().coins).toBe(cfg.startCoins + 500);
    run.quit();
    expect(run.game.result()!.ranked).toBe(false);
  });
});

describe('la tarjeta final', () => {
  const result = (end: DefenseResult['end']): DefenseResult =>
    ({
      end,
      ranked: false,
      medal: null,
      score: 0,
      killPoints: 0,
      lifeBonus: 0,
      runMin: 5,
      difficulty: 'normal',
      durationS: 300,
      playedS: 61.7,
      castleLife: 40,
      castleMaxLife: 80,
      kills: 12,
      killsByKind: {},
      bossesDefeated: [],
      coinsEarned: 0,
      planeLevel: 1,
      planeSpeedLevel: 1,
      castleLevel: 1,
      wavesAheadS: 0,
      towersBuilt: 0,
      configVersion: 1,
    }) as DefenseResult;

  it('«Terminar partida»: «Partida terminada», corta (sin medalla ni ranking)', () => {
    const v = castleEndView(result('quit'));
    expect(v).toMatchObject({
      title: END_TITLE_KEYS.quit,
      short: true,
      played: '1:01',
      kills: 12,
      lifePct: 50,
    });
  });

  it('al aguantar o caer (T162): su línea, la medalla y los puntos', () => {
    const held = castleEndView({ ...result('held'), medal: 'plata', score: 1234 });
    expect(held).toMatchObject({
      short: false,
      medal: 'plata',
      medalKey: END_MEDAL_KEYS.plata,
      score: 1234,
      line: END_LINE_KEYS.held,
      runMin: 5,
      difficulty: 'normal',
    });
    const fallen = castleEndView(result('fallen'));
    expect(fallen).toMatchObject({ medal: null, medalKey: END_MEDAL_KEYS.ninguna });
    expect(t(fallen.line!)).not.toBe(END_LINE_KEYS.fallen);
    expect(castleEndView(result('quit')).line).toBeNull();
    for (const k of Object.values(END_MEDAL_KEYS)) expect(t(k)).not.toBe(k);
  });

  it('cada final tiene su título', () => {
    for (const end of ['held', 'fallen', 'abandoned', 'quit'] as const) {
      expect(t(castleEndView(result(end)).title)).not.toBe(END_TITLE_KEYS[end]);
    }
    expect(castleEndView(result('held')).short).toBe(false);
  });

  it('los nombres de las islas están todos', () => {
    for (const k of DEFENSE_TOWER_KINDS) expect(t(TOWER_NAME_KEYS[k])).not.toBe(TOWER_NAME_KEYS[k]);
  });
});
