# T110 handoff and reviewed evidence

Source: `tools/blender/places/fotos.py`; editable semantic parts and modifiers
in `fotos.blend`; static batch plus separate rigid mascot in `fotos.glb`.
Manifest ID remains `fotos`. No map, route, collision, persistence, race,
client or runtime registration changed. T112 owns integration and playback.

Bounds (source Blender Z-up): min `[-0.94,-0.94,-0.045]`,
max `[0.94,0.94,1.343]`; radius `0.94` within normalized radius 1.
At current fotos collision scale 7.0875, height is approximately 9.52 scene units.
No island enlargement proposed. A larger footprint would worsen skyline cropping.

Motion: moving empty `boia_pole_slide`, clip/action `boia-pole-dance`, 4 seconds,
24 fps, authored frames 1..97. `t=(frame-1)/24`. Root remains `place_fotos`;
static batch is `static_fotos`. Translation only, no rig/bone dependencies.
Pivot frame 1 is `[0,-0.33,0.42]` in Blender, `[0,0.42,0.33]` in glTF.
The pivot is on the pole axis; rigid body center is local `[-0.19,0,0]`.
Translation law is `z=0.42+0.085*(1-cos(2*pi*t/4))`.
Keyed every authored frame with smooth turns; export uses sampled linear glTF
translation. Low z .42 at frame 1/97, high z .59 at frame 49, travel .17.
Endpoint sampled speed is about .0044 normalized units/s; position closes exactly.

Reduced motion: `static_frame=1`, low pose, completely dressed with both mittens
gripping the pole. Exported default pose equals that frame. T112 should seek the
clip to t=0 and stop updates; do not apply a floating idle or disconnect the group.

Pole endpoints Blender `[0,-0.33,0.15]` -> `[0,-0.33,1.03]`, radius .014;
glTF `[0,0.15,0.33]` -> `[0,1.03,0.33]`. Floor flange connects to stage,
top reach connects to the two-column supported truss. Stage top .15; beam
underside/contact support plane 1.03.
Visible mesh origins define local hand contacts in the moving node:
- `boia_hand_high`: `[0,-0.024,0.105]`, glTF `[0,0.105,0.024]`.
- `boia_hand_low`: `[0,0.024,0.005]`, glTF `[0,0.005,-0.024]`.
Mitten horizontal radius .018 intersects pole surface; center-axis offset .024.
Their world heights range .525..695 and .425..595 respectively. Arms reach these
hands; the float/body stay left of the pole. Stage/beam clearances stay positive.

Animated mascot envelope Blender: min `[-0.355,-0.495,0.212]`,
max `[0.018,-0.165,0.818135]`. Full place envelope equals the static place bounds
because towers/terrain dominate. All phases stay inside radius 1.

Evidence is ignored and outside delivered art: `node_modules/t110-preview/`.
`final/` contains authored-export hero day/night, six views (front/back/left/
right/top/oblique), distance day/night and nine motion renders (frames
1,13,25,37,49,61,73,85,97). `fresh/` reproduces those renders from a fresh GLB
import. `final/fresh-import.json` records original/imported materials, 17 sampled
moving bounds/pivots/hand contacts and actual action ranges. `review-*.jpg`
contact sheets provide an index of reviewed views.

Camera evidence uses actual **fotos** collision radius 7.0875, vertical FOV 40,
zoom .2, camera distance 32.270305, 1000x750. Default stationary exterior approach
at 1.7 radii clips tower tops: retained in `distance-day/night.png`. Closer exterior
approach at 1.05 radii, with the same camera law and FOV, shows the entire skyline
in `distance-near-day/night.png`. BOIA, outfit, cameras, screens and stage are
legible there. This is a flat scene review without planet curvature, fog, UI inset
or runtime lighting. T112 must review live framing; no runtime completion claim.

Independent GLB checker samples all 97 phases: channel target, finite outputs,
vertical travel, axis retention, closed seam, static pose, visible hand geometry,
contact range and stage/support clearance, animated bounds and radial ceiling.
Fresh import compares 17 phases of moving bounds/pivot/hand world points, plus
static geometry/bounds and PBR material values. Cala remains compatible.
Primary photograph inspection remains pending as described in reference_notes.md.
