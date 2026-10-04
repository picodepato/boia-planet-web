import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ICON_PALETTE, MENU_ICON_NAMES, MenuIcon, type MenuIconName } from './icons';

/** Los iconos del menú del juego (T114): familia propia, ligera, decorativa y con la paleta de BOIA. */
const render = (name: MenuIconName) => renderToStaticMarkup(createElement(MenuIcon, { name }));
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const MAR_CSS = '../../../app/mar/mar.css';
const drawn = MENU_ICON_NAMES.filter((n) => n !== 'bienvenida');

describe('iconos del menú del juego (T114)', () => {
  it('cada icono dibujado es un SVG decorativo de 32×32: oculto a lectores, sin foco, sin texto ni imágenes', () => {
    expect(drawn.length).toBeGreaterThan(0);
    for (const name of drawn) {
      const svg = render(name);
      expect(svg.startsWith('<svg'), name).toBe(true);
      expect(svg, name).toContain('viewBox="0 0 32 32"');
      expect(svg, name).toContain('aria-hidden="true"');
      expect(svg, name).toContain('focusable="false"');
      expect(svg, name).toContain(`data-icon="${name}"`);
      expect(svg, name).toContain(`boia-icon--${name}`);
      expect(svg, name).not.toMatch(/<(text|image|use|style|script|foreignObject)\b|href=/);
    }
  });

  it('son ligeros: cada SVG pesa menos de 1,5 kB', () => {
    for (const name of drawn) expect(render(name).length, name).toBeLessThan(1500);
  });

  it('son distintos: no hay dos dibujos iguales', () => {
    const bodies = drawn.map((n) => render(n).replace(/^<svg[^>]*>/, ''));
    expect(new Set(bodies).size).toBe(drawn.length);
  });

  it('sólo llevan colores de la marca: contorno en currentColor y rellenos de la paleta', () => {
    const allowed = new Set<string>(['none', 'currentColor', ...Object.values(ICON_PALETTE)]);
    for (const name of drawn) {
      const colors = [...render(name).matchAll(/(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1]);
      expect(colors.length, name).toBeGreaterThan(0);
      for (const c of colors) expect(allowed.has(c!), `${name}: ${c}`).toBe(true);
      // El contorno sigue al texto: tinta en la hoja crema, blanco en el botón del menú.
      expect(render(name), name).toContain('stroke="currentColor"');
    }
  });

  it('la paleta es la de mar.css (naranja, morado de la gorra, crema y el amarillo del objetivo)', () => {
    const css = read(MAR_CSS).toLowerCase();
    for (const [key, hex] of Object.entries(ICON_PALETTE)) {
      if (key === 'white') continue;
      expect(css, key).toContain(hex);
    }
  });

  it('Welcome Aboard es la mascota original, sin redibujar', () => {
    const html = render('bienvenida');
    expect(html).toMatch(/^<span [^>]*class="[^"]*boia-icon--mascota/);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('<svg');
    // mar.css la pinta con el SVG de la marca: el mismo archivo de art/marca/logo/.
    const css = read(MAR_CSS);
    const url = css.match(/\.boia-icon--mascota\s*\{[^}]*url\('([^']+)'\)/)?.[1];
    expect(url).toBeDefined();
    const asset = new URL(url!, new URL(MAR_CSS, import.meta.url));
    expect(readFileSync(asset, 'utf8')).toBe(
      read('../../../../../art/marca/logo/boia-mascota.svg'),
    );
  });
});
