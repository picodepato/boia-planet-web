import { homeContentSchema, isSampleLink, type HomeContent } from '@boia/contracts';
import {
  artistPhotoPath,
  eventPosterPath,
  HALLOWEEN_EVENT_ID,
  REAL_CONTENT,
  SAMPLE_ALBUMS,
  SAMPLE_PHOTOS,
  SAMPLE_PROMOTIONS,
  sampleArtists,
  sampleEvents,
  sampleHomeBlocks,
  type RealContent,
} from '@boia/store';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { t } from '../../../lib/i18n/web';
import { resolveHome } from '../../../lib/landing/resolve';
import { trioAt } from '../../../lib/landing/rotation';
import { SAMPLE_CONTENT } from '../../../lib/landing/sample-content';
import { ArtistsList } from './artists-list';
import { HomeBlocks } from './blocks';
import { SAMPLE_LABEL_STYLE } from './sample-label';
import { SiteHeader } from './site-header';

/**
 * Plan 007 T82: Álvaro's real content drops in through `real-content.ts`
 * (links P15, artist photos P17, the poster P19) and the blocks render it;
 * until then the sample renders the `muestra` placeholders and marks.
 */

// A day before the first listed sample event: the priority one is Halloween.
const NOW = new Date(
  Math.min(
    ...SAMPLE_CONTENT.events
      .filter((e) => e.state !== 'draft' && e.state !== 'finished')
      .map((e) => new Date(e.startsAt).getTime()),
  ) -
    24 * 3600 * 1000,
);

const contentOf = (real: RealContent): HomeContent =>
  homeContentSchema.parse({
    blocks: sampleHomeBlocks(real),
    events: sampleEvents(real),
    artists: sampleArtists(real),
    photos: SAMPLE_PHOTOS,
    albums: SAMPLE_ALBUMS,
    promotions: SAMPLE_PROMOTIONS,
  });

/** Header, every block and the footer, as the landing paints them. */
function renderLanding(content: HomeContent): string {
  const view = resolveHome(content, NOW);
  const buyable = new Set(view.buyable);
  const props = { artists: view.artists, buyable, social: view.social };
  return renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      createElement(SiteHeader, {
        sections: new Set(view.sections),
        instagram: view.social.instagram,
      }),
      createElement(HomeBlocks, { blocks: [...view.main, ...view.footer], ...props }),
    ),
  );
}

/** The priority event's band. */
const priorityBand = (html: string) =>
  html.match(/<section[^>]*data-block="priority"[^>]*>.*?<\/section>/s)?.[0] ?? '';

/** The artists of the band's first trio (the rotation order is fixed, T29). */
function firstTrio(content: HomeContent): string[] {
  const block = resolveHome(content, NOW).main.find((b) => b.type === 'artists');
  if (!block || block.type !== 'artists') throw new Error('sin bloque de artistas');
  return trioAt(block.rotation.length, 0).map((i) => block.rotation[i]!.id);
}

const sampleTrio = firstTrio(SAMPLE_CONTENT);

const FIXTURE: RealContent = {
  links: {
    tickets: Object.fromEntries(
      SAMPLE_CONTENT.events
        .filter((e) => e.ticketUrl)
        .map((e) => [e.id, `https://tickets.boia-fixture.es/${e.slug}`]),
    ),
    store: 'https://tienda.boia-fixture.es',
    whatsapp: 'https://chat.whatsapp.com/BoiaFixture',
    instagram: 'https://www.instagram.com/boia.fixture',
    tiktok: 'https://www.tiktok.com/@boia.fixture',
    email: 'hola@boia-fixture.es',
    spotifyPlaylist: 'https://open.spotify.com/playlist/boiafixture',
    artistSpotify: Object.fromEntries([
      [sampleTrio[0]!, `https://open.spotify.com/artist/${sampleTrio[0]}`],
      [sampleTrio[1]!, `https://open.spotify.com/artist/${sampleTrio[1]}`],
      [sampleTrio[2]!, null],
    ]),
  },
  artistPhotos: sampleTrio,
  eventPosters: [HALLOWEEN_EVENT_ID],
};

