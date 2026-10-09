'use client';

import {
  type RadioCatalog,
  RadioCatalogError,
  type RadioSong,
  radioGenreCounts,
  sortedRadioSongs,
} from '@boia/contracts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type MessageKey, t } from '../../../lib/i18n';
import { forgetRadioCatalog, radioSongUrl } from '../../../lib/radio/catalog';
import { indexedDbRadioKV } from '../../../lib/radio/idb';
import { SAMPLE_RADIO_CATALOG } from '../../../lib/radio/muestra';
import { createSharedRadioStore } from '../../../lib/radio/shared-store';
import { type RadioAdminStore, createLocalRadioStore } from '../../../lib/radio/store';
import {
  SONG_UPLOAD_LIMITS,
  SongUploadError,
  checkSongFile,
  titleFromFileName,
} from '../../../lib/radio/upload';
import { useAdminSupabase, useMaybeRealAdmin } from '../real/common';
import type { AdminContext } from '../use-admin';
import { useRun } from '../use-admin';
import { Field, SectionHead, StatusLine } from '../ui';

/** Lo que se le dice al Admin de un error de la radio. */
function radioError(err: unknown): Error {
  if (err instanceof RadioCatalogError) {
    return new Error(t(`admin.radio.error.${err.code}` as MessageKey));
  }
  if (err instanceof SongUploadError) {
    return new Error(t(`admin.radio.upload.problem.${err.problem}` as MessageKey));
  }
  return err instanceof Error ? err : new Error(String(err));
}

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}`;
};

type Apply = (
  work: (store: RadioAdminStore) => Promise<RadioCatalog>,
  ok: string,
) => Promise<boolean>;

/**
 * La radio de la web (plan 022 T246): subir MP3 con su título, artista y
 * género; editar, reordenar, borrar y marcar la primera; y los géneros.
 * Demo: en este navegador (IndexedDB). Con cuentas: en Supabase.
 */
export function RadioSection(_props: { ctx: AdminContext }) {
  const real = useMaybeRealAdmin();
  const sb = useAdminSupabase();
  const store = useMemo<RadioAdminStore | null>(() => {
    if (!real) return createLocalRadioStore(indexedDbRadioKV);
    return sb ? createSharedRadioStore(sb) : null;
  }, [real, sb]);
  const [catalog, setCatalog] = useState<RadioCatalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { status, busy, run } = useRun();

  useEffect(() => {
    if (!store) return;
    let alive = true;
    store.catalog().then(
      (c) => alive && setCatalog(c),
      (err: unknown) => alive && setLoadError(radioError(err).message),
    );
    return () => {
      alive = false;
    };
  }, [store]);

  const apply = useCallback<Apply>(
    (work, ok) =>
      run(async () => {
        if (!store) return;
        try {
          setCatalog(await work(store));
          forgetRadioCatalog();
        } catch (err) {
          throw radioError(err);
        }
      }, ok),
    [run, store],
  );

  const shared = store?.kind === 'shared';
  return (
    <section data-testid="radio-admin">
      <SectionHead
        title={t('admin.radio.title')}
        lead={
          <>
            {t('admin.radio.lead')}{' '}
            {shared
              ? t('admin.radio.leadShared')
              : t('admin.radio.leadLocal', { n: SAMPLE_RADIO_CATALOG.songs.length })}
          </>
        }
      />
      {loadError ? (
        <p className="admin-status admin-status--error" role="alert">
          {t('admin.radio.loadError', { error: loadError })}
        </p>
      ) : !catalog ? (
        <p>{t('admin.radio.loading')}</p>
      ) : (
        <>
          <p className="admin-meta" data-testid="radio-resumen">
            {t('admin.radio.summary', {
              songs: catalog.songs.length,
              genres: catalog.genres.length,
              minutes: Math.round(catalog.songs.reduce((n, s) => n + s.durationSeconds, 0) / 60),
            })}
          </p>
          <StatusLine status={status} />
          <div className="admin-radio__top">
            <UploadForm catalog={catalog} apply={apply} busy={busy} />
            <GenresCard catalog={catalog} apply={apply} busy={busy} />
          </div>
          <SongList catalog={catalog} apply={apply} busy={busy} />
        </>
      )}
    </section>
  );
}

function UploadForm({
  catalog,
  apply,
  busy,
}: {
  catalog: RadioCatalog;
  apply: Apply;
  busy: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [genreId, setGenreId] = useState(catalog.genres[0]?.id ?? '');
  const [first, setFirst] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const genre = catalog.genres.some((g) => g.id === genreId) ? genreId : catalog.genres[0]?.id;
  return (
    <form
      className="admin-card admin-form"
      data-testid="radio-subir"
      onSubmit={(e) => {
        e.preventDefault();
        const name = title.trim();
        void apply(
          async (store) => {
            if (!file) throw new Error(t('admin.radio.upload.needFile'));
            if (!name || !artist.trim()) throw new Error(t('admin.radio.upload.needFields'));
            const durationSeconds = await checkSongFile(file);
            const next = await store.addSong({
              title: name,
              artist: artist.trim(),
              genreId: genre ?? '',
              durationSeconds,
              file,
              first,
            });
            setFile(null);
            setTitle('');
            setFirst(false);
            setInputKey((k) => k + 1);
            return next;
          },
          t('admin.radio.upload.done', { title: name }),
        );
      }}
    >
      <h3>{t('admin.radio.upload.title')}</h3>
      <Field label={t('admin.radio.upload.file')} hint={t('admin.radio.upload.fileHint')}>
        <input
          key={inputKey}
          type="file"
          accept={SONG_UPLOAD_LIMITS.accept}
          data-testid="radio-subir-archivo"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            if (f && !title.trim()) setTitle(titleFromFileName(f.name));
          }}
        />
      </Field>
      <div className="admin-grid">
        <Field label={t('admin.radio.upload.songTitle')}>
          <input
            value={title}
            maxLength={120}
            data-testid="radio-subir-titulo"
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label={t('admin.radio.upload.artist')}>
          <input
            value={artist}
            maxLength={120}
            data-testid="radio-subir-artista"
            onChange={(e) => setArtist(e.target.value)}
          />
        </Field>
        <Field label={t('admin.radio.upload.genre')}>
          <select
            value={genre ?? ''}
            data-testid="radio-subir-genero"
            onChange={(e) => setGenreId(e.target.value)}
          >
            {catalog.genres.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <label className="admin-check">
        <input
          type="checkbox"
          checked={first}
          data-testid="radio-subir-primera"
          onChange={(e) => setFirst(e.target.checked)}
        />{' '}
        {t('admin.radio.upload.first')}
      </label>
      <div className="admin-row">
        <button
          type="submit"
          className="admin-button"
          disabled={busy || catalog.genres.length === 0}
          data-testid="radio-subir-enviar"
        >
          {busy ? t('admin.radio.upload.working') : t('admin.radio.upload.submit')}
        </button>
      </div>
    </form>
  );
}

function GenreRow({
  id,
  name,
  count,
  apply,
  busy,
}: {
  id: string;
  name: string;
  count: number;
  apply: Apply;
  busy: boolean;
}) {
  const [value, setValue] = useState(name);
  return (
    <li className="admin-radio__genre" data-testid={`radio-genero-${id}`}>
      <input
        value={value}
        maxLength={40}
        aria-label={t('admin.radio.genres.name')}
        onChange={(e) => setValue(e.target.value)}
      />
      <span className="admin-meta">{t('admin.radio.genres.count', { n: count })}</span>
      <button
        type="button"
        className="admin-button admin-button--ghost"
        disabled={busy || value.trim() === name}
        onClick={() => void apply((s) => s.renameGenre(id, value), t('admin.radio.genres.renamed'))}
      >
        {t('admin.radio.genres.rename')}
      </button>
      <button
        type="button"
        className="admin-button admin-button--ghost"
        disabled={busy || count > 0}
        title={count > 0 ? t('admin.radio.genres.deleteBlocked') : undefined}
        data-testid={`radio-genero-borrar-${id}`}
        onClick={() => void apply((s) => s.deleteGenre(id), t('admin.radio.genres.deleted'))}
      >
        {t('admin.radio.genres.delete')}
      </button>
    </li>
  );
}

function GenresCard({
  catalog,
  apply,
  busy,
}: {
  catalog: RadioCatalog;
  apply: Apply;
  busy: boolean;
}) {
  const [name, setName] = useState('');
  const counts = radioGenreCounts(catalog);
  return (
    <div className="admin-card admin-form" data-testid="radio-generos">
      <h3>{t('admin.radio.genres.title')}</h3>
      <p className="admin-meta">{t('admin.radio.genres.hint')}</p>
      <ul className="admin-list">
        {catalog.genres.map((g) => (
          <GenreRow
            key={`${g.id}|${g.name}`}
            id={g.id}
            name={g.name}
            count={counts.get(g.id) ?? 0}
            apply={apply}
            busy={busy}
          />
        ))}
      </ul>
      <form
        className="admin-row admin-row--end"
        onSubmit={(e) => {
          e.preventDefault();
          void apply(async (s) => {
            const next = await s.addGenre(name);
            setName('');
            return next;
          }, t('admin.radio.genres.added'));
        }}
      >
        <Field label={t('admin.radio.genres.newName')}>
          <input
            value={name}
            maxLength={40}
            data-testid="radio-genero-nuevo"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <button
          type="submit"
          className="admin-button"
          disabled={busy || !name.trim()}
          data-testid="radio-genero-crear"
        >
          {t('admin.radio.genres.add')}
        </button>
      </form>
    </div>
  );
}

function SongList({
  catalog,
  apply,
  busy,
}: {
  catalog: RadioCatalog;
  apply: Apply;
  busy: boolean;
}) {
  const [filter, setFilter] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const songs = sortedRadioSongs(catalog);
  const shown = filter ? songs.filter((s) => s.genreId === filter) : songs;
  const genreName = (id: string) => catalog.genres.find((g) => g.id === id)?.name ?? id;

  useEffect(() => () => audio.current?.pause(), []);

  const toggle = async (song: RadioSong) => {
    const a = (audio.current ??= new Audio());
    if (playing === song.id) {
      a.pause();
      setPlaying(null);
      return;
    }
    const url = await radioSongUrl(song);
    if (!url) return;
    a.src = url;
    a.onended = () => setPlaying(null);
    setPlaying(song.id);
    await a.play().catch(() => setPlaying(null));
  };

  return (
    <div data-testid="radio-canciones">
      <div className="admin-row admin-row--between">
        <h3>{t('admin.radio.songs.title')}</h3>
        <label className="admin-field admin-field--inline">
          <span className="admin-field__label">{t('admin.radio.songs.filter')}</span>
          <select
            value={filter}
            data-testid="radio-filtro"
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">{t('admin.radio.songs.all')}</option>
            {catalog.genres.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {shown.length === 0 ? <p className="admin-meta">{t('admin.radio.songs.empty')}</p> : null}
      <ol className="admin-list admin-radio__songs">
        {shown.map((s) => (
          <SongRow
            key={`${s.id}|${s.title}|${s.artist}|${s.genreId}`}
            song={s}
            total={songs.length}
            catalog={catalog}
            genreName={genreName(s.genreId)}
            playing={playing === s.id}
            onPlay={() => void toggle(s)}
            apply={apply}
            busy={busy}
          />
        ))}
      </ol>
    </div>
  );
}

function SongRow({
  song,
  total,
  catalog,
  genreName,
  playing,
  onPlay,
  apply,
  busy,
}: {
  song: RadioSong;
  total: number;
  catalog: RadioCatalog;
  genreName: string;
  playing: boolean;
  onPlay: () => void;
  apply: Apply;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist);
  const [genreId, setGenreId] = useState(song.genreId);
  const [to, setTo] = useState(String(song.order + 1));
  const isSample = song.src.startsWith('/radio/muestra/');
  return (
    <li
      className={`admin-card admin-radio__song${song.first ? ' admin-radio__song--first' : ''}`}
      data-testid={`radio-cancion-${song.id}`}
      data-first={song.first ? 'true' : undefined}
    >
      <div className="admin-radio__song-head">
        <span className="admin-radio__pos">
          {t('admin.radio.songs.position', { n: song.order + 1 })}
        </span>
        <span className="admin-radio__name">
          <strong>{song.title}</strong> — {song.artist}
        </span>
        <span className="admin-meta">
          {genreName} · {fmtTime(song.durationSeconds)}
          {isSample ? ` · ${t('admin.radio.songs.muestra')}` : ''}
        </span>
        {song.first ? <span className="admin-badge">{t('admin.radio.songs.first')}</span> : null}
      </div>
      {editing ? (
        <div className="admin-grid">
          <Field label={t('admin.radio.upload.songTitle')}>
            <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={t('admin.radio.upload.artist')}>
            <input value={artist} maxLength={120} onChange={(e) => setArtist(e.target.value)} />
          </Field>
          <Field label={t('admin.radio.upload.genre')}>
            <select value={genreId} onChange={(e) => setGenreId(e.target.value)}>
              {catalog.genres.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}
      <div className="admin-row">
        <button
          type="button"
          className="admin-button admin-button--ghost"
          aria-pressed={playing}
          onClick={onPlay}
        >
          {playing ? t('admin.radio.songs.stop') : t('admin.radio.songs.play')}
        </button>
        <button
          type="button"
          className="admin-button admin-button--ghost"
          disabled={busy || song.order === 0}
          aria-label={t('admin.radio.songs.up', { title: song.title })}
          onClick={() =>
            void apply((s) => s.moveSong(song.id, song.order - 1), t('admin.radio.songs.moved'))
          }
        >
          ↑
        </button>
        <button
          type="button"
          className="admin-button admin-button--ghost"
          disabled={busy || song.order >= total - 1}
          aria-label={t('admin.radio.songs.down', { title: song.title })}
          onClick={() =>
            void apply((s) => s.moveSong(song.id, song.order + 1), t('admin.radio.songs.moved'))
          }
        >
          ↓
        </button>
        <span className="admin-radio__move">
          <input
            type="number"
            min={1}
            max={total}
            value={to}
            aria-label={t('admin.radio.songs.moveTo')}
            onChange={(e) => setTo(e.target.value)}
          />
          <button
            type="button"
            className="admin-button admin-button--ghost"
            disabled={busy || Number(to) === song.order + 1 || !(Number(to) >= 1)}
            onClick={() =>
              void apply((s) => s.moveSong(song.id, Number(to) - 1), t('admin.radio.songs.moved'))
            }
          >
            {t('admin.radio.songs.move')}
          </button>
        </span>
        {!song.first ? (
          <button
            type="button"
            className="admin-button admin-button--ghost"
            disabled={busy}
            data-testid={`radio-primera-${song.id}`}
            onClick={() =>
              void apply(
                (s) => s.setFirst(song.id),
                t('admin.radio.songs.firstSet', { title: song.title }),
              )
            }
          >
            {t('admin.radio.songs.makeFirst')}
          </button>
        ) : null}
        {editing ? (
          <>
            <button
              type="button"
              className="admin-button"
              disabled={busy}
              onClick={() =>
                void apply(async (s) => {
                  const next = await s.updateSong(song.id, { title, artist, genreId });
                  setEditing(false);
                  return next;
                }, t('admin.radio.songs.saved'))
              }
            >
              {t('admin.radio.songs.save')}
            </button>
            <button
              type="button"
              className="admin-button admin-button--ghost"
              onClick={() => setEditing(false)}
            >
              {t('admin.radio.songs.cancel')}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="admin-button admin-button--ghost"
            data-testid={`radio-editar-${song.id}`}
            onClick={() => setEditing(true)}
          >
            {t('admin.radio.songs.edit')}
          </button>
        )}
        <button
          type="button"
          className="admin-button admin-button--danger"
          disabled={busy}
          data-testid={`radio-borrar-${song.id}`}
          onClick={() => {
            if (!window.confirm(t('admin.radio.songs.confirmDelete', { title: song.title })))
              return;
            void apply((s) => s.removeSong(song.id), t('admin.radio.songs.deleted'));
          }}
        >
          {t('admin.radio.songs.delete')}
        </button>
      </div>
    </li>
  );
}
