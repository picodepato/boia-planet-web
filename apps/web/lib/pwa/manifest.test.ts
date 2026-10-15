import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../../app/manifest';
import { securityHeaders } from '../security-headers';
import { PWA_THEME_COLOR } from './theme';

const WEB = join(__dirname, '..', '..');

/** Ancho y alto de un PNG (cabecera IHDR). */
function pngSize(file: string): { w: number; h: number } {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString('latin1')).toBe('PNG');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe('app instalable: manifiesto e iconos (plan 027 T264)', () => {
  const m = manifest();

  it('lo que pide Chrome para instalar: nombre, inicio, standalone e iconos 192 y 512', () => {
    expect(m.name).toBe('BOIA.PLANET');
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBe('/');
    expect(m.display).toBe('standalone');
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect((m.icons ?? []).some((i) => i.purpose === 'maskable')).toBe(true);
  });

  it('cada icono existe en public/ con el tamaño que declara', () => {
    for (const icon of m.icons ?? []) {
      const file = join(WEB, 'public', icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      const [w, h] = String(icon.sizes).split('x').map(Number);
      expect(pngSize(file)).toEqual({ w, h });
    }
    expect(existsSync(join(WEB, 'app', 'apple-icon.png'))).toBe(true);
  });

  it('el color es el de la marca (--boia-navy de globals.css)', () => {
    const css = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');
    const navy = /--boia-navy:\s*(#[0-9a-f]{6})/i.exec(css)?.[1];
    expect(navy?.toLowerCase()).toBe(PWA_THEME_COLOR);
    expect(m.theme_color).toBe(PWA_THEME_COLOR);
    expect(m.background_color).toBe(PWA_THEME_COLOR);
  });

  it('la CSP deja registrar el service worker del propio sitio', () => {
    const csp = securityHeaders({ dev: false }).find(
      (h) => h.key === 'Content-Security-Policy',
    )!.value;
    expect(csp).toMatch(/worker-src 'self'/);
  });
});
