import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { claimStamp } from './claim';
import { StampFeedback } from './stamp-feedback';

const state = vi.hoisted(() => ({
  configured: true,
  calls: [] as string[],
  reads: 0,
  failReads: [] as number[],
  noMine: false,
  granted: true,
  totals: [0, 50],
}));

vi.mock('../../supabase/config', () => ({ isSupabaseConfigured: () => state.configured }));
vi.mock('../../account/gate', () => ({ requireAccount: async () => true }));
vi.mock('../../repo', () => ({
  gameRepository: () => ({ content: { list: async () => [] } }),
  refreshMemberAccount: async () => {
    state.calls.push('refresh');
  },
}));
vi.mock('../../account/session', () => ({
  accountSnapshot: () => ({ userId: 'me' }),
  accountClient: async () => ({
    from: () => ({
      select: () => {
        const query = {
          eq: () => query,
          is: () => query,
          maybeSingle: async () => ({ data: null, error: null }),
          in: async () => ({ data: [], error: null }),
        };
        return query;
      },
    }),
    rpc: async (fn: string) => {
      state.calls.push(fn);
      if (fn === 'claim_stamp')
        return { data: { granted: state.granted, points: 50 }, error: null };
      const read = ++state.reads;
      if (state.failReads.includes(read)) throw new Error('sin red');
      const mine = state.noMine
        ? null
        : {
            position: read === 1 ? 4 : 2,
            user_id: 'me',
            nickname: 'Miembro de BOIA 12',
            member_number: 12,
            is_artist: false,
            value: state.totals[read - 1],
            is_mine: true,
          };
      return { data: { total: 60, offset: 0, rows: mine ? [mine] : [], mine }, error: null };
    },
  }),
}));

beforeEach(() => {
  state.configured = true;
  state.calls = [];
  state.reads = 0;
  state.failReads = [];
  state.noMine = false;
  state.granted = true;
  state.totals = [0, 50];
});

const sello = { event: 'fiesta', code: 'QR1234' };

describe('T194: puntos y puesto después del sello', () => {
  it('reclama entre las lecturas del ranking real y muestra puntos y puesto con i18n', async () => {
    const outcome = await claimStamp(sello);
    expect(state.calls).toEqual(['ranking_points', 'claim_stamp', 'refresh', 'ranking_points']);
    expect(outcome).toMatchObject({
      kind: 'granted',
      points: 50,
      pointsChange: { from: 0, to: 50 },
      position: 2,
    });
    if (outcome.kind !== 'granted') throw new Error('no concedido');
    const html = renderToStaticMarkup(createElement(StampFeedback, { outcome }));
    expect(html).toContain(t('stamp.pointsChip', { from: 0, to: 50 }));
    expect(html).toContain(t('stamp.nowRank', { rank: 2 }));
    // Las dos entradas del flujo usan el componente probado.
    for (const path of ['./own-carnet.tsx', '../../../app/sello/sello-page.tsx']) {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8');
      expect(source).toContain('<StampFeedback outcome=');
    }
  });

  it.each([[1], [2], [1, 2]])(
    'fallo de lectura %j no impide reclamar ni confirmar el sello',
    async (...reads) => {
      state.failReads = reads;
      const outcome = await claimStamp(sello);
      expect(outcome.kind).toBe('granted');
      expect(state.calls).toContain('claim_stamp');
      if (outcome.kind !== 'granted') throw new Error('no concedido');
      expect(outcome.pointsChange).toBeNull();
      if (reads.includes(2)) expect(outcome.position).toBeNull();
      const html = renderToStaticMarkup(createElement(StampFeedback, { outcome }));
      expect(html).toContain(t('stamp.pointsAwarded', { points: 50 }));
      if (reads.includes(2)) expect(html).toContain(t('stamp.rankUnavailable'));
    },
  );

  it('usa los totales moderados del lector, sin calcular el total a partir del premio', async () => {
    state.totals = [240, 265];
    expect(await claimStamp(sello)).toMatchObject({
      points: 50,
      pointsChange: { from: 240, to: 265 },
    });
    state.reads = 0;
    state.totals = [0, 0];
    expect(await claimStamp(sello)).toMatchObject({
      pointsChange: { from: 0, to: 0 },
      position: null,
    });
  });

  it('sin fila propia no inventa totales ni puesto; local y sello repetido no dan feedback de concesión', async () => {
    state.noMine = true;
    expect(await claimStamp(sello)).toMatchObject({
      kind: 'granted',
      pointsChange: null,
      position: null,
    });
    state.granted = false;
    expect(await claimStamp(sello)).toMatchObject({ kind: 'already' });
    state.configured = false;
    state.calls = [];
    expect(await claimStamp(sello)).toEqual({ kind: 'local' });
    expect(state.calls).toEqual([]);
  });
});
