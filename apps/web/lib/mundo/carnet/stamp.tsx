'use client';

import { useEffect, useId, useState } from 'react';
import { t } from '../../i18n';
import {
  STAMP_INKS,
  type StampArt,
  dayMonthYear,
  stampDateLabel,
  stampStyle,
} from './id-card-model';

/**
 * El sello de goma de una fiesta (plan 008, T91; aprobado por Hernán el
 * 2026-10-03: este aspecto ES el estilo de sello). Un SVG de 200 × 200 con
 * una de tres formas (redonda, rectangular, ovalada), una tinta, un giro y la
 * textura de tinta (un filtro: desplazamiento de 2,6 px para los bordes
 * temblones y un ruido de baja frecuencia que se come un poco de tinta).
 *
 * Con imagen del Admin (T94, subida o URL), la imagen va DENTRO del mismo
 * tratamiento: el marco y las letras de su forma alrededor de una ventana, la
 * imagen recortada a la ventana (`cover`), impresa en la tinta del sello en
 * pocos niveles, con la misma textura, opacidad y giro. Si la imagen falla,
 * el sello generado.
 */

const TITLE = 'stamp-t';
const BODY = 'stamp-b';

function useImageOk(src: string | null): boolean {
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!src || typeof Image === 'undefined') return;
    let live = true;
    const img = new Image();
    img.onerror = () => {
      if (live) setFailed(src);
    };
    img.src = src;
    return () => {
      live = false;
    };
  }, [src]);
  return !!src && failed !== src;
}

function InkDefs({ id, ink }: { id: string; ink: string }) {
  return (
    <defs>
      <filter id={`${id}-ink`} x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={3} result="n" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="n"
          scale={2.6}
          xChannelSelector="R"
          yChannelSelector="G"
          result="d"
        />
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.09"
          numOctaves={3}
          seed={8}
          result="n2"
        />
        <feColorMatrix
          in="n2"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.7 1.65"
          result="holes"
        />
        <feComposite in="d" in2="holes" operator="in" />
      </filter>
      <filter id={`${id}-tint`} colorInterpolationFilters="sRGB">
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.3 -0.59 -0.11 0 1.04"
          result="dark"
        />
        <feComposite in="dark" in2="SourceAlpha" operator="in" result="m" />
        <feComponentTransfer in="m" result="a">
          <feFuncA type="discrete" tableValues="0 0.2 0.75 1" />
        </feComponentTransfer>
        <feFlood floodColor={ink} />
        <feComposite in2="a" operator="in" />
      </filter>
    </defs>
  );
}

function fit(name: string, per: number, max: number): number {
  return Math.min(max, [...name].length * per);
}

