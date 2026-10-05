import { describe, expect, it } from 'vitest';
import { V2_NEW_COSMETICS } from './migrations';
import type { AchievementProgress, BoiaRepository } from './repository';
import { SAMPLE_ACHIEVEMENTS, SAMPLE_COSMETICS } from './sample';
import { SCHEMA_VERSION, type LedgerEntry } from './schema';
import { MemoryStorage, STORE_KEY } from './storage';
import { makeRepo } from './test-helpers';

/**
 * Logros que se reclaman (T36, D-22 punto 5): completar deja el logro listo
 * para reclamar sin tocar el libro; reclamar escribe su fila y su premio una
 * sola vez; cada tipo de premio llega a su sitio; y los datos de la v1 (logros
 * concedidos al momento) pasan a reclamados con los mismos saldos.
 */

const view = async (repo: BoiaRepository, id: string): Promise<AchievementProgress> => {
  const v = (await repo.progress.achievements()).find((a) => a.definition.id === id);
  if (!v) throw new Error(`sin logro ${id}`);
  return v;
};

/** Un logro de la muestra por tipo de premio (según lo que dice el repositorio). */
async function byRewardKind(repo: BoiaRepository) {
  const list = await repo.progress.achievements();
  const pick = (kind: string) => {
    const a = list.find((x) => x.reward.kind === kind);
    if (!a) throw new Error(`la muestra no tiene premio ${kind}`);
    return a;
  };
  return {
    coins: pick('coins'),
    badge: pick('badge'),
    ship: pick('ship'),
    cosmetic: pick('cosmetic'),
  };
}

