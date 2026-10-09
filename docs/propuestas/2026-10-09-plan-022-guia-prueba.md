# Guía de prueba — plan 022: pulido de /mar y la landing, deuda técnica, spec y la radio

> Para Hernán. El plan 022 ([plan](../../plans/022-pulido-deuda-spec.md), T236–T247) hace cuatro
> cosas: pule `/mar` y la portada (tu segunda revisión y lo que contestaste en la guía del
> plan 020), paga deuda técnica, cierra la spec en todo lo que no depende de Álvaro y añade la
> **radio del sitio**. Sigue la forma de la [guía del plan 020](2026-10-08-plan-020-guia-prueba.md).
> Quieres contestar: **¿se ve bien en móvil y en escritorio? ¿la radio suena como la imaginaste?
> ¿las migraciones se pueden aplicar en `boia-planet-dev` en este orden?** Las respuestas van al
> final («Qué contestar»). Todo el contenido nuevo sigue siendo `muestra`.

**Estado de la prueba.** Las e2e **no se corrieron** en el plan (las corres tú; abajo, los
comandos). Cada tarea pasó su parte del comando de pruebas. El cierre (T245) lo volvió a pasar
con todo junto: `pnpm exec vitest run` (289 archivos, 2531 pruebas pasan, 1 saltada),
`sh tools/spec/checks.sh`, `pnpm lint`, `pnpm build` y `pnpm typecheck`, todo con código 0.
Las capturas de móvil (390×844) y escritorio (1440×900) están fuera del repo, en la carpeta de
adjuntos de cada tarea. En esta máquina sólo se ha usado emulación de móvil, no un móvil físico.

**Versión publicada.** La versión de prueba se subió dos veces hoy: `c550a62` (T236–T241 y
T246) y `c82b1c8` (T242 y la radio, T247). Lo de T243, T244 y el cierre del plan está en `main`
pero **no** publicado: publicar es decisión tuya.

## Qué cambia, tarea por tarea

### /mar: boia, carnet, destino del viaje y Ajustes (T236)

- **Taquilla en el mar** (revisión 2, punto 1): en el aviso «Solo en puerta», «¿Aún no tienes
  Carnet?» va en su propia línea, a 12 px por encima de «Hazte el tuyo». Nunca se tocan, ni en
  móvil ni en escritorio.
- **Destino del viaje** (tu Q5): durante un viaje, «Rumbo a …» sale en una pastilla justo encima
  de la barra de abajo. La barra no cambia de alto y «Entradas» vuelve a una línea.
- **Ajustes** (tu Q4): «Música» y «Efectos» son interruptores de pastilla con bola redonda
  (`role="switch"`, `aria-checked`, operables con teclado). El volumen se desactiva con el canal
  apagado.

### La isla de Las Calitas y las rutas (T237)

- **Las Calitas** se muda junto al náufrago (`[-7.0, 18.6]`, unas 290 u detrás y a su izquierda,
  vista desde la salida). **No queda justo detrás en línea recta**: la carretera de Los Rápidos
  le pasa por detrás y no cabe una isla entre las dos. Si la quieres exactamente detrás, hay que
  mover el náufrago o ese tramo de la carretera (ver «Qué contestar»).
- Las rutas `exploracion` y `d_solar` ya no cruzan ninguna isla. Un test lo comprueba.
- «**Isla del Cañón**» pasa a «**Puig Campana**» en el mapa, el diseño y el arte del Cañón.
  `grep -rn "Isla del Cañón" mundos/ packages/world/` no da nada.

### Portada: cabecera durante la presentación y peso (T238)

- **La cabecera no aparece durante la presentación negra** (BOIA, vídeo, pantalla completa). Entra
  cuando termina y sube «Próximo evento» (3,1 pantallas). Si subes hacia atrás se oculta otra vez.
  Con movimiento reducido sale como antes, a 0,95 pantallas.
- **Peso de la landing**: 199,5 kB → 196,6 kB gzip (con la radio, T247, queda en 196,7 kB; tope 200).
  El «Cerrar sesión» y la hoja del checkout se cargan aparte.

### Deuda técnica: artistas, dev y claves (T239)

- **El 400 de `carnets`** (`is_artist=eq.true`, columnas de música) venía de la migración
  `20261008100200_artist_music.sql`, que no está aplicada en `boia-planet-dev`. Ahora la web
  pide la música, si da error repite sin ella y lo recuerda en la sesión del navegador. Resultado:
  **una vez por sesión** sale un 400 en la consola hasta que apliques esa migración; luego la
  música de los artistas aparece sola.
- `pnpm dev` escribe en `apps/web/.next-dev` (no pisa `.next`, que era lo que daba el 500 de la guía del 020;
  no lo he vuelto a comprobar). `eslint` ignora esa carpeta.
- Quitadas dos claves de i18n sin uso (`artists.pause` y `artists.resume`).
- **Prettier**: no es un problema de finales de línea; `endOfLine: lf` quedó explícito en
  `.prettierrc.json`. Hay **205 archivos** con diferencias reales de formato y **no** se han
  reformateado (lista en `ESTADO.md`, sección T239).
- 47 manifiestos de `art/` tienen el hash de sus fuentes al día (sólo cambia esa línea).

### Datos locales: nombres en la papelera y fotos borradas (T240)

