# Reunión del 2026-10-08: cambios para la web

Notas de la reunión con Álvaro, ordenadas por zona de la web. Son peticiones,
todavía no decisiones escritas en `DECISIONES.md`; al final están las dudas
que hay que cerrar antes de convertirlas en plan.

## 0. Decisión principal

**Hacerse el Carnet BOIA es obligatorio para comprar entradas.** El carnet
deja de dar un descuento por hacérselo y pasa a ser el requisito de compra.
Los descuentos que se consiguen navegando por el mundo siguen existiendo.

## 1. Diseño general

### 1.1 Tipografía

- La fuente actual no gusta. Se eligen **tres fuentes que combinen entre sí**:
  1. **Títulos.**
  2. **Botones**: los de la landing, los de dentro del mundo y el menú de
     arriba (Artistas, Contacto, etc.).
  3. **Textos.**
- Buscarlas con **estilo de videojuego**, que encaje con la web. Referencia:
  https://www.1001freefonts.com/es/video-game-fonts.php

### 1.2 Botones y ventanas

- **Sin esquinas redondeadas en ninguna parte**: botones, popups y tarjetas,
  todo con esquinas rectas.
- Los botones actuales de la landing son feos: se rediseñan junto con la
  tipografía.

### 1.3 Landing

- Se rediseña entera. Al bajar desde la bola del mundo, la página sigue el
  estilo de https://www.noartmusic.com/ de principio a fin, con nuestras
  secciones.

## 2. Portada

- El texto **«Consigue descuentos»** va en **amarillo**.
- Se quita el botón **«Entradas»**; queda solo **«Zarpar»**, porque al bajar
  ya se ven las entradas.
- **Por elegir:** la foto fija que se ve cuando la portada no carga se
  cambiará por otra.

## 3. Eventos y entradas

### 3.1 Lista de eventos

- Cada evento se muestra con **la fecha en un cuadrado** y el **nombre al
  lado o debajo**.

### 3.2 Ficha del evento

- Muestra lo que haya y dice claramente lo que falte:
  - **Artistas:** si no hay, «Aún no están anunciados».
  - **Cartel:** si no hay, «El cartel todavía no está anunciado».
  - **Ubicación:** anunciada o no.
- **Comprar:** según el evento, puede indicar «Solo en puerta» y que hace
  falta el carnet.
- **Precio** decidido desde el Admin, que puede **cambiar todos estos
  datos**.
- Con cartel publicado, al entrar en él **el fondo de la página es el mismo
  cartel, ampliado y difuminado**.
- Las **fotos del evento** se ven en collage, como en la Galería (§4).

### 3.3 Al comprar

- Junto a la compra aparece un botón **«Consigue un descuento»** que lleva al
  mundo desde el principio (igual que «Zarpar»).

### 3.4 Códigos de descuento

- Desde el Admin se pueden **cambiar los códigos de descuento de todo el
  mundo a la vez**, por si la ticketera cambia el código oficial. Hoy cada
  persona recibe un código aleatorio; en el futuro podrá ser uno común.

### 3.5 Ticketera

- **Halloween:** la entrada cuesta **5 € en puerta con carnet**. Hacerse
  socio es obligatorio para comprar.
- **Siguientes eventos:** ticketera **por elegir**. La web debe mostrar la
  que se elija.

## 4. Galería (antes «Fotos»)

- La sección pasa a llamarse **Galería**.
- **Collage sin textos**: fotos y pequeños fragmentos de vídeo, algo
  superpuestos unos sobre otros.
- **Al abrir** una pieza: animación de apertura y fondo oscuro.
- **Al cerrarla:** vuelve a su sitio con una animación y mueve un poco las
  demás para que se vean otras fotos.

## 5. Tienda

- Solo aparecen **los 3 productos**, con **nombre y precio**, en el formato
  de https://www.noartmusic.com/
- Al pulsar **Comprar**, se explica cada caso:
  - **Solo venta en la fiesta**, o
  - **Reserva sin existencias:** enlace para enviarnos un DM por Instagram y
    te lo llevamos al próximo evento.

## 6. Artistas

- Cada artista aparece con **su imagen al lado**.
- Al **pulsar su nombre** se abre **su carnet**.
- En la lista, cada artista tiene dos botones:
  - **«Ver carnet»**.
  - **Enlace a su música**, a elegir entre Spotify, SoundCloud, Bandcamp o, en
    su defecto, Instagram.
