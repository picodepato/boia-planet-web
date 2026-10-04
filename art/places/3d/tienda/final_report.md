# T111 delivered asset and validation record

Delivered `tools/blender/places/tienda.py` and
`art/places/3d/tienda/{tienda.blend,tienda.glb,manifest.json,reference_notes.md,requirement_ledger.md,final_report.md}`.
Shared tooling changes: optional `approach.channel` in `place3d.schema.json`,
its check in `check.py`, six tienda tests in `test_check.py`, a README section.
Cala and fotos assets are unchanged and still pass.

Final export: **10949 triangles, 402140 bytes**; ceilings 12000 / 600000. Editable
scene: 348 semantic mesh objects, 90 refinement modifiers (inspector count:
bevel, weighted normal, solidify);
evaluated 10949 loop triangles, 0 collapsed. Bounds Blender min
`[-0.879087,-0.927000,-0.065948]`, max `[0.937656,0.908577,0.587481]`, radial
0.963882. One batched mesh `static_tienda` under `place_tienda`, 17 materials,
no motion. Placement and runtime handoff: `requirement_ledger.md`.

Reproduction: two clean generations give the same world geometry/winding/
normal/material signature and the same manifest; byte-identical GLB
serialization is not required or claimed (`node_modules/t111-preview/final/reproducibility.json`).
Committed GLB SHA256: `1febb1e3ae47e8b8e1006172bd23e18719d9212c8b93e9adb08b8c07201db0e3`
(a last clean rerun of the committed source; same signature as the evidence
GLB `0cb616c0...`; check, fresh import and tests rerun on it).

Official Blender executable used read-only:
`C:/Users/alvar/.codex/worktrees/0b17/boia-planet-hernan/node_modules/.tools/blender-5.2.2-windows-x64/blender.exe`
(5.2.2 LTS). `$B` below is that path; every Blender run used
`--background --factory-startup --python-exit-code 1`.

| Final validation command | Exit | Result |
| --- | ---: | --- |
| `node --experimental-transform-types --import ./packages/world/scripts/ts-resolve.mjs tools/blender/places/distance_camera.mjs node_modules/t111-preview/distance-camera.json tienda` | 0 | tienda radius 5.59625, camera distance 32.270305 |
| `& $B ... --python tools/blender/places/tienda.py -- --graybox --preview node_modules/t111-preview/graybox-final` | 0 | graybox views |
| `& $B ... --python tools/blender/places/tienda.py` then `-- --preview node_modules/t111-preview/final` | 0, 0 | two clean generations; blend, GLB, manifest, authored evidence |
| `python tools/blender/places/check.py art/places/3d/tienda` | 0 | budgets, bounds, radius, height, batching, materials, approach channel |
| `python tools/blender/places/check.py art/places/3d/cala` / `.../fotos` | 0 / 0 | regression of the shared checker |
| `python tools/blender/places/test_check.py` | 0 | 29 tests (6 new for tienda) |
| `& $B ... --python tools/blender/places/fresh_import.py -- --manifest art/places/3d/tienda/manifest.json --output node_modules/t111-preview/final/fresh-import.json` | 0 | PASS 10949 triangles, 17 materials, names, bounds and PBR values match |
| `& $B ... --python tools/blender/places/tienda.py -- --fresh-evidence --preview node_modules/t111-preview/fresh` | 0 | fresh-GLB evidence renders |
| `& $B --background --factory-startup --python <blender-asset-validation>/scripts/inspect_asset.py -- --input art/places/3d/tienda/tienda.blend` and the same for `tienda.glb` | 0 / 0 | hard gates pass, no issues; 0 degenerate faces or zero-length edges |
| `& $B --background --factory-startup --python <blender-asset-validation>/scripts/render_evidence.py -- --input art/places/3d/tienda/tienda.glb --output-dir node_modules/t111-preview/final/multiview --resolution 512` | 0 | six standardized views and contact sheet |

Reviewed (opened): the graybox hero and distance views; final and fresh hero
day/night, distance day/night, distance-near day/night, six views, oblique night
and four close-ups through the six `review-*.jpg` sheets, plus the full-size
hero, top, back, distance crop and close-ups during iteration; the standardized
contact sheet (studio light, no water plane, so the underwater skirt shows).

Iteration record: v1 terrain used per-face slope materials and produced sawtooth
cliff bands; the terrain was rebuilt as rays from the cove centre with rings at
fixed offsets from the cove edge and on the coast contours, so bands follow mesh
edges. The village slope became green with a whitewashed stepped lane, the back
farms moved onto the plateau, the boathouses moved to the back-right of the cove
where the game camera sees them, upper windows were clamped below roofs, and the
coast was widened from ~0.88 to ~0.92 R so the island fills its collision circle
like the cala and fotos assets.

Decisions/remaining work: no runtime hookup, collision, route, merchandise,
content or persistence change. T112 owns the replacement of the procedural
`tienda()` decoration, live framing/lighting, night glow and label height.
No commit to, checkout of or write in the Codex checkout was performed.
