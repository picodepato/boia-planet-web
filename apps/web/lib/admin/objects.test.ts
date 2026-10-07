import {
  type ObjectTemplate,
  type WorldObjectRecord,
  objectTemplateSchema,
  worldObjectSchema,
} from '@boia/contracts';
import { MemoryStorage, SAMPLE_EVENTS, createLocalRepository } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { createAdminActions } from './actions';
import { liveWorld } from './live-world';
import {
  BUILTIN_TEMPLATES,
  CATEGORY_DEFAULTS,
  GEOMETRY_RANGES,
  OBJECT_STEPS,
  type ObjectWizard,
  type StepEnv,
  allTemplates,
  duplicateTemplate,
  firstProblem,
  libraryAsset,
  objectBehaviors,
  objectPlaceProblem,
  objectToPlace,
  startWizard,
  stepProblem,
  templateFromObject,
  withNewObjects,
  wizardReducer,
} from './objects';
import { worldProblem } from './validate';
import { EMPTY_WORLD_CONTENT, MAP_POINTS, composeLiveWorld, liveMap } from './world';

/**
 * Objetos nuevos sin código (plan 017 T190): REQ-ADM-010 (los 10 pasos),
 * REQ-ADM-011 (plantillas que conservan comportamientos y parámetros) y cómo
 * un objeto publicado llega al mar. Las posiciones salen del mapa, nunca
 * escritas a mano.
 */

const NOW = '2026-10-07T10:00:00Z';
const registry = WORLD_REGISTRY;
const map = registry.map;

const env: StepEnv = {
  bounds: map.bounds,
  usedIds: new Set([...map.places.map((p) => p.id), ...Object.values(MAP_POINTS)]),
  eventIds: new Set(SAMPLE_EVENTS.map((e) => e.id)),
};

const template = (id: string): ObjectTemplate => BUILTIN_TEMPLATES.find((x) => x.id === id)!;
const islandTemplate = template('plantilla-isla-evento');

/** Un objeto completo desde una plantilla, en `at`. */
function fromTemplate(
  tpl: ObjectTemplate,
  at: { x: number; y: number },
  extra: Partial<WorldObjectRecord> = {},
): WorldObjectRecord {
  return worldObjectSchema.parse({
    ...structuredClone(tpl.spec),
    id: 'objeto-prueba',
    name: 'Objeto de prueba',
    x: at.x,
    y: at.y,
    status: 'published',
    templateId: tpl.id,
    ...extra,
  });
}

/**
 * Un sitio de agua donde una isla nueva no corta el paso: el primero que el
 * propio Admin acepta, buscando desde la salida hacia el norte.
 */
function freeSpot(tpl: ObjectTemplate = islandTemplate): { x: number; y: number } {
  const s = map.spawn;
  for (let dy = 900; dy < 6000; dy += 300) {
    for (const dx of [-1200, -800, 800, 1200, -1600, 1600]) {
      const at = { x: Math.round(s.x + dx), y: Math.round(s.y - dy) };
      const o = fromTemplate(tpl, at);
      if (!worldProblem(registry, { ...EMPTY_WORLD_CONTENT, objects: [o] })) return at;
    }
  }
  throw new Error('sin sitio libre');
}
const SPOT = freeSpot();

const run = (w: ObjectWizard, ...actions: Parameters<typeof wizardReducer>[1][]) =>
  actions.reduce(wizardReducer, w);
const next = { type: 'next', env } as const;

