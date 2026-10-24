import { describe, expect, it } from 'vitest';
import {
  MEDIA_RUN_WORKER_FIRST,
  isMediaPath,
  parseRange,
  serveMedia,
  // @ts-expect-error: script de Node sin tipos
} from './cf-range.mjs';

/**
 * Range requests for the media on Cloudflare (plan 046 T326): Workers Static
 * Assets answers `Range` with the whole file (`200`, no `Accept-Ranges`);
 * the Worker answers it as Vercel does.
 */

const FILE = new Uint8Array(Array.from({ length: 1000 }, (_, i) => i % 256));
const ETAG = '"abc123"';

/** The `ASSETS` binding as Workers Static Assets behaves: `Range` ignored. */
function fakeAssets(status = 200) {
  const seen: Request[] = [];
  return {
    seen,
    fetch: async (req: Request) => {
      seen.push(req);
      if (status !== 200) return new Response('no', { status });
      return new Response(FILE, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': String(FILE.length),
          ETag: ETAG,
          'Cache-Control': 'public, max-age=0, must-revalidate',
        },
      });
    },
  };
}

const req = (headers: Record<string, string> = {}, path = '/contenido/portada/presentacion.mp4') =>
  new Request(`https://boiaplanet.net${path}`, { headers });

describe('parseRange', () => {
  it('a range, an open one and the last bytes', () => {
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=900-', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=990-5000', 1000)).toEqual({ start: 990, end: 999 });
    expect(parseRange('bytes=-10', 1000)).toEqual({ start: 990, end: 999 });
    expect(parseRange('bytes=-5000', 1000)).toEqual({ start: 0, end: 999 });
  });
  it('past the end: unsatisfiable; malformed or several: the whole file', () => {
    expect(parseRange('bytes=1000-', 1000)).toBe('unsatisfiable');
    expect(parseRange('bytes=-0', 1000)).toBe('unsatisfiable');
    expect(parseRange(null, 1000)).toBeNull();
    expect(parseRange('bytes=0-1,5-9', 1000)).toBeNull();
    expect(parseRange('items=0-1', 1000)).toBeNull();
    expect(parseRange('bytes=50-10', 1000)).toBeNull();
    expect(parseRange('bytes=-', 1000)).toBeNull();
  });
});

describe('isMediaPath y run_worker_first', () => {
  it('vídeos y audios sí; imágenes, modelos y páginas no', () => {
    expect(isMediaPath('/contenido/portada/presentacion.mp4')).toBe(true);
    expect(isMediaPath('/contenido/galeria/clip-img-0561.MP4')).toBe(true);
    expect(isMediaPath('/radio/muestra/muestra-001.mp3')).toBe(true);
    expect(isMediaPath('/contenido/portada/presentacion.webp')).toBe(false);
    expect(isMediaPath('/art/barco/barco.glb')).toBe(false);
    expect(isMediaPath('/')).toBe(false);
    expect(MEDIA_RUN_WORKER_FIRST).toContain('/*.mp4');
  });
});

describe('serveMedia', () => {
  it('Range bytes=0-99 → 206 con Content-Range, como Vercel', async () => {
    const assets = fakeAssets();
    const res = await serveMedia(req({ Range: 'bytes=0-99' }), assets);
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 0-99/1000');
    expect(res.headers.get('Content-Length')).toBe('100');
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
    expect(res.headers.get('Content-Type')).toBe('video/mp4');
    expect(res.headers.get('ETag')).toBe(ETAG);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(FILE.slice(0, 100));
    // The binding is asked for the whole file (it would ignore the range anyway).
    expect(assets.seen[0]!.headers.get('Range')).toBeNull();
  });

  it('a resumed download from the middle gets its bytes', async () => {
    const res = await serveMedia(req({ Range: 'bytes=600-' }), fakeAssets());
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 600-999/1000');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(FILE.slice(600));
  });

  it('without Range: 200, the whole file, Accept-Ranges', async () => {
    const res = await serveMedia(req(), fakeAssets());
    expect(res.status).toBe(200);
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
    expect((await res.arrayBuffer()).byteLength).toBe(1000);
  });

  it('past the end: 416 with bytes */size', async () => {
    const res = await serveMedia(req({ Range: 'bytes=5000-' }), fakeAssets());
    expect(res.status).toBe(416);
    expect(res.headers.get('Content-Range')).toBe('bytes */1000');
  });

  it('If-Range of another version: the whole file; of this one: the range', async () => {
    const old = await serveMedia(req({ Range: 'bytes=0-9', 'If-Range': '"viejo"' }), fakeAssets());
    expect(old.status).toBe(200);
    const same = await serveMedia(req({ Range: 'bytes=0-9', 'If-Range': ETAG }), fakeAssets());
    expect(same.status).toBe(206);
  });

  it('HEAD with Range: the headers of the 206, no body', async () => {
    const r = new Request('https://boiaplanet.net/a.mp4', {
      method: 'HEAD',
      headers: { Range: 'bytes=0-9' },
    });
    const res = await serveMedia(r, fakeAssets());
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Length')).toBe('10');
    expect(res.body).toBeNull();
  });

  it('a missing file passes as the assets answer it; a page is not its business', async () => {
    expect((await serveMedia(req({ Range: 'bytes=0-9' }), fakeAssets(404))).status).toBe(404);
    expect(await serveMedia(req({}, '/mar'), fakeAssets())).toBeNull();
  });
});
