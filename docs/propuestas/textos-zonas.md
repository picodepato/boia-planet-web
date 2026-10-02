# Textos de todas las zonas · `muestra`

- Fecha: 2026-09-29
- Pide: Hernán (D-23, punto 9): los textos de todas las zonas los escribe el
  equipo.
- Estado: **`muestra`**, pendiente de una lectura rápida de Álvaro (P22). Los
  datos legales son **inventados** (D-23, O14) y se sustituyen antes de
  publicar de verdad (P21).
- Lo conecta: la T49 del plan 004 (i18n); las tareas que tocan una pantalla
  (T40 a T45) toman de aquí sus cadenas.

## Zonas

`Cadenas` es el número de claves de cada sección (una fila de tabla, una
cadena). Las zonas 1 a 18 son las de la v14 §31.2; de la 19 en adelante,
las que pide D-23 o que la v14 no inventariaba.

<!-- tabla:zonas -->
| # | Zona | Origen | Cadenas |
|---:|---|---|---:|
| 1 | Entrada y carga | v14 §31.2 · Entrada/carga | 11 |
| 2 | Home: hero | v14 §31.2 · Home hero | 14 |
| 3 | Explorar | v14 §31.2 · Explorar | 6 |
| 4 | Tickets | v14 §31.2 · Tickets; D-23 (Halloween, satélites) | 28 |
| 5 | Filosofía | v14 §31.2 · Filosofía | 16 |
| 6 | Artistas | v14 §31.2 · Artistas | 11 |
| 7 | Carnet BOIA | v14 §31.2 · Carnet BOIA | 36 |
| 8 | Primera boia | v14 §31.2 · Primera boia | 15 |
| 9 | Boia Fiestera | v14 §31.2 · Boia Fiestera | 24 |
| 10 | Náufrago | v14 §31.2 · Náufrago | 9 |
| 11 | Islas y eventos | v14 §31.2 · Islas/eventos | 26 |
| 12 | Logros | v14 §31.2 · Logros | 22 |
| 13 | Circuito | v14 §31.2 · Circuito | 17 |
| 14 | Botellas | v14 §31.2 · Botellas | 28 |
| 15 | Tienda | v14 §31.2 · Tienda | 8 |
| 16 | Controles y ajustes | v14 §31.2 · Controles/Ajustes | 22 |
| 17 | Errores y estados vacíos | v14 §31.2 · Errores/estados vacíos | 19 |
| 18 | Privacidad y moderación | v14 §31.2 · Privacidad/moderación; D-23 O9 | 22 |
| 19 | Welcome Aboard | v14 §19 · Welcome Aboard | 20 |
| 20 | Faro · Vigilancia del faro | D-20, REQ-AVE-036 (con las cadenas comunes de los minijuegos) | 34 |
| 21 | Cañón · Cañón contra tiburones | D-20, REQ-AVE-037 | 17 |
| 22 | Boia de WhatsApp e Instagram | REQ-AVE-023; D-23 O13 | 10 |
| 23 | Cinco boies informativas | D-23 O12 | 31 |
| 24 | Invitaciones al Carnet | v14 §49.10; REQ-IDE-008 | 15 |
| 25 | Ranking | D-23 punto 8 | 16 |
| 26 | Tienda de barcos | D-23 punto 1 y O5 | 39 |
| 27 | Cambio de mundo | D-23 punto 4 | 16 |
| 28 | Descuentos y «Mis códigos» | D-23 puntos 5 y 6 | 21 |
| 29 | HUD | D-23 O11 | 12 |
| 30 | Fotos y eventos | D-23 punto 7 | 11 |
| 31 | Pie de página | REQ-ENT-032 | 9 |
| 32 | Legales: aviso legal, privacidad y cookies | D-23 O14; P21 | 33 |
| | **Total** | | **618** |

## Cómo se lee

- **Una clave, una cadena.** Las claves siguen el estilo de
  `apps/web/lib/i18n/es.ts` (`zona.elemento`). Una clave que ya existe allí
  lleva `= es.ts` en la nota: se sustituye el valor, no se crea otra.
- **Por mundo.** Lo que cambia con el mundo lleva `world.<mundo>.` delante
  (`world.arcilla.…`, `world.acuarela.…`). Un mundo nuevo copia el bloque y
  cambia el texto; la clave común sin mundo es la que se usa si falta.
- **Variables** entre llaves: `{name}`, `{n}`, `{code}`, `{place}` (nombre
  del lugar en el mundo activo), `{world}`, `{date}`, `{time}`.
- **Bocadillos.** Cada bocadillo es una clave (`….1`, `….2`). Las marcas
  `cue: pulse_minimap` y `cue: pulse_menu` de la nota son las del código de
  hoy (`packages/world/src/worlds/*/skin.ts`).
- **Dato, no interfaz.** Los textos del evento real (BOIA Club · Halloween)
  son datos que se cargan en el Admin; van aquí para tenerlos juntos.
- **No se reescriben:** las cinco preguntas del Carnet (v14 §44.1, textuales,
  D-08 y D-23 punto 10) y los nombres y descripciones de los logros, que
  viven en `docs/propuestas/logros-catalogo.md`.

## Voz

La de `docs/spec/10-filosofia.md`: cercana, reconocible, con humor cuando
toca y nunca corporativa. Español de España y de tú. Los tres verbos mandan:
**dar espacio**, **descubrir**, **pertenecer**. Reglas concretas:

- «Boia», plural «boies» (D-18). «Miembro de BOIA» para las personas;
  «bollero» casi nunca y siempre explicado; «tripulación» nunca para
  personas (D-08).
- Lo comercial va claro y sin trampas: el precio, lo que es de prueba y lo
  que no. El humor está en el mar, no en el botón de pagar.
- Frases cortas. Un bocadillo cabe en dos líneas de móvil.
- Nada de «¡Increíble!», «experiencia única» ni «descubre nuestra oferta».

## 1 · Entrada y carga

| Clave | Texto | Nota |
|---|---|---|
| `intro.label` | Introducción animada | = es.ts |
| `intro.enter` | Zarpar | Botón (D-23, O3) |
| `intro.enter.aria` | Zarpar y entrar en BOIA.PLANET | |
| `intro.skip` | Saltar animación | = es.ts |
| `intro.ticketsOnly` | Solo quiero ver las entradas | |
| `intro.loading` | Inflando las boies… | |
| `intro.loadingSlow` | El mar viene con calma. Si tarda, puedes ir directo a las entradas. | Tras 4 s de carga |
| `intro.lightFallback` | Te enseñamos la versión ligera: la misma web, sin animación. | Si los recursos no llegan |
| `intro.logoAlt` | BOIA | Alternativa del wordmark |
| `intro.after.carnet` | Tu Carnet BOIA te espera en el ancla del menú. | Primer aviso tras aterrizar |
| `intro.after.language` | Idioma: español. Más idiomas, más adelante. | Acceso posterior al idioma |

## 2 · Home: hero

| Clave | Texto | Nota |
|---|---|---|
| `site.title` | BOIA.PLANET | = es.ts |
| `site.description` | BOIA, desde Alicante: música sin un único género. Entradas para los All Day BOIA y un mar entero para explorar en barco. | = es.ts |
| `hero.brand` | BOIA.PLANET | = es.ts |
| `hero.title` | BOIA UNDERGROUND MUSIC FESTIVAL | REQ-ENT-025 |
| `hero.tagline` | Música sin un único género. Cultura sin un único formato. | Frase de posicionamiento |
| `hero.explore` | Explorar el universo | = es.ts |
| `hero.tickets` | Tickets | = es.ts |
| `hero.tickets.aria` | Ver las entradas a la venta | |
| `hero.explore3d` | Navegar en 3D | = es.ts |
| `hero.explore3d.sub` | El mismo mar, en 3D y con zoom libre | = es.ts |
| `nav.carnet` | Mi Carnet | Cabecera (REQ-ENT-029) |
| `nav.sound.on` | Sonido activado | |
| `nav.sound.off` | Sonido apagado | |
| `nav.photos` | Fotos y eventos | = es.ts (antes «Fotos y vídeos») |

## 3 · Explorar

| Clave | Texto | Nota |
|---|---|---|
| `hero.explore.withPromotions` | Encuentra descuentos para tus entradas | = es.ts; texto de la v14 |
| `hero.explore.withoutPromotions` | Descubre eventos y secretos navegando | = es.ts |
| `explore.leaving` | Soltando amarras… | Mientras la landing se aparta |
| `explore.promise.title` | Navega, desvíate, descubre | |
| `explore.promise.body` | Hay islas con fiestas, códigos de descuento escondidos, secretos y una Boia Fiestera que necesita ayuda. Nadie te obliga a nada: ve a tu ritmo. | |
| `explore.back` | Volver a la web | |

