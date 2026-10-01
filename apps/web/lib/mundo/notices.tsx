'use client';

import { type Notice, NoticeQueue, type Rect, type ShownNotice } from '@boia/engine/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../i18n';

/**
 * Cola de avisos en React: la lógica es `NoticeQueue` (uno a la vez; con
 * `readable`, el tiempo de lectura de D-22, si no 4 s); aquí sólo hay un
 * temporizador al próximo cambio y el pintado del visible.
 */
export function useNoticeQueue(onShow: (n: Notice) => void, opts: { readable?: boolean } = {}) {
  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;
  const queueRef = useRef<NoticeQueue | null>(null);
  queueRef.current ??= new NoticeQueue({
    readable: opts.readable ?? false,
    onShow: (n) => onShowRef.current(n),
  });
  const [current, setCurrent] = useState<ShownNotice | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const sync = useCallback(() => {
    const q = queueRef.current!;
    window.clearTimeout(timer.current);
    setCurrent(q.update(performance.now()));
    const next = q.nextChangeAt();
    if (next !== null) {
      timer.current = window.setTimeout(sync, Math.max(0, next - performance.now()) + 5);
    }
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const push = useCallback(
    (n: Notice) => {
      queueRef.current!.push(n, performance.now());
      sync();
    },
    [sync],
  );

  const dismiss = useCallback(() => {
    queueRef.current!.dismiss(performance.now());
    sync();
  }, [sync]);

  return { current, push, dismiss };
}

const KIND_LABEL: Record<Notice['kind'], string> = {
  discovery: t('juego.notices.descubrimiento'),
  achievement: t('juego.notices.logro'),
  reward: t('juego.notices.recompensa'),
  info: t('juego.notices.aviso'),
};

/**
 * El aviso visible: arriba, azul marino y naranja (REQ-IDE-026). Tocarlo o
 * su × lo cierran (D-22).
 */
export function NoticeToast({
  shown,
  rect,
  onDismiss,
}: {
  shown: ShownNotice | null;
  rect: Rect;
  onDismiss: () => void;
}) {
  return (
    <div
      className="juego-notice-region"
      role="status"
      aria-live="polite"
      style={{ left: rect.x, top: rect.y, width: rect.w }}
    >
      {shown ? (
        <button
          key={`${shown.notice.id}@${shown.shownAt}`}
          type="button"
          data-testid="aviso"
          data-hud="aviso"
          data-kind={shown.notice.kind}
          className="juego-notice"
          style={{ minHeight: rect.h }}
          onClick={onDismiss}
        >
          <span className="juego-notice-kicker">{KIND_LABEL[shown.notice.kind]}</span>
          <span className="juego-notice-title">{shown.notice.title}</span>
          {shown.notice.body ? (
            <span className="juego-notice-body">{shown.notice.body}</span>
          ) : null}
        </button>
      ) : null}
      {shown ? (
        <button
          type="button"
          className="juego-notice-x"
          data-testid="aviso-cerrar"
          aria-label={t('juego.notices.cerrarAviso')}
          onClick={onDismiss}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
