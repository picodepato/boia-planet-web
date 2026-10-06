import { describe, expect, it } from 'vitest';
import type { ShaderMaterial } from 'three';
import { RouteLine, VORTEX_INK, Wake } from './effects';

/** Las marcas amarillas de la ruta, fuera durante la carrera (decisión 13, T88). */
describe('RouteLine: escondida durante la carrera', () => {
  const dashes = [
    { x: 0, z: 0, angle: 0 },
    { x: 4, z: 1, angle: 0.3 },
  ];

  it('se ve con el barco y en el mapa', () => {
    const line = new RouteLine(dashes);
    for (const zoom of [0, 0.5, 1]) {
      line.update(zoom);
      expect(line.mesh.visible, `zoom ${zoom}`).toBe(true);
    }
  });

  it('escondida, `update(zoom)` no la vuelve a enseñar en ningún fotograma', () => {
    const line = new RouteLine(dashes);
    line.update(0);
    line.setSuppressed(true);
    expect(line.mesh.visible).toBe(false);
    for (const zoom of [0, 0.25, 0.5, 0.75, 1, 0]) {
      line.update(zoom);
      expect(line.mesh.visible, `zoom ${zoom}`).toBe(false);
    }
    expect(line.isSuppressed).toBe(true);
  });

  it('al acabar la carrera vuelve con el siguiente fotograma', () => {
    const line = new RouteLine(dashes);
    line.setSuppressed(true);
    line.update(1);
    line.setSuppressed(false);
    line.update(1);
    expect(line.mesh.visible).toBe(true);
    expect(line.isSuppressed).toBe(false);
  });

  it('sin marcas no se ve, escondida o no', () => {
    const line = new RouteLine([]);
    line.update(1);
    expect(line.mesh.visible).toBe(false);
  });
});

/**
 * La «Estela del vórtice» (plan 015 T175): la misma `Wake` con el estilo
 * `vortice` (bandas lila sobre negro); con el tinte del cosmético como lila.
 * Se dibuja igual donde se dibuje la estela: el estilo cambia sólo el color.
 */
describe('Wake: estilo del vórtice', () => {
  const sail = (w: Wake, s: number) => {
    for (let i = 0; i < 120; i++) w.update(1 / 60, i * 0.02, 0, 0, s, i / 60);
  };

  it('por defecto espuma; `vortice` enciende el remolino y el negro es el suyo', () => {
    const w = new Wake();
    const u = (w.mesh.material as ShaderMaterial).uniforms;
    expect(w.style).toBe('espuma');
    expect(u.uVortex!.value).toBe(0);
    w.setStyle('vortice');
    w.setTint(0xb98cff);
    expect(w.style).toBe('vortice');
    expect(u.uVortex!.value).toBe(1);
    expect((u.uInk!.value as { getHex(): number }).getHex()).toBe(VORTEX_INK);
    expect((u.uColor!.value as { getHex(): number }).getHex()).toBe(0xb98cff);
    w.setStyle('espuma');
    expect(u.uVortex!.value).toBe(0);
  });

  it('navegando se ve con los dos estilos, y parada no (ni con el vórtice)', () => {
    const foam = new Wake();
    sail(foam, 1);
    const vortex = new Wake();
    vortex.setStyle('vortice');
    sail(vortex, 1);
    expect(foam.visibility).toBeGreaterThan(0.5);
    expect(vortex.visibility).toBeGreaterThan(0.5);
    const g = vortex.mesh.geometry;
    // La posición a lo largo del trazo (0 en la popa, 1 al desvanecerse) llega al sombreador.
    const along = g.getAttribute('aAlong');
    expect(along.getX(0)).toBeLessThan(along.getX(along.count - 2));
    const still = new Wake();
    still.setStyle('vortice');
    sail(still, 0);
    expect(still.visibility).toBe(0);
  });
});
