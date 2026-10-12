import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

/**
 * Construcción para Cloudflare Workers (plan 027 T262): `@opennextjs/cloudflare`
 * toma la salida de `next build` (la misma que despliega Vercel) y la empaqueta
 * en un Worker (`.open-next/worker.js`) más los archivos estáticos
 * (`.open-next/assets`: `public/`, `/_next/static`). `pnpm cf:build` la corre;
 * `pnpm cf:measure` mide el tamaño del Worker contra el límite del plan
 * gratuito (3 MB comprimidos).
 *
 * Caché incremental de sólo lectura sobre los archivos estáticos: las páginas
 * prerrenderizadas (`/`, `/mar`, que leen `art/` al construir y no pueden
 * hacerlo en el Worker, sin disco) se sirven tal cual salieron de `next build`;
 * `opennextjs-cloudflare populateCache local` (en `cf:build`) las copia a
 * `.open-next/assets/cdn-cgi/_next_cache/`. Sin R2 ni KV: nada de pago,
 * ninguna cuenta que crear desde el repo. El coste: la única ruta con
 * `revalidate` (`/eventos/[slug]`, 300 s) no se regenera en Cloudflare hasta
 * el siguiente despliegue (en Vercel sigue con su ISR); su estado «hoy / en
 * curso» lo recalcula el cliente. Si hace falta ISR de verdad, se cambia por
 * R2 (gratis hasta 10 GB) y el `services` del `wrangler.jsonc`:
 * https://opennext.js.org/cloudflare/caching
 */
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
