import type { ReactNode } from 'react';
import './landing.css';

/**
 * Las tipografías (títulos e Inter) las pone el layout raíz desde
 * lib/fonts.ts (plan 006 T74); aquí sólo va la hoja de la landing.
 */
export default function LandingLayout({ children }: { children: ReactNode }) {
  // `display: contents`: la envoltura no cuenta en el diseño.
  return <div className="landing-root">{children}</div>;
}
