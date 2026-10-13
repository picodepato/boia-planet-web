/**
 * Las funciones que tenían SECURITY DEFINER en `public` (plan 029 T278,
 * migración 20261013100200_security_definer_lockdown) contra el proyecto de
 * desarrollo:
 *
 * - `admin_sign_in_email` ya no existe: nadie averigua el email del Admin
 *   escribiendo «000»;
 * - `discount_code_for`: anon no la ejecuta; una cuenta que no encontró el
 *   descuento recibe null; la que lo encontró, el código común;
 * - `radio_set_first` y `radio_reorder`: anon no; un socio sin rol, no; un
 *   admin sin segundo factor (aal1), tampoco; con aal2, sí;
 * - el esquema `private` no se alcanza por la Data API (las funciones de
 *   allí confían en eso: reciben la cuenta de su envoltura de `public`).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { context, expectDenied, expectRejected, ok, type Member } from './context.ts';
import { elevateToAal2 } from './testkit.ts';

const ctx = context();
const TICKET_DISCOUNT = 'dto-naufrago';

let admin: Member;
let fan: Member;
let finder: Member;
let commonBefore: string | null = null;

beforeAll(async () => {
  admin = await ctx.member('t278-admin');
  fan = await ctx.member('t278-socio');
  finder = await ctx.member('t278-encuentra');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
  const row = await ok(
    ctx.service.from('ticketing_settings').select('common_discount_code').single(),
  );
  commonBefore = row.common_discount_code;
});

afterAll(async () => {
  await ctx.service
    .from('ticketing_settings')
    .update({ common_discount_code: commonBefore })
    .eq('id', true);
  await ctx.cleanup();
});

describe('el email del Carnet 000 ya no sale', () => {
  it('admin_sign_in_email no existe, ni para anon ni para un socio', async () => {
    for (const client of [ctx.anon, fan.client]) {
      // Ya no está en los tipos: se llama por su nombre, como lo haría cualquiera.
      const call = client.rpc('admin_sign_in_email' as never, { p_number: 0 } as never);
      const { data, error } = await call;
      expect(data).toBeNull();
      expect(error?.code).toBe('PGRST202');
    }
  });
});

describe('discount_code_for', () => {
  beforeAll(async () => {
    await elevateToAal2(admin.client);
    await ok(admin.client.rpc('admin_set_common_discount_code', { p_code: 'T278CODIGO' }));
  });

  it('anon no la ejecuta', async () => {
    await expectDenied(ctx.anon.rpc('discount_code_for', { p_discount: TICKET_DISCOUNT }));
  });

  it('quien no encontró el descuento no recibe el código; quien lo encontró, sí', async () => {
    const before = await fan.client.rpc('discount_code_for', { p_discount: TICKET_DISCOUNT });
    expect(before.error).toBeNull();
    expect(before.data).toBeNull();
    await ok(finder.client.rpc('find_discount', { p_discount: TICKET_DISCOUNT }));
    expect(await ok(finder.client.rpc('discount_code_for', { p_discount: TICKET_DISCOUNT }))).toBe(
      'T278CODIGO',
    );
    // Lo que encontró otra cuenta no le vale a ésta.
    const other = await fan.client.rpc('discount_code_for', { p_discount: TICKET_DISCOUNT });
    expect(other.error).toBeNull();
    expect(other.data).toBeNull();
  });
});

describe('radio_set_first y radio_reorder', () => {
  /** La lista de la radio tal cual está (para reordenarla sin cambiarla). */
  async function currentOrder(): Promise<{ ids: string[]; first: string | null }> {
    const rows = await ok(
      ctx.service.from('radio_songs').select('id, is_first').order('position').order('id'),
    );
    return { ids: rows.map((r) => r.id), first: rows.find((r) => r.is_first)?.id ?? null };
  }

  it('anon no las ejecuta', async () => {
    const { ids, first } = await currentOrder();
    await expectDenied(ctx.anon.rpc('radio_set_first', { p_song: first ?? 'ninguna' }));
    await expectDenied(ctx.anon.rpc('radio_reorder', { p_ids: ids }));
  });

  it('un socio sin rol, no', async () => {
    const { ids, first } = await currentOrder();
    await expectRejected(
      fan.client.rpc('radio_set_first', { p_song: first ?? 'ninguna' }),
      'forbidden',
    );
    await expectRejected(fan.client.rpc('radio_reorder', { p_ids: ids }), 'forbidden');
  });

  it('un admin sin segundo factor (aal1), no; con aal2, sí', async () => {
    const { ids, first } = await currentOrder();
    const aal1 = await ctx.member('t278-admin-aal1');
    await ok(ctx.service.from('staff_roles').insert({ user_id: aal1.id, role: 'admin' }));
    await expectRejected(aal1.client.rpc('radio_reorder', { p_ids: ids }), 'forbidden');
    await ctx.service.from('staff_roles').delete().eq('user_id', aal1.id);

    await elevateToAal2(admin.client);
    // Mismo orden y misma primera: la radio queda como estaba.
    await ok(admin.client.rpc('radio_reorder', { p_ids: ids }));
    if (first) {
      await ok(admin.client.rpc('radio_set_first', { p_song: first }));
    } else {
      await expectRejected(
        admin.client.rpc('radio_set_first', { p_song: 'ninguna' }),
        'unknown_song',
      );
    }
    expect(await currentOrder()).toEqual({ ids, first });
    // Una lista que no es la de la radio se rechaza (después de mirar el rol).
    await expectRejected(
      admin.client.rpc('radio_reorder', { p_ids: [...ids, 'no-existe'] }),
      'invalid_order',
    );
  });
});

describe('el esquema private no está en la Data API', () => {
  it('ni anon ni un socio llaman a una función de private', async () => {
    const session = (await fan.client.auth.getSession()).data.session;
    expect(session).toBeTruthy();
    const auth: Array<Record<string, string>> = [
      {},
      { Authorization: `Bearer ${session!.access_token}` },
    ];
    for (const extra of auth) {
      const res = await fetch(`${ctx.env.url}/rest/v1/rpc/export_my_data`, {
        method: 'POST',
        headers: {
          apikey: ctx.env.anonKey,
          'Content-Type': 'application/json',
          'Content-Profile': 'private',
          ...extra,
        },
        body: JSON.stringify({ p_user: admin.id }),
      });
      expect(res.ok).toBe(false);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe('PGRST106');
    }
  });
});
