# Borrador para Álvaro · El faro como tablón y «Defensa del Castillo»

Borrador para Hernán (plan 014, T165, 2026-10-06). **No está en `docs/DECISIONES.md`**: Hernán
lo enseña a Álvaro y, con su respuesta, lo pasa a una decisión (tal cual o con cambios). Recoge
lo construido en el plan 014 (en `main`) y las decisiones de Hernán del 2026-10-05 y 2026-10-06
(cabecera de `plans/014-castillo-tower-defense.md`). Todo lo que se enseña es `muestra`: nombres,
textos, cifras y dibujos esperan su visto bueno.

Cómo probarlo: [guía de prueba](2026-10-06-castillo-guia-prueba.md).

---

## Qué ha cambiado en el mundo

### 1. El faro, sin minijuego: el «Tablón del faro»

- El faro (ahora el **Faro de Tabarca**, una isla nueva, baja y rocosa, con la casa del farero y
  su torre) se mueve **a la entrada del mundo**, donde antes se veía el castillo de Santa
  Bárbara. Es grande a propósito: es lo primero que se ve al zarpar.
- **Ya no tiene juego.** Al acercarse se abre el **«Tablón del faro»**: tres tarjetas —
  **Cañón**, **Castillo** y **Carrera**—, cada una con una línea que cuenta el juego, la mejor
  medalla del jugador si la tiene y un botón **«Rumbo a…»** que marca el destino en el mar.
- Las boyas de información que llevaban al juego del faro llevan ahora al tablón.

### 2. «Vigilancia del faro» desaparece

- El minijuego del faro (el 2D que adelantó D-20) **sale de la web**: el juego, su premio, su
  entrada en el Admin y su **logro «Vigía del faro»**.
- **Quien ganó ese logro no lo conserva**: el navegador lo quita al cargar y la copia de la
  cuenta también (la migración de Supabase está escrita y **sin aplicar**). Los puntos y
  monedas que ya cobró por él **se quedan** en su saldo.
- El logro **«Guardacostas»** (barco Cel-shaded) pedía ganar el faro; ahora pide **jugar una
  partida del Cañón**.
- En la especificación, **REQ-AVE-036 «Vigilancia del faro»** queda **retirado**. Le falta el
  número de decisión (D-NN) que lo retire: es la que se propone aquí.

### 3. El castillo, junto a la Boia 7, con un minijuego nuevo

**«Defensa del Castillo»** (nombre `muestra`) es un *tower defense*:

- El castillo de Santa Bárbara pasa a una isla **junto a la Boia 7**, fuera de las líneas de la
  carrera. Al llegar se abre su panel; «Jugar» abre un pop-up para elegir la **duración (5, 7 o
  10 minutos)** y la **dificultad (Tranquila, Normal, Tormenta)**.
- Al empezar, el resto del mundo se hunde y la cámara sube: sólo quedan el castillo y el mar. Al
  acabar todo vuelve.
- Los enemigos del Cañón, sus minibosses y sus bosses salen de un **vórtice** lila y negro y van
  en oleadas por **un camino en espiral** hasta el castillo, marcado con barreras flotantes (el
  mismo camino en todas las partidas, para que el ranking sea justo).
- El jugador vuela el barco **como avioneta** (las alas de «Entradas»), que dispara sola, y
  **construye las islas del mundo como torres**, cada una con su ataque: Faro (haz de luz),
  Nochevieja (bolas de nieve), Halloween (lanzallamas), Puerto de Alicante (fuegos
  artificiales), Ibiza (da monedas), Isla del Sonido (onda de graves) y Benidorm (francotirador).
  Se mejoran hasta nivel 3 y se venden.
- Se gana **aguantando el tiempo elegido**. Medallas: **oro** si el castillo aguanta con más de
  la mitad de vida, **plata** si aguanta con la mitad o menos, **bronce** si cae después de la
  mitad del tiempo.
