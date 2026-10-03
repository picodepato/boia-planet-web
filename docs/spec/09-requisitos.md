# 09 · Requisitos

Tabla maestra: todos los REQ definidos en los archivos 01 a 08, una fila por requisito. El texto normativo completo está en el archivo del área; aquí va un título de una línea. Fuente y alcance son los de la definición y `python3 tools/spec/check.py` comprueba que coinciden, que cada REQ aparece una sola vez y que las marcas `[pendiente …]` y `[provisional]` están también en notas.

El criterio verificable es la evidencia que permite marcar el REQ como satisfactorio (REQ-PRO-017). «e2e» es una prueba automática de extremo a extremo en navegador; «test», una prueba automática; «medición», un número tomado en dispositivo; «revisión», una revisión humana registrada con fecha. «P2, prueba N» remite a las pruebas de aceptación numeradas del Prompt 2 de la v14.

## PRO · Producto y flujos

Definidos en [01-producto-y-flujos](01-producto-y-flujos.md). 21 requisitos: 21 L1, 0 L2, 0 diferidos.

| ID | Requisito | Fuente | Alcance | Criterio verificable | Notas |
|---|---|---|---|---|---|
| REQ-PRO-001 | Dos caminos: Tickets y Explorar | §2.1, §3 | L1 | En 360×640, Tickets y Explorar visibles sin scroll en el primer encuadre | — |
| REQ-PRO-002 | Comprar sin jugar ni registrarse | §2.1, §25, §26, P1 | L1 | e2e: un invitado llega al checkout sin iniciar partida ni crear cuenta | — |
| REQ-PRO-003 | Flujo comercial directo en 2 toques | §4.3, §26 | L1 | e2e: 2 toques y 0 formularios desde la landing hasta la URL de checkout | — |
| REQ-PRO-004 | Flujo experiencial sin formularios | §26, §46 | L1 | Recorrido completo en móvil físico sin formulario obligatorio, registrado en el informe del hito | — |
| REQ-PRO-005 | Juego como segunda vía de conversión | §2.1 | L1 | Cada recompensa comercial del mundo enlaza con su evento o producto; pregunta 2 de §30 respondida sí | — |
| REQ-PRO-006 | Formato All Day BOIA o satélite | §39, P2 | L1 | El esquema de evento exige formato con 2 valores; cada All Day publicado tiene isla grande | — |
| REQ-PRO-007 | Satélites sin isla principal | §39.2 | L1 | Un satélite sin isla se publica y su acceso usa la localización común | — |
| REQ-PRO-008 | Móvil táctil primero | §1, §25 | L1 | Cada entrega con front registra la prueba en móviles físicos antes que la de escritorio | — |
| REQ-PRO-009 | Más mundo, menos HUD | §14, §25, §47-A, D-23 | L1 | Captura en conducción en 360×640: sólo minimapa, menú, Inicio, saldos, brújula («Entradas» en `/mar`) y avisos temporales; sin `?debug` no hay caja de fps | HUD ampliado por D-23 (O11) |
| REQ-PRO-010 | Sin modales que detengan la navegación | §25 | L1 | Inventario de pantallas: diálogos, islas, recogidas y avisos sin modales bloqueantes | — |
| REQ-PRO-011 | Feedback con animación y sonido | §25 | L1 | Cada comportamiento con efecto visible admite animación y sonido asignables; revisión de hito | — |
| REQ-PRO-012 | Mecánicas que se entienden solas | §25 | L1 | En el hito, personas ajenas al proyecto completan tutorial y rescate sin ayuda; dudas registradas | — |
| REQ-PRO-013 | Curiosidad recompensada tras la misión | §8.3, §25, §37.13 | L1 | Tras la misión siguen activos restos, cofres, delfín, remolino, botellas y circuito | — |
| REQ-PRO-014 | Identidad BOIA coherente | §6.1, §25, §30 | L1 | Revisión de Álvaro en cada hito; pregunta 14 de §30 respondida sí | — |
| REQ-PRO-015 | Cobertura del piloto sin pérdidas | §27, §45, §47 | L1 | La tabla de cobertura de 01 no tiene filas sin REQ; desviaciones listadas en 00 | — |
| REQ-PRO-016 | Revisión de §30 en cada hito | §30 | L1 | Informe de hito con las 14 respuestas y su evidencia | — |
| REQ-PRO-017 | Estado por REQ con evidencia | §49.15, §49.18, P2 | L1 | Ningún REQ marcado satisfactorio sin enlace a una prueba real | Dónde vive el seguimiento lo decide el orquestador |
| REQ-PRO-018 | Contenido no aprobado, marcado | §33, §49.18, P1 | L1 | Al publicar, 0 elementos con etiqueta muestra o pendiente en el contenido público | — |
| REQ-PRO-019 | Contenido que aporta BOIA | §28, §33 | L1 | Cada fila de la tabla de 01 con responsable y estado; ninguna abierta al publicar | [pendiente Álvaro] |
| REQ-PRO-020 | Lista de publicación y autorización | §33, §49.18, P3 | L1 | Lista firmada por Álvaro con las 11 comprobaciones y lo no activado, fechada antes del despliegue | — |
| REQ-PRO-021 | Cuentas de producción de BOIA | §49.18, P3, D-04 | L1 | Inventario de cuentas con titular BOIA; ninguna creada por una sesión de desarrollo | — |

## ENT · Entrada y landing

Definidos en [02-entrada-y-landing](02-entrada-y-landing.md). 40 requisitos: 38 L1, 2 L2, 0 diferidos.

