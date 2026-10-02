# Decisiones vigentes

Escribe el orquestador. Prevalece sobre `docs/spec/` y sobre la v14. Cada
decisión lleva fecha, quién la tomó y qué la respalda. Lo que aquí dice
"pendiente Álvaro" o "pendiente Hernán" es una propuesta con la que se avanza
hasta que se conteste; si la respuesta la cambia, se anota aquí con fecha.

## Cómo se lee la v14

`docs/fuente/v14-maestro.md` es el documento maestro de Álvaro, íntegro. Es
un registro de 14 revisiones, no una spec limpia: la misma decisión aparece
en varias secciones con matices. Regla de precedencia dentro de la v14:
§49 y §4.4 > §48 y §46 > el resto. Las secciones §29, §38 y §41 son
históricas y no generan requisitos. Las dos secciones sin número que siguen
a la §47 se citan aquí como **§47-A** (ajustes de pacing) y **§47-B**
(decisión final de entrada automática).

## D-01 · Repositorio: se empieza de cero aquí · 2026-09-28 · confirmado por Hernán

La v14 se contradice: la introducción y §49.5 dicen "conservar el repositorio",
el Prompt 1 dice "iniciar desde cero". En este Mac no hay ningún repo del
piloto y la carpeta del proyecto estaba vacía. Se construye desde cero en
`/Users/heralc/Desktop/boia.planet`. Si el piloto aparece, es referencia
visual y funcional (§45 lo audita), nunca base de código.

## D-02 · Alcance: tres lanzamientos, no uno · 2026-09-28 · orquestador · pendiente Álvaro

La v14 mete casi todo en "lanzamiento" (§32: 16 fases, 14 en CLAVE; §49.11
incluye Faro y Cañón). Eso es más de un año de trabajo sin fecha. Se corta así:

**Lanzamiento 1 (L1) — lo que vende entradas y hace sentir el universo:**
- Entrada cinemática planeta→mar→landing (§4.4, ENT 01–06) y landing HTML por
  bloques con evento prioritario, próximos eventos, artistas rotativos, filosofía,
  fotos, tienda como enlace externo y contacto.
- Tickets con estados de evento (§49.4), evento e isla separados, ficha
  compartible, adaptador de ticketera (sandbox hasta que Álvaro contrate).
- Mundo 2.5D: barco por capas, joystick táctil desde el punto tocado, drift con
  segundo dedo, teclado, agua viva, estela, sectores, costas, minimapa.
- Objetos modulares (§48) con catálogo inicial: colisión (bloquear, rebotar,
  frenar, ralentizar, boost), proximidad, diálogo, recogible, recompensa,
  contenido, ticket, checkpoint, teletransporte, spawn, logro, decorativo.
- Aventura: boia tutorial, misión Fiestera completa con cocodrilos, islas por
  proximidad con recuerdos y próximos eventos, náufrago con descuento, restos,
  cofres, delfín, remolino, botellas (una por cuenta, 140 caracteres),
  circuito con récord personal local.
- Identidad: invitado con progreso local, cuenta por email (OTP + enlace),
  fusión idempotente, Carnet con las 5 preguntas de §44.1, sellos por compra
  confirmada, logros, puntos y monedas separados, Mi Barco con color y
  cosméticos básicos, ranking de puntos.
- Admin L1: login con contraseña + segundo factor, roles propietario/admin/
  editor, eventos, bloques de home, artistas, fotos, editor visual del mundo
  con borrador/previsualización/publicación/restauración, logros por triggers,
  moderación de botellas, textos.
- Idioma: español. Estructura i18n lista; inglés en L2 (ver D-03).

**Lanzamiento 2 (L2):** Vigilancia del faro, Cañón contra tiburones, ranking
global de circuito con validación de servidor, encuestas voluntarias, Mensajes
de BOIA, logros globales retroactivos y concesiones masivas, perfiles oficiales
reclamables, duplicado de temporadas, check-in por QR, motor de promociones
(primera compra, pegatina WhatsApp, exclusivos), tienda con checkout propio,
inglés, exportación y borrado de cuenta desde la web. (2026-09-28: D-20
adelanta Vigilancia del faro y Cañón contra tiburones a L1.)

**Diferido sin fecha (ya lo decía la v14):** fotos personales por evento, mini
blog, relaciones Bolleros, mensajería privada (nunca), corrientes musicales.

Un requisito de L2 se diseña en la arquitectura de L1 (tablas, módulos, IDs)
sólo si no hacerlo obligaría a migrar datos después. No se implementa.

## D-03 · Idioma de L1: español · 2026-09-28 · orquestador · pendiente Álvaro

El público es Alicante; el inglés duplica todo el copy administrable (§31.2
tiene 18 zonas de texto). i18n en código desde el principio (claves, no
cadenas), contenido sólo en ES hasta L2.

## D-04 · Stack · 2026-09-28 · orquestador · pendiente Hernán

- Monorepo `pnpm` con TypeScript estricto: `apps/web` (Next.js, App Router:
  landing, tickets, Carnet y Admin como grupo de rutas), `packages/engine`
  (renderizador PixiJS v8 + motor propio de comportamientos, sin Phaser),
  `packages/world` (esquema del mundo con zod, compartido por motor y editor:
  lo que el editor coloca aparece en el mismo sitio al jugar), `packages/contracts`.
- Supabase: Postgres con RLS, Auth por email (OTP de 6 dígitos y enlace
  mágico), Storage para assets y fotos, Edge Functions para webhooks y
  validaciones, `pg_cron` para transiciones de estado de eventos.
- Vercel para `apps/web`. Dominio y cuentas a nombre de BOIA (§49.18).
- Analítica del embudo: PostHog (nube UE) con eventos `landing_view`,
  `explore_start`, `discount_found`, `tickets_panel_open`, `ticket_click_out`,
  `purchase_confirmed` (este último sólo desde webhook de la ticketera).
- Por qué no Phaser: la física es trivial (barco, drift, colisiones simples) y
  el modelo de objetos de §48 pide un motor propio; Phaser añadiría un segundo
  sistema de escenas que el Admin no comparte.
- Se confirma o ajusta en el ADR del encargo de stack; sólo cambia si una
  prueba lo contradice.

## D-05 · Producción de arte: Blender sin interfaz, no MCP · 2026-09-28 · orquestador

El riesgo número uno del proyecto es el barco: ocho direcciones, tres skins,
pasajera a bordo y estela coherente (§49.17), con todos los sprites marcados
"IA/ilustrador" en §34. Se valida antes de escribir motor.

