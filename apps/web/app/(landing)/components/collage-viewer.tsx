'use client';

import type { Photo } from '@boia/contracts';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../../lib/i18n/web';
import type { Box } from '../../../lib/landing/collage-layout';
import {
  clipProgress,
  clipTime,
  keyAction,
  stepIndex,
  swipeAction,
  trapFocusTarget,
} from '../../../lib/landing/viewer-nav';
import { playBlocked, prepareInlineVideo } from '../../../lib/landing/presentation';
import { useMediaUrl } from '../../../lib/photo-image';
import { type Phase, Still, prefersReducedMotion } from './media-collage';
import './collage-viewer.css';

/**
 * El visor del collage (plan 019 T216; aparte desde plan 020 T234 para no
 * cargarlo en la ruta crítica de la landing): la pieza abierta crece desde
 * su sitio hasta el centro sobre un fondo oscuro (FLIP con la Web Animations
 * API) y, al cerrar, vuelve. Con «reducir movimiento», sin animación.
 *
 * Plan 029 T277: es también el visor a pantalla completa. Anterior y
 * siguiente (flechas de la pantalla, del teclado y deslizar de lado), cerrar
 * con ✕, Esc o deslizando hacia abajo, el foco atrapado dentro y, en un clip,
 * reproducir/pausar, sonido, barra de progreso y el póster mientras carga.
 * Un clip arranca mudo (los navegadores sólo dejan así, y más aún los
 * navegadores internos de Instagram y TikTok en iOS: `playsInline`, atributos
 * antes de `src`, `play()` rechazado = se queda en el póster, plan 026); el
 * sonido sólo se activa con un toque del usuario.
 */

/** Duraciones (ms) de abrir y cerrar; 0 con «reducir movimiento». */
const OPEN_MS = 460;
const CLOSE_MS = 420;
const EASE_OUT = 'cubic-bezier(0.2, 0.9, 0.25, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.6, 0, 0.3, 1)';

/** El tamaño de la pieza abierta: cabe en la pantalla con margen, sin deformarse. */
function fitted(photo: Pick<Photo, 'width' | 'height'>): Box {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxW = Math.max(120, vw - 32);
  const maxH = Math.max(120, vh - 112);
  const scale = Math.min(maxW / photo.width, maxH / photo.height);
  const width = Math.round(photo.width * scale);
  const height = Math.round(photo.height * scale);
  return { left: Math.round((vw - width) / 2), top: Math.round((vh - height) / 2), width, height };
}

/**
 * La transformación que lleva la pieza abierta (en `to`) a donde está en el
 * collage: centro con centro, escala por el tamaño sin girar (`offsetWidth`,
 * por la escala de la pieza) y el giro de la pieza.
 */
function fromPiece(el: HTMLElement, to: Box, rotate: number, scale: number): string {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2 - (to.left + to.width / 2);
  const cy = r.top + r.height / 2 - (to.top + to.height / 2);
  const sx = ((el.offsetWidth || r.width) * scale) / to.width;
  const sy = ((el.offsetHeight || r.height) * scale) / to.height;
  return `translate(${cx}px, ${cy}px) rotate(${rotate}deg) scale(${sx}, ${sy})`;
}

