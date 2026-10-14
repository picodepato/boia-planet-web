import { readFileSync } from 'node:fs';
import type { Artist } from '@boia/contracts';
import { RPC_REJECTIONS } from '@boia/db/rpc';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtistClaimRow, claimStatus, claimStatusText } from '../../app/admin/real/artist-claims';
import {
  ArtistClaimView,
  type ClaimView,
} from '../../app/artista/reclamar/[code]/artist-claim-landing';
import { metadata as claimMeta } from '../../app/artista/reclamar/[code]/page';
import { PRIVATE_PATHS } from '../../app/robots';
import { contentProfileIdOf } from '../artists/claimed-carnet';
import { t } from '../i18n';
import {
  ARTIST_CLAIM_KEY,
  claimLinkHref,
  cleanClaimCode,
  clearClaim,
  pendingClaim,
  pendingClaimCode,
  rememberClaim,
  whatsappHref,
} from './artist-claim';
import { redeemPendingClaim } from './artist-claim-redeem';
import type { BoiaSupabase } from '../supabase/browser';

/**
 * El enlace personal para reclamar una ficha de artista (plan 031 T296): la
 * migración leída como texto (contra la base:
 * packages/db/src/supabase/artist-claim-links.supabase.ts), lo que recuerda
 * la pestaña, la página del enlace y el estado de cada ficha en el Admin.
 */
const read = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const SQL = read('supabase/migrations/20261015100300_artist_claim_links.sql');
const TYPES = read('packages/db/src/database.types.ts');

function body(name: string): string {
  const start = SQL.search(
    new RegExp(`create (or replace )?function ${name.replace('.', '\\.')}\\(`),
  );
  expect(start, name).toBeGreaterThanOrEqual(0);
  return SQL.slice(start, SQL.indexOf('$$;', start));
}

describe('la migración 20261015100300', () => {
  it('sólo el Admin crea códigos; se guardan con hash y no van a la auditoría', () => {
    const create = body('private.admin_create_artist_claim_link');
    expect(create).toContain("actor uuid := private.require_staff('admin');");
    expect(create).toContain('private.artist_code_hash(code)');
    expect(create).toContain("interval '30 days'");
    expect(create).toContain("raise exception 'profile_claimed'");
    // La auditoría lleva fechas, nunca el código.
    const audit = create.slice(create.indexOf('insert into public.audit_log'));
    expect(audit.slice(0, audit.indexOf(');'))).not.toMatch(/\bcode\b(?!_)/);
    expect(SQL).toMatch(/code_hash text not null unique/);
    const table = SQL.slice(
      SQL.indexOf('create table'),
      SQL.indexOf(');', SQL.indexOf('create table')),
    );
    expect(table).not.toMatch(/^\s*code\b/m);
    expect(body('private.admin_artist_claim_links')).toContain(
      "perform private.require_staff('admin');",
    );
    expect(body('private.admin_artist_claim_links')).not.toContain('code_hash');
  });

  it('reclamar: cuenta de la sesión, código vigente sin gastar, la unión de T295 y se gasta', () => {
    const claim = body('private.claim_artist_profile');
    expect(claim).toContain('p_user uuid := private.require_member();');
    expect(claim).toContain('link.spent_at is not null or link.expires_at <= now()');
    expect(claim).toContain(
      "private.join_artist_profile(p_user, link.profile_id, p_user, 'claim_link'",
    );
    expect(claim).toContain('set spent_at = now(), spent_by = p_user');
    expect(claim).toContain('for update');
    const info = body('private.artist_claim_info');
    expect(info).toContain('l.spent_at is null');
    expect(info).toContain('l.expires_at > now()');
  });

  it('modelo de seguridad de T278: privada DEFINER, pública INVOKER, permisos justos', () => {
    for (const name of [
      'admin_create_artist_claim_link',
      'admin_artist_claim_links',
      'artist_claim_info',
      'claim_artist_profile',
    ]) {
      expect(body(`public.${name}`)).toContain('security invoker');
      expect(body(`private.${name}`)).toContain('security definer');
      expect(body(`private.${name}`)).toContain("set search_path = ''");
      expect(TYPES).toContain(`${name}: {`);
    }
    expect(SQL).toContain(
      'revoke all on private.artist_claim_links from public, anon, authenticated, service_role;',
    );
    // Sin cuenta, sólo la información del enlace.
    const anonGrants = [
      ...SQL.matchAll(/grant execute on function ([a-z_.]+)\([^)]*\) to ([^;]+);/g),
    ]
      .filter((m) => m[2]!.includes('anon'))
      .map((m) => m[1]);
    expect(anonGrants).toEqual(['private.artist_claim_info', 'public.artist_claim_info']);
    for (const m of SQL.matchAll(/raise exception '([a-z_]+)'/g)) {
      expect(RPC_REJECTIONS).toContain(m[1]);
    }
  });
});

