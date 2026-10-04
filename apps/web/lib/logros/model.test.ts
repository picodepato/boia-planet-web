import { createLocalRepository } from '@boia/store';
import { describe, expect, it } from 'vitest';
import { achievementFacts, achievementGoal, completeBySignal } from '../mundo/achievements';
import { t } from '../i18n';
import {
  CLAIMED_HINT,
  HIDDEN_HINT,
  HIDDEN_TITLE,
  READY_HINT,
  goalProgress,
  logroRows,
  obtainedCount,
  readyCount,
  remainingText,
  rewardText,
} from './model';

/**
 * El panel de logros (T37) sobre el repositorio de verdad: los ocultos como
 * «???», barra y «te queda…» en los que van en curso, «Reclamar» sólo en
 * los completados, el contador del icono y el orden (primero lo que se
 * reclama). Todo sale del catálogo del repositorio, sin números a mano.
 */

const repo = () => createLocalRepository({ storage: null, watch: false });

async function snapshot(r: ReturnType<typeof repo>) {
  const [list, facts, cosmetics] = await Promise.all([
    r.progress.achievements(),
    achievementFacts(r.progress),
    r.content.list('cosmetics'),
  ]);
  const names = Object.fromEntries(cosmetics.map((c) => [c.id, c.name]));
  return { list, facts, names, rows: logroRows(list, facts, names) };
}

describe('filas del panel', () => {
  it('T115: el objetivo visible del náufrago pide rescate y descuento por clave i18n', async () => {
    const { rows } = await snapshot(repo());
    const castaway = rows.find((row) => row.id === 'naufrago-fiesta')!;
    expect(castaway.hidden).toBe(false);
    expect(castaway.description).toBe(t('achievements.castaway.description'));
    expect(castaway.hint).toContain('rescata al náufrago y recibe su descuento');
    expect(castaway.reward).toBe('+80 ★ · +40 🪙');
  });
  it('sin jugar: todo en curso, los ocultos como «???» y nada que reclamar', async () => {
    const { list, rows } = await snapshot(repo());
    expect(readyCount(list)).toBe(0);
    expect(obtainedCount(list)).toBe(0);
    const hidden = list.filter((a) => a.hidden);
    expect(hidden.length).toBeGreaterThan(0);
    for (const a of hidden) {
      const row = rows.find((r) => r.id === a.definition.id)!;
      expect(row).toMatchObject({ title: HIDDEN_TITLE, description: null, hint: HIDDEN_HINT });
      expect(row.progress).toBeNull();
    }
    // Los ocultos van al final de lo que está en curso.
    const firstHidden = rows.findIndex((r) => r.hidden);
    expect(rows.slice(firstHidden).every((r) => r.hidden)).toBe(true);
    for (const r of rows.filter((x) => !x.hidden)) {
      expect(r.state).toBe('in_progress');
      expect(r.progress).toBeGreaterThanOrEqual(0);
      expect(r.hint).toMatch(/^(Te queda|Tu mejor)/);
    }
  });

  it('una isla descubierta: barra, cuenta y lo que queda de las de islas', async () => {
    const r = repo();
    await completeBySignal(r, { trigger: 'visit_island', objectId: 'cala' });
    const { list, facts, rows } = await snapshot(r);
    for (const a of list.filter((x) => x.definition.trigger === 'visit_island')) {
      const goal = achievementGoal(a.definition, facts);
      const row = rows.find((x) => x.id === a.definition.id)!;
      expect(row.count).toBe(`1/${goal.need}`);
      expect(row.progress).toBeCloseTo(1 / goal.need);
      expect(row.hint).toBe(`Te quedan ${goal.need - 1} islas`);
    }
  });

  it('completado: arriba del todo, «Reclamar» y el contador; reclamado: abajo, una vez', async () => {
    const r = repo();
    const done = await completeBySignal(r, { trigger: 'find_buoy', objectId: 'boia-tutorial' });
    expect(done.length).toBeGreaterThan(0);
    const id = done[0]!.definition.id;
    let s = await snapshot(r);
    expect(readyCount(s.list)).toBe(done.length);
    expect(obtainedCount(s.list)).toBe(done.length);
    expect(s.rows[0]).toMatchObject({ id, state: 'ready', hint: READY_HINT, progress: 1 });

    const before = await r.progress.balances();
    const claim = await r.progress.claimAchievement(id);
    expect(claim.claimed).toBe(true);
    const after = await r.progress.balances();
    expect(after.points - before.points).toBe(done[0]!.definition.points);
    expect(after.coins - before.coins).toBe(done[0]!.definition.coins);
    // Otra vez no da nada.
    expect((await r.progress.claimAchievement(id)).claimed).toBe(false);
    expect(await r.progress.balances()).toEqual(after);

    s = await snapshot(r);
    expect(readyCount(s.list)).toBe(done.length - 1);
    expect(obtainedCount(s.list)).toBe(done.length);
    expect(s.rows.at(-1)).toMatchObject({ id, state: 'claimed', hint: CLAIMED_HINT });
  });

  it('un oculto completado ya enseña su título', async () => {
    const r = repo();
    const hidden = (await r.progress.achievements()).find((a) => a.hidden)!;
    await r.progress.completeAchievement(hidden.definition.id);
    const { rows } = await snapshot(r);
    const row = rows.find((x) => x.id === hidden.definition.id)!;
    expect(row.hidden).toBe(false);
    expect(row.title).not.toBe(HIDDEN_TITLE);
    expect(row.state).toBe('ready');
  });
});

describe('textos', () => {
  it('el premio: puntos, monedas y lo que dé además, con el nombre del cosmético', async () => {
    const r = repo();
    const { list, names } = await snapshot(r);
    for (const a of list) {
      const text = rewardText(a.reward, names);
      if (a.reward.points > 0) expect(text).toContain(`+${a.reward.points} ★`);
      if (a.reward.coins > 0) expect(text).toContain(`+${a.reward.coins} 🪙`);
      if (a.reward.kind === 'ship') expect(text).toContain(`Barco ${names[a.reward.cosmeticKey!]}`);
      if (a.reward.kind === 'badge') expect(text).toContain('Insignia');
    }
  });

  it('vuelta rápida: sin vueltas, el tiempo pedido; con una, lo que sobra', async () => {
    const { list, facts } = await snapshot(repo());
    const fast = list.find(
      (a) => (a.definition.triggerParams as Record<string, unknown>).maxMs !== undefined,
    )!;
    const goal = achievementGoal(fast.definition, facts);
    expect(goal.unit).toBe('ms');
    expect(remainingText(fast.definition, goal)).toMatch(/^Te queda una vuelta en menos de /);
    expect(goalProgress(goal)).toBe(0);
    const slow = { ...goal, have: goal.need * 2 };
    expect(remainingText(fast.definition, slow)).toMatch(/^Tu mejor vuelta: .* · te quedan /);
    expect(goalProgress(slow)).toBeCloseTo(0.5);
  });

  it('minutos a bordo y cosas de una sola vez', async () => {
    const { list, facts } = await snapshot(repo());
    const minutes = list.find((a) => a.definition.trigger === 'time_played')!;
    const g = achievementGoal(minutes.definition, facts);
    expect(remainingText(minutes.definition, g)).toBe(`Te quedan ${g.need} minutos a bordo`);
    const once = list.find(
      (a) => a.definition.trigger === 'create_carnet' && a.definition.description,
    )!;
    const text = remainingText(once.definition, achievementGoal(once.definition, facts));
    expect(text.startsWith('Te queda: ')).toBe(true);
    expect(text.endsWith('.')).toBe(false);
  });
});
