# boia-planet

BOIA.PLANET: la web-universo de Boia, colectivo de eventos musicales de
Alicante. Landing con entradas de los «All Day BOIA» y un planeta 3D
navegable en barco (`/mar`, three.js; D-25: el mundo 2D de `/juego` se borró
y su ruta lleva a `/mar`). La landing es un solo scroll sobre una escena
3D (plan 007, abajo). Cómo se trabaja en el repo: `CLAUDE.md`;
requisitos: `docs/DECISIONES.md` y `docs/spec/`; estado: `ESTADO.md`.

Monorepo `pnpm` (Node 24, pnpm 11.27.1 por `packageManager`):
`apps/web` (Next.js), `packages/*` (motor, mundo, contratos, repositorio),
`art/` (el arte que sale de Blender, servido por `/api/art`, D-16).

## En local

```sh
pnpm install
pnpm dev          # http://localhost:3000
pnpm demo         # igual, e imprime la URL de la Wi-Fi para abrirla en el móvil
PORT=3100 pnpm demo
```

No hace falta ninguna variable de entorno; las opcionales están en
[`.env.example`](.env.example) (se copian a `apps/web/.env.local`). Sin las
de Supabase la web corre en **modo local** (todo en el navegador, como la
producción de hoy); con ellas, en modo cuentas (abajo, «Cuentas con
Supabase»).

## Probar

Comprobaciones (las mismas que corren los encargos; se leen por el código de
salida y los conteos):

```sh
pnpm test && pnpm typecheck && pnpm lint && pnpm build
E2E_PORT=3107 pnpm e2e --workers=2      # ~15 min; la primera vez: pnpm --filter @boia/web exec playwright install chromium
```

- `pnpm test` corre vitest y, si no se le pasa un filtro, después
  `tools/spec/checks.sh`: la coherencia de la spec (`tools/spec/check.py`),
  el estado por requisito (`tools/spec/estado.py`, REQ-PRO-017), sus pruebas
  y todo el arte de `art/` (`tools/blender/check.py`, ~1 min). Necesita
  `python3` del sistema. `pnpm test apps/web/lib` corre sólo esas pruebas.
- Las simulaciones de balance con bots (`packages/*/src/**/*-balance.test.ts`:
  survivors, jefes y defensa del castillo; ~75 s) no corren con `pnpm test`:
  tienen su propia orden, `pnpm test:slow` (`vitest.slow.config.ts`). Córrela
  al tocar el balance o la dificultad. Con ellas fuera, `pnpm test` pasa de
  ~86 s a ~35 s.
- El estado de cada requisito (HECHO, PARCIAL, FALTA, L2, final) y su prueba
  está en [`docs/spec/estado.md`](docs/spec/estado.md); `pnpm spec:estado`
  lo comprueba y cuenta.
- Las pruebas contra Supabase (`pnpm test:supabase` y las e2e con
  `E2E_SUPABASE=1`) van aparte: «Cuentas con Supabase», abajo. Sin las
  variables, todo lo de arriba corre en modo local.
- El Cañón en beta (plan 010) se prueba a mano con atajos en la URL de
  `/mar` (`?minijuego=canon&t=<s>&seed=<n>`; en producción, con `dev=1`):
  [guía de prueba de la beta 1](docs/propuestas/2026-10-04-canon-beta1-guia-prueba.md),
  con los valores de manejo y cámara que se tocan en
  `packages/engine/src/survivors/config.ts`.
- Los textos de la interfaz viven en `apps/web/lib/i18n/` por clave
  (REQ-ARQ-020). Los de [`docs/propuestas/textos-zonas.md`](docs/propuestas/textos-zonas.md)
  se copian con `pnpm --filter @boia/web i18n:zonas`; una prueba avisa si el
  catálogo y el documento no coinciden.

## Tipografías

