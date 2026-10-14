import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { describe, expect, it, vi } from 'vitest';
import { metadata as rootMeta } from './layout';
import { metadata as homeMeta } from './(landing)/page';
import { metadata as marMeta } from './mar/page';
import { generateMetadata as eventMeta } from './(landing)/eventos/[slug]/page';
import { SITE_URL } from '../lib/seo';
import { publicEventSlugs } from '../lib/landing/eventos';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';
import {
  composeEvent,
  composeHome,
  encode,
  ogDateLabel,
  OG_DIR,
  OG_SITE_FILE,
} from '../scripts/og-images.mjs';

// next/font only exists inside the Next compiler.
vi.mock('../lib/fonts', () => ({ fuentesClassName: '' }));

/**
 * Imágenes para compartir (plan 030 T286): cada página principal y cada
 * evento público resuelven `og:image` absoluta en boiaplanet.net, el archivo
 * está en `public/`, mide 1200 × 630 y pesa ≤ 300 KB.
 */

const PUBLIC = path.resolve(__dirname, '../public');
const MAX_BYTES = 300 * 1024;

type Images = NonNullable<NonNullable<Metadata['openGraph']>['images']>;

/** La primera imagen, absoluta como la escribe Next con `metadataBase`. */
function firstImage(images: Images | undefined): { url: string; alt: string | undefined } {
  const first = Array.isArray(images) ? images[0] : images;
  expect(first).toBeDefined();
  const url = typeof first === 'string' || first instanceof URL ? first : first!.url;
  const alt = typeof first === 'object' && 'alt' in first! ? first.alt : undefined;
  return { url: new URL(String(url), rootMeta.metadataBase as URL).toString(), alt };
}

/** Ancho y alto de un PNG (cabecera IHDR). */
function pngSize(file: string) {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString('latin1')).toBe('PNG');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function expectShareable(meta: Metadata) {
  const og = firstImage(meta.openGraph?.images);
  const tw = firstImage((meta.twitter as { images?: Images } | null)?.images);
  expect(og.url.startsWith(`${SITE_URL}/og/`)).toBe(true);
  expect(tw.url).toBe(og.url);
  expect(og.alt).toBeTruthy();
  expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
  expect(meta.openGraph).toMatchObject({ siteName: 'BOIA.PLANET', locale: 'es_ES' });
  const file = path.join(PUBLIC, new URL(og.url).pathname);
  expect(pngSize(file)).toEqual({ width: 1200, height: 630 });
  expect(statSync(file).size).toBeLessThanOrEqual(MAX_BYTES);
  return file;
}

describe('share images (plan 030 T286)', () => {
  it('home, /mar and the defaults of every page share the planet image', () => {
    const home = expectShareable(homeMeta);
    expect(expectShareable(marMeta)).toBe(home);
    expect(expectShareable(rootMeta)).toBe(home);
  });

  const slugs = publicEventSlugs(SAMPLE_CONTENT.events);
  it.each(slugs)('event %s has its own image', async (slug) => {
    const meta = await eventMeta({ params: Promise.resolve({ slug }) });
    const file = expectShareable(meta);
    expect(path.basename(file)).toBe(`${slug}.png`);
    expect(meta.openGraph?.title).toContain(
      SAMPLE_CONTENT.events.find((e) => e.slug === slug)!.name,
    );
  });

  it('the committed images are what the build script draws today', () => {
    expect(readFileSync(path.join(OG_DIR, OG_SITE_FILE)).equals(encode(composeHome()))).toBe(true);
    for (const slug of slugs) {
      const event = SAMPLE_CONTENT.events.find((e) => e.slug === slug)!;
      const file = path.join(OG_DIR, 'eventos', `${slug}.png`);
      expect(readFileSync(file).equals(encode(composeEvent(event)))).toBe(true);
    }
  });

  it('the build draws them before next build (both hosts run `pnpm build`)', () => {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
    expect(pkg.scripts.build).toMatch(/node scripts\/og-images\.mjs && .*next build/);
  });

  it('dates are Spanish, in Madrid time, with their accents', () => {
    // 23:30 UTC del viernes es ya sábado en Madrid.
    expect(ogDateLabel('2026-10-30T23:30:00Z', 'Europe/Madrid')).toBe('SÁB 31 OCT');
    const glyphs = JSON.parse(
      readFileSync(path.resolve(__dirname, '../scripts/og/glifos.json'), 'utf8'),
    );
    // Upheaval trae la «Á» con su tilde: no se dibuja como la «A».
    expect(glyphs.titulo.glyphs['Á'].r).not.toEqual(glyphs.titulo.glyphs.A.r);
  });
});
