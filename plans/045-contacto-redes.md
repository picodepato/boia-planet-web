# Plan 045 — Real contact email and Instagram; hide Spotify and TikTok

Status: active
Created: 2026-10-24
Base branch: main
Goal: Álvaro's real links (P15): contact email `hola@boiaplanet.net` in «Contacto» at the bottom; Instagram `@boia.planet` → `https://www.instagram.com/boia.planet/`; TikTok removed; the «escucha» Spotify entry at the very bottom (sample) hidden for now.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

## Tasks

## T325 — Contact email, Instagram, no TikTok, hidden Spotify
- Status: pending
- Depends on: none
- Goal: In `packages/store/src/sample/real-content.ts` set `links.email = 'hola@boiaplanet.net'` and `links.instagram = 'https://www.instagram.com/boia.planet/'` (shown as `@boia.planet` where the UI shows a handle). Remove TikTok from every place it is shown (footer, Contacto, `/mar` if any): not a sample placeholder, gone. Hide the footer «escucha» column / Spotify playlist entry (and any other place that shows the sample BOIA Spotify playlist link, e.g. «Escúchalo en Spotify» on artists if it points to the sample playlist) until a real playlist exists: when `spotifyPlaylist` is null, nothing is rendered (no «muestra» placeholder). Artist pages with a real per-artist Spotify keep it. Check whether these links can also be edited in Admin → «Enlaces» (`apps/web/lib/i18n/es-admin-enlaces.ts`, `apps/web/lib/admin/links.ts`) and stored (local store / Supabase): the code defaults must be right, and report under OUT OF SCOPE if a stored copy in production would override them (do not touch production). Update `docs/contenido-real.md` («Qué ha llegado ya») and tests (assert the real values and that TikTok/Spotify sample are not rendered; never loosen others).
- Context: `packages/store/src/sample/real-content.ts`, `apps/web/app/(landing)/components/real-content.test.ts`, `blocks.tsx`, `site-header.tsx`, the footer component, `apps/web/lib/i18n/es-web.ts` (footer.col.listen, artists.spotify), `apps/web/lib/admin/links.ts`, `apps/web/app/mar/engine/mar3d.ts` (WhatsApp/socials boias), landing budget (~0.1 kB margin: removing content only helps; do not add code).
- Scope: may touch real-content.ts, footer/contact/landing components that render these links, i18n keys, related tests, docs/contenido-real.md, admin links defaults / must not touch other real content, the shop products (T324 runs in parallel on products.json), SQL, production.
- Done when:
  - tests asserting email `hola@boiaplanet.net` in Contacto, Instagram `https://www.instagram.com/boia.planet/`, no TikTok, no Spotify playlist entry when null → pass
  - the project Test command → pass (landing budget OK)
- Outcome:

## Decisions
- 2026-10-24: Contact hola@, Instagram boia.planet, TikTok removed, Spotify «escucha» hidden for now (Álvaro)

## Proposals (new scope)

## Log
