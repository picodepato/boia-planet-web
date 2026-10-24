'use client';

import { useEffect, useRef } from 'react';
import {
  PRESENTATION_VIDEO,
  type PresentationViewer,
  presentationVideoSrc,
} from '../../../lib/landing/hero-media';
import {
  PRESENTATION,
  type ReelVideoMode,
  playBlocked,
  prepareInlineVideo,
  presentationFrame,
  reelVideoMode,
  reelVideoWanted,
} from '../../../lib/landing/presentation';

/** Smoothing of the scroll position (time constant, ms): coarse wheels do not jump. */
const SMOOTH_MS = 70;
/**
 * How long the scroll stays in the track before the video is asked for (plan
 * 048 T330): a smooth jump down the page crosses the track in ~0.3 s.
 */
const LOAD_DWELL_MS = 500;
/** `<html>` says the black covers the hero's scene (run.ts stops painting it). */
const COVERED = 'data-reel-covered';

/**
 * The motion of the presentation (`presentation.tsx`, plan 021 T235): reads
 * the scroll, writes the frame of `presentationFrame` as CSS variables on the
 * stage, and plays the video only while its window is on screen. The
 * `<video>` (poster and file) is created only when the page's scroll is inside
 * the track (`reelVideoWanted`) and stays there `LOAD_DWELL_MS` (plan 048
 * T330): loading the landing, or jumping past it, downloads nothing
 * (REQ-COM-032). With reduced motion the
 * block is still (landing.css) and nothing here runs.
 */
export function PresentationMotion() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const reel = ref.current?.closest<HTMLElement>('.reel');
    const stage = reel?.querySelector<HTMLElement>('.reel__stage');
    const box = reel?.querySelector<HTMLElement>('.reel__window');
    const html = document.documentElement;
    // The pin needs the boot script's mark (the CSS reads the same).
    if (!reel || !stage || !box || !html.hasAttribute('data-entry')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // The element shows only while its window is open (`reelVideoMode`).
    reel.dataset.video = 'off';

    let video: HTMLVideoElement | null = null;
    const load = () => {
      if (video) return;
      video = document.createElement('video');
      video.className = 'reel__video';
      video.loop = true;
      // Muted and inline as attributes before any `src` (iOS WebViews read them).
      prepareInlineVideo(video);
      video.addEventListener('error', block);
      box.append(video);
      video.poster = PRESENTATION_VIDEO.poster;
      video.preload = 'auto';
      // 720p or 1080p, decided here once: no switching mid-play (plan 043 T323).
      video.src = presentationVideoSrc({
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio,
        connection: (navigator as Navigator & { connection?: PresentationViewer['connection'] })
          .connection,
      });
    };
    let top = 0;
    let vh = 1;
    let vw = 1;
    const measure = () => {
      vh = window.innerHeight || 1;
      vw = window.innerWidth || 1;
      top = reel.getBoundingClientRect().top + window.scrollY;
    };
    measure();

    let target = 0;
    let p = -1;
    let tick = 0;
    let raf = 0;
    let dwell = 0;
    let onScreen = true;
    let wantPlay = false;
    // The video cannot play here: the window keeps the poster (landing.css).
    let blocked = false;
    let mode: ReelVideoMode = 'off';
    let last = { video: 0, playing: false };

    const show = () => {
      const next = reelVideoMode(last, blocked);
      if (next === mode) return;
      mode = next;
      reel.dataset.video = next;
    };
    function block() {
      if (blocked) return;
      blocked = true;
      wantPlay = false;
      if (video && !video.paused) video.pause();
      show();
    }

    const syncPlay = () => {
      if (!video) return;
      const play = wantPlay && !blocked && onScreen && !document.hidden;
      if (play && video.paused) {
        void video.play().catch((err: unknown) => {
          if (playBlocked(err)) block();
        });
      } else if (!play && !video.paused) video.pause();
    };

    const apply = (at: number) => {
      const f = presentationFrame(at, vw, vh);
      const s = stage.style;
      s.setProperty('--veil', f.veil.toFixed(3));
      s.setProperty('--lo', f.logoOpacity.toFixed(3));
      s.setProperty('--ls', f.logoScale.toFixed(4));
      s.setProperty('--lw', f.logoWhite.toFixed(3));
      s.setProperty('--vs', f.videoScale.toFixed(4));
      s.setProperty('--wt', `${f.window.top.toFixed(1)}px`);
      s.setProperty('--wr', `${f.window.right.toFixed(1)}px`);
      s.setProperty('--wb', `${f.window.bottom.toFixed(1)}px`);
      s.setProperty('--wl', `${f.window.left.toFixed(1)}px`);
      reel.dataset.stage = f.stage;
      const covered = at >= PRESENTATION.beats;
      if (covered !== html.hasAttribute(COVERED)) {
        html.toggleAttribute(COVERED, covered);
        // The hero's scene paints again (run.ts listens to the scroll).
        if (!covered) window.dispatchEvent(new Event('scroll'));
      }
      last = { video: f.video, playing: f.playing };
      show();
      wantPlay = f.playing;
      syncPlay();
    };

    const loop = (now: number) => {
      raf = 0;
      const dt = tick ? Math.min(100, now - tick) : 16;
      tick = now;
      const gap = target - p;
      p = Math.abs(gap) < 1e-3 || p < 0 ? target : p + gap * (1 - Math.exp(-dt / SMOOTH_MS));
      apply(p);
      if (p !== target) raf = requestAnimationFrame(loop);
      else tick = 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const read = () => {
      target = Math.max(0, (window.scrollY - top) / vh);
      // The page's scroll, not the smoothed one, and still in the track after
      // a moment: a (smooth) jump past the track loads nothing.
      if (!video && !dwell && reelVideoWanted(target)) {
        dwell = window.setTimeout(() => {
          dwell = 0;
          if (reelVideoWanted(target)) load();
        }, LOAD_DWELL_MS);
      }
      kick();
    };
    const onResize = () => {
      measure();
      read();
      // A new size moves the window: apply now, not only on the next scroll.
      p = -1;
    };

    const io =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(([e]) => {
            onScreen = !!e?.isIntersecting;
            syncPlay();
          })
        : null;
    io?.observe(stage);

    window.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', syncPlay);
    read();

    return () => {
      window.removeEventListener('scroll', read);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', syncPlay);
      io?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(dwell);
      html.removeAttribute(COVERED);
      if (video) {
        video.removeEventListener('error', block);
        video.pause();
        video.remove();
      }
      delete reel.dataset.video;
    };
  }, []);

  return <span ref={ref} hidden />;
}
