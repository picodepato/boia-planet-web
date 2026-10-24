'use client';

import { type BoiaEvent, type Photo, effectiveEvents } from '@boia/contracts';
import { HOME_PHOTOS_LIMIT } from '@boia/store';
import { type ReactNode, useEffect, useState } from 'react';
import {
  PhotoUploadError,
  type SaveIslandPhotos,
  preparePhotos,
  saveLocalIslandPhotos,
  saveSharedIslandPhotos,
} from '../../../lib/admin/island-photos';
import {
  type MediaControls,
  type MediaPiece,
  localMediaControls,
  sharedMediaControls,
} from '../../../lib/admin/media-admin';
import {
  type MediaSettings,
  NO_MEDIA_SETTINGS,
  applyMediaSettings,
  movePiece,
} from '../../../lib/admin/media-settings';
import { putLocalPhoto } from '../../../lib/admin/photo-store';
import { MEDIA_UPLOAD_ACCEPT } from '../../../lib/admin/photo-upload';
import {
  NO_SHARED_PHOTOS,
  type SharedPhotos,
  readMediaSettings,
  readSharedPhotos,
} from '../../../lib/admin/shared-photos';
import { eventIslands } from '../../../lib/admin/world';
import { SAMPLE_CONTENT } from '../../../lib/landing/sample-content';
import { PhotoImage } from '../../../lib/photo-image';
import { realErrorText, useAdminSupabase, useMaybeRealAdmin } from '../real/common';
import type { AdminContext } from '../use-admin';
import { useRead, useRun } from '../use-admin';
import { Changed, Field, ResetButton, SectionHead, StatusLine, TrashInline } from '../ui';
import { t } from '../../../lib/i18n';

/** Texto, imagen y álbum de una pieza del repositorio de este navegador (REQ-ADM-019). */
function PhotoEdit({
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
    <details className="admin-piece__edit">
      <summary>{t('admin.photos.pieces.edit')}</summary>
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
      </div>
      <StatusLine status={status} />
    </details>
  );
}

/** Lo que hace una fila con los controles; `ok` es el mensaje si sale bien. */
type Act = (work: (c: MediaControls) => Promise<unknown>, ok: string) => void;

/**
 * Una pieza de la Galería (plan 048 T329): su miniatura, «En portada», subir
 * y bajar en el orden y «Borrar» con confirmación.
 */
function PieceRow({
  piece,
  code,
  first,
  last,
  disabled,
  act,
  move,
  children,
}: {
  piece: MediaPiece;
  /** Va en el código de la web: borrarla la oculta. */
  code: boolean;
  first: boolean;
  last: boolean;
  disabled: boolean;
  act: Act;
  move: (delta: -1 | 1) => void;
  children?: ReactNode;
}) {
  const { photo, uploaded } = piece;
  const [confirming, setConfirming] = useState(false);
  const id = photo.id;
  const confirmText = uploaded
    ? 'admin.photos.pieces.confirmUploaded'
    : code
      ? 'admin.photos.pieces.confirm'
      : 'admin.photos.pieces.confirmLocal';
  return (
    <li
      className="admin-card admin-piece"
      data-testid={`foto-${id}`}
      data-kind={photo.kind ?? 'image'}
      data-portada={photo.selection ? 'si' : 'no'}
    >
      {photo.src || photo.poster ? (
        <PhotoImage photo={photo} className="admin-photo-thumb" />
      ) : null}
      {photo.kind === 'video' ? <p className="admin-meta">{t('admin.photos.clip')}</p> : null}
      <p className="admin-piece__alt">{photo.alt}</p>
      <p className="admin-meta">
        {uploaded ? t('admin.photos.pieces.uploaded') : t('admin.photos.pieces.code')}
      </p>
      <div className="admin-row">
        <label className="admin-check">
          <input
            type="checkbox"
            role="switch"
            checked={photo.selection}
            disabled={disabled}
            data-testid={`foto-portada-${id}`}
            onChange={(e) => {
              const on = e.target.checked;
              act(
                (c) => c.setHome(id, on),
                on ? t('admin.photos.pieces.homeOn') : t('admin.photos.pieces.homeOff'),
              );
            }}
          />{' '}
          {t('admin.photos.pieces.onHome')}
        </label>
        <button
          type="button"
          className="admin-button admin-button--ghost"
          disabled={disabled || first}
          aria-label={t('admin.photos.pieces.upLabel', { alt: photo.alt })}
          data-testid={`foto-subir-${id}`}
          onClick={() => move(-1)}
        >
          ↑ {t('admin.photos.pieces.up')}
        </button>
        <button
          type="button"
          className="admin-button admin-button--ghost"
          disabled={disabled || last}
          aria-label={t('admin.photos.pieces.downLabel', { alt: photo.alt })}
          data-testid={`foto-bajar-${id}`}
          onClick={() => move(1)}
        >
          ↓ {t('admin.photos.pieces.down')}
        </button>
        <button
          type="button"
          className="admin-button admin-button--ghost"
          disabled={disabled}
          data-testid={`foto-borrar-${id}`}
          onClick={() => setConfirming((v) => !v)}
        >
          {t('admin.photos.pieces.delete')}
        </button>
      </div>
      {confirming ? (
        <div className="admin-card admin-delete__panel" role="group">
          <p>{t(confirmText, { alt: photo.alt })}</p>
          <div className="admin-row">
            <button
              type="button"
              className="admin-button admin-button--danger"
              disabled={disabled}
              data-testid={`foto-borrar-confirmar-${id}`}
              onClick={() => {
                setConfirming(false);
                act((c) => c.remove(piece), t('admin.photos.pieces.deleted'));
              }}
            >
              {t('admin.photos.pieces.confirmYes')}
            </button>
            <button
              type="button"
              className="admin-button admin-button--ghost"
              onClick={() => setConfirming(false)}
            >
              {t('admin.photos.pieces.cancel')}
            </button>
          </div>
        </div>
      ) : null}
      {children}
    </li>
  );
}

