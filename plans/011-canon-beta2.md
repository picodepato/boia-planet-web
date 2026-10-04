# Plan 011 — Cañón «Que no pare la música», BETA 2 (loop without bosses)

Status: active
Created: 2026-10-04
Base branch: main
Goal: Turn the beta 1 feel test into a full run loop without bosses, and answer: does levelling up hook, do the weapons feel different, is the rhythm right? First apply Hernán's beta 1 notes (slower enemies, smaller and higher HUD, «sumergirse» as the default) and ship that alone so he can play a whole game; then make the world's interactives work inside the game (turbo, boost arrows, jump ramps, race buoys), and build the rest of beta 2 from the design reference: the 6 common enemies with models, elites, per-minute growth, the «Marea», the full 7-minute act-1 script without bosses; the 7 weapons with per-level tables, the 9 vinyls, 4+4 slots up to level 5, the 4 evolutions and the Salvavidas; the cards and HUD for all that; and 3 difficulties picked on the island panel. Ends with bot balance, `baja` performance, e2e, docs and the beta 2 test guide.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task (this machine is Windows 10, Git Bash): the two `packages/db` suites need a local Postgres that this machine does not have, hence the exclude; `PYTHONUTF8=1` makes the Python checks read UTF-8; if a guard blocks the chained test command, run its steps one by one. E2E: `E2E_PORT=<free port> pnpm e2e <spec files> --workers=1` (first time in a worktree: `pnpm --filter @boia/web exec playwright install chromium`); the machine is slow under load, rerun only failing specs; the full e2e run is done once by the orchestrator at the end of the plan, never per task. UI strings only by key in `apps/web/lib/i18n/`, never loose strings in components. Content (names, texts, point amounts) stays `muestra`. Never commit `apps/web/public/atlas/`, `.claude/launch.json` or any `.env*` file other than `.env.example`. Never push or deploy. Never edit `docs/DECISIONES.md`. Local mode (D-20, no Supabase env vars) must keep working exactly as today; Supabase mode must not break. Work only on the main world **Arcilla**; **Acuarela** stays hidden and is not kept in parity. Skills: each task's block names the skills it may invoke with the Skill tool; invoke none other.

