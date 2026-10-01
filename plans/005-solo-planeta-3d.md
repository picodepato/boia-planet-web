# Plan 005 — Only the 3D planet

Status: active
Created: 2026-10-01
Base branch: main
Goal: Hernán and Álvaro reviewed every section of the site (opinion test, 2026-10-01) and decided that the world is the 3D planet only: the 2D isometric world (/juego, PixiJS) is deleted and everything it has that /mar lacks moves to /mar. The batch also polishes the world on mobile (compact HUD, small popups, faster steering), makes the Boia Fiestera the central mission with a real prize, reduces hidden discounts to 3 clear ones, rebuilds the three minigames (lighthouse, cannon, circuit), opens tickets inside the 3D world, rebuilds the landing intro in 3D (and fixes it skipping to the landing), and adapts the Admin. Content stays `muestra`; landing blocks other than the hero are not touched (a parallax landing is the next batch).
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' && sh tools/spec/checks.sh && pnpm typecheck && pnpm lint && pnpm build
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task (this machine is Windows 10, Git Bash): the two `packages/db` suites need a local Postgres that this machine does not have, hence the exclude; `PYTHONUTF8=1` makes the Python checks read UTF-8. E2E: `E2E_PORT=<free port> pnpm e2e <spec files> --workers=2` (first time in a worktree: `pnpm --filter @boia/web exec playwright install chromium`). UI strings only by key in `apps/web/lib/i18n/`. When a REQ moves, update `docs/spec/estado.md` with its test (`python3 tools/spec/estado.py` must pass). Every user-visible decision below comes from the 2026-10-01 interview; follow it, and ask (STATUS: blocked) only for behavior it does not define.

## Tasks

## T52 — Shared world code out of app/juego
- Status: done
- Depends on: none
- Goal: /mar, /carnet, the landing and their tests import ~20 modules from `apps/web/app/juego/` (achievements, carnet, carnet-invite, circuit-hud, demo-world, encounters, MundosPicker, minigame-layer, mission, notices, repo, ship-position, sound, ship-look, use-invitations, world-choice, world-progress, place-panels, world-ui, hud.css…). Move everything that is not the PixiJS 2D renderer to a shared home so /juego can later be deleted without touching /mar. Pure refactor: no behavior change.
- Context: `apps/web/app/mar/mar-client.tsx` (imports at ~41-91), `apps/web/app/mar/sheet.tsx:24`, `apps/web/app/carnet/carnet-page.tsx:4-10`, `apps/web/app/(landing)/` (event-card test, `lib/landing/eventos.test.ts`), `apps/web/lib/` (repo, logros, barco, ticketing). `packages/engine` Pixi-free modules (headless, circuit, mission, minigames, ui, streaming, bottles, ship controller) stay where they are. ESTADO.md plan 004 T51 section describes /mar parity. The landing intro (`apps/web/lib/intro/*`, `packages/engine/src/intro/`) is rebuilt in T57: leave its imports alone if moving them is not trivial.
- Scope: may touch `apps/web/app/juego/**` (moving files out, re-exports while /juego still exists), `apps/web/app/mar/**`, `apps/web/app/carnet/**`, `apps/web/app/(landing)/**` imports only, `apps/web/lib/**`, the e2e specs' import paths / must not touch user-visible behavior, `packages/engine` internals, Pixi rendering code.
- Done when:
  - `grep -rnE "from ['\"](\.\./)+juego/|app/juego/" apps/web/app/mar apps/web/app/carnet apps/web/lib --include=*.ts --include=*.tsx | grep -v "lib/intro"` → no output
  - Test command → exit 0
  - `pnpm e2e e2e/mar-3d.spec.ts e2e/mar-paridad.spec.ts` (with E2E_PORT) → exit 0, and the /juego specs still pass (`pnpm e2e` full run, --workers=2) → exit 0
- Outcome: everything in app/juego except the 2D renderer (page.tsx, game-canvas.tsx, juego.css) moved to apps/web/lib/mundo/ with git mv; importers rewritten, no re-exports → 5c5b886

