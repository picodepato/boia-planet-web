# Guía de prueba — plan 023: radio, pulido móvil, tienda, galería, carnet, Explanada y Supabase

> Para Hernán. El plan 023 ([plan](../../plans/023-tienda-radio-carnet-explanada.md), T246–T257)
> recoge tu lista del 2026-10-09: la radio con géneros de verdad, el pulido móvil de la portada,
> el «Próximo evento» que salía distinto en ordenador y móvil, la tienda real (tote de Manu Ropero
> y camiseta de 220 g), cuatro fotos en la galería, los botones «Descubre» del carnet, la isla sin
> nombre convertida en la Explanada de Alicante y las migraciones de Supabase aplicadas en
> `boia-planet-dev`. Sigue la forma de la [guía del plan 022](2026-10-09-plan-022-guia-prueba.md).
> Quieres contestar: **¿se ve bien en móvil (390×844) y en escritorio? ¿la Explanada se parece a
> lo que imaginaste? ¿la tienda y la galería están como quieres?** Las respuestas van al final
> («Qué contestar»). Todo el contenido nuevo sigue siendo `muestra`, salvo los precios y el nombre
> de Manu Ropero, que son reales.

**Estado de la prueba.** Ninguna e2e se corrió en el plan (las corres tú; abajo, los comandos).
Cada tarea pasó su parte del comando de pruebas. El cierre de cada tarea dejó `vitest run` en
verde, `sh tools/spec/checks.sh`, `pnpm lint`, `pnpm build` y `pnpm typecheck` con código 0. Las
capturas están fuera del repo, en las carpetas que cada sección de `ESTADO.md` indica; hay
algunas que no se hicieron (T247) y otras que no se ven desde este equipo (ver cada tarea).

**Versión publicada.** Lo de T248 (`78fac36`, `98465cf`) y T256 (`a826585`, `5d471a9`) ya se subió
a producción con tu visto bueno. Lo demás del plan está en `main` pero **no publicado**: el
despliegue de `https://boia-planet-roan.vercel.app` sale con el siguiente push, que decides tú.

## Qué cambia, tarea por tarea

### Radio: géneros, barra lateral y «Sin género» (T246, T255)

- **Admin › Radio** (`/admin#radio`): crear un género y subirle la primera canción (queda elegido
  en «Subir una canción»); renombrar un género sin que se quede vacío (nombres repetidos o de más
  de 40 letras dan un aviso claro); renombrar conserva sus canciones.
- **Cada canción** tiene un desplegable de género (todos los géneros y «Sin género») que guarda al
  cambiarlo. «Editar» queda para título y artista.
- **Borrar un género** pide confirmación en la propia fila: «Tiene N canciones: no se borran, se
  quedan sin género y suenan sólo en «Todos»». Nunca se borra una canción con el género.
- Filtro «Ver» con «Sin género».
- **Reproductor**: la barra de géneros corre de lado cuando no caben (dedo, trackpad o rueda), con
  el borde difuminado y una flechita a cada lado sólo si queda algo escondido. El género elegido se
  trae a la vista. Las canciones sin género salen sólo en «Todos».
- Con cuentas, la migración nueva `20261009100200_radio_genre_optional.sql` deja `genre_id`
  opcional (ver «Migraciones»). Sin ella, borrar un género con canciones falla con
  «falta la migración 20261009100200».

### Portada móvil: botón de música, cabecera y carrusel (T247)

- **Botón «Música» de la portada** (`variant="hero"`): en móvil (menos de 900 px) sólo icono, de
  44 px, pegado a la esquina superior derecha respetando la zona segura del móvil. No tapa el
  «Entradas» del hero. Sigue teniendo nombre accesible.
- **Cabecera en móvil** (menos de 600 px): «Entradas», menú y botón de radio a 32 px de alto, con
  un área de toque de 40 px. El escritorio no cambia.
