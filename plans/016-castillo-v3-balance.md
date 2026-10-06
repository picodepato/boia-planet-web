# Plan 016 — Castle v3: Ibiza you collect, camera, wider U-turns; Fiestera and /mar fixes

Status: active
Created: 2026-10-06
Base branch: main
Goal: Third round on the «Defensa del Castillo» from Hernán's notes and answers of 2026-10-06 (`plans/016-notes.md`, folded below). (1) Ibiza paid back in 45/30/20 s with smaller payouts for extra Ibizas, and Ibiza's money piling up over the island until the player collects it. (2) Wider U-turns, a camera that centres the plane when zoomed in, the castle upgrade sound, no turbo in the arena. (3) The Boia Fiestera to the right of the yellow route line just before the Puerto de Alicante. (4) /mar fixes: arrows dead after «Mi Barco», guide bubbles pointing at the plane and the island, and achievement texts.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task (this machine is Windows 10, Git Bash): the two `packages/db` suites need a local Postgres that this machine does not have, hence the exclude; `PYTHONUTF8=1` makes the Python checks read UTF-8; if a guard blocks the chained test command, run its steps one by one. Balance sims run with `pnpm test:slow`. E2E: `E2E_PORT=<free port> pnpm e2e <spec files> --workers=1` (first time in a worktree: `pnpm --filter @boia/web exec playwright install chromium`); the machine is slow under load, rerun only failing specs; the full e2e run is done only in T185. UI strings only by key in `apps/web/lib/i18n/`, never loose strings in components. Content (names, texts, numbers, sounds) stays `muestra`. Never commit `apps/web/public/atlas/`, `.claude/launch.json` or any `.env*` file other than `.env.example`. Never push or deploy; Supabase migrations (if a task needs one, e.g. the ranking's config version seed) are written and tested locally but never applied to a real project (Hernán does that). Never edit `docs/DECISIONES.md`. Local mode (D-20, no Supabase env vars) must keep working; Supabase mode must not break. Work only on the main world **Arcilla**; **Acuarela** stays hidden and is not kept in parity. **The Cañón's game and balance do not change** (`SURVIVORS_CONFIG_VERSION` stays). Skills: each task's block names the skills it may invoke with the Skill tool; invoke none other.

**Required reading for every task:** this header; plan 015's Outcomes, Decisions and Proposals (`plans/015-castillo-v2-mascotas.md`), which this plan builds on. Where they disagree, this plan wins.

Decisions of 2026-10-06 that every task follows (Hernán's notes and answers):
1. **Fiestera.** Sailing along the yellow route line (`RouteLine`, from the start port toward the Puerto de Alicante), the Boia Fiestera sits **to the right of the line, close to it, just before the Puerto de Alicante**: the line passes between the boat and the Fiestera. The line itself does not change.
2. **Castle camera.** Fully zoomed out it stays as now: fixed on the map centre, moving a little with the plane. From **half zoom inward the plane is always centred** and the camera follows it; between half zoom and fully out, a smooth blend. No more drift or misalignment when zoomed in.
3. **U-turns.** Wider, only enough that the largest island fits inside with margin: inner width ≈ largest island footprint + 30 %. The path may grow a little; adjust walk speed only if the walk time changes noticeably.
4. **No damage retune.** Island damage numbers stay as plan 015 T178 left them (Hernán, 2026-10-06, after seeing the T178 table); no ±15 % rule. Only Ibiza changes (decisions 5–7).
5. **Ibiza payback.** Level 1 pays back its build cost in **45 s**; the level-2 upgrade pays back its own cost in **30 s**; the level-3 upgrade in **20 s**.
6. **Extra Ibizas pay less.** The first Ibiza built pays 100 %, the second 70 %, the third and later 50 % (by build order). The shown numbers are what each one really pays.
7. **Ibiza money is collected.** Payouts no longer go straight to the coins: they pile up **over the island** as a visible coin with a counter. The player collects by **tapping/clicking the money**, by a **key that collects every Ibiza** (e.g. C), or by **flying the plane over it**. Collecting adds the coins, shows a **big golden «+N»** rising from the island, and the counter goes back to 0. The pile has a cap of **60 s of that island's payout**; when full it stops growing and the counter changes colour («lleno»). The guide does **not** explain it; instead, tapping an Ibiza opens its card with a **collapsible, very short** explanation (what it pays every 10 s, that the money piles up and how to collect it).
8. **Turbo.** Hide the turbo button and the speed readout while in the castle arena only; the Cañón and plain `/mar` keep them.
9. **Castle upgrade sound.** A short sound of its own when the castle is upgraded (`muestra`).
10. **Guide bubbles.** The «mover» bubble points at the plane on screen and the «ficha» bubble at the island, through a public world→screen position hook in `mar3d.ts`.
11. **Texts.** `docs/propuestas/logros-catalogo.md` says «Primera regata» where it still says «Por Los Rápidos»; the «Rápido» achievement's progress line gets its own wording (not the «vuelta» line of «Rayo»).
12. Unchanged by Hernán: Faro island stays where it is; Vecino size in the castle stays; no Supabase test run needed (done in plan 015 T179, 85/85).

## Tasks

## T180 — Boia Fiestera to the right of the route line before the Puerto de Alicante
- Status: pending
- Depends on: none
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Goal: Move the Boia Fiestera so that, sailing the yellow route line toward the Puerto de Alicante, it appears to the right of the line, close to it, just before the Puerto (decision 1).
- Context: `packages/world/src/worlds/arcilla/map.ts` (`FIESTERA_ANCHOR` l.118 at `[-3.8, 7.6]`; Puerto de Alicante `cala` l.394 at `[8.5, 13.0]`; `PORT_ANCHOR` l.116 `[0, 25.3]`), `apps/web/app/mar/engine/compact.ts` (`ROUTE_STOPS` l.181, `seaRoute` l.311), `apps/web/app/mar/engine/effects.ts` (`RouteLine` l.378), the Fiestera's party/encounter code and its e2e specs (grep `fiestera`), the minimap. "Right" is relative to the boat's heading along the start-port → Puerto leg.
- Scope: may touch the Fiestera anchor and anything derived from it (encounter zones, minimap, sheet, buoys, tests, the world checks) / must not touch the route line, other places' positions, the castle game.
- Done when:
  - a screenshot from the start camera sailing toward the Puerto (mobile 390×844 and desktop) shows the Fiestera to the right of the yellow line, before the Puerto, no overlap with other places, on water → saved under /tmp/orchestrator-attach/boia-planet-hernan-T180/
  - `E2E_PORT=<free> pnpm e2e <fiestera specs and mar-ruta/route specs touched> --workers=1` → exit 0
  - Test command → exit 0
- Outcome:

## T181 — Castle sim v3: wider U-turns, Ibiza paybacks, extra-Ibiza payouts and collectable money
- Status: pending
- Depends on: none
- Model: opus
- Goal: Engine-side changes for decisions 3, 5, 6 and 7: wider U-turns; Ibiza 45/30/20 s paybacks; 100/70/50 % payouts by build order; payouts pile up per Ibiza (cap = 60 s of its payout) and are collected by a `collect(islandId | all)` command or automatically when the plane passes over the island. Deterministic, so ranked games and replays stay valid.
- Context: `packages/engine/src/defense/` (`config.ts` U-turns l.387–393 `{kind:'u', depth:430, radius:135}`, path width 90 l.378, Ibiza l.448–452, islands l.405–480; `path.ts` l.141–156; `sim.ts` events l.148, 644; `build.ts`), `defense-balance.test.ts`, plan 015 T169/T178 Outcomes and Decisions, the ranking seed rows that carry `DEFENSE_CONFIG_VERSION` (`supabase/migrations/`), how the web side reads coin events (`apps/web/app/mar/engine/defense-view.ts:613`, `castillo-audio.ts`) so the new events (pile changed, full, collected) are easy to consume in T183.
- Scope: may touch `packages/engine/src/defense/**`, its tests, the version seed in a new local migration if the ranking needs it, minimal web adapters needed to keep the build green (coins now arrive by collection; a temporary auto-collect in the web layer is not allowed — expose the command and leave the UI to T183) / must not touch island damage numbers (decision 4), the arena view, HUD or camera (T183).
- Done when:
  - unit tests cover: U-turn inner width ≥ largest island footprint × 1.3; Ibiza L1/L2/L3 payback 45/30/20 s from config; second Ibiza 70 %, third 50 %; pile caps at 60 s and stops; collect by command, by `all`, and by plane pass; determinism (same commands → same result) → pass
  - `pnpm test:slow` → exit 0 (adjust the balance sim's expectations only where Ibiza changed; bots learn to collect)
  - `DEFENSE_CONFIG_VERSION` bumped
  - Test command → exit 0
- Outcome:

## T183 — Castle arena v3: camera follow, Ibiza money on screen, upgrade sound, no turbo
- Status: pending
- Depends on: T181
- Model: opus
- Goal: Decisions 2, 7 (view side), 8 and 9. Camera centres the plane from half zoom inward with a smooth blend to the fixed top view; Ibiza's pile drawn over each island as a coin with a counter («lleno» colour at cap), tap/click on it collects, key C collects all, plane pass collects (sim does it; the view shows it), big golden «+N» rising from the island on each collection (replaces the old per-payout pop-up), the Ibiza card has a collapsible, very short explanation (pays N every 10 s, money piles up to a cap, tap it / key C / fly over to collect); the castle upgrade plays its own sound; turbo button and speed readout hidden in the castle arena.
- Context: `apps/web/app/mar/engine/defense-arena.ts` (`arenaCameraPose` l.125–146, `ARENA_ZOOM_NEAR` l.113, `ArenaZoom` l.158), `mar3d.ts` (pose use l.3352, wheel l.873, pinch l.2806, taps), `defense-view.ts` (coin pop l.187, 613), `defense-overlays.ts` (`COIN_POP_S` l.304), `castillo-hud.tsx`, `castillo-hud-model.ts`, `castillo-audio.ts` (l.106, 142–167; `castleUpgrade` event plays nothing), `mar-client.tsx` (`.mar-speed` l.2378–2381, turbo l.2427, 2472–2485, `castle.active` l.489), T181 Outcome, plan 015 T170/T171 Outcomes.
- Scope: may touch the castle arena view, overlays, HUD, castle audio, the turbo/speed conditions in `mar-client.tsx`, castle e2e specs / must not touch engine numbers (T181), the Cañón, plain `/mar` behaviour.
- Done when:
  - unit test for the camera pose: from half zoom inward the plane projects to the screen centre (± a few px); fully out equals today's pose → pass
  - castle e2e: an Ibiza's pile grows, collecting by tap and by key C adds the coins and resets the counter; turbo and speed readout absent in the arena, present back on `/mar` → exit 0
  - screenshots (mobile and desktop) of the pile, the «lleno» state and the «+N» → /tmp/orchestrator-attach/boia-planet-hernan-T183/
  - baja-quality p95 frame time at the Tormenta 10-min peak not worse than plan 015's 33.4 ms by more than 10 %
  - Test command → exit 0
- Outcome:

## T184 — /mar fixes: arrows after «Mi Barco», guide bubbles on the plane and island, texts
- Status: pending
- Depends on: none
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Goal: Decisions 10 and 11, and the pre-existing bug: after opening and closing «Mi Barco» from the menu, keyboard arrows stop steering the boat on plain `/mar`.
- Context: bug — `mar-client.tsx` (`openTienda` l.1701, 1743; `MarTienda` close l.2618–2625; `inputEnabled` effect l.1518–1536), `mar3d.ts` (`onKey` l.2866 returns early on `!inputEnabled || switcher.locked` or focused INPUT/TEXTAREA; listener l.2748), `apps/web/app/mar/hoja.tsx:49` (focus on mount); check `switcher.locked` and focus after close at runtime. Guide — `apps/web/app/mar/castillo-guia-model.ts` («mover» l.126–130, «ficha» l.156–160 have `anchors: []`; `placeGuideBubble` l.255–262), `mar3d.ts` private `project()` l.3939 and public `anchor()` l.1366. Texts — `docs/propuestas/logros-catalogo.md` l.60, 62, 122–140; `packages/store/src/sample/progress.ts` l.156–189; `apps/web/lib/i18n/es-lib.ts` l.284–285 (`logros.model.teQuedaUnaVuelta`, `tuMejorVueltaTe`).
- Scope: may touch the files above, a public screen-position hook in `mar3d.ts`, guide bubble placement, i18n keys, e2e specs / must not touch the castle sim, the arena camera (T183), achievement thresholds or prizes.
- Done when:
  - e2e: open and close «Mi Barco» from the menu, then arrow keys move the boat → exit 0
  - castle guide e2e: «mover» and «ficha» bubbles have a tail and point within ~40 px of the plane / island on screen → exit 0
  - `grep -rn "Por Los Rápidos" docs apps packages` → no matches; «Rápido» progress line uses its own key
  - Test command → exit 0
- Outcome:

## T185 — Close: full e2e, balance check, docs, test guide
- Status: pending
- Depends on: T180, T181, T183, T184
- Model: opus
- Goal: Close the plan: full e2e, a last balance check with everything in, docs and spec status, and a short test guide for Hernán.
- Context: all Outcomes, Decisions and Proposals of this plan; `python3 tools/spec/estado.py`; plan 015 T178 Outcome (how the close was done).
- Scope: may touch tests, docs, `docs/spec/estado.md`, small fixes to things this plan broke / must not touch new features or `docs/DECISIONES.md`.
- Done when:
  - `pnpm test:slow` → exit 0; bot table per difficulty and the one-island-only runs recorded in the status fragment
  - `E2E_PORT=<free> pnpm e2e --workers=2` → all pass, or only load flakes that pass when rerun alone (listed)
  - `python3 tools/spec/estado.py` → exit 0
  - test guide `docs/propuestas/2026-10-06-castillo-v3-guia-prueba.md` (what changed, how to try it, what to answer)
  - Test command → exit 0
- Outcome:

## Decisions
- 2026-10-06 plan: decisions 1–12 above from Hernán's notes and answers in the session; extra Ibizas 100/70/50 %; Ibiza money collected by tap, key or plane pass, pile capped at 60 s of payout, no guide step; turbo hidden only in the castle (Hernán)
- 2026-10-06 plan: island damage retune (planned T182, ±15 % per coin) dropped: damage stays as T178 left it (Hernán)
- 2026-10-06 plan: T183 after T181 (needs the collect command); T180 and T184 short, to Codex (orchestrator)

## Proposals (new scope)

## Log
- 2026-10-06 drafted in the session with Hernán from plans/016-notes.md
- 2026-10-06 approved by Hernán («Arranca»); notes file folded in and removed
