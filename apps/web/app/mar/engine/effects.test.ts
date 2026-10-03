import { describe, expect, it } from 'vitest';
import { RouteLine } from './effects';

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