- **Carrusel de la tienda**: cambia de foto cada 2 segundos (antes 3,5).
- Decisión: el objetivo decía «esquina inferior derecha», pero el botón ya estaba arriba a la
  derecha y abajo chocaría con la pista de «Desliza» y con el texto de la esquina. Se quedó arriba.

### «Próximo evento» igual en ordenador y móvil (T248)

**La causa, en dos frases.** Cada navegador guarda su copia de la muestra (D-20) y la del
ordenador era de antes del 2 de octubre, cuando el evento fijado era «All Day BOIA · Primavera»:
esa copia vieja ganaba a la muestra nueva (Halloween fijado). El móvil no tenía copia guardada y
enseñaba la muestra de hoy, Halloween.

- **Arreglo**: `SAMPLE_CONTENT_REVISION` (revisión de la muestra, en `schema.ts`). Al cargar, un
  navegador con una revisión vieja renueva una sola vez los eventos y los bloques de inicio de la
  muestra; lo que creaste en el Admin se queda.
- **Para ti**: al abrir la web en el ordenador de siempre, «Próximo evento» dice HALLOWEEN IN THE
  CLUB, como el móvil. Ojo: los cambios que hubieras hecho en el Admin a eventos o bloques de la
  muestra en ese navegador vuelven a la muestra (una vez).

### Tienda: tote de Manu Ropero y camiseta real (T249, T256)

- **Tote bag BOIA** (30 €), hecha a mano por **Manu Ropero**: la línea «Hecha a mano por Manu
  Ropero» sale bajo el nombre. Cuatro fotos en este orden: bolsa sola, modelo ella, modelo él y
  bolsa llena.
- **Camisetas** (18 €), «Algodón 220 g, en blanco, arena o negro.» Tres fotos: plano, arena y
  negra. Venta por reserva, como antes.
- **Quitada** la «Tote bags» de muestra (12 €) y sus imágenes. «Packs de pegatinas» sigue.
- La tienda de la portada y la isla de la tienda en `/mar` leen la misma lista.

### Galería: cuatro fotos nuevas (T250)

- `galeria-1` a `galeria-4` en el álbum de muestra, con texto alternativo en español. No salen en
  la portada (sólo en `/galeria`).
- **`galeria-3`** (la camiseta de Francia) venía con el icono de Google Lens en la esquina inferior
  izquierda: recortada 60 px por la izquierda para quitarlo.
- **Derechos**: todo `muestra` hasta que Álvaro dé el visto bueno. `galeria-4` es una portada de
  disco ajena: la más delicada.

### Carnet: botones «Descubre» (T251)

- **Mi carnet** (`/carnet`): bajo «Tus respuestas», **«🔎 Descubre otro miembro BOIA»** abre el
  carnet de alguien al azar (miembro o artista), nunca el tuyo.
- **Carnet de un artista** (`/carnet/<id>` de un artista): bajo sus respuestas, **«🔎 Descubre un
  artista»** (otro artista, nunca este) y **«🔎 Descubre otro miembro BOIA»**. El carnet de un
  miembro que no es artista lleva sólo el segundo.
- Mismo botón y mismo azar que «Descubrir a un BOIERO» del ranking (el ranking no cambia de
  comportamiento). Sin nadie a quien descubrir: «Aún no hay Carnets que descubrir.»
- Con cuentas, la lista sigue siendo la del ranking (miembros y artistas de muestra): los Carnets
  reales de Supabase todavía no entran.

### La Explanada de Alicante, en la isla sin nombre (T252)

- La isla de la derecha de `/mar` (la que está delante del barco, bajo el rótulo del Puerto de
  Alicante) es ahora la **Explanada de España**: mosaico ondulado rojo, crema y negro, dos hileras
  de palmeras, bancos, farolas, la balaustrada del mar, la Concha al este y las fachadas de la
  ciudad detrás (con las ventanas encendidas de noche). Sigue **sin nombre**.
