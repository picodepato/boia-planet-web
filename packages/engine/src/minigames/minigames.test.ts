import { parseWorldConfig } from '@boia/world';
import { describe, expect, it, vi } from 'vitest';
import { MINIGAME_REGISTRY } from './registry';
import {
  type MinigameRewardSink,
  grantMinigameReward,
  policyText,
  readBest,
  saveBest,
} from './rewards';
import type { MinigameResult } from './session';
import type { RewardRule } from './types';
import { MemoryStore } from '../ui/storage';
import { simulate } from '../world/simulate';

/**
 * El registro de INICIAR_MINIJUEGO y las reglas de premio comunes. El
 * minijuego del faro (la capa 2D, T60) se quitó en el plan 014 (T157): una
 * isla con `start_minigame` `faro` ya no tiene juego. La sesión y el premio
 * del Cañón se prueban en `world-canon.test.ts`.
 */

describe('registro de INICIAR_MINIJUEGO', () => {
  it('con el registro, el motor da `canon` por disponible y nada más (ni el faro)', () => {
    expect([...MINIGAME_REGISTRY.keys()]).toEqual(['canon']);
    const island = (id: string, x: number, gameId: string) => ({
      identity: { id, name: id, category: 'prueba' },
      appearance: { asset: 'placeholder:prueba' },
      position: { x, y: 900 },
      geometry: { activation: { shape: 'circle' as const, radius: 60 } },
      behaviors: [{ type: 'start_minigame' as const, params: { gameId } }],
    });
    const w = parseWorldConfig({
      id: 'prueba',
      version: 0,
      bounds: { left: 0, right: 4000, top: -20000, bottom: 4000 },
      objects: [island('faro', 500, 'faro'), island('canon', 1500, 'canon')],
    });
    const seen = (x: number) =>
      simulate(w, {
        seconds: 3,
        start: { x, y: 1200 },
        input: () => ({ dirX: 0, dirY: -1, throttle: 1, drift: false }),
        minigames: MINIGAME_REGISTRY,
      }).events.filter((e) => e.type === 'minigame');
    expect(seen(500)).toEqual([
      { type: 'minigame', objectId: 'faro', gameId: 'faro', available: false },
    ]);
    expect(seen(1500)).toEqual([
      { type: 'minigame', objectId: 'canon', gameId: 'canon', available: true },
    ]);
  });
});

describe('reglas de premio (REQ-AVE-038)', () => {
  const rule: RewardRule = {
    policy: 'daily',
    points: 150,
    coins: 50,
    maxPoints: 150,
    maxCoins: 50,
  };
  const result: MinigameResult = {
    sessionId: 'x',
    gameId: 'canon',
    version: 1,
    seed: 1,
    configHash: 'h',
    outcome: 'won',
    reason: 'survived',
    score: 10,
    elapsedMs: 60_000,
  };

  it('los límites de la regla acotan puntos y monedas; «sólo marca» no concede', async () => {
    const sink: MinigameRewardSink = { grantWorldReward: vi.fn(async () => ({ granted: true })) };
    const big = { ...rule, points: 999, coins: 999 };
    expect(await grantMinigameReward(sink, big, result, { valid: true })).toEqual({
      granted: true,
      points: rule.maxPoints,
      coins: rule.maxCoins,
    });
    expect(
      await grantMinigameReward(sink, { ...big, policy: 'record_only' }, result, { valid: true }),
    ).toEqual({ granted: false, reason: 'record_only' });
    expect(policyText(rule, 10)).toContain('10');
  });

  it('una partida inválida o perdida no pide nada al libro', async () => {
    const sink: MinigameRewardSink = { grantWorldReward: vi.fn(async () => ({ granted: true })) };
    expect(
      await grantMinigameReward(sink, rule, result, { valid: false, reason: 'replayed' }),
    ).toEqual({ granted: false, reason: 'replayed' });
    expect(
      await grantMinigameReward(sink, rule, { ...result, outcome: 'lost' }, { valid: true }),
    ).toEqual({ granted: false, reason: 'not_won' });
    expect(sink.grantWorldReward).not.toHaveBeenCalled();
  });

  it('la marca personal se guarda en el dispositivo y sólo sube', () => {
    const store = new MemoryStore();
    expect(readBest(store, 'canon')).toBeNull();
    expect(saveBest(store, 'canon', 30)).toBe(true);
    expect(saveBest(store, 'canon', 20)).toBe(false);
    expect(readBest(store, 'canon')).toBe(30);
  });
});