## T53 — Mobile HUD and small popups in /mar
- Status: done
- Depends on: T52
- Goal: On mobile the popups take up to ~60% of the screen and the menu/HUD is scattered. Interview decisions: (1) one thin fixed bar at the bottom with 4–5 always-visible icons — Mapa, Logros, Carnet, Menú — plus a highlighted "Entradas" button; (2) at the top only the minimap (kept, small, tap to enlarge) and the balance; (3) every popup (island/event sheet, discount, achievement, notices) becomes a small card at the bottom, about 25% of the screen, with the essentials and one button, expanding only when tapped; (4) notices become small chips at the top that leave on their own. Minimum space, everything organized and visible. Desktop keeps working with the same structure.
- Context: `apps/web/app/mar/mar.css` (safe areas L16-19, `.mar-top`, `.mar-menu`, `.mar-notices`, `.mar-chips`, `.mar-minimap`, `.mar-rail`, `.mar-turbo`, `.mar-tickets`, `.mar-sheet` with max-height min(58vh,520px), desktop rules at `@media (min-width: 760px)`), `apps/web/app/mar/mar-client.tsx` (header ~1237, menu ~1280-1345, notices, chips, rail, minimap, sheet ~1595), `apps/web/app/mar/sheet.tsx`, REQ PRO-008 / PRO-009 / IDE-035/036 in `docs/spec/09-requisitos.md`. The bar's Carnet icon may open `/carnet` until T55 brings the Carnet inside the world; Menú keeps today's sections.
- Scope: may touch `apps/web/app/mar/**` (layout, CSS, HUD components), shared UI moved in T52, i18n keys, e2e specs for /mar / must not touch steering (T54), game rules, the landing.
- Done when:
  - Test command → exit 0
  - a new or updated e2e spec at a 375×812 viewport asserts: the bottom bar with Mapa/Logros/Carnet/Menú and Entradas is visible; an island sheet opens at ≤ 30% of the viewport height and expands on tap; notices render as chips — exit 0, together with `e2e/mar-3d.spec.ts` and `e2e/mar-paridad.spec.ts`
- Outcome: bottom bar (Mapa, Logros, Entradas, Carnet, Menú), top only minimap + balances, compact bottom cards (~21% height) that expand on tap, notices as chips; new e2e mar-hud.spec.ts → 03882a9

## T54 — Faster steering in /mar
- Status: done
- Depends on: none
- Goal: On mobile the boat needs a large stick angle to turn and turns slowly. Interview decisions: it turns quickly towards where you point even with a small drag; when you are going forward and pull the stick backwards, the boat makes a quick, tight turn (small radius, fast) instead of a wide arc; turbo/voyage speed must not widen the turning circle. Apply the touch sensitivity (`turnScale`) in /mar as /juego does, so T55's Ajustes slider can drive it.
- Context: `apps/web/app/mar/engine/mar3d.ts` (touch stick ~1696-1715, `readInput` ~1828-1848: dead zone 8 px, throttle=(len-8)/56; turbo/voyage multipliers ~1941-1945; `TURBO_S`, `VOYAGE_SPEED` ~237-242), `packages/engine/src/ship/controller.ts:98-111` (max turn = turnRate × speedFactor × throttle × turnScale; `align` slows the boat until it faces the target), `packages/engine/src/ship/config.ts` (turnRate 2.4, minTurnFactor 0.4, maxSpeed 220), `packages/engine/src/input/controls.ts:192,252` (sensitivity 0.5–1.5).
- Scope: may touch `apps/web/app/mar/engine/**`, `packages/engine/src/ship/**`, `packages/engine/src/input/**` and their tests / must not touch the HUD layout (T53), /juego behavior beyond what shared controller changes imply (keep /juego tests green).
- Done when:
  - Test command → exit 0
  - unit tests in the controller/mar input show: with a small drag (just past the dead zone) the heading reaches a 90° target in clearly less time than before (assert against the old constants in the test); a reverse input while moving forward completes a 180° turn with a smaller radius than a forward 180° turn at the same speed; turbo does not increase the turning radius → exit 0
  - `pnpm e2e e2e/mar-3d.spec.ts` → exit 0
