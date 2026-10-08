# 05 · Identidad y comunidad

Fuente: v14 §14 a §17, §19 a §21, §40, §42 a §44, §46, §49.8 a §49.10; D-09, D-10, D-20 y D-22, y el plan 008 (borrador D-27). Cómo se guardan saldos y transacciones está en [08-arquitectura-y-datos](08-arquitectura-y-datos.md); cómo se administran, en [07-admin](07-admin.md).

## Invitado y cuenta

Nadie necesita cuenta para mirar, jugar ni comprar. La cuenta sirve para conservar y compartir: Carnet, sellos, barco y progreso validado.

Plan 008 (2026-10-03, borrador D-27, [`docs/propuestas/2026-10-03-d27-borrador.md`](../propuestas/2026-10-03-d27-borrador.md)): con Supabase configurado, el invitado navega, corre y lee sin cuenta, y el email se pide al guardar algo (el Carnet, una skin, un sello por QR, entrar en el ranking) con un código de 6 cifras que se escribe en la misma página, sin enlace mágico; al entrar, lo del invitado pasa siempre a la cuenta por las mismas validaciones del servidor que una acción en vivo. El email nunca es público y el apodo es único. Sin las variables de Supabase (la producción de hoy) todo sigue en el navegador (D-20).

- **REQ-IDE-001** `L1` — Permitir navegar, jugar y comprar sin cuenta, y ofrecer login, registro y Carnet desde la landing o el menú sin bloquear nada. *Fuente: §4.1, §47-B, §49.10*
- **REQ-IDE-002** `L1` — Dar acceso público por email con un código OTP de 6 dígitos que se escribe en la misma página, sin enlace mágico (plan 008, borrador D-27), y recuperar el acceso pidiendo un código nuevo. *Fuente: P1, P3, D-10*
- **REQ-IDE-003** `L1` — Tras verificar el email, devolver a la persona al mismo evento o panel donde empezó. *Fuente: §49.10, P3*
- **REQ-IDE-004** `L1` — Guardar en el dispositivo del invitado preferencias, posición segura, progreso narrativo, descubrimientos y personalización provisional. *Fuente: §49.10, P1*
- **REQ-IDE-005** `L1` — Guardar el progreso del invitado en su dispositivo, sin identidad de servidor, y al entrar con su email pasarlo a la cuenta acción por acción, cada una con la misma validación del servidor que en vivo y una sola vez por ID; no importar nunca un saldo local, y un récord local sólo si pasa el tiempo mínimo plausible de su circuito (plan 008, borrador D-27). *Fuente: §49.10, D-09*
- **REQ-IDE-006** `L1` — Al registrarse, conservar el progreso narrativo y sincronizar sólo recompensas verificables, una vez por ID; si ya existe una cuenta con progreso, mostrar qué se vincula y fusionar por IDs sin sumar premios repetidos ni sobrescribir preferencias o barco sin criterio visible. *Fuente: §49.10, P1*
- **REQ-IDE-007** `L1` — Explicar que el avance sin conexión es local, que sólo entra en rankings tras validación y que se pierde si se borran los datos del dispositivo [pendiente Álvaro]. *Fuente: §49.10*

## Invitaciones a crear el Carnet

- **REQ-IDE-008** `L1` — Ofrecer Crear mi Carnet antes de continuar a comprar, al cerrar una galería y tras 5 minutos activos o 3 logros distintos, explicando el beneficio de cada contexto y conservando en la compra la alternativa visible «Continuar sin registrarme» [provisional]. *Fuente: §49.10, P3*
- **REQ-IDE-009** `L1` — Separar los avisos proactivos al menos 3 minutos, no pasar de 3 por sesión, registrar el motivo para no repetirlo sin nuevo contexto, no mostrarlos nunca sobre una carrera, un diálogo activo o el pago, y respetar «Ahora no» [provisional]. *Fuente: §49.10*

## Carnet BOIA

El Carnet unifica perfil, pasaporte y Carta de Navegación (§40, §42.1, D-08). Crear la cuenta es convertirse digitalmente en miembro de BOIA. Comunica pertenencia, no estatus: la v14 pide a la vez rango visible y «ni jerarquía ni VIP», y lo concilia con rangos lúdicos (REQ-IDE-028).

