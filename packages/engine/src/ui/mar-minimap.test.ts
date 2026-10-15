import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAR_MINIMAP_ZONE,
  MAR_MINIMAP_ZONES,
  MAR_MINIMAP_ZONE_KEY,
  MINIMAP_ZONES,
  MINIMAP_ZONE_KEY,
  loadMarMinimapZone,
  otherMarMinimapZone,
  saveMarMinimapZone,
  snapMarMinimap,
} from './hud-layout';
import { LONG_PRESS_MS, MinimapGesture, minimapRelease } from './minimap';
import { MemoryStore } from './storage';

/**
 * El minimapa de /mar se mueve otra vez (plan 032 T298, REQ-MUN-021): con
 * «Mover el minimapa» de Ajustes, porque allí un toque largo abre el mapa
 * grande. En modo mover, ningún gesto abre el mapa.
 */
describe('mover el minimapa de /mar (T298)', () => {
  it('en modo mover, ni un toque, ni una pulsación larga, ni un arrastre abren el mapa grande', () => {
    const results = [
      null,
      { kind: 'tap' as const },
      { kind: 'drop' as const, x: 300, y: 80 },
      { kind: 'cancel' as const },
    ];
    for (const result of results) {
      for (const still of [true, false]) {
        const r = minimapRelease({ moving: true, result, still });
        expect(r).not.toBe('toggle-map');
        expect(r).toBe(still ? 'swap' : 'drop');
      }
    }
  });

  it('el gesto real: pulsación larga y arrastre en modo mover suelta el minimapa, no abre el mapa', () => {
    const g = new MinimapGesture();
    g.down(0, 40, 90);
    g.move(LONG_PRESS_MS + 50, 40, 90);
    g.move(LONG_PRESS_MS + 100, 320, 100);
    const result = g.up(LONG_PRESS_MS + 150);
    expect(result?.kind).toBe('drop');
    expect(minimapRelease({ moving: true, result, still: false })).toBe('drop');
    // Fuera del modo mover, el mismo arrastre tampoco abre el mapa (ni mueve nada).
    expect(minimapRelease({ moving: false, result, still: false })).toBe('none');
  });

  it('fuera del modo mover sigue como antes: tocar abre el mapa; un roce, no', () => {
    expect(minimapRelease({ moving: false, result: { kind: 'tap' }, still: true })).toBe(
      'toggle-map',
    );
    expect(
      minimapRelease({ moving: false, result: { kind: 'drop', x: 0, y: 0 }, still: true }),
    ).toBe('toggle-map');
    expect(minimapRelease({ moving: false, result: { kind: 'cancel' }, still: false })).toBe(
      'none',
    );
    expect(minimapRelease({ moving: false, result: null, still: true })).toBe('none');
  });

  it('se suelta en el lado donde quedó su centro; tocarlo lo cambia de lado', () => {
    expect(snapMarMinimap(375, 40)).toBe('top-left');
    expect(snapMarMinimap(375, 300)).toBe('top-right');
    expect(snapMarMinimap(1280, 639)).toBe('top-left');
    expect(snapMarMinimap(1280, 641)).toBe('top-right');
    for (const z of MAR_MINIMAP_ZONES) {
      expect(otherMarMinimapZone(z)).not.toBe(z);
      expect(otherMarMinimapZone(otherMarMinimapZone(z))).toBe(z);
      expect(MINIMAP_ZONES).toContain(z);
    }
  });

  it('la posición se guarda y vuelve al recargar; lo que no se entiende, al sitio de siempre', () => {
    const store = new MemoryStore();
    expect(loadMarMinimapZone(store)).toBe(DEFAULT_MAR_MINIMAP_ZONE);
    expect(DEFAULT_MAR_MINIMAP_ZONE).toBe('top-left');
    saveMarMinimapZone(store, 'top-right');
    expect(loadMarMinimapZone(store)).toBe('top-right');
    store.setItem(MAR_MINIMAP_ZONE_KEY, 'middle-left');
    expect(loadMarMinimapZone(store)).toBe(DEFAULT_MAR_MINIMAP_ZONE);
    // Va aparte de la del minimapa del 2D.
    expect(MAR_MINIMAP_ZONE_KEY).not.toBe(MINIMAP_ZONE_KEY);
  });
});
