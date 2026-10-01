import { DIRECTIONS, WORLD_REGISTRY, directionHeading } from '@boia/world';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_INTRO_CONFIG as CFG } from './config';
import {
  GAME_BOTTOM_LAND_PX,
  onScreen,
  portCamera,
  revealCamera,
  shipViewFor,
  validateWorldIntro,
  type IntroPoints,
  type WorldIntro,
} from './port';
import { realAssets } from './test-fixtures';
import { landingCamera } from './timeline';
import { worldIntroSetup } from './world-geometry';

/** Entrada de prueba: los datos de cada mundo viven en la web (`lib/intro/worlds.ts`). */
const INTRO: WorldIntro = {
  arrival: [
    { minWidth: 0, zoom: 1.3, anchor: [0.5, 0.3] },
    { minWidth: 900, zoom: 1.45, anchor: [0.5, 0.34] },
  ],
  miniWorld: { span: 2400, reach: 2600 },
  explore: { durationMs: 1300, easing: 'easeInOutSine' },
};

// El mundo activo por defecto (Arcilla) sobre el mapa compartido, con sus puntos.
const map = WORLD_REGISTRY.map;
const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
const POINTS: IntroPoints = {
  landing: map.introLanding,
  spawn: map.spawn,
  port: map.port ?? map.spawn,
};
const setup = worldIntroSetup(world, CFG, INTRO, POINTS, realAssets().artScale)!;

const MOBILE = { width: 360, height: 640 };

describe('cámara del puerto y alejamiento', () => {
  const r = setup.reveal;

  it('la franja de tierra bajo el mapa es la misma que la del juego', () => {
    const game = readFileSync(new URL('../game.ts', import.meta.url), 'utf8');
    const m = /const BOTTOM_LAND_PX = (\d+(?:\.\d+)?);/.exec(game);
    expect(m, 'BOTTOM_LAND_PX en game.ts').not.toBeNull();
    expect(GAME_BOTTOM_LAND_PX).toBe(Number(m![1]));
  });

  it('centra el barco salvo junto al borde de abajo, donde la cámara no baja más', () => {
    const tall = { width: 360, height: 20 };
    expect(portCamera(r, tall)).toMatchObject({ x: r.ship.x, y: r.ship.y, zoom: 1 });
    const c = portCamera(r, MOBILE);
    expect(c.y).toBeCloseTo(r.floorY - MOBILE.height / 2);
    expect(c.y).toBeLessThan(r.ship.y);
  });

  it('empieza en la cámara de llegada y termina en la del puerto', () => {
    const from = landingCamera(setup.config, setup.geometry, MOBILE);
    const to = portCamera(r, MOBILE);
    const p = { x: r.ship.x + 40, y: r.ship.y - 90 };
    const a = revealCamera(from, to, MOBILE, 0, 'easeInOutSine');
    expect(onScreen(a, p).x).toBeCloseTo(onScreen(from, p).x);
    expect(onScreen(a, p).y).toBeCloseTo(onScreen(from, p).y);
    expect(revealCamera(from, to, MOBILE, 1, 'easeInOutSine')).toEqual(to);
  });

  it('la vista del barco sale del rumbo, como en el juego', () => {
    for (const d of DIRECTIONS) expect(shipViewFor(directionHeading(d))).toBe(d);
    expect(shipViewFor(-Math.PI / 2)).toBe('N');
  });

  it('valida los datos de entrada de un mundo', () => {
    expect(validateWorldIntro(INTRO).ok).toBe(true);
    const bad = (patch: Partial<WorldIntro>) => validateWorldIntro({ ...INTRO, ...patch }).ok;
    // Llegar más lejos que el juego haría que EXPLORAR acercase en vez de alejarse.
    expect(bad({ arrival: [{ minWidth: 0, zoom: 0.72, anchor: [0.5, 0.3] }] })).toBe(false);
    expect(bad({ arrival: [{ minWidth: 10, zoom: 1.2, anchor: [0.5, 0.3] }] })).toBe(false);
    expect(bad({ arrival: [] })).toBe(false);
    expect(bad({ miniWorld: { span: 10, reach: 0 } })).toBe(false);
    expect(bad({ explore: { durationMs: 99_999, easing: 'linear' } })).toBe(false);
    expect(validateWorldIntro(null).ok).toBe(false);
  });
});
