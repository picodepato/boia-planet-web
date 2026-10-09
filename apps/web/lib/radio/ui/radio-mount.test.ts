import { describe, expect, it } from 'vitest';
import { PRESENTATION } from '../../landing/presentation';
import { HERO_BUTTON_UNTIL } from './radio-mount';

/**
 * El botón de la radio de arriba a la derecha (plan 022 T247) se va cuando el
 * velo negro de la presentación tapa el hero: la constante va a mano para no
 * compartir módulos con la landing, así que aquí se ata a la de verdad.
 */
describe('radio: el botón de arriba se va con el velo', () => {
  it('HERO_BUTTON_UNTIL es donde el velo ya es negro (PRESENTATION.beats)', () => {
    expect(HERO_BUTTON_UNTIL).toBe(PRESENTATION.beats);
  });
});