## 4 · Tickets

| Clave | Texto | Nota |
|---|---|---|
| `tickets.heading` | Elige tu evento | = es.ts |
| `tickets.featured` | Evento destacado | = es.ts |
| `tickets.empty` | Ahora mismo no hay entradas a la venta. La próxima fiesta se está cocinando. | = es.ts |
| `tickets.islandInvite` | ¿Tienes un rato? Su isla esconde sorpresas: llega navegando. | = es.ts |
| `tickets.sailToIsland` | Ir a su isla | |
| `tickets.close` | Cerrar | = es.ts |
| `tickets.satellite.warmup` | Calienta para el próximo All Day | D-23, O7 |
| `tickets.satellite.linkAllDay` | Ver el próximo All Day | |
| `tickets.satellite.noAllDay` | El próximo All Day todavía no tiene fecha. Entérate antes que nadie en el WhatsApp de BOIA. | |
| `event.buy` | Comprar entradas | = es.ts |
| `event.soon` | Entradas próximamente | = es.ts |
| `event.soldOut.body` | Agotadas. Mira los próximos eventos: siempre hay otra isla. | |
| `event.postponed.body` | Hemos cambiado la fecha. En cuanto esté cerrada, la verás aquí. | Política real pendiente (REQ-COM-008) |
| `event.cancelled.body` | Este evento no se hace. Lo sentimos mucho; aquí tienes los próximos. | |
| `checkout.title` | Compra de prueba | |
| `checkout.testNotice` | Versión de prueba: no se cobra nada ni se emite una entrada real. Al confirmar, el sello del evento aparece en tu Carnet. | |
| `checkout.price` | Entrada · precio de muestra | |
| `checkout.total` | Total de prueba | |
| `checkout.confirm` | Confirmar compra de prueba | |
| `checkout.confirming` | Confirmando… | |
| `checkout.noDiscount` | Sin descuento. Algunos se esconden en el mar. | |
| `checkout.stampAdded` | ¡Sello añadido a tu Carnet! | |
| `checkout.viewCarnet` | Ver Mi Carnet | |
| `event.halloween-2026.name` | BOIA Club · Halloween | Dato del evento real (D-23) |
| `event.halloween-2026.when` | Sábado, 31 de octubre de 2026 | Dato |
| `event.halloween-2026.place` | Kiki García Bar | Dato |
| `event.halloween-2026.summary` | La primera noche del BOIA Club. Disfraz opcional, música sin etiqueta y un bar lleno de fantasmas con buen gusto. | Dato, `muestra` |
| `event.halloween-2026.poster` | Cartel próximamente | Dato (P19) |

## 5 · Filosofía

Manifiesto completo (bloques 1 a 8) y versión breve, a partir de §37.

| Clave | Texto | Nota |
|---|---|---|
| `philosophy.heading` | Filosofía | = es.ts |
| `philosophy.short.title` | BOIA en pocas palabras | Versión breve |
| `philosophy.short.body` | BOIA nace en Alicante para dar espacio a lo que merece ser descubierto. Música sin un único género, cultura sin un único formato y una comunidad en la que no vienes a mirar: formas parte. Ven por la música. Quédate por todo lo que ocurre alrededor. | Home y pie de la isla |
| `philosophy.manifesto.title` | Manifiesto | |
| `philosophy.manifesto.1` | BOIA nace en Alicante de una necesidad sencilla: un sitio para la música que no encaja en una sola etiqueta. No nace contra el reguetón, el house ni el techno. Nace porque no quiere elegir. | §37.1 |
| `philosophy.manifesto.2` | Nuestra idea cabe en dos palabras: dar espacio. A artistas nuevos y a los de siempre, a proyectos que todavía no tienen circuito y a gente con algo que compartir. | §37.2 |
| `philosophy.manifesto.3` | La música es el eje, pero no está sola. En BOIA caben la fotografía, los fanzines, las marcas pequeñas, una paella al mediodía y unas hamburguesas de madrugada. Si tiene sentido aquí, tiene sitio. | §37.3 |
| `philosophy.manifesto.4` | Nadie pertenece a un solo género. Queremos que llegues por un artista que conoces y te vayas con tres que no conocías. | §37.4 |
| `philosophy.manifesto.5` | Para nosotros, underground no es elitismo. Es independencia, curiosidad y dar oportunidad a lo que todavía no ocupa el centro. La pregunta nunca es si algo es lo bastante underground, sino si aporta algo. | §37.5 |
| `philosophy.manifesto.6` | BOIA no existe para hacer rico a nadie. El dinero paga el espacio, la producción y el trabajo, y lo que sobra intenta repartirse con justicia. Queremos crecer con nuestros artistas, no a su costa. | §37.6 |
| `philosophy.manifesto.7` | No queremos público: queremos gente que forme parte. Aquí puedes bailar al lado de quien pincha, comer con él o seguir la charla en la barra. No vienes simplemente a BOIA. Formas parte de BOIA. | §37.7 |
| `philosophy.manifesto.8` | Un All Day BOIA nunca es «otra fiesta de». Es un día entero que cambia con las horas: música, comida, juegos, proyectos y cosas que no esperabas. Al salir no dices que has ido a una fiesta de techno. Dices que has estado en BOIA. | §37.8, §37.9 |
| `philosophy.verb.space` | Dar espacio · a artistas, proyectos, ideas y personas. | §37.10 |
| `philosophy.verb.discover` | Descubrir · música, cultura, gente y cosas que no esperabas. | §37.10 |
| `philosophy.verb.belong` | Pertenecer · sentir que formas parte, no que miras desde fuera. | §37.10 |
| `philosophy.closing` | Ven por la música. Quédate por todo lo que ocurre alrededor. | §37.11 |

## 6 · Artistas

| Clave | Texto | Nota |
|---|---|---|
| `artists.heading` | Personas detrás del sonido | = es.ts |
| `artists.intro` | Música sin un único género. Estas son algunas de las personas que la hacen sonar en BOIA, de las que ya conoces a las que vas a descubrir. | = es.ts |
| `artists.all` | Ver todos los artistas | = es.ts |
| `artists.azLabel` | Artistas de la A a la Z | = es.ts |
| `artists.page.title` | Todos los artistas | = es.ts |
| `artists.page.lead` | {count} artistas, de la A a la Z. | = es.ts; la lista ya no es provisional (D-23) |
| `artists.page.back` | Volver al inicio | = es.ts |
| `artists.pause` | Pausar rotación | = es.ts |
| `artists.resume` | Reanudar rotación | = es.ts |
| `artists.genres` | Géneros | = es.ts |
| `artists.photoPending` | Foto próximamente | Avatar neutro (P17) |

## 7 · Carnet BOIA

| Clave | Texto | Nota |
|---|---|---|
| `carnet.title` | Mi Carnet | |
| `carnet.invite.body` | Tu Carnet BOIA es tu sitio en la comunidad: tu apodo, tus respuestas, los sellos de tus fiestas y tu barco. No es una ficha: es cómo te reconocen los demás miembros. | |
| `carnet.create` | Crear mi Carnet | |
| `carnet.edit` | Editar mi Carnet | |
| `carnet.viewAsOthers` | Así te ven los demás | |
| `carnet.fullScreen` | Ver mi Carnet a pantalla completa | |
| `carnet.localOnly` | Versión de prueba: tu Carnet se guarda sólo en este navegador y nadie más lo ve. | REQ-IDE-051 |
| `carnet.publicNotice` | Cuando BOIA.PLANET abra de verdad, tu Carnet será público: apodo, foto o avatar, respuestas, sellos, logros y barco. Para probarlo no te pedimos email. | |
| `carnet.field.nickname` | Apodo | |
| `carnet.field.nickname.help` | De 2 a 30 caracteres. Así te conocerán en BOIA. | |
| `carnet.field.photo` | Foto o avatar | |
| `carnet.field.photo.upload` | Subir una foto | |
| `carnet.field.photo.change` | Cambiar la foto | |
| `carnet.field.photo.remove` | Quitar la foto | |
| `carnet.questions.heading` | Tus 5 preguntas | |
| `carnet.questions.help` | Contesta las que quieras. Siempre se ven con su pregunta, nunca sueltas. | |
| `carnet.q1` | ¿Cuál ha sido la cosa más rara que has visto pasar en una fiesta o festival? | v14 §44.1, textual |
| `carnet.q2` | ¿Cuál es el mejor descubrimiento musical que hiciste por casualidad? | v14 §44.1, textual |
| `carnet.q3` | ¿Qué obra, fotografía, película, disco o pieza artística te cambió un poco la cabeza? | v14 §44.1, textual |
| `carnet.q4` | ¿Cuál es tu mejor recuerdo relacionado con la música? | v14 §44.1, textual |
| `carnet.q5` | Completa la frase: una buena fiesta necesita siempre… | v14 §44.1, textual |
| `carnet.memberSince` | Miembro de BOIA desde {date} | |
| `carnet.stamps.heading` | Sellos | |
| `carnet.badges.heading` | Insignias | |
| `carnet.save` | Guardar | |
| `carnet.cancel` | Cancelar | |
| `carnet.empty.answers.own` | Aún no has contestado ninguna pregunta. Empieza por la que te salga sola. | |
| `carnet.empty.answers.other` | Todavía no ha contestado nada. Misterio. | |
| `carnet.empty.stamps` | Aún sin sellos. Cada fiesta deja el suyo cuando compras la entrada. | |
| `carnet.empty.achievements` | Aún sin logros. El mar está lleno de excusas. | |
| `carnet.empty.ship` | Barco de serie, sin cosméticos todavía. | |
| `carnet.error.nicknameTaken` | Ese apodo ya lo lleva otro miembro de BOIA. Prueba con otro. | |
| `carnet.error.photo` | No hemos podido usar esa foto. Prueba con otra. | |
| `carnet.error.save` | No se ha podido guardar. Vuelve a intentarlo. | |
| `carnet.notFound.title` | Carnet no encontrado | |
| `carnet.notFound.body` | En esta versión de prueba cada Carnet vive en el navegador de quien lo creó, y este no está aquí. | |

