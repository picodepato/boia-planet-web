/**
 * Dónde se sirve el arte del pipeline de Blender (`art/`, D-16): archivos
 * estáticos en `public/art/`, copiados al construir por
 * `scripts/copy-art.mjs` (plan 027 T261). Antes los servía la función
 * `/api/art`, que leía el disco al atender cada petición; Cloudflare Workers no
 * tiene disco, así que ahora nada lo lee en tiempo de petición. Un rewrite en
 * `next.config.ts` mantiene las URL `/api/art/...` viejas (contenido guardado).
 *
 * Un archivo que falta responde 404 (un host estático no puede dar 204): quien
 * pide arte opcional trata el 404 como «no hay» y no escribe en la consola.
 */
export const ART_BASE_URL = '/art';

/** Prefijo de las URL antiguas, que un rewrite sigue sirviendo. */
export const LEGACY_ART_BASE_URL = '/api/art';

/**
 * Caché del arte en producción: una hora en el navegador, un día en la CDN.
 * La ponen `next.config.ts` (Vercel) y `scripts/cf-assets.mjs` (Cloudflare,
 * donde los archivos estáticos no pasan por las cabeceras de Next).
 */
export const ART_CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400';
