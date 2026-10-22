# Plan 040 — Offer «Instalar app» sooner

Status: done
Created: 2026-10-22
Base branch: main
Goal: The «Instalar app» prompt on phones appears too late (Álvaro measures ~40 s on the page). Make it appear much sooner.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

## Tasks

## T320 — Show the install prompt after ~5 s
- Status: done
- Depends on: none
- Goal: `PROMPT_DELAY_MS` in `apps/web/lib/pwa/install.ts` is 15 000 ms and `AFTER_LOAD_MS` in `apps/web/app/(landing)/components/pwa-lazy.tsx` is 2 000 ms, yet Álvaro sees the prompt after ~40 s. Find out why (the PWA code is lazy-loaded after load, the Android `beforeinstallprompt` event may arrive late, the timer may only start after the lazy chunk, the delay may be reset by route changes, or other conditions in `promptKind` may hold it back) and make the prompt appear about 5 s after the page is usable, on Android Chrome (when the browser event is available) and on iPhone Safari (the manual hint), without making it appear on top of the first screen so abruptly that it hides the hero: keep the existing dismiss memory (once dismissed it stays dismissed) and the standalone / webdriver exclusions. Put the delay in one named constant. If the real cause is that the browser fires `beforeinstallprompt` late, say so in DECISIONS and show the prompt as soon as the event arrives after the delay; do not fake it.
- Context: `apps/web/lib/pwa/install.ts` (+ its tests), `apps/web/app/(landing)/components/pwa-prompt.tsx`, `pwa-lazy.tsx`, `apps/web/app/(landing)/layout.tsx`, `apps/web/lib/i18n/es-pwa.ts`, e2e specs that cover the prompt (`grep -rn -i pwa apps/web/e2e`), the landing budget (`pnpm build`: ~0.1 kB under 200 kB; do not add JS to the landing critical path).
- Scope: may touch the PWA install code, its tests and e2e specs about it / must not touch the landing structure, other prompts, SQL, production.
- Done when:
  - unit tests of `promptKind`/delay logic → pass (adjusted to the new delay, never loosened)
  - any e2e spec about the prompt, run alone with `E2E_PORT=<free> pnpm e2e <spec>` → pass
  - the project Test command → pass (landing budget still OK)
- Outcome: install prompt 30 s on first visit, 2 min on later visits (time on a visible tab from load), never when installed (standalone/appinstalled/getInstalledRelatedApps marks boia.pwa.instalada); landing trimmed to 271 B margin — b3f8240

## Decisions
- 2026-10-22: First visit: install prompt 30 s after the page is usable; later visits (after a dismissal): again 2 min after entering, every visit; never when installed (Álvaro)
- 2026-10-22 T320: cause of ~40 s: the timer started on pwa-prompt mount (load event + 2 s + chunk) and `load` is slow on phones; beforeinstallprompt captured from the start by capture.ts; first integration reverted (landing 200.0 kB, EXCEDIDO after T319), agent trimmed boot script (entry.ts), planet CSS (load.ts), dead CSS (.button--secondary, .link-list--inline, .merchandise-notice), JSX comment markers; margin 271 B (agent)

## Proposals (new scope)
- 2026-10-22 T320: landing budget has ~271 B margin: plan to slim the landing or decide to raise the budget
- 2026-10-22 T320: manifest has no related_applications, so getInstalledRelatedApps() likely returns nothing
- 2026-10-22 T320: 15 apparently unused i18n keys could free ~30 B (content change, Álvaro's call)

## Log
- 2026-10-22 T320 launched · attempt 1 · agent a78dd5085fa3c9809
- 2026-10-22 T320 first integration tests_failed (landing budget) → reverted 5e43189/004ffd6; agent resumed
- 2026-10-22 T320 done · branch worktree-agent-a78dd5085fa3c9809 → b3f8240; plan done
