# Plan 012 — Cañón «Que no pare la música», BETA 3 (acts 1 and 2 with bosses)

Status: active
Created: 2026-10-05
Base branch: main
Goal: Apply Hernán's beta 2 notes (weapons too weak to clear waves even in Tranquila, evolutions never reached, two weapons redesigned, rare elite drops, optional HP and damage readouts), then build the boss layer of the design reference: the generic boss system, both minibosses (Vecino Quejica, Tiburón Martillo with its chest), the act-1 final boss (Barco Pirata Fantasma) and, pulled forward from beta 4, the act-2 final boss (Kraken); medals, the campaign act 1 → act 2 with act and difficulty chosen on the island panel, the boss HUD and the final card. Also closes the e2e loose ends of plan 011. Ends with bot balance including bosses, `baja` performance, e2e, docs and the beta 3 test guide.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task (this machine is Windows 10, Git Bash): the two `packages/db` suites need a local Postgres that this machine does not have, hence the exclude; `PYTHONUTF8=1` makes the Python checks read UTF-8; if a guard blocks the chained test command, run its steps one by one. E2E: `E2E_PORT=<free port> pnpm e2e <spec files> --workers=1` (first time in a worktree: `pnpm --filter @boia/web exec playwright install chromium`); the machine is slow under load, rerun only failing specs; the full e2e run is done once by the orchestrator at the end of the plan, never per task. UI strings only by key in `apps/web/lib/i18n/`, never loose strings in components. Content (names, texts, point amounts) stays `muestra`. Never commit `apps/web/public/atlas/`, `.claude/launch.json` or any `.env*` file other than `.env.example`. Never push or deploy. Never edit `docs/DECISIONES.md`. Local mode (D-20, no Supabase env vars) must keep working exactly as today; Supabase mode must not break. Work only on the main world **Arcilla**; **Acuarela** stays hidden and is not kept in parity. Skills: each task's block names the skills it may invoke with the Skill tool; invoke none other.

**Required reading for every task:** `docs/propuestas/2026-10-04-canon-survivors.md` (the full design reference; this beta builds the «Beta 3 · Primer acto» row of its roadmap **plus the Kraken from the beta 4 row**; every structure must stay ready for act 3, the Capitán, the pre-game pop-up, per-medal rewards and ranking), `docs/propuestas/2026-10-04-canon-beta2-guia-prueba.md` (the beta 2 test guide) and plan 011's Outcomes and Decisions (`plans/011-canon-beta2.md`). Where this plan and those documents disagree, this plan wins.

