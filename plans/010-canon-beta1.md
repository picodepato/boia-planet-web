# Plan 010 — Cañón «Que no pare la música», BETA 1 (feel)

Status: active
Created: 2026-10-04
Base branch: main
Goal: Answer one question: is it fun to dodge a swarm with the boat in the 3D sea? The Cañón minigame stops being a separate 2D scene and becomes a Vampire-Survivors-like mode played in the same `/mar` world where the boat is (same pattern as Los Rápidos), shipped to production with a «BETA» label, playable end to end with little content: 2 enemies (piranhas, armoured crab), the water cannon, music notes with merge and magnet, a 1-of-3 level-up card, «water on board» as health, 7:00 to win or flooded to lose. The simulation is pure and deterministic in `packages/engine/src/survivors/` and its architecture is born ready for everything in the design reference (more enemies, weapons, vinyls, evolutions, bosses, campaign, medals, ranking) without building it yet. At the end Hernán tunes the feel (handling, camera, defeat style) with a test guide.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task (this machine is Windows 10, Git Bash): the two `packages/db` suites need a local Postgres that this machine does not have, hence the exclude; `PYTHONUTF8=1` makes the Python checks read UTF-8; if a guard blocks the chained test command, run its steps one by one. E2E: `E2E_PORT=<free port> pnpm e2e <spec files> --workers=1` (first time in a worktree: `pnpm --filter @boia/web exec playwright install chromium`); the machine is slow under load, rerun only failing specs; the full e2e run is done once by the orchestrator at the end of the plan, never per task. UI strings only by key in `apps/web/lib/i18n/`, never loose strings in components. Content (names, texts, point amounts) stays `muestra`. Never commit `apps/web/public/atlas/`, `.claude/launch.json` or any `.env*` file other than `.env.example`. Never push or deploy. Never edit `docs/DECISIONES.md`. Local mode (D-20, no Supabase env vars) must keep working exactly as today; Supabase mode must not break. Skills: each task's block names the skills it may invoke with the Skill tool; invoke none other. Every task runs on Opus 5.5.

**Required reading for every task:** `docs/propuestas/2026-10-04-canon-survivors.md` (the full design reference of the mode; this beta builds only part of it, but every structure must be ready for the rest) and `docs/propuestas/2026-10-04-plan-009-beta1.md` (what beta 1 includes and excludes). Where this plan and those documents disagree, this plan wins.

**Numbering (Hernán, 2026-10-04):** a parallel Codex plan, `plans/009-world-updates.md` (branch `codex/world-updates`), owns plan number 009 and tasks T98–T115. This plan became **010** and its remaining tasks were renumbered T116–T119; its first task keeps the id **T98** (commit ab1bd6b) as history. Status fragments or commits that say "plan 009 T99" belong to T116. Later Cañón betas are plans 011, 012…, not 010, 011… as the design reference says.

Decisions of 2026-10-04 that every task follows (interview, Hernán):
1. **Five serial tasks**, because almost everything goes through `apps/web/app/mar/mar-client.tsx` and `apps/web/app/mar/engine/mar3d.ts`: T98 simulation → T116 entering/leaving in `/mar` → T120 merge of the Codex world updates → T117 models, notes and defeat styles → T118 HUD, cards, pause and end → T119 removing the 2D canon, session/reward, e2e, docs and the test guide.
2. **Dev shortcuts** (`?minijuego=canon&t=<s>&seed=<n>`, the `defeatStyle` switch, any tuning helper) are always on in `pnpm dev` and in the e2e server, and in a production build only when the URL carries `?dev=1` (no visible link to it). One helper decides this for the whole mode. They stay for the whole beta and are removed at launch (plan 013).
3. Out of scope for the whole plan (later betas): the other 4 enemies, elites, Marea, difficulties; the other 6 weapons, vinyls, evolutions, chest, Salvavidas; minibosses, bosses, campaign, medals; the pre-game pop-up, ranking, full HUD; reward per medal, new achievements, mascot, «El Apagón»; music (synth effects with `packages/engine/src/minigames/sound.ts` only if time allows); any change to the Faro.
4. The reward stays as today (150 pts + 50 coins, once per season) in local and Supabase mode; session result `won` = surviving 7:00; achievements `canon` and `guardacostas` keep working the same.

