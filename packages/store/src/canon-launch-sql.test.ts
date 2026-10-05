import { readFileSync } from 'node:fs';
import { ACHIEVEMENT_TRIGGERS_DB } from '@boia/contracts';
import { describe, expect, it } from 'vitest';
import { MINIGAME_REF, pointActionFor } from './member/ops';
import { COSMETIC_SLOTS } from './schema';
import { SAMPLE_ACHIEVEMENTS, SAMPLE_COSMETICS } from './sample';

/**
 * La migración del Cañón definitivo (plan 013 T153,
 * `20261005100000_canon_launch.sql`) dice lo mismo que el navegador. Sin
 * Postgres en esta máquina, se lee el SQL: las condiciones nuevas del enum
 * en el orden de @boia/contracts, el patrón de origen de la acción
 * `minigame` igual al de `pointActionFor`, la ranura `mascot` y los
 * cosméticos de los logros nuevos sembrados (los topes de las medallas, en
 * `apps/web/app/mar/canon-settle.test.ts`). Contra una base de verdad lo
 * prueba `packages/db/src/supabase/economy.supabase.ts`.
 */
const read = (path: string) =>
  readFileSync(new URL(`../../../supabase/${path}`, import.meta.url), 'utf8');
const LAUNCH = read('migrations/20261005100000_canon_launch.sql');
const BASE = read('migrations/20260928100500_progress.sql');
const SEEDS = read('seeds/20261003100100_economy.sql');

describe('migración del Cañón definitivo (T153)', () => {
  it('el enum achievement_trigger queda como ACHIEVEMENT_TRIGGERS_DB, en orden', () => {
    const created = /create type public\.achievement_trigger as enum \(([^)]*)\)/.exec(BASE);
    expect(created).not.toBeNull();
    const base = [...created![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    const added = [
      ...LAUNCH.matchAll(
        /alter type public\.achievement_trigger add value if not exists '([a-z_]+)'/g,
      ),
    ].map((m) => m[1]);
    expect([...base, ...added]).toEqual([...ACHIEVEMENT_TRIGGERS_DB]);
    // Cada condición del catálogo de muestra existe en la base.
    for (const a of SAMPLE_ACHIEVEMENTS) expect(ACHIEVEMENT_TRIGGERS_DB).toContain(a.trigger);
  });

  it('el patrón de origen de `minigame` es el del navegador y acepta las medallas', () => {
    const m = /ref_pattern = '([^']+)'\s*where action = 'minigame'/.exec(LAUNCH);
    expect(m).not.toBeNull();
    expect(m![1]).toBe(MINIGAME_REF.source);
    const sql = new RegExp(m![1]!);
    for (const ref of [
      'minigame:faro',
      'minigame:canon:bronce',
      'minigame:canon:plata',
      'minigame:canon:oro',
    ]) {
      expect(sql.test(ref), ref).toBe(true);
      expect(pointActionFor(ref), ref).toBe('minigame');
    }
    for (const ref of ['minigame:canon:diamante', 'minigame:canon:oro@2026-10-05', 'minigame:']) {
      expect(sql.test(ref), ref).toBe(false);
      expect(pointActionFor(ref), ref).toBeNull();
    }
  });

  it('la ranura `mascot` y los premios de los logros nuevos están en la base', () => {
    const check = /check \(slot in \(([^)]*)\)\)/.exec(LAUNCH);
    expect(check).not.toBeNull();
    // The historical database schema retains flag rows for compatibility (T167).
    expect([...check![1]!.matchAll(/'([a-z]+)'/g)].map((m) => m[1])).toEqual([
      'flag',
      ...COSMETIC_SLOTS,
    ]);
    for (const a of SAMPLE_ACHIEVEMENTS.filter((x) => x.id.startsWith('canon-') && x.cosmeticKey)) {
      const c = SAMPLE_COSMETICS.find((x) => x.id === a.cosmeticKey)!;
      expect(c, a.id).toBeDefined();
      expect(SEEDS).toContain(`('${c.id}', '${c.name}', '${c.slot}', null, null, '${a.id}',`);
    }
  });
});