Decisions of 2026-10-05 that every task follows (interview, Hernán):
1. **Beta 2 notes** (played in Tranquila): weapons never dealt enough damage to clear a wave → raise weapon damage clearly; evolutions were never reached in a normal game → make them reachable; **Fireworks** («the rocket that explodes in an area») and **Festival laser** look and attack badly → redesign both, keeping their slot, their evolution pairing and their ids where possible.
2. **Elite drops**: an elite (the enemies with the gold ring) drops an item with **5 % chance**, the item type at random among three: **Imán total** (every note on the map flies to the boat), **Llama** (10 s power-up: a short-range flame ahead of the boat that removes 100 % of a common or elite enemy's hp in 0.4 s of contact) and **Salvavidas** (heals: lowers the water on board). The existing level-up card «Salvavidas» (saves once from flooding) keeps working; to avoid two things with one name, the pickup is called «Salvavidas» and the card is renamed «Segunda vida» (`muestra`).
3. **HP and damage readouts**: two options for any player, in the pause menu, off by default: «Mostrar vida» (hp bars over enemies) and «Mostrar daño» (floating damage numbers). Remembered per browser (try/catch storage).
4. **Kraken pulled forward**: act 2's final boss is the Kraken in this beta. Act 3 (Capitán, apagón) stays in beta 4 and shows as locked.
5. **Act and difficulty on the panel**: once unlocked, the player chooses the act (Acto 1 / Acto 2) and the difficulty on the Cañón island panel, next to «Jugar», like T131's difficulty buttons. The full pre-game pop-up stays for beta 4. Dev shortcut `acto=<n>` like the other shortcuts.
6. **Plan 011 loose ends** go in: the 2 e2e failing outside the Cañón, the flaky `minigame-layer` test, e2e for boost pads and ramps during a game. (The «1–3» card help text was already fixed by T132.)
7. **Nothing else pulled forward**: no Capitán, apagón, pre-game pop-up, sound, per-medal rewards, achievements, mascot, ranking. The reward stays 150 pts + 50 coins once per season; session `won` = bronze or better (= surviving 7:00); `canon` and `guardacostas` unchanged. The «BETA» label and the dev shortcuts stay.
8. **Ship order:** T133 runs first and Hernán pushes it to Vercel to try it (T146 may run in parallel since it touches no game code); the rest runs automatically after.
9. **Models:** each task block names its model (Fable 5.1, Opus 5.5, Sonnet 5.5, or Codex for short Opus-level tasks, through a wrapper agent, falling back to Opus when out of credits).
10. Every task that changes `SURVIVORS_CONFIG` in a way that ships bumps `SURVIVORS_CONFIG_VERSION` once (at most once per task). Parallel tasks that both bump collapse at merge; the orchestrator notes it.

## Tasks

## T133 — Beta 2 notes: stronger weapons, reachable evolutions
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: none
- Goal: In Tranquila an average player who dodges must be able to clear waves; in Normal it must still feel like a fight.
  - Raise weapon damage clearly (base and per-level tables), starting with the water cannon a player has from second 0, so that the first minutes' waves can be cleared and later waves are thinned out by a build of 3–4 weapons. Keep the enemy hp growth from T132 unless the bots say otherwise.
  - Make **evolutions reachable** in a normal 7:00 game: a greedy card-picking bot that goes for one weapon + its vinyl evolves it before ~5:00 in Normal for most seeds (tune XP curve, card weighting towards owned weapons/vinyls, or the evolution condition; record what you chose and why).
  - Extend the bot balance tests of T132: per difficulty, a dodging + greedy bot kills a clearly higher share of spawned enemies than in config v6 (record before/after), clears the screen at least once in the first 2 minutes in Tranquila, and reaches an evolution as above.
  - Bump `SURVIVORS_CONFIG_VERSION`.
- Context: header decisions 1 and 10; T132 Outcome and decisions in `plans/011-canon-beta2.md`; `packages/engine/src/survivors/config.ts`, `cards.ts`, `bots.ts`, the balance tests; the beta 2 test guide («Qué tocar y dónde»).
- Scope: may touch `packages/engine/src/survivors/**`, the beta 2 test guide (a short «Notas» entry with Hernán's notes and the values changed), i18n card texts whose numbers change / must not touch weapon visuals, Fireworks/Laser mechanics (T134), `apps/web/app/**` beyond i18n, `docs/DECISIONES.md`.
- Done when:
  - `pnpm exec vitest run packages/engine/src/survivors --testTimeout=60000` → exit 0 with the new balance assertions
  - Test command → exit 0
- Outcome: weapons ~1.6× damage (canon 16 every 0.7 s), card weighting toward owned weapons/paired vinyls (evolution before 5:00 in 6/6 Normal seeds), Tormenta 1.6/1.6/1.6, kill share Tranquila 0.97 / Normal 0.96 / Tormenta 0.91, config v7; 1470 unit tests → 8b471b7

## T134 — Redesign Fireworks and Festival laser
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T133
- Goal: Replace the two weapons Hernán disliked with designs that read well and feel different from the rest, keeping their slot, card flow, per-level tables and evolution pairing (Laser + Techno = Show de Láseres):
  - **Fireworks → «Traca»** (`muestra` name): the boat drops a string of firecrackers in its wake every few seconds; each one bursts when an enemy touches it (small, crisp bursts, no big area cloud). Rewards kiting enemies through your trail. Levels add firecrackers, damage, shorter cooldown.
  - **Festival laser → «Focos»** (stage spotlights): 1–3 beams that lock on the nearest enemies and burn them continuously while in range, moving smoothly from target to target. Levels add beams, damage, range. **Show de Láseres** becomes many beams sweeping in a fan.
  - Both in the simulation (deterministic, data in config, islands rules as today: neither is blocked by islands) and in the 3D view (cheap, instanced, no dangerous flashing, reduced-motion variant), cards and i18n texts updated, `armas=1` still shows every weapon.
  - Bump `SURVIVORS_CONFIG_VERSION`.
- Context: header decision 1; T127, T128, T129 Outcomes; `packages/engine/src/survivors/` (weapons, `resolveWeaponStats`, evolutions), `apps/web/app/mar/engine/survivors-weapons.ts`, `survivors-view.ts`, i18n `es-mar.ts`, `apps/web/e2e/mar-canon.spec.ts`.
- Scope: may touch `packages/engine/src/survivors/**` (those two weapons and their evolution), `apps/web/app/mar/engine/survivors-*` (their visuals), i18n, the e2e spec / must not touch other weapons' balance (T133), HUD layout, `docs/DECISIONES.md`.
- Done when:
  - `pnpm exec vitest run packages/engine/src/survivors apps/web/app/mar/engine --testTimeout=60000` → exit 0 with tests: firecrackers burst on contact, spotlights lock and switch targets, Show de Láseres from Focos at 5 + Techno, determinism
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0 (including `armas=1` without console errors)
  - Test command → exit 0
- Outcome: Traca (id `fireworks`, kind `trail`, firecrackers ≥24 u apart, cap 48/24) and Focos (1→3 beams locking on, 5 dmg / 0.25 s), Show de Láseres = 7-beam front fan sweeping; config v8; 1478 unit tests, mar-canon e2e 53 passed → 8f0f20b

## T135 — Elite drops: Imán total, Llama and Salvavidas
- Status: running (attempt 1)
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T133
- Goal: Header decision 2, in the simulation and the 3D view:
  - On an elite's defeat, 5 % chance (config, deterministic via the sim's rng) to drop one of three pickups, type uniform at random; pickups float on the water for a while and are collected by touch (not by the note magnet).
  - **Imán total**: every note on the map flies to the boat. **Llama**: 10 s, a short cone ahead of the boat; a common or elite enemy inside it loses 100 % of its max hp over 0.4 s of contact; against minibosses and bosses (T137+) it deals a fixed high dps from config instead (leave the hook). **Salvavidas**: lowers the water on board by a configured fraction.
  - Rename the level-up card «Salvavidas» to «Segunda vida» (i18n only; ids unchanged).
  - Simple low-poly models for the three pickups and a flame effect (instanced/cheap, reduced motion), a small HUD hint while the Llama is active (time left). Dev shortcut to force drops (e.g. `botin=1`: 100 % chance) through the existing helper.
  - Bump `SURVIVORS_CONFIG_VERSION`.
- Context: header decisions 2 and 10; T125 (elites), T129 (cards, Salvavidas), T126/T128 (view) Outcomes; `packages/engine/src/survivors/**`, `apps/web/app/mar/engine/survivors-*`, `apps/web/app/mar/canon-hud*`, the dev-shortcut helper, i18n.
- Scope: may touch `packages/engine/src/survivors/**` (drops, pickups, flame), `apps/web/app/mar/engine/survivors-*`, `apps/web/app/mar/canon-hud*` (Llama hint only), `apps/web/app/mar/survivors*.ts`, i18n, the e2e spec / must not touch weapon balance, the pause menu (T136), `docs/DECISIONES.md`.
- Done when:
  - `pnpm exec vitest run packages/engine/src/survivors apps/web/app/mar --testTimeout=60000` → exit 0 with tests: drop chance and uniform type over many seeds, each pickup's effect, flame kills a common in 0.4 s, determinism
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, with `botin=1` showing a pickup collected
  - Test command → exit 0
- Outcome:

## T136 — «Mostrar vida» and «Mostrar daño» options
- Status: pending
- Model: sonnet (Sonnet 5.5)
- Skills: frontend-design
- Depends on: T133
- Goal: Header decision 3. Two toggles in the Cañón pause menu, off by default, remembered per browser (storage wrapped in try/catch, works without it):
  - **Mostrar vida**: a thin hp bar over each damaged enemy (instanced or a single canvas overlay, cheap in `baja`; bosses use their own HUD bar later).
  - **Mostrar daño**: floating damage numbers from the sim's hit events, aggregated per enemy per short window so the screen does not flood; capped count; reduced motion → no float animation.
  - Keyboard and touch accessible, text by key, works in local and Supabase mode.
- Context: header decision 3; `apps/web/app/mar/canon-hud*`, the pause menu component, `apps/web/app/mar/engine/survivors-view.ts`, the sim snapshot and events (`hit`), i18n, `apps/web/e2e/mar-canon.spec.ts`.
- Scope: may touch `apps/web/app/mar/canon-*`, `apps/web/app/mar/engine/survivors-*` (overlay), `apps/web/app/mar/survivors*.ts`, i18n, the e2e spec; a read-only snapshot field in the sim if strictly needed / must not touch balance, `docs/DECISIONES.md`.
- Done when:
  - unit tests for the aggregation of damage numbers and the toggle persistence (with and without storage)
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, with both toggles switched on from the pause menu and their overlays present
  - Test command → exit 0
- Outcome:

## T137 — Generic boss system (simulation)
- Status: done
- Model: fable (Fable 5.1)
- Skills: none
- Depends on: T133
- Goal: The boss layer of the design reference §7 in the pure simulation, data-driven, ready for 2 minibosses and 3 final bosses across 3 acts:
  - A **phase state machine** per boss (phases by hp thresholds and/or time), **telegraphed attacks** (warning shape on the water with progress, then the hit: ring with gaps, line charge, circles, broadsides), summons through the existing spawn system, invulnerable windows, movement patterns; all as data in `SURVIVORS_CONFIG`.
  - Fill the script's disabled slots: miniboss 1 at ~2:30, miniboss 2 at ~4:30, final boss at ~5:30; **commons slow down** while a boss is alive (config multiplier); at 7:00 a living final boss retreats.
  - Boss hp scales by act and difficulty; acts as data (`acts[n]`), act 2 = same structure, harder enemies, dangerous types earlier.
  - Snapshot/events for the renderer and HUD: boss id, name key, hp fraction, phase, warnings with progress, defeated/retreated. Minibosses drop a **chest** event (content resolved by T139) and a big note (clave de sol).
  - Hook for the Llama's fixed dps against bosses (T135).
  - Implement with a placeholder test boss only; the real bosses are T138–T141.
  - Bump `SURVIVORS_CONFIG_VERSION`.
- Context: header decisions 4 and 10; design reference §7, §8, §10; T125 Outcome (script slots `enabled:false`, telegraph events), T131 (difficulty multipliers); `packages/engine/src/survivors/**`.
- Scope: may touch `packages/engine/src/survivors/**` only / must not touch `apps/web/**`, `docs/DECISIONES.md`.
- Done when:
  - `pnpm exec vitest run packages/engine/src/survivors --testTimeout=60000` → exit 0 with tests: phases advance by hp/time, telegraph precedes every hit, commons slow during a boss, boss retreats at 7:00, act 2 data loads, determinism of a full run with the test boss
  - Test command → exit 0
- Outcome: bosses as separate sim entities (phases, telegraphed attacks, summons, invulnerable windows, chest + big note), script slots 2:30/4:30/5:30 with a test boss kept out of production games, commons slow during bosses, retreat at 7:00, act 2 derived by `harderAct` (final boss `kraken`), Focos target bosses; config v9; 1500 unit tests → 8885519

## T138 — Miniboss 1: El Vecino Quejica
- Status: pending
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Skills: none
- Depends on: T134, T137
- Goal: The first miniboss on T137's system, sim + 3D: a barge with a megaphone («¡BAJAD LA MÚSICA!», `muestra`) arriving at ~2:30; sound waves expanding in **rings with gaps** (islands block them), telegraphed; a couple of phases; stronger in act 2. Low-poly code model (megaphone, barge), ring visuals cheap and readable, reduced motion respected. Drops the chest and the big note.
- Context: T137 Outcome; design reference §7; `apps/web/app/mar/engine/survivors-props.ts`, `survivors-view.ts`, `mar3d.ts` survivors path; e2e spec.
- Scope: may touch `packages/engine/src/survivors/**` (this boss's data/behaviour), `apps/web/app/mar/engine/survivors-*`, i18n, the e2e spec / must not touch the boss system's generic code beyond small fixes noted in DECISIONS, HUD, `docs/DECISIONES.md`.
- Done when:
  - unit tests: rings have gaps, islands block a ring segment, phase change, act 2 stronger, model builder creates/disposes
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, with a `t=` start before 2:30 showing the Vecino on screen without console errors
  - Test command → exit 0
- Outcome:

## T139 — Miniboss 2: Tiburón Martillo and the chest
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T135, T137
- Goal: The second miniboss, sim + 3D: at ~4:30, several **telegraphed charges** (warning line, then a straight dash) and, between them, calls piranhas; stronger in act 2. **The chest** (both minibosses drop it): touching it opens a reward = one free upgrade from the card pool, or the evolution if its condition is met (T129's hook), shown with the existing card UI as a single «chest» card. Low-poly hammerhead and chest models, reduced motion.
- Context: T137, T129, T130, T135 Outcomes; design reference §4 (chest), §7; `packages/engine/src/survivors/cards.ts`, `apps/web/app/mar/engine/survivors-*`, the cards component; e2e spec.
- Scope: may touch `packages/engine/src/survivors/**` (this boss + chest), `apps/web/app/mar/engine/survivors-*`, the cards component (chest variant), i18n, the e2e spec / must not touch the generic boss code beyond small fixes noted in DECISIONS, `docs/DECISIONES.md`.
- Done when:
  - unit tests: charges always telegraphed, summons piranhas, chest gives an evolution when the condition holds and an upgrade otherwise, determinism
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, with a `t=` start before 4:30 showing the shark and a chest card
  - Test command → exit 0
- Outcome:

## T140 — Act 1 final boss: Barco Pirata Fantasma
- Status: pending
- Model: fable (Fable 5.1)
- Skills: none
- Depends on: T134, T137
- Goal: The act-1 final boss at ~5:30, sim + 3D: it moves; **translucent and invulnerable at times** (clearly readable windows), **lateral broadsides** (telegraphed lines of shots, islands block them), **summons ghost pirates**; phases by hp. Defeating it ends the game with a special ending event (gold, T144). Translucent low-poly ghost ship with a cheap material (one steady opacity per material), ghost pirates as a tinted variant of the pirate model, reduced motion respected.
- Context: T137 Outcome; design reference §7, §8; `apps/web/app/mar/engine/survivors-*`, T126/T128 notes on transparent materials; e2e spec.
- Scope: may touch `packages/engine/src/survivors/**` (this boss), `apps/web/app/mar/engine/survivors-*`, i18n, the e2e spec / must not touch the generic boss code beyond small fixes noted in DECISIONS, HUD, `docs/DECISIONES.md`.
- Done when:
  - unit tests: invulnerable windows ignore damage, broadsides telegraphed and blocked by islands, summons, defeat emits the ending event, determinism
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, with a `t=` start past 5:30 showing the ghost ship without console errors
  - Test command → exit 0
- Outcome:

## T141 — Act 2 final boss: the Kraken (simulation)
- Status: pending
- Model: fable (Fable 5.1)
- Skills: none
- Depends on: T137
- Goal: The Kraken in the pure simulation, pulled forward from beta 4 (header decision 4): swims **under water chasing the player** (shadow state, not hittable), **emerges near** the boat; **tentacles with a circle warning** on the water; **hitting tentacles exposes the head** (damage window); can **grab an island and throw rocks** (telegraphed landing circles). Phases by hp; act 2 only (`acts[1]` final slot). Expose everything the renderer needs (submerged position, tentacles with state, exposed head, rocks in flight, warnings).
- Context: T137 Outcome; design reference §7; `packages/engine/src/survivors/**`.
- Scope: may touch `packages/engine/src/survivors/**` only / must not touch `apps/web/**`, the generic boss code beyond small fixes noted in DECISIONS, `docs/DECISIONES.md`.
- Done when:
  - `pnpm exec vitest run packages/engine/src/survivors --testTimeout=60000` → exit 0 with tests: submerged = no damage, every tentacle and rock telegraphed, tentacle hits expose the head, island grab only on reachable islands, defeat emits the ending event, determinism of a full act-2 run
  - Test command → exit 0
- Outcome:

## T142 — The Kraken in the 3D sea
- Status: pending
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Skills: none
- Depends on: T141
- Goal: Render T141's Kraken: a dark shadow under the water while it chases, the emerging head, animated low-poly tentacles rising from the warning circles, rocks with their landing circles, the island grab. Cheap and readable on mobile within the `baja` budget, reduced motion respected, no dangerous flashing.
- Context: T141 Outcome (snapshot fields); `apps/web/app/mar/engine/survivors-*`, `mar3d.ts` survivors path, water shader notes; e2e spec.
- Scope: may touch `apps/web/app/mar/engine/survivors-*`, `apps/web/app/mar/engine/mar3d.ts` (survivors render only), `apps/web/app/mar/survivors*.ts`, the e2e spec / must not touch `packages/engine/src/survivors/**` beyond trivial typing fixes, HUD, `docs/DECISIONES.md`.
- Done when:
  - unit tests for the Kraken view builders (create/update/dispose, reduced motion)
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, with an act-2 `t=` start past 5:30 (`acto=2`, or a temporary dev shortcut until T144 if needed) showing the Kraken without console errors
  - Test command → exit 0
- Outcome:

## T143 — Boss HUD: bar, name, phase and warnings
- Status: pending
- Model: sonnet (Sonnet 5.5)
- Skills: frontend-design
- Depends on: T137
- Goal: The boss bar **at the top** (name, hp, phase marks; miniboss vs final boss styles), an arrival banner («¡Llega el Vecino Quejica!»), retreat/defeat messages, and screen-edge arrows towards an off-screen boss. Compact on mobile, never covering the countdown/XP, slots row, pause, BETA label, Tickets link or touch controls. Text by key, `muestra`, reduced motion respected. Works with T137's placeholder boss; T138–T141 just appear in it.
- Context: T137 Outcome; T123/T130 HUD layout notes; `apps/web/app/mar/canon-hud*`, i18n; e2e spec.
- Scope: may touch `apps/web/app/mar/canon-hud*`, `apps/web/app/mar/survivors*.ts`, i18n, the e2e spec / must not touch the sim, 3D models, `docs/DECISIONES.md`.
- Done when:
  - unit tests for the boss HUD model (hp fraction, phase marks, banner timing)
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, with the bar visible during a boss on desktop and on a mobile viewport without overlapping the other HUD elements
  - Test command → exit 0
- Outcome:

## T144 — Medals, campaign act 1 → 2, act and difficulty on the panel
- Status: pending
- Model: opus (Opus 5.5)
- Skills: frontend-design
- Depends on: T138, T139, T140, T141
- Goal:
  - **Medals** (design reference §8): bronze = survive to 7:00 (the boss retreats); silver = survive + defeat both minibosses; gold = defeat the final boss (the game ends at that moment with its special ending). Session `won` = bronze or better; reward and achievements unchanged (header decision 7).
  - **Campaign**: defeating act 1's boss (Ghost ship) unlocks act 2 (Kraken); defeating the Kraken records it and shows act 3 as locked «próximamente». Progress saved in local mode (same storage pattern as the rest of the guest progress) and in Supabase mode through the existing session/progress path (no new tables unless unavoidable; if a migration is needed, write it but do not apply it to any database).
  - **Panel**: act buttons (Acto 1 / Acto 2, only unlocked ones selectable, act 3 shown locked) next to T131's difficulty buttons and «Jugar»; keyboard and touch accessible; race lock still explained. Dev shortcut `acto=<n>` (counts as a test start). Act and difficulty go into the session config and `configHash`.
- Context: header decisions 4, 5, 7; T131 Outcome (panel, difficulty in session config); T137–T141 Outcomes; `apps/web/app/mar/canon-mode.tsx`, the island panel, session/minigame registry, guest progress storage, Supabase session path, `apps/web/e2e/mar-canon.spec.ts`.
- Scope: may touch `packages/engine/src/survivors/**` (medal evaluation), `apps/web/app/mar/**` (panel, game start/end), progress storage (local + Supabase client path), i18n, e2e spec / must not touch rewards amounts, achievements, `docs/DECISIONES.md`, any real database.
- Done when:
  - unit tests: medal per outcome, `won` for bronze+, unlock persisted and read back in local mode, act + difficulty in `configHash`
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, with: act 2 locked on a fresh visitor, unlocked after a dev-forced boss defeat, `acto=2` starts the act-2 script
  - Test command → exit 0
- Outcome:

## T145 — Final card
- Status: pending
- Model: sonnet (Sonnet 5.5)
- Skills: frontend-design
- Depends on: T144
- Goal: The end-of-game card like the race's: medal (or «¡Barco inundado!»), act and difficulty, time, enemies defeated, notes, weapons and vinyls with their level, bosses defeated, «Otra vez» and «Volver al mar»; closing it brings the world back with a short fade. Gold shows the boss's special ending; unlocking act 2 is announced on the card. Keyboard and touch accessible, text by key, `muestra`, reduced motion respected.
- Context: T144 Outcome; the race's final card component; `apps/web/app/mar/canon-*`, i18n; e2e spec.
- Scope: may touch `apps/web/app/mar/canon-*`, the shared final-card component only through props (no behaviour change for the race), i18n, the e2e spec / must not touch the sim, rewards, `docs/DECISIONES.md`.
- Done when:
  - unit tests for the final card model (each medal, flooded, act unlock line)
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, with the card after a flooded game and after a dev-forced gold, «Otra vez» starting a new game and «Volver al mar» returning to sailing
  - Test command → exit 0
- Outcome:

## T146 — Plan 011 loose ends: failing e2e, flaky test, boost pads and ramps e2e
- Status: running (attempt 1)
- Model: sonnet (Sonnet 5.5)
- Skills: none
- Depends on: none
- Goal: Header decision 6.
  - `mundo-arcilla.spec.ts:57` «tienda: enlace externo» fails on mobile and desktop (no `a[target=_blank]`) and `mar-decor.spec.ts:4` fails on mobile (zoom 47 % vs 52/46): find whether the test or the app is wrong and fix the right one; explain in the status section.
  - `minigame-layer.test.ts` «una partida perdida no toca el libro» is flaky (Faro 2D sometimes reports 'won'): find the cause (seed, timing) and make it deterministic without weakening what it checks.
  - Add e2e for boost pads and jump ramps **during a Cañón game** (sailing over them changes speed / airborne state as when sailing freely).
- Context: plan 011 Proposals (T132 entries); `apps/web/e2e/mundo-arcilla.spec.ts`, `mar-decor.spec.ts`, `mar-canon.spec.ts`, `minigame-layer.test.ts`, T124 Outcome (interactives in the game).
- Scope: may touch those specs and tests, and the app code they reveal as wrong (small fixes outside the Cañón sim) / must not touch `packages/engine/src/survivors/**`, `docs/DECISIONES.md`.
- Done when:
  - `pnpm exec vitest run apps/web/app/mar/minigame-layer.test.ts` (or its path) → exit 0 five times in a row
  - `E2E_PORT=<free> pnpm e2e mundo-arcilla.spec.ts mar-decor.spec.ts --workers=1` → exit 0
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1 -g "impulso|rampa"` (or the names chosen) → exit 0
  - Test command → exit 0
- Outcome:

## T147 — Balance with bosses, `baja` performance, e2e, docs and the beta 3 test guide
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T133, T134, T135, T136, T137, T138, T139, T140, T141, T142, T143, T144, T145, T146
- Goal: Close beta 3.
  - **Balance with bots** including bosses: per act and difficulty, a dodging + greedy bot beats both minibosses most of the time in Tranquila and Normal; the final boss is beatable in Tranquila, a real fight in Normal and hard in Tormenta; elite drops at about the configured rate. Record curves and win rates in the status section. Bump `SURVIVORS_CONFIG_VERSION` if balance changed.
  - **Performance in `baja`**: with a boss on screen, caps full and all weapons (`armas=1`), frame time measured in the e2e browser with `calidad=baja` forced, for the Ghost ship and the Kraken; fix obvious hot spots only.
  - **E2E**: `mar-canon.spec.ts` covers the beta 3 loop at smoke level (each boss appears with `t=`/`acto=`, chest card, a pickup, the toggles, medals on the final card, act 2 unlock) without waiting 7 minutes; run the whole file.
  - **Docs**: `docs/spec/estado.md` rows touched, `ESTADO.md` via the status fragment, a new test guide `docs/propuestas/2026-10-05-canon-beta3-guia-prueba.md` in Spanish like the beta 2 one (what is in beta 3, dev shortcuts including `acto=` and `botin=`, what to tune and where, 6–8 questions: bosses fun, how to win understood, Kraken, chest and drops, new weapons, balance per difficulty, mobile performance) with an empty «Notas» section; and a note in the design reference's roadmap that the Kraken moved to beta 3 (one line, nothing else rewritten).
- Context: all Outcomes and Decisions of this plan; the beta 2 test guide (format); `docs/spec/estado.md` and `python3 tools/spec/estado.py`.
- Scope: may touch `packages/engine/src/survivors/**` (balance, bot tests), `apps/web/e2e/mar-canon.spec.ts`, small perf fixes in `apps/web/app/mar/engine/survivors-*` / `mar3d.ts`, `docs/spec/estado.md`, `docs/propuestas/` (new guide, one roadmap line) / must not touch `docs/DECISIONES.md`, features of other tasks beyond fixes.
- Done when:
  - `pnpm exec vitest run packages/engine/src/survivors --testTimeout=60000` → exit 0 with the boss balance tests
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0
  - `PYTHONUTF8=1 python3 tools/spec/estado.py` → exit 0
  - Test command → exit 0
- Outcome:

## Decisions
- 2026-10-05 plan: elite drop chance 5 % per elite, type uniform among the three; the Llama's 100 %-in-0.4 s applies to commons and elites, bosses take a fixed dps instead; pickup named «Salvavidas», old card renamed «Segunda vida» (orchestrator, from Hernán's answers)
- 2026-10-05 plan: redesign proposals «Traca» (Fireworks) and «Focos» (Laser) written by the orchestrator; Hernán approves them with the plan (orchestrator)
- 2026-10-05 plan: the «1–3» card help text loose end dropped: T132 already made it «1–{n}» (orchestrator)
- 2026-10-05 plan: skipped the fresh-worktree probe: same setup and test command as plans 010–011, `.claude/settings.json` baseRef head and `.worktreeinclude` unchanged (orchestrator)

- 2026-10-05 plan: Codex gets the short Opus-level tasks T138 (Vecino) and T142 (Kraken view) (Hernán asked for short Opus-level tasks on Codex)

- 2026-10-05 T133: all 7 weapons and 4 evolutions ~1.6× damage (base and per level); card offer weights (owned weapon/vinyl and the vinyl pairing a held weapon weigh 3, new 1; `cardWeights`); XP curve and evolution condition unchanged; Tormenta multipliers 1.3/1.3/1.4 → 1.6/1.6/1.6 because the bot survived every Tormenta seed with the new weapons; greedy bot chases notes up to 900 u; four older tests loosened (idle Normal floods before 2:00, idle Tranquila may survive one seed on the dense test archipelago, beta-1 dodge ×2.5 idle, jellyfish test stops at the split); config v7 (agent)

- 2026-10-05 plan: T137 launched before T135/T136 (out of plan order) because it is the critical path for five tasks; T134 with it since T138/T140 need both; the next tasks keep running while the T133 push offer is open (orchestrator)

- 2026-10-05 T134: rocket kind and weaponRng removed; new `caps.crackers`; Focos damage lowered to 5/0.25 s because idle bots survived; Show de Láseres front fan (full circle made an idle boat untouchable); T132 idle-boat balance test relaxed to «at most one Normal seed past 120 s, none past 330 s» and median comparison — review in T147 (agent)

- 2026-10-05 T137: bosses separate from enemies with own events (`bossSpawn/Phase/Telegraph/Attack/Summon/Hit/Damaged/Defeated/Retreated`, `chest`, `chestOpened`) and snapshot fields (`act`, `bosses`, `bossWarnings`, `chests`, `bossesDefeated`, `finalBossDefeated`); act 2 = `harderAct(act1)` (crab −30 s, pirate/swordfish −60 s, enemy hp ×1.25, boss hp ×1.5); `&t=` spawns the latest slot's boss; telegraphed boss hits ignore the 0.5 s contact i-frames; invulnerable bosses not targeted; big note = `redonda`; no new EndReason; i18n key `survivors.boss.prueba` referenced but not added; merge with T134 → config v9 (agent)

## Proposals (new scope)

- 2026-10-05 T133: e2e not run (only card texts changed in the UI); Normal may feel easy to a person since bots dodge better: first lever is Normal enemy toughness, not weaker weapons — for T147
- 2026-10-05 T134: HUD slot icon for Traca still 🎆 (`canon-hud-model.ts`); beta 3 guide must describe Traca and Focos (T147)
- 2026-10-05 T137: a `clave` note figure needs a web model; camera shake on `bossHit` (mar3d shakes only on `hit`) — for T143/T147

## Log
- 2026-10-05 12:00 plan approved by Hernán on Telegram (A); main tests pass (175 s)
- 2026-10-05 12:02 T133 launched · attempt 1 · agent a182b9911515b38cc (opus)
- 2026-10-05 12:02 T146 launched · attempt 1 · agent a270200b1b81ed99e (sonnet)
- 2026-10-05 12:35 T133 done · branch worktree-agent-a182b9911515b38cc → 8b471b7
- 2026-10-05 12:40 push offer T133 sent (T146 offer cancelled)
- 2026-10-05 12:41 T137 launched · attempt 1 · agent a11a931ea96d7dfdb (fable)
- 2026-10-05 12:41 T134 launched · attempt 1 · agent ae60eb0e7dd197709 (opus)
- 2026-10-05 13:20 T134 done · branch worktree-agent-ae60eb0e7dd197709 → 8f0f20b
- 2026-10-05 13:22 push offer T133 cancelled (no answer), push offer T134 sent
- 2026-10-05 13:22 T135 launched · attempt 1 · agent a0cb6eecadc388549 (opus)
- 2026-10-05 13:25 T137 done by agent; integration conflict with T134 in survivors/sim.ts → sent back to the same agent
- 2026-10-05 14:00 T137 done · branch worktree-agent-a11a931ea96d7dfdb → 8885519