- En la **papelera del Admin** (modo local) un cambio de Carnet se nombra por su **apodo**; el id
  sólo si no tiene apodo.
- Una **foto local borrada** (o purgada de la papelera) se quita también de IndexedDB. Mover algo a
  la papelera **no** borra la foto (sigue siendo recuperable); al abrir el Admin en la demo se
  limpian las fotos que ya nadie referencia.

### Un objeto nuevo con archivo se ve en el mar (T241)

- Un objeto creado en el Admin con **imagen** (cartel que mira a la cámara) o **.glb** (modelo)
  se dibuja en el mar en su posición, en modo local. Mientras carga, o si el archivo falla, sale una
  **boya naranja** de respaldo.
- Lo subido sustituye a la pieza de la categoría (también en las islas de plantilla).
- Los archivos siguen en el navegador (D-20); subirlos a Storage necesita bucket y migración (ver
  «Qué contestar»).

### i18n del mapa de Arcilla y la tienda (T242)

- Los textos del mapa de Arcilla (nombres, diálogos, balizas, zonas) son claves `mapa.*` en
  `apps/web/lib/i18n/es-mundo.ts`. **Mismo texto, nada cambia en pantalla.**
- La tienda de barcos usa claves para el plural y el aviso de barco bloqueado.
- Quedan dos literales de prosa fuera de `map.ts` (Acuarela, que está oculta, y un texto por
  defecto de `packages/world/src/behaviors.ts`).

### Spec: REQ que se cerraron o se subieron (T243 y T244)

Cada REQ que sube a HECHO o PARCIAL lleva su prueba enlazada en `docs/spec/estado.md`. Todo lo
que sale de emulación lo dice. Resumen de los cambios de estado:

- **PRO, ENT, ARQ (T243):** HECHO REQ-PRO-015, ARQ-005, ARQ-008, ARQ-012. PARCIAL (antes
  FALTA): PRO-008, PRO-010, ENT-018, ARQ-004, ARQ-006, ARQ-018. Revisiones nuevas en
  `docs/revisiones/` (PRO-010 modales, ENT-018 arranque, ARQ-004 esquema).
- **MUN, AVE, IDE, COM, ADM (T244):** HECHO IDE-020, MUN-024, IDE-019, MUN-023, MUN-034, AVE-008,
  AVE-009, AVE-014, AVE-016, AVE-017, AVE-021, IDE-028, IDE-029, ADM-016, ADM-019 (y COM-026
  con más prueba). PARCIAL (antes FALTA): MUN-015, MUN-016, MUN-018.
- **Código que sale de esto:**
  - **REQ-AVE-032**: una vuelta se anula también si cambias de pestaña o te teletransportas (en
    /mar: viaje, vuelo o «cerca de»). Si cambias de pestaña en plena carrera, sale el aviso de
    vuelta anulada, igual que al abrir un panel.
  - **Textos «tripulación»**: ver la lista de «Qué contestar».
- **Totales** (`python3 tools/spec/estado.py`, código 0): 295 REQ · **HECHO 185 · PARCIAL 60 ·
  FALTA 15** · L2 25 · final 8 · retirado 2.

### La radio del sitio (T246 y T247)

Un botón de **«Música»** y un reproductor de estilo Winamp (sin logos, nombres ni mapas de bits de
Winamp; dibujo propio con los colores de BOIA):

- **Landing, arriba a la derecha**: el botón «Música» (altavoz). **Nada suena solo**: el primer toque
  pone la **primera canción del catálogo** y luego canciones al azar sin repetir la que acaba de
  sonar. El botón pasa a naranja y las ondas laten. Con la radio sonando, otro toque abre el
  reproductor. El botón se va al bajar la página (cuando tapa el hero) y, cuando sale la cabecera,
  **vuelve junto a «Entradas»**, con un halo que late (fijo si reduces el movimiento).
- **Reproductor**: pantalla verde con el tiempo (toca el tiempo para ver lo que falta), título
  «canción - artista» que corre, género, avance, volumen, anterior / play / pausa / parar /
  siguiente, **aleatorio** (encendido de serie) y **repetir** (todas → esta → no). Debajo, la lista
  por género (Todos, Techno, House, Reggaetón, Indie) con la canción que suena marcada.
- **Aviso «Sonando: título - artista»** abajo, con el reproductor cerrado, a cada cambio de canción;
  se va a los 4 s.
- **/mar**: botón **«Radio»** en el HUD (bajo la «!»), con el mismo reproductor. Mientras suena la
  radio se calla el ambiente del mundo.
- **Ajustes**: «Música» apagada (Ajustes de /mar, o el 🔊 de la cabecera de la landing) **pausa**
  la radio; encendida, sigue. Dar play a mano con la música apagada enciende «Música». El volumen
  de la radio es el suyo (deslizador del reproductor).
- **Sonido**: una canción cada vez; la siguiente se precarga sólo al final de la actual; tres fallos
  seguidos paran la radio con un aviso.
- **Entre páginas**: «Zarpar» es navegación interna, así que la música sigue de la landing a /mar.
  Una carga completa lo intenta recordar; si el navegador lo bloquea, queda en pausa con la canción
  puesta, a un toque.
