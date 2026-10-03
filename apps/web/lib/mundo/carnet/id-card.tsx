'use client';

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { t } from '../../i18n';
import { bump } from '../sound';
import { neutralAvatar } from './avatar';
import {
  type StampArt,
  backLayout,
  memberNumberLabel,
  mrzLines,
  nicknameTier,
  sinceShort,
} from './id-card-model';
import { QrCode } from './qr-code';
import { RubberStamp, stampLabel } from './stamp';
import './id-card.css';

/**
 * El Carnet BOIA como documento (plan 008, T91, decisión 10): una tarjeta
 * ID-1 (85,6 × 54) naranja con tinta negra (anverso) y una página de
 * pasaporte azulada con los sellos de las fiestas (reverso). Todo dentro se
 * mide en `cqw`, así escala como un solo objeto (diseño aprobado,
 * docs/propuestas/2026-10-03-carnet.md, «Card», «Front», «Back», «Flip»).
 *
 * - El botón «Ver sellos / Ver anverso» gira la tarjeta; tocar la tarjeta es
 *   un atajo. La cara oculta va `inert` y una región educada dice la cara.
 * - `fresh`: el sello que acaba de caer (se ve el reverso y cae con su
 *   animación; con movimiento reducido, un fundido).
 */

export interface CardView {
  userId: string;
  nickname: string;
  memberNumber: number | null;
  rank: string | null;
  points: number;
  memberSince: string;
  avatarKey: string | null;
  avatarImage: string | null;
  photoModerated: boolean;
  artist: boolean;
  /** Miembro de muestra: lleva el sobreimpreso «MUESTRA». */
  isSample: boolean;
  /** Más recientes primero. */
  stamps: StampArt[];
  /** El enlace del QR (el Carnet público); sin él, no hay QR. */
  publicUrl: string | null;
  isMine: boolean;
}

export type CardFace = 'front' | 'back';

