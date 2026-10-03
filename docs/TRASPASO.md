# Traspaso

Dónde está BOIA.PLANET y qué queda, para quien llegue sin contexto. Estado a
2026-10-03, con los planes 001–007 cerrados y el 008 (cuentas por email con
Supabase, el Carnet como carné de identidad, sellos por QR, rankings y
botellas globales, Admin con TOTP) construido entero (último commit de
código: `347ed9c`, T94). El detalle de cada tarea está en `ESTADO.md`; las
reglas, en [`CLAUDE.md`](../CLAUDE.md).

## En una pantalla

- **Qué hay:** la **versión de prueba** (D-20) completa y desplegada en
  https://boia-planet-roan.vercel.app (**temporal** hasta el dominio
  definitivo). La producción corre en **modo local**: todo vive en el
  navegador del visitante, sin cuentas, sin correo y sin ticketera real. El
  contenido es `muestra` (inventado o sin aprobar).
- **Las cuentas del plan 008** están construidas y probadas contra el
  proyecto de desarrollo `boia-planet-dev`: con las variables de Supabase,
  el email se pide al guardar algo (código de 6 cifras, sin enlace), lo de
  valor vive en la base, los sellos llegan por el QR de la fiesta, los
  rankings y las botellas son de todos y `/admin` pide código + TOTP. Sin
  las variables, la web es la de siempre, así que publicar `main` no cambia
  nada. Activarlas en producción es una lista de Hernán
  ([propuestas/2026-10-03-produccion-supabase.md](propuestas/2026-10-03-produccion-supabase.md)).
- **La landing (plan 007)** es un solo scroll: el planeta en reposo con
  «Zarpar» y «Entradas»; al bajar, la cámara se zambulle en el mar junto al
  puerto y avanza sobre el agua de la hora dorada a la noche, con los bloques
  encima como bandas oscuras. **Pesa 185,5 kB** gzip en su ruta crítica, con
  el tope en 200 kB (abajo).
- **Pruebas en `main`:** `pnpm test && pnpm typecheck && pnpm lint && pnpm
  build` salen con 0 (vitest 127 archivos, 1108 pruebas, más los
  comprobadores de Python), en modo local. Contra `boia-planet-dev`,
  `pnpm test:supabase` (8 archivos, 76 pruebas en T94) y las e2e con
  `E2E_SUPABASE=1`. Cada tarea
  del plan 008 pasó sus e2e; la corrida completa de `pnpm e2e` del plan la
  hace el orquestador al cerrarlo (la última completa, T49: 204 pasan, 36
  saltadas, 0 fallan).
- **Requisitos:** de los 294 REQ de la spec v15, **163 HECHO**, 65 PARCIAL,
  31 FALTA, 25 L2, 9 para la versión final y 1 retirado (REQ-ENT-028, D-26)
  ([spec/estado.md](spec/estado.md)). El plan 008 pasó de `final` a HECHO el
  acceso por código, la vuelta al contexto, el progreso del invitado, nada
  competitivo desde el cliente, el alta del propietario, los permisos en la
  base, Supabase con RLS y la identidad pública sin email; y de L2 a HECHO
  los sellos por QR y el ranking global de tiempos.
- **D-26 está en `DECISIONES.md`** (2026-10-03, T85): la landing como scroll;
  cambia D-19, D-21 y D-24 puntos 4 y 5, quita «Saltar animación», tope de
  200 kB. Hernán contestó lo que dejaba abierto: REQ-ENT-028 retirado, bajo
  consumo con `deviceMemory ≤ 2` y el still de 1600 px en móviles verticales.
- **D-27 está en borrador** ([propuestas/2026-10-03-d27-borrador.md](propuestas/2026-10-03-d27-borrador.md),
  T95), pendiente de Hernán: cuentas por email con consentimiento, fusión del
  invitado, botellas globales, sellos por QR y Admin con TOTP. Dice qué
  puntos de D-09, D-10, D-17 y D-20 sustituye, cierra P7 y propone P23–P27.
  `DECISIONES.md` no se ha tocado.
