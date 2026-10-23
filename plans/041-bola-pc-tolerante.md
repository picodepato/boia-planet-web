# Plan 041 — Landing globe on weaker PCs

Status: done
Created: 2026-10-23
Base branch: main
Goal: On Álvaro's PC (desktop size) the landing hero gives up the 3D globe and shows the still harbour photo, with the console warning «la escena del hero no arrancó; se queda la versión estática LowPowerError: la GPU no llega a 30 fps» (reproduced in a 1440×900 window; a small window renders the globe). Make the 3D globe show on weaker PCs too: before falling back, render at a lower resolution on big screens and accept a lower frame rate (~20 fps); keep the still photo only for machines that cannot even manage that.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

## Tasks

## T321 — More tolerant GPU probe for the hero globe
- Status: done
- Depends on: none
- Goal: The first-frames probe in `apps/web/lib/intro/run.ts` (~line 326) and `apps/web/lib/planeta/intro-scene.ts` (`LowPowerError`, ~line 87) rejects the scene when it cannot hold 30 fps «even at the lowest quality». On big desktop viewports the cost per frame grows with the canvas size. Change it so that: (1) the lowest quality level caps the canvas resolution (device-pixel-ratio and/or a maximum rendered width/height such as ~1280 px on the long side, upscaled by CSS) so a big screen costs like a smaller one; (2) the probe accepts the scene at about 20 fps (frame cost ≲ 50 ms) instead of 30; (3) the steady-state cap «at most 30 fps» for motion stays; (4) the still photo remains the fallback below that, and for `prefers-reduced-motion` and lost WebGL exactly as today. Put thresholds in named constants. Read how the quality levels and the probe work first (there may be several levels already: add a lower one only if needed). Do not change the intro choreography, the landing layout, or anything visible other than the globe rendering at a lower resolution when needed.
- Context: `apps/web/lib/intro/run.ts`, `apps/web/lib/planeta/intro-scene.ts`, their tests, T289 (commit 5001cb3, «The landing planet survives losing its 3D»), the landing budget (`pnpm build`: ~271 B margin; this code is in lazy chunks, keep it there — nothing new on the landing critical path), e2e specs touching the hero (`grep -rln "hero" apps/web/e2e`).
- Scope: may touch the intro/planet scene code and its tests / must not touch landing markup or CSS, the still images, other pages, SQL, production.
- Done when:
  - unit tests for the probe decision (20 fps accepted, slower rejected, resolution cap applied at the lowest level on a 1920×1080 and a 2560×1440 viewport) → pass
  - one hero e2e spec run alone with `E2E_PORT=<free> pnpm e2e <spec>` → pass
  - the project Test command → pass (landing budget OK)
- Outcome: PROBE_MIN_FPS 20 (50 ms) checked on the cheapest measured level; LOW_POWER_MAX_SIDE 1280 canvas cap when ending on level 3, re-timed at capped size; quality.test.ts — d859cd4

## Decisions
- 2026-10-23: Globe should show on weaker PCs: lower resolution on big screens and ~20 fps before falling back to the still photo (Álvaro)
- 2026-10-23 T321: quality levels unchanged (0 MSAA full, 1 full, 2 ×0.75, 3 ×0.5); floor against cheapest measured level (noisy timings); null never counted as failure; cap kept on resize and at rest (agent)

## Proposals (new scope)
- 2026-10-23 T321: landing-gl-context.spec.ts desktop tests fail with 4 parallel workers (software GPUs under 20 fps → still); passes with --workers=1. Not compared on main; may affect Álvaro's full e2e run
- 2026-10-23 T321: confirm on Álvaro's PC; if still the photo, `__boiaIntro.quality.probeMs` in the console shows the timings

## Log
- 2026-10-23 T321 launched · attempt 1 · agent ad56f565a9c4c9fe4
- 2026-10-23 T321 done · branch worktree-agent-ad56f565a9c4c9fe4 → d859cd4; plan done
