import { createElement, type EffectCallback } from 'react';
import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LazyVideo, type LazyVideoProps } from './lazy-video';

// Sólo simular el ciclo de hooks en las pruebas del observador, sin añadir
// dependencias DOM. La prueba SSR usa los hooks reales de React.
const hooks = vi.hoisted(() => ({
  client: false,
  visible: false,
  target: {} as HTMLDivElement,
  effect: null as EffectCallback | null,
}));
vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof React>();
  return {
    ...react,
    useState: ((initial: boolean) =>
      hooks.client
        ? [
            hooks.visible,
            (next: boolean) => {
              hooks.visible = next;
            },
          ]
        : react.useState(initial)) as typeof react.useState,
    useRef: ((initial: null) =>
      hooks.client ? { current: hooks.target } : react.useRef(initial)) as typeof react.useRef,
    useEffect: ((effect: EffectCallback, deps: unknown[]) => {
      if (hooks.client) hooks.effect = effect;
      else react.useEffect(effect, deps);
    }) as typeof react.useEffect,
  };
});

const props: LazyVideoProps = {
  src: '/contenido/prueba.webm',
  poster: '/contenido/prueba.webp',
  width: 640,
  height: 360,
  labelKey: 'photos.heading',
};
const render = () => renderToStaticMarkup(createElement(LazyVideo, props));

afterEach(() => {
  hooks.client = false;
  hooks.visible = false;
  hooks.effect = null;
  vi.unstubAllGlobals();
});

describe('REQ-COM-032: LazyVideo', () => {
  it('SSR sólo pinta el poster con dimensiones: ninguna fuente de vídeo', () => {
    const html = render();
    expect(html).toContain(props.poster);
    expect(html).toContain('aspect-ratio:640 / 360');
    expect(html).not.toContain('<video');
    expect(html).not.toContain('<source');
    expect(html).not.toContain(props.src);
  });

  it('sólo monta el vídeo al intersectar, sin precarga ni autoplay; limpia el observador', () => {
    hooks.client = true;
    let notify!: IntersectionObserverCallback;
    const observe = vi.fn();
    const disconnect = vi.fn();
    const options = vi.fn();
    class Observer {
      observe = observe;
      disconnect = disconnect;
      constructor(callback: IntersectionObserverCallback, config: IntersectionObserverInit) {
        notify = callback;
        options(config);
      }
    }
    vi.stubGlobal('IntersectionObserver', Observer);
    expect(render()).not.toContain(props.src);
    const cleanup = hooks.effect!();
    expect(observe).toHaveBeenCalledWith(hooks.target);
    expect(options).toHaveBeenCalledWith({ rootMargin: '0px', threshold: 0 });
    const enter = (isIntersecting: boolean) =>
      notify([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
    enter(false);
    expect(render()).not.toContain('<video');
    enter(true);
    const html = render();
    expect(html).toContain('<video');
    expect(html).toContain(`src="${props.src}"`);
    expect(html).toContain(`poster="${props.poster}"`);
    expect(html).toContain('preload="none"');
    expect(html).not.toContain('autoplay');
    expect(disconnect).toHaveBeenCalledOnce();
    if (typeof cleanup === 'function') cleanup();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });

  it('al desmontar antes de ser visible desconecta; sin IO conserva el poster', () => {
    hooks.client = true;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
    render();
    const cleanup = hooks.effect!();
    if (typeof cleanup === 'function') cleanup();
    expect(disconnect).toHaveBeenCalledOnce();
    vi.stubGlobal('IntersectionObserver', undefined);
    const html = render();
    expect(hooks.effect!()).toBeUndefined();
    expect(html).toContain(props.poster);
    expect(html).not.toContain(props.src);
    expect(html).toContain('<button');
  });
});