describe('REQ-ADM-010: el asistente de 10 pasos', () => {
  it('tiene los diez pasos de la especificación, en orden', () => {
    expect(OBJECT_STEPS).toEqual([
      'add',
      'category',
      'asset',
      'place',
      'geometry',
      'behaviors',
      'params',
      'links',
      'preview',
      'save',
    ]);
  });

  it('no avanza con un paso sin resolver; avanza al resolverlo y no salta a pasos sin ver', () => {
    let w = startWizard({ kind: 'blank', id: '', name: '', at: SPOT });
    w = run(w, next);
    expect(w.step).toBe(0);
    expect(stepProblem('add', w.draft, env)).toBe(t('admin.objects.problem.noName'));
    w = run(w, { type: 'name', name: 'Roca nueva', id: 'roca-nueva' }, next);
    expect(w.step).toBe(1);
    w = run(w, next);
    expect(w.step).toBe(1);
    expect(stepProblem('category', w.draft, env)).toBe(t('admin.objects.problem.noCategory'));
    w = run(w, { type: 'goto', step: 5 });
    expect(w.step).toBe(1);
    w = run(w, { type: 'category', category: 'obstaculo' }, next);
    expect(w.step).toBe(2);
    w = run(w, { type: 'back' }, { type: 'goto', step: 2 });
    expect(w.step).toBe(2);
    expect(w.reached).toBe(2);
  });

  it('recorre los diez pasos desde cero hasta un objeto que se puede publicar', () => {
    let w = startWizard({ kind: 'blank', id: '', name: '', at: SPOT });
    w = run(
      w,
      { type: 'name', name: 'Boia nueva', id: 'boia-nueva' },
      next,
      { type: 'category', category: 'boia' },
      next,
      next, // el asset de la biblioteca
      { type: 'place', ...SPOT },
      next,
      next, // radio y huella de la categoría
      next, // sus comportamientos
      next, // sus parámetros
      { type: 'links', links: { achievementTrigger: 'find_buoy' } },
      next,
      next,
    );
    expect(OBJECT_STEPS[w.step]).toBe('save');
    expect(firstProblem(w.draft, env)).toBeNull();
    expect(objectBehaviors(w.draft).map((b) => b.type)).toEqual([
      'collision',
      'proximity',
      'achievement',
    ]);
    expect(
      worldProblem(registry, {
        ...EMPTY_WORLD_CONTENT,
        objects: [{ ...w.draft, status: 'published' }],
      }),
    ).toBeNull();
  });

  it('la categoría propone valores; lo tocado a mano no lo pisa al cambiar de categoría', () => {
    let w = startWizard({ kind: 'blank', id: 'x', name: 'X', at: SPOT });
    w = run(w, { type: 'category', category: 'isla' });
    expect(w.draft.hitbox).toBe(CATEGORY_DEFAULTS.isla.hitbox);
    expect(w.draft.behaviors).toEqual(CATEGORY_DEFAULTS.isla.behaviors);
    expect(w.draft.asset).toEqual(libraryAsset('isla'));
    w = run(
      w,
      { type: 'geometry', patch: { hitbox: 77 } },
      { type: 'category', category: 'cofre' },
    );
    expect(w.draft.hitbox).toBe(77);
    expect(w.draft.hitboxKind).toBe(CATEGORY_DEFAULTS.cofre.hitboxKind);
    expect(w.draft.behaviors).toEqual(CATEGORY_DEFAULTS.cofre.behaviors);
    expect(w.draft.asset).toEqual(libraryAsset('cofre'));
  });

  it('desde una plantilla, cambiar de categoría conserva sus comportamientos y parámetros', () => {
    const tpl = template('plantilla-obstaculo-lento');
    let w = startWizard({ kind: 'template', template: tpl, id: 'lento', name: 'Lento', at: SPOT });
    w = run(w, { type: 'category', category: 'decorado' });
    expect(w.draft.behaviors).toEqual(tpl.spec.behaviors);
    expect(w.draft.hitbox).toBe(tpl.spec.hitbox);
    expect(w.draft.templateId).toBe(tpl.id);
  });

  it('editar un objeto guardado abre con todos los pasos a mano', () => {
    const o = fromTemplate(islandTemplate, SPOT);
    const w = startWizard({ kind: 'object', object: o });
    expect(w.reached).toBe(OBJECT_STEPS.length - 1);
    expect(run(w, { type: 'goto', step: 8 }).step).toBe(8);
    expect(w.draft).toEqual(o);
  });
});

