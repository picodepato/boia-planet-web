import { readFileSync } from 'node:fs';
import {
  CANON_MEDAL_PRIZES,
  CANON_VERSION,
  LocalSessionAuthority,
  type MinigameResult,
  WorldMinigameSession,
  canon,
  canonConfigFor,
  canonEarliestWinS,
  canonEnd,
  grantMinigameReward,
} from '@boia/engine/minigames';
import {
  SURVIVORS_CONFIG,
  type EndReason,
  type SurvivorsMedal,
  actFinalBoss,
} from '@boia/engine/survivors';
import { MINIKRAKEN, MemoryStorage, createLocalRepository } from '@boia/store';
import { describe, expect, it, vi } from 'vitest';
import { recordSignal } from '../../lib/mundo/achievements';
import { canonSignals, settleCanonSession } from './canon-settle';
import { CANON_GAME_ID } from './survivors';

/**
 * El premio y los logros del Cañón definitivo (plan 013 T153, §9 del diseño
 * de referencia), con el libro local de verdad:
 *
 * - cada medalla se cobra una vez al día, por separado
 *   (`minigame:canon:<medalla>@<día>`); una medalla cobra también las de
 *   debajo que aún no tuvieras ese día;
 * - el oro no vale antes de que entre el boss final (5:30), ni el bronce o la
 *   plata antes del amanecer;
 * - una partida de prueba (atajo de desarrollo, decisión 8) o terminada desde
 *   la pausa (T148, decisión 2) no paga nada ni da logros.
 */

const NIGHT_S = SURVIVORS_CONFIG.durationS;
const BOSS_S = canonEarliestWinS(SURVIVORS_CONFIG);
const { bronce, plata, oro } = CANON_MEDAL_PRIZES;
const DAY_MS = 24 * 3600 * 1000;

/**
 * Un navegador: el libro local y la autoridad de sesiones con el mismo reloj,
 * que la prueba avanza a mano. Cada partida se abre y se liquida como en
 * `canon-mode` (`settleCanonSession`, y sus señales con `canonSignals`).
 */
function browser(start = Date.UTC(2026, 9, 5, 8)) {
  let t = start;
  const advance = (ms: number) => (t += ms);
  const authority = new LocalSessionAuthority(() => t);
  const repo = createLocalRepository({
    storage: new MemoryStorage(),
    now: () => new Date(t),
    watch: false,
  });
  const grant = vi.spyOn(repo.progress, 'grantWorldReward');

  async function play(
    reason: EndReason,
    activeS: number,
    medal: SurvivorsMedal | null,
    o: {
      devStart?: boolean;
      devStartRewards?: boolean;
      skippedS?: number;
      bosses?: string[];
      difficulty?: string;
    } = {},
  ) {
    const session = new WorldMinigameSession({
      def: canon,
      config: canonConfigFor(SURVIVORS_CONFIG),
      authority,
      sink: repo.progress,
      ...(o.devStart ? { devStart: true } : {}),
      ...(o.skippedS ? { skippedS: o.skippedS } : {}),
      devStartRewards: o.devStartRewards ?? false,
    });
    advance((activeS - (o.skippedS ?? 0)) * 1000 + 1000);
    const settled = await settleCanonSession(session, reason, activeS, medal);
    const counts = !session.testStart || o.devStartRewards === true;
    const signals = canonSignals(settled, counts, {
      medal,
      bosses: o.bosses ?? [],
      difficulty: o.difficulty ?? 'normal',
    });
    const notices = [];
    for (const s of signals) notices.push(...(await recordSignal({ progress: repo.progress }, s)));
    return { settled, signals, notices };
  }

  const balances = () => repo.progress.balances();
  const ledgerIds = async () =>
    (await repo.progress.ledger()).filter((e) => e.kind === 'world_reward').map((e) => e.id);
  return { repo, play, balances, ledgerIds, advance, grant };
}