- **Los propios artistas ponen sus enlaces** al crear su carnet.

## 7. Carnet

- Al crear el carnet se **pide el email** (con Supabase debería estar ya).
- **QR de alta:** un QR que abre directamente «Crear carnet», para enseñarlo
  en la puerta de la fiesta.
- **QR del carnet:** cada carnet tiene el suyo. En cada fiesta hay un
  **lector de QR** que registra quién ha asistido y le pone **el sello de la
  fiesta** en el carnet.
- El resto del carnet se queda como está.

## 8. El mundo

### 8.1 Entrada

- La **pantalla de carga** antes de entrar al mundo es **naranja claro**.
- Se **rediseña la boia** que aparece para que se parezca más a nuestro logo.

### 8.2 Popups

- **Bordes rectos** en todos los popups y botones.
- **Se quita la franja naranja de arriba** en todos los popups. Quedan:
  título y descripción en azul, sus botones y la opción de ampliar.

### 8.3 Islas

- **Nombres nuevos:**

  | Antes | Ahora |
  |---|---|
  | Sonido / Isla del Sonido | **ALL DAY BOIA** |
  | BOIA Nochevieja | BOIA Nochevieja (igual) |
  | BOIA Halloween | **HALLOWEEN IN THE CLUB** |
  | Ibiza | **Botiga Ibiza** |
  | Isla dels Banyets | **Puig Campana** |

- **Islas de las fiestas:** el popup muestra solo **nombre, fecha y lugar**,
  sin la franja naranja.
- **Botiga Ibiza:** su popup dice «Sección de merchandising oficial».
- **Puig Campana:** se modela en Blender y sustituye a Els Banyets **en todas
  las islas relacionadas**.
- **Isla nueva, Las Calitas:** isla de comentarios. La gente escribe
  comentarios, responde y vota. Con **filtro de insultos** y **moderable
  desde el Admin**.
- **Misión «Rescatar a la boia»:** el descuento que da sirve en **cualquiera
  de las dos fiestas**.

## 9. Admin

- **Hasta 3 administradores.**
- El Admin **modera todo** (comentarios de Las Calitas incluidos).
- **Papelera de 30 días:** guarda lo cambiado o borrado para poder volver
  atrás.
- **Analítica de visitas** que se enciende desde el Admin.
- **Copias de seguridad automáticas** y periódicas de los datos.

## 10. Datos y tareas de personas

- **Instagram oficial:** [@boia.planet](https://www.instagram.com/boia.planet/)
- **Roke:** pasar el vídeo/GIF que se mostrará como inicio cuando no hay
  conexión.
- **Álvaro:**
  - Fotos reales de los productos.
  - Crear el correo electrónico del dominio.

## 11. Dudas que hay que cerrar

1. ~~**Descuentos y carnet obligatorio.**~~ **Resuelta (Hernán,
   2026-10-08):** solo desaparece el descuento por hacerse el carnet. Los
   descuentos que se consiguen navegando por el mundo se mantienen: el
   «Consigue descuentos» de la portada, el botón al comprar, los códigos
   editables y la misión de la boia.
2. **Halloween «5 € en puerta».** ¿Se vende algo online para Halloween o la
   web solo informa de que se paga en la puerta?
3. ~~**Servidor y cuentas.**~~ **Resuelta (Hernán, 2026-10-08):** todo se
   construye sobre el proyecto Supabase actual (`boia-planet-dev`, plan
   gratuito), sin pasar a Pro por ahora. Para que no se pause tras 7 días
   sin uso, `.github/workflows/supabase-keepalive.yml` lo lee dos veces por
   semana. El plan gratuito no hace copias diarias: las copias de seguridad
   automáticas (§9) las tiene que hacer la propia web o un script.
4. **Galería con vídeo:** ¿de dónde salen los vídeos y quién los aprueba?
5. **Las tres fuentes:** ¿las proponemos nosotros (2–3 combinaciones para
   elegir) o vienen elegidas de la web de referencia?
6. **Nochevieja:** ¿sigue habiendo una isla y un evento de Nochevieja con
   fecha? Las «dos fiestas» de la misión, ¿son Halloween y Nochevieja?
