'use client';

import { type CarnetBlockKey, esCarnetBloque } from '../../../lib/i18n/es-carnet-bloque';
import { ACCESS_COPY, CARNET_CREATE_HREF } from '../../../lib/landing/access';
import { landingText } from '../../../lib/landing/texts';

/** Sus textos, con el cambio del Admin («Textos y música») encima si lo hay. */
export const carnetText = (key: CarnetBlockKey): string => landingText(key) || esCarnetBloque[key];

/**
 * «Sácate el Carnet» (plan 030 T288): el Carnet es necesario para entrar en
 * una fiesta BOIA (y para comprar); con cuentas, al crearlo se aceptan las
 * noticias por email; en modo local (D-20, sin email) las noticias están en
 * el WhatsApp. Un botón para crearlo (el mismo destino que el checkout) y, al
 * lado, el WhatsApp de Contacto o del pie. La sección la pone `blocks.tsx`.
 */
export function CarnetInvite({
  whatsapp,
  accounts,
}: {
  whatsapp: string | null;
  accounts: boolean;
}) {
  return (
    <div className="section__inner">
      <div className="sheet-head">
        <h2 id="carnet-title" className="section__title sheet-head__title">
          {carnetText('carnetBlock.heading')}
        </h2>
      </div>
      <div className="carnet-invite__grid">
        <div>
          <p className="section__lead">{carnetText('carnetBlock.lead')}</p>
          <p className="section__lead" data-testid="carnet-noticias">
            {carnetText(accounts ? 'carnetBlock.news.accounts' : 'carnetBlock.news.local')}
          </p>
          <div className="carnet-invite__actions">
            <a className="button button--buy" href={CARNET_CREATE_HREF} data-testid="carnet-crear">
              {carnetText('carnetBlock.cta')}
            </a>
            {whatsapp ? (
              <a
                className="button"
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={ACCESS_COPY.whatsappAria}
                data-testid="carnet-whatsapp"
              >
                {ACCESS_COPY.whatsappCta} <span aria-hidden="true">↗</span>
              </a>
            ) : null}
          </div>
        </div>
        <div className="carnet-invite__perks">
          <h3>{carnetText('carnetBlock.perks')}</h3>
          <ul>
            <li>{carnetText('carnetBlock.perk.stamps')}</li>
            <li>{carnetText('carnetBlock.perk.discounts')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
