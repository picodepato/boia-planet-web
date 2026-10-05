# Guía de prueba — Cañón «Que no pare la música», beta 2

> Para Hernán. La beta 2 (plan 011) convierte la prueba de sensación de la beta 1 en una
> **partida entera sin bosses** y quiere contestar tres preguntas: **¿engancha subir de nivel?,
> ¿se notan distintas las armas?, ¿está bien el ritmo?** Esta guía dice qué hay, cómo jugarla
> rápido, qué valores tocar y qué contestar. Las respuestas se apuntan al final («Notas») y son
> la entrada de la entrevista del plan de la beta 3. Diseño completo:
> [2026-10-04-canon-survivors.md](2026-10-04-canon-survivors.md); la guía anterior, con las notas
> de la beta 1: [2026-10-04-canon-beta1-guia-prueba.md](2026-10-04-canon-beta1-guia-prueba.md).

## Qué hay en la beta 2

Todo lo de la beta 1 (la partida en el mismo mar de `/mar`, el agua a bordo, las notas, las
cartas, 7:00 para «¡Amanece!» con el premio de siempre: 150 puntos y 50 monedas una vez por
temporada) más:

- **Las notas de la beta 1 aplicadas** (T123): pirañas a 120 u/s (el barco va a 150), cuenta
  atrás y barra de nivel pequeñas y arriba, `sumergirse` como estilo de derrota por defecto.
- **Los interactivos del mundo dentro de la partida** (T124): el botón de turbo (con su
  cooldown), las flechas de impulso, las rampas de salto y las boyas de carrera funcionan como
  navegando. **Saltar no da inmunidad**: en el aire también te golpean.
- **Seis enemigos** (T125–T126): pirañas (enjambre), medusas (se parten en dos al caer), gaviotas
  (desde 1:00, vuelan por encima de las islas), cangrejos (desde 1:30, lentos y duros), piratas en
  bote (desde 3:00, se paran y disparan recto; las islas paran sus disparos) y peces espada (desde
  3:30, avisan con una línea en el agua y embisten). Desde 3:30 salen **élites** (anillo dorado,
  más aguante, mejor nota) y a las **5:00 llega la «Marea»**: 20 s de anillos de pirañas desde
  todos lados. Los huecos de los minibosses (2:30, 4:30) y del boss (5:30) existen apagados.
- **Siete armas** con tabla fija por nivel 1–5 (T127–T128): Cañón de agua, Subwoofer (aura),
  Láser de festival (rayo que gira), Boyas orbitales, Cañón de confeti (abanico hacia donde
  navegas), Fuegos artificiales (cohetes que explotan) y Lluvia ácida (nube que daña cada
  segundo). Las rectas (cañón y confeti) las paran las islas; las demás pasan por encima.
- **Nueve vinilos** (pasivas) y **huecos 4 + 4** hasta nivel 5 (T129): Techno (cadencia),
  Reggaetón (área), House (resistencia), Drum & Bass (velocidad), Disco (imán), Chill (achicar
  agua), Hardstyle (daño), Pop (experiencia) y Rumba (+1 proyectil).
- **Cuatro evoluciones** (arma a nivel 5 + su vinilo): Cañón + Hardstyle = **El Drop**, Subwoofer +
  House = **Muro de Sonido**, Láser + Techno = **Show de Láseres**, Boyas + Disco = **Bola de
  Discoteca**. Sin cofres todavía (llegan con los minibosses): la evolución sale como carta de
  nivel en cuanto se cumple. Y el **Salvavidas**, raro: te salva una vez de inundarte.
- **Cartas nuevas** (T130): cada carta dice qué es (arma nueva, nivel de arma, vinilo, evolución,
  Salvavidas) y lo que da ese nivel («Nivel 3: +1 boya»); las evoluciones destacan en dorado. La
  fila de armas y vinilos: abajo en escritorio, arriba a la izquierda en el móvil.
- **Tres dificultades** en el panel de la isla (T131): Tranquila / **Normal** (marcada) / Tormenta,
  junto a «Jugar». Sólo cambian a los enemigos (daño, aguante y cuántos salen); el premio y lo
  que es ganar son iguales en las tres.
- **Equilibrio con pilotos** (T132): partidas enteras simuladas por dificultad y semilla para
  que el barco parado pierda pronto, el que esquiva llegue a los últimos minutos en Normal y los
  niveles lleguen a buen ritmo (las cifras, en `ESTADO.md`, sección de T132).

## Los atajos de desarrollo