- Outcome: fast steering in /mar via optional ShipConfig fields (steerFloor, turnRadius, reverseTurn) set only by MAR_SHIP_CONFIG; 90° from a small drag 19.6 s → 0.73 s; tight reverse turn; turbo keeps the radius; sensitivity applied → 9c204be

## T55 — Settings, controls, Carnet and deep links inside /mar
- Status: done
- Depends on: T53, T54
- Goal: Things only /juego has move into the 3D world: Ajustes (turn sensitivity driving T54's `turnScale`, music and effects volumes, language), the Controles help and Welcome Aboard sections, and the Carnet inside the world (view and edit without leaving /mar, reachable from the bar's Carnet icon). /mar also learns the deep links the landing uses: `?ir=<place>` and `?evento=<slug>` start the 3D with the boat sailing towards that island; `?menu=carnet` opens the Carnet. Then every landing/page link that today points to /juego points to /mar: hero is handled by T57, but here "Rumbo a su isla"/"Ir a su isla" (event page, `lib/landing/eventos.ts`), "Ir en barco al Puerto de Fotos", "Ir en barco a la isla tienda" (`blocks.tsx`, `lib/landing/access.ts`), footer "crear Carnet", purchase invite (`buy-button.tsx`), tickets panel `ticketsSailHref`, /carnet links, Admin "Ver el mundo".
- Context: /juego menu sections in `apps/web/app/juego/menu/sections/` (or where T52 moved them), `loadSettings`, `apps/web/app/carnet/`, `apps/web/app/mar/mar-client.tsx` (reads only `vuelo`, `mundo`, `estilo`, `delfin`, `cerca` today), `apps/web/lib/world-handoff.ts`, analytics `explore_start` sources in `packages/contracts/src/analytics.ts:19`.
- Scope: may touch `apps/web/app/mar/**`, shared world UI, `apps/web/app/(landing)/**` links only, `apps/web/app/eventos/**`, `apps/web/app/carnet/**`, `apps/web/app/admin/**` link only, `apps/web/lib/**`, analytics sources, i18n, e2e / must not touch the hero (T57), bottles/ranking (T56), deleting /juego (T62).
- Done when:
  - Test command → exit 0
  - e2e: `/mar?ir=<photos place>` sails to that island; `/mar?evento=<sample slug>` sails to the event island; `/mar?menu=carnet` opens the Carnet in the world; changing sensitivity in Ajustes changes turning (store value read by the engine); every landing link above has href starting with `/mar` → exit 0
  - `grep -rn "/juego" apps/web/app apps/web/lib --include=*.ts --include=*.tsx | grep -v "app/juego/"` → only the hero CTA (T57) and the /mar "Versión clásica 2D"/fallback links (T62) remain
- Outcome: Ajustes (sensitivity read by the engine), Controles, Welcome Aboard and Mi Carnet inside /mar in a shared MarHoja sheet; deep links ?ir, ?evento, ?menu; every landing/Carnet/Admin link to /mar; IDE-035/036 HECHO → 42fedb9

## T56 — Message bottles and ranking in /mar
- Status: done
- Depends on: T53
- Goal: Bring to the 3D world the message bottles (one per person, 140 characters, needs a Carnet, visible to its author plus seeded sample bottles) and the Ranking (tabs De siempre / Temporada / Circuito, local, sample members), reachable from the new HUD/menu.
- Context: `apps/web/app/juego/bottles/*` (or moved by T52), `packages/engine/src/bottles/{sea,finder}`, `repo.bottles` in `packages/store`, `BOTTLE_SPOTS` in `packages/world`, `apps/web/app/juego/menu/sections/ranking.tsx`, Temporadas per world in the Admin.
- Scope: may touch `apps/web/app/mar/**`, shared world UI, `packages/engine/src/bottles/**` (Pixi-free parts), i18n, e2e / must not touch HUD structure beyond adding entries, steering, /juego deletion.
- Done when:
  - Test command → exit 0
  - e2e in /mar: with a Carnet, write a bottle (≤140 chars), it appears in the sea for its author after reload; sample bottles are visible; Ranking opens with its three tabs and sample members → exit 0
