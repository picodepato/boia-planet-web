# T107 handoff state

2026-10-04: static art/export task complete in this workspace. Source and editable
blend/GLB regenerated with Blender 5.2.2 LTS; full inspection, fresh-import PBR /
bounds parity and opened visual evidence recorded in requirement_ledger.md and
final_report.md. No pending tool jobs or known export gates. Accepted source
geometry unchanged from the carried-forward model; 240 collapsed tessellation
triangles removed reproducibly, leaving 11404 / 427148 bytes.

Runtime remains T108. Independent schema supports cala/fotos/tienda; only cala
has an asset here. All original-photo observations are inherited; no new photo
inspection is claimed. Renders are in node_modules/t107-preview. Plain Blender
generation needs no Node camera settings; preview generation first runs
distance_camera.mjs with --experimental-transform-types.

Next action for integration: review full README placement/replacement contract,
replace all Cala decoration including the disk/shore/props/lights/updates, retain
existing collision capsule/exterior approach, and collect actual runtime views.
Never layer the harbor on the old Cala fill. No runtime completion is claimed.