## 8 · Primera boia

Diálogo tutorial de la boia de la entrada (`puerto-boia`), por mundo.
Cumple REQ-AVE-003 (misión, descuentos, monedas y secretos) y REQ-AVE-004
(minimapa y menú).

| Clave | Texto | Nota |
|---|---|---|
| `world.arcilla.boia.tutorial.1` | ¡Plop! Bienvenido a BOIA.PLANET. Soy la boia del puerto y hoy me toca recibirte. | |
| `world.arcilla.boia.tutorial.2` | Toca en cualquier sitio y arrastra: el barco va hacia donde apuntes. | |
| `world.arcilla.boia.tutorial.3` | Una Boia Fiestera se ha quedado atrapada entre cocodrilos. Encuéntrala y llévala a la Isla del Amanecer. | |
| `world.arcilla.boia.tutorial.4` | Por el camino hay monedas, descuentos para tus entradas y algún secreto. Desvíate sin miedo. | |
| `world.arcilla.boia.tutorial.5` | Arriba tienes el minimapa: tócalo para ampliar, mantenlo pulsado para moverlo. | cue: pulse_minimap |
| `world.arcilla.boia.tutorial.6` | Y en el ancla está el Menú de a bordo: tu Carnet, tus logros y tu barco. ¡Buen viaje! | cue: pulse_menu |
| `world.acuarela.boia.tutorial.1` | ¡Plop! Esta tarde es Sant Joan y el cuaderno está recién pintado. Bienvenido. | |
| `world.acuarela.boia.tutorial.2` | Toca en cualquier sitio y arrastra: el remolcador va hacia donde apuntes. | |
| `world.acuarela.boia.tutorial.3` | La Fiestera se ha quedado en L'Albufereta con los farolillos. Encuéntrala y llévala a Tabarca antes de medianoche. | |
| `world.acuarela.boia.tutorial.4` | Por el camino hay monedas, descuentos para tus entradas y algún secreto. Mira bien: la pintura aún está húmeda. | |
| `world.acuarela.boia.tutorial.5` | Arriba tienes el minimapa: tócalo para ampliar, mantenlo pulsado para moverlo. | cue: pulse_minimap |
| `world.acuarela.boia.tutorial.6` | Y en el ancla está el Menú de a bordo: tu Carnet, tus logros y tu barco. ¡Buena verbena! | cue: pulse_menu |
| `boia.tutorial.away` | ¡Eh, que no había terminado! Vuelve cuando quieras. | Si el barco se aleja (§7) |
| `dialogue.next` | Toca para seguir | |
| `dialogue.close` | Cerrar el bocadillo | Etiqueta accesible (REQ-AVE-002) |

## 9 · Boia Fiestera

| Clave | Texto | Nota |
|---|---|---|
| `world.arcilla.fiestera.call.1` | ¡Eh, barquito! Estos señores no me dejan ir a la fiesta. | Pide ayuda |
| `world.arcilla.fiestera.call.2` | Tranquilo, no muerden. Sólo son muy pesados. | |
| `world.arcilla.fiestera.board` | ¡Arriba! ¿Me llevas a la Isla del Amanecer? Te lo pago bailando. | Al subir |
| `world.acuarela.fiestera.call.1` | ¡Eh, barquito azul! Estos señores se han quedado con mis farolillos. | |
| `world.acuarela.fiestera.call.2` | No son malos: es que les encantan las luces. | |
| `world.acuarela.fiestera.board` | ¿Me llevas a Tabarca? A medianoche se quema la hoguera. | |
| `fiestera.crocs` | Los cocodrilos se sumergen, muertos de vergüenza. | Aviso breve |
| `mission.rescued.title` | Nueva tripulante a bordo | v14 §8.1 |
| `mission.rescued.body` | Boia Fiestera rescatada · Destino: {place} | {place}: la última isla del mundo |
| `mission.route` | Lleva a la Fiestera a {place} | |
| `mission.route.clear` | Quitar rumbo | |
| `fiestera.react.1` | ¡Uy, qué sitio! | Reacciones a bordo, de vez en cuando |
| `fiestera.react.2` | ¡Aquí montaba yo una fiesta! | |
| `fiestera.react.3` | ¿Esto sale en el mapa? | |
| `fiestera.react.4` | Más despacio, que se me mueve el gorro. | |
| `fiestera.react.5` | ¿Eso era un descuento? ¡Cógelo, cógelo! | |
| `world.arcilla.fiestera.final.1` | ¡Ha llegado! ¡Encended las luces! | Boies amigas |
| `world.arcilla.fiestera.final.2` | Aquí la fiesta acaba cuando sale el sol, y todavía queda noche. | |
| `world.arcilla.fiestera.final.3` | Gracias por traerla. Quédate: esto no se ve desde la orilla. | |
| `world.acuarela.fiestera.final.1` | ¡Los farolillos! Justo a tiempo. | |
| `world.acuarela.fiestera.final.2` | Mójate los pies y pide un deseo. | |
| `world.acuarela.fiestera.final.3` | La pintora cierra el cuaderno al amanecer. Hasta entonces, verbena. | |
| `mission.delivered.title` | ¡Fiesta en {place}! | |
| `mission.delivered.body` | La Boia Fiestera ya está en casa. El mar sigue abierto: explora, compra, compite. | |

## 10 · Náufrago

| Clave | Texto | Nota |
|---|---|---|
| `world.arcilla.naufrago.1` | ¡Llevo tres fiestas esperando aquí! Acércame a una de BOIA y te dejo un regalo. | |
| `world.arcilla.naufrago.2` | Arrima el barco al banco de arena y subo de un salto. | |
| `world.arcilla.naufrago.thanks` | ¡Por fin! Toma, esto vale más que mi balsa. | Al subir |
| `world.acuarela.naufrago.1` | Llevo tres verbenas esperando que alguien me pinte de vuelta a tierra. | |
| `world.acuarela.naufrago.2` | Acércame a una fiesta de BOIA y te dejo un regalo. Arrima el remolcador al banco y subo de un salto. | |
| `world.acuarela.naufrago.thanks` | ¡Qué bien pintado estás! Toma, para la próxima fiesta. | |
| `naufrago.reward.title` | Regalo del náufrago | |
| `naufrago.reward.body` | Un {percent} de descuento en tu próxima entrada: {code}. | |
| `naufrago.reward.again` | Ya te di mi regalo. Lo tienes en «Mis códigos». | Segunda visita |

## 11 · Islas y eventos