- Outcome: bottles (140 chars, needs Carnet, sample bottles) and Ranking (3 tabs) in /mar as MarHoja sheets; Mi Carnet in the world links to the bottle sheet; own ranking row opens Mi Carnet → b6e81b6

## T57 — 3D landing intro with the planet, and the hero
- Status: done
- Depends on: T52
- Goal: The landing intro is a PixiJS scene and sometimes skips straight to the landing. Rebuild it in three.js with the /mar planet: short; the planet turns, the BOIA letters appear, "Zarpar" leads on. Fix the skips: the load budget must start at mount and wait for the scene to really be ready (no fixed 2000 ms from page boot), campaign/share query params (`?si=`, `?s=`, `?ref=`, utm, WhatsApp/Linktree tags) must not skip it, a background-tab load must play it when the tab becomes visible, and a hero-block remount must not cancel it. Keep: "Saltar animación", "Solo quiero ver las entradas", reduced-motion still, light fallback without WebGL, client navigation back to "/" goes direct (D-21), `/?intro=1` replays. The hero gets two buttons: the main one to the 3D world (/mar) and Tickets beside it, visible; remove the separate 2D "Explorar el universo" CTA. The landing must stay within its 192 kB budget (three.js lazy-loaded, not on the critical path).
- Context: `apps/web/app/(landing)/page.tsx` (`bootScript`, ~L31), `apps/web/app/(landing)/components/intro-stage.tsx`, `apps/web/app/(landing)/components/blocks.tsx` (hero CTAs ~L105-120, `heroScene`, key `b.id`), `packages/engine/src/intro/{entry,controller,timeline,config,title,world-geometry,scene}.ts` (budget `loadBudgetMs` 2000 at config.ts:205, entry.ts:25-50,94-105, controller.ts:151-155,199,370-380), `apps/web/lib/intro/*`, `apps/web/app/mar/engine/` for the planet, `scripts/landing-budget.mjs`, D-19/D-21 in `docs/DECISIONES.md`, REQ ENT-004/005/018/021/024/025.
- Scope: may touch `apps/web/app/(landing)/**` (intro, hero only), `apps/web/lib/intro/**`, `packages/engine/src/intro/**`, a shared three.js planet module extracted from /mar, i18n, e2e intro specs / must not touch the other landing blocks, /mar gameplay, deleting the Pixi intro scene file is fine only if nothing else uses it.
- Done when:
  - Test command → exit 0 (includes the landing budget in `pnpm build`)
  - e2e: bare `/` plays the 3D intro and "Zarpar" reaches the landing; `/?si=abc` and `/?utm_source=ig` also play it; `/?intro=0` and a client navigation back to "/" go direct; reduced-motion shows the still; with an artificially slow scene load (route delay) the intro still plays instead of skipping; hero has exactly two CTAs: /mar and Tickets → exit 0
- Outcome: 3D planet intro (apps/web/lib/planeta/), budget 9 s from mount counting visible time only, campaign params no longer skip, hero with /mar + Tickets; landing 177.8/192 kB → 09e86a6

## T58 — Tickets inside the 3D world
- Status: done
- Depends on: T53
- Goal: The "Entradas" button in /mar opens the tickets panel ("Elige tu evento") and the test checkout right there, as a bottom card/sheet in the new HUD style, without leaving the world or going to the landing. A discount code found in the world is applied in that checkout; the post-purchase stamp/achievement and the Carnet invite work as on the landing.
- Context: tickets panel `apps/web/app/(landing)/components/tickets-panel.tsx`, checkout/buy button, `apps/web/lib/ticketing`, /mar "Entradas" today links to `/#tickets` and sails in turbo to the event island, analytics `tickets_panel_open`, `ticket_click_out`, `purchase_confirmed` (source must say it came from the world). REQ ENT-037, COM-015/016/017.
- Scope: may touch `apps/web/app/mar/**`, tickets panel/checkout components (reuse, do not fork), `apps/web/lib/ticketing/**`, analytics, i18n, e2e / must not change the landing's own tickets flow behavior.
- Done when:
  - Test command → exit 0
  - e2e in /mar: tap Entradas → panel opens inside the world; with a discount found in the world, confirm the test purchase with the discount applied; the stamp reaches the Carnet; the URL stays on /mar → exit 0, and the landing tickets e2e specs still pass
