import { readFileSync } from 'node:fs';
import { DEFENSE_CONFIG, DEFENSE_CONFIG_VERSION, DEFENSE_RUN_MINS } from '@boia/engine/defense';
import { RPC_REJECTIONS } from '@boia/db/rpc';
import { describe, expect, it } from 'vitest';
import {
  CASTLE_DIFFICULTIES,
  CASTLE_RANKING_LIMITS,
  CASTLE_RANKING_VERSION,
  castleMaxKillPoints,
} from './ranking-castle';

const read = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const SQL = read('supabase/migrations/20261006100300_castle_ranking.sql');
describe('migración Castillo: paridad con la sim y permisos', () => {
  it('siembra exactamente los nueve pares con los topes del calendario y tiempos propios', () => {
    const seeded = [
      ...SQL.matchAll(
        /\((5|7|10), '(tranquila|normal|tormenta)', (\d+), (\d+), (\d+), (\d+), (\d+), (\d+), (\d+), (\d+)\)/g,
      ),
    ].map((m) => [Number(m[1]), m[2], ...m.slice(3).map(Number)]);
    expect(seeded).toEqual(
      DEFENSE_RUN_MINS.flatMap((min) =>
        CASTLE_DIFFICULTIES.map((diff) => [
          min,
          diff,
          CASTLE_RANKING_VERSION,
          DEFENSE_CONFIG_VERSION,
          CASTLE_RANKING_LIMITS.minS * 1000,
          DEFENSE_CONFIG.runs[min].durationS * 1000,
          (DEFENSE_CONFIG.runs[min].durationS + CASTLE_RANKING_LIMITS.slackS) * 1000,
          castleMaxKillPoints(min, diff),
          DEFENSE_CONFIG.score.lifeBonus,
          DEFENSE_CONFIG.castle.life,
        ]),
      ),
    );
  });
  it('rechazos catalogados, RLS y tablas sin escritura cliente; cuenta y no suplantación en RPC privada', () => {
    for (const m of SQL.matchAll(/raise exception '([a-z_]+)'/g))
      expect(RPC_REJECTIONS).toContain(m[1]);
    for (const t of ['castle_boards', 'castle_scores']) {
      expect(SQL).toContain(`alter table public.${t} enable row level security`);
      expect(read('packages/db/src/checks.ts')).toContain(`'${t}'`);
      expect(SQL).toContain(`grant select on public.${t} to anon, authenticated;`);
    }
    expect(SQL).toContain('p_user is distinct from private.require_member()');
    expect(SQL).toContain('p_ranked is distinct from true');
    expect(SQL).toContain("p_end not in ('held', 'fallen')");
    expect(SQL).toMatch(
      /revoke all on function public\.submit_castle_score\([^)]*\) from public, anon;/,
    );
    expect(SQL).toMatch(
      /grant execute on function public\.ranking_castle\([^)]*\) to anon, authenticated;/,
    );
  });
  it('el mejor sólo sube y los empates comparten puesto; todas las consultas incluyen el par', () => {
    expect(SQL).toContain('is_best := p_score > prev.best_score');
    expect(SQL).toContain('rank() over (order by b.value desc)');
    expect(SQL).toContain('primary key (user_id, run_min, difficulty, board_version)');
    expect(SQL).toContain(
      's.run_min = p_run_min and s.difficulty = p_difficulty and s.board_version = v',
    );
    expect(SQL).toContain('perform private.lock_account(p_user)');
    expect(SQL).toContain('p_score > b.max_kill_points + bonus');
  });
});
