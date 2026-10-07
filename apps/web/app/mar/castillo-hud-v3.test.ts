import {
  DEFENSE_CONFIG,
  createDefense,
  defenseFarmPayout,
  defenseFarmShare,
  defenseTowerStats,
} from '@boia/engine/defense';
import { describe, expect, it } from 'vitest';
import { t } from '../../lib/i18n';
import { formatNum, towerDetail, towerPanel } from './castillo-hud-model';
import { COIN_POP_STYLE, DAMAGE_NUMBER_STYLE, DamageNumbers } from './engine/defense-overlays';

/**
 * Plan 016 T183, decisión 7: la ficha de Ibiza dice lo que paga de verdad
 * (`DefenseGame.farmPayout`, con su parte por orden de construcción) y trae
 * una explicación corta plegada; el «+N» de cada pago es grande, del mismo
 * tamaño en la pantalla con cualquier zoom, y se pinta encima de todo.
 */

const cfg = DEFENSE_CONFIG;

describe('Construir: el pago de la siguiente Ibiza (T197)', () => {
  it('la tarjeta de la 1.ª, 2.ª y 3.ª coincide con farmPayout al construirla', () => {
    const g = createDefense({ ...cfg, startCoins: 5000 }, 7);
    g.addTower('faro', 0, -700);
    [-600, 0, 600].forEach((x, rank) => {
      const s = g.snapshot();
      const detail = towerDetail(
        cfg,
        'tienda',
        s.coins,
        s.towers.filter((t) => t.kind === 'tienda').length,
      );
      const id = g.addTower('tienda', x, 700, { level: 1 }).id;
      const payout = g.farmPayout(id)!;
      expect(payout).toBe(defenseFarmPayout(cfg, 1, rank));
      expect(detail.how.params?.monedas).toBe(formatNum(payout));
      expect(detail.rows.find((r) => r.id === 'monedas')!.values[0]).toBe(formatNum(payout));
      for (const level of [2, 3]) {
        expect(g.upgradeTower(id)).toBe(true);
        expect(detail.rows.find((r) => r.id === 'monedas')!.values[level - 1]).toBe(
          formatNum(g.farmPayout(id)!),
        );
      }
    });
  });

  it('tras vender, sólo cuenta las Ibizas que siguen en pie', () => {
    const { g, ids } = threeFarms();
    g.sellTower(ids[0]!);
    const s = g.snapshot();
    const detail = towerDetail(
      cfg,
      'tienda',
      s.coins,
      s.towers.filter((t) => t.kind === 'tienda').length,
    );
    const id = g.addTower('tienda', -600, 700).id;
    expect(detail.how.params?.monedas).toBe(formatNum(g.farmPayout(id)!));
    expect(detail.how.params?.monedas).toBe(formatNum(defenseFarmPayout(cfg, 1, 2)));
  });
});

function threeFarms() {
  const g = createDefense(cfg, 7);
  const ids = [-600, 0, 600].map((x) => g.addTower('tienda', x, 700, { level: 1 }).id);
  return { g, ids };
}

describe('la ficha de Ibiza (plan 016, decisión 7)', () => {
  it('cada Ibiza dice lo que paga de verdad: la primera entera, las de más su parte', () => {
    const { g, ids } = threeFarms();
    const s = g.snapshot();
    ids.forEach((id, rank) => {
      const p = towerPanel(cfg, s, id, (x) => g.farmPayout(x))!;
      const pays = g.farmPayout(id)!;
      expect(pays).toBe(defenseFarmPayout(cfg, 1, rank));
      expect(p.farm).toMatchObject({
        coins: pays,
        everyS: defenseTowerStats(cfg, 'tienda', 1).cooldownS,
      });
      expect(p.how.params?.monedas).toBe(formatNum(pays));
      const first = t(p.farm!.lines[0]!.key, p.farm!.lines[0]!.params);
      expect(first).toContain(formatNum(pays));
      expect(first).toContain(formatNum(p.farm!.everyS));
    });
    // Las de más pagan menos, con las partes de la config.
    const p = towerPanel(cfg, s, ids[0]!, (x) => g.farmPayout(x))!;
    const more = t(p.farm!.lines[1]!.key, p.farm!.lines[1]!.params);
    expect(more).toContain(`${Math.round(defenseFarmShare(cfg, 1) * 100)} %`);
    expect(more).toContain(`${Math.round(defenseFarmShare(cfg, 2) * 100)} %`);
  });

  it('muy corta: dos frases; sólo en Ibiza', () => {
    const { g, ids } = threeFarms();
    const p = towerPanel(cfg, g.snapshot(), ids[1]!, (x) => g.farmPayout(x))!;
    expect(p.farm!.lines).toHaveLength(2);
    for (const l of p.farm!.lines) expect(t(l.key, l.params).length).toBeLessThan(90);
    const faro = g.addTower('faro', 0, -700, { level: 1 }).id;
    expect(towerPanel(cfg, g.snapshot(), faro, (x) => g.farmPayout(x))!.farm).toBeNull();
  });

  it('sin la partida a mano, lo de la config para la primera', () => {
    const { g, ids } = threeFarms();
    const p = towerPanel(cfg, g.snapshot(), ids[2]!)!;
    expect(p.farm!.coins).toBe(defenseFarmPayout(cfg, 1, 0));
  });
});

describe('el «+N» de Ibiza (plan 016, decisión 7)', () => {
  it('del mismo tamaño en la pantalla con cualquier zoom, encima de barras y números de daño', () => {
    expect(COIN_POP_STYLE.screen).toBeGreaterThan(0.04);
    expect(DAMAGE_NUMBER_STYLE.screen).toBe(0);
    const pops = new DamageNumbers(2, COIN_POP_STYLE);
    const numbers = new DamageNumbers(2);
    expect(pops.mesh.renderOrder).toBeGreaterThan(numbers.mesh.renderOrder);
    pops.spawn(0, 0, 14, 1);
    expect(pops.lastValue).toBe(14);
    pops.update(1.5, true, false);
    expect(pops.live).toBe(1);
    pops.dispose();
    numbers.dispose();
  });
});