## Tasks

## T98 — Survivors simulation in `packages/engine/src/survivors/` with seed tests
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: none
- Goal: The pure, deterministic simulation of the mode, with no three.js and no DOM, that T116–T119 render and wire. It must contain:
  - A fixed 1/60 s step: `create(config, seed, world)` + `step(input)` (input = the same steering input the boat uses today, plus level-up choice and pause commands), a read-only snapshot for rendering (player, enemies by type, projectiles, notes, water level, XP/level, time left, pending card) and an event list per step (hit, enemy defeated with position and type, note picked, level up, end with reason). Same seed + same inputs = identical game (assert it by hashing the state).
  - **One versioned config** (`survivors/config.ts` or similar) with all the balance, structured for the full catalogues of the design (enemies, weapons, vinyls/passives, evolutions, per-act script, bosses, upgrades) even if only beta 1's entries exist now; `version` + a stable hash so the session's `configHash` covers it. It also holds the in-game boat handling overrides (more turn, less inertia), the camera overrides (~25 % farther, a bit higher), `defeatStyle: 'puf' | 'sumergirse'`, the enemy caps per `QualityTier` (~150 `alta`, ~60 `baja`) and caps for projectiles and notes.
  - The player boat moves with **the same ship controller** as `/mar` (`packages/engine/src/ship/controller.ts`, `stepShip`) using the handling overrides.
  - **Wrapped sea**: every distance and collision uses the nearest copy (as `/mar` does). If the wrap math lives only in `apps/web/app/mar/engine/wrap.ts`, move its pure part into `packages/engine` and re-export it from the old path so nothing else changes.
  - **Island collision shared with the boat**: reuse `collideShip`/`collideWrapped` and `collisionRuleOf` (`packages/engine/src/world/runtime.ts`); if they need a small refactor to serve enemies too, do it without changing the boat's behaviour (its tests must pass unchanged). Enemies go around islands with simple steering + sliding along the outline, no pathfinding.
  - **Ring spawning** around the player outside the camera on all sides, validated against islands (if it lands on land it is moved to water); far-away enemies are recycled near; the quality cap is respected (when reached, the wave grows in strength instead of count).
  - **A spatial grid** for every collision (enemies, projectiles, notes, islands).
  - **2 enemies**: piranhas (fast, weak swarm) and armoured crab (slow tank). Contact damage; ~0.5 s of invulnerability after a hit.
  - **Water cannon**: fires by itself at the nearest enemy; a straight projectile that **islands block**.
  - **Music notes** dropped by enemies, valued by figure (corchea < negra < blanca < redonda), **merging** of nearby notes into a higher one, **magnet** pickup radius.
  - **Level up**: the game pauses and offers 1 of 3 cards from a handful of provisional upgrades (damage, fire rate, +1 cannon projectile, boat speed, magnet, bailing/regeneration), each with a fixed, explicit effect a card can describe (data, with an i18n key per upgrade).
  - **Water on board** (health): hits fill it; full = flooded = defeat. Bailing lowers it over time.
  - **The script as data**: a simple 7-minute curve for these 2 enemies (more and stronger over time), in the shape the design's per-act script will need.
  - **Pause and active time**: the sim only advances on active steps; it tracks active time and pause time (tab hidden, manual pause, open level-up card all count as pause); a pause longer than 5 minutes ends the game with reason `abandoned` (no reward). Expose this as a small clock the web layer feeds with real time.
  - Ending: `survived` at 7:00 of active time, `flooded`, `abandoned`.
  - A way to start at a given time `t` (for the dev shortcut `&t=`), deterministic for a seed.
