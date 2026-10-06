import { DEFENSE_CONFIG, type DefenseEvent, createDefense } from '@boia/engine/defense';
import { MemoryStorage, createLocalRepository } from '@boia/store';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { t } from '../../lib/i18n';
import {
  CASTLE_GUIDE_PREF,
  CASTLE_GUIDE_STEPS,
  type CastleGuideObs,
  type CastleGuideState,
  EMPTY_GUIDE_TALLY,
  GUIDE_PLANE_MOVE_U,
  GUIDE_START,
  advanceGuide,
  closeGuideStep,
  guideAnswer,
  guideEnded,
  guideStep,
  placeGuideBubble,
  playChoice,
  skipGuide,
  tallyGuide,
} from './castillo-guia-model';
import type { CastleMode } from './castillo-mode';
import { CastlePrevia } from './castillo-previa';

vi.mock('../../lib/supabase/config', () => ({ isSupabaseConfigured: () => false }));

/**
 * La guía de la primera partida del castillo (plan 015 T173, decisión 14):
 * la pregunta sale una vez (la respuesta se guarda en el progreso), «Saltar
 * guía» la acaba, cada paso pasa haciendo lo que pide (o con su ✕) y la
 * guía nunca cambia la partida.
 */

const obs = (over: Partial<CastleGuideObs> = {}): CastleGuideObs => ({
  mode: 'idle',
  plane: { x: 0, y: -300 },
  tally: EMPTY_GUIDE_TALLY,
  hasPriority: true,
  ...over,
});

const ids = CASTLE_GUIDE_STEPS.map((s) => s.id);
const at = (s: CastleGuideState) => guideStep(s)?.id ?? 'fin';

describe('la pregunta «¿Empezar con la guía?»', () => {
  it('sale sólo mientras no hay respuesta guardada; respondida, «Jugar» empieza (con la guía si se pide repetirla)', () => {
    expect(playChoice(null, false)).toEqual({ ask: true });
    expect(playChoice(null, true)).toEqual({ ask: true });
    expect(playChoice('no', false)).toEqual({ ask: false, guide: false });
    expect(playChoice('si', false)).toEqual({ ask: false, guide: false });
    expect(playChoice('no', true)).toEqual({ ask: false, guide: true });
  });

  it('sólo «si» y «no» cuentan como respuesta', () => {
    expect(guideAnswer('si')).toBe('si');
    expect(guideAnswer('no')).toBe('no');
    for (const v of [undefined, null, true, 1, 'sí', {}]) expect(guideAnswer(v)).toBeNull();
  });

  it('la respuesta se guarda en el progreso y sigue ahí al volver: la segunda partida no pregunta', async () => {
    const storage = new MemoryStorage();
    const repo = createLocalRepository({ storage, watch: false });
    expect(playChoice(guideAnswer(await repo.progress.pref(CASTLE_GUIDE_PREF)), false)).toEqual({
      ask: true,
    });
    await repo.progress.setPref(CASTLE_GUIDE_PREF, 'no');
    const again = createLocalRepository({ storage, watch: false });
    const answer = guideAnswer(await again.progress.pref(CASTLE_GUIDE_PREF));
    expect(answer).toBe('no');
    expect(playChoice(answer, false)).toEqual({ ask: false, guide: false });
  });
});

describe('los pasos', () => {
  it('pasan haciendo lo que piden, en orden, y la guía acaba tras llamar la oleada', () => {
    let s = advanceGuide(GUIDE_START, obs());
    expect(at(s)).toBe('mover');
    // El avión apenas se mueve: sigue el paso.
    s = advanceGuide(s, obs({ plane: { x: GUIDE_PLANE_MOVE_U / 2, y: -300 } }));
    expect(at(s)).toBe('mover');
    const moved = { x: GUIDE_PLANE_MOVE_U + 5, y: -300 };
    s = advanceGuide(s, obs({ plane: moved }));
    expect(at(s)).toBe('construir');
    s = advanceGuide(s, obs({ plane: moved, mode: 'tray' }));
    expect(at(s)).toBe('elegir');
    s = advanceGuide(s, obs({ plane: moved, mode: 'detail' }));
    expect(at(s)).toBe('colocar');
    s = advanceGuide(s, obs({ plane: moved, mode: 'placing' }));
    expect(at(s)).toBe('instalar');
    // Colocando aún no está instalada.
    s = advanceGuide(s, obs({ plane: moved, mode: 'placing' }));
    expect(at(s)).toBe('instalar');
    const built = { ...EMPTY_GUIDE_TALLY, built: 1 };
    s = advanceGuide(s, obs({ plane: moved, tally: built }));
    expect(at(s)).toBe('ficha');
    s = advanceGuide(s, obs({ plane: moved, tally: built, mode: 'tower' }));
    expect(at(s)).toBe('prioridad');
    const prio = { ...built, priority: 1 };
    s = advanceGuide(s, obs({ plane: moved, tally: prio, mode: 'tower' }));
    expect(at(s)).toBe('mejorar');
    const up = { ...prio, upgraded: 1 };
    s = advanceGuide(s, obs({ plane: moved, tally: up }));
    expect(at(s)).toBe('oleada');
    expect(guideEnded(s)).toBe(false);
    s = advanceGuide(s, obs({ plane: moved, tally: { ...up, called: 1 } }));
    expect(guideEnded(s)).toBe(true);
    expect(guideStep(s)).toBeNull();
  });

  it('una isla que no elige blanco salta «a quién apunta»', () => {
    let s: CastleGuideState = { step: ids.indexOf('prioridad'), from: { x: 0, y: 0 } };
    s = advanceGuide(s, obs({ mode: 'tower', hasPriority: false }));
    expect(at(s)).toBe('mejorar');
  });

  it('lo que ya se hizo antes no vuelve a pedirse (construir con las teclas 1–7 salta el detalle)', () => {
    let s: CastleGuideState = { step: ids.indexOf('construir'), from: { x: 0, y: 0 } };
    s = advanceGuide(s, obs({ mode: 'placing' }));
    expect(at(s)).toBe('instalar');
  });

  it('la ✕ cierra el bocadillo y sale el siguiente; el último cerrado acaba la guía', () => {
    let s = advanceGuide(GUIDE_START, obs());
    for (let i = 1; i < ids.length; i++) {
      s = closeGuideStep(s);
      expect(at(s)).toBe(ids[i]);
      s = advanceGuide(s, obs());
      expect(at(s)).toBe(ids[i]);
    }
    s = closeGuideStep(s);
    expect(guideEnded(s)).toBe(true);
    expect(closeGuideStep(s)).toBe(s);
  });

  it('«Saltar guía» la acaba desde cualquier paso', () => {
    expect(guideEnded(skipGuide())).toBe(true);
    expect(guideStep(skipGuide())).toBeNull();
    expect(advanceGuide(skipGuide(), obs()).step).toBe(ids.length);
  });

  it('cuenta lo que hizo el jugador con los eventos de la partida', () => {
    const events = [
      { type: 'towerBuilt' },
      { type: 'towerUpgrade' },
      { type: 'planeUpgrade' },
      { type: 'castleUpgrade' },
      { type: 'towerPriority' },
      { type: 'waveCalled' },
      { type: 'kill' },
    ] as unknown as DefenseEvent[];
    expect(tallyGuide(EMPTY_GUIDE_TALLY, events)).toEqual({
      built: 1,
      upgraded: 3,
      priority: 1,
      called: 1,
    });
    expect(tallyGuide(EMPTY_GUIDE_TALLY, [])).toBe(EMPTY_GUIDE_TALLY);
  });
});