- **Pipeline elegido:** modelo 3D estilizado en Blender → sombreado toon con
  contorno → cámara ortográfica dimétrica 2:1 → render de 8 direcciones y
  estados → PNG con alfa + manifiesto JSON (ID, versión, direcciones,
  fotogramas, escala, anclajes, pivote, licencia). Cambiar una skin es cambiar
  materiales; añadir una dirección es un render más. Todo por scripts `bpy`
  en `tools/blender/`, ejecutados con `Blender -b -P`, reproducibles desde
  el repo.
- **Blender MCP descartado para producción:** necesita Blender abierto con
  interfaz y un socket vivo; no es reproducible ni sirve por lotes. Puede
  usarse a mano para explorar, nunca como parte del pipeline.
- **Image-to-3D (Tripo, Meshy, Hunyuan3D) como acelerador opcional:** si la
  geometría procedural no da el carácter "ilustrado", una ilustración del
  barco aprobada por Álvaro se convierte a malla y entra en el mismo pipeline
  de Blender. Requiere cuenta y clave: se pide con `pedir-token`, no se crea
  desde una sesión.
- **Seedance 2.5 (vídeo) no produce sprites.** Sirve para un vídeo de
  referencia del storyboard de la entrada (§4.4, ENT 06) y para material de
  marketing. La cinemática real se construye con capas en el motor, como
  exige §4.4; nunca se sustituye por un vídeo.
- Islas, decoración y personajes que no rotan: ilustración 2D de una sola
  vista (generación + retoque), ya que no necesitan direcciones.

## D-06 · Ticketera candidata: Fourvenues · 2026-09-28 · orquestador · pendiente Álvaro

Española (Valencia), orientada a clubs y festivales, con API y webhooks
(`payment.success` con `metadata.internal_id`). Eso permite el sello
automático en el Carnet al confirmar compra (§42.2) sin que el usuario haga
nada. Alternativas a comparar en el ADR: Entradium, Wegow, Eventbrite, DICE.
La contratación, condiciones y cuenta las hace Álvaro; el código usa un
adaptador con sandbox y datos de prueba hasta entonces. Si la ticketera
elegida no tiene webhook, el sello automático no existe y se pasa a QR o
código del email de compra (§42.2 ya lo prevé como vía alternativa).

## D-07 · Valores absolutos que sustituyen a "relativo al prototipo" · 2026-09-28 · orquestador · pendiente Álvaro

La v14 fija tamaños respecto a un prototipo que el equipo nuevo no ve.
Valores iniciales, ajustables tras probar en móvil:

| Elemento | v14 decía | Valor L1 |
|---|---|---|
| Minimapa (§10) | 25–35 % menor que el prototipo | 96 px de lado en móvil, máx. 22 % del ancho; 128 px en escritorio |
| CTA Explorar (§4.2, §46) | el doble de prominente | alto mín. 56 px, ancho completo hasta 480 px de viewport, animación de pulso ≤ 4 % de escala cada 3 s |
| Tickets en hero (§4.2) | "siempre evidente" | botón secundario ≥ 44 px de alto, visible sin scroll en 360×640 |
| Avisos de logro (§14 vs Prompt 1) | ~3–4 s / ~4 s | 4 s, cola, uno a la vez, arriba |
| Diálogos (§7, §47-A) | ~1,5 s | 1,5 s por bocadillo, toque para avanzar o saltar |
| Rotación de artistas (§18) | ~5 s | 5 s |
| Boost de checkpoint (§13) | ~2 s | 2 s |
| Pulsación larga del minimapa (§10) | ~0,5 s | 500 ms |

## D-08 · Contradicciones de la v14 resueltas · 2026-09-28 · orquestador

- Preguntas del Carnet: §16.2 da ejemplos distintos de las cinco de §44.1.
  Valen las cinco de §44.1, textuales.
- "Mi Carta" / "Carta de Navegación" en §21 y §27: es "Mi Carnet" (§46). La
  Carta no existe como pantalla.
- Tabla de §41 (marca "SIGUIENTE" cosas ya cerradas): no vale; vale §42.5 y §44.5.
- §49.11 mete Faro y Cañón en el lanzamiento: pasan a L2 por D-02. Lo que sí
  queda en L1 es el módulo `INICIAR_MINIJUEGO` como punto de extensión vacío
  del catálogo de comportamientos, para no migrar después. (2026-09-28: D-20
  devuelve Faro y Cañón a L1, detrás de ese mismo módulo.)
- Duración de avisos: 4 s (D-07).
- Cinemática: el copy inicial es "BOIA.PLANET" (§47-B); "Bienvenido a BOIA"
  sólo como variante a probar en copy, nunca como pantalla previa.
- "Tripulación" no se usa para relaciones entre usuarios (§44.2, §46);
  "tripulante" sí se usa para la Boia Fiestera a bordo (§8.1), que es otra cosa.
- Prompt 1 pide a la IA "seleccionar la ticketera": la selecciona Álvaro con
  un ADR comparativo delante (D-06).

## D-09 · Anticheat proporcionado · 2026-09-28 · orquestador

Para una comunidad de cientos de personas no se construye validación por
repetición de decisiones (lo que pide el Prompt 3 para los minijuegos).
En L1: récords del circuito sólo locales; recompensas del mundo concedidas
por servidor con sesión firmada, límites de plausibilidad (tiempo mínimo por
logro, cadencia máxima de recogidas) y retirada manual desde Admin. En L2 se
añade ranking global con sesión, semilla y duración verificadas.

## D-10 · Autenticación · 2026-09-28 · orquestador

Público: email con código OTP de 6 dígitos **y** enlace mágico en el mismo
correo. Motivo: el enlace abierto desde el navegador interno de Instagram
pierde la sesión del navegador donde se jugaba; el código no. Admin:
contraseña + TOTP obligatorio, recuperación por correo verificado, sin
contraseña inicial en repo ni en documentos (§49.13).

## D-11 · Método de trabajo · 2026-09-28 · Hernán

Orquestador en Fable 5.1 (esta sesión); sesiones de trabajo en Opus 5.5.
Un encargo, una tarde, un informe. Máximo dos en paralelo sin archivos
compartidos. Hito de revisión con Álvaro en móvil real al cerrar cada fase.

## D-12 · El joystick nace donde toca el primer dedo · 2026-09-28 · orquestador · pendiente Álvaro

