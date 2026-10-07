import {
  ACHIEVEMENT_TRIGGERS,
  type ObjectAsset,
  type ObjectBehavior,
  type ObjectSpec,
  type ObjectTemplate,
  type WorldObjectRecord,
  objectSpecSchema,
  objectTemplateSchema,
  worldObjectIdSchema,
} from '@boia/contracts';
import {
  BEHAVIOR_CATALOG,
  type BehaviorType,
  COLLISION_DEFAULTS,
  Place,
  type PlaceInput,
  type PlaceSkin,
  type SharedMap,
  WorldObject,
} from '@boia/world';
import { t } from '../i18n';

/**
 * Objetos nuevos del mundo sin código (plan 017 T190): los 10 pasos de
 * REQ-ADM-010, las plantillas de REQ-ADM-011 y cómo un objeto guardado pasa
 * a ser un lugar más del mapa compartido. Sin E/S: lo usan el Admin (para
 * guiar, validar y previsualizar) y el mar (para pintar lo publicado).
 *
 * - La categoría sólo aporta valores por defecto (huella, radio, arte y
 *   comportamientos de partida): lo que se toca a mano o viene de una
 *   plantilla no lo pisa al cambiar de categoría.
 * - Los enlaces del paso 8 (evento, logro, premio, destino) se vuelven
 *   comportamientos del catálogo de `@boia/world`.
 * - Un objeto publicado sale en todos los mundos, con el modelo de su
 *   categoría en el mar 3D; uno en borrador, en ninguno.
 */

// ---------------------------------------------------------------------------
// Pasos

export const OBJECT_STEPS = [
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
] as const;
export type ObjectStep = (typeof OBJECT_STEPS)[number];

export const OBJECT_STEP_LABELS: Record<ObjectStep, string> = {
  add: t('admin.objects.step.add'),
  category: t('admin.objects.step.category'),
  asset: t('admin.objects.step.asset'),
  place: t('admin.objects.step.place'),
  geometry: t('admin.objects.step.geometry'),
  behaviors: t('admin.objects.step.behaviors'),
  params: t('admin.objects.step.params'),
  links: t('admin.objects.step.links'),
  preview: t('admin.objects.step.preview'),
  save: t('admin.objects.step.save'),
};

// ---------------------------------------------------------------------------
// Categorías: valores por defecto, nunca la lógica

export const OBJECT_CATEGORIES = [
  'isla',
  'boia',
  'obstaculo',
  'cofre',
  'impulso',
  'decorado',
] as const;
export type ObjectCategory = (typeof OBJECT_CATEGORIES)[number];

export const OBJECT_CATEGORY_LABELS: Record<ObjectCategory, string> = {
  isla: t('admin.objects.category.isla'),
  boia: t('admin.objects.category.boia'),
  obstaculo: t('admin.objects.category.obstaculo'),
  cofre: t('admin.objects.category.cofre'),
  impulso: t('admin.objects.category.impulso'),
  decorado: t('admin.objects.category.decorado'),
};

/** Lo que una categoría propone. muestra */
export type CategoryDefaults = Pick<
  ObjectSpec,
  'hitbox' | 'hitboxKind' | 'proximityRadius' | 'behaviors'
>;

export const CATEGORY_DEFAULTS: Record<ObjectCategory, CategoryDefaults> = {
  isla: {
    hitbox: 50,
    hitboxKind: 'collision',
    proximityRadius: 200,
    behaviors: [
      { type: 'collision', params: { mode: 'block' } },
      { type: 'proximity', params: {} },
      { type: 'content', params: { target: 'info' } },
    ],
  },
  boia: {
    hitbox: 12,
    hitboxKind: 'collision',
    proximityRadius: 100,
    behaviors: [
      { type: 'collision', params: { mode: 'bounce', intensity: 0.3 } },
      { type: 'proximity', params: {} },
    ],
  },
  obstaculo: {
    hitbox: 15,
    hitboxKind: 'collision',
    proximityRadius: undefined,
    behaviors: [{ type: 'collision', params: { mode: 'bounce', intensity: 0.3 } }],
  },
  cofre: {
    hitbox: 30,
    hitboxKind: 'activation',
    proximityRadius: undefined,
    behaviors: [{ type: 'collectible', params: {} }],
  },
  impulso: {
    hitbox: 25,
    hitboxKind: 'activation',
    proximityRadius: undefined,
    behaviors: [
      { type: 'collision', params: { mode: 'boost', intensity: 0.5, duration: 1.5, solid: false } },
    ],
  },
  decorado: {
    hitbox: undefined,
    hitboxKind: 'collision',
    proximityRadius: undefined,
    behaviors: [{ type: 'decorative', params: {} }],
  },
};

