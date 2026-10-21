/**
 * La lista de una fiesta (plan 034 T308, Álvaro 2026-10-21): tipos, reglas y
 * la implementación local para la demo sin Supabase (D-20). Con cuentas, las
 * mismas reglas las impone la base (supabase/migrations/20261021200100_guest_lists.sql)
 * y la web llama a las RPC desde `apps/web/lib/guestlist`, que devuelve estos
 * mismos tipos.
 *
 * Reglas: una fiesta va «en lista» con un tope de personas, una hora de cierre
 * (a esa hora la lista se cierra sola) y un interruptor abierta/cerrada del
 * Admin. Apuntarse pide Carnet, una vez por cuenta; si ya estaba, se devuelve
 * su inscripción sin tocarla. Nombre de lista de 2 a 30 caracteres (por
 * defecto, el apodo del Carnet; texto libre, puede repetirse). Cada cual se
 * borra mientras la lista siga abierta y antes de la hora, y puede volver.
 * No hay contador público: al socio sólo se le dice si está llena.
 */
import type { BoiaEvent } from '@boia/contracts';
import type { BoiaRepository } from './repository';
import { defaultStorage, MemoryStorage, type StorageLike } from './storage';

/** Ajustes de la lista de una fiesta (lo que cambia el Admin). */
export interface GuestListSettings {
  /** La fiesta va en lista. */
  enabled: boolean;
  /** Tope de personas. */
  cap: number;
  /** ISO; a esa hora la lista se cierra sola. null: sólo el interruptor. */
  closesAt: string | null;
  /** El interruptor del Admin. */
  open: boolean;
}

/** Una inscripción: el nombre con el que se apuntó y cuándo. */
export interface GuestListSignup {
  listName: string;
  createdAt: string;
}

/** El estado de la lista de una fiesta, para quien la mira. */
export interface GuestListStatus {
  /** Slug de la fiesta. */
  event: string;
  enabled: boolean;
  cap: number | null;
  closesAt: string | null;
  open: boolean;
  /** Ya pasó la hora de cierre. */
  pastClosing: boolean;
  /** No se puede apuntar ni borrar: no va en lista, interruptor cerrado o pasada la hora. */
  closed: boolean;
  full: boolean;
  /** La inscripción de quien mira (null sin Carnet o sin apuntarse). */
  mine: GuestListSignup | null;
  /** Cuántos hay apuntados: sólo en las llamadas del Admin. */
  count?: number;
}

/**
 * Por qué no se pudo. `not_member` (sin cuenta) y `carnet_required` (cuenta
 * sin Carnet) piden lo mismo a la interfaz: entrar o sacarse el Carnet.
 */
export type GuestListRejection =
  | 'not_member'
  | 'carnet_required'
  | 'unknown_event'
  | 'not_enabled'
  | 'closed'
  | 'full'
  | 'invalid_name';

export type GuestListJoinResult =
  | { kind: 'created' | 'existing'; signup: GuestListSignup }
  | { kind: 'rejected'; reason: GuestListRejection };

export type GuestListLeaveResult =
  { kind: 'removed' | 'not_signed_up' } | { kind: 'rejected'; reason: GuestListRejection };

/** Una fila de la lista en el Admin. */
export interface GuestListAdminRow {
  userId: string;
  listName: string;
  /** Apodo del Carnet (null si ya no tiene). */
  nickname: string | null;
  /** Email de la cuenta; null en la demo (no hay cuentas). */
  email: string | null;
  createdAt: string;
  /** La leyeron en la puerta de esa fiesta (`event_attendance`). */
  attended: boolean;
  attendedAt: string | null;
}

/** Lo que ve la puerta tras leer un Carnet. Nunca bloquea nada: la puerta decide. */
export interface GuestListDoorView {
  enabled: boolean;
  onList: boolean;
  listName: string | null;
  createdAt: string | null;
  closesAt: string | null;
  pastClosing: boolean;
}

/** Error de las llamadas del Admin y de la puerta (las del socio devuelven `rejected`). */
export class GuestListError extends Error {
  constructor(
    readonly code: GuestListRejection | 'forbidden' | 'invalid_input' | 'unknown',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'GuestListError';
  }
}

