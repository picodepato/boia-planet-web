# Guía de prueba — El faro como tablón y «Defensa del Castillo»

> Para Hernán. El plan 014 cambia dos cosas del mundo Arcilla: el **faro** pasa a la entrada,
> sin minijuego, como **«Tablón del faro»**, y el **castillo** pasa junto a la Boia 7 y es un
> minijuego nuevo, **«Defensa del Castillo»** (nombre `muestra`), un tower defense. Quiere
> contestar: **¿está listo para enseñárselo a Álvaro?** Esta guía dice qué hay, cómo probarlo
> rápido, qué valores tocar y qué contestar; las respuestas van al final («Notas»). Lo que
> necesita el visto bueno de Álvaro:
> [2026-10-06-castillo-decision-alvaro.md](2026-10-06-castillo-decision-alvaro.md).

## Qué hay

### El faro y su tablón (T157, T166)

- El **Faro de Tabarca** (isla nueva hecha en Blender, T166) está donde antes se veía el castillo,
  junto a la salida. Grande y con su haz de luz: es lo primero que se ve al zarpar.
- Al acercarse se abre el **«Tablón del faro»**: tres tarjetas, **Cañón**, **Castillo** y
  **Carrera**, cada una con una línea, tu mejor medalla si la tienes y **«Rumbo a…»**, que marca
  el destino como el «!» de la ayuda (la marca se quita al llegar). Las boyas de información que
  llevaban al juego del faro llevan ahora al tablón.
- **«Vigilancia del faro» ya no existe**: ni el juego, ni su premio, ni su logro «Vigía del
  faro» (quien lo tenía lo pierde; los puntos y monedas que cobró se quedan). «Guardacostas»
  pide ahora jugar una partida del Cañón.

### «Defensa del Castillo» (T158–T164)

- **Dónde**: la isla del castillo, junto a la Boia 7, fuera de las líneas de la carrera. Al
  llegar se abre su panel; «Jugar» abre un **pop-up** para elegir la **duración (5, 7 o 10
  min)** y la **dificultad** (Tranquila, Normal, Tormenta), con tu mejor medalla y el ranking de
  esa pareja.
- **La arena**: al empezar se hunden las demás islas y el decorado, la cámara sube y mira desde
  arriba; sólo quedan el castillo y el mar. Al acabar todo vuelve como estaba.
- **Los enemigos** del Cañón (pirañas, cangrejos, gaviotas, medusas, piratas, peces espada) salen
  en oleadas de un **vórtice** lila y negro en el borde de la arena y van por **un solo camino**
  en espiral (con eses fuera y zigzag dentro), marcado con **barreras flotantes**. Minibosses y
  bosses (Vecino Quejica, Tiburón Martillo, Barco Pirata Fantasma, Kraken) llegan hacia el final
  y sólo siguen el camino, con mucha más vida. Lo que llega a la muralla le quita vida.
- **El avión**: el barco con las alas de «Entradas» vuela por la arena con las flechas o el dedo
  y dispara solo al enemigo más cercano. Su daño se sube con monedas (nivel 1 a 3). No le pueden
  dar.
- **Construir**: «Construir» abre las siete islas con su precio; la isla se coloca dentro del
  anillo del avión, fuera del camino, del vórtice y sin pisar otra (verde si se puede; rojo y el
  motivo si no). Tocar una isla construida: **Mejorar** (hasta nivel 3) o **Vender** (devuelve
  el 60 % de lo gastado). Sin tope de islas: sólo monedas y sitio.
- **Las siete islas**: **Faro** (haz que gira), **Nochevieja** (bolas de nieve que paran un
  momento, cada vez a otro enemigo), **Halloween** (lanzallamas en cono que deja ardiendo),
  **Puerto de Alicante** (fuegos artificiales de largo alcance que estallan en grupo), **Ibiza**
  (granja: no dispara, da monedas), **Isla del Sonido** (onda de graves alrededor) y **Benidorm**
  (francotirador: lento, muy lejos, al más fuerte).
- **Ganar**: aguantar el tiempo elegido. **Medallas**: oro si el castillo aguanta con más del
  50 % de vida, plata con el 50 % o menos, bronce si cae después de la mitad del tiempo.
- **Puntos y ranking**: puntos por enemigo (más por los bosses) + un bono por la vida que le
  queda al castillo. Nueve tablas (3 duraciones × 3 dificultades); sin cuenta, contra la
  tripulación de muestra; con cuenta, global (su migración está escrita, sin aplicar).
- **Las monedas** sólo valen dentro de la partida (monedero inicial, caídas e Ibiza); no pasan al
  saldo del mundo. Esta versión **no da premio en el mundo ni logros** (lo decide Álvaro).
- **HUD**: arriba tiempo, vida del castillo, oleada y monedas, y la barra del boss del Cañón;
  abajo «Construir» y el daño del avión. Pausa con volumen y «Terminar partida» (sin medalla ni
  ranking). Teclado: flechas = avión, B construir, 1–7 isla, Intro colocar, I elegir isla, U
  mejorar, V vender, Esc atrás o pausa.
- **Sonido** sintetizado (del Cañón): bucle de batalla y de boss, el mar al acabar, construir,
  mejorar, vender, el ataque de cada isla (con límite por tipo para que siete torres no saturen),
  golpe al castillo, oleada, victoria y derrota. Nada suena antes del primer toque o tecla.

## Cómo probarlo rápido

En `pnpm dev`, o en la versión publicada con `dev=1` en la URL. Una partida empezada con
cualquier atajo **nunca** entra en el ranking.

