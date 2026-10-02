# Plan 006 — Event islands, balance and the race

Status: active
Created: 2026-10-02
Base branch: main
Goal: Hernán and Álvaro's instructions of 2026-10-02 for the 3D world (/mar). The three ticket islands become themed Blender models (Isla de Halloween, Isla del Sonido, Isla de Nochevieja) selling the three real events; the main world's islands take real Mediterranean/Alicante names; the welcome sheet gets shorter and the auto-guidance goes away (a "?" help under the achievements instead, the dolphin stays); the economy is rebalanced so 10 minutes of play buys at least 3 ships and a skin; bottles cap at 10 in the sea; the circuit becomes "Los Rápidos" with a start popup, better checkpoints, obstacles, jump ramps and the ghost; the top links are reordered and the minimap centred; the whole site gets a Druk-Wide-like display font plus Inter.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task (this machine is Windows 10, Git Bash): the two `packages/db` suites need a local Postgres that this machine does not have, hence the exclude; `PYTHONUTF8=1` makes the Python checks read UTF-8; if a guard blocks the chained test command, run its steps one by one. E2E: `E2E_PORT=<free port> pnpm e2e <spec files> --workers=1` (first time in a worktree: `pnpm --filter @boia/web exec playwright install chromium`); the machine is slow under load, rerun only failing specs. Blender 5.2.2 LTS (the version the pipeline was built with) is at `C:/Users/alvar/Blender/blender-5.2.2-windows-x64/blender.exe` (not on PATH); `Blender -b -P tools/blender/<script>.py -- …` works with it (verified: render.py --mundo arcilla --lugar cala). UI strings only by key in `apps/web/lib/i18n/`. When a REQ moves, update `docs/spec/estado.md` with its test (`python3 tools/spec/estado.py` must pass). Prices and codes stay `muestra`; the three events below (names, dates, venue) were given by Álvaro on 2026-10-02.

## Tasks

## T67 — Island names, the Halloween place and the three ticket events
- Status: done
- Depends on: none
- Goal: Decisions 2026-10-02 (Hernán and Álvaro). (1) Main world (Arcilla) island display names: `cala` → Cala Cantalar, `fotos` → Isla de Benidorm, `tienda` → Ibiza, `faro` → Tabarca, `canon` → L'Illeta dels Banyets, `allday` → Isla del Sonido, `ultima` → Isla de Nochevieja; the port, the castaway and El Remanso de los Cocodrilos keep their names; circuit `El Freu` → Los Rápidos (display name; keep ids stable unless renaming them is trivial and safe). (2) Add a new place `halloween` (Isla de Halloween) on the shared map, in free sea away from the other islands, reachable, with category isla, a ticket behavior and content('event'); give it a simple procedural placeholder look until T69 models it. (3) Acuarela (shares the map) gets the same three ticket islands with the same names (Isla de Halloween, Isla del Sonido, Isla de Nochevieja); its other islands keep their current names. (4) Exactly three ticket events in the sample content, linked to their islands: "BOIA Halloween" at Kiki García on Saturday 31/10/2026 → `halloween`; "SONIDO" on Saturday 05/12/2026 → `allday` (Isla del Sonido); "BOIA Nochevieja" on Thursday 31/12/2026 → `ultima` (Isla de Nochevieja). Prices `muestra`. The tickets panel (landing and /mar) shows only these three; older sample events are removed or moved to the past/archive so they never show as on sale. (5) The Boia Fiestera is delivered to the Isla de Nochevieja: every text, achievement, mission prompt and landing copy that names the destination says "Isla de Nochevieja". Update every test, deep link (`?ir=`, `?evento=`) and analytics that depends on the old ids/names.
- Context: `packages/world/src/worlds/arcilla/map.ts` (places, `ALLDAY_EVENT_ID`, `missionDestination`, circuit constants), `arcilla/skin.ts` `NAMES`, `acuarela/skin.ts` `ACUARELA_NAMES`, `packages/contracts/src/events.ts` (`BoiaEvent.islandId`, `ALL_DAY_ISLAND_ID`), `packages/store/src/sample/content.ts` (events, achievements, texts), `apps/web/app/mar/engine/islands.ts` (procedural builders; `generic()` for unknown isla), `apps/web/app/mar/sheet.tsx` (`islandOfEvent`/`eventOfPlace`), `apps/web/lib/admin/world.ts` `eventIslands()`, landing tickets panel and `/eventos/[slug]`, `docs/propuestas/textos-zonas.md` + `es-zonas.ts` generator, `lib/i18n/es-mar.ts`.
- Scope: may touch packages/world, packages/contracts, packages/store sample content, /mar place rendering (placeholder only), tickets panel data, /eventos, i18n and the textos-zonas document, achievements texts, e2e and unit tests, docs/spec/estado.md / must not touch the island 3D models (T69–T71), economy values (T72), circuit gameplay (T73), the HUD layout (T68).
- Done when:
  - Test command → exit 0
  - `pnpm world:check` → exit 0
  - unit test asserts the Arcilla names above, the `halloween` place exists in both worlds, and exactly three on-sale sample events map to `halloween`, `allday`, `ultima` with the given dates → exit 0
  - e2e: /mar tickets panel lists exactly the 3 events; `/mar?ir=halloween` sails to the Isla de Halloween; delivering the Fiestera names the Isla de Nochevieja → exit 0
