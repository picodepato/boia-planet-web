import { DROP_IDS, SURVIVORS_CONFIG } from '@boia/engine/survivors';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CHEST_ICON,
  DROP_ICON,
  EVOLUTION_ICON,
  FALLBACK_ICON,
  FLAME_ICON,
  SALVAVIDAS_ICON,
  UPGRADE_ICON,
  VINYL_ICON,
  WEAPON_ICON,
  cardIcon,
} from './canon-hud-model';
import { CANON_ICON_NAMES, CANON_ICON_PALETTE, CanonIcon, type CanonIconName } from './canon-icons';

/** Cualquier emoji (pictogramas, símbolos, banderas, el selector de variación). */
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]|\u{FE0F}/u;

const render = (name: CanonIconName) => renderToStaticMarkup(createElement(CanonIcon, { name }));

/** Cada id de la config con su icono, por familia. */
function everyId(): { label: string; icon: CanonIconName | undefined }[] {
  return [
    ...Object.keys(SURVIVORS_CONFIG.weapons).map((id) => ({
      label: `arma ${id}`,
      icon: WEAPON_ICON[id as keyof typeof WEAPON_ICON],
    })),
    ...Object.keys(SURVIVORS_CONFIG.passives).map((id) => ({
      label: `vinilo ${id}`,
      icon: VINYL_ICON[id as keyof typeof VINYL_ICON],
    })),
    ...SURVIVORS_CONFIG.evolutions.map((e) => ({ label: `evolución ${e.id}`, icon: EVOLUTION_ICON[e.id] })),
    ...SURVIVORS_CONFIG.upgrades.map((u) => ({ label: `mejora ${u.id}`, icon: UPGRADE_ICON[u.id] })),
    ...DROP_IDS.map((id) => ({ label: `botín ${id}`, icon: DROP_ICON[id] })),
    { label: 'Segunda vida', icon: SALVAVIDAS_ICON },
    { label: 'llama', icon: FLAME_ICON },
    { label: 'cofre', icon: CHEST_ICON },
  ];
}

describe('los iconos del Cañón (T150)', () => {
  it('cada arma, vinilo, evolución, mejora y objeto del botín tiene su icono SVG, sin emoji', () => {
    for (const { label, icon } of everyId()) {
      expect(icon, label).toBeDefined();
      expect(CANON_ICON_NAMES, label).toContain(icon);
      expect(icon!, label).not.toMatch(EMOJI);
      const html = render(icon!);
      expect(html, label).toMatch(/^<svg[^>]*viewBox="0 0 32 32"/);
      expect(html, label).toContain(`data-icon="${icon}"`);
      expect(html, label).toContain('aria-hidden="true"');
      expect(html, label).not.toMatch(EMOJI);
      expect(html, label).not.toMatch(/<text|<image/);
    }
  });

  it('cada cosa tiene un icono distinto (el Salvavidas ya no comparte la boya)', () => {
    const icons = everyId().map((x) => x.icon);
    expect(new Set(icons).size).toBe(icons.length);
    // Y no sobra ninguno dibujado sin usar.
    expect([...new Set(icons)].sort()).toEqual([...CANON_ICON_NAMES].sort());
    expect(DROP_ICON.salvavidas).not.toBe(WEAPON_ICON.buoys);
    expect(SALVAVIDAS_ICON).not.toBe(DROP_ICON.salvavidas);
  });

  it('la carta de cualquier tipo saca un icono dibujado, también sin id', () => {
    const kinds = ['weapon-new', 'weapon-level', 'vinyl-new', 'vinyl-level', 'evolution', 'salvavidas', 'fallback'] as const;
    for (const kind of kinds) expect(CANON_ICON_NAMES, kind).toContain(cardIcon({ kind }));
    expect(FALLBACK_ICON).toBe(UPGRADE_ICON.bailing);
  });

  it('los rellenos salen de la paleta y el contorno es currentColor', () => {
    const palette = new Set<string>(Object.values(CANON_ICON_PALETTE).map((c) => c.toLowerCase()));
    for (const name of CANON_ICON_NAMES) {
      const html = render(name);
      expect(html, name).toContain('stroke="currentColor"');
      for (const [, color] of html.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{3,8})"/g)) {
        expect(palette, `${name}: ${color}`).toContain(color!.toLowerCase());
      }
    }
  });
});