describe('REQ-ADM-010: cada regla de los pasos', () => {
  const base = () => fromTemplate(islandTemplate, SPOT);

  it('añadir: nombre, id con forma de id de lugar y libre', () => {
    expect(stepProblem('add', { ...base(), name: ' ' }, env)).toBe(
      t('admin.objects.problem.noName'),
    );
    expect(stepProblem('add', { ...base(), id: 'Con Espacios' }, env)).toBe(
      t('admin.objects.problem.badId', { id: 'Con Espacios' }),
    );
    const taken = map.places[0]!.id;
    expect(stepProblem('add', { ...base(), id: taken }, env)).toBe(
      t('admin.objects.problem.takenId', { id: taken }),
    );
    expect(stepProblem('add', base(), env)).toBeNull();
  });

  it('categoría: sólo las de la lista', () => {
    expect(stepProblem('category', { ...base(), category: 'nave' }, env)).toBe(
      t('admin.objects.problem.noCategory'),
    );
  });

  it('asset: uno subido tiene que venir validado (con su original)', () => {
    const o = { ...base(), asset: { ref: 'local-photo:x', variants: [] } };
    expect(stepProblem('asset', o, env)).toBe(t('admin.objects.problem.assetUnchecked'));
    const ok = {
      ...o,
      asset: {
        ...o.asset,
        original: { ref: 'local-photo:x', type: 'image/png' as const, bytes: 10 },
      },
    };
    expect(stepProblem('asset', ok, env)).toBeNull();
  });

  it('colocar: dentro del mapa', () => {
    expect(stepProblem('place', { ...base(), x: map.bounds.right + 1 }, env)).toBe(
      t('admin.objects.problem.outside'),
    );
  });

  it('radio, huella, zona y punto seguro: rangos seguros y punto dentro del mapa', () => {
    const r = GEOMETRY_RANGES.hitbox;
    expect(stepProblem('geometry', { ...base(), hitbox: r.max + 1 }, env)).toBe(
      t('admin.objects.problem.range', {
        label: t('admin.objects.field.hitbox'),
        min: String(r.min),
        max: String(r.max),
      }),
    );
    expect(
      stepProblem('geometry', { ...base(), safePoint: { x: 0, y: map.bounds.bottom + 10 } }, env),
    ).toBe(t('admin.objects.problem.safeOutside'));
  });

  it('comportamientos: al menos uno, del catálogo y sin repetir', () => {
    expect(stepProblem('behaviors', { ...base(), behaviors: [] }, env)).toBe(
      t('admin.objects.problem.noBehaviors'),
    );
    expect(
      stepProblem('behaviors', { ...base(), behaviors: [{ type: 'volar', params: {} }] }, env),
    ).toBe(t('admin.objects.problem.unknownBehavior', { type: 'volar' }));
    expect(
      stepProblem(
        'behaviors',
        {
          ...base(),
          behaviors: [
            { type: 'proximity', params: {} },
            { type: 'proximity', params: {} },
          ],
        },
        env,
      ),
    ).toMatch(/PROXIMIDAD/);
  });

  it('parámetros: los del catálogo de @boia/world, con sus rangos', () => {
    const o = {
      ...base(),
      behaviors: [{ type: 'collision', params: { mode: 'block', intensity: 3 } }],
    };
    expect(stepProblem('params', o, env)).toMatch(/^COLISIÓN: intensity/);
  });

  it('enlaces: evento y disparador que existen, destino dentro del mapa', () => {
    expect(stepProblem('links', { ...base(), links: { eventId: 'ev-no-existe' } }, env)).toBe(
      t('admin.objects.problem.noEvent', { id: 'ev-no-existe' }),
    );
    expect(stepProblem('links', { ...base(), links: { achievementTrigger: 'bailar' } }, env)).toBe(
      t('admin.objects.problem.noTrigger', { id: 'bailar' }),
    );
    expect(
      stepProblem(
        'links',
        { ...base(), links: { destination: { x: map.bounds.left - 1, y: 0 } } },
        env,
      ),
    ).toBe(t('admin.objects.problem.destinationOutside'));
  });

  it('previsualizar: lo que el motor necesita para ejecutar cada comportamiento', () => {
    const noRadius = { ...base(), proximityRadius: undefined };
    expect(objectPlaceProblem(noRadius)).toMatch(/PROXIMIDAD necesita un radio/);
    const solidThrough = { ...base(), hitboxKind: 'activation' as const };
    expect(objectPlaceProblem(solidThrough)).toBe(t('admin.objects.problem.solidNeedsCollision'));
    expect(stepProblem('preview', base(), env)).toBeNull();
  });

  it('el mar entero: en tierra o encima de la salida se rechaza con su motivo', () => {
    const island = map.places.find((p) => p.category === 'isla' && p.geometry.collision)!;
    const onLand = fromTemplate(islandTemplate, island.position, { safePoint: undefined });
    expect(worldProblem(registry, { ...EMPTY_WORLD_CONTENT, objects: [onLand] })).toBe(
      t('admin.objects.problem.onLand', { name: onLand.name }),
    );
    const onSpawn = fromTemplate(islandTemplate, map.spawn);
    expect(worldProblem(registry, { ...EMPTY_WORLD_CONTENT, objects: [onSpawn] })).not.toBeNull();
    const safeOnLand = fromTemplate(islandTemplate, SPOT, { safePoint: { ...SPOT } });
    expect(worldProblem(registry, { ...EMPTY_WORLD_CONTENT, objects: [safeOnLand] })).toBe(
      t('admin.objects.problem.safeOnLand', { name: safeOnLand.name }),
    );
    // En el mar 3D (más corto, islas más grandes) junto al puerto, el barco no tendría por dónde llegar.
    const byPort = fromTemplate(islandTemplate, { x: map.spawn.x - 1200, y: map.spawn.y - 900 });
    expect(worldProblem(registry, { ...EMPTY_WORLD_CONTENT, objects: [byPort] })).toBe(
      t('admin.objects.problem.seaArrival', { name: byPort.name }),
    );
    // En borrador no cuenta: no sale en el mar.
    expect(
      worldProblem(registry, {
        ...EMPTY_WORLD_CONTENT,
        objects: [{ ...onSpawn, status: 'draft' }],
      }),
    ).toBeNull();
  });
});

