'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ShipCatalog } from '../../lib/barco/catalog';
import { ClaimBadge } from '../../lib/logros/claim-badge';
import type { WorldSummary } from '@boia/world';
import { MenuIcon, type MenuIconName } from '../../lib/mundo/menu/icons';
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
 * Los iconos son la familia propia de BOIA (T114, `lib/mundo/menu/icons.tsx`),
 * siempre junto a su nombre en texto. Textos `muestra` [pendiente Álvaro].
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

/** El icono de cada sección (T114): uno distinto por sección; Welcome Aboard es la mascota. */
export const MENU_ICON: Record<MenuSection, MenuIconName> = {
  logros: 'logros',
  carnet: 'carnet',
  barco: 'barco',
  codigos: 'codigos',
  botella: 'botella',
  ranking: 'ranking',
  ajustes: 'ajustes',
  controles: 'controles',
  bienvenida: 'bienvenida',
};

/**
 * El icono del botón que abre el menú: el de Logros, porque lleva el número
 * de premios por reclamar (T65).
 */
export function MarMenuButtonIcon() {
  return <MenuIcon name={MENU_ICON.logros} />;
}

/** El icono de cada momento del día, junto a su nombre. */
const MOOD_ICON: Record<MoodId, MenuIconName> = { dia: 'dia', tarde: 'tarde', noche: 'noche' };

function Tile({
  section,
  label,
  onOpen,
  children,
}: {
  section: MenuSection;
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
        <MenuIcon name={MENU_ICON[section]} />
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
  game,
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
  /**
   * Con una partida del Cañón en pausa (T118): el aviso de que salir de la
   * página la termina y «Seguir jugando» (cierra el menú).
   */
  game?: { warning: string; resume: string } | undefined;
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
      {game ? (
        <section className="mar-menu__game" data-testid="mar-menu-partida" role="status">
          <p data-testid="mar-menu-aviso-partida">{game.warning}</p>
          <button
            type="button"
            className="mar-menu__resume"
            data-testid="mar-menu-seguir"
            onClick={onClose}
          >
            {game.resume}
          </button>
        </section>
      ) : null}
      <nav className="mar-menu__grid" aria-label={t('mar.menu.titulo')}>
        <Tile section="logros" label={t('mar.client.logros')} onOpen={onOpen}>
          <ClaimBadge count={readyToClaim} testId="mar-menu-logros-contador" />
        </Tile>
        <Tile section="carnet" label={t('mar.menu.miCarnet')} onOpen={onOpen} />
        {hasShips ? (
          <Tile section="barco" label={t('mar.tienda.barco')} onOpen={onOpen}>
            {shipName ? <small className="mar-menu__sub">{shipName}</small> : null}
          </Tile>
        ) : null}
        <Tile section="codigos" label={t('mar.menu.misCodigos')} onOpen={onOpen} />
        <Tile section="botella" label={t('mar.menu.miBotella')} onOpen={onOpen} />
        <Tile section="ranking" label={t('mar.menu.ranking')} onOpen={onOpen} />
        <Tile section="ajustes" label={t('mar.menu.ajustes')} onOpen={onOpen} />
      </nav>

      <section className="mar-menu__group" data-testid="mar-menu-como-jugar">
        <h3 className="mar-menu__label">{t('mar.menu.comoJugar')}</h3>
        <div className="mar-menu__row">
          <Tile section="controles" label={t('mar.menu.controles')} onOpen={onOpen} />
          <Tile section="bienvenida" label={t('mar.menu.bienvenida')} onOpen={onOpen} />
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
              <MenuIcon name={MOOD_ICON[m]} /> {MOOD_LABEL[m]}
            </button>
          ))}
        </div>
      </section>

      {/* Sin elección no hay entrada: con un solo mundo jugable (Arcilla) no se muestra «Mundos». */}
      {worlds.length > 1 ? (
        <details className="mar-menu__group mar-menu__mundos" data-testid="mar-menu-mundos">
          <summary data-testid="mar-menu-mundos-abrir">
            <MenuIcon name="mundos" /> {t('mar.client.mundos')}
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
      ) : null}

      <Link className="mar-menu__home" href="/" aria-label={t('mar.client.volverABoia')}>
        {t('mar.client.volverABoiaMenu')}
      </Link>
    </MarHoja>
  );
}
