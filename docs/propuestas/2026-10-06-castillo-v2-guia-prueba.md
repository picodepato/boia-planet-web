# Guía de prueba — Castillo v2, el tablón del faro, el Vecino nuevo, mascotas y premios

> Para Hernán. El plan 015 hace la segunda vuelta a «Defensa del Castillo» y al faro de Tabarca,
> rehace el Vecino Quejica en Blender y pone premio al reto de arriba de cada juego (dos mascotas
> nuevas y una estela). Quiere contestar: **¿está listo para enseñárselo a Álvaro?** Esta guía
> dice qué hay, cómo probarlo rápido, qué se ha medido y qué contestar; las respuestas van al
> final («Notas»). Lo que necesita el visto bueno de Álvaro:
> [2026-10-06-premios-mascotas-decision-alvaro.md](2026-10-06-premios-mascotas-decision-alvaro.md).
> La guía del plan 014 sigue valiendo para lo que no cambia:
> [2026-10-06-castillo-guia-prueba.md](2026-10-06-castillo-guia-prueba.md).

## Qué hay

### El faro de Tabarca y su tablón (T168)

- El faro está **cerca de la salida, a la izquierda** de la vista con la que se empieza (en el
  móvil, la tableta y el ordenador). No quedó justo al lado del náufrago: ese sitio se sale de
  la pantalla del móvil al empezar y los de alrededor pisan el circuito de la carrera.
- El **tablón** abre **recogido**: la línea «Desde el faro puedes ver dónde jugar» y tres
  botones (**Cañón**, **Castillo**, **Carrera**) con los iconos del juego. Desplegado, explica
  cada juego y enseña la mejor medalla. Cada botón abre la misma ficha que el minimapa al tocar
  una isla: su nombre con **Navegar** e **Ir en nave**. «Rumbo a…» ya no existe.

### «Defensa del Castillo» v2 (T169–T173)

- **Camino v2**: más largo, por fuera del castillo con **cuatro curvas en U** hacia dentro (en
  cada U cabe una isla que da a los dos lados), baja por la derecha y acaba en **zigzag** con
  tramos más largos. El mismo para todos; el vórtice al principio, como antes.
- **Construir en cualquier sitio** de la arena (fuera del camino, del vórtice, sin pisar otra
  isla ni el castillo). «Construir» enseña las siete islas **con su foto de verdad**; tocar una
  explica su daño; «Colocar», tocar el agua y **«Instalar isla»**. Mientras se coloca se ve
  **su alcance**. La partida **no se para** al construir.
- **Toques**: fuera de construir, tocar el agua manda el avión allí (sin salir de la arena) y
  tocar una isla la elige (nivel, Mejorar, Vender y **a quién apunta**: primero, último, más
  fuerte o más cercano; Benidorm empieza en «más fuerte»).
- **Cámara**: se acerca y aleja con el carril, la rueda, el pellizco o las teclas; lo más abierto
  es la vista de salida. «Construir» vuelve a ella.
- **Mejoras**: el avión sube **velocidad de ataque** y **daño** hasta nivel 5; el **castillo**
  sube su vida máxima (+50 por nivel, tres veces, caro).
- **×2** y **«Llamar oleada»** (la siguiente sale ya y paga 1 moneda por segundo adelantado); el
  **aviso de la siguiente oleada** dice qué trae y si viene un jefe.
- **Barras de vida** y **números de daño** en la arena (se apagan en la pausa; se guarda en el
  dispositivo), **nubes** por encima, turbo y velocidad a la vista.
- **Ibiza paga a la vista** (T178): cada pago salta encima de la isla como **«+N» con una
  moneda**, dorado y grande para leerse desde arriba, aunque los números de daño estén apagados.
- **Guía de la primera partida** (T173): antes de la primera, «¿Empezar con la guía?» (Sí / No,
  jugar). Nueve bocadillos cortos (mover, construir, elegir, colocar, instalar, ficha,
  prioridad, mejorar, oleada) que se cierran con la ✕ o haciendo lo que piden; «Saltar guía»
  en cada bocadillo. Se puede repetir con «Con la guía» en el pop-up.

### El Vecino Quejica nuevo (T174)

- Rehecho de cero en Blender: una barcaza naranja de obra con el vecino de arriba en batín azul,
  gorro de dormir, periódico en alto y un megáfono enorme. Sale igual en el Cañón y en el
  castillo; mismo tamaño de choque y mismas reglas. Mientras carga (o si falla) se ve la barcaza
  de antes.

### Mascotas, estela y logros (T175, T176)

- **Cañoncito**: un cañón de juguete en cubierta que dispara una nube de humo cada pocos
  segundos. Se gana con **«ganar el Castillo en Tormenta»**.
