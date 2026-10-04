# Guía de prueba — Cañón «Que no pare la música», beta 1

> Para Hernán. La beta 1 (plan 010) responde a una sola pregunta: **¿es divertido esquivar un
> enjambre con el barco en el mar 3D?** Esta guía dice cómo jugarla rápido, qué valores tocar
> para la sensación y qué contestar. Las respuestas se apuntan al final (sección «Notas») y son
> la entrada de la entrevista con que empieza el plan 011 (beta 2). Diseño completo:
> [2026-10-04-canon-survivors.md](2026-10-04-canon-survivors.md).

## Qué hay en la beta 1

En `/mar`, el panel de la isla del Cañón (L'Illeta dels Banyets) lleva la etiqueta **BETA** y
«Jugar» empieza la partida **donde está el barco**, en el mismo mar: sin líneas amarillas, sin
fichas, botellas, descuentos ni encuentros, con la cámara algo más lejos y más alta y el barco
más ágil. El cañón de agua dispara solo al enemigo más cercano (las islas paran las bolas).
Pirañas (rápidas, débiles, en enjambre) y cangrejos acorazados (lentos, duros) vienen a por ti;
cada golpe mete agua a bordo (la barra bajo el barco) y con el barco lleno, «¡Barco inundado!».
Las notas que sueltan se funden y el imán las recoge; al subir de nivel, 1 de 3 cartas. Aguantar
**7:00** de tiempo activo es «¡Amanece!» y da el premio de siempre (150 puntos y 50 monedas, una
vez por temporada) y la señal de los logros `canon` y `guardacostas`.

- **Pausa:** el botón de pausa del HUD o Esc abren el menú de `/mar`; cerrar el menú sigue. Las cartas,
  las fichas y la pestaña oculta también pausan. Más de **5 min seguidos en pausa** abandona la
  partida (sin premio) y vuelve el mundo con un aviso.
- **En carrera** (Los Rápidos) no se puede empezar: el panel explica por qué.
- **La Boia Fiestera**, si va a bordo, sigue a bordo durante la partida y después.
- El cañón 2D ya no existe; el Faro sigue en su capa 2D, igual que antes.

## Los atajos de desarrollo

Encendidos siempre con `pnpm dev` (y en las e2e). En la versión publicada
(https://boia-planet-roan.vercel.app) sólo si la URL lleva **`dev=1`**; no hay ningún enlace a
ellos. Se quitan al lanzar (plan 014).

| Parámetro | Qué hace | Ejemplo |
|---|---|---|
| `minijuego=canon` | Empieza la partida nada más cargar el mar, donde aparece el barco | `/mar?minijuego=canon` |
| `t=<s>` | Empieza en el segundo `s` (0–419) con los niveles y enemigos de ese momento; deterministas para la semilla | `&t=300` (quedan 2:00) |
| `seed=<n>` | La semilla de la partida: la misma semilla y el mismo pilotaje dan la misma partida | `&seed=7` |
| `derrota=puf` o `derrota=sumergirse` | Empieza con ese estilo de derrota | `&derrota=puf` |
| `carta=1` | Empieza con una carta de nivel abierta (para probar las cartas) | `&carta=1` |
| `oferta=1` | Sólo abre el panel del Cañón, sin empezar (para probar el bloqueo en carrera) | `&oferta=1` |
| `dev=1` | En producción, enciende todo lo de arriba y el interruptor de derrota | `?dev=1&minijuego=canon` |

Ejemplos:

- En local: `http://localhost:3000/mar?minijuego=canon&t=360&seed=7` (el último minuto).
- En producción: `https://boia-planet-roan.vercel.app/mar?dev=1&minijuego=canon&seed=7`.
- Desde el móvil con `pnpm demo` (imprime la URL de la Wi-Fi), añadiendo los mismos parámetros.

Los atajos se borran de la URL al usarse (`dev=1` se queda, para que el interruptor siga). Una
partida empezada con `t=`, `seed=` o `carta=1` es de prueba: sólo da el premio en local y en
el servidor de e2e, y nunca con `?dev=1` en producción (ahí termina con el aviso «Partida de
prueba» y no apunta premio ni logros). En local se vuelve a ganar borrando los datos del sitio.

### El interruptor de derrota

Con los atajos encendidos, durante la partida sale abajo a la izquierda un botón discontinuo
**«Derrota: puf»** / **«Derrota: sumergirse»**. Cada pulsación cambia en vivo cómo desaparecen
los enemigos, y la elección se queda para las partidas siguientes de la visita.

- `puf`: una nubecilla rápida y vistosa.
- `sumergirse`: el enemigo salta o se hunde con una salpicadura, sin heridas (compatible con
  REQ-AVE-037 tal como está). Es el valor por defecto (`defeatStyle` en la config).

### Ver el estado por dentro

El estado de la partida está en un elemento oculto. En la consola del navegador (también en la
remota del móvil):

```js
document.querySelector('[data-testid="mar-canon"]').dataset
```

Da `estado`, `tiempo` (s que faltan), `activo` (s jugados), `agua`, `nivel`, `enemigos` (en
pantalla), `derrotados`, `notas`, `fin`, `semilla`, `calidad` (`alta` o `baja`, que elige el tope
de enemigos), `barco` y `premio`.

## Qué tocar para la sensación

Todo el equilibrio está en un solo archivo: **`packages/engine/src/survivors/config.ts`**, objeto
**`SURVIVORS_CONFIG`**. Con `pnpm dev` el cambio se ve al recargar. Cambiar cualquier valor
cambia sola la huella (`configHash`) de la sesión del minijuego; sube `SURVIVORS_CONFIG_VERSION`
sólo cuando un cambio se quede para la beta siguiente. Después de tocar, las pruebas de la
simulación: `pnpm exec vitest run packages/engine/src/survivors`.

### Primero: la velocidad de las pirañas

Desde T120 el barco de `/mar` navega a **15 nudos**: su velocidad punta es
`DEFAULT_SHIP_CONFIG.maxSpeed = 150` u/s (`packages/engine/src/ship/config.ts`; `/mar` la usa a
través de `MAR_SHIP_CONFIG` en `apps/web/app/mar/engine/steering.ts`). Las pirañas van a
**`enemies.piranha.speed = 150`** u/s, es decir, **igual que el barco a toda máquina**: escapar
es mucho más difícil que cuando el diseño se pensó (el barco iba a 22 nudos, 220 u/s). Es el
**primer mando a probar**: bajarla a 110–130 deja escapar en recta y obliga a esquivar en las
curvas. El cangrejo va a `enemies.crab.speed = 55`. Cada minuto suben un poco
(`growthPerMinute.speed`, +2 % y +1 %). La mejora de velocidad de las cartas multiplica
la velocidad punta del barco por `1 + speedBonus`.

### Maniobrabilidad (`SURVIVORS_CONFIG.handling`)

Factores sobre el barco de `/mar` durante la partida (se aplican en `survivorsShipConfig`, mismo
archivo); 1 = como navegando. Más giro y menos inercia que explorando:

| Campo | Ahora | Qué cambia |
|---|---|---|
| `handling.turnRateScale` | 1.35 | Velocidad de giro (y radio de giro más cerrado). Más = gira más rápido |
| `handling.accelerationScale` | 1.6 | Lo que tarda en coger velocidad. Más = arranca antes |
| `handling.brakeScale` | 1.6 | Lo que tarda en frenar. Más = menos inercia al soltar |
| `handling.lateralGripScale` | 1.5 | Agarre lateral (cuánto derrapa). Más = va por donde apunta; menos = desliza |

Para «más inercia», bajar `brakeScale` y `lateralGripScale`; para «gira como una moto», subir
`turnRateScale`.

### Cámara (`SURVIVORS_CONFIG.camera`)

| Campo | Ahora | Qué cambia |
|---|---|---|
| `camera.distanceScale` | 1.25 | Distancia de la cámara al barco respecto a navegando (un 25 % más lejos). Más = se ve venir antes a los enemigos, todo más pequeño |
| `camera.heightScale` | 1.15 | Altura de la cámara (un 15 % más alta). Más = vista más cenital |
| `camera.blendS` | 0.8 | s que tarda la cámara en ir y volver al empezar y al acabar |

Los enemigos aparecen en un anillo fuera de la cámara: `spawn.ringMin` / `spawn.ringMax` (u). Si
se aleja mucho la cámara, conviene alejar también el anillo para que no aparezcan a la vista.

### Otros mandos útiles

- `defeatStyle`: `'puf'` o `'sumergirse'` (el estilo por defecto, sin atajos).
- `player.waterCapacity` (100): el agua que inunda el barco; `player.invulnerableS` (0.5): el
  respiro tras un golpe; `player.magnetRadius` (90): el alcance del imán de notas.
- `caps.alta.enemies` (150) y `caps.baja.enemies` (60): el tope de enemigos por calidad. Un móvil
  va a `baja` si tiene ≤ 2 GB (`deviceMemory`), ahorro de datos, o es táctil con ≤ 4 núcleos
  (`detectQuality`, `packages/engine/src/world/sectors.ts`).
- `levels` (`base`, `linear`, `quadratic`): cuánta experiencia pide cada nivel (el ritmo de las
  cartas).
- `acts[0].tracks`: el guion de 7 minutos (cuántos enemigos y cada cuánto, por minuto).

## Las seis preguntas

Jugar varias partidas en escritorio y en el móvil (una entera, varias con `t=` cerca del final y
alguna con `carta=1`), con los dos estilos de derrota.

1. **Esquivar.** ¿Se siente bien esquivar con el barco? ¿Más o menos giro (`turnRateScale`)?
   ¿Más o menos inercia (`brakeScale`, `lateralGripScale`)? ¿Se puede escapar de las pirañas o
   hay que bajar `enemies.piranha.speed`?
2. **Cámara.** ¿Se ven venir los enemigos con tiempo, también en el móvil en vertical? ¿Más lejos
   o más alta (`camera.distanceScale`, `camera.heightScale`)?
3. **Derrota.** Decidido tras la beta 1: `sumergirse` es el estilo por defecto y `puf` queda como opción secreta (el interruptor de desarrollo). (Si algún día se elige `puf`, Álvaro tiene que aprobar el cambio de
   REQ-AVE-037: los enemigos se destruyen, sin heridas visibles.)
4. **Islas.** ¿Sirven de cobertura (las bolas no las atraviesan, los enemigos las rodean) o los
   enemigos se quedan atascados detrás?
5. **Ritmo.** ¿Engancha el ritmo de notas y cartas de nivel? ¿Salen demasiadas o muy pocas
   cartas? ¿Se ven las notas en el agua antes de que el imán las recoja?
6. **Rendimiento.** En un móvil de gama media, con el tope de enemigos lleno (con `t=360` ya hay
   muchos): ¿va fluido? ¿Qué `calidad` eligió (`dataset.calidad`)?

## Notas

Apuntar aquí (o en un archivo hermano `2026-10-04-canon-beta1-notas.md`) lo que salga de cada
pregunta, con el dispositivo y los valores probados. El orquestador las lee al empezar el plan 011.

Respuestas de Hernán, 2026-10-04 (escritorio y iPhone 11, `pnpm demo`, config por defecto):

1. Esquivar: esquiva bien.
2. Cámara: se ve bien; además, como la cámara se puede ajustar como se quiera, es perfecto.
3. Derrota: **sumergirse** (casi seguro definitivo); `puf` se queda como opción secreta.
4. Islas: los enemigos no parecen atascarse.
5. Ritmo: no se pudo probar: las pirañas son demasiado rápidas y matan antes. Bajar su velocidad
   es lo primero de la beta 2.
6. Rendimiento: fluido en un iPhone 11, así que vale para un móvil medio.
7. Extra (HUD): la cuenta atrás y la barra de nivel deben ser más pequeñas y estar más arriba;
   ahora quedan en medio de la vista y ocupan mucho, en móvil y en escritorio.
