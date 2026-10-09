# Plan 024 — The radio starts off on every visit

Status: active
Created: 2026-10-09
Base branch: main
Goal: Bug reported by Hernán (2026-10-09): after playing the radio, leaving and coming back, the radio is silent but the UI looks as if something is playing (hero label «Sonando», song title and elapsed time in the window, a «Sonando: …» toast), and pressing play resumes that song at the saved second. Expected: on every new page load the radio is fully off (idle, no song, no toast), and play starts the first song. Only the settings (volume, shuffle, repeat, genre) are remembered. In-site client navigation that keeps the player mounted keeps the music playing as today.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task: same machine notes as plan 022 (`plans/022-pulido-deuda-spec.md`, "Notes for every task"): Windows 10 + Git Bash, `packages/db` excluded, `PYTHONUTF8=1`, run the checks one by one if a guard blocks the chain, never commit `apps/web/public/atlas/`, `.claude/launch.json`, `.claude/*.out`, `e*.log`, `reunion/`, `output/`, `.github/workflows/supabase-keepalive.yml` or `.env*` (except `.env.example`), never push or deploy, never edit `docs/DECISIONES.md`, local mode (D-20) keeps working, UI strings by key in `apps/web/lib/i18n/`. **E2E policy (Hernán): Hernán runs the e2e himself.** Never run the full suite; run one spec only when strictly necessary; update the specs your change obviously breaks and list in your ESTADO section which ones Hernán should run. Model: each task's `Model:` line. Skills: only those named in the task.

## Tasks

## T258 — Radio: no song restored on page load; play starts the first song
- Status: pending
- Depends on: none
- Model: haiku
- Skills: none
- Goal: Stop restoring the current song, its position and the playing flag from `sessionStorage['boia.radio']` on page load. Keep remembering only volume, shuffle, repeat and genre. On load the player state is idle with `song: null`: no «Sonando» label on the hero button, no song/time in the window, no toast, no waves animation. Pressing play (button, window or `start()`) plays `firstSong(...)` of the catalog (respecting the remembered genre if that is how `firstSong` already works). Old saved data that still holds `songId`/`elapsed`/`playing` is ignored, not an error. Client-side navigation within the site with the player mounted must keep playing (the singleton is untouched for that).
- Context: `apps/web/lib/radio/player.ts` (`RADIO_SESSION_KEY` ~80, `save()` ~524, `restore()` ~549-580, `start()`/`firstSong`, `shouldToast`), `apps/web/lib/radio/ui/radio-mount.tsx` (`pagehide` → `saveNow()` ~65), `ui/radio-button.tsx` (~49-54, `started = state.song !== null`), `ui/radio-window.tsx`, `ui/radio-toast.tsx`, `apps/web/lib/radio/player.test.ts` (~289, tests of the saved data). Check radio-related e2e specs that may assert the cross-reload restore.
- Scope: may touch `apps/web/lib/radio/**` and its tests, radio e2e specs that assert the old restore / must not touch the radio admin, the catalog data, `/mar`, the landing outside the radio.
- Done when:
  - unit test: with saved data `{songId, elapsed, playing:true, volume, shuffle, repeat, genreId}` in sessionStorage, a new player ends idle with `song === null`, no toast, and volume/shuffle/repeat/genre restored → pass
  - unit test: after that restore, `start()`/play loads the first song at elapsed 0 → pass
  - unit test: `save()` no longer writes `songId`/`elapsed`/`playing` → pass
  - Test command → exit 0
- Outcome:

## Decisions
- 2026-10-09 plan: remember only settings (volume, shuffle, repeat, genre); song and position are never restored; music keeps playing across client navigation (Hernán)

## Proposals (new scope)

## Log