describe('premio por medalla, una vez al día cada una (T153)', () => {
  it('cada medalla paga una vez al día: repetirla el mismo día no paga', async () => {
    const b = browser();
    for (const [medal, reason, activeS, prize] of [
      ['bronce', 'survived', NIGHT_S, bronce],
      ['plata', 'survived', NIGHT_S, plata],
      ['oro', 'victory', BOSS_S + 20, oro],
    ] as const) {
      const first = await b.play(reason, activeS, medal);
      expect(first.settled?.validation).toEqual({ valid: true });
      expect(first.settled?.reward).toEqual({ granted: true, ...prize, tiers: [medal] });
      const again = await b.play(reason, activeS, medal);
      expect(again.settled?.validation).toEqual({ valid: true });
      expect(again.settled?.reward).toEqual({ granted: false, reason: 'duplicate' });
    }
    expect(await b.balances()).toMatchObject({
      points: bronce.points + plata.points + oro.points,
      coins: bronce.coins + plata.coins + oro.coins,
    });
  });

  it('bronce, plata y oro el mismo día pagan tres veces; al día siguiente, otra vez', async () => {
    const b = browser();
    const day = async () => {
      const paid = [];
      for (const [medal, reason, activeS] of [
        ['bronce', 'survived', NIGHT_S],
        ['plata', 'survived', NIGHT_S],
        ['oro', 'victory', BOSS_S + 1],
      ] as const) {
        paid.push((await b.play(reason, activeS, medal)).settled?.reward);
      }
      return paid;
    };
    expect(await day()).toEqual([
      { granted: true, ...bronce, tiers: ['bronce'] },
      { granted: true, ...plata, tiers: ['plata'] },
      { granted: true, ...oro, tiers: ['oro'] },
    ]);
    const total = {
      points: bronce.points + plata.points + oro.points,
      coins: bronce.coins + plata.coins + oro.coins,
    };
    expect(await b.balances()).toMatchObject(total);
    b.advance(DAY_MS);
    expect((await day()).every((r) => r?.granted)).toBe(true);
    expect(await b.balances()).toMatchObject({
      points: 2 * total.points,
      coins: 2 * total.coins,
    });
    // Seis filas del libro, una por medalla y día, con el origen de su medalla.
    const ids = await b.ledgerIds();
    expect(ids).toHaveLength(6);
    for (const m of ['bronce', 'plata', 'oro']) {
      expect(ids.filter((id) => id.startsWith(`world_reward:minigame:canon:${m}@`))).toHaveLength(
        2,
      );
    }
  });

  it('un oro de primeras cobra también la plata y el bronce del día; luego ya no', async () => {
    const b = browser();
    const gold = await b.play('victory', BOSS_S + 30, 'oro');
    expect(gold.settled?.reward).toEqual({
      granted: true,
      points: bronce.points + plata.points + oro.points,
      coins: bronce.coins + plata.coins + oro.coins,
      tiers: ['bronce', 'plata', 'oro'],
    });
    expect((await b.play('survived', NIGHT_S, 'plata')).settled?.reward).toEqual({
      granted: false,
      reason: 'duplicate',
    });
  });

  it('un oro antes de que entre el boss final (5:30) no vale ni paga', async () => {
    const b = browser();
    const early = await b.play('victory', BOSS_S - 30, 'oro');
    expect(early.settled?.validation).toEqual({ valid: false, reason: 'implausible_duration' });
    expect(early.settled?.reward.granted).toBe(false);
    expect(early.signals).toEqual([]);
    expect(b.grant).not.toHaveBeenCalled();
    expect(await b.balances()).toMatchObject({ points: 0, coins: 0 });
  });

  it('el escalón también se comprueba en el premio: oro antes del boss, plata antes del amanecer o una medalla que no casa', async () => {
    const rule = canonConfigFor(SURVIVORS_CONFIG).reward;
    const sink = { grantWorldReward: vi.fn(async () => ({ granted: true })) };
    const result = (
      reason: 'survived' | 'victory',
      activeS: number,
      tier: string,
    ): MinigameResult => ({
      ...canonEnd(reason, activeS),
      tier,
      sessionId: 's',
      gameId: 'canon',
      version: CANON_VERSION,
      seed: 1,
      configHash: 'x',
    });
    const valid = { valid: true } as const;
    expect(
      await grantMinigameReward(sink, rule, result('victory', BOSS_S - 1, 'oro'), valid),
    ).toEqual({ granted: false, reason: 'implausible_duration' });
    expect(
      await grantMinigameReward(sink, rule, result('survived', NIGHT_S - 60, 'plata'), valid),
    ).toEqual({ granted: false, reason: 'implausible_duration' });
    expect(
      await grantMinigameReward(sink, rule, result('survived', NIGHT_S, 'oro'), valid),
    ).toEqual({ granted: false, reason: 'implausible_score' });
    expect(
      await grantMinigameReward(sink, rule, result('survived', NIGHT_S, 'diamante'), valid),
    ).toEqual({ granted: false, reason: 'implausible_score' });
    expect(sink.grantWorldReward).not.toHaveBeenCalled();
  });

  it('una partida más corta de lo posible no vale', async () => {
    const b = browser();
    // 7:00 de juego dichos con sólo 1 min de reloj.
    const session = new WorldMinigameSession({
      def: canon,
      config: canonConfigFor(SURVIVORS_CONFIG),
      authority: new LocalSessionAuthority(() => Date.UTC(2026, 9, 5, 8)),
      sink: b.repo.progress,
    });
    const r = await settleCanonSession(session, 'survived', NIGHT_S, 'bronce');
    expect(r?.validation).toEqual({ valid: false, reason: 'implausible_duration' });
    expect(b.grant).not.toHaveBeenCalled();
  });

  it('una partida con atajo de desarrollo (en producción) no paga ni da logros', async () => {
    const b = browser();
    const seeded = await b.play('victory', BOSS_S + 10, 'oro', {
      devStart: true,
      bosses: ['kraken'],
    });
    expect(seeded.settled?.validation).toEqual({ valid: true });
    expect(seeded.settled?.reward).toEqual({ granted: false, reason: 'test_start' });
    expect(seeded.signals).toEqual([]);
    const skipped = await b.play('survived', NIGHT_S, 'bronce', { skippedS: NIGHT_S - 1 });
    expect(skipped.settled?.reward).toEqual({ granted: false, reason: 'test_start' });
    expect(skipped.signals).toEqual([]);
    expect(b.grant).not.toHaveBeenCalled();
    expect(await b.balances()).toMatchObject({ points: 0, coins: 0 });
    const ready = (await b.repo.progress.achievements()).filter((a) => a.state !== 'in_progress');
    expect(ready).toEqual([]);
  });
});