/** Los controles de un clip abierto (presentacional: el visor les da el estado). */
export function ClipBar({
  playing,
  muted,
  progress,
  current,
  duration,
  loading,
  onTogglePlay,
  onToggleSound,
  onSeek,
}: {
  playing: boolean;
  muted: boolean;
  progress: number;
  current: number;
  duration: number;
  loading: boolean;
  onTogglePlay: () => void;
  onToggleSound: () => void;
  onSeek: (fraction: number) => void;
}) {
  return (
    <div
      className="collage-viewer__bar"
      role="group"
      aria-label={t('gallery.clipControls')}
      data-testid="collage-visor-controles"
      data-no-swipe=""
    >
      <button
        type="button"
        className="collage-viewer__btn"
        aria-label={playing ? t('gallery.pause') : t('gallery.play')}
        aria-pressed={playing}
        data-testid="collage-visor-play"
        onClick={onTogglePlay}
      >
        <span
          className={playing ? 'collage-viewer__icon-pause' : 'collage-viewer__icon-play'}
          aria-hidden="true"
        />
      </button>
      <input
        type="range"
        className="collage-viewer__progress"
        min={0}
        max={1000}
        step={1}
        value={Math.round(progress * 1000)}
        aria-label={t('gallery.progress')}
        aria-valuetext={`${clipTime(current)} / ${clipTime(duration)}`}
        data-testid="collage-visor-progreso"
        data-cargando={loading ? '' : undefined}
        disabled={duration <= 0}
        onChange={(e) => onSeek(Number(e.currentTarget.value) / 1000)}
      />
      <span className="collage-viewer__time" aria-hidden="true">
        {clipTime(current)}
      </span>
      <button
        type="button"
        className="collage-viewer__btn"
        aria-label={muted ? t('gallery.soundOn') : t('gallery.soundOff')}
        aria-pressed={!muted}
        data-testid="collage-visor-sonido"
        data-silenciado={muted ? '' : undefined}
        onClick={onToggleSound}
      >
        <span
          className={muted ? 'collage-viewer__icon-mute' : 'collage-viewer__icon-sound'}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

/** Anterior y siguiente, con la posición («3 de 9») para quien no ve la pantalla. */
export function ViewerNav({
  index,
  total,
  onPrev,
  onNext,
}: {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (total < 2) return null;
  return (
    <>
      <button
        type="button"
        className="collage-viewer__nav collage-viewer__nav--prev"
        aria-label={t('gallery.prev')}
        data-testid="collage-visor-anterior"
        data-no-swipe=""
        onClick={onPrev}
      >
        <span aria-hidden="true" />
      </button>
      <button
        type="button"
        className="collage-viewer__nav collage-viewer__nav--next"
        aria-label={t('gallery.next')}
        data-testid="collage-visor-siguiente"
        data-no-swipe=""
        onClick={onNext}
      >
        <span aria-hidden="true" />
      </button>
      <p className="collage-viewer__count" role="status" data-testid="collage-visor-posicion">
        {t('gallery.position', { n: index + 1, total })}
      </p>
    </>
  );
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const noop = () => {};

/** La pieza abierta, sobre el fondo oscuro, con sus animaciones de abrir y cerrar. */
export default function CollageViewer({
  photos,
  photo,
  phase,
  rotate,
  scale,
  piece,
  onOpened,
  onClose,
  onClosed,
  onNavigate,
}: {
  /** Todas las piezas del collage, en su orden (para anterior y siguiente). */
  photos: readonly Photo[];
  photo: Photo;
  phase: Phase;
  rotate: number;
  scale: number;
  piece: () => HTMLElement | null;
  onOpened: () => void;
  onClose: () => void;
  onClosed: () => void;
  onNavigate: (id: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const figure = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const src = useMediaUrl(photo.src);
  const poster = useMediaUrl(photo.kind === 'video' ? photo.poster : undefined);
  const isClip = photo.kind === 'video' && !!src;

  const index = Math.max(
    0,
    photos.findIndex((p) => p.id === photo.id),
  );
  const total = photos.length;
  const canMove = phase === 'open' && total > 1;
  const go = useCallback(
    (dir: 1 | -1) => {
      if (!canMove) return;
      const target = photos[stepIndex(index, total, dir)];
      if (target && target.id !== photo.id) onNavigate(target.id);
    },
    [canMove, photos, index, total, photo.id, onNavigate],
  );

  // El estado del clip abierto. Empieza mudo; el sonido es cosa del usuario.
  const [muted, setMuted] = useState(true);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const [ready, setReady] = useState(false);
  /** Se pidió reproducir (solo o con el botón): hasta entonces no hay nada que cargar. */
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    setPlaying(false);
    setTime({ current: 0, duration: 0 });
    setReady(false);
    setWanted(false);
  }, [photo.id]);

  // Cargar y arrancar el clip (plan 026): mudo y en línea como atributos
  // antes de la `src`; arranca solo (en bucle) salvo con «reducir
  // movimiento». Un play() bloqueado (webviews de iOS, ahorro de datos) deja
  // el póster y el botón de reproducir; un AbortError (se cambió de clip) no
  // es un fallo. Al cambiar de clip o cerrar, el vídeo de antes se para y
  // suelta lo descargado (sin vídeos vivos fuera de la pantalla).
  useEffect(() => {
    const v = video.current;
    if (!v || !src) return;
    prepareInlineVideo(v);
    // El sonido que eligió el usuario en este visor sigue en el siguiente clip
    // (lo eligió con un toque); si el navegador no lo deja, vuelve a mudo.
    v.muted = mutedRef.current;
    v.src = src;
    if (!prefersReducedMotion()) {
      setWanted(true);
      v.play()?.catch((err: unknown) => {
        if (!playBlocked(err)) return;
        if (!v.muted) {
          v.muted = true;
          setMuted(true);
          v.play()?.catch(() => setWanted(false));
        } else setWanted(false);
      });
    }
    return () => {
      v.pause();
      v.removeAttribute('src');
      v.load();
    };
    // Al cambiar de clip, y cuando el vídeo llega a la pantalla (hasta que no hay
    // caja no se pinta): el sonido lo cambia el botón, con su propio gesto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.id, src, box === null]);

  const togglePlay = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      setWanted(true);
      v.play()?.catch(noop);
    } else v.pause();
  };
  const toggleSound = () => {
    const v = video.current;
    const next = !muted;
    setMuted(next);
    if (!v) return;
    v.muted = next;
    // Con sonido y en pausa, tocar el botón (un gesto) también reproduce.
    if (!next && v.paused) {
      setWanted(true);
      v.play()?.catch(noop);
    }
  };
  const seek = (fraction: number) => {
    const v = video.current;
    if (v && Number.isFinite(v.duration)) v.currentTime = fraction * v.duration;
  };

  // Dónde acaba la pieza abierta (y si cambia la pantalla, se recoloca).
  useLayoutEffect(() => {
    const place = () => setBox(fitted(photo));
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [photo]);

  // La página no se desplaza debajo; las teclas mueven el visor.
  const keys = useRef({ go, onClose, togglePlay, toggleSound });
  keys.current = { go, onClose, togglePlay, toggleSound };
  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof HTMLElement ? e.target : null;
      // En la barra de progreso las flechas buscan en el vídeo, no cambian de pieza.
      if (el?.tagName === 'INPUT' && e.key.startsWith('Arrow')) return;
      const onControl = !!el && (el.tagName === 'BUTTON' || el.tagName === 'INPUT');
      const action = keyAction(e.key, onControl);
      if (!action) return;
      // Las teclas del visor son sólo suyas: en /mar las flechas no mueven el
      // barco ni la M abre el mapa por debajo (se escucha en captura).
      e.stopPropagation();
      const k = keys.current;
      if (action === 'close') k.onClose();
      else if (action === 'next') k.go(1);
      else if (action === 'prev') k.go(-1);
      else if (action === 'toggle-play') {
        e.preventDefault();
        k.togglePlay();
      } else if (action === 'toggle-sound') k.toggleSound();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      html.style.overflow = before;
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);

  // El tabulador da la vuelta dentro del visor.
  const onTab = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const list = [...(root.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    const at = list.indexOf(document.activeElement as HTMLElement);
    const target = trapFocusTarget(e.shiftKey, at, list.length);
    if (!target) return;
    e.preventDefault();
    list[target === 'first' ? 0 : list.length - 1]?.focus();
  };

  // Deslizar: de lado cambia de pieza, hacia abajo cierra.
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    swiped.current = false;
    if ((e.target as HTMLElement).closest('[data-no-swipe]')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    if (!s || s.id !== e.pointerId) return;
    swipe.current = null;
    const action = swipeAction(e.clientX - s.x, e.clientY - s.y);
    if (!action || phase !== 'open') return;
    swiped.current = true;
    if (action === 'close') onClose();
    else go(action === 'next' ? 1 : -1);
  };
  const onPointerCancel = () => {
    swipe.current = null;
  };

  // Abrir: de la pieza del collage al centro, y el fondo se oscurece.
  useLayoutEffect(() => {
    if (phase !== 'opening' || !box) return;
    const el = figure.current;
    const from = piece();
    const ms = prefersReducedMotion() ? 0 : OPEN_MS;
    closeButton.current?.focus({ preventScroll: true });
    if (!el || !from || ms === 0 || typeof el.animate !== 'function') {
      onOpened();
      return;
    }
    backdrop.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: ms * 0.7,
      easing: 'linear',
      fill: 'both',
    });
    const a = el.animate(
      [{ transform: fromPiece(from, box, rotate, scale) }, { transform: 'none' }],
      {
        duration: ms,
        easing: EASE_OUT,
        fill: 'both',
      },
    );
    a.onfinish = onOpened;
    return () => {
      a.onfinish = null;
    };
    // Sólo al empezar a abrir (box cambia al girar la pantalla, y no hay que repetirlo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, box === null]);

  // Cerrar: vuelve a su sitio y el fondo se aclara.
  useLayoutEffect(() => {
    if (phase !== 'closing' || !box) return;
    const el = figure.current;
    const to = piece();
    const ms = prefersReducedMotion() ? 0 : CLOSE_MS;
    video.current?.pause();
    if (!el || !to || ms === 0 || typeof el.animate !== 'function') {
      onClosed();
      return;
    }
    el.getAnimations().forEach((x) => x.cancel());
    backdrop.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: ms,
      easing: 'linear',
      fill: 'both',
    });
    const a = el.animate(
      [{ transform: 'none' }, { transform: fromPiece(to, box, rotate, scale) }],
      {
        duration: ms,
        easing: EASE_IN_OUT,
        fill: 'both',
      },
    );
    a.onfinish = onClosed;
    return () => {
      a.onfinish = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={root}
      className="collage-viewer"
      // Un toque en la foto o el fondo deja el foco dentro (y el Tab, atrapado).
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={t('gallery.viewer', { alt: photo.alt })}
      data-testid="collage-visor"
      data-fase={phase}
      data-pieza={photo.id}
      data-tipo={isClip ? 'video' : 'image'}
      onKeyDown={onTab}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        ref={backdrop}
        className="collage-viewer__backdrop"
        onClick={() => {
          if (!swiped.current) onClose();
        }}
      />
      {box ? (
        <div
          ref={figure}
          className="collage-viewer__figure"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        >
          {isClip ? (
            <video
              key={photo.id}
              ref={video}
              className="collage-viewer__media"
              muted
              loop
              playsInline
              {...{ 'webkit-playsinline': '' }}
              disablePictureInPicture
              preload="none"
              poster={poster ?? undefined}
              aria-label={photo.alt}
              data-testid="collage-visor-video"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onLoadedMetadata={(e) => {
                // Se lee antes: dentro del actualizador `currentTarget` ya es null.
                const duration = e.currentTarget.duration || 0;
                setTime((x) => ({ ...x, duration }));
              }}
              onTimeUpdate={(e) =>
                setTime({
                  current: e.currentTarget.currentTime,
                  duration: e.currentTarget.duration || 0,
                })
              }
              onLoadedData={() => setReady(true)}
              onClick={() => {
                if (!swiped.current) togglePlay();
              }}
            />
          ) : (
            <Still photo={photo} index={0} className="collage-viewer__media" eager />
          )}
          {isClip && wanted && !ready ? (
            <span
              className="collage-viewer__loading"
              role="status"
              data-testid="collage-visor-cargando"
            >
              {t('gallery.loading')}
            </span>
          ) : null}
        </div>
      ) : null}
      <button
        ref={closeButton}
        type="button"
        className="collage-viewer__close"
        aria-label={t('gallery.close')}
        data-testid="collage-cerrar"
        data-no-swipe=""
        onClick={onClose}
      >
        <span aria-hidden="true" />
      </button>
      <ViewerNav index={index} total={total} onPrev={() => go(-1)} onNext={() => go(1)} />
      {isClip ? (
        <ClipBar
          playing={playing}
          muted={muted}
          progress={clipProgress(time.current, time.duration)}
          current={time.current}
          duration={time.duration}
          loading={wanted && !ready}
          onTogglePlay={togglePlay}
          onToggleSound={toggleSound}
          onSeek={seek}
        />
      ) : null}
    </div>,
    document.body,
  );
}
