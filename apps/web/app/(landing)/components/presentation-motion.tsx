'use client';

import { useEffect, useRef } from 'react';
import { PRESENTATION_VIDEO } from '../../../lib/landing/hero-media';
import { PRESENTATION, presentationFrame } from '../../../lib/landing/presentation';

/** Smoothing of the scroll position (time constant, ms): coarse wheels do not jump. */
const SMOOTH_MS = 70;
/** After the hero is at rest, how long the video waits, at most, for an idle moment. */
const PRELOAD_IDLE_MS = 2000;
/** `<html>` says the black covers the hero's scene (run.ts stops painting it). */
const COVERED = 'data-reel-covered';

/**
 * The motion of the presentation (`presentation.tsx`, plan 021 T235): reads
 * the scroll, writes the frame of `presentationFrame` as CSS variables on the
 * stage, and plays the video only while its window is on screen. The video
 * (poster and file) is asked for once the hero is at rest and the page idle,
 * or on the first scroll, whichever comes first. With reduced motion the
 * block is still (landing.css) and nothing here runs.
 */
export function PresentationMotion() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const reel = ref.current?.closest<HTMLElement>('.reel');
    const stage = reel?.querySelector<HTMLElement>('.reel__stage');
    const video = reel?.querySelector<HTMLVideoElement>('.reel__video');
    const html = document.documentElement;
    // The pin needs the boot script's mark (the CSS reads the same).
    if (!reel || !stage || !video || !html.hasAttribute('data-entry')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    video.muted = true;
    video.defaultMuted = true;

    let loaded = false;
    const load = () => {
      if (loaded) return;
      loaded = true;
      video.poster = PRESENTATION_VIDEO.poster;
      video.preload = 'auto';
      video.src = PRESENTATION_VIDEO.src;
    };
    let cancelIdle = () => {};
    const whenIdle = () => {
      if (loaded) return;
      if ('requestIdleCallback' in window) {
        const id = window.requestIdleCallback(load, { timeout: PRELOAD_IDLE_MS });
        cancelIdle = () => window.cancelIdleCallback(id);
      } else {
        const id = setTimeout(load, PRELOAD_IDLE_MS);
        cancelIdle = () => clearTimeout(id);
      }
    };
    // The hero at rest: its appearance has landed (the boot script's event).
    if (window.__boiaEntry?.landed !== null) whenIdle();
    else window.addEventListener('boia:landed', whenIdle, { once: true });

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
    let onScreen = true;
    let wantPlay = false;

    const syncPlay = () => {
      const play = wantPlay && onScreen && !document.hidden && loaded;
      if (play && video.paused) void video.play().catch(() => {});
      else if (!play && !video.paused) video.pause();
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
      if (at > 0) load();
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
      window.removeEventListener('boia:landed', whenIdle);
      document.removeEventListener('visibilitychange', syncPlay);
      io?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      cancelIdle();
      html.removeAttribute(COVERED);
      video.pause();
    };
  }, []);

  return <span ref={ref} hidden />;
}
