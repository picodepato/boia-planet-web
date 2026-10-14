import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NOINDEX } from '../../lib/seo';

export const metadata: Metadata = { robots: NOINDEX };

/** Nada del Admin se indexa nunca (plan 030 T285). */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
