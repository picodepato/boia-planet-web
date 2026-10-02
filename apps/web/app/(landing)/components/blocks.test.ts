import type { HomeBlock, HomeContent } from '@boia/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { landingSections, resolveBlock, resolveHome } from '../../../lib/landing/resolve';
import { SAMPLE_CONTENT } from '../../../lib/landing/sample-content';
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

  it('el hero promete descuentos sólo con una promoción vigente', () => {
    const hero = SAMPLE_CONTENT.blocks.find((b) => b.type === 'hero')!;
    const withPromo: HomeContent = {
      ...SAMPLE_CONTENT,
      promotions: [
        {
          id: 'p',
          startsAt: new Date(NOW.getTime() - 1000).toISOString(),
          endsAt: new Date(NOW.getTime() + 1000).toISOString(),
          published: true,
        },
      ],
    };
    const noPromo: HomeContent = { ...SAMPLE_CONTENT, promotions: [] };
    expect(render(hero, withPromo)).toContain('Encuentra descuentos para tus entradas');
    expect(render(hero, noPromo)).not.toContain('Encuentra descuentos para tus entradas');
  });

  it('el hero lleva dos botones: el mundo 3D (/mar) y Tickets al lado (T57)', () => {
    const hero = SAMPLE_CONTENT.blocks.find((b) => b.type === 'hero')!;
    const html = render(hero);
    const actions = html.match(/<div class="hero__actions">(.*?)<\/div>/s)?.[1] ?? '';
    const hrefs = [...actions.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(['/mar', '#tickets']);
    expect(html).not.toContain('href="/juego"');
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