describe('el bocadillo', () => {
  const view = { width: 390, height: 844 };
  it('va encima de lo que nombra, con la punta en su centro y dentro de la pantalla', () => {
    const p = placeGuideBubble({ left: 300, top: 700, width: 80, height: 44 }, view);
    expect(p.side).toBe('above');
    expect(p.y).toBeLessThan(700);
    expect(p.left).toBeGreaterThanOrEqual(16);
    expect(p.left + p.width).toBeLessThanOrEqual(view.width - 16);
    expect(p.left + p.tail!).toBeCloseTo(340, -1);
  });
  it('debajo si lo que nombra está arriba; sin nada que nombrar, en el centro y sin punta', () => {
    expect(placeGuideBubble({ left: 10, top: 40, width: 60, height: 44 }, view).side).toBe(
      'below',
    );
    const free = placeGuideBubble(null, view);
    expect(free.side).toBe('free');
    expect(free.tail).toBeNull();
  });
});

describe('la guía no cambia la partida (entra en el ranking como cualquiera)', () => {
  it('la misma partida mirándola cada paso con la guía da lo mismo', () => {
    const play = (guided: boolean) => {
      const g = createDefense(DEFENSE_CONFIG, 11, { runMin: 5, difficulty: 'normal' });
      let s = GUIDE_START;
      let tally = EMPTY_GUIDE_TALLY;
      for (let i = 0; i < 600; i++) {
        const events = g.step(i === 30 ? { moveTo: { x: 200, y: -200 } } : {});
        if (!guided) continue;
        tally = tallyGuide(tally, events);
        const snap = g.snapshot();
        s = advanceGuide(s, obs({ plane: snap.plane, tally }));
      }
      return { snap: JSON.stringify(g.snapshot()), step: s.step };
    };
    const plain = play(false);
    const guided = play(true);
    expect(guided.snap).toBe(plain.snap);
    // Y la guía sí vio moverse el avión.
    expect(guided.step).toBeGreaterThan(0);
  });
});

describe('el pop-up', () => {
  const castle = (prep: Partial<CastleMode['prep']>) =>
    ({
      medals: {},
      prep: {
        open: true,
        blocked: null,
        runMin: 5,
        difficulty: 'normal',
        asking: false,
        answered: false,
        replay: false,
        chooseRunMin: () => {},
        chooseDifficulty: () => {},
        play: () => {},
        setReplay: () => {},
        answer: () => {},
        back: () => {},
        close: () => {},
        ...prep,
      },
    }) as unknown as CastleMode;
  const render = (c: CastleMode) =>
    renderToStaticMarkup(createElement(CastlePrevia, { castle: c, ranking: () => null }));

  it('la primera vez pregunta «¿Empezar con la guía?» con «Sí» y «No, jugar»', () => {
    const html = render(castle({ asking: true }));
    expect(html).toContain('data-testid="mar-castillo-guia-pregunta"');
    expect(html).toContain(t('mar.castillo.guia.pregunta'));
    expect(html).toContain('data-testid="mar-castillo-guia-si"');
    expect(html).toContain('data-testid="mar-castillo-guia-no"');
    expect(html).not.toContain('data-testid="mar-castillo-previa-jugar"');
  });

  it('sin responder aún no hay «Con la guía»; respondida, sí (para repetirla)', () => {
    expect(render(castle({}))).not.toContain('mar-castillo-previa-guia');
    const html = render(castle({ answered: true, replay: true }));
    expect(html).toMatch(/data-testid="mar-castillo-previa-guia"[^>]*aria-checked="true"/);
    expect(html).toContain('data-testid="mar-castillo-previa-jugar"');
  });
});
