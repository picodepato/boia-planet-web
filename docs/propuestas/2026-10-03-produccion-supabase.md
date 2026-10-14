# Encender las cuentas: Carnet con email y código

Para Álvaro. Escrito en el plan 008 (T95, 2026-10-03) y puesto al día en el
plan 029 (T276, 2026-10-13) para los dos hosts de hoy: **Cloudflare**
(`boiaplanet.net`, la pública) y **Vercel** (`boia-planet-roan.vercel.app`,
la copia).

Qué cambia al encenderlo: «Crear mi Carnet» pide el email, llega un correo
de `hola@boiaplanet.net` con un código de 6 cifras, se escribe el código, se
elige el apodo y se acepta la política; lo que esa persona tenía en el
navegador (puntos, skin, récords, Carnet de prueba) pasa a su cuenta. Con la
cuenta, el Carnet, los sellos por QR, la tienda, los rankings y las botellas
viven en Supabase.

Mientras no se haga, la web sigue en **modo local** (D-20): sin las dos
variables `NEXT_PUBLIC_SUPABASE_*` no se pide nada y todo queda en el
navegador, como hoy. Se ha comprobado en el plan 029 (T276):

- sin las variables, `pnpm build` no mete en la web ninguna dirección de
  Supabase y la CSP no la abre; el Carnet se crea sin pedir email;
- con ellas, la web lleva la URL de Supabase, la CSP la abre (https y wss)
  en los dos hosts (`next.config.ts` en Vercel y en el Worker,
  `scripts/cf-assets.mjs` en los estáticos de Cloudflare) y el Carnet no se
  crea hasta que el código se verifica;
- contra `boia-planet-dev`: `pnpm test:supabase` y la e2e de la cuenta
  (`E2E_SUPABASE=1`, `e2e/cuenta.spec.ts`: email, código, apodo, lo del
  invitado pasa a la cuenta, cerrar sesión y volver, borrar la cuenta).

**Ninguna clave va en el repositorio, en este documento ni en un chat**: sólo
en los paneles (Cloudflare, Vercel, GitHub, Brevo, Supabase), en
`apps/web/.env.local` (desarrollo, fuera de git) o en la terminal de quien
corre un script.

Los menús son los de octubre de 2026; si alguno ha cambiado de sitio, el
ajuste se llama igual. Se hace **en este orden**: primero todo Supabase
(pasos 1–8), después la política (paso 9) y por último las variables de los
dos hosts (paso 10). Hasta el paso 10 la web pública no cambia.

## 0. Antes de empezar

- [ ] **La política de privacidad aprobada** (paso 9). Sin ella no se
      recogen emails reales.
- [ ] **El uso de la lista de emails** (P23): qué se manda a quien marque
      «noticias» y con qué herramienta. Hasta saberlo, el CSV de Admin →
      Socios y emails no se usa.
- [ ] Una hora tranquila, sin fiesta esa noche: el paso 10 cambia la web
      pública.

> **Hecho el 2026-10-14:** el proyecto de producción `BOIAPLANETWEBOFICIAL`
> está creado y migrado (40/40 migraciones y seeds), `admin@boiaplanet.net`
> es propietario y el SMTP se ha verificado con un correo real con código.

## 1. Un proyecto de Supabase para producción

Hoy sólo existe `boia-planet-dev`, el de las pruebas: `pnpm test:supabase` y
las e2e crean y borran cuentas allí. **La web pública no puede usarlo.**

- [ ] https://supabase.com/dashboard → la organización de BOIA → **New
      project**: nombre `boia-planet`, región de la UE (Frankfurt o
      Irlanda), contraseña de la base larga y aleatoria (generada por el
      gestor de contraseñas, guardada allí). El plan gratuito deja tener dos
      proyectos activos.
- [ ] **Plan.** El gratuito se pausa tras ~7 días sin visitas (el flujo
      `supabase-keepalive` lo evita, paso 11) y no guarda copias diarias (las
      hace el flujo `supabase-backup`, paso 11). Pro (de pago) da copias
      diarias en el panel; decide Álvaro.