| ID | Requisito | Fuente | Alcance | Criterio verificable | Notas |
|---|---|---|---|---|---|
| REQ-ENT-001 | Entrada en tres actos: mini-mundo, botón y aterrizaje en el mar | §4.1, §4.4, §47-B, D-19, D-21 · alias ENT 01 | L1 | e2e al abrir `/` en móvil: aparece el mini-mundo, luego «BOIA» y el botón, y pulsarlo termina en la landing sobre el mar; grabación sin flashes, fotogramas vacíos ni saltos | D-19 sustituye la entrada sin clic de §47-B |
| REQ-ENT-002 | Sólo el botón de entrar antes de la landing; entradas siempre a mano | §4.1, §4.4, §47-B, D-19 | L1 | e2e al abrir `/`: el botón de entrar es la única acción obligatoria y el enlace a entradas lleva a Tickets sin pulsarlo | — |
| REQ-ENT-003 | Título «BOIA» en letras 3D y botón de entrar | §4.1, §47-B, D-05, D-08, D-19, D-20, D-23 | L1 | La configuración de entrada trae la secuencia renderizada de «BOIA» con la forma del wordmark y un texto de botón marcado `muestra`; con movimiento reducido, un fotograma quieto; ninguna librería 3D en el bundle; ninguna ruta muestra pantalla de bienvenida | [pendiente Álvaro] Texto definitivo del botón (P9) y letras 3D (P12) |
| REQ-ENT-004 | Dirección artística de la entrada | §4.4 | L1 | Revisión visual de ENT 06 aprobada por Álvaro | — |
| REQ-ENT-005 | Planeta 2D/2.5D reconocible | §4.4, D-05 | L1 | Revisión de ENT 06; ninguna librería 3D en el bundle | — |
| REQ-ENT-006 | Aparición, pausa, acercamiento con aplanado y llegada | §4.4, D-19 | L1 | Storyboard de los 4 tiempos aprobado y grabación que los muestra; test: la curvatura va de 1 a 0 sin retroceder durante el aterrizaje | — |
| REQ-ENT-007 | Duración por tramos (~2 s + ~2 s), nunca espera vacía | §4.4, D-19 | L1 | La configuración trae los dos tramos; con red lenta simulada aparece la landing ligera sin esperar la cinemática | — |
| REQ-ENT-008 | Sin audio y Saltar idempotente | §4.4, D-21 | L1 | Pulsar Saltar 5 veces deja 1 mundo y 1 barco; 0 audio al cargar | — |
| REQ-ENT-009 | La entrada según la URL, en cada carga de `/` | §4.4, D-21 | L1 | Una segunda carga completa de `/` reproduce la cinemática; un enlace directo (`/#tickets`, `?menu=…`) y volver a `/` dentro de la web no; «Ver la introducción» (`/?intro=1`) la reproduce | [pendiente Álvaro] Repetir la entrada en cada visita (P9) |
| REQ-ENT-010 | Movimiento reducido | §4.4 | L1 | e2e con movimiento reducido emulado: 0 desplazamientos de cámara | — |
| REQ-ENT-011 | Enlaces directos sin introducción | §4.4, §49.6 | L1 | e2e: el enlace a un evento abre su panel sin cinemática | — |
| REQ-ENT-012 | Explorar sin reiniciar el mundo, desde el puerto | §4.3, §4.4, D-20 | L1 | Tras Explorar el barco es el mismo objeto de escena y el encuadre muestra el puerto del mundo activo con el barco dentro; los gestos de la página no lo mueven | — |
| REQ-ENT-013 | La cinemática no concede nada | §4.4 | L1 | Test: 0 transacciones registradas tras la cinemática | — |
| REQ-ENT-014 | Traspaso de cámara y cancelación limpia | §4.4, P2 | L1 | Último fotograma igual a la landing; rotar o cambiar de pestaña a mitad no deja capas ni errores | — |
| REQ-ENT-015 | Configuración de entrada versionada | §4.4, P2 | L1 | La configuración es un documento versionado y validado por esquema | — |
| REQ-ENT-016 | Entrada editable desde el Admin | §4.4, P2 | L2 | Cambiar un parámetro, previsualizar y restaurar la revisión anterior desde el Admin | [provisional] Alcance: el Admin L1 de D-02 no la nombra |
| REQ-ENT-017 | HTML comercial sin motor ni JS | §4.4, §49.6, P2 | L1 | e2e con JS y con WebGL desactivados: Tickets, Fotos y Tienda operativos | — |
| REQ-ENT-018 | Arranque en blanco investigado | §4.4, P3, D-01 | L1 | Informe con cada contexto de apertura probado y su resultado | Sin piloto que reproducir (D-01) |
| REQ-ENT-019 | Controles libres al terminar | §4.4 · alias ENT 02 | L1 | Test de toques tras terminar y tras saltar: 0 capas interceptando, barco inactivo | alias ENT 02 |
| REQ-ENT-020 | Entrada resistente a fallos | §4.4 · alias ENT 03 | L1 | Matriz de 4 casos más Atrás y Saltar repetido, sin mundos duplicados | alias ENT 03 |
| REQ-ENT-021 | Revisión en dispositivos físicos | §4.4 · alias ENT 04 | L1 | Registro por dispositivo y orientación; una simulación no cuenta | alias ENT 04 |
| REQ-ENT-022 | Presupuestos de la entrada | §4.4 · alias ENT 05 | L1 | Medición contra REQ-ARQ-014 y REQ-ARQ-015 en el dispositivo de referencia | alias ENT 05 |
| REQ-ENT-023 | Storyboard y revisión visual | §4.4, P3 · alias ENT 06 | L1 | Storyboard, grabación y configuración entregados; aprobación registrada | alias ENT 06 |
| REQ-ENT-024 | Hero dentro de la escena | §4.4 | L1 | Capturas en 360×640 y 1440×900 con barco y botones visibles | — |
| REQ-ENT-025 | Primer encuadre de la landing | §4.2, §4.4, §31.2 | L1 | En 360×640, los 5 elementos visibles sin scroll | [pendiente Álvaro] Frase de posicionamiento sin aprobar |
| REQ-ENT-026 | CTA Explorar dimensionado | §4.2, §46, D-07 | L1 | Medición: alto ≥ 56 px, ancho completo hasta 480 px, pulso ≤ 4 % cada 3 s | — |
| REQ-ENT-027 | Tickets visible en 360×640 | §4.2, §4.4, D-07 | L1 | Medición: alto ≥ 44 px y visible sin scroll en 360×640 | — |
| REQ-ENT-028 | Subtítulo según promociones | §4.2, §4.4, §46 | L1 | Test con 0 y con 1 promoción vigente | [pendiente Álvaro] |
| REQ-ENT-029 | Navegación de la landing | §4.2, §4.4, D-03 | L1 | Capturas en móvil y escritorio con los 5 accesos, Mi Carnet y sonido | — |
| REQ-ENT-030 | Bloques por scroll | §4.2, §4.4 | L1 | Un bloque sin contenido publicado no se renderiza | — |
| REQ-ENT-031 | Bloques de actividades y comunidad | §4.4, P3 | L2 | Bloques disponibles en el editor de la home | [provisional] Alcance: D-02 no los nombra |
| REQ-ENT-032 | Cierre de página | §4.4, §31.2, D-23 | L1 | Pie con enlaces oficiales (Instagram incluido, también en cabecera y boia de WhatsApp), contacto y legales; ningún formulario de suscripción sin uso y tratamiento definidos | [pendiente Álvaro] Legales con revisión profesional |
| REQ-ENT-033 | Home por bloques administrables | §49.3, P1, P2 | L1 | Reordenar y ocultar un bloque y publicar cambia la home sin despliegue | — |
| REQ-ENT-034 | Tickets, Fotos y Tienda con isla visible | §4.3, §22, §49.6 | L1 | Cada acceso muestra su localización y abre el panel sin conducir; cerrar deja el barco allí | — |
| REQ-ENT-035 | Checkout sólo con acción explícita | §4.3, §49.6 | L1 | e2e: abrir el panel no navega fuera del sitio | — |
| REQ-ENT-036 | URLs compartibles y Atrás | §49.6 | L1 | e2e: Atrás desde un panel vuelve al estado anterior; la URL reabre el panel | — |
| REQ-ENT-037 | Tickets general | §4.3, §49.6 | L1 | Test con 0, 1 y 3 eventos a la venta | — |
| REQ-ENT-038 | Carga ligera primero | §49.6, P2, P3 | L1 | e2e con WebGL desactivado: isla ilustrada y panel con las mismas acciones | — |
| REQ-ENT-039 | Teletransportes sin premios | §49.6, §49.15 | L1 | Ningún teletransporte registra rescate, entrega ni descubrimiento | — |
| REQ-ENT-040 | `/mar`: botón «Entradas» siempre visible, con viaje en turbo | §2.1, §4.3, D-22 | L1 | e2e: el botón se ve al zoom de cubierta y en el modo mapa; pulsarlo y «Saltar» abre el checkout del evento vigente | — |

## MUN · Mundo y motor

Definidos en [03-mundo-y-motor](03-mundo-y-motor.md). 39 requisitos: 38 L1, 1 L2, 0 diferidos.

