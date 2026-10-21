# 06 · Comercial

Fuente: v14 §5, §18, §22, §49.4, §49.12 y la tabla de estados de evento; D-06, D-20 y D-22. Los accesos con la isla visible están en [02-entrada-y-landing](02-entrada-y-landing.md); el sello en el Carnet, en [05-identidad-y-comunidad](05-identidad-y-comunidad.md).

Vender entradas es el objetivo principal (§2.1). Comprar nunca queda bloqueado por el juego, la cuenta ni el motor.

## Eventos y estados

Evento e isla son entidades separadas (§49.4). Una isla vive muchas temporadas; los eventos pasan por ella. Terminar un evento retira su venta, nunca su isla ni sus recuerdos.

| Estado | Home y Tickets | Isla |
|---|---|---|
| Borrador | No visible | Sólo en previsualización |
| Próximamente | Visible si se publica, con CTA informativo | Información sin compra hasta la apertura |
| A la venta | Visible y comprable | Compra y contenido del evento activo |
| Agotado | Visible como agotado, sin compra inválida | Información vigente y estado agotado; recuerdos anteriores si existen |
| Pospuesto | Mensaje y política definida | Conserva el evento y la actualización |
| Cancelado | Sale de venta, con información de cancelación | Recuerdo o aviso según decisión editorial |
| Finalizado | No aparece en próximos ni en compra | Fotos, vídeos, cartel y memoria del evento |

- **REQ-COM-001** `L1` — Dar a cada evento cartel, formato, fecha con zona horaria, artistas, actividades, descripción, URL o flujo de ticket, descuentos, álbum, isla opcional y estado de publicación. *Fuente: §5, §23.2, P2*
- **REQ-COM-002** `L1` — Separar evento e isla: una isla conserva varios eventos históricos y puede tener un evento activo nuevo. *Fuente: §49.4, P1, P2*
- **REQ-COM-003** `L1` — Distinguir los estados borrador, próximamente, a la venta, agotado, pospuesto, cancelado y finalizado, con el comportamiento en home, Tickets e isla de la tabla de este archivo. *Fuente: §49.4, P1*
- **REQ-COM-004** `L1` — Aplicar las transiciones por fecha con una tarea programada, previsualizables y corregibles a mano con auditoría. *Fuente: §49.4, P2, D-04*
- **REQ-COM-005** `L1` — Al finalizar un evento, retirarlo de la venta en home, Tickets y mundo, conservar su URL histórica y su isla, con sus recuerdos accesibles desde el archivo de la web y desde la isla, y cambiar la acción de la isla a cartel, artistas, relato, fotos y vídeos, con un bloque aparte de próximos eventos. *Fuente: §49.4, P1, P3*
- **REQ-COM-006** `L1` — Al vincular a una isla un evento nuevo publicado y a la venta, devolverlo a la home y hacer que la isla presente su compra, dejando el anterior accesible en su historial. *Fuente: §49.4, P1, P2*
- **REQ-COM-007** `L1` — Mostrar un evento agotado como agotado, con su información vigente y sin ninguna compra inválida. *Fuente: §49.4, §49.15*
- **REQ-COM-008** `L1` — Definir por evento el mensaje y la política de pospuesto y cancelado, y si su isla muestra recuerdo o aviso [pendiente Álvaro]. *Fuente: §49.4*
- **REQ-COM-009** `L1` — Dejar que el Admin cambie el evento prioritario sin reconstruir el mundo, exigiendo que esté vigente: una campaña terminada no sigue como oferta activa. *Fuente: §2.1, §4.4, §5, §24*
- **REQ-COM-010** `L1` — Dar a los eventos sin isla propia una localización comercial común configurada en el Admin, que por defecto es la isla All Day vigente: el satélite sale en el panel de Tickets y en «Próximos eventos» de esa isla con la línea «Calienta para el próximo All Day» y un enlace al All Day. *Fuente: §39.2, §39.3, §49.6, D-23*
- **REQ-COM-011** `L1` — Calcular los próximos eventos de la home con reglas de estado y publicación, con exclusión manual que no borra el evento. *Fuente: §49.3, P1, P2*
- **REQ-COM-012** `L1` — Ofrecer una sección «Elige tu evento» con los próximos eventos, compra directa, una ficha compartible por evento y la invitación «También puedes encontrar sorpresas navegando hasta su isla» enlazada al universo. *Fuente: §5, P3, D-02*
- **REQ-COM-013** `L1` — No filtrar la dirección de una secret location en HTML, datos públicos ni assets. *Fuente: P3*
- **REQ-COM-014** `L1` — Probar el ciclo completo sin desplegar código: publicar un evento futuro (home, Tickets, mapa e isla), agotarlo, finalizarlo, vincular uno nuevo a la misma isla, cancelar y posponer. *Fuente: §49.15, P2, P3*