/**
 * Lo que llaman la web y /mar (T309) y el Admin y la puerta (T310). `event`
 * es siempre el slug de la fiesta (en la demo vale también su id).
 */
export interface GuestListApi {
  /** El estado de la lista, con la inscripción de quien mira. */
  status(event: string): Promise<GuestListStatus>;
  /** Apuntarse (sin nombre: el apodo del Carnet). Si ya estaba, `existing`. */
  join(event: string, listName?: string | null): Promise<GuestListJoinResult>;
  /** Borrarse de la lista (antes de la hora de cierre y con la lista abierta). */
  leave(event: string): Promise<GuestListLeaveResult>;
  /** La inscripción propia, o null. */
  mine(event: string): Promise<GuestListSignup | null>;
  admin: {
    /** El estado con `count`. */
    status(event: string): Promise<GuestListStatus>;
    /** Las inscripciones, por orden de llegada, con si entraron. */
    list(event: string): Promise<GuestListAdminRow[]>;
    /** Borra la inscripción de alguien (aunque la lista esté cerrada). */
    remove(event: string, userId: string, reason?: string): Promise<{ removed: boolean }>;
    /** Cambia todos los ajustes a la vez; devuelve el estado con `count`. */
    updateSettings(event: string, settings: GuestListSettings): Promise<GuestListStatus>;
  };
  /** ¿Está ese Carnet en la lista de la fiesta, con qué nombre, y pasó la hora? */
  door(event: string, userId: string): Promise<GuestListDoorView>;
}

// ---------------------------------------------------------------------------
// Reglas (las mismas que la base)

export const GUEST_LIST_NAME_MIN = 2;
export const GUEST_LIST_NAME_MAX = 30;
export const GUEST_LIST_CAP_MAX = 100000;

/**
 * El nombre de lista: sin espacios de más; vacío, el apodo. null si no cabe
 * en 2 a 30 caracteres.
 */
export function normalizeListName(raw: string | null | undefined, nickname: string): string | null {
  const typed = (raw ?? '').trim();
  const name = (typed || nickname).trim().replace(/\s+/g, ' ');
  const len = [...name].length;
  return len >= GUEST_LIST_NAME_MIN && len <= GUEST_LIST_NAME_MAX ? name : null;
}

/** ¿Ya pasó la hora de cierre? */
export function guestListPastClosing(closesAt: string | null, now: Date): boolean {
  if (!closesAt) return false;
  const at = Date.parse(closesAt);
  return !Number.isNaN(at) && now.getTime() >= at;
}

/** El estado a partir de los ajustes y cuántos hay (`settings` null: no va en lista). */
export function guestListState(
  event: string,
  settings: GuestListSettings | null,
  count: number,
  mine: GuestListSignup | null,
  now: Date,
): GuestListStatus {
  if (!settings) {
    return {
      event,
      enabled: false,
      cap: null,
      closesAt: null,
      open: false,
      pastClosing: false,
      closed: true,
      full: false,
      mine: null,
    };
  }
  const pastClosing = guestListPastClosing(settings.closesAt, now);
  return {
    event,
    enabled: settings.enabled,
    cap: settings.cap,
    closesAt: settings.closesAt,
    open: settings.open,
    pastClosing,
    closed: !settings.enabled || !settings.open || pastClosing,
    full: count >= settings.cap,
    mine,
  };
}

/** Los ajustes de partida de una fiesta del contenido (`event.guestList`). */
export function guestListDefaults(event: Pick<BoiaEvent, 'guestList'>): GuestListSettings | null {
  const g = event.guestList;
  if (!g) return null;
  return { enabled: true, cap: g.cap, closesAt: g.closesAt ?? null, open: g.open };
}

/** ¿Son ajustes válidos? (los mismos límites que la base). */
export function validGuestListSettings(s: GuestListSettings): boolean {
  return (
    typeof s.enabled === 'boolean' &&
    typeof s.open === 'boolean' &&
    Number.isInteger(s.cap) &&
    s.cap >= 1 &&
    s.cap <= GUEST_LIST_CAP_MAX &&
    (s.closesAt === null || !Number.isNaN(Date.parse(s.closesAt)))
  );
}

// ---------------------------------------------------------------------------
// La demo: todo en este navegador (D-20)

