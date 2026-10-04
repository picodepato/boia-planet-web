import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseAssetRef } from '../../art';
import { coastAssets } from '../../schema';
import { ARCILLA_WORLD_ID } from '../arcilla';
import { WORLD_REGISTRY } from '../catalog';
import { manifestAssetExists } from '../check';
import { isEventPlace } from '../map';
import { PLACE_MARKERS } from '../place-art';
import { ACUARELA_NAMES, ACUARELA_WORLD_ID } from '.';

/**
 * Acuarela en el juego (T24): el segundo mundo sobre el mapa compartido. Cada
 * lugar tiene su piel de Acuarela con el arte de T19, está donde está en
 * Arcilla y se comporta igual; mover un lugar lo mueve en los dos mundos.
 * Las comprobaciones leen los datos (mapa, skins, lugares.json, art/), no
 * listas escritas a mano.
 */

const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const readArt = (base: string): unknown => {
  try {
    return JSON.parse(readFileSync(path.join(ROOT, 'art', base, 'manifest.json'), 'utf8'));
  } catch {
    return null;
  }
};
const exists = manifestAssetExists(readArt);
const lugares = JSON.parse(
  readFileSync(path.join(ROOT, 'mundos/acuarela/lugares.json'), 'utf8'),
) as {
  mar: { base: string; ola: string; cresta: string };
  lugares: { id: string; nombre: string }[];
};
const catalog = JSON.parse(readFileSync(path.join(ROOT, 'tools/blender/lugares.json'), 'utf8')) as {
  lugares: { id: string }[];
};

const arcilla = WORLD_REGISTRY.get(ARCILLA_WORLD_ID);
const acuarela = WORLD_REGISTRY.get(ACUARELA_WORLD_ID);
const objectIn = (w: typeof arcilla, id: string) =>
  w.config.objects.find((o) => o.identity.id === id);

