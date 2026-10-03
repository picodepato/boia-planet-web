'use client';

import type { CarnetView } from '@boia/store';
import { type ReactNode, useEffect, useState } from 'react';
import { t } from '../../i18n';
import { type CardFace, type CardView, IdCard } from './id-card';
import type { StampArt } from './id-card-model';
import { carnetPath } from './share';

/**
 * El Carnet BOIA tal como lo ven los demás (REQ-IDE-010…022): identidad
 * musical, no ficha ni estatus. Sirve igual para el propio (menú), el de
 * otra persona (desde su botella o el ranking) y la vista para compartir
 * (/carnet). Desde el plan 008 (T91, decisión 10) arriba va la tarjeta ID-1
 * (anverso con apodo, nº, rango, puntos, «Miembro desde» y el QR a su Carnet
 * público; reverso con los sellos), y debajo lo de siempre:
 *
 * - Cada respuesta va con su pregunta en pequeño y la respuesta en grande,
 *   nunca sin contexto (REQ-IDE-015); sólo las contestadas.
 * - Los sellos son una colección de recuerdos, no una lista de compras
 *   (REQ-IDE-022): en el reverso, sin importes ni números de entrada.
 * - Sin artistas vistos ni valoraciones (REQ-IDE-019).
 */

/** Lo que se ve si la moderación retiró la foto (textos-zonas, zona 18). muestra */
export const MODERATED_PHOTO = t('carnet.moderated.photo');

export function memberSinceLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).format(d);
}

export interface CarnetExtras {
  /** «Estilo · skin» del barco (sólo del propio: vive en este navegador). */
  shipLabel?: string | null;
  /** Nombre de cada cosmético por id. */
  cosmeticNames?: Readonly<Record<string, string>>;
  /** Nº de miembro (con cuentas); sin servidor, «—». */
  memberNumber?: number | null;
  /** Marcado como artista por el Admin (con cuentas, decisión 11). */
  isArtist?: boolean;
  /** Los sellos como se pintan, más recientes primero (`stampArtFor`). */
  stamps?: StampArt[];
}

