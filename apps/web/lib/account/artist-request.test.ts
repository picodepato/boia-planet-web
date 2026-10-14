import { readFileSync } from 'node:fs';
import { RPC_REJECTIONS } from '@boia/db/rpc';
import type { AdminArtistClaimRequest } from '@boia/db/rpc';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { claimStatus, claimStatusText } from '../../app/admin/real/artist-claims';
import { ArtistRequestList, RequestCountBadge } from '../../app/admin/real/artist-requests';
import { t } from '../i18n';
import type { BoiaSupabase } from '../supabase/browser';
import { ArtistPickerView, type PickerView } from './artist-picker';
import {
  cancelRequest,
  foldName,
  myRequest,
  requestErrorKey,
  requestProfile,
  showsArtistPicker,
  unclaimedProfiles,
} from './artist-request';
import { ArtistRequestStatusView } from './artist-request-status';

/**
 * «¿Eres uno de estos artistas?» con el enlace general (plan 031 T297): la
 * migración leída como texto (contra la base:
 * packages/db/src/supabase/artist-claim-requests.supabase.ts), el selector
 * tras el alta, «Solicitud enviada» en el Carnet y la lista del Admin.
 */
const read = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const SQL = read('supabase/migrations/20261015100400_artist_claim_requests.sql');
const TYPES = read('packages/db/src/database.types.ts');
const SHEET = read('apps/web/lib/account/sign-in-sheet.tsx');
const ADMIN_APP = read('apps/web/app/admin/admin-app.tsx');
const CARNET_PAGE = read('apps/web/app/carnet/carnet-page.tsx');

function body(name: string): string {
  const start = SQL.search(
    new RegExp(`create (or replace )?function ${name.replace('.', '\\.')}\\(`),
  );
  expect(start, name).toBeGreaterThanOrEqual(0);
  return SQL.slice(start, SQL.indexOf('$$;', start));
}

const PUBLIC = [
  'request_artist_profile',
  'my_artist_claim_request',
  'cancel_artist_claim_request',
  'admin_artist_claim_requests',
  'admin_decide_artist_claim_request',
];

describe('la migración 20261015100400', () => {
  it('pedir es del Carnet de la sesión y nunca une', () => {
    const req = body('private.request_artist_profile');
    expect(req).toContain('p_user uuid := private.require_member();');
    expect(req).not.toContain('join_artist_profile');
    expect(req).not.toMatch(/update public\.carnets/);
    expect(req).toContain("raise exception 'artist_required'");
    expect(req).toContain("raise exception 'profile_claimed'");
    expect(req).toContain("raise exception 'request_pending'");
    expect(req).toContain("raise exception 'profile_requested'");
    expect(req).toContain("'claim_request_created'");
    // Una pendiente por Carnet y por ficha.
    expect(SQL).toMatch(/on private\.artist_claim_requests \(user_id\) where status = 'pending'/);
    expect(SQL).toMatch(
      /on private\.artist_claim_requests \(profile_id\) where status = 'pending'/,
    );
    // Retirar y ver: sólo la propia.
    expect(body('private.cancel_artist_claim_request')).toContain(
      "where user_id = p_user and status = 'pending'",
    );
    expect(body('private.my_artist_claim_request')).toContain(
      "where r.user_id = p_user and r.status = 'pending'",
    );
  });

  it('sólo el Admin decide: aprobar une con auditoría claim_request_approved; rechazar cierra', () => {
    const decide = body('private.admin_decide_artist_claim_request');
    expect(decide).toContain("actor uuid := private.require_staff('admin');");
    expect(decide).toContain(
      "private.join_artist_profile(\n      req.user_id, req.profile_id, actor, 'claim_request_approved', p_reason",
    );
    expect(decide).toContain("raise exception 'request_closed'");
    expect(decide).toContain("'claim_request_rejected'");
    expect(body('private.admin_artist_claim_requests')).toContain(
      "perform private.require_staff('admin');",
    );
  });

  it('una ficha unida por cualquier vía cierra sus solicitudes pendientes', () => {
    const join = body('private.join_artist_profile');
    expect(join).toContain("set status = 'closed'");
    expect(join).toContain(
      "where status = 'pending' and (profile_id = profile or user_id = p_user)",
    );
  });

  it('modelo de seguridad de T278 y nada para anon', () => {
    for (const name of PUBLIC) {
      expect(body(`public.${name}`)).toContain('security invoker');
      expect(body(`private.${name}`)).toContain('security definer');
      expect(body(`private.${name}`)).toContain("set search_path = ''");
      expect(TYPES).toContain(`${name}: {`);
    }
    expect(SQL).toContain(
      'revoke all on private.artist_claim_requests from public, anon, authenticated, service_role;',
    );
    const grants = [...SQL.matchAll(/grant execute on function [^;]+ to ([^;]+);/g)];
    expect(grants).toHaveLength(PUBLIC.length * 2);
    for (const g of grants) expect(g[1]).toBe('authenticated');
    for (const m of SQL.matchAll(/raise exception '([a-z_]+)'/g)) {
      expect(RPC_REJECTIONS).toContain(m[1]);
    }
  });
});