/** Clave de las listas de la demo en localStorage. */
export const GUEST_LIST_KEY = 'boia.guestlist';

interface GuestListDoc {
  v: 1;
  /** Ajustes que cambió el Admin, por id de evento. */
  settings: Record<string, GuestListSettings>;
  /** Inscripciones por id de evento y cuenta. */
  signups: Record<string, Record<string, GuestListSignup>>;
}

export interface LocalGuestListOptions {
  /** El repositorio de la demo: el Carnet de quien está aquí, las fiestas y la puerta. */
  repo: BoiaRepository;
  /** Por defecto, localStorage (memoria si no deja); null fuerza memoria. */
  storage?: StorageLike | null;
  key?: string;
  now?: () => Date;
}

const emptyDoc = (): GuestListDoc => ({ v: 1, settings: {}, signups: {} });

function readDoc(storage: StorageLike, key: string): GuestListDoc {
  try {
    const raw = storage.getItem(key);
    if (!raw) return emptyDoc();
    const doc = JSON.parse(raw) as Partial<GuestListDoc>;
    if (doc?.v !== 1 || typeof doc.settings !== 'object' || typeof doc.signups !== 'object') {
      return emptyDoc();
    }
    return { v: 1, settings: doc.settings ?? {}, signups: doc.signups ?? {} };
  } catch {
    return emptyDoc();
  }
}

/**
 * La lista en modo local: los ajustes de partida salen del contenido
 * (`event.guestList`), lo que cambia el Admin y las inscripciones se guardan
 * en este navegador. La única cuenta es la de quien está aquí (su Carnet);
 * sin Carnet, `carnet_required`. El Admin de la demo no pide rol (lo guarda
 * la puerta de /admin), como el resto de la demo.
 */
