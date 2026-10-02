import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type ArtManifest,
  type Vec2,
  WORLD_REGISTRY,
  parseArtManifest,
  parseAssetRef,
  placePartArt,
} from '@boia/world';
import { describe, expect, it } from 'vitest';
import { objectArtFiles, startArt, worldArtPlan, worldAssetIds } from './art-plan';
import {
  REFERENCE_VIEW,
  STREAM_TUNING,
  detectQuality,
  lookaheadPoints,
  objectsBySector,
  onScreen,
  planObjects,
  planSectors,
  sectorAt,
  sectorsOf,
  viewExtent,
  voyagePreload,
} from './sectors';

/**
 * Carga por sectores (T47, REQ-MUN-012): qué se pide, qué se suelta y que
 * la precarga llega antes que la pantalla en el recorrido del puerto a la
 * última isla, con el mapa real de Arcilla.
 */

const ART = fileURLToPath(new URL('../../../../art/', import.meta.url));
const arcilla = WORLD_REGISTRY.get('arcilla').config;
const sectors = sectorsOf(arcilla);
const spawn = arcilla.spawn!;

function manifests(ids: Iterable<string>): Map<string, ArtManifest> {
  const out = new Map<string, ArtManifest>();
  for (const id of ids) {
    const ref = parseAssetRef(id);
    const raw = parseArtManifest(
      JSON.parse(readFileSync(path.join(ART, ref.base, 'manifest.json'), 'utf8')),
    );
    if (!raw.ok) continue;
    const m = ref.part ? placePartArt(raw.manifest, ref.part, ref.variant) : raw.manifest;
    if (m) out.set(id, m);
  }
  return out;
}
const art = manifests(worldAssetIds(arcilla));

describe('sectores del mapa', () => {
  it('el puerto es el sector del spawn', () => {
    expect(sectorAt(sectors, spawn)).toBe('puerto');
  });

  it('cada objeto activo tiene un sector de casa, y los de fuera van al más cercano', () => {
    const by = objectsBySector(arcilla);
    const active = arcilla.objects.filter((o) => o.identity.active);
    expect([...by.values()].flat()).toHaveLength(active.length);
    for (const [sid, objs] of by) for (const o of objs) expect(sectorAt(sectors, o.position)).toBe(sid);
  });

  it('un mundo sin sectores es un único sector con todo el mapa', () => {
    const one = sectorsOf({ sectors: [], bounds: arcilla.bounds });
    expect(one).toHaveLength(1);
    expect(one[0]!.area).toEqual(arcilla.bounds);
  });
});

describe('qué se pide y qué se suelta', () => {
  const tuning = STREAM_TUNING.alta;
  const ultima = arcilla.objects.find((o) => o.identity.id === 'ultima')!;

  it('en el puerto se pide el puerto y no la última isla', () => {
    const { want } = planSectors(sectors, [spawn], REFERENCE_VIEW, new Set(), tuning);
    expect(want[0]).toBe('puerto');
    expect(want).not.toContain('ultima');
    expect(want).not.toContain('allday');
  });

  it('con histéresis: lo cargado un poco más allá de la precarga se queda; lo lejano se suelta', () => {
    const loaded = new Set(sectors.map((s) => s.id));
    const { want, release } = planSectors(sectors, [spawn], REFERENCE_VIEW, loaded, {
      ...tuning,
      maxSectors: 99,
    });
    expect(release).toContain('ultima');
    for (const id of want) expect(release).not.toContain(id);
  });

  it('respeta el límite de sectores en memoria, soltando antes lo más lejano', () => {
    const loaded = new Set(sectors.map((s) => s.id));
    const { want, release } = planSectors(sectors, [spawn], REFERENCE_VIEW, loaded, {
      ...tuning,
      release: 1e6,
      maxSectors: 4,
    });
    expect(sectors.length - release.length).toBe(Math.max(4, want.length));
    expect(release).toContain('ultima');
  });

  it('mirando por delante se pide antes lo que viene', () => {
    const fast = lookaheadPoints(spawn, { x: 0, y: -3000 }, tuning.lookahead);
    const { want } = planSectors(sectors, fast, REFERENCE_VIEW, new Set(), tuning);
    const still = planSectors(sectors, [spawn], REFERENCE_VIEW, new Set(), tuning).want;
    expect(want.length).toBeGreaterThan(still.length);
    expect(want).toContain('fiestera');
  });

  it('los objetos cerca se piden y los lejanos se sueltan, por su posición de ese momento', () => {
    const states = arcilla.objects.map((o) => ({ id: o.identity.id, ...o.position }));
    const here = planObjects(states, [spawn], REFERENCE_VIEW, tuning);
    expect(here.want.has('puerto')).toBe(true);
    expect(here.keep.has('ultima')).toBe(false);
    // Un resto que reaparece junto al puerto se pide aunque su casa esté lejos.
    const moved = [...states, { id: 'restos-7', x: spawn.x + 100, y: spawn.y - 100 }];
    expect(planObjects(moved, [spawn], REFERENCE_VIEW, tuning).want.has('restos-7')).toBe(true);
    expect(onScreen(ultima.position, spawn, REFERENCE_VIEW)).toBe(false);
  });
});