- Modelo en Blender (`tools/blender/islas/explanada.py`): 25 654 triángulos, 529 kB. Validado
  (sin caras degeneradas, 31 materiales, seis vistas).
- En el juego se ve de cerca con el modelo y de lejos con la versión a mano. Para llegar: `/mar`
  y el barco delante de la isla, o directamente `/mar?cerca=explanada` (pone el barco delante).
- Sin e2e propia todavía.

### Supabase: migraciones aplicadas en `boia-planet-dev` (T253)

Ver la tabla en «Migraciones». Todo el esquema de dev está al día; no se tocó producción.

## Qué probar a mano

En `pnpm dev` o en el despliegue. Móvil = 390×844; escritorio = 1440×900. Modo local (sin
variables de Supabase) salvo que se diga otra cosa.

| Qué | Dónde | Qué mirar |
|---|---|---|
| Radio: géneros del Admin | `/admin#radio` | Crear un género, subirle una canción, renombrarlo; nombre vacío o repetido avisa |
| Radio: canción sin género | `/admin#radio` → desplegable de la fila | Pasar una canción a «Sin género»; el filtro «Ver» → «Sin género» la muestra |
| Radio: borrar género | `/admin#radio` → «Borrar» de un género con canciones | Aviso con el número de canciones; al confirmar, las canciones siguen sin género |
| Radio: barra de géneros | Portada → «Música» (móvil) con 8 o más géneros | La barra corre con el dedo; flechas sólo si queda algo escondido; el género elegido se ve |
| Radio: «Todos» | Reproductor, «Todos» | Sale también la canción sin género |
| Portada móvil: música | `/` en 390×844, arriba a la derecha | El botón «Música» es sólo icono, en la esquina, sin tapar «Entradas» |
| Portada móvil: cabecera | `/` en 390×844, bajar | Botones de cabecera más pequeños, proporcionados con el logo BOIA; escritorio igual que antes |
| Carrusel de la tienda | `/` → Tienda, en móvil | Cambia de foto cada 2 s |
| Próximo evento | `/` en ordenador y en móvil | Los dos dicen HALLOWEEN IN THE CLUB (tras cargar una vez) |
| Tienda | `/` → Tienda, o `/mar?ir=tienda` | Tote BOIA 30 € con «Hecha a mano por Manu Ropero» y 4 fotos; Camisetas 18 € con 3 fotos; sin «Tote bags» |
| Galería | `/galeria` | Las cuatro fotos nuevas (`galeria-1` a `galeria-4`); `galeria-3` sin el icono de Lens |
| Carnet: mi carnet | `/carnet` (con carnet creado), bajo «Tus respuestas» | El botón «🔎 Descubre otro miembro BOIA»; si no hay nadie, el mensaje de vacío |
| Carnet: artista | `/carnet/<id>` de un artista | Dos botones bajo las respuestas: «Descubre un artista» y «Descubre otro miembro BOIA» |
| Explanada | `/mar?cerca=explanada` (móvil y escritorio) | Isla con el mosaico ondulado, palmeras, bancos, farolas; **sin rótulo** |
| Explanada de lejos | `/mar`, alejarse de la isla | La silueta de la Explanada (versión a mano) en el mismo sitio |
| Admin: migraciones | Supabase de dev | Ver la tabla de «Migraciones» |

## E2E

Las corres tú (política del plan). Primera vez en una carpeta:
`pnpm --filter @boia/web exec playwright install chromium`. Puertos 3215 y 3216 ocupados.

Specs que tocaron las tareas (collected de las secciones de `ESTADO.md`). Ninguna se ha corrido:

