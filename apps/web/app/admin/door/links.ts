import { isStoreError, type BoiaRepository } from '@boia/store';
import type {
  DoorLinkCreated,
  DoorLinkGuestListResult,
  DoorLinkInfo,
  DoorLinkRow,
  DoorLinkStampResult,
} from '@boia/db/rpc';
import type { BoiaSupabase } from '../../../lib/supabase/browser';
import { localDoorLinks } from '../../../lib/door-links';
import { type GuestListApi, localGuestList } from '../../../lib/guestlist';
import { parseCarnetQr } from '../../../lib/scanner/carnet-url';
import { realErrorText } from '../real/common';
import { type DoorListView, type DoorOutcome, doorListView, withList } from './backend';

/**
 * El enlace de la puerta (plan 034 T307): lo que gestiona el Admin (crear,
 * ver los vivos, revocar) y lo que usa la página del enlace (de qué fiesta
 * es, sellar lo escaneado). Sin servidor, los enlaces de este navegador
 * (`localDoorLinks`) y su repositorio (D-20); con cuentas, las RPC de
 * 20261021100100_door_links.sql.
 */

/** Un enlace vivo, sin el código (sólo se ve al crearlo). */
export interface DoorLinkLive {
  /** La fiesta, como en `DoorParty.key`: el id en local, el slug con cuentas. */
  party: string;
  title: string;
  createdAt: string;
}

export interface DoorLinksAdmin {
  list(): Promise<DoorLinkLive[]>;
  /** Crea el enlace de la fiesta (revoca el que hubiera) y devuelve su código. */
  create(party: string): Promise<string>;
  revoke(party: string): Promise<void>;
}

/** La página del enlace. */
export interface LinkDoor {
  /** El nombre de la fiesta, o null si el enlace no vale. */
  title(): Promise<string | null>;
  stamp(userId: string): Promise<DoorOutcome>;
  /**
   * La lista de la fiesta para ese Carnet (plan 034 T310): sólo el nombre de
   * lista, nunca el email. null si la fiesta no va en lista.
   */
  guestList?(userId: string): Promise<DoorListView | null>;
}

/** Sella lo que dijo un QR con el enlace (sólo escanear: nada de apodos) y mira la lista. */
export async function linkStampFromQr(door: LinkDoor, text: string): Promise<DoorOutcome> {
  const userId = parseCarnetQr(text);
  if (!userId) return { kind: 'notCarnet' };
  return withList(await door.stamp(userId), door.guestList?.bind(door), userId);
}

type KeyValue = Parameters<typeof localDoorLinks>[0];

async function openParties(repo: BoiaRepository) {
  return (await repo.content.list('events')).filter(
    (e) => e.state !== 'draft' && e.state !== 'cancelled',
  );
}

/** Sin servidor: los enlaces de este navegador. */
export function localLinksAdmin(repo: BoiaRepository, storage: KeyValue): DoorLinksAdmin {
  const links = localDoorLinks(storage);
  return {
    list: async () => {
      const names = new Map((await openParties(repo)).map((e) => [e.id, e.name]));
      return links
        .list()
        .filter((l) => names.has(l.eventId))
        .map((l) => ({ party: l.eventId, title: names.get(l.eventId)!, createdAt: l.createdAt }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    create: async (party) => links.create(party).token,
    revoke: async (party) => {
      links.revoke(party);
    },
  };
}

/**
 * Sin servidor: la página del enlace sella los Carnets de este navegador y
 * mira su lista (`lists`, por defecto la de este navegador).
 */
export function localLinkDoor(
  repo: BoiaRepository,
  storage: KeyValue,
  token: string,
  lists: GuestListApi = localGuestList(repo),
): LinkDoor {
  const links = localDoorLinks(storage);
  const party = async () => {
    const link = links.find(token);
    if (!link) return null;
    return (await openParties(repo)).find((e) => e.id === link.eventId) ?? null;
  };
  return {
    title: async () => (await party())?.name ?? null,
    stamp: async (userId) => {
      const ev = await party();
      if (!ev) return { kind: 'linkGone' };
      try {
        const r = await repo.admin.stampCarnet(userId, ev.id, { source: 'door' });
        return {
          kind: r.granted ? 'granted' : 'already',
          nickname: r.nickname,
          party: r.eventName,
          at: r.at,
        };
      } catch (e) {
        if (isStoreError(e, 'not_found')) return { kind: 'unknown' };
        return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
      }
    },
    guestList: async (userId) => {
      const ev = await party();
      return ev ? doorListView(await lists.door(ev.id, userId)) : null;
    },
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Con cuentas: las RPC del Admin (rol admin con segundo factor). */
export function realLinksAdmin(sb: BoiaSupabase): DoorLinksAdmin {
  return {
    list: async () => {
      const { data, error } = await sb.rpc('admin_door_links');
      if (error) throw new Error(realErrorText(error));
      return ((data ?? []) as unknown as DoorLinkRow[]).map((l) => ({
        party: l.event,
        title: l.title,
        createdAt: l.created_at,
      }));
    },
    create: async (party) => {
      const { data, error } = await sb.rpc('admin_create_door_link', { p_event: party });
      if (error) throw new Error(realErrorText(error));
      return (data as unknown as DoorLinkCreated).token;
    },
    revoke: async (party) => {
      const { error } = await sb.rpc('admin_revoke_door_link', { p_event: party });
      if (error) throw new Error(realErrorText(error));
    },
  };
}

/** Con cuentas: `door_link_info` y `door_link_stamp`, sin sesión. */
export function realLinkDoor(sb: BoiaSupabase, token: string): LinkDoor {
  return {
    title: async () => {
      const { data, error } = await sb.rpc('door_link_info', { p_token: token });
      if (error) throw new Error(realErrorText(error));
      const info = data as unknown as DoorLinkInfo;
      return info.valid ? info.title : null;
    },
    stamp: async (userId) => {
      if (!UUID_RE.test(userId)) return { kind: 'unknown' };
      const { data, error } = await sb.rpc('door_link_stamp', {
        p_token: token,
        p_member: userId,
      });
      if (error) {
        if (error.message === 'unknown_member') return { kind: 'unknown' };
        if (error.message === 'door_link_invalid') return { kind: 'linkGone' };
        return { kind: 'error', message: realErrorText(error) };
      }
      const r = data as unknown as DoorLinkStampResult;
      return {
        kind: r.granted ? 'granted' : 'already',
        nickname: r.nickname,
        party: r.title,
        at: r.at,
      };
    },
    // `door_link_guest_list`: con el código, sólo el nombre de lista.
    guestList: async (userId) => {
      if (!UUID_RE.test(userId)) return null;
      const { data, error } = await sb.rpc('door_link_guest_list', {
        p_token: token,
        p_member: userId,
      });
      if (error) throw new Error(realErrorText(error));
      const r = data as unknown as DoorLinkGuestListResult;
      return doorListView({
        enabled: r.enabled,
        onList: r.on_list,
        listName: r.list_name,
        closesAt: r.closes_at,
        pastClosing: r.past_closing,
      });
    },
  };
}
