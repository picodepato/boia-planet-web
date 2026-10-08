import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PRESENTATION,
  VIDEO_SCALE_SMALL,
  logoScale,
  presentationFrame,
  presentationStage,
  smallWindow,
  windowBox,
} from './presentation';

const PHONE = { w: 390, h: 844 };
const DESK = { w: 1440, h: 900 };
const P = PRESENTATION;
const mid = (a: number, b: number) => (a + b) / 2;
const sizeOf = (p: number, vw: number, vh: number) => {
  const b = windowBox(p, vw, vh);
  return { width: vw - b.left - b.right, height: vh - b.top - b.bottom };
};

describe('presentation (plan 021 T235): scroll → stage', () => {
  it('the stages come in order, each from its start', () => {
    const order = ['black', 'beats', 'window', 'open', 'full'] as const;
    expect(presentationStage(0)).toBe('hero');
    expect(presentationStage(-1)).toBe('hero');
    for (const s of order) {
      const at = s === 'black' ? 0.01 : P[s];
      expect(presentationStage(at), s).toBe(s);
    }
    const starts = [P.black, P.beats, P.window, P.open, P.full, P.end];
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    expect(presentationStage(P.end + 2)).toBe('full');
  });

  it('the hero first, then full black before «BOIA» comes in', () => {
    const rest = presentationFrame(0, DESK.w, DESK.h);
    expect(rest.veil).toBe(0);
    expect(rest.logoOpacity).toBe(0);
    expect(rest.video).toBe(0);
    expect(presentationFrame(mid(P.black, P.beats), DESK.w, DESK.h).veil).toBeGreaterThan(0);
    const black = presentationFrame(P.beats, DESK.w, DESK.h);
    expect(black.veil).toBe(1);
    expect(black.logoOpacity).toBe(0);
  });

  it('three beats: the logo holds between them and settles at the end', () => {
    const holds = [
      logoScale(mid(P.beats, P.window) - 0.3),
      logoScale(0.7),
      logoScale(0.98),
      logoScale(P.window - 0.01),
    ];
    // Four different holds (before, after beat 1, 2 and 3), each one flat.
    expect(new Set(holds.map((s) => s.toFixed(3))).size).toBe(4);
    expect(logoScale(0.69)).toBeCloseTo(logoScale(0.71), 6);
    expect(logoScale(P.full)).toBe(logoScale(P.window - 0.01));
    expect(presentationFrame(0.7, DESK.w, DESK.h).logoOpacity).toBe(1);
    // Orange on the black, white once the video is open behind it.
    expect(presentationFrame(P.open, DESK.w, DESK.h).logoWhite).toBe(0);
    expect(presentationFrame(P.full, DESK.w, DESK.h).logoWhite).toBe(1);
  });

  it('a slit opens to the small window, then the window opens to the full screen', () => {
    for (const { w, h } of [PHONE, DESK]) {
      const closed = sizeOf(P.window, w, h);
      expect(closed.height).toBe(0);
      const small = smallWindow(w, h);
      const atOpen = sizeOf(P.open, w, h);
      expect(atOpen.width).toBeCloseTo(small.width, 6);
      expect(atOpen.height).toBeCloseTo(small.height, 6);
      expect(small.width).toBeLessThanOrEqual(w / 2);
      expect(small.height).toBeLessThanOrEqual(h / 2);
      // Growing all the way, centred, and with no margin left at `full`.
      let last = 0;
      for (let p = P.window; p <= P.full; p += 0.02) {
        const s = sizeOf(p, w, h);
        expect(s.width * s.height).toBeGreaterThanOrEqual(last - 1e-6);
        last = s.width * s.height;
        const b = windowBox(p, w, h);
        expect(b.left).toBeCloseTo(b.right, 6);
        expect(b.top).toBeCloseTo(b.bottom, 6);
      }
      expect(windowBox(P.full, w, h)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
      expect(windowBox(P.end, w, h)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    }
  });

  it('a decisive start and a soft arrival', () => {
    const { w, h } = DESK;
    const len = P.full - P.open;
    const grow = (a: number, b: number) =>
      sizeOf(P.open + len * b, w, h).width - sizeOf(P.open + len * a, w, h).width;
    expect(grow(0, 0.1)).toBeGreaterThan(grow(0.9, 1) * 4);
  });

  it('the video covers its window at every step and ends at its own size', () => {
    for (const { w, h } of [PHONE, DESK]) {
      // The video covers the screen (object-fit: cover) and scales about the centre.
      for (let p = P.window; p <= P.end; p += 0.02) {
        const f = presentationFrame(p, w, h);
        const s = sizeOf(p, w, h);
        expect(w * f.videoScale).toBeGreaterThanOrEqual(s.width - 1e-6);
        expect(h * f.videoScale).toBeGreaterThanOrEqual(s.height - 1e-6);
      }
      expect(presentationFrame(P.open, w, h).videoScale).toBe(VIDEO_SCALE_SMALL);
      expect(presentationFrame(P.full, w, h).videoScale).toBe(1);
    }
  });

  it('plays only once its window is there, and is the same frame both ways (reversible)', () => {
    expect(presentationFrame(P.window - 0.01, DESK.w, DESK.h).playing).toBe(false);
    expect(presentationFrame(mid(P.window, P.open), DESK.w, DESK.h).playing).toBe(true);
    expect(presentationFrame(P.end + 1.5, DESK.w, DESK.h).playing).toBe(false);
    for (const p of [0.2, 0.8, 1.5, 2.1, 3]) {
      expect(presentationFrame(p, PHONE.w, PHONE.h)).toEqual(
        presentationFrame(p, PHONE.w, PHONE.h),
      );
    }
  });

  it('the CSS reserves the same track as the timeline (landing.css --reel-end)', () => {
    const css = readFileSync(path.resolve(__dirname, '../../app/(landing)/landing.css'), 'utf8');
    const m = /--reel-end:\s*([\d.]+)/.exec(css);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(P.end);
  });
});
