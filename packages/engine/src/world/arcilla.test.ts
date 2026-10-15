import { HIDDEN_TAG } from '../ui/discovery';
import { WORLD_REGISTRY, type WorldObject, parseWorldConfig } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SHIP_CONFIG } from '../ship/config';
import { createShipState } from '../ship/controller';
import { WorldRuntime, solidObstaclesOf } from './runtime';

/**
 * El mar de Arcilla (T20) se puede navegar entero: ninguna isla, escollera o
 * roca cierra el paso a nada, y un teletransporte (o empezar junto a un
 * lugar) nunca deja el barco en tierra.
 */

const R = DEFAULT_SHIP_CONFIG.radius;

for (const id of WORLD_REGISTRY.ids()) {
  const world = WORLD_REGISTRY.get(id).config;
  const obstacles = solidObstaclesOf(world);
  const b = world.bounds;

  const onLand = (x: number, y: number, r = R) =>
    x < b.left + r ||
    x > b.right - r ||
    y < b.top + r ||
    y > b.bottom - r ||
    obstacles.some((o) => Math.hypot(x - o.x, y - o.y) < o.radius + r);

  /** Celdas de agua alcanzables desde la salida (inundación en rejilla). */
  function reachable(cell: number) {
    const cols = Math.ceil((b.right - b.left) / cell);
    const rows = Math.ceil((b.bottom - b.top) / cell);
    const cx = (i: number) => b.left + (i + 0.5) * cell;
    const cy = (j: number) => b.top + (j + 0.5) * cell;
    // Sólo se miran los obstáculos cerca de cada celda.
    const water = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) water[j * cols + i] = 1;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = cx(i);
        const y = cy(j);
        if (x < b.left + R || x > b.right - R || y < b.top + R || y > b.bottom - R) {
          water[j * cols + i] = 0;
        }
      }
    }
    for (const o of obstacles) {
      const reach = o.radius + R;
      const i0 = Math.max(0, Math.floor((o.x - reach - b.left) / cell));
      const i1 = Math.min(cols - 1, Math.floor((o.x + reach - b.left) / cell));
      const j0 = Math.max(0, Math.floor((o.y - reach - b.top) / cell));
      const j1 = Math.min(rows - 1, Math.floor((o.y + reach - b.top) / cell));
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          if (Math.hypot(cx(i) - o.x, cy(j) - o.y) < reach) water[j * cols + i] = 0;
        }
      }
    }
    const seen = new Uint8Array(cols * rows);
    const s = world.spawn!;
    const start = Math.floor((s.y - b.top) / cell) * cols + Math.floor((s.x - b.left) / cell);
    expect(water[start], 'la salida es agua').toBe(1);
    const queue = [start];
    seen[start] = 1;
    while (queue.length) {
      const k = queue.pop()!;
      const i = k % cols;
      const j = (k - i) / cols;
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const n = nj * cols + ni;
        if (seen[n] || !water[n]) continue;
        seen[n] = 1;
        queue.push(n);
      }
    }
    return { cols, rows, seen, cx, cy };
  }

  /** Hasta dónde hay que acercarse para que el lugar haga lo suyo. */
  function interactionRadius(o: WorldObject): number {
    const prox = o.geometry.proximityRadius;
    const touch = (o.geometry.activation?.radius ?? o.geometry.collision?.radius ?? 0) + R;
    const collect = o.behaviors.find((x) => x.type === 'collectible');
    const pick = collect?.type === 'collectible' ? (collect.params.radius ?? touch) + R : 0;
    return Math.max(prox ?? 0, touch, pick);
  }

  describe(`mar de ${id}`, () => {
    it('ninguna isla corta el paso: desde la salida se llega a cada lugar', () => {
      const cell = 16;
      const g = reachable(cell);
      const unreachable: string[] = [];
      for (const o of world.objects) {
        if (!o.identity.active) continue;
        // Decorado sin función (anillo, carriles, posidonia): no hace falta llegar.
        if (o.behaviors.every((x) => x.type === 'decorative' || x.type === 'collision')) continue;
        const r = interactionRadius(o);
        const i0 = Math.max(0, Math.floor((o.position.x - r - b.left) / cell));
        const i1 = Math.min(g.cols - 1, Math.floor((o.position.x + r - b.left) / cell));
        const j0 = Math.max(0, Math.floor((o.position.y - r - b.top) / cell));
        const j1 = Math.min(g.rows - 1, Math.floor((o.position.y + r - b.top) / cell));
        let ok = false;
        for (let i = i0; i <= i1 && !ok; i++) {
          for (let j = j0; j <= j1 && !ok; j++) {
            if (!g.seen[j * g.cols + i]) continue;
            if (Math.hypot(g.cx(i) - o.position.x, g.cy(j) - o.position.y) <= r) ok = true;
          }
        }
        if (!ok) unreachable.push(o.identity.id);
      }
      expect(unreachable).toEqual([]);
    });

    it('la salida del puerto (la bocana) está abierta y el mar sigue arriba', () => {
      const g = reachable(16);
      // Algo alcanzable por encima de la última isla: el mar abierto del norte.
      const north = Math.floor((world.bounds.top + 400 - b.top) / 16);
      let open = false;
      for (let i = 0; i < g.cols && !open; i++) open = g.seen[north * g.cols + i] === 1;
      expect(open).toBe(true);
    });

    it('un teletransporte nunca deja el barco en tierra', () => {
      const rt = new WorldRuntime(world);
      rt.step(createShipState(world.spawn!.x, world.spawn!.y), DEFAULT_SHIP_CONFIG, 1 / 60);
      const probes: { x: number; y: number }[] = [];
      for (const o of world.objects) probes.push({ x: o.position.x, y: o.position.y });
      for (const o of obstacles) probes.push({ x: o.x, y: o.y }, { x: o.x + 1, y: o.y - 1 });
      // Fuera del mapa y en las costas.
      probes.push({ x: b.left - 500, y: 0 }, { x: b.right + 500, y: b.bottom + 500 });
      let seed = 7;
      const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 400; k++) {
        probes.push({
          x: b.left + rand() * (b.right - b.left),
          y: b.top + rand() * (b.bottom - b.top),
        });
      }
      const bad = probes
        .map((p) => rt.safePoint(p.x, p.y, R))
        .filter((p) => onLand(p.x, p.y, R - 0.01));
      expect(bad).toEqual([]);
    });

    it('los secretos no salen en el mapa y todo lo demás sí existe en el mundo', () => {
      const cfg = parseWorldConfig(world);
      const secrets = cfg.objects.filter((o) => o.identity.category === 'secreto');
      expect(secrets.length).toBe(4);
      for (const s of secrets) expect(s.identity.tags).toContain(HIDDEN_TAG);
    });
  });
}
