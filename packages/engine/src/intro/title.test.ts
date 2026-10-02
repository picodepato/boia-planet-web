import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_INTRO_CONFIG, validateIntroConfig } from './config';
import {
  TITLE_MANIFEST_ID,
  frameForYaw,
  resolveTitleSheet,
  titleExitMs,
  titlePoses,
  titleSettledMs,
  type LetterPose,
  type TitleSheet,
} from './title';

/** El manifiesto real que escribe tools/blender/intro/titulo.py. */
const manifest = JSON.parse(
  readFileSync(
    new URL(`../../../../art/${TITLE_MANIFEST_ID}/manifest.json`, import.meta.url),
    'utf8',
  ),
) as Record<string, unknown>;

const TEXT = DEFAULT_INTRO_CONFIG.copy.title;
const M = DEFAULT_INTRO_CONFIG.title;

function sheet(): TitleSheet {
  const r = resolveTitleSheet(manifest, '/api/art', TEXT);
  if (!r.ok) throw new Error(r.error);
  return r.sheet;
}

const N = TEXT.length;
const poses = (shownMs: number, exitMs: number | null = null, reduced = false) =>
  titlePoses(M, sheet(), N, { shownMs, exitMs, reduced });

const close = (a: LetterPose[], b: LetterPose[], eps = 1e-9) =>
  a.every((p, i) => {
    const q = b[i]!;
    return (
      Math.abs(p.y - q.y) < eps &&
      Math.abs(p.roll - q.roll) < eps &&
      Math.abs(p.scale - q.scale) < eps &&
      Math.abs(p.alpha - q.alpha) < eps &&
      Math.abs(p.yawDeg - q.yawDeg) < eps &&
      p.frame === q.frame
    );
  });

describe('hoja del título 3D (T27)', () => {
  it('el manifiesto de Blender da una hoja con una fila por letra del título', () => {
    const s = sheet();
    expect(s.letters.map((l) => l.char).join('')).toBe(TEXT);
    expect(s.rows).toBe(TEXT.length);
    expect(s.width).toBe(s.cols * s.cellW);
    expect(s.height).toBe(s.rows * s.cellH);
    expect(s.url).toBe(
      `/api/art/${TITLE_MANIFEST_ID}/${String((manifest.images as { webp: string }).webp)}`,
    );
    // Las letras van de izquierda a derecha y la palabra acaba en la última.
    const centers = s.letters.map((l) => l.centerPx);
    expect(centers).toEqual([...centers].sort((a, b) => a - b));
    const last = s.letters.at(-1)!;
    expect(last.centerPx + last.widthPx / 2).toBeCloseTo(s.wordWidthPx, 1);
  });

  it('si el título cambia y la hoja no, no hay título 3D (se queda el plano)', () => {
    expect(resolveTitleSheet(manifest, '/api/art', 'BOYA').ok).toBe(false);
    expect(resolveTitleSheet(null, '/api/art', TEXT).ok).toBe(false);
    expect(resolveTitleSheet({ ...manifest, kind: 'sprite' }, '/api/art', TEXT).ok).toBe(false);
  });

  it('cada guiñada cae en una columna de la hoja', () => {
    const s = sheet();
    expect(frameForYaw(s.yawMin, s)).toBe(0);
    expect(frameForYaw(s.yawMax, s)).toBe(s.cols - 1);
    expect(frameForYaw(s.yawMax + 90, s)).toBe(s.cols - 1);
    const c = 3;
    expect(frameForYaw(s.yawMin + ((s.yawMax - s.yawMin) * c) / (s.cols - 1), s)).toBe(c);
  });
});

describe('movimiento del título 3D (T27)', () => {
  it('las letras suben una a una', () => {
    // Primer instante en que se ve cada letra.
    const firstSeen = Array.from({ length: N }, (_, i) => {
      for (let t = 0; t <= titleSettledMs(M, N); t += 5) if (poses(t)[i]!.alpha > 0) return t;
      return Infinity;
    });
    expect(firstSeen.every((t, i) => i === 0 || t > firstSeen[i - 1]!)).toBe(true);
    // Antes de empezar, nada; al acabar la subida, todas enteras y en su sitio (± el balanceo).
    expect(poses(0).every((p) => p.alpha === 0)).toBe(true);
    const settled = poses(titleSettledMs(M, N));
    expect(settled.every((p) => p.alpha === 1 && p.scale === 1)).toBe(true);
    expect(settled.every((p) => Math.abs(p.y) <= M.idle.bob + 1e-9)).toBe(true);
    // Suben: la primera letra empieza por debajo de su sitio.
    const start = M.rise.delayMs + M.rise.durationMs * 0.05;
    expect(poses(start)[0]!.y).toBeGreaterThan(0.5 * M.rise.from);
  });

  it('el reposo es un bucle sin salto: el mismo fotograma un periodo después', () => {
    const t0 = titleSettledMs(M, N);
    for (const dt of [0, 777, 2500, 5999]) {
      expect(close(poses(t0 + dt), poses(t0 + dt + M.idle.periodMs), 1e-6)).toBe(true);
    }
  });

  it('cada letra va a su aire, gira con la luz y no se sale de la hoja', () => {
    const s = sheet();
    const t0 = titleSettledMs(M, N);
    const seen = Array.from({ length: N }, () => new Set<number>());
    let apart = 0;
    for (let t = t0; t < t0 + M.idle.periodMs; t += 50) {
      const ps = poses(t);
      ps.forEach((p, i) => {
        seen[i]!.add(p.frame);
        expect(p.frame).toBeGreaterThanOrEqual(0);
        expect(p.frame).toBeLessThan(s.cols);
      });
      if (new Set(ps.map((p) => p.y.toFixed(4))).size === N) apart++;
    }
    // Varias columnas por letra (la luz pasa) y casi nunca dos letras a la par.
    expect(seen.every((f) => f.size >= 4)).toBe(true);
    expect(apart).toBeGreaterThan(0.9 * (M.idle.periodMs / 50));
  });

  it('la salida empieza donde estaban y termina sin letras, una a una', () => {
    const t = titleSettledMs(M, N) + 1234;
    expect(close(poses(t, 0), poses(t))).toBe(true);
    const mid = poses(t + M.exit.durationMs * 0.6, M.exit.durationMs * 0.6);
    expect(mid[0]!.alpha).toBeLessThan(mid[N - 1]!.alpha);
    const end = titleExitMs(M, N);
    expect(poses(t + end, end).every((p) => p.alpha === 0)).toBe(true);
  });

  it('movimiento reducido: un fotograma quieto, siempre el mismo', () => {
    const still = poses(0, null, true);
    const s = sheet();
    expect(still.every((p) => p.alpha === 1 && p.y === 0 && p.roll === 0)).toBe(true);
    expect(still.every((p) => p.frame === frameForYaw(M.stillYawDeg, s))).toBe(true);
    for (const t of [16, 900, 4321, 60_000]) expect(close(poses(t, null, true), still)).toBe(true);
    expect(close(poses(5000, 300, true), still)).toBe(true);
  });

  it('la configuración valida el movimiento del título', () => {
    const c = structuredClone(DEFAULT_INTRO_CONFIG) as unknown as {
      title: { idle: { periodMs: number }; rise: { fadeShare: number } };
    };
    c.title.idle.periodMs = 10;
    c.title.rise.fadeShare = 0;
    const r = validateIntroConfig(c);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('title.idle.periodMs');
      expect(r.error).toContain('title.rise.fadeShare');
    }
  });
});