| Tarea | Specs | Qué mirar |
|---|---|---|
| T246 | `admin.spec.ts` | Comprobación general del Admin; no hay spec de la barra de géneros |
| T247 | `merchandise.spec.ts`, specs de radio y landing que miren el texto «Música» en móvil | El botón ya no tiene texto visible en móvil |
| T248 | `admin.spec.ts`, `admin-papelera.spec.ts`, `eventos.spec.ts`, `landing.spec.ts` | Próximo evento, eventos y papelera tras la renovación de la muestra |
| T249 | `merchandise.spec.ts`, `admin-enlaces.spec.ts` | Cuentan productos desde `MERCHANDISE_PRODUCTS`; `admin-enlaces` usa `[data-sale="reserve"]` (la camiseta sigue en reserva) |
| T250 | `galeria.spec.ts` | Cuenta las fotos de la galería |
| T251 | `carnet.spec.ts`, `carnet-requerido.spec.ts` | Los botones nuevos no cambian lo que comprueban |
| T252 | ninguna | `?cerca=explanada` queda listo para una spec |
| T255 | `admin.spec.ts` | Comprobación general del Admin |
| T256 | `merchandise.spec.ts`, `admin-enlaces.spec.ts`, `mundo-arcilla.spec.ts` | Ninguna nombra la tote de muestra |
| T257 | `admin.spec.ts` | Comprobación general del Admin (no hay spec de los archivos que faltan) |

Comando sin Supabase, todas juntas:

```sh
E2E_PORT=<libre> pnpm e2e \
  admin.spec.ts admin-papelera.spec.ts eventos.spec.ts landing.spec.ts \
  merchandise.spec.ts admin-enlaces.spec.ts galeria.spec.ts \
  carnet.spec.ts carnet-requerido.spec.ts mundo-arcilla.spec.ts \
  --workers=2
```

Con Supabase, después de las migraciones: `E2E_SUPABASE=1 E2E_PORT=<libre> pnpm e2e admin-real.spec.ts --workers=1`.

## Migraciones

**Estado real en `boia-planet-dev` (T253, 2026-10-09).** Las doce pendientes están aplicadas, en
este orden. Las 23 anteriores ya estaban.

| Orden | Migración | Resultado |
|---|---|---|
| 1 | `20261007100200_moderation` | aplicada |
| 2 | `20261007100400_admin_access_export` | aplicada |
| 3 | `20261008100100_event_fields_common_code` | aplicada |
| 4 | `20261008100200_artist_music` | aplicada tras arreglarla (ver nota) |
| 5 | `20261008100300_door_stamps` | aplicada |
| 6 | `20261008100400_gallery_clips` | aplicada |
| 7 | `20261008100500_calitas` | aplicada |
| 8 | `20261008100600_admin_limits_analytics` | aplicada (antes: `staff_roles` con 0 filas admin/owner, así que se siguió) |
| 9 | `20261008200100_carnet_answer_music_moderation` | aplicada |
| 10 | `20261008200200_member_party_trash` | aplicada |
| 11 | `20261009100100_radio` | aplicada |
| 12 | `20261009100200_radio_genre_optional` | aplicada (nueva, de T255) |

**Nota sobre la 4.** En el primer intento falló porque el `check` de `music_url` ya se llamaba
`carnets_music_url_check`. Se renombró el segundo `check` (el de enlace https de la plataforma) a
`carnets_music_url_platform_check`. Mismas reglas; ningún código usaba el nombre. La migración
no estaba aplicada en ningún sitio, así que se editó el archivo.

**Tipos.** `pnpm db:types:dev` regenerado y commiteado. `radio_songs.genre_id` pasa a ser nullable.

**`pnpm test:supabase` sigue en rojo, y no es por las migraciones.** Tres causas:

1. **Límite de Auth de Supabase** (`verifyOtp: Request rate limit reached`): unos diez archivos.
   Se arregla esperando o subiendo el límite en el panel del proyecto dev.
