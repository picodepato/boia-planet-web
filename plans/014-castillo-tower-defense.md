# Plan 014 — The lighthouse becomes the map board, and «Defensa del Castillo» (tower defense)

Status: approved — waiting (not launched; /orchestrator starts it once plan 013 is done)
Created: 2026-10-05
Base branch: main
Goal: Two changes to the Arcilla world. (1) The lighthouse (`faro`) moves to where the Santa Bárbara castle stands today, loses its minigame («Vigilancia del faro» is removed from the web, achievement included) and becomes the **map board**: close to the start, it tells people about the two games and the race and takes them there. (2) The castle moves next to **Boia 7** and becomes a new minigame island: **«Defensa del Castillo»** (name `muestra`), a by-the-book tower defense. All islands sink, only the castle remains; the Cañón's enemies, minibosses and bosses come in waves along **one curved path marked with the race buoys**; the player flies the boat in its **plane version** (the wings of the «Entradas» flight) under a higher camera, shoots, and builds the **existing islands** as towers (no new models), each with its own attack; the castle has life, and the player wins by holding out for the chosen time (5, 7 or 10 min).
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task (this machine is Windows 10, Git Bash): the two `packages/db` suites need a local Postgres that this machine does not have, hence the exclude; `PYTHONUTF8=1` makes the Python checks read UTF-8; if a guard blocks the chained test command, run its steps one by one. E2E: `E2E_PORT=<free port> pnpm e2e <spec files> --workers=1` (first time in a worktree: `pnpm --filter @boia/web exec playwright install chromium`); the machine is slow under load, rerun only failing specs; the full e2e run is done only in T165. UI strings only by key in `apps/web/lib/i18n/`, never loose strings in components. Content (names, texts, numbers, sounds) stays `muestra`. Never commit `apps/web/public/atlas/`, `.claude/launch.json` or any `.env*` file other than `.env.example`. Never push or deploy; Supabase migrations are written and tested locally but never applied to a real project (Hernán does that). Never edit `docs/DECISIONES.md`. Local mode (D-20, no Supabase env vars) must keep working; Supabase mode must not break. Work only on the main world **Arcilla**; **Acuarela** stays hidden and is not kept in parity. **Do not change the Cañón's game or balance**: reuse its enemy, boss, weapon and view code by import or by extracting shared helpers with no behaviour change (the Cañón's tests must stay green and `SURVIVORS_CONFIG_VERSION` must not move because of this plan). Skills: each task's block names the skills it may invoke with the Skill tool; invoke none other.

**Required reading for every task:** this header; plan 013's Outcomes, Decisions and Proposals (`plans/013-canon-definitiva.md`: the pre-game pop-up, «Terminar partida», sound module, ranking and anti-cheat that this plan reuses); `docs/propuestas/2026-10-04-canon-survivors.md` for the enemies and bosses. Where this plan and those documents disagree, this plan wins.