/**
 * Del puerto a la última isla en línea recta a la velocidad del piloto
 * automático, con cada vista lista `latency` s después de pedirla: ningún
 * fotograma debe tener a la vista un objeto sin arte (lo que la e2e mide en
 * el navegador).
 */
function sail(
  from: Vec2,
  to: Vec2,
  speed: number,
  latency: number,
  width: number,
  height: number,
  voyage: boolean,
) {
  const view = viewExtent(width, height);
  const tuning = STREAM_TUNING.alta;
  const requested = new Map<string, number>();
  const states = arcilla.objects
    .filter((o) => o.identity.active)
    .map((o) => ({ id: o.identity.id, ...o.position }));
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const dt = 1 / 60;
  const v = { x: ((to.x - from.x) / dist) * speed, y: ((to.y - from.y) / dist) * speed };
  let missing = 0;
  // Antes de jugar se carga lo de alrededor del punto de partida; un viaje en
  // turbo espera además al primer tramo de su ruta (`voyagePreload`).
  const before = voyage ? [from, ...voyagePreload(from, to, speed)] : [from];
  for (const id of planObjects(states, before, view, tuning).want) requested.set(id, -latency);
  for (let t = 0; t * speed < dist; t += dt) {
    const ship = { x: from.x + v.x * t, y: from.y + v.y * t };
    const { want } = planObjects(states, lookaheadPoints(ship, v, tuning.lookahead), view, tuning);
    for (const id of want) if (!requested.has(id)) requested.set(id, t);
    for (const s of states) {
      const at = requested.get(s.id);
      const ready = at !== undefined && t >= at + latency;
      if (!ready && onScreen(s, ship, view)) missing++;
    }
  }
  return missing;
}

describe('sin arte ausente en la ruta', () => {
  const ultima = arcilla.objects.find((o) => o.identity.id === 'ultima')!.position;
  for (const [w, h] of [
    [1440, 900],
    [360, 640],
  ] as const) {
    // El piloto automático de /juego hace cualquier viaje en ≤ 8 s; aquí, en 6.
    it(`${w}×${h}: del puerto a la última isla en 6 s, con 0,4 s de carga por vista`, () => {
      const speed = Math.hypot(ultima.x - spawn.x, ultima.y - spawn.y) / 6;
      expect(sail(spawn, ultima, speed, 0.4, w, h, true)).toBe(0);
    });
    it(`${w}×${h}: a la velocidad del barco, con 1,5 s de carga por vista`, () => {
      expect(sail(spawn, ultima, 220, 1.5, w, h, false)).toBe(0);
    });
  }
});

describe('arte por sector', () => {
  it('cada archivo de un objeto está en el sector de su casa', () => {
    const plan = worldArtPlan(arcilla, art);
    const by = objectsBySector(arcilla);
    for (const [sid, objs] of by) {
      const keys = new Set(plan.sectors.get(sid)!.map((f) => f.key));
      for (const o of objs) for (const f of objectArtFiles(o, art)) expect(keys.has(f.key)).toBe(true);
    }
    expect(plan.coast.length).toBeGreaterThan(0);
  });

  it('antes de jugar en el puerto: el arte del puerto y las costas, no el de la última isla', () => {
    const s = startArt(arcilla, art, spawn);
    const keys = s.files.map((f) => f.key);
    expect(keys.some((k) => k.includes('/puerto/'))).toBe(true);
    expect(keys.some((k) => k.includes('/costa_sur/'))).toBe(true);
    expect(keys.some((k) => k.includes('/ultima/'))).toBe(false);
    expect(s.objects.every((o) => o.identity.id !== 'ultima')).toBe(true);
  });
});

describe('calidad según el dispositivo', () => {
  it('baja con ahorro de datos, poca memoria, pocos núcleos en táctil o texturas pequeñas', () => {
    expect(detectQuality({})).toBe('alta');
    expect(detectQuality({ saveData: true })).toBe('baja');
    expect(detectQuality({ deviceMemory: 2 })).toBe('baja');
    expect(detectQuality({ deviceMemory: 8, hardwareConcurrency: 4, touch: true })).toBe('baja');
    expect(detectQuality({ hardwareConcurrency: 4, touch: false })).toBe('alta');
    expect(detectQuality({ maxTextureSize: 2048 })).toBe('baja');
    expect(detectQuality({ maxTextureSize: 8192, deviceMemory: 8 })).toBe('alta');
  });
});
