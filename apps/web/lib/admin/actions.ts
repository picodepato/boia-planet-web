import {
  COMMON_DISCOUNT_CODE_MAX,
  EVENT_STATES,
  type Album,
  type BoiaEvent,
  type Discount,
  type DiscountInput,
  type EventState,
  type HomeBlock,
  type ObjectTemplate,
  type Photo,
  type WorldObjectRecord,
  type WorldObjectRecordInput,
  discountSchema,
  eventAlbumId,
  eventSchema,
  worldObjectSchema,
} from '@boia/contracts';
import {
  type AchievementDefinition,
  type AdminOptions,
  type BoiaRepository,
  type CarnetModerationAction,
  type ContentArea,
  type EntityArea,
  type MissionImpact,
  type MusicTrack,
  type PlacePatch,
  type SkinPatch,
  MUSIC_DATA_MAX,
  TRASH_RETENTION_MAX_DAYS,
  TRASH_RETENTION_MIN_DAYS,
  achievementDefinitionSchema,
  isStableKey,
  mergePlacePatch,
  musicTrackSchema,
} from '@boia/store';
import type { RenameScope, WorldRegistry } from '@boia/world';
import { MINIGAMES, type TriggerChoices, triggerParamsProblem } from './achievements';
import { type ReferenceData, danglingReferences, itemName, referencesTo } from './references';
import {
  BUILTIN_TEMPLATES,
  type StepEnv,
  duplicateTemplate,
  firstProblem,
  freeId,
  templateFromObject,
} from './objects';
import { type LinkRow, isEmail, parseLinks, parseStoreContact } from './links';
import { circuitIds, missionDestinationProblem, worldProblem } from './validate';
import {
  EMPTY_WORLD_CONTENT,
  MAP_POINTS,
  type MapPointKey,
  composeLiveWorld,
  discountHidingPlaces,
  eventIslands,
  liveMap,
} from './world';
import { t as msg } from '../i18n';

/**
 * Lo que hace el Admin de la demo (T26, REQ-ADM-008, REQ-ADM-039) sobre el
 * repositorio local (T16), con las comprobaciones que el repositorio no puede
 * hacer solo porque no conoce el mundo: islas y lugares que existen, que
 * ninguna isla corte el paso, que nada acabe en tierra. Cada cambio pasa por
 * `repo.admin`, que lo anota en la auditoría local con autor `admin-demo`.
 * Un rechazo es un `AdminError` con el motivo para la interfaz.
 */

export class AdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminError';
  }
}

export interface AdminDeps {
  repo: BoiaRepository;
  /** Mundos sobre el mapa compartido (`WORLD_REGISTRY`). */
  registry: WorldRegistry;
  now?: () => Date;
}

const opts = (reason: string | null | undefined): AdminOptions => ({ reason: reason ?? null });

/** Un slug a partir de un nombre (ids de eventos y artistas nuevos). */
export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Un código nuevo o editado desde el Admin (sin id: se saca del código). */
export type DiscountFormInput = Omit<DiscountInput, 'id' | 'sample'> & {
  id?: string;
  sample?: boolean;
};

/** Códigos: letras y cifras (y guiones), en mayúsculas, como los copia la gente. */
const DISCOUNT_CODE = /^[A-Z0-9][A-Z0-9-]{2,23}$/;

/** Una foto ya subida (su archivo guardado), para `addIslandPhotos`. */
export interface UploadedPhoto {
  id: string;
  /** Foto o clip (plan 019 T216); sin decir, foto. */
  kind?: 'image' | 'video';
  src: string;
  /** El póster de un clip. */
  poster?: string;
  alt: string;
  width: number;
  height: number;
}

export type EventInput = Omit<BoiaEvent, 'id' | 'slug' | 'sample'> & {
  id?: string;
  slug?: string;
  sample?: boolean;
};

/** Botones de la portada que se editan (REQ-ADM-017) y su clave de texto. */
export const HOME_CTA_KEYS = { explore: 'hero.explore', tickets: 'hero.tickets' } as const;
export type HomeCta = keyof typeof HOME_CTA_KEYS;
export const HOME_CTA_MAX = 40;

/** Iconos de logro que se pueden elegir (claves de arte; `muestra`). */
export const ACHIEVEMENT_ICONS = [
  'boia',
  'isla',
  'barco',
  'ancla',
  'brujula',
  'estrella',
  'botella',
  'faro',
  'canon',
  'reloj',
  'entrada',
  'carnet',
  'delfin',
  'cofre',
] as const;

/** Un logro nuevo o editado (sin id: se saca del título; la versión la pone el repositorio). */
export type AchievementInput = Omit<
  AchievementDefinition,
  'id' | 'version' | 'sample' | 'triggerParams'
> & {
  id?: string;
  triggerParams?: AchievementDefinition['triggerParams'];
  sample?: boolean;
};

/** Una pista de música subida (sin id: se saca del título). */
export type MusicInput = Omit<MusicTrack, 'id' | 'sample' | 'kind'> & {
  id?: string;
  kind?: MusicTrack['kind'];
};

/** Segunda confirmación: el nombre escrito tiene que ser el del elemento, tal cual. */
function confirmName(name: string, typed: string): void {
  if (typed.trim() !== name) {
    throw new AdminError(msg('admin.actions.paraConfirmarEscribeEl', { name }));
  }
}

