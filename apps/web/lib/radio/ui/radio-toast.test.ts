import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RadioToastButton, toastSongText } from './radio-toast';

/**
 * El aviso de la canción (plan 025 T259): sólo la canción, sin «Sonando:»,
 * y tocarlo abre la radio. Sin navegador: el botón no tiene estado, así que
 * se llama como función y se pulsa su `onClick`.
 */

const SONG = { title: 'Lunes', artist: 'Ana Ríos' };

describe('aviso de la canción: el texto es la canción', () => {
  it('«Título — Artista», sin prefijo «Sonando»', () => {
    expect(toastSongText(SONG)).toBe('Lunes — Ana Ríos');
    expect(toastSongText(SONG)).not.toMatch(/Sonando/);
  });

  it('sin artista, sólo el título', () => {
    expect(toastSongText({ title: 'Lunes', artist: '' })).toBe('Lunes');
  });

  it('el marcado lleva la canción y un nombre accesible que dice a dónde va', () => {
    const html = renderToStaticMarkup(
      createElement(RadioToastButton, { song: SONG, onOpen: () => undefined }),
    );
    expect(html).toContain('<button');
    expect(html).toContain('aria-label="Abrir la radio: Lunes — Ana Ríos"');
    expect(html).toContain('Lunes — Ana Ríos');
    expect(html).not.toContain('Sonando:');
  });
});

describe('aviso de la canción: tocarlo abre la radio', () => {
  it('al pulsar el botón se llama a abrir, una vez', () => {
    const onOpen = vi.fn();
    const button = RadioToastButton({ song: SONG, onOpen }) as ReactElement<{
      onClick: () => void;
    }>;
    expect(button.type).toBe('button');
    button.props.onClick();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