- **Catálogo de muestra**: **100 canciones** (25 por género: techno, house, reggaetón, indie),
  generadas con un script (`art/radio/generar.py`), sin derechos. 98 duran 4 s y 2 duran 30 s
  (la primera, «Arena salvaje», techno, y una de house, para probar el avance). Pesan **2,78 MB** en
  total. Títulos y artistas inventados, todo `muestra`.
- **Admin → Radio** (`/admin#radio`): subir MP3 (se comprueba por sus bytes, máximo 15 MB) con
  título, artista, género y «que sea la primera». Lista con filtro por género, «Escuchar», subir y
  bajar, «Hacer primera», editar y borrar. **Géneros**: crear, renombrar y borrar. Renombrar un
  género actualiza sus canciones; **borrar un género se bloquea** mientras tenga canciones.
- Hay **siempre exactamente una primera canción** (si quitas la primera, pasa a serlo la de arriba).
- **Con cuentas**, el catálogo vive en Supabase (`radio_songs`, `radio_genres`, bucket
  `radio-songs`). Mientras la tabla esté vacía o no exista la migración 11, suena la muestra y la
  consola avisa.

## Qué probar a mano

En `pnpm dev` (o `pnpm build && pnpm start`), modo local. Móvil = 390×844.

| Qué | Dónde | Qué mirar |
|---|---|---|
| Boia y carnet | `/mar`, taquilla «Solo en puerta» (sin Carnet) | «¿Aún no tienes Carnet?» en su línea, separado del texto y de «Hazte el tuyo»; sin tocarse |
| Destino del viaje | `/mar`, durante un viaje | «Rumbo a …» en una pastilla sobre la barra; la barra sin cambiar de alto; «Entradas» en una línea |
| Ajustes | `/mar` → Menú → Ajustes | «Música» y «Efectos» como pastillas; con Tab y Espacio se cambian; volumen apagado con el canal |
| Las Calitas | `/mar` desde el náufrago | La isla detrás y a la izquierda, sin tapar la carretera; en móvil asoma por el borde izquierdo |
| Puig Campana | `/mar` y el plano de Arcilla | El nombre nuevo, nada de «Isla del Cañón» |
| Cabecera de la landing | `/` → bajar durante la presentación negra | La cabecera no aparece hasta que sube «Próximo evento»; sube y baja sin saltos |
| Radio: botón | `/` (móvil y escritorio) | «Música» arriba a la derecha; el primer toque la pone (naranja, ondas) y **no** suena antes |
| Radio: reproductor | Con la radio sonando, toca el botón | Pantalla verde, lista por género, aleatorio y repetir; cambiar de género filtra la lista |
| Radio: aviso | Con el reproductor cerrado, esperar a la siguiente | «Sonando: …» abajo, se va a los 4 s |
| Radio: cabecera | Bajar hasta ver «Entradas» en la cabecera | El botón de la radio junto a «Entradas», con halo |
| Radio: /mar | `/mar` → botón «Radio» | Abre el mismo reproductor; el ambiente del mundo se calla |
| Radio y Ajustes | `/mar` → apagar «Música» | La radio se pausa; encenderla la reanuda |
| Objeto con archivo | Admin → nuevo objeto con una imagen o un .glb → `/mar` | El objeto aparece en el mar; mientras carga, una boya naranja |
| Papelera | Admin → Papelera (modo local) tras mover un Carnet con apodo | El nombre del Carnet, no su id |
| Admin → Radio | `/admin#radio` | Subir una canción, marcarla como primera, renombrar un género, borrar uno con canciones (debe bloquearse) |
| Primera carga con Supabase | `/` con la migración 4 sin aplicar | Un 400 en la consola una vez por sesión; con la migración aplicada, ninguno |

## E2E

Las corres tú (política del plan). Primera vez en una carpeta:
`pnpm --filter @boia/web exec playwright install chromium`. Puertos 3215 y 3216 ocupados.

**Sin Supabase**, las que tocaron las tareas del plan (agrupadas por zona):

```sh
E2E_PORT=<libre> pnpm e2e \
  mar-a-bordo.spec.ts tickets.spec.ts mar-3d.spec.ts mar-calitas.spec.ts mar-circuito.spec.ts \
  mar-fiestera.spec.ts world-community.spec.ts mar-hud.spec.ts mar-ayuda.spec.ts mar-islas.spec.ts \
  mar-decor.spec.ts mar-tablon.spec.ts \
  landing.spec.ts landing-scroll.spec.ts intro.spec.ts accesos.spec.ts landing-logout.spec.ts \
  despliegue.spec.ts ranking.spec.ts artistas.spec.ts \
  admin-objeto.spec.ts admin-papelera.spec.ts admin.spec.ts \
  --workers=1
```

