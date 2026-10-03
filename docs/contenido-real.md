# Contenido real: qué entregar y dónde va

Para Álvaro (qué mandar) y para Hernán (dónde ponerlo). Cubre lo que la web
espera de BOIA para dejar de ser `muestra`: los enlaces (P15), las fotos de
los artistas y de sus Carnets (P17) y el cartel de BOIA Club · Halloween
(P19). Plan 007 T82, 2026-10-03.

## Cómo entra

Todo lo real va en **un solo archivo**:
[`packages/store/src/sample/real-content.ts`](../packages/store/src/sample/real-content.ts)
(`REAL_CONTENT`). El contenido de la web se construye desde él; no hay que
tocar ningún componente.

- **Enlaces.** Cada uno empieza en `null`: es la marca `muestra`. Mientras
  está así, la web usa un enlace de prueba en `example.com` y lo enseña con
  una etiqueta «MUESTRA» pegada al enlace. Se cambia `null` por la URL real
  y la etiqueta desaparece sola (cualquier enlace o correo de `example.com`,
  `example.net` o `example.org` sale marcado, venga del archivo o del Admin).
- **Imágenes.** El archivo va en `apps/web/public/contenido/…` con el nombre
  exacto de la tabla, y su id se añade a la lista correspondiente de
  `REAL_CONTENT` (`artistPhotos`, `eventPosters`). Sin el id en la lista la
  imagen no sale; sin la imagen, `pnpm test` falla y dice cuál falta.
- **Comprobar y publicar.** `pnpm test` (la prueba
  `apps/web/app/(landing)/components/real-content.test.ts` comprueba que
  archivos y listas coinciden y que ningún enlace real es de prueba), commit
  y push a `main`, que despliega en Vercel. Push y despliegue los decide
  Hernán.

**El Admin no publica para todos.** En la versión de prueba (D-20) el Admin
guarda en el navegador de quien lo usa: sirve para ver cómo queda, pero lo
que tienen que ver todos va en el archivo. La columna «Admin» dice qué
campo del Admin corresponde a cada cosa, para probarlo antes.

## Imágenes: formato común

- **WebP**, calidad ~80, sin metadatos. Si Álvaro manda JPG o PNG, Hernán
  lo convierte (por ejemplo `cwebp -q 80 -metadata none entrada.jpg -o
  salida.webp`) y lo recorta a la proporción.
- Nombres en minúsculas, sin espacios ni tildes: los de las tablas.
- Las imágenes se cargan tarde (`loading="lazy"`): no cuentan en el
  presupuesto de la landing, pero el peso máximo es para que un móvil con
  4G no las espere.

## Tabla de entrega