- **Tortuga turbo**: una tortuga con gafas de aviador que **nada detrás del barco**, sigue su
  estela y aguanta el turbo. Se gana con **«Rápido»** en la carrera.
- **Estela del vórtice**: una estela lila y negra en espiral, en todo el mundo. Se gana ganando
  el Castillo en **Tormenta de 10 min**.
- Una mascota a la vez; se equipan en **Mi Barco** cuando son tuyas (no se venden en la tienda).
- **Logros nuevos** (premios `muestra`): «Castillo en calma» (Tranquila) 40 ★ + 20 🪙, «Muralla firme» (Normal) 60 + 30,
  «Castillo en la tormenta» 120 + 50 + Cañoncito, «Ojo del vórtice» (Tormenta de 10 min) 150 + 50 + Estela del vórtice; carrera
  «Primera regata» 60 + 30 (el logro `circuito` de siempre, con otro nombre) y «Rápido» (vuelta
  en menos de 80 s) 80 + 40 + Tortuga turbo. «Ganar» es que el castillo aguante toda la partida
  (el bronce no cuenta). Se reclaman en «Logros»; la tarjeta final del castillo dice qué se ha
  desbloqueado.

## Cómo probarlo rápido

En `pnpm dev`, o en la versión publicada con `dev=1` en la URL. Una partida con cualquier atajo
**nunca** entra en el ranking.

| Atajo | Qué hace |
|---|---|
| `/mar?minijuego=castillo` | Empieza el castillo nada más cargar (con `duracion`, `dificultad`, `t`, `seed`, `monedas`, `islas=1`, `islas=lleno`, `vencer=1`, `oferta=1` como en el plan 014) |
| `/mar?minijuego=castillo&islas=1&t=150` | Siete islas ya puestas: se ve pagar a Ibiza cada 10 s |
| `/mar?minijuego=castillo&oferta=1` | Abre el pop-up (y, la primera vez, la pregunta de la guía) |
| `/mar?minijuego=castillo&dificultad=tormenta&vencer=1` | Gana en Tormenta: desbloquea Cañoncito (en `pnpm dev`) |
| `/mar?mascota=canoncito,tortuga-turbo&estela=vortice` | Te da las dos mascotas y la estela para probarlas (en `pnpm dev`) |

Recorridos:

1. **El tablón**: `/mar`, el faro a la izquierda; acercarse; desplegar; «Castillo» → Navegar.
2. **Primera partida con guía**: en el castillo, «Jugar» → «Sí»; seguir los bocadillos.
3. **Construir y mejorar**: Ibiza primero (se ve el «+14» cada 10 s), una isla en una U,
   cambiar a quién apunta, subir el avión, ×2 y «Llamar oleada».
4. **El final de 10 min en Tormenta**: `/mar?minijuego=castillo&duracion=10&dificultad=tormenta&t=505&islas=1`.
5. **Mascotas**: con el atajo de arriba, Mi Barco → equipar Cañoncito y luego la Tortuga; navegar
   con turbo; equipar la Estela del vórtice.

## Equilibrio medido (T178, reglas versión 5)

**Daño de las islas hacia el medio** (lo pedido por Hernán): daño efectivo por cada 100 monedas
gastadas, una isla sola en el centro de la 2.ª U, sin avión, Normal 5 min desde el segundo 165,
daño quitado entre 180 y 240 s, semilla 1.

| Isla | Antes N1/N2/N3 | Ahora N1/N2/N3 | Cambio |
|---|---|---|---|
| Faro | 14,8 / 21,4 / 23,9 | 16,0 / 20,0 / 21,6 | haz 63/77/91 → 68/72/82 |
| Nochevieja | 12,3 / 11,6 / 11,8 | 13,5 / 14,7 / 14,9 | daño 10/15/22 → 11/19/29 |
| Halloween | 38,8 / 33,7 / 28,6 | 26,7 / 26,0 / 24,2 | daño 3,5/5,5/8,5 → 2,4/4,2/6,8; fuego 5,5/8,5/12,5 → 3,8/6,5/10,1 |
| Puerto | 13,0 / 14,4 / 13,3 | 13,9 / 16,2 / 15,6 | daño 28/45/66 → 30/52/80 |
| Isla del Sonido | 25,7 / 25,2 / 22,7 | 20,1 / 21,8 / 21,2 | daño 11/18/27 → 8,6/15,6/25 |
| Benidorm | 17,9 / 18,4 / 19,0 | 17,9 / 18,4 / 19,0 | igual |

Nochevieja queda un poco por debajo porque además aturde (eso no entra en la medida).

**Ibiza**: 14 / 29 / 59 monedas cada 10 s (antes 10 / 16 / 24): el nivel 1 devuelve sus 70
monedas en **50 s**, la mejora a nivel 2 (60) en **40 s** y la de nivel 3 (90) en **30 s**.

