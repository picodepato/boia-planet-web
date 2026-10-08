import { existsSync, readFileSync } from 'node:fs';
import { type BoiaEvent, eventAlbumId, eventPhotos, photoSchema } from '@boia/contracts';
import { MemoryStorage, SAMPLE_PHOTOS, createLocalRepository } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { createAdminActions } from './actions';
import {
  PhotoUploadError,
  type PreparedClip,
  posterKey,
  preparePhotos,
  saveLocalIslandPhotos,
  saveSharedIslandPhotos,
} from './island-photos';
import {
  CLIP_UPLOAD_LIMITS,
  type ClipInfo,
  type ClipProbe,
  EVENT_CLIP_BUCKET,
  EVENT_PHOTO_BUCKET,
  MEDIA_UPLOAD_ACCEPT,
  type PhotoCodec,
  clipInfoProblem,
  clipUploadProblem,
  eventClipPath,
  isMp4,
} from './photo-upload';
import { sharedPhotosFromRows } from './shared-photos';
import { eventIslands, islandEvent } from './world';

/**
 * Los clips de la Galería desde el Admin (plan 019 T216, decisión 8): qué
 * mp4 valen, su póster, y dónde se guardan en modo local y con cuentas
 * (Supabase falso). REQ-ADM-019, REQ-COM-031.
 */

const NOW = new Date('2026-10-08T10:00:00Z');

/** Los primeros bytes de un mp4 (caja `ftyp`), con la marca que se pida, y relleno. */
function mp4(brand = 'isom', size = 64): Uint8Array {
  const b = new Uint8Array(size);
  b.set([0, 0, 0, 24], 0);
  b.set(
    [...`ftyp${brand}`].map((c) => c.charCodeAt(0)),
    4,
  );
  return b;
}

const clipFile = (bytes: Uint8Array, name = 'clip.mp4') =>
  new File([bytes as unknown as BlobPart], name, { type: 'video/mp4' });

const info = (over: Partial<ClipInfo> = {}): ClipInfo => ({
  width: 1280,
  height: 720,
  duration: 6,
  frame: new Blob(['f'], { type: 'image/png' }),
  ...over,
});

const probeOf =
  (result: ClipInfo | null): ClipProbe =>
  async () =>
    result;

const codec: PhotoCodec = {
  decode: async () => ({ width: 1280, height: 720, close: () => {} }),
  encode: async (_d, _to, type) => new Blob(['p'], { type }),
};