- [ ] Apuntar en el gestor de contraseñas dónde está cada valor del proyecto
      **nuevo** (los nombres son los de `.env.example`):
  - `NEXT_PUBLIC_SUPABASE_URL`: Project Settings → **Data API** → Project
    URL. Sólo `https://<ref>.supabase.co`, sin `/rest/v1/` al final.
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Project Settings → **API Keys** → la
    *publishable key* (`sb_publishable_…`; va al navegador). No la `eyJ…`
    de «Legacy»: `lib/secretos.test.ts` la rechaza.
  - `SUPABASE_SERVICE_ROLE_KEY`: Project Settings → API Keys → la *secret
    key* (`sb_secret_…`). Sólo para los scripts de la terminal; **nunca** en
    Cloudflare ni en Vercel.
  - `SUPABASE_DB_URL`: botón **Connect** (arriba) → **Session pooler** → la
    línea `postgresql://…`, con la contraseña de la base en lugar de
    `[YOUR-PASSWORD]`. Sólo scripts.

## 2. Las migraciones (las 40 de `supabase/migrations/`)

Se aplican todas, en orden, con el script del repo. Lee las variables de la
terminal antes que las de `apps/web/.env.local` (una variable definida gana
al archivo), así que para apuntar a **producción** se abre una terminal
nueva (Git Bash), en la raíz del repo:

```sh
export NEXT_PUBLIC_SUPABASE_URL='https://<ref-de-prod>.supabase.co'
export NEXT_PUBLIC_SUPABASE_ANON_KEY='<publishable de prod>'
export SUPABASE_SERVICE_ROLE_KEY='<secret de prod>'
export SUPABASE_DB_URL='postgresql://postgres.<ref-de-prod>:<contraseña>@<host>:5432/postgres'
pnpm db:migrate:dev     # «[migraciones] 40 aplicadas de 40» y las semillas de muestra
pnpm db:migrate:dev     # otra vez: «0 aplicadas de 40 (al día)»
```

- [ ] Las últimas, del plan 029, van con las demás (ya están en
      `boia-planet-dev`):
  - `20261013100100_gallery_clips_longer.sql` (T277): el bucket
    `event-clips` admite clips de hasta 50 MB.
  - `20261013100200_security_definer_lockdown.sql` (T278): **seguridad,
    imprescindible antes de encender**. Borra `admin_sign_in_email` (daba a
    cualquiera sin cuenta el email de la cuenta del Carnet 000) y saca de
    `public` las funciones con SECURITY DEFINER (`discount_code_for`,
    `radio_set_first`, `radio_reorder`). Desde ella, quien entra al Admin con
    contraseña escribe el **email** de su cuenta, no «000».
  - `20261014100100_carnet_questions_v2.sql` (T281): las 5 preguntas nuevas
    del Carnet (decisión de Álvaro, 2026-10-14). Retira las cuatro antiguas
    (`is_active = false`, posiciones 11 a 14) y añade las cuatro nuevas en
    las posiciones 1 a 4; `buena-fiesta` no cambia. **No borra ninguna
    respuesta**: las de las preguntas retiradas siguen guardadas y sólo el
    Admin las ve. Comprobar después, en el **SQL Editor**: `select id,
    position from carnet_questions where is_active order by position;` tiene
    que dar `momento-quiero-estar`, `cancion-en-repeat`, `creando-tramando`,
    `disco-entero`, `buena-fiesta`.
  - `20261014100110_carnet_answers_active_only.sql` (T281): un miembro sólo
    puede contestar o cambiar respuestas a preguntas **activas**; las
    respuestas a las retiradas se quedan como están (y puede borrarlas).
  - `20261014100200_member_numbers_from_10.sql` (T282): los números de
    Carnet salen seguidos **desde el 10** (el 0 es del Carnet del Admin y
    del 1 al 9 quedan reservados; el Admin puede darlos a mano desde
    «Socios y emails» → «Cambiar nº»). Nadie cambia de número. En un
    proyecto nuevo el primer socio lleva el 10.