function useOrigin(): string | null {
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

/** Lo que pinta la tarjeta de un Carnet. */
export function cardViewOf(
  carnet: CarnetView,
  extras: CarnetExtras,
  origin: string | null,
): CardView {
  return {
    userId: carnet.userId,
    nickname: carnet.nickname,
    memberNumber: extras.memberNumber ?? null,
    rank: carnet.rank?.name ?? null,
    points: carnet.points,
    memberSince: carnet.memberSince,
    avatarKey: carnet.avatarKey,
    avatarImage: carnet.avatarImage,
    photoModerated: carnet.moderated.photo,
    artist: !!carnet.artist || !!extras.isArtist,
    isSample: carnet.isSample,
    stamps:
      extras.stamps ??
      carnet.stamps.map((s) => ({
        eventId: s.eventId,
        name: s.eventName ?? s.eventId,
        date: s.grantedAt,
        image: null,
        sample: carnet.isSample,
      })),
    publicUrl: origin ? `${origin}${carnetPath(carnet.userId)}` : null,
    isMine: carnet.isMine,
  };
}

export function CarnetCard({
  carnet,
  extras = {},
  initialFace,
  fresh,
  pointsChange,
  controls,
  dark = false,
  onFaceChange,
}: {
  carnet: CarnetView;
  extras?: CarnetExtras;
  initialFace?: CardFace | undefined;
  /** El sello que acaba de caer (T91). */
  fresh?: string | null | undefined;
  pointsChange?: { from: number; to: number } | null | undefined;
  /** Lo que va bajo la tarjeta (botones del Carnet propio). */
  controls?: ReactNode | undefined;
  /** En una página oscura (/carnet, /sello). */
  dark?: boolean | undefined;
  onFaceChange?: ((face: CardFace) => void) | undefined;
}) {
  const origin = useOrigin();
  const card = cardViewOf(carnet, extras, origin);
  const cosmetics = carnet.cosmeticIds.filter(Boolean);
  const genres = carnet.artist?.genres ?? [];
  return (
    <article
      className={dark ? 'carnet is-on-dark' : 'carnet'}
      data-testid="carnet"
      aria-label={t('juego.carnetCard.carnetDe', { nickname: carnet.nickname })}
    >
      <div className={dark ? 'idc-wrap is-on-dark' : 'idc-wrap'}>
        <IdCard
          card={card}
          initialFace={initialFace}
          fresh={fresh ?? null}
          pointsChange={pointsChange ?? null}
          below={controls}
          onFaceChange={onFaceChange}
        />
      </div>
      {carnet.moderated.photo ? (
        <p className="carnet-moderated" data-testid="carnet-foto-retirada">
          {MODERATED_PHOTO}
        </p>
      ) : null}
      {/* El Carnet de un artista (T66): sus géneros, de su ficha. */}
      {genres.length > 0 ? (
        <p className="juego-carnet-generos" data-testid="carnet-generos">
          {t('lib.carnet.generos', { genres: genres.join(' · ') })}
        </p>
      ) : null}

      <section aria-label={t('juego.carnetCard.respuestas')}>
        <h4>{carnet.isMine ? t('carnet.section.answersOwn') : t('carnet.section.answers')}</h4>
        {carnet.answers.length === 0 ? (
          <p className="juego-muted">
            {carnet.isMine
              ? t('juego.carnetCard.aunNoHasContestado')
              : t('juego.carnetCard.aunSinRespuestas')}
          </p>
        ) : (
          <ul className="carnet-answers" data-testid="carnet-respuestas">
            {carnet.answers.map((a) => (
              <li key={a.questionId} data-moderada={a.moderated ? 'si' : undefined}>
                <p className="carnet-question">{a.question}</p>
                <p className={a.moderated ? 'carnet-answer carnet-moderated' : 'carnet-answer'}>
                  {a.answer}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Insignias de los logros reclamados (REQ-IDE-052, T37) y los logros. */}
      <section aria-label={t('carnet.section.badges')}>
        <h4>{t('carnet.section.badges')}</h4>
        {carnet.badges.length === 0 && carnet.achievements.length === 0 ? (
          <p className="juego-muted">
            {carnet.isMine
              ? t('juego.carnetCard.aunSinInsigniasAlgunos')
              : t('juego.carnetCard.aunSinInsignias')}
          </p>
        ) : null}
        {carnet.badges.length > 0 ? (
          <ul className="carnet-chips carnet-insignias" data-testid="carnet-insignias">
            {carnet.badges.map((b) => (
              <li key={b.key} data-testid={`carnet-insignia-${b.key}`}>
                🎖️ {b.title}
              </li>
            ))}
          </ul>
        ) : null}
        {carnet.achievements.length > 0 ? (
          <ul className="carnet-chips" data-testid="carnet-logros">
            {carnet.achievements.map((a) => (
              <li key={a.id} title={a.description ?? undefined}>
                🏅 {a.title}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-label={t('carnet.section.ship')}>
        <h4>{t('carnet.section.ship')}</h4>
        {extras.shipLabel ? <p data-testid="carnet-barco">⛵ {extras.shipLabel}</p> : null}
        {cosmetics.length > 0 ? (
          <ul className="carnet-chips" data-testid="carnet-cosmeticos">
            {cosmetics.map((id) => (
              <li key={id}>
                {extras.cosmeticNames?.[id] ?? id}
                {Object.values(carnet.equipped).includes(id) ? t('juego.carnetCard.equipado') : ''}
              </li>
            ))}
          </ul>
        ) : !extras.shipLabel ? (
          <p className="juego-muted">{t('carnet.empty.ship')}</p>
        ) : null}
      </section>
    </article>
  );
}
