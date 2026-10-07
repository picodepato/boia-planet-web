import {
  type BoiaEvent,
  eventAlbumId,
  eventPhotos,
  isLocalPhotoRef,
  localPhotoKey,
  photoSchema,
} from '@boia/contracts';
import { MemoryStorage, createLocalRepository } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { PNG } from 'pngjs';
import { describe, expect, it, vi } from 'vitest';
import { createAdminActions } from './actions';
import {
  PhotoUploadError,
  type PreparedPhoto,
  photoId,
  preparePhotos,
  saveLocalIslandPhotos,
  saveSharedIslandPhotos,
} from './island-photos';
import {
  EVENT_PHOTO_BUCKET,
  PHOTO_UPLOAD_LIMITS,
  type PhotoCodec,
  eventPhotoPath,
  fitWithin,
  photoAlt,
  photoUploadProblem,
  resizePhoto,
} from './photo-upload';
import { mergeSharedPhotos, sharedPhotosFromRows } from './shared-photos';
import { eventIslands, islandEvent, islandMemoryGalleries } from './world';

/**
 * Las fotos de una isla desde el Admin (plan 017 T189, decisión 4): qué
 * archivos valen, la copia WebP, el álbum ligado al evento, el evento que
 * pasa a recuerdo y la isla que lo enseña con su galería, en modo local y
 * con cuentas (Supabase falso). REQ-AVE-014, REQ-ADM-019, REQ-COM-005,
 * REQ-COM-031.
 */

const NOW = new Date('2026-10-07T10:00:00Z');
const registry = WORLD_REGISTRY;

function png(width: number, height: number): Uint8Array {
  return new Uint8Array(PNG.sync.write(new PNG({ width, height })));
}

/** La cabecera VP8X de un WebP (lo que lee `imageSize`). */
function webp(width: number, height: number): Uint8Array {
  const b = new Uint8Array(30);
  b.set(
    [...'RIFF'].map((c) => c.charCodeAt(0)),
    0,
  );
  b.set(
    [...'WEBP'].map((c) => c.charCodeAt(0)),
    8,
  );
  b.set(
    [...'VP8X'].map((c) => c.charCodeAt(0)),
    12,
  );
  const w = width - 1;
  const h = height - 1;
  b.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff], 24);
  b.set([h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 27);
  return b;
}

const fileOf = (bytes: Uint8Array, name: string) =>
  new File([bytes as unknown as BlobPart], name, { type: 'image/png' });

/** Un códec falso: dice qué se le pidió y devuelve un blob del tipo que «sabe» codificar. */
function fakeCodec(size: { width: number; height: number }, canWebp = true) {
  const calls: { type: string; width: number; height: number; quality: number }[] = [];
  const close = vi.fn();
  const codec: PhotoCodec = {
    decode: async () => ({ ...size, close }),
    encode: async (_d, to, type, quality) => {
      calls.push({ type, ...to, quality });
      if (type === 'image/webp' && !canWebp) return new Blob(['x'], { type: 'image/png' });
      return new Blob(['x'], { type });
    },
  };
  return { codec, calls, close };
}

describe('qué archivos valen (tipo real, tamaño y lado)', () => {
  it('PNG, WebP y JPEG de tamaño suficiente valen', () => {
    expect(photoUploadProblem(png(800, 600))).toBeNull();
    expect(photoUploadProblem(webp(4000, 3000))).toBeNull();
  });

  it('el tipo se lee de los bytes: SVG, GIF o texto no valen aunque se llamen .png', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const gif = new TextEncoder().encode('GIF89a\u0001\u0000\u0001\u0000');
    expect(photoUploadProblem(svg)).toBe('type');
    expect(photoUploadProblem(gif)).toBe('type');
  });

  it('demasiado grande o demasiado pequeña', () => {
    const big = new Uint8Array(PHOTO_UPLOAD_LIMITS.maxBytes + 1);
    big.set(png(800, 600));
    expect(photoUploadProblem(big)).toBe('size');
    const side = PHOTO_UPLOAD_LIMITS.minSide;
    expect(photoUploadProblem(png(side - 1, 900))).toBe('small');
    expect(photoUploadProblem(png(side, side))).toBeNull();
  });
});