describe('REQ-ADM-011: plantillas', () => {
  it('trae las cinco de serie, válidas y con objeto publicable', () => {
    expect(BUILTIN_TEMPLATES.map((x) => x.name)).toEqual([
      t('admin.objects.template.slow'),
      t('admin.objects.template.dialogue'),
      t('admin.objects.template.island'),
      t('admin.objects.template.chest'),
      t('admin.objects.template.boost'),
    ]);
    for (const tpl of BUILTIN_TEMPLATES) {
      expect(objectTemplateSchema.safeParse(tpl).success).toBe(true);
      const o = fromTemplate(tpl, freeSpot(tpl), { id: `de-${tpl.id}` });
      expect(firstProblem(o, env), tpl.id).toBeNull();
      expect(worldProblem(registry, { ...EMPTY_WORLD_CONTENT, objects: [o] }), tpl.id).toBeNull();
    }
  });

  it('duplicar una plantilla conserva comportamientos y parámetros, con id y nombre propios', () => {
    const tpl = template('plantilla-boia-dialogo');
    const used = new Set(BUILTIN_TEMPLATES.map((x) => x.id));
    const copy = duplicateTemplate(tpl, used);
    expect(copy.spec).toEqual(tpl.spec);
    expect(copy.spec.behaviors).not.toBe(tpl.spec.behaviors);
    expect(copy.name).toBe(t('admin.objects.copyOf', { name: tpl.name }));
    expect(used.has(copy.id)).toBe(false);
    expect(copy.from).toBe(tpl.id);
    const again = duplicateTemplate(tpl, new Set([...used, copy.id]));
    expect(again.id).not.toBe(copy.id);
  });

  it('guardar un objeto como plantilla se queda con todo menos id, nombre y posición', () => {
    const o = fromTemplate(template('plantilla-cofre'), SPOT, {
      links: { reward: { kind: 'points', amount: 9 } },
    });
    const tpl = templateFromObject(o, 'Mi cofre', new Set());
    expect(tpl.spec.behaviors).toEqual(o.behaviors);
    expect(tpl.spec.links).toEqual(o.links);
    expect(tpl.spec).not.toHaveProperty('x');
    expect(tpl.spec).not.toHaveProperty('id');
    expect(allTemplates([tpl]).at(-1)).toEqual(tpl);
    expect(allTemplates([BUILTIN_TEMPLATES[0]!])).toHaveLength(BUILTIN_TEMPLATES.length);
  });
});

