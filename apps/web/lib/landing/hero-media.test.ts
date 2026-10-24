import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PRESENTATION_VIDEO, heroMediaKind } from './hero-media';

const publicFile = (url: string) =>
  fileURLToPath(new URL(`../../public${url}`, import.meta.url));

describe('PRESENTATION_VIDEO (plan 042 T322): the real video, not the sample', () => {
  it('points at the real files under /contenido/portada/', () => {
    expect(PRESENTATION_VIDEO.src).toBe('/contenido/portada/presentacion.mp4');
    expect(PRESENTATION_VIDEO.poster).toBe('/contenido/portada/presentacion.webp');
    expect(heroMediaKind(PRESENTATION_VIDEO.src)).toBe('video');
    expect(JSON.stringify(PRESENTATION_VIDEO)).not.toMatch(/muestra/);
  });

  it('the MP4 exists, is ≤ 2 MB and starts with its index (+faststart)', () => {
    const file = publicFile(PRESENTATION_VIDEO.src);
    expect(statSync(file).size).toBeLessThanOrEqual(2_000_000);
    const head = readFileSync(file).subarray(0, 4096).toString('latin1');
    expect(head.slice(4, 8)).toBe('ftyp');
    // `moov` before `mdat`: the browser can start before the whole file arrives.
    const moov = head.indexOf('moov');
    const mdat = head.indexOf('mdat');
    expect(moov).toBeGreaterThan(0);
    expect(mdat === -1 || moov < mdat).toBe(true);
  });

  it('the poster exists, is a WebP and is ≤ 120 kB', () => {
    const file = publicFile(PRESENTATION_VIDEO.poster);
    expect(statSync(file).size).toBeLessThanOrEqual(120_000);
    const head = readFileSync(file).subarray(0, 12).toString('latin1');
    expect(head.slice(0, 4)).toBe('RIFF');
    expect(head.slice(8, 12)).toBe('WEBP');
  });
});
