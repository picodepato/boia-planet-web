import { describe, expect, it } from 'vitest';
import { isSampleLink, SAMPLE_LINK_BASE } from './links';

describe('isSampleLink (plan 007 T82, P15)', () => {
  it('the sandbox and the reserved example domains are muestra', () => {
    for (const link of [
      `${SAMPLE_LINK_BASE}/instagram`,
      'https://EXAMPLE.com/x',
      'http://www.example.org',
      'https://shop.example.net:8080/a',
      'https://example.com',
      'hola@example.com',
      'mailto:hola@example.com?subject=hola',
    ]) {
      expect(isSampleLink(link), link).toBe(true);
    }
  });

  it('a real link, an own path or nothing is not', () => {
    for (const link of [
      'https://www.instagram.com/boia',
      'https://open.spotify.com/playlist/abc',
      'https://notexample.com/x',
      'https://example.com.evil.es/x',
      'hola@boia.es',
      'mailto:hola@boia.es',
      '/contenido/carteles/halloween-2026.webp',
      '',
      null,
      undefined,
    ]) {
      expect(isSampleLink(link), String(link)).toBe(false);
    }
  });
});