| Clave | Texto | Nota |
|---|---|---|
| `island.kicker.event` | Isla de evento | |
| `island.kicker.island` | Isla | |
| `island.firstVisit` | Isla descubierta: {place} | Aviso |
| `island.explore` | Explorar la isla | Visitas posteriores (REQ-AVE-013) |
| `island.sailHere` | Navegar aquí | |
| `island.upcoming.heading` | Próximos eventos | |
| `island.memories.heading` | Recuerdos de esta isla | |
| `island.memories.empty` | Las fotos de esta isla todavía se están revelando. | REQ-AVE-014 |
| `island.photos.cta` | Ver fotos de la isla | D-23, punto 7 |
| `island.buy` | Comprar entrada | |
| `island.event.memory` | Este evento ya pasó. Aquí se queda su recuerdo: fotos, cartel y artistas. | Isla en recuerdo |
| `island.event.soldOut` | Agotado. Pero esta isla tiene más fiestas: mira abajo. | |
| `island.secretHint` | Por aquí cerca huele a secreto. | |
| `island.allday.name` | Isla del escenario · All Day BOIA | Nombre común, igual en todos los mundos (D-20) |
| `world.arcilla.island.puerto.body` | El Varadero: de aquí salen los barcos cada temporada. Las gaviotas no pagan amarre. | |
| `world.arcilla.island.cala.body` | Aquí se coció tu barco. Todavía está caliente. De día la cala cocina; de noche, baila. | |
| `world.arcilla.island.allday.body` | All Day BOIA: de la paella al amanecer. ¿Llegas en barco? Pasa por el arco, que la fiesta está dentro. | |
| `world.arcilla.island.fotos.body` | Todas las fotos de BOIA se revelan aquí. Pasa por el marco y sonríe. | |
| `world.arcilla.island.tienda.body` | Camisetas, tote bags y pegatinas. La tienda de verdad está en tierra; esto es su escaparate. | |
| `world.arcilla.island.ultima.body` | Aquí la fiesta acaba cuando sale el sol. Quédate un rato: esto no se ve desde la orilla. | |
| `world.acuarela.island.puerto.body` | La Explanada: aquí se abre el cuaderno. Cuidado con el mosaico, que marea. | |
| `world.acuarela.island.cala.body` | Aquí vive la pintora del cuaderno: lo que pinta cobra vida mientras está húmedo. Cuidado, que aún estás fresco: si te mojas mucho, se te corre el azul. | |
| `world.acuarela.island.allday.body` | La barraca del All Day, montada como las de Hogueras. De la tarde a medianoche, sin un solo género. | |
| `world.acuarela.island.fotos.body` | En La Vila cada casa es de un color para que los marineros la vieran desde el mar. Aquí cada foto de BOIA tiene su casa. | |
| `world.acuarela.island.tienda.body` | Camisetas, bolsas y pegatinas. La tienda de verdad está en tierra; esta cúpula se ve desde lejos, como la de Altea. | |
| `world.acuarela.island.ultima.body` | La verbena acaba en Tabarca: a medianoche se quema la hoguera y todo el mundo se moja los pies para pedir un deseo. | |

## 12 · Logros

Nombres, descripciones y «te queda» de cada logro: `docs/propuestas/logros-catalogo.md`
(aprobado por Hernán con cambios, plan 003 T36). Aquí, los mensajes comunes.

| Clave | Texto | Nota |
|---|---|---|
| `achievements.heading` | Logros | |
| `achievements.counter` | {got} de {total} logros | |
| `achievements.state.inProgress` | En curso | |
| `achievements.state.ready` | Listo para reclamar | |
| `achievements.state.claimed` | Reclamado | |
| `achievements.claim` | Reclamar | |
| `achievements.hidden` | ??? | Logro oculto |
| `achievements.hidden.hint` | Logro oculto. Sigue navegando. | |
| `achievements.notice.ready` | ¡Logro completado! Reclama tu premio | Aviso (plan 003 T32) |
| `achievements.notice.claimed` | Premio reclamado: {reward} | |
| `achievements.reward.points` | +{n} puntos | |
| `achievements.reward.coins` | +{n} monedas | |
| `achievements.reward.ship` | Barco nuevo: {ship} | |
| `achievements.reward.badge` | Insignia en tu Carnet: {badge} | |
| `achievements.reward.cosmetic` | Para tu barco: {cosmetic} | |
| `balances.points` | Puntos | |
| `balances.coins` | Monedas | |
| `balances.rank` | Rango: {rank} | |
| `rank.1` | Grumete | Nombres de hoy, se mantienen |
| `rank.2` | Marinera | |
| `rank.3` | Timonel | |
| `rank.4` | Capitana de la fiesta | |

## 13 · Circuito

| Clave | Texto | Nota |
|---|---|---|
| `circuit.idle` | {place} · pasa por el arco de salida para empezar | {place}: El Freu o El Penyal |
| `circuit.idle.record` | {place} · récord {time} · pasa por el arco | |
| `circuit.countdown.go` | ¡Ya! | |
| `circuit.shortcut.sign` | ATAJO → | Cartel (v14 §13) |
| `circuit.shortcut.taken` | Atajo. Valiente. | Aviso breve al pasar el checkpoint del atajo |
| `circuit.finish.record.title` | ¡Récord! {time} | |
| `circuit.finish.record.body` | Tu mejor vuelta en {place}. | |
| `circuit.finish.title` | Meta: {time} | |
| `circuit.finish.body` | Tu récord: {time} | |
| `circuit.localRecord` | Récord personal, guardado en este navegador. | D-09 |
| `circuit.void` | Vuelta anulada | |
| `circuit.void.panel` | Vuelta anulada: abriste un panel | |
| `circuit.void.tab` | Vuelta anulada: saliste de la pestaña | |
| `circuit.void.slow` | Vuelta anulada: demasiado tiempo | |
| `circuit.void.retry` | Vuelve a pasar por la salida. | |
| `world.arcilla.circuit.judge` | Por la derecha, ancho y tranquilo. Por el Freu, rápido y con dientes. | El juez de carrera |
| `world.acuarela.circuit.judge` | Por fuera del Penyal, ancho y tranquilo. Por dentro, rápido y con rocas. | |

## 14 · Botellas

| Clave | Texto | Nota |
|---|---|---|
| `bottle.rules` | Una botella por persona, de hasta 140 caracteres. No da puntos ni monedas: es para quien la encuentre. | |
| `bottle.localOnly` | Versión de prueba: tu botella se guarda sólo en este navegador y sólo la ves tú. | REQ-IDE-051 |
| `bottle.needCarnet` | Para echar una botella necesitas tu Carnet BOIA. | |
| `bottle.title.own` | Tu botella | |
| `bottle.title.found` | Botella en el mar | |
| `bottle.title.from` | Botella de {name} | |
| `bottle.field` | Tu mensaje | |
| `bottle.counter` | {n}/140 | |
| `bottle.throw` | Echar al mar | |
| `bottle.save` | Guardar | |
| `bottle.edit` | Editar | |
| `bottle.retire` | Retirar del mar | |
| `bottle.retire.confirm` | ¿La retiras? Desaparece del mar para todo el mundo. | |
| `bottle.retire.yes` | Sí, retirarla | |
| `bottle.retire.no` | No | |
| `bottle.viewCarnet` | VER SU CARNET | v14 §46 |
| `bottle.report` | Reportar | |
| `bottle.report.reason` | ¿Qué pasa con esta botella? (opcional) | |
| `bottle.report.send` | Enviar reporte | |
| `bottle.report.done` | Gracias. El equipo de BOIA la revisará. | |
| `bottle.report.again` | Ya la habías reportado. Gracias. | |
| `bottle.status.floating` | Tu botella ya flota en el mar. | |
| `bottle.status.updated` | Botella actualizada. | |
| `bottle.status.retired` | Botella retirada. Puedes echar otra cuando quieras. | |
| `bottle.conflict` | Ya tienes una botella en el mar: edítala o retírala antes de echar otra. | |
| `bottle.noSpot` | Aquí sólo hay tierra. Aléjate un poco de la costa y vuelve a probar. | |
| `bottle.gone` | Esta botella ya no está en el mar. | |
| `bottle.empty` | Aún no has echado ninguna botella. | |

## 15 · Tienda

| Clave | Texto | Nota |
|---|---|---|
| `store.heading` | Tienda | = es.ts |
| `store.intro` | Camisetas, tote bags y pegatinas de BOIA. Lo que vendemos paga la siguiente fiesta. | = es.ts |
| `store.cta` | Ir a la tienda | = es.ts |
| `store.cta.aria` | Ir a la tienda de BOIA (se abre en otra pestaña) | = es.ts |
| `store.kicker` | Tienda | Panel de la isla |
| `store.soon` | Productos nuevos, próximamente. | |
| `store.discount.title` | Descuento para la tienda | D-23, O8 |
| `store.discount.body` | Cópialo y úsalo en la tienda de BOIA: allí lo validan. | |

## 16 · Controles y ajustes

