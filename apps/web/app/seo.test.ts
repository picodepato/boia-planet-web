import { describe, expect, it, vi } from 'vitest';
import { metadata as rootMeta } from './layout';
import { metadata as homeMeta } from './(landing)/page';
import { metadata as adminMeta } from './admin/layout';
import { metadata as carnetMeta } from './carnet/page';
import { metadata as memberCarnetMeta } from './carnet/[id]/page';
import { metadata as rankingMeta } from './ranking/page';
import robots, { PRIVATE_PATHS } from './robots';
import sitemap from './sitemap';
import { SITE_URL } from '../lib/seo';

// next/font only exists inside the Next compiler.
vi.mock('../lib/fonts', () => ({ fuentesClassName: '' }));

describe('indexing (plan 030 T285)', () => {
  it('home is indexable and canonical on boiaplanet.net', () => {
    expect(rootMeta.robots).toBeUndefined();
    expect(homeMeta.robots).toBeUndefined();
    expect(String(rootMeta.metadataBase)).toBe(`${SITE_URL}/`);
    const canonical = homeMeta.alternates?.canonical;
    expect(new URL(String(canonical), rootMeta.metadataBase as URL).toString()).toBe(
      'https://boiaplanet.net/',
    );
    expect(JSON.stringify(rootMeta.title)).not.toMatch(/demo/i);
  });

  it('admin and private Carnet stay noindex', () => {
    expect(adminMeta.robots).toEqual({ index: false, follow: false });
    expect(carnetMeta.robots).toEqual({ index: false, follow: false });
  });

  it('member Carnets are noindex and out of the sitemap; ranking stays indexable', () => {
    expect(memberCarnetMeta.robots).toEqual({ index: false, follow: false });
    expect(sitemap().some((e) => e.url.includes('/carnet'))).toBe(false);
    // noindex has to be readable: robots.txt must not block /carnet.
    expect(PRIVATE_PATHS.some((p) => '/carnet/abc'.startsWith(p))).toBe(false);
    expect(rankingMeta.robots).toBeUndefined();
    expect(rankingMeta.alternates?.canonical).toBe('/ranking');
  });

  it('no page title carries «demo» or the old «boia-planet» name', () => {
    expect(JSON.stringify([rootMeta, homeMeta, rankingMeta, memberCarnetMeta])).not.toMatch(
      /demo|boia-planet/i,
    );
  });

  it('sitemap lists public routes on boiaplanet.net and no admin', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain('https://boiaplanet.net/');
    expect(urls).toContain('https://boiaplanet.net/mar');
    expect(urls.every((u) => u.startsWith('https://boiaplanet.net/'))).toBe(true);
    expect(urls.some((u) => u.includes('/admin'))).toBe(false);
  });

  it('robots disallows admin and points to the sitemap', () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule?.disallow).toEqual(PRIVATE_PATHS);
    expect(PRIVATE_PATHS).toContain('/admin');
    expect(r.sitemap).toBe('https://boiaplanet.net/sitemap.xml');
  });
});