- **REQ-IDE-010** `L1` — Crear el Carnet BOIA en un alta rápida al crear la cuenta, con apodo, foto o avatar, «Miembro de BOIA desde…», las 5 preguntas, rango, puntos, logros, barco, cosméticos y sellos. *Fuente: §40, §40.1, §42.1, P1*
- **REQ-IDE-011** `L1` — Poner «Mi Carnet» en el Menú de a bordo: al entrar se ve primero como lo ven otros, con el botón «Editar mi Carnet»; sin cuenta, la invitación es «Crear mi Carnet»; «Mi Carta» y «Carta de Navegación» no existen como pantallas. *Fuente: §16.1, §46, D-08*
- **REQ-IDE-012** `L1` — Diseñar el Carnet como identidad musical que comunica pertenencia, no como ficha demográfica ni como estatus VIP o jerarquía. *Fuente: §16.1, §37.12, §40.3*
- **REQ-IDE-013** `L1` — Avisar antes de crear el Carnet de qué campos serán públicos; email y datos de autenticación nunca lo son. *Fuente: §49.13*
- **REQ-IDE-014** `L1` — Usar exactamente estas 5 preguntas públicas: «¿Cuál ha sido la cosa más rara que has visto pasar en una fiesta o festival?», «¿Cuál es el mejor descubrimiento musical que hiciste por casualidad?», «¿Qué obra, fotografía, película, disco o pieza artística te cambió un poco la cabeza?», «¿Cuál es tu mejor recuerdo relacionado con la música?» y «Completa la frase: una buena fiesta necesita siempre…». *Fuente: §44.1, D-08*
- **REQ-IDE-015** `L1` — Mostrar cada respuesta pública con su pregunta en pequeño y la respuesta en grande, nunca sin contexto. *Fuente: §16.2, §44.4*
- **REQ-IDE-016** `L2` — Permitir editar las preguntas desde el Admin, con versión [provisional]. *Fuente: §16.2, §28*
- **REQ-IDE-017** `L1` — Abrir el Carnet de otra persona desde el ranking y desde su botella: el propio está en el menú y los de los demás se descubren navegando. *Fuente: §16.3, §43*
- **REQ-IDE-018** `L2` — Abrir desde un artista su Carnet o perfil público. *Fuente: §16.3, §18, D-02*
- **REQ-IDE-019** `L1` — No incluir en el Carnet listas de artistas vistos ni valoraciones o puntuaciones públicas de artistas. *Fuente: §40.2, §42.3, §46*
- **REQ-IDE-020** `L1` — Usar «miembro de BOIA» como término formal y «bollero» como apodo interno, puntual y explicado a quien llega; nunca «tripulación» para relaciones entre usuarios. *Fuente: §40.3, §44.2, §46, D-08*

## Sellos

- **REQ-IDE-021** `L1` — Añadir una vez el sello del evento al Carnet cuando se confirma una compra vinculada a la cuenta, sin acción del usuario; pulsar un botón o volver desde la ticketera no basta. *Fuente: §42.2, §46, §49.12, P1*
- **REQ-IDE-022** `L1` — Diseñar el sello como recuerdo y colección de experiencias, no como fila de transacciones. *Fuente: §42.2*
- **REQ-IDE-023** `L2` — Ofrecer un QR alternativo para activar el sello en entradas externas, invitaciones o incidencias, nunca obligatorio si la compra ya lo registró [provisional]. *Fuente: §42.2, §46, D-06*

Sello de compra no es asistencia: la asistencia confirmada sólo la da el check-in (REQ-COM-025).

## Logros, avisos y economía

- **REQ-IDE-024** `L1` — Unificar misiones y logros en un solo sistema de LOGROS/PROGRESO que responde qué he conseguido y qué me falta, con un contador de logros, el progreso de cada uno (lleva/pide y «te queda…») y tres estados: en curso, listo para reclamar y reclamado; completar un logro no concede nada hasta pulsar «Reclamar», que da el premio una sola vez por ID; el mismo flujo y el mismo progreso en `/mar` y en `/juego`. *Fuente: §14, P3, D-22*
- **REQ-IDE-025** `L1` — Cargar la lista de logros de lanzamiento aprobada [pendiente Álvaro], con los ejemplos de la v14 como base (primera boia, X/6 boies, islas descubiertas, entrada comprada, 5/20 minutos jugando, Boia Fiestera rescatada y entregada, circuito y secretos) y el catálogo de `docs/propuestas/logros-catalogo.md` una vez que lo apruebe Hernán: unos 20 logros con escalones donde tiene sentido, algunos ocultos y al menos uno por actividad principal. *Fuente: §14, §28, §33, D-22*
- **REQ-IDE-026** `L1` — Mostrar cada aviso de descubrimiento o logro arriba, durante el tiempo de lectura de REQ-AVE-002 (al menos 3 s, más si el texto es largo) en lugar de los 4 s de D-07, con botón de cerrar, estética azul marino y naranja y sonido corto, en cola y de uno en uno. *Fuente: §14, §46, P3, D-07, D-08, D-22*
- **REQ-IDE-027** `L1` — Llevar puntos de prestigio y monedas gastables como saldos separados: los puntos dan prestigio, rango y ranking; las monedas compran personalización; gastar monedas nunca reduce puntos, rango ni ranking. *Fuente: §14, §21, P1*
- **REQ-IDE-028** `L1` — Derivar de los puntos unos rangos lúdicos configurables desde el Admin [pendiente Álvaro]. *Fuente: §14, P3*
- **REQ-IDE-029** `L1` — Hacer ajustables desde el Admin las cantidades, precios y recompensas iniciales de la economía: premios de objetos en el editor del mundo, de logros en Logros, y precios de cosméticos y umbrales de rango en Logros y cosméticos [pendiente Álvaro]. *Fuente: §28, §33, §36, P1*
- **REQ-IDE-052** `L1` — Conceder al reclamar un premio según el logro: puntos y monedas por defecto; una insignia visible en Mi Carnet por comprar entrada; un barco de estilo concreto, bloqueado en Mi Barco hasta reclamarlo, para los logros complejos; y un cosmético del barco (bandera, estela o color) para algunos; cantidades y premios los fija el catálogo aprobado [pendiente Álvaro]. *Fuente: §14, §15, §28, D-22*

