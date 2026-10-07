import type { HomeBlock, HomeContent } from '@boia/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { landingSections, resolveBlock, resolveHome } from '../../../lib/landing/resolve';
import { SAMPLE_CONTENT } from '../../../lib/landing/sample-content';
import { ZARPAR_HREF } from '../../../lib/intro/zarpar';
import { BlockView, HomeBlocks } from './blocks';

// «Ahora» un día antes del primer evento de muestra: todos los listados están por venir.
const firstListed = SAMPLE_CONTENT.events
  .filter((e) => e.state !== 'draft' && e.state !== 'finished')
  .map((e) => new Date(e.startsAt).getTime())
  .sort((a, b) => a - b)[0]!;
const NOW = new Date(firstListed - 24 * 3600 * 1000);

const buyableOf = (content: HomeContent) => new Set(resolveHome(content, NOW).buyable);

function render(block: HomeBlock, content: HomeContent = SAMPLE_CONTENT, now = NOW): string {
  const resolved = resolveBlock(block, content, now);
  if (!resolved) return '';
  return renderToStaticMarkup(
    createElement(BlockView, {
      block: resolved,
      artists: content.artists,
      buyable: buyableOf(content),
    }),
  );
}

/** Como la landing: resuelve la lista y pinta lo que queda. */
function renderList(blocks: readonly HomeBlock[], content = SAMPLE_CONTENT): string {
  const view = resolveHome({ ...content, blocks: [...blocks] }, NOW);
  return renderToStaticMarkup(
    createElement(HomeBlocks, {
      blocks: [...view.main, ...view.footer],
      artists: content.artists,
      buyable: buyableOf(content),
    }),
  );
}

/** La home de muestra con un bloque cambiado (la Filosofía se pinta dentro de Contacto, T65). */
const renderPatched = (block: HomeBlock, patch: Partial<HomeBlock>) =>
  renderList(
    SAMPLE_CONTENT.blocks.map((b) => (b.id === block.id ? ({ ...b, ...patch } as HomeBlock) : b)),
  );

