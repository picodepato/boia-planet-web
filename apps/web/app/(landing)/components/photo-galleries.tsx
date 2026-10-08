'use client';

import { homeWithSharedPhotos } from '../../../lib/admin/shared-photos';
import { FOTOS_COPY } from '../../../lib/landing/eventos-copy';
import { type Gallery, type GalleryIsland, photoGalleries } from '../../../lib/landing/eventos';
import { useLiveRepo } from '../../../lib/landing/use-live-home';
import { MediaCollage } from './media-collage';

/**
 * La Galería (REQ-COM-031; plan 019 T216, decisión 8): un collage sin
 * textos por cada isla, evento sin isla y la general, uno detrás de otro,
 * cada uno con su ancla (`/galeria#<isla>`, `/galeria#<evento>`), a la que
 * llevan «Ver fotos de la isla» y la ficha del evento. El nombre de cada
 * grupo sólo lo leen los lectores de pantalla. El servidor los pinta con la
 * muestra; el navegador, con lo del Admin de la demo (T26) y, con cuentas,
 * lo que el Admin subió a cada isla (T189).
 */
export function LivePhotoGalleries({
  initial,
  islands,
}: {
  initial: Gallery[];
  islands: GalleryIsland[];
}) {
  const { view } = useLiveRepo(initial, async (repo) => {
    const home = await homeWithSharedPhotos(repo);
    return photoGalleries(
      { events: home.events, albums: home.albums ?? [], photos: home.photos },
      islands,
    );
  });
  return <PhotoGalleries galleries={view} />;
}

export function PhotoGalleries({ galleries }: { galleries: readonly Gallery[] }) {
  return (
    <div className="galeria">
      {galleries.map((g) => {
        const items = g.sections.flatMap((s) => s.photos);
        const name = g.title || FOTOS_COPY.general;
        return (
          <section
            key={g.id}
            id={g.id}
            className="galeria__grupo"
            aria-label={name}
            data-testid={`galeria-${g.id}`}
            data-kind={g.kind}
            data-piezas={items.length}
          >
            {items.length > 0 ? (
              <MediaCollage items={items} label={name} testId={`collage-${g.id}`} />
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
