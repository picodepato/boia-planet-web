'use client';

import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';
import { ADMIN_COPY, ADMIN_PATH } from '../../admin/copy';
import { orderedSections } from './sections';
import type { MenuContext } from './types';
import { t } from '../../i18n';

/**
 * Menú de a bordo (§19, REQ-IDE-034): barra superior de iconos grandes, con
 * el título dentro de cada sección, tooltip en escritorio (`title`), icono
 * activo resaltado y separación antes de Controles y Ajustes. No para el
 * juego: el barco sigue en el agua detrás.
 */
export function OnboardMenu({ ctx, initial }: { ctx: MenuContext; initial?: string | undefined }) {
  const sections = orderedSections();
  const [activeId, setActiveId] = useState(
    sections.find((s) => s.id === initial)?.id ?? sections[0]!.id,
  );
  const active = sections.find((s) => s.id === activeId) ?? sections[0]!;
  const firstTool = sections.findIndex((s) => s.group === 'tools');
  const ref = useRef<HTMLElement>(null);
  // El foco entra en el menú: Escape lo cierra y el teclado no mueve el barco.
  useEffect(() => ref.current?.focus(), []);

  return (
    <div className="juego-overlay" onClick={ctx.close}>
      <section
        ref={ref}
        tabIndex={-1}
        className="juego-menu"
        role="dialog"
        aria-label={t('menu.aria')}
        data-testid="menu"
        onClick={(e) => e.stopPropagation()}
        // El teclado del menú no mueve el barco ni avanza bocadillos.
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') ctx.close();
        }}
      >
        <nav
          className="juego-menu-bar"
          role="tablist"
          aria-label={t('juego.onboardMenu.seccionesDelMenu')}
        >
          {sections.map((s, i) => (
            <Fragment key={s.id}>
              {i === firstTool && i > 0 ? (
                <span className="juego-menu-sep" aria-hidden="true" />
              ) : null}
              <button
                type="button"
                role="tab"
                id={`menu-tab-${s.id}`}
                aria-controls="menu-panel"
                aria-selected={s.id === active.id}
                aria-label={s.label}
                title={s.label}
                data-testid={`menu-${s.id}`}
                className={`juego-menu-icon${s.id === active.id ? ' is-active' : ''}`}
                onClick={() => setActiveId(s.id)}
              >
                <span aria-hidden="true">{s.icon}</span>
              </button>
            </Fragment>
          ))}
        </nav>
        <div
          className="juego-menu-body"
          role="tabpanel"
          id="menu-panel"
          aria-labelledby={`menu-tab-${active.id}`}
        >
          <header className="juego-sheet-head">
            <h2>{active.label}</h2>
            <button
              type="button"
              className="juego-close"
              onClick={ctx.close}
              aria-label={t('menu.close')}
            >
              ×
            </button>
          </header>
          <active.Component ctx={ctx} />
          {/* Versión de prueba (D-20, REQ-ADM-039): el Admin sin login, también desde el menú. */}
          <p style={{ margin: '20px 0 4px', fontSize: 13, opacity: 0.8 }}>
            <Link
              href={ADMIN_PATH}
              prefetch={false}
              data-testid="menu-probar-admin"
              title={ADMIN_COPY.tryAdminHint}
            >
              {ADMIN_COPY.tryAdmin}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
