# 02 · Entrada y landing

Fuente: v14 §4 (4.1 a 4.4), §47-B, §49.3, §49.6 y los criterios ENT 01 a ENT 06; D-19, D-20 y D-21 cambian la entrada; D-22 añade el botón «Entradas» de `/mar`. Es la prioridad de diseño de L1: la entrada es el primer momento de captación y su calidad se revisa como requisito de lanzamiento (§4.4). Los estados de evento que alimentan la landing están en [06-comercial](06-comercial.md); el motor y el mapa, en [03-mundo-y-motor](03-mundo-y-motor.md).

## Entrada cinemática: el mini-mundo

Al abrir BOIA.PLANET (cada carga de `/`, D-21) sube nuestro mundo en miniatura: el mismo mundo del juego (islas, rocas, boia, barco, costa y mar) enrollado en un pequeño planeta que flota y gira despacio, con «BOIA» encima en letras 3D (D-20) y un botón para entrar. Al pulsarlo, el mini-mundo gira hasta dejar delante el punto de aterrizaje y la cámara se acerca mientras la curvatura se aplana, sin corte, hasta el mar isométrico donde aparece la landing. El enlace a entradas funciona desde el primer segundo sin pasar por el botón. Es una sola escena construida con capas en el motor, nunca un vídeo (§4.4, D-05). D-19 sustituye la entrada sin clic de §47-B.