export function createLocalGuestList(options: LocalGuestListOptions): GuestListApi {
  const { repo } = options;
  const key = options.key ?? GUEST_LIST_KEY;
  const now = options.now ?? (() => new Date());
  let storage: StorageLike;
  if (options.storage === null) storage = new MemoryStorage();
  else storage = options.storage ?? defaultStorage() ?? new MemoryStorage();

  const load = () => readDoc(storage, key);
  const save = (doc: GuestListDoc) => {
    try {
      storage.setItem(key, JSON.stringify(doc));
    } catch {
      // Cuota llena o bloqueado: sigue en memoria.
      const mem = new MemoryStorage();
      mem.setItem(key, JSON.stringify(doc));
      storage = mem;
    }
  };

  /** La fiesta por slug o id; `publicOnly`: publicada, ni borrador ni cancelada. */
  async function party(event: string, publicOnly: boolean): Promise<BoiaEvent | null> {
    const list = await repo.content.list('events');
    const e = list.find((x) => x.slug === event) ?? list.find((x) => x.id === event);
    if (!e) return null;
    if (publicOnly && (e.state === 'draft' || e.state === 'cancelled')) return null;
    return e;
  }

  const settingsOf = (doc: GuestListDoc, e: BoiaEvent) =>
    doc.settings[e.id] ?? guestListDefaults(e);
  const signupsOf = (doc: GuestListDoc, e: BoiaEvent) => doc.signups[e.id] ?? {};

  async function me(): Promise<{ userId: string; nickname: string } | null> {
    const c = await repo.carnet.mine();
    return c ? { userId: c.userId, nickname: c.nickname } : null;
  }

  async function adminParty(event: string): Promise<BoiaEvent> {
    const e = await party(event, false);
    if (!e) throw new GuestListError('unknown_event', `Fiesta desconocida: ${event}`);
    return e;
  }

  function adminState(doc: GuestListDoc, e: BoiaEvent): GuestListStatus {
    const rows = signupsOf(doc, e);
    const n = Object.keys(rows).length;
    return { ...guestListState(e.slug, settingsOf(doc, e), n, null, now()), count: n };
  }

  const api: GuestListApi = {
    async status(event) {
      const e = await party(event, true);
      if (!e) return guestListState(event, null, 0, null, now());
      const doc = load();
      const who = await me();
      const rows = signupsOf(doc, e);
      const mine = who ? (rows[who.userId] ?? null) : null;
      return guestListState(e.slug, settingsOf(doc, e), Object.keys(rows).length, mine, now());
    },

    async join(event, listName) {
      const who = await me();
      if (!who) return { kind: 'rejected', reason: 'carnet_required' };
      const e = await party(event, true);
      if (!e) return { kind: 'rejected', reason: 'unknown_event' };
      const doc = load();
      const settings = settingsOf(doc, e);
      if (!settings?.enabled) return { kind: 'rejected', reason: 'not_enabled' };
      const rows = signupsOf(doc, e);
      const prev = rows[who.userId];
      if (prev) return { kind: 'existing', signup: prev };
      const state = guestListState(e.slug, settings, Object.keys(rows).length, null, now());
      if (state.closed) return { kind: 'rejected', reason: 'closed' };
      const name = normalizeListName(listName, who.nickname);
      if (!name) return { kind: 'rejected', reason: 'invalid_name' };
      if (state.full) return { kind: 'rejected', reason: 'full' };
      const signup = { listName: name, createdAt: now().toISOString() };
      doc.signups[e.id] = { ...rows, [who.userId]: signup };
      save(doc);
      return { kind: 'created', signup };
    },

    async leave(event) {
      const who = await me();
      if (!who) return { kind: 'rejected', reason: 'carnet_required' };
      const e = await party(event, true);
      if (!e) return { kind: 'rejected', reason: 'unknown_event' };
      const doc = load();
      const settings = settingsOf(doc, e);
      if (!settings?.enabled) return { kind: 'rejected', reason: 'not_enabled' };
      if (guestListState(e.slug, settings, 0, null, now()).closed) {
        return { kind: 'rejected', reason: 'closed' };
      }
      const rows = { ...signupsOf(doc, e) };
      if (!rows[who.userId]) return { kind: 'not_signed_up' };
      delete rows[who.userId];
      doc.signups[e.id] = rows;
      save(doc);
      return { kind: 'removed' };
    },

    async mine(event) {
      return (await api.status(event)).mine;
    },

    admin: {
      async status(event) {
        return adminState(load(), await adminParty(event));
      },
      async list(event) {
        const e = await adminParty(event);
        const rows = signupsOf(load(), e);
        const seen = new Map((await repo.admin.attendance(e.id)).map((a) => [a.userId, a.at]));
        const out: GuestListAdminRow[] = [];
        for (const [userId, s] of Object.entries(rows)) {
          const carnet = await repo.carnet.get(userId);
          out.push({
            userId,
            listName: s.listName,
            nickname: carnet?.nickname ?? null,
            email: null,
            createdAt: s.createdAt,
            attended: seen.has(userId),
            attendedAt: seen.get(userId) ?? null,
          });
        }
        return out.sort(
          (a, b) => a.createdAt.localeCompare(b.createdAt) || a.userId.localeCompare(b.userId),
        );
      },
      async remove(event, userId) {
        const e = await adminParty(event);
        const doc = load();
        const rows = { ...signupsOf(doc, e) };
        if (!rows[userId]) return { removed: false };
        delete rows[userId];
        doc.signups[e.id] = rows;
        save(doc);
        return { removed: true };
      },
      async updateSettings(event, settings) {
        const e = await adminParty(event);
        if (!validGuestListSettings(settings)) {
          throw new GuestListError('invalid_input', 'Ajustes de la lista no válidos');
        }
        const doc = load();
        doc.settings[e.id] = {
          enabled: settings.enabled,
          cap: settings.cap,
          closesAt: settings.closesAt ? new Date(settings.closesAt).toISOString() : null,
          open: settings.open,
        };
        save(doc);
        return adminState(doc, e);
      },
    },

    async door(event, userId) {
      const e = await adminParty(event);
      const doc = load();
      const settings = settingsOf(doc, e);
      const s = signupsOf(doc, e)[userId] ?? null;
      const closesAt = settings?.closesAt ?? null;
      return {
        enabled: settings?.enabled ?? false,
        onList: s !== null,
        listName: s?.listName ?? null,
        createdAt: s?.createdAt ?? null,
        closesAt,
        pastClosing: guestListPastClosing(closesAt, now()),
      };
    },
  };
  return api;
}