const hrefs = (html: string) => [...html.matchAll(/ href="([^"]+)"/g)].map((m) => m[1]!);

/** Every link of the HTML: its href and its class. */
const anchors = (html: string) =>
  [...html.matchAll(/<a( [^>]*)>/g)].map((m) => ({
    href: / href="([^"]*)"/.exec(m[1]!)?.[1] ?? '',
    cls: / class="([^"]*)"/.exec(m[1]!)?.[1] ?? '',
  }));

/**
 * The «muestra» mark is CSS (landing.css): the rule whose content is
 * `var(--sample-label)` marks the links whose href contains one of its
 * `[href*=…]` and that have none of its `:not(.…)` classes.
 */
const css = readFileSync(fileURLToPath(new URL('../landing.css', import.meta.url)), 'utf8');
const markRule = /([^{}]*)\{[^}]*content:\s*var\(--sample-label\)/.exec(css)?.[1] ?? '';
const markHosts = [...markRule.matchAll(/\[href\*=["']([^"']+)["']\]/g)].map((m) => m[1]!);
const markExcept = [...markRule.matchAll(/:not\(\s*\.([\w-]+)\s*\)/g)].map((m) => m[1]!);
const marked = (a: { href: string; cls: string }) =>
  markHosts.some((h) => a.href.includes(h)) &&
  !markExcept.some((c) => a.cls.split(/\s+/).includes(c));