| Tarea | Specs | Qué cambió en ellas o qué mirar |
|---|---|---|
| T236 | `mar-a-bordo`, `tickets`, `mar-3d` | `mar-a-bordo`: «Música» con Espacio sobre el interruptor. `tickets`: la taquilla en el mar. `mar-3d`: viaje y «Saltar» |
| T237 | `mar-calitas`, `mar-3d`, `mar-circuito` | Las Calitas junto al náufrago; la isla queda junto a la carretera |
| T238 | `landing-scroll`, `landing`, `intro`, `accesos`, `landing-logout`, `tickets`, `despliegue`, `ranking` | Usan `pastHero` / `openTickets` de `hero-helpers.ts`, que ahora baja `PRESENTATION.end + 0.6` pantallas |
| T239 | `artistas` | Toca `registered.ts` (la consulta de artistas) |
| T240 | `admin-papelera` | La papelera local ahora muestra el apodo |
| T241 | `admin-objeto` (cambiado), `mar-decor`, `mar-tablon` | `admin-objeto` comprueba que el objeto con imagen se pinta en el mar |
| T242 | `mar-islas`, `mar-ayuda` | Ningún cambio de texto; comprobar por si acaso (nombres y líneas de las boyas) |
| T243 | `intro`, `landing-scroll` | Para cerrar ENT-018 (los títulos están en el informe de `docs/revisiones/`) |
| T244 | `world-community`, `mar-circuito`, `mar-fiestera` | `world-community`: el logro «El grupo BOIA». `mar-circuito`: la anulación nueva no debe cortar una vuelta normal. `mar-fiestera`: usa viajes y `startNear` antes de las carreras |
| T246 | `admin` | La barra de secciones tiene una entrada más, «Radio» |
| T247 | `landing-logout`, `landing-scroll`, `mar-hud`, `accesos`, `mar-a-bordo` | El botón de radio es una fila más en la cabecera; `mar-hud` mide el contraste con un botón más («Radio»); el 🔊 sigue igual |

Nota: ninguna de estas specs se ha corrido; los agentes sólo dicen qué debería comprobar cada una.

**Con Supabase**, después de las migraciones (abajo):
`E2E_SUPABASE=1 E2E_PORT=<libre> pnpm e2e admin-real.spec.ts --workers=1`, y a mano: la radio con
la migración 11 (el Admin sube una canción y la radio pasa a Supabase).

## Migraciones

**Estado real en `boia-planet-dev` (plan 023 T253, 2026-10-09, comprobado contra el proyecto):
las 35 migraciones aplicadas.**

| Orden | Migración | Estado |
|---|---|---|
| 1 | `20261007100200_moderation` | ✅ aplicada (T253, intento 1) |
| 2 | `20261007100400_admin_access_export` | ✅ aplicada (T253, intento 1) |
| 3 | `20261008100100_event_fields_common_code` | ✅ aplicada (T253, intento 1) |
| 4 | `20261008100200_artist_music` | ✅ aplicada (T253, intento 2). En el 1 fallaba: el `check` en línea de `music_url` ya se llama `carnets_music_url_check`; el segundo `check` (plataforma ↔ enlace) se renombró a `carnets_music_url_platform_check` en el archivo, sin cambiar reglas |
| 5 | `20261008100300_door_stamps` | ✅ aplicada (T253) |
| 6 | `20261008100400_gallery_clips` | ✅ aplicada (T253) |
| 7 | `20261008100500_calitas` | ✅ aplicada (T253) |
| 8 | `20261008100600_admin_limits_analytics` | ✅ aplicada (T253; antes, `staff_roles` con 0 filas) |
| 9 | `20261008200100_carnet_answer_music_moderation` | ✅ aplicada (T253) |
| 10 | `20261008200200_member_party_trash` | ✅ aplicada (T253) |
| 11 | `20261009100100_radio` | ✅ aplicada (T253) |
| 12 | `20261009100200_radio_genre_optional` | ✅ aplicada (T253) |

Las semillas de muestra **no** se corrieron (T253 aplicó sólo migraciones; `pnpm db:migrate:dev`
las aplica si hacen falta). Tipos regenerados con `pnpm db:types:dev` (sólo cambian orden,
`genre_id` opcional al insertar y `admin_sign_in_email` devuelve `string`).

Lo de abajo es la lista original de la guía (antes de T253).

Según la [guía del plan 020](2026-10-08-plan-020-guia-prueba.md) ninguna estaba aplicada en
`boia-planet-dev`. **Esta guía añade la 11 (radio)**. Si ya aplicaste alguna desde entonces, mira
cuál falta antes de correr el comando; esto **no** se ha comprobado contra el proyecto remoto.

En `boia-planet-dev`, **en este orden** (el de su nombre):

| Orden | Migración | Tarea | Qué hace | Pruebas (`test:supabase`) |
|---|---|---|---|---|
| 1 | `20261007100200_moderation.sql` | plan 017 T191 | Moderación de Carnets, botellas y rankings | `moderation.supabase.ts` |
| 2 | `20261007100400_admin_access_export.sql` | plan 017 T193 | Carnet 000, códigos de respaldo, `export_my_data` | `admin-access.supabase.ts` |
| 3 | `20261008100100_event_fields_common_code.sql` | plan 019 T215 | Campos nuevos del evento, `ticketing_settings`, código común | `event-fields.supabase.ts` |
| 4 | `20261008100200_artist_music.sql` | plan 019 T217 | Música del Carnet de artista, `set_artist_music`. **Quita el 400 de «artistas» en cada sesión** (T239) | `artist-music.supabase.ts` |
| 5 | `20261008100300_door_stamps.sql` | plan 019 T218 | `event_attendance`, `staff_stamp` (puerta y a mano) | `door-stamps.supabase.ts` |
| 6 | `20261008100400_gallery_clips.sql` | plan 019 T216 | Clips en `event_photos`, bucket `event-clips` | `gallery-clips.supabase.ts` |
| 7 | `20261008100500_calitas.sql` | plan 019 T222 | Las Calitas: tablas, RLS, filtro, RPC | `calitas.supabase.ts` |
| 8 | `20261008100600_admin_limits_analytics.sql` | plan 019 T223 | Tope de 3 admin/owner, `site_settings.analytics_enabled` | `admin-limits.supabase.ts` |
| 9 | `20261008200100_carnet_answer_music_moderation.sql` | plan 020 T229 | Retirar una respuesta, cambiar la música de un artista, papelera de moderación (30 días) | `carnet-moderation.supabase.ts` |
| 10 | `20261008200200_member_party_trash.sql` | plan 020 T230 | Socios y fiestas a la papelera, devolver, `purge_expired_trash` | `trash.supabase.ts`, `accounts.supabase.ts` |
| 11 | `20261009100100_radio.sql` | plan 022 T246 | Radio: tablas `radio_genres` (con los 4 géneros de muestra) y `radio_songs`, una sola primera canción, RPC `radio_set_first` y `radio_reorder`, RLS (lectura pública; escritura sólo equipo), bucket `radio-songs` (audio/mpeg, 15 MB) | **Sin prueba `test:supabase` propia** (sólo la de texto `apps/web/lib/radio/radio-sql.test.ts`) |

