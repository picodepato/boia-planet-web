'use client';

import { type ReactNode, type RefObject, useEffect, useRef } from 'react';
import { t } from '../../lib/i18n';

/**
 * Hoja crema por encima del mar (T37, T40, T55): Logros, la tienda «Barco»,
 * Mi Carnet, Ajustes, Controles y Welcome Aboard se abren aquí, sin salir del
 * mundo. Abajo en el móvil, centrada en escritorio. Escape, la × o tocar
 * fuera la cierran; las teclas no llegan al barco (escribir en el Carnet no
 * lo mueve) y mientras está abierta el barco no se gobierna.
 *
 * El menú del juego (T65) es una de estas hojas y cada sección suya (Logros,
 * Mi Carnet, Barco…) se abre en otra con «‹ Menú» arriba (`onMenu`), que
 * vuelve a él: «Mi Carnet», venga de donde venga, es el menú en su sección.
 */
export function MarHoja({
  title,
  label,
  closeLabel,
  testId,
  closeTestId,
  extra,
  bodyRef,
  className,
  onMenu,
  onClose,
  children,
}: {
  /** Título visible (con su icono). */
  title: ReactNode;
  /** Nombre accesible del diálogo. */
  label: string;
  closeLabel: string;
  testId: string;
  closeTestId: string;
  /** Algo más en la cabecera, junto a la ×. */
  extra?: ReactNode;
  bodyRef?: RefObject<HTMLDivElement | null>;
  /** Clase de más para la hoja. */
  className?: string;
  /** Sección del menú del juego (T65): «‹ Menú» vuelve a él. */
  onMenu?: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  // Sin desplazar el mar: la hoja entra animada desde abajo y el foco la «seguiría» (T56).
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  // Escape también cierra con el foco fuera de la hoja (p. ej. tras cambiar
  // de ver a editar el Carnet, el botón pulsado desaparece).
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="mar-logros" onClick={onClose}>
      <section
        ref={ref}
        tabIndex={-1}
        className={`mar-logros__sheet${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-testid={testId}
        data-seccion-menu={onMenu ? '' : undefined}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') onClose();
        }}
      >
        <header className="mar-logros__head">
          {onMenu ? (
            <button
              type="button"
              className="mar-logros__back"
              data-testid="mar-hoja-menu"
              aria-label={t('mar.menu.volver')}
              onClick={onMenu}
            >
              <span aria-hidden="true">‹</span> {t('mar.client.menu')}
            </button>
          ) : null}
          <h2>{title}</h2>
          {extra}
          <button
            type="button"
            className="mar-logros__x"
            data-testid={closeTestId}
            aria-label={closeLabel}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div ref={bodyRef} className="mar-logros__body">
          {children}
        </div>
      </section>
    </div>
  );
}
