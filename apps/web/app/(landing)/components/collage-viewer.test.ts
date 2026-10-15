import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { t } from '../../../lib/i18n/web';
import { ClipBar, ViewerNav } from './collage-viewer';

/** Los controles del visor a pantalla completa (plan 029 T277), con etiquetas de i18n. */

const noop = () => {};
const bar = (over: Partial<Parameters<typeof ClipBar>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(ClipBar, {
      playing: true,
      muted: true,
      progress: 0.25,
      current: 7,
      duration: 28,
      loading: false,
      onTogglePlay: noop,
      onToggleSound: noop,
      onSeek: noop,
      ...over,
    }),
  );

describe('controles de un clip abierto', () => {
  it('tienen reproducir/pausar, sonido y progreso, con su etiqueta', () => {
    const html = bar();
    expect(html).toContain(`aria-label="${t('gallery.pause')}"`);
    expect(html).toContain(`aria-label="${t('gallery.soundOn')}"`);
    expect(html).toContain(`aria-label="${t('gallery.progress')}"`);
    expect(html).toContain('type="range"');
    expect(html).toContain('value="250"');
    expect(html).toContain('aria-valuetext="0:07 / 0:28"');
  });

  it('el botón dice lo que hará: pausado ofrece reproducir; con sonido ofrece silenciar', () => {
    const html = bar({ playing: false, muted: false });
    expect(html).toContain(`aria-label="${t('gallery.play')}"`);
    expect(html).toContain(`aria-label="${t('gallery.soundOff')}"`);
  });

  it('la barra no se puede mover hasta saber la duración', () => {
    expect(bar({ duration: 0, progress: 0 })).toContain('disabled=""');
    expect(bar()).not.toContain('disabled=""');
  });
});

describe('anterior y siguiente del visor', () => {
  const nav = (index: number, total: number) =>
    renderToStaticMarkup(createElement(ViewerNav, { index, total, onPrev: noop, onNext: noop }));

  it('con varias piezas hay dos flechas y la posición', () => {
    const html = nav(2, 9);
    expect(html).toContain(`aria-label="${t('gallery.prev')}"`);
    expect(html).toContain(`aria-label="${t('gallery.next')}"`);
    expect(html).toContain(t('gallery.position', { n: 3, total: 9 }));
  });

  it('con una sola pieza no hay nada que pasar', () => {
    expect(nav(0, 1)).toBe('');
  });
});
