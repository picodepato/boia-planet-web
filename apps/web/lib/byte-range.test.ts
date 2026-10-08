import { describe, expect, it } from 'vitest';
import { byteRange } from './byte-range';

/** Los clips de muestra por /api/art (plan 019 T216): Safari pide el vídeo por trozos. */
describe('byteRange', () => {
  it('sin cabecera o ilegible, entero', () => {
    expect(byteRange(null, 100)).toBeNull();
    expect(byteRange('bytes=-', 100)).toBeNull();
    expect(byteRange('items=0-1', 100)).toBeNull();
  });
  it('desde, hasta, el final y los últimos n', () => {
    expect(byteRange('bytes=0-1', 100)).toEqual([0, 1]);
    expect(byteRange('bytes=10-', 100)).toEqual([10, 99]);
    expect(byteRange('bytes=90-500', 100)).toEqual([90, 99]);
    expect(byteRange('bytes=-10', 100)).toEqual([90, 99]);
  });
  it('fuera del archivo', () => {
    expect(byteRange('bytes=100-', 100)).toBe('fuera');
    expect(byteRange('bytes=5-2', 100)).toBe('fuera');
  });
});
