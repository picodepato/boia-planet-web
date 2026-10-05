# Plan 013 — Cañón «Que no pare la música», definitive version (beta 3 notes, beta 4 and launch, two acts)

Status: active
Created: 2026-10-05
Base branch: main
Goal: Apply Hernán's beta 3 notes (end-game button in the pause, HUD overlaps, the healing vinyl too strong, emoji icons off-style, the Vecino ring nearly impossible to dodge), then finish the game as the definitive version with **two acts** (act 3 / Capitán is not built): the pre-game pop-up, sound (synth sound effects, a drum-and-bass battle loop, sea ambience back afterwards) and accessibility, the per-medal daily prize and the new achievements, the minikraken mascot, the per-boss ranking (local and global), and a closing task with bot balance, `baja` performance, the full e2e, docs, the decision draft for Álvaro and removing the «BETA» label.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task (this machine is Windows 10, Git Bash): the two `packages/db` suites need a local Postgres that this machine does not have, hence the exclude; `PYTHONUTF8=1` makes the Python checks read UTF-8; if a guard blocks the chained test command, run its steps one by one. E2E: `E2E_PORT=<free port> pnpm e2e <spec files> --workers=1` (first time in a worktree: `pnpm --filter @boia/web exec playwright install chromium`); the machine is slow under load, rerun only failing specs; the full e2e run is done only in T156. UI strings only by key in `apps/web/lib/i18n/`, never loose strings in components. Content (names, texts, point amounts, sounds) stays `muestra`. Never commit `apps/web/public/atlas/`, `.claude/launch.json` or any `.env*` file other than `.env.example`. Never push or deploy; Supabase migrations are written and tested locally but never applied to a real project (Hernán does that). Never edit `docs/DECISIONES.md`. Local mode (D-20, no Supabase env vars) must keep working; Supabase mode must not break. Work only on the main world **Arcilla**; **Acuarela** stays hidden and is not kept in parity. Skills: each task's block names the skills it may invoke with the Skill tool; invoke none other. Every task that changes `SURVIVORS_CONFIG` in a way that ships bumps `SURVIVORS_CONFIG_VERSION` once (currently 14).

**Required reading for every task:** `docs/propuestas/2026-10-04-canon-survivors.md` (the design reference; this plan builds its «Beta 4» and «Lanzamiento» rows **without act 3**), `docs/propuestas/2026-10-05-canon-beta3-guia-prueba.md` (the beta 3 test guide) and plan 012's Outcomes, Decisions and Proposals (`plans/012-canon-beta3.md`). Where this plan and those documents disagree, this plan wins.

Decisions of 2026-10-05 that every task follows (interview, Hernán):
1. **Two acts, no act 3.** The Capitán Aguafiestas, the apagón and lit islands are not built. The campaign ends with the Kraken (act 2). Act 3 shows in the pre-game pop-up as **locked, «Próximamente»** (`muestra`), and the code stays ready to add it. The `canon-capitan` achievement and the «El Apagón» boat appearance are **dropped** (the launch has 5 new achievements instead of 6).
2. **«Terminar partida»** in the pause menu: asks for confirmation, then shows the final card as «Partida terminada» with time, enemies and notes; **no medal, no prize, no `win_minigame`**, not counted in the ranking. From the card: back to sea or play again.
3. **HUD in battle:** points ★ and coins 🪙 (the world `.mar-balances`) are **hidden during a game**; in their place, top-right, go the weapon and vinyl slots (and Segunda vida). Time, level and XP pill smaller. Nothing overlaps the menu/pause button. Same layout on mobile and desktop.
4. **Healing vinyl** (today `chill`, bail +1/s per level): per level — N1 bails 0.4/s; N2 +15 max water capacity; N3 +15 more; N4 bails 0.8/s; N5 **shield**: the next hit deals no water and leaves the boat invulnerable 6 s; the shield comes back 20 s after it is spent; a ring on the boat shows it ready. Card texts follow the level.
5. **Skill icons:** every emoji of weapons, vinyls, evolutions, upgrades, drops and the flame becomes an SVG in the style of `apps/web/lib/mundo/menu/icons.tsx` (round shapes, thick `currentColor` outline, `ICON_PALETTE`). Hernán approves a contact sheet on Telegram before the task ends.
6. **Vecino ring:** a ring with **8 evenly spaced gaps**, each about 2.5× the boat's width; the second wave is rotated so the player must move a little; islands still cut the ring.
7. **Sound:** synthesized in code with Web Audio (no audio files, no licences): sound effects, a **drum-and-bass style loop during battle** (and a boss variant), and when the game ends the **sea ambience** comes back. Volume and mute in the pause menu, remembered per browser; on mobile, silent until the first touch. Real BOIA music is Álvaro's later.
8. **BETA label** is removed in T156. Dev shortcuts (`t=`, `acto=`, `armas=`, …) keep working on the test version, but a game started with any shortcut never pays a prize, never unlocks achievements and never enters the ranking.
9. **Ship order:** T148 and T149 run first in parallel; Hernán gets a push offer after each to test his notes. The rest runs automatically.
10. **Models:** each task block names its model (Opus 5.5 by default; Codex for short Opus-level tasks, through a wrapper agent, falling back to Opus when out of credits).