- **Lo que frena publicar de verdad** no es código: son las respuestas y el
  material de Álvaro (abajo) y los servicios de la versión final.

## Qué está construido

| Ruta | Qué es |
|---|---|
| `/` | La landing como un solo scroll (plan 007): aparición del planeta y «BOIA», reposo con «Zarpar» (entra en `/mar`) y «Entradas» (panel de Tickets); el scroll lleva la escena three.js del planeta al mar y los bloques (próximo evento, eventos, artistas, fotos, tienda, contacto, pie con el logo de BOIA y Spotify) suben sobre ella. Versión estática con un still de Blender con movimiento reducido, sin WebGL o en bajo consumo |
| `/mar` | El mundo navegable: un planeta 3D (three.js), dos mundos, Arcilla (B05) y Acuarela (B02), con islas de eventos (Halloween, Sonido y Nochevieja con modelo de Blender), náufragos, descuentos escondidos, cofres, delfín, remolinos, Boia Fiestera, minijuegos Faro, Cañón y el circuito Los Rápidos (sin líneas guía durante la carrera), logros, ranking (local, o global con cuentas: tiempos por circuito y puntos de siempre), botellas (las 10 más recientes de todos, con cuentas), Mi Carnet, tienda de barcos, Tickets dentro del mundo y cambio de mundo por agujero negro |
| `/juego` | Ya no existe (D-25, plan 005 T62): el mundo 2D (PixiJS) se borró y la ruta redirige a `/mar` con su consulta (`?ir=`, `?evento=`, `?menu=`) |
| `/carnet` | Carnet BOIA como carné de identidad (plan 008): tarjeta naranja ID-1, delante el socio con su QR, detrás los sellos como en un pasaporte; con cuentas, «Escanear sello» y «Tu cuenta» (noticias, cerrar sesión, borrar). `/carnet/<id>`: el Carnet público, sin email |
| `/sello` | El QR de una fiesta (`/sello?e=<evento>&c=<código>`, plan 008): con cuentas, pide el email y pone el sello (+50 puntos `muestra`) dentro de la ventana de la fiesta; en modo local explica que hacen falta cuentas |
| `/admin` | Modo local: Admin sin login (D-20): eventos, descuentos, fotos, textos, artistas (con su Spotify), mundo activo, integraciones (sólo lectura), «Volver todo a la muestra». Con cuentas: código del email + TOTP y rol (`pnpm admin:grant`), y Fiestas y QR, Socios y emails, Moderación de botellas y Rankings sobre datos reales |
| `/legal/*` | Aviso legal, privacidad (con cuentas, qué se recoge y para qué) y cookies, con datos **inventados** y aviso arriba |
| `/api/art` | Sirve el arte de `art/` (D-16), también el atrezzo del hero (`art/landing/3d`) |

Stack: monorepo pnpm (Node 24), Next.js 15.5 + React 19 en `apps/web`,
`packages/` (`engine` reglas del mundo sin dibujo: física del barco,
comportamientos, misión, circuito, minijuegos, HUD y la entrada de la
landing; el dibujo 3D está en `apps/web/app/mar/engine/` y, para el hero, en
`apps/web/lib/planeta/`; `world` mundos y comportamientos, `contracts` tipos,
`store` el repositorio local, el del socio sobre Supabase, la economía y el
contenido de muestra, `db` las migraciones, los scripts y las pruebas de
Supabase), `supabase/` (migraciones, muestra y cómo quitarla), arte generado
con Blender sin interfaz desde `tools/blender/` (D-05).