- Outcome: Entradas opens "Elige tu evento" as a MarHoja sheet inside /mar (app/mar/entradas.tsx), checkout reused with source world, world discount applied, stamp to Carnet, URL stays /mar; ENT-037 HECHO → 40be280

## T59 — Boia Fiestera as the central mission; 3 clear discounts
- Status: running (attempt 1)
- Depends on: T53
- Goal: Interview decisions: (1) the Boia Fiestera rescue is the central mission; completing it (delivering her to the last island) gives a prize that matters: a ticket discount code applied in the checkout AND an exclusive ship only rescuers get. (2) Hidden discounts become exactly 3 — el náufrago, the cofre/ánfora, and the Fiestera's — each shown as a "?" on the minimap so people go for them; drop the others (expired VERANO26 debris, store TIENDA15 as a world discount). (3) Secrets without a prize (cueva del acantilado, campana hundida, círculo de las boies dormidas) stay hidden, unmarked, and grant coins or an achievement when found. (4) The dolphin and the info buoys guide towards the Fiestera, the discounts and the minigames. Achievements and coins/points otherwise stay as they are. Codes stay `muestra` (P16).
- Context: mission in `packages/engine/src/mission`, discounts in `packages/store` sample content (`packages/store/src/sample/content.ts`), ship catalog `apps/web/lib/barco/catalog.ts` and `docs/barcos/barcos.json`, achievements `apps/web/lib/logros` and `docs/propuestas/logros-catalogo.md`, encounters (dolphin, buoys), minimap in /mar, REQ AVE-007/008/009/015/016/017/019/021.
- Scope: may touch mission, discounts, secrets, encounters, sample content, ship catalog (add one exclusive ship reusing existing art or a recolor; no new Blender art), achievements catalog entries, /mar minimap markers, i18n, e2e / must not touch minigames (T60/T61), the Admin UI (T63).
- Done when:
  - Test command → exit 0
  - e2e in /mar: the minimap shows 3 "?" markers; completing the Fiestera grants a discount code usable in checkout and unlocks the exclusive ship; finding a secret grants its reward; only 3 world discounts exist in the sample content (asserted from the content source) → exit 0
- Outcome:

## T60 — Lighthouse and cannon minigames, rebuilt
- Status: running (attempt 1)
- Depends on: T52
- Goal: Both are too simple. Lighthouse ("Vigilancia del faro"): at night you sweep the lighthouse beam to light up pirate ships before they reach the coast; waves that get faster, lives and score. Cannon ("Cañón contra tiburones"): drag to aim (angle and power), the ball flies on a parabola, sharks and pirates move; waves, combos and score. Both playable on mobile and desktop inside /mar, with local best score, and keep their rewards hooks. Remove the "Minijuego · muestra" label once they are real games.
- Context: `packages/engine/src/minigames`, `MinigameLayer` (moved by T52), `.mar-minigame` in `apps/web/app/mar/mar.css`, islands Isla del Faro / Cap de l'Horta and Isla del Cañón / Torre de l'Illeta, REQ AVE-035/039.
- Scope: may touch `packages/engine/src/minigames/**`, the minigame layer and its CSS, i18n, achievements hooks, e2e / must not touch the circuit (T61), mission/discounts (T59).
- Done when:
  - Test command → exit 0
  - unit tests for each game's rules (waves speed up, lives end the game, parabola hits a target at the computed angle/power, combo scoring) → exit 0
  - e2e in /mar: open each minigame at its island, play scripted inputs, reach a score > 0 and a game-over screen → exit 0
- Outcome:

