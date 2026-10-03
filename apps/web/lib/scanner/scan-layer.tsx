'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gateSnapshot } from '../account/gate';
import { t } from '../i18n';
import type { ClaimOutcome } from '../mundo/carnet/claim';
import { outcomeCopy } from '../mundo/carnet/claim-copy';
import { decodeFrame, nativeQrDetector } from './decode';
import { parseSelloUrl, type SelloCode } from './sello-url';
import './scanner.css';

/**
 * La cámara de «Escanear sello» (plan 008, T91; T87, marcos 08–10): una capa
 * a pantalla completa sobre todo (el mar y su HUD, o la página), con la
 * cámara trasera, una ventana con esquinas naranjas y la lectura continua (sin
 * botón de disparo): `BarcodeDetector` si lo hay, si no el decodificador que
 * se carga ahora (`decode.ts`). Este módulo entero se carga con `import()` al
 * tocar «Escanear sello».
 *
 * - Antes del permiso (sólo si el navegador aún no lo sabe): por qué hace
 *   falta la cámara y la otra vía (la cámara del móvil abre el enlace).
 * - Permiso denegado o sin cámara: cómo activarlo y la otra vía.
 * - Al leer un sello: las esquinas se cierran, vibra 40 ms, la cámara se
 *   apaga y se reclama (`claim`, que pide la cuenta si hace falta).
 * - Errores (fuera de hora, ya lo tienes, no es un sello, sin red): una hoja
 *   crema sobre la cámara oscurecida, con una acción.
 *
 * Es un diálogo modal: el foco va a «Cancelar», Esc cierra y el foco vuelve a
 * quien lo abrió.
 */

type Phase =
  | { name: 'checking' }
  | { name: 'pre' }
  | { name: 'starting' }
  | { name: 'scanning' }
  | { name: 'found'; sello: SelloCode }
  | { name: 'error'; outcome: ClaimOutcome }
  | { name: 'denied' }
  | { name: 'nocamera' };

const SCAN_EVERY_MS = 160;
/** Lado máximo del fotograma que se decodifica sin `BarcodeDetector`. */
const DECODE_SIDE = 720;

function scanLayerRoot(): HTMLElement {
  const id = 'boia-escaner-capa';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
  return el;
}