- **REQ-ENT-001** `L1` — Al abrir `/` (D-21), reproducir una cinemática continua en tres actos: aparición del mini-mundo, pausa con título y botón de entrar, y aterrizaje continuo en el mar al pulsar el botón, sin formularios, selector de idioma, login ni pantallas intermedias. *Fuente: §4.1, §4.4, §47-B, D-19, D-21 · alias ENT 01*
- **REQ-ENT-002** `L1` — Hacer del botón de entrar la única acción antes de la landing: no mostrar selector de idioma, login, «continuar como invitado» ni otra acción obligatoria, y mantener visible y funcional desde el primer segundo un enlace a entradas que lleva a Tickets sin pasar por el botón ni por la animación. *Fuente: §4.1, §4.4, §47-B, D-19*
- **REQ-ENT-003** `L1` — Mostrar «BOIA» centrado sobre el mini-mundo como título de la cinemática, en letras 3D con la forma del wordmark de BOIA (`art/marca/boia-wordmark.jpg`), modeladas y renderizadas en Blender y servidas como secuencia de imágenes o sprite sheet (nunca 3D en el navegador), que se mueven como el título de messenger.abeto.co: suben una a una, flotan y se balancean por separado con un giro leve que coge la luz, en un bucle sin corte, con un movimiento de salida al pulsar el botón y un fotograma quieto con movimiento reducido; el botón de entrar va debajo, con su texto de muestra en la configuración hasta que Álvaro apruebe el definitivo [pendiente Álvaro]; «Bienvenido a BOIA» es sólo una variante de copy a probar y nunca una pantalla previa. *Fuente: §4.1, §47-B, D-05, D-08, D-19, D-20, D-23*
- **REQ-ENT-004** `L1` — Resolver la entrada con la identidad BOIA (naranja y violeta o azul marino), espacio libre, tipografía legible, pocos elementos en movimiento y el mismo lenguaje de ilustración, luz, agua y proporciones de principio a fin, sin estética infantil, acumulación de partículas, rebotes constantes, destellos ni efectos de plantilla. *Fuente: §4.4*
- **REQ-ENT-005** `L1` — Construir el planeta como un pequeño mundo ilustrado con capas 2D e ilusión 2.5D, sin globo 3D, de modo que el mundo final se reconozca como el visto de lejos; la mascota puede aportar un gesto breve sin competir con la marca. *Fuente: §4.4, D-05*
- **REQ-ENT-006** `L1` — Encadenar cuatro tiempos: aparición del mini-mundo, que sube y queda flotando con un giro lento; pausa con título y botón, con el mini-mundo girando detrás; acercamiento al pulsar, con giro hasta el punto de aterrizaje y aceleración y desaceleración progresivas, sin giros bruscos ni túnel de zoom, mientras la curvatura se aplana hasta el isométrico del juego; y llegada con cámara estable sobre el punto de aterrizaje y entrada de titular, botones y navegación, sin que el texto gire ni se deforme. *Fuente: §4.4, D-19*
- **REQ-ENT-007** `L1` — Medir la duración por tramos, con unos 2 s de aparición y unos 2 s de aterrizaje como valores iniciales de muestra, ajustables tras probarlos en móvil; la pausa con el botón no cuenta, y ningún tramo es una espera mínima. Si los recursos no están listos, mostrar directamente la landing ligera en vez de alargar una pantalla vacía. *Fuente: §4.4, D-19*
- **REQ-ENT-008** `L1` — Reproducir la entrada sin audio y ofrecer un control discreto «Saltar animación» que lleva al mismo estado final y es idempotente aunque se pulse varias veces. *Fuente: §4.4, D-21*
- **REQ-ENT-009** `L1` — Decidir la entrada por la URL, sin recordar si ya se vio: `/` a secas reproduce la introducción en cada carga completa o recarga; una URL que apunta a algo concreto (ancla, parámetro, evento, galería u otra ruta) entra directa a su contenido, sin contar los parámetros de campaña; volver a `/` navegando dentro de la web no la repite; y un enlace «Ver la introducción» (`/?intro=1`) la pide explícitamente [pendiente Álvaro]. *Fuente: §4.4, D-21*
- **REQ-ENT-010** `L1` — Con la preferencia de movimiento reducido, sustituir la cinemática por una escena estática o un fundido breve sin desplazamiento de cámara. *Fuente: §4.4*
- **REQ-ENT-011** `L1` — Abrir los enlaces directos a Tickets, a un evento o a una galería en su contenido, sin repetir la introducción. *Fuente: §4.4, §49.6*
- **REQ-ENT-012** `L1` — Hacer que EXPLORAR EL UNIVERSO active la navegación del barco y el tutorial sin reiniciar el mundo ni repetir el acercamiento: la cámara se aleja un poco y muestra el puerto de salida del mundo activo con el barco dentro (El Varadero en Arcilla), donde están los primeros encuentros y empieza la misión de la Boia Fiestera, con puerto y encuadre como datos de cada mundo; mientras se lee la landing, scroll y gestos son de la página, y al explorar son del juego dentro de su zona, con una vuelta clara a Inicio. *Fuente: §4.3, §4.4, D-20*
- **REQ-ENT-013** `L1` — No conceder descubrimientos, puntos, rescates ni récords durante la cinemática. *Fuente: §4.4*
- **REQ-ENT-014** `L1` — Compartir cámara, posición y referencias del mundo entre el estado final de la introducción y el inicial de la landing, sin salto de escala ni barco duplicado, y cancelar las animaciones limpiamente al cambiar de ruta, rotar el móvil o abandonar la pestaña. *Fuente: §4.4, P2*

## Configuración y resistencia a fallos

- **REQ-ENT-015** `L1` — Separar los recursos de planeta, mar, islas y barco de la secuencia de cámara y de los bloques de la landing, y versionar duración, curvas, escalas, encuadres por dispositivo, capas, momentos de aparición y alternativa reducida. *Fuente: §4.4, P2*
- **REQ-ENT-016** `L2` — Permitir que el Admin cambie recursos compatibles y parámetros de la entrada dentro de límites seguros, la previsualice y restaure una revisión [provisional]. *Fuente: §4.4, P2*
- **REQ-ENT-017** `L1` — Mantener el HTML comercial disponible aunque fallen el motor, una imagen o JavaScript, con una ilustración ligera del mismo mundo como respaldo, enlaces funcionales y errores recuperables. *Fuente: §4.4, §49.6, P2*
- **REQ-ENT-018** `L1` — Probar el arranque en cada contexto de apertura (navegador del sistema, navegador interno de apps, archivo local frente a sitio HTTPS) y documentar cualquier pantalla en blanco con su contexto antes de darla por resuelta. *Fuente: §4.4, P3, D-01*

