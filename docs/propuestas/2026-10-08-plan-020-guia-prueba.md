# Guía de prueba — plan 020: la revisión de Hernán y lo que quedó de la reunión

> Para Hernán. El plan 020 ([plan](../../plans/020-revision-hernan.md), T226–T234) aplica tu
> revisión de 13 puntos tras el plan 019 ([revisión](2026-10-08-revision-hernan.md)) y cierra
> lo que el plan 019 dejó abierto de la [reunión con Álvaro](2026-10-08-reunion-cambios.md):
> la Moderación y la papelera de 30 días con datos reales, las copias con Storage, el arte
> pendiente (Puig Campana en 2D, el trazo de la boia en todas partes), Las Calitas en Blender
> y la Galería en collage de verdad. Quiere contestar: **¿está cada punto de la revisión como
> lo pediste y se pueden aplicar las migraciones en `boia-planet-dev`?** Las respuestas van
> al final («Notas»). Todo el contenido nuevo sigue siendo `muestra`.

Las e2e **no se corrieron** en el plan (las corres tú; abajo, el comando). Cada tarea pasó el
comando de pruebas del plan, y el cierre (T233) lo volvió a pasar con todo junto.

## Qué cambia, punto por punto de la revisión

### Portada (punto 1, T227)

- **Orden de la entrada en cada carga de `/`**: primero el globo, luego las letras «BOIA» en
  3D y al final, con un fundido, «Zarpar», «Consigue descuentos» y «Desliza». También en
  móvil y en la versión estática (bajo consumo, sin WebGL o escena lenta: la imagen fija
  0,7 s, «BOIA» plano y los botones).
- Si las letras 3D tardan más de 1,2 s, sale el «BOIA» plano y se queda (no se cambia
  después). Mientras la escena carga ya no hay «Zarpar» en pantalla, sólo «Cargando».
- Se arregló un salto: las letras que llegaban tarde aparecían ya subidas.
- Con un enlace directo (`?intro=0`, `/#…`) o «reducir movimiento», todo a la vez, como antes.
- El 500 de `/api/art/landing/3d/manifest.json` en `pnpm dev` no es un fallo de la web: pasa
  al correr `pnpm build` con `next dev` abierto en la misma carpeta (pisa `apps/web/.next`).
  Tras un build, reinicia `next dev`.

### Mundo (puntos 2–9, T226)

| Punto | Qué se hizo |
|---|---|
| 2 y 6. Fuentes grandes, botones rotos | Rótulos y botones del mundo a 10 px (11 px en el mapa y en escritorio); un nombre largo pasa a **dos líneas, entero** (decisión 1: sin nombres cortos). Ningún rótulo se sale por los lados y su punta sigue señalando la isla. «Navegar» e «Ir en nave» caben en una línea a 390 px. |
| 3. Número de logros | El numerito de logros por reclamar, a 15 px con letra de 7 px. |
| 4. «Turbo» | Centrado. |
| 5. «!» | Naranja BOIA (decisión 2); abierto, crema con la «!» naranja. |
| 7. Los Rápidos | El cronómetro y las boias, más pequeños (1 → 0,8 rem). Las tarjetas de salida y meta van a la derecha de «Menú» y «!», nunca debajo (lo del plan 018). |
| 8. Interruptores | Pastilla con bola redonda en las opciones del Cañón (lecturas, sonido del juego) y del Castillo (capas, guía). Única excepción a «sin esquinas» (decisión 3). |
| 9. «Controles» | Cabe centrado en su casilla; el nombre del barco tampoco se recorta. |

### Artistas (puntos 10–11, T227)

- La rotación de la landing enseña la **imagen del Carnet** de cada artista (su foto o el
  avatar que eligió; en color) y suma los artistas que se dieron de alta con Carnet.
- «Pausar rotación» → **«Ver todos los artistas»**, que lleva a `/artistas`. La rotación se
  sigue parando con el ratón encima, con el foco o con la pestaña oculta.

### Tienda (puntos 12–13, T227)

- Las fotos de cada producto se pasan **deslizando** (dedo, arrastre con ratón, flechas ‹ ›,
  teclado y cuadraditos); la rotación sola se para en cuanto alguien toca.
