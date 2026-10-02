import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseArtManifest, parseAssetRef, placePartArt } from '../../art';
import { coastAssets } from '../../schema';
import { manifestAssetExists } from '../check';
import { WORLD_REGISTRY } from '../catalog';
import { parseSharedMap } from '../map';
import {
  ARCILLA_MAP,
  ARCILLA_SKIN,
  BOTTLE_SPOTS,
  COAST_HALF_WIDTH,
  FACTOR,
  LOCAL_ANCHORS,
  type Maq,
  POS,
  U,
  at,
  near,
} from '.';

/**
 * El mapa compartido contra su fuente, `mundos/arcilla/mapa.json` (T20): cada
 * lugar de la maqueta está en los datos del mundo, en su sitio, y el arte
 * de Arcilla (T18) cubre cada lugar.
 */

const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
type Json = Record<string, unknown>;
const mapa = JSON.parse(readFileSync(path.join(ROOT, 'mundos/arcilla/mapa.json'), 'utf8')) as Json;
const readArt = (base: string): unknown => {
  try {
    return JSON.parse(readFileSync(path.join(ROOT, 'art', base, 'manifest.json'), 'utf8'));
  } catch {
    return null;
  }
};

const map = parseSharedMap(ARCILLA_MAP);
const arr = (v: unknown) => (Array.isArray(v) ? (v as Json[]) : []);
const isPoint = (v: unknown): v is Maq =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number');

/** Todas las entradas de mapa.json que son lugares o partes de un lugar. */
function mapaEntries(): string[] {
  const out: string[] = [];
  for (const z of arr(mapa.zonas)) {
    const id = z.id as string;
    out.push(`zonas/${id}`);
    for (const l of arr(z.lugares)) out.push(`zonas/${id}/lugares/${l.id as string}`);
    for (const i of arr(z.islas)) out.push(`zonas/${id}/islas/${i.id as string}`);
    for (const p of arr(z.proximidad)) out.push(`zonas/${id}/proximidad/${p.objeto as string}`);
    arr(z.restos).forEach((_, i) => out.push(`zonas/${id}/restos/${i}`));
  }
  for (const m of arr(mapa.minijuegos)) out.push(`minijuegos/${m.id as string}`);
  arr(mapa.secretos).forEach((_, i) => out.push(`secretos/${i}`));
  const c = mapa.circuito as Json;
  out.push('circuito/salida', 'circuito/meta', 'circuito/cartel_atajo');
  for (const rama of ['comun', 'segura', 'atajo', 'final']) out.push(`circuito/${rama}`);
  arr(c.checkpoints).forEach((_, i) => out.push(`circuito/checkpoints/${i}`));
  arr(c.obstaculos).forEach((_, i) => out.push(`circuito/obstaculos/${i}`));
  return out;
}

/** La entrada de mapa.json de una ruta (`zonas/cala/islas/isla`, `circuito/checkpoints/0`…). */
function resolve(ref: string): unknown {
  const [head, ...rest] = ref.split('/');
  let node: unknown = mapa[head!];
  for (const key of rest) {
    if (Array.isArray(node)) {
      node = /^\d+$/.test(key)
        ? node[Number(key)]
        : (node as Json[]).find((x) => x.id === key || x.objeto === key);
    } else if (node && typeof node === 'object') {
      node = (node as Json)[key];
    } else {
      return undefined;
    }
  }
  return node;
}

/** El punto (u_maq) de una fuente: `pos`, `centro`, un punto suelto o `map_pos` del arte. */
function sourcePoint(ref: string): Maq | null {
  if (ref.startsWith('art:')) {
    const { base, part } = parseAssetRef(`mundos/arcilla/${ref.slice(4)}`);
    const m = readArt(base) as { parts: Json[] } | null;
    const p = m?.parts.find((x) => x.id === part);
    return isPoint(p?.map_pos) ? p.map_pos : null;
  }
  const e = resolve(ref);
  if (isPoint(e)) return e;
  if (e && typeof e === 'object') {
    const o = e as Json;
    if (isPoint(o.pos)) return o.pos;
    if (isPoint(o.centro)) return o.centro;
  }
  return null;
}