## T61 — Circuit El Freu, rebuilt
- Status: pending
- Depends on: T52
- Goal: The circuit is too simple. Rebuild it: a course marked by buoys you must pass, 3 laps, a ghost boat of your best time, boosts on the water, gold/silver/bronze medals, start light kept. Works in both worlds (El Freu / El Penyal) and on mobile.
- Context: `packages/engine/src/circuit`, `CIRCUIT_ID` in `packages/world`, `CircuitRace` and `apps/web/app/mar/race.ts`, circuit HUD (moved by T52), local record storage, ranking Circuito tab (T56 may land before or after: keep the stored record format compatible), REQ AVE-026/028.
- Scope: may touch `packages/engine/src/circuit/**`, `packages/world` circuit data, /mar race code and HUD, i18n, e2e / must not touch minigames (T60), steering constants (T54).
- Done when:
  - Test command → exit 0
  - unit tests: missing a buoy does not count the lap; 3 laps finish the race; medal thresholds; ghost replays the stored best run → exit 0
  - e2e in /mar: start the race, scripted run completes 3 laps, a medal and the best time are shown, a second run shows the ghost → exit 0
- Outcome:

## T62 — Delete the 2D world
- Status: pending
- Depends on: T55, T56, T57, T58
- Goal: Remove /juego and the PixiJS renderer. `/juego` (with any query) redirects to `/mar`, mapping `?ir=`, `?evento=`, `?menu=` to /mar's deep links. Delete the Pixi files (`game.ts`, `pixi-app.ts`, `views.ts`, `water.ts`, `wake.ts`, `camera.ts`, `ship/view.ts`, `bottles/view.ts`, `world/{assets,bubble,coast-view,object-view,streamer,texture-store}`, `transition/vortex-view.ts`, `intro/scene.ts`, `intro/sphere-probe.ts` and whatever T57 left), the `pixi.js` dependency, `GameSurface`/`world-handoff`, `app/sphere-probe`, `scripts/world-budget.mjs` from the build if it only served /juego, dead code (`useShipLocks`, `world/iso.ts` if unused), the /mar "Versión clásica 2D" link and the WebGL-error fallback to /juego (replace with a clear "your device can't show the 3D world" message plus Tickets). Keep both worlds (Arcilla, Acuarela) and the black-hole vortex in 3D. Migrate the e2e specs that open /juego to /mar or delete the ones that only test 2D rendering. Update docs: `README.md`, `CLAUDE.md` description ("mundo 2.5D isométrico" → 3D planet), `docs/TRASPASO.md`, `docs/spec/estado.md` (REQs that were about 2D), `docs/DECISIONES.md` (record the decision as a new D-24: only the 3D planet, 2026-10-01, Hernán and Álvaro).
- Context: the T52–T58 outcomes in this plan, `apps/web/next.config.ts` (`transpilePackages`), `packages/engine/src/index.ts`, `apps/web/e2e/` (23 specs open /juego), `apps/web/scripts/`.
- Scope: may touch anything needed to remove the 2D world, its tests and docs / must not change /mar behavior, the landing blocks, the Admin beyond its /juego link.
- Done when:
  - Test command → exit 0
  - `grep -rln "pixi" apps packages --include=*.ts --include=*.tsx --include=package.json | grep -v node_modules` → no output
  - `test ! -d apps/web/app/juego` → exit 0
  - e2e: `/juego?ir=<place>` redirects to `/mar` sailing there; full `pnpm e2e --workers=2` → exit 0
- Outcome:

## T63 — Admin adapted to the new world
- Status: pending
- Depends on: T59, T60, T61, T62
- Goal: The Admin reflects the batch: the 3 world discounts and the Fiestera prize (code + exclusive ship) editable; the rebuilt minigames and circuit (their tunable settings, if any, and achievements); "Ver el mundo" and the home preview open the 3D world; Admin "Mundo" edits trigger the vortex in /mar in the same tab (gap noted in TRASPASO); remove Admin sections or fields that only made sense for the 2D world. Nothing else changes.
- Context: `apps/web/app/admin/admin-app.tsx` and its sections, `apps/web/lib/admin/validate.ts`, `liveWorld` in `mar-client.tsx`, outcomes of T59–T62. REQ ADM-008/019/032.
- Scope: may touch `apps/web/app/admin/**`, `apps/web/lib/admin/**`, the store's admin-editable content, i18n, e2e admin specs / must not touch game rules beyond reading their config.
- Done when:
  - Test command → exit 0
  - e2e: edit the Fiestera discount code in the Admin and see it applied after completing the mission in /mar; edit a world discount and see it in /mar; "Ver el mundo" opens /mar → exit 0