describe('qué clips valen (T216)', () => {
  it('un mp4 se reconoce por sus bytes; un .mov de QuickTime o una imagen, no', () => {
    expect(isMp4(mp4())).toBe(true);
    expect(isMp4(mp4('mp42'))).toBe(true);
    expect(isMp4(mp4('qt  '))).toBe(false);
    expect(isMp4(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    expect(MEDIA_UPLOAD_ACCEPT).toContain('video/mp4');
  });

  it('tope de peso, de duración y de lado', () => {
    expect(clipUploadProblem(mp4())).toBeNull();
    expect(clipUploadProblem(mp4('isom', CLIP_UPLOAD_LIMITS.maxBytes + 1))).toBe('clipSize');
    expect(clipInfoProblem(info())).toBeNull();
    expect(clipInfoProblem(null)).toBe('clip');
    expect(clipInfoProblem(info({ duration: CLIP_UPLOAD_LIMITS.maxSeconds + 1 }))).toBe('long');
    expect(clipInfoProblem(info({ duration: Number.NaN }))).toBe('long');
    expect(clipInfoProblem(info({ width: 150, height: 100 }))).toBe('small');
    expect(clipInfoProblem(info({ width: CLIP_UPLOAD_LIMITS.maxSide + 2 }))).toBe('clip');
  });

  it('preparePhotos: el clip va tal cual, con su tamaño y un póster WebP', async () => {
    const file = clipFile(mp4());
    const [clip] = await preparePhotos([file], 'halloween-2026', 'Baile', codec, probeOf(info()));
    expect(clip).toMatchObject({ kind: 'video', type: 'video/mp4', width: 1280, height: 720 });
    expect((clip as PreparedClip).blob).toBe(file);
    expect((clip as PreparedClip).poster.type).toBe('image/webp');
  });

  it('preparePhotos para con el problema del clip y su nombre', async () => {
    const run = (probe: ClipProbe) =>
      preparePhotos([clipFile(mp4(), 'largo.mp4')], 'e', 'x', codec, probe).catch((e) => e);
    const long = await run(probeOf(info({ duration: 90 })));
    expect(long).toBeInstanceOf(PhotoUploadError);
    expect(long).toMatchObject({ problem: 'long', fileName: 'largo.mp4' });
    expect(await run(probeOf(null))).toMatchObject({ problem: 'clip' });
    expect(
      await run(async () => {
        throw new Error('no abre');
      }),
    ).toMatchObject({ problem: 'clip' });
  });
});

describe('dónde se guarda un clip (T216)', () => {
  const clip: PreparedClip = {
    id: 'foto-halloween-2026-c0',
    stamp: 'c0',
    kind: 'video',
    blob: new Blob(['v'], { type: 'video/mp4' }),
    type: 'video/mp4',
    width: 1280,
    height: 720,
    alt: 'Baile',
    poster: {
      blob: new Blob(['p'], { type: 'image/webp' }),
      type: 'image/webp',
      width: 1280,
      height: 720,
    },
  };

  it('modo local: el clip y su póster en este navegador; la pieza es un clip válido', async () => {
    const repo = createLocalRepository({
      storage: new MemoryStorage(),
      now: () => NOW,
      watch: false,
    });
    const actions = createAdminActions({ repo, registry: WORLD_REGISTRY, now: () => NOW });
    const events = await repo.content.events();
    const islands = new Set(eventIslands(WORLD_REGISTRY.map).map((p) => p.id));
    const event = events.find(
      (e) =>
        e.islandId && islands.has(e.islandId) && islandEvent(e.islandId, events, NOW)?.id === e.id,
    )!;
    const stored = new Map<string, Blob>();
    await saveLocalIslandPhotos(
      actions,
      { islandId: event.islandId!, event, photos: [clip], markPast: false },
      async (key, blob) => {
        stored.set(key, blob);
        return `local-photo:${key}`;
      },
    );
    expect(stored.get(clip.id)).toBe(clip.blob);
    expect(stored.get(posterKey(clip.id))).toBe(clip.poster.blob);
    const home = await repo.content.home();
    const [saved] = eventPhotos(event.id, home.albums ?? [], home.photos);
    expect(saved).toMatchObject({
      kind: 'video',
      src: `local-photo:${clip.id}`,
      poster: `local-photo:${posterKey(clip.id)}`,
    });
    expect(photoSchema.safeParse(saved).success).toBe(true);
  });

  it('con cuentas: el clip a su bucket, el póster al de las fotos, y la fila dice que es un clip', async () => {
    const log: { op: string; table?: string; value?: unknown }[] = [];
    const sb = {
      from: (table: string) => ({
        select: () => ({ eq: async () => ({ data: [], error: null }) }),
        insert: async (value: unknown) => {
          log.push({ op: 'insert', table, value });
          return { data: null, error: null };
        },
      }),
      storage: {
        from: (bucket: string) => ({
          upload: async (path: string, _b: Blob, o: { contentType: string }) => {
            log.push({ op: 'upload', value: `${bucket}/${path} ${o.contentType}` });
            return { data: { path }, error: null };
          },
          getPublicUrl: (path: string) => ({
            data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${path}` },
          }),
        }),
      },
    };
    const event = { id: 'halloween-2026', slug: 'halloween-2026', name: 'H' } as BoiaEvent;
    await saveSharedIslandPhotos(sb as never, {
      islandId: 'halloween',
      event,
      photos: [clip],
      markPast: false,
    });
    expect(log.filter((l) => l.op === 'upload').map((l) => l.value)).toEqual([
      `${EVENT_CLIP_BUCKET}/${eventClipPath(event.slug, clip.stamp)} video/mp4`,
      `${EVENT_PHOTO_BUCKET}/halloween-2026/c0-poster.webp image/webp`,
    ]);
    const [row] = log.find((l) => l.table === 'event_photos')!.value as Record<string, unknown>[];
    expect(row).toMatchObject({
      album_id: eventAlbumId(event.id),
      kind: 'video',
      url: expect.stringContaining(`/public/${EVENT_CLIP_BUCKET}/`),
      poster_url: expect.stringContaining(`/public/${EVENT_PHOTO_BUCKET}/`),
    });
  });

  it('la web lee las filas de clips (y las de antes de la migración, como fotos)', () => {
    const album = {
      id: 'album-x',
      event_id: 'x',
      island_id: 'halloween',
      title: 'X',
      event_date: null,
      event_finished: false,
    };
    const base = {
      album_id: 'album-x',
      alt: 'a',
      width: 640,
      height: 400,
      created_at: '2026-10-08T00:00:00Z',
    };
    const shared = sharedPhotosFromRows(
      [album],
      [
        {
          ...base,
          id: 'c',
          url: 'https://x.supabase.co/storage/v1/object/public/event-clips/x/c.mp4',
          kind: 'video',
          poster_url: 'https://x.supabase.co/storage/v1/object/public/event-photos/x/c-poster.webp',
        },
        {
          ...base,
          id: 'f',
          url: 'https://x.supabase.co/storage/v1/object/public/event-photos/x/f.webp',
        },
      ],
    );
    expect(shared.photos.map((p) => [p.id, p.kind, p.poster ?? null])).toEqual([
      ['c', 'video', 'https://x.supabase.co/storage/v1/object/public/event-photos/x/c-poster.webp'],
      ['f', 'image', null],
    ]);
  });
});

describe('clips de muestra (T216)', () => {
  it('hay 2 o 3, con póster, de art/galeria, y ninguno sale en la home', () => {
    const clips = SAMPLE_PHOTOS.filter((p) => p.kind === 'video');
    expect(clips.length).toBeGreaterThanOrEqual(2);
    expect(clips.length).toBeLessThanOrEqual(3);
    for (const c of clips) {
      expect(c.src).toMatch(/^\/api\/art\/galeria\/[a-z-]+\.mp4$/);
      expect(c.poster).toMatch(/^\/api\/art\/galeria\/[a-z-]+\.webp$/);
      expect(c.selection).toBe(false);
      expect(photoSchema.safeParse(c).success).toBe(true);
      // Los archivos están en art/ (los sirve /api/art) y el clip es un mp4 de verdad.
      const file = (ref: string) =>
        new URL(`../../../../art/${ref.replace('/api/art/', '')}`, import.meta.url);
      expect(existsSync(file(c.poster!))).toBe(true);
      const bytes = new Uint8Array(readFileSync(file(c.src!)));
      expect(isMp4(bytes)).toBe(true);
      expect(bytes.length).toBeLessThan(CLIP_UPLOAD_LIMITS.maxBytes);
    }
  });
});