- [ ] Del plan 030 (ya en `boia-planet-dev`):
  - `20261014100400_events_tickets_not_yet.sql` (plan 030 T292): la
    columna `events.tickets_not_yet` («Tickets todavía no disponibles»,
    por defecto `false`), que el equipo marca y desmarca desde el Admin
    («Fiestas y QR»). Su semilla de muestra la marca en `sonido-2026` y
    `nochevieja-2026` (sólo filas `is_sample`). No toca ninguna otra fila.
  - `20261015100100_carnet_questions_audience.sql` (T294): preguntas del
    Carnet por público (decisión de Álvaro, 2026-10-14). Los **artistas**
    (`carnets.is_artist`) conservan las 5 de T281; el resto cambia la
    primera por `dia-siguiente` («Completa la frase: al día siguiente de una
    fiesta yo…»). Añade la columna `audience` (`all`, `artist`, `public`),
    hace la posición única dentro de cada público y deja contestar sólo las
    activas del propio público. **No borra ninguna respuesta**: quien no es
    artista y ya contestó `momento-quiero-estar` la conserva (sólo la ve el
    Admin). Comprobar después, en el **SQL Editor**: `select id, audience,
    position from carnet_questions where is_active order by position,
    audience;` tiene que dar `momento-quiero-estar` (artist, 1),
    `dia-siguiente` (public, 1) y `cancion-en-repeat`, `creando-tramando`,
    `disco-entero`, `buena-fiesta` (all, 2 a 5).
- [ ] Del plan 031 (ya en `boia-planet-dev`):
  - `20261015100200_artist_profile_join.sql` (T295): la columna
    `carnets.artist_profile_id` (el id de la ficha de /artistas a la que el
    Admin une un Carnet; única: una ficha, un Carnet; nula en todas las
    filas que ya hay) y las RPC del Admin `admin_join_artist_profile` y
    `admin_unjoin_artist_profile` (rol admin con segundo factor; auditoría
    `join_artist_profile` / `unjoin_artist_profile`). Cambia
    `admin_set_artist`: quitar «artista» también deshace la unión. No toca
    ningún dato. Comprobar después, en el **SQL Editor**:
    `select count(*) from carnets where artist_profile_id is not null;` da 0.
- [ ] Comprobar en producción, en el **SQL Editor**, que no queda ninguna
      función con SECURITY DEFINER en `public` (tiene que salir vacío):
      `select proname from pg_proc where pronamespace = 'public'::regnamespace and prosecdef;`
- [ ] El script se llama `:dev` por historia: aplica al proyecto de las
      variables y **se niega** si `SUPABASE_DB_URL` no es del mismo proyecto
      que `NEXT_PUBLIC_SUPABASE_URL`. Lo que aplica queda apuntado en
      `supabase_migrations.schema_migrations`; repetirlo no hace nada.
- [ ] La primera vez, **con** la muestra: la tienda necesita su catálogo de
      cosméticos. Sin muestra: `pnpm db:migrate:dev -- --no-seed`. Cómo se
      quita la muestra después: paso 13.
- [ ] Una migración nueva de un plan futuro se aplica igual: primero en
      `boia-planet-dev` (los planes lo hacen), después aquí, con el mismo
      comando y las variables de producción.
- [ ] **Nunca** se corren contra producción `pnpm test:supabase`, las e2e con
      `E2E_SUPABASE=1` ni `pnpm db:clean-test-users`: crean y borran cuentas.
- [ ] Sin cerrar aún la terminal: el paso 8 la usa.

## 3. Auth: email con código de 6 cifras

En el proyecto **de producción** (en `boia-planet-dev` ya está):

- [ ] **Authentication → Sign In / Providers → Email**: «Enable Email
      provider» activado; «Confirm email» activado; **Email OTP Length: 6**;
      **Email OTP Expiration: 600** (segundos; es `OTP_EXPIRY_MS` de
      `apps/web/lib/account/config.ts`) → **Save**.
