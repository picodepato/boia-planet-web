/**
 * Números de socio por orden de llegada y enlace de artistas (plan 016 T186,
 * migración 20261006100600) contra el proyecto de desarrollo:
 *
 * - números seguidos y sin hueco aunque un alta falle;
 * - artistas y socios comparten la serie;
 * - el Admin cambia un número sólo a uno libre y queda en la auditoría;
 * - un código equivocado o ya rotado no hace artista; el vigente, sí.
 *
 * Las altas de esta prueba van seguidas; otra ejecución a la vez contra el
 * mismo proyecto podría colarse en la serie (por eso se lanzan de una en una).
 */
import { randomInt } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ArtistLinkInfo, ArtistLinkRotation, ProfileResult } from '../rpc.ts';
import { context, expectDenied, expectRejected, ok, type Member } from './context.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const POLICY = 'muestra-2026-10-06';
const run = testRunId();
const nick = (s: string) => `${s} ${run}`;

let admin: Member;

beforeAll(async () => {
  admin = await ctx.member('admin-numeros');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
  await elevateToAal2(admin.client);
});

afterAll(async () => {
  await ctx.cleanup();
});

async function join(m: Member, name: string, code?: string): Promise<ProfileResult> {
  return (await ok(
    m.client.rpc('save_profile', {
      p_nickname: nick(name),
      p_privacy_version: POLICY,
      ...(code === undefined ? {} : { p_artist_code: code }),
    }),
  )) as unknown as ProfileResult;
}

async function rotate(): Promise<string> {
  const res = (await ok(
    admin.client.rpc('admin_rotate_artist_link', { p_reason: 'prueba T186' }),
  )) as unknown as ArtistLinkRotation;
  expect(res.code).toMatch(/^[0-9a-f]{32}$/);
  return res.code;
}

describe('números de socio por orden de llegada, sin huecos', () => {
  it('un alta que falla no gasta número: la siguiente lleva el siguiente', async () => {
    const a = await ctx.member('num-a');
    const b = await ctx.member('num-b');
    const first = await join(a, 'Numera');
    // Falla en el INSERT (apodo repetido): con una identidad esto quemaba un número.
    await expectRejected(
      b.client.rpc('save_profile', { p_nickname: nick('NUMERA'), p_privacy_version: POLICY }),
      'nickname_taken',
    );
    // Y sin la política, antes del INSERT.
    await expectRejected(
      b.client.rpc('save_profile', { p_nickname: nick('Sin Politica') }),
      'privacy_required',
    );
    const second = await join(b, 'Numerb');
    expect(second.member_number).toBe(first.member_number + 1);
  });

  it('artistas y socios comparten la misma serie', async () => {
    const code = await rotate();
    const m1 = await ctx.member('num-socio');
    const art = await ctx.member('num-artista');
    const m2 = await ctx.member('num-socio-2');
    const p1 = await join(m1, 'Serie Uno');
    const pa = await join(art, 'Serie Artista', code);
    const p2 = await join(m2, 'Serie Dos');
    expect(pa.is_artist).toBe(true);
    expect([p1.is_artist, p2.is_artist]).toEqual([false, false]);
    expect([pa.member_number, p2.member_number]).toEqual([
      p1.member_number + 1,
      p1.member_number + 2,
    ]);
  });
});