El Prompt 1 de la v14 dice "el control táctil nace al tocar el barco". Se
cambia a: el primer dedo crea el joystick en su punto, en cualquier lugar de
la zona de juego. Acertar a un sprite de 64 px en un móvil es frustrante y §25
pide feedback inmediato. Se muestra a Álvaro en el hito 1; si lo prefiere
literal, es un cambio de una condición en el motor.

## D-13 · Cámara a 30° de elevación, no 26,57° · 2026-09-28 · orquestador

Los prompts 01 y 03 decían 26,57°. Es la pendiente de las aristas en pantalla,
no la inclinación de la cámara: con 26,57° el cubo unidad mide 2,236:1. Con
30° mide 1,9998:1 (calibración del 01) y el motor lo reproduce (informe del 03).
Vale 30° en Blender, en `packages/world` y en todo asset futuro.

## D-14 · Teclado con los dos modos · 2026-09-28 · Hernán

Por defecto, dirección de pantalla (flecha arriba lleva el barco hacia arriba,
igual que el joystick). En Controles se puede cambiar a control de tanque
(arriba acelera, izquierda y derecha giran). La preferencia se guarda.

## D-15 · Barco más pequeño · 2026-09-28 · Hernán

El barco pasa de ~64 px a ~48 px de eslora en pantalla (`SHIP_LENGTH` al 75 %)
para ver más mar. Sigue siendo `muestra`; se revisa en el hito 1 con islas
alrededor.

## D-16 · Arte de L1 servido desde el repo · 2026-09-28 · orquestador

Hasta que exista la biblioteca de assets del editor, la web sirve `art/`
directamente (el 03 ya lo hace con la ruta `/api/art/...`). Supabase Storage
entra con el editor de mundo, que es donde Admin sube assets. Motivo: la demo
no necesita servicios y el pipeline de Blender escribe en `art/`.

## D-17 · Base de datos sin Docker · 2026-09-28 · orquestador

En el Mac no hay Docker ni Supabase CLI; sí hay PostgreSQL 17 de Homebrew
corriendo en el puerto 5432, y Hernán ya usa Supabase en la nube para otros
proyectos. Por tanto:
- Esquema, migraciones y pruebas de RLS se ejecutan contra el Postgres local,
  en una base `boia_planet_test`, con un shim compatible con Supabase (roles
  `anon`, `authenticated`, `service_role`; esquema `auth` con `auth.uid()`
  leyendo `request.jwt.claims`). Las migraciones son SQL plano en
  `supabase/migrations/`, aplicables tal cual a un proyecto real.
- Auth, Storage y Edge Functions se prueban contra un proyecto Supabase en la
  nube de desarrollo, `boia-planet-dev`, que crea Hernán. Sus claves entran
  en `.env.local` con la skill `pedir-token`. Si el plan gratuito ya tiene dos
  proyectos activos, Hernán decide si pausa uno o paga.
- Si más adelante se instala OrbStack, se puede pasar a `supabase start` sin
  cambiar las migraciones.

## D-18 · «Boia», con i · 2026-09-28 · Hernán

Se usa la grafía valenciana en todo el proyecto: la boia (femenino, como
antes), plural «boies»: «Boia Fiestera», «boia tutorial», «primera boia».
Vale para la spec, el código, los textos del juego y la documentación.
`docs/fuente/v14-maestro.md` conserva la grafía castellana, con y griega,
porque es texto histórico y no se toca. La carpeta del proyecto en el
Escritorio todavía lleva esa grafía con y; Hernán la renombra a
`/Users/heralc/Desktop/boia.planet` cuando cierre el plan 001, y las rutas
del repo ya apuntan a `boia.planet` desde ahora, antes del cambio. Palabras
que sólo contienen «boy» (el artista Bdboy) no cambian.

## D-19 · Entrada «mini-mundo» con botón y aterrizaje en el mar · 2026-09-28 · Hernán · pendiente Álvaro

Propuesta completa: `docs/propuestas/2026-09-28-intro-mini-mundo.md` (§4 son
las decisiones; §5 a §7, cómo tiene que ser). Sustituye en parte la entrada
de T03 (planeta → mar → landing sin clic). La web empieza como la intro de
messenger.abeto.co: nuestro mundo en miniatura flota y gira, con el título
encima y un botón; al pulsarlo, el mundo gira, se aplana y se aterriza en el
mar sin cortes. Hernán decide:

1. Tras la aparición del mini-mundo hay **un botón para entrar**.
2. El título de la cinemática es **«BOIA»** (wordmark de BOIA), no
   «BOIA.PLANET». (2026-09-28: D-20 lo cambia a letras 3D renderizadas en
   Blender.)
3. **Se aterriza en el mar**, en un punto que es un dato configurable
   (coordenadas del mundo y encuadre por ancho de vista), no código. El punto
   definitivo llega más adelante; mientras tanto vale el encuadre de llegada
   de T03: la isla de evento con el barco en posición segura.
4. **El texto del botón da igual**: uno de muestra («Zarpar», «Entrar»,
   «Vamos») marcado `muestra` en la configuración. El definitivo lo aprueba
   Álvaro.
5. No hay ningún río: «el río» era el mar.

Modifica REQ-ENT-001, REQ-ENT-002, REQ-ENT-003, REQ-ENT-006 y REQ-ENT-007,
que ahora citan D-19. Contradice la entrada sin clic y el título
«BOIA.PLANET» de §4.1, §4.4 y §47-B de la v14. Siguen igual REQ-ENT-004,
REQ-ENT-005 (sin globo 3D, D-05), REQ-ENT-008 a REQ-ENT-012 y la landing
ligera como respaldo (REQ-ENT-017). La técnica del mini-mundo (A: esfera
falsa en Pixi sobre el mundo real; B: giro renderizado en Blender) se decide
con la prueba de fps de la propuesta (§6, §8), que se anota en `ESTADO.md`.

Falta el visto bueno de Álvaro: el flujo de entrada es identidad y negocio
suyos (P9). Hasta que conteste se avanza con esta decisión.

## D-20 · Versión de prueba completa: dos mundos sobre un mapa, todo en el navegador · 2026-09-28 · Hernán · pendiente Álvaro

El plan 002 convierte la demo del plan 001 en una versión de prueba que se
siente final y que Hernán despliega en Vercel para enseñarla en móviles
reales. No es la publicación de REQ-PRO-020: no usa servicios externos (ni
Supabase, ni correo, ni ticketera) y todo su contenido es `muestra`. Hernán
decide:

1. **Se adelantan de L2 los dos minijuegos, un segundo mundo y las
   temporadas como mundos.** Vigilancia del faro y Cañón contra tiburones
   (REQ-AVE-035 a REQ-AVE-039) se construyen detrás de INICIAR_MINIJUEGO,
   con sus islas Faro y Cañón en el mapa. Hay dos mundos: **Arcilla**
   (barco B05, el principal) y **Acuarela** (barco B02), cada uno con sus
   islas, su historia y su estilo de barco, según la exploración «un mapa,
   muchos mundos» de `mundos/` (`mundos/README.md`,
   `mundos/arcilla/diseno.md`). Un mundo es la forma que toma una temporada:
   el Admin elige el mundo activo y el visitante puede cambiar de mundo desde
   el menú. Corrige D-02 y D-08, que dejaban Faro y Cañón en L2. Siguen en
   L2 duplicar temporadas como borrador (REQ-ADM-033) y configurar los
   minijuegos desde el Admin (REQ-ADM-036).
2. **Todo se guarda en el navegador hasta que exista Supabase.** Progreso,
   Carnet, botellas y cambios del Admin viven en el navegador del visitante
   detrás de una interfaz de repositorio con las formas de `packages/db`
   (T06 del plan 001), que Supabase implementará después sin cambiar a quien
   la usa. En esta versión la identidad es un invitado con apodo, sin
   correo; nada se comparte entre visitantes ni entre dispositivos; **cada
   botella sólo la ve quien la escribe** (más unas botellas `muestra`
   sembradas para poder leer); los cambios del Admin sólo los ve quien los
   hace, y las recompensas se validan en local, no en servidor.
3. **Sin ticketera, «Comprar entrada» da el sello directamente.** Abre un
   checkout sandbox rotulado claramente como prueba y, al confirmar, añade el
   sello del evento al Carnet una vez por ID de compra y concede el logro de
   la entrada. Es una excepción de la versión de prueba a REQ-IDE-021 y
   REQ-COM-017 (sólo el webhook confirma una compra); el adaptador de D-06 se
   conserva para que la ticketera real sustituya al sandbox.
4. **El Admin se abre con un botón «Probar admin»**, en el pie de la landing
   y en el menú, sin login, con un aviso permanente de que es una demo y de
   que los cambios se quedan en este navegador. Es una excepción de la
   versión de prueba a REQ-ADM-002 a REQ-ADM-004 (contraseña, TOTP y roles),
   que siguen valiendo para la versión final.
5. **El título «BOIA» de la entrada pasa a letras 3D renderizadas en
   Blender** que se mueven como el título de messenger.abeto.co: suben una a
   una, flotan y se balancean por separado, con un giro leve que coge la luz,
   y se sirven como secuencia de imágenes o sprite sheet. D-05 se mantiene:
   ningún 3D en el navegador. Corrige el wordmark plano de D-19 (punto 2) y
   de REQ-ENT-003.
6. **Tras EXPLORAR, el barco empieza en un puerto.** La cámara se aleja un
   poco (menos que en las primeras versiones) y muestra el puerto de salida
   con el barco dentro, El Varadero en Arcilla; allí están los primeros
   encuentros y desde allí empieza la misión de la Boia Fiestera. El punto de
   aterrizaje de la entrada (D-19, punto 3) sigue siendo un dato aparte; el
   puerto y su encuadre son datos de cada mundo.
7. **Un mapa compartido para todos los mundos.** Un lugar es un punto con ID
   estable (posición, geometría, comportamientos y parámetros) y cada mundo
   aporta su skin: arte, nombre y textos. Mover un lugar lo mueve en todos
   los mundos. Una isla nueva se añade una vez y cada mundo deja sus archivos
   nombrados por mundo (`art/mundos/<mundo>/<lugar>/`). Los nombres son
   comunes, con un nombre propio opcional por mundo; al renombrar se elige
   «solo en este mundo» o «en todos los mundos». Las islas de evento y de
   tickets empiezan con el mismo nombre en todos los mundos; las demás pueden
   llevar en cada mundo el nombre de un lugar real de su costa. El progreso
   va por ID de lugar, nunca por coordenadas, y sobrevive al cambio de mundo.

Modifica REQ-ENT-003, REQ-ENT-012, REQ-MUN-018, REQ-MUN-026, REQ-AVE-001,
REQ-AVE-010 y REQ-ADM-032, y pasa de L2 a L1 REQ-AVE-035 a REQ-AVE-039:
todos citan ahora D-20. Añade REQ-MUN-035 a REQ-MUN-037 (mapa compartido y
mundos) y, sólo para la versión de prueba, REQ-ARQ-025 (repositorio en el
navegador), REQ-IDE-051 (invitado con apodo y botella propia), REQ-COM-035
(sello por sandbox) y REQ-ADM-039 («Probar admin»). No cambian los requisitos
de la versión final que los puntos 2 a 4 aplazan (REQ-ARQ-002, REQ-ARQ-010,
REQ-IDE-002, REQ-IDE-005, REQ-IDE-006, REQ-IDE-021, REQ-COM-017, REQ-ADM-002
a REQ-ADM-004): lo propio de la versión de prueba se retira cuando llegan.

**Para la versión final** (no está en la versión de prueba):

- Supabase como backend compartido: botellas, cambios del Admin y progreso
  compartidos entre visitantes, con las migraciones de T06 aplicadas al
  proyecto en la nube (P7).
- Acceso público por código de correo y enlace mágico, con fusión del
  invitado (plan 001 T07, rama WIP `worktree-agent-a208530713932c80c`; D-10).
- Login real del Admin con contraseña, TOTP y roles (plan 001 T08).
- El editor visual del mundo, de arrastrar y soltar (plan 001 T09).
- Ticketera real (webhook con la forma de Fourvenues y sello al confirmar el
  pago, D-06) en lugar del sandbox (P2).
- Proyecto PostHog en la nube UE y su clave (REQ-ARQ-019); sin clave, la
  analítica queda apagada.
- Validación en servidor de las recompensas de los minijuegos (REQ-AVE-038).
- Enlaces reales y textos de Álvaro (P13).
- El visto bueno de Álvaro a D-19 y D-20, a la entrada y a la dirección de
  arte (P9 a P12).
- El avance automático del acto 2 de la entrada (implementado en T14 y
  apagado).
- Dominio y cuentas a nombre de BOIA (REQ-PRO-021).

Falta el visto bueno de Álvaro en lo que toca identidad y negocio: adelantar
los minijuegos y un segundo mundo (P10), los dos mundos con sus historias y
nombres (P11), las letras 3D y el arranque en el puerto (P12) y enseñar a
terceros una versión con sello de prueba y Admin abierto (P13). Hasta que
conteste se avanza con esta decisión. Los puntos 2, 3, 4 y 7 son técnicos o
temporales y los decide Hernán.