Desde la raíz del repo:

1. **Antes de la 8**: que en `staff_roles` haya **como mucho 2** personas admin u owner reales
   (`admin-limits.supabase.ts` da de alta 1 admin propio por archivo y fallaría con 3).
2. `pnpm db:migrate:dev` → aplica las once, en orden.
3. `pnpm db:types:dev` → regenera los tipos. `database.types.ts` se editó a mano en los planes
   019, 020 y 022 (T246), así que debería salir sin diferencias o con pocas.
4. `pnpm test:supabase` (la radio no tiene prueba propia todavía; ver la pregunta 20 de «Preguntas y propuestas abiertas»).
5. Los pasos 1 y 3 de la [guía del plan 017](2026-10-07-plan-017-guia-prueba.md) que falten.
6. Las e2e con Supabase de arriba, y a mano la Moderación, la papelera y la radio con dos cuentas.

Sin la migración 4 la landing funciona, sólo que el 400 sale una vez por sesión. Sin la 11, la radio
suena con la muestra y avisa en la consola. Con cuentas, el Admin de la radio no debería guardar nada
hasta que la aplicas (no lo he comprobado contra el proyecto).

**Copias** (sin cambios desde el plan 020): `SUPABASE_DB_URL` y `BACKUP_PASSPHRASE` ya bastan. Lanza el
flujo una vez a mano y mira que el artefacto lleve `storage/`. No he comprobado si el bucket de la radio
entra en la copia.

## Lo que cambió de wording («tripulación») para que lo revises

El criterio IDE-020 pide quitar «tripulación» de la interfaz. Se cambió:

| Dónde | Antes | Ahora |
|---|---|---|
| `mar.race.offer.vs` | «…contra los tiempos de la tripulación…» | «…contra los tiempos de los demás barcos…» |
| `mar.race.offer.leader` | «récord de la tripulación: {name}, {time}» | «récord del ranking: {name}, {time}» |
| `mar.canon.previa.ranking.vacio` | «¡Sé la primera tripulación del ranking!» | «¡Sé el primer barco del ranking!» |
| `mar.castillo.ranking.local` y `mar.canon.ranking.local` | «…entre la tripulación de muestra.» | «…entre los barcos de muestra.» |
| Logro `whatsapp` (`packages/store/src/sample/progress.ts`) | «La tripulación BOIA» | «El grupo BOIA» |

Se queda «Nueva tripulante a bordo» (el aviso del rescate): el criterio busca «tripulación» y ese
aviso es otra palabra. Si no te gusta, es un cambio de una línea.

## Decisiones de los agentes que conviene revisar

- **Cabecera**: sale a `PRESENTATION.end` (3,1 pantallas), no a 0,95, salvo con movimiento reducido (T238).
- **Pruebas de la landing**: `hero-helpers.ts` baja a `PRESENTATION.end + 0.6` pantallas antes de usar la cabecera (T238).
- **Taquilla**: el destino del viaje va en una pastilla sobre la barra, no dentro de ella (T236).
- **Calitas**: detrás y a la izquierda, no en línea recta, porque la carretera de Los Rápidos no deja hueco (T237). Se cambió `mapa.py` para contar las islas sueltas como tierra.
- **Artistas**: si la migración 4 no está, la consulta repite sin música y lo recuerda en la sesión (`sessionStorage`, clave `boia.artists.music-columns`) (T239).
- **Prettier**: no se reformatean los 205 archivos; `endOfLine: lf` explícito (T239).
- **Papelera**: mover a la papelera **no** borra la foto; purgar sí; la limpieza al abrir el Admin sólo corre en la demo (T240).
- **Objetos con archivo**: sustituyen a la pieza de la categoría (incluidas las islas de plantilla); la imagen es un cartel que gira hacia la cámara; el tamaño sale de la huella (T241).
- **Radio**: borrar un género se bloquea mientras tenga canciones; renombrarlo las renombra sin tocarlas (T246).
- **Radio**: «Música» apagada pausa la radio; dar play a mano con la música apagada la enciende (T247). Nada suena solo.
- **Radio**: aleatorio y repetir todas vienen de serie; la precarga empieza a 8 s del final (T247).
- **Radio sin cuentas**: la muestra se escribe en IndexedDB la primera vez (T246).
- **Spec**: PRO-009, PRO-010, ENT-018, ENT-024 y ARQ-016 se quedan en PARCIAL aunque haya medición (el criterio pide algo que falta o choca con una decisión posterior). ARQ-006 no sube: `pnpm db:test` necesita PostgreSQL local, que no hay en esta máquina (T243).
- **REQ-IDE-020**: se reescribió «tripulación» en la interfaz; el test busca en `mundos/` y en el catálogo (T244).

