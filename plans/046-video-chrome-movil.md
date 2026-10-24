# Plan 046 — Presentation video not loading in Chrome on phones

Status: active
Created: 2026-10-24
Base branch: main
Goal: Álvaro: the landing presentation video does not load in Chrome on his phone; it does in Safari and Brave. Live is ad5c040 (plans 042 + 043: 720p/1080p choice). Fix it so it plays in Chrome mobile, Chrome desktop, Safari and Brave/Firefox.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

## Tasks

## T326 — Presentation video plays in Chrome mobile
- Status: pending
- Depends on: none
- Goal: Reproduced by the orchestrator on https://boiaplanet.net in Chromium with mobile emulation (375×812, Android Pixel 8 UA, `navigator.connection` = {effectiveType '4g', downlink 10, saveData false}): after scrolling through the whole `.reel`, `.reel__video` still has `currentSrc` "", readyState 0, networkState 0, no error, no console error — the source is never set. Safari and Brave (which hide or lack `navigator.connection`) play it. Suspects: the `presentationVideoSrc` choice from T323 (commit 8eac24d) and how `presentation-motion.tsx` sets the source / calls play (e.g. a code path that returns early or throws silently when `navigator.connection` exists, an event listener on `connection.change`, or the src only being set inside a branch that mobile Chrome never reaches). Also verified: Cloudflare (boiaplanet.net) answers `Range: bytes=0-99` on `/contenido/portada/presentacion.mp4` with `200 OK` and the full body, no `Accept-Ranges`; Vercel answers `206` with `Content-Range`. Media playback (Safari especially, and seeking/looping in Chrome) relies on range requests: make Cloudflare serve range requests for `/contenido/**` and `/art/**` static media (check how OpenNext/Workers serves `public/` — assets binding vs. the worker, `run_worker_first`, `_headers`, `apps/web/scripts/cf-assets.mjs`, `wrangler` config) so it answers 206 like Vercel; if that cannot be fixed from the repo, report exactly why. Find the real cause of the Chrome-mobile bug, fix it, and add a unit test that reproduces it (the choice + source-setting path with a `navigator.connection` object present, on a phone-sized viewport and on a desktop one). Run the reel e2e spec(s) alone in Chromium with a mobile project if one exists.
- Context: `apps/web/lib/landing/hero-media.ts` (+ test), `apps/web/app/(landing)/components/presentation.tsx`, `presentation-motion.tsx`, `apps/web/lib/landing/presentation.ts`, plans 042/043, `apps/web/scripts/cf-assets.mjs`, `apps/web/wrangler.*`, `apps/web/open-next.config.*`, `docs/DESPLIEGUE.md` (Cloudflare section), `pnpm cf:measure` (builds the worker in a hoisted copy on Windows).
- Scope: may touch the reel motion component, hero-media.ts, Cloudflare asset/worker config for static files, tests, docs/DESPLIEGUE.md / must not touch the video files, other landing parts, SQL, production. Landing budget ~0.2 kB margin: no new code on the critical path.
- Done when:
  - unit test reproducing the missing source with `navigator.connection` present → fails before the fix, passes after
  - the reel e2e spec (mobile Chromium project if available) → pass
  - `pnpm cf:measure` → pass, and a short note of how Range is now handled on Cloudflare (or why it cannot be)
  - the project Test command → pass
- Outcome:

## Decisions

## Proposals (new scope)

## Log