| # | Qué | P | Formato | Peso máx. | Dónde va (archivo) | Admin (sólo este navegador) | Dónde se ve | Mientras no llega |
|---:|---|---|---|---|---|---|---|---|
| 1 | Cartel de BOIA Club · Halloween | P19 | Vertical **3:4**, 900×1200 px (mínimo 600×800), WebP. Lo importante lejos de los bordes 24 px | 200 kB | `apps/web/public/contenido/carteles/halloween-2026.webp` + `'halloween-2026'` en `eventPosters` | Eventos → BOIA Halloween → «Cartel (URL)» = `/contenido/carteles/halloween-2026.webp` | Banda «Próximo evento» de la landing (hueco 3:4, 220×300 en escritorio, encima del texto en móvil), ficha `/eventos/halloween-2026`, ficha del evento en `/mar` | Hueco oscuro con «Cartel próximamente» |
| 2 | Carteles de SONIDO y BOIA Nochevieja (cuando existan) | P19 | Igual que el 1 | 200 kB | `…/carteles/sonido-2026.webp`, `…/carteles/nochevieja-2026.webp` + su id en `eventPosters` | Eventos → el evento → «Cartel (URL)» | Igual que el 1 cuando es el evento prioritario; su ficha y su isla | «Cartel próximamente» |
| 3 | Foto de cada artista (los 26) | P17 | **Cuadrada 1:1**, 400×400 px (mínimo 256×256), WebP, la cara centrada: se ve en un círculo y en blanco y negro en la landing | 40 kB | `apps/web/public/contenido/artistas/<id>.webp` (id en la tabla de abajo) + el id en `artistPhotos` | Artistas → el artista → «Foto (ruta o URL, opcional)» = `/contenido/artistas/<id>.webp` | Fila del artista en la banda Artistas (48 px), `/artistas` (64 px), su Carnet de artista en `/mar` | Banda: sólo el nombre. `/artistas` y Carnet: avatar neutro con las iniciales |
| 4 | Foto del Carnet de cada artista | P17 | Es la misma foto del 3: no se entrega aparte | — | La del 3 | La del 3 | Carnet del artista (72 px) | Avatar neutro |
| 5 | Respuestas del Carnet de cada artista (las preguntas del Carnet) | P17 | Texto, una respuesta por pregunta | — | **Todavía no tiene sitio**: los Carnets de artista no llevan respuestas (nadie contesta por un artista). Hace falta código: pedirlo cuando lleguen | — | — | Carnet sin respuestas |
| 6 | Foto del Carnet de un visitante | — | No se entrega: la sube cada visitante desde su Carnet (se guarda en su navegador, ≤ 300 kB) | — | — | Moderación → ocultar foto | Su Carnet | Avatar neutro que elige |
| 7 | Enlace de entradas de cada evento | P15 | URL `https://` de la página del evento en la ticketera | — | `links.tickets['halloween-2026']`, `['sonido-2026']`, `['nochevieja-2026']` | Eventos → el evento → «Enlace de entradas» | «Comprar entradas» sin JavaScript. Con JavaScript la versión de prueba abre la compra de prueba (D-20) hasta que haya ticketera (P2) | Enlace de prueba; la compra dice que es de prueba |
| 8 | Tienda | P15 | URL `https://` de la tienda | — | `links.store` | — | Banda Tienda, «Ir a la tienda» | Enlace de prueba marcado «MUESTRA» |
| 9 | WhatsApp | P15 | URL de invitación al grupo (`https://chat.whatsapp.com/…`) o del chat (`https://wa.me/34…`) | — | `links.whatsapp` | — | Invitación del pie, Contacto, la boia de WhatsApp en `/mar` | Marcado «MUESTRA» |
| 10 | Instagram | P15 | URL del perfil (`https://www.instagram.com/<cuenta>`) | — | `links.instagram` | — | Cabecera y pie | Marcado «MUESTRA» |
| 11 | TikTok | P15 | URL del perfil (`https://www.tiktok.com/@<cuenta>`) | — | `links.tiktok` | — | Pie | Marcado «MUESTRA» |
| 12 | Correo de contacto | P15 | La dirección (`hola@…`), sin `mailto:` | — | `links.email` | — | Contacto, «Escríbenos» | `hola@example.com` marcado «MUESTRA» |
| 13 | Lista de BOIA en Spotify | P15 | URL de la lista (`https://open.spotify.com/playlist/…`) | — | `links.spotifyPlaylist` | — | «Escúchalo en Spotify» en Artistas y en el pie | Marcado «MUESTRA» |
| 14 | Spotify de cada artista | P15 | URL del artista (`https://open.spotify.com/artist/…`), o «no tiene» | — | `links.artistSpotify['<id>']`: la URL, o `null` si no tiene (sin enlace). Un artista que no está en la lista sigue con el de prueba | Artistas → el artista → «Spotify (URL, opcional)» | «Spotify» al final de la fila del artista | Uno de cada dos artistas con enlace de prueba marcado «MUESTRA» |

Los enlaces son enlaces normales que se abren en otra pestaña: la web no
carga nada de Spotify, Instagram ni WhatsApp.

## Ids de los artistas (nombre del archivo de la foto)

La foto de cada artista se llama `<id>.webp`. El id sale del nombre (sin
tildes, minúsculas, guiones). Si se añade un artista desde el Admin, su id
es el mismo cálculo sobre su nombre.

| Artista | id |
|---|---|
| Alba Fitz | `alba-fitz` |
| Amenaza Verde | `amenaza-verde` |
| Casta Diva | `casta-diva` |
| DJ Alpina | `dj-alpina` |
| DJ Sacred | `dj-sacred` |
| EGFNK | `egfnk` |
| Franco Maltratto | `franco-maltratto` |
| Koko Moreno | `koko-moreno` |
| Las Precarias de Torrevieja | `las-precarias-de-torrevieja` |
| Latin Master X | `latin-master-x` |
| Manija | `manija` |
| Marabina | `marabina` |
| Moglia (Live) | `moglia-live` |
| Nacho Age | `nacho-age` |
| Nat | `nat` |
| Pollo Can Fly | `pollo-can-fly` |
| The Rancho Cashmere Band | `the-rancho-cashmere-band` |
| RBS | `rbs` |
| RKVX | `rkvx` |
| Soviet Gym | `soviet-gym` |
| Spowy | `spowy` |
| Stonzze | `stonzze` |
| Tere Ling | `tere-ling` |
| Tonitto | `tonitto` |
| Torvik | `torvik` |
| Wet Kisses | `wet-kisses` |

## Ejemplo

Llegan el cartel de Halloween, la foto de Alba Fitz y el Instagram:

1. `apps/web/public/contenido/carteles/halloween-2026.webp` y
   `apps/web/public/contenido/artistas/alba-fitz.webp`.
2. En `real-content.ts`: `eventPosters: ['halloween-2026']`,
   `artistPhotos: ['alba-fitz']`, `instagram: 'https://www.instagram.com/<cuenta>'`.
3. `pnpm test`, commit, push (Hernán).

Lo demás sigue `muestra` y marcado hasta que llegue.
