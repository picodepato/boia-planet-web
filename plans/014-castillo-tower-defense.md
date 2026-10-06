# Plan 014 — The lighthouse becomes the map board, and «Defensa del Castillo» (tower defense)

Status: active
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
5. **One path.** Enemies come along **one fixed path**, the same in every game (the ranking compares everyone on the same map): it starts at an **interdimensional vortex** on the open-sea side of the arena's edge (away from Boia 7 and the race lines) — a spinning spiral portal on the water in **lilac and black**, from which every enemy appears (short emerge effect) — and **spirals inward around the castle** (about 1¼ turns), with **S sections** on the outer turn and a **zigzag** in the inner part, ending at the castle. Between the spiral's turns there is room for at least two rows of islands, and the corners are where area towers shine. A normal enemy takes **about 40 s** (`muestra`) from the edge to the castle; this sets the path length and the arena radius. The path is marked on both sides with **floating barriers**, not spaced buoys: a continuous floating boom (rope or rail on small floats, Arcilla clay style) that reads as a clear lane from the high camera, with the **race buoys** (`apps/web/app/mar/engine/race-props.ts`) only as accents at the sharp corners. Enemies follow it by distance; they never leave it and never collide with islands. **Nothing can be built on the path** (minimum distance from its centre line). An enemy that reaches the castle damages it and disappears.
6. **Enemies.** The Cañón's common enemies, minibosses and bosses with their models, in waves; each kind has its own path speed and life here. Bosses and minibosses only follow the path (no attack patterns, no summons in this plan), with much more life and more castle damage. Each kill gives coins straight to the purse (no pickups).
7. **Plane.** The player flies the boat with the «Entradas» wings (`apps/web/app/mar/engine/flight.ts` `Wings`) freely over the arena (keyboard and touch, like sailing). It **shoots on its own** at the nearest enemy in range (like the Cañón's basic `canon` weapon) and its damage can be upgraded with coins to level 3. It cannot be hit. Building happens only **inside a ring around the plane**.
8. **Building.** A «Construir» button opens the seven islands with their cost; the player places one inside the plane's ring, off the path, not overlapping another island or the castle (live valid/invalid preview). Tapping a built island shows **Mejorar** (to level 3, more damage) and **Vender** (part of what it cost back, `muestra`). Islands are the existing models (`buildIsland` in `apps/web/app/mar/engine/islands.ts`, or the Blender glb when it is loaded) **normalized to the same footprint**: each is built at its normal size, measured once per kind (bounding box; the glb manifest's `radius`) and scaled uniformly so every island covers the same circle on the water, about **1/3 of the castle's diameter**; height stays free (uniform scale, no squashing: Benidorm stays taller than Ibiza). Each level adds **+10 %** (level 3 = 1.2×); the build footprint uses the level-3 size, so upgrading never makes islands overlap. **No limit** on how many islands: only coins and free space.
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
- Status: done
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
- Outcome: faro on the old castle spot with the «Tablón del faro» (3 cards, «Rumbo a…»); castle minigame island at Maq [-14.48, 14.21] with «Próximamente» panel, `CASTLE_OPEN_SEA_BEARING` 2.09 rad; «Vigilancia del faro» and the 2D minigame layer removed, achievement dropped (doc schema 9 + Supabase migration not applied); REQ-AVE-036 retired · 8dd9e7c

## T158 — Tower defense simulation: path, waves, castle, plane, coins, medals, score
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: none (after plan 013 is done)
- Goal: A new headless, deterministic sim `packages/engine/src/defense/` (same style as `survivors/`: seeded RNG, fixed step, pure state, `DEFENSE_CONFIG` + `DEFENSE_CONFIG_VERSION`), header decisions 5, 6, 7 (shooting and its upgrades), 10, 11 and 12.
  - The path: one polyline per header decision 5 (spiral inward with S and zigzag sections; data in the config, the same for every run length and difficulty), sampled by arc length; tested: no self-intersection, gap between turns ≥ path width + two island footprints, ≈ 40 s for a normal enemy; enemies advance by distance with their own speed; reaching the end damages the castle and removes the enemy.
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
- Outcome: headless sim `@boia/engine/defense` (spiral path from the vortex, waves, castle, plane, medals, score, tower hooks); castle at (0,0), castle r 208, islandRadius 70, path width 90, vortex at 980 r 90, arena 1120 · 535b4e6