Inventar un tipo de animación de entrada nuevo puede requerir programación; cambiar recursos y parámetros, no (§4.4).

## Criterios de aceptación ENT 02 a ENT 06

ENT 01 es REQ-ENT-001. Los demás se conservan como requisitos propios:

- **REQ-ENT-019** `L1` — Al terminar o saltar la entrada, hacer que Tickets, menú, scroll y Explorar respondan de inmediato, sin capas invisibles que intercepten toques ni controles del barco activos mientras se lee. *Fuente: §4.4 · alias ENT 02*
- **REQ-ENT-020** `L1` — Conservar contenido, isla representada y acciones esenciales con movimiento reducido, retorno, enlace profundo y fallo del renderizador; saltar repetidamente o usar Atrás no duplica mundos ni inicia una partida. *Fuente: §4.4 · alias ENT 03*
- **REQ-ENT-021** `L1` — Revisar en vídeo el recorrido en escritorio, iPhone y Android físicos, en vertical y horizontal (tipografía, contraste, áreas seguras, carga lenta, foco, lector de pantalla y ausencia de audio automático) y registrar dispositivo y resultado. *Fuente: §4.4 · alias ENT 04*
- **REQ-ENT-022** `L1` — Medir carga y fluidez de la entrada con los presupuestos de REQ-ARQ-014 y REQ-ARQ-015; si no se cumplen, reducir capas o mostrar la alternativa ligera, sin sacrificar compra ni accesibilidad. *Fuente: §4.4 · alias ENT 05*
- **REQ-ENT-023** `L1` — Entregar storyboard, grabación y configuración editable, y someter la entrada a revisión visual (composición limpia, carácter divertido sin saturación, correspondencia del último fotograma con la landing real); una transición provisional no se etiqueta como diseño aprobado. *Fuente: §4.4, P3 · alias ENT 06*

## Landing dentro del mundo

El mar, las islas y el barco son el fondo del hero; el texto y los botones son HTML accesible por encima. La lectura manda sobre el movimiento del fondo.

- **REQ-ENT-024** `L1` — Usar el mar, las islas y el barco como escena del hero, con contenido y controles en HTML accesible encima o al lado, zonas de contraste y sin tapar el barco sin necesidad; en móvil, recomponer el encuadre en vez de comprimir el de escritorio. *Fuente: §4.4*
- **REQ-ENT-025** `L1` — Mostrar en el primer encuadre la marca, el título «BOIA UNDERGROUND MUSIC FESTIVAL», una frase breve de posicionamiento [pendiente Álvaro], EXPLORAR EL UNIVERSO como CTA protagonista y Tickets. *Fuente: §4.2, §4.4, §31.2*
- **REQ-ENT-026** `L1` — Dar al CTA Explorar un alto mínimo de 56 px, ancho completo hasta 480 px de viewport y un pulso de como máximo 4 % de escala cada 3 s. *Fuente: §4.2, §46, D-07*
- **REQ-ENT-027** `L1` — Dar al botón Tickets del hero un alto de al menos 44 px y mantenerlo visible sin scroll en 360×640. *Fuente: §4.2, §4.4, D-07*
- **REQ-ENT-028** `L1` — Mostrar bajo Explorar «Encuentra descuentos para tus entradas» sólo si hay promociones publicadas y vigentes; si no, una invitación a descubrir eventos y secretos [pendiente Álvaro]. *Fuente: §4.2, §4.4, §46*
- **REQ-ENT-029** `L1` — Ofrecer en la navegación Tickets, Artistas, Filosofía, Tienda y Fotos y vídeos, con acceso a Mi Carnet y al sonido; en móvil, agrupar lo secundario en un menú reconocible y no desplegar los iconos del juego sobre el hero. *Fuente: §4.2, §4.4, D-03*
- **REQ-ENT-030** `L1` — Continuar la landing por scroll con evento prioritario y próximos eventos, recuerdos con fotos y vídeos, Personas detrás del sonido con acceso A–Z, Filosofía, tienda y contacto, mostrando sólo los bloques con contenido publicado útil. *Fuente: §4.2, §4.4*
- **REQ-ENT-031** `L2` — Añadir a la landing los bloques de actividades y de comunidad [provisional]. *Fuente: §4.4, P3*
- **REQ-ENT-032** `L1` — Cerrar la página con enlaces oficiales de BOIA (Instagram también en la cabecera y en el panel de la boia de WhatsApp), contacto y accesos a aviso legal, privacidad y preferencias de cookies [pendiente Álvaro], con una invitación voluntaria a crear Carnet o entrar en WhatsApp y sin formulario de suscripción mientras no se definan su uso y el tratamiento de datos. *Fuente: §4.4, §31.2, D-23*
- **REQ-ENT-033** `L1` — Componer la home con bloques (hero, evento prioritario, próximos eventos, fotos y vídeos, artistas, filosofía, tienda y contacto) que el Admin ordena, activa, oculta y programa sin código y sin borrar eventos. *Fuente: §49.3, P1, P2*