- **Ranking**: puntos por enemigo (más por los bosses) + un bono por la vida que le queda al
  castillo; una tabla por cada duración × dificultad (nueve), local y, con cuenta, global.
- Las monedas del juego **sólo valen dentro de la partida**: no pasan al saldo del mundo.
- Sonido, teclado, pantalla táctil y móvil en calidad `baja`, como el Cañón.

---

## Qué necesita el visto bueno de Álvaro

### 1. El faro sin juego y el tablón

- ¿De acuerdo con que el faro deje de ser un minijuego y sea el tablón de la entrada?
- Los textos del tablón (`mar.tablon.*` en `apps/web/lib/i18n/es-mar.ts`), por ejemplo: «Desde
  el faro se ve todo el mar. Elige adónde ir y te marco el rumbo.»

### 2. Quitar «Vigilancia del faro» y su logro

- ¿De acuerdo con que **se pierda el logro «Vigía del faro»** (sin compensación, con lo cobrado
  en el saldo) y con el **Guardacostas** pidiendo jugar una partida del Cañón?
- Si sí, esta decisión lleva su número (D-NN) y retira **REQ-AVE-036**.

### 3. El juego nuevo y su requisito

- ¿De acuerdo con el juego? Hoy está construido **sin requisito propio**: en la especificación
  figura como alcance nuevo pendiente. Se propone un REQ nuevo del área de minijuegos,
  **«Defensa del Castillo»**, con estos criterios: una partida de 5, 7 o 10 min en la isla del
  castillo con tres dificultades; enemigos del Cañón por un camino fijo desde un vórtice; el
  avión que dispara solo y siete islas como torres con niveles 1–3, mejorar y vender; medallas
  de oro, plata y bronce; ranking por duración × dificultad; pausa con «Terminar partida»;
  control táctil y con teclado; calidad `baja` en el móvil.

### 4. Nombres y textos

- El nombre **«Defensa del Castillo»** y el resumen del panel: «Los enemigos del Cañón llegan en
  oleadas por un camino en espiral. Vuela en avioneta, dispara y levanta las islas del mar como
  torres para que el castillo aguante.»
- Los nombres de las islas como torres (son los de sus lugares) y lo que dice cada una.
- La tarjeta final: «¡Castillo a salvo!» / «El castillo ha caído».
- Todos los textos del juego: claves `mar.castillo.*` en `apps/web/lib/i18n/es-mar.ts`.

### 5. ¿Premio en el mundo o logros?

Hoy el juego **no da nada fuera de la partida** (decisión 13 del plan 014). Opciones:

- **A. Nada** (como ahora): se juega por la medalla y el ranking.
- **B. Premio por medalla, una vez al día cada una**, como el Cañón (bronce 30 ★ + 10 🪙, plata
  60 + 20, oro 100 + 40), quizá sólo en 7 o 10 min.
- **C. Logros**, por ejemplo: jugar una partida; aguantar 5 min; aguantar 10 min en Tormenta
  (oculto); construir las siete islas en una misma partida. Con premio de puntos y monedas, o un
  cosmético.
- **B y C** juntos.

Propuesta del borrador (Hernán la confirma o la cambia antes de enseñarla): **B y C**, con las mismas reglas antitrampas
del Cañón (las partidas con atajo de prueba o terminadas con «Terminar partida» no pagan).

### 6. Las cifras

Precios, vida del castillo, oleadas y dificultades están equilibrados con bots (guía, sección
«Equilibrio medido»): Tranquila se gana con oro, Normal se gana peleando y Tormenta el bot pierde
casi la mitad de las partidas. Son `muestra` y se cambian en la configuración sin tocar el juego.

---

## Qué no cambia sin Álvaro

Hasta su respuesta todo sigue `muestra` y la versión de prueba sigue como está. La migración de
Supabase que quita el logro del faro y la del ranking del castillo están escritas pero no
aplicadas: Hernán las aplica cuando Álvaro diga que sí.
