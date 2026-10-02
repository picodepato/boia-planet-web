import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MUESTRA_SKIN, PRUEBA_SKIN, SAMPLE_MAP, SAMPLE_WORLD } from '../sample-world';
import { parseWorldConfig } from '../schema';
import { WORLD_REGISTRY } from './catalog';
import { checkWorlds, formatCheck, manifestAssetExists } from './check';
import { MISSING_SKIN_ASSET, SkinError, composeWorld, renamePlace } from './compose';
import { REMOVED, registry as removedSkinRegistry } from './fixtures/sin-skin';
import { type SharedMapInput, isEventPlace, parseSharedMap } from './map';
import { WorldRegistry } from './registry';
import {
  ACTIVE_WORLD_STORAGE_KEY,
  WORLD_STORAGE_KEY,
  activeWorld,
  chooseWorld,
  storedWorldChoice,
} from './selection';
import { WorldSkin, conventionAsset } from './skin';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const ART = path.join(ROOT, 'art');
const artExists = manifestAssetExists((base) => {
  const file = path.join(ART, base, 'manifest.json');
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as unknown) : null;
});
/** El mapa de los mundos que se juegan (T20: el de Arcilla). */
const played = WORLD_REGISTRY.map;

const map = parseSharedMap(SAMPLE_MAP);
const skins = [WorldSkin.parse(MUESTRA_SKIN), WorldSkin.parse(PRUEBA_SKIN)];

/** Una copia del mapa de muestra con un lugar movido. */
function movedMap(id: string, dx: number, dy: number): SharedMapInput {
  return {
    ...SAMPLE_MAP,
    places: SAMPLE_MAP.places.map((p) =>
      p.id === id
        ? { ...p, position: { ...p.position, x: p.position.x + dx, y: p.position.y + dy } }
        : p,
    ),
  };
}

