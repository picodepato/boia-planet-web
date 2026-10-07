# Guía de prueba — plan 017: descuentos en la landing, rankings, Admin, cuenta y calidad

> Para Hernán. El plan 017 ([plan](../../plans/017-admin-rankings-calidad.md), T187–T203)
> junta lo que eligió el 2026-10-07: la línea «Consigue descuentos» bajo «Zarpar», el ranking
> entero desde el menú, el Admin con fotos de verdad, objetos nuevos, moderación y enlaces,
> la entrada al Admin con el Carnet 000, la descarga de los datos de la cuenta, los huecos del
> plan 008, la taquilla de Halloween y el Sonido, la tienda que rota imágenes y trabajo de
> calidad. Quiere contestar: **¿se publica así y qué falta para enseñárselo a Álvaro?** Las
> respuestas van al final («Notas»). T202 (carteles e imágenes de producto inventados) se
> saltó: la tienda sigue con los placeholders «MUESTRA» y los eventos con sus carteles de hoy.

## Qué cambia

### Landing (T187, T199, T201, T203)

- **«Consigue descuentos»** bajo «Zarpar» (`muestra`), con un destello suave cada 8 s; quieto
  con movimiento reducido.
- **Halloween y el Sonido no se compran en la web**: «Comprar entradas» enseña «Entradas sólo
  en taquilla, el mismo día. Enseña tu Carnet BOIA en la puerta y te descontamos 2 €.» y debajo
  «¿Aún no tienes Carnet? Hazte el tuyo» con el botón al Carnet. Igual en la landing, en la
  página del evento y en su isla de `/mar`. Los demás eventos, con su compra de siempre. El
  código escondido NAUFRAGO10 pasó del Sonido a Nochevieja.
- **Tienda**: cada producto rota tres imágenes (sola, otro ángulo, con modelo) cada 3,5 s,
  quieta con movimiento reducido, al pasar el puntero o fuera de pantalla. «Comprar» abre
  «Sólo a la venta en la fiesta. Si quieres una, escríbenos por Instagram a @boia.planet» con
  el enlace. Las imágenes son placeholders con el rótulo «MUESTRA».
- **Cabecera**: «Ranking» (abre la página nueva `/ranking`) y, con sesión, **«Cerrar sesión»**
  junto al Carnet, sólo en la landing. En escritorio la fila de enlaces empieza a 1200 px (de
  900 a 1199 px van en «Menú») y el cierre de sesión es un icono; nada se parte en dos líneas.
- **Peso**: 195,3 kB gzip de 200 (al empezar el plan, 185,5).

### Rankings (T188, T194)

- **Cuatro pestañas** en el ranking de `/mar` y de `/ranking`: **Carrera** (Los Rápidos, sin
  desplegable), **Cañón** (desplegable Fantasma / Kraken), **Castillo** (desplegable con las 9
  tablas: Tranquila, Normal, Tormenta × 5, 7, 10 min) y **Puntos**.
- **Sin «Arcilla» a la vista**: el mundo se llama «Mundo principal», el barco B05 «Botijo»
  (también sus skins). Los ids internos no cambian.
- **Huecos del plan 008**: con 0 puntos sale «sin puntos», sin puesto (los empates con puntos
  se quedan); tras un sello, «Puntos a → b» y «Ahora eres …»; tu botella sale siempre en la
  lista aunque no esté entre las 10 más recientes.

### Admin (T189, T190, T191, T192, T193)

- **Entrada con el Carnet 000** (decisión 9). Modo local: Carnet 000 + la contraseña de la demo
  (sólo hay un hash en el repo; la sesión dura 12 h; «Salir del Admin» en el aviso de la demo).
  Con cuentas: Carnet 000 + la contraseña de esa cuenta + el TOTP; el resto del equipo sigue
  entrando con el código del email.
- **Fotos de una isla** (Fotos y vídeos): eliges isla y evento, subes archivos de verdad (se
  pasan a WebP, ≤ 1600 px) con su texto alternativo y «Marcar el evento como pasado». Sin
  aprobación: se publica al momento. La isla enseña el evento como recuerdo con 6 fotos y «Ver
  las N fotos». En local, los archivos quedan en el navegador; con cuentas, en el bucket
  `event-photos`.
