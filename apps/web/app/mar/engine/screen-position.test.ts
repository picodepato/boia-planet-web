import { Group, PerspectiveCamera, Vector2 } from 'three';
import { describe, expect, it } from 'vitest';
import { Mar3D } from './mar3d';

// Sólo la geometría de proyección: no necesita crear un renderer WebGL.
function renderer() {
  const camera = new PerspectiveCamera(40, 800 / 600, 0.1, 500);
  camera.position.set(0, 20, 20);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const boat = { group: new Group() };
  const canvas = {
    clientWidth: 800,
    clientHeight: 600,
    getBoundingClientRect: () => ({ left: 73, top: 41 }),
  };
  const instance = Object.create(Mar3D.prototype) as Mar3D;
  Object.assign(instance, {
    camera,
    boat,
    bend: 0.001,
    wrapC: new Vector2(0, 0),
    periodS: { w: 1e6, h: 1e6 },
    opts: { canvas },
  });
  return instance;
}

describe('proyección pública del mar para la guía', () => {
  it('convierte u del mundo y suma el desplazamiento del lienzo en la ventana', () => {
    const r = renderer();
    const a = r.screenPosition({ x: 0, y: 0, height: 0.6 })!;
    expect(a.x).toBeCloseTo(73 + 400);
    expect(a.y).toBeGreaterThan(41);
    expect(a.y).toBeLessThan(41 + 600);
    expect(r.screenPosition({ x: 160, y: 0 })!.x).toBeGreaterThan(a.x);
  });

  it('el avión usa el barco interpolado a su altura visible', () => {
    const r = renderer();
    expect(r.screenPosition('boat')).toEqual(r.screenPosition({ x: 0, y: 0, height: 0.6 }));
  });

  it('un objetivo fuera del lienzo no da un punto visible', () => {
    expect(renderer().screenPosition({ x: 16000, y: 0 })).toBeNull();
  });

  it('la isla se proyecta desde la posición usada por su modelo, sólo durante la partida', () => {
    const r = renderer();
    Object.assign(r, {
      defense: {
        view: { at: (x: number, y: number) => ({ x: (x + 20) / 16, z: (y + 40) / 16 }) },
      },
    });
    expect(r.screenPosition({ defense: { x: 12, y: 34 } })).toEqual(r.screenPosition({ x: 32, y: 74 }));
    Object.assign(r, { defense: null });
    expect(r.screenPosition({ defense: { x: 12, y: 34 } })).toBeNull();
  });
});