function Front({ card }: { card: CardView }) {
  const avatar = neutralAvatar(card.avatarKey);
  const photo = card.photoModerated ? null : card.avatarImage;
  const [m1, m2] = mrzLines({
    number: card.memberNumber,
    nickname: card.nickname,
    since: card.memberSince,
    rank: card.rank,
    points: card.points,
  });
  return (
    <>
      <svg
        className="idc-guil"
        viewBox="0 0 100 63.08"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {WAVES.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
      <span className="idc-wm" aria-hidden="true" />
      <p className="idc-doc">
        {card.artist ? t('carnet.card.docArtist') : t('carnet.card.docMember')}
      </p>
      <dl className="idc-fields">
        <div className="idc-num">
          <dt>{t('carnet.card.number')}</dt>
          <dd data-testid="carnet-numero">{memberNumberLabel(card.memberNumber)}</dd>
        </div>
        <div className="idc-f idc-nick">
          <dt>{t('carnet.card.nickname')}</dt>
          <dd data-testid="carnet-apodo" data-tier={nicknameTier(card.nickname)}>
            {card.nickname}
          </dd>
        </div>
        <div className="idc-f idc-rank">
          <dt>{t('carnet.card.rank')}</dt>
          <dd data-testid="carnet-rango">{card.rank ?? '—'}</dd>
        </div>
        <div className="idc-f idc-since">
          <dt>{t('carnet.card.since')}</dt>
          <dd data-testid="carnet-desde">{sinceShort(card.memberSince)}</dd>
        </div>
        <div className="idc-f idc-pts">
          <dt>{t('carnet.card.points')}</dt>
          <dd data-testid="carnet-puntos" data-puntos={card.points}>
            {card.points.toLocaleString('es-ES')}
          </dd>
        </div>
      </dl>
      <div className="idc-photo" style={photo ? undefined : { background: avatar.bg }}>
        {photo ? (
          // Data URL o imagen propia: next/image no aporta nada aquí.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={t('juego.avatar.fotoDe', { name: card.nickname })} />
        ) : (
          <span
            role="img"
            aria-label={t('juego.avatar.avatarDe', { name: card.nickname, label: avatar.label })}
          >
            {avatar.glyph}
          </span>
        )}
      </div>
      <span className="idc-seal" aria-hidden="true" />
      {card.publicUrl ? (
        <div className="idc-qr">
          <QrCode
            text={card.publicUrl}
            label={
              card.isMine
                ? t('carnet.card.qrAlt')
                : t('carnet.card.qrAltOther', { nickname: card.nickname })
            }
          />
        </div>
      ) : null}
      <p className="idc-mrz" aria-hidden="true">
        {m1}
        <br />
        {m2}
      </p>
      {card.isSample ? (
        <span className="idc-specimen" aria-hidden="true">
          {t('carnet.card.specimen')}
        </span>
      ) : null}
    </>
  );
}

function countLabel(n: number): string {
  if (n === 0) return t('carnet.stamps.countNone');
  if (n === 1) return t('carnet.stamps.countOne');
  return t('carnet.stamps.countMany', { n });
}

function Back({ card, fresh }: { card: CardView; fresh: string | null }) {
  const { shown, more, empty } = backLayout(card.stamps);
  return (
    <>
      <svg
        className="idc-chart"
        viewBox="0 0 100 63.08"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {RHUMBS.map((l, i) => (
          <line key={i} {...l} />
        ))}
        <circle cx="86" cy="56" r="9" />
      </svg>
      <div className="idc-bh">
        <h4>{t('carnet.stamps.heading')}</h4>
        <span data-testid="carnet-sellos-cuenta">{countLabel(card.stamps.length)}</span>
      </div>
      <div className="idc-grid">
        <ul
          className="idc-stamps"
          data-testid="carnet-sellos"
          aria-label={t('carnet.stamps.listAria', { n: card.stamps.length })}
        >
          {shown.map((s) => (
            <li
              key={s.eventId}
              className={s.eventId === fresh ? 'idc-cell is-fresh' : 'idc-cell'}
              data-testid={`carnet-sello-${s.eventId}`}
            >
              <RubberStamp art={s} decorative />
              <span className="idc-sr">{stampLabel(s)}</span>
            </li>
          ))}
          {more > 0 ? (
            <li className="idc-cell" data-testid="carnet-sellos-mas">
              <span className="idc-more" aria-hidden="true">
                <b>{t('carnet.stamps.more', { n: more })}</b>
                <span>{t('carnet.stamps.moreLabel')}</span>
              </span>
              <span className="idc-sr">{t('carnet.stamps.moreAria', { n: more })}</span>
            </li>
          ) : null}
        </ul>
        {Array.from({ length: empty }, (_, i) => (
          <div key={i} className="idc-cell" aria-hidden="true">
            <span
              className={i === 0 && card.stamps.length === 0 ? 'idc-slot is-first' : 'idc-slot'}
            >
              {i === 0 && card.stamps.length === 0 ? t('carnet.stamps.firstSlot') : null}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

export function IdCard({
  card,
  initialFace = 'front',
  fresh = null,
  pointsChange = null,
  below,
  onFaceChange,
}: {
  card: CardView;
  initialFace?: CardFace | undefined;
  /** El sello que acaba de caer: se enseña el reverso y cae con su animación. */
  fresh?: string | null | undefined;
  /** «Puntos 240 → 290» en la fila de control tras un sello. */
  pointsChange?: { from: number; to: number } | null | undefined;
  /** Lo que va bajo la fila de control (botones del Carnet propio). */
  below?: ReactNode | undefined;
  /** Cada vez que cambia la cara que se ve. */
  onFaceChange?: ((face: CardFace) => void) | undefined;
}) {
  const [face, setFace] = useState<CardFace>(fresh ? 'back' : initialFace);
  const [announce, setAnnounce] = useState('');
  const id = useId();
  const lastFresh = useRef<string | null>(null);
  const onFace = useRef(onFaceChange);
  useEffect(() => {
    onFace.current = onFaceChange;
  });
  useEffect(() => {
    onFace.current?.(face);
  }, [face]);

  useEffect(() => {
    if (!fresh || lastFresh.current === fresh) return;
    lastFresh.current = fresh;
    setFace('back');
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      const timer = setTimeout(() => bump(0.5), 220);
      return () => clearTimeout(timer);
    }
  }, [fresh]);

  const flip = () => {
    const next = face === 'front' ? 'back' : 'front';
    setFace(next);
    setAnnounce(
      next === 'back'
        ? t('carnet.flip.announceBack', { n: card.stamps.length })
        : t('carnet.flip.announceFront'),
    );
  };

  return (
    <section
      className="idc"
      aria-label={t('carnet.card.aria', { nickname: card.nickname })}
      data-testid="carnet-tarjeta"
      data-cara={face}
    >
      <div
        id={`${id}-card`}
        className={`idc-flip${face === 'back' ? ' is-back' : ''}${fresh ? ' has-fresh' : ''}`}
        onClick={flip}
      >
        <div className="idc-face idc-front" inert={face !== 'front'} data-testid="carnet-anverso">
          <Front card={card} />
        </div>
        <div className="idc-face idc-back" inert={face !== 'back'} data-testid="carnet-reverso">
          <Back card={card} fresh={fresh} />
        </div>
      </div>
      <div className="idc-ctrl">
        <button
          type="button"
          className="idc-flipbtn"
          aria-controls={`${id}-card`}
          data-testid="carnet-girar"
          onClick={flip}
        >
          <span aria-hidden="true">↻</span>{' '}
          {face === 'front' ? t('carnet.flip.toBack') : t('carnet.flip.toFront')}
        </button>
        {pointsChange ? (
          <span className="idc-chip" data-testid="carnet-puntos-cambio">
            {t('stamp.pointsChip', { from: pointsChange.from, to: pointsChange.to })}
          </span>
        ) : null}
        <span className="idc-dots" aria-hidden="true">
          <i className={face === 'front' ? 'is-on' : undefined} />
          <i className={face === 'back' ? 'is-on' : undefined} />
        </span>
      </div>
      <p className="idc-sr" aria-live="polite">
        {announce}
      </p>
      {below}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Dibujo fijo: las olas del anverso y los rumbos del reverso.

const WAVES: string[] = Array.from({ length: 26 }, (_, k) => {
  const y0 = -6 + k * 2.9;
  let d = `M-2 ${y0}`;
  for (let x = -2; x <= 102; x += 2) {
    const y =
      y0 +
      1.5 * Math.sin((x / 15) * Math.PI * 2 + k * 0.42) +
      0.6 * Math.sin((x / 6.5) * Math.PI * 2 - k * 0.3);
    d += ` L${x} ${y.toFixed(2)}`;
  }
  return d;
});

const RHUMBS = Array.from({ length: 32 }, (_, i) => {
  const a = i * 11.25;
  const r = (a * Math.PI) / 180;
  return {
    x1: 86,
    y1: 56,
    x2: +(86 + 160 * Math.cos(r)).toFixed(2),
    y2: +(56 + 160 * Math.sin(r)).toFixed(2),
    className: a % 90 === 0 ? 'is-cardinal' : undefined,
  };
});
