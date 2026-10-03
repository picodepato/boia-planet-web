# Traspaso

Dónde está BOIA.PLANET y qué queda, para quien llegue sin contexto. Estado a
2026-10-03, con los planes 001–006 cerrados y el 007 (la landing como un solo
scroll) construido entero (último commit de código: `e161ba6`, T82). El
detalle de cada tarea está en `ESTADO.md`; las reglas, en
[`CLAUDE.md`](../CLAUDE.md).

## En una pantalla

- **Qué hay:** la **versión de prueba** (D-20) completa y desplegada en
  https://boia-planet.vercel.app. Todo vive en el navegador del visitante:
  sin servidor, sin cuentas, sin correo y sin ticketera real. El contenido es
  `muestra` (inventado o sin aprobar).
- **La landing (plan 007)** es un solo scroll: el planeta en reposo con
  «Zarpar» y «Entradas»; al bajar, la cámara se zambulle en el mar junto al
  puerto y avanza sobre el agua de la hora dorada a la noche, con los bloques
  encima como bandas oscuras. **Pesa 185,3 kB** gzip en su ruta crítica, con
  el tope en 200 kB (abajo).
- **Pruebas en `main`:** `pnpm test && pnpm typecheck && pnpm lint && pnpm
  build` salen con 0 (vitest 112 archivos, 1000 pruebas, más los
  comprobadores de Python). Cada tarea del plan 007 pasó sus e2e; la corrida
  completa de `pnpm e2e` del plan la hace el orquestador al cerrarlo (la
  última completa, T49: 204 pasan, 36 saltadas, 0 fallan).
- **Requisitos:** de los 294 REQ de la spec v15, **151 HECHO**, 64 PARCIAL,
  32 FALTA, 28 L2 y 19 para la versión final
  ([spec/estado.md](spec/estado.md)).
- **Decisión pendiente de pasar:** el borrador de **D-26** (la landing como
  scroll; cambia D-19, D-21 y D-24 punto 4, quita «Saltar animación», tope de
  200 kB) está en
  [propuestas/2026-10-03-D-26-borrador.md](propuestas/2026-10-03-D-26-borrador.md).
  Lo pasa Hernán a `DECISIONES.md`.
- **Lo que frena publicar de verdad** no es código: son las respuestas y el
  material de Álvaro (abajo) y los servicios de la versión final.

## Qué está construido

| Ruta | Qué es |
|---|---|
| `/` | La landing como un solo scroll (plan 007): aparición del planeta y «BOIA», reposo con «Zarpar» (entra en `/mar`) y «Entradas» (panel de Tickets); el scroll lleva la escena three.js del planeta al mar y los bloques (próximo evento, eventos, artistas, fotos, tienda, contacto, pie con el logo de BOIA y Spotify) suben sobre ella. Versión estática con un still de Blender con movimiento reducido, sin WebGL o en bajo consumo |
| `/mar` | El mundo navegable: un planeta 3D (three.js), dos mundos, Arcilla (B05) y Acuarela (B02), con islas de eventos (Halloween, Sonido y Nochevieja con modelo de Blender), náufragos, descuentos escondidos, cofres, delfín, Boia Fiestera, minijuegos Faro, Cañón y el circuito Los Rápidos, logros, ranking local, botellas, Mi Carnet, tienda de barcos, Tickets dentro del mundo y cambio de mundo por agujero negro |
| `/juego` | Ya no existe (D-25, plan 005 T62): el mundo 2D (PixiJS) se borró y la ruta redirige a `/mar` con su consulta (`?ir=`, `?evento=`, `?menu=`) |
| `/carnet` | Carnet BOIA (perfil del visitante) |
| `/admin` | Admin sin login (D-20): eventos, descuentos, fotos, textos, artistas (con su Spotify), mundo activo, integraciones (sólo lectura), «Volver todo a la muestra» |
| `/legal/*` | Aviso legal, privacidad y cookies, con datos **inventados** y aviso arriba |
| `/api/art` | Sirve el arte de `art/` (D-16), también el atrezzo del hero (`art/landing/3d`) |

Stack: monorepo pnpm (Node 24), Next.js 15.5 + React 19 en `apps/web`,
`packages/` (`engine` reglas del mundo sin dibujo: física del barco,
comportamientos, misión, circuito, minijuegos, HUD y la entrada de la
landing; el dibujo 3D está en `apps/web/app/mar/engine/` y, para el hero, en
`apps/web/lib/planeta/`; `world` mundos y comportamientos, `contracts` tipos,
`store` el repositorio local, la economía y el contenido de muestra, `db` el
esquema de Supabase para la versión final), arte generado con Blender sin
interfaz desde `tools/blender/` (D-05).