async function cameraPermission(): Promise<PermissionState | 'unknown'> {
  try {
    const status = await navigator.permissions?.query({ name: 'camera' as PermissionName });
    return status?.state ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export interface ScanLayerProps {
  /** Reclama el sello leído (pide la cuenta si hace falta). */
  claim: (sello: SelloCode) => Promise<ClaimOutcome>;
  /** Concedido: la capa se cierra y el Carnet enseña el sello. */
  onGranted: (outcome: Extract<ClaimOutcome, { kind: 'granted' }>) => void;
  /** «Ver tus sellos» tras «Ya tienes este sello». */
  onSeeStamps: () => void;
  onClose: () => void;
}

export default function ScanLayer({ claim, onGranted, onSeeStamps, onClose }: ScanLayerProps) {
  const [phase, setPhase] = useState<Phase>({ name: 'checking' });
  const [torch, setTorch] = useState<{ available: boolean; on: boolean }>({
    available: false,
    on: false,
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const live = useRef(true);
  const opener = useRef<Element | null>(null);
  const [mounted, setMounted] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }, []);

  const close = useCallback(() => {
    stopCamera();
    onClose();
  }, [onClose, stopCamera]);

  const handleText = useCallback(
    async (text: string) => {
      const sello = parseSelloUrl(text);
      stopCamera();
      if (!sello) {
        setPhase({ name: 'error', outcome: { kind: 'invalid', event: null } });
        return;
      }
      try {
        navigator.vibrate?.(40);
      } catch {
        // sin vibración
      }
      setPhase({ name: 'found', sello });
      const outcome = await claim(sello);
      if (!live.current) return;
      if (outcome.kind === 'granted') {
        onGranted(outcome);
        onClose();
      } else if (outcome.kind === 'cancelled') {
        onClose();
      } else {
        setPhase({ name: 'error', outcome });
      }
    },
    [claim, onClose, onGranted, stopCamera],
  );

  const start = useCallback(async () => {
    setPhase({ name: 'starting' });
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase({ name: 'nocamera' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      if (!live.current) {
        stream.getTracks().forEach((tr) => tr.stop());
        return;
      }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
      setTorch({ available: !!caps.torch, on: false });
      setPhase({ name: 'scanning' });
    } catch (e) {
      const name = (e as { name?: string })?.name ?? '';
      if (name === 'NotAllowedError' || name === 'SecurityError') setPhase({ name: 'denied' });
      else setPhase({ name: 'nocamera' });
    }
  }, []);

  // Al abrir: ¿ya hay permiso?
  useEffect(() => {
    live.current = true;
    opener.current = document.activeElement;
    setMounted(true);
    void cameraPermission().then((state) => {
      if (!live.current) return;
      if (state === 'granted') void start();
      else if (state === 'denied') setPhase({ name: 'denied' });
      else setPhase({ name: 'pre' });
    });
    return () => {
      live.current = false;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [start]);

  // La cámara en el vídeo y la lectura continua.
  useEffect(() => {
    if (phase.name !== 'scanning') return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let detector: Awaited<ReturnType<typeof nativeQrDetector>> = null;
    const ready = nativeQrDetector().then((d) => {
      detector = d;
    });
    const tick = async () => {
      if (stopped) return;
      try {
        await ready;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          let text: string | null = null;
          if (detector) {
            const found = await detector.detect(video);
            text = found[0]?.rawValue ?? null;
          } else if (ctx) {
            const k = Math.min(1, DECODE_SIDE / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.round(video.videoWidth * k);
            canvas.height = Math.round(video.videoHeight * k);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            text = await decodeFrame({ data: img.data, width: img.width, height: img.height });
          }
          if (text && !stopped) {
            stopped = true;
            void handleText(text);
            return;
          }
        }
      } catch {
        // un fotograma que no se pudo leer: el siguiente
      }
      if (!stopped) timer = setTimeout(() => void tick(), SCAN_EVERY_MS);
    };
    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [phase.name, handleText]);

  // Foco: «Cancelar» o la acción de la hoja; Esc cierra (si no está la hoja de acceso).
  useEffect(() => {
    if (phase.name === 'error') actionRef.current?.focus();
    else cancelRef.current?.focus();
  }, [phase.name, mounted]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !gateSnapshot()) {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const on = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch({ available: true, on });
    } catch {
      setTorch({ available: false, on: false });
    }
  };

  const rescan = () => void start();

  if (!mounted) return null;

  const camera = phase.name === 'scanning' || phase.name === 'found' || phase.name === 'error';
  const blocked = phase.name === 'denied' || phase.name === 'nocamera';

  return createPortal(
    <div
      className={`escaner is-${phase.name}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('scan.dialog.aria')}
      data-testid="escaner"
      data-fase={phase.name}
    >
      {camera ? <video ref={videoRef} className="escaner-video" muted playsInline /> : null}
      {camera ? (
        <div className="escaner-window" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
      ) : null}

      <div className="escaner-top">
        <button
          type="button"
          className="escaner-round"
          aria-label={t('scan.close.aria')}
          onClick={close}
          data-testid="escaner-cerrar"
        >
          ×
        </button>
        {torch.available && phase.name === 'scanning' ? (
          <button
            type="button"
            className="escaner-round"
            aria-pressed={torch.on}
            aria-label={torch.on ? t('scan.torch.off') : t('scan.torch.on')}
            onClick={() => void toggleTorch()}
          >
            <span aria-hidden="true">🔦</span>
          </button>
        ) : null}
      </div>

      {phase.name === 'pre' ? (
        <div className="escaner-panel" data-testid="escaner-antes">
          <h2>{t('scan.pre.title')}</h2>
          <p>{t('scan.pre.body')}</p>
          <button
            type="button"
            className="escaner-primary"
            onClick={() => void start()}
            data-testid="escaner-abrir"
          >
            {t('scan.pre.open')}
          </button>
          <p className="escaner-alt">{t('scan.pre.alt')}</p>
        </div>
      ) : null}

      {phase.name === 'checking' || phase.name === 'starting' ? (
        <p className="escaner-hint" role="status">
          <span>{t('scan.starting')}</span>
        </p>
      ) : null}

      {phase.name === 'scanning' ? (
        <p className="escaner-hint">
          <b>{t('scan.aim.title')}</b>
          <span>{t('scan.aim.body')}</span>
        </p>
      ) : null}

      {phase.name === 'found' ? (
        <p className="escaner-hint" role="status" data-testid="escaner-encontrado">
          <b>{t('scan.found.title')}</b>
          <span>{t('scan.found.saving')}</span>
        </p>
      ) : null}

      {blocked ? (
        <div className="escaner-panel is-dark" role="alert" data-testid="escaner-bloqueado">
          <h2>{phase.name === 'denied' ? t('scan.denied.title') : t('scan.noCamera.title')}</h2>
          <p>{phase.name === 'denied' ? t('scan.denied.body') : t('scan.noCamera.body')}</p>
          {phase.name === 'denied' ? (
            <button type="button" className="escaner-primary" onClick={rescan}>
              {t('scan.retry')}
            </button>
          ) : null}
          <p className="escaner-alt">{t('scan.phoneAlt')}</p>
        </div>
      ) : null}

      {phase.name === 'error' ? (
        <ErrorSheet
          outcome={phase.outcome}
          actionRef={actionRef}
          onOk={close}
          onRescan={rescan}
          onSeeStamps={() => {
            onSeeStamps();
            close();
          }}
        />
      ) : null}

      {phase.name !== 'error' ? (
        <div className="escaner-bottom">
          <button
            ref={cancelRef}
            type="button"
            className="escaner-ghost"
            onClick={close}
            data-testid="escaner-cancelar"
          >
            {t('scan.cancel')}
          </button>
        </div>
      ) : null}
    </div>,
    scanLayerRoot(),
  );
}

function ErrorSheet({
  outcome,
  actionRef,
  onOk,
  onRescan,
  onSeeStamps,
}: {
  outcome: ClaimOutcome;
  actionRef: React.RefObject<HTMLButtonElement | null>;
  onOk: () => void;
  onRescan: () => void;
  onSeeStamps: () => void;
}) {
  const copy = outcomeCopy(outcome);
  return (
    <div
      className="escaner-sheet"
      role="alert"
      data-testid="escaner-error"
      data-motivo={outcome.kind}
    >
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
      {outcome.kind === 'already' ? (
        <>
          <button ref={actionRef} type="button" className="escaner-primary" onClick={onSeeStamps}>
            {t('carnet.stamps.seeAll')}
          </button>
          <button type="button" className="escaner-ghost is-ink" onClick={onRescan}>
            {t('stamp.rescan')}
          </button>
        </>
      ) : outcome.kind === 'early' || outcome.kind === 'late' || outcome.kind === 'local' ? (
        <button ref={actionRef} type="button" className="escaner-primary" onClick={onOk}>
          {t('stamp.err.ok')}
        </button>
      ) : (
        <button ref={actionRef} type="button" className="escaner-primary" onClick={onRescan}>
          {t('stamp.rescan')}
        </button>
      )}
    </div>
  );
}