describe('el selector tras el alta con el enlace general', () => {
  it('sale con el enlace general y un Carnet de artista; no con el personal ni sin código', () => {
    expect(showsArtistPicker({ artistCode: true, personalClaim: false, isArtist: true })).toBe(
      true,
    );
    // El servidor no dio el código por bueno: no es artista.
    expect(showsArtistPicker({ artistCode: true, personalClaim: false, isArtist: false })).toBe(
      false,
    );
    // El enlace personal ya une solo (T296).
    expect(showsArtistPicker({ artistCode: true, personalClaim: true, isArtist: true })).toBe(
      false,
    );
    expect(showsArtistPicker({ artistCode: false, personalClaim: false, isArtist: true })).toBe(
      false,
    );
  });

  it('la hoja lee el código antes de crear el Carnet (createProfile lo olvida) y carga el selector a demanda', () => {
    const at = (s: string) => SHEET.indexOf(s);
    expect(at('const artistCode = pendingArtistCode() !== null;')).toBeGreaterThan(0);
    expect(at('const artistCode = pendingArtistCode() !== null;')).toBeLessThan(
      at('await createProfile('),
    );
    expect(SHEET).toContain("lazy(() =>\n  import('./artist-picker')");
    expect(SHEET).not.toMatch(/^import .*'\.\/artist-picker'/m);
  });

  it('las fichas sin reclamar, de la A a la Z, buscando sin tildes', () => {
    const all = [
      { id: 'zoe', name: 'Zoé' },
      { id: 'alba-fitz', name: 'Alba Fitz' },
      { id: 'angel', name: 'Ángel Sur' },
      { id: 'bea', name: 'Bea' },
    ];
    expect(unclaimedProfiles(all, new Set(['bea'])).map((p) => p.id)).toEqual([
      'alba-fitz',
      'angel',
      'zoe',
    ]);
    expect(unclaimedProfiles(all, new Set(), 'ANGEL').map((p) => p.id)).toEqual(['angel']);
    expect(unclaimedProfiles(all, new Set(), 'zoe').map((p) => p.id)).toEqual(['zoe']);
    expect(unclaimedProfiles(all, new Set(), 'nadie')).toEqual([]);
    expect(foldName('  Ángel ')).toBe('angel');
  });

  const choose = (patch: Partial<Extract<PickerView, { kind: 'choose' }>> = {}): PickerView => ({
    kind: 'choose',
    query: '',
    profiles: [
      { id: 'alba-fitz', name: 'Alba Fitz' },
      { id: 'bea', name: 'Bea' },
    ],
    total: 2,
    busy: false,
    error: null,
    ...patch,
  });
  const html = (view: PickerView) =>
    renderToStaticMarkup(createElement(ArtistPickerView, { view }));

  it('la vista: la pregunta, las fichas, la búsqueda y «No, soy nuevo»', () => {
    const out = html(choose());
    expect(out).toContain(t('carnet.request.title'));
    expect(out).toContain('data-testid="artista-selector-alba-fitz"');
    expect(out).toContain('data-testid="artista-selector-bea"');
    expect(out).toContain('data-testid="artista-selector-buscar"');
    expect(out).toContain(t('carnet.request.new'));
    expect(out).toContain(t('carnet.request.review'));
    expect(html(choose({ profiles: [], query: 'x' }))).toContain(t('carnet.request.noMatch'));
    expect(html(choose({ error: 'carnet.request.errorRequested' }))).toContain(
      t('carnet.request.errorRequested'),
    );
    const empty = html(choose({ profiles: [], total: 0 }));
    expect(empty).toContain(t('carnet.request.none'));
    expect(empty).not.toContain('artista-selector-buscar');
  });

  it('la vista: «Solicitud enviada: BOIA la revisará»', () => {
    const out = html({ kind: 'sent', name: 'Alba Fitz' });
    expect(out).toContain('data-testid="artista-solicitud-enviada"');
    expect(t('carnet.request.sent', { name: 'Alba Fitz' })).toContain(
      'Solicitud enviada: BOIA la revisará',
    );
    expect(out).toContain('Alba Fitz');
    expect(out).not.toContain(t('carnet.request.new'));
  });

  it('pedir manda la ficha y su nombre; los rechazos, en palabras; sin red, se dice', async () => {
    const rpc = vi.fn(async (_name: string, _args?: unknown) => ({
      data: { id: 'r1', profile_id: 'bea', profile_name: 'Bea', status: 'pending' },
      error: null as null | { code?: string; message: string },
    }));
    const sb = { rpc } as unknown as BoiaSupabase;
    const ok = await requestProfile(sb, { id: 'bea', name: 'Bea' });
    expect(rpc).toHaveBeenCalledWith('request_artist_profile', { p_profile: 'bea', p_name: 'Bea' });
    expect(ok).toMatchObject({ kind: 'sent', request: { profile_name: 'Bea' } });
    rpc.mockResolvedValueOnce({
      data: null as never,
      error: { code: 'P0001', message: 'profile_requested' },
    });
    expect(await requestProfile(sb, { id: 'bea', name: 'Bea' })).toEqual({
      kind: 'rejected',
      reason: 'profile_requested',
    });
    rpc.mockResolvedValueOnce({ data: null as never, error: { message: 'fetch failed' } });
    expect(await requestProfile(sb, { id: 'bea', name: 'Bea' })).toEqual({ kind: 'offline' });
    expect(requestErrorKey('profile_claimed')).toBe('carnet.request.errorClaimed');
    expect(requestErrorKey('profile_requested')).toBe('carnet.request.errorRequested');
    expect(requestErrorKey('lo_que_sea')).toBe('carnet.request.errorGeneric');
    // La propia y retirarla.
    rpc.mockResolvedValueOnce({ data: null as never, error: null });
    expect(await myRequest(sb)).toBeNull();
    rpc.mockResolvedValueOnce({ data: null as never, error: { message: 'no existe' } });
    expect(await myRequest(sb)).toBeUndefined();
    rpc.mockResolvedValueOnce({ data: { cancelled: true } as never, error: null });
    expect(await cancelRequest(sb)).toBe(true);
    expect(rpc).toHaveBeenLastCalledWith('cancel_artist_claim_request');
  });
});

