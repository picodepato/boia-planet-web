/**
 * Range requests for the static media on Cloudflare (plan 046 T326).
 *
 * Workers Static Assets ignores `Range`: it answers `200` with the whole file
 * and no `Accept-Ranges` (measured on boiaplanet.net, 2026-10-24; Vercel
 * answers `206`). Browsers play media through range requests (to seek, to
 * loop, to resume a download they paused), so the media files go through the
 * Worker first (`assets.run_worker_first` in wrangler.jsonc, the patterns of
 * `MEDIA_RUN_WORKER_FIRST`), which asks the assets binding for the whole file
 * and answers the range itself: `206` with `Content-Range`, `416` when it
 * cannot be satisfied, `200` with `Accept-Ranges: bytes` without one. Only
 * those files cost a Worker request; everything else stays on the assets.
 *
 * Plain JavaScript: `cf-worker.mjs` (the Worker's entry) imports it as is.
 */

/** The media extensions served with ranges (lower case, without the dot). */
export const MEDIA_EXTENSIONS = ['mp4', 'webm', 'mp3', 'm4a', 'ogg'];

/** `assets.run_worker_first` in wrangler.jsonc: exactly these patterns. */
export const MEDIA_RUN_WORKER_FIRST = MEDIA_EXTENSIONS.map((ext) => `/*.${ext}`);

const MEDIA_PATH = new RegExp(`\\.(${MEDIA_EXTENSIONS.join('|')})$`, 'i');

/** Whether `pathname` is a media file served here. */
export function isMediaPath(pathname) {
  return MEDIA_PATH.test(pathname);
}

/**
 * The single byte range of a `Range` header for a file of `size` bytes:
 * `{ start, end }` (inclusive), `'unsatisfiable'`, or `null` when the header
 * is missing, malformed or asks for several ranges (then the whole file goes,
 * as RFC 9110 allows).
 */
export function parseRange(header, size) {
  if (!header) return null;
  const m = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(header);
  if (!m) return null;
  const [, a, b] = m;
  if (a === '' && b === '') return null;
  if (a === '') {
    // The last `b` bytes.
    const n = Number(b);
    if (n === 0 || size === 0) return 'unsatisfiable';
    return { start: Math.max(0, size - n), end: size - 1 };
  }
  const start = Number(a);
  if (start >= size) return 'unsatisfiable';
  const end = b === '' ? size - 1 : Math.min(Number(b), size - 1);
  if (end < start) return null;
  return { start, end };
}

/** `If-Range` still matches the file: a strong ETag equal to the file's (dates are not compared). */
function ifRangeMatches(ifRange, etag) {
  if (!ifRange) return true;
  const v = ifRange.trim();
  if (!v.startsWith('"') && !v.startsWith('W/')) return false;
  return !!etag && !v.startsWith('W/') && v === etag;
}

/**
 * Serves a media request from `assets` (the `ASSETS` binding) with range
 * support, or returns `null` when the request is not for a media file (the
 * caller then goes on to Next).
 */
export async function serveMedia(request, assets) {
  const url = new URL(request.url);
  if (!isMediaPath(url.pathname)) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return assets.fetch(request);

  const range = request.headers.get('Range');
  const headers = new Headers(request.headers);
  headers.delete('Range');
  headers.delete('If-Range');
  const full = await assets.fetch(new Request(request.url, { method: 'GET', headers }));
  if (full.status !== 200) return full;

  const out = new Headers(full.headers);
  out.set('Accept-Ranges', 'bytes');
  const head = request.method === 'HEAD';
  const plain = () =>
    new Response(head ? null : full.body, { status: 200, statusText: 'OK', headers: out });
  if (!range || !ifRangeMatches(request.headers.get('If-Range'), full.headers.get('ETag'))) {
    return plain();
  }

  const body = await full.arrayBuffer();
  const size = body.byteLength;
  const r = parseRange(range, size);
  if (r === null) {
    out.set('Content-Length', String(size));
    return new Response(head ? null : body, { status: 200, statusText: 'OK', headers: out });
  }
  if (r === 'unsatisfiable') {
    out.delete('Content-Length');
    out.set('Content-Range', `bytes */${size}`);
    return new Response(null, { status: 416, statusText: 'Range Not Satisfiable', headers: out });
  }
  out.set('Content-Range', `bytes ${r.start}-${r.end}/${size}`);
  out.set('Content-Length', String(r.end - r.start + 1));
  return new Response(head ? null : body.slice(r.start, r.end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: out,
  });
}
