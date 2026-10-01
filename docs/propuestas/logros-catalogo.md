# Catálogo de logros · aprobado por Hernán

- Fecha: 2026-09-29
- Pide: Hernán (D-22, punto 5)
- Estado: **aprobado por Hernán el 2026-09-29, con cambios** (abajo, «Cambios
  de Hernán al borrador»). Lo implementa T36 del plan 003
  (`packages/store/src/sample/progress.ts`). Todo es `muestra` hasta el visto
  bueno de Álvaro (P14).
- Sustituye a: los 10 logros de muestra de antes (ver «Qué pasa con los 10
  de antes»).

## Cómo funciona

Cada logro pasa por tres estados, igual en `/mar` y en `/juego`:

1. **En curso** (`in_progress`): se ve lo que lleva y lo que pide («3 de 7»)
   y una frase «te queda…».
2. **Listo para reclamar** (`ready`): al cumplirse, sale el aviso «¡Logro
   completado! Reclama tu premio» y el icono de logros lleva un contador.
   Completar no da nada todavía.
3. **Reclamado** (`claimed`): el premio llega sólo al pulsar «Reclamar», una
   sola vez (el libro guarda la fila del logro con un id fijo por logro).

Arriba del panel, un contador «X de Y logros». Los **ocultos** cuentan en
Y, pero se ven como «???» hasta completarlos.

## Reglas de premio

- **Siempre puntos** (dan rango y ranking). Escala de muestra: fácil 10 pts,
  medio 30–50 pts, difícil 80–150 pts.
- **Por defecto, además monedas** (se gastan en cosméticos): fácil 5, medio
  10–20.
- **Premio especial en lugar de monedas** en tres casos:
  - **Insignia del Carnet** por comprar entradas (se ve en Mi Carnet).
  - **Barco de estilo** para tres logros complejos: queda bloqueado en Mi
    Barco hasta reclamarlo. Son Cel-shaded cómic, Boceto a lápiz y Pixel art.
  - **Cosmético del barco** (bandera o estela) para algunos.
- Barcos: Arcilla y Acuarela son libres; Cel-shaded cómic, Boceto a lápiz y
  Pixel art se ganan con un logro; Semi-realista, Cartoon años 30 y Low-poly
  se venderán por monedas en la tienda del plan 004 (hasta entonces se
  eligen libremente, como hoy).
- Con todo reclamado se suman 1380 pts y 205 monedas (el rango más alto de
  muestra, «Capitana de la fiesta», pide 600 pts).

## Catálogo (25 logros)

«Señal» es lo que el juego envía (`apps/web/lib/mundo/achievements.ts`,
tipo `AchievementSignal`). Las marcadas **T36** son nuevas: existen en la
demo del navegador y faltan en el enum de Supabase.

