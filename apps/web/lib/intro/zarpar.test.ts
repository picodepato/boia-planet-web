import { afterEach, describe, expect, it } from 'vitest';
import { readMarLinks } from '../../app/mar/deep-link';
import { MAR_PATH } from '../world-handoff';
import { ZARPAR_HREF, markZarpar, takeZarpar } from './zarpar';

describe('«Zarpar» entra en el juego (T64)', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('lleva al mar 3D con la bienvenida de la boia abierta', () => {
    const url = new URL(ZARPAR_HREF, 'http://boia.invalid');
    expect(url.pathname).toBe(MAR_PATH);
    const links = readMarLinks(url.search);
    expect(links.menu).toBe('bienvenida');
    expect(links.sail).toBeNull();
  });

  it('la marca de haber zarpado se consume una vez', () => {
    (globalThis as { window?: unknown }).window = globalThis;
    expect(takeZarpar()).toBe(false);
    markZarpar();
    expect(takeZarpar()).toBe(true);
    expect(takeZarpar()).toBe(false);
  });
});
