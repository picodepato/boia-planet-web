import { readFileSync } from 'node:fs';
import { MemoryStorage, createLocalRepository } from '@boia/store';
import { RPC_REJECTIONS } from '@boia/db/rpc';
import { describe, expect, it } from 'vitest';
import { PRIVATE_PATHS } from '../../robots';
import { t } from '../../../lib/i18n';
import {
  DOOR_LINK_PATH,
  cleanDoorToken,
  doorLinkUrl,
  localDoorLinks,
  newDoorToken,
} from '../../../lib/door-links';
import { carnetPath } from '../../../lib/mundo/carnet/share';
import { outcomeText } from './backend';
import { linkStampFromQr, localLinkDoor, localLinksAdmin } from './links';

/**
 * El enlace de la puerta (plan 034 T307): los enlaces de la versión de
 * prueba (este navegador, D-20), el lector del enlace sobre su repositorio
 * y la migración leída como texto. Contra la base:
 * packages/db/src/supabase/door-links.supabase.ts (`pnpm test:supabase`).
 */
const ORIGIN = 'http://localhost:3000';

async function setup() {
  const storage = new MemoryStorage();
  const repo = createLocalRepository({ storage: new MemoryStorage(), watch: false });
  const mine = await repo.carnet.create({ nickname: 'Grumete Enlace' });
  const events = (await repo.content.list('events')).filter(
    (e) => e.state !== 'draft' && e.state !== 'cancelled',
  );
  return { storage, repo, mine, party: events[0]!, otherParty: events[1]! };
}

describe('el código y la URL del enlace', () => {
  it('64 cifras hexadecimales; lo demás no es un código', () => {
    const token = newDoorToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(newDoorToken()).not.toBe(token);
    expect(cleanDoorToken(token.toUpperCase())).toBe(token);
    expect(cleanDoorToken('nada')).toBeNull();
    expect(cleanDoorToken('%E0%A4%A')).toBeNull();
    expect(doorLinkUrl(ORIGIN, token)).toBe(`${ORIGIN}${DOOR_LINK_PATH}/${token}`);
  });

  it('ningún buscador rastrea los enlaces de la puerta', () => {
    expect(PRIVATE_PATHS.some((p) => `${DOOR_LINK_PATH}/${newDoorToken()}`.startsWith(p))).toBe(
      true,
    );
  });
});

describe('los enlaces de la versión de prueba', () => {
  it('uno vivo por fiesta: crear otro sustituye al anterior; revocar lo quita', async () => {
    const { storage, repo, party, otherParty } = await setup();
    const admin = localLinksAdmin(repo, storage);
    const first = await admin.create(party.id);
    const second = await admin.create(party.id);
    await admin.create(otherParty.id);
    expect(second).not.toBe(first);
    expect((await admin.list()).map((l) => l.party).sort()).toEqual(
      [party.id, otherParty.id].sort(),
    );
    const links = localDoorLinks(storage);
    expect(links.find(first)).toBeNull();
    expect(links.find(second)?.eventId).toBe(party.id);
    await admin.revoke(party.id);
    expect(links.find(second)).toBeNull();
    expect((await admin.list()).map((l) => l.party)).toEqual([otherParty.id]);
  });

  it('sin almacenamiento no rompe: no hay enlaces', () => {
    const links = localDoorLinks(null);
    expect(links.list()).toEqual([]);
    expect(links.find(newDoorToken())).toBeNull();
  });
});

