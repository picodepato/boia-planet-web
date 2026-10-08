# Guía de prueba — plan 019: los cambios de la reunión con Álvaro

> Para Hernán. El plan 019 ([plan](../../plans/019-reunion-cambios.md), T213–T225) aplica lo
> acordado con Álvaro el 2026-10-08 ([notas de la reunión](2026-10-08-reunion-cambios.md)):
> el Carnet BOIA obligatorio para comprar, aspecto de videojuego con esquinas rectas, la
> landing nueva al estilo de noartmusic.com, fichas de evento más completas editables desde
> el Admin, la Galería en collage con clips, los artistas con su música, el lector de la
> puerta, los cambios del mundo (carga, popups, nombres, boia, Puig Campana, Las Calitas) y
> el Admin con límite de 3, papelera de 30 días, analítica con interruptor y copias diarias.
> Quiere contestar: **¿se publica así y qué falta para enseñárselo a Álvaro?** Las respuestas
> van al final («Notas»). Todo el contenido nuevo es `muestra`.

## Qué cambia

### Aspecto (T213, T225)

- **Tres fuentes de videojuego** (combinación 4, la que elegiste): **Upheaval** en los títulos,
  **Press Start 2P** en los botones y el menú de arriba, **8-bit Operator+** en el texto. Las
  licencias están junto a los archivos en `apps/web/public/fonts/`. Upheaval prohíbe modificar
  el archivo, así que va entero (7,7 kB).
- **Sin esquinas redondeadas** en botones, popups, tarjetas, paneles ni campos. Sólo siguen
  redondas las formas que lo son de verdad (planeta, boia, avatares, puntos, joystick).
- **Botones de recreativa**: borde negro de 2 px y sombra dura que se hunde al pulsar.
- El HUD del Cañón y su pantalla final se reajustaron a las fuentes nuevas (T225), sin tocar
  el juego.

### Landing y tienda (T214)

- **Hero**: sólo «Zarpar»; «Consigue descuentos» en **amarillo**; el botón «Entradas» del hero
  se fue (sigue en la cabecera al bajar y en la lista de eventos).
- **Debajo del globo**, una hoja blanca que sube del mar con las secciones al estilo de
  noartmusic.com: «■ etiqueta» a la izquierda y su página a la derecha, pie enmarcado.
- **Eventos** con la **fecha en un cuadrado** y el nombre al lado (móvil) o debajo
  (escritorio). Si el lugar no está anunciado, la tarjeta y el checkout dicen «La ubicación
  todavía no está anunciada» (T224), como la ficha y las islas.