- Outcome:

## Decisions
- 2026-10-01 interview: only the 3D planet; delete the 2D world; the hero's main button goes to the 3D world with Tickets beside it (Hernán and Álvaro)
- 2026-10-01 interview: priorities for this batch are the world/game and polish/mobile; landing blocks below the hero stay as they are; parallax landing is the next batch; content stays `muestra` (Hernán and Álvaro)
- 2026-10-01 interview: intro rebuilt in 3D with the planet, fixing the skip; bottles, ranking, Carnet and Ajustes move into the 3D world; both worlds (Arcilla, Acuarela) stay with the vortex; landing links open the 3D at their island (Hernán and Álvaro)
- 2026-10-01 interview: mobile: small bottom card popups (~25%), fixed bottom icon bar + minimap kept, fast steering with a quick tight turn when pulling back (Hernán and Álvaro)
- 2026-10-01 interview: Fiestera central with discount + exclusive ship prize; 3 discounts marked on the minimap; secrets without prize stay with an achievement; dolphin and buoys guide to the new content; rebuild lighthouse (night beam), cannon (parabola), circuit (buoys, 3 laps, ghost, boosts, medals); achievements and coins stay; tickets open inside the 3D; Admin adapted (Hernán and Álvaro)
- 2026-10-01 T00: test command excludes `packages/db` (no Postgres on this Windows machine) and sets PYTHONUTF8=1 (orchestrator)

- 2026-10-01 T52: shared world home is apps/web/lib/mundo/ (71 files moved); /juego keeps only page.tsx, game-canvas.tsx, juego.css; /mar styles panels with its own .mar .juego-panel rules (agent)
- 2026-10-01 T52: on this Windows machine the full e2e run at --workers=2 has load timeouts that pass when rerun alone, and e2e/despliegue.spec.ts (/api/art) fails because path.relative gives backslashes; T62 must fix that spec so its full e2e run can pass (orchestrator)

