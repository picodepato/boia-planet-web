# Independent BOIA 3D places

These assets do **not** participate in `art/islas/3d/manifest.json` yet. T108/T112
own runtime hookup; no existing place ID, route, collision, content or progress
changes here. This contract is distinct from the legacy 2D `place.schema.json`.

Each place has `tools/blender/places/<id>.py` and
`art/places/3d/<id>/{<id>.blend,<id>.glb,manifest.json}`. IDs remain `cala`, `fotos`,
`tienda`. Source is reproducible with Blender 5.2.2 LTS; the .blend retains
separate semantic objects and editable bevel/weighted-normal/leaf modifiers.
GLB batches static geometry. No photographs, image textures, lights or evidence
water planes are exported. Limits are 12000 triangles and 600000 bytes per GLB.

## Placement

Normalized radius=1; origin=place center. Source: Z up, front −Y, water Z=0.
GLB: Y up, front +Z, water Y=0. Runtime scale is the current scene collision
radius divided by manifest.radius. Bounds in manifest are explicitly in source
Blender coordinates; convert `(x,y,z)` to glTF `(x,z,-y)`. Current cala central
collision radius is approximately7.83 scene units; retain its existing capsule
and broader proximity. All vertices are within radius1; maximum radial extent
0.966512, height0.555798 (approximately4.35 scene units at existing scale).

The marina ground occupies only the **rear** semicircular cap (source Y≥0).
There is no terrain under the moored boats. Replace the entire previous island
decoration, including its terrain disk, original shore fill, supplemental props,
and decoration updates/lights; do not leave any of these filling the basin.
Pantalanes/quays are inside the existing collision footprint. The front exterior
approach remains unobstructed; the decorative basin does not grant new navigable
collision space. Source hulls cross water0; quay bases extend to−0.055.

## Future motion

`common.export(..., motion=[{node,clip,duration,static_frame}])` excludes semantic
moving assemblies and their descendants from the static join. Name the moving
parent and Action/NLA clip identically to the manifest contract; key parent
transforms for rigid groups. Export uses animations=true only for declared motion.
The checker requires exported channels, clip duration and semantic nodes. The
fresh-import gate confirms named actions survive. No runtime playback is claimed:
the existing ModelStore drops GLTF clips, and T112 must retain clips, create a
mixer per loaded instance, update from the scene clock and stop/release it.
`static_frame` is an authored Blender frame at24fps for reduced motion. T110 must
validate actual animated phases, pivot/contact/bounds and fresh imported motion.

## Reproduce and validate

T110 `fotos` uses a rigid dressed mascot sliding on a supported club pole.
Its optional `motion[].validation` records source-space pivots, visible hand
nodes, pole endpoints/radius, phase frames and the moving envelope. The independent
checker samples all 97 exported phases, including actual pole circumference and
mitten geometry; fresh import compares moving bounds, pivots and hands at 17 phases.
See `art/places/3d/fotos/requirement_ledger.md` for the T112 playback handoff.

```powershell
node --experimental-transform-types --import ./packages/world/scripts/ts-resolve.mjs tools/blender/places/distance_camera.mjs node_modules/t110-preview/distance-camera.json fotos
& $blender --background --factory-startup --python-exit-code 1 --python tools/blender/places/fotos.py -- --preview node_modules/t110-preview/final
python tools/blender/places/check.py art/places/3d/fotos
python tools/blender/places/test_check.py
& $blender --background --factory-startup --python-exit-code 1 --python tools/blender/places/fresh_import.py -- --manifest art/places/3d/fotos/manifest.json --output node_modules/t110-preview/final/fresh-import.json
& $blender --background --factory-startup --python-exit-code 1 --python tools/blender/places/fotos.py -- --fresh-evidence --preview node_modules/t110-preview/fresh
```

## Ibiza (`tienda`, T111)

A static white village above a sheltered cove: the cove opens toward the front
approach (source -Y, glTF +Z), with the beach, the BOIA kiosk (striped awning,
counter, T-shirt line, TIENDA sign) and a jetty inside it, boathouses under the
right cliff, a stepped lane to the church on the hilltop and a defence tower on
the left headland. Static only (`motion: []`), batched to `static_tienda`.
Terrain columns are rays from the cove centre: rings at fixed offsets from the
cove edge and on the coast contours, so material bands follow mesh edges.

The optional `approach.channel` declares the open-water mouth: inside
`clear_sector_degrees` (measured from source -Y toward +X) and from `from_radius`
outwards, `check.py` rejects any exported vertex above `max_height`. Cala and
fotos do not declare it and are unaffected. Ledger: `art/places/3d/tienda/`.

```powershell
node --experimental-transform-types --import ./packages/world/scripts/ts-resolve.mjs tools/blender/places/distance_camera.mjs node_modules/t111-preview/distance-camera.json tienda
& $blender --background --factory-startup --python-exit-code 1 --python tools/blender/places/tienda.py -- --graybox --preview node_modules/t111-preview/graybox-final
& $blender --background --factory-startup --python-exit-code 1 --python tools/blender/places/tienda.py -- --preview node_modules/t111-preview/final
python tools/blender/places/check.py art/places/3d/tienda
python tools/blender/places/test_check.py
& $blender --background --factory-startup --python-exit-code 1 --python tools/blender/places/fresh_import.py -- --manifest art/places/3d/tienda/manifest.json --output node_modules/t111-preview/final/fresh-import.json
& $blender --background --factory-startup --python-exit-code 1 --python tools/blender/places/tienda.py -- --fresh-evidence --preview node_modules/t111-preview/fresh
```

`distance_camera.mjs` accepts the output path then optional place ID (default cala).
For fotos, the retained 1.7-radius approach crops tall tower tops; additional
1.05-radius exterior approach renders use the same camera law and show the skyline.
These evidence adjustments do not modify the live camera or island geometry.

Run from repository root with an explicit official Blender executable:

```powershell
node --experimental-transform-types --import ./packages/world/scripts/ts-resolve.mjs tools/blender/places/distance_camera.mjs
& $blender --background --factory-startup --python-exit-code 1 --python tools/blender/places/cala.py -- --preview node_modules/t107-preview/final
python tools/blender/places/check.py
python tools/blender/places/test_check.py
& $blender --background --factory-startup --python-exit-code 1 --python tools/blender/places/fresh_import.py -- --manifest art/places/3d/cala/manifest.json --output node_modules/t107-preview/final/fresh-import.json
```

Standard six-view export evidence and inspector use repository Blender validation
scripts. Preview paths remain ignored. See cala/reference_notes.md and
cala/requirement_ledger.md for design observations and the reviewed deliverable.

`distance_camera.mjs` reads the current map/scale and camera constants without
changing them. It records radius 7.834375, wide-screen zoom 0.2, vertical FOV 40,
and camera distance 32.270305 scene units for a stationary exterior approach.
Blender uses explicit vertical sensor fit. This is a flat asset review: planet
curvature, fog, motion lead, UI inset and runtime lighting still require T108
captures. Generate camera settings before requesting a preview; plain source
generation and export need only Blender.

The checker measures transformed GLB bounds/radial extent, valid indices and
zero-area triangles. Fresh import compares the editable scene's material names,
base color, roughness, metallic and effective emission against imported GLB,
along with orientation/bounds and triangles after collapsed tessellation removal.
The editable bevel surfaces evaluate to 11644 tessellation triangles; 240
collinear tessellation fragments are filtered reproducibly, leaving 11404.
No authored polygon or edge is degenerate. Split export normals legitimately
create boundary edges: watertightness, UV textures and collision meshes are not
requirements for this palette-based decorative asset.
