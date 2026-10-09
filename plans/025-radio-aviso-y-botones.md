# Plan 025 — Radio: clickable now-playing toast, plain song name, clearer repeat/shuffle

Status: active
Created: 2026-10-09
Base branch: main
Goal: Hernán's radio polish of 2026-10-09, right after plan 024. (1) The now-playing toast that appears at the bottom opens the radio window when clicked/tapped. (2) The toast shows the song directly («Title — Artist») instead of «Sonando: …». (3) The player's repeat and shuffle buttons look too small and it is not clear which is which: bigger icons inside the buttons, recognisable glyphs, and a clear name and on/off state.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task: same machine notes as plan 022 (`plans/022-pulido-deuda-spec.md`, "Notes for every task"): Windows 10 + Git Bash, `packages/db` excluded, `PYTHONUTF8=1`, run the checks one by one if a guard blocks the chain, never commit `apps/web/public/atlas/`, `.claude/launch.json`, `.claude/*.out`, `e*.log`, `reunion/`, `output/`, `.github/workflows/supabase-keepalive.yml` or `.env*` (except `.env.example`), never push or deploy, never edit `docs/DECISIONES.md`, local mode (D-20) keeps working, UI strings by key in `apps/web/lib/i18n/`. **E2E policy (Hernán): Hernán runs the e2e himself.** Never run the full suite; run one spec only when strictly necessary; update the specs your change obviously breaks and list in your ESTADO section which ones Hernán should run. Screenshots under `/tmp/orchestrator-attach/boia-planet-hernan-<task id>/` (mobile 390×844 first, then desktop). Model: each task's `Model:` line. Skills: only those named in the task.

## Tasks

## T259 — Radio toast opens the radio, shows just the song; bigger, clearer repeat/shuffle buttons
- Status: pending
- Depends on: none
- Model: haiku
- Skills: frontend-design
- Goal: (a) Clicking or tapping the now-playing toast opens the radio window (same action as the radio button) and dismisses the toast; it is a real button (keyboard focusable, Enter/Space, accessible name from i18n such as «Abrir la radio: Title — Artist»). Any existing close control on the toast keeps closing without opening. (b) The toast text is the song itself, «Title — Artist» (artist omitted if empty), with no «Sonando:» prefix; remove or repurpose the i18n key accordingly. (c) In the radio window, the repeat and shuffle buttons: icon clearly larger inside the button (fill most of the button, at least ~22 px on mobile, touch target ≥ 40×40), standard recognisable glyphs (shuffle = crossed arrows, repeat = loop arrows, repeat-one with a «1» if the player has that mode), a visible on/off state (accent colour and/or dot when active), `aria-pressed`, and `title` + `aria-label` from i18n naming each one («Aleatorio», «Repetir»). Keep the window layout balanced with the other transport buttons; desktop and mobile.
- Context: `apps/web/lib/radio/ui/radio-toast.tsx` (~39, the «Sonando: {title} - {artist}» text), `ui/radio-mount.tsx` (where toast and window are mounted, how the window opens), `ui/radio-window.tsx` and `radio-window.css` (transport controls, repeat/shuffle), `ui/use-radio.ts`, `apps/web/lib/radio/player.ts` (open/toast state, repeat modes), `apps/web/lib/i18n/` radio keys, radio unit tests and e2e specs that assert the toast text.
- Scope: may touch `apps/web/lib/radio/**`, its CSS and tests, radio i18n keys, radio e2e specs that assert the old toast text / must not touch the player's restore/save behaviour from plan 024, the radio admin, the catalog data, `/mar`, the landing outside the radio.
- Done when:
  - unit test: toast text for a song is «Title — Artist» with no «Sonando» prefix (and title alone when there is no artist) → pass
  - unit/component test: activating the toast opens the radio window → pass
  - screenshots: mobile toast; mobile and desktop radio window with repeat and shuffle off and on → attach folder
  - Test command → exit 0
- Outcome:

## Decisions
- 2026-10-09 plan: toast keeps the artist after the title («Title — Artist»); Hernán only asked to drop «Sonando» (orchestrator)

## Proposals (new scope)

## Log
