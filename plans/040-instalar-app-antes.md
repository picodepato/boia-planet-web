# Plan 040 — Offer «Instalar app» sooner

Status: active
Created: 2026-10-22
Base branch: main
Goal: The «Instalar app» prompt on phones appears too late (Álvaro measures ~40 s on the page). Make it appear much sooner.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

## Tasks

## T320 — Show the install prompt after ~5 s
- Status: pending
- Depends on: none
- Goal: `PROMPT_DELAY_MS` in `apps/web/lib/pwa/install.ts` is 15 000 ms and `AFTER_LOAD_MS` in `apps/web/app/(landing)/components/pwa-lazy.tsx` is 2 000 ms, yet Álvaro sees the prompt after ~40 s. Find out why (the PWA code is lazy-loaded after load, the Android `beforeinstallprompt` event may arrive late, the timer may only start after the lazy chunk, the delay may be reset by route changes, or other conditions in `promptKind` may hold it back) and make the prompt appear about 5 s after the page is usable, on Android Chrome (when the browser event is available) and on iPhone Safari (the manual hint), without making it appear on top of the first screen so abruptly that it hides the hero: keep the existing dismiss memory (once dismissed it stays dismissed) and the standalone / webdriver exclusions. Put the delay in one named constant. If the real cause is that the browser fires `beforeinstallprompt` late, say so in DECISIONS and show the prompt as soon as the event arrives after the delay; do not fake it.
- Context: `apps/web/lib/pwa/install.ts` (+ its tests), `apps/web/app/(landing)/components/pwa-prompt.tsx`, `pwa-lazy.tsx`, `apps/web/app/(landing)/layout.tsx`, `apps/web/lib/i18n/es-pwa.ts`, e2e specs that cover the prompt (`grep -rn -i pwa apps/web/e2e`), the landing budget (`pnpm build`: ~0.1 kB under 200 kB; do not add JS to the landing critical path).
- Scope: may touch the PWA install code, its tests and e2e specs about it / must not touch the landing structure, other prompts, SQL, production.
- Done when:
  - unit tests of `promptKind`/delay logic → pass (adjusted to the new delay, never loosened)
  - any e2e spec about the prompt, run alone with `E2E_PORT=<free> pnpm e2e <spec>` → pass
  - the project Test command → pass (landing budget still OK)
- Outcome:

## Decisions
- 2026-10-22: Offer the install about 5 s after the page is usable (Álvaro: «antes», currently ~40 s) (orchestrator, value to adjust with Álvaro)

## Proposals (new scope)

## Log
