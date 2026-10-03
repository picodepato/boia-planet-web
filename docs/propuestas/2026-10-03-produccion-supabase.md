# Lista de producción con Supabase

Para Hernán (plan 008, T95, 2026-10-03). Qué hacer, en orden, para que la
web publicada tenga cuentas por email, Carnets, sellos por QR, rankings y
botellas globales y el Admin con TOTP (borrador
[D-27](2026-10-03-d27-borrador.md)). Mientras no se haga, la producción sigue
en modo local (D-20): sin las variables de Supabase todo funciona en el
navegador, como hoy.

Ninguna clave va en el repositorio, en este documento ni en un chat: sólo en
el panel de Vercel, en `apps/web/.env.local` (desarrollo, fuera de git) o en
la terminal de quien corre un script.

Los pasos del panel siguen los nombres del panel de Supabase de octubre de
2026; si un menú ha cambiado de sitio, el ajuste se llama igual.

## 0. Antes de empezar

- [ ] **El dominio definitivo** (P27 del borrador). Se puede empezar con el
      de prueba, https://boia-planet-roan.vercel.app, que es **temporal**:
      cuando llegue el dominio, repetir los pasos 4 (remitente), 6 (URL)
      y 7 (Vercel).
- [ ] **Textos legales** (P21): la política de privacidad con cuentas es
      `muestra` (`PRIVACY_WITH_ACCOUNTS` en `apps/web/lib/legal/docs.ts`). Si
      se publica antes de P21, que sea sabiendo que el aviso «muestra» sale
      arriba. Al cambiar la política, subir `PRIVACY_POLICY_VERSION`
      (`apps/web/lib/account/config.ts`; hoy `muestra-2026-10-03`): cada
      consentimiento guarda la versión aceptada.
- [ ] **El uso de la lista de emails** (P23): qué se manda a quien marcó
      «noticias» y con qué herramienta. Hasta saberlo, el CSV de Admin →
      Socios y emails no se usa.

## 1. Un proyecto de producción aparte

- [ ] https://supabase.com/dashboard → **New project**: nombre
      `boia-planet` (no reutilizar `boia-planet-dev`), región de la UE (p.
      ej. Frankfurt), contraseña de la base larga y aleatoria, guardada en
      el gestor de contraseñas.
- [ ] **Plan**: el gratuito pausa el proyecto tras una semana sin uso y no da
      copias diarias. Para producción, **Pro** (copias diarias; REQ-ARQ-023).
- [ ] Desarrollo y producción no se mezclan nunca: `pnpm test:supabase`, las
      e2e con `E2E_SUPABASE=1` y `pnpm db:clean-test-users` crean o borran
      cuentas y **sólo se corren contra `boia-planet-dev`**.
- [ ] Apuntar dónde está cada valor (los nombres son los de `.env.example`):
  - `NEXT_PUBLIC_SUPABASE_URL`: Project Settings → Data API → Project URL.
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Project Settings → API Keys →
    publishable key (va al navegador).
  - `SUPABASE_SERVICE_ROLE_KEY`: Project Settings → API Keys → secret key
    (sólo scripts; la web publicada no la usa).
  - `SUPABASE_DB_URL`: botón **Connect** → Session pooler (sólo scripts).

## 2. Las migraciones

Los scripts leen las variables de la terminal antes que las de
`apps/web/.env.local` (una variable definida gana al archivo). Para apuntar
al proyecto de producción, en una terminal nueva (Git Bash), desde la raíz
del repo:

```sh
export NEXT_PUBLIC_SUPABASE_URL='https://<ref-de-prod>.supabase.co'
export NEXT_PUBLIC_SUPABASE_ANON_KEY='<publishable de prod>'
export SUPABASE_SERVICE_ROLE_KEY='<secret de prod>'
export SUPABASE_DB_URL='postgresql://postgres.<ref-de-prod>:<contraseña>@<host>:5432/postgres'
pnpm db:migrate:dev            # las 14 migraciones y la muestra
pnpm db:migrate:dev            # otra vez: «0 aplicadas … (al día)»
```

- [ ] El script se llama `:dev` por historia: aplica a cualquier proyecto
      cuyas variables estén puestas, y **se niega** si `SUPABASE_DB_URL` no
      es del mismo proyecto que `NEXT_PUBLIC_SUPABASE_URL`.