## D-21 · La entrada se ve en cada carga de `/`, según la URL · 2026-09-29 · Hernán · pendiente Álvaro

Hernán quiere ver la entrada (mini-mundo, letras 3D «BOIA», «Zarpar» y
aterrizaje) cada vez que abre o recarga la web, no sólo la primera vez.
Decide que **la entrada depende de la URL, no de si ya se vio**:

1. **`/` a secas, en cada carga completa o recarga, reproduce la entrada.**
   Desaparece la marca de «ya la vio» (`boia.intro.v2`, D-19); nada se
   guarda en el navegador para decidirlo.
2. **Una URL que apunta a algo concreto entra directa a su contenido**:
   cualquier ancla (`/#tickets`, `/#fotos`), cualquier parámetro
   (`?menu=…`, `?intro=0`), un evento, una galería o una ruta que no sea `/`
   (REQ-ENT-011 sigue igual). Los parámetros de campaña (`utm_*`, `fbclid`,
   `gclid` y parecidos) no apuntan a nada y no quitan la entrada.
3. **Volver a `/` navegando dentro de la web** (el botón Inicio del juego,
   un enlace interno) no es una carga completa y no la repite.
4. Sigue todo lo demás: «Saltar animación» y «Solo quiero ver las entradas»
   funcionan desde el primer momento, el movimiento reducido tiene su
   variante quieta, la landing ligera es el respaldo si los recursos no
   llegan, y `/?intro=1` («Ver la introducción») la pide explícitamente.

Modifica REQ-ENT-009 (que entraba directo en visitas posteriores) y la marca
de «ya la vio» de D-19; REQ-ENT-001 y REQ-ENT-008 dejan de hablar de
«primera visita». Todos citan ahora D-21. Repetir la entrada en cada visita
es identidad y experiencia de Álvaro (P9): falta su visto bueno; hasta que
conteste se avanza con esta decisión.

## D-22 · `/mar`, planeta de agua, «Entradas» siempre a mano, diálogos legibles y logros que se reclaman · 2026-09-29 · Hernán · pendiente Álvaro

Hernán prueba la vista 3D `/mar` (commit 23890e5) y decide cómo sigue, para
la versión de prueba de D-20 (todo en el navegador y `muestra`):

1. **`/mar` es una vista 3D del mapa compartido, al lado de `/juego`.** Los
   mismos lugares, con sus IDs, comportamientos y progreso (REQ-MUN-035),
   dibujados con three.js en tiempo real. three.js se carga sólo en `/mar`:
   la landing, la entrada y `/juego` siguen sin runtime 3D. Corrige D-05
   («el 3D sólo existe offline, en Blender») para esa ruta; el pipeline de
   sprites de D-05 sigue igual para todo lo demás.
2. **En `/mar` el mundo es un pequeño planeta de agua.** Sin costas de
   hierba, arcilla, arena ni pueblo: el castillo en su colina y la Explanada
   pasan a ser islas en el mar (decorado propio de `/mar`, sin tocar las
   posiciones del mapa compartido). La navegación da la vuelta: quien sale
   por un lado vuelve por el opuesto, y el piloto automático elige el camino
   más corto. La superficie se curva hacia el horizonte, se ve el cielo con
   estrellas (más de noche, apenas de día) y el planeta gira despacio por su
   cuenta sin sacar al barco de su rumbo. `/juego` conserva sus costas y sus
   límites (REQ-MUN-011).
3. **El botón «Entradas» está siempre en pantalla en `/mar`.** Al pulsarlo,
   el barco navega en turbo, con estela y cámara que lo sigue, hasta la isla
   del evento actual (`allday` o la isla a la que apunte el evento vigente)
   y al llegar se abre el checkout de ese evento. Se puede saltar: «Saltar»
   o pulsar otra vez el botón abre el checkout al momento, y con movimiento
   reducido se abre directo. Sin evento vigente, lleva a la sección de
   entradas de la landing. Comprar sigue sin depender del juego (REQ-PRO-002).
4. **Los diálogos se pueden leer.** Cada bocadillo y cada aviso dura al
   menos 3 s, más si el texto es largo (valores de muestra: +60 ms por
   carácter a partir del 50, con tope de 8 s), y siempre lleva un botón de
   cerrar; tocar el texto sigue avanzando. Igual en `/mar` y en `/juego`.
   Corrige los 1,5 s por bocadillo y los 4 s por aviso de D-07.
5. **Los logros se reclaman.** Un logro pasa por «en curso» (lleva/pide,
   «te queda…»), «listo para reclamar» y «reclamado»; completarlo no da nada
   todavía: el premio se concede sólo al pulsar «Reclamar», una sola vez.
   El mismo flujo y el mismo progreso en `/mar` y en `/juego`. El premio
   depende del logro: monedas y puntos por defecto; una insignia del Carnet
   por comprar entrada; un barco de estilo concreto (de los 8 de
   `art/barco/estilos/`) para los logros complejos; cosméticos del barco
   (bandera, estela, color) para algunos. El catálogo se redacta primero
   (`docs/propuestas/logros-catalogo.md`) y Hernán lo aprueba antes de
   implementarlo.

Modifica REQ-MUN-001, REQ-MUN-011, REQ-AVE-002, REQ-IDE-024, REQ-IDE-025,
REQ-IDE-026, REQ-IDE-031 y REQ-COM-035, y añade REQ-MUN-038 (el planeta de
agua de `/mar`), REQ-ENT-040 (el botón «Entradas» de `/mar`) y REQ-IDE-052
(premios según el logro): todos citan ahora D-22. Los puntos 1, 3 y 4 son
técnicos o de usabilidad y los decide Hernán; el planeta de agua (punto 2),
la economía de premios y el catálogo (punto 5) tocan identidad y negocio y
falta el visto bueno de Álvaro (P14). Hasta que conteste se avanza con esta
decisión.

## D-23 · Economía de barcos, cambio de mundo por agujero negro, descuentos que llevan a su isla, ranking local y lo que decide el orquestador · 2026-09-29 · Hernán · O1–O15 del orquestador por delegación · Álvaro sólo da el visto bueno

Segunda tanda de decisiones de Hernán del 2026-09-29, tomada sobre el
inventario v14 → código (`docs/informes/2026-09-29-inventario-v14.md`, §1),
más las decisiones que Hernán delega en el orquestador (§2, O1–O15) y las
respuestas de Álvaro a la lista del inventario (§6). Todo sigue siendo la
versión de prueba de D-20: en el navegador y `muestra`, salvo el primer
evento real (punto 3 de las respuestas de Álvaro).