describe('the landing ready for real content (plan 007 T82)', () => {
  it('a fixture with a poster, artist photos and real links renders them in the blocks', () => {
    const content = contentOf(FIXTURE);
    const html = renderLanding(content);

    // P19: the poster in the priority event's slot, no placeholder.
    const priority = priorityBand(html);
    expect(priority).toContain(`src="${eventPosterPath(HALLOWEEN_EVENT_ID)}"`);
    expect(priority).not.toContain(t('priority.posterSoon'));

    // P17: the photos of the first trio in the band, and of everyone with one in /artistas.
    for (const id of sampleTrio) {
      expect(html).toContain(`src="${artistPhotoPath(id)}"`);
    }
    const all = renderToStaticMarkup(createElement(ArtistsList, { artists: content.artists }));
    expect(all.match(/class="artist-card__photo"/g)).toHaveLength(sampleTrio.length);

    // P15: every real link is on the page, and nothing is marked «muestra».
    const l = FIXTURE.links;
    const shown = hrefs(html);
    // Merchandise stays internal even when legacy content still has an external store URL.
    expect(shown).toContain('/tienda');
    expect(shown).not.toContain(l.store);
    for (const url of [l.whatsapp, l.instagram, l.tiktok, l.spotifyPlaylist]) {
      expect(shown, String(url)).toContain(url);
    }
    expect(shown).toContain(`mailto:${l.email}`);
    expect(shown).toContain(l.artistSpotify[sampleTrio[0]!]);
    expect(shown).toContain(l.artistSpotify[sampleTrio[1]!]);
    expect(shown.filter(isSampleLink)).toEqual([]);
    expect(anchors(html).filter(marked)).toEqual([]);
    // The ticket link of the event is the real one (the no-JS link of «Comprar»).
    expect(priority).toContain(`href="${l.tickets[HALLOWEEN_EVENT_ID]}"`);
    // An artist without Spotify (null) gets no link.
    const third = content.artists.find((a) => a.id === sampleTrio[2]);
    expect(third?.spotifyUrl).toBeUndefined();
  });

  it('the sample content renders the muestra placeholders and marks', () => {
    const html = renderLanding(SAMPLE_CONTENT);

    // P19: «Cartel próximamente» in the poster slot, no image.
    const priority = priorityBand(html);
    expect(priority).toContain('<p class="event-card__poster">');
    expect(priority).toContain(t('priority.posterSoon'));
    expect(priority).not.toContain('<img');

    // P17: no photos, the band shows the names only.
    expect(html).not.toContain('artist-card__photo');

    // P15: every sandbox link of the content is on the page and marked
    // «muestra» (by key, on .landing-root); links that are real are not.
    expect(markHosts.length).toBeGreaterThan(0);
    expect(SAMPLE_LABEL_STYLE).toEqual({ '--sample-label': JSON.stringify(t('link.sample')) });
    const links = anchors(html);
    const blocks = SAMPLE_CONTENT.blocks;
    const expected = [
      ...blocks.flatMap((b) =>
        b.type === 'store'
          ? [b.url]
          : b.type === 'contact'
            ? [...b.links.map((x) => x.url), ...(b.email ? [`mailto:${b.email}`] : [])]
            : b.type === 'footer'
              ? b.officialLinks.map((x) => x.url)
              : [],
      ),
      ...SAMPLE_CONTENT.artists
        .filter((a) => sampleTrio.includes(a.id))
        .flatMap((a) => (a.spotifyUrl ? [a.spotifyUrl] : [])),
    ].filter(isSampleLink);
    expect(expected.length).toBeGreaterThan(0);
    for (const url of expected) {
      const found = links.filter((a) => a.href === url);
      expect(found.length, url).toBeGreaterThan(0);
      for (const a of found) expect(marked(a), url).toBe(true);
    }
    for (const a of links.filter((x) => !isSampleLink(x.href))) {
      expect(marked(a), a.href).toBe(false);
    }
    // «Comprar»'s sandbox link only lives until hydration: never marked (no layout shift).
    for (const a of links.filter((x) => x.cls.includes('button--buy'))) {
      expect(marked(a), a.href).toBe(false);
    }
  });

  it('the sample content is the real content of today: what is real, real; the rest, muestra', () => {
    expect(contentOf(REAL_CONTENT)).toEqual(SAMPLE_CONTENT);
    const l = REAL_CONTENT.links;
    const real = [
      l.store,
      l.whatsapp,
      l.instagram,
      l.tiktok,
      l.email,
      l.spotifyPlaylist,
      ...Object.values(l.tickets),
      ...Object.values(l.artistSpotify),
    ].filter((u): u is string => u !== null);
    // A real link never points at the sandbox (that would hide the mark's meaning).
    expect(real.filter(isSampleLink)).toEqual([]);
  });

  it('the files of real-content.ts are in apps/web/public/contenido, and only those', () => {
    const publicDir = fileURLToPath(new URL('../../../public', import.meta.url));
    const artists = new Set(SAMPLE_CONTENT.artists.map((a) => a.id));
    const events = new Set(SAMPLE_CONTENT.events.map((e) => e.id));
    const check = (ids: readonly string[], pathOf: (id: string) => string, known: Set<string>) => {
      for (const id of ids) {
        expect(known.has(id), `id desconocido: ${id}`).toBe(true);
        expect(existsSync(join(publicDir, pathOf(id))), `falta ${pathOf(id)}`).toBe(true);
      }
      const dir = join(publicDir, pathOf('x').replace(/\/x\.webp$/, ''));
      const files = existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith('.')) : [];
      for (const f of files) {
        // A file dropped in without its id in real-content.ts would never show.
        expect(
          ids.map((id) => pathOf(id).split('/').pop()),
          `sin listar: ${f}`,
        ).toContain(f);
      }
    };
    check(REAL_CONTENT.artistPhotos, artistPhotoPath, artists);
    check(REAL_CONTENT.eventPosters, eventPosterPath, events);
  });

  it('docs/contenido-real.md names the file of every artist and the ticket link of every event', () => {
    const doc = readFileSync(
      fileURLToPath(new URL('../../../../../docs/contenido-real.md', import.meta.url)),
      'utf8',
    );
    for (const a of SAMPLE_CONTENT.artists)
      expect(doc, a.id).toContain(`| ${a.name} | \`${a.id}\` |`);
    for (const e of SAMPLE_CONTENT.events.filter((x) => x.ticketUrl)) {
      expect(doc, e.id).toContain(`['${e.id}']`);
    }
    expect(doc).toContain(eventPosterPath(HALLOWEEN_EVENT_ID));
  });
});
