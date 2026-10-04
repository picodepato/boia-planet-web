// Read-only camera evidence inputs from the current /mar world. No runtime registration.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { WORLD_REGISTRY } from '../../../packages/world/src/worlds/catalog.ts';
import { marWorld } from '../../../apps/web/app/mar/engine/compact.ts';
import { toScene } from '../../../apps/web/app/mar/engine/compress.ts';
import { planetRect } from '../../../apps/web/app/mar/engine/wrap.ts';
import { startZoom, lookAhead } from '../../../apps/web/app/mar/engine/framing.ts';

const source = readFileSync('apps/web/app/mar/engine/mar3d.ts', 'utf8');
const constant = (name) => {
  const match = source.match(new RegExp(`const ${name} = ([\\d.]+);`));
  if (!match) throw new Error(`Camera constant not found: ${name}`);
  return Number(match[1]);
};
const world = marWorld(WORLD_REGISTRY.resolve().config);
const radius = toScene(world.objects.find((o) => o.identity.id === 'cala').geometry.collision.radius);
const rect = planetRect(world.bounds);
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const aspect = 1000 / 750;
const fov = 40;
const zoom = startZoom(aspect);
const tangent = Math.tan((fov * Math.PI) / 360);
const far = Math.max(toScene(rect.bottom - rect.top) * 0.56 / tangent,
  toScene(rect.right - rect.left) * 0.54 / (tangent * aspect));
const near = constant('dNear');
const distance = near * (far / near) ** zoom;
const elev = constant('ELEV_NEAR') + (1.28 - constant('ELEV_NEAR')) * smooth(0, 1, zoom);
// Stationary boat at 1.7 island radii on the +Z exterior approach; zero UI inset/pan/kick.
const focus = 1.7 * radius - distance * lookAhead(aspect).ahead;
const result = {
  fov_vertical_degrees: fov, aspect, zoom, radius, d_far: far,
  camera_distance_scene: distance, elevation_radians: elev, boat_distance_radii: 1.7,
  location_blender: [0, -(focus + Math.cos(elev) * distance) / radius, Math.sin(elev) * distance / radius],
  target_blender: [0, -focus / radius, 0],
  source: 'mar3d.ts updateCamera/resize, compact.marWorld, framing.startZoom/lookAhead',
  limitation: 'Flat asset preview: omits GPU planet curvature, fog, UI inset, motion lead and runtime lighting; live captures belong to T108.',
};
const output = process.argv[2] ?? 'node_modules/t107-preview/distance-camera.json';
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
