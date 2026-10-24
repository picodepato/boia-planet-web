# 11 · Glosario

Términos del producto tal como se usan en esta spec. Entre paréntesis, la sección de la v14 o la decisión que los fija y el REQ principal.

## Comunidad e identidad

- **Carnet BOIA.** Identidad pública de una persona en BOIA.PLANET: apodo, avatar, fecha de alta, las 5 preguntas, rango, puntos, logros, barco, cosméticos y sellos. Se crea al crear la cuenta. Absorbe perfil, pasaporte y Carta de Navegación (§40, §42, D-08; REQ-IDE-010).
- **Carta de Navegación, Mi Carta.** Nombres históricos del Carnet. No existen como pantalla (D-08).
- **Miembro de BOIA.** Término formal para quien tiene Carnet. Crear la cuenta es hacerse miembro (§40.3, §42.1).
- **Bollero.** Apodo interno y humorístico entre miembros, de uso puntual y explicado a quien llega. Las relaciones «Mis bolleros» están diferidas (§44.2; REQ-IDE-020, REQ-IDE-049).
- **Tripulación, tripulante.** «Tripulación» no se usa para relaciones entre usuarios. «Tripulante» sí se usa para la Boia Fiestera a bordo (D-08).
- **Invitado.** Quien navega o juega sin cuenta. Guarda su progreso en el dispositivo y valida recompensas con una identidad anónima de servidor (§49.10; REQ-IDE-004, REQ-IDE-005).
- **Fusión.** Vinculación del progreso de invitado a una cuenta, por IDs, sin duplicar premios (§49.10; REQ-IDE-006).
- **Sello.** Marca de un evento en el Carnet por una compra confirmada vinculada a la cuenta. No acredita asistencia (§42.2, §49.12; REQ-IDE-021).
- **Asistencia, check-in.** Asistencia confirmada por un check-in verificable. L2 (§49.12; REQ-COM-025).
- **Botella.** Mensaje público de hasta 140 caracteres que una cuenta deja en el mar; se lee al navegar y lleva a «VER SU CARNET» (§17; REQ-IDE-040).
- **Botella de misiones.** Icono persistente que anuncia encuestas. Distinta de las botellas sociales. L2 (§49.8).
- **Mensajes de BOIA.** Buzón editorial del equipo para todos, en el menú, con campana. No es mensajería entre usuarios. L2 (§49.9).

## Progreso y economía

- **Logro.** Objetivo con condición del catálogo de triggers. Pasa por en curso, listo para reclamar y reclamado; su premio (puntos y monedas, una insignia, un barco o un cosmético) llega al pulsar «Reclamar» (§14, §23.3, D-22; REQ-IDE-024, REQ-IDE-052).
- **Reclamar.** Acción que cobra el premio de un logro completado, una sola vez (D-22; REQ-IDE-024).
- **Trigger.** Hecho del motor que una condición de logro puede observar: visitar isla, encontrar boia, recoger objetos, completar circuito, tiempo jugado, comprar entrada, rescatar o entregar (§23.3).
- **Logro global.** Logro disponible para todas las cuentas desde su publicación. Retroactivo y concesión masiva son L2 (§49.1).
- **Puntos de prestigio.** Saldo que da rango y ranking. Nunca baja por gastar (§14; REQ-IDE-027).
- **Monedas.** Saldo gastable en personalización, separado de los puntos (§14).
- **Rango.** Nivel lúdico derivado de los puntos (P3; REQ-IDE-028).
- **Transacción idempotente.** Concesión registrada con ID estable: repetirla no duplica nada (P1; REQ-ARQ-007).
- **Aviso.** Notificación temporal, arriba, en cola, para descubrimientos y logros; dura al menos 3 s, más si el texto es largo, y se puede cerrar (D-07, D-22; REQ-IDE-026).

## Eventos y comercio

