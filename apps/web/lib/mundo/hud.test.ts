import type { WorldEvent } from '@boia/engine';
import { NoticeQueue, discoveryTargets } from '@boia/engine/ui';
import { describe, expect, it } from 'vitest';
import { demoWorld } from './demo-world';
import { MENU_SECTIONS, orderedSections } from './menu/sections';
import { discoveryNotice, noticeFromWorldEvent } from './notice-copy';

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

describe('avisos del mundo', () => {
  it('logros y recompensas avisan; el resto de eventos, no', () => {
    const achievement: WorldEvent = {
      type: 'achievement',
      objectId: 'boia-tutorial',
      trigger: 'find_boia',
      amount: 1,
    };
    expect(noticeFromWorldEvent(achievement)).toMatchObject({ kind: 'achievement' });
    const reward: WorldEvent = {
      type: 'reward',
      objectId: 'x',
      kind: 'coins',
      amount: 5,
      frequency: 'once',
      key: 'k-1',
    };
    expect(noticeFromWorldEvent(reward)).toMatchObject({ id: 'k-1', title: '+5 monedas' });
    expect(noticeFromWorldEvent({ type: 'proximity_enter', objectId: 'x' })).toBeNull();
  });

  it('descubrir todo el mundo de la demo a la vez encola avisos que salen de uno en uno', () => {
    const q = new NoticeQueue();
    for (const t of discoveryTargets(demoWorld)) q.push(discoveryNotice(t), 0);
    let visible = 0;
    for (let t = 0; t < 60_000; t += 25) {
      const cur = q.update(t);
      if (cur) {
        expect(cur.shownAt).toBeLessThanOrEqual(t);
        expect(cur.until).toBeGreaterThan(t);
        visible++;
      }
    }
    expect(visible).toBeGreaterThan(0);
    expect(q.size).toBe(0);
  });
});