- **Objetos** (sección nueva): un objeto nuevo en 10 pasos, cinco plantillas de serie
  (`muestra`) y las tuyas, validación del archivo (formato real, peso, tamaño, `.glb`) y del
  sitio (no en tierra; agua donde llega el barco). Un objeto publicado sale en `/mar` con el
  modelo de su categoría (el archivo subido aún no se dibuja).
- **Moderación**: ocultar / mostrar un Carnet entero, retirar / devolver su apodo o su foto,
  devolver al mar una botella retirada y anular / devolver una entrada de la carrera, el Cañón o
  el Castillo, con motivo. En la demo y, con la migración aplicada, con datos reales.
- **Enlaces** (sección nueva): el contacto de «Comprar» de la tienda, el correo y los enlaces de
  Contacto y los del pie, sólo `http(s)`; salen en la web al «Publicar».
- **Seguridad** (sólo con cuentas): 10 códigos de respaldo de un solo uso para cuando falte el
  móvil del TOTP; usar uno borra el TOTP perdido y pide dar de alta otro.

### Cuenta (T193)

- **«Descargar mis datos»** bajo el Carnet propio (`/carnet` y Mi Carnet de `/mar`): un JSON
  con lo tuyo y nada de nadie más ni secretos. Con cuentas añade lo que guarda la base.
- **El Carnet 000 queda reservado** para el Admin: ninguna alta lo recibe.

### Calidad (T195, T196, T197)

- Los textos del mundo salen de las claves de i18n (sin cambio visible).
- E2E al día: REQ-PRO-006 y REQ-MUN-009 con prueba, la matriz de dispositivos sin pruebas
  borradas, las grabaciones con el «Zarpar» de ahora y «guía: mover» estable.
- Vídeos perezosos (`LazyVideo`, aún no hay vídeos de contenido) y la tarjeta «Construir» de
  Ibiza del castillo con el pago real de la siguiente (100 / 70 / 50 %).

## Cómo probarlo rápido

En `pnpm dev`, o en la versión publicada (modo local).

| Dónde | Qué mirar |
|---|---|
| `/` | «Consigue descuentos» bajo «Zarpar»; Entradas → Halloween → el aviso de taquilla y «Hazte el tuyo»; la tienda rotando y su «Comprar» |
| `/` a 1024, 1280 y 1440 px | La cabecera en una línea; «Ranking» lleva a `/ranking` |
| `/ranking` y `/mar` → menú → Ranking | Las cuatro pestañas; Cañón con 2 tablas, Castillo con 9 |
| `/mar` → isla de Halloween → Comprar | El mismo aviso; «Hazte el tuyo» abre Mi Carnet |
| `/admin` | Pide Carnet 000 + contraseña; una mal no entra |
| `/admin` → Fotos y vídeos → Fotos de una isla | Subir 2–3 fotos a un evento con isla; después, esa isla en `/mar` → el recuerdo con su galería |
| `/admin` → Objetos | Crear uno desde «Cofre» en los 10 pasos, publicarlo y verlo en `/mar` |
| `/admin` → Moderación | Ocultar un Carnet de muestra → desaparece de `/carnet/<id>`; mostrarlo → vuelve |
| `/admin` → Enlaces | Cambiar un enlace del pie, «Publicar» → sale en la landing |
| `/carnet` | Crear el Carnet y «Descargar mis datos» |

Con cuentas (`boia-planet-dev`, después de las migraciones de abajo): `/admin` con Carnet 000 +
contraseña + TOTP → «Seguridad» → generar los códigos; entrar otra vez con uno de ellos; en
Moderación, ocultar un Carnet real y anular una entrada del Castillo; en la landing con sesión,
«Cerrar sesión».

## Migraciones

