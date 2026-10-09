'use client';

import type { FunnelEventProps } from '@boia/contracts/analytics';
import { type ComponentType, useEffect, useState } from 'react';
import { track } from '../../../lib/analytics';

type PanelSource = FunnelEventProps['tickets_panel_open']['source'];
type ExploreSource = FunnelEventProps['explore_start']['source'];
type ClickOutSource = FunnelEventProps['ticket_click_out']['source'];

const PANEL_HASH = '#tickets';
/** Past the hero: the dive is over (viewport heights of scroll). */
const PAST_HERO = 0.97;

/**
 * Mejora progresiva de la landing: analítica del embudo y panel de Tickets
 * (abrir, cerrar, foco, Escape, Atrás), que también funcionan, más tosco,
 * sin JavaScript; y la radio (plan 022 T247), que sólo existe con él: su
 * botón arriba a la derecha y junto a «Entradas», el reproductor perezoso y
 * el aviso «Sonando». Nada de esto entra en la ruta crítica de la landing.
 */
type RadioMountProps = { surface: 'landing' | 'mar' };

/**
 * The radio (plan 022 T247) in its own chunk, shared with `/mar` (both ask
 * for the same module): requested on idle, or at the first gesture, whichever
 * comes first, never in the landing's critical path. Its button comes with
 * it; the catalog only comes later, on idle or at the first tap.
 */
function useRadioMount(): ComponentType<RadioMountProps> | null {
  const [Mount, setMount] = useState<ComponentType<RadioMountProps> | null>(null);
  useEffect(() => {
    let gone = false;
    let asked = false;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const gestures = ['pointerdown', 'keydown'] as const;
    const ask = () => {
      if (asked) return;
      asked = true;
      for (const g of gestures) window.removeEventListener(g, ask, true);
      void import('../../../lib/radio/ui/radio-mount').then(
        (m) => {
          if (!gone) setMount(() => m.RadioMount);
        },
        (err: unknown) => console.warn('[boia] no cargó la radio', err),
      );
    };
    for (const g of gestures) window.addEventListener(g, ask, true);
    const id = w.requestIdleCallback
      ? w.requestIdleCallback(ask, { timeout: 1500 })
      : window.setTimeout(ask, 300);
    return () => {
      gone = true;
      for (const g of gestures) window.removeEventListener(g, ask, true);
      if (w.cancelIdleCallback) w.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  }, []);
  return Mount;
}

export function LandingClient() {
  const RadioMount = useRadioMount();
  useEffect(() => {
    const root = document.documentElement;
    const panel = document.getElementById('tickets');
    const title = document.getElementById('tickets-title');
    const background = ['.site-header', '#contenido', '.site-footer']
      .map((s) => document.querySelector<HTMLElement>(s))
      .filter((el): el is HTMLElement => el !== null);
    if (!panel) return;

    // A partir de aquí manda la clase `is-open`, no :target.
    root.classList.add('js');

    let open = false;
    let pushedByUs = false;
    let opener: HTMLElement | null = null;

    const show = (source: PanelSource) => {
      if (open) return;
      open = true;
      panel.classList.add('is-open');
      for (const el of background) el.inert = true;
      root.classList.add('panel-open');
      title?.focus();
      track('tickets_panel_open', { source });
    };

    const hide = () => {
      if (!open) return;
      open = false;
      panel.classList.remove('is-open');
      for (const el of background) el.inert = false;
      root.classList.remove('panel-open');
      opener?.focus();
      opener = null;
    };

    const requestClose = () => {
      if (location.hash !== PANEL_HASH) return hide();
      if (pushedByUs) {
        pushedByUs = false;
        history.back(); // popstate cierra
      } else {
        history.replaceState(history.state, '', location.pathname + location.search);
        hide();
      }
    };

    const syncFromUrl = () => {
      if (location.hash === PANEL_HASH) show('deep_link');
      else hide();
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;

      const openLink = target.closest<HTMLElement>('[data-tickets-open]');
      if (openLink) {
        e.preventDefault();
        opener = openLink;
        if (location.hash !== PANEL_HASH) {
          history.pushState(history.state, '', PANEL_HASH);
          pushedByUs = true;
        }
        show((openLink.dataset.ticketsOpen as PanelSource | undefined) ?? 'hero');
        return;
      }

      if (target.closest('[data-tickets-close]')) {
        e.preventDefault();
        requestClose();
        return;
      }

      // The scroll hint (plan 007): one viewport down, into the sea.
      if (target.closest('[data-hero-hint]')) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollBy({ top: window.innerHeight, behavior: reduce ? 'auto' : 'smooth' });
        return;
      }

      const tracked = target.closest<HTMLElement>('[data-track]');
      if (tracked?.dataset.track === 'explore_start') {
        track('explore_start', {
          source: (tracked.dataset.source as ExploreSource | undefined) ?? 'hero',
        });
      } else if (tracked?.dataset.track === 'ticket_click_out' && tracked.dataset.eventId) {
        track('ticket_click_out', {
          eventId: tracked.dataset.eventId,
          source: (tracked.dataset.source as ClickOutSource | undefined) ?? 'tickets_panel',
        });
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) requestClose();
    };

    // Toque fuera de la hoja: cierra.
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === panel) requestClose();
    };

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    panel.addEventListener('click', onBackdrop);
    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('hashchange', syncFromUrl);

    // The landing view counts once the visitor scrolls past the hero (the
    // first hand-off, plan 007); without a hero, right away.
    let viewed = false;
    const onScroll = () => {
      if (viewed) return;
      const hero = document.querySelector('.hero');
      if (hero && window.scrollY < window.innerHeight * PAST_HERO) return;
      viewed = true;
      window.removeEventListener('scroll', onScroll);
      track('landing_view', { intro: window.__boiaEntry?.landed ?? 'none' });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    syncFromUrl();

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      panel.removeEventListener('click', onBackdrop);
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('hashchange', syncFromUrl);
      hide();
      root.classList.remove('js');
    };
  }, []);

  return RadioMount ? <RadioMount surface="landing" /> : null;
}
