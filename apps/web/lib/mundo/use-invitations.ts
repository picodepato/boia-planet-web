'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type CarnetInvitations,
  type InviteReason,
  browserInvitations,
  progressReason,
} from '../landing/invitations';
import { useRepoData } from './repo';

/** Cada cuánto se suma tiempo activo (pestaña a la vista y motor en marcha). */
const ACTIVE_TICK_S = 5;

/**
 * Invitaciones a crear el Carnet en /juego (REQ-IDE-008/009, T44). Los
 * momentos de compra y galería los dispara quien llama (`trigger`); los de
 * progreso (5 minutos activos, 3 logros) salen solos. Lo pedido espera a que
 * no haya carrera, diálogo, pago ni panel (`blocked`); el ritmo (una por
 * sesión, «Ahora no» para siempre) es `CarnetInvitations`.
 */
export function useCarnetInvitations({ running, blocked }: { running: boolean; blocked: boolean }) {
  const invRef = useRef<CarnetInvitations | null>(null);
  const [shown, setShown] = useState<InviteReason | null>(null);
  const [pending, setPending] = useState<readonly InviteReason[]>([]);
  const asked = useRef(new Set<InviteReason>());
  const [activeSeconds, setActiveSeconds] = useState(0);

  const { data: carnet } = useRepoData((r) => r.carnet.mine());
  const { data: obtained } = useRepoData(async (r) =>
    (await r.progress.achievements()).reduce((n, a) => n + (a.obtained ? 1 : 0), 0),
  );
  const hasCarnet = carnet === undefined ? null : carnet !== null;

  useEffect(() => {
    invRef.current = browserInvitations();
  }, []);

  const trigger = useCallback((reason: InviteReason) => {
    if (asked.current.has(reason)) return;
    asked.current.add(reason);
    setPending((p) => [...p, reason]);
  }, []);

  // Tiempo activo: sólo con la pestaña a la vista y el motor en marcha.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setActiveSeconds((s) => s + ACTIVE_TICK_S);
    }, ACTIVE_TICK_S * 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const progress = progressReason(activeSeconds, obtained ?? 0);
  useEffect(() => {
    if (progress) trigger(progress);
  }, [progress, trigger]);

  // Lo pedido sale cuando se puede; si el ritmo no lo deja, se descarta.
  useEffect(() => {
    const inv = invRef.current;
    const next = pending[0];
    if (!inv || !next || shown || hasCarnet === null || blocked) return;
    if (inv.offer(next, { hasCarnet, blocked })) setShown(next);
    setPending((p) => p.slice(1));
  }, [pending, shown, hasCarnet, blocked]);

  // Con Carnet (creado ahora mismo, por ejemplo) la tarjeta sobra.
  useEffect(() => {
    if (hasCarnet) setShown(null);
  }, [hasCarnet]);

  const decline = useCallback(() => {
    if (shown) invRef.current?.decline(shown);
    setShown(null);
  }, [shown]);
  const dismiss = useCallback(() => setShown(null), []);

  return { reason: shown, trigger, decline, dismiss };
}