export function isObjectCategory(c: string): c is ObjectCategory {
  return (OBJECT_CATEGORIES as readonly string[]).includes(c);
}

/** El nombre de una categoría para la interfaz (la propia, si no es de la lista). */
export const categoryLabel = (c: string): string =>
  isObjectCategory(c) ? OBJECT_CATEGORY_LABELS[c] : c;

/** El arte de biblioteca de una categoría: el modelo que ya pinta el mar 3D. */
export const libraryAsset = (category: string): ObjectAsset => ({
  ref: `placeholder:${category || 'objeto'}`,
  variants: [],
});

/** ¿El arte es de la biblioteca (no un archivo subido)? */
export const isLibraryAsset = (a: ObjectAsset) => a.ref.startsWith('placeholder:');

// ---------------------------------------------------------------------------
// Plantillas (REQ-ADM-011)

const spec = (input: Parameters<typeof objectSpecSchema.parse>[0]): ObjectSpec =>
  objectSpecSchema.parse(input);

/** Las cinco plantillas de serie. Sus textos y valores son `muestra`. */
export const BUILTIN_TEMPLATES: readonly ObjectTemplate[] = [
  {
    id: 'plantilla-obstaculo-lento',
    name: t('admin.objects.template.slow'),
    sample: true,
    spec: spec({
      category: 'obstaculo',
      asset: libraryAsset('obstaculo'),
      hitbox: 30,
      hitboxKind: 'activation',
      behaviors: [
        { type: 'collision', params: { mode: 'slow', intensity: 0.5, duration: 2, solid: false } },
      ],
    }),
  },
  {
    id: 'plantilla-boia-dialogo',
    name: t('admin.objects.template.dialogue'),
    sample: true,
    spec: spec({
      category: 'boia',
      asset: libraryAsset('boia'),
      hitbox: 12,
      proximityRadius: 100,
      behaviors: [
        { type: 'collision', params: { mode: 'bounce', intensity: 0.3 } },
        { type: 'proximity', params: {} },
        {
          type: 'dialogue',
          params: {
            lines: [
              t('admin.objects.template.dialogueLine1'),
              t('admin.objects.template.dialogueLine2'),
            ],
          },
        },
      ],
    }),
  },
  {
    id: 'plantilla-isla-evento',
    name: t('admin.objects.template.island'),
    sample: true,
    spec: spec({
      category: 'isla',
      asset: libraryAsset('isla'),
      hitbox: 50,
      proximityRadius: 200,
      behaviors: [
        { type: 'collision', params: { mode: 'block' } },
        { type: 'proximity', params: {} },
        { type: 'content', params: { target: 'info' } },
      ],
      texts: {
        kicker: t('admin.objects.template.islandKicker'),
        body: t('admin.objects.template.islandBody'),
      },
    }),
  },
  {
    id: 'plantilla-cofre',
    name: t('admin.objects.template.chest'),
    sample: true,
    spec: spec({
      category: 'cofre',
      asset: libraryAsset('cofre'),
      hitbox: 30,
      hitboxKind: 'activation',
      behaviors: [{ type: 'collectible', params: {} }],
      links: { reward: { kind: 'coins', amount: 5 } },
    }),
  },
  {
    id: 'plantilla-boost',
    name: t('admin.objects.template.boost'),
    sample: true,
    spec: spec({
      category: 'impulso',
      asset: libraryAsset('impulso'),
      hitbox: 25,
      hitboxKind: 'activation',
      behaviors: [
        {
          type: 'collision',
          params: { mode: 'boost', intensity: 0.5, duration: 1.5, solid: false },
        },
      ],
    }),
  },
].map((x) => objectTemplateSchema.parse(x));

/** Las de serie y, detrás, las que guardó el Admin. */
export function allTemplates(saved: readonly ObjectTemplate[]): ObjectTemplate[] {
  const builtin = new Set(BUILTIN_TEMPLATES.map((x) => x.id));
  return [...BUILTIN_TEMPLATES, ...saved.filter((x) => !builtin.has(x.id))];
}

/** Lo que conserva una plantilla de un objeto: todo menos id, nombre, posición y estado. */
export function specOf(o: ObjectSpec): ObjectSpec {
  return objectSpecSchema.parse(structuredClone(o));
}