describe('«Terminar partida» no paga ni da logros (T148, T153)', () => {
  it('terminada tras la noche entera: sin liquidar, sin premio y sin señales', async () => {
    const b = browser();
    const quit = await b.play('quit', NIGHT_S, null, { bosses: ['fantasma'] });
    expect(quit.settled).toBeNull();
    expect(quit.signals).toEqual([]);
    expect(b.grant).not.toHaveBeenCalled();
    expect(await b.balances()).toMatchObject({ points: 0, coins: 0 });
  });

  it('aun liquidada a mano como `quit`, la sesión no paga', async () => {
    const b = browser();
    const session = new WorldMinigameSession({
      def: canon,
      config: canonConfigFor(SURVIVORS_CONFIG),
      authority: new LocalSessionAuthority(() => Date.UTC(2026, 9, 5, 8)),
      sink: b.repo.progress,
    });
    const r = await session.finish(canonEnd('quit', NIGHT_S));
    expect(r.reward.granted).toBe(false);
    expect(canonSignals(r, true, { medal: null, bosses: [], difficulty: 'normal' })).toEqual([]);
    expect(b.grant).not.toHaveBeenCalled();
  });
});

describe('los logros nuevos del Cañón (T153)', () => {
  it('jugar (aunque se inunde) completa «Zafarrancho»; ganar, «Hasta que amanezca»', async () => {
    const b = browser();
    const flooded = await b.play('flooded', 95, null);
    expect(flooded.signals).toEqual([{ trigger: 'play_minigame', game: CANON_GAME_ID }]);
    // Y Guardacostas, que desde el plan 014 (T157) también pide sólo jugar el Cañón.
    expect(flooded.notices.map((n) => n.id).sort()).toEqual([
      'logro:canon-zarpa',
      'logro:guardacostas',
    ]);
    const dawn = await b.play('survived', NIGHT_S, 'bronce');
    expect(dawn.notices.map((n) => n.id)).toEqual(['logro:canon']);
  });

  it('vencer al Kraken en Tormenta completa «Rompetentáculos» y el oculto «Ojo del huracán»; reclamarlo deja la mascota en el libro', async () => {
    const b = browser();
    const kraken = actFinalBoss(2, SURVIVORS_CONFIG)!;
    expect(kraken).toBe('kraken');
    const won = await b.play('victory', BOSS_S + 40, 'oro', {
      bosses: [kraken],
      difficulty: 'tormenta',
    });
    expect(won.notices.map((n) => n.id)).toEqual(
      expect.arrayContaining(['logro:canon-kraken', 'logro:canon-tormenta']),
    );
    expect(won.notices.map((n) => n.id)).not.toContain('logro:canon-fantasma');
    const claim = await b.repo.progress.claimAchievement('canon-kraken');
    expect(claim.claimed).toBe(true);
    const cosmetics = (await b.repo.progress.ledger()).filter((e) => e.kind === 'cosmetic');
    expect(cosmetics.map((e) => e.cosmeticKey)).toEqual([MINIKRAKEN]);
    expect((await b.repo.progress.shop()).find((i) => i.cosmetic.id === MINIKRAKEN)?.owned).toBe(
      true,
    );
  });

  it('el Barco Fantasma en Normal da «Exorcista» pero no el de Tormenta', async () => {
    const b = browser();
    const ghost = actFinalBoss(1, SURVIVORS_CONFIG)!;
    const won = await b.play('victory', BOSS_S + 40, 'oro', { bosses: [ghost] });
    const ids = won.notices.map((n) => n.id);
    expect(ids).toContain('logro:canon-fantasma');
    expect(ids).not.toContain('logro:canon-tormenta');
  });

  it('Guardacostas (v3, plan 014 T157: sin el minijuego del faro) pide jugar el Cañón, sin ganarlo', async () => {
    const b = browser();
    const flooded = await b.play('flooded', 60, null);
    expect(flooded.notices.map((n) => n.id)).toContain('logro:guardacostas');
    // Una señal del faro, que ya no existe, no completa nada.
    const other = browser();
    expect(
      await recordSignal(
        { progress: other.repo.progress },
        { trigger: 'win_minigame', game: 'faro' },
      ),
    ).toEqual([]);
  });
});

describe('el premio cabe en la base (Supabase, T153)', () => {
  it('cada medalla cabe en el tope por acción de `minigame`, y las tres juntas en el diario', () => {
    const sql = readFileSync(
      new URL('../../../../supabase/migrations/20261003100100_economy.sql', import.meta.url),
      'utf8',
    );
    const row = /\('minigame',[^;]*?array\[[^\]]*\],\s*(\d+), (\d+), (\d+), (\d+), true\)/.exec(
      sql,
    );
    expect(row).not.toBeNull();
    const [maxPoints, maxCoins, dailyPoints, dailyCoins] = row!.slice(1).map(Number);
    const medals = Object.values(CANON_MEDAL_PRIZES);
    for (const m of medals) {
      expect(m.points).toBeLessThanOrEqual(maxPoints!);
      expect(m.coins).toBeLessThanOrEqual(maxCoins!);
    }
    const day = medals.reduce(
      (a, m) => ({ points: a.points + m.points, coins: a.coins + m.coins }),
      { points: 0, coins: 0 },
    );
    expect(day.points).toBeLessThanOrEqual(dailyPoints!);
    expect(day.coins).toBeLessThanOrEqual(dailyCoins!);
  });
});
