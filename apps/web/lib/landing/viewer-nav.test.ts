import { describe, expect, it } from 'vitest';
import {
  SWIPE_CLOSE_MIN,
  SWIPE_MIN,
  clipProgress,
  clipTime,
  keyAction,
  stepIndex,
  swipeAction,
  trapFocusTarget,
} from './viewer-nav';

/** El visor a pantalla completa de la Galería (plan 029 T277): sus decisiones, sin DOM. */

describe('anterior y siguiente', () => {
  it('avanza y retrocede, y da la vuelta por los extremos', () => {
    expect(stepIndex(0, 5, 1)).toBe(1);
    expect(stepIndex(4, 5, 1)).toBe(0);
    expect(stepIndex(0, 5, -1)).toBe(4);
    expect(stepIndex(3, 5, -1)).toBe(2);
  });

  it('con una sola pieza o ninguna se queda donde está', () => {
    expect(stepIndex(0, 1, 1)).toBe(0);
    expect(stepIndex(0, 1, -1)).toBe(0);
    expect(stepIndex(0, 0, 1)).toBe(0);
  });
});

describe('deslizar con el dedo', () => {
  it('a la izquierda trae la siguiente; a la derecha, la anterior', () => {
    expect(swipeAction(-SWIPE_MIN, 0)).toBe('next');
    expect(swipeAction(SWIPE_MIN, 0)).toBe('prev');
    expect(swipeAction(-120, 20)).toBe('next');
  });

  it('hacia abajo cierra; hacia arriba, nada', () => {
    expect(swipeAction(0, SWIPE_CLOSE_MIN)).toBe('close');
    expect(swipeAction(10, 200)).toBe('close');
    expect(swipeAction(0, -200)).toBeNull();
  });

  it('un toque, un movimiento corto o una diagonal dudosa no hacen nada', () => {
    expect(swipeAction(0, 0)).toBeNull();
    expect(swipeAction(SWIPE_MIN - 1, 0)).toBeNull();
    expect(swipeAction(0, SWIPE_CLOSE_MIN - 1)).toBeNull();
    expect(swipeAction(60, 60)).toBeNull();
    expect(swipeAction(60, 50)).toBeNull();
  });
});

describe('teclado', () => {
  it('Esc cierra, las flechas cambian de pieza, M alterna el sonido', () => {
    expect(keyAction('Escape')).toBe('close');
    expect(keyAction('ArrowRight')).toBe('next');
    expect(keyAction('ArrowLeft')).toBe('prev');
    expect(keyAction('m')).toBe('toggle-sound');
    expect(keyAction('M')).toBe('toggle-sound');
    expect(keyAction('x')).toBeNull();
  });

  it('el espacio alterna la reproducción, salvo con el foco en un botón o la barra', () => {
    expect(keyAction(' ')).toBe('toggle-play');
    expect(keyAction(' ', true)).toBeNull();
  });
});

describe('barra de progreso', () => {
  it('es la fracción de la duración, siempre entre 0 y 1', () => {
    expect(clipProgress(5, 20)).toBe(0.25);
    expect(clipProgress(30, 20)).toBe(1);
    expect(clipProgress(-1, 20)).toBe(0);
  });

  it('sin duración conocida es 0', () => {
    expect(clipProgress(5, 0)).toBe(0);
    expect(clipProgress(5, Number.NaN)).toBe(0);
    expect(clipProgress(5, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('el tiempo se escribe m:ss', () => {
    expect(clipTime(0)).toBe('0:00');
    expect(clipTime(7.9)).toBe('0:07');
    expect(clipTime(60)).toBe('1:00');
    expect(clipTime(Number.NaN)).toBe('0:00');
  });
});

describe('foco atrapado', () => {
  it('del último al primero con Tab, y del primero al último con Mayús+Tab', () => {
    expect(trapFocusTarget(false, 3, 4)).toBe('first');
    expect(trapFocusTarget(true, 0, 4)).toBe('last');
  });

  it('en medio lo lleva el navegador; fuera del visor, entra por un extremo', () => {
    expect(trapFocusTarget(false, 1, 4)).toBeNull();
    expect(trapFocusTarget(true, 2, 4)).toBeNull();
    expect(trapFocusTarget(false, -1, 4)).toBe('first');
    expect(trapFocusTarget(true, -1, 4)).toBe('last');
    expect(trapFocusTarget(false, 0, 0)).toBeNull();
  });
});