| Clave | Texto | Nota |
|---|---|---|
| `controls.heading` | Controles | |
| `controls.sail.heading` | Navegar | |
| `controls.sail.touch` | Toca en cualquier sitio y arrastra: el barco va hacia donde apuntes. | |
| `controls.sail.drift` | Drift: apoya un segundo dedo mientras navegas (o mantén Shift en el teclado). | |
| `controls.sail.keyboard` | En el ordenador: flechas o WASD. | |
| `controls.keyboard.legend` | Teclado | |
| `controls.keyboard.screen` | Dirección de pantalla | D-14 |
| `controls.keyboard.screen.help` | La flecha arriba lleva el barco hacia arriba, como el dedo. | |
| `controls.keyboard.tank` | Control de tanque | |
| `controls.keyboard.tank.help` | Arriba acelera; izquierda y derecha giran. | |
| `controls.minimap.heading` | Minimapa y brújula | |
| `controls.minimap.tap` | Toca el minimapa para ampliarlo. | |
| `controls.minimap.hold` | Mantenlo pulsado medio segundo y arrástralo para cambiarlo de sitio. | |
| `controls.compass` | La brújula señala el sitio que elijas en el mapa o, si no eliges, lo siguiente sin explorar. | |
| `settings.heading` | Ajustes | |
| `settings.language` | Idioma | |
| `settings.music` | Música de ambiente | D-23, O10 |
| `settings.effects` | Efectos de sonido | |
| `settings.volume` | Volumen | |
| `settings.on` | Activada | |
| `settings.effectsNote` | Los efectos siguen sonando aunque quites la música. Todo se guarda en este dispositivo. | |
| `settings.musicSample` | Música generada de muestra, hasta que llegue la de BOIA. | P18 |

## 17 · Errores y estados vacíos

| Clave | Texto | Nota |
|---|---|---|
| `error.notFound.title` | Aquí no hay nada. Ni una boia. | 404 |
| `error.notFound.body` | La página que buscas no existe o se la llevó la corriente. | |
| `error.notFound.cta` | Volver al inicio | |
| `error.generic.title` | Algo se ha torcido | |
| `error.generic.body` | No es culpa tuya. Recarga la página y, si sigue igual, vuelve en un rato. | |
| `error.generic.retry` | Reintentar | |
| `error.offline` | Sin conexión. Puedes seguir navegando lo que ya está cargado; lo que consigas se guarda en este navegador. | |
| `error.offline.tickets` | Sin conexión no podemos abrir la compra. Vuelve a intentarlo cuando tengas cobertura. | |
| `error.engine` | No hemos podido arrancar el mar en este navegador. Prueba la versión ligera o actualiza el navegador. | |
| `error.engine.cta` | Ver la versión ligera | |
| `error.3d.title` | Este móvil no puede con el 3D | `/mar` |
| `error.3d.body` | Prueba la versión clásica: el mismo mar, en 2D. | |
| `error.3d.cta` | Ir al mar 2D | |
| `error.storage` | Tu navegador no nos deja guardar nada (¿modo privado?). Puedes navegar, pero lo que consigas se perderá al cerrar. | |
| `error.unavailable` | Esto no está disponible ahora mismo. Vuelve en un rato. | |
| `empty.loading` | Cargando… | |
| `empty.noProfile` | Aún no tienes Carnet. Se crea en un momento y sin email. | |
| `empty.noEvents` | Ahora no hay eventos a la venta. La próxima fiesta se está cocinando. | |
| `empty.noPhotos` | Todavía no hay fotos. Se están revelando. | |

## 18 · Privacidad y moderación

Normas sociales, reporte y moderación de Carnets (D-23, O9). Los textos
legales completos van en la sección 32.

| Clave | Texto | Nota |
|---|---|---|
| `community.rules.title` | Normas de a bordo | |
| `community.rules.1` | Aquí se viene a compartir: trata a los demás como te gustaría que te trataran en la pista. | |
| `community.rules.2` | Nada de insultos, acoso, odio ni contenido sexual en Carnets o botellas. | |
| `community.rules.3` | No publiques datos personales tuyos ni de nadie: ni teléfonos, ni direcciones, ni apellidos. | |
| `community.rules.4` | No suplantes a nadie, tampoco a artistas de BOIA. | |
| `community.rules.5` | Si algo no te gusta, repórtalo. Lo revisa una persona del equipo. | |
| `privacy.short` | Esta versión de prueba no usa cookies ni te pide datos: lo que haces se guarda sólo en tu navegador. | Pie y Carnet |
| `carnet.report` | Reportar este Carnet | |
| `carnet.report.reason` | ¿Qué pasa con este Carnet? (opcional) | |
| `carnet.report.send` | Enviar reporte | |
| `carnet.report.done` | Gracias. El equipo de BOIA lo revisará. | |
| `carnet.report.again` | Ya lo habías reportado. Gracias. | |
| `carnet.moderated.answer` | Respuesta retirada por moderación. | |
| `carnet.moderated.photo` | Foto retirada por moderación. | |
| `carnet.moderated.nickname` | Miembro de BOIA {n} | Apodo tras restablecerlo |
| `admin.moderation.carnets.heading` | Carnets reportados | |
| `admin.moderation.carnets.empty` | No hay Carnets reportados. Buena señal. | |
| `admin.moderation.hideAnswer` | Ocultar respuesta | |
| `admin.moderation.hidePhoto` | Ocultar foto | |
| `admin.moderation.resetNickname` | Restablecer apodo | |
| `admin.moderation.dismiss` | Descartar el reporte | |
| `admin.moderation.reason` | Motivo (queda en la auditoría) | |

## 19 · Welcome Aboard

Primera sección del Menú de a bordo (v14 §19).

| Clave | Texto | Nota |
|---|---|---|
| `menu.aria` | Menú de a bordo | |
| `menu.close` | Cerrar menú | |
| `menu.welcome` | Welcome Aboard | Nombre de la sección (v14 §19) |
| `menu.carnet` | Mi Carnet | |
| `menu.achievements` | Logros | |
| `menu.discounts` | Mis códigos | D-23, punto 5 (antes «Descuentos») |
| `menu.worlds` | Mundos | |
| `menu.ship` | Barco | |
| `menu.ranking` | Ranking | |
| `menu.controls` | Controles | |
| `menu.settings` | Ajustes | |
| `welcome.title` | Bienvenido a bordo | |
| `welcome.what` | BOIA.PLANET es el universo de BOIA: un mar con islas de fiestas, descuentos escondidos, secretos y gente con Carnet. Aquí se compran las entradas y aquí se viene a curiosear. | |
| `welcome.goal` | Tu misión: encontrar a la Boia Fiestera y llevarla hasta la última isla. Lo demás es opcional, y ahí está la gracia. | |
| `welcome.tip.sail` | Toca y arrastra en cualquier sitio para navegar. | |
| `welcome.tip.island` | Acércate a una isla para ver su evento y sus fotos. | |
| `welcome.tip.compass` | La brújula señala lo siguiente sin explorar. | |
| `welcome.tip.tickets` | ¿Sólo quieres entradas? Botón «Inicio» y luego «Tickets». No hace falta jugar. | REQ-PRO-002 |
| `welcome.world` | Estás en {world}. Puedes cambiar de mundo en «Mundos»: todo sigue en su sitio. | |
| `welcome.sample` | Textos de muestra, pendientes de Álvaro. | |

## 20 · Faro · Vigilancia del faro

| Clave | Texto | Nota |
|---|---|---|
| `island.faro.name` | Isla del Faro | Nombre común; en Acuarela, «Cap de l'Horta» |
| `world.arcilla.faro.body` | Desde aquí se vigila la bocana. Los piratas llegan de noche y se disfrazan de mercantes: hace falta buen ojo. | Panel editorial (REQ-AVE-036) |
| `world.acuarela.faro.body` | Desde el faro del Cap de l'Horta se vigila el cuaderno: por aquí intentan colarse los piratas. | |
| `minigame.faro.title` | Vigilancia del faro | |
| `minigame.faro.summary` | Es de noche. Mueve el haz, ilumina los barcos que se acercan y da la alarma sólo cuando veas un pirata. | |
| `minigame.faro.howto.1` | Mueve el haz con el dedo, el ratón o las flechas. | |
| `minigame.faro.howto.2` | Deja la luz sobre un barco un momento para ver su bandera. | |
| `minigame.faro.howto.3` | Calavera con huesos cruzados = pirata: pulsa ALARMA (o Espacio). | |
| `minigame.faro.howto.4` | Los mercantes y los barcos de rayas tienen que llegar a puerto. Ojo con las banderas parecidas. | |
| `minigame.faro.action` | ALARMA | |
| `minigame.faro.status.pirates` | Piratas | |
| `minigame.faro.status.false` | Falsas alarmas | |
| `minigame.faro.status.ships` | Barcos | |
| `minigame.faro.hit` | ¡Pirata! Da media vuelta. | |
| `minigame.faro.falseAlarm` | Falsa alarma. Era un mercante con mala suerte. | |
| `minigame.faro.escaped` | Se ha colado un pirata. | |
| `minigame.faro.win` | ¡Bocana a salvo! Cinco piratas han dado media vuelta. | |
| `minigame.faro.lose.false` | Demasiadas falsas alarmas: el puerto ya no se fía. | |
| `minigame.faro.lose.ships` | Ya no quedan barcos por pasar esta noche. | |
| `minigame.faro.lose.time` | Se acabó la guardia de esta noche. | |
| `minigame.kicker` | Minijuego | Común a Faro y Cañón |
| `minigame.play` | Jugar | |
| `minigame.start` | Empezar | |
| `minigame.back` | Volver al mar | |
| `minigame.again` | Otra vez | |
| `minigame.pause` | Pausa | |
| `minigame.resume` | Seguir | |
| `minigame.best.none` | Aún no tienes marca. | |
| `minigame.best` | Tu mejor marca: {n}. | |
| `minigame.best.new` | Tu mejor marca: {n}. ¡Nueva! | |
| `minigame.won` | ¡Conseguido! | |
| `minigame.lost` | Fin de la partida | |
| `minigame.hiddenTab` | La pestaña se ocultó: esta partida ya no da premio, pero puedes seguir jugando. | |
| `minigame.status.time` | Tiempo | |

