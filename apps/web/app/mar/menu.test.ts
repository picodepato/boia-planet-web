import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { t } from '../../lib/i18n';
import { MENU_ICON_NAMES } from '../../lib/mundo/menu/icons';
import { MOOD_IDS, MOOD_LABEL } from './engine/palette';
import { MENU_ICON, MENU_SECTIONS, MarMenu, MarMenuButtonIcon, type MenuSection } from './menu';

/**
 * El menú del juego con los iconos propios de BOIA (T114): cada entrada con
 * su icono distinto, decorativo (`aria-hidden`), y su nombre en texto, que
 * es el nombre accesible. Ningún emoji queda en el menú.
 */
const noop = () => {};
const SHIP = 'Llaüt';
const GAME = { warning: t('mar.canon.menu.aviso'), resume: t('mar.canon.menu.seguir') };

function renderMenu(game?: typeof GAME) {
  return renderToStaticMarkup(
    createElement(MarMenu, {
      worldName: 'Mar',
      readyToClaim: 2,
      mood: 'dia',
      shipName: SHIP,
      hasShips: true,
      worlds: [],
      worldId: 'mar',
      worldPending: false,
      catalog: null,
      onOpen: noop,
      onMood: noop,
      onWorld: noop,
      onClose: noop,
      game,
    }),
  );
}

/** Las etiquetas visibles de cada entrada, tal como las pone menu.tsx. */
const LABEL: Record<MenuSection, string> = {
  logros: t('mar.client.logros'),
  carnet: t('mar.menu.miCarnet'),
  barco: t('mar.tienda.barco'),
  codigos: t('mar.menu.misCodigos'),
  botella: t('mar.menu.miBotella'),
  ranking: t('mar.menu.ranking'),
  ajustes: t('mar.menu.ajustes'),
  controles: t('mar.menu.controles'),
  bienvenida: t('mar.menu.bienvenida'),
};

/** Lo que lee un lector de pantalla: el texto sin lo que está `aria-hidden`. */
function accessibleText(html: string): string {
  return html
    .replace(/<svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg>/g, '')
    .replace(/<span[^>]*aria-hidden="true"[^>]*>.*?<\/span>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Los botones de sección del menú, con su id. */
function tiles(html: string): { section: string; html: string }[] {
  return [...html.matchAll(/<button[^>]*class="mar-menu__tile"[^>]*>.*?<\/button>/g)].map((m) => ({
    section: /data-seccion="([^"]+)"/.exec(m[0])![1]!,
    html: m[0],
  }));
}

describe('menú del juego: iconos de BOIA (T114)', () => {
  it('cada sección tiene un icono distinto de la familia', () => {
    const icons = MENU_SECTIONS.map((s) => MENU_ICON[s]);
    expect(new Set(icons).size).toBe(MENU_SECTIONS.length);
    for (const icon of icons) expect(MENU_ICON_NAMES).toContain(icon);
  });

  it('cada entrada lleva su icono decorativo y se nombra por su texto', () => {
    const list = tiles(renderMenu());
    expect(list.map((x) => x.section).sort()).toEqual([...MENU_SECTIONS].sort());
    for (const { section, html } of list) {
      const s = section as MenuSection;
      const icon = html.match(/<span class="mar-menu__icon" aria-hidden="true">(.*?)<\/span>/);
      expect(icon, s).not.toBeNull();
      expect(icon![1], s).toContain(`data-icon="${MENU_ICON[s]}"`);
      expect(html.match(/data-icon="/g), s).toHaveLength(1);
      expect(html, s).toContain(`<span class="mar-menu__name">${LABEL[s]}</span>`);
      const name = s === 'barco' ? `${LABEL[s]} ${SHIP}` : LABEL[s];
      expect(accessibleText(html), s).toBe(name);
    }
  });

  it('el momento del día y Mundos también llevan su icono junto al nombre', () => {
    const html = renderMenu();
    for (const m of MOOD_IDS) {
      const radio = html.match(
        new RegExp(`<button[^>]*data-testid="mar-momento-${m}"[^>]*>(.*?)</button>`),
      );
      expect(radio, m).not.toBeNull();
      expect(radio![1], m).toContain(`data-icon="${m}"`);
      expect(radio![1], m).toContain('aria-hidden="true"');
      expect(accessibleText(radio![1]!), m).toBe(MOOD_LABEL[m]);
    }
    const summary = html.match(/<summary[^>]*>(.*?)<\/summary>/)?.[1] ?? '';
    expect(summary).toContain('data-icon="mundos"');
    expect(summary).toContain(t('mar.client.mundos'));
  });

  it('no queda ningún emoji en el menú, tampoco con el aviso de la partida del Cañón (T118)', () => {
    for (const html of [renderMenu(), renderMenu(GAME)]) {
      expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
    }
    expect(renderMenu(GAME)).toContain(GAME.warning);
  });

  it('el botón del menú lleva el icono de Logros', () => {
    const html = renderToStaticMarkup(createElement(MarMenuButtonIcon));
    expect(html).toContain(`data-icon="${MENU_ICON.logros}"`);
    expect(html).toContain('aria-hidden="true"');
  });
});
