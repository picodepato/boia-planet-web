import type { CarnetView } from '@boia/store';
import { Avatar } from './avatar';
import { t } from '../../i18n';

/**
 * El Carnet BOIA tal como lo ven los demás (REQ-IDE-010…022): identidad
 * musical, no ficha ni estatus. Sirve igual para el propio (menú), el de
 * otra persona (desde su botella) y la vista para compartir (/carnet).
 *
 * - Cada respuesta va con su pregunta en pequeño y la respuesta en grande,
 *   nunca sin contexto (REQ-IDE-015); sólo las contestadas.
 * - Los sellos son una colección de recuerdos, no una lista de compras
 *   (REQ-IDE-022).
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
}

export function CarnetCard({ carnet, extras = {} }: { carnet: CarnetView; extras?: CarnetExtras }) {
  const since = memberSinceLabel(carnet.memberSince);
  const cosmetics = carnet.cosmeticIds.filter(Boolean);
  return (
    <article
      className="carnet"
      data-testid="carnet"
      aria-label={t('juego.carnetCard.carnetDe', { nickname: carnet.nickname })}
    >
      <header className="carnet-head">
        <Avatar avatarKey={carnet.avatarKey} image={carnet.avatarImage} name={carnet.nickname} />
        <div>
          <p className="carnet-kicker">
            {t('juego.carnetCard.carnetBoia', {
              v1: carnet.artist
                ? t('lib.carnet.artista')
                : carnet.isSample
                  ? t('juego.carnetCard.miembroDeMuestra')
                  : '',
            })}
          </p>
          <h3 className="carnet-name" data-testid="carnet-apodo">
            {carnet.nickname}
          </h3>
          {/* El Carnet de un artista (T66): sus géneros, de su ficha. */}
          {carnet.artist ? (
            <p className="juego-carnet-generos" data-testid="carnet-generos">
              {t('lib.carnet.generos', { genres: carnet.artist.genres.join(' · ') })}
            </p>
          ) : null}
          {since ? (
            <p className="carnet-since">{t('carnet.memberSince', { date: since })}</p>
          ) : null}
          {carnet.moderated.photo ? (
            <p className="carnet-moderated" data-testid="carnet-foto-retirada">
              {MODERATED_PHOTO}
            </p>
          ) : null}
        </div>
      </header>

      <dl className="carnet-stats">
        <div>
          <dt>{t('juego.carnetCard.rango')}</dt>
          <dd data-testid="carnet-rango">{carnet.rank?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('juego.carnetCard.puntos')}</dt>
          <dd data-testid="carnet-puntos">{carnet.points}</dd>
        </div>
        <div>
          <dt>{t('juego.carnetCard.sellos')}</dt>
          <dd>{carnet.stamps.length}</dd>
        </div>
      </dl>

      <section aria-label={t('juego.carnetCard.respuestas')}>
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

      <section aria-label={t('juego.carnetCard.sellos')}>
        <h4>{t('juego.carnetCard.sellos')}</h4>
        {carnet.stamps.length === 0 ? (
          <p className="juego-muted">{t('juego.carnetCard.aunSinSellosCada')}</p>
        ) : (
          <ul className="carnet-stamps" data-testid="carnet-sellos">
            {carnet.stamps.map((s) => (
              <li key={s.eventId} className="carnet-stamp">
                <span aria-hidden="true">✺</span>
                <span>{s.eventName ?? s.eventId}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Insignias de los logros reclamados (REQ-IDE-052, T37). */}
      <section aria-label={t('carnet.badges.heading')}>
        <h4>{t('carnet.badges.heading')}</h4>
        {carnet.badges.length === 0 ? (
          <p className="juego-muted">
            {carnet.isMine
              ? t('juego.carnetCard.aunSinInsigniasAlgunos')
              : t('juego.carnetCard.aunSinInsignias')}
          </p>
        ) : (
          <ul className="carnet-chips carnet-insignias" data-testid="carnet-insignias">
            {carnet.badges.map((b) => (
              <li key={b.key} data-testid={`carnet-insignia-${b.key}`}>
                🎖️ {b.title}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label={t('juego.carnetCard.logros')}>
        <h4>{t('juego.carnetCard.logros')}</h4>
        {carnet.achievements.length === 0 ? (
          <p className="juego-muted">{t('juego.carnetCard.aunSinLogros')}</p>
        ) : (
          <ul className="carnet-chips" data-testid="carnet-logros">
            {carnet.achievements.map((a) => (
              <li key={a.id} title={a.description ?? undefined}>
                🏅 {a.title}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label={t('juego.carnetCard.barco')}>
        <h4>{t('juego.carnetCard.barco')}</h4>
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