/** Las letras y el marco del sello generado. */
function GeneratedBody({
  id,
  shape,
  ink,
  name,
  d,
  m,
  y,
  place,
}: {
  id: string;
  shape: string;
  ink: string;
  name: string;
  d: string;
  m: string;
  y: string;
  place: string;
}) {
  if (shape === 'rect') {
    return (
      <>
        <rect
          x="10"
          y="38"
          width="180"
          height="124"
          rx="12"
          fill="none"
          stroke={ink}
          strokeWidth="6"
        />
        <rect
          x="20"
          y="48"
          width="160"
          height="104"
          rx="6"
          fill="none"
          stroke={ink}
          strokeWidth="2"
        />
        <text
          className={TITLE}
          x="100"
          y="80"
          textAnchor="middle"
          fontSize="17"
          fill={ink}
          textLength={fit(name, 12.5, 140)}
          lengthAdjust="spacingAndGlyphs"
        >
          {name}
        </text>
        <line x1="34" y1="92" x2="166" y2="92" stroke={ink} strokeWidth="1.6" />
        <text className={TITLE} x="100" y="128" textAnchor="middle" fontSize="32" fill={ink}>
          {`${d}·${m}`}
        </text>
        <text
          className={BODY}
          x="100"
          y="146"
          textAnchor="middle"
          fontSize="11"
          letterSpacing="3"
          fill={ink}
        >
          {`${y} · ${place}`}
        </text>
      </>
    );
  }
  if (shape === 'oval') {
    return (
      <>
        <ellipse cx="100" cy="100" rx="94" ry="68" fill="none" stroke={ink} strokeWidth="5" />
        <ellipse
          cx="100"
          cy="100"
          rx="84"
          ry="58"
          fill="none"
          stroke={ink}
          strokeWidth="1.6"
          strokeDasharray="3 3"
        />
        <text
          className={TITLE}
          x="100"
          y="86"
          textAnchor="middle"
          fontSize="15"
          fill={ink}
          textLength={fit(name, 11.5, 136)}
          lengthAdjust="spacingAndGlyphs"
        >
          {name}
        </text>
        <text className={TITLE} x="100" y="122" textAnchor="middle" fontSize="30" fill={ink}>
          {`${d}·${m}`}
        </text>
        <text
          className={BODY}
          x="100"
          y="141"
          textAnchor="middle"
          fontSize="10.5"
          letterSpacing="3"
          fill={ink}
        >
          {y}
        </text>
      </>
    );
  }
  return (
    <>
      <defs>
        <path id={`${id}-t`} d="M 30 100 A 70 70 0 0 1 170 100" />
        <path id={`${id}-b`} d="M 36 104 A 64 64 0 0 0 164 104" />
      </defs>
      <circle cx="100" cy="100" r="92" fill="none" stroke={ink} strokeWidth="6" />
      <circle cx="100" cy="100" r="80" fill="none" stroke={ink} strokeWidth="2" />
      <circle cx="100" cy="100" r="46" fill="none" stroke={ink} strokeWidth="1.6" />
      <text className={TITLE} fontSize="14" fill={ink}>
        <textPath
          href={`#${id}-t`}
          startOffset="50%"
          textAnchor="middle"
          textLength={fit(name, 12.5, 176)}
          lengthAdjust="spacingAndGlyphs"
        >
          {name}
        </textPath>
      </text>
      <text className={BODY} fontSize="11" fill={ink} letterSpacing="4">
        <textPath href={`#${id}-b`} startOffset="50%" textAnchor="middle">
          {`${place} · ${y}`}
        </textPath>
      </text>
      <text className={TITLE} x="100" y="98" textAnchor="middle" fontSize="25" fill={ink}>
        {`${d}·${m}`}
      </text>
      <text className={BODY} x="100" y="120" textAnchor="middle" fontSize="12" fill={ink}>
        ✺
      </text>
    </>
  );
}

