'use client';

import type { Settings } from '@boia/engine/ui';
import { useRef } from 'react';
import { CarnetPanel } from '../../lib/mundo/carnet/carnet-panel';
import { SoundAndLanguage } from '../../lib/mundo/menu/sections/ajustes';
import { SensitivityField } from '../../lib/mundo/menu/sections/controles';
import { WelcomeBody } from '../../lib/mundo/menu/sections/welcome';
import { t } from '../../lib/i18n';
import type { MarPanel } from './deep-link';
import { MarHoja } from './hoja';
import '../../lib/mundo/carnet/carnet.css';

/**
 * Lo que sólo tenía el Menú de a bordo del 2D, dentro del mar 3D (T55): Mi
 * Carnet (verlo y editarlo sin salir del mundo), Ajustes (sensibilidad del
 * giro, música, efectos e idioma), Controles y Welcome Aboard. Cada uno en
 * su hoja crema (`MarHoja`), como sección del menú del juego (T65) o con
 * `?menu=<panel>`.
 * Textos `muestra` [pendiente Álvaro].
 */
export function MarABordo({
  panel,
  settings,
  onSettings,
  onBottles,
  carnetCreate = false,
  onCarnetCreated,
  onClose,
  onMenu,
}: {
  panel: Exclude<MarPanel, 'logros'>;
  settings: Settings | null;
  onSettings: (change: (s: Settings) => Settings) => void;
  /** Abre la hoja de la botella propia (T56): echarla, editarla o retirarla. */
  onBottles?: () => void;
  /** Mi Carnet entra ya en el alta («Crear Carnet» de la compra, T66). */
  carnetCreate?: boolean;
  /** El Carnet se acaba de crear aquí (T66): la compra vuelve con su descuento. */
  onCarnetCreated?: () => void;
  onClose: () => void;
  /** Vuelve al menú del juego (T65): cada panel es una sección suya. */
  onMenu?: () => void;
}) {
  const body = useRef<HTMLDivElement>(null);
  const menu = onMenu ? { onMenu } : {};
  switch (panel) {
    case 'carnet':
      return (
        <MarHoja
          title={t('mar.client.miCarnet')}
          label={t('menu.carnet')}
          closeLabel={t('mar.hoja.cerrar', { title: t('menu.carnet') })}
          testId="mar-carnet"
          closeTestId="mar-carnet-cerrar"
          bodyRef={body}
          onClose={onClose}
          {...menu}
        >
          <CarnetPanel
            key={carnetCreate ? 'alta' : 'ver'}
            startEditing={carnetCreate}
            onTop={() => body.current?.scrollTo?.({ top: 0 })}
            {...(onBottles ? { onBottles } : {})}
            {...(onCarnetCreated ? { onCreated: onCarnetCreated } : {})}
          />
        </MarHoja>
      );
    case 'ajustes':
      return (
        <MarHoja
          title={t('mar.client.ajustes')}
          label={t('menu.settings')}
          closeLabel={t('mar.hoja.cerrar', { title: t('menu.settings') })}
          testId="mar-ajustes"
          closeTestId="mar-ajustes-cerrar"
          onClose={onClose}
          {...menu}
        >
          {settings ? (
            <>
              <SensitivityField
                value={settings.sensitivity}
                onChange={(sensitivity) => onSettings((s) => ({ ...s, sensitivity }))}
              />
              <SoundAndLanguage
                settings={settings}
                onChange={(patch) => onSettings((s) => ({ ...s, ...patch }))}
              />
            </>
          ) : null}
        </MarHoja>
      );
    case 'controles':
      return (
        <MarHoja
          title={t('mar.client.controles')}
          label={t('menu.controls')}
          closeLabel={t('mar.hoja.cerrar', { title: t('menu.controls') })}
          testId="mar-controles"
          closeTestId="mar-controles-cerrar"
          onClose={onClose}
          {...menu}
        >
          <h3>{t('controls.sail.heading')}</h3>
          <ul>
            <li>{t('controls.sail.touch')}</li>
            <li>{t('mar.controles.vueltaCorta')}</li>
            <li>{t('mar.controles.rumbo')}</li>
            <li>{t('mar.controles.teclado')}</li>
          </ul>
          <h3>{t('mar.controles.mapaYZoom')}</h3>
          <ul>
            <li>{t('mar.controles.mapa')}</li>
            <li>{t('mar.controles.zoom')}</li>
          </ul>
          <p className="juego-muted">{t('mar.controles.sensibilidad')}</p>
        </MarHoja>
      );
    case 'bienvenida':
      return (
        <MarHoja
          title={t('mar.client.bienvenida')}
          label={t('menu.welcome')}
          closeLabel={t('mar.hoja.cerrar', { title: t('menu.welcome') })}
          testId="mar-bienvenida"
          closeTestId="mar-bienvenida-cerrar"
          onClose={onClose}
          {...menu}
        >
          {/* La boia de la entrada lo cuenta (T64): es lo primero al zarpar desde la landing. */}
          <div className="mar-bienvenida__boia" data-testid="mar-bienvenida-boia">
            <span className="mar-bienvenida__avatar" aria-hidden="true">
              <span className="mar-splash__boia" />
            </span>
            <p>{t('mar.bienvenida.boia')}</p>
          </div>
          <WelcomeBody
            tips={[t('welcome.tip.sail'), t('welcome.tip.island'), t('mar.bienvenida.entradas')]}
          />
          <button
            type="button"
            className="mar-btn mar-btn--primary mar-bienvenida__navegar"
            data-testid="mar-bienvenida-navegar"
            onClick={onClose}
          >
            {t('mar.bienvenida.aNavegar')}
          </button>
        </MarHoja>
      );
  }
}
