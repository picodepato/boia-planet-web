import { worldToScreen } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { INTRO_MANIFEST_IDS, resolveIntroAssets } from './assets';
import { DEFAULT_INTRO_CONFIG, pickFraming, validateIntroConfig } from './config';
import { readArtManifests, realAssets, realGeometry, sampleWorld } from './test-fixtures';
import { worldIntroGeometry } from './world-geometry';

const clone = () => structuredClone(DEFAULT_INTRO_CONFIG) as unknown as Record<string, unknown>;

describe('configuración de la entrada (REQ-ENT-015, D-19)', () => {
  it('la configuración por defecto es válida, de muestra, y trae «BOIA» (REQ-ENT-003)', () => {
    const r = validateIntroConfig(DEFAULT_INTRO_CONFIG);
    expect(r.ok, r.ok ? '' : r.error).toBe(true);
    expect(DEFAULT_INTRO_CONFIG.status).toBe('muestra');
    expect(DEFAULT_INTRO_CONFIG.copy.title).toBe('BOIA');
  });

  it('el avance automático de la pausa viene apagado hasta que Hernán lo confirme', () => {
    expect(DEFAULT_INTRO_CONFIG.pause.autoAdvance.enabled).toBe(false);
    // Implementado y configurable: encenderlo sigue siendo una configuración válida.
    const c = clone() as { pause: { autoAdvance: { enabled: boolean } } };
    c.pause.autoAdvance.enabled = true;
    expect(validateIntroConfig(c).ok).toBe(true);
  });

  it('rechaza con el campo que falla', () => {
    const c = clone();
    (c.landing as { durationMs: number }).durationMs = 60_000;
    (c.copy as { enter: string }).enter = ' ';
    (c.pause as { autoAdvance: unknown }).autoAdvance = { enabled: 'sí', afterMs: 8000 };
    const r = validateIntroConfig(c);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('landing.durationMs');
      expect(r.error).toContain('copy.enter');
      expect(r.error).toContain('pause.autoAdvance.enabled');
    }
  });

  it('rechaza una configuración de otra versión (la v1 de T03 tenía otra forma)', () => {
    expect(validateIntroConfig({ ...clone(), version: 1 }).ok).toBe(false);
  });

  it('los encuadres se eligen por ancho de vista', () => {
    const [mobile, ...rest] = DEFAULT_INTRO_CONFIG.framings;
    expect(pickFraming(DEFAULT_INTRO_CONFIG, 360)).toBe(mobile);
    const widest = rest.at(-1) ?? mobile;
    expect(pickFraming(DEFAULT_INTRO_CONFIG, 4000)).toBe(widest);
  });

  it('el punto de aterrizaje de muestra es la isla de evento del mundo de muestra', () => {
    const world = sampleWorld();
    const island = world.objects.find((o) => o.behaviors.some((b) => b.type === 'ticket'))!;
    expect(DEFAULT_INTRO_CONFIG.landingPoint).toEqual({
      x: island.position.x,
      y: island.position.y,
    });
    expect(realGeometry().landing).toEqual(worldToScreen(island.position));
  });

  it('un punto de aterrizaje fuera del mundo deja la entrada sin jugar (landing ligera)', () => {
    const cfg = { ...DEFAULT_INTRO_CONFIG, landingPoint: { x: -50, y: 10 } };
    expect(worldIntroGeometry(sampleWorld(), cfg, 1)).toBeNull();
  });
});

describe('recursos de la ilustración ligera desde los manifiestos de art/', () => {
  it('resuelve la isla de evento y el barco de los manifiestos reales', () => {
    const a = realAssets();
    expect(a.island.url).toMatch(/^\/api\/art\/isla-evento\//);
    expect(a.ship.url).toMatch(/^\/api\/art\/barco\//);
    // Escala de juego: el barco mide `ship.lengthPx` de eslora (D-15).
    expect(a.artScale).toBeGreaterThan(0);
    expect(a.island.scale).toBeGreaterThan(0);
  });

  it('sin un manifiesto, dice cuál falta en vez de romper', () => {
    const manifests = readArtManifests();
    for (const id of INTRO_MANIFEST_IDS) {
      const partial = { ...manifests, [id]: undefined };
      const r = resolveIntroAssets(partial, '/api/art', DEFAULT_INTRO_CONFIG);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain(id);
    }
  });
});