| # | id | Nombre | Qué hay que hacer | Meta · «te queda» | Señal | Premio |
|---|---|---|---|---|---|---|
| 1 | `primera-boia` | Primera boia | Habla con tu primera boia. | 1 · «Te falta 1 boia» | `find_buoy` (el mapa la llama `find_boia`) | 10 pts + 5 monedas |
| 2 | `boies-3` | Coro de boies | Habla con 3 boies distintas. | 3 · «Te quedan 2 boies» | `find_buoy`; se podrá completar cuando el plan 004 ponga sus boies en el mapa | 30 pts + 10 monedas |
| 3 | `islas-3` | Isla a isla | Descubre 3 islas. | 3 · «Te quedan 2 islas» | `visit_island` | 30 pts + 10 monedas |
| 4 | `islas-7` | Cartógrafa | Descubre todas las islas del mapa. | 7 · «Te quedan 4 islas» | `visit_island` | 80 pts + 20 monedas |
| 5 | `fiestera-rescatada` | Boia Fiestera rescatada | Saca a la Boia Fiestera de entre los cocodrilos. | 1 · «Búscala entre los cocodrilos» | `rescue_character` (`boia-fiestera`) | 50 pts + 20 monedas |
| 6 | `fiestera-entregada` | Hasta el amanecer | Lleva a la Boia Fiestera a la última isla. | 1 · «Llévala a la última isla» | `deliver_character` (`boia-fiestera`) | 150 pts + **Bandera de la Fiestera** |
| 7 | `circuito` | Por El Freu | Termina una vuelta al circuito. | 1 · «Termina una vuelta» | `complete_circuit` (`finishLap`, en `circuit-hud.tsx`) | 40 pts + 15 monedas |
| 8 | `circuito-atajo` | ¿Atajo? Atajo. *(oculto)* | Termina una vuelta por el atajo. | 1 · «???» | `complete_circuit` con la ruta de la vuelta (`via`: arco `circuito-cp-a`) | 40 pts + **Bandera a cuadros** |
| 9 | `circuito-rapido` | Rayo del Freu | Haz una vuelta en menos de 43,6 s. | 43,6 s · «Tu récord: 52 s, te sobran 8,4 s» | `complete_circuit` con el tiempo (`maxMs` 43 600) | 100 pts + **Estela de rayo** |
| 10 | `faro` | Vigía del faro | Gana Vigilancia del faro. | 1 · «Gana una partida en el Faro» | **T36** `win_minigame` (`faro`) | 40 pts + 15 monedas |
| 11 | `canon` | Ni un tiburón | Gana Cañón contra tiburones. | 1 · «Gana una partida en el Cañón» | **T36** `win_minigame` (`canon`) | 40 pts + 15 monedas |
| 12 | `guardacostas` | Guardacostas | Gana los dos minijuegos. | 2 · «Te queda 1 minijuego» | **T36** `win_minigame`, juegos distintos | 100 pts + barco **Cel-shaded cómic** |
| 13 | `secretos` | Ojo de marinera *(oculto)* | Encuentra los 4 secretos del mapa. | 4 · «Te quedan 3 secretos» | `collect_objects` (`secreto`) | 80 pts + barco **Boceto a lápiz** |
| 14 | `delfin` | Amiga del delfín *(oculto)* | Sigue al delfín hasta el final de sus saltos. | 1 · «???» | **T36** `complete_encounter` (`delfin`) | 30 pts + **Estela de burbujas** |
| 15 | `botellas-3` | Correo del mar | Lee 3 botellas. | 3 · «Te quedan 2 botellas» | **T36** `read_bottle` (botellas de otros, distintas; sólo `/juego`) | 20 pts + 10 monedas |
| 16 | `botella-propia` | Mensaje al mar | Echa tu propia botella. | 1 · «Echa tu botella» | **T36** `throw_bottle` (sólo `/juego`) | 10 pts + 5 monedas |
| 17 | `carnet` | Con Carnet | Crea tu Carnet BOIA. | 1 · «Crea tu Carnet» | **T36** `create_carnet` | 20 pts + 10 monedas |
| 18 | `carnet-preguntas` | Libro abierto | Responde las 5 preguntas del Carnet. | 5 · «Te quedan 3 preguntas» | **T36** `answer_question` | 40 pts + 20 monedas |
| 19 | `minutos-5` | Cinco minutos a bordo | Navega 5 minutos. | 5 · «Te quedan 2 minutos» | `time_played` | 10 pts + 5 monedas |
| 20 | `minutos-20` | Veinte minutos a bordo | Navega 20 minutos. | 20 · «Te quedan 12 minutos» | `time_played` | 30 pts + 10 monedas |
| 21 | `minutos-60` | Lobo de mar | Navega una hora (en varias visitas). | 60 · «Te quedan 40 minutos» | `time_played` | 100 pts + barco **Pixel art** |
| 22 | `entrada` | Con entrada | Compra una entrada para un evento de BOIA. | 1 · «Compra tu primera entrada» | `buy_ticket` (el checkout de prueba, `sandbox.ts`) | 100 pts + insignia **Con entrada** |
| 23 | `entradas-3` | Fiel a BOIA | Ten entradas de 3 eventos distintos. | 3 · «Te quedan 2 eventos» | `buy_ticket`, eventos distintos con sello | 150 pts + insignia **Fiel a BOIA** |
| 24 | `mundos-2` | Entre dos mundos | Navega en Arcilla y en Acuarela. | 2 · «Te queda 1 mundo» | **T36** `visit_world` | 30 pts + 15 monedas |
| 25 | `naufrago-fiesta` | Náufrago de fiesta | Lleva al náufrago a una fiesta de BOIA. | 1 · «Llévalo a una fiesta» | `deliver_character` (`naufrago`); se podrá completar cuando el náufrago tenga su misión | 50 pts + 20 monedas |

