'use client';

import type { CSSProperties } from 'react';
import { INVITE_COPY, type InviteReason } from '../../landing/invitations';
import './carnet-invite.css';

/**
 * Tarjeta «Crear mi Carnet» (REQ-IDE-008, T44). No es modal ni roba el foco:
 * el mar (o la landing) sigue debajo. Explica por qué en ese momento, dice
 * los límites del progreso local (REQ-IDE-007) y siempre deja «Ahora no».
 * En la landing «Crear mi Carnet» es un enlace; en /juego abre Mi Carnet.
 */
export function CarnetInvite({
  reason,
  create,
  onLater,
  style,
  className,
}: {
  reason: InviteReason;
  create: { href: string } | { onCreate: () => void };
  onLater: () => void;
  style?: CSSProperties;
  className?: string;
}) {
  const copy = INVITE_COPY[reason];
  const titleId = `invitacion-carnet-${reason}`;
  return (
    <section
      className={`carnet-invite${className ? ` ${className}` : ''}`}
      aria-labelledby={titleId}
      data-testid="invitacion-carnet"
      data-motivo={reason}
      style={style}
    >
      <p className="carnet-invite__kicker">{INVITE_COPY.label}</p>
      <h2 id={titleId} className="carnet-invite__title">
        {copy.title}
      </h2>
      <p className="carnet-invite__body">{copy.body}</p>
      <p className="carnet-invite__limit" data-testid="aviso-progreso-local">
        {INVITE_COPY.localLimit}
      </p>
      <div className="carnet-invite__actions">
        {'href' in create ? (
          <a className="carnet-invite__create" href={create.href} data-testid="invitacion-crear">
            {INVITE_COPY.create}
          </a>
        ) : (
          <button
            type="button"
            className="carnet-invite__create"
            data-testid="invitacion-crear"
            onClick={create.onCreate}
          >
            {INVITE_COPY.create}
          </button>
        )}
        <button
          type="button"
          className="carnet-invite__later"
          data-testid="invitacion-ahora-no"
          onClick={onLater}
        >
          {INVITE_COPY.later}
        </button>
      </div>
    </section>
  );
}
