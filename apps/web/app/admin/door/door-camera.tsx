'use client';

import { useEffect, useRef, useState } from 'react';
import { t } from '../../../lib/i18n';
import { decodeFrame, nativeQrDetector } from '../../../lib/scanner/decode';

/**
 * La cámara del lector de la puerta (plan 019 T218, decisión 11): la trasera,
 * lectura continua (sin botón de disparo), `BarcodeDetector` si lo hay y si
 * no el decodificador pequeño (`jsqr`, que se carga ahora). A diferencia de
 * «Escanear sello» del Carnet, no se cierra al leer: tras cada Carnet espera
 * a que se selle, deja un respiro y sigue con el siguiente de la cola. El
 * mismo QR seguido no se lee dos veces.
 */

const SCAN_EVERY_MS = 160;
const DECODE_SIDE = 720;
/** Tras sellar, antes de leer el siguiente. */
const PAUSE_AFTER_MS = 1200;
/** El mismo QR delante de la cámara no se vuelve a leer en este tiempo. */
const SAME_QR_MS = 6000;

type CameraState = 'starting' | 'scanning' | 'denied' | 'nocamera';

export function DoorCamera({ onText }: { onText: (text: string) => Promise<void> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CameraState>('starting');
  const handler = useRef(onText);
  useEffect(() => {
    handler.current = onText;
  }, [onText]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const last = { text: '', at: 0 };
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('nocamera');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch (e) {
        const name = (e as { name?: string })?.name ?? '';
        setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'nocamera');
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((tr) => tr.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      void video.play().catch(() => {});
      setState('scanning');
      const detector = await nativeQrDetector();
      const tick = async () => {
        if (stopped) return;
        let wait = SCAN_EVERY_MS;
        try {
          if (video.readyState >= 2 && video.videoWidth > 0) {
            let text: string | null = null;
            if (detector) {
              text = (await detector.detect(video))[0]?.rawValue ?? null;
            } else if (ctx) {
              const k = Math.min(1, DECODE_SIDE / Math.max(video.videoWidth, video.videoHeight));
              canvas.width = Math.round(video.videoWidth * k);
              canvas.height = Math.round(video.videoHeight * k);
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              text = await decodeFrame({ data: img.data, width: img.width, height: img.height });
            }
            const now = Date.now();
            if (text && !(text === last.text && now - last.at < SAME_QR_MS)) {
              try {
                navigator.vibrate?.(40);
              } catch {
                // sin vibración
              }
              await handler.current(text);
              last.text = text;
              last.at = Date.now();
              wait = PAUSE_AFTER_MS;
            } else if (text) {
              last.at = now;
            }
          }
        } catch {
          // un fotograma que no se pudo leer: el siguiente
        }
        if (!stopped) timer = setTimeout(() => void tick(), wait);
      };
      void tick();
    };
    void start();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  return (
    <div className="puerta-camara" data-testid="puerta-camara" data-estado={state}>
      <video ref={videoRef} className="puerta-video" muted playsInline />
      {state === 'scanning' ? (
        <div className="puerta-ventana" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
      ) : null}
      {state === 'starting' ? (
        <p className="puerta-camara__aviso" role="status">
          {t('scan.starting')}
        </p>
      ) : null}
      {state === 'denied' || state === 'nocamera' ? (
        <p className="puerta-camara__aviso" role="alert" data-testid="puerta-camara-bloqueada">
          {state === 'denied' ? t('puerta.camera.denied') : t('puerta.camera.none')}
        </p>
      ) : null}
    </div>
  );
}