- 2026-10-01 T54: new steering is 3 optional ShipConfig fields (steerFloor, turnRadius, reverseTurn) set only by /mar through apps/web/app/mar/engine/steering.ts; /juego unchanged (agent)
- 2026-10-01 T54: /mar reads sensitivity each step via controlSensitivity(); T55 only has to call setControlSensitivity; steering values are `muestra`, to tune on a real phone (agent)
- 2026-10-01 T54: integration failed once because ESLint linted .claude/worktrees; fixed by ignoring .claude/** in eslint.config.mjs (orchestrator)

- 2026-10-01 T53: back link and world name moved into a header inside the Menú; Menú and Carnet invite open as cards above the bar; each compact card has one button (Navegar / Comprar entrada / Ir a la isla / Explorar la isla); desktop uses the same layout with a centred 480px bar; Carnet icon 📇 links to /carnet until T55 (agent)

- 2026-10-01 T57: shared planet module apps/web/lib/planeta/ imports /mar island builders and palette (no /mar file changed); intro config v4 in intro/planet.ts; Pixi intro/scene.ts and lib/intro/active.ts deleted (agent)
- 2026-10-01 T57: load budget 9 s from mount (visible time only), 15 s boot-script safety cap; hero planet capped at 30 fps and ¼ frame time, loaded on idle; without WebGL a CSS planet; main CTA keeps class cta-explore and its Admin label, now to /mar (agent)
- 2026-10-01 T57: REQ-ENT-012 (scene hand-off to /juego) moved to FALTA (agent)
- 2026-10-01 T57: T62 must also delete the leftover 2D intro modules (config, sphere, port, world-geometry, timeline, assets, sphere-probe) and lib/intro/worlds.ts (orchestrator)

- 2026-10-01 T55: shared MarHoja cream sheet (Carnet, Ajustes, Controles, Welcome Aboard, Logros, Barco shop); deep links accept event id or slug and 2D menu names, are stripped from the URL at boot, and a sail link starts from the spawn; voyageHref is /mar?evento=…; new explore_start sources photos and store (agent)
- 2026-10-01 T55: conflict with T57 in lib/intro resolved keeping T57's intro (agent)

- 2026-10-02 T58: each event in the in-world panel has "Comprar entrada" (checkout on top) and "Ir a su isla" (the old trip, then checkout); without an on-sale event the panel says "Próximamente"; SandboxCheckout gained optional source/className (checkout--mar = bottom sheet on mobile); analytics tickets_panel_open/ticket_click_out with source world, island buy button now sends ticket_click_out source island (agent)

- 2026-10-02 T56: bottles keep shared-map coordinates, converted by pointMap (land spots move to nearest water); MarHoja focuses with preventScroll for every sheet; opening one sheet closes the other; Circuito tab reads readRecord (compatible with T61) (agent)
- 2026-10-02 T56: conflicts with T55 and T58 resolved by the agent (agent)

## Proposals (new scope)
- 2026-10-02 T58: REQ-ENT-040 wording in 09-requisitos.md still says the trip starts on the first Entradas tap; it now starts from "Ir a su isla": reword
- 2026-10-01 T57: unused i18n keys hero.explore3d* come from docs/propuestas/textos-zonas.md and stay until that document changes
- 2026-10-01 T57: REQ-ENT-003/005 text says "no 3D library in the bundle"; critical path still has none (three.js lazy): reword with Álvaro
- 2026-10-01 T53: REQ-PRO-009 stays PARCIAL (criterion asks for "Inicio" among on-screen controls and fps only with ?debug): decide whether the new bar closes it
- 2026-10-01 T54: in turbo, the pull-back turn is still wider than at normal speed (101 u vs 65 u)
- 2026-10-01: parallax landing (next batch)

## Log
- 2026-10-01 21:40 T52 launched · attempt 1 · agent a8c286457ec28b741
- 2026-10-01 21:40 T54 launched · attempt 1 · agent a54ffde1ea099d9dd
- 2026-10-01 22:11 T54 done · branch worktree-agent-a54ffde1ea099d9dd → 9c204be
- 2026-10-01 22:16 T52 done · branch worktree-agent-a8c286457ec28b741 → 5c5b886
- 2026-10-01 22:18 T53 launched · attempt 1 · agent ac03818fc888500c6
- 2026-10-01 22:18 T57 launched · attempt 1 · agent a42618e2a4c75025b
- 2026-10-01 22:41 T53 done · branch worktree-agent-ac03818fc888500c6 → 03882a9
- 2026-10-01 22:43 T55 launched · attempt 1 · agent a3b7f8362886c377c
- 2026-10-01 23:21 T57 done · branch worktree-agent-a42618e2a4c75025b → 09e86a6
- 2026-10-01 23:22 T56 launched · attempt 1 · agent a00ff67f4d11ca19d
- 2026-10-01 23:58 T55 conflict with main (lib/intro/active.ts, bridge.ts) · sent back to agent a3b7f8362886c377c
- 2026-10-01 23:47 T55 done · branch worktree-agent-a3b7f8362886c377c → 42fedb9
- 2026-10-01 23:49 T58 launched · attempt 1 · agent a4283d2de4dfb0890
- 2026-10-02 00:25 T56 conflict with main (mar3d.ts, mar-client.tsx) · sent back to agent a00ff67f4d11ca19d
- 2026-10-02 00:38 T58 done · branch worktree-agent-a4283d2de4dfb0890 → 40be280
- 2026-10-02 00:40 T59 launched · attempt 1 · agent a4ef0c67ac86cd069
- 2026-10-02 00:46 T56 done · branch worktree-agent-a00ff67f4d11ca19d → b6e81b6