describe('la copia: WebP, lado largo como mucho 1600 px, sin recortar ni agrandar', () => {
  it('fitWithin conserva la proporción y nunca agranda', () => {
    const max = PHOTO_UPLOAD_LIMITS.maxSide;
    expect(fitWithin(4000, 3000)).toEqual({ width: max, height: max * 0.75 });
    expect(fitWithin(3000, 4000)).toEqual({ width: max * 0.75, height: max });
    expect(fitWithin(640, 480)).toEqual({ width: 640, height: 480 });
  });

  it('pide WebP del tamaño de fitWithin con la calidad fijada, y suelta lo decodificado', async () => {
    const { codec, calls, close } = fakeCodec({ width: 4000, height: 3000 });
    const out = await resizePhoto(new Blob(['x']), codec);
    expect(out.type).toBe('image/webp');
    expect({ width: out.width, height: out.height }).toEqual(fitWithin(4000, 3000));
    expect(calls).toEqual([
      { type: 'image/webp', ...fitWithin(4000, 3000), quality: PHOTO_UPLOAD_LIMITS.quality },
    ]);
    expect(close).toHaveBeenCalledOnce();
  });

  it('sin WebP en el navegador, JPEG', async () => {
    const { codec, calls } = fakeCodec({ width: 1000, height: 800 }, false);
    const out = await resizePhoto(new Blob(['x']), codec);
    expect(out.type).toBe('image/jpeg');
    expect(calls.map((c) => c.type)).toEqual(['image/webp', 'image/jpeg']);
  });

  it('preparePhotos para en el primer archivo que no vale, con su nombre', async () => {
    const { codec } = fakeCodec({ width: 800, height: 600 });
    const files = [fileOf(png(800, 600), 'buena.png'), fileOf(png(50, 50), 'mini.png')];
    const err = await preparePhotos(files, 'halloween-2026', 'Halloween', codec).catch((e) => e);
    expect(err).toBeInstanceOf(PhotoUploadError);
    expect(err).toMatchObject({ problem: 'small', fileName: 'mini.png' });
  });

  it('preparePhotos numera el texto alternativo y da ids válidos y distintos', async () => {
    const { codec } = fakeCodec({ width: 800, height: 600 });
    const files = [fileOf(png(800, 600), 'a.png'), fileOf(png(800, 600), 'b.png')];
    const out = await preparePhotos(files, 'halloween-2026', ' Halloween ', codec);
    expect(out.map((p) => p.alt)).toEqual([
      photoAlt('Halloween', 0, 2),
      photoAlt('Halloween', 1, 2),
    ]);
    expect(photoAlt('Halloween', 0, 1)).toBe('Halloween');
    expect(new Set(out.map((p) => p.id)).size).toBe(2);
    for (const p of out) {
      expect(p.id).toMatch(/^foto-halloween-2026-[A-Za-z0-9_-]+$/);
      expect(eventPhotoPath('halloween-2026', p.stamp, p.type)).toMatch(
        /^halloween-2026\/[a-z0-9]+\.webp$/,
      );
    }
    expect(photoId('raro/evento', 'x')).toBe('foto-raro-evento-x');
  });
});

/** Una isla de evento del mapa y su evento con entradas de la muestra. */
function setup() {
  const repo = createLocalRepository({
    storage: new MemoryStorage(),
    now: () => NOW,
    watch: false,
  });
  const actions = createAdminActions({ repo, registry, now: () => NOW });
  return { repo, actions };
}

async function islandWithEvent(repo: ReturnType<typeof setup>['repo']) {
  const events = await repo.content.events();
  const islands = new Set(eventIslands(registry.map).map((p) => p.id));
  const event = events.find(
    (e) =>
      e.islandId && islands.has(e.islandId) && islandEvent(e.islandId, events, NOW)?.id === e.id,
  );
  if (!event?.islandId) throw new Error('la muestra no tiene un evento vigente en una isla');
  return { event, islandId: event.islandId };
}

const prepared = (event: BoiaEvent, n: number): PreparedPhoto[] =>
  Array.from({ length: n }, (_, i) => ({
    id: photoId(event.id, `t${i}`),
    stamp: `t${i}`,
    blob: new Blob(['x'], { type: 'image/webp' }),
    type: 'image/webp' as const,
    width: 1600,
    height: 1200,
    alt: photoAlt(`Fotos de ${event.name}`, i, n),
  }));

