# Diseño de referencia — «Que no pare la música» (rediseño del Cañón)

> Diseño cerrado en la sesión del 2026-10-04 (Hernán). **No es un plan**: es la referencia que
> leen los planes de cada beta (010, 011, …). Cada plan se escribe con `/orchestrator` a partir
> de su propio prompt (el de la beta 1: `2026-10-04-plan-009-beta1.md`) y de las notas de prueba
> de la beta anterior. Si una prueba cambia una decisión de aquí, el plan de la beta siguiente
> actualiza este documento.

---

## Objetivo del modo

El minijuego del Cañón deja de ser una escena 2D aparte. Al empezarlo, **en el mismo mar 3D de
`/mar`** (como Los Rápidos), desaparecen las líneas guía amarillas y lo interactivo del mundo, y
arranca un modo tipo *Vampire Survivors* de **7 minutos**: el barco del jugador se mueve, las
armas disparan solas, llegan oleadas de enemigos, 2 minibosses y un boss final. Al sobrevivir
(o morir, con un mensaje) el mundo vuelve a la normalidad donde esté el barco. Nombre del modo
(provisional, `muestra`): **«Que no pare la música»**; historia: la banda de **Los Aguafiestas**
quiere apagar la fiesta del planeta BOIA y trae a la fauna y a monstruos marinos.

El Faro **no** se toca en este lote (se rediseñará después).

---

## Decisiones cerradas (todas las tareas las siguen)

### 1. Control
- **Sólo moverse**; todas las armas disparan solas. Mismos controles del barco que en el mar
  (`packages/engine/src/ship/controller.ts`), con la maniobrabilidad **algo subida** durante la
  partida (más giro, menos inercia; valores en la config) y restaurada al terminar.

### 2. Arena y mundo
- **Todo el mar, sin bordes**: el mar de `/mar` es un plano que se repite (wrap, `planet.ts`);
  la simulación debe trabajar con la copia más cercana de cada cosa.
- **Islas = obstáculos**, con **la misma colisión que ya usa el barco** con las islas (la
  primera tarea la localiza y la comparten barco y enemigos; nada de una colisión nueva aparte).
  Los enemigos las **rodean con esquiva simple** (steering + deslizar por el contorno), sin
  pathfinding. Las **gaviotas vuelan por encima** de las islas.
- Toda aparición se **valida contra esos obstáculos**: si cae en tierra, se recoloca en agua.
- **Aparición en anillo** alrededor del jugador, fuera de cámara, por todos los lados; los
  enemigos que se quedan muy lejos se reciclan cerca (contra el abuso de islas).
- Las islas **no tienen interacción** en la v1 (las islas que dan ventajas quedan para v2).
- **Tope de enemigos simultáneos**: ~150 en calidad `alta`, ~60 en `baja` (`QualityTier`).
  Llegado el tope, la oleada sube fuerza en vez de cantidad. Un `InstancedMesh` por tipo.
- **Empieza y termina donde está el barco**. Durante la partida se ocultan/desactivan: líneas
  guía, paneles de isla, botellas, descuentos escondidos y encuentros (cocodrilos, delfín…),
  que vuelven al terminar.
- **Convivencia con el resto del mar:** el Cañón **no se puede empezar durante la carrera** (el
  panel lo explica). Si la **Boia Fiestera va a bordo**, sigue a bordo durante la batalla y
  después la misión continúa igual. El **minimapa** muestra
  sólo islas, **minibosses y bosses** (los enemigos comunes no salen).

### 3. Tono, vida y daño
- **Cómo desaparece un enemigo: dos estilos intercambiables, para probar los dos.** Un valor de
  la config, `defeatStyle: 'puf' | 'sumergirse'`, y un conmutador sólo en desarrollo para
  compararlos en vivo:
  - **`puf`**: una única animación común, sencilla, barata (una partícula/sprite compartida en
    lote), llamativa y pequeña en pantalla;
  - **`sumergirse`**: el enemigo salta o se hunde con un splash pequeño (compatible con el
    REQ-AVE-037 actual, «sin mostrar heridas»).

  Todos los enemigos usan el mismo estilo. Hernán elige tras probarlos; el `puf` cambia
  **REQ-AVE-037** y necesita el visto bueno de **Álvaro**. La tarea de docs redacta el texto de
  la decisión y la pregunta abierta; **nadie edita `docs/DECISIONES.md`**.