describe('el lector del enlace, sin servidor', () => {
  it('sabe de qué fiesta es y sella un Carnet una vez', async () => {
    const { storage, repo, mine, party } = await setup();
    const token = await localLinksAdmin(repo, storage).create(party.id);
    const door = localLinkDoor(repo, storage, token);
    expect(await door.title()).toBe(party.name);
    const qr = `${ORIGIN}${carnetPath(mine.userId)}`;
    const first = await linkStampFromQr(door, qr);
    expect(first).toMatchObject({ kind: 'granted', nickname: 'Grumete Enlace', party: party.name });
    expect((await linkStampFromQr(door, qr)).kind).toBe('already');
    expect((await repo.carnet.mine())?.stamps.map((s) => s.eventId)).toEqual([party.id]);
    expect(await repo.admin.attendance(party.id)).toHaveLength(1);
  });

  it('otro QR o un Carnet que no existe: no sella', async () => {
    const { storage, repo, party } = await setup();
    const door = localLinkDoor(
      repo,
      storage,
      await localLinksAdmin(repo, storage).create(party.id),
    );
    expect((await linkStampFromQr(door, 'https://example.com')).kind).toBe('notCarnet');
    const ghost = `${ORIGIN}${carnetPath('3f2b8c1e-9d4a-4f6b-8a2e-1c5d7e9f0a1b')}`;
    expect((await linkStampFromQr(door, ghost)).kind).toBe('unknown');
  });

  it('revocado o equivocado: no vale', async () => {
    const { storage, repo, mine, party } = await setup();
    const admin = localLinksAdmin(repo, storage);
    const token = await admin.create(party.id);
    const door = localLinkDoor(repo, storage, token);
    await admin.revoke(party.id);
    expect(await door.title()).toBeNull();
    const r = await linkStampFromQr(door, `${ORIGIN}${carnetPath(mine.userId)}`);
    expect(r.kind).toBe('linkGone');
    expect(outcomeText(r)).toBe(t('puerta.link.gone'));
    expect(await localLinkDoor(repo, storage, newDoorToken()).title()).toBeNull();
    expect((await repo.carnet.mine())?.stamps).toEqual([]);
  });
});

describe('la migración del enlace, como texto', () => {
  const read = (path: string) =>
    readFileSync(new URL(`../../../../../${path}`, import.meta.url), 'utf8');
  const SQL = read('supabase/migrations/20261021100100_door_links.sql');
  const TYPES = read('packages/db/src/database.types.ts');

  it('sólo guarda el hash del código; RLS y nadie de fuera lee la tabla', () => {
    expect(SQL).toContain("token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$')");
    expect(SQL).not.toMatch(/\btoken text\b[^\n]*not null/);
    expect(SQL).toContain('alter table public.door_links enable row level security;');
    expect(SQL).toContain(
      'revoke all on public.door_links from public, anon, authenticated, service_role;',
    );
    expect(SQL).not.toMatch(/grant [^;]* on public\.door_links to (anon|authenticated)/);
  });

  it('el enlace sella sin cuenta; el Admin, sólo con sesión', () => {
    for (const fn of ['door_link_info(text)', 'door_link_stamp(text, uuid)']) {
      expect(SQL).toContain(`grant execute on function public.${fn} to anon, authenticated;`);
    }
    for (const fn of [
      'admin_create_door_link(text, text)',
      'admin_door_links()',
      'admin_revoke_door_link(text, text)',
    ]) {
      expect(SQL).toContain(`grant execute on function public.${fn} to authenticated;`);
      expect(SQL).not.toMatch(
        new RegExp(`grant execute on function public\\.${fn.replace(/[()]/g, '\\$&')} to anon`),
      );
    }
    expect(SQL.match(/private\.require_staff\('admin'\)/g)).toHaveLength(3);
  });

  it('la asistencia apunta el enlace; cada rechazo lo conoce la web', () => {
    expect(SQL).toContain("values (ev.id, p_member, 'door', null, link_id)");
    expect(SQL).toContain("'puerta:' || ev.slug");
    for (const m of SQL.matchAll(/raise exception '([a-z_]+)'/g)) {
      expect(RPC_REJECTIONS).toContain(m[1]);
    }
  });

  it('los tipos de la base la conocen', () => {
    expect(TYPES).toContain('door_links: {');
    expect(TYPES).toMatch(/door_link_stamp: \{\s*Args: \{\s*p_token: string;\s*p_member: string;/);
    expect(TYPES).toContain('door_link_id: string | null;');
  });
});