| ID | Requisito | Fuente | Alcance | Criterio verificable | Notas |
|---|---|---|---|---|---|
| REQ-MUN-001 | Mundo 2D/2.5D; 3D sólo en `/mar` | §1, §6.1, P1, D-22 | L1 | Ningún runtime 3D en el bundle de la landing, la entrada ni `/juego`; three.js sólo en el de `/mar`; revisión visual en el hito | — |
| REQ-MUN-002 | Motor, datos y arte separados | §6.1, §24, §48.9, §49.17 | L1 | Sustituir un asset por otro compatible sin cambiar código (ART 01) | — |
| REQ-MUN-003 | Agua viva | §6.2, P1 | L1 | Revisión visual, dentro del presupuesto de FPS | — |
| REQ-MUN-004 | Estela reactiva | §6.2, §49.17 | L1 | Grabación de los 6 estados; la estela sigue el desplazamiento real | — |
| REQ-MUN-005 | Ciclo de día y noche | P1, P3 | L2 | Cambiar la hora del ciclo desde la configuración | [provisional] Alcance: D-02 no lo nombra |
| REQ-MUN-006 | Joystick donde toca el dedo | §6.2, P1, P3, D-12 | L1 | Test táctil en físicos: el joystick nace en el punto tocado, en cualquier punto de la zona de juego | D-12 cambia el «al tocar el barco» del P1 |
| REQ-MUN-007 | Drift con segundo dedo | §6.2, P1, P3 | L1 | Test táctil en físicos: el segundo dedo activa el drift | — |
| REQ-MUN-008 | Teclado de dos modos y drift en escritorio | P1, P3, D-14 | L1 | Test de teclado en ambos modos: mover, drift, sensibilidad y preferencia guardada | — |
| REQ-MUN-009 | Física independiente de los FPS | P3 | L1 | Test del motor a 30 y 60 FPS con la misma trayectoria | — |
| REQ-MUN-010 | Sin aceleración bloqueada | P3 | L1 | Tests de dedo perdido y pestaña oculta; un barco en tierra vuelve a agua segura | — |
| REQ-MUN-011 | Costas, límite superior y zona no publicada en `/juego` | §49.7, P3, D-22 | L1 | Test de colisión con costas y de retorno desde la zona no publicada en `/juego` | — |
| REQ-MUN-012 | Carga por sectores | P1, P3, D-02 | L1 | Sólo se descargan los sectores cercanos; memoria medida en el dispositivo mínimo | — |
| REQ-MUN-013 | Contrato de mapa | §49.14, P1, P2 | L1 | Esquema del mapa en packages/world con tests de validación | — |
| REQ-MUN-014 | Misma geometría en editor y juego | P2, P3, D-04 | L1 | Test: un objeto colocado en el editor aparece en las mismas coordenadas al jugar | — |
| REQ-MUN-015 | Mapa progresivo | §49.16 | L1 | Revisión del plano de MAP 01 | — |
| REQ-MUN-016 | Plano con rutas diferenciadas | §49.16 · alias MAP 01 | L1 | Plano entregado y las 3 comprobaciones pasadas | alias MAP 01 |
| REQ-MUN-017 | Rutas de 1 y 10 minutos | §49.7, P3 | L1 | Ruta directa y ruta de exploración registradas y medidas en móvil físico | Objetivos, no garantías |
| REQ-MUN-018 | Boceto del mapa de lanzamiento | §49.14, P3, D-20 | L1 | Documento del mapa revisado por el equipo, con puerto de salida e islas de Faro y Cañón | Es el mapa compartido de REQ-MUN-035 |
| REQ-MUN-019 | Tamaño del minimapa | §10, D-07 | L1 | Medición en 360×640 y en escritorio | — |
| REQ-MUN-020 | Minimapa ampliable | §10, P1 | L1 | Test: un toque lo amplía y muestra los nombres de lo descubierto | — |
| REQ-MUN-021 | Minimapa reposicionable | §10, D-07 | L1 | Test: 500 ms entra en modo mover; la posición persiste tras recargar | — |
| REQ-MUN-022 | Brújula al objetivo | §5, §10, P3 | L1 | Test: apunta al seleccionado, si no al siguiente sin explorar, y a la isla del evento de entrada | — |
| REQ-MUN-023 | Objeto = asset + comportamientos | §9, §24, §48.1, §48.9 | L1 | Cocodrilo convertido en roca cambiando sólo el asset (P2, prueba 2) | — |
| REQ-MUN-024 | Anatomía de 9 partes | §48.2 | L1 | El esquema del objeto tiene las 9 partes | — |
| REQ-MUN-025 | 12 comportamientos del catálogo | §48.3, P2, D-02 | L1 | Cada módulo con esquema de parámetros y test propio | — |
| REQ-MUN-026 | INICIAR_MINIJUEGO con `faro` y `canon` | §48.6, §49.11, D-08, D-20 | L1 | Test: el módulo arranca `faro` y `canon` por ID y no arranca un ID desconocido | — |
| REQ-MUN-027 | Mecánica nueva una sola vez | §48.6 | L1 | Registrar un módulo nuevo lo muestra en el editor sin tocar el editor | — |
| REQ-MUN-028 | Barco por slots | §35, §35.1, §49.17 | L1 | Cambiar la bandera sustituye sólo su sprite | — |
| REQ-MUN-029 | Barco y 3 skins en 8 direcciones | §49.17, D-05 | L1 | Revisión de ART 01 | — |
| REQ-MUN-030 | Orientación correcta sin espejar | §49.17 | L1 | Revisión de las 8 direcciones; ningún sprite volteado en vertical | — |
| REQ-MUN-031 | Manifiesto por recurso | §49.17, D-05 | L1 | Validador de manifiestos en las pruebas automáticas | — |
| REQ-MUN-032 | Sprites reproducibles desde Blender | §34, D-05, D-13 | L1 | El comando de Blender sin interfaz regenera los sprites desde el repositorio | — |
| REQ-MUN-033 | Revisión de skins y sustitución | §49.17 · alias ART 01 | L1 | Revisión por skin, prueba de sustitución y restauración, guía entregada | alias ART 01 |
| REQ-MUN-034 | Formatos de assets | §34, §48.8 | L1 | El validador rechaza formatos fuera del contrato | — |
| REQ-MUN-035 | Un mapa compartido, una skin por mundo | §24, §48.9, D-20, D-23 | L1 | Test: mover un lugar cambia su posición en todos los mundos; spawn y puerto son los mismos en todos; `pnpm world:check` sale con 1 ante una skin que falta o un ID de lugar desconocido | — |
| REQ-MUN-036 | Nombres comunes y propios por mundo | D-20 | L1 | Test: renombrar «solo en este mundo» no toca los demás; «en todos los mundos» cambia el común y quita los propios; las islas de evento tienen el mismo nombre en todos | — |
| REQ-MUN-037 | Arcilla y Acuarela, con cambio de mundo | D-20 | L1 | Cambiar de mundo desde el menú deja el barco en el mismo punto y conserva descubrimientos y recompensas; cada mundo usa su barco por defecto | [pendiente Álvaro] Mundos, historias y nombres (P11) |
| REQ-MUN-038 | `/mar`: planeta de agua con cielo y estrellas | D-20, D-22 | L1 | Test: con la vuelta activada, salir por cada lado vuelve por el opuesto y el piloto automático toma el camino corto; sin ella (`/juego`) el límite no cambia; capturas del horizonte de día y de noche | [pendiente Álvaro] Planeta de agua (P14) |
| REQ-MUN-039 | Cambio de mundo por agujero negro | D-20, D-23 | L1 | e2e: al cambiar de mundo se ve el vórtice, el barco reaparece en el mismo punto con el mismo progreso y sólo cambian arte, nombres y diálogos; con movimiento reducido, fundido; un toque la salta | — |

