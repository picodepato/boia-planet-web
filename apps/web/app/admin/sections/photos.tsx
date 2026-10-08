'use client';

import { type BoiaEvent, type Photo, effectiveEvents } from '@boia/contracts';
import { useState } from 'react';
import {
  PhotoUploadError,
  type SaveIslandPhotos,
  preparePhotos,
  saveLocalIslandPhotos,
  saveSharedIslandPhotos,
} from '../../../lib/admin/island-photos';
import { putLocalPhoto } from '../../../lib/admin/photo-store';
import { MEDIA_UPLOAD_ACCEPT } from '../../../lib/admin/photo-upload';
import { eventIslands } from '../../../lib/admin/world';
import { PhotoImage } from '../../../lib/photo-image';
import { useAdminSupabase, useMaybeRealAdmin } from '../real/common';
import type { AdminContext } from '../use-admin';
import { useRead, useRun } from '../use-admin';
import {
  Changed,
  DeleteButton,
  Field,
  ResetButton,
  SectionHead,
  StatusLine,
  TrashInline,
} from '../ui';
import { t } from '../../../lib/i18n';

function PhotoRow({
  ctx,
  photo,
  albums,
  changed,
}: {
  ctx: AdminContext;
  photo: Photo;
  albums: { id: string; title: string }[];
  changed: boolean;
}) {
  const [alt, setAlt] = useState(photo.alt);
  const [src, setSrc] = useState(photo.src ?? '');
  const [albumId, setAlbumId] = useState(photo.albumId);
  const { status, busy, run } = useRun();
  return (
    <li className="admin-card" data-testid={`foto-${photo.id}`} data-kind={photo.kind ?? 'image'}>
      {photo.src ? <PhotoImage photo={photo} className="admin-photo-thumb" /> : null}
      {photo.kind === 'video' ? <p className="admin-meta">{t('admin.photos.clip')}</p> : null}
      <div className="admin-grid">
        <Field
          label={t('admin.photos.textoAlternativo')}
          hint={t('admin.photos.obligatorioReqCom031')}
        >
          <input value={alt} onChange={(e) => setAlt(e.target.value)} />
        </Field>
        <Field label={t('admin.photos.imagenUrl')} hint={t('admin.photos.vaciaMarcadorDeMuestra')}>
          <input type="url" value={src} onChange={(e) => setSrc(e.target.value)} />
        </Field>
        <Field label={t('admin.photos.album')}>
          <select value={albumId} onChange={(e) => setAlbumId(e.target.value)}>
            {albums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="admin-row">
        <Changed on={changed} />
        <button
          type="button"
          className="admin-button"
          disabled={busy}
          onClick={() => {
            const next: Photo = { ...photo, alt, albumId };
            if (src) next.src = src;
            else delete next.src;
            void run(() => ctx.repo.admin.upsert('photos', next, { reason: 'foto' }));
          }}
        >
          {t('admin.photos.guardar')}
        </button>
        <DeleteButton ctx={ctx} area="photos" id={photo.id} />
      </div>
      <StatusLine status={status} />
    </li>
  );
}

type SavePhotos = (input: SaveIslandPhotos) => Promise<void>;

/**
 * Fotos de una isla (plan 017 T189, decisión 4): se elige la isla y su
 * evento, se suben archivos de verdad (copia WebP de 1600 px como mucho) y,
 * marcado, el evento pasa a finalizado: la isla lo enseña como recuerdo con
 * su galería. Modo local: en este navegador; con cuentas: en Supabase.
 */
function IslandPhotoUpload({ ctx }: { ctx: AdminContext }) {
  const real = useMaybeRealAdmin();
  if (real) return <SharedIslandPhotoUpload ctx={ctx} />;
  return (
    <IslandPhotoForm
      ctx={ctx}
      shared={false}
      save={(input) => saveLocalIslandPhotos(ctx.actions, input, putLocalPhoto)}
    />
  );
}

function SharedIslandPhotoUpload({ ctx }: { ctx: AdminContext }) {
  const sb = useAdminSupabase();
  return (
    <IslandPhotoForm
      ctx={ctx}
      shared
      save={sb ? (input) => saveSharedIslandPhotos(sb, input) : null}
    />
  );
}

function IslandPhotoForm({
  ctx,
  shared,
  save,
}: {
  ctx: AdminContext;
  shared: boolean;
  save: SavePhotos | null;
}) {
  const stored = useRead(ctx, (r) => r.content.events());
  const islands = eventIslands(ctx.registry.map);
  const places = ctx.registry.get(ctx.registry.defaultId).places;
  const islandName = (id: string) => places.find((p) => p.id === id)?.name ?? id;
  const [islandId, setIslandId] = useState(islands[0]?.id ?? '');
  const [eventId, setEventId] = useState('');
  const [alt, setAlt] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [markPast, setMarkPast] = useState(true);
  const [inputKey, setInputKey] = useState(0);
  const { status, busy, run } = useRun();

  // Los eventos de la isla primero; también los que aún no tienen isla (se ligan a ésta).
  const choices: BoiaEvent[] = effectiveEvents(stored ?? [], new Date())
    .filter((e) => e.state !== 'draft' && (e.islandId === islandId || !e.islandId))
    .sort(
      (a, b) => Number(!!b.islandId) - Number(!!a.islandId) || b.startsAt.localeCompare(a.startsAt),
    );
  const chosen = choices.find((e) => e.id === eventId) ?? choices[0];

  return (
    <form
      className="admin-card admin-form"
      data-testid="fotos-isla"
      onSubmit={(e) => {
        e.preventDefault();
        if (!save) return;
        const event = chosen;
        const island = islandName(islandId);
        const n = files.length;
        void run(
          async () => {
            if (!event) throw new Error(t('admin.photos.upload.needEvent'));
            if (n === 0) throw new Error(t('admin.photos.upload.needFiles'));
            if (!alt.trim()) throw new Error(t('admin.photos.upload.needAlt'));
            try {
              const photos = await preparePhotos(files, event.id, alt);
              await save({ islandId, event, photos, markPast });
            } catch (err) {
              if (err instanceof PhotoUploadError) {
                throw new Error(
                  t(`admin.photos.upload.problem.${err.problem}`, { file: err.fileName }),
                );
              }
              throw err;
            }
            setFiles([]);
            setInputKey((k) => k + 1);
          },
          markPast
            ? t(n === 1 ? 'admin.photos.upload.donePast1' : 'admin.photos.upload.donePast', {
                n,
                island,
                event: event?.name ?? '',
              })
            : t(n === 1 ? 'admin.photos.upload.done1' : 'admin.photos.upload.done', { n, island }),
        );
      }}
    >
      <h3>{t('admin.photos.upload.title')}</h3>
      <p className="admin-meta">
        {t('admin.photos.upload.lead')}{' '}
        {shared ? t('admin.photos.upload.leadShared') : t('admin.photos.upload.leadLocal')}
      </p>
      <div className="admin-grid">
        <Field label={t('admin.photos.upload.island')}>
          <select
            value={islandId}
            data-testid="fotos-isla-isla"
            onChange={(e) => {
              setIslandId(e.target.value);
              setEventId('');
            }}
          >
            {islands.map((p) => (
              <option key={p.id} value={p.id}>
                {islandName(p.id)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={t('admin.photos.upload.event')}
          hint={choices.length === 0 ? t('admin.photos.upload.noEvents') : undefined}
        >
          <select
            value={chosen?.id ?? ''}
            data-testid="fotos-isla-evento"
            disabled={choices.length === 0}
            onChange={(e) => setEventId(e.target.value)}
          >
            {choices.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('admin.photos.upload.files')} hint={t('admin.photos.upload.filesHint')}>
          <input
            key={inputKey}
            type="file"
            multiple
            accept={MEDIA_UPLOAD_ACCEPT}
            data-testid="fotos-isla-archivos"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </Field>
        <Field label={t('admin.photos.upload.alt')} hint={t('admin.photos.upload.altHint')}>
          <input
            value={alt}
            data-testid="fotos-isla-alt"
            onChange={(e) => setAlt(e.target.value)}
          />
        </Field>
      </div>
      <label className="admin-check">
        <input
          type="checkbox"
          checked={markPast}
          data-testid="fotos-isla-pasado"
          onChange={(e) => setMarkPast(e.target.checked)}
        />{' '}
        {t('admin.photos.upload.markPast')}
      </label>
      <div className="admin-row">
        <button
          type="submit"
          className="admin-button"
          disabled={busy || !save || choices.length === 0}
          data-testid="fotos-isla-subir"
        >
          {busy ? t('admin.photos.upload.working') : t('admin.photos.upload.submit')}
        </button>
      </div>
      <StatusLine status={status} />
    </form>
  );
}

/** Galería (REQ-ADM-019; plan 019 T216): álbumes, fotos y clips de la home, las islas y la Galería. */
export function PhotosSection({ ctx }: { ctx: AdminContext }) {
  const photos = useRead(ctx, (r) => r.content.list('photos'));
  const albums = useRead(ctx, (r) => r.content.list('albums'));
  const changed = useRead(ctx, (r) => r.admin.overridden('photos'));
  const [alt, setAlt] = useState('');
  const [albumTitle, setAlbumTitle] = useState('');
  const { status, busy, run } = useRun();
  if (!photos || !albums) return <p>{t('empty.loading')}</p>;
  const changedSet = new Set(changed ?? []);
  const nextId = () => {
    let n = photos.length + 1;
    while (photos.some((p) => p.id === `foto-${n}`)) n++;
    return `foto-${n}`;
  };
  return (
    <section>
      <SectionHead title={t('admin.photos.fotosYVideos')} lead={t('admin.photos.losVideosYLa')}>
        <ResetButton ctx={ctx} areas={['photos', 'albums']} />
      </SectionHead>
      <IslandPhotoUpload ctx={ctx} />
      <div className="admin-grid">
        <form
          className="admin-card admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!alt.trim()) throw new Error('falta el texto alternativo');
              await ctx.repo.admin.upsert(
                'photos',
                {
                  id: nextId(),
                  albumId: albums[0]?.id ?? 'album-muestra',
                  alt: alt.trim(),
                  width: 4,
                  height: 3,
                },
                { reason: t('admin.photos.nuevaFoto') },
              );
              setAlt('');
            }, t('admin.photos.fotoAnadida'));
          }}
        >
          <h3>{t('admin.photos.nuevaFoto2')}</h3>
          <Field label={t('admin.photos.textoAlternativo')}>
            <input value={alt} onChange={(e) => setAlt(e.target.value)} data-testid="foto-alt" />
          </Field>
          <button type="submit" className="admin-button" disabled={busy} data-testid="foto-anadir">
            {t('admin.photos.anadir')}
          </button>
        </form>
        <form
          className="admin-card admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!albumTitle.trim()) throw new Error('falta el título');
              let n = albums.length + 1;
              while (albums.some((a) => a.id === `album-${n}`)) n++;
              await ctx.repo.admin.upsert(
                'albums',
                { id: `album-${n}`, title: albumTitle.trim() },
                { reason: t('admin.photos.nuevoAlbum') },
              );
              setAlbumTitle('');
            }, t('admin.photos.albumCreado'));
          }}
        >
          <h3>{t('admin.photos.nuevoAlbum2')}</h3>
          <Field label={t('admin.photos.titulo')}>
            <input value={albumTitle} onChange={(e) => setAlbumTitle(e.target.value)} />
          </Field>
          <button type="submit" className="admin-button" disabled={busy}>
            {t('admin.photos.crear')}
          </button>
        </form>
      </div>
      <StatusLine status={status} />
      <p className="admin-meta">
        {t('admin.photos.albumes', { v1: albums.map((a) => a.title).join(' · ') })}
      </p>
      <TrashInline ctx={ctx} area="photos" />
      <ul className="admin-list">
        {photos.map((p) => (
          <PhotoRow
            key={`${p.id}|${p.alt}|${p.src}|${p.albumId}`}
            ctx={ctx}
            photo={p}
            albums={albums}
            changed={changedSet.has(p.id)}
          />
        ))}
      </ul>
    </section>
  );
}