- [ ] En **Authentication → Sign In / Providers**, arriba: «Allow new users
      to sign up» activado (el primer código crea la cuenta).
- [ ] **Authentication → Multi-Factor**: TOTP activado (lo está por
      defecto; el Admin lo necesita).
- [ ] En la misma pantalla de Email: **Minimum password length: 8** (es
      `MIN_PASSWORD_LENGTH` de `apps/web/lib/admin/password-change.ts`; el
      Admin cambia y recupera su contraseña, plan 029 T283).

## 4. El correo: SMTP de Brevo con `hola@boiaplanet.net`

Sin SMTP propio, Supabase **sólo manda correos a los miembros del equipo del
proyecto** (y unos pocos por hora): el público no recibiría su código. Se usa
la cuenta de Brevo que ya existe, con el dominio ya autenticado (DKIM y DMARC,
`docs/DESPLIEGUE.md` §6).

- [ ] Brevo → **SMTP & API → SMTP** → **Generate a new SMTP key**, nombre
      `supabase-auth`. Una clave **aparte** de la de Gmail «Enviar como»: si
      un día se cambia una, la otra sigue. Se ve una sola vez: al gestor de
      contraseñas. En esa misma página está el **login SMTP**
      (`…@smtp-brevo.com`).
- [ ] Supabase (producción) → **Authentication → Emails → SMTP Settings** →
      «Enable custom SMTP»:
  - Sender email: `hola@boiaplanet.net`
  - Sender name: `BOIA`
  - Host: `smtp-relay.brevo.com`
  - Port: `587`
  - Username: el login SMTP de Brevo
  - Password: la clave `supabase-auth`
  - Minimum interval between emails: `60` (segundos; la web enseña esa
    espera, `RESEND_COOLDOWN_S`) → **Save changes**.
- [ ] El plan gratuito de Brevo manda **300 correos al día** en total (contando
      los de Gmail «Enviar como»). Cada acceso es un correo. Si una fiesta
      grande pide más, Brevo tiene planes de pago; decide Álvaro.
- [ ] Recomendado (`docs/DESPLIEGUE.md` §6, «Un solo SPF»): añadir
      `include:spf.brevo.com` al SPF del dominio para que los códigos no
      caigan en spam.

## 5. Plantillas del correo, en español

**Authentication → Emails → Templates** (sólo se pueden editar con el SMTP
propio ya guardado). Ninguna lleva `{{ .ConfirmationURL }}`: no hay enlace
mágico, sólo el código.

- [ ] **Magic Link** (lo recibe quien ya tiene cuenta) y **Confirm signup**
      (lo recibe un email nuevo), las dos igual:
  - Subject: `Tu código de BOIA: {{ .Token }}`
  - Message body (pestaña «Source», entero):

    ```html
    <h2>Tu código de BOIA</h2>
    <p>Escribe este código en BOIA.PLANET para entrar:</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
    <p>Caduca en 10 minutos. Si no lo has pedido tú, ignora este correo.</p>
    <p>BOIA · Alicante · boiaplanet.net</p>
    ```

  - **Save changes** en cada una.
- [ ] El texto es `muestra`: Álvaro puede cambiarlo, siempre con
      `{{ .Token }}` y sin enlace.
- [ ] **Reset Password** (el de «He olvidado la contraseña» del Admin, plan 029
      T283). Este **sí** lleva el enlace, porque es lo que abre la página
      para elegir contraseña:
  - Subject: `Cambia tu contraseña del Admin de BOIA`
  - Message body (pestaña «Source», entero):

    ```html
    <h2>Cambia tu contraseña</h2>
    <p>Pulsa el botón para elegir una contraseña nueva del Admin de BOIA.PLANET:</p>
    <p><a href="{{ .ConfirmationURL }}">Elegir contraseña nueva</a></p>
    <p>Si no lo has pedido tú, ignora este correo: tu contraseña sigue igual.</p>
    <p>BOIA · Alicante · boiaplanet.net</p>
    ```

  - **Save changes**. Si Supabase no usa la URL de redirección que manda la
    web (`/admin/recuperar`), el enlace no abre la página: revisa el paso 7.

