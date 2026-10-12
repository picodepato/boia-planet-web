/**
 * Service worker de BOIA.PLANET (plan 027 T264). Existe para que la web se
 * pueda instalar como app; no es una caché.
 *
 * - No guarda nada: ni HTML, ni la API, ni Supabase, ni los modelos 3D. No
 *   abre `caches`.
 * - Navegaciones (páginas): primero la red, siempre. Sólo si no hay red
 *   responde una página mínima «sin conexión» que se genera aquí (no es una
 *   copia guardada). Así nunca sirve un build viejo: cada despliegue, en
 *   Cloudflare o en Vercel, se ve en la siguiente carga.
 * - Todo lo demás (scripts, imágenes, /api, Supabase, otros orígenes, lo que
 *   no sea GET) no lo toca: lo resuelve el navegador como si no hubiera
 *   service worker.
 *
 * El texto «sin conexión» llega en la URL de registro (`?offline=…`), desde
 * el catálogo i18n (`pwa.offline`). Para retirarlo en un despliegue, basta
 * con cambiar este archivo por uno que llame a `self.registration.unregister()`.
 *
 * `self.__boiaSw` expone las piezas para las pruebas (sw.test.ts).
 */
(function (sw) {
  'use strict';

  var params = new URLSearchParams((sw.location && sw.location.search) || '');
  var OFFLINE_TITLE = params.get('title') || 'BOIA.PLANET';
  var OFFLINE_TEXT = params.get('offline') || '';

  /** 'navigate' (red primero) o 'pass' (no se intercepta). */
  function route(request, scopeOrigin) {
    if (request.method !== 'GET') return 'pass';
    var url;
    try {
      url = new URL(request.url);
    } catch {
      return 'pass';
    }
    if (url.origin !== scopeOrigin) return 'pass';
    if (url.pathname === '/api' || url.pathname.indexOf('/api/') === 0) return 'pass';
    if (request.mode === 'navigate') return 'navigate';
    return 'pass';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function offlineResponse() {
    var html =
      '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' +
      escapeHtml(OFFLINE_TITLE) +
      '</title></head>' +
      '<body style="margin:0;min-height:100vh;display:grid;place-items:center;' +
      'background:#12233f;color:#fff;font:600 1.1rem/1.4 system-ui,sans-serif;' +
      'text-align:center;padding:1.5rem;box-sizing:border-box">' +
      '<main><p style="margin:0 0 .5rem;font-size:1.6rem;color:#ff5219">' +
      escapeHtml(OFFLINE_TITLE) +
      '</p><p style="margin:0">' +
      escapeHtml(OFFLINE_TEXT) +
      '</p></main></body></html>';
    return new Response(html, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  /** Red primero; sin red, la página mínima. Nunca guarda la respuesta. */
  function networkFirst(request) {
    return fetch(request).catch(function () {
      return offlineResponse();
    });
  }

  function onFetch(event) {
    if (route(event.request, sw.location.origin) !== 'navigate') return;
    event.respondWith(networkFirst(event.request));
  }

  sw.addEventListener('install', function () {
    sw.skipWaiting();
  });

  sw.addEventListener('activate', function (event) {
    event.waitUntil(sw.clients.claim());
  });

  sw.addEventListener('fetch', onFetch);

  sw.__boiaSw = { route: route, onFetch: onFetch, offlineResponse: offlineResponse };
})(self);
