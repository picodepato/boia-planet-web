import { networkInterfaces } from 'node:os';
import path from 'node:path';
import type { NextConfig } from 'next';
import { ART_BASE_URL, ART_CACHE_CONTROL, LEGACY_ART_BASE_URL } from './lib/art-url';
import { RENAMED_ROUTES, securityHeaders } from './lib/security-headers';

/** IPs de la red local del Mac, para abrir el servidor de desarrollo desde el móvil. */
function lanHosts(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i!.address);
}

const config: NextConfig = {
  reactStrictMode: true,
  // `next dev` escribe en `.next-dev` y `next build` en `.next`: así una compilación
  // no pisa la caché del servidor de desarrollo (ni al revés).
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  transpilePackages: ['@boia/engine', '@boia/world', '@boia/store'],
  // Monorepo: la traza de las funciones parte de la raíz del repo.
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  // El móvil entra por la IP de la Wi-Fi; 127.0.0.1 para las pruebas locales (pnpm demo).
  allowedDevOrigins: ['127.0.0.1', ...lanHosts()],
  // ESLint corre una vez en la raíz (`pnpm lint`), no dentro de `next build`.
  eslint: { ignoreDuringBuilds: true },
  // CSP y demás cabeceras de seguridad en todas las rutas (REQ-ARQ-012).
  async headers() {
    const headers = securityHeaders({
      dev: process.env.NODE_ENV !== 'production',
      analyticsHost: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
    // El arte estático (`public/art/`, plan 027 T261): en desarrollo cambia al
    // re-renderizar; en producción la CDN lo guarda un día. En Cloudflare lo
    // sirve el `_headers` de scripts/cf-assets.mjs (T262).
    const art = process.env.NODE_ENV === 'production' ? ART_CACHE_CONTROL : 'no-store';
    return [
      { source: '/:path*', headers },
      { source: `${ART_BASE_URL}/:path*`, headers: [{ key: 'cache-control', value: art }] },
    ];
  },
  async redirects() {
    return RENAMED_ROUTES;
  },
  async rewrites() {
    // Las URL `/api/art/...` de antes del plan 027 (contenido guardado en el
    // navegador o en Supabase) siguen sirviendo el mismo arte estático. En
    // Cloudflare lo hace el `_redirects` de scripts/cf-assets.mjs (T262).
    return [{ source: `${LEGACY_ART_BASE_URL}/:path*`, destination: `${ART_BASE_URL}/:path*` }];
  },
};

export default config;