describe('completar y reclamar', () => {
  it('completar lo deja listo para reclamar sin conceder nada', async () => {
    const { repo } = makeRepo();
    const def = SAMPLE_ACHIEVEMENTS.find((a) => a.points > 0 && a.coins > 0)!;
    expect((await view(repo, def.id)).state).toBe('in_progress');
    const r = await repo.progress.completeAchievement(def.id, { trigger: def.trigger });
    expect(r.completed).toBe(true);
    expect(r.achievement).toMatchObject({ state: 'ready', obtained: true, claimedAt: null });
    expect(await repo.progress.ledger()).toEqual([]);
    expect(await repo.progress.balances()).toMatchObject({ points: 0, coins: 0 });
    // Completar otra vez no cambia nada.
    expect((await repo.progress.completeAchievement(def.id)).completed).toBe(false);
    expect((await view(repo, def.id)).state).toBe('ready');
  });

  it('reclamar antes de completar no da nada', async () => {
    const { repo } = makeRepo();
    const def = SAMPLE_ACHIEVEMENTS[0]!;
    expect(await repo.progress.claimAchievement(def.id)).toEqual({
      claimed: false,
      reason: 'not_ready',
      entry: null,
    });
    expect(await repo.progress.ledger()).toEqual([]);
    await expect(repo.progress.claimAchievement('no-existe')).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('reclamar concede una vez, también tras recargar', async () => {
    const { repo, reload } = makeRepo();
    const def = SAMPLE_ACHIEVEMENTS.find((a) => a.points > 0 && a.coins > 0)!;
    await repo.progress.completeAchievement(def.id);
    const first = await repo.progress.claimAchievement(def.id);
    expect(first.claimed).toBe(true);
    const again = await repo.progress.claimAchievement(def.id);
    expect(again).toMatchObject({ claimed: false, reason: 'duplicate' });
    const later = reload();
    expect((await later.progress.claimAchievement(def.id)).claimed).toBe(false);
    expect(await later.progress.balances()).toMatchObject({ points: def.points, coins: def.coins });
    const rows = (await later.progress.ledger()).filter((e) => e.kind === 'achievement');
    expect(rows).toHaveLength(1);
    expect(await view(later, def.id)).toMatchObject({ state: 'claimed' });
    expect((await view(later, def.id)).claimedAt).not.toBeNull();
  });

  it('los ocultos cuentan en el total aunque se vean como «???»', async () => {
    const { repo } = makeRepo();
    const list = await repo.progress.achievements();
    expect(list).toHaveLength(SAMPLE_ACHIEVEMENTS.length);
    const hidden = SAMPLE_ACHIEVEMENTS.filter((a) => a.secret).map((a) => a.id);
    expect(list.filter((a) => a.hidden).map((a) => a.definition.id)).toEqual(hidden);
    for (const a of list.filter((x) => x.hidden)) expect(a.definition.title).toBe('???');
  });
});

describe('cada tipo de premio llega a su sitio', () => {
  const claim = async (repo: BoiaRepository, id: string) => {
    await repo.progress.completeAchievement(id);
    const r = await repo.progress.claimAchievement(id);
    if (!r.claimed) throw new Error(`no se reclamó ${id}`);
    return r;
  };

  it('monedas y puntos: a los saldos del libro', async () => {
    const { repo } = makeRepo();
    const { coins } = await byRewardKind(repo);
    await claim(repo, coins.definition.id);
    expect(await repo.progress.balances()).toMatchObject({
      points: coins.reward.points,
      coins: coins.reward.coins,
    });
    expect(coins.reward.coins).toBeGreaterThan(0);
  });

  it('insignia: en Mi Carnet', async () => {
    const { repo } = makeRepo();
    await repo.carnet.create({ nickname: 'Con insignia' });
    const { badge } = await byRewardKind(repo);
    expect((await repo.carnet.mine())?.badges).toEqual([]);
    await repo.progress.completeAchievement(badge.definition.id);
    expect((await repo.carnet.mine())?.badges).toEqual([]);
    await claim(repo, badge.definition.id);
    const badges = (await repo.carnet.mine())?.badges ?? [];
    expect(badges.map((b) => b.key)).toEqual([badge.reward.badgeKey]);
    expect(badges[0]?.title).toBe(badge.definition.title);
    expect(await repo.progress.badges()).toEqual(badges);
    expect((await repo.progress.balances()).points).toBe(badge.reward.points);
  });

  it('barco de estilo: bloqueado hasta reclamarlo', async () => {
    const { repo } = makeRepo();
    const { ship } = await byRewardKind(repo);
    const style = ship.reward.shipStyle;
    expect(style).toBeTruthy();
    const locked = await repo.progress.ships();
    // Sólo los barcos que se ganan (o se venden) están en la lista; su logro, al lado.
    const shipCosmetics = SAMPLE_COSMETICS.filter((c) => c.slot === 'ship');
    expect(locked.map((s) => s.cosmeticId)).toEqual(shipCosmetics.map((c) => c.id));
    expect(locked.find((s) => s.style === style)).toMatchObject({
      owned: false,
      achievementId: ship.definition.id,
    });
    await repo.progress.completeAchievement(ship.definition.id);
    expect((await repo.progress.ships()).find((s) => s.style === style)?.owned).toBe(false);
    const r = await claim(repo, ship.definition.id);
    expect(r.cosmetic?.cosmeticKey).toBe(ship.reward.cosmeticKey);
    expect((await repo.progress.ships()).find((s) => s.style === style)?.owned).toBe(true);
    // Los otros siguen bloqueados: sólo éste y los de base.
    expect(
      (await repo.progress.ships()).filter((s) => s.owned).map((s) => s.cosmeticId),
    ).toEqual(
      shipCosmetics.filter((c) => c.base || c.id === ship.reward.cosmeticKey).map((c) => c.id),
    );
    await repo.progress.equip('ship', ship.reward.cosmeticKey);
    expect(await repo.progress.equipped()).toEqual({ ship: ship.reward.cosmeticKey });
  });

  it('cosmético del barco: queda como cosmético propio', async () => {
    const { repo } = makeRepo();
    const { cosmetic } = await byRewardKind(repo);
    await claim(repo, cosmetic.definition.id);
    const owned = await repo.progress.cosmetics();
    expect(owned.map((c) => c.id)).toEqual([cosmetic.reward.cosmeticKey]);
    expect(owned[0]?.source).toBe(`achievement:${cosmetic.definition.id}`);
    // Un cosmético que ya se tenía no se duplica.
    expect((await repo.progress.ledger()).filter((e) => e.kind === 'cosmetic')).toHaveLength(1);
  });
});

describe('migración de la v1: lo concedido cuenta como reclamado', () => {
  const USER = 'invitada-v1';
  const at = '2026-09-20T10:00:00.000Z';
  const granted = (id: string, points: number, coins: number): LedgerEntry => ({
    id: `achievement:${id}`,
    userId: USER,
    kind: 'achievement',
    pointsDelta: points,
    coinsDelta: coins,
    seasonId: 'arcilla',
    achievementId: id,
    sourceRef: `achievement:${id}@1`,
    metadata: { version: 1, trigger: 'x' },
    createdAt: at,
  });
  // Premios de la v1 (antes del catálogo aprobado): así quedaron en el libro.
  const v1Ledger: LedgerEntry[] = [
    granted('primera-boia', 10, 5),
    granted('entrada', 100, 30),
    granted('secretos', 80, 25),
    granted('fiestera-entregada', 150, 50),
    {
      id: 'cosmetic:bandera-fiestera',
      userId: USER,
      kind: 'cosmetic',
      pointsDelta: 0,
      coinsDelta: 0,
      seasonId: 'arcilla',
      cosmeticKey: 'bandera-fiestera',
      sourceRef: 'achievement:fiestera-entregada',
      metadata: {},
      createdAt: at,
    },
    {
      id: 'world_reward:lugar:puerto:coins',
      userId: USER,
      kind: 'world_reward',
      pointsDelta: 0,
      coinsDelta: 7,
      seasonId: 'arcilla',
      sourceRef: 'lugar:puerto:coins',
      metadata: { policy: 'once' },
      createdAt: at,
    },
  ];
  const v1Doc = {
    schemaVersion: 1,
    identity: { id: USER, kind: 'guest', createdAt: at },
    carnets: {
      [USER]: {
        userId: USER,
        nickname: 'De la v1',
        avatarKey: null,
        avatarImage: null,
        memberSince: at,
        answers: {},
        version: 1,
        updatedAt: at,
      },
    },
    players: {
      [USER]: {
        discoveries: { 'boia:boia-tutorial': { at, worldId: 'arcilla' } },
        discounts: {},
        missions: {},
        records: {},
        counters: {},
        equipped: {},
        prefs: {},
      },
    },
    ledger: v1Ledger,
    purchases: [],
    bottles: [],
    bottleReads: [],
    bottleReports: [],
    content: { items: {}, order: {}, places: {}, skins: {}, texts: {} },
    audit: [],
  };
  const sum = (k: 'pointsDelta' | 'coinsDelta') => v1Ledger.reduce((a, e) => a + e[k], 0);

  it('mismos saldos, logros reclamados y el premio nuevo sin saldo', async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORE_KEY, JSON.stringify(v1Doc));
    const { repo } = makeRepo({ storage });
    expect(repo.status()).toMatchObject({ issue: null, schemaVersion: SCHEMA_VERSION });
    expect(repo.status().droppedOnLoad).toBe(0);
    expect(await repo.progress.balances()).toMatchObject({
      points: sum('pointsDelta'),
      coins: sum('coinsDelta'),
    });
    for (const e of v1Ledger.filter((x) => x.kind === 'achievement')) {
      const v = await view(repo, e.achievementId!);
      expect(v, e.achievementId).toMatchObject({ state: 'claimed', obtainedAt: at, claimedAt: at });
      // Reclamar otra vez no da nada.
      expect((await repo.progress.claimAchievement(e.achievementId!)).claimed).toBe(false);
    }
    expect(await repo.progress.balances()).toMatchObject({ points: sum('pointsDelta') });
    // `entrada` trae ahora su insignia y `secretos` su barco, sin tocar saldos.
    const entrada = SAMPLE_ACHIEVEMENTS.find((a) => a.id === 'entrada')!;
    expect((await repo.carnet.mine())?.badges.map((b) => b.key)).toEqual([entrada.badgeKey]);
    const ship = (await repo.progress.ships()).find(
      (s) => s.cosmeticId === V2_NEW_COSMETICS.secretos,
    );
    expect(ship).toMatchObject({ owned: true, achievementId: 'secretos' });
    // La bandera antigua se ignora; lo demás del jugador sigue ahí.
    const cosmetics = (await repo.progress.cosmetics()).map((c) => c.id).sort();
    expect(cosmetics).toEqual([V2_NEW_COSMETICS.secretos]);
    expect((await repo.progress.discoveries()).map((d) => d.key)).toEqual(['boia:boia-tutorial']);
    // Queda guardado en la versión nueva.
    const saved = JSON.parse(storage.getItem(STORE_KEY) ?? '{}');
    expect(saved.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('cada logro de la muestra que el catálogo premia con un barco nuevo está en la migración', () => {
    for (const [id, cosmeticKey] of Object.entries(V2_NEW_COSMETICS)) {
      expect(SAMPLE_ACHIEVEMENTS.find((a) => a.id === id)?.cosmeticKey).toBe(cosmeticKey);
    }
  });
});