- [ ] La primera vez, con la muestra: la tienda necesita su catálogo de
      cosméticos, y los eventos y descuentos de muestra sirven para probar.
      Sin muestra: `pnpm db:migrate:dev -- --no-seed` (sólo migraciones).
      Cómo se quita la muestra después: paso 10.
- [ ] Cerrar esa terminal al terminar (las claves se quedan en ella).

## 3. Auth: email con código de 6 cifras

En el proyecto de producción (en `boia-planet-dev` ya está hecho):

- [ ] **Authentication → Sign In / Providers → Email**: «Enable Email
      provider» activado; «Confirm email» activado; **«Email OTP Length»:
      6**; **«Email OTP Expiration»: 600** (segundos; coincide con
      `OTP_EXPIRY_MS`); **Save**.
- [ ] Que se puedan crear cuentas nuevas («Allow new users to sign up»,
      activado): el código crea la cuenta la primera vez.
- [ ] **Authentication → Multi-Factor**: TOTP activado (lo está por
      defecto). El Admin lo necesita (`aal2`).

## 4. SMTP propio

El correo de Supabase sin SMTP propio **sólo llega a los miembros del equipo
del proyecto** y a unos 2 por hora: el público no recibiría su código. Y sin
SMTP propio el panel no deja editar las plantillas (paso 6).

**Authentication → Emails → SMTP Settings** → «Enable custom SMTP»:

- [ ] **Para probar (lo que tiene hoy `boia-planet-dev`): Gmail con
      contraseña de aplicación.** La cuenta de Google necesita la
      verificación en dos pasos; la contraseña de aplicación se crea en
      https://myaccount.google.com/apppasswords. Host `smtp.gmail.com`,
      puerto `465` (o `587`), usuario el Gmail entero, contraseña la de
      aplicación (16 letras), remitente ese mismo Gmail, nombre «BOIA».
      Gmail limita a unos cientos de destinatarios al día: vale para probar,
      no para el público.
- [ ] **Para producción: Resend con el dominio definitivo.** En
      https://resend.com: añadir el dominio, poner en su DNS los registros
      que pide (SPF y DKIM; DMARC recomendado) y esperar a «Verified»; crear
      una API key con permiso de envío. En Supabase: host `smtp.resend.com`,
      puerto `465`, usuario `resend`, contraseña la API key, remitente
      `no-responder@<dominio>` (o el que elija BOIA), nombre «BOIA».
- [ ] **Authentication → Rate Limits**: subir los correos por hora a lo que
      se espere en una fiesta (cada acceso es un correo).

## 5. Plantillas en español (después del SMTP)

**Authentication → Emails → Templates**. Ninguna plantilla lleva
`{{ .ConfirmationURL }}`: no hay enlace mágico (D-27, punto 2).

- [ ] **Magic Link** (lo recibe quien ya tiene cuenta):
  - Subject: `Tu código de BOIA: {{ .Token }}`
  - Message body (en «Source», entero):

    ```html
    <h2>Tu código de BOIA</h2>
    <p>Escribe este código en BOIA.PLANET para entrar:</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
    <p>Caduca en 10 minutos. Si no lo has pedido tú, ignora este correo.</p>
    <p>BOIA · Alicante</p>
    ```

  - **Save changes**.
- [ ] **Confirm signup** (lo recibe un email nuevo): el mismo Subject y el
      mismo cuerpo → **Save changes**.
- [ ] Lo mismo en `boia-planet-dev`, que ya tiene SMTP (Gmail) y aún podría
      tener las plantillas por defecto (pasos 3 y 4 de T89 en `ESTADO.md`).

## 6. URL de Auth

**Authentication → URL Configuration**:

- [ ] Site URL: el dominio definitivo, o
      `https://boia-planet-roan.vercel.app` mientras no lo haya → **Save
      changes**.
- [ ] Redirect URLs → **Add URL**: `https://<dominio>/**` → **Save URLs**.
      En producción, sin `localhost` (eso es de `boia-planet-dev`).

## 7. Variables en Vercel

En el proyecto de Vercel que sirve la web: _Settings → Environment
Variables_.

- [ ] **Production**: `NEXT_PUBLIC_SUPABASE_URL` y
      `NEXT_PUBLIC_SUPABASE_ANON_KEY` del proyecto de **producción**. Son las
      únicas que la web usa. `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_DB_URL`
      **no** van a Vercel: sólo las usan los scripts, en la terminal.
- [ ] **Preview** (opcional): las dos de `boia-planet-dev` para probar ramas
      con cuentas, o nada para que las previews sigan en modo local.