- **Vida = «agua a bordo»**: barra que se llena con cada golpe; llena = **barco inundado** =
  derrota («¡Barco inundado!»). Mejoras: achique (regeneración), casco (menos agua por golpe).
- Daño **por contacto** + **proyectiles** de algunos enemigos y bosses. **Las islas bloquean
  los proyectiles rectos en los dos sentidos** (los del jugador también); auras, estela,
  láseres, lluvia, fuegos y boyas orbitales sí pasan. ~0,5 s de invulnerabilidad tras golpe
  (el barco parpadea; sin parpadeo con movimiento reducido).
- **Sin segunda oportunidad** de serie; existe un objeto raro **«Salvavidas»** que salva una vez.
- **Pausa**: automática al ocultar la pestaña; la pausa manual (botón/Esc) abre el **menú normal
  de `/mar`** y al cerrarlo la partida continúa. **Si una pausa dura más de 5 minutos** la partida
  termina sin premio y el mundo vuelve. El tiempo con la **carta de subir de nivel** abierta
  también cuenta como pausa para ese límite. La validación cuenta **tiempo activo**, no tiempo
  real (ajuste técnico de REQ-AVE-038 para este juego; documentarlo).
- **Salir de la página = abandono, sin premio.** El menú de pausa deja ir a Tickets
  (REQ-AVE-039), pero avisa de que eso termina la partida. Recargar también es abandono.

### 4. Progresión dentro de la partida
- Los enemigos sueltan **notas musicales** con valor según la figura (p. ej. corchea < negra <
  blanca < redonda; los bosses, clave de sol). **Imán** de recogida mejorable.
- **Al subir de nivel**: pausa y se elige **1 de 3** cartas grandes (aptas para tocar).
- **Huecos: 4 armas + 4 pasivas**, cada una **hasta nivel 5**.
- **Pasivas = vinilos por género** (9 en el catálogo):

  | Vinilo | Efecto |
  |---|---|
  | Techno | + velocidad de ataque |
  | Reggaetón | + tamaño de área |
  | House | + resistencia (menos agua por golpe) |
  | Drum & Bass | + velocidad del barco |
  | Disco | + radio del imán |
  | Chill / Ambient | achique (el agua baja sola) |
  | Hardstyle | + daño |
  | Pop | + experiencia |
  | Rumba | + 1 proyectil |

  (Música por capas según vinilos: v2.)
- **4 evoluciones** (arma a nivel 5 + vinilo pareja):

  | Arma | + Vinilo | = Evolución |
  |---|---|---|
  | Cañón de agua | Hardstyle | **El Drop** (cada bola explota en área) |
  | Subwoofer | House | **Muro de Sonido** (aura enorme que empuja) |
  | Láser de festival | Techno | **Show de Láseres** (4 rayos) |
  | Boyas orbitales | Disco | **Bola de Discoteca** (bola gigante que lanza destellos) |

- **Minibosses sueltan un cofre**: 1 mejora gratis, o la evolución si se cumple la condición.
- **Arma inicial para todos: Cañón de agua** (arma según barco: v2).

### 5. Armas (7 en la v1)
| Arma | Cómo ataca |
|---|---|
| **Cañón de agua** (inicial) | bola al enemigo más cercano (proyectil recto) |
| **Subwoofer** | aura de graves alrededor del barco |
| **Láser de festival** | rayo que gira alrededor del barco |
| **Boyas orbitales** | 2–3 boias BOIA en órbita |
| **Cañón de confeti** | ráfaga en abanico hacia donde navegas (proyectiles rectos) |
| **Fuegos artificiales** | cohetes a enemigos al azar que explotan en área |
| **Lluvia ácida** | nube sobre un grupo de enemigos: zona que daña cada segundo (verde ácido) |

