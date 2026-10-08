/**
 * Los clips de la Galería (plan 019 T216, decisión 8) contra el proyecto de
 * desarrollo: el bucket `event-clips` y las columnas `kind` y `poster_url`
 * de `event_photos` (migración 20261008100400). Lectura pública; escritura
 * sólo del equipo (admin con segundo factor).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { context, ok, type Member } from './context.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const run = testRunId();
const CLIPS = 'event-clips';
const PHOTOS = 'event-photos';
const objects: { bucket: string; path: string }[] = [];
const eventId = `e2e-t216-${run}`;
const albumId = `album-${eventId}`;

// La cabecera de un mp4 (el bucket mira el tipo declarado, no decodifica).
const MP4 = Buffer.from(
  '\u0000\u0000\u0000\u0018ftypisom\u0000\u0000\u0002\u0000isomiso2',
  'latin1',
);
const WEBP = Buffer.from('RIFF\u0016\u0000\u0000\u0000WEBPVP8X', 'latin1');

let admin: Member;
let visitor: Member;

beforeAll(async () => {
  admin = await ctx.member('clips-admin');
  visitor = await ctx.member('clips-visita');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
  await elevateToAal2(admin.client);
});

afterAll(async () => {
  for (const bucket of [CLIPS, PHOTOS]) {
    const paths = objects.filter((o) => o.bucket === bucket).map((o) => o.path);
    if (paths.length) await ctx.service.storage.from(bucket).remove(paths);
  }
  await ctx.service.from('event_albums').delete().eq('id', albumId);
  await ctx.cleanup();
});

const publicUrl = (bucket: string, path: string) =>
  admin.client.storage.from(bucket).getPublicUrl(path).data.publicUrl;

describe('el bucket event-clips', () => {
  it('sólo el equipo sube, sólo mp4, y la lectura es pública', async () => {
    const path = `${eventId}/${run}.mp4`;
    const denied = await visitor.client.storage
      .from(CLIPS)
      .upload(path, MP4, { contentType: 'video/mp4' });
    expect(denied.error).not.toBeNull();
    const up = await admin.client.storage
      .from(CLIPS)
      .upload(path, MP4, { contentType: 'video/mp4' });
    expect(up.error).toBeNull();
    objects.push({ bucket: CLIPS, path });
    const webp = await admin.client.storage
      .from(CLIPS)
      .upload(`${eventId}/${run}.webp`, WEBP, { contentType: 'image/webp' });
    expect(webp.error).not.toBeNull();
    expect((await fetch(publicUrl(CLIPS, path))).status).toBe(200);

    const poster = `${eventId}/${run}-poster.webp`;
    await ok(admin.client.storage.from(PHOTOS).upload(poster, WEBP, { contentType: 'image/webp' }));
    objects.push({ bucket: PHOTOS, path: poster });
  });
});

describe('un clip en event_photos', () => {
  const clip = () => ({
    album_id: albumId,
    alt: 'Un clip',
    kind: 'video',
    url: publicUrl(CLIPS, `${eventId}/${run}.mp4`),
    poster_url: publicUrl(PHOTOS, `${eventId}/${run}-poster.webp`),
    width: 1920,
    height: 1080,
  });

  it('el equipo apunta un clip con póster; lo lee cualquiera', async () => {
    await ok(
      admin.client.from('event_albums').insert({
        id: albumId,
        event_id: eventId,
        island_id: 'halloween',
        title: `Prueba ${run}`,
      }),
    );
    await ok(admin.client.from('event_photos').insert({ ...clip(), id: `clip-${run}` }));
    const rows = await ok(
      ctx.anon.from('event_photos').select('id, kind, poster_url').eq('album_id', albumId),
    );
    expect(rows).toEqual([{ id: `clip-${run}`, kind: 'video', poster_url: clip().poster_url }]);
  });

  it('un clip sin póster, fuera de su bucket o de otro tipo no vale; una foto sigue igual', async () => {
    const bad = async (row: Record<string, unknown>, id: string) => {
      const r = await admin.client.from('event_photos').insert({ ...clip(), ...row, id } as never);
      expect(r.error?.code, id).toBe('23514');
    };
    await bad({ poster_url: null }, `sin-poster-${run}`);
    await bad({ url: publicUrl(PHOTOS, `${eventId}/${run}-poster.webp`) }, `bucket-${run}`);
    await bad({ kind: 'audio' }, `tipo-${run}`);
    await bad({ width: 5000 }, `grande-${run}`);
    // Una foto (sin kind) con póster tampoco.
    await bad({ kind: 'image', url: clip().poster_url }, `foto-poster-${run}`);
    await ok(
      admin.client.from('event_photos').insert({
        id: `foto-${run}`,
        album_id: albumId,
        alt: 'Una foto',
        url: clip().poster_url,
        width: 1600,
        height: 900,
      }),
    );
  });

  it('quien no es del equipo no apunta clips', async () => {
    const r = await visitor.client.from('event_photos').insert({ ...clip(), id: `visita-${run}` });
    expect(r.error).not.toBeNull();
  });
});