- Los productos **sólo en la fiesta** también señalan a
  [Instagram](https://www.instagram.com/boia.planet/) para reservar.

### Galería en collage (decisión 8, T234)

- Piezas de tamaños claramente distintos (grande, mediana, pequeña) que se **solapan**.
- **Arrastrar** una pieza la aparta y deja ver la de debajo (ratón; con el dedo, de lado: en
  vertical la página se desplaza); la movida se queda encima. Un toque sin arrastre la
  **abre en grande**.
- El mismo collage en `/galeria`, en el bloque de fotos de la landing y en la ficha del Puerto
  de Fotos del mundo (6 fotos). 11 fotos de muestra hechas con arte del proyecto.
- «Ver todas» de la home va directo a `/galeria`.

### Admin y restos (T228)

- El aviso del Admin explica modo local (sin cuentas, cambios sólo en este navegador) frente
  a cuentas; ya no dice «demo sin login».
- Menú del Admin a 1440 px sin scroll horizontal; los nombres largos, en dos líneas.
- **Textos de la Filosofía** editables en el bloque de Filosofía de la página principal
  (borrador → publicar).
- La tienda de barcos no ofrece el barco de Acuarela mientras ese mundo esté oculto.
- La semilla de la economía ya usa «HALLOWEEN IN THE CLUB» y «ALL DAY BOIA».

### Moderación con cuentas (T229)

- En cada Carnet, **«Respuestas y música»**: retirar o devolver una sola respuesta y, si es de
  artista, cambiar o quitar su enlace a la música, con motivo, **sin ocultar el Carnet**.
- Todo va a una **papelera de moderación** de 30 días con «Deshacer» (no pisa lo que el socio
  cambió después). Igual en la demo local y con cuentas (migración `20261008200100`).

### Papelera de 30 días con datos reales y copias con Storage (decisión 6, T230)

- Con cuentas, **borrar un socio** lo manda a la papelera: su Carnet desaparece de todas
  partes (perfil, rankings, botellas, artistas, puerta, Las Calitas, listados) y la cuenta
  queda bloqueada. **«Devolver»** lo deja como estaba (falla si otro cogió su apodo o número).
- **Borrar una fiesta** (motivo + escribir su título) la esconde de la web, del equipo, del QR
  y de la puerta; «Devolver» la trae.
- A los 30 días la **purga** lo borra de verdad (una fiesta con compras, sellos o puntos se
  queda oculta para siempre). Sin pg_cron (plan gratuito): la lanza el flujo de copias cada
  día, cada borrado o devolución y el botón «Purgar lo caducado» del Admin.
- **Copias**: `.github/workflows/supabase-backup.yml` mete ahora también los archivos de
  Storage (fotos y clips) en la copia cifrada. No hace falta ningún secreto nuevo.
  Guía: [copias](2026-10-08-backups.md).
- En modo local, la papelera de siempre (sin cambios). «Borrar fiesta» y «Socios y fiestas
  borrados» sólo están en el Admin con cuentas («Fiestas y QR», «Papelera»).

### Arte pendiente (T231) y Las Calitas (decisión 7, T232)

- **Trazo negro del logo** en todas las boias de Arcilla: las de las islas 3D (ALL DAY BOIA,
  Faro, Halloween, Nochevieja, Puig Campana), los sprites 2D y la boia de la guía (ahora la
  mascota del logo, no el faro con cara).
- El lugar del Cañón en el mapa 2D ya es el **Puig Campana** (con Finestrat y el cañón), no el
  fortín de Els Banyets.
- **Las Calitas** con modelo de Blender (peñón ocre en media luna, playa, el tablón de
  comentarios con notas, el bocadillo que brilla de noche, sombrillas, muelle y dos boias),
  su arte 2D en el mapa de Arcilla y su requisito, REQ-IDE-054. Acuarela sigue con un marcador.

## Qué probar a mano

En `pnpm dev` (o `pnpm build && pnpm start`), modo local. Móvil = 390×844.

| Punto | Dónde | Qué mirar |
|---|---|---|
| 1 | `/` en móvil, escritorio y con «bajo consumo» o sin WebGL | Globo → «BOIA» 3D → fundido de «Zarpar», «Consigue descuentos» y «Desliza». Nada aparece antes ni salta. Recarga varias veces |
| 2, 6 | `/mar` en móvil, mapa abierto | «Castillo de Santa Bárbara», «HALLOWEEN IN THE CLUB», «Puerto de Alicante»: dos líneas, enteros, dentro de la pantalla; fichas y sus botones sin recortes |
| 3 | `/mar`, con un logro por reclamar | El numerito pequeño |
| 4 | `/mar`, botón Turbo | «TURBO» centrado |
| 5 | `/mar`, la «!» bajo el Menú | Naranja BOIA; abierta, crema con «!» naranja |
| 7 | Los Rápidos en móvil | Cronómetro y boias de tamaño moderado; las tarjetas de salida y meta no tapan Menú ni «!» |
| 8 | Pausa del Cañón y del Castillo | Interruptores en pastilla con bola redonda |
| 9 | `/mar` → Menú | «Controles» centrado dentro de su casilla |
| 10, 11 | `/` → Artistas | Cada artista con la imagen de su Carnet; «Ver todos los artistas» abre `/artistas` |
| 12 | `/` → Tienda en móvil | Pasar las fotos con el dedo; con ratón, arrastrando y con las flechas |
| 13 | Tienda → «Comprar» de un producto sólo en la fiesta | Señala a Instagram para reservar |
| Galería | `/galeria`, landing (bloque de fotos) y Puerto de Fotos en `/mar` | Tamaños distintos y solapados; arrastrar aparta una pieza y deja ver la de debajo; un toque la abre en grande |
| Admin | `/admin` a 1440 px; página principal → Filosofía | Menú sin scroll lateral; editar la Filosofía, publicar y verla en la landing (Contacto) |
| Moderación | `/admin` → Moderación → un Carnet → «Respuestas y música» | Retirar una respuesta y cambiar el enlace de un artista; «Deshacer» en la papelera |
| Papelera | `/admin` → Eventos: editar y borrar un evento; luego Papelera | «Deshacer» y «Recuperar» como en el plan 019 (lo nuevo de T230 es con cuentas, abajo) |
| Arte | `/mar` | Las boias con el trazo negro; Puig Campana en el mapa 2D; Las Calitas con su modelo (de día y de noche) |

**Con cuentas** (`boia-planet-dev`, después de las migraciones): la Moderación de respuestas y
música de un Carnet real; borrar un socio de prueba (no entra, no sale en rankings ni en
artistas), devolverlo desde Papelera → «Socios y fiestas borrados»; en «Fiestas y QR»,
«Borrar fiesta» (desaparece de la web) y devolverla; «Purgar lo caducado».

## E2E

Las corres tú (política del plan). Primera vez en una carpeta:
`pnpm --filter @boia/web exec playwright install chromium`. Puertos 3215 y 3216 ocupados.

**Sin Supabase**, las que tocaron T226–T232 y T234:

```sh
E2E_PORT=<libre> pnpm e2e \
  mar-circuito.spec.ts mar-rotulos.spec.ts mar-puerto.spec.ts mar-hud.spec.ts \
  mar-ayuda.spec.ts logros.spec.ts mar-canon.spec.ts mar-castillo.spec.ts mar-3d.spec.ts \
  intro.spec.ts landing.spec.ts landing-scroll.spec.ts artistas.spec.ts merchandise.spec.ts \
  eventos.spec.ts accesos.spec.ts \
  admin.spec.ts admin-endurecido.spec.ts admin-enlaces.spec.ts cuenta-progreso.spec.ts \
  admin-moderacion.spec.ts comunidad.spec.ts admin-papelera.spec.ts \
  mar-isla-modelo.spec.ts mar-faro-tabarca.spec.ts mar-isla-nochevieja.spec.ts \
  mar-isla-sonido.spec.ts mar-lugares-blender.spec.ts despliegue.spec.ts mar-calitas.spec.ts \
  galeria.spec.ts mar-a-bordo.spec.ts admin-fotos.spec.ts \
  --workers=1
```

| Tarea | Specs | Qué cambió en ellas |
|---|---|---|
| T226 | `mar-circuito`, `mar-rotulos`, `mar-puerto`, `mar-hud`, `mar-ayuda`, `logros`, `mar-canon`, `mar-castillo`, `mar-3d` | `mar-circuito`: caso nuevo (las tarjetas no tapan Menú ni «!»). Su caso de escritorio de Los Rápidos es inestable conocido |
| T227 | `intro`, `landing`, `landing-scroll`, `artistas`, `merchandise`, `eventos`, `accesos` | `intro` (orden), `artistas` (rotación), `merchandise` (deslizar, Instagram), `landing-scroll` |
| T228 | `admin`, `admin-endurecido`, `admin-enlaces`, `cuenta-progreso` | Sin cambios en las specs; el aviso, la página principal y la tienda de barcos |
| T229 | `admin-moderacion`, `comunidad`, `admin-endurecido`, `admin-papelera` | Sin cambios en las specs |
| T230 | `admin-papelera`, `admin-endurecido` | Sin cambios; la papelera local sigue igual |
| T231 | `mar-isla-modelo`, `mar-canon`, `mar-faro-tabarca`, `mar-isla-nochevieja`, `mar-isla-sonido`, `mar-lugares-blender`, `despliegue` | Sin cambios; GLB y arte nuevos |
| T232 | `mar-calitas`, `mar-isla-modelo`, `mar-lugares-blender`, `despliegue` | Sin cambios; modelo y arte de Las Calitas |
| T234 | `galeria`, `eventos`, `mar-a-bordo`, `admin-fotos` | `galeria`: caso nuevo de arrastre (ratón y dedo); `eventos`: la home cuenta `#fotos [data-pieza]` |

**Con Supabase**, después de las migraciones:
`E2E_SUPABASE=1 E2E_PORT=<libre> pnpm e2e admin-real.spec.ts --workers=1` (T230: borrar el
duplicado lo deja bloqueado en la papelera; paso nuevo «Papelera: devolver el socio y una
fiesta borrados»). Y, si no se corrieron con el plan 019: `cuenta.spec.ts`,
`landing-logout.spec.ts`, `ranking.spec.ts`.

## Migraciones

Ninguna está aplicada. En `boia-planet-dev`, **en este orden** (el de su nombre): las ocho de
los planes 017–019 y detrás las dos del plan 020. La 10 usa `private.trash_days()` de la 9.

| Orden | Migración | Tarea | Qué hace | Pruebas (`test:supabase`) |
|---|---|---|---|---|
| 1 | `20261007100200_moderation.sql` | plan 017 T191 | Moderación de Carnets, botellas y rankings | `moderation.supabase.ts` |
| 2 | `20261007100400_admin_access_export.sql` | plan 017 T193 | Carnet 000, códigos de respaldo, `export_my_data` | `admin-access.supabase.ts` |
| 3 | `20261008100100_event_fields_common_code.sql` | plan 019 T215 | Campos nuevos del evento, `ticketing_settings`, código común | `event-fields.supabase.ts` |
| 4 | `20261008100200_artist_music.sql` | plan 019 T217 | Música del Carnet de artista, `set_artist_music` | `artist-music.supabase.ts` |
| 5 | `20261008100300_door_stamps.sql` | plan 019 T218 | `event_attendance`, `staff_stamp` (puerta y a mano) | `door-stamps.supabase.ts` |
| 6 | `20261008100400_gallery_clips.sql` | plan 019 T216 | Clips en `event_photos`, bucket `event-clips` | `gallery-clips.supabase.ts` |
| 7 | `20261008100500_calitas.sql` | plan 019 T222 | Las Calitas: tablas, RLS, filtro, RPC | `calitas.supabase.ts` |
| 8 | `20261008100600_admin_limits_analytics.sql` | plan 019 T223 | Tope de 3 admin/owner, `site_settings.analytics_enabled` | `admin-limits.supabase.ts` |
| 9 | `20261008200100_carnet_answer_music_moderation.sql` | plan 020 T229 | Retirar una respuesta, cambiar la música de un artista, papelera de moderación (30 días) con «Deshacer» | `carnet-moderation.supabase.ts` |
| 10 | `20261008200200_member_party_trash.sql` | plan 020 T230 | Socios y fiestas a la papelera (`member_trash`, `deleted_at`), devolver, `purge_expired_trash` | `trash.supabase.ts`, `accounts.supabase.ts` (ajustada) |

Desde la raíz del repo:

1. **Antes de la 8**: que en `staff_roles` haya **como mucho 2** personas admin u owner reales
   (`admin-limits.supabase.ts` da de alta 1 admin propio por archivo y fallaría con 3).
2. `pnpm db:migrate:dev` → aplica las diez, en orden.
3. `pnpm db:types:dev` → regenera los tipos. `database.types.ts` se editó a mano en los planes
   019 y 020 (T229, T230), así que debería salir sin diferencias o con pocas.
4. `pnpm test:supabase` (suma los diez archivos de la tabla).
5. Los pasos 1 y 3 de la [guía del plan 017](2026-10-07-plan-017-guia-prueba.md) que falten
   (cosméticos «Botijo…» y la cuenta del Admin con el Carnet 000).
6. La semilla `supabase/seeds/20261003100100_economy.sql` ya tiene los nombres nuevos (T228);
   los eventos ya sembrados en `boia-planet-dev` se renombran a mano o se vuelve a sembrar.
7. Las e2e con Supabase de arriba, y a mano la Moderación y la papelera con dos cuentas.

**Copias**: con `SUPABASE_DB_URL` y `BACKUP_PASSPHRASE` ya basta (la variable `SUPABASE_URL`
sólo si el paso dice que no saca la URL). Lanza el flujo una vez a mano y mira que el artefacto
lleve `storage/` y que el paso «Purgar la papelera de 30 días» avise si falta la migración 10.
Vigila el tamaño de los artefactos (clips de hasta 20 MB) frente a la cuota gratuita de
GitHub. `.github/workflows/supabase-keepalive.yml` sigue en disco sin commitear: decide si se
sube.

En producción, lo mismo cuando se publique con cuentas.

## Material pendiente

- **Roke**: el vídeo o GIF del inicio (`HERO_MEDIA_SRC` en `apps/web/lib/landing/hero-media.ts`).
- **Álvaro**: fotos reales de los 3 productos y de la Galería; el visto bueno al arte nuevo
  (Las Calitas, Puig Campana en 2D, el trazo de las boias) y a los textos `muestra`.

## Qué contestar

1. **Rótulo de Las Calitas**: el cierre tenía que ponerlo naranja «como los demás», pero en el
   mar sólo son naranjas los rótulos de las **islas con fiesta** (ALL DAY BOIA, HALLOWEEN IN
   THE CLUB, Nochevieja); los de Castillo, Puerto, Benidorm, Los Rápidos y Las Calitas son
   crema. Se dejó crema, igual que las otras islas sin fiesta. ¿Lo quieres naranja sólo en
   Las Calitas, naranja en todas las islas, o así? (Es un cambio de una línea en
   `apps/web/app/mar/mar-client.tsx`, `pinsOf`.)
2. **Tiempos de la entrada**: 1,2 s de espera a las letras 3D, 0,7 s de imagen fija en la
   versión estática y 0,6 s de fundido. ¿Bien así?
3. **Peso de la landing**: el collage en el bloque de fotos la deja en 199,0 de 200 kB gzip
   (antes del plan, 195,9). Queda ~1 kB. ¿Se busca margen antes de añadir nada más a la landing?
4. **Interruptores en Ajustes**: la música y los efectos de Ajustes siguen como casillas
   («Activada»), no pastillas. ¿Se pasan también a interruptor (decisión 3)?
5. **«Entradas» durante un viaje**: la línea pequeña («Rumbo a Ca…») sigue recortada porque la
   barra de abajo tiene alto fijo. ¿Se rediseña?
6. **Papelera con cuentas**: borrar un socio lo bloquea 30 días y luego lo borra; una fiesta con
   compras, sellos o puntos nunca se borra del todo (se queda oculta). ¿Vale así?

## Lo que hace Hernán

- Las diez migraciones, los tipos y `test:supabase` en `boia-planet-dev` (arriba).
- Las e2e sin y con Supabase.
- Lanzar el flujo de copias una vez y mirar que lleva Storage.
- Contestar las preguntas y pedir el material de Roke y Álvaro.

## Notas
