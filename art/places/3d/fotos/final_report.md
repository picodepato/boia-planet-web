# T110 delivered asset and validation record

Delivered `tools/blender/places/fotos.py` and
`art/places/3d/fotos/{fotos.blend,fotos.glb,manifest.json,reference_notes.md,requirement_ledger.md,final_report.md}`.
Shared changes are limited to independent place export/evidence and validation:
`common.py`, `distance_camera.mjs`, `place3d.schema.json`, `check.py`,
`fresh_import.py`, `test_check.py`, and their README. Cala asset files are unchanged.

Final export: **11768 triangles, 397380 bytes (397.38 kB)**; ceilings 12000/600000.
Editable evaluated scene: 11800 tessellation triangles; 32 collapsed fragments
filtered at export. Independent checker and clean import find no degenerate
export triangles. Bounds Blender min `[-.94,-.94,-.045]`, max `[.94,.94,1.343]`,
radial .94. No enlargement proposed. Motion and contact handoff is in the ledger.

Reproduction compared final output to an earlier independent generation: matching
world geometry/winding/normals/material signature and all 97 clip phases within
six-decimal precision. Byte-identical serialization is not required or claimed.
Final GLB SHA256: `5e6bb5981254bfbc2fe362d3ee83612d44da2acb615bc0c556a6dd24655fe598`.
Ignored evidence: `node_modules/t110-preview/reproducibility.json`.

Official Blender executable used read-only:
`C:/Users/alvar/.codex/worktrees/0b17/boia-planet-hernan/node_modules/.tools/blender-5.2.2-windows-x64/blender.exe`.
In commands below `$B` denotes that path and every Blender invocation includes
`--background --factory-startup --python-exit-code 1`.

| Final validation command | Exit | Result |
| --- | ---: | --- |
| `node --experimental-transform-types --import ./packages/world/scripts/ts-resolve.mjs tools/blender/places/distance_camera.mjs node_modules/t110-preview/distance-camera.json fotos` | 0 | Actual fotos radius/camera inputs |
| `& $B ... --python tools/blender/places/fotos.py -- --preview node_modules/t110-preview/final` | 0 | Blend, GLB, manifest, authored evidence |
| `python tools/blender/places/check.py art/places/3d/fotos` | 0 | Budgets, geometry, default pose, 97 motion/contact phases |
| `python tools/blender/places/check.py art/places/3d/cala` | 0 | Cala regression gate |
| `python tools/blender/places/test_check.py` | 0 | 23 positive/negative contract tests, including NaN motion |
| `& $B ... --python tools/blender/places/fresh_import.py -- --manifest art/places/3d/fotos/manifest.json --output node_modules/t110-preview/final/fresh-import.json` | 0 | PBR/static geometry and 17 original/imported motion/contact phases |
| Same fresh-import command with cala manifest and `node_modules/t110-preview/cala-fresh-import.json` | 0 | Cala clean-import regression |
| `& $B ... --python tools/blender/places/fotos.py -- --fresh-evidence --preview node_modules/t110-preview/fresh` | 0 | Fresh GLB multiview and motion evidence |
| `node node_modules/typescript/bin/tsc -p <project>/tsconfig.json` for contracts, db, engine, store, world, web | 0 each | All six project typechecks |
| `node node_modules/eslint/bin/eslint.js . --max-warnings 0` | 0 | Repository lint |
| `node node_modules/eslint/bin/eslint.js tools/blender/places/distance_camera.mjs --no-ignore --max-warnings 0` | 0 | Changed tool checked despite default tools ignore |
| `node --check tools/blender/places/distance_camera.mjs`; Python `py_compile` on the five place Python scripts | 0 | Source syntax |
| `node node_modules/vitest/vitest.mjs run packages/world --configLoader native --pool threads --testNamePattern '^(?!.*la orden).*'` | 0 | 74 passed, 2 subprocess tests skipped |
| `node --import ./packages/world/scripts/ts-resolve.mjs packages/world/src/cli/world-check.ts` | 0 | Normal CLI report |
| Same CLI with `--registro packages/world/src/worlds/fixtures/sin-skin.ts` | 1 expected | Missing skin rejected |
| Same CLI with `--registro packages/world/src/worlds/fixtures/lugar-desconocido.ts` | 1 expected | Unknown place rejected |
| `git diff --check` (read-only) | 0 | No whitespace errors |

Validation limitations: initial `pnpm typecheck`, `pnpm lint`, `pnpm exec vitest`
returned 1; direct Node invocations resolved wrapper/config launch issues. The
full native/threads world Vitest run returned 1 with 74 passed and two subprocess
assertions failing because `spawnSync` is denied (`spawn EPERM`, status null).
Those two tests remain unexecuted as written; all three equivalent CLI invocations
were checked directly with expected output and exit status. No test configuration,
dependency or runtime code was changed to bypass the restriction.

Reviewed all six views, nine motion phases and exterior-distance comparisons
for the export and fresh import via the five `review-*.jpg` sheets; also opened
full-resolution hero, front, close mascot and distance renders. Architect reviews
covered scope, repeated tool failures and the final visual/validation handoff.
BOIA remains dressed throughout; hands stay on the supported pole. Cameras and
equalizer screens are decorative geometry. No dynamic camera or media access.

Decisions/remaining work: preserve radius/scale; retain the 1.7-radius skyline
crop evidence and the complete 1.05-radius view. Primary photo inspection could
not be completed (see reference_notes.md). T112 owns live framing/lighting,
clip retention, mixer lifecycle, playback and reduced motion. This delivery
does not claim runtime completion. No commit, add, stash, checkout, reset, merge,
push, deploy or write to the Blender checkout was performed.