- [ ] **Volver a desplegar** (_Deployments → Redeploy_ o un push): las
      `NEXT_PUBLIC_*` se meten en el build; cambiarlas sin desplegar no hace
      nada.
- [ ] Comprobar: `curl -I https://<dominio>/` enseña en
      `content-security-policy` la URL de Supabase en `connect-src` (la CSP
      la abre sólo cuando la variable existe).

## 8. El propietario del Admin

Con las variables de producción en la terminal (como en el paso 2):

```sh
pnpm admin:grant -- <email> owner      # owner | admin | editor | none
```

- [ ] Da el rol a ese email (si no tiene cuenta, la crea confirmada) y queda
      en la auditoría; `none` lo quita (el último propietario no se puede
      quitar). Nunca imprime una clave.
- [ ] Esa persona entra en `https://<dominio>/admin`: email → código de 6
      cifras → **alta del TOTP** con el QR (Google Authenticator, 1Password…)
      → dentro. Sin rol, «Sin acceso».
- [ ] **Un segundo propietario** (Hernán y Álvaro): no hay códigos de
      respaldo; si alguien pierde el móvil, otro propietario o el script
      quitan y vuelven a dar el rol, y el factor TOTP viejo se borra en el
      panel de Supabase (Authentication → Users, en esa cuenta).
- [ ] Los demás del equipo, con `admin` o `editor` (un editor entra, pero no
      usa las cuatro secciones reales).

## 9. Las fiestas reales y sus QR

En `/admin` → **Fiestas y QR**, por cada fiesta real:

- [ ] La ventana del sello (desde / hasta, la duración de la fiesta) →
      «Guardar ventana» → «Crear el QR».
- [ ] La imagen del sello: archivo PNG, WebP o JPEG de al menos 512 px y
      hasta 2 MB, o una URL https. Sin imagen sale el sello generado.
- [ ] «Descargar PNG» o «Imprimir o PDF» para el cartel de la puerta;
      «Proyectar QR» para la pantalla. «Regenerar código» invalida el QR
      anterior (si se filtra).

## 10. Quitar la muestra

Cuando Álvaro haya dado lo real (eventos, cosméticos, descuentos, importes):

- [ ] Cargar lo real primero (eventos y descuentos reales; el catálogo de
      cosméticos real).
- [ ] Ajustar los importes `muestra` (P24) con una migración nueva: los
      topes de `point_actions`, los 50 puntos del sello y los tiempos
      mínimo y máximo de `circuits` (El Freu: 45–300 s).
- [ ] En el **SQL Editor** de producción, pegar y ejecutar
      `supabase/sample/remove-sample.sql`. Quita eventos, islas, temporadas,
      logros, mundo, home, **cosméticos y descuentos** de muestra (y los
      códigos de sello de esos eventos). Falla entero, sin borrar nada, si
      algo real depende de la muestra (una cuenta que compró un cosmético
      de muestra, por ejemplo).

## 11. Copias y comprobación final

- [ ] Con Pro, comprobar en **Database → Backups** que hay copia diaria, y
      apuntar una restauración de prueba (REQ-ARQ-023, en `docs/entrega.md`).
- [ ] Con un email real (que no sea del equipo): entrar en `/mar`, crear el
      Carnet (llega el correo en español con el código), comprar una skin,
      correr y salir en el ranking, echar una botella, abrir el QR de una
      fiesta dentro de su ventana y ver el sello en el reverso, borrar la
      cuenta.
- [ ] En `/admin`: el CSV de Socios y emails trae sólo a quien marcó
      noticias.
- [ ] `docs/entrega.md`: actualizar la URL pública y las filas 9, 11 y 16.

## Para saber

- **`pnpm db:clean-test-users`** (sólo `boia-planet-dev`): borra las cuentas
  de prueba `@example.test` que dejan las ejecuciones cortadas de
  `pnpm test:supabase` o de las e2e. Por defecto, las de hace más de 30 min;
  `pnpm db:clean-test-users -- --all`, todas; `-- --minutes N`, otro margen.
  Nunca toca una cuenta de otro dominio. `pnpm test:supabase` ya limpia lo
  suyo al empezar y al acabar.
- **`pnpm db:types:dev`** regenera `packages/db/src/database.types.ts` desde
  el proyecto de las variables: tras una migración nueva, en desarrollo.
- El detalle de cada pieza: `README.md`, «Cuentas con Supabase».
