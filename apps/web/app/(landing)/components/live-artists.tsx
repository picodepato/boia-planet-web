'use client';

import type { Artist } from '@boia/contracts';
import type { ArtistCarnet } from '../../../lib/artists/entries';
import { useLiveRepo } from '../../../lib/landing/use-live-home';
import { ArtistsList } from './artists-list';

interface ArtistsView {
  artists: readonly Artist[];
  carnets: readonly ArtistCarnet[];
}

/**
 * La lista de /artistas: la muestra del servidor y, al montar, la del
 * repositorio (T26) con los Carnets de artista (plan 019 T217).
 */
export function LiveArtists({ initial }: { initial: readonly Artist[] }) {
  const { view } = useLiveRepo<ArtistsView>({ artists: initial, carnets: [] }, async (repo) => {
    const { readArtistCarnets } = await import('../../../lib/artists/registered');
    const [content, carnets] = await Promise.all([repo.content.home(), readArtistCarnets(repo)]);
    return { artists: content.artists, carnets };
  });
  return <ArtistsList artists={view.artists} carnets={view.carnets} />;
}