describe('lo que recuerda la pestaña', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('el enlace y el código limpio', () => {
    expect(claimLinkHref('abc123', 'https://boiaplanet.net')).toBe(
      'https://boiaplanet.net/artista/reclamar/abc123',
    );
    expect(cleanClaimCode(' abc-123 ')).toBe('abc-123');
    expect(cleanClaimCode('a b')).toBeNull();
    expect(cleanClaimCode('x'.repeat(65))).toBeNull();
    expect(whatsappHref('hola tú')).toBe('https://wa.me/?text=hola%20t%C3%BA');
  });

  it('recuerda código y nombre hasta que se olvida; un código raro no se guarda', () => {
    expect(rememberClaim('no vale!', 'Alba')).toBe(false);
    expect(pendingClaim()).toBeNull();
    expect(rememberClaim('abc123', 'Alba Fitz')).toBe(true);
    expect(pendingClaim()).toEqual({ code: 'abc123', name: 'Alba Fitz' });
    expect(pendingClaimCode()).toBe('abc123');
    clearClaim();
    expect(pendingClaimCode()).toBeNull();
    store.set(ARTIST_CLAIM_KEY, '{roto');
    expect(pendingClaim()).toBeNull();
  });

  it('con Carnet, se reclama una vez: con respuesta se olvida; sin red, se queda', async () => {
    const rpc = vi.fn();
    const sb = { rpc } as unknown as BoiaSupabase;
    rememberClaim('abc123', 'Alba Fitz');
    rpc.mockResolvedValueOnce({ data: null, error: { code: '', message: 'Failed to fetch' } });
    expect(await redeemPendingClaim(sb)).toEqual({ kind: 'offline' });
    expect(pendingClaimCode()).toBe('abc123');
    rpc.mockResolvedValueOnce({
      data: { artist_profile_id: 'alba-fitz', profile_name: 'Alba Fitz', joined: true },
      error: null,
    });
    expect(await redeemPendingClaim(sb)).toEqual({
      kind: 'joined',
      name: 'Alba Fitz',
      profileId: 'alba-fitz',
    });
    expect(rpc).toHaveBeenLastCalledWith('claim_artist_profile', { p_code: 'abc123' });
    expect(pendingClaimCode()).toBeNull();
    // Un código que no vale también se olvida (alta normal, sin unión).
    rememberClaim('viejo', 'Alba Fitz');
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'claim_invalid' } });
    expect(await redeemPendingClaim(sb)).toEqual({ kind: 'rejected', reason: 'claim_invalid' });
    expect(pendingClaimCode()).toBeNull();
    expect(await redeemPendingClaim(sb)).toBeNull();
  });
});

describe('la página /artista/reclamar/<código>', () => {
  const render = (view: ClaimView) =>
    renderToStaticMarkup(createElement(ArtistClaimView, { view }));

  it('sin indexar (robots.txt ya aparta /artista/)', () => {
    expect(claimMeta.robots).toEqual({ index: false, follow: false });
    expect(PRIVATE_PATHS.some((p) => '/artista/reclamar/abc'.startsWith(p))).toBe(true);
  });

  it('código bueno sin sesión: «Reclama tu perfil de <nombre>» y al alta', () => {
    const html = render({ kind: 'valid', name: 'Alba Fitz', nickname: null });
    expect(html).toContain(t('carnet.claim.title', { name: 'Alba Fitz' }));
    expect(html).toContain(t('carnet.claim.go'));
    expect(html).toContain('data-estado="valid"');
  });

  it('código bueno con Carnet: se une al suyo', () => {
    const html = render({ kind: 'valid', name: 'Alba Fitz', nickname: 'Albita' });
    expect(html).toContain(t('carnet.claim.useMine', { nickname: 'Albita' }));
    expect(html).not.toContain(t('carnet.claim.go'));
  });

  it('código que no vale: un mensaje claro y el alta normal', () => {
    const html = render({ kind: 'invalid' });
    expect(html).toContain(t('carnet.claim.invalidTitle'));
    expect(html).toContain('data-testid="reclamar-alta-normal"');
    expect(html).not.toContain(t('carnet.claim.go'));
  });

  it('modo local: lo dice y ofrece el alta normal', () => {
    const html = render({ kind: 'local' });
    expect(html).toContain(t('carnet.claim.local'));
    expect(html).toContain('data-testid="reclamar-alta-normal"');
  });

  it('unido: lo dice y abre su Carnet', () => {
    const html = render({ kind: 'joined', name: 'Alba Fitz', carnetHref: '/carnet/u1' });
    expect(html).toContain(t('carnet.claim.joined', { name: 'Alba Fitz' }));
    expect(html).toContain('href="/carnet/u1"');
  });
});

