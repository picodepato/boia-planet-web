import { describe, expect, it } from 'vitest';
import {
  ARTIST_CARNET_SINCE,
  SAMPLE_ARTISTS,
  SAMPLE_CREW,
  SAMPLE_EVENTS,
  artistCarnetId,
} from './sample';
import { makeRepo } from './test-helpers';

/**
 * T66: los Carnets que «Descubrir a un BOIERO» puede enseñar (los miembros
 * de muestra y los artistas del contenido), sobre el repositorio local. El
 * descuento de tener Carnet se fue con el plan 019 (decisión 1).
 */

describe('Carnets de los artistas', () => {
  it('cada artista del contenido tiene su Carnet, construido desde su ficha', async () => {
    const { repo } = makeRepo();
    const playing = SAMPLE_ARTISTS.find((a) =>
      SAMPLE_EVENTS.some((e) => e.state !== 'draft' && e.artistIds?.includes(a.id)),
    )!;
    const view = (await repo.carnet.get(artistCarnetId(playing.id)))!;
    expect(view).toMatchObject({
      nickname: playing.name,
      isMine: false,
      isSample: true,
      answers: [],
      artist: { artistId: playing.id, genres: playing.genres },
    });
    const plays = SAMPLE_EVENTS.filter(
      (e) => e.state !== 'draft' && e.artistIds?.includes(playing.id),
    );
    expect(view.stamps.map((s) => s.eventId).sort()).toEqual(plays.map((e) => e.id).sort());
    const first = [...plays].sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]!;
    expect(view.memberSince).toBe(first.startsAt);
  });

  it('un artista sin eventos es miembro desde la fecha de muestra; uno que no existe, nada', async () => {
    const { repo } = makeRepo();
    const idle = SAMPLE_ARTISTS.find(
      (a) => !SAMPLE_EVENTS.some((e) => e.state !== 'draft' && e.artistIds?.includes(a.id)),
    );
    if (idle) {
      const view = (await repo.carnet.get(artistCarnetId(idle.id)))!;
      expect(view.memberSince).toBe(ARTIST_CARNET_SINCE);
      expect(view.stamps).toEqual([]);
    }
    expect(await repo.carnet.get(artistCarnetId('no-existe'))).toBeNull();
  });

  it('el Carnet sigue a la ficha que edita el Admin', async () => {
    const { repo } = makeRepo();
    const a = SAMPLE_ARTISTS[0]!;
    await repo.admin.upsert('artists', { ...a, name: 'Nombre Nuevo' });
    expect((await repo.carnet.get(artistCarnetId(a.id)))?.nickname).toBe('Nombre Nuevo');
  });

  it('nadie crea un Carnet con el nombre de un artista', async () => {
    const { repo } = makeRepo();
    const a = SAMPLE_ARTISTS[0]!;
    await expect(repo.carnet.create({ nickname: a.name.toUpperCase() })).rejects.toMatchObject({
      code: 'conflict',
    });
  });

  it('no entran en el ranking: sólo son de descubrir', async () => {
    const { repo } = makeRepo();
    const ranking = await repo.progress.ranking();
    expect(ranking.rows.some((r) => r.userId.startsWith('artista-'))).toBe(false);
  });
});

describe('Carnets para descubrir', () => {
  it('los miembros de muestra y luego los artistas, nunca el propio', async () => {
    const { repo } = makeRepo();
    await repo.carnet.create({ nickname: 'Grumete de Prueba' });
    const members = await repo.carnet.members();
    expect(members).toEqual([
      ...SAMPLE_CREW.map((c) => ({ userId: c.userId, nickname: c.nickname, kind: 'member' })),
      ...SAMPLE_ARTISTS.map((a) => ({
        userId: artistCarnetId(a.id),
        nickname: a.name,
        kind: 'artist',
      })),
    ]);
    const me = await repo.carnet.mine();
    expect(members.some((m) => m.userId === me!.userId)).toBe(false);
  });
});
