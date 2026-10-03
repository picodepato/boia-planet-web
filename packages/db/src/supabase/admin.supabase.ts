/**
 * El Admin sobre datos reales (plan 008, T94, decisión 11) contra el
 * proyecto de desarrollo: el rol de quien entra (sólo con aal2), la imagen
 * del sello en Storage y en el evento, retirar una botella reportada,
 * descartar un reporte, anular un tiempo y una entrada de puntos. Todo pide
 * rol con segundo factor y deja su fila en la auditoría.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RemoveBottleResult, VoidPointsResult } from '../rpc.ts';
import {
  context,
  dropEvents,
  expectDenied,
  expectRejected,
  ok,
  testEvent,
  type Member,
} from './context.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const run = testRunId();
const POLICY = 'muestra-2026-10-03';
const BUCKET = 'stamp-images';
const events: string[] = [];
const objects: string[] = [];

// Un PNG de 1 × 1 (la web sube WebP de 512; aquí sólo cuenta el permiso).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

let admin: Member;
let author: Member;
let reporter: Member;
let racer: Member;
let event: { id: string; slug: string; code: string };

async function carnet(m: Member, name: string): Promise<void> {
  await ok(
    m.client.rpc('save_profile', { p_nickname: `${name} ${run}`, p_privacy_version: POLICY }),
  );
}

beforeAll(async () => {
  admin = await ctx.member('admin-real');
  author = await ctx.member('admin-autora');
  reporter = await ctx.member('admin-reporta');
  racer = await ctx.member('admin-corre');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
  await carnet(author, 'Autora');
  await carnet(reporter, 'Reporta');
  await carnet(racer, 'Corre');
  const now = Date.now();
  event = await testEvent(ctx, `t94-${run}`, {
    from: new Date(now - 3600_000),
    until: new Date(now + 3600_000),
  });
  events.push(event.id);
});

afterAll(async () => {
  if (objects.length) await ctx.service.storage.from(BUCKET).remove(objects);
  await ctx.cleanup();
  await dropEvents(ctx, events);
});

describe('entrar al Admin: el rol sólo con segundo factor', () => {
  it('con aal1 el rol no cuenta, pero la fila propia se lee para saber si pedir TOTP', async () => {
    expect(await ok(admin.client.rpc('my_staff_role'))).toBeNull();
    // La pantalla de acceso lee su propia fila: con ella pide el TOTP; sin ella, «sin acceso».
    expect(
      await ok(admin.client.from('staff_roles').select('role').eq('user_id', admin.id)),
    ).toEqual([{ role: 'admin' }]);
    expect(await ok(author.client.from('staff_roles').select('role'))).toEqual([]);
    expect(await ok(author.client.rpc('my_staff_role'))).toBeNull();
    await expectDenied(ctx.anon.rpc('my_staff_role'));
  });

  it('con TOTP (aal2) devuelve el rol', async () => {
    await elevateToAal2(admin.client);
    expect(await ok(admin.client.rpc('my_staff_role'))).toBe('admin');
  });
});

describe('Fiestas y QR: la imagen del sello', () => {
  it('sólo el equipo sube al bucket; la lectura es pública', async () => {
    const path = `${event.slug}/${run}.png`;
    const denied = await author.client.storage
      .from(BUCKET)
      .upload(path, PNG, { contentType: 'image/png' });
    expect(denied.error).not.toBeNull();
    const up = await admin.client.storage
      .from(BUCKET)
      .upload(path, PNG, { contentType: 'image/png' });
    expect(up.error).toBeNull();
    objects.push(path);
    const wrongType = await admin.client.storage
      .from(BUCKET)
      .upload(`${event.slug}/${run}.svg`, Buffer.from('<svg/>'), { contentType: 'image/svg+xml' });
    expect(wrongType.error).not.toBeNull();
    const url = admin.client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const res = await fetch(url);
    expect(res.status).toBe(200);
  });

  it('admin_set_stamp_image guarda la copia propia; una URL de fuera se rechaza', async () => {
    const path = `${event.slug}/${run}.png`;
    const url = admin.client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    await expectRejected(
      author.client.rpc('admin_set_stamp_image', { p_event: event.slug, p_url: url }),
      'forbidden',
    );
    await expectRejected(
      admin.client.rpc('admin_set_stamp_image', {
        p_event: event.slug,
        p_url: 'https://ejemplo.com/sello.png',
      }),
      'invalid_image',
    );
    await expectRejected(
      admin.client.rpc('admin_set_stamp_image', { p_event: 'no-existe', p_url: url }),
      'unknown_event',
    );
    await ok(admin.client.rpc('admin_set_stamp_image', { p_event: event.slug, p_url: url }));
    const pub = await ok(
      ctx.anon.from('events').select('stamp_image_url').eq('slug', event.slug).single(),
    );
    expect(pub.stamp_image_url).toBe(url);
    // Nadie la escribe a mano.
    await expectDenied(
      admin.client.from('events').update({ stamp_image_url: null }).eq('slug', event.slug),
    );
    await ok(admin.client.rpc('admin_set_stamp_image', { p_event: event.slug }));
    const cleared = await ok(
      ctx.anon.from('events').select('stamp_image_url').eq('slug', event.slug).single(),
    );
    expect(cleared.stamp_image_url).toBeNull();
  });
});

describe('Moderación de botellas', () => {
  it('retira una botella reportada: sale del mar, el reporte se resuelve y queda auditado', async () => {
    const b = (await ok(
      author.client.rpc('place_bottle', { p_message: `Reportada ${run}`, p_x: 3, p_y: 4 }),
    )) as { id: string };
    await ok(
      reporter.client
        .from('bottle_reports')
        .insert({ bottle_id: b.id, reporter_id: reporter.id, reason: 'spam' }),
    );
    const open = await ok(
      admin.client
        .from('bottle_reports')
        .select('id, bottle_id')
        .is('resolved_at', null)
        .eq('bottle_id', b.id),
    );
    expect(open.length).toBe(1);
    await expectRejected(
      author.client.rpc('admin_remove_bottle', { p_bottle: b.id, p_reason: 'spam' }),
      'forbidden',
    );
    await expectRejected(
      admin.client.rpc('admin_remove_bottle', { p_bottle: b.id, p_reason: '' }),
      'reason_required',
    );
    const res = (await ok(
      admin.client.rpc('admin_remove_bottle', { p_bottle: b.id, p_reason: 'spam de prueba' }),
    )) as unknown as RemoveBottleResult;
    expect(res).toMatchObject({ status: 'removed', resolved_reports: 1 });
    const sea = await ok(ctx.anon.rpc('latest_bottles', { p_limit: 10 }));
    expect(sea.some((x) => x.id === b.id)).toBe(false);
    const audit = await ok(
      admin.client
        .from('audit_log')
        .select('reason')
        .eq('entity_type', 'bottles')
        .eq('entity_id', b.id),
    );
    expect(audit.map((a) => a.reason)).toContain('spam de prueba');
  });

  it('descarta un reporte y la botella sigue en el mar', async () => {
    const b = (await ok(
      author.client.rpc('place_bottle', { p_message: `Inocente ${run}`, p_x: 5, p_y: 6 }),
    )) as { id: string };
    const r = await ok(
      reporter.client
        .from('bottle_reports')
        .insert({ bottle_id: b.id, reporter_id: reporter.id, reason: 'no me gusta' })
        .select('id')
        .single(),
    );
    await ok(admin.client.rpc('admin_dismiss_bottle_report', { p_report: r.id, p_reason: 'nada' }));
    const after = await ok(
      admin.client.from('bottle_reports').select('resolved_at, resolution').eq('id', r.id).single(),
    );
    expect(after.resolved_at).not.toBeNull();
    const row = await ok(ctx.service.from('bottles').select('status').eq('id', b.id).single());
    expect(row.status).toBe('active');
  });
});

describe('Rankings: anular un tiempo o puntos', () => {
  it('un tiempo anulado sale del ranking del circuito', async () => {
    await ok(
      racer.client.rpc('submit_race_time', { p_circuit: 'el-freu', p_version: 3, p_ms: 61_234 }),
    );
    const inRanking = async () => {
      const page = (await ok(
        ctx.anon.rpc('ranking_race', { p_circuit: 'el-freu', p_version: 3, p_limit: 100 }),
      )) as unknown as { total: number; rows: { user_id: string }[] };
      let offset = 0;
      let rows = page.rows;
      while (!rows.some((r) => r.user_id === racer.id) && offset + 100 < page.total) {
        offset += 100;
        rows = (
          (await ok(
            ctx.anon.rpc('ranking_race', {
              p_circuit: 'el-freu',
              p_version: 3,
              p_limit: 100,
              p_offset: offset,
            }),
          )) as unknown as { rows: { user_id: string }[] }
        ).rows;
      }
      return rows.some((r) => r.user_id === racer.id);
    };
    expect(await inRanking()).toBe(true);
    await expectRejected(
      admin.client.rpc('admin_void_race_time', {
        p_user: racer.id,
        p_circuit: 'el-freu',
        p_version: 3,
        p_reason: 'x',
      }),
      'reason_required',
    );
    await ok(
      admin.client.rpc('admin_void_race_time', {
        p_user: racer.id,
        p_circuit: 'el-freu',
        p_version: 3,
        p_reason: 'tiempo imposible',
      }),
    );
    expect(await inRanking()).toBe(false);
    await expectRejected(
      admin.client.rpc('admin_void_race_time', {
        p_user: author.id,
        p_circuit: 'el-freu',
        p_version: 3,
        p_reason: 'no tiene',
      }),
      'unknown_time',
    );
  });

  it('anular una entrada de puntos la compensa una vez, con auditoría', async () => {
    const award = (await ok(
      racer.client.rpc('award_points', {
        p_action: 'world',
        p_ref: `lugar:t94-${run}:points`,
        p_points: 20,
      }),
    )) as unknown as { tx_id: string };
    const before = await ok(
      ctx.service.from('point_balances').select('points').eq('user_id', racer.id).single(),
    );
    const v = (await ok(
      admin.client.rpc('admin_void_points', { p_tx: award.tx_id, p_reason: 'puntos imposibles' }),
    )) as unknown as VoidPointsResult;
    expect(v.voided).toBe(true);
    const after = await ok(
      ctx.service.from('point_balances').select('points').eq('user_id', racer.id).single(),
    );
    expect(after.points).toBe(before.points - 20);
    const again = (await ok(
      admin.client.rpc('admin_void_points', { p_tx: award.tx_id, p_reason: 'otra vez' }),
    )) as unknown as VoidPointsResult;
    expect(again.voided).toBe(false);
    await expectRejected(
      author.client.rpc('admin_void_points', { p_tx: award.tx_id, p_reason: 'yo' }),
      'forbidden',
    );
    const audit = await ok(
      admin.client
        .from('audit_log')
        .select('action')
        .eq('entity_id', award.tx_id)
        .eq('action', 'void_points'),
    );
    expect(audit.length).toBe(1);
  });
});