- **Tienda**: los 3 productos con nombre y precio (`muestra`: camisetas 20 €, tote 12 €,
  pegatinas 5 €). «Comprar» explica cada caso: **sólo en la fiesta** o **reserva por DM** en
  [Instagram](https://www.instagram.com/boia.planet/) y te lo llevamos a la próxima fiesta.
- **Hueco para el vídeo/GIF de Roke**: `HERO_MEDIA_SRC` en `apps/web/lib/landing/hero-media.ts`
  (hoy `null`, se ven las fotos fijas).
- Peso de la landing: **195,9 kB** gzip de 200 (al cerrar el plan 017, 195,3).

### Eventos y compra (T215, T223)

- **Sin Carnet no se compra**: «Comprar» lleva a crear el Carnet y vuelve a la compra. El
  **descuento del Carnet se fue** (el -10 % y los -2 € en puerta). Los descuentos del mundo
  siguen: «Consigue descuentos», el botón «Consigue un descuento» al comprar, los códigos y la
  misión de la boia.
- **Ficha del evento**: dice claro lo que falta («Aún no están anunciados», «El cartel todavía
  no está anunciado», «La ubicación todavía no está anunciada»); con cartel, el fondo es el
  cartel ampliado y difuminado; las fotos del evento en collage; «Consigue un descuento»
  (amarillo) entra en el mundo como «Zarpar»; fila «Ticketera».
- **HALLOWEEN IN THE CLUB**: sin venta online, «Solo en puerta · 5 € con carnet» y «Hazte el
  tuyo». ALL DAY BOIA vuelve a venderse online (ticketera por elegir).
- **Admin › Eventos**: precio, lugar anunciado, ticketera, «Solo en puerta» y precio en puerta.
- **Admin › Descuentos**: «Código común de la ticketera»; fijado, todos los descuentos de
  entradas enseñan ese código; vacío, cada uno el suyo. La tienda conserva los suyos.

### Galería (T216)

- «Fotos» pasa a **«Galería»** (`/galeria`; `/fotos` redirige). Collage sin textos de fotos y
  clips mudos algo superpuestos; al abrir, la pieza crece sobre fondo oscuro; al cerrar vuelve
  a su sitio y aparta un poco a las vecinas. Con «reducir movimiento», sin animaciones ni vídeo.
- 3 clips de muestra hechos con arte del proyecto. El Admin sube clips MP4 (≤ 20 MB, ≤ 30 s)
  en «Fotos y clips de una isla».

### Artistas (T217)

- Cada artista con su imagen al lado; el nombre abre su Carnet; botones «Ver carnet» y su
  música (Spotify, SoundCloud, Bandcamp o Instagram, según el dominio del enlace).
- El artista pone su enlace al crear su Carnet de artista (`/artista/<código>`).

### Carnet y puerta (T218)

- **Con cuentas**, crear el Carnet empieza por el email → código de 6 cifras → Carnet. En modo
  local no se pide email.
- **QR de alta** (`/carnet?crear=1`): abre «Crear carnet»; el Admin lo enseña e imprime en
  «Puerta y sellos».
- **Lector de la puerta** `/admin/puerta`: cámara del móvil (o foto, o enlace pegado), lee el
  QR del Carnet, apunta la asistencia y pone el sello de la fiesta. Sigue valiendo que el socio
  escanee el QR de la fiesta. **Sellar a mano** desde el Admin, con motivo.

### Mundo (T219, T220, T221, T222)

- Pantalla de carga de `/mar` y velo de «Zarpar» en **naranja claro**.
- **Popups** con bordes rectos, sin la franja naranja; título y texto en azul.
- **Nombres**: ALL DAY BOIA (antes Sonido), HALLOWEEN IN THE CLUB, Botiga Ibiza («Sección de
  merchandising oficial»), Puig Campana (antes Els Banyets); BOIA Nochevieja sigue. Las islas de
  fiesta enseñan sólo nombre, fecha y lugar. La misión de la boia (FIESTERA20) vale para ALL
  DAY BOIA y Nochevieja.
- **La boia** con la cara y el trazo negro del logo; la Fiestera, la misma mascota en naranja.
- **Puig Campana** modelado en Blender (pirámide con la muesca de la Portà, Finestrat, el cañón
  y el muelle) en lugar de Els Banyets. El Cañón no cambia.
- **Las Calitas**, isla nueva al noroeste: comentarios, respuestas (un nivel), votos ▲/▼ y
  filtro de insultos. En local, los de muestra más los tuyos (sólo los ves tú); con cuentas,
  compartidos y con Carnet. El Admin los oculta en Moderación.

### Admin (T223)

- **Como mucho 3 personas con acceso completo** (admin u owner; el Carnet 000 es una). Lo
  impone la base (con la migración) y lo explica «Usuarios de administración».
- **Papelera de 30 días** de lo cambiado («Deshacer») y lo borrado («Recuperar»).
- **Analítica de visitas** con interruptor en Integraciones, **apagada por defecto**.
- **Copias diarias**: `.github/workflows/supabase-backup.yml` hace `pg_dump` cifrado cada día y
  lo guarda 30 días como artefacto. Guía: [copias](2026-10-08-backups.md).

## Cómo probarlo rápido

En `pnpm dev`, o en la versión publicada (modo local).

| Dónde | Qué mirar |
|---|---|
| `/` en el móvil | Fuentes nuevas, esquinas rectas; sólo «Zarpar» y «Consigue descuentos» en amarillo; la hoja blanca al bajar; fechas en cuadrado |
| `/` → Tienda → «Comprar» | Camisetas: reserva por DM; pegatinas: sólo en la fiesta |
| `/eventos/<halloween>` | «Solo en puerta · 5 € con carnet», sin checkout, «Hazte el tuyo» |
| Un evento a la venta → Comprar, sin Carnet | Pide el Carnet; al crearlo, sigue la compra sin descuento de Carnet |
| `/admin` → Eventos | Quitar «lugar anunciado» a un evento → la ficha, la tarjeta, el checkout y su isla dicen que no está anunciada |
| `/admin` → Descuentos | Poner un código común → los descuentos de entradas lo enseñan; vaciarlo → cada uno el suyo |
| `/galeria` | Abrir y cerrar piezas; los clips se mueven, mudos |
| `/artistas` | Imagen, «Ver carnet» y el botón de música con su icono |
| `/admin` → Puerta y sellos | QR de alta; abrir el lector en el móvil y leer el QR de un Carnet → el sello sale en ese Carnet |
| `/mar` | Carga naranja claro; popups sin franja; la boia nueva; Puig Campana; Las Calitas: comentar, responder, votar, un insulto se rechaza |
| `/admin` → Moderación | Ocultar un comentario de Las Calitas → desaparece |
| `/admin` → Papelera | Editar y borrar un evento, deshacer y recuperar |
| `/admin` → Integraciones | Encender y apagar la analítica |

Con cuentas (`boia-planet-dev`, después de las migraciones de abajo): crear un Carnet (email
primero), el lector de la puerta con un Carnet real, Las Calitas compartida entre dos
navegadores, el código común desde el servidor y el límite de 3 admins.

## Migraciones

Ninguna está aplicada. En `boia-planet-dev`, **en este orden** (el de su nombre):

| Orden | Migración | Tarea | Qué hace | Pruebas (`test:supabase`) |
|---|---|---|---|---|
| 1 | `20261007100200_moderation.sql` | plan 017 T191 | Moderación de Carnets, botellas y rankings | `moderation.supabase.ts` |
| 2 | `20261007100400_admin_access_export.sql` | plan 017 T193 | Carnet 000, códigos de respaldo, `export_my_data` | `admin-access.supabase.ts` |
| 3 | `20261008100100_event_fields_common_code.sql` | T215 | Campos nuevos del evento, `ticketing_settings`, código común | `event-fields.supabase.ts` |
| 4 | `20261008100200_artist_music.sql` | T217 | Música del Carnet de artista, `set_artist_music` | `artist-music.supabase.ts` |
| 5 | `20261008100300_door_stamps.sql` | T218 | `event_attendance`, `staff_stamp` (puerta y a mano) | `door-stamps.supabase.ts` |
| 6 | `20261008100400_gallery_clips.sql` | T216 | Clips en `event_photos`, bucket `event-clips` | `gallery-clips.supabase.ts` |
| 7 | `20261008100500_calitas.sql` | T222 | Las Calitas: tablas, RLS, filtro, RPC | `calitas.supabase.ts` |
| 8 | `20261008100600_admin_limits_analytics.sql` | T223 | Tope de 3 admin/owner, `site_settings.analytics_enabled` | `admin-limits.supabase.ts` |

Desde la raíz del repo:

1. **Antes de la 8**: que en `staff_roles` haya **como mucho 2** personas admin u owner reales
   (el disparador no toca lo que ya hay, pero `admin-limits.supabase.ts` da de alta 1 admin
   propio por archivo y fallaría con 3).
2. `pnpm db:migrate:dev` → aplica las ocho, en orden.
3. `pnpm db:types:dev` → regenera los tipos; `database.types.ts` se editó a mano en T215, T216,
   T217, T218 y T222, así que debería salir sin diferencias o con pocas.
4. `pnpm test:supabase` (suma los ocho archivos de la tabla).
5. Los pasos 1 y 3 de la [guía del plan 017](2026-10-07-plan-017-guia-prueba.md) que falten
   (renombrar los cosméticos a «Botijo…» y la cuenta del Admin con el Carnet 000).
6. La semilla `supabase/seeds/20261003100100_economy.sql` sigue con «BOIA Halloween» y
   «SONIDO»: los eventos ya sembrados se renombran a mano en el editor SQL si se quieren ver
   con los nombres nuevos.
7. E2E con cuentas que el plan no corrió: `E2E_SUPABASE=1 E2E_PORT=<libre> pnpm e2e
   cuenta.spec.ts admin-real.spec.ts landing-logout.spec.ts ranking.spec.ts --workers=1`, y a
   mano el lector de la puerta y Las Calitas con dos cuentas.

**Copias diarias**: cargar en GitHub los secretos `SUPABASE_DB_URL` (Session pooler, puerto
5432) y `BACKUP_PASSPHRASE`, y lanzar el flujo una vez a mano ([guía](2026-10-08-backups.md)).
Las fotos y clips de Storage no entran en la copia. `.github/workflows/supabase-keepalive.yml`
sigue en disco sin commitear: decide si se sube.

En producción, lo mismo cuando se publique con cuentas.

## Material pendiente

- **Roke**: el vídeo o GIF del inicio → `apps/web/public/…` y su ruta en `HERO_MEDIA_SRC`
  (`.mp4`/`.webm` se pinta como vídeo mudo en bucle; `.gif`/`.webp`, como imagen).
- **Álvaro**: fotos reales de los 3 productos (y precios y cuál se reserva, `products.json`);
  el correo del dominio; la ticketera de los próximos eventos (hay un campo en el Admin); el
  visto bueno a los textos `muestra` (fichas, tienda, Las Calitas, puerta), al arte nuevo
  (boia, Puig Campana) y a los clips de muestra.

## Qué contestar

1. **Halloween**: ¿confirmamos que no se vende nada online y la web sólo informa de los 5 € en
   puerta con carnet? (duda 2 de la reunión; hoy es así).
2. **Ticketera de los próximos eventos**: ¿cuál? El Admin ya la escribe en la ficha.
3. **Decisión 4 a `DECISIONES.md`**: pasar «Entradas» fuera del hero para retirar REQ-ENT-002 y
   REQ-ENT-027 (hoy PARCIAL). Sólo tú editas ese archivo.
4. **Vídeos de la Galería**: ¿de dónde salen y quién los aprueba? (duda 4 de la reunión).
5. **Las Calitas** no tiene REQ en la spec ni modelo de Blender: ¿se le hace REQ y modelo?
6. **Moderación con cuentas**: una respuesta suelta del Carnet o el enlace de música de un
   artista sólo se quitan ocultando el Carnet entero, y el Admin con cuentas no edita la música
   de un Carnet de artista. ¿Basta?
7. **Papelera con cuentas**: los cambios sobre datos reales (socios, fiestas) no entran en la
   papelera y borrar un socio es definitivo. ¿Vale así?
8. La landing está en 195,9 de 200 kB: ¿se mira el peso antes de añadir más?
9. **Restos visuales**: el arte 2D del lugar `canon` aún enseña el fortín de Els Banyets; las
   boias dentro de las islas GLB y los sprites 2D no llevan el trazo del logo; los rótulos de
   isla del mar siguen naranjas. ¿Se hacen?
10. La cabecera sigue oscura sobre la hoja blanca de la landing: ¿se queda?

## Lo que hace Hernán

- Las ocho migraciones, los tipos y `test:supabase` en `boia-planet-dev` (arriba), y las e2e con
  cuentas.
- Los secretos de las copias y la primera ejecución del flujo.
- La decisión 4 en `DECISIONES.md`.
- Contestar las preguntas y pedir el material de Roke y Álvaro.

## Notas
