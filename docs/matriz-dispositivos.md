# Matriz de accesibilidad y fallos (REQ-ARQ-016) y pruebas en dispositivos (REQ-ARQ-017)

Los 16 casos de REQ-ARQ-016 con lo que ya comprueba la suite e2e
(`E2E_PORT=<libre> pnpm e2e --workers=2`, Chromium en 360×640 táctil y en
escritorio) y lo que falta probar a mano. Estado a 2026-09-30 (T49); las
filas de la landing, al día con el plan 007 (2026-10-03, T81 y T83).

- **e2e**: hay una prueba automática que lo comprueba (archivo y título).
- **parcial**: la prueba cubre una parte (una sola página, o sin el
  dispositivo real).
- **a mano**: sin prueba automática; se prueba en el móvil y se apunta en la
  tabla de abajo.

| # | Caso | Estado | Evidencia |
|---:|---|---|---|
| 1 | Móvil corto (360×640) | e2e | Proyecto `mobile` de toda la suite; `landing.spec.ts` «CTA Zarpar y Entradas se ven sin scroll»; `landing-scroll.spec.ts` en 375×812; `juego-hud.spec.ts` «minimapa ≤ 22 % del ancho y ningún elemento del HUD tapa la zona del joystick» |
| 2 | Áreas seguras (notch, barra de gestos) | a mano | El HUD usa `env(safe-area-inset-*)` (`lib/mundo/use-viewport.ts`); Chromium no emula el notch |
| 3 | Scroll | parcial | `landing-scroll.spec.ts` ««Entradas» y «Zarpar» en el primer pintado; reposo; un viewport de scroll es el mar y volver lo deshace; sin saltos de maquetación» (el scroll lleva la escena del hero, CLS < 0,05) y `landing-perf.spec.ts` (scroll de 6 s con CPU 4×); en un móvil real, a mano |
| 4 | Teclado | e2e | `landing.spec.ts` «el panel de Tickets abre sin WebGL y con el bundle del juego bloqueado» (Escape cierra el checkout y luego el panel); `juego-hud.spec.ts` «Menú de a bordo: siete iconos, separación y modo de teclado guardado»; `mar-3d.spec.ts` «el minimapa abre el mapa grande; «Cerrar», tocarlo otra vez y la M lo cierran» |
| 5 | Foco | e2e | `landing.spec.ts` (el foco va al título del panel y vuelve a «Entradas»); `landing-scroll.spec.ts` «teclado: salto al contenido → «Zarpar» → «Entradas» → la pista…» (anillo blanco visible sobre la escena oscura; Escape y Atrás devuelven el foco) |
| 6 | Contraste | parcial | Landing: `landing.spec.ts` «axe: sin violaciones en / (y con el panel abierto)» (cualquier impacto) y `landing-scroll.spec.ts` «accesibilidad: axe sin violaciones y contraste AA…» (reposo, zambullida, noche y pie; contraste medido en píxeles sobre la escena y el still, `e2e/contrast.ts`); `/mar` y el Admin sin axe |
| 7 | Lector de pantalla en contenido editorial | parcial | El mismo axe (nombres y roles) en `/`; VoiceOver y TalkBack, a mano |
| 8 | Zoom del navegador (200 %) | a mano | Sin prueba |
| 9 | Movimiento reducido | e2e | `intro.spec.ts` «la versión estática: sin escena, «BOIA» plano; al pulsar, fundido al velo y al juego (REQ-ENT-010)»; `landing-scroll.spec.ts` «nada se mueve solo…»; `landing-perf.spec.ts` «la versión estática no crea ningún contexto WebGL»; `agujero-negro.spec.ts` «un fundido en vez del vórtice, con cada lugar en su sitio»; `mar-3d.spec.ts` ««Entradas» con movimiento reducido abre el checkout directo» |
| 10 | Audio desactivado | e2e | `juego-hud.spec.ts` «sin audio antes del primer gesto; el primer toque lo desbloquea»; `accesos.spec.ts` «cabecera con Mi Carnet y sonido; pie con Carnet, WhatsApp e Instagram» |
| 11 | WebGL no disponible | e2e | `landing.spec.ts` «el panel de Tickets abre sin WebGL y con el bundle del juego bloqueado»; `intro.spec.ts` «motor bloqueado: la versión estática y Tickets funcionando (REQ-ENT-017, 038)»; `landing-scroll.spec.ts` «sin WebGL: la versión estática, el scroll baja por las bandas y axe no encuentra nada» |
| 12 | Conexión lenta | parcial | `intro.spec.ts` «una escena que no llega en el plazo: «Cargando» y luego la versión estática (REQ-ENT-007)»; `landing-scroll.spec.ts` «escena lenta: «Zarpar» y «Entradas» a mano mientras carga…»; el mar con red lenta, a mano |
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
