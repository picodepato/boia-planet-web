'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ShipCatalog } from '../../lib/barco/catalog';
import { ClaimBadge } from '../../lib/logros/claim-badge';
import type { WorldSummary } from '@boia/world';
import { MundosPicker } from '../../lib/mundo/menu/sections/mundos';
import { t } from '../../lib/i18n';
import { MOOD_IDS, MOOD_LABEL, type MoodId } from './engine/palette';
import { MarHoja } from './hoja';

/**
 * El menú del juego (T65, decisión de Hernán y Álvaro del 2026-10-02): un
 * solo menú con todo, abierto desde el botón de la izquierda (el icono de
 * logros). Cada sección (Logros, Mi Carnet, Barco, Mis códigos, Mi botella,
 * Ranking, Ajustes y «Cómo jugar»: Controles y Welcome Aboard) se abre en su
 * hoja con «‹ Menú» para volver; el momento del día y los mundos (plegados)
 * se eligen aquí mismo. En el móvil es una tarjeta de abajo; en escritorio, centrada.
 * Textos `muestra` [pendiente Álvaro].
 */

/** Las secciones del menú que se abren en su propia hoja. */
export const MENU_SECTIONS = [
  'logros',
  'carnet',
  'barco',
  'codigos',
  'botella',
  'ranking',
  'ajustes',
  'controles',
  'bienvenida',
] as const;
export type MenuSection = (typeof MENU_SECTIONS)[number];

/** El data-testid de cada sección en el menú (los de antes de T65 se quedan). */
export const MENU_TEST_ID: Record<MenuSection, string> = {
  logros: 'mar-menu-logros',
  carnet: 'mar-menu-carnet',
  barco: 'mar-barco',
  codigos: 'mar-mis-codigos',
  botella: 'mar-mi-botella',
  ranking: 'mar-ranking-abrir',
  ajustes: 'mar-menu-ajustes',
  controles: 'mar-menu-controles',
  bienvenida: 'mar-menu-bienvenida',
};

const MOOD_ICON: Record<MoodId, string> = { dia: '☀️', tarde: '🌅', noche: '🌙' };

function Tile({
  section,
  icon,
  label,
  onOpen,
  children,
}: {
  section: MenuSection;
  icon: string;
  label: string;
  onOpen: (section: MenuSection) => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className="mar-menu__tile"
      data-testid={MENU_TEST_ID[section]}
      data-seccion={section}
      aria-haspopup="dialog"
      onClick={() => onOpen(section)}
    >
      <span className="mar-menu__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="mar-menu__name">{label}</span>
      {children}
    </button>
  );
}

export function MarMenu({
  worldName,
  readyToClaim,
  mood,
  shipName,
  hasShips,
  worlds,
  worldId,
  worldPending,
  catalog,
  onOpen,
  onMood,
  onWorld,
  onClose,
}: {
  worldName: string;
  readyToClaim: number;
  mood: MoodId;
  /** El barco puesto, si lo hay (va junto a «Barco»). */
  shipName: string | null;
  hasShips: boolean;
  worlds: readonly WorldSummary[];
  worldId: string;
  worldPending: boolean;
  catalog: ShipCatalog | null;
  onOpen: (section: MenuSection) => void;
  onMood: (mood: MoodId) => void;
  onWorld: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <MarHoja
      title={
        <>
          <span className="mar-menu__logo">{t('mar.client.boia')}</span>{' '}
          <span className="mar-menu__world">
            {t('mar.client.mar3d', { v1: worldName ? ` · ${worldName}` : '' })}
          </span>
        </>
      }
      label={t('mar.menu.titulo')}
      closeLabel={t('mar.menu.cerrar')}
      testId="mar-menu"
      closeTestId="mar-menu-cerrar"
      className="mar-menu"
      onClose={onClose}
    >
      <nav className="mar-menu__grid" aria-label={t('mar.menu.titulo')}>
        <Tile section="logros" icon="🏆" label={t('mar.client.logros')} onOpen={onOpen}>
          <ClaimBadge count={readyToClaim} testId="mar-menu-logros-contador" />
        </Tile>
        <Tile section="carnet" icon="🪪" label={t('mar.menu.miCarnet')} onOpen={onOpen} />
        {hasShips ? (
          <Tile section="barco" icon="⛵" label={t('mar.tienda.barco')} onOpen={onOpen}>
            {shipName ? <small className="mar-menu__sub">{shipName}</small> : null}
          </Tile>
        ) : null}
        <Tile section="codigos" icon="🏷️" label={t('mar.menu.misCodigos')} onOpen={onOpen} />
        <Tile section="botella" icon="✉️" label={t('mar.menu.miBotella')} onOpen={onOpen} />
        <Tile section="ranking" icon="🏅" label={t('mar.menu.ranking')} onOpen={onOpen} />
        <Tile section="ajustes" icon="⚙️" label={t('mar.menu.ajustes')} onOpen={onOpen} />
      </nav>

      <section className="mar-menu__group" data-testid="mar-menu-como-jugar">
        <h3 className="mar-menu__label">{t('mar.menu.comoJugar')}</h3>
        <div className="mar-menu__row">
          <Tile section="controles" icon="🎮" label={t('mar.menu.controles')} onOpen={onOpen} />
          <Tile section="bienvenida" icon="⚓" label={t('mar.menu.bienvenida')} onOpen={onOpen} />
        </div>
      </section>

      <section className="mar-menu__group" data-testid="mar-menu-momento">
        <h3 className="mar-menu__label">{t('mar.client.momentoDelDia')}</h3>
        <div
          className="mar-menu__moods"
          role="radiogroup"
          aria-label={t('mar.client.momentoDelDia')}
        >
          {MOOD_IDS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={m === mood}
              className={`mar-menu__mood${m === mood ? ' is-on' : ''}`}
              data-testid={`mar-momento-${m}`}
              onClick={() => onMood(m)}
            >
              {MOOD_ICON[m]} {MOOD_LABEL[m]}
            </button>
          ))}
        </div>
      </section>

      {/* Plegado: la lista de mundos, con sus barcos, es lo más largo del menú. */}
      <details className="mar-menu__group mar-menu__mundos" data-testid="mar-menu-mundos">
        <summary data-testid="mar-menu-mundos-abrir">
          <span aria-hidden="true">🌍</span> {t('mar.client.mundos')}
          {worldName ? <small className="mar-menu__sub">{worldName}</small> : null}
        </summary>
        <MundosPicker
          worlds={worlds}
          current={worldId}
          pending={worldPending}
          catalog={catalog}
          onChoose={onWorld}
        />
      </details>

      <Link className="mar-menu__home" href="/" aria-label={t('mar.client.volverABoia')}>
        {t('mar.client.volverABoiaMenu')}
      </Link>
    </MarHoja>
  );
}