## T159 — The seven islands: attacks, levels, building, upgrade and sell
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T158
- Goal: Header decisions 8 and 9 inside the sim.
  - Build rule: inside the plane's ring, at a minimum distance from the path's centre line, not on or next to the vortex at the path's start (minimum distance from it), no overlap with other islands or the castle; cost; returns a reason when invalid (for the HUD preview). Every island kind has the **same footprint radius** in the config (header decision 8: the level-3 size, about 1/3 of the castle's diameter), no per-kind radius; no cap on the number of islands.
  - The seven towers with levels 1–3 (damage and, where it fits, range/rate): Faro sweeping beam; Nochevieja snowballs with short stun and a different target each shot when possible; Halloween fire cone with burn over time; Puerto fireworks mortar with area explosion; Ibiza farm with coins every few seconds; Isla del Sonido bass aura; Benidorm long-range sniper on the strongest enemy in range. Reuse the Cañón's weapon kinds' targeting/geometry helpers where they fit.
  - Upgrade (to 3) and sell (part of the money back); state exposes each tower's last shot/effect for the view.
  - Bot tests: a simple building bot can hold Tranquila with gold, Normal with a real fight; record numbers (T165 balances them).
- Context: T158 Outcome, `packages/engine/src/survivors/config.ts` weapons (`laser`, `canon`, `confetti`, `fireworks`, `subwoofer`) and their code in `sim.ts`.
- Scope: may touch `packages/engine/src/defense/**`, shared helpers as in T158 / must not touch the Cañón's balance, the web app, `docs/DECISIONES.md`.
- Done when:
  - unit tests: each tower hits what it should (beam sweep, stun duration and target rotation, burn ticks, area radius, farm income, aura, sniper picks the strongest in range); build rule rejects path/vortex/overlap/outside-ring; upgrade/sell money; bot results recorded → pass
  - `pnpm exec vitest run packages/engine/src/defense --testTimeout=60000` → exit 0
  - Test command → exit 0
- Outcome: seven towers with levels 1–3, build rule (ring, path, vortex, overlap), upgrade, sell 60 %; DEFENSE_CONFIG_VERSION 2; bot holds Tranquila with gold, Normal 5 min at 75 %, falls in Tormenta · 31ad326

## T160 — The 3D arena: sinking, higher camera, path buoys, enemies, islands and the plane
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T157, T158
- Goal: Header decisions 4, 5 and 7 in the view (`apps/web/app/mar/engine/defense-*.ts`, driven by the T158 sim; the T159 effects are added as soon as T159 is in main, else stubs that T161 completes).
  - Entering the game: every other island and decor sinks (short animation, instant with reduced motion), world layers hide (Cañón `HideLayer`), the camera rises to the higher top-down view on the castle; at the end everything comes back exactly as it was.
  - The path marked on both sides with the floating barriers of header decision 5 (one instanced or extruded geometry per side, cheap in `baja`), race buoys only at sharp corners; the **vortex** at the path's start (header decision 5): a flat spinning spiral on the water in lilac and black (shader or animated texture, Arcilla style, a soft glow; static with reduced motion; cheap in `baja`), each enemy emerging from it with a short rise/fade; enemies and bosses with the Cañón's models (`survivors-view.ts`, `survivors-props.ts`, kraken/fantasma/shark/vecino views) moving along it; castle damage feedback.
  - The plane: the boat with the «Entradas» wings, flying at a fixed height, steered with the sailing controls; its shots; the build ring drawn around it when building.
  - Built islands: normalized per header decision 8 (build at normal size, measure once per kind and cache, uniform scale to the shared footprint ≈ 1/3 of the castle's diameter, +10 % per level; same rule for the glb models via the manifest `radius`), a level mark, and their effects (beam, snowballs, fire, fireworks, coins popping on Ibiza, bass wave, Benidorm's sniper tracer).
  - Performance: `baja` quality with the longest run's peak wave and seven islands at level 3 keeps a reasonable frame time (measured in the e2e browser, numbers recorded).
