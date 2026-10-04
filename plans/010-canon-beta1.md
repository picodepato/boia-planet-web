# Plan 010 — Cañón «Que no pare la música», BETA 1 (feel)

Status: active
Created: 2026-10-04
Base branch: main
Goal: Answer one question: is it fun to dodge a swarm with the boat in the 3D sea? The Cañón minigame stops being a separate 2D scene and becomes a Vampire-Survivors-like mode played in the same `/mar` world where the boat is (same pattern as Los Rápidos), shipped to production with a «BETA» label, playable end to end with little content: 2 enemies (piranhas, armoured crab), the water cannon, music notes with merge and magnet, a 1-of-3 level-up card, «water on board» as health, 7:00 to win or flooded to lose. The simulation is pure and deterministic in `packages/engine/src/survivors/` and its architecture is born ready for everything in the design reference (more enemies, weapons, vinyls, evolutions, bosses, campaign, medals, ranking) without building it yet. At the end Hernán tunes the feel (handling, camera, defeat style) with a test guide. Since 2026-10-04 this plan also merges the Codex world updates (T120) and runs the Codex plan 009's pending tasks (T105, T108–T115: Puerto de Alicante, race-only 22 knots, Blender Benidorm and Ibiza, the main route, menu icons, the castaway achievement, final regression), so a single orchestrator owns `/mar`.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task (this machine is Windows 10, Git Bash): the two `packages/db` suites need a local Postgres that this machine does not have, hence the exclude; `PYTHONUTF8=1` makes the Python checks read UTF-8; if a guard blocks the chained test command, run its steps one by one. E2E: `E2E_PORT=<free port> pnpm e2e <spec files> --workers=1` (first time in a worktree: `pnpm --filter @boia/web exec playwright install chromium`); the machine is slow under load, rerun only failing specs; the full e2e run is done once by the orchestrator at the end of the plan, never per task. UI strings only by key in `apps/web/lib/i18n/`, never loose strings in components. Content (names, texts, point amounts) stays `muestra`. Never commit `apps/web/public/atlas/`, `.claude/launch.json` or any `.env*` file other than `.env.example`. Never push or deploy. Never edit `docs/DECISIONES.md`. Local mode (D-20, no Supabase env vars) must keep working exactly as today; Supabase mode must not break. Skills: each task's block names the skills it may invoke with the Skill tool; invoke none other. Every task runs on Opus 5.5 unless its block says Model: codex.

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
- Status: done
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
- Outcome: Cañón 3D mode runs in /mar from the panel or `?minijuego=canon&t=&seed=`; world hidden/blocked during play and restored; race lock; handling/camera overrides; `devShortcutsEnabled()` (dev, `navigator.webdriver`, `?dev=1`); data-* test hooks; 24 e2e passed → b845582

