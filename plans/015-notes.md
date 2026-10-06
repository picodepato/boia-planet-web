# Plan 015 — Notes from Hernán (input for the interview, not a plan yet)

Collected 2026-10-06 after plan 014 shipped. `/orchestrator` turns these into tasks.

## World and the «Tablón del faro»
- Move the Tabarca lighthouse island closer to the start of the game, further to the right.
- On approach the board pop-up appears **closed** (collapsed). Text along the lines of «Desde el faro puedes ver dónde jugar».
- Three buttons, one per island (Cañón, Castillo, Carrera). Tapping one asks like the minimap does when you tap an island: the island's name with the two options **Navegar** / **Ir en nave**. It does **not** mark the destination on the map (drop the «Rumbo a…» mark).
- The board's icons must match the rest of the game's icons.

## Castle game — camera and building
- Zoom selectable during the game, like in the other games; the game starts at the current top-down view automatically, but the player can change the zoom.
- «Construir» list: each island shows its **real in-game image**, not an icon — a render from the front, as seen from the normal game, recognisable.
- Tapping an island in the list shows a more detailed explanation of its damage.
- On «Construir» the camera goes automatically to the top-down view of the game start and stays there; zoom is always available to get closer.
- Islands can be built **anywhere on the map** (no ring around the plane), respecting the arena edges and never on top of another island (and never on the path).
- While placing, the island's **attack range** is drawn around it so the player can choose the spot well.

## Castle game — path design
- The curved zones in the north more pronounced, so one island there attacks well on both sides; same for the one on the right. They can sit closer to the castle.
- The zigzag with longer straights, so an island fits in each angle.

## Castle game — plane
- The plane can upgrade **attack speed** and **damage**.
- Like in the normal world, the plane moves just by tapping the sea: it goes where you tap.

## Cañón and Castle — enemy look
- The «Vecino quejica» design is poor: redo it with Fable, and change it both in the castle game and in the Cañón minigame.

## Carried over from plan 014 Proposals
- Clouds drift over the arena; turbo and the speed readout stay visible during the castle game.
- Halloween strong in short Tormenta runs.
- World prize / achievements for the castle (open with Álvaro).
- `.gitattributes` with `eol=lf` (CRLF caused several merge conflicts).
- Castle ranking migration `20261006100300_castle_ranking.sql` not applied nor run against Postgres (Hernán).
- Full e2e flakes under load (timing/piloting tests).

## Hernán's answers (2026-10-06) — these override the notes above where they differ
1. **Tabarca position:** with the camera starting on the boat, the lighthouse island must be visible on the **left**, a bit further ahead, almost next to the náufrago (replaces "further to the right").
2. **Board pop-up:** like the other islands: appears closed with the three buttons; expanding it shows an explanation of each minigame.
3. **No pause while building** (for now): the game keeps running.
4. **Taps:** in build mode, tapping the sea places the island preview; outside build mode, tapping the sea moves the plane and tapping an island selects it. After choosing the spot, an **«Instalar isla»** button appears at the bottom to confirm.
5. **Path:** even **longer**, with **pronounced U-turns** (sharper than today's curves) so islands can be placed inside each U; north curves and the right one tighter to the castle; zigzag straights longer so an island fits in each angle.
6. **Plane upgrades:** only attack speed and damage, each up to **level 5**.
7. **Vecino quejica:** the whole 3D model redone from zero in **Blender with Fable**; no approval stop (Hernán trusts it). Used in both the Cañón and the castle game.
8. **Island images in «Construir»:** fixed renders with a transparent background (same front framing for all).
9. Add **×2 speed** and **«Llamar oleada»** (call the next wave early) buttons.
10. Add a **next-wave warning** (what comes, whether there is a boss).
11. **Pause menu options:** toggle enemy health bars and damage numbers.
12. **Target priority per island** (first / strongest / closest…), configurable when tapping it; each island kind has its own default.
13. **Guided first game** (short steps).
14. **Castle upgrade:** only raises max life; expensive, a lot of life per level.
15. **Achievements and prize:** one achievement per difficulty (any run length); a world **prize** for winning on the hardest difficulty (any run length; amount to define); a **special achievement** for the hardest difficulty at the longest run length.
16. **Technical:** fix the test setup so the full e2e and vitest no longer fail by timeouts (split or tune slow suites), plus `.gitattributes` `eol=lf`.

## Prizes and mascots (Hernán, 2026-10-06) — replaces answer 15 above
Every game's top challenge gives a mascot, like the Cañón's minikraken («Rompetentáculos»). Names and designs `muestra` until Álvaro approves; new mascots modelled from zero in Blender with Fable, no approval stop.
- **Castle:**
  - One achievement per difficulty won (Tranquila, Normal, Tormenta; any run length), with its usual points.
  - Winning on **Tormenta** (any length): achievement that gives **points and coins** and unlocks the **mascot «Cañoncito»** (a small cannon on deck).
  - Special achievement for **Tormenta + 10 min**: unlocks the **«Estela del vórtice»** wake (lilac and black spiral), shown everywhere in the world.
- **Race:**
  - First time finishing: achievement «Primera regata» with some points and coins.
  - Beating a **decent time**: achievement «Rápido» that unlocks the **mascot «Tortuga turbo»**, which **swims behind the player's boat** (not on deck). The time threshold is **measured with the race bot** (where a normal player gets it after about 3–5 tries).
- Achievements that unlock a mascot also give coins.
