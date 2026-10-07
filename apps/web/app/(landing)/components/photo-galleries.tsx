'use client';

import Link from 'next/link';
import { homeWithSharedPhotos } from '../../../lib/admin/shared-photos';
import { FOTOS_COPY } from '../../../lib/landing/eventos-copy';
import {
  type Gallery,
  type GalleryIsland,
  eventHref,
  photoGalleries,
} from '../../../lib/landing/eventos';
import { useLiveRepo } from '../../../lib/landing/use-live-home';
import { formatEventDate } from '../../../lib/landing/texts';
import { PhotoGrid } from './photo-tile';

/**
 * Las galerías de «Fotos y eventos» (REQ-COM-031): una por isla, una por
 * evento sin isla y la general, cada una con su ancla (`/fotos#<isla>`,
 * `/fotos#<evento>`), a la que llevan «Ver fotos de la isla» y la ficha del
 * evento. El servidor las pinta con la muestra; el navegador, con lo del
 * Admin de la demo (T26).
 */
export function LivePhotoGalleries({
  initial,
  islands,
}: {
  initial: Gallery[];
  islands: GalleryIsland[];
}) {
  const { view } = useLiveRepo(initial, async (repo) => {
    // Con cuentas, también las fotos que el Admin subió a cada isla (T189).
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
    <>
      <nav className="gallery-nav" aria-label={FOTOS_COPY.islandsNav}>
        <ul className="chip-list">
          {galleries.map((g) => (
            <li key={g.id}>
              <a className="chip" href={`#${g.id}`}>
                {g.title || FOTOS_COPY.general} <span aria-hidden="true">· {g.count}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {galleries.map((g) => (
        <section
          key={g.id}
          id={g.id}
          className="gallery"
          aria-labelledby={`galeria-${g.id}`}
          data-testid={`galeria-${g.id}`}
          data-kind={g.kind}
        >
          <h2 id={`galeria-${g.id}`} className="gallery__title">
            {g.title || FOTOS_COPY.general}
          </h2>
          <p className="gallery__meta">
            {g.kind === 'island'
              ? FOTOS_COPY.byIsland
              : g.kind === 'event'
                ? FOTOS_COPY.byEvent
                : ''}
            {g.kind !== 'general' ? ' · ' : ''}
            {FOTOS_COPY.count(g.count)}
          </p>
          {g.sections.length === 0 ? (
            <p className="gallery__empty">
              {g.kind === 'island' ? FOTOS_COPY.emptyIsland : FOTOS_COPY.empty}
            </p>
          ) : (
            g.sections.map((s) => (
              <div key={s.album.id} className="gallery__album" data-album={s.album.id}>
                <h3 className="gallery__album-title">
                  {s.album.title}
                  {s.event ? (
                    <>
                      {' · '}
                      <Link href={eventHref(s.event.slug)} prefetch={false}>
                        {FOTOS_COPY.eventPage}
                      </Link>
                    </>
                  ) : null}
                </h3>
                {s.album.date ? (
                  <p className="gallery__meta">
                    <time dateTime={s.album.date}>
                      {formatEventDate(s.album.date, s.event?.timeZone ?? 'Europe/Madrid')}
                    </time>
                  </p>
                ) : null}
                {s.photos.length > 0 ? (
                  <PhotoGrid photos={s.photos} label={s.album.title} />
                ) : (
                  <p className="gallery__empty">{FOTOS_COPY.empty}</p>
                )}
              </div>
            ))
          )}
        </section>
      ))}
    </>
  );
}
