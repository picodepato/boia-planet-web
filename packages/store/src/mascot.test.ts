import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isStoreError } from './errors';
import { COSMETIC_SLOTS, SCHEMA_VERSION } from './schema';
import { MINIKRAKEN, SAMPLE_ACHIEVEMENTS, SAMPLE_COSMETICS } from './sample';
import { STORE_KEY } from './storage';
import { makeRepo } from './test-helpers';

/**
 * La mascota de cubierta (plan 013 T154): la ranura `mascot` de Mi Barco con
 * el minikraken, que da el logro `canon-kraken` (T153). Sólo se equipa si es
 * tuya y en su ranura; quitarla deja la ranura vacía; lo equipado se guarda,
 * sobrevive a recargar y a la migración de un documento anterior. En
 * Supabase, la migración `20261005100100_mascot_equip.sql` acepta la ranura.
 */

const kraken = SAMPLE_ACHIEVEMENTS.find((a) => a.cosmeticKey === MINIKRAKEN)!;

async function claimKraken(repo: ReturnType<typeof makeRepo>['repo']) {
  await repo.progress.completeAchievement(kraken.id);
  await repo.progress.claimAchievement(kraken.id);
}

describe('mascota minikraken (T154)', () => {
  it('el catálogo la tiene en la ranura `mascot` y la da `canon-kraken`', () => {
    expect(kraken.id).toBe('canon-kraken');
    expect(SAMPLE_COSMETICS.find((c) => c.id === MINIKRAKEN)?.slot).toBe('mascot');
  });

  it('sin el logro no se puede equipar; en la tienda sale bloqueada por el logro', async () => {
    const { repo } = makeRepo();
    const item = (await repo.progress.shop()).find((i) => i.cosmetic.id === MINIKRAKEN)!;
    expect(item.owned).toBe(false);
    expect(item.unlock).toMatchObject({ kind: 'achievement', achievementId: kraken.id });
    const err = await repo.progress.equip('mascot', MINIKRAKEN).catch((e: unknown) => e);
    expect(isStoreError(err, 'forbidden')).toBe(true);
    expect(await repo.progress.equipped()).toEqual({});
  });

  it('con el logro reclamado se equipa, se quita y no va en otra ranura', async () => {
    const { repo, reload } = makeRepo();
    await claimKraken(repo);
    const item = (await repo.progress.shop()).find((i) => i.cosmetic.id === MINIKRAKEN)!;
    expect(item.owned).toBe(true);
    const wrong = await repo.progress.equip('wake', MINIKRAKEN).catch((e: unknown) => e);
    expect(isStoreError(wrong)).toBe(true);
    expect(await repo.progress.equip('mascot', MINIKRAKEN)).toEqual({ mascot: MINIKRAKEN });
    // Al recargar sigue puesta.
    expect((await reload().progress.equipped()).mascot).toBe(MINIKRAKEN);
    expect(await repo.progress.equip('mascot', null)).toEqual({});
    expect(await reload().progress.equipped()).toEqual({});
  });

  it('migra: un documento v7 se abre, gana la mascota y la lleva', async () => {
    const first = makeRepo();
    await first.repo.progress.grantWorldReward({ sourceRef: 'cofre', points: 5, coins: 7 });
    const doc = JSON.parse(first.storage.getItem(STORE_KEY)!) as Record<string, unknown>;
    doc.schemaVersion = 7;
    const { storage, reload } = makeRepo();
    storage.setItem(STORE_KEY, JSON.stringify(doc));
    const repo = reload();
    expect(repo.status().schemaVersion).toBe(SCHEMA_VERSION);
    await claimKraken(repo);
    await repo.progress.equip('mascot', MINIKRAKEN);
    const again = reload();
    expect((await again.progress.equipped()).mascot).toBe(MINIKRAKEN);
    expect(await again.progress.balances()).toMatchObject({
      points: 5 + kraken.points,
      coins: 7 + (kraken.coins ?? 0),
    });
  });

  it('la migración de Supabase acepta la ranura en lo equipado y al equipar', () => {
    const sql = readFileSync(
      new URL('../../../supabase/migrations/20261005100100_mascot_equip.sql', import.meta.url),
      'utf8',
    );
    const lists = [...sql.matchAll(/slot (?:not )?in \(([^)]*)\)/g)].map((m) =>
      [...m[1]!.matchAll(/'([a-z]+)'/g)].map((x) => x[1]),
    );
    // El check de `equipped_cosmetics` y el de `private.equip_cosmetic`.
    expect(lists).toHaveLength(2);
    // Historical SQL still accepts flag rows; the client ignores them on load (T167).
    for (const l of lists) expect(l).toEqual(['flag', ...COSMETIC_SLOTS]);
    expect(sql).toContain('equipped_cosmetics_slot_check');
    expect(sql).toContain('create or replace function private.equip_cosmetic(');
  });
});
