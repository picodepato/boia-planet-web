# T107 requirement ledger - current-workspace verification

2026-10-04. Stage 7 complete for the static art deliverable. Original modeling
and reference observations retained; missing render evidence was recreated.
Creator visual review; no independent aesthetic score. Runtime integration is T108.

Contract: miniature Alicante marina, rounded BOIA clay palette, connected
quays/promenade, sheltered water, six moored yachts, four palms and low white/blue
harbor buildings with orange canopy. Finished smooth silhouettes, not a
requested low-poly blockout. Radius 1; 12000 triangles / 600000 bytes per place
are ceilings. No textures, cameras, sea plane or lights in GLB. Source retains
semantic parts and editable bevel/weighted-normal/leaf modifiers.

| Requirement / stage | Judgment | Current evidence / concrete observation |
| --- | --- | --- |
| 1. References and contract | Prior review retained | reference_notes.md; original photo not copied and could not be reopened in this continuation; primary page fetched again |
| 2. Graybox proportions | Pass | graybox/graybox.png opened: low stepped roofs, palms above roof, six berths and connected U quays; front negative space remains open |
| 3. Primary/secondary forms | Pass | final/hero-day.png opened: sail/motor yachts, dark windows, canopy posts, benches, mooring ropes and bollards readable |
| 4. Topology / supports | Pass | authored/export metrics: no degenerate polygons, zero-length edges, invalid vertices or missing materials; 240 collinear bevel tessellation fragments removed by reproducible exporter |
| 5. Materials | Pass | fresh-import.json compares all 10 names and base color, roughness, metallic, effective emission; no image textures; hero material breaks remain clear |
| 6. Finish / whole-asset coverage | Pass | exported perspective/contact sheet/top opened: softened edges, smooth hulls, curved thick leaves; rear is an intentionally plain enclosed service wall |
| 7. Reproduction / fresh import | Pass | two clean Blender builds plus baseline share world-geometry/winding/normal/material signature; fresh-import parity passes |
| Footprint and basin | Pass | Blender min (-0.929477,-0.560000,-0.055000), max (0.929477,0.930000,0.555798), radial 0.966512; top has no solid terrain under boats |
| Connected pier/quay contact | Pass | three fingers overlap promenade at their heads; outer walkways meet promenade; ropes run from boats to their nearest finger pier |
| Exterior navigable approach | Pass for art | all geometry inside radius 1; exterior +Z approach sector [-25,25] is clear; decorative basin retains existing collision exclusion |
| Day/night at game distance | Pass for asset preview | hero-day/night and distance-day/night opened; boats, palms, stepped roof and open water remain readable; restrained lamp emission |
| Runtime replacement / popup / collision behavior | Not applicable | T108 must replace ALL old Cala terrain/shore/props/lights/decoration updates; no live hookup here |

All render/measurement evidence is ignored, outside published art:
`node_modules/t107-preview/` relative to this workspace:

- `graybox/graybox.png`
- `final/{hero-day,hero-night,distance-day,distance-night}.png`
- `final/multiview/{perspective,front,back,left,right,top,contact_sheet}.png`
- `final/multiview/evidence.json` (six views, EEVEE, 512px, explicit dark preset)
- `final/{authored-metrics,export-metrics,fresh-import,reproducibility}.json`
- `final/preview-settings.json`, `distance-camera.json`
- `baseline/{authored-metrics,export-metrics,topology,fresh-import}.json`

Distance review uses current marWorld, radius 7.834375 scene units, aspect 4:3,
zoom 0.2, vertical FOV 40 degrees, camera distance 32.270305 scene units,
elevation 0.70656 radians and stationary boat at 1.7 radii on front approach.
Blender sensor fit is explicitly VERTICAL. Normalized camera
(0,-4.009147,2.674185), target (0,-0.876187,0). EEVEE Standard 1000x750;
day sun 2.4, night 0.35. Flat previews omit GPU curvature, fog, inset/UI,
velocity lead and runtime lighting. Actual engine captures/runtime behavior
belong to T108; no runtime completion claim.

Export 11404 triangles, 427148 bytes. Editable evaluated scene 11644 loop
triangles, including 240 collapsed tessellation fragments, but zero degenerate
polygons/edges. Fresh GLB has zero collapsed triangles. Boundaries produced by
split normals are expected for this multi-part render asset, not a printable
watertight or collision mesh. No UV texture requirement; clay uses constant PBR
colors. No external photographs redistributed. See final_report.md for commands.