/** Un id libre a partir de un nombre: `base`, `base-2`, `base-3`… */
export function freeId(base: string, used: ReadonlySet<string>): string {
  const clean =
    base
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'objeto';
  if (!used.has(clean)) return clean;
  for (let i = 2; ; i++) {
    const id = `${clean}-${i}`;
    if (!used.has(id)) return id;
  }
}

/** Una copia de una plantilla, con su nombre y un id libre. */
export function duplicateTemplate(
  template: ObjectTemplate,
  used: ReadonlySet<string>,
): ObjectTemplate {
  const name = t('admin.objects.copyOf', { name: template.name }).slice(0, 80);
  return objectTemplateSchema.parse({
    id: freeId(`plantilla-${name}`, used),
    name,
    spec: specOf(template.spec),
    from: template.id,
    sample: false,
  });
}

/** Un objeto guardado como plantilla. */
export function templateFromObject(
  o: WorldObjectRecord,
  name: string,
  used: ReadonlySet<string>,
): ObjectTemplate {
  return objectTemplateSchema.parse({
    id: freeId(`plantilla-${name}`, used),
    name: name.trim(),
    spec: specOf(o),
    from: o.id,
    sample: false,
  });
}

// ---------------------------------------------------------------------------
// De objeto a lugar del mapa

type AnyBehavior = { type: string; params: Record<string, unknown> };

/** Los comportamientos del objeto con sus enlaces del paso 8 ya puestos. */
export function objectBehaviors(o: ObjectSpec): AnyBehavior[] {
  const out: AnyBehavior[] = o.behaviors.map((b) => ({ type: b.type, params: { ...b.params } }));
  const { eventId, achievementTrigger, reward, destination } = o.links;
  if (eventId) {
    const i = out.findIndex((b) => b.type === 'content');
    const content = {
      type: 'content',
      params: { ...(out[i]?.params ?? {}), target: 'event', ref: eventId },
    };
    if (i >= 0) out[i] = content;
    else out.push(content);
    if (!out.some((b) => b.type === 'ticket')) out.push({ type: 'ticket', params: { eventId } });
  }
  if (achievementTrigger) {
    out.push({ type: 'achievement', params: { trigger: achievementTrigger } });
  }
  if (reward) {
    out.push({
      type: 'reward',
      params: { kind: reward.kind, amount: reward.amount, frequency: 'once' },
    });
  }
  if (destination) out.push({ type: 'teleport', params: { x: destination.x, y: destination.y } });
  return out;
}

/** El lugar del mapa compartido de un objeto nuevo (sin validar). */
export function objectToPlace(o: WorldObjectRecord): PlaceInput {
  const geometry: PlaceInput['geometry'] = {};
  if (o.hitbox !== undefined) {
    geometry[o.hitboxKind] = { shape: 'circle', radius: o.hitbox };
  }
  if (o.proximityRadius !== undefined) geometry.proximityRadius = o.proximityRadius;
  const params: Record<string, unknown> = { ...o.params };
  if (o.safePoint) params.safePoint = { ...o.safePoint };
  const texts = Object.fromEntries(Object.entries(o.texts).filter(([, v]) => v.trim() !== ''));
  return {
    id: o.id,
    name: o.name,
    category: o.category,
    tags: ['admin'],
    active: true,
    position: { x: o.x, y: o.y, ...(o.zone ? { zone: o.zone } : {}) },
    geometry,
    behaviors: objectBehaviors(o) as PlaceInput['behaviors'],
    ...(o.scale !== 1 ? { appearance: { scale: o.scale } } : {}),
    ...(Object.keys(params).length ? { params } : {}),
    ...(Object.keys(texts).length ? { content: { texts } } : {}),
    source: [`admin:${o.templateId ?? 'objeto'}`],
  };
}

/** La skin de un objeto nuevo en cada mundo: su arte. */
export function objectSkin(o: Pick<WorldObjectRecord, 'asset'>): PlaceSkin {
  return { asset: o.asset.ref };
}

/** ¿Sale en el mar? Sólo lo publicado. */
export const isPublished = (o: Pick<WorldObjectRecord, 'status'>) => o.status === 'published';

/**
 * El mapa con los objetos publicados al final. Uno cuyo id ya es de un lugar
 * del mapa, o que no compone un lugar válido, no sale (el Admin no lo deja
 * guardar; esto protege al mar de datos viejos).
 */
