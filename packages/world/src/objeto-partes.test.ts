import { describe, expect, it } from 'vitest';
import { parseWorldConfig } from './schema';

const base = {
  id: 'mundo-partes',
  version: 0,
  bounds: { left: 0, right: 1000, top: 0, bottom: 2000 },
};

describe('objeto del mundo: nueve partes (REQ-MUN-024)', () => {
  it('un objeto admite las nueve partes de §48.2 y las conserva al leerlo', () => {
    const w = parseWorldConfig({
      ...base,
      objects: [
        {
          identity: { id: 'roca-1', name: 'Roca', category: 'obstaculo' },
          appearance: { asset: 'placeholder:roca' },
          position: { x: 10, y: 20 },
          geometry: { collision: { shape: 'circle', radius: 30 } },
          behaviors: [],
          params: { fuerza: 1 },
          content: { titulo: 'Roca' },
          state: { visible: true },
          reward: { monedas: 5 },
        },
      ],
    });
    expect(Object.keys(w.objects[0]!).sort()).toEqual([
      'appearance',
      'behaviors',
      'content',
      'geometry',
      'identity',
      'params',
      'position',
      'reward',
      'state',
    ]);
  });
});