## AVE · Aventura

Definidos en [04-aventura](04-aventura.md). 40 requisitos: 37 L1, 2 L2, 1 diferidos.

| ID | Requisito | Fuente | Alcance | Criterio verificable | Notas |
|---|---|---|---|---|---|
| REQ-AVE-001 | Primera boia en el puerto, tras el spawn | §7, P3, D-20 | L1 | En móvil, la boia es visible en el primer encuadre del puerto tras Explorar y habla sin modal | — |
| REQ-AVE-002 | Bocadillos legibles, con cerrar y salto | §7, §25, §47-A, D-07, D-22 | L1 | Test: duración = máx(3 s, regla por longitud) con tope de 8 s; el botón de cerrar lo quita al momento; un toque avanza; alejarse interrumpe; igual en `/mar` y `/juego` | [provisional] Valores de la regla por longitud |
| REQ-AVE-003 | Guion del tutorial | §7, §31.2 | L1 | Texto aprobado por Álvaro cargado | [pendiente Álvaro] |
| REQ-AVE-004 | Pulsos del ancla y del minimapa | §7, §10, §46, P3 | L1 | Grabación: la última intervención hace pulsar el ancla; el minimapa pulsa 1–2 s sin abrirse; la explicación no se repite | — |
| REQ-AVE-005 | Boia Fiestera entre cocodrilos | §8.1, P3 | L1 | Grabación del encuentro con 3 o 4 cocodrilos que se sumergen uno a uno | — |
| REQ-AVE-006 | Rescate y aviso de tripulante | §8.1, D-08 | L1 | Grabación de la subida al barco y del aviso con su texto | — |
| REQ-AVE-007 | Boia Fiestera visible a bordo | §8.2, §35.1 | L1 | Captura durante el trayecto: pasajera visible, sin HUD de misión | — |
| REQ-AVE-008 | Entrega en la última isla | §8.3, P3 | L1 | Test de llegada por 2 lados; logro y recompensa concedidos 1 vez | [pendiente Álvaro] |
| REQ-AVE-009 | Mundo abierto y desvíos | §8.3, §46, P3 | L1 | Tras rescatar, visitar 3 encuentros y recargar conserva la misión | — |
| REQ-AVE-010 | Destino por ID de lugar y de temporada | §13, §49.7, P1, D-20 | L1 | Cambiar la prioridad, añadir una isla o cambiar de mundo no altera una misión iniciada; publicar sin destino falla | — |
| REQ-AVE-011 | Cambio de destino auditado | §49.7 | L1 | Cambiar el destino de partidas existentes exige migración con vista previa y auditoría | — |
| REQ-AVE-012 | Islas por radio amplio | §9, §46 | L1 | Test: entrar en el radio activa la isla sin tocar el puerto | — |
| REQ-AVE-013 | Primera llegada y visitas | §9 | L1 | Test de primera llegada y de visita posterior | — |
| REQ-AVE-014 | Recuerdos y próximos eventos en la isla | §9, §48.5, §49.6 | L1 | Test con y sin fotos; ninguna tarjeta enlaza a tickets pasados | — |
| REQ-AVE-015 | Secretos insinuados | §9, §25, P1 | L1 | Un secreto configurado sin código y sin tapar el acceso comercial | — |
| REQ-AVE-016 | Restos regenerables | §11.1, D-09 | L1 | Test: recoger, recargar y ver restos en posiciones nuevas | Con los límites de D-09 |
| REQ-AVE-017 | Cofres fugaces | §11.2 | L1 | Test: el cofre desaparece a su tiempo y premia si se alcanza antes | — |
| REQ-AVE-018 | Delfín guía | §11.3, D-23 | L1 | Test: aparece junto al barco en mar abierto con un intervalo entre 2 y 4 min, apunta a algo sin descubrir y seguirlo lleva a su recompensa | — |
| REQ-AVE-019 | Remolino | §11.4 | L1 | Test: más tiempo dentro da más recompensa | — |
| REQ-AVE-020 | Náufrago con descuento | §12 | L1 | Test: acercarlo entrega el código configurado | [pendiente Álvaro] Valor y código reales de Álvaro |
| REQ-AVE-021 | Descuentos de tienda en restos | §12 | L1 | Test: un resto configurado entrega un código de tienda | [pendiente Álvaro] |
| REQ-AVE-022 | Puerto de Fotos | §4.3, P1, P3 | L1 | Fotos desde la landing lleva al puerto y abre la galería | — |
| REQ-AVE-023 | Boia de WhatsApp | §4.4, P1, P3 | L1 | Por proximidad abre el enlace configurado | [pendiente Álvaro] [provisional] Alcance: D-02 no la nombra; enlace real de Álvaro |
| REQ-AVE-024 | Boia musical | P1, P3 | L2 | Reproduce 4 pistas con derechos | [provisional] Alcance: D-02 no la nombra |
| REQ-AVE-025 | Ideas musicales en reserva | §11.5, D-02 | diferido | No se implementa | La v14 ya las deja en reserva |
| REQ-AVE-026 | Circuito lateral como atajo | §13, §49.16 | L1 | La salida del circuito lleva al destino configurado (MAP 01) | — |
| REQ-AVE-027 | Récord personal local | §13, P3, D-09 | L1 | Test: el mejor tiempo persiste en el dispositivo | — |
| REQ-AVE-028 | Cronómetro pequeño arriba | §13, §47-A | L1 | Captura en carrera: cronómetro arriba sin tapar el trazado | — |
| REQ-AVE-029 | Boost de 2 s en checkpoints | §13, §46, D-07 | L1 | Test: boost de 2 s con su sonido | — |
| REQ-AVE-030 | Tres obstáculos | §13, §46, §48.5 | L1 | Test de cada obstáculo con su efecto | [provisional] Contradicción §13 frente a §48.5 |
| REQ-AVE-031 | Ruta segura y atajo | §13, §46 | L1 | Plano: ambas rutas se unen antes de meta | — |
| REQ-AVE-032 | Intento invalidado | P3 | L1 | Test de los 4 casos: panel, pestaña, recarga y teletransporte | — |
| REQ-AVE-033 | Récord por versión de circuito | P1, P3, D-02 | L1 | Cambiar el trazado crea versión y separa los récords | — |
| REQ-AVE-034 | Ranking global de tiempos | §13, §21, P3, D-02, D-09 | L2 | Un tiempo sin sesión válida es rechazado por el servidor | — |
| REQ-AVE-035 | Módulo de minijuegos | §49.11, P3, D-20 | L1 | Entrar y salir de un minijuego vuelve a la misma posición | Adelantado de L2 (D-20) |
| REQ-AVE-036 | Vigilancia del faro | §49.11, P3, D-20 | L1 | Partidas con 5 piratas, señuelos, falsa alarma, pirata perdido, pausa, pestaña oculta, cambio de configuración y movimiento reducido | Adelantado de L2 (D-20) |
| REQ-AVE-037 | Cañón contra tiburones | §49.11, P3, D-20 | L1 | Partidas con acierto, fallo, objetivo que se sumerge, 3 impactos, munición agotada, pausa y control táctil | Adelantado de L2 (D-20) |
| REQ-AVE-038 | Sesiones de minijuego validadas | P3, D-09, D-20 | L1 | Petición repetida, resultado falseado y sesión caducada sin premio; única, por temporada y límites diarios sin duplicados, con invitado y con cuenta | Sin repetición de decisiones (D-09); en la versión de prueba, validación local y servidor en la versión final (D-20) |
| REQ-AVE-039 | Accesibilidad de los minijuegos | P3, D-20 | L1 | Revisión con movimiento reducido, sin audio y con teclado; equilibrio, claridad y accesibilidad documentados | Adelantado de L2 (D-20) |
| REQ-AVE-040 | Cinco boies informativas y la mascota | §7, §14, D-23 | L1 | Test: el mapa compartido tiene 6 boies que hablan, cada mundo trae el texto de las 5 nuevas y hablar con las 6 completa el logro; revisión de arte: las boies parten de la mascota | — |