| Plan | Qué cerró |
|---|---|
| [001](../plans/001-demo-l1.md) | Primer hito: entrada, landing con entradas, mundo navegable con el barco real. T07 (auth) y las tareas que dependían de ella, saltadas |
| [002](../plans/002-demo-completa.md) | Versión de prueba completa: dos mundos, misiones, comunidad, Admin, desplegable en Vercel |
| [003](../plans/003-mar-planeta.md) | `/mar` como planeta de agua, «Entradas» siempre visible, diálogos legibles, logros que se reclaman |
| [004](../plans/004-cierre-v14.md) | Los huecos del inventario v14 → código: economía de barcos, agujero negro, eventos y descuentos que llevan a su isla, ranking, sonido, endurecimiento del Admin, marca, entrega |
| [005](../plans/005-solo-planeta-3d.md) | Sólo el planeta 3D (D-25): `/juego` borrado y lo suyo pasado a `/mar`; HUD de móvil, Boia Fiestera con premio, minijuegos rehechos, Tickets dentro del mundo, la entrada de la landing en 3D con el planeta de `/mar` y «Zarpar» que entra en el juego (D-24) |
| [006](../plans/006-islas-y-ajustes.md) | Islas de eventos de Blender (Halloween, Sonido, Nochevieja), nombres reales, bienvenida corta, economía, botellas, circuito Los Rápidos, tipografía de títulos (Archivo Expanded, en lugar de Druk) e Inter |
| [007](../plans/007-landing-scroll.md) | La landing como un solo scroll: diseño editorial oscuro (T77), atrezzo y stills de Blender (T78), hero por scroll en three.js (T79), rendimiento (T80), accesibilidad (T81), contenido real sin código (T82), e2e al día (T84), documentos (T83) |
| [008](../plans/008-cuentas-carnet-rankings.md) | Cuentas con Supabase: base, RPC validadas y pruebas contra el proyecto real (T86), diseño del Carnet como carné (T87), líneas guía fuera en la carrera y botellas legibles (T88), acceso con código y consentimiento (T89), el progreso del socio en su cuenta (T90), Carnet carné y sellos por QR (T91), rankings globales (T92), botellas globales (T93), Admin con código + TOTP sobre datos reales (T94), arreglos de `/mar` (T96), documentos y borrador de D-27 (T95) |

## La landing del plan 007

Cómo funciona: README, «La landing: el hero por scroll». Diseño aprobado por
Hernán: [propuestas/2026-10-03-landing-scroll.md](propuestas/2026-10-03-landing-scroll.md)
(v2; la v1, hojas crema y atrezzo low-poly, la rechazó).

- **Peso final: 185,3 kB** gzip de la ruta crítica de `/` (HTML, JS, CSS y
  fuentes precargadas), con el tope en **200 kB** (Hernán lo subió de 192 el
  2026-10-03). Lo mide `apps/web/scripts/landing-budget.mjs` y `pnpm build`
  falla si se pasa. three.js, el atrezzo GLB y los stills cargan aparte y no
  cuentan. Al empezar el plan pesaba 189,6 kB; T79 la subió a 192,4 y T80 la
  bajó a 184,8 (el motor del hero y el panel de Tickets en chunks aparte).
- **Medido en emulación** (T80, Chromium con la CPU a 4× en 375×812, GPU por
  software): p95 de 33,4 ms por fotograma en un scroll del hero al pie, la
  tarea más larga 133 ms. **Accesibilidad** (T81): axe 0 violaciones de
  cualquier impacto en reposo, tras la zambullida, de noche y en el pie;
  contraste medido en píxeles sobre la escena; teclado y foco.

### Qué mide Hernán a mano

En un iPhone (Safari) y un Android medio, con la versión desplegada (https):

1. **La escena sale, no el still.** Con la consola remota,
   `__boiaIntro.quality` da `motion` 0 o 1 y `probeMs[0]` (lo que cuesta un
   fotograma a calidad completa). Si un móvil decente da el still, mirar
   `lowFps` y `navigator.deviceMemory`: desde T85 (D-26) sólo va al still
   por memoria con `deviceMemory ≤ 2`; un Android de 4 GB queda en manos de
   la sonda de fotogramas (`lowFps`).
2. **Scroll rápido de arriba abajo y vuelta:** sin tirones ni saltos de
   maquetación; el planeta y el mar siguen al dedo; al soltar, la imagen no
   se ve más borrosa que en reposo (si se ve, la GPU está en un nivel bajo).
