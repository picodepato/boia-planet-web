'use client';

import type { RadioSong } from '@boia/contracts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { lcdTime, listedGenres, playable } from '../player-model';
import type { RadioState } from '../player';
import { GenreBar } from './genre-bar';
import { RadioIcon } from './radio-button';
import { t } from './t';
import { useRadio } from './use-radio';

/**
 * El reproductor (plan 022 T247), a la manera de los reproductores de
 * escritorio de finales de los 90 que Hernán pidió: un panel oscuro y
 * compacto con bisel, pantalla verde con el tiempo y el título que corre,
 * mandos pequeños, avance y volumen, y debajo la ventana de la lista, con
 * las canciones por género para elegir con el dedo. Dibujo propio, con los
 * colores de BOIA: nada copiado.
 *
 * Es un `role="dialog"` no modal: la página sigue debajo; Escape lo cierra.
 */

const ICON = {
  prev: 'M3 3h2v10H3zM13 3v10L6 8z',
  play: 'M4 2.5v11L13 8z',
  pause: 'M3.5 3h3.5v10H3.5zM9 3h3.5v10H9z',
  stop: 'M3 3h10v10H3z',
  next: 'M11 3h2v10h-2zM3 3v10l7-5z',
} as const;

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d={d} fill="currentColor" />
    </svg>
  );
}

const statusKey = (s: RadioState['status']) =>
  (
    ({
      idle: 'radio.estado.idle',
      loading: 'radio.estado.loading',
      playing: 'radio.estado.playing',
      paused: 'radio.estado.paused',
      stopped: 'radio.estado.stopped',
    }) as const
  )[s];

