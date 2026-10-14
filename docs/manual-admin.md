# Manual del Admin de BOIA.PLANET

Para quien lleva el Admin (Álvaro y el equipo de BOIA). Explica lo que el
Admin de la versión de prueba ya hace para no romper nada al borrar o publicar
(T48) y el procedimiento **a mano** para las peticiones de datos personales
(REQ-ADM-031).

> **Versión de prueba (D-20).** El Admin se abre con «Probar admin», sin login,
> y todo lo que se cambia se queda en **este navegador**. Nadie más lo ve. Los
> datos de los visitantes también viven en el navegador de cada visitante: el
> Admin no los ve. Donde este manual dice «con Supabase» describe la versión
> final, que todavía no existe.

## 1. Publicar la home y los eventos (REQ-ADM-015, REQ-ADM-017)

- **Página principal** trabaja siempre en **borrador**: ordenar, mostrar u
  ocultar y programar bloques, titular y subtítulo de la portada, textos de los
  botones «Explorar» y «Tickets», evento prioritario y eventos excluidos de
  «Próximos eventos». Nada de eso se ve en la web hasta pulsar **Publicar**.
- En **Eventos**, «Guardar borrador» deja el evento en el borrador;
  «Guardar y publicar» lo publica en el momento. Cambiar el estado desde la
  lista (agotado, cancelado…) se publica al momento y el borrador lo recoge.
- La barra del borrador (arriba en Página principal y en Eventos) dice cuántos
  cambios hay sin publicar, abre la **vista previa** (`/admin/vista-previa`,
  la home tal como quedará) y tiene **Publicar** y **Descartar borrador**.
- Publicar pasa todo el borrador a la web de una vez y sube la revisión. No se
  publica si:
  - algo apunta a lo que ya no existe (un evento prioritario borrado, un álbum
    que no está, un código que el mapa entrega y se tiró a la papelera…);
  - la portada no se ve (sin ella no hay «Explorar» ni «Tickets»);
  - con los eventos del borrador el mar no se puede jugar.
  La lista de motivos sale debajo de la barra: se arregla y se vuelve a pulsar.

## 2. Borrar y papelera (REQ-ADM-029, REQ-ADM-030)

1. «A la papelera» enseña primero **qué lo nombra**: la home, el mapa, otros
   eventos, descuentos, fotos, logros y lo que tengan los visitantes de este
   navegador (compras, códigos, logros).
2. Para borrar hay que **escribir su nombre exacto** (título, nombre o código).
3. Lo borrado va a la **Papelera** (sección propia y, abajo de cada sección,
   «recuperar …»). Se recupera hasta que pasa el **plazo** (30 días por
   defecto, se cambia en Papelera, de 1 a 365; pendiente de Álvaro).
4. Cumplido el plazo, se **purga solo** en el siguiente cambio de la papelera.
5. **Purgar a mano** no se puede deshacer y pide **escribir otra vez el
   nombre** (con Supabase será volver a identificarse). Un elemento de la
   muestra purgado no vuelve, salvo con «Volver a la muestra».

Todo queda en **Auditoría y muestra**, que sólo crece: guardar, borradores,
publicar, papelera, purga, plazo, y también **cada compra de prueba y cada
sello** (autor: el visitante; REQ-ADM-007).

## 3. Logros (REQ-ADM-021, REQ-ADM-022)

- «Nuevo logro»: título, condición del catálogo (sin lógica libre) con sus
  parámetros en rango, puntos, monedas, premio, icono, ámbito (global o de una
  temporada) y fechas opcionales.
- «Duplicar» crea una copia **desactivada** para revisarla antes de activarla.
- Cambiar la **condición** de un logro (disparador o parámetros) guarda una
  **versión nueva**. Quien ya lo tenía lo conserva. Desactivar sólo evita
  concesiones nuevas.

## 4. Mundo: rangos, misiones y circuitos (REQ-ADM-013, REQ-ADM-014)

Al guardar un lugar se rechaza, con su motivo, cualquier cambio que:

- saque un parámetro de su rango seguro (radio de proximidad, fuerza y
  atracción del remolino, periodo y puntos del vaivén, radio de los
  cocodrilos, premio de la entrega, monedas de un encuentro, versión del
  circuito) o deje un punto fuera del mapa;
- deje una **misión sin destino** (por ejemplo, desactivar la isla donde se
  entrega la Boia Fiestera);
- deje un **circuito sin ruta**: sin salida (arco 0), con menos de dos arcos o
  con un hueco en el orden;
- además de lo que ya se comprobaba: nada en tierra, ninguna isla que corte el
  paso, teletransportes al agua.

## 5. Música (REQ-ADM-020)

En **Textos y música** se sube una pista (ambiente o efecto) con su
**licencia** y su **autor u origen**; sin ambas no se guarda. En la versión de
prueba se guarda en el navegador (hasta ~1 MB) y es siempre `muestra`. La
música de cada mundo sigue siendo su loop generado hasta que llegue la
definitiva con licencia (P18).

## 6. Peticiones de datos personales, a mano (REQ-ADM-031)

Hasta que haya autoservicio en la web (REQ-IDE-050, L2), las peticiones se
atienden a mano con este procedimiento. Correo de privacidad: el de los textos
legales (hoy `privacidad@boia.example`, inventado; el real es P21).

### 6.1 Qué peticiones hay

| Petición | Qué quiere la persona |
|---|---|
| **Descarga** (acceso y portabilidad) | Una copia de sus datos |
| **Eliminación** de la cuenta | Que se borren su cuenta y sus datos |
| **Retirada de contenido público** | Que se quite algo visible: su botella, su Carnet, su foto o una respuesta, o una foto de un evento en la que sale |

### 6.2 Pasos, para cualquier petición

