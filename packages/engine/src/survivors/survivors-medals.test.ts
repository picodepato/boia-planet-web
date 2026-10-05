import { describe, expect, it } from 'vitest';
import { SURVIVORS_CONFIG, SURVIVORS_STEP_S, type SurvivorsConfig, actOf } from './config';
import { MEDALS, actFinalBoss, actMinibosses, medalWon, survivorsMedal } from './medals';
import { type EndReason, type SurvivorsGame, createSurvivors } from './sim';
import type { SurvivorsWorld } from './world';

/**
 * Las medallas (plan 012 T144, §8): bronce al amanecer, plata al amanecer
 * con los minibosses del acto vencidos, oro al vencer al boss final; `won`
 * es bronce o más. Y el atajo que vence a los bosses vivos
 * (`defeatBossesNow`), con el que las pruebas fuerzan cada final.
 */

const openSea = (): SurvivorsWorld => ({
  bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
  obstacles: [],
  start: { x: 0, y: 0, heading: 0 },
});

function withConfig(patch: (c: SurvivorsConfig) => void): SurvivorsConfig {
  const c = structuredClone(SURVIVORS_CONFIG);
  c.player.waterCapacity = 1e12;
  c.salvavidas.offerChance = 0;
  patch(c);
  return c;
}

const IDLE = { ship: { dirX: 0, dirY: 0, throttle: 0, drift: false }, choose: 0 };

function runToEnd(g: SurvivorsGame, maxS = 30): void {
  for (let i = 0; i < Math.round(maxS / SURVIVORS_STEP_S) && !g.ended; i++) g.step(IDLE);
}

const ACTS = SURVIVORS_CONFIG.acts.map((a) => a.act);
const REASONS: readonly (EndReason | null)[] = ['survived', 'flooded', 'abandoned', 'victory', 'quit', null];

describe('medallas T144: una por resultado', () => {
  it('los actos tienen sus minibosses y su boss final en el guion', () => {
    for (const act of ACTS) {
      expect(actMinibosses(act).length).toBeGreaterThan(0);
      expect(actFinalBoss(act)).not.toBeNull();
    }
    expect(actFinalBoss(1)).toBe('fantasma');
    expect(actMinibosses(99)).toEqual([]);
    expect(actFinalBoss(99)).toBeNull();
  });

  it('oro al vencer al boss final; plata al amanecer con los minibosses; bronce al amanecer; nada si se inunda o abandona', () => {
    for (const act of ACTS) {
      const minis = actMinibosses(act);
      const all = [...minis];
      expect(survivorsMedal({ end: 'victory', bossesDefeated: [actFinalBoss(act)!], act })).toBe('oro');
      expect(survivorsMedal({ end: 'victory', bossesDefeated: [...all, actFinalBoss(act)!], act })).toBe('oro');
      expect(survivorsMedal({ end: 'survived', bossesDefeated: all, act })).toBe('plata');
      expect(survivorsMedal({ end: 'survived', bossesDefeated: [], act })).toBe('bronce');
      // Falta uno de los minibosses: bronce.
      for (const id of minis) {
        expect(survivorsMedal({ end: 'survived', bossesDefeated: minis.filter((m) => m !== id), act })).toBe('bronce');
      }
      for (const end of ['flooded', 'abandoned', 'quit', null] as const) {
        expect(survivorsMedal({ end, bossesDefeated: all, act })).toBeNull();
      }
    }
  });

  it('un acto sin minibosses no da plata', () => {
    const cfg = withConfig((c) => {
      c.acts = [{ act: 1, durationS: c.durationS, tracks: [], events: [] }];
    });
    expect(survivorsMedal({ end: 'survived', bossesDefeated: [], act: 1 }, cfg)).toBe('bronce');
  });

  it('`won` es bronce o más: toda medalla gana, sin medalla se pierde', () => {
    for (const m of MEDALS) expect(medalWon(m)).toBe(true);
    expect(medalWon(null)).toBe(false);
    for (const end of REASONS) {
      const m = survivorsMedal({ end, bossesDefeated: [], act: 1 });
      expect(medalWon(m)).toBe(end === 'survived' || end === 'victory');
    }
  });
});

describe('medallas T144: partidas de verdad', () => {
  const finalSlot = (act: number) => actOf(SURVIVORS_CONFIG, act)!.events.find((e) => e.type === 'boss')!;

  it('vencer al boss final de cada acto acaba con `victory` y oro', () => {
    for (const act of ACTS) {
      const g = createSurvivors(withConfig(() => {}), 11, openSea(), { act, startAtS: finalSlot(act).atS + 2 });
      for (let i = 0; i < 30 && g.snapshot().bosses.length === 0; i++) g.step(IDLE);
      expect(g.snapshot().bosses.map((b) => b.boss)).toContain(actFinalBoss(act));
      expect(g.defeatBossesNow()).toBeGreaterThan(0);
      const s = g.snapshot();
      expect(s.end).toBe('victory');
      expect(s.finalBossDefeated).toBe(true);
      expect(s.bosses).toEqual([]);
      expect(survivorsMedal(s)).toBe('oro');
      expect(g.defeatBossesNow()).toBe(0);
    }
  });

  it('al amanecer: plata con los dos minibosses vencidos, bronce sin ellos (el boss final se retira)', () => {
    const noFinal = withConfig((c) => {
      c.acts = c.acts.map((a) => ({
        ...a,
        events: a.events.map((e) => (e.type === 'boss' ? { ...e, enabled: false } : e)),
      }));
    });
    const silver = createSurvivors(noFinal, 5, openSea(), { startAtS: 412 });
    for (const id of actMinibosses(1)) silver.spawnBoss(id, 400, 0);
    // (Empezar tarde ya trae los bosses de los huecos pasados que siguen vivos.)
    expect(silver.defeatBossesNow()).toBeGreaterThanOrEqual(actMinibosses(1).length);
    expect(silver.ended).toBe(false);
    expect(silver.snapshot().bossesDefeated).toEqual(expect.arrayContaining(actMinibosses(1)));
    runToEnd(silver);
    expect(silver.snapshot().end).toBe('survived');
    expect(survivorsMedal(silver.snapshot())).toBe('plata');

    const bronze = createSurvivors(withConfig(() => {}), 5, openSea(), { startAtS: 412 });
    runToEnd(bronze);
    const s = bronze.snapshot();
    expect(s.end).toBe('survived');
    expect(s.finalBossDefeated).toBe(false);
    expect(survivorsMedal(s)).toBe('bronce');
  });
});