## IDE · Identidad y comunidad

Definidos en [05-identidad-y-comunidad](05-identidad-y-comunidad.md). 53 requisitos: 44 L1, 8 L2, 1 diferidos.

| ID | Requisito | Fuente | Alcance | Criterio verificable | Notas |
|---|---|---|---|---|---|
| REQ-IDE-001 | Todo sin cuenta | §4.1, §47-B, §49.10 | L1 | e2e completo como invitado sin pantalla de login | — |
| REQ-IDE-002 | OTP de 6 dígitos y enlace mágico | P1, P3, D-10 | L1 | Test: el mismo correo trae código y enlace, y ambos abren sesión | — |
| REQ-IDE-003 | Vuelta al contexto tras verificar | §49.10, P3 | L1 | e2e: registrarse desde un evento vuelve a ese evento | — |
| REQ-IDE-004 | Progreso local del invitado | §49.10, P1 | L1 | Recargar como invitado conserva preferencias, posición y descubrimientos | — |
| REQ-IDE-005 | Identidad anónima de servidor | §49.10, D-09 | L1 | Test: el premio del invitado queda en el servidor; un saldo local alterado se ignora | — |
| REQ-IDE-006 | Fusión idempotente | §49.10, P1 | L1 | Fusionar dos veces no duplica logros ni saldos | — |
| REQ-IDE-007 | Límite del progreso local explicado | §49.10 | L1 | Texto visible antes de registrarse | [pendiente Álvaro] |
| REQ-IDE-008 | Invitaciones en 3 contextos | §49.10, P3 | L1 | Test de los 3 contextos; la compra sigue sin registro | [provisional] Alcance: D-02 no las nombra |
| REQ-IDE-009 | Ritmo de las invitaciones | §49.10 | L1 | Test: ≥ 3 min entre avisos, ≤ 3 por sesión, ninguno en carrera, diálogo o pago | [provisional] Alcance: D-02 no las nombra |
| REQ-IDE-010 | Carnet creado al registrarse | §40, §40.1, §42.1, P1 | L1 | Test: crear la cuenta crea el Carnet con fecha de alta | — |
| REQ-IDE-011 | Mi Carnet en el menú | §16.1, §46, D-08 | L1 | Test: vista pública primero, Editar, y Crear sin cuenta | — |
| REQ-IDE-012 | Identidad musical, no estatus | §16.1, §37.12, §40.3 | L1 | Revisión de diseño en el hito | — |
| REQ-IDE-013 | Aviso de campos públicos | §49.13 | L1 | Test: el aviso aparece antes de crear; el email no está en los datos públicos | — |
| REQ-IDE-014 | Las 5 preguntas textuales | §44.1, D-08 | L1 | check.py encuentra las 5 preguntas | — |
| REQ-IDE-015 | Pregunta pequeña, respuesta grande | §16.2, §44.4 | L1 | Captura de un Carnet con respuestas | — |
| REQ-IDE-016 | Preguntas editables con versión | §16.2, §28 | L2 | Cambiar una pregunta crea versión nueva | [provisional] Alcance: D-02 no lo nombra |
| REQ-IDE-017 | Carnets desde ranking y botellas | §16.3, §43 | L1 | Test: ambos accesos abren el Carnet | — |
| REQ-IDE-018 | Perfil público de artista | §16.3, §18, D-02 | L2 | Test: la tarjeta de artista abre su perfil | — |
| REQ-IDE-019 | Sin artistas vistos ni valoraciones | §40.2, §42.3, §46 | L1 | El esquema del Carnet no tiene esos campos | — |
| REQ-IDE-020 | Miembro, bollero y tripulación | §40.3, §44.2, §46, D-08 | L1 | Búsqueda de «tripulación» en los textos de usuario: 0 resultados | — |
| REQ-IDE-021 | Sello por compra confirmada | §42.2, §46, §49.12, P1 | L1 | Webhook repetido 2 veces deja 1 sello; volver de la ticketera no crea sello | — |
| REQ-IDE-022 | Sello como recuerdo | §42.2 | L1 | Revisión de diseño en el hito | — |
| REQ-IDE-023 | QR alternativo de sello | §42.2, §46, D-06 | L2 | Un QR válido añade el sello una sola vez | [provisional] Alcance: D-02 sólo nombra el check-in por QR |
| REQ-IDE-024 | Logros que se reclaman: en curso, listos y reclamados | §14, P3, D-22 | L1 | Test: completar deja el logro listo sin conceder nada; «Reclamar» concede una vez; la sección muestra el contador, el progreso y «te queda…» en `/mar` y `/juego` | — |
| REQ-IDE-025 | Logros de lanzamiento | §14, §28, §33, D-22 | L1 | Lista aprobada cargada como datos; el catálogo de `docs/propuestas/logros-catalogo.md` aprobado por Hernán | [pendiente Álvaro] |
| REQ-IDE-026 | Avisos legibles en cola, con cerrar | §14, §46, P3, D-07, D-08, D-22 | L1 | Test: 3 logros seguidos se muestran uno a uno, cada uno al menos 3 s y más si el texto es largo; cerrar pasa al siguiente tras su pausa | — |
| REQ-IDE-027 | Puntos y monedas separados | §14, §21, P1 | L1 | Gastar monedas no cambia rango ni ranking | — |
| REQ-IDE-028 | Rangos lúdicos | §14, P3 | L1 | Cambiar un umbral desde el Admin recalcula el rango mostrado | [pendiente Álvaro] |
| REQ-IDE-029 | Economía ajustable desde el Admin | §28, §33, §36, P1 | L1 | Cambiar un premio, un precio o un umbral desde el Admin, sin despliegue | [pendiente Álvaro] |
| REQ-IDE-030 | Color, barcos y cosméticos | §15, D-02, D-23 | L1 | Cambiar color y skin desde Mi Barco; con el progreso vacío sólo B05 y B02 están desbloqueados y el resto enseña precio o condición | [pendiente Álvaro] Catálogo inicial de Álvaro |
| REQ-IDE-031 | Barcos y cosméticos por monedas, puntos o logros | §6.2, §15, D-22, D-23 | L1 | Test: comprar un barco y una skin con monedas (un solo cargo por compra), desbloquear el barco de puntos al llegar al umbral sin perder puntos, y recibir un cosmético y un barco al reclamar un logro | — |
| REQ-IDE-032 | Cosméticos sin efecto en la física | §15, §49.17 | L1 | Test: tiempos y colisiones iguales con distintas skins | — |
| REQ-IDE-033 | Barco guardado | §15, §49.10 | L1 | Recargar conserva el barco con cuenta y como invitado | — |
| REQ-IDE-034 | Menú de a bordo | §19, §46 | L1 | Captura del menú con los 7 accesos | [provisional] Contradicción: «Inicio» en §19 y en §4.4 |
| REQ-IDE-035 | Welcome Aboard consultable | §19, §46 | L1 | El tutorial termina sin abrirlo; el menú lo abre | — |
| REQ-IDE-036 | Controles | §19 | L1 | La sección explica navegación, drift y minimapa | — |
| REQ-IDE-037 | Música y efectos por separado | §20 | L1 | Test: silenciar la música mantiene los efectos; las preferencias persisten | — |
| REQ-IDE-038 | Ranking de puntos | §21, P3 | L1 | Ordenado por puntos, histórico y de temporada, con posición propia | En la versión de prueba, ranking local (REQ-IDE-053) |
| REQ-IDE-039 | Nada competitivo desde el cliente | §21, P3, D-09 | L1 | Test: un saldo enviado por el cliente es rechazado | — |
| REQ-IDE-040 | Una botella de 140 caracteres | §17, P1, P3, D-02 | L1 | El servidor rechaza 141 caracteres y una segunda botella activa | — |
| REQ-IDE-041 | Leer una botella y ver su Carnet | §17, §46, P3 | L1 | Test: leerla no la borra y abre el Carnet del autor | — |
| REQ-IDE-042 | Botellas sin premios | §17, P1 | L1 | Test: escribir y leer no crea transacciones | — |
| REQ-IDE-043 | Reporte y retirada | §17, P3 | L1 | Retirar una botella la quita del mundo publicado | — |
| REQ-IDE-044 | Sin mensajes privados | §44.2, §44.3, §46, D-02 | L1 | No existe ruta ni tabla de mensajes entre usuarios | — |
| REQ-IDE-045 | Encuestas voluntarias | §49.8 | L2 | «Ahora no» siempre disponible; nunca bloquea | — |
| REQ-IDE-046 | Respuestas privadas e idempotentes | §49.8 | L2 | Un envío repetido deja 1 respuesta, que no aparece en el Carnet | — |
| REQ-IDE-047 | Mensajes de BOIA | §49.9 | L2 | Mensaje visible para invitado y miembro; no interrumpe una carrera | — |
| REQ-IDE-048 | Lectura persistente de mensajes | §49.9 | L2 | Leído persiste; una errata no remarca y una revisión importante sí; el caducado sale de no leídos | — |
| REQ-IDE-049 | Capa personal diferida | §40.2, §42.4, §44.2, §44.4, D-02 | diferido | No se implementa; el esquema no la impide | — |
| REQ-IDE-050 | Exportar y borrar desde la web | §49.13, D-02 | L2 | Solicitud desde la web gestionada de principio a fin | — |
| REQ-IDE-051 | Versión de prueba: invitado con apodo y botella propia | D-20 | L1 | e2e sin correo: crear apodo, Carnet y botella; un segundo navegador no ve esa botella; la pantalla dice que todo se guarda en este navegador | Sólo versión de prueba; se retira con REQ-IDE-002 |
| REQ-IDE-052 | Premio según el logro | §14, §15, §28, D-22 | L1 | Test: cada tipo de premio (monedas y puntos, insignia, barco, cosmético) llega a su sitio al reclamar y sólo una vez | [pendiente Álvaro] Economía y catálogo (P14) |
| REQ-IDE-053 | Versión de prueba: ranking local | D-20, D-23 | L1 | e2e: el ranking ordena por puntos al visitante y a los miembros `muestra`, destaca su posición, abre el Carnet de una fila y lleva el rótulo de ranking local | Sólo versión de prueba; se retira con REQ-IDE-038 validado en servidor |