## T120 — Merge the Codex world updates (`codex/world-updates`) into main
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T116
- Goal: Bring the parallel Codex plan's finished work into main now (Hernán, 2026-10-04), so the Cañón tasks build on it. In this worktree run `git merge --no-ff --no-edit 608f883` (the tip of branch `codex/world-updates`, Codex's T98–T104; the Codex checkout is `C:/Users/alvar/.codex/worktrees/0b17/boia-planet-hernan`, its branch lives in this same repository; read-only there: never commit, check out or edit anything in that checkout or its worktrees). Resolve every conflict keeping both intents: Codex's world updates (typography, 15-knot cruising and manual objective navigation, characters, landmarks, fish and gulls, merchandise, Carnet questions, and whatever else its plan marks done) and the Cañón mode from T98/T116 (survivors wiring in `mar-client.tsx`/`mar3d.ts`, hiding of route lines, bottles, discounts and encounters during the game, the race lock, camera and handling overrides). In particular: the Cañón's handling overrides must still apply on top of the new ship config (express them relative to the boat's current config if they were absolute, and keep the survivors tests green); everything Codex added to the world that is interactive (new encounters, fish, gulls, characters, secrets, markers) must be hidden/disabled during a Cañón game and restored after, like the rest of T116's hide list. Codex's unfinished tasks (T105–T115, including the uncommitted T106/T107 work in its worktrees) are **not** part of this merge: plan 010 absorbed them as its own tasks; do not start them. Do not edit `plans/009-world-updates.md` beyond what the merge brings.
- Context: `plans/009-world-updates.md` (as merged: its Goal, the Outcomes of its done tasks), T98 and T116 Outcomes in this plan, `apps/web/app/mar/mar-client.tsx`, `apps/web/app/mar/engine/mar3d.ts`, `apps/web/app/mar/minimap.tsx`, `packages/engine/src/ship/config.ts` and its tests, `packages/engine/src/survivors/`, T116's hide/restore list and its tests, `apps/web/e2e/` specs of both lines.
- Scope: may touch any file the merge brings or conflicts on, plus the minimal fixes to make both lines work together (with tests) / must not touch the Codex checkout or its worktrees, `docs/DECISIONES.md`; no new features.
- Done when:
  - `git log -1 --format=%P` on the merge commit lists main's tip and 608f883; `git status` clean
  - unit tests prove the hide/restore list covers Codex's new interactive world elements and the survivors handling overrides compose with the new ship config
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts <the race, Fiestera, and the e2e specs the Codex branch added or changed> --workers=1` → exit 0
  - Test command → exit 0
- Outcome: codex/world-updates 608f883 merged (squashed); new hide layers `objective` and `wildlife`; handling overrides are scale factors so the game boat cruises at 15 kn; one pins effect; 1193 unit tests; race medal e2e left failing for T109 → c5c6339

## T117 — Provisional models, notes on the water and the two defeat styles
- Status: done
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
- Outcome: `survivors-props.ts` with instanced piranha, crab, ball and 4 note figures; `puf` and `sumergirse` with pooled effects; dev switch button «Derrota: …» + `&derrota=`; blink/shake off with reduced motion; 1211 unit tests, mar-canon e2e 10 passed → 88c9ab3

## T118 — HUD, water bar, level-up cards, pause with the `/mar` menu, end screen, BETA label
- Status: done
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
- Outcome: HUD chips with BETA, countdown and XP/level; striped water bar under the boat; ticket-style 1-of-3 cards (keys 1–3/arrows/Enter, 350 ms guard); any sheet/menu pauses; menu leave warning; end screen «¡Amanece!»/«¡Barco inundado!» with «Otra vez»/«Volver al mar»; BETA badge on the panel; 1222 unit tests, mar-canon e2e 20 passed → b625169

## T119 — Remove the 2D canon, session and reward, full e2e of the mode, docs and the beta test guide
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T118
- Goal: Close the beta.
  - **Remove the 2D canon**: `packages/engine/src/minigames/canon.ts`, its part of `minigames.test.ts` and of `apps/web/e2e/minijuegos.spec.ts`. `canon` stays in the minigame registry only for its id, session, validation, rewards and the `win_minigame` signal; it is no longer mounted with `host.ts`/`mountMinigame`. **The Faro 2D is untouched** and keeps working.
  - **Session**: the 3D mode opens and closes a minigame session (`session.ts`) with a new config version whose `configHash` covers T98's config; result `won` = survived 7:00; the validation checks **active time**, not wall time (a technical adjustment of REQ-AVE-038 for this game, documented). The reward stays 150 pts + 50 coins once per season, in local mode and in Supabase mode (check the RPC/server validation accepts the new config version and durations; adjust a migration only if strictly needed and say so). Achievements `canon` and `guardacostas` keep working the same; the `win_minigame` signal fires on a win.
  - **e2e** of the mode with the dev shortcuts, desktop and mobile: enter, die (flooded), survive (start near the end with `&t=`), pause, return to the world, lock during the race, reward granted once. Remove or update every e2e that relied on the 2D canon.
  - **Docs**: `ESTADO.md` is written through the status fragment; `docs/spec/estado.md` updated for the REQs this plan moved (REQ-MUN-026, REQ-AVE-037, REQ-AVE-038 and any other), each with its test (`python3 tools/spec/estado.py` must pass), noting that REQ-AVE-037 and 038 remain pending the final decision (puf vs sumergirse needs Álvaro; active-time validation). `docs/TRASPASO.md`: the new mode in beta. Never edit `docs/DECISIONES.md`. In `docs/propuestas/2026-10-04-canon-survivors.md` update the roadmap's plan numbers (beta 1 = plan 010, beta 2 = 011, … launch = 014), since the Codex plan took 009.
  - **Beta 1 test guide for Hernán** in `docs/propuestas/2026-10-04-canon-beta1-guia-prueba.md` (Spanish): how to enable the shortcuts locally and in production (`?dev=1`), the `t`/`seed` parameters, the defeat-style switch, exactly which config values to touch for handling and camera (file and field names), and a note that since T120 the boat cruises at 15 knots and piranhas (150 u/s) now match its top speed, so escape is much harder (first knob to try), and the six questions to answer: dodging feel (more/less turn and inertia); whether the camera shows enemies coming, also on mobile; `puf` or `sumergirse`; whether islands work as cover or enemies get stuck; whether the level-up and notes rhythm hooks; performance on a mid-range phone at the enemy cap. Answers are saved as notes and feed plan 011's interview.
- Context: (from T118: the `onEnd` hook for session and reward fires when the game ends, not when the world returns; no e2e yet for the 5-minute pause abandon (add one with the dev shortcuts); REQ-AVE-039 still PARCIAL; dev shortcuts now include `&carta=1`, `&derrota=`, `&oferta=1`; from T116: add an e2e for the Fiestera on board during a game) the header and its required docs; T98–T118 Outcomes; `packages/engine/src/minigames/` (`canon.ts`, `host.ts`, `registry.ts`, `types.ts`, `controller.ts`, `session.ts`, `rewards.ts`, `rng.ts`, `minigames.test.ts`), `apps/web/lib/mundo/minigame-layer.tsx`, `apps/web/e2e/minijuegos.spec.ts`, `apps/web/e2e/mar-canon.spec.ts`; achievements (`canon`, `guardacostas`) in `packages/store`; Supabase reward path (`supabase/migrations/20261003100100_economy.sql`, `packages/db/src/supabase/economy.supabase.ts`); `docs/spec/estado.md`, `tools/spec/estado.py`, `docs/TRASPASO.md`, `README.md`.
- Scope: may touch `packages/engine/src/minigames/**`, `packages/engine/src/survivors/**` (fixes), `apps/web/app/mar/**` survivors files and their wiring, `apps/web/lib/mundo/**`, `packages/store/**` only if achievements need it, `supabase/migrations/**` (new migration only if strictly needed), `apps/web/e2e/**`, `docs/spec/**`, `docs/TRASPASO.md`, `README.md`, `docs/propuestas/2026-10-04-canon-beta1-guia-prueba.md`, `docs/propuestas/2026-10-04-canon-survivors.md` (roadmap numbers only) / must not touch the Faro's behaviour, `docs/DECISIONES.md`.
- Done when:
  - `pnpm exec vitest run packages/engine/src/minigames packages/engine/src/survivors packages/store` → exit 0, with tests that a survived session validates and grants the reward once per season, an impossible active time is rejected, and the Faro's tests are untouched and passing
  - `grep -rn "minigames/canon" packages apps --include=*.ts --include=*.tsx` → no matches
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts minijuegos.spec.ts <the achievement/reward specs that touch canon> --workers=1` → exit 0, desktop and mobile projects
  - `python3 tools/spec/estado.py` → exit 0
  - Test command → exit 0
- Outcome: 2D canon removed (registry split into `MinigameEntry` / 2D `MinigameDefinition`; `world-canon.ts`, `world-session.ts`); session config v4 with the survivors hash, score = active seconds, `won` on survived; reward 150/50 per season unchanged (no migration); end-screen reward line; e2e 34 + 16 passed; REQ-AVE-037 → PARCIAL; test guide `docs/propuestas/2026-10-04-canon-beta1-guia-prueba.md` → 521119d

## T121 — No reward from dev-shortcut starts in production; Cañón sample copy
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T119
- Goal: T119 lets a game started with the `&t=` dev shortcut earn the real reward (it records `skippedMs` but still grants), and decision 2 makes the shortcuts reachable in production with `?dev=1`, so anyone could get 150 pts + 50 coins by opening `/mar?dev=1&minijuego=canon&t=419`. Fix it: a session that skipped time (or was started by any dev shortcut that changes the game) never grants the reward and never fires `win_minigame`, the `canon` achievement or `guardacostas` progress **in a production build**; in dev and the e2e server (`devShortcutsEnabled()` without `?dev=1` in production) it may still grant, so the existing e2e that checks "reward granted once" keeps working. The end screen then says the reward was skipped because of a test start (i18n, `muestra`). Also update the stale sample copy that still describes the old 2D game: the `canon` achievement description («Gana Cañón contra tiburones.») and `minigame.canon.title`, to describe the new mode (survive until dawn, `muestra`), without changing ids, rewards or achievement logic.
- Context: T119's Outcome and Decisions in this plan; `apps/web/app/mar/world-session.ts`, `world-canon.ts`, the survivors dev-shortcut helper (`devShortcutsEnabled`), `packages/engine/src/minigames/session.ts`, `rewards.ts`, the end-screen component and `mar.canon.premio.*` keys, `apps/web/lib/i18n/`, the achievements catalogue (`canon`), `apps/web/e2e/mar-canon.spec.ts`.
- Scope: may touch those files, their unit tests and `mar-canon.spec.ts` / must not touch the Faro, rewards amounts or policy, Supabase migrations, `docs/DECISIONES.md`.
- Done when:
  - unit tests prove: a production-mode session with `skippedMs > 0` (or a game-changing dev shortcut) does not grant the reward nor fire `win_minigame`/achievements, and the end screen shows the skipped-reward line; a normal survived session still grants once per season; in dev/e2e mode the shortcut start still grants
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts logros.spec.ts --workers=1` → exit 0
  - Test command → exit 0
- Outcome: production test starts (`&t=`, `&seed=`, `&carta=1`) settle with reason `test_start` and never pay or fire achievements; `devStartRewards` = dev or webdriver; end-screen line «Partida de prueba…»; `canon` copy «Aguanta en el Cañón hasta el amanecer.», title «Que no pare la música»; 1248 unit tests, 36 e2e → 8bd4390

## T106 — Durable stamps and achievement progress across sessions
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T120
- Goal: Diagnose and fix the user's demonstrated symptom: a stamp visible on the logged-in Carnet disappears when returning later; Carnet and castaway achievements also appear unsaved. Preserve every valid earned reward and separate persistence prevention from evidence-based recovery.
- Context: (absorbed from Codex `plans/009-world-updates.md`, which T120 merges into main; its Decisions apply) lib/repo-member.ts, account/session and sign-out lifecycle; store/member/member.ts, hydrate.ts, ops/server/snapshot; local purchase/stamp and Carnet APIs; ticketing sandbox; guest merge; member/fake-server tests. Read-only findings indicate cache removal with pending sync, snapshot-conflict server-wins, absent snapshot fields clearing progress, and sandbox stamps excluded from member snapshots; reproduce before choosing a repair. **Continue Codex's unfinished attempt:** Codex left uncommitted work for this task in `C:/Users/alvar/.codex/worktrees/0b17/boia-planet-hernan/.claude/worktrees/p009-t106` (branch `codex/p009-t106`, base ab21e43, no commits). Read-only there: never commit, check out, stash or edit anything in the Codex checkout or its worktrees. After your fast-forward, bring its changes into your worktree (e.g. `git -C <that worktree> diff HEAD > <tmp>.patch` and `git apply --3way`, plus copying its untracked files from `git -C <that worktree> ls-files --others --exclude-standard`), review them critically, keep what helps and finish the task. **Codex's handoff (2026-10-04 17:5x):** it reproduced the stamp lost after hydration and the achievement dropped on a snapshot conflict; the repair was reviewed and about 1150 local tests pass; final typecheck and e2e are still unconfirmed. Keep per-account isolation, sample revocations and the guard against acks from destroyed instances; reconciling must never grant rewards.
- Scope: persistence/hydration/sync lifecycle, sample stamp storage and projection, relevant achievement reconciliation and focused UI refresh/tests. Do not change place names/catalog rewards/models/race/route/menu icons, wipe caches or queues, fabricate attendance, re-award currency by inference, apply migrations or mutate remote services.
- Done when:
  - Tests obtain sample-ticket stamp, Carnet reward and castaway progress, flush, sign out/reopen the same account from a fresh local cache and retain them. Cover local-only reload and guest-to-member continuation.
  - Offline/failed snapshot, early sign-out, retries and two-device conflicts recover without duplicating rewards; accounts A/B remain isolated. Missing server fields cannot silently erase valid unsynced evidence.
  - Sample purchase stamps remain explicitly samples, separate from verified QR attendance. Recovery uses persisted purchase/discount/ledger evidence only and is idempotent; report any historical data that lacks enough evidence.
  - Relevant local/fake-member lifecycle and browser tests pass; full safe suite, typecheck/lint exit 0. No remote writes required for validation.
- Outcome: three-way merge of the account copy, recovery from the last confirmed snapshot, sample stamps from confirmed sandbox purchases (QR stamp wins), unsent copy kept on sign-out, achievement recovery completes but never claims; 9 reproducing tests; 1213 unit tests, 22 e2e passed → 52dcd53

## T107 — Blender Alicante harbor asset and reusable place contract
- Status: done
- Model: codex (via wrapper agent)
- Skills: blender-modeling-workflow, blender-asset-validation
- Depends on: none
- Goal: Build a recognizable BOIA-styled Alicante marina/harbor to replace the Cala decoration at runtime later, with connected quays, moored boats, promenade, palms and harbor buildings. Establish the smallest reusable contract for the three new place assets.
- Context: (absorbed from Codex `plans/009-world-updates.md`, which T120 merges into main; its Decisions apply) .claude/skills/blender-modeling-workflow and blender-asset-validation, existing island/decor exporters and schemas, current cala bounds and scene coordinates. Blender executable: integration node_modules/.tools/blender-5.2.2-windows-x64/blender.exe. Primary references from Puerto de Alicante and Marina Alicante. Blender executable (read-only): `C:/Users/alvar/.codex/worktrees/0b17/boia-planet-hernan/node_modules/.tools/blender-5.2.2-windows-x64/blender.exe`; if missing, use any Blender ≥ 4.2 on the machine and say which. **Continue Codex's unfinished attempt:** Codex left uncommitted work for this task in `C:/Users/alvar/.codex/worktrees/0b17/boia-planet-hernan/.claude/worktrees/p009-t107` (branch `codex/p009-t107`, base ab21e43, no commits). Read-only there: never commit, check out, stash or edit anything in the Codex checkout or its worktrees. After your fast-forward, bring its changes into your worktree (e.g. `git -C <that worktree> diff HEAD > <tmp>.patch` and `git apply --3way`, plus copying its untracked files from `git -C <that worktree> ls-files --others --exclude-standard`), review them critically, keep what helps and finish the task. **Codex's handoff (2026-10-04 17:5x):** the harbor is modelled and its views reviewed; still to do: clean up 240 degenerate triangles and revalidate the export. Its work is untracked under `art/places/` and `tools/blender/places/`. At runtime (T108) the harbor must replace all the previous Cala decoration so nothing fills the basin.
- Scope: new procedural source, editable blend, GLB, adjacent asset manifest/validator and evidence notes. Art-only: no runtime hookup, common live island manifest change, world IDs/content, client, physics or persistence.
- Done when:
  - Source reproduces blend/GLB from a clean latest Blender process; fresh import matches orientation/materials/bounds. Keep existing cala footprint and a navigable approach; polished geometry consistent with the existing clay world.
  - Explicit normalized placement contract, at most 12000 triangles and 600 kB GLB per place; use ceilings as limits, not proof of finish. Asset registry additions do not affect current runtime parsing before hookup.
  - Inspect reference images, graybox/proportions, multiview and day/night views at actual game distance; save requirement ledger and render/evidence paths. No redistributed reference images in public assets.
  - Relevant asset/unit validation, typecheck/lint pass. Deliver source, blend, GLB and metrics; no runtime completion claim yet.
- Outcome: (Codex) Alicante harbor in `art/places/3d/cala/` + `tools/blender/places/` (Blender 5.2.2 LTS): 11404 tris, 427 kB GLB, 240 degenerate tris removed, placement contract/schema for cala/fotos/tienda, ledger and notes; renders kept outside the repo → 4c529e9

## T110 — Blender Benidorm skyline and club asset
- Status: done
- Model: codex (via wrapper agent)
- Skills: blender-modeling-workflow, blender-asset-validation
- Depends on: T107
- Goal: Create a recognizable Benidorm island with characteristic skyscraper silhouette, screens, a club, decorative photo cameras and the BOIA buoy mascot dressed for an adult nightclub, pole-dancing with a connected up/down loop.
- Context: (absorbed from Codex `plans/009-world-updates.md`, which T120 merges into main; its Decisions apply) Benidorm place ID from current map, T107 reusable contract, original BOIA references, primary VisitBenidorm/Intempo skyline images, Blender modeling/validation and animation guidance when available. Blender executable (read-only, never write in that checkout): `C:/Users/alvar/.codex/worktrees/0b17/boia-planet-hernan/node_modules/.tools/blender-5.2.2-windows-x64/blender.exe`; if it is missing, use any Blender ≥ 4.2 found on the machine and say which.
- Scope: Benidorm source/blend/GLB/asset manifest and named motion nodes or exported clips; no runtime/client/map geometry/persistence/race/route changes yet.
- Done when:
  - Skyline, club, cameras/screens and dressed mascot are visible in reviewed game-distance views; pole has support and mascot stays connected through sampled animation phases. Preserve BOIA clay identity and finished silhouettes.
  - Motion is reproducible in authored blend and fresh GLB import. Specify named nodes/clip, pivots, duration and reduced-motion static pose for T112. No dynamic camera access or new external media.
  - Propose modest island enlargement only if needed for legibility, recording normalized bounds for T112; same 12000-triangle/600-kB per-place ceiling.
  - Asset/animation validation, relevant unit checks/types/lint pass; source, blend/GLB and multiview/motion evidence delivered. No runtime completion claim yet.
- Outcome: (Codex) Benidorm place `fotos`: 11768 tris, 397 kB, clip `boia-pole-dance` on empty `boia_pole_slide` (4 s loop, 24 fps, translation only, pivot [0,-0.33,0.42], reduced-motion static_frame=1), mascot in a purple club vest and hat; no enlargement; place tooling generalized for motion checks → c44a4a8

## T111 — Blender Ibiza white village and cove asset
- Status: done
- Model: opus (Opus 5.5) (Codex out of credits until 22:44)
- Skills: blender-modeling-workflow, blender-asset-validation
- Depends on: T110
- Goal: Remodel Ibiza with white Mediterranean houses and a readable sheltered cove, preserving its store role and BOIA style.
- Context: (absorbed from Codex `plans/009-world-updates.md`, which T120 merges into main; its Decisions apply) current tienda persistent ID, T107 place contract, primary Ibiza tourism references for white architecture/coastal coves. Blender executable (read-only, never write in that checkout): `C:/Users/alvar/.codex/worktrees/0b17/boia-planet-hernan/node_modules/.tools/blender-5.2.2-windows-x64/blender.exe`; if it is missing, use any Blender ≥ 4.2 found on the machine and say which.
- Scope: Ibiza source/blend/GLB/asset manifest and evidence only; no merchandise logic, gameplay/client/map geometry/route/persistence changes.
- Done when:
  - White houses, roofs/doors, shore and cove are clear at game distance and from complementary views; intended approach remains readable within current footprint.
  - Clean rerun, fresh import, normalized orientation/material/bounds validation and 12000-triangle/600-kB ceiling pass; final day/night multiview evidence inspected.
  - Source/editable blend/GLB, metrics and source reference notes delivered; relevant unit/types/lint checks pass.
- Outcome: Ibiza `tienda`: 10949 tris, 402 kB, white village, Puig de Missa church, beach kiosk with BOIA awning, decorative cove toward the approach; optional `approach.channel` check added to the place schema; 6 official references in notes → 93bb950

## T115 — Castaway achievement completes on rescue
- Status: done
- Model: codex (via wrapper agent)
- Skills: none
- Depends on: T106
- Goal: Honor the user's clarified behavior: rescuing the castaway and receiving its discount completes the castaway achievement; no unimplemented delivery-to-party mission is required.
- Context: (T106 note: add the castaway completion from its discount in `reconcileAchievementEvidence`) (absorbed from Codex `plans/009-world-updates.md`, which T120 merges into main; its Decisions apply) current naufrago-fiesta achievement, discount encounter and signal hooks; durable discount/achievement state and ledger after T106.
- Scope: castaway achievement wording and rescue trigger, evidence-based readiness recovery, focused tests. Preserve stable achievement ID, reward amount, claimed history, earned discount and repeated phrase; no persistence infrastructure, world art or other catalog changes.
- Done when:
  - First rescue/discount completes the visible achievement; returning later retains completion and uses the supplied repeat phrase. Existing persisted rescue discount legitimately proves this newly defined rescue objective.
  - Recovery only completes readiness, never automatically reclaims points/coins; claimed ledger remains authoritative and reward cannot repeat across sessions/accounts.
  - Relevant local/fake-member and encounter E2E tests, full safe suite/types/lint pass.
- Outcome: (Codex) `naufrago-fiesta` completes on rescue (`trigger: rescue_character`), a persisted rescue discount (even used/expired) is evidence, recovery never reclaims; id, 80/40 reward, discount and repeat phrase unchanged; conflict with T121 (CRLF→LF) resolved by the wrapper; 1257 unit tests, 22 e2e → 20ca11a

## T108 — Puerto de Alicante identity and explicit boat-choice popup
- Status: running (attempt 1)
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T106, T107, T115
- Goal: Rename Cala Cantalar to Puerto de Alicante and show its normal place popup on approach: this is the harbor where the player can change their boat. Clicking its CTA opens Mi Barco; approaching must not automatically open the shop or show upcoming events.
- Context: (absorbed from Codex `plans/009-world-updates.md`, which T120 merges into main; its Decisions apply) cala persistent ID, source mapa.json, map.ts/content, place sheet/client, T100 ship-menu-discovery, optional island model loader and T107 asset contract.
- Scope: harbor labels/content/popup and explicit shop action, remove superseded auto-open hookup, minimal harbor loader/fallback hookup and tests. Preserve persistent cala ID and earned discoveries; no race, other-island art, persistence implementation or route topology.
- Done when:
  - Fresh and existing profiles (including old menu-seen preference) see the harbor popup, never an automatic shop; CTA opens boat selection and its purchase/equip UI. No next-events section for this place.
  - Harbor Blender asset replaces its previous decoration, with functional fallback, existing collision/approach compatibility, labels in both worlds and source/runtime parity.
  - Relevant unit/E2E, full safe suite, typecheck/lint and asset checks pass; mobile/desktop evidence reviewed.
- Outcome:

## T109 — Twenty-two knots only during the active race
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T106
- Goal: Restore 22-knot base handling during actual racing, returning to 15-knots for exploration on completion, cancellation or abandonment.
- Context: (absorbed from Codex `plans/009-world-updates.md`, which T120 merges into main; its Decisions apply) steering historical config and T99 tests, race lifecycle/client, Mar3D ship-config application, boost/penalty/boat modifiers, circuit manual bot. Cañón note: the survivors handling overrides (plan 010 T98/T116/T120) must keep composing with the 15/22-knot selection; a Cañón game is never a race.
- Scope: race configuration selection/application, minimal engine config API if needed, lifecycle/physics tests and E2E. No medal-threshold/economy changes, art, place content, route topology or persisted record deletion.
- Done when:
  - `mar-circuito.spec.ts` medal test (line ~203, «…medalla…», failing since the 15-knot change merged in T120) passes again on desktop and mobile with the 22-knot race handling, without weakening it
  - Countdown/offering/result/exploration use 15 base; active race uses the complete historical 22-kn handling proportions. Turbo and boat modifiers compose consistently.
  - Finish/cancel/invalidate/leave/reset cannot retain race speed; clamp excess speed appropriately on return and preserve strict steering/collision behavior. Existing record version stays unless a demonstrated comparability issue is reviewed.
  - Meaningful lifecycle/physics and targeted race E2E pass; full safe suite, typecheck/lint exit 0.
- Outcome: `RACE_SHIP_CONFIG` (15-kn config scaled to 220 u/s, checked against the frozen 22-kn config) only while the race phase is `racing`; excess speed cut to the 15-kn cap on exit; record version kept; `data-manejo`; medal e2e passes again → eb968a0

## T112 — Benidorm and Ibiza runtime integration with bounded club animation
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T108, T109, T110, T111
- Goal: Use the new Benidorm/Ibiza Blender assets in the actual game, replacing old decoration and playing the requested club mascot loop.
- Context: (T111 note: Ibiza collision is a 1.9×1.5 ellipse at 45° that reaches past the visible coast front-right and back-left; replace the procedural `tienda()` decoration and set `labelY` and the night glow) (T110 note: keep the `boia-pole-dance` GLTF clip in ModelStore; the default 1.7-radius approach framing crops the Benidorm tower tops, ~1.05 radii frames the whole skyline) (T107 note: `ModelStore` drops GLTF animation clips today; keep them for the club loop) (absorbed from Codex `plans/009-world-updates.md`, which T120 merges into main; its Decisions apply) T107/108 place loader, T110/111 models, mar3d scene/update/destroy, current island bounds/collisions/proximity/wrap.
- Scope: scene place loaders/hooks/animation/tests and required Benidorm geometry/proximity source parity adjustment. No UI/account/economy/route/icon changes.
- Done when:
  - Both models load with fallback and no duplicated island decoration. Any modest Benidorm enlargement updates visual/collision/proximity dimensions together and leaves safe separation/approach; Ibiza shop behavior remains.
  - Dance/screens motion runs from existing frame clock, bounded resources, with reduced-motion static pose and proper stop/dispose on scene destruction. Named exported clips/nodes actually used; review multiple in-game motion phases.
  - Geometry/wrap/lifecycle/asset tests and mobile/desktop loading/fallback/reduced-motion E2E pass; full safe suite/types/lint exit 0.
- Outcome:

## T113 — Transparent main route with optional exploration islands
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T108, T109, T112
- Goal: Make route lines more transparent and connect only Inicio → Puerto de Alicante → Isla de Halloween → Isla del Sonido → Isla de Nochevieja, reducing confusing crossings. Other islands stay optional destinations found through exploration/minimap.
- Context: (absorbed from Codex `plans/009-world-updates.md`, which T120 merges into main; its Decisions apply) canonical route/world source, compact scene route line/materials, route and reachability tests, guide/mission/event pins. Cañón note: during a Cañón game the route lines stay hidden (T116's hide list); keep that working with the new topology.
- Scope: route topology/opacity and necessary route tests/source parity. No reward/catalog changes, art remodeling, race handling or menu icons.
- Done when:
  - Exact main sequence is the only main connector path in both worlds; labels are correct and opacity is visibly reduced without losing useful legibility.
  - Benidorm, Ibiza and other optional islands stay reachable/visible as appropriate, with missions/events still usable and no stale all-islands path requirement.
  - Route geometry/reachability and relevant map E2E pass; full safe suite/types/lint exit 0. Capture overview evidence.
- Outcome:

## T114 — Custom BOIA menu icons
- Status: done
- Model: opus (Opus 5.5) (Codex out of credits until 22:44)
- Skills: none
- Depends on: T118
- Goal: Replace the game's generic emoji menu icons with a coherent small custom icon family matching BOIA's mascot, rounded shapes and orange/navy palette.
- Context: (absorbed from Codex `plans/009-world-updates.md`, which T120 merges into main; its Decisions apply) mar/menu.tsx and menu section metadata/shared menu components, original logo assets, existing scoped game CSS. Cañón note: T118 added a leave-the-page warning to the `/mar` menu during a Cañón pause; keep it.
- Scope: code-native SVG/components, menu icon mapping and focused style/a11y tests only. Do not redraw the original logo, change feature behavior or replace unrelated world/map emoji.
- Done when:
  - All main game-menu entries have consistent distinct icons, clear text labels and accessible names; icons don't shrink touch targets or impair contrast/mobile layout.
  - Existing original mascot/logo is reused where fitting; custom SVGs remain lightweight. Relevant render/a11y and mobile/desktop menu tests/types/lint pass.
  - Provide reviewed menu screenshot; if an icon has no safe clear substitute, document the narrow limitation rather than blocking functional work.
- Outcome: SVG icon family in `apps/web/lib/mundo/menu/icons.tsx` (415–908 B each, `currentColor` + brand fills), mascot reused for Welcome, tiles ≥92 px with two-line labels (Archivo cut them), e2e checks no label is cut; 1268 unit tests → 2f2b8ee

## T105 — Final regression coverage and world-update handoff
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T106, T107, T108, T109, T110, T111, T112, T113, T114, T115, T119
- Goal: Update the stale mobile-card test from T97 against the final intended UI; reconcile tests and document the requested changes, sample reward assumptions and remaining external setup.
- Context: (from T121: fix lines ~50–53 of `docs/propuestas/2026-10-04-canon-beta1-guia-prueba.md`, which still say a `t=` start earns the reward; now only locally and in e2e, never with `?dev=1` in production) (absorbed from Codex `plans/009-world-updates.md`, which T120 merges into main; its Decisions apply) mar-hud.spec.ts T97 and WIP 79bb8fa; relevant E2E files; docs/TRASPASO.md, spec/estado.md and user updates. Also reconcile `docs/TRASPASO.md` and `docs/spec/estado.md` with plan 010's Cañón beta (T119 already wrote its part: keep it).
- Scope: may touch relevant tests and concise docs/change notes / must not introduce new product behavior, modify existing decision history, apply migrations or edit plans/.
- Done when:
  - Mobile-card assertions preserve compact height and intentional travel controls; fresh/existing player behavior for this batch is covered.
  - Test command exits 0. Orchestrator separately runs final build/budget, validators and combined relevant E2E, then obtains architect review before completion.
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

- 2026-10-04 plan: one orchestrator. The Codex session finishes T106/T107 in `codex/world-updates` and stops; T120 merges it; the Codex plan's pending tasks T105, T108–T115 move into this plan with their ids and texts, `Depends on` remapped (T106/T107 → T120) and serialized where they share `/mar` files (Hernán)
- 2026-10-04 plan: Codex (agent `codex:codex-rescue`) runs only the smallest tasks, T115 and T114, after a probe confirms it works in its own worktree and keeps the final-message format; otherwise Opus runs them (Hernán: «Codex las mínimas»; orchestrator chose which)
- 2026-10-04 plan: Blender tasks T110/T111 may use the blender-modeling-workflow and blender-asset-validation skills; T105 runs last, after T119 (orchestrator)

- 2026-10-04 T116: e2e detected via `navigator.webdriver`; a level-up auto-picks the first card until T118; any panel or the menu pauses the game; while playing the runtime is not stepped and crocodiles, dolphin, Fiestera, jellyfish, whirlpools, bottles, secrets, chests and wreckage are hidden and not solid; only island labels on sea and minimap; map view, course, sailing, flight, turbo and world switching blocked; dev `&oferta=1` shows the Cañón panel; shortcut params removed from the URL after use (`dev=1` stays); `detectQuality` in mar3d; `SurvivorsClock.alpha` for interpolation; panel title/summary i18n keys `muestra` (agent)
- 2026-10-04 T116 known: the two 2D-canon tests in `minijuegos.spec.ts` now fail by design (T119 removes them); «Códigos» sheet from the menu does not pause (T118); Fiestera-on-board has no e2e (T119 should add one) (agent)

- 2026-10-04 plan: Codex hit its usage limit (until 16:05) with T106/T107 uncommitted; T120 merges `codex/world-updates` as it is (608f883), and T106/T107 become Opus tasks here that continue Codex's uncommitted work read-only from its worktrees; Hernán stops the Codex session (Hernán)
- 2026-10-04 Codex as a worker: the `codex:codex-rescue` agent runs Codex read-only and Codex's sandbox cannot write the worktree's git dir, so Codex tasks run through a **wrapper**: a general-purpose Claude agent (Sonnet) in the task worktree does the fast-forward, setup, file copies, git commits, Done-when commands and final message, and calls Codex (`codex-companion.mjs task --write`, model/effort from `~/.codex/config.toml`: gpt-6.1-sol, high) for the actual work. Probe passed (orchestrator)
- 2026-10-04 Hernán asked to delegate more to Codex: T107 (its own harbor asset, art-only) now runs on Codex with no dependency (it never needed T120), and the art chain T110/T111 follows on Codex; T114/T115 stay on Codex (Hernán + orchestrator)
- 2026-10-04 Codex orchestrator confirmed via `codex exec resume`: plan 009 stopped, workers already gone, no commits or file changes after 11:39; its T106/T107 handoff notes added to those tasks' Context (orchestrator)

- 2026-10-04 T120: hide layers `objective` (the «!» button, its panel and the marked objective, restored after) and `wildlife` (fish and gulls stopped, `data-fauna-oculta`); castaway, WhatsApp buoy and Cala first-visit popup need no hiding (runtime not stepped, pins removed); one pins effect replaces the old one; determinism test samples every 5 s (agent)
- 2026-10-04 T120 blocked on the race medal e2e failing at 15 knots (pre-existing in Codex's branch, its T99 removed the same unit check); orchestrator chose option A: accept the merge, T109 must make that e2e pass again (added to its Done when) (orchestrator)

- 2026-10-04 T117: dev switch is a dashed «Derrota: puf/sumergirse» button in the hidden «!» slot (i18n `mar.canon.dev.derrota*`), choice kept for the session, `&derrota=` shortcut, `data-derrota` on the canvas; models drawn larger than their collision radius (piranha ×1.6, crab ×1.2); sinking enemies use separate meshes outside the cap; effect pools 24/10, puf 7/4 particles; boat blinks at 8 Hz only while running; reduced motion also stops bobbing (agent)

- 2026-10-04 T106: kept Codex's repair after review; added start-from-last-confirmed-snapshot for an empty account copy with a queue; one stamp per event; sample label if stamp, Carnet or event is a sample; sign-out keeps an unsent copy under its own key; unrecoverable data listed in its ESTADO section (agent)

- 2026-10-04 T118: `autoPickCards` default false and `SurvivorsRun.choose`; dev `&carta=1`; hooks `data-mejoras`, `data-carta`; cards as cream concert tickets with a 350 ms pick guard; after the end screen the scene stays frozen until a button; 5-min abandon returns at once with a short message; Esc on the end screen = «Volver al mar»; water stripes change at 50 % and 75 %; upgrade keys split into name + `.efecto`; dev switch moves bottom-left during a game; BETA badge via optional `badge` in `InWorldCopy` (agent)

- 2026-10-04 T119: session score = active whole seconds, goal 420 s, `won` only on survived, config v4; `&t=` skipped time recorded as `skippedMs` and still rewarded; hidden tab never invalidates a Cañón session; registry split; `layerMinigame()` only 2D; REQ-AVE-037 HECHO → PARCIAL; REQ-AVE-038 HECHO with the active-time adjustment pending; Faro pause/hidden-tab e2e moved to the Faro; no Supabase migration needed (agent)
- 2026-10-04 orchestrator: added T121 (small fix): with `?dev=1` in production the `&t=` shortcut would let anyone earn the real reward; production dev-shortcut starts never grant; also refresh the stale `canon` sample copy (orchestrator)

- 2026-10-04 orchestrator: T115 launched before T111 (T115 is on the critical path T115 → T108 → T109 → T112) (orchestrator)

- 2026-10-04 T121: `?dev=1` turns shortcuts on but never the reward; test start = `&t=`, `&seed=` (a known seed can be practised) or `&carta=1`; `&derrota=` does not count; new `RewardOutcome` reason `test_start`; `textos-zonas.md` row updated for `zonas.test.ts` (agent)

- 2026-10-04 Hernán: when Codex runs out of credits, Claude continues. Codex wrappers stop at once on a usage-limit error with a `WIP` commit and STATUS: failed («codex usage limit»); the orchestrator continues the task with an Opus continuation agent (not counted as a failed attempt), and later Codex tasks go to Opus until Codex is back (Hernán)

- 2026-10-04 Hernán: up to 4 agents at once from now on. To use them, T109 (race handling) no longer waits for T108 and T114 (menu icons) no longer waits for T113: those links only serialized `/mar` files, and merge conflicts are handled at integration (orchestrator)

- 2026-10-04 Hernán: if 4 agents make things slower, go back down. Signal: task durations clearly above the ~25–35 min of the 2-agent tasks, or e2e failing by timeouts under load; then launch no new agent until at most 2 are running (orchestrator applies)

- 2026-10-04 T109: Mar3D reads the race through a `racing()` option each step; on race end extra speed is clamped to the 15-kn cap while active boosts/turbo still count (agent)

## Proposals (new scope)
- 2026-10-04 T114: section sheet titles still carry emoji in their i18n strings («🏆 Logros»…); the old /juego menu (`onboard-menu.tsx`, `sections/*` icon fields) is unused dead code
- 2026-10-04 T109: when a world boost or turbo runs out, `stepShip` cuts speed in one step and Mar3D treats it as a collision (pre-existing, untested)
- 2026-10-04 T121: sample copy still describing the old 2D canon: `canon` achievement title «Ni un tiburón», `minigame.canon.summary`, `howto.*` (unused), `docs/propuestas/logros-catalogo.md`; for Hernán/Álvaro with the launch copy
- 2026-10-04 T110: Codex could not view the VisitBenidorm/Intempo photos, so the skyline is stylized from the brief; a review against real references is still open
- 2026-10-04 T106: when a guest signs in to an account that already has a saved copy, `merge_guest` keeps the account's copy, so the guest's sample stamp is lost; carrying it over is new scope
- 2026-10-04 T117: balance: enemies die next to the boat, so the 90 u magnet picks notes at once and notes are rarely seen on the water; an idle boat floods in ~20 s (for the feel test)
- 2026-10-04 T120: Cañón balance: piranhas at 150 u/s equal the boat's new 15-knot top speed (was 220); for Hernán's feel test (noted in T119's guide)
- 2026-10-04 T98: balance untested by hand: with no dodging the boat floods in under a minute; tune after Hernán's test (plan 010 input)

## Log
- 2026-10-04 13:52 T98 launched · attempt 1 · agent a7dd71bedac7f77e0
- 2026-10-04 14:16 T98 done · branch worktree-agent-a7dd71bedac7f77e0 → ab1bd6b
- 2026-10-04 14:17 T116 (launched as T99) launched · attempt 1 · agent a807676a5504162cf
- 2026-10-04 14:48 Codex probe: usage limit until 16:05, nothing ran; re-probe before launching T115
- 2026-10-04 14:50 T116 done · branch worktree-agent-a807676a5504162cf → b845582
- 2026-10-04 14:52 T120 launched · attempt 1 · agent a99ee9890bfcfe9d6
- 2026-10-04 17:46 session restarted; T120 orphan mid-merge (no unmerged paths) → resumed same agent via SendMessage
- 2026-10-04 17:47 stop message sent to the Codex orchestrator session 01a10276 via `codex exec resume`
- 2026-10-04 17:53 T107 launched · attempt 1 · Codex via wrapper agent a51c7a2f06fefaab5
- 2026-10-04 17:56 T120 done (option A on the medal e2e) → c5c6339
- 2026-10-04 17:57 T117 launched · attempt 1 · agent abb47c81231627b9e
- 2026-10-04 18:21 T107 done → 4c529e9
- 2026-10-04 18:21 T106 launched · attempt 1 · agent ab1185124c006f967
- 2026-10-04 18:25 T117 done → 88c9ab3
- 2026-10-04 18:25 T118 launched · attempt 1 · agent aeff101b5188b33d3
- 2026-10-04 18:35 T106 done → 52dcd53
- 2026-10-04 18:35 T110 launched · attempt 1 · Codex via wrapper agent a64cb5a8c7b8fa495
- 2026-10-04 19:01 T118 done → b625169
- 2026-10-04 19:02 T119 launched · attempt 1 · agent a70863d9a7bdced71
- 2026-10-04 19:30 T119 done → 521119d
- 2026-10-04 19:31 T110 done → c44a4a8
- 2026-10-04 19:32 T121 launched · attempt 1 · agent aeebcee5633965fc2
- 2026-10-04 19:32 T115 launched · attempt 1 · Codex via wrapper agent a4497e05c0ef20f2e
- 2026-10-04 19:48 T121 done → 8bd4390
- 2026-10-04 19:49 T111 launched · attempt 1 · Codex via wrapper agent a9521295766dd3aa6
- 2026-10-04 19:52 T115 done by agent; integration conflict in packages/store/src/sample/progress.ts → sent back to the same agent
- 2026-10-04 19:54 T111 Codex hit its usage limit (until 22:44) before writing anything; WIP had only a status note → dropped; relaunched on Opus from main (same attempt). T114 moved to Opus too
- 2026-10-04 19:54 T111 relaunched on Opus · attempt 1 · agent ad8be04b9f8b7e142
- 2026-10-04 20:00 T115 done → 20ca11a
- 2026-10-04 20:00 T108 launched · attempt 1 · agent ac18bcaf2344b2d6e
- 2026-10-04 20:14 T109 launched · attempt 1 · agent aadf9a7b30999bc2e
- 2026-10-04 20:14 T114 launched · attempt 1 · agent ab0523af0f634b827
- 2026-10-04 20:57 T109 done → eb968a0 (38 min task, 285 s integration: load with 4 agents + preview server)
- 2026-10-04 21:09 T114 done → 2f2b8ee
- 2026-10-04 21:09 T111 done → 93bb950
