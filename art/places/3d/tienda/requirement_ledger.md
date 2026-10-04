# T111 requirement ledger and T112 handoff

2026-10-04. Static art deliverable for the `tienda` place (Ibiza). Creator review;
no independent aesthetic score. Runtime integration, shop behaviour, map,
collision, route and persistence are untouched and belong to T112.

Contract: BOIA clay Ibiza, white Mediterranean village above a sheltered cove that
opens toward the front approach, store role kept (kiosk with the BOIA orange and
white striped awning, counter, T-shirt line, TIENDA sign), inside normalized
radius 1, at most 12000 triangles and 600000 bytes (ceilings, not targets). No
textures, lights, cameras or sea plane in the GLB; palette colours only. Polished
clay finish (bevelled and weighted-normal walls, smooth terrain, rounded crowns),
not a requested low-poly blockout.

| Requirement / stage | Judgment | Evidence / concrete observation |
| --- | --- | --- |
| 1. References and contract | Pass | `reference_notes.md`: six official tourism photographs actually opened (Cala Salada x3, Puig de Missa x2, Dalt Vila street) plus the original arcilla store art; observations and assumptions recorded |
| 2. Graybox and proportion | Pass | `graybox-final/graybox*.png`: horseshoe island, wide cove behind a narrow mouth, beach at its back, village massing on the hill, church on the crest; the mouth reads from the game camera (`graybox-distance.png`) |
| 3. Primary and secondary forms | Pass | `final/hero-day.png`, `close-*.png`: houses with doors, lintels, framed windows and shutters, flat roof terraces or hip tile roofs, chimneys, annexes; church gable, bell, porch arches, dome, bastion, turret; kiosk awning, counter, tees, sign; boathouses, slipways, jetty, llauts, tower, buoys |
| 4. Structure / topology | Pass | authored and exported metrics: 0 degenerate faces, 0 zero-length edges, 0 invalid vertices, 0 missing materials; 0 collapsed tessellation triangles at export. Window frames clamped under roofs (a roof penetration seen in an intermediate render was fixed); the fresh GLB rendered with back-face culling (three.js FrontSide) shows no missing or inverted faces (`review-cull.jpg`) |
| 5. Materials | Pass | 17 named palette materials (game palette, sRGB to linear); fresh import matches names, base colour, roughness, metallic and effective emission; only `lantern` emits (lamps, kiosk lanterns) |
| 6. Finish / whole-asset coverage | Pass | `view-{front,back,left,right,top,oblique}.png`: back slope has two casas payesas with porches, back windows on the houses, pines, the church dome and bastion; outer coast is a clean ochre cliff with a lilac rock strip at the waterline (material bands follow mesh rings, no zigzag) |
| 7. Reproduction / fresh import | Pass | two clean generations share the geometry/winding/normal/material signature and an identical manifest (`final/reproducibility.json`); `fresh_import.py` PASS 10949 triangles, 17 materials; fresh-GLB renders in `fresh/` match the authored ones |
| White houses, roofs, doors at game distance | Pass | `final/distance-day.png` and `distance-near-day.png` (crop reviewed at 2x): white cubes, terracotta and cream roofs, blue/green doors and windows, the stepped lane and the church read; night versions keep the silhouettes and lamp points |
| Shore and cove readable | Pass | sand beach at the back of the cove, ochre cove cliffs, narrow mouth flanked by two orange buoys and the tower; top view shows the keyhole cove |
| Store role | Pass | kiosk centred at the back of the beach, facing the approach: striped awning, counter with folded tees, two lanterns, roof flag, T-shirt line, TIENDA sign, palm (`close-shop.png`) |
| Approach within current footprint | Pass for art | all geometry within radial 0.963882; the mouth faces glTF +Z; `approach.channel` makes `check.py` prove that inside +/-10 degrees from radius 0.62 outwards nothing rises above the water |
| Budgets | Pass | 10949 triangles, 402140 bytes (ceilings 12000 / 600000) |
| Runtime replacement / collision / shop panel | Not applicable | T112 |

## Placement facts for T112

- Manifest: `art/places/3d/tienda/manifest.json`; GLB root `place_tienda`, one
  batched mesh node `static_tienda`, 17 primitives (one per material), no clips.
- Bounds (source Blender, Z up, front -Y): min `[-0.879087,-0.927000,-0.065948]`,
  max `[0.937656,0.908577,0.587481]`, radial 0.963882, height 0.587481.
- Current tienda collision radius from the live map: 5.59625 scene units
  (`distance_camera.mjs tienda`), so scale = 5.59625 and the height is about
  3.29 scene units; the visible waterline sits at about 0.92 x coast factor
  (0.86-0.92 R), the underwater skirt reaches ~0.96 R.
- Water: terrain below Y=0 is a skirt meant to be cut by the opaque game sea;
  faces entirely below -0.03 are omitted. The cove basin is decorative water:
  the existing collision is a circle of R plus the `ellipseCollision` capsule
  lobes of the map ellipse (a=1.9, b=1.5, 45 degrees), so the boat cannot enter
  the cove and the lobes still reach beyond the visible coast front-right and
  back-left, as with the old procedural island. No collision change proposed.
- Replace all of the old procedural `tienda()` decoration (terrain, shore rocks,
  pier, torches, glows, kiosk) so nothing duplicates the cove or the shop.
- Night: the `lantern` material is the only emissive one (3 lamps, 2 kiosk
  lanterns); `islandGlow` can drive it like other island models.
- The old label height (`labelY`, about 4.9 scene units) is above the new top.

## Evidence (ignored, outside published art): `node_modules/t111-preview/`

- `distance-camera.json`: tienda radius 5.59625, vertical FOV 40, zoom 0.2,
  camera distance 32.270305, elevation 0.70656 rad, stationary boat at 1.7 R on
  the front approach; `*-near-*` renders use the same law at 1.05 R.
- `graybox-final/`: graybox hero, distance, near, six views.
- `final/`: hero day/night, distance day/night, distance-near day/night, six
  views, oblique night, close-ups (shop, boathouses, church, tower and mouth);
  `fresh-import.json`, `authored-metrics.json`, `export-metrics.json`,
  `reproducibility.json`, `test_check.log`; `multiview/` six standardized views,
  contact sheet and `evidence.json` from the GLB.
- `fresh/`: the same renders from a fresh GLB import.
- `review-{hero-distance,views,close}-{final,fresh}.jpg`: contact sheets reviewed.
- `final/cull/` and `review-cull.jpg`: fresh GLB with back-face culling, magenta background.

Limitations: flat Blender previews omit planet curvature, fog, UI inset, motion
lead and the runtime Lambert lighting; live captures belong to T112.
