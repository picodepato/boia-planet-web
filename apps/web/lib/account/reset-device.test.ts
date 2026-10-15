import { RECORDS_KEY } from '@boia/engine/minigames';
import {
  MINIMAP_ZONE_KEY,
  SETTINGS_KEY,
  SHIP_SKIN_STORAGE_KEY,
  SHIP_STYLE_STORAGE_KEY,
} from '@boia/engine/ui';
import {
  type BoiaRepository,
  STORE_BACKUP_KEY,
  STORE_KEY,
  createLocalRepository,
  localDocAccess,
  memberSyncKey,
} from '@boia/store';
import { ACTIVE_WORLD_STORAGE_KEY, WORLD_STORAGE_KEY } from '@boia/world';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { READOUT_STORAGE_KEY } from '../../app/mar/canon-readout-preferences';
import { SOUND_STORAGE_KEY } from '../../app/mar/canon-sound-preferences';
import { DEFENSE_OVERLAYS_KEY } from '../../app/mar/engine/defense-overlays';
import { ghostKey } from '../../app/mar/race';
import { MAR_POSITION_KEY } from '../../app/mar/voyage';
import { DEMO_ADMIN_SESSION_KEY } from '../admin/demo-auth';
import { CALITAS_STORAGE_KEY } from '../calitas/local';
import { INVITE_DEVICE_KEY, INVITE_SESSION_KEY } from '../landing/invitations';
import { SOUND_SETTINGS_KEY } from '../landing/sound-pref';
import { clearAcknowledgedMemberCopy } from '../member-cache';
import { HOROSCOPO_STORAGE_KEY, MOOD_STORAGE_KEY } from '../mundo/mar-keys';
import { CANON_BEST_KEY } from '../mundo/ranking-canon';
import { CASTLE_BEST_KEY } from '../mundo/ranking-castle';
import { SHIP_POSITION_KEY } from '../mundo/ship-position';
import { PWA_DISMISS_KEY } from '../pwa/install';
import { MUSIC_SETTINGS_KEY } from '../radio/music-setting';
import { RADIO_SESSION_KEY } from '../radio/player';
import { memberCopyKey } from '../repo-member';
import { SUPABASE_AUTH_STORAGE_KEY } from '../supabase/config';
import { ARTIST_CODE_KEY } from './artist-link';
import type * as Repo from '../repo';
import type * as Session from './session';
import { isEmptyPayload } from './merge';
import {
  DEVICE_PREFERENCE_KEYS,
  type DeviceStorage,
  isDevicePreferenceKey,
  resetDevice,
  signOutAndReset,
} from './reset-device';

type RepoModule = typeof Repo;
type SessionModule = typeof Session;

const holder = vi.hoisted(() => ({
  guest: null as BoiaRepository | null,
  calls: [] as string[],
}));
vi.mock('../repo', async (importOriginal) => ({
  ...(await importOriginal<RepoModule>()),
  guestRepository: () => holder.guest!,
}));
vi.mock('./session', async (importOriginal) => ({
  ...(await importOriginal<SessionModule>()),
  signOut: async () => {
    holder.calls.push('signOut');
  },
}));

/** Un `Storage` de verdad en memoria: se puede recorrer, como localStorage. */
class KeyedStorage implements DeviceStorage {
  private readonly map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  keys(): string[] {
    return [...this.map.keys()];
  }
}

/** Las preferencias del dispositivo, con sus claves de verdad (lo que se queda). */
const PREFERENCES = [
  SETTINGS_KEY,
  SOUND_SETTINGS_KEY,
  MUSIC_SETTINGS_KEY,
  RADIO_SESSION_KEY,
  MOOD_STORAGE_KEY,
  SOUND_STORAGE_KEY,
  READOUT_STORAGE_KEY,
  DEFENSE_OVERLAYS_KEY,
  MINIMAP_ZONE_KEY,
  PWA_DISMISS_KEY,
];

/** Lo del juego y de la cuenta, con sus claves de verdad (lo que se borra). */
const GAME = [
  STORE_BACKUP_KEY,
  SHIP_POSITION_KEY,
  MAR_POSITION_KEY,
  SHIP_STYLE_STORAGE_KEY,
  SHIP_SKIN_STORAGE_KEY,
  WORLD_STORAGE_KEY,
  ACTIVE_WORLD_STORAGE_KEY,
  CANON_BEST_KEY,
  CASTLE_BEST_KEY,
  RECORDS_KEY,
  ghostKey({ id: 'el-freu', version: 3 }),
  CALITAS_STORAGE_KEY,
  HOROSCOPO_STORAGE_KEY,
  INVITE_DEVICE_KEY,
  INVITE_SESSION_KEY,
  ARTIST_CODE_KEY,
  DEMO_ADMIN_SESSION_KEY,
  memberCopyKey('cuenta-a'),
  memberSyncKey(memberCopyKey('cuenta-a')),
];

/** Un invitado que ha jugado y se ha hecho el Carnet (antes de entrar en su cuenta). */
async function playedGuest(storage: KeyedStorage): Promise<BoiaRepository> {
  const repo = createLocalRepository({ storage, watch: false });
  await repo.carnet.create({ nickname: 'Persona A' });
  await repo.progress.grantWorldReward({ sourceRef: 'lugar:cala:points', points: 20, coins: 5 });
  await repo.progress.completeAchievement('whatsapp');
  await repo.progress.submitTime('circuito:el-freu:v3', 71_234);
  // El contenido del Admin de la demo no es de nadie: se queda.
  localDocAccess(repo)!.write(['content'], (d) => {
    d.content.texts['hero.titulo'] = 'Texto del Admin';
  });
  return repo;
}

function fill(storage: KeyedStorage, keys: readonly string[]): void {
  for (const k of keys) storage.setItem(k, 'algo');
}