- **All Day BOIA.** Formato principal de BOIA: evento de día y noche con música diversa, actividades, cultura y gastronomía. En el mundo son las grandes islas (§39.1; REQ-PRO-006).
- **Activación satélite.** Evento pequeño entre All Days, normalmente gratuito o de bajo coste, para comunidad y promoción. Puede no tener isla (§39.2; REQ-PRO-007). La serie «BOIA Club» es de este tipo; su primer evento real es BOIA Club · Halloween (D-23).
- **Evento prioritario.** El evento que BOIA quiere vender en cada momento. Configurable, siempre vigente (§2.1; REQ-COM-009).
- **Estado de evento.** Borrador, próximamente, a la venta, agotado, pospuesto, cancelado o finalizado (§49.4; REQ-COM-003).
- **Localización comercial común.** Lugar del mundo que usan los eventos sin isla propia; por defecto, la isla All Day vigente (§49.6, D-23; REQ-COM-010).
- **Fotos y eventos.** Página de la galería (`/fotos`), por isla o evento; la home sólo enseña las fotos marcadas como **selección** y cada isla la abre con «Ver fotos de la isla» (D-23; REQ-COM-031).
- **Adaptador de ticketera.** Capa que aísla al código del proveedor de entradas; funciona con sandbox hasta que Álvaro contrate (D-06; REQ-COM-015).
- **Descuento.** Código ligado a un evento o producto, con fechas y condiciones; descubrirlo se premia una vez (§12, §49.12; REQ-COM-020).
- **Secret location.** Dirección de un evento que no se revela en datos públicos (P3; REQ-COM-013).

## Mundo y motor

- **Isla.** Objeto del mundo con zona de proximidad, contenido y relación con eventos. Sobrevive a sus eventos (§9, §49.4; REQ-MUN-023, REQ-COM-002).
- **Sector.** Porción del mapa que se carga bajo demanda (P1; REQ-MUN-012).
- **Objeto del mundo.** Asset + geometría + comportamientos + parámetros, descrito con las 9 partes de §48.2 (REQ-MUN-024).
- **Comportamiento.** Módulo reutilizable del motor que da función a un objeto: colisión, proximidad, diálogo, recogible, etc. (§48.3; REQ-MUN-025).
- **Plantilla.** Objeto guardado con comportamientos y parámetros para duplicarlo cambiando imagen, posición o texto (§48.7; REQ-ADM-011).
- **INICIAR_MINIJUEGO.** Comportamiento de extensión para minijuegos. Arranca `faro` y `canon` por su ID (D-08, D-20; REQ-MUN-026).
- **Temporada.** Configuración versionada del mundo (islas, spawn, destino de misión, eventos, diálogos, logros). Cada mundo hace de temporada; duplicarla es L2 (§23.4, D-20; REQ-ARQ-008, REQ-ADM-032).
- **Mapa compartido, lugar.** Lista única de lugares (islas, boies, encuentros, puerto) con ID estable, posición y comportamientos, común a todos los mundos. Mover un lugar lo mueve en todos (D-20; REQ-MUN-035).
- **Mundo.** Forma que toma el mapa compartido en una temporada: una skin por lugar (arte, nombre y textos), una historia y un estilo de barco. Arcilla (B05) y Acuarela (B02) (D-20; REQ-MUN-037). Se cambia con la transición del **agujero negro**: el mundo se hunde en un vórtice y sale el otro con todo en el mismo sitio (D-23; REQ-MUN-039).
- **Mascota de BOIA.** Boia naranja con gorro azul marino (`art/marca/boia-mascota.jpg`); es la base de todas las boies del juego (D-23; REQ-AVE-040).
- **`/mar`, planeta de agua.** Vista 3D del mapa compartido, al lado de `/juego`: un pequeño planeta de agua sin costas donde la navegación da la vuelta, con cielo y estrellas en el horizonte y el botón «Entradas» siempre a mano (D-22; REQ-MUN-038, REQ-ENT-040).
- **Skin de lugar, nombre propio.** Lo que un mundo aporta a un lugar; el nombre propio sustituye al común sólo en ese mundo (D-20; REQ-MUN-036).
- **Puerto de salida.** Lugar donde empieza el barco al explorar, con la primera boia: El Varadero en Arcilla (D-20; REQ-ENT-012).
- **Borrador, revisión, publicación.** Guardar crea un borrador; publicar crea una revisión inmutable y la activa de forma atómica; restaurar vuelve a una revisión anterior (P2; REQ-ADM-015).
- **Spawn.** Punto y orientación donde aparece el barco (§23.1).
- **Teletransporte contextual.** Salto del barco a una isla al usar Tickets, Fotos o Tienda. No concede rescates ni descubrimientos (§4.3, §49.6; REQ-ENT-039).
- **Slot.** Capa intercambiable del barco: base, skin o color, bandera, accesorio, estela y tripulante (§35.1; REQ-MUN-028).
- **Skin.** Variante visual del barco con la misma física (§49.17; REQ-MUN-029).
- **Manifiesto de recurso.** Ficha JSON de cada asset con ID, versión, direcciones, fotogramas, escala, anclajes, pivote y licencia (§49.17, D-05; REQ-MUN-031).
- **Minimapa, brújula.** Mapa pequeño ampliable y reposicionable, y flecha hacia el objetivo (§10; REQ-MUN-019 a REQ-MUN-022).