3. **Reposo dos minutos:** el móvil no se calienta ni gasta batería de más
   (DevTools remoto → Performance: pocos fotogramas por segundo en reposo).
4. **Ahorro de datos** activado en Chrome de Android → el still, sin canvas;
   **movimiento reducido** del sistema → el still, nada se mueve solo.
5. **Primera visita con 4G lento:** «Entradas» abre el panel y «Zarpar» lleva
   a `/mar` aunque la escena aún no haya llegado.
6. **El still en vertical:** desde T85 un móvil de DPR ≤ 2 pide el de
   1600 px (`sizes` sigue el recorte de `object-fit: cover`, unos 80 kB más,
   fuera del presupuesto crítico); comprobar que se ve nítido.
7. **Lector de pantalla** (VoiceOver y TalkBack) en el hero y las bandas, y
   **zoom al 200 %**: la matriz de [matriz-dispositivos.md](matriz-dispositivos.md)
   los deja a mano. Apuntar cada móvil en su tabla (REQ-ENT-021, REQ-ARQ-017).

### Qué tiene que aprobar Álvaro

- **El arte del hero**, todo `muestra`: el planeta del reposo (hoy el mundo
  de `/mar` con el grado del hero, más oscuro y a contraluz), el atrezzo de
  Blender (`art/landing/3d`: costa, puerto con balizas y farolas, barco,
  boya) y los stills de la versión estática (`art/landing/hero-still*.webp`).
- **La licencia de Druk Wide Medium** (P20): hasta que la compre, los
  títulos van con Archivo Expanded (README, «Tipografías», cómo cambiarla).
- **El contenido** (P15, P17, P19): enlaces reales (entradas, tienda,
  WhatsApp, Instagram, correo, la lista de Spotify de BOIA y la de cada
  artista), fotos de los artistas y el cartel de BOIA Club · Halloween. Qué
  entregar, en qué formato y dónde va:
  [contenido-real.md](contenido-real.md). Lo real entra en
  `packages/store/src/sample/real-content.ts` sin tocar componentes; mientras
  tanto cada enlace de muestra lleva la marca «MUESTRA».

## Las cuentas del plan 008

Cómo funciona y cómo se monta: README, «Cuentas con Supabase». Decisión:
[borrador de D-27](propuestas/2026-10-03-d27-borrador.md). Diseño aprobado
por Hernán: [propuestas/2026-10-03-carnet.md](propuestas/2026-10-03-carnet.md).

- **Dos modos.** Sin las variables de Supabase, modo local (D-20), el de la
  producción de hoy. Con ellas: el invitado juega igual y el email se pide
  al guardar (Carnet, skin, sello, ranking); lo ganado como invitado pasa a
  la cuenta al entrar, validado; lo de valor sólo se escribe con RPC que
  validan cada acción (topes por acción y día, tiempo mínimo por circuito,
  una vez por sello y descuento).
- **Desarrollo:** `boia-planet-dev`, sus claves en `apps/web/.env.local`
  (fuera de git; `.worktreeinclude` lo copia a cada worktree). SMTP propio
  con Gmail; OTP de 6 cifras y 10 min; URL de Auth con
  `boia-planet-roan.vercel.app` y `localhost:3100`.
- **Scripts:** `pnpm db:migrate:dev`, `pnpm db:types:dev`,
  `pnpm test:supabase`, `E2E_SUPABASE=1 pnpm e2e …`,
  `pnpm admin:grant -- <email> <rol>` y `pnpm db:clean-test-users` (sólo
  desarrollo).

### Qué hace Hernán

1. **Las plantillas de correo en español** en `boia-planet-dev` (ya tiene
   SMTP): lista de producción, paso 5.
2. **Darse el rol** con `pnpm admin:grant -- <su email> owner` y probar
   `/admin` con el TOTP.
3. **Leer y aprobar el borrador de D-27** y pasarlo a `DECISIONES.md`
   (cambiando «borrador D-27» por «D-27» en `docs/spec/`).