describe('modo local: el álbum del evento, sus fotos y el evento que pasa a recuerdo', () => {
  it('la referencia local es válida en el esquema de foto', () => {
    const src = 'local-photo:foto-halloween-2026-abc';
    expect(isLocalPhotoRef(src)).toBe(true);
    expect(localPhotoKey(src)).toBe('foto-halloween-2026-abc');
    expect(
      photoSchema.safeParse({ id: 'f', albumId: 'a', alt: 'x', src, width: 1, height: 1 }).success,
    ).toBe(true);
    expect(
      photoSchema.safeParse({
        id: 'f',
        albumId: 'a',
        alt: 'x',
        src: 'local-photo:../x',
        width: 1,
        height: 1,
      }).success,
    ).toBe(false);
  });

  it('subir y marcar pasado: la isla deja de abrir el evento y lo enseña como recuerdo con sus fotos', async () => {
    const { repo, actions } = setup();
    const { event, islandId } = await islandWithEvent(repo);
    const stored = new Map<string, Blob>();
    await saveLocalIslandPhotos(
      actions,
      { islandId, event, photos: prepared(event, 2), markPast: true },
      async (key, blob) => {
        stored.set(key, blob);
        return `local-photo:${key}`;
      },
    );
    expect([...stored.keys()]).toEqual(prepared(event, 2).map((p) => p.id));

    const album = await repo.content.get('albums', eventAlbumId(event.id));
    expect(album).toMatchObject({ eventId: event.id, islandId, title: event.name, sample: false });
    const home = await repo.content.home();
    const photos = eventPhotos(event.id, home.albums ?? [], home.photos);
    expect(photos.map((p) => p.src)).toEqual(prepared(event, 2).map((p) => `local-photo:${p.id}`));
    expect(photos.every((p) => !p.selection)).toBe(true);

    const after = home.events.find((e) => e.id === event.id)!;
    expect(after).toMatchObject({ state: 'finished', stateSource: 'manual', islandId });
    expect(islandEvent(islandId, home.events, NOW)?.id).not.toBe(event.id);
    const memories = islandMemoryGalleries(islandId, home, NOW);
    const memory = memories.find((m) => m.event.id === event.id);
    expect(memory?.photos.map((p) => p.id)).toEqual(photos.map((p) => p.id));
  });

  it('sin marcar pasado, las fotos se añaden y el evento sigue a la venta', async () => {
    const { repo, actions } = setup();
    const { event, islandId } = await islandWithEvent(repo);
    await saveLocalIslandPhotos(
      actions,
      { islandId, event, photos: prepared(event, 1), markPast: false },
      async (key) => `local-photo:${key}`,
    );
    const home = await repo.content.home();
    expect(home.events.find((e) => e.id === event.id)?.state).toBe(event.state);
    expect(eventPhotos(event.id, home.albums ?? [], home.photos)).toHaveLength(1);
    // Una segunda subida va al mismo álbum.
    await saveLocalIslandPhotos(
      actions,
      { islandId, event, photos: prepared(event, 3).slice(1), markPast: true },
      async (key) => `local-photo:${key}`,
    );
    const again = await repo.content.home();
    expect((again.albums ?? []).filter((a) => a.eventId === event.id)).toHaveLength(1);
    expect(eventPhotos(event.id, again.albums ?? [], again.photos)).toHaveLength(3);
  });

  it('rechaza isla que no admite eventos, un borrador y una subida vacía', async () => {
    const { repo, actions } = setup();
    const { event, islandId } = await islandWithEvent(repo);
    const photo = { id: 'foto-x', src: 'local-photo:foto-x', alt: 'x', width: 4, height: 3 };
    await expect(
      actions.addIslandPhotos({
        islandId: 'no-existe',
        eventId: event.id,
        photos: [photo],
        markPast: true,
      }),
    ).rejects.toThrow(/no-existe/);
    const draft = (await repo.content.events()).find((e) => e.state === 'draft')!;
    await expect(
      actions.addIslandPhotos({ islandId, eventId: draft.id, photos: [photo], markPast: true }),
    ).rejects.toThrow(/borrador/);
    await expect(
      actions.addIslandPhotos({ islandId, eventId: event.id, photos: [], markPast: true }),
    ).rejects.toThrow(/al menos una foto/);
    expect(await repo.content.get('albums', eventAlbumId(event.id))).toBeNull();
  });
});