## 21 · Cañón · Cañón contra tiburones

| Clave | Texto | Nota |
|---|---|---|
| `island.canon.name` | Isla del Cañón | Nombre común; en Acuarela, «Torre de l'Illeta» |
| `world.arcilla.canon.body` | Los tiburones rondan la cala y asustan a los bañistas. Este cañón dispara bolas de agua: nadie sale herido, sólo mojado. | |
| `world.acuarela.canon.body` | La Torre de l'Illeta ahuyenta tiburones a cañonazos de agua. Ni un rasguño: sólo sustos. | |
| `minigame.canon.title` | Cañón contra tiburones | |
| `minigame.canon.summary` | Apunta, calcula dónde cae la bola y ahuyenta a tres tiburones antes de quedarte sin bolas. | |
| `minigame.canon.howto.1` | Arrastra para apuntar (o usa el ratón o las flechas). | |
| `minigame.canon.howto.2` | La línea de puntos te dice más o menos dónde caerá la bola. | |
| `minigame.canon.howto.3` | Suelta o pulsa FUEGO (o Espacio) para disparar. | |
| `minigame.canon.howto.4` | Los tiburones se sumergen y cambian de rumbo: adelántate. | |
| `minigame.canon.action` | FUEGO | |
| `minigame.canon.status.sharks` | Tiburones | |
| `minigame.canon.status.balls` | Bolas | |
| `minigame.canon.hit` | ¡Tiburón ahuyentado! | |
| `minigame.canon.miss` | Al agua. Ningún tiburón por ahí. | |
| `minigame.canon.win` | ¡Cala despejada! Los tres tiburones se han ido a otra parte. | |
| `minigame.canon.lose.balls` | Sin bolas en la santabárbara. Otra vez será. | |
| `minigame.canon.lose.time` | Se acabó el tiempo. Los tiburones siguen de paseo. | |

## 22 · Boia de WhatsApp e Instagram

| Clave | Texto | Nota |
|---|---|---|
| `whatsapp.title` | Boia de WhatsApp | |
| `world.arcilla.whatsapp.body` | ¿Quieres enterarte antes que nadie de la próxima fiesta? BOIA tiene un grupo de WhatsApp. Entras si quieres y sales cuando quieras. | |
| `world.acuarela.whatsapp.body` | Antes de pintar la próxima fiesta, la pintora avisa por WhatsApp. Entras si quieres y sales cuando quieras. | |
| `whatsapp.cta` | Abrir WhatsApp ↗ | Enlace `muestra` (P15) |
| `whatsapp.cta.aria` | Abrir el WhatsApp de BOIA (se abre en otra pestaña) | |
| `instagram.cta` | Síguenos en Instagram ↗ | D-23, O13 |
| `instagram.cta.aria` | Instagram de BOIA (se abre en otra pestaña) | |
| `footer.instagram` | Instagram | |
| `footer.whatsapp` | WhatsApp | |
| `footer.invite.whatsapp` | Entérate antes que nadie de la próxima fiesta en el WhatsApp de BOIA. | REQ-ENT-032 |

## 23 · Cinco boies informativas

Cinco boies nuevas en la primera ruta del mapa compartido (D-23, O12; T45 las
coloca). Ids y sitios son una propuesta: el sitio exacto lo decide T45. Cada
boia tiene un nombre y dos bocadillos por mundo. Con la primera boia son seis.

| Id | Sitio propuesto | Tema |
|---|---|---|
| `boia-espacio` | Entre la bocana y la primera isla | Dar espacio: por qué existe BOIA |
| `boia-descubrir` | Entre la primera isla y el encuentro de la Fiestera | Descubrir: música sin un único género |
| `boia-pertenecer` | Entre la tienda y el Puerto de Fotos | Pertenecer: el Carnet |
| `boia-allday` | Antes de la isla del escenario | Qué es un All Day |
| `boia-secretos` | Cerca de la salida del circuito, antes de la última isla | La curiosidad tiene premio |

| Clave | Texto | Nota |
|---|---|---|
| `world.arcilla.boia.espacio.name` | La boia del horno | |
| `world.arcilla.boia.espacio.1` | ¡Plop! ¿Sabes por qué existe BOIA? | |
| `world.arcilla.boia.espacio.2` | Para dar espacio: a artistas nuevos, a proyectos raros y a gente con algo que contar. Como este horno, que cuece de todo. | |
| `world.arcilla.boia.descubrir.name` | La boia del chiringuito | |
| `world.arcilla.boia.descubrir.1` | Aquí nadie te pregunta qué música te gusta. | |
| `world.arcilla.boia.descubrir.2` | En BOIA suenan house, cumbia, techno o ambient en el mismo día. Vienes por uno y te vas con cinco. | |
| `world.arcilla.boia.pertenecer.name` | La boia de las huellas | |
| `world.arcilla.boia.pertenecer.1` | ¿Ves las huellas de dedos en el barro? Todo aquí lleva la marca de alguien. | |
| `world.arcilla.boia.pertenecer.2` | No vienes simplemente a BOIA: formas parte. Tu Carnet guarda tus sellos, tus respuestas y tu barco. | |
| `world.arcilla.boia.allday.name` | La boia del escenario | |
| `world.arcilla.boia.allday.1` | Ahí delante está el escenario del All Day. | |
| `world.arcilla.boia.allday.2` | Un All Day es un día entero: paella, música, juegos y alguna sorpresa. De la comida al amanecer. | |
| `world.arcilla.boia.secretos.name` | La boia chismosa | |
| `world.arcilla.boia.secretos.1` | Psst. No todo sale en el minimapa. | |
| `world.arcilla.boia.secretos.2` | Una cueva, un ánfora, una campana… BOIA premia la curiosidad. Desvíate un poco. | |
| `world.acuarela.boia.espacio.name` | La boia del margen | |
| `world.acuarela.boia.espacio.1` | ¡Plop! La pintora deja siempre un hueco en blanco en cada página. | |
| `world.acuarela.boia.espacio.2` | BOIA hace lo mismo: deja espacio a artistas nuevos y a lo que todavía no tiene sitio. | |
| `world.acuarela.boia.descubrir.name` | La boia de la paleta | |
| `world.acuarela.boia.descubrir.1` | En esta página caben todos los colores. | |
| `world.acuarela.boia.descubrir.2` | Con la música pasa igual: en BOIA se mezclan géneros como se mezclan aguadas. Lo bueno sale en los bordes. | |
| `world.acuarela.boia.pertenecer.name` | La boia de las casas | |
| `world.acuarela.boia.pertenecer.1` | En La Vila cada casa tiene su color para que la reconozcan desde el mar. | |
| `world.acuarela.boia.pertenecer.2` | Tu Carnet BOIA es tu color: apodo, respuestas, sellos y barco. Así te reconocen los demás. | |
| `world.acuarela.boia.allday.name` | La boia de la barraca | |
| `world.acuarela.boia.allday.1` | ¿Ves la barraca? Es la del All Day. | |
| `world.acuarela.boia.allday.2` | Un día entero de música, comida y gente, montado como las barracas de Hogueras. | |
| `world.acuarela.boia.secretos.name` | La boia del borrón | |
| `world.acuarela.boia.secretos.1` | La pintora esconde cosas en los márgenes. | |
| `world.acuarela.boia.secretos.2` | Si ves algo raro, acércate: en BOIA la curiosidad tiene premio. | |
| `boia.found` | Boia encontrada · {n} de 6 | Aviso de progreso |

## 24 · Invitaciones al Carnet

Momentos de v14 §49.10 (REQ-IDE-008 y REQ-IDE-009): antes de comprar, al
cerrar una galería, a los 5 minutos o 3 logros. Nunca durante una carrera,
un diálogo o el pago.

