import { isStoreError, type BoiaRepository, type StaffStampSource } from '@boia/store';
import type { StaffStampResult } from '@boia/db/rpc';
import type { BoiaSupabase } from '../../../lib/supabase/browser';
import { t } from '../../../lib/i18n';
import { type GuestListApi, localGuestList, supabaseGuestList } from '../../../lib/guestlist';
import { parseCarnetQr } from '../../../lib/scanner/carnet-url';
import { realErrorText } from '../real/common';

/**
 * Lo que necesitan la puerta y «Sellar a mano» (plan 019 T218, decisión 11),
 * igual sin servidor (el repositorio de este navegador, D-20) que con cuentas
 * (`staff_stamp`, 20261008100300_door_stamps.sql).
 */
export interface DoorParty {
  /** Lo que se pasa al sellar: el id del evento en local, el slug con cuentas. */
  key: string;
  name: string;
  startsAt: string | null;
}

export interface DoorMember {
  userId: string;
  nickname: string;
  memberNumber: number | null;
}

/**
 * La lista de la fiesta tras leer un Carnet (plan 034 T310), sólo si la
 * fiesta va en lista. Nunca bloquea nada: la puerta decide. Sólo el nombre de
 * lista (por el enlace de la puerta no llega nada más).
 */
export interface DoorListView {
  onList: boolean;
  listName: string | null;
  closesAt: string | null;
  pastClosing: boolean;
}

export type DoorOutcome =
  | {
      kind: 'granted' | 'already';
      nickname: string;
      party: string;
      at: string;
      /** La lista de la fiesta, si va en lista (plan 034 T310). */
      list?: DoorListView;
    }
  /** Lo leído no es el QR de un Carnet de BOIA. */
  | { kind: 'notCarnet' }
  /** Ese Carnet no existe (o ya no). */
  | { kind: 'unknown' }
  /** El enlace de la puerta ya no vale: revocado o fiesta cerrada (plan 034 T307). */
  | { kind: 'linkGone' }
  | { kind: 'error'; message: string };

export interface DoorBackend {
  parties(): Promise<DoorParty[]>;
  /** Carnets por apodo (o nº de socio, con cuentas), para sellar a mano. */
  members(search: string): Promise<DoorMember[]>;
  stamp(
    userId: string,
    party: string,
    source: StaffStampSource,
    reason?: string,
  ): Promise<DoorOutcome>;
  /** Cuántos han entrado a la fiesta. */
  attendance(party: string): Promise<number>;
  /** La lista de la fiesta para ese Carnet; null si la fiesta no va en lista. */
  guestList?(userId: string, party: string): Promise<DoorListView | null>;
}

/** La fiesta que toca: la que está en marcha o la próxima; si no, la última. */
export function currentParty(parties: readonly DoorParty[], now = Date.now()): DoorParty | null {
  const dated = parties
    .filter((p) => p.startsAt)
    .map((p) => ({ p, at: new Date(p.startsAt!).getTime() }))
    .filter((x) => !Number.isNaN(x.at));
  // Una fiesta dura como mucho un día: hasta 24 h después de empezar, sigue tocando.
  const next = dated.filter((x) => x.at >= now - 24 * 3600_000).sort((a, b) => a.at - b.at)[0];
  if (next) return next.p;
  const last = dated.sort((a, b) => b.at - a.at)[0];
  return last?.p ?? parties[0] ?? null;
}

/** Lo que se lee en la puerta tras cada Carnet. */
export function outcomeText(outcome: DoorOutcome): string {
  switch (outcome.kind) {
    case 'granted':
      return t('puerta.result.granted', { nickname: outcome.nickname, party: outcome.party });
    case 'already':
      return t('puerta.result.already', { nickname: outcome.nickname, party: outcome.party });
    case 'notCarnet':
      return t('puerta.result.notCarnet');
    case 'unknown':
      return t('puerta.result.unknown');
    case 'linkGone':
      return t('puerta.link.gone');
    case 'error':
      return t('puerta.result.error', { message: outcome.message });
  }
}

/** «22:30»: la hora de cierre de la lista, en la hora de Alicante. */
export function listTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * «En lista como Ana» o «No está en la lista»; pasada la hora de cierre, con
 * el aviso («… · pasada la hora de lista (22:30)»).
 */
export function listText(list: DoorListView): string {
  const base =
    list.onList && list.listName
      ? t('puerta.list.on', { name: list.listName })
      : t('puerta.list.off');
  return list.pastClosing
    ? t('puerta.list.late', { text: base, time: listTime(list.closesAt) })
    : base;
}

/** De lo que dice la lista a lo que enseña la puerta: null si no va en lista. */
export function doorListView(r: {
  enabled: boolean;
  onList: boolean;
  listName: string | null;
  closesAt: string | null;
  pastClosing: boolean;
}): DoorListView | null {
  if (!r.enabled) return null;
  return {
    onList: r.onList,
    listName: r.listName,
    closesAt: r.closesAt,
    pastClosing: r.pastClosing,
  };
}

/**
 * Le pone la lista de la fiesta a un Carnet ya leído (sellado o repetido). Si
 * la consulta falla, la puerta sigue: el sello ya está y la lista no se dice.
 */
