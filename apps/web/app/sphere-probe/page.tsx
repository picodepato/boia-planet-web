import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SphereProbeClient } from './probe-client';

/**
 * PRUEBA DE TÉCNICA (T13): la esfera falsa de la intro «mini-mundo» (opción A).
 * Sólo en desarrollo, o en `next start` con BOIA_SPHERE_PROBE=1 (la medición:
 * `BOIA_SPHERE_PROBE=1 pnpm e2e sphere-probe.spec.ts --workers=1`).
 * En producción normal responde 404.
 */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'boia-planet · prueba de la esfera' };

export default function SphereProbePage() {
  if (process.env.NODE_ENV === 'production' && process.env.BOIA_SPHERE_PROBE !== '1') notFound();
  return <SphereProbeClient />;
}
