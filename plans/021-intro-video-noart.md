# Plan 021 — Landing: pinned black intro with BOIA and an expanding video (No Art style)

Status: done
Created: 2026-10-08
Base branch: main
Goal: Replace what comes after the landing hero (today the boat over the sea and the white sheet rising) with a scroll-driven, pinned presentation after https://www.noartmusic.com/: fade to black, BOIA logo beats, a small central video window that expands to full screen, then «Próximo evento» and the rest of the page. A sample 8 s video first, so Hernán can judge the transition.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task: same machine notes as plan 020 (`plans/020-revision-hernan.md`, "Notes for every task"): Windows 10 + Git Bash, `packages/db` excluded, `PYTHONUTF8=1`, run the checks one by one if a guard blocks the chain, never commit `apps/web/public/atlas/`, `.claude/launch.json`, `.claude/*.out`, `e*.log`, `reunion/`, `.github/workflows/supabase-keepalive.yml` or `.env*` (except `.env.example`), never push or deploy, never edit `docs/DECISIONES.md`, local mode (D-20) keeps working, UI strings by key in `apps/web/lib/i18n/`, content stays `muestra`. **E2E policy (Hernán): Hernán runs the e2e himself.** Never run the full suite; run one spec only when strictly necessary; update the specs your change obviously breaks and list in your ESTADO section which ones Hernán should run. The landing keeps its 200 kB gzip critical-path cap (D-26): it is at 199.0 kB, so the new presentation's JS must load outside the critical path (lazy/idle) and the video is never part of it. Screenshots under `/tmp/orchestrator-attach/boia-planet-hernan-<task id>/` (mobile 390×844 first, then desktop). Model: each task's `Model:` line. Skills: only those named in the task.

Hernán's spec (2026-10-08), the sequence the visitor sees, top to bottom:
1. **Entry keeps today's hero.** Sea landscape, BOIA and «Zarpar» (with «Consigue descuentos» and «Desliza», intro order from T227). From there the visitor scrolls down to discover the site.
2. **The first scroll gives a quick transition to black.** While scrolling, the landscape and the hero elements fade out smoothly until the screen is fully black: the first «zoom» that focuses all attention on the centre.
3. **The screen pins and BOIA appears.** The «stop»: the visitor keeps scrolling but the events do not come up yet; the scroll advances the presentation inside the same pinned screen. On the black, the BOIA logo appears with two or three short visual beats — appearance, small scale change, settling — giving a pum, pum, pum rhythm.
4. **The video shows inside a small central window.** The video starts playing in a small box surrounded by black, with BOIA over it: a first glimpse of the atmosphere (people, music, encounters, event moments).
5. **Scrolling further, the window opens until it fills the screen.** The key move of the No Art reference: the video's area grows in width and height until every black margin is gone. Continuous expansion, decisive start, soft arrival at full screen. The logo stays centred while the video opens behind it.
6. **The full-screen video ends the presentation.** A short stretch to enjoy the image full screen. Then, scrolling on, the section unpins, the video moves up and «Próximo evento» appears; from there the existing path continues: events, gallery, artists, store, contact.
The «stop» is a pause in the page's progress while the animation keeps answering the gesture (scroll-driven, reversible when scrolling back up). The video is prepared from the hero (preload/poster) so the black has visual intent and the opening starts with no perceptible loading wait.

## Tasks

## T235 — Pinned black intro with BOIA beats and the expanding video window
- Status: done
- Depends on: none
- Model: opus
- Skills: frontend-design
- Goal: Build the sequence of Hernán's spec (steps 2–6) between the hero and «Próximo evento», replacing the boat over the sea / white-sheet transition, with a sample 8 s video so Hernán can judge the transition.
- Context: study https://www.noartmusic.com/ (WebFetch or the browser pane) for the pinned expanding video; `apps/web/app/(landing)/components/blocks.tsx` (hero, priority_event / «Próximo evento», the sheet), `app/(landing)/landing.css`, `components/hero-stills.tsx`, the intro stages from T227 (`lib/intro/stages*`), `lib/landing/hero-media.ts` (`HERO_MEDIA_SRC`, Roke's slot), `lib/lazy-video.tsx`, `/api/art` (serves mp4 with Range, plan 019 T216), sample clips from T216 under `art/`, brand logo in `art/marca/`; D-26 size check.
- Scope: may touch the landing hero-to-events transition, its components/CSS/i18n, a new lazy-loaded presentation module, a sample video under `art/` (8 s, muted, H.264 mp4, small: ≤ ~2 MB, 720p is enough, plus a poster frame) built locally from existing project art/clips (ffmpeg if available, else a script) — no downloads from the internet; a single source constant so Hernán can swap the video later / must not touch the hero's own intro order (T227), the sections after «Próximo evento», the world.
- Behaviour details: scroll-driven and reversible (scrolling up rewinds); pinned with `position: sticky` (or equivalent) so the page does not advance during steps 3–5; works with touch scroll on mobile and wheel/trackpad/keys on desktop; video muted, `playsinline`, loops, plays only while visible; the logo stays centred over the video; `prefers-reduced-motion`: no pin or animation, a simple static block with the poster/video and the logo; no layout jumps; the hero fade to black starts on the first scroll; video preloaded from the hero (poster + `preload` after the hero is idle) without entering the critical path.
- Done when:
  - screenshot sequence mobile 390×844 and desktop for steps 1→6 (hero, black, BOIA beats, small window, half open, full screen, «Próximo evento» rising) under the attach folder, plus a short screen recording or frame strip if feasible
  - unit tests for the scroll-progress → stage/scale mapping (pure function) → pass
  - landing critical path ≤ 200 kB gzip → pass
  - ESTADO section says how to swap the video and which e2e specs Hernán should run
  - Test command → exit 0
- Outcome: hero → black → BOIA beats → small video window → full screen → «Próximo evento», pinned 3.1 screens, lazy motion code, sample 8 s video `art/landing/presentacion-muestra.mp4` (swap via `PRESENTATION_VIDEO`); landing 199.5 kB · 9544a34

## Decisions
- 2026-10-08: plan of one task from Hernán's spec in the session; he asked to start right away (orchestrator)
- 2026-10-08 T235: hero now 1 screen (was 200svh), presentation overlaps it, sticky stage pinned 3.1 screens; pin set by CSS before first paint; logo orange on black → white as the video opens; video scales 0.6→1 while opening; 3D scene stops painting under the black; white sheet + pixel wave removed (agent)

## Proposals (new scope)
- 2026-10-08 T235: the header slides in at 0.95 screens, during the logo beats: hide it while the presentation runs?
- 2026-10-08 T235: every page load logs a 400 from Supabase `carnets?is_artist=eq.true` (likely a pending dev migration)

## Log
- 2026-10-08 T235 launched · attempt 1 · agent a32855c291fdbfdf9
- 2026-10-08 T235 done · merged 9544a34
- 2026-10-08 plan 021 done
- 2026-10-08 pushed main f76c200 (Hernán in session)
