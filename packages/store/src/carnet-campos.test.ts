import { describe, expect, it } from 'vitest';
import { carnetSchema } from './schema';

describe('Carnet sin artistas vistos ni valoraciones (REQ-IDE-019)', () => {
  it('el esquema del Carnet no tiene campos de artistas vistos, valoraciones ni estrellas', () => {
    const keys = Object.keys(carnetSchema.shape);
    expect(keys.length).toBeGreaterThan(5);
    expect(keys.filter((k) => /vist|seen|valora|rating|star|like|estrella/i.test(k))).toEqual([]);
  });
});