Encendidos siempre con `pnpm dev` (y en las e2e). En la versión publicada
(https://boia-planet-roan.vercel.app) sólo si la URL lleva **`dev=1`**. Se quitan al lanzar.

| Parámetro | Qué hace | Ejemplo |
|---|---|---|
| `minijuego=canon` | Empieza la partida nada más cargar el mar, donde aparece el barco | `/mar?minijuego=canon` |
| `t=<s>` | Empieza en el segundo `s` (0–419) con los niveles, las cartas y los enemigos de ese momento (todos los tipos que el guion echa a esa hora) | `&t=300` (la Marea) |
| `seed=<n>` | La semilla: misma semilla y mismo pilotaje, misma partida | `&seed=7` |
| `dificultad=<id>` | Empieza con esa dificultad: `tranquila`, `normal` o `tormenta` (sin él, la del panel) | `&dificultad=tormenta` |
| `armas=1` | Empieza con las **siete armas a nivel máximo** (para ver cómo se ven todas a la vez) | `&armas=1` |
| `carta=1` | Empieza con una carta de nivel abierta | `&carta=1` |
| `carta=surtido` | Una carta con **una opción de cada clase** (arma nueva, nivel de arma, vinilo nuevo, nivel de vinilo, evolución El Drop y Salvavidas) | `&carta=surtido` |
| `derrota=puf` o `derrota=sumergirse` | Empieza con ese estilo de derrota | `&derrota=puf` |
| `oferta=1` | Sólo abre el panel del Cañón, sin empezar (las dificultades, el bloqueo en carrera) | `&oferta=1` |
| `dev=1` | En producción, enciende todo lo de arriba y el interruptor de derrota | `?dev=1&minijuego=canon` |

Ejemplos:

- El último minuto con todo: `http://localhost:3000/mar?minijuego=canon&t=360&armas=1&seed=7`.
- Una evolución al momento: `…/mar?minijuego=canon&carta=surtido` (la evolución es la carta dorada).
- Tormenta desde la Marea: `…/mar?minijuego=canon&t=290&dificultad=tormenta`.
- En producción: `https://boia-planet-roan.vercel.app/mar?dev=1&minijuego=canon&dificultad=tranquila`.
- Desde el móvil con `pnpm demo` (imprime la URL de la Wi-Fi), con los mismos parámetros.

Los atajos se borran de la URL al usarse. Una partida empezada con `t=`, `seed=`, `carta=` o
`armas=1` es de prueba: en producción con `?dev=1` termina con el aviso «Partida de prueba» y no
da premio ni logros. Con las cartas abiertas se elige con el dedo, con las flechas o los números
y con Intro.

### Ver el estado por dentro

En la consola del navegador (también en la remota del móvil):

```js
document.querySelector('[data-testid="mar-canon"]').dataset
```

Da `estado`, `tiempo` (s que faltan), `activo` (s jugados), `agua`, `nivel`, `enemigos`,
`derrotados`, `notas`, `semilla`, `dificultad`, `calidad` (`alta` o `baja`: el tope de
enemigos), `mejoras`, `carta` y `fin`. En el lienzo (`[data-testid="mar-canvas"]`),
`canonVistos` dice qué tipos de enemigo han salido en pantalla y `canonArmas` cuántas piezas
pinta cada arma.

## Qué tocar y dónde

Todo el equilibrio sigue en **`packages/engine/src/survivors/config.ts`**, objeto
**`SURVIVORS_CONFIG`** (con `pnpm dev` se ve al recargar). Cambiar un valor cambia sola la
huella (`configHash`) de la sesión; sube `SURVIVORS_CONFIG_VERSION` sólo cuando el cambio se
quede. Después: `pnpm exec vitest run packages/engine/src/survivors --testTimeout=60000`; las
pruebas de equilibrio (`survivors-balance.test.ts`) dicen si un cambio rompe la forma de la
partida (parado pierde pronto, el que esquiva llega lejos en Normal, Tranquila más fácil y
Tormenta más difícil, niveles a buen ritmo). Los pilotos están en `survivors/bots.ts`.

| Para… | Mandos |
|---|---|
| El ritmo de las cartas | `levels` (`base` 3, `linear` 2.5, `quadratic` 0.25: experiencia por nivel), `player.magnetRadius` (130), `notes.values`, `enemies.<id>.noteValue` |
| Lo duros que son los enemigos | `enemies.<id>.hp`, `growthPerMinute.hp` (0.08: +8 % por minuto), los `hpScale` del guion (`acts[0].tracks`) |
| Lo que duele cada golpe | `enemies.<id>.contactWater` (piraña 5, cangrejo 10, medusa 6…), `shooter.projectile.water` del pirata, `player.waterCapacity` (100) |
| Cuántos salen y cuándo | `acts[0].tracks` (grupos por segundo y tamaño por minuto), `acts[0].events` (élites a 3:30, Marea a 5:00), `marea.marea`, `elites.elites` |
| Las dificultades | `difficulties` (Tranquila 0.7 / 0.8 / 0.75, Normal 1 / 1 / 1, Tormenta 1.6 / 1.6 / 1.6 sobre daño / aguante / cuántos; Tormenta era 1.3 / 1.3 / 1.4 hasta la config v7) |
| Cada arma | `weapons.<id>.base` (nivel 1) y `levels` (lo que da cada nivel 2–5); evoluciones en `evolutions[].evolvedWeapon` |
| Lo fácil que es evolucionar | `cardWeights` (`owned` 3: subir algo que ya llevas; `pairedVinyl` 3: el vinilo pareja de un arma que llevas; `new` 1: lo demás nuevo) |
| Los vinilos | `passives.<id>.levels` (lo que suma cada nivel) |
| El Salvavidas | `salvavidas.offerChance` (0.03 por carta), `waterFractionAfterSave` |
| El móvil en `baja` | `caps.baja` (60 enemigos, 60 bolas, 40 disparos, 6 nubes, 100 notas) y `enemies.piranha.capShare` (0.7: las pirañas sólo llenan el 70 % del tope con el guion, para que en `baja` se vean los demás tipos) |

## Las preguntas

Jugar varias partidas en escritorio y en el móvil: una entera en Normal, otra en Tranquila y
otra en Tormenta, varias con `t=` (3:30, 5:00, 6:00) y alguna con `armas=1` y `carta=surtido`.

1. **Subir de nivel.** ¿Engancha? ¿Apetece la próxima carta? ¿Llegan demasiado seguidas o se
   hacen esperar (`levels`, `player.magnetRadius`)? ¿Se ven las notas en el agua antes de que el
   imán las coja?
2. **Las armas.** ¿Se nota cada una distinta, de verdad, al cogerla? ¿Alguna sobra o se queda
   corta? ¿Se lee bien la pantalla con varias a la vez (`armas=1`)? ¿Se entiende qué hace cada
   carta?
3. **Las evoluciones y el Salvavidas.** ¿Llegaste a evolucionar algo jugando normal (no con el
   atajo)? ¿Se siente el premio? ¿Salió el Salvavidas alguna vez?
4. **El ritmo de los 7 minutos.** ¿Se nota la subida (gaviotas a 1:00, cangrejos a 1:30, piratas a
   3:00, peces espada y élites a 3:30, la Marea a 5:00)? ¿Hay un tramo aburrido o uno imposible?
5. **Las dificultades.** ¿Normal se puede terminar esquivando con ganas? ¿Tranquila es para
   cualquiera y Tormenta un reto de verdad? ¿Se entienden los tres botones del panel?
6. **Los interactivos.** ¿Sirven el turbo, las flechas de impulso y las rampas para escapar en la
   partida? ¿Es justo que en el aire también te golpeen?
7. **Rendimiento en el móvil.** En el iPhone 11 (y, si se puede, en un Android de gama media), a
   partir de `t=360` con `armas=1`: ¿va fluido con el mar lleno? ¿Qué `calidad` eligió
   (`dataset.calidad`)? ¿Se calienta?

## Notas

Apuntar aquí (o en un archivo hermano `2026-10-04-canon-beta2-notas.md`) lo que salga de cada
pregunta, con el dispositivo, la dificultad y los valores probados.

### 2026-10-05 — Hernán, jugando en Tranquila

> «He hecho la prueba jugando en fácil, no he alcanzado nunca el daño suficiente para limpiar
> ninguna oleada, hay que subir el daño que hacen las armas más. No me gusta el diseño de algunas
> armas, por ejemplo el cohete que explota en zona, el láser de festival tampoco. Ni he
> conseguido hacer las fusiones de armas mejoradas.»

Lo que cambió (plan 012 T133, config v6 → v7; el rediseño de Fuegos y Láser es T134):

- **Daño de las armas**, base y por nivel: Cañón de agua 10 → 16 y 0,9 → 0,7 s entre disparos
  (nivel 2: +5 → +8); Subwoofer 6 → 10 (nivel 3: +4 → +6); Láser 8 → 12 (nivel 3: +5 → +8);
  Boyas 12 → 18 (nivel 2: +6 → +8, nivel 5: +10 → +12); Confeti 6 → 10 (nivel 3: +4 → +6);
  Fuegos 25 → 40 (nivel 4: +15 → +20); Lluvia ácida 7 → 12 (nivel 3: +5 → +8). Evoluciones: El
  Drop 28 → 40, Muro de Sonido 18 → 26, Show de Láseres 22 → 30, Bola de Discoteca 36 → 50.
- **Evoluciones a mano**: la oferta de cartas ya no es a la par; subir de nivel lo que llevas y
  el vinilo pareja de un arma que llevas pesan 3 veces más que lo nuevo (`cardWeights`). Así
  quien va a por un arma y su vinilo la ve subir a nivel 5 sin depender de la suerte. Se eligió
  esto antes que tocar la curva de experiencia o la condición (nivel 5 + vinilo), que siguen
  igual.
- **Tormenta** 1.3 / 1.3 / 1.4 → 1.6 / 1.6 / 1.6 (daño / aguante / cuántos), para que con las
  armas nuevas siga siendo un reto. El crecimiento del aguante de los enemigos (+8 % por minuto)
  no cambia.

Medido con los pilotos (6 semillas por dificultad; «hunde» = derrotados / aparecidos del piloto
que esquiva y elige bien), v6 → v7: Tranquila hunde 94 % → 97 %, Normal 92 % → 96 %, Tormenta
80 % → 91 %; llega a una evolución antes de las 5:00 en 4 → 6 semillas de Tranquila, 3 → 6 de
Normal y 1 → 5 de Tormenta; en Tranquila limpia la pantalla en los 2 primeros minutos en las 6
semillas (antes, 3). Normal sigue pidiendo esquivar: el piloto que sólo esquiva aguanta los 7:00
en 5 de 6, y el barco parado se hunde antes de los 2:00.
