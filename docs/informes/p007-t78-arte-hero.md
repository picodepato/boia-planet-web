# p007-t78 — Hero 3D art from Blender: GLB props and the still render

Plan 007, task T78. Status: `muestra` — Álvaro approves the final art later
(plan header, decision 4); nothing here is blocked on that.

## Summary

- Four realistic set-dressing props for the hero scene of the landing
  (design document `docs/propuestas/2026-10-03-landing-scroll.md`, section
  12): `costa`, `puerto`, `barco`, `boya`, as reproducible Blender scripts
  under `tools/blender/landing/` exported to `art/landing/3d/*.glb` with
  `manifest.json`. No mascot, no clouds, no gulls, no clay ships.
- Total 6 222 triangles of the 12 000 cap and 203 kB of the 220 kB cap, no
  Draco, no textures (vertex colours), at most 4 materials per prop, every
  light a separate `luz_*` mesh with an emissive material so three.js can
  attach sprite halos by node name.
- Four stills of the same scene, props, palette and camera for the static
  version: `art/landing/hero-still-1600.webp` (105 kB), `hero-still-800.webp`
  (27 kB), `hero-still-noche-1600.webp` (115 kB), `hero-still-noche-800.webp`
  (43 kB), rendered by `tools/blender/landing/render_hero_still.py` from
  `escena.py` (EEVEE, Ocean modifier water, volumetric low haze, depth of
  field on the boat, bloom, vignette and film grain).
- Every GLB validated with the asset-validation skill: evaluated metrics,
  fresh import in a clean Blender process, six fixed views (below).
- `tools/blender/check.py` gained `check_landing_3d` (schema
  `tools/blender/landing3d.schema.json`): manifest, one GLB per prop, budgets
  per prop and in total, ≤ 4 materials, 1 + lights meshes, `luz_*` nodes
  present, no Draco or textures, and the four stills within their kB limits.
  `tools/spec/checks.sh` runs it.

## Working contract (from the intake)

Resolved from the approved design document, section 12 and 13 (no question
to Hernán was needed):

