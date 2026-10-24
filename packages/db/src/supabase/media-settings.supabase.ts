/**
 * Los ajustes de cada pieza de la Galería (plan 048 T329, migración
 * 20261024100100_media_settings) contra el proyecto de desarrollo:
 *
 * - anon, un socio sin rol, un editor y un admin sin segundo factor no
 *   cambian nada (ni con las RPC ni escribiendo la tabla a mano);
 * - el admin con segundo factor pone una pieza en portada, ordena, oculta
 *   una pieza del código y borra una subida (su fila de `event_photos` y,
 *   con su sesión, el archivo del bucket); cada cambio deja su auditoría;
 * - la lectura pública da id, portada, orden y oculta; quién y cuándo, no.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { context, expectDenied, expectRejected, ok, type Member } from './context.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const run = testRunId();
const PHOTOS = 'event-photos';
const piece = (name: string) => `t329-${run}-${name}`;
const CODE_A = piece('codigo-a');
const CODE_B = piece('codigo-b');
const eventId = `e2e-t329-${run}`;
const albumId = `album-${eventId}`;
const UPLOADED = piece('subida');
const objectPath = `${eventId}/${run}.webp`;
const WEBP = Buffer.from('RIFF\u0016\u0000\u0000\u0000WEBPVP8X', 'latin1');

let admin: Member;
let adminAal1: Member;
let editor: Member;
let fan: Member;

beforeAll(async () => {
  admin = await ctx.member('t329-admin');
  adminAal1 = await ctx.member('t329-admin-aal1');
  editor = await ctx.member('t329-editor');
  fan = await ctx.member('t329-socio');
  await ok(
    ctx.service.from('staff_roles').insert([
      { user_id: admin.id, role: 'admin' },
      { user_id: adminAal1.id, role: 'admin' },
      { user_id: editor.id, role: 'editor' },
    ]),
  );
  await elevateToAal2(admin.client);
  await elevateToAal2(editor.client);
});

afterAll(async () => {
  await ctx.service.storage.from(PHOTOS).remove([objectPath]);
  await ctx.service.from('event_albums').delete().eq('id', albumId);
  await ctx.service.from('media_settings').delete().like('piece_id', `t329-${run}-%`);
  await ctx.cleanup();
});

const publicRows = async () =>
  ok(
    ctx.anon
      .from('media_settings')
      .select('piece_id, on_home, sort, hidden')
      .like('piece_id', `t329-${run}-%`)
      .order('piece_id'),
  );

describe('quien no es admin con segundo factor no cambia los ajustes', () => {
  it('anon no ejecuta las RPC', async () => {
    await expectDenied(ctx.anon.rpc('admin_media_set_home', { p_piece: CODE_A, p_on_home: true }));
    await expectDenied(ctx.anon.rpc('admin_media_order', { p_pieces: [CODE_A, CODE_B] }));
    await expectDenied(ctx.anon.rpc('admin_media_hide', { p_piece: CODE_A }));
    await expectDenied(ctx.anon.rpc('admin_media_delete', { p_piece: UPLOADED }));
  });

  it('un socio, un editor y un admin sin segundo factor: forbidden', async () => {
    for (const m of [fan, editor, adminAal1]) {
      await expectRejected(
        m.client.rpc('admin_media_set_home', { p_piece: CODE_A, p_on_home: true }),
        'forbidden',
      );
      await expectRejected(
        m.client.rpc('admin_media_order', { p_pieces: [CODE_A, CODE_B] }),
        'forbidden',
      );
      await expectRejected(m.client.rpc('admin_media_hide', { p_piece: CODE_A }), 'forbidden');
      await expectRejected(m.client.rpc('admin_media_delete', { p_piece: UPLOADED }), 'forbidden');
    }
    expect(await publicRows()).toEqual([]);
  });

  it('nadie escribe la tabla a mano, ni el admin', async () => {
    for (const client of [ctx.anon, fan.client, admin.client]) {
      await expectDenied(client.from('media_settings').insert({ piece_id: CODE_A, hidden: true }));
      const upd = await client.from('media_settings').update({ hidden: true }).eq('piece_id', CODE_A);
      expect(upd.error?.code ?? 'sin filas').toMatch(/42501|sin filas/);
    }
    expect(await publicRows()).toEqual([]);
  });
});

describe('el admin con segundo factor', () => {
  it('pone y quita una pieza de la portada', async () => {
    await ok(admin.client.rpc('admin_media_set_home', { p_piece: CODE_A, p_on_home: true }));
    await ok(admin.client.rpc('admin_media_set_home', { p_piece: CODE_B, p_on_home: true }));
    await ok(admin.client.rpc('admin_media_set_home', { p_piece: CODE_B, p_on_home: false }));
    expect(await publicRows()).toEqual([
      { piece_id: CODE_A, on_home: true, sort: null, hidden: false },
      { piece_id: CODE_B, on_home: false, sort: null, hidden: false },
    ]);
  });

  it('ordena con la lista entera; una lista con repetidos no vale', async () => {
    await ok(admin.client.rpc('admin_media_order', { p_pieces: [CODE_B, CODE_A] }));
    const rows = await publicRows();
    expect(rows.map((r) => [r.piece_id, r.sort])).toEqual([
      [CODE_A, 1],
      [CODE_B, 0],
    ]);
    await expectRejected(
      admin.client.rpc('admin_media_order', { p_pieces: [CODE_A, CODE_A] }),
      'invalid_entry',
    );
    await expectRejected(admin.client.rpc('admin_media_order', { p_pieces: [] }), 'invalid_entry');
  });

  it('oculta una pieza del código (el archivo sigue en el repo) y la vuelve a enseñar', async () => {
    await ok(admin.client.rpc('admin_media_hide', { p_piece: CODE_B }));
    expect((await publicRows()).find((r) => r.piece_id === CODE_B)?.hidden).toBe(true);
    await ok(admin.client.rpc('admin_media_hide', { p_piece: CODE_B, p_hidden: false }));
    expect((await publicRows()).find((r) => r.piece_id === CODE_B)?.hidden).toBe(false);
    await ok(admin.client.rpc('admin_media_hide', { p_piece: CODE_B }));
  });

  it('cada cambio deja su fila en la auditoría', async () => {
    const audit = await ok(
      ctx.service
        .from('audit_log')
        .select('action, entity_id, actor_id')
        .eq('entity_type', 'media_settings')
        .eq('actor_id', admin.id),
    );
    const actions = audit.map((a) => a.action);
    expect(actions).toContain('media_set_home');
    expect(actions).toContain('media_order');
    expect(actions).toContain('media_hide');
  });

  it('borra una pieza subida: su fila y su archivo del bucket', async () => {
    await ok(
      admin.client.storage.from(PHOTOS).upload(objectPath, WEBP, { contentType: 'image/webp' }),
    );
    const url = admin.client.storage.from(PHOTOS).getPublicUrl(objectPath).data.publicUrl;
    await ok(
      admin.client.from('event_albums').insert({
        id: albumId,
        event_id: eventId,
        island_id: 'halloween',
        title: `Prueba ${run}`,
      }),
    );
    await ok(
      admin.client
        .from('event_photos')
        .insert({ id: UPLOADED, album_id: albumId, url, alt: 'Subida', width: 800, height: 600 }),
    );
    await ok(admin.client.rpc('admin_media_set_home', { p_piece: UPLOADED, p_on_home: true }));

    const res = (await ok(admin.client.rpc('admin_media_delete', { p_piece: UPLOADED }))) as {
      deleted: boolean;
      url: string;
      poster_url: string | null;
    };
    expect(res).toMatchObject({ deleted: true, url, poster_url: null });
    // El Admin quita el archivo con su sesión (como hace la web, `deleteSharedPiece`).
    await ok(admin.client.storage.from(PHOTOS).remove([objectPath]));

    expect(await ok(ctx.anon.from('event_photos').select('id').eq('id', UPLOADED))).toEqual([]);
    expect((await publicRows()).some((r) => r.piece_id === UPLOADED)).toBe(false);
    const listed = await ok(ctx.service.storage.from(PHOTOS).list(eventId));
    expect(listed.map((o) => o.name)).not.toContain(`${run}.webp`);
    const audit = await ok(
      ctx.service
        .from('audit_log')
        .select('action')
        .eq('entity_type', 'media_settings')
        .eq('entity_id', UPLOADED)
        .eq('action', 'media_delete'),
    );
    expect(audit).toHaveLength(1);

    // Otra vez: ya no está.
    expect(await ok(admin.client.rpc('admin_media_delete', { p_piece: UPLOADED }))).toMatchObject({
      deleted: false,
    });
  });
});

describe('lectura pública', () => {
  it('id, portada, orden y oculta; quién y cuándo, no', async () => {
    expect((await publicRows()).length).toBeGreaterThan(0);
    for (const client of [ctx.anon, fan.client]) {
      await expectDenied(client.from('media_settings').select('updated_by'));
      await expectDenied(client.from('media_settings').select('updated_at'));
      await expectDenied(client.from('media_settings').select('*'));
    }
  });
});