| Migración | Tarea | `boia-planet-dev` | Producción |
|---|---|---|---|
| `20261007100100_event_photos.sql` (tablas `event_albums`, `event_photos`, bucket `event-photos`) | T189 | **Aplicada** el 2026-10-07 (`test:supabase` 98/98) | Al publicar con cuentas |
| `20261007100200_moderation.sql` (moderación de Carnets, botellas y rankings) | T191 | **Sin aplicar** | Al publicar con cuentas |
| `20261007100400_admin_access_export.sql` (Carnet 000, códigos de respaldo, `export_my_data`) | T193 | **Sin aplicar** | Al publicar con cuentas |

T192 y T194 no necesitaron migración (sus números `…100300` y `…100500` quedan sin usar).

En `boia-planet-dev`, desde la raíz del repo:

1. `pnpm db:migrate:dev` → aplica las dos que faltan, en orden. La semilla de economía cambió
   (T188, «Botijo») y se vuelve a pasar, pero con `on conflict do nothing` no renombra lo ya
   sembrado; para eso, en el editor SQL:
   `update public.cosmetics set name = 'Botijo, maqueta' where id = 'barco-arcilla';`
   `update public.cosmetics set name = 'Botijo · Noche' where id = 'skin-arcilla-noche';`
   `update public.cosmetics set name = 'Botijo · Fiesta' where id = 'skin-arcilla-fiesta';`
2. `pnpm db:types:dev` → debería no dar diferencias con los tipos escritos a mano.
3. **La cuenta del Admin**: rol con `pnpm admin:grant -- <email> owner`, su Carnet creado en la
   web, una contraseña puesta en el panel (Authentication → Users) y el Carnet 000 en el editor
   SQL: `select private.assign_admin_carnet((select id from auth.users where email = '<email>'));`.
   Mejor una cuenta dedicada: quien escriba «000» puede saber su email.
4. `pnpm test:supabase` (suma `moderation.supabase.ts` y `admin-access.supabase.ts`).
5. E2E con cuentas: `E2E_SUPABASE=1 E2E_PORT=<libre> pnpm e2e admin-real.spec.ts
   landing-logout.spec.ts ranking.spec.ts --workers=1`, y una subida de fotos a mano en
   `/admin` (no hay e2e con cuentas para eso).

En producción, el mismo `pnpm db:migrate:dev` con las variables del proyecto de producción
(lista de [producción con Supabase](2026-10-03-produccion-supabase.md), paso 2), los pasos 3 y
4 sin las cuentas de prueba, y nada más hasta que se publique con cuentas.

## Qué contestar

1. ¿La línea «Consigue descuentos» y su destello invitan a zarpar sin molestar?
2. ¿El aviso de taquilla de Halloween y el Sonido se entiende? ¿Hace falta poder marcar la
   taquilla desde el Admin (hoy va en el contenido)?
3. ¿El ranking con cuatro pestañas y desplegables se lee bien en el móvil? ¿«Mundo principal»
   vale como nombre visible?
4. ¿Subir fotos de una isla y marcar el evento como pasado va como esperabas? ¿Probamos una
   subida real con cuentas?
5. **Contraseña del Admin de la demo**: el hash está en un repo público y la contraseña es
   adivinable sin conexión. ¿Una más larga (nuevo hash, nunca el texto) o el hash en una
   variable de Vercel?
6. ¿Cuenta dedicada para el Carnet 000 (su email se puede averiguar)? ¿Y poner
   `/admin/vista-previa` detrás de la misma puerta?
7. La landing está en 195,3 de 200 kB: ¿se mira el peso antes de añadir más, o se sube el tope?
8. Cuando vuelva Codex, ¿se hace T202 (carteles e imágenes de producto inventados, `muestra`)?
9. El logro de muestra «Entre dos mundos» pide navegar en Acuarela, que está oculta: ¿se oculta
   o se reescribe?

## Lo que hace Hernán

- Las migraciones y la cuenta del Admin en `boia-planet-dev` (arriba) y las e2e con cuentas.
- Contestar las preguntas.
- Para Álvaro: los textos nuevos (`muestra`: «Consigue descuentos», taquilla, tienda, Admin),
  las imágenes de la tienda y los carteles, y los enlaces reales del pie, Contacto y la tienda
  (ya editables en Admin → Enlaces).

## Notas