Decisions of 2026-10-05 that every task follows (conversation with Hernán):
1. **Lighthouse.** The `faro` island moves to the spot of the castle decor today (`apps/web/app/mar/engine/compact.ts` decor spot `castillo`). It has no game. Approaching it opens the **«Tablón del faro»** panel: three cards, **Cañón**, **Castillo** and **Carrera**, each with one line about the game, the player's best medal if any, and a **«Rumbo a…»** button that marks the destination like the «!» help does (`apps/web/app/mar/guia.tsx`, `apps/web/lib/mundo/guide.ts`). The world guide/info buoys that pointed to the lighthouse game point to the board instead.
2. **«Vigilancia del faro» is removed from the web**: sim (`packages/engine/src/minigames/faro.ts`), registry entry, rewards, the `?minijuego=faro` route, admin lists, its achievement and its e2e. Players who earned it **do not keep it**: the local document migration drops it, and a Supabase migration (written, not applied) does the same. REQ-AVE-036 is marked retired in `docs/spec/estado.md` with a note pointing to this plan (no edit of `docs/DECISIONES.md`; the decision goes in the Álvaro draft of T165).
3. **Castle.** The castle becomes a minigame island (`gameId: 'castillo'`) next to **Boia 7** (`circuito-delfin`, `[-11.0, 9.4]` in `packages/world/src/worlds/arcilla/map.ts`), off the race lines (legs Boia 6 → 7 and 7 → 8 stay clear) and with free water around it for the game. It keeps its model (`decor-model.ts` glb with the procedural fallback). Approaching it opens its island panel like the Cañón's.
4. **Arena.** On «Jugar», every other island, decor and the world layers sink or hide (the Cañón's `HideLayer` mechanism plus a sinking animation); only the castle and the sea remain; everything comes back at the end. The camera rises to a higher, more top-down view centred on the castle; the playing area is a bounded disc around it.
5. **One path.** Enemies come along **one fixed path with a few curves** from the edge of the arena to the castle, marked on both sides with the **race buoys** (`apps/web/app/mar/engine/race-props.ts`). Enemies follow it by distance; they never leave it and never collide with islands. **Nothing can be built on the path** (minimum distance from its centre line). An enemy that reaches the castle damages it and disappears.
6. **Enemies.** The Cañón's common enemies, minibosses and bosses with their models, in waves; each kind has its own path speed and life here. Bosses and minibosses only follow the path (no attack patterns, no summons in this plan), with much more life and more castle damage. Each kill gives coins straight to the purse (no pickups).
7. **Plane.** The player flies the boat with the «Entradas» wings (`apps/web/app/mar/engine/flight.ts` `Wings`) freely over the arena (keyboard and touch, like sailing). It **shoots on its own** at the nearest enemy in range (like the Cañón's basic `canon` weapon) and its damage can be upgraded with coins to level 3. It cannot be hit. Building happens only **inside a ring around the plane**.
8. **Building.** A «Construir» button opens the seven islands with their cost; the player places one inside the plane's ring, off the path, not overlapping another island or the castle (live valid/invalid preview). Tapping a built island shows **Mejorar** (to level 3, more damage) and **Vender** (part of what it cost back, `muestra`). Islands are the existing models (`buildIsland` in `apps/web/app/mar/engine/islands.ts`) scaled down.
9. **The seven islands** (attacks reuse the Cañón's weapon kinds where they fit):
   - **Faro** (`faro`): a light beam that sweeps around and damages what it touches (`laser`/beam).
   - **Nochevieja** (`ultima`): a cannon of **white snowballs** that also **stun** briefly; each shot picks a **different enemy** than the last when it can (`canon`/projectile).
   - **Halloween** (`halloween`): a **flamethrower** cone that leaves enemies burning for a while (`confetti`/cone, fire look).
   - **Puerto de Alicante** (`cala`): **fireworks** mortar, long range, explosion with area damage (`fireworks`).
   - **Ibiza** (`tienda`): **farm**, no attack, gives extra coins every few seconds.
   - **Isla del Sonido** (`allday`): a bass wave that damages everything around it (`subwoofer`/aura).
   - **Benidorm** (`fotos`): a **sniper** from the skyscrapers: slow, very long range, high damage on a single enemy, preferring the strongest one in range (bosses first) (`laser`/beam, one target).
10. **Win, lose, run length.** The castle has life; the game is lost when it reaches 0 and won by holding out for the chosen time: **5, 7 or 10 min**, with more enemies in the longer runs. Three difficulties like the Cañón (Tranquila, Normal, Tormenta). **No acts.**
11. **Coins only inside the game**: start purse + kills + Ibiza; never paid to the world balances.
12. **Medals:** gold = held out with more than 50 % castle life; silver = held out with 50 % or less; bronze = fell after half the chosen time. **Ranking:** points per enemy killed (more for bosses) + a bonus for the castle's remaining life; **one table per run length × difficulty**, local and global with the anti-cheat of plan 013 T155. Games started with a dev shortcut or ended with «Terminar partida» never rank.
13. **World prize and achievements** for this game are **not** in this plan (open for Hernán and Álvaro; the Álvaro draft in T165 asks).
14. **Models:** each task block names its model (Opus 5.5 by default; Codex for short Opus-level tasks, through a wrapper agent, falling back to Opus when out of credits).

## Tasks

## T157 — Lighthouse ↔ castle swap, remove «Vigilancia del faro», the «Tablón del faro»
- Status: pending
- Model: opus (Opus 5.5)
- Skills: frontend-design
- Depends on: none (after plan 013 is done)
- Goal: Header decisions 1, 2 and 3.
  - Move the `faro` island to the castle decor spot and drop its `start_minigame`; remove the castle decor spot and add a `castillo` minigame island next to Boia 7 (off the race lines, free water around), reusing the castle model; its panel says «Próximamente» until T162 wires the game (behind the same panel pattern as the Cañón).
  - Remove «Vigilancia del faro» everywhere (engine sim and registry, rewards, `?minijuego=faro`, `apps/web/lib/admin/achievements.ts` `MINIGAMES`, achievement trigger, e2e `minijuegos.spec.ts` cases, admin world section); local document migration and Supabase migration (written, not applied) drop the earned achievement; `docs/spec/estado.md` marks REQ-AVE-036 retired.
  - «Tablón del faro» panel: three cards (Cañón, Castillo, Carrera) with one line each, the best medal if any (Castillo shows none until T162) and «Rumbo a…» using the guide's destination mark; keyboard and touch, mobile and desktop. Info buoys whose `guide` was `faro` point to the board.
  - Check that the race, the Fiestera mission, the minimap, the autopilot and the hidden discounts still work with the moved places (no place inside another, no buoy on land).
- Context: `packages/world/src/worlds/arcilla/map.ts` (l.465 `faro`, l.756 `RACE_BUOYS`, `INFO_BOIES` `guide: 'faro'`), `packages/world/src/worlds/place-art.ts`, `apps/web/app/mar/engine/compact.ts` (decor spots), `decor.ts`, `decor-model.ts`, `mar3d.ts:1701-1750`, `packages/engine/src/minigames/**`, `apps/web/lib/mundo/minigame-layer.tsx`, `apps/web/lib/mundo/achievements.ts`, `apps/web/lib/admin/**`, `apps/web/app/mar/guia.tsx`, `apps/web/lib/mundo/guide.ts`, `apps/web/lib/mundo/place-panels.tsx`, `apps/web/e2e/minijuegos.spec.ts`, `mar-puerto.spec.ts`, `mar-decor.spec.ts`.
- Scope: may touch the files above, store schema/migrations, `supabase/**` and `packages/db/**` migrations, i18n, `docs/spec/estado.md`, tests and e2e / must not touch the Cañón's game, `docs/DECISIONES.md`.
- Done when:
  - unit tests: world places do not overlap and buoys are on water after the move; migration drops the faro achievement and keeps everything else → pass
  - `grep -rn "Vigilancia del faro\|minijuego=faro" apps packages` → nothing left outside migrations/history notes
  - `E2E_PORT=<free> pnpm e2e mar-decor.spec.ts mar-puerto.spec.ts <the board spec> --workers=1` (board opens at the lighthouse, «Rumbo a…» marks each destination; the castle island opens its panel near Boia 7) → exit 0
  - Test command → exit 0
- Outcome:

## T158 — Tower defense simulation: path, waves, castle, plane, coins, medals, score
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: none (after plan 013 is done)
- Goal: A new headless, deterministic sim `packages/engine/src/defense/` (same style as `survivors/`: seeded RNG, fixed step, pure state, `DEFENSE_CONFIG` + `DEFENSE_CONFIG_VERSION`), header decisions 5, 6, 7 (shooting and its upgrades), 10, 11 and 12.
  - The path: one curved polyline (data in the config), sampled by arc length; enemies advance by distance with their own speed; reaching the end damages the castle and removes the enemy.
  - Waves built from the Cañón's enemy kinds and its minibosses/bosses (reuse their ids and models list from `survivors/config.ts` by import, with defense-only speed/life/castle-damage/coins); schedule per run length (5/7/10 min) and difficulty, more enemies in longer runs; bosses near the end.
  - Plane: free position in the arena disc, auto-shot at the nearest enemy in range, damage level 1–3 bought with coins.
  - Castle life, lose at 0, win at the chosen time; pause; `quit` end reason like the Cañón's «Terminar partida».
  - Medal and score functions per decision 12; result object ready for the card and the ranking (`ranked:false` for shortcut and quit games).
  - Leave a tower interface (`targets`, `onTick`) that T159 fills; the sim must already run with zero towers.
- Context: `packages/engine/src/survivors/` (`sim.ts`, `config.ts`, `world.ts`, `grid.ts`, `clock.ts`, `medals.ts`, `bots.ts`) as the pattern, plan 013 T148/T155 Outcomes (quit and ranked flag), `packages/engine/src/index.ts` exports.
- Scope: may touch `packages/engine/src/defense/**`, `packages/engine/src/index.ts`/`headless.ts` exports, read-only imports from `survivors/` (extracting a shared helper is allowed only with no behaviour change) / must not touch the Cañón's balance or `SURVIVORS_CONFIG_VERSION`, the web app, `docs/DECISIONES.md`.
- Done when:
  - unit tests: path sampling; enemies reach the castle in the expected time; castle loss; win at 5/7/10 min; plane shot and its 3 levels; coins on kill; medal thresholds (>50 %, ≤50 %, fell after half); score; determinism (same seed → same result); a game with no towers is lost in Normal → pass
  - `pnpm exec vitest run packages/engine/src/defense packages/engine/src/survivors --testTimeout=60000` → exit 0
  - Test command → exit 0
- Outcome:

## T159 — The seven islands: attacks, levels, building, upgrade and sell
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T158
- Goal: Header decisions 8 and 9 inside the sim.
  - Build rule: inside the plane's ring, at a minimum distance from the path's centre line, no overlap with other islands or the castle; cost; returns a reason when invalid (for the HUD preview).
  - The seven towers with levels 1–3 (damage and, where it fits, range/rate): Faro sweeping beam; Nochevieja snowballs with short stun and a different target each shot when possible; Halloween fire cone with burn over time; Puerto fireworks mortar with area explosion; Ibiza farm with coins every few seconds; Isla del Sonido bass aura; Benidorm long-range sniper on the strongest enemy in range. Reuse the Cañón's weapon kinds' targeting/geometry helpers where they fit.
  - Upgrade (to 3) and sell (part of the money back); state exposes each tower's last shot/effect for the view.
  - Bot tests: a simple building bot can hold Tranquila with gold, Normal with a real fight; record numbers (T165 balances them).
- Context: T158 Outcome, `packages/engine/src/survivors/config.ts` weapons (`laser`, `canon`, `confetti`, `fireworks`, `subwoofer`) and their code in `sim.ts`.
- Scope: may touch `packages/engine/src/defense/**`, shared helpers as in T158 / must not touch the Cañón's balance, the web app, `docs/DECISIONES.md`.
- Done when:
  - unit tests: each tower hits what it should (beam sweep, stun duration and target rotation, burn ticks, area radius, farm income, aura, sniper picks the strongest in range); build rule rejects path/overlap/outside-ring; upgrade/sell money; bot results recorded → pass
  - `pnpm exec vitest run packages/engine/src/defense --testTimeout=60000` → exit 0
  - Test command → exit 0
- Outcome:

## T160 — The 3D arena: sinking, higher camera, path buoys, enemies, islands and the plane
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T157, T158
- Goal: Header decisions 4, 5 and 7 in the view (`apps/web/app/mar/engine/defense-*.ts`, driven by the T158 sim; the T159 effects are added as soon as T159 is in main, else stubs that T161 completes).
  - Entering the game: every other island and decor sinks (short animation, instant with reduced motion), world layers hide (Cañón `HideLayer`), the camera rises to the higher top-down view on the castle; at the end everything comes back exactly as it was.
  - The path marked on both sides with the race buoys; enemies and bosses with the Cañón's models (`survivors-view.ts`, `survivors-props.ts`, kraken/fantasma/shark/vecino views) moving along it; castle damage feedback.
  - The plane: the boat with the «Entradas» wings, flying at a fixed height, steered with the sailing controls; its shots; the build ring drawn around it when building.
  - Built islands: `buildIsland(id, R)` scaled down, a level mark, and their effects (beam, snowballs, fire, fireworks, coins popping on Ibiza, bass wave, Benidorm's sniper tracer).
  - Performance: `baja` quality with the longest run's peak wave and seven islands at level 3 keeps a reasonable frame time (measured in the e2e browser, numbers recorded).
- Context: `apps/web/app/mar/survivors.ts` (`HideLayer`), `canon-mode.tsx` (how the Cañón enters and leaves), `engine/mar3d.ts` (camera, decor, `Wings`), `engine/flight.ts`, `engine/race-props.ts`, `engine/islands.ts`, `engine/survivors-view.ts`, the castle model (`decor-model.ts`).
- Scope: may touch `apps/web/app/mar/engine/**` (new defense view files, small hooks in `mar3d.ts`), `apps/web/app/mar/` game mode file for the castle, tests / must not touch the Cañón's behaviour, the engine sim rules, `docs/DECISIONES.md`.
- Done when:
  - unit tests: sinking state and restore; camera pose for the arena; path buoy placement → pass
  - `E2E_PORT=<free> pnpm e2e <the castle spec> --workers=1 -g "arena"` (start with a test shortcut: islands hidden, castle visible, enemies on the path, plane moves; leaving restores the world) → exit 0
  - Test command → exit 0
- Outcome:

## T161 — HUD and controls: Construir, placing, Mejorar/Vender, life, time, coins
- Status: pending
- Model: opus (Opus 5.5)
- Skills: frontend-design
- Depends on: T159, T160
- Goal: The in-game interface, on mobile and desktop, same style as the Cañón's HUD after plan 013.
  - Top: castle life bar, time left, wave number, coins; the Cañón's boss bar reused for minibosses/bosses.
  - «Construir» button → the seven islands with cost and icon (grey when unaffordable) → placement preview following the plane's ring, green/red with the reason from T159; confirm/cancel with touch and keyboard.
  - Tapping (or selecting with the keyboard) a built island: level, Mejorar (cost), Vender (refund); the plane's own damage upgrade.
  - Pause menu reuses the Cañón's (volume, «Terminar partida» with confirm → card «Partida terminada», no medal, no ranking).
  - Nothing overlaps at 360×640, 390×844, 768×1024 and 1440×900; touch targets ≥ 44 px; `aria-live` for wave start, boss arrival and the result.
- Context: `apps/web/app/mar/canon-hud.tsx`, `canon-hud.css`, `canon-hud-model.ts`, `menu.tsx`, plan 013 T148/T150/T152 Outcomes (layout, icons, accessibility), T159/T160 Outcomes.
- Scope: may touch `apps/web/app/mar/**` castle HUD files, CSS, i18n, a castle e2e spec, small shared HUD extractions with no change for the Cañón / must not touch the engine rules, `docs/DECISIONES.md`.
- Done when:
  - unit tests: HUD model (costs, affordability, upgrade/sell texts, life/time formatting) → pass
  - `E2E_PORT=<free> pnpm e2e <the castle spec> --workers=1 -g "construir|mejorar|vender|HUD"` (build each island, invalid spot on the path refused, upgrade to 3, sell; no overlap at the four sizes) → exit 0
  - Test command → exit 0
- Outcome:

## T162 — The castle's pre-game pop-up, final card and medals
- Status: pending
- Model: opus (Opus 5.5)
- Skills: frontend-design
- Depends on: T161
- Goal: Wire the castle island to the game.
  - Pre-game pop-up in the Cañón's pattern (plan 013 T151): difficulty (3), **run length 5 / 7 / 10 min**, a ranking area for the chosen pair (empty state until T163), the best medal per pair, «Jugar»; Esc closes; keyboard and touch.
  - Final card like the Cañón's: «¡Castillo a salvo!» / «El castillo ha caído» (`muestra`), time held, enemies, castle life left, medal, score; «Otra vez» and «Volver al mar».
  - Medals stored per run length × difficulty in the local progress (and the account's, if the Cañón's medals live there); the «Tablón del faro» Castillo card shows the best medal.
  - Dev shortcuts like the Cañón's (`t=`, `duracion=`, `dificultad=`, `vencer=1`); a game started with any of them never ranks.
- Context: plan 013 T151/T145/T155 Outcomes, `canon-mode.tsx`, the island panel, `canon-campaign.ts` (progress counters), the board from T157.
- Scope: may touch `apps/web/app/mar/**` castle pop-up, card, mode, progress, i18n, castle e2e / must not touch engine rules, the Cañón's pop-up behaviour, `docs/DECISIONES.md`.
- Done when:
  - unit tests: medal saved per pair and best kept; shortcut flag on the result → pass
  - `E2E_PORT=<free> pnpm e2e <the castle spec> --workers=1 -g "pop-up|tarjeta|medalla"` (choose 5 min + Tranquila, win via `vencer=1`, card with medal, board shows it) → exit 0
  - Test command → exit 0
- Outcome:

## T163 — Castle ranking per run length × difficulty, local and global
- Status: pending
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Skills: none
- Depends on: T162
- Goal: Header decision 12 with the plan 013 T155 pattern: score from the sim, nine tables (3 lengths × 3 difficulties), sample crew in local mode, global ranking with an account (RPC with the plan 008/T155 anti-cheat: impossible scores and times rejected; migration written and tested, not applied). Shown in the pop-up's ranking area and on the final card (best and position). Shortcut and «Terminar partida» games never submitted.
- Context: plan 013 T155 Outcome, `apps/web/lib/mundo/ranking-global.ts`, `ranking-circuit.ts`, their migrations, T162 Outcome.
- Scope: may touch `apps/web/lib/**` ranking, castle pop-up/card, `packages/db/**`, `supabase/**` migrations, i18n, tests / must not touch engine rules, the Cañón's ranking tables, `docs/DECISIONES.md`.
- Done when:
  - unit tests: table separation, score order, rejected submissions (shortcut, quit, impossible) → pass
  - `E2E_PORT=<free> pnpm e2e <the castle spec> --workers=1 -g "ranking"` (local mode: sample crew + own score) → exit 0
  - Test command → exit 0
- Outcome:

## T164 — Sound for the castle
- Status: pending
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Skills: none
- Depends on: T161
- Goal: Reuse the Web Audio module of plan 013 T152: the battle loop and boss variant during the game, the sea ambience back at the end; new synthesized effects for building, upgrading, selling, each island's attack (beam hum, snowball thud, flame whoosh, firework pop, coin chime, bass thump, sniper crack, kept light so seven towers firing do not saturate: per-kind rate limit), castle hit, wave start, win and loss. Same volume/mute and first-gesture rules.
- Context: plan 013 T152 Outcome and its audio module, T161 Outcome.
- Scope: may touch the audio module (new sounds, no change to the Cañón's), castle mode hooks, tests / must not touch engine rules, `docs/DECISIONES.md`.
- Done when:
  - unit tests (mocked AudioContext): nothing before a gesture; per-kind rate limit; loop switches battle → boss → sea → pass
  - Test command → exit 0
- Outcome:

## T165 — Close: balance, performance, full e2e, docs, Álvaro draft
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T157, T158, T159, T160, T161, T162, T163, T164
- Goal: Close the plan.
  - **Balance with bots** for 3 run lengths × 3 difficulties: Tranquila winnable with a plain build, Normal a real fight, Tormenta hard; no single island strategy dominates (each island used by the best bot builds at least sometimes); Ibiza pays back in a reasonable time; record curves and win rates; bump `DEFENSE_CONFIG_VERSION` if numbers changed.
  - **Performance in `baja`** at the 10-min peak with bosses, seven islands at level 3 and sound on; fix obvious hot spots only.
  - **E2E**: the full castle spec and the **full suite** (`E2E_PORT=<free> pnpm e2e --workers=2`), both exit 0.
  - **Docs**: `docs/spec/estado.md` (REQ-AVE-036 retired; the castle game noted as new scope pending Álvaro's REQ), `ESTADO.md` via the status fragment, a Spanish test guide `docs/propuestas/<date>-castillo-guia-prueba.md` with an empty «Notas» section, and a Spanish **decision draft for Álvaro** `docs/propuestas/<date>-castillo-decision-alvaro.md` (lighthouse without game and its board, «Vigilancia del faro» removed with its achievement, the new game, names and texts, whether it gives a world prize or achievements) — not in `docs/DECISIONES.md`.
- Context: all Outcomes, Decisions and Proposals of this plan; `python3 tools/spec/estado.py`.
- Scope: may touch `packages/engine/src/defense/**` (balance, bot tests), `apps/web/e2e/**`, small perf/stability fixes in `apps/web/app/mar/**`, `docs/spec/estado.md`, `docs/propuestas/` / must not touch `docs/DECISIONES.md`, the Cañón's balance, features beyond fixes.
- Done when:
  - `pnpm exec vitest run packages/engine/src/defense --testTimeout=60000` → exit 0
  - `E2E_PORT=<free> pnpm e2e --workers=2` → exit 0
  - `PYTHONUTF8=1 python3 tools/spec/estado.py` → exit 0
  - Test command → exit 0
- Outcome:

## Decisions
- 2026-10-05 plan: header decisions 1–14 from the conversation with Hernán; Isla del Sonido confirmed; Benidorm added as the seventh island, as a long-range sniper (Nochevieja already stuns) (Hernán, orchestrator)

## Proposals (new scope)
- 2026-10-05 plan: a world prize per medal and achievements for the castle, like the Cañón's (decision 13; for Hernán and Álvaro)
- 2026-10-05 plan: boss attacks against islands or the plane in a later version (decision 6 keeps them path-only)

## Log
- 2026-10-05 drafted in the session with Hernán
- 2026-10-05 approved by Hernán; not launched, waits for plan 013 to finish (then `/orchestrator` resumes it and sets `Status: active`)