Cada arma tiene **tabla fija por nivel** (la carta dice exactamente qué gana: «Nivel 3: +1
boya»). Estela de espuma y Ancla bumerán: v2.

### 6. Enemigos comunes (6)
| # | Comportamiento | Aspecto |
|---|---|---|
| 1 | Enjambre: rápido, débil, en grupo | banco de pirañas |
| 2 | Tanque: lento, mucho aguante | cangrejo acorazado |
| 3 | Volador: ignora islas | gaviota aguafiestas |
| 4 | Tirador: se para a distancia y dispara | pirata en un botecito con pistola de agua |
| 5 | Embestida: aviso (línea en el agua) y carga recta | pez espada |
| 6 | Divisor: al hacer «puf» se parte en 2 pequeños | medusa |

- Crecen **por minuto** (más aguante y algo de velocidad); desde la mitad aparecen **élites
  brillantes** con mejores notas; algunos enemigos extra sin saturar.
- **Modelos sencillos de pocos polígonos hechos en código** (como `race-props.ts` con `Kit` y la
  paleta `C`), silueta y color inconfundibles, legibles en móvil. (Buceador: v2.)

### 7. Bosses
- **Campaña de 3 actos**: la 1.ª partida acaba con el boss 1; vencerlo abre el acto 2, y así.
  Tras completar los 3, **modo libre**: se elige acto/boss.
- **Minibosses (los mismos en los 3 actos, más fuertes en cada acto):**
  - **~2:30 · El Vecino Quejica**: barcaza con megáfono («¡BAJAD LA MÚSICA!»), ondas de sonido
    en anillo con huecos (las islas las bloquean). Banco de pruebas del sistema de bosses.
  - **~4:30 · Tiburón Martillo**: varias embestidas con aviso; entre ellas llama a pirañas.
- **Bosses finales (todos se mueven):**
  1. **Barco Pirata Fantasma**: translúcido e invulnerable a ratos, andanadas laterales,
     invoca piratas fantasma.
  2. **Kraken**: nada bajo el agua (se ve su sombra) persiguiendo al jugador, emerge cerca;
     tentáculos con aviso de círculo en el agua; golpear tentáculos expone la cabeza; puede
     agarrarse a una isla y lanzar rocas.
  3. **Capitán Aguafiestas, acorazado «El Apagón»**: **apaga las luces** (sólo se ve lo que
     alumbra el barco) y **todas las islas iluminan su zona** (refugios de luz); entre apagones
     combina ataques anteriores. Respeta la luz atenuada y sin destellos peligrosos.
- Los ataques con aviso, la barra del boss arriba y las fases se hacen con un **sistema de
  bosses genérico** (máquina de estados por fases, datos en la config).

### 8. Los 7 minutos y la victoria
- Guion del acto 1 (actos 2 y 3: misma estructura, enemigos más duros y tipos peligrosos antes):

  | Tiempo | Evento |
  |---|---|
  | 0:00 | pirañas + medusas (niveles rápidos al principio) |
  | 1:00 | gaviotas |
  | 1:30 | cangrejos |
  | 2:30 | **Miniboss 1** (comunes bajan de ritmo) |
  | 3:00 | piratas en botecito |
  | 3:30 | peces espada; empiezan las élites |
  | 4:30 | **Miniboss 2** |
  | 5:00 | **«Marea»**: enjambre en anillo desde todos lados, 20 s |
  | 5:30 | **Boss final** (los comunes siguen, más despacio) |
  | 7:00 | amanece: fin |

- **Medallas** (como la carrera): 🥉 sobrevivir al 7:00 (el boss se retira); 🥈 sobrevivir +
  vencer a los 2 minibosses; 🥇 **vencer al boss final** (la partida termina en ese momento con
  un final especial). **Avanzar de acto exige vencer al boss.**
