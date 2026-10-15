# Despliegue: Cloudflare + Vercel

Para Álvaro. Cómo sale la web a internet desde el plan 027, qué hay que
configurar fuera del repo (una vez), qué hacer si un host se cae, el correo
del dominio y lo que caduca. Aquí no hay ninguna clave: sólo los nombres de
las variables y dónde se ponen. Las claves viven en los paneles de cada
servicio y en `apps/web/.env.local` (fuera de git).

Índice:

1. [Arquitectura: un push, dos webs](#1-arquitectura-un-push-dos-webs)
2. [Variables de entorno: las mismas en los dos](#2-variables-de-entorno-las-mismas-en-los-dos)
3. [Supabase Auth: los dos orígenes](#3-supabase-auth-los-dos-orígenes)
4. [Dominio](#4-dominio)
5. [Si un host se cae](#5-si-un-host-se-cae)
6. [Correo del dominio (opción B)](#6-correo-del-dominio-opción-b)
7. [Regla de cuentas](#7-regla-de-cuentas)
8. [Cosas que caducan](#8-cosas-que-caducan)

---

## 1. Arquitectura: un push, dos webs

```
git push origin main
   ├─► Cloudflare Workers Builds ─► Worker «boia-planet» ─► https://boiaplanet.net   (pública)
   └─► Vercel (Git integration)  ─► proyecto de Vercel   ─► https://boia-planet-roan.vercel.app (copia)
                         los dos leen y escriben el mismo Supabase
```

- **Un solo código, una sola rama.** Cada push a `main` construye y despliega
  en los dos hosts a la vez, cada uno por su cuenta. No hay ramas ni código
  propios de un host: lo único distinto es la configuración
  (`apps/web/wrangler.jsonc` y `apps/web/open-next.config.ts` para
  Cloudflare; los ajustes del proyecto para Vercel).
- **Cloudflare es la web pública** (plan gratuito: uso comercial permitido,
  archivos estáticos sin tope de tráfico). **Vercel Hobby es la copia**
  siempre encendida e idéntica; el plan Hobby no admite uso comercial, por eso
  el dominio apunta a Cloudflare.
- **Los datos** (cuentas, sellos, rankings, fotos) están en Supabase, uno solo
  para los dos. Sin las variables de Supabase la web corre en modo local
  (D-20) en los dos hosts igual.
- **Comprobar que sirven lo mismo:**
  `pnpm check:hosts https://boiaplanet.net https://boia-planet-roan.vercel.app`
  compara el commit de `/version.json` (lo escribe
  `apps/web/scripts/version.mjs` en cada build) y pide `/`, `/mar` (con CSP) y
  `/art/barco/manifest.json`. Sale con 0 si todo coincide. Lo mismo corre solo
  cada 6 h en GitHub (`.github/workflows/hosts-parity.yml`) con las variables
  del repo `PUBLIC_URL` y `BACKUP_URL` (Settings → Secrets and variables →
  Actions → pestaña «Variables»). Justo después de un push los dos pueden ir
  unos minutos desfasados: si falla por commits distintos, se relanza a mano
  pasado un rato.

### Cloudflare: Workers Builds (una vez)

Cloudflare construye desde GitHub con Workers Builds (3.000 minutos de build
al mes gratis, 1 build a la vez, 20 min de tope por build). Así no hace falta
ningún token de Cloudflare en GitHub.

1. Panel de Cloudflare → **Workers & Pages** → **Create application** →
   **Import a repository** → elegir la cuenta de GitHub y el repo
   `picodepato/boia-planet-web`.
2. **Nombre del Worker: `boia-planet`.** Tiene que ser igual que el `name` de
   `apps/web/wrangler.jsonc`; si no, el build falla.
3. Ajustes del build (después, en el Worker → **Settings → Build**):

| Campo | Valor |
|---|---|
| Git branch (producción) | `main` |
| Root directory | `apps/web` |
| Build command | `pnpm cf:build` |
| Deploy command | `npx wrangler deploy` (el de por defecto; usa el wrangler de `apps/web/package.json`) |
| Preview command (ramas que no son `main`) | el de por defecto, `npx wrangler preview` (crea una vista previa, no toca la web pública) |
| Build watch paths | los de por defecto (incluir `*`, no excluir nada). No excluyas `docs/` ni `plans/`: Vercel construye con cualquier push y, si Cloudflare se saltara uno, los commits de los dos hosts dejarían de coincidir |
| API token | el que genera Cloudflare por defecto |
| Build variables and secrets | las de la tabla de abajo |

Build variables (Settings → Build → Build variables and secrets):

| Variable | Valor | Por qué |
|---|---|---|
| `PNPM_VERSION` | `11.27.1` | el de `packageManager` en `package.json`; la imagen de Cloudflare trae pnpm 10 por defecto y el lockfile es de pnpm 11 |
| `NODE_VERSION` | `24` | el repo pide Node ≥ 24 (`engines`); hoy la imagen ya trae 24, así queda fijo |
| las `NEXT_PUBLIC_*` de la sección 2 | | Next las mete en el build |

Qué hace `pnpm cf:build` (script de `apps/web/package.json`):
`opennextjs-cloudflare build` (que corre `pnpm build`: copia `art/` a
`public/art`, escribe `version.json`, `next build` y el presupuesto de la
landing de 200 kB) → `opennextjs-cloudflare populateCache local` (las páginas
prerenderizadas) → `node scripts/cf-assets.mjs` (escribe `_headers` y
`_redirects` en `.open-next/assets`). Después `wrangler deploy` sube
`.open-next/worker.js` y `.open-next/assets`. El commit del build sale de
`WORKERS_CI_COMMIT_SHA`, que Workers Builds pone solo.

Ojo:

- **El primer build en Linux es la prueba de verdad.** En este Windows
  `cf:build` sólo se ha corrido desde una copia con `nodeLinker: hoisted`
  (`pnpm cf:measure` la hace sola); en Linux debería ir tal cual. Si el primer
  build falla, el registro está en el Worker → **Deployments** → el build.
- **No pongas variables de runtime en el panel** (Settings → Variables &
  Secrets): `wrangler deploy` borra en cada despliegue las variables de texto
  que no estén en `wrangler.jsonc`. Hoy la web no necesita ninguna en
  runtime. Si algún día hace falta una, como **secret** (ésos no se borran).
- `/eventos/[slug]` no se regenera cada 5 min en Cloudflare como en Vercel:
  se queda como salió del último despliegue (decisión de T262, caché de sólo
  lectura; el estado «hoy / en curso» lo calcula el navegador).
- Tamaño del Worker: ~2.186 KiB gzip, con el tope gratis en 3 MB. Antes de
  cambios grandes, `pnpm cf:measure` (falla por encima de 2.800 KiB).
- La URL `https://boia-planet.<tu-subdominio>.workers.dev` sirve para probar
  antes de poner el dominio.
- Probar en local el Worker: `pnpm cf:preview` (en Windows, desde la copia que
  deja `pnpm cf:measure --keep`; README del T262 en `ESTADO.md`).

### Vercel (la copia): sin cambios

La integración con GitHub sigue como estaba (README, «Desplegar la versión
de prueba»): **Root Directory** `apps/web`, «Include files outside the Root
Directory» activado, comandos por defecto (`pnpm run build` de `apps/web`),
Node 24.x. El commit del build sale de `VERCEL_GIT_COMMIT_SHA`. Cada push a
`main` despliega a producción; las otras ramas, previews.

### Comprobaciones en cada push (GitHub Actions)

Dos flujos corren en cada push a `main` y en cada pull request, sin secretos
(plan 028 T267). **`cf-size`** construye la web en Linux como Workers Builds y
corre `pnpm cf:measure`: falla si el Worker pasa de 2.800 KiB gzip o si los
estáticos rompen los límites de Cloudflare (20.000 archivos, 25 MiB por
archivo). **`commit-author`** falla si algún commit subido no es de
`picodepato <admin@boiaplanet.net>`, porque Vercel Hobby no despliega commits
de otros autores; el mensaje dice cómo rehacer el autor y la lista está en
`ALLOWED_AUTHORS` de `apps/web/scripts/check-authors.mjs`. Un fallo no frena
el despliegue (los hosts construyen por su cuenta): es un aviso para arreglar
antes del siguiente push.

---

## 2. Variables de entorno: las mismas en los dos

**Regla: una variable que se cambia en un host se cambia en el otro el mismo
día**, y después se vuelve a desplegar en los dos (las `NEXT_PUBLIC_*` van
dentro del build: cambiarlas sin desplegar no hace nada). Después,
`pnpm check:hosts` con las dos URL.

Dónde se ponen:

- **Cloudflare:** Worker `boia-planet` → Settings → Build → **Build variables
  and secrets**. Para que se apliquen: un push, o reintentar el último build
  (Deployments).
- **Vercel:** Project → Settings → **Environment Variables**, entorno
  *Production* (y *Preview* si se quieren las cuentas en las previews).
  Después, Deployments → el último → **Redeploy**.

| Variable | Qué es | Cloudflare | Vercel | ¿Hace falta? |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase (Project Settings → Data API) | Build variable | Environment Variable | Sólo para el modo cuentas. Sin ella (y sin la siguiente), modo local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la *publishable key* de Supabase (Project Settings → API Keys); va al navegador, es pública | Build variable | Environment Variable | Igual que la anterior: las dos o ninguna |
| `PNPM_VERSION`, `NODE_VERSION` | versiones del build (sección 1) | Build variable | no (Vercel las saca de `packageManager` y del ajuste Node 24.x) | Sí, en Cloudflare |
| `SUPABASE_SERVICE_ROLE_KEY` | la *secret key* de Supabase | **nunca** | **nunca** | Ninguna ruta del servidor la usa (`apps/web/lib/supabase/service.ts` no lo importa ninguna página ni API); sólo los scripts (`pnpm admin:grant`, `pnpm test:supabase`…) desde la terminal, con `apps/web/.env.local` |
| `ADMIN_DEMO_PASSWORD` | la contraseña del Admin demo | **nunca** | **nunca** | Sólo la leen las pruebas (`lib/admin/demo-auth.test.ts`, `e2e/admin-acceso.spec.ts`) desde la terminal; la web compara con un hash guardado en el código |

Fuera de los hosts, en GitHub (Settings → Secrets and variables → Actions),
para los flujos programados. Si cambian las claves de Supabase, también aquí:

| Nombre | Tipo | Lo usa |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | secretos | `supabase-keepalive.yml` (los mismos valores que las dos `NEXT_PUBLIC_SUPABASE_*`) |
| `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE` | secretos | `supabase-backup.yml` ([guía](propuestas/2026-10-08-backups.md)) |
| `SUPABASE_URL` | variable (opcional) | `supabase-backup.yml` |
| `PUBLIC_URL`, `BACKUP_URL` | variables | `hosts-parity.yml` (`https://boiaplanet.net` y `https://boia-planet-roan.vercel.app`) |

La lista completa de variables locales, con dónde sacar cada una:
[`.env.example`](../.env.example).

---

## 3. Supabase Auth: los dos orígenes

El acceso es por código de 6 cifras (sin enlace), pero Supabase sólo acepta
como destino los orígenes que tiene apuntados. En el proyecto de producción
de Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://boiaplanet.net`
- **Redirect URLs** (una por línea):
  - `https://boiaplanet.net/**`
  - `https://www.boiaplanet.net/**` (si se usa `www`)
  - `https://boia-planet-roan.vercel.app/**` (la copia)
  - `https://boia-planet.<tu-subdominio>.workers.dev/**` (para probar)
  - en el proyecto de desarrollo, además, `http://localhost:3100/**`

Con un origen que falte, la web abre igual pero el acceso desde ese host
falla. El resto del paso a producción (SMTP, plantillas, migraciones,
propietario): [propuestas/2026-10-03-produccion-supabase.md](propuestas/2026-10-03-produccion-supabase.md).

---

## 4. Dominio

`boiaplanet.net`, comprado en **Porkbun** el 2026-10-12 con un **Gmail
personal** (sección 7), DNS en **Cloudflare**.

1. **Nameservers a Cloudflare** (hecho el 2026-10-12): Cloudflare → Add a
   domain → plan Free; Porkbun → Domain Management → el dominio →
   **Authoritative Nameservers** → los dos que dio Cloudflare (hoy `remy` y
   `ulla` `.ns.cloudflare.com`). Cloudflare avisa por correo cuando el dominio
   está activo.
2. **El dominio en el Worker:** Worker `boia-planet` → **Settings → Domains &
   Routes → Add → Custom domain** → `boiaplanet.net`, y otra vez con
   `www.boiaplanet.net` si se quiere. Cloudflare crea el DNS y el certificado
   solo; no hay que añadir registros a mano. No toques los registros de
   correo (MX, SPF, DKIM, DMARC; sección 6).
3. Opcional: que `www` lleve a la raíz con una regla de **Rules → Redirect
   Rules** (plantilla «Redirect from WWW to root»).
4. Comprobar: `pnpm check:hosts https://boiaplanet.net https://boia-planet-roan.vercel.app`
   y cargar `PUBLIC_URL` y `BACKUP_URL` en GitHub (sección 1).
5. **Redirigir la URL de Vercel al dominio: opcional y no recomendado.**
   Vercel lo permite (Project → Settings → Domains → la de `vercel.app` →
   Redirect to `boiaplanet.net`), pero entonces la copia deja de servir sola:
   si Cloudflare se cae, la URL de Vercel mandaría a la web caída. Si se hace,
   hay que quitar la redirección lo primero en una caída (sección 5).
6. **Buscadores (plan 030 T285).** Los dos hosts sirven `/robots.txt` y
   `/sitemap.xml` (estáticos, de `apps/web/app/robots.ts` y `sitemap.ts`; en
   Cloudflare los responde el Worker desde la caché de OpenNext, comprobado
   con `wrangler dev`). Toda página pública lleva la canónica en
   `https://boiaplanet.net` (`lib/seo.ts`), también la copia de Vercel: así
   Google no la cuenta como contenido duplicado y la puede seguir sirviendo
   sin redirigir. El sitemap para Search Console es
   `https://boiaplanet.net/sitemap.xml`.

---

## 5. Si un host se cae

Estado de Cloudflare: https://www.cloudflarestatus.com · de Vercel:
https://www.vercel-status.com. `pnpm check:hosts` con las dos URL dice cuál
responde.

**Vercel caído** (la copia): no hay que hacer nada; la web pública sigue.
Cuando vuelva, `pnpm check:hosts` para ver que tiene el último commit (si no,
Redeploy).

**Cloudflare caído, al momento:** compartir la URL de la copia,
**https://boia-planet-roan.vercel.app**, en Instagram, WhatsApp y donde se
haya mandado el dominio. Es la misma web con los mismos datos (mismo
Supabase). Si se puso la redirección del punto 4.5, quitarla antes.

**Sólo el Worker falla, pero el DNS de Cloudflare funciona** (el panel abre y
el correo llega): Worker → Settings → Domains & Routes → quitar
`boiaplanet.net`; en DNS → Records añadir `A @ 76.76.21.21` y
`CNAME www cname.vercel-dns.com`, los dos en **DNS only** (nube gris); en
Vercel → Project → Settings → Domains → añadir `boiaplanet.net` y `www`. El
correo sigue igual porque los registros de correo no se tocan.

**Caída larga de Cloudflare entero** (DNS incluido, horas o días):

1. Si en Cloudflare se activó DNSSEC, quitar primero el registro DS en
   Porkbun (Domain Management → DNSSEC); si no, el dominio deja de resolver.
2. Porkbun → **Authoritative Nameservers** → volver a los de Porkbun (opción
   por defecto).
3. Porkbun → **DNS Records**: `A @ 76.76.21.21` y `CNAME www
   cname.vercel-dns.com`; en Vercel, añadir `boiaplanet.net` y `www` en
   Domains (Vercel dice si el DNS ya está bien).
4. **El correo se cae con Cloudflare:** el reenvío de `hola@` y `admin@` es
   de Cloudflare Email Routing. Para no perder correo, en Porkbun activar su
   **Email Forwarding** (gratis) hacia el mismo Gmail y volver a crear en su
   DNS los registros de Brevo (DKIM `brevo1`/`brevo2`, DMARC; sección 6) y el
   SPF con el include de Porkbun en lugar del de Cloudflare.
5. El cambio de nameservers tarda de minutos a 24–48 h en llegar a todos.
   Mientras, seguir compartiendo la URL de Vercel.
6. Al volver: nameservers otra vez a Cloudflare (los mismos), en Vercel quitar
   el dominio, y comprobar con `pnpm check:hosts` y un correo de prueba a
   `hola@`.

Vercel Hobby no admite uso comercial: servir la web pública desde Vercel es
para una emergencia, no para quedarse.

---

## 6. Correo del dominio (opción B)

Sin pagar: **recibir** con Cloudflare Email Routing, que reenvía al Gmail de
BOIA, y **enviar** desde ese Gmail como `hola@boiaplanet.net` («Enviar como»)
por el SMTP gratuito de **Brevo**. Hecho el 2026-10-12 para `hola@` y
`admin@`.

### Recibir: Cloudflare Email Routing

Cloudflare → el dominio → **Email → Email Routing** → activar. Destination
addresses: el Gmail (hay que confirmar el correo que manda). Routing rules:
`hola@boiaplanet.net` y `admin@boiaplanet.net` → ese Gmail. Al activarlo,
Cloudflare añade solo sus registros:

| Tipo | Nombre | Contenido |
|---|---|---|
| MX | `@` | `route1.mx.cloudflare.net` (y `route2`, `route3`, con las prioridades que pone Cloudflare) |
| TXT | `@` | el SPF (abajo: uno solo) |
| TXT | `cf2024-1._domainkey` | la DKIM de Cloudflare (la pone Cloudflare) |

### Enviar: Gmail «Enviar como» con Brevo

1. Brevo (cuenta gratis) → **Senders, Domains & Dedicated IPs → Domains** →
   añadir `boiaplanet.net` → **Authenticate**. Brevo da estos registros; en
   Cloudflare → DNS → Records, todos en **DNS only** (nube gris):

| Tipo | Nombre | Contenido |
|---|---|---|
| TXT | `@` | `brevo-code:…` (el código que da Brevo; sólo verifica el dominio) |
| CNAME | `brevo1._domainkey` | el destino que da Brevo (`b1.boiaplanet-net.dkim.brevo.com` o el que diga) |
| CNAME | `brevo2._domainkey` | el destino que da Brevo (`b2.…`) |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` (el que propone Brevo) |

2. Brevo → **SMTP & API → SMTP** → **Generate a new SMTP key**. Apunta el
   servidor (`smtp-relay.brevo.com`, puerto 587), el *login* SMTP que enseña
   esa página y la clave (se ve una vez; no la guardes en el repo).
3. Gmail → ⚙ → **Ver todos los ajustes → Cuentas e importación → Enviar como
   → Añadir otra dirección de correo**: nombre «BOIA», `hola@boiaplanet.net`;
   servidor SMTP `smtp-relay.brevo.com`, puerto 587, usuario = el login SMTP
   de Brevo, contraseña = la clave SMTP, conexión TLS. Gmail manda un código a
   `hola@`, que llega por Email Routing al mismo Gmail. Igual para `admin@`
   si se quiere enviar desde ella.

### Un solo SPF

Un dominio sólo puede tener **un** registro TXT que empiece por `v=spf1`; con
dos, los dos fallan. Si un servicio pide «añade este SPF», se **edita** el que
hay. El que cubre Cloudflare (recibir y reenviar) y Brevo (enviar):

```
v=spf1 include:_spf.mx.cloudflare.net include:spf.brevo.com ~all
```

El 2026-10-12 se dejó sólo el de Cloudflare (`v=spf1
include:_spf.mx.cloudflare.net ~all`): lo enviado por Brevo pasa DMARC con
su DKIM. Añadir `include:spf.brevo.com` a ese mismo registro, como arriba,
es lo recomendado para que también pase SPF.

Comprobar: mandar un correo desde Gmail como `hola@` a otra cuenta → «Mostrar
original» → SPF, DKIM y DMARC en `PASS`.

---

## 7. Regla de cuentas

- **Porkbun y Cloudflare, con un Gmail personal** (nunca con
  `@boiaplanet.net`). Si el dominio o el correo del dominio fallan, los
  correos de recuperación de esas cuentas llegarían a un buzón que depende de
  ellas mismas, y no habría forma de entrar a arreglarlo. Con 2FA activado.
- **Todo lo demás, con la dirección corporativa** `admin@boiaplanet.net`:
  Vercel, Supabase, GitHub (la organización o el colaborador), Brevo,
  la ticketera.
- **Cómo migrar una cuenta que hoy está en otro correo:** invitar a
  `admin@boiaplanet.net` como **Owner** (Supabase: Organization → Team →
  Invite, rol Owner; GitHub: Settings →
  Collaborators o una organización), aceptar desde `admin@`, entrar con ella y
  comprobar que lo ve y puede cambiarlo todo; **sólo entonces** quitar la
  cuenta vieja. Donde no hay invitaciones (Vercel Hobby es de una persona,
  Brevo), cambiar el email de la cuenta en sus ajustes.
- Guardar las contraseñas y los códigos de 2FA en un gestor de contraseñas
  compartido de BOIA, no en el repo ni en chats.

---

## 8. Cosas que caducan

Desde el plan 028 (T266) dos cosas lo vigilan solas, dentro del repo y sin
secretos nuevos (sólo el `GITHUB_TOKEN` de cada flujo):

- **`.github/workflows/recordatorios.yml`** (cada lunes, y a mano desde
  Actions) corre `apps/web/scripts/recordatorios.mjs` con la lista
  `apps/web/scripts/caducidades.json`. Abre un **issue** en el repo por cada
  cosa a la que le quedan **60, 30 o 7 días** (si ya tiene uno abierto,
  comenta en él en vez de abrir otro), y uno **cada mes** para enviar un
  correo desde `hola@` (si el del mes anterior sigue abierto, comenta en él).
  No cierra nada: el issue se cierra al hacerlo. Pasada la fecha sigue
  avisando hasta que se cambie. GitHub manda por correo los issues nuevos a
  quien vigila el repo (Watch).
  - **Al renovar algo**: poner su fecha nueva en `caducidades.json` (commit y
    push) y cerrar su issue. **Algo nuevo que caduca**: añadirlo ahí con los
    mismos campos.
  - **Ensayo sin tocar nada**: `node apps/web/scripts/recordatorios.mjs
    --dry-run --fecha 2027-08-20` escribe lo que haría ese día; en Actions,
    «Run workflow» con «dry_run».
- **Trabajo `keepalive-workflows`** en cada flujo programado
  (`hosts-parity`, `recordatorios`, `supabase-backup`, `supabase-keepalive`):
  llama a la API «Enable a workflow» (`PUT
  /repos/{owner}/{repo}/actions/workflows/{id}/enable`, permiso
  `actions: write`) para todos los flujos activos o desactivados por
  inactividad, él incluido. Los desactivados a mano se respetan. Con
  `hosts-parity` cada 6 horas, se llama varias veces al día.

**Qué está probado y qué no** (2026-10-12):

- Probado con pruebas unitarias (`apps/web/scripts/recordatorios.test.ts`):
  los plazos de 60/30/7 días, que no abre duplicados (comenta), el
  recordatorio mensual, que no cierra ni edita issues, y que cada flujo con
  `schedule:` lleva el trabajo `keepalive-workflows` con `actions: write`.
- Comprobado contra la API pública: el repo `picodepato/boia-planet-web` es
  **público** (así que la regla de los 60 días le aplica) y sus tres flujos
  estaban `active`.
- **Sólo documentado, sin probar aquí**: que GitHub desactiva los flujos
  programados de un repo público tras 60 días sin actividad (docs de GitHub
  «Disabling and enabling a workflow», que no dicen qué cuenta como
  actividad), y que la API «Enable a workflow» pide `actions: write` (tabla
  de permisos de GitHub). **Que llamarla sobre un flujo ya activo reinicia la
  cuenta de los 60 días no lo dice GitHub en ningún sitio**: es la técnica
  que usan acciones «keepalive» de la comunidad en lugar de hacer commits
  falsos, sin respaldo en la documentación de GitHub. No se puede comprobar sin esperar
  60 días sin commits. Si un día llega el correo de GitHub avisando de que va
  a desactivar un flujo, es que no basta: entonces, Actions → el flujo →
  **Enable workflow**, o cualquier push.
- Los flujos no corren hasta que Álvaro haga push; la primera ejecución real
  se ve en Actions (el trabajo `keepalive-workflows` escribe `activo: …` por
  cada flujo).

| Qué | Cuándo | Qué se rompe | Cómo se renueva |
|---|---|---|---|
| Clave SMTP de Brevo que usa Gmail «Enviar como» para `hola@boiaplanet.net` | Creada 2026-10-12, **caduca 2027-10-12**. También caduca tras **90 días sin enviar** | Gmail deja de poder enviar como `hola@` (recibir sigue funcionando) | **Automático:** issue a 60, 30 y 7 días (`recordatorios.yml`) y un issue cada mes para enviar desde `hola@`. Enviar desde `hola@` **al menos una vez al mes**. Renovar: Brevo → SMTP & API → SMTP → nueva clave → Gmail → Ajustes → **Cuentas e importación → Enviar como → `hola@` → editar** → pegar la clave nueva. Lo mismo para `admin@` si envía. Luego, fecha nueva en `caducidades.json` |
| Proyecto gratuito de Supabase | Se pausa tras **~7 días sin actividad** | Con cuentas: el acceso, los sellos, los rankings y el Admin dejan de responder (en modo local no se nota) | **Automático:** `.github/workflows/supabase-keepalive.yml` lo lee lunes y jueves (secretos `SUPABASE_URL` y `SUPABASE_ANON_KEY`). Si ya se pausó: panel de Supabase → **Restore project** |
| Flujos programados de GitHub | GitHub los **desactiva tras 60 días sin actividad en el repo** (sin commits) | Dejan de correr `supabase-keepalive` (y Supabase se pausa), `supabase-backup` (sin copias), `hosts-parity` (nadie avisa de una diferencia entre hosts) y `recordatorios` | **Automático (sin probar, ver arriba):** el trabajo `keepalive-workflows` de cada flujo programado los reactiva por la API. Si aun así se desactivan: repo → **Actions** → cada flujo → **Enable workflow**, o un push. GitHub avisa por correo antes |
| Dominio `boiaplanet.net` | **Caduca 2027-10-12**; Porkbun, renovación automática activada, **12,52 USD/año** | Si no se renueva: la web pública y el correo `@boiaplanet.net` dejan de funcionar | **Automático:** issue a 60, 30 y 7 días (`recordatorios.yml`). Que la tarjeta de Porkbun esté vigente antes de la fecha; comprobar en Porkbun → Domain Management que «Auto Renew» sigue activado. Luego, fecha nueva en `caducidades.json` |
| Recordatorio | **Cada año, el 12 de septiembre** (un mes antes) | — | Los issues de `recordatorios.yml` lo cubren; como red por si GitHub no corre nada, un evento anual en el calendario de BOIA: «Revisar docs/DESPLIEGUE.md §8: clave de Brevo, dominio, flujos de GitHub y Supabase». Ese día: renovar la clave de Brevo, comprobar la tarjeta de Porkbun, mirar que los cuatro flujos están activos en Actions y que el último `supabase-keepalive` salió bien |
