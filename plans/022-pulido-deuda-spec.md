# Plan 022 — Polish /mar and the landing, pay tech debt, close the spec backlog

Status: done
Created: 2026-10-09
Base branch: main
Goal: Four fronts chosen by Hernán (2026-10-09). (1) Polish `/mar` with what is left of his second review (`docs/propuestas/2026-10-08-revision-hernan-2.md`) and his answers to the plan 020 guide questions. (2) Follow up the landing's pinned intro (plan 021): hide the header while it runs and free critical-path kB. (3) Pay the tech debt and i18n gaps collected in plans 020–021. (4) Close or raise every spec REQ in `docs/spec/estado.md` that does not depend on Álvaro, then hand Hernán a test guide. (5) Add the site radio Hernán described (2026-10-09): a catalog of ~100 songs by genre managed from the admin, and a Winamp-style player reachable from the landing and `/mar`.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task: same machine notes as plan 020 (`plans/020-revision-hernan.md`, "Notes for every task"): Windows 10 + Git Bash, `packages/db` excluded, `PYTHONUTF8=1`, run the checks one by one if a guard blocks the chain, never commit `apps/web/public/atlas/`, `.claude/launch.json`, `.claude/*.out`, `e*.log`, `reunion/`, `.github/workflows/supabase-keepalive.yml` or `.env*` (except `.env.example`), never push or deploy, never apply Supabase migrations to any remote project, never edit `docs/DECISIONES.md`, local mode (D-20) keeps working, UI strings by key in `apps/web/lib/i18n/`, content stays `muestra`. **E2E policy (Hernán): Hernán runs the e2e himself.** Never run the full suite; run one spec only when strictly necessary; update the specs your change obviously breaks and list in your ESTADO section which ones Hernán should run. The landing keeps its 200 kB gzip critical-path cap (D-26); it is at 199.5 kB, so nothing new may enter the landing's critical path. Screenshots under `/tmp/orchestrator-attach/boia-planet-hernan-<task id>/` (mobile 390×844 first, then desktop). Model: each task's `Model:` line. Skills: only those named in the task.

Hernán's answers (2026-10-09) that bind every task: Las Calitas' sea label stays cream (orange = island with a party); entry timings stay as they are (1.2 s / 0.7 s / 0.6 s); the trash rules with accounts stay as they are (partner blocked 30 days then deleted; a party with purchases, stamps or points is only hidden).

## Tasks