export function withNewObjects(map: SharedMap, objects: readonly WorldObjectRecord[]): SharedMap {
  const taken = new Set(map.places.map((p) => p.id));
  const added: Place[] = [];
  for (const o of objects) {
    if (!isPublished(o) || taken.has(o.id)) continue;
    const parsed = Place.safeParse(objectToPlace(o));
    if (!parsed.success) continue;
    taken.add(o.id);
    added.push(parsed.data);
  }
  return added.length ? { ...map, places: [...map.places, ...added] } : map;
}

// ---------------------------------------------------------------------------
// El asistente de los 10 pasos

export type GeometryField = 'hitbox' | 'hitboxKind' | 'proximityRadius' | 'behaviors' | 'asset';

export interface ObjectWizard {
  /** Índice en `OBJECT_STEPS`. */
  step: number;
  /** El paso más lejano al que se llegó (se puede volver a cualquiera hasta él). */
  reached: number;
  draft: WorldObjectRecord;
  /** Campos que aún llevan el valor de la categoría: cambiar de categoría los cambia. */
  fromCategory: GeometryField[];
}

const ALL_DEFAULTED: GeometryField[] = [
  'hitbox',
  'hitboxKind',
  'proximityRadius',
  'behaviors',
  'asset',
];

/** Un borrador vacío o desde una plantilla (o desde un objeto, para editarlo). */
export function startWizard(
  from:
    | { kind: 'blank'; id: string; name: string; at: { x: number; y: number } }
    | {
        kind: 'template';
        template: ObjectTemplate;
        id: string;
        name: string;
        at: { x: number; y: number };
      }
    | { kind: 'object'; object: WorldObjectRecord },
): ObjectWizard {
  if (from.kind === 'object') {
    return {
      step: 0,
      reached: OBJECT_STEPS.length - 1,
      draft: structuredClone(from.object),
      fromCategory: [],
    };
  }
  const base: ObjectSpec =
    from.kind === 'template'
      ? specOf(from.template.spec)
      : {
          ...objectSpecSchema.parse({ category: 'objeto', asset: libraryAsset('') }),
          category: '',
        };
  return {
    step: 0,
    reached: 0,
    draft: {
      ...base,
      id: from.id,
      name: from.name,
      x: Math.round(from.at.x),
      y: Math.round(from.at.y),
      status: 'draft',
      ...(from.kind === 'template' ? { templateId: from.template.id } : {}),
      sample: false,
    },
    fromCategory: from.kind === 'template' ? [] : [...ALL_DEFAULTED],
  };
}

export type WizardAction =
  | { type: 'name'; name: string; id?: string }
  | { type: 'category'; category: string }
  | { type: 'asset'; asset: ObjectAsset }
  | { type: 'place'; x: number; y: number }
  | {
      type: 'geometry';
      patch: Partial<
        Pick<WorldObjectRecord, 'hitbox' | 'hitboxKind' | 'proximityRadius' | 'zone' | 'safePoint'>
      >;
    }
  | { type: 'behaviors'; behaviors: ObjectBehavior[] }
  | { type: 'params'; index: number; params: Record<string, unknown> }
  | { type: 'placeParams'; params: Record<string, unknown> }
  | { type: 'texts'; texts: Record<string, string> }
  | { type: 'links'; links: WorldObjectRecord['links'] }
  | { type: 'goto'; step: number }
  | { type: 'back' }
  /** Avanza si el paso de ahora no tiene problemas (`stepProblem`). */
  | { type: 'next'; env: StepEnv };

const without = (list: GeometryField[], ...fields: GeometryField[]) =>
  list.filter((f) => !fields.includes(f));

function applyCategory(w: ObjectWizard, category: string): ObjectWizard {
  const draft: WorldObjectRecord = { ...w.draft, category };
  const d = isObjectCategory(category) ? CATEGORY_DEFAULTS[category] : null;
  const has = (f: GeometryField) => w.fromCategory.includes(f);
  if (d) {
    if (has('hitbox')) {
      if (d.hitbox === undefined) delete draft.hitbox;
      else draft.hitbox = d.hitbox;
    }
    if (has('hitboxKind')) draft.hitboxKind = d.hitboxKind;
    if (has('proximityRadius')) {
      if (d.proximityRadius === undefined) delete draft.proximityRadius;
      else draft.proximityRadius = d.proximityRadius;
    }
    if (has('behaviors')) draft.behaviors = structuredClone(d.behaviors);
  }
  if (has('asset') || isLibraryAsset(draft.asset)) draft.asset = libraryAsset(category);
  return { ...w, draft };
}

