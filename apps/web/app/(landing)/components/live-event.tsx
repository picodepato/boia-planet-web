'use client';

import type { FunnelEventProps } from '@boia/contracts/analytics';
import { useEffect } from 'react';
import { track } from '../../../lib/analytics';
import { EVENTOS_COPY } from '../../../lib/landing/eventos-copy';
import type { EventPageView } from '../../../lib/landing/eventos';
import { useLiveRepo } from '../../../lib/landing/use-live-home';
import { EventPageBody } from './event-page';

type ExploreSource = FunnelEventProps['explore_start']['source'];

/**
 * La ficha como la deja el Admin de la demo: el servidor la pinta con la
 * muestra (y sin JavaScript se queda así) y el navegador, al montar, la
 * vuelve a sacar del repositorio (T26): estado, precio o isla cambiados en el
 * Admin, o un evento creado allí, que no tiene HTML propio (D-20).
 */
export function LiveEvent({ slug, initial }: { slug: string; initial: EventPageView | null }) {
  const { view, live } = useLiveRepo<EventPageView | null>(initial, async (repo, now) => {
    const [home, albums] = await Promise.all([repo.content.home(), repo.content.list('albums')]);
    const [{ eventPageView }, { withSiteMedia }] = await Promise.all([
      import('../../../lib/landing/eventos'),
      // Fotos compartidas y ajustes de la Galería del Admin (plan 048 T329).
      import('../../../lib/admin/shared-photos'),
    ]);
    return eventPageView(await withSiteMedia({ ...home, albums }), slug, now);
  });

  // Analítica del embudo (la de la landing la hace LandingClient).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-track]') : null;
      if (el?.dataset.track === 'ticket_click_out' && el.dataset.eventId) {
        track('ticket_click_out', { eventId: el.dataset.eventId, source: 'event_page' });
      } else if (el?.dataset.track === 'explore_start') {
        track('explore_start', {
          source: (el.dataset.source as ExploreSource | undefined) ?? 'event',
        });
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  if (view) return <EventPageBody view={view} />;
  return (
    <p className="event-page__missing" data-testid="evento-no-encontrado" role="status">
      {live ? EVENTOS_COPY.notFound : EVENTOS_COPY.loading}
    </p>
  );
}