| Plan | Qué cerró |
|---|---|
| [001](../plans/001-demo-l1.md) | Primer hito: entrada, landing con entradas, mundo navegable con el barco real. T07 (auth) y las tareas que dependían de ella, saltadas |
| [002](../plans/002-demo-completa.md) | Versión de prueba completa: dos mundos, misiones, comunidad, Admin, desplegable en Vercel |
| [003](../plans/003-mar-planeta.md) | `/mar` como planeta de agua, «Entradas» siempre visible, diálogos legibles, logros que se reclaman |
| [004](../plans/004-cierre-v14.md) | Los huecos del inventario v14 → código: economía de barcos, agujero negro, eventos y descuentos que llevan a su isla, ranking, sonido, endurecimiento del Admin, marca, entrega |
| [005](../plans/005-solo-planeta-3d.md) | Sólo el planeta 3D (D-25): `/juego` borrado y lo suyo pasado a `/mar`; HUD de móvil, Boia Fiestera con premio, minijuegos rehechos, Tickets dentro del mundo, la entrada de la landing en 3D con el planeta de `/mar` y «Zarpar» que entra en el juego (D-24) |
| [006](../plans/006-islas-y-ajustes.md) | Islas de eventos de Blender (Halloween, Sonido, Nochevieja), nombres reales, bienvenida corta, economía, botellas, circuito Los Rápidos, tipografía de títulos (Archivo Expanded, en lugar de Druk) e Inter |
| [007](../plans/007-landing-scroll.md) | La landing como un solo scroll: diseño editorial oscuro (T77), atrezzo y stills de Blender (T78), hero por scroll en three.js (T79), rendimiento (T80), accesibilidad (T81), contenido real sin código (T82), e2e al día (T84), documentos (T83) |

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
   `lowFps` y `navigator.deviceMemory`: un Android de 4 GB va al still por la
   regla `deviceMemory ≤ 4`; decidir si se queda así (está en el borrador de
   D-26).
2. **Scroll rápido de arriba abajo y vuelta:** sin tirones ni saltos de
   maquetación; el planeta y el mar siguen al dedo; al soltar, la imagen no
   se ve más borrosa que en reposo (si se ve, la GPU está en un nivel bajo).
3. **Reposo dos minutos:** el móvil no se calienta ni gasta batería de más
   (DevTools remoto → Performance: pocos fotogramas por segundo en reposo).
4. **Ahorro de datos** activado en Chrome de Android → el still, sin canvas;
   **movimiento reducido** del sistema → el still, nada se mueve solo.
5. **Primera visita con 4G lento:** «Entradas» abre el panel y «Zarpar» lleva
   a `/mar` aunque la escena aún no haya llegado.
6. **El still en vertical:** en un móvil de DPR ≤ 2 se ve blando (pide el de
   800 px y lo estira); decidir si se cambia (`sizes="max(100vw, 160vh)"`,
   unos 80 kB más en móvil, fuera del presupuesto crítico).
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

## Qué queda

### Se puede hacer ya (sin Álvaro ni Supabase)

- **Pasar D-26 a `DECISIONES.md`** (Hernán) desde el borrador.
- **Repasar los 64 PARCIAL y 32 FALTA** de [spec/estado.md](spec/estado.md).
  Muchos FALTA piden una revisión, una medición en móvil o un documento, no
  código (p. ej. REQ-PRO-008, REQ-ENT-021, REQ-ARQ-017). REQ-ENT-028
  (subtítulo según promociones) se quedó sin sitio en el hero: retirarlo o
  moverlo (borrador D-26).
- **Matriz de dispositivos:** los casos a mano (áreas seguras, zoom, sin
  conexión, pérdida del contexto gráfico) en
  [matriz-dispositivos.md](matriz-dispositivos.md); sus filas de `/mar`
  siguen citando pruebas del mundo 2D borrado.
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
| P21 | Datos legales reales y revisión profesional de los textos legales |
| P22 | Lectura de los textos del equipo ([propuestas/textos-zonas.md](propuestas/textos-zonas.md)) y de O1–O15 de D-23 |

### Versión final (D-20)

Supabase (proyecto `boia-planet-dev`, P7: lo crea Hernán; el esquema ya está
en `supabase/migrations/`), acceso por correo con código y enlace (D-10),
login del Admin con TOTP, ticketera real con webhook, PostHog, editor visual
del Admin, dominio y cuentas de BOIA, copias y restauración. La lista para
publicar es REQ-PRO-020 y la firma Álvaro: [entrega.md](entrega.md).

La auth de T07 (OTP + enlace, sesión de invitado, fusión idempotente, dos
migraciones) quedó a medias en la rama `worktree-agent-a208530713932c80c`
(commit `a4c68d3`, «T07: WIP»). Es el punto de partida de la versión final.

## Cosas que conviene saber

- No hace falta ninguna variable de entorno ([.env.example](../.env.example)).
- `pnpm test` sin filtro corre también los comprobadores de Python
  (`tools/spec/checks.sh`, ~1 min, necesita `python3`). En esta máquina
  (Windows) los planes corren `pnpm exec vitest run --exclude
  '**/packages/db/**'` (las pruebas de `packages/db` piden un Postgres local)
  y `PYTHONUTF8=1`.
- El build falla si la landing pasa de su presupuesto (200 kB gzip; está en
  185,3).
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
  008 (`.claude/skills/orchestrator/SKILL.md`).
