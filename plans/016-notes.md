# Plan 016 — Notes from Hernán (input for the interview, not a plan yet)

Collected 2026-10-06 while plan 015 was running. `/orchestrator` turns these into tasks.

## World
- The **Boia Fiestera** must appear on the **right**, just before reaching the **Puerto de Alicante**, with the **yellow line** on the right.

## Castle game — camera
- When zoomed in, the camera must **follow the plane/boat** (today it drifts / gets misaligned).
- When zoomed out, it stays fixed on the **centre of the map**, moving a little with the boat as it does now.

## Castle game — path
- The **U-turns are too narrow**: placing an island inside is hard. Make them **a little wider** so an island fits well (only a bit).

## Castle game — balance
(Island damage toward the middle, Ibiza payback 50/40/30 s and the visible Ibiza «+N» went into plan 015 T178; check its Outcome first. What stays here: any balance left.)
- **Faro** takes very little life; the same with many others.
- Find a **rule so every island's DPS is roughly similar**; today the gap is large and **Halloween is by far the best**.
- **Ibiza**: you cannot see that it gives money nor how much. It must be **visual**: every payout shows on screen.
  - Payback rule: level 1 pays back its cost in **45 s**; the upgrade to level 2 pays back its cost in **30 s**; the last upgrade (level 3) in **20 s**.

## Hernán's answers on plan 015's proposals (2026-10-06)
- **Faro** stays where it is (no wider start framing).
- **Turbo in the castle arena**: hide the turbo button (and its speed readout if it only makes sense with turbo) while flying the plane in the arena.
- **Fix the bug**: after opening and closing «Mi Barco» from the menu, keyboard arrows stop steering the boat (plain `/mar`, pre-existing).
- **Guide**: point the «mover» and «ficha» bubbles at the plane and at the island on screen (needs a `mar3d.ts` screen-position hook).
- **Castle upgrade sound**: add a small sound when the castle is upgraded.
- **Vecino size** in the castle: fine as it is, no change.
- **Texts**: fix them as appropriate (`docs/propuestas/logros-catalogo.md` still says «Por Los Rápidos»; the «Rápido» progress line says «vuelta» like «Rayo» — pick the right wording).
- **Supabase**: applied on 2026-10-06 by the orchestrator at Hernán's request (`pnpm db:migrate:dev` on the current personal project: 6 migrations from plans 013–015 + economy seed, OK). Originally: Hernán applies the pending migrations himself (castle ranking `20261006100300`, prizes `20261006100400`); he may move to another Supabase account later (personal now, official with the domain). Plan 016 could include running `pnpm test:supabase` once they are applied, since these migrations were never run against Postgres.