describe('con cuentas: el bucket y las tablas, y la web que las suma', () => {
  /** Un cliente de Supabase falso que apunta lo que se le pide. */
  function fakeSupabase(existing: { id: string }[] = []) {
    const log: { op: string; table?: string; value?: unknown }[] = [];
    const query = (table: string) => ({
      select: () => ({
        eq: async () => ({ data: existing, error: null }),
      }),
      insert: async (value: unknown) => {
        log.push({ op: 'insert', table, value });
        return { data: null, error: null };
      },
      update: (value: unknown) => ({
        eq: async () => {
          log.push({ op: 'update', table, value });
          return { data: null, error: null };
        },
      }),
    });
    const storage = {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          log.push({ op: 'upload', value: `${bucket}/${path}` });
          return { data: { path }, error: null };
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${path}` },
        }),
      }),
    };
    return { sb: { from: query, storage } as never, log };
  }

  const event: BoiaEvent = {
    id: 'halloween-2026',
    slug: 'halloween-2026',
    name: 'BOIA Halloween',
    format: 'satelite',
    startsAt: '2026-10-31T23:00:00+01:00',
    timeZone: 'Europe/Madrid',
    placeLabel: 'Kiki García',
    state: 'on_sale',
    stateSource: 'dates',
    description: '',
    artistIds: [],
    activities: [],
    priceSample: true,
    islandId: 'halloween',
    sample: false,
  };

  it('sube cada copia al bucket, crea el álbum del evento marcado pasado y apunta las fotos', async () => {
    const { sb, log } = fakeSupabase();
    await saveSharedIslandPhotos(sb, {
      islandId: 'halloween',
      event,
      photos: prepared(event, 2),
      markPast: true,
    });
    expect(log.filter((l) => l.op === 'upload').map((l) => l.value)).toEqual(
      prepared(event, 2).map(
        (p) => `${EVENT_PHOTO_BUCKET}/${eventPhotoPath(event.slug, p.stamp, p.type)}`,
      ),
    );
    const album = log.find((l) => l.table === 'event_albums')!;
    expect(album).toMatchObject({
      op: 'insert',
      value: {
        id: eventAlbumId(event.id),
        event_id: event.id,
        island_id: 'halloween',
        event_finished: true,
      },
    });
    const rows = log.find((l) => l.table === 'event_photos')!.value as {
      url: string;
      album_id: string;
    }[];
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.album_id).toBe(eventAlbumId(event.id));
      expect(r.url).toMatch(
        /\/storage\/v1\/object\/public\/event-photos\/halloween-2026\/.+\.webp$/,
      );
    }
  });

  it('si el evento ya tenía álbum, lo actualiza y las fotos van a ése', async () => {
    const { sb, log } = fakeSupabase([{ id: 'album-viejo' }]);
    await saveSharedIslandPhotos(sb, {
      islandId: 'halloween',
      event,
      photos: prepared(event, 1),
      markPast: false,
    });
    expect(log.find((l) => l.table === 'event_albums')).toMatchObject({ op: 'update' });
    expect(
      (log.find((l) => l.table === 'event_albums')!.value as Record<string, unknown>)
        .event_finished,
    ).toBeUndefined();
    const rows = log.find((l) => l.table === 'event_photos')!.value as { album_id: string }[];
    expect(rows[0]!.album_id).toBe('album-viejo');
  });

  it('la web suma lo compartido: el evento pasa a recuerdo de la isla con su galería', () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/event-photos/halloween-2026/a.webp';
    const shared = sharedPhotosFromRows(
      [
        {
          id: eventAlbumId(event.id),
          event_id: event.id,
          island_id: 'halloween',
          title: event.name,
          event_date: '2026-10-31T22:00:00+00:00',
          event_finished: true,
        },
      ],
      [
        {
          id: 'f2',
          album_id: eventAlbumId(event.id),
          url,
          alt: 'b',
          width: 4,
          height: 3,
          created_at: '2026-11-01T02:00:00Z',
        },
        {
          id: 'f1',
          album_id: eventAlbumId(event.id),
          url,
          alt: 'a',
          width: 4,
          height: 3,
          created_at: '2026-11-01T01:00:00Z',
        },
        {
          id: 'huerfana',
          album_id: 'no-existe',
          url,
          alt: 'c',
          width: 4,
          height: 3,
          created_at: '2026-11-01T01:00:00Z',
        },
        {
          id: 'mala',
          album_id: eventAlbumId(event.id),
          url,
          alt: '',
          width: 4,
          height: 3,
          created_at: '2026-11-01T01:00:00Z',
        },
      ],
    );
    const merged = mergeSharedPhotos({ events: [event], photos: [], albums: [] }, shared);
    expect(merged.events[0]).toMatchObject({ state: 'finished', islandId: 'halloween' });
    const memories = islandMemoryGalleries('halloween', merged, NOW);
    expect(memories.map((m) => m.event.id)).toEqual([event.id]);
    expect(memories[0]!.photos.map((p) => p.id)).toEqual(['f1', 'f2']);
    // Un evento sin álbum compartido no cambia.
    const other = { ...event, id: 'otro', slug: 'otro' };
    expect(mergeSharedPhotos({ events: [other], photos: [] }, shared).events[0]).toBe(other);
  });
});
