import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type ArtManifest,
  SAMPLE_WORLD,
  type WorldConfigInput,
  type WorldObjectInput,
  parseArtManifest,
  parseShipManifest,
  parseWorldConfig,
} from '@boia/world';
import { describe, expect, it } from 'vitest';
import type { ShipInput } from '../ship/controller';
import { DEFAULT_SHIP_CONFIG } from '../ship/config';
import { simulate } from './simulate';
import { resolveObjectVisual, shipArtScale } from './visual';

/**
 * §48.1: la apariencia no decide el comportamiento. El mismo objeto con otro
 * asset se dibuja distinto y la simulación da exactamente la misma traza.
 * Los manifiestos son los reales de `art/` (T01).
 */

const ART = fileURLToPath(new URL('../../../../art/', import.meta.url));

function loadArt(): Map<string, ArtManifest> {
  const out = new Map<string, ArtManifest>();
  for (const dir of readdirSync(ART)) {
    if (dir === 'barco' || dir === 'mundos') continue;
    // Carpetas sin manifiesto propio (art/intro/: el título de la entrada, T27).
    if (!existsSync(`${ART}${dir}/manifest.json`)) continue;
    const r = parseArtManifest(JSON.parse(readFileSync(`${ART}${dir}/manifest.json`, 'utf8')));
    if (!r.ok) throw new Error(`${dir}: ${r.error}`);
    out.set(r.manifest.id, r.manifest);
  }
  return out;
}

const art = loadArt();
const ship = parseShipManifest(JSON.parse(readFileSync(`${ART}barco/manifest.json`, 'utf8')));
const scale = shipArtScale(ship.ok ? ship.manifest : null);

/** Recto al norte 5 s (atraviesa lo que haya en x = 500); después zigzag con drift. */
const route = (seconds: number): ShipInput => {
  const t = (seconds * DEFAULT_SHIP_CONFIG.maxSpeed) / 220;
  return {
    dirX: t < 5 ? 0 : Math.sin(t * 0.9) * 0.6,
    dirY: -1,
    throttle: t % 7 < 6 ? 1 : 0,
    drift: t > 5 && t % 5 > 4,
  };
};

function withAsset(o: WorldObjectInput, asset: string): WorldObjectInput {
  return { ...o, appearance: { ...o.appearance, asset } };
}

function swapAll(w: WorldConfigInput, pick: (o: WorldObjectInput) => string): WorldConfigInput {
  return { ...w, objects: (w.objects ?? []).map((o) => withAsset(o, pick(o))) };
}

describe('sustituir el asset de un objeto (§48.1, REQ-MUN-002)', () => {
  const obstacle: WorldObjectInput = {
    identity: { id: 'obstaculo', name: 'Obstáculo lento', category: 'obstaculo' },
    appearance: { asset: 'roca-a' },
    position: { x: 500, y: 1400 },
    geometry: { collision: { shape: 'circle', radius: 30 } },
    behaviors: [{ type: 'collision', params: { mode: 'slow', intensity: 0.6, duration: 2 } }],
  };
  const rock: WorldObjectInput = {
    identity: { id: 'roca', name: 'Roca', category: 'obstaculo' },
    appearance: { asset: 'roca-a' },
    position: { x: 505, y: 1100 },
    geometry: { collision: { shape: 'circle', radius: 20 } },
    behaviors: [{ type: 'collision', params: { mode: 'bounce' } }],
  };
  const base: WorldConfigInput = {
    id: 'sustitucion',
    version: 0,
    bounds: { left: 0, right: 1000, top: 0, bottom: 2000 },
    spawn: { x: 500, y: 1800 },
    objects: [obstacle, rock],
  };

  it.each([
    ['roca-a', 'roca-b'],
    ['roca-a', 'isla-pequena'],
    ['roca-a', 'placeholder:cocodrilo'],
  ])('%s → %s: se dibuja distinto y la traza es idéntica', (from, to) => {
    const a = parseWorldConfig(swapAll(base, () => from));
    const b = parseWorldConfig(swapAll(base, () => to));

    const va = resolveObjectVisual(a.objects[0]!, art, scale);
    const vb = resolveObjectVisual(b.objects[0]!, art, scale);
    expect(vb).not.toEqual(va);
    expect(va.kind).toBe('sprite');

    const ta = simulate(a, { seconds: 10, input: route });
    const tb = simulate(b, { seconds: 10, input: route });
    // La traza no es trivial: choca con el obstáculo lento y con la roca.
    const hits = ta.events.filter((e) => e.type === 'contact').map((e) => e.objectId);
    expect(hits).toEqual(expect.arrayContaining(['obstaculo', 'roca']));
    expect(tb.trace).toEqual(ta.trace);
  });

  it('REQ-MUN-023 (P2, prueba 2): el cocodrilo se convierte en roca cambiando sólo el asset', () => {
    const croc: WorldObjectInput = {
      ...obstacle,
      identity: { id: 'cocodrilo', name: 'Cocodrilo', category: 'obstaculo' },
      appearance: { asset: 'placeholder:cocodrilo' },
    };
    const before = parseWorldConfig({ ...base, objects: [croc, rock] });
    const after = parseWorldConfig({ ...base, objects: [withAsset(croc, 'roca-a'), rock] });
    const [c0, c1] = [before.objects[0]!, after.objects[0]!];
    // Sólo cambia la apariencia: identidad, posición, geometría y comportamientos, iguales.
    expect({ ...c1, appearance: c0.appearance }).toEqual(c0);
    expect(c1.appearance.asset).toBe('roca-a');
    expect(resolveObjectVisual(c0, art, scale).kind).toBe('placeholder');
    expect(resolveObjectVisual(c1, art, scale).kind).toBe('sprite');
    // Y se comporta igual: el mismo frenazo, la misma traza.
    const ta = simulate(before, { seconds: 10, input: route });
    const tb = simulate(after, { seconds: 10, input: route });
    expect(ta.events.some((e) => e.type === 'contact' && e.objectId === 'cocodrilo')).toBe(true);
    expect(tb.events).toEqual(ta.events);
    expect(tb.trace).toEqual(ta.trace);
  });

  it('el mundo de muestra entero con arte o con marcadores se comporta igual', () => {
    const real = parseWorldConfig(SAMPLE_WORLD);
    const bare = parseWorldConfig(
      swapAll(SAMPLE_WORLD, (o) => `placeholder:${o.identity.category}`),
    );
    const visuals = (w: typeof real) =>
      w.objects.map((o) => resolveObjectVisual(o, art, scale).kind);
    expect(visuals(real).every((k) => k === 'sprite')).toBe(true);
    expect(visuals(bare).every((k) => k === 'placeholder')).toBe(true);

    const ta = simulate(real, { seconds: 30, input: route });
    const tb = simulate(bare, { seconds: 30, input: route });
    expect(ta.events.length).toBeGreaterThan(0);
    expect(tb.trace).toEqual(ta.trace);
  });
});
