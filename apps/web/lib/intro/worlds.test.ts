import { DEFAULT_INTRO_CONFIG, portCamera, validateWorldIntro } from '@boia/engine/intro';
import { worldToScreen } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { worlds } from '../mundo/demo-world';
import { EMPTY_WORLD_CONTENT, MAP_POINTS, composeLiveWorld } from '../admin/world';
import {
  DEFAULT_WORLD_INTRO,
  WORLD_INTROS,
  introForWorld,
  introPoints,
  worldIntroFor,
} from './worlds';

/** Escala de juego de la entrada (la del barco de `art/barco`); no cambia lo que se comprueba. */
const ART_SCALE = 0.5;
const map = worlds.map;

describe('entrada de cada mundo (T28)', () => {
  it('los datos de entrada son válidos y cada mundo registrado tiene la suya', () => {
    expect(validateWorldIntro(DEFAULT_WORLD_INTRO)).toMatchObject({ ok: true });
    for (const [id, w] of Object.entries(WORLD_INTROS)) {
      expect(validateWorldIntro(w), id).toMatchObject({ ok: true });
    }
    for (const id of worlds.ids()) {
      const w = worlds.get(id);
      const setup = introForWorld(id, w.config, map, {}, DEFAULT_INTRO_CONFIG, ART_SCALE);
      expect(setup, id).not.toBeNull();
      expect(setup!.config.landingPoint).toEqual({ x: map.introLanding.x, y: map.introLanding.y });
      expect(setup!.reveal.ship).toEqual(worldToScreen(map.spawn));
      expect(setup!.reveal.durationMs).toBe(worldIntroFor(id).explore.durationMs);
    }
  });

  it('el aterrizaje, la salida y el puerto que mueve el Admin mandan en la entrada', () => {
    const places = {
      [MAP_POINTS.introLanding]: { x: map.introLanding.x + 60, y: map.introLanding.y - 200 },
      [MAP_POINTS.spawn]: { x: map.spawn.x + 40, y: map.spawn.y - 120 },
      [MAP_POINTS.port]: { x: map.spawn.x + 40, y: map.spawn.y - 100 },
    };
    const p = introPoints(map, places);
    expect(p.landing).toEqual(places[MAP_POINTS.introLanding]);
    expect(p.spawn).toMatchObject(places[MAP_POINTS.spawn]);
    expect(p.port).toEqual(places[MAP_POINTS.port]);
    const id = worlds.defaultId;
    const live = composeLiveWorld(worlds, id, { ...EMPTY_WORLD_CONTENT, places });
    const setup = introForWorld(id, live.config, map, places, DEFAULT_INTRO_CONFIG, ART_SCALE)!;
    expect(setup.config.landingPoint).toEqual(places[MAP_POINTS.introLanding]);
    // El barco de la entrada y el del juego salen del mismo sitio.
    expect(live.config.spawn).toMatchObject(places[MAP_POINTS.spawn]);
    expect(setup.reveal.ship).toEqual(worldToScreen(live.config.spawn!));
  });

  it('EXPLORAR termina con el barco en el puerto del mundo activo, donde lo pone el juego', () => {
    for (const id of worlds.ids()) {
      const live = composeLiveWorld(worlds, id, EMPTY_WORLD_CONTENT);
      const setup = introForWorld(id, live.config, map, {}, DEFAULT_INTRO_CONFIG, ART_SCALE)!;
      for (const vp of [
        { width: 360, height: 640 },
        { width: 1280, height: 720 },
      ]) {
        const cam = portCamera(setup.reveal, vp);
        // El juego empieza con el barco en la salida del mundo y la cámara encima.
        const ship = worldToScreen(live.config.spawn!);
        expect(cam.x).toBe(ship.x);
        expect(cam.zoom).toBe(1);
        const port = worldToScreen(introPoints(map).port);
        expect(Math.abs(port.x - cam.x)).toBeLessThan(vp.width / 2);
        expect(Math.abs(port.y - cam.y)).toBeLessThan(vp.height / 2);
      }
    }
  });
});