class MapStorage {
  readonly data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe('mapa compartido y mundos (D-20)', () => {
  it('dos mundos registrados tienen los mismos lugares en el mismo sitio, cada uno con su skin y su barco', () => {
    expect(WORLD_REGISTRY.ids().length).toBeGreaterThanOrEqual(2);
    const [a, b] = WORLD_REGISTRY.ids().map((id) => WORLD_REGISTRY.get(id));
    const ids = played.places.map((p) => p.id);
    for (const w of [a!, b!]) {
      expect(w.config.objects.map((o) => o.identity.id)).toEqual(ids);
      for (const o of w.config.objects) {
        const place = played.places.find((p) => p.id === o.identity.id)!;
        expect(o.position).toEqual(place.position);
        expect(o.geometry).toEqual(place.geometry);
        // Los mismos comportamientos (una skin sólo puede cambiar el texto de los bocadillos).
        expect(o.behaviors.map((x) => x.type)).toEqual(place.behaviors.map((x) => x.type));
      }
    }
    // Pieles distintas: algún asset cambia y el barco, el mar y el acento son del mundo.
    const assets = (w: typeof a) => w!.config.objects.map((o) => o.appearance.asset);
    expect(assets(a)).not.toEqual(assets(b));
    expect(a!.theme.ship.style).not.toBe(b!.theme.ship.style);
    expect(a!.theme.sea).not.toEqual(b!.theme.sea);
    expect(a!.theme.ui.accent).not.toBe(b!.theme.ui.accent);
    expect(WORLD_REGISTRY.list().map((s) => s.shipStyle)).toEqual(
      WORLD_REGISTRY.ids().map((id) => WORLD_REGISTRY.skin(id).ship.style),
    );
  });

  it('mover un lugar en el mapa compartido lo mueve en todos los mundos', () => {
    const id = SAMPLE_MAP.places.at(-1)!.id;
    const before = new WorldRegistry(SAMPLE_MAP, skins);
    const after = new WorldRegistry(movedMap(id, 37, -52), skins);
    for (const w of after.ids()) {
      const was = before.get(w).config.objects.find((o) => o.identity.id === id)!;
      const now = after.get(w).config.objects.find((o) => o.identity.id === id)!;
      expect(now.position.x - was.position.x).toBe(37);
      expect(now.position.y - was.position.y).toBe(-52);
    }
    const positions = after
      .ids()
      .map((w) => after.get(w).config.objects.find((o) => o.identity.id === id)!.position);
    for (const p of positions) expect(p).toEqual(positions[0]);
  });

  it('una skin de un lugar que no está en el mapa se rechaza', () => {
    const bad = WorldSkin.parse({
      ...PRUEBA_SKIN,
      places: { ...PRUEBA_SKIN.places, 'isla-fantasma': { asset: 'roca-a' } },
    });
    expect(() => composeWorld(map, bad)).toThrow(SkinError);
    expect(() => new WorldRegistry(SAMPLE_MAP, [MUESTRA_SKIN, bad])).toThrow(/isla-fantasma/);
    const badName = WorldSkin.parse({ ...PRUEBA_SKIN, names: { 'isla-fantasma': 'Nada' } });
    expect(() => composeWorld(map, badName)).toThrow(/isla-fantasma/);
  });

  it('un lugar sin skin se ve con el marcador y se comporta igual; sólo `hidden` lo quita', () => {
    const id = 'isla-pequena-1';
    const places = { ...PRUEBA_SKIN.places };
    delete places[id];
    const missing = composeWorld(map, WorldSkin.parse({ ...PRUEBA_SKIN, places }));
    const o = missing.config.objects.find((x) => x.identity.id === id)!;
    expect(o.appearance.asset).toBe(MISSING_SKIN_ASSET);
    expect(o.behaviors).toEqual(map.places.find((p) => p.id === id)!.behaviors);
    expect(missing.places.find((p) => p.id === id)!.status).toBe('missing');

    const hidden = composeWorld(
      map,
      WorldSkin.parse({ ...PRUEBA_SKIN, places: { ...places, [id]: { hidden: true } } }),
    );
    expect(hidden.config.objects.some((x) => x.identity.id === id)).toBe(false);
    expect(hidden.places.find((p) => p.id === id)!.status).toBe('hidden');
  });

  it('sin asset, la skin usa la carpeta del mundo: art/mundos/<mundo>/<lugar>', () => {
    const w = composeWorld(
      map,
      WorldSkin.parse({ ...PRUEBA_SKIN, places: { ...PRUEBA_SKIN.places, 'roca-1': {} } }),
    );
    const rock = w.config.objects.find((o) => o.identity.id === 'roca-1')!;
    expect(rock.appearance.asset).toBe(conventionAsset('prueba', 'roca-1'));
    expect(rock.appearance.asset).toBe('mundos/prueba/roca-1');
  });

  it('los bocadillos de la skin sustituyen a los del DIÁLOGO; en un lugar sin DIÁLOGO se rechazan', () => {
    const lines = ['Hola desde otro mundo.'];
    const w = composeWorld(
      map,
      WorldSkin.parse({
        ...PRUEBA_SKIN,
        places: { ...PRUEBA_SKIN.places, 'boia-tutorial': { asset: 'boia-tutorial', lines } },
      }),
    );
    const boia = w.config.objects.find((o) => o.identity.id === 'boia-tutorial')!;
    const d = boia.behaviors.find((b) => b.type === 'dialogue');
    expect(d?.type === 'dialogue' && d.params.lines.map((l) => l.text)).toEqual(lines);
    expect(() =>
      composeWorld(
        map,
        WorldSkin.parse({
          ...PRUEBA_SKIN,
          places: { ...PRUEBA_SKIN.places, 'roca-1': { asset: 'roca-a', lines } },
        }),
      ),
    ).toThrow(/DIÁLOGO/);
  });

  it('el mundo `muestra` sigue siendo el de la demo de plan 001; se juega Arcilla', () => {
    const muestra = new WorldRegistry(SAMPLE_MAP, skins).get('muestra');
    expect(parseWorldConfig(SAMPLE_WORLD)).toEqual(muestra.config);
    expect(muestra.config.id).toBe(`muestra-${map.id}`);
    expect(WORLD_REGISTRY.defaultId).toBe('arcilla');
    expect(WORLD_REGISTRY.map.id).not.toBe(map.id);
  });
});

describe('nombres: común y propio de cada mundo', () => {
  const eventPlace = map.places.find(isEventPlace)!;
  const other = map.places.find((p) => !isEventPlace(p) && p.category === 'isla')!;
  const nameIn = (r: WorldRegistry, w: string, id: string) =>
    r.get(w).config.objects.find((o) => o.identity.id === id)!.identity.name;

  it('en los datos que se juegan las islas de evento o entradas sólo llevan el nombre común', () => {
    expect(eventPlace).toBeDefined();
    const events = played.places.filter(isEventPlace);
    expect(events.length).toBeGreaterThan(0);
    for (const id of WORLD_REGISTRY.ids()) {
      for (const p of events) {
        expect(WORLD_REGISTRY.skin(id).names[p.id], `${id}/${p.id}`).toBeUndefined();
        expect(nameIn(WORLD_REGISTRY, id, p.id)).toBe(p.name);
      }
    }
    // El resto puede llamarse distinto en cada mundo (alguna isla lo hace).
    const islands = played.places.filter((p) => !isEventPlace(p) && p.category === 'isla');
    const differs = islands.some(
      (island) =>
        new Set(WORLD_REGISTRY.ids().map((id) => nameIn(WORLD_REGISTRY, id, island.id))).size > 1,
    );
    expect(differs).toBe(true);
  });

  it('renombrar con alcance `world` cambia sólo ese mundo', () => {
    const r = new WorldRegistry(SAMPLE_MAP, skins).renamePlace(
      eventPlace.id,
      'Isla de la Primavera',
      { world: 'prueba' },
    );
    expect(nameIn(r, 'prueba', eventPlace.id)).toBe('Isla de la Primavera');
    expect(nameIn(r, 'muestra', eventPlace.id)).toBe(eventPlace.name);
    expect(r.map.places.find((p) => p.id === eventPlace.id)!.name).toBe(eventPlace.name);
  });

  it('renombrar con alcance `all` cambia el común y quita los nombres propios', () => {
    const base = new WorldRegistry(SAMPLE_MAP, skins);
    expect(nameIn(base, 'prueba', other.id)).not.toBe(nameIn(base, 'muestra', other.id));
    const r = base.renamePlace(other.id, 'Isla del Medio', 'all');
    for (const w of r.ids()) {
      expect(nameIn(r, w, other.id)).toBe('Isla del Medio');
      expect(r.skin(w).names[other.id]).toBeUndefined();
    }
    expect(r.map.places.find((p) => p.id === other.id)!.name).toBe('Isla del Medio');
    // Sin mutar lo de antes.
    expect(nameIn(base, 'prueba', other.id)).toBe(PRUEBA_SKIN.names![other.id]);
  });

  it('renombrar rechaza lugares, mundos o nombres vacíos', () => {
    expect(() => renamePlace(map, skins, 'nada', 'X', 'all')).toThrow(/lugar/);
    expect(() => renamePlace(map, skins, other.id, 'X', { world: 'nada' })).toThrow(/mundo/);
    expect(() => renamePlace(map, skins, other.id, '  ', 'all')).toThrow(/nombre/);
  });
});

describe('elección de mundo', () => {
  it('URL, después el visitante, después el Admin, después el por defecto; ids desconocidos se saltan', () => {
    const s = new MapStorage();
    const visitor = storedWorldChoice(s, WORLD_STORAGE_KEY);
    const admin = storedWorldChoice(s, ACTIVE_WORLD_STORAGE_KEY);
    const pick = (search = '') => activeWorld(WORLD_REGISTRY, { search, visitor, admin }).id;
    const [first, second] = WORLD_REGISTRY.ids() as [string, string];
    expect(pick()).toBe(WORLD_REGISTRY.defaultId);
    admin.set(second);
    expect(pick()).toBe(second);
    visitor.set(first);
    expect(pick()).toBe(first);
    expect(pick(`?mundo=${second}`)).toBe(second);
    expect(pick('?mundo=nada')).toBe(first);
    visitor.set('nada');
    expect(pick()).toBe(second);
  });

  it('elegir un mundo desconocido no guarda nada', () => {
    const s = new MapStorage();
    const visitor = storedWorldChoice(s, WORLD_STORAGE_KEY);
    expect(chooseWorld(WORLD_REGISTRY, visitor, 'nada')).toBeNull();
    expect(visitor.get()).toBeNull();
    const id = WORLD_REGISTRY.ids().at(-1)!;
    expect(chooseWorld(WORLD_REGISTRY, visitor, id)?.id).toBe(id);
    expect(s.getItem(WORLD_STORAGE_KEY)).toBe(id);
  });

  it('sin almacenamiento la elección vale para la visita', () => {
    const c = storedWorldChoice(null, WORLD_STORAGE_KEY);
    c.set('prueba');
    expect(c.get()).toBe('prueba');
  });
});

describe('world:check', () => {
  it('los mundos registrados tienen skin y arte de cada lugar', () => {
    const report = checkWorlds(WORLD_REGISTRY, artExists);
    expect(report.ok, formatCheck(report, WORLD_REGISTRY.map.id)).toBe(true);
    expect(report.worlds.map((w) => w.worldId)).toEqual(WORLD_REGISTRY.ids());
    for (const w of report.worlds) expect(w.rows).toHaveLength(played.places.length);
  });

  it('una skin quitada en un fixture hace fallar el check y sale en su tabla', () => {
    const report = checkWorlds(removedSkinRegistry, artExists);
    expect(report.ok).toBe(false);
    const w = report.worlds.find((x) => x.worldId === REMOVED.world)!;
    expect(w.rows.find((r) => r.placeId === REMOVED.place)!.status).toBe('sin-skin');
    expect(formatCheck(report, map.id)).toMatch(new RegExp(`${REMOVED.place}.*sin-skin`));
  });

  it('una skin con arte que no existe cuenta como sin arte', () => {
    const r = new WorldRegistry(SAMPLE_MAP, [
      { ...PRUEBA_SKIN, places: { ...PRUEBA_SKIN.places, 'roca-1': {} } },
    ]);
    const report = checkWorlds(r, artExists);
    expect(report.ok).toBe(false);
    expect(report.worlds[0]!.rows.find((x) => x.placeId === 'roca-1')!.status).toBe('sin-arte');
  });

  describe('la orden', () => {
    const run = (...args: string[]) =>
      spawnSync(
        process.execPath,
        [
          '--import',
          './packages/world/scripts/ts-resolve.mjs',
          'packages/world/src/cli/world-check.ts',
          ...args,
        ],
        { cwd: ROOT, encoding: 'utf8' },
      );

    it('sale con 0 y una tabla por mundo', () => {
      const r = run();
      expect(r.status, r.stderr).toBe(0);
      for (const id of WORLD_REGISTRY.ids()) expect(r.stdout).toContain(`Mundo ${id} `);
    });

    it('sale con 1 si falta una skin o si una skin nombra un lugar desconocido', () => {
      const missing = run('--registro', 'packages/world/src/worlds/fixtures/sin-skin.ts');
      expect(missing.status).toBe(1);
      expect(missing.stdout).toMatch(new RegExp(`${REMOVED.place}.*sin-skin`));
      const unknown = run('--registro', 'packages/world/src/worlds/fixtures/lugar-desconocido.ts');
      expect(unknown.status).toBe(1);
      expect(unknown.stderr).toContain('isla-fantasma');
    });
  });
});
