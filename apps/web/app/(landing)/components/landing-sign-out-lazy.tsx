'use client';

import { useEffect, useState, type ComponentType } from 'react';

/**
 * «Cerrar sesión» (`LandingSignOut`) out of the landing's critical path (plan
 * 022 T238): it paints nothing on the server nor without a session, and it
 * brings the account's session code with it, so it comes in its own chunk,
 * requested as soon as the page's chunk runs and mounted once it lands (as
 * `LandingClientLazy`).
 */
const loading: Promise<ComponentType | null> | null =
  typeof window === 'undefined'
    ? null
    : import('./landing-sign-out').then(
        (m) => m.LandingSignOut,
        (err: unknown) => {
          console.warn('[boia] no cargó «Cerrar sesión» de la landing', err);
          return null;
        },
      );

export function LandingSignOutLazy() {
  const [SignOut, setSignOut] = useState<ComponentType | null>(null);
  useEffect(() => {
    let gone = false;
    void loading?.then((c) => {
      if (!gone && c) setSignOut(() => c);
    });
    return () => {
      gone = true;
    };
  }, []);
  return SignOut ? <SignOut /> : null;
}
