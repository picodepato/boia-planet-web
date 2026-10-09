import { describe, expect, it } from 'vitest';
import { makeRepo } from './test-helpers';

/**
 * REQ-ARQ-008: cambiar de temporada (el mundo activo que elige el Admin)
 * conserva lo global —Carnet, cosmético equipado, preferencias, puntos
 * históricos— y deja lo de temporada (misión, descubrimientos, puntuación de
 * temporada) en el ámbito de la temporada en que se ganó.
 */
describe('cambio de temporada (REQ-ARQ-008)', () => {
  it('REQ-ARQ-008: cambiar de temporada conserva lo global y separa lo de temporada', async () => {
    const { repo } = makeRepo();
    await repo.admin.setActiveWorld('arcilla');

    const carnet = await repo.carnet.create({ nickname: 'Temporadas' });
    const ship = (await repo.progress.ships()).find((s) => s.owned)!;
    const equipped = await repo.progress.equip('ship', ship.cosmeticId);
    await repo.progress.setPref('sonido', false);
    await repo.progress.grantWorldReward({ sourceRef: 'boia-t1', points: 5, policy: 'season' });
    await repo.progress.discover('isla-t1');
    await repo.progress.setMission('rescate-t1', { step: 'rescued' });

    await repo.admin.setActiveWorld('acuarela');
    await repo.progress.grantWorldReward({ sourceRef: 'boia-t1', points: 2, policy: 'season' });
    await repo.progress.discover('isla-t2');

    // Lo global sigue igual en la temporada nueva.
    expect((await repo.carnet.mine())?.nickname).toBe(carnet.nickname);
    expect(await repo.progress.equipped()).toEqual(equipped);
    expect(await repo.progress.pref('sonido')).toBe(false);
    const b = await repo.progress.balances();
    expect(b.points).toBe(7);

    // Lo de temporada queda con la suya.
    expect(b.seasonPoints).toEqual({ arcilla: 5, acuarela: 2 });
    const worldOf = Object.fromEntries(
      (await repo.progress.discoveries()).map((d) => [d.key, d.worldId]),
    );
    expect(worldOf).toEqual({ 'isla-t1': 'arcilla', 'isla-t2': 'acuarela' });
    expect((await repo.progress.mission('rescate-t1'))?.worldId).toBe('arcilla');
  });
});