## 6. Límites de Auth

**Authentication → Rate Limits**. Los límites son **por IP**, y en una fiesta
mucha gente comparte la misma (el Wi-Fi o la antena del sitio):

Valores elegidos por Álvaro el 2026-10-14 (el tope real es el de Brevo gratis:
300 correos al día):

- [x] **Rate limit for sending emails**: `250` por hora.
- [x] **Rate limit for token verifications** (códigos comprobados): `500`.
- [x] **Rate limit for sign ups and sign ins**: `500` (estos dos últimos, por IP).
- [ ] **Save changes**.

## 7. URL de Auth: los dos hosts

**Authentication → URL Configuration** (aunque no haya enlaces, Supabase sólo
acepta los orígenes apuntados; `docs/DESPLIEGUE.md` §3):

- [ ] **Site URL**: `https://boiaplanet.net` → **Save changes**.
- [ ] **Redirect URLs** → **Add URL**, una a una, y **Save URLs**:
  - `https://boiaplanet.net/**`
  - `https://www.boiaplanet.net/**`
  - `https://boia-planet-roan.vercel.app/**` (la copia)
  - `https://boia-planet.boiaplanet-bp.workers.dev/**` (el Worker sin dominio)
- [ ] En producción **sin** `localhost` (eso es de `boia-planet-dev`).
- [ ] La recuperación de la contraseña del Admin vuelve a
      `<host>/admin/recuperar`; ya la cubren los `/**` de arriba (los cuatro
      hosts). Si quitas alguno, esa URL tiene que seguir en la lista (plan 029
      T283).

## 8. El propietario del Admin

En la terminal del paso 2 (con las variables de producción):

```sh
pnpm admin:grant -- admin@boiaplanet.net owner    # owner | admin | editor | none
```

- [ ] Da el rol a ese email (si no tiene cuenta, la crea confirmada) y queda
      en la auditoría. Nunca imprime una clave.
- [ ] Esa persona entra en `https://boiaplanet.net/admin` (después del paso
      10): email → código → **alta del TOTP** con el QR (Google
      Authenticator, 1Password…) → dentro; genera ahí sus códigos de
      respaldo y los guarda en el gestor de contraseñas.
- [ ] Un segundo propietario, si lo hay, con el mismo comando: con dos,
      si uno pierde el móvil el otro le arregla el acceso.
- [ ] El **Carnet 000** para la cuenta del Admin, cuando ya tenga rol (arriba)
      y haya creado su Carnet en la web (después del paso 10), en una
      terminal con las variables de producción:

      ```sh
      pnpm admin:carnet0 -- admin@boiaplanet.net
      ```

      Llama a `assign_admin_carnet` con la clave de servicio (no hace falta el
      editor SQL); su número anterior queda libre y el cambio queda en la
      auditoría. Repetirlo no cambia nada. Nunca imprime una clave. Si la
      cuenta no tiene rol admin u owner o aún no tiene Carnet, lo dice.
- [ ] **Cerrar la terminal** (las claves de producción se quedan en ella).

## 9. La política de privacidad (antes de recoger emails reales)

**Hecho el 2026-10-14 (plan 030, T291).** Álvaro aprobó el texto: responsable
BOIA PLANET (CIF en trámite), Calle Hondón de las Nieves, 7, 03005 Alicante,
contacto `hola@boiaplanet.net`; encargados Supabase (UE) y Brevo
(`legal.privacy.account.*` y `legal.privacy.*` de `apps/web/lib/i18n/`, juntas
por `PRIVACY_WITH_ACCOUNTS`, `apps/web/lib/legal/docs.ts`).

- [x] `PRIVACY_POLICY_VERSION` (`apps/web/lib/account/config.ts`) es ahora
      `2026-10-14`: cada consentimiento guarda la versión aceptada y su fecha.
