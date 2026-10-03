import { describe, expect, it } from 'vitest';
import { BOM, type MemberRow, NEWS_CSV_COLUMNS, newsCsv } from './csv';

const row = (p: Partial<MemberRow>): MemberRow => ({
  user_id: 'u',
  email: 'a@b.es',
  nickname: 'Ana',
  member_number: 7,
  member_since: '2026-10-03T10:00:00Z',
  signed_up_at: '2026-10-03T10:00:00Z',
  is_artist: false,
  news: true,
  news_at: '2026-10-03T10:00:00Z',
  news_version: 'muestra-2026-10-03',
  privacy_version: 'muestra-2026-10-03',
  privacy_at: '2026-10-03T10:00:00Z',
  total: 1,
  ...p,
});

describe('CSV de socios con noticias (T94)', () => {
  it('sólo quien dijo que sí, con la fecha y la versión del consentimiento', () => {
    const csv = newsCsv([
      row({ email: 'si@b.es', nickname: 'Sí' }),
      row({ email: 'no@b.es', news: false }),
    ]);
    expect(csv.startsWith(BOM)).toBe(true);
    const lines = csv.slice(BOM.length).trim().split('\r\n');
    expect(lines[0]).toBe(NEWS_CSV_COLUMNS.join(','));
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      '"si@b.es","Sí","7","2026-10-03T10:00:00Z","2026-10-03T10:00:00Z","muestra-2026-10-03"',
    );
    expect(csv).not.toContain('no@b.es');
  });

  it('escapa comillas y fórmulas', () => {
    const csv = newsCsv([row({ nickname: '=HYPERLINK("x")' }), row({ nickname: 'Di "hola"' })]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"Di ""hola"""');
  });
});
