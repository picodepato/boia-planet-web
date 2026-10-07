import { MemoryStorage, SAMPLE_HOME_BLOCKS, createLocalRepository } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { socialLinks } from '../landing/resolve';
import { MERCHANDISE_CONTACT, merchandiseContact } from '../merchandise/catalog';
import { AdminError, createAdminActions } from './actions';
import {
  LINKS_MAX,
  LINK_LABEL_MAX,
  isEmail,
  isWebUrl,
  linksView,
  parseHandle,
  parseLinks,
  parseStoreContact,
} from './links';

/**
 * Enlaces de la tienda, el contacto y el pie desde el Admin (plan 017 T192):
 * sólo páginas web, filas vacías fuera, y sin nada guardado cada bloque se
 * queda con lo de serie (la muestra de la home y el contacto de products.json).
 */

const NOW = '2026-10-07T10:00:00Z';

function setup() {
  const repo = createLocalRepository({
    storage: new MemoryStorage(),
    now: () => new Date(NOW),
    watch: false,
  });
  const actions = createAdminActions({
    repo,
    registry: WORLD_REGISTRY,
    now: () => new Date(NOW),
  });
  return { repo, actions };
}

const sampleOf = <T extends string>(type: T) => SAMPLE_HOME_BLOCKS.find((b) => b.type === type)!;

describe('validación de enlaces', () => {
  it('sólo acepta páginas web http(s) con dominio', () => {
    expect(isWebUrl('https://instagram.com/boia.planet')).toBe(true);
    expect(isWebUrl('  http://boia.example/x  ')).toBe(true);
    for (const bad of [
      '',
      'instagram.com/boia',
      'javascript:alert(1)',
      'data:text/html,hola',
      'mailto:hola@boia.es',
      'ftp://boia.example/x',
      'https://localhost/x',
    ]) {
      expect(isWebUrl(bad), bad).toBe(false);
    }
  });

  it('las filas: recorta, ignora las vacías y falla con el motivo de la primera mala', () => {
    const ok = parseLinks([
      { label: ' Instagram ', url: ' https://instagram.com/boia ' },
      { label: '', url: '' },
      { label: 'Web', url: 'https://boia.example/' },
    ]);
    expect(ok).toEqual({
      ok: true,
      links: [
        { label: 'Instagram', url: 'https://instagram.com/boia' },
        { label: 'Web', url: 'https://boia.example/' },
      ],
    });
    expect(parseLinks([{ label: '', url: 'https://a.example' }]).ok).toBe(false);
    expect(
      parseLinks([{ label: 'x'.repeat(LINK_LABEL_MAX + 1), url: 'https://a.example' }]).ok,
    ).toBe(false);
    const bad = parseLinks([{ label: 'Mal', url: 'javascript:alert(1)' }]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain('Mal');
    expect(
      parseLinks([
        { label: 'A', url: 'https://a.example/x' },
        { label: 'B', url: 'https://a.example/x' },
      ]).ok,
    ).toBe(false);
    const many = Array.from({ length: LINKS_MAX + 1 }, (_, i) => ({
      label: `L${i}`,
      url: `https://a.example/${i}`,
    }));
    expect(parseLinks(many).ok).toBe(false);
    expect(parseLinks(many.slice(0, LINKS_MAX)).ok).toBe(true);
  });

  it('usuario de Instagram y correo', () => {
    expect(parseHandle('boia.planet')).toBe('@boia.planet');
    expect(parseHandle(' @boia_planet ')).toBe('@boia_planet');
    expect(parseHandle('boia planet')).toBeNull();
    expect(parseHandle('')).toBeNull();
    expect(isEmail('hola@boia.es')).toBe(true);
    expect(isEmail('hola@boia')).toBe(false);
  });

  it('el contacto de la tienda: los dos vacíos vuelven al de serie', () => {
    expect(parseStoreContact('', '  ')).toEqual({ ok: true, contact: null });
    expect(parseStoreContact('boia', 'https://instagram.com/boia')).toEqual({
      ok: true,
      contact: { handle: '@boia', url: 'https://instagram.com/boia' },
    });
    expect(parseStoreContact('boia', '').ok).toBe(false);
    expect(parseStoreContact('', 'https://instagram.com/boia').ok).toBe(false);
  });
});

describe('valores por defecto sin nada guardado', () => {
  it('la tienda usa el contacto de products.json', () => {
    expect(merchandiseContact(null)).toEqual(MERCHANDISE_CONTACT);
    expect(merchandiseContact({})).toEqual(MERCHANDISE_CONTACT);
    const own = { handle: '@otra', url: 'https://instagram.com/otra' };
    expect(merchandiseContact({ contact: own })).toEqual(own);
  });

  it('el Admin enseña la muestra de la home', () => {
    const view = linksView(SAMPLE_HOME_BLOCKS as Parameters<typeof linksView>[0]);
    const contact = sampleOf('contact');
    const footer = sampleOf('footer');
    expect(view.store).toEqual({ contact: MERCHANDISE_CONTACT, custom: false });
    expect(view.contact?.links).toEqual(contact.type === 'contact' ? contact.links : null);
    expect(view.footer?.links).toEqual(footer.type === 'footer' ? footer.officialLinks : null);
  });
});

describe('acciones del Admin', () => {
  it('cambia los enlaces del pie en el borrador y salen en la home al publicar', async () => {
    const { repo, actions } = setup();
    const before = await repo.content.home();
    const url = 'https://instagram.com/boia.admin';
    await actions.setFooterLinks([
      { label: 'Instagram BOIA', url },
      { label: '', url: '' },
    ]);
    // En el borrador, todavía no en la web.
    expect(await repo.content.home()).toEqual(before);
    await actions.publish();
    const home = await repo.content.home();
    const footer = home.blocks.find((b) => b.type === 'footer');
    expect(footer?.type === 'footer' && footer.officialLinks).toEqual([
      { label: 'Instagram BOIA', url },
    ]);
    expect(socialLinks(home).instagram).toBe(url);
  });

  it('rechaza un enlace malo sin tocar nada', async () => {
    const { repo, actions } = setup();
    await expect(
      actions.setFooterLinks([{ label: 'X', url: 'javascript:alert(1)' }]),
    ).rejects.toBeInstanceOf(AdminError);
    await expect(actions.setContactLinks('no-es-correo', [])).rejects.toBeInstanceOf(AdminError);
    expect(await repo.admin.pendingDrafts()).toEqual([]);
  });

  it('contacto: correo vacío lo quita; tienda: vacío vuelve al de serie', async () => {
    const { repo, actions } = setup();
    await actions.setContactLinks('', [{ label: 'WhatsApp', url: 'https://wa.me/34600000000' }]);
    await actions.setStoreContact('@boia.tienda', 'https://instagram.com/boia.tienda');
    let blocks = await repo.admin.draftList('homeBlocks');
    const contact = blocks.find((b) => b.type === 'contact');
    expect(contact?.type === 'contact' && contact.email).toBeUndefined();
    expect(linksView(blocks).store).toEqual({
      contact: { handle: '@boia.tienda', url: 'https://instagram.com/boia.tienda' },
      custom: true,
    });
    await actions.setStoreContact('', '');
    blocks = await repo.admin.draftList('homeBlocks');
    expect(linksView(blocks).store).toEqual({ contact: MERCHANDISE_CONTACT, custom: false });
  });
});