El selector de idioma de la navegación llega con el inglés en L2 (D-03, REQ-ARQ-021). El formulario del Admin para la home es REQ-ADM-017.

## Accesos comerciales con la isla visible

Tickets, Fotos y Tienda llevan al barco al lugar del universo que les corresponde y abren su panel, sin conducir. Son teletransportes contextuales: la entrada narrativa es Explorar (§4.3). El modo ligero es la misma página con la misma información, no una página comercial distinta (§49.6).

- **REQ-ENT-034** `L1` — Hacer que Tickets, Fotos y Tienda muestren la isla o localización correspondiente con el barco en su punto seguro y abran su panel automáticamente, sin conducir; cerrar el panel deja el barco en esa localización listo para navegar. *Fuente: §4.3, §22, §49.6*
- **REQ-ENT-035** `L1` — No iniciar un checkout externo ni un cobro sin una acción explícita de compra. *Fuente: §4.3, §49.6*
- **REQ-ENT-036** `L1` — Dar a cada panel y a cada evento una URL compartible con navegación Atrás coherente. *Fuente: §49.6*
- **REQ-ENT-037** `L1` — En Tickets general, usar la isla del evento prioritario vigente y listar todos los próximos eventos con compra disponible; sin eventos a la venta, mostrar Próximamente, sin inventar entradas ni ocultar recuerdos. *Fuente: §4.3, §49.6*
- **REQ-ENT-038** `L1` — Cargar primero el HTML y una representación ligera de la isla y después el sector navegable bajo demanda, con animación breve y omisible; si el motor no carga, conservar la isla ilustrada y el panel con la misma información y acciones. *Fuente: §49.6, P2, P3*
- **REQ-ENT-039** `L1` — Impedir que los teletransportes de los accesos comerciales concedan rescate, entrega o descubrimientos competitivos. *Fuente: §49.6, §49.15*
- **REQ-ENT-040** `L1` — En `/mar`, mantener siempre en pantalla un botón «Entradas» (a cualquier zoom, en el modo mapa y en móvil, sin que lo tapen la hoja, el bocadillo ni el joystick) que lleva al barco en turbo, con estela y cámara que lo sigue, hasta la isla del evento vigente (`allday` o la que apunte el evento) y abre su checkout al llegar; «Saltar» o pulsar otra vez el botón abren el checkout al momento, con movimiento reducido se abre directo y, sin evento vigente, lleva a la sección de entradas de la landing. *Fuente: §2.1, §4.3, D-22*