2. **`schema.supabase.ts` (dos aserciones viejas)**: dice que `anon` sólo ejecuta RPC de lectura
   y que las funciones SECURITY DEFINER viven en `private`. Ahora `anon` puede ejecutar
   `admin_sign_in_email` y `calitas_list`, y en `public` están `admin_sign_in_email`,
   `discount_code_for`, `radio_set_first` y `radio_reorder`. O la prueba está vieja o es un
   problema de seguridad: ver la propuesta de seguridad abajo.
3. **`admin-limits.supabase.ts`**: la prueba degrada al único owner y choca con el disparador de
   «último propietario». Por eso queda en dev una cuenta de prueba `@example.test` con rol owner
   que no se puede borrar: hay que quitarla a mano, con un owner más delante.

## Propuestas para el siguiente plan

En orden de prioridad:

1. **Seguridad (primero).** `anon` puede ejecutar `admin_sign_in_email` y `calitas_list`; hay cuatro
   funciones SECURITY DEFINER en `public` (`admin_sign_in_email`, `discount_code_for`,
   `radio_set_first`, `radio_reorder`). Revisar los permisos y mover o restringir lo que no deba
   ser público. Es lo que más pesa antes de tener datos reales.
2. **Tests de Supabase en verde**: actualizar las aserciones viejas de `schema.supabase.ts`,
   arreglar la prueba de `admin-limits` (degradar al único owner) y quitar la cuenta
   `@example.test` de dev (a mano, con otro owner delante).
3. **Radio en Supabase**: el «Archivo no encontrado» (T257) se comprueba con un HEAD a la URL
   pública; confirmar con un objeto real borrado en `boia-planet-dev` que la respuesta es 404 o 400.
4. **Descubre con cuentas**: la lista del descubrimiento sigue siendo la del ranking (T251); los
   Carnets reales de Supabase no entran todavía.
5. **Explanada**: si Álvaro quiere otra lectura del paseo (cuatro hileras de palmeras, más boias o
   un quiosco), es tocar `explanada.py` y reexportar. Una e2e con `?cerca=explanada`.
6. **Entorno**: con `.env.local` en el worktree, `pnpm demo` arranca en modo Supabase, no en local
   (T246). Dejar claro qué modo arranca cada comando.

## Preguntas abiertas para Álvaro

1. **Derechos de las fotos de la galería.** Sobre todo `galeria-4`, que es una portada de disco
   ajena. ¿Se puede usar? ¿Con qué crédito? Todo sigue `muestra` hasta entonces.
2. **Copy del tote y la camiseta.** ¿Está bien «Hecha a mano por Manu Ropero»? ¿Quiere otra
   descripción del tote y de la camiseta («Algodón 220 g, en blanco, arena o negro»)?
3. **«Packs de pegatinas».** ¿Se queda como muestra o se quita como la tote de muestra (T256)?
4. **Explanada.** ¿Le convence el paseo tal como sale, o quiere más palmeras, boias o un quiosco?
   La isla se queda sin nombre.

## Lo que hace Hernán

- Revisar los dos «Próximo evento» (ordenador y móvil) tras cargar una vez la web.
- Probar la radio, la tienda, la galería, el carnet y la Explanada en móvil (390×844) y escritorio.
- Correr las e2e de la lista de arriba (no se han corrido).
- Aplicar a mano en `boia-planet-dev` lo que quede: la cuenta `@example.test` de owner, si quieres
  quitarla.
- Decidir si se publica: el push y el despliegue son tuyos.
- Contestar las preguntas de Álvaro cuando tengas sus respuestas.

## Qué contestar

1. **Explanada**: ¿se ve como la imaginaste, o quieres más elementos? (ver T252).
2. **Tote y camiseta**: ¿el copy y los precios están bien? (los precios y el nombre de Manu Ropero
   son reales).
3. **Galería**: ¿las cuatro fotos se quedan en `/galeria` como muestra?
4. **Pegatinas**: ¿se queda «Packs de pegatinas» o sale?

## Notas

(Espacio para tus respuestas.)
