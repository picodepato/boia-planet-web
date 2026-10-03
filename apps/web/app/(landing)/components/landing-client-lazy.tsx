'use client';

import { useEffect, useState, type ComponentType } from 'react';

/**
 * `LandingClient` (the Tickets panel's behaviour and the funnel analytics)
 * out of the landing's critical path (plan 007 T80): it paints nothing, and
 * everything it adds also works, plainer, without JavaScript (the panel
 * opens on `:target`), so it comes in its own chunk, requested as soon as the
 * page's chunk runs (in parallel with hydration) and mounted once it lands.
 */
const loading: Promise<ComponentType | null> | null =
  typeof window === 'undefined'
    ? null
    : import('./landing-client').then(
        (m) => m.LandingClient,
        (err: unknown) => {
          console.warn('[boia] no cargó la mejora de la landing', err);
          return null;
        },
      );

export function LandingClientLazy() {
  const [Client, setClient] = useState<ComponentType | null>(null);
  useEffect(() => {
    let gone = false;
    void loading?.then((c) => {
      if (!gone && c) setClient(() => c);
    });
    return () => {
      gone = true;
    };
  }, []);
  return Client ? <Client /> : null;
}