## COM · Comercial

Definidos en [06-comercial](06-comercial.md). 36 requisitos: 32 L1, 4 L2, 0 diferidos.

| ID | Requisito | Fuente | Alcance | Criterio verificable | Notas |
|---|---|---|---|---|---|
| REQ-COM-001 | Campos del evento | §5, §23.2, P2 | L1 | Esquema del evento con todos los campos | — |
| REQ-COM-002 | Evento e isla separados | §49.4, P1, P2 | L1 | Reutilizar una isla conserva su archivo | — |
| REQ-COM-003 | Siete estados de evento | §49.4, P1 | L1 | Test por estado contra la tabla de 06 | — |
| REQ-COM-004 | Transiciones por fecha | §49.4, P2, D-04 | L1 | Test de la tarea programada con fechas simuladas y corrección manual auditada | — |
| REQ-COM-005 | Finalizar sin borrar la isla | §49.4, P1, P3 | L1 | Paso 3 del ciclo de REQ-COM-014 | — |
| REQ-COM-006 | Evento nuevo en una isla con historia | §49.4, P1, P2 | L1 | Paso 4 del ciclo de REQ-COM-014 | — |
| REQ-COM-007 | Agotado sin compra inválida | §49.4, §49.15 | L1 | Paso 2 del ciclo de REQ-COM-014 | — |
| REQ-COM-008 | Pospuesto y cancelado | §49.4 | L1 | Paso 5 del ciclo de REQ-COM-014 | [pendiente Álvaro] Política de Álvaro |
| REQ-COM-009 | Evento prioritario vigente | §2.1, §4.4, §5, §24 | L1 | Cambiar el prioritario no requiere despliegue; uno finalizado deja de ofrecerse | — |
| REQ-COM-010 | Localización comercial común | §39.2, §39.3, §49.6, D-23 | L1 | Un evento sin isla abre su panel en la localización común (la isla All Day vigente) y sale en Tickets con «Calienta para el próximo All Day» y enlace al All Day | — |
| REQ-COM-011 | Próximos eventos por reglas | §49.3, P1, P2 | L1 | Excluir un evento lo quita de la home sin borrarlo | — |
| REQ-COM-012 | «Elige tu evento» y fichas | §5, P3, D-02 | L1 | Cada evento con ficha HTML compartible; invitación a su isla visible | — |
| REQ-COM-013 | Secret location protegida | P3 | L1 | Búsqueda de la dirección en respuestas públicas: 0 resultados | — |
| REQ-COM-014 | Ciclo de evento de 5 pasos | §49.15, P2, P3 | L1 | Suite e2e con los 5 pasos, sin despliegue entre ellos | — |
| REQ-COM-015 | Adaptador de ticketera | §49.18, P1, D-06, D-08 | L1 | ADR comparativo entregado; la elección es de Álvaro | [pendiente Álvaro] |
| REQ-COM-016 | Sandbox hasta contratar | P3, D-06 | L1 | Pruebas contra sandbox; procedimiento de activación documentado | — |
| REQ-COM-017 | Compra confirmada por webhook | P1, P3, D-06 | L1 | Webhook firmado confirma; repetido no duplica; sin firma se rechaza | — |
| REQ-COM-018 | Sin webhook, QR o código | §42.2, D-06 | L1 | Con un proveedor sin webhook, la compra se registra por el código del email | — |
| REQ-COM-019 | Devoluciones auditadas | §49.12 | L1 | Un webhook de devolución invalida ticket y sello con ajuste auditado | [pendiente Álvaro] |
| REQ-COM-020 | Descuentos por evento | §12, §49.12 | L1 | Un descuento con fechas y condiciones aparece en su evento | [pendiente Álvaro] Códigos reales de Álvaro |
| REQ-COM-021 | Descubrimiento premiado una vez | §49.12, P3 | L1 | Copiar 2 veces premia 1 vez; el caducado aparece marcado | — |
| REQ-COM-022 | Copiar y enlazar el descuento | §2.1, §12, P3 | L1 | Un toque copia; el enlace abre el evento | — |
| REQ-COM-023 | Primera compra y WhatsApp | §49.12, D-02 | L2 | Verificación real configurada, o promoción presentada como código | — |
| REQ-COM-024 | Exclusivos y códigos especiales | §49.12, D-02 | L2 | Cerrada la ventana, no hay nuevas concesiones y se conservan las existentes | — |
| REQ-COM-025 | Check-in y asistencia | §49.12, D-02 | L2 | Un check-in repetido no duplica la asistencia | — |
| REQ-COM-026 | Rotación equilibrada de 3 artistas cada 5 s | §18, §47-A, P3, D-07 | L1 | Test de 100 rotaciones: sin duplicados en el trío ni repetición inmediata, y apariciones por artista que no difieren en más de 1 por vuelta completa | — |
| REQ-COM-027 | Tarjeta de artista y A–Z | §18, P3 | L1 | Captura de una tarjeta con avatar neutro y del A–Z | — |
| REQ-COM-028 | 26 artistas textuales | §18.1, P1, P3 | L1 | Datos con 26 nombres y géneros iguales a la tabla de 06 | — |
| REQ-COM-029 | Validación de artistas | §33, P1 | L1 | Aprobación de Álvaro registrada antes de publicar | [pendiente Álvaro] |
| REQ-COM-030 | Página Filosofía | §22, §31, §36 | L1 | Textos aprobados publicados | [pendiente Álvaro] |
| REQ-COM-031 | Galería de fotos | §22, §49.6, P3, D-23 | L1 | Todas las imágenes con texto alternativo; la home sólo trae fotos «selección»; «Ver fotos de la isla» abre «Fotos y eventos» en la galería de esa isla | — |
| REQ-COM-032 | Vídeos sin bloquear la carga | §4.4, §49.6, P3 | L1 | La home carga sin descargar vídeos completos | [provisional] Alcance: D-02 dice «fotos» |
| REQ-COM-033 | Tienda L1 con enlace externo | §4.3, §22, §49.6, D-02 | L1 | Tienda desde la landing muestra la isla y el enlace externo | [pendiente Álvaro] [provisional] Alcance: §49.6 frente a «enlace externo» de D-02 |
| REQ-COM-034 | Tienda con checkout propio | §22, P3, D-02 | L2 | Compra en sandbox sin datos de tarjeta guardados | — |
| REQ-COM-035 | Versión de prueba: sello por checkout sandbox | D-06, D-20, D-22 | L1 | e2e: confirmar la compra de prueba añade 1 sello y 1 logro; repetir con el mismo ID de compra no añade nada; el checkout se rotula como prueba | Sólo versión de prueba; se retira con la ticketera real (P2) |
| REQ-COM-036 | El descuento lleva a su isla y se ve al comprar | §2.1, §12, D-23 | L1 | e2e: «Ir a la isla» de una tarjeta lleva el barco a la isla de su evento; comprar allí muestra el aviso con el código y el ahorro aplicado en el checkout sandbox; el de tienda enseña «Ir a la tienda» | — |