export async function withList(
  outcome: DoorOutcome,
  lookup: ((userId: string) => Promise<DoorListView | null>) | undefined,
  userId: string,
): Promise<DoorOutcome> {
  if (!lookup || (outcome.kind !== 'granted' && outcome.kind !== 'already')) return outcome;
  try {
    const list = await lookup(userId);
    return list ? { ...outcome, list } : outcome;
  } catch (e) {
    console.warn('[boia] puerta: sin la lista', e);
    return outcome;
  }
}

/** Sella lo que dijo un QR (o lo que se pegó en la puerta) y mira la lista. */
export async function stampFromQr(
  backend: DoorBackend,
  text: string,
  party: string,
): Promise<DoorOutcome> {
  const userId = parseCarnetQr(text);
  if (!userId) return { kind: 'notCarnet' };
  const outcome = await backend.stamp(userId, party, 'door');
  const lookup = backend.guestList?.bind(backend);
  return withList(outcome, lookup && ((id) => lookup(id, party)), userId);
}

/**
 * Sin servidor: el repositorio de este navegador (el Carnet de quien está
 * aquí) y su lista (`lists`, por defecto la de este navegador).
 */
export function localDoor(
  repo: BoiaRepository,
  lists: GuestListApi = localGuestList(repo),
): DoorBackend {
  return {
    parties: async () =>
      (await repo.content.list('events'))
        .filter((e) => e.state !== 'draft' && e.state !== 'cancelled')
        .map((e) => ({ key: e.id, name: e.name, startsAt: e.startsAt })),
    members: async (search) => {
      const q = search.trim().toLowerCase();
      return (await repo.admin.carnets())
        .filter((c) => !c.carnet.isSample)
        .filter(
          (c) =>
            !q ||
            c.carnet.nickname.toLowerCase().includes(q) ||
            String(c.carnet.memberNumber ?? '') === q.replace(/^0+(?=\d)/, ''),
        )
        .map((c) => ({
          userId: c.userId,
          nickname: c.carnet.nickname,
          memberNumber: c.carnet.memberNumber ?? null,
        }));
    },
    stamp: async (userId, party, source, reason) => {
      try {
        const r = await repo.admin.stampCarnet(userId, party, {
          source,
          ...(reason ? { reason } : {}),
        });
        return {
          kind: r.granted ? 'granted' : 'already',
          nickname: r.nickname,
          party: r.eventName,
          at: r.at,
        };
      } catch (e) {
        if (isStoreError(e, 'not_found') && !(e.message ?? '').startsWith('evento')) {
          return { kind: 'unknown' };
        }
        return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
      }
    },
    attendance: async (party) => (await repo.admin.attendance(party)).length,
    guestList: async (userId, party) => doorListView(await lists.door(party, userId)),
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Con cuentas: las fiestas y los socios de Supabase, `staff_stamp`. */
export function realDoor(sb: BoiaSupabase): DoorBackend {
  const ids = new Map<string, string>();
  return {
    parties: async () => {
      const { data, error } = await sb
        .from('events')
        .select('id, slug, title, starts_at, state, published_at')
        .is('archived_at', null)
        .not('published_at', 'is', null)
        .order('starts_at', { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw new Error(realErrorText(error));
      return (data ?? [])
        .filter((e) => e.state !== 'draft' && e.state !== 'cancelled')
        .map((e) => {
          ids.set(e.slug, e.id);
          return { key: e.slug, name: e.title, startsAt: e.starts_at };
        });
    },
    members: async (search) => {
      const { data, error } = await sb.rpc('admin_list_members', {
        p_search: search.trim(),
        p_limit: 20,
        p_offset: 0,
      });
      if (error) throw new Error(realErrorText(error));
      return (data ?? [])
        .filter((m) => m.nickname)
        .map((m) => ({
          userId: m.user_id,
          nickname: m.nickname,
          memberNumber: m.member_number ?? null,
        }));
    },
    stamp: async (userId, party, source, reason) => {
      if (!UUID_RE.test(userId)) return { kind: 'unknown' };
      const { data, error } = await sb.rpc('staff_stamp', {
        p_member: userId,
        p_event: party,
        p_source: source,
        ...(reason ? { p_reason: reason } : {}),
      });
      if (error) {
        if (error.message === 'unknown_member') return { kind: 'unknown' };
        return { kind: 'error', message: realErrorText(error) };
      }
      const r = data as unknown as StaffStampResult;
      return {
        kind: r.granted ? 'granted' : 'already',
        nickname: r.nickname,
        party: r.title,
        at: r.at,
      };
    },
    attendance: async (party) => {
      const id = ids.get(party);
      if (!id) return 0;
      const { count, error } = await sb
        .from('event_attendance')
        .select('user_id', { count: 'exact', head: true })
        .eq('event_id', id);
      if (error) throw new Error(realErrorText(error));
      return count ?? 0;
    },
    // `guest_list_door` (editor, como el lector).
    guestList: async (userId, party) =>
      UUID_RE.test(userId) ? doorListView(await supabaseGuestList(sb).door(party, userId)) : null,
  };
}