/** Las piezas que van en el código de la web (el álbum real, T328): borrarlas las oculta. */
const CODE_PIECES: ReadonlySet<string> = new Set(SAMPLE_CONTENT.photos.map((p) => p.id));

/**
 * Portada y galería (plan 048 T329): una lista con todas las piezas, las del
 * código y las subidas a Supabase, en el orden en que salen. Con cuentas, los
 * cambios van a Supabase (RPC del Admin); en la demo, a este navegador.
 */
function GalleryPieces({
  ctx,
  photos,
  albums,
  changed,
  revision,
}: {
  ctx: AdminContext;
  photos: Photo[];
  albums: { id: string; title: string }[];
  changed: ReadonlySet<string>;
  /** Cambia cuando se suben fotos: se vuelve a leer lo compartido. */
  revision: number;
}) {
  const real = useMaybeRealAdmin();
  const sb = useAdminSupabase();
  const [shared, setShared] = useState<SharedPhotos>(NO_SHARED_PHOTOS);
  const [settings, setSettings] = useState<MediaSettings>(NO_MEDIA_SETTINGS);
  const [reads, setReads] = useState(0);
  const { status, busy, run } = useRun();

  useEffect(() => {
    let alive = true;
    void Promise.all([readSharedPhotos(), readMediaSettings()]).then(([s, m]) => {
      if (!alive) return;
      setShared(s);
      setSettings(m);
    });
    return () => {
      alive = false;
    };
  }, [reads, revision]);

  const sharedIds = new Set(shared.photos.map((p) => p.id));
  const all = [...photos.filter((p) => !sharedIds.has(p.id)), ...shared.photos];
  const pieces: MediaPiece[] = applyMediaSettings(all, settings).map((photo) => ({
    photo,
    uploaded: sharedIds.has(photo.id),
  }));
  const ids = pieces.map((p) => p.photo.id);
  const controls: MediaControls | null = real
    ? sb
      ? sharedMediaControls(sb)
      : null
    : localMediaControls(CODE_PIECES, (id) =>
        ctx.repo.admin.remove('photos', id, { reason: t('admin.photos.pieces.deleted') }),
      );

  const act: Act = (work, ok) => {
    if (!controls) return;
    void run(async () => {
      try {
        await work(controls);
      } catch (err) {
        throw real ? new Error(realErrorText(err)) : err;
      } finally {
        setReads((n) => n + 1);
      }
    }, ok);
  };
  const onHome = pieces.filter((p) => p.photo.selection).length;

  return (
    <div className="admin-card" data-testid="fotos-piezas">
      <h3>{t('admin.photos.pieces.title')}</h3>
      <p className="admin-meta">
        {t('admin.photos.pieces.lead', { limit: HOME_PHOTOS_LIMIT })}{' '}
        {real ? t('admin.photos.pieces.leadShared') : t('admin.photos.pieces.leadLocal')}
      </p>
      <p className="admin-meta" data-testid="fotos-piezas-cuenta">
        {t('admin.photos.pieces.count', { n: onHome, total: pieces.length })}
      </p>
      {real && !sb ? <p className="admin-meta">{t('admin.photos.pieces.noSession')}</p> : null}
      <StatusLine status={status} />
      <ul className="admin-list">
        {pieces.map((piece, i) => {
          const { photo, uploaded } = piece;
          return (
            <PieceRow
              key={photo.id}
              piece={piece}
              code={CODE_PIECES.has(photo.id)}
              first={i === 0}
              last={i === pieces.length - 1}
              disabled={busy || !controls}
              act={act}
              move={(delta) =>
                act((c) => c.order(movePiece(ids, photo.id, delta)), t('admin.photos.pieces.moved'))
              }
            >
              {!uploaded ? (
                <PhotoEdit
                  key={`${photo.id}|${photo.alt}|${photo.src}|${photo.albumId}`}
                  ctx={ctx}
                  photo={photos.find((p) => p.id === photo.id) ?? photo}
                  albums={albums}
                  changed={changed.has(photo.id)}
                />
              ) : null}
            </PieceRow>
          );
        })}
      </ul>
    </div>
  );
}

