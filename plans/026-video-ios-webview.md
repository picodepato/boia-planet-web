# Plan 026 — Stray video frame over the planet in iOS in-app browsers

Status: active
Created: 2026-10-09
Base branch: main
Goal: Bug reported by Hernán after the push of plans 024–025 (2026-10-09). On iPhone, opening the test site from the Claude app's in-app browser (an iOS WKWebView / SFSafariViewController-like in-app browser, not Safari), after opening the radio the intro video «loads and grows», and then a rectangle with a frame of a video (low-poly characters cheering at a bar/stage) stays visible over the planet, partly covering the «Zarpar» button. It does not happen in Brave. Screenshot: `C:/Users/alvar/AppData/Local/Temp/orchestrator-attach/boia-planet-hernan-T260/hernan-report.png`. Fix it so no video element ever shows outside its intended place/time in iOS in-app browsers, without changing behaviour in normal browsers.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task: same machine notes as plan 022 (`plans/022-pulido-deuda-spec.md`, "Notes for every task"): Windows 10 + Git Bash, `packages/db` excluded, `PYTHONUTF8=1`, run the checks one by one if a guard blocks the chain, never commit `apps/web/public/atlas/`, `.claude/launch.json`, `.claude/*.out`, `e*.log`, `reunion/`, `output/`, `.github/workflows/supabase-keepalive.yml` or `.env*` (except `.env.example`), never push or deploy, never edit `docs/DECISIONES.md`, local mode (D-20) keeps working, UI strings by key in `apps/web/lib/i18n/`. **E2E policy (Hernán): Hernán runs the e2e himself.** Never run the full suite; run one spec only when strictly necessary. The landing keeps its 200 kB gzip critical-path cap (D-26). Screenshots under `/tmp/orchestrator-attach/boia-planet-hernan-<task id>/`. Model: each task's `Model:` line. Skills: only those named in the task.

## Tasks

## T260 — No stray video frame over the planet in iOS in-app browsers
- Status: pending
- Depends on: none
- Model: opus
- Skills: none
- Goal: Find which `<video>` shows in the screenshot (search the landing and its lazy chunks for every `<video>`/`HTMLVideoElement`: the intro video of plan 021, the scroll-driven BOIA video, any island/event preview, the radio) and why it becomes visible in an iOS in-app WebView. Likely suspects: iOS in-app WebViews where inline playback or autoplay behave differently (missing `playsInline`/`webkit-playsinline`/`muted` set as attributes before `src`, `play()` rejected and the element left visible, poster/first frame painted while the element is meant hidden with opacity only, a `display` change racing the intro's end, a user gesture such as opening the radio unlocking media and making a paused video render or play). Check what plans 024–025 changed in `apps/web/lib/radio/**` (e.g. the radio's open/unlock code calling `play()` on media, or a gesture handler) in case the radio triggers it. Fix the root cause: hidden videos must be `display:none`/unmounted (not just transparent or zero-sized), videos are `muted` + `playsInline` attributes set before loading, a failed `play()` hides the element and falls back to the existing static path, and the intro video is removed/unmounted when it ends. Normal browsers (Chrome, Safari, Brave, desktop) must behave as today.
- Context: Hernán's screenshot above; `plans/021-intro-video-noart.md` (intro video), landing code under `apps/web/app/(landing)/`, `apps/web/lib/radio/ui/radio-mount.tsx`, `apps/web/lib/radio/player.ts`, git log of commits 7b3ec9c and e2e1438 (plans 024–025). Playwright WebKit (`pnpm --filter @boia/web exec playwright install webkit`) with an iPhone device profile is the closest local check; it is not an in-app WebView, so also reason from the code.
- Scope: may touch the landing's video components and their CSS, the radio UI if it is the trigger, their tests / must not touch `/mar` scenes, the radio's save/restore behaviour (plan 024), the toast/button behaviour (plan 025) beyond what the fix needs.
- Done when:
  - ESTADO section names the video element, the cause, and why only in-app browsers saw it
  - unit test(s) covering the fix (e.g. hidden state is display:none/unmounted; failed play() hides the video; required attributes present) → pass
  - screenshots: WebKit iPhone profile, landing after opening the radio and after the intro, no stray video → attach folder
  - Test command → exit 0
- Outcome:

## Decisions

## Proposals (new scope)

## Log