**Required reading for every task:** `docs/propuestas/2026-10-04-canon-survivors.md` (the full design reference; this beta builds the «Beta 2 · Bucle sin bosses» row of its roadmap, every structure must stay ready for bosses, medals and campaign), `docs/propuestas/2026-10-04-canon-beta1-guia-prueba.md` (the beta 1 test guide with Hernán's notes at the end) and plan 010's Outcomes and Decisions (`plans/010-canon-beta1.md`). Where this plan and those documents disagree, this plan wins.

Decisions of 2026-10-04 that every task follows (interview, Hernán):
1. **Beta 1 notes:** piranhas are too fast (150 u/s = the boat's top speed at 15 knots) and catch you before the rhythm can be tested; the other enemies need the same review. The countdown and the level bar must be smaller and higher (today they sit in the middle of the view on mobile and desktop). Defeat style **«sumergirse»** is the default and almost certainly final; **«puf»** stays as a secret option (the dev switch), so REQ-AVE-037 does not change. Handling, camera, islands and iPhone 11 performance were fine: do not retune them.
2. **World interactives inside the game:** the turbo button (with its usual cooldown), the boost arrows, the jump ramps and the race buoys work during the Cañón **exactly as when sailing freely**, and **jumping gives no immunity** (enemies still hit the boat in the air). They must go through the deterministic simulation (same seed + same inputs = same game).
3. **Full roadmap row** for beta 2 (all of it): 6 enemies, elites, growth, Marea, 3 difficulties, full script without bosses; 7 weapons, 9 vinyls, 4 evolutions, Salvavidas, islands blocking straight projectiles both ways.
4. **Difficulty is chosen on the Cañón island panel**: three small buttons (Tranquila / Normal / Tormenta, Normal selected by default) next to «Jugar»; the full pre-game pop-up stays for beta 4. Dev shortcut `dificultad=<id>` like the other shortcuts.
5. **Nothing pulled forward** from later betas: no bosses or minibosses, chest, medals, campaign, final summary card, sound, pre-game pop-up, ranking, new achievements, mascot or reward change. The reward stays 150 pts + 50 coins once per season; session `won` = surviving 7:00; `canon` and `guardacostas` unchanged. The «BETA» label and the dev shortcuts stay.
6. **Ship order:** T123 runs alone first and Hernán pushes it to Vercel to try it; the rest runs automatically after.
7. **Models:** each task block names its model (Fable 5.1, Opus 5.5 or Sonnet 5.5).
8. Every task that changes `SURVIVORS_CONFIG` in a way that ships bumps `SURVIVORS_CONFIG_VERSION` once (at most once per task).

## Tasks

## T123 — Beta 1 notes: slower enemies, smaller and higher HUD, «sumergirse» by default
- Status: done
- Model: sonnet (Sonnet 5.5)
- Skills: frontend-design
- Depends on: none
- Goal: Make a whole 7-minute game playable so Hernán can test the rhythm of notes and cards.
  - **Enemy speed**: piranhas around **120 u/s** (≈80 % of the boat's 150 u/s top speed: escapable in a straight line, dangerous in turns); review the crab (55) and both `growthPerMinute.speed` and the script's `speedScale` so that at 6:59 piranhas are still clearly slower than the boat without upgrades. Check the rest of the balance that beta 1 flagged (an idle boat floods in ~20 s; enemies die next to the boat so notes are rarely seen on the water) and adjust only what makes a full game reachable for an average player who dodges; record the chosen values and why in the status section.
  - Add a deterministic sim test: a simple dodging bot (e.g. flee from the nearest enemies, steer around islands) survives clearly longer than an idle boat for several seeds, and piranha speed stays below the boat's top speed for the whole 7:00.
  - **HUD**: the countdown and the XP/level bar become smaller and sit higher (pinned to the top edge, compact like the race chips), on desktop and mobile, without colliding with the BETA label, the pause button, the Tickets link or the boat's touch controls.
  - **Defeat style**: `defeatStyle: 'sumergirse'` stays the default; the dev switch keeps «puf» as the secret option. Update the test guide's notes section only if wording about «puf» being a candidate becomes wrong.
  - Bump `SURVIVORS_CONFIG_VERSION`.
- Context: header decisions 1 and 8; `packages/engine/src/survivors/config.ts` (`SURVIVORS_CONFIG`, `survivorsShipConfig`), `packages/engine/src/survivors/sim.ts` and `survivors.test.ts`; `packages/engine/src/ship/config.ts` (`DEFAULT_SHIP_CONFIG.maxSpeed = 150`); `apps/web/app/mar/canon-hud.tsx`, `canon-hud.css`, `canon-hud-model.ts`; `apps/web/e2e/mar-canon.spec.ts`; the beta 1 test guide.
- Scope: may touch `packages/engine/src/survivors/**`, `apps/web/app/mar/canon-hud*`, `apps/web/app/mar/mar.css` only for the HUD, i18n files, `apps/web/e2e/mar-canon.spec.ts`, the beta 1 test guide / must not touch handling, camera, spawn ring, the ship controller, `mar3d.ts` beyond what the HUD needs, session/rewards, `docs/DECISIONES.md`.
- Done when:
  - `pnpm exec vitest run packages/engine/src/survivors` → exit 0, including the new bot-vs-idle and speed tests
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, with a check that the countdown and XP bar sit in the top band of the viewport (desktop and mobile viewport) and do not overlap the Tickets link
  - Test command → exit 0
- Outcome: piranhas 120 u/s (≈135 at 6:59), growth 0.01, script speedScale 1.03/1.05, softer first wave; dodging bot survives 3/4 seeds to 7:00; compact HUD pinned high; config v2; 1328 unit tests, mar-canon e2e 30 passed → 747a59b

## T124 — Turbo, boost arrows, jump ramps and race buoys inside the game
- Status: running (attempt 1)
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Skills: none
- Depends on: T123
- Goal: During the Cañón, the turbo button (same duration and cooldown as sailing, same visible button), the boost arrows, the jump ramps and the race buoys behave **exactly as when sailing freely** outside a race; jumping gives **no immunity** (contact and projectiles still hit while airborne). Today `Mar3D.turbo()` refuses during survivors and the survivors step does not read boosts or ramps.
  - Feed these into the **pure, deterministic** survivors simulation: turbo presses as recorded inputs; boost pads and ramps as world data the sim reads (reuse `packages/engine/src/circuit/` and the ship's boost handling, do not duplicate them); same seed + same inputs = same game, including replays in tests.
  - The turbo/boost speed adds to the card speed upgrade the same way it adds to the cruise speed; when a boost ends, speed must not be cut in one step into a fake collision (plan 010 proposal from T109: fix it at least for the game).
  - The ramps' visual jump (T73) plays during the game as when sailing; the water bar and enemies keep reading the boat's position consistently.
  - Nothing changes for free sailing or the race.
- Context: header decision 2; `apps/web/app/mar/engine/mar3d.ts` (`turbo()`, `stepSurvivors`, `simulate`, boost pads/ramps around the circuit objects, `BoatJump`), `packages/engine/src/circuit/` (`jump.ts`, boost helpers), `packages/engine/src/ship/` (controller, config, boost), `packages/engine/src/survivors/` (sim input and player), `apps/web/app/mar/mar-client.tsx` and `canon-mode.tsx` (turbo button visibility during the game), `apps/web/e2e/mar-canon.spec.ts`, `mar-circuito.spec.ts`.
- Scope: may touch `packages/engine/src/survivors/**`, `packages/engine/src/ship/**` and `packages/engine/src/circuit/**` only to share existing logic without changing its behaviour outside the game, `apps/web/app/mar/engine/mar3d.ts`, `apps/web/app/mar/mar-client.tsx`, `canon-mode.tsx`, the turbo button component, e2e specs above / must not touch enemy/weapon balance, HUD layout from T123, race rules, `docs/DECISIONES.md`.
- Done when:
  - unit tests: a turbo press and a boost pad raise the sim player's speed and decay smoothly; a ramp jump does not stop enemy contact damage; two runs with the same seed and inputs (including turbo presses) give identical snapshots
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts mar-circuito.spec.ts --workers=1` → exit 0, with a new check that the turbo button works during a game
  - Test command → exit 0
- Outcome:

## T125 — Four new enemies, elites, growth, Marea and the full script without bosses (simulation)
- Status: done
- Model: fable (Fable 5.1)
- Skills: none
- Depends on: none (runs in parallel with T123; integrated after T123 is pushed)
- Goal: In the pure simulation, the 6 common enemies of the design reference (§6) and the full act-1 script (§8) without minibosses or boss:
  - **Seagull** (flier: ignores islands, flies over them); **pirate in a small boat** (stops at a distance and shoots straight water-pistol shots; **islands block straight projectiles both ways**, the player's too); **swordfish** (telegraph: a warning line on the water for a fixed time, then a straight charge); **jellyfish** (splits into 2 small ones when defeated). Data-driven in `SURVIVORS_CONFIG` like piranha and crab.
  - **Enemy projectiles** with caps per quality tier and the spatial grid.
  - **Per-minute growth** for all types; **elites** from the middle of the run (more hp, better notes, a flag the renderer can show); some extra enemies without saturating; when the cap is reached the wave gains strength instead of count.
  - **«Marea»** at 5:00: a 20 s ring swarm from every side.
  - Full act-1 timeline as **data**: 0:00 piranhas + jellyfish, 1:00 seagulls, 1:30 crabs, 3:00 pirates, 3:30 swordfish + elites, 5:00 Marea, until 7:00. The slots for minibosses (2:30, 4:30) and the boss (5:30) exist in the data shape as empty/disabled entries so beta 3 only fills them.
  - Expose in the snapshot what the renderer needs (enemy type, elite flag, telegraph lines with progress, enemy projectiles).
  - Speeds stay consistent with T123, which runs in parallel and lowers piranhas to ~120 u/s with a dodging-bot test (nothing faster than the boat's 150 u/s top speed except the swordfish charge, which is telegraphed). Add new entries to `SURVIVORS_CONFIG`; do not retune existing piranha/crab values (T123 owns them); expect a merge with T123 in `config.ts` and `survivors.test.ts`.
- Context: header decisions 3 and 8; T123 Outcome; `packages/engine/src/survivors/*` (sim, config, grid, world, clock), the design reference §2, §3, §6, §8, §10 (technical rules: fixed step, grid, caps, data script).
- Scope: may touch `packages/engine/src/survivors/**` only / must not touch `apps/web/**`, weapons beyond what islands blocking needs, `docs/DECISIONES.md`.
- Done when:
  - `pnpm exec vitest run packages/engine/src/survivors` → exit 0 with tests per behaviour: seagull crosses an island, island blocks an enemy shot and a player ball, swordfish telegraphs before charging, jellyfish splits in 2, elites appear only after the configured time, Marea spawns a ring at 5:00, caps hold under `baja`, a full accelerated 7:00 run per seed is deterministic
  - Test command → exit 0
- Outcome: seagull, pirate (straight shots blocked by islands both ways), swordfish (telegraph + charge), jellyfish (splits); elites from 3:30, Marea ring at 5:00, act-1 timeline as data with disabled miniboss/boss slots; new tests in survivors-beta2.test.ts; 1339 unit tests → a561583

## T126 — Models and effects for the new enemies
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T124, T125
- Goal: Render T125's additions in `/mar` with simple low-poly code models (like `race-props.ts` with `Kit` and palette `C`), one `InstancedMesh` per type, unmistakable silhouettes readable on mobile: seagull (flying above islands), pirate in a small boat, swordfish, jellyfish (and its small halves); the elite glow; the swordfish warning line on the water; enemy water-pistol shots. Both defeat styles work for every type; reduced motion respected. Keep the draw-call and instance budget sane for `baja`.
- Context: T125 Outcome (snapshot fields); `apps/web/app/mar/engine/survivors-props.ts` and its tests, `race-props.ts`, `kit.ts`, `palette.ts`, `mar3d.ts` (survivors render path), `apps/web/e2e/mar-canon.spec.ts`.
- Scope: may touch `apps/web/app/mar/engine/survivors-props*.ts`, `apps/web/app/mar/engine/mar3d.ts` (survivors render only), palette/kit additions, `apps/web/app/mar/survivors*.ts`, e2e spec / must not touch `packages/engine/src/survivors/**` beyond trivial snapshot typing fixes, HUD, `docs/DECISIONES.md`.
- Done when:
  - `pnpm exec vitest run apps/web/app/mar/engine/survivors-props.test.ts` → exit 0 with tests for each new model and the warning line
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, with a late-time start (`t=` past 3:30) showing every enemy type on screen without console errors
  - Test command → exit 0
- Outcome:

## T127 — Weapon system: the six new weapons with per-level tables (simulation)
- Status: running (attempt 1)
- Model: fable (Fable 5.1)
- Skills: none
- Depends on: T125
- Goal: A generic, data-driven weapon system in the pure simulation with the 7 weapons of the design reference §5, each with a **fixed table per level 1–5** (the card can say exactly what a level gives): Water cannon (existing, moved onto the system), **Subwoofer** (bass aura around the boat), **Festival laser** (beam rotating around the boat), **Orbital buoys** (2–3 BOIA buoys orbiting), **Confetti cannon** (fan burst where the boat sails; straight projectiles blocked by islands), **Fireworks** (rockets to random enemies that explode in an area), **Acid rain** (a cloud over a group of enemies: a zone that damages every second). Auras, lasers, rain, fireworks and orbital buoys pass over islands. The system must accept the vinyl stat modifiers and evolutions of T129 without rework (hooks for attack speed, area, damage, projectile count). Expose what the renderer needs in the snapshot. Caps for projectiles/areas per quality tier.
- Context: header decision 8; T125 Outcome; `packages/engine/src/survivors/*`, design reference §4, §5, §10.
- Scope: may touch `packages/engine/src/survivors/**` only / must not touch `apps/web/**`, vinyls/evolutions content (T129), `docs/DECISIONES.md`.
- Done when:
  - `pnpm exec vitest run packages/engine/src/survivors` → exit 0 with a test per weapon (hits what its pattern says, level table applied, islands block only straight ones) and determinism for a run holding all 7 weapons
  - Test command → exit 0
- Outcome:

## T128 — How the six weapons look in the 3D sea
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T126, T127
- Goal: Render every weapon of T127 in `/mar`, cheap and readable on mobile: subwoofer pulse rings, rotating festival laser (no dangerous flashing, reduced-motion variant), orbiting BOIA buoys, confetti fan, firework rockets and their bursts, acid-green rain zone. Batched/instanced, within the `baja` budget; nothing breaks with all 7 weapons at max level. Reduced motion respected.
- Context: T127 Outcome (snapshot fields); `apps/web/app/mar/engine/survivors-props.ts`, `effects.ts`, `mar3d.ts` (survivors render path), REQ-AVE-039 (accessibility) in `docs/spec/`.
- Scope: may touch `apps/web/app/mar/engine/**` (survivors render), `apps/web/app/mar/survivors*.ts`, e2e spec `mar-canon.spec.ts`; may add a dev-only shortcut to start with given weapons if needed for tests (behind the existing dev-shortcut helper) / must not touch `packages/engine/src/survivors/**` beyond trivial typing fixes, HUD/cards, `docs/DECISIONES.md`.
- Done when:
  - unit tests for each weapon's visual builder (instances created/updated/disposed, reduced-motion variant)
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, with a game holding all weapons running without console errors
  - Test command → exit 0
- Outcome:

## T129 — Vinyls, slots, evolutions and the Salvavidas (simulation and cards pool)
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T127
- Goal: In the pure simulation and the level-up card pool:
  - **9 vinyls** (passives) from the design reference §4 table: Techno attack speed, Reggaetón area, House resistance, Drum & Bass boat speed, Disco magnet, Chill/Ambient bailing, Hardstyle damage, Pop experience, Rumba +1 projectile; each up to level 5 with a fixed table.
  - **Slots 4 weapons + 4 vinyls**, each up to level 5; the 1-of-3 offer draws from new weapons, weapon levels, new vinyls and vinyl levels respecting free slots; when everything is maxed, a fallback (e.g. notes or bailing) so a card always exists.
  - **4 evolutions** (weapon at level 5 + paired vinyl): Water cannon + Hardstyle = **El Drop**, Subwoofer + House = **Muro de Sonido**, Festival laser + Techno = **Show de Láseres**, Orbital buoys + Disco = **Bola de Discoteca**. With no chest in beta 2 (minibosses are beta 3), an evolution is offered as a level-up card when its condition is met; leave the hook for the chest.
  - **Salvavidas**: a rare item that saves the boat once from flooding (no second chance otherwise).
  - The old 6 beta 1 upgrades are replaced or mapped onto weapons/vinyls; the card data says exactly what it gives (i18n keys for names and per-level texts, `muestra`).
- Context: header decision 8; T127 Outcome; `packages/engine/src/survivors/*` (config `upgrades`, sim level-up), design reference §3, §4.
- Scope: may touch `packages/engine/src/survivors/**`, i18n files for card names/texts / must not touch `apps/web/app/**` UI (T130), `docs/DECISIONES.md`.
- Done when:
  - `pnpm exec vitest run packages/engine/src/survivors` → exit 0 with tests: slot limits hold, offers never exceed limits, each evolution triggers only with its pair at the right levels, Salvavidas saves once, vinyl stats apply to weapons and boat, determinism with a scripted card-choosing bot
  - Test command → exit 0
- Outcome:

## T130 — Upgrade interface: new cards and the weapons/vinyls row
- Status: pending
- Model: sonnet (Sonnet 5.5)
- Skills: frontend-design
- Depends on: T128, T129
- Goal: The level-up cards show every kind of offer from T129 (new weapon, weapon level, new vinyl, vinyl level, evolution, Salvavidas) with a simple icon, its level and exactly what the level gives («Nivel 3: +1 boya»); evolutions stand out. The HUD gets the small row of the 4 weapons and 4 vinyls with their level: **bottom on desktop, top-left on mobile** so it does not collide with the touch controls, and it does not cover T123's compact countdown/XP or the Tickets link. Keyboard and touch behaviour of the cards stays as in beta 1. Text by key, `muestra`.
- Context: T123, T128, T129 Outcomes; `apps/web/app/mar/canon-hud.tsx`, `canon-hud.css`, `canon-hud-model.ts`, the cards component, i18n files, `apps/web/e2e/mar-canon.spec.ts`.
- Scope: may touch `apps/web/app/mar/canon-*`, the cards component, `apps/web/app/mar/survivors*.ts`, i18n files, e2e spec / must not touch `packages/engine/src/survivors/**` beyond trivial typing fixes, `mar3d.ts` rendering, `docs/DECISIONES.md`.
- Done when:
  - unit tests for the HUD model of the slots row and card texts per offer kind
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, with: a card of each kind can be shown (`carta=1` or a dev shortcut), the slots row is visible on desktop at the bottom and on a mobile viewport at the top-left, nothing covers the Tickets link
  - Test command → exit 0
- Outcome:

## T131 — Three difficulties chosen on the island panel
- Status: pending
- Model: sonnet (Sonnet 5.5)
- Skills: frontend-design
- Depends on: T129
- Goal: **Tranquila / Normal / Tormenta** as data in `SURVIVORS_CONFIG` (enemy damage and hp multipliers; more enemies in Tormenta), part of the session's config and `configHash`, deterministic per seed. On the Cañón island panel, three small buttons next to «Jugar» (Normal selected by default; the choice remembered for the visit), accessible by keyboard and touch; the race lock still explains why you cannot start during a race. Dev shortcut `dificultad=tranquila|normal|tormenta` through the existing dev-shortcut helper. Reward and `won` unchanged in every difficulty. Text by key, `muestra`.
- Context: header decisions 4 and 8; T129 Outcome; `packages/engine/src/survivors/config.ts`, `apps/web/app/mar/canon-mode.tsx`, the Cañón island panel component, the dev-shortcut helper, `apps/web/app/mar/survivors.ts`, session/minigame registry for `canon`, `apps/web/e2e/mar-canon.spec.ts`.
- Scope: may touch `packages/engine/src/survivors/**` (difficulty data), `apps/web/app/mar/**` (panel and game start), i18n files, e2e spec / must not touch rewards, session validation rules beyond carrying the difficulty, `docs/DECISIONES.md`.
- Done when:
  - unit tests: each difficulty changes damage/hp/count as configured; same seed + difficulty is deterministic
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, with: the panel shows the three buttons with Normal selected, choosing Tormenta starts a Tormenta game (`dataset` shows it), the dev shortcut works
  - Test command → exit 0
- Outcome:

## T132 — Balance with bots, `baja` performance, e2e, docs and the beta 2 test guide
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T123, T124, T125, T126, T127, T128, T129, T130, T131
- Goal: Close beta 2.
  - **Balance with bots**: sim tests running accelerated full games with simple bots (idle, dodging, dodging + greedy card picks) per difficulty and seed; tune `SURVIVORS_CONFIG` so an idle boat loses early, a dodging bot reaches the late minutes in Normal, Tranquila is clearly easier and Tormenta harder, and level-ups come at a steady rhythm (record the measured curves in the status section).
  - **Performance in `baja`**: with caps full at `t=360` and all weapons, frame-time stays acceptable in the e2e browser with `calidad=baja` forced (measure and report; fix obvious hot spots only).
  - **E2E**: `mar-canon.spec.ts` covers the whole beta 2 loop at a smoke level (new enemies present late, a weapon card chosen, an evolution offered via dev shortcut, difficulty selected, interactives during the game), without waiting 7 minutes.
  - **Docs**: `docs/spec/estado.md` rows touched by the mode, `ESTADO.md` via the status fragment, and a new test guide `docs/propuestas/2026-10-04-canon-beta2-guia-prueba.md` in Spanish like the beta 1 guide: what is in beta 2, dev shortcuts (including `dificultad=`), what to tune and where, and 6–8 questions for Hernán (levelling hook, weapons feeling different, rhythm, difficulties, interactives, mobile performance) with an empty «Notas» section. The design reference's roadmap row is not rewritten.
  - Bump `SURVIVORS_CONFIG_VERSION` if balance changed.
- Context: all Outcomes and Decisions of this plan; the beta 1 test guide (format to copy); `docs/spec/estado.md` and `python3 tools/spec/estado.py`.
- Scope: may touch `packages/engine/src/survivors/**` (balance and bot tests), `apps/web/e2e/mar-canon.spec.ts`, small perf fixes in `apps/web/app/mar/engine/survivors-props.ts` / `mar3d.ts`, `docs/spec/estado.md`, `docs/propuestas/` (new guide) / must not touch `docs/DECISIONES.md`, the design reference document, features of other tasks beyond fixes.
- Done when:
  - `pnpm exec vitest run packages/engine/src/survivors` → exit 0 with the bot balance tests
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0
  - `PYTHONUTF8=1 python3 tools/spec/estado.py` → exit 0
  - Test command → exit 0
- Outcome:

## Decisions
- 2026-10-04 plan: models per task: Sonnet for T123, T130, T131; Fable for T125, T127; Opus for T124, T126, T128, T129, T132 (Hernán)
- 2026-10-04 plan: T123 runs alone and is pushed to Vercel when integrated; the rest starts automatically after the push (Hernán)

- 2026-10-04 plan: T125 moves from Fable to Codex (via a Sonnet wrapper agent) and loses its dependency on T123, so a second agent works while T123 runs; T127 stays on Fable (Hernán asked for a Codex task in parallel; orchestrator chose T125)
- 2026-10-04 plan: Hernán prefers Fable for T125: the Codex run was stopped after ~2 min and T125 restarts from scratch on Fable; Codex will get a task assigned to Opus later, never a Fable one (Hernán)
- 2026-10-04 plan: skipped the fresh-worktree probe: same setup and test command as plan 010 today, main tests pass (87 s) (orchestrator)

- 2026-10-05 T123: piranha 150→120 u/s, growthPerMinute.speed 0.02→0.01, script speedScale 1.08/1.15→1.03/1.05 (≈135 u/s at 6:59); crab unchanged; first wave 0.35→0.25 groups/s, groups 2–4 (idle floods ~26 s); bot test asserts ≥3× idle and ≥90 s (one of 4 seeds floods at ~150 s); HUD countdown 1.05 rem, level+XP in one row, pause 32 px visible / 44 px touch; config version 2; beta 1 guide «Derrota» item reworded (agent)

- 2026-10-05 plan: T123 pushed to Vercel (bfb39ba) on Hernán's request; T124 goes to Codex (an Opus task, as Hernán asked) in parallel with T125 on Fable (orchestrator)

- 2026-10-05 T125: crab track starts at 1:30 (fromS 60→90); jellyfish halves keep the same EnemyId with scale/generation; elites/Marea params in config.elites/config.marea keyed by the script event ref; miniboss/boss slots are enabled:false entries; reused hit/blocked events (blocked.owner, defeated.elite) plus new enemyFire, telegraph, split; tests in survivors-beta2.test.ts; full-run tests with 60 s timeout (agent)
- 2026-10-05 T125: its SURVIVORS_CONFIG_VERSION bump collapsed with T123's (both 1→2, merged clean at 2); main was not pushed in between, and configHash changes on its own; T127 bumps to 3 (orchestrator)

## Proposals (new scope)

- 2026-10-05 T125: with the beta-1 cannon (nearest target) only piranhas and gulls die in 7:00; crabs, jellyfish, pirates, swordfish are never killed — for T127 weapons / T132 balance
- 2026-10-05 T125: `pnpm exec vitest run packages/engine/src/survivors` without `--testTimeout` times out 3 full-run tests under load (the Test command uses 30 s)

## Log
- 2026-10-04 23:55 T123 launched · attempt 1 · agent ab9f2332bb3a918f4 (sonnet)
- 2026-10-04 23:58 T125 launched · attempt 1 · Codex via wrapper agent ac16b404f9920a727
- 2026-10-05 00:02 T125 Codex run stopped by Hernán's request; worktree and branch removed, nothing kept
- 2026-10-05 00:05 T125 relaunched from scratch · attempt 1 · agent ab77c29844c2d8c2b (fable)
- 2026-10-05 00:03 T123 done · branch worktree-agent-ab9f2332bb3a918f4 → 747a59b
- 2026-10-05 00:08 pushed main bfb39ba (T123) to Vercel; Telegram notice sent
- 2026-10-05 00:10 T124 launched · attempt 1 · Codex via wrapper agent a3828345c3b543eb5
- 2026-10-05 00:22 T125 done · branch worktree-agent-ab77c29844c2d8c2b → a561583