## ADM · Admin

Definidos en [07-admin](07-admin.md). 40 requisitos: 30 L1, 10 L2, 0 diferidos.

| ID | Requisito | Fuente | Alcance | Criterio verificable | Notas |
|---|---|---|---|---|---|
| REQ-ADM-001 | Contenido como datos | §23, §24, §30 | L1 | Cambiar prioritario, cartel, URL, diálogo y spawn sin despliegue | — |
| REQ-ADM-002 | Contraseña y TOTP | §49.13, P2, D-10 | L1 | Login sin TOTP rechazado; la recuperación no cambia roles | — |
| REQ-ADM-003 | Alta única del propietario | §49.13, P1, P2, D-10 | L1 | 0 contraseñas en repositorio y documentos; cambio forzado en el primer acceso | — |
| REQ-ADM-004 | Roles de L1 | §49.13, P1, P2, D-02 | L1 | Tests de permisos: el editor no publica, el administrador no transfiere la propiedad | — |
| REQ-ADM-005 | Moderador y artista | P1, P2 | L2 | Tests de permisos de ambos roles | [provisional] Alcance: D-02 sólo nombra tres roles |
| REQ-ADM-006 | Permisos en servidor y base de datos | P2, D-04 | L1 | Test: la petición manipulada de un miembro es rechazada por RLS | — |
| REQ-ADM-007 | Acciones auditadas | P1, P2 | L1 | Cada acción de la lista deja registro | — |
| REQ-ADM-008 | Secciones del Admin en L1 | P2, D-02 | L1 | La navegación del Admin muestra sólo las secciones de L1 | [provisional] Alcance: Resumen, Integraciones, cosméticos y Temporadas |
| REQ-ADM-009 | Editor visual isométrico | §23.1, P1, P2 | L1 | P2, prueba 1: crear, colocar, publicar y restaurar una isla | — |
| REQ-ADM-010 | Objeto nuevo en 10 pasos | §23.2, §48.4 | L1 | Crear un obstáculo sin código siguiendo los 10 pasos | — |
| REQ-ADM-011 | Plantillas | §48.7 | L1 | Duplicar una plantilla conserva comportamientos y parámetros | — |
| REQ-ADM-012 | Validación de assets | §48.8, P2 | L1 | Un asset fuera de formato o de peso es rechazado | — |
| REQ-ADM-013 | Parámetros seguros | §48.8 | L1 | Un parámetro fuera de rango es rechazado; un objeto fuera del mar, advertido | — |
| REQ-ADM-014 | Validaciones de publicación | §49.7, P1, P2 | L1 | Un test por cada caso bloqueante | — |
| REQ-ADM-015 | Borrador, vista previa y publicación atómica | §23.4, §48.8, P2 | L1 | La vista previa no crea transacciones; publicar cambia la versión activa de una vez | — |
| REQ-ADM-016 | Restaurar sin revertir transacciones | §48.8, P2, P3 | L1 | P2, prueba 8: restaurar no altera compras ni recompensas | — |
| REQ-ADM-017 | Formulario de la home | §49.3, P1, P2 | L1 | Editar y publicar la home sin HTML libre; vista previa en móvil y escritorio | — |
| REQ-ADM-018 | Ciclo de vida de eventos en el Admin | P2 | L1 | Cada acción probada | — |
| REQ-ADM-019 | Artistas, fotos y textos | §31.2, P2, D-02 | L1 | Editar cada uno y verlo publicado | — |
| REQ-ADM-020 | Música y efectos con licencia | §34, P2, P3 | L1 | Subir una pista con licencia desde el Admin y oírla publicada | [pendiente Álvaro] [provisional] Alcance: D-02 nombra «textos», no música |
| REQ-ADM-021 | Logros por triggers | §23.3, §49.1, P2 | L1 | Un logro creado y publicado desde el Admin aparece a todas las cuentas | — |
| REQ-ADM-022 | Versionar logros obtenidos | P2 | L1 | Cambiar la condición crea versión; desactivar no quita lo concedido | — |
| REQ-ADM-023 | Logro retroactivo | §49.1, P2, D-02 | L2 | P2, prueba 4: cada cuenta elegible lo recibe 1 vez | — |
| REQ-ADM-024 | Concesión masiva | §49.1, P1, P2, D-02 | L2 | P2, prueba 5: reintentar no duplica puntos ni monedas | — |
| REQ-ADM-025 | Edición de Carnets | §49.2, P1, P2 | L2 | P2, prueba 7: auditoría registrada; editor y miembro rechazados | [provisional] Alcance: D-02 no la nombra |
| REQ-ADM-026 | Perfiles oficiales reclamables | §49.2, P2, D-02 | L2 | P2, prueba 6: reclamar vincula sin duplicar | — |
| REQ-ADM-027 | Moderación de botellas | §17, §23.2, D-02 | L1 | Retirar una botella reportada la quita del mundo | — |
| REQ-ADM-028 | Retirada de recompensas implausibles | D-09 | L1 | Retirar una recompensa crea una compensación auditada | — |
| REQ-ADM-029 | Aviso de impacto y confirmación de borrado | §49.13, P2 | L1 | Editar un objeto referenciado muestra su impacto; borrar sin escribir el nombre falla | — |
| REQ-ADM-030 | Papelera y purga | §49.13, P2 | L1 | Recuperar un archivado; purgar pide reautenticación | [pendiente Álvaro] |
| REQ-ADM-031 | Peticiones de datos a mano | §49.13, D-02 | L1 | Procedimiento documentado y probado una vez | [provisional] Alcance: D-02 sólo nombra el autoservicio web |
| REQ-ADM-032 | Mundo activo como temporada | §21, §23.4, §49.7, P1, D-02, D-20, D-23 | L1 | Mundo, destino y ranking de temporada comparten el ID del mundo activo; spawn y puerto son los del mapa compartido en todos los mundos; cambiarlo en el Admin cambia el mundo por defecto de quien llega | — |
| REQ-ADM-033 | Duplicar temporada | §23.4, P2, D-02 | L2 | Duplicar no copia cuentas ni ventas; restaurar funciona | — |
| REQ-ADM-034 | Admin de encuestas | §49.8 | L2 | Resultados agregados sin datos de contacto | — |
| REQ-ADM-035 | Admin de Mensajes de BOIA | §49.9 | L2 | Un mensaje programado aparece y caduca a su hora | — |
| REQ-ADM-036 | Configuración de minijuegos | §49.11, P2, P3 | L2 | Publicar una configuración nueva no altera partidas iniciadas | — |
| REQ-ADM-037 | Valores del registro contextual | §49.10 | L2 | Cambiar un valor en el Admin cambia el ritmo | [provisional] Alcance: D-02 no lo nombra |
| REQ-ADM-038 | Prueba de usabilidad de 10 minutos | P3 | L1 | Registro de la prueba con tiempo y dudas | — |
| REQ-ADM-039 | Versión de prueba: «Probar admin» | D-20 | L1 | e2e: «Probar admin» abre el Admin sin login con el aviso de demo; un cambio queda en la auditoría local y se puede volver a los datos de muestra | Sólo versión de prueba; se retira con REQ-ADM-002 |
| REQ-ADM-040 | Moderación de Carnets | §23.2, §49.2, D-23 | L1 | e2e: reportar un Carnet lo pone en Moderación; ocultar una respuesta, la foto o restablecer el apodo cambia el Carnet público y deja una entrada de auditoría | — |

