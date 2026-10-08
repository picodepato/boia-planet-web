'use client';

import { musicLinkFrom } from '@boia/contracts';
import { useId } from 'react';
import { t } from '../../i18n';

/**
 * El paso del artista al crear su Carnet (plan 019 T217, decisión 10): el
 * enlace a su música. Uno, el que prefiera: Spotify, SoundCloud, Bandcamp o,
 * si no, Instagram. La plataforma sale del enlace y se dice al escribirlo;
 * en la lista de artistas es su botón.
 */
export function ArtistMusicField({
  value,
  invalid,
  onChange,
}: {
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const link = musicLinkFrom(value);
  const hint = `${id}-pista`;
  const status = `${id}-estado`;
  return (
    <div className="juego-field carnet-music" data-testid="carnet-musica">
      <label htmlFor={id}>{t('carnet.music.label')}</label>
      <input
        id={id}
        type="url"
        inputMode="url"
        name="musica"
        autoComplete="url"
        placeholder={t('carnet.music.placeholder')}
        data-testid="carnet-musica-input"
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={`${hint} ${status}`}
        onChange={(e) => onChange(e.target.value)}
      />
      <small id={hint} className="juego-muted">
        {t('carnet.music.hint')}
      </small>
      <p
        id={status}
        className={invalid ? 'carnet-error' : 'carnet-music-platform'}
        data-testid="carnet-musica-estado"
        data-platform={link && link !== 'invalid' ? link.platform : undefined}
        aria-live="polite"
      >
        {invalid
          ? t('carnet.music.invalid')
          : link && link !== 'invalid'
            ? t('carnet.music.detected', { platform: t(`artist.music.${link.platform}`) })
            : null}
      </p>
    </div>
  );
}