- Context: `apps/web/app/mar/survivors.ts` (`HideLayer`), `canon-mode.tsx` (how the Cañón enters and leaves), `engine/mar3d.ts` (camera, decor, `Wings`), `engine/flight.ts`, `engine/race-props.ts`, `engine/islands.ts`, `engine/survivors-view.ts`, the castle model (`decor-model.ts`).
- Scope: may touch `apps/web/app/mar/engine/**` (new defense view files, small hooks in `mar3d.ts`), `apps/web/app/mar/` game mode file for the castle, tests / must not touch the Cañón's behaviour, the engine sim rules, `docs/DECISIONES.md`.
- Done when:
  - unit tests: vortex placed at the path's start, on the open-sea side of the arena, at a minimum distance from Boia 7 and clear of the race lines (legs Boia 6 → 7 and 7 → 8), and removed on exit; sinking state and restore; camera pose for the arena; barrier placement along both sides of the path (no gaps, never on the castle); island normalization (all seven kinds give the same footprint within 5 % at each level, level 3 = 1.2× level 1, footprint matches the sim's radius) → pass
  - `E2E_PORT=<free> pnpm e2e <the castle spec> --workers=1 -g "arena"` (start with a test shortcut: islands hidden, castle visible, enemies on the path, plane moves; leaving restores the world) → exit 0
  - Test command → exit 0
- Outcome: 3D arena in engine/defense-*.ts: world sinks, top-down camera, barriers, lilac/black vortex along CASTLE_OPEN_SEA_BEARING, Cañón enemies, plane, normalized islands with effects; baja p95 33 ms at the 10-min Tormenta peak with 7 level-3 islands · a3eb373

## T161 — HUD and controls: Construir, placing, Mejorar/Vender, life, time, coins
- Status: done
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
- Outcome: castle HUD (life, time, wave, coins, boss bar), Construir/placing/Mejorar/Vender with touch and keyboard, pause menu with sound and «Terminar partida», minimal end card; dev `monedas=N` · ff56a4f

## T162 — The castle's pre-game pop-up, final card and medals
- Status: done
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
- Outcome: castle pop-up (3 difficulties × 5/7/10 min, best medal per pair, ranking area), final card with medal/score/«Otra vez», medals as progress counters `castillo:<min>-<dif>:medalla`, board shows the best; `vencer=1`, `oferta=1` · efaa1b0

