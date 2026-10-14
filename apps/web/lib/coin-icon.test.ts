import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CoinIcon } from './coin-icon';
import { t } from './i18n';

/**
 * T280: la moneda del juego sale en todos los sistemas. El emoji de la moneda
 * (U+1FA99) es de Unicode 13 y Windows 10 lo pinta como una caja vacía (como
 * la bola de discoteca, T273): la moneda va dibujada (`CoinIcon`) y en el
 * texto suelto se dice «monedas».
 */
const COIN_EMOJI = String.fromCodePoint(0x1fa99);
const web = fileURLToPath(new URL('..', import.meta.url));

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.(tsx?|css|json|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

describe('la moneda (T280)', () => {
  it('es un dibujo (SVG), sin texto ni emoji', () => {
    const html = renderToStaticMarkup(createElement(CoinIcon));
    expect(html).toMatch(/^<svg[^>]*data-boia-coin=""/);
    expect(html).toContain('aria-hidden="true"');
    expect(html.replace(/<[^>]*>/g, '')).toBe('');
    expect(html).not.toContain(COIN_EMOJI);
  });

  it('con nombre, se lee como una imagen con ese nombre', () => {
    const html = renderToStaticMarkup(createElement(CoinIcon, { label: t('mar.client.monedas') }));
    expect(html).toContain('role="img"');
    expect(html).toContain(`aria-label="${t('mar.client.monedas')}"`);
    expect(html).not.toContain('aria-hidden');
  });

  it('ningún texto ni componente de la web usa el emoji de la moneda', () => {
    const files = ['app', 'lib', 'e2e'].flatMap((d) => sources(path.join(web, d)));
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.filter((f) => readFileSync(f, 'utf8').includes(COIN_EMOJI));
    expect(offenders.map((f) => path.relative(web, f))).toEqual([
      // Sólo esta prueba lo nombra, para buscarlo.
    ]);
  });

  it('los saldos del mar, el premio y la tienda llevan la moneda dibujada', () => {
    for (const file of ['app/mar/mar-client.tsx', 'lib/logros/reward.tsx', 'lib/barco/shop.tsx']) {
      const src = readFileSync(path.join(web, file), 'utf8');
      expect(src, file).toMatch(/<CoinIcon\b/);
    }
  });

  it('el premio en texto dice «monedas»', () => {
    expect(t('achievements.reward.coins', { n: 40 })).toBe('+40 monedas');
  });
});
