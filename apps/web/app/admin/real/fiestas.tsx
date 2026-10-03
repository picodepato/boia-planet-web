'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminAccessToken } from '../../../lib/account/admin-auth';
import {
  STAMP_IMAGE_BUCKET,
  STAMP_IMAGE_LIMITS,
  type StampImageProblem,
  stampImageCopy,
  stampImagePath,
  stampImageProblem,
} from '../../../lib/admin/stamp-image';
import { type MessageKey, t } from '../../../lib/i18n';
import { QrCode, qrPath } from '../../../lib/mundo/carnet/qr-code';
import { RubberStamp } from '../../../lib/mundo/carnet/stamp';
import type { BoiaSupabase } from '../../../lib/supabase/browser';
import { SectionHead, StatusLine } from '../ui';
import { useRun } from '../use-admin';
import { NeedsAdmin, download, must, useAdminSupabase, when } from './common';

interface PartyRow {
  id: string;
  slug: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  state: string;
  stamp_image_url: string | null;
  is_sample: boolean;
}

interface CodeRow {
  event_id: string;
  code: string;
  valid_from: string;
  valid_until: string;
}

const IMAGE_PROBLEM: Record<StampImageProblem, MessageKey> = {
  type: 'admin.real.fiestas.image.type',
  size: 'admin.real.fiestas.image.size',
  small: 'admin.real.fiestas.image.small',
  url: 'admin.real.fiestas.image.url',
  fetch: 'admin.real.fiestas.image.fetch',
  forbidden: 'admin.real.error.forbidden',
};

class ImageError extends Error {}

/** La URL que lleva el QR de la fiesta (la abre la cámara del móvil, T91). */
export function selloUrl(origin: string, slug: string, code: string): string {
  return `${origin}/sello?e=${encodeURIComponent(slug)}&c=${encodeURIComponent(code)}`;
}

/** ISO → valor de `<input type="datetime-local">` en la hora de este navegador. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** La ventana por defecto de una fiesta sin código: de 2 h antes a 12 h después del inicio. */
function defaultWindow(p: PartyRow): { from: string; until: string } {
  const start = p.starts_at ? new Date(p.starts_at).getTime() : Date.now();
  const end = p.ends_at ? new Date(p.ends_at).getTime() : start + 12 * 3600_000;
  return {
    from: toLocalInput(new Date(start - 2 * 3600_000).toISOString()),
    until: toLocalInput(new Date(end + 2 * 3600_000).toISOString()),
  };
}

/** El QR en PNG para imprimir: el QR grande, el nombre de la fiesta y su URL. */
async function qrPng(title: string, url: string): Promise<Blob> {
  const { size, d } = qrPath(url);
  const W = 1200;
  const quiet = 4;
  const scale = Math.floor((W - 120) / (size + quiet * 2));
  const qrSide = scale * (size + quiet * 2);
  const H = qrSide + 260;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  g.save();
  g.translate((W - qrSide) / 2 + quiet * scale, 60 + quiet * scale);
  g.scale(scale, scale);
  g.fillStyle = '#000';
  g.fill(new Path2D(d));
  g.restore();
  g.fillStyle = '#000';
  g.textAlign = 'center';
  g.font = 'bold 54px sans-serif';
  g.fillText(title, W / 2, qrSide + 140, W - 80);
  g.font = '26px sans-serif';
  g.fillText(t('admin.real.fiestas.qrCaption'), W / 2, qrSide + 200, W - 80);
  return new Promise((ok, ko) =>
    canvas.toBlob((b) => (b ? ok(b) : ko(new Error('png'))), 'image/png'),
  );
}

