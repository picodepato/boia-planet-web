import {
  DEFENSE_CONFIG,
  DEFENSE_TOWER_KINDS,
  createDefense,
  defenseSiteReason,
} from '@boia/engine/defense';
import { describe, expect, it } from 'vitest';
import { DefenseRun, castleShortcut, devTowerSpots, withoutCastleShortcut } from './castillo';

/**
 * «Defensa del Castillo» en `/mar` (plan 014 T160): el atajo de desarrollo
 * que empieza la arena, las siete islas del atajo `islas=1` (en sitios que la
 * regla de construir deja) y la partida que el bucle del mar da paso a paso.
 */

const env = { nodeEnv: 'development', webdriver: false, search: '' };

describe('el atajo `?minijuego=castillo`', () => {
  it('lee duración, dificultad, segundo, semilla e islas; sólo con los atajos encendidos', () => {
    expect(
      castleShortcut('?minijuego=castillo&duracion=10&dificultad=tormenta&t=500&seed=7&islas=1', env),
    ).toEqual({ t: 500, seed: 7, difficulty: 'tormenta', runMin: 10, islands: true, coins: null });
    // `monedas=` (T161): monedas de más al empezar.
    expect(castleShortcut('?minijuego=castillo&monedas=800', env)?.coins).toBe(800);
    // `t` se acota a la partida elegida (5 min sin `duracion`).
    expect(castleShortcut('?minijuego=castillo&t=9999', env)?.t).toBe(
      DEFENSE_CONFIG.runs[5].durationS - 1,
    );
    expect(castleShortcut('?minijuego=canon', env)).toBeNull();
    expect(
      castleShortcut('?minijuego=castillo', { ...env, nodeEnv: 'production' }),
    ).toBeNull();
  });

  it('se consume al usarlo (`dev` se queda)', () => {
    expect(
      withoutCastleShortcut(
        'https://x.test/mar?minijuego=castillo&t=3&islas=1&duracion=7&monedas=50&dev=1',
      ),
    ).toBe('https://x.test/mar?dev=1');
  });
});

describe('las islas del atajo `islas=1`', () => {
  it('siete sitios donde la regla de construir deja poner una isla, sin pisarse', () => {
    const game = createDefense(DEFENSE_CONFIG, 7);
    const spots = devTowerSpots(game);
    expect(spots).toHaveLength(DEFENSE_TOWER_KINDS.length);
    spots.forEach((p, i) => {
      const others = spots.filter((_, j) => j !== i);
      expect(defenseSiteReason(DEFENSE_CONFIG, game.path, others, p.x, p.y)).toBeNull();
    });
  });

  it('la partida empieza con las siete a nivel 3 y no entra en el ranking', () => {
    const run = new DefenseRun({ seed: 7, quality: 'baja', devIslands: true });
    const s = run.snapshot();
    expect(s.towers.map((t) => t.kind).sort()).toEqual([...DEFENSE_TOWER_KINDS].sort());
    expect(s.towers.every((t) => t.level === 3)).toBe(true);
    run.quit();
    expect(run.game.result()?.ranked).toBe(false);
  });
});

describe('la partida en el mar', () => {
  it('el avión se mueve con el mando y los enemigos salen del vórtice', () => {
    const run = new DefenseRun({ seed: 3, quality: 'alta' });
    const before = run.snapshot().plane;
    const x0 = before.x;
    const y0 = before.y;
    for (let i = 0; i < 60; i++) run.step({ x: 1, y: 0 });
    const after = run.snapshot().plane;
    expect(Math.hypot(after.x - x0, after.y - y0)).toBeGreaterThan(50);
    for (let i = 0; i < 60 * 6; i++) run.step(null);
    const s = run.snapshot();
    expect(s.enemies.length).toBeGreaterThan(0);
    expect(run.hook().enemigos).toBe(s.enemies.length);
    expect(run.hook().avion).toMatch(/^-?\d+,-?\d+$/);
  });

  it('avisa una vez al acabar', () => {
    let ends = 0;
    const run = new DefenseRun({ seed: 3, quality: 'alta', onEnd: () => ends++ });
    run.quit();
    run.quit();
    expect(ends).toBe(1);
    expect(run.hook().fin).toBe('quit');
  });
});
