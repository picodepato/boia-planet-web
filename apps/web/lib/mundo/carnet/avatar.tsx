import { AVATAR_IMAGE_MAX } from '@boia/store';
import { t } from '../../i18n';

/**
 * Avatar del Carnet (REQ-IDE-010): uno neutro de una lista o una foto del
 * dispositivo. Los neutros no dicen nada de quien los lleva (ni género ni
 * edad): son motivos del mar sobre un color. muestra hasta que Álvaro los
 * apruebe y lleguen como arte.
 */

export interface NeutralAvatar {
  key: string;
  glyph: string;
  label: string;
  bg: string;
}

export const NEUTRAL_AVATARS: readonly NeutralAvatar[] = [
  { key: 'avatar-neutro-1', glyph: '🌊', label: t('juego.avatar.ola'), bg: '#1f6f8b' },
  { key: 'avatar-neutro-2', glyph: '🐚', label: t('juego.avatar.caracola'), bg: '#f26a1b' },
  { key: 'avatar-neutro-3', glyph: '⚓', label: t('juego.avatar.ancla'), bg: '#12233f' },
  { key: 'avatar-neutro-4', glyph: '🌙', label: t('juego.avatar.luna'), bg: '#5b4b8a' },
  { key: 'avatar-neutro-5', glyph: '☀️', label: t('juego.avatar.sol'), bg: '#e0a526' },
  { key: 'avatar-neutro-6', glyph: '🎧', label: t('juego.avatar.cascos'), bg: '#2f8f6f' },
];

export const DEFAULT_AVATAR = NEUTRAL_AVATARS[0]!;

export function neutralAvatar(key: string | null | undefined): NeutralAvatar {
  return NEUTRAL_AVATARS.find((a) => a.key === key) ?? DEFAULT_AVATAR;
}

export function Avatar({
  avatarKey,
  image,
  size = 72,
  name,
}: {
  avatarKey: string | null;
  image: string | null;
  size?: number;
  name: string;
}) {
  if (image) {
    return (
      // Data URL local: next/image no aporta nada aquí.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="carnet-avatar"
        src={image}
        alt={t('juego.avatar.fotoDe', { name })}
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    );
  }
  const a = neutralAvatar(avatarKey);
  return (
    <span
      className="carnet-avatar"
      role="img"
      aria-label={t('juego.avatar.avatarDe', { name, label: a.label })}
      style={{ width: size, height: size, background: a.bg, fontSize: size * 0.5 }}
    >
      {a.glyph}
    </span>
  );
}

/** Lado de la foto guardada, en px. */
export const PHOTO_SIDE = 256;

/**
 * Reduce una foto del dispositivo a un cuadrado de `PHOTO_SIDE` px en JPEG,
 * bajando la calidad hasta que quepa en el Carnet (`AVATAR_IMAGE_MAX`).
 */
export async function shrinkPhoto(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_SIDE;
  canvas.height = PHOTO_SIDE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('sin canvas 2d');
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    PHOTO_SIDE,
    PHOTO_SIDE,
  );
  bitmap.close();
  for (const q of [0.85, 0.7, 0.55, 0.4, 0.25]) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length <= AVATAR_IMAGE_MAX) return url;
  }
  throw new Error('foto demasiado grande');
}