- El resultado `won` de la sesión (el que alimenta `win_minigame`, `canon` y `guardacostas`)
  equivale a **bronce o más**.
- El guion es **datos** (eventos por segundo y por acto), no código.

### 9. Dificultad, premios, logros, mascota y ranking
- **Dificultad**: Tranquila / Normal / Tormenta (ánimo y daño enemigo; más enemigos en
  Tormenta). La campaña y los logros de boss cuentan en cualquiera.
- **Pop-up previo**: al pulsar Jugar en el panel del Cañón se abre un pop-up para **elegir acto
  (los desbloqueados), dificultad, ver el ranking del boss elegido y Jugar**.
- **Premio por partida: cada medalla se cobra una vez al día, por separado.** El `sourceRef`
  lleva la medalla (`minigame:canon:bronce@<fecha>`, `…:plata@…`, `…:oro@…`), así que una medalla
  mejor más tarde sí se cobra, y un oro cobra también la plata y el bronce del día que no tuvieras.
  Cantidades `muestra`: bronce 30 pts + 10 monedas, plata 60 + 20, oro 100 + 40 (oro de primeras =
  190 pts + 70 monedas; ajustables). Sustituye a la política «season» actual. Requiere ampliar
  `rewards.ts` (y su equivalente en Supabase) para varios premios diarios por juego.
- **Logros** (sistema actual en curso → listo → reclamado; `muestra` hasta Álvaro, P14):

  | id | Nombre | Pide | Premio |
  |---|---|---|---|
  | `canon-zarpa` (nuevo) | Zafarrancho | jugar una partida | 20 pts + 10 monedas |
  | `canon` (**se mantiene el id**) | Hasta que amanezca | sobrevivir una partida | 60 pts + 30 monedas (sigue contando para `guardacostas`) |
  | `canon-fantasma` (nuevo) | Exorcista | vencer al Barco Fantasma | 80 pts + **bandera fantasma** |
  | `canon-kraken` (nuevo) | Rompetentáculos | vencer al Kraken | 120 pts + **mascota minikraken** |
  | `canon-capitan` (nuevo) | Que no pare la música | vencer al Capitán | 150 pts + **barco «El Apagón»** |
  | `canon-tormenta` (nuevo, oculto) | Ojo del huracán | vencer al Capitán en Tormenta | 150 pts + 50 monedas |

  **`guardacostas` cambia**: pasa a pedir *ganar el Faro + jugar una partida del Cañón* (no
  ganarla), para que nadie quede sin el barco Cel-shaded por el dispositivo. El id no cambia.

- **Mascota minikraken**: primera de una nueva categoría **«Mascota»** en Mi Barco (activar /
  desactivar; preparada para más mascotas). Va en la cubierta en **toda la experiencia**, animado
  (saluda cerca de islas, se esconde en los apagones). **No ayuda en combate.**
- **«El Apagón»**: en la v1, **apariencia del barco actual** (casco negro, velas oscuras,
  bandera y estela propias), no un modelo nuevo.
- **Ranking por boss**: puntuación de partida = enemigos + notas + medalla + rapidez al vencer
  al boss, × multiplicador de dificultad. Patrón de `ranking-circuit.ts`: tripulación de muestra
  en modo local, ranking global con cuenta (RPC con anti-trampas básico como en el plan 008:
  duración mínima plausible, máximo de puntuación por versión de config).
- **Tarjeta final** como la de la carrera: medalla o «¡Barco inundado!», tiempo, enemigos,
  notas, armas/vinilos con nivel, puesto, logros desbloqueados, «Otra vez» y «Volver al mar».
  Al cerrarla, el mundo vuelve con un fundido corto.

### 10. Interfaz, sonido, dispositivos y arquitectura
- **HUD mínimo** con el estilo de los chips de la carrera: arriba al centro la cuenta atrás y la
  barra de experiencia con el nivel; barra del boss arriba cuando lo hay; abajo, pequeño, las 4
  armas y 4 vinilos con su nivel (**en móvil van arriba a la izquierda**, para no chocar con los
  controles táctiles del barco). La **barra de agua a bordo va bajo el barco** (estilo VS), con
  un patrón además del color y un **tamaño mínimo legible** con la cámara alejada.