describe('Acuarela sobre el mapa compartido (T24)', () => {
  it('está registrada junto a Arcilla, con su barco B02 y su mar', () => {
    expect(WORLD_REGISTRY.ids()).toContain(ACUARELA_WORLD_ID);
    expect(WORLD_REGISTRY.defaultId).toBe(ARCILLA_WORLD_ID);
    expect(acuarela.theme.ship.style).toBe('acuarela');
    expect(acuarela.theme.ship.style).not.toBe(arcilla.theme.ship.style);
    const sea = lugares.mar;
    expect(acuarela.theme.sea).toEqual({
      base: sea.base.toLowerCase(),
      wave: sea.ola.toLowerCase(),
      crest: sea.cresta.toLowerCase(),
    });
    // Oculta (T122): sigue registrada y con su piel, pero fuera del selector.
    expect(WORLD_REGISTRY.isPlayable(ACUARELA_WORLD_ID)).toBe(false);
    expect(WORLD_REGISTRY.list().some((w) => w.id === ACUARELA_WORLD_ID)).toBe(false);
    expect(acuarela.theme.name).toBeTruthy();
    expect(WORLD_REGISTRY.skin(ACUARELA_WORLD_ID).tagline).toMatch(/Sant Joan/);
    expect(WORLD_REGISTRY.skin(ACUARELA_WORLD_ID).ship.style).toBe('acuarela');
  });

  it('cada lugar del mapa compartido tiene piel de Acuarela con arte de T19', () => {
    expect(acuarela.places).toHaveLength(WORLD_REGISTRY.map.places.length);
    for (const p of acuarela.places) {
      expect(p.status, p.id).toBe('skin');
      if (p.asset!.startsWith('placeholder:')) {
        // Sólo los secretos y los lugares aún sin pieza (la Isla de Halloween,
        // T67), sin arte en ningún mundo todavía (como en Arcilla).
        expect(p.id.startsWith('secreto-') || p.id in PLACE_MARKERS, p.id).toBe(true);
        continue;
      }
      expect(parseAssetRef(p.asset!).base, p.id).toMatch(/^mundos\/acuarela\//);
      expect(exists(p.asset!), `${p.id}: ${p.asset}`).toBe(true);
    }
    for (const a of coastAssets(acuarela.config.coast)) expect(exists(a), a).toBe(true);
    expect(coastAssets(acuarela.config.coast)).toHaveLength(
      coastAssets(arcilla.config.coast).length,
    );
  });

  it('la misma pieza que en Arcilla, en la carpeta de Acuarela', () => {
    for (const p of acuarela.places) {
      const a = arcilla.places.find((x) => x.id === p.id)!;
      expect(p.asset!.replace('mundos/acuarela/', 'mundos/arcilla/'), p.id).toBe(a.asset);
    }
  });

  it('usa el arte de cada lugar del catálogo con piezas en el mapa', () => {
    const used = new Set(
      acuarela.places
        .filter((p) => !p.asset!.startsWith('placeholder:'))
        .map((p) => parseAssetRef(p.asset!).base.split('/')[2]),
    );
    for (const c of coastAssets(acuarela.config.coast))
      used.add(parseAssetRef(c).base.split('/')[2]);
    // Las botellas las pinta la web (T22) con su propia pieza, no un lugar del mapa.
    const expected = catalog.lugares.map((l) => l.id).filter((id) => id !== 'botellas');
    expect([...used].sort()).toEqual(expected.sort());
  });

  it('cada lugar está en el mismo sitio y se comporta igual que en Arcilla', () => {
    expect(acuarela.config.objects.map((o) => o.identity.id)).toEqual(
      arcilla.config.objects.map((o) => o.identity.id),
    );
    for (const o of acuarela.config.objects) {
      const a = objectIn(arcilla, o.identity.id)!;
      expect(o.position, o.identity.id).toEqual(a.position);
      expect(o.geometry, o.identity.id).toEqual(a.geometry);
      expect(o.identity.category).toBe(a.identity.category);
      expect(
        o.behaviors.map((b) => b.type),
        o.identity.id,
      ).toEqual(a.behaviors.map((b) => b.type));
      // Salvo los bocadillos, los parámetros son los mismos (premios, minijuegos, eventos…).
      const params = (w: typeof o) =>
        w.behaviors.filter((b) => b.type !== 'dialogue').map((b) => b.params);
      expect(params(o), o.identity.id).toEqual(params(a));
    }
    expect(acuarela.config.bounds).toEqual(arcilla.config.bounds);
    expect(acuarela.config.spawn).toEqual(arcilla.config.spawn);
  });

  it('mover un lugar lo mueve en Arcilla y en Acuarela', () => {
    const id = 'naufrago';
    const was = objectIn(arcilla, id)!.position;
    const moved = WORLD_REGISTRY.movePlace(id, was.x + 120, was.y - 80);
    for (const w of [ARCILLA_WORLD_ID, ACUARELA_WORLD_ID]) {
      const now = objectIn(moved.get(w), id)!.position;
      expect({ x: now.x, y: now.y }, w).toEqual({ x: was.x + 120, y: was.y - 80 });
    }
    // Lo demás no se mueve, y el registro original queda igual.
    expect(objectIn(moved.get(ACUARELA_WORLD_ID), 'allday')!.position).toEqual(
      objectIn(acuarela, 'allday')!.position,
    );
    expect(objectIn(WORLD_REGISTRY.get(ACUARELA_WORLD_ID), id)!.position).toEqual(was);
    expect(() => WORLD_REGISTRY.movePlace('isla-fantasma', 0, 0)).toThrow(/desconocido/);
  });

  it('nombres de lugares.json; las islas de evento conservan el nombre compartido', () => {
    for (const [id, name] of Object.entries(ACUARELA_NAMES)) {
      const src = lugares.lugares.find((l) => l.id === id || id.startsWith(`${l.id}-`));
      if (src) expect(name, id).toBe(src.nombre);
    }
    for (const place of WORLD_REGISTRY.map.places.filter(isEventPlace)) {
      expect(objectIn(acuarela, place.id)!.identity.name).toBe(place.name);
      expect(objectIn(acuarela, place.id)!.identity.name).toBe(
        objectIn(arcilla, place.id)!.identity.name,
      );
    }
    // Las tres islas con entradas, con el mismo nombre en los dos mundos (2026-10-02).
    const events = WORLD_REGISTRY.map.places.filter(isEventPlace).map((p) => p.id);
    expect(events.sort()).toEqual(['allday', 'halloween', 'ultima']);
    expect(
      ['halloween', 'allday', 'ultima'].map((id) => objectIn(acuarela, id)!.identity.name),
    ).toEqual(['Isla de Halloween', 'Isla del Sonido', 'Isla de Nochevieja']);
    // Los sitios con nombre propio se llaman distinto que en Arcilla (el
    // Puerto de Alicante, antes la Cala Cantalar, se llama igual en los dos).
    for (const id of ['puerto', 'fiestera', 'fotos', 'tienda', 'faro', 'canon']) {
      expect(objectIn(acuarela, id)!.identity.name).not.toBe(objectIn(arcilla, id)!.identity.name);
    }
  });

  it('Faro y Cañón abren el mismo minijuego en los dos mundos', () => {
    const games = (w: typeof arcilla) =>
      w.config.objects.flatMap((o) =>
        o.behaviors
          .filter((b) => b.type === 'start_minigame')
          .map((b) => `${o.identity.id}:${(b.params as { gameId: string }).gameId}`),
      );
    expect(games(acuarela).length).toBeGreaterThanOrEqual(2);
    expect(games(acuarela)).toEqual(games(arcilla));
  });
});
