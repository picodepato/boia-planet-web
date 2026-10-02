import { describe, expect, it } from 'vitest';
import { MENU_SECTIONS, orderedSections } from './menu/sections';

describe('Menú de a bordo (§19, REQ-IDE-034)', () => {
  // Los siete iconos de §19, en su orden. Otras secciones pueden sumarse.
  const V14 = ['welcome', 'carnet', 'logros', 'barco', 'ranking', 'controles', 'ajustes'];

  it('tiene las siete secciones de §19 en su orden, con ids únicos', () => {
    const ids = orderedSections().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const positions = V14.map((id) => ids.indexOf(id));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('Controles y Ajustes van al final, tras la separación', () => {
    const ordered = orderedSections();
    const firstTool = ordered.findIndex((s) => s.group === 'tools');
    expect(ordered.slice(firstTool).every((s) => s.group === 'tools')).toBe(true);
    expect(ordered.slice(firstTool).map((s) => s.id)).toEqual(
      expect.arrayContaining(['controles', 'ajustes']),
    );
  });

  it('registrar una sección es añadir un módulo: se ordena por grupo sin tocar el menú', () => {
    const extra = { ...MENU_SECTIONS[0]!, id: 'extra', group: 'progress' as const };
    const ids = orderedSections([...MENU_SECTIONS, extra]).map((s) => s.id);
    expect(ids.indexOf('extra')).toBeLessThan(ids.indexOf('controles'));
    for (const s of MENU_SECTIONS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.icon).toBeTruthy();
    }
  });
});
