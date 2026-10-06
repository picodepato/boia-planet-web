# Guía de prueba — Cañón «Que no pare la música», versión definitiva

> Para Hernán. La versión definitiva (plan 013) aplica las notas de la beta 3 y termina el juego
> con **dos actos** (el acto 3, el del Capitán Aguafiestas, queda para una versión posterior).
> Ya **no lleva la etiqueta «BETA»**. Quiere contestar: **¿está listo para enseñárselo a Álvaro y
> publicarlo?** Esta guía dice qué hay, cómo jugarlo rápido, qué valores tocar y qué contestar.
> Las respuestas se apuntan al final («Notas»). Diseño completo:
> [2026-10-04-canon-survivors.md](2026-10-04-canon-survivors.md); la guía anterior, con las notas
> de la beta 3: [2026-10-05-canon-beta3-guia-prueba.md](2026-10-05-canon-beta3-guia-prueba.md);
> lo que necesita el visto bueno de Álvaro:
> [2026-10-05-canon-decision-alvaro.md](2026-10-05-canon-decision-alvaro.md).

## Qué hay en la versión definitiva

Todo lo de la beta 3 (la partida en el mismo mar de `/mar`, 6 enemigos con élites y Marea, 7
armas, 9 vinilos, 4 evoluciones, botín de las élites, el Vecino Quejica, el Tiburón Martillo con
su cofre, el Barco Pirata Fantasma, el Kraken, la barra del boss, medallas, campaña acto 1 → 2 y
la tarjeta final) más:

- **«Terminar partida»** en la pausa (T148): pregunta antes y acaba en la tarjeta «Partida
  terminada» con tiempo, enemigos y notas; sin medalla, premio, logros ni ranking.
- **HUD de batalla nuevo** (T148): durante la partida se apartan los puntos ★ y las monedas 🪙;
  arriba a la derecha van las armas, los vinilos y la Segunda vida; la píldora de tiempo, nivel y
  experiencia es más pequeña. Nada tapa la pausa, el menú, el agua, la barra del boss ni el
  minimapa, en móvil y en escritorio.
- **Vinilo de curación rehecho** (Chill / Ambient, T149): N1 achica 0,4 por segundo; N2 y N3
  suben la capacidad de agua +15 cada uno; N4 achica 0,8 por segundo; N5 da un **escudo**: el
  siguiente golpe no mete agua y deja 6 s de invulnerabilidad; vuelve 20 s después. Un aro
  turquesa alrededor del barco dice que está listo.
- **El anillo del Vecino** (T149): 8 huecos iguales de unas 2,5 veces el ancho del barco; la
  segunda onda gira medio hueco, así que hay que moverse un poco. Las islas siguen cortándolo.
- **Iconos SVG** (T150) para todas las armas, vinilos, evoluciones, mejoras, botín, Segunda vida
  y la llama, en el estilo de los iconos del menú del mundo (aprobados por Hernán).
- **Pop-up previo** (T151): «Jugar» en el panel de la isla abre un pop-up para elegir el acto
  (Acto 1; Acto 2 cuando se abre; Acto 3 cerrado, «Próximamente»), la dificultad, ver el ranking
  del boss final del acto y Jugar. Con teclado y con el dedo; se cierra con Esc.
- **Sonido** (T152), todo sintetizado en el código: efectos (disparo, golpe, enemigo abajo, nota,
  nivel, carta, botín, aviso y caída de boss, medalla, inundado), un **bucle drum and bass** a 170
  BPM durante la batalla, una variante más pesada mientras hay un boss y, al acabar, vuelve el
  ambiente del mar. Volumen y silencio en la pausa, recordados en el navegador; nada suena hasta
  el primer toque o tecla.
- **Accesibilidad** (T152): avisos para lectores de pantalla (nivel, boss, resultado), sin
  temblor de cámara con movimiento reducido, partida entera con el teclado, áreas de toque de 44
  px. La revisión, más abajo.
- **Premio por medalla, una vez al día cada una** (T153): bronce 30 ★ + 10 🪙, plata 60 + 20,
  oro 100 + 40 (un oro de primeras cobra las tres: 190 + 70). Sustituye al premio de la beta.
- **Logros nuevos** (T153): Zafarrancho (jugar), Hasta que amanezca (el `canon` de siempre,
  aguantar), Exorcista (Barco Fantasma, con la bandera fantasma), Rompetentáculos (Kraken, con la
  mascota) y el oculto Ojo del huracán (Kraken en Tormenta). Guardacostas pide ahora ganar el Faro
  y **jugar** el Cañón.