describe('un objeto publicado llega al mar', () => {
  it('los enlaces del paso 8 se vuelven comportamientos del catálogo', () => {
    const ev = SAMPLE_EVENTS[0]!.id;
    const o = fromTemplate(islandTemplate, SPOT, {
      links: {
        eventId: ev,
        achievementTrigger: 'visit_island',
        reward: { kind: 'coins', amount: 3 },
        destination: { x: 1, y: 2 },
      },
    });
    const b = objectBehaviors(o);
    expect(b.find((x) => x.type === 'content')?.params).toMatchObject({ target: 'event', ref: ev });
    expect(b.find((x) => x.type === 'ticket')?.params).toEqual({ eventId: ev });
    expect(b.find((x) => x.type === 'achievement')?.params).toEqual({ trigger: 'visit_island' });
    expect(b.find((x) => x.type === 'reward')?.params).toMatchObject({ kind: 'coins', amount: 3 });
    expect(b.find((x) => x.type === 'teleport')?.params).toEqual({ x: 1, y: 2 });
  });

  it('sólo lo publicado y con id propio sale en el mapa, al final', () => {
    const pub = fromTemplate(islandTemplate, SPOT);
    const draft = { ...pub, id: 'borrador', status: 'draft' as const };
    const clash = { ...pub, id: map.places[0]!.id };
    const out = withNewObjects(map, [pub, draft, clash]);
    expect(out.places.length).toBe(map.places.length + 1);
    expect(out.places.at(-1)?.id).toBe(pub.id);
    expect(out.places.at(-1)?.position).toMatchObject({ x: SPOT.x, y: SPOT.y });
    expect(objectToPlace(pub).tags).toEqual(['admin']);
  });

  it('en cada mundo, con su arte y sus textos', () => {
    const o = fromTemplate(islandTemplate, SPOT);
    for (const id of registry.ids()) {
      const world = composeLiveWorld(registry, id, { ...EMPTY_WORLD_CONTENT, objects: [o] });
      const obj = world.config.objects.find((x) => x.identity.id === o.id);
      expect(obj?.identity.name, id).toBe(o.name);
      expect(obj?.appearance.asset).toBe(o.asset.ref);
      expect(obj?.content?.texts).toEqual(o.texts);
      expect(world.places.find((p) => p.id === o.id)?.status).toBe('skin');
    }
    expect(liveMap(registry, { ...EMPTY_WORLD_CONTENT, objects: [] }).places).toHaveLength(
      map.places.length,
    );
  });

  it('con el Admin: publicar lo pone en el mar, en borrador no; duplicar y plantillas', async () => {
    const repo = createLocalRepository({
      storage: new MemoryStorage(),
      now: () => new Date(NOW),
      watch: false,
    });
    const actions = createAdminActions({ repo, registry, now: () => new Date(NOW) });
    const base = registry.get(registry.defaultId);
    const o = fromTemplate(islandTemplate, SPOT, { id: 'isla-admin', name: 'Isla del Admin' });
    expect(await actions.objectPreviewProblem(o)).toBeNull();

    await actions.saveObject(o, false);
    expect((await repo.content.get('worldObjects', o.id))?.status).toBe('draft');
    let live = await liveWorld(repo, registry, base);
    expect(live.config.objects.some((x) => x.identity.id === o.id)).toBe(false);

    await actions.saveObject(o, true);
    live = await liveWorld(repo, registry, base);
    expect(live.config.objects.find((x) => x.identity.id === o.id)?.identity.name).toBe(
      'Isla del Admin',
    );

    // Encima de la salida no se publica, y lo guardado no cambia.
    const blocked = { ...o, x: map.spawn.x, y: map.spawn.y };
    await expect(actions.saveObject(blocked, true)).rejects.toThrow();
    expect((await repo.content.get('worldObjects', o.id))?.x).toBe(SPOT.x);

    const copy = await actions.duplicateObject(o.id);
    expect(copy.status).toBe('draft');
    expect(copy.id).not.toBe(o.id);
    expect(copy.behaviors).toEqual(o.behaviors);

    const tpl = await actions.saveObjectAsTemplate(o, 'Isla del Admin');
    expect(tpl.spec.behaviors).toEqual(o.behaviors);
    const dup = await actions.duplicateObjectTemplate(tpl.id);
    expect(dup.spec).toEqual(tpl.spec);
    expect((await repo.content.list('objectTemplates')).map((x) => x.id)).toEqual([tpl.id, dup.id]);
    const audit = await repo.admin.audit({ area: 'worldObjects' });
    expect(audit.length).toBeGreaterThanOrEqual(3);
  });
});
