'use client';

import type { HomeContent } from '@boia/contracts';
import type { ReactNode } from 'react';
import type { HomeView } from '../../../lib/landing/resolve';
import { useLiveHome } from '../../../lib/landing/use-live-home';
import { HomeBlocks } from './blocks';
import { SiteHeader } from './site-header';
import { TicketsPanel } from './tickets-panel';

/**
 * La resolución de la home (programación, evento prioritario, próximos,
 * Tickets) vive en `resolve.ts`, que arrastra los esquemas de
 * `@boia/contracts` y zod: el navegador sólo la carga cuando llega el
 * contenido del repositorio (T29, presupuesto de la landing).
 */
const deriveView = async (content: HomeContent, now: Date): Promise<HomeView> =>
  (await import('../../../lib/landing/resolve')).resolveHome(content, now);

/**
 * Cabecera, bloques, pie y panel de Tickets de la home. El servidor los pinta
 * con la muestra ya resuelta; en el navegador pasan a leer el repositorio
 * (T26), así los cambios del Admin de la demo (eventos, orden y programación
 * de bloques, artistas, fotos y textos) se ven aquí. `data-contenido` dice de
 * dónde sale lo pintado (`muestra` o `repositorio`).
 */
export function LiveLanding({ initial, heroScene }: { initial: HomeView; heroScene: ReactNode }) {
  const { view, live } = useLiveHome(initial, deriveView);
  const buyable = new Set(view.buyable);

  return (
    <>
      <SiteHeader sections={new Set(view.sections)} instagram={view.social.instagram} />
      <main id="contenido" tabIndex={-1} data-contenido={live ? 'repositorio' : 'muestra'}>
        <HomeBlocks
          blocks={view.main}
          artists={view.artists}
          buyable={buyable}
          heroScene={heroScene}
          social={view.social}
        />
      </main>
      <HomeBlocks
        blocks={view.footer}
        artists={view.artists}
        buyable={buyable}
        social={view.social}
      />
      <TicketsPanel
        featured={view.tickets.featured}
        others={view.tickets.others}
        onSale={view.tickets.onSale}
        nextAllDay={view.tickets.nextAllDay}
        island={view.ticketsIsland}
        artists={view.artists}
        buyable={buyable}
      />
    </>
  );
}