/** El marco, las letras y la ventana de la imagen de un sello con imagen. */
function ImageBody({
  id,
  shape,
  ink,
  name,
  full,
  place,
  image,
}: {
  id: string;
  shape: string;
  ink: string;
  name: string;
  full: string;
  place: string;
  image: string;
}) {
  const tint = `url(#${id}-tint)`;
  if (shape === 'rect') {
    return (
      <>
        <defs>
          <clipPath id={`${id}-c`}>
            <rect x="34" y="60" width="132" height="86" rx="4" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${id}-c)`}>
          <image
            href={image}
            x="34"
            y="60"
            width="132"
            height="86"
            preserveAspectRatio="xMidYMid slice"
            filter={tint}
          />
        </g>
        <rect
          x="12"
          y="20"
          width="176"
          height="160"
          rx="12"
          fill="none"
          stroke={ink}
          strokeWidth="6"
        />
        <rect
          x="22"
          y="30"
          width="156"
          height="140"
          rx="6"
          fill="none"
          stroke={ink}
          strokeWidth="2"
        />
        <text
          className={TITLE}
          x="100"
          y="50"
          textAnchor="middle"
          fontSize="15"
          fill={ink}
          textLength={fit(name, 11.5, 136)}
          lengthAdjust="spacingAndGlyphs"
        >
          {name}
        </text>
        <rect
          x="34"
          y="60"
          width="132"
          height="86"
          rx="4"
          fill="none"
          stroke={ink}
          strokeWidth="1.6"
        />
        <text
          className={BODY}
          x="100"
          y="163"
          textAnchor="middle"
          fontSize="11"
          fill={ink}
          textLength="140"
          lengthAdjust="spacingAndGlyphs"
        >
          {`${full} · ${place}`}
        </text>
      </>
    );
  }
  if (shape === 'oval') {
    return (
      <>
        <defs>
          <clipPath id={`${id}-c`}>
            <ellipse cx="100" cy="101" rx="56" ry="35" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${id}-c)`}>
          <image
            href={image}
            x="44"
            y="66"
            width="112"
            height="70"
            preserveAspectRatio="xMidYMid slice"
            filter={tint}
          />
        </g>
        <ellipse cx="100" cy="100" rx="94" ry="76" fill="none" stroke={ink} strokeWidth="5" />
        <ellipse
          cx="100"
          cy="100"
          rx="84"
          ry="66"
          fill="none"
          stroke={ink}
          strokeWidth="1.6"
          strokeDasharray="3 3"
        />
        <text
          className={TITLE}
          x="100"
          y="58"
          textAnchor="middle"
          fontSize="13"
          fill={ink}
          textLength={fit(name, 10, 110)}
          lengthAdjust="spacingAndGlyphs"
        >
          {name}
        </text>
        <ellipse cx="100" cy="101" rx="56" ry="35" fill="none" stroke={ink} strokeWidth="1.6" />
        <text
          className={BODY}
          x="100"
          y="152"
          textAnchor="middle"
          fontSize="10.5"
          letterSpacing="2.5"
          fill={ink}
        >
          {full}
        </text>
      </>
    );
  }
  return (
    <>
      <defs>
        <path id={`${id}-t`} d="M 30 100 A 70 70 0 0 1 170 100" />
        <path id={`${id}-b`} d="M 34 104 A 66 66 0 0 0 166 104" />
        <clipPath id={`${id}-c`}>
          <circle cx="100" cy="100" r="54" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-c)`}>
        <image
          href={image}
          x="46"
          y="46"
          width="108"
          height="108"
          preserveAspectRatio="xMidYMid slice"
          filter={tint}
        />
      </g>
      <circle cx="100" cy="100" r="92" fill="none" stroke={ink} strokeWidth="6" />
      <circle cx="100" cy="100" r="80" fill="none" stroke={ink} strokeWidth="2" />
      <circle cx="100" cy="100" r="56" fill="none" stroke={ink} strokeWidth="1.6" />
      <text className={TITLE} fontSize="14" fill={ink}>
        <textPath
          href={`#${id}-t`}
          startOffset="50%"
          textAnchor="middle"
          textLength={fit(name, 12, 150)}
          lengthAdjust="spacingAndGlyphs"
        >
          {name}
        </textPath>
      </text>
      <text className={BODY} fontSize="10.5" fill={ink} letterSpacing="2.5">
        <textPath href={`#${id}-b`} startOffset="50%" textAnchor="middle">
          {`${full} · ${place}`}
        </textPath>
      </text>
    </>
  );
}

/** El nombre accesible de un sello: «{event}, {date}». */
export function stampLabel(art: StampArt): string {
  return t('carnet.stamps.itemAria', { event: art.name, date: stampDateLabel(art.date) });
}

export function RubberStamp({
  art,
  className,
  decorative = false,
}: {
  art: StampArt;
  className?: string | undefined;
  /** Dentro de una lista que ya lo nombra: el SVG no se lee otra vez. */
  decorative?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const style = stampStyle(art.eventId);
  const ink = STAMP_INKS[style.ink];
  const name = art.name.toLocaleUpperCase('es-ES');
  const [d, m, y] = dayMonthYear(art.date) ?? ['··', '··', '····'];
  const place = t('carnet.stamps.place');
  const imageOk = useImageOk(art.image);
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img', 'aria-label': stampLabel(art) };
  return (
    <svg
      viewBox="0 0 200 200"
      className={className ? `stamp ${className}` : 'stamp'}
      data-shape={style.shape}
      data-ink={style.ink}
      data-imagen={art.image && imageOk ? 'si' : undefined}
      {...a11y}
    >
      <InkDefs id={id} ink={ink} />
      <g transform={`rotate(${style.rotation} 100 100)`} filter={`url(#${id}-ink)`} opacity={0.92}>
        {art.image && imageOk ? (
          <ImageBody
            id={id}
            shape={style.shape}
            ink={ink}
            name={name}
            full={`${d}·${m}·${y}`}
            place={place}
            image={art.image}
          />
        ) : (
          <GeneratedBody
            id={id}
            shape={style.shape}
            ink={ink}
            name={name}
            d={d}
            m={m}
            y={y}
            place={place}
          />
        )}
        {art.sample ? (
          <text
            className={BODY}
            x="100"
            y={style.shape === 'rect' && !(art.image && imageOk) ? 30 : 196}
            textAnchor="middle"
            fontSize="11"
            fill={ink}
            opacity={0.9}
          >
            {t('carnet.stamps.sample')}
          </text>
        ) : null}
      </g>
    </svg>
  );
}