- Context: the two required docs in the header; `packages/engine/src/ship/controller.ts`, `packages/engine/src/world/runtime.ts` (`collisionRuleOf`), `packages/engine/src/world/sectors.ts` (`QualityTier`), `packages/engine/src/circuit/` (how the race keeps its pure logic, config and tests: the pattern to follow), `packages/engine/src/minigames/rng.ts` (seeded RNG, `configHash`), `session.ts`; `apps/web/app/mar/engine/wrap.ts` and `wrap.test.ts`; the engine package's `index.ts`/exports.
- Scope: may touch `packages/engine/src/survivors/**` (new), `packages/engine/src/index.ts` (exports), a minimal non-behavioural refactor of `packages/engine/src/ship/controller.ts` / `world/runtime.ts` / `apps/web/app/mar/engine/wrap.ts` to share code / must not touch `apps/web` UI, the 2D canon, `minigames/registry.ts`, `session.ts` behaviour, `docs/DECISIONES.md`.
- Done when:
  - `pnpm exec vitest run packages/engine/src/survivors` → exit 0, with tests proving: determinism (two runs with the same seed and input script give the same state hash; a different seed differs); the enemy cap per quality is never exceeded over a full accelerated 7:00 game; no enemy or note ever spawns or stands on land over full games on several seeds; the game ends `survived` at exactly 7:00 of active time; a no-dodge input ends `flooded`; a 5:01 pause ends `abandoned` and pause time never counts as active; islands block cannon projectiles; notes merge and the magnet pulls; a level-up stops the clock until a card is chosen; `t=` start is deterministic
  - the existing ship, world and wrap tests pass unchanged (part of the Test command)
  - Test command → exit 0
- Outcome: pure sim in `packages/engine/src/survivors/` (subpath `@boia/engine/survivors`), versioned config, wrap math moved to `engine/world/wrap.ts` (web re-exports), shared `pushOutWrapped` island collision, grid, 2 enemies, cannon, notes, cards, water, pause clock; 30 tests; default `defeatStyle: sumergirse` → ab1bd6b

