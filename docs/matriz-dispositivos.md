# Matriz de accesibilidad y fallos (REQ-ARQ-016) y pruebas en dispositivos (REQ-ARQ-017)

Los 16 casos de REQ-ARQ-016 con lo que ya comprueba la suite e2e
(`E2E_PORT=<libre> pnpm e2e --workers=2`, Chromium en 360×640 táctil y en
escritorio) y lo que falta probar a mano. Estado a 2026-09-30 (T49).

- **e2e**: hay una prueba automática que lo comprueba (archivo y título).
- **parcial**: la prueba cubre una parte (una sola página, o sin el
  dispositivo real).
- **a mano**: sin prueba automática; se prueba en el móvil y se apunta en la
  tabla de abajo.

| # | Caso | Estado | Evidencia |
|---:|---|---|---|
| 1 | Móvil corto (360×640) | e2e | Proyecto `mobile` de toda la suite; `landing.spec.ts` «CTA Explorar y Tickets se ven sin scroll»; `juego-hud.spec.ts` «minimapa ≤ 22 % del ancho y ningún elemento del HUD tapa la zona del joystick» |
| 2 | Áreas seguras (notch, barra de gestos) | a mano | El HUD usa `env(safe-area-inset-*)` (`lib/mundo/use-viewport.ts`); Chromium no emula el notch |
| 3 | Scroll | parcial | `landing.spec.ts` «CTA Explorar y Tickets se ven sin scroll»; que el scroll de la página no mueva el barco se prueba a mano |
| 4 | Teclado | e2e | `landing.spec.ts` «el panel de Tickets abre sin WebGL y con el bundle del juego bloqueado» (Escape cierra el checkout y luego el panel); `juego-hud.spec.ts` «Menú de a bordo: siete iconos, separación y modo de teclado guardado»; `mar-3d.spec.ts` «el minimapa abre el mapa grande; «Cerrar», tocarlo otra vez y la M lo cierran» |
| 5 | Foco | e2e | `landing.spec.ts` (el foco va al título del panel y vuelve a «Tickets»); `intro.spec.ts` «`/`: el mini-mundo, luego «BOIA» y el botón; al pulsar, aterriza en la landing (ENT 01, 02)» (foco en «Zarpar») |
| 6 | Contraste | parcial | `landing.spec.ts` «axe: sin violaciones serias ni críticas en / (y con el panel abierto)»; `/juego`, `/mar` y el Admin sin axe |
| 7 | Lector de pantalla en contenido editorial | parcial | El mismo axe (nombres y roles) en `/`; VoiceOver y TalkBack, a mano |
| 8 | Zoom del navegador (200 %) | a mano | Sin prueba |
| 9 | Movimiento reducido | e2e | `intro.spec.ts` «mini-mundo quieto, título y botón; al pulsar, fundido sin mover la cámara (REQ-ENT-010)»; `agujero-negro.spec.ts` «un fundido en vez del vórtice, con cada lugar en su sitio»; `mar-3d.spec.ts` ««Entradas» con movimiento reducido abre el checkout directo» |
| 10 | Audio desactivado | e2e | `juego-hud.spec.ts` «sin audio antes del primer gesto; el primer toque lo desbloquea»; `accesos.spec.ts` «cabecera con Mi Carnet y sonido; pie con Carnet, WhatsApp e Instagram» |
| 11 | WebGL no disponible | e2e | `landing.spec.ts` «el panel de Tickets abre sin WebGL y con el bundle del juego bloqueado»; `intro.spec.ts` «motor bloqueado: ilustración del puerto y Tickets funcionando (REQ-ENT-017, 038)» |
| 12 | Conexión lenta | parcial | `intro.spec.ts` «recursos lentos: «Cargando» y luego la landing ligera, sin alargar la espera (REQ-ENT-007)»; el mar con red lenta, a mano |
| 13 | Sin conexión | a mano | Sin prueba ni pantalla propia: el navegador enseña su error |
| 14 | Recarga | e2e | `accesos.spec.ts` «recargar /juego deja el barco donde estaba»; `carnet.spec.ts` «Carnet → botella → recargar y encontrarla → leer una de muestra → VER SU CARNET»; `logros.spec.ts` «/mar: completar un logro, su número en el icono, «Reclamar» una vez y recargar» |
| 15 | Retorno desde el checkout | parcial | `tickets.spec.ts` «landing → compra de prueba → Mi Carnet; isla → compra de prueba → los dos sellos» (checkout de prueba dentro de la web); volver desde una ticketera real llega con la versión final (D-20) |
| 16 | Pérdida de contexto gráfico | a mano | Sin prueba ni manejo propio de `webglcontextlost` en el motor |

**Resumen:** 7 con e2e, 5 parciales, 4 a mano (áreas seguras, zoom, sin
conexión y pérdida de contexto).

## Pruebas en dispositivos físicos (REQ-ARQ-017, ENT 04)

Una fila por dispositivo y orientación. Ningún control se da por bueno probado
sólo con ratón o emulación. Aspectos: joystick, segundo dedo, drift, fluidez,
áreas táctiles, minimapa, paneles, rotación, audio, cinemática y memoria
(1 a 11), más los casos «a mano» de la matriz de arriba.

| Fecha | Modelo | Sistema | Navegador | Conexión | Orientación | Resultado (1–11 y casos a mano) | Quién |
|---|---|---|---|---|---|---|---|
| 2026-09-29 | Móvil de Hernán | — | — | Wi-Fi | vertical | «Comprobado OK» (D-23); sin el detalle por aspecto | Hernán |
| | iPhone (Safari) | | | 4G | vertical y horizontal | | |
| | Android (Chrome) | | | 4G | vertical y horizontal | | |
| | Escritorio | | Chrome, Safari, Firefox | | — | | |
