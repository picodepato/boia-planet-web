import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AudioChannel } from '@boia/engine/ui';
import { describe, expect, it, vi } from 'vitest';
import { t } from '../../../i18n';
import { ChannelControl } from './ajustes';

/**
 * Música y efectos en Ajustes (plan 022 T236, guía Q4): interruptores de
 * pastilla, no casillas. Un `<button role="switch">` nativo es operable con
 * el teclado (Enter y Espacio disparan su `click`), así que basta con que lo
 * sea, no salga del orden de tabulación y su `click` cambie el canal.
 */
type Props = { [k: string]: unknown; children?: ReactNode; onClick?: () => void };

function findSwitch(node: ReactNode): ReactElement<Props> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findSwitch(child as ReactNode);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement<Props>(node)) return null;
  if (node.props.role === 'switch') return node;
  return findSwitch(node.props.children);
}

const channel = (enabled: boolean): AudioChannel => ({ enabled, volume: 0.6 });

describe('Ajustes: interruptores de música y efectos', () => {
  for (const [id, label] of [
    ['music', t('juego.ajustes.musica')],
    ['sfx', t('settings.effects')],
  ] as const) {
    it(`${id}: un botón role=switch con aria-checked y el nombre del canal, sin casilla`, () => {
      for (const enabled of [true, false]) {
        const html = renderToStaticMarkup(
          createElement(ChannelControl, { id, label, value: channel(enabled), onChange: () => {} }),
        );
        expect(html).not.toContain('type="checkbox"');
        const button = html.match(/<button[^>]*role="switch"[^>]*>/)?.[0];
        expect(button).toBeDefined();
        expect(button).toContain('type="button"');
        expect(button).toContain(`aria-checked="${enabled}"`);
        expect(button).not.toMatch(/tabindex="-1"|disabled/);
        expect(html).toContain(`<span>${label}</span>`);
      }
    });

    it(`${id}: activarlo (click, Enter o Espacio) cambia sólo el encendido`, () => {
      for (const enabled of [true, false]) {
        const onChange = vi.fn();
        const sw = findSwitch(ChannelControl({ id, label, value: channel(enabled), onChange }));
        expect(sw?.type).toBe('button');
        sw?.props.onClick?.();
        expect(onChange).toHaveBeenCalledWith({ enabled: !enabled, volume: 0.6 });
      }
    });
  }
});
