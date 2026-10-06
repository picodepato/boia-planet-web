# Plan 015 — Castle game v2, the lighthouse board, Vecino redesign, mascots and prizes

Status: active
Created: 2026-10-06
Base branch: main
Goal: Second round on plan 014's «Defensa del Castillo» and the Tabarca lighthouse, from Hernán's notes and answers of 2026-10-06 (folded below; the notes file `plans/015-notes.md` is in git history at 15902e7). (1) The Tabarca lighthouse moves near the start and its board becomes a closed pop-up with three buttons that open the minimap's «Navegar / Ir en nave» choice. (2) The castle game gets a longer path with U-turns, building anywhere in the arena with range preview and real island images, tap-to-move plane with upgrades, castle upgrade, target priorities, ×2 speed, «Llamar oleada», next-wave warning, health bars and damage numbers, and a guided first game. (3) The «Vecino quejica» is remodelled in Blender for the Cañón and the castle. (4) Every game's top challenge gives a prize: castle and race achievements, two new mascots («Cañoncito», «Tortuga turbo») and the «Estela del vórtice» wake. (5) Line endings and slow test suites are fixed first.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task (this machine is Windows 10, Git Bash): the two `packages/db` suites need a local Postgres that this machine does not have, hence the exclude; `PYTHONUTF8=1` makes the Python checks read UTF-8; if a guard blocks the chained test command, run its steps one by one. E2E: `E2E_PORT=<free port> pnpm e2e <spec files> --workers=1` (first time in a worktree: `pnpm --filter @boia/web exec playwright install chromium`); the machine is slow under load, rerun only failing specs; the full e2e run is done only in T178. UI strings only by key in `apps/web/lib/i18n/`, never loose strings in components. Content (names, texts, numbers, prizes, sounds) stays `muestra`. Never commit `apps/web/public/atlas/`, `.claude/launch.json` or any `.env*` file other than `.env.example`. Never push or deploy; Supabase migrations are written and tested locally but never applied to a real project (Hernán does that). Never edit `docs/DECISIONES.md`. Local mode (D-20, no Supabase env vars) must keep working; Supabase mode must not break. Work only on the main world **Arcilla**; **Acuarela** stays hidden and is not kept in parity. **The Cañón's game and balance do not change** (`SURVIVORS_CONFIG_VERSION` stays), except the Vecino's look in T174. Blender: 4.0 at `C:/Program Files/Blender Foundation/Blender 4.0`, the repo pipeline in `tools/blender/`. Skills: each task's block names the skills it may invoke with the Skill tool; invoke none other.

**Required reading for every task:** this header; plan 014's Outcomes, Decisions and Proposals (`plans/014-castillo-tower-defense.md`), which this plan builds on. Where they disagree, this plan wins.

