# Estado por requisito

Una fila por REQ de [09-requisitos](09-requisitos.md) con su estado y la
evidencia que lo sostiene (REQ-PRO-017). `python3 tools/spec/estado.py`
comprueba este archivo y cuenta por estado; corre con `pnpm test`.

| Estado | Qué quiere decir |
|---|---|
| HECHO | Construido y con una prueba automática que lo comprueba (enlazada; la prueba nombra el REQ o se cita su título «…») |
| PARCIAL | Construido en parte, o construido sin una prueba que lo compruebe |
| FALTA | Sin construir, o sin la evidencia que pide su criterio (revisión, medición en móvil, documento) |
| L2 | Alcance L2 en 09 y sin construir |
| final | Aplazado a la versión final (D-20: Supabase, correo, TOTP, editor visual, ticketera real) o alcance diferido |

Primera versión generada el 2026-09-30 (T49) con `--generar`: pruebas que
nombran el REQ, un repaso de las pruebas que lo cubren sin nombrarlo y el
código que lo nombra. Desde aquí se mantiene a mano: al terminar un encargo,
sube de estado lo que haya cerrado y enlaza su prueba.

<!-- estado:tabla -->
| ID | Requisito | Alcance | Estado | Evidencia | Nota |
|---|---|---|---|---|---|
| REQ-PRO-001 | Dos caminos: Tickets y Explorar | L1 | HECHO | [test_estado.py](../../tools/spec/test_estado.py) | — |
| REQ-PRO-002 | Comprar sin jugar ni registrarse | L1 | HECHO | [landing.spec.ts](../../apps/web/e2e/landing.spec.ts) «el panel de Tickets abre sin WebGL y con el bundle del juego bloqueado» | — |
| REQ-PRO-003 | Flujo comercial directo en 2 toques | L1 | HECHO | [landing.spec.ts](../../apps/web/e2e/landing.spec.ts) «el panel de Tickets abre sin WebGL y con el bundle del juego bloqueado» | — |
| REQ-PRO-004 | Flujo experiencial sin formularios | L1 | PARCIAL | [record-demo.spec.ts](../../apps/web/e2e/record-demo.spec.ts) | Una prueba lo cubre en parte; pide revisión, medición o documento |
| REQ-PRO-005 | Juego como segunda vía de conversión | L1 | PARCIAL | [world-progress.test.ts](../../apps/web/lib/mundo/world-progress.test.ts) | Una prueba lo cubre en parte |
| REQ-PRO-006 | Formato All Day BOIA o satélite | L1 | PARCIAL | [events.ts](../../packages/contracts/src/events.ts) | Construido; sin prueba que lo nombre |
| REQ-PRO-007 | Satélites sin isla principal | L1 | HECHO | [access.test.ts](../../apps/web/lib/landing/access.test.ts) «la isla del evento destacado o, sin isla, la localización común (O7)» | — |
| REQ-PRO-008 | Móvil táctil primero | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-PRO-009 | Más mundo, menos HUD | L1 | PARCIAL | [hud-layout.ts](../../packages/engine/src/ui/hud-layout.ts) | Construido; sin prueba que lo nombre |
| REQ-PRO-010 | Sin modales que detengan la navegación | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-PRO-011 | Feedback con animación y sonido | L1 | HECHO | [feedback.test.ts](../../apps/web/lib/mundo/feedback.test.ts) | — |
| REQ-PRO-012 | Mecánicas que se entienden solas | L1 | FALTA | — | — |
| REQ-PRO-013 | Curiosidad recompensada tras la misión | L1 | PARCIAL | [rescue.test.ts](../../packages/engine/src/mission/rescue.test.ts) | Una prueba lo cubre en parte |
| REQ-PRO-014 | Identidad BOIA coherente | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-PRO-015 | Cobertura del piloto sin pérdidas | L1 | FALTA | — | — |
| REQ-PRO-016 | Revisión de §30 en cada hito | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-PRO-017 | Estado por REQ con evidencia | L1 | HECHO | [test_estado.py](../../tools/spec/test_estado.py) | — |
| REQ-PRO-018 | Contenido no aprobado, marcado | L1 | FALTA | — | — |
| REQ-PRO-019 | Contenido que aporta BOIA | L1 | FALTA | — | — |
| REQ-PRO-020 | Lista de publicación y autorización | L1 | FALTA | [entrega.md](../../docs/entrega.md) | La lista la firma Álvaro antes de publicar; docs/entrega.md es la de la versión de prueba |
| REQ-PRO-021 | Cuentas de producción de BOIA | L1 | final | — | Cuentas de producción de BOIA (D-04, D-20) |
| REQ-ENT-001 | Entrada en tres actos: mini-mundo, botón y aterrizaje en el mar | L1 | HECHO | [intro.spec.ts](../../apps/web/e2e/intro.spec.ts) | — |
| REQ-ENT-002 | Sólo el botón de entrar antes de la landing; entradas siempre a mano | L1 | HECHO | [intro.spec.ts](../../apps/web/e2e/intro.spec.ts) | — |
| REQ-ENT-003 | Título «BOIA» en letras 3D y botón de entrar | L1 | HECHO | [planet.test.ts](../../packages/engine/src/intro/planet.test.ts) «la de serie es válida, de muestra, versionada y trae «BOIA» y «Zarpar» (REQ-ENT-003)» | — |
| REQ-ENT-004 | Dirección artística de la entrada | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-ENT-005 | Planeta 2D/2.5D reconocible | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-ENT-006 | Aparición, pausa, acercamiento con aplanado y llegada | L1 | HECHO | [planet.test.ts](../../packages/engine/src/intro/planet.test.ts) «acto 3: el planeta baja hasta el horizonte del hero, sólo acercándose, y acaba en él (REQ-ENT-014)» | T57: entrada 3D con el planeta de /mar; el aplanado era del 2D |
| REQ-ENT-007 | Duración por tramos (~2 s + ~2 s), nunca espera vacía | L1 | HECHO | [intro.spec.ts](../../apps/web/e2e/intro.spec.ts); [entry.test.ts](../../packages/engine/src/intro/entry.test.ts) | — |
| REQ-ENT-008 | Sin audio y Saltar idempotente | L1 | HECHO | [intro.spec.ts](../../apps/web/e2e/intro.spec.ts); [controller.test.ts](../../packages/engine/src/intro/controller.test.ts) | — |
| REQ-ENT-009 | La entrada según la URL, en cada carga de `/` | L1 | HECHO | [intro.spec.ts](../../apps/web/e2e/intro.spec.ts) | — |
| REQ-ENT-010 | Movimiento reducido | L1 | HECHO | [intro.spec.ts](../../apps/web/e2e/intro.spec.ts); [controller.test.ts](../../packages/engine/src/intro/controller.test.ts) | — |
| REQ-ENT-011 | Enlaces directos sin introducción | L1 | HECHO | [demo.spec.ts](../../apps/web/e2e/demo.spec.ts); [eventos.spec.ts](../../apps/web/e2e/eventos.spec.ts) | — |
| REQ-ENT-012 | Explorar sin reiniciar el mundo, desde el puerto | L1 | FALTA | — | T57: el hero lleva a /mar con una carga normal; el traspaso de la escena era del mundo 2D (se va en T62) |
| REQ-ENT-013 | La cinemática no concede nada | L1 | HECHO | [intro.spec.ts](../../apps/web/e2e/intro.spec.ts) | — |
| REQ-ENT-014 | Traspaso de cámara y cancelación limpia | L1 | HECHO | [intro.spec.ts](../../apps/web/e2e/intro.spec.ts); [planet.test.ts](../../packages/engine/src/intro/planet.test.ts) | — |
| REQ-ENT-015 | Configuración de entrada versionada | L1 | HECHO | [config.test.ts](../../packages/engine/src/intro/config.test.ts) | — |
| REQ-ENT-016 | Entrada editable desde el Admin | L2 | L2 | — | — |
| REQ-ENT-017 | HTML comercial sin motor ni JS | L1 | HECHO | [intro.spec.ts](../../apps/web/e2e/intro.spec.ts) | — |
| REQ-ENT-018 | Arranque en blanco investigado | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-ENT-019 | Controles libres al terminar | L1 | HECHO | [intro.spec.ts](../../apps/web/e2e/intro.spec.ts) ««Saltar» cinco veces y Escape en la pausa: la misma landing (REQ-ENT-008, ENT 03)» | — |
| REQ-ENT-020 | Entrada resistente a fallos | L1 | HECHO | [intro.spec.ts](../../apps/web/e2e/intro.spec.ts) «Atrás en la pausa: no repite la entrada ni duplica la escena (ENT 03)» | — |
| REQ-ENT-021 | Revisión en dispositivos físicos | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-ENT-022 | Presupuestos de la entrada | L1 | PARCIAL | [sphere-probe.spec.ts](../../apps/web/e2e/sphere-probe.spec.ts) | Una prueba lo cubre en parte; pide revisión, medición o documento |
| REQ-ENT-023 | Storyboard y revisión visual | L1 | HECHO | [record.spec.ts](../../apps/web/e2e/record.spec.ts) | — |
| REQ-ENT-024 | Hero dentro de la escena | L1 | PARCIAL | [accesos.spec.ts](../../apps/web/e2e/accesos.spec.ts) | Una prueba lo cubre en parte |
| REQ-ENT-025 | Primer encuadre de la landing | L1 | PARCIAL | [landing.spec.ts](../../apps/web/e2e/landing.spec.ts) | Una prueba lo cubre en parte |
| REQ-ENT-026 | CTA Explorar dimensionado | L1 | HECHO | [landing.spec.ts](../../apps/web/e2e/landing.spec.ts) «CTA Explorar y Tickets se ven sin scroll» | — |
| REQ-ENT-027 | Tickets visible en 360×640 | L1 | HECHO | [landing.spec.ts](../../apps/web/e2e/landing.spec.ts) «CTA Explorar y Tickets se ven sin scroll» | — |
| REQ-ENT-028 | Subtítulo según promociones | L1 | HECHO | [blocks.test.ts](../../apps/web/app/%28landing%29/components/blocks.test.ts) «el hero promete descuentos sólo con una promoción vigente» | — |
| REQ-ENT-029 | Navegación de la landing | L1 | HECHO | [accesos.spec.ts](../../apps/web/e2e/accesos.spec.ts); [access.test.ts](../../apps/web/lib/landing/access.test.ts) | — |
| REQ-ENT-030 | Bloques por scroll | L1 | HECHO | [blocks.test.ts](../../apps/web/app/%28landing%29/components/blocks.test.ts) «un bloque sin contenido publicado útil no pinta nada» | — |
| REQ-ENT-031 | Bloques de actividades y comunidad | L2 | L2 | — | — |
| REQ-ENT-032 | Cierre de página | L1 | HECHO | [accesos.spec.ts](../../apps/web/e2e/accesos.spec.ts); [access.test.ts](../../apps/web/lib/landing/access.test.ts) | — |
| REQ-ENT-033 | Home por bloques administrables | L1 | HECHO | [admin.spec.ts](../../apps/web/e2e/admin.spec.ts) «Probar admin: los cambios se ven en la landing y en el mar» | — |
| REQ-ENT-034 | Tickets, Fotos y Tienda con isla visible | L1 | HECHO | [accesos.spec.ts](../../apps/web/e2e/accesos.spec.ts); [mar-a-bordo.spec.ts](../../apps/web/e2e/mar-a-bordo.spec.ts) «`/mar?ir=<Puerto de Fotos>` sale navegando hasta allí y abre la galería»; [arrival.test.ts](../../apps/web/lib/mundo/arrival.test.ts) | — |
| REQ-ENT-035 | Checkout sólo con acción explícita | L1 | HECHO | [landing.spec.ts](../../apps/web/e2e/landing.spec.ts) «el panel de Tickets abre sin WebGL y con el bundle del juego bloqueado» | — |
| REQ-ENT-036 | URLs compartibles y Atrás | L1 | PARCIAL | [event-page.tsx](../../apps/web/app/%28landing%29/components/event-page.tsx) | Construido; sin prueba que lo nombre |
| REQ-ENT-037 | Tickets general | L1 | PARCIAL | [tickets-panel.tsx](../../apps/web/app/%28landing%29/components/tickets-panel.tsx) | Construido; sin prueba que lo nombre |
| REQ-ENT-038 | Carga ligera primero | L1 | HECHO | [intro.spec.ts](../../apps/web/e2e/intro.spec.ts) «motor bloqueado: el planeta ligero y Tickets funcionando (REQ-ENT-017, 038)» | — |
| REQ-ENT-039 | Teletransportes sin premios | L1 | HECHO | [arrival.test.ts](../../apps/web/lib/mundo/arrival.test.ts) | — |
| REQ-ENT-040 | `/mar`: botón «Entradas» siempre visible, con viaje en turbo | L1 | HECHO | [mar-3d.spec.ts](../../apps/web/e2e/mar-3d.spec.ts) | — |
| REQ-MUN-001 | Mundo 2D/2.5D; 3D sólo en `/mar` | L1 | PARCIAL | [page.tsx](../../apps/web/app/mar/page.tsx) | Construido; sin prueba que lo nombre |
| REQ-MUN-002 | Motor, datos y arte separados | L1 | HECHO | [swap.test.ts](../../packages/engine/src/world/swap.test.ts) | — |
| REQ-MUN-003 | Agua viva | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-MUN-004 | Estela reactiva | L1 | HECHO | [wake.test.ts](../../packages/engine/src/wake.test.ts) | — |
| REQ-MUN-005 | Ciclo de día y noche | L2 | L2 | — | — |
| REQ-MUN-006 | Joystick donde toca el dedo | L1 | PARCIAL | [controls.test.ts](../../packages/engine/src/input/controls.test.ts) | Una prueba lo cubre en parte; pide revisión, medición o documento |
| REQ-MUN-007 | Drift con segundo dedo | L1 | HECHO | [test_check.py](../../tools/spec/test_check.py) | — |
| REQ-MUN-008 | Teclado de dos modos y drift en escritorio | L1 | HECHO | [controls.test.ts](../../packages/engine/src/input/controls.test.ts) | — |
| REQ-MUN-009 | Física independiente de los FPS | L1 | HECHO | [loop.test.ts](../../packages/engine/src/loop.test.ts) «1 s con imágenes de 16 ms y de 33 ms da la misma posición (< 1 %)» | — |
| REQ-MUN-010 | Sin aceleración bloqueada | L1 | HECHO | [controls.test.ts](../../packages/engine/src/input/controls.test.ts) «perder el dedo del joystick deja el acelerador a cero aunque siga el otro» | — |
| REQ-MUN-011 | Costas, límite superior y zona no publicada en `/juego` | L1 | HECHO | [controller.test.ts](../../packages/engine/src/ship/controller.test.ts) «el borde superior está abierto y una corriente suave devuelve el barco» | — |
| REQ-MUN-012 | Carga por sectores | L1 | HECHO | [sectores.spec.ts](../../apps/web/e2e/sectores.spec.ts); [sectors.test.ts](../../packages/engine/src/world/sectors.test.ts) | — |
| REQ-MUN-013 | Contrato de mapa | L1 | HECHO | [schema.test.ts](../../packages/world/src/schema.test.ts) «rechaza límites invertidos e IDs repetidos» | — |
| REQ-MUN-014 | Misma geometría en editor y juego | L1 | HECHO | [minimap.test.ts](../../packages/engine/src/ui/minimap.test.ts) | — |
| REQ-MUN-015 | Mapa progresivo | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-MUN-016 | Plano con rutas diferenciadas | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-MUN-017 | Rutas de 1 y 10 minutos | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-MUN-018 | Boceto del mapa de lanzamiento | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-MUN-019 | Tamaño del minimapa | L1 | HECHO | [hud-layout.test.ts](../../packages/engine/src/ui/hud-layout.test.ts) «96 px en móvil sin pasar del 22 % del ancho; 128 px en escritorio» | — |
| REQ-MUN-020 | Minimapa ampliable | L1 | HECHO | [juego-hud.spec.ts](../../apps/web/e2e/juego-hud.spec.ts) «tocar el minimapa lo amplía; mantenerlo 500 ms y arrastrar lo mueve y se recuerda» | — |
| REQ-MUN-021 | Minimapa reposicionable | L1 | HECHO | [juego-hud.spec.ts](../../apps/web/e2e/juego-hud.spec.ts) «tocar el minimapa lo amplía; mantenerlo 500 ms y arrastrar lo mueve y se recuerda» | — |
| REQ-MUN-022 | Brújula al objetivo | L1 | HECHO | [minimap.test.ts](../../packages/engine/src/ui/minimap.test.ts) «el barco descubre al entrar en el radio; la brújula va a lo más cercano sin descubrir» | — |
| REQ-MUN-023 | Objeto = asset + comportamientos | L1 | PARCIAL | [swap.test.ts](../../packages/engine/src/world/swap.test.ts) | Una prueba lo cubre en parte |
| REQ-MUN-024 | Anatomía de 9 partes | L1 | PARCIAL | [schema.test.ts](../../packages/world/src/schema.test.ts) | Una prueba lo cubre en parte |
| REQ-MUN-025 | 12 comportamientos del catálogo | L1 | HECHO | [behaviors.test.ts](../../packages/world/src/behaviors.test.ts) «tiene los 12 módulos de L1 más INICIAR_MINIJUEGO» | — |
| REQ-MUN-026 | INICIAR_MINIJUEGO con `faro` y `canon` | L1 | HECHO | [minigames.test.ts](../../packages/engine/src/minigames/minigames.test.ts) «con el registro, el motor da `faro` y `canon` por disponibles y nada más» | — |
| REQ-MUN-027 | Mecánica nueva una sola vez | L1 | HECHO | [schema.test.ts](../../packages/world/src/schema.test.ts) | — |
| REQ-MUN-028 | Barco por slots | L1 | PARCIAL | [shop-model.test.ts](../../apps/web/lib/barco/shop-model.test.ts) | Una prueba lo cubre en parte |
| REQ-MUN-029 | Barco y 3 skins en 8 direcciones | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-MUN-030 | Orientación correcta sin espejar | L1 | PARCIAL | [direction.test.ts](../../packages/engine/src/ship/direction.test.ts) | Una prueba lo cubre en parte; pide revisión, medición o documento |
| REQ-MUN-031 | Manifiesto por recurso | L1 | HECHO | [manifest.test.ts](../../packages/world/src/manifest.test.ts) «rechaza un manifiesto sin anclajes de alguna dirección» | `python3 tools/blender/check.py` corre con `pnpm test` (T49) |
| REQ-MUN-032 | Sprites reproducibles desde Blender | L1 | PARCIAL | [render.py](../../tools/blender/render.py) | Construido; sin prueba que lo nombre |
| REQ-MUN-033 | Revisión de skins y sustitución | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-MUN-034 | Formatos de assets | L1 | PARCIAL | [check.py](../../tools/blender/check.py) | Construido; sin prueba que lo nombre |
| REQ-MUN-035 | Un mapa compartido, una skin por mundo | L1 | HECHO | [worlds.test.ts](../../packages/world/src/worlds/worlds.test.ts) «sale con 1 si falta una skin o si una skin nombra un lugar desconocido» | — |
| REQ-MUN-036 | Nombres comunes y propios por mundo | L1 | HECHO | [worlds.test.ts](../../packages/world/src/worlds/worlds.test.ts) «renombrar con alcance `world` cambia sólo ese mundo» | — |
| REQ-MUN-037 | Arcilla y Acuarela, con cambio de mundo | L1 | HECHO | [agujero-negro.spec.ts](../../apps/web/e2e/agujero-negro.spec.ts) ««Mundos»: el mundo cae al agujero negro y vuelve con cada lugar en su sitio» | — |
| REQ-MUN-038 | `/mar`: planeta de agua con cielo y estrellas | L1 | HECHO | [mar-3d.spec.ts](../../apps/web/e2e/mar-3d.spec.ts) | — |
| REQ-MUN-039 | Cambio de mundo por agujero negro | L1 | HECHO | [agujero-negro.spec.ts](../../apps/web/e2e/agujero-negro.spec.ts) ««Mundos»: el mundo cae al agujero negro y vuelve con cada lugar en su sitio» | — |
| REQ-AVE-001 | Primera boia en el puerto, tras el spawn | L1 | HECHO | [test_check.py](../../tools/spec/test_check.py) | — |
| REQ-AVE-002 | Bocadillos legibles, con cerrar y salto | L1 | HECHO | [mar-3d.spec.ts](../../apps/web/e2e/mar-3d.spec.ts); [notifications.test.ts](../../packages/engine/src/ui/notifications.test.ts) | — |
| REQ-AVE-003 | Guion del tutorial | L1 | PARCIAL | [sample-world.ts](../../packages/world/src/sample-world.ts) | Construido; sin prueba que lo nombre |
| REQ-AVE-004 | Pulsos del ancla y del minimapa | L1 | HECHO | [sample-world.test.ts](../../packages/world/src/sample-world.test.ts) | — |
| REQ-AVE-005 | Boia Fiestera entre cocodrilos | L1 | HECHO | [fiestera.spec.ts](../../apps/web/e2e/fiestera.spec.ts); [rescue.test.ts](../../packages/engine/src/mission/rescue.test.ts) | — |
| REQ-AVE-006 | Rescate y aviso de tripulante | L1 | HECHO | [mission.test.ts](../../apps/web/lib/mundo/mission.test.ts) | — |
| REQ-AVE-007 | Boia Fiestera visible a bordo | L1 | PARCIAL | [game-canvas.tsx](../../apps/web/app/juego/game-canvas.tsx) | Construido; sin prueba que lo nombre |
| REQ-AVE-008 | Entrega en la última isla | L1 | PARCIAL | [celebration.tsx](../../apps/web/lib/mundo/celebration.tsx) | Construido; sin prueba que lo nombre |
| REQ-AVE-009 | Mundo abierto y desvíos | L1 | PARCIAL | [fiestera.spec.ts](../../apps/web/e2e/fiestera.spec.ts) | Una prueba lo cubre en parte |
| REQ-AVE-010 | Destino por ID de lugar y de temporada | L1 | HECHO | [community.test.ts](../../apps/web/lib/admin/community.test.ts); [rescue.test.ts](../../packages/engine/src/mission/rescue.test.ts) | — |
| REQ-AVE-011 | Cambio de destino auditado | L1 | HECHO | [world-switch.test.ts](../../apps/web/lib/mundo/world-switch.test.ts); [community.test.ts](../../apps/web/lib/admin/community.test.ts) | — |
| REQ-AVE-012 | Islas por radio amplio | L1 | HECHO | [sample-world.test.ts](../../packages/world/src/sample-world.test.ts) «la isla de evento se activa con un radio amplio: más del doble de su costa» | — |
| REQ-AVE-013 | Primera llegada y visitas | L1 | HECHO | [comunidad.spec.ts](../../apps/web/e2e/comunidad.spec.ts) | — |
| REQ-AVE-014 | Recuerdos y próximos eventos en la isla | L1 | PARCIAL | [place-panels.tsx](../../apps/web/lib/mundo/place-panels.tsx) | Construido; sin prueba que lo nombre |
| REQ-AVE-015 | Secretos insinuados | L1 | PARCIAL | [discovery.ts](../../packages/engine/src/ui/discovery.ts) | Construido; sin prueba que lo nombre |
| REQ-AVE-016 | Restos regenerables | L1 | PARCIAL | [game-canvas.tsx](../../apps/web/app/juego/game-canvas.tsx) | Construido; sin prueba que lo nombre |
| REQ-AVE-017 | Cofres fugaces | L1 | PARCIAL | [map.ts](../../packages/world/src/worlds/arcilla/map.ts) | Construido; sin prueba que lo nombre |
| REQ-AVE-018 | Delfín guía | L1 | HECHO | [encounters.test.ts](../../apps/web/lib/mundo/encounters.test.ts) | — |
| REQ-AVE-019 | Remolino | L1 | PARCIAL | [encounters.ts](../../apps/web/lib/mundo/encounters.ts) | Construido; sin prueba que lo nombre |
| REQ-AVE-020 | Náufrago con descuento | L1 | HECHO | [mundo-arcilla.spec.ts](../../apps/web/e2e/mundo-arcilla.spec.ts) «náufrago: pide que lo lleven y deja su código de descuento» | — |
| REQ-AVE-021 | Descuentos de tienda en restos | L1 | PARCIAL | [map.ts](../../packages/world/src/worlds/arcilla/map.ts) | Construido; sin prueba que lo nombre |
| REQ-AVE-022 | Puerto de Fotos | L1 | HECHO | [accesos.spec.ts](../../apps/web/e2e/accesos.spec.ts); [arrival.test.ts](../../apps/web/lib/mundo/arrival.test.ts) | — |
| REQ-AVE-023 | Boia de WhatsApp | L1 | PARCIAL | [place-panels.tsx](../../apps/web/lib/mundo/place-panels.tsx) | Construido; sin prueba que lo nombre |
| REQ-AVE-024 | Boia musical | L2 | L2 | — | — |
| REQ-AVE-025 | Ideas musicales en reserva | diferido | final | — | Alcance diferido |
| REQ-AVE-026 | Circuito lateral como atajo | L1 | PARCIAL | [circuit-hud.tsx](../../apps/web/lib/mundo/circuit-hud.tsx) | Construido; sin prueba que lo nombre |
| REQ-AVE-027 | Récord personal local | L1 | HECHO | [race.test.ts](../../packages/engine/src/circuit/race.test.ts) «se guarda por circuito y versión, y sólo mejora» | — |
| REQ-AVE-028 | Cronómetro pequeño arriba | L1 | PARCIAL | [circuit-hud.tsx](../../apps/web/lib/mundo/circuit-hud.tsx) | Construido; sin prueba que lo nombre |
| REQ-AVE-029 | Boost de 2 s en checkpoints | L1 | HECHO | [runtime.test.ts](../../packages/engine/src/world/runtime.test.ts) «el checkpoint valida el paso y da un boost de su duración» | — |
| REQ-AVE-030 | Tres obstáculos | L1 | HECHO | [test_check.py](../../tools/spec/test_check.py) | — |
| REQ-AVE-031 | Ruta segura y atajo | L1 | HECHO | [race.test.ts](../../packages/engine/src/circuit/race.test.ts) «salida, CP1, las dos ramas con el mismo orden, CP2 y meta; versión del circuito» | — |
| REQ-AVE-032 | Intento invalidado | L1 | HECHO | [race.test.ts](../../packages/engine/src/circuit/race.test.ts) «abrir un panel, ocultar la pestaña o teletransportarse anula el intento» | — |
| REQ-AVE-033 | Récord por versión de circuito | L1 | HECHO | [race.test.ts](../../packages/engine/src/circuit/race.test.ts) «se guarda por circuito y versión, y sólo mejora» | — |
| REQ-AVE-034 | Ranking global de tiempos | L2 | L2 | — | — |
| REQ-AVE-035 | Módulo de minijuegos | L1 | PARCIAL | [host.ts](../../packages/engine/src/minigames/host.ts) | Construido; sin prueba que lo nombre |
| REQ-AVE-036 | Vigilancia del faro | L1 | HECHO | [minigames.test.ts](../../packages/engine/src/minigames/minigames.test.ts) «un pirata sin alarma se escapa» | — |
| REQ-AVE-037 | Cañón contra tiburones | L1 | HECHO | [minigames.test.ts](../../packages/engine/src/minigames/minigames.test.ts) «un tiburón sumergido no se asusta; uno asustado huye entero y otro ocupa su sitio» | — |
| REQ-AVE-038 | Sesiones de minijuego validadas | L1 | HECHO | [minigames.test.ts](../../packages/engine/src/minigames/minigames.test.ts) | — |
| REQ-AVE-039 | Accesibilidad de los minijuegos | L1 | PARCIAL | [faro.ts](../../packages/engine/src/minigames/faro.ts) | Construido; sin prueba que lo nombre; pide revisión, medición o documento |
| REQ-AVE-040 | Cinco boies informativas y la mascota | L1 | HECHO | [boies.test.ts](../../apps/web/lib/mundo/boies.test.ts) «hablar con las seis completa «Las seis boies», con el aviso n de 6 una sola vez» | — |
| REQ-IDE-001 | Todo sin cuenta | L1 | HECHO | [tickets.spec.ts](../../apps/web/e2e/tickets.spec.ts) «landing → compra de prueba → Mi Carnet; isla → compra de prueba → los dos sellos» | — |
| REQ-IDE-002 | OTP de 6 dígitos y enlace mágico | L1 | final | — | Acceso por correo (D-20) |
| REQ-IDE-003 | Vuelta al contexto tras verificar | L1 | final | — | Acceso por correo (D-20) |
| REQ-IDE-004 | Progreso local del invitado | L1 | HECHO | [accesos.spec.ts](../../apps/web/e2e/accesos.spec.ts); [mar-paridad.spec.ts](../../apps/web/e2e/mar-paridad.spec.ts) | — |
| REQ-IDE-005 | Identidad anónima de servidor | L1 | final | — | Identidad de servidor (D-20) |
| REQ-IDE-006 | Fusión idempotente | L1 | final | — | Fusión del invitado (D-20) |
| REQ-IDE-007 | Límite del progreso local explicado | L1 | HECHO | [accesos.spec.ts](../../apps/web/e2e/accesos.spec.ts) «Fotos desde la landing lleva el barco al Puerto de Fotos y abre la galería» | — |
| REQ-IDE-008 | Invitaciones en 3 contextos | L1 | HECHO | [accesos.spec.ts](../../apps/web/e2e/accesos.spec.ts); [invitations.test.ts](../../apps/web/lib/landing/invitations.test.ts) | — |
| REQ-IDE-009 | Ritmo de las invitaciones | L1 | HECHO | [invitations.test.ts](../../apps/web/lib/landing/invitations.test.ts) | — |
| REQ-IDE-010 | Carnet creado al registrarse | L1 | HECHO | [carnet.test.ts](../../apps/web/lib/mundo/carnet/carnet.test.ts) | — |
| REQ-IDE-011 | Mi Carnet en el menú | L1 | HECHO | [carnet.spec.ts](../../apps/web/e2e/carnet.spec.ts) «Carnet → botella → recargar y encontrarla → leer una de muestra → VER SU CARNET» | — |
| REQ-IDE-012 | Identidad musical, no estatus | L1 | PARCIAL | [progress.ts](../../packages/store/src/sample/progress.ts) | Construido; sin prueba que lo nombre; pide revisión, medición o documento |
| REQ-IDE-013 | Aviso de campos públicos | L1 | HECHO | [carnet.test.ts](../../apps/web/lib/mundo/carnet/carnet.test.ts) | — |
| REQ-IDE-014 | Las 5 preguntas textuales | L1 | HECHO | [schema.test.ts](../../packages/db/src/schema.test.ts); [carnet.test.ts](../../packages/store/src/carnet.test.ts) | — |
| REQ-IDE-015 | Pregunta pequeña, respuesta grande | L1 | HECHO | [carnet.test.ts](../../apps/web/lib/mundo/carnet/carnet.test.ts) «el Carnet enseña cada respuesta con su pregunta textual, en el orden de las preguntas» | — |
| REQ-IDE-016 | Preguntas editables con versión | L2 | L2 | — | — |
| REQ-IDE-017 | Carnets desde ranking y botellas | L1 | HECHO | [comunidad.spec.ts](../../apps/web/e2e/comunidad.spec.ts) «el ranking local enseña al visitante entre los miembros de muestra» | — |
| REQ-IDE-018 | Perfil público de artista | L2 | L2 | — | — |
| REQ-IDE-019 | Sin artistas vistos ni valoraciones | L1 | PARCIAL | [carnet-card.tsx](../../apps/web/lib/mundo/carnet/carnet-card.tsx) | Construido; sin prueba que lo nombre |
| REQ-IDE-020 | Miembro, bollero y tripulación | L1 | FALTA | — | — |
| REQ-IDE-021 | Sello por compra confirmada | L1 | HECHO | [ticketing.test.ts](../../apps/web/lib/ticketing/ticketing.test.ts) «confirmar dos veces la misma compra (seguidas o a la vez) deja un solo sello» | — |
| REQ-IDE-022 | Sello como recuerdo | L1 | PARCIAL | [carnet-card.tsx](../../apps/web/lib/mundo/carnet/carnet-card.tsx) | Construido; sin prueba que lo nombre; pide revisión, medición o documento |
| REQ-IDE-023 | QR alternativo de sello | L2 | L2 | — | — |
| REQ-IDE-024 | Logros que se reclaman: en curso, listos y reclamados | L1 | HECHO | [achievements.test.ts](../../apps/web/lib/mundo/achievements.test.ts) | — |
| REQ-IDE-025 | Logros de lanzamiento | L1 | PARCIAL | [achievements.test.ts](../../apps/web/lib/mundo/achievements.test.ts) | Una prueba lo cubre en parte; pide revisión, medición o documento |
| REQ-IDE-026 | Avisos legibles en cola, con cerrar | L1 | HECHO | [notifications.test.ts](../../packages/engine/src/ui/notifications.test.ts) | — |
| REQ-IDE-027 | Puntos y monedas separados | L1 | HECHO | [ledger.test.ts](../../packages/store/src/ledger.test.ts) «puntos y monedas van separados: gastar monedas no toca los puntos» | — |
| REQ-IDE-028 | Rangos lúdicos | L1 | PARCIAL | [content.ts](../../packages/store/src/content.ts) | Construido; sin prueba que lo nombre |
| REQ-IDE-029 | Economía ajustable desde el Admin | L1 | PARCIAL | [achievements.tsx](../../apps/web/app/admin/sections/achievements.tsx) | Construido; sin prueba que lo nombre |
| REQ-IDE-030 | Color, barcos y cosméticos | L1 | HECHO | [demo.spec.ts](../../apps/web/e2e/demo.spec.ts) ««Barco»: otro barco de base cambia el barco al momento y sobrevive a recargar; lo bloqueado no se pone» | — |
| REQ-IDE-031 | Barcos y cosméticos por monedas, puntos o logros | L1 | HECHO | [economy.test.ts](../../packages/store/src/economy.test.ts) «el barco por puntos se desbloquea al llegar al umbral sin gastar los puntos» | — |
| REQ-IDE-032 | Cosméticos sin efecto en la física | L1 | HECHO | [physics.test.ts](../../apps/web/lib/barco/physics.test.ts) | — |
| REQ-IDE-033 | Barco guardado | L1 | HECHO | [demo.spec.ts](../../apps/web/e2e/demo.spec.ts) ««Barco»: otro barco de base cambia el barco al momento y sobrevive a recargar; lo bloqueado no se pone» | — |
| REQ-IDE-034 | Menú de a bordo | L1 | HECHO | [hud.test.ts](../../apps/web/lib/mundo/hud.test.ts) | — |
| REQ-IDE-035 | Welcome Aboard consultable | L1 | HECHO | [mar-a-bordo.spec.ts](../../apps/web/e2e/mar-a-bordo.spec.ts) «Controles y Welcome Aboard se consultan desde el Menú» | — |
| REQ-IDE-036 | Controles | L1 | HECHO | [mar-a-bordo.spec.ts](../../apps/web/e2e/mar-a-bordo.spec.ts) «Controles y Welcome Aboard se consultan desde el Menú» | — |
| REQ-IDE-037 | Música y efectos por separado | L1 | HECHO | [juego-hud.spec.ts](../../apps/web/e2e/juego-hud.spec.ts) «Menú de a bordo: siete iconos, separación y modo de teclado guardado»; [mar-a-bordo.spec.ts](../../apps/web/e2e/mar-a-bordo.spec.ts) «Ajustes: la sensibilidad del giro la lee el motor; música, efectos e idioma se guardan» | — |
| REQ-IDE-038 | Ranking de puntos | L1 | HECHO | [community.test.ts](../../packages/store/src/community.test.ts) «ordena por puntos, con el visitante siempre dentro y su puesto» | — |
| REQ-IDE-039 | Nada competitivo desde el cliente | L1 | final | — | Validación en servidor (D-20) |
| REQ-IDE-040 | Una botella de 140 caracteres | L1 | HECHO | [carnet.test.ts](../../apps/web/lib/mundo/carnet/carnet.test.ts); [sea.test.ts](../../packages/engine/src/bottles/sea.test.ts) | — |
| REQ-IDE-041 | Leer una botella y ver su Carnet | L1 | HECHO | [bottles.test.ts](../../packages/store/src/bottles.test.ts) «leer no la quita del mar y deja la lectura; se ve el apodo y el Carnet del autor» | — |
| REQ-IDE-042 | Botellas sin premios | L1 | HECHO | [bottles.test.ts](../../packages/store/src/bottles.test.ts) | — |
| REQ-IDE-043 | Reporte y retirada | L1 | HECHO | [bottles.test.ts](../../packages/store/src/bottles.test.ts) «reportar una vez; el Admin la retira y desaparece del mar» | — |
| REQ-IDE-044 | Sin mensajes privados | L1 | FALTA | — | — |
| REQ-IDE-045 | Encuestas voluntarias | L2 | L2 | — | — |
| REQ-IDE-046 | Respuestas privadas e idempotentes | L2 | L2 | — | — |
| REQ-IDE-047 | Mensajes de BOIA | L2 | L2 | — | — |
| REQ-IDE-048 | Lectura persistente de mensajes | L2 | L2 | — | — |
| REQ-IDE-049 | Capa personal diferida | diferido | final | — | Alcance diferido |
| REQ-IDE-050 | Exportar y borrar desde la web | L2 | L2 | — | — |
| REQ-IDE-051 | Versión de prueba: invitado con apodo y botella propia | L1 | HECHO | [carnet.spec.ts](../../apps/web/e2e/carnet.spec.ts) | — |
| REQ-IDE-052 | Premio según el logro | L1 | HECHO | [achievements.test.ts](../../packages/store/src/achievements.test.ts) «monedas y puntos: a los saldos del libro» | — |
| REQ-IDE-053 | Versión de prueba: ranking local | L1 | HECHO | [comunidad.spec.ts](../../apps/web/e2e/comunidad.spec.ts); [community.test.ts](../../packages/store/src/community.test.ts) | — |
| REQ-COM-001 | Campos del evento | L1 | HECHO | [test_check.py](../../tools/spec/test_check.py) | — |
| REQ-COM-002 | Evento e isla separados | L1 | HECHO | [ciclo-evento.spec.ts](../../apps/web/e2e/ciclo-evento.spec.ts) «ciclo de un evento: publicar, agotar, finalizar, otro en la isla, posponer y cancelar» | — |
| REQ-COM-003 | Siete estados de evento | L1 | HECHO | [test_check.py](../../tools/spec/test_check.py) | — |
| REQ-COM-004 | Transiciones por fecha | L1 | HECHO | [events.test.ts](../../packages/contracts/src/events.test.ts) | — |
| REQ-COM-005 | Finalizar sin borrar la isla | L1 | HECHO | [event-card.test.ts](../../apps/web/app/%28landing%29/components/event-card.test.ts) | — |
| REQ-COM-006 | Evento nuevo en una isla con historia | L1 | HECHO | [ciclo-evento.spec.ts](../../apps/web/e2e/ciclo-evento.spec.ts) «ciclo de un evento: publicar, agotar, finalizar, otro en la isla, posponer y cancelar» | — |
| REQ-COM-007 | Agotado sin compra inválida | L1 | HECHO | [ciclo-evento.spec.ts](../../apps/web/e2e/ciclo-evento.spec.ts) «ciclo de un evento: publicar, agotar, finalizar, otro en la isla, posponer y cancelar» | — |
| REQ-COM-008 | Pospuesto y cancelado | L1 | HECHO | [ciclo-evento.spec.ts](../../apps/web/e2e/ciclo-evento.spec.ts) «ciclo de un evento: publicar, agotar, finalizar, otro en la isla, posponer y cancelar» | — |
| REQ-COM-009 | Evento prioritario vigente | L1 | HECHO | [events.test.ts](../../packages/contracts/src/events.test.ts) «el prioritario cae al primer comprable si el elegido ya no está vigente» | — |
| REQ-COM-010 | Localización comercial común | L1 | HECHO | [events.test.ts](../../packages/contracts/src/events.test.ts) | — |
| REQ-COM-011 | Próximos eventos por reglas | L1 | HECHO | [hardening.test.ts](../../apps/web/lib/admin/hardening.test.ts) «excluir un evento de «Próximos eventos» no lo borra» | — |
| REQ-COM-012 | «Elige tu evento» y fichas | L1 | HECHO | [eventos.test.ts](../../apps/web/lib/landing/eventos.test.ts) | — |
| REQ-COM-013 | Secret location protegida | L1 | HECHO | [rls.test.ts](../../packages/db/src/rls.test.ts) «el público ve eventos publicados, nunca borradores ni la secret location» | — |
| REQ-COM-014 | Ciclo de evento de 5 pasos | L1 | HECHO | [ciclo-evento.spec.ts](../../apps/web/e2e/ciclo-evento.spec.ts) | — |
| REQ-COM-015 | Adaptador de ticketera | L1 | PARCIAL | [adapter.ts](../../apps/web/lib/ticketing/adapter.ts) | Construido; sin prueba que lo nombre |
| REQ-COM-016 | Sandbox hasta contratar | L1 | PARCIAL | [sandbox.ts](../../apps/web/lib/ticketing/sandbox.ts) | Construido; sin prueba que lo nombre |
| REQ-COM-017 | Compra confirmada por webhook | L1 | PARCIAL | [index.ts](../../apps/web/lib/analytics/index.ts) | Construido; sin prueba que lo nombre |
| REQ-COM-018 | Sin webhook, QR o código | L1 | final | — | Ticketera real (D-20) |
| REQ-COM-019 | Devoluciones auditadas | L1 | final | — | Ticketera real con webhook (D-20) |
| REQ-COM-020 | Descuentos por evento | L1 | HECHO | [discounts.test.ts](../../apps/web/lib/admin/discounts.test.ts) | — |
| REQ-COM-021 | Descubrimiento premiado una vez | L1 | HECHO | [world-progress.test.ts](../../apps/web/lib/mundo/world-progress.test.ts) | — |
| REQ-COM-022 | Copiar y enlazar el descuento | L1 | HECHO | [mundo-arcilla.spec.ts](../../apps/web/e2e/mundo-arcilla.spec.ts) «descuento escondido: se copia con un toque y sólo se concede una vez» | — |
| REQ-COM-023 | Primera compra y WhatsApp | L2 | L2 | — | — |
| REQ-COM-024 | Exclusivos y códigos especiales | L2 | L2 | — | — |
| REQ-COM-025 | Check-in y asistencia | L2 | L2 | — | — |
| REQ-COM-026 | Rotación equilibrada de 3 artistas cada 5 s | L1 | HECHO | [rotation.test.ts](../../apps/web/lib/landing/rotation.test.ts) «con %i artistas la rotación es equilibrada» | — |
| REQ-COM-027 | Tarjeta de artista y A–Z | L1 | PARCIAL | [page.tsx](../../apps/web/app/%28landing%29/artistas/page.tsx) | Construido; sin prueba que lo nombre |
| REQ-COM-028 | 26 artistas textuales | L1 | HECHO | [artists-list.test.ts](../../apps/web/app/%28landing%29/components/artists-list.test.ts) «los datos son los de v14 §18.1, textuales» | — |
| REQ-COM-029 | Validación de artistas | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-COM-030 | Página Filosofía | L1 | PARCIAL | [home-blocks.ts](../../packages/contracts/src/home-blocks.ts) | Construido; sin prueba que lo nombre |
| REQ-COM-031 | Galería de fotos | L1 | HECHO | [eventos.test.ts](../../apps/web/lib/landing/eventos.test.ts) | — |
| REQ-COM-032 | Vídeos sin bloquear la carga | L1 | FALTA | — | — |
| REQ-COM-033 | Tienda L1 con enlace externo | L1 | PARCIAL | [place-panels.tsx](../../apps/web/lib/mundo/place-panels.tsx) | Construido; sin prueba que lo nombre |
| REQ-COM-034 | Tienda con checkout propio | L2 | L2 | — | — |
| REQ-COM-035 | Versión de prueba: sello por checkout sandbox | L1 | HECHO | [tickets.spec.ts](../../apps/web/e2e/tickets.spec.ts); [event-card.test.ts](../../apps/web/app/%28landing%29/components/event-card.test.ts) | — |
| REQ-COM-036 | El descuento lleva a su isla y se ve al comprar | L1 | HECHO | [descuentos.spec.ts](../../apps/web/e2e/descuentos.spec.ts); [discount-banner.test.ts](../../apps/web/lib/ticketing/discount-banner.test.ts) | — |
| REQ-ADM-001 | Contenido como datos | L1 | PARCIAL | [admin.spec.ts](../../apps/web/e2e/admin.spec.ts) | Una prueba lo cubre en parte |
| REQ-ADM-002 | Contraseña y TOTP | L1 | HECHO | [test_check.py](../../tools/spec/test_check.py) | — |
| REQ-ADM-003 | Alta única del propietario | L1 | final | — | Login del Admin (D-20) |
| REQ-ADM-004 | Roles de L1 | L1 | HECHO | [rls.test.ts](../../packages/db/src/rls.test.ts) «un editor con TOTP edita el contenido de un evento, pero no su estado» | — |
| REQ-ADM-005 | Moderador y artista | L2 | L2 | — | — |
| REQ-ADM-006 | Permisos en servidor y base de datos | L1 | final | — | RLS en Supabase (D-20) |
| REQ-ADM-007 | Acciones auditadas | L1 | HECHO | [admin-hardening.test.ts](../../packages/store/src/admin-hardening.test.ts) | — |
| REQ-ADM-008 | Secciones del Admin en L1 | L1 | PARCIAL | [admin-app.tsx](../../apps/web/app/admin/admin-app.tsx) | Construido; sin prueba que lo nombre |
| REQ-ADM-009 | Editor visual isométrico | L1 | final | — | Editor visual (D-20) |
| REQ-ADM-010 | Objeto nuevo en 10 pasos | L1 | FALTA | — | — |
| REQ-ADM-011 | Plantillas | L1 | FALTA | — | — |
| REQ-ADM-012 | Validación de assets | L1 | FALTA | — | — |
| REQ-ADM-013 | Parámetros seguros | L1 | HECHO | [admin-endurecido.spec.ts](../../apps/web/e2e/admin-endurecido.spec.ts); [hardening.test.ts](../../apps/web/lib/admin/hardening.test.ts) | — |
| REQ-ADM-014 | Validaciones de publicación | L1 | HECHO | [hardening.test.ts](../../apps/web/lib/admin/hardening.test.ts) | — |
| REQ-ADM-015 | Borrador, vista previa y publicación atómica | L1 | HECHO | [admin-endurecido.spec.ts](../../apps/web/e2e/admin-endurecido.spec.ts); [admin.spec.ts](../../apps/web/e2e/admin.spec.ts) | — |
| REQ-ADM-016 | Restaurar sin revertir transacciones | L1 | PARCIAL | [admin.test.ts](../../apps/web/lib/admin/admin.test.ts) | Una prueba lo cubre en parte |
| REQ-ADM-017 | Formulario de la home | L1 | HECHO | [admin-endurecido.spec.ts](../../apps/web/e2e/admin-endurecido.spec.ts); [hardening.test.ts](../../apps/web/lib/admin/hardening.test.ts) | — |
| REQ-ADM-018 | Ciclo de vida de eventos en el Admin | L1 | HECHO | [ciclo-evento.spec.ts](../../apps/web/e2e/ciclo-evento.spec.ts) «ciclo de un evento: publicar, agotar, finalizar, otro en la isla, posponer y cancelar» | — |
| REQ-ADM-019 | Artistas, fotos y textos | L1 | PARCIAL | [artists.tsx](../../apps/web/app/admin/sections/artists.tsx) | Construido; sin prueba que lo nombre |
| REQ-ADM-020 | Música y efectos con licencia | L1 | HECHO | [hardening.test.ts](../../apps/web/lib/admin/hardening.test.ts) | — |
| REQ-ADM-021 | Logros por triggers | L1 | HECHO | [hardening.test.ts](../../apps/web/lib/admin/hardening.test.ts) | — |
| REQ-ADM-022 | Versionar logros obtenidos | L1 | HECHO | [hardening.test.ts](../../apps/web/lib/admin/hardening.test.ts); [admin-hardening.test.ts](../../packages/store/src/admin-hardening.test.ts) | — |
| REQ-ADM-023 | Logro retroactivo | L2 | L2 | — | — |
| REQ-ADM-024 | Concesión masiva | L2 | L2 | — | — |
| REQ-ADM-025 | Edición de Carnets | L2 | L2 | — | — |
| REQ-ADM-026 | Perfiles oficiales reclamables | L2 | L2 | — | — |
| REQ-ADM-027 | Moderación de botellas | L1 | HECHO | [bottles.test.ts](../../packages/store/src/bottles.test.ts) «reportar una vez; el Admin la retira y desaparece del mar» | — |
| REQ-ADM-028 | Retirada de recompensas implausibles | L1 | HECHO | [ledger.test.ts](../../packages/store/src/ledger.test.ts) «una compensación del Admin retira el logro y su premio, una sola vez» | — |
| REQ-ADM-029 | Aviso de impacto y confirmación de borrado | L1 | HECHO | [admin-endurecido.spec.ts](../../apps/web/e2e/admin-endurecido.spec.ts); [hardening.test.ts](../../apps/web/lib/admin/hardening.test.ts) | — |
| REQ-ADM-030 | Papelera y purga | L1 | HECHO | [admin-endurecido.spec.ts](../../apps/web/e2e/admin-endurecido.spec.ts); [hardening.test.ts](../../apps/web/lib/admin/hardening.test.ts) | — |
| REQ-ADM-031 | Peticiones de datos a mano | L1 | FALTA | — | — |
| REQ-ADM-032 | Mundo activo como temporada | L1 | PARCIAL | [misc.tsx](../../apps/web/app/admin/sections/misc.tsx) | Construido; sin prueba que lo nombre |
| REQ-ADM-033 | Duplicar temporada | L2 | L2 | — | — |
| REQ-ADM-034 | Admin de encuestas | L2 | L2 | — | — |
| REQ-ADM-035 | Admin de Mensajes de BOIA | L2 | L2 | — | — |
| REQ-ADM-036 | Configuración de minijuegos | L2 | L2 | — | — |
| REQ-ADM-037 | Valores del registro contextual | L2 | L2 | — | — |
| REQ-ADM-038 | Prueba de usabilidad de 10 minutos | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-ADM-039 | Versión de prueba: «Probar admin» | L1 | HECHO | [admin.spec.ts](../../apps/web/e2e/admin.spec.ts) | — |
| REQ-ADM-040 | Moderación de Carnets | L1 | HECHO | [comunidad.spec.ts](../../apps/web/e2e/comunidad.spec.ts); [community.test.ts](../../apps/web/lib/admin/community.test.ts) | — |
| REQ-ARQ-001 | Monorepo pnpm en TypeScript estricto | L1 | HECHO | [test_check.py](../../tools/spec/test_check.py) | — |
| REQ-ARQ-002 | Supabase y Vercel | L1 | final | — | Supabase (D-20) |
| REQ-ARQ-003 | Capas separadas; la UI no escribe saldos | L1 | HECHO | [schema.test.ts](../../packages/db/src/schema.test.ts) «ningún cliente puede escribir saldos, roles, sellos, compras, libro ni estados» | — |
| REQ-ARQ-004 | ID estable y versión | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-ARQ-005 | Migraciones acumulativas | L1 | PARCIAL | [migrations.ts](../../packages/store/src/migrations.ts) | Construido; sin prueba que lo nombre |
| REQ-ARQ-006 | Datos de ejemplo etiquetados | L1 | FALTA | — | — |
| REQ-ARQ-007 | Libro de transacciones idempotente | L1 | HECHO | [rls.test.ts](../../packages/db/src/rls.test.ts) «rechaza una segunda transacción con el mismo id y concede una sola vez» | — |
| REQ-ARQ-008 | Qué se conserva entre temporadas | L1 | PARCIAL | [community.test.ts](../../packages/store/src/community.test.ts) | Una prueba lo cubre en parte |
| REQ-ARQ-009 | Auditoría con 5 campos | L1 | HECHO | [rls.test.ts](../../packages/db/src/rls.test.ts) «un cambio de estado registra autor, motivo y valores anterior y nuevo» | — |
| REQ-ARQ-010 | Recompensas con sesión firmada | L1 | final | — | Recompensas validadas en servidor (D-20) |
| REQ-ARQ-011 | Identidad pública separada | L1 | final | — | Identidad pública en servidor (D-20) |
| REQ-ARQ-012 | Seguridad web y secretos | L1 | PARCIAL | [entrega.spec.ts](../../apps/web/e2e/entrega.spec.ts); [security-headers.test.ts](../../apps/web/lib/security-headers.test.ts) | CSP y cabeceras de seguridad en next.config (T49; sin `unsafe-eval` en producción: el motor importa `pixi.js/unsafe-eval`); límites, origen y repetición llegan con el servidor (D-20) |
| REQ-ARQ-013 | Conservación de datos y copias | L1 | final | — | Copias en servidor (D-20) |
| REQ-ARQ-014 | Presupuesto de 1 MB y 5 MB | L1 | HECHO | [sectores.spec.ts](../../apps/web/e2e/sectores.spec.ts); [world-budget.test.ts](../../apps/web/scripts/world-budget.test.ts) | — |
| REQ-ARQ-015 | 30 y 60 FPS | L1 | PARCIAL | [sectors.ts](../../packages/engine/src/world/sectors.ts) | Construido; sin prueba que lo nombre; pide revisión, medición o documento |
| REQ-ARQ-016 | Matriz de accesibilidad y fallos | L1 | PARCIAL | [matriz-dispositivos.md](../../docs/matriz-dispositivos.md) | Matriz con los 16 casos: 7 con e2e, 5 parciales, 4 a mano (T49) |
| REQ-ARQ-017 | Pruebas en dispositivos físicos | L1 | FALTA | — | pide revisión, medición o documento |
| REQ-ARQ-018 | Suite automática desde el principio | L1 | FALTA | — | — |
| REQ-ARQ-019 | Analítica del embudo | L1 | PARCIAL | [game-canvas.tsx](../../apps/web/app/juego/game-canvas.tsx) | Construido; sin prueba que lo nombre |
| REQ-ARQ-020 | i18n por claves, contenido en español | L1 | HECHO | [zonas.test.ts](../../apps/web/lib/i18n/zonas.test.ts) | — |
| REQ-ARQ-021 | Inglés | L2 | L2 | — | — |
| REQ-ARQ-022 | Entornos y despliegue | L1 | final | — | Producción y dominio de BOIA (D-20) |
| REQ-ARQ-023 | Copias y restauración probada | L1 | final | — | Copias y restauración (D-20) |
| REQ-ARQ-024 | Paquete de entrega | L1 | PARCIAL | [entrega.md](../../docs/entrega.md) | Lista de entrega (T49); faltan copias, plantillas del Admin y contenido aprobado |
| REQ-ARQ-025 | Versión de prueba: repositorio en el navegador | L1 | HECHO | [storage.test.ts](../../packages/store/src/storage.test.ts) «bloqueado: pasa a memoria, lo dice y todo sigue funcionando» | — |