Las cifras de «te queda» son ejemplos; el juego pone las de cada persona.

## Cambios de Hernán al borrador (2026-09-29)

- **Barcos mixtos.** Arcilla y Acuarela, libres. Sólo tres barcos son premio
  de logro: `guardacostas` → Cel-shaded cómic, `secretos` → Boceto a lápiz y
  `minutos-60` → Pixel art. Semi-realista, Cartoon años 30 y Low-poly irán a
  la tienda del plan 004 (hasta entonces, libres). `islas-7` pasa a 80 pts +
  20 monedas y `circuito-rapido` a 100 pts + Estela de rayo, en lugar de
  barco.
- **`boies-3` entra como estaba**, pero no se añaden boies al mapa: se podrá
  completar cuando el plan 004 ponga las suyas.
- **Dos logros más:** `botella-propia` (echar tu botella, señal nueva
  `throw_bottle`) y `naufrago-fiesta` (llevar al náufrago a una fiesta, con
  la señal que ya existe `deliver_character`: el náufrago hoy sólo deja su
  código al arrimarse, así que se completará cuando tenga misión).
- **Puntos abiertos, como recomendaba el borrador:** «Rayo del Freu» al 80 %
  de una vuelta limpia medida con el barco base; quien ya tenía `entrada` o
  `secretos` recibe también la insignia o el barco sin tocar sus saldos; el
  castillo y la Explanada de `/mar` no cuentan como islas; las botellas
  siguen sólo en `/juego`; los 3 ocultos, como estaban; el aviso dice
  «Reclama tu premio».

## Tiempo de «Rayo del Freu»

Medido en T36 con el runtime del motor (`WorldRuntime` y `DEFAULT_SHIP_CONFIG`,
el barco base), saliendo parado en «¡Ya!» y siguiendo el centro de los
carriles hasta la meta, con los impulsos de los arcos:

| Ruta | Vuelta limpia |
|---|---|
| Segura (`circuito-cp-s`) | 54,5 s |
| Atajo (`circuito-cp-a`) | 51,3 s |

«Rayo del Freu» pide el 80 % de la vuelta limpia por la ruta segura:
**43,6 s** (`FAST_LAP_MS` en `sample/progress.ts`). Ni el atajo sin más
llega: hace falta derrapar bien y aprovechar los impulsos.

## Qué pasa con los 10 de antes

- `primera-boia`, `islas-3`, `minutos-5`, `minutos-20`,
  `fiestera-rescatada` y `circuito`: se quedan igual.
- `boies-6` → **`boies-3`**. El mapa sólo tiene una boia con disparador, así
  que nadie ha podido conseguirlo y no hay nada que migrar.
- `entrada`: se queda; su premio pasa de 100 pts + 30 monedas a 100 pts +
  insignia «Con entrada».
- `fiestera-entregada`: se queda con su bandera y pierde las 50 monedas (la
  misión ya da 100 pts y 100 monedas al entregar).
- `secretos`: se queda, oculto; su premio pasa de 80 pts + 25 monedas a
  80 pts + barco Boceto a lápiz.

Migración (esquema v1 → v2 de `@boia/store`): los logros ya concedidos
cuentan como completados y reclamados y conservan sus puntos y monedas (sus
filas del libro no cambian). Quien tenía `secretos` recibe el barco Boceto a
lápiz (fila de cosmético con 0 puntos y 0 monedas); quien tenía `entrada` ve
la insignia «Con entrada», que sale de la definición.

## Señales

Ya existían `find_buoy`, `visit_island`, `collect_objects`, `time_played`,
`rescue_character`, `deliver_character`, `complete_circuit` y `buy_ticket`.
T36 añade (`ACHIEVEMENT_TRIGGERS_NEW` en `packages/contracts`):

- `win_minigame` (id del juego): al ganar una partida válida de Faro o Cañón.
- `complete_encounter` (id del encuentro): al terminar el delfín.
- `read_bottle`, `throw_bottle`, `create_carnet`, `answer_question`,
  `visit_world`.
- Datos nuevos en señales que ya existían: la ruta y el tiempo de la vuelta
  (`complete_circuit`); `buy_ticket` cuenta los eventos distintos con sello.

En la versión final, cada señal nueva es también un valor del enum
`achievement_trigger` de Supabase (migración pendiente).