- [ ] Ese cambio va en un commit a `main` **antes** del paso 10 (o en el
      mismo push).

## 10. Encender: las dos variables en los DOS hosts

Las dos variables, **con los mismos valores en los dos hosts** (los del
proyecto de producción, paso 1). Sólo esas dos: `SUPABASE_SERVICE_ROLE_KEY`
y `SUPABASE_DB_URL` **nunca** van a un host.

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref-de-prod>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_…` de producción |

- [ ] **Cloudflare** (la pública): dash.cloudflare.com → **Workers & Pages**
      → Worker `boia-planet` → **Settings** → **Build** → **Variables and
      secrets** (las del *build*, no las de *runtime*) → **Add** → las dos,
      tipo *Text* → **Save**. Junto a `PNPM_VERSION` y `NODE_VERSION`, que
      ya están.
- [ ] **Vercel** (la copia): vercel.com → el proyecto → **Settings** →
      **Environment Variables** → **Add New** → las dos, entorno
      **Production** (Preview sin marcar, para que las previews sigan en modo
      local) → **Save**.
- [ ] **Un push a `main`** (el de la política del paso 9, o cualquier otro):
      las `NEXT_PUBLIC_*` van **dentro** del build, así que sin construir de
      nuevo no cambian nada. El push reconstruye los dos a la vez.
- [ ] Esperar a que los dos builds salgan verdes: Cloudflare → Worker →
      **Deployments**; Vercel → **Deployments**.
- [ ] GitHub → **Actions** → `hosts-parity` → **Run workflow**: verde (los
      dos sirven el mismo commit). Ojo: esa prueba **no** mira si las cuentas
      están encendidas; lo dice el paso 12.

**Para apagarlo** (vuelta al modo local): quitar las dos variables en los
dos hosts y otro push. Las cuentas siguen guardadas en Supabase y vuelven al
encender.

## 11. GitHub: copias y despertador del proyecto nuevo

Hoy los flujos programados apuntan a `boia-planet-dev`. GitHub → el repo →
**Settings → Secrets and variables → Actions**:

- [ ] Secrets `SUPABASE_URL` y `SUPABASE_ANON_KEY` (flujo
      `supabase-keepalive`): los de **producción** (la URL del paso 1 y su
      clave *anon* de «Legacy API keys», la `eyJ…`: el `curl` del flujo la
      usa así).
- [ ] Secret `SUPABASE_DB_URL` (flujo `supabase-backup`): la de
      **producción**. Más `BACKUP_PASSPHRASE` si aún no está
      (`plans/seguridad-pendiente.md`, «Urgente»).
- [ ] Actions → `supabase-keepalive` → **Run workflow** → verde; lo mismo con
      `supabase-backup`.

## 12. Comprobar que funciona (después del push)

- [ ] En una terminal: `curl -sI https://boiaplanet.net/mar | grep -i
      content-security-policy` y lo mismo con
      `https://boia-planet-roan.vercel.app/mar`. Las dos llevan
      `https://<ref-de-prod>.supabase.co` y `wss://<ref-de-prod>.supabase.co`
      en `connect-src`. Si sólo una la lleva, falta la variable (o el build)
      en el otro host.
- [ ] Con un email real **que no sea del equipo de Supabase**, en el móvil, en
      `https://boiaplanet.net/mar`:
  1. Navegar un poco y ganar algunos puntos sin cuenta.
  2. **Mi Carnet → Crear mi Carnet**: pide el email.
  3. Llega en menos de un minuto un correo de «BOIA <hola@boiaplanet.net>»
     con el código, en español (mirar también en spam).
  4. Un código mal escrito dice que no vale; el bueno sigue al apodo.
  5. Apodo, aceptar la política → el Carnet sale con su número de socio y los
     puntos de antes siguen ahí.
  6. Supabase (producción) → **Authentication → Users**: está el email.
     **Table Editor → carnets**: está el apodo.
  7. **Cerrar sesión** en Mi Carnet y volver a entrar con otro código: el
     mismo Carnet.
  8. **Borrar la cuenta** (escribiendo el apodo): desaparece de
     Authentication → Users.
