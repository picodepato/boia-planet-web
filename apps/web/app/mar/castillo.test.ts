import {
  DEFENSE_CONFIG,
  DEFENSE_STEP_S,
  DEFENSE_TOWER_KINDS,
  createDefense,
  defenseSiteReason,
} from '@boia/engine/defense';
import { describe, expect, it } from 'vitest';
import {
  DEV_WIN_LEAD_S,
  DefenseRun,
  castleShortcut,
  devArenaSpots,
  devTowerSpots,
  withoutCastleShortcut,
} from './castillo';

/**
 * «Defensa del Castillo» en `/mar` (plan 014 T160): el atajo de desarrollo
 * que empieza la arena, las siete islas del atajo `islas=1` (en sitios que la
 * regla de construir deja) y la partida que el bucle del mar da paso a paso.
 */

const env = { nodeEnv: 'development', webdriver: false, search: '' };

describe('el atajo `?minijuego=castillo`', () => {
  it('lee duración, dificultad, segundo, semilla e islas; sólo con los atajos encendidos', () => {
    expect(
      castleShortcut(
        '?minijuego=castillo&duracion=10&dificultad=tormenta&t=500&seed=7&islas=1',
        env,
      ),
    ).toEqual({
      t: 500,
      seed: 7,
      difficulty: 'tormenta',
      runMin: 10,
      islands: true,
      fullArena: false,
      coins: null,
      win: false,
      offer: false,
    });
    // `vencer=1` y `oferta=1` (T162).
    expect(castleShortcut('?minijuego=castillo&vencer=1&oferta=1', env)).toMatchObject({
      win: true,
      offer: true,
    });
    // `monedas=` (T161): monedas de más al empezar.
    expect(castleShortcut('?minijuego=castillo&monedas=800', env)?.coins).toBe(800);
    // `t` se acota a la partida elegida (5 min sin `duracion`).
    expect(castleShortcut('?minijuego=castillo&t=9999', env)?.t).toBe(
      DEFENSE_CONFIG.runs[5].durationS - 1,
    );
    expect(castleShortcut('?minijuego=canon', env)).toBeNull();
    expect(castleShortcut('?minijuego=castillo', { ...env, nodeEnv: 'production' })).toBeNull();
  });

  it('se consume al usarlo (`dev` se queda)', () => {
    expect(
      withoutCastleShortcut(
        'https://x.test/mar?minijuego=castillo&t=3&islas=1&duracion=7&monedas=50&vencer=1&oferta=1&dev=1',
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

  it('`islas=lleno`: la arena llena (todas las de la rejilla), sin pisarse ni pisar el camino', () => {
    expect(castleShortcut('?minijuego=castillo&islas=lleno', env)).toMatchObject({
      islands: true,
      fullArena: true,
    });
    const run = new DefenseRun({ seed: 7, quality: 'baja', devFullArena: true });
    const s = run.snapshot();
    const spots = devArenaSpots(run.game);
    expect(s.towers.length).toBe(spots.length);
    expect(s.towers.length).toBeGreaterThan(DEFENSE_TOWER_KINDS.length * 4);
    expect(new Set(s.towers.map((t) => t.kind))).toEqual(new Set(DEFENSE_TOWER_KINDS));
    expect(s.towers.every((t) => t.level === 3)).toBe(true);
    s.towers.forEach((t, i) => {
      const others = s.towers.filter((_, j) => j !== i);
      expect(defenseSiteReason(DEFENSE_CONFIG, run.game.path, others, t.x, t.y)).toBeNull();
    });
    run.quit();
    expect(run.game.result()?.ranked).toBe(false);
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

  /** Da pasos hasta que acaba (o `maxS` s de partida). */
  const playOut = (run: DefenseRun, maxS: number) => {
    for (let i = 0; i < maxS / DEFENSE_STEP_S && !run.ended; i++) run.step(null);
  };

  it('`vencer=1` (T162): empieza a punto de aguantar, gana con oro y no entra en el ranking', () => {
    let ended = 0;
    const run = new DefenseRun({
      seed: 3,
      quality: 'baja',
      runMin: 7,
      difficulty: 'tranquila',
      devWin: true,
      onEnd: () => ended++,
    });
    expect(run.devStart).toBe(true);
    const s = run.snapshot();
    expect(s.timeLeftS).toBeLessThanOrEqual(DEV_WIN_LEAD_S + 1e-6);
    playOut(run, DEV_WIN_LEAD_S + 2);
    const r = run.game.result()!;
    expect(ended).toBe(1);
    expect(r).toMatchObject({ end: 'held', medal: 'oro', runMin: 7, difficulty: 'tranquila' });
    expect(r.ranked).toBe(false);
  });

  it('una partida de atajo (aunque sólo cambie duración o dificultad) nunca entra en el ranking', () => {
    const plain = new DefenseRun({ seed: 5, quality: 'baja', runMin: 5, difficulty: 'tormenta' });
    const dev = new DefenseRun({
      seed: 5,
      quality: 'baja',
      runMin: 5,
      difficulty: 'tormenta',
      devStart: true,
    });
    expect(plain.devStart).toBe(false);
    expect(dev.devStart).toBe(true);
    const maxS = DEFENSE_CONFIG.runs[5].durationS + 1;
    playOut(plain, maxS);
    playOut(dev, maxS);
    const a = plain.game.result()!;
    const b = dev.game.result()!;
    // La misma partida (misma semilla, mismas entradas)…
    expect(b.end).toBe(a.end);
    expect(b.score).toBe(a.score);
    expect(['held', 'fallen']).toContain(a.end);
    // …pero sólo la de verdad cuenta.
    expect(a.ranked).toBe(true);
    expect(b.ranked).toBe(false);
  }, 60_000);

  it('avisa una vez al acabar', () => {
    let ends = 0;
    const run = new DefenseRun({ seed: 3, quality: 'alta', onEnd: () => ends++ });
    run.quit();
    run.quit();
    expect(ends).toBe(1);
    expect(run.hook().fin).toBe('quit');
  });
});
