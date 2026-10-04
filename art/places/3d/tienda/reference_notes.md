# T111 Ibiza (`tienda`) reference and design notes

Contract: remodel Ibiza as a white Mediterranean village above a readable,
sheltered cove, keeping its store role and the BOIA clay style, inside the
current footprint (normalized radius 1). Static asset; T112 owns runtime.

## Primary references actually opened (2026-10-04)

Official Balearic Islands tourism portal (illesbalears.travel). Images were
fetched for viewing only into the session's tool cache outside the repository;
none is copied, traced or redistributed.

| Source | Image | View | What it informs |
| --- | --- | --- | --- |
| https://www.illesbalears.travel/en/ibiza/cove-salada | `rrtt-ibiza-cala-salada-img0.jpg` | low drone, oblique, beach edge | curved pale sand beach, clear shallow water turning turquoise, low dry-stone wall and pines behind the sand, wooden boathouse doors under ochre cliffs at the right end, a small concrete slipway |
| same page | `rrtt-ibiza-cala-salada-img1.jpg` | drone facing the beach from the sea | horseshoe cove: sand at the back, pine-covered hill behind, flat rock shelves and boathouses along the right cliff, deep blue water at the mouth |
| same page | `rrtt-ibiza-cala-salada-img2.jpg` | higher drone, three quarters | the cove is narrow at the mouth and wide inside; a row of small boathouses with doors and slipways sits at the foot of red-ochre cliffs; dense dark pines on the slopes |
| https://illesbalears.travel/en/ibiza/church-santa-eularia-puig-de-missa | `rrtt-ibiza-iglesia-santa-eularia-puig-de-missa-img1.jpg` | telephoto from below the hill | fortified white church on the hilltop: bell gable (espadanya) with an arched bell opening and cross, small white turrets, a terracotta dome with a white lantern, plain cubic white houses with flat roofs, small dark windows and blue shutters, cypresses, pines |
| same page | `rrtt-ibiza-iglesia-santa-eularia-puig-de-missa-img2.jpg` | side view of the hill | the white village stepping up the hill to the church; a round stone bastion attached to the church; houses with terracotta tile roofs mixed with flat roofs; green shutters; dry-stone terraces |
| https://www.illesbalears.travel/en/ibiza/discovering-the-white-island | `plan-ibiza-descubriendo-la-isla-blanca-img1.jpg` | street level, Dalt Vila | whitewashed walls, blue doors, green shutters, a stepped whitewashed lane with white parapets, clothes hanging, oleanders |

The page text confirms: Cala Salada is surrounded by pine forest, with transparent
water and boathouses under the cliffs; Puig de Missa is a white, undecorated,
fortified 16th-century church with an arched porch on a 52 m hill; Ibiza's rural
architecture is whitewashed (lime) cubic modules.

Store identity reference (original BOIA art, local): `art/mundos/arcilla/tienda/tienda.png`
and its render `mundos/arcilla/render/tienda-dia.webp`: kiosk with an orange and
white striped awning, counter with folded T-shirts, a T-shirt clothesline, a
palm and a TIENDA sign. The 3D kiosk keeps those cues.

## Observations retained (simplified geographic composition, not a survey)

- Cove: horseshoe opening to the front approach; sand only at its back; ochre
  cliffs on its sides; narrow mouth (half width 0.14 at y=-0.60, widening to
  ~0.2 at the rim) against a 0.66-wide interior, so it reads as sheltered.
- Boathouses: three small huts with dark wooden doors (one whitewashed with a
  blue door), flat timber roofs, stone shelves and wooden slipway rails, at the
  foot of the right cliff where the beach ends (Cala Salada analogue).
- Village: ten whitewashed cubic houses on the slope behind the beach, facing
  the cove, mixing flat roof terraces (cream slab inside a white parapet) and
  terracotta hip roofs; blue or green doors, open windows with coloured frames
  and closed shutters; square white Ibiza chimneys; some cubic annexes.
- Church (Puig de Missa analogue): white nave, bell gable with arched opening,
  gold bell and cross, three-arch porch, terracotta dome with white lantern,
  round stone bastion and a small turret. A Dalt Vila-like stepped lane with
  white parapets climbs from the beach to its porch.
- Two casas payesas on the back of the hill with a sabina-beam porch (porxo).
- Aleppo pines (dark, flattened crowns on leaning trunks), two cypresses near the
  church, one palm behind the kiosk, two white beach parasols, a curved dry-stone
  wall behind the sand, two llauts (white hull, blue band, wooden deck, lateen
  yard), a jetty, three lamps.
- A round stone defence tower on the left headland (regional analogue of the
  Ibiza coastal towers; not taken from an inspected photograph).
- Two orange BOIA buoys flank the cove mouth and mark the approach.

## Assumptions and gaps

- Perspective photos are not measurements; all proportions are stylized for the
  game camera (houses ~0.12-0.14 wide, 0.09-0.11 tall above their highest ground).
- The defence tower, llauts and casas payesas come from general regional
  knowledge; no photograph of them was inspected in this task.
- Colours are the game palette (`apps/web/app/mar/engine/palette.ts`) converted to
  linear values; BOIA lilac rocks are kept for world consistency with other islands.