4. **Cuando toque publicar con cuentas:** la lista de producción entera
   (proyecto aparte, Vercel, SMTP con Resend y el dominio, plantillas, URL,
   migraciones, propietario, quitar la muestra, copias).

### Qué tiene que aprobar o decidir Álvaro (plan 008)

- **Los textos legales** (P21): la política de privacidad con cuentas, el
  texto de la casilla de noticias y la versión de la política
  (`muestra-2026-10-03`).
- **Los importes de puntos** (P24 del borrador, con P14): los 50 puntos del
  sello, los topes por acción y por día y los tiempos mínimos del circuito.
- **El arte final del Carnet** (P26): la tarjeta naranja ID-1 y los sellos
  de cada fiesta (el Admin ya acepta una imagen por fiesta).
- **El uso de la lista de emails** (P23): qué manda BOIA a quien marcó
  noticias, cada cuánto y con qué herramienta. Hasta entonces el CSV de
  Socios y emails no se usa.

## Qué queda

### Se puede hacer ya (sin Álvaro)

- **Repasar los 65 PARCIAL y 31 FALTA** de [spec/estado.md](spec/estado.md).
  Muchos FALTA piden una revisión, una medición en móvil o un documento, no
  código (p. ej. REQ-PRO-008, REQ-ENT-021, REQ-ARQ-017). REQ-ENT-028
  (subtítulo según promociones) está retirado por D-26; sus textos
  `hero.explore.with*` siguen en el catálogo sin usarse.
- **Matriz de dispositivos:** los casos a mano (áreas seguras, zoom, sin
  conexión, pérdida del contexto gráfico) en
  [matriz-dispositivos.md](matriz-dispositivos.md); sus filas de `/mar`
  siguen citando pruebas del mundo 2D borrado.
- **Propuestas del plan 008** (sección «Proposals» del plan): códigos de
  respaldo y recuperación del TOTP del Admin; pasar a datos reales la
  moderación de Carnets y las demás secciones del Admin; la botella propia
  fuera de las 10 más recientes no flota; tras un sello faltan el conteo de
  puntos y «Ahora eres {rango}» del diseño; en «De siempre» todos los de 0
  puntos empatan en un puesto; un premio diario ganado sin red cuenta para
  el día en que llega; descargar los datos de la cuenta (REQ-IDE-050).
  REQ-IDE-006 y REQ-ARQ-010 se prueban en `*.supabase.ts`, que
  `tools/spec/estado.py` no cuenta como prueba.
- **Propuestas del plan 007** (sección «Proposals» del plan): el Admin no
  edita los enlaces de tienda, contacto y pie; las respuestas del Carnet de
  artista (P17) no tienen campo; `record.spec.ts` y `record-titulo.spec.ts`
  aún pulsan el «Zarpar» viejo; la pista de scroll queda ~7 px bajo las
  píldoras en 1280×800; `/mar` podría tomar el grado cinematográfico del
  hero.
- **i18n:** los diálogos de cada mundo siguen en
  `packages/world/src/worlds/*/skin.ts` (sus claves `world.<mundo>.…` ya
  están en el catálogo, falta que el mundo las lea); los nombres de paletas de
  `/mar` y los mensajes de consola no pasan por i18n.

Las propuestas de cada tarea están en la sección «Proposals» de cada plan.
Varias ya se hicieron en tareas posteriores: comprueba en el código antes de
tomarlas.

### Depende de Álvaro

Tabla completa en [DECISIONES.md](DECISIONES.md), «Preguntas abiertas».