/** Sube la copia propia de la imagen y la pone en la fiesta. */
async function saveStampImage(sb: BoiaSupabase, slug: string, source: Blob, why: string) {
  if (source.size > STAMP_IMAGE_LIMITS.maxBytes) throw new ImageError(t(IMAGE_PROBLEM.size));
  const problem = stampImageProblem(new Uint8Array(await source.arrayBuffer()));
  if (problem) throw new ImageError(t(IMAGE_PROBLEM[problem]));
  const { blob, type } = await stampImageCopy(source);
  const path = stampImagePath(slug, type);
  const up = await sb.storage
    .from(STAMP_IMAGE_BUCKET)
    .upload(path, blob, { contentType: type, upsert: false, cacheControl: '31536000' });
  if (up.error) throw new Error(up.error.message);
  const url = sb.storage.from(STAMP_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  await must(sb.rpc('admin_set_stamp_image', { p_event: slug, p_url: url, p_reason: why }));
}

/** La imagen de una URL, traída una vez por el servidor (`/api/admin/stamp-image`). */
async function fetchRemote(url: string): Promise<Blob> {
  const token = await adminAccessToken();
  const res = await fetch('/api/admin/stamp-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
    body: JSON.stringify({ url: url.trim() }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: StampImageProblem };
    const key = body.error && body.error in IMAGE_PROBLEM ? IMAGE_PROBLEM[body.error] : null;
    throw new ImageError(key ? t(key) : t('admin.real.fiestas.image.fetch'));
  }
  return res.blob();
}

function Projector({ title, url, onClose }: { title: string; url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="admin-projector"
      role="dialog"
      aria-modal="true"
      aria-label={t('admin.real.fiestas.project')}
      data-testid="fiesta-proyector"
    >
      <div className="admin-projector__qr">
        <QrCode text={url} label={t('admin.real.fiestas.qrAria', { title })} />
      </div>
      <p className="admin-projector__title">{title}</p>
      <p className="admin-projector__caption">{t('admin.real.fiestas.qrCaption')}</p>
      <button type="button" className="admin-button" onClick={onClose} autoFocus>
        {t('admin.real.fiestas.closeProjector')}
      </button>
    </div>
  );
}

function PartyCard({
  sb,
  party,
  code,
  onChanged,
}: {
  sb: BoiaSupabase;
  party: PartyRow;
  code: CodeRow | null;
  onChanged: () => void;
}) {
  const fallback = defaultWindow(party);
  const [from, setFrom] = useState(code ? toLocalInput(code.valid_from) : fallback.from);
  const [until, setUntil] = useState(code ? toLocalInput(code.valid_until) : fallback.until);
  const [confirming, setConfirming] = useState(false);
  const [projecting, setProjecting] = useState(false);
  const [remote, setRemote] = useState('');
  const { status, busy, run } = useRun();
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const url = code ? selloUrl(origin, party.slug, code.code) : null;
  const s = party.slug;

  const saveCode = (regenerate: boolean, ok: string) =>
    void run(async () => {
      const f = fromLocalInput(from);
      const u = fromLocalInput(until);
      if (!f || !u) throw new Error(t('admin.real.error.invalidWindow'));
      await must(
        sb.rpc('admin_set_stamp_code', {
          p_event: s,
          p_valid_from: f,
          p_valid_until: u,
          p_regenerate: regenerate,
        }),
      );
      setConfirming(false);
      onChanged();
    }, ok);

  const image = (work: () => Promise<void>, ok: string) =>
    void run(async () => {
      await work();
      onChanged();
    }, ok);

  return (
    <li className="admin-card" data-testid={`fiesta-${s}`}>
      <div className="admin-row admin-row--between">
        <div>
          <h3>{party.title}</h3>
          <p className="admin-meta">
            {s} · {when(party.starts_at)} · {party.state}
            {party.is_sample ? t('admin.moderation.muestra') : ''}
          </p>
        </div>
        <div
          className="admin-fiesta__stamp"
          data-testid={`fiesta-sello-${s}`}
          data-imagen={party.stamp_image_url ? 'si' : 'no'}
        >
          <RubberStamp
            art={{
              eventId: s,
              name: party.title,
              date: party.starts_at,
              image: party.stamp_image_url,
              sample: false,
            }}
          />
        </div>
      </div>

      <h4>{t('admin.real.fiestas.qrHeading')}</h4>
      <div className="admin-grid">
        <label className="admin-field">
          <span className="admin-field__label">{t('admin.real.fiestas.from')}</span>
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            data-testid={`fiesta-desde-${s}`}
          />
        </label>
        <label className="admin-field">
          <span className="admin-field__label">{t('admin.real.fiestas.until')}</span>
          <input
            type="datetime-local"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            data-testid={`fiesta-hasta-${s}`}
          />
        </label>
      </div>
      <div className="admin-row">
        {code ? (
          <button
            type="button"
            className="admin-button"
            disabled={busy}
            data-testid={`fiesta-guardar-${s}`}
            onClick={() => saveCode(false, t('admin.real.fiestas.windowSaved'))}
          >
            {t('admin.real.fiestas.saveWindow')}
          </button>
        ) : (
          <button
            type="button"
            className="admin-button"
            disabled={busy}
            data-testid={`fiesta-crear-${s}`}
            onClick={() => saveCode(true, t('admin.real.fiestas.codeCreated'))}
          >
            {t('admin.real.fiestas.createCode')}
          </button>
        )}
        {code ? (
          <button
            type="button"
            className="admin-button admin-button--ghost"
            disabled={busy}
            data-testid={`fiesta-regenerar-${s}`}
            onClick={() => setConfirming((v) => !v)}
          >
            {t('admin.real.fiestas.regenerate')}
          </button>
        ) : null}
      </div>
      {confirming ? (
        <div className="admin-card admin-delete__panel" role="group">
          <p>{t('admin.real.fiestas.regenerateWarning')}</p>
          <div className="admin-row">
            <button
              type="button"
              className="admin-button admin-button--danger"
              disabled={busy}
              data-testid={`fiesta-regenerar-confirmar-${s}`}
              onClick={() => saveCode(true, t('admin.real.fiestas.regenerated'))}
            >
              {t('admin.real.fiestas.regenerateConfirm')}
            </button>
            <button
              type="button"
              className="admin-button admin-button--ghost"
              onClick={() => setConfirming(false)}
            >
              {t('carnet.cancel')}
            </button>
          </div>
        </div>
      ) : null}
      {code && url ? (
        <div className="admin-fiesta__qr">
          <div className="admin-fiesta__qrbox">
            <QrCode text={url} label={t('admin.real.fiestas.qrAria', { title: party.title })} />
          </div>
          <div>
            <p className="admin-meta">
              {t('admin.real.fiestas.window', {
                from: when(code.valid_from),
                until: when(code.valid_until),
              })}
            </p>
            <p className="admin-meta">
              <code className="admin-fiesta__url" data-testid={`fiesta-url-${s}`}>
                {url}
              </code>
            </p>
            <div className="admin-row">
              <button
                type="button"
                className="admin-button admin-button--ghost"
                data-testid={`fiesta-proyectar-${s}`}
                onClick={() => setProjecting(true)}
              >
                {t('admin.real.fiestas.project')}
              </button>
              <button
                type="button"
                className="admin-button admin-button--ghost"
                data-testid={`fiesta-png-${s}`}
                onClick={() =>
                  void run(async () => {
                    download(await qrPng(party.title, url), `sello-${s}.png`);
                  }, t('admin.real.fiestas.pngReady'))
                }
              >
                {t('admin.real.fiestas.png')}
              </button>
              <button
                type="button"
                className="admin-button admin-button--ghost"
                data-testid={`fiesta-imprimir-${s}`}
                onClick={() => {
                  setProjecting(true);
                  setTimeout(() => window.print(), 50);
                }}
              >
                {t('admin.real.fiestas.print')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="admin-meta">{t('admin.real.fiestas.noCode')}</p>
      )}

      <h4>{t('admin.real.fiestas.imageHeading')}</h4>
      <p className="admin-meta">{t('admin.real.fiestas.imageHint')}</p>
      <div className="admin-grid">
        <label className="admin-field">
          <span className="admin-field__label">{t('admin.real.fiestas.upload')}</span>
          <input
            type="file"
            accept={STAMP_IMAGE_LIMITS.types.join(',')}
            disabled={busy}
            data-testid={`fiesta-sello-archivo-${s}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) {
                image(
                  () => saveStampImage(sb, s, file, t('admin.real.fiestas.reasonUpload')),
                  t('admin.real.fiestas.imageSaved'),
                );
              }
            }}
          />
        </label>
        <label className="admin-field">
          <span className="admin-field__label">{t('admin.real.fiestas.fromUrl')}</span>
          <input
            type="url"
            value={remote}
            placeholder="https://…"
            onChange={(e) => setRemote(e.target.value)}
            data-testid={`fiesta-sello-url-${s}`}
          />
        </label>
      </div>
      <div className="admin-row">
        <button
          type="button"
          className="admin-button admin-button--ghost"
          disabled={busy || !remote.trim()}
          data-testid={`fiesta-sello-traer-${s}`}
          onClick={() =>
            image(async () => {
              const blob = await fetchRemote(remote);
              await saveStampImage(sb, s, blob, t('admin.real.fiestas.reasonUrl'));
              setRemote('');
            }, t('admin.real.fiestas.imageSaved'))
          }
        >
          {t('admin.real.fiestas.fetch')}
        </button>
        {party.stamp_image_url ? (
          <button
            type="button"
            className="admin-button admin-button--ghost"
            disabled={busy}
            data-testid={`fiesta-sello-quitar-${s}`}
            onClick={() =>
              image(async () => {
                await must(
                  sb.rpc('admin_set_stamp_image', {
                    p_event: s,
                    p_reason: t('admin.real.fiestas.reasonRemove'),
                  }),
                );
              }, t('admin.real.fiestas.imageRemoved'))
            }
          >
            {t('admin.real.fiestas.removeImage')}
          </button>
        ) : null}
      </div>
      <StatusLine status={status} />
      {projecting && url ? (
        <Projector title={party.title} url={url} onClose={() => setProjecting(false)} />
      ) : null}
    </li>
  );
}

/** Fiestas y QR (T94, decisiones 9 y 11): ventana y código del sello, el QR, la imagen del sello. */
export function FiestasSection() {
  const sb = useAdminSupabase();
  const [parties, setParties] = useState<PartyRow[] | null>(null);
  const [codes, setCodes] = useState<Map<string, CodeRow>>(new Map());
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const load = useCallback(async () => {
    if (!sb) return;
    try {
      const [ev, cs] = await Promise.all([
        must(
          sb
            .from('events')
            .select('id, slug, title, starts_at, ends_at, state, stamp_image_url, is_sample')
            .is('archived_at', null)
            .order('starts_at', { ascending: false, nullsFirst: false })
            .limit(500),
        ),
        must(sb.from('event_stamp_codes').select('event_id, code, valid_from, valid_until')),
      ]);
      setParties(ev as PartyRow[]);
      setCodes(new Map((cs as CodeRow[]).map((c) => [c.event_id, c])));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [sb]);

  useEffect(() => {
    void load();
  }, [load, revision]);

  const q = query.trim().toLowerCase();
  const list = (parties ?? []).filter(
    (p) => !q || p.title.toLowerCase().includes(q) || p.slug.includes(q),
  );
  return (
    <section data-testid="fiestas">
      <SectionHead title={t('admin.real.fiestas.title')} lead={t('admin.real.fiestas.lead')} />
      <NeedsAdmin>
        <label className="admin-field">
          <span className="admin-field__label">{t('admin.real.search')}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="fiestas-buscar"
          />
        </label>
        {error ? (
          <p className="admin-status admin-status--error" role="alert">
            {error}
          </p>
        ) : null}
        {!parties || !sb ? (
          <p>{t('empty.loading')}</p>
        ) : (
          <ul className="admin-list">
            {list.map((p) => {
              const code = codes.get(p.id) ?? null;
              return (
                <PartyCard
                  key={p.id}
                  sb={sb}
                  party={p}
                  code={code}
                  onChanged={() => setRevision((r) => r + 1)}
                />
              );
            })}
            {list.length === 0 ? <li className="admin-meta">{t('admin.real.empty')}</li> : null}
          </ul>
        )}
      </NeedsAdmin>
    </section>
  );
}