describe('renderizador de bloques de la home', () => {
  it('cada bloque de muestra visible pinta algo con su id', () => {
    const html = renderList(SAMPLE_CONTENT.blocks);
    for (const block of SAMPLE_CONTENT.blocks) {
      expect(html, block.type).toContain(`data-block="${block.id}"`);
    }
  });

  it('un bloque oculto no pinta nada', () => {
    for (const block of SAMPLE_CONTENT.blocks) {
      expect(render({ ...block, visible: false }), block.type).toBe('');
    }
  });

  it('un bloque fuera de su programación no pinta nada', () => {
    const later = new Date(NOW.getTime() + 3600_000).toISOString();
    const earlier = new Date(NOW.getTime() - 3600_000).toISOString();
    for (const block of SAMPLE_CONTENT.blocks) {
      const id = `data-block="${block.id}"`;
      expect(renderPatched(block, { showFrom: later }), block.type).not.toContain(id);
      expect(renderPatched(block, { showUntil: earlier }), block.type).not.toContain(id);
      expect(renderPatched(block, { showFrom: earlier, showUntil: later }), block.type).toContain(
        id,
      );
    }
  });

  it('Contacto lleva la Filosofía dentro y sus datos (T65)', () => {
    const contact = SAMPLE_CONTENT.blocks.find((b) => b.type === 'contact')!;
    const philosophy = SAMPLE_CONTENT.blocks.find((b) => b.type === 'philosophy')!;
    if (contact.type !== 'contact' || philosophy.type !== 'philosophy') throw new Error('muestra');
    const html = render(contact);
    // Una sola sección: Contacto, con la Filosofía (su ancla) y los datos de contacto.
    expect(html).toContain('id="contacto"');
    expect(html).toContain('id="filosofia"');
    expect(html).toContain(`data-block="${philosophy.id}"`);
    for (const p of philosophy.paragraphs) expect(html).toContain(p);
    if (contact.email) expect(html).toContain(`mailto:${contact.email}`);
    for (const l of contact.links) expect(html).toContain(l.url);
    // La Filosofía ya no es una sección aparte; su enlace de la cabecera sigue.
    expect(resolveBlock(philosophy, SAMPLE_CONTENT, NOW)).toBeNull();
    const all = renderList(SAMPLE_CONTENT.blocks);
    expect(all.match(/id="filosofia"/g)).toHaveLength(1);
    expect(all.indexOf('id="contacto"')).toBeLessThan(all.indexOf('id="filosofia"'));
    expect(landingSections(SAMPLE_CONTENT, NOW)).toContain('filosofia');
  });

  it('cada parte se oculta desde su bloque; Contacto oculto se lleva la Filosofía', () => {
    const contact = SAMPLE_CONTENT.blocks.find((b) => b.type === 'contact')!;
    const philosophy = SAMPLE_CONTENT.blocks.find((b) => b.type === 'philosophy')!;
    const noPhilosophy = renderPatched(philosophy, { visible: false });
    expect(noPhilosophy).toContain('id="contacto"');
    expect(noPhilosophy).not.toContain('id="filosofia"');
    const noContact = renderPatched(contact, { visible: false });
    expect(noContact).not.toContain('id="contacto"');
    expect(noContact).not.toContain('id="filosofia"');
    // Sin bloque Contacto en el contenido, la Filosofía se pinta sola.
    const html = renderList(SAMPLE_CONTENT.blocks.filter((b) => b.type !== 'contact'));
    expect(html).toContain('id="filosofia"');
  });

  it('la lista respeta el orden configurado y se salta los ocultos', () => {
    const [a, b, c] = SAMPLE_CONTENT.blocks.filter((x) => x.type !== 'hero');
    const blocks = [c!, { ...a!, visible: false }, b!];
    const html = renderList(blocks);
    expect(html).not.toContain(`data-block="${a!.id}"`);
    expect(html.indexOf(`data-block="${c!.id}"`)).toBeLessThan(
      html.indexOf(`data-block="${b!.id}"`),
    );
  });

  it('un bloque sin contenido publicado útil no pinta nada', () => {
    const empty: HomeContent = { ...SAMPLE_CONTENT, events: [], artists: [], photos: [] };
    for (const type of ['priority_event', 'upcoming_events', 'artists', 'photos'] as const) {
      const block = SAMPLE_CONTENT.blocks.find((b) => b.type === type)!;
      expect(render(block, empty), type).toBe('');
    }
  });

  it('borradores y finalizados no salen en la home', () => {
    const html = renderList(SAMPLE_CONTENT.blocks);
    for (const e of SAMPLE_CONTENT.events.filter(
      (x) => x.state === 'draft' || x.state === 'finished',
    )) {
      expect(html).not.toContain(e.name);
    }
  });

  it('el hero (plan 007): el título del Admin en el h1, la frase en una esquina, sin línea de promoción', () => {
    const hero = SAMPLE_CONTENT.blocks.find((b) => b.type === 'hero')!;
    if (hero.type !== 'hero') throw new Error('sin hero');
    const html = render(hero);
    expect(html).toContain(`<h1 id="hero-title" class="visually-hidden">${hero.title}</h1>`);
    expect(html).toMatch(new RegExp(`class="hero__corner-line">${hero.positioning}<`));
    expect(html).toContain('data-hero-hint');
    expect(html).not.toContain('Encuentra descuentos para tus entradas');
    // T187: the short invitation follows Zarpar, outside its accessible name.
    expect(html).toMatch(
      /<a [^>]*data-zarpar="hero"[^>]*><span class="cta-explore__label">Zarpar<\/span><\/a><p class="hero__discount-hint">Consigue descuentos<\/p>/,
    );
  });

  it('el hero lleva dos botones: «Zarpar» (/mar con la bienvenida) y «Entradas» al lado (plan 007)', () => {
    const hero = SAMPLE_CONTENT.blocks.find((b) => b.type === 'hero')!;
    const html = render(hero);
    const hrefs = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual([ZARPAR_HREF.replace('&', '&amp;'), '#tickets']);
    expect(html).not.toContain('href="/juego"');
  });

  it('Spotify (plan 007): «Escúchalo en Spotify» en Artistas y el pie, y uno por artista que lo tenga', () => {
    const social = resolveHome(SAMPLE_CONTENT, NOW).social;
    expect(social.spotify).toMatch(/spotify/);
    const artists = resolveBlock(
      SAMPLE_CONTENT.blocks.find((b) => b.type === 'artists')!,
      SAMPLE_CONTENT,
      NOW,
    )!;
    const html = renderToStaticMarkup(
      createElement(BlockView, {
        block: artists,
        artists: SAMPLE_CONTENT.artists,
        buyable: new Set<string>(),
        social,
      }),
    );
    const links = [...html.matchAll(/<a [^>]*href="([^"]*spotify[^"]*)"[^>]*>/g)].map((m) => m[0]);
    expect(links.length).toBeGreaterThan(1);
    for (const a of links) {
      expect(a).toContain('target="_blank"');
      expect(a).toContain('rel="noopener noreferrer"');
    }
    expect(html).toContain(`href="${social.spotify}"`);
    const footer = resolveBlock(
      SAMPLE_CONTENT.blocks.find((b) => b.type === 'footer')!,
      SAMPLE_CONTENT,
      NOW,
    )!;
    const foot = renderToStaticMarkup(
      createElement(BlockView, { block: footer, artists: [], buyable: new Set<string>(), social }),
    );
    expect(foot).toContain('role="img" aria-label="BOIA"');
    expect(foot.match(new RegExp(`href="${social.spotify}"`, 'g'))).toHaveLength(1);
  });

  it('el hero tiene clave fija: otro id del repositorio no desmonta la entrada (T57)', () => {
    const view = resolveHome(SAMPLE_CONTENT, NOW);
    const keyed = (blocks: typeof view.main) => {
      const el = HomeBlocks({ blocks, artists: SAMPLE_CONTENT.artists, buyable: new Set() });
      const children = (el.props as { children: { key: string | null }[] }).children;
      return children.map((c) => c.key);
    };
    const renamed = view.main.map((b) => (b.type === 'hero' ? { ...b, id: 'hero-del-repo' } : b));
    expect(keyed(view.main)).toContain('hero');
    expect(keyed(renamed)).toEqual(keyed(view.main));
  });

  it('el trío inicial de artistas no repite a nadie', () => {
    const block = SAMPLE_CONTENT.blocks.find((b) => b.type === 'artists')!;
    const html = render(block);
    const trio = html.match(/<ul class="artist-trio"[^>]*>(.*?)<\/ul>/s)?.[1] ?? '';
    const names = [...trio.matchAll(/<h3 class="artist-card__name">(.*?)<\/h3>/g)].map((m) => m[1]);
    expect(names).toHaveLength(3);
    expect(new Set(names).size).toBe(3);
  });
});
