import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseArtManifest, parseAssetRef, placePartArt } from '../../art';
import { coastAssets } from '../../schema';
import { manifestAssetExists } from '../check';
import { WORLD_REGISTRY } from '../catalog';
import { isEventPlace, parseSharedMap } from '../map';
import { PLACE_MARKERS } from '../place-art';
import {
  ARCILLA_MAP,
  ARCILLA_SKIN,
  BOTTLE_SPOTS,
  COAST_HALF_WIDTH,
  FACTOR,
  HALLOWEEN_PLACE_ID,
  HARBOR_PLACE_ID,
  HARBOR_REF,
  LOCAL_ANCHORS,
  TICKET_ISLAND_EVENTS,
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

/**
 * Los nombres que decidieron Hernán y Álvaro el 2026-10-02 para el mundo
 * principal; la Cala Cantalar es desde el 2026-10-04 el Puerto de Alicante (T108).
 */
const NAMES_2026_10_02: Record<string, string> = {
  cala: 'Puerto de Alicante',
  fotos: 'Isla de Benidorm',
  tienda: 'Ibiza',
  faro: 'Tabarca',
  canon: "L'Illeta dels Banyets",
  allday: 'Isla del Sonido',
  ultima: 'Isla de Nochevieja',
  halloween: 'Isla de Halloween',
  // Se quedan como estaban.
  puerto: 'El Varadero',
  naufrago: 'El náufrago',
  fiestera: 'El Remanso de los Cocodrilos',
  // El circuito: de El Freu a Los Rápidos (el id no cambia).
  circuito: 'Los Rápidos',
};
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
    // (`plan:Txx`: piezas añadidas después de la maqueta, como las del circuito cerrado de T61.)
    const dangling = [...claimed].filter(
      (r) => !r.startsWith('art:') && !r.startsWith('plan:') && resolve(r) === undefined,
    );
    expect(dangling).toEqual([]);
  });

  it('cada lugar está donde dice su fuente', () => {
    const composed = WORLD_REGISTRY.get('arcilla').config;
    for (const p of map.places) {
      const src = p.source[0];
      expect(src, p.id).toBeDefined();
      const point = sourcePoint(src!);
      if (!point) continue; // una ruta (las boies de carril): no tiene un punto
      const anchor = LOCAL_ANCHORS.find(
        ([prefix]) => p.id === prefix || p.id.startsWith(`${prefix}-`),
      );
      // El remanso se traslada entero respecto al ancla original de la fuente.
      const original =
        anchor?.[0] === 'fiestera' ? sourcePoint('zonas/fiestera/lugares/fiestera')! : anchor?.[1];
      const local =
        anchor && original
          ? ([
              anchor[1][0] + point[0] - original[0],
              anchor[1][1] + point[1] - original[1],
            ] as const)
          : point;
      const want = anchor ? near(anchor[1], local) : at(point);
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
    // Los secretos y los lugares aún sin pieza (la Isla de Halloween, T67).
    expect(markers.every((id) => id.startsWith('secreto-') || id in PLACE_MARKERS)).toBe(true);
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

  it('las islas de evento llevan el mismo nombre en todos los mundos', () => {
    const events = map.places.filter(isEventPlace).map((p) => p.id);
    expect(events.sort()).toEqual(Object.keys(TICKET_ISLAND_EVENTS).sort());
    for (const id of WORLD_REGISTRY.ids()) {
      for (const place of events) expect(WORLD_REGISTRY.skin(id).names[place]).toBeUndefined();
    }
    // Los nombres propios son claves i18n (T195); su texto se comprueba en la web (islas-entradas.test.ts).
    expect(ARCILLA_SKIN.names?.puerto).toBe('world.arcilla.skin.name.puerto');
  });

  it('la zona de la Fiestera no pisa la del Puerto de Alicante ni la del puerto de salida', () => {
    const area = (id: string) => map.sectors.find((s) => s.id === id)!.area;
    const overlap = (a: string, b: string) => {
      const p = area(a);
      const q = area(b);
      return p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom;
    };
    expect(overlap('fiestera', HARBOR_PLACE_ID)).toBe(false);
    expect(overlap('fiestera', 'puerto')).toBe(false);
    expect(overlap(HARBOR_PLACE_ID, 'puerto')).toBe(false);
  });

  it('nombres de Arcilla del 2026-10-02: islas del Mediterráneo y Los Rápidos', () => {
    const arcilla = WORLD_REGISTRY.get('arcilla');
    const name = (id: string) => arcilla.places.find((p) => p.id === id)?.name;
    // Los nombres propios (puerto, fiestera, circuito) son claves i18n (T195):
    // su texto se comprueba en la web, en islas-entradas.test.ts.
    const own = Object.keys(ARCILLA_SKIN.names ?? {});
    const literal = Object.keys(NAMES_2026_10_02).filter((id) => !own.includes(id));
    expect(Object.fromEntries(literal.map((id) => [id, name(id)]))).toEqual(
      Object.fromEntries(literal.map((id) => [id, NAMES_2026_10_02[id]])),
    );
  });

  it('el Puerto de Alicante (T108): conserva el id `cala` y se llama igual en los dos mundos', () => {
    expect(HARBOR_PLACE_ID).toBe('cala');
    const shared = map.places.find((p) => p.id === HARBOR_PLACE_ID)!;
    expect(shared.name).toBe('Puerto de Alicante');
    expect(map.sectors.find((s) => s.id === HARBOR_PLACE_ID)?.name).toBe(shared.name);
    for (const id of WORLD_REGISTRY.ids()) {
      const o = WORLD_REGISTRY.get(id).config.objects.find(
        (x) => x.identity.id === HARBOR_PLACE_ID,
      )!;
      expect(o.identity.name, id).toBe(shared.name);
      expect(o.identity.category, id).toBe('isla');
      // Su ficha es la de un lugar (`info`) que ofrece cambiar de barco, sin evento.
      const content = o.behaviors.filter((b) => b.type === 'content');
      expect(
        content.map((b) => b.params),
        id,
      ).toEqual([expect.objectContaining({ target: 'info', ref: HARBOR_REF })]);
      expect(
        o.behaviors.some((b) => b.type === 'ticket'),
        id,
      ).toBe(false);
    }
  });

  it('la Isla de Halloween: isla con entradas en mar libre, lejos de las demás', () => {
    const h = map.places.find((p) => p.id === HALLOWEEN_PLACE_ID)!;
    expect(h).toMatchObject({ category: 'isla', name: 'Isla de Halloween', active: true });
    const ticket = h.behaviors.find((b) => b.type === 'ticket');
    const content = h.behaviors.find((b) => b.type === 'content');
    expect(ticket?.params).toMatchObject({ eventId: TICKET_ISLAND_EVENTS.halloween });
    expect(content?.params).toMatchObject({ target: 'event', ref: TICKET_ISLAND_EVENTS.halloween });
    // Dentro del mar y a más de 6 u_maq (× POS) de cualquier otra isla.
    const b = map.bounds;
    expect(h.position.x).toBeGreaterThan(b.left);
    expect(h.position.x).toBeLessThan(b.right);
    expect(h.position.y).toBeGreaterThan(b.top);
    expect(h.position.y).toBeLessThan(b.bottom);
    for (const o of map.places.filter((p) => p.category === 'isla' && p.id !== h.id)) {
      const d = Math.hypot(o.position.x - h.position.x, o.position.y - h.position.y);
      expect(d / POS, o.id).toBeGreaterThan(6);
    }
  });
});
