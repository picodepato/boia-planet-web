/**
 * The Cloudflare Worker's entry (plan 046 T326; `main` in wrangler.jsonc).
 * OpenNext's Worker (`.open-next/worker.js`, written by `pnpm cf:build`)
 * serves the pages; before it, the media files that `assets.run_worker_first`
 * sends here are answered with range support (`scripts/cf-range.mjs`), which
 * Workers Static Assets does not give. Everything else is OpenNext's, as it
 * was.
 */
import handler from './.open-next/worker.js';
import { serveMedia } from './scripts/cf-range.mjs';

// Whatever else OpenNext's Worker exports (Durable Objects, if it ever has them).
export * from './.open-next/worker.js';

export default {
  async fetch(request, env, ctx) {
    return (await serveMedia(request, env.ASSETS)) ?? handler.fetch(request, env, ctx);
  },
};