- [ ] Lo mismo, una vez, en `https://boia-planet-roan.vercel.app/mar` (la
      copia usa la misma base: la cuenta creada en un host entra en el otro).
- [ ] `/admin` con la cuenta del paso 8 (email, código, TOTP).
- [ ] Contraseña del Admin (plan 029 T283): en `/admin`, **Seguridad →
      Cambiar contraseña** (dos veces) y volver a entrar con la nueva; y
      «He olvidado la contraseña» → llega el correo → el enlace abre
      `/admin/recuperar` → TOTP → contraseña nueva → entrar. Probar el enlace
      en los dos hosts.
- [ ] Si algo falla: Supabase → **Logs → Auth** (¿llegó la petición?) y
      Brevo → **Transactional → Logs** (¿salió el correo?).

## 13. Más adelante

### Las fiestas reales y sus QR

En `/admin` → **Fiestas y QR**, por cada fiesta real: la ventana del sello
(desde / hasta) → «Guardar ventana» → «Crear el QR»; la imagen del sello (PNG,
WebP o JPEG, ≥ 512 px, ≤ 2 MB); «Descargar PNG», «Imprimir o PDF» o
«Proyectar QR». «Regenerar código» invalida el QR anterior.

### La radio: «La Sosia», la primera canción (plan 030 T290)

Con cuentas, la radio (landing y barco de `/mar`) lee la tabla compartida
`radio_songs`, no el catálogo que trae la web; mientras la tabla tenga alguna
canción, «La Sosia» del repositorio (`apps/web/public/radio/real/la-sosia.mp3`,
sólo para el modo local) no suena aquí. La primera vez que se enciende la
radio suena la canción marcada **Primera**; después, al azar (o en orden, si
se apaga el aleatorio). Lo hace Álvaro (o el orquestador), a mano:

- [ ] `/admin` → **Radio** → subir el MP3 original de «La Sosia» (el mismo
      archivo que está en `apps/web/public/radio/real/la-sosia.mp3`). Título
      «La Sosia», artista «Koko Moreno, Tonito Montana», género
      **Reggaetón**.
- [ ] En su fila, **Hacer primera** (usa `radio_set_first`). Sólo una
      canción puede serlo; la de prueba que hubiera deja de serlo.
- [ ] Si se quiere, quitar la canción de prueba subida el 2026-10-14.
- [ ] Comprobar en una ventana privada, en los dos hosts, en la landing y en
      `/mar`: el primer toque a la radio pone «La Sosia».

### Quitar la muestra

Cuando Álvaro dé lo real (eventos, cosméticos, descuentos, importes):

- [ ] Cargar lo real primero (eventos, descuentos y catálogo de cosméticos).
- [ ] Ajustar los importes `muestra` (P24) con una migración nueva (primero
      en dev, después aquí con el paso 2).
- [ ] En el **SQL Editor** de producción, pegar y ejecutar
      `supabase/sample/remove-sample.sql`. Falla entero, sin borrar nada, si
      algo real depende de la muestra.

## Para saber

- **`pnpm db:clean-test-users`** (sólo `boia-planet-dev`): borra las cuentas
  de prueba `@example.test` que dejan las ejecuciones cortadas de
  `pnpm test:supabase` o de las e2e. Nunca toca otro dominio.
- **`pnpm db:types:dev`** regenera `packages/db/src/database.types.ts` desde
  el proyecto de las variables (en desarrollo, tras una migración nueva).
- En `boia-planet-dev` no hay propietario de verdad: si se da a una cuenta de
  prueba el rol `owner`, el disparador «último propietario» impide borrarla
  (pasó en el plan 023; la prueba de T223 ya no lo hace).
- El detalle de cada pieza: `README.md`, «Cuentas con Supabase»; los hosts:
  `docs/DESPLIEGUE.md`.