export function createAdminActions(deps: AdminDeps) {
  const { repo, registry } = deps;
  const now = deps.now ?? (() => new Date());

  const content = async () => ({
    places: await repo.content.places(),
    skins: await repo.content.skins(),
    events: await repo.content.events(),
    missionDestinations: await repo.content.missionDestinations(),
    objects: await repo.content.list('worldObjects'),
    now: now(),
  });

  /** Por qué el mundo no se podría jugar con estos cambios, o null. */
  const worldWith = async (next: {
    places?: Record<string, PlacePatch>;
    skins?: Record<string, Record<string, SkinPatch>>;
    events?: BoiaEvent[];
    objects?: WorldObjectRecord[];
  }) => {
    const c = await content();
    return worldProblem(registry, {
      places: next.places ?? c.places,
      skins: next.skins ?? c.skins,
      events: next.events ?? c.events,
      missionDestinations: c.missionDestinations,
      objects: next.objects ?? c.objects,
      now: c.now,
    });
  };

  /** Rechaza el estado del mundo si no se puede jugar. */
  const checkWorld = async (next: Parameters<typeof worldWith>[0]) => {
    const why = await worldWith(next);
    if (why) throw new AdminError(why);
  };

  /** Lo que los pasos de un objeto nuevo necesitan saber (ids usados, eventos, mapa). */
  const objectEnv = async (editingId?: string): Promise<StepEnv> => {
    const objects = await repo.content.list('worldObjects');
    const used = new Set<string>([
      ...registry.map.places.map((p) => p.id),
      ...Object.values(MAP_POINTS),
      ...objects.map((o) => o.id).filter((id) => id !== editingId),
    ]);
    const events = [...(await repo.content.events()), ...(await repo.admin.draftList('events'))];
    return {
      bounds: registry.map.bounds,
      usedIds: used,
      eventIds: new Set(events.map((e) => e.id)),
    };
  };

  /** Un objeto nuevo comprobado: esquema y los 10 pasos (el mar entero lo mira `checkWorld`). */
  const prepareObject = async (input: WorldObjectRecordInput): Promise<WorldObjectRecord> => {
    const parsed = worldObjectSchema.safeParse(input);
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw new AdminError(
        `objeto: ${i?.path.join('.') ?? ''} ${i?.message ?? msg('admin.actions.noValido')}`,
      );
    }
    const o = parsed.data;
    const problem = firstProblem(o, await objectEnv(o.id));
    if (problem) throw new AdminError(problem.why);
    return o;
  };

  /** Las plantillas guardadas y las de serie, para buscar ids libres. */
  const templateIds = async () =>
    new Set([
      ...BUILTIN_TEMPLATES.map((x) => x.id),
      ...(await repo.content.list('objectTemplates')).map((x) => x.id),
    ]);

  const homeBlock = async (id: string): Promise<HomeBlock> => {
    const b = (await repo.admin.draftList('homeBlocks')).find((x) => x.id === id);
    if (!b) throw new AdminError(msg('admin.actions.noExisteElBloque', { id }));
    return b;
  };

  /** El bloque de la home de ese tipo, en el borrador (la home tiene uno de cada). */
  const blockOfType = async <T extends HomeBlock['type']>(
    type: T,
  ): Promise<Extract<HomeBlock, { type: T }>> => {
    const b = (await repo.admin.draftList('homeBlocks')).find((x) => x.type === type);
    if (!b) throw new AdminError(msg('admin.links.error.noBlock', { type }));
    return b as Extract<HomeBlock, { type: T }>;
  };

  /** Un evento del formulario, comprobado: id libre, isla y artistas que existen, esquema. */
  const prepareEvent = async (input: EventInput): Promise<BoiaEvent> => {
    const name = input.name.trim();
    const id = input.id ?? `ev-${slugify(name) || 'evento'}`;
    const slug = input.slug ?? (slugify(name) || id);
    const known = new Set([
      ...(await repo.content.events()).map((e) => e.id),
      ...(await repo.admin.draftList('events')).map((e) => e.id),
    ]);
    if (!input.id && known.has(id)) {
      throw new AdminError(msg('admin.actions.yaHayUnEvento', { id }));
    }
    if (input.islandId) {
      const ok = eventIslands(registry.map).some((p) => p.id === input.islandId);
      if (!ok)
        throw new AdminError(msg('admin.actions.laIslaNoExiste', { islandId: input.islandId }));
    }
    const artists = new Set((await repo.content.list('artists')).map((a) => a.id));
    const missing = input.artistIds.filter((a) => !artists.has(a));
    if (missing.length) throw new AdminError(`no existen los artistas: ${missing.join(', ')}`);
    const candidate = { ...input, id, slug, name, sample: input.sample ?? false };
    if (!candidate.islandId) delete candidate.islandId;
    if (!candidate.stateNote) delete candidate.stateNote;
    if (!candidate.ticketUrl) delete candidate.ticketUrl;
    const parsed = eventSchema.safeParse(candidate);
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw new AdminError(
        `evento: ${i?.path.join('.') ?? ''} ${i?.message ?? msg('admin.actions.noValido')}`,
      );
    }
    return parsed.data;
  };

  /** Un elemento tal como lo ve el Admin: en las áreas con borrador, con el borrador encima. */
  const findItem = async (area: EntityArea, id: string): Promise<unknown> => {
    if (area === 'events' || area === 'homeBlocks') {
      return (await repo.admin.draftList(area)).find((x) => x.id === id) ?? null;
    }
    return repo.content.get(area, id);
  };

  /** Opciones que existen para los parámetros de logro (circuitos, minijuegos, mundos). */
  const triggerChoices = (): TriggerChoices => {
    const world = composeLiveWorld(registry, registry.defaultId, EMPTY_WORLD_CONTENT).config;
    return { circuits: circuitIds(world), games: MINIGAMES, worlds: registry.ids() };
  };

  /** Todo lo que se cruza para impacto y referencias rotas (con o sin borrador). */
  const referenceData = async ({ draft }: { draft: boolean }): Promise<ReferenceData> => {
    const events = draft ? await repo.admin.draftList('events') : await repo.content.events();
    const homeBlocks = draft
      ? await repo.admin.draftList('homeBlocks')
      : await repo.content.list('homeBlocks');
    const discounts = await repo.content.list('discounts');
    const map = liveMap(registry, {
      places: await repo.content.places(),
      skins: await repo.content.skins(),
      events,
      discounts,
      now: now(),
    });
    const [purchases, found, progress, owned] = await Promise.all([
      repo.purchases.list(),
      repo.progress.discounts(),
      repo.progress.achievements(),
      repo.progress.cosmetics(),
    ]);
    return {
      events,
      homeBlocks,
      artists: await repo.content.list('artists'),
      albums: await repo.content.list('albums'),
      photos: await repo.content.list('photos'),
      discounts,
      achievements: await repo.content.list('achievements'),
      cosmetics: await repo.content.list('cosmetics'),
      map,
      worldIds: registry.ids(),
      visitor: {
        purchaseEventIds: purchases.map((p) => p.eventId),
        foundDiscountIds: found.map((f) => f.discount.id),
        achievementIds: progress.filter((a) => a.obtained).map((a) => a.definition.id),
        cosmeticIds: owned.map((c) => c.id),
      },
    };
  };

  const api = {
    // --- Eventos -----------------------------------------------------------

    /**
     * Crea o edita un evento y lo publica ya («Guardar y publicar»). La isla,
     * si la hay, tiene que admitir eventos. Si tenía borrador, lo sustituye.
     */
    async saveEvent(input: EventInput, reason?: string | null): Promise<BoiaEvent> {
      const event = await prepareEvent(input);
      const events = await repo.content.events();
      await checkWorld({ events: [...events.filter((e) => e.id !== event.id), event] });
      return repo.admin.upsert('events', event, opts(reason));
    },

    /**
     * Guarda un evento en el borrador (REQ-ADM-015): no se ve en la web ni en
     * el mar hasta «Publicar». Mismas comprobaciones que al publicar.
     */
    async saveEventDraft(input: EventInput, reason?: string | null): Promise<BoiaEvent> {
      const event = await prepareEvent(input);
      const events = await repo.admin.draftList('events');
      await checkWorld({ events: [...events.filter((e) => e.id !== event.id), event] });
      return repo.admin.draftUpsert(
        'events',
        event,
        opts(reason ?? msg('admin.actions.borradorDeEvento')),
      );
    },

    /**
     * Estado fijado a mano desde la lista (REQ-COM-004): se publica al
     * momento y, si el evento tiene borrador, el borrador lo recoge también
     * (así «Publicar» no lo deshace).
     */
    async setEventStateManual(id: string, state: EventState) {
      if (!EVENT_STATES.includes(state)) throw new AdminError(`estado desconocido: ${state}`);
      const published = await repo.content.get('events', id);
      const draft = (await repo.admin.pendingDrafts()).some(
        (c) => c.area === 'events' && c.id === id,
      )
        ? (await repo.admin.draftList('events')).find((e) => e.id === id)
        : undefined;
      if (!published && !draft) throw new AdminError(msg('admin.actions.noExisteElEvento', { id }));
      const why = `estado a mano: ${state}`;
      if (published) {
        await api.saveEvent({ ...published, state, stateSource: 'manual' }, why);
      }
      if (draft) {
        await repo.admin.draftUpsert(
          'events',
          { ...draft, state, stateSource: 'manual' },
          opts(why),
        );
      }
    },

    /** Cambia el estado a mano (los siete estados de REQ-COM-003), con su nota. */
    async setEventState(id: string, state: EventState, note?: string | null) {
      if (!EVENT_STATES.includes(state)) throw new AdminError(`estado desconocido: ${state}`);
      const e = await repo.content.get('events', id);
      if (!e) throw new AdminError(msg('admin.actions.noExisteElEvento', { id }));
      const next: BoiaEvent = { ...e, state };
      if (note) next.stateNote = note;
      else delete next.stateNote;
      return repo.admin.upsert('events', next, opts(`estado: ${state}`));
    },

    /**
     * Fotos de una isla (T189, decisión 4, D-23 punto 7): las fotos ya
     * subidas van al álbum del evento (`album-<evento>`, se crea si no
     * está), el evento queda ligado a la isla y, con `markPast`, pasa a
     * finalizado a mano: la isla lo enseña como recuerdo con su galería.
     * Sin aprobación: se publica al momento.
     */
    async addIslandPhotos(input: {
      islandId: string;
      eventId: string;
      photos: readonly UploadedPhoto[];
      markPast: boolean;
    }): Promise<{ album: Album; photos: Photo[]; event: BoiaEvent }> {
      const { islandId } = input;
      if (!eventIslands(registry.map).some((p) => p.id === islandId)) {
        throw new AdminError(msg('admin.actions.laIslaNoExiste', { islandId }));
      }
      const e = await repo.content.get('events', input.eventId);
      if (!e) throw new AdminError(msg('admin.actions.noExisteElEvento', { id: input.eventId }));
      if (e.state === 'draft') throw new AdminError(msg('admin.actions.fotosDeUnBorrador'));
      if (input.photos.length === 0) throw new AdminError(msg('admin.actions.fotosSinArchivos'));
      const why = msg('admin.actions.fotosDeLaIsla', { islandId });
      const albumId = eventAlbumId(e.id);
      const had = await repo.content.get('albums', albumId);
      const album = await repo.admin.upsert(
        'albums',
        {
          id: albumId,
          title: had?.title ?? e.name,
          eventId: e.id,
          islandId,
          date: had?.date ?? e.startsAt,
          coverPhotoId: had?.coverPhotoId ?? input.photos[0]!.id,
          sample: false,
        },
        opts(why),
      );
      const photos: Photo[] = [];
      for (const p of input.photos) {
        photos.push(
          await repo.admin.upsert('photos', { ...p, albumId, selection: false }, opts(why)),
        );
      }
      let event = e;
      if (input.markPast || e.islandId !== islandId) {
        event = await api.saveEvent(
          {
            ...e,
            islandId,
            ...(input.markPast
              ? { state: 'finished' as const, stateSource: 'manual' as const }
              : {}),
          },
          input.markPast ? msg('admin.actions.eventoPasado') : why,
        );
      }
      return { album, photos, event };
    },

    /** Liga (o suelta, con null) un evento a una isla. La isla se queda con sus recuerdos. */
    async linkEventToIsland(eventId: string, islandId: string | null) {
      const e = await repo.content.get('events', eventId);
      if (!e) throw new AdminError(msg('admin.actions.noExisteElEvento2', { eventId }));
      const next: BoiaEvent = { ...e };
      if (islandId) next.islandId = islandId;
      else delete next.islandId;
      return api.saveEvent(next, islandId ? `isla: ${islandId}` : msg('admin.actions.sinIsla'));
    },

    async duplicateEvent(id: string) {
      const e = await repo.content.get('events', id);
      if (!e) throw new AdminError(msg('admin.actions.noExisteElEvento', { id }));
      const events = await repo.content.events();
      let n = 2;
      while (events.some((x) => x.id === `${id}-copia-${n}`)) n++;
      const copy: BoiaEvent = {
        ...e,
        id: `${id}-copia-${n}`,
        slug: `${e.slug}-copia-${n}`,
        name: `${e.name} (copia)`,
        state: 'draft',
        sample: false,
      };
      delete copy.islandId;
      return repo.admin.upsert('events', copy, opts(msg('admin.actions.duplicadoDe', { id })));
    },

    // --- Descuentos (T43, REQ-COM-020) --------------------------------------

    /**
     * Crea o edita un código: destino (un evento o la tienda), vigencia,
     * porcentaje o importe, prioridad y dónde se esconde en el mar. Queda en
     * la auditoría como cualquier cambio del Admin.
     */
    async saveDiscount(input: DiscountFormInput, reason?: string | null): Promise<Discount> {
      const code = input.code.trim().toUpperCase();
      if (!DISCOUNT_CODE.test(code)) {
        throw new AdminError(msg('admin.actions.elCodigoVaEn'));
      }
      const id = input.id ?? `dto-${slugify(code)}`;
      const all = await repo.content.list('discounts');
      if (!input.id && all.some((d) => d.id === id)) {
        throw new AdminError(msg('admin.actions.yaHayUnDescuento', { id }));
      }
      if (all.some((d) => d.id !== id && d.code.toUpperCase() === code)) {
        throw new AdminError(msg('admin.actions.yaHayOtroDescuento', { code }));
      }
      const scope = input.scope ?? 'event';
      const candidate: DiscountInput = {
        ...input,
        id,
        code,
        label: input.label.trim(),
        scope,
        sample: input.sample ?? false,
      };
      if (scope === 'store' || !candidate.eventId) delete candidate.eventId;
      if (!candidate.hiddenAt) delete candidate.hiddenAt;
      if (!candidate.conditions) delete candidate.conditions;
      if (!candidate.url) delete candidate.url;
      if (!candidate.startsAt) delete candidate.startsAt;
      if (!candidate.endsAt) delete candidate.endsAt;
      if (candidate.eventId && !(await repo.content.get('events', candidate.eventId))) {
        throw new AdminError(
          msg('admin.actions.noExisteElEvento2', { eventId: candidate.eventId }),
        );
      }
      if (
        candidate.hiddenAt &&
        !discountHidingPlaces(registry.map).some((p) => p.id === candidate.hiddenAt)
      ) {
        throw new AdminError(
          msg('admin.actions.noEsUnEscondite', { hiddenAt: candidate.hiddenAt }),
        );
      }
      if (candidate.kind === 'percent' && (candidate.value ?? 0) > 100) {
        throw new AdminError(msg('admin.actions.unPorcentajeNoPasa'));
      }
      if (
        candidate.startsAt &&
        candidate.endsAt &&
        new Date(candidate.startsAt) >= new Date(candidate.endsAt)
      ) {
        throw new AdminError(msg('admin.actions.elDescuentoCaducaAntes'));
      }
      const parsed = discountSchema.safeParse(candidate);
      if (!parsed.success) {
        const i = parsed.error.issues[0];
        throw new AdminError(
          `descuento: ${i?.path.join('.') ?? ''} ${i?.message ?? msg('admin.actions.noValido')}`,
        );
      }
      return repo.admin.upsert('discounts', parsed.data, opts(reason ?? 'descuento'));
    },

    /**
     * Caduca un código ya (su fin pasa a ahora): quien lo tenga lo ve
     * caducado y ya no se aplica. Se puede reactivar editando su fecha.
     */
    async expireDiscount(id: string) {
      const d = await repo.content.get('discounts', id);
      if (!d) throw new AdminError(msg('admin.actions.noExisteElDescuento', { id }));
      const at = now();
      const next: Discount = { ...d, endsAt: at.toISOString() };
      if (next.startsAt && new Date(next.startsAt) >= at) delete next.startsAt;
      return repo.admin.upsert('discounts', next, opts('caducar'));
    },

    // --- Página principal (en borrador hasta «Publicar», REQ-ADM-015) -------

    /** Sube (-1) o baja (+1) un bloque de la home. */
    async moveBlock(id: string, delta: -1 | 1) {
      const ids = (await repo.admin.draftList('homeBlocks')).map((b) => b.id);
      const i = ids.indexOf(id);
      const j = i + delta;
      if (i < 0) throw new AdminError(msg('admin.actions.noExisteElBloque', { id }));
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
      await repo.admin.draftReorder('homeBlocks', ids, opts(`mover ${id}`));
    },

    async setBlockVisible(id: string, visible: boolean) {
      const b = await homeBlock(id);
      await repo.admin.draftUpsert(
        'homeBlocks',
        { ...b, visible },
        opts(visible ? 'mostrar' : 'ocultar'),
      );
    },

    /** Titular y subtítulo de la portada. */
    async setHeroTexts(title: string, positioning: string) {
      const hero = (await repo.admin.draftList('homeBlocks')).find((b) => b.type === 'hero');
      if (!hero || hero.type !== 'hero') throw new AdminError(msg('admin.actions.laHomeNoTiene'));
      const t = title.trim();
      const p = positioning.trim();
      if (!t || !p) throw new AdminError(msg('admin.actions.laPortadaNecesitaTitular'));
      await repo.admin.draftUpsert(
        'homeBlocks',
        { ...hero, title: t, positioning: p },
        opts('portada'),
      );
    },

    /**
     * Textos de los botones de la portada (REQ-ADM-017): «Explorar» y
     * «Tickets». Vacío o igual al de la app: vuelve al de la app.
     */
    async setHomeCtas(ctas: Partial<Record<HomeCta, string>>, defaults: Record<HomeCta, string>) {
      for (const [cta, key] of Object.entries(HOME_CTA_KEYS) as [HomeCta, string][]) {
        const v = ctas[cta];
        if (v === undefined) continue;
        const text = v.trim();
        if (text.length > HOME_CTA_MAX) {
          throw new AdminError(
            msg('admin.actions.elBotonAdmiteHasta', { v1: defaults[cta], HOME_CTA_MAX }),
          );
        }
        await repo.admin.draftText(
          key,
          text && text !== defaults[cta] ? text : null,
          opts('botón'),
        );
      }
    },

    /** Eventos que no salen en «Próximos eventos» (REQ-ADM-017, REQ-COM-011); no los borra. */
    async setExcludedEvents(eventIds: readonly string[]) {
      const block = (await repo.admin.draftList('homeBlocks')).find(
        (b) => b.type === 'upcoming_events',
      );
      if (!block || block.type !== 'upcoming_events') {
        throw new AdminError(msg('admin.actions.laHomeNoTiene2'));
      }
      const known = new Set((await repo.admin.draftList('events')).map((e) => e.id));
      const missing = eventIds.filter((id) => !known.has(id));
      if (missing.length) throw new AdminError(`no existen los eventos: ${missing.join(', ')}`);
      await repo.admin.draftUpsert(
        'homeBlocks',
        { ...block, excludeEventIds: [...new Set(eventIds)] },
        opts(msg('admin.actions.excluirEventos')),
      );
    },

    /** Programa un bloque: ISO con zona o null para quitar el límite. */
    async scheduleBlock(id: string, showFrom: string | null, showUntil: string | null) {
      const b = await homeBlock(id);
      if (showFrom && showUntil && new Date(showFrom) >= new Date(showUntil)) {
        throw new AdminError(msg('admin.actions.laProgramacionTerminaAntes'));
      }
      const next: HomeBlock = { ...b };
      if (showFrom) next.showFrom = showFrom;
      else delete next.showFrom;
      if (showUntil) next.showUntil = showUntil;
      else delete next.showUntil;
      await repo.admin.draftUpsert('homeBlocks', next, opts('programar'));
    },

    /** Evento prioritario del bloque de la home (null: el que resuelva la home). */
    async setPriorityEvent(eventId: string | null) {
      const block = (await repo.admin.draftList('homeBlocks')).find(
        (b) => b.type === 'priority_event',
      );
      if (!block || block.type !== 'priority_event') {
        throw new AdminError(msg('admin.actions.laHomeNoTiene3'));
      }
      if (eventId && !(await repo.admin.draftList('events')).some((e) => e.id === eventId)) {
        throw new AdminError(msg('admin.actions.noExisteElEvento2', { eventId }));
      }
      const next = { ...block };
      if (eventId) next.eventId = eventId;
      else delete next.eventId;
      await repo.admin.draftUpsert(
        'homeBlocks',
        next,
        opts(msg('admin.actions.eventoPrioritario')),
      );
    },

    // --- Enlaces de la tienda, el contacto y el pie (plan 017 T192) ---------

    /**
     * El contacto de «Comprar» de la tienda (decisión 11). Los dos vacíos:
     * vuelve al de serie (products.json).
     */
    async setStoreContact(handle: string, url: string) {
      const block = await blockOfType('store');
      const parsed = parseStoreContact(handle, url);
      if (!parsed.ok) throw new AdminError(parsed.error);
      const next = { ...block };
      if (parsed.contact) next.contact = parsed.contact;
      else delete next.contact;
      await repo.admin.draftUpsert('homeBlocks', next, opts(msg('admin.links.audit.store')));
    },

    /** El correo (vacío: sin correo) y los enlaces del bloque Contacto. */
    async setContactLinks(email: string, rows: readonly LinkRow[]) {
      const block = await blockOfType('contact');
      const mail = email.trim();
      if (mail && !isEmail(mail)) throw new AdminError(msg('admin.links.error.email'));
      const parsed = parseLinks(rows);
      if (!parsed.ok) throw new AdminError(parsed.error);
      const next = { ...block, links: parsed.links };
      if (mail) next.email = mail;
      else delete next.email;
      await repo.admin.draftUpsert('homeBlocks', next, opts(msg('admin.links.audit.contact')));
    },

    /** Los enlaces oficiales del pie (Instagram, TikTok, Spotify…). */
    async setFooterLinks(rows: readonly LinkRow[]) {
      const block = await blockOfType('footer');
      const parsed = parseLinks(rows);
      if (!parsed.ok) throw new AdminError(parsed.error);
      await repo.admin.draftUpsert(
        'homeBlocks',
        { ...block, officialLinks: parsed.links },
        opts(msg('admin.links.audit.footer')),
      );
    },

    // --- Borrador y publicación (REQ-ADM-015, REQ-ADM-014) ------------------

    /**
     * Lo que impide publicar el borrador, cada cosa con su motivo: referencias
     * rotas (home, mapa, eventos, logros), un mar que no se puede jugar con
     * los eventos del borrador o una home sin portada. Vacío: se puede.
     */
    async publishProblems(): Promise<string[]> {
      const out: string[] = [];
      const data = await referenceData({ draft: true });
      out.push(...danglingReferences(data));
      const hero = data.homeBlocks.find((b) => b.type === 'hero');
      if (!hero || !hero.visible) {
        out.push(msg('admin.actions.paginaPrincipalLaPortada'));
      }
      const texts = await repo.admin.draftTexts();
      for (const key of Object.values(HOME_CTA_KEYS)) {
        if (texts[key] !== undefined && texts[key].trim() === '') {
          out.push(msg('admin.actions.paginaPrincipalElBoton', { key }));
        }
      }
      try {
        await checkWorld({ events: [...data.events] });
      } catch (err) {
        out.push(
          msg('admin.actions.mapa', { v1: err instanceof Error ? err.message : String(err) }),
        );
      }
      return out;
    },

    /** Publica todo el borrador de una vez (una revisión nueva) si no hay problemas. */
    async publish(reason?: string | null) {
      if ((await repo.admin.pendingDrafts()).length === 0) {
        throw new AdminError(msg('admin.actions.noHayCambiosSin'));
      }
      const problems = await api.publishProblems();
      if (problems.length) {
        throw new AdminError(`no se publica: ${problems.join(' · ')}`);
      }
      return repo.admin.publish(opts(reason ?? 'publicar'));
    },

    /** Tira el borrador (todo, o el de un evento). */
    async discardDrafts(target?: { area: 'homeBlocks' | 'events' | 'texts'; id?: string }) {
      await repo.admin.discardDrafts(target ?? null, opts(msg('admin.actions.descartarBorrador')));
    },

    // --- Borrar con impacto y papelera (REQ-ADM-029, REQ-ADM-030) -----------

    /** Nombre del elemento y qué lo nombra: lo que se enseña antes de borrarlo. */
    async impact(area: EntityArea, id: string) {
      const item = await findItem(area, id);
      if (!item) throw new AdminError(msg('admin.actions.noExiste', { id }));
      const data = await referenceData({ draft: false });
      return { name: itemName(area, item), references: referencesTo(area, id, data) };
    },

    /**
     * A la papelera, sólo si se escribe su nombre exacto (segunda
     * confirmación inequívoca, REQ-ADM-029). Un evento que sólo existe en el
     * borrador se descarta.
     */
    async trashItem(area: EntityArea, id: string, typedName: string, reason?: string | null) {
      const item = await findItem(area, id);
      if (!item) throw new AdminError(msg('admin.actions.noExiste', { id }));
      confirmName(itemName(area, item), typedName);
      const published = await repo.content.get(area, id);
      if (!published && (area === 'events' || area === 'homeBlocks')) {
        await repo.admin.discardDrafts(
          { area, id },
          opts(reason ?? msg('admin.actions.borrarBorrador')),
        );
        return;
      }
      await repo.admin.remove(area, id, opts(reason ?? 'papelera'));
    },

    /**
     * Purga un elemento de la papelera: irreversible, con otra confirmación
     * escribiendo su nombre (en la demo no hay login con el que
     * reautenticarse, REQ-ADM-030).
     */
    async purgeItem(area: EntityArea, id: string, typedName: string) {
      const item = (await repo.admin.trash()).find((t) => t.area === area && t.id === id);
      if (!item) throw new AdminError(msg('admin.actions.noEstaEnLa', { id }));
      confirmName(itemName(area, item.value), typedName);
      await repo.admin.purge(area, id, opts(msg('admin.actions.purgaConfirmadaEscribiendoEl')));
    },

    /** Plazo de la papelera en días (REQ-ADM-030) [pendiente Álvaro]. */
    async setTrashRetention(days: number) {
      if (
        !Number.isInteger(days) ||
        days < TRASH_RETENTION_MIN_DAYS ||
        days > TRASH_RETENTION_MAX_DAYS
      ) {
        throw new AdminError(
          msg('admin.actions.elPlazoDeLa', { TRASH_RETENTION_MIN_DAYS, TRASH_RETENTION_MAX_DAYS }),
        );
      }
      return repo.admin.setSettings(
        { trashRetentionDays: days },
        opts(msg('admin.actions.plazoDeLaPapelera')),
      );
    },

    /**
     * El código común de la ticketera (plan 019 T215, decisión 7): fijado,
     * todos los descuentos de entradas enseñan ese código; vacío, cada uno el
     * suyo. Queda en la auditoría.
     */
    async setCommonDiscountCode(code: string) {
      const value = code.trim().toUpperCase();
      if (value.length > COMMON_DISCOUNT_CODE_MAX) {
        throw new AdminError(msg('admin.discounts.common.tooLong', { max: COMMON_DISCOUNT_CODE_MAX }));
      }
      return repo.admin.setSettings(
        { commonDiscountCode: value || undefined },
        opts(msg('admin.discounts.common.reason')),
      );
    },

    /**
     * La analítica de visitas (plan 019 T223, decisión 17): encendida o
     * apagada, con auditoría. En modo local vale para este navegador.
     */
    async setAnalyticsEnabled(on: boolean) {
      return repo.admin.setSettings(
        { analyticsEnabled: on ? true : undefined },
        opts(msg('admin.gestion.analytics.reason')),
      );
    },

    /** Deshace un cambio de la papelera (plan 019 T223). */
    async revertChange(id: string) {
      return repo.admin.revertChange(id);
    },

    async purgeExpired() {
      return repo.admin.purgeExpired(opts(msg('admin.actions.plazoDeLaPapelera2')));
    },

    // --- Logros (REQ-ADM-021, REQ-ADM-022) ----------------------------------

    /**
     * Crea o edita un logro con una condición del catálogo, sus parámetros en
     * rango, premio, icono, ámbito y fechas. Cambiar la condición de uno que
     * ya existe es una versión nueva (lo decide el repositorio).
     */
    async saveAchievement(input: AchievementInput, reason?: string | null) {
      const title = input.title.trim();
      if (!title) throw new AdminError(msg('admin.actions.unLogroNecesitaTitulo'));
      const all = await repo.content.list('achievements');
      const id = input.id ?? (slugify(title) || 'logro');
      if (!isStableKey(id)) throw new AdminError(msg('admin.actions.noValeComoId', { id }));
      if (!input.id && all.some((a) => a.id === id)) {
        throw new AdminError(msg('admin.actions.yaHayUnLogro', { id }));
      }
      const params = input.triggerParams ?? {};
      const why = triggerParamsProblem(input.trigger, params, triggerChoices());
      if (why) throw new AdminError(`condición: ${why}`);
      if (input.scope === 'season') {
        if (!input.seasonId || !registry.has(input.seasonId)) {
          throw new AdminError(msg('admin.actions.unLogroDeTemporada'));
        }
      }
      if (input.cosmeticKey && !(await repo.content.get('cosmetics', input.cosmeticKey))) {
        throw new AdminError(
          msg('admin.actions.noExisteElPremio', { cosmeticKey: input.cosmeticKey }),
        );
      }
      if (input.startsAt && input.endsAt && new Date(input.startsAt) >= new Date(input.endsAt)) {
        throw new AdminError(msg('admin.actions.elLogroTerminaAntes'));
      }
      if (input.iconKey && !(ACHIEVEMENT_ICONS as readonly string[]).includes(input.iconKey)) {
        throw new AdminError(`icono desconocido: ${input.iconKey}`);
      }
      const candidate: Record<string, unknown> = {
        ...input,
        id,
        title,
        triggerParams: params,
        sample: input.sample ?? false,
      };
      if (input.scope !== 'season') delete candidate.seasonId;
      for (const k of ['description', 'iconKey', 'cosmeticKey', 'badgeKey', 'startsAt', 'endsAt']) {
        if (!candidate[k]) delete candidate[k];
      }
      const parsed = achievementDefinitionSchema.safeParse(candidate);
      if (!parsed.success) {
        const i = parsed.error.issues[0];
        throw new AdminError(
          `logro: ${i?.path.join('.') ?? ''} ${i?.message ?? msg('admin.actions.noValido')}`,
        );
      }
      return repo.admin.upsert('achievements', parsed.data, opts(reason ?? 'logro'));
    },

    /** Duplica un logro como uno nuevo, desactivado hasta revisarlo. */
    async duplicateAchievement(id: string) {
      const a = await repo.content.get('achievements', id);
      if (!a) throw new AdminError(msg('admin.actions.noExisteElLogro', { id }));
      const all = await repo.content.list('achievements');
      let n = 2;
      while (all.some((x) => x.id === `${id}-copia-${n}`)) n++;
      return repo.admin.upsert(
        'achievements',
        { ...a, id: `${id}-copia-${n}`, title: `${a.title} (copia)`, active: false, sample: false },
        opts(msg('admin.actions.duplicadoDe', { id })),
      );
    },

    // --- Música (REQ-ADM-020) -----------------------------------------------

    /** Sube una pista (data URL `muestra`) con su licencia y origen. */
    async saveMusic(input: MusicInput) {
      const title = input.title.trim();
      if (!title) throw new AdminError(msg('admin.actions.laPistaNecesitaTitulo'));
      if (!input.licence.trim()) throw new AdminError(msg('admin.actions.faltaLaLicenciaDe'));
      if (!input.origin.trim()) throw new AdminError(msg('admin.actions.faltaElAutorU'));
      if (!/^data:audio\//.test(input.src))
        throw new AdminError(msg('admin.actions.elArchivoNoEs'));
      if (input.src.length > MUSIC_DATA_MAX) {
        throw new AdminError(
          msg('admin.actions.elAudioPesaDemasiado', {
            Math: Math.floor((MUSIC_DATA_MAX * 3) / 4 / 1024),
          }),
        );
      }
      if (input.worldId && !registry.has(input.worldId)) {
        throw new AdminError(msg('admin.actions.noExisteElMundo', { worldId: input.worldId }));
      }
      const all = await repo.content.list('music');
      const id = input.id ?? `musica-${slugify(title) || 'pista'}`;
      if (!input.id && all.some((m) => m.id === id)) {
        throw new AdminError(msg('admin.actions.yaHayUnaPista', { id }));
      }
      const candidate: Record<string, unknown> = {
        ...input,
        id,
        title,
        licence: input.licence.trim(),
        origin: input.origin.trim(),
        sample: true,
      };
      if (!candidate.worldId) delete candidate.worldId;
      if (!candidate.licenceUrl) delete candidate.licenceUrl;
      const parsed = musicTrackSchema.safeParse(candidate);
      if (!parsed.success) {
        const i = parsed.error.issues[0];
        throw new AdminError(
          `pista: ${i?.path.join('.') ?? ''} ${i?.message ?? msg('admin.actions.noValida')}`,
        );
      }
      return repo.admin.upsert('music', parsed.data, opts('música'));
    },

    // --- Mundo --------------------------------------------------------------

    /**
     * Cambio compartido de un lugar (posición, parámetros, activado): vale en
     * todos los mundos. Se rechaza con su motivo si el mar deja de jugarse.
     */
    async editPlace(placeId: string, patch: PlacePatch, reason?: string | null) {
      const places = await repo.content.places();
      const merged = mergePlacePatch(places[placeId], patch);
      await checkWorld({ places: { ...places, [placeId]: merged } });
      await repo.admin.setPlace(placeId, patch, opts(reason ?? 'mundo'));
    },

    /** Mueve la salida, el puerto o el aterrizaje de la entrada. */
    async setMapPoint(key: MapPointKey, p: { x: number; y: number }) {
      return api.editPlace(MAP_POINTS[key], { x: p.x, y: p.y }, `punto del mapa: ${key}`);
    },

    // --- Objetos nuevos y plantillas (T190, REQ-ADM-010, REQ-ADM-011) -------

    /** Lo que necesitan los pasos del asistente de objetos. */
    objectEnv,

    /**
     * Previsualización (paso 9): por qué el objeto no se podría publicar, o
     * null. Se compone el mar con él publicado, como lo jugaría el motor.
     */
    async objectPreviewProblem(input: WorldObjectRecordInput): Promise<string | null> {
      try {
        const o = await prepareObject(input);
        const others = (await repo.content.list('worldObjects')).filter((x) => x.id !== o.id);
        return await worldWith({ objects: [...others, { ...o, status: 'published' }] });
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    },

    /**
     * Guarda un objeto (paso 10): en borrador no sale en el mar; publicado
     * sale en todos los mundos. Se rechaza con su motivo si algún paso falla
     * o si, publicado, el mar dejaría de jugarse.
     */
    async saveObject(input: WorldObjectRecordInput, publish: boolean): Promise<WorldObjectRecord> {
      const o = await prepareObject({ ...input, status: publish ? 'published' : 'draft' });
      const others = (await repo.content.list('worldObjects')).filter((x) => x.id !== o.id);
      await checkWorld({ objects: [...others, o] });
      return repo.admin.upsert(
        'worldObjects',
        o,
        opts(publish ? msg('admin.objects.reason.publish') : msg('admin.objects.reason.draft')),
      );
    },

    /** Publica o devuelve a borrador un objeto ya guardado. */
    async setObjectStatus(id: string, publish: boolean) {
      const o = await repo.content.get('worldObjects', id);
      if (!o) throw new AdminError(msg('admin.objects.problem.noObject', { id }));
      return api.saveObject(o, publish);
    },

    /** Una copia en borrador de un objeto, un poco al este, con id y nombre propios. */
    async duplicateObject(id: string): Promise<WorldObjectRecord> {
      const o = await repo.content.get('worldObjects', id);
      if (!o) throw new AdminError(msg('admin.objects.problem.noObject', { id }));
      const env = await objectEnv();
      const name = msg('admin.objects.copyOf', { name: o.name }).slice(0, 80);
      const copy = {
        ...structuredClone(o),
        id: freeId(name, env.usedIds),
        name,
        x: Math.min(env.bounds.right, o.x + 120),
        status: 'draft' as const,
      };
      return api.saveObject(copy, false);
    },

    /** Guarda un objeto (o el borrador del asistente) como plantilla nueva. */
    async saveObjectAsTemplate(input: WorldObjectRecordInput, name: string) {
      if (!name.trim()) throw new AdminError(msg('admin.objects.problem.noName'));
      const parsed = worldObjectSchema.safeParse(input);
      if (!parsed.success) throw new AdminError(msg('admin.actions.noValido'));
      const template = templateFromObject(parsed.data, name, await templateIds());
      return repo.admin.upsert(
        'objectTemplates',
        template,
        opts(msg('admin.objects.reason.template')),
      );
    },

    /** Duplica una plantilla (de serie o guardada): conserva comportamientos y parámetros. */
    async duplicateObjectTemplate(id: string): Promise<ObjectTemplate> {
      const saved = await repo.content.list('objectTemplates');
      const from = [...BUILTIN_TEMPLATES, ...saved].find((x) => x.id === id);
      if (!from) throw new AdminError(msg('admin.objects.problem.noTemplate', { id }));
      const copy = duplicateTemplate(from, await templateIds());
      return repo.admin.upsert('objectTemplates', copy, opts(msg('admin.objects.reason.template')));
    },

    /** Deshace los cambios de un lugar (vuelve a la muestra). */
    async clearPlace(placeId: string) {
      const places = { ...(await repo.content.places()) };
      delete places[placeId];
      await checkWorld({ places });
      await repo.admin.setPlace(placeId, null, opts(msg('admin.actions.volverALaMuestra')));
    },

    /**
     * Renombra un lugar: sólo en este mundo o en todos (REQ-MUN-036, D-20).
     * «En todos» deja el mismo nombre en cada mundo registrado.
     */
    async renamePlace(placeId: string, name: string, scope: RenameScope) {
      const trimmed = name.trim();
      if (!trimmed) throw new AdminError(msg('admin.actions.unLugarNecesitaNombre'));
      if (!registry.map.places.some((p) => p.id === placeId)) {
        throw new AdminError(msg('admin.actions.noExisteElLugar', { placeId }));
      }
      const worlds = scope === 'all' ? registry.ids() : [scope.world];
      for (const w of worlds)
        if (!registry.has(w)) throw new AdminError(msg('admin.actions.noExisteElMundo2', { w }));
      const why =
        scope === 'all'
          ? msg('admin.actions.nombreEnTodosLos')
          : msg('admin.actions.nombreSoloEn', { world: scope.world });
      for (const w of worlds) await repo.admin.setSkin(w, placeId, { name: trimmed }, opts(why));
    },

    /** Textos de un lugar en un mundo. */
    async setPlaceTexts(worldId: string, placeId: string, texts: Record<string, string>) {
      const skins = await repo.content.skins();
      const next = {
        ...skins,
        [worldId]: {
          ...(skins[worldId] ?? {}),
          [placeId]: { ...(skins[worldId]?.[placeId] ?? {}), texts },
        },
      };
      await checkWorld({ skins: next });
      await repo.admin.setSkin(worldId, placeId, { texts }, opts('textos'));
    },

    /** Oculta (o vuelve a mostrar) un lugar sólo en un mundo. */
    async setHiddenInWorld(worldId: string, placeId: string, hidden: boolean) {
      if (!registry.isPlayable(worldId))
        throw new AdminError(msg('admin.actions.noExisteElMundo', { worldId }));
      if (!registry.map.places.some((p) => p.id === placeId)) {
        throw new AdminError(msg('admin.actions.noExisteElLugar', { placeId }));
      }
      if (hidden) {
        // Ocultar el destino de una misión en un mundo la dejaría sin destino (REQ-AVE-010).
        const skins = await repo.content.skins();
        await checkWorld({
          skins: {
            ...skins,
            [worldId]: { ...skins[worldId], [placeId]: { ...skins[worldId]?.[placeId], hidden } },
          },
        });
      }
      await repo.admin.setSkin(worldId, placeId, { hidden }, opts(hidden ? 'ocultar' : 'mostrar'));
    },

    // --- Temporadas ---------------------------------------------------------

    /**
     * Mundo activo (la temporada, D-20); null: el por defecto del registro.
     * Vive sólo en el repositorio: el mar lo lee de ahí (`adminWorldId`, T24).
     */
    async setActiveWorld(worldId: string | null) {
      if (worldId !== null && !registry.isPlayable(worldId)) {
        throw new AdminError(msg('admin.actions.noExisteElMundo', { worldId }));
      }
      await repo.admin.setActiveWorld(worldId, opts(msg('admin.actions.temporadaActiva')));
    },

    // --- Muestra ------------------------------------------------------------

    /** Vuelve un área (o todo) a los datos de muestra. Queda en la auditoría. */
    async reset(area: ContentArea | 'all') {
      await repo.admin.reset(area, opts(msg('admin.actions.volverALaMuestra')));
    },

    // --- Moderación ---------------------------------------------------------

    async removeBottle(id: string, reason: string) {
      if (!reason.trim()) throw new AdminError(msg('admin.actions.haceFaltaUnMotivo'));
      await repo.admin.removeBottle(id, opts(reason.trim()));
    },

    /**
     * Retira una respuesta, la foto o el apodo de un Carnet reportado
     * (REQ-ADM-040), sin borrarlo. El motivo queda en la auditoría.
     */
    async moderateCarnet(userId: string, action: CarnetModerationAction, reason: string) {
      // Devolver algo (plan 017 T191) no pide motivo; retirarlo, sí.
      const restoring = action.kind.startsWith('restore_') || action.kind === 'show_carnet';
      if (!restoring && !reason.trim())
        throw new AdminError(msg('admin.actions.haceFaltaUnMotivo2'));
      await repo.admin.moderateCarnet(userId, action, opts(reason.trim() || null));
    },

    /** Devuelve al mar una botella retirada por moderación (plan 017 T191). */
    async restoreBottle(id: string, reason?: string | null) {
      await repo.admin.restoreBottle(id, opts(reason?.trim() || null));
    },

    /** Da por revisado un reporte de Carnet sin retirar nada. */
    async dismissCarnetReport(reportId: string, reason?: string | null) {
      await repo.admin.resolveCarnetReport(reportId, 'descartado', opts(reason?.trim() || null));
    },

    // --- Destino de las misiones (REQ-AVE-010, REQ-AVE-011) -----------------

    /**
     * Cuántas partidas tocaría el destino nuevo de una misión en un mundo:
     * empezadas (y cuántas de ellas irían a otro sitio) y terminadas, que
     * nunca cambian.
     */
    async missionDestinationPreview(
      worldId: string,
      missionId: string,
      placeId: string | null,
    ): Promise<MissionImpact> {
      return repo.admin.missionImpact(worldId, missionId, placeId);
    },

    /**
     * Fija el destino de las partidas nuevas de una misión en un mundo (null:
     * el del mapa). No se publica una misión sin destino: el lugar tiene que
     * existir en ese mundo y servir de llegada (REQ-AVE-010). Con `migrate`,
     * las partidas empezadas pasan también al destino nuevo, cada una con su
     * entrada en la auditoría y el motivo (REQ-AVE-011).
     */
    async setMissionDestination(
      worldId: string,
      missionId: string,
      placeId: string | null,
      o: { migrate?: boolean; reason?: string | null } = {},
    ): Promise<MissionImpact> {
      const c = await content();
      const why = missionDestinationProblem(
        registry,
        { ...c, discounts: await repo.content.list('discounts') },
        worldId,
        missionId,
        placeId,
      );
      if (why) throw new AdminError(why);
      const impact = await repo.admin.missionImpact(worldId, missionId, placeId);
      const reason = o.reason?.trim() || null;
      if (o.migrate && impact.affected > 0 && !reason) {
        throw new AdminError(msg('admin.actions.paraMigrarPartidasEmpezadas'));
      }
      return repo.admin.setMissionDestination(worldId, missionId, placeId, {
        migrate: !!o.migrate,
        reason: reason ?? (placeId ? `destino: ${placeId}` : msg('admin.actions.destinoDelMapa')),
      });
    },
  };
  return api;
}

export type AdminActions = ReturnType<typeof createAdminActions>;