## ARQ · Arquitectura y datos

Definidos en [08-arquitectura-y-datos](08-arquitectura-y-datos.md). 25 requisitos: 24 L1, 1 L2, 0 diferidos.

| ID | Requisito | Fuente | Alcance | Criterio verificable | Notas |
|---|---|---|---|---|---|
| REQ-ARQ-001 | Monorepo pnpm en TypeScript estricto | P2, D-04 | L1 | pnpm install y pnpm test pasan en limpio; tsconfig estricto | D-04 se confirma en un ADR |
| REQ-ARQ-002 | Supabase y Vercel | D-04 | L1 | RLS activa en todas las tablas del proyecto de desarrollo | — |
| REQ-ARQ-003 | Capas separadas; la UI no escribe saldos | §24, P2 | L1 | Test de RLS: el cliente no escribe saldos, roles, sellos ni compras | — |
| REQ-ARQ-004 | ID estable y versión | P2, D-02 | L1 | Revisión del esquema: toda entidad con ID y versión | — |
| REQ-ARQ-005 | Migraciones acumulativas | P2 | L1 | P2, prueba 10: base vacía y base con datos | — |
| REQ-ARQ-006 | Datos de ejemplo etiquetados | §33, P2 | L1 | Procedimiento de borrado probado; ejemplos sin secretos | — |
| REQ-ARQ-007 | Libro de transacciones idempotente | §49.1, P1, P2, P3 | L1 | Tests de repetición, concurrencia y fallo parcial | — |
| REQ-ARQ-008 | Qué se conserva entre temporadas | §28, P1 | L1 | Cambiar de temporada conserva lo global y separa lo de temporada | — |
| REQ-ARQ-009 | Auditoría con 5 campos | §49.2, §49.13, P2 | L1 | Cada corrección sensible con autor, fecha, motivo, valor anterior y nuevo | — |
| REQ-ARQ-010 | Recompensas con sesión firmada | §21, D-09 | L1 | Una recogida más rápida que la cadencia máxima es rechazada | — |
| REQ-ARQ-011 | Identidad pública separada | §49.13, P1, D-10 | L1 | Los datos públicos no contienen email ni sesión | — |
| REQ-ARQ-012 | Seguridad web y secretos | §49.9, P2 | L1 | P2, prueba 9: 0 secretos en cliente, logs, repositorio y ejemplos | — |
| REQ-ARQ-013 | Conservación de datos y copias | §49.13, P1 | L1 | Restaurar una copia no republica contenido retirado | [pendiente Álvaro] Plazos legales de Álvaro |
| REQ-ARQ-014 | Presupuesto de 1 MB y 5 MB | P3 | L1 | Medición en la red y el dispositivo de referencia | [pendiente Hernán] Dispositivos por fijar (P6) |
| REQ-ARQ-015 | 30 y 60 FPS | P3 | L1 | Medición en ambos dispositivos | [pendiente Hernán] Dispositivos por fijar (P6) |
| REQ-ARQ-016 | Matriz de accesibilidad y fallos | P3 | L1 | Matriz con los 16 casos y su resultado | — |
| REQ-ARQ-017 | Pruebas en dispositivos físicos | §4.4, P3 | L1 | Registro por dispositivo con los 5 datos y resultado de los 11 aspectos | — |
| REQ-ARQ-018 | Suite automática desde el principio | P2, P3 | L1 | Suite leída por exit code y conteo en cada encargo | — |
| REQ-ARQ-019 | Analítica del embudo | D-04 | L1 | Los 6 eventos llegan a PostHog; purchase_confirmed sólo desde el servidor | — |
| REQ-ARQ-020 | i18n por claves, contenido en español | P2, D-03 | L1 | Ninguna cadena visible fuera de los archivos de claves | — |
| REQ-ARQ-021 | Inglés | §4.1, §20, §47-B, D-02, D-03 | L2 | Cambiar a inglés traduce todo el contenido publicado | — |
| REQ-ARQ-022 | Entornos y despliegue | P3 | L1 | Entornos de prueba y producción separados, con HTTPS | — |
| REQ-ARQ-023 | Copias y restauración probada | §49.18, P3 | L1 | Prueba de restauración documentada | — |
| REQ-ARQ-024 | Paquete de entrega | §50, P3 | L1 | Lista de entrega con todos los elementos del REQ | — |
| REQ-ARQ-025 | Versión de prueba: repositorio en el navegador | D-20 | L1 | Test: la misma batería pasa contra el repositorio local; con almacenamiento bloqueado sigue en memoria y lo dice; 0 peticiones a servicios externos | Sólo versión de prueba; Supabase lo sustituye (REQ-ARQ-002) |