export function RadioWindow({ onClose }: { onClose: () => void }) {
  const [state, player] = useRadio();
  const [remaining, setRemaining] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const closeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const songs = useMemo(
    () => (state.catalog ? playable(state.catalog.songs, state.genreId) : []),
    [state.catalog, state.genreId],
  );
  const genres = useMemo(
    () => (state.catalog ? listedGenres(state.catalog.genres, state.catalog.songs) : []),
    [state.catalog],
  );
  const genreName = (id: string | null) =>
    id === null
      ? t('radio.generos.ninguno')
      : (state.catalog?.genres.find((g) => g.id === id)?.name ?? id);
  // Un género guardado que ya no sale en la barra cuenta como «Todos».
  const activeGenre = genres.some((g) => g.id === state.genreId) ? state.genreId : null;

  // La que suena, a la vista en la lista cuando cambia.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [state.song?.id, songs]);

  if (!player) return null;

  const song = state.song;
  const duration = state.duration || song?.durationSeconds || 0;
  const time = remaining ? lcdTime(duration - state.elapsed, true) : lcdTime(state.elapsed);
  const title = song ? `${song.title} - ${song.artist}` : t('radio.nada');
  const marquee = song ? `${title}  ***  ${title}  ***  ` : title;
  const repeatLabel =
    state.repeat === 'one'
      ? t('radio.repetir.una')
      : state.repeat === 'all'
        ? t('radio.repetir.todas')
        : t('radio.repetir.no');

  return (
    <section
      className="radio-win"
      role="dialog"
      aria-label={t('radio.titulo')}
      data-testid="radio-reproductor"
      data-status={state.status}
    >
      <header className="radio-win__bar">
        <span className="radio-win__stripes" aria-hidden="true" />
        <h2 className="radio-win__title">{t('radio.titulo')}</h2>
        <span className="radio-win__stripes" aria-hidden="true" />
        <button
          ref={closeRef}
          type="button"
          className="radio-win__x"
          aria-label={t('radio.cerrar')}
          data-testid="radio-cerrar"
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div className="radio-win__body">
        <div className="radio-lcd" aria-live="off">
          <span className="radio-lcd__status" aria-hidden="true">
            {state.status === 'playing' ? (
              <Glyph d={ICON.play} />
            ) : state.status === 'paused' ? (
              <Glyph d={ICON.pause} />
            ) : state.status === 'loading' ? (
              <span className="radio-lcd__dots">…</span>
            ) : (
              <Glyph d={ICON.stop} />
            )}
          </span>
          <button
            type="button"
            className="radio-lcd__time"
            aria-label={`${remaining ? t('radio.tiempo.queda') : t('radio.tiempo.pasado')}: ${time}. ${t('radio.tiempo.cambiar')}`}
            onClick={() => setRemaining((r) => !r)}
            data-testid="radio-tiempo"
          >
            {time}
          </button>
          <div className="radio-lcd__title" data-testid="radio-titulo">
            <span className="radio-lcd__scroll" data-static={song ? undefined : ''}>
              {marquee}
            </span>
          </div>
          <p className="radio-lcd__info">
            {state.error
              ? t('radio.error')
              : song
                ? t('radio.lcd.info', {
                    genero: genreName(song.genreId),
                    duracion: lcdTime(duration),
                  })
                : t(statusKey(state.status))}
          </p>
          <span className="radio-sr-only">{`${t(statusKey(state.status))}: ${title}`}</span>
        </div>

        <input
          className="radio-slider radio-slider--seek"
          type="range"
          min={0}
          max={Math.max(1, Math.round(duration * 10))}
          step={1}
          value={Math.min(Math.round(state.elapsed * 10), Math.round(duration * 10))}
          aria-label={t('radio.avance')}
          aria-valuetext={lcdTime(state.elapsed)}
          disabled={!song}
          onChange={(e) => player.seek(Number(e.target.value) / 10)}
          data-testid="radio-avance"
        />

        <div className="radio-transport">
          <button
            type="button"
            aria-label={t('radio.anterior')}
            onClick={() => void player.previous()}
          >
            <Glyph d={ICON.prev} />
          </button>
          <button
            type="button"
            className="radio-transport__play"
            aria-label={t('radio.play')}
            data-testid="radio-play"
            onClick={() => void player.play()}
          >
            <Glyph d={ICON.play} />
          </button>
          <button
            type="button"
            aria-label={t('radio.pausa')}
            data-testid="radio-pausa"
            onClick={() => player.pause()}
          >
            <Glyph d={ICON.pause} />
          </button>
          <button type="button" aria-label={t('radio.stop')} onClick={() => player.stop()}>
            <Glyph d={ICON.stop} />
          </button>
          <button
            type="button"
            aria-label={t('radio.siguiente')}
            data-testid="radio-siguiente"
            onClick={() => void player.next()}
          >
            <Glyph d={ICON.next} />
          </button>
          <span className="radio-transport__gap" />
          <button
            type="button"
            className="radio-toggle"
            role="switch"
            aria-checked={state.shuffle}
            aria-label={t('radio.aleatorio')}
            title={t('radio.aleatorio')}
            data-testid="radio-aleatorio"
            onClick={() => player.setShuffle(!state.shuffle)}
          >
            <span aria-hidden="true">⤨</span>
          </button>
          <button
            type="button"
            className="radio-toggle"
            data-repeat={state.repeat}
            aria-label={`${t('radio.repetir')}: ${repeatLabel}`}
            title={repeatLabel}
            data-testid="radio-repetir"
            onClick={() => player.cycleRepeat()}
          >
            <span aria-hidden="true">{state.repeat === 'one' ? '↻1' : '↻'}</span>
          </button>
        </div>

        <label className="radio-volume">
          <RadioIcon playing={state.status === 'playing'} />
          <input
            className="radio-slider radio-slider--volume"
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(state.volume * 100)}
            aria-label={t('radio.volumen')}
            onChange={(e) => player.setVolume(Number(e.target.value) / 100)}
            data-testid="radio-volumen"
          />
        </label>
      </div>

      <header className="radio-win__bar radio-win__bar--list">
        <span className="radio-win__stripes" aria-hidden="true" />
        <h3 className="radio-win__title">{t('radio.lista.titulo')}</h3>
        <span className="radio-win__stripes" aria-hidden="true" />
        <button
          type="button"
          className="radio-win__x"
          aria-expanded={listOpen}
          aria-controls="radio-lista"
          aria-label={listOpen ? t('radio.lista.plegar') : t('radio.lista.desplegar')}
          onClick={() => setListOpen((o) => !o)}
        >
          <span aria-hidden="true">{listOpen ? '▾' : '▴'}</span>
        </button>
      </header>

      <div id="radio-lista" className="radio-list" hidden={!listOpen}>
        <GenreBar genres={genres} active={activeGenre} onPick={(id) => player.setGenre(id)} />
        <ol ref={listRef} className="radio-list__songs" aria-label={t('radio.lista.aria')}>
          {songs.length === 0 ? (
            <li className="radio-list__empty">{t('radio.lista.vacia')}</li>
          ) : (
            songs.map((s, i) => (
              <SongRow
                key={s.id}
                index={i + 1}
                song={s}
                current={s.id === song?.id}
                onPick={() => void player.playSong(s.id)}
              />
            ))
          )}
        </ol>
      </div>
    </section>
  );
}

function SongRow({
  index,
  song,
  current,
  onPick,
}: {
  index: number;
  song: RadioSong;
  current: boolean;
  onPick: () => void;
}) {
  const duration = lcdTime(song.durationSeconds);
  return (
    <li>
      <button
        type="button"
        className="radio-song"
        aria-current={current ? 'true' : undefined}
        aria-label={`${t('radio.cancion.aria', { titulo: song.title, artista: song.artist, duracion: duration })}${current ? `. ${t('radio.cancion.sonando')}` : ''}`}
        data-testid="radio-cancion"
        onClick={onPick}
      >
        <span className="radio-song__n" aria-hidden="true">
          {index}.
        </span>
        <span className="radio-song__name" aria-hidden="true">
          {song.title} - {song.artist}
        </span>
        <span className="radio-song__len" aria-hidden="true">
          {duration}
        </span>
      </button>
    </li>
  );
}