## Ticketera y compra

La ticketera la elige y la contrata Álvaro (D-06, D-08). Hasta entonces el código habla con un adaptador y un sandbox.

- **REQ-COM-015** `L1` — Integrar la ticketera por un adaptador sustituible; Fourvenues es la candidata y la elige y contrata Álvaro con un ADR comparativo delante (Fourvenues, Entradium, Wegow, Eventbrite, DICE) que compara coste total, cobros, reembolsos, códigos, checkout móvil y confirmaciones [pendiente Álvaro]. *Fuente: §49.18, P1, D-06, D-08*
- **REQ-COM-016** `L1` — Probar el adaptador con sandbox y datos de prueba mientras no haya cuenta, con un procedimiento exacto de activación, y no simular nunca compras reales en producción. *Fuente: P3, D-06*
- **REQ-COM-017** `L1` — Confirmar una compra sólo por el webhook verificado del proveedor (en Fourvenues, `payment.success` con `metadata.internal_id`), que la vincula a la cuenta, e ignorar las notificaciones repetidas sin duplicar sellos ni recompensas. *Fuente: P1, P3, D-06*
- **REQ-COM-018** `L1` — Si la ticketera elegida no tiene webhook, prescindir del sello automático y registrar la compra con QR o con el código del email de compra. *Fuente: §42.2, D-06*
- **REQ-COM-019** `L1` — Registrar las devoluciones o anulaciones que notifique el proveedor y actualizar la validez del ticket y su sello con un ajuste auditado, sin portal de reembolsos; la política comercial se aprueba antes del lanzamiento [pendiente Álvaro]. *Fuente: §49.12*
- **REQ-COM-035** `L1` — En la versión de prueba, sin ticketera, hacer que «Comprar entrada» en la landing, el panel de entradas, las islas de evento y el botón «Entradas» de `/mar` (REQ-ENT-040) abra un checkout sandbox rotulado claramente como prueba (evento, precio `muestra` y el descuento del náufrago si se tiene) que, al confirmar, añade el sello del evento al Carnet una vez por ID de compra y concede el logro de la entrada, a través del mismo adaptador que usará la ticketera real; es una excepción temporal a REQ-IDE-021 y REQ-COM-017 que no se publica (REQ-PRO-020), y un evento finalizado nunca muestra compra. *Fuente: D-06, D-20, D-22*

## Descuentos y promociones

- **REQ-COM-020** `L1` — Configurar descuentos compartibles por evento con fechas, porcentaje o importe, condiciones, destino y prioridad [pendiente Álvaro]. *Fuente: §12, §49.12*
- **REQ-COM-021** `L1` — Premiar el descubrimiento de un código una sola vez aunque se vuelva a copiar, mantener disponibles los códigos encontrados y ocultar o marcar los caducados. *Fuente: §49.12, P3*
- **REQ-COM-022** `L1` — Permitir copiar un descuento encontrado con un toque y mostrar su evento, fecha, condiciones y enlace al evento o producto. *Fuente: §2.1, §12, P3*
- **REQ-COM-036** `L1` — Dar a cada tarjeta de descuento de entradas un botón «Ir a la isla» que lleva el barco en piloto automático hasta la isla de su evento (se puede saltar; desde la landing abre el juego en esa isla), y al comprar en esa isla o en la página de su evento mostrar «Tienes un código de descuento para este evento» con el código y el ahorro, aplicado en el checkout; un descuento de tienda se copia y lleva «Ir a la tienda» (externa), que lo valida. *Fuente: §2.1, §12, D-23*
- **REQ-COM-037** `L1` — Permitir que una fiesta vaya «en lista» en vez de vender entradas (Halloween: tope 100; la lista vale hasta las 22:30 del 31 de octubre, Europe/Madrid; después, por orden de llegada): quien tiene Carnet se apunta una vez con un nombre de lista de 2 a 30 caracteres (por defecto su apodo, texto libre), y apuntarse otra vez le devuelve la fecha y el nombre de entonces; llena, «Lista completa»; a la hora de cierre o con el interruptor del Admin, cerrada: ni apuntarse ni borrarse; antes, cada cual se borra y puede volver. Sin contador público. El Admin ve la lista con apodo, email, fecha y si entró por la puerta, borra inscripciones y cambia los ajustes; la puerta sabe si un Carnet escaneado está en la lista, con qué nombre y si pasó la hora, sin bloquear nada. *Fuente: plan 034, Álvaro 2026-10-21*
- **REQ-COM-023** `L2` — Configurar el pack de primera compra y la pegatina gratis con compra por WhatsApp (productos, stock, límite por cliente, compatibilidad y verificación real); sin verificación, presentarla como código promocional y no como suscripción comprobada. *Fuente: §49.12, D-02*
- **REQ-COM-024** `L2` — Ofrecer cosméticos exclusivos por compra con ventana ligada al evento (quien ya los tiene los conserva) y códigos especiales de desbloqueo con artículo, caducidad, usos máximos y auditoría. *Fuente: §49.12, D-02*
- **REQ-COM-025** `L2` — Acreditar la asistencia sólo con check-in verificable (referencia y control de repetición), asignar cada titular de una compra múltiple por vínculo verificable y no aceptar QR promocionales como asistencia. *Fuente: §49.12, D-02*

