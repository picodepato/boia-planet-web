# T107 final art report

Delivered `tools/blender/places/{cala.py,common.py}`, editable `cala.blend`,
`cala.glb`, adjacent manifest, schema/checker/unit tests, fresh-import validator,
read-only game-distance camera helper, reference notes and requirement ledger.
The contract supports stable IDs cala/fotos/tienda; only cala is built by T107.
Future motion fields are reserved, not proof of animated validation.

Blender: supplied read-only executable, **5.2.2 LTS**, build d13f752e3b9c,
2026-09-15. `cala.blend`: 1953967 bytes, 180 semantic meshes, 155 refinement
modifiers. `cala.glb`: **11404 triangles, 427148 bytes (427.148 decimal kB)**,
one batched static mesh + root, 10 materials, no textures/lights/cameras/actions.
All geometry fits radius 1; measured radial extent 0.966512207.

Blender Z-up bounds: min (-0.929476798,-0.560000002,-0.0549999997),
max (0.929476798,0.930000007,0.555797517). glTF Y-up bounds:
min (-0.929476798,-0.0549999997,-0.930000007),
max (0.929476798,0.555797517,0.560000002). Mapping `(x,y,z)` to `(x,z,-y)`;
front +Z, water Y=0. Runtime scale: existing scene collision radius / radius.

The inherited source already filters 240 collapsed export triangles. Rebuilt
it twice from clean processes; verified no geometry change. Authored evaluated
surface: 11644 tessellation triangles including 240 collinear fragments,
zero degenerate polygons/zero-length edges/invalid vertices/missing materials.
Fresh GLB: zero degenerate triangles and zero-length edges. Fresh import
compares all PBR names/values and bounds; orientation agrees.

Static world geometry/winding/normals/material signature (baseline and both
clean builds): `426d9dcfbbe2426c9e39fdcb99ff3a2ae532aa921f6b06ba47c5105f8cfd264f`.
This is static equivalence, not a motion test or aesthetic score.

Commands run from repository root; `$blender` is the executable supplied in
the task. Every Blender command used `--background --factory-startup
--python-exit-code 1` (except `--version`). Evidence outputs stay in ignored
`node_modules/t107-preview`; exact paths/review observations are in the ledger.

| Command / validation | Exit |
| --- | --- |
| `$blender --version` | 0 |
| `node --experimental-transform-types --import ./packages/world/scripts/ts-resolve.mjs tools/blender/places/distance_camera.mjs` | 0 |
| `$blender ... --python tools/blender/places/cala.py -- --graybox --preview node_modules/t107-preview/graybox` | 0 |
| `$blender ... --python tools/blender/places/cala.py -- --preview node_modules/t107-preview/final` | 0 |
| `$blender ... --python tools/blender/places/cala.py` (second clean rebuild) | 0 |
| `python tools/blender/places/check.py` | 0 |
| `python tools/blender/places/test_check.py` (11 corruption/parity tests) | 0 |
| `python tools/blender/check.py` (61 legacy/live manifests) | 0 |
| `$blender ... --python tools/blender/places/fresh_import.py -- --manifest art/places/3d/cala/manifest.json --output node_modules/t107-preview/final/fresh-import.json` | 0 |
| `$blender ... --python .claude/skills/blender-asset-validation/scripts/inspect_asset.py -- --input art/places/3d/cala/cala.blend --output node_modules/t107-preview/final/authored-metrics.json` | 0 |
| Same inspector, cala.glb -> final/export-metrics.json | 0 |
| `$blender ... --python .claude/skills/blender-asset-validation/scripts/diagnose_topology.py -- --input art/places/3d/cala/cala.blend --output node_modules/t107-preview/baseline/topology.json --limit 30` | 0 |
| `$blender ... --python .claude/skills/blender-asset-validation/scripts/render_evidence.py -- --input art/places/3d/cala/cala.glb --output-dir node_modules/t107-preview/final/multiview --resolution 512 --presentation dark` | 0 |
| Python geometry_signature assertions across baseline / first-build / final | 0 |
| `pnpm lint` | 0 |
| `pnpm typecheck` | 1: pnpm subprocess launch EPERM |
| `node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json` | 0 |
| `node node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json` | 0 |
| `node node_modules/typescript/bin/tsc -p packages/db/tsconfig.json` | 0 |
| `node node_modules/typescript/bin/tsc -p packages/engine/tsconfig.json` | 0 |
| `node node_modules/typescript/bin/tsc -p packages/store/tsconfig.json` | 0 |
| `node node_modules/typescript/bin/tsc -p packages/world/tsconfig.json` | 0 |

Initial camera helper run without `--experimental-transform-types` exited 1
because existing engine TS uses parameter properties; corrected command above
passes. Original photo retrieval failed and no browser surface was available;
the accepted earlier reference review is retained, not newly claimed.

Decisions: retain the approved harbor silhouette/materials, repair and measure
export tessellation reproducibly, strengthen focused contract checks, keep
collision/exterior approach unchanged. Reuse adjacent independent manifests;
no live island registry addition or runtime/client/world/physics/persistence edit.
No version-control write, push or deployment. T108 remains: load the harbor,
replace ALL old Cala terrain/shore/props/lights/decoration updates so the basin
stays empty, then validate live lighting/curvature/loading/fallback/collision.