| Decision | Choice | Evidence |
|---|---|---|
| Subject | the coast, the port (breakwaters, beacons, lamps), a 10 m motor-sailer, a navigation buoy | the GLBs and the stills |
| Style | realistic set dressing seen against the light; real proportions, no faces, no toy edges | six-view renders, the stills |
| Platform | three.js in the landing hero (T79), GLB without Draco, vertex colours | `manifest.json`, `check.py` |
| Scale | metres, water at y = 0; seaward is glTF −z (Blender +Y), where a three.js camera looks by default | `manifest.json` `unidades` |
| Budget | ≤ 12 000 triangles and ≤ 220 kB in total, ≤ 4 materials per prop; per-prop figures of section 12 as targets | export log, `check.py` |
| Lights | separate `luz_*` meshes, one emissive material per light colour; positions in the manifest | `manifest.json` `lights` |
| Stills | 1600×1000 and 800×500 WebP, golden hour and night, ≤ 120 / 50 kB; horizon 42 %, sun at x 66 % and 4° up, boat at x 50 %, breakwaters left and right, coast left, buoy at x ≈ 84 % | the WebP files, section "Stills" |
| Reproducibility | `blender -b -P` scripts, no random module (mathutils noise, seeded numpy grain), fixed samples and ocean time | a rerun gives byte-identical GLBs (md5 compared); the stills match in look and size but not in bytes (EEVEE's GPU sampling is not bit-exact) |

## Props

Conventions: metres; the glTF export is y up with −z seaward, so a prop
placed ahead of the camera faces away from it; each prop's origin is its
`anchor` in the manifest; `bounds` and the light positions are in glTF axes.

| Prop | What it is | Triangles (budget) | Materials | Lights | kB (target) | Fresh import |
|---|---|---|---|---|---|---|
| `costa` | near headland (cliff to the sea, scrub inland) and a long far ridge; displaced grids with fractal noise; 1 888 × 2 537 m, 240 m high | 2 452 (3 000) | `costa` | — | 42 (45) | pass, 0 issues; 1 354 vertices, 1 mesh, no degenerate faces |
| `puerto` | two rubble-mound breakwaters with crown wall and promenade, round heads with the green (left) and red (right) beacon towers, a quay wall with 8 lamp posts and 4 bollards on the lee of the left one; 285 × 325 m, towers 17 m | 2 008 (3 500) | `hormigon`, `luz_verde`, `luz_roja`, `luz_muelle` | `luz_verde`, `luz_roja`, `luz_muelle_01`…`08` | 88 (55) | pass, 0 issues; 2 310 vertices, 11 meshes (1 + 10 lights) |
| `barco` | 10.4 m motor-sailer: hull with boot-top and antifouling, cambered deck, toe rail, coachroof with six windows, cockpit with coaming and wheel, mast with spreaders, boom with the furled main in its cover, stays, stanchions and lifelines, pulpit and pushpit, two lanterns, masthead light; 3.4 × 10.4 × 14.8 m | 1 362 (2 000) | `barco`, `cristal`, `luz_farol` | `luz_farol_babor`, `luz_farol_estribor`, `luz_tope` | 56 (35) | pass, 0 issues; 1 435 vertices, 4 meshes (1 + 3 lights) |
| `boya` | pillar buoy: orange steel float with a rubber fender ring and a weathered waterline band, dark lattice tower, lantern; 2.3 × 2.3 × 4.3 m | 400 (400) | `boya`, `luz_boya` | `luz_boya` | 17 (10) | pass, 0 issues; 387 vertices, 2 meshes |
| **Total** | | **6 222 (cap 12 000)** | | 14 lights | **203 (cap 220)** | |

Per-prop kB are above the section 12 targets for `puerto`, `barco` and
`boya` (split vertices at hard edges, plus ~2–7 kB of GLB JSON per file) and
below for `costa`; the totals, which are the caps, hold with 17 kB to spare.
Triangles are well under the cap: what makes these props read is
silhouette, material and light, as the design says, and a plain (unquantized)
GLB cannot carry many more vertices under 220 kB.

Fresh import: the asset-validation skill's `inspect_asset.py` opened each
GLB in a new `--factory-startup` Blender 5.2.2 process; all four report
`hard_gate_pass: true` with no issues, no invalid vertices, no degenerate
faces, no zero-length edges, no missing materials. Boundary and non-manifold
edges are expected (open hulls, strips, caps) and are not gates for a game
asset. `costa` is exported without normals (12 bytes a vertex less): a smooth
terrain gets the same normals from the loader's `computeVertexNormals()`
(three.js' `GLTFLoader` computes them when `NORMAL` is absent; the mesh is
indexed, so they are smooth). In Blender's own reimport it therefore shows
flat-shaded, which is what the `costa` evidence renders show; the still,
rendered from the authored mesh, shows it smooth.

Multiview renders (asset-validation skill, `render_evidence.py`, dark
studio, 384 px, contact sheet at half size):

- `docs/informes/img/p007-t78-costa-vistas.png`, `-costa-hero.png`
- `docs/informes/img/p007-t78-puerto-vistas.png`, `-puerto-hero.png`
- `docs/informes/img/p007-t78-barco-vistas.png`, `-barco-hero.png`
- `docs/informes/img/p007-t78-boya-vistas.png`, `-boya-hero.png`

Visual review (the images above were opened and looked at):

- `barco` reads as a real motor-sailer from every view: the sheer rises to
  the bow, the transom is wide, the boot-top stripe is crisp, the coachroof
  sits on the deck with its windows, the cockpit, wheel and lanterns are
  where they belong; the rig (mast, spreaders, boom, cover, stays, lifelines)
  is complete and attached. Nothing floats.
- `boya` reads as a pillar buoy; the 12-sided float shows its facets at
  studio distance and is round at the hero's 30 px.
- `puerto` is 300 m long, so the studio views show two thin bars with the
  round heads and towers; the in-scene stills are the useful evidence: the
  heads, towers, lenses and the nearest lamps read correctly left and right
  of the mouth.
- `costa` in the studio is a displaced strip (flat-shaded on reimport, see
  above); in the still it is what the design asks for: a dark headland with
  a jagged crest and a cliff to the water, and a far ridge in the haze.

## Stills

`escena.py` places the four props as the manifest's `escena` block says
(positions in glTF axes, yaw about the up axis): camera at (0, 10, 0) with
pitch −3.33° and a 40° vertical FOV (horizon at 42 %), the boat 105 m ahead,
the harbour mouth 170 m ahead with the heads at x = ±85 m, the buoy at
(42, 0, −100), the coast at (−190, 0, −330), the sun and the moon 10.6° right
of seaward and 4° up (x 66 %). Water: a plane with the Ocean modifier (gentle
swell, fixed time and seed) and a dark glossy material with a small-ripple
bump, so the sun path glitters; sky: a gradient by elevation from the section
3 palette (zenith, sky, horizon haze) plus a Voronoi star field at night;
haze: a volume box whose density falls with height; lights: a sun lamp and an
emissive disc; halos: soft emissive billboards on every light mesh, as the
live scene's sprites. Post: bloom (compositor Glare), then numpy vignette
0.45 and film grain 5.5 %, seeded. AgX view transform. Two runs give the
same look and sizes; the bytes differ (EEVEE's GPU sampling), unlike the
GLBs, which are byte-identical between runs.

| File | Size | Limit | WebP quality |
|---|---|---|---|
| `art/landing/hero-still-1600.webp` | 104.9 kB | 120 | 64 |
| `art/landing/hero-still-800.webp` | 26.7 kB | 50 | 84 |
| `art/landing/hero-still-noche-1600.webp` | 114.4 kB | 120 | 72 |
| `art/landing/hero-still-noche-800.webp` | 42.4 kB | 50 | 88 |

Render time: about 7 s per phase at 1600×1000 and 64 samples on this
machine (EEVEE, GPU). The 800 px files are a box-filtered half of the 1600
render, so both carry the same grain.

Review of the golden still: the horizon sits at 42–43 %, the sun disc at
x 66 % with its path straight down the water, the boat silhouette at x 50 %
with the mast reaching the horizon, the green beacon tower and the nearest
lamp on the left head, the red tower on the right head, the buoy at x ≈ 86 %
with its lit lens, the headland as a dark silhouette on the left; the sky
goes from the orange haze band to the dark purple-blue zenith of the palette.
The night still: the moon and its path, stars, the beacons green and red,
the quay lamp, the boat's lanterns and masthead, the buoy's light, the
breakwaters and the headland as barely separated dark shapes on a near-black
sea, as section 3.1 wants. Open points for Álvaro's eye: the warmth of the
golden haze band and how dark the night should be.

## Commands

| What | Command | Result |
|---|---|---|
| Export the props | `blender.exe -b -P tools/blender/landing/export_landing_glb.py` | exit 0; 4 GLB + manifest; 6 222/12 000 triangles, 203/220 kB |
| Render the stills | `blender.exe -b -P tools/blender/landing/render_hero_still.py` | exit 0; 4 WebP within their limits |
| Art check | `python3 tools/blender/check.py` | exit 0, `landing/3d (landing-glb)` reported with the stills |
| Validation | asset-validation skill `inspect_asset.py` and `render_evidence.py` per GLB | `hard_gate_pass: true`, 0 issues, 6 views each |

Blender 5.2.2 LTS (hash d13f752e3b9c) at
`C:/Users/alvar/Blender/blender-5.2.2-windows-x64/blender.exe`.

## Decisions taken here (reversible)

- Seaward is Blender +Y / glTF −z (not −Y / +z as the islands' "front"):
  the hero camera looks seaward, and a three.js camera looks to −z, so the
  props sit ahead of it without a rotation. The manifest says so.
- No baked 512² atlas for `puerto`: vertex colours only, so the whole
  220 kB go to geometry; the stone reads through the breakwaters' displaced
  armour and the colour bands, and the port is a silhouette in the hero.
- `costa` without normals in the GLB (loader computes them, smooth); the
  other props keep their split normals.
- The per-prop kB figures of section 12 are targets; the caps (totals) are
  what the exporter and `check.py` enforce, together with each prop's
  triangle budget and the 4-material limit.
- The camera's "1.2 boat lengths above the water, 3 behind the boat" of
  section 5.2 cannot give a boat at y 56 % that is ~140 px tall; the still
  follows the screen framing of section 12 (camera 10 m up, the boat 105 m
  ahead), which gives both.
- Depth of field: at these distances a real f/2.8 blurs nothing; the camera
  uses f/1.0 focused on the boat, which still leaves the image sharp. Grain
  is 5.5 % (section 3.1 says 6–8 %) so the 1600 px golden still fits in
  120 kB at WebP quality 64 instead of 50.

## Not done / for later

- The halos, haze, water and sky of the stills live in `escena.py`; the live
  scene reproduces them in three.js (T79) using the manifest's `escena`
  block and light list.
- No README section yet for `tools/blender/landing/` (T83 writes the docs).
- The art is `muestra`: Álvaro's approval of the final look (coast, port,
  boat, buoy, the two grades) is pending by design.