Reunión con Álvaro del 2026-10-08 (decisión 2 del plan 019): tres fuentes de
videojuego que combinan, de la lista de
[1001freefonts](https://www.1001freefonts.com/es/video-game-fonts.php);
Hernán eligió la combinación 4 de las muestras (T213). Las define un solo
archivo, [`apps/web/lib/fonts.ts`](apps/web/lib/fonts.ts) (`next/font/local`,
en el `<html>` del layout raíz); el CSS sólo usa `var(--font-title)`
(títulos; los `h1`–`h3` la llevan desde `globals.css`), `var(--font-button)`
(botones de la landing y del mundo y el menú de arriba) y `var(--font-body)`
(texto).

- Títulos: Upheaval (Brian Kent, Ænigma Fonts),
  `apps/web/public/fonts/upheavtt.ttf`. Freeware para uso personal y
  comercial; su licencia (`LICENCIA-upheaval.txt`) no deja alterar el
  archivo, así que va el TTF original, sin subconjunto ni conversión. Se
  precarga y cuenta en el presupuesto de la landing (200 kB,
  `pnpm --filter @boia/web budget`).
- Botones: Press Start 2P, `press-start-2p.woff2`, SIL OFL
  (`OFL-press-start-2p.txt`). No se precarga: entra con `swap`.
- Texto: 8-bit Operator+ (Grand Chaos Productions),
  `8bit-operator-plus-{regular,bold}.woff2`, SIL OFL
  (`OFL-8bit-operator-plus.txt`). No se precarga.

Las dos OFL tienen nombre reservado: van enteras (sin subconjunto), sólo
reempaquetadas en woff2. Las instala
[`tools/fonts/subset.py`](tools/fonts/subset.py) (necesita
`pip install fonttools brotli`) desde una carpeta con los archivos de
partida; su cabecera dice de dónde bajar cada uno.

Esquinas y botones (decisión 3): ninguna esquina redondeada. Todo el CSS usa
`var(--radius)` (0, en `globals.css`); sólo las formas redondas de por sí
(la boia, avatares, puntos, el minimapa, los mandos circulares del juego)
llevan `50%`. Los botones son de recreativa: rectos, borde negro de 2 px y
sombra dura desplazada (`--btn-*` en `globals.css`), que se hunden al
pulsarlos. Comprobación: `pnpm build` (presupuesto) y
`E2E_PORT=3341 pnpm e2e tipografia.spec.ts` (familias y carga).

## La landing: el hero por scroll

Plan 007 (diseño: [`docs/propuestas/2026-10-03-landing-scroll.md`](docs/propuestas/2026-10-03-landing-scroll.md);
decisión: D-26 en [`docs/DECISIONES.md`](docs/DECISIONES.md)).
`/` es un solo scroll: la entrada cinemática y, debajo, la página de siempre.

- **Aparición y reposo.** `/` a secas reproduce la aparición (el planeta de
  `/mar` sube y entran las letras «BOIA», 1,4 s) y se queda en **reposo**
  con «Zarpar», «Entradas» (visibles desde el primer pintado) y la pista
  «Desliza para bajar al mar». No avanza solo y no hay «Saltar animación»:
  un scroll, «Entradas» o «Zarpar» durante la aparición la adelantan. Una URL
  directa (`/#tickets`, `?intro=0`, un evento) o volver desde `/mar` nace en
  reposo (D-21). «Zarpar» se zambulle en 1,5 s y entra en `/mar` (D-24);
  «Entradas» abre el panel de Tickets.
- **El scroll lleva la escena.** El canvas three.js está fijo bajo toda la
  página y lo mueve la posición de scroll `s` (en alturas de vista): de 0 a
  ~0,92 la zambullida del planeta al mar (la trayectoria de «Zarpar»,
  reversible), de 0,84 a 1 el fundido al mar, y desde 1 la cámara en la
  cubierta tras el barco avanza sobre el agua mientras la luz pasa de la
  hora dorada a la noche, que llega con la banda de Fotos. Los bloques son
  bandas oscuras encima. Tramos: bloque `scroll` de `DEFAULT_PLANET_INTRO`
  (`packages/engine/src/intro/planet.ts`, `scrollState`).
- **Dónde está cada cosa.** El script de arranque de
  `apps/web/app/(landing)/page.tsx` decide la entrada antes del primer
  pintado (`data-intro`, `data-hero`); `components/intro-stage.tsx` monta el
  hero, cuyo motor (`apps/web/lib/intro/run.ts`: controlador
  `packages/engine/src/intro/controller.ts`, scroll, bucle de pintado,
  `landing_view`) llega en un chunk aparte (`lib/intro/lazy.ts`). La escena,
  en `apps/web/lib/planeta/`: `intro-scene.ts` (planeta y pase final),
  `sea-rig.ts` (mar, cielo, luces y el atrezzo GLB de `art/landing/3d`, que
  se pide por `/api/art` con la página en reposo), `quality.ts` (niveles de
  calidad y la sonda de primeros fotogramas). three.js se pide tras `load`.
- **Versión estática.** Con movimiento reducido, sin WebGL, con la escena
  fuera de plazo (9 s) o que falla, o en bajo consumo
  (`lib/intro/low-power.ts`: `saveData`, `deviceMemory ≤ 2`,
  `hardwareConcurrency ≤ 4` salvo en WebKit de Apple, o la sonda por debajo
  de 30 fps), la misma página sin 3D sobre el still de Blender
  (`components/hero-stills.tsx`, `art/landing/hero-still*.webp`, el de noche
  desde Fotos): sin canvas, sin cámara, nada se anima solo.
- **Para probar y depurar.** `window.__boiaIntro` (fase del controlador,
  `scroll = { s, phase, light }`, `quality`) y `.hero[data-scroll-phase]`
  (`rest`, `dive`, `sea`). Pruebas: `e2e/landing-scroll.spec.ts` (flujo,
  CLS, accesibilidad y teclado), `e2e/landing-perf.spec.ts` (CPU 4× y bajo
  consumo), `e2e/intro.spec.ts`, `e2e/landing.spec.ts`.
- **Presupuesto: 200 kB gzip** para la ruta crítica de `/` (HTML, JS, CSS y
  fuentes precargadas; hoy **185,5 kB**). Lo comprueba
  `apps/web/scripts/landing-budget.mjs` al final de `pnpm build` (que falla
  si se pasa) o `pnpm --filter @boia/web budget`. three.js, el atrezzo y los
  stills no cuentan: cargan aparte.
- El contenido real (cartel, fotos de artistas, enlaces y Spotify) entra sin
  código: [`docs/contenido-real.md`](docs/contenido-real.md).

## Islas de Blender en el mar 3D

Las islas de `/mar` se hacen a mano en three.js
(`apps/web/app/mar/engine/islands.ts`); las que tienen modelo de Blender
(T69: la Isla de Halloween) lo cargan cerca del barco y vuelven a la de a
mano lejos, mientras llega o si falla. Blender 5.2.2 LTS.

- Cada isla es un módulo `tools/blender/islas/<isla>.py` con `ID` (el id del
  lugar del mundo; casi siempre el mismo nombre, pero el Puig Campana es
  `puigcampana.py` con `ID = "canon"`: la isla del Cañón, T221), `LABEL`,
  `DOC`, `RADIUS`, `DETAIL`, `ROLES`, `GLOW` y `build(B, K)`; piezas comunes
  (boias disfrazadas con la mascota, terreno, calabaza, láminas) en
  `islas/comun.py`. El contrato está arriba de
  `tools/blender/export_islas_glb.py`.
- `blender -b -P tools/blender/export_islas_glb.py -- --only <isla>` (módulo
  o `ID`) escribe `art/islas/3d/<ID>.glb` y su entrada en
  `art/islas/3d/manifest.json`.
  Opciones: `--preview <carpeta fuera del repo>` (PNG de día y de noche) y
  `--detalle` (triángulos por material). Sale con 1 si la isla pasa de
  `MAX_TRIS` (30 000).
- `python3 tools/blender/check.py` valida el manifiesto
  (`isla3d.schema.json`), un GLB por módulo, una sola malla y el presupuesto.

**Añadir una isla** (T70, T71): copiar `islas/halloween.py` a
`islas/<id>.py`, cambiar sus datos y `build`, exportar con `--only <id>` y
pasar `check.py`. `/mar` no necesita cambios: lee el manifiesto y escala el
modelo al radio del lugar (frente a -Y de Blender, que mira al puerto). En
el lienzo, `data-islas-modelo` dice `id:procedural|cargando|glb|error`
(`e2e/mar-isla-modelo.spec.ts`).

## Arte del hero de la landing (Blender)

El atrezzo de la escena del hero y los stills de la versión estática (plan
007, T78) salen de `tools/blender/landing/`. Todo `muestra` hasta que Álvaro
apruebe el arte.

- Un módulo por pieza (`costa.py`, `puerto.py`, `barco.py`, `boya.py`, con
  `ID`, `LABEL`, `DOC`, `BUDGET_TRIS`, `BUDGET_KB` y `build()`), piezas
  comunes en `comun.py` y la escena de los stills en `escena.py`. Metros,
  agua en z = 0, el mar hacia +Y de Blender (−z en glTF). Colores de
  vértice, sin texturas ni Draco; cada luz es una malla `luz_*` aparte con
  material emisivo (three.js le pone su halo).
- `blender -b -P tools/blender/landing/export_landing_glb.py` escribe
  `art/landing/3d/<id>.glb` y `manifest.json` (con el bloque `escena`:
  cámara, posición de cada pieza, sol y luna, que lee
  `apps/web/lib/planeta/sea-rig.ts`). `-- --only barco boya` para algunas;
  `-- --preview <carpeta fuera del repo>` añade un PNG de cada una. Sale con
  1 si una pieza pasa su presupuesto o el total los topes (12 000
  triángulos, 220 kB).
- `blender -b -P tools/blender/landing/render_hero_still.py` renderiza con
  EEVEE los stills de oro y de noche a 1600 y 800 px
  (`art/landing/hero-still{,-noche}-{1600,800}.webp`, ≤ 120 y ≤ 50 kB).
  Los GLB salen idénticos byte a byte; los stills, iguales a la vista.
- `python3 tools/blender/check.py` valida el manifiesto
  (`tools/blender/landing3d.schema.json`) y los stills; lo corre `pnpm test`.
  Informe de validación: `docs/informes/p007-t78-arte-hero.md`.

## Cuentas con Supabase (plan 008)

Decisión en borrador: [`docs/propuestas/2026-10-03-d27-borrador.md`](docs/propuestas/2026-10-03-d27-borrador.md)
(D-27, pendiente de Hernán). Con las variables de Supabase la web tiene
cuentas por email con un código de 6 cifras (sin enlace), el Carnet como
carné de identidad, lo de valor en la base (escrito sólo por RPC que validan
cada acción), sellos de fiesta por QR (`/sello`), rankings y botellas
globales y `/admin` con código + TOTP. **Sin ellas, modo local** (D-20): todo
en el navegador, como la producción de hoy, así que publicar `main` nunca
rompe nada (`isSupabaseConfigured()`, `apps/web/lib/supabase/config.ts`).

### Montar un proyecto de desarrollo

El de este repo es `boia-planet-dev` (lo creó Hernán el 2026-10-03; P7).
Para otro proyecto, o para rehacerlo:

1. https://supabase.com/dashboard → **New project** (región de la UE).
2. Copiar [`.env.example`](.env.example) a `apps/web/.env.local` (fuera de
   git; `.worktreeinclude` lo copia a cada worktree) y rellenar las cuatro
   variables de Supabase (dónde está cada una, en el propio `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (la
     _publishable key_): las usa la web, también en el navegador.
   - `SUPABASE_SERVICE_ROLE_KEY` (la _secret key_) y `SUPABASE_DB_URL` (el
     _Session pooler_): sólo los scripts y las pruebas, nunca el navegador ni
     Vercel.
3. `pnpm db:migrate:dev`: las migraciones de `supabase/migrations/` y la
   muestra de `supabase/seeds/`.
4. En el panel, Auth: «Email OTP Length» 6 y «Email OTP Expiration» 600, SMTP
   propio, plantillas en español con `{{ .Token }}` y las URL (Site URL y
   `http://localhost:3100/**` en Redirect URLs). Paso a paso, en la lista de
   producción, pasos 3–6: [`docs/propuestas/2026-10-03-produccion-supabase.md`](docs/propuestas/2026-10-03-produccion-supabase.md).
   Sin SMTP propio, el correo de Supabase sólo llega al equipo del proyecto.
5. `pnpm admin:grant -- <tu email> owner` y entrar en `/admin` (código del
   email y alta del TOTP con el QR).
6. `pnpm dev` (o `PORT=3100 pnpm demo`): con las variables, la web está en
   modo cuentas.

### Comandos

| Comando | Qué hace |
|---|---|
| `pnpm db:migrate:dev` | Aplica las migraciones que falten y las semillas nuevas o cambiadas al proyecto de las variables, registradas como la CLI de Supabase; repetir no aplica nada. **Se niega** si `SUPABASE_DB_URL` no es del mismo proyecto que `NEXT_PUBLIC_SUPABASE_URL`. `-- --no-seed`: sólo migraciones. Lee las variables de la terminal y, si no están, de `apps/web/.env.local` |
| `pnpm db:types:dev` | Regenera `packages/db/src/database.types.ts` desde el proyecto (tras una migración nueva) |
| `pnpm test:supabase` | Las pruebas de integración contra el proyecto (`packages/db/src/supabase/*.supabase.ts`): crean cuentas `@example.test` con la clave secreta, prueban cada RPC (lo que acepta y lo que rechaza) y la RLS de anon, otra cuenta y el Admin con TOTP, y borran sus cuentas. Sin las variables escribe «se omite» y sale con 0. **Sólo contra desarrollo** |
| `E2E_SUPABASE=1 E2E_PORT=<libre> pnpm e2e <specs> --workers=1` | Las e2e con cuentas: `supabase-sesion`, `cuenta`, `cuenta-progreso`, `sello`, `sello-camara`, `ranking`, `botellas-globales` y `admin-real` (`.spec.ts`). El código del correo lo sacan con `auth.admin.generateLink`: no leen ningún buzón. Sin `E2E_SUPABASE=1` el servidor de las e2e arranca con las variables de Supabase vacías (modo local) y esas specs se saltan |
| `pnpm admin:grant -- <email> <owner\|admin\|editor\|none>` | Da o quita (`none`) un rol del Admin a la cuenta de ese email, con la clave secreta; si no tiene cuenta, la crea confirmada. Queda en la auditoría; el último propietario no se quita. Misma comprobación de proyecto que `db:migrate:dev` |
| `pnpm db:clean-test-users` | Borra las cuentas `@example.test` (y todo lo suyo) que dejan ejecuciones cortadas de `test:supabase` o de las e2e: por defecto las de hace más de 30 min; `-- --all` todas; `-- --minutes N` otro margen. No toca otros dominios. **Sólo desarrollo** |
| `pnpm db:test` | Las suites de `packages/db` (`schema.test.ts`, `rls.test.ts`) contra un PostgreSQL local (`BOIA_PG_URL`, D-17); en el Windows de los planes no hay, y se excluyen del comando de prueba |

### Dónde está cada cosa

- `supabase/migrations/2026100310*.sql`: perfiles y consentimientos, la
  economía (libro, cosméticos, sellos por QR, tiempos, descuentos, copia del
  documento, fusión del invitado), rankings, botellas globales y el Admin
  real. Convenciones y claves de rechazo: cabecera de `…100000_accounts.sql`
  y `packages/db/src/rpc.ts`. La muestra, en `supabase/seeds/`; quitarla,
  `supabase/sample/remove-sample.sql`.
- `apps/web/lib/supabase/`: los clientes (navegador, servidor, servicio, que
  se niega en un navegador).
- `apps/web/lib/account/`: la sesión (`useAccount`), la puerta
  `requireAccount(motivo)` (carnet, skin, stamp, ranking), la hoja de acceso
  con el código, la fusión del invitado, «Tu cuenta» en el Carnet y la
  entrada del Admin con TOTP.
- `packages/store/src/member/` y `apps/web/lib/repo-member.ts` (sólo se carga
  con Supabase): el repositorio del socio (RPC, cola sin red, gana el
  servidor), el cambio invitado ↔ socio sin recargar y las botellas globales.
- `apps/web/app/sello/` (el QR de la fiesta), `apps/web/lib/scanner/`
  («Escanear sello»), `apps/web/app/carnet/` (también el público,
  `/carnet/<id>`), `apps/web/app/admin/real/` (las cuatro secciones) y
  `apps/web/app/api/admin/stamp-image/`.
- E2E: `apps/web/e2e/supabase-env.ts` (el interruptor) y `supabase.ts`
  (crear socios, código, entrar, borrar).

## Desplegar la versión de prueba

Hoy en https://boia-planet-roan.vercel.app (**temporal** hasta el dominio
definitivo). La versión de prueba (plan 002, D-20) corre en modo local: sin
Supabase, sin correo y sin ticketera. Todo lo que hace el visitante (Carnet,
botellas, sellos, descuentos, cambios del Admin) se guarda en su navegador.
Por eso **no necesita ninguna variable de entorno**: `pnpm build` funciona con el
entorno vacío, la analítica queda apagada sin `NEXT_PUBLIC_POSTHOG_KEY` (los
eventos sólo se apuntan en `window.__boiaAnalytics`) y el arte sale del
propio repo por `/api/art` (`next.config.ts` mete todo `art/` en la función).

### Ajustes del proyecto en Vercel (una vez)

En _Project → Settings_:

- **Framework Preset:** Next.js.
- **Root Directory:** `apps/web`.
- **Include files outside the Root Directory in the Build Step:** activado
  (los paquetes del workspace y `art/` están fuera de `apps/web`).
- **Install, Build y Output Command:** los de por defecto. Vercel usa pnpm
  por `pnpm-lock.yaml` y `packageManager`; el build es `pnpm run build` de
  `apps/web`, que además falla si la landing pasa de su presupuesto.
- **Node.js Version:** 24.x.
- **Environment Variables:** ninguna en modo local. Para las cuentas,
  `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` del proyecto
  de producción, y volver a desplegar (se meten en el build); nunca la clave
  secreta. Todo el paso a producción, con el SMTP, las plantillas y el
  propietario del Admin:
  [`docs/propuestas/2026-10-03-produccion-supabase.md`](docs/propuestas/2026-10-03-produccion-supabase.md).

No hace falta `vercel.json`. Las URLs de _preview_ piden sesión de Vercel si
la _Deployment Protection_ está activa (lo está por defecto); la de
producción es pública.

### Camino 1: desde GitHub (el habitual)

El repo `picodepato/boia-planet-web` (remoto `origin`) está conectado al proyecto:

```sh
git push origin main        # despliega a producción
git push origin <rama>      # despliega una preview de esa rama
```

### Camino 2: desde la terminal, con la CLI de Vercel

Siempre **desde la raíz del repo** (no desde `apps/web`: la subida tiene que
llevar `packages/` y `art/`).

```sh
pnpm dlx vercel login       # una vez
pnpm dlx vercel link        # una vez: elige el proyecto existente; crea .vercel/ (la CLI lo añade a .gitignore)
pnpm dlx vercel             # preview
pnpm dlx vercel --prod      # producción
```

(Con la CLI instalada, `npm i -g vercel`, es lo mismo sin `pnpm dlx`:
`vercel`, `vercel --prod`.)

### Comprobar el despliegue

1. `https://<dominio>/api/art/barco/manifest.json` responde JSON (el arte llega).
2. `https://<dominio>/` enseña la entrada (letras 3D «BOIA», «Zarpar» y
   «Entradas») y, al bajar, la escena del mar con la landing encima; el
   atrezzo llega de `/api/art/landing/3d/manifest.json`.
3. «Zarpar» entra en `/mar` (el planeta 3D; sus barcos también salen de
   `/api/art`, `art/barco/3d/*.glb`) con la bienvenida de la boia abierta.
4. `https://<dominio>/juego?ir=fotos` redirige a `/mar?ir=fotos` (D-25).
5. El recorrido completo para el móvil está en `ESTADO.md` (plan 002 T30, «Guía de la demo»).

Cada respuesta lleva la CSP y las cabeceras de seguridad
(`apps/web/lib/security-headers.ts`, REQ-ARQ-012): `curl -I https://<dominio>/`
enseña `content-security-policy`.

## Entrega

- [`docs/entrega.md`](docs/entrega.md): la lista de entrega (REQ-ARQ-024) y
  lo que falta para publicar de verdad.
- [`docs/propuestas/2026-10-03-produccion-supabase.md`](docs/propuestas/2026-10-03-produccion-supabase.md):
  la lista para poner las cuentas en producción (proyecto aparte, Vercel,
  SMTP, plantillas, URL, migraciones, propietario, quitar la muestra).
- [`docs/manual-alvaro.md`](docs/manual-alvaro.md): cómo usar el Admin, para
  BOIA; [`docs/manual-admin.md`](docs/manual-admin.md), los detalles.
- [`docs/matriz-dispositivos.md`](docs/matriz-dispositivos.md): los 16 casos
  de accesibilidad y fallos (REQ-ARQ-016) y el registro de móviles físicos.