| Clave | Texto | Nota |
|---|---|---|
| `invite.purchase.title` | ¿Guardamos esta entrada en tu Carnet? | Antes de comprar |
| `invite.purchase.body` | Con tu Carnet, el sello de este evento se queda contigo. Tardas un momento y no te pedimos email. | |
| `invite.purchase.skip` | Continuar sin registrarme | Siempre visible (§49.10) |
| `invite.gallery.title` | ¿Te has visto en alguna? | Al cerrar una galería |
| `invite.gallery.body` | Con tu Carnet guardas los recuerdos de tus fiestas y los sellos de cada evento. | |
| `invite.progress.title` | Llevas un buen rato navegando | A los 5 minutos |
| `invite.progress.body` | Hazte el Carnet y ponle nombre a tu barco: tus logros y tus monedas tendrán dueño. | |
| `invite.achievements.title` | Tres logros ya. Esto va en serio. | A los 3 logros |
| `invite.achievements.body` | Con tu Carnet, los demás verán lo que has conseguido. Y tú también. | |
| `invite.join.title` | Únete a BOIA | Acceso voluntario, siempre disponible |
| `invite.join.body` | Un apodo, cinco preguntas si te apetece y tus sellos. Así se forma parte de BOIA. | |
| `invite.create` | Crear mi Carnet | |
| `invite.later` | Ahora no | Respeta la negativa (§49.10) |
| `invite.localLimit` | Tu progreso se guarda sólo en este navegador: si borras sus datos, se pierde, y todavía no cuenta para ningún ranking compartido. | REQ-IDE-007 |
| `footer.invite.carnet` | ¿Aún sin Carnet? Hazte el tuyo: es gratis y sin email. | Pie (REQ-ENT-032) |

## 25 · Ranking

Ranking local de la versión de prueba (D-23, punto 8; REQ-IDE-053).

| Clave | Texto | Nota |
|---|---|---|
| `ranking.heading` | Ranking | |
| `ranking.localLabel` | Ranking local de este navegador | Rótulo obligatorio |
| `ranking.localNotice` | En esta versión de prueba compites contigo y con los miembros de muestra. El ranking de verdad llegará con las cuentas. | |
| `ranking.tab.allTime` | De siempre | |
| `ranking.tab.season` | Esta temporada · {world} | |
| `ranking.tab.circuit` | Circuito | Récord personal |
| `ranking.col.position` | Puesto | |
| `ranking.col.member` | Miembro | |
| `ranking.col.points` | Puntos | |
| `ranking.you` | Tú | |
| `ranking.yourPosition` | Vas {n}.º con {points} puntos. | |
| `ranking.pointsNote` | Cuentan los puntos, nunca las monedas: gastar no te baja en la tabla. | |
| `ranking.sampleTag` | muestra | Junto a cada miembro de muestra |
| `ranking.openCarnet.aria` | Ver el Carnet de {name} | |
| `ranking.empty` | Todavía no hay nadie en la tabla. Gana tu primer punto y estrénala. | |
| `ranking.circuit.empty` | Aún no tienes vuelta en {place}. | |

## 26 · Tienda de barcos

Barcos y precios de D-23 (O5), `muestra`. Los apodos de los barcos son
propuesta del equipo.

| Clave | Texto | Nota |
|---|---|---|
| `shop.heading` | Barco | Sección del menú |
| `shop.intro` | Elige barco, skin y color. Sólo cambian cómo se ve: todos navegan igual. | REQ-IDE-032 |
| `shop.balance` | Tienes {coins} monedas y {points} puntos. | |
| `shop.owned` | Tuyo | |
| `shop.equipped` | Navegando | |
| `shop.equip` | Usar este | |
| `shop.buy` | Comprar por {price} monedas | |
| `shop.buy.confirm.title` | ¿Comprar {ship}? | |
| `shop.buy.confirm.body` | Cuesta {price} monedas y te quedarán {left}. Tus puntos no cambian. | |
| `shop.buy.confirm.yes` | Comprar | |
| `shop.buy.confirm.no` | Mejor no | |
| `shop.bought` | ¡{ship} ya es tuyo! | |
| `shop.missingCoins` | Te faltan {n} monedas | |
| `shop.lockedPoints` | Se desbloquea con {threshold} puntos | |
| `shop.missingPoints` | Te faltan {n} puntos | |
| `shop.unlockedPoints` | ¡Desbloqueado! Y tus {threshold} puntos siguen ahí. | Los puntos no se gastan |
| `shop.lockedAchievement` | Se gana con el logro «{achievement}» | |
| `shop.skins.heading` | Skins | |
| `shop.skin.base` | Base | |
| `shop.skin.night` | Noche | 150 monedas |
| `shop.skin.party` | Fiesta | 150 monedas |
| `shop.color` | Color | |
| `shop.physicsNote` | Ningún barco ni skin cambia la velocidad, el drift ni los tiempos. | |
| `ship.b05.name` | Botijo · Arcilla | Libre al empezar |
| `ship.b05.desc` | Salió del horno de la Cala demasiado alegre para ser de carga. | |
| `ship.b02.name` | La Aguada · Acuarela | Libre al empezar |
| `ship.b02.desc` | Se escapó de un cuaderno una tarde de Sant Joan. | |
| `ship.b03.name` | Cubito · Low-poly | 300 monedas |
| `ship.b03.desc` | Pocas caras, mucha personalidad. | |
| `ship.b06.name` | La Silbona · Cartoon años 30 | 400 monedas |
| `ship.b06.desc` | Pita al girar y nadie sabe por qué. | |
| `ship.b04.name` | El Veterano · Semi-realista | 1500 puntos |
| `ship.b04.desc` | Ha visto más fiestas que nadie en este mar. | |
| `ship.b07.name` | Viñeta · Cel-shaded cómic | Logro «Guardacostas» |
| `ship.b07.desc` | Navega con contorno, como en los tebeos. | |
| `ship.b01.name` | Borrador · Boceto a lápiz | Logro «Ojo de marinera» |
| `ship.b01.desc` | Todavía no lo han pasado a tinta. | |
| `ship.b08.name` | Ocho Bits · Pixel art | Logro «Lobo de mar» |
| `ship.b08.desc` | Viene de una consola que ya no existe. | |

## 27 · Cambio de mundo

| Clave | Texto | Nota |
|---|---|---|
| `worlds.heading` | Mundos | |
| `worlds.intro` | Los mismos lugares con otra piel, otra historia y otro barco. Tu progreso viaja contigo. | |
| `worlds.current` | Navegando | Marca del mundo activo |
| `worlds.ship` | Barco: {ship} | |
| `worlds.switch` | Viajar a {world} | |
| `worlds.shipNote` | Si eliges un barco en «Barco», lo llevas en todos los mundos. | |
| `worlds.transition.aria` | Cambiando de mundo | D-23, punto 4 |
| `worlds.transition.skip` | Saltar | |
| `worlds.transition.done` | Bienvenido a {world}. Todo sigue en su sitio. | Aviso al salir del vórtice |
| `worlds.error` | No hemos podido cambiar de mundo. Sigues en {world}. | |
| `world.arcilla.name` | Arcilla | |
| `world.arcilla.tagline` | Barro cocido en la costa de Alicante: rescata a la Boia Fiestera de los cocodrilos y llévala a la Isla del Amanecer. | |
| `world.arcilla.arrive` | Huele a barro recién cocido. | Primer bocadillo al llegar |
| `world.acuarela.name` | Acuarela | |
| `world.acuarela.tagline` | El cuaderno de una pintora la noche de Sant Joan: lleva a la Boia Fiestera y sus farolillos de L'Albufereta a la hoguera de Tabarca. | |
| `world.acuarela.arrive` | Cuidado, que la pintura todavía está húmeda. | |

## 28 · Descuentos y «Mis códigos»

Tarjetas de descuento con «Ir a la isla» y el aviso al comprar (D-23, puntos
5 y 6; REQ-COM-036).

| Clave | Texto | Nota |
|---|---|---|
| `discount.found.title` | Descuento encontrado | |
| `discount.found.saved` | Lo tienes guardado en el Menú de a bordo, en «Mis códigos». | |
| `discount.forEvent` | Para {event} | |
| `discount.copy` | Copiar código | |
| `discount.copied` | Copiado ✓ | |
| `discount.copyManual` | Cópialo a mano: {code} | |
| `discount.goToIsland` | Ir a la isla | |
| `discount.goToStore` | Ir a la tienda ↗ | Descuento de tienda (O8) |
| `discount.sailing` | Rumbo a {place}… | Piloto automático |
| `discount.sailing.skip` | Saltar | |
| `discount.state.active` | Activo | |
| `discount.state.pending` | Todavía no vale | |
| `discount.state.used` | Usado | |
| `discount.state.expired` | Caducado | |
| `discount.validUntil` | Vale hasta el {date} | |
| `discount.expiredOn` | Caducó el {date} | |
| `discount.empty` | Aún no has encontrado ninguno. Hay códigos escondidos en el mar: náufragos, restos y tesoros. | |
| `discount.sampleNote` | Muestra: no es un código real. | P16 |
| `checkout.discount.banner.title` | Tienes un código de descuento para este evento | D-23, punto 6 |
| `checkout.discount.banner.body` | {code}: te ahorras {saving}. Ya está aplicado. | |
| `checkout.discount.line` | Descuento {code} | |