Decisions of 2026-10-06 that every task follows (Hernán's notes and answers):
1. **Lighthouse place.** With the camera starting on the boat, the Tabarca lighthouse island is visible on the **left**, a bit further ahead, almost next to the náufrago (`[-5.6, 16.4]` in `packages/world/src/worlds/arcilla/map.ts`); no overlap with other places, buoys on water.
2. **Board pop-up.** Like the other island panels: it appears **closed** (collapsed) with a line like «Desde el faro puedes ver dónde jugar» and **three buttons** (Cañón, Castillo, Carrera); expanding it shows an explanation of each game (and the best medal where there is one). A button opens the same choice the minimap shows when tapping an island: the island's name with **Navegar** / **Ir en nave** (`apps/web/app/mar/sheet.tsx`). It no longer marks a destination («Rumbo a…» is removed). Its icons match the rest of the game's icons.
3. **Arena bounds.** The plane can never leave the arena (as today). The camera can zoom in and out freely during the game, but its widest view is the current top-down arena view: it never pans or zooms out to the rest of the world.
4. **Zoom and building camera.** The game starts at the current top-down view; the player can zoom any time. Opening «Construir» moves the camera to that start view and keeps it; zoom stays available.
5. **Building.** Islands can be built **anywhere in the arena** (no ring around the plane), inside the arena edge, off the path, off the vortex, not overlapping another island or the castle. While placing, the island's **attack range** is drawn around it. **No pause while building**: the game keeps running.
6. **Taps.** In build mode, tapping the sea places the island preview there; an **«Instalar isla»** button at the bottom confirms. Outside build mode, tapping the sea moves the plane there (like sailing in the world) and tapping an island selects it. Keyboard keeps working.
7. **Path v2.** Even **longer**, with **pronounced U-turns** (sharper than today's curves) so an island fits inside each U and hits both sides; the north curves and the right one tighter to the castle; the zigzag with **longer straights** so an island fits in each angle. Same path for everyone; vortex at its start as today.
8. **Plane.** Upgrades only **attack speed** and **damage**, each up to **level 5**, bought with in-game coins.
9. **Castle upgrade.** Only raises **max life**; expensive, a lot of life per level (`muestra`).
10. **Speed and waves.** A **×2 speed** toggle and a **«Llamar oleada»** button (call the next wave early, small coin bonus `muestra`); both allowed in ranked games (the sim is the same, only faster). A **next-wave warning** says what comes and whether there is a boss.
11. **Pause options.** Toggles for enemy **health bars** and **damage numbers** (both drawn in the arena by T170; on by default, saved per device).
12. **Target priority.** Each attacking island has a target priority (first / last / strongest / closest), set when tapping it; each kind has its own default (Benidorm: strongest).
13. **«Construir» images.** Each island shows a fixed render of its real in-game model from the front (same framing for all, transparent background), not an icon; tapping an island in the list shows a more detailed explanation of its damage.
14. **Guided first game.** Short steps. Before the very first game the player is asked whether to start with the guide or not; during the guide a button skips it and plays normally.
15. **Vecino quejica.** The whole 3D model redone from zero in **Blender** by Fable, no approval stop; used in the Cañón and in the castle game, with the same gameplay.
16. **Prizes and mascots** (names and designs `muestra` until Álvaro approves; new models from zero in Blender by Fable, no approval stop; achievements that unlock a mascot also give coins):
   - **Castle:** one achievement per difficulty won (Tranquila, Normal, Tormenta; any run length) with the usual points; winning on **Tormenta** (any length) gives points and coins and unlocks the mascot **«Cañoncito»** (a small cannon on deck); **Tormenta + 10 min** unlocks the wake **«Estela del vórtice»** (lilac and black spiral), shown everywhere in the world.
   - **Race:** first finish → «Primera regata» with some points and coins; a **decent time** → «Rápido», which unlocks the mascot **«Tortuga turbo»**, swimming **behind** the boat (not on deck). The time threshold is measured with the race bot so a normal player gets it after about 3–5 tries.
17. **Clouds** drift over the arena; **turbo and the speed readout** stay visible during the castle game (plan 014 proposals).
18. **Models:** each task block names its model (Opus 5.5 by default; Fable 5.1 for the Blender models; Codex for short Opus-level tasks, through a wrapper agent, falling back to Opus when out of credits).

## Tasks

## T177 — Line endings and slow test suites
- Status: running (attempt 1)
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Skills: none
- Depends on: none
- Goal: Stop the CRLF churn and the timeout failures before the rest of the plan runs.
  - Add `.gitattributes` with `* text=auto eol=lf` (binary types marked binary: glb, png, jpg, webp, ogg, mp3, wav, blend, woff2…) and renormalize the repo in one commit (`git add --renormalize .`); nothing but line endings changes.
  - Vitest: measure the slowest suites (survivors and defense balance/bot sims, others found by timing); split them out of the default run into a separate config/script (e.g. `pnpm test:slow`) or make them cheaper with no loss of what they check, so the Test command passes reliably with two agents running; keep every test runnable and document how.
  - E2E: tune the timeouts/waits of the specs that flake under load (plan 014 T165: timing and piloting tests, the castle «construir…» desktop step) with waits on state instead of fixed times; no test deleted.
- Context: plan 014 Proposals and T165 Decisions; `vitest.config.ts`, `apps/web/playwright.config.ts`, `packages/engine/src/survivors/*balance*.test.ts`, `survivors-difficulty.test.ts`, `packages/engine/src/defense/defense-balance.test.ts`, `README.md` (test commands).
- Scope: may touch `.gitattributes`, line endings of any file, test configs, `package.json` scripts, slow test files (structure only), e2e specs (waits/timeouts), `README.md` test section / must not touch app behaviour, game balance, `docs/DECISIONES.md`.
- Done when:
  - `git ls-files --eol | grep -c "i/crlf"` → 0 (outside binaries)
  - the default vitest run takes clearly less than before (times before/after recorded in the status section) and the slow suites pass in their own command → exit 0
  - Test command → exit 0
- Outcome:

## T174 — Vecino quejica remodelled in Blender (Cañón and castle)
- Status: running (attempt 1)
- Model: fable (Fable 5.1)
- Skills: blender-art-direction-intake, blender-modeling-workflow, blender-asset-validation, blender-iterative-refinement
- Depends on: none
- Goal: Header decision 15. A new «Vecino quejica» model from zero (the grumpy neighbour boss: recognisable, funny, Arcilla clay low-poly style matching the other models and enemies, readable from the Cañón camera and from the castle's high camera), built reproducibly with the repo's Blender pipeline, exported as GLB and loaded where the Vecino is drawn today (procedural `vecinoGeometry` kept as fallback while the GLB loads or fails). Any animation the current view does (bob, attack tells, hit flash) keeps working; hitbox and gameplay unchanged. Cheap in `baja`.
  - **No approval stop**: render a contact sheet (4 angles + in-game in the Cañón and in the castle arena) for the record and your own visual review, then finish.
- Context: `apps/web/app/mar/engine/survivors-vecino.ts`, `packages/engine/src/survivors/vecino.ts`, `apps/web/app/mar/engine/models.ts` (GLB loading), the castle enemy views (`apps/web/app/mar/engine/defense-*.ts`), `tools/blender/` and the T166 Outcome of plan 014 (how the Tabarca GLB was built and shipped), `art/islas/3d/manifest.json`.
- Scope: may touch `tools/blender/**` (new script), GLB output and its manifest, `survivors-vecino.ts`, model loading, the castle view's Vecino use, tests / must not touch the Cañón's rules or balance, the defense sim, `docs/DECISIONES.md`.
- Done when:
  - the Blender script rebuilds the GLB from scratch (command recorded in the status section) and the asset validation passes
  - the contact sheet is saved outside the repo and its path recorded in the status section
  - unit or e2e test: the Vecino view uses the GLB when loaded and the fallback otherwise → pass
  - Test command → exit 0
- Outcome:

## T168 — Tabarca lighthouse near the start and the board pop-up v2
- Status: pending
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Skills: frontend-design
- Depends on: T177
- Goal: Header decisions 1 and 2.
  - Move the `faro` place per decision 1 (check the framing from the start camera on mobile and desktop); the race, Fiestera mission, minimap, autopilot, hidden discounts, info buoys and chests still work (no place inside another, no buoy on land).
  - The board as a closed pop-up with the line and three buttons; expanded, one explanation per game and the best medal; each button opens the minimap's island choice (Navegar / Ir en nave) for that island, reusing `sheet.tsx`'s component, not a copy; «Rumbo a…» and its destination mark removed with their keys; icons from the game's icon set; keyboard and touch, mobile and desktop.
- Context: `apps/web/app/mar/tablon.tsx`, `apps/web/lib/mundo/board.ts`, `apps/web/app/mar/sheet.tsx` (l.271–281), `apps/web/app/mar/minimap.tsx`, `apps/web/lib/i18n/es-mar.ts` (l.122–124, 200–204), `packages/world/src/worlds/arcilla/map.ts` (faro l.46–60, 508–521, 1303; náufrago l.663; spawn l.1351), `apps/web/e2e/mar-tablon.spec.ts`, plan 014 T157/T166 Outcomes.
- Scope: may touch the files above, place-panel styles, i18n, tests and e2e / must not touch the castle game, the island models, `docs/DECISIONES.md`.
- Done when:
  - unit tests: places do not overlap and buoys are on water after the move; the faro is in the left half of the start view → pass
  - `E2E_PORT=<free> pnpm e2e mar-tablon.spec.ts mar-decor.spec.ts --workers=1` (board opens closed, expands, each button shows Navegar / Ir en nave for its island and both work) → exit 0
  - Test command → exit 0
- Outcome:

## T169 — Castle simulation v2: path, building anywhere, upgrades, priorities, speed, waves
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T177
- Goal: Header decisions 3 (bounds), 5, 7, 8, 9, 10 and 12 in `packages/engine/src/defense/`.
  - Path v2 per decision 7, still deterministic and the same for everyone; tests: no self-intersection, U-turns where an island footprint fits inside each U and reaches both sides with a mid-range tower, zigzag angles fit an island, gaps between turns, new walk time recorded; arena radius adjusted if needed (vortex and arena still clear of Boia 7 and the race lines, plan 014 T157/T160).
  - Build rule: anywhere inside the arena (footprint fully inside the edge), off path/vortex/islands/castle; the plane's build ring removed; the plane clamped inside the arena.
  - Plane upgrades: attack speed and damage, levels 1–5 each, costs; castle max-life upgrade (expensive, big step); priorities first/last/strongest/closest per tower with per-kind defaults; time scale ×1/×2 (same results per sim tick); «Llamar oleada» (next wave starts now, coin bonus); next-wave info (kinds, counts, boss flag, time to it).
  - Bump `DEFENSE_CONFIG_VERSION`; old ranking rows stay in their version (as plan 014 did); the simple building bot still holds Tranquila (T178 rebalances).
- Context: `packages/engine/src/defense/` (`path.ts:94`, `config.ts:251,256,334,430`, `build.ts:48–84`, towers, bots), plan 014 T158/T159/T165 Outcomes and Decisions.
- Scope: may touch `packages/engine/src/defense/**`, its exports, the web code that reads the removed ring only to keep build/types green (no UI work) / must not touch the Cañón, the HUD design, `docs/DECISIONES.md`.
- Done when:
  - unit tests: path v2 geometry above; build anywhere valid/invalid reasons incl. edge; plane clamp; plane upgrades 1–5 and castle upgrade; each priority picks the right target; ×2 gives the same state as two ×1 steps; call-wave timing and bonus; next-wave info; determinism → pass
  - `pnpm exec vitest run packages/engine/src/defense --testTimeout=60000` (and the slow suite command from T177 for defense) → exit 0
  - Test command → exit 0
- Outcome:

## T172 — Island renders for «Construir»
- Status: pending
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Skills: none
- Depends on: T177
- Goal: Header decision 13 (images). A reproducible script that renders each of the seven tower islands (Faro de Tabarca GLB, Nochevieja, Halloween, Puerto de Alicante, Ibiza, Isla del Sonido, Benidorm — the same models the castle game builds) from the front, as seen from the normal game, with the same camera framing and lighting for all, transparent background, at 1× and 2× sizes (webp or png, small), committed as static assets with a manifest; the command is documented. Recognisable at the list's size.
- Context: `apps/web/app/mar/engine/islands.ts` (`buildIsland`), `island-models.ts`, the castle's built-island normalization (`apps/web/app/mar/engine/defense-*.ts`), plan 014 T160/T166 Outcomes; Playwright or headless three.js in the repo's tooling.
- Scope: may touch a new script under `tools/`, new assets under `apps/web/public/` (not `atlas/`), a small typed manifest, a test / must not touch the HUD (T171 uses the images), island models, `docs/DECISIONES.md`.
- Done when:
  - the script regenerates all images from scratch (command in the status section); a test checks the manifest lists seven kinds and each file exists with alpha → pass
  - Test command → exit 0
- Outcome:

## T175 — Mascots «Cañoncito» and «Tortuga turbo», and the «Estela del vórtice»
- Status: pending
- Model: fable (Fable 5.1)
- Skills: blender-art-direction-intake, blender-modeling-workflow, blender-asset-validation, blender-iterative-refinement
- Depends on: T177
- Goal: Header decision 16 (the looks; T176 wires the unlocks).
  - **«Cañoncito»**: a small cannon mascot on deck, same slot and placement rules as the minikraken, with a small idle animation (e.g. recoil puff now and then), in Blender, GLB.
  - **«Tortuga turbo»**: a turtle that **swims behind the boat** in the wake (follows the boat's path at a short distance, paddle animation, surfaces/dives a little, never in front, keeps up with turbo), in Blender, GLB. It uses the mascot slot (one mascot equipped at a time).
  - **«Estela del vórtice»**: a wake option in lilac and black with a spiral feel, drawn by the existing `Wake` everywhere the wake shows.
  - All three as cosmetics in the catalog (ids `mascota-canoncito`, `mascota-tortuga-turbo`, `estela-vortice`), not obtainable in the shop; equip in the boat menu once owned (dev/e2e way to own them for testing). Arcilla clay style, cheap in `baja`; no approval stop: contact sheet for the record (each mascot 4 angles + on the boat in the world; the wake in motion).
- Context: `packages/store/src/sample/progress.ts` (l.22, 191–198, 389–401), `packages/store/src/schema.ts:350`, `apps/web/lib/barco/dressing.ts`, `apps/web/app/mar/engine/minikraken.ts`, `mar3d.ts` (mascot l.369–373, 477–480, 1221–1285; wake l.482, 1208–1213), `apps/web/app/mar/engine/effects.ts` (`Wake`), `tools/blender/`, plan 014 T166 Outcome.
- Scope: may touch `tools/blender/**`, GLB output and manifest, the cosmetic catalog, dressing, mascot/wake drawing in the engine, the boat menu, i18n, tests / must not touch achievements logic (T176), the castle game, `docs/DECISIONES.md`.
- Done when:
  - the Blender scripts rebuild both GLBs from scratch (commands recorded) and the asset validation passes; contact sheets saved outside the repo, paths recorded
  - unit tests: both mascots and the wake exist in the catalog, equip in the mascot/wake slots; the turtle stays behind the boat at speed and turbo → pass
  - `E2E_PORT=<free> pnpm e2e tienda.spec.ts --workers=1` → exit 0
  - Test command → exit 0
- Outcome:

## T170 — Castle arena v2: camera, zoom, taps, range preview, path view, bars and numbers
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T169
- Goal: Header decisions 3, 4, 5 (range preview), 6, 7 (view), 11 (drawing) and 17 in the 3D arena.
  - Camera: zoom in/out with the game's zoom controls (rail, wheel, pinch, keys), widest = current top-down arena view, no pan outside the arena; «Construir» moves to the start view; follows the plane when zoomed in.
  - Taps: build mode → preview at the tapped spot with the island's range circle and valid/invalid colour (reason from the sim); otherwise tap sea → plane flies there (clamped to the arena), tap island → selection event for the HUD.
  - Path v2 barriers, corner accents and vortex redrawn from the sim's path.
  - Enemy health bars and floating damage numbers (cheap, pooled; switchable from settings), clouds over the arena, turbo and speed readout visible.
  - Performance in `baja` at the 10-min Tormenta peak stays near plan 014 T165 (p95 ≈ 33 ms), numbers recorded.
- Context: `apps/web/app/mar/engine/defense-arena.ts` (l.92–117) and the other `defense-*.ts`, `mar3d.ts` (zoom l.351–381, 849–855, keys 2745–2758, arena l.3169, 3218), `mar-client.tsx` (zoom rail l.2363–2379), `castillo-mode.tsx`, T169 Outcome.
- Scope: may touch `apps/web/app/mar/engine/**` defense view and small hooks in `mar3d.ts`, `castillo-mode.tsx`, the zoom rail for the arena, tests, castle e2e / must not touch the HUD panels (T171), the engine rules, the Cañón, `docs/DECISIONES.md`.
- Done when:
  - unit tests: camera zoom limits and clamp to the arena; tap → plane target clamped; range circle radius = tower range; bars/numbers pooling and toggles → pass
  - `E2E_PORT=<free> pnpm e2e <the castle spec> --workers=1 -g "arena|zoom|tap"` → exit 0
  - Test command → exit 0
- Outcome:

## T171 — Castle HUD v2: island list, details, priorities, upgrades, speed, waves, options
- Status: pending
- Model: opus (Opus 5.5)
- Skills: frontend-design
- Depends on: T169, T170, T172
- Goal: Header decisions 5, 6, 8–13 in the HUD, same style as today, mobile and desktop.
  - «Construir»: the list with T172's images, cost (grey when unaffordable); tapping an item shows its detailed damage explanation and then placing; «Instalar isla» button to confirm, cancel.
  - Selected island: level, Mejorar, Vender, target priority picker.
  - Plane upgrades (speed, damage 1–5) and castle life upgrade; ×2 toggle; «Llamar oleada» with its bonus; next-wave warning (kinds, boss); pause menu toggles for health bars and damage numbers (saved per device).
  - Nothing overlaps at 360×640, 390×844, 768×1024 and 1440×900; touch targets ≥ 44 px; `aria-live` for wave warnings.
- Context: `apps/web/app/mar/castillo-hud.tsx`, `castillo-hud-model.ts`, `castillo-hud.css`, `castillo-mode.tsx`, plan 014 T161 Outcome and Decisions, T169/T170/T172 Outcomes.
- Scope: may touch castle HUD files, CSS, i18n, castle e2e, the pause menu's castle options / must not touch the engine rules, the Cañón's HUD behaviour, `docs/DECISIONES.md`.
- Done when:
  - unit tests: HUD model (images per kind, detail texts, priorities, upgrade costs and caps, wave warning text) → pass
  - `E2E_PORT=<free> pnpm e2e <the castle spec> --workers=1 -g "construir|mejorar|vender|HUD|oleada"` (build anywhere with «Instalar isla», change priority, upgrade plane to 5 and castle, ×2, call wave, toggles; no overlap at the four sizes) → exit 0
  - Test command → exit 0
- Outcome:

## T173 — Guided first castle game
- Status: pending
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Skills: frontend-design
- Depends on: T171
- Goal: Header decision 14. Before the very first castle game the pop-up asks «¿Empezar con la guía?» (Sí / No, jugar); the choice is remembered (local and with the account if progress lives there) and the guide can be replayed from the pre-game pop-up. The guide: short steps over the real game (move the plane by tapping, open «Construir», place and install an island, upgrade, priority, call a wave), each with a highlight and «Siguiente», advancing also when the player does the action; a **«Saltar guía»** button always visible ends it and the game continues normally. Guided games rank like any other unless the guide changes the sim (it must not).
- Context: T171 Outcome, `castillo-mode.tsx`, the castle pop-up (plan 014 T162), how other first-time hints are stored in local progress.
- Scope: may touch castle mode/pop-up/HUD overlay files, progress flag, i18n, tests, castle e2e / must not touch the engine rules, `docs/DECISIONES.md`.
- Done when:
  - unit tests: first-time question shown once; skip ends the guide; steps advance on action → pass
  - `E2E_PORT=<free> pnpm e2e <the castle spec> --workers=1 -g "guía"` (first game asks; Sí runs the steps; «Saltar guía» returns to normal play; second game does not ask) → exit 0
  - Test command → exit 0
- Outcome:

## T176 — Castle and race achievements, prizes and mascot unlocks
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T169, T175
- Goal: Header decision 16 (logic).
  - Castle: three achievements «won on <difficulty>» (any length); the Tormenta one gives points + coins + `mascota-canoncito`; a special one for Tormenta + 10 min gives `estela-vortice` (+ coins). Only real games (no shortcut, no «Terminar partida»).
  - Race: «Primera regata» (first finish; points + coins) and «Rápido» (finish under a threshold; coins + `mascota-tortuga-turbo`). Measure the threshold with the race bot (`apps/web/app/mar/race.test.ts:69` `botRace`) and a model of a normal player's tries (record the method and numbers; target ≈ 3–5 tries); make it a named constant. Check it does not clash with «Rayo de Los Rápidos».
  - Local document migration (schema 10) and a Supabase migration (written and tested locally, not applied) for the new achievements/cosmetics; world prize amounts `muestra`; the achievements show in the existing achievements views and the castle's final card says what was unlocked.
- Context: `packages/store/src/sample/progress.ts` (l.40, 127–151, 155–223), `packages/store/src/schema.ts:33`, `packages/store/src/migrations.ts` (l.439–535), `apps/web/lib/mundo/achievements.ts` (l.39, 46, 249, 276, 326, 339), `packages/engine/src/circuit/race.ts`, `apps/web/lib/mundo/circuit-hud.ts`, castle result (plan 014 T162/T163), `supabase/migrations/`, T175 Outcome.
- Scope: may touch the files above, castle final card, i18n, `supabase/**` and `packages/db/**` migrations, tests and e2e / must not touch the Cañón's achievements, the defense balance, `docs/DECISIONES.md`.
- Done when:
  - unit tests: each achievement fires once and only on a real game; unlocks grant the cosmetics and coins; migration 9 → 10 keeps everything; race threshold reached by the "normal player" model in 3–5 tries → pass
  - `E2E_PORT=<free> pnpm e2e <the castle spec> <the race spec> --workers=1 -g "logro|mascota"` (win Tormenta via `vencer=1` in an e2e build where shortcuts give prizes: Cañoncito owned; race finish: «Primera regata») → exit 0
  - Test command → exit 0
- Outcome:

## T178 — Close: balance, performance, full e2e, docs, Álvaro draft
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T168, T169, T170, T171, T172, T173, T174, T175, T176, T177
- Goal: Close the plan.
  - **Balance with bots** on path v2 with upgrades, priorities and the castle upgrade, 3 lengths × 3 difficulties: Tranquila winnable with a plain build, Normal a real fight, Tormenta hard; Halloween no longer holds short Tormenta runs alone; no single strategy dominates; ×2 and «Llamar oleada» do not break it; bump `DEFENSE_CONFIG_VERSION` if numbers changed.
  - **Performance in `baja`** at the 10-min peak with bars and numbers on, clouds and the new Vecino; fix obvious hot spots only.
  - **E2E**: the castle spec and the **full suite** (`E2E_PORT=<free> pnpm e2e --workers=2`), both exit 0.
  - **Docs**: `docs/spec/estado.md`, `ESTADO.md` via the status fragment, a Spanish test guide `docs/propuestas/<date>-castillo-v2-guia-prueba.md` with an empty «Notas» section, and a Spanish **decision draft for Álvaro** `docs/propuestas/<date>-premios-mascotas-decision-alvaro.md` (the moved lighthouse and board, castle v2, the new Vecino, the two mascots and the wake with their names, the new achievements and prize amounts) — not in `docs/DECISIONES.md`.
- Context: all Outcomes, Decisions and Proposals of this plan; `python3 tools/spec/estado.py`.
- Scope: may touch `packages/engine/src/defense/**` (balance, bot tests), `apps/web/e2e/**`, small perf/stability fixes in `apps/web/app/mar/**`, `docs/spec/estado.md`, `docs/propuestas/` / must not touch `docs/DECISIONES.md`, the Cañón's balance, features beyond fixes.
- Done when:
  - `pnpm exec vitest run packages/engine/src/defense --testTimeout=60000` and the slow suites command → exit 0
  - `E2E_PORT=<free> pnpm e2e --workers=2` → exit 0
  - `PYTHONUTF8=1 python3 tools/spec/estado.py` → exit 0
  - Test command → exit 0
- Outcome:

## Decisions
- 2026-10-06 plan: header decisions 1–18 from Hernán's notes and answers (plans/015-notes.md at 15902e7); plane never leaves the arena and the widest camera view is the current arena view (decision 3); the guide asks before the first game and can be skipped with one button (decision 14) (Hernán)
- 2026-10-06 plan: T177 runs first because renormalizing line endings while other agents edit the same files causes conflicts; ×2 and «Llamar oleada» allowed in ranked games; calling a wave early gives a small coin bonus; health bars and damage numbers are drawn in T170 so the pause toggles have something to switch; prize amounts `muestra` (orchestrator, shown to Hernán)

## Proposals (new scope)

## Log
- 2026-10-06 drafted in the session with Hernán from plans/015-notes.md
- 2026-10-06 approved by Hernán ("Lanza el plan"); notes file folded in and removed (6bc5660)
- 2026-10-06 T177 launched · attempt 1 · Codex via wrapper agent a48cab710434cc27a (sonnet)
- 2026-10-06 T174 launched · attempt 1 · agent ac27231ba67787e7f (fable)
