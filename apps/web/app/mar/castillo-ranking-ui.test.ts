import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { castleResult, memoryCastleStorage } from '../../lib/mundo/__fixtures__/castle-result';
import { recordCastleBest } from '../../lib/mundo/ranking-castle';
import { CastleEndRanking, CastlePairRanking } from './castillo-ranking';

vi.mock('../../lib/supabase/config', () => ({ isSupabaseConfigured: () => false }));
afterEach(() => vi.unstubAllGlobals());
describe('ranking visible del Castillo', () => {
  it('el pop-up muestra tripulación y tu récord sólo en su par', () => {
    const storage = memoryCastleStorage();
    const r = castleResult();
    recordCastleBest(storage, r, 'ahora');
    vi.stubGlobal('window', { localStorage: storage });
    const markup = renderToStaticMarkup(
      createElement(CastlePairRanking, { runMin: 5, difficulty: 'normal' }),
    );
    expect(markup).toContain('data-ranking="local"');
    expect(markup.match(/data-testid="mar-castillo-ranking-fila"/g)).toHaveLength(4);
    expect(markup).toContain(`data-puntos="${r.score}"`);
    expect(markup).toContain('Tú');
    for (const pair of [
      { runMin: 7 as const, difficulty: 'normal' as const },
      { runMin: 5 as const, difficulty: 'tormenta' as const },
    ]) {
      expect(renderToStaticMarkup(createElement(CastlePairRanking, pair))).toContain(
        'Tú (aún sin partida)',
      );
    }
  });
  it('la tarjeta muestra puesto y mejor o el motivo; conserva el aviso de partida de prueba de T162', () => {
    const base = { score: 1000, best: 2000, isBest: false };
    const local = renderToStaticMarkup(
      createElement(CastleEndRanking, {
        ranking: { ...base, standing: { kind: 'local', position: 3, of: 4 } },
      }),
    );
    expect(local).toContain('Puesto 3 de 4');
    expect(local).toContain('Tu mejor: 2000');
    expect(local).toContain('data-mejor="2000"');
    const best = renderToStaticMarkup(
      createElement(CastleEndRanking, {
        ranking: { ...base, isBest: true, standing: { kind: 'global', position: 2, total: 20 } },
      }),
    );
    expect(best).toContain('¡Tu mejor!');
    const off = renderToStaticMarkup(
      createElement(CastleEndRanking, {
        ranking: { ...base, standing: { kind: 'off', reason: 'test' } },
      }),
    );
    expect(off).toContain('data-testid="mar-castillo-final-prueba"');
    expect(off).toContain('data-motivo="test"');
    expect(off).not.toContain('mar-castillo-final-record');
  });
});