| Parámetro | Qué hace | Ejemplo |
|---|---|---|
| `minijuego=castillo` | Empieza la partida nada más cargar el mar | `/mar?minijuego=castillo` |
| `duracion=5\|7\|10` | Los minutos de la partida | `&duracion=10` |
| `dificultad=<id>` | `tranquila`, `normal` o `tormenta` | `&dificultad=tormenta` |
| `t=<s>` | Empieza en el segundo `s` (cuenta como cobradas las caídas de antes) | `&t=505` |
| `seed=<n>` | La semilla (sólo cambia por qué lado del carril va cada enemigo) | `&seed=7` |
| `islas=1` | Empieza con las siete islas a nivel 3 | `&islas=1` |
| `islas=lleno` | Empieza con la arena llena de islas a nivel 3 (todas las que caben; prueba de rendimiento) | `&islas=lleno` |
| `monedas=<n>` | `n` monedas más al empezar | `&monedas=3000` |
| `vencer=1` | Empieza a 3 s del final: se gana con oro sin jugar | `&vencer=1` |
| `oferta=1` | Abre el panel de la isla en vez de empezar (los demás atajos se guardan) | `&oferta=1` |

Recorridos:

1. **El tablón**: `/mar`, zarpar y acercarse al faro → tres tarjetas; «Rumbo a Castillo» marca la
   isla del castillo; ir hasta ella.
2. **Una partida normal**: en el castillo, «Jugar» → 5 min, Normal. Construir pronto (Nochevieja
   o Halloween cerca del principio del camino, Ibiza donde sea), subir el avión y mejorar.
3. **El final de 10 min**: `/mar?minijuego=castillo&duracion=10&dificultad=tormenta&t=505&islas=1`
   (el camino lleno y el Kraken saliendo del vórtice).
4. **Medalla y tablón**: `/mar?minijuego=castillo&oferta=1&vencer=1` → «Jugar» → oro → volver al
   mar → el tablón enseña el oro.

## Equilibrio medido (T165)

Bot que construye (`buildingBot`: todas las islas en orden, la granja la segunda, compra el avión
desde la tercera y luego alterna mejorar y construir), 6 semillas por casilla
(`packages/engine/src/defense/defense-balance.test.ts`):

| | 5 min | 7 min | 10 min |
|---|---|---|---|
| **Tranquila** | 6/6 oro, 100 % | 6/6 oro, 100 % | 6/6 oro, 100 % |
| **Normal** | 6/6, 70–75 % | 6/6, 50–75 % | 6/6, 69–97 % |
| **Tormenta** | 4/6 (26–57 %); cae a 217 s | 3/6 (6–36 %); cae a 236–240 s | 3/6 (29–36 %); cae a 248 s |

- Ibiza + una sola isla repetida gana en Tranquila; en Normal acaba tocada o cae en 5 y 7 min y cae siempre
  en 10; en Tormenta casi todas caen: Halloween aguanta 5 y 7
  min (y cae en 10), Faro e Isla del Sonido sólo 5 min. Ninguna domina; cada isla sale en alguna
  de las mejores construcciones.
- **Ibiza** se paga en 70 s a nivel 1 (y cada mejora en menos de 2 min).
- Cambios de T165 (versión de reglas 3): Benidorm más flojo (era la mejor en todo), monedero
  inicial 120 → 160 (en Tormenta el bot caía antes de 160 s), aguante +25 % por minuto (antes
  +20 %), Normal con aguante ×1,15 (salía al 100 % en 7 y 10 min) y Tormenta ×1,2 de aguante,
  ×1,3 de enemigos y ×1,3 de golpe a la muralla (antes 1,5 / 1,4 / 1,4).

## Rendimiento en `baja` (teléfono, e2e)

- Pico de la partida de 10 min en Tormenta con las siete islas a nivel 3, ~40 enemigos y el
  Kraken: p50 16,7 ms, p95 33,4 ms (CPU 4×: p95 33,4 ms, peor 50 ms).
- Arena llena (`islas=lleno`: 109 islas a nivel 3), el Kraken saliendo del vórtice, barreras y
  sonido encendido: p50 16,7 ms, p95 33,4 ms (CPU 4×: p50 33,3, p95 33,4, peor 50 ms). Sin
  puntos calientes que arreglar.

## Valores que se pueden tocar

Todo en `packages/engine/src/defense/config.ts` (`DEFENSE_CONFIG`; al cambiar reglas se sube
`DEFENSE_CONFIG_VERSION` y las tablas de la migración del ranking): precios y niveles de cada
isla, monedero inicial, vida del castillo, enemigos (ritmo, aguante, golpe, monedas, puntos),
dificultades, oleadas, bosses por duración, el avión y el bono de puntos. Los textos, en
`apps/web/lib/i18n/es-mar.ts` (`mar.castillo.*`, `mar.tablon.*`).

## Qué contestar

1. ¿El tablón se entiende y lleva bien a cada sitio? ¿El faro se ve bien desde la salida?
2. ¿La arena se lee desde arriba (camino, barreras, vórtice, islas) en el móvil?
3. ¿Construir, mejorar y vender se entienden sin explicación? ¿El anillo del avión molesta?
4. ¿Tranquila / Normal / Tormenta se sienten bien? ¿Alguna isla sobra o falta?
5. ¿El sonido con muchas islas se aguanta?
6. ¿Listo para enseñárselo a Álvaro con el borrador?

## Notas