## Mi Barco

- **REQ-IDE-030** `L1` — Permitir en Mi Barco cambiar el color desde el principio y equipar los barcos, skins y cosméticos que se tienen; al empezar sólo están desbloqueados los barcos de los dos mundos iniciales, B05 Arcilla y B02 Acuarela, y los demás muestran su precio o su condición con «te faltan N monedas» o «te faltan N puntos» [pendiente Álvaro]. *Fuente: §15, D-02, D-23*
- **REQ-IDE-031** `L1` — Desbloquear con monedas barcos de estilo, skins de barco, banderas, accesorios, aspectos y estelas; desbloquear un barco concreto al superar un umbral de puntos, que no se gastan; y permitir que los logros concedan cosméticos y barcos de estilo directamente al reclamarlos (REQ-IDE-052); precios, umbral y reparto de barcos son `muestra` (D-23, O5). *Fuente: §6.2, §15, D-22, D-23*
- **REQ-IDE-032** `L1` — Garantizar que skins y cosméticos no modifican velocidad, drift, colisiones, hitbox ni tiempos competitivos. *Fuente: §15, §49.17*
- **REQ-IDE-033** `L1` — Guardar la configuración visual del barco en la cuenta, o en el dispositivo si es invitado. *Fuente: §15, §49.10*

## Menú de a bordo y ajustes

«El mundo te enseña a jugar. El menú te permite consultar» (§1). Iconos de la v14: ⚓ Welcome Aboard, 🪪 Mi Carnet, 🏅 Logros, ⛵ Mi Barco, 🏆 Ranking, 🎮 Controles, ⚙ Ajustes.

- **REQ-IDE-034** `L1` — Abrir con el icono del ancla un Menú de a bordo con una barra superior de iconos grandes (Welcome Aboard, Mi Carnet, Logros, Mi Barco, Ranking, Controles y Ajustes), con el título dentro de cada sección, tooltips en escritorio, icono activo resaltado en móvil y separación antes de Controles y Ajustes [provisional]. *Fuente: §19, §46*
- **REQ-IDE-035** `L1` — Hacer de Welcome Aboard una sección consultable (qué es BOIA.PLANET, objetivo y ayuda básica) que el tutorial nunca abre por su cuenta. *Fuente: §19, §46*
- **REQ-IDE-036** `L1` — Explicar en Controles la navegación, el drift y el minimapa. *Fuente: §19*
- **REQ-IDE-037** `L1` — Ofrecer en Ajustes activación y volumen de música y de efectos por separado, de modo que los efectos sigan sin música, y guardar las preferencias. *Fuente: §20*

## Ranking

- **REQ-IDE-038** `L1` — Clasificar el ranking general por puntos de prestigio validados, nunca por monedas, con vista histórica y de temporada, posición propia y perfiles que abren su Carnet. *Fuente: §21, P3*
- **REQ-IDE-039** `L1` — Rechazar saldos o récords enviados por el cliente sin evidencia y exigir cuenta para cualquier marca global. *Fuente: §21, P3, D-09*

## Botellas

Las botellas son la única mecánica social abierta: mensajes breves para quien los encuentre, no mensajes directos (§44.3).