export function wizardReducer(w: ObjectWizard, a: WizardAction): ObjectWizard {
  const set = (draft: Partial<WorldObjectRecord>, touched: GeometryField[] = []) => ({
    ...w,
    draft: { ...w.draft, ...draft },
    fromCategory: without(w.fromCategory, ...touched),
  });
  switch (a.type) {
    case 'name':
      return set({ name: a.name, ...(a.id !== undefined ? { id: a.id } : {}) });
    case 'category':
      return applyCategory(w, a.category);
    case 'asset':
      return set({ asset: a.asset }, ['asset']);
    case 'place':
      return set({ x: a.x, y: a.y });
    case 'geometry': {
      const draft = { ...w.draft };
      for (const [k, v] of Object.entries(a.patch) as [keyof typeof a.patch, unknown][]) {
        if (v === undefined) delete draft[k];
        else (draft as Record<string, unknown>)[k] = v;
      }
      return {
        ...w,
        draft,
        fromCategory: without(
          w.fromCategory,
          ...(Object.keys(a.patch).filter((k) =>
            ALL_DEFAULTED.includes(k as GeometryField),
          ) as GeometryField[]),
        ),
      };
    }
    case 'behaviors':
      return set({ behaviors: a.behaviors }, ['behaviors']);
    case 'params': {
      const behaviors = w.draft.behaviors.map((b, i) =>
        i === a.index ? { ...b, params: a.params } : b,
      );
      return set({ behaviors }, ['behaviors']);
    }
    case 'placeParams':
      return set({ params: a.params });
    case 'texts':
      return set({ texts: a.texts });
    case 'links':
      return set({ links: a.links });
    case 'goto':
      return a.step >= 0 && a.step <= w.reached ? { ...w, step: a.step } : w;
    case 'back':
      return { ...w, step: Math.max(0, w.step - 1) };
    case 'next': {
      if (w.step >= OBJECT_STEPS.length - 1) return w;
      if (stepProblem(OBJECT_STEPS[w.step]!, w.draft, a.env)) return w;
      const step = w.step + 1;
      return { ...w, step, reached: Math.max(w.reached, step) };
    }
  }
}

/** Lo que un paso necesita saber del resto del Admin. */
export interface StepEnv {
  bounds: { left: number; right: number; top: number; bottom: number };
  /** Ids ya usados por lugares del mapa, puntos del mapa y otros objetos. */
  usedIds: ReadonlySet<string>;
  eventIds: ReadonlySet<string>;
}

const inside = (b: StepEnv['bounds'], p: { x: number; y: number }) =>
  Number.isFinite(p.x) &&
  Number.isFinite(p.y) &&
  p.x >= b.left &&
  p.x <= b.right &&
  p.y >= b.top &&
  p.y <= b.bottom;

const fmt = (n: number) => String(n).replace('.', ',');

/** Rangos seguros de la geometría de un objeto nuevo (u del mapa). */
export const GEOMETRY_RANGES = {
  hitbox: { min: 2, max: 400 },
  proximityRadius: { min: 10, max: 2000 },
} as const;

function issueText(err: { issues: { path: PropertyKey[]; message: string }[] }): string {
  const i = err.issues[0];
  return i ? `${i.path.map(String).join('.')}: ${i.message}` : '';
}

/** Por qué los parámetros de un comportamiento no valen, o null. */
export function behaviorParamsProblem(b: ObjectBehavior): string | null {
  const entry = BEHAVIOR_CATALOG[b.type as BehaviorType];
  if (!entry) return t('admin.objects.problem.unknownBehavior', { type: b.type });
  const r = entry.params.safeParse(b.params);
  return r.success
    ? null
    : t('admin.objects.problem.badParams', { label: entry.label, issue: issueText(r.error) });
}

/**
 * Por qué no se puede pasar del paso `step`, o null. Cada paso mira lo suyo;
 * el mar entero (que nada acabe en tierra ni corte el paso) lo mira la
 * previsualización con `worldProblem`.
 */