describe('el Admin cambia un número de socio', () => {
  let a: Member;
  let b: Member;
  let pa: ProfileResult;
  let pb: ProfileResult;

  beforeAll(async () => {
    a = await ctx.member('cambio-a');
    b = await ctx.member('cambio-b');
    pa = await join(a, 'Cambia A');
    pb = await join(b, 'Cambia B');
  });

  it('rechaza un número ocupado y uno inválido', async () => {
    await expectRejected(
      admin.client.rpc('admin_set_member_number', { p_user: a.id, p_number: pb.member_number }),
      'number_taken',
    );
    await expectRejected(
      admin.client.rpc('admin_set_member_number', { p_user: a.id, p_number: 0 }),
      'invalid_number',
    );
    await expectRejected(
      admin.client.rpc('admin_set_member_number', {
        p_user: '00000000-0000-4000-8000-000000000000',
        p_number: 99_000_001,
      }),
      'unknown_member',
    );
    const still = await ok(
      ctx.anon.from('carnets').select('member_number').eq('user_id', a.id).single(),
    );
    expect(still.member_number).toBe(pa.member_number);
  });

  it('a uno libre, sí, y queda en la auditoría con el anterior y el nuevo', async () => {
    const free = 90_000_000 + randomInt(1_000_000);
    const res = (await ok(
      admin.client.rpc('admin_set_member_number', {
        p_user: a.id,
        p_number: free,
        p_reason: 'prueba T186',
      }),
    )) as unknown as ProfileResult;
    expect(res.member_number).toBe(free);
    const audit = await ok(
      admin.client
        .from('audit_log')
        .select('action, reason, old_value, new_value')
        .eq('entity_id', a.id)
        .eq('action', 'set_member_number'),
    );
    expect(audit).toEqual([
      {
        action: 'set_member_number',
        reason: 'prueba T186',
        old_value: { member_number: pa.member_number },
        new_value: { member_number: free },
      },
    ]);
  });

  it('un socio no cambia números; sin cuenta, nadie', async () => {
    await expectRejected(
      b.client.rpc('admin_set_member_number', { p_user: b.id, p_number: 1 }),
      'forbidden',
    );
    await expectDenied(ctx.anon.rpc('admin_set_member_number', { p_user: b.id, p_number: 1 }));
  });
});

describe('el enlace de artistas', () => {
  it('un código equivocado o ya rotado no hace artista; el vigente, sí', async () => {
    const old = await rotate();
    const current = await rotate();
    expect(current).not.toBe(old);
    const wrong = await ctx.member('enlace-mal');
    const stale = await ctx.member('enlace-viejo');
    const good = await ctx.member('enlace-bien');
    expect((await join(wrong, 'Enlace Mal', 'no-es-el-codigo')).is_artist).toBe(false);
    expect((await join(stale, 'Enlace Viejo', old)).is_artist).toBe(false);
    const artist = await join(good, 'Enlace Bien', current.toUpperCase());
    expect(artist.is_artist).toBe(true);
    const pub = await ok(
      ctx.anon.from('carnets').select('is_artist').eq('user_id', good.id).single(),
    );
    expect(pub.is_artist).toBe(true);
  });

  it('un Carnet que ya existe no se hace artista con el enlace', async () => {
    const code = await rotate();
    const m = await ctx.member('enlace-tarde');
    await join(m, 'Enlace Tarde');
    const again = (await ok(
      m.client.rpc('save_profile', { p_nickname: nick('Enlace Tarde'), p_artist_code: code }),
    )) as unknown as ProfileResult;
    expect(again.is_artist).toBe(false);
  });

  it('el código no se guarda en claro ni en la auditoría; sólo el Admin rota y consulta', async () => {
    const code = await rotate();
    const info = (await ok(
      admin.client.rpc('admin_artist_link_info'),
    )) as unknown as ArtistLinkInfo;
    expect(info.active).toBe(true);
    expect(info.rotated_at).toBeTruthy();
    const audit = await ok(
      admin.client
        .from('audit_log')
        .select('old_value, new_value')
        .eq('action', 'rotate_artist_link'),
    );
    expect(audit.length).toBeGreaterThan(0);
    expect(JSON.stringify(audit)).not.toContain(code);
    const m = await ctx.member('enlace-socio');
    await expectRejected(m.client.rpc('admin_rotate_artist_link', {}), 'forbidden');
    await expectRejected(m.client.rpc('admin_artist_link_info'), 'forbidden');
    await expectDenied(ctx.anon.rpc('admin_rotate_artist_link', {}));
  });
});