describe('«Perfiles de artista» en el Admin', () => {
  const NOW = Date.parse('2026-10-15T12:00:00Z');
  const link = (over: Record<string, unknown> = {}) => ({
    profile_id: 'alba-fitz',
    created_at: '2026-10-10T10:00:00Z',
    expires_at: '2026-11-09T10:00:00Z',
    spent_at: null,
    ...over,
  });
  const alba: Pick<Artist, 'id' | 'name'> = { id: 'alba-fitz', name: 'Alba Fitz' };

  it('sin reclamar / enlace enviado / reclamado por <apodo>', () => {
    expect(claimStatus('alba-fitz', new Map(), [], NOW)).toEqual({
      kind: 'unclaimed',
      expiredAt: null,
    });
    expect(claimStatus('alba-fitz', new Map(), [link()], NOW)).toEqual({
      kind: 'sent',
      at: '2026-10-10T10:00:00Z',
      expiresAt: '2026-11-09T10:00:00Z',
    });
    expect(claimStatus('alba-fitz', new Map([['alba-fitz', 'Albita']]), [link()], NOW)).toEqual({
      kind: 'claimed',
      nickname: 'Albita',
    });
    // Caducado: sin reclamar, con la fecha del enlace.
    expect(
      claimStatus('alba-fitz', new Map(), [link({ expires_at: '2026-10-11T00:00:00Z' })], NOW),
    ).toEqual({ kind: 'unclaimed', expiredAt: '2026-10-10T10:00:00Z' });
    // Gastado pero la unión se deshizo: sin reclamar.
    expect(
      claimStatus('alba-fitz', new Map(), [link({ spent_at: '2026-10-12T00:00:00Z' })], NOW),
    ).toEqual({ kind: 'unclaimed', expiredAt: null });
  });

  const row = (status: ReturnType<typeof claimStatus>, fresh: string | null = null) =>
    renderToStaticMarkup(
      createElement(ArtistClaimRow, {
        artist: alba,
        status,
        fresh,
        busy: false,
        onCreate: () => {},
      }),
    );

  it('sin reclamar: «Crear enlace para reclamar»', () => {
    const html = row({ kind: 'unclaimed', expiredAt: null });
    expect(html).toContain(t('admin.real.claims.unclaimed'));
    expect(html).toContain(t('admin.real.claims.create'));
  });

  it('enlace enviado: su fecha y crear otro (anula el anterior)', () => {
    const s = claimStatus('alba-fitz', new Map(), [link()], NOW);
    const html = row(s);
    expect(html).toContain(claimStatusText(s).replace(/&/g, '&amp;'));
    expect(html).toContain(t('admin.real.claims.recreate'));
  });

  it('reclamado: el apodo y ningún botón para crear enlace', () => {
    const html = row({ kind: 'claimed', nickname: 'Albita' });
    expect(html).toContain(t('admin.real.claims.claimedBy', { nickname: 'Albita' }));
    expect(html).not.toContain('perfil-crear-enlace-');
  });

  it('recién creado: el enlace una vez, copiar y el texto para WhatsApp', () => {
    const url = 'https://boiaplanet.net/artista/reclamar/abc';
    const html = row(
      { kind: 'sent', at: '2026-10-15T12:00:00Z', expiresAt: '2026-11-14T12:00:00Z' },
      url,
    );
    expect(html).toContain(`value="${url}"`);
    expect(html).toContain(t('admin.real.artistLink.copy'));
    expect(html).toContain('https://wa.me/?text=');
    expect(html).toContain('Alba Fitz');
  });
});

describe('el Carnet construido de una ficha', () => {
  it('reconoce /carnet/artista-<id>', () => {
    expect(contentProfileIdOf('artista-alba-fitz')).toBe('alba-fitz');
    expect(contentProfileIdOf('0f2c-uuid')).toBeNull();
    expect(contentProfileIdOf('artista-')).toBeNull();
    expect(contentProfileIdOf(null)).toBeNull();
  });
});