let local: KeyedStorage;
let session: KeyedStorage;

beforeEach(() => {
  local = new KeyedStorage();
  session = new KeyedStorage();
  holder.calls = [];
  vi.stubGlobal('window', { localStorage: local, sessionStorage: session });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('la lista de lo que se queda (T284)', () => {
  it('son exactamente las preferencias del dispositivo, con sus claves de verdad', () => {
    expect(new Set(PREFERENCES)).toEqual(new Set(DEVICE_PREFERENCE_KEYS));
    for (const k of PREFERENCES) expect(isDevicePreferenceKey(k)).toBe(true);
    expect(isDevicePreferenceKey(SUPABASE_AUTH_STORAGE_KEY)).toBe(true);
  });

  it('nada del juego ni de la cuenta es una preferencia', () => {
    for (const k of [STORE_KEY, ...GAME]) expect(isDevicePreferenceKey(k)).toBe(false);
  });
});

describe('cerrar sesión deja el dispositivo de cero (T284)', () => {
  it('se va todo lo del juego y de la cuenta; se quedan las preferencias', async () => {
    const guest = await playedGuest(local);
    fill(
      local,
      GAME.filter((k) => k !== INVITE_SESSION_KEY && k !== ARTIST_CODE_KEY),
    );
    fill(session, [INVITE_SESSION_KEY, ARTIST_CODE_KEY, RADIO_SESSION_KEY]);
    fill(
      local,
      PREFERENCES.filter((k) => k !== RADIO_SESSION_KEY),
    );
    local.setItem(SUPABASE_AUTH_STORAGE_KEY, '{"la":"sesión"}');
    local.setItem('otra-web', 'no es nuestro');

    await resetDevice({ guest, storages: [local, session] });

    for (const k of GAME) {
      expect(local.getItem(k), k).toBeNull();
      expect(session.getItem(k), k).toBeNull();
    }
    for (const k of PREFERENCES.filter((k) => k !== RADIO_SESSION_KEY))
      expect(local.getItem(k), k).toBe('algo');
    expect(session.getItem(RADIO_SESSION_KEY)).toBe('algo');
    expect(local.getItem(SUPABASE_AUTH_STORAGE_KEY)).not.toBeNull();
    expect(local.getItem('otra-web')).toBe('no es nuestro');

    // El invitado, como en la primera visita; el contenido del Admin sigue.
    expect(await guest.identity.current()).toBeNull();
    expect(await guest.carnet.mine()).toBeNull();
    expect(await guest.progress.ledger()).toEqual([]);
    expect(await guest.purchases.list()).toEqual([]);
    expect((await guest.content.texts())['hero.titulo']).toBe('Texto del Admin');
    // Lo guardado también (al recargar se lee esto).
    const saved = JSON.parse(local.getItem(STORE_KEY)!) as Record<string, unknown>;
    expect(JSON.stringify(saved)).not.toContain('Persona A');
    const again = createLocalRepository({ storage: local, watch: false });
    expect(await again.carnet.mine()).toBeNull();
    expect((await again.progress.balances()).points).toBe(0);
  });

  it('una copia de cuenta con cambios sin mandar se queda (se manda al volver a entrar)', async () => {
    const guest = createLocalRepository({ storage: local, watch: false });
    const acked = memberCopyKey('acked');
    const queued = memberCopyKey('cola');
    const dirty = memberCopyKey('sucia');
    local.setItem(acked, '{}');
    local.setItem(memberSyncKey(acked), JSON.stringify({ ops: [] }));
    local.setItem(queued, '{}');
    local.setItem(memberSyncKey(queued), JSON.stringify({ ops: [{ op: 'reward' }] }));
    // Al salir, `repo-member` dejó ésta porque su copia tenía cambios sin mandar.
    local.setItem(dirty, '{}');
    local.setItem(memberSyncKey(dirty), JSON.stringify({ ops: [] }));
    clearAcknowledgedMemberCopy(local, dirty, 0, true);

    await resetDevice({ guest, storages: [local] });

    expect(local.getItem(acked)).toBeNull();
    expect(local.getItem(memberSyncKey(acked))).toBeNull();
    expect(local.getItem(queued)).not.toBeNull();
    expect(local.getItem(memberSyncKey(queued))).not.toBeNull();
    expect(local.getItem(dirty)).not.toBeNull();
    expect(local.getItem(memberSyncKey(dirty))).not.toBeNull();
  });

  it('primero cierra la sesión (que manda lo pendiente) y después borra', async () => {
    holder.guest = await playedGuest(local);
    fill(local, [SHIP_POSITION_KEY]);
    const write = localDocAccess(holder.guest)!.write;
    localDocAccess(holder.guest)!.write = (areas, fn) => {
      holder.calls.push('reset');
      write(areas, fn);
    };
    await signOutAndReset();
    expect(holder.calls).toEqual(['signOut', 'reset']);
    expect(local.getItem(SHIP_POSITION_KEY)).toBeNull();
    expect(await holder.guest.carnet.mine()).toBeNull();
  });

  it('lo de una persona no pasa a la cuenta de la siguiente', async () => {
    // A jugó como invitado, entró (lo suyo pasó a su cuenta) y cierra sesión.
    holder.guest = await playedGuest(local);
    const { guestMergePayload } = await import('./guest');
    expect(isEmptyPayload(await guestMergePayload())).toBe(false);
    await signOutAndReset();

    // B entra en este dispositivo: lo que se fusionaría en su cuenta está vacío.
    expect(isEmptyPayload(await guestMergePayload())).toBe(true);
    // También si B navega un rato antes de entrar (identidad nueva, sin nada).
    await holder.guest.identity.ensure();
    expect(isEmptyPayload(await guestMergePayload())).toBe(true);
  });
});