**Hernán decide:**

1. **Economía de barcos.** Las monedas compran barcos y skins. Al empezar
   todo está bloqueado menos los dos barcos de los mundos iniciales: B05
   Arcilla y B02 Acuarela. Con puntos se desbloquea un barco concreto.
   Precios y reparto en O5.
2. **`/mar` en 3D se queda** aunque rompa D-05; ya lo recoge D-22 (punto 1).
3. **Lo pendiente de Álvaro que pueda decidir el orquestador, lo decide**
   (O1–O15, abajo). Álvaro sólo da el visto bueno; si cambia algo, se anota
   aquí con fecha.
4. **Cambio de mundo con animación de agujero negro.** El mundo se hunde en
   un vórtice y sale el nuevo con todo en el mismo sitio: mismas islas,
   posiciones, enlaces y funciones. Sólo cambian los renders y los
   diálogos. Cambiar de mundo es cambiar la skin del mundo (D-20, punto 7).
5. **Las tarjetas de descuento llevan un botón «Ir a la isla»** que navega
   automáticamente hasta la isla del evento.
6. **Al comprar en la isla del evento se ve el descuento**: «Tienes un
   código de descuento para este evento», aplicado en el checkout.
7. **La isla ofrece «Ver fotos de la isla»**, que abre la página «Fotos y
   eventos» en la galería de esa isla o evento.
8. **Ranking activo, sólo local** en esta versión: el visitante se compara
   con los miembros `muestra` de su navegador. Es una excepción de la
   versión de prueba a REQ-IDE-038, que sigue valiendo para la final.
9. **Los textos de todas las zonas los escribe el equipo**
   (`docs/propuestas/textos-zonas.md`), `muestra` hasta que Álvaro los lea.
10. **Preguntas del Carnet: las decide el equipo.** Se mantienen las cinco
    de §44.1, que ya eligió Álvaro y ya están en el código tal cual.
11. **El móvil físico funciona bien** (probado por Hernán). P6 queda cerrada.

**El orquestador decide por delegación de Hernán (pendiente de Álvaro sólo
como visto bueno):**

| # | Tema | Decisión |
|---|---|---|
| O1 | P4 · alcance e idioma | Se aprueba el corte L1/L2 de D-02 con los cambios de D-20 y D-22, y español solo en L1 (D-03). |
| O2 | P8 · estilos | Arcilla (B05) y Acuarela (B02) son los mundos y barcos iniciales. Los otros seis estilos de `art/barco/estilos/` pasan a ser barcos que se ganan: en la tienda o como premio. |
| O3 | P9 · botón de entrada | «Zarpar». La entrada se ve en cada carga de `/` (D-21). |
| O4 | P10–P12 | Se sigue con D-20: minijuegos, dos mundos, letras 3D y arranque en el puerto. |
| O5 | Precios de barcos (`muestra`) | Monedas: B03 Low-poly 300 y B06 Cartoon años 30 400. Puntos: B04 Semi-realista «El Veterano» al llegar a 1500 puntos; los puntos no se gastan, son umbral. Skins noche y fiesta de cada barco: 150 monedas cada una. Premio de logro (catálogo aprobado por Hernán el 2026-09-29, plan 003 T36): B07 Cel-shaded cómic por `guardacostas`, B01 Boceto a lápiz por `secretos` y B08 Pixel art por `minutos-60`. El inventario proponía vender también B08 (400) y B01 (500) y dejar sólo B07 como premio; como preveía el propio O5, se intercambia con el reparto del catálogo. |
| O6 | Salida por temporada | Un solo punto de salida y un solo puerto en el mapa compartido (`mapa:salida`, `mapa:puerto`). Las temporadas no recolocan islas: gana el mapa compartido (D-20, punto 7). Se cierra la contradicción entre REQ-MUN-035 y REQ-ADM-032. |
| O7 | Satélites (§39.3) | Un evento satélite sin isla aparece en el panel de Tickets y en «Próximos eventos» de la isla All Day, con la línea «Calienta para el próximo All Day» y enlace a él. La localización común (REQ-COM-010) es la isla All Day vigente. |
| O8 | Descuento de tienda (§12) | Se muestra y se copia el código, con «Ir a la tienda» (externa). Lo valida la tienda de BOIA. |
| O9 | Moderación de Carnets | Botón «Reportar» en el Carnet público. En el Admin, Moderación lista los Carnets reportados y permite ocultar una respuesta o la foto, o restablecer el apodo, todo auditado. |
| O10 | Música de ambiente | Un loop por mundo generado (`muestra`) hasta que haya música con licencia. Arranca con el primer toque en `/juego` y en `/mar`, al 30 %, si la música está activa. La landing no suena. |
| O11 | HUD | Se quedan Inicio, saldos y brújula (decisiones de Hernán) junto al minimapa, el menú y, en `/mar`, «Entradas» (D-22). La caja de fps sólo sale con `?debug`. REQ-PRO-009 se ajusta. |
| O12 | Seis boies | Se añaden cinco boies informativas a la ruta del mapa compartido, con textos por mundo. Con la primera boia son seis: el logro «X/6 boies» de la v14 pasa a ser alcanzable (y `boies-3` del catálogo, también). |
| O13 | Instagram | Enlace en el pie, en la cabecera y en el panel de la boia de WhatsApp (URL `muestra`). |
| O14 | Legales | Aviso legal, privacidad y cookies con datos del titular inventados (respuesta 9 de Álvaro, abajo), marcados `muestra` y con aviso de que no son un titular real. Corrige la propuesta del inventario, que los dejaba vacíos. |
| O15 | Delfín | Aparece junto al barco cada 2–4 min en mar abierto, guía unos segundos hacia algo sin descubrir y se va. |

**Respuestas de Álvaro (vía Hernán, 2026-09-29):**

