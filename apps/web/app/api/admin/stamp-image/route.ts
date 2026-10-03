import { createClient } from '@supabase/supabase-js';
import type { Database } from '@boia/db/types';
import {
  STAMP_IMAGE_LIMITS,
  type StampImageProblem,
  isFetchableImageUrl,
  sniffImageType,
  stampImageProblem,
} from '../../../../lib/admin/stamp-image';
import { supabasePublicConfig } from '../../../../lib/supabase/config';

/**
 * Trae UNA vez la imagen del sello de una URL (T87 «Image stamps», T94): el
 * Admin pega una URL, el servidor la descarga con las mismas comprobaciones
 * que una subida (PNG/WebP/JPEG, ≥ 512 px, ≤ 2 MB) y se la devuelve al Admin,
 * que guarda su copia de 512 × 512 en Storage. El Carnet nunca enlaza la URL
 * de fuera. Sólo atiende al equipo con TOTP (`my_staff_role` con la sesión
 * de quien llama: admin u owner); sin Supabase no existe.
 *
 * POST { url } con `Authorization: Bearer <token de la sesión>`.
 * Responde la imagen, o { error: <StampImageProblem> } con 400/403/404/502.
 */
export const dynamic = 'force-dynamic';

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

function fail(error: StampImageProblem | 'off', status: number): Response {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function staffRole(token: string): Promise<string | null> {
  const cfg = supabasePublicConfig();
  if (!cfg) return null;
  const sb = createClient<Database>(cfg.url, cfg.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await sb.rpc('my_staff_role');
  return error ? null : (data ?? null);
}

/** Lee el cuerpo hasta el límite (+1 byte, para saber que se pasa). */
async function readLimited(res: Response, limit: number): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get('content-length') ?? '0');
  if (declared > limit) return null;
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}

/** Sigue como mucho 3 redirecciones, comprobando cada destino. */
async function fetchImage(url: string): Promise<Response | null> {
  let current = url;
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isFetchableImageUrl(current)) return null;
    const res = await fetch(current, {
      redirect: 'manual',
      signal,
      headers: { Accept: STAMP_IMAGE_LIMITS.types.join(', ') },
      cache: 'no-store',
    });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location');
      if (!next) return null;
      current = new URL(next, current).toString();
      continue;
    }
    return res.ok ? res : null;
  }
  return null;
}

export async function POST(req: Request): Promise<Response> {
  if (!supabasePublicConfig()) return fail('off', 404);
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '')?.[1];
  if (!token) return fail('forbidden', 403);
  const role = await staffRole(token);
  if (role !== 'admin' && role !== 'owner') return fail('forbidden', 403);

  let url: unknown;
  try {
    url = ((await req.json()) as { url?: unknown }).url;
  } catch {
    return fail('url', 400);
  }
  if (typeof url !== 'string' || !isFetchableImageUrl(url)) return fail('url', 400);

  let res: Response | null;
  try {
    res = await fetchImage(url);
  } catch {
    return fail('fetch', 502);
  }
  if (!res) return fail('fetch', 502);
  const bytes = await readLimited(res, STAMP_IMAGE_LIMITS.maxBytes).catch(() => null);
  if (!bytes) return fail('size', 400);
  const problem = stampImageProblem(bytes);
  if (problem) return fail(problem, 400);
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      'Content-Type': sniffImageType(bytes)!,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
