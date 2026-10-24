import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PRESENTATION_1080_MIN_CSS_WIDTH,
  PRESENTATION_1080_MIN_MBPS,
  PRESENTATION_1080_MIN_PX,
  PRESENTATION_VIDEO,
  heroMediaKind,
  presentationVideoSrc,
} from './hero-media';

const publicFile = (url: string) => fileURLToPath(new URL(`../../public${url}`, import.meta.url));

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

describe('PRESENTATION_VIDEO.src1080 (plan 043 T323): the 1080p file', () => {
  it('points at the 1080p MP4 under /contenido/portada/', () => {
    expect(PRESENTATION_VIDEO.src1080).toBe('/contenido/portada/presentacion-1080.mp4');
    expect(heroMediaKind(PRESENTATION_VIDEO.src1080)).toBe('video');
  });

  it('exists, is ≤ 5 MB, bigger than the 720p one and starts with its index', () => {
    const file = publicFile(PRESENTATION_VIDEO.src1080);
    const size = statSync(file).size;
    expect(size).toBeLessThanOrEqual(5_000_000);
    expect(size).toBeGreaterThan(statSync(publicFile(PRESENTATION_VIDEO.src)).size);
    const head = readFileSync(file).subarray(0, 4096).toString('latin1');
    expect(head.slice(4, 8)).toBe('ftyp');
    const moov = head.indexOf('moov');
    const mdat = head.indexOf('mdat');
    expect(moov).toBeGreaterThan(0);
    expect(mdat === -1 || moov < mdat).toBe(true);
  });
});

describe('presentationVideoSrc (plan 043 T323): 1080p only on big screens and good connections', () => {
  const desktop = { width: 1920, height: 1080, dpr: 1 };
  const fast = { effectiveType: '4g', downlink: 10 };
  const hd = PRESENTATION_VIDEO.src1080;
  const sd = PRESENTATION_VIDEO.src;

  it('big screen + 4g + good downlink → 1080p', () => {
    expect(presentationVideoSrc({ ...desktop, connection: fast })).toBe(hd);
    expect(
      presentationVideoSrc({
        ...desktop,
        connection: { effectiveType: '4g', downlink: PRESENTATION_1080_MIN_MBPS },
      }),
    ).toBe(hd);
    // 4g without a downlink figure: the type is enough.
    expect(presentationVideoSrc({ ...desktop, connection: { effectiveType: '4g' } })).toBe(hd);
  });

  it('saveData → 720p', () => {
    expect(presentationVideoSrc({ ...desktop, connection: { ...fast, saveData: true } })).toBe(sd);
  });

  it('3g, an unknown type or a slow downlink → 720p', () => {
    expect(
      presentationVideoSrc({ ...desktop, connection: { effectiveType: '3g', downlink: 10 } }),
    ).toBe(sd);
    expect(presentationVideoSrc({ ...desktop, connection: { downlink: 10 } })).toBe(sd);
    expect(
      presentationVideoSrc({ ...desktop, connection: { effectiveType: '4g', downlink: 2 } }),
    ).toBe(sd);
  });

  it('small screen → 720p, even on a fast connection or without one', () => {
    expect(presentationVideoSrc({ width: 1280, height: 720, dpr: 1, connection: fast })).toBe(sd);
    expect(presentationVideoSrc({ width: 1280, height: 720, dpr: 1 })).toBe(sd);
  });

  it('the long side × dpr decides the screen, from a CSS width of 1024 px', () => {
    const px = PRESENTATION_1080_MIN_PX;
    const w = PRESENTATION_1080_MIN_CSS_WIDTH;
    expect(presentationVideoSrc({ width: w, height: 600, dpr: 2, connection: fast })).toBe(hd);
    expect(presentationVideoSrc({ width: px - 1, height: 400, dpr: 1, connection: fast })).toBe(sd);
    expect(presentationVideoSrc({ width: w - 1, height: 2000, dpr: 2, connection: fast })).toBe(sd);
  });

  it('a high-density phone (390×844 @3x) on fast 4g → 720p', () => {
    expect(presentationVideoSrc({ width: 390, height: 844, dpr: 3, connection: fast })).toBe(sd);
    expect(presentationVideoSrc({ width: 844, height: 390, dpr: 3, connection: fast })).toBe(sd);
  });

  it('1024×768 @1 → 720p (long side × dpr < 1440)', () => {
    expect(presentationVideoSrc({ width: 1024, height: 768, dpr: 1, connection: fast })).toBe(sd);
    expect(presentationVideoSrc({ width: 1024, height: 768, dpr: 1 })).toBe(sd);
  });

  it('1440×900 @1 on fast 4g → 1080p', () => {
    expect(presentationVideoSrc({ width: 1440, height: 900, dpr: 1, connection: fast })).toBe(hd);
  });

  it('no navigator.connection (Safari, Firefox) + big screen → 1080p', () => {
    expect(presentationVideoSrc(desktop)).toBe(hd);
    expect(presentationVideoSrc({ ...desktop, connection: null })).toBe(hd);
    expect(presentationVideoSrc({ width: 1280, height: 800, dpr: 2 })).toBe(hd);
  });
});
