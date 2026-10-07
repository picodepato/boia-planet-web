/**
 * Las fotos de las islas (plan 017 T189, decisión 4) contra el proyecto de
 * desarrollo: el bucket `event-photos` y las tablas `event_albums` y
 * `event_photos`. Lectura pública (sin sesión); escritura sólo del equipo
 * (admin con segundo factor), con su fila en la auditoría.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { context, expectDenied, ok, type Member } from './context.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const run = testRunId();
const BUCKET = 'event-photos';
const objects: string[] = [];
const eventId = `e2e-t189-${run}`;
const albumId = `album-${eventId}`;

// Un PNG de 1 × 1 (la web sube WebP; el bucket no acepta PNG).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
// La cabecera de un WebP (el bucket mira el tipo declarado, no decodifica).
const WEBP = Buffer.from('RIFF\u0016\u0000\u0000\u0000WEBPVP8X', 'latin1');

let admin: Member;
let visitor: Member;

beforeAll(async () => {
  admin = await ctx.member('fotos-admin');
  visitor = await ctx.member('fotos-visita');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
  await elevateToAal2(admin.client);
});

afterAll(async () => {
  if (objects.length) await ctx.service.storage.from(BUCKET).remove(objects);
  await ctx.service.from('event_albums').delete().eq('id', albumId);
  await ctx.cleanup();
});

describe('el bucket event-photos', () => {
  it('sólo el equipo sube, sólo WebP o JPEG, y la lectura es pública', async () => {
    const path = `${eventId}/${run}.webp`;
    const denied = await visitor.client.storage
      .from(BUCKET)
      .upload(path, WEBP, { contentType: 'image/webp' });
    expect(denied.error).not.toBeNull();
    const up = await admin.client.storage
      .from(BUCKET)
      .upload(path, WEBP, { contentType: 'image/webp' });
    expect(up.error).toBeNull();
    objects.push(path);
    const png = await admin.client.storage
      .from(BUCKET)
      .upload(`${eventId}/${run}.png`, PNG, { contentType: 'image/png' });
    expect(png.error).not.toBeNull();
    const url = admin.client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    expect((await fetch(url)).status).toBe(200);
  });
});

describe('las tablas del álbum y sus fotos', () => {
  const url = () =>
    admin.client.storage.from(BUCKET).getPublicUrl(`${eventId}/${run}.webp`).data.publicUrl;

  it('nadie fuera del equipo escribe; el equipo crea el álbum y sus fotos', async () => {
    const album = {
      id: albumId,
      event_id: eventId,
      island_id: 'halloween',
      title: `Prueba ${run}`,
      event_finished: true,
    };
    await expectDenied(visitor.client.from('event_albums').insert(album));
    await expectDenied(ctx.anon.from('event_albums').insert(album));
    await ok(admin.client.from('event_albums').insert(album));

    const photo = {
      id: `foto-${eventId}`,
      album_id: albumId,
      url: url(),
      alt: 'Una foto',
      width: 1600,
      height: 1200,
    };
    await expectDenied(visitor.client.from('event_photos').insert(photo));
    await ok(admin.client.from('event_photos').insert(photo));
  });

  it('una foto tiene que ser del bucket, con texto alternativo y del tamaño de la copia', async () => {
    const base = { album_id: albumId, alt: 'x', width: 10, height: 10 };
    const outside = await admin.client
      .from('event_photos')
      .insert({ ...base, id: `fuera-${run}`, url: 'https://ejemplo.com/foto.webp' });
    expect(outside.error?.code).toBe('23514');
    const noAlt = await admin.client
      .from('event_photos')
      .insert({ ...base, id: `sin-alt-${run}`, url: url(), alt: '  ' });
    expect(noAlt.error?.code).toBe('23514');
    const huge = await admin.client
      .from('event_photos')
      .insert({ ...base, id: `grande-${run}`, url: url(), width: 4000 });
    expect(huge.error?.code).toBe('23514');
    const twin = await admin.client
      .from('event_albums')
      .insert({ id: `${albumId}-2`, event_id: eventId, island_id: 'halloween', title: 'Otro' });
    expect(twin.error?.code).toBe('23505');
  });

  it('se leen sin sesión y cada cambio queda en la auditoría', async () => {
    const albums = await ok(
      ctx.anon.from('event_albums').select('id, event_finished').eq('id', albumId),
    );
    expect(albums).toEqual([{ id: albumId, event_finished: true }]);
    const photos = await ok(ctx.anon.from('event_photos').select('id').eq('album_id', albumId));
    expect(photos.map((p) => p.id)).toEqual([`foto-${eventId}`]);
    const audit = await ok(
      ctx.service
        .from('audit_log')
        .select('entity_type, action, actor_id')
        .in('entity_id', [albumId, `foto-${eventId}`]),
    );
    expect(audit).toEqual(
      expect.arrayContaining([
        { entity_type: 'event_albums', action: 'insert', actor_id: admin.id },
        { entity_type: 'event_photos', action: 'insert', actor_id: admin.id },
      ]),
    );
  });

  it('el equipo borra; quien no es del equipo no borra nada', async () => {
    await ok(visitor.client.from('event_photos').delete().eq('album_id', albumId));
    expect(
      await ok(ctx.anon.from('event_photos').select('id').eq('album_id', albumId)),
    ).toHaveLength(1);
    await ok(admin.client.from('event_albums').delete().eq('id', albumId));
    expect(await ok(ctx.anon.from('event_photos').select('id').eq('album_id', albumId))).toEqual(
      [],
    );
  });
});
