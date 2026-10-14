import { SAMPLE_HOME_BLOCKS } from '@boia/store';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { prerender } from 'react-dom/static';
import { describe, expect, it } from 'vitest';
import { ACCESS_COPY, CARNET_CREATE_HREF } from '../../../lib/landing/access';
import { resolveHome, socialLinks } from '../../../lib/landing/resolve';
import { SAMPLE_CONTENT } from '../../../lib/landing/sample-content';
import { BlockView, HomeBlocks } from './blocks';
import { carnetText as t } from './carnet-invite';
import { SiteHeader } from './site-header';

/**
 * «Sácate el Carnet» (plan 030 T288): después de «Próximos eventos», el
 * botón para crear el Carnet (el mismo destino que el checkout) y el
 * WhatsApp del contenido; el WhatsApp también en la cabecera y su menú.
 */

// «Ahora» un día antes del primer evento de muestra: todos los listados están por venir.
const firstListed = SAMPLE_CONTENT.events
  .filter((e) => e.state !== 'draft' && e.state !== 'finished')
  .map((e) => new Date(e.startsAt).getTime())
  .sort((a, b) => a - b)[0]!;
const NOW = new Date(firstListed - 24 * 3600 * 1000);

const view = resolveHome(SAMPLE_CONTENT, NOW);
const whatsapp = view.social.whatsapp;

/** Como el servidor: espera a los trozos perezosos (el bloque es `lazy`). */
async function renderAll(el: ReactElement): Promise<string> {
  const { prelude } = await prerender(el);
  return new Response(prelude).text();
}

const renderHome = (accounts?: boolean) =>
  renderAll(
    createElement(HomeBlocks, {
      blocks: view.main,
      artists: SAMPLE_CONTENT.artists,
      buyable: new Set(view.buyable),
      social: view.social,
      ...(accounts === undefined ? {} : { accounts }),
    }),
  );

/** El texto tal como sale escapado en el HTML. */
const html = (s: string) => renderToStaticMarkup(createElement('span', null, s)).slice(6, -7);

/** La etiqueta de apertura del enlace con ese data-testid. */
const anchor = (markup: string, testId: string) =>
  markup.match(new RegExp(`<a [^>]*data-testid="${testId}"[^>]*>`, 'g')) ?? [];

describe('«Sácate el Carnet» (plan 030 T288)', () => {
  it('va justo después de «Próximos eventos» en el orden de la muestra y en la home', async () => {
    const order = SAMPLE_HOME_BLOCKS.map((b) => b.type);
    expect(order[order.indexOf('upcoming_events') + 1]).toBe('carnet');
    const types = view.main.map((b) => b.type);
    expect(types[types.indexOf('upcoming_events') + 1]).toBe('carnet');

    const markup = await renderHome();
    const upcoming = markup.indexOf('id="upcoming-title"');
    const carnet = markup.indexOf('<section id="carnet"');
    expect(markup.slice(carnet)).toMatch(/^<section[^>]*data-testid="bloque-carnet"/);
    expect(upcoming).toBeGreaterThan(-1);
    expect(carnet).toBeGreaterThan(upcoming);
    // Ningún otro bloque entre los dos.
    expect(markup.slice(upcoming, carnet).match(/data-block="/g)).toBeNull();
  });

  it('lleva el botón para crear el Carnet (el del checkout) y el WhatsApp del contenido', async () => {
    expect(whatsapp).toBeTruthy();
    expect(whatsapp).toBe(socialLinks(SAMPLE_CONTENT).whatsapp);
    const markup = await renderHome();
    const [cta] = anchor(markup, 'carnet-crear');
    expect(cta).toContain(`href="${html(CARNET_CREATE_HREF)}"`);
    expect(markup).toContain(html(t('carnetBlock.cta')));
    const [wa] = anchor(markup, 'carnet-whatsapp');
    expect(wa).toContain(`href="${html(whatsapp!)}"`);
    expect(wa).toContain('rel="noopener noreferrer"');
    expect(markup).toContain(html(ACCESS_COPY.whatsappCta));
    for (const k of [
      'carnetBlock.heading',
      'carnetBlock.lead',
      'carnetBlock.perk.stamps',
      'carnetBlock.perk.discounts',
    ] as const)
      expect(markup, k).toContain(html(t(k)));
  });

  it('sin cuentas, las noticias en el WhatsApp; con cuentas, por email al crear el Carnet', async () => {
    const local = await renderHome(false);
    expect(local).toContain('data-modo="local"');
    expect(local).toContain(html(t('carnetBlock.news.local')));
    expect(local).not.toContain(html(t('carnetBlock.news.accounts')));
    const accounts = await renderHome(true);
    expect(accounts).toContain('data-modo="cuentas"');
    expect(accounts).toContain(html(t('carnetBlock.news.accounts')));
    expect(accounts).not.toContain(html(t('carnetBlock.news.local')));
  });

  it('sin WhatsApp en el contenido, queda sólo el botón del Carnet', async () => {
    const block = view.main.find((b) => b.type === 'carnet')!;
    const markup = await renderAll(
      createElement(BlockView, {
        block,
        artists: [],
        buyable: new Set<string>(),
        social: { ...view.social, whatsapp: null },
      }),
    );
    expect(anchor(markup, 'carnet-crear')).toHaveLength(1);
    expect(anchor(markup, 'carnet-whatsapp')).toHaveLength(0);
  });

  it('la cabecera y su menú plegable (móvil) llevan el WhatsApp', () => {
    const markup = renderToStaticMarkup(
      createElement(SiteHeader, {
        sections: new Set(view.sections),
        instagram: view.social.instagram,
        whatsapp,
      }),
    );
    const items = anchor(markup, 'cabecera-whatsapp');
    // La fila de escritorio y el menú plegable.
    expect(items).toHaveLength(2);
    for (const a of items) expect(a).toContain(`href="${html(whatsapp!)}"`);
    const menu = markup.slice(markup.indexOf('site-header__menu-list'));
    expect(anchor(menu, 'cabecera-whatsapp')).toHaveLength(1);
    // Sin WhatsApp, nada.
    const none = renderToStaticMarkup(
      createElement(SiteHeader, { sections: new Set(view.sections) }),
    );
    expect(none).not.toContain('cabecera-whatsapp');
  });
});
