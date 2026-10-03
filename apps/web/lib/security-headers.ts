/**
 * Cabeceras de seguridad de toda la web (REQ-ARQ-012, T49), que pone
 * next.config.ts en cada respuesta.
 *
 * La CSP es la que aguanta la versión de prueba sin servidor propio (D-20):
 * - `script-src 'unsafe-inline'`: Next mete scripts en línea (el payload de
 *   React Server Components) y no hay middleware que ponga nonces.
 * - `script-src 'unsafe-eval'`: sólo en desarrollo, para el refresco en
 *   caliente; three.js no lo necesita en producción.
 * - `img-src https:`: el Admin deja poner fotos por URL (sin almacenamiento
 *   hasta Supabase); `data:`/`blob:` para el Carnet y las texturas de los GLB.
 * - `media-src data: blob:`: la música que sube el Admin vive en el navegador.
 * - `connect-src`: el propio sitio y PostHog (apagado si no hay clave); con
 *   cuentas (plan 008), también la API de Supabase (https y wss, la sesión
 *   y las RPC). Sin Supabase no se añade nada.
 * - `frame-ancestors 'self'`: sólo el Admin enmarca la web (vista previa).
 */
export function securityHeaders({
  dev,
  analyticsHost,
  supabaseUrl,
}: {
  dev: boolean;
  analyticsHost: string;
  /** `NEXT_PUBLIC_SUPABASE_URL`; vacío o ausente en modo local. */
  supabaseUrl?: string | null | undefined;
}): { key: string; value: string }[] {
  const supabase = supabaseOrigins(supabaseUrl);
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' data: blob: ${analyticsHost}${supabase}${dev ? ' ws: wss:' : ''}`,
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
  return [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      // La cámara, sólo para la propia web: «Escanear sello» del Carnet (plan 008, T91).
      value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  ];
}

/** « https://x.supabase.co wss://x.supabase.co» o '' si no hay Supabase. */
function supabaseOrigins(url: string | null | undefined): string {
  if (!url?.trim()) return '';
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    const ws = `${u.protocol === 'https:' ? 'wss' : 'ws'}://${u.host}`;
    return ` ${u.origin} ${ws}`;
  } catch {
    return '';
  }
}

/** Rutas que cambiaron de nombre: la vieja lleva a la nueva. */
export const RENAMED_ROUTES = [
  // «Condiciones» pasó a ser el aviso legal (D-23, O14; textos-zonas.md zona 32).
  { source: '/legal/condiciones', destination: '/legal/aviso-legal', permanent: true },
  // El mundo 2D se fue (D-25, T62): /juego lleva al planeta 3D. Next pasa la
  // consulta tal cual, así `?ir=`, `?evento=`, `?menu=` (y `?cerca=`) siguen
  // abriendo el mar en su sitio. Temporal (307): el navegador no la guarda.
  { source: '/juego', destination: '/mar', permanent: false },
  { source: '/juego/:path*', destination: '/mar', permanent: false },
];