## T163 — Castle ranking per run length × difficulty, local and global
- Status: running (attempt 1)
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
- Status: done
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Skills: none
- Depends on: T161
- Goal: Reuse the Web Audio module of plan 013 T152: the battle loop and boss variant during the game, the sea ambience back at the end; new synthesized effects for building, upgrading, selling, each island's attack (beam hum, snowball thud, flame whoosh, firework pop, coin chime, bass thump, sniper crack, kept light so seven towers firing do not saturate: per-kind rate limit), castle hit, wave start, win and loss. Same volume/mute and first-gesture rules.
- Context: plan 013 T152 Outcome and its audio module, T161 Outcome.
- Scope: may touch the audio module (new sounds, no change to the Cañón's), castle mode hooks, tests / must not touch engine rules, `docs/DECISIONES.md`.
- Done when:
  - unit tests (mocked AudioContext): nothing before a gesture; per-kind rate limit; loop switches battle → boss → sea → pass
  - Test command → exit 0
- Outcome: castle sound on the plan 013 Web Audio module: battle/boss loop, sea back at the end, build/upgrade/sell, seven tower attacks with per-kind rate limit, castle hit, wave, win/loss; done by Codex · aaa87fb

## T166 — Tabarca lighthouse island redesigned in Blender (the board at the entrance)
- Status: done
- Model: fable (Fable 5.1)
- Skills: blender-modeling-workflow, blender-asset-validation, blender-iterative-refinement
- Depends on: T157
- Goal: Redesign the `faro` island of `/mar` (`minijuegos/faro` in `tools/blender/lugares.json`), now at the old castle spot near the start (T157), as the **Faro de Tabarca** (Isla de Nueva Tabarca, Alicante): a low, flat, rocky island with dry scrub and the real lighthouse's silhouette — the 19th-century stone keeper's house with its central square tower and lantern. **The lighthouse is the protagonist and fairly big**: it stands at the entrance of the world, where the castle used to look good, so it must read from far away from the boat's camera like the castle did (similar visual weight). Built reproducibly with the repo's Blender pipeline (`tools/blender/`, Blender 4.0 at `C:/Program Files/Blender Foundation/Blender 4.0`), in the main world **Arcilla**'s style (match the other island and boat models: palette, low-poly clay look, triangle budget like the other islands), exported as GLB and wired where the Faro island is drawn, with the collision footprint matching the island at its new spot. Animated lantern light (cheap) if the other models animate; cheap in `baja`. In the castle game the Faro tower uses the same model, normalized per header decision 8.
  - **No approval stop** (Hernán accepts it in advance): render a contact sheet (the island from 4 angles + the in-game view from the boat arriving at the start, mobile and desktop) for the record, use it for the agent's own visual review, and finish.
- Context: plan 013's skipped T157 (same task, moved here); T157 Outcome (new spot of `faro`); `tools/blender/` (`lugares.json`, `places/`, `islas/`, `export_islas_glb.py`, `isla3d.schema.json`, `style.py`, `mundo_arcilla.py`), `art/islas/3d/manifest.json`, `apps/web/app/mar/engine/island-models.ts`, `islands.ts`, `compact.ts`, `decor-model.ts` (the castle's size at that spot, as the reference for visual weight), `apps/web/lib/i18n/es-zonas.ts`. Only the island's look: the «Tablón del faro» panel is T157's.
- Scope: may touch `tools/blender/**` (new script for this island), `art/islas/3d/**` (new GLB + manifest), `apps/web/app/mar/engine/island-models.ts`/`islands.ts` wiring, the `faro` place's size/collision in `packages/world/src/worlds/arcilla/map.ts` if the bigger lighthouse needs it (no overlap with other places, buoys on water), `apps/web/public/` model output if that is where GLBs ship, tests / must not touch the board panel, the castle game, other islands, `apps/web/public/atlas/`, `docs/DECISIONES.md`.
- Done when:
  - the Blender script rebuilds the GLB from scratch (command recorded in the status section) and `tools/blender/check.py` (or the islands' validation) passes
  - the contact sheet is saved and its path recorded in the status section
  - an e2e or unit test checks the Faro island loads the new model; world places still do not overlap → pass
  - Test command → exit 0
- Outcome: Faro de Tabarca GLB (12.2k tris) from tools/blender/export_islas_glb.py --only faro, LIGHTHOUSE_RADIUS 2.3 u_maq, procedural beam kept via `IslandBuild.keep`; contact sheet outside the repo (orchestrator-attach/boia-planet-hernan-T166/faro-tabarca-hoja.png) · f7d1610

## T167 — Remove the boat flag option from the boat menu
- Status: done
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Skills: none
- Depends on: none
- Goal: The «Bandera» choice in the boat menu (the Barco shop/dressing: `slot="flag"`, `FLAG_LOOKS`) is buggy and not important; remove it (Hernán, 2026-10-05).
  - The boat menu no longer shows the «Bandera» section, and nothing else in the UI offers to change the flag; the shop intro text no longer lists the flag.
  - The boat no longer draws an equipped flag from that choice; boats look right without it (no empty mast slot, no errors). Any flag that is part of a boat's own model stays as it is.
  - Saved progress that holds owned or equipped flags keeps loading (local mode and Supabase mode): the flag fields are ignored or dropped on load, no crash, nothing else in the document changes; no refund (coins `muestra`).
  - Remove the now-unused flag code, catalog entries and i18n keys; the other slots (boats, skins, wake, mascot) work exactly as before.
- Context: `apps/web/lib/barco/shop.tsx` (l.55, 64, 71-73, 251-256), `apps/web/lib/barco/dressing.ts` (`FLAG_LOOKS`), `apps/web/app/mar/engine/ship-model.ts` (flag drawing), `apps/web/lib/i18n/es-lib.ts` (`barco.shop.bandera`, `barco.shop.sinBandera`, `barco.shop.barcosSkinsBanderaY`), `packages/engine/src/world/runtime.test.ts`, `apps/web/e2e/tienda.spec.ts`; find any other reader of the equipped flag with grep.
- Scope: may touch the files above, the store schema/load code for the flag fields, tests and e2e / must not touch the other cosmetic slots' behaviour, the castle game files, `docs/DECISIONES.md`.
- Done when:
  - unit tests: a saved document with an owned and equipped flag loads without error and without the flag; the boat model builds with no flag → pass
  - `grep -rn "barco.shop.bandera\|sinBandera\|FLAG_LOOKS" apps packages` → nothing left
  - `E2E_PORT=<free> pnpm e2e tienda.spec.ts --workers=1` (no «Bandera» section; boats, wake and mascot still equip) → exit 0
  - Test command → exit 0
- Outcome: «Bandera» section and flag drawing removed; saved flags dropped on load (local and Supabase), no refund; done by Codex · 0ffe77f

## T165 — Close: balance, performance, full e2e, docs, Álvaro draft
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T157, T158, T159, T160, T161, T162, T163, T164, T166, T167
- Goal: Close the plan.
  - **Balance with bots** for 3 run lengths × 3 difficulties: Tranquila winnable with a plain build, Normal a real fight, Tormenta hard; no single island strategy dominates (each island used by the best bot builds at least sometimes); Ibiza pays back in a reasonable time; record curves and win rates; bump `DEFENSE_CONFIG_VERSION` if numbers changed.
  - **Performance in `baja`** at the 10-min peak with bosses, the vortex spinning and enemies emerging from it, the full floating barriers along the path, a full arena of islands at level 3 (no cap: as many as fit) and sound on; fix obvious hot spots only.
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
- 2026-10-06 T162: medals as progress counters `castillo:<min>-<dificultad>:medalla` (rank 1–3, raised only), local and with the account, no new tables; `vencer=1` starts 3 s before the end; new `oferta=1` opens the island panel keeping shortcuts; any shortcut start never ranks; shortcut medals saved only where shortcuts give prizes (dev, e2e); pop-up reuses the Cañón difficulty picker; «Otra vez» repeats the setup and restarts the battle loop; «Próximamente» key removed (agent)
- 2026-10-06 T164: shared audio test helpers moved to `audio-test-helpers.ts`; +29 lines in `canon-audio.ts` with no Cañón change; `mar-client.tsx` and `castillo-mode.tsx` kept CRLF as in the repo (wrapper restored them after Codex converted to LF); Codex timed out during its own lint, wrapper ran Done-when itself (agent)
- 2026-10-06 T161: placing starts under the plane and follows it, tap moves it inside the ring, game keeps running while building; keys B/1–7/Enter/I/U/V/Esc; sell in one tap without confirm; one bottom strip above «Entradas» switching content; zoom rail hidden in the arena; dev `monedas=N` never ranks; minimal end card for every ending (T162 adds medal/score/«Otra vez»); `GameSoundMenu` and `BossBar` extracted with no Cañón change; build/selection state on `DefenseRun` (agent)
- 2026-10-06 T166: faro collision one circle, LIGHTHOUSE_RADIUS 2.3 u_maq (dome ~16.6 scene vs old castle 13 r); no beam in the GLB, procedural beam kept through new optional `IslandBuild.keep` on the island group (sinks/restores with T160); procedural faro redrawn to the model layout; mar3d.ts back to LF after T160 committed it CRLF (agent)
- 2026-10-06 T160: arena rotated in the view (`arenaFrame`, vortex along CASTLE_OPEN_SEA_BEARING), sim config untouched; planet wrap centred on the castle in the arena; camera elevation 1.2 rad, landscape shows the whole arena, portrait full height and 3/4 width following the plane; boat restored to its pre-game spot on exit; built islands use the hand-made `buildIsland` model (manifest radius accepted); glow points hide at ~1/3 sunk (castle glows too); test shortcut `?minijuego=castillo&duracion=&dificultad=&t=&seed=&islas=1` never ranks; dev «Salir de la arena» button until T161 (agent)
- 2026-10-06 T157: castle island at Maq [-14.48, 14.21] = (-1080, 1060) in /mar, r 208 u, ~443 u from Boia 7, clear of legs 6→7 and 7→8; open-sea bearing `CASTLE_OPEN_SEA_BEARING` 2.09 rad in engine/compact.ts; the 1120 u arena crosses the planet wrap edge (agent)
- 2026-10-06 T157: faro proximity 3.4 → 2.8 u_maq (board must not open from the start ring nor overlap the WhatsApp buoy panel); fast chest 1 moved to [-10.6, 15.2] (was inside the castle) (agent)
- 2026-10-06 T157: whole 2D minigame layer removed (`pageAuthority` → session.ts); castle not in the engine minigame registry yet; faro achievement points/coins stay in the ledger, views hide it; Guardacostas v3 asks for one Cañón game; local doc schema 9; REQ-AVE-036 note cites D-20 + «decisión 2 del 2026-10-05» (checker needs a D-NN) (agent)
- 2026-10-06 T157: board opens expanded, three columns on desktop, stays open after «Rumbo a…», mark clears on arrival; mobile e2e step taps instead of Enter (Enter did nothing on mobile, cause not found); textos-zonas.md and es-zonas.ts edited by hand (agent)
- 2026-10-06 T159: DEFENSE_CONFIG_VERSION 2; tower damage = draft × 0.7 (seed 7 bot: Tranquila 5/7/10 gold at 100 %, Normal 5 min 75 %, 7/10 min 100 %, Tormenta falls at 129–158 s); snowball and sniper hit instantly, one mortar rocket in the air per tower; bosses stunned 0.25×; sell = floor(60 % of spent); building allowed while paused; Faro beam updates its last shot in place; local beam/cone helpers in defense/geometry.ts (Cañón helpers private) (agent)
- 2026-10-06 run: T159 integration failed only by vitest timeouts (23, all "Test timed out", incl. untouched barco/world suites) while T156 runs the full e2e; main reverted (a2245f5/838bfca); not counted as a failure, re-integrate the same branch once T156 is done (orchestrator)
- 2026-10-06 T158: subpath export `@boia/engine/defense` in packages/engine/package.json (outside listed scope, follows ./survivors) (agent)
- 2026-10-06 T158: wave schedule independent of the seed (same waves for everyone in a table); seed only sets lane offsets; enemy speed = pace × length / normalWalkS (40 s) (agent)
- 2026-10-06 T158: geometry relative to the castle at (0,0): castle r 208, islandRadius 70, path width 90, vortex at 980 u (r 90), arena 1120; zigzag teeth point inward so the turn gap stays 437 u (370 needed) (agent)
- 2026-10-06 T158: life bonus only when the castle holds; quit/abandoned/startAtS/unranked → ranked:false; plane-only seed 7 falls in Normal/Tormenta, holds Tranquila 5 min with 24 % (muestra, T165 balances) (agent)
- 2026-10-06 T167: flag fields dropped from the saved document on load (local and Supabase merge), no refund; Codex also touched mar3d.ts, mar-client.tsx, shop-model.ts, ship-look.ts, menu/sections/barco.tsx, packages/store/src/local.ts (agent)
- 2026-10-05 run: started in parallel with plan 013's close at Hernán's request; only tasks that do not clash with T156 run before it (T158, T167); T157 waits for T156 (both touch achievements, minigame e2e and `docs/spec/estado.md`); 3 agents at once while T156 runs (orchestrator)
- 2026-10-05 plan: no building on the vortex (T159); vortex test checks the open-sea side away from Boia 7 and the race lines (T160); `baja` performance includes the vortex and the barriers (T165) (Hernán, orchestrator)
- 2026-10-05 plan: T167 added, remove the boat flag option from the boat menu (buggy, not important); saved flags ignored on load, no refund (Hernán, orchestrator)
- 2026-10-06 plan: the path starts at an interdimensional vortex (lilac and black spinning spiral) from which enemies appear (Hernán)
- 2026-10-06 plan: path = spiral inward around the castle with S and zigzag sections, same for every game, ≈ 40 s for a normal enemy; lane marked with continuous floating barriers (clearer from the high camera and cheaper than many buoys), race buoys only as accents; no approval stops for the path or the Tabarca island (Hernán accepts in advance) (Hernán, orchestrator)
- 2026-10-06 plan: T166 added, the Tabarca lighthouse island in Blender moved from plan 013 (its T157, skipped there); renumbered T166 because T157 is taken here; the lighthouse big and the protagonist at the entrance; model Fable 5.1 (Hernán, orchestrator)
- 2026-10-05 plan: islands as towers normalized to one footprint (≈ 1/3 of the castle, height free, +10 % per level, footprint at level 3), no cap on islands (Hernán, orchestrator)
- 2026-10-05 plan: header decisions 1–14 from the conversation with Hernán; Isla del Sonido confirmed; Benidorm added as the seventh island, as a long-range sniper (Nochevieja already stuns) (Hernán, orchestrator)

## Proposals (new scope)
- 2026-10-06 T162: the T161 «construir…» castle e2e on desktop depends on coins earned during slow flights and flakes under load — for T165 (agent)
- 2026-10-06 T161: turbo and the speed readout stay visible during the castle game (agent)
- 2026-10-06 T166: from the start ring the faro sits at the left edge of the frame (castle's old framing); a `.gitattributes` eol=lf rule (CRLF keeps coming back) (agent)
- 2026-10-06 T160: Blender glb models for the built islands; clouds drift over the arena; the saved boat position can be the plane's during a game (moved to free water on reload) (agent)
- 2026-10-06 T157: `mundos/arcilla/mapa.json` still describes the lighthouse minigame; generic `win_minigame`+`played` achievement logic now unused; es-zonas.ts has 2 keys not in textos-zonas.md (`naufrago.revisit`, `achievements.castaway.description`) so the i18n-zonas generator would delete them (agent)
- 2026-10-06 T159: Tormenta too harsh (bot falls before 160 s, cannot afford early islands); Normal 7/10 min too easy — for T165 (agent)
- 2026-10-06 T158/T167: the full vitest suite times out under load (survivors sims) when 3 agents run; consider splitting the slow survivors sims out of the default run (agent)
- 2026-10-05 plan: a world prize per medal and achievements for the castle, like the Cañón's (decision 13; for Hernán and Álvaro)
- 2026-10-05 plan: boss attacks against islands or the plane in a later version (decision 6 keeps them path-only)

## Log
- 2026-10-05 drafted in the session with Hernán
- 2026-10-05 amended: island size normalization (decision 8, T159, T160, T165)
- 2026-10-05 approved by Hernán; not launched, waits for plan 013 to finish (then `/orchestrator` resumes it and sets `Status: active`)
- 2026-10-06 amended: T166 Tabarca lighthouse island (from plan 013)
- 2026-10-06 amended: path shape and floating barriers (decision 5, T158, T160); T166 without approval stop
- 2026-10-06 amended: vortex at the path's start (decision 5, T160)
- 2026-10-05 amended: T167 remove the boat flag option (T165 depends on it)
- 2026-10-05 amended: vortex build rule (T159), vortex placement test (T160), vortex and barriers in the performance check (T165)
- 2026-10-05 23:12 T158 launched · attempt 1 · agent ae2687a0324910a9e (opus)
- 2026-10-05 23:12 T167 launched · attempt 1 · Codex via wrapper agent adf4124efda2d70e1 (sonnet)
- 2026-10-06 00:44 T158 integrated → 535b4e6 (tests ok); worktree and branch removed
- 2026-10-06 00:45 T167 done by agent (Codex) → integrating
- 2026-10-06 00:46 T159 launched · attempt 1 · agent a154089e69d570357 (opus)
- 2026-10-06 00:48 T167 integrated → 0ffe77f (tests ok); worktree and branch removed
- 2026-10-06 01:44 T159 done by agent (0e1f5bb); integration tests_failed by timeouts only under load → reverted, re-integrate after T156
- 2026-10-06 03:33 plan 013 done; pushed main to Vercel (e7425ab) on Hernán's request
- 2026-10-06 03:38 T159 re-integrated → 31ad326 (tests ok); worktree and branch removed
- 2026-10-06 03:40 T157 launched · attempt 1 · agent abc6cf441cc52c360 (opus)
- 2026-10-06 04:20 T157 integrated → 8dd9e7c (tests ok); worktree and branch removed
- 2026-10-06 04:22 T160 launched · attempt 1 · agent acf37d2f8fd69568f (opus)
- 2026-10-06 04:22 T166 launched · attempt 1 · agent a6c8d5b95e5013f24 (fable)
- 2026-10-06 04:51 T160 integrated → a3eb373 (tests ok); worktree and branch removed
- 2026-10-06 04:54 T166 done by agent; integration conflict with T160 in mar3d.ts → sent back to the same agent
- 2026-10-06 04:55 T161 launched · attempt 1 · agent a00ad88501b2c5a66 (opus)
- 2026-10-06 05:03 T166 integrated → f7d1610 (tests ok); worktree and branch removed
- 2026-10-06 T161 done by agent (1aacfef); integration conflict with T166 in mar3d.ts (line endings) → sent back to the same agent
- 2026-10-06 05:55 T161 integrated → ff56a4f (tests ok); worktree and branch removed
- 2026-10-06 05:57 T162 launched · attempt 1 · agent af7ab6933988553d9 (opus)
- 2026-10-06 05:57 T164 launched · attempt 1 · Codex via wrapper agent abd1a8ea108952897 (sonnet)
- 2026-10-06 06:15 T164 integrated → aaa87fb (tests ok); worktree and branch removed
- 2026-10-06 T162 done by agent; conflict with T164 in castillo-mode.tsx/mar-client.tsx → sent back to the same agent
- 2026-10-06 06:55 T162 integrated → efaa1b0 (tests ok); worktree and branch removed
- 2026-10-06 06:56 T163 launched · attempt 1 · Codex via wrapper agent a84b410b9f9bd60bd (sonnet)
- 2026-10-06 push offer T157 wait hit the 2 h tool limit, not restarted; Hernán told in the session