## REQ que quedan para Álvaro o para dispositivos

De [`docs/spec/estado.md`](../spec/estado.md). Cada fila dice qué falta y de quién.

### PRO, ENT y ARQ (T243)

| REQ | Estado | Qué falta | De quién |
|---|---|---|---|
| REQ-PRO-004 | PARCIAL | Recorrido completo en móvil físico, en el informe del hito | dispositivo físico |
| REQ-PRO-005 | PARCIAL | Pregunta 2 de §30 respondida por Álvaro | Álvaro |
| REQ-PRO-008 | PARCIAL | Registro en móviles físicos por entrega | dispositivos (Hernán) |
| REQ-PRO-009 | PARCIAL | Ajustar el criterio de 09 a las decisiones del HUD (T65, T247) | Hernán/Álvaro |
| REQ-PRO-010 | PARCIAL | Decidir si Welcome Aboard al llegar cuenta como modal bloqueante | Hernán/Álvaro |
| REQ-PRO-011 | PARCIAL | Animación por comportamiento en /mar (obra) y revisión de hito | obra + revisión |
| REQ-PRO-012 | FALTA | Personas ajenas que completen tutorial y rescate sin ayuda | personas |
| REQ-PRO-013 | PARCIAL | Restos, cofres, delfín, remolino y circuito eran del 2D (D-25); criterio por ajustar | decisión |
| REQ-PRO-014 | FALTA | Revisión de Álvaro y pregunta 14 de §30 | Álvaro |
| REQ-PRO-016 | FALTA | Informe de hito con las 14 respuestas de §30 | Álvaro |
| REQ-PRO-018 | PARCIAL | Contenido real aprobado (0 `muestra` al publicar) | Álvaro |
| REQ-PRO-019 | FALTA | Responsable y estado de cada fila de contenido de 01 | Álvaro |
| REQ-PRO-020 | FALTA | Lista de publicación firmada por Álvaro | Álvaro |
| REQ-ENT-002, ENT-027 | PARCIAL | Pasar la decisión 4 («Zarpar» sólo en el hero) a `DECISIONES.md` y ajustar el criterio | Hernán |
| REQ-ENT-004 | FALTA | Revisión visual de ENT 06 aprobada | Álvaro |
| REQ-ENT-005 | FALTA | Revisión de ENT 06; el criterio «ninguna librería 3D» choca con three.js (D-26) | Álvaro/decisión |
| REQ-ENT-012 | PARCIAL | La escena de /mar no es el mismo objeto que la del planeta (obra grande) | obra |
| REQ-ENT-018 | PARCIAL | Navegadores internos de apps, Safari y Chrome reales (móvil físico); e2e por correr | dispositivo físico |
| REQ-ENT-021 | FALTA | Registro por dispositivo físico y orientación | dispositivos |
| REQ-ENT-022 | PARCIAL | Medición en el dispositivo de referencia (P6) | dispositivo físico |
| REQ-ENT-024 | PARCIAL | Arte real y una prueba de la captura | Álvaro |
| REQ-ENT-025 | PARCIAL | Frase de posicionamiento aprobada | Álvaro |
| REQ-ENT-036 | PARCIAL | e2e de Atrás con un evento y una galería (no escrita) | e2e (Hernán la corre) |
| REQ-ARQ-004 | PARCIAL | Decidir qué tablas son entidades y migración con `version` | Hernán |
| REQ-ARQ-006 | PARCIAL | Correr `pnpm db:test` con PostgreSQL local sobre las migraciones | máquina con PostgreSQL |
| REQ-ARQ-010 | PARCIAL | Cadencia mínima entre recogidas en `award_points` (migración) | migración |
| REQ-ARQ-013 | PARCIAL | Plazos legales (Álvaro) y secretos de la copia (Hernán) | Álvaro/Hernán |
| REQ-ARQ-014, ARQ-015 | PARCIAL | Medición en los dispositivos de referencia (P6) | dispositivos |
| REQ-ARQ-016 | PARCIAL | Áreas seguras y sin conexión en móvil físico | dispositivo físico |
| REQ-ARQ-017 | FALTA | Registro por dispositivo con los 5 datos y los 11 aspectos | dispositivos |
| REQ-ARQ-018 | PARCIAL | Una comprobación del registro por tarea (o apuntar las 3 sin resultado) | Hernán |
| REQ-ARQ-019 | PARCIAL | Clave de PostHog y `purchase_confirmed` desde el servidor (ticketera) | Álvaro (ticketera) |
| REQ-ARQ-024 | PARCIAL | Copias, plantillas del Admin y contenido aprobado | Álvaro |

### MUN, AVE, IDE, COM y ADM (T244)