- **Cámara**: se aleja ~25 % y sube algo de ángulo durante la partida; vuelve suave al acabar.
- **Sonido**: efectos sintetizados con el sistema de `minigames/sound.ts`; un bucle de batalla y
  otro de boss `muestra`, con hueco preparado para **pistas reales de BOIA** (aprobación de
  Álvaro).
- **GPU que caen a la versión estática** (<30 fps): la tarjeta del Cañón dice que el modo
  necesita un dispositivo más potente. **El cañón 2D antiguo se elimina.** Accesibilidad
  (REQ-AVE-039): movimiento reducido sin temblor de cámara y efecto de derrota reducido, sin destellos
  peligrosos (láser, apagón), luz atenuada limita el oscurecimiento, teclado, áreas táctiles
  amplias, sin bloquear Tickets.
- **Qué pasa con el 2D:** el **cañón 2D se elimina ya en la beta 1** (`minigames/canon.ts`, su parte de
  `minigames.test.ts` y del e2e). `canon` **sigue en el registro de minijuegos** sólo por su id,
  sesión, validación, premios y la señal `win_minigame`, pero **ya no se monta con el anfitrión
  2D** (`host.ts` / `mountMinigame`). El **Faro 2D se deja tal cual**, sin invertir en él: tendrá
  su propio juego dentro del mapa en otro plan, y ese plan borrará el soporte 2D. La ruta de
  prueba `?minijuego=canon` abre el nuevo modo.
- **Arquitectura** (mismo patrón que la carrera):
  - `packages/engine/src/survivors/`: simulación **pura y determinista** sin three.js
    (jugador, aparición con wrap, colisión con islas y esquiva, enemigos, armas, vinilos,
    evoluciones, notas, niveles, guion, bosses, pausa). Semilla → partida idéntica. Un único
    **archivo de configuración versionado** con todo el equilibrio (cubierto por `configHash`).
    Pruebas que simulan partidas completas aceleradas por semilla.
  - `apps/web/app/mar/engine/survivors-props.ts`: modelos `InstancedMesh`, el «puf», las notas,
    los bosses y la mascota.
  - HUD y pop-ups en `apps/web/app/mar/`, textos por clave en `apps/web/lib/i18n/`.
  - El minijuego **conserva el id `canon`** con una nueva versión de config, reutilizando
    sesión, validación (`session.ts`) y premios (`rewards.ts`).
  - Modo local (D-20) y modo Supabase deben funcionar los dos: logros nuevos al enum/RPC de
    Supabase, RPC de ranking por boss, premio diario por medalla validado.
- **Reglas técnicas:**
  - **Paso fijo de simulación (1/60 s)**: misma semilla + mismas entradas = misma partida.
  - **Rejilla espacial** para todas las colisiones (enemigos, proyectiles, notas, islas).
  - **Topes también para proyectiles y notas**; las notas cercanas se **fusionan** en una de más
    valor (como las gemas de VS).
  - **Apagón sin luces reales de three.js**: una capa oscura en el shader con «agujeros» de luz
    (el barco y las islas cercanas), barata también en calidad `baja`.
  - **Atajos sólo en desarrollo**: `?minijuego=canon&acto=3&dificultad=normal&t=330&seed=…` para
    saltar a un momento; las pruebas automáticas no esperan 7 minutos.
  - **Anti-trampas**: el ranking y el premio rechazan un oro antes del 5:30 + la duración mínima
    del combate de cada boss, y duraciones activas imposibles.
  - El nuevo estado (progreso de campaña, mascota, apariencia, premios por medalla) pide
    **migración del documento local** (`store/schema.ts`, `migrations.ts`) y de Supabase
    (categoría Mascota, cosméticos nuevos, enum de logros).

---