- Outcome: Arcilla names (Cala Cantalar, Isla de Benidorm, Ibiza, Tabarca, L'Illeta dels Banyets, Isla del Sonido, Isla de Nochevieja, Los Rápidos), new place halloween at [-1.0, 1.5] in both worlds, exactly 3 on-sale events (halloween-2026, sonido-2026, nochevieja-2026), Fiestera delivered to the Isla de Nochevieja → 6934762

## T68 — Welcome sheet, help instead of guidance, top links, minimap centring
- Status: done
- Depends on: none
- Goal: Decisions 2026-10-02. (1) The welcome sheet after "Zarpar" (Welcome Aboard) becomes short: bold "BIENVENIDO A BOIA.PLANET"; then, not bold, "Navega por el mundo en busca de las islas perdidas, descuentos y rescata a la BOIA perdida."; then "Objetivo: Encuentra la BOIA y llévala a la Isla de Nochevieja."; keep only the first two tips; two buttons: a big orange "A navegar" (closes it) and below it "Comprar entradas", which opens the in-world tickets panel (the "Elige tu evento" sheet with the events). (2) After closing it the player is free: no centred message, no chip leading to the castaway. Remove every automatic guidance chip ("Rumbo a un código escondido", mission/minigame/fiestera chips from info buoys and missions). (3) Add a small "?" help button just below the achievements/settings button on the left; tapping it shows the current objective and one hint (Fiestera, codes, minigames), each with an optional "Rumbo a…" that sets course. (4) The dolphin keeps appearing and guiding as today. (5) Top links order: Fotos, Shop, Artistas, Contacto, Carnet. (6) The small minimap is not centred (what it shows looks shifted right); centre it like the enlarged one.
- Context: `apps/web/app/mar/a-bordo.tsx` (case `bienvenida`), `apps/web/lib/mundo/menu/sections/welcome.tsx`, keys `mar.client.bienvenida`, `mar.bienvenida.*`, `welcome.tip.*`; `apps/web/app/mar/guia.tsx` (`MarGuideChip`), `mar-client.tsx` (~617 guide chip, ~180 `LANDING_LINKS`, ~1768 links render), `lib/mundo/guide.ts` (`buoyGuide`), `lib/mundo/encounters.ts` (`findDolphinGuide`, keep), `.mar-chips` in `mar.css`; minimap `apps/web/app/mar/minimap.tsx`, `engine/globe.ts`, `.mar-minimap` / `.mar-globe.is-map` CSS; T58's `app/mar/entradas.tsx`.
- Scope: may touch `apps/web/app/mar/**`, `apps/web/lib/mundo/**` (welcome, guide), i18n, e2e, docs/spec/estado.md / must not touch event/island data (T67), economy (T72), the circuit (T73), fonts (T74).
- Done when:
  - Test command → exit 0
  - e2e at 375×812 and desktop: after Zarpar the sheet shows the bold title, the text, the objective, 2 tips, "A navegar" and "Comprar entradas"; "Comprar entradas" opens the tickets panel; after closing, no guide chip appears after talking to an info buoy; the "?" button shows the objective and a hint and its "Rumbo a…" sets course; top links are in the order Fotos, Shop, Artistas, Contacto, Carnet; the small minimap's drawn centre matches its box centre (±2 px) → exit 0
- Outcome: short welcome (bold title, text, objective, 2 tips, orange "A navegar" + "Comprar entradas"), no auto-guidance chips or first-time hint, "?" help card with objective/hint/"Rumbo a…", links Fotos/Shop/Artistas/Contacto/Carnet, minimap centred (islands drawn without the sky spin) → 66a1e2c

## T69 — Island models from Blender, starting with the Isla de Halloween
- Status: done
- Depends on: T67
- Goal: /mar islands are procedural three.js today; Hernán wants the ticket islands modelled in Blender. Build the path: a Blender script that models and exports island GLBs (within a triangle budget suited to mobile, like the boats' MAX_TRIS), manifest + `tools/blender/check.py` validation, and /mar loading an island GLB for a place when it exists (lazy by distance like the buoys, falling back to the procedural builder). Then model the Isla de Halloween: buoys (the BOIA mascot style) dressed up as witches, ghosts and Frankensteins around the island, and in the centre the club: a big jack-o'-lantern pumpkin with an angry Halloween face (glowing at night). Same art style as the existing BOIA buoys and boats.
- Context: `tools/blender/export_barcos_glb.py` (GLB export, MAX_TRIS=12000, buoys from `mascota.py`), `tools/blender/rig.py`, `style.py`, `mascota.py`, `check.py`, `manifest.schema.json`; `art/barco/3d/` + `manifest.json`; `apps/web/app/mar/engine/models.ts` (`MODEL_FILES`, `ModelKey`, `modelFor()`, `MODEL_TUNING`), `mar3d.ts` (~1265 island build, ~2459 `modelSlot` fallback), `app/api/art/[...path]/route.ts`; T67's `halloween` place.
- Scope: may touch `tools/blender/**`, `art/**` (new island GLBs + manifests), `apps/web/app/mar/engine/**` (model loading), docs for the pipeline (README/TRASPASO section), tests / must not touch other islands' looks (T70, T71), place data beyond what loading needs.
- Done when:
  - `C:/Users/alvar/Blender/blender-5.2.2-windows-x64/blender.exe -b -P tools/blender/<island export script>.py -- --only halloween` → exit 0 and writes the GLB + manifest under art/
  - `python3 tools/blender/check.py` → exit 0 (includes the new island asset, triangle budget)
  - Test command → exit 0 (landing budget unchanged)
  - e2e: in /mar near the Isla de Halloween its GLB loads (data attribute on the place) and without the GLB the procedural fallback still renders → exit 0; a screenshot of the island committed under docs/informes/img/p006-t69-*.png
- Outcome: island GLB pipeline (tools/blender/export_islas_glb.py + islas/<id>.py modules, art/islas/3d/manifest.json, MAX_TRIS 30000, lazy load in /mar with procedural fallback) and the Isla de Halloween model → 88f3ab2

## T70 — Isla del Sonido model
- Status: running (attempt 1)
- Depends on: T69
- Goal: Model the Isla del Sonido (place `allday`) in Blender with T69's pipeline: a rave-style sound system with many stacked speakers (walls of speakers), lights, and BOIA buoys dancing. Same art style; within the triangle budget; loaded by /mar like T69's island.
- Context: T69's pipeline and loader; `apps/web/app/mar/engine/islands.ts` (current `allday` builder, the fallback).
- Scope: may touch `tools/blender/**` (this island), `art/**` (its GLB), tests / must not touch other islands or the loader beyond registering this island.
- Done when:
  - Blender export for `allday` → exit 0; `python3 tools/blender/check.py` → exit 0
  - Test command → exit 0
  - e2e: the Isla del Sonido GLB loads in /mar → exit 0; screenshot docs/informes/img/p006-t70-*.png
- Outcome:

## T71 — Isla de Nochevieja model
- Status: running (attempt 1)
- Depends on: T69
- Goal: Model the Isla de Nochevieja (place `ultima`, where the Boia Fiestera is delivered) in Blender with T69's pipeline: a snowy mountain with party lights (beams) pointing in every direction, full of camping tents with BOIA buoys dancing, and New Year's Eve elements (clock, grapes, confetti, fireworks, champagne). Same art style; within budget; loaded by /mar; the Fiestera delivery celebration still works there.
- Context: T69's pipeline and loader; current `ultima` builder in `islands.ts`; mission delivery in packages/engine/src/mission and /mar.
- Scope: may touch `tools/blender/**` (this island), `art/**` (its GLB), tests / must not touch other islands or mission rules.
- Done when:
  - Blender export for `ultima` → exit 0; `python3 tools/blender/check.py` → exit 0
  - Test command → exit 0
  - e2e: the Isla de Nochevieja GLB loads in /mar and `e2e/mar-fiestera.spec.ts` still passes → exit 0; screenshot docs/informes/img/p006-t71-*.png
- Outcome:

## T72 — Economy rebalance and bottle cap
- Status: done
- Depends on: T67
- Goal: Decisions 2026-10-02. Make progress faster: with about 10 minutes of normal play a player can unlock at least 3 ships and some skin. Lower ship and skin prices and give more coins and experience (points). Fixed values: each floating log/debris piece picked up gives 10 coins; the treasure (Cofre fugaz) gives 40 coins and 20 points; creating the Carnet BOIA gives 300 points and unlocks one ship (choose one that is not already free or a mission prize, and say which); the minigames (lighthouse, cannon) last only 3 rounds/waves with faster enemies, and finishing one gives 50 coins and 150 points (they will be redesigned later). Bottles: at most 10 active bottles in the sea from people with a Carnet; a new bottle removes the oldest; one active bottle per person (throwing another replaces yours); sample bottles count towards the 10.
- Context: `packages/store/src/sample/progress.ts` (`SKIN_PRICE`, ship prices, cosmetics), `packages/world/src/worlds/arcilla/map.ts` (restos coins, cofre coins, island points, secrets, dolphin), `packages/store/src/sample/content.ts` (`SAMPLE_ACHIEVEMENTS`, carnet achievement), `packages/engine/src/minigames/{faro,canon}.ts` (`FARO_DEFAULTS`, `CANON_DEFAULTS`, waves, speeds, rewards), `packages/engine/src/minigames/rewards.ts`, bottles in `packages/store/src/local.ts` (~1583 one-per-person, `allBottles` ~445), `sample/crew.ts` `SAMPLE_BOTTLES`, `apps/web/lib/repo.ts` `placeSampleBottles`, `apps/web/app/mar/bottles.ts`.
- Scope: may touch economy values and rules, minigame tuning, Carnet reward, bottle storage/rules, tests, docs/propuestas/logros-catalogo.md, docs/spec/estado.md / must not touch UI layout, island data/names (T67), the circuit (T73).
- Done when:
  - Test command → exit 0
  - a unit "10-minute session" simulation (scripted typical route: logs, cofre, islands, one minigame, Carnet) shows enough coins/points to unlock ≥ 3 ships and ≥ 1 skin → exit 0
  - unit tests: log 10 coins, cofre 40 coins + 20 points, Carnet 300 points + the chosen ship, minigames 3 waves and 50 coins + 150 points, bottle cap 10 with oldest removed and one per person → exit 0
  - e2e: create Carnet in /mar → the ship is owned; `e2e/minijuegos.spec.ts` and `e2e/mar-botellas.spec.ts` pass (updated) → exit 0
- Outcome: 10-min simulation earns 715 points/245 coins (Carnet ship + points ship + a bought ship + a skin); log 10c, cofre 40c+20p, Carnet 300p + Low-poly ship, minigames 3 waves 50c+150p, bottle cap 10 (one per person) → fa907f3

## T73 — Los Rápidos: circuit v3
- Status: pending
- Depends on: T67
- Goal: Decisions 2026-10-02. The circuit (now named Los Rápidos) keeps checkpoints and 3 laps, and: (1) arriving at the start no longer starts the race automatically; a popup explains the race (3 laps through the checkpoints, you compete against the other users' times and against yourself, the ghost replays your best run) and asks whether to start; (2) ranking against others: on this browser-only version use the sample members' times plus your own best (a shared ranking is the final version); (3) the ghost boat replaying your best time is visible during the race; (4) checkpoints spread better across the map (a longer, more varied route); (5) more obstacles along the way; (6) jump platforms with up arrows: driving over one makes the boat jump and splash when it lands in the sea; (7) speed boosts and jump platforms always sit between two checkpoints and point towards the next checkpoint. Works in both worlds and on mobile.
- Context: `packages/world/src/worlds/arcilla/map.ts` (`CIRCUIT_ID`, `CIRCUIT_VERSION`, `CIRCUIT_LAPS`, `CIRCUIT_MEDALS`, `RACE_BUOYS`, `BOOST_PADS`), `packages/engine/src/circuit/{race,ghost}.ts` (auto-start at race.ts:~244, `CIRCUIT_COUNTDOWN_S`), `apps/web/app/mar/race.ts` (ghost storage key), `mar-client.tsx` (`holdShip`), `lib/mundo/ranking-circuit.ts` (`SAMPLE_CIRCUIT_MS`), the minimap markers; bump `CIRCUIT_VERSION` if old records become incomparable.
- Scope: may touch circuit data and engine, /mar race code, rendering of checkpoints/obstacles/ramps/splash, ranking circuit tab, i18n, tests / must not touch steering constants beyond what the jump needs, economy (T72), island names (T67).
- Done when:
  - Test command → exit 0
  - unit tests: no auto-start; every boost and ramp lies between two consecutive checkpoints and its direction points to the next one (within a tolerance); a ramp triggers a jump and a landing splash event; 3 laps finish; ghost replays the best run → exit 0
  - e2e in /mar: arriving at the start shows the popup; "Empezar" starts the countdown; a scripted run completes 3 laps; the result compares against the sample members and the own best; a second run shows the ghost → exit 0
- Outcome:

## T74 — Site font: Druk-Wide-like titles and Inter
- Status: done
- Depends on: none
- Goal: Decision 2026-10-02: the whole site uses the fonts of https://www.draaimolen.nu/story — Druk Wide Medium for titles and Inter for text. Druk is commercial (Commercial Type) and cannot be copied, so use a free (OFL) wide, heavy display face that looks as close as possible to Druk Wide Medium for titles (candidates: Archivo at its widest expanded width, Unbounded; compare and pick), self-hosted, plus Inter (OFL, self-hosted) for body text, everywhere: landing, /mar HUD and sheets, /carnet, /eventos, /fotos, /artistas, legal, admin. One single place defines the title font so Druk can replace it later when Álvaro buys the license (document how in the README). Keep the landing within its 192 kB budget (subset to Latin, woff2, preload only what the first view needs).
- Context: `apps/web/public/fonts/` (Titan One + OFL), `app/(landing)/layout.tsx` (`next/font/local`, `--font-display`), `app/admin/admin.css` `@font-face`, `app/globals.css` (`--font-title`, `--font-title-fallback`, system body stack), `app/mar/mar.css:38`, `scripts/landing-budget.mjs`, DECISIONES P20 (typeface file pending Álvaro).
- Scope: may touch font files and licenses, global CSS/variables, layouts, CSS that hard-codes fonts, the README, docs/DECISIONES.md (note on P20), e2e visual checks / must not touch layout or copy beyond what the new metrics require.
- Done when:
  - Test command → exit 0 (landing within budget)
  - e2e: computed font-family of the landing h1, a /mar sheet title and body text use the new title font and Inter respectively, and both fonts load (document.fonts) → exit 0; screenshots docs/informes/img/p006-t74-*.png
- Outcome: titles in Archivo Expanded (wdth 125, 700, 11.5 kB Latin woff2), body in variable Inter, one definition in apps/web/lib/fonts.ts, Titan One removed; landing 189.8/192 kB → a8c7881

## Decisions
- 2026-10-02 Hernán and Álvaro: three ticket islands (Isla de Halloween, Isla del Sonido, Isla de Nochevieja) in both worlds, modelled in Blender; events BOIA Halloween at Kiki García 31/10/2026, SONIDO 05/12/2026, BOIA Nochevieja 31/12/2026; the name is "Isla de Nochevieja" everywhere
- 2026-10-02 Hernán and Álvaro: Arcilla names Cala Cantalar, Isla de Benidorm, Ibiza, Tabarca, L'Illeta dels Banyets, Isla del Sonido, Isla de Nochevieja; El Freu → Los Rápidos
- 2026-10-02 Hernán and Álvaro: no automatic guidance; a "?" help under the achievements; the dolphin stays
- 2026-10-02 Hernán and Álvaro: free Druk-Wide-like title font + Inter now; Druk when Álvaro buys the license
- 2026-10-02 Hernán and Álvaro: bottles: max 10 in the sea, newest removes oldest, one per person
- 2026-10-02 orchestrator: Blender 5.2.2 LTS installed as a portable copy in C:/Users/alvar/Blender (the winget installer failed while uninstalling Blender 4.0, which stays installed)

- 2026-10-02 T68: the help hint is the nearest pending code or minigame (the objective already points to the Fiestera); help texts are muestra keys mar.ayuda.*; buoyGuide replaced by helpNow (agent)

- 2026-10-02 T74: Archivo at widest width chosen over Unbounded/Anybody as the closest free match to Druk Wide; Inter not preloaded (budget); landing-budget.mjs counts preloaded fonts from the CSS (Next on Windows never adds the preload link); README explains switching to Druk (agent)

- 2026-10-02 T67: most island names became the shared map names (both worlds share Cala Cantalar; Acuarela keeps its own for the rest except the 3 ticket islands); circuit id el-freu unchanged; Halloween is the featured event; castaway code goes with SONIDO, amphora code with Nochevieja; map pins 🔊/🎆/🎃 (agent)

- 2026-10-02 T72: Carnet ship is Low-poly (no longer sold); Cartoon 30s 120 coins, Semi-realista at 600 points, skins 50 coins; islas-7 now asks for all 8 islands (id kept); minigames v3 win scores 250/200, 300 s cap; fixed logs/cofres giving nothing in /mar (reward key with @ rejected by the store); "Echar otra" button on the bottle sheet (agent)
- 2026-10-02 T69: island budget 30000 tris joined into one mesh per material; each island is a module tools/blender/islas/<id>.py and /mar reads art/islas/3d/manifest.json, so a new island needs no web code; load from 2200 u, unload past 3200 u; state in data-islas-modelo on the canvas (agent)

## Proposals (new scope)
- 2026-10-02 T72: ranks still top out at 600 points (reached in ~10 min); the Fiestera mission still gives 100 points/100 coins; bottle rules only in the browser store, not in Supabase
- 2026-10-02 T69: procedural glow points still show under the GLB (slightly off); costume buoys in the GLB do not bob; no Draco compression (no decoder in /mar)
- 2026-10-02 T67: DECISIONES.md D-23 still says Halloween has no island; achievement islas-7 vs 8 islands (T72); Blender scripts and mundos/acuarela/lugares.json use old names (T69+)
- 2026-10-02 T74: canvas text (island/globe labels in islands.ts and globe.ts, minigame canvases) still uses system-ui; the landing has only 2.2 kB of budget left
- 2026-10-02 T68: info buoys params.guide in packages/world no longer used by /mar; the 2D OnboardMenu / MENU_SECTIONS look like dead code

## Log
- 2026-10-02 19:30 T67 launched · attempt 1 · agent a10edbb2b1a7341bc
- 2026-10-02 19:30 T68 launched · attempt 1 · agent a928e10c981e1ae13
- 2026-10-02 19:51 T68 done · branch worktree-agent-a928e10c981e1ae13 → 66a1e2c
- 2026-10-02 19:53 T74 launched · attempt 1 · agent aaad2a5c73cf97f3c
- 2026-10-02 20:47 T74 done · branch worktree-agent-aaad2a5c73cf97f3c → a8c7881
- 2026-10-02 21:50 T67 conflict with main (es-juego.ts, estado.md) · sent back to agent a10edbb2b1a7341bc
- 2026-10-02 21:25 T67 done · branch worktree-agent-a10edbb2b1a7341bc → 6934762
- 2026-10-02 21:27 T69 launched · attempt 1 · agent ab329487181906b16
- 2026-10-02 21:27 T72 launched · attempt 1 · agent a783b7fd1593c36a5
- 2026-10-02 21:56 T72 done · branch worktree-agent-a783b7fd1593c36a5 → fa907f3
- 2026-10-02 21:57 T69 done · branch worktree-agent-ab329487181906b16 → 88f3ab2
