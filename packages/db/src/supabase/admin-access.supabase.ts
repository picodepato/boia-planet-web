/**
 * Acceso del Admin con el Carnet 000, códigos de respaldo del TOTP y
 * «Descargar mis datos» (plan 017 T193, migración 20261007100400) contra el
 * proyecto de desarrollo:
 *
 * - el contador de socios nunca da el 0 y nadie pone el 0 a un socio;
 * - sólo service_role da el Carnet 000, y sólo a una cuenta admin u owner;
 * - con el 000 se pide el email de esa cuenta y se entra con su contraseña;
 * - los códigos de respaldo valen una vez y quitan el TOTP perdido;
 * - la descarga lleva lo de quien llama y nada de nadie más.
 *
 * El Carnet 000 es uno solo en todo el proyecto: si ya lo tiene la cuenta
 * del Admin de verdad, las pruebas que lo necesitan se limitan a comprobar
 * que no se puede quitar.
 */
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BackupCodeUse, BackupCodesResult, ProfileResult } from '../rpc.ts';
import { context, expectDenied, expectRejected, ok, type Member } from './context.ts';
import { anonClient, elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const POLICY = 'muestra-2026-10-07';
const run = testRunId();
const nick = (s: string) => `${s} ${run}`;

let admin: Member;
let adminProfile: ProfileResult;
/** ¿El Carnet 000 lo tenía ya otra cuenta (el Admin de verdad)? */
let zeroTaken = false;

/** Una llamada de Auth sin error. */
async function authOk(call: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await call;
  expect(error).toBeNull();
}

async function join(m: Member, name: string): Promise<ProfileResult> {
  return (await ok(
    m.client.rpc('save_profile', { p_nickname: nick(name), p_privacy_version: POLICY }),
  )) as unknown as ProfileResult;
}

beforeAll(async () => {
  admin = await ctx.member('admin-carnet0');
  adminProfile = await join(admin, 'Admin Cero');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
  const holder = await ok(
    ctx.service.from('carnets').select('user_id').eq('member_number', 0).maybeSingle(),
  );
  zeroTaken = !!holder;
});

afterAll(async () => {
  await ctx.cleanup();
});

describe('el Carnet 000', () => {
  it('el contador nunca da el 0 y el Admin no lo pone a mano', async () => {
    const m = await ctx.member('cero-socio');
    const p = await join(m, 'Cero Socio');
    expect(p.member_number).toBeGreaterThan(0);
    await elevateToAal2(admin.client);
    await expectRejected(
      admin.client.rpc('admin_set_member_number', { p_user: m.id, p_number: 0 }),
      'invalid_number',
    );
  });

  it('sólo service_role lo da, y sólo a una cuenta admin u owner', async () => {
    const m = await ctx.member('cero-no-admin');
    await join(m, 'Cero No Admin');
    await expectRejected(ctx.service.rpc('assign_admin_carnet', { p_user: m.id }), 'not_admin');
    await expectDenied(m.client.rpc('assign_admin_carnet', { p_user: m.id }));
    await expectDenied(ctx.anon.rpc('assign_admin_carnet', { p_user: m.id }));
    // Ni service_role escribiendo la fila a mano se lo da a un socio.
    const direct = await ctx.service.from('carnets').update({ member_number: 0 }).eq('user_id', m.id);
    expect(direct.error?.message).toBe('carnet_zero_reserved');
  });

  it('a la cuenta del Admin, sí (o, si ya es de otra, no se quita)', async () => {
    if (zeroTaken) {
      await expectRejected(
        ctx.service.rpc('assign_admin_carnet', { p_user: admin.id }),
        'number_taken',
      );
      return;
    }
    const res = (await ok(
      ctx.service.rpc('assign_admin_carnet', { p_user: admin.id }),
    )) as unknown as ProfileResult;
    expect(res.member_number).toBe(0);
    const audit = await ok(
      ctx.service
        .from('audit_log')
        .select('old_value, new_value')
        .eq('entity_id', admin.id)
        .eq('action', 'assign_admin_carnet'),
    );
    expect(audit).toEqual([
      {
        old_value: { member_number: adminProfile.member_number },
        new_value: { member_number: 0 },
      },
    ]);
  });

  it('con el 000 se pide el email y se entra con la contraseña; otro número no da nada', async () => {
    expect(await ok(ctx.anon.rpc('admin_sign_in_email', { p_number: adminProfile.member_number })))
      .toBeNull();
    if (zeroTaken) return;
    const email = await ok(ctx.anon.rpc('admin_sign_in_email', { p_number: 0 }));
    expect(email).toBe(admin.email);
    const password = randomBytes(18).toString('base64url');
    await authOk(ctx.service.auth.admin.updateUserById(admin.id, { password }));
    const fresh = anonClient(ctx.env);
    const wrong = await fresh.auth.signInWithPassword({ email: admin.email, password: 'otra-cosa' });
    expect(wrong.error).toBeTruthy();
    const good = await fresh.auth.signInWithPassword({ email: admin.email, password });
    expect(good.error).toBeNull();
    // Con la contraseña sola (aal1) no hay permisos del Admin.
    await expectRejected(fresh.rpc('admin_backup_codes_left'), 'forbidden');
    await fresh.auth.signOut({ scope: 'local' });
  });
});

describe('códigos de respaldo', () => {
  it('se generan 10 con aal2, sólo para el equipo, y nunca en claro en la auditoría', async () => {
    await elevateToAal2(admin.client);
    const res = (await ok(
      admin.client.rpc('admin_generate_backup_codes'),
    )) as unknown as BackupCodesResult;
    expect(res.codes).toHaveLength(10);
    for (const c of res.codes) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    expect(new Set(res.codes).size).toBe(10);
    expect(await ok(admin.client.rpc('admin_backup_codes_left'))).toBe(10);
    const audit = await ok(
      admin.client.from('audit_log').select('new_value').eq('entity_id', admin.id),
    );
    for (const c of res.codes) expect(JSON.stringify(audit)).not.toContain(c);
    const m = await ctx.member('respaldo-socio');
    await expectRejected(m.client.rpc('admin_generate_backup_codes'), 'forbidden');
    await expectRejected(m.client.rpc('admin_use_backup_code', { p_code: res.codes[0]! }), 'forbidden');
  });

  it('cada código vale una vez, quita el TOTP y deja dar de alta otro', async () => {
    await elevateToAal2(admin.client);
    const { codes } = (await ok(
      admin.client.rpc('admin_generate_backup_codes'),
    )) as unknown as BackupCodesResult;
    const code = codes[3]!;
    // El código de otra cuenta no le vale a nadie más.
    const other = await ctx.member('respaldo-otro');
    await expectRejected(other.client.rpc('admin_use_backup_code', { p_code: code }), 'forbidden');
    // Una sesión nueva con la contraseña sola, aal1 (ha perdido el móvil).
    const fresh = anonClient(ctx.env);
    const password = randomBytes(18).toString('base64url');
    await authOk(ctx.service.auth.admin.updateUserById(admin.id, { password }));
    await authOk(fresh.auth.signInWithPassword({ email: admin.email, password }));
    await expectRejected(fresh.rpc('admin_use_backup_code', { p_code: 'AAAAA-AAAAA' }), 'backup_code_invalid');
    const used = (await ok(
      fresh.rpc('admin_use_backup_code', { p_code: code.toLowerCase().replace('-', ' ') }),
    )) as unknown as BackupCodeUse;
    expect(used.left).toBe(9);
    await expectRejected(fresh.rpc('admin_use_backup_code', { p_code: code }), 'backup_code_invalid');
    const factors = await fresh.auth.mfa.listFactors();
    expect(factors.data?.totp.filter((f) => f.status === 'verified')).toEqual([]);
    // Alta nueva con aal1: vuelve a tener segundo factor.
    await elevateToAal2(fresh);
    expect(await ok(fresh.rpc('admin_backup_codes_left'))).toBe(9);
    await fresh.auth.signOut({ scope: 'local' });
  });
});

describe('descargar mis datos', () => {
  it('lleva lo de quien llama y nada de nadie más', async () => {
    const a = await ctx.member('exporta-a');
    const b = await ctx.member('exporta-b');
    await join(a, 'Exporta A');
    await join(b, 'Exporta B');
    await ok(a.client.rpc('place_bottle', { p_message: `mensaje a ${run}`, p_x: 1, p_y: 1 }));
    await ok(b.client.rpc('place_bottle', { p_message: `mensaje b ${run}`, p_x: 2, p_y: 2 }));
    const data = (await ok(a.client.rpc('export_my_data'))) as Record<string, unknown>;
    expect(data.format).toBe('boia-planet-account-export');
    expect(data.account).toMatchObject({ id: a.id, email: a.email });
    expect(data.carnet).toMatchObject({ user_id: a.id, nickname: nick('Exporta A') });
    const text = JSON.stringify(data);
    expect(text).toContain(`mensaje a ${run}`);
    expect(text).not.toContain(`mensaje b ${run}`);
    expect(text).not.toContain(b.id);
    expect(text).not.toContain(b.email);
    expect(text).not.toMatch(/encrypted_password|code_hash|"salt"|secret/);
    await expectDenied(ctx.anon.rpc('export_my_data'));
  });
});