| # | Tema | Respuesta | Qué hacemos |
|---|---|---|---|
| 1 | Ticketera | Por decidir | P2 sigue abierta; sigue el sandbox (D-20, punto 3). |
| 2 | Primer evento real | Halloween en el Kiki García Bar, sin cartel todavía | Evento real `halloween-2026`, **BOIA Club · Halloween**, 31-10-2026, en el Kiki García Bar, cartel «próximamente» y precio `muestra`. No es un All Day: es una activación satélite (§39.2) de la serie «BOIA Club», sin isla propia, en el panel de Tickets y en «Próximos eventos» de la isla `allday` (O7), con enlace al próximo All Day cuando exista. Es el único contenido no `muestra` de la versión de prueba. |
| 3 | Enlaces | Sin respuesta | Siguen `muestra` (P15). |
| 4 | Códigos de descuento | Llegarán cuando funcionen con la ticketera | Inventados y marcados `muestra` (P16). |
| 5 | Artistas | Se mantiene la lista de 26; fotos y sus Carnets, más adelante | La lista deja de ser provisional; sin fotos ni Carnets de artistas por ahora (P17). |
| 6 | Fotos de eventos | Sí, con una selección personal en la página inicial | Las fotos llevan la marca «selección»: la home enseña sólo esas y «Ver todas» lleva a `/fotos` («Fotos y eventos»). |
| 7 | Música | Dejar las de ambiente; las opciones llegarán más adelante | Se mantiene O10 (P18). |
| 8 | Logo y tipografía | `art/marca/boia-mascota.jpg` (boia naranja con gorro azul marino, ojos grandes y sonrisa) y `art/marca/boia-wordmark.jpg` («BOIA» en naranja, palo grueso con cantos blandos) | La mascota es la base de todas las boies 3D del juego, con forma de boya: la primera, las informativas, la de WhatsApp y la Boia Fiestera (con sus detalles de fiesta). Las letras 3D de la entrada se rehacen con la forma del wordmark en lugar de Inter, y el wordmark es el logo. Falta el archivo de la tipografía (P20); si no existe, se calca del wordmark. |
| 9 | Datos legales | Inventados, con nombres graciosos | Ver abajo (O14). |
| 10–11 | Dominio, cuentas y enseñar la demo | Permiso total para Hernán | P13 cerrada: Hernán crea las cuentas y decide a quién enseñarla. |

Datos legales `muestra` (se sustituyen antes de publicar de verdad, P21):
titular **Bollería Fina del Mediterráneo, S.L.**, NIF B00000069 (no válido a
propósito), domicilio **C/ Rosa Melano, 69, 03001 Alicante**, administrador
**Benito Camelas**, delegada de protección de datos **Débora Melo**, atención
al público **Paco Merlo**, correo `privacidad@boia.example`. Los textos están
en `docs/propuestas/textos-zonas.md`.

Modifica REQ-PRO-009 (HUD, O11), REQ-ENT-003 (letras con la forma del
wordmark), REQ-ENT-032 (Instagram, O13), REQ-MUN-035 y REQ-ADM-032 (una sola
salida y un solo puerto, O6), REQ-AVE-018 (delfín, O15), REQ-IDE-030 y
REQ-IDE-031 (economía de barcos, punto 1 y O5), REQ-COM-010 (satélites, O7)
y REQ-COM-031 (fotos, punto 7 y respuesta 6), y añade REQ-MUN-039 (cambio de
mundo por agujero negro), REQ-AVE-040 (cinco boies informativas y la
mascota), REQ-COM-036 (el descuento lleva a su isla y se ve al comprar),
REQ-ADM-040 (moderación de Carnets) y, sólo para la versión de prueba,
REQ-IDE-053 (ranking local): todos citan ahora D-23. REQ-IDE-038 no cambia:
es el ranking de la versión final. Siguen abiertas con Álvaro P2 (ticketera)
y P14 (D-22), y las nuevas P15 a P22 (lo que aún falta). Hasta que conteste
se avanza con esta decisión.

## D-24 · «Zarpar» entra en el juego: el planeta de la entrada es el mundo 3D · 2026-10-02 · Hernán y Álvaro

En la entrevista del plan 005 Hernán y Álvaro deciden que el globo de la
entrada de la landing es el mundo 3D mismo y que «Zarpar» lleva al juego, no
a la landing:

1. **El planeta de la entrada es el de `/mar`**: el mundo activo de este
   navegador (con los cambios del Admin de la demo), con las mismas islas,
   construidas con las mismas piezas, sobre una esfera. No es un mini-mundo
   aparte.
2. **«Zarpar» entra directamente en `/mar`**, sin pasar por la landing: el
   planeta gira hasta poner de cara el puerto de salida y la cámara se
   zambulle en él; un velo con la pantalla de carga de `/mar` cubre la vista
   y se pasa a `/mar` sin recargar la página (navegación de la app). El velo
   se funde cuando el mar está listo, con el barco en ese puerto.
3. **Al llegar se abre la bienvenida de la boia de la entrada** (Welcome
   Aboard: qué es BOIA, cómo se navega, qué buscar), con un botón «¡A
   navegar!». Se puede volver a abrir desde el Menú.
4. **«Saltar animación» y «Solo quiero ver las entradas» siguen llevando a la
   landing** (la segunda, a su panel de Tickets). Con movimiento reducido,
   «Zarpar» es un fundido al velo, sin mover la cámara, y entra igual en el
   juego. Sin WebGL, o si la escena no llega en su plazo, sale la landing
   ligera como antes. `/?intro=1` la repite y D-21 no cambia: volver a `/`
   desde el juego (Atrás, o un enlace de la app) entra directo a la landing.
5. **Analítica**: «Zarpar» cuenta como `explore_start` con origen `intro`;
   como la landing no se llega a ver, no hay `landing_view`.

Modifica REQ-ENT-001 (el botón ya no termina en la landing sobre el mar sino
en `/mar`), REQ-ENT-006 y REQ-ENT-014 (la llegada es la zambullida en el
puerto y el último fotograma es el velo de `/mar`) y acerca REQ-ENT-012
(explorar desde el puerto sin recargar). Textos de la bienvenida `muestra`.

## D-25 · Sólo el planeta 3D: el mundo 2D se borra · 2026-10-01 · Hernán y Álvaro

En la prueba de opinión del 2026-10-01 (entrevista del plan 005) Hernán y
Álvaro repasan cada parte de la web y deciden que el mundo navegable es sólo
el planeta 3D de `/mar` (three.js):

1. **El mundo 2,5D isométrico de `/juego` (PixiJS) se borra**, con su motor
   de dibujo, su entrada «mini-mundo» 2D, la sonda de la esfera
   (`/sphere-probe`), los atlas por sector y el presupuesto de arte del
   primer sector, que sólo servían al 2D. `pixi.js` sale de las dependencias.
2. **Lo que sólo tenía el 2D pasa a `/mar`** (plan 005, T52–T61): Ajustes,
   Controles y la bienvenida, Mi Carnet dentro del mundo, botellas y ranking,
   enlaces directos (`?ir=`, `?evento=`, `?menu=`), Tickets dentro del mundo,
   la misión de la Boia Fiestera y los minijuegos.
