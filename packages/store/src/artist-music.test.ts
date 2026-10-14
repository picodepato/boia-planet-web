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

  it('el artista y el socio guardan su apodo de siempre con un cambio, aunque ya choque (T293)', async () => {
    // Su apodo pasa a coincidir después con un artista de la lista y un miembro
    // de la muestra (contenido nuevo): guardar el suyo no es «apodo en uso».
    const { repo, reload } = makeRepo({ sample: { artists: [], crew: [] } });
    await repo.carnet.create({ nickname: 'Zeta', artistCode: 'abc', musicLink: SC });
    const later = reload({
      sample: {
        artists: [{ id: 'zeta', name: 'Zeta', genres: ['Techno'] }],
        crew: [],
      },
    });
    const bc = { platform: 'bandcamp', url: 'https://zeta.bandcamp.com/' } as const;
    for (const nickname of ['Zeta', 'zeta', ' ZETA ']) {
      const c = await later.carnet.update({ nickname, avatarKey: 'avatar-2', musicLink: bc });
      expect(c.musicLink).toEqual(bc);
      expect(c.memberNumber).toBe(10);
    }
    // Otro apodo que ya lleva alguien (aquí, el artista) sigue sin poder ser.
    const fan = makeRepo({
      sample: { artists: [{ id: 'zeta', name: 'Zeta', genres: ['Techno'] }], crew: [] },
    }).repo;
    await fan.carnet.create({ nickname: 'Socia' });
    expect((await fan.carnet.update({ nickname: 'Socia', avatarKey: 'avatar-3' })).nickname).toBe(
      'Socia',
    );
    const err = await fan.carnet.update({ nickname: 'ZETA' }).catch((e: unknown) => e);
    expect(isStoreError(err, 'conflict')).toBe(true);
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