Los códigos especiales son promociones controladas, nunca contraseñas universales escondidas en el cliente (§49.12).

## Artistas: Personas detrás del sonido

Lista de §18.1, textual, confirmada por Álvaro el 2026-09-29 (D-23), con avatar neutro hasta tener fotos aprobadas:

| Artista | Géneros |
|---|---|
| Alba Fitz | Melodic Techno, Downtempo |
| Amenaza Verde | Cumbia |
| Casta Diva | Hip Hop |
| DJ Alpina | Electro, Techno |
| DJ Sacred | Techno |
| EGFNK | House |
| Franco Maltratto | Reggaeton, House |
| Koko Moreno | Reggaeton, House, Hard Dance |
| Las Precarias de Torrevieja | Techno, Hard Dance |
| Latin Master X | House |
| Manija | Melodic Techno, Techno, Psytrance |
| Marabina | Ambient, Experimental |
| Moglia (Live) | Hip Hop, Jazz Fusion |
| Nacho Age | House |
| Nat | House |
| Pollo Can Fly | Hard Dance, Hard Trance |
| The Rancho Cashmere Band | Country |
| RBS | Techno |
| RKVX | Techno |
| Soviet Gym | House |
| Spowy | House |
| Stonzze | Hard Bounce, Hard Trance |
| Tere Ling | Hard Bounce, Hard Groove, Hard Trance |
| Tonitto | Reggaeton, Hip Hop |
| Torvik | Tech House |
| Wet Kisses | Trance |

- **REQ-COM-026** `L1` — Mostrar en la home 3 artistas a la vez que rotan cada 5 s de forma equilibrada, sin duplicados en el trío ni repetición inmediata, con transición suave y pausa por hover o foco. *Fuente: §18, §47-A, P3, D-07*
- **REQ-COM-027** `L1` — Dar a cada tarjeta foto, nombre y géneros, con avatar neutro si falta la foto, y abrir con «Ver todos los artistas» el A–Z completo. *Fuente: §18, P3*
- **REQ-COM-028** `L1` — Cargar los 26 artistas de la tabla con nombre y géneros textuales, sin biografías ni testimonios inventados, sustituibles desde el Admin. *Fuente: §18.1, P1, P3*
- **REQ-COM-029** `L1` — Validar con Álvaro nombres, fotos y biografías de los artistas antes de publicar [pendiente Álvaro]. *Fuente: §33, P1*

## Filosofía, fotos y tienda

- **REQ-COM-030** `L1` — Publicar la página Filosofía con un manifiesto completo y una versión breve redactados a partir de [10-filosofia](10-filosofia.md) [pendiente Álvaro]. *Fuente: §22, §31, §36*
- **REQ-COM-031** `L1` — Integrar una galería de fotos general y por evento, en la home y en su localización del mundo, con texto alternativo en todas las imágenes; la home enseña sólo las fotos marcadas como «selección» con «Ver todas» hacia la página «Fotos y eventos», y cada isla ofrece «Ver fotos de la isla», que abre esa página en la galería de su isla o evento. *Fuente: §22, §49.6, P3, D-23*
- **REQ-COM-032** `L1` — Incluir vídeos en galerías, islas y bloques sin que bloqueen la carga [provisional]. *Fuente: §4.4, §49.6, P3*
- **REQ-COM-033** `L1` — Resolver la Tienda de L1 como una Isla Tienda con un panel que presenta camisetas, tote bags y packs de pegatinas y enlaza a la tienda externa de BOIA [provisional] [pendiente Álvaro]. *Fuente: §4.3, §22, §49.6, D-02*
- **REQ-COM-034** `L2` — Construir la tienda con catálogo administrable (camisetas, tote bags, pegatinas y pack inicial), variantes, disponibilidad, envío y recogida en evento, y checkout o adaptador propio sin guardar datos de tarjeta. *Fuente: §22, P3, D-02*
