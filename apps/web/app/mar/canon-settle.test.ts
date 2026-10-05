import {
  LocalSessionAuthority,
  WorldMinigameSession,
  canon,
  canonConfigFor,
  canonEnd,
} from '@boia/engine/minigames';
import { SURVIVORS_CONFIG } from '@boia/engine/survivors';
import { MemoryStorage, createLocalRepository } from '@boia/store';
import { describe, expect, it, vi } from 'vitest';
import { withWinSignal } from '../../lib/mundo/minigame-layer';
import { settleCanonSession } from './canon-settle';
import { CANON_GAME_ID } from './survivors';

/**
 * «Terminar partida» (plan 013 T148): la partida que el jugador termina
 * desde la pausa no paga nada ni manda `win_minigame`, aunque haya jugado la
 * noche entera; la que llega al amanecer, sí (el control).
 */

/** Reloj de la autoridad (ms), que la prueba avanza a mano. */
function clock(start = Date.UTC(2026, 9, 5, 18)) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

/** Una partida del Cañón como la abre `useCanonMode`: el libro local, con la señal de victoria. */
function setup() {
  const c = clock();
  const authority = new LocalSessionAuthority(c.now);
  const repo = createLocalRepository({ storage: new MemoryStorage(), watch: false });
  const grant = vi.spyOn(repo.progress, 'grantWorldReward');
  const onWin = vi.fn();
  const sink = withWinSignal(repo.progress, CANON_GAME_ID, onWin);
  const open = () =>
    new WorldMinigameSession({
      def: canon,
      config: canonConfigFor(SURVIVORS_CONFIG),
      authority,
      sink,
      seed: 7,
    });
  return { c, repo, grant, onWin, open };
}

describe('«Terminar partida» no paga ni da la señal (T148)', () => {
  it('terminada tras la noche entera: sin liquidar, sin premio y sin `win_minigame`', async () => {
    const { c, repo, grant, onWin, open } = setup();
    const before = await repo.progress.balances();
    const session = open();
    // El reloj de la noche entera: si contara, llegaría al premio.
    c.advance(SURVIVORS_CONFIG.durationS * 1000);
    expect(settleCanonSession(session, 'quit', SURVIVORS_CONFIG.durationS)).toBeNull();
    await new Promise((r) => setTimeout(r, 0));
    expect(session.counts()).toBe(false);
    expect(grant).not.toHaveBeenCalled();
    expect(onWin).not.toHaveBeenCalled();
    expect(await repo.progress.balances()).toEqual(before);
  });

  it('aun liquidada a mano como `quit`, la sesión no paga ni da la señal', async () => {
    const { c, grant, onWin, open } = setup();
    const session = open();
    c.advance(SURVIVORS_CONFIG.durationS * 1000);
    const r = await session.finish(canonEnd('quit', SURVIVORS_CONFIG.durationS));
    expect(r.reward.granted).toBe(false);
    expect(grant).not.toHaveBeenCalled();
    expect(onWin).not.toHaveBeenCalled();
  });

  it('control: la misma noche acabada al amanecer sí paga y da la señal', async () => {
    const { c, repo, grant, onWin, open } = setup();
    const before = await repo.progress.balances();
    const session = open();
    c.advance(SURVIVORS_CONFIG.durationS * 1000);
    const settled = await settleCanonSession(session, 'survived', SURVIVORS_CONFIG.durationS);
    expect(settled?.reward.granted).toBe(true);
    expect(grant).toHaveBeenCalledTimes(1);
    expect(onWin).toHaveBeenCalledWith(CANON_GAME_ID);
    const after = await repo.progress.balances();
    expect(after.points).toBeGreaterThan(before.points);
  });
});