## Tasks

## T148 — Pause «Terminar partida» and the battle HUD layout
- Status: done
- Model: opus (Opus 5.5)
- Skills: frontend-design
- Depends on: none
- Goal: Header decisions 2 and 3.
  - In the in-game section of the pause menu (`menu.tsx` `mar-menu-partida`), add «Terminar partida» with a confirmation step; on confirm the game ends through a new end reason (e.g. `quit`) that shows the final card titled «Partida terminada» with time, enemies and notes, pays nothing, sends no `win_minigame`, and is excluded from future ranking submissions (leave a clear flag on the result). Esc / back behave sensibly on the confirm step.
  - Hide the world points and coins (`.mar-balances` in `mar-client.tsx`) while a Cañón game runs (e.g. a `HideLayer` entry) and restore them after.
  - Move the weapon/vinyl/Segunda vida slots to the top-right where the balances were, on mobile and desktop; make the time/level/XP pill smaller; nothing overlaps the pause/menu button, the water bar, the boss bar or the minimap at 360×640, 390×844, 768×1024 and 1440×900 (with 6 weapons + 6 vinyls, the worst case).
- Context: survey notes — `apps/web/app/mar/canon-hud.tsx` (`CanonHud` l.204, `CanonSlots` l.375), `canon-hud.css` (`--canon-hud-top`, breakpoint 760px), `mar-client.tsx:2066` (balances) and `:2229` (`openMenu`), `menu.tsx:158-170`, `canon-readout-menu.tsx`, `canon-mode.tsx` (`finish`, `abandon`), `survivors.ts:281` (`HideLayer`).
- Scope: may touch `apps/web/app/mar/**` HUD, menu, canon-mode and their CSS/tests, `apps/web/lib/i18n/`, `apps/web/e2e/mar-canon.spec.ts`, the engine's end-reason type if needed / must not touch balance numbers, `SURVIVORS_CONFIG`, slot icons (T150), `docs/DECISIONES.md`.
- Done when:
  - unit test: ending with «Terminar partida» pays nothing and sends no `win_minigame` → passes
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1 -g "Terminar|HUD"` (new tests: quit flow ends on the card with no balance change; balances hidden in game and back after; slot bounding boxes do not intersect the pause button at mobile and desktop) → exit 0
  - Test command → exit 0
- Outcome: «Terminar partida» with confirm → «Partida terminada» card, no pay/medal, `ranked:false`; balances hidden in game; slots top-right, smaller pill → c51a76c

## T149 — Healing vinyl redesign and the Vecino ring
- Status: done
- Model: opus (Opus 5.5; started on Codex, which ran out of credits)
- Skills: none
- Depends on: none
- Goal: Header decisions 4 and 6.
  - Redesign the `chill` vinyl per decision 4: bail per second only at N1 (0.4/s) and N4 (0.8/s total), +15 `waterCapacity` at N2 and N3 (the water bar shows the new maximum), N5 shield with 6 s invulnerability and 20 s recharge after it is spent, exposed in the sim state so the view can draw a ring around the boat when ready (add the ring in the boat view, minimal). The shield must also stop boss hits (`bossHitLands`). Card texts per level by i18n key.
  - Vecino `onda` and `bronca`: 8 evenly spaced gaps, each ≈ 2.5× the boat's hit width (derive `gapRad` from the ring radius), the second wave rotated by half a gap step; keep the island cuts.
  - Bot tests: the dodge bot survives the Vecino's rings clearly more often than in config v14 (record before/after); a test of the shield (hit absorbed, 6 s invulnerable, 20 s recharge) and of the capacity levels.
  - Bump `SURVIVORS_CONFIG_VERSION`.
- Context: survey notes — `packages/engine/src/survivors/config.ts` (`player` l.880, `chill` l.1988, `bailing`), `sim.ts` (`takeWater` l.2075, `bossHitLands` l.2071, rings l.3708/3960), `vecino.ts` (l.4-50, `vecinoRingArcs` l.95), `apps/web/app/mar/engine/survivors-vecino.ts`, `apps/web/lib/i18n/es-mar.ts` card texts.
- Scope: may touch `packages/engine/src/survivors/**`, `apps/web/app/mar/engine/survivors-*` (shield ring, ring view if gap math moves), `apps/web/lib/i18n/` card texts, the beta 3 guide «Notas» (one entry with the values changed) / must not touch HUD layout (T148), other weapons' balance, `docs/DECISIONES.md`.
- Done when:
  - `pnpm exec vitest run packages/engine/src/survivors --testTimeout=60000` → exit 0 with the new tests
  - Test command → exit 0
- Outcome: chill N1 0.4/s, N2–N3 +15 capacity, N4 0.8/s, N5 shield (6 s, 20 s recharge, ring on boat); Vecino 8 gaps of 2.5 boat widths; dodge bot fixed; config v15 → 6858e3f

## T150 — SVG icons for every skill
- Status: done
- Model: opus (Opus 5.5)
- Skills: frontend-design
- Depends on: T148
- Goal: Header decision 5. Draw an SVG icon (32×32, the T114 style of `apps/web/lib/mundo/menu/icons.tsx`: round shapes, thick `currentColor` outline, `ICON_PALETTE`) for each of: 7 weapons, 9 vinyls, 4 evolutions, the upgrades (damage, fireRate, projectiles, speed, magnet, bailing), the three elite drops (Imán total, Llama, Salvavidas — no longer sharing the buoys icon), Segunda vida and the flame. Each icon must read at 20 px and be distinct from the others. Replace the emoji in the HUD slots, the level-up cards, the final card and anywhere else the Cañón shows them.
  - **Approval:** before finishing, render a contact sheet PNG (all icons at 64 px and 20 px, labelled, light background, plus a screenshot of the HUD and a card using them) and stop with `blocked`, attaching both files, so the orchestrator sends them to Hernán on Telegram. Apply his changes, then finish.
- Context: survey notes — emoji map `apps/web/app/mar/canon-hud-model.ts:257-300`, `icons.tsx` (`ICON_PALETTE`, existing icons), `.boia-icon` in `mar.css`, the card component.
- Scope: may touch `apps/web/app/mar/canon-*`, a new icon module next to `icons.tsx` or inside `apps/web/app/mar/`, CSS, tests and e2e that read icons / must not touch the engine, the world menu icons themselves, `docs/DECISIONES.md`.
- Done when:
  - unit test: every weapon, vinyl, evolution, upgrade and drop id has an icon (no emoji fallback left) → passes
  - Hernán approved the contact sheet (recorded in the status section)
  - Test command → exit 0
- Outcome: 31 SVG icons (`canon-icons.tsx`, incl. miniboss chest) in HUD slots, cards and final card gear list; approved by Hernán → 5fcfb9e

## T151 — Pre-game pop-up (act, difficulty, ranking slot, Jugar)
- Status: done
- Model: opus (Opus 5.5)
- Skills: frontend-design
- Depends on: T148
- Goal: Replace the act and difficulty buttons on the Cañón island panel (T131/T144) with the pre-game pop-up of the design reference §9: choose the act (Acto 1, Acto 2 once unlocked, Acto 3 always locked with «Próximamente»), the difficulty, see a ranking area for the chosen act's boss (placeholder until T155 fills it: a clear empty state) and Jugar. Works with keyboard and touch, on mobile and desktop; closes with Esc; the `acto=` and difficulty shortcuts still work. Shows the medals already won per act and difficulty if that state exists.
- Context: design reference §9 (pop-up), `apps/web/app/mar/canon-mode.tsx:136-146`, the island panel, T131/T144 Outcomes in plan 012, campaign progress state.
- Scope: may touch `apps/web/app/mar/**` panel, pop-up, canon-mode, CSS, i18n, `mar-canon.spec.ts` / must not touch the engine sim, the ranking data (T155), `docs/DECISIONES.md`.
- Done when:
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1 -g "pop-up|acto|dificultad"` (opens, act 2 locked before unlock and available after, act 3 locked, Jugar starts the chosen act and difficulty, mobile and desktop) → exit 0
  - Test command → exit 0
- Outcome: pre-game pop-up `canon-previa.tsx` (act 1/2, act 3 «Próximamente», difficulty, ranking empty state with `ranking(act,boss)` prop, Jugar) replaces panel pickers → f66e051

## T152 — Sound and accessibility
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T148, T151
- Goal: Header decision 7 plus the design reference's accessibility list.
  - A small Web Audio module (no files): sound effects for shot, hit taken, enemy down, note pickup, level up, card pick, elite drop, boss warning, boss down, medal, flooding; a synthesized **drum-and-bass style battle loop** (~170 BPM, break-beat drums + sub bass, a few variations so it is not tiring) and a heavier boss variant that crossfades in while a boss is alive; at game end the loop fades out and the **sea ambience** returns (if `/mar` has no sea ambience yet, add a soft synthesized one, also muted until the first touch). Volume slider and mute in the pause menu, remembered per browser (try/catch storage). Silent until the first user gesture; stops when the tab is hidden; respects a global mute if the site has one.
  - Accessibility: telegraphs for every dangerous boss attack visible without sound; `prefers-reduced-motion` reduces camera shake and flashes; keyboard-only play and pop-up navigation; touch areas ≥ 44 px for pause, cards and pop-up; `aria-live` announcements for level up, boss arrival and the result.
- Context: design reference accessibility section (l.~234), `apps/web/app/mar/**` canon files, `mar3d.ts` (camera shake), the pause menu after T148, the pop-up after T151.
- Scope: may touch `apps/web/app/mar/**` (new audio module, hooks into canon-mode/view events), `apps/web/lib/i18n/`, CSS, tests / must not touch engine balance, `docs/DECISIONES.md`.
- Done when:
  - unit tests: audio module schedules nothing before a user gesture, mute and volume persist, loop switches battle → boss → sea → pass (with a mocked AudioContext)
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1 -g "sonido|teclado|accesib"` → exit 0
  - Test command → exit 0
- Outcome: lazy `canon-audio.ts` (synth SFX, DnB battle loop + boss variant, sea ambience restored after), volume/mute in pause, reduced motion, keyboard, aria-live → d7de982

## T153 — Per-medal daily prize and the new achievements
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T148
- Goal: The «Lanzamiento» prize and achievements of design reference §9, without act 3 (header decision 1).
  - **Prize per medal, once a day each**: `sourceRef` `minigame:canon:<medal>@<date>` (per act if the reference says so); replaces the beta prize (150 pts + 50 coins once per season). Amounts `muestra` from the reference. Anti-cheat: reject a gold before 5:30 and games shorter than the minimum duration; games started with a dev shortcut or ended with «Terminar partida» pay nothing (decisions 2 and 8).
  - **Achievements**: the reference's new Cañón achievements **except `canon-capitan`** (5 new), plus the `guardacostas` change; `canon-kraken` grants the minikraken mascot item (the item is built in T154; here the grant is recorded so T154 can show it).
  - Migration of the local document (`store/schema.ts`, `migrations.ts`) and the Supabase migration + enum (written and tested, not applied).
- Context: design reference §9 (l.183-216), plan 008 (accounts, carnet, rankings) patterns, `canon-mode.tsx` (`finish`), the achievements catalog, `store/schema.ts`, `migrations.ts`, `packages/db`.
- Scope: may touch `apps/web/app/mar/canon-*`, `apps/web/lib/**` store, achievements, i18n, `packages/db/**` migrations, `supabase/**` migrations, tests / must not touch engine balance, the ranking (T155), `docs/DECISIONES.md`.
- Done when:
  - unit tests: each medal pays once per day; bronze+silver+gold same day pay three times, again next day; shortcut and quit games pay nothing; gold before 5:30 rejected; migration from the previous document version keeps balances and achievements → pass
  - Test command → exit 0
- Outcome: per-medal daily prize (`RewardRule.tiers`, `CANON_VERSION` 5), 5 new achievements + guardacostas v2, triggers `play_minigame`/`defeat_boss`, local doc v8, Supabase migration (not applied), `mascot` slot + `mascota-minikraken` and `bandera-fantasma` cosmetics → 74350af

## T154 — Minikraken mascot
- Status: running (attempt 1)
- Model: opus (Opus 5.5)
- Skills: frontend-design
- Depends on: T153
- Goal: The «Mascota» category of design reference §9: a new category in Mi Barco (activate / deactivate, ready for more mascots) with the **minikraken** as its first item, granted by `canon-kraken` (T153). When active it rides on the deck across the whole experience (sailing, races, the Cañón), animated, cheap in `baja`. Low-poly in the style of the other boat models.
- Context: design reference §9 (l.208-212), Mi Barco / cosmetics code, the boat models in `apps/web/app/mar/engine/`, T153 Outcome.
- Scope: may touch Mi Barco UI, cosmetics/store, the boat view, i18n, Supabase cosmetic enum migration (not applied), tests / must not touch engine balance, `docs/DECISIONES.md`.
- Done when:
  - unit test: mascot can be equipped only when owned; state migrates
  - `E2E_PORT=<free> pnpm e2e <the Mi Barco spec> --workers=1 -g "mascota"` (granted via a dev helper, equip, visible on deck) → exit 0
  - Test command → exit 0
- Outcome:

## T155 — Per-boss ranking, local and global
- Status: running (attempt 1)
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T151, T153
- Goal: Design reference §9 ranking: game score = enemies + notes + medal + speed beating the boss, × difficulty multiplier; one ranking per final boss (Barco Fantasma, Kraken). Pattern of `ranking-circuit.ts`: sample crew in local mode, global ranking with an account (RPC with the basic anti-cheat of plan 008; migration written and tested, not applied). Shown in the pre-game pop-up's ranking area (T151) for the chosen act, and the player's best and position on the final card. Shortcut games and «Terminar partida» games are never submitted.
- Context: design reference §9 (l.213-216), `ranking-circuit.ts` and its RPC/migration from plan 008, the pop-up (T151), T153 anti-cheat.
- Scope: may touch `apps/web/app/mar/**` ranking/pop-up/final card, `apps/web/lib/**`, `packages/db/**`, `supabase/**` migrations, i18n, tests / must not touch engine balance, `docs/DECISIONES.md`.
- Done when:
  - unit tests: score formula, per-boss separation, rejected submissions (shortcut, quit, impossible times) → pass
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1 -g "ranking"` (local mode: sample crew + own score after a game via shortcuts-free path or test helper) → exit 0
  - Test command → exit 0
- Outcome:

## T156 — Close: balance, `baja` performance, full e2e, docs, Álvaro draft, remove BETA
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T148, T149, T150, T151, T152, T153, T154, T155
- Goal: Close the definitive version.
  - **Balance with bots** for both acts and three difficulties with the new healing vinyl and Vecino ring: minibosses beaten most of the time in Tranquila and Normal; final bosses beatable in Tranquila, a real fight in Normal, hard in Tormenta; record curves and win rates. Bump `SURVIVORS_CONFIG_VERSION` if balance changed.
  - **Performance in `baja`** with a boss, caps full, all weapons, sound on and the mascot active: frame time measured in the e2e browser; fix obvious hot spots only.
  - **E2E**: stabilise the known-flaky list from plan 012's Proposals (dawn reward at t=419, HUD con BETA, T124 turbo mobile, Tiburón Martillo, T131 panel, shark on mobile, ramp desktop); then run the **full e2e suite** (`E2E_PORT=<free> pnpm e2e --workers=2`) and the full `mar-canon.spec.ts`; both exit 0.
  - **Remove the «BETA» label** (panel, HUD, pop-up, card) and the beta-only texts; dev shortcuts stay (decision 8).
  - **Docs**: `docs/spec/estado.md` rows (incl. the REQ-AVE-038 note «won = aguantar 7:00»), `ESTADO.md` via the status fragment, the roadmap in the design reference updated in a few lines (two acts, act 3 for a later version), a Spanish test guide `docs/propuestas/2026-10-05-canon-definitiva-guia-prueba.md` like the beta 3 one with an empty «Notas» section, and a **decision draft for Álvaro** `docs/propuestas/2026-10-05-canon-decision-alvaro.md` in Spanish (what the Cañón is, what needs his OK: names, texts, prizes, achievements, mascot, real music, REQ changes) — not in `docs/DECISIONES.md`.
  - Fix CRLF line endings that plan 012 left in main, if any.
- Context: all Outcomes, Decisions and Proposals of this plan and of plan 012; `python3 tools/spec/estado.py`.
- Scope: may touch `packages/engine/src/survivors/**` (balance, bot tests), `apps/web/e2e/**`, small perf/stability fixes in `apps/web/app/mar/**`, BETA label code and i18n, `docs/spec/estado.md`, `docs/propuestas/` / must not touch `docs/DECISIONES.md`, features beyond fixes.
- Done when:
  - `pnpm exec vitest run packages/engine/src/survivors --testTimeout=60000` → exit 0
  - `E2E_PORT=<free> pnpm e2e --workers=2` → exit 0
  - `PYTHONUTF8=1 python3 tools/spec/estado.py` → exit 0
  - `grep -rn "BETA" apps/web/app/mar apps/web/lib/i18n` → no user-visible BETA label left
  - Test command → exit 0
- Outcome:

## Decisions
- 2026-10-05 plan: act 3 dropped; Capitán achievement and «El Apagón» appearance dropped; shortcut games never pay or rank (orchestrator, from Hernán's answers)

- 2026-10-05 T148: new end reason `quit` (`SurvivorsGame.quit()`); quit session abandoned, not settled; `CanonResult.ranked=false` for T155; card shows time/enemies/notes + «Volver al mar»/«Otra vez»; balances hidden via a `balances` HideLayer until «Volver al mar»; confirm focuses «No, seguir», Esc cancels the step; mobile slots 3 columns of 22 px, desktop rows at 28 px; worst case tested with `armas=1` (7 weapons + 4 vinyls) (agent)
- 2026-10-05 T150: vinyls share a purple disc behind their symbol; `CANON_ICON_PALETTE` = `ICON_PALETTE` + water blue, acid green, red; Llama drop = brazier, flame alone = HUD notice; Segunda vida = two hearts; final card gear list shows icons (agent)
- 2026-10-05 T151: pop-up closes with Esc/×/tap outside and returns to the island panel; boat locked and bottles chip hidden while open; no per-act/difficulty medal state exists, so only «Superado» per act is shown; `useCanonMode` exposes `prep` and `acts`; pop-up shows BETA (T156 removes); updated REQ-AVE-037 proof link in `docs/spec/estado.md` to the renamed e2e (agent)
- 2026-10-05 T149: Kraken test failure came from Codex's half-done bot, not healing; bot now aims at the gap at its distance + 40 and counts inside ring up to `RING_MARGIN` 120; Vecino stress (40 seeds, 120 s): v14 30/40 survive vs v15 40/40 with 0 hits; legacy `bailing` upgrade label set to 0.4; `canon-hud-model.test.ts` expects decimal comma (agent)
- 2026-10-05 T152: standalone audio module loaded on pop-up open/game start; existing sea ambience (`setAmbientWorld`) silenced in game and restored; unlock only on trusted gesture; boss loop also for minibosses; site Ajustes music/effects multiply Cañón volume; music at 30 % while paused; default 70 %, key `boia.canon.sonido.v1`; `SurvivorsRun.onEvents`; reduced motion disables all camera shake in `mar3d.ts`; REQ-AVE-039 stays PARCIAL (agent)
- 2026-10-05 T153: shortcut games still pay in `pnpm dev`/e2e (`devStartRewards`) but never on the test version (incl. `?dev=1`); quit/invalid games unlock nothing, flooded valid game counts as played; secret `canon-tormenta` now = Kraken in Tormenta (no Capitán); guardacostas v2 = win Faro + play Cañón; Supabase enum also gets T36's 7 triggers; `bandera-fantasma` cosmetic added (an achievement prize must exist in the catalog); conflict with T152 resolved by the agent (agent)

## Proposals (new scope)
- 2026-10-05 T153: equipping the mascot in Supabase (`equipped_cosmetics`, `equip_cosmetic`, `lib/account/merge.ts` SLOTS) left for T154
- 2026-10-05 T152: REQ-AVE-039 needs its written accessibility review (T156); synthesized music/SFX are `muestra`, Hernán should listen before launch
- 2026-10-05 T149: in Tranquila both final bosses are nearly always beaten (Kraken 16/16, Fantasma 15/16): act-2 ≥ act-1 test at ceiling — T156 balance
- 2026-10-05 T151: act-2 sky «tentacle» is a CSS curve, could use an SVG icon (T156)
- 2026-10-05 T150: medal texts still use emoji (🥉🥈🥇 in `es-mar.ts`), world notices/pins in `mar-client.tsx` too; first-load JS at 186.9 of 200 kB budget — watch in T152/T154 (T156)
- 2026-10-05 T148: the boss arrow can sit briefly under the top-right slots box (T156)

## Log
- 2026-10-05 approved by Hernán in the session; main tests pass; commit 370eb78
- 2026-10-05 T148 launched · attempt 1 · agent a58d2b4672f5c0ca2 (opus)
- 2026-10-05 T149 launched · attempt 1 · Codex via wrapper agent a5d014c5aa4533926 (sonnet)
- 2026-10-05 20:48 T148 done · branch worktree-agent-a58d2b4672f5c0ca2 → c51a76c; worktree locked by its agent, remove at plan end
- 2026-10-05 20:50 push offer T148 sent; T150 launched · attempt 1 · agent a307081c1eaa72edc (opus)
- 2026-10-05 21:05 T150 blocked · contact sheet approval asked on Telegram (boia-planet-013-T150-1)
- 2026-10-05 21:07 T151 launched · attempt 1 · agent a74b970390ca1beed (opus)
- 2026-10-05 21:15 T150 icons approved by Hernán in the session (A); answer sent to the agent
- 2026-10-05 21:25 T150 done · branch worktree-agent-a307081c1eaa72edc → 5fcfb9e; push offer T148 cancelled, push offer T150 sent
- 2026-10-05 21:30 T149 Codex usage limit (WIP e1f06d5 on worktree-agent-a5d014c5aa4533926: Kraken tranquila balance test failing, full checks not run) → Opus continuation, not a counted failure
- 2026-10-05 21:32 T149 continuation launched · agent ab0f59486779a0601 (opus), merges worktree-agent-a5d014c5aa4533926
- 2026-10-05 21:45 T151 done · branch worktree-agent-a74b970390ca1beed → f66e051; push offer T150 cancelled, push offer T151 sent
- 2026-10-05 21:47 T152 launched · attempt 1 · agent a2610e06d4ddf9e6b (opus)
- 2026-10-05 22:20 T149 done · branch worktree-agent-ab0f59486779a0601 → 6858e3f; push offer T151 cancelled, push offer T149 sent
- 2026-10-05 22:22 T153 launched · attempt 1 · agent ad565e00d1afaafa6 (opus)
- 2026-10-05 22:58 T152 done · branch worktree-agent-a2610e06d4ddf9e6b → d7de982; push offer T149 cancelled, push offer T152 sent
- 2026-10-05 23:05 local preview for Hernán: detached worktree .claude/worktrees/preview-013 at b554768, launch config plan013 on port 3102 (remove at plan end)
- 2026-10-05 23:30 T153 done by agent; integration conflict with T152 in canon-mode.tsx, estado.md → sent back to the same agent
- 2026-10-05 23:58 T153 done · branch worktree-agent-ad565e00d1afaafa6 → 74350af; push offer T152 cancelled, push offer T153 sent