| REQ | Estado | Qué falta | De quién |
|---|---|---|---|
| MUN-003 Agua viva | FALTA | Revisión visual dentro del presupuesto de FPS, en móvil | dispositivo físico |
| MUN-017 Rutas de 1 y 10 min | FALTA | Medir en móvil físico (la estimación de `diseno.md` es de la maqueta) | dispositivo físico |
| MUN-029 Barco y 3 skins en 8 direcciones | FALTA | Revisión de ART 01: son sprites 2D y /mar usa modelo 3D (D-25) | Hernán/Álvaro (revisión o cambio de spec) |
| MUN-033 Revisión de skins | FALTA | Revisión por skin, prueba de sustitución y guía | Hernán/Álvaro |
| COM-029 Validación de artistas | FALTA | Aprobación registrada | Álvaro |
| ADM-038 Usabilidad de 10 min | FALTA | Prueba con personas, con tiempo y dudas | personas |
| MUN-001 3D sólo en /mar | PARCIAL | Choca con D-24: el planeta de la entrada carga three.js en diferido. Actualizar el criterio | decisión |
| MUN-004 Estela reactiva | PARCIAL | Grabación de los 6 estados | revisión humana |
| MUN-006 Joystick | PARCIAL | Prueba táctil en físicos | dispositivo físico |
| MUN-015, MUN-018 | PARCIAL | Revisión del plano y del boceto por el equipo, con fecha | Hernán/Álvaro |
| MUN-016 Plano con rutas | PARCIAL | «Rodear lo opcional» y «ampliar sin cambiar misiones»; la salida del circuito choca con T61 | prueba + decisión |
| MUN-021 Minimapa reposicionable | PARCIAL | El motor lo hace, pero el minimapa de /mar no se mueve | Hernán (rehacerlo o cambiar el criterio) |
| MUN-028 Barco por slots | PARCIAL | La bandera se quitó en T167; el criterio ya no tiene objeto | decisión |
| MUN-030 Orientación sin espejar | PARCIAL | Revisión de las 8 direcciones (/mar es 3D) | revisión |
| MUN-032 Sprites desde Blender | PARCIAL | Correr Blender sin interfaz y comparar | máquina con Blender |
| MUN-037, MUN-039 Cambio de mundo | PARCIAL | Un solo mundo jugable (T122); vuelve con Acuarela | decisión / futuro |
| AVE-003 Guion del tutorial | PARCIAL | Texto aprobado | Álvaro |
| AVE-023 Boia de WhatsApp | PARCIAL | Enlace real y comprobar su `href` en la e2e | Álvaro |
| AVE-026, AVE-031 Circuito y atajo | PARCIAL | El trazado cerrado de T61 contradice los criterios; registrar la decisión y cambiar la spec | decisión |
| AVE-035 Módulo de minijuegos | PARCIAL | Decidir si «misma posición» es donde acaba la partida (hoy, sí) | decisión |
| AVE-037 Cañón | PARCIAL | Los criterios son del juego anterior; está en el borrador para Álvaro | Álvaro |
| AVE-039 Accesibilidad de minijuegos | PARCIAL | Prueba con un lector de pantalla de verdad | revisión humana |
| IDE-006 Fusión idempotente | PARCIAL | Probado contra `boia-planet-dev`, que `estado.py` no cuenta | límite del script |
| IDE-012, IDE-022 | PARCIAL | Revisión de diseño en el hito | Hernán/Álvaro |
| IDE-025 Logros de lanzamiento | PARCIAL | Lista aprobada | Álvaro |
| IDE-034 Menú de a bordo | PARCIAL | El menú tiene 9 entradas y el criterio pide 7 (`[provisional]`) | decisión |
| COM-015 Adaptador de ticketera | PARCIAL | ADR comparativo y elección | Álvaro |
| COM-016 Sandbox | PARCIAL | Procedimiento de activación; depende de la ticketera | Álvaro |
| COM-017 Webhook | PARCIAL | No hay webhook ni firma hasta la ticketera real | versión final |
| COM-030 Filosofía | PARCIAL | Textos aprobados | Álvaro |
| COM-033 Tienda con enlace externo | PARCIAL | La landing no lleva a la isla de la tienda; alcance `[provisional]` | Álvaro/decisión |
| ADM-001 Contenido como datos | PARCIAL | Editar el diálogo de los lugares del mapa (hoy está en el código) | código nuevo (fuera de alcance) |
| ADM-008 Secciones del Admin en L1 | PARCIAL | Lista de secciones L1 (`[provisional]`) | decisión |
| ADM-031 Peticiones de datos a mano | PARCIAL | Hacer una vez el procedimiento de `docs/manual-admin.md` §6 y registrarlo | Hernán |
| ADM-032 Mundo activo como temporada | PARCIAL | Un solo mundo jugable (T122) | futuro |

## Preguntas y propuestas abiertas

Sin decidir. Las de Hernán van primero.

**Para Hernán**

1. **Welcome Aboard** (la hoja de bienvenida de /mar): se titula en inglés en una interfaz en español.
   ¿Intencionado? ¿Lo traducimos? (T243)
2. **¿La hoja de bienvenida cuenta como modal bloqueante?** Hoy, al llegar desde «Zarpar», sí para
   el barco (PRO-010). Decide tú o Álvaro.
3. **Calitas exactamente detrás** en línea recta: habría que mover el náufrago hacia la salida o el
   tramo de Los Rápidos que le pasa por detrás. Hoy está a la izquierda. (T237)