| # | Qué falta |
|---|---|
| — | Aprobar el arte del hero de la landing (planeta en reposo, atrezzo y stills de Blender) y D-26 |
| P2 | Ticketera (candidata Fourvenues, D-06) y su cuenta |
| P3 | Fecha del próximo All Day (el primer evento real es BOIA Club · Halloween, 31-10-2026) |
| P14 | Visto bueno a `/mar` como planeta de agua y al catálogo de logros y premios |
| P15 | Enlaces reales: entradas, tienda, WhatsApp, Instagram, correo, Spotify de BOIA y de cada artista |
| P16 | Códigos de descuento reales con su % |
| P17 | Fotos de los 26 artistas y sus Carnets |
| P18 | Música con licencia, una por mundo |
| P19 | Cartel de BOIA Club · Halloween |
| P20 | Licencia web de Druk Wide Medium (hasta entonces, Archivo Expanded) |
| P21 | Datos legales reales y revisión profesional de los textos legales; ahora también la política de privacidad con cuentas y el consentimiento de noticias |
| P22 | Lectura de los textos del equipo ([propuestas/textos-zonas.md](propuestas/textos-zonas.md)) y de O1–O15 de D-23 |
| P23* | Uso de la lista de emails de quien aceptó noticias (qué, cada cuánto, con qué herramienta) |
| P24* | Importes de puntos y topes del antitrampas (50 puntos por sello, topes por acción y día, tiempos mínimos) |
| P26* | Arte final del Carnet como carné de identidad y de los sellos de cada fiesta |

\* Propuestas en el [borrador de D-27](propuestas/2026-10-03-d27-borrador.md);
entran en `DECISIONES.md` si Hernán lo aprueba. El mismo borrador propone
P25 (qué es una temporada) y P27 (el dominio definitivo) para Hernán.

### Versión final (D-20)

Ya construido en el plan 008, en desarrollo: Supabase (`boia-planet-dev`,
P7 cerrada), el acceso por correo con código (sin enlace, borrador D-27) y
el login del Admin con TOTP. La rama WIP de T07 (`a4c68d3`) ya no es el
punto de partida. Queda: el **proyecto de producción** de Supabase
([lista](propuestas/2026-10-03-produccion-supabase.md)), la ticketera real
con webhook (P2), PostHog, el editor visual del Admin, el dominio y las
cuentas de BOIA, las copias y su restauración probada, y los códigos de
respaldo del TOTP. La lista para publicar es REQ-PRO-020 y la firma Álvaro:
[entrega.md](entrega.md).

## Cosas que conviene saber

- No hace falta ninguna variable de entorno ([.env.example](../.env.example)):
  sin las de Supabase la web corre en modo local. Las de `boia-planet-dev`
  están en `apps/web/.env.local` (nunca en git ni en un chat).
- `pnpm test:supabase`, las e2e con `E2E_SUPABASE=1` y
  `pnpm db:clean-test-users` crean o borran cuentas `@example.test`: sólo
  contra `boia-planet-dev`, nunca contra producción. Sin `E2E_SUPABASE=1`,
  las e2e corren en modo local y las specs de cuentas se saltan.
- `pnpm test` sin filtro corre también los comprobadores de Python
  (`tools/spec/checks.sh`, ~1 min, necesita `python3`). En esta máquina
  (Windows) los planes corren `pnpm exec vitest run --exclude
  '**/packages/db/**'` (las pruebas de `packages/db` piden un Postgres local)
  y `PYTHONUTF8=1`.
- El build falla si la landing pasa de su presupuesto (200 kB gzip; está en
  185,5).
- Vercel: Root Directory `apps/web` con los archivos de fuera incluidos
  (`packages/` y `art/`). Cada push a `main` despliega a producción. Detalle
  en el [README](../README.md).
- Arte de Blender (5.2.2 LTS, sin interfaz): las islas de `/mar` salen de
  `tools/blender/islas/<id>.py` con `export_islas_glb.py`
  ([README](../README.md#islas-de-blender-en-el-mar-3d)); el atrezzo y los
  stills del hero, de `tools/blender/landing/`
  ([README](../README.md#arte-del-hero-de-la-landing-blender)).
- Los worktrees de agentes salen de `HEAD` (`.claude/settings.json`) y copian
  lo que lista `.worktreeinclude`.
- Para seguir con el mismo método: `/orchestrator` con el objetivo del plan
  009 (`.claude/skills/orchestrator/SKILL.md`).