- **REQ-IDE-040** `L1` — Permitir que cada cuenta mantenga 1 botella pública activa de hasta 140 caracteres en una posición válida del mar, con edición o retirada propia; sin cuenta no se escriben botellas. *Fuente: §17, P1, P3, D-02*
- **REQ-IDE-041** `L1` — Mostrar al leer una botella el apodo del autor y la acción «VER SU CARNET»; la botella no desaparece por leerla y la lectura queda registrada. *Fuente: §17, §46, P3*
- **REQ-IDE-042** `L1` — No dar puntos ni monedas por escribir o leer botellas. *Fuente: §17, P1*
- **REQ-IDE-043** `L1` — Permitir reportar una botella y propagar su retirada a todo el mundo publicado. *Fuente: §17, P3*
- **REQ-IDE-044** `L1` — No ofrecer mensajería privada entre miembros: la comunicación abierta del mundo son las botellas. *Fuente: §44.2, §44.3, §46, D-02*

## Las Calitas

La isla de los comentarios (plan 019, decisión 16 de la reunión del 2026-10-08; plan 020, decisión 7): comentarios públicos en una isla del mapa, no mensajes directos (REQ-IDE-044).

- **REQ-IDE-054** `L1` — Ofrecer en el mapa la isla Las Calitas, una cala con su modelo de Blender en `/mar` y su arte 2D en Arcilla como las demás islas, cuya ficha abre los comentarios: escribir, responder (un nivel) y votar, ordenados por más votados o más nuevos, con un filtro de insultos antes de guardar y moderación desde el Admin que oculta y devuelve; sin Supabase, comentarios `muestra` más los propios, que sólo ve quien los escribe; con Supabase, reales y compartidos. *Fuente: plan 019 (decisión 16), plan 020 (decisión 7)*

## Encuestas y Mensajes de BOIA (L2)

- **REQ-IDE-045** `L2` — Ofrecer encuestas voluntarias vinculadas a boia, objeto, evento o panel, anunciadas con un icono persistente de botella de misiones distinto de las botellas sociales, que dicen para qué se pregunta, siempre ofrecen «Ahora no» y nunca bloquean navegar, comprar ni conservar el progreso. *Fuente: §49.8*
- **REQ-IDE-046** `L2` — Guardar las respuestas como privadas del equipo, fuera del Carnet y sin puntuaciones públicas de artistas, una por cuenta y versión con envío idempotente y sin puntos globales sin validación; los invitados responden con sesión anónima que se reconcilia al vincular. *Fuente: §49.8*
- **REQ-IDE-047** `L2` — Añadir Mensajes al Menú de a bordo con campana y contador de no leídos: un buzón editorial de BOIA para todos, invitados incluidos, que avisa con una señal discreta y un banner opcional una vez y nunca interrumpe una carrera. *Fuente: §49.9*
- **REQ-IDE-048** `L2` — Guardar leído, descartado y versión por cuenta o sesión invitada y fusionarlos al registrarse; una errata no vuelve a marcar como nuevo, una revisión importante sí, y los caducados salen de no leídos. *Fuente: §49.9*

## Capa personal diferida y datos

- **REQ-IDE-049** `diferido` — Dejar fuera la capa personal ampliada: hasta 6 fotos personales por evento con visibilidad configurable (como mínimo pública o privada), mini blog y relaciones «Mis bolleros». *Fuente: §40.2, §42.4, §44.2, §44.4, D-02*
- **REQ-IDE-050** `L2` — Permitir solicitar desde la web la descarga y la eliminación de la cuenta. *Fuente: §49.13, D-02*

## Versión de prueba (D-20)

Hasta que exista Supabase todo se guarda en el navegador (REQ-ARQ-025). Los requisitos de cuenta, fusión, validación en servidor y sello por webhook de este archivo siguen valiendo para la versión final; lo que sigue sólo vale para la versión de prueba y se retira cuando llegan.

- **REQ-IDE-051** `L1` — En la versión de prueba, identificar a cada visitante como invitado con apodo, sin correo, que crea su Carnet, gana logros y sellos y escribe su botella con las reglas de REQ-IDE-040 a REQ-IDE-043; decir en pantalla que todo se guarda en este navegador y que su botella sólo la ve él, sembrar unas botellas `muestra` de otros miembros ficticios para poder leer, y no presentar nada de esto como compartido. *Fuente: D-20*
- **REQ-IDE-053** `L1` — En la versión de prueba, activar el ranking de puntos sólo en local: el visitante de este navegador junto a los miembros `muestra`, con vista histórica y del mundo o temporada actual, su posición destacada y cada fila abriendo su Carnet, rotulado como «ranking local de este navegador» y sin presentarlo como compartido ni validado. *Fuente: D-20, D-23*
