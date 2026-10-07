import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { t } from '../i18n';
import { RANKING_COPY } from './menu/sections/ranking';

it('T194: el aviso propio sin puesto usa i18n y las filas conservan la estructura T188', () => {
  expect(RANKING_COPY.minePoints(null, 62, '0')).toBe(t('ranking.mine.noPoints'));
  expect(RANKING_COPY.minePoints(1, 62, '100')).toBe(
    t('ranking.mine.points', { n: 1, total: 62, points: '100' }),
  );
  const source = readFileSync(new URL('./menu/sections/ranking.tsx', import.meta.url), 'utf8');
  expect(source).toContain("board.kind === 'points' && r.position === null");
  expect(source).toContain("t('ranking.noPoints')");
  expect(source).toContain("{row.position ?? '–'}");
});