## Hoja de ruta por betas

**Cada beta va directa a producción** (cada push a `main` despliega), sustituyendo al cañón 2D
desde la beta 1, con una etiqueta **«BETA»** visible en el panel y en el HUD hasta el
lanzamiento. **Un plan por beta**: al terminar cada una, Hernán la prueba y escribe sus notas; el
plan siguiente empieza con una entrevista corta del orquestador sobre esas notas. (Números de
plan desde el 2026-10-04: el plan 009 fue el de las mejoras del mundo de Codex, así que la beta 1
es el plan 010 y el lanzamiento, el 014.)

| Beta | Plan | Qué trae | Qué se prueba |
|---|---|---|---|
| **1 · Sensación** | 010 | Simulación base (paso fijo, rejilla, semilla, config versionada, pausa), integración en `/mar` (entrar y salir en el mismo mundo, ocultar líneas e interactivos, cámara, maniobrabilidad, bloqueo en carrera, colisión compartida con islas, aparición validada), **pirañas + cangrejo**, **Cañón de agua**, notas con fusión e imán, carta 1 de 3 con pocas mejoras, agua a bordo, final a los 7:00 o inundado, **puf y sumergirse con conmutador**, HUD mínimo, retirada del cañón 2D | ¿Es divertido esquivar con el barco? Maniobrabilidad, cámara, estilo de derrota |
| **2 · Bucle sin bosses** | 011 | Los 6 enemigos con modelos, élites, crecimiento, Marea, 3 dificultades, guion completo; 7 armas, 9 vinilos, 4 evoluciones, Salvavidas, bloqueo de proyectiles por islas | ¿Engancha subir de nivel? ¿Las armas se sienten distintas? Ritmo |
| **3 · Primer acto** | 012 | Sistema de bosses, Vecino Quejica, Tiburón Martillo (con cofre), Barco Fantasma, medallas, campaña (acto 1 → 2), tarjeta final | ¿Los bosses son divertidos? ¿Se entiende cómo ganar? |
| **4 · Campaña completa** | 013 | Kraken, Capitán con apagón e islas iluminadas, pop-up previo (acto, dificultad, Jugar), HUD completo, sonido y accesibilidad completos | Actos 2 y 3, apagón, móvil |
| **Lanzamiento** | 014 | Premio por medalla diario, 6 logros + cambio de `guardacostas`, Mascota + minikraken, «El Apagón», ranking por boss (local y global) en el pop-up, e2e, `docs/spec/estado.md`, borrador de decisión para Álvaro, equilibrio con bots y rendimiento en `baja`, se quita la etiqueta BETA | Revisión final; visto bueno de Álvaro |

> **Cambio del plan 012 (2026-10-05):** el **Kraken** pasó a la beta 3 (boss final del acto 2, con la campaña acto 1 → 2); la beta 4 trae el resto de su fila.

**Durante las betas**: el resultado `won` (= sobrevivir los 7:00; bronce o más cuando existan
medallas) sigue alimentando `win_minigame`, `canon` y `guardacostas`, y el premio sigue siendo el
de ahora (150 pts + 50 monedas, una vez por temporada) hasta que el lanzamiento ponga el premio
por medalla.

---

## Pendiente de Álvaro (no bloquea la construcción; todo `muestra`)
1. Si Hernán elige el `puf`: cambio de REQ-AVE-037 (los enemigos se destruyen con un «puf», sin
   heridas visibles). Con `sumergirse` no hace falta cambiarlo.
2. Nombres, textos, puntos y monedas de logros y premios.
3. Música real de BOIA para los bucles de batalla y boss.

## Segunda versión (fuera de este lote)
Islas que dan ventajas · arma inicial según barco · música por capas según vinilos · buceador ·
Estela de espuma y Ancla bumerán · minibosses distintos por acto · «El Apagón» como modelo propio
· «Tormenta tóxica» (evolución de la Lluvia ácida) · rediseño del Faro dentro del mapa (y borrado
del soporte 2D de minijuegos).