export function stepProblem(step: ObjectStep, o: WorldObjectRecord, env: StepEnv): string | null {
  switch (step) {
    case 'add': {
      if (!o.name.trim()) return t('admin.objects.problem.noName');
      if (!worldObjectIdSchema.safeParse(o.id).success)
        return t('admin.objects.problem.badId', { id: o.id });
      if (env.usedIds.has(o.id)) return t('admin.objects.problem.takenId', { id: o.id });
      return null;
    }
    case 'category':
      return isObjectCategory(o.category) ? null : t('admin.objects.problem.noCategory');
    case 'asset':
      if (!o.asset.ref) return t('admin.objects.problem.noAsset');
      if (!isLibraryAsset(o.asset) && !o.asset.original)
        return t('admin.objects.problem.assetUnchecked');
      return null;
    case 'place':
      return inside(env.bounds, o) ? null : t('admin.objects.problem.outside');
    case 'geometry': {
      const ranges: [keyof typeof GEOMETRY_RANGES, number | undefined, string][] = [
        ['hitbox', o.hitbox, t('admin.objects.field.hitbox')],
        ['proximityRadius', o.proximityRadius, t('admin.objects.field.proximity')],
      ];
      for (const [k, v, label] of ranges) {
        if (v === undefined) continue;
        const r = GEOMETRY_RANGES[k];
        if (!Number.isFinite(v) || v < r.min || v > r.max) {
          return t('admin.objects.problem.range', { label, min: fmt(r.min), max: fmt(r.max) });
        }
      }
      if (o.safePoint && !inside(env.bounds, o.safePoint))
        return t('admin.objects.problem.safeOutside');
      return null;
    }
    case 'behaviors': {
      if (o.behaviors.length === 0) return t('admin.objects.problem.noBehaviors');
      const seen = new Set<string>();
      for (const b of o.behaviors) {
        if (!(b.type in BEHAVIOR_CATALOG))
          return t('admin.objects.problem.unknownBehavior', { type: b.type });
        if (seen.has(b.type))
          return t('admin.objects.problem.repeated', {
            label: BEHAVIOR_CATALOG[b.type as BehaviorType].label,
          });
        seen.add(b.type);
      }
      return null;
    }
    case 'params': {
      for (const b of o.behaviors) {
        const why = behaviorParamsProblem(b);
        if (why) return why;
      }
      return null;
    }
    case 'links': {
      const l = o.links;
      if (l.eventId && !env.eventIds.has(l.eventId))
        return t('admin.objects.problem.noEvent', { id: l.eventId });
      if (
        l.achievementTrigger &&
        !(ACHIEVEMENT_TRIGGERS as readonly string[]).includes(l.achievementTrigger)
      ) {
        return t('admin.objects.problem.noTrigger', { id: l.achievementTrigger });
      }
      if (l.destination && !inside(env.bounds, l.destination))
        return t('admin.objects.problem.destinationOutside');
      return null;
    }
    case 'preview':
      return objectPlaceProblem(o);
    case 'save':
      return null;
  }
}

/** Todos los pasos de golpe: el primero que falla, con su índice, o null. */
export function firstProblem(
  o: WorldObjectRecord,
  env: StepEnv,
): { step: number; why: string } | null {
  for (let i = 0; i < OBJECT_STEPS.length; i++) {
    const why = stepProblem(OBJECT_STEPS[i]!, o, env);
    if (why) return { step: i, why };
  }
  return null;
}

/**
 * Por qué el objeto no es un lugar que el motor sepa ejecutar, o null: el
 * esquema del lugar y lo que pide cada comportamiento (§48.8: COLISIÓN con
 * huella, PROXIMIDAD con radio, RECOGIBLE con radio de recogida…).
 */
export function objectPlaceProblem(o: WorldObjectRecord): string | null {
  const place = Place.safeParse(objectToPlace(o));
  if (!place.success) return t('admin.objects.problem.invalid', { issue: issueText(place.error) });
  const p = place.data;
  const obj = WorldObject.safeParse({
    identity: { id: p.id, name: p.name, category: p.category },
    appearance: { asset: o.asset.ref },
    position: p.position,
    geometry: p.geometry,
    behaviors: p.behaviors,
  });
  if (!obj.success) return t('admin.objects.problem.invalid', { issue: issueText(obj.error) });
  const collision = obj.data.behaviors.find((b) => b.type === 'collision');
  if (
    collision?.type === 'collision' &&
    (collision.params.solid ?? COLLISION_DEFAULTS[collision.params.mode].solid) &&
    o.hitboxKind !== 'collision'
  ) {
    return t('admin.objects.problem.solidNeedsCollision');
  }
  return null;
}
