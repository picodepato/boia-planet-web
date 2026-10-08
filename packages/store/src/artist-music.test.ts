import { describe, expect, it } from 'vitest';
import { isStoreError } from './errors';
import { makeRepo } from './test-helpers';

/** El enlace a la música de un Carnet de artista en modo local (plan 019 T217, decisión 10). */
describe('Carnet de artista: el enlace a su música', () => {
  const SC = { platform: 'soundcloud', url: 'https://soundcloud.com/zeta' } as const;

  it('se guarda al crear el Carnet con el enlace de artistas y se ve en el Carnet', async () => {
    const { repo } = makeRepo();
    const c = await repo.carnet.create({ nickname: 'Zeta', artistCode: 'abc', musicLink: SC });
    expect(c.isArtist).toBe(true);
    expect(c.musicLink).toEqual(SC);
    expect((await repo.carnet.get(c.userId))?.musicLink).toEqual(SC);
  });

  it('se cambia y se quita al editar; lo demás no lo toca', async () => {
    const { repo } = makeRepo();
    await repo.carnet.create({ nickname: 'Zeta', artistCode: 'abc', musicLink: SC });
    const bc = { platform: 'bandcamp', url: 'https://zeta.bandcamp.com/' } as const;
    expect((await repo.carnet.update({ musicLink: bc })).musicLink).toEqual(bc);
    expect((await repo.carnet.update({ nickname: 'Zeta Dos' })).musicLink).toEqual(bc);
    expect((await repo.carnet.update({ musicLink: null })).musicLink).toBeUndefined();
  });

  it('un enlace de otra plataforma o que no casa con la que dice se rechaza', async () => {
    const { repo } = makeRepo();
    for (const musicLink of [
      { platform: 'soundcloud', url: 'https://youtube.com/zeta' },
      { platform: 'spotify', url: 'https://soundcloud.com/zeta' },
      { platform: 'instagram', url: 'http://instagram.com/zeta' },
    ] as const) {
      const err = await repo.carnet.create({ nickname: 'Zeta', artistCode: 'abc', musicLink }).then(
        () => null,
        (e: unknown) => e,
      );
      expect(isStoreError(err, 'invalid'), musicLink.url).toBe(true);
    }
    expect(await repo.carnet.mine()).toBeNull();
  });
});