describe('en el Carnet propio', () => {
  it('«Solicitud enviada: BOIA la revisará» y «Retirar solicitud»', () => {
    const out = renderToStaticMarkup(
      createElement(ArtistRequestStatusView, {
        view: { kind: 'pending', name: 'Alba Fitz', busy: false, error: false },
      }),
    );
    expect(out).toContain('data-testid="carnet-solicitud"');
    expect(out).toContain('Solicitud enviada: BOIA la revisará');
    expect(out).toContain('Alba Fitz');
    expect(out).toContain(t('carnet.request.cancel'));
    const gone = renderToStaticMarkup(
      createElement(ArtistRequestStatusView, { view: { kind: 'cancelled' } }),
    );
    expect(gone).toContain(t('carnet.request.cancelled'));
    expect(CARNET_PAGE).toContain('<ArtistRequestStatus />');
  });
});

describe('el Admin: «Solicitudes de artistas»', () => {
  const req: AdminArtistClaimRequest = {
    id: '11111111-1111-1111-1111-111111111111',
    user_id: '22222222-2222-2222-2222-222222222222',
    nickname: 'Lola',
    email: 'lola@example.test',
    profile_id: 'alba-fitz',
    profile_name: 'Alba Fitz',
    created_at: '2026-10-15T10:30:00Z',
  };
  const list = (requests: AdminArtistClaimRequest[] | null) =>
    renderToStaticMarkup(
      createElement(ArtistRequestList, { requests, busy: false, onDecide: () => undefined }),
    );

  it('cada solicitud: apodo, email, la ficha elegida, la fecha, Aprobar y Rechazar', () => {
    const out = list([req]);
    expect(out).toContain('Lola');
    expect(out).toContain('lola@example.test');
    expect(out).toContain(t('admin.real.requests.profile', { name: 'Alba Fitz' }));
    expect(out).toContain('15/10/2026');
    expect(out).toContain(`data-testid="solicitud-aprobar-${req.id}"`);
    expect(out).toContain(`data-testid="solicitud-rechazar-${req.id}"`);
    expect(list([])).toContain(t('admin.real.requests.empty'));
  });

  it('el número del menú: sólo con pendientes', () => {
    expect(renderToStaticMarkup(createElement(RequestCountBadge, { n: 0 }))).toBe('');
    const out = renderToStaticMarkup(createElement(RequestCountBadge, { n: 3 }));
    expect(out).toContain('>3<');
    expect(out).toContain('data-testid="admin-nav-solicitudes-numero"');
    expect(ADMIN_APP).toContain("id: 'solicitudes'");
    expect(ADMIN_APP).toContain('<RequestCountBadge n={pendingRequests} />');
  });

  it('«Perfiles de artista» enseña la solicitud pendiente de una ficha', () => {
    const s = claimStatus('alba-fitz', new Map(), [], Date.now(), [req]);
    expect(s).toEqual({ kind: 'requested', nickname: 'Lola', at: req.created_at });
    expect(claimStatusText(s)).toContain('Lola');
    // Reclamada gana a la solicitud.
    expect(
      claimStatus('alba-fitz', new Map([['alba-fitz', 'Otra']]), [], Date.now(), [req]),
    ).toEqual({
      kind: 'claimed',
      nickname: 'Otra',
    });
  });
});
