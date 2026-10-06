# Borrador para Álvaro · Castillo v2, el tablón del faro, el Vecino nuevo, mascotas y premios

Borrador para Hernán (plan 015, T178, 2026-10-06). **No está en `docs/DECISIONES.md`**: Hernán
lo enseña a Álvaro y, con su respuesta, lo pasa a una decisión (tal cual o con cambios). Recoge
lo construido en el plan 015 (en `main`) a partir de las notas y respuestas de Hernán del
2026-10-06 (cabecera de `plans/015-castillo-v2-mascotas.md`). Sigue al borrador del plan 014
([2026-10-06-castillo-decision-alvaro.md](2026-10-06-castillo-decision-alvaro.md)), que sigue
pendiente: las dos cosas se pueden enseñar juntas. Todo es `muestra`: nombres, textos, cifras y
dibujos esperan su visto bueno.

Cómo probarlo: [guía de prueba](2026-10-06-castillo-v2-guia-prueba.md).

---

## Qué ha cambiado

### 1. El faro de Tabarca, cerca de la salida, y su tablón

- El faro está **cerca de la salida, a la izquierda** de lo que se ve al empezar (un poco más
  cerca del centro de lo pedido: justo al lado del náufrago se salía de la pantalla del móvil).
- El tablón aparece **recogido**, como las fichas de las demás islas: «Desde el faro puedes ver
  dónde jugar» y tres botones, **Cañón**, **Castillo** y **Carrera**. Desplegado explica cada
  juego y enseña la mejor medalla. Cada botón abre la misma elección que el minimapa: el nombre
  del sitio con **Navegar** o **Ir en nave**. Ya no marca un destino («Rumbo a…» desaparece).

### 2. «Defensa del Castillo», segunda versión

- **Camino más largo**, con cuatro curvas en U y un zigzag final: cada isla bien puesta pega a
  los dos lados del camino.
- **Se construye en cualquier sitio** de la arena, viendo el alcance de la isla antes de
  instalarla, y la lista enseña la **foto de cada isla**. La partida no se para al construir.
- **Tocar el mar** lleva el avión allí; **tocar una isla** la elige: subirla, venderla y decidir
  **a quién dispara** (al primero, al último, al más fuerte o al más cercano).
- **Mejoras**: el avión sube **velocidad de ataque** y **daño** hasta nivel 5; el castillo sube
  su **vida máxima** (caro).
- **×2** de velocidad y **«Llamar oleada»** (sale ya, con unas monedas de premio); un **aviso**
  dice qué trae la oleada siguiente y si viene un jefe.
- **Barras de vida** y **números de daño** (se pueden apagar en la pausa), **nubes** por encima y
  la cámara que se acerca y se aleja sin salir de la arena.
- **Ibiza enseña lo que paga**: cada pago salta encima de la isla («+14» con una moneda).
- **Guía de la primera partida**: antes de la primera se pregunta si se quiere la guía; son
  bocadillos cortos sobre el juego de verdad y se pueden saltar.
- **Equilibrio nuevo** (medido con bots): las islas fuertes bajan un poco (Halloween claramente,
  la Isla del Sonido algo), las flojas suben un poco (Nochevieja, Puerto y el Faro al empezar),
  Benidorm igual; Ibiza se paga en 50 s (y sus mejoras en 40 y 30 s); Normal y Tormenta, más
  duras para compensar. Tranquila se gana con oro, Normal se gana peleando, Tormenta se pierde a
  menudo en 5 min y se gana con poca vida en 7 y 10.

### 3. El Vecino Quejica, nuevo

- Hecho de cero en 3D: una barcaza naranja con el vecino de arriba en batín y gorro de dormir,
  el periódico en alto y un megáfono enorme. Sale en el Cañón y en el castillo; el juego no
  cambia.

### 4. Premios: dos mascotas, una estela y logros nuevos

- **«Cañoncito»**: un cañón de juguete con ojos que va en cubierta y suelta una nube de humo de
  vez en cuando.
- **«Tortuga turbo»**: una tortuga con gafas de aviador que **nada detrás del barco**, siguiendo
  su estela, también con turbo.
- **«Estela del vórtice»**: la estela del barco en lila y negro, en espiral, en todo el mundo.
- Las tres no se compran: se ganan con logros. Se lleva una mascota a la vez.

| Logro (nombre `muestra`) | Cómo se gana | Premio |
|---|---|---|
| Castillo en calma | Ganar el Castillo en Tranquila (cualquier duración) | 40 ★ + 20 🪙 |
| Muralla firme | Ganar en Normal | 60 ★ + 30 🪙 |
| Castillo en la tormenta | Ganar en Tormenta | 120 ★ + 50 🪙 + **Cañoncito** |
| Ojo del vórtice | Ganar en Tormenta de 10 minutos | 150 ★ + 50 🪙 + **Estela del vórtice** |
| Primera regata | Acabar la carrera por primera vez (el logro de la carrera de siempre, con otro nombre) | 60 ★ + 30 🪙 |
| Rápido | Acabar la carrera en menos de 80 s (un jugador normal lo logra en 3–5 intentos) | 80 ★ + 40 🪙 + **Tortuga turbo** |

«Ganar» el Castillo es que aguante toda la partida. Las partidas con atajos de prueba o
terminadas con «Terminar partida» no dan nada. El reto más difícil de la carrera, «Rayo de Los
Rápidos» (73,4 s), sigue igual.

---

## Qué necesita el visto bueno de Álvaro

1. **El faro y el tablón**: su sitio cerca de la salida y el tablón recogido con los tres botones
   (texto: «Desde el faro puedes ver dónde jugar»).
2. **El castillo v2**: ¿de acuerdo con las mejoras, ×2, «Llamar oleada», elegir a quién dispara
   cada isla y la guía? Sigue sin REQ propio: el borrador del plan 014 propone uno; habría que
   sumarle «mejoras del avión y del castillo, prioridad de las islas, ×2, llamar oleada y guía
   opcional».
3. **El Vecino nuevo**: ¿se queda este diseño?
4. **Mascotas y estela**: los nombres **«Cañoncito»**, **«Tortuga turbo»** y **«Estela del
   vórtice»**, sus diseños y que sólo se ganen con logros.
5. **Logros y premios**: los nombres de la tabla, cómo se gana cada uno, las cantidades de ★ y 🪙
   y el umbral de 80 s de «Rápido». Con esto, el borrador del plan 014 (punto 5, «¿premio en el
   mundo o logros?») queda contestado con la opción **C (logros)**, sin premio diario por medalla.
6. **Las cifras del juego** (precios, daño de las islas, Ibiza, dificultades): son `muestra` y se
   cambian en la configuración sin tocar el juego.

---

## Qué no cambia sin Álvaro

Hasta su respuesta todo sigue `muestra`. Las migraciones de Supabase de los logros y premios
nuevos (`20261006100400_castle_race_prizes.sql`) y del ranking del castillo están escritas pero
no aplicadas: Hernán las aplica cuando Álvaro diga que sí.
