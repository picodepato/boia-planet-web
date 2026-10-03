import { Color, type Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { C } from './palette';
import { ROAD_BUOY, roadMarkers } from './race-props';

/** Los colores de los vértices de las boyitas (una sola pieza fusionada). */
function colorsOf(group: ReturnType<typeof roadMarkers>): Set<string> {
  const mesh = group.children[0] as Mesh;
  const col = mesh.geometry.getAttribute('color');
  const out = new Set<string>();
  const c = new Color();
  for (let i = 0; i < col.count; i++) {
    c.setRGB(col.getX(i), col.getY(i), col.getZ(i));
    out.add(c.getHexString());
  }
  return out;
}

const hex = (s: string) => new Color(s).getHexString();

/** Las boyitas de los lados de la carretera, naranjas a los dos lados (T96). */
describe('las boyitas de la carretera', () => {
  it('el color de las boyitas es el naranja de la marca, con franja blanca', () => {
    expect(ROAD_BUOY.body).toBe(C.orange);
    expect(ROAD_BUOY.band).toBe(C.white);
  });

  it('las de la derecha y las de la izquierda son iguales: naranja y blanco', () => {
    const right = colorsOf(roadMarkers([[0, 0]], []));
    const left = colorsOf(roadMarkers([], [[0, 0]]));
    expect([...right].sort()).toEqual([hex(C.orange), hex(C.white)].sort());
    expect([...left].sort()).toEqual([...right].sort());
    // Ni rastro del rojo de antes.
    expect(left.has(hex(C.red))).toBe(false);
    expect(right.has(hex(C.red))).toBe(false);
  });

  it('la misma pieza en el mismo sitio, sea de un lado o del otro', () => {
    const a = (roadMarkers([[3, 4]], []).children[0] as Mesh).geometry;
    const b = (roadMarkers([], [[3, 4]]).children[0] as Mesh).geometry;
    expect(Array.from(b.getAttribute('color').array)).toEqual(
      Array.from(a.getAttribute('color').array),
    );
    expect(Array.from(b.getAttribute('position').array)).toEqual(
      Array.from(a.getAttribute('position').array),
    );
  });
});