type SavePhotos = (input: SaveIslandPhotos) => Promise<void>;

/**
 * Fotos de una isla (plan 017 T189, decisión 4): se elige la isla y su
 * evento, se suben archivos de verdad (copia WebP de 1600 px como mucho) y,
 * marcado, el evento pasa a finalizado: la isla lo enseña como recuerdo con
 * su galería. Modo local: en este navegador; con cuentas: en Supabase.
 */
function IslandPhotoUpload({ ctx, onSaved }: { ctx: AdminContext; onSaved: () => void }) {
  const real = useMaybeRealAdmin();
  if (real) return <SharedIslandPhotoUpload ctx={ctx} onSaved={onSaved} />;
  return (
    <IslandPhotoForm
      ctx={ctx}
      shared={false}
      save={(input) => saveLocalIslandPhotos(ctx.actions, input, putLocalPhoto)}
      onSaved={onSaved}
    />
  );
}

function SharedIslandPhotoUpload({ ctx, onSaved }: { ctx: AdminContext; onSaved: () => void }) {
  const sb = useAdminSupabase();
  return (
    <IslandPhotoForm
      ctx={ctx}
      shared
      save={sb ? (input) => saveSharedIslandPhotos(sb, input) : null}
      onSaved={onSaved}
    />
  );
}

function IslandPhotoForm({
  ctx,
  shared,
  save,
  onSaved,
}: {
  ctx: AdminContext;
  shared: boolean;
  save: SavePhotos | null;
  onSaved: () => void;
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
            onSaved();
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

/** Galería (REQ-ADM-019; plan 019 T216, plan 048 T329): fotos y clips de la home, las islas y la Galería. */
export function PhotosSection({ ctx }: { ctx: AdminContext }) {
  const photos = useRead(ctx, (r) => r.content.list('photos'));
  const albums = useRead(ctx, (r) => r.content.list('albums'));
  const changed = useRead(ctx, (r) => r.admin.overridden('photos'));
  const [alt, setAlt] = useState('');
  const [albumTitle, setAlbumTitle] = useState('');
  const [uploads, setUploads] = useState(0);
  const { status, busy, run } = useRun();
  if (!photos || !albums) return <p>{t('empty.loading')}</p>;
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
      <IslandPhotoUpload ctx={ctx} onSaved={() => setUploads((n) => n + 1)} />
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
                  albumId: albums[0]?.id ?? 'album-boia', // REAL_ALBUM_ID (plan 048 T328)
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
      <GalleryPieces
        ctx={ctx}
        photos={photos}
        albums={albums}
        changed={new Set(changed ?? [])}
        revision={uploads + ctx.revision}
      />
    </section>
  );
}