## 29 · HUD

Lo que queda en pantalla al navegar (D-23, O11; REQ-PRO-009).

| Clave | Texto | Nota |
|---|---|---|
| `hud.home` | Inicio | |
| `hud.menu` | Menú de a bordo | Botón del ancla |
| `hud.tickets` | Entradas | Sólo `/mar` (D-22) |
| `hud.balances.points` | {n} puntos | |
| `hud.balances.coins` | {n} monedas | |
| `hud.compass` | Brújula | |
| `hud.compass.next` | Brújula: señala lo siguiente sin explorar | |
| `hud.compass.target` | Brújula: señala el sitio elegido | |
| `hud.compass.done` | Brújula: todo descubierto | |
| `hud.minimap.aria` | Minimapa: toca para ampliar, mantén pulsado para moverlo | |
| `hud.minimap.left` | Quedan {n} sitios por descubrir. | |
| `hud.minimap.pick` | Toca un sitio para que la brújula lo señale. | |

## 30 · Fotos y eventos

La página de fotos por isla o evento y la selección de la home (D-23,
punto 7 y respuesta 6 de Álvaro; REQ-COM-031).

| Clave | Texto | Nota |
|---|---|---|
| `photos.heading` | Fotos | = es.ts (antes «Fotos y vídeos») |
| `photos.home.selection` | Nuestra selección | Home: sólo fotos «selección» |
| `photos.home.all` | Ver todas | Lleva a `/fotos` |
| `photos.page.title` | Fotos y eventos | |
| `photos.page.lead` | Todas las fotos de BOIA, por isla y por evento. Búscate. | |
| `photos.filter.all` | Todas | |
| `photos.filter.island` | Por isla | |
| `photos.filter.event` | Por evento | |
| `photos.placeholder` | Foto de muestra | = es.ts |
| `photos.empty` | Todavía no hay fotos de este evento. Se están revelando. | |
| `photos.backToIsland` | Volver a la isla | |

## 31 · Pie de página

| Clave | Texto | Nota |
|---|---|---|
| `footer.official` | Enlaces oficiales de BOIA | = es.ts |
| `footer.legal` | Información legal | = es.ts |
| `footer.legalNotice` | Aviso legal | Sustituye a `footer.terms` («Condiciones») |
| `footer.privacy` | Privacidad | = es.ts |
| `footer.cookies` | Preferencias de cookies | = es.ts |
| `footer.copyright` | © BOIA, Alicante | = es.ts |
| `footer.replayIntro` | Ver la introducción | = es.ts |
| `footer.tryAdmin` | Probar admin | |
| `footer.tryAdmin.hint` | Versión de prueba: sin login, los cambios se quedan en este navegador. | |

## 32 · Legales: aviso legal, privacidad y cookies

**Datos inventados** (D-23, O14): ningún titular, NIF, domicilio ni persona
de esta sección es real. Cada página lleva arriba `legal.sampleBanner`. Antes
de publicar de verdad se sustituyen por los de BOIA con revisión profesional
(P21, REQ-PRO-020). Las páginas son `/legal/aviso-legal`, `/legal/privacidad`
y `/legal/cookies`; la ruta vieja `/legal/condiciones` pasa a aviso legal.

| Clave | Texto | Nota |
|---|---|---|
| `legal.sampleBanner` | Datos de muestra: el titular y sus datos son inventados para esta versión de prueba. Antes de publicar BOIA.PLANET se sustituirán por los reales, con revisión profesional. | Obligatorio arriba de cada página |
| `legal.updated` | Última actualización: 29 de septiembre de 2026. | |
| `legal.back` | Volver al inicio | = es.ts |
| `legal.aviso.title` | Aviso legal y condiciones de uso | |
| `legal.aviso.owner` | Titular: Bollería Fina del Mediterráneo, S.L., con NIF B00000069 y domicilio en C/ Rosa Melano, 69, 03001 Alicante. Administrador: Benito Camelas. | Datos inventados |
| `legal.aviso.contact` | Atención al público: Paco Merlo, en privacidad@boia.example. | Datos inventados |
| `legal.aviso.purpose` | Esta web presenta los eventos de BOIA, enlaza a la venta de sus entradas y ofrece BOIA.PLANET, un mar para explorar en barco. Usarla es gratis. | |
| `legal.aviso.use` | Al usarla te comprometes a hacerlo de buena fe: sin suplantar a nadie, sin publicar en Carnets o botellas nada ofensivo o que no sea tuyo, y sin intentar romper el juego para llevarte premios que no has ganado. | |
| `legal.aviso.moderation` | Podemos retirar respuestas, fotos, apodos o botellas que incumplan las normas de a bordo, y dejar constancia de por qué. | |
| `legal.aviso.purchases` | Las entradas se compran en la ticketera de cada evento, con sus propias condiciones. En esta versión de prueba no se vende nada: la compra es simulada y no se cobra. | |
| `legal.aviso.ip` | La marca BOIA, el arte, los textos y las fotos de esta web son de su titular o de sus autores. Si quieres usar algo, pregúntanos antes. | |
| `legal.aviso.links` | Los enlaces a Instagram, WhatsApp, la tienda o la ticketera te llevan a servicios de otros, con sus propias condiciones. | |
| `legal.aviso.liability` | Hacemos lo posible por que todo funcione y esté al día, pero la web puede fallar o cambiar sin aviso. Esta versión es de prueba y puede borrarse en cualquier momento. | |
| `legal.aviso.law` | Se aplica la ley española. Si alguna vez hay un conflicto, lo resolverán los juzgados que correspondan según la ley. | |
| `legal.privacy.title` | Política de privacidad | |
| `legal.privacy.intro` | En esta versión de prueba no guardamos tus datos en ningún servidor: todo lo que haces se queda en tu navegador. | |
| `legal.privacy.controller` | Responsable: Bollería Fina del Mediterráneo, S.L. (NIF B00000069), C/ Rosa Melano, 69, 03001 Alicante. Delegada de protección de datos: Débora Melo, en privacidad@boia.example. | Datos inventados |
| `legal.privacy.what` | Qué se guarda: el apodo, la foto o el avatar y las respuestas de tu Carnet, tu botella, tu progreso en el juego y tus preferencias de sonido y controles. | |
| `legal.privacy.notAsked` | Qué no te pedimos: ni email, ni teléfono, ni datos de pago. | |
| `legal.privacy.where` | Dónde: en el almacenamiento de tu navegador, en este dispositivo. No sale de ahí y no lo vemos. | |
| `legal.privacy.why` | Para qué: para que tu Carnet, tu barco y tu progreso sigan ahí cuando vuelvas. | |
| `legal.privacy.basis` | Base legal: tu consentimiento al crear el Carnet o la botella, y lo necesario para darte el servicio que pides. | |
| `legal.privacy.sharing` | No se comparte con nadie. Si pulsas un enlace a Instagram, WhatsApp, la tienda o la ticketera, esos servicios tienen su propia política. | |
| `legal.privacy.analytics` | Medición de visitas: apagada en esta versión. | |
| `legal.privacy.retention` | Cuánto tiempo: hasta que borres los datos de este sitio en tu navegador o retires tu Carnet o tu botella. | |
| `legal.privacy.rights` | Tus derechos: acceso, rectificación, supresión, oposición, limitación y portabilidad. Como todo está en tu navegador, puedes ejercerlos directamente, borrando o editando; si necesitas algo más, escribe a privacidad@boia.example. También puedes reclamar ante la Agencia Española de Protección de Datos. | |
| `legal.privacy.future` | Cuando BOIA.PLANET abra con cuentas, esta política cambiará y te lo contaremos antes de que pase. | |
| `legal.cookies.title` | Cookies | |
| `legal.cookies.body` | Esta web no usa cookies de analítica ni de publicidad. | = es.ts |
| `legal.cookies.storage` | Sí usa el almacenamiento local del navegador para guardar tu progreso, tu Carnet y tus preferencias (sonido y controles). Es técnico: sin él no funciona lo que pides. | |
| `legal.cookies.thirdParty` | Si pulsas un enlace a Instagram, WhatsApp, la tienda o la ticketera, esos sitios pueden usar sus propias cookies. | |
| `legal.cookies.manage` | Para borrarlo todo, entra en los ajustes de tu navegador y borra los datos de este sitio. | |
| `legal.cookies.prefs` | Preferencias de cookies: no hay nada que activar ni desactivar, porque no usamos cookies opcionales. | |