1. **Anotar** la petición en el registro de peticiones (una hoja compartida
   del equipo): fecha de llegada, canal, tipo, quién la atiende. Plazo de
   respuesta: **un mes** desde que llega (ampliable dos meses más en casos
   complejos, avisando dentro del primer mes).
2. **Comprobar la identidad** sin pedir más datos de los necesarios:
   - con Supabase, la petición tiene que venir del **correo verificado** de la
     cuenta o, si no, se le manda a ese correo un enlace de confirmación;
   - nunca se aceptan contraseñas, capturas del DNI ni datos de pago por correo;
   - si alguien pide datos de otra persona, se contesta que sólo la propia
     persona puede pedirlos.
3. **Atender** según el tipo (6.3 a 6.5).
4. **Contestar** por el mismo correo verificado, con lo hecho y, si algo no se
   puede borrar (6.4), el motivo y cuánto tiempo se guarda.
5. **Cerrar** en el registro con la fecha y **dejar constancia** en la
   auditoría del Admin (con Supabase: acción de privacidad con motivo; nunca se
   copia en la auditoría el contenido de los datos).

### 6.3 Descarga

- **Versión de prueba:** los datos del visitante están sólo en su navegador,
  en la clave `boia.store` del almacenamiento local. El equipo no los tiene ni
  puede verlos. Se le explica que su Carnet, su progreso, sus compras de
  prueba y su botella están en su navegador y que puede verlos en «Mi Carnet».
- **Con Supabase:** exportar a un archivo JSON (legible y reutilizable):
  identidad pública del Carnet (apodo, foto, respuestas con su pregunta, desde
  cuándo es miembro), progreso (descubrimientos, logros, sellos, puntos,
  monedas y el libro de transacciones), compras (evento, fecha, estado, sin
  datos de pago, que tiene la ticketera), botellas y reportes que hizo, y el
  correo de la cuenta. Se entrega por un enlace de un solo uso que caduca en
  7 días, nunca como adjunto.

### 6.4 Eliminación de la cuenta

- **Versión de prueba:** no hay cuentas. Se le explica cómo borrarlo todo en su
  navegador: borrar los datos del sitio (en el navegador, «Borrar datos de
  navegación» o «Datos del sitio» para este dominio). Con eso desaparecen su
  Carnet, su progreso, sus compras de prueba y su botella.
- **Con Supabase**, en este orden:
  1. retirar su contenido público (6.5): botella, Carnet público y foto;
  2. borrar la cuenta de acceso (correo, contraseña, sesiones y factores);
  3. borrar el Carnet, las respuestas, las preferencias y el progreso;
  4. las **compras** y los **sellos** se conservan sólo lo que obliga la ley
     (facturación y contabilidad), **seudonimizados**: sin nombre, apodo ni
     correo, ligados a un identificador que ya no lleva a nadie;
  5. el **libro de transacciones** no se borra fila a fila (rompería los
     saldos de otros cálculos): se seudonimiza igual que las compras;
  6. comprobar que su apodo queda libre y que su Carnet ya no se abre.

### 6.5 Retirada de contenido público

- **Botella:** en **Moderación**, «Retirar» con el motivo «petición del autor».
  Deja de verse en el mar en todos los mundos.
- **Carnet** (foto, una respuesta o el apodo): en **Moderación**, lista de
  Carnets reportados (REQ-ADM-040, todavía sin construir en la versión de
  prueba), ocultar la foto o la respuesta o restablecer el apodo. El Carnet no
  se borra si la persona sólo pide retirar una parte.
- **Foto de un evento** en la que sale: en **Fotos y vídeos**, mandarla a la
  papelera (con su nombre escrito) y, si la persona lo pide, **purgarla** para
  que no se pueda recuperar.
- En todos los casos, con motivo en la auditoría.

### 6.6 Qué no hacer

- No borrar a mano filas del libro, compras ni la auditoría: se compensan o se
  seudonimizan.
- No mandar datos por un canal distinto del correo verificado.
- No pedir el DNI salvo que haya dudas serias y no quede otra forma; si se
  pide, se mira y no se guarda.

## 7. Cambiar la contraseña del Admin (plan 029 T283)

**Con cuentas** (la web con Supabase):

- Dentro del Admin, **Seguridad → Cambiar contraseña**: la nueva, dos veces
  (mínimo 8 caracteres). Hace falta haber entrado con el código de la app
  (TOTP); si no, pide entrar otra vez.
- Si no te acuerdas: en la pantalla de entrada, **He olvidado la contraseña**,
  escribe el email de la cuenta del Admin y abre el enlace que llega (en el
  mismo navegador). La página `/admin/recuperar` pide el código de la app y
  después la contraseña nueva.

**En la versión de prueba** (sin cuentas): la contraseña es un hash dentro del
código. Para cambiarla, en una terminal con la raíz del proyecto:

```sh
pnpm admin:password
```

Pide la contraseña nueva dos veces (no se ve lo que escribes), genera una sal
y un hash nuevos y reescribe `DEMO_ADMIN_PASSWORD` en
`apps/web/lib/admin/demo-auth.ts`. Sólo imprime «hash actualizado»; la
contraseña no se guarda en ningún sitio. Después hace falta **commit + push**
para que los dos hosts (Cloudflare y Vercel) la tengan.

Hace falta una terminal de verdad: PowerShell o cmd valen tal cual. En Git
Bash, `pnpm admin:password` puede negarse (si no puede ocultar lo que escribes);
usa `winpty node apps/web/scripts/admin-password.mjs` desde la raíz. Si las
dos no coinciden o cancelas con Ctrl+C, no cambia nada.

Al cambiar la contraseña con cuentas (desde Seguridad o con el enlace),
Supabase cierra las demás sesiones abiertas de esa cuenta.