4. **Las cuatro decisiones de spec** que piden tus criterios: MUN-021 (minimapa), AVE-026/031
   (circuito cerrado), IDE-034 (9 entradas en el menú, criterio 7), AVE-035 (fin de la partida).
5. **Pasar la decisión 4 a `DECISIONES.md`** para retirar REQ-ENT-002 y ENT-027 (también pendiente del plan 019).
6. **Wording «tripulación»**: revisa la tabla de arriba.

**Para Álvaro**

7. **Subir los archivos de los objetos a Supabase Storage** (bucket y migración). Hoy el contenido del
   Admin sigue en el navegador en los dos modos (D-20). (T241)
8. **Arte y textos**: el visto bueno al arte de Las Calitas, Puig Campana y el trazo de las boyas (ya en la
   guía del 020), y a los textos `muestra`, también los de la radio.
9. **Ticketera, COM-016 y COM-017**: el procedimiento de activación y el webhook dependen de la elección.

**Del trabajo técnico (propuestas de los agentes)**

10. **Pérdida de contexto WebGL en la landing**: al perder el contexto, la escena desaparece; al
    restaurarlo sale el planeta sin islas y el «BOIA» queda en blanco. Falta un manejador de
    `webglcontextlost` / `restored`. (T243, bug)
11. **Zoom 200 %**: a 640×360, los rótulos de las esquinas de /mar pisan «Consigue descuentos». (T243, bug)
12. **Editar el diálogo de los lugares del mapa desde el Admin** (ADM-001). `lib/mundo/menu` (7 secciones)
    parece huérfano. (T244)
13. **Dry run de `docs/manual-admin.md` §6** (ADM-031), una vez y registrado. (T244)
14. **Criterios en conflicto**: MUN-001, MUN-021, MUN-028, AVE-026, AVE-031, AVE-035, IDE-034, PRO-009,
    ENT-002, ENT-027 chocan con decisiones posteriores; hay que ajustarlos. (T243, T244)
15. **Prettier**: reformatear los 205 archivos en un commit aparte, cuando nada más corra. (T239)
16. **Claves i18n sin uso**: unas 640 sospechosas en un barrido ingenuo; muchas se usan con claves
    dinámicas. Revisión a mano en otra tarea. (T239)
17. **Artistas sin Carnet en la papelera**: un Carnet de artista no aparece en `admin.carnets()`, así que
    su cambio en la papelera sigue mostrando el id. (T240)
18. **Limpieza de fotos al abrir el Admin**: una subida en curso podría quedar huérfana si la limpieza
    corre justo entonces (riesgo muy bajo; sólo al abrir el Admin). (T240)
19. **Prosa fuera de `map.ts`**: `acuarela/skin.ts` (`cala: 'Puerto de Alicante'`, mundo oculto) y el
    `leaveReaction` por defecto de `packages/world/src/behaviors.ts`. No hay regla de lint para textos
    sueltos. (T242)
20. **Radio**: una prueba `radio.supabase.ts` contra la base, cuando la migración 11 esté aplicada. Y
    corregir la concordancia de algunos títulos de muestra («Velero lenta»). (T246)
21. **Radio, peso**: los +75 B de la landing vienen de un trozo común del catálogo que comparte con el
    Admin. (T247)
22. **Radio y el 🔊**: el 🔊 de la cabecera sigue siendo el interruptor global (música y efectos); la radio
    no lo sustituye ni lo esconde. (T247)
23. **Más kB en la landing**: pasar de ~196,7 kB exige cambiar la arquitectura (los bloques son componentes de
    cliente) o partir el catálogo i18n de la web. (T238)
24. **HUD de /mar**: tiene un botón más («Radio») y enlaces, zoom y turbo que el criterio de PRO-009 no admite. (T243)
25. **Límites de frecuencia** de REQ-ARQ-012 y logs de Vercel/Supabase: no se miran. (T243)
26. **`pnpm db:test`** necesita PostgreSQL local; no hay en esta máquina. (T243)

## Lo que hace Hernán

- Aplicar las once migraciones, `pnpm db:types:dev` y `pnpm test:supabase` en `boia-planet-dev` (arriba).
- Las e2e sin y con Supabase (arriba). Recuerda que no se han corrido.
- Probar a mano la radio en móvil (390×844) y en escritorio, y el destino del viaje y la taquilla.
- Revisar la tabla de «tripulación» y las decisiones de los agentes.
- Decidir si se publica (push y despliegue son tuyos).
- Contestar las preguntas de arriba.

## Qué contestar

1. **Rótulo de Las Calitas en el mar**: crema (como las islas sin fiesta). **Hernán lo dejó así el 2026-10-09.**
2. **Tiempos de la entrada** (1,2 s / 0,7 s / 0,6 s): se quedan. **Hernán, 2026-10-09.**
3. **Peso de la landing**: 196,7 kB gzip tras la radio (tope 200). Queda margen de ~3 kB.
4. **Interruptores en Ajustes**: hechos (T236).
5. **«Entradas» durante un viaje**: hecho, con la pastilla del destino (T236).
6. **Papelera con cuentas**: se queda como está (un socio bloqueado 30 días y luego borrado; una fiesta con
   compras, sellos o puntos sólo se oculta). **Hernán, 2026-10-09.**

## Notas

(Espacio para tus respuestas.)