describe('mapa compartido de Arcilla (T20)', () => {
  it('usa las unidades de mapa.json', () => {
    const u = mapa.unidades as Json;
    const r = mapa.ritmo as Json;
    expect(U).toBe(u.u_motor_por_u_maq);
    expect(FACTOR).toBe(r.factor_juego);
    expect(POS).toBeCloseTo(U * FACTOR, 6);
  });

  it('cada lugar de mapa.json está en los datos del mundo', () => {
    const claimed = new Set([
      ...map.places.flatMap((p) => p.source),
      ...BOTTLE_SPOTS.flatMap((b) => b.source),
      ...map.sectors.map((s) => `zonas/${s.id}`),
    ]);
    const missing = mapaEntries().filter((e) => !claimed.has(e));
    expect(missing).toEqual([]);
    // Y lo que el mundo dice sacar de mapa.json existe de verdad.
    const dangling = [...claimed].filter((r) => !r.startsWith('art:') && resolve(r) === undefined);
    expect(dangling).toEqual([]);
  });

  it('cada lugar está donde dice su fuente', () => {
    const composed = WORLD_REGISTRY.get('arcilla').config;
    for (const p of map.places) {
      const src = p.source[0];
      expect(src, p.id).toBeDefined();
      const point = sourcePoint(src!);
      if (!point) continue; // una ruta (las boies de carril): no tiene un punto
      const anchor = LOCAL_ANCHORS.find(([prefix]) => p.id === prefix || p.id.startsWith(`${prefix}-`));
      const want = anchor ? near(anchor[1], point) : at(point);
      expect(p.position.x, p.id).toBeCloseTo(want.x, 1);
      expect(p.position.y, p.id).toBeCloseTo(want.y, 1);
      // Y el mundo compuesto lo lleva igual, con su id estable.
      const o = composed.objects.find((x) => x.identity.id === p.id);
      expect(o?.position.x, p.id).toBe(p.position.x);
    }
  });

  it('las costas siguen las líneas de mapa.json y el borde de arriba queda abierto', () => {
    const b = map.bounds;
    const line = (id: string) =>
      (arr(mapa.costas).find((c) => c.id === id)!.linea as Maq[]).map(([x, y]) => [x, y]);
    expect(line('costa_oeste')[0]![0]).toBe(-15);
    // Oeste y este: a ±15 u_maq × factor (0,5 % menos para cuadrar las losas).
    expect(Math.abs(COAST_HALF_WIDTH - 15 * POS) / (15 * POS)).toBeLessThan(0.01);
    expect(b.left).toBeGreaterThan(-COAST_HALF_WIDTH);
    expect(b.right).toBeLessThan(COAST_HALF_WIDTH);
    expect(b.top).toBeCloseTo(line('borde_arriba')[0]![1]! * POS, 1);
    // El borde de abajo es el paseo del puerto, a 1:1 del anillo de salida.
    expect(b.bottom).toBeGreaterThan(map.spawn.y);
    expect(b.bottom - map.spawn.y).toBeLessThan((27.8 - 25.3) * U);
    expect(map.port?.place).toBe('puerto');
  });

  it('Arcilla tiene arte de T18 para cada lugar (o un marcador a propósito)', () => {
    const exists = manifestAssetExists(readArt);
    const w = WORLD_REGISTRY.get('arcilla');
    const missing = w.places.filter(
      (p) => p.asset && !p.asset.startsWith('placeholder:') && !exists(p.asset),
    );
    expect(missing).toEqual([]);
    expect(w.places.every((p) => p.status === 'skin')).toBe(true);
    const markers = w.places.filter((p) => p.asset?.startsWith('placeholder:')).map((p) => p.id);
    expect(markers.every((id) => id.startsWith('secreto-'))).toBe(true);
    for (const a of coastAssets(w.config.coast)) expect(exists(a), a).toBe(true);
  });

  it('las piezas de lugar se leen como sprites y losas', () => {
    const m = parseArtManifest(readArt('mundos/arcilla/puerto'));
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    const boia = placePartArt(m.manifest, 'boia')!;
    expect(boia.kind).toBe('sprite');
    expect(boia.pivot_px).toBeDefined();
    expect(boia.images.length).toBeGreaterThan(0);
    expect(placePartArt(m.manifest, 'nada')).toBeNull();
    const sur = parseArtManifest(readArt('mundos/arcilla/costa_sur'));
    if (!sur.ok) throw new Error(sur.error);
    expect(placePartArt(sur.manifest, 'costa_sur')!.strip?.land_side).toBe('bottom');
    expect(placePartArt(sur.manifest, 'esquina_oeste')!.corner?.land).toContain('left');
    const restos = parseArtManifest(readArt('mundos/arcilla/restos'));
    if (!restos.ok) throw new Error(restos.error);
    const b = placePartArt(restos.manifest, 'restos', 'b')!;
    expect(b.images.map((i) => i.file)).toEqual(['restos_b.png']);
  });

  it('la isla de evento lleva el mismo nombre en todos los mundos', () => {
    for (const id of WORLD_REGISTRY.ids()) {
      expect(WORLD_REGISTRY.skin(id).names.allday).toBeUndefined();
    }
    expect(ARCILLA_SKIN.names?.puerto).toBe('El Varadero');
  });
});