## T116 — The mode inside `/mar`: start and end in the same world, hiding, race lock, handling, camera, dev shortcuts
- Status: running (attempt 1)
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T98
- Goal: Run T98's simulation inside the live `/mar` world, the same way Los Rápidos does.
  - Starting: the Cañón island panel's play action starts the 3D mode **where the boat is** (it no longer opens the 2D `MinigameLayer` for `canon`; the Faro keeps its 2D flow untouched). The world returns at the end with the boat where it finished.
  - During the game, hide/disable: the yellow guide lines (`setRouteHidden`), island panels/sheets and their auto-open, bottles, hidden discounts and encounters (crocodiles, dolphin…); the minimap shows islands but no common enemies. All come back at the end.
  - **Cannot start during the race**: the panel explains why (i18n key). If the **Boia Fiestera is on board** she stays on board and the mission continues afterwards.
  - Boat handling uses the config's overrides during the game and is restored at the end; the camera moves ~25 % farther and a bit higher (config values) and returns smoothly at the end.
  - Rendering bridge: step the sim at its fixed step from the render loop, feed the boat input to it, and draw enemies/projectiles/notes with **simple placeholder instanced meshes** (T117 replaces them with the real provisional models). The quality tier `/mar` uses picks the cap.
  - Tab hidden = automatic pause (feed T98's clock); a pause over 5 minutes ends the game and returns the world. For now the end just returns to the world (T118 adds the end screen; leave a clear hook).
  - **Dev shortcuts** (header decision 2): `?minijuego=canon&t=<s>&seed=<n>` starts the mode directly at that time with that seed; one helper `devShortcutsEnabled()` (dev, e2e, or `?dev=1` in production) gates every shortcut of the mode. Also expose a stable DOM/test hook of the game state (e.g. `data-*` attributes: running, time left, water, level, enemy count, end reason) that the e2e of T119 can read, following how the race exposes its state to e2e.
  - Add focused e2e coverage for entering, the race lock and returning to the world (new spec, e.g. `apps/web/e2e/mar-canon.spec.ts`; T119 extends it).
- Context: the header and its required docs; T98's Outcome; `apps/web/app/mar/mar-client.tsx` (race wiring: `newRace`, `raceEvents`, `setRouteHidden`, `raceAgain`; `minigameOffer`/`minigameOpen`; the Fiestera mission around `setPassenger`), `apps/web/app/mar/carrera.tsx`, `apps/web/app/mar/race.ts`, `apps/web/app/mar/engine/mar3d.ts` (`setRouteHidden`, `setBottles`, `stepShip`, `updateCamera`), `apps/web/app/mar/engine/framing.ts`, `apps/web/lib/mundo/minigame-layer.tsx`, `apps/web/lib/mundo/mission.ts`, the minimap component, how `/mar` picks its `QualityTier`, how `?ir=canon` / existing dev query params work, T98's Outcome note that the i18n keys `survivors.upgrade.*` referenced by the config do not exist yet (add them in `apps/web/lib/i18n/`), `apps/web/e2e/` race and minigame specs and their helpers.
- Scope: may touch `apps/web/app/mar/**` (new `survivors*` files encouraged; keep `mar-client.tsx` changes as thin wiring), `apps/web/lib/mundo/**` where the canon mount or hiding lives, i18n keys in `apps/web/lib/i18n/`, `packages/engine/src/survivors/**` (fixes only, with tests), new e2e spec / must not touch the 2D canon files (T119 removes them), the Faro, session/rewards, `docs/DECISIONES.md`.
- Done when:
  - unit tests cover the dev-shortcut gate (dev / e2e / `?dev=1` / production without it) and the hide/restore list (everything hidden at start is restored at end)
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts <the race and Fiestera specs> --workers=1` → exit 0, proving: starting from the Cañón panel enters the mode with guide lines hidden; `?minijuego=canon&t=<s>&seed=<n>` starts at that time; the panel refuses to start during a race; at the end the world is back with the boat where it finished; existing race and Fiestera specs still pass
  - Test command → exit 0
- Outcome:

## T120 — Merge the Codex world updates (`codex/world-updates`) into main
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T116
- Goal: Bring the parallel Codex plan's finished work into main now (Hernán, 2026-10-04), so the Cañón tasks build on it. In this worktree run `git merge --no-ff --no-edit <SHA>` where `<SHA>` is the tip of branch `codex/world-updates` **at the moment you start** (record it; the Codex checkout is `C:/Users/alvar/.codex/worktrees/0b17/boia-planet-hernan`, its branch lives in this same repository; read-only there: never commit, check out or edit anything in that checkout or its worktrees). Resolve every conflict keeping both intents: Codex's world updates (typography, 15-knot cruising and manual objective navigation, characters, landmarks, fish and gulls, merchandise, Carnet questions, and whatever else its plan marks done) and the Cañón mode from T98/T116 (survivors wiring in `mar-client.tsx`/`mar3d.ts`, hiding of route lines, bottles, discounts and encounters during the game, the race lock, camera and handling overrides). In particular: the Cañón's handling overrides must still apply on top of the new ship config (express them relative to the boat's current config if they were absolute, and keep the survivors tests green); everything Codex added to the world that is interactive (new encounters, fish, gulls, characters, secrets, markers) must be hidden/disabled during a Cañón game and restored after, like the rest of T116's hide list. Codex tasks still running or pending in its plan (T105–T115) are **not** part of this merge; do not try to finish them. Do not edit `plans/009-world-updates.md` beyond what the merge brings.
- Context: `plans/009-world-updates.md` (as merged: its Goal, the Outcomes of its done tasks), T98 and T116 Outcomes in this plan, `apps/web/app/mar/mar-client.tsx`, `apps/web/app/mar/engine/mar3d.ts`, `apps/web/app/mar/minimap.tsx`, `packages/engine/src/ship/config.ts` and its tests, `packages/engine/src/survivors/`, T116's hide/restore list and its tests, `apps/web/e2e/` specs of both lines.
- Scope: may touch any file the merge brings or conflicts on, plus the minimal fixes to make both lines work together (with tests) / must not touch the Codex checkout or its worktrees, `docs/DECISIONES.md`; no new features.
- Done when:
  - `git log -1 --format=%P` on the merge commit lists main's tip and the recorded `codex/world-updates` SHA; `git status` clean
  - unit tests prove the hide/restore list covers Codex's new interactive world elements and the survivors handling overrides compose with the new ship config
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts <the race, Fiestera, and the e2e specs the Codex branch added or changed> --workers=1` → exit 0
  - Test command → exit 0
- Outcome:

## T117 — Provisional models, notes on the water and the two defeat styles
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T116, T120
- Goal: Replace T116's placeholders with the beta's look.
  - `apps/web/app/mar/engine/survivors-props.ts`: simple low-poly models made in code in the style of `race-props.ts` (`Kit`, palette `C`): piranha, armoured crab, the water-cannon ball, and the music notes by figure (corchea, negra, blanca, redonda) visible on the water. One `InstancedMesh` per type, sized to the config cap; unmistakable silhouette and colour, readable on mobile with the farther camera.
  - **Both defeat styles**, chosen by `defeatStyle` in the config: `puf` (one shared, cheap, batched particle/sprite animation, small and striking) and `sumergirse` (the enemy jumps or sinks with a small splash, no wounds shown, compatible with REQ-AVE-037). A **dev-only switch** (gated by T116's helper) toggles them live to compare.
  - Hit feedback on the boat: ~0.5 s blink during invulnerability, **no blink with reduced motion**; reduced motion also uses a reduced defeat effect and no camera shake.
  - Performance: no per-frame allocations in the render path; the `baja` tier keeps its cap and cheaper effects.
- Context: the header and its required docs; T98 and T116 Outcomes; `apps/web/app/mar/engine/race-props.ts` (+ test), `kit.ts`, `palette.ts`, `mar3d.ts`, T116's survivors rendering bridge; how `/mar` reads reduced motion today.
- Scope: may touch `apps/web/app/mar/engine/survivors-props.ts` (new) and its test, T116's survivors files, `mar3d.ts` hooks for them, i18n keys for the dev switch if it shows text / must not touch the race props' behaviour, the HUD (T118), session/rewards, the 2D canon, `docs/DECISIONES.md`.
- Done when:
  - unit tests prove: each enemy type and each note figure builds one instanced mesh with the cap's count; both defeat styles are selectable from the config and the dev switch; reduced motion disables the blink and uses the reduced effect
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0
  - Test command → exit 0
- Outcome:

## T118 — HUD, water bar, level-up cards, pause with the `/mar` menu, end screen, BETA label
- Status: pending
- Model: opus (Opus 5.5)
- Skills: frontend-design
- Depends on: T117
- Goal: The minimum interface of the beta, in the style of the race chips (`carrera.tsx`), all text by key in `apps/web/lib/i18n/`.
  - HUD at the top centre: countdown 7:00 → 0:00 and the XP bar with the level above it; a visible **«BETA»** label in the HUD and on the Cañón island panel.
  - **Water-on-board bar under the boat** (VS style): a pattern as well as colour, a minimum readable size with the farther camera, on desktop and mobile; it follows the boat.
  - **Level-up cards**: big 1-of-3 cards, touch-friendly and keyboard-operable (arrows/numbers + Enter, focus management), each saying exactly what it gives; while open the game is paused (T98's clock counts it as pause).
  - **Manual pause** (a button and Esc) opens the **normal `/mar` menu**; closing it resumes. The menu warns that leaving the page (e.g. to Tickets) ends the game. The 5-minute pause limit ends the game with a short message and returns the world.
  - **End screen**: victory «¡Amanece!» or defeat «¡Barco inundado!» with time, enemies defeated and notes, buttons «Otra vez» (new game where the boat is) and «Volver al mar» (world returns with a short fade).
  - Basic accessibility: reduced motion (no shake, no flashing), keyboard, large touch areas, nothing blocks the Tickets link, mobile layout that does not collide with the boat's touch controls.
- Context: the header and its required docs; T98–T117 Outcomes; `apps/web/app/mar/carrera.tsx` (chips, intro, result card), `apps/web/app/mar/menu.tsx` + `apps/web/lib/mundo/menu/`, `apps/web/lib/i18n/es-mar.ts` / `es-juego.ts`, the Cañón island panel component, REQ-AVE-039 in `docs/spec/`.
- Scope: may touch `apps/web/app/mar/**` (new survivors UI components encouraged), `apps/web/lib/mundo/menu/**` for the warning, i18n files, T116/T117 survivors files for hooks, e2e spec `mar-canon.spec.ts` / must not touch session/rewards, the 2D canon, the race UI's behaviour, `docs/DECISIONES.md`.
- Done when:
  - unit tests for the cards' keyboard handling and the countdown/water formatting
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, extended to: HUD with BETA, countdown and level visible; a level-up card can be chosen by keyboard and by tap; Esc opens the `/mar` menu with the leave warning and closing it resumes; the end screen shows and «Volver al mar» returns the world; on a mobile viewport the HUD, water bar and cards are visible and do not cover the Tickets link
  - Test command → exit 0
- Outcome:

## T119 — Remove the 2D canon, session and reward, full e2e of the mode, docs and the beta test guide
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T118
- Goal: Close the beta.
  - **Remove the 2D canon**: `packages/engine/src/minigames/canon.ts`, its part of `minigames.test.ts` and of `apps/web/e2e/minijuegos.spec.ts`. `canon` stays in the minigame registry only for its id, session, validation, rewards and the `win_minigame` signal; it is no longer mounted with `host.ts`/`mountMinigame`. **The Faro 2D is untouched** and keeps working.
  - **Session**: the 3D mode opens and closes a minigame session (`session.ts`) with a new config version whose `configHash` covers T98's config; result `won` = survived 7:00; the validation checks **active time**, not wall time (a technical adjustment of REQ-AVE-038 for this game, documented). The reward stays 150 pts + 50 coins once per season, in local mode and in Supabase mode (check the RPC/server validation accepts the new config version and durations; adjust a migration only if strictly needed and say so). Achievements `canon` and `guardacostas` keep working the same; the `win_minigame` signal fires on a win.
  - **e2e** of the mode with the dev shortcuts, desktop and mobile: enter, die (flooded), survive (start near the end with `&t=`), pause, return to the world, lock during the race, reward granted once. Remove or update every e2e that relied on the 2D canon.
  - **Docs**: `ESTADO.md` is written through the status fragment; `docs/spec/estado.md` updated for the REQs this plan moved (REQ-MUN-026, REQ-AVE-037, REQ-AVE-038 and any other), each with its test (`python3 tools/spec/estado.py` must pass), noting that REQ-AVE-037 and 038 remain pending the final decision (puf vs sumergirse needs Álvaro; active-time validation). `docs/TRASPASO.md`: the new mode in beta. Never edit `docs/DECISIONES.md`. In `docs/propuestas/2026-10-04-canon-survivors.md` update the roadmap's plan numbers (beta 1 = plan 010, beta 2 = 011, … launch = 014), since the Codex plan took 009.
  - **Beta 1 test guide for Hernán** in `docs/propuestas/2026-10-04-canon-beta1-guia-prueba.md` (Spanish): how to enable the shortcuts locally and in production (`?dev=1`), the `t`/`seed` parameters, the defeat-style switch, exactly which config values to touch for handling and camera (file and field names), and the six questions to answer: dodging feel (more/less turn and inertia); whether the camera shows enemies coming, also on mobile; `puf` or `sumergirse`; whether islands work as cover or enemies get stuck; whether the level-up and notes rhythm hooks; performance on a mid-range phone at the enemy cap. Answers are saved as notes and feed plan 011's interview.
- Context: the header and its required docs; T98–T118 Outcomes; `packages/engine/src/minigames/` (`canon.ts`, `host.ts`, `registry.ts`, `types.ts`, `controller.ts`, `session.ts`, `rewards.ts`, `rng.ts`, `minigames.test.ts`), `apps/web/lib/mundo/minigame-layer.tsx`, `apps/web/e2e/minijuegos.spec.ts`, `apps/web/e2e/mar-canon.spec.ts`; achievements (`canon`, `guardacostas`) in `packages/store`; Supabase reward path (`supabase/migrations/20261003100100_economy.sql`, `packages/db/src/supabase/economy.supabase.ts`); `docs/spec/estado.md`, `tools/spec/estado.py`, `docs/TRASPASO.md`, `README.md`.
- Scope: may touch `packages/engine/src/minigames/**`, `packages/engine/src/survivors/**` (fixes), `apps/web/app/mar/**` survivors files and their wiring, `apps/web/lib/mundo/**`, `packages/store/**` only if achievements need it, `supabase/migrations/**` (new migration only if strictly needed), `apps/web/e2e/**`, `docs/spec/**`, `docs/TRASPASO.md`, `README.md`, `docs/propuestas/2026-10-04-canon-beta1-guia-prueba.md`, `docs/propuestas/2026-10-04-canon-survivors.md` (roadmap numbers only) / must not touch the Faro's behaviour, `docs/DECISIONES.md`.
- Done when:
  - `pnpm exec vitest run packages/engine/src/minigames packages/engine/src/survivors packages/store` → exit 0, with tests that a survived session validates and grants the reward once per season, an impossible active time is rejected, and the Faro's tests are untouched and passing
  - `grep -rn "minigames/canon" packages apps --include=*.ts --include=*.tsx` → no matches
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts minijuegos.spec.ts <the achievement/reward specs that touch canon> --workers=1` → exit 0, desktop and mobile projects
  - `python3 tools/spec/estado.py` → exit 0
  - Test command → exit 0
- Outcome:

## Decisions
- 2026-10-04 plan: five serial tasks instead of the prompt's four (T116 split into world integration and models/defeat styles) (Hernán)
- 2026-10-04 plan: dev shortcuts also in production behind `?dev=1` for the beta (Hernán)
- 2026-10-04 plan: only T118 may use the frontend-design skill (Hernán)
- 2026-10-04 setup: design docs committed (c23cdff); the identical root copy of the design was deleted (Hernán)

- 2026-10-04 T98: `./survivors` subpath in engine package.json; wrap math moved to `packages/engine/src/world/wrap.ts`, re-exported by `ship/controller.ts` and `apps/web/app/mar/engine/wrap.ts` with the same names (agent)
- 2026-10-04 T98: `collideWrapped` calls a new exported `pushOutWrapped` (same arithmetic); enemies/notes use it with restitution 0 to slide; islands = `solidObstaclesOf` (`collisionRuleOf`) plus /mar's extra solid circles (agent)
- 2026-10-04 T98: enemy grid cell 24, max 6 neighbours (~0.1 ms/step at 150 enemies); `defeatStyle` default `sumergirse`; `t=` start gives 2.5 seeded levels per minute and pre-fills 12 s of script; `spawnEnemy`/`spawnNote`/`onLand` helpers for tests and dev (agent)
- 2026-10-04 T116: context extended with T98's note on missing `survivors.upgrade.*` i18n keys (orchestrator)

- 2026-10-04 plan: renumbered to plan 010, tasks T116–T119 (the Codex plan 009 owns T98–T115); T98 keeps its id as history (Hernán)
- 2026-10-04 plan: new task T120 merges `codex/world-updates` into main after T116 and before T117 (Hernán chose integrating Codex now; Codex's later work must merge main before it lands)

## Proposals (new scope)
- 2026-10-04 T98: balance untested by hand: with no dodging the boat floods in under a minute; tune after Hernán's test (plan 010 input)

## Log
- 2026-10-04 13:52 T98 launched · attempt 1 · agent a7dd71bedac7f77e0
- 2026-10-04 14:16 T98 done · branch worktree-agent-a7dd71bedac7f77e0 → ab1bd6b
- 2026-10-04 14:17 T116 (launched as T99) launched · attempt 1 · agent a807676a5504162cf