## T236 — /mar overlays: boia text vs carnet prompt, trip destination, Ajustes toggles
- Status: done
- Depends on: none
- Model: opus
- Skills: frontend-design
- Goal: Three UI fixes inside `/mar`. (a) Review-2 point 1: the boia's text almost overlaps «Aún no tienes el carnet» and the «Hazte el tuyo» button; separate them so they never touch, on mobile and desktop. (b) Guide Q5: during a trip the small «Entradas» line («Rumbo a Ca…») is cut off by the fixed-height bottom bar; Hernán chose to show the destination elsewhere — a chip/notice just above the bottom bar — and keep the bar's height unchanged (the bar's «Entradas» item goes back to one line). (c) Guide Q4: music and effects in Ajustes become pill toggles like the site's other switches (decision 3), no more «Activada» checkboxes.
- Context: `docs/propuestas/2026-10-08-revision-hernan-2.md`, `docs/propuestas/2026-10-08-plan-020-guia-prueba.md` («Qué contestar» Q4–Q5), `apps/web/app/mar/mar-client.tsx` and the `/mar` HUD/bottom-bar/Ajustes components, existing toggle component(s) used elsewhere (search for the pill switch from decision 3), `apps/web/lib/i18n/`.
- Scope: may touch the `/mar` HUD, bottom bar, Ajustes panel, boia/carnet overlay components, their CSS and i18n keys, related unit tests and e2e specs / must not touch the 3D scene, world data (`mundos/`), the landing.
- Done when:
  - screenshots mobile 390×844 and desktop: boia text with the carnet prompt (no overlap, clear gap), a trip in progress showing the destination chip with the bar's «Entradas» on one line, Ajustes with the two toggles → saved in the attach folder
  - the toggles are keyboard-operable and keep `role="switch"`/`aria-checked` (or the existing component's equivalent) → checked by a unit test
  - Test command → exit 0
- Outcome: carnet prompt on its own line under the door-ticket message, destination chip above the bar, Ajustes pill switches · cf5068c

## T237 — Las Calitas behind the castaway, routes rerouted
- Status: done
- Depends on: none
- Model: opus
- Skills: none
- Goal: Review-2 point 2: move Las Calitas just behind the castaway (náufrago), easy to see, so it roughly reads as the place the castaway got lost from. The design routes `exploracion` and `d_solar` in `mundos/arcilla/mapa.json` already cross the island (plan 020 T232 proposal): reroute them so no route crosses any island after the move. While in that file, fix the stale «Isla del Cañón» wording (plan 020/021 proposals).
- Context: `docs/propuestas/2026-10-08-revision-hernan-2.md`, `mundos/arcilla/mapa.json` and whatever generates/validates it (`tools/`, `packages/world/src/worlds/arcilla/`), plan 020 T232 in `plans/020-revision-hernan.md` (Decisions/Proposals), the castaway's placement, collision/obstacle data, minimap/plano rendering; the spec REQs on the map (REQ-MUN-015..018) for route rules.
- Scope: may touch Arcilla world data and its generator/validators, island placement, route data, related tests and derived files (regenerate them with the project's tool, do not hand-edit generated output) / must not touch other worlds, the `/mar` HUD (T236), the landing.
- Done when:
  - a check (existing validator or a new unit test) proves no route segment crosses an island footprint and Las Calitas is within a short distance behind the castaway → pass
  - screenshots mobile and desktop of the sea from the castaway's area showing Las Calitas behind it, and of the plano/minimap with the rerouted routes → attach folder
  - `grep -rn "Isla del Cañón" mundos/ packages/world/` → no stale hits (or only intended ones, explained in ESTADO)
  - Test command → exit 0
- Outcome: Las Calitas at [-7.0, 18.6], ~290 u behind-left of the castaway off the Los Rápidos road; no route crosses land (tests); «Isla del Cañón» → «Puig Campana» · dc92a44

## T238 — Landing: header hidden during the intro, critical-path kB freed
- Status: done
- Depends on: none
- Model: opus
- Skills: none
- Goal: (a) While the pinned black intro (plan 021 T235) runs, the header stays hidden; it appears when the presentation ends, as «Próximo evento» arrives (today it slides in at 0.95 screens). Reversible when scrolling back up; with `prefers-reduced-motion` the header behaves as today without the presentation. (b) Free as many landing critical-path kB as is safe (Hernán: no fixed target, no risk): find what weighs most in the landing's first-load JS/CSS and move non-critical code out (lazy/idle), drop dead code, dedupe; no visible change to the page.
- Context: `plans/021-intro-video-noart.md` (T235 Outcome and Decisions), `apps/web/app/(landing)/` (blocks, landing.css, header), the presentation module, the D-26 size check script (find it under `tools/` or `apps/web` scripts), `next build` output.
- Scope: may touch the landing header behaviour, the landing's imports/bundling, the size check's report (not its 200 kB cap) / must not touch the presentation's visual sequence, `/mar`, other pages' behaviour.
- Done when:
  - screenshots mobile and desktop: hero (header as today), mid-intro (no header), «Próximo evento» (header visible) → attach folder
  - the size check reports the landing critical path before and after; after < 199.5 kB gzip, numbers written in ESTADO → pass
  - Test command → exit 0
- Outcome: header appears at PRESENTATION.end (reversible; 0.95 with reduced motion); landing 199.5 → 196.6 kB gzip · ef9f18e

## T239 — Dev hygiene: Supabase 400, `.next-dev`, unused keys, CRLF, stale hashes
- Status: done
- Depends on: none
- Model: haiku
- Skills: none
- Goal: Clear the small debt collected in plans 020–021. (a) Every page load logs a 400 from Supabase `carnets?is_artist=eq.true`: find the cause; if the column comes from a migration not yet applied to `boia-planet-dev`, make the client degrade quietly (no console error, artists list empty or from local data) until it exists, and name the migration in ESTADO for Hernán; if it is a code bug, fix it. (b) `next dev` gets its own distDir (`.next-dev`) so dev and build do not clobber each other; gitignore it. (c) Drop unused i18n keys (`artists.pause`/`resume` and any other key the project's i18n check finds unused). (d) `prettier --check` flags ~98 files, probably CRLF: fix the cause in config (`.gitattributes` / prettier `endOfLine`) so the check passes on Windows and Linux without a mass reformat of unrelated code; if real formatting differences remain, list them instead of reformatting. (e) Refresh stale `sources_sha256` values with the project's own tool.
- Context: plans 020 and 021 Proposals, `apps/web/lib/supabase*`/data layer where carnets are queried, `supabase/migrations/`, `docs/propuestas/2026-10-08-plan-020-guia-prueba.md` (migration order), `apps/web/next.config.*`, `.gitignore`, `.prettierrc*`, `apps/web/lib/i18n/`, wherever `sources_sha256` lives (grep).
- Scope: may touch the carnets/artists query and its fallback, next config, gitignore/gitattributes/prettier config, i18n key files (removals only), hash manifests / must not touch `supabase/migrations/` contents, remote Supabase projects, UI behaviour beyond the 400 fallback.
- Done when:
  - local mode and Supabase mode without the column: no 400 / console error from the artists query (unit test with a mocked client) → pass
  - `pnpm exec prettier --check .` → exit 0, or ESTADO lists the remaining files and why
  - `pnpm dev` writes to `apps/web/.next-dev` (state the check used in ESTADO)
  - Test command → exit 0
- Outcome: artists query retries without music columns (migration 20261008100200 pending), cached per session; `.next-dev`; unused keys removed; 47 sources_sha256 refreshed; prettier: 205 real diffs listed, not reformatted · 245e25b

## T240 — Local data: trash shows nicknames, local photos removed from IndexedDB
- Status: done
- Depends on: none
- Model: haiku
- Skills: none
- Goal: (a) The admin trash shows a deleted Carnet by user id; show its nickname (fallback to the id only when there is none), in local mode and Supabase mode. The trash rules stay as they are (Hernán). (b) When a local photo/file is deleted (or its owner object is purged from the trash), its blob is removed from IndexedDB too, so local storage does not grow forever; include a one-off cleanup of orphan blobs on load.
- Context: plan 020 Proposals and guide, the admin trash (`apps/web/app/admin/` or similar, grep «papelera»/trash), the local store (`packages/store`, IndexedDB helpers), photo upload/delete flows.
- Scope: may touch the trash UI/data, local store blob handling, related tests / must not touch the trash's retention rules, Supabase schema, `/mar` rendering.
- Done when:
  - unit tests: trash row label uses the nickname; deleting a photo removes its blob; orphan cleanup removes only unreferenced blobs → pass
  - screenshot of the trash with a Carnet showing its nickname → attach folder
  - Test command → exit 0
- Outcome: local trash shows Carnet nicknames; blobs removed on purge + orphan sweep on Admin open (local mode); screenshot skipped (demo admin password not available to the agent) · b051900

## T241 — A file uploaded for a new object is drawn in the sea
- Status: done
- Depends on: none
- Model: opus
- Skills: none
- Goal: When an admin creates a new world object and uploads its file (model/image), `/mar` does not draw it yet. Make the uploaded file show up in the sea at the object's position, in local mode (IndexedDB blob) and Supabase mode (Storage URL), with a sensible fallback when the file cannot load.
- Context: plans 020–021 Proposals and TRASPASO («Se puede hacer ya»), the admin object editor, how existing objects/islands are loaded in the 3D scene (`packages/engine`, `packages/world`, `apps/web/app/mar/`), supported formats already accepted by the upload.
- Scope: may touch the object loading path in the scene, the admin upload's stored reference, related tests / must not touch island placement or routes (T237), the HUD (T236), the landing.
- Done when:
  - unit test for resolving an object's file source (local blob → object URL, remote → URL, missing → fallback) → pass
  - screenshot of `/mar` showing a newly created object with its uploaded file → attach folder
  - Test command → exit 0
- Outcome: objects with an uploaded image (camera-facing sign) or .glb are drawn in the sea; orange buoy placeholder while loading/on failure · 2c104b5

## T242 — i18n of the Arcilla map prose and the shop texts
- Status: done
- Depends on: T237
- Model: haiku
- Skills: none
- Goal: Move the hard-coded prose in `packages/world/src/worlds/arcilla/map.ts` and the shop's texts into the i18n keys in `apps/web/lib/i18n/` (or the world package's own i18n path if the project already has one), so no UI prose stays as loose strings. Same texts, still `muestra`.
- Context: `packages/world/src/worlds/arcilla/map.ts`, the shop components, `apps/web/lib/i18n/`, the project's i18n check (lint rule or script), TRASPASO «Se puede hacer ya».
- Scope: may touch those strings, i18n files, the minimal plumbing to read keys from the world package / must not change wording, island placement or routes.
- Done when:
  - the project's i18n/loose-string check covers those files and passes; grep shows no remaining prose literals in them (ESTADO says which grep)
  - Test command → exit 0
- Outcome: Arcilla map prose → 77 `mapa.*` keys (`es-mundo.ts`, resolved via `WorldRegistry.mapTexts`), shop texts keyed; no visible change · aa0e6ff

## T243 — Spec backlog A: product, entry, architecture REQs
- Status: done
- Depends on: T238, T239
- Model: opus
- Skills: none
- Goal: Close or raise every REQ in areas PRO, ENT, ARQ (FALTA and PARCIAL) in `docs/spec/estado.md` that can be settled without Álvaro: by code, a test, a measurement in the browser pane (mobile emulation counts as emulation, say so), or a review document under `docs/`. Each change links its proof. Anything that needs Álvaro, real content or physical devices stays as it is and is listed in a short table in ESTADO with what is missing.
- Context: `docs/spec/estado.md`, `docs/spec/09-requisitos.md`, `docs/DECISIONES.md` (read only), `docs/TRASPASO.md`, `python3 tools/spec/estado.py`; FALTA rows in these areas include REQ-PRO-008/010/012/014/015/016/019/020, ENT-004/005/018/021, ARQ-004/006/017/018.
- Scope: may touch `docs/spec/estado.md` rows of PRO/ENT/ARQ only, new review docs, small code/tests that a REQ needs (small fixes only; anything bigger goes to Proposals) / must not touch `docs/DECISIONES.md`, rows of other areas (T244), real content.
- Done when:
  - `python3 tools/spec/estado.py` → exit 0
  - ESTADO lists, per REQ touched, old → new status and proof, plus the table of REQs left for Álvaro/devices
  - Test command → exit 0
- Outcome: PRO/ENT/ARQ: HECHO PRO-015, ARQ-005/008/012 (new tests); PARCIAL PRO-008/010, ENT-018, ARQ-004/006/018; 30-row table of what Álvaro/devices/migrations must provide; estado.py 170/71/19 · a105b73

## T244 — Spec backlog B: world, identity, community, admin and remaining REQs
- Status: done
- Depends on: T236, T237, T240, T241, T242
- Model: opus
- Skills: none
- Goal: Same as T243 for every area except PRO, ENT, ARQ (MUN, IDE, COM, ADM and the rest): close or raise every FALTA/PARCIAL REQ that can be settled without Álvaro, with linked proof; list what stays and why. FALTA rows include REQ-MUN-003/015/016/017/018/029/033, IDE-020, COM-029, ADM-038.
- Context: as T243; the world work of T237 (routes) and T241 (objects) bears on MUN-015..018.
- Scope: may touch `docs/spec/estado.md` rows outside PRO/ENT/ARQ, new review docs, small code/tests a REQ needs / must not touch `docs/DECISIONES.md`, PRO/ENT/ARQ rows, real content.
- Done when:
  - `python3 tools/spec/estado.py` → exit 0
  - ESTADO lists, per REQ touched, old → new status and proof, plus the table of REQs left for Álvaro/devices
  - Test command → exit 0
- Outcome: other areas: ~15 REQs closed with tests, the rest list what is missing; «tripulación» removed from user texts (IDE-020); race now voided on hidden tab/teleport in /mar (AVE-032); estado.py 181/57/22 · 8f60529

## T246 — Radio: song catalog, genres and admin upload
- Status: done
- Depends on: none
- Model: opus
- Skills: none
- Goal: The data side of the site's radio (Hernán, 2026-10-09). A catalog of songs (target ~100) with title, artist, genre, duration, file, order and a «first song» flag (exactly one; it always plays first when the radio starts). Genres are editable from the admin (create, rename, delete; 4 `muestra` genres to start: techno, house, reggaetón, indie). Admin page to upload MP3s with their fields, edit, reorder, delete, and mark the first song. Storage: Supabase Storage + a table in Supabase mode (write the migration file, never apply it), IndexedDB blobs in local mode (D-20). A lazily fetched catalog API/module the player reads (small JSON, never in the landing critical path). Seed **~100 short test tracks** (Hernán, 2026-10-09; first 3 songs, then changed to ~100 for a real-scale test) as `muestra`: ~4–6 s each (optionally 1–3 of ~30 s to test seek), ~25 per genre, mono ~48 kbps, generated locally by a script that synthesizes a simple beat/loop so they sound like music (techno, house, reggaetón feel), MP3 ~96 kbps — nothing downloaded; each with a sample title and artist, one marked as the first song.
- Context: the existing admin (`apps/web/app/admin/`), how other uploads use Storage/IndexedDB (photos, objects), `supabase/migrations/` naming, RLS patterns of other tables, `packages/contracts` for shared types, `packages/store`, `apps/web/lib/i18n/`, D-20 local mode, `docs/propuestas/2026-10-08-plan-020-guia-prueba.md` (migration order list).
- Scope: may touch new radio types/contracts, a new migration file, the admin's new Radio section, local store, catalog loader, the seed tracks and their generator script under `art/` or `apps/web/public/` (total ≤ 3 MB), tests / must not touch the player UI (T247), the landing, `/mar`, existing migrations.
- Done when:
  - unit tests: catalog CRUD in local mode; exactly one first song enforced; genre rename/delete updates or blocks dependent songs (say which in ESTADO) → pass
  - screenshot of the admin Radio section with songs and genres → attach folder
  - ESTADO names the new migration and where it goes in Hernán's migration order
  - Test command → exit 0
- Outcome: admin Radio section, catalog (local IndexedDB `boia-radio` / Supabase `radio_songs`), migration 20261009100100_radio.sql (#11), 100 seed songs 2.78 MB · aade97b

## T247 — Radio: play button, Winamp-style player, «Sonando» toast, /mar button
- Status: done
- Depends on: T246, T236, T238
- Model: fable
- Skills: frontend-design
- Goal: The site's radio UI, following Hernán's description (2026-10-09). **Landing, on open:** a «Play music» radio button at the top right, styled to match the page. First tap starts the music: always the catalog's first song, then random songs from the list; the button changes colour to show it is active. A later tap opens the player to choose songs. **On scroll:** the top-right button disappears and reappears next to «Entradas» (in the header/bar that shows after the intro, T238); there the radio button glows to show it can be tapped, and it opens the player. **The player:** looks like classic Winamp (2.x skin era: compact dark panel, LCD-style green time and scrolling title, small transport buttons, seek and volume sliders, playlist window; see https://en.wikipedia.org/wiki/Winamp) with its options except the equalizer: play, pause, stop, previous, next, shuffle, repeat, seek, volume, elapsed/remaining time, playlist; songs grouped/filterable by genre; the list is scrolled with the finger (touch swipe) to choose a song. Original artwork inspired by that look — no Winamp logos, names or copied skin bitmaps. **When the player is closed,** each song change shows a small popup at the bottom: «Sonando: <título> - <artista>», auto-hiding. **Inside `/mar`:** a new Radio button in the HUD opens the same player. Music keeps playing across client navigations between the landing and `/mar` when possible.
- Behaviour details: nothing autoplays (browsers block it; the first tap starts it); audio streams one song at a time (`preload="none"`, next song prefetched only near the end of the current one); the player code and catalog load lazily (on idle or first tap) — the landing critical path must not grow (only the button's minimal markup/CSS may be server-rendered); while the radio plays, the world's own background music in `/mar` is muted and Ajustes' music toggle (T236) controls the radio too (decide the exact link and log it); keyboard and screen-reader accessible; `prefers-reduced-motion` drops the glow pulse and scrolling title animation; all strings by i18n key.
- Context: T246's catalog module and types, the landing header and «Entradas» CTA (`apps/web/app/(landing)/`), T238's header-during-intro behaviour, the `/mar` HUD and Ajustes (T236), existing audio handling in `/mar`, `apps/web/lib/i18n/`, D-26 size check.
- Scope: may touch the landing header/CTA area, a new radio player module, `/mar` HUD (new button only), the world-music mute hook, i18n, tests, e2e specs that obviously break / must not touch the catalog data model (T246) beyond reading it, the intro presentation sequence, other HUD behaviour.
- Done when:
  - unit tests: play order (first song then random without immediate repeats), shuffle/repeat, toast on song change only when the player is closed → pass
  - screenshots mobile 390×844 and desktop: landing button idle and active, button next to «Entradas» glowing after scroll, the open Winamp-style player with playlist and genres, the «Sonando» toast, the `/mar` Radio button and player → attach folder
  - landing critical path not larger than after T238 (size check numbers in ESTADO) → pass
  - Test command → exit 0
- Outcome: «Música» hero button (first song then shuffle), glowing header button next to «Entradas», Winamp-style player with genres, «Sonando» toast, `/mar` Radio button; radio chunk lazy; landing 196.6 → 196.7 kB (+75 B webpack runtime table, accepted) · 6a720b9

## T245 — Test guide for Hernán after plan 022
- Status: done
- Depends on: T243, T244, T247
- Model: haiku
- Skills: none
- Goal: Write `docs/propuestas/2026-10-09-plan-022-guia-prueba.md` in Spanish, in the shape of the plan 020 guide: what changed and how to try it (mobile and desktop), the e2e specs Hernán should run (collected from every task's ESTADO section), what he has to do outside the repo (pending dev migrations in order, including any named by T239), the REQs left for Álvaro/devices (from T243–T244), and the open questions the agents raised. Update `docs/TRASPASO.md` so it points to it and reflects the new state.
- Context: ESTADO.md sections of T236–T244, `docs/propuestas/2026-10-08-plan-020-guia-prueba.md`, `docs/TRASPASO.md`, `plans/022-pulido-deuda-spec.md`.
- Scope: may touch the new guide and `docs/TRASPASO.md` / must not touch code, `docs/DECISIONES.md`.
- Done when:
  - the guide exists and every task T236–T244 appears in it; TRASPASO links it
  - Test command → exit 0
- Outcome: `docs/propuestas/2026-10-09-plan-022-guia-prueba.md` (radio, e2e, 11 migrations, REQs left, questions); TRASPASO updated · c741612

## Decisions
- 2026-10-09: plan built with Hernán in the session: all four fronts; Calitas label stays cream; Ajustes toggles yes; trip destination in a chip above the bar; header hidden during the intro; landing kB: as much as safe; spec: everything not depending on Álvaro; entry timings and trash rules unchanged (Hernán)
- 2026-10-09: radio added as T246 (catalog, genres, admin upload; songs in Supabase Storage / IndexedDB, never in the repo beyond tiny `muestra` seeds) and T247 (player UI after Hernán's description, Winamp look without EQ); T245 also covers it; T244 does not wait for the radio (Hernán + orchestrator)
- 2026-10-09: Hernán asked to start the radio now with test songs (then ~100 short tracks, sent to the running agent): T246 launched as a third parallel agent; T238 goes next so T247 can follow (Hernán)
- 2026-10-09: Hernán: use Haiku 5.5 wherever possible → T239, T240, T242, T243, T244, T245 on haiku; T238 (bundle surgery), T241 (3D loading), T247 (complex player UI) stay on opus; a haiku task that fails retries on opus; running T236/T237/T246 keep opus (orchestrator)
- 2026-10-09: Hernán: T247 runs on Fable (Hernán)
- 2026-10-09 T246: 100 seed songs (98×4 s, 2×30 s: first techno + one house), made with Blender's bundled ffmpeg/numpy (`art/radio/generar.py`); Supabase mode falls back to the seeds while `radio_songs` is empty/missing; genres seeded by the migration; first song/order via RPCs + deferred check; genre rename updates songs, delete blocked while it has songs; radio types added to `database.types.ts` by hand (agent)
- 2026-10-09 T237: Calitas behind-left, not straight behind (the Los Rápidos road and Tabarca leave no room); no route points changed, `calitas` added to `exploracion` visits; `mapa.py` counts loose islands as land, `validar.py` checks loose islands; «Isla del Cañón» renamed «Puig Campana»; plano.svg and Calitas/canon art regenerated (agent)
- 2026-10-09 T238: `headerFrom` option of the boot script = `PRESENTATION.end`; «Cerrar sesión» loads lazily; `checkout.css` split into dialog part + `checkout-form.css`; size check gained by-type totals and `--baseline`; e2e helpers scroll past `PRESENTATION.end + 0.6` before using the header (agent)
- 2026-10-09 T239: 400 came from `registered.ts` asking for music columns of unapplied migration 20261008100200; first spec probe replaced (orchestrator asked) by query-then-retry cached in sessionStorage `boia.artists.music-columns` (one 400 per browser session until the migration is applied); prettier cause was not CRLF, `endOfLine: lf` added; eslint ignores `.next-dev` (agent)
- 2026-10-09 T240: moving to trash keeps the blob; purge (manual or retention) removes it; sweep keeps blobs referenced by content, drafts, trash and undo history; IndexedDB errors ignored in the sweep; Supabase trash already showed nicknames (agent)
- 2026-10-09 T241: uploaded file replaces the category piece (island template too); image = billboard; size = footprint (min 2.5) × scale, height ≤ half, ≤ 6 u; models lambertized (`lambertize` exported); `data-objetos-arte` on the canvas (agent)
- 2026-10-09 T242: world package has no i18n → map texts are keys resolved by the web; proper names keyed too; world-package tests now expect keys; check = new catalog test + grep (agent)
- 2026-10-09 T247: Ajustes «Música» off / landing 🔊 pauses the radio, on resumes; manual play with music off turns «Música» on; own volume slider; hero button idle→start, paused→resume, playing→open player; header/mar buttons open/close the player; hero button hides from 0.42 screens; shuffle + repeat-all by default; prefetch at ≤8 s left; 3 consecutive failures stop; state in sessionStorage; radio chunk on idle (≤1.5 s) or first gesture; `/mar` button under «!» (agent). +75 B on the landing accepted: no radio code in the critical path (orchestrator)
- 2026-10-09 T243: attempt 1 on haiku incomplete → retried on opus (orchestrator); HECHO only where a test meets the 09 criterion; all browser checks are emulation; ARQ-006 stays PARCIAL (`pnpm db:test` needs local PostgreSQL) (agent)
- 2026-10-09 T244: attempt 1 on haiku incomplete → retried on opus (orchestrator); kept «tripulación» → «barcos»/«ranking» and «El grupo BOIA» (changed strings listed in ESTADO for Hernán); IDE-020 test scans `mundos/**/*.json`; AVE-032 wired in /mar instead of downgraded; MUN-015/018 → PARCIAL (agent)
- 2026-10-09: Codex still considered broken; all tasks on Opus/Sonnet (orchestrator)

## Proposals (new scope)
- 2026-10-09 T244: edit map-place dialogue (castaway, boias) from the Admin (ADM-001); `lib/mundo/menu` (7 sections) looks orphaned; COM-016 ticketing activation procedure (Álvaro's provider); one dry run of `docs/manual-admin.md` §6 (ADM-031); update criteria that conflict with later decisions (MUN-001, MUN-021, MUN-028, AVE-026, AVE-031, AVE-035, IDE-034)
- 2026-10-09 T243: landing does not recover from a lost WebGL context (planet without islands, «BOIA» stays white); /mar welcome sheet titled «Welcome Aboard» in English; at 200 % zoom corner texts overlap «Consigue descuentos»; decide whether the /mar welcome sheet counts as a blocking modal (PRO-010); pass criteria of PRO-009, ENT-002, ENT-027 contradict later decisions
- 2026-10-09 T247: the last +75 B on the landing come from the catalog/sample split shared with the admin (`muestra.json` commons chunk)
- 2026-10-09 T242: remaining prose literals: `acuarela/skin.ts` (`cala: 'Puerto de Alicante'`, hidden world) and default `leaveReaction` in `packages/world/src/behaviors.ts`; no lint rule for loose strings exists
- 2026-10-09 T241: upload object files to Supabase Storage (needs a bucket + migration); Admin content still stays in the browser in both modes (D-20)
- 2026-10-09 T240: artist Carnets are excluded from `admin.carnets()`, so their trash rows still show the id; the orphan sweep could prune a blob uploaded at the exact moment it runs (Admin open only)
- 2026-10-09 T239: reformat the 205 prettier-flagged files in one dedicated commit when nothing else runs; review ~640 i18n keys a naive scan flags as unused (dynamic keys make it unreliable)
- 2026-10-09 T238: more landing kB needs architecture changes (blocks are client components re-rendered by `LiveLanding`) or splitting the web i18n catalog
- 2026-10-09 T237: to put Las Calitas straight behind the castaway, move the castaway or the Los Rápidos stretch behind it; on mobile the island only shows at the left edge from the castaway
- 2026-10-09 T246: `radio.supabase.ts` DB test once the migration is applied; fix odd gender agreement in generated sample titles («Velero lenta»)

## Log
- 2026-10-09 T236 launched · attempt 1 · agent a40d2e001978df284
- 2026-10-09 T237 launched · attempt 1 · agent adb530163dcdf25cb
- 2026-10-09 T246 launched · attempt 1 · agent a365ac979e8a2f6af (3rd parallel agent, Hernán asked to start the radio now)
- 2026-10-09 T238 launched · attempt 1 · agent ad2d74f6a2dc953c6
- 2026-10-09 T246 done · merged aade97b
- 2026-10-09 T237 done · merged dc92a44
- 2026-10-09 T239 launched · attempt 1 · agent aba567b4d1ff3cabc
- 2026-10-09 T238 done · merged ef9f18e
- 2026-10-09 T247 launched · attempt 1 · agent a65c6ec9df5c322d0 (fable)
- 2026-10-09 T239 done · merged 245e25b (landing 196.6 kB)
- 2026-10-09 T240 launched · attempt 1 · agent ae642e6c7f2d1f908
- 2026-10-09 T240 done · merged b051900
- 2026-10-09 T241 launched · attempt 1 · agent ac7d75086f4f4e92e
- 2026-10-09 T241 done · merged 2c104b5
- 2026-10-09 T242 launched · attempt 1 · agent a046011c27eafd151
- 2026-10-09 pushed main c550a62 (Hernán in session; T236–T241 + T246)
- 2026-10-09 T242 done · merged aa0e6ff
- 2026-10-09 T243 launched · attempt 1 · agent aeae088802d674361
- 2026-10-09 T247 done · merged 6a720b9
- 2026-10-09 T244 launched · attempt 1 · agent aee2480a6c92ff544
- 2026-10-09 pushed main c82b1c8 (Hernán in session; + T242, T247 radio)
- 2026-10-09 T243 attempt 1 incomplete (haiku touched ~6 REQs, left most PARCIAL rows and the Álvaro/devices table) · branch worktree-agent-aeae088802d674361 kept for the retry; attempt 2 on opus
- 2026-10-09 T243 launched · attempt 2 (opus, continuation of worktree-agent-aeae088802d674361) · agent a8abbedcaa7d89063
- 2026-10-09 T244 attempt 1 incomplete (haiku reviewed only a subset of PARCIAL rows; changed «tripulación» copy for IDE-020) · branch worktree-agent-aee2480a6c92ff544 kept; attempt 2 on opus
- 2026-10-09 T244 launched · attempt 2 (opus, continuation of worktree-agent-aee2480a6c92ff544) · agent aca57f1ea71e67d5e
- 2026-10-09 T243 done · merged a105b73
- 2026-10-09 T244 done · merged 8f60529
- 2026-10-09 T245 launched · attempt 1 · agent a02daa8169b279b32
- 2026-10-09 T245 done · merged c741612
- 2026-10-09 plan 022 done · final test on main = T245 integration run (pass)
