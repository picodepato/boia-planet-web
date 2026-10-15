import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AFTER_ACHIEVEMENT,
  AFTER_COINS,
  AFTER_POINTS,
  AFTER_SHIP,
  SAMPLE_ACHIEVEMENTS,
  SAMPLE_COSMETICS,
} from './sample';

/**
 * El catálogo de logros del navegador y el servidor dicen lo mismo (plan 032
 * T300): todo logro se puede cobrar en Supabase sin que lo rechace el tope
 * (`limit_action`) y lo que regala existe en la base con ese logro. Antes, el
 * logro secreto del after (500 monedas) y su barco sólo existían aquí.
 */

const SUPABASE = new URL('../../../supabase/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, SUPABASE), 'utf8');
const sqlFiles = (dir: string) =>
  readdirSync(new URL(dir, SUPABASE))
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => read(`${dir}/${f}`));
const ALL_SQL = [...sqlFiles('migrations'), ...sqlFiles('seeds')].join('\n');
const PRIZES_SQL = read('migrations/20261015100700_secret_prizes_member_restore.sql');

/** El tope por logro de la acción `achievement` (economy.sql). */
function achievementCaps(): { points: number; coins: number } {
  const m = /\('achievement',\s*'[^']*',\s*'[^']*',\s*array\['once'\],\s*(\d+),\s*(\d+),/.exec(
    read('migrations/20261003100100_economy.sql'),
  );
  if (!m) throw new Error('economy.sql sin la acción achievement');
  return { points: Number(m[1]), coins: Number(m[2]) };
}

/** Los logros con tope propio (`private.achievement_prizes`). */
function ownCaps(): Map<string, { points: number; coins: number }> {
  const block = /insert into private\.achievement_prizes[\s\S]*?on conflict/.exec(PRIZES_SQL)?.[0];
  const out = new Map<string, { points: number; coins: number }>();
  for (const m of (block ?? '').matchAll(/\('([a-z0-9-]+)',\s*(\d+),\s*(\d+),/g)) {
    out.set(m[1]!, { points: Number(m[2]), coins: Number(m[3]) });
  }
  return out;
}

describe('logros del navegador en el servidor (T300)', () => {
  it('ningún logro pasa de su tope en el servidor', () => {
    const base = achievementCaps();
    const own = ownCaps();
    for (const a of SAMPLE_ACHIEVEMENTS) {
      const cap = own.get(a.id) ?? base;
      expect(a.points, a.id).toBeLessThanOrEqual(Math.max(cap.points, base.points));
      expect(a.coins, a.id).toBeLessThanOrEqual(Math.max(cap.coins, base.coins));
    }
  });

  it('el del after tiene su tope propio: exactamente su premio', () => {
    expect(ownCaps().get(AFTER_ACHIEVEMENT)).toEqual({ points: AFTER_POINTS, coins: AFTER_COINS });
    // Sólo hace falta tope propio si no cabe en el de la acción.
    const base = achievementCaps();
    for (const [id] of ownCaps()) {
      const a = SAMPLE_ACHIEVEMENTS.find((x) => x.id === id);
      expect(a, id).toBeDefined();
      expect(a!.points > base.points || a!.coins > base.coins, id).toBe(true);
    }
  });

  it('lo que regala cada logro está en la base, con ese logro', () => {
    for (const a of SAMPLE_ACHIEVEMENTS.filter((x) => x.cosmeticKey)) {
      const row = new RegExp(
        `\\('${a.cosmeticKey}',\\s*'[^']*',\\s*'[a-z]+',\\s*null,\\s*null,\\s*'${a.id}',`,
      );
      expect(row.test(ALL_SQL), `${a.id} → ${a.cosmeticKey}`).toBe(true);
    }
  });

  it('el barco del after, en la ranura del barco y sin precio, como en el navegador', () => {
    const local = SAMPLE_COSMETICS.find((c) => c.id === AFTER_SHIP)!;
    expect(local.slot).toBe('ship');
    expect(local.priceCoins).toBeNull();
    expect(PRIZES_SQL).toMatch(
      new RegExp(
        `\\('${AFTER_SHIP}',\\s*'[^']*',\\s*'ship',\\s*null,\\s*null,\\s*'${AFTER_ACHIEVEMENT}',`,
      ),
    );
  });
});