## Aventura

- **Primera boia.** Boia tutorial tras el spawn, en el puerto de salida (§7, D-20; REQ-AVE-001).
- **Faro, Cañón.** Islas de los minijuegos Vigilancia del faro y Cañón contra tiburones (§49.11, D-20; REQ-AVE-036, REQ-AVE-037).
- **Boia Fiestera.** Personaje de la misión principal: se rescata entre cocodrilos y se lleva a la última isla (§8; REQ-AVE-005).
- **Última isla.** Destino de la misión, fijado por ID de temporada (§49.7; REQ-AVE-010).
- **Náufrago.** Personaje que pide ser acercado a una fiesta y entrega un descuento (§12; REQ-AVE-020).
- **Restos (flotsam).** Maderas flotantes que se recogen al pasar y se regeneran (§11.1; REQ-AVE-016).
- **Cofre fugaz, delfín, remolino.** Encuentros del mar vivo (§11.2 a §11.4).
- **Circuito.** Carrera lateral con cronómetro, checkpoints, 3 obstáculos y atajo, que acorta el camino a la última isla (§13; REQ-AVE-026).
- **Secretos.** Hallazgos escondidos que premian desviarse (§9; REQ-AVE-015).

## Web y Admin

- **Landing, home.** Página principal dentro de la escena del mundo (§4.4; REQ-ENT-024).
- **Entrada, cinemática.** Mini-mundo con «BOIA» en letras 3D y botón para entrar; al pulsarlo, aterrizaje continuo en el mar y landing (§4.4, D-19, D-20; REQ-ENT-001, REQ-ENT-003).
- **Inicio.** La landing. La sección del menú se llama Welcome Aboard (REQ-ENT-012, REQ-IDE-034).
- **Menú de a bordo.** Menú de iconos del juego (§19; REQ-IDE-034).
- **Welcome Aboard.** Sección de ayuda consultable del menú (§19, §46; REQ-IDE-035).
- **Personas detrás del sonido.** Bloque y página de artistas (§18; REQ-COM-026).
- **Panel.** Capa HTML que se abre sobre la isla: entradas, galería, tienda (§49.6).
- **Propietario, administrador, editor.** Roles del Admin en L1. Moderador y artista quedan para L2 (P2; REQ-ADM-004).

## Alcance y marcas

- **L1, L2, diferido.** Lanzamiento 1, lanzamiento 2 y sin fecha (D-02).
- **Versión de prueba.** La versión completa del plan 002 que Hernán despliega para enseñar, sin servicios externos: todo en el navegador, sello por sandbox y el Admin de la demo en `/admin`. No es la publicación (D-20; REQ-PRO-020).
- **muestra, pendiente.** Etiquetas del contenido real no aprobado (REQ-PRO-018).
- **[pendiente Álvaro], [pendiente Hernán].** El REQ necesita un dato o una aprobación de esa persona.
- **[provisional].** Alcance o resolución a confirmar por el orquestador (ver 00-indice).
