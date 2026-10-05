import { readFileSync } from 'node:fs';
import { RPC_REJECTIONS } from '@boia/db/rpc';
import { SURVIVORS_CONFIG } from '@boia/engine/survivors';
import { describe, expect, it } from 'vitest';
import {
  CANON_RANKING_LIMITS,
  CANON_RANKING_VERSION,
  canonBoardBosses,
  canonGoldMinS,
} from './ranking-canon';

/**
 * La migración del ranking del Cañón (plan 013 T155,
 * `20261005100200_canon_ranking.sql`) dice lo mismo que el navegador. Sin
 * Postgres en esta máquina, se lee el SQL: una tabla por boss final con el
 * antitrampas de `CANON_RANKING_LIMITS` y la config del modo, y los rechazos
 * en el catálogo de @boia/db. Contra una base de verdad lo prueba
 * `packages/db/src/supabase/canon-ranking.supabase.ts`.
 */
const read = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const SQL = read('supabase/migrations/20261005100200_canon_ranking.sql');
/** Las tablas que ningún cliente escribe (`pnpm db:test` las comprueba contra la base). */
const READ_ONLY = /CLIENT_READ_ONLY_TABLES = \[([^\]]*)\]/.exec(
  read('packages/db/src/checks.ts'),
)![1]!;

describe('migración del ranking del Cañón (T155)', () => {
  it('siembra una tabla por boss final con los topes del navegador', () => {
    const seeded = [
      ...SQL.matchAll(/\('([a-z]+)', (\d+), '[^']+', (\d+), (\d+), (\d+), (\d+), (\d+)\)/g),
    ].map((m) => ({
      boss: m[1],
      version: Number(m[2]),
      min: Number(m[3]),
      gold: Number(m[4]),
      dawn: Number(m[5]),
      max: Number(m[6]),
      score: Number(m[7]),
    }));
    expect(seeded.map((s) => s.boss)).toEqual(canonBoardBosses());
    const night = SURVIVORS_CONFIG.durationS;
    SURVIVORS_CONFIG.acts.forEach((a, i) => {
      const s = seeded[i]!;
      expect(s).toEqual({
        boss: s.boss,
        version: CANON_RANKING_VERSION,
        min: CANON_RANKING_LIMITS.minS * 1000,
        gold: canonGoldMinS(a.act) * 1000,
        dawn: night * 1000,
        max: (night + CANON_RANKING_LIMITS.slackS) * 1000,
        score: CANON_RANKING_LIMITS.maxScore,
      });
    });
  });

  it('cada rechazo de las RPC está en el catálogo y las tablas sólo se escriben con la RPC', () => {
    const raised = [...SQL.matchAll(/raise exception '([a-z_]+)'/g)].map((m) => m[1]!);
    expect(raised.length).toBeGreaterThan(0);
    for (const r of raised) expect(RPC_REJECTIONS, r).toContain(r);
    for (const t of ['canon_boards', 'canon_scores']) {
      expect(SQL).toContain(`create table public.${t}`);
      expect(SQL).toContain(`alter table public.${t} enable row level security`);
      expect(READ_ONLY).toContain(`'${t}'`);
    }
    // Mandar, sólo con cuenta; leer, cualquiera.
    expect(SQL).toMatch(
      /revoke all on function public\.submit_canon_score\([^)]*\) from public, anon;/,
    );
    expect(SQL).toMatch(
      /grant execute on function public\.ranking_canon\([^)]*\) to anon, authenticated;/,
    );
    expect(SQL).toContain('private.require_member()');
  });

  it('la tabla va de la puntuación más alta a la más baja', () => {
    expect(SQL).toContain('rank() over (order by b.value desc)');
    expect(SQL).toContain('is_best := prev.voided_at is not null or p_score > prev.best_score');
  });
});