**Dificultades** (con esa economía todo salía al 100 %): Normal aguante ×1,15 → ×1,4; Tormenta
aguante ×1,18 → ×1,35 y golpe a la muralla ×1,3 → ×1,5. Tranquila igual.

**El bot** (`buildingBot`, «la construcción sencilla»): Ibiza primero, luego Halloween, Faro,
Sonido, Benidorm, Puerto y Nochevieja; repite Sonido, Halloween, Faro y Benidorm; sube Ibiza en
cuanto puede, compra avión (daño y velocidad) hasta nivel 3 y la vida del castillo si le falta
una mejora entera. Vida del castillo al final (6 semillas; F = cae, en s):

| | 5 min | 7 min | 10 min |
|---|---|---|---|
| **Tranquila** | 6/6 oro, 100 | 6/6 oro, 100 | 6/6 oro, 100 |
| **Normal** | 6/6: 26–55 | 6/6: 33–57 | 6/6: 36–73 |
| **Tormenta** | 0/6: cae a 179–223 s | 3/6: 15–78; cae a 241–242 s | 6/6: 1–33 |

- Una sola isla (+ Ibiza) repetida: en Normal ninguna gana en todo (en 10 min caen Faro,
  Nochevieja, Puerto y el Sonido, y Halloween acaba al 25 %); en Tormenta 10 min la sencilla
  gana a todas salvo el Faro y el Sonido (semilla 7: la sencilla acaba al 6 %). **Pero en Tormenta corta Halloween sola sigue aguantando** (63 % en
  5 y en 7 min), igual que el Sonido (40–49 %), mientras la sencilla cae en 5 min: ver «Qué
  contestar».
- **Tres Ibizas al empezar** (la sencilla con dos granjas más) gana al 100 % en todas las
  casillas, también en Tormenta: con Ibiza pagándose en 50 s, apilar granjas es la mejor
  estrategia. Ya pasaba antes (con 70 s) y ahora más.
- **«Llamar oleada»** cada vez que el mar queda vacío: en Tormenta nunca sale mejor que jugar sin
  llamar (cae antes); en Normal, en 7 y 10 min, da algo más de vida al final por el dinero extra. **×2** es la
  misma partida más rápida (probado paso a paso).

## Rendimiento en `baja` (teléfono, e2e)

- Pico de la partida de 10 min en Tormenta con las siete islas a nivel 3 (~54 enemigos y el
  Kraken), barras y números encendidos, nubes, el Vecino de Blender y los «+N» de Ibiza: p50
  16,7 ms, p95 33,4 ms (CPU 4×: p50 33,3, p95 33,4, peor 50 ms).
- Arena llena (`islas=lleno`, 75 islas a nivel 3 con el camino v2): p50 16,7 ms, p95 33,4 ms
  (CPU 4×: p95 33,4, peor 50 ms). Sin puntos calientes que arreglar.
- Medido con la prueba sola; con toda la suite a la vez (dos navegadores) sube a p95 50 ms.

## Valores que se pueden tocar

Todo en `packages/engine/src/defense/config.ts` (`DEFENSE_CONFIG`; al cambiar reglas se sube
`DEFENSE_CONFIG_VERSION` y la siembra de la migración del ranking). Los «+N» de Ibiza:
`COIN_POP_STYLE` en `apps/web/app/mar/engine/defense-overlays.ts`. Los premios de los logros:
`packages/store/src/sample/progress.ts`. El umbral de «Rápido»: `RACE_FAST_MS`.

## Qué contestar

1. ¿El faro se ve bien a la izquierda al empezar? ¿El tablón recogido y sus tres botones se
   entienden?
2. ¿El camino con U se lee desde arriba? ¿Construir en cualquier sitio con el alcance se entiende?
3. ¿Se ve bien cuánto paga Ibiza (el «+N» con la moneda)? ¿Molesta?
4. **Apilar Ibizas gana siempre**: ¿se deja así, se pone un tope (por ejemplo dos Ibizas por
   partida), cada Ibiza extra paga menos, o se alargan sus tiempos de 50/40/30 s?
5. **Halloween (y el Sonido) solos aguantan Tormenta de 5 y 7 min** aunque bajaron: ¿se bajan
   más, o se acepta que en partidas cortas una isla de área sola funcione?
6. ¿Tranquila / Normal / Tormenta se sienten bien con las mejoras nuevas?
7. ¿La guía es corta y clara? ¿El Vecino nuevo se reconoce en el Cañón y en el castillo?
8. ¿Cañoncito, Tortuga turbo y la Estela del vórtice gustan? ¿Los premios de los logros?
9. ¿Listo para enseñárselo a Álvaro con el borrador?

## Notas

