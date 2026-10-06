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