3. **Los enlaces viejos siguen sirviendo**: `/juego`, con cualquier consulta,
   redirige (307, temporal) a `/mar` con la misma consulta, así `?ir=`,
   `?evento=`, `?menu=` y `?cerca=` abren el mar en su sitio.
4. **Sin WebGL no hay versión 2D**: `/mar` dice con claridad que el
   dispositivo no puede mostrar el mundo 3D y ofrece las entradas
   (`/#tickets`). La landing sigue funcionando sin WebGL (versión ligera).
5. **Se quedan los dos mundos** (Arcilla y Acuarela) y el cambio de mundo por
   agujero negro, en 3D (D-23, punto 4).

Deja sin objeto REQ-ENT-012 (paso de la superficie de la entrada al 2D) y
los requisitos que sólo describían el dibujo 2D (sprites por dirección,
sectores con atlas); su estado está en `docs/spec/estado.md`. Textos del
aviso sin WebGL `muestra`.

## Preguntas abiertas

| # | Pregunta | Para | Traba |
|---|---|---|---|
| P2 | ¿Ticketera: Fourvenues u otra? ¿Ya hay cuenta? | Álvaro | adaptador real (fase 2) |
| P3 | ¿Qué evento es el objetivo de L1 y en qué fecha? Respondida en parte 2026-09-29 (D-23): el primer evento real es BOIA Club · Halloween, 31-10-2026, en el Kiki García Bar, un satélite; falta la fecha del próximo All Day. | Álvaro | el calendario del All Day |
| P4 | ~~¿Aprueba el corte L1/L2 de D-02 y español solo (D-03)?~~ Cerrada 2026-09-29 por el orquestador, por delegación de Hernán (D-23, O1): se aprueba con los cambios de D-20 y D-22; Álvaro sólo da el visto bueno. | — | — |
| P5 | ~~Referencia del barco~~ Cerrada 2026-09-28 por Hernán: no hay; el 01 va con propuesta procedural y Álvaro opina sobre el visor. | — | — |
| P6 | ~~¿Quién tiene el iPhone y el Android de prueba?~~ Cerrada 2026-09-29 por Hernán (D-23, punto 11): el móvil físico funciona bien. | — | — |
| P7 | Crear el proyecto Supabase `boia-planet-dev` y pasar sus claves con `pedir-token` | Hernán | tarea de auth (T07 del plan 001) en adelante |
| P8 | ~~¿Qué estilos de la exploración del 01 pasan a Álvaro?~~ Cerrada 2026-09-29 (D-23, O2 y O5): Arcilla y Acuarela son los mundos y barcos iniciales; los otros seis se ganan con monedas, puntos o logros. | — | — |
| P9 | ~~¿Aprueba la entrada nueva de D-19 y qué texto lleva el botón?~~ Cerrada 2026-09-29 por el orquestador, por delegación (D-23, O3): «Zarpar», con la entrada en cada carga de `/` (D-21). | — | — |
| P10 | ~~¿Aprueba adelantar los minijuegos Faro y Cañón y un segundo mundo?~~ Cerrada 2026-09-29 por el orquestador, por delegación (D-23, O4): se sigue con D-20. | — | — |
| P11 | ~~¿Aprueba los dos mundos, Arcilla y Acuarela, con sus historias y nombres?~~ Cerrada 2026-09-29 por el orquestador, por delegación (D-23, O4): se sigue con D-20; historias, nombres y textos siguen `muestra` hasta su lectura (P22). | — | — |
| P12 | ~~¿Aprueba el título «BOIA» en letras 3D y el arranque en El Varadero?~~ Cerrada 2026-09-29 por el orquestador, por delegación (D-23, O4); las letras toman la forma del wordmark de Álvaro (D-23, respuesta 8). | — | — |
| P13 | ~~¿Se puede enseñar fuera del equipo la versión de prueba?~~ Cerrada 2026-09-29 por Álvaro (D-23, respuestas 10–11): permiso total para Hernán, que crea las cuentas y decide a quién enseñarla. Los enlaces reales pasan a P15. | — | — |
| P14 | ¿Aprueba `/mar` como planeta de agua sin costas (D-22, punto 2) y los logros que se reclaman con premios por tipo, incluidos barcos de estilo bloqueados hasta reclamarlos (D-22, punto 5, y `docs/propuestas/logros-catalogo.md`)? | Álvaro | catálogo y economía definitivos; todo es `muestra` |
| P15 | Enlaces reales: entradas, tienda, WhatsApp, Instagram y correo de contacto (D-23, respuesta 3) | Álvaro | quitar `muestra` de pie, cabecera, boia de WhatsApp y tienda |
| P16 | Códigos de descuento reales, creados en la ticketera o la tienda, con el % de cada uno (D-23, respuesta 4) | Álvaro | llegan con la ticketera (P2); hasta entonces, inventados |
| P17 | Fotos de los 26 artistas y sus Carnets con las preguntas (D-23, respuesta 5) | Álvaro | avatares y Carnets de artista; hoy avatar neutro |
| P18 | Música con licencia, una por mundo (D-23, respuesta 7) | Álvaro | sustituir los loops generados de O10 |
| P19 | Cartel de BOIA Club · Halloween (D-23, respuesta 2) | Álvaro | el evento sale con «cartel próximamente» |
| P20 | Archivo de la tipografía de BOIA (.otf o .ttf), si existe (D-23, respuesta 8). Nota 2026-10-02 (plan 006 T74): Hernán y Álvaro eligen las de draaimolen.nu/story, Druk Wide Medium para títulos e Inter para el texto, en toda la web (el wordmark sigue siendo el logo). Druk es comercial: hasta que Álvaro compre la licencia web, los títulos van con Archivo en su anchura máxima (OFL), la libre más parecida; se cambia en un solo archivo (`apps/web/lib/fonts.ts`, README «Tipografías»). | Álvaro | licencia web de Druk Wide Medium (Commercial Type); hasta entonces, Archivo Expanded |
| P21 | Datos legales reales (titular, NIF/CIF, domicilio, correo de privacidad) y revisión profesional de los textos legales | Álvaro | publicar de verdad (REQ-PRO-020); hoy son inventados (D-23, O14) |
| P22 | Lectura rápida de los textos del equipo (`docs/propuestas/textos-zonas.md`) y de O1–O15 de D-23 | Álvaro | quitar `muestra` de los textos |