- **Mascota minikraken** (T154): categoría «Mascota» en Mi Barco; el minikraken va en la popa
  del barco por todo `/mar` (también en las carreras y en el Cañón) y saluda cerca de las islas.
  No ayuda a jugar.
- **Ranking por boss** (T155): una tabla para el Barco Fantasma y otra para el Kraken, en el
  pop-up y en la tarjeta final (puntos, tu mejor y tu puesto). Sin cuenta, contra la tripulación
  de muestra; con cuenta, global.
- **Cierre** (T156): sin «BETA» (panel, HUD y pop-up); equilibrio medido otra vez con pilotos,
  rendimiento en `baja` con boss, sonido y mascota, la suite e2e entera.

## Los atajos de desarrollo

Encendidos siempre con `pnpm dev` (y en las e2e). En la versión publicada
(https://boia-planet-roan.vercel.app) sólo si la URL lleva **`dev=1`**. **Se quedan** en esta
versión (decisión 8 del plan 013), pero una partida empezada con un atajo nunca da premio, logros
ni puesto en el ranking de la versión publicada.

| Parámetro | Qué hace | Ejemplo |
|---|---|---|
| `minijuego=canon` | Empieza la partida nada más cargar el mar, donde aparece el barco | `/mar?minijuego=canon` |
| `t=<s>` | Empieza en el segundo `s` (0–419); si ya pasó la hora de un boss, entra el último que tocaba | `&t=145` (justo antes del Vecino) |
| `acto=<n>` | Juega el guion del acto `n` (`2`: el del Kraken) sin pasar por la campaña | `&acto=2&t=325` |
| `seed=<n>` | La semilla: misma semilla y mismo pilotaje, misma partida | `&seed=7` |
| `dificultad=<id>` | `tranquila`, `normal` o `tormenta` (sin él, la del pop-up) | `&dificultad=tormenta` |
| `vencer=1` | Cada boss cae en cuanto aparece (oro y acto siguiente sin luchar) | `&t=331&vencer=1` |
| `botin=1` | Toda élite suelta objeto y la partida empieza con los tres junto al barco | `&botin=1` |
| `armas=1` | Empieza con las siete armas a nivel máximo | `&armas=1` |
| `carta=1` / `carta=surtido` | Empieza con una carta abierta / con una opción de cada clase | `&carta=surtido` |
| `derrota=puf` o `derrota=sumergirse` | Empieza con ese estilo de derrota | `&derrota=puf` |
| `oferta=1` | Sólo abre el panel del Cañón, sin empezar | `&oferta=1` |
| `mascota=1` | Te da el minikraken (como al vencer al Kraken); sólo en `pnpm dev` | `/mar?mascota=1` |
| `ranking=1` | Una partida de atajo entra en tu ranking local; sólo en `pnpm dev` | `&ranking=1` |
| `dev=1` | En producción, enciende los atajos de partida | `?dev=1&minijuego=canon` |

Ejemplos:

- El Vecino y sus huecos: `http://localhost:3000/mar?minijuego=canon&t=145&seed=7`.
- El escudo del vinilo de curación: juega hasta tener Chill al 5 (con `carta=surtido` sale antes).
- El Barco Fantasma con todo y el sonido del boss: `…/mar?minijuego=canon&t=325&armas=1` (toca una
  tecla para que suene).
- El Kraken: `…/mar?minijuego=canon&acto=2&t=325`.
- El pop-up, con el acto 2 abierto: `…/mar?minijuego=canon&t=331&vencer=1`, luego
  `…/mar?minijuego=canon&oferta=1` y «Jugar».
- La mascota: `…/mar?mascota=1`, luego Menú → Logros → Mi Barco → Mascota.
- En producción: `https://boia-planet-roan.vercel.app/mar?dev=1&minijuego=canon&acto=2&t=325`.

Para jugar de verdad (premio, logros, ranking), sin atajos: navegar hasta la isla del Cañón, «Jugar»
en su panel, elegir en el pop-up y «Jugar».

### Ver el estado por dentro

En la consola del navegador: `document.querySelector('[data-testid="mar-canon"]').dataset`. Además
de lo de la beta 3, da `sonido` (bloqueado / activo / oculto) y `musica` (batalla / jefe / mar).
En el lienzo (`[data-testid="mar-canvas"]`), `mascota` dice si el minikraken va en cubierta.

## Qué tocar y dónde

Todo el equilibrio sigue en **`packages/engine/src/survivors/config.ts`** (`SURVIVORS_CONFIG`,
versión `SURVIVORS_CONFIG_VERSION`; el Vecino en `survivors/vecino.ts`). Después de cambiar:
`pnpm exec vitest run packages/engine/src/survivors --testTimeout=60000`. Las pruebas de equilibrio
con bosses están en `survivors-boss-balance.test.ts`.

| Para… | Dónde |
|---|---|
| El vinilo de curación | `passives.chill.levels` (achique, `waterCapacityBonus`, `shield`: `invulnerableS`, `rechargeS`) |
| Los huecos del Vecino | `survivors/vecino.ts` (`gaps`, `gapBoatWidths` de `onda` y `bronca`) |
| Lo que aguantan los bosses | `bosses.<id>.hp`, `acts[n].bossHpScale` (acto 2: ×1,5) y `difficulties.<id>.enemyHp` |
| Las dificultades | `difficulties` (Tranquila 0,7 / 0,8 / 0,75, Normal 1 / 1 / 1, Tormenta 1,6 / 1,6 / 1,6 sobre daño / aguante / cuántos; `bossHp`, desde T156, sólo sobre los bosses: Tormenta 1,25) |
| Premios por medalla | `CANON_MEDAL_PRIZES` (`packages/engine/src/minigames/`) |
| Logros | `packages/store/src/sample/progress.ts` |
| Puntos del ranking | `apps/web/lib/mundo/ranking-canon.ts` |
| El sonido | `apps/web/app/mar/canon-audio.ts` (efectos, bucles; `setMusic` es el hueco para pistas reales) |
| Textos | `apps/web/lib/i18n/es-mar.ts` (`mar.canon.*`, `survivors.*`) |

## Equilibrio medido (T156)

Partidas enteras del piloto que esquiva y elige bien (`greedy`), 12 semillas por acto y
dificultad (impares en el mar de Arcilla, pares en un archipiélago denso), con el vinilo de curación
y el anillo del Vecino nuevos. Victorias = oro (boss final vencido); entre paréntesis, las de config
v15:

| Acto · boss final | Tranquila | Normal | Tormenta |
|---|---|---|---|
| 1 · Barco Fantasma | 11/12 (11) | 11/12 (11) | **4/12 (8)** |
| 2 · Kraken | 10/12 (10) | 6/12 (6) | 2/12 (3) |

- **Minibosses**: el Vecino y el Tiburón caen en 12/12 en Tranquila y Normal en los dos actos (el
  Vecino del acto 2 en Tranquila, 11/12); en Tormenta, 10–11/12 en el acto 1 y 6/12 en el acto 2.
- **El combate con el boss final** dura de media 32 s (Tranquila), 43 s (Normal) y 68 s
  (Tormenta) en el acto 1, y 54 / 59 / 64 s en el acto 2; en Tormenta al Kraken le queda de media
  un 77 % de vida.
- **Cambio (config v16)**: en v15 el piloto ganaba al Barco Fantasma en Tormenta 8 de 12 veces,
  así que Tormenta no era difícil. Nuevo `difficulties.tormenta.bossHp` = 1,25: los bosses aguantan
  un 25 % más sólo en Tormenta, sin tocar a los enemigos comunes; Tranquila y Normal no cambian.
  Probado y descartado: subir la vida del Fantasma a 3000 (bajaba Tranquila a 10/12 y apenas
  tocaba Normal, porque en Tranquila hay menos enemigos y se sube menos de nivel).
- **Normal en el acto 1** sigue ganándose casi siempre con el piloto, que esquiva mejor que una
  persona; es una pelea (43 s de media). Si a Hernán le parece fácil jugando, el primer mando es
  `bosses.fantasma.hp`, mirando que Tranquila no baje.

## Rendimiento en `baja` (T156)

Medido en el navegador de las e2e (Chromium con SwiftShader, sin GPU, en una máquina cargada),
teléfono de 360×640 forzado a `baja`, 8 s jugando con el mar lleno (60 de 60 enemigos), las siete
armas al máximo, el boss final en pantalla, **el sonido sonando (bucle de boss) y el minikraken en
cubierta** (`mar-canon.spec.ts`, «rendimiento en `baja` con el boss final del acto N…»):

| Con… | p50 | p95 | Peor | p95 con la CPU 4× más lenta |
|---|---|---|---|---|
| Barco Fantasma | 16,7 ms | 33,4 ms | 83 ms | 33,4 ms |
| Kraken | 16,7 ms | 33,4 ms | 100 ms | 50 ms |
| Sin boss, a las 6:00 | 16,7 ms | 33,4 ms | 100 ms | 50 ms |

Sin sonido ni mascota, en la primera pasada de la suite entera (con la máquina más cargada), el
p95 fue de 50 ms con cualquiera de los dos bosses: el sonido y la mascota no se notan, así que no
hay un punto caliente que arreglar. El tope de la prueba es 100 ms de p95; en un móvil de verdad lo mira Hernán
(pregunta 7).

## Revisión de accesibilidad (REQ-AVE-039)

Revisión del Cañón hecha en T156 sobre lo construido (T117–T152) y sus pruebas:

- **Sin audio**: todo lo que suena también se ve. Cada ataque dañino de un boss tiene su aviso en
  el agua (anillo del Vecino, líneas del Tiburón y de las andanadas, círculos del Kraken) con su
  progreso; la llegada de un boss sale en un cartel y en la barra; subir de nivel abre la carta; el
  resultado sale en la tarjeta. El sonido arranca callado y se puede silenciar en la pausa.
- **Movimiento reducido** (`prefers-reduced-motion`): la cámara no tiembla nunca (golpes, saltos,
  choques); las armas tienen variante sin destellos (los Focos sin parpadeo, anillos quietos); el
  minikraken se queda quieto. Probado en `mar-canon.spec.ts` («accesibilidad: …», «all max-level
  weapons are drawn …, reduced=true»).
- **Teclado**: el pop-up (flechas, Tab atrapado, Esc), la partida (flechas), las cartas (flechas,
  números, Intro) y la pausa con su sonido, sólo con teclado («teclado: sólo con el teclado…»).
- **Tacto**: pausa, cartas, pop-up y mandos del sonido de 44 px o más; nada tapa «Entradas».
- **Lectores de pantalla**: región `aria-live` que anuncia nivel, boss y resultado; los diálogos
  (pop-up, cartas) son modales con nombre.
- **Color**: la barra de agua lleva dibujo además de color; las medallas llevan texto.
- **Pendiente**: el Faro 2D no se revisa (se rehará dentro del mapa); una prueba con un lector de
  pantalla de verdad (VoiceOver, TalkBack) la hace una persona.

## Las preguntas

Jugar en escritorio y en el móvil (iPhone 11 y, si se puede, un Android de gama media): una
partida entera de cada acto en Normal desde el pop-up, una en Tranquila y otra en Tormenta, y
alguna con atajos.

1. **Las notas de la beta 3.** ¿Están resueltas? «Terminar partida», el HUD sin solapes, el vinilo
   de curación (¿se nota cada nivel?, ¿el escudo se entiende con su aro?), los iconos y los huecos
   del Vecino.
2. **El pop-up previo.** ¿Se entiende qué elegir? ¿Se ve claro que el acto 2 se abre venciendo al
   Barco Fantasma y que el 3 llegará más adelante? ¿El ranking se lee bien?
3. **El sonido.** ¿El bucle cansa? ¿Los efectos se distinguen? ¿El cambio a la música de boss y la
   vuelta al mar se notan? ¿El volumen por defecto (70 %) está bien?
4. **Premios y logros.** ¿Los premios por medalla y los logros se entienden en la tarjeta final y en
   Logros? ¿Las cifras te parecen bien para enseñárselas a Álvaro?
5. **La mascota.** ¿Se ve el minikraken en cada barco? ¿Tamaño, sitio y colores?
6. **El equilibrio.** ¿Tranquila se gana sin sufrir? ¿Normal es una pelea? ¿Tormenta es un reto?
   ¿El Kraken es más difícil que el Fantasma?
7. **El móvil.** Con un boss, las siete armas, el sonido y la mascota: ¿va fluido? ¿Qué `calidad`
   eligió? ¿Se calienta?
8. **Para Álvaro.** ¿Falta algo en el [borrador para Álvaro](2026-10-05-canon-decision-alvaro.md)
   antes de enseñárselo?

## Notas

Apuntar aquí (o en un archivo hermano `2026-10-05-canon-definitiva-notas.md`) lo que salga de cada
pregunta, con el dispositivo, la dificultad, el acto y los valores probados.
