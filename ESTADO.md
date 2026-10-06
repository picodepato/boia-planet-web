# Estado del trabajo

Dónde quedó el repo al cerrar la última sesión. Una sección por encargo, la
más nueva arriba: `## <fecha> — encargo NN: <título>`. Se lee después de los
documentos base y se actualiza al cerrar cada sesión.

## 2026-10-06 — plan 015 T169: Castle simulation v2

Qué existe (`packages/engine/src/defense/`, `DEFENSE_CONFIG_VERSION` 3 → 4):

- **Camino v2** (decisión 7): `DefensePathDef.legs`, trazo de tortuga alrededor del
  castillo: `orbit` (espiral), `u` (U hacia el castillo: recto `depth`, media vuelta
  de radio `radius`, recto paralelo de vuelta) y `zigzag` (tramos rectos hacia el
  castillo a ±`angleRad`). Config: vórtice a 980 u como antes (no cambia la
  posición del vórtice ni el radio de la arena, 1120 u: siguen las pruebas de
  Boia 7 y la carrera de plan 014), 4 U de 430 u con radio 135 (entre ellas, 3 U
  al revés abiertas al castillo), bajada por la derecha y zigzag de 3 tramos de
  230 u a ±40° hasta la muralla. `DefensePath.uTurns` (centro de cada media
  vuelta) y `legOf` sustituyen a `turnOf`.
  - Largo: **≈10 390 u** (v1: 6 399 u, ×1,62). **Tiempo de un enemigo normal:
    `normalWalkS` 44 s** (v1: 40 s) → velocidad ≈236 u/s (v1 160 u/s): se mantiene
    «unos 40 s» de plan 014 decisión 5.
- **Construir en toda la arena** (decisión 5): sin anillo del avión
  (`plane.buildRing` y el motivo `ring` quitados); la huella entera dentro del
  borde (`arena`), fuera del camino, vórtice, castillo y otras islas.
- **Avión**: `moveTo` (vuela a un punto acotado a la arena con
  `defenseClampToArena`, frena y se para; el mando lo cancela); mejoras
  `upgradePlane: 'damage' | 'speed'`, niveles 1…5 (`damage`, `damageCost`,
  `cooldownS`, `speedCost`); snapshot `damageLevel`, `speedLevel`, `maxLevel`,
  `nextDamageCost`, `nextSpeedCost`, `cooldownS`, `target`.
- **Castillo**: `upgradeCastle` (+50 vida máx. y la cura, 250/400/600 monedas,
  `muestra`); snapshot `castle.level/maxLevel/nextUpgradeCost`; medalla y bono
  sobre la vida máxima mejorada; resultado `castleLevel`.
- **Prioridades**: `DefenseTargetPriority` first/last/strongest/closest,
  `pickTarget`; por defecto Nochevieja/Halloween/Puerto «first», Benidorm
  «strongest»; Faro, Sonido e Ibiza no eligen (null). Entrada `setPriority`,
  `setTowerPriority`, suceso `towerPriority`.
- **×2**: `DefenseClock.scale` 1|2 (`DEFENSE_TIME_SCALES`): el doble de pasos
  fijos por segundo real; la pausa cuenta en tiempo real.
- **«Llamar oleada»**: reloj de calendario `waveS` = `activeS` + adelanto;
  `callWave` salta al principio de la siguiente y paga `waves.callCoinsPerS` (1)
  por s adelantado; suceso `waveCalled`; resultado `wavesAheadS`. La partida
  dura lo mismo.
- **Aviso de la siguiente**: `nextWave()` / `snapshot.nextWave` (`wave`, `startS`,
  `inS`, `kinds` con cuenta y `boss`, `count`, `boss`); helpers
  `defenseWaveStarts`, `defenseNextWave`.
- **Bots**: `buildingBot` construye sin volar y sube el daño del avión hasta
  `planeLevel` (3); `chasePlaneBot` sube el daño.
- **Equilibrio** (para que las pruebas de forma de T165 sigan en pie; T178
  rebalancea): `hpGrowthPerMinute` 0,25 → 0,35, Tormenta `enemyHp` 1,2 → 1,12.
- Web, sólo para compilar y no romper: sin anillo en `defense-view.ts`
  (`setBuilding` queda vacío), `DefenseRun.tap` sin acotar al anillo,
  `upgradePlane(stat)`, HUD del avión con el nivel de daño y su máximo, clave
  `mar.castillo.motivo.ring` quitada; ranking: vida máxima de cualquier nivel
  del castillo, lo salido cuenta con `wavesAheadS`, la RPC recibe la vida
  normalizada a la base; semilla de la migración del ranking (no aplicada) a
  `config_version` 4, como en plan 014; e2e del castillo: el trozo de camino
  «encima del camino» se elige donde el motivo es `path`.

Comandos:

- `pnpm exec vitest run packages/engine/src/defense --testTimeout=60000` → exit 0 (2 archivos, 63 pruebas)
- `pnpm test:slow packages/engine/src/defense` → exit 0 (1 archivo, 6 pruebas)
- Test command (vitest 201 archivos / 1913 pruebas, checks.sh OK, lint, build, typecheck) → exit 0

Pendiente:

- HUD (T171) y arena (T170): botones de velocidad, castillo, prioridad, ×2,
  «Llamar oleada», aviso; el sonido de `castleUpgrade`; dibujar el alcance.
- T178: equilibrio fino (el camino v2 y construir en cualquier sitio hacen
  fuerte al bot; aquí sólo se reajustaron crecimiento y Tormenta).

## 2026-10-06 — plan 015 T177: Line endings and slow test suites

Qué existe:
- `.gitattributes` (`* text=auto eol=lf`, binarios marcados) y renormalización en un commit aparte (solo finales de línea). `git ls-files --eol | grep -c "i/crlf"` → 0.
- Vitest: las simulaciones `packages/*/src/**/*-balance.test.ts` (survivors-balance 83 s, survivors-boss-balance 58 s, defense-balance 27 s en paralelo) salen de `vitest.config.ts` y corren con `pnpm test:slow` (`vitest.slow.config.ts`, testTimeout 120 s). Documentado en README.
- E2E (de-flake, sin borrar pruebas): `mar-castillo` (construir: reintento de confirmación esperando al estado, ya no tiempos fijos), `mar-3d`, `mar-puerto`, `mar-hud`, `landing-perf` (esperas por estado en lugar de `waitForTimeout`).

Comandos:
- Vitest por defecto antes: 86 s, 1911 tests, exit 0. Después: 34 s, 1885 tests, 199 archivos, exit 0.
- `pnpm test:slow` → 3 archivos, 26 tests, 75 s, exit 0 (1885 + 26 = 1911).
- Test command completo (vitest, checks.sh, lint, build, typecheck) → exit 0.
- `pnpm e2e mar-castillo mar-3d mar-puerto mar-hud landing-perf mar-paridad --workers=2` → 91 passed, 13 skipped, 2 failed (solo `mar-paridad` «al recargar», cambio de Codex, revertido).

Pendiente:
- `mar-canon` y `mar-paridad` no se tocaron (el cambio probado falló o no se probó); sus esperas fijas siguen.
- Sin pasada completa de e2e (~15 min).

## 2026-10-06 — plan 015 T174: Vecino quejica remodelled in Blender (Cañón and castle)

Qué existe:
- **`tools/blender/enemigos/vecino.py`**: el Vecino Quejica de cero en el pipeline de Blender, con el Builder de los mundos y las piezas de `islas/comun.py` (como las islas de T69/T166): una barcaza de obra naranja (línea de flotación oscura, cubierta con tablas, barandilla, norays, neumáticos en los costados, boya salvavidas en popa, la maceta del balcón) y encima el vecino de arriba: señor mayor y barrigón en batita azul con cinturón y solapas, pijama que asoma, gorro de dormir amarillo pálido con pompón (no rojo: parecía Papá Noel), zapatillas rosas, calvo con patillas y bigote canosos, cejas en pico, nariz grande, venita en la frente y la boca abierta de par en par (dientes y lengua); el periódico enrollado en el puño en alto y la otra mano en el asa del megáfono enorme de color crema con bandas rojas, abierto y oscuro por dentro, que apunta al frente (+X = rumbo 0). Unidades: 1 = el radio de choque (`RADIUS = 1`), como la geometría de a mano; 2,66 de largo, 2,18 de alto (el cartel del grito queda a 2,4 radios). `DETAIL` 0,6; paleta de arcilla más los papeles `vq_*`; sin emisivos.
- **`tools/blender/export_enemigos_glb.py`** (nuevo exportador, contrato como `export_islas_glb.py`: `ID, LABEL, DOC, RADIUS, DETAIL, ROLES, GLOW, build(B, K) -> {length, height}`; `MAX_TRIS` 9000), **`tools/blender/enemigo3d.schema.json`** y **`check_enemigos_3d`** en `tools/blender/check.py` (manifiesto válido, un módulo por GLB, `radius` = `RADIUS` del módulo, presupuesto, una sola malla, sin texturas ni transformaciones en los nodos). **`art/enemigos/3d/vecino.glb`**: 5 912 triángulos, 29 materiales, 131 kB; `art/enemigos/3d/manifest.json`.
- **`apps/web/app/mar/engine/enemy-models.ts`**: `flattenEnemyModel` aplana el glTF a **una sola geometría sin índices con el color en los vértices** (el color base de cada material, escalada por `1 / radius`), igual que las piezas del `Kit`: así la misma geometría va en la `Mesh` del Cañón y en la `InstancedMesh` del castillo con `litMaterial` (caras planas, curva del planeta) sin tocar materiales. `EnemyModel`: una carga compartida con recuento de usos (`acquire`/`release`), `state` (`procedural` → `cargando` → `glb` | `error`); si falla, null y aviso. Se sirve por `/api/art/enemigos/3d/vecino.glb` (ninguna ruta nueva).
- **Cableado**: `SurvivorsVecino` (`survivors-vecino.ts`) recibe el modelo, empieza con `vecinoGeometry()` y cambia la geometría de la barcaza cuando llega (vaivén, giro, escala, cartel y anillos siguen en la misma `Mesh`; el radio de choque y `bossesWhere` no cambian); `modelState` → `data-canon-vecino`. `DefenseView` (`defense-view.ts`) hace lo mismo con la pieza instanciada `defense-boss-vecino`; `vecinoState` → `data-arena-vecino`. `mar3d.ts`: un `EnemyModel` compartido por las dos vistas, destruido con el mar. Al soltar la última vista la geometría se descarga; las vistas nunca destruyen la geometría compartida.
- **Hoja de contacto** (fuera del repo): `tools/blender/contact_sheet_vecino.py` (frente, derecha, espalda, izquierda, desde arriba como el castillo, desde atrás y abajo como el Cañón, y la cara de cerca; `--views` para mirar un detalle; con `--capturas`/`--hoja` compone la hoja con las capturas del e2e).
- **Pruebas**: `enemy-models.test.ts` (aplanado: una geometría, colores por material incluidas las cajas con seis grupos, escala por `radius`; carga compartida, fallo, destruido antes de llegar; el manifiesto y el GLB existen con el archivo y el radio que usa /mar y miden como la barcaza de a mano), `survivors-vecino.test.ts` (bloque T174: a mano → GLB al llegar con la animación en marcha; fallo → a mano; vista destruida antes de llegar; `SurvivorsView` pasa el modelo), `defense-view-vecino.test.ts` (lo mismo en la arena y una sola carga entre dos vistas), e2e `mar-vecino.spec.ts` (Cañón con `t=145` y castillo con el primer boss: `data-canon-vecino`/`data-arena-vecino` = `glb`, el GLB a 200, el boss en pantalla; con `RECORD_T174=<carpeta>` deja las capturas).

Comandos:
- Reconstruir el GLB: `PYTHONUTF8=1 "C:/Program Files/Blender Foundation/Blender 4.0/blender.exe" -b -P tools/blender/export_enemigos_glb.py -- --only vecino` → `[glb] vecino.glb: 5912 triángulos, 29 materiales, 131 kB`; `python3 tools/blender/check.py` → exit 0 (`enemigos/3d: vecino: 5912/9000 triángulos, 29 materiales (0 emisivos), 131 kB`, manifiesto válido). Importado de nuevo en un Blender limpio: 1 malla, 5 912 triángulos, 29 materiales, sin imágenes ni transformaciones, caja x ±1,36 / alto 2,18.
- Hoja de contacto: `E2E_PORT=3974 RECORD_T174=C:/Users/alvar/AppData/Local/Temp/orchestrator-attach/boia-planet-hernan-T174/capturas pnpm e2e mar-vecino.spec.ts --workers=1` → 4 passed, exit 0; `"…/blender.exe" -b -P tools/blender/contact_sheet_vecino.py -- --out <vistas> --size 700 --capturas <capturas> --hoja C:/Users/alvar/AppData/Local/Temp/orchestrator-attach/boia-planet-hernan-T174/vecino-quejica-hoja.png` → **`C:/Users/alvar/AppData/Local/Temp/orchestrator-attach/boia-planet-hernan-T174/vecino-quejica-hoja.png`** (7 vistas + 4 capturas, fuera del repo).
- `pnpm exec vitest run apps/web/app/mar/engine/enemy-models.test.ts apps/web/app/mar/engine/survivors-vecino.test.ts apps/web/app/mar/engine/defense-view-vecino.test.ts` → 3 archivos, 21 pruebas, exit 0.
- Test command: `PYTHONUTF8=1 pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 204 archivos, 1926 pruebas · `sh tools/spec/checks.sh` → OK, exit 0 · `pnpm lint` → exit 0 · `pnpm build` → exit 0 (187,0 kB, 14 archivos, presupuesto 200 kB OK) · `pnpm typecheck` → exit 0.

Pendiente:
- En el castillo, con la cámara alta actual, el Vecino se ve pequeño como todo enemigo; el zoom de T170 lo acercará. Desde el frente (como lo ve el jugador cuando le persigue) manda la bocina abierta y el gorro; la cara se lee desde los tres cuartos, los lados y desde arriba.
- `baja`: una sola llamada de dibujo (geometría con color en los vértices, sin texturas); 5,9 k triángulos frente a los ~1 k de la barcaza de a mano, que sigue siendo la pieza mientras llega y si falla.
- Nombre, diseño y colores `muestra` hasta el visto bueno de Álvaro.

## 2026-10-06 — plan 014 T165: Close: balance, performance, full e2e, docs, Álvaro draft

Qué existe:
- **Equilibrio** (`packages/engine/src/defense/config.ts`, `DEFENSE_CONFIG_VERSION` 2 → 3): Benidorm más flojo (daño 98/160/245 → 70/115/175, alcance 650/700/760 → 560/600/650: era la mejor en todo Normal), monedero inicial 120 → 160 (en Tormenta el bot caía antes de 160 s sin dinero para islas), aguante +25 %/min (antes +20 %), Normal aguante ×1,15 (antes ×1: 7/10 min salían al 100 %), Tormenta aguante ×1,2, enemigos ×1,3, golpe ×1,3 (antes 1,5/1,4/1,4). La migración sin aplicar `20261006100300_castle_ranking.sql` siembra `config_version` 3 y los topes nuevos de Tormenta (6415 / 11184 / 21288), en paridad con `castleMaxKillPoints`.
- **Prueba de equilibrio** `packages/engine/src/defense/defense-balance.test.ts` (6 pruebas): Tranquila oro en todo; Normal se gana pero el castillo recibe golpes y alguna construcción de una isla cae o acaba ≤ 50 %; Tormenta no siempre se gana, nunca cae antes de 160 s y es más dura que Normal; ninguna construcción de una sola isla (+ Ibiza) iguala a la sencilla en todas las casillas; cada isla está en alguna de las mejores; Ibiza se paga en ≤ 2 min por nivel y la del bot lo cumple. `bots.ts` exporta `BUILDING_BOT_ORDER`/`BUILDING_BOT_REPEAT`.
- **Curvas del bot** (sencilla, 6 semillas; vida al final; caídas en s): Tranquila 5/7/10 → 6/6 oro, 100 %. Normal 5 → 6/6, 70–75 % (curva 100,100,100,72,72); 7 → 6/6, 50–75 % (100,100,100,75,75,50,50); 10 → 6/6, 69–97 % (100,100,94,94,69…). Tormenta 5 → 4/6, 26–57 %, caídas 217 s (100,100,88,56,56); 7 → 3/6, 6–36 %, caídas 236–240 s; 10 → 3/6, 29–36 %, caídas 248 s. Estrategias (semilla 7): Ibiza + una isla gana en Tranquila; en Normal cae o acaba tocada en 5/7 min y cae siempre en 10; en Tormenta sólo Halloween (5 y 7 min), Faro e Isla del Sonido (5 min) aguantan. Ibiza: 70 s a nivel 1.
- **Rendimiento en `baja`**: atajo nuevo `islas=lleno` (`devArenaSpots` en `apps/web/app/mar/castillo.ts`, `DefenseRun.devFullArena`): la arena llena de islas a nivel 3 (109), nunca rankea. e2e nuevo «arena: rendimiento en `baja` con la arena llena de islas a nivel 3, el Kraken saliendo del vórtice y el sonido»: p50 16,7 / p95 33,4 / peor 33,5 ms (CPU 4×: 33,3 / 33,4 / 50). El de siete islas en el pico de 10 min Tormenta: p95 33,4 ms (CPU 4×: peor 50). Sin puntos calientes: nada que arreglar.
- **e2e «construir…»** determinista: las monedas se leen justo antes de confirmar cada isla (no antes del vuelo, que con carga sumaba caídas de más de media isla).
- **Arreglos de la suite entera** (fallaban sin relación con el castillo, de tareas anteriores del plan): `mar3d.ts` llamaba `slot.add()` vacío en cada isla sin `keep` (T166) → «THREE.Object3D.add: object not an instance» en consola (las dos e2e del Cañón con `t=` que miran la consola); la fauna no se apagaba con movimiento reducido cambiado en caliente (el `change` de `matchMedia` del motor no llegaba): ahora se mira cada fotograma (`Wildlife.isReduced`); el «Tablón del faro» desplegado tapaba el botón del menú en el móvil (`mar.css`: `max-height` deja libre la columna); el rótulo ancho de Nochevieja en 375 px rozaba por 1 px la columna de mandos de la izquierda y se apagaba: `labels.ts` `placeClearOfHud` lo desliza un poco hacia el otro lado (≤ ¼ de su ancho, punta sobre su isla) antes de bajarlo; `PinLook.x` nuevo, prueba unitaria nueva.
- **Docs**: `docs/spec/estado.md` (párrafo «Alcance nuevo sin REQ todavía» para «Defensa del Castillo»; notas de REQ-MUN-026 y REQ-AVE-035 al día; REQ-AVE-036 ya retirado por T157); `docs/propuestas/2026-10-06-castillo-guia-prueba.md` (con «Notas» vacía) y `docs/propuestas/2026-10-06-castillo-decision-alvaro.md` (faro sin juego y tablón, «Vigilancia del faro» y su logro fuera, el juego nuevo y su REQ, nombres y textos, premio en el mundo o logros: opciones A/B/C).

Comandos:
- `pnpm exec vitest run packages/engine/src/defense --testTimeout=60000` → exit 0, 3 archivos, 56 pruebas
- `pnpm exec vitest run apps/web/app/mar/castillo apps/web/lib/mundo/ranking-castle` → exit 0
- `E2E_PORT=4972 pnpm e2e mar-castillo.spec.ts mar-tablon.spec.ts --workers=2` → 24 passed, 2 skipped (rendimiento sólo en móvil), exit 0
- `E2E_PORT=4973 pnpm e2e --workers=2` (primera) → exit 1: 483 passed, 9 failed, 92 skipped (Cañón consola, fauna, tablón/menú, rótulo de Nochevieja, Los Rápidos); arreglados los cuatro primeros; Los Rápidos, solo → passed
- `E2E_PORT=4978 pnpm e2e --workers=2` (segunda, con los arreglos) → exit 1: 490 passed, 2 failed, 92 skipped: WhatsApp en móvil (el barco paró a 80,3 u, tope 80) y la entrada con `?utm_source=` en escritorio (tiempos con carga); `pnpm e2e world-community.spec.ts:68 intro.spec.ts:259 --workers=1` → 4 passed, exit 0
- `pnpm e2e mar-rotulos world-community mar-tablon mar-hud --workers=2` → 30 passed; `mar-wildlife` → 6 passed; `mar-canon.spec.ts:325 :382` → 4 passed
- `PYTHONUTF8=1 python3 tools/spec/estado.py` → exit 0
- Test command: vitest → exit 0, 202 archivos, 1911 pruebas; `sh tools/spec/checks.sh` → OK; `pnpm lint` → exit 0; `pnpm build` → exit 0 (187,0 kB, presupuesto OK); `pnpm typecheck` → exit 0

Pendiente:
- La suite e2e entera no sale con exit 0 de una pasada en esta máquina (dos o tres pruebas de pilotaje o de tiempos caen con carga y pasan solas), como en T156.
- Respuesta de Álvaro al borrador (D-NN que retire REQ-AVE-036, REQ nuevo del castillo, premio/logros).
- Aplicar en Supabase las migraciones del faro retirado y del ranking del castillo (Hernán).

## 2026-10-06 — plan 014 T163: Castle ranking per run length × difficulty

Codex did the work (wrapper verified).

What exists:
- `apps/web/lib/mundo/ranking-castle.ts` (local: nine tables, 3 lengths × 3 difficulties, sample crew + own score), `ranking-castle-global.ts` (global via RPC), `ranking-global.ts` extended, with unit tests (table separation, score order, rejected submissions: shortcut, quit, impossible).
- Migration `supabase/migrations/20261006100300_castle_ranking.sql` (RPC with anti-cheat on impossible score/time), written and statically checked, NOT applied; not run against a real Postgres (none on this machine). `packages/db` rpc/types/checks updated.
- UI: `apps/web/app/mar/castillo-ranking.tsx` + model, shown in the pop-up ranking area and on the final card (best and position); i18n in `es-mar.ts`. Shortcut and «Terminar partida» games never submitted.

Commands:
- vitest (excluding packages/db, maxWorkers=2): 201 files, 1903 tests pass
- tools/spec/checks.sh: exit 0; pnpm lint: exit 0; pnpm typecheck: exit 0; pnpm build: exit 0
- E2E mar-castillo -g ranking --workers=1: 6 passed (mobile + desktop)

Pending: apply the migration to the real Supabase project and test it against Postgres (Hernán).

## 2026-10-06 — plan 014 T162: The castle's pre-game pop-up, final card and medals

Qué existe:
- **Panel de la isla del castillo**: ya no dice «Próximamente»; «Jugar» abre el pop-up (en plena carrera, el panel y el pop-up lo explican y no empieza: `mar.castillo.bloqueo.carrera`). Clave `mar.castillo.proximamente` fuera.
- **Pop-up** `apps/web/app/mar/castillo-previa.tsx` (+ `castillo-previa.css`, sobre las clases de `canon-previa.css`): el patrón del Cañón (T151). Duración 5 / 7 / 10 min (`CastleRunMinPicker`: grupo de opciones con flechas, cada piedra con la mejor medalla de ese par para la dificultad elegida), dificultad (`CanonDifficultyPicker` del Cañón, sin cambios), «Tu mejor medalla aquí», el hueco del ranking del par (vacío hasta T163; prop `ranking(runMin, difficulty)`), «Jugar · 5 min · Tranquila». Diálogo modal: foco en la duración marcada, Tab no sale, Esc / × / tocar fuera lo cierran y vuelve el panel de la isla. Lo elegido se recuerda durante la visita.
- **Medallas** `apps/web/lib/mundo/castle-medals.ts`: la mejor por duración × dificultad en los contadores del progreso (`castillo:<min>-<dificultad>:medalla` = 1 bronce, 2 plata, 3 oro), como la campaña del Cañón: local en este navegador y, con cuenta, en la copia que viaja con `save_snapshot` (la mezcla toma el mayor: la mejor nunca se pierde). `recordCastleMedal` sólo sube; `castleBestMedal` para el tablón. Una partida de atajo sólo guarda medalla donde los atajos dan premio (`devStartRewards`: `pnpm dev` y e2e), como el Cañón (T121).
- **Tarjeta final** (`castillo-hud.tsx` `CastleEnd`, modelo `castleEndView`): «¡Castillo a salvo!» / «El castillo ha caído» con su línea, la medalla (o «Sin medalla»), «5 min · Tranquila», tiempo, enemigos, vida del castillo, puntos; «¡Tu mejor medalla en …!» si mejora la del par; «Partida de prueba: fuera del ranking» si no rankea; «Volver al mar» y «Otra vez» (misma duración, dificultad y atajos). Foco en «Otra vez» (en «Volver al mar» con «Terminar partida»). `data-medalla`, `data-puntos`.
- **«Tablón del faro»**: la tarjeta Castillo enseña la mejor medalla de los nueve pares.
- **Atajos** (`castillo.ts`): `vencer=1` empieza a `DEV_WIN_LEAD_S` (3 s) del final, el castillo aguanta entero (oro); `oferta=1` abre el panel de la isla y guarda los demás atajos para la partida que se empiece desde el pop-up. `DefenseRun.devStart`: cualquier partida empezada por atajo (también sólo `duracion=` o `dificultad=`) va con `unranked` y su resultado sale `ranked:false`.
- `castillo-mode.tsx`: `prep`, `panel`, `medals`, `record`, `again()`; `useCastleMode` recibe `raceActive` y `onOffer`. `mar-client.tsx` lo cablea (panel, pop-up, sin control mientras está abierto).
- Con el sonido de T164 (merge de `main`): «Jugar» del pop-up y «Otra vez» arrancan el bucle de batalla (`startAudio`), el final suena y devuelve el mar (`endAudio` en `onEnd`, junto a la medalla); abrir el pop-up precarga el audio. `castillo-mode.tsx` y `mar-client.tsx` siguen en CRLF, como en `main`.

Comandos:
- `pnpm exec vitest run apps/web/app/mar/castillo.test.ts apps/web/app/mar/castillo-hud-model.test.ts apps/web/lib/mundo/castle-medals.test.ts apps/web/lib/mundo/board.test.ts` → exit 0 (nuevas: medalla por par y la mejor se queda, el tablón con la mejor de todas, `vencer=1` gana con oro sin ranking, atajo → `ranked:false` con la misma partida que sí rankea, `vencer`/`oferta` en el atajo, tarjeta con medalla/puntos/línea).
- `E2E_PORT=4962 pnpm e2e mar-castillo.spec.ts --workers=1 -g "pop-up|tarjeta|medalla"` → 6 passed, exit 0 (móvil y escritorio: pop-up con teclado y dedo, Esc, 5 min + Tranquila, `vencer=1` → tarjeta con oro y puntos, el pop-up y el tablón enseñan el oro; «Otra vez» con 10 min Tormenta).
- `E2E_PORT=4962 pnpm e2e mar-tablon.spec.ts mar-castillo.spec.ts --workers=1` → 21 passed, 1 skipped, exit 0.
- Tras el merge de `main` (T164): `E2E_PORT=4962 pnpm e2e mar-castillo.spec.ts --workers=1 -g "pop-up|tarjeta|medalla"` → 6 passed, exit 0 (la de «Otra vez» comprueba además `data-musica`: mar al acabar, batalla al repetir, mar otra vez). `mar-castillo.spec.ts mar-tablon.spec.ts` entero: 20 passed, 1 skipped, 1 failed («construir…» en escritorio: las monedas de las caídas durante vuelos lentos con la máquina cargada; sola → passed, 55 s; con el código de `main` también tarda 1,5 min).
- Test command (tras el merge): vitest → exit 0, 196 archivos, 1865 pruebas; antes del merge: 194 archivos, 1847 pruebas; `sh tools/spec/checks.sh` → OK; `pnpm lint` → exit 0; `pnpm build` → exit 0 (187,0 kB, presupuesto OK); `pnpm typecheck` → exit 0.

Pendiente:
- T163: llenar el hueco del ranking del pop-up (`CastlePrevia` prop `ranking`) y poner tu mejor/puesto en la tarjeta; `result.ranked` ya sale false con atajos y «Terminar partida».
- Premio en el mundo y logros del castillo: fuera del plan (decisión 13).

## 2026-10-06 — plan 014 T164: Sound for the castle

Codex did the work.

Qué existe:
- `apps/web/app/mar/castillo-audio.ts`: sonidos sintetizados del castillo (construir, mejorar, vender, ataque de cada isla con limite de ritmo por tipo, golpe al castillo, inicio de oleada, victoria, derrota) y cambio de bucle batalla -> jefe -> mar. No se abre nada antes del primer gesto.
- `castillo-audio-mode.ts`: enlace con el modo castillo (hooks pequenos en `castillo-mode.tsx` y `mar-client.tsx`).
- `canon-audio.ts`: pequena extension compartida, sin cambiar los sonidos del Canon. Helpers de prueba en `audio-test-helpers.ts`.
- Pruebas con AudioContext simulado: `castillo-audio.test.ts`, `castillo-audio-mode.test.ts`.

Comandos:
- vitest (sin packages/db): 195 ficheros, 1857 pruebas, todo pasa.
- tools/spec/checks.sh: OK. pnpm lint: 0. pnpm typecheck: 0. pnpm build: 0.

Pendiente: nada. Nota: mar-client.tsx y castillo-mode.tsx estan en CRLF en el repo; se conservaron en CRLF.

## 2026-10-06 — plan 014 T161: HUD and controls: Construir, placing, Mejorar/Vender, life, time, coins

Qué existe:
- `apps/web/app/mar/castillo-hud.tsx` (`CastleLayer`) + `castillo-hud.css`: el HUD de «Defensa del Castillo» con el estilo del del Cañón (reutiliza sus clases de contenedor, pausa, barra del boss, aviso y tarjeta). Arriba al centro: tiempo y pausa, vida del castillo (barra con marcas; ámbar rayada ≤ 50 %, roja a cuadros ≤ 25 %), oleada `n/total` y monedas; debajo, la barra del boss del Cañón (`BossBar`, ahora exportada) y, apilado, el aviso de boss (sale, cae, golpea la muralla). Abajo, encima de «Entradas», una sola franja que cambia: «Construir» + daño del avión → las siete islas con icono y precio (gris y precio tachado si no llega) → colocar (verde «Aquí se puede» o roja rayada con ✕ y el motivo de T159; Cancelar / «Construir aquí · coste») → ficha de una isla (nivel con puntos, qué hace, «Mejorar · coste» / «Nivel máximo», «Vender · +n»). Teclado: B construir, 1–7 isla, Intro colocar, I elegir la isla más cercana al avión (otra vez: la siguiente), U mejorar, V vender, Esc atrás o pausa; flechas = avión. `aria-live` (`mar-castillo-anuncio`): empieza la oleada, llega un boss, el resultado. En la arena se esconde el zoom (no hace nada ahí).
- `castillo-hud-model.ts` (sin React): `buildOptions`, `placementView` + `BUILD_REASON_KEYS`, `towerPanel`, `upgradeLine`/`sellLine`/`levelLine`, `planeView`/`planeLine`, `lifeLevelOf`, `waveAt` (del `defenseSchedule`), `castleView`, `defenseBossBar`/`defenseBossNotices`, `towerAt`, `nextTowerByKeyboard`, `clampToRing`, `castleEndView`. `castillo-icons.tsx`: siete iconos de isla y los del HUD (castillo, moneda, oleada, avión, construir), familia de T150.
- `castillo.ts` (`DefenseRun`): estado del HUD — `placing` (la isla va bajo el avión; un toque en el agua la mueve dentro del anillo), `placement()`, `confirmPlacing()`, `tap(x, y)` (colocando mueve la isla; si no, elige la isla tocada), `select`/`selectNext`, `upgradeSelected`, `sellSelected`, `upgradePlane`. Atajo nuevo `monedas=N` (suma al monedero; no rankea). Hook: `data-colocando`, `data-seleccion`, `data-avion-nivel`.
- `castillo-mode.tsx`: `run()`, `result`, `quit()` («Terminar partida»: la arena se queda con la tarjeta hasta «Volver al mar»); fuera el botón de desarrollo «Salir de la arena» y su clave i18n.
- Pausa: el menú de `/mar` con «Seguir jugando» y «Terminar partida» (confirmación de T148) y el bloque de sonido/volumen del Cañón (`GameSoundMenu`: `canon-readout-menu.tsx` separa el bloque de sonido sin cambio para el Cañón). Tarjeta `mar-castillo-final`: «Partida terminada» (sin medalla ni ranking), tiempo, enemigos, vida del castillo; al aguantar/caer, su título y lo mismo (T162 pone medalla, puntuación y «Otra vez»).
- Motor (`engine/defense-view.ts`, `mar3d.ts`): disco verde/rojo de la isla que se coloca (con el anillo), aro de la isla elegida; el toque en la arena va a `DefenseRun.tap`; lienzo: `data-arena-colocar`, `data-arena-elegida`, `data-arena-islas-pantalla` (px de cada isla, para tocarla), `data-arena-toque`.

Comandos:
- `pnpm exec vitest run apps/web/app/mar/castillo-hud-model.test.ts apps/web/app/mar/castillo.test.ts apps/web/app/mar/engine/defense-arena.test.ts` → 45 pruebas, exit 0 (nuevas: precios y gris, motivo de la vista previa, Mejorar/Vender, vida, tiempo, oleada, boss, elegir con dedo y teclado, construir/mejorar/vender por `DefenseRun`, camino rechazado, `monedas=`, tarjeta).
- `E2E_PORT=4917 pnpm e2e mar-castillo.spec.ts --workers=1 -g "construir|mejorar|vender|HUD"` → 8 passed, exit 0 (las siete islas, camino rechazado en rojo con «path», tocar una isla, subirla a 3, venderla, avión a nivel 2, pausa con volumen y «Partida terminada», nada se pisa y toques ≥ 44 px a 360×640, 390×844, 768×1024 y 1440×900 en reposo, construir, colocar y ficha con boss).
- `E2E_PORT=4917 pnpm e2e mar-castillo.spec.ts --workers=1 -g arena` (las de T160, que ahora salen por la pausa) → 5 passed, 1 skipped, exit 0.
- Test command: vitest → exit 0, 193 archivos, 1836 pruebas; `sh tools/spec/checks.sh` → OK; `pnpm lint` → exit 0; `pnpm build` → exit 0 (187,0 kB, presupuesto OK); `pnpm typecheck` → exit 0.

Pendiente:
- T162: «Jugar» en el panel del castillo, pop-up, medalla y puntuación en la tarjeta, «Otra vez».
- T164: sonidos de construir/mejorar/vender (eventos `towerBuilt`/`towerUpgrade`/`towerSold` ya salen de la partida).
- La partida sigue mientras se construye (no se pausa); las nubes pasan por encima de la arena (de T160).

## 2026-10-06 — plan 014 T166: Tabarca lighthouse island redesigned in Blender (the board at the entrance)

Qué existe:
- **`tools/blender/islas/faro.py`**: el Faro de Tabarca en el pipeline de islas de Blender (T69). Isla baja y llana de roca rojiza con la meseta de hierba seca, cantos en la orilla, matorral y pitas, un tramo de la muralla de Tabarca con su garita por detrás, el camino de losas, el muelle de tablas con la boia farera (catalejo al mar) y tres gaviotas. En medio, el faro de verdad: la casa de los fareros de dos plantas (piedra clara, esquinas, cornisas y marcos en ocre, ventanas de arco, puerta azul, farolillo), la torre cuadrada que estrecha hacia arriba con la cornisa a media altura, la galería con barandilla de hierro, la linterna de cristal (emisiva: brilla de noche, `tb_lamp`) y la cúpula de cobre viejo con remate dorado; ventanas encendidas de noche (`tb_window_lit`). `RADIUS` 7, `LANTERN_Z` 11,955 (literal comprobado por un `assert` contra las medidas), `DETAIL` 0,5, paleta de arcilla más los papeles `tb_*`. **`art/islas/3d/faro.glb`**: 12 218 triángulos (presupuesto 30 000), 26 materiales (3 emisivos), 250 kB; manifiesto con `height` 13,53 (más alto que ancho: el faro es el protagonista). Sin haz en el GLB: el haz lo pone /mar.
- **Cableado en /mar**: ninguna ruta nueva; la isla `faro` entra por el manifiesto como las demás (`island-models.ts`, `streamIslandModels`). `islands.ts`: la composición de a mano del faro sigue ahora la planta del modelo a escala (`FARO_LANTERN = {radius: 7, z: 11.955}`, la misma que el módulo de Blender) y devuelve el haz que gira en `keep`: lo animado que sigue con el modelo puesto; `mar3d.ts` cuelga `keep` del hueco del modelo (`modelSlot`) y no de la composición, así que el faro barre de noche también con el GLB. `IslandBuild.keep?` nuevo (opcional; las demás islas no lo usan).
- **Casco del faro** (`packages/world/src/worlds/arcilla/map.ts`): `LIGHTHOUSE_RADIUS` 2,3 u_maq, un solo círculo (antes elipse 1,9 × 1,3 a 30°): en /mar 137 u = 8,6 de escena, el modelo escala × 1,23 y la linterna queda a ~14,7 y la cúpula a ~16,6 de escena (el castillo medía 13 de radio y ~17–20 de alto en ese sitio). Los restos (216 u) y el náufrago (262 u) siguen fuera; la proximidad (2,8 → 209 u) queda por encima del casco y el tablón sigue sin abrirse desde el anillo de salida. Por decisión 8 del plan, el juego del castillo normaliza el Faro por este `radius` (T160).
- **`tools/blender/contact_sheet_faro.py`**: vistas del faro (frente, derecha, espalda, izquierda, frente de noche, desde el barco) y, con `--capturas` y `--hoja`, la hoja de contacto con las capturas del e2e.
- **Pruebas**: `island-models.test.ts` (bloque T166): el faro tiene su GLB, su `radius` es el `RADIUS` de `faro.py`, `FARO_LANTERN` cuadra con `RADIUS`/`LANTERN_Z` del módulo, a su escala en /mar el faro supera al castillo de antes (13) sin pasarse (× 1,6), el casco es un solo círculo y el haz (`keep`) queda en la linterna. `compact.test.ts` (ya existente): los lugares no se solapan ni nada ajeno cae dentro del faro con el casco nuevo. E2E `mar-faro-tabarca.spec.ts`: cerca del faro `data-islas-modelo` dice `faro:glb` con el GLB a 200; desde la salida el faro ya se pide; con `RECORD_T166=<carpeta>` deja las capturas de la hoja (cerca, rumbo y salida, móvil y escritorio).

Comandos:
- Reconstruir el GLB: `PYTHONUTF8=1 "C:/Program Files/Blender Foundation/Blender 4.0/blender.exe" -b -P tools/blender/export_islas_glb.py -- --only faro` → `[glb] faro.glb: 12218 triángulos, 26 materiales, 250 kB`; `python3 tools/blender/check.py` → exit 0 (`islas/3d: faro: 12218/30000 triángulos, 26 materiales (3 emisivos), 250 kB`, manifiesto válido).
- Hoja de contacto: `E2E_PORT=3961 RECORD_T166=C:/Users/alvar/AppData/Local/Temp/orchestrator-attach/boia-planet-hernan-T166/capturas pnpm e2e mar-faro-tabarca.spec.ts --workers=1` y `"…/blender.exe" -b -P tools/blender/contact_sheet_faro.py -- --out <vistas> --size 700 --capturas <capturas> --hoja C:/Users/alvar/AppData/Local/Temp/orchestrator-attach/boia-planet-hernan-T166/faro-tabarca-hoja.png` → **`C:/Users/alvar/AppData/Local/Temp/orchestrator-attach/boia-planet-hernan-T166/faro-tabarca-hoja.png`** (fuera del repo).
- `E2E_PORT=3961 pnpm e2e mar-faro-tabarca.spec.ts mar-isla-modelo.spec.ts mar-tablon.spec.ts --workers=1` → 12 passed, 2 skipped (capturas), exit 0; tras el merge de `main` (T160), con `mar-castillo.spec.ts` además → 17 passed, 5 skipped, exit 0.
- Test command (tras el merge): `PYTHONUTF8=1 pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 192 archivos, 1816 pruebas · `sh tools/spec/checks.sh` → OK, exit 0 · `pnpm lint` → exit 0 · `pnpm build` → exit 0 (187,0 kB, presupuesto OK) · `pnpm typecheck` → exit 0.

Integración con T160 (merge de `main`): `mar3d.ts` entero daba conflicto porque T160 lo dejó con finales CRLF; se tomó la versión de `main` (la arena: hundir y volver), se le aplicaron los tres puntos de `keep` y el archivo vuelve a LF (`git diff --ignore-cr-at-eol` contra `main`: sólo las seis líneas de `keep`). El haz del faro cuelga del grupo de la isla (`v.obj` de su vista), así que se hunde y vuelve con ella en la arena; las torres del castillo (`defense-islands.ts`) sólo usan las geometrías `lit`/`glow` y no ven `keep`.

Pendiente:
- T160: normalizar el Faro por su `radius` (7) en la arena; el haz de `keep` no aplica allí (las torres se construyen con `buildIsland`/GLB sin `keep`).
- El haz de a mano se ve con la composición y con el GLB; de día va casi apagado (opacidad 0,03 + 0,2 × noche), como antes.
- La muralla y la boia farera son `muestra`; nada de contenido real.

## 2026-10-06 — plan 014 T160: The 3D arena: sinking, higher camera, path buoys, enemies, islands and the plane

Qué existe:
- `apps/web/app/mar/engine/defense-arena.ts` (sin three.js): `arenaFrame` (la partida de `@boia/engine/defense`, castillo en (0,0), cae sobre la isla `castillo` de /mar girada para que el vórtice quede en `CASTLE_OPEN_SEA_BEARING`; sin tocar la config ni las reglas de la simulación), `vortexSpot`, `arenaCameraPose` (cámara alta, 1,2 rad, centrada en el castillo; en apaisado cabe la arena; en vertical toda la altura y 3/4 del ancho, el foco se corre hacia el avión lo justo), `ArenaSink` (hundir/volver en 1,2 s, de golpe con movimiento reducido) y `SinkOffsets` (cada pieza baja sin perder su altura), `barrierLines` (las dos barreras a medio carril, sin huecos ≤ 30 u, fuera del carril y del castillo), `cornerBuoys` (boyas de la carrera sólo en las esquinas vivas), `islandFootprint`/`islandScaleFor`/`islandLevelScale` (decisión 8: huella común, +10 % por nivel, nivel 3 = `islandRadius`; vale con el `radius` del manifiesto de Blender).
- `engine/defense-view.ts` (`DefenseView`): barreras (una malla fusionada por lado: listón a franjas naranja/blanco y flotadores; en `baja`, la mitad de flotadores), boyas de esquina (`buoy` con `ROAD_BUOY`), el vórtice (shader lila y negro que gira, halo suave; quieto con movimiento reducido; malla 12×12 en `baja`), enemigos y bosses del Cañón por el camino (`enemyModel`, `vecinoGeometry`, `hammerheadGeometry`, `ghostShipGeometry`, `krakenHeadGeometry`; salida del vórtice subiendo y creciendo 0,6 s), la nubecilla al caer (`PufFx`), el aro rojo del golpe al castillo (y un temblor corto), el anillo de construir alrededor del avión (`setBuilding`, para T161). `engine/defense-islands.ts` (`TowerIslands`: `buildIsland` medida una vez por tipo y guardada, escala uniforme, perlas de nivel). `engine/defense-fx.ts` (`DefenseFx`: haz del Faro, bolas de nieve, fuego en cono, cohete y estallido, monedas de Ibiza, onda de graves, trazo del francotirador, balas del avión; todo de `lastShot` de T159).
- `engine/mar3d.ts`: `startDefense(run)`/`stopDefense()`/`defenseActive`/`setDefenseBuilding`; paso de la partida con el mando de navegar girado al marco; el barco vuela a altura fija con las alas de «Entradas»; todo lo demás (vistas, piezas fusionadas, brillos, bajíos) se hunde y vuelve; la vuelta del planeta se hace alrededor del castillo en la arena (la arena de 1120 u es más ancha que medio planeta: así nunca se parte). Al salir, el barco vuelve al agua donde estaba al empezar. Para las pruebas en el lienzo: `data-arena`, `data-hundido`, `data-islas-vista`, `data-castillo-vista`, `data-vortice`, `data-arena-enemigos|tipos|fuera|islas|efectos|avion`.
- `app/mar/castillo.ts` (`DefenseRun`, atajo `?minijuego=castillo&duracion=&dificultad=&t=&seed=&islas=1`, `devTowerSpots`) y `castillo-mode.tsx` (`useCastleMode`: esconde las capas como el Cañón, `CastleTestHook` `data-testid="mar-castillo"`, botón de desarrollo «Salir de la arena» hasta el HUD de T161). `mar-client.tsx` lo cablea (capas escondidas de la partida en curso, sin rótulos en la arena, pausa con paneles). Clave i18n `mar.castillo.dev.salir`.

Comandos:
- `pnpm exec vitest run apps/web/app/mar/engine/defense-arena.test.ts apps/web/app/mar/castillo.test.ts` → 22 pruebas (vórtice en el principio del camino, hacia el mar abierto, a más de 980 u de la Boia 7 y fuera de los tramos 6 → 7 y 7 → 8, y se va al salir; hundir y volver; cámara; barreras; huella de las siete islas ±5 % por nivel, nivel 3 = 1,2 × nivel 1 = `islandRadius`; la vista con islas y efectos; atajo e islas de prueba).
- `E2E_PORT=4873 pnpm e2e mar-castillo.spec.ts --workers=1 -g "arena"` → exit 0, 5 passed, 1 skipped (rendimiento sólo en el teléfono).
- Rendimiento (`baja`, móvil 360×640, 10 min Tormenta `t=505`, siete islas a nivel 3, Kraken en el camino): sin limitar CPU p50 16,7 ms, p95 33,4 ms, peor 33,5 ms con 44 enemigos; CPU 4× p50 33,2, p95 33,4, peor 50 ms con 49 enemigos.
- Test command: vitest → exit 0, 192 archivos, 1813 pruebas; `sh tools/spec/checks.sh` → OK; `pnpm lint` → exit 0; `pnpm build` → exit 0 (187,0 kB, presupuesto OK); `pnpm typecheck` → exit 0.

Pendiente:
- T161: HUD, construir (vista previa con `buildCheck`, `setDefenseBuilding`), Mejorar/Vender, pausa con «Terminar partida» (quita el botón de desarrollo). T162: pop-up, «Jugar» en el panel del castillo, tarjeta final (al acabar la partida la arena se queda hasta salir).
- Las islas construidas usan la composición a mano (`buildIsland`), no el GLB de Blender (la regla de escala ya vale con el `radius` del manifiesto); las nubes pasan por encima de la arena.
- La posición del barco que se guarda cada poco puede ser la del avión durante la partida (al recargar, `freePoint` lo saca a agua libre).

## 2026-10-06 — plan 014 T157: Lighthouse ↔ castle swap, remove «Vigilancia del faro», the «Tablón del faro»

Qué existe:
- **El faro** (`faro`, Tabarca) está en el sitio del antiguo decorado del castillo, junto a la salida (`LIGHTHOUSE_CENTER`; en /mar, el anillo + `LIGHTHOUSE_OFFSET`). Sin `start_minigame`: lleva `content('info', BOARD_REF)` y al llegar abre el **«Tablón del faro»** (`app/mar/tablon.tsx`, modelo en `lib/mundo/board.ts`): tres tarjetas Cañón / Castillo / Carrera con su línea, la mejor medalla si la hay (Cañón: la mejor de sus tablas locales; Carrera: la del mejor tiempo; Castillo: ninguna hasta T162) y «Rumbo a…», que marca el destino como el «!» (`placeSpot`, tipo `place`, se desmarca al llegar). La ficha se abre ya desplegada; tres columnas en escritorio. Su proximidad baja de 3,4 a 2,8 u_maq (no se abre desde el anillo ni pisa la ficha de WhatsApp).
- **El castillo** ya no es decorado: es la isla `castillo` (`start_minigame` `castillo`) en `CASTLE_CENTER` ([-14,48; 14,21] u_maq → /mar (-1080, 1060)), radio 208 u (= 13 de escena = `DEFENSE_CONFIG.castle.radius`), a ~443 u de la Boia 7 y a más de su radio + la carretera (180) de los tramos 6 → 7 y 7 → 8. Se dibuja con `buildDecor('castillo')` y su GLB (`DecorModel`, `data-castillo-modelo`). Su panel es el de los minijuegos (`MinigameLayer`) con «Próximamente» y «Jugar» apagado hasta T162. `CASTLE_OPEN_SEA_BEARING` = 2,09 rad (~120°, sur-suroeste) en `engine/compact.ts`: dirección del vórtice para T160. El cofre fugaz 1 se apartó a [-10,6; 15,2] (caía dentro del castillo).
- **Vigilancia del faro, fuera**: borrados `faro.ts`, `testing.ts` y toda la capa 2D (`controller.ts`, `host.ts`, `skin.ts`, `sound.ts`, `styles.ts`; `pageAuthority` pasa a `session.ts`); el registro sólo tiene `canon`; `?minijuego=` ya no abre capa; `MINIGAMES` del Admin = `['canon']`; el faro no sale como isla de evento ni destino de misión en el Admin; claves `minigame.faro.*` fuera del catálogo y de `textos-zonas.md`. Logro «Vigía del faro» quitado; Guardacostas v3 = jugar una partida del Cañón. Migración local v8 → v9 (`SCHEMA_VERSION` 9) quita `achievements.faro` y `minijuego:faro`; la hidratación de una copia de Supabase los quita también; las vistas (Carnet, insignias) ignoran el logro retirado aunque su fila cobrada siga en el libro (puntos y monedas se quedan). Supabase: `20261006100000_faro_retired.sql` (escrita, sin aplicar). `docs/spec/estado.md`: REQ-AVE-036 retirado.

Comandos:
- `PYTHONUTF8=1 pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 190 archivos, 1791 pruebas (nuevas: `packages/store/src/faro-retired.test.ts`, `apps/web/lib/mundo/board.test.ts`, el bloque T157 de `apps/web/app/mar/engine/compact.test.ts`)
- `sh tools/spec/checks.sh` → OK (estado.md: retirado 2) · `pnpm lint` → exit 0 · `pnpm build` → exit 0 (187,0 kB, presupuesto OK) · `pnpm typecheck` → exit 0
- `E2E_PORT=3917 pnpm e2e mar-decor.spec.ts mar-puerto.spec.ts mar-tablon.spec.ts minijuegos.spec.ts --workers=1` → 21 passed, 2 skipped (captura nocturna), 1 failed en móvil (Enter con teclado); cambiado a toque en móvil y `pnpm e2e mar-tablon.spec.ts --workers=1` → 4 passed, exit 0
- `grep -rn "Vigilancia del faro\|minijuego=faro" apps packages` → sólo la migración v8 → v9, `retired-achievements.ts` y su prueba

Pendiente:
- T160: la arena (radio 1120) cruza el borde del planeta (ancho ~2700 u); el vórtice va a 980 u en `CASTLE_OPEN_SEA_BEARING`.
- T162: conectar el panel del castillo y su medalla en el tablón.
- T165 (borrador Álvaro): la decisión que retira REQ-AVE-036 aún no tiene número D-NN; Guardacostas v3 y que lo cobrado del logro del faro se quede en el libro.
- T166: el modelo del Faro de Tabarca en su sitio nuevo.

## 2026-10-06 — plan 014 T159: The seven islands: attacks, levels, building, upgrade and sell

Qué existe:
- `packages/engine/src/defense/config.ts`: bloque `towers` (`DefenseTowersDef`): `pathClearance` 10, `vortexClearance` 40, `sellRefund` 0,6, `bossStunScale` 0,25 y las siete islas (`kinds`, tipadas por tipo con `DefenseTowerStatsByKind`) con coste, `upgradeCost` [→2, →3] y tres niveles. Una sola huella para todas: `islandRadius` (70 u, la de nivel 3); ningún radio por tipo. `defenseTowerStats(cfg, kind, level)`. `DEFENSE_CONFIG_VERSION` 1 → 2 (reglas nuevas). Todo `muestra`.
- `build.ts`: la regla de construir. `defenseBuildCheck(world, kind, x, y)` → `{ok, cost}` o `{ok:false, reason, cost}` con `reason` ∈ `ended | ring | arena | path | vortex | castle | overlap | coins` (sitio antes que dinero; para la vista previa del HUD). `defenseSiteReason` (sólo el sitio), `defenseTowerUpgradeCost`, `defenseTowerSellValue` (floor(gastado × 0,6)). Sin tope de islas.
- `towers.ts`: `DEFENSE_TOWER_HOOKS` con las siete (decisión 9): Faro haces que giran (1/2/3 haces, daño por segundo de contacto); Nochevieja bola de nieve al más adelantado, distinto del último si hay otro, aturde (a bosses × 0,25); Halloween bocanada en cono hacia el más adelantado, deja ardiendo; Puerto mortero: cohete al sitio donde estará el blanco a los `flightS`, estallido en `blastRadius`; Ibiza granja (monedas cada 10 s); Isla del Sonido onda a todo en su radio cada 1,2 s; Benidorm francotirador al más fuerte a su alcance (boss > miniboss > común, luego más aguante; `strongestEnemy`). `TowerShotView` documentado por tipo, con `flightS` y `amount` nuevos. El contexto de la torre lleva `config` y `burnEnemy`; `DefenseEnemyView` lleva `burnS`/`burnDps`.
- `geometry.ts`: `beamTouches`, `coneTouches`, `angleDiff`, `wrapAngle` (las mismas pruebas que el haz y el cono del Cañón, sin el mar que se repite; las del Cañón son privadas de su `sim.ts` y van con `wrapDelta`, no se han tocado).
- `sim.ts`: `buildCheck`, `build` (cobra), `upgradeTower` (hasta 3), `sellTower` (devuelve parte), `towerUpgradeCost`, `towerSellValue`; entradas `build`, `upgradeTower`, `sellTower` en `DefenseInput`; quemadura por paso (también aturdido; la caída es de la torre que lo prendió); sucesos `towerBuilt`, `towerUpgrade`, `towerSold`, `towerShot` (cuando cambia `lastShot`; el haz del Faro se pone al día en el mismo objeto y no avisa cada paso); `stateHash` cuenta las torres.
- `bots.ts`: `buildingBot(cfg)`: puntúa una rejilla de sitios por camino cercano, construye las siete en orden (la granja en el peor sitio), compra el avión desde la 3.ª isla y luego alterna subir la isla más baja con construir otra.
- Bot (semilla 7), para T165: Tranquila 5/7/10 min aguanta, oro, 100 % (10/16/25 islas); Normal 5 min aguanta con 75 % (oro; le llega un miniboss), 7 y 10 min 100 % (18/31 islas); Tormenta cae a 129/138/158 s con 3–4 islas (el dinero del principio no llega: el salto Normal → Tormenta es grande).

Comandos:
- `pnpm exec vitest run packages/engine/src/defense --testTimeout=60000` → exit 0, 2 ficheros, 50 pruebas (17 nuevas en `towers.test.ts`: barrido del haz, aturdir y cambiar de blanco, quemadura en la partida, radio del estallido, granja, onda, francotirador, regla de construir con cada motivo, sin tope, construir/mejorar/vender, `towerShot`, bot en Tranquila y Normal).
- Test command: vitest → 1794 passed, 6 «Test timed out» en suites del Cañón no tocadas (máquina cargada); repetidas `pnpm exec vitest run <los 5 ficheros de survivors> --testTimeout=30000 --maxWorkers=2` → exit 0, 92 pruebas. `sh tools/spec/checks.sh` → OK; `pnpm lint` → exit 0; `pnpm build` → exit 0; `pnpm typecheck` → exit 0.

Pendiente:
- T165: equilibrar (Tormenta cae pronto incluso construyendo; Normal 7/10 min salen al 100 %).
- T160/T161: pintar `lastShot` de cada isla, la vista previa con `buildCheck(...).reason` y Mejorar/Vender con `towerUpgradeCost`/`towerSellValue`.

## 2026-10-06 — plan 013 T156: Close: balance, baja performance, full e2e, docs, Álvaro draft, remove BETA

### Qué existe

- **Sin «BETA»**: fuera la etiqueta del HUD (`BetaTag` en `canon-hud.tsx`), del pop-up previo (`canon-previa.tsx`), del panel de la isla (`badge` de `canon-mode.tsx` y el soporte de `badge` en `lib/mundo/minigame-layer.tsx`, que sólo usaba el Cañón), su CSS y las claves `mar.canon.beta*`. Las e2e comprueban que ya no están (`toHaveCount(0)`). Los atajos de desarrollo siguen (decisión 8).
- **Equilibrio, config v16** (`SURVIVORS_CONFIG_VERSION` 15 → 16): nuevo `DifficultyDef.bossHp` (multiplica sólo el aguante de los bosses, en `bossHpFor`); Tormenta 1,25. Medido con el piloto `greedy`, 12 semillas por acto y dificultad (victorias = oro; entre paréntesis, v15):
  - Acto 1 (Barco Fantasma): Tranquila 11/12 (11), Normal 11/12 (11), Tormenta 4/12 (8). Combate medio 32 / 43 / 68 s.
  - Acto 2 (Kraken): Tranquila 10/12 (10), Normal 6/12 (6), Tormenta 2/12 (3). Combate medio 54 / 59 / 64 s; en Tormenta le queda un 77 % de vida de media.
  - Minibosses: 12/12 en Tranquila y Normal en los dos actos (Vecino del acto 2 en Tranquila, 11/12).
  - Descartado: Fantasma 2600 → 3000 (Tranquila acto 1 bajaba a 10/12, 4/6 en las semillas de la prueba, y Normal no cambiaba).
- **Rendimiento en `baja`**: las dos e2e de boss final (T147) ahora también equipan el minikraken (`equipMascot`, por Mi Barco tras `?mascota=1`) y encienden el sonido (tecla → `data-sonido=activo`, `data-musica=jefe`). En 360×640 con el mar lleno (60/60), siete armas: p95 33,4 ms sin limitar la CPU con el Fantasma y con el Kraken; con la CPU 4×, 33,4 y 50 ms. Sin puntos calientes que arreglar.
- **Finales de línea**: 49 archivos de `main` con CRLF pasados a LF (código, e2e, docs, manifiestos de arte, scripts de Blender). Quedan con CRLF, a propósito, `apps/web/lib/barco/*`, `ship-model.ts` y `tienda.spec.ts` (los toca en paralelo una tarea del plan 014), `plans/` y las skills de Blender de `.claude/skills/`.
- **Docs**: `docs/propuestas/2026-10-05-canon-definitiva-guia-prueba.md` (guía en español, con equilibrio, rendimiento, la revisión de accesibilidad de REQ-AVE-039 y «Notas» vacía); `docs/propuestas/2026-10-05-canon-decision-alvaro.md` (borrador para Álvaro: qué es el Cañón; nombres, textos, premios, logros, mascota, ranking, música, cambios de REQ-AVE-037/038/039, atajos); hoja de ruta del diseño de referencia (dos actos, acto 3 más adelante); `docs/spec/estado.md`: notas de REQ-AVE-037 (versión definitiva, sin BETA) y REQ-AVE-039 (revisión escrita; sigue PARCIAL por el Faro 2D). REQ-AVE-038 ya decía `won` = bronce o más.
- **E2E inestables**: los de la lista del plan 012 (amanecer en t=419, HUD, turbo móvil, Tiburón Martillo, panel/pop-up de dificultad, tiburón en móvil) ya estaban endurecidos en T147 y pasaron en las cuatro pasadas completas. Endurecidos ahora: la rampa (T146; el salto se apunta al verlo, al volver a leer ya había caído), «al acabar vuelve el mundo» (navega hasta moverse 40 u contestando cartas; a t=416 una carta paraba el barco) y el puerto en plena partida (`mar-puerto.spec.ts`: contesta las cartas por el camino y acepta `running|card`).
- Fusionado `main` (plan 014 T158/T159 y su reversión): conflictos sólo de finales de línea en `mar3d.ts`, `mar-client.tsx` y `es-lib.ts` (versión de main, pasada a LF).

### Comandos y resultados

- `pnpm exec vitest run packages/engine/src/survivors --testTimeout=60000` → exit 0, 16 archivos, 235 pruebas (corrido solo; con la e2e a la vez, las partidas enteras pasaban de su tiempo).
- `PYTHONUTF8=1 python3 tools/spec/estado.py` → exit 0.
- `grep -rn "BETA" apps/web/app/mar apps/web/lib/i18n` → sin resultados.
- Test command, paso a paso: vitest → exit 0 (184 archivos, 1744 pruebas); `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0 (187,0 de 200 kB); `pnpm typecheck` → exit 0.
- `E2E_PORT=3161 pnpm e2e mar-canon.spec.ts --workers=1 -g "rendimiento|BETA|panel de su isla|pop-up previo: se abre|boss HUD"` → exit 0, 13 passed, 3 skipped.
- Primera `E2E_PORT=3161 pnpm e2e --workers=2` (antes del equilibrio v16) → 454 passed, 12 failed, 88 skipped: once en escritorio mientras corría a la vez la suite de `survivors`, más los chips de aviso en móvil. `--last-failed --workers=1` → 11 passed, 1 failed (Los Rápidos en escritorio, «sin carrera»), que pasa solo (2 passed).
- Tras fusionar main: vitest → exit 0 (187 archivos, 1783 pruebas); checks, lint, typecheck, `estado.py` → exit 0; build → exit 0 (187,0 de 200 kB).
- Segunda y tercera `pnpm e2e --workers=2` → exit 1: 457 passed / 9 failed y 464 / 2; todas las caídas, al repetirlas solas → passed (9 passed; 2 passed más la del puerto arreglada).
- Cuarta `E2E_PORT=3161 pnpm e2e --workers=2` (tras fusionar main) → **exit 1**: 463 passed, 3 failed, 88 skipped (rampa y «al acabar vuelve el mundo», arregladas; Los Rápidos en escritorio). `pnpm e2e mar-canon.spec.ts mar-circuito.spec.ts --workers=1 --repeat-each=2 -g "una rampa durante el Cañón|al acabar vuelve el mundo|Los Rápidos: pregunta"` → exit 0, 12 passed.
- **Los Rápidos** (`mar-circuito.spec.ts` «Los Rápidos: pregunta en la salida…», escritorio) cae en 3 de 4 pasadas completas bajo carga (sin medalla por lento, o «sin carrera» en el mismo tramo) y pasa sola: el piloto de la prueba no es del Cañón ni de la lista; queda como propuesta.

### Pendiente

- Hernán prueba la versión definitiva con la guía y apunta en «Notas»; Álvaro, el borrador (nombres, textos, premios, logros, mascota, ranking, música, REQ).
- Normal del acto 1 se gana casi siempre con el piloto (11/12; combate de 43 s): si jugando se hace fácil, el mando es `bosses.fantasma.hp`, mirando Tranquila.
- REQ-AVE-037 sigue PARCIAL hasta que Álvaro cambie sus criterios; REQ-AVE-039, PARCIAL por el Faro 2D.
- La suite e2e entera no salió con exit 0 de una sola pasada en esta máquina (cargada con otros dos agentes): endurecer el piloto de Los Rápidos.
- Quedan con CRLF `apps/web/lib/barco/*`, `ship-model.ts`, `tienda.spec.ts` y `ESTADO.md` (zona del plan 014 / archivo del orquestador).

## 2026-10-06 — plan 014 T167: Remove the boat flag option

Done by Codex (wrapper verified). The Bandera section, FLAG_LOOKS, flag catalog entries, equipped-flag drawing and i18n keys are removed; saved documents with owned/equipped flags load without them; ship-model.test.ts covers the boat model without a flag.

- grep for barco.shop.bandera|sinBandera|FLAG_LOOKS in apps packages: nothing left
- pnpm e2e tienda.spec.ts --workers=1: 4 passed
- spec checks, lint, typecheck, build: pass
- vitest (excl. db): 1748 pass; 2-3 survivors sim/balance tests time out under machine load (different ones each run); survivors.test.ts passes alone 37/37; those files are untouched.

Pending: none.

## 2026-10-05 — plan 014 T158: Tower defense simulation: path, waves, castle, plane, coins, medals, score

Qué existe:
- `packages/engine/src/defense/` (import `@boia/engine/defense`, subpath nuevo en `packages/engine/package.json`): simulación sin DOM y determinista de «Defensa del Castillo» (`muestra`), paso fijo `DEFENSE_STEP_S` (= el del Cañón), `DEFENSE_CONFIG` + `DEFENSE_CONFIG_VERSION` (1) + `defenseConfigHash`.
  - `config.ts`: castillo (radio 208 u = 13 de escena, vida 100), arena 1120 u, `vortexRadius` 90, `islandRadius` 70 (huella común de las islas a nivel 3, ≈ 1/3 del diámetro del castillo; T159 la reutiliza), camino, avión, enemigos y bosses del Cañón (ids importados; radio de `SURVIVORS_CONFIG` vía `defenseEnemyRadius`) con `pace`/vida/daño al castillo/monedas/puntos propios, dificultades, oleadas, duraciones 5/7/10 con sus bosses, bono de vida. Tipos de torre `DEFENSE_TOWER_KINDS` (faro, ultima, halloween, cala, tienda, allday, fotos).
  - `path.ts`: `buildDefensePath` — espiral de 1¼ vueltas (980 → 430 u) con eses en la vuelta de fuera y zigzag de dientes hacia el castillo dentro, recta final a la muralla; `sampleAt(d)` por longitud de arco (posición, rumbo, normal), `distanceTo(x,y)` (para la regla de construir), `start` (el vórtice: donde la vista lo pone), `end`, `corners` (esquinas vivas para las boyas de acento), `turnOf`. Largo ≈ 6400 u; hueco mínimo entre vueltas 437 u (pide 90 + 4·70 = 370).
  - `waves.ts`: `defenseSchedule(cfg, runMin, difficulty)` — sin azar (todos los de una tabla ven lo mismo): oleada cada 15 s, mezcla por turno ponderado, bosses a su fracción (el gordo ≥ 70 %).
  - `sim.ts`: `DefenseGame`/`createDefense` — enemigos por distancia en su carril, llegada = daño al castillo y desaparece; avión libre en el disco (`input.move`), disparo automático al más cercano a su alcance con anticipación, daño nivel 1–3 (`upgradePlane`, `input.upgradePlane`); monedas por caída directas al monedero; fin `held`/`fallen`/`abandoned`/`quit`; pausa y `elapsePause` como el Cañón; `startAtS`/`unranked` = atajo (no rankea); `snapshot()`, `result()` (medalla, puntos, `ranked`, duración, dificultad, caídas por tipo, bosses…), `stateHash()`, eventos para sonido/vista. Para T159: `addTower`/`removeTower`/`spend`/`refund`, `enemiesInRange`.
  - `towers.ts`: el enganche `DefenseTowerHooks` (`targets`, `onTick`) con `DefenseTowerContext` (enemigos, camino, rng, `damageEnemy`, `stunEnemy`, `addCoins`); `DEFENSE_TOWER_HOOKS` vacío hasta T159; la partida corre con cero torres.
  - `medals.ts`: `defenseMedal` (oro > 50 %, plata ≤ 50 %, bronce si cae pasada la mitad) y `defenseScore` (puntos por caída + bono de vida si aguanta). `clock.ts`: `DefenseClock`. `bots.ts`: `idlePlaneBot`, `chasePlaneBot`.
- Avión solo (sin torres), semilla 7: Normal y Tormenta caen en 5/7/10 min (perseguidor a nivel 3 cae a ~230–250 s en Normal); Tranquila 5 min el perseguidor aguanta con 24 % de vida. Números para T159/T165.

Comandos:
- `pnpm exec vitest run packages/engine/src/defense --testTimeout=60000` → exit 0, 33 tests.
- `pnpm exec vitest run packages/engine/src/defense packages/engine/src/survivors --testTimeout=60000` → con la máquina cargada (otros agentes corriendo vitest y e2e) 3 pruebas lentas del Cañón (no tocadas) se pasaron de tiempo; repetidas: `pnpm exec vitest run <los 7 ficheros que se pasaron de tiempo en el run completo> packages/engine/src/survivors packages/engine/src/defense --testTimeout=30000 --maxWorkers=2` → exit 0, 24 ficheros, 328 tests.
- Test command: vitest → exit 1 sólo por 24 «Test timed out» bajo carga (ninguna aserción falla; 1753 passed), repetidos arriba → exit 0; `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0; `pnpm typecheck` → exit 0.

Pendiente:
- T159: torres, regla de construir (usar `path.distanceTo`, `path.start` + `vortexRadius`, `islandRadius`, `plane.buildRing`), costes; T160: girar el camino con `path.startAngleRad` hacia mar abierto cuando T157 fije el sitio del castillo (sube la huella de config).

## 2026-10-05 — plan 013 T155: Per-boss ranking, local and global

### Qué existe

- **Puntuación de partida** (`apps/web/lib/mundo/ranking-canon.ts`, `muestra`): enemigos × 10 + notas × 5 + medalla (bronce 2 000, plata 4 000, oro 8 000) + rapidez (100 por segundo que faltaba para el amanecer al vencer al boss final), × dificultad (Tranquila 0,75, Normal 1, Tormenta 1,5). Una tabla por boss final (`fantasma` acto 1, `kraken` acto 2) y versión de la fórmula `CANON_RANKING_VERSION` 1 (no cambia con `SURVIVORS_CONFIG_VERSION`).
- **Antitrampas** (`canonRankRejection`, igual en la base): nunca «Terminar partida» ni partidas de atajo; la sesión debe validarla; 30 s mínimo, 7:01 máximo; oro no antes de la entrada del boss final (5:30), bronce/plata no antes del amanecer; tope 170 000 puntos.
- **Modo local**: tu mejor por boss en `localStorage` `boia.canon.ranking.v1` (try/catch) entre la tripulación de muestra (`SAMPLE_CANON_SCORES`). **Con Supabase**: un miembro manda la partida al acabar (`submit_canon_score`, directo, no por la cola) y lee su puesto (`ranking_canon`); un invitado se queda con su mejor del navegador.
- **Pop-up previo** (hueco de T151): `CanonBossRanking` enseña la tabla del boss del acto elegido (local: muestra + «Tú»; global: los 5 primeros + tu fila; vacío o cargando con su texto).
- **Tarjeta final**: «Puntos» como cuarta cifra y una línea con el puesto y «¡Tu mejor!» / «Tu mejor: N», o por qué no entra. Compactada la tarjeta en pantallas bajas (iconos del equipo 1,1 rem, márgenes) para no pisar «Entradas» en 360×640.
- **Ayudante de pruebas** `&ranking=1`: una partida de atajo entra en el ranking local sólo donde los atajos dan premio (`pnpm dev`, e2e); nunca en el global ni en la versión de prueba.
- **Supabase** `supabase/migrations/20261005100200_canon_ranking.sql` (escrita, **sin aplicar**): `canon_boards` (sembradas las dos tablas), `canon_scores`, RLS de sólo lectura, `submit_canon_score` (miembros) y `ranking_canon` (cualquiera). `database.types.ts` a mano, `RPC_REJECTIONS` (+5), `CLIENT_READ_ONLY_TABLES`, caso `canon-ranking.supabase.ts` (necesita la base de desarrollo).
- `docs/spec/estado.md`: REQ-AVE-037 (sigue PARCIAL) con la nota y las pruebas del ranking.

### Comandos y resultados

- `pnpm exec vitest run apps/web/lib/mundo/ranking-canon.test.ts apps/web/lib/mundo/ranking-canon-global.test.ts apps/web/lib/mundo/ranking-canon-sql.test.ts apps/web/app/mar/canon-ranking-model.test.ts` → exit 0 (fórmula, separación por boss, rechazos: atajo, «Terminar partida», tiempos imposibles, puntuación de más; SQL igual al navegador).
- `E2E_PORT=3569 pnpm e2e mar-canon.spec.ts --workers=1 -g "ranking"` → exit 0, 6 passed.
- `E2E_PORT=3568 pnpm e2e mar-canon.spec.ts --workers=1 -g "pantalla final con tiempo|campaña en el pop-up|ranking|premio del bronce|Terminar partida"` → exit 0, 14 passed.
- Test command: vitest → exit 0 (181 archivos, 1731 pruebas); `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0 (187,0 de 200 kB); `pnpm typecheck` → exit 0.
- Tras fusionar main (T154; conflicto en `docs/spec/estado.md`: la versión de main más la nota y las pruebas de T155 en REQ-AVE-037): vitest → exit 0 (184 archivos, 1744 pruebas); checks.sh, lint, build (186,9 de 200 kB) y typecheck → exit 0; `E2E_PORT=3571 pnpm e2e mar-canon.spec.ts --workers=1 -g "ranking"` → exit 0, 6 passed.

### Pendiente

- Aplicar la migración en Supabase (Hernán) y correr `canon-ranking.supabase.ts` contra la base de desarrollo.
- Sin cola: un miembro sin red no manda la partida (se queda su mejor en el navegador); no pasa a la cuenta al entrar.
- Las tablas del Cañón no salen en el panel «Ranking» del menú del mundo, sólo en el pop-up.
- Puntos, topes y tripulación de muestra `muestra` hasta Álvaro.

## 2026-10-05 — plan 013 T154: Minikraken mascot

Qué existe:
- **Categoría «Mascota» en Mi Barco** (`lib/barco/shop.tsx`, `shop-model.ts` `rows.mascots`): «Sin mascota» (desactivar) y una fila por mascota con su dibujo SVG (`lib/barco/mascot-icon.tsx`), bloqueada con «Se gana con el logro «Rompetentáculos»» hasta reclamar `canon-kraken`; una línea dice que va en cubierta y no ayuda a jugar. Lista genérica (`ListSlot`), lista para más mascotas: cosmético `mascot` + fila en `MASCOT_KINDS` (`lib/barco/dressing.ts`) + modelo.
- **Minikraken en cubierta** (`app/mar/engine/minikraken.ts`): low-poly de barro pintado (cúpula morada con franja naranja BOIA, ojos grandes, seis tentáculos), 3 mallas con un material; flota, se mece y **saluda con un tentáculo cerca de una isla/lugar** (a < 45 u, mirado dos veces por segundo). En `baja`: menos caras y sin mecer el faldón; con movimiento reducido, quieto. Va en `boat.body` (`mar3d.ts` `placeMascot`), así que sale navegando, en las carreras y en el Cañón; con un barco de Blender se pone hacia popa sobre lo más alto que haya ahí (`surfaceY` en `ship-model.ts`: cubierta o toldo), mirando a popa. El lienzo lo cuenta en `data-mascota`; `main.mar` en `data-ship-mascot`.
- **Atajo `/mar?mascota=1`** (`app/mar/mascota-dev.ts`): completa y reclama el logro que da la mascota; sólo con `devStartRewards` (pnpm dev, e2e), nunca en la versión de prueba (ni con `?dev=1`).
- **Supabase**: `supabase/migrations/20261005100100_mascot_equip.sql` (escrita, NO aplicada): `equipped_cosmetics.slot` y `private.equip_cosmetic` aceptan `mascot`. `EquippedMap` (`packages/db/src/rpc.ts`) y `SLOTS` de `lib/account/merge.ts` (ahora `COSMETIC_SLOTS`) con `mascot`: lo equipado pasa a la cuenta.
- El documento local no cambia de versión: `equipped` ya era un registro libre y T153 añadió la ranura.

Comandos:
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → 180 archivos, 1717 pruebas, 0 fallos (nuevas: `packages/store/src/mascot.test.ts`, `apps/web/app/mar/engine/minikraken.test.ts`, `apps/web/app/mar/mascota-dev.test.ts`, casos en `merge.test.ts`, `shop-model.test.ts`, `catalog.test.ts`)
- `sh tools/spec/checks.sh` → OK; `pnpm lint` → 0 avisos; `pnpm build` → OK (landing 187,0 de 200 kB, sin cambio); `pnpm typecheck` → OK
- `E2E_PORT=3291 pnpm e2e tienda.spec.ts --workers=1 -g "mascota"` → 2 passed (móvil y escritorio)

Pendiente:
- Revisión de arte del minikraken (forma, colores, tamaño, sitio en cada barco) por Hernán/Álvaro; `muestra`.
- «Se esconde en los apagones» (§9 del diseño) no aplica: sin acto 3.
- `economy.supabase.ts` no tiene un caso de equipar la mascota contra Postgres (esta máquina no tiene Postgres); la migración se prueba leyendo el SQL.

## 2026-10-05 — plan 013 T153: Per-medal daily prize and the new achievements

### Qué existe

- **Premio por medalla, una vez al día cada una** (§9 del diseño, `muestra`): bronce 30 ★ + 10 🪙, plata 60 + 20, oro 100 + 40 (`CANON_MEDAL_PRIZES`). Origen `minigame:canon:<medalla>` con política `daily` (en el libro, `world_reward:minigame:canon:oro@2026-10-05`); una medalla cobra también las de debajo que no tuvieras ese día (un oro de primeras, 190 + 70). Sustituye al premio de la beta (150 + 50 por temporada); lo ya cobrado sigue en el libro. Sin premio por acto (el diseño no lo pide).
- Motor (`packages/engine/src/minigames`, sin tocar equilibrio): `RewardRule.tiers` (escalones con `minMs` y `reasons`), `MinigameResult.tier`/`WorldGameEnd.tier`, `grantMinigameReward` cobra por escalones; `canonReward(cfg, act)`, `canonEnd(..., medal)`; `CANON_VERSION` 4 → 5. Antitrampas: el oro antes de que entre el boss final del acto (5:30) no vale (validación de la sesión y, además, el `minMs` del escalón); bronce y plata antes del amanecer, o una medalla que no casa con cómo acabó, no cobran. Partidas con atajo de desarrollo (donde el build no lo permite: producción, también con `?dev=1`) y las de «Terminar partida» no pagan ni dan logros.
- Web: `canon-settle.ts` liquida con la medalla y `canonSignals` da las señales de una partida que vale (jugada, ganada, bosses vencidos con dificultad); `canon-mode.tsx` las manda en orden (`emitSignals`) y ya no usa `withWinSignal` para el Cañón.
- **Logros** (catálogo `packages/store/src/sample/progress.ts`, `muestra`): `canon-zarpa` «Zafarrancho» (jugar, 20 + 10), `canon` ahora «Hasta que amanezca» (mismo id, 60 + 30), `canon-fantasma` «Exorcista» (80 ★ + bandera fantasma), `canon-kraken` «Rompetentáculos» (120 ★ + mascota `mascota-minikraken`), `canon-tormenta` «Ojo del huracán» (oculto, Kraken en Tormenta, 150 + 50); sin `canon-capitan`. Guardacostas v2: ganar el Faro y jugar el Cañón (en cualquier orden). Disparadores nuevos `play_minigame` y `defeat_boss` (huellas `partida:<juego>`, `jefe:<boss>` y `jefe:<boss>:<dificultad>`); jugar vuelve a mirar los logros de `win_minigame`. Admin: etiquetas y parámetros de los disparadores nuevos y `played`.
- **Mascota para T154**: ranura `mascot` en `COSMETIC_SLOTS` y el cosmético `mascota-minikraken` (`MINIKRAKEN`) en el catálogo; reclamar `canon-kraken` deja su fila `cosmetic` en el libro (probado). Bandera fantasma (`bandera-fantasma`) con su aspecto en `dressing.ts`.
- **Documento local v7 → v8**: quien en la beta ganó el Cañón gana la huella de jugado, y quien venció al boss final de un acto (contador de la campaña) la del boss; saldos, premios, logros y lo ganado no cambian. `reconcileAchievementEvidence` completa los logros nuevos con esas huellas.
- **Supabase** `supabase/migrations/20261005100000_canon_launch.sql` (escrita y probada en estático, **sin aplicar**): el enum `achievement_trigger` gana las 7 de T36 y `play_minigame`, `defeat_boss` (contracts: todas en `ACHIEVEMENT_TRIGGERS_DB`, `database.types.ts` a mano); `point_actions.minigame` acepta `minigame:<id>(:bronce|plata|oro)` (igual que `MINIGAME_REF` de `pointActionFor`); ranura `mascot` en `cosmetics`. Semillas: bandera fantasma y minikraken con su logro. Caso nuevo en `economy.supabase.ts` (necesita la base de desarrollo).
- `docs/spec/estado.md`: enlaces de REQ-AVE-037/038 a las pruebas renombradas y nota en REQ-IDE-025.

### Comandos y resultados

- `pnpm exec vitest run apps/web/app/mar/canon-settle.test.ts` → exit 0, 14 pruebas (cada medalla una vez al día; bronce+plata+oro el mismo día pagan tres veces y otra vez al día siguiente; oro de primeras; oro antes de 5:30; escalón que no casa; partida demasiado corta; atajo y «Terminar partida» sin premio ni logros; logros nuevos y Guardacostas; topes de la base).
- `pnpm exec vitest run packages/store/src/canon-migration.test.ts packages/store/src/canon-launch-sql.test.ts` → exit 0 (migración v7 → v8 conserva saldos y logros; SQL igual al navegador).
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 177 archivos, 1704 pruebas (tras fusionar main con T152: conflictos en `canon-mode.tsx`, imports de audio y señales, y `docs/spec/estado.md`, REQ-AVE-037/038 de T153 y REQ-AVE-039 de T152).
- `sh tools/spec/checks.sh` → exit 0 (294 REQ, OK). `pnpm lint` → exit 0. `pnpm build` → exit 0. `pnpm typecheck` → exit 0.
- `E2E_PORT=3973 pnpm e2e mar-canon.spec.ts --workers=1 -g "premio del bronce|Terminar partida|producción"` → exit 0, 6 pasadas.

### Pendiente

- Aplicar la migración y las semillas en Supabase (Hernán). Equipar la mascota en la base (`equipped_cosmetics`, `equip_cosmetic`, `lib/account/merge.ts` SLOTS) y su sitio en Mi Barco: T154.
- Los atajos de desarrollo siguen pagando en `pnpm dev` y en las e2e (`devStartRewards`), como hasta ahora; en producción (la versión de prueba, también con `?dev=1`) nunca.
- Cantidades, nombres y textos `muestra` hasta Álvaro (P14).

## 2026-10-05 — plan 013 T152: Sonido y accesibilidad

Qué existe:
- `apps/web/app/mar/canon-audio.ts`: el sonido del Cañón, todo sintetizado con Web Audio (sin archivos, `muestra`). Efectos: disparo, golpe recibido, enemigo abajo, nota (sube de tono en racha), subir de nivel, elegir carta, botín de élite (y cofre), aviso de boss, aviso suave por cada ataque telegrafiado, boss abajo, medalla, barco inundado; con separación mínima entre efectos iguales. Bucle drum and bass a 170 BPM (bombo, caja con fantasmas, charles, sub bajo) en tres frases de 8 compases que se turnan (dos pasos, amen, rodando, respiro, relleno) y la variante de boss (más bombo, bajo «reese», alarma) que entra con fundido de 1,6 s mientras haya un boss vivo (también minibosses). Al acabar la partida el bucle se funde (2,2 s) y vuelve el ambiente del mar de `/mar` (`setAmbientWorld`, que ya existía en `lib/mundo/sound.ts`); durante la partida el mar se calla. Programador con ventana de 140 ms. Se carga con import dinámico (chunk aparte: al abrir el pop-up o al empezar), fuera de la primera carga.
- Nada se crea ni suena antes del primer gesto de verdad (`isTrusted`) tras cargar el módulo; con el pop-up abierto el módulo ya está, así que «Jugar» es ese gesto; con un atajo de URL, la primera tecla o toque. Pestaña oculta: contexto suspendido. El silencio y volumen de los Ajustes de la web (música y efectos) se multiplican con los del Cañón; con la partida en pausa la música baja al 30 %.
- `canon-sound-preferences.ts`: volumen (70 % por defecto) y silencio del Cañón en `localStorage` `boia.canon.sonido.v1`, con try/catch. En la pausa (`canon-readout-menu.tsx`, junto a «Lecturas de combate»): interruptor «Sonido del juego» y deslizador de volumen, de 44 px.
- `SurvivorsRun` acepta `onEvents` (los eventos de cada paso; un fallo de quien escucha nunca para la partida); `useCanonMode` conecta el sonido (`sound`, `setAudioSettings`, `onSea`); `CanonTestHook` publica `data-sonido` (bloqueado/activo/oculto) y `data-musica` (batalla/jefe/mar).
- Accesibilidad: región `aria-live` siempre presente (`mar-canon-anuncio`) que anuncia subir de nivel (o cofre), la llegada de cada boss y el resultado; con movimiento reducido la cámara de `/mar` no tiembla nunca (`mar3d.ts`, también saltos y choques; `data-temblor` en el lienzo para las pruebas). Telegrafías: revisadas, cada ataque dañino de los bosses de producción tiene su aviso visible (anillo del Vecino, líneas de embestida/andanada, círculos del Kraken; los `summon` sólo invocan). Pausa (44 px con su `::before`), cartas y pop-up ya cumplían ≥ 44 px; ahora hay prueba.
- Textos nuevos por clave en `es-mar.ts` (`mar.canon.sonido*`, `mar.canon.anuncio.*`), `muestra`.
- `docs/spec/estado.md`: REQ-AVE-039 sigue PARCIAL (falta la revisión documentada) con las dos pruebas nuevas enlazadas.

Comandos:
- `pnpm exec vitest run apps/web/app/mar/canon-audio.test.ts` → exit 0, 10 pruebas (nada antes del gesto; efectos en su bus; batalla → boss → mar con fundidos; pestaña oculta; volumen y silencio aplicados y recordados; silencio global; almacenamiento que falla; variaciones del bucle; dispose).
- `E2E_PORT=3217 pnpm e2e mar-canon.spec.ts --workers=1 -g "sonido|teclado|accesib|lecturas|Terminar partida|pop-up previo: se abre"` → exit 0, 16 passed (incluye las 3 pruebas nuevas × móvil y escritorio).
- Test command: vitest → exit 0 (173 archivos, 1676 pruebas); `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0 (ruta crítica de la landing 187,0 de 200 kB); `pnpm typecheck` → exit 0.

Pendiente:
- La música y los efectos son `muestra`: Hernán y Álvaro deben escucharlos; las pistas reales de BOIA, más adelante (hueco: `CanonAudio.setMusic`).
- Revisión documentada de accesibilidad de REQ-AVE-039 (T156).

## 2026-10-05 — plan 013 T149: Healing vinyl redesign and the Vecino ring

### Qué existe

- Config v15 (`SURVIVORS_CONFIG_VERSION` 14 → 15, un único incremento). Chill / Ambient: N1 achica 0,4/s; N2 y N3 +15 de capacidad máxima cada uno (100 → 115 → 130); N4 achica 0,8/s en total; N5 escudo: el siguiente golpe (enemigo, contacto de boss o ataque avisado: `takeWater` y `bossHitLands`) no mete agua y deja 6 s de invulnerabilidad; vuelve 20 s activos después de gastarse (la pausa no cuenta). Los niveles de vinilo admiten `stat` propio y `shield` (`PassiveDef.levels`); stat nuevo `waterCapacityBonus`.
- La capacidad efectiva la usan inundación, Segunda vida, Salvavidas y `snapshot.water.capacity` (la barra de agua ya la lee). `snapshot.shield` (`enabled`, `ready`, `rechargeS`, `invulnerableS`) y, en la vista, un aro turquesa mínimo alrededor del barco cuando está listo (`survivors-view.ts`, malla `survivors-shield-ready`, también en baja). Textos de carta por nivel en `es-mar.ts` (CRLF conservado). La mejora heredada `bailing` refleja el N1 (0,4).
- Vecino, `onda` y `bronca`: 8 huecos equidistantes, cada uno 2,5 × el diámetro de colisión del barco, con `gapRad` derivado del radio del frente (`vecinoGapRad`, `gapBoatWidths: 2.5`); la segunda onda gira medio paso (π/8), también al cambiar de fase; las islas siguen cortando. Colisión y vista usan el mismo ángulo.
- Piloto (bots): ante un anillo apunta al hueco más cercano a su propia distancia y sale recto por él (no rodea sólo por la tangente, que se pasaba de largo en huecos estrechos); cuenta como «dentro» hasta 120 u más allá del alcance del anillo, y el codicioso no persigue notas mientras el anillo le amenaza (antes volvía a entrar tras una nota y lo pillaba fuera de hueco). `BotRun.bossAttackHits` cuenta aparte los golpes avisados.
- Nota en «Notas» de la guía beta 3 con los valores cambiados.

### Cifras (antes / después)

- Anillos del Vecino, 40 semillas, 120 s, sin armas ni curación, media vida (alternan onda y bronca), capacidad 20 / 100: config v14 con el piloto v14 **30/40 sobreviven, 10 golpes / 40/40, 12 golpes**; config v15 con el piloto nuevo **40/40, 0 golpes / 40/40, 0 golpes**. Mismo piloto nuevo sobre los anillos v14: 16/40, 24 golpes. El piloto v14 sobre los anillos v15: 0/40 (rodeaba sin entrar en huecos de 68 u).
- Partida entera, codicioso, Normal, 8 semillas por acto: golpes del Vecino 2 con anillos v15 y el piloto final; con el piloto a medias de la tarea, 12 (y 2 con ese piloto sobre los anillos v14).
- La prueba «el Kraken cuesta más que el Barco Fantasma» fallaba (Tranquila 6 > 5) por ese piloto a medias (aproximación hacia r = 480 y sin margen fuera del anillo), que cambiaba las trayectorias de toda la partida. La curación no influía (mismas cifras con el chill de v14 y sin escudo). Con el piloto corregido pasa sin tocar la prueba; «casi no se come los golpes avisados» vuelve a contar `bossHits` (todos), como en v14.

### Comandos y resultados

- `pnpm exec vitest run packages/engine/src/survivors --testTimeout=60000` → exit 0, 16 archivos, 235 pruebas.
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 174 archivos, 1674 pruebas.
- `sh tools/spec/checks.sh` → exit 0 (294 REQ, OK). `pnpm lint` → exit 0. `pnpm build` → exit 0. `pnpm typecheck` → exit 0.

### Pendiente

- Probar a mano en la beta (Hernán): huecos del Vecino y aro del escudo en móvil.
- `canon-hud-model.test.ts` compara ahora el número de la carta con coma decimal (0,4), porque el texto de chill lleva decimales.

## 2026-10-05 — plan 013 T151: Pre-game pop-up (act, difficulty, ranking slot, Jugar)

Qué existe:
- «Jugar» en el panel de la isla del Cañón ya no empieza: abre el pop-up previo (`apps/web/app/mar/canon-previa.tsx` + `canon-previa.css`, `data-testid="mar-canon-previa"`), diálogo modal de cristal oscuro como la tarjeta final. Acto 1/2/3 como ventanas de cielo con su boss final (Acto 2 «Cerrado» hasta vencer al Barco Fantasma, Acto 3 «Próximamente»; «Superado» si su boss final ya cayó), Tranquila/Normal/Tormenta con su texto, el hueco del ranking del boss final del acto elegido (vacío y dicho, `mar-canon-previa-ranking`, `data-boss`; prop `ranking(act, boss)` para T155) y «Jugar» (con «Acto N en <dificultad>»).
- Teclado (foco al acto marcado, flechas, Tab atrapado en el diálogo); Esc, la × o tocar fuera lo cierran y vuelve el panel de la isla; áreas ≥ 44 px; en el móvil ocupa la pantalla salvo la barra de abajo, «Jugar» pegado abajo si hace falta scroll; nunca tapa «Entradas». Mientras está abierto el barco no se maneja y las botellas cercanas se apartan.
- `useCanonMode`: `prep` (open, blocked, chooseAct, chooseDifficulty, play, close) y `acts`; `panel.extra` y los selectores del panel se quitan (viven ahora en `canon-previa.tsx`, con los mismos `data-testid`). Los atajos `acto=` y `dificultad=` siguen empezando directamente.
- Medallas por acto y dificultad: ese estado no existe; sólo «Superado» (boss final caído, campaña T144).
- i18n `mar.canon.previa.*` (muestra). La prueba de REQ-AVE-037 en `docs/spec/estado.md` apunta al nuevo título de la e2e de campaña.

Comandos:
- `E2E_PORT=3291 pnpm e2e mar-canon.spec.ts --workers=1 -g "pop-up|acto|dificultad"` → exit 0 (14 passed, 2 skipped: rendimiento en escritorio, saltado por diseño); «desde el panel de su isla…» y «en plena carrera…» también pasan en móvil y escritorio.
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0 (171 files, 1662 tests); `sh tools/spec/checks.sh` → 0; `pnpm lint` → 0; `pnpm build` → 0; `pnpm typecheck` → 0.

Pendiente:
- T155 llena el ranking (prop `ranking` de `CanonPrevia`, hueco `mar-canon-previa-ranking`).
- Medallas por acto y dificultad en el pop-up cuando exista ese estado (T153/T155).

## 2026-10-05 — plan 013 T150: SVG icons for every skill

Qué existe:
- `apps/web/app/mar/canon-icons.tsx`: 31 iconos SVG de 32×32 en la familia de T114 (`lib/mundo/menu/icons.tsx`: formas redondas, contorno 2.4 en `currentColor`, rellenos de `ICON_PALETTE` más agua, ácido y rojo del Cañón en `CANON_ICON_PALETTE`): 7 armas, 9 vinilos (todos sobre el disco morado), 4 evoluciones, 6 mejoras, el botín (Imán total, Llama, Salvavidas: cada uno el suyo, ya no la boya), Segunda vida (dos corazones), la llama encendida y el cofre del miniboss. `<CanonIcon name>` (decorativo, `aria-hidden`).
- `canon-hud-model.ts`: `WEAPON_ICON`, `VINYL_ICON`, `EVOLUTION_ICON`, `UPGRADE_ICON`, `DROP_ICON` (nuevo), `SALVAVIDAS_ICON`, `FLAME_ICON`, `FALLBACK_ICON` (= achique) y `CHEST_ICON` dan nombres de icono, no emoji; `cardIcon` ya no cae en emoji; `CanonGearItem.icon` para la tarjeta final.
- `canon-hud.tsx` / `canon-hud.css`: los iconos SVG en los huecos de la fila (86 % del hueco), la Segunda vida, las cartas de nivel y del cofre, el aviso de la Llama y el equipo de la tarjeta final (icono + nombre y nivel).
- `canon-icons.test.ts`: cada arma, vinilo, evolución, mejora y objeto del botín de la config tiene su icono SVG sin emoji; todos distintos; cualquier tipo de carta saca un icono dibujado; los rellenos salen de la paleta.

Comandos:
- `pnpm exec vitest run apps/web/app/mar/canon-icons.test.ts apps/web/app/mar/canon-hud-model.test.ts` → exit 0 (2 archivos, 35 pruebas)
- Comando de prueba completo: vitest → exit 0 (172 archivos, 1666 pruebas); `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0 (186.9 kB de 200 kB); `pnpm typecheck` → exit 0
- Hoja de contacto (64 y 20 px, sobre crema y sobre el cristal del HUD, más una carta en escritorio y el HUD en móvil): **aprobada por Hernán el 2026-10-05 tal cual (opción A)**, sin cambios.

Pendiente: nada de T150. Fuera de alcance: las medallas de la tarjeta final (🥉🥈🥇 en `es-mar.ts`) y los avisos/pines del mundo siguen con emoji.

## 2026-10-05 — plan 013 T148: Pause «Terminar partida» and the battle HUD layout

Qué existe:
- **«Terminar partida»** en la pausa (`menu.tsx`, `MenuGame`): junto a «Seguir
  jugando»; pide confirmación («¿Terminar la partida ahora?», «Sí, terminar» /
  «No, seguir»). En la pregunta, Esc y «No, seguir» vuelven atrás sin cerrar el
  menú (el foco vuelve a «Terminar partida»). «Sí, terminar» acaba la partida y
  cierra el menú.
- Nueva razón de fin `quit` en la simulación (y en `ResultReason`; una sesión
  liquidada con `quit` se invalida como `abandoned`) (`SurvivorsGame.quit()`,
  `SurvivorsRun.quit()`): sin medalla. `settleCanonSession` (`canon-settle.ts`)
  abandona la sesión en vez de liquidarla: sin premio ni `win_minigame`.
  `CanonResult.ranked` (false con `quit`) es la marca para que el ranking (T155)
  se salte esas partidas; la tarjeta lleva `data-ranking="no"` y la prueba
  `data-premio="quit"`.
- Tarjeta final «Partida terminada» corta: tiempo, enemigos y notas, «Volver al
  mar» y «Otra vez»; sin medalla, equipo, bosses ni línea de premio; cielo de
  noche en calma con las dos barras de la pausa.
- **HUD de batalla**: los saldos ★/🪙 (`mar-saldos`) se apartan con la capa
  `balances` de `HideLayer` y vuelven al volver al mar. Armas, vinilos y Segunda
  vida van arriba a la derecha (móvil: columnas de 3 huecos de 22 px, espejo del
  minimapa; escritorio: una fila de armas y otra de vinilos de 28 px). La píldora
  de tiempo/nivel/XP, más pequeña (pausa 28 px con 44 px de toque) y con un
  ancho máximo que deja sitio al minimapa y a los huecos.

Comandos:
- `pnpm exec vitest run apps/web/app/mar/canon-settle.test.ts` (quit no paga ni da `win_minigame`, ni liquidada a mano; control al amanecer sí) → exit 0.
- `E2E_PORT=3148 pnpm e2e mar-canon.spec.ts --workers=1 -g "Terminar|HUD|armas y vinilos"` → exit 0, 14 passed (móvil y escritorio; incluye las 3 nuevas y la de T130 actualizada a arriba a la derecha).
- Comando de prueba del plan (vitest sin db, checks, lint, build, typecheck) → exit 0; vitest 171 archivos, 1662 pruebas.

Pendiente:
- El peor caso «6 armas + 6 vinilos» no se puede forzar (la config da 4 vinilos);
  la e2e usa `armas=1` (7 armas) y un boss en pantalla en 360×640, 390×844,
  768×1024 y 1440×900. Los iconos siguen siendo emoji (T150).

## 2026-10-05 — plan 012 T136: «Mostrar vida» and «Mostrar daño» options

Implemented by Codex (wrapper verified and committed).

What exists
- Two toggles in the Cañón pause menu (`canon-readout-menu.tsx`), off by default, persisted per browser with try/catch storage (`canon-readout-preferences.ts`).
- «Mostrar vida»: one canvas overlay draws hp bars over damaged non-boss enemies. «Mostrar daño»: damage numbers aggregated per enemy in 160 ms windows, capped, no float under reduced motion (`engine/survivors-readouts*.ts`, `survivors-readout-model.ts`). Read-only snapshot field in `packages/engine/src/survivors/sim.ts`.
- i18n keys in `es-mar.ts` (`muestra`); data attributes for e2e; e2e case in `mar-canon.spec.ts`.

Commands
- vitest (excluding packages/db): 169 files, 1637 tests passed.
- `sh tools/spec/checks.sh`: OK. `pnpm lint`: exit 0. `pnpm typecheck`: exit 0.
- `pnpm build`: exit 0, landing 186.9 kB of 200 kB.
- `pnpm e2e mar-canon.spec.ts --workers=1`: 70 passed, 1 skipped, 1 failed (dawn reward, known flaky); rerun alone: 2 passed.

Pending
- None.

## 2026-10-05 — plan 012 T145: Final card

Qué existe:
- `CanonResult` lleva ahora las armas y vinilos (con nivel) de la partida; `endCardModel(result, unlockedAct)` en `canon-hud-model.ts` da título/línea (el final propio de cada boss final: Fantasma en el acto 1, Kraken en el 2; el genérico `mar.canon.fin.victoria` queda de reserva), medalla (o «Sin medalla»), acto y dificultad, bosses vencidos y la línea «¡Acto N desbloqueado!».
- `CanonEnd` (`canon-hud.tsx`) pinta todo con `data-testid` `mar-canon-final-medalla|partida|desbloqueo|equipo|bosses`; el foco empieza en «Otra vez», Esc vuelve al mar, el desvanecido de «Volver al mar» ya existía; movimiento reducido sin animación. Textos por clave en `es-mar.ts` (`muestra`). Sin cambios en el sim, premios ni la carrera.
- Corregido: el título del final tras vencer al Kraken ya no dice «Fantasma».

Comandos: pruebas unitarias de la tarjeta en `canon-hud-model.test.ts`; e2e en `mar-canon.spec.ts` (tarjeta tras inundación, tras oro forzado con `vencer=1`, «Otra vez», «Volver al mar»). Resultados en el informe de la tarea.

Pendiente: nada propio.

## 2026-10-05 — plan 012 T143: Boss HUD: bar, name, phase and warnings

Qué existe:
- `apps/web/app/mar/canon-hud-model.ts`: modelo sin React del HUD de bosses: `bossBarView` (vida %, marcas de fase desde `SURVIVORS_CONFIG.bosses[x].phases`, estado `normal|ghost|shielded|submerged|exposed` desde `fantasma.ghostness` / `kraken.exposed` / `invulnerable`, ángulo y lejanía), `phaseMarks`, `sameBossBar`, `bossNotices` (llegada, cae si está en `bossesDefeated`, huye si no; derivado de las diferencias entre lecturas del snapshot), `noticeActive` / `BOSS_BANNER_MS` (3,5 s), `BOSS_NOTICE_KEYS`.
- `canon-hud.tsx`: barra del boss dentro del HUD de arriba (no tapa cuenta atrás, nivel, pausa, BETA, «Entradas» ni mandos), estilo miniboss (roja) y final (dorada, más alta, rayada), nombre por clave, «Fase n/N» (sólo escritorio), chip de estado (Fantasma / Protegido / Sumergido / ¡Cabeza al aire!, y la barra rayada gris cuando no recibe daño), aviso «¡Llega X!» / «¡X cae!» / «X se retira», y flecha en el borde hacia un boss fuera de pantalla (usa `data-canon-boss-vista` del lienzo). La fila de equipo baja 30 px en móvil mientras hay boss.
- i18n `es-mar.ts`: `mar.canon.boss.*`, `survivors.boss.prueba`, `survivors.boss.capitan` (`muestra`). Movimiento reducido: sin transiciones ni animación del aviso.
- Pruebas: 6 unitarias nuevas en `canon-hud-model.test.ts`; e2e `boss HUD: barra arriba…` (T143) en `mar-canon.spec.ts`, escritorio y móvil, mide en una sola lectura barra, aviso, HUD y lo fijo y comprueba que no se pisan.

Comandos: ver el informe final de la tarea (vitest, e2e mar-canon.spec.ts, lint, typecheck, build).

Pendiente: la flecha usa el ángulo en pantalla sin proyectar la cámara (válido con la cámara sin giro); las marcas de fase de bosses por tiempo (`untilS`) no se pintan; el aviso sólo enseña el último si llegan varios a la vez.

## 2026-10-05 — plan 012 T144: Medals, campaign act 1 → 2, act and difficulty on the panel

Qué existe:

- **Medallas** (`packages/engine/src/survivors/medals.ts`, §8): `survivorsMedal({ end, bossesDefeated, act })` → `oro` si cae el boss final (`victory`), `plata` al amanecer con todos los minibosses del guion del acto vencidos, `bronce` al amanecer, `null` inundado/abandonado. Un acto sin minibosses no da plata. `medalWon` = bronce o más, que es exactamente el `won` de la sesión (`canonOutcome`; probado para todo resultado y acto). `actMinibosses` / `actFinalBoss` leen los huecos encendidos del guion. Premio y logros sin tocar.
- **Atajo `&vencer=1`** (dev, cuenta como partida de prueba): cada boss cae en cuanto aparece (`SurvivorsGame.defeatBossesNow()`, nuevo método público de la simulación; deja la vida a 0 y pasa por la derrota normal: cofre y nota de los minibosses, `victory` del final). Sirve para forzar el oro (T144, T145).
- **Campaña** (`apps/web/app/mar/canon-campaign.ts`): un contador por acto en el progreso (`canon:acto-<n>:boss-final`, `ProgressApi.counter/increment`). Modo local: el repositorio del invitado; con cuenta: la misma copia, que viaja con `save_snapshot` y se mezcla con el máximo por contador. Sin tablas ni migraciones. Acto 1 siempre abierto; el `n` se abre al vencer el boss final del `n-1`; los actos que la config aún no tiene (el 3) salen «próximamente». Se apunta al liquidar una partida `victory` válida que cuente como el premio (normal, o de prueba sólo en `pnpm dev`/e2e).
- **Panel**: Acto 1 / Acto 2 / Acto 3 (radiogroup, sobre las tres dificultades y «Jugar»); los cerrados y «próximamente» se ven, con aviso y `aria-disabled`, y no se marcan ni con el dedo ni con las flechas (que saltan a los abiertos). El acto elegido se recuerda en la visita; si no está abierto, se juega el 1. El bloqueo en carrera sigue igual.
- **Sesión**: `canonConfigFor(cfg, difficulty, act)` lleva `survivors.act` → acto y dificultad en el `configHash`. Atajo `&acto=<n>` de T142 reutilizado (mismo código), salta la campaña.
- Para T145: `CanonResult` lleva `medal`, `act`, `difficulty`, `bosses`; `CanonMode.unlocked` (el acto que abrió la última partida), `CanonMode.act`, `CanonMode.campaign`. Estado de pruebas: `data-medalla`, `data-vencidos`, `data-desbloqueado`.

Comandos:

- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 165 files, 1614 tests (nuevos: `survivors-medals.test.ts`, `canon-campaign.test.ts`, bloques T144 en `world-canon.test.ts` y `survivors.test.ts`)
- `sh tools/spec/checks.sh` → OK; `pnpm lint` → 0; `pnpm build` → 0; `pnpm typecheck` → 0 (tras `git merge main` con T142)
- `E2E_PORT=3471 pnpm e2e mar-canon.spec.ts --workers=1` → 65 passed, 2 failed por carga (amanecer en t=419: el saldo se leyó tras el premio; T131 panel: carta abierta tras 5 min de test lento); los dos solos → 4 passed. Los dos e2e de T144 pasan en móvil y escritorio

Pendiente:

- La tarjeta final (T145) enseña la medalla y el acto abierto; el título del final especial aún dice «Fantasma» también para el Kraken (T145).
- Premios por medalla, logros de boss y el pop-up previo: beta 4 (decisión 7).

## 2026-10-05 — plan 012 T142: El Kraken en el mar 3D

Qué existe:
- **`apps/web/app/mar/engine/survivors-kraken.ts`** (módulo propio, `SurvivorsKraken`): pinta lo que `BossView.kraken` (T141) cuenta, sin crear nada durante `update`. Ocho piezas, todas baratas: la **sombra** (disco alargado en su rumbo, opacidad fija 0,5, a ras de agua) mientras está sumergido y al salir/hundirse (se encoge con el progreso); la **cabeza** (una geometría low-poly con manto, manchas, morro y ojos mirando a +x; sube desde bajo el agua con el progreso de `emerging` y baja con `diving`; fuera asoma, y con la **cabeza expuesta** sube un poco más y la rodea un **aro dorado fijo**, sin parpadeo); los **tentáculos** (dos `InstancedMesh`, base y punta que se dobla, tope 10) que salen de su círculo al subir (`rising`: alto = progreso; `up`: entero; `down`: lo que queda fuera) inclinados hacia fuera del Kraken; los **círculos de aviso** (`bossWarnings` de forma `circles` del Kraken: aro + relleno que crece con el progreso, lleno al golpear; rojo para tentáculos, ámbar para rocas; tope 16); las **rocas** (icosaedro instanciado, tope 8) volando en arco desde el Kraken hasta su círculo; y el **agarre**: dos brazos tendidos sobre la isla agarrada (dirección con el mar de la partida y la vuelta del planeta). En `baja`, menos segmentos en círculos y piezas. **Movimiento reducido**: sin vaivén de cabeza, sombra, tentáculos ni giro de rocas; la cabeza cambia de altura sin animación. Colores y tamaños como constantes `muestra` (`KRAKEN_COLORS`, `KRAKEN_HEAD_Y`, `TENTACLE_SIZE`…).
- `survivors-view.ts`: crea `SurvivorsKraken` si la config tiene `bosses.kraken` (antes del `curveTree`, así se curva con el planeta), lo pinta en `updateBosses`, lo suelta en `dispose`; `bossesWhere` añade `kraken:<modo>` si se ve la cabeza o la sombra; opción nueva `sea` (límites + islas) para los brazos del agarre. `mar3d.ts` (sólo partida): pasa `sea: run.game.world` y `data-canon-boss` lleva `kraken:<modo>`.
- **Atajo `acto=<n>`** (temporal hasta T144): `CANON_PARAMS.act`, `asAct` (sólo actos que la config tiene), `canonShortcut().act`, se quita de la URL, `isDevStart({ act })` la marca de prueba (sin premio en producción); `SurvivorsRunOptions.act` → `createSurvivors({ act })`; `CanonHook.acto` y `data-acto` en `canon-mode.tsx`. El acto **no** entra aún en `configHash` (T144).
- i18n: `survivors.boss.kraken` = «El Kraken» (`muestra`).
- Pruebas: `survivors-kraken.test.ts` (9): modelos (cabeza con ojos, tentáculo de y 0→1, clave i18n), `headOut` por modo, partida real (sombra sumergido → cabeza fuera → círculo de aviso → tentáculos donde la simulación los pone; sin boss nada pintado), cabeza expuesta con aro fijo, círculos con progreso y colores, rocas en arco, brazos hacia la isla, movimiento reducido quieto (y sin reducir, se mueve), `dispose` de cada geometría/material una vez (sola y desde la vista). `survivors.test.ts` (2 nuevas): el atajo y que `acto=2` pasado el hueco trae al Kraken. e2e `mar-canon.spec.ts`: `?minijuego=canon&acto=2&t=<hueco+5>&seed=7` → `data-acto=2`, el Kraken entra en pantalla y se le ve fuera del agua, sin errores de consola.

Comandos:
- `pnpm exec vitest run apps/web/app/mar/survivors.test.ts apps/web/app/mar/engine --testTimeout=60000` → exit 0, 27 archivos, 282 pruebas.
- `E2E_PORT=4371 pnpm e2e mar-canon.spec.ts --workers=1 -g Kraken` → exit 0, 2 pasadas (móvil 4,7 s, escritorio 4,8 s).
- `E2E_PORT=4371 pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, 61 pasadas, 1 saltada (rendimiento, sólo móvil), 13,4 min.
- Test command, paso a paso: `pnpm exec vitest run --exclude "**/packages/db/**" --testTimeout=30000` (161 archivos, 1582 pruebas), `sh tools/spec/checks.sh`, `pnpm lint`, `pnpm build`, `pnpm typecheck` → los cinco exit 0.

Tras unir main con T139 (conflictos sólo en `canon-mode.tsx`, `survivors-view.ts`, `survivors.ts`: se quedan los dos lados, `data-acto` junto a `data-jefes`/`data-cofre-cerca`, `acto` junto a `jefes`/`cofreCerca`; además se devolvieron `canon-mode.tsx` y `survivors-view.ts` a finales de línea LF como en main):
- `pnpm exec vitest run apps/web/app/mar --testTimeout=60000` → exit 0, 37 archivos, 368 pruebas.
- `E2E_PORT=4371 pnpm e2e mar-canon.spec.ts --workers=1` → 62 pasadas, 1 saltada, 1 fallada (12,3 min): «Tiburón Martillo… carta de cofre (T139)» en móvil no vio al tiburón con la máquina cargada; sola (`-g Martillo`) → exit 0, 2 pasadas.
- Test command paso a paso → los cinco exit 0; vitest 163 archivos, 1598 pruebas.

Pendiente:
- El acto elegido en el panel, la campaña y el acto en `configHash` (T144); quitar o mantener `acto=` como atajo lo decide T144.
- La barra del Kraken en el HUD (T143); medir el fotograma en `baja` con el Kraken (T147).

## 2026-10-05 — plan 012 T139: Miniboss 2: Tiburón Martillo and the chest

Qué existe:
- `SURVIVORS_CONFIG.bosses.martillo` (miniboss, sólo datos sobre el sistema genérico de T137): hp 1400, embestidas en línea siempre avisadas (`embestida` 1,2 s de aviso; `furia` 0,9 s con media vida) y llamadas de pirañas entre ellas (`banco` 5, `bancoGrande` 8); dos fases por vida; en el acto 2 aguanta ×1,5 (`bossHpScale`) y sus pirañas ×1,25 (`enemyHpScale`). El hueco de las 4:30 del acto 1 (y del 2) va encendido. Config v13 (tras integrar T140 y T138).
- El cofre: tocarlo abre una carta de cofre (`LevelUpCard.source: 'chest'`, `boss`), una sola opción y gratis (no gasta nivel): la evolución si su condición se cumple (`eligibleEvolutions`, venga de donde venga `evolutionSource`), si no una mejora del mazo (`chestCandidates`: subir de nivel lo que llevas, con los pesos de la oferta; nunca la Segunda vida). Una carta de nivel pendiente espera a la del cofre. `game.spawnChest(boss, x, y)` para pruebas (también lo usa la caída de un miniboss).
- El piloto codicioso va a por los cofres como a por las notas.
- 3D: `apps/web/app/mar/engine/survivors-shark.ts` (tiburón martillo y cofre low-poly en código, aro de la llamada; instanciado, sin destellos; con movimiento reducido no se mece ni gira), colgado de `SurvivorsView`. La línea de aviso de la embestida la pinta el único dibujante de avisos de boss de la vista (T140). `data-canon-jefes-vista`/`-vistos` en el lienzo (mar3d), junto a `data-canon-boss*` de T140.
- Carta del cofre en `CanonCards`: cabecera «¡Cofre!», 🎁, `data-origen="cofre"`, clase `is-chest`. i18n: `survivors.boss.martillo`, `mar.canon.cofre.*` (muestra). Hook de pruebas: `data-jefes`, `data-cofre-cerca`.

Comandos (tras integrar main con T140 y T138):
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 162 archivos, 1587 pruebas
- `sh tools/spec/checks.sh` → OK; `pnpm lint` → 0; `pnpm build` → 0; `pnpm typecheck` → 0
- `E2E_PORT=4391 pnpm e2e mar-canon.spec.ts --workers=1` → 59 passed, 2 failed (desktop: rampa T146 y «HUD con BETA», las inestables conocidas), 1 skipped; las dos solas → 2 passed. La nueva (T139: el tiburón visto y la carta de cofre tras vencerlo, con `t=262&armas=1&dificultad=tranquila`) pasa en móvil y escritorio.

Pendiente:
- Equilibrio del tiburón (T147): el codicioso lo vence en 8–33 s; el `dodge` no esquiva avisos de boss (Tranquila, semilla 1 acaba con 98 de agua con hp 1400; con 1800 se inunda).
- Las pruebas de partida entera de T140/T141 ahora filtran sus sucesos por su boss (los minibosses entran también); `survivors.test.ts` acepta `victory` al final.

## 2026-10-05 — plan 012 T138: El Vecino Quejica

Implemented by Codex (wrapper verified).

Qué existe:
- Engine: `packages/engine/src/survivors/vecino.ts` (miniboss a ~2:30 en acto 1, dos fases, anillos de ondas con huecos, telegrafiados, las islas bloquean tramos; acto 2 con x1.5 HP), cofre y nota grande. `SURVIVORS_CONFIG_VERSION` 11 -> 12. Única extensión genérica: `ringObstacles` en los avisos de jefe.
- Web: `apps/web/app/mar/engine/survivors-vecino.ts` (barcaza + megáfono, anillos baratos, movimiento reducido respetado), enganche en `survivors-view.ts`, clave i18n en `es-mar.ts` (`muestra`).
- Pruebas: `survivors-vecino.test.ts` (engine y web), e2e en `mar-canon.spec.ts`.

Comandos:
- `pnpm exec vitest run packages/engine/src/survivors apps/web/app/mar --testTimeout=60000` -> exit 0, 552 tests, 47 archivos
- `pnpm lint` -> exit 0; `pnpm typecheck` -> exit 0; `pnpm build` -> exit 0
- `E2E_PORT=3217 pnpm e2e --workers=1 -g Vecino mar-canon` -> 2 passed (mobile, desktop)

Pendiente: nada propio; e2e completo no corrido.

## 2026-10-05 — plan 012 T140: Boss final del acto 1: Barco Pirata Fantasma

Qué existe:
- **El Barco Pirata Fantasma** como boss final del acto 1, ya **encendido en el hueco `boss` del guion (5:30)** de una partida normal (`SURVIVORS_CONFIG.bosses.fantasma`, `kind: 'boss'`, 1600 hp base × `bossHpScale` del acto × dificultad, radio 48, velocidad 170 (más que el barco: no se le escapa uno), sin cofre, nota grande 100, no ignora islas). Config versión 10 → **11**. Al vencerlo la partida **acaba ahí** con el `EndReason` nuevo **`victory`** (suceso `end` en el mismo paso que `bossDefeated`; `finalBossDefeated` true); al amanecer con él vivo se retira como siempre (`survived`).
- Encima del sistema genérico de T137 (fases por vida 0,6 / 0,25 con `orbit` a 300/280/260 u, `speedScale` 1 / 1,15 / 1,3; un ataque `andanada` de forma `broadside`: 4 disparos por costado, radio 9, alcance 560, 300 u/s, 7 de agua, aviso 1,1 s con el boss quieto, **las islas los paran** como a cualquier disparo enemigo; y `tripulacion`, `summon` de 3 piratas con `hpScale` 0,8 y **`ghost: true`**), el módulo nuevo **`fantasma.ts`** lleva el **ciclo fantasma** con los números de `BossDef.fantasma: GhostShipDef`: cada fase dice cuánto está sólido (`solidS` 12 / 10 / 8) y cuánto desvanecido (`ghostS` 5 / 6 / 7); el cambio a fantasma **espera a que acabe la andanada en curso**; desvanecido es **invulnerable** (sale de `bossTargets`, la Llama no lo toca), **no toca el casco**, va a `ghostSpeedScale` 1,35 y sólo lanza las llamadas de `ghostAttacks` (`tripulacion` cada 3 s, la primera a los 0,8 s); sólido vuelve a los ataques de la fase con su reloj de nuevo. `fadeS` 0,6 es la rampa que lee `ghostness` (para el HUD; la pantalla no anima opacidades). Funciones: `createGhostShip`, `stepGhostShip`, `ghostInvulnerable`, `ghostSolid`, `ghostSpeedScale`, `ghostAttackPlan`, `ghostShipView`, `ghostHash`, `validateGhostShip` (lo llama `validateBoss`).
- Lo que ve la pantalla y el HUD: `BossView.fantasma: GhostShipView | null` (`mode` solid/ghost, `progress` 0→1 del modo, `leftS`, `ghostness`); suceso **`fantasmaState`** en cada cambio; `EnemyView.ghost` (los piratas que llama; en la simulación son piratas normales); `bossWarnings` de forma `broadside` (una línea por costado) durante el aviso y los disparos.
- Cambios pequeños en el genérico (`sim.ts`, `bosses.ts`): `attackFrom(def, names, k)` (el Fantasma cambia de lista de ataques por modo; `attackAt` lo usa); `stepBosses` pide al Fantasma su plan de ataque; `moveBoss` multiplica por su `ghostSpeedScale`; `bossInvulnerable` y `contactDamage` preguntan si está desvanecido; `summon.ghost` marca a los llamados; `stateHash` lleva `ghostHash`; **`defeatBoss` de un `kind: 'boss'` acaba la partida con `victory`** (también el Kraken: T141 lo dejaba para T144); `finish` sólo acepta la primera razón (vencer al boss acaba a medio paso) y no se abre ninguna carta después.
- **Web.** `survivors-props.ts`: `ghostShipGeometry` (galeón bajo poligonaje: casco azul noche, dos mástiles con velas rasgadas, bauprés, farol de popa que brilla, bandera negra con calavera; `GHOST_COLORS`), `ghostShipMaterial(ghost)` (el mismo modelo con **dos materiales de opacidad fija**: sólido opaco con brillo celeste, desvanecido `transparent` 0,38 sin `depthWrite` y más brillo; nunca se anima la opacidad, como en T128), `ghostPirateMaterial` (el modelo del pirata teñido de celeste, translúcido 0,55). `survivors-view.ts`: dos `Mesh` del barco (`survivors-boss-fantasma` / `-ghost`), sólo una visible según el modo (desvanecido flota 0,35 más alto, fijo); una pieza instanciada `survivors-pirate-ghost` (tope mín(`caps.enemies`, 24)) a la que van los piratas con `ghost`; `survivors-boss-warning` (8 líneas × 2: tramo y relleno con el progreso, llenas durante los disparos) para los avisos `broadside`/`line`; con movimiento reducido el barco no se mece ni se ladea; `bossesWhere` y `capacity()` nuevos; `dispose` libera también las `Mesh` sueltas. `mar3d.ts` (sólo el hook de pruebas): `data-canon-boss` («fantasma:solid») y `data-canon-boss-vista` (los bosses dentro de la vista). i18n: `survivors.boss.fantasma`, `mar.canon.fin.victoria(.texto)`. Pantalla final: `END_KEYS.victory` («¡Barco Fantasma hundido!», cielo celeste en `canon-hud.css`); la medalla y la tarjeta son T144/T145.
- **Sesión** (`packages/engine/src/minigames`): `ResultReason` admite `victory`; `canonOutcome('victory')` = `won`; `canonEnd('victory', …)` pone la marca del objetivo (la noche entera: el oro vale más que el bronce) y `canon.minPlausibleMs` acota por `canonEarliestWinS()` (el hueco del boss final más temprano, 330 s): no se puede ganar antes de que entre el boss.
- Pruebas: `survivors-fantasma.test.ts` (12): datos y validación; entra a su segundo en el acto 1 (también empezando después del hueco); las ventanas con sus segundos, desvanecido ni la Llama ni las bolas le quitan nada y sólido sí; sólido toca el casco y desvanecido no moja; el desvanecimiento espera a la andanada; cada andanada avisa con dos líneas perpendiculares antes de disparar y ningún disparo sale sin aviso; en mar abierto moja a un barco quieto y un anillo de islas las para todas (`blocked`, cero `bossHit`); la tripulación sólo desvanecido, piratas marcados `ghost`; fases por vida, vencerlo → `victory` en el mismo paso, nota grande, sin cofre, sin carta, ya no avanza; retirada al amanecer; partida entera del acto 1 determinista con los dos modos y piratas fantasma; piloto quieto recibe golpes y el que esquiva en Tranquila no se inunda. Web `survivors-fantasma.test.ts` (7): modelo y materiales, las piezas y topes, sólido/desvanecido, piratas fantasma, líneas de aviso, movimiento reducido y que pintar no crea piezas. `world-canon.test.ts`: `victory` gana con la marca del objetivo, la sesión lo valida y premia, y «vencer» antes del hueco no vale. e2e `mar-canon.spec.ts`: nueva prueba con `t=` pasado el hueco: el Fantasma está en la partida y entra en pantalla, sin errores de consola.
- Pruebas ajustadas al hueco encendido: `survivors-balance.test.ts` (T132) corre con los huecos de boss apagados (`WAVES_ONLY`: es el equilibrio del bucle sin bosses; el de los bosses es T147); `survivors.test.ts` «7:00» sin bosses (si no, vence antes); `survivors-beta2`, `survivors-bosses`, `survivors-kraken` aceptan el hueco encendido y `victory`; `survivors.test.ts` (web) cuenta sólo piezas instanciadas.

Comandos (tras unir main con T135, sin conflictos; las dos tareas subieron la config a la 11):
- `pnpm exec vitest run packages/engine/src/survivors packages/engine/src/minigames apps/web/app/mar --testTimeout=120000` → exit 0, 47 archivos, 573 pruebas.
- `E2E_PORT=3917 pnpm e2e mar-canon.spec.ts --workers=1` → 56 pasadas, 1 saltada (rendimiento, sólo móvil), 1 fallada (16,3 min, máquina cargada): «llegar al amanecer da 150 puntos» en escritorio leyó los saldos cuando la partida de 1 s ya había pagado; sola → exit 0, 2 pasadas. La prueba nueva del Fantasma pasa en móvil (1,8 s) y escritorio (4,4 s). En la primera pasada fallaron también «HUD con BETA…» y «interruptor de desarrollo» en escritorio: la carta de nivel de la semilla 7 se abre a los 128,2 s (medido en la simulación, igual en `alta` y `baja`, sin relación con el boss) y paraba el reloj y los derrotados que esperaban; esas dos pruebas contestan ahora la carta con Intro dentro de la espera, como las demás.
- Test command, paso a paso: `pnpm exec vitest run --exclude "**/packages/db/**" --testTimeout=30000`, `sh tools/spec/checks.sh`, `pnpm lint`, `pnpm build`, `pnpm typecheck` → los cinco exit 0; vitest 158 archivos, 1557 pruebas.

Pendiente:
- La barra del boss y el aviso de «se va a desvanecer» en el HUD (T143, con `ghostness`/`leftS`); la medalla de oro, la campaña y la tarjeta final (T144/T145).
- Equilibrio con bots contra el Fantasma (T147): primer ajuste; en Tranquila el piloto que esquiva y elige bien aguanta; no se midió en Normal/Tormenta.
- Los textos `survivors.boss.prueba` y `survivors.boss.kraken` siguen sin existir en i18n (fuera del alcance).

## 2026-10-05 — plan 012 T135: Elite drops: Imán total, Llama and Salvavidas

Qué existe:
- **Botín de las élites** (`packages/engine/src/survivors/drops.ts`, `config.drops`):
  al caer una élite, con `chance` 0,05 sale un objeto, el tipo a partes iguales entre
  `types` (`iman`, `llama`, `salvavidas`). La tirada usa un generador propio de la
  partida (`dropRng`, semilla ^ 0x85ebca6b) y los objetos llevan ids aparte
  (`nextPickupId`): soltar uno no cambia lo que aparece después (sin objetos cogidos,
  la partida es idéntica a la de v8). Flotan `lifeS` 25 s y se cogen tocándolos con el
  casco (`radius` 16 + radio del barco); el imán de notas no los arrastra; tope `max`
  6 (el más viejo se hunde). Eventos `drop` y `pickup`; foto `pickups`, `flame`,
  `pickupsTaken`; `spawnPickup(item, x, y)` para pruebas y el atajo.
- **Imán total**: todas las notas del mar pasan a `magnet` y vuelan al barco.
- **Llama**: 10 s (`llama.durationS`), un sector de 110 u y ±0,45 rad delante del barco
  (sigue su rumbo; pasa sobre las islas). A un común o élite le quita su vida máxima en
  `killS` 0,4 s de contacto (cae justo al paso 24). **Bosses** (T137, ya en main): a
  los minibosses y bosses que toca el sector les hace el daño fijo de
  `bossFight.flameDps` (120/s, la cifra de T137, única fuente: `drops.llama` ya no
  lleva la suya) con `flameDamage(def, { maxHp, bossDps }, dt)` por `hurtTarget` de T141
  sobre `bossTargets` (cuerpos vulnerables y tentáculos del Kraken; nada si están
  invulnerables o sumergidos); `flameBosses` de T137 pasa por el mismo `flameDamage`.
- **Salvavidas** (objeto): achica `salvavidas.waterFraction` 0,4 de la capacidad (40 de
  agua), sin bajar de 0. La carta rara de T129 se llama ahora **«Segunda vida»** (sólo
  i18n: `survivors.salvavidas`, `mar.canon.equipo.salvavidas`; ids sin cambios).
- `SURVIVORS_CONFIG_VERSION` → 11 (main, con T137 y T141, estaba en 10; fusionado con main). Los pilotos (`bots.ts`) apuntan `drops` y `pickups`.
- **3D** (`apps/web/app/mar/engine/survivors-pickups.ts`, colgado de `SurvivorsView`):
  imán de herradura, brasero con llama y aro salvavidas, low-poly con el `Kit`, cada uno
  con un aro dorado en el agua; una `InstancedMesh` por tipo (tope `drops.max`); flotan
  con vaivén y giro y encogen sus últimos 3 s (sin parpadeo). La Llama: abanico de
  lenguas planas instanciadas (7 en alta, 4 en baja) y una mancha naranja en el agua,
  opacidad fija; con movimiento reducido, sin vaivén ni chisporroteo.
- **HUD**: bajo el nivel, «🔥 Llama: N s» con una barrita que se vacía
  (`data-testid="mar-canon-llama"`) mientras dura.
- **Atajo `&botin=1`** (`canonShortcut`, mismo interruptor que los demás; partida de
  prueba en `isDevStart`): toda élite suelta objeto (`lootConfig`, chance 1) y la
  partida empieza con los tres objetos a 90 u del barco (el primero delante). Gancho de
  pruebas: `data-botin` (cogidos), `data-botin-agua` (flotando), `data-botin-cerca`
  (el más cercano, «x,y») y `data-llama` (s que le quedan).
- Icono de la Traca en la fila de armas: 🎆 → 🧨.

Comandos:
- `pnpm exec vitest run packages/engine/src/survivors apps/web/app/mar --testTimeout=60000`
  → exit 0, 43 archivos, 519 pruebas, ya con T137 y T141 de main (nuevas:
  `survivors-drops.test.ts` 13, con la Llama contra un boss; `survivors-pickups.test.ts`
  4; más las del atajo y del HUD).
- Medido con los pilotos (codicioso, Tormenta, semillas 1–6): con el botín, la misma
  partida que sin él salvo la semilla 4 (cogió un Salvavidas a 3:52 y aguantó 8 s más);
  las pruebas de equilibrio de T132/T133 siguen en verde.
- `E2E_PORT=3473 pnpm e2e mar-canon.spec.ts --workers=1` (tras fusionar T141) → 54
  passed, 1 skipped, 1 failed: «HUD con BETA…» en escritorio (el nivel subió de 6 a 7
  entre leerlo y comprobar el texto, una carrera de la prueba); repetida sola → 1
  passed. En la pasada anterior falló una vez la rampa de T146 (también pasó sola). La
  nueva de `botin=1` pasa en móvil y escritorio.
- Comando de pruebas del plan → vitest 156 archivos / 1537 pruebas, checks OK, lint 0,
  build 0 (186,9 kB de 200), typecheck 0.

Pendiente:
- Toda cifra es `muestra` (5 %, 10 s, 40 de agua; 120 dps a bosses es de T137).

## 2026-10-05 — plan 012 T141: Boss final del acto 2: el Kraken (simulación)

Qué existe:
- **El Kraken** en la simulación pura, como boss final del acto 2 (`SURVIVORS_CONFIG.bosses.kraken`, `kind: 'boss'`, 1800 hp base × `bossHpScale` 1,5 del acto × dificultad, radio 56, sin cofre, nota grande 100, `ignoresIslands` porque bajo el agua pasa por debajo de las islas). Su hueco `boss` del acto 2 va **encendido** (`harderAct(…, { finalBossEnabled: true })`); el acto 1 sigue con sus tres huecos apagados. El acto 2 sólo se juega con `SurvivorsOptions.act = 2` (pruebas y atajos): la web no lo pasa nunca hasta la campaña (T144), así que producción no cambia más que por la huella de la config (versión 9 → **10**).
- Sus números van en `BossDef.kraken: KrakenDef` (`config.ts`): `emergeDistance` 240 / `emergeMinDistance` 110 (nunca sale justo debajo del barco), `minSubmergedS` 3 / `maxSubmergedS` 14, `submergedSpeedScale` 1,3, `emergeS` 1,2, `diveS` 0,8, `emergedS` 9, `exposeS` 4, `tentacle` (aviso 1,2 s, sube 0,3 s, arriba 5 s, 50 hp base escalados como el boss, radio 30, agua 18, `spread` 170, cada 3,5 s, `reach` 520), `grab` (`range` 420, agarrado 9 s, andanada cada 2,5 s, `exposesHead` true, rocas: vuelo 1,5 s, radio 60, agua 16, `spread` 150) y `phases` por fase (3 tentáculos sin agarre → 4 + 3 rocas con agarre → 5 + 4 rocas), con las fases genéricas por vida (0,65 y 0,3) y `speedScale` 1 / 1,15 / 1,3.
- `kraken.ts` (nuevo módulo, exportado): la máquina de estados `KrakenMode` = `submerged` (sombra que persigue al barco; no se le golpea ni moja) → `emerging` → `emerged` (salidas de tentáculos alrededor del barco: círculo de aviso, sube y moja a quien esté dentro —un golpe por salida—, se queda arriba como blanco de las armas; **tumbar uno expone la cabeza** `exposeS` s, la ventana de daño; si el barco se va más allá de `reach`, se hunde a perseguir) o `grabbing` (si la fase lo permite, la salida anterior no fue agarre y hay una **isla al alcance** —borde a ≤ `grab.range`, con agua a su lado—: emerge pegado a su borde y lanza andanadas de rocas con el círculo de caída avisado todo el vuelo; cabeza expuesta mientras) → `diving` → `submerged`. Las salidas se alternan (agarre, tentáculos, agarre…). Funciones: `createKraken`, `stepKraken`, `krakenVulnerable`, `krakenSolid`, `hurtTentacle`, `tentacleHittable`, `reachableIsland`, `clearKraken`, `krakenView`, `krakenWarnings`, `krakenHash`, `validateKraken` (lo llama `validateBoss`); la sim se lo da todo por `KrakenHost` (barco, azar de los bosses, `toWater`, golpes y sucesos).
- Lo que ve la pantalla (T142) y el HUD (T143): `BossView.kraken: KrakenView | null` (`mode`, `progress` 0→1 del modo, `exposed`/`exposedS`, `island` agarrada o −1, `tentacles[]` con `stage` warning/rising/up/down, `progress`, hp, `rocks[]` con origen, punto de caída y `progress` del vuelo); la posición del boss bajo el agua es la de la sombra; `invulnerable` true salvo con la cabeza expuesta. `bossWarnings` lleva un círculo (`kind: 'circles'`) por tentáculo avisando (`attack: 'tentaculos'`, `hit` true mientras sube) y por roca en vuelo (`attack: 'rocas'`). Sucesos nuevos (`KrakenEvent`): `krakenState` (cada cambio de estado, con `island`), `krakenTentacle` (warning/rise/down/destroyed), `krakenTentacleHit`, `krakenRock` (thrown con el punto de caída / landed), `krakenExposed`; más los genéricos `bossTelegraph`/`bossAttack` (`circles`, ataques `tentaculos`/`rocas`), `bossHit` con esos nombres, `bossDamaged`, `bossDefeated` (`kind: 'boss'`, `finalBossDefeated` true), `bossRetreated` al amanecer.
- Cambio pequeño en el sistema genérico (`sim.ts`): las armas ya no recorren `bosses` sino `bossTargets`, la lista de **partes golpeables** (el cuerpo de cada boss vulnerable y, en el Kraken, cada tentáculo arriba), rehecha tras mover los bosses en cada paso y al entrar o caer uno; `hurtTarget` reparte entre `hurtBoss` y `hurtTentacle` (tumbar un tentáculo mete la cabeza en la lista en el mismo paso). Los siete sitios (`nearestBoss`, `targetsInRange`, nubes, Focos/`targetById`, rayos, bolas, `hurtBossesCircle`/Llama) cambian sólo el recorrido. Además `bossInvulnerable` pregunta al Kraken, `contactDamage` salta la sombra, `stepBosses` cede al Kraken tras la máquina de fases, `stateHash` lleva `krakenHash`.
- Pruebas: `survivors-kraken.test.ts` (17): datos y validación; hueco del acto 2 encendido y el 1 sin bosses; sumergido no se le golpea (Llama ni bolas) ni moja y emerge sólido pero protegido; pasa bajo las islas y emerge en agua; emerge pasado `maxSubmergedS`; cada tentáculo avisa ≥ `telegraphS` antes de subir y moja uno por salida, sin golpes sin aviso; tumbar un tentáculo expone la cabeza y sólo entonces recibe daño, y la ventana se cierra; el cañón tumba tentáculos solo (`destroyed`, `krakenExposed`, `bossDamaged`); en archipiélago los tentáculos sólo salen del agua; agarre sólo a islas al alcance (mar abierto nunca, isla cerca sí con rocas, isla lejos no, pegado al borde); cada roca avisa con su círculo todo el vuelo y cae donde avisó; `exposesHead`; alternancia; fases por vida y derrota (`bossDefeated` kind boss, `finalBossDefeated`, sin cofre, nada del Kraken después); retirada al amanecer; partida entera del acto 2 determinista (2 semillas iguales, otra distinta; cada tentáculo y roca avisados); piloto quieto recibe golpes del Kraken. `survivors-bosses.test.ts`: la prueba de huecos en producción admite el del Kraken encendido en el acto 2.

Comandos:
- `pnpm exec vitest run packages/engine/src/survivors --testTimeout=60000` → exit 0, 9 archivos, 166 pruebas (17 nuevas).
- Test command, paso a paso: `pnpm exec vitest run --exclude "**/packages/db/**" --testTimeout=30000` → exit 0, 154 archivos, 1517 pruebas; `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0; `pnpm typecheck` → exit 0.
- e2e no corrido: la tarea no toca `apps/web` y el Kraken sólo sale en el acto 2, que la web no arranca.

Pendiente:
- La pantalla del Kraken (T142: sombra, cabeza, tentáculos desde los círculos, rocas con su círculo, agarre) y la barra/avisos del HUD (T143); el texto `survivors.boss.kraken` en i18n (fuera del alcance).
- Vencer al Kraken no acaba la partida todavía (como en T137: sin `EndReason` nuevo); el final especial y la medalla de oro son T144.
- Equilibrio con bots contra el Kraken (T147): los números son un primer ajuste (un barco quieto se moja; un piloto que esquiva puede librarse de todos los golpes).

## 2026-10-05 — plan 012 T137: Sistema genérico de bosses (simulación)

Qué existe:
- Bosses como datos en `SURVIVORS_CONFIG` (`packages/engine/src/survivors/config.ts`, versión 8 (T134) → **9**; al integrar con T134 los Focos también se fijan en bosses vulnerables): `BossDef` (aguante base, radio, velocidad e inercia, agua de contacto, `ignoresIslands`, nota grande `noteValue`, `chest`, `attacks`, `phases`), `BossAttackDef` con 5 formas (`ring` onda en anillo con huecos que las islas paran por sectores, `line` embestida recta, `circles` círculos que caen alrededor del barco, `broadside` andanada por los dos costados con disparos rectos que las islas paran, `summon` llamada por el sistema de aparición), cada una con aviso (`telegraphS`) y golpe (`activeS`), `invulnerable` y `still`; `BossPhase` (máquina de fases: por vida `untilHpFraction` y/o por tiempo `untilS`, destino `nextByHp`/`nextByTime` para ventanas que vuelven, movimiento `chase`/`orbit`/`still` con `standoff`, `invulnerable`, ataques en orden cíclico cada `attackEveryS`). `bossFight`: comunes al 0,7 de velocidad y el guion al 0,5 de ritmo con un boss vivo, entrada a 700 u por delante del barco, radio del cofre, `flameDps` 120 (gancho de la Llama, T135).
- Boss de pruebas `prueba` (miniboss, 600 hp, un ataque de cada forma, 3 fases con ventana invulnerable de 2 s a la mitad de vida). **Ningún hueco del guion lo llama**: los tres huecos siguen `enabled: false` con sus refs (`vecino`, `martillo`, `fantasma` / `kraken`), y un hueco cuyo boss no existe en `bosses` no hace nada; producción no cambia de comportamiento más que por la huella de la config. T138–T141 escriben su boss con esta plantilla y encienden su hueco.
- Actos como datos: `acts[0]` es `ACT_1`; `acts[1] = harderAct(ACT_1, …)` (acto 2: cangrejo 30 s antes, pirata y pez espada 60 s antes, `enemyHpScale` 1,25, `bossHpScale` 1,5, boss final `kraken`). `actOf(cfg, n)`, `bossHpFor(def, act, diff)` (= hp × acto × dificultad). `SurvivorsOptions.act` elige el acto (sin valor, 1; uno que no existe lanza error); `snapshot.act`.
- Simulación (`sim.ts`, sección «Bosses»): entidades aparte de los enemigos (la pantalla pinta los enemigos por `EnemyId`); los huecos encendidos sacan el boss a su segundo; el atajo `&t=` entra en la pelea del último hueco pasado (los anteriores se dan por pasados sin contar como vencidos); las armas hieren a los bosses (bolas, confeti, rayos, auras, boyas, cohetes y nubes los tienen por blanco: `nearestTarget`, `targetsInRange`); invulnerable, las bolas lo atraviesan y nada lo daña; al amanecer un boss vivo se **retira** (`bossRetreated`) y la partida se sobrevive; al caer: `bossDefeated`, nota grande, cofre flotante (`chest`) que se abre al tocarlo (`chestOpened`; su contenido es T139), `bossesDefeated` y `finalBossDefeated` en el snapshot (la medalla de oro es T144). Los ataques avisados mojan aunque el barco esté en los 0,5 s de gracia de un golpe de contacto (si no, un boss rodeado de pirañas no tocaría nunca); sólo la invulnerabilidad larga del Salvavidas los para.
- Snapshot y sucesos para pantalla y HUD: `bosses: BossView[]` (id, `boss`, `kind`, `nameKey`, posición, hp y `hpFraction`, `phase`/`phaseCount`, `invulnerable`, `attack`/`attackStage`), `bossWarnings: BossWarningView[]` (una forma por aviso: anillo con `gaps`/`gapRad`/`gapPhase` y `ringRadius` de la onda, línea, un círculo por círculo, una por costado; `progress` 0→1 en el aviso y otra vez en el golpe, `hit`), `chests`; sucesos `bossSpawn`, `bossPhase`, `bossTelegraph`, `bossAttack`, `bossSummon`, `bossHit` (attack null = contacto), `bossDamaged`, `bossDefeated`, `bossRetreated`, `chest`, `chestOpened`.
- `bosses.ts` (reglas puras, exportado): `inRingGap`, `ringRadiusAt`, `ringTouches`, `nextPhase`, `attackAt`, `phaseMarks` (marcas de la barra del HUD), `validateBoss`. Ganchos públicos de la sim: `spawnBoss(id, x, y)` (pruebas y atajos) y `flameBosses(x, y, r, dt)` (T135).
- `bots.ts`: `runBot` cuenta `bossHits`, `bossWater` y `bossesDefeated` (los golpes de boss suman a `hits`).
- Pruebas: `survivors-bosses.test.ts` (22): datos y huecos apagados en producción, acto 2, aguante por acto y dificultad, reglas puras, fases por vida y por tiempo con ventana invulnerable, armas contra el boss, cofre y nota grande, boss final, aviso antes de cada golpe (3 semillas, barco quieto, con golpes de ≥ 2 formas), anillo (progreso, islas, huecos), círculos, embestida (recorrido e isla), andanada (dos costados, islas), llamada bajo el tope, ataque invulnerable, hueco del guion y ritmo de los comunes, comunes más despacio, retirada al amanecer, atajo `&t=`, partida entera determinista, piloto. `survivors.test.ts`: la lista de actos ya no es `[1]` sino numerada seguida.

Comandos:
- `pnpm exec vitest run packages/engine/src/survivors --testTimeout=60000` → exit 0, 8 archivos, 149 pruebas (22 nuevas; tras integrar T134).
- Test command, paso a paso: `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 153 archivos, 1500 pruebas; `sh tools/spec/checks.sh` → exit 0 (OK); `pnpm lint` → exit 0; `pnpm build` → exit 0 (186,9 kB de 200 kB); `pnpm typecheck` → exit 0.
- e2e no corrido: la tarea no toca `apps/web` y ningún boss sale en una partida normal.

Pendiente:
- Los bosses de verdad (T138–T141) y encender sus huecos; el HUD (T143) y los avisos en el agua en 3D; el texto `survivors.boss.*` en i18n (fuera del alcance de la tarea).
- El fin de partida al vencer al boss final y las medallas (T140/T144): el snapshot ya lleva `finalBossDefeated`; no se añadió ningún `EndReason` porque el HUD de la web tiene un `Record<CanonEndReason, …>` exhaustivo.
- La nota grande sale como `redonda` (la figura mayor): la figura «clave de sol» pediría un modelo en la web (`NOTE_COLORS`/`NOTE_SIZE` son `Record<NoteFigure, …>`).
- `docs/spec/estado.md` no se tocó (fuera del alcance); T147 cierra documentación.

## 2026-10-05 — plan 012 T134: Redesign Fireworks and Festival laser

Qué existe:
- **Traca** (antes Fuegos artificiales; id `fireworks`, nueva forma `trail`): cada
  `cooldownS` (2,4 s) el barco suelta por la popa una ristra de `count` petardos (3),
  uno cada `dropEveryS` (0,12 s) y nunca a menos de `minSpacing` (24 u) del anterior:
  con el barco quieto no hay estela y no se amontonan. Cada petardo flota `durationS`
  (7 s) y estalla al tocarlo un enemigo: `damage` 36 en radio `area` 34 (evento
  `explode`). Niveles: +1 petardo, +16 daño, −0,6 s, +2 petardos; Rumba suma
  petardos. Tope nuevo `caps.crackers` (alta 48, baja 24; el más viejo se apaga).
  Foto: `snapshot.crackers`. Ya no hay cohetes (`rocket`) ni `weaponRng`.
- **Focos** (antes Láser de festival; id `laser`, forma `beam`): `count` focos (1→3)
  que se fijan en el enemigo más cercano a tiro (`range` 300, +80 a nivel 4), cada
  uno en uno distinto si puede, lo siguen mientras viva y esté a tiro y queman la
  mancha de radio `area` 24 cada `tickS` (5 de daño cada 0,25 s; +4 a nivel 3). La
  mancha pasa de blanco a blanco a `speed` 700 u/s (suave); sin blanco espera
  delante del barco. `BeamView` gana `spot` y `target`.
- **Show de Láseres** (Focos 5 + Techno, sin cambios en la pareja): 7 rayos en
  abanico de 1,6 rad delante del barco que barren de lado a lado (±0,7 rad, 0,5 Hz),
  alcance 440, 30 de daño cada 0,16 s (`effects.sweep`).
- Ninguno lo paran las islas. Vista: petardo low-poly instanciado (flota, se
  oscurece al apagarse; quieto con movimiento reducido), estallido pequeño y corto
  (`BURST_S` 0,45), haz en cono + mancha de luz instanciada
  (`survivors-laser-spots`), opacidad fija, más tenue con movimiento reducido.
  Textos de cartas en `es-mar.ts` (Focos, Traca, Show, Rumba).
- `SURVIVORS_CONFIG_VERSION` 7 → 8.
- Equilibrio: el piloto parado de Normal en la semilla 6 (archipiélago), que con
  T133 se inundaba a los 119 s, ahora aguanta con los Focos hasta sacar el Show
  (≈270 s). La prueba de T132 pasa a: como mucho una semilla de Normal pasa de
  los 120 s, ninguna de 330 s, y la comparación Tranquila/Normal usa la mediana
  de Normal.

Comandos:
- `pnpm exec vitest run packages/engine/src/survivors apps/web/app/mar/engine --testTimeout=60000` → exit 0 (348 tests)
- `E2E_PORT=3417 pnpm e2e mar-canon.spec.ts --workers=1` → exit 0 (53 passed, 1 skipped; `armas=1` con y sin movimiento reducido sin errores)
- Test command (pasos uno a uno) → vitest exit 0 (152 archivos, 1478 tests), checks.sh OK, lint 0 avisos, build OK (186,9 kB de 200), typecheck OK.

Pendiente:
- Los Focos y la Traca en las notas de prueba de la beta 3 (T148) y el icono del
  HUD de la Traca (`canon-hud-model.ts` sigue con 🎆).

## 2026-10-05 — plan 012 T133: Notas de la beta 2: armas más fuertes, evoluciones a mano

Qué existe:
- Daño de las armas (`SURVIVORS_CONFIG`, versión 6 → **7**), base y por nivel: Cañón de agua 10 → 16 y `cooldownS` 0,9 → 0,7 (nivel 2: +5 → +8); Subwoofer 6 → 10 (nivel 3: +4 → +6); Láser 8 → 12 (nivel 3: +5 → +8); Boyas 12 → 18 (nivel 2: +6 → +8, nivel 5: +10 → +12); Confeti 6 → 10 (nivel 3: +4 → +6); Fuegos 25 → 40 (nivel 4: +15 → +20); Lluvia ácida 7 → 12 (nivel 3: +5 → +8). Evoluciones: El Drop 28 → 40, Muro de Sonido 18 → 26, Show de Láseres 22 → 30, Bola de Discoteca 36 → 50. Los textos de las cartas con esas cifras, en `apps/web/lib/i18n/es-mar.ts`. Fuegos y Láser sólo cambian de daño (su rediseño es T134).
- Evoluciones a mano: `SURVIVORS_CONFIG.cardWeights` (`new` 1, `owned` 3, `pairedVinyl` 3) y sorteo ponderado sin reemplazo en `openCard` (`sim.ts`, `cardWeight`): subir lo que ya llevas y el vinilo pareja de un arma que llevas sin evolucionar salen 3 veces más que lo nuevo. Se eligió esto, y no la curva de experiencia ni la condición (nivel 5 + vinilo), porque el ritmo de niveles ya era bueno (T132) y el atasco era el sorteo a la par entre 16 cartas.
- Tormenta 1,3 / 1,3 / 1,4 → **1,6 / 1,6 / 1,6** (daño / aguante / cuántos): con las armas nuevas el piloto codicioso amanecía en las 6 semillas de Tormenta. Crecimiento del aguante de los enemigos (0,08 por minuto, T132) sin tocar.
- Pilotos (`survivors/bots.ts`): el `greedy` va a por una evolución (`focusWeapon`: sube primero su arma con evolución de más nivel, coge su vinilo pareja en cuanto sale) y va a por notas hasta 900 u (700 dejaba un hueco de 100 s sin subir en la semilla 5 de Normal, con notas caídas lejos por las armas de largo alcance). `runBot` mide además aparecidos (ids distintos), derrotados, `evolvedS` y `screenClearsS` (pantalla limpia: con ≥ 6 enemigos a < 600 u, el barco los deja a cero habiendo hundido al menos tantos); `killShare(run)`.
- `survivors-balance.test.ts`, bloque nuevo «armas más fuertes y evoluciones a mano (T133)»: por dificultad, el `greedy` hunde más que con la v6 y lo que queda sin hundir baja ≥ 30 % (referencia v6 medida, en la prueba); en Tranquila limpia la pantalla en los 2 primeros minutos en las 6 semillas; evolución antes de 5:00 en > la mitad y ≥ 4 de 6 semillas de Normal, Tranquila igual o más, Tormenta ≥ la mitad; las cartas de lo que ya llevas salen > 1,5 × lo de un sorteo a la par (400 semillas). Ajustes a pruebas viejas: barco parado en Normal < 120 s (era < 60 s); en Tranquila se inunda siempre en el mapa Arcilla y de media antes de la mitad (en el archipiélago denso, semilla 6, aguanta); el esquivador de la beta 1 ×2,5 el parado (era ×3); la prueba de la medusa para en el reparto en vez de a los 2,5 s.
- Guía de la beta 2: entrada en «Notas» con las palabras de Hernán y los valores cambiados; fila nueva `cardWeights` y Tormenta nueva en «Qué tocar y dónde».

Medido (6 semillas, `alta`, impares en Arcilla y pares en archipiélago; «hunde» = derrotados / aparecidos; «evo» = s de la primera evolución; «limpia» = pantallas limpias antes de 2:00):

| Dificultad | Piloto | Hunde v6 → v7 | Amanece v6 → v7 | Evo antes de 5:00 v6 → v7 | Evo por semilla v7 | Limpia < 2:00 v7 |
|---|---|---|---|---|---|---|
| Tranquila | greedy | 0,940 → 0,970 | 6 → 6 | 4 → 6 | 220 / 112 / 117 / 151 / 222 / 160 | 8 / 1 / 4 / 5 / 2 / 4 (v6: 3 semillas con alguna) |
| Normal | greedy | 0,916 → 0,964 | 6 → 6 | 3 → 6 | 199 / 92 / 107 / 128 / 264 / 156 | 7 / 1 / 2 / 3 / 1 / 0 |
| Tormenta | greedy | 0,798 → 0,908 | 3 → 3 | 1 → 5 | 169 / 87 / 115 / 118 / — / 172 | — |
| Tranquila | dodge | 0,750 → 0,829 | 6 → 6 | 0 → 0 | | |
| Normal | dodge | 0,675 → 0,816 | 3 → 5 | 0 → 0 | | |
| Tormenta | dodge | 0,544 → 0,646 | 2 → 3 | 0 → 0 | | |
| Tranquila | idle | 0,848 → 0,894 | 0 → 1 | | fin 150 / 147 / 100 / 161 / 123 / 420 | |
| Normal | idle | 0,609 → 0,827 | 0 → 0 | | fin 91 / 67 / 53 / 105 / 83 / 119 | |
| Tormenta | idle | 0,475 → 0,440 | 0 → 0 | | fin 24 / 23 / 29 / 26 / 25 / 21 | |

Normal sigue siendo pelea para quien no elige bien: el `dodge` acaba con agua 74 / 0 / 11 / 100 / 0 / 0 y se hunde en una semilla; el `greedy` recibe 0–10 golpes. Ritmo de niveles en Normal (`greedy`): 27–34 subidas por partida, hueco máximo ≤ 54 s.

Comandos:
- `pnpm exec vitest run packages/engine/src/survivors --testTimeout=60000` → exit 0, 7 archivos, 120 pruebas.
- Test command, paso a paso: `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 152 archivos, 1470 pruebas; `sh tools/spec/checks.sh` → exit 0 (OK); `pnpm lint` → exit 0; `pnpm build` → exit 0 (186,9 kB de 200 kB); `pnpm typecheck` → exit 0.

Pendiente:
- Que Hernán lo pruebe en Tranquila (push a Vercel, decisión 8 del plan): ¿se limpian las oleadas, llega la evolución?
- Los pilotos esquivan mejor que una persona; si en manos de Hernán Normal resulta fácil, el mando es `difficulties.normal.enemyHp` o los `hpScale` del guion antes que bajar las armas.
- e2e no corrido (la tarea no cambia la interfaz más que las cifras de los textos).

## 2026-10-05 — plan 012 T146: Plan 011 loose ends

- `mundo-arcilla.spec.ts` «tienda»: the test was stale, not the app. The store sheet links to the in-app merchandise page (`/tienda?from=mar`, a Next `Link`, testid `mar-merchandise-open`); the only `target=_blank` link in the sheets is WhatsApp. The test now checks that link and its href.
- `mar-decor.spec.ts:4` zoom: the app is right. Two zoom-out steps add 0.28 to a start zoom that depends on aspect (0.20 wide .. 0.26 portrait), so the bar settles at 46-52 % (47 % at 360x640); the test hardcoded 52|46 and read it while still easing. It now polls the settled value within 46..52.
- `minigame-layer.test.ts` «una partida perdida»: cause was the random session seed (`freshSeed`); an idle Faro sometimes wins on some seeds. The `browser()` helper now gives `LocalSessionAuthority` a fixed seed sequence. The assertions are unchanged.
- New e2e in `mar-canon.spec.ts`: sailing over `circuito-impulso-1` during a Cañón game raises `data-canon-speed` above 190 (turbo alone peaks ~170+); over `circuito-rampa-1` it sets `data-salto=aire` and then `agua` (splash).
- Commands: minigame-layer test x5 → 5 passes; `e2e mundo-arcilla mar-decor --workers=1` → 8 passed; `e2e mar-canon -g "impulso|rampa" --workers=1` → 4 passed.
- Pending: none.

## 2026-10-05 — plan 011 T132: Equilibrio con pilotos, rendimiento en `baja`, e2e, documentos y la guía de prueba de la beta 2

Qué existe:
- `packages/engine/src/survivors/bots.ts`: pilotos para medir el equilibrio contra la simulación pura (sin pantalla): `idle` (barco quieto, carta 0), `dodge` (huye de enemigos y disparos cercanos y se aparta de las islas, carta 0) y `greedy` (esquiva, va a por la nota más cercana cuando no hay enemigos a menos de 130 u y elige la carta que más puntúa: evolución > Salvavidas > arma nueva/nivel > vinilo pareja > House/Chill > resto). `runBot` mide fin, nivel y agua por minuto, enemigos vivos por tipo por minuto, subidas de nivel, golpes y agua por tipo. Deterministas.
- `survivors-balance.test.ts` (6 pruebas, 6 semillas: impares en el mapa Arcilla, pares en un archipiélago): el barco parado se inunda en todas las dificultades (Normal < 60 s; antes cuanto más difícil); en Normal el que esquiva llega a ≥ 4:00 siempre (media ≥ 5:30) y el codicioso a ≥ 4:30; Tranquila > Normal > Tormenta en puntuación media y en partidas que amanecen (Tranquila 6/6, Tormenta < 6/6) para `dodge` y `greedy`; ritmo de niveles en Normal (1.ª subida < 30 s, < 35 s por subida, ningún hueco > 90 s, nivel ≥ 8 a las 3:00); en `baja` el guion tardío enseña todos los tipos.
- Equilibrio (`SURVIVORS_CONFIG`, versión 5 → **6**): `levels` 5/5/0.6 → 3/2.5/0.25; `player.magnetRadius` 90 → 130; `growthPerMinute.hp` de los seis enemigos → 0.08 (eran 0.12–0.15); `hpScale` del guion más suave (pirañas 1/1.4/2/3 → 1/1.25/1.6/2.2; medusa, gaviota, cangrejo, pirata y pez espada igual, hacia 1.6–2 al final); `contactWater` cangrejo 14 → 10 y medusa 7 → 6. Motivo: con la v5 los niveles se atascaban (Normal, piloto codicioso: 1.ª subida a 36 s de media, ~62 s por subida, nivel 4–6 a los 7:00) porque el aguante de los enemigos crecía ~5× y las armas no daban abasto; ahora el ritmo es de ~20 s por subida y da para llegar a evoluciones.
- `EnemyDef.capShare` (nuevo, opcional) y piraña `capShare: 0.7`: lo que echa el guion de un tipo no pasa de esa parte del tope (en `baja`, 42 de 60 pirañas); la Marea no lo mira; lo que no cabe da fuerza a la oleada como con el tope lleno. El atajo `&t=` reparte el prellenado por turnos entre pistas (antes las pirañas, la primera pista, se quedaban todo el tope). Resuelve el hallazgo de T126 (en `baja`, `t=240`, semilla 5, sin cangrejos): ahora a `t=240/300/360` salen los seis tipos en las 8 semillas probadas, sin subir el tope.
- Arreglo en `sim.ts`: una nota arrastrada por el imán ya no puede quedar en tierra encajada entre dos islas (vuelve a donde estaba); salió con el imán más grande en «nada aparece ni se queda en tierra (archipiélago B, semilla 2)».
- La ayuda de las cartas cuenta las cartas que hay: `mar.canon.cartas.ayuda` = «Flechas o 1–{n}…» y `mar.canon.cartas.ayuda.una` con una sola carta (`canon-hud.tsx`).
- e2e `mar-canon.spec.ts`: «bucle de la beta 2: Tormenta, una evolución ofrecida, un arma nueva elegida y el turbo en marcha (T132)» (con `carta=surtido&dificultad=tormenta`; la ayuda dice 1–6) y «rendimiento en `baja`: a las 6:00 con los topes llenos y las siete armas…» (sólo en el proyecto móvil, `deviceMemory` 2, `t=360&armas=1`; p95 ≤ 100 ms sin limitar la CPU y la medida con CPU 4× apuntada).
- Documentos: guía nueva `docs/propuestas/2026-10-04-canon-beta2-guia-prueba.md` (qué hay, atajos con `dificultad=`, `armas=1`, `carta=surtido`, qué tocar y dónde, 7 preguntas, «Notas» vacía); `docs/spec/estado.md`: REQ-AVE-037 (beta 2, `sumergirse` decidido, pruebas nuevas), REQ-AVE-039 (beta 2) y REQ-ARQ-015 (medida del Cañón en `baja`), sin cambiar estados.

Curvas medidas (6 semillas, calidad `alta`; «fin» en s activos; el nivel por minuto es la media de las partidas aún vivas):

Config v6 (la nueva):

| Dificultad | Piloto | Amanece | Fin por semilla 1–6 | Agua final (si amanece) | Nivel a 1:00…7:00 | 1.ª subida (s) | s por subida |
|---|---|---|---|---|---|---|---|
| Tranquila | idle | 0/6 | 118 / 109 / 58 / 195 / 78 / 83 | — | 4 · 8 · 12 | 32 | 18 |
| Tranquila | dodge | 6/6 | 420 ×6 | 28 | 2 · 4 · 6 · 8 · 9 · 12 · 13 | 58 | 56 |
| Tranquila | greedy | 6/6 | 420 ×6 | 3 | 6 · 9 · 12 · 16 · 19 · 23 · 25 | 12 | 18 |
| Normal | idle | 0/6 | 52 / 26 / 36 / 56 / 36 / 38 | — | — | 17 | 16 |
| Normal | dodge | 3/6 | 291 / 342 / 420 / 420 / 420 / 296 | 13 | 2 · 4 · 6 · 8 · 10 · 9 · 11 | 67 | 49 |
| Normal | greedy | 6/6 | 420 ×6 | 17 | 5 · 9 · 12 · 16 · 19 · 21 · 22 | 17 | 21 |
| Tormenta | idle | 0/6 | 29 / 21 / 26 / 28 / 26 / 25 | — | — | 15 | 14 |
| Tormenta | dodge | 2/6 | 262 / 157 / 420 / 203 / 420 / 129 | 18 | 2 · 3 · 4 · 4 · 4 · 5 · 5 | 78 | 59 |
| Tormenta | greedy | 4/6 | 420 / 209 / 420 / 185 / 420 / 420 | 24 | 5 · 8 · 11 · 14 · 15 · 16 · 17 | 16 | 24 |

Config v5 (antes de T132, mismos pilotos):

| Dificultad | Piloto | Amanece | Fin por semilla 1–6 | Nivel a 1:00…7:00 | 1.ª subida (s) | s por subida |
|---|---|---|---|---|---|---|
| Tranquila | idle | 0/6 | 72 / 47 / 57 / 70 / 69 / 62 | 3 | 38 | 27 |
| Tranquila | greedy | 4/6 | 420 / 420 / 420 / 254 / 420 / 180 | 4 · 6 · 7 · 8 · 9 · 10 · 10 | 18 | 44 |
| Normal | idle | 0/6 | 26 / 25 / 34 / 30 / 32 / 31 | — | 23 | 24 |
| Normal | dodge | 4/6 | 420 / 297 / 420 / 420 / 420 / 228 | 1 · 2 · 3 · 3 · 4 · 4 · 4 | 102 | 188 |
| Normal | greedy | 1/6 | 338 / 232 / 263 / 165 / 420 / 188 | 2 · 3 · 5 · 4 · 4 · 5 · 6 | 36 | 62 |
| Tormenta | greedy | 0/6 | 172 / 136 / 224 / 170 / 202 / 183 | 2 · 3 · 2 | 54 | 106 |

Lectura: el que sólo esquiva (sin ir a por notas) sube poco de nivel en todas: es el «no veo las notas» de la beta 1; quien recoge notas sube cada ~20 s en Normal. El piloto `dodge` aguanta en Arcilla más que en los archipiélagos densos (más sitio para huir). En `baja` (Normal, codicioso) amanecen 6/6 y en el último minuto hay cangrejos y ≥ 4 tipos en todas.

Rendimiento:
- Simulación (Node, `t=360`, las 7 armas a nivel 5): 0,057 ms por paso en `baja` (56 enemigos) y 0,050 ms en `alta`; no es cuello de botella.
- Navegador de las e2e (Chromium, 360×640, `deviceMemory` 2 → `baja`, `t=360&armas=1`, 60/60 enemigos, 7 armas pintando): p50 16,7 ms, p95 33,4 ms, peor 100–117 ms; con la CPU 4×: p50 33,3 ms, p95 50 ms, peor ~860 ms. Ese pico único coincide con el fotograma en que se abre una carta de nivel (la partida está en pausa en ese momento; ~200 ms sin limitar la CPU). No se tocó: no es un punto caliente del juego en marcha.

Comandos:
- `pnpm exec vitest run packages/engine/src/survivors` → exit 0, 7 archivos, 116 pruebas.
- `PYTHONUTF8=1 python3 tools/spec/estado.py` → exit 0.
- Test command por pasos: vitest → exit 0, 152 archivos, 1466 pruebas; `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0; `pnpm typecheck` → exit 0.
- `E2E_PORT=3291 pnpm e2e mar-canon.spec.ts --workers=1` (main, antes de cambiar nada) → exit 0, 46 pasadas.
- `E2E_PORT=3291 pnpm e2e mar-canon.spec.ts --workers=1` (final) → exit 0, 49 pasadas, 1 saltada (la de rendimiento sólo corre en móvil). La primera vuelta falló «ya tarde (`t=` pasadas las 3:30) salen en pantalla los seis enemigos» (móvil y escritorio: faltaban medusa y pirata): con el barco parado se inunda en ~20 s, antes de que las medusas lentas y los piratas (se paran a 320 u) entren en la vista. La prueba ahora navega con la flecha (lo reciclado sale por delante) y contesta las cartas: pasa en ~22 s.
- `E2E_PORT=3292 pnpm e2e --workers=2` (suite completa) → exit 1: 414 pasadas, 86 saltadas, 6 fallidas. Repetidas solas (`--workers=1`): pasan 4 (`mar-canon` «HUD con BETA…» y «llegar al amanecer…», `mar-circuito` «fuera de la carretera…», `mar-decor` en escritorio: carga con 2 trabajadores). Siguen fallando 3, ajenas al Cañón y a los archivos de T132: `mundo-arcilla.spec.ts:57` «tienda: enlace externo en otra pestaña» (móvil y escritorio: la ficha de la tienda no tiene ningún `a[target=_blank]`) y `mar-decor.spec.ts:4` «Santa Bárbara loads…» en móvil (el zoom queda en `height: 47%` y la prueba espera 52 o 46 %).

Pendiente:
- Medir en un iPhone 11 y un Android de gama media con `t=360&armas=1` (lo pide la guía, pregunta 7).
- Las flechas de impulso y las rampas dentro de la partida sólo tienen pruebas unitarias (T124, `turbo-ramps.test.ts`); el e2e cubre el turbo.
- El pico al abrirse una carta con la CPU 4× (ver Rendimiento), si en el móvil se nota.
- Las dos e2e ajenas que fallan en la suite completa (`mundo-arcilla` tienda, `mar-decor` zoom en móvil): mirar si fallan también en main.

## 2026-10-05 — plan 011 T130: Upgrade interface: new cards and the weapons/vinyls row

Qué existe:
- Cartas de nivel con las siete clases de oferta de T129 (arma nueva, nivel de arma, vinilo nuevo, nivel de vinilo, evolución, Salvavidas, achique de reserva). Cada una: icono por arma/vinilo/evolución, etiqueta de clase, nombre, lo que da («Nivel 3: +1 bola por disparo», texto por clave de `es-mar.ts`), puntos de nivel y «Nueva» / «Nivel n de 5» / «¡Máximo!». La evolución destaca (fondo dorado, borde grueso, etiqueta oscura). La clave de React y `data-carta` es el `id` de la opción (antes el alias `upgrade`, que ya no es único); `data-mejora` se mantiene y `data-tipo` dice la clase. El teclado y el tacto de las cartas no cambian.
- Fila de armas y vinilos (`CanonSlots` en `canon-hud.tsx`, modelo `slotsView`/`slotsKey` en `canon-hud-model.ts`): 4 + 4 huecos con icono y nivel (estrella dorada si el arma evolucionó, borde de color si está al máximo) y la insignia del Salvavidas si está a bordo. Abajo al centro encima de la barra en escritorio; arriba a la izquierda, bajo el minimapa, en móvil. No toma eventos; no pisa la cuenta atrás compacta de T123, «Entradas», los saldos, el minimapa ni el turbo (lo comprueba el e2e).
- Atajo de desarrollo `&carta=surtido` (`mixConfig`, `SurvivorsRun.devMixCard`, sólo con los atajos encendidos): config recortada (3 armas, 2 vinilos, evolución El Drop, Salvavidas siempre) y Cañón a nivel 5 + Subwoofer + Hardstyle, para abrir una carta con una opción de cada clase. `&carta=1` queda igual.
- Textos nuevos por clave en `apps/web/lib/i18n/es-mar.ts` (`mar.canon.carta.tipo.*`, `mar.canon.equipo.*`, `mar.canon.cartas.maximo`), `muestra`.

Comandos:
- `pnpm exec vitest run apps/web/app/mar/canon-hud-model.test.ts` → exit 0, 19 tests (incluye: cartas por clase con textos e icono, la evolución en la fila, la fila y su clave, textos sin huecos).
- `E2E_PORT=3141 pnpm e2e mar-canon.spec.ts --workers=1 -g "T130|carta de nivel"` → exit 0, 8 passed (móvil y escritorio: fila abajo/arriba-izquierda sin tapar «Entradas», carta=surtido con las seis clases y la evolución destacada, cartas con teclado y con dedo). El archivo entero (46 tests) no se terminó aquí por lentitud de la máquina: lo corre el orquestador.
- Test command: vitest 1460 passed (151 files), checks.sh OK, lint 0, typecheck 0, build 0.

Pendiente:
- El `pnpm e2e` completo de la ronda lo corre el orquestador al final del plan.
- El texto de ayuda de las cartas dice «1–3» (fijo); con `carta=surtido` hay 6 opciones, sólo de desarrollo.

## 2026-10-05 — plan 011 T128: Cómo se ven las armas en el mar 3D

Qué existe:
- `apps/web/app/mar/engine/survivors-weapons.ts`: `SurvivorsWeapons`, un
  `InstancedMesh` (una llamada de dibujo) por arma más los destellos de la
  Bola de Discoteca y las explosiones; los topes salen de las `caps` de la
  calidad y de las tablas de nivel/evolución (con Rumba); un grupo vacío se
  oculta (sin llamada de dibujo, como en T126). Cañón: bolas; Subwoofer: dos
  anillos que viajan con el pulso; Láser: franja plana desde el barco hasta
  su alcance, alfa fija (sin parpadeo); Boyas: boya BOIA de bajo poligonaje;
  Confeti: tres serpentinas; Fuegos: cohete en vuelo + explosión (anillos y
  rayos) por el evento `explode`; Lluvia ácida: charco verde, nube y cortina,
  que se apaga en color (no en alfa) al acabarse. Evoluciones: la misma
  silueta más grande y con tinte dorado; El Drop explota en azul.
- Alturas `WEAPON_Y`: lo que pasa sobre las islas (láser, boyas, cohetes,
  nube) sube con el suelo (`groundAt` de la vista); auras y charcos en el agua.
- Movimiento reducido (REQ-AVE-039): anillos quietos marcando el borde,
  boyas sin balanceo ni giro, explosiones a tamaño fijo, láser más tenue
  (sigue girando: es el ataque).
- Atajo de desarrollo `&armas=1` (tras el interruptor de atajos): la partida
  empieza con las 7 armas a nivel máximo, sin tocar la config compartida;
  cuenta como partida de prueba. `canon-mode.tsx` sólo pasa el atajo.
- `data-canon-armas`, `data-canon-armas-vista`, `data-canon-armas-vistas` en
  el lienzo (instancias pintadas, no inventario) para las pruebas.
- e2e `mar-canon.spec.ts`: partida con todas las armas (normal, y móvil en
  `baja` con movimiento reducido) sin errores de consola; la prueba de
  «Barco inundado» contesta ahora las cartas de nivel (con las armas de la
  beta 2 se sube de nivel sin timón y la carta paraba la partida).

Comandos:
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 151 archivos, 1452 pruebas (tras unir main con T131)
- `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm typecheck` → exit 0; `pnpm build` → exit 0
- `E2E_PORT=3871 pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, 42 pasadas (tras unir main con T131)

Pendiente:
- Medir en un iPhone 11 la partida con `&armas=1` en `baja` (T132).

## 2026-10-05 — plan 011 T131: Three difficulties chosen on the island panel

Qué existe:
- `SURVIVORS_CONFIG.difficulties` (`tranquila` / `normal` / `tormenta`, ids en `DIFFICULTY_IDS`, por defecto `normal`): multiplicadores `enemyDamage` (agua por golpe, contacto y disparos), `enemyHp` (aguante al aparecer, también élites; los trozos de medusa lo heredan) y `enemyCount` (grupos por segundo del guion y anillos de la Marea; el tope por calidad sigue mandando). Valores `muestra`: tranquila 0,7 / 0,8 / 0,75; normal 1 / 1 / 1; tormenta 1,3 / 1,3 / 1,4. Config v5.
- `createSurvivors(…, { difficulty })`; el snapshot lleva `difficulty`. Misma semilla + dificultad = misma partida. Premio, `won` y duración no cambian.
- Sesión: `canonConfigFor(cfg, difficulty)` mete la dificultad en `survivors.difficulty`, así que entra en el `configHash` de la sesión (`world-canon.ts`).
- Panel de la isla: `CanonDifficultyPicker` (grupo de opciones con tres botones, Normal marcada, flechas y Tab, 44 px de alto para el dedo) sobre «Jugar», por la nueva prop `extra` de `MinigameLayer`. La elección se recuerda mientras dure la visita (estado del hook, `useCanonMode`), también para «Otra vez». El bloqueo en carrera sigue explicado igual.
- Atajo de desarrollo `&dificultad=tranquila|normal|tormenta` (`CANON_PARAMS.difficulty`, mismo `devShortcutsEnabled`; se consume de la URL y se recuerda). No cuenta como partida de prueba para el premio.
- `data-dificultad` en `mar-canon` (hook de pruebas). Textos por clave en `es-mar.ts` (`mar.canon.dificultad.*`, `survivors.dificultad.*`).

Pruebas:
- `packages/engine/src/survivors/survivors-difficulty.test.ts` (daño, aguante, número, determinismo, huella de la sesión); `apps/web/app/mar/survivors.test.ts` (atajo).
- e2e `mar-canon.spec.ts`: dos pruebas nuevas (panel con Normal marcada, teclado, Tormenta empieza una partida Tormenta; atajo).

Comandos: ver el informe final de la tarea (resultados al integrar).

Pendiente: nada de esta tarea; la ventana previa a la partida completa sigue siendo de la beta 4.

## 2026-10-05 — plan 011 T126: Models and effects for the new enemies

What exists:

- `apps/web/app/mar/engine/survivors-props.ts`: low-poly code models (`Kit` + palette `C`) for the
  **seagull** (white body, wide grey wings with black tips; a wide cross seen from above),
  the **pirate in a small boat** (dark wooden boat, red/white striped shirt, black tricorne,
  yellow water pistol with a blue tank, black stern flag), the **swordfish** (long blue body,
  long pale sword, tall sail fin) and the **jellyfish** (lilac glowing bell, rim and trailing
  tentacles; its halves use the same piece scaled by `EnemyView.scale`). Also the enemy
  water-pistol shot (pink jet, distinct from the light-blue player ball), the elite halo
  (gold ring), the swordfish warning line (flat strip with an arrow tip) and a shadow disc
  for flyers. `ENEMY_MODELS` now covers all 6 enemies (`fly`, `pulse`, `glow` fields).
- `survivors-view.ts`: one `InstancedMesh` per enemy type, plus one each for enemy shots,
  elite halos, gull shadows and warning lines (2 instances per telegraph: dark track +
  bright fill growing with `progress`, colours per instance). Gulls fly 3.2 scene units above
  the ground under them or a little ahead (`groundAt` from `Mar3D`), rising fast and
  descending slowly, so they cross islands above them. Empty meshes are `visible = false`
  (no draw call): in `baja` only types on screen are drawn. Both defeat styles work for every
  type: the size comes from the defeated enemy (small jellyfish halves sink small) and gulls
  fall from their altitude (`puf` bursts at their height). Reduced motion: no bob, bank,
  jellyfish pulse or halo pulse; the warning line never flashes in either mode.
- `mar3d.ts` (survivors render only): passes `groundAt` to the view and, every 0.25 s, writes
  the enemy types inside the camera view (wrap + planet curve + frustum + horizon) to
  `data-canon-vista` (now) and `data-canon-vistos` (whole game) on the canvas, for tests.
- Tests: `survivors-props.test.ts` +16 tests (each new model's colours and silhouette,
  jellyfish glow, shot and warning-line geometry, all types drawn late in a game, empty
  meshes not drawn, gull altitude over an island with shadow, jellyfish halves smaller,
  elite halos incl. gull, reduced motion, warning line length/fill/heading/colours in both
  motion modes, a real game telegraphs before charging, enemy shots, both defeat styles for
  every type, half-jellyfish sink size). `survivors.test.ts` piece count now includes halos,
  shadows, enemy shots and warning lines. `mar-canon.spec.ts`: new test starting at
  `t=240&seed=7` that waits until all six enemy types have been on screen
  (`data-canon-vistos`) with no console errors (desktop and mobile).

Commands and results:

- `pnpm exec vitest run apps/web/app/mar/engine/survivors-props.test.ts` → exit 0, 34 passed.
- `E2E_PORT=3197 pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, 34 passed (5.4 min).
- `PYTHONUTF8=1 pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0,
  147 files, 1371 passed.
- `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0;
  `pnpm typecheck` → exit 0.

Pending:

- Weapons are not rendered (T128).
- In `baja` (cap 60 enemies) a late game can lack some types (e.g. crabs at `t=240`, seed 5)
  because piranhas fill the cap: sim balance, for T132.

## 2026-10-05 — plan 011 T129: Vinyls, slots, evolutions and the Salvavidas

### What exists

- Config version **4** (exactly 3 → 4). Nine vinyls, each with five explicit incremental levels: Techno (attack rate), Reggaetón (area), House (water resistance), Drum & Bass (boat speed), Disco (magnet), Chill / Ambient (bailing), Hardstyle (damage), Pop (XP), Rumba (+1 projectile per level for compatible weapons; also disco flashes).
- Configured **4 weapon + 4 vinyl slots**, enforced by both public inventory APIs and the pure card-pool builder. Equipment upgrades stop at the source definition's maximum level. Normal offers contain up to three distinct canonical cards; a single emergency-bailing card remains available when the inventory is fully maxed and no evolution is eligible. Fallback removes `config.fallback.waterRemoved` water immediately (25 in this muestra config).
- Four evolution replacements in the same weapon slot: El Drop (straight balls explode in area; islands stop balls), Muro de Sonido (larger aura and real push with island collision), Show de Láseres (four rotating rays), Bola de Discoteca (giant orbital with actual damaging projectile flashes). Their final stats and effects live in `EvolutionDef.evolvedWeapon`, use `WeaponDef` / `resolveWeaponStats`, and retain the base weapon ID for rendering. Vinyl modifiers apply to the replacement too.
- Shared exported `eligibleEvolutions(config, inventory)` checks max-level weapon + its held vinyl and excludes already evolved weapons. `config.evolutionSource` is `level-up` in beta 2; `chest` disables evolution level cards while preserving the shared eligibility hook and `game.evolveWeapon(id)` for beta 3. An eligible evolution is guaranteed a place in an offer (random choice among eligible evolutions).
- **Salvavidas is a rare level-up card**, not a pickup or an equipment slot. The seeded card RNG rolls `offerChance` (3% per offer while absent); it is included when the offer has room after its evolution. Once acquired it can never be offered/acquired again, including after consumption. At flooding it changes held → consumed, sets water to the configured fraction (25%), gives the configured invulnerability (2 s), and emits one `saved` event. Later flooding ends the run normally.
- Old beta-1 upgrades no longer participate in offers. Their config metadata and snapshot/card fields remain as transitional compatibility aliases. `snapshot.upgrades` is a selection counter by legacy icon alias (including successful fast-forward selections), not equipment levels and not a source of stat bonuses. Spanish names, initial descriptions, all weapon levels 2–5, all vinyl levels 1–5, evolution descriptions, Salvavidas and fallback texts exist in `apps/web/lib/i18n/es-mar.ts`, explicitly marked **muestra**. Legacy `.efecto` aliases let the current HUD resolve descriptions until T130 switches to the new fields.
- Seeded offers, inventory and evolution state, Salvavidas state and canonical card IDs/target levels participate in deterministic replay/state hashing. The `&t=` fast-forward uses the same inventory/card application rules.
- New `survivors-vinyls.test.ts` covers slots, always-available offers/fallback, each pairing's positive/negative conditions, actual evolution behavior, real weapon/boat modifiers, one-use rescue, text coverage and cloned-snapshot replay with a scripted card bot. Existing old-upgrade tests now select vinyls. The seven-weapon stress fixture explicitly expands test-only slots using catalog length. Land-defeat checks exempt flying enemies, matching the existing live-enemy exemption, while every dropped note remains checked on water.

### Commands and results

- `pnpm exec vitest run packages/engine/src/survivors --testTimeout=30000`: PowerShell initially rejected `pnpm.ps1`; using `pnpm.cmd` then reached Vite but its optional Windows `net use` probe failed with synchronous `spawn EPERM` before loading tests.
- Verified the workspace, Vitest and TypeScript resolve to local paths. With a temporary exact-`net use` adapter returning an error through Vite's existing callback, native config loading and worker threads, `node --require ./packages/engine/src/survivors/.t129-vitest-preload.cjs node_modules/vitest/vitest.mjs run packages/engine/src/survivors --testTimeout=30000 --configLoader native --pool threads`: **5 files, 103 tests passed**. The adapter delegates every other command unchanged; it does not modify dependencies or simulate successful checks. First full execution identified the flying-enemy assertion described above; rerun passed.
- `pnpm.cmd typecheck`: blocked by the sandbox's `spawn EPERM` when pnpm launches workspace child shells. Equivalent direct checks, `node node_modules/typescript/bin/tsc -p <project>/tsconfig.json --incremental false`, passed for **packages/engine, packages/contracts, packages/db, packages/store, packages/world, apps/web**. No UI changes were needed.
- Final compatibility run: with `NODE_OPTIONS=--require ./packages/engine/src/survivors/.t129-vitest-preload.cjs`, `pnpm.cmd exec vitest run packages/engine/src/survivors apps/web/app/mar/canon-hud-model.test.ts apps/web/app/mar/survivors.test.ts --testTimeout=30000 --configLoader native --pool threads`: **7 files, 143 tests passed** (the 103 survivors tests plus 40 untouched HUD/adapter tests).
- `pnpm.cmd lint`: **passed**, including the final run after removing the temporary adapter. The final engine/web direct typechecks also passed after the compatibility correction.
- Only the two new TypeScript files were formatted with Prettier. Existing files retained their original LF line endings and untouched code was not reformatted. No git commands were run.

### Snapshot / offer contract for T130

- `snapshot.weapons[]`: `{ id: WeaponId, kind, level, maxLevel, evolutionId: EvolutionId | null, nameKey, stats: WeaponStats, cooldownS }`. Evolution IDs are `drop`, `soundWall`, `laserShow`, `discoBall`; base IDs remain `canon`, `subwoofer`, `laser`, `buoys`. Existing `auras`, `beams`, `orbitals`, `projectiles`, `zones` stay available. Player projectiles also expose `evolutionId` (including disco flashes with base `weapon: 'buoys'`, `kind: 'orbit'`). Join other effect views with the held weapon by base ID to choose an evolved model.
- `snapshot.vinyls[]`: `{ id: PassiveId, level, maxLevel, nameKey }`, in acquisition order. `snapshot.slots`: `{ weapons: 4, vinyls: 4 }` from config. `snapshot.stats` contains the summed vinyl modifiers already applied to boat/weapons.
- `snapshot.salvavidas`: `'absent' | 'held' | 'consumed'`. Events: `{ type: 'saved', item: 'salvavidas', x, y, water }`; evolution choice emits `{ type: 'evolved', weapon, evolutionId }`.
- `snapshot.card`: `null | { level, options: CardOption[] }`. Each option has unique **`id`**, **`kind`**, **`targetLevel`**, **`nameKey`**, **`textKey`**, **`gains`**; relevant IDs are `weaponId`, `vinylId`, `evolutionId`. Kinds: `weapon-new`, `weapon-level`, `vinyl-new`, `vinyl-level`, `evolution`, `fallback`, `salvavidas`. Weapon-level gains are the source weapon's exact stat deltas; vinyl gains are `{ stat, amount }`; fallback also has `waterRemoved`. Initial/evolution weapon numbers remain available from config, and held resolved numbers from snapshot.
- Render the title using `nameKey`, description using `textKey`, and React identity using **`id`**. `gains` describes fixed increments, not accumulated totals. `nextStack/maxStacks` mirror target/max levels only for legacy consumers. **Do not use `upgrade` as an identity**: it is a six-value legacy icon alias and multiple new cards can share it. T130 must replace that existing UI key/icon lookup and render the vinyl/Salvavidas state. The `.lN.card` / `.efecto` compatibility texts are for that interim HUD; the canonical name/text keys are the intended new API.
- Public deterministic APIs: `addWeapon`, `levelUpWeapon`, `weaponLevel`, `heldWeapons`; `addVinyl`, `levelUpVinyl`, `vinylLevel`, `heldVinyls`; `evolveWeapon`, `addSalvavidas`. `buildCardPool` and `eligibleEvolutions` are exported from the survivors barrel. Keep snapshots cloned if retained across steps: the simulation still reuses its view.

### Pending

- T130 owns the UI rendering and canonical card identity/icon migration; no `apps/web/app/**` files were changed. Beta 3 owns chests/miniboss integration.
- The exact default pnpm test/typecheck runners require process-spawn support unavailable in this sandbox. The same selected tests and all workspace TypeScript projects passed through the alternatives above.
- Final architect review completed; its compatibility counter, terminal-evolution documentation/level-up guard, and Rumba text findings were fixed and verified. The temporary test adapter was removed. No T129 implementation remains pending.

## 2026-10-05 — plan 011 T127: Weapon system: the six new weapons with per-level tables (simulation)

Qué existe (sólo `packages/engine/src/survivors/`; nada en `apps/web`):

- `config.ts` (`SURVIVORS_CONFIG_VERSION` 2 → 3): **sistema de armas por datos**. `WeaponKind` (`projectile`, `cone`, `aura`, `beam`, `orbit`, `rocket`, `zone`); `WeaponStats` con los diez números que una forma puede usar (`damage`, `cooldownS`, `tickS`, `count`, `area`, `range`, `speed`, `spreadRad`, `pierce`, `durationS`; qué significa cada uno por forma está documentado en el tipo); `WeaponDef` = `{ id, kind, i18nKey, maxLevel, base, levels, blockedByIslands, extraProjectilesApply }` con **tabla fija por nivel**: `base` son los números a nivel 1 y `levels[i]` (niveles 2…5) lleva `i18nKey` y `gains: {stat, amount}[]`, lo que la carta dice tal cual («Nivel 3: +1 boya»). `weaponStatsAt(def, level)` suma la tabla; `resolveWeaponStats(def, level, mods)` aplica encima `WeaponModifiers` (`damageBonus`, `fireRateBonus` acorta `cooldownS` y `tickS`, `areaBonus`, `extraProjectiles` sólo donde `extraProjectilesApply`): **el gancho para los vinilos y evoluciones de T129** (una evolución puede ser otra `WeaponDef`). `QualityCaps.areas` (12 alta / 6 baja) para las nubes.
- Las 7 armas del diseño (§5), claves `survivors.weapon.<id>` y `.l2`…`.l5` (textos: T129/T130): **Cañón de agua** (`projectile`, 10 daño, 0,9 s, 1 bola; L2 +5 daño, L3 +1 bola, L4 −0,2 s, L5 +1 atraviesa; recto, las islas lo paran), **Subwoofer** (`aura`, 6 daño cada 0,5 s a 110 u; L2 +20 u, L3 +4 daño, L4 +25 u, L5 −0,15 s), **Láser de festival** (`beam`, 8 daño cada 0,25 s, largo 260 u, medio ancho 10 u, gira a 1,6 rad/s; L2 +60 u, L3 +5 daño, L4 −0,05 s, L5 +1 rayo), **Boyas orbitales** (`orbit`, 2 boyas de 14 u a 70 u girando a 2,2 rad/s, 12 daño cada 0,4 s; L2 +6 daño, L3 +1 boya, L4 +4 u, L5 +10 daño), **Cañón de confeti** (`cone`, 5 confetis en abanico de 0,22 rad hacia el rumbo del barco, 6 daño, 1,4 s, atraviesan 1; L2 +2, L3 +4 daño, L4 −0,3 s, L5 +1 atraviesa; recto, las islas lo paran), **Fuegos artificiales** (`rocket`, 1 cohete a un enemigo al azar a 700 u que explota en 60 u con 25 daño, 2,2 s; L2 +15 u, L3 +1 cohete, L4 +15 daño, L5 −0,6 s; sigue al blanco por encima de las islas, estalla donde está si el blanco cae), **Lluvia ácida** (`zone`, nube de 90 u sobre el enemigo a tiro con más vecinos, 7 daño cada 1 s durante 4 s, cada 5 s; L2 +25 u, L3 +5 daño, L4 +2 s, L5 −1,5 s). Auras, rayos, boyas, cohetes y nubes pasan por encima de las islas.
- `sim.ts`: `WeaponSlot` por arma (def, nivel, números resueltos, relojes de disparo y de tic, ángulo de giro); `stepWeapons` despacha por forma (`fireAtNearest`, `fireCone`, `fireRockets`, `castZones`, aura/`hurtBeams`/`hurtOrbitals` por tic); `stepZones`; los proyectiles llevan `weapon`, `kind`, `blocked` (sólo lo recto choca con islas) y los cohetes `target`/`burst`; `hurt`/`hurtCircle` comunes; azar propio `weaponRng` (semilla ^ 0x7f4a7c15) para los blancos de los cohetes, así el guion no se mueve. Mando: `addWeapon(id, level?)`, `levelUpWeapon(id)`, `weaponLevel(id)`, `heldWeapons`; las mejoras de la carta (`apply`) rehacen los números de todas las armas. El tope de huecos (4 armas) lo pone T129 al ofrecer cartas.
- **Instantánea**: `weapons` (`{id, kind, level, maxLevel, stats, cooldownS}`), `auras` (`{weapon, x, y, radius, progress}`), `beams` (`{weapon, x, y, angle, length, halfWidth}`), `orbitals` (`{weapon, index, x, y, radius, angle}`), `zones` (`{id, weapon, x, y, radius, lifeS, durationS, progress}`); `projectiles` pasa a `PlayerProjectileView` (suma `weapon` y `kind`: bola, confeti o cohete). **Sucesos**: `fire` lleva `weapon`; nuevo `explode` (`{weapon, x, y, radius}`). `stateHash` cubre armas, relojes, ángulos, nubes y blancos.
- Pruebas en `survivors-weapons.test.ts` (18): tabla (7 armas, 5 niveles, cada nivel cambia algo, sólo lo recto bloqueado por islas; la suma nivel a nivel; el gancho de modificadores en las 7, Rumba sólo en bolas/confetis/cohetes, un tiempo nunca baja de un paso; en partida una mejora rehace los números y subir de nivel aplica la tabla encima), y una por arma: cañón al más cercano con 2 bolas a L3; aura golpea por tic a través de una isla y el L2 llega más lejos; láser barre la vuelta por encima de una isla, L2 más largo, L5 dos rayos opuestos, gira a su velocidad; boyas pegan en la órbita, 3 desde L3, cruzan una isla; confeti pega delante y no detrás, L2 más confetis, una isla lo para (`blocked.owner: 'player'`); cohetes vuelan sobre una isla, explotan en área (L2 mayor) sobre el blanco, blancos al azar deterministas por semilla, estallan donde están si el blanco cae; nube sobre el grupo más apretado tras una isla, dos tics medidos, se deshace al acabar, tope `areas` de alta y baja se toca y no se pasa. Partida entera de 7:00 en `baja` con las 7 armas a L5: determinista (hash cada 10 s y al final), dentro de los topes, y **cae al menos un enemigo de cada uno de los 6 tipos** (con el cañón solo, T125 sólo tumbaba pirañas y gaviotas). `survivors.test.ts`, `survivors-beta2.test.ts` y `turbo-ramps.test.ts` (T124) pasan a `weapons.canon.base.damage`.

Comandos:

- `pnpm exec vitest run packages/engine/src/survivors --testTimeout=120000` → exit 0, 4 archivos, 81 pruebas (con `turbo-ramps.test.ts` de T124) (la partida de 7:00 con las 7 armas tarda ~3 s; lleva timeout propio de 120 s).
- `pnpm --filter @boia/engine exec tsc --noEmit -p .`, `pnpm --filter @boia/web exec tsc --noEmit -p .` → exit 0 (la pantalla sigue leyendo `projectiles` tal cual).
- Comando de prueba del plan, paso a paso (el guardián bloquea la cadena): vitest sin `packages/db` con timeout 30 s → exit 0, 148 archivos, 1373 pruebas; `sh tools/spec/checks.sh` → OK (exit 0); `pnpm lint`, `pnpm build`, `pnpm typecheck` → exit 0.

Pendiente / observaciones:

- Los textos de las claves `survivors.weapon.*` no existen aún en `apps/web/lib/i18n/` (fuera del alcance: T129 trae las cartas de armas y T130 las pinta).
- La pantalla (`survivors-view.ts`) pinta todo `projectiles` como bolas del cañón: confetis y cohetes salen como bolas hasta T128, que además pinta auras, rayos, boyas y nubes desde la instantánea.
- Los números de las tablas son un punto de partida razonable; el equilibrio real es de T132 (bots).
- `fastForward` (`&t=`) no da armas nuevas: el atajo de desarrollo para empezar con armas lo decide T128/T129.

## 2026-10-05 — plan 011 T124: Turbo, boost arrows, jump ramps and race buoys inside the game

Implemented in files; no git commands run.

What exists:

- `ship/boost.ts` now owns the existing turbo physics and its 2.4 s duration / 7 s cooldown / 1.6 speed multiplier. `circuit/index.ts` exports it; `steering.ts` reexports the existing helper API without changing sailing/race behavior.
- `circuit/interactives.ts` selects active boost collisions, ramps and checkpoint buoys and strips other behaviors. `survivorsWorldOf` supplies this data to the game. The isolated `WorldRuntime` reuses existing impulse strength, duration, contact hysteresis, wrapping and strongest-boost handling. Checkpoints do not feed the race or rewards. Existing solid obstacles and restitution remain shared; lane buoys retain their nonblocking behavior.
- New `survivors/movement.ts` owns deterministic turbo timers and `BoatJump`, advanced only on active fixed steps. `SurvivorsInput.turbo` records presses; snapshot/hash include movement. `sim.ts` changes are limited to input, player movement, snapshot and hash; enemy/weapon balance and `SURVIVORS_CONFIG` are unchanged, so no config version bump.
- `stepShip` has an opt-in smooth speed limit used only by survivors. After turbo/pad expiry, excess speed brakes over time instead of being cut in one step. Card speed is part of the cruise config before composing boosts/turbo.
- `Mar3D` queues one turbo press into `SurvivorsRun.step`, exposes sim turbo/cooldown to the existing visible button, and renders jump height/pitch from the active sim clock. Splash/wake follow the jump. Boat/world/enemy damage calculations remain on the same water-plane position; jumping introduces no immunity.
- `canon-mode.tsx` captures the sailing cooldown in `SurvivorsWorld.start.turboCooldownS` before creating the game, so initial conditions are reproducible. Navigation cooldown remains on exit. No HUD layout or new UI strings were added.
- New `turbo-ramps.test.ts`: 10 tests for turbo/pad acceleration and smooth decay, cooldown/repeated presses, pause/card freeze, speed card + pad + turbo, wrapped pad activation, BoatJump/contact damage/landing, buoy parity with the world runtime, replay snapshots/events/hash with real scripted enemies and initial cooldown, and unchanged default ship speed cap.
- `mar-canon.spec.ts` has a desktop/mobile turbo-button check that observes activation, speed increase and cooldown progress/rejected repeat. `mar-circuito.spec.ts` remains unchanged.

Reversible implementation choices:

- Reuse a circuit-only `WorldRuntime` instead of copying its boost/collision rules or stepping the application's encounter/reward runtime.
- Keep the pre-existing reset of active turbo on starting a game, while recording any outstanding cooldown in initial world data. Clear an old sailing jump on entering and return to water on leaving.
- Freeze turbo, boost expiry and jump during pause/cards; use simulation height/pitch without introducing airborne hit filtering.
- Add the optional controller speed-limit mode instead of retuning sailing/racing or raising cruise speed artificially.
- User explicitly authorized the minimal `steering.ts` helper reexport and `survivors.ts` input forwarding changes. Architect reviewed the initial approach, environment errors and completed implementation; its replay concern was fixed and re-reviewed.

Commands and results (PowerShell uses `pnpm.cmd`; the `pnpm.ps1` shim is blocked by the machine's execution policy):

- `pnpm.cmd exec vitest run packages/engine/src/survivors packages/engine/src/ship packages/engine/src/circuit apps/web/app/mar/engine/steering.test.ts apps/web/app/mar/survivors.test.ts --configLoader native --pool threads --testTimeout=30000 --maxWorkers=2` — **PASS**, 8 files / 161 tests on final implementation. Initial card-speed test sampled after pad expiry; corrected its active-boost sampling point and reran green.
- The same targeted Vitest command without native config loading/threads — blocked before tests by Vite's optional Windows realpath subprocess (`spawn EPERM`). Supported CLI flags resolve test startup; no dependency patches or permission changes were made.
- `PYTHONUTF8=1 pnpm.cmd exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 --configLoader native --pool threads --maxWorkers=2` — 145 files passed, 1 failed; **1334 passed / 2 failed** (run before adding the two additional card/wrap tests, both covered in the final targeted pass). Only failures: `packages/world/src/worlds/worlds.test.ts`, both CLI subprocess tests returning `status: null`. A direct `spawnSync(process.execPath, ['--version'])` diagnostic confirms `error: EPERM`. These unrelated tests were not modified.
- `pnpm.cmd lint` — **PASS**, whole repository, including the final e2e edit.
- `pnpm.cmd typecheck` — blocked by recursive script spawning (`spawn EPERM`). Equivalent direct `node node_modules/typescript/bin/tsc -p <workspace>/tsconfig.json` checks — **PASS** for all six workspaces: contracts, db, engine, store, world, web. Web rerun after final e2e edits also passed.
- `PYTHONUTF8=1 sh tools/spec/checks.sh` — blocked by MSYS `CreateFileMapping`, Win32 error 5. Ran its checks directly with Python/UTF-8: `tools/spec/check.py`, `tools/spec/estado.py`, `tools/spec/test_check.py` (18 tests), `tools/spec/test_estado.py` (8 tests), `tools/blender/check.py` — **PASS**, including 62 manifests / 856 images.
- `pnpm.cmd build` — blocked during Next production build by `spawn EPERM`.
- `E2E_PORT=3124 pnpm.cmd e2e mar-canon.spec.ts mar-circuito.spec.ts --workers=1` — blocked before browser tests by `spawn EPERM`. New e2e check is written and typechecked; no e2e pass is claimed.
- Prettier run on changed code files — **PASS**.

Pending:

- Orchestrator must rerun the complete requested command and both e2e specs outside this process-restricted sandbox. Full command is not green here; build and browser behavior remain unverified in this environment.
- At integration with T125, verify its newly introduced enemy projectiles still damage the player while airborne. This checkout has no enemy projectiles yet; T124 does not change contact/invulnerability logic or add a jump-based damage condition.
- Merge the localized `sim.ts` additions with T125. New tests are in a separate file; config and existing survivors tests were not edited.

## 2026-10-05 — plan 011 T125: Four new enemies, elites, growth, Marea and the full script (simulation)

Qué existe (sólo `packages/engine/src/survivors/`; nada en `apps/web`):
- `config.ts` (`SURVIVORS_CONFIG_VERSION` 1 → 2): los 6 enemigos comunes del diseño (§6) como datos. Nuevos: **gaviota** (`gull`, `flyer`, `ignoresIslands`, 110 u/s), **pirata en botecito** (`pirate`, `shooter`: se para a `standoff` 320 u, dispara recto cada 2,2 s con `projectile` 300 u/s, 6 de agua), **pez espada** (`swordfish`, `charger`: a 380 u se para, avisa 0,9 s y embiste 560 u a 400 u/s, descansa 1,2 s), **medusa** (`jellyfish`, `splitter`: al caer, 2 trozos a escala 0,6 con la mitad del aguante que ya no se parten). Pirañas y cangrejo sin tocar (T123). Tipos nuevos `ShooterDef`, `ChargerDef`, `SplitDef`, `ElitesDef`, `MareaDef`, `EnemyPhase`; `QualityCaps.enemyProjectiles` (80 alta / 40 baja); `ScriptEvent.enabled`.
- **Élites** (`elites.elites`): desde el hito `elites` del guion (3:30) un 10 % de lo que aparece sale élite: ×3 aguante, ×4 nota, ×1,25 radio, misma velocidad; `EnemyView.elite` para la pantalla. **Crecimiento por minuto** (`growthPerMinute`) en los 6 tipos; con el tope lleno la oleada gana fuerza (`overflow`), también los trozos de medusa y los anillos de la Marea.
- **«Marea»** (`marea.marea`): hito a 5:00 durante 20 s; cada 2,5 s un anillo de 20 pirañas a ángulos iguales alrededor del barco (todos los octantes).
- **Guion del acto 1 en datos** (`acts[0]`): pirañas + medusas 0:00, gaviotas 1:00, cangrejos 1:30 (antes 1:00), piratas 3:00, peces espada 3:30, élites 3:30, Marea 5:00, hasta 7:00. Huecos de los minibosses (2:30 `vecino`, 4:30 `martillo`) y del boss (5:30 `fantasma`) como `enabled: false`: la beta 3 sólo los enciende.
- `sim.ts`: comportamiento por tipo en `stepEnemies` (vaivén de la gaviota, parada y disparo del pirata, máquina de fases del pez espada move → telegraph → charge → rest, con la embestida cortada por las islas), **disparos enemigos** (`stepEnemyShots`, lista propia con su rejilla `enemyShotGrid` y tope por calidad; **las islas los paran igual que a las bolas del jugador**, `islandBlock` compartido), reparto de la medusa en `defeat`, `placeEnemy`/`spawnRing` con élites y fuerza del tope, `makeEnemy` común. `spawnEnemy(type, x, y, elite?)` y `enemyShotsNear()` para pruebas y atajos.
- **Instantánea** (`SurvivorsSnapshot`): `enemyProjectiles`, `telegraphs` (`{id, type, x, y, heading, length, progress 0…1}`), `elitesActive`, `mareaActive`; `EnemyView` suma `elite`, `scale`, `phase`. **Sucesos** nuevos: `enemyFire`, `telegraph`, `split`; `defeated.elite`; `blocked.owner: 'player' | 'enemy'`; `hit` también para un disparo (`enemy` = quien disparó). `stateHash` cubre fases, disparos y la Marea.
- Velocidades: nada nuevo navega por encima de los 150 u/s del barco (prueba sobre `growthPerMinute`, `speedScale` del guion y la élite); sólo la embestida avisada del pez espada (400 u/s).
- Pruebas en `survivors-beta2.test.ts` (16): guion en datos, velocidades, gaviota cruza una isla, pirata se para y dispara, una isla para el disparo enemigo y la bola del cañón en los dos sentidos, tope de disparos de `baja` se toca y no se pasa, pez espada avisa quieto y luego embiste (progreso de la línea creciente, la embestida acaba contra una isla), medusa se parte en 2 y los trozos no, élites sólo desde el hito (y una élite a mano suelta ×4 de nota), Marea a 5:00 (anillo en los 8 octantes, 20 s, un hito apagado no hace nada), partida entera de 7:00 determinista por semilla con los 6 tipos, élites, avisos, disparos y la Marea; topes de `baja` en 7:00 con el guion completo; `&t=305` determinista. `survivors.test.ts`: la lista de enemigos y «nada en tierra» exime a los que vuelan.

Comandos:
- `pnpm exec vitest run packages/engine/src/survivors --testTimeout=30000` → exit 0, 2 archivos, 47 pruebas.
- `pnpm exec vitest run packages/engine/src/survivors` (tal cual el Done-when, timeout por defecto de 5 s) → exit 0, 47 pruebas; las tres partidas enteras de `survivors-beta2.test.ts` llevan timeout propio de 60 s porque dos partidas de 7:00 tardan ~8 s en esta máquina.
- `pnpm --filter @boia/engine typecheck`, `pnpm --filter @boia/web typecheck`, `pnpm lint` → exit 0.
- Comando de prueba del plan: vitest (sin `packages/db`, timeout 30 s) → exit 0, 146 archivos, 1339 pruebas; `sh tools/spec/checks.sh` → OK (exit 0); `pnpm lint`, `pnpm build`, `pnpm typecheck` → exit 0.

Pendiente / observaciones:
- Con el piloto de prueba que no esquiva, en 7:00 sólo caen pirañas (213) y gaviotas (11): el cañón de la beta 1 dispara al más cercano y las pirañas van pegadas al casco, así que cangrejos, medusas, piratas y peces espada se ven pero no mueren. Lo cambian las armas de T127 y el equilibrio con bots de T132; aquí se deja tal cual.
- `SURVIVORS_CONFIG_VERSION` sube a 2 también en T123: al integrar, dejar una sola subida por tarea (3 tras las dos).
- Los modelos, la línea de aviso en el agua, el brillo de élite y los disparos en 3D son de T126; hasta entonces los tipos nuevos salen con `genericEnemyGeometry`.

## 2026-10-04 — plan 011 T123: Notas de la beta 1 (enemigos más lentos, HUD pequeño y alto, «sumergirse»)

Qué existe
- `SURVIVORS_CONFIG_VERSION` 1 → 2. Piraña 150 → 120 u/s (80 % del máximo del barco, 150); crecimiento de velocidad de la piraña 0,02 → 0,01 por minuto y `speedScale` de la pista 1,08/1,15 → 1,03/1,05: a los 6:59 la piraña va a ~135 u/s (~90 % del barco sin mejoras). Cangrejo sin tocar (55 u/s, 0,01/min, ×1,1: ~65 u/s al final). Primera ola de pirañas algo más suave (0,35 → 0,25 grupos/s, grupos de 3-5 → 2-4) para que un barco parado dure ~26 s en vez de ~21 s y se vean las notas en el agua; el resto del equilibrio no cambia. `defeatStyle` sigue en `'sumergirse'` y el interruptor de desarrollo mantiene «puf».
- Pruebas nuevas (`survivors.test.ts`, «equilibrio de la beta 1»): ninguna pista de enemigo común (salvo `charger`) llega al 95 % de la velocidad máxima del barco en los 7:00, leído de la config; un esquivador sencillo (huye de los cercanos y se aparta de las islas) aguanta más de 3× lo que un barco parado y más de 90 s en 4 semillas (3 sobreviven los 7:00, una se inunda a ~150 s).
- HUD (`canon-hud.css`): cuenta atrás 1,45 → 1,05 rem, nivel y barra en una sola fila (barra de 5 px), «BETA» y pausa más pequeños (pausa 32 px visibles con 44 px de zona táctil); pegado arriba (`--canon-hud-top`: bajo los enlaces en el móvil, junto a la fila del minimapa; bajo los enlaces centrados en escritorio). Las cartas de nivel usan el mismo hueco.
- E2E (`mar-canon.spec.ts`): el HUD, la barra de XP y la cuenta atrás quedan en el 20 % superior (móvil y escritorio), el HUD mide ≤ 64 px, y no se solapa con «Entradas», enlaces, minimapa ni saldos.
- Guía de prueba de la beta 1: el punto «Derrota» ya no es una pregunta abierta.

Comandos
- `pnpm exec vitest run packages/engine/src/survivors apps/web/app/mar/canon-hud-model.test.ts` → exit 0, 47 pruebas.
- `E2E_PORT=3217 pnpm e2e mar-canon.spec.ts -g "HUD con BETA" --workers=1` → exit 0, 2 pruebas (mobile y desktop).

Pendiente
- Que Hernán pruebe el ritmo de una partida entera con estos valores.

## 2026-10-04 — plan 010 T105: Final regression coverage and world-update handoff

Qué existe:
- `mar-hud.spec.ts` «la ficha de una isla…»: la tarjeta pequeña ahora espera `mar-rumbo` y `mar-volar` a la vista (las dos maneras de ir, T96/T97 WIP 79bb8fa aplicado) y que la altura compacta siga ≤ 30 % del alto, también tras recogerla.
- `mar-rotulos.spec.ts`: el alejamiento espera hasta que el rótulo cabe sobre el modelo (hasta 6 pasos); arregla «cerca de halloween» en móvil (161 > 134, los mandos de la izquierda bajaban el rótulo).
- `mar-canon.spec.ts`: texto y `data-segundos` del reloj del HUD se leen en el mismo instante (era flaky).
- `docs/propuestas/2026-10-04-canon-beta1-guia-prueba.md`: un inicio con `t=`/`seed=`/`carta=1` sólo da premio en local y e2e, nunca con `?dev=1` en producción.
- `docs/TRASPASO.md`: sección «Actualizaciones del mundo (plan 010, las del antiguo plan 009)» (cambios, premios de muestra, lo que falta fuera del código) y recuento de REQ al día (160/68). La parte del Cañón de T119 se conserva.

Comandos:
- vitest (sin packages/db, timeout 30 s) → exit 0, 145 archivos, 1323 pruebas.
- `sh tools/spec/checks.sh` → OK; `pnpm lint`, `pnpm typecheck`, `pnpm build` → exit 0.
- e2e `mar-paridad mar-canon mar-hud` (workers=1) → 54 passed; `mar-rotulos` → 6 passed.

Pendiente:
- El aviso de llegada sigue diciendo «Isla descubierta: Puerto de Alicante» (`island.firstVisit`) y las claves `world.*.island.cala.body` no usadas conservan el texto viejo: es copy, lo decide Hernán/Álvaro.
- `minigame-layer.test.ts` «una partida perdida no toca el libro» no se reprodujo (3 corridas verdes); la flaky de `mar-paridad` del náufrago en móvil tampoco apareció en esta corrida.

## 2026-10-04 — plan 010 T113: Transparent main route with optional exploration islands

Qué existe
- `ROUTE_STOPS` (`apps/web/app/mar/engine/compact.ts`) es ahora sólo la ruta principal: Inicio (`puerto`) → Puerto de Alicante (`cala`) → Isla de Halloween → Isla del Sonido → Isla de Nochevieja. Sin vuelta al puerto (`stopAt` tiene una entrada por parada). Benidorm, Ibiza, el cañón, Tabarca y la Fiestera quedan fuera de la línea: siguen en el mundo, con pin, ficha y misiones, y se encuentran explorando o con el minimapa.
- Opacidad reducida: marcas 3D de 0,52 de cerca y 0,95 en el mapa a 0,22 y 0,55 (`NEAR_MARKS` 0,4, `MARKS_ALPHA` 0,55 en `effects.ts`); la línea del minimapa redondo a `globalAlpha` 0,6.
- El mar vivo se acerca a la nueva ruta; el remolino, además, huye de la carretera de la carrera (`offRoad`) y, si la ruta no le deja sitio, queda a como mucho `WHIRLPOOL_NEAR` (640 u).
- La ocultación durante el Cañón y la carrera no cambia (`setRouteHidden`).
- Pruebas: `compact.test.ts` (orden exacto, sin vuelta, islas opcionales presentes y alcanzables, Fiestera baja en la última).
- Sólo Arcilla; Acuarela sin tocar.

Comandos
- `pnpm exec vitest run apps/web/app/mar` → exit 0, 274 tests.
- e2e `mar-3d`, `mar-remolino`, `mar-fiestera` (escritorio y móvil) → 38 passed.
- Suite completa: vitest 145 archivos / 1323 tests exit 0 (una pasada previa falló 1 test intermitente, la siguiente 0); `tools/spec/checks.sh` OK; lint, typecheck, build exit 0.
- Evidencia: captura del mapa en `/tmp/orchestrator-attach/boia-planet-hernan-T113/overview-mapa.png`.

Pendiente
- Ajustar a ojo la opacidad (`NEAR_MARKS`, `MARKS_ALPHA`) si Hernán la quiere más o menos visible.

## 2026-10-04 — plan 010 T112: Benidorm and Ibiza runtime integration with bounded club animation

Qué existe:
- `PLACE_MODEL_IDS = ['cala', 'fotos', 'tienda']`: los GLB de Benidorm (T110) e Ibiza (T111) entran por el streaming de islas como el puerto (T108) y sustituyen a la isla entera; sus luces de a mano se apagan con el modelo; colisión, proximidad y mapa sin cambios (sin agrandar Benidorm, como propuso T110).
- Composiciones a mano nuevas (lejos, mientras llega o sin GLB) con la silueta del modelo: `BENIDORM_LAYOUT` (Intempo, torres, club, escenario, barra, pantallas que brillan) e `IBIZA_LAYOUT` (casas blancas, iglesia, quiosco con toldo de BOIA, pinos); sin objetos animados ni texturas de canvas; rótulo a la altura del manifiesto (no salta al llegar el GLB).
- `place-motion.ts`: `loadGltf` conserva los clips; `batchAnimatedNodes` junta la boia del club (46 piezas) en una malla por material al cargar; `placeMotion` crea un mezclador por copia cargada, posado con el reloj de cada fotograma de /mar (`boia-pole-dance` sobre `boia_pole_slide`, 4 s), las pantallas (`cyan`, `pink`) laten a 120 lpm sobre el brillo de la noche; con movimiento reducido, pose `static_frame` y pantallas fijas; se para y se suelta al soltar el modelo y al destruir la escena.
- Ganchos de prueba: `data-lugares-movimiento` («fotos:baile|quieto») y `data-lugares-pose` («fotos:0.420», cada 0.25 s).
- Pruebas: `apps/web/app/mar/engine/place-motion.test.ts` (10), `places.test.ts` (13: manifiesto/GLB/escala, huella y alto de la de a mano, rótulo, orilla, proximidad y separación por el camino más corto del planeta, Ibiza sigue siendo la tienda), `apps/web/e2e/mar-lugares-blender.spec.ts` (5 × móvil/escritorio: carga, baile en varias fases, reducido, sin GLB, ficha de Ibiza, captura de noche).

Comandos:
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 1318 passed (una primera pasada tuvo 1 fallo suelto que no se repitió)
- `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0; `pnpm typecheck` → exit 0
- `E2E_PORT=3291 pnpm e2e mar-lugares-blender.spec.ts --workers=1` → exit 0, 10 passed
- `E2E_PORT=3291 pnpm e2e mar-rotulos.spec.ts mar-isla-modelo.spec.ts mar-puerto.spec.ts mar-fiestera.spec.ts mar-paridad.spec.ts mar-3d.spec.ts --workers=2` → 73 passed, 4 skipped, 1 failed: `mar-rotulos` «cerca de halloween» en móvil (161 > 134), el fallo conocido de antes de T108 (anotado para T105)

Pendiente:
- La cámara de siempre corta las puntas de las torres de Benidorm muy cerca (T110 lo anotó); no se tocó el encuadre.
- La colisión de Ibiza (elipse 1.9×1.5 a 45°) sigue llegando más allá de la costa visible delante-derecha y atrás-izquierda; no se cambió el mapa.

## 2026-10-04 — plan 010 T122: One world: hide Acuarela, keep it for a later port

Qué existe:
- `WorldRegistry` acepta una lista de mundos ocultos (4.º argumento); `catalog.ts` oculta Acuarela. Nuevos `playableIds()`, `isPlayable()`, `hiddenIds`; `list()` (selector del menú y del Admin) y `resolve()` sólo ven los jugables; `ids()`/`get()`/`skin()` siguen viendo todos (piel, mapa, arte y pruebas de Acuarela intactos). El mundo por defecto no puede ocultarse.
- `?mundo=acuarela`, `boia:mundo` y `boia:mundo-activo` con `acuarela` caen en silencio en Arcilla; el progreso no se toca. `chooseWorld` y `setActiveWorld` (Admin) rechazan mundos ocultos.
- El menú de /mar no muestra «Mundos» con un solo mundo jugable; el Admin sólo ofrece Arcilla (temporadas, textos, logros, ranking).
- e2e: `mundo-acuarela.spec.ts` pasa a `mundo-unico.spec.ts` (el oculto cae en Arcilla, por URL y por elección guardada; sin «Mundos»); se retiran el test de cambio de mundo de `mar-paridad.spec.ts` y `agujero-negro.spec.ts` (necesitaban dos mundos); `mar-hud.spec.ts` ya no espera «Mundos». `docs/spec/estado.md` REQ-MUN-037/039 a PARCIAL; una línea en `docs/TRASPASO.md`.

Comandos:
- vitest (sin packages/db, 30 s) → exit 0, 143 ficheros, 1299 pruebas
- `sh tools/spec/checks.sh` → 0; `python3 tools/spec/estado.py` → 0; `pnpm lint` → 0; `pnpm typecheck` → 0; `pnpm build` → 0
- `E2E_PORT=3218 pnpm e2e e2e/mar-paridad.spec.ts --workers=1` → 12 pasan
- `E2E_PORT=3217 pnpm e2e e2e/mundo-unico.spec.ts e2e/mar-hud.spec.ts --workers=1` → 14 pasan, 2 fallan (mar-hud «la ficha de una isla: una tarjeta pequeña…», `mar-volar` presente; no toca mundos, ficha de isla), 8 saltadas

Pendiente: revisar el fallo de mar-hud (ficha de isla, `mar-volar`); portar todo a Acuarela en la actualización futura (quitar el mundo de `hidden` en `catalog.ts` y devolver las pruebas de cambio de mundo).

## 2026-10-04 — plan 010 T108: Puerto de Alicante identity and explicit boat-choice popup

Qué existe:
- **Identidad.** La Cala Cantalar es el **Puerto de Alicante** (id `cala` intacto: descubrimientos, logros, premios y su sitio de `mapa.json` no cambian). `HARBOR_PLACE_ID = 'cala'` y `HARBOR_REF = 'barcos'` en `packages/world/src/worlds/arcilla/map.ts` (nombre del lugar y del sector); textos de muestra de puerto en las pieles de Arcilla y Acuarela (`kicker: 'Puerto'`); en Acuarela el nombre propio pasa a «Puerto de Alicante» también en su fuente `mundos/acuarela/lugares.json` (la prueba de paridad nombres↔lugares.json sigue). Icono del rótulo ⛵ (`PIN_ICON`, `mar-client.tsx`).
- **Ficha del puerto** (`apps/web/app/mar/sheet.tsx`): la ficha normal de un lugar (`info`, al acercarse), con «⛵ Cambiar de barco» (`data-testid="puerto-barcos"`, claves `mar.sheet.puerto.*` en `es-mar.ts`) que abre «Barco» (`onShips` → `openTienda`, compra y equipa); en otra visita, además «Explorar la isla» (REQ-AVE-013 sigue); desplegada, sin «Próximos eventos» (`IslandBlock harbor`), con recuerdos y «Ver fotos de la isla».
- **Fuera la apertura sola de T100**: borrados `lib/mundo/ship-menu-discovery.ts` y su prueba y el enganche de `mar-client.tsx`; la preferencia vieja `barco:menu-abierto` ya no la lee nadie (perfiles nuevos y viejos ven la ficha, nunca la tienda sola). `naufrago.revisit` se usa por clave.
- **Modelo de Blender** (`apps/web/app/mar/engine/island-models.ts`): `PLACE_MODEL_IDS = ['cala']`, `parsePlaceManifest`/`loadPlaceManifests`/`loadIslandModels` leen `art/places/3d/<id>/manifest.json` (contrato `place-glb` de T107) y el GLB entra por el mismo camino que las islas de Blender (por distancia, escala = radio de colisión / radius, sin girar, sus luces de a mano apagadas). La composición a mano de la cala (horno, humo, antorchas, terreno redondo) se sustituye por un puerto a mano con la misma huella (`HARBOR_LAYOUT`, `islands.ts`) para lejos, mientras llega o si falla el GLB; `islandShores` deja el bajío sólo bajo la tierra de atrás: la dársena queda en agua honda con modelo y sin él. Colisión y proximidad, las de siempre.
- **Cañón**: la ficha del puerto no sale en plena partida (el runtime está parado, como en las demás islas); e2e lo prueba.
- `tools/blender/places/README.md`: nota del enganche en /mar para T112.
- Pruebas: `engine/harbor.test.ts` (paridad manifiesto/GLB/escala/orientación, tierra sólo atrás, cargador y respaldo, puerto a mano sin dársena rellena), `mar/sheet.test.ts` (botón, kicker, sin próximos eventos), `arcilla.test.ts` (id, nombre en los dos mundos, contenido), e2e nueva `mar-puerto.spec.ts` (perfil nuevo y con la preferencia vieja, compra/equipa desde la ficha, modelo GLB y colisión, rótulo sin pisar mandos, sin GLB, Cañón), `mar-paridad.spec.ts` y `world-community.spec.ts` ajustadas.
- Rama: fusionado `main` (559b9c7: T109, T114, T111) sin conflictos; las comprobaciones de abajo son del estado fusionado.

Comandos:
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 143 archivos, 1295 pruebas.
- `sh tools/spec/checks.sh` → exit 0. `pnpm lint` → exit 0. `pnpm build` → exit 0 (landing 186.9/200 kB). `pnpm typecheck` → exit 0.
- `python tools/blender/places/check.py` → exit 0 (cala 11404 tris, 427148 B); `python tools/blender/places/test_check.py` → exit 0; `python tools/blender/check.py` → exit 0.
- `E2E_PORT=3218 pnpm e2e mar-puerto world-community comunidad mar-paridad mar-isla-modelo tienda mar-carnet-barco mar-canon mar-rotulos mar-hud --workers=1` → exit 1: 93 pasan, 10 omitidas, 3 fallan y no son de T108: `mar-hud.spec.ts:411` móvil y escritorio (la tarjeta pequeña de la Isla del Sonido espera sin «Ir en nave»: la expectativa vieja de T97 que cierra T105) y `mar-rotulos.spec.ts` «cerca de halloween» en móvil (falla igual en la base 27c7726, comprobado: 161 > 134). `mar-puerto.spec.ts` 14/14.
- Capturas móvil y escritorio revisadas (fuera del repositorio): ficha, «Barco», modelo de día y de noche, puerto a mano sin GLB, rótulo.

Pendiente:
- En un móvil estrecho el rótulo «⛵ Puerto de Alicante» (224 px) no cabe entre el minimapa y los saldos a la distancia de `?cerca=`: se apaga lejos y sale al acercarse (regla de T75); por eso el puerto no entra en `mar-rotulos.spec.ts` y su rótulo se prueba en `mar-puerto.spec.ts`.
- El aviso de primera llegada sigue diciendo «Isla descubierta: Puerto de Alicante» (clave común `island.firstVisit`).
- Fuera de alcance: el Admin sigue ofreciendo el puerto como isla a la que ligar eventos (`lib/admin/world.ts`, `eventIslands`); las claves sin uso `world.*.island.cala.body` de `textos-zonas.md` y el arte 2D `art/mundos/acuarela/cala/manifest.json` conservan los textos de la cala.

## 2026-10-04 — plan 010 T111: Blender Ibiza white village and cove asset

Qué existe:
- **Ibiza (`tienda`) en Blender**, sólo arte (sin enganche en el juego, que es de T112): `tools/blender/places/tienda.py` (fuente reproducible) y `art/places/3d/tienda/{tienda.blend,tienda.glb,manifest.json,reference_notes.md,requirement_ledger.md,final_report.md}`. Isla en herradura con una cala resguardada que se abre hacia el frente (la aproximación del barco, glTF +Z): playa de arena al fondo, acantilados ocres a los lados, boca estrecha con dos boias naranjas y una torre de defensa de piedra; pueblo blanco escalonado en la ladera (10 casas encaladas con azoteas o tejados de teja, puertas y ventanas azules/verdes, chimeneas ibicencas), iglesia fortificada en lo alto (espadaña con campana, porche de arcos, cúpula, baluarte; análogo del Puig de Missa) y una calle de escaleras blanca desde la playa; dos casas payesas con porxo detrás; varaderos con rampas bajo el acantilado derecho, dos llaüts, embarcadero, pinos, cipreses, palmera, sombrillas y farolas.
- **Papel de tienda conservado:** quiosco blanco en el centro de la playa, de cara a la aproximación, con toldo a rayas naranja/blanco BOIA, mostrador con camisetas dobladas, dos farolillos, bandera, tendedero de camisetas y cartel «TIENDA» (como el arte 2D de arcilla).
- **Medidas:** 10949 triángulos, 402140 bytes (techos 12000 / 600000), radio normalizado 0,963882, altura 0,587481 (~3,29 u de escena con el radio de colisión actual 5,59625); una malla `static_tienda` bajo `place_tienda`, 17 materiales de la paleta del juego (sRGB→lineal), sin clips, sin texturas ni luces. Línea de agua a ~0,92 R (llena su círculo como cala/fotos).
- **Contrato de lugares:** `approach.channel` opcional en `place3d.schema.json`; `check.py` comprueba que en el sector libre (±10°) desde radio 0,62 nada asoma sobre el agua (la boca de la cala). Cala y fotos no lo declaran y siguen pasando. 6 pruebas nuevas en `test_check.py`; sección tienda en el README.
- **Referencias abiertas de verdad** (illesbalears.travel: Cala Salada ×3, Puig de Missa ×2, calle de Dalt Vila) y observaciones en `reference_notes.md`; ninguna imagen entra en el repo.
- Pruebas visuales fuera del repo, en `node_modules/t111-preview/` (ignorado): `graybox-final/`, `final/` (héroe día/noche, distancia de juego día/noche a 1,7 R y 1,05 R, seis vistas, primeros planos de tienda, varaderos, iglesia y boca, métricas, importación limpia, reproducibilidad, `multiview/` estándar), `fresh/` (lo mismo desde el GLB importado), `final/cull/` (GLB con back-face culling como three.js) y hojas `review-*.jpg`, todas abiertas y revisadas.

Comandos (Blender 5.2.2 LTS del checkout de Codex, sólo lectura, `--background --factory-startup --python-exit-code 1`):
- `node … tools/blender/places/distance_camera.mjs node_modules/t111-preview/distance-camera.json tienda` → exit 0 (radio 5,59625)
- `blender … tienda.py` ×2 + `-- --preview node_modules/t111-preview/final` → exit 0; firma de geometría/normales/materiales idéntica entre ejecuciones limpias, manifiesto igual
- `python tools/blender/places/check.py art/places/3d/{tienda,cala,fotos}` → exit 0 los tres
- `python tools/blender/places/test_check.py` → exit 0, 29 pruebas
- `blender … fresh_import.py -- --manifest art/places/3d/tienda/manifest.json …` → exit 0, PASS 10949 triángulos, 17 materiales
- `blender … tienda.py -- --fresh-evidence --preview node_modules/t111-preview/fresh` → exit 0
- skill blender-asset-validation: `inspect_asset.py` (blend y GLB) → exit 0, sin issues, 0 caras degeneradas; `render_evidence.py` → exit 0
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 139 archivos, 1248 pruebas
- `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0; `pnpm typecheck` → exit 0

Pendiente (T112):
- Sustituir toda la decoración procedural de `tienda()` en `islands.ts` (terreno, rocas, muelle, antorchas, luces, quiosco) por el GLB, con su caída a la versión procedural; el panel de la tienda, la colisión y la proximidad no cambian.
- La colisión de Ibiza es un círculo de R más los lóbulos de cápsula de `ellipseCollision` (elipse 1,9×1,5 a 45°): el barco no entra en la cala (decorativa) y los lóbulos siguen saliendo más allá de la costa visible delante-derecha y detrás-izquierda, igual que con la isla procedural.
- Encuadre, luz e iluminación nocturna reales (`lantern` es el único material emisivo), altura del rótulo (`labelY` ~4,9 u, por encima del nuevo techo).

## 2026-10-04 — plan 010 T114: Custom BOIA menu icons

Qué existe
- `apps/web/lib/mundo/menu/icons.tsx`: familia propia de iconos del menú, SVG en código (32×32, 415–908 bytes cada uno, sin texto ni imágenes), al estilo de la mascota: formas redondas, contorno grueso en `currentColor` (tinta en la hoja crema, blanco en el botón de cristal) y rellenos de `ICON_PALETTE` (naranja, morado de la gorra, crema, blanco y el amarillo del objetivo, todos de mar.css). Iconos: trofeo (Logros y botón del menú), carnet, barco, etiqueta con % (Mis códigos), botella con mensaje, podio (Ranking), engranaje (Ajustes), mando (Controles), planeta con anillo (Mundos), sol/atardecer/luna (momento del día). «Welcome Aboard» reutiliza la mascota original (`_marca/boia-mascota.svg`, sin redibujar) vía `.boia-icon--mascota`. Decorativos (`aria-hidden`, `focusable="false"`); el nombre accesible es siempre la etiqueta de texto. El módulo no importa CSS (los estilos van en mar.css), así se puede leer desde las pruebas de Node y de Playwright.
- `apps/web/app/mar/menu.tsx`: `MENU_ICON` (sección → icono, todos distintos), `MarMenuButtonIcon`; moods y Mundos con su icono; sin emoji en el menú. Aviso de partida del Cañón (T118) intacto.
- `mar-client.tsx`: el botón «Menú» lleva el trofeo propio en lugar de 🏆 (dos líneas).
- `mar.css`: `.boia-icon`, mascota, tamaños (26 px en casillas, 24 px en el botón, 20 px en moods, 22 px en Mundos). Casillas de 92 px mínimo y nombre en hasta dos líneas: con Archivo los nombres salían recortados («Welco…», «Mi Carn…») en móvil y escritorio; ahora se leen enteros (3 columnas en móvil, 4 en escritorio).
- Pruebas: `lib/mundo/menu/icons.test.ts` (SVG decorativo, ligero <1,5 kB, distintos, sólo colores de la paleta, paleta = mar.css, mascota = archivo de art/marca/logo) y `app/mar/menu.test.ts` (icono distinto por sección, decorativo, nombre accesible = etiqueta, moods y Mundos, ningún emoji en el menú también con el aviso del Cañón, botón con el trofeo). `e2e/mar-hud.spec.ts`: el botón lleva `[data-icon="logros"]` y se nombra «Menú del juego»; cada casilla con icono visible y distinto, `aria-hidden`, nombre accesible = etiqueta, nombre entero (sin recorte), zona táctil ≥ 44 px, icono ≥ 20 px dentro de la casilla y contraste del contorno ≥ 3:1 con la hoja; móvil y escritorio.
- Capturas revisadas (fuera del repo): `C:/Users/alvar/AppData/Local/Temp/orchestrator-attach/boia-planet-hernan-T114/t114-{menu,menu-sheet,hud}-{mobile,desktop}.png`.

Comandos
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 142 archivos, 1268 pruebas.
- `sh tools/spec/checks.sh` → exit 0. `pnpm lint` → exit 0. `pnpm build` → exit 0 (186.9 kB / 200 kB). `pnpm typecheck` → exit 0.
- `E2E_PORT=3714 pnpm e2e mar-hud.spec.ts mar-a-bordo.spec.ts mar-ayuda.spec.ts --workers=1` → exit 1: 34 passed, 16 skipped, 2 failed. Los 2 fallos son «la ficha de una isla…» (mar-hud.spec.ts:411, móvil y escritorio: `mar-volar` visible en la tarjeta plegada), la expectativa vieja de T97 que T105 debe actualizar; no toca el menú. Todas las pruebas del menú pasan en móvil y escritorio.

Pendiente
- Títulos de las hojas de cada sección siguen con emoji en i18n («🏆 Logros», «🪪 Mi Carnet»…): fuera del alcance (otras hojas, textos).
- `lib/mundo/menu/onboard-menu.tsx` y el `icon` de `lib/mundo/menu/sections/*` (menú de /juego) no se montan en ninguna parte; se dejaron con sus emoji.

## 2026-10-04 — plan 010 T109: Twenty-two knots only during the active race

Qué existe
- **Física de carrera a 22 nudos** (`apps/web/app/mar/engine/steering.ts`): `atCruiseSpeed(cfg, u/s)` escala lo que va con la velocidad (aceleración, freno, radio de giro, freno de la vuelta corta) y deja lo demás; `RACE_SHIP_CONFIG = atCruiseSpeed(MAR_SHIP_CONFIG, 220)` es entera la física de 22 nudos de antes de T99 (la prueba la compara campo a campo con la congelada de T99). `MAR_SHIP_CONFIG` (15 nudos) no cambia.
- **Selección y composición:** `baseShipConfig(racing)` (22 sólo con el cronómetro corriendo, fase `racing`; la oferta, la cuenta atrás, la tarjeta de meta, explorar y el Cañón van a 15); `stepShipConfig(base, efectos, boost)` = base → impulsos/frenos del runtime → turbo o viaje, igual a 15 que a 22.
- **Ciclo de vida:** `ShipHandling.sync(racing, ship, cap)` antes de cada paso. Al dejar de correr (meta, anulada por panel/fuera de la carretera/tiempo, otro mundo que cambia la carrera, «Otra vez») vuelve a 15 y recorta en el acto la velocidad que sobra al tope de crucero de ese momento (con los impulsos del mundo y el turbo que sigan), sin mover ni girar el barco; así el paso siguiente no lo toma por un golpe (sin recorte perdería >60 u/s de una vez: temblor y chapoteo).
- **Mar3D** (`engine/mar3d.ts`): `cfg` es ahora la base de `ShipHandling`; `syncHandling()` al empezar cada `simulate` y al empezar una partida del Cañón (nunca es carrera: `!this.survivors && opts.racing()`); `stepConfig()` compone la física del paso; atributo `data-manejo="crucero|carrera"` en el lienzo para las e2e. `mar-client.tsx`: una línea, `racing: () => raceRef.current?.race.racing ?? false`.
- **Pruebas:** `steering.test.ts` (física de carrera = la histórica; mismos tiempos de giro y círculo proporcional; turbo/impulsos/frenos con un `WorldRuntime` real componen igual; seis formas de dejar de correr recortan a 15 sin mover el barco; con turbo o impulso se queda el tope de crucero de ese momento; la maniobrabilidad del Cañón va sobre cualquiera de las dos bases y la suya es la de 15). `race.test.ts`: el piloto elige la física como Mar3D; vuelve la aserción de antes de T99 (sin turbo, al menos bronce y no oro); cada paso usa 22 sólo en `racing`; cruza la meta a velocidad de carrera y al dejarla se queda con el tope de crucero (con el impulso de la última boia); con turbo llega antes. `mar-circuito.spec.ts`: `data-manejo` crucero en la oferta y la cuenta atrás, carrera corriendo y en «Otra vez», crucero tras la meta y al anular (panel, fuera de la carretera); el velocímetro no pasa de 15 hasta la salida y llega a 22 corriendo. `mar-canon.spec.ts`: la partida del Cañón va en crucero.
- Récord: la versión del circuito no cambia (los tiempos a 22 son los de siempre; los hechos a 15 desde T120 son más lentos, nada que comparar a favor).

Comandos
- `E2E_PORT=3193 pnpm e2e mar-circuito.spec.ts --workers=1` → exit 0, 6 passed (el test de medalla, móvil y escritorio).
- `E2E_PORT=3193 pnpm e2e mar-canon.spec.ts --workers=1 -g "desde el panel de su isla|en plena carrera"` → exit 0, 4 passed.
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 140 archivos, 1270 pruebas.
- `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0 (186.9 / 200 kB); `pnpm typecheck` → exit 0.

Pendiente
- Ninguno de T109. Sin cambios de umbrales de medalla, economía ni versión del récord.
- Ya existía antes: cuando acaba un impulso del mundo o el turbo, `stepShip` recorta la velocidad de golpe y Mar3D lo toma por un golpe (temblor y chapoteo); no se tocó.

## 2026-10-04 — plan 010 T115: Castaway achievement completes on rescue (Codex)

Qué existe
- `naufrago-fiesta` conserva su ID, recompensa de muestra (80 puntos / 40 monedas), descuento y frase de repetición; ahora se completa al rescatar al náufrago y recibir su descuento (ya no exige entrega a la fiesta). Cambios en `packages/store/src/sample/progress.ts`, `apps/web/lib/mundo/{achievements,world-progress,ship-menu-discovery}.ts`, `apps/web/lib/repo.ts`, `apps/web/lib/logros/{model,use-logros}.ts`, `apps/web/lib/i18n/es-zonas.ts`.
- `reconcileAchievementEvidence` completa el logro a partir de un descuento de rescate persistido (incluso usado o caducado), sólo la preparación: nunca reclama puntos ni monedas; el ledger de reclamados sigue siendo la autoridad y la recompensa no se repite entre sesiones ni cuentas.
- Pruebas: nueve unitarias nuevas más las de recuperación/repetición actualizadas (`achievements.test.ts`, `world-progress.test.ts`, `logros/model.test.ts`, `logros/castaway-account.test.ts` nuevo) y un escenario E2E nuevo en `world-community.spec.ts`.

Comandos
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 140 archivos, 1252 pruebas.
- Python de `tools/spec/checks.sh` (check, estado, test_check, test_estado, blender/check) → exit 0 cada uno (el script `sh` no corre desde PowerShell/guardia, se lanzaron uno a uno).
- `pnpm lint` → exit 0. `pnpm typecheck` → exit 0. `pnpm build` → exit 0 (presupuesto 186.9 kB / 200 kB).
- `E2E_PORT=3217 pnpm e2e logros.spec.ts world-community.spec.ts descuentos.spec.ts --workers=1` → exit 0, 22 pasan, 2 omitidas (capturas del informe).

Pendiente
- Nada de T115. Subida de REQ en `docs/spec/estado.md` no se tocó (fuera de alcance de esta tarea).

## 2026-10-04 — plan 010 T121: No reward from dev-shortcut starts in production; Cañón sample copy

Qué existe:
- **Partidas de prueba sin premio en producción.** `WorldMinigameSession` (`packages/engine/src/minigames/world-session.ts`) acepta `devStart` (empezada con un atajo que cambia la partida) y `devStartRewards` (si el build deja cobrar a esas partidas; por defecto, no). `testStart` = algo saltado con `&t=` (`skippedMs > 0`) o `devStart`. Sin permiso, la sesión se liquida igual (una vez, con su validación) pero el libro no se llama: ni premio, ni `win_minigame` (que `withWinSignal` emite al llamar al libro), ni logro `canon`, ni progreso de `guardacostas`. El premio sale `{ granted: false, reason: 'test_start' }` (nuevo motivo en `RewardOutcome`, `rewards.ts`); una partida de prueba perdida sigue diciendo `not_won`. Cantidades y política del premio, sin cambios.
- **Quién decide** (`apps/web/app/mar/survivors.ts`): `devStartRewards(env)` = `pnpm dev` (`NODE_ENV !== 'production'`) o el servidor de las e2e (`navigator.webdriver`; las e2e corren contra `next build` + `next start`, así que el build es de producción); en producción con `?dev=1` (los atajos encendidos sólo por la URL), nunca. `isDevStart({ t, seed, card })`: `&t=`, `&seed=` y `&carta=1` hacen la partida de prueba; `&derrota=` no (sólo cambia cómo se ve). `useCanonMode.start` (`canon-mode.tsx`) pasa los dos a la sesión; «Otra vez» y el panel de la isla empiezan partidas normales.
- **Pantalla final:** `prizeLine` da `mar.canon.premio.prueba` («Partida de prueba (empezada con un atajo): no da premio.», muestra) y `data-premio="test_start"`.
- **Textos de muestra:** `minigame.canon.title` → «Que no pare la música» (el del panel; también su fila en `docs/propuestas/textos-zonas.md`, que `zonas.test.ts` compara con el catálogo); descripción del logro `canon` → «Aguanta en el Cañón hasta el amanecer.» (`packages/store/src/sample/progress.ts`). Ids, premios y lógica de logros, sin cambios.
- **Pruebas:** `world-canon.test.ts` (sesión de prueba sin permiso → `test_start`, el libro no se llama, perdida → `not_won`, normal sigue cobrando; la prueba de `&t=` de T119 pasa `devStartRewards: true`); `survivors.test.ts` (`isDevStart`, `devStartRewards` por entorno, producción con `?dev=1` sin premio ni señal y la normal cobra una vez por temporada, dev/e2e cobran con `&t=`; el título del registro = el del panel); `canon-hud-model.test.ts` (línea de premio `test_start`); e2e nueva en `mar-canon.spec.ts`: sin `navigator.webdriver` (init script) y con `?dev=1&minijuego=canon&t=419&seed=3`, «¡Amanece!» con `data-premio="test_start"`, la línea de prueba, saldos iguales y el logro `canon` sin quedar listo.

Comandos:
- `pnpm exec vitest run packages/engine/src/minigames apps/web/app/mar/survivors.test.ts apps/web/app/mar/canon-hud-model.test.ts apps/web/lib/mundo packages/store` → exit 0, 46 archivos, 404 pruebas
- `E2E_PORT=3191 pnpm e2e mar-canon.spec.ts logros.spec.ts --workers=1` → exit 0, 36 passed, 2 skipped (las capturas de logros), móvil y escritorio
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 139 archivos, 1248 pruebas
- `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0; `pnpm typecheck` → exit 0

Pendiente:
- `docs/propuestas/2026-10-04-canon-beta1-guia-prueba.md` (líneas 50–53) aún dice que una partida de `t=` puede dar el premio; ahora sólo en local/e2e, no en producción con `?dev=1` (fuera del alcance de esta tarea).
- Título del logro `canon` («Ni un tiburón»), `minigame.canon.summary`/`howto.*` y `docs/propuestas/logros-catalogo.md` siguen con el juego viejo (muestra; claves sin uso en código salvo el logro).

## 2026-10-04 — plan 010 T110: Blender Benidorm skyline and club asset (Codex)

Place ID `fotos` ("Isla de Benidorm"). No runtime/map/collision/route change.

Exists:
- `tools/blender/places/fotos.py` (source), `art/places/3d/fotos/{fotos.blend,fotos.glb,manifest.json,reference_notes.md,requirement_ledger.md,final_report.md}`.
- Shared tooling generalized (cala still passes): `common.py`, `check.py` (97-phase motion/contact checks), `fresh_import.py`, `test_check.py`, `distance_camera.mjs` (takes a place id), `place3d.schema.json`, README.
- GLB: 11768 tris (ceiling 12000), 397380 bytes (ceiling 600000). Blender-source bounds min [-0.94,-0.94,-0.045], max [0.94,0.94,1.343], radial 0.94, height 1.343. No enlargement proposed (scale = fotos collision radius 7.0875, height ~9.52 scene units).
- Motion for T112: moving empty `boia_pole_slide`, clip `boia-pole-dance`, 4 s loop, 24 fps, frames 1..97 (t=(f-1)/24), translation only, z=0.42+0.085*(1-cos(2*pi*t/4)) (travel 0.17). Pivot Blender [0,-0.33,0.42] (glTF [0,0.42,0.33]) on the pole axis. Pole Blender [0,-0.33,0.15] to [0,-0.33,1.03], radius 0.014. Hand contacts `boia_hand_high` local [0,-0.024,0.105], `boia_hand_low` local [0,0.024,0.005]. Reduced motion: static_frame=1 (low pose, dressed, hands on pole; exported default pose equals it), so seek clip to t=0 and stop updating. Static batch `static_fotos`, root `place_fotos`.
- Mascot dressed (purple club vest, hat), hands on the pole; tasteful, non-explicit. Cameras and equalizer screens are decorative geometry only; no photos, textures or dynamic camera access.
- Evidence (outside repo, ignored): `node_modules/t110-preview/` (final/ authored views, hero, distance, 9 motion frames; fresh/ from fresh GLB import; review-*.jpg sheets). `node_modules/t110-verify/` has the wrapper's re-runs.

Commands (wrapper re-run, from this worktree):
- `python tools/blender/places/check.py art/places/3d/fotos` -> exit 0 (11768 tris, 397380 B, 1 clip)
- `python tools/blender/places/check.py art/places/3d/cala` -> exit 0
- `python tools/blender/places/test_check.py` -> exit 0
- Blender 5.2.2 `fresh_import.py --manifest art/places/3d/fotos/manifest.json` -> exit 0
- vitest (excluding packages/db, 30 s timeout) -> exit 0 (137 files, 1231 tests)
- `sh tools/spec/checks.sh` -> exit 0; `pnpm lint` -> 0; `pnpm typecheck` -> 0; `pnpm build` -> 0

Pending:
- Primary VisitBenidorm/Intempo photographs could not be visually inspected by Codex (see reference_notes.md); the skyline is stylized from the brief.
- T112: retain the GLTF clip in ModelStore, mixer lifecycle, reduced-motion handling, live framing/lighting (default exterior approach at 1.7 radii crops tower tops; 1.05 radii frames the whole skyline). No runtime completion claim.

## 2026-10-04 — plan 010 T119: Remove the 2D canon, session and reward, full e2e of the mode, docs and the beta test guide

Qué existe:
- **Cañón 2D quitado:** `packages/engine/src/minigames/canon.ts` borrado, con sus bots (`testing.ts`), su parte de `minigames.test.ts` (las pruebas compartidas con el Faro se quedan sólo con el Faro, que no cambia) y el arrastre de `host.ts`. `?minijuego=canon` ya no abre la capa 2D.
- **El registro** guarda dos clases de juego (`types.ts`): `MinigameEntry` (id, panel, configuración y `minPlausibleMs`) y `MinigameDefinition` (la de la capa 2D, con simulación). `canon` sigue en `MINIGAME_REGISTRY` sólo para su id, sesión, validación y premio (`minigames/world-canon.ts`); `layerMinigame(id)` da sólo los de la capa (el Faro); `mountMinigame` y `MinigameLayer` rechazan el Cañón.
- **Sesión del Cañón en el mar** (`minigames/world-session.ts`, `WorldMinigameSession`): `useCanonMode` (`apps/web/app/mar/canon-mode.tsx`) la abre al empezar con la semilla de la partida y lo saltado con `&t=`, y la liquida una vez al acabar (`canonEnd(reason, activeS)`). Configuración de sesión versión 4 (`canonConfigFor(SURVIVORS_CONFIG)`): `goal` = `timeLimitS` = 420 s, la huella de la config del modo dentro (cualquier cambio de equilibrio cambia el `configHash`), premio 150 puntos + 50 monedas `season`. Marca = segundos enteros de tiempo activo; `won` sólo con `survived`; `minPlausibleMs(score) = score·1000`.
- **Validación por tiempo activo** (`session.ts`): las pausas no cuentan ni invalidan; un abandono (más de 5 min en pausa o salir de `/mar` a mitad) invalida; la sesión guarda `skippedMs` del atajo `&t=`, que cuenta para la marca pero no frente al reloj, y el libro lo apunta en `metadata.skippedMs`. `LocalSessionAuthority.open` acepta `{ seed, skippedMs }`.
- **Premio y logros:** el libro es `repo.progress` (`rewards: progressApi` en `mar-client`) envuelto con `withWinSignal`, así que al ganar se emite `win_minigame` (`canon`, `guardacostas`) aunque el premio ya se cobrara. Supabase: la acción `minigame` con `minigame:canon` ya aceptaba `season`, 150/50 y metadatos ≤ 2000 bytes; no hizo falta migración.
- **Pantalla final:** una línea de premio (`mar-canon-final-premio`): «+150 puntos y +50 monedas», «Ya cobraste el premio del amanecer esta temporada.» o «Esta partida no da premio.» (nada si se inundó). `data-premio` en `mar-canon` y en esa línea (`pending`, `granted`, `duplicate`, `not_won`, `abandoned`…). Claves `mar.canon.premio.*` (muestra).
- **e2e nuevas** en `mar-canon.spec.ts` (móvil y escritorio): inundarse sin premio; amanecer con `&t=419` → +150/+50 una vez, logro `canon` listo, y otra visita ganada → `duplicate` sin cambiar saldos; abandono tras 5 min de pausa (pestaña oculta y reloj adelantado) con aviso y el mundo de vuelta; la Boia Fiestera sigue a bordo durante y después de una partida. `minijuegos.spec.ts`: sin el cañón 2D; la prueba de pausa y pestaña oculta pasa al Faro; una nueva comprueba que `?minijuego=canon` no abre la capa.
- **Docs:** `docs/spec/estado.md` (REQ-MUN-026 HECHO con la nueva prueba; REQ-AVE-037 pasa a PARCIAL, pendiente de `puf`/`sumergirse`; REQ-AVE-038 HECHO con el ajuste por tiempo activo pendiente de decisión; REQ-AVE-035 y 039 PARCIAL con notas), `docs/TRASPASO.md` (sección «El Cañón en beta»), `README.md` (enlace a la guía), hoja de ruta de `docs/propuestas/2026-10-04-canon-survivors.md` renumerada (beta 1 = 010 … lanzamiento = 014) y la guía nueva `docs/propuestas/2026-10-04-canon-beta1-guia-prueba.md`.

Comandos:
- `pnpm exec vitest run packages/engine/src/minigames packages/engine/src/survivors packages/store` → exit 0, 19 archivos, 214 pruebas (una corrida a la vez que un `next build` dio 2 fallos por tiempo; repetida sin carga, 0)
- `grep -rn "minigames/canon" packages apps --include=*.ts --include=*.tsx` → sin resultados (exit 1)
- `E2E_PORT=3219 pnpm e2e mar-canon.spec.ts minijuegos.spec.ts --workers=1` → exit 0, 34 passed (móvil y escritorio)
- `E2E_PORT=3221 pnpm e2e logros.spec.ts mar-fiestera.spec.ts --workers=1` → exit 0, 16 passed, 2 skipped
- `python3 tools/spec/estado.py` → exit 0 (HECHO 162, PARCIAL 66)
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 139 archivos, 1243 pruebas
- `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0 (landing 186,9 kB de 200); `pnpm typecheck` → exit 0

Pendiente:
- Hernán: jugar la beta con la guía y apuntar las seis respuestas (entrada del plan 011).
- Decisión final: `puf` o `sumergirse` (con `puf`, Álvaro aprueba el cambio de REQ-AVE-037) y validar por tiempo activo en el Cañón (REQ-AVE-038).
- La descripción del logro `canon` («Gana Cañón contra tiburones.») y la clave `minigame.canon.title` aún nombran el juego viejo (contenido `muestra`, fuera de esta tarea).

## 2026-10-04 — plan 010 T118: HUD, water bar, level-up cards, pause with the /mar menu, end screen, BETA label

Qué existe:
- `apps/web/app/mar/canon-hud.tsx` + `canon-hud.css`: la interfaz del Cañón, al estilo de los chips de la carrera. `CanonLayer` (lo único que cablea `mar-client`) pinta:
  - HUD arriba al centro (`mar-canon-hud`): «BETA», la cuenta atrás 7:00 → 0:00, el botón de pausa (44 px) y debajo «Nivel N» con su barra de experiencia. Lee la partida cada 100 ms y sólo repinta si cambia lo que se ve.
  - Agua a bordo bajo el barco (`mar-canon-agua`), colocada y seguida por el motor (`Mar3D.anchor(el, 'ship')`): 72–84 px, marcas cada cuarto y un rayado que cambia por tramos (ok / alerta ≥50 % / peligro ≥75 %: cuadros y borde grueso), no sólo el color; `role="meter"`.
  - Cartas de nivel (`mar-canon-cartas`): 1 de 3, entradas de concierto crema con su trepado; en el móvil en columna, en escritorio en fila; cada una dice el nombre, lo que da exactamente (`survivors.upgrade.<id>.efecto`, con % o unidades desde la config) y «Nueva» / «Nivel n de max» con sus puntos. Teclado: flechas (dan la vuelta), 1–3 para ir a una, Intro o espacio para elegir; el foco entra en la primera y vuelve al salir; 350 ms tras abrirse no se elige (sin elegir sin querer). Mientras, la partida está en `card` (pausa del reloj de T98).
  - Pantalla final (`mar-canon-final`): «¡Amanece!» (cielo con el sol saliendo) o «¡Barco inundado!» (agua), tiempo jugado, enemigos, notas y nivel; «Otra vez» (partida nueva donde está el barco) y «Volver al mar» (el mundo vuelve con un fundido de 0,64 s; sin fundido con movimiento reducido). La escena se queda quieta detrás hasta entonces.
  - Abandono (más de 5 min en pausa): el mundo vuelve ya y sale un aviso corto (`mar-canon-aviso`, 8 s o ×).
- Pausa manual: el botón del HUD y Esc abren el menú normal de `/mar`; el menú, con partida, avisa «si sales de esta página (por ejemplo, para comprar entradas), la partida termina» y tiene «Seguir jugando» (`mar-menu-partida`). Cerrarlo sigue. Esc en la pantalla final = «Volver al mar».
- Restos de T116: la carta ya no se elige sola (`SurvivorsRun.choose(i)`, `autoPickCards` por defecto false); cualquier ficha abierta durante la partida (p. ej. «Mis códigos» desde el menú) la pausa.
- «BETA» también en el panel de la isla del Cañón (`InWorldCopy.badge`, `panel-minijuego-beta`).
- `canon-hud-model.ts` (puro): `formatClock` / `formatPlayed`, `percent`, `waterLevelOf`, `canonView`, `cardAmount`, `cardKeys`, `cardKeyAction`, `canonResult`, `END_KEYS`.
- Atajo de desarrollo nuevo `&carta=1` (con `devShortcutsEnabled`): empieza con una carta de nivel abierta (`SurvivorsRun.devLevelUp`). Gancho de pruebas: `data-mejoras` y `data-carta` en `mar-canon`.
- El interruptor de desarrollo «Derrota: …» (T117) baja, durante la partida, abajo a la izquierda, para no pisar el HUD en el móvil.
- Textos en `apps/web/lib/i18n/es-mar.ts` (`mar.canon.*`, `survivors.upgrade.*`), todos `muestra`.

Comandos:
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 136 archivos, 1222 pruebas
- `sh tools/spec/checks.sh` → exit 0
- `pnpm lint` → exit 0; `pnpm build` → exit 0; `pnpm typecheck` → exit 0
- `E2E_PORT=3191 pnpm e2e mar-canon.spec.ts --workers=1` → exit 0, 20 passed (móvil y escritorio; 5 pruebas nuevas por proyecto)

Pendiente:
- T119: sesión y premio al acabar (`onEnd` de `useCanonMode` se llama en el momento del final), e2e del abandono por pausa de 5 min y de la Fiestera a bordo, `docs/spec/estado.md` (REQ-AVE-039 sigue PARCIAL) y la guía de prueba (incluir `&carta=1`).
- Hernán: probar en el móvil el tamaño de las cartas y de la barra de agua con la cámara lejos.

## 2026-10-04 — plan 010 T106: Durable stamps and achievement progress across sessions

Diagnóstico (reproducido con las pruebas nuevas sobre el código de main, 9 fallan):
- Con cuenta, el sello de una compra de prueba sólo vivía en el libro local
  (`stamp:<compra>`); cada lectura del servidor sustituye el libro por el
  suyo, que no tiene sellos de prueba (decisión 9), así que el sello se iba
  aunque la compra seguía en la copia `save_snapshot`.
- Un choque de copia (`snapshot_conflict`, otro dispositivo guardó antes)
  hacía ganar al servidor y tiraba logros completados sin reclamar,
  descubrimientos, etc. de este dispositivo.
- Un campo que faltaba en la copia del servidor se aplicaba como vacío.
- Al cerrar sesión se borraba la copia de la cuenta aunque su copia
  `save_snapshot` aún no se hubiera guardado; `identity.reset` vaciaba la
  copia y eso se mandaba luego como borrado.

Qué existe (parte del intento de Codex, revisado, más lo de esta sesión):
- `packages/store/src/local.ts` `stampViews`: el sello de prueba se proyecta
  desde la compra `sandbox` confirmada (prueba que persiste), marcado
  `isSample: true`; cancelada/reembolsada o con el sello compensado
  (`sample-stamps.ts`, guardado en la copia como ajuste
  `sample-stamp-revoked:<fiesta>`) no sale. Un sello por fiesta: el del QR
  (asistencia verificada, `isSample: false`) manda sobre el de prueba. Leer
  no escribe ni premia.
- `packages/store/src/member/snapshot-merge.ts`: fusión a tres bandas (última
  copia reconocida, esta copia, la del servidor) sólo de lo que no tiene
  valor: descubrimientos y logros completados se suman, ajustes/misiones/
  récords/compras por edición respecto a la base, contadores por máximo. Un
  campo ausente en la copia del servidor no borra nada. Saldos, sellos QR y
  premios no pasan por aquí.
- `member.ts`: al leer del servidor se fusiona (no gana el servidor); un
  choque se rebasa y se reintenta (2 veces, luego programado);
  `sync.snapshotPending()`; un acuse que llega tras `dispose` no toca la cola
  ni la copia de la instancia nueva; `identity.reset` relee sin vaciar. Nuevo
  en esta sesión: una copia vacía con la cola guardada parte de la última
  copia reconocida (si no, lo ausente se tomaba por borrado y se mandaba).
- `apps/web/lib/member-cache.ts`: al cerrar sesión la copia de la cuenta sólo
  se borra si no queda nada sin mandar (cola vacía y copia reconocida); si
  queda, se guarda bajo su clave, aislada del invitado y de otras cuentas.
- `apps/web/lib/mundo/achievements.ts` `reconcileAchievementEvidence`, al
  leer la cuenta (`repo-member.ts`): completa (nunca reclama) sólo con prueba
  guardada: el logro del Carnet reclamado en el libro y los sellos de compra
  para `buy_ticket`. El cupón del náufrago no prueba la entrega (T115 cambia
  esa condición). Idempotente.
- `use-carnet.ts`: un sello de prueba lleva la marca de muestra.

Pruebas: `member.test.ts` (sello+Carnet+náufrago tras cerrar sesión y volver
dos veces con copia nueva sin repetir premios; cuentas A/B en el mismo
navegador; copia vacía con cola; campo ausente del servidor; sin red/cierre
temprano/reintento; acuse durante la edición; acuses de instancias
destruidas; dos dispositivos; invitado → cuenta nueva vía copia de
`merge_guest`; QR manda sobre prueba), `carnet.test.ts` (recarga sin
cuentas, revocación/cancelación), `snapshot-merge.test.ts`,
`member-cache.test.ts`, `achievements.test.ts`, e2e `carnet.spec.ts`
(volver y recargar el Carnet conserva el sello).

Comandos (desde la raíz del worktree):
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0 (136 archivos, 1213 tests)
- `sh tools/spec/checks.sh` → exit 0
- `pnpm lint` → exit 0; `pnpm build` → exit 0; `pnpm typecheck` → exit 0
- `E2E_PORT=3871 pnpm e2e carnet.spec.ts logros.spec.ts tickets.spec.ts carnet-descuento.spec.ts --workers=2` → exit 0 (22 passed, 2 skipped: Supabase)

Lo histórico que no se puede recuperar (sin prueba suficiente):
- Logros completados sin reclamar (WhatsApp, náufrago, etc.) que un choque
  ya tiró antes de este arreglo: no dejan fila en el libro.
- Compras de prueba que nunca llegaron a una copia del servidor (cerrar
  sesión antes de guardarla): su sello no tiene de dónde salir.
- Lo reclamado (puntos, monedas, barco del Carnet) está en el libro del
  servidor y no se perdió.

Pendiente:
- Sin e2e con Supabase real (no se escriben servicios remotos); el modo
  cuenta se cubre con `FakeSupabase`.
- Invitado → cuenta que ya tenía copia: `merge_guest` se queda con la de la
  cuenta (decisión 4) y el sello de prueba del invitado no pasa; cambiarlo es
  alcance nuevo.
- Con lo pendiente sin mandar, la copia de la cuenta queda en el navegador
  tras cerrar sesión (antes se borraba y se perdía).

## 2026-10-04 — plan 010 T117: Modelos provisionales, notas en el agua y los dos estilos de derrota

Qué existe:
- `apps/web/app/mar/engine/survivors-props.ts` (nuevo): modelos low-poly hechos en código con `Kit` y la paleta `C`, como `race-props.ts`. Piraña roja con lomo azul marino, dientes y ojos grandes (larga hacia +x); cangrejo naranja con coraza de hierro remachada, pinzas, patas y ojos en palitos (más ancho que largo); bola del cañón de agua (gota azul clara con brillo y estela); notas por figura (corchea con corchete, negra rellena, blanca hueca con plica, redonda hueca sin plica), recostadas hacia la cámara y con un aro de espuma en el agua. Cada pieza se pinta más grande que su radio de choque (piraña ×1.6, cangrejo ×1.2), para leerse en el móvil con la cámara más lejos. Los enemigos que lleguen en betas posteriores usan un modelo genérico. muestra
- Efectos de derrota: `PufFx` (`puf`: una nubecilla de partículas; todas las derrotas en una sola `InstancedMesh`) y `SinkFx` (`sumergirse`: el mismo enemigo da un saltito y se hunde de cabeza con un aro de espuma, sin heridas, REQ-AVE-037; los hundidos van en su propia `InstancedMesh` por tipo, compartiendo geometría y material, así que no cuentan en el tope). Piscinas fijas por calidad (`alta` 24, `baja` 10; `puf` 7 partículas en `alta`, 4 en `baja`); llena, se reusa la más vieja. `defeatPlan(style, {quality, reduced})` sale de una tabla fija.
- Movimiento reducido (el mismo `matchMedia` que ya usa la fauna de `Mar3D`): el barco no parpadea, la cámara no tiembla con los golpes (`hitShake`), los enemigos y las notas no se mecen, `puf` es una sola nubecilla que se apaga en su sitio y `sumergirse` un hundimiento corto sin salto ni chapoteo.
- Golpe en el barco: parpadeo a 8 Hz mientras dura la invulnerabilidad (0,5 s en la config), sólo jugando (en pausa o con la carta abierta el barco se ve siempre); temblor de cámara pequeño con cada golpe.
- `survivors-view.ts` reescrita con los modelos: una `InstancedMesh` por enemigo de la config y por figura de nota, con el tope de la calidad; nada se crea al pintar (bucles por índice, sin `Map` ni arrays por fotograma). `Mar3D`: `startSurvivors` pasa calidad y movimiento reducido; los eventos `hit`/`defeated` de cada paso llegan a la vista; `setSurvivorsDefeatStyle(style)`; `data-derrota` en el lienzo durante la partida.
- Interruptor de desarrollo del estilo de derrota: botoncito «Derrota: puf/sumergirse» (`data-testid="mar-canon-derrota"`) en el hueco del «!» de objetivos (que la partida esconde), sólo con `devShortcutsEnabled()`; cambia el estilo en vivo y lo recuerda para la siguiente partida de la sesión. El atajo `&derrota=puf|sumergirse` empieza con ese estilo (y se consume de la URL como los demás). Sin los atajos, siempre el de la config (`sumergirse`). Textos `mar.canon.dev.derrota*` en `es-mar.ts`.
- Pruebas: `survivors-props.test.ts` (18): una `InstancedMesh` con el tope por enemigo y por figura en `alta` y `baja`; cada nota en la pieza de su figura; colores y siluetas de los modelos; `baja` más barata; mismas matrices fotograma a fotograma; los dos estilos desde la config y desde el interruptor (y el interruptor gateado por los atajos); movimiento reducido sin parpadeo, sin temblor y con el efecto mínimo. `survivors.test.ts` al día (`defeatStyle` del atajo, notas por figura). e2e nueva en `mar-canon.spec.ts`: el interruptor cambia el estilo en vivo con `&derrota=puf` y siguen cayendo enemigos.

Comandos:
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0 (135 archivos, 1211 pruebas)
- `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0; `pnpm typecheck` → exit 0
- `E2E_PORT=4517 pnpm e2e mar-canon.spec.ts --workers=1` → exit 0 (10 pasadas, móvil y escritorio)

Pendiente:
- El HUD, las cartas, la pausa y la pantalla final son de T118; quitar el interruptor y `&derrota=` al lanzar (plan 013) con los demás atajos.
- Notas en pantalla se ven poco en partidas normales: casi todos los enemigos mueren pegados al barco y el imán (90 u) recoge la nota al instante; con el barco quieto se inunda en ~20 s. Es equilibrio (propuesta de T98/T120), para la prueba de Hernán.

## 2026-10-04 — plan 010 T107: Blender Alicante harbor asset (Codex)

Qué existe (art-only; sin enlace a runtime, ni manifest vivo de islas, ni IDs de mundo):
- `tools/blender/places/{cala.py,common.py,check.py,fresh_import.py,test_check.py,place3d.schema.json,distance_camera.mjs,README.md}`: fuente procedural, contrato de colocación normalizado (radio 1, origen en el centro, fuente Z arriba / GLB Y arriba, frente +Z, agua Y=0, escala = radio de colisión de escena / radio), esquema para cala/fotos/tienda (sólo cala construida), validador y prueba de importación limpia.
- `art/places/3d/cala/`: `cala.blend` (1.95 MB, editable), `cala.glb` (427148 bytes), `manifest.json`, `reference_notes.md`, `requirement_ledger.md`, `final_report.md`, `work_state.md`.
- Métricas: 11404 triángulos (límite 12000), 427148 bytes (límite 600000), 10 materiales, 0 clips, extensión radial 0.9665, altura 0.5558. Blender 5.2.2 LTS (el de node_modules del checkout de Codex, sólo lectura). Se eliminaron los 240 triángulos degenerados (fragmentos colineales de teselación) de forma reproducible.
- Renders de evidencia (vistas, día/noche, distancia de juego) fuera del repo en `node_modules/t107-preview/` (ignorado); rutas en el ledger. Sin imágenes de referencia en assets públicos.

Comandos (desde la raíz del worktree):
- `python tools/blender/places/check.py` → exit 0 (11404 tris, 427148 bytes)
- `python tools/blender/places/test_check.py` → exit 0
- Blender `--background --factory-startup --python-exit-code 1 --python tools/blender/places/fresh_import.py -- --manifest art/places/3d/cala/manifest.json` → exit 0, PASS 11404 tris, 10 materiales
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0 (129 archivos, 1160 tests)
- `sh tools/spec/checks.sh` → exit 0
- `pnpm lint` → exit 0; `pnpm build` → exit 0; `pnpm typecheck` → exit 0

Pendiente:
- T108: enlace en runtime; el puerto debe sustituir TODA la decoración anterior de la Cala (disco/orilla/props/luces) para que no llene la cuenca; mantener la cápsula de colisión y la aproximación exterior.
- T112: reproducción de clips (ModelStore descarta clips GLTF hoy); `motion` está reservado, no validado.
- Inspección de las fotos de referencia: heredada de la sesión anterior de Codex, no repetida.
- La valoración estética del ledger es autoevaluación del creador, no revisión independiente.

## 2026-10-04 — plan 010 T120: Merge the Codex world updates (codex/world-updates) into main

La rama de Codex (`608f883`, plan 009 T98–T104: tipografía y logo, crucero a
15 nudos y «!» que sólo marca el objetivo, náufrago/WhatsApp/Cala, Santa
Bárbara de Blender, peces y gaviotas, tienda de muestra, preguntas del
Carnet) está fusionada en main con un merge `--no-ff` (padres: main 1fda6ef y
608f883). Las tareas sin terminar de Codex (T105–T115) no entran.

Qué existe:
- Único conflicto, `apps/web/app/mar/mar-client.tsx`, con las dos
  intenciones: el objetivo marcado se limpia al cumplirse y las botellas se
  paran en la partida; un solo efecto manda los rótulos al mar (objetivo `!`
  y boia de carrera de Codex; en la partida del Cañón sólo islas); el
  minimapa recibe `objective` y los rótulos/«?» filtrados de T116. Se quitó
  el efecto viejo `pinsOf` (pisaba al nuevo). Finales de línea CRLF como en main.
- Lista de lo que la partida esconde (`apps/web/app/mar/survivors.ts`,
  `HIDE_LAYERS`), con dos capas nuevas para lo interactivo/vivo que trajo Codex:
  - `objective`: el botón «!», su panel y el objetivo marcado (rótulo en el
    mar y marca del minimapa); el objetivo se conserva y vuelve al acabar.
  - `wildlife`: peces y gaviotas fuera (`Wildlife.setHidden`, sin relojes
    mientras; `Mar3D.setWildlifeHidden`/`wildlifeHidden`; lienzo
    `data-fauna-oculta="on"`).
  Lo demás de Codex ya quedaba cubierto: el náufrago, la boia de WhatsApp y
  la Cala sólo actúan por eventos del runtime, que no corre en la partida, y
  sus rótulos ya los quita `islandPinsOnly`.
- Maniobrabilidad: `survivorsShipConfig` ya era relativa (factores sobre la
  config del barco); en la partida el barco hereda el crucero de 15 nudos de
  `MAR_SHIP_CONFIG` con más giro y aceleración. Pruebas nuevas lo comprueban.
- Pruebas: `survivors.test.ts` (capas nuevas, se van y vuelven; factores
  sobre `MAR_SHIP_CONFIG`; en la partida llega a su crucero de /mar, no más,
  y antes que fuera), `wildlife.test.ts` (oculta = sin fauna, vuelve como
  nueva), `mar-canon.spec.ts` (fauna oculta, sin «!» ni marca de objetivo
  durante la partida; de vuelta al acabar). En
  `packages/engine/src/survivors/survivors.test.ts` el muestreo de
  determinismo pasa a cada 5 s (la partida guionada dura menos a 15 nudos).

Comandos:
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 134 archivos / 1193 pruebas.
- `sh tools/spec/checks.sh`, `pnpm lint`, `pnpm build` (186,9/200 kB), `pnpm typecheck` → exit 0.
- `E2E_PORT=3241 pnpm e2e mar-canon mar-circuito mar-fiestera carnet-questions mar-ayuda mar-decor mar-wildlife merchandise tipografia world-community --workers=1` → exit 1: 77 passed, 8 skipped, 3 failed (mar-circuito «Los Rápidos… medalla» en móvil y escritorio; mar-decor móvil, que pasó al repetirlo).
- `E2E_PORT=3243 pnpm e2e mar-decor.spec.ts mar-circuito.spec.ts --workers=1` → exit 1: 8 passed, 2 failed (las dos de medalla).

Pendiente:
- `mar-circuito.spec.ts` «Los Rápidos: … medalla…» falla: a 15 nudos el piloto
  de la prueba (sin turbo) acaba con `data-medalla="ninguna"`. Viene de la
  rama de Codex (su T99 ya quitó esa comprobación de la prueba unitaria: «la
  medalla pide turbo»), no de la fusión. Lo arregla T109 (22 nudos sólo en la
  carrera); probar turbo en el piloto de la e2e no basta (en móvil anula la carrera).
- Equilibrio del Cañón: las pirañas van a 150 u/s, igual que el barco a 15
  nudos (antes 220); escapar es más difícil. Para el ajuste de sensaciones de Hernán.

## 2026-10-04 — plan 009 T99: The mode inside /mar: start and end in the same world, hiding, race lock, handling, camera, dev shortcuts

El Cañón «Que no pare la música» ya se juega dentro de `/mar`, donde está el
barco, con la simulación de T98. Sin HUD todavía (T101): piezas provisionales
y el estado en atributos `data-*` para las pruebas.

Qué existe:
- **`apps/web/app/mar/survivors.ts`** (sin three.js ni React):
  `devShortcutsEnabled()` (el único interruptor: `pnpm dev`, e2e por
  `navigator.webdriver`, o `?dev=1` en producción), `canonShortcut()`
  (`?minijuego=canon&t=<s>&seed=<n>`, y `&oferta=1` = sólo el panel de la
  isla), `withoutCanonShortcut()`; las capas que la partida esconde
  (`HIDE_LAYERS`: route, sheets, bottles, discounts, encounters, minimap;
  `LAYER_KINDS` = `kind` de las vistas del 3D) con `hideForGame()` (devuelve
  la restauración: sólo lo que escondió, una vez) y `marHideHost()`;
  `survivorsSea()` (planeta de `/mar`, islas y decorado sólido, sin lo
  escondido); `canonBlockKey()` (bloqueo en carrera); `islandPinsOnly()`;
  `SurvivorsRun` (simulación + `SurvivorsClock` con tiempo real; pestaña
  oculta = pausa; >5 min abandona; elige sola la primera carta de nivel hasta
  T101; `onEnd` una vez; `hook()` para las pruebas).
- **`apps/web/app/mar/canon-mode.tsx`**: `useCanonMode()` (empezar donde está
  el barco, esconder/restaurar, pausa con paneles o menú encima, intervalo de
  pestaña oculta, atajo al estar listo, props del panel) y `CanonTestHook`
  (`data-testid="mar-canon"`: `data-estado`, `-tiempo`, `-activo`, `-agua`,
  `-agua-max`, `-nivel`, `-enemigos`, `-derrotados`, `-notas`, `-fin`,
  `-semilla`, `-calidad`, `-barco`). **Gancho de T101**: la opción `onEnd`
  de `useCanonMode` (en `mar-client` hay un comentario donde va la pantalla final).
- **`apps/web/app/mar/engine/survivors-view.ts`**: piezas PROVISIONALES
  (`InstancedMesh` por enemigo, bolas y notas por figura, tamaño = tope de la
  calidad; curvadas con la vuelta del planeta). T100 las sustituye.
- **`mar3d.ts`**: `startSurvivors(run)` / `stopSurvivors()` /
  `survivorsActive`: con partida el bucle da los pasos de la simulación (que
  lleva el barco con la maniobrabilidad de la config) en vez de
  `stepShip`+runtime; la cámara se aleja/sube con `config.camera` y vuelve en
  `blendS`; sin mapa, rumbo, viaje, vuelo ni turbo. `setKindsHidden()`,
  `routeHidden`, `quality` (`detectQuality`), `solidDecor`; lienzo
  `data-canon` on/off y `data-escondido`.
- **`minigame-layer.tsx`**: `inWorld`/`onPlayInWorld`/`blockedReason`/`copy`:
  el panel del Cañón empieza el modo 3D (o explica el bloqueo,
  `data-bloqueado`, `panel-minijuego-bloqueo`); `?minijuego=canon` ya no
  monta el 2D. El Faro igual.
- `mar-client.tsx`: cableado fino (hook, pines/minimapa sólo islas, sin «?»,
  sin botellas cerca, fichas al tocar pines, invitaciones, cambio de mundo,
  «Otra vez» de la carrera y viajes durante la partida).
- i18n (`es-mar.ts`): `mar.canon.title|summary|lock.race`,
  `survivors.upgrade.*` (6, con `{amount}`).
- `SurvivorsClock.alpha` (engine, con prueba) para pintar entre pasos.
- e2e nuevo `apps/web/e2e/mar-canon.spec.ts` (4 pruebas × móvil/escritorio).

Comandos:
- `pnpm exec vitest run apps/web/app/mar/survivors.test.ts packages/engine/src/survivors` → exit 0, 52 pruebas.
- `E2E_PORT=3217 pnpm e2e mar-canon.spec.ts mar-circuito.spec.ts mar-fiestera.spec.ts --workers=1` → exit 0, 24 passed (7,0 min).
- Comando de pruebas → exit 0: vitest 129 archivos / 1160 pruebas, checks.sh, lint, build y typecheck.

Pendiente:
- `apps/web/e2e/minijuegos.spec.ts`: las 2 pruebas del cañón 2D ya no pueden
  pasar (el panel y `?minijuego=canon` abren el modo 3D); T102 las quita.
- HUD, cartas, pausa con menú y pantalla final (T101); modelos y estilos de
  derrota (T100). Mientras, la carta de nivel se elige sola.

## 2026-10-04 — plan 009 T98: Survivors simulation in packages/engine/src/survivors/ with seed tests

La simulación del nuevo Cañón («Que no pare la música», beta 1), pura y
determinista, sin three.js ni DOM. Todavía no la usa nadie: T99 la cablea
en `/mar`.

Qué existe:
- **`packages/engine/src/survivors/`** (nuevo; subruta `@boia/engine/survivors`):
  - `config.ts`: `SURVIVORS_CONFIG` versionada (`version: 1`) con todo el
    equilibrio y `survivorsConfigHash()` (FNV de `rng.ts`, para el
    `configHash` de la sesión en T102). Tipos de los catálogos completos del
    diseño (6 enemigos, 7 armas, 9 vinilos, evoluciones, bosses con fases,
    guion por acto con hitos), con sólo lo de la beta: `piranha`, `crab`,
    `canon` y 6 mejoras (`damage`, `fireRate`, `projectiles`, `speed`,
    `magnet`, `bailing`, cada una con `i18nKey` `survivors.upgrade.<id>`,
    stat, cantidad y tope). También `handling` (factores sobre la física de
    `/mar`: más giro, menos inercia; `survivorsShipConfig`), `camera`
    (`distanceScale` 1,25, `heightScale` 1,15, `blendS`), `defeatStyle`
    (`sumergirse` por defecto), topes por `QualityTier` (alta 150/120/200,
    baja 60/60/100 enemigos/balas/notas) y el guion del acto 1 en datos
    (pistas con curva por puntos, 7:00). Todo `muestra`.
  - `sim.ts`: `createSurvivors(config, seed, world, { quality, ship, startAtS })`
    → `SurvivorsGame` con `step(input)` a 1/60 s (input = `ShipInput` +
    `choose` + `pause`), `snapshot()` (reutilizado, sin copias), sucesos por
    paso (`hit`, `defeated`, `fire`, `blocked`, `note`, `levelUp`, `end`),
    `stateHash()`, `elapsePause(s)`, `setPaused`, y ganchos `spawnEnemy` /
    `spawnNote` / `onLand` para pruebas y atajos. El barco usa `stepShip` +
    `collideShip` de `/mar`; enemigos rodean islas (rumbo + deslizar con
    `pushOutWrapped`), anillo fuera de cámara validado contra islas,
    reciclado de los lejanos, tope con «presión» (más aguante en vez de más
    enemigos), Cañón de agua al más cercano con balas que las islas paran,
    notas por figura con fusión e imán, carta 1 de 3, agua a bordo, final
    `survived` / `flooded` / `abandoned` (pausa seguida > 5 min).
  - `clock.ts`: `SurvivorsClock.frame(game, realDtS, hidden)` → pasos que
    tocan; la pestaña oculta y los huecos > 0,25 s cuentan como pausa.
  - `grid.ts` (`SpatialGrid`, rejilla que da la vuelta) y `world.ts`
    (`SurvivorsWorld`, `survivorsWorldOf` con `solidObstaclesOf`,
    `IslandIndex` con listas por celda).
- **`packages/engine/src/world/wrap.ts`** (nuevo): `wrapDelta`, `wrapInto`,
  `Period`, `periodOf`, `shortest`. `ship/controller.ts` los reexporta y
  `apps/web/app/mar/engine/wrap.ts` reexporta `wrapD`/`wrapIn`/`Period`/
  `periodOf`/`shortest` desde `@boia/engine` (mismos nombres, mismo cálculo).
- `ship/controller.ts`: `collideWrapped` usa la nueva `pushOutWrapped`
  (exportada; mismas cuentas), compartida con los enemigos.

Comandos:
- `pnpm exec vitest run packages/engine/src/survivors` → exit 0, 30 pruebas
  (~20 s): determinismo por hash, topes alta/baja en 7:00 enteros (y que se
  tocan), nada en tierra en 3 mundos/semillas, `survived` justo a 7:00,
  `flooded` sin esquivar, invulnerabilidad 0,5 s, pausa 5:01 → `abandoned`
  sin tiempo activo, reloj con pestaña oculta, carta que para el reloj,
  islas que paran balas, fusión de notas e imán, rodeo de islas, reciclado,
  presión del tope, `t=` determinista.
- Test command por pasos: vitest → exit 0 (128 archivos, 1138 pruebas);
  `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` →
  exit 0; `pnpm typecheck` → exit 0.

Pendiente:
- T99: cablear en `/mar` (mundo con `survivorsWorldOf(world, planetRect(…),
  barco, decorSolids)` y `MAR_SHIP_CONFIG` como `ship`), cámara con
  `config.camera`, claves i18n `survivors.upgrade.*`.
- Equilibrio sin probar a mano: sin esquivar el barco se inunda en
  menos de un minuto; ajustar tras la prueba de Hernán.

## 2026-10-03 — plan 008 T95: Docs, spec status and the decision draft

El plan 008 cerrado sobre el papel: README, `.env.example`, TRASPASO, la
lista de entrega, el estado de la spec, el borrador de D-27 y la lista de
producción con Supabase. Sin código. `docs/DECISIONES.md` no se ha tocado.

Qué existe:
- **`docs/propuestas/2026-10-03-d27-borrador.md`** (nuevo): el texto
  propuesto de **D-27** (cuentas por email con Supabase: cuándo se pide el
  email, código de 6 cifras sin enlace, consentimiento RGPD, fusión del
  invitado siempre, apodos únicos, qué se guarda y el antitrampas básico,
  rankings globales, sellos por QR, el Carnet carné, Admin con código +
  TOTP, botellas globales, modo local). Dice exactamente qué sustituye de
  D-20 (puntos 2, 3 y 4 y la lista «Para la versión final»), D-10 (enlace
  mágico y contraseña del Admin), D-09 (ranking global de tiempos ya, sin
  semilla ni duración verificadas) y D-17 (pruebas contra el proyecto real).
  Cierra **P7** y propone **P23** (uso de la lista de emails), **P24**
  (importes de puntos y topes), **P25** (qué es una temporada), **P26** (arte
  final del Carnet) y **P27** (dominio definitivo); amplía P21. Lista los
  cambios de la spec hechos y los propuestos sin hacer (REQ-ADM-002/003,
  REQ-IDE-023 y REQ-AVE-034 de L2 a L1).
- **`docs/propuestas/2026-10-03-produccion-supabase.md`** (nuevo): la lista
  de producción para Hernán, en orden: proyecto aparte (UE, plan Pro por las
  copias), migraciones con las variables de producción en la terminal
  (`pnpm db:migrate:dev`, se niega con otro proyecto), Auth (OTP 6 / 600 s,
  TOTP), SMTP propio (Gmail con contraseña de aplicación para probar, Resend
  con el dominio para producción, límites), las plantillas en español de
  T89, las URL de Auth, las dos variables `NEXT_PUBLIC_` en Vercel y volver a
  desplegar, `pnpm admin:grant -- <email> owner` y un segundo propietario,
  las fiestas y sus QR, quitar la muestra (`remove-sample.sql`, que también
  quita cosméticos y descuentos), copias y comprobación final;
  `pnpm db:clean-test-users` sólo en desarrollo.
- **`README.md`**: sección nueva «Cuentas con Supabase (plan 008)» (montar
  un proyecto, las cuatro variables y quién usa cada una, tabla de
  comandos: `db:migrate:dev`, `db:types:dev`, `test:supabase`,
  `E2E_SUPABASE=1` con sus specs, `admin:grant`, `db:clean-test-users`,
  `db:test`; dónde está cada cosa); «En local», «Probar», «Desplegar»
  (URL `boia-planet-roan`, temporal; variables de Vercel para las cuentas) y
  «Entrega» al día; la landing pesa 185,5 kB.
- **`.env.example`**: la sección de Supabase dice qué va a Vercel (sólo las
  dos `NEXT_PUBLIC_`) y qué no, `admin:grant`, `db:clean-test-users`,
  `-- --no-seed`, y que el SMTP, las plantillas y las URL van en el panel de
  Supabase.
- **`docs/TRASPASO.md`**: estado con el plan 008 (rutas `/carnet`,
  `/carnet/<id>`, `/sello`, `/admin` con cuentas, ranking y botellas
  globales), fila del plan 008, sección «Las cuentas del plan 008» (qué hace
  Hernán y qué decide Álvaro: P21, importes, arte final del Carnet, uso de
  la lista de emails), propuestas del plan 008, la versión final al día.
- **URL de prueba**: `boia-planet.vercel.app` → `https://boia-planet-roan.vercel.app`
  (temporal hasta el dominio definitivo) en `CLAUDE.md`, `docs/TRASPASO.md`
  y `docs/entrega.md` (no quedaba en ningún otro sitio fuera de `plans/`).
- **`docs/entrega.md`**: URL, Admin con TOTP, migraciones aplicadas a
  `boia-planet-dev`, integraciones, comprobación con `test:supabase` y
  `db:clean-test-users` antes de enseñar un despliegue con cuentas.
- **`docs/spec/`**: REQ-IDE-002 (código de 6 cifras, sin enlace) y
  REQ-IDE-005 (progreso del invitado validado al entrar, sin identidad
  anónima de servidor) reescritos en `05` y `09` citando «plan 008 (borrador
  D-27)»; párrafos del plan 008 en `05`, `07` y `08`. `estado.md`:
  - de `final` a HECHO: REQ-IDE-002, IDE-003, IDE-005, IDE-039, ADM-003,
    ADM-006, ARQ-002, ARQ-011; de `final` a PARCIAL: REQ-IDE-006 (la prueba
    de fusionar dos veces está en `economy.supabase.ts`, que `estado.py` no
    cuenta) y ARQ-010 (topes por acción y día, sin cadencia); REQ-IDE-050
    (L2) a PARCIAL (borrar sí, exportar no);
  - notas al día en IDE-001, IDE-010, IDE-038, IDE-051, ENT-032, COM-035,
    COM-018, ADM-007, ARQ-012, ARQ-013, ARQ-022, ARQ-024, ARQ-025;
  - ya movidos por T88–T96 y comprobados: IDE-023, AVE-034, IDE-040…044,
    IDE-053, ADM-002/004/027/028/039, AVE-019.

Comandos:
- `python3 tools/spec/estado.py` → exit 0: 294 REQ · HECHO 163 · PARCIAL 65 ·
  FALTA 31 · L2 25 · final 9 · retirado 1 (antes del T95: 155 / 62 / 31 /
  26 / 19 / 1; antes del plan 008: 151 / 63 / 32 / 28 / 19 / 1).
- `python3 tools/spec/check.py` → exit 0 (294 requisitos, 0 duplicados,
  centinelas 10/10); `test_check.py` 18 OK; `test_estado.py` 8 OK.
- Comando de prueba, por pasos: `pnpm exec vitest run --exclude
  '**/packages/db/**' --testTimeout=30000` → 127 archivos, 1102 pasan y 6
  fallan por tiempo (30 s) con la máquina cargada (`catalog`, `physics`,
  dos `worlds`, `arcilla`; sin código tocado); esos 5 archivos otra vez →
  exit 0, 50 pasan. `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit
  0; `pnpm build` → exit 0 (185.5 kB · presupuesto 200 kB · OK);
  `pnpm typecheck` → exit 0.

Pendiente:
- Hernán: leer y aprobar el borrador de D-27, pasarlo a `DECISIONES.md`
  (con sus P nuevas) y cambiar «borrador D-27» por «D-27» en `docs/spec/`.
- REQ-ADM-002/003 (texto con contraseña) y REQ-IDE-023 / REQ-AVE-034 (L2,
  ya construidos) esperan a D-27 para cambiar de texto o alcance.
- `tools/spec/estado.py` sólo cuenta como prueba `*.spec.ts`, `*.test.ts(x)`
  y `test_*.py`: las de `packages/db/src/supabase/*.supabase.ts` no suben un
  REQ a HECHO (REQ-IDE-006, REQ-ARQ-010). Su lista `FINAL` (sólo para
  `--generar`) aún nombra REQ que ya no son `final`.
- Las plantillas de correo en español en `boia-planet-dev` (lista de
  producción, paso 5) y toda la lista de producción.

## 2026-10-03 — plan 008 T94: /admin on real data: email + TOTP login and four sections

Con Supabase, /admin pide el código del email y después el TOTP (decisión
11); sin rol del equipo, «Sin acceso». Dentro, cuatro secciones van sobre
datos reales; el resto sigue siendo la demo de este navegador. Sin las
variables de Supabase (producción hoy) /admin es el «Probar admin» de
siempre (D-20).

Qué existe:
- **Entrada** (`apps/web/app/admin/real/gate.tsx`, `apps/web/lib/account/admin-auth.ts`):
  email → código de 6 cifras (`signInWithOtp` sin crear cuentas; un email sin
  cuenta ve lo mismo) → con fila en `staff_roles` (se lee con aal1, RLS
  propia) el TOTP: la primera vez alta con el QR de Supabase MFA y la clave
  para escribir a mano; luego sólo el código → `aal2` → dentro. Sin fila,
  «Sin acceso» con «Cerrar sesión». Banner azul «Admin con cuentas» con
  quién entró, su rol y «Cerrar sesión». Un editor entra, pero las cuatro
  secciones reales le dicen que piden admin.
- **`pnpm admin:grant -- <email> <owner|admin|editor|none>`**
  (`packages/db/src/cli/admin-grant.ts`, argumentos en `src/grant.ts`): con
  la clave de servicio de `apps/web/.env.local`, comprueba que la base es del
  mismo proyecto, crea la cuenta confirmada si no existe y pone o quita el
  rol (auditado por el disparador de `staff_roles`; el último propietario no
  se quita). Hernán lo corre con su email.
- **`pnpm db:clean-test-users [--all | --minutes N]`**
  (`packages/db/src/cli/clean-test-users.ts`): borra las cuentas
  `@example.test` de más de 30 min (o todas con `--all`).
- **Fiestas y QR** (`real/fiestas.tsx`): las fiestas de Supabase con buscador;
  ventana del sello (desde/hasta), «Crear el QR», «Guardar ventana»,
  «Regenerar código» con confirmación (el QR anterior deja de valer); el QR
  de `/sello?e=&c=` grande, «Proyectar QR» (pantalla blanca entera, Esc),
  «Descargar PNG» (1200 px con el nombre) e «Imprimir o PDF» (sólo la hoja
  del QR). **Imagen del sello**: subir archivo o traer de una URL; PNG, WebP o
  JPEG ≥ 512 px y ≤ 2 MB (por los bytes, nunca SVG); la copia propia 512 ×
  512 en WebP (PNG si el navegador no sabe) va al bucket público
  `stamp-images`; la URL la descarga una vez el servidor
  (`app/api/admin/stamp-image/route.ts`: sólo admin/owner con aal2, https sin
  red local, ≤ 3 redirecciones comprobadas, 10 s) y se guarda igual. Vista
  previa con el sello de goma de T91. «Quitar imagen».
- **Socios y emails** (`real/socios.tsx`, `real/csv.ts`): lista y búsqueda
  (`admin_list_members`, 50 por página, «Mostrar más»): apodo, nº, email,
  alta, noticias sí/no con fecha y versión, política; «Exportar CSV (con
  noticias)» sólo con quien dijo que sí (BOM UTF-8, fórmulas escapadas);
  «Marcar como artista» / «Quitar artista»; «Borrar Carnet» (la cuenta y todo
  lo suyo) con motivo y escribiendo el apodo, auditado.
- **Moderación** (`real/botellas.tsx`): las botellas con reportes abiertos
  (con su autor), «Retirar» con motivo y «Descartar» un reporte; debajo, la
  moderación de Carnets de la demo local.
- **Rankings** (`real/rankings.tsx`): tiempos por circuito (`ranking_race`)
  con «Anular» + motivo; puntos de siempre con las entradas del libro de cada
  socio y «Anular» (compensación).
- **Migración `20261003100600_admin_real.sql`**: `my_staff_role()` (null sin
  aal2); `events.stamp_image_url` (sólo copias del bucket) y
  `admin_set_stamp_image`; el bucket `stamp-images` (público, 2 MB,
  webp/png) con escritura sólo del equipo con aal2; `admin_remove_bottle`,
  `admin_dismiss_bottle_report`, `admin_void_race_time`, `admin_void_points`
  (rechaza si las monedas ya se gastaron: `insufficient_coins`), todas con
  motivo y `audit_log`. **Botellas**: se quita a `authenticated` el INSERT y
  el UPDATE de x/y: sólo `place_bottle` fija la posición (el hueco que vio
  T93). Aplicada en `boia-planet-dev`; `database.types.ts` regenerado.
- **Contenido**: `stampImageUrl` en el evento (`packages/contracts`), con su
  campo en la sección Eventos de la demo; `stampArtFor`
  (`lib/mundo/carnet/use-carnet.ts`) lee con Supabase la imagen de
  `events.stamp_image_url` de cada sello (manda sobre la del contenido).
- i18n: `apps/web/lib/i18n/es-admin-real.ts` (`muestra`).
- `docs/spec/estado.md`: REQ-ADM-002, 004, 027, 028 y 039 con la nueva
  evidencia (siguen HECHO).

Comandos:
- `pnpm db:migrate:dev` → exit 0, «1 aplicadas de 14: 20261003100600»;
  `pnpm db:types:dev` → +45 líneas.
- `pnpm test:supabase` → exit 0, 8 archivos, 76 pruebas (nuevo
  `admin.supabase.ts`: rol sólo con aal2, Storage sólo el equipo y sin SVG,
  la imagen del sello, retirar y descartar, anular tiempo y puntos con
  auditoría; `bottles.supabase.ts`: x/y e INSERT directos denegados;
  `schema.supabase.ts`: `bottles.x/y/user_id` y `events.stamp_image_url` en
  `CLIENT_READ_ONLY_COLUMNS`); quedan 0 cuentas `@example.test`.
- `pnpm admin:grant -- boia-grant-check@example.test editor|admin|none` →
  «cuenta creada», «es editor», «es admin», «ya no tiene rol»; con un rol
  inventado → exit 1 «rol no válido».
- `pnpm db:clean-test-users` → «borradas 0 de 0»; `-- --all` tras la prueba
  del script → «borradas 1 de 1; quedan 0».
- `E2E_SUPABASE=1 E2E_PORT=3941 pnpm e2e admin-real.spec.ts --workers=1` →
  exit 0, 1 passed (escritorio), 1 skipped (móvil): sin rol «Sin acceso»;
  admin dado de alta con el script entra con código + TOTP (calculado del
  secreto de la pantalla); regenerar el código y el QR viejo da
  `invalid_code` (el nuevo, sello); sube una imagen a una fiesta y trae la de
  otra por URL, y las dos salen en el reverso del Carnet público del miembro
  (`data-imagen="si"`); el CSV trae a quien aceptó noticias y no a los demás;
  marcar artista y el Carnet público dice «Carnet de artista»; borrar el
  duplicado: sale de los rankings de puntos y de circuito, su usuario ya no
  existe y su sesión no se renueva; retirar la botella reportada (fuera de
  `latest_bottles`, `removed`); anular un tiempo y sale del ranking, con su
  fila `void_time` en la auditoría.
- `E2E_PORT=3942 pnpm e2e admin.spec.ts admin-endurecido.spec.ts comunidad.spec.ts eventos.spec.ts --workers=1`
  → exit 0, 24 passed, 6 skipped (modo local).
- `E2E_PORT=3943 pnpm e2e ciclo-evento.spec.ts descuentos.spec.ts entrega.spec.ts tipografia.spec.ts carnet.spec.ts --workers=1`
  → exit 0, 36 passed (modo local).
- `E2E_SUPABASE=1 E2E_PORT=3944 pnpm e2e sello.spec.ts admin-real.spec.ts --workers=1`
  → 7 passed, 1 skipped (el Carnet con sellos sigue igual tras leer la imagen del servidor).
- Comando de prueba → exit 0: vitest 127 archivos / 1108 pruebas (nuevas:
  `lib/admin/stamp-image.test.ts` 4, `app/admin/real/csv.test.ts` 2),
  `tools/spec/checks.sh` OK, lint 0, build 0 (185.5 kB · presupuesto 200 kB
  · OK), typecheck 0.
- Prueba unitaria: `pnpm exec vitest run packages/db/src/grant.test.ts` → 3 passed
  (fuera del comando de prueba, que excluye `packages/db`).

Pendiente:
- Los códigos de respaldo del TOTP y la recuperación si se pierde el móvil
  (hoy: `pnpm admin:grant -- <email> none` y otra vez el rol, más borrar el
  factor en el panel de Supabase).
- Las otras secciones del Admin siguen en la demo local; la moderación de
  Carnets también.
- «Imprimir o PDF» usa el diálogo del navegador (sin prueba automática).
- El instante del sello recibido no carga la imagen antes de caer (T91 la
  pinta en el Carnet).
- README y la lista de producción: `pnpm admin:grant` y
  `pnpm db:clean-test-users` (T95).

## 2026-10-03 — plan 008 T93: Global message bottles

Qué existe (decisión 12, REQ-IDE-040…044):

- `packages/store/src/member/bottles.ts` — `createGlobalBottles({ client, viewer, validatePosition })`:
  una `BottleApi` sobre Supabase, la misma para invitado y miembro. `list()` lee
  `latest_bottles` (las 10 activas más recientes de todas las cuentas) y sirve
  la última lectura hasta `GLOBAL_BOTTLES_REFRESH_MS` (3 min) o `refresh()`;
  `mine()` lee la activa propia aunque no esté entre las 10; `place()` pide
  cuenta con Carnet (`no_carnet` si no), pasa el filtro y la posición antes
  de llamar a `place_bottle` (que retira la anterior); `edit`/`retire` van a
  `bottles` por la RLS del autor; `read()` registra en `bottle_reads` (sólo
  miembro; el invitado lee igual y lo leído se recuerda en la visita);
  `report()` escribe `bottle_reports` (repetido → `{ first: false }`, la
  propia → `forbidden`). Sin red, el mar se queda como estaba.
- `packages/store/src/bottle-text.ts` — `textProblem()` / `BLOCKED_WORDS`: la copia
  en el navegador de `private.text_problem` (enlaces, emails, teléfonos,
  palabras ofensivas). La guarda de la base ya existía (T86).
- `createSwitchableRepository(...).useBottles(source)`: con botellas globales,
  `repo.bottles` va a ellas sea quien sea el dueño; al cambiar de dueño se
  olvida lo leído (lo mío depende de la sesión); sus cambios avisan como `bottles`.
- `apps/web/lib/repo-member.ts` (sólo con Supabase) crea las globales con la
  cuenta `member` como `viewer` y la validación de agua de siempre, y las
  vuelve a leer cada 3 min con la página a la vista y al volver a ella.
  /mar no cambia: sigue pintando `bottles.list()` con la regla de T88
  (`placeBottles`, `dropSpot`).
- `apps/web/lib/mundo/bottles/bottle-sheet.tsx`: con Supabase, «Mi botella» sin
  cuenta con Carnet pide «Entrar con tu email» (`requireAccount('carnet')`),
  el aviso «sólo en este navegador» pasa a `mar.botella.global`, el reporte
  sin cuenta lleva a la misma puerta, y los rechazos del filtro tienen su
  texto (`mar.botella.filtro.*`). En modo local todo igual.
- i18n: `mar.botella.global`, `pideCuenta`, `pideCuentaReporte`, `entrar`,
  `filtro.{link,email,phone,offensive}` en `es-mar.ts` (`muestra`).
- Sin migraciones nuevas: `place_bottle`, `latest_bottles`, el filtro y la RLS
  de lecturas y reportes de T86 bastan.
- `docs/spec/estado.md`: IDE-040, 041 y 043 suman la evidencia con cuentas;
  IDE-044 «Sin mensajes privados» pasa de FALTA a HECHO.

Comandos:

- `pnpm exec vitest run packages/store/src/bottle-text.test.ts packages/store/src/member/` → 31 passed (bottle-text 4, member/bottles 13).
- `pnpm test:supabase` → exit 0, 7 files, 67 passed (nuevo `bottles.supabase.ts`: lecturas, reportes, edición con filtro, retirada), 0 cuentas `@example.test` restantes.
- `E2E_SUPABASE=1 E2E_PORT=3193 pnpm e2e botellas-globales.spec.ts --workers=1` → exit 0, 6 passed (móvil y escritorio): A echa, B la ve, la lee (`bottle_reads`) y la reporta (`bottle_reports`), el invitado la lee y «Mi botella» le pide el email; un enlace y un teléfono se rechazan sin llegar a la base; de 11 botellas flotan las 10 más recientes.
- `E2E_PORT=3194 pnpm e2e mar-botellas.spec.ts carnet.spec.ts --workers=1` → exit 0, 10 passed (modo local intacto).
- Test command → exit 0: vitest 123 files / 1081 passed, `tools/spec/checks.sh` 0, lint 0, build 0, typecheck 0.

Pendiente:

- La moderación de botellas del Admin sigue en la demo local (T94 la pasa a datos reales: retirar con `status = 'removed'`, ver `bottle_reports`).
- Con Supabase ya no flotan las botellas de muestra (el mar es el de las cuentas); en modo local, las de siempre.
- Una botella propia que no está entre las 10 más recientes no flota (se ve en «Mi botella» y en el Carnet).

## 2026-10-03 — plan 008 T91: The ID-card Carnet and QR party stamps

El Carnet es ahora la tarjeta ID-1 aprobada en T87 (decisión 10) en la hoja
«Mi Carnet» de /mar, en `/carnet` y en `/carnet/<id>`, y los sellos de las
fiestas llegan por QR (decisión 9): «Escanear sello» abre la cámara en la
web y `/sello?e=&c=` reclama el sello con `claim_stamp`. En modo local (sin
Supabase) todo sigue en el navegador: la misma tarjeta, nº «—», sin
«Escanear sello», y el sello llega con la compra de prueba como siempre.

Qué existe:
- **La tarjeta** (`apps/web/lib/mundo/carnet/`):
  - `id-card.tsx` + `id-card.css`: anverso naranja (wordmark, «Carnet de
    miembro/artista», nº de miembro, foto o avatar con la mascota, apodo en
    tres tamaños, rango, «Miembro desde», puntos, QR al Carnet público,
    línea de lectura mecánica, olas, «MUESTRA» en los de muestra) y reverso
    de pasaporte (rumbos, 3 × 2 celdas, «Aquí va tu primer sello», 5 + «+N»).
    Todo en `cqw` con mínimos en px. Giro con el botón «Ver sellos / Ver
    anverso» o tocando la tarjeta (500 ms; fundido de 150 ms con movimiento
    reducido), cara oculta `inert`, región `aria-live`. `fresh`: el sello que
    acaba de llegar abre el reverso y cae (escala 1,7 → 1, −18° → su giro,
    golpe de 2 px, sonido `bump`); chip «Puntos a → b».
  - `id-card-model.ts`: nº con 4 cifras, «jun 2026», línea mecánica,
    tamaño del apodo, `stampStyle(eventId)` (forma, tinta y giro por hash,
    siempre los mismos), `backLayout`.
  - `stamp.tsx`: el sello de goma de T87 (redondo, rectangular, ovalado;
    4 tintas; filtro de tinta). Con imagen del evento (T94) la imagen va
    dentro del mismo tratamiento (ventana recortada `cover`, impresa en la
    tinta en pocos niveles); si la imagen falla, el sello generado.
    `eventStampImage(evento)` (en `use-carnet.ts`) lee `stampImageUrl` del
    evento cuando T94 lo añada; hoy no hay ninguno.
  - `qr-code.tsx` (`uqr`, corrección M): el QR del anverso.
  - `carnet-card.tsx`: la tarjeta arriba y debajo lo de siempre (respuestas
    con su pregunta, insignias y logros, barco). `cardViewOf()`.
  - `own-carnet.tsx`: el Carnet propio con «Escanear sello» (sólo con
    cuentas), «Editar mi Carnet», «Compartir» (Web Share o copiar enlace) y
    «Ver tus sellos» (`stamps-sheet.tsx`, la lista legible) con el reverso a
    la vista. Lo usan `carnet-panel.tsx` (/mar) y `/carnet`.
  - `use-carnet.ts`: nº de miembro y artista de la cuenta, los sellos como
    se pintan (`stampArtFor`: nombre y fecha de la fiesta del contenido o,
    si no está, de `events` en Supabase), y con Supabase el Carnet público
    de otro miembro (`public-carnet.ts`: `carnets`, `carnet_answers`,
    `point_balances`, `stamps` + `events`; nunca el email).
  - `claim.ts` / `claim-copy.ts`: `claimStamp({event, code})`: la fiesta
    (Supabase o contenido), `requireAccount('stamp', {event})`,
    `claim_stamp`, y el resultado `granted | already | early | late |
    invalid | offline | local | cancelled`; la ventana sale del detalle de
    `outside_window`; «desde las HH:MM» de `stamps.granted_at`; al conceder,
    `refreshMemberAccount()` (nuevo en `lib/repo.ts`) relee la cuenta.
- **El escáner** (`apps/web/lib/scanner/`): `scan-layer.tsx` (capa modal a
  pantalla completa, cargada con `import()` al tocar «Escanear sello»: antes
  del permiso, cámara trasera con ventana y esquinas, linterna si la hay,
  lectura continua, «Sello encontrado / Guardando…», hojas de error, permiso
  denegado y sin cámara, Esc y foco), `decode.ts` (`BarcodeDetector` si lo
  hay; si no `jsqr`, cargado con `import()` sólo al escanear: no está en el
  paquete de la landing ni de /mar, comprobado en el build y en
  `scanner.test.ts`), `sello-url.ts` (`/sello?e=&c=` en cualquier dominio).
- **`/sello`** (`apps/web/app/sello/`): página ligera en la noche de la
  landing; quita `c` de la barra con `replaceState`; comprobando → hoja de
  acceso para el invitado (y el sello al terminar) → sellado (el reverso
  con el sello cayendo, «Sellado. +50 puntos…», «Ver mi Carnet», «Zarpar al
  mar») o el error; sin Supabase, «Los sellos con QR necesitan la versión
  con cuentas». `noindex`, `no-referrer`.
- **`/carnet` y `/carnet/<id>`**: noche de la landing, cabecera con el
  wordmark y «Volver al mar», tarjeta de 600 px a la izquierda y respuestas a
  la derecha desde 1024 px; textos por clave (antes sueltos).
- `apps/web/lib/i18n/es-carnet.ts` (nuevo): las claves de T87 de la tarjeta,
  el escaneo y /sello, más las marcadas «T91».
- `Permissions-Policy`: `camera=(self)` (antes `camera=()` bloqueaba la
  cámara en toda la web); el micro sigue cerrado.
- Dependencias: `uqr` 0.1.3 (QR del anverso), `jsqr` 1.4.0 (decodificador
  a demanda); de desarrollo `pngjs` 7.0.0 y `@types/pngjs` (la prueba lee el
  PNG del QR, `apps/web/lib/scanner/fixtures/sello-qr.png`).
- REQ-IDE-023 «QR alternativo de sello» → HECHO; REQ-IDE-022 sigue PARCIAL
  (pide la revisión de diseño del hito) con su nueva evidencia.

Pruebas y comandos:
- `pnpm exec vitest run apps/web/lib/scanner apps/web/lib/mundo/carnet` →
  3 archivos, 32 pruebas: el decodificador lee el PNG del QR de una fiesta
  (`/sello?e=…&c=…`), otro QR no es un sello, jsqr y la cámara sólo con
  `import()`, la URL; la tarjeta (nº,
  «Miembro desde», línea mecánica, reverso 5 + «+N»), el sello generado y el
  de imagen, el QR del anverso se decodifica y lleva al Carnet público, el
  sello recién llegado abre el reverso, la ventana de `outside_window` y los
  textos de cada error.
- `E2E_SUPABASE=1 E2E_PORT=3193 pnpm e2e sello.spec.ts sello-camara.spec.ts
  --workers=1` → 8 passed: un miembro abre el QR → el sello en el reverso y
  +50 (los de `point_actions`); otra vez → «Ya tienes este sello»; su Carnet
  público visto por otro sin cuenta (apodo, nº, puntos, sello, sin email);
  fuera de la ventana → «Este sello abre durante la fiesta»; código malo →
  «no es un sello»; invitado → hoja de acceso (motivo `stamp`, la fiesta en
  el «por qué»), cuenta nueva y el sello; «Escanear sello» con una cámara
  falsa de Chromium que enseña el QR (vídeo .y4m hecho en la prueba).
  Con `cuenta.spec.ts cuenta-progreso.spec.ts` en la misma tanda: 19
  passed, 1 skipped (cuenta-progreso sólo corre en escritorio, T90).
- `E2E_PORT=3191 pnpm e2e carnet.spec.ts carnet-descuento.spec.ts
  tickets.spec.ts mar-entradas.spec.ts comunidad.spec.ts mar-a-bordo.spec.ts
  tipografia.spec.ts --workers=1` → 52 passed (modo local).
- `pnpm test:supabase` → 6 archivos, 63 pruebas, exit 0.
- Comando de prueba del plan → exit 0 (vitest 122 archivos, 1079 pruebas; checks;
  lint; build con la landing en 185,6 kB de 200; typecheck).

Aserciones cambiadas:
- `carnet.spec.ts`: ninguna quitada. Añadidas: el Carnet público de un
  miembro de muestra es la tarjeta con su QR a `/carnet/<id>` y «MUESTRA»;
  el Carnet local tiene nº «—» y no tiene «Escanear sello»; prueba nueva «la
  tarjeta: anverso, girar, el sello de la compra de prueba en el reverso»
  (y /sello sin servidor).
- `carnet-descuento.spec.ts`: sin cambios (sigue pasando con la tarjeta:
  `carnet-apodo` y `carnet-generos` se conservan).
- `lib/mundo/carnet/carnet.test.ts`: «Miembro de BOIA desde» → el campo
  «Miembro desde» de la tarjeta (`carnet.card.since`).
- `lib/security-headers.test.ts`: `camera=()` → `camera=(self)` y
  `microphone=()`.

Pendiente:
- T94: el campo de la imagen del sello en el evento (`stampImageUrl` en el
  contenido y la columna en Supabase); la tarjeta ya la pinta.
- En /carnet a 1280 las acciones van bajo la tarjeta (T87 las ponía en la
  columna derecha).
- La cuenta atrás de los puntos (600 ms) y «Ahora eres {rango}» tras un
  sello no están; sí el chip «Puntos a → b».

## 2026-10-03 — plan 008 T92: Global rankings: circuit times and all-time points

Con Supabase, el ranking del Menú de /mar es global (decisión 8) y sigue el
marco 15 de T87; sin las variables de Supabase (producción hoy, pruebas
unitarias, e2e por defecto) es el ranking local de siempre, con el mismo
aspecto y sin la pestaña de temporada (D-20).

Qué existe:
- **`apps/web/lib/mundo/ranking-global.ts`** (nuevo): `fetchRankingPage`
  sobre `ranking_race` y `ranking_points` de T86 (páginas de
  `RANKING_PAGE_SIZE` = 50, la fila propia aunque quede fuera; un circuito que
  el servidor no conoce es una tabla vacía; los avatares neutros se leen de
  `carnets`, la foto no viaja), `appendPage` (sin repetir), `hasMore`,
  `pinnedMine`, `circuitOptions` (un circuito por mundo; si dos mundos
  comparten trazado y versión, una opción con el nombre del mundo que se
  juega), `raceStanding`, `raceLeader`, `memberFinishStanding` (manda la cola
  de la cuenta y lee el puesto) y `globalRaceLeader`.
- **`apps/web/lib/mundo/menu/sections/ranking.tsx` + `ranking.css`**
  (reescritos): dos pestañas, «Circuito» (primera, con su `<select>`) y «De
  siempre», como tablist (flechas, Inicio, Fin); filas de 44 px que son el
  enlace al Carnet (puesto y valor en Archivo tabular, avatar de 28 px,
  apodo con elipsis), la fila «tú» con tinte naranja, barra y chip, en su
  sitio o fijada tras «···»; «Mostrar más» carga 50 más hasta listar a todos
  (y desaparece; el foco va a la primera fila nueva). Con cuenta: «Vas n.º de
  N con …». Invitado (o sesión sin Carnet): la caja con su récord o sus
  puntos del navegador y «Entrar en el ranking» (`requireAccount('ranking')`;
  al entrar, la tabla se vuelve a leer). Error con «Volver a cargar». Modo
  local: el rótulo «Ranking local», los puntos y `SAMPLE_CIRCUIT_MS` como
  antes, sin temporada. «Descubrir a un BOIERO» pasa debajo de la lista.
- **Tarjeta de meta** (`apps/web/app/mar/carrera.tsx`, `mar-client.tsx`):
  `RaceResult.standing` (`local` | `loading` | `global` | `guest` |
  `unavailable`). Un miembro ve «Buscando tu puesto…» y luego «Puesto n de N
  en el ranking» (`data-ranking="global"`); un invitado, que el tiempo se
  queda en el navegador y «Entrar en el ranking»; en modo local, la
  tripulación de muestra como antes. La tarjeta de la salida enseña al más
  rápido del ranking global con Supabase. `flushAccount()` en
  `apps/web/lib/repo.ts` manda la cola del miembro antes de leer el puesto.
- **i18n**: `ranking.tabs.aria`, `ranking.circuit.*`, `ranking.mine.*`,
  `ranking.youChip`, `ranking.more`, `ranking.loading`, `ranking.guest.*`,
  `ranking.error`, `ranking.retry`, `mar.race.result.global*`,
  `mar.race.result.guest` en `es-cuenta.ts` (`muestra`).
- **Pruebas**: `ranking-global.test.ts` (6); e2e nuevo `ranking.spec.ts`
  (Supabase: siembra Rápida y Lenta con puntos y tiempos por las RPC, 52
  cuentas con tiempo y quien mira, el más lento; orden en las dos pestañas,
  «tú» fijada fuera del top, «Mostrar más» hasta el final; el invitado lee y
  abre el acceso con el motivo `ranking`; capturas con `RECORD_T92=1` en
  `docs/informes/img/p008-t92-*`). `mar-botellas.spec.ts`: el ranking local
  con dos pestañas. `cuenta-progreso.spec.ts`: la tarjeta de meta del
  miembro enseña su puesto global.
- **`docs/spec/estado.md`**: REQ-AVE-034 L2 → HECHO (`ranking.spec.ts`);
  REQ-IDE-053 y REQ-IDE-017 citan el nuevo título de `mar-botellas.spec.ts`.

Comandos:
- `E2E_SUPABASE=1 E2E_PORT=3524 RECORD_T92=1 pnpm e2e ranking.spec.ts
  --workers=1` → exit 0, 4 pasan (móvil y escritorio).
- `E2E_SUPABASE=1 E2E_PORT=3521 pnpm e2e ranking.spec.ts
  cuenta-progreso.spec.ts --workers=1` → cuenta-progreso pasa en escritorio
  con la nueva aserción (móvil se salta); las dos de invitado fallaron por la
  aserción del texto del acceso (lleva un icono delante), corregida y
  pasada en la ejecución de arriba.
- `E2E_PORT=3522 pnpm e2e mar-circuito.spec.ts mar-botellas.spec.ts
  carnet-descuento.spec.ts --workers=1` → exit 0, 20 pasan (modo local).
- `pnpm test:supabase` → exit 0 (6 archivos, 63 pruebas; cuentas
  @example.test que quedan: 0).
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` →
  exit 0 (121 archivos, 1064 pruebas); `sh tools/spec/checks.sh` → exit 0;
  `pnpm lint` → exit 0; `pnpm build` → exit 0 (185.5 kB · presupuesto
  200 kB · OK); `pnpm typecheck` → exit 0.

Pendiente:
- La temporada sigue oculta hasta que Hernán defina qué es (la RPC
  `ranking_season` de T86 sigue ahí).
- Las filas del ranking enseñan el avatar neutro del Carnet; la foto propia
  no viaja en la lista (peso).
- El enlace de cada fila va a `/carnet/<id>`; el Carnet público desde
  Supabase es de T91.
- El proyecto de desarrollo es compartido: con otras pruebas a la vez el
  total de una tabla puede moverse entre páginas («Mostrar más» lo tolera y
  la e2e cuenta las cuentas sembradas, no un total fijo).

## 2026-10-03 — plan 008 T90: The Supabase repository: a member's progress lives in the account

Con sesión y Carnet, todo lo de valor va a la cuenta por las RPC de T86 y
se lee del servidor; el navegador guarda una copia que sirve sin red. Sin
las variables de Supabase (producción hoy, pruebas unitarias, e2e por
defecto) `gameRepository()` es el repositorio local de siempre (D-20).

Qué existe:
- **`packages/store/src/member/`** (nuevo, exportado por `@boia/store`):
  - `server.ts`: `SupabaseLike` (la forma mínima del cliente, sin depender
    de supabase-js), `supabaseMemberServer(cliente, id)`: `pull()` lee de la
    cuenta el libro (por páginas de 500), lo equipado, `race_times`,
    `user_discounts`, el Carnet, `carnet_answers` y `account_snapshots`;
    `rpc()` y `saveAnswer()` (respuestas del Carnet: update y, si no hay,
    insert; la RLS no deja upsert). `classifyServerError`: P0001/42501 con
    clave → rechazo; red, 5xx, JWT caducado y `not_member` → pasajero.
  - `ops.ts`: la cola (`award`, `buy`, `equip`, `time`, `find_discount`,
    `use_discount`, `profile`, `answer`) y su RPC; `pointActionFor` (la
    acción de `point_actions` por la forma del origen; `merge.ts` de T89 la
    reutiliza); `SyncRejectedError` (un `StoreError` con el código que la
    interfaz ya explica: `insufficient_coins`, `conflict` «apodo en uso»…).
  - `hydrate.ts`: lo del servidor al documento local con los ids que daría
    el repositorio local (`world_reward:<clave local>` viaja en
    `metadata.lk`, `achievement:<id>`, `cosmetic:<id>#n`, `stamp:qr:<fiesta>`,
    ajustes y compensaciones), pasado por `replayLedger`; récords de circuito
    desde `race_times` (sin los anulados); la copia `MemberSnapshot`
    (`format: 1`: descubrimientos, misiones, contadores, ajustes, logros
    completados, récords que no son de circuito y compras de prueba).
  - `member.ts`: `createMemberRepository`. Cada acción de valor se hace en la
    copia (la interfaz responde como siempre) y entra en la cola, que va en
    orden a las RPC; comprar, equipar y el Carnet esperan la respuesta y
    lanzan el rechazo; lo demás lo avisa (`onEvent`). Tras un rechazo, la
    copia vuelve a lo del servidor. Sin red, la cola se guarda
    (`boia.cuenta.<id>.sync`) y se reintenta (2 s → 60 s, al volver la red y
    al reabrir). Sólo se lee del servidor con la cola vacía: gana el
    servidor sin perder lo pendiente. El resto del documento va con
    `save_snapshot` 4 s después de cambiar y al ocultar la página; un
    `snapshot_conflict` relee y gana el servidor. Las llamadas esperan a la
    primera puesta al día (8 s como mucho).
  - `switchable.ts`: `createSwitchableRepository`: una referencia estable
    que va al invitado o al miembro, avisa de un cambio en todas las áreas
    al pasar de uno a otro y hace esperar a las llamadas hasta saber quién
    juega (`hold`). Contenido y Admin, siempre los del navegador.
  - `local.ts`: `localDocAccess(repo)` (leer/cambiar el documento de un
    repositorio local); `schema.ts`: la identidad puede ser `member`.
- **`apps/web/lib/repo.ts`**: `gameRepository()` (con Supabase) es el
  repositorio conmutable; `guestRepository()` el invitado de siempre.
  **`apps/web/lib/repo-member.ts`** (nuevo, sólo se carga con Supabase): con
  sesión y Carnet crea la copia `boia.cuenta.<id>` (con el contenido del
  Admin de la demo copiado del navegador) y el repositorio de la cuenta;
  al salir vuelve al invitado sin recargar y borra la copia (la cola sólo si
  quedó vacía). Sin red al cargar, con sesión y copia, juega sobre la copia.
  Manda lo pendiente al volver la red y al ocultar la página, relee al
  volver a ella y cada minuto. Avisos con los de la cuenta (`sync.*`).
- **Cuenta (T89)**: `session.ts` avisa tras `merge_guest`
  (`onGuestMerged`: la siguiente lectura ya trae lo del invitado) y deja
  mandar lo pendiente antes de cerrar sesión (`onBeforeSignOut`, 4 s como
  mucho). `guest.ts` lee siempre del invitado (`guestRepository()`) y la
  fusión lleva ya la copia (`snapshot`) si el invitado hizo algo.
- **Tienda «Barco»**: comprar pide `requireAccount('skin')` (en modo local
  pasa al momento; cancelar no compra).
- **i18n**: `sync.offline`, `sync.online`, `sync.rejected.*` en
  `es-cuenta.ts` (`muestra`).
- **Pruebas**: `packages/store/src/member/member.test.ts` (14, con un
  Supabase falso, `fake-supabase.ts`): sincronización y otro navegador que
  lo lee, logro reclamado, copia del resto, cola sin red que sobrevive a
  cerrar la pestaña, rechazos (tope diario, origen desconocido, monedas,
  apodo), el servidor gana a la copia y a otra copia del documento, invitado
  ↔ miembro sin recargar, ids del libro, clasificación de errores;
  `merge.test.ts` (la copia en la fusión). E2E nuevo
  `cuenta-progreso.spec.ts` (Supabase, escritorio). `cuenta.spec.ts`: con
  cuenta el Carnet ya sale de la cuenta (sin «Crear» en este navegador).

Comandos:
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000`
  → exit 0 (118 archivos, 1046 pruebas); `sh tools/spec/checks.sh` → exit
  0; `pnpm lint` → exit 0; `pnpm build` → exit 0 (185.5 kB · presupuesto
  200 kB · OK); `pnpm typecheck` → exit 0.
- `pnpm test:supabase` → exit 0 (6 archivos, 63 pruebas; cuentas
  @example.test que quedan: 0).
- `E2E_SUPABASE=1 E2E_PORT=3494 pnpm e2e cuenta-progreso.spec.ts
  cuenta.spec.ts --workers=1` → cuenta-progreso pasa (escritorio, 2,1 min;
  móvil se salta): el miembro ve en la tienda las monedas de su cuenta,
  reclama «Primera boia», compra y se pone una skin, corre El Freu; el
  servidor tiene el logro, la skin comprada y equipada y el tiempo; otro
  contexto sin nada guardado ve la skin puesta, el récord junto a la
  salida, los puntos y monedas de la cuenta y su Carnet.
  `E2E_SUPABASE=1 E2E_PORT=3495 pnpm e2e cuenta.spec.ts --workers=1` → exit
  0, 10 pasan.
- `E2E_PORT=3496 pnpm e2e carnet.spec.ts carnet-descuento.spec.ts
  mar-circuito.spec.ts tienda.spec.ts mar-carnet-barco.spec.ts --workers=1`
  → exit 0, 22 pasan (modo local).

Pendiente:
- Con cuenta, el sello de una compra de prueba no se queda (en la cuenta el
  sello es por QR, T91); el descuento que usa sí va a la cuenta.
- Ranking (local aún, T92), botellas (en la copia del navegador hasta T93) y
  Carnets de los demás siguen como antes.
- Un premio `daily` hecho sin red y mandado otro día cuenta para el día en
  que llega (`award_points` no recibe fecha).
- `docs/spec/estado.md` no cambia: los REQ de servidor (IDE-005, IDE-039,
  ARQ-010…) están en la lista `final` de D-20 y se mueven con T95.

## 2026-10-03 — plan 008 T96: /mar fixes from Hernán's test: race buoys, the open path, whirlpools, mobile «go to»

Qué existe:

- **(a) Boyitas de la carretera, naranjas a los dos lados.**
  `apps/web/app/mar/engine/race-props.ts`: `ROAD_BUOY` (naranja de la marca
  con franja blanca) para la derecha y la izquierda; antes, rojas a un lado y
  blancas al otro. Prueba: `race-props.test.ts`.
- **(b) El borde del circuito, cerrado.** `apps/web/app/mar/road.ts`
  (`roadMarks`): en cada vértice del trazado, un arco de boyitas por fuera de
  la curva, cada `ROAD_MARK_STEP`; con el trazado cerrado, también en la
  salida/meta. Antes, en una curva cerrada las boyitas del tramo que llega y
  las del que sale quedaban lejos: el borde se abría por debajo de la boia 8
  (hueco de 143 u sin boyita) y por encima de la 3 (195 u). Otros huecos del
  mismo tipo, también cerrados: la salida/meta (vértice 0, 129 u) y, menores,
  las boias 4, 6 y 9 (~85 u). El «te saliste» ya medía la distancia al
  trazado (un borde redondeado en los vértices): ahora las boyitas marcan
  exactamente esa línea, y salir por el hueco de antes cuenta como fuera.
  Pruebas: `road.test.ts` «ningún hueco en todo el borde…» y «por debajo de
  la boia 8 y por encima de la 3…».
- **(c) Remolinos.** Tres causas:
  1. No se veía: la malla era un solo cuadro; el planeta curva cada vértice
     (`planetCurve`) y el centro del cuadro quedaba bajo el agua curvada
     (regresión de T33). `effects.ts` `whirlpool`: malla de
     `WHIRLPOOL_SEGMENTS` (32) por lado, `WHIRLPOOL_LIFT` 0.15 y
     `polygonOffset`.
  2. No se surfeaba: el giro era un empujón en la velocidad y la quilla del
     barco de /mar lo anulaba en décimas (el barco apenas se movía).
     `packages/engine/src/world/runtime.ts` `applySwirls`: ahora es una
     corriente que mueve el barco (y le gira la proa, como mucho
     `SWIRL_MAX_TURN`), con un ojo que gira como un disco (`SWIRL_CORE`).
     Sin motor da vueltas dentro; a fondo hacia fuera se sale.
  3. Estaba dentro de la ficha de la Isla de Halloween (T67): al entrar se
     abría su ficha. `compact.ts` `pullToRoute`: el remolino queda fuera de
     toda ficha que se abre sola (`WHIRLPOOL_SHEET_MARGIN`), buscando sitio a
     lo largo de la ruta.
  Sin rótulo encima (Hernán, durante la tarea): se ve solo. `Mar3D` deja
  `data-remolinos` (cuántos se pintan) y `data-remolinos-vista` (cuántos hay
  en pantalla) en el lienzo, para las pruebas. REQ-AVE-019 pasa a HECHO.
  Pruebas: `whirlpool.test.ts`, `encounters.test.ts` (motor),
  `e2e/mar-remolino.spec.ts`.
- **(d) «Ir a» en el móvil.** `sheet.tsx`: la ficha pequeña de un lugar trae
  «Navegar» e «Ir en nave» a la vista, en una fila (`mar.css`), sin
  desplegarla; la ficha desplegada sigue igual. Prueba: `mar-3d.spec.ts`
  «ir a un lugar: «Navegar» e «Ir en nave» a la vista…» (móvil y escritorio).

Comandos:

- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` →
  exit 0, 117 archivos, 1029 pruebas.
- `sh tools/spec/checks.sh` → exit 0 (REQ-AVE-019 a HECHO).
- `pnpm lint`, `pnpm build`, `pnpm typecheck` → exit 0.
- `E2E_PORT=3293 pnpm e2e mar-circuito.spec.ts mar-remolino.spec.ts
  mar-3d.spec.ts --workers=1` → exit 0, 34 pasadas (móvil y escritorio).
  En la primera pasada la prueba nueva de «Ir a» falló en escritorio: el
  clic de Playwright en un rótulo al borde corría el mar de lado y la ficha
  quedaba fuera de pantalla (artefacto de la prueba, no de la ficha); ahora
  el rótulo se toca con `dispatchEvent('click')`.

Pendiente:

- Nada de esta tarea. El remolino sigue con los parámetros `muestra` de su
  mapa (giro 110, tirón 25): sin motor el barco acaba en el ojo dando vueltas;
  si Hernán lo quiere más difícil (que te eche), es cambiar `pull` de signo o
  de valor.

## 2026-10-03 — plan 008 T89: Email sign-in with a 6-digit code, consent and the account

La cuenta con email (decisiones 1–5) sobre el diseño aprobado de T87
(marcos 12–14). Sin las variables de Supabase (producción hoy, pruebas
unitarias, e2e por defecto) no aparece nada de esto y todo sigue como antes
en el navegador (D-20).

Qué existe:
- **`apps/web/lib/account/`** (nuevo):
  - `session.ts`: la sesión (`local` / `loading` / `guest` / `incomplete` sin
    Carnet / `member`), escuchando `onAuthStateChange`; el cliente de
    Supabase se carga con `import()` sólo con Supabase. Acciones: `sendCode`
    (`signInWithOtp`, crea la cuenta si es nueva), `verifyCode`
    (`verifyOtp` tipo `email`), `mergeGuest`, `nicknameStatus`,
    `createProfile` (`save_profile` con la política
    `PRIVACY_POLICY_VERSION = 'muestra-2026-10-03'` y las noticias sí/no, cada
    consentimiento con su fecha), `setNewsOptIn`, `signOut` (sólo este
    navegador) y `deleteAccount` (`delete_my_account`).
  - `use-account.ts`: `useAccount()` y los avisos de la cuenta.
  - `gate.ts`: **`requireAccount(reason, { event?, prefill? })`** con los
    motivos `carnet` / `skin` / `stamp` / `ranking` (título y «por qué» de
    cada uno). Modo local o miembro con Carnet → `true` al momento; si no,
    abre la hoja y devuelve `true` al terminar o `false` si se cancela.
    Necesita `<AccountGate />` montado en la página (hoy /mar y /carnet; T91
    lo monta en /sello).
  - `sign-in-sheet.tsx`: `<AccountGate />` y la hoja: email (validado al
    enviar), código de 6 cifras en un solo campo dibujado como seis casillas
    (pegar funciona, la sexta cifra comprueba), reenviar con espera de 60 s,
    errores «incorrecto» / «caducado» (pasados 10 min, y manda otro) /
    «demasiados intentos»; para una cuenta sin Carnet, apodo (prerrellenado
    con el del invitado, comprobado a los 400 ms y al enviar: libre, ocupado
    sin distinguir mayúsculas, filtro), política obligatoria y noticias aparte
    sin marcar, «Crear mi cuenta» desactivado diciendo qué falta; bienvenida
    con el nº de socio y lo que pasó del navegador. Cuenta con Carnet: sin
    paso 3, aviso «Has entrado como…» y termina lo que hacía.
  - `merge.ts` + `guest.ts`: al entrar, siempre, `merge_guest` con lo del
    invitado: premios del mundo (acción por la forma del origen: `world`,
    `encounter`, `mission`, `minigame`) con política y fecha, logros
    reclamados, cosméticos comprados con monedas, lo equipado, el mejor tiempo
    de cada circuito y los descuentos (usado y fiesta). Sin `snapshot`: su
    forma es de T90.
  - `account-section.tsx`: «Tu cuenta» al final del Mi Carnet propio (hoja
    de /mar y /carnet): email, noticias (guarda al cambiar), política
    aceptada con versión y fecha, «Cerrar sesión» y «Borrar mi cuenta» con
    diálogo que pide el apodo. Al salir o borrar, este navegador vuelve a ser
    un invitado nuevo (`identity.reset()`) y se avisa.
  - `account.css`: hoja crema abajo (centrada en escritorio), botones píldora
    naranja con texto negro, fantasma, errores `#b3261e`, «Libre» `#1f7a4d`.
- **Mi Carnet** (`carnet-panel.tsx`): con Supabase, el invitado ve el hueco
  del Carnet («Tu Carnet BOIA») y «Crear mi Carnet» pide antes la cuenta; al
  volver, el Carnet de este navegador nace con el apodo de la cuenta. Tras
  cerrar sesión el hueco dice «Entra con tu email para verlo» y el botón
  «Entrar». **Guardar el Carnet** (`carnet-editor.tsx`) llama a
  `requireAccount('carnet')` (en modo local pasa al momento); uno nuevo lleva
  el apodo elegido para la cuenta. /mar y /carnet montan `<AccountGate />`.
- **`supabase/migrations/20261003100500_nickname_status.sql`**:
  `nickname_status(apodo)` → `ok` o la clave con la que `save_profile` lo
  rechazaría, sin crear nada; sólo cuentas con email.
  `database.types.ts` regenerado; `nickname.supabase.ts` la prueba.
- **CSP**: `connect-src` admite la URL de Supabase (https y wss) sólo si
  `NEXT_PUBLIC_SUPABASE_URL` existe (`security-headers.ts`, `next.config.ts`).
- **/legal/privacidad**: con Supabase dice qué se recoge (email, Carnet,
  progreso, consentimientos), qué es público (nunca el email), dónde, para
  qué, base legal, cuánto tiempo (hasta borrar la cuenta) y derechos
  (`PRIVACY_WITH_ACCOUNTS` en `lib/legal/docs.ts`, `muestra`); sin Supabase,
  la de siempre.
- **i18n**: `apps/web/lib/i18n/es-cuenta.ts` con las claves de T87
  (`auth.*`, `account.*`, `carnet.guest.*`) y unas pocas más marcadas «T89»
  (enviando, comprobando, error de red, resumen de la fusión,
  `legal.privacy.account.*`). Todo `muestra`.
- **Pruebas**: `lib/account/merge.test.ts` y `account.test.ts` (la puerta en
  modo local y con Supabase, errores, apodo, email);
  `security-headers.test.ts` (CSP con y sin Supabase); e2e
  `cuenta.spec.ts` (Supabase) y en `carnet.spec.ts` «modo local: el Carnet se
  crea sin pedir email».

Comandos:
- `pnpm db:migrate:dev` → exit 0, «1 aplicadas de 13: 20261003100500»;
  `pnpm db:types:dev` → +6 líneas en `database.types.ts`.
- `pnpm test:supabase` → exit 0; 6 archivos, 63 pruebas; «cuentas
  @example.test que quedan: 0».
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` →
  exit 0 (117 archivos, 1031 pruebas); `sh tools/spec/checks.sh` → exit 0;
  `pnpm lint` → exit 0; `pnpm build` → exit 0 (185.5 kB · presupuesto 200 kB
  · OK); `pnpm typecheck` → exit 0.
- `E2E_PORT=3491 pnpm e2e carnet.spec.ts --workers=1` → exit 0 (4 pasan).
  `E2E_PORT=3492 pnpm e2e mar-botellas.spec.ts carnet-descuento.spec.ts
  mar-carnet-barco.spec.ts --workers=1` → exit 0 (16 pasan).
- `generateLink` en el proyecto de desarrollo → códigos de 6 cifras (antes
  de que Hernán cambiara el ajuste, 8).
- `E2E_SUPABASE=1 E2E_PORT=3489 pnpm e2e cuenta.spec.ts --workers=1` → exit
  0, 10 pasan (móvil y escritorio): cuenta nueva con código, apodo ocupado
  rechazado, sin política no se crea; invitado con 50 puntos →
  `point_balances` 50; cerrar sesión y volver a entrar; borrar la cuenta; la
  política de privacidad dice qué se recoge.
- Las e2e no leen ningún buzón: el envío del navegador (`/auth/v1/otp`) se
  responde «enviado» sin mandar correo y el código sale de
  `auth.admin.generateLink`; la cuenta nueva la crea `generateLink`.

Ajustes del panel de Supabase que necesita el código (proyecto
`boia-planet-dev`; los aplica Hernán; luego, igual en el de producción).
Hecho el 2026-10-03: 1, 2 y 5. **Pendiente: 3 y 4, después del SMTP propio
(Hernán)**: Supabase no deja editar las plantillas sin él; las e2e no leen
correo, así que no bloquean nada, pero hasta entonces el correo que llega es
el de la plantilla por defecto.
1. https://supabase.com/dashboard → proyecto **boia-planet-dev**.
2. Menú de la izquierda **Authentication** → **Sign In / Providers** →
   **Email** (se abre el panel del proveedor):
   - «Enable Email provider»: activado. «Confirm email»: activado.
   - **«Email OTP Length»: 6** (estaba en 8).
   - **«Email OTP Expiration»: 600** (segundos, 10 min; coincide con
     `OTP_EXPIRY_MS`).
   - **Save**.
3. *(Pendiente, después del SMTP propio — Hernán.)* **Authentication** →
   **Emails** → pestaña **Templates** → **Magic Link**:
   - Subject: `Tu código de BOIA: {{ .Token }}`
   - Message body (pegar entero, en «Source»):
     ```html
     <h2>Tu código de BOIA</h2>
     <p>Escribe este código en BOIA.PLANET para entrar:</p>
     <p style="font-size:32px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
     <p>Caduca en 10 minutos. Si no lo has pedido tú, ignora este correo.</p>
     <p>BOIA · Alicante</p>
     ```
   - **Save changes**.
4. *(Pendiente, después del SMTP propio — Hernán.)* En la misma pestaña,
   **Confirm signup** (lo recibe un email nuevo): el
   mismo Subject y el mismo cuerpo → **Save changes**. Ninguna plantilla usa
   `{{ .ConfirmationURL }}`: sin enlace mágico (decisión 2).
5. **Authentication** → **URL Configuration**:
   - Site URL: `https://boia-planet-roan.vercel.app` → **Save changes**.
   - Redirect URLs → **Add URL** (una a una): `http://localhost:3100/**`,
     `http://127.0.0.1:3100/**`, `https://boia-planet-roan.vercel.app/**` →
     **Save URLs**.
   - `boia-planet-roan.vercel.app` es el despliegue de prueba de hoy: cuando
     exista el dominio definitivo de BOIA, cambiar aquí la Site URL y la
     Redirect URL por las suyas.
6. Para saber: con el correo de Supabase (sin SMTP propio) sólo llegan
   correos a los miembros del equipo del proyecto y unos 2 por hora
   (**Authentication** → **Rate Limits**); para probar a mano, usa tu email
   de la organización. El SMTP propio va en la lista de producción (T95).

Pendiente:
- Plantillas de correo en español con `{{ .Token }}` (pasos 3 y 4): después
  del SMTP propio (Hernán).
- Site URL y Redirect URL: pasar de `boia-planet-roan.vercel.app` al dominio
  definitivo cuando exista.
- T90: el repositorio de Supabase. Hasta entonces, con sesión se sigue
  jugando en el repositorio local: lo que se gana después de entrar no va al
  servidor (lo de antes sí, con `merge_guest`), y al cerrar sesión este
  navegador vuelve a ser invitado nuevo. El Carnet (apodo, avatar, respuestas)
  se guarda en local; en la cuenta, sólo el apodo y el avatar del alta. La
  `snapshot` de `merge_guest` la añade T90 con su forma.
- T90–T93 cablean `requireAccount('skin' | 'stamp' | 'ranking')`; T91 monta
  `<AccountGate />` en /sello.
- /carnet usa la misma hoja crema que /mar (el diseño la quería oscura en las
  páginas de la web); T91 rehace /carnet.
- `docs/spec/estado.md`: REQ-IDE-002, IDE-003 e IDE-006 (en la lista `final`
  de D-20) se mueven en T95 junto con el borrador de la decisión.

## 2026-10-03 — plan 008 T87: Design: the ID-card Carnet, the scan flow, the sign-in sheet and the rankings

Qué existe:

- `docs/propuestas/2026-10-03-carnet.md`: el diseño, **aprobado por Hernán
  el 2026-10-03 con dos cambios**: cada fiesta puede tener su imagen de sello
  subida o enlazada por URL en el Admin (T94 la sube, T91 la pinta; el sello
  generado queda de respaldo), y qué es una temporada queda abierto: el
  panel de ranking tiene dos pestañas (circuito y de siempre) y la de
  temporada vuelve, genérica y sin atarla al mundo que se juega, cuando
  Hernán la defina. Secciones: Card,
  Front, Back and stamps (el aspecto de sello de goma de los marcos queda
  aprobado como EL estilo de sello; «Image stamps»: la imagen va dentro de
  ese mismo tratamiento — marco y letras de la forma del sello, ventana
  recortada, pasada a una sola tinta, textura y giro —, nunca pegada tal
  cual; PNG/WebP/JPEG ≥ 512 px, ≤ 2 MB, copia propia en WebP 512 px; las URL
  se descargan una vez, nunca se enlazan en caliente), Flip, Scan flow (se lee
  el QR primero y se pide el email después), /sello page, Sign-in sheet,
  Account actions, Rankings panel, Palette and type, Accessibility, i18n keys
  (unas 150 claves nuevas, `muestra`) y Open questions (6 contestadas, 1
  abierta: la temporada).
- 17 marcos PNG en `docs/informes/img/p008-t87-*.png` (anverso; reverso con
  0, 3 y 13 sellos; menú de /mar a 375; /carnet a 1280; escalas 375/768/1280;
  giro; cámara; sello recibido; errores de escaneo; página /sello; acceso
  email + código; cuenta nueva; acciones de cuenta; rankings; paleta y tipo;
  sellos con imagen). Maquetas HTML con las fuentes reales (Archivo Expanded
  e Inter de `apps/web/public/fonts/`) renderizadas con el Chromium de
  Playwright; el generador vive fuera del repo (no es código de la app).
- Sin cambios de código, CSS, i18n, `docs/spec/` ni `docs/DECISIONES.md`.

Comandos:

- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0 (112 archivos, 1001 pruebas)
- `sh tools/spec/checks.sh` → exit 0
- `pnpm lint` → exit 0
- `pnpm build` → exit 0
- `pnpm typecheck` → exit 0

Pendiente:

- Qué es una temporada (Hernán); hasta entonces no hay pestaña de temporada.
- T89, T91, T92 y T94 (imagen del sello) construyen sobre este diseño.

## 2026-10-03 — plan 008 T88: /mar: guide lines off during the race; bottles where they can be read

Qué existe:
- Decisión 13: `RouteLine.setSuppressed(bool)` (`apps/web/app/mar/engine/effects.ts`), que `update(zoom)` respeta en cada fotograma; `Mar3D.setRouteHidden(bool)` lo enciende y publica `data-ruta` (`on`/`off`) en el lienzo. `mar-client.tsx` lo esconde en `countdown` y lo enseña en `finish`, `invalid` (anular por panel, salirse, etc.) y al cambiar de mundo.
- Botellas legibles: `packages/engine/src/bottles/readable.ts` (se exporta por `@boia/engine/bottles`, para T93). Zonas de ficha (`sheetZones`: objetos con `content` que se abre solo; radio = proximidad + histéresis). Una botella guarda de cada isla su radio de ficha + 150 u de lectura + 30 u de margen (`BOTTLE_READ_MARGIN`, muestra); de lo pequeño que también abre ficha (la boia del WhatsApp del puerto) sólo ficha + margen. Distancias por el camino corto del planeta. `relocateBottle` (punto legible más cercano, determinista) y `findReadableDropSpot` (`findDropSpotWhere` junto a la popa; si no, el agua legible más cercana).
- `apps/web/app/mar/bottles.ts`: `marReadable(mar)`; `placeBottles` recoloca al cargar las guardadas que incumplen la regla (en u enteras que también cumplen) y `dropSpot` usa la regla.
- `docs/spec/estado.md`: REQ-IDE-041 enlaza las pruebas nuevas.

Comandos:
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0 (114 archivos, 1012 pruebas)
- `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0; `pnpm typecheck` → exit 0
- `E2E_PORT=3417 pnpm e2e mar-circuito.spec.ts mar-botellas.spec.ts --workers=1` → exit 0 (12 pasadas). Nuevo: `data-ruta` off en la cuenta atrás y la carrera (también en «Otra vez»), on en meta, al anular por panel y al salirse; «una botella junto a una isla se puede leer» (guardada en la ficha de una isla, aparece donde se lee y el barco la abre sin que se abra la ficha).

Pendiente:
- Las posiciones guardadas no se reescriben: la recolocación se calcula al cargar (siempre igual). T93 puede guardar ya la posición legible.
- Echar una botella junto a una isla la deja en el agua legible más cercana, que puede quedar fuera de la vista.

## 2026-10-03 — plan 008 T86: Base de Supabase: clientes, migraciones, RPC validadas y pruebas de integración

La base que usan el resto de tareas del plan 008. Hoy la web no la usa en
ningún sitio: sin las variables de Supabase sigue en modo local (D-20), y con
ellas sólo cambia lo que conecten T89–T94.

Qué existe:
- **Clientes** en `apps/web/lib/supabase/`: `config.ts`
  (`isSupabaseConfigured()`, falso si falta o está vacía
  `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
  `SUPABASE_AUTH_STORAGE_KEY = 'boia.supabase.auth'`), `browser.ts`
  (`browserSupabase()`, uno por pestaña, sesión en localStorage, null en el
  servidor o en modo local), `server.ts` (`serverSupabase()`, clave
  publicable sin sesión, para lecturas públicas) y `service.ts`
  (`serviceSupabase()`, clave secreta, se niega en un navegador). Sin
  `@supabase/ssr`: la sesión vive en el navegador y no hacen falta cookies.
  Tipos: `@boia/db/types`. Dependencias nuevas: `@supabase/supabase-js`
  2.117.2 (web y, de desarrollo, `@boia/db`).
- **Migraciones nuevas** (las siete de antes no se reescriben):
  - `20261003100000_accounts.sql`: el Carnet como perfil (número de socio,
    `is_artist`, foto, apodo único sin mayúsculas con filtro), `consents`
    (política y noticias con fecha y versión, sólo altas), `account_snapshots`,
    el filtro de texto `private.text_problem` (enlaces, emails, teléfonos y una
    lista básica de palabras en `private.blocked_words`), las RPC
    `save_profile`, `set_news_opt_in`, `delete_my_account` y las del Admin
    (`admin_set_artist`, `admin_delete_member` con motivo y auditoría,
    `admin_list_members` con email y consentimientos). El Carnet ya no se
    escribe directamente: sólo con `save_profile`.
  - `20261003100100_economy.sql`: `point_actions` (acciones conocidas con tope
    por acción y por día, `muestra`), `cosmetics` y `equipped_cosmetics`,
    `discounts` y `user_discounts`, `circuits` (El Freu v3: 45–300 s) y
    `race_times`, `event_stamp_codes` (sólo el Admin la lee), el libro con
    `action` y `occurred_at` y sellos sin compra; las RPC `award_points`,
    `buy_cosmetic`, `equip_cosmetic`, `claim_stamp` (+50 de
    `point_actions.stamp`), `submit_race_time`, `find_discount`,
    `use_discount`, `save_snapshot` (con versión para detectar conflictos),
    `merge_guest` (cada elemento por la misma función que en vivo, en su
    subtransacción) y `admin_set_stamp_code`.
  - `20261003100200_rankings.sql`: `ranking_points`, `ranking_season` y
    `ranking_race`, por páginas (limit 1–100, offset), orden estable, puesto
    con empates y la fila propia (`mine`) aunque quede fuera; sólo cuentas con
    Carnet; anon puede leerlos.
  - `20261003100300_global_bottles.sql`: el filtro como disparador de
    `bottles`, `latest_bottles` (las 10 más recientes activas, para todos) y
    `place_bottle` (pide Carnet y retira la anterior).
  - `20261003100400_ledger_apply_fix.sql`: **arreglo de una migración
    existente**: `private.ledger_apply` hacía `insert … on conflict do update`
    y Postgres comprueba el CHECK de la fila propuesta antes del conflicto, así
    que gastar monedas fallaba siempre (`coin_balances_coins_check`). Ahora
    actualiza y sólo inserta si no hay fila.
  - Convenciones (cabecera de `accounts.sql`): la lógica en `private` con
    SECURITY DEFINER; en `public` una envoltura INVOKER del mismo nombre; un
    rechazo es P0001 (o 42501) con una clave estable como mensaje. Claves,
    formas de lo que devuelven y de la entrada de `merge_guest`:
    `packages/db/src/rpc.ts`.
- **Muestra** `supabase/seeds/20261003100100_economy.sql`: las fiestas de la
  web con su id como slug (`halloween-2026`, `sonido-2026`,
  `nochevieja-2026`, `all-day-boia-2026`, `borrador`) y su código de sello
  generado al sembrar, los 30 cosméticos y los 3 descuentos escondidos.
  `remove-sample.sql` retira también cosméticos y descuentos.
- **`pnpm db:migrate:dev`** (`packages/db/src/cli/migrate-dev.ts`): lee las
  variables del entorno o de `apps/web/.env.local` (una variable definida,
  aunque vacía, gana al archivo, como en Next), se niega si
  `SUPABASE_DB_URL` no es del proyecto de `NEXT_PUBLIC_SUPABASE_URL`, aplica
  las migraciones con `migrate()` (registro en
  `supabase_migrations.schema_migrations`, como la CLI) y las semillas nuevas
  o cambiadas (por suma, en `supabase_migrations.boia_seed_files`); `--no-seed`
  sólo migra. **`pnpm db:types:dev`** regenera `database.types.ts` desde el
  proyecto; el generador escribe ahora también `Functions` (Args y Returns,
  como la CLI de Supabase) y lee bien `.prettierrc` en Windows.
- **`pnpm test:supabase`** (`packages/db/src/cli/test-supabase.ts`,
  `vitest.supabase.config.ts`, `src/supabase/*.supabase.ts`): 5 archivos, 60
  pruebas contra el proyecto de desarrollo. Cuentas `@example.test` creadas
  con la clave de servicio y marcadas con la ejecución (`BOIA_TEST_RUN`),
  entrada con el código de `auth.admin.generateLink`, TOTP real para el Admin
  (aal1 rechazado, aal2 aceptado). Cada RPC con casos que acepta y rechaza;
  RLS de anon, otra cuenta y Admin; el catálogo (RLS en todo, sin escrituras
  de cliente con `clientWriteLeaks`, anon sólo ejecuta las 4 RPC de lectura,
  ningún SECURITY DEFINER en public, tipos al día). Antes borra las cuentas de
  prueba olvidadas (más de 30 min); al final, las suyas, y dice cuántas
  quedan. Sin variables escribe «se omite» y sale con 0.
- **E2E**: `E2E_SUPABASE=1` en `playwright.config.ts` (sin él, el servidor
  arranca con las variables de Supabase vacías y Next no usa las de
  `.env.local`: modo local como siempre); `e2e/supabase-env.ts` (el
  interruptor), `e2e/supabase.ts` (`createMember`, `otpFor`, `signInPage`,
  `deleteMembers`) y `e2e/supabase-sesion.spec.ts`, que se salta sin el
  interruptor.
- `packages/db/src/checks.ts`: las tablas nuevas y `carnets` en
  `CLIENT_READ_ONLY_TABLES`. `rls.test.ts`: la prueba del Carnet crea con
  `save_profile` y comprueba que la escritura directa ya no se puede.
  `.env.example`: sección de Supabase.

Comandos:
- `pnpm db:migrate:dev` → exit 0, «12 aplicadas de 12» y «5 semillas
  aplicadas» sobre el proyecto vacío; otra vez → exit 0, «0 aplicadas de 12
  (al día)», «0 semillas». Con `SUPABASE_DB_URL` de otra referencia → exit 1,
  «no es del mismo proyecto… no se toca esa base».
- `pnpm test:supabase` → exit 0; 5 archivos, 60 pruebas; «cuentas
  @example.test que quedan: 0 (de esta ejecución: 0)».
- Sin variables (archivo `.env.local` apartado y sin variables en el entorno):
  `pnpm test:supabase` → exit 0, «test:supabase: se omite — sin Supabase…»;
  el comando de prueba entero → exit 0 (113 archivos, 1006 pruebas; checks,
  lint, build 185.4 kB · OK, typecheck).
- Comando de prueba con las variables → exit 0: vitest 113 archivos, 1006
  pruebas; `checks.sh`, `pnpm lint`, `pnpm build` (185.4 kB · presupuesto
  200 kB · OK) y `pnpm typecheck` en verde.
- `E2E_SUPABASE=1 E2E_PORT=3186 pnpm e2e supabase-sesion.spec.ts --workers=1`
  → exit 0, 2 pasan. `E2E_PORT=3187 pnpm e2e supabase-sesion.spec.ts
  despliegue.spec.ts --workers=1` → exit 0, 4 pasan y 4 saltadas (las de
  Supabase en modo local).

Pendiente:
- Las dos suites de `packages/db` con PostgreSQL local (`pnpm db:test`,
  `schema.test.ts`, `rls.test.ts`) no se pudieron correr en esta máquina; lo
  que comprueban de catálogo y tipos lo prueba ahora `schema.supabase.ts`
  contra el proyecto real.
- Para T89: la CSP (`apps/web/lib/security-headers.ts`) aún no deja
  `connect-src` a la URL de Supabase; hará falta al conectar el cliente del
  navegador. La versión de la política la elige T89 (las pruebas usan
  `muestra-2026-10-03`).
- Para T90: los logros se cobran con `award_points('achievement', <id>,
  puntos, monedas)` (tope 300/50; los cosméticos que regala el logro van
  solos) y la entrega de la misión con `award_points('mission',
  'mision:<id>:entrega', …)`. La «temporada» del servidor es la activa de
  `seasons`, no el id del mundo como en local. `merge_guest` no trae sellos
  de compras de prueba locales (en Supabase el sello es por QR).
- Los topes de `point_actions` y los 45 s de El Freu son `muestra`: Álvaro los
  ajusta. La lista de palabras ofensivas es mínima.

## 2026-10-03 — plan 007 T85: Cerrar lo abierto: D-26, REQ-ENT-028, regla de bajo consumo, tamaño del still

Aplica las respuestas de Hernán del 2026-10-03 a lo que el plan 007 dejó
abierto.

Qué existe:
- **D-26 en `docs/DECISIONES.md`**, copiada tal cual del borrador (cabecera
  «· 2026-10-03 · Hernán y Álvaro · pendiente Álvaro (arte)»), con un párrafo
  final de respuestas de Hernán: REQ-ENT-028 sin objeto, bajo consumo con
  `deviceMemory ≤ 2`, still de 1600 px en móviles verticales. D-19, D-21 y
  D-24 llevan al final una línea «**Modificada por D-26** (2026-10-03): …».
  El borrador (`docs/propuestas/2026-10-03-D-26-borrador.md`) dice arriba que
  ya pasó y su tabla de abiertos marca los tres puntos como cerrados.
- **REQ-ENT-028 retirado**: nuevo estado `retirado` en `tools/spec/estado.py`
  (sin objeto por una decisión posterior; la nota tiene que citar la D-NN, si
  no, error) con dos pruebas en `test_estado.py`; leyenda en
  `docs/spec/estado.md`; la fila enlaza la prueba del hero sin línea de
  promoción (`blocks.test.ts`). En `02-entrada-y-landing.md` y
  `09-requisitos.md` el REQ dice «Sin objeto por D-26», fuente `…, D-26` y
  sin la marca `[pendiente Álvaro]`. Las citas «plan 007 (borrador D-26)» de
  la spec pasan a «plan 007 (D-26)».
- **Bajo consumo** (`apps/web/lib/intro/low-power.ts`): `LOW_MEMORY_GB` 4 → 2.
  Siguen `saveData`, `hardwareConcurrency ≤ 4` (no en WebKit de Apple) y la
  sonda de los primeros fotogramas. Prueba unitaria: `deviceMemory` 4 se
  queda con la escena 3D, 2 (y 1, 0,5) va al still. El e2e de bajo consumo
  prueba ahora `deviceMemory 2`.
- **Still nítido en vertical** (`hero-stills.tsx`):
  `sizes="(max-aspect-ratio: 1600/1000) 160vh, 100vw"`, el ancho con que
  `object-fit: cover` dibuja el still (igual que `max(100vw, 160vh)`, con
  condiciones de medio que lee cualquier navegador). Un móvil vertical con
  DPR 2 pide el de 1600 px; en escritorio no cambia nada. Nuevo e2e en
  `landing-perf.spec.ts`: 375×812, DPR 2, movimiento reducido → `currentSrc`
  `…-1600.webp`.
- `README.md`: «La landing: el hero por scroll» enlaza D-26 en
  `DECISIONES.md` y dice `deviceMemory ≤ 2`.
- `docs/TRASPASO.md`: D-26 pasada, conteos de la spec, la regla de memoria y
  el still en «Qué mide Hernán a mano».

Comandos:
- `grep -n "^## D-26" docs/DECISIONES.md` → una línea (629).
- `python3 tools/spec/estado.py` → exit 0; «294 REQ · HECHO 151 · PARCIAL 63
  · FALTA 32 · L2 28 · final 19 · retirado 1».
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000`
  → exit 0, 112 archivos, 1001 pruebas. `sh tools/spec/checks.sh` → exit 0
  (test_estado 8 pruebas). `pnpm lint` → exit 0. `pnpm typecheck` → exit 0.
- `pnpm build` → exit 0; «185.4 kB total, 13 archivos · presupuesto
  200.0 kB · OK».
- `E2E_PORT=3465 pnpm e2e landing-perf.spec.ts landing-scroll.spec.ts
  --workers=1` → exit 0; 33 pasan, 1 saltada (2,9 min). La primera vuelta
  falló el e2e nuevo por cómo medía el aspecto (`naturalWidth` va dividido
  por la densidad del srcset); corregido, ya pedía el de 1600 px.

Pendiente:
- Los textos `hero.explore.withPromotions` / `withoutPromotions` siguen en el
  catálogo i18n y en `textos-zonas.md` sin usarse.
- Probar en un Android real de 4 GB que la sonda de fotogramas basta.

## 2026-10-03 — plan 007 T83: Documentos: spec, ESTADO, TRASPASO y el borrador de la decisión

Plan 007 en resumen (T77–T84, todo en `main`): la landing es un solo scroll.
`/` reproduce la aparición del planeta y «BOIA» y queda en reposo con
«Zarpar» y «Entradas» desde el primer pintado y una pista para bajar; sin
avance automático ni «Saltar animación». El scroll lleva una escena three.js
fija: la zambullida del planeta al mar junto al puerto y, desde ahí, la
cámara avanza sobre el agua de la hora dorada a la noche con los bloques
encima como bandas oscuras editoriales (diseño v2 aprobado por Hernán, T77;
atrezzo y stills de Blender, T78; hero, T79). Versión estática con el still
de Blender para movimiento reducido, sin WebGL o bajo consumo. Rendimiento
(T80: motor del hero y panel en chunks aparte, calidad por niveles, sonda de
fotogramas; p95 33,4 ms con CPU 4×), accesibilidad (T81: axe 0 de cualquier
impacto, contraste en píxeles, teclado), contenido real sin código (T82:
`real-content.ts`, marca «MUESTRA»), e2e al día con el hero nuevo (T84). El
logo de BOIA en el pie y los enlaces a Spotify (Hernán). **La landing pesa
185,3 kB de 200 kB.**

Qué existe (T83, sólo documentos):
- `docs/propuestas/2026-10-03-D-26-borrador.md`: el texto propuesto de D-26
  para que Hernán lo pase a `DECISIONES.md` (no se ha tocado): la landing
  como scroll, versión estática, diseño editorial (v1 rechazada), logo y
  Spotify, tope de 200 kB, `landing_view` al pasar el hero; qué cambia en
  D-19, D-21 y D-24 punto 4; y lo abierto (arte del hero, licencia de Druk,
  P15/P17/P19, REQ-ENT-028, la regla `deviceMemory ≤ 4`, el still blando de
  800 px en móviles verticales).
- `docs/spec/02-entrada-y-landing.md` y `09-requisitos.md`: texto, título,
  criterio y notas de REQ-ENT-001, 002, 006, 007, 008, 010, 014, 017, 026,
  027 y 038 al flujo nuevo, citando «plan 007 (borrador D-26)»; nota de
  REQ-ENT-028 (sin sitio en el hero; marca `[pendiente Álvaro]` intacta);
  párrafo del plan 007 al principio del área. Fuente y alcance sin cambiar
  (los comprueba `check.py`); el texto de REQ-ENT-003 y 005 sigue hablando
  del 2D (viene de antes del plan 007).
- `docs/spec/estado.md`: 27 filas con su prueba del plan 007
  (`landing-scroll.spec.ts`, `landing-perf.spec.ts`, `intro.spec.ts`,
  `controller.test.ts`, `planet.test.ts`, `real-content.test.ts`):
  REQ-PRO-001, ENT-001–003, 006–010, 014, 017, 019, 020, 026, 027, 030, 032
  y 038 siguen HECHO con la prueba nueva; REQ-PRO-018 pasa de FALTA a
  PARCIAL (marca «MUESTRA» de T82); ENT-022, 024, 025, 028, 036 y ARQ-014,
  015, 016 siguen PARCIAL con la evidencia y las cifras de T80/T81.
- `docs/matriz-dispositivos.md`: las filas de la landing (móvil corto,
  scroll, foco, contraste, movimiento reducido, sin WebGL, conexión lenta)
  con las pruebas actuales.
- `docs/TRASPASO.md`: estado a 2026-10-03 (planes 001–007), peso final de la
  landing, lo que mide Hernán a mano en móvil y lo que aprueba Álvaro (arte
  del hero, licencia de Druk, contenido).
- `README.md`: «La landing: el hero por scroll» (cómo funciona, dónde está
  cada cosa, versión estática, cómo depurar, tope de 200 kB) y «Arte del
  hero de la landing (Blender)» (`tools/blender/landing/`); 192 → 200 kB en
  «Tipografías»; la comprobación del despliegue.

Comandos:
- `python3 tools/spec/estado.py` → exit 0; «294 REQ · HECHO 151 · PARCIAL 64
  · FALTA 32 · L2 28 · final 19» (antes PARCIAL 63, FALTA 33).
- `python3 tools/spec/check.py` → exit 0 (294 requisitos, centinelas 10/10).
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000`
  → exit 0, 112 archivos, 1000 pruebas. `sh tools/spec/checks.sh` → exit 0.
  `pnpm lint` → exit 0. `pnpm typecheck` → exit 0.
- `pnpm build` → exit 0; «185.3 kB total, 13 archivos · presupuesto
  200.0 kB · OK».
- Sin e2e (no cambia código; el orquestador corre la suite completa).

Pendiente:
- Hernán pasa D-26 a `DECISIONES.md` y responde lo abierto del borrador.
- Las mediciones en móvil real de TRASPASO (REQ-ENT-021, REQ-ARQ-017).
- `docs/propuestas/textos-zonas.md` aún lista `intro.skip` e
  `intro.ticketsOnly`; las filas de `/mar` de la matriz citan pruebas del 2D
  borrado; REQ-ENT-003 y 005 hablan aún del planeta 2D.

## 2026-10-03 — plan 007 T82: La landing lista para el contenido real

Qué existe:
- **Un solo sitio para lo real de Álvaro**:
  `packages/store/src/sample/real-content.ts` (`REAL_CONTENT`). El contenido
  de muestra se construye desde él (`sampleHomeBlocks(real)`,
  `sampleEvents(real)`, `sampleArtists(real)` en `sample/content.ts`; las
  constantes `SAMPLE_*` son esas funciones con `REAL_CONTENT`): meter lo
  real no toca ningún componente.
  - Enlaces (P15): entradas por evento, tienda, WhatsApp, Instagram, TikTok,
    correo, lista de Spotify de BOIA y Spotify de cada artista. `null` (o
    sin entrada) es la marca `muestra`: se usa el enlace sandbox de
    `example.com`. En `artistSpotify`, `null` = el artista no tiene (sin
    enlace); sin entrada = sigue el de prueba.
  - Fotos de artistas (P17): ids en `artistPhotos` →
    `/contenido/artistas/<id>.webp` en `photoUrl` (el campo de avatar de
    siempre; también es la foto de su Carnet de artista). Sin foto: en la
    banda sólo el nombre, en `/artistas` y el Carnet el avatar de iniciales.
  - Carteles (P19): ids en `eventPosters` →
    `/contenido/carteles/<id>.webp` en `posterUrl`.
  - Carpetas `apps/web/public/contenido/{artistas,carteles}/` (con
    `.gitkeep`).
- **Marca visible «MUESTRA»**: cualquier enlace de la landing (y de las
  páginas de `(landing)` y la vista previa del Admin) a
  example.com/.net/.org lleva detrás una etiqueta «MUESTRA» (contorno,
  10 px, versalitas). Es CSS (`landing.css`, `a:is([href*='example.com'],
  …):not(.button--buy)::after`) con el texto por clave (`link.sample`,
  puesto como `--sample-label` en `.landing-root` por
  `components/sample-label.ts`): 0 bytes de JS. Se quita sola al poner la
  URL real, venga del archivo o del Admin. «Comprar» no la lleva (su enlace
  sandbox sólo vive hasta hidratar; marcarlo movería la maquetación).
  `isSampleLink` (`@boia/contracts/links`, sin zod) dice lo mismo en código.
- **Hueco del cartel** en la banda «Próximo evento» (T77 §8): 3:4, encima
  del texto en móvil (hasta 260 px), a la derecha de la columna desde
  900 px (220 px de ancho); sin cartel, degradado `#1b1430 → #3a1a1a` con
  «Cartel próximamente» (`priority.posterSoon`); con cartel, `<img>` lazy
  con alt «Cartel de {nombre}» (`priority.posterAlt`). Prop `poster` de
  `EventCard`; sólo la usa el bloque del evento prioritario.
- Contratos: `photoUrl` del artista acepta una ruta propia (`/…`) además de
  una URL https (`imageRefSchema`, el mismo de `posterUrl`).
- Admin → Artistas: arreglado que guardar perdía `spotifyUrl`
  (`lib/admin/artist-form.ts`: guarda lo que el artista ya tenía con el
  formulario encima); nuevo campo «Spotify (URL, opcional)»; la foto admite
  la ruta (`/contenido/artistas/<id>.webp`) y la pista lo dice. La pista del
  cartel en Eventos nombra su ruta.
- `docs/contenido-real.md` (para Álvaro y Hernán): qué entregar, formato
  (proporción, tamaño, WebP, peso máximo) y archivo o campo del Admin de
  cada cosa: cartel de Halloween y de los otros eventos (P19), foto de cada
  artista y la de su Carnet (P17; las respuestas del Carnet de artista aún
  no tienen sitio), foto del Carnet de visitante (no se entrega), y los 8
  enlaces (P15); con la tabla de ids de los 26 artistas. `docs/entrega.md`
  (fila 15) lo enlaza.
- Pruebas: `apps/web/app/(landing)/components/real-content.test.ts` (un
  `RealContent` de prueba con cartel, fotos y enlaces reales sale en los
  bloques sin ninguna marca; la muestra pinta «Cartel próximamente», sin
  fotos, y cada enlace sandbox queda marcado por la regla de `landing.css`
  y ninguno real; archivos de `public/contenido` y listas coinciden; el
  documento nombra cada artista y cada enlace de entradas),
  `packages/contracts/src/links.test.ts`, `apps/web/lib/admin/artist-form.test.ts`.

Comandos:
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000`
  → exit 0, 112 archivos, 1000 pruebas.
- `sh tools/spec/checks.sh` → exit 0. `pnpm lint` → exit 0. `pnpm
  typecheck` → exit 0.
- `pnpm build` → exit 0; «185.3 kB total, 13 archivos · presupuesto
  200.0 kB · OK» (T80: 184,8 kB; +0,5 kB: CSS del hueco y de la marca
  +0,2, JS +0,2, HTML +0,1). Una primera versión con la marca como `<span>`
  en cada enlace pesaba +0,9 kB; por eso es CSS.
- Extra: `E2E_PORT=3421 pnpm e2e landing.spec.ts landing-scroll.spec.ts
  --workers=1` → exit 0, 32 pasan (axe y contraste sin cambios), más
  capturas de comprobación del hueco y las marcas (fuera del repo).

Pendiente:
- Las respuestas del Carnet de cada artista (P17) no tienen campo: hace
  falta código cuando lleguen.
- El Admin no edita los enlaces de tienda, contacto y pie (no lo hacía
  antes): en la versión de prueba el Admin sólo cambia el navegador de quien
  lo usa, así que lo real va en `real-content.ts`.
- T83: REQ-PRO-018 («Contenido no aprobado, marcado», FALTA) puede pasar a
  PARCIAL con `real-content.test.ts` (los enlaces sí; textos y fechas no).
- Las fotos de la galería (Fotos) siguen por Admin → Fotos con URL https; no
  tienen carpeta propia.

## 2026-10-03 — plan 007 T84: Los e2e que cambió el hero nuevo

Qué existe:
- Las ocho specs que T79 dejó con los nombres viejos del hero (accesos,
  carnet-descuento, ciclo-evento, demo, despliegue, mar-a-bordo, tickets,
  mar-3d) usan «Entradas» y «Zarpar» del hero nuevo y pasan en los dos
  proyectos. Lo que demuestra cada una no cambia.
- Ayuda nueva `apps/web/e2e/hero-helpers.ts`: `heroTickets`/`heroZarpar`
  (por rol y nombre desde `t('hero.tickets')`/`t('hero.explore')`, el
  catálogo i18n), `ticketsPanel`, `tap` (la pulsación de puntero real en el
  centro del elemento de T81, la misma que `landing-scroll.spec.ts`: el
  `click()` de Playwright desplaza la página sobre la UI sticky del hero y la
  cabecera fija), `pastHero` (baja una pantalla para que salga la cabecera)
  y `openHeroTickets`.
- `docs/propuestas/textos-zonas.md` tiene la fila `circuit.void.offroad`
  («Carrera anulada: te saliste del circuito»), tras `circuit.void.slow`;
  regenerar con `scripts/i18n-zonas.mjs` ya no la quita (sin diff en
  `apps/web/lib/i18n`).

Aserciones cambiadas (y por qué):
- Las siete que abrían el panel con el enlace «Tickets» del hero (accesos,
  carnet-descuento, ciclo-evento, demo, despliegue, mar-a-bordo, tickets):
  ahora pulsan «Entradas» del hero (`hero.tickets`, renombrado por T79) con
  `tap`.
- demo.spec: «Zarpar» era un botón de la capa de la entrada; ahora es el
  enlace «Zarpar» del hero (`tap`), y sigue llevando a `/mar` con la
  bienvenida. `cta-3d` espera `href` = `ZARPAR_HREF`
  (`/mar?menu=bienvenida`) en vez de `/mar`.
- mar-3d.spec «la landing enlaza el mar 3D»: `cta-3d` con `href` =
  `ZARPAR_HREF` en vez de `/mar`.
- accesos.spec «Tickets se ve sin scroll a 360×640…»: «Entradas» en vez de
  «Tickets»; la comprobación de que la cabecera no se desborda se hace tras
  bajar del hero (`pastHero`), porque en el hero la cabecera espera fuera de
  pantalla (T79, T77 §7.2). Antes se comprueba igual que el scroll es 0 con
  «Entradas» entera en pantalla y ≥ 44 px.
- accesos.spec «cabecera con Mi Carnet y sonido…»: baja del hero antes de
  usar la cabecera (mismo motivo) y pulsa «Menú» (móvil) y el sonido con
  `tap`: con `click()` Chrome desplazaba la página de vuelta al hero y la
  cabecera se ocultaba (fallaba por tiempo en móvil).
- despliegue.spec «sin clave de PostHog…»: `landing_view` ya no se envía al
  cargar `?intro=0` sino al pasar el hero con el scroll (T79), así que sólo
  quedaba el evento de abrir el panel y `> 1` fallaba. Ahora baja del hero
  (espera un `landing_view`), vuelve arriba y abre el panel; la aserción
  (`> 1` eventos registrados en la página y ninguna petición a PostHog) es la
  misma.
- Títulos de las pruebas sin cambiar (docs/spec/estado.md cita algunos).

Comandos:
- `E2E_PORT=3435 pnpm e2e accesos.spec.ts carnet-descuento.spec.ts
  ciclo-evento.spec.ts demo.spec.ts despliegue.spec.ts mar-a-bordo.spec.ts
  tickets.spec.ts mar-3d.spec.ts --workers=1` → exit 0, 67 pasan, 3 saltadas
  por proyecto a propósito (las dos de `/api/art` sólo en escritorio, la de
  360×640 sólo en móvil).
- `node apps/web/scripts/i18n-zonas.mjs` → «es-zonas-web.ts: 84 ·
  es-zonas-eventos.ts: 14 · es-zonas.ts: 536 claves»;
  `git status --porcelain apps/web/lib/i18n` vacío.
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000`
  → exit 0, 109 archivos, 990 pruebas.
- `sh tools/spec/checks.sh` → exit 0. `pnpm lint` → exit 0.
  `pnpm typecheck` → exit 0.
- `pnpm build` → exit 0; «184.8 kB total, 13 archivos · presupuesto
  200.0 kB · OK».

Pendiente:
- `record.spec.ts` y `record-titulo.spec.ts` (grabaciones, sólo con
  `RECORD_*=1`) siguen buscando el botón «Zarpar» de antes; no son de esta
  tarea.

## 2026-10-03 — plan 007 T80: Performance and budget

Qué existe:
- **Presupuesto de la landing: 184,8 kB** gzip (T79: 192,4 kB; tope 200 kB).
  El chunk de la página baja de 11,1 a 3,4 kB:
  - `lib/intro/lazy.ts`: el motor del hero (`run.ts`: controlador, scroll,
    bucle de pintado y su analítica) va en su propio chunk, pedido en cuanto
    corre el chunk de la página (en paralelo con la hidratación).
    `intro-stage.tsx` sólo cambia el import. Mientras no llega: el script de
    arranque ya decide la entrada y adelanta con un scroll, «Zarpar» es un
    enlace normal a /mar y «Entradas» abre el panel por `:target`; un
    «Entradas» pulsado antes adelanta la aparición al llegar.
  - `components/landing-client-lazy.tsx`: `LandingClient` (panel de Tickets
    y analítica del embudo; no pinta nada) también en chunk aparte.
    `landing-client.tsx` no se toca.
  - three.js (la escena) se pide después del evento `load` de la página
    (antes podía retenerlo ahora que el motor llega antes).
- Escena (`lib/planeta/intro-scene.ts`, `quality.ts`, `sea-rig.ts`):
  - Cada rig se compila contra su render target (salida lineal), no contra
    el canvas: los primeros fotogramas ya no recompilan shaders (eran
    tareas largas a mitad de scroll: `getProgramInfoLog` 182 ms → 30 ms con
    GPU real).
  - Calidad por niveles: 0 = el diseño (MSAA 4×, DPR ≤ 1,5), 1 sin MSAA,
    2 y 3 sin MSAA a 0,75 y 0,5 de resolución (viewport dentro del target,
    el pase final reescala). **Todo fotograma en reposo se pinta a nivel 0**;
    los niveles bajos sólo se usan en movimiento (scroll, aparición,
    «Zarpar») en una GPU que no los aguanta, y al parar se repinta a 0. En
    una GPU que va bien el nivel en movimiento es 0: la imagen es la misma.
  - Sonda de primeros fotogramas: al crear la escena mide lo que cuesta un
    fotograma de planeta y uno de mar, con GPU incluida (`readPixels` de
    1 px; el `finish` de Chrome no espera), en los niveles 0, 1 y 3, y
    elige el primero que cabe en 20 ms. Si ni el nivel 3 llega a 30 fps
    (> 33,3 ms) → versión estática (`LowPowerError`, `quality.lowFps`). En
    movimiento, si la mediana de 12 intervalos pasa de 30 ms, baja un nivel
    (sólo baja).
  - Los props GLB de T78 se piden con la página tranquila tras el reposo
    (`requestIdleCallback`, ≤ 2 s) o con el primer scroll; se descargan a la
    vez y se parsean y compilan de uno en uno, con una tarea entre medias,
    y cada uno se compila antes de entrar en la escena.
- Bucle (`lib/intro/run.ts`): pinta sólo si cambió el scroll o hay
  animación por tiempo (como T79); en reposo, a 30 fps como mucho y un
  fotograma de calidad completa como mucho cada 4× lo que cuesta a la GPU
  (la cuarta parte de T57, ahora con la GPU medida): en una GPU lenta el
  giro del planeta y el agua van a saltos, las letras de «BOIA» siguen a su
  ritmo y no se encolan fotogramas. Pestaña oculta: no pinta (ya era así).
  El tamaño se lee antes de escribir el DOM del fotograma (sin layout
  forzado); `data-hero-top` sólo se toca si cambia.
- Bajo consumo (`lib/intro/low-power.ts`, con pruebas): `saveData`,
  `navigator.deviceMemory ≤ 4` o `hardwareConcurrency ≤ 4` → versión
  estática sin WebGL; más la sonda. **En WebKit de Apple (Safari y todo
  navegador de iOS) `hardwareConcurrency` no cuenta**: siempre dice 4 u 8
  (todo iPhone dice 4), así que la regla literal mandaría todos los iPhone
  al still; ahí decide la sonda.
- Diagnóstico: `window.__boiaIntro.quality = { probeMs, motion, lowFps,
  stepDowns }`.
- `apps/web/e2e/landing-perf.spec.ts`: scroll de 6 s del hero al pie a
  375×812 con CDP CPU 4× (p95 ≤ 50 ms, ninguna tarea larga > 200 ms tras
  la escena lista) en el proyecto móvil; movimiento reducido y los tres
  bajo consumo sin contexto WebGL, en los dos proyectos.

Medidas (Chromium headless, 375×812, CPU 4×; la GPU de Playwright headless
es SwiftShader, por software, que es lo que cuesta; puede que T81 corriera
e2e a la vez):
- Antes (build de T79, mismo spec): p50 83,3 ms, p95 100 ms, peor 367 ms;
  93 tareas largas tras la escena lista, la mayor 373 ms.
- Después (corrida del Done-when): 224 fotogramas, p50 33,3 ms, p95
  33,4 ms, peor 150 ms; 5 tareas largas tras la escena lista (116, 100, 94,
  89, 133 ms: los fotogramas de reposo a calidad completa); sonda
  `[75,8, 25,6, –, 19,8]` ms → nivel 3 en movimiento. Otras corridas: p50
  16,7, p95 33,4, tareas ≤ 168 ms.
- Con la GPU real de esta máquina (`--use-angle=d3d11`, script aparte, no
  el spec): sonda 2,9 ms → nivel 0 en movimiento (imagen idéntica), p50 y
  p95 16,7 ms.

Comandos:
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000`
  → exit 0, 109 archivos, 990 pruebas.
- `sh tools/spec/checks.sh` → exit 0. `pnpm lint` → exit 0. `pnpm
  typecheck` → exit 0.
- `pnpm build` → exit 0; «184.8 kB total, 13 archivos · presupuesto
  200.0 kB · OK».
- `E2E_PORT=3401 pnpm e2e landing-perf.spec.ts --workers=1` → exit 0, 9
  pasan, 1 omitida (la medida de scroll sólo corre en el proyecto móvil).
- `E2E_PORT=3402 pnpm e2e landing-scroll.spec.ts intro.spec.ts --workers=1`
  → exit 0, 48 pasan.
- Extra: `E2E_PORT=3403 pnpm e2e landing.spec.ts --workers=1` → exit 0, 10
  pasan.

Qué mirar a mano en un móvil real (Hernán):
- iPhone (Safari) y un Android medio, en https con la versión desplegada:
  la escena sale (no el still) y en la consola remota
  `__boiaIntro.quality` da `motion` 0 o 1 y `probeMs[0]` (coste a calidad
  completa); si un móvil decente da el still, mirar `lowFps` y
  `navigator.deviceMemory` (un Android con 4 GB va al still por la regla
  `deviceMemory ≤ 4`: decidir si se queda así).
- Scroll rápido de arriba abajo y vuelta: sin tirones, sin saltos de
  maquetación, el planeta y el mar siguen al dedo; al soltar, la imagen no
  se ve más borrosa que en reposo (si se ve, la GPU está en un nivel bajo).
- Reposo dos minutos: el móvil no se calienta ni gasta batería de más
  (DevTools remoto → Performance: pocos fotogramas por segundo en reposo).
- Ahorro de datos activado en Chrome Android → el still, sin canvas.
- La primera vez con 4G lento: «Entradas» abre el panel y «Zarpar» lleva a
  /mar aunque la escena aún no haya llegado.

Pendiente:
- La regla `deviceMemory ≤ 4` manda al still a muchos Android de gama media
  (Chrome redondea a 4 GB); es lo que pide la tarea, Hernán decide.
- No se ha separado el CSS de las bandas: son contenido pintado por el
  servidor que una URL directa (`/#fotos`, eventos) enseña en el primer
  pintado y la primera banda asoma en la primera pantalla; cargarlo tarde
  daría destellos sin estilo y saltos de maquetación (son 5,9 kB).
- Los stills usan `sizes="100vw"` con `object-fit: cover`: en vertical se
  muestran ~1,6 veces más anchos que la vista, así que un móvil de DPR ≤ 2
  pide el de 800 px y se ve blando. `sizes="max(100vw, 160vh)"` lo
  arreglaría (+80 kB en móvil); es un cambio visible, no se hizo.

## 2026-10-03 — plan 007 T81: Accesibilidad, movimiento reducido y el e2e del flujo completo

Qué existe:
- axe (todas las severidades) da 0 violaciones en reposo, tras la zambullida,
  en las bandas, de noche (Fotos) y en el pie, con y sin el panel de Tickets,
  en móvil y escritorio. La única que había: `page-has-heading-one` en
  cuanto se bajaba, porque el h1 (visualmente oculto) vive dentro de
  `.hero__ui`, que la zambullida pone en `visibility: hidden`. Arreglo:
  `.hero__ui > h1 { visibility: visible; }` en `landing.css` (el DOM no
  cambia).
- Movimiento reducido: además de la versión estática de T79 (sin canvas,
  sin cámara, el still), la rotación de artistas empieza en pausa
  (`artist-rotator.tsx`; el botón dice «Reanudar rotación» y la arranca).
  Nada corre solo: `document.getAnimations()` en marcha = [] con el pulso, la
  pista y la boia ya parados por CSS.
- Contraste medido en píxeles (`apps/web/e2e/contrast.ts`): axe no puede
  medir texto sobre el canvas, el still o los degradados de las bandas (lo
  deja en «incomplete»), así que la prueba hace una captura con los glifos
  transparentes y compara el color de cada texto visible (con su alfa y la
  opacidad de sus padres) con cada píxel de fondo bajo sus glifos; pasa si
  el 95 % de los píxeles da ≥ 4,5:1 (≥ 3:1 en texto grande). Peores valores
  con los tokens de T77, sin cambiar ninguno: rótulos al 50 % 5,28–5,32:1
  (escena viva, still y bandas); pista 9,3–9,6:1; «Zarpar» negro sobre
  naranja 5,71:1; marcadores «Foto de muestra» de noche 5,17:1; «BOIA»
  plano sobre el still dorado 3,16:1 (escritorio) y 3,48:1 (móvil), texto
  grande y además logotipo. Las letras 3D sobre la escena viva son canvas y
  no se miden (logotipo, `aria-hidden`; el h1 lleva el nombre).
- Teclado: en reposo el foco está en «Zarpar»; Mayús+Tab → «Saltar al
  contenido»; Tab → «Zarpar» → «Entradas» → la pista («Desliza para bajar al
  mar»), todos en pantalla con el anillo blanco de 3 px y halo `#05080f`;
  Enter en la pista baja una pantalla (el mar) y el siguiente Tab entra en
  las bandas. En visita directa, Tab + Enter en el salto lleva a
  `#contenido` y el siguiente Tab es «Zarpar». El canvas de la escena es
  `aria-hidden` + `role="presentation"` dentro de `.hero__scene`
  `aria-hidden`; los stills `alt=""`; la pista tiene texto.
- Panel de Tickets: Escape lo cierra y devuelve el foco a «Entradas» del
  hero; Atrás lo cierra sin mover la página y devuelve el foco a «Entradas»
  de la cabecera; «Cerrar» en el pie.
- `landing-scroll.spec.ts` cubre el flujo completo en 375×812 y 1280×800:
  aparición → reposo → zambullida → mar → noche → pie → vuelta arriba (una
  escena, un `landing_view`); «Zarpar» → /mar; `/#tickets` y `?intro=0`;
  Atrás desde /mar (reposo, `history ['paused']`, arriba del todo, el scroll
  sigue llevando la escena); sin WebGL; escena lenta; movimiento reducido;
  accesibilidad y teclado. `landing.spec.ts`: el axe pasa a exigir 0
  violaciones de cualquier impacto (antes sólo serias y críticas).
- Las pulsaciones de la spec son de puntero real (`tap`, centro del
  elemento): `locator.click()` de Playwright desplaza «hacia la vista» antes
  de pulsar y, sobre la UI sticky del hero y la cabecera fija, Chrome mueve
  la página (hasta 577 px): la escena se zambullía antes de «Zarpar» y el
  panel se abría 404 px más arriba. No le pasa a un visitante; era la causa
  del fallo intermitente de «Zarpar lleva a /mar» bajo carga.
- `intro.spec.ts` «Entradas durante la aparición»: fallaba en escritorio
  bajo carga (la aparición dura 1,4 s y el clic de Playwright llegaba tarde:
  `outcome` `played`); ahora la página pulsa «Entradas» en el primer
  fotograma de la aparición y la prueba comprueba que fue durante ella. Lo
  que demuestra no cambia.
- Capturas (`RECORD_T81=1`):
  `docs/informes/img/p007-t81-{reposo,bloques,pie,reducido}-{mobile,desktop}.png`
  (reposo con el anillo de foco en «Zarpar»).

Comandos:
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000`
  → exit 0, 107 archivos, 982 pruebas.
- `sh tools/spec/checks.sh` → exit 0. `pnpm lint` → exit 0.
  `pnpm typecheck` → exit 0.
- `pnpm build` → exit 0; «192.5 kB total, 13 archivos · presupuesto
  200.0 kB · OK».
- `E2E_PORT=3414 pnpm e2e landing-scroll.spec.ts landing.spec.ts intro.spec.ts
  --workers=1` → exit 0, 70 pasan (35 por proyecto, móvil y escritorio;
  landing-scroll 11 por proyecto, 6 nuevos y uno ampliado).

Pendiente:
- El resto de `intro.spec.ts` sigue pulsando «Zarpar» con
  `locator.click()` (pasa); si falla bajo carga por el desplazamiento de
  Playwright, usar la pulsación de puntero real de `landing-scroll.spec.ts`.
- «BOIA» plano sobre el still dorado queda en 3,16:1 en escritorio (justo
  sobre 3:1); si Álvaro cambia el still, la prueba de contraste lo vigila.

## 2026-10-03 — plan 007 T79: Scroll-bound three.js hero and the hand-off to the landing

Qué existe:
- La landing es un scroll continuo (diseño v2 aprobado de T77,
  `docs/propuestas/2026-10-03-landing-scroll.md`). `/` reproduce la
  aparición (planeta, «BOIA») y queda en reposo con «Zarpar» y «Entradas»
  (visibles desde el primer pintado), la pista «Desliza para bajar al mar» y
  los rótulos de esquina (BOIA · Alicante, coordenadas del puerto, la frase
  de posicionamiento). Sin avance automático; «Saltar animación» y «Solo
  quiero ver las entradas» ya no existen («Entradas» abre el panel de
  Tickets y adelanta la aparición, igual que un scroll o un enlace).
- La escena three.js es fija bajo toda la página y la lleva la posición de
  scroll `s` (en alturas de vista, suavizada ~90 ms): de 0 a ~0,92 se
  recorre la zambullida de «Zarpar» (la misma trayectoria, ahora por scroll),
  con la UI fuera en 0,15 y la atmósfera azul; de 0,84 a 1 un fundido con
  bruma dorada al rig del mar; desde 1, la cubierta tras el barco junto al
  puerto de T78 (costa, diques con balizas verde y roja, farolas, barco,
  boya; GLB de `art/landing/3d` cargados tras el primer fotograma según el
  bloque `escena` del manifiesto) y la cámara avanza despacio sobre el agua
  (sale por la bocana) mientras la luz pasa de hora dorada a anochecer y
  noche, que llega con la banda de Fotos (T77 §7.3). Agua por shader
  (reflejo del cielo por fresnel, camino del sol o la luna), cielo por
  ánimo con sol, luna y estrellas, islas en el horizonte con luces de noche,
  halos y reflejos de las luces; pase final con bruma, viñeta y grano. El
  planeta del reposo es el de /mar con el grado del hero (más oscuro, frío,
  a contraluz; nubes en estela translúcida).
- `lib/intro`: el controlador (`packages/engine/src/intro/controller.ts`)
  tiene la nueva semántica: `paused` es el reposo (para todos los modos;
  una URL directa nace ahí), `landed` sólo es «Zarpar» terminado (al
  juego), `fallback` es la versión estática (movimiento reducido, sin
  WebGL, escena fuera de plazo o que falla, ahorro de datos). Config v6
  (`planet.ts`): encuadres 0/600/900 de T77 §5.1, bloque `scroll`, sin
  `autoAdvance` ni `ticketsOnly` ni pose `hero`; `scrollState` y los
  fotogramas del reposo por scroll son puros y con pruebas. El script de
  arranque marca `data-hero="still"` + `data-hero-static` con movimiento
  reducido antes del primer pintado, `data-hero-top` mientras se está en el
  hero (la cabecera espera) y un scroll antes de hidratar adelanta la
  aparición. `window.__boiaIntro.scroll = { s, phase, light }` y
  `.hero[data-scroll-phase="rest|dive|sea"]` para las pruebas.
- «Zarpar» es un enlace a `/mar?menu=bienvenida` (funciona sin JS); con el
  hero, se zambulle con el velo y `router.push` (`explore_start` source
  `intro`). La cabecera aparece al acabar la zambullida, con el wordmark y
  la píldora «Zarpar» (≥ 600 px; velo sin zambullida). `landing_view` se
  envía una vez al pasar el hero con el scroll (`intro` = cómo se llegó al
  reposo).
- Versión estática: el still de T78 (`hero-still-*.webp`, dorado y de
  noche al llegar a Fotos), misma maquetación, scroll normal, sin WebGL.
- Bloques: restyle de superficie a bandas noche (`--band`) que suben del
  mar con fundidos de 14 vh y ventanas de mar de 50 vh, rejilla editorial
  (rótulo a la izquierda, contenido a la derecha desde 900 px), fecha del
  próximo evento como display («31 OCT»), eventos y artistas en filas con
  hairlines, fotos a sangre con placeholders de luz de escenario, tienda
  como línea corrida. Panel de Tickets intacto. Vista previa del Admin:
  usa el still como fondo y sigue funcionando.
- Adendas de Hernán (§15 del documento de T77): el wordmark de BOIA grande
  en el pie sobre el mar de noche (`role="img"`, nombre «BOIA»), y Spotify:
  «Escúchalo en Spotify» (lista de BOIA, enlace `Spotify` del pie) en
  Artistas y en el pie, y un enlace «Spotify» por artista con `spotifyUrl`
  (campo nuevo opcional del artista). Enlaces planos `target="_blank"
  rel="noopener noreferrer"`, nada cargado de Spotify. URLs `muestra`
  (sandbox) hasta P15.
- Textos por clave (`muestra`): `hero.scrollHint`, `hero.place`,
  `hero.coords`, `photos.display`, `nav.zarpar`, `artists.spotify(.aria)`,
  `artist.spotify(.aria)`; `nav.tickets`, `hero.tickets` → «Entradas» y
  `hero.explore` → «Zarpar» (la etiqueta del Admin del CTA sigue siendo
  `hero.explore`), cambiados en `docs/propuestas/textos-zonas.md` y
  regenerados con `scripts/i18n-zonas.mjs`.
- Presupuesto de la landing: tope a 200 kB en
  `apps/web/scripts/landing-budget.mjs`; **la landing mide 192,4 kB** (antes
  189,6).
- Capturas: `docs/informes/img/p007-t79-{reposo,zambullida,mar,noche,estatica}-{mobile,desktop}.png`
  (`RECORD_T79=1` en `landing-scroll.spec.ts`).

Comandos:
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000`
  → exit 0, 107 archivos, 982 pruebas.
- `sh tools/spec/checks.sh` → exit 0.
- `pnpm lint` → exit 0. `pnpm typecheck` → exit 0.
- `pnpm build` → exit 0; «192.4 kB total, 13 archivos · presupuesto
  200.0 kB · OK».
- `E2E_PORT=3393 pnpm e2e intro.spec.ts landing.spec.ts tipografia.spec.ts
  landing-scroll.spec.ts --workers=1` → exit 0, 74 pasan (móvil y
  escritorio).

Aserciones e2e cambiadas (y por qué):
- intro.spec: las acciones en pantalla durante la aparición son «Zarpar» y
  «Entradas» (antes «Solo quiero ver las entradas» y «Saltar animación»,
  que el plan quita); el filtro cuenta sólo lo que está en la vista. El
  título es `.hero__wordmark` y «Zarpar» un enlace (antes un botón de la
  capa de la entrada). El reposo es la fase `paused` también en visitas
  directas: `history` de `?intro=0`, `?menu=`, la vuelta de /mar y la
  navegación interna pasa de `['landed']` a `['paused']` (antes «landed» era
  «la landing visible»; ahora sólo «Zarpar» llega a `landed`). `twoHeroButtons`
  espera `[ZARPAR_HREF, '#tickets']` (antes `/mar`). Escena lenta, motor
  bloqueado y sin WebGL esperan la versión estática (`fallback`, el still)
  en vez de la landing ligera con el planeta CSS. «Entradas» durante la
  aparición: reposo `skipped` y sin `landing_view` (ahora cuenta al pasar el
  hero). Los tests de «Saltar» pasan a «Escape cinco veces en reposo» y
  «Escape durante Zarpar no lo corta»; nuevo «un scroll durante la aparición
  la adelanta». Movimiento reducido: la versión estática sin escena ni
  letras 3D, «Zarpar» con fundido al juego; «Saltar con movimiento
  reducido» pasa a «una URL directa también es la versión estática».
  `inTheGame` ya no comprueba `outcome` (es el del reposo) ni
  `.intro-overlay`.
- landing.spec: «Tickets» → «Entradas»; título «CTA Zarpar y Entradas se
  ven sin scroll». D-07 en ≤ 480 px: la fila «Zarpar» + «Entradas» ocupa el
  ancho menos márgenes, con «Zarpar» la mayor (antes «Explorar» sola a todo
  el ancho; T77 §5.1 pone las dos píldoras en fila). `landing_view` ya no
  llega al cargar `?intro=0`: la prueba hace scroll más allá del hero y
  espera uno con `intro: 'none'`; en la del panel se quita de la lista.
- tipografia.spec: el texto con Inter se comprueba en los rótulos de esquina
  del hero (antes el primer `<p>` del hero, que ahora es «BOIA» con la
  display); se añade que «BOIA» usa la display.
- docs/spec/estado.md: títulos de prueba de REQ-ENT-019, 020, 026, 027 y 038
  actualizados a los nuevos; REQ-ENT-028 (subtítulo según promociones) pasa
  a PARCIAL: el diseño aprobado quita esa línea (T83 revisa el texto).

Pendiente:
- Otros e2e que no son de esta tarea siguen buscando el enlace «Tickets» del
  hero o `cta-3d` con `href="/mar"`: accesos, carnet-descuento,
  ciclo-evento, demo, despliegue, mar-a-bordo, tickets, mar-3d; demo.spec
  espera la fase `paused` (sigue valiendo). Hay que pasarlos a «Entradas» y
  a `ZARPAR_HREF` antes de la corrida completa del plan.
- Arte `muestra`: el planeta del reposo es el mundo de /mar con su grado;
  el still y los GLB, de T78; Álvaro aprueba el arte final. Sin bloom a
  pantalla completa ni DOF (halos por sprites); T80 mide en móvil y fija
  la heurística de bajo consumo (hoy sólo `saveData`).
- El cartel del próximo evento (hueco 3:4) y la edición de las URL de
  Spotify son de T82; el editor de artistas del Admin no conserva aún
  `spotifyUrl` al guardar.
- `circuit.void.offroad` no está en `docs/propuestas/textos-zonas.md`: al
  regenerar `i18n-zonas` se pierde; se repuso a mano en `es-zonas.ts`.

## 2026-10-03 — plan 007 T78: Hero 3D art from Blender: GLB props and the still render

Qué existe:
- Los cuatro props realistas del hero de la landing que pide el §12 del
  documento aprobado de T77 (`docs/propuestas/2026-10-03-landing-scroll.md`),
  como scripts reproducibles en `tools/blender/landing/` (`costa.py`,
  `puerto.py`, `barco.py`, `boya.py`, helpers en `comun.py`, exportador
  `export_landing_glb.py`) y exportados a `art/landing/3d/<id>.glb` con
  `manifest.json` (id, file, label, doc, anchor, scale, height, bounds,
  tris, kb, materials, lights, normals; esquema
  `tools/blender/landing3d.schema.json`). Sin mascota, nubes ni gaviotas; sin
  Draco ni texturas (colores de vértice); ≤ 4 materiales por prop; cada luz
  es una malla aparte `luz_*` con material emisivo para que three.js le
  cuelgue su halo. Total 6 222 triángulos de los 12 000 y 203 kB de los 220.
  La costa (cabo cercano con acantilado y sierra lejana), el puerto (dos
  diques de escollera con espaldón y paseo, cabezas redondas con las torres
  de baliza verde a la izquierda y roja a la derecha, muelle con ocho
  farolas y norays), el barco (motovelero de 10,4 m con casco, cubierta,
  cabina, bañera y rueda, palo, botavara con la mayor aferrada, obenques,
  candeleros, dos faroles y luz de tope) y la boya de balizamiento (flotador
  naranja con defensa, torre de celosía y linterna).
- Convención: metros, agua en y = 0; el mar (hacia donde mira la cámara del
  hero) es +Y en Blender y −z en glTF, donde mira una cámara de three.js por
  defecto. El manifiesto lleva además el bloque `escena` (cámara, posición y
  giro de cada prop, sol y luna) con el que T79 coloca los GLB igual que los
  stills.
- Los stills de la versión estática en `art/landing/`:
  `hero-still-1600.webp` (104,9 kB ≤ 120), `hero-still-800.webp` (26,7 ≤ 50),
  `hero-still-noche-1600.webp` (114,4 ≤ 120), `hero-still-noche-800.webp`
  (42,4 ≤ 50), de `tools/blender/landing/render_hero_still.py` sobre
  `escena.py`: misma cámara que el fotograma 03 sin la banda (horizonte al
  42 %, sol al 66 % y 4° arriba, barco al 50 %, diques a los lados, costa a
  la izquierda, boya al 84 %), EEVEE con agua del modificador Ocean, bruma
  volumétrica baja, profundidad de campo en el barco, bloom, viñeta 0,45 y
  grano 5,5 % (numpy, con semilla). Reproducible: los GLB salen idénticos
  byte a byte entre corridas; los stills iguales a la vista y en tamaño, no
  en bytes (el muestreo de EEVEE en GPU no es exacto al bit).
- `tools/blender/check.py` valida `art/landing/3d/` y los stills
  (`check_landing_3d`); lo corre `tools/spec/checks.sh`.
- Informe de validación `docs/informes/p007-t78-arte-hero.md` (triángulos
  evaluados, materiales, kB, reimportación limpia con la skill de
  validación: `hard_gate_pass` en los cuatro, 0 incidencias) con las vistas
  en `docs/informes/img/p007-t78-{costa,puerto,barco,boya}-{vistas,hero}.png`.
- Todo `muestra`: el arte definitivo lo aprueba Álvaro.

Comandos:
- `blender.exe -b -P tools/blender/landing/export_landing_glb.py` → exit 0,
  4 GLB y el manifiesto; 6 222/12 000 triángulos, 203/220 kB.
- `blender.exe -b -P tools/blender/landing/render_hero_still.py` → exit 0,
  4 WebP dentro de sus límites.
- `python3 tools/blender/check.py` → exit 0 (`landing/3d (landing-glb)`).
- Pruebas completas paso a paso (el guardián no deja encadenarlas) → exit 0
  en los cinco: vitest 107 ficheros, 976 pruebas (5,2 s); checks.sh OK con
  `landing/3d` en el check de arte; eslint 0 avisos; build con la landing en
  189,6 kB / 192 kB (sin cambios: la tarea no toca apps/web); typecheck Done
  en world, db, store, engine y web.

Pendiente:
- T79 integra los GLB y los stills (`manifest.json` → `escena`, `lights`);
  la costa va sin normales en el GLB (el loader las calcula, suaves): si
  `GLTFLoader` no las calculara, `computeVertexNormals()` a mano.
- Los kB por prop de puerto, barco y boya superan las cifras orientativas del
  §12 (vértices partidos en aristas duras + JSON del GLB); los topes totales
  se cumplen. Si hiciera falta más geometría, KHR_mesh_quantization (three.js
  lo lee sin descodificador) daría ~40 % más de margen.
- README de `tools/blender/landing/` (T83). Aprobación del arte por Álvaro.

## 2026-10-03 — plan 007 T77: Design plan for the scroll hero and the hand-off to the blocks

Qué existe:
- `docs/propuestas/2026-10-03-landing-scroll.md`, versión 2: el plan de
  diseño de la landing como un solo scroll, rehecho tras rechazar Hernán la
  v1 («muy low poly, muy básico; quiero una página de festival profesional»)
  con andyhardy.co y observatoriofestival.com como referencias de tono (§1
  resume qué hacen y qué se toma). La v2 parte de la landing oscura actual:
  página negra, el mar como fotografía (siluetas a contraluz, camino del sol
  en el agua, bruma, grano, viñeta, bloom y profundidad de campo), bandas
  oscuras que emergen del mar con fundidos y una retícula editorial (rótulo
  pequeño en mayúsculas a la izquierda, tipografía grande a la derecha),
  Archivo Expanded a tamaño de display. Secciones que pide el plan 007:
  paleta (gradación cinematográfica propia del hero: espacio, zambullida,
  hora dorada, ocaso, noche; tokens de interfaz), escala tipográfica
  (375/768/1280), composición en reposo y en el mar (encuadre nuevo a 600 px,
  planeta de escritorio en y 0,47), capas (three.js, CSS, imagen; agua con
  reflejo del cielo y camino especular; pase de post), mapa de movimiento
  (tabla s → cámara, luz, UI, cabecera, bandas; la noche llega con Fotos),
  restyle de superficie de los bloques, versión estática (still de Blender
  con fundido a negro, noche desde Fotos), accesibilidad (contrastes, foco,
  aria), claves i18n (`hero.tickets` → «Entradas», `hero.scrollHint`,
  `hero.place`, `hero.coords`, `photos.display`, `nav.zarpar` si se aprueba;
  fuera `intro.skip` y `copy.ticketsOnly`), props para Blender como atrezo
  fotográfico (costa 3 000 tris / 45 kB, puerto 3 500 / 55 + atlas 60,
  barco realista 2 000 / 35, boya 400 / 10; total 8 900 tris, 145 kB + 60;
  topes 12 000 / 220) y los stills (1600 y 800 px, día y noche), las 10
  preguntas abiertas resueltas por Hernán como se recomendaba (§13: botón
  «Zarpar» en la cabecera, `nav.tickets` → «Entradas», boya real, barco
  nuevo realista, gradación propia del hero, encuadre a 600 px, panel de
  Tickets sin tocar, pase de post con grano y viñeta siempre) y una nota de
  por qué se rechazó la v1 (§14). Aprobado el 2026-10-03 por Hernán (línea
  arriba del documento).
- Ocho fotogramas de storyboard v2 en `docs/informes/img/p007-t77-0{1..8}-*.svg`
  (mismos nombres que la v1, sobrescritos): reposo escritorio, zambullida,
  mar con la primera banda, noche con fotos, reposo móvil, versión estática,
  composición 375/768/1024, mapa de movimiento. SVG con tipografías de
  respaldo del sistema, no código de la app; sus PNG para Hernán están fuera
  del repo (`C:\Users\alvar\AppData\Local\Temp\orchestrator-attach\boia-planet-hernan-T77\`).
- Las referencias se leyeron con el navegador integrado (texto, fuentes y
  estructura por JavaScript) y con capturas de Chromium headless a 1280×800
  y 390×844 (fuera del repo).
- Todo `muestra`: el arte definitivo lo aprueba Álvaro.

Comandos:
- `export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**'
  --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build
  && pnpm typecheck`, corrida paso a paso (el guardián del worktree no deja
  encadenarla) → exit 0 en los cinco: vitest 107 ficheros, 976 pruebas
  (4,9 s); checks.sh 294 REQ, arte OK; eslint 0 avisos; build con la landing
  en 189,6 kB / 192 kB (T79 sube el tope a 200); typecheck Done en store,
  engine y web. La tarea no cambia código.

Pendiente:
- T78 construye los props y los stills según §12; T79 el hero y el restyle
  según §5–§8 y §11; T80, T81, T82 y T83 lo que sigue.
- Las nubes procedurales del mini-planeta (`mini-planet.ts`) se regradúan en
  T79 para parecerse al fotograma 01 (vetas finas, poca opacidad).

## 2026-10-03 — T76: la carretera de la carrera (boyitas y 5 s fuera)

Qué existe:
- Al empezar una carrera en Los Rápidos aparecen boyitas a los lados del
  trazado (rojas a la derecha de la marcha, blancas a la izquierda;
  `roadMarks` en `app/mar/road.ts`, `roadMarkers` en race-props.ts,
  `Mar3D.setRoad`). Se curvan con el planeta (`curveTree(…, true)`): antes se
  veían en el cielo. Se quitan al acabar, al anularse y al cambiar de mundo.
- Fuera de la carretera (más de `ROAD_HALF_WIDTH` = 180 u del trazado, medido
  por el camino corto del planeta) sale «¡Vuelve al circuito! Te quedan n s»
  (`mar-fuera`); a los 5 s fuera la carrera se anula («te saliste»). La cuenta
  se para mientras el barco vuelve de verdad (se acerca a más de 60 u/s): sólo
  dar la vuelta gastaba ~4,5 s. Al volver se reinicia. Valores `muestra`.
- En carrera, llegar a una isla no abre su ficha ni anula la carrera (antes,
  al salirse junto a una isla, se anulaba como «panel» con el aviso en 5 s).

Comandos:
- vitest (sin packages/db) → exit 0, 107 ficheros, 976 pruebas (road.test.ts: 9).
- `pnpm typecheck`, `pnpm lint`, `sh tools/spec/checks.sh` → exit 0.
- `mar-circuito.spec.ts` contra el servidor de desarrollo (localhost:3100) →
  6 passed (móvil y escritorio), con la prueba nueva de entrar y salir.
  Una pasada anterior, con vitest a la vez, falló la carrera larga en móvil
  («sin carrera», ya inestable antes); repetida 3 veces, pasa. El piloto
  ahora dice por qué se acabó.

Pendiente:
- Las boyitas blancas de lejos se parecen a las rocas crema: quizá otro color.
- Ancho de la carretera y velocidad de vuelta, a ajustar jugando con Hernán.
- No se ha corrido `pnpm build` ni la e2e completa contra el build.

## 2026-10-02 — plan 006 T75: Island labels clear of the top bar and the models

Qué existe:
- `apps/web/app/mar/engine/labels.ts` (nuevo, sin three.js): decide cada rótulo
  de /mar. Nunca pisa los mandos (`PIN_AVOID`: barra de enlaces, minimapa,
  saldos, botones de los lados, zoom, nudos, turbo, Entradas) ni se va por
  arriba de la pantalla: si su isla está a la vista baja justo por debajo del
  mando, sobre su isla (de cerca una isla alta llega a la barra); si no, se
  apaga. Los lejanos (distancia a la cámara ÷ la del barco, 1,6 → 4) y los
  asomados al horizonte menguan a 0,72 y se atenúan a 0,62; uno que cae sobre
  la isla o el rótulo de un lugar más cercano se apaga, o, si es de lo que
  vende (`always`), se queda a 0,68 de tamaño y 0,32 de opacidad. Valores `muestra`.
- `modelLabelY`: con el GLB puesto, el rótulo va a `height` del manifiesto ×
  `islandScale` + 1,4; lo usan el rótulo, el confeti de la entrega de la
  Fiestera y lo que se ancla encima (bocadillos). Sin GLB, el `labelY` de a mano.
- Las luces de a mano (`Glows`) de una isla se apagan (color 0; se suman)
  mientras se ve su GLB y vuelven al soltarlo (`glowOffsets`, `showGlows` en
  effects.ts). El lienzo lo dice en `data-islas-sin-luces`, y en
  `data-islas-pantalla` dónde queda cada isla de Blender en pantalla.
- La vista de una isla con GLB crece hasta la cima del modelo (no se recorta antes de tiempo).
- mar.css: el rótulo escala desde su punta (`transform-origin` abajo) y su
  opacidad va en `--pin-alpha`; fuera el `scale` de entrada (desplazaba la
  posición); `.is-horizon` sin punta; `.is-behind` sin sombra.
- e2e `mar-rotulos.spec.ts`: cerca de cada isla del manifiesto, en 375×812 y
  escritorio: ningún rótulo encendido pisa la barra de enlaces ni otro mando;
  el de la isla, centrado sobre su isla y encima de su modelo (o, de cerca,
  pegado bajo el mando que tiene encima); alejando, encima de su modelo; luces
  de a mano apagadas. Con RECORD_T75=1, capturas
  `docs/informes/img/p006-t75-{allday,halloween,ultima}-{mobile,desktop}[-lejos].png`.

Comandos:
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 105 ficheros, 954 pruebas (labels.test.ts: 11).
- `sh tools/spec/checks.sh` → exit 0 (OK). `pnpm lint` → exit 0. `pnpm build` → exit 0 (189,6 kB / 192 kB). `pnpm typecheck` → exit 0.
- `E2E_PORT=3381 RECORD_T75=1 pnpm e2e mar-rotulos.spec.ts --workers=1` → exit 0, 6 passed.
- `E2E_PORT=3381 pnpm e2e mar-rotulos mar-3d mar-hud mar-islas mar-isla-modelo mar-isla-sonido mar-isla-nochevieja mar-fiestera --workers=2` → exit 0, 67 passed, 15 skipped.

Tras fusionar main (T73, Los Rápidos v3; conflictos en mar3d.ts, mar-client.tsx
y mar.css resueltos conservando lo de las dos tareas):
- vitest → exit 0, 106 ficheros, 967 pruebas. checks.sh, lint, build (189,6 kB), typecheck → exit 0.
- `E2E_PORT=3381 RECORD_T75=1 pnpm e2e mar-rotulos.spec.ts mar-circuito.spec.ts --workers=1`
  → mar-rotulos 6/6; mar-circuito, la prueba larga de la carrera falló en los dos
  proyectos («sin carrera»: el piloto de la prueba pierde la carrera). En main
  sin T75 falla igual (escritorio, 3 passed 1 failed). Repetida sola en esta
  rama: `pnpm e2e mar-circuito.spec.ts --workers=1` → exit 0, 4 passed.

Pendiente:
- mar-circuito.spec.ts (T73) es inestable: su piloto a veces pierde la carrera, también en main.
- De cerca, la Isla de Nochevieja mide 10,75 con los rayos de luz: en el móvil
  el rótulo baja bajo los saldos, sobre la torre del reloj. Si Álvaro lo quiere
  más arriba, bajar `height` en el manifiesto (Blender) o dar un alto «de rótulo» aparte.
- Los valores de lejanía y atenuación son `muestra`, a ajustar a ojo con Hernán.

## 2026-10-02 — plan 006 T73: Los Rápidos: circuit v3

Qué existe:

- **No arranca sola.** `CircuitRace.checkpoint(0)` sin carrera devuelve `{ type: 'ready' }`
  (antes lanzaba la cuenta atrás). En /mar, `ready` saca la tarjeta «Carrera en Los Rápidos»
  (`MarRaceOffer`, `data-testid="mar-carrera-oferta"`): 3 vueltas por las boias en orden,
  contra los tiempos de la tripulación y contra ti, el fantasma repite tu mejor carrera, las
  flechas impulsan y las rampas saltan; tu récord y el de la tripulación; «Ahora no» y
  «Empezar» (`mar-carrera-empezar`, lanza la cuenta atrás). Se cierra al alejarse.
- **Ranking contra otros (versión de prueba).** La tarjeta de meta añade «Con este tiempo:
  puesto n de m» (`crewPlace`) y una tabla corta con la tripulación de muestra y tu récord
  (`circuitRanking`), en `lib/mundo/ranking-circuit.ts`. El ranking compartido sigue en L2.
- **Fantasma**: el de T61, algo más opaco (0,6) para verse en carrera.
- **Trazado v3** (`CIRCUIT_VERSION = 3`: récords y fantasmas desde cero), en
  `packages/world/src/worlds/arcilla/map.ts`: 9 boias por todo el mapa (este, el paso entre
  Els Dents y las Rocas del Freu, norte, centro bajo la Isla del Sonido, oeste junto al
  acantilado, sur hacia El Varadero y entre la Cala y Halloween), lejos del radio de
  proximidad de las islas en /mar. Medallas 60/74/98 s (el piloto recto hace ~66 s, plata).
- **Más obstáculos**: 5 rocas y 3 medusas nuevas a un lado de los tramos
  (`circuito-roca-N`, `circuito-medusa-N`), además de los de T61 (el cocodrilo cruza el
  tramo 3→4).
- **Rampas de salto** (`circuito-rampa-1..3`, categoría `rampa`): impulso flojo + `params.jump`.
  Motor: `packages/engine/src/circuit/jump.ts` (`BoatJump`, `rampsOf`, `jumpOf`): despegue,
  parábola, cabeceo y chapuzón. `Mar3D` lanza el salto con el efecto `boost` de una rampa,
  levanta el barco, quita la estela en el aire y al caer salpica (`data-salto`,
  `data-chapuzones` en el lienzo; `onJump` suena). Plataforma con flechas amarillas hacia
  arriba en `race-props.ts` (`jumpRamp`).
- **Impulsos y rampas entre dos boias** apuntando a la siguiente: se calculan desde el tramo
  (`onLeg`, `towardNext`).
- El minimapa destaca la boia que toca (🎯) durante la carrera.
- Recalibrado con el trazado: `SAMPLE_CIRCUIT_MS` (69,4/82,2/106,8 s) y `FAST_LAP_MS`
  (73,4 s, «Rayo de Los Rápidos»; sólo el umbral, no el premio).

Comandos:

- `PYTHONUTF8=1 pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0 (105 archivos, 956 pruebas)
- `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0; `pnpm typecheck` → exit 0
- `E2E_PORT=3391 pnpm e2e mar-circuito.spec.ts --workers=1` → exit 0 (4 passed: móvil y escritorio)
- `mar-3d.spec.ts` y `mar-botellas.spec.ts` (workers=2) → 28 passed, 2 por tiempo bajo carga; repetidas
  con workers=1 → 2 passed

Pendiente:

- Posiciones, medallas, tiempos de muestra y saltos son `muestra` (Álvaro).
- `lib/mundo/circuit-hud.tsx` (`useCircuit`, el HUD del 2D) ya no se usa; con T73 no arranca
  carreras (no hay 2D).

## 2026-10-02 — plan 006 T71: Isla de Nochevieja model

Qué existe:

- **Isla de Nochevieja** (`tools/blender/islas/ultima.py` →
  `art/islas/3d/ultima.glb`, 29 856 triángulos de 30 000, 31 materiales,
  946 kB; salida determinista, mismo md5 en dos corridas). Es el lugar `ultima`, donde se
  entrega la Boia Fiestera. Isla de roca fría con la meseta nevada y, detrás
  (el frente queda libre para la explanada), una montaña en punta con la cima
  de nieve y cantos. Arriba, la torre del reloj de las campanadas (esfera que
  brilla, doce marcas, agujas a las doce menos uno, campanas) con la bola
  dorada; desde ella diez rayos de luces de fiesta en cuatro colores hacia
  todas partes (alguno baja hacia el mar) y otros cuatro desde focos de la
  explanada. Doce tiendas de campaña (canadienses e iglú) con la puerta
  encendida de noche, seis pinos nevados y ventisqueros. Siete boias de BOIA
  (`mascota.py`) bailando: ladeadas, brazos en V con guantes, pompón y tres
  con bengala. Delante: el escenario redondo de la Fiestera con arco de
  bombillas y bola de espejos, camino de farolillos con guirnalda desde el
  muelle, el cuenco de las doce uvas, un racimo gigante, la botella de cava
  descorchándose en su cubitera (tapón y espuma), una torre de seis copas,
  confeti por el suelo y en el aire, serpentinas y tres fuegos artificiales
  con su estela y el cohete en el suelo.
- Para caber en el presupuesto con siete boias, `ultima.py` envuelve el
  Builder en `Menos` (aún menos segmentos por pieza, sólo para sus boias) y
  rebaja las tiras de `mascota.patch` mientras las construye; las uvas son
  esferas de pocas caras con sombreado suave. No toca `comun.py` ni
  `mascota.py`.
- `art/islas/3d/manifest.json`: sólo se añade la entrada `ultima`.
- e2e `apps/web/e2e/mar-isla-nochevieja.spec.ts`: el destino de la misión del
  mundo tiene modelo en el manifiesto con el nombre del lugar; cerca de él se
  pide el GLB (200) y el lienzo dice `ultima:glb`; en escritorio, rescatar a
  la Fiestera y dejarla allí con el modelo puesto (misión `delivered`, aviso
  de la i18n, ficha del código, el modelo sigue). Con `RECORD_T71=1` deja
  `docs/informes/img/p006-t71-isla-nochevieja.png`, `-noche.png` y
  `p006-t71-entrega-fiestera.png`.

Comandos:

- `blender -b -P tools/blender/export_islas_glb.py -- --only ultima` → exit 0
  (29 856 triángulos, 31 materiales, 946 kB)
- `python3 tools/blender/check.py` → exit 0 (islas/3d 2)
- `vitest run --exclude '**/packages/db/**'` → exit 0, 943 pasan
- `sh tools/spec/checks.sh` → OK; `pnpm lint` → exit 0; `pnpm build` → exit 0;
  `pnpm typecheck` → exit 0
- `RECORD_T71=1 E2E_PORT=3381 pnpm e2e e2e/mar-isla-nochevieja.spec.ts
  e2e/mar-fiestera.spec.ts --workers=1` → 16 pasan, 2 omitidas (las de sólo
  escritorio en móvil); antes, con `mar-isla-modelo.spec.ts` también: 20
  pasan, 4 omitidas.

Pendiente:

- La isla usa 31 materiales (31 llamadas de dibujo cerca de ella; la de
  Halloween, 25). Si el móvil lo nota, se pueden juntar más colores.
- El rótulo de /mar y el confeti de la entrega siguen saliendo de la
  composición a mano (`labelY`); con el modelo, el rótulo queda a la altura
  de la torre del reloj.
- Todo es `muestra` hasta el visto bueno de Álvaro.

## 2026-10-02 — plan 006 T70: Isla del Sonido model

Qué existe:

- **Isla del Sonido** (`tools/blender/islas/allday.py` → `art/islas/3d/allday.glb`,
  29 156 triángulos de 30 000, 26 materiales, 4 emisivos, 868 kB; salida
  determinista, mismo md5 en dos corridas), con el pipeline de T69 sin
  tocarlo: arena con meseta de hierba; al fondo, mirando al puerto, el sound
  system de rave: dos muros de altavoces apilados (3 columnas × 5 filas:
  graves con un cono grande, medios con dos, agudos con cono y bocina) algo
  girados hacia la pista, con una tira naranja de BOIA y balizas encima, y
  dos columnas sueltas a los lados; entre los muros, la cabina del DJ (tiras
  de LED cian y magenta, «BOIA» en letras de bloques naranjas, dos platos y
  mesa de mezclas). Encima, un pórtico de celosía de aluminio con seis focos
  colgados apuntando a la pista y un láser con un abanico de siete rayos
  (verde y magenta). Delante, la pista redonda con aro de luz y círculos de
  color; encima, cinco boias de BOIA bailando (la mascota de `mascota.py`
  con brazos y guantes, ladeadas, dos saltando, tres con gafas de sol, una
  cantando) y la boia DJ con cascos detrás de la cabina. Palmeras, cantos y
  el muelle con balizas de colores. Focos, láser, LED, pista y balizas
  brillan de noche.
- Las piezas de esta isla (cajas de aristas vivas, conos, muros, celosía,
  focos, palmeras de hojas en tira, boia bailando con `gafas_sol` y
  `auriculares`) viven en `islas/allday.py`; `islas/comun.py` no cambia.
- `art/islas/3d/manifest.json`: sólo la entrada `allday` nueva (la escribe el
  exportador, ordenada por id, antes de `halloween`). /mar la carga sin
  cambios de código.
- E2E `apps/web/e2e/mar-isla-sonido.spec.ts`: con `?cerca=allday` el lienzo
  dice `allday:glb`, el GLB responde 200 una vez, el pin de la isla está y no
  hay errores; con `RECORD_T70=1` (escritorio) deja
  `docs/informes/img/p006-t70-isla-sonido.png` y `…-noche.png` (un paso de
  «Alejar» para que quepa el sound system entero).

Comandos:

- `blender -b -P tools/blender/export_islas_glb.py -- --only allday` → exit 0
  (`[glb] allday.glb: 29156 triángulos, 26 materiales, 868 kB`).
- `python3 tools/blender/check.py` → exit 0 (`islas/3d: allday: 29156/30000
  triángulos, 26 materiales (4 emisivos), 868 kB`; 60 manifiestos válidos).
- `pnpm exec vitest run --exclude '**/packages/db/**'` → exit 0 (104 archivos,
  943 pruebas); `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0;
  `pnpm build` → exit 0; `pnpm typecheck` → exit 0.
- `E2E_PORT=3371 pnpm e2e mar-isla-sonido.spec.ts mar-isla-modelo.spec.ts
  --workers=1` → exit 0 (6 pasan, 4 saltadas: las de captura sin RECORD).

Pendiente:

- Todo es `muestra`: el visto bueno del aspecto es de Álvaro.
- El modelo va justo de presupuesto (844 triángulos libres): una boia más no
  cabe sin quitar algo (cada boia cuesta ~3 000).

## 2026-10-02 — plan 006 T69: Island models from Blender, starting with the Isla de Halloween

Qué existe:

- **Pipeline de islas de Blender** (`tools/blender/export_islas_glb.py`): cada
  isla es un módulo `tools/blender/islas/<id>.py` (id del lugar) con `ID`,
  `LABEL`, `DOC`, `RADIUS`, `DETAIL`, `ROLES`, `GLOW` y `build(B, K)`; piezas
  comunes en `islas/comun.py` (Builder «ligero» de los mundos con menos
  segmentos, terreno, cantos, muelle, superficie de calabaza con gajos,
  láminas pegadas a una superficie, boias disfrazadas con la mascota de
  `mascota.py`, murciélagos). Colores planos por papel (tema de arcilla +
  papeles de la isla) y papeles emisivos. Todo se junta en una malla (25
  materiales = 25 llamadas de dibujo) y la isla tiene que caber en
  `MAX_TRIS` = 30 000 (sale con 1 si no). `--preview <dir>` deja PNG de día
  y de noche fuera del repo; `--detalle`, triángulos por material. Salida
  determinista (mismo md5 en dos corridas).
- **Isla de Halloween** (`islas/halloween.py` → `art/islas/3d/halloween.glb`,
  29 842 triángulos, 791 kB): roca morada con cima de hierba oscura; en el
  centro el club, una calabaza grande con cara de enfado (ojos rasgados,
  cejas fruncidas, nariz y boca de dientes que hace de puerta, con escalones)
  que brilla de noche, rabo con zarcillo, altavoces y murciélagos; lápidas,
  árboles secos, calabacitas encendidas por el camino y muelle; en el agua,
  seis boias con la mascota de BOIA disfrazadas (dos brujas con sombrero y
  escoba, dos fantasmas con sábana y bracitos, dos Frankenstein con pelo
  plano, cicatriz y tornillos), mirando hacia fuera y hacia el puerto.
- **Manifiesto y validación**: `art/islas/3d/manifest.json` (id, file,
  label, radius, top, height, tris, kb, doc; `max_tris`), esquema
  `tools/blender/isla3d.schema.json`; `tools/blender/check.py` →
  `check_islas_3d`: esquema, un GLB por módulo y ninguno de más, una sola
  malla, triángulos leídos del GLB = manifiesto ≤ `MAX_TRIS`.
- **/mar** (`apps/web/app/mar/engine/island-models.ts`, `mar3d.ts`): cada
  isla del mapa va en un hueco con su composición a mano dentro; las que el
  manifiesto lista piden su GLB por distancia (`ISLAND_MODEL_TUNING`: 2200 /
  3200 u, más lejos que las boias) con el mismo `ModelStore` (ahora genérico
  en clave y URL), lo escalan al radio del lugar, lo curvan con el planeta y
  suben el brillo de lo emisivo de noche (`islandGlow`). Lejos, mientras
  llega o si falla, la de a mano. El lienzo dice `data-islas-modelo`
  («halloween:procedural|cargando|glb|error»). Añadir una isla no toca /mar.
- Docs: README «Islas de Blender en el mar 3D» (cómo añadir una: T70, T71) y
  una línea en `docs/TRASPASO.md`. Capturas:
  `docs/informes/img/p006-t69-isla-halloween.png`, `-noche.png` y
  `-sin-glb.png` (la de a mano).

Comandos:

- `blender.exe -b -P tools/blender/export_islas_glb.py -- --only halloween` → exit 0 (29 842 triángulos, 25 materiales, 791 kB; GLB y manifiesto en art/islas/3d/)
- `python3 tools/blender/check.py` → exit 0 (60 manifiestos; islas/3d: halloween 29 842/30 000, 2 emisivos)
- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0 (102 files, 931 tests passed; nuevo `island-models.test.ts`)
- `sh tools/spec/checks.sh` → exit 0 · `pnpm lint` → exit 0 · `pnpm build` → exit 0 (landing 189,6 kB de 192 kB) · `pnpm typecheck` → exit 0
- `E2E_PORT=3351 RECORD_T69=1 pnpm e2e e2e/mar-isla-modelo.spec.ts --workers=1` → exit 0, 5 passed, 1 skipped (captura de noche en móvil)
- `E2E_PORT=3351 pnpm e2e e2e/mar-isla-modelo.spec.ts e2e/mar-islas.spec.ts e2e/mar-3d.spec.ts e2e/mar-paridad.spec.ts --workers=2` → exit 0, 48 passed, 2 skipped

Pendiente:

- T70 (Isla del Sonido) y T71 (Isla de Nochevieja): un módulo cada una en
  `tools/blender/islas/` y `--only <id>`; el presupuesto es por isla.
- Los resplandores de la isla a mano (antorchas y cara de la calabaza) se
  quedan también con el GLB: caen cerca del club y de la cara, pero no
  exactos. Si molestan, el manifiesto podría traer sus propios puntos de luz.
- Las boias disfrazadas del GLB no se balancean (son parte de la malla).
- El GLB pesa 791 kB (sin Draco: el cargador de /mar no lo lleva).

## 2026-10-02 — plan 006 T72: Economy rebalance and bottle cap

Qué existe:

- **Economía más rápida** (decisión de Hernán y Álvaro del 2026-10-02), todo
  `muestra`. Con unos 10 minutos de juego normal (6 restos, un cofre, 4
  islas, 3 boies, una partida al faro, el Carnet y 10 minutos a bordo) salen
  715 puntos y 245 monedas: dan el barco del Carnet, el de puntos y el de
  monedas, y una skin. Lo prueba `apps/web/lib/mundo/economy.test.ts` con el
  repositorio local, los premios del mapa, un minijuego jugado entero y el
  catálogo de logros (sin cifras escritas a mano).
- **Barcos y tienda** (`packages/store/src/sample/progress.ts`): Cartoon años
  30, 120 monedas (antes 400, `CARTOON_SHIP_PRICE`); Semi-realista, umbral de
  600 puntos (antes 1500, `VETERAN_POINTS`); skins, 50 (antes 150,
  `SKIN_PRICE`); bandera 20, estela 30, farolillo 25.
- **Carnet BOIA**: el logro `carnet` da 300 puntos y el barco **Low-poly**
  (`CARNET_SHIP`, deja de venderse) y llega al crearlo, sin «Reclamar»:
  `grantCarnetReward` / `emitCarnetReward` en `apps/web/lib/mundo/achievements.ts`,
  llamado desde `saveCarnet`. También lo recibe quien tenía el logro
  completado sin reclamar, al guardar su Carnet.
- **Logros**: más puntos y monedas en todos menos `entrada` y `entradas-3`
  (cifras en `docs/propuestas/logros-catalogo.md`, sección nueva «Economía
  más rápida»); `islas-7` pide ahora las 8 islas (el id no cambia).
- **Mar vivo** (`packages/world/src/worlds/arcilla/map.ts`): cada resto
  flotante da 10 monedas (`RESTOS_COINS`), el Cofre fugaz 40 monedas y 20
  puntos (`COFRE_COINS`, `COFRE_POINTS`), una vez por visita; islas 15–30
  puntos; secretos, náufrago, delfín (25) y remolino (5/10/15) dan más.
- **Arreglo**: los premios «por visita» (restos y cofres) usaban la clave
  `…@visita:…`, que el repositorio rechaza (`isStableKey`); en /mar no daban
  nada. Ahora `…:visita:…` (`world-progress.ts`).
- **Minijuegos** (versión 3 de `FARO_DEFAULTS` y `CANON_DEFAULTS`): 3
  oleadas, intrusos más rápidos, marca para ganar 250 (faro) y 200 (cañón),
  premio 150 puntos y 50 monedas (faro una vez al día, cañón una vez por
  temporada). Una partida con el bot experto dura unos 40 s.
- **Botellas** (`packages/store/src/local.ts`, `BOTTLES_IN_SEA_MAX = 10` en
  `@boia/contracts`): echar otra sustituye a la tuya (la anterior queda
  retirada); con 10 en el mar (las de muestra cuentan), la nueva retira la
  más antigua; `list()` enseña como mucho las 10 más nuevas. En la hoja «Tu
  botella», un botón «Echar otra» (`botella-echar-otra`) con el aviso de que
  sustituye a la tuya.

Comandos:

- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` →
  exit 0, 103 archivos, 934 pruebas.
- `sh tools/spec/checks.sh` → exit 0. `pnpm lint` → exit 0. `pnpm build` →
  exit 0. `pnpm typecheck` → exit 0.
- `E2E_PORT=3361 pnpm e2e mar-carnet-barco.spec.ts mar-botellas.spec.ts
  minijuegos.spec.ts --workers=1` → 12 passed.
- `E2E_PORT=3361 pnpm e2e tienda logros tickets carnet carnet-descuento
  mar-a-bordo demo mar-fiestera --workers=2` → 50 passed.

Pendiente:

- Los rangos (`SAMPLE_RANKS`: Capitana a 600 puntos) no se han tocado: con la
  economía nueva se llega al rango más alto en unos 10 minutos.
- La misión de la Fiestera sigue dando 100 puntos y 100 monedas
  [pendiente Álvaro].
- La regla de botellas está sólo en el repositorio del navegador; la versión
  final (Supabase) tendrá que sustituir y recortar igual.
- `bottle.conflict` ya no sale desde «Echar al mar» (la segunda sustituye);
  el texto se queda por si el repositorio lo devuelve.

## 2026-10-02 — plan 006 T67: Island names, the Halloween place and the three ticket events

Qué existe:

- **Nombres de Arcilla** (decisión de Hernán y Álvaro del 2026-10-02), como
  nombres comunes del mapa compartido (`packages/world/src/worlds/arcilla/map.ts`):
  `cala` Cala Cantalar, `fotos` Isla de Benidorm, `tienda` Ibiza, `faro`
  Tabarca, `canon` L'Illeta dels Banyets, `allday` Isla del Sonido, `ultima`
  Isla de Nochevieja. El Varadero, El náufrago y El Remanso de los Cocodrilos
  siguen igual. El circuito se llama **Los Rápidos** (Arcilla; salida y meta
  «de Los Rápidos»); el id (`el-freu`) no cambia, así no se pierden récords ni
  logros. Acuarela conserva sus nombres salvo las tres islas con entradas.
- **Isla de Halloween** (`halloween`, `HALLOWEEN_PLACE_ID`): isla nueva en mar
  libre del centro (`HALLOWEEN_CENTER` [-1,0; 1,5] u_maq: a más de 7,9 u_maq de
  cualquier otra isla, sin empujones al compactar), con colisión, proximidad,
  primera llegada, 10 puntos, CONTENIDO `event` y TICKET de BOIA Halloween.
  En el arte 2D lleva un marcador a propósito (`PLACE_MARKERS`,
  `placeholder:isla`, world:check la da por buena); en /mar una composición
  provisional (`islands.ts` → `halloween`: roca oscura, calabaza con la cara
  encendida, árboles secos, antorchas) hasta el modelo de T69. Es parada de la
  ruta de marcas (`ROUTE_STOPS`, entre el remanso y la Isla del Sonido) y
  tiene su icono 🎃 en el rótulo.
- **Tres eventos con entradas** (`packages/store/src/sample/content.ts`), cada
  uno en su isla (`TICKET_EVENT_ISLANDS` en store y `TICKET_ISLAND_EVENTS` en
  world, comprobados entre sí): BOIA Halloween en el Kiki García, sábado
  31/10/2026 → `halloween` (id `halloween-2026`, se mantiene); SONIDO, sábado
  05/12/2026 → `allday` (`sonido-2026`, All Day); BOIA Nochevieja, jueves
  31/12/2026 → `ultima` (`nochevieja-2026`). Horas, precios (`priceSample`),
  descripciones y enlaces son `muestra`. Los de antes (All Day de primavera y
  de verano, Noche de mayo) ya no están; quedan el borrador y el finalizado
  (archivo y fotos). El destacado de la home es BOIA Halloween; los códigos
  del náufrago y del ánfora pasan a SONIDO y a BOIA Nochevieja.
- **Isla de Nochevieja**: además de destino de la Fiestera, vende BOIA
  Nochevieja; en /mar la ficha del evento ya no tapa la del código de la
  Fiestera al entregarla (`mar-client.tsx`, `content_open`). Textos de misión,
  tutorial, Fiestera, taglines, logro «Hasta el amanecer», catálogo de logros
  y `shop.lockedMission` dicen «Isla de Nochevieja».
- Textos: `docs/propuestas/textos-zonas.md` (y `es-zonas.ts` regenerado),
  `docs/propuestas/logros-catalogo.md`, `es-juego.ts`, `es-mar.ts`,
  `es-lib-web.ts`; `docs/spec/estado.md` (REQ-AVE-005 y 008 con el título
  nuevo de su prueba).
- Pruebas nuevas: `apps/web/lib/mundo/islas-entradas.test.ts` (nombres de
  Arcilla, Halloween en los dos mundos, exactamente tres a la venta con su
  isla y su fecha, en la landing y en «Elige tu evento»), casos nuevos en
  `arcilla.test.ts` y `acuarela.test.ts`, y `apps/web/e2e/mar-islas.spec.ts`
  («Entradas» con los tres; `?ir=halloween`); `mar-fiestera.spec.ts` comprueba
  el aviso «¡Fiesta en la Isla de Nochevieja!».

Comandos:

- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0 (101 files, 921 tests passed)
- `sh tools/spec/checks.sh` → exit 0 (294 REQ; estado OK; art OK)
- `pnpm lint` → exit 0 · `pnpm build` → exit 0 (landing 178,1 kB de 192 kB) · `pnpm typecheck` → exit 0
- `pnpm world:check` → exit 0 (78 lugares por mundo, 0 sin skin; `halloween` marcador)
- `E2E_PORT=3311 pnpm e2e mar-islas.spec.ts mar-fiestera.spec.ts eventos.spec.ts tickets.spec.ts demo.spec.ts --workers=1` → exit 0, 36 passed, 6 skipped (record)
- `E2E_PORT=3311 pnpm e2e --workers=1` → 230 passed, 31 skipped, 5 failed: `mar-3d` minimapa (esperaba un solo acento; ahora son las tres islas con entradas: prueba corregida) y 3 por carga (mar-botellas, mar-hud avisos, mar-paridad «Saltar», de 2 a 3 min con T68 en paralelo). Repetidas: `E2E_PORT=3311 pnpm e2e mar-3d.spec.ts mar-botellas.spec.ts mar-hud.spec.ts mar-paridad.spec.ts --workers=1` → exit 0, 56 passed

Pendiente:

- T69 modela la Isla de Halloween en Blender (hoy marcador 2D y composición
  provisional en /mar); T70 y T71, la del Sonido y la de Nochevieja.
- El logro `islas-7` («Cartógrafa») sigue pidiendo 7 islas; con Halloween el
  mapa tiene 8 (su descripción dice ahora «Descubre 7 islas del mapa.»). T72
  puede subirlo si quiere que sean todas.
- Horas, precios y descripciones de los tres eventos, pendientes de Álvaro.
- Los nombres de tests y comentarios del circuito («El Freu») en
  `mar-circuito.spec.ts` y el HUD de carrera los toca T73.

Después de mezclar main (T68 bienvenida corta y ayuda «?», T74 tipografías):
conflictos en `es-juego.ts` (se quedan fuera las claves `juego.welcome.*`
que quitó T68; se conservan los textos de Isla de Nochevieja, Los Rápidos e
Isla de Benidorm de T67) y `docs/spec/estado.md` (versión de main con las
filas REQ-AVE-005 y 008 de T67).

- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0 (101 files, 922 tests)
- `sh tools/spec/checks.sh` → exit 0 · `pnpm lint` → exit 0 · `pnpm typecheck` → exit 0 · `pnpm build` → exit 0 (landing 189,6 kB de 192 kB) · `pnpm world:check` → exit 0
- `E2E_PORT=3311 pnpm e2e --workers=1` → 258 passed, 39 skipped, 1 failed (`mar-circuito` en escritorio, «sin carrera» del piloto; en móvil pasó). Repetida: `E2E_PORT=3311 pnpm e2e mar-circuito.spec.ts --workers=1` → exit 0, 4 passed

## 2026-10-02 — plan 006 T74: Site font: Druk-Wide-like titles and Inter

Qué existe:

- `apps/web/lib/fonts.ts`: el único sitio que define las tipografías
  (`next/font/local`), aplicadas en el `<html>` del layout raíz:
  `fuenteTitulo` → `--font-display` (títulos) y `fuenteTexto` → `--font-text`
  (texto). `globals.css` deriva `--font-title` y `--font-body`; `h1`–`h3` de
  toda la web van con `--font-title`, `body` con `--font-body`.
- Títulos: Archivo en su anchura máxima (wdth 125, peso 700; «Archivo
  Expanded Bold»), SIL OFL, la libre más parecida a Druk Wide Medium entre
  Archivo, Unbounded y Anybody (comparativa en
  `docs/informes/img/p006-t74-comparativa.png`: Unbounded tiene la «a» de un
  piso y remates redondos; Anybody 150 es más ancha que Druk). Instancia
  estática, subconjunto latino woff2, 11,5 kB:
  `apps/web/public/fonts/titulo-latin.woff2` + `OFL-archivo.txt`. Se precarga.
- Texto: Inter variable (peso 400–900, opsz 14), subconjunto latino woff2,
  32,4 kB: `apps/web/public/fonts/inter-latin.woff2` + `OFL-inter.txt`. No se
  precarga (no cabe en los 192 kB): `swap` sobre un respaldo con métricas
  ajustadas por next/font.
- Titan One (T50) y su licencia, borradas; `(landing)/layout.tsx` y
  `admin.css` ya no definen fuentes.
- Pilas `system-ui` sustituidas por `var(--font-body)` en `mar.css`,
  `landing.css` (portada de la entrada), `hud.css`, `carnet.css`,
  `carnet-invite.css`, `checkout.css` y los minijuegos
  (`packages/engine/src/minigames/styles.ts`, con respaldo; su `h3` con la
  display).
- `tools/fonts/subset.py`: rehace los dos woff2 desde las fuentes oficiales
  (fonttools + brotli); `titulo <fuente>` sirve para Druk.
- `scripts/landing-budget.mjs` cuenta también las fuentes precargadas (`.p.`)
  que nombran las hojas de la ruta: next/font no emite su `<link
rel=preload>` en Windows (su plugin busca la ruta del cargador con «/»), así
  que antes el total de Windows no las contaba y el de Vercel sí.
- README, «Tipografías»: cómo está montado y cómo pasar a Druk Wide Medium.
  DECISIONES, nota en P20.
- `apps/web/e2e/tipografia.spec.ts` (móvil y escritorio): familia calculada
  del h1 de la landing, del h2 de una hoja de /mar («Elige tu evento») y del
  texto contra `--font-display`/`--font-text`, las dos cargadas en
  `document.fonts`, y ningún h1–h3 desbordado en landing, /mar, evento,
  fotos, artistas, legal, carnet y admin. `RECORD_T74=1` deja
  `docs/informes/img/p006-t74-*.png`.

Comandos:

- `pnpm exec vitest run --exclude '**/packages/db/**'` → exit 0, 100 archivos, 914 pruebas.
- `sh tools/spec/checks.sh` → exit 0.
- `pnpm lint` → exit 0. `pnpm typecheck` → exit 0.
- `pnpm build` → exit 0; landing 189,8 kB de 192 kB (13 archivos, la
  display incluida, 11,5 kB).
- `RECORD_T74=1 E2E_PORT=3341 pnpm e2e tipografia.spec.ts --workers=1` → exit 0, 16 pasan.
- Regresión: `E2E_PORT=3341 pnpm e2e landing accesos eventos carnet admin
mar-hud mar-entradas mar-ayuda intro logros minijuegos tickets descuentos
tipografia --workers=2` → 118 pasan, 25 omitidas, 11 fallan por tiempo
  (con otro agente en paralelo: pruebas de 2–5 min); las 11 otra vez con
  `--workers=1` → exit 0, 20 pasan, 2 omitidas.

Pendiente:

- Licencia web de Druk Wide Medium (Álvaro, P20); el cambio es el del README.
- Margen de la landing: 2,2 kB. Inter no se precarga por eso.
- El texto pintado en canvas (rótulos de islas y globo del motor 3D,
  marcadores de Faro y Cañón) sigue con `system-ui`: no es CSS.

## 2026-10-02 — plan 006 T68: Welcome sheet, help instead of guidance, top links, minimap centring

Qué existe:

- **Welcome Aboard corta** (`app/mar/a-bordo.tsx`, `lib/mundo/menu/sections/welcome.tsx`):
  la boia de la entrada junto a «BIENVENIDO A BOIA.PLANET» en negrita, la
  frase (sin negrita), «Objetivo: Encuentra la BOIA y llévala a la Isla de
  Nochevieja.», los dos primeros consejos (`WELCOME_TIPS`) y dos botones
  pegados abajo: «A navegar» (grande, naranja, cierra) y «Comprar entradas»,
  que abre «Elige tu evento» dentro del mar (`onTickets` → `openEntradas`).
  Claves `mar.bienvenida.{titulo,texto,objetivo,aNavegar,comprar}`; fuera
  `mar.bienvenida.{boia,entradas}` y `juego.welcome.*`.
- **Nada guía solo**: fuera el chip de las boies informativas (`buoyGuide`,
  `MarGuideChip`), el chip «Lleva a la Fiestera a…» de la misión a bordo y el
  mensaje centrado de la primera vez («Toca y arrastra…», `.mar-help`,
  `boia:mar3d:ayuda`). El delfín sigue igual.
- **El «?» de ayuda** (`mar-ayuda-abrir`, bajo el botón del menú): una
  tarjetita (`MarAyuda` en `app/mar/guia.tsx`) con el objetivo según el paso
  de la misión y una pista (el código o minijuego pendiente más cercano al
  barco), cada uno con su «Rumbo a…» (fija el rumbo y la cierra).
  `helpNow` en `lib/mundo/guide.ts`. Claves `mar.ayuda.*`.
- **Enlaces de arriba**: Fotos, Shop, Artistas, Contacto, Carnet.
- **Minimapa centrado como el mapa grande** (`engine/globe.ts`): las islas,
  el barco, la ruta, los «?» y el rumbo se proyectan sin el giro del cielo
  (antes lo corría hacia el este y, al rato, se veía desplazado a la
  derecha); el giro sólo mueve los meridianos. `drawGlobe` devuelve dónde
  pintó el centro del planeta y el lienzo lo expone en `data-centro`.
- `docs/spec/estado.md`: notas de REQ-IDE-035 y REQ-PRO-009 con la prueba nueva.

Comandos:

- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 100 archivos, 914 pruebas.
- `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0; `pnpm typecheck` → exit 0.
- `E2E_PORT=3321 pnpm e2e mar-ayuda.spec.ts --workers=1` → 8 passed, 8 skipped (cada vista en su proyecto).
- `E2E_PORT=3321 pnpm e2e mar-hud mar-fiestera intro mar-a-bordo logros mar-3d demo mar-entradas --workers=2` → 112 passed, 10 skipped, 0 failed.

Pendiente:

- Textos `muestra` de la ayuda (`mar.ayuda.*`) a revisar con Álvaro.
- La cabecera de la hoja sigue diciendo «⚓ Welcome Aboard» (nombre de la sección del menú).
- `params.guide` de las boies informativas ya no se usa en el mar (dato de `packages/world`).

## 2026-10-02 — plan 005 T66: Un Carnet que vale la pena

Qué existe:

- **-10 % por tener Carnet BOIA** (`muestra`): `SAMPLE_CARNET_DISCOUNT` en
  `packages/store/src/sample/content.ts`, con la forma de un descuento de
  entradas (id `carnet`). No está en `discounts` (no se esconde ni sale en el
  mapa). El repositorio lo da con `repo.content.carnetDiscount()` (también en
  `SampleInput.carnetDiscount`): ahí lo podrá editar el Admin (T63).
- **El mejor descuento, sin sumarse** (`apps/web/lib/ticketing/pricing.ts`,
  `bestDiscount`): entre el código del mundo que vale (prioridad y ahorro,
  como antes, así FIESTERA20 sigue mandando entre códigos) y el del Carnet,
  va el que más ahorra; a igual ahorro, el del Carnet (el código, que vale
  una vez, queda para otra compra). `AppliedDiscount.kind` (`code`/`carnet`);
  `Quote.skipped` (el que no se aplica) y `Quote.carnetOffer` (sin Carnet, lo
  que ahorraría si fuera el mejor). El sandbox lee Carnet y descuento al
  preparar la compra; sólo un código se gasta en el repositorio; el del
  Carnet queda en el importe. `purchase_confirmed` lleva `discountId` y el
  nuevo `discountKind` (`@boia/contracts/analytics`).
- **Checkout**: sin Carnet, si el Carnet ahorraría más que lo que ya hay,
  antes de comprar sale «¿Tienes Carnet BOIA? Créalo en 30 s y ahorra un
  10 %» con «Crear Carnet» y «Seguir sin Carnet» (no hay «Confirmar» hasta
  elegir). En la landing, «Crear Carnet» es un alta rápida con el
  apodo dentro del mismo checkout (`saveCarnet`, con su logro) y la compra se
  vuelve a preparar con el 10 %. En /mar (`onCreateCarnet`) abre Mi Carnet del
  mundo (T55) ya en el alta y, al crearlo, vuelve al checkout del mismo
  evento (`MarABordo.carnetCreate`/`onCarnetCreated`, `CarnetPanel.onCreated`).
  La línea del descuento dice cuál es (`data-kind`) y, si había los dos,
  «Los descuentos no se suman…». El aviso de la isla y del panel de entradas
  enseña el del Carnet cuando es el que se aplicará (`discount-banner`).
- **Carnets de artistas**: `artista-<id>` construido desde la ficha del
  artista (nombre, foto si hay, géneros, sus eventos como sellos, «miembro
  desde» su primer evento o `ARTIST_CARNET_SINCE`; sin respuestas). Abre en
  `/carnet/artista-<id>`, se puede reportar, no entra en el ranking y nadie
  puede usar el nombre de un artista como apodo. `repo.carnet.members()`:
  miembros de muestra y artistas, nunca el propio.
- **Ranking**: la fila propia ya llevaba el apodo; «🔎 Descubrir a un BOIERO»
  (`RankingPanel`, `lib/mundo/discover.ts`) enseña ahí mismo el Carnet de uno
  al azar (sin repetir el que se ve), con «Ver su Carnet entero». Las e2e fijan
  el azar con `window.__boiaDiscoverSeed` (mulberry32).
- i18n: `ticketing.carnet.*` (es-lib-web.ts), `lib.ranking.descubrir*`,
  `lib.carnet.*` (es-lib.ts).
- Specs que compraban sin Carnet ahora pulsan «Seguir sin Carnet» (tickets,
  landing, intro, mar-entradas, mar-hud). `record-demo.spec.ts` lo borró T62.
- `docs/spec/estado.md`: REQ-COM-020, REQ-COM-036, REQ-IDE-017 y REQ-IDE-053
  enlazan las pruebas nuevas.

Comandos (sobre main con T62, /juego ya borrado):

- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0, 100 archivos,
  908 pruebas (nuevas: `carnet-discount.test.ts`, `discover.test.ts`, `carnet-members.test.ts`,
  42 pruebas entre las tres y ticketing).
- `sh tools/spec/checks.sh` → exit 0 · `pnpm lint` → exit 0 · `pnpm build` → exit 0 (landing
  178,1/192 kB) · `pnpm typecheck` → exit 0.
- `E2E_PORT=3231 pnpm e2e e2e/carnet-descuento.spec.ts e2e/mar-3d.spec.ts --workers=1` → exit 0,
  32 pasan.
- Specs relacionados (tickets, landing, intro, mar-entradas, mar-hud, mar-fiestera, descuentos,
  mar-botellas, carnet, mar-a-bordo, solo-3d, comunidad, accesos, mar-paridad, demo)
  con `--workers=1` → exit 0, 135 pasan, 1 se salta.

Pendiente:

- El 10 %, sus textos y que los artistas tengan Carnet: `muestra`, pendientes
  de Álvaro. El Admin todavía no edita el descuento del Carnet (T63).
- La landing no tiene ranking: «Descubrir a un BOIERO» está en el ranking de
  /mar.

## 2026-10-02 — plan 005 T65: Game HUD v2 (enlaces arriba, menú a la izquierda, minimapa)

Qué existe:

- HUD de `/mar` según la decisión del 2026-10-02, que sustituye la barra de T53:
  - Arriba, `mar-enlaces`: Fotos (`/#fotos`), Contacto (`/#contacto`), Artistas
    (`/#artistas`), Carnet y Shop (`/#tienda`). Los enlaces son `<a>` normales (carga
    completa: con ancla la landing entra directa, D-21). Carnet no sale del juego: abre
    el menú del juego en Mi Carnet. Debajo, el minimapa y los saldos.
  - A la izquierda, bajo el minimapa, el botón del menú del juego con el icono 🏆 y el
    número de premios por reclamar (`data-testid="mar-logros"`, se queda el de antes).
  - Abajo sólo «Entradas» (centro, destacada) y el turbo (`mar-barra` con dos botones);
    se van Mapa (el minimapa abre el mapa), Logros, Carnet y Menú de la barra.
- Menú del juego (`app/mar/menu.tsx`, `MarMenu`): una hoja crema (`MarHoja`) con
  Logros, Mi Carnet, Barco, Mis códigos, Mi botella, Ranking, Ajustes, «Cómo jugar»
  (Controles y Welcome Aboard), momento del día y Mundos (plegado). Cada sección se
  abre en su hoja con «‹ Menú» (`MarHoja` `onMenu`, `mar-hoja-menu`) que vuelve al
  menú; «Mi Carnet», venga de donde venga (Carnet de arriba, Logros, Ranking, botella,
  invitación, compra), es esa sección del menú. Mis códigos sigue siendo la tarjeta de
  abajo (sin «‹ Menú»). Se quita «Versión clásica 2D» del menú.
- Minimapa: arrastrar la carta (mapa grande) muy a un lado hacía saltar islas y marcas
  al otro lado (la vuelta al planeta se calculaba alrededor del foco arrastrado). Ahora
  se da la vuelta alrededor del centro de la carta (`wrapC` en `engine/mar3d.ts`) y la
  carta sólo se arrastra hasta ver su borde (`mapPanLimit` en `engine/wrap.ts`, con
  pruebas). Además, un arrastre que empieza en el minimapa, va lejos y vuelve al sitio
  ya no abre el mapa (sólo una pulsación que no se movió).
- Landing: la Filosofía se pinta dentro del bloque Contacto (`ContactView` en
  `lib/landing/resolve.ts`, `#filosofia` dentro de `#contacto`, luego «Datos de
  contacto»); cada parte sigue siendo su bloque en el Admin (etiquetas «Contacto (con
  la Filosofía dentro)» y «Filosofía (se ve dentro de Contacto)»). Contacto oculto se
  lleva la Filosofía; sin bloque Contacto, la Filosofía sale sola. El enlace
  «Filosofía» de la cabecera sigue (ancla dentro de Contacto).
- REQ-PRO-009 y REQ-COM-030 con su nueva prueba en `docs/spec/estado.md` (siguen
  PARCIAL).

Comandos:

- `pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000` → exit 0
  (97 ficheros, 891 pruebas).
- `sh tools/spec/checks.sh` → exit 0; `pnpm lint` → exit 0; `pnpm build` → exit 0;
  `pnpm typecheck` → exit 0.
- `E2E_PORT=3221 pnpm e2e mar-hud logros mar-a-bordo mar-botellas mar-fiestera
  mar-paridad tienda solo-3d intro agujero-negro demo mar-entradas tickets landing
  admin.spec carnet --workers=1` → 135 pasan, 10 saltadas, 1 falla
  (`intro.spec.ts` «una escena lenta», móvil: `route.fetch: read ECONNRESET` por carga
  de la máquina); repetida sola (`intro -g "escena lenta"`) → exit 0, 2 pasan.

Pendiente:

- REQ-PRO-009: su criterio en `09-requisitos.md` (sólo minimapa, menú, Inicio, saldos,
  brújula) no recoge los enlaces a la web de esta decisión.
- Textos `muestra` («Shop», «Datos de contacto», etiquetas del menú) [pendiente Álvaro].

## 2026-10-02 — plan 005 T62: Borrar el mundo 2D

Qué existe:

- D-25 en `docs/DECISIONES.md`: sólo el planeta 3D (2026-10-01, Hernán y
  Álvaro). `CLAUDE.md`, `README.md` y `docs/TRASPASO.md` describen el planeta
  3D de `/mar` en vez del mundo 2,5D de `/juego`.
- `/juego` ya no existe: `app/juego/` (page, game-canvas, juego.css) borrado.
  `lib/security-headers.ts` (`RENAMED_ROUTES`) redirige `/juego` y
  `/juego/:path*` a `/mar` con un 307 (temporal); Next pasa la consulta tal
  cual, así `?ir=`, `?evento=`, `?menu=` y `?cerca=` abren el mar en su sitio.
- Motor 2D fuera de `packages/engine`: `game.ts`, `pixi-app.ts`, `views.ts`,
  `water.ts`, `wake.ts`, `camera.ts`, `loop.ts`, `input/dom.ts`,
  `ship/{view,direction,dressing}.ts`, `bottles/view.ts`,
  `world/{assets,bubble,coast-view,object-view,streamer,texture-store,art-plan,atlas-index,atlas-pack}.ts`,
  `transition/vortex-view.ts` y la entrada 2D (`intro/{sphere,port,timeline,
  world-geometry,assets,sphere-probe,sphere-probe-pose,test-fixtures}.ts`) con
  sus pruebas. `intro/config.ts` queda con lo común (curvas, `TitleMotion`,
  `DEFAULT_TITLE_MOTION`, `DEFAULT_INTRO_COPY` y `titleMotionErrors`, que
  ahora valida el título en `validatePlanetIntro`). `pixi.js` fuera de las
  dependencias y del lockfile; `@boia/engine/streaming` sólo exporta
  `world/sectors` (lo que usa `/mar`).
- Fuera también: `app/sphere-probe`, `lib/intro/worlds.ts`, el paso de
  superficie de `lib/world-handoff.ts` (`offerWorld`/`claimWorld`; el módulo
  se queda con los enlaces a `/mar`), los atlas por sector
  (`tools/atlas/`, `scripts/atlas.mjs`, `public/atlas/`) y el presupuesto del
  primer sector (`scripts/world-budget.mjs` y su prueba); `pnpm build` es
  `next build` + presupuesto de la landing. Restos del HUD 2D sin usar en
  `lib/mundo/` (balances, bottle-bar, carnet-sheet, celebration, feedback,
  hud-buttons, minimap, notice-copy, streaming, use-viewport, world-ui),
  `useShipLocks` y `demoWorld`.
- `/mar`: sin el enlace «Versión clásica 2D» del menú; sin WebGL, la pantalla
  de error dice «Tu dispositivo no puede mostrar el mundo 3D» y ofrece «Ver
  las entradas» (`/#tickets`, `data-testid="mar-sin-3d-entradas"`); textos en
  `docs/propuestas/textos-zonas.md` (`error.3d.*`, `muestra`), regenerados con
  `i18n:zonas` (se añadió allí `shop.lockedMission`, que T59 había puesto a
  mano en `es-zonas.ts`).
- Pruebas e2e: las que abrían `/juego` pasan a `/mar` con ayudas comunes en
  `e2e/mar-helpers.ts` (admin, agujero-negro, carnet, ciclo-evento,
  comunidad, demo, descuentos, eventos, mundo-acuarela, mundo-arcilla,
  tickets, record-eventos) o se borran si sólo probaban el 2D o ya las cubre
  `/mar` (juego-hud, sectores, fiestera, sphere-probe, record-agujero,
  record-demo, y tests sueltos de accesos, logros y tienda). Nueva
  `e2e/solo-3d.spec.ts`: `/juego?ir=fotos` lleva a `/mar` navegando hasta el
  Puerto de Fotos, `/juego?evento=` y `/juego?menu=carnet`, el aviso sin
  WebGL y el audio tras el primer gesto. `entrega.spec.ts` comprueba el 307
  con su consulta; `landing.spec.ts` bloquea el bundle de `/mar` en vez del
  de `/juego`; `despliegue.spec.ts` normaliza las rutas de `art/` a `/` (en
  Windows `path.relative` daba `\`). Las pruebas unitarias de la ficha de
  isla (event-card, eventos) usan `EventBlock` de `app/mar/sheet.tsx` (ahora
  exportado).
- `docs/spec/estado.md`: 27 filas re-enlazadas a pruebas de `/mar`; bajan a
  PARCIAL las que sólo sostenía el 2D (PRO-011, MUN-004, MUN-009, MUN-021,
  MUN-030, IDE-034, ARQ-014). Total: HECHO 152 · PARCIAL 62 · FALTA 33 · L2
  28 · final 19.

Comandos:

- Comando de pruebas del plan (tras fusionar main con T61) → 0: vitest 97
  archivos, 886 pruebas; estado.py sin errores; landing 177,6 / 192 kB. Con
  la máquina cargada por otros agentes, antes de fusionar 1–7 pruebas ajenas
  caían por el plazo de 5 s y pasaban solas.
- `grep -rln "pixi" apps packages --include=*.ts --include=*.tsx --include=package.json | grep -v node_modules` → nada.
- `test ! -d apps/web/app/juego` → 0.
- `E2E_PORT=3291 pnpm e2e --workers=2` (antes de fusionar main) → 188
  pasan, 25 fallan, 23 saltadas (1,3 h, máquina cargada); las 25 con
  `--last-failed --workers=1` → 25 pasan. Tras fusionar main:
  solo-3d, entrega, minijuegos y mar-circuito → pasan salvo mar-circuito
  (ver Pendiente).

Pendiente:

- `e2e/mar-circuito.spec.ts` (T61, recién fusionado) es sensible a la carga:
  su piloto con teclado por fotograma falla a veces («sin carrera», o no
  queda quieto en la salida); en 3 pasadas cada prueba pasó en algún
  proyecto, y el código que prueba es idéntico al de main (T62 no toca
  carrera ni HUD del circuito). Última, con `--workers=1`: 3 pasan, 1 falla
  (móvil, «tres vueltas…»).
- `/mar` no cuenta `discount_found` (el 2D sí): REQ-ARQ-019 lo anota.
- El Menú de a bordo 2D (`lib/mundo/menu/onboard-menu.tsx`, los
  `MenuSection` de `sections/` y `hud.test.ts`) ya no lo monta nadie; se dejó
  porque T65 rehace el menú de `/mar` en esa carpeta.
- Ayudas 2D sin DOM que siguen exportadas y sólo usan las pruebas del motor
  (`world/visual.ts`, `world/simulate.ts`, `manifest-loader.ts`,
  `loadShipStyle`, modos de teclado).
- `record.spec.ts` y `record-titulo.spec.ts` (sólo con variable) siguen
  grabando «Zarpar → landing».

## 2026-10-02 — plan 005 T61: Circuit El Freu, rebuilt

Qué existe:

- **El Freu es un circuito cerrado de tres vueltas** (`packages/world/src/worlds/arcilla/map.ts`):
  la salida es también la meta; seis boias numeradas que hay que pasar en orden
  rodean Els Dents (sube por el lado del antiguo atajo, gira al norte, baja por la
  ruta segura junto al cocodrilo y vuelve por la recta). Reusa CP1, CP-A y CP-S de
  la maqueta y añade `circuito-giro`, `circuito-regreso` y `circuito-recta` (fuente
  `plan:T61`; `arcilla.test.ts` acepta ese prefijo). CP2, la meta y el cartel del
  atajo quedan inactivos (siguen en los datos). Boias de carril sólo por fuera del
  trazado, sin pisar rocas ni boias. Tres **impulsos** en el agua (`circuito-impulso-N`,
  colisión `boost`, no sólidos). La salida lleva `params.laps` (3) y `params.medals`
  (oro 36 s, plata 44 s, bronce 58 s, `muestra`). `CIRCUIT_VERSION` = 2: los récords
  empiezan de cero (REQ-AVE-033). Igual en Arcilla (El Freu) y Acuarela (El Penyal).
- **Motor** (`packages/engine/src/circuit`): `CircuitRace` con vueltas (eventos
  `checkpoint`, `lap`, `missed` —pasar por la salida sin una boia no cuenta la
  vuelta—, `finish` con el tiempo de cada vuelta), `start()`, `medalFor`/`nextMedal`,
  y `ghost.ts` (`GhostRecorder`, `ghostPose`, `encodeGhost`/`decodeGhost`). El
  récord es el tiempo total, con la misma clave y formato (`circuito:el-freu:v2`,
  `readRecord`): la pestaña Circuito del ranking (T56) lo lee sin cambios.
- **Runtime** (`packages/engine/src/world/runtime.ts`): los impulsos ya no se
  multiplican entre sí (vale el más fuerte; los que frenan sí se suman). Con boias
  tan seguidas, los boosts de 2 s de los checkpoints se encadenaban sin tope.
- **/mar**: reloj de carrera en tiempo de simulación (`onStep`); al pasar por la
  salida, semáforo y el barco quieto en ella hasta «¡Ya!» (`Mar3D.holdShip`); la
  boia que toca se enciende (aro amarillo y luz); cronómetro pequeño arriba con
  vuelta y boia (`app/mar/carrera.tsx`, `data-vuelta`/`data-boia`/`data-fantasma`);
  avisos de vuelta, «¡Última vuelta!» y «Te falta la boia N»; tarjeta de meta pequeña
  con medalla, tiempo, récord, vueltas, la siguiente medalla y «Otra vez»; el récord
  al acercarse a la salida. El fantasma: se graba cada carrera y la mejor se guarda en
  este navegador (`boia:fantasma:circuito:el-freu:v2`, `app/mar/race.ts`); en la
  siguiente, un barco translúcido la repite (`Mar3D.setGhost`, canvas `data-ghost`).
  Piezas 3D en `app/mar/engine/race-props.ts`. Textos `mar.race.*` en `es-mar.ts`.
- El 2D (`lib/mundo/circuit-hud.tsx`) entiende los eventos nuevos (vuelta, boia que
  falta); se borra con /juego.
- REQ: AVE-028 → HECHO (e2e); AVE-027/033 con la prueba renombrada; AVE-026 y
  AVE-031 → PARCIAL con nota (sin destino ni ramas a elegir desde la entrevista).
- Capturas: `docs/informes/img/p005-t61-*.png` (móvil, `RECORD_T61=1`).

Comandos:

- `vitest` del circuito, del mar y del runtime (`packages/engine/src/circuit`,
  `apps/web/app/mar/race.test.ts`, `runtime.test.ts`, `circuit-hud.test.ts`,
  `physics.test.ts`, `packages/world`) → exit 0. Un piloto sencillo corre las
  tres vueltas en /mar (≈39 s, plata) sin abrir paneles, igual en los dos mundos.
- `pnpm exec vitest run --exclude '**/packages/db/**'` → exit 0, 108 archivos,
  956 pruebas (con la máquina muy cargada por otras tareas, antes salieron
  fallos sólo por tiempo de 5 s).
- `sh tools/spec/checks.sh`, `pnpm typecheck`, `pnpm lint`, `pnpm build` → exit 0.
- `pnpm e2e e2e/mar-circuito.spec.ts --workers=2` → 4 pasan (móvil y escritorio:
  tres vueltas con el teclado, medalla, récord y fantasma; la boia saltada).
- Relacionados (mar-3d, mar-botellas, mar-hud, mundo-arcilla) con `--workers=2`
  bajo carga: fallos por tiempo; repetidos con `--workers=1`, todos pasan salvo
  mar-3d «la cámara en un móvil en vertical…», que falla o pasa según la carga
  (2 de 4 en `--repeat-each=2`; no toca el circuito).

Pendiente:

- Logros del circuito en la muestra (`packages/store`): «¿Atajo? Atajo.» se completa
  en cualquier carrera (el trazado pasa por la boia del atajo) y «Rayo del Freu»
  (43,6 s) dice «una vuelta» pero mide las tres. Textos y umbrales, para Álvaro.
- Trazado, vueltas, medallas e impulsos son `muestra`.

## 2026-10-02 — plan 005 T64: «Zarpar» entra en el juego

Qué existe:

- D-24 en `docs/DECISIONES.md`: el planeta de la entrada es el mundo 3D y
  «Zarpar» entra en `/mar` con la bienvenida de la boia abierta; «Saltar
  animación» y «Solo quiero ver las entradas» siguen yendo a la landing.
- Entrada v5 (`packages/engine/src/intro/planet.ts`): el acto 3 ya no baja
  al hero; es una zambullida. `landing` lleva `diveFit`, `anchor` y `cover`
  (sin `extraSpinDeg` ni `content`). El planeta gira por el camino más corto
  hasta poner de cara el puerto de salida (`focusSpin`, `divePose`), crece
  hasta 9 veces el lado corto y un velo cubre la vista al final. Con
  movimiento reducido es un fundido al velo, sin mover nada. Los fotogramas
  llevan `cover`. El controlador expone `toGame` y deja de girar mientras
  zarpa. La escena le da el puerto (`focus`, el `spawn` de `/mar` en la
  esfera) e `islandIds`.
- `lib/intro/run.ts`: al llegar zarpando, el velo se queda puesto, se cuenta
  `explore_start {source:'intro'}` (nuevo origen en
  `packages/contracts/src/analytics.ts`), no hay `landing_view` y se llama a
  `onEnterGame`. En la pausa se pide `/mar` por adelantado. El diagnóstico
  `__boiaIntro` añade `exit`, `cover` e `islandIds`.
- `intro-stage.tsx`: el velo `.intro-cover` (la pantalla de carga de `/mar`:
  mismo fondo, boia y «Preparando el mar…») y `router.push('/mar?menu=bienvenida')`
  (`lib/intro/zarpar.ts`). Es una navegación de la app, sin recarga; si en
  8 s no ha llegado, hace una carga completa.
- `/mar`, sólo añadidos: al llegar zarpando (`takeZarpar`), un velo
  `.mar-velo` igual que la pantalla de carga se funde cuando el mar está
  listo. Welcome Aboard empieza con la boia de la entrada hablando
  («¡Plop! Soy la boia de la entrada…», `muestra`) y acaba con «¡A
  navegar!», que la cierra.
- REQ: ENT-012 pasa de FALTA a PARCIAL. ENT-001, ENT-006 y ENT-014 llevan
  nota de T64, y ENT-006 enlaza el nuevo título de su prueba.

Comandos:

- `PYTHONUTF8=1 pnpm exec vitest run --exclude '**/packages/db/**'` → exit 0
  (109 archivos, 948 pruebas, tras unir con main: T56, T58, T59 y T60).
- `sh tools/spec/checks.sh` → OK (estado.md: HECHO 158, PARCIAL 56, FALTA 33).
- `pnpm typecheck` → 0. `pnpm lint` → 0.
- `pnpm build` → 0, landing 179,1/192 kB.
- Tras unir con main: `E2E_PORT=3264 pnpm e2e e2e/intro.spec.ts e2e/demo.spec.ts e2e/mar-a-bordo.spec.ts e2e/landing.spec.ts e2e/mar-3d.spec.ts e2e/mar-fiestera.spec.ts --workers=2`
  → 99 passed, 1 failed (`mar-fiestera` «un secreto sin código…», escritorio:
  no vio a tiempo el aviso de monedas mientras el barco navegaba, con carga);
  `pnpm e2e e2e/mar-fiestera.spec.ts --workers=1` → exit 0, 10 passed.

Pendiente:

- T62 tiene que usar D-25 para «sólo el planeta 3D»: D-24 ya está tomada.
- Ajustar en móviles reales la zambullida (`diveFit`, `anchor`, `cover`) y
  el texto de la boia (`muestra`).
- `docs/spec/09-requisitos.md` sigue diciendo que REQ-ENT-001 termina «en la
  landing sobre el mar»; D-24 lo modifica.
- `record.spec.ts` y `record-titulo.spec.ts` siguen grabando «Zarpar → landing».
  Sólo corren a mano.

## 2026-10-02 — plan 005 T59: Boia Fiestera como misión central; 3 descuentos claros

Qué existe:

- **Tres descuentos del mundo** (`packages/store/src/sample/content.ts`): el
  del náufrago (`NAUFRAGO10`), el del ánfora («cofre», `COFRE5`) y el premio
  de la Fiestera (`FIESTERA20`, -20 % en cualquier entrada, prioridad 10). Se
  quitan el código caducado de los restos (`VERANO26`, `DEBRIS_DISCOUNT`) y el
  de tienda escondido (`TIENDA15`). Códigos `muestra` (P16). El Admin sigue
  pudiendo esconder uno de tienda (`hiddenAt`).
- **Misión central**: la última isla declara `missionReward.discount`; el
  motor lo lleva en `reward.discount` del evento `delivered`
  (`packages/engine/src/mission/rescue.ts`). /mar, al entregarla, da el
  código con su ficha (`deliveryDiscount`, `lib/mundo/mission.ts`), y la
  compra de prueba lo aplica. Quien la entregó antes lo recibe al volver
  (`missedDeliveryDiscount`).
- **Barco exclusivo «La Fiestera»**: cosmético `barco-fiestera` con
  `unlockMission: 'fiestera'` (campo nuevo de `cosmeticSchema`): lo tiene
  quien completó la misión, derivado de la misión guardada (sin logro, sin
  precio, sin migración); `ShopItem.unlock` gana `{ kind: 'mission' }`. Arte:
  variante del registro (`docs/barcos/barcos.json` → `variantes`), el GLB y las
  vistas de B05 Arcilla en fiesta con el tono girado 170° (3D:
  `withShipVariants`/`rotateHue` en `ship-model.ts`; miniaturas: filtro
  `hue-rotate`). Sin arte nuevo de Blender.
- **«?» en el minimapa** (`app/mar/minimap.tsx`, `engine/globe.ts`): uno por
  código pendiente; el de la Fiestera va con ella y, a bordo, a su destino; se
  quitan al encontrar el código. Viven en el componente del minimapa.
- **Guía** (`lib/mundo/guide.ts`): la Fiestera (o su destino), los códigos
  pendientes y los minijuegos sin visitar. El delfín de /mar guía a lo
  pendiente más cercano (`data-delfin-hacia`); cada boia informativa tiene
  `params.guide` y al terminar de hablar ofrece un chip «Rumbo a…» que fija
  rumbo (`app/mar/guia.tsx`). Los secretos sin código (cueva, campana,
  círculo) siguen ocultos, sin «?», y dan sus monedas/puntos y su logro.
- **Sin boyas de ruta** (petición de Hernán y Álvaro): `seaRoute` ya no
  calcula boyas ni /mar las pinta; guían las marcas en el agua (`RouteLine`,
  ahora visibles también de cerca). Quedan las 6 boies informativas y las de
  carrera del circuito.
- `main.mar` expone `data-mision` (paso de la misión).
- REQ: AVE-015 → HECHO; AVE-008 y AVE-021 con evidencia y nota nuevas.
- Capturas: `docs/informes/img/p005-t59-*.png` (móvil, `RECORD_T59=1`).

Comandos:

- `pnpm exec vitest run --exclude '**/packages/db/**'` → exit 0, 106 archivos, 926 pruebas.
- `sh tools/spec/checks.sh` → exit 0.
- `pnpm typecheck` → exit 0 · `pnpm lint` → exit 0 · `pnpm build` → exit 0.
- `E2E_PORT=3291 pnpm e2e e2e/mar-fiestera.spec.ts --workers=2` → exit 0, 10 pasan.
- Specs relacionados (mar-fiestera, mar-3d, mar-paridad, mar-entradas,
  mar-hud, tienda, logros, demo, descuentos, mundo-arcilla, mundo-acuarela,
  fiestera, comunidad, mar-a-bordo) con `--workers=2` → 122 pasan, 5 se
  saltan, 3 fallan por carga (mar-hud «los avisos son chips…» ×2, mar-3d «el
  mundo compacto…» en escritorio); solos con `--workers=1` → exit 0, 4 pasan.

Tras integrar main (T56 botellas y ranking, T60 minijuegos; conflicto sólo
en los imports de `mar-client.tsx`, se quedan los dos):

- vitest → exit 0, 108 archivos, 943 pruebas · checks, typecheck, lint, build → exit 0.
- `pnpm e2e e2e/mar-fiestera.spec.ts e2e/minijuegos.spec.ts --workers=1` → exit 0, 16 pasan.
- `pnpm e2e e2e/mar-botellas.spec.ts e2e/mar-3d.spec.ts e2e/mar-entradas.spec.ts e2e/mar-hud.spec.ts --workers=1` → exit 0, 38 pasan.

Pendiente:

- /juego no da el código de la entrega ni guía igual (se borra en T62).
- La entrega por 2 lados en /mar (REQ-AVE-008) sigue sin prueba propia.
- Códigos, textos y el aspecto del barco exclusivo: `muestra`, pendientes de Álvaro.

## 2026-10-02 — plan 005 T60: Lighthouse and cannon minigames, rebuilt

Qué existe:
- **Vigilancia del faro** rehecho (`packages/engine/src/minigames/faro.ts`): de noche, los
  piratas salen del horizonte rumbo a la costa en silueta; el haz (dedo, ratón o ← →)
  acumula luz sobre cada barco y, llena, el pirata da media vuelta. Tres clases (balandra,
  bergantín, galeón: rapidez, luz necesaria y puntos distintos), 10 oleadas cada vez más
  rápidas y apretadas (`faroWave`), 3 vidas (un pirata en la costa = −1), racha que
  multiplica los puntos (x1…x4, se rompe al perder una vida) y DESTELLO: un cono ancho, uno
  por oleada (máx. 2 guardados).
- **Cañón contra tiburones** rehecho (`canon.ts`): vista de lado, cañón en la torre;
  arrastrar desde cualquier sitio da ángulo (dirección) y potencia (longitud), soltar
  dispara; la bola vuela en parábola exacta (`canonShot`, `ballAt`, `powerFor`) con la
  primera parte del arco punteada. Tiburones (se sumergen; la salpicadura sólo asusta a los
  de superficie) y, desde la oleada 2, piratas (dos impactos; la bola también da en la
  vela en vuelo). 10 oleadas más rápidas, combo por disparos seguidos que aciertan (x1…x4,
  un fallo o una vida perdida lo ponen a cero), 3 vidas. Teclado: ↑↓ ángulo, ←→ potencia,
  Espacio fuego.
- Los dos: fin por vidas, por acabar las 10 oleadas o por el tope de 600 s; premio (ganchos
  de siempre: `grantMinigameReward`, `withWinSignal` → logro `win_minigame`) con 600
  (faro) / 400 (cañón) puntos o más; mejor marca local (`boia.minijuegos.marcas`) en la
  intro y en la pantalla final, que ahora enseña la marca en grande
  (`minijuego-marca`). Sesiones: se gana si y sólo si la marca llega al objetivo, acabe como
  acabe; `minPlausibleMs` nuevo por semilla (cada barco/intruso, como mucho sus puntos al
  multiplicador máximo, nunca antes de salir).
- Sin la etiqueta «Minijuego · muestra»: ni en la intro del juego ni en el panel de la isla
  (clave `minigame.kicker`, «Minijuego»; se quitó `juego.minigameLayer.minijuegoMuestra`).
- Capa propia, sin tocar la barra de /mar: `mountMinigame` pinta su overlay; textos y
  avisos de cada juego en su definición (`hint`, `feedback`), sonido para destello y oleada.
- `docs/spec/estado.md`: REQ-AVE-036/037 enlazan las pruebas nuevas.

Comandos:
- `pnpm exec vitest run --exclude '**/packages/db/**'` → 106 archivos, 929 pruebas, todas
  pasan (bajo carga, algunas pruebas de arte/mundo ajenas a T60 se pasan de 5 s; repetidas,
  pasan). `minigames.test.ts`: 30 pruebas (oleadas más rápidas, vidas que acaban la
  partida, parábola que cae en el objetivo con el ángulo/potencia calculados, combo y
  racha, destello, sesiones, dibujo en los tres estilos).
- `sh tools/spec/checks.sh` → OK; `pnpm typecheck` → 0; `pnpm lint` → 0; `pnpm build` → 0.
- `E2E_PORT=3251 pnpm e2e minijuegos.spec.ts --workers=1` → 6 passed (móvil y escritorio):
  cada juego se abre en su isla con `/mar?ir=faro|canon` y «Jugar», se juega con guion
  hasta puntuar, se pierden las 3 vidas, pantalla final con marca y mejor marca, y vuelta
  al mar; pausa y pestaña oculta con `/mar?minijuego=canon`.

Pendiente:
- Balance (objetivos 600/400, velocidades, premio) es `muestra`: lo ajusta quien juegue.
- `docs/spec/09-requisitos.md` (criterios de AVE-036/037) y los textos `minigame.*` de
  `docs/propuestas/textos-zonas.md` / `es-zonas.ts` describen los juegos antiguos (no los
  usa el código): actualizar con los docs de T62.
- T63: exponer en el Admin los parámetros que se quieran (objetivo, vidas, oleadas).

## 2026-10-02 — plan 005 T56: Botellas y ranking en /mar

Qué existe:

- **Botellas en el mar 3D** (REQ-IDE-040…044). El repositorio sigue guardando
  cada botella con su posición del mapa compartido (la que valida, la misma
  del 2D). `pointMap` (`apps/web/app/mar/engine/compress.ts`) la pasa al
  planeta de /mar con el mismo cambio de escala que `compressWorld`, y
  también la devuelve. `apps/web/app/mar/bottles.ts` (sin three.js): las
  coloca en el agua del planeta (fuera de islas, de lo sólido y del
  decorado), busca dónde cae la propia junto a la popa y mira cuáles están
  cerca del barco por el camino corto del planeta. `Mar3D.setBottles`
  (`engine/mar3d.ts`) pinta una botella de cristal tumbada que flota en cada
  sitio (la propia con el corcho naranja) y deja sus ids en `data-bottles`
  del lienzo.
- **HUD** (sólo se añaden entradas): en el Menú, «✉️ Mi botella» y
  «🏅 Ranking». Encima de la barra salen chips con las botellas cercanas
  («🍾 Tu botella», «🍾 Botella de X», como mucho dos). Se ven cuando no hay
  ficha, compra, menú, viaje ni invitación.
- **Hoja de la botella y del ranking** (`apps/web/app/mar/botellas.tsx`),
  en la `MarHoja` de T55. Reutiliza `MyBottle` y `FoundBottle` de
  `lib/mundo/bottles/bottle-sheet.tsx` (ahora exportadas; `MyBottle` recibe
  `dropSpot`). Lo que pide Carnet abre «Mi Carnet» dentro del mundo (T55).
  Desde allí, «Echar una botella» y «Editar o retirar» vuelven a la hoja de
  la botella (`MarABordo` recibe `onBottles`). «VER SU CARNET» de otro
  miembro abre `/carnet/<id>`. La botella, el ranking, los paneles de a
  bordo y «Elige tu evento» (T58) se cierran entre sí al abrir otro.
  `MarHoja` enfoca con `preventScroll`: el mar ya no se desplaza 40 px
  mientras la hoja entra.
- **Ranking** con tres pestañas: De siempre, Temporada y Circuito.
  `RankingPanel` (exportado de `lib/mundo/menu/sections/ranking.tsx`) lo
  usan /mar y el Menú del 2D. Con `onOwnCarnet`, la fila propia abre Mi
  Carnet en el mar. La pestaña Circuito (`lib/mundo/ranking-circuit.ts`)
  junta el récord local (`readRecord`, el mismo formato de récord por
  versión que la carrera) con los tiempos de muestra `SAMPLE_CIRCUIT_MS`. El
  visitante sin vuelta va al final («sin vuelta»).
- `@boia/engine/bottles`: `findDropSpotWhere` y `nearestSpotWhere`, con una
  regla de agua a elegir. `findDropSpot` y `nearestSeaSpot` las usan.
- i18n: `mar.botella.*` y `mar.ranking.*` (es-mar.ts) y `lib.ranking.*`
  (es-lib.ts).
- `docs/spec/estado.md`: REQ-IDE-040 y REQ-IDE-053 enlazan las pruebas
  nuevas.

Comandos (tras unir main con T55 y T58):

- `pnpm exec vitest run --exclude '**/packages/db/**'` → exit 0, 106 archivos,
  924 pruebas.
- `sh tools/spec/checks.sh` → exit 0. `pnpm typecheck` → exit 0. `pnpm lint`
  → exit 0. `pnpm build` → exit 0 (landing 178,4/192 kB).
- `E2E_PORT=3261 pnpm e2e e2e/mar-botellas.spec.ts e2e/mar-entradas.spec.ts
  e2e/mar-hud.spec.ts e2e/mar-a-bordo.spec.ts --workers=1` → exit 0, 26 pasan.
- Tras la unión con T55: `mar-botellas`, `mar-a-bordo` y `mar-hud` con
  `--workers=1` → exit 0, 22 pasan. `comunidad.spec.ts` con `--workers=1` →
  exit 0, 8 pasan. La misma tanda con `--workers=2`, con otra suite e2e
  corriendo a la vez, tardó 21 min y fallaron 7 por tiempo y por contextos
  cerrados. Se repitieron solas y pasan.
- Antes, `e2e/mar-paridad.spec.ts`: «Mundos» en móvil falló una vez con la
  máquina cargada (el barco se movió durante el vórtice). Sola → exit 0.

Pendiente:

- Contenido `muestra`: los tiempos del circuito de los miembros de muestra y
  la forma de la botella.

## 2026-10-01 — plan 005 T58: Entradas dentro del mundo 3D

Qué existe:
- «Entradas» de la barra de /mar abre «Elige tu evento» dentro del mar, en la
  hoja crema de abajo (`MarHoja`; `app/mar/entradas.tsx`, estilos en
  `app/mar/entradas.css`). Los eventos salen de `resolveTicketsPanel`, la misma
  función que el panel de Tickets de la landing (`app/mar/entradas-model.ts`):
  el destacado y los próximos a la venta, con su estado, el aviso «Tienes un
  código de descuento» si el visitante tiene uno que vale, «🎟️ Comprar
  entrada» y «⛵ Ir a su isla» (si la tiene en el mapa). Otro toque de
  «Entradas» lo cierra; durante un viaje hacia una compra el toque abre la
  compra ya (como antes).
- «Comprar entrada» abre el checkout de prueba (`SandboxCheckout`, el mismo de
  la landing) encima del panel, sin salir de /mar; en el móvil va pegado abajo
  como hoja (`className="checkout--mar"`). El código encontrado navegando se
  aplica (lo hacía ya el sandbox). Al cerrar tras comprar, el panel se cierra y
  llega la invitación al Carnet; «Ver mi Carnet» abre Mi Carnet dentro del mar
  con el sello. Cerrar sin comprar vuelve al panel.
- «Ir a su isla» hace el viaje que antes hacía «Entradas» directamente: vuelo
  (o turbo con `?vuelo=0`) a la isla del evento y, al llegar o con «Saltar»,
  el checkout; con movimiento reducido, directo. Se quitó `currentEventTrip`
  (`sheet.tsx`), que ya no usaba nadie; el «sin evento → `/#tickets`» de la
  landing desaparece (el panel dice «Próximamente»).
- Analítica: `tickets_panel_open` con `source: 'world'`; `ticket_click_out`
  con `source: 'world'` (panel) o `'island'` (la ficha de la isla en /mar, que
  antes no se contaba); `purchase_confirmed` lleva `source: 'world'` (opcional
  en el contrato, `PurchaseSource`): `SandboxCheckout` acepta `source`, el
  adaptador lo recibe en `start(eventId, { source })` y viaja en la sesión. La
  landing no lo pasa: su flujo no cambia.
- Texto de Welcome Aboard `mar.bienvenida.entradas` al día (`muestra`).
- REQ-ENT-037 pasa a HECHO (`entradas-model.test.ts` con 0, 1 y 3 eventos a
  la venta, y `mar-entradas.spec.ts`).
- Capturas (móvil 390×844): `docs/informes/img/p005-t58-entradas.png`,
  `p005-t58-checkout.png`, `p005-t58-comprada.png` (con `RECORD_T58=1`).

Comandos:
- `pnpm exec vitest run --exclude '**/packages/db/**'` → exit 0 (104 archivos, 912 pruebas)
- `sh tools/spec/checks.sh`, `pnpm typecheck`, `pnpm lint`, `pnpm build` → exit 0
- `E2E_PORT=3281 pnpm e2e mar-entradas.spec.ts mar-3d.spec.ts mar-hud.spec.ts --workers=2` → exit 0 (34 passed)
- `E2E_PORT=3281 pnpm e2e tickets.spec.ts landing.spec.ts descuentos.spec.ts mar-paridad.spec.ts logros.spec.ts despliegue.spec.ts --workers=2` → exit 1 (36 passed, 6 skipped, 10 failed, todos en desktop): 8 de logros/mar-paridad por carga (cierre de contexto y esperas de más de 2 min); las 2 de `despliegue.spec.ts` (`/api/art`) fallan en Windows por las barras de `path.relative` (`art\mundos\…` frente a `mundos/arcilla/`), nada que ver con T58
- Repetición de lo que falló por carga: `E2E_PORT=3281 pnpm e2e logros.spec.ts mar-paridad.spec.ts --project=desktop --workers=1` → exit 0 (12 passed, 2 skipped)
- Los specs de Tickets de la landing (`tickets.spec.ts`, `landing.spec.ts`, `descuentos.spec.ts`) pasan en los dos proyectos

Pendiente:
- Textos `muestra` [pendiente Álvaro].
- REQ-ENT-040 sigue HECHO con `mar-3d.spec.ts`, pero ahora el viaje en turbo
  sale de «Ir a su isla» del panel y no del primer toque de «Entradas»; su
  texto en `09-requisitos.md` podría decirlo (no se tocó la spec).

## 2026-10-01 — plan 005 T55: Ajustes, Controles, Carnet y enlaces profundos dentro de /mar

Qué existe:

- **A bordo dentro del mar** (`apps/web/app/mar/a-bordo.tsx`, `hoja.tsx`): Mi Carnet
  (ver, crear y editar sin salir del mundo), Ajustes (sensibilidad del giro teclado/táctil,
  música y efectos con su volumen, idioma), Controles (los del mar 3D) y Welcome Aboard,
  cada uno en una hoja crema (`MarHoja`, la de Logros y la tienda, que ahora la usan
  también). Se abren desde el Menú (botones nuevos), el icono Carnet de la barra (ya no
  navega a /carnet), «Mi Carnet» de Logros, la invitación «Crear mi Carnet», «Ver Mi
  Carnet» tras la compra de prueba y `?menu=<panel>`. Escape cierra aunque el foco
  esté fuera de la hoja.
- **Ajustes vivos**: `updateSettings` en `mar-client.tsx` guarda (`saveSettings`), aplica el
  sonido y llama a `setControlSensitivity`; el motor (T54) lo lee en cada paso
  (`turnScale`) y lo publica en `Stats.sensitivity` → `main.mar[data-giro="tecl,tactil"]`.
  Piezas compartidas con el 2D: `SoundAndLanguage`, `SensitivityField`, `WelcomeBody`
  (`lib/mundo/menu/sections/`) y `CarnetPanel` (`lib/mundo/carnet/carnet-panel.tsx`).
- **Enlaces profundos de /mar** (`app/mar/deep-link.ts`, `voyage.ts`): `?ir=<lugar>`
  (con `&evento=`), `?evento=<id o slug>` y `?menu=carnet|ajustes|controles|bienvenida|logros`
  (acepta los nombres del 2D `welcome`, `settings`, `controls`). El mar arranca con el
  barco en turbo hacia la isla (el viaje de la barra, con «Saltar») y al llegar abre su
  ficha (galería, escaparate o evento) y marca `data-llegada`; con movimiento reducido
  llega de un salto. Se quitan de la URL al arrancar; con `?ir`/`?evento` no se
  restaura la posición guardada.
- **Enlaces a /mar**: `placeHref` (Fotos, Tienda, Tickets `ticketsSailHref`) y el nuevo
  `eventSailHref` (`lib/world-handoff.ts`, con `MAR_PATH`, `MENU_PARAM`,
  `MAR_CARNET_HREF`); «Ir a su isla» de la ficha de evento (`lib/landing/eventos.ts`);
  `voyageHref` de las tarjetas de descuento; pie «Crear mi Carnet» y «Ver Mi Carnet» de
  la compra (`CARNET_CREATE_HREF`, `CARNET_FROM_LANDING`); panel de Tickets sin isla
  (`SEA_HREF`); /carnet («Volver al mar», «Editar/Crear mi Carnet»); Admin «Ver el mundo».
- Analítica: `explore_start` acepta `photos` y `store` y los «Ir en barco» de Fotos y
  Tienda lo emiten.
- Comentarios y textos que nombraban /juego dicen «el 2D» o «el mar»; los del Admin
  («quien llega al mar», «al entrar en el mar»).
- REQ-IDE-035 y REQ-IDE-036 pasan a HECHO; REQ-IDE-037 y REQ-ENT-034 enlazan también
  `mar-a-bordo.spec.ts`.

Comandos:

- Comando de prueba del proyecto (vitest sin db, checks.sh, typecheck, lint, build) →
  exit 0; vitest 101 archivos, 887 pruebas.
- `E2E_PORT=3231 pnpm e2e e2e/mar-a-bordo.spec.ts --workers=2` → exit 0, 12 passed.
- `E2E_PORT=3231 pnpm e2e` de mar-a-bordo, accesos, tickets, eventos, mar-hud, logros,
  tienda, carnet, juego-hud, mar-paridad y admin `--workers=2` → 87 passed, 5 skipped,
  2 failed (mar-paridad escritorio: el barco recogió otro código por el camino, bajo
  carga); `mar-paridad.spec.ts --project=desktop --workers=1` sola → exit 0, 8 passed.
- Tras `git merge main` (T57): conflictos en `lib/intro/active.ts` (borrado, como en main)
  y `lib/intro/bridge.ts` (comentario de main). Comando de prueba → exit 0, vitest 103
  archivos, 905 pruebas. `pnpm e2e` de mar-a-bordo, accesos, tickets, landing, intro y
  mar-hud `--workers=2` → 72 passed, 1 skipped, 1 failed (mar-hud escritorio «los avisos…»,
  tiempo agotado bajo carga); `mar-hud.spec.ts --project=desktop --workers=1` sola → exit 0,
  3 passed.
- `grep -rn "/juego" apps/web/app apps/web/lib --include=*.ts --include=*.tsx | grep -v "app/juego/"`
  → tras el merge sólo quedan, en /mar, «Versión clásica 2D» y el enlace de error (T62)
  y la prueba de T57 que comprueba que el hero ya no enlaza a /juego.

Pendiente:

- La botella propia no se abre desde Mi Carnet del mar (`CarnetPanel` sin `onBottles`):
  es de T56.
- «Versión clásica 2D» y el enlace de error de /mar a /juego: se van con T62.
- Textos nuevos (`mar.controles.*`, `mar.bienvenida.entradas`, títulos) `muestra`
  [pendiente Álvaro].

## 2026-10-01 — plan 005 T57: 3D landing intro with the planet, and the hero

Qué existe:

- **Entrada 3D con el planeta de /mar** (three.js, bajo demanda; nada en la
  ruta crítica): el planeta sube, crece y gira (1,4 s), entran las letras
  «BOIA» (la hoja de Blender de T27) y «Zarpar»; al pulsar, la cámara baja
  (1,3 s) hasta el horizonte del planeta, que se queda girando detrás del hero.
  - `packages/engine/src/intro/planet.ts`: configuración v4 versionada y
    validada (`DEFAULT_PLANET_INTRO`, `validatePlanetIntro`, encuadres por
    ancho con pose `intro` y `hero`) y la línea de tiempo pura (`frameAt`,
    `heroFrame`, `viewMoved`).
  - `controller.ts` reescrito: sin EXPLORAR/traspaso a /juego; el plazo de
    carga (`loadBudgetMs` 9000) empieza en `start()` (el montaje), sólo corre
    con la pestaña visible (`suspend`/`resume`) y la escena cuenta como lista
    cuando `createScene` resuelve (shaders compilados y primer pintado).
  - `entry.ts`: `bootScript({ capMs })` ya no lleva el plazo de 2000 ms desde
    el arranque; sólo un tope de seguridad (`bootCapMs` 15000) por si la app no
    monta nunca, que no corre con la pestaña oculta. `decideEntry` deja pasar
    `si`, `s`, `ref`, `ref_src`, `igsh`, `ltclid`/`lt_*`, `wa_*`, `mc_*`,
    `_ga`/`_gl`, `gbraid`/`wbraid`… además de `utm_*` y los `*clid`.
  - `apps/web/lib/planeta/`: `mini-planet.ts` (módulo compartido: agua en una
    esfera con orillas y espuma en shader, las islas de /mar —`buildIsland`,
    `buildSandbank`— dobladas sobre la superficie, nubes y halo),
    `sphere-map.ts` (puro: el mar de /mar enrollado en una esfera) e
    `intro-scene.ts` (renderer, cámara ortográfica en px CSS, estrellas, el
    mundo de este navegador con `liveWorld` + `marWorld`). Cero cambios en
    archivos de /mar: importa sus constructores de islas y su paleta.
  - `apps/web/lib/intro/run.ts`: la entrada en curso vive lo que la carga de
    `/`, no lo que el bloque del hero: un remontaje recoge la misma entrada
    (canvas incluido); sólo se termina si el hero se va (otra ruta). Además el
    hero tiene clave fija (`'hero'`) en `HomeBlocks`. En la landing, el giro
    del planeta va a 30 fps como mucho y nunca a más de ¼ del tiempo (WebGL por
    software, móviles flojos); en visita directa el planeta espera a que la
    página esté libre.
  - Respaldo ligero sin WebGL o sin el motor: un planeta en CSS (`.hero__planet`,
    tamaño en `cqmin`) en el sitio del horizonte final (`stillCss`).
  - Se borró la escena Pixi de la entrada (`intro/scene.ts`, sólo la usaba la
    landing) y `lib/intro/active.ts`.
- **Hero**: dos botones, el principal a `/mar` («Explorar el universo», texto
  del Admin, `data-testid="cta-3d"`) y Tickets al lado (en fila desde 481 px).
  Fuera el CTA 2D a /juego y la insignia «3D».
- Pruebas: `planet.test.ts` (nueva), `controller.test.ts` y `entry.test.ts`
  reescritas (plazo desde el montaje, pestaña oculta, tope del arranque),
  `blocks.test.ts` (+2: dos botones; clave fija del hero),
  `lib/planeta/sphere-map.test.ts`; `e2e/intro.spec.ts` reescrita (17 pruebas:
  `/` entera, `?si=`/`?utm_source=`/`?ref=`, escena retrasada 4 s que aun así
  se reproduce, escena que no llega → landing ligera, carga en segundo plano,
  saltar, Atrás, movimiento reducido, motor bloqueado, sin WebGL, recarga,
  `?intro=0`/`?menu=`/«Ver la introducción», vuelta a `/` sin recarga desde
  /legal); `demo.spec.ts`, `landing.spec.ts` y `record-demo.spec.ts` adaptadas.
  `docs/spec/estado.md`: ENT-003/006/010/014/020/038 enlazan las pruebas
  nuevas; ENT-012 (traspaso de escena a /juego) pasa a FALTA.

Comandos:

- `pnpm exec vitest run --exclude '**/packages/db/**'` → exit 0, 102 archivos, 897 pruebas.
- `sh tools/spec/checks.sh` → exit 0. `pnpm typecheck` → exit 0. `pnpm lint` → exit 0.
- `pnpm build` → exit 0; ruta crítica de la landing 177,8 kB de 192 kB.
- `E2E_PORT=3271 pnpm e2e e2e/intro.spec.ts e2e/demo.spec.ts e2e/accesos.spec.ts e2e/mar-3d.spec.ts:92 --workers=2`
  → 52 passed, 1 failed (`accesos.spec.ts:152`, /juego, por carga); sola → 1 passed.
- `E2E_PORT=3271 pnpm e2e e2e/landing.spec.ts e2e/admin-endurecido.spec.ts e2e/eventos.spec.ts --workers=2` → 28 passed.

Pendiente:

- Todo `muestra`: tiempos, encuadres (pose del planeta en la entrada y en el
  hero), colores del agua y del cielo, planeta en CSS; verlo con Hernán y
  Álvaro en móviles reales (REQ-ENT-021).
- T62: quedan del 2D `intro/{config,sphere,port,world-geometry,timeline,assets,
  test-fixtures,sphere-probe*}`, `lib/intro/worlds.ts` y las claves i18n
  `hero.explore3d*` (salen de `docs/propuestas/textos-zonas.md`); el texto de
  REQ-ENT-003/005 en `09-requisitos.md` aún dice «ninguna librería 3D en el
  bundle» (la ruta crítica sigue sin ella; three.js llega bajo demanda).

## 2026-10-01 — plan 005 T53: Mobile HUD and small popups in /mar

Qué existe:

- **Barra fina abajo** (`.mar-bar`, `data-testid="mar-barra"`), siempre a la
  vista en móvil y escritorio: Mapa (abre/cierra el mapa grande,
  `aria-pressed`), Logros (el mismo `mar-logros` con su número), «Entradas»
  destacada en el centro y un poco por encima (`mar-entradas`, mismo viaje y
  «Saltar» flotando encima), Carnet (enlace a `/carnet` hasta T55) y Menú
  (`mar-barra-menu`). En escritorio la barra va centrada (480 px).
- **Arriba sólo el minimapa** (izquierda, 72 px en móvil y 96 en escritorio;
  tocarlo sigue abriendo el mapa) **y los saldos** (derecha). El «←» y el
  botón BOIA/mundo pasan al menú: cabecera con «BOIA · Mar 3D · <mundo>»
  (`.mar-menu__world`) y «← Volver a BOIA». El menú (mismas secciones) se abre
  encima de la barra, a la derecha (`data-testid="mar-menu"`).
- **Fichas pequeñas** (`apps/web/app/mar/sheet.tsx`): toda ficha (vista de
  una isla, evento, isla, fotos, tienda, WhatsApp, descuento) se abre como
  tarjeta abajo, encima de la barra, con rótulo, título, una línea y un solo
  botón (Navegar, Comprar entrada, Ir a la isla, Explorar la isla, Ver fotos…),
  tope 30 % de la pantalla (~21 % medido a 375×812). Tocarla o su flecha
  (`mar-ficha-mas`, `aria-expanded`) la despliega entera;
  `data-expandida="si|no"`. «Mis códigos» se abre ya desplegada. Una ficha
  nueva (`sheetKey`) vuelve a abrirse pequeña. La cámara sube el barco por
  encima de la tarjeta (`setBottomInset` mide desde su `offsetTop`).
- **Avisos como chips** arriba, junto al minimapa y bajo los saldos: icono por
  tipo, título y cuerpo en una línea, × pequeño; se van solos con su tiempo de
  lectura (D-22). La invitación al Carnet pasa a tarjeta abajo, encima de la barra.
- Turbo (72 px), zoom y velocidad se apoyan encima de la barra (`--above-bar`).
- Claves i18n nuevas en `lib/i18n/es-mar.ts` (`mar.client.barra*`,
  `mar.client.volverABoiaMenu`, `mar.sheet.verMas/verMenos`).
- e2e nueva `apps/web/e2e/mar-hud.spec.ts` (375×812): barra con los cinco y
  «Entradas» en el centro, arriba sólo minimapa y saldos, Mapa y Menú
  funcionan; ficha de isla ≤ 30 % que se despliega al tocarla y se recoge;
  avisos como chips arriba que no pisan el HUD y se van solos.
  `mar-3d`, `mar-paridad` y `tienda` actualizados (desplegar la ficha antes de
  lo secundario; el menú desde `mar-barra-menu`).
- Capturas: `docs/informes/img/p005-t53-{hud,ficha,ficha-desplegada,aviso}.png`
  (`RECORD_T53=1`).

Comandos:

- `pnpm exec vitest run --exclude '**/packages/db/**'` → exit 0, 100 archivos, 879 pruebas.
- `sh tools/spec/checks.sh` → exit 0.
- `pnpm typecheck` → exit 0 · `pnpm lint` → exit 0 · `pnpm build` → exit 0.
- `E2E_PORT=3221 pnpm e2e e2e/mar-hud.spec.ts e2e/mar-3d.spec.ts e2e/mar-paridad.spec.ts e2e/logros.spec.ts e2e/tienda.spec.ts --workers=2` → exit 0, 58 pasan, 4 omitidas (capturas de logros), 0 fallan.

Pendiente:

- REQ-PRO-009 sigue PARCIAL: su criterio pide también «Inicio» en el HUD
  (ahora está en el menú) y la caja de fps sólo con `?debug`; decidir si la
  barra nueva lo cierra y enlazar `mar-hud.spec.ts`.
- El icono de Carnet de la barra abre `/carnet` hasta que T55 traiga el
  Carnet dentro del mundo.
- Probar en móvil físico (REQ-PRO-008).

## 2026-10-01 — plan 005 T52: Shared world code out of app/juego

Qué existe:

- `apps/web/lib/mundo/` es la casa común del mundo: todo lo que había en
  `apps/web/app/juego/` salvo el renderizador PixiJS 2D (71 archivos, con sus
  pruebas y sus CSS, misma estructura: `carnet/`, `menu/`, `bottles/`). Movido
  con `git mv`; ningún cambio de comportamiento, sólo rutas de import.
- En `apps/web/app/juego/` quedan sólo `page.tsx`, `game-canvas.tsx` y
  `juego.css` (el 2D); `game-canvas.tsx` importa ahora de `lib/mundo/`. Sin
  reexportaciones: borrar `app/juego/` (T62) no toca /mar, /carnet, la landing
  ni `lib/`.
- Imports actualizados en /mar, /carnet, la landing (`event-card.test.ts`,
  `purchase-invite.tsx`), `lib/` (repo, logros, barco, ticketing, intro,
  landing), `app/sphere-probe`, `scripts/world-budget.test.ts` y los e2e
  (`accesos`, `fiestera`, `logros`, `tienda`).
- Rutas de evidencia de `docs/spec/estado.md` y las menciones de
  `docs/matriz-dispositivos.md`, `docs/propuestas/logros-catalogo.md` y
  `lib/admin/achievements.ts` apuntan a `lib/mundo/`.

Comandos:

- `grep -rnE "from ['\"](\.\./)+juego/|app/juego/" apps/web/app/mar apps/web/app/carnet apps/web/lib --include=*.ts --include=*.tsx | grep -v "lib/intro"` → sin salida.
- `pnpm exec vitest run --exclude '**/packages/db/**'` → exit 0, 99 archivos, 871 pruebas.
- `sh tools/spec/checks.sh` → exit 0 (294 REQ · HECHO 155).
- `pnpm typecheck`, `pnpm lint`, `pnpm build` → exit 0 (landing 180.5 kB de 192 kB).
- `E2E_PORT=3211 pnpm e2e e2e/mar-3d.spec.ts e2e/mar-paridad.spec.ts --workers=2` → exit 0, 40 pasan.
- `E2E_PORT=3211 pnpm e2e --workers=2` → exit 1: 189 pasan, 36 se saltan,
  15 fallan. 13 son esperas bajo carga (intro, juego-hud, fiestera, mar-3d,
  mar-paridad: «Tearing down context exceeded», trazas cortadas) y pasan al
  repetirlas solas: `fiestera` + `juego-hud` con `--workers=1` → todas
  pasan; `intro.spec.ts --workers=1` → exit 0, 26 pasan (igual que en `main`,
  26 pasan); `mar-3d` + `mar-paridad` → 40 pasan. Las 2 de
  `despliegue.spec.ts` fallan en Windows por las barras de `path.relative`
  (`mundos\arcilla\…` frente a `'mundos/arcilla/'`), sin relación con este
  cambio.

Pendiente:

- `juego.css` sigue en `app/juego/`, importado sólo por `game-canvas.tsx`:
  el canvas 2D y el aspecto de `.juego-panel*` / `.juego-pulse-*` en /juego.
  /mar no lo carga (tiene sus propias reglas `.mar .juego-panel` en
  `mar.css`), así que se va con /juego en T62.
- Los componentes movidos que sólo usa el 2D (menú a bordo, minimapa,
  botellas, botones del HUD…) esperan en `lib/mundo/` a T55/T56 o a T62.

## 2026-10-01 — plan 005 T54: Faster steering in /mar

Qué existe:
- `apps/web/app/mar/engine/steering.ts` (nuevo, sin three.js): `MAR_SHIP_CONFIG` (física
  de /mar: giro 3,4 rad/s, `minTurnFactor` 0,75, `steerFloor` 0,8, `turnRadius` =
  220/3,4 u, `reverseTurn` {×1,9, +520 u/s²}; todo `muestra`), `stickInput` (zona muerta
  8 px, acelerador (len − 8)/56, como antes) y `keysInput` con `turnScale`,
  `boostedConfig` (turbo `TURBO_SPEED` 1,6 y viaje `VOYAGE_SPEED` 2,6, movidos aquí).
- `packages/engine/src/ship/controller.ts` + `config.ts`: tres campos opcionales de
  `ShipConfig`. `steerFloor`: el giro ya no cae con el acelerador (arrastre pequeño =
  giro rápido). `turnRadius`: por encima del crucero el giro, el agarre lateral y el
  freno en curva crecen con la velocidad, así el turbo/viaje no abren el círculo.
  `reverseTurn`: rumbo pedido de espaldas yendo hacia delante = más giro, freno extra y
  el deslizamiento se pierde en vez de empujar (vuelta corta y rápida). Sin los campos
  (`DEFAULT_SHIP_CONFIG`, /juego) el cálculo es el de siempre.
- `mar3d.ts`: usa `MAR_SHIP_CONFIG`, `stickInput`/`keysInput` y `boostedConfig`; lee la
  sensibilidad (REQ-MUN-008) de `controlSensitivity()` en cada paso (táctil para el
  joystick, teclado para las flechas) y al arrancar aplica la guardada en Ajustes
  (`setControlSensitivity(loadSettings(browserStore()).sensitivity)`), como /juego.
  T55 sólo tiene que llamar a `setControlSensitivity` al mover el deslizador.
- `@boia/engine/ui` exporta también `controlSensitivity`.

Comandos:
- `pnpm exec vitest run --exclude '**/packages/db/**'` → exit 0, 100 ficheros, 879 pruebas
  (nuevas: `apps/web/app/mar/engine/steering.test.ts` 5, `controller.test.ts` +3).
  Arrastre pequeño: 90° en 0,73 s (antes 19,6 s). Vuelta de 180° a 220 u/s: hacia atrás
  65 u de ancho / 0,80 s, hacia un lado 127 u / 0,92 s (antes ~181 u / 1,3 s ambas).
  Radio instantáneo igual en turbo y viaje que en crucero.
- `sh tools/spec/checks.sh` → exit 0; `pnpm typecheck` → exit 0; `pnpm lint` → exit 0;
  `pnpm build` → exit 0.
- `E2E_PORT=3263 pnpm e2e e2e/mar-3d.spec.ts --workers=2` → 22/24 con la máquina cargada
  (2 fallos por tiempo: minimapa y «mundo compacto»); esos dos con `--repeat-each=2` →
  8/8, exit 0. Los fallos por timeout de una primera pasada también pasan solos.

Pendiente:
- La vuelta hacia atrás en turbo sale algo más ancha que a velocidad de crucero (sigue
  más cerrada que la vuelta hacia un lado); el radio instantáneo es el mismo.
- Valores `muestra`: ajustarlos navegando en un móvil real.
- El deslizador de Ajustes en /mar es de T55.

## 2026-10-01 — fuera de plan: CSP sin `'unsafe-eval'` y clave de la escena de la entrada

Qué existe:
- **CSP de producción sin `'unsafe-eval'`** (REQ-ARQ-012): `packages/engine/src/pixi-app.ts` importa `pixi.js/unsafe-eval` (todas las `Application` del motor salen de `newApplication`), así que PixiJS ya no compila con `new Function`. `lib/security-headers.ts` sólo lo deja en desarrollo (refresco en caliente). Comprobado con `pnpm build && pnpm start`: la entrada (`/?intro=1`), `/juego` y `/mar` arrancan sin errores de CSP.
- **Aviso de React «Each child in a list should have a unique "key"»** en la landing (`BlockView`, hero): `heroScene` lo crea el servidor (`LandingPage`) y se pintaba entre hermanos sin clave; ahora va en un `Fragment` con `key`.
- En Windows, el repo necesita `core.autocrlf=false` (con CRLF fallan `apps/web/lib/barco/catalog.test.ts` y los `.sh`).

Comandos:
```
pnpm exec vitest run --testTimeout=30000 && pnpm typecheck && pnpm lint && pnpm build   # exit 0 salvo packages/db (sin Postgres local); 871 pruebas; landing 180,5 kB de 192
```

Pendiente: no se corrieron las e2e ni `tools/spec/checks.sh` (python3) en esta sesión.

## 2026-09-30 — plan 004 T49: entrega: estado por REQ, i18n, cabeceras de seguridad y documentos de traspaso

Qué existe:
- **La cámara de /mar vuelve a pasar** (`mar-3d.spec.ts:332`): `data-ship-screen` medía el barco a ras de agua mientras el vuelo de «Entradas» lo subía (y la cámara con él); ahora se proyecta a su altura de vuelo (`mar3d.ts`, `measure`). Comprobado: sin el cambio falla en móvil (dy 0,11), con él pasa en móvil y escritorio.
- **i18n por claves (REQ-ARQ-020)**: todas las cadenas de interfaz de /juego, /mar, el Admin y los módulos de `lib/` (incluidas las constantes «hasta T49»: `RANKING_COPY`, `CARNET_REPORT_COPY`, `BOTTLE_COPY`, `EVENTOS_COPY`, `FOTOS_COPY`, `EVENT_CARD_COPY`, `SHOP_COPY`, `CHECKOUT_COPY`, `ACCESS_COPY`, `ADMIN_COPY`…) leen su texto del catálogo. Las constantes conservan su forma (nadie más cambia) y sus valores son `t(...)`. Catálogo en `apps/web/lib/i18n/`: `es-web.ts` (la web pública), `es-zonas*.ts` (GENERADOS desde `docs/propuestas/textos-zonas.md` con `pnpm --filter @boia/web i18n:zonas`: las 623 claves), `es-juego.ts`, `es-mar.ts`, `es-admin.ts`, `es-lib*.ts`; `es.ts` es el entero. Donde el código ya decía el texto de textos-zonas se usa su clave; lo demás lleva clave `<zona>.<archivo>.<texto>`. `grep` de literales `'Xxx ` en juego/admin: 136 → 0.
- **La web pública traduce con su parte del catálogo** (`lib/i18n/web.ts`, y `lib/i18n/eventos.ts` para la ficha de evento y las fotos): el catálogo entero son ~35 kB gzip y la landing tiene 192 kB. Landing: 190,9 kB, OK. Las páginas (`page.tsx`, servidor) usan el entero. El generador decide qué claves de textos-zonas van a la web leyendo `app/(landing)`, `lib/landing` y `lib/ticketing`.
- **Legales con los textos de textos-zonas** (datos inventados, D-23 O14): `/legal/aviso-legal`, `/legal/privacidad`, `/legal/cookies` (`lib/legal/docs.ts`), con `legal.sampleBanner` arriba; «Condiciones» pasa a «Aviso legal» en el pie y `/legal/condiciones` redirige (308).
- **CSP y cabeceras de seguridad (REQ-ARQ-012)** en `next.config.ts` desde `lib/security-headers.ts`: CSP (`default-src 'self'`, imágenes https, PostHog, `frame-ancestors 'self'`, `object-src 'none'`…), nosniff, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP, HSTS. `script-src` lleva `'unsafe-inline'` (scripts en línea de Next) y `'unsafe-eval'` (PixiJS 8 compila con `new Function`; sin él /juego y la entrada no arrancan).
- **Estado por REQ (REQ-PRO-017)**: `docs/spec/estado.md` (294 REQ: HECHO 155 · PARCIAL 59 · FALTA 33 · L2 28 · final 19) y `tools/spec/estado.py`, que exige que cada HECHO enlace una prueba que nombre el REQ o cuyo título «…» exista; `tools/spec/test_estado.py` lo prueba. Primera versión generada (`--generar --mapa`), desde aquí a mano. `check.py` admite `estado.md` en docs/spec.
- **`pnpm test` corre también los comprobadores de Python** (`tools/spec/checks.sh`: `check.py`, `estado.py`, sus pruebas y `tools/blender/check.py`, REQ-MUN-031, ~1 min) cuando no se le pasa un filtro. `pnpm spec:estado`.
- **Documentos de traspaso (REQ-ARQ-024)**: `.env.example` (ninguna variable obligatoria), `README.md` (probar, cabeceras, entrega), `docs/manual-alvaro.md` (el Admin en llano), `docs/entrega.md` (lista de entrega y lo que falta para publicar), `docs/matriz-dispositivos.md` (16 casos de REQ-ARQ-016: 7 con e2e, 5 parciales, 4 a mano; registro de móviles de REQ-ARQ-017).
- «Textos y música» del Admin sigue listando sólo las claves de la landing (`LANDING_TEXT_KEYS`).
- Pruebas nuevas: `lib/i18n/zonas.test.ts` (el documento y el catálogo coinciden; las partes de la web dicen lo mismo que el entero), `lib/security-headers.test.ts`, e2e `entrega.spec.ts` (cabeceras en `/`, `/juego`, `/mar`, `/admin`; legales y redirección).

Comandos:
```
pnpm test --testTimeout=30000 && pnpm typecheck && pnpm lint && pnpm build   # exit 0; 101 archivos, 917 pruebas + checks de Python; landing 190,9 kB de 192
python3 tools/spec/estado.py                 # exit 0; HECHO 155 · PARCIAL 59 · FALTA 33 · L2 28 · final 19
E2E_PORT=<libre> pnpm e2e --workers=2          # exit 0; 204 passed, 36 skipped (14,7 min)
node apps/web/scripts/i18n-zonas.mjs         # tras cambiar textos-zonas.md
```

Pendiente / para otros encargos:
- Los diálogos de cada mundo (bocadillos de boies, Fiestera…) siguen en `packages/world/src/worlds/*/skin.ts`; sus claves `world.<mundo>.…` ya están en el catálogo, falta que el mundo las lea.
- Quitar `'unsafe-eval'` de la CSP importando `pixi.js/unsafe-eval` en `@boia/engine`; límites de peticiones, origen y repetición llegan con el servidor (D-20).
- Nombres de paletas de `/mar` (`app/mar/engine/palette.ts`) y textos de consola (`[boia] …`) no pasan por i18n.
- `docs/spec/estado.md`: 59 PARCIAL y 33 FALTA para repasar; varios piden revisión o medición en móvil.
- La matriz de dispositivos: áreas seguras, zoom, sin conexión y pérdida de contexto gráfico, a mano.

## 2026-09-30 — plan 004 T51: /mar al día con /juego (todo lo del plan 004) y el arte que faltaba tras el agujero negro

Qué existe:
- **Arreglo de `agujero-negro.spec.ts:77` en escritorio** (`packages/engine/src/game.ts`): el arte que faltaba no era del cambio de mundo, sino de antes. Junto al borde de abajo la cámara no baja más que una franja de tierra, así que en una pantalla ancha asoma más mundo por arriba del que el cargador por sectores (T47) pedía alrededor del barco (la boia de «Espacio», nueva de T45, sobre el puerto). Ahora el centro de la pantalla (con la cámara ya limitada) es también un punto de carga en cada fotograma, al arrancar, en un salto (`moveShip`) y al montar el mundo nuevo de un cambio de mundo. `data-arte-faltante` queda en 0 antes y después del vórtice.
- **Descuentos (T43) en /mar**: la ficha del código encontrado usa la `DiscountCard` de /juego (estado activo/usado/caducado, copiar, «Ir a la isla» / «Ir a la tienda» / «Ver el evento»). «Ir a la isla» hace `startVoyage` a la isla del evento del código (turbo, se puede «Saltar» o tomar el timón; con movimiento reducido llega de un salto) y al llegar abre la ficha del evento con «Tienes un código de descuento para este evento» (`EventDiscountBanner`) junto a «Comprar entrada»; el checkout de prueba lo aplica. Menú → **🏷️ Mis códigos** (ficha `codes`). Lógica sin React en `app/mar/voyage.ts` (`islandTrip`, `tripOutcome`); el viaje publica `data-testid="mar-viaje"` con `data-lugar`.
- **Ficha de isla y de evento (T42)** (`app/mar/sheet.tsx`, con las piezas exportadas de `juego/place-panels.tsx`): estado del evento con su etiqueta y su aviso (agotado, pospuesto, cancelado, recuerdo con cartel), «Ver el evento» (`/eventos/<slug>`), **«Ver fotos de la isla»** (`/fotos#<isla>`), recuerdos de la isla, «Próximos eventos» con los satélites sin isla («Calienta para el próximo All Day») y «Rumbo a su isla». El Puerto de Fotos lleva a `/fotos` (antes `/#fotos`). La vista previa de una isla también ofrece la ficha y sus fotos. La ficha publica `data-tipo`, `data-lugar` y `data-estado`.
- **Cambio de mundo por agujero negro (T41)**: menú → **Mundos** (el `MundosPicker` de /juego) y el mundo activo del Admin desde otra pestaña. `Mar3D.setWorld` usa `WorldSwitcher`/`SwitchTimeline` del motor (exportados ahora también por `@boia/engine/headless`) y `engine/vortex.ts` pinta la misma pose con three.js (la escena a una textura y un cuadro con el sombreador del vórtice centrado en el barco; con movimiento reducido, fundido de 300 ms con la foto del mundo de antes). Mismos lugares (D-20.7): cambian el runtime (nombres, diálogos), el color del mar, los rótulos y, si no hay barco elegido, el barco del mundo (propuesta de T40). Entrada bloqueada y barco quieto mientras dura; la misión sigue (`setWorld`). `main.mar` publica `data-mundo` y `data-cambio-mundo` (`vortice`/`fundido`); «Entre dos mundos…» mientras dura.
- **Boies informativas, delfín guía y «Explorar la isla» (T45)**: una boia nueva avisa «Boia encontrada · n de 6» (`recordBuoy`); el delfín es el `DolphinGuide` de /juego (2–4 min de mar abierto, `?delfin=<s>`, `data-delfin="guiando"`, premio si se le sigue); las islas ya descubiertas abren recogidas con «Explorar la isla».
- **Sonido (T46)**: `installAudioLifecycle` (desbloqueo en el primer gesto, pausa con la pestaña oculta) y el loop de ambiente del mundo (cambia con el mundo); whoosh al turbo, a «Entradas» y a «Ir a la isla»; golpe con `bump` según lo fuerte del choque (`Mar3D` → `onImpact`) y salpicadura en la proa (`Splash`).
- **Modelos de Blender por distancia (T47, T39)** (`engine/models.ts`): la mascota de BOIA como cada boia (primera, informativas, WhatsApp) y la Boia Fiestera se cargan cerca del barco con `planObjects` de `@boia/engine/streaming` (pide a 1600 u, suelta a 2600 u, `muestra`) y se descargan lejos (recuento de usos); mientras tanto y si fallan, la mascota hecha a mano. `data-modelos` cuenta los puestos.
- **Colores de la marca (T50)**: `palette.ts` y los tokens de `mar.css` son los de `globals.css` (#EC4F24, #FF5219, #36278A); texto negro sobre naranja en los botones (como la landing).
- **Posición e invitaciones (T44)**: la posición del barco de /mar se guarda aparte (`boia.mar.barco.posicion`, otra escala del mapa) con las funciones de `ship-position.ts` y se restaura al recargar; invitación al Carnet (`CarnetInvite`, `useCarnetInvitations`) tras comprar, al cerrar la galería y por progreso, nunca sobre ficha, diálogo, carrera, compra, viaje o cambio de mundo.
- «Ir en nave» y el vuelo de «Entradas» siguen igual.
- Pruebas: `app/mar/engine/models.test.ts`, `app/mar/voyage.test.ts`, `app/mar/engine/palette.test.ts`; e2e `mar-paridad.spec.ts` (390×844, móvil y escritorio): código del náufrago → «Ir a la isla» → aviso → compra con descuento → invitación → «Mis códigos» usado; «Saltar»; ficha de isla con «Ver fotos de la isla» hasta `/fotos#cala`; «Mundos» con vórtice y barco quieto, y fundido con movimiento reducido; boia informativa con su diálogo, «Boia encontrada» y modelo de Blender; delfín; posición al recargar. Capturas `docs/informes/img/p004-t51-*.png` (`RECORD_T51=1`).

Comandos:
```
pnpm test --testTimeout=30000 && pnpm typecheck && pnpm lint   # exit 0; 99 archivos, 910 pruebas
E2E_PORT=<libre> pnpm e2e --workers=2   # 198 pasan, 36 saltadas, 2 fallan (ver abajo)
RECORD_T51=1 E2E_PORT=<libre> pnpm e2e mar-paridad --project=mobile   # capturas
```

Pendiente / para otros encargos:
- `mar-3d.spec.ts:332` («la cámara en un móvil en vertical… también navegando») falla en móvil y escritorio **también en el plan-004 sin tocar** (probado: con el código de 277a440 da dy 0,12–0,13 > 0,1): con el vuelo de «Entradas» (experimento fuera del plan) el barco no queda centrado mientras vuela. No es de T51; hay que decidir si el vuelo se queda y ajustar la prueba o el encuadre del vuelo.
- Los secretos de /mar siguen con su arte hecho a mano (ánfora, círculo, destellos); el `secreto.glb` de T39 no se usa.
- El Admin en la misma pestaña no dispara el vórtice (como en /juego, propuesta de T41).
- Las animaciones declaradas por los comportamientos (T46) no se pintan en /mar; la sensibilidad de Ajustes no se aplica a /mar (no tiene Ajustes).
- El marco de la invitación al Carnet en /mar lleva a `/carnet` (no hay Carnet dentro del mar 3D).

## 2026-09-30 — plan 004 T40: economía de barcos, tienda «Barco» con monedas y barco por puntos

Qué existe:
- **Todo bloqueado menos B05 Arcilla y B02 Acuarela** (D-23 punto 1, O5; precios `muestra`): el catálogo de cosméticos (`SAMPLE_COSMETICS`) tiene los 8 barcos de estilo (`barco-<estilo>`) y las skins noche y fiesta de 7 de ellos (`skin-<estilo>-<skin>`, 150 🪙; B01 Boceto sólo base). B03 Low-poly 300 🪙, B06 Cartoon años 30 400 🪙, B04 Semi-realista «El Veterano» al llegar a 1500 puntos (umbral: no se gastan ni se escribe nada en el libro), B07/B01/B08 por logro (T36, bloqueados hasta reclamar). Esquema del cosmético con `base`, `unlockPoints` y `forShip` (la skin necesita su barco).
- **Store v7** (migración v6 → v7): lo que el visitante llevaba (preferencia `barco` de /juego: estilo y skin) sigue siendo suyo con una fila `cosmetic` a 0 monedas (`sourceRef: migration:v7`) y queda equipado; los barcos de logro sin reclamar no se regalan. Saldos intactos.
- **API**: `progress.shop()` (cada cosmético con `owned`, `equipped`, `unlock` base/points/achievement/coins, `missing` y `canBuy`), `ships()` con `base` y `unlockPoints`, `buyCosmetic` (una fila del libro, idempotente; `insufficient_coins`, `forbidden` si no se vende o la skin no tiene su barco), `equip` (una skin equipa su barco; un barco quita la skin de otro). Saldos siempre derivados del libro.
- **Tienda «Barco»** (`lib/barco/shop.tsx`, `shop-model.ts`, `shop.css`), la misma en la sección ⛵ Barco del Menú de a bordo de /juego y en /mar (menú → «⛵ Barco» abre la hoja `mar-tienda`): cada barco con miniatura y su precio o condición («te faltan N monedas/puntos», «Se gana con el logro «…»»), comprar con confirmación (`barco-confirmar`, Escape cancela), equipar, lo propio marcado («De serie», «Tuyo», «Equipado»); skins del barco que se lleva, bandera y estela.
- **Aspecto al entrar** (`resolveLook`, `app/juego/ship-look.ts`): `?estilo=` si es tuyo, lo equipado en el repositorio, lo elegido antes de la tienda (claves `boia:estilo-barco`/`boia:skin-barco`) si es tuyo, y si no el barco del mundo. Un `?estilo=` bloqueado no se pone. El estilo «muestra» (Toon de antes de T17) ya no se ofrece.
- **Bandera y estela pintadas**: /juego (Pixi) pone la bandera en `mast_top` de cada vista ondeando hacia popa (`packages/engine/src/ship/dressing.ts`, `ShipSprite`) y tiñe la espuma (`WakeView.sync(wake, tint)`); /mar (three.js) cuelga la bandera del punto más alto del modelo y tiñe `Wake` (`setShipDressing`). /mar carga la skin del glTF (`loadShipModel(entry, skin)`). Colores en `lib/barco/dressing.ts` (`muestra`). `#juego` y `main.mar` publican `data-ship-style/skin/flag/wake`.
- `catalog.ts`: B05 y B06 ya no recortan skins (T39 las hizo); B01 sigue sólo base.
- Pruebas: `packages/store/src/economy.test.ts` (visitante nuevo = B05 + B02; doble confirmación cobra una vez; sin monedas no compra; B04 a los 1500 puntos sin gastarlos; skin sin barco; v6 → v7), `apps/web/lib/barco/shop-model.test.ts`, `physics.test.ts` (REQ-IDE-032: misma vuelta al circuito y mismos choques con cualquier barco, skin, bandera o estela), `catalog.test.ts` (render de la tienda). e2e `tienda.spec.ts` (gana «Primera boia», compra barco y bandera con confirmación, equipa, recarga; en /juego y /mar) y `demo.spec.ts` «Barco» otra vez en verde. Capturas `docs/informes/img/p004-t40-tienda.png` y `p004-t40-barco-equipado.png` (`RECORD_T40=1`).

Comandos:
```
pnpm test --testTimeout=30000 && pnpm typecheck && pnpm lint   # exit 0; 96 archivos, 896 pruebas
E2E_PORT=<libre> pnpm e2e --workers=2
RECORD_T40=1 E2E_PORT=<libre> pnpm e2e tienda --project=mobile -g juego   # capturas
```

Pendiente / para otros encargos:
- El accesorio `farolillo` (40 🪙) sigue en el catálogo pero la tienda no lo ofrece: no hay arte ni sitio donde pintarlo.
- REQ-IDE-030 pide además «cambiar el color desde el principio»: no hay cosmético de color todavía.
- Banderas y estelas se pintan con colores de código (`muestra`); cuando haya arte de Blender, sustituir `FLAG_LOOKS`/`WAKE_TINTS`.
- `lib/logros/use-logros.ts` (`useShipLocks`, `lockedShipText`) ya no lo usa nadie; se puede borrar.
- Los precios salen de `muestra` y la economía entera espera el visto bueno de Álvaro (D-23).

## 2026-09-29 — plan 004 T45: ranking local, moderación de Carnets, seis boies, delfín guía, «Explorar la isla» y destino de la Fiestera

Qué existe:
- **Ranking local** (REQ-IDE-053, D-23 punto 8): `repo.progress.ranking({ season? })` junta al visitante de este navegador (puntos del libro, nunca monedas; por temporada, `seasonPoints` del mundo) con los miembros `muestra` (`SAMPLE_CREW[].showcase.points` y `seasonPoints` nuevos), por puntos, con puestos compartidos en el empate y la fila propia siempre dentro. Sección 🏆 **Ranking** del Menú de a bordo (`menu/sections/ranking.tsx`): rótulo «Ranking local de este navegador», «De siempre» / «Esta temporada · <mundo>», «Vas N.º con P puntos.», fila propia destacada (`aria-current`), cada fila abre su Carnet (la propia sin Carnet, `/carnet`). Textos de textos-zonas zona 25 en `RANKING_COPY` hasta T49.
- **Reporte y moderación de Carnets** (REQ-ADM-040, O9): `repo.carnet.report(userId, motivo)` (una vez por persona y Carnet; el propio no); «Reportar este Carnet» en `/carnet/<id>` y en la hoja del Carnet de una botella (`juego/carnet/carnet-report.tsx`). En el Admin, **Moderación → Carnets reportados**: motivos, «Ocultar respuesta» por pregunta, «Ocultar foto», «Restablecer apodo» («Miembro de BOIA <n>», fijo por persona) y «Descartar el reporte», con motivo obligatorio para retirar; todo en la auditoría (área `carnets`, acciones `moderate` y `resolve_report`) y sin borrar el Carnet. Lo retirado guarda el contenido que se retiró: si el dueño escribe otra cosa, lo nuevo se ve.
- **Seis boies** (O12, REQ-AVE-040): cinco boies informativas en el mapa compartido (`INFO_BOIES` en `packages/world/src/worlds/arcilla/map.ts`: `boia-espacio`, `boia-descubrir`, `boia-pertenecer`, `boia-allday`, `boia-secretos`) junto a la ruta principal de mapa.json, cada una dentro del sector de su tramo, al final de la lista de lugares (no cambia el orden de los demás). Hablan por proximidad (una vez) con el nombre y los dos bocadillos de cada mundo (textos-zonas zona 23) y disparan `find_boia`. Logro nuevo **`boies-6` «Las seis boies»** (60 pts + 20 monedas, `muestra`); al hablar con una boia nueva sale «Boia encontrada · n de 6».
- **Arte de T39 en el mapa**: la primera boia, la de WhatsApp y las cinco informativas usan `boias#primera|whatsapp|info_1…5`; los cuatro secretos, `secreto#secreto` (ya no hay marcadores `placeholder:`). `boias` y `secreto` pasaron de `extras` a `lugares` en `tools/blender/lugares.json`.
- **Delfín guía** (O15, REQ-AVE-018; `DolphinGuide` en `apps/web/app/juego/encounters.ts`): escondido en su sitio de descanso (ahora `oculto`: ni minimapa ni brújula), tras 2–4 min de mar abierto (lejos de todo radio de proximidad, sin panel, diálogo, carrera, minijuego ni viaje) asoma junto al barco, da 3 saltos hacia lo más cercano sin descubrir (secreto, cofre, isla, náufrago o boia) sumergiéndose entre salto y salto, y se va. Seguirlo hasta el final da sus monedas (una vez al día) y el logro `delfin`. `?delfin=<s>` lo adelanta a esos segundos; `/juego` publica `data-delfin="guiando"`. `/mar` sigue con el delfín de rastro fijo (`DolphinTrail`, intacto).
- **«Explorar la isla»** (REQ-AVE-013): en una visita posterior (isla descubierta en otra visita o panel ya cerrado en ésta) el panel de isla sale recogido con el acceso directo «Explorar la isla» (`data-visita="otra"`, testid `isla-explorar`), que despliega relato, recuerdos, fotos y próximos eventos. La primera llegada lo enseña todo, como antes. Las islas de evento no cambian.
- **Destino de la Fiestera por mundo** (REQ-AVE-010, REQ-AVE-011): store v6 con `content.missionDestinations` (mundo → misión → lugar), `repo.admin.missionImpact` y `setMissionDestination(…, { migrate, reason })`. Sección nueva del Admin **Destino de la Fiestera** (`/admin#mision`): mundo, isla de destino (sólo islas activas, sin minijuego y con radio de llegada) o «el del mapa», vista previa de partidas empezadas/afectadas/terminadas, y «Migrar también las partidas empezadas» con motivo, una entrada de auditoría (`missions`, `migrate`) por partida. Las terminadas no cambian nunca. No se guarda una misión sin destino: `lib/admin/validate.ts` (`missionDestinationProblem`) compone el mundo y exige que `rescueMissionOf` salga con ese destino; ocultar en un mundo la isla destino también se rechaza. En /juego, `liveWorld` aplica el destino del mundo (`withMissionDestinations`: la marca pasa a la isla nueva con el premio y un sitio al sur; la anterior conserva su premio para las partidas empezadas hacia ella).
- **Store v6** (migración v5 → v6: reportes y moderación de Carnets vacíos, ningún destino fijado; nada cambia). Área `missionDestinations` en «Volver a la muestra».
- Pruebas: `packages/store/src/community.test.ts` (orden y puesto del ranking, temporada, empates; reporte que aparece en Moderación; ocultar respuesta/foto/apodo auditado; destino y migración; v5 → v6), `apps/web/lib/admin/community.test.ts` (misión sin destino rechazada, destino por mundo, vista previa y migración auditada, moderación con motivo), `apps/web/app/juego/boies.test.ts` (seis boies con arte y textos por mundo, en sector y alcanzables, «Las seis boies» completada con las señales del mundo), `apps/web/app/juego/encounters.test.ts` (delfín: 2–4 min, sólo mar abierto, saltos hacia el objetivo, seguido o no); e2e `comunidad.spec.ts` (ranking con el visitante, reportar y ocultar desde el Admin, boia que habla «n de 6», «Explorar la isla»). Capturas `docs/informes/img/p004-t45-ranking.png` y `p004-t45-boia-info.png` (`RECORD_T45=1`).

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint   # exit 0
pnpm world:check                           # exit 0: boies y secretos con arte en los dos mundos
RECORD_T45=1 E2E_PORT=<libre> pnpm e2e comunidad --project=mobile   # capturas
```

Pendiente / para otros encargos:
- `/mar`: sus boies informativas, el delfín guía y «Explorar la isla» esperan a que el plan 003 deje `/mar` (sigue con `DolphinTrail`).
- Los textos del ranking, del reporte y de la moderación van en constantes (`RANKING_COPY`, `CARNET_REPORT_COPY`) hasta que T49 los pase a i18n.
- La animación «habla» de las boias (T39) no se usa todavía: el motor pinta `idle` (T46 añade animaciones por comportamiento).

## 2026-09-29 — plan 004 T41: cambio de mundo por agujero negro

Qué existe:
- **Vórtice en /juego** (D-23 punto 4, inventario §1.4): al cambiar de mundo, el mar y las islas se enroscan y caen hacia un agujero negro centrado en el barco (1 s), la pantalla queda a oscuras (mínimo 150 ms, y hasta que el mundo nuevo tiene cargado el arte del sector del barco: reutiliza `buildWorld` → `SectorStreamer.settle` de T47) y el mundo nuevo se despliega desde el mismo punto (1 s), siguiendo el giro. Cada lugar queda donde estaba (mapa compartido, D-20.7); el barco, su rumbo, su pasajera, la misión y el progreso siguen. Sólo cambian renders, nombres y diálogos.
- **Movimiento reducido**: sin vórtice; el mundo de antes sigue en pantalla mientras carga el nuevo y luego una foto suya se funde sobre él en 300 ms (la foto se destruye al acabar).
- **Motor** (`packages/engine/src/transition/`, módulo nuevo): `timeline.ts` (`SwitchTimeline`: fases `in`/`dark`/`out`, pose del vórtice, sin Pixi), `switcher.ts` (`WorldSwitcher`: pide el mundo nuevo mientras cae, lo pone a oscuras, destruye el que llega tarde; un solo mundo en escena), `vortex-view.ts` (filtro GLSL sobre un contenedor `scene` = mar + mundo, sin tocar bocadillo ni joystick; sin WebGL, la escena gira y se encoge). En `game.ts`, `setWorld(world, { sea, transition: 'vortex' | 'fade' })` va por el `WorldSwitcher`; `Game.switching`, `GameOptions.onSwitch(mode | null)` y `GameStats.view` (dónde queda en pantalla el origen del mundo).
- **Entrada bloqueada** mientras dura: la simulación no avanza (el barco no se mueve aunque se acelere), el bocadillo y el joystick se esconden y el teclado del diálogo no cuenta; en /juego, una capa transparente (`data-testid="cambio-mundo"`, `role="status"` «Cambiando de mundo…») no deja tocar el HUD. `#juego` lleva `data-cambio-mundo="vortice|fundido"` y `data-vista`.
- **Disparadores**: menú «Mundos» (se cierra al elegir, para ver el vórtice) y el **mundo activo del Admin**: /juego se suscribe al repositorio y, si cambia el contenido (el Admin en otra pestaña), pasa al mundo que toque por el agujero negro (sólo si el visitante no eligió mundo ni lo trae en `?mundo=`). Dos cambios seguidos (también A→B→A) acaban en el último pedido.
- Pruebas: `transition/switcher.test.ts` (reloj del vórtice y fundido; dos cambios seguidos → último mundo y una sola escena; cambio durante el despliegue; fallo de carga reabre el de antes; el barco y cada lugar siguen donde estaban y la entrada vuelve al terminar). e2e `agujero-negro.spec.ts` (Mundos, Admin en otra pestaña y movimiento reducido: mismo barco, mismo lugar en el mismo píxel, arte sin faltar); `mundo-acuarela.spec.ts` al día (el menú se cierra al elegir). Grabación: `RECORD_AGUJERO=1 pnpm e2e record-agujero.spec.ts --project=mobile --workers=1` → `docs/informes/img/p004-t41-agujero-negro.{webm,png}`.

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint   # exit 0; 84 archivos, 826 pruebas
E2E_PORT=<libre> pnpm e2e --workers=2      # ver el informe de la tarea
```

Pendiente / para otros encargos:
- **/mar** (fuera por plan 003): el mismo cambio en three.js. Propuesta: un `ShaderPass` de post-proceso (EffectComposer) con el mismo remolino (`angle`, `pull`, `hole`, `dark` de `SwitchTimeline.pose()`, importable sin Pixi desde `packages/engine/src/transition/timeline.ts`) centrado en la proyección del barco; o, sin post-proceso, girar y hundir la escena alrededor del barco. Cambiar de mundo allí debe bloquear la entrada y cargar las texturas del mundo nuevo antes de abrir, soltando las viejas (`dispose`). Hará falta exportar `timeline` en `package.json` de engine (p. ej. `./transition`).
- El Admin de la misma pestaña no dispara el vórtice (al volver a /juego se monta con el mundo nuevo, sin transición); sólo con /juego abierto en otra pestaña.
- Con el vórtice, el aviso «Entre dos mundos» (logro de visitar otro mundo) sale a oscuras; si se prefiere, retrasarlo al final de la transición.

## 2026-09-29 — plan 004 T46: sonido, estela y tacto de los controles

Qué existe:
- **Audio sólo tras el primer gesto** (`app/juego/sound.ts`): no se crea ningún `AudioContext` ni suena nada hasta el primer toque, clic o tecla (`installAudioLifecycle`, montado en `/juego`). El desbloqueo reanuda el contexto y hace sonar un búfer mudo dentro del gesto (iOS). Con la pestaña oculta el contexto se suspende y los efectos no se acumulan; al volver sigue. Una pantalla sin el ciclo de vida (`/mar`) se desbloquea sola en el primer efecto si la página ya tuvo un gesto (`navigator.userActivation`), así `/mar` no pierde sus sonidos.
- **Ambiente por mundo** (`app/juego/ambient.ts`, O10, `muestra`): loop de 16 s generado en el navegador (pad de cuatro acordes, bajo, campanas pentatónicas y oleaje de ruido filtrado) con tónica, progresión y campanas sacadas del id del mundo; empalma sin chasquido. Suena en el canal de música al 30 % (`AMBIENT_LEVEL`) sólo si la música está activa; cambia con fundido al cambiar de mundo y se calla al salir de `/juego` (la landing no suena).
- **Efectos**: «ping» al recoger, WHOOSH en cada boost, golpe al chocar con costa o roca (fuerza según la velocidad del choque, mínimo 40 u/s, uno cada 0,35 s). `SOUNDS`/`playSound` cubren todo `FEEDBACK_SOUNDS`.
- **Sonido y animación declarables** (REQ-PRO-011, `packages/world/src/behaviors.ts`): los comportamientos con efecto visible (colisión, proximidad, recogible, recompensa, contenido, ticket, checkpoint, teletransporte, logro, minijuego) admiten `sound` (`ping`, `whoosh`, `bump`, `plop`, `chime`, `fanfare`) y `animation` (`pop`, `bounce`, `shake`, `spin`, `pulse`). `app/juego/feedback.ts` (`feedbackFor`) decide qué suena con cada evento: lo declarado manda; si no, el de serie.
- **Estela reactiva** (REQ-MUN-004, `packages/engine/src/wake.ts`): además de velocidad y drift, crece girando (hasta +60 % a 2,4 rad/s, espuma más abierta), con boost (velocidad por encima de la máxima: más intensa y más larga) y salpica al chocar (anillo de espuma y extra de 0,4 s). Todo sale de lo que el barco hace paso a paso: un frenazo normal, acabar un boost o un teletransporte no salpican. `reading()` da intensidad, giro, boost y golpe.
- **Golpe en el barco**: `collideShip` deja en `ShipState.impact` la velocidad del choque (la vuelve a 0 `stepShip`); `/juego` la lee en `onStep` para el sonido.
- **Sensibilidad** (REQ-MUN-008): Controles tiene «Sensibilidad del giro» para teclado y táctil (50–150 %, testid `sensibilidad`), guardada en `Settings.sensitivity`. `ShipInput.turnScale` multiplica el giro del casco; `readShipInput` lo pone según de dónde venga la entrada. La aplica `setControlSensitivity` (estado del módulo de controles: la interfaz la cambia sin tocar la partida).
- **HUD** (O11, REQ-PRO-009): la caja de fps y velocidad sólo se ve con `?debug` (`hudLayout(vp, zona, { debug })`). Sin él el nodo `data-testid="hud"` sigue en el DOM con `hidden` (fuera de la vista y del lector de pantalla): las pruebas e2e lo siguen usando para saber que el motor corre.
- Pruebas: `wake.test.ts` (giro, boost y choque suben la estela de forma distinta; frenar, acabar un boost y teletransportarse no son choque), `controller.test.ts` (`impact`, `turnScale` escala el giro), `controls.test.ts` (sensibilidad por fuente y más sensibilidad gira antes), `hud-layout.test.ts` (sin `?debug` no hay caja), `minimap.test.ts` (sensibilidad guardada y recortada), `app/juego/sound.test.ts` (sin audio antes del primer gesto; desbloqueo con ambiente; música apagada; pestaña oculta; todos los sonidos de serie suenan), `ambient.test.ts`, `feedback.test.ts`. e2e `juego-hud.spec.ts`: sin caja de fps sin `?debug`, sin `AudioContext` antes del primer toque, sensibilidad guardada.

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint   # exit 0; 78 archivos, 766 pruebas
E2E_PORT=<libre> pnpm e2e --workers=2      # ver el informe de la tarea
```

Pendiente / para otros encargos:
- **`/mar`** (fuera por plan 003): ni ambiente ni ciclo de vida del audio (pausa con la pestaña oculta), ni WHOOSH en su turbo, ni golpe al chocar; su estela (`app/mar/engine/effects.ts`) no reacciona a choques. Hace falta `installAudioLifecycle()` + `setAmbientWorld(<mundo>)` en `mar-client.tsx`, `whoosh()` al pulsar el turbo, `bump()` en el choque de `mar3d.ts` y el mismo criterio de salpicadura en su `wake.update`.
- **Animaciones declaradas**: el esquema las admite y `feedbackFor` las devuelve, pero nadie las pinta aún: falta que `ObjectView` (`packages/engine/src/world/object-view.ts`, zona de T47) reproduzca `pop`/`bounce`/`shake`/`spin`/`pulse` sobre el objeto.
- **Sensibilidad por la partida**: ahora vive en el módulo de controles; si algún día hay dos juegos en la misma página, pasarla a `Game.setSensitivity` en `game.ts` (fuera de alcance por T47).
- La estela deduce el golpe de la velocidad (no recibe `ShipState.impact` porque el emisor lo arma `game.ts`): entrar en una zona de ralentizar o frenar también salpica, y el primer paso del viaje automático («Ir a la isla») también. Pasar `impact` desde `game.ts` lo haría exacto.
- El ambiente y los efectos son sintetizados y `muestra` hasta las pistas con licencia (P18); la música que sube el Admin (T48) no suena todavía.

## 2026-09-29 — plan 004 T47: el mundo se carga por sectores

Qué existe:
- **Carga por sectores en /juego** (REQ-MUN-012, `packages/engine/src/world/sectors.ts`, sin Pixi): cada objeto es del sector del mapa que contiene su posición (o del más cercano; sin sectores, todo el mapa es uno). Se pide el arte de un sector cuando su rectángulo, ampliado con media pantalla + `preload` (1400 u), toca el barco o dos puntos por delante según su velocidad vista en pantalla (1,5 s, también la de viajes y llegadas que mueven el barco con `moveShip`); se suelta más allá de `release` (3000 u) y como mucho quedan `maxSectors` (6; 3 en calidad baja), soltando antes lo más lejano. Las vistas de los objetos se crean y destruyen por su posición de ese momento (los restos y cofres que reaparecen en otro sitio se cargan donde estén). La simulación no depende de ello.
- **Motor** (`world/streamer.ts`, `world/texture-store.ts`, `game.ts`): `SectorStreamer` pide primero las hojas de atlas de los sectores y luego las vistas; `TextureStore` cuenta usos de hojas y PNG y descarga (GPU y caché de Assets) lo que nadie usa. Antes de jugar se carga sólo lo de alrededor de donde empieza el barco: `createGame({ start, preload })` recibe el punto de `?cerca=`, `?ir=` (y su destino) o la posición guardada, así nunca se carga el puerto para nada. Tras un salto (`moveShip` ≥ 1500 u) la imagen se queda quieta hasta que el arte del destino está (como mucho 2,5 s). `Game.preload(points)` retiene puntos 30 s. Las costas siguen enteras (losas que se repiten) pero salen como WebP.
- **Atlas por sector** (`tools/atlas/build.ts`, `pnpm atlas`): por mundo y sector, hojas WebP (≤ 2048 px, sprites recortados a lo opaco) en `alta` (q90) y `baja` (media resolución, `meta.scale` 0.5: Pixi los ve del tamaño original); costas como WebP sueltos. Escribe `apps/web/public/atlas/` (ignorado por git) con `index.json`; no rehace nada si la huella de las fuentes no cambió (~13 s en frío, 1 s al día). Corre solo antes de `pnpm dev`, `pnpm build`, `pnpm demo` y del servidor de la e2e (`scripts/atlas.mjs`; si falla deja un índice vacío y el motor usa los PNG de `/api/art`). Arcilla: 561 kB todas las hojas alta (6,8 MB de PNG), costas 116 kB; Acuarela 787 kB y 213 kB.
- **Calidad baja** para dispositivos débiles (`detectQuality`: ahorro de datos, `deviceMemory` ≤ 2, táctil con ≤ 4 núcleos o textura máxima < 4096): hojas a media resolución, sin retina, menos sectores en memoria. `?calidad=baja|alta` la fuerza.
- **Viajes sin arte de golpe**: el piloto automático (`?evento=&piloto=1` y el nuevo `?piloto=<lugar>`, a cualquier lugar) pide el primer tramo de la ruta y el destino (`voyagePreload`) y sale cuando está (como mucho 1 s; la barra «Rumbo a…» sale ya).
- **Presupuesto** (REQ-ARQ-014, `apps/web/scripts/world-budget.mjs`, `pnpm world:budget`, también al final de `pnpm build`): bytes de arte antes de jugar por mundo con el barco en el puerto (hojas o PNG, costas, manifiestos y el barco del mundo), falla si pasa de 5 MB. Con atlas: Arcilla 1,2 MB, Acuarela 1,8 MB (el barco es ~70 %); sin atlas (`--png`): 3,5 y 4,2 MB.
- `/juego` publica `data-sectores`, `data-arte-cargando`, `data-calidad` y `data-arte-faltante` (fotogramas con algún objeto a la vista sin su arte; tiene que quedarse en 0).
- Pruebas: `sectors.test.ts` (sector del spawn, histéresis, límite de memoria, mirada por delante, objetos movidos, y del puerto a la última isla a 1440×900 y 360×640 sin ningún objeto a la vista sin arte: en 6 s con 0,4 s de carga por vista y a 220 u/s con 1,5 s), `atlas.test.ts` (empaquetado sin solapes, varias hojas, índice), `world-budget.test.ts` (≤ 5 MB sin atlas, con atlas pesa menos); e2e `sectores.spec.ts` (sólo el puerto antes de jugar, ≤ 5 MB transferidos contando HTML y JS, hojas y no PNG; del puerto a la última isla con el piloto: la última cargada, el puerto soltado, `data-arte-faltante` 0; calidad baja con hojas `baja`).

Comandos:
```
pnpm atlas                                 # atlas por sector en apps/web/public/atlas
pnpm world:budget                          # bytes antes de jugar por mundo; exit 1 si > 5 MB
pnpm test && pnpm typecheck && pnpm lint   # exit 0
E2E_PORT=<libre> pnpm e2e --workers=2      # ver el informe de la tarea
```

Pendiente / para otros encargos:
- `/mar` sigue cargando todos sus glTF al entrar (fuera de alcance mientras trabaja el plan 003): ver OUT OF SCOPE del informe.
- El barco (8 vistas × con y sin pasajera, PNG) es la mayor parte de lo que baja antes de jugar: pasarlo a atlas WebP ahorraría ~700 kB por mundo.
- La memoria en el dispositivo mínimo (REQ-MUN-012) y los umbrales `muestra` de `STREAM_TUNING` se miden cuando haya dispositivos de referencia (P6).

## 2026-09-29 — plan 004 T48: Admin endurecido

Qué existe:
- **Borrador y «Publicar»** (REQ-ADM-015, REQ-ADM-017): la home y los eventos tienen borrador en el repositorio (`content.drafts`, áreas `DRAFT_AREAS = homeBlocks, events` más los textos de la portada). `repo.admin.draftUpsert/draftReorder/draftText/draftList/draftHome/draftTexts/pendingDrafts/publish/discardDrafts`; `content.*` (landing, /juego, /mar) sólo da lo publicado. `publish` pasa todo de una vez y sube `content.revision`. **Página principal** edita siempre el borrador: orden, visible, programación, titular y subtítulo, **botones «Explorar» y «Tickets»** (textos `hero.explore`/`hero.tickets`, hasta 40 caracteres), evento prioritario y **eventos excluidos** de «Próximos eventos» (`excludeEventIds`, no borra). **Eventos**: «Guardar borrador» (`evento-borrador`) o «Guardar y publicar» (`evento-guardar`, como antes); cambiar el estado desde la lista publica y el borrador lo recoge (`setEventStateManual`). Barra del borrador (`DraftBar`, testid `borrador`, `data-pendientes`) en las dos secciones, con vista previa privada **`/admin/vista-previa`** (la home del borrador con los bloques de la landing; el iframe móvil/escritorio también la usa), «Publicar» y «Descartar borrador».
- **Publicar se bloquea** (REQ-ADM-014) con la lista de motivos si hay referencias rotas (`lib/admin/references.ts`, `danglingReferences`: evento prioritario, álbum del bloque de fotos, artistas e isla de un evento, evento y escondite de un descuento, álbum/portada/isla de fotos, premio y temporada de un logro, y en el mapa vivo tickets, paneles, códigos y logros que ya no existen), si la portada no se ve o si con los eventos del borrador el mar no se juega.
- **Borrar con impacto y nombre** (REQ-ADM-029): `DeleteButton` (testid `borrar-<área>-<id>`) en eventos, descuentos, artistas, fotos, logros y música: enseña qué lo nombra (`referencesTo`: home, mapa, eventos, descuentos, fotos, logros y lo de este navegador) y sólo borra escribiendo el nombre exacto (`actions.trashItem`). Un evento que sólo existe en borrador se descarta.
- **Papelera con plazo y purga** (REQ-ADM-030): `content.settings.trashRetentionDays` (30 por defecto, 1–365, [pendiente Álvaro]); `repo.admin.trash/purge/purgeExpired/settings/setSettings`. Lo caducado se purga solo en el siguiente cambio de la papelera; purgar deja una marca sin contenido (un elemento de la muestra no vuelve) y `restore` lo rechaza. Sección nueva **Papelera** (`/admin#papelera`): plazo, lista de todas las áreas con «Recuperar» y «Purgar» (pide escribir otra vez el nombre: en la demo no hay login con el que reautenticarse) y «Purgar lo caducado». Las listas «recuperar …» de cada sección salen de `trash()` (`TrashInline`).
- **Logros** (REQ-ADM-021, REQ-ADM-022): formulario de crear y editar con condición del catálogo y sus parámetros con rango (`lib/admin/achievements.ts`, `TRIGGER_PARAMS`, `triggerParamsProblem`; circuitos, minijuegos y mundos que existen), puntos, monedas, premio, icono (`ACHIEVEMENT_ICONS`, `muestra`), ámbito global/temporada, fechas, secreto y activo; «Duplicar» (copia desactivada); borrar con impacto. El repositorio pone la versión: cambiar disparador o parámetros sube `version`; lo demás la conserva; uno nuevo empieza en 1.
- **Validaciones del mundo** (REQ-ADM-013, REQ-ADM-014, `lib/admin/validate.ts`): `PARAM_RANGES` (radio de proximidad, remolino, vaivén, cocodrilos, premio de la entrega, monedas de encuentro, versión del circuito) y puntos dentro del mapa; misión sin destino (`missionProblem`); circuito sin salida, con menos de dos arcos o con huecos (`circuitProblem`). Rechazo con su motivo, sin guardar nada.
- **Música con licencia** (REQ-ADM-020): área nueva `music` (`musicTrackSchema`: título, ambiente/efecto, mundo, data URL `data:audio/…` hasta ~1 MB, licencia, origen, enlace; siempre `sample: true`). En **Textos y música**: subir pista, escucharla, borrarla. El juego sigue con su loop generado (O10).
- **Auditoría de compras y sellos** (REQ-ADM-007): `confirmSandbox` anota la compra (`purchases/purchase`) y el sello (`ledger/stamp`) con el visitante como autor. La auditoría del Admin traduce áreas y acciones.
- **Migración v4 → v5** (`SCHEMA_VERSION = 5`): borrador vacío, revisión 0, plazo de 30 días, y las compras y sellos que ya había pasan a la auditoría («anotada al migrar (v5)»), sin duplicar.
- **`docs/manual-admin.md`**: cómo publicar, borrar, papelera, logros, validaciones y música, y el **procedimiento a mano para peticiones de datos** (REQ-ADM-031): descarga, eliminación y retirada de contenido, en la versión de prueba y con Supabase.
- Pruebas: `packages/store/src/admin-hardening.test.ts` (borrador invisible hasta publicar, papelera y purga por plazo, rango del plazo, versiones de logro, compras y sellos en la auditoría, migración v4 → v5), `apps/web/lib/admin/hardening.test.ts` (borrar exige el nombre exacto, impacto, borrador invisible en `resolveHome` hasta publicar, exclusión, publicación bloqueada por referencia rota o sin portada, parámetro fuera de rango con su motivo, misión sin destino, circuito sin salida, logros de la muestra en su catálogo, crear/duplicar/versionar, música). e2e `admin-endurecido.spec.ts` (borrador → landing sin cambios → vista previa → publicar; borrar con impacto y nombre, purgar; rango del remolino) y `admin.spec.ts` publica el borrador tras mover los bloques.

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint   # exit 0; 71 archivos, 716 pruebas
E2E_PORT=<libre> pnpm e2e --workers=2      # ver el informe de la tarea
```

Pendiente / para otros encargos:
- **Moderación de Carnets** (REQ-ADM-040) no existe aún; el manual la cita como pendiente.
- La sección **Textos** sigue publicando al momento (incluidos `hero.explore`/`hero.tickets`): si se quiere, pasar también los textos de la home al borrador desde allí.
- Restaurar una revisión anterior (REQ-ADM-016) no está: `publish` guarda en la auditoría el antes y el después de cada revisión, que es lo que haría falta para volver atrás.
- La música subida no suena en el juego: `/juego` y `/mar` siguen con el loop de cada mundo (O10) hasta que haya pistas con licencia (P18); enchufarla toca `app/juego` y `/mar`.
- Los iconos de logro (`ACHIEVEMENT_ICONS`) son claves sin arte: el menú de logros de /juego no los pinta todavía.

## 2026-09-29 — plan 004 T44: la landing que te lleva en barco: accesos, cabecera, pie e invitaciones al Carnet

Qué existe:
- **Abrir /juego en un lugar** (`lib/world-handoff.ts`): `placeHref(lugar, { eventId })` → `/juego?ir=<lugar>[&evento=<id>]`, `readPlaceRequest`, `withoutPlaceRequest`. Es la entrada genérica «ir a la isla» (T43 puede usarla para las tarjetas de descuento).
- **Llegada sin conducir** (`app/juego/arrival.ts`, REQ-ENT-034, REQ-AVE-022): con `?ir=`, el barco entra navegando 1,6 s (`ARRIVAL_RUN` 720 u, frena al final; una tecla o un toque lo saltan; con movimiento reducido aparece ya allí) hasta el punto seguro del lugar (al sur, fuera de todos sus radios: sin premios, visitas ni descubrimientos, REQ-ENT-039) y abre su panel: galería del Puerto de Fotos, escaparate de la tienda o el evento de la isla (el de `evento=` si existe, con la compra visible). Cerrar el panel deja el barco allí. Al llegar se quita `ir` de la URL: una recarga no repite el viaje. `approachPoint` (el de `?cerca=`) vive ahí ahora. `/juego` publica `data-barco="x,y"` y `data-llegada` (`navegando` o el id del lugar).
- **Accesos de la landing**: el HTML sigue igual (Tickets abre su panel, Fotos y Tienda son secciones; sin JS nada cambia). Con JS aparece además «⛵ Ir en barco…»: en Fotos (junto a «Ver todas»), en Tienda y en el panel de Tickets («Ver su isla en el mar», a la isla del evento destacado o, si es un satélite sin isla, la localización común, `HomeView.ticketsIsland`). Es el sector navegable bajo demanda de REQ-ENT-038. Ids y textos en `lib/landing/access.ts`.
- **Cabecera** (REQ-ENT-029, O13): Mi Carnet (`/carnet`), Instagram y el interruptor de sonido (`sound-toggle.tsx`, `lib/landing/sound-pref.ts`): apaga o enciende música y efectos a la vez en `boia.ajustes`, los ajustes de /juego y /mar; la landing no suena (O10). En móvil van en «Menú»; en escritorio, en la fila (el sonido como icono).
- **Pie** (REQ-ENT-032): invitación voluntaria «¿Aún sin Carnet?… Crear mi Carnet» (`/juego?menu=carnet`) y «Entérate antes que nadie… Entrar en el WhatsApp» (URL `muestra` del bloque de contacto), sin formulario. Instagram sigue en los enlaces oficiales. `HomeView.social` saca Instagram y WhatsApp de los enlaces del contenido.
- **Invitaciones al Carnet** (REQ-IDE-008/009): `lib/landing/invitations.ts` (lógica pura y textos de textos-zonas, zona 24), `app/juego/use-invitations.ts` y la tarjeta `app/juego/carnet/carnet-invite.tsx` (no modal, con «Crear mi Carnet» y «Ahora no», y el aviso de límites del progreso local, REQ-IDE-007). Momentos: tras una compra (en /juego y en la landing, al cerrar el checkout confirmado), al cerrar la galería del Puerto de Fotos, a los 5 minutos activos y a los 3 logros. Ritmo: nunca con Carnet; una por sesión de pestaña (`sessionStorage`); «Ahora no» se guarda en el dispositivo (`boia.carnet.invitaciones`) y ese motivo no vuelve; 5 min y 3 logros sólo una vez; nunca sobre carrera, diálogo, pago, panel, menú, minijuego ni llegada (esperan).
- **Posición del barco** (REQ-IDE-004, `app/juego/ship-position.ts`): se guarda en `localStorage` (`boia.barco.posicion`, cada 2 s si se movió y al ocultar o salir) y se restaura con su rumbo al recargar /juego, al volver con Atrás o al volver sin recargar desde otra página; no al llegar desde EXPLORAR (sale del puerto) ni con `?ir=` o `?cerca=`. `moveShip` la deja siempre en agua navegable.
- **Aviso de progreso local** (REQ-IDE-007): «Tu progreso se guarda sólo en este navegador…» en la invitación de Mi Carnet (menú), en `/carnet` sin Carnet y en cada tarjeta de invitación.
- Pruebas: `invitations.test.ts` (una por sesión, «Ahora no» respetado, contexto nuevo, bloqueo, con Carnet), `ship-position.test.ts` (restaurada tras recargar, cuándo no), `arrival.test.ts` (en los dos mundos: Fotos → Puerto de Fotos con su galería, tienda, isla de evento, punto seguro fuera de los radios), `access.test.ts` (sonido compatible con `parseSettings`, enlaces oficiales, isla de Tickets); e2e `accesos.spec.ts` (Fotos desde la landing llega al Puerto de Fotos y abre la galería; invitación al cerrarla y «Ahora no»; Tickets → isla del evento; Tickets sin scroll a 360×640 con el CTA 3D; cabecera y pie; posición tras recargar).

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint   # exit 0
pnpm build                                 # exit 0; landing 188,9 kB gzip de 192 kB
E2E_PORT=<libre> pnpm e2e --workers=2      # ver el informe de la tarea
```

Pendiente / para otros encargos:
- Instagram en el panel de la boia de WhatsApp (O13): `app/juego/place-panels.tsx` lo toca T43; no se añadió.
- `/mar` no restaura la posición ni tiene invitaciones (fuera de alcance mientras trabaja el plan 003).
- La invitación «antes de continuar a comprar» dentro del checkout (texto `invite.purchase.skip`) no se hizo: el plan pide «después de una compra»; el checkout (`lib/ticketing/`) no cambia.
- Los textos nuevos viven en `lib/landing/access.ts` e `invitations.ts` hasta que T49 los pase a i18n.

## 2026-09-29 — plan 004 T43: descuentos que llevan a su isla y se ven al comprar

Qué existe:
- **Contrato de descuento** (`packages/contracts/src/content.ts`): `scope: event | store` (O8: el de tienda nunca descuenta una entrada), `priority` 0–100 (si valen varios gana la más alta y, a igual, el que más ahorra) y `hiddenAt` (lugar del mapa compartido donde se esconde). `foundDiscountState` da activo / usado / caducado / todavía no vale. Analítica: `ticket_click_out` gana `source: 'island'` y `purchase_confirmed` un `discountId` opcional.
- **Repositorio**: `FoundDiscount` lleva `usedAt` y `usedIn` (derivados de las compras confirmadas); `confirmSandbox` rechaza un código de tienda o ya usado (uno por visitante en la versión de prueba). Muestra nueva `dto-tienda` (TIENDA15, escondido en `restos-2`). **Migración v3 → v4** (`SCHEMA_VERSION = 4`): los descuentos guardados por el Admin se quedan `scope: event`, `priority: 0`.
- **Compra** (`lib/ticketing`): `applicableDiscount` con prioridad, tienda y usados; `discountBannerFor` y `DiscountBanner`/`EventDiscountBanner` («Tienes un código de descuento para este evento», código y ahorro). Sale en el panel de la isla del evento junto a «Comprar entrada» y dentro del checkout de prueba (así también desde la ficha `/eventos/<slug>` y en /mar, que usan el mismo checkout). El sandbox emite `purchase_confirmed` con `provider: 'sandbox'` (`trackSandboxPurchase`): en la versión sin servidor hace de webhook.
- **/juego**: la tarjeta de descuento (aviso de hallazgo y «Mis códigos») lleva «Ir a la isla» (evento con isla), «Ver el evento» (satélite sin isla) o «Ir a la tienda ↗» (tienda). «Ir a la isla» cierra lo abierto y el barco navega solo (`app/juego/autopilot.ts`: turbo 2,6×, como mucho ~8–12 s, llega de un salto si se atasca), con la barra «Rumbo a … · Saltar»; flechas/WASD o tocar el mar lo cancelan; con movimiento reducido llega de un salto. `/juego?evento=<id>&piloto=1` hace lo mismo al arrancar (para tarjetas fuera del mar, `voyageHref`). El menú «Descuentos» pasa a **«Mis códigos»** (id `descuentos`), ordenado activos → usados → caducados. `discount_found` y `ticket_click_out` (isla) se emiten.
- **Admin › Descuentos** (`app/admin/sections/discounts.tsx`, `/admin#descuentos`): crear, editar, caducar ya, papelera y volver a la muestra; destino evento o tienda, % o €, fechas, prioridad y «Escondido en» (lugares con premio y sin panel, `discountHidingPlaces`). Todo por `repo.admin.upsert` (auditado). `liveWorld` pasa los descuentos al mapa (`hideDiscounts`): el lugar entrega ese código.
- Pruebas: `lib/ticketing/discount-banner.test.ts` (aviso sólo con código válido de ese evento; caducado se ve y no se aplica; usado no vuelve a valer; tienda nunca), `lib/admin/discounts.test.ts` (creado en el Admin: escondido, encontrado, aplicable y auditado; caducar), `app/juego/autopilot.test.ts`, `packages/store/src/discounts-migration.test.ts`; e2e `descuentos.spec.ts` (náufrago → «Ir a la isla» → aviso → compra con descuento → «Usado»; «Saltar» y timón; Admin). Capturas `docs/informes/img/p004-t43-{ir-a-la-isla,banner-descuento}.png` (`RECORD_T43=1 … descuentos.spec.ts --project=mobile`).

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint   # exit 0; 69 archivos, 685 pruebas
E2E_PORT=<libre> pnpm e2e --workers=2      # ver el informe de la tarea
```

Pendiente / para otros encargos:
- **/mar** (cuando lo deje el plan 003): en `app/mar/sheet.tsx`, sustituir su `DiscountCard` propia por la de `app/juego/place-panels.tsx` (o copiar sus estados y botones) y darle `onGoToIsland={(id) => { const e = liveContent().events.find(x => x.id === id); if (e?.islandId) engineRef.current?.startVoyage(e.islandId) }}` desde `mar-client.tsx` (el mismo `startVoyage`/`stopVoyage`/`onVoyageEnd` de «Entradas», pero al llegar abrir la hoja de la isla y no el checkout), y poner `<EventDiscountBanner event={…} />` (de `lib/ticketing/discount-banner.tsx`) sobre el botón de compra de la hoja de isla; el checkout ya enseña el aviso. Luego, un e2e en /mar igual al de `descuentos.spec.ts`.
- Landing: no hay tarjeta de descuento en la landing; si se añade, su «Ir a la isla» es `voyageHref(eventId)`.
- La ficha `/eventos/<slug>` enseña el aviso sólo dentro del checkout; ponerlo también sobre su botón de compra toca `app/(landing)` (fuera de T43).

## 2026-09-29 — plan 004 T42: eventos y fotos: ficha de evento, «Fotos y eventos», estado de la isla, satélites

Qué existe:
- **Contrato de evento** (`packages/contracts/src/events.ts`): `format` pasa a `all_day | satelite` (antes, texto libre), más `series` (clave estable: `boia-club`, `noche`; su nombre sale en las tarjetas con `eventKicker`, `event-labels.ts`, sin zod), `endsAt`, `saleOpensAt`, `activities`, `posterUrl`, `priceCents` + `priceSample` (el precio sale de `lib/ticketing/pricing.ts`; `samplePriceCents` y `quoteFor` aceptan el evento o su id) y `stateSource: dates | manual`.
- **Estado por fechas** (REQ-COM-004): `eventState(e, now)`. A mano manda lo guardado. Por fechas: borrador y finalizado a mano se quedan; pasado el fin (`endsAt` o inicio + 12 h), finaliza (cancelado y pospuesto conservan su aviso); agotado/pospuesto/cancelado los pone el Admin; con apertura de venta, antes «próximamente» y después «a la venta». `upcomingEvents`, `resolvePriorityEvent` y `canBuy(e, now)` lo usan; `resolveHome` y `liveContent()` (así /juego y /mar) entregan los eventos con su estado de ahora.
- **Satélites** (REQ-COM-010, O7): `nextAllDay`, `commonIslandId` (la isla del próximo All Day, o `allday`) e `islandUpcomingEvents`. Un satélite sin isla sale en «Próximos eventos» de esa isla y en Tickets con «Calienta para el próximo All Day» y enlace a su ficha (o «todavía no tiene fecha» si no hay).
- **Primer evento real** `halloween-2026`: «BOIA Club · Halloween», Kiki García Bar, 31-10-2026, satélite de la serie `boia-club`, sin isla, a la venta (sandbox), cartel «próximamente», precio 10 € de muestra, `sample: false`. La muestra: primavera y verano (con apertura de venta) en `allday`; el All Day 2026 finalizado pasa a `allday` (recuerdos); Noche de mayo es satélite `noche`.
- **Fotos**: `photo.selection` (la home enseña sólo esas, con «Ver todas» → `/fotos`) y `album.islandId` (álbum de una isla sin evento). Muestra: 8 fotos del All Day 2026 y 3 de la cala, 5 en la selección.
- **`/eventos/<slug>`** (`app/(landing)/eventos/[slug]`): ficha sin motor, sin entrada, funciona sin JS; cartel (o «Cartel próximamente»), fecha y hora, lugar, formato y serie, precio, actividades, cartel de artistas, aviso de estado, compra sólo a la venta, «Ir a su isla» (`/juego?evento=` del evento que abre la isla), recuerdos si finalizó y otros próximos. ISR cada 5 min (el estado depende de la hora); los eventos creados en el Admin se pintan en el cliente (`LiveEvent`).
- **`/fotos`** («Fotos y eventos»): una galería por isla de evento (siempre, con su ancla `#<isla>`), una por evento sin isla con álbum (`#<slug>`) y la general. Lógica pura en `lib/landing/eventos.ts` (`eventPageView`, `photoGalleries`); textos en `lib/landing/eventos-copy.ts` y `card-copy.ts` (de textos-zonas, hasta que T49 los pase a i18n).
- **Isla en /juego** (`world-ui.tsx`, `place-panels.tsx`): el panel del evento enseña el estado (agotado sin compra, pospuesto/cancelado con aviso, finalizado con su cartel), «Ver el evento», «Ver fotos de la isla» (`/fotos#<isla>`), recuerdos con cartel y «Próximos eventos» (los de la isla y sus satélites primero). El Puerto de Fotos lleva a `/fotos`.
- **Admin › Eventos**: formato, serie, fin, apertura de venta, «Cambio de estado» (por fechas / a mano), precio, cartel y actividades; la lista dice «Ahora: <estado> (por fechas|a mano)» y cambiar el estado desde la lista lo fija a mano.
- **Migración v2 → v3** (`SCHEMA_VERSION = 3`): los eventos guardados por el Admin pasan a `all_day`/`satelite` (con la serie del texto viejo), `stateSource: manual` y el precio de la tabla vieja.
- Pruebas: los siete estados por fechas, un finalizado nunca enseña compra (tarjeta, ficha, isla, por fecha y a mano), satélite bajo el próximo All Day, galerías y selección, migración; e2e `eventos.spec.ts` y `ciclo-evento.spec.ts` (REQ-COM-014: publicar, agotar, finalizar, otro en la isla, posponer y cancelar). Capturas `docs/informes/img/p004-t42-{evento,fotos,isla-estado}.png` (`RECORD_T42=1 … record-eventos.spec.ts --project=mobile`).

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint   # exit 0; 65 archivos, 668 pruebas
pnpm build                                 # exit 0; landing 186,8 kB gzip de 192 kB (+4,3 kB de SVG del logo por CSS = 191,1 kB)
E2E_PORT=<libre> pnpm e2e --workers=2      # ver el informe de la tarea
```

Pendiente / para otros encargos:
- `/mar` (plan 003): `app/mar/sheet.tsx` ya recibe los estados de ahora por `liveContent()`, pero su hoja de isla no tiene aviso de estado, «Ver fotos de la isla», recuerdos con cartel ni satélites, y su «Ver la galería» sigue en `/#fotos`.
- `packages/store/src/local.ts` (`confirmSandbox`) comprueba el estado guardado, no `eventState`: el sandbox ya lo filtra antes, pero la guarda del repositorio debería usarlo.
- Admin › Fotos no deja marcar la selección ni ligar un álbum a una isla; la localización común de los satélites no se configura en el Admin (es la isla del próximo All Day).
- Supabase (`supabase/migrations`, tabla de eventos) no tiene las columnas nuevas.

## 2026-09-29 — plan 004 T39: arte: la mascota de BOIA en todas las boias, skins de barco a la venta, secretos

Arte `muestra` renderizado con el pipeline de Blender; el motor todavía no lo usa (lo cablean T40 y T45).

Qué existe:
- **La mascota como boia** (`tools/blender/mascota.py`): la mascota de `art/marca/boia-mascota.jpg` modelada como boya flotante (cuerpo naranja #F5501E, gorro azul marino #34288A en punta con agujero, ojos grandes, cejas, sonrisa ancha, aro flotador en la flotación), con el Builder de los mundos: cada pieza es un papel y el tema pone arcilla o acuarela (la acuarela lleva su contorno). Variantes: `primera`, `info` (cartel «i» y gallardete de 5 colores), `whatsapp` (bocadillo verde de chat, sin logo de marca), `fiestera` (aro de fiesta, guirnalda, pompón, coloretes y globos); boca `sonrisa` o `habla`.
- `art/mundos/{arcilla,acuarela}/boias/` (nuevo, extra de `tools/blender/lugares.json`): piezas `primera` y `whatsapp` (en su sitio del puerto) e `info_1`…`info_5` (sin sitio: map_pos nulo, T45 las pone), cada una con `idle` (6 fotogramas, balanceo) y `habla` (2 fotogramas, boca abierta).
- `art/mundos/{arcilla,acuarela}/fiestera/`: la Boia Fiestera es ahora la mascota con sus detalles de fiesta (`fiestera_pide_*`, habla mientras pide ayuda) y a bordo (`tripulante_baile_*`, canta y baila); mismos ids de pieza, fotogramas y anclajes que antes.
- `art/mundos/{arcilla,acuarela}/secreto/` (nuevo, extra): destello dorado de cuatro puntas sobre un remolino de espuma, animación `brillo` de 4 fotogramas, con `instances` = los 4 puntos de `mapa.json/secretos`.
- **Skins**: los estudios de barco salen en `base`, `noche` y `fiesta` (`tools/blender/ship_skins.py`: otra paleta del mismo script, aplicada antes de construir), 8 direcciones con y sin pasajera: acuarela, low-poly, semi-realista, arcilla, cartoon-30, cel-shaded y pixel-art (este con su paleta fija de 16). B01 boceto-lápiz queda sólo en base (`ship_skins.HELD`: su nota del registro no admite skins de color, y `ship-style.test.ts` espera un estilo sin skin temática); sus skins de lápiz están escritas y se activan quitando esa entrada.
- **Pasajera**: la de todos los barcos (`ship.passenger_meshes`) es la mascota en pequeño; se re-renderizaron las imágenes `_p` del barco por defecto.
- **glTF** (`tools/blender/export_barcos_glb.py` → `art/barco/3d/`): `<id>-noche.glb` y `<id>-fiesta.glb` de cada estilo con skins (el manifiesto las lista en `skins`), `boia-mascota`, `boia-info`, `boia-whatsapp`, `boia-fiestera` y `secreto.glb` (manifiesto: `boias`, `secretos`). Cara/proa a +X, flotación en y = 0.
- `tools/blender/lugares.json` gana `extras` (boias y secreto): mismo formato y comprobaciones que un lugar; `check.py` exige sus carpetas. `place.schema.json`: categorías `personaje` y `secreto`.
- Hojas: `docs/informes/img/p004-t39-skins.png` y `p004-t39-boias-mascota.png` (`tools/blender/contact_sheet_t39.py`).

Comandos:
```
Blender -b -P tools/blender/render.py -- --only barco --mundo arcilla --mundo acuarela --lugar boias --lugar secreto --lugar fiestera   # exit 0; 704 imágenes (~4 min)
... la misma con --out tools/blender/out/rerun                                                          # exit 0; 719 archivos (704 PNG + 15 manifiestos) idénticos byte a byte
Blender -b -P tools/blender/export_barcos_glb.py                                                          # exit 0; 27 .glb
python3 tools/blender/check.py                                                                            # exit 0; 59 manifiestos válidos, 848 imágenes; cada mundo 21 lugares
pnpm test                                                                                                 # exit 0; 60 archivos, 585 pruebas
```

Pendiente / para otros encargos:
- El motor sigue dibujando la boia y la de WhatsApp de `puerto` y el secreto como marcador: T45 (y quien toque `packages/world/src/worlds/place-art.ts`) debe apuntar a `boias#primera`, `boias#whatsapp`, `boias#info_N` y `secreto#secreto`, y pasar `boias` y `secreto` de `extras` a `lugares` en `lugares.json` (el test de acuarela compara el arte usado con `lugares`).
- T40: `apps/web/lib/barco/catalog.ts` sigue filtrando skins por las notas de `docs/barcos/barcos.json` (B05 «sólo base», B06 sin fiesta): hay que quitar esas notas o reglas para vender las skins de B05.
- Los manifiestos de lugares no re-renderizados (puerto, islas, costas…) y de los recursos del mundo de muestra llevan un `sources_sha256` viejo porque cambiaron `mundo_arcilla.py`, `render.py` y `lugares.json`; el arte es el mismo.
- `arcilla*.glb` no sale igual byte a byte entre corridas (la dieta Decimate de Blender); el resto de .glb sí.

## 2026-09-29 — plan 004 T50: marca de BOIA (letras del wordmark, logo, colores y tipografía)

La identidad de Álvaro (inventario §6.8) aplicada a la entrada, la landing y el Admin. `/mar` no se toca (plan 003).

Qué hay:
- `tools/blender/intro/trazar_marca.py` (nuevo, Blender sólo para leer el JPG; numpy): calca `art/marca/boia-wordmark.jpg` y `boia-mascota.jpg` a SVG limpios (máscara por color, marching squares subpíxel, Douglas-Peucker, Bézier cúbicas con esquinas). Salida en `art/marca/`: `boia-wordmark.svg` (una `<path id>` por letra B, O, I, A; el que extruye Blender) y `boia-mascota.svg` (capas negro/naranja/azul/blanco), y en `art/marca/logo/` las variantes ligeras para la web (media escala, enteros, cúbicas relativas: 1,2 kB y 3,1 kB gzip). Determinista (dos corridas, mismos bytes).
- Colores muestreados (mediana de cada color): naranja del wordmark `#EC4F24`, naranja de la mascota `#FF5219`, azul del gorro `#36278A`, trazo `#000000`. Tokens `--boia-orange`, `--boia-orange-bright`, `--boia-blue`, `--boia-black`, `--boia-white` en `apps/web/app/globals.css`; `--boia-navy` (#12233f) queda como color del mar/espacio de la escena, no de marca.
- Título 3D de la entrada: `tools/blender/intro/titulo.py` v0.2.0 extruye las letras del SVG (antes, Inter de Blender) con la separación del wordmark; cara `#EC4F24`, cantos `#36278A`. Mismo pipeline, rejilla (17 guiñadas × 4 letras, celdas 184×176) y movimiento de T27; el manifiesto añade `shape` y el SVG entra en `generator.scripts` (su hash invalida la hoja si cambia). Sin cambios en `packages/engine` ni en `apps/web/lib/intro`.
- Logo: `BrandLogo` (mascota + wordmark) en la cabecera (dentro del enlace «Ir al inicio», decorativo) y grande en el pie (nombrado «BOIA.PLANET»). Copias de `art/marca/logo/` en `apps/web/app/(landing)/_marca/`, pintadas por CSS; la prueba `brand-logo.test.ts` exige que sean idénticas a las de `art/marca/logo/`. Favicon `app/icon.svg` = mascota; `app/apple-icon.png` 180×180 (mascota sobre blanco, generada con sharp desde `art/marca/boia-mascota.svg`). Admin: la mascota delante de «BOIA · Admin», barra y enlaces en el azul del gorro, acento naranja, títulos en la display.
- Tipografía de títulos: Titan One (SIL OFL, licencia en `apps/web/public/fonts/OFL-titan-one.txt`), subconjunto latino de Google Fonts (con tildes, ñ, ¿, ¡), 10,5 kB, en `apps/web/public/fonts/titan-one-latin.woff2`. La landing la carga con `next/font/local` en `(landing)/layout.tsx` (precarga; envoltura `display: contents` con la variable), el Admin con `@font-face` en `admin.css`. Hero, títulos de sección, panel de Tickets, «Explorar el universo» y el título plano de la entrada. Provisional hasta la fuente de Álvaro (P20).
- Contraste: texto sobre naranja pasa a negro (5,7:1; el navy sobre el naranja nuevo daba 4,3:1) y el texto naranja sobre el mar usa el naranja de la mascota (4,8:1).
- Capturas: `docs/informes/img/p004-t50-intro-letras.png` (wordmark original arriba, letras 3D abajo), `p004-t50-landing-logo.png` y variantes (`RECORD_MARCA=1 pnpm e2e record-marca.spec.ts --workers=1`; la composición de intro-letras se hizo con sharp: recorte 400×135 en (440, 20) de la captura de escritorio bajo el JPG del wordmark).

Comandos:
```
Blender -b -P tools/blender/intro/trazar_marca.py      # art/marca/*.svg y art/marca/logo/*.svg
Blender -b -P tools/blender/intro/titulo.py            # art/intro/titulo/ (~30 s)
python3 tools/blender/intro/check_titulo.py --diff OTRA/RAIZ   # exit 0; byte a byte igual a una segunda corrida
python3 tools/blender/check.py                         # exit 0; 55 manifiestos, 504 imágenes
pnpm test && pnpm typecheck && pnpm lint && pnpm build # exit 0; 61 archivos, 588 pruebas; landing 185,2 kB (fuente incluida) + 4,3 kB de SVG del logo pedidos por CSS = 189,5 kB de 192 kB
E2E_PORT=<libre> pnpm e2e --workers=2                  # exit 0; 93 pasan, 23 omitidas (grabaciones)
```

Nota: el script de presupuesto sólo suma lo que el HTML referencia; los SVG del logo los pide el CSS y se sumaron a mano. En una corrida con la máquina cargada fallaron por tiempo `despliegue.spec.ts` (analítica) y `mar-3d.spec.ts` en escritorio; solos y en la corrida final pasan.

## 2026-09-29 — plan 004 T38: decisión D-23, spec al día y los textos de todas las zonas

Sólo documentos; no se toca código.

Qué hay:
- `docs/DECISIONES.md`: D-23 con los 11 puntos de Hernán del inventario (§1), O1–O15 del orquestador por delegación (Álvaro sólo da el visto bueno) y las respuestas de Álvaro (§6): mascota como base de todas las boies, wordmark para las letras 3D y el logo, BOIA Club · Halloween (31-10-2026, Kiki García Bar) como satélite real, selección de fotos en la home, datos legales inventados. O5 se ajusta al reparto de barcos que Hernán aprobó con el catálogo de logros (plan 003 T36): monedas B03 y B06, puntos B04 a 1500, logros B07, B01 y B08. Preguntas: P4, P6, P8–P13 cerradas, P3 respondida en parte, P2 y P14 siguen, nuevas P15–P22 (enlaces, códigos, fotos de artistas, música, cartel, tipografía, datos legales reales, lectura de los textos).
- `docs/spec/`: modificados REQ-PRO-009, REQ-ENT-003, REQ-ENT-032, REQ-MUN-035, REQ-ADM-032, REQ-AVE-018, REQ-IDE-030, REQ-IDE-031, REQ-COM-010 y REQ-COM-031; nuevos REQ-MUN-039 (agujero negro), REQ-AVE-040 (cinco boies y la mascota), REQ-COM-036 (descuento → isla y aviso al comprar), REQ-ADM-040 (moderación de Carnets) y REQ-IDE-053 (ranking local, sólo versión de prueba). 00-indice cita D-01 a D-23 con sus desviaciones; conteos de 09 al día; glosario; la lista de artistas deja de ser provisional.
- `docs/PLAN.md` (Faro y Cañón descongelados, P6 cerrada) y `mundos/arcilla/diseno.md` (Faro y Cañón en L1, no solar L2).
- `docs/propuestas/textos-zonas.md`: 618 cadenas en 32 zonas (las 18 de §31.2 y las de D-23), una clave por cadena, por pantalla y por mundo donde cambia; tabla de zonas con el conteo arriba; las 5 preguntas del Carnet textuales; legales (aviso legal, privacidad, cookies) con los datos inventados y su aviso `muestra`, para que T49 los conecte.

Comandos:
```
python3 tools/spec/check.py        # exit 0; 294 requisitos, 0 duplicados, centinelas 10/10
python3 tools/spec/test_check.py   # exit 0; 18 pruebas
```

## 2026-09-30 — fuera de encargo: el barco vuela («Entradas» e «Ir en nave»)

Experimento de Hernán en la rama `exp/entradas-vuelo`, que se queda y está unido a `main`. En `/mar`, «Entradas» ya no navega en turbo: el barco levita, le salen alas de nave, vuela sobre el planeta hasta la isla del evento, se posa y abre la compra. La ficha de cada isla ofrece «⛵ Navegar» o «🛸 Ir en nave». Todo `muestra`, pendiente de Álvaro.

Qué existe:
- `apps/web/app/mar/engine/flight.ts`: el perfil del vuelo, puro y con pruebas en `flight.test.ts` (`FLIGHT`, `flightPlan`, `flightPose`). Levita en 1 s, las alas salen entre 0,85 y 2 s, arranca a los 2,3 s, avanza 2,4–4,4 s según la distancia (620 u/s) a 9 u de altura y se posa en 0,95 s; a la isla del evento desde el puerto, unos 6 s. Las piezas: `Wings` (alas delta crema con franja naranja, aletas moradas, luces en las puntas y dos propulsores), `Sparks` (estela de chispas), `Splash` (espuma y gotas al despegar y al posarse) y `FlightClouds` (nubecillas a la altura del vuelo).
- `mar3d.ts`: `startFlight(placeId)`. Mientras vuela, el runtime ve un barco fantasma quieto donde despegó (sin choques ni disparadores por el camino), no se gobierna y `setCourse` no hace nada; `stopVoyage` («Saltar») lo posa ya en el destino. La cámara se queda cerca durante la transformación (`TRANSFORM_ZOOM` 0,15), se aleja al volar (`FLIGHT_ZOOM` 0,34), sube con el barco y gira hasta quedar detrás (`camYaw`); al posarse vuelve a mirar al norte. `Stats.flight` da la fase (`lift`/`cruise`/`land`).
- `mar-client.tsx`: «Entradas» vuela (`?vuelo=0` vuelve al viaje en turbo, para comparar) y el botón dice «Volando a…». `flyTo` para «Ir en nave»: se posa sin abrir la compra. Con movimiento reducido, compra directa o navegar como siempre. `data-flight` en `<main>` y líneas de velocidad en CSS (`.mar-speedlines`) durante el crucero.
- e2e en `mar-3d.spec.ts`: «Entradas» vuela y «Saltar» abre la compra; otro toque, y el vuelo llega y la abre; «Ir en nave» desde la ficha despega, vuela y se posa sin abrir la compra.

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint      # exit 0; 69 archivos, 691 pruebas
E2E_PORT=3475 pnpm e2e mar-3d.spec.ts --workers=2   # exit 0; 24 pasadas (2,9 min)
```

Desviaciones:
- «Saltar» durante el vuelo deja el barco posado en la isla; antes se quedaba donde iba.

Sin probar:
- Móvil real: sólo Chromium a 390×844 y el túnel que probó Hernán.
- Tocar una isla o el mar en la pantalla sigue navegando sin preguntar; la elección sólo sale en la ficha.

## 2026-09-30 — plan 003 T37: panel de logros con contador y «Reclamar» en /mar y /juego

Los logros ya se reclaman desde la web: un mismo panel en `/mar` (icono 🏆 del HUD) y en `/juego` (sección «Logros» del Menú de a bordo). Al completar uno sale «¡Logro completado! Reclama tu premio» y el icono lleva un número rojo mientras haya algo por reclamar; «Reclamar» da el premio una vez, con una animación corta. Arreglados los tres huecos de T36. Todo `muestra`, pendiente de Álvaro.

Qué existe:
- `apps/web/lib/logros/` (nuevo, compartido): `model.ts` (sin React: filas del panel desde `progress.achievements()` y `achievementFacts`; «???» y «Logro oculto. Sigue explorando…» para los ocultos sin completar, barra 0…1, cuenta «3/7», «te queda…» por disparador —«Te quedan 4 islas», «Te quedan 3 minutos a bordo», «Te queda: termina una vuelta al circuito», en la vuelta rápida «Tu mejor vuelta: 50,2 s · te quedan 6,6 s»—, premio en corto «+30 ★ · +10 🪙 · Barco Pixel art», orden: por reclamar, en curso —lo más avanzado arriba, ocultos al final—, reclamados; `readyCount`, `obtainedCount`), `panel.tsx` (`AchievementsPanel`: saldos que suben contando, rango, «X de Y logros» —X = completados + reclamados—, lista y «Reclamar»), `reward.tsx` (`ClaimReward`: chispas, puntos y monedas contando desde 0, la insignia volando al 🪪 Carnet, el candado que se abre y deja ver el barco, o «Nuevo para tu barco: …»; se va a los 2,6 s o al tocarla; sin movimiento con movimiento reducido), `claim-badge.tsx` (el numerito, «9+» a partir de 10), `use-logros.ts` (`useLogros`, `useReadyCount`, `useShipLocks`, `lockedShipText`, `useCountUp`) y `logros.css`.
- `/mar`: icono 🏆 al final de la barra de arriba (a la derecha de los saldos): el minimapa empieza debajo de la barra y «Entradas» está abajo, así que no pisa ninguno a 360 ni a 390 px (e2e). Con algo por reclamar, aro naranja y número. Abre `MarLogros` (`app/mar/logros.tsx`): hoja crema desde abajo en el móvil, tarjeta centrada en escritorio, con «🪪 Mi Carnet», × , Escape o tocar fuera; con el panel abierto el barco no se mueve y una vuelta en curso se anula (como cualquier panel, REQ-AVE-032). Tocar un aviso de logro abre el panel. En el menú, «🏆 Logros · N por reclamar» y los barcos que se ganan con logro con candado (no se eligen) y el logro que los da.
- `/mar` escucha `onAchievementNotices` (minijuegos, botellas, Carnet… ya avisan) y apunta «navegar en este mundo» al arrancar, con su aviso, como `/juego` (antes sólo se apuntaba, sin aviso, dentro de `discoverPlace`).
- El atajo en `/mar`: `app/mar/race.ts` (`raceCheckpoint`) pasa el id del arco a `race.checkpoint` y la vuelta llega a `finishLap` con `e.route`.
- Récord de la vuelta: `circuitRecordId` (`packages/engine/src/circuit/race.ts`) da `circuito:el-freu:v1` (clave estable; antes `circuito:el-freu@v1`, que el repositorio rechazaba y el récord nunca se guardaba). `legacyCircuitRecordId` + `readRecord`: la clave vieja se sigue leyendo (si un navegador la tuviera) y cuenta en `submitRecord`; el aviso de salida de `/juego` usa `readRecord`.
- `/juego`: la sección «Logros» es el panel compartido (debajo, lo descubierto en esta visita); su icono de la barra del menú y el ancla del HUD (`hud-buttons.tsx`) llevan el número (`data-por-reclamar`, nombre accesible «…: 1 premio por reclamar»). Selector «Barco» (`sections/barco.tsx`): los barcos de `progress.ships()` que no se tienen salen con 🔒, gris y «Se gana con el logro «Vigía del faro»» (o «un logro oculto» si el logro es oculto); no se pueden elegir.
- Mi Carnet (`carnet-card.tsx`): sección «Insignias» con las de los logros reclamados (`carnet.badges`).
- Pruebas: `lib/logros/model.test.ts` (sobre el repositorio de verdad: ocultos, barra y «te queda», orden, contador, reclamar una sola vez, textos), `app/mar/race.test.ts` (el atajo en el mundo compacto completa su logro; el récord se guarda), `circuit-hud.test.ts` (récord con clave estable, sólo mejora), `race.test.ts` del motor (clave nueva, la vieja se lee). e2e nuevo `logros.spec.ts`: en `/mar` y en `/juego`, llegar a la boia del tutorial completa «Primera boia», aviso, número en el icono, «Reclamar» sube los puntos exactamente una vez, animación, y tras recargar sigue reclamado; el icono de `/mar` no pisa minimapa ni «Entradas» (360×640 y 390×844); el selector de `/juego` enseña el barco bloqueado con su logro. `demo.spec.ts`: «otro estilo» es ahora el último estilo libre (el último del arte, Pixel art, se gana con un logro).
- Capturas 390×844 (`LOGROS_SHOTS=1 E2E_PORT=… pnpm e2e e2e/logros.spec.ts --project=mobile`): `docs/informes/img/p003-t37-aviso-mar.png` (aviso y número), `p003-t37-logros-mar.png` (panel en `/mar`), `p003-t37-reclamar.png` (animación del premio), `p003-t37-logros-juego.png` (sección de `/juego`).

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint      # exit 0; 68 archivos, 687 pruebas
E2E_PORT=3417 pnpm e2e --workers=2            # exit 0; 119 pasadas, 23 omitidas (9,3 min)
```

Desviaciones:
- El número de `/juego` va en el ancla del Menú de a bordo (no hay otro icono de logros en su HUD) y en el icono «Logros» del menú: toca `hud-buttons.tsx`, fuera de la lista de archivos del encargo.
- Los barcos bloqueados también en el menú de `/mar` (el encargo pedía el selector de `/juego`). Sólo el selector: `?estilo=` o una elección guardada de antes siguen poniendo un barco bloqueado.
- «X de Y logros» cuenta los completados sin reclamar como conseguidos.

Sin probar:
- Móvil real. La animación de la insignia volando al Carnet (sólo «Con entrada» y «Fiel a BOIA» dan una) y la del candado del barco no se han visto en pantalla: las e2e reclaman «Primera boia» (puntos y monedas). La sección «Insignias» de Mi Carnet tampoco tiene e2e.
- En la e2e de `/mar` a veces el aviso se va (tiempo de lectura) justo al tocarlo; la prueba entra entonces por el icono. Tocar el aviso para abrir el panel no queda probado en todas las pasadas.

## 2026-09-29 — plan 003 T34: minimapa redondo del planeta girando (y cámara del móvil)

En `/mar` el botón «Mapa» ya no está: en la esquina de arriba a la derecha hay un minimapa redondo y semitransparente con el planeta entero girando despacio, el barco, las islas (la del evento en naranja), el rumbo y la ruta de boyas. Tocarlo abre el mapa grande; tocarlo otra vez o «Cerrar» vuelve a cubierta; la M sigue igual. Además, a petición de Hernán tras probarlo en el móvil: en un móvil en vertical el barco va en el centro de lo que se ve y se sale con algo más de zoom. `/juego` no cambia. Todo `muestra`, pendiente de Álvaro.

Qué existe:
- `apps/web/app/mar/engine/globe.ts` (sin three.js): el periodo del planeta ocupa el disco entero una sola vez (cuadrado → disco con el mapeo elíptico, abombado hacia el centro como una esfera, `GLOBE_BULGE`), así que el barco y cada isla salen siempre y nunca repetidos. El giro (`Mar3D.planetSpin`, el mismo del cielo de T33: una vuelta cada ~17 min) desplaza el mar hacia el este dando la vuelta; los meridianos giran con él. `drawGlobe` pinta en un lienzo 2D: mar con degradado, rejilla, ruta de boyas a trazos (cortada en la costura), islas, aro del rumbo y el barco con halo y su rumbo (`globeHeading`).
- `apps/web/app/mar/minimap.tsx` (`MarMinimap`): un `<button>` redondo (84 px en el móvil, 112 en escritorio; 64/84 en el mapa grande, para no tapar los rótulos) con el lienzo a la resolución de la pantalla y repintado 5 veces por segundo (`MINIMAP_FPS`), no con cada fotograma del 3D; no pinta con el mar en pausa ni con la pestaña oculta. Gesto con `MinimapGesture` de `packages/engine/src/ui/minimap.ts`: un roce que se mueve no lo abre; con teclado, Intro/espacio. Etiqueta «Mapa» / «Barco» y `aria-pressed`. El lienzo lleva `data-frames`, `data-pins` y `data-accent` para las pruebas.
- Mapa grande: la vista de mapa de siempre (todo el planeta a la vista, rótulos que abren la ficha con «Navegar aquí», tocar el mar fija rumbo, la ruta de boyas). La barra de abajo lleva ahora «✕ Cerrar». En el mapa, el rótulo de la isla del evento pasa por encima del minimapa.
- `mar3d.ts`: `courseTarget` y `mapMode` para el minimapa; `data-ship-screen` en el lienzo (dónde queda el barco en pantalla, para las pruebas).
- Cámara del móvil (`apps/web/app/mar/engine/framing.ts`): por la proporción de la pantalla (no por el navegador), de apaisado a móvil en vertical (ancho ≤ la mitad del alto) el zoom de salida pasa de 0,2 a 0,26 (`START_ZOOM`: el barco se lee y se ven las boyas de la bocana, las siguientes de la ruta y el castillo y la Explanada) y la mirada por delante baja de 0,2 a 0,03 × la distancia (`LOOK_AHEAD`) y de 0,28 a 0,05 s con la velocidad (`SPEED_LEAD`); además, en vertical se compensa el retraso con que el foco sigue al barco (`catchUp` = 1/`FOCUS_RATE` s), que en el viaje en turbo de «Entradas» lo sacaba del centro. A 390×844 el barco queda a ~2 % del centro de lo que se ve (entre la barra de arriba y «Entradas»); antes, a ~19 % por debajo (medido en la captura). En escritorio, igual que antes.
- En el móvil (< 760 px) los chips (rumbo, crono, misión) y la ayuda de la primera vez bajan a 170 px para no chocar con el minimapa.
- Pruebas: `globe.test.ts` (todo dentro del disco y bordes al borde, cada sitio una sola vez, abombado, giro de 2π y hacia el este, rumbo del barco también en la costura, la ruta se corta sólo al cruzar un borde, lo que pinta) y `framing.test.ts`. e2e en `mar-3d.spec.ts`: el mapa se abre por el minimapa en todas las pruebas que lo usaban (también la de la isla `allday` → rumbo); nuevas: minimapa visible, redondo, sin pisar «Entradas» y repintándose con la isla del evento destacada; abrir (con el dedo en el móvil), «Cerrar», la M y tocarlo otra vez (con 60 s de margen, como la de «Entradas» por el mapa: la vista de mapa es lenta en el Chromium sin GPU); nueva a 390×844: el barco a menos del 10 % del centro de lo que se ve, parado y navegando, y el zoom de salida del móvil.
- Capturas 390×844: `docs/informes/img/p003-t34-minimapa.png` (cubierta con el minimapa), `p003-t34-mapa-grande.png`, `p003-t34-camara-antes.png` y `p003-t34-camara-despues.png`.

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint      # exit 0; 66 archivos, 675 pruebas
E2E_PORT=3347 pnpm e2e --workers=2            # exit 0; 111 pasadas, 19 omitidas (9,5 min, con la máquina cargada)
```

Desviaciones:
- `minimapProjection` de `packages/engine/src/ui/minimap.ts` no se usa: es la proyección isométrica del 2D y `/mar` se ve desde arriba. Sí se usa su gesto (`MinimapGesture`); sin arrastrar el minimapa (una pulsación larga quieta también lo abre).
- «Cerrar» va en la barra de abajo del mapa (a mano del pulgar), no junto al minimapa: arriba tapaba rótulos.
- Cámara y zoom del móvil (pedido de Hernán durante la tarea, fuera del alcance inicial).

Sin probar:
- Móvil real (iOS Safari): el toque, el giro y el coste del minimapa sólo se han visto en Chromium con emulación táctil.
- A 360×640 el mapa grande ya no cabía entero entre las barras (antes de T34); el rótulo de la isla del evento queda por encima del minimapa, pero los de más arriba pasan bajo la barra de arriba.

## 2026-09-29 — plan 003 T50: un /mar compacto con ruta de boyas

`/mar` es ahora un mundo compacto: las islas a la mitad de distancia que en T33, casi sin mar vacío al dar la vuelta, y una ruta de boyas con farolillo que une las islas en el orden de la historia y vuelve al puerto. Sólo `/mar`: las posiciones del mapa compartido (`packages/world`) y `/juego` no cambian. Todo `muestra`, pendiente de Álvaro.

Qué existe:
- `apps/web/app/mar/engine/compress.ts`: `MAR3D_SCALE.compact = 0.5` acerca otra vez las zonas (multiplica a `spread`; `compressWorld(world, { compact: 1 })` da el mar de T33). Las composiciones locales (puerto, remanso, semáforo) siguen 1:1 y las huellas, colisiones y radios de disparo no cambian de tamaño. Si dos islas quedan con sus radios de proximidad pisándose se apartan lo justo (`islandGap`, 40 u): sólo el Cañón y el Faro, 13 u. Arreglado de paso: los sitios de reaparición de restos y cofres (`spawn.positions`) no cambiaban de escala y aparecían en coordenadas del 2D.
- `apps/web/app/mar/engine/compact.ts` (sin three.js), `marWorld(shared)`: el mundo que usa todo `/mar` (runtime, rótulos, piloto, viaje de «Entradas», misión, circuito, premios por id). Sus `bounds` se ajustan a lo que ocupa el mar (`contentBounds`: lugares con su huella, anillo y decorado) y `PLANET_MARGIN` baja a 150 u por lado (antes 300/300/600 sobre los límites del 2D): el planeta pasa de ~5000×9400 u a ~2600×4400 u.
- Ruta de boyas (`seaRoute`): El Varadero (sale recta por la bocana) → Cala del Alfar → remanso de la Boia Fiestera → isla del evento (`allday`) → Puerto de Fotos → isla tienda → Cañón → Faro → Isla del Amanecer (`ultima`) → vuelta al puerto, que por el camino corto es cruzando el borde norte (unos 620 u). Cada tramo va por el camino más corto del planeta y rodea las islas que no son parada y el decorado. El orden encaja con la misión de la Fiestera (se rescata en la 3.ª parada y su destino es la última isla): no hubo que cambiarlo. 50 boyas (amarillo y morado, con luz) cada 125 u, nunca encima de nada sólido; en el mapa, una línea amarilla a trazos (`RouteLine` en `effects.ts`) que aparece al alejarse. Sólo decorado: ni choques, ni premios, ni lugares nuevos.
- Mar vivo junto a la ruta (`pullToRoute`): náufrago, restos, cofres, delfín y remolino quedan a ≤ 240 u de la línea, sin amontonarse (≥ 110 u entre ellos) y fuera de islas, decorado y rocas; lo que choca o gira, apartado de las boyas. Se mueven con sus reapariciones y el rastro del delfín.
- Decorado (`DECOR_OFFSET`, `DECOR_SOLIDS` en `compact.ts`; `decor.ts` dibuja con esas medidas): el castillo al oeste y la Explanada al este del puerto, un poco al norte, flanqueando la bocana sin pisar la ruta; el islote de la cueva sigue junto a su secreto.
- Vista de mapa: la carta sube 48 px (`MAP_LIFT_PX`, sin mover su centro) para que el puerto y el cierre de la ruta queden sobre la barra de abajo. El lienzo lleva `data-route-buoys` (número de boyas) para las pruebas.
- Tiempos a velocidad normal (sin turbo, piloto automático; simulación del motor en `compact.test.ts`): del puerto a la isla del evento 7,9 s; parada a parada 6,0 / 8,5 / 9,2 / 3,7 / 6,2 / 7,5 / 3,7 / 5,2 s. Medido en el navegador (build de producción, 390×844, Chromium con GPU, «Navegar aquí» a la isla del evento desde el anillo, 288 m): 8,4 / 8,6 / 8,9 s hasta llegar. En T33 el mismo viaje era de unas 3300 u (~15 s, estimado).
- Pruebas: `compact.test.ts` (mitad de la distancia mediana a la isla vecina frente a T33, todos los ids y geometrías iguales, huellas y proximidades sin pisarse, planeta ajustado, orden de la ruta y cierre en el puerto, la Fiestera sube antes y baja en la última parada, tramos por el camino corto, boyas en el agua, mar vivo cerca y sin amontonarse, tiempos); `compress.test.ts` al día (compacto + reapariciones a escala); `wrap.test.ts` sobre `marWorld`. e2e nuevo en `mar-3d.spec.ts`: el lienzo pinta tantas boyas como la ruta, el rumbo a la isla del evento da la distancia del mundo compacto y el barco llega solo.
- Capturas 390×844: `docs/informes/img/p003-t50-ruta-cubierta.png` (salida del puerto con las boyas delante) y `p003-t50-ruta-mapa.png` (el mapa con la ruta entera).

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint      # exit 0; 64 archivos, 665 pruebas
E2E_PORT=3261 pnpm e2e --workers=2            # exit 0; 105 pasadas, 19 omitidas (7,9 min)
```

Desviaciones:
- El circuito de El Freu no se ha movido: es una composición (carriles, rocas, arcos) y al este no cabe más cerca sin pisar la isla tienda. Su arco más cercano (la meta) queda a ~370 u de la ruta, la salida a ~630 u (2-3 s).
- «Faro y Cañón» son dos paradas: primero el Cañón y luego el Faro (de camino desde la tienda).
- El secreto de la cueva y el de la campana siguen lejos de la ruta a propósito (son secretos).
- `mar3d.ts`: `MAP_LIFT_PX` en la cámara del mapa (fuera de lo pedido, para que se vea la ruta entera con la barra de abajo).

Sin probar:
- Móvil real. Con la Fiestera a bordo, la vuelta entera siguiendo la ruta (la entrega en la última isla sólo se ha comprobado por datos: su destino es la última parada).
- El logro «Rayo del Freu» (43,6 s) se midió en `/juego`; en `/mar` el circuito compacto es la mitad de largo y la vuelta rápida es más fácil (ya lo era en T33 a su escala).

## 2026-09-29 — plan 003 T33: /mar como planeta de agua con cielo y estrellas

`/mar` es ahora un pequeño planeta de agua (D-22 punto 2, REQ-MUN-038): sin costas, el mar da la vuelta, el horizonte se curva y encima hay cielo con estrellas que gira despacio. `/juego` no cambia (sus costas y límites siguen igual). Todo `muestra`, pendiente de Álvaro (P14).

Qué existe:
- Vuelta al mundo: `collideShip` (`packages/engine/src/ship/controller.ts`) acepta `wrap` en su entorno y `WorldRuntime` (`runtime.ts`) la opción `wrap`; las dos vienen apagadas (así las usa `/juego`). Con `wrap`, `bounds` es el periodo: sin costas ni corriente del norte, el barco sale por un lado y entra por el opuesto, y contacto, proximidad, recogida, remolinos, diálogos, obstáculos y `safePoint` se miden por el camino más corto (`runtime.delta` / `runtime.distance`, `wrapDelta` / `wrapInto`). Premios, disparadores y rótulos siguen atados al id del lugar (REQ-AVE-011); las posiciones del mapa compartido no cambian.
- El periodo es el mapa del mar 3D con un margen de agua (`PLANET_MARGIN` en `apps/web/app/mar/engine/wrap.ts`: 300 u a los lados y al norte, 600 u al sur), para que salir del puerto hacia el sur no te deje de golpe junto a la última isla. En `wrap.ts` también: el piloto automático puro (`steer`, camino más corto y esquiva obstáculos también al otro lado del borde), la curva (`bendDrop`, `rayOnPlanet`, `behindPlanet`) y `pushOut`.
- Vista (`apps/web/app/mar/engine/`): `planet.ts` curva en el vertex shader todo lo que se pinta (la superficie cae `bend·r²` con la distancia a la cámara: 0,0045 de cerca, casi plana en el mapa) y dibuja cada cosa en su copia más cercana al foco de la cámara; el foco nunca salta, así que cruzar el borde no se nota. En la vista de mapa el centro queda fijo (una carta: el barco da la vuelta por sus bordes). El agua (`water.ts`) es una malla en anillos que sigue a la cámara, con los bajíos de las islas en su copia más cercana (sólo los que se ven). La cámara mira por delante hacia donde va el barco (ahora se puede ir al sur). Tocar el agua curvada pone rumbo; tocar el cielo, rumbo hacia el horizonte en esa dirección. Los rótulos se curvan con el planeta; lo que queda tras el horizonte se oculta, salvo los «siempre visibles» (isla del evento, Fiestera), que se quedan asomados al horizonte en su dirección.
- Cielo (`Sky` en `planet.ts`): cúpula con el degradado del momento del día (`palette.ts`: `fog` en el horizonte, `sky` y el nuevo `zenith`), estrellas (`stars`: 1 de noche, 0,45 al atardecer, 0,08 de día), nubes bajas y una estrella fugaz de vez en cuando; gira despacio (`SPIN_RATE`, una vuelta cada ~17 min) sin mover el barco. `Mar3D.planetSpin` y `Mar3D.planetBounds` quedan para el minimapa redondo (T34).
- Decorado propio (`decor.ts`, sin id ni comportamientos, fuera del runtime y sólido para el barco y el piloto): el castillo en su monte al oeste y la Explanada con su mosaico de olas al este de la salida del puerto, y un islote con la boca de la cueva junto al secreto que en el 2D está en el acantilado oeste. `coast.ts` (acantilados, pueblo, islotes lejanos) ya no existe.
- Pruebas: unitarias de la vuelta en el controlador (cada lado, obstáculo al otro lado del borde, sin `wrap` igual que siempre) y en el runtime (proximidad y recogida a través del borde, `distance`/`delta`, `safePoint`), y de `wrap.ts` (el piloto elige la vuelta corta en los dos ejes y desde el puerto a cada isla, esquiva al otro lado del borde, decorado sólido, curva). e2e nuevo en `mar-3d.spec.ts`: desde la cueva del oeste, El Freu (al este) está a un paso dando la vuelta, en la ficha y en el rumbo.
- Capturas 390×844: `docs/informes/img/p003-t33-horizonte-dia.png` y `p003-t33-horizonte-noche.png` (horizonte curvo, cielo, estrellas), `p003-t33-salida.png` (el castillo y la Explanada a la salida del puerto), `p003-t33-mapa.png` (vista de mapa).
- Rendimiento (build de producción, `?cerca=tienda` navegando 8 s, Chromium con la GPU del Mac y la CPU 4× más lenta por CDP, 390×844 a 2×): mediana 16,7 ms por fotograma (60 fps, el tope del refresco), p95 16,8 ms, de día y de noche; igual que main. En Chromium sin GPU (SwiftShader, el de las e2e, 1280×720) va más rápido que main: 50 ms frente a 113 ms por fotograma (el agua ya no pinta lo que queda tras el horizonte y sólo mira los bajíos que se ven).

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint      # exit 0; 61 archivos, 609 pruebas
E2E_PORT=3187 pnpm e2e --workers=2            # exit 0; 103 pasadas, 19 omitidas (7,0 min)
```

Desviaciones:
- `mar-client.tsx`: la distancia de la ficha usa `runtime.distance` (el camino corto).
- Con el mundo que da la vuelta, las islas del norte (la del evento, la Última, el Faro) quedan más cerca yendo al sur desde el puerto: el piloto y el viaje de «Entradas» salen hacia el sur (con media vuelta al zarpar). Es lo que pide «el camino más corto»; si se prefiere que desde el puerto se vaya al norte, basta con un margen sur mayor en `PLANET_MARGIN`.
- La cámara sigue mirando al norte (el joystick depende de eso); sólo se adelanta hacia donde navega el barco.

Sin probar:
- Móvil real (iOS Safari): la curva, las estrellas y los 60 fps sólo se han medido en Chromium de escritorio.
- Vuelta completa con la Fiestera a bordo cruzando el borde (la misión mide sus distancias en línea recta, pero sus zonas quedan lejos de los bordes).

## 2026-09-29 — plan 003 T36: logros que se reclaman: almacén, catálogo y señales

Los logros ya no se conceden al cumplirse: se completan (listos para reclamar) y el premio llega al reclamarlos, una vez, igual en `/juego` y en `/mar`. Sin interfaz nueva (el panel con «Reclamar» es T37): hasta entonces nadie puede reclamar desde la web, y los logros completados salen como conseguidos en el panel viejo de `/juego`.

Qué hay:
- Catálogo aprobado (25 logros, 3 ocultos) en `packages/store/src/sample/progress.ts` y `docs/propuestas/logros-catalogo.md` (sin «borrador», con los cambios de Hernán). Cosméticos nuevos: Bandera a cuadros, Estela de burbujas, Estela de rayo y los barcos de estilo Cel-shaded cómic, Boceto a lápiz y Pixel art (ranura nueva `ship`, `assetKey` = id del estilo). «Rayo del Freu» = 43,6 s (`FAST_LAP_MS`): el 80 % de una vuelta limpia medida con el barco base (54,5 s por la ruta segura, 51,3 s por el atajo).
- `@boia/store` (esquema v2): `progress.completeAchievement` (marca en `players[].achievements`, sin libro), `claimAchievement` (fila `achievement` con puntos y monedas + cosmético o barco; `duplicate` si ya estaba, `not_ready` si no se completó), `achievements()` con `state` (`in_progress` / `ready` / `claimed`), `hidden` (ocultos como «???»), `claimedAt` y `reward` (`kind`: coins, badge, ship, cosmetic), `badges()` y `CarnetView.badges` (insignias de lo reclamado), `ships()` (barcos bloqueables y si se tienen). Sale `grantAchievement`. Migración v1 → v2: lo concedido cuenta como completado y reclamado con los mismos saldos; `secretos` recibe su barco (fila de 0/0) y `entrada` su insignia (derivada de la definición).
- `@boia/contracts`: `ACHIEVEMENT_TRIGGERS_DB` (los de Supabase) + `ACHIEVEMENT_TRIGGERS_NEW` (`win_minigame`, `complete_encounter`, `read_bottle`, `throw_bottle`, `create_carnet`, `answer_question`, `visit_world`), `ACHIEVEMENT_STATES`, `ACHIEVEMENT_REWARD_KINDS`.
- `apps/web/app/juego/achievements.ts`: condiciones sólo a partir de lo contado (`achievementFacts` + `achievementGoal` con `done`, también para vuelta, atajo, tiempo, minijuegos, botellas, Carnet, mundos y entradas por eventos distintos), `completeBySignal`, `recordSignal` (avisos «¡Logro completado! Reclama tu premio»), `emitSignal` + `onAchievementNotices` para las señales sin cola de avisos. Sólo necesita `progress`.
- Señales: vuelta con tiempo y ruta (`CircuitRace.checkpoint(order, now, objectId?)` y `finish.route`; `finishLap(progress, spec, ms, route?)`), compra de prueba (`sandbox.ts`), minijuego ganado (`withWinSignal` en `minigame-layer.tsx`), delfín (`grantEncounter`), mundo (`discoverPlace` y al arrancar `/juego`), botella leída/echada (`bottle-sheet.tsx`), Carnet y preguntas (`saveCarnet`).

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint          # exit 0; 62 archivos, 635 pruebas (tras unir main con T35)
E2E_PORT=3238 pnpm e2e --workers=2                # exit 0; 101 pasadas, 19 omitidas (7,9 min, tras unir main)
```

Desviaciones:
- `naufrago-fiesta` usa `deliver_character` (`naufrago`): el náufrago no tiene misión de llevarlo a una fiesta, así que, como `boies-3`, todavía no se puede completar.
- El atajo sólo se detecta en `/juego`: `/mar` llama a `race.checkpoint` sin id de arco y a `finishLap` sin ruta (no se toca `apps/web/app/mar/**`). Allí la vuelta y la vuelta rápida sí cuentan.
- En `/mar` los logros de mundo y de minijuego se completan sin aviso (no escucha `onAchievementNotices`); el del delfín sí avisa. T37 pondrá el contador.
- `fiestera.spec.ts`: los puntos tras la entrega ya no incluyen los del logro (llegan al reclamar).

Sin probar:
- Reclamar desde la interfaz (T37). Supabase: falta la migración (valores nuevos del enum `achievement_trigger`, logros completados sin reclamar, `badge_key`).

## 2026-09-29 — plan 003 T35: «Entradas» siempre a mano con viaje en turbo, y diálogos que se leen

Botón «Entradas» fijo en `/mar` (REQ-ENT-040) y tiempo de lectura con botón de cerrar para bocadillos y avisos en `/mar` y `/juego` (REQ-AVE-002, REQ-IDE-026, D-22). Todo `muestra`, pendiente de Álvaro.

Qué existe:
- `/mar`, botón «🎟️ Entradas» abajo en el centro (`data-testid="mar-entradas"`), a cualquier zoom y en el mapa; con la ficha abierta se sube encima de ella (`--lift`, medido con `ResizeObserver`) y va por encima del bocadillo y del joystick (z-index 7). Al tocarlo: la isla del evento vigente (`currentEventTrip` en `apps/web/app/mar/sheet.tsx`: islas cuyo TICKET/CONTENIDO de evento, ya re-ligado por el Admin, apunta a un evento a la venta; primero el destacado de la landing, luego el más próximo) → `Mar3D.startVoyage(placeId)`: rumbo con piloto automático, turbo sostenido (2,6× la velocidad máxima, estela a tope, `fovKick`), cámara de vuelta al barco siguiéndolo; al llegar se abre `SandboxCheckout` de ese evento. «Saltar ›» (`mar-entradas-saltar`) o tocar otra vez el botón lo abren ya; con `prefers-reduced-motion` se abre directo; sin evento vigente lleva a `/#tickets`. Si el jugador toma el timón (arrastrar, flechas, tocar el mar, quitar rumbo) el viaje se cancela; tope de 20 s (si no llega, se abre el checkout igual).
- Tiempo de lectura: `readableDurationMs(text)` en `packages/engine/src/ui/notifications.ts` = máx(3 s, 3 s + 60 ms por carácter desde el 50), tope 8 s. `NoticeQueue({ readable: true })` lo usa por aviso (título + cuerpo); `WorldRuntime({ readableDialogue: true })` hace durar cada línea (y la reacción) máx(intervalo, lectura) con tope 8 s. Sin las opciones, todo como antes (1,5 s y 4 s de D-07). `/mar` y `/juego` encienden las dos (`useNoticeQueue(..., { readable: true })`, `runtime.readableDialogue`). El intervalo de DIÁLOGO admite ahora hasta 8 s (antes 5).
- Cerrar: `/mar` bocadillo con × («Cerrar diálogo», `mar-bocadillo-cerrar`) y el texto sigue avanzando al tocarlo; avisos de `/mar` y `/juego` con × («Cerrar aviso»). `/juego`: × dibujado en la esquina del bocadillo de Pixi (`bubble.ts`, cierra como «Saltar») y un botón oculto «Cerrar diálogo» para el lector de pantalla (`bocadillo-cerrar`).
- Pruebas: unitarias de la regla, la cola con `readable`, cerrar y la pausa (`notifications.test.ts`) y de las líneas del runtime (`runtime.test.ts`); e2e en `mar-3d.spec.ts` (botón encima de todo de cerca, en mapa y con ficha; turbo + «Saltar»; otro toque; llegada del viaje; movimiento reducido; bocadillo con × visible a los 2,5 s).
- Capturas 390×844: `docs/informes/img/p003-t35-entradas.png` (viaje con estela), `p003-t35-dialogo.png` (bocadillo con ×), `p003-t35-entradas-mapa.png` (mapa con ficha, el botón encima).

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint      # exit 0; 60 archivos, 591 pruebas
E2E_PORT=3187 pnpm e2e --workers=2            # exit 0; 101 pasadas, 19 omitidas (7,3 min)
```

Desviaciones:
- Retoques de CSS fuera de los archivos nombrados: `apps/web/app/juego/hud.css` (× del aviso y botón oculto) y `packages/engine/src/world/bubble.ts` (el × del bocadillo de `/juego` vive en el lienzo); `game-canvas.tsx` sólo enciende las opciones y pinta el botón oculto.
- El viaje va a 2,6× (el turbo normal 1,6×): a 1,6× tardaba ~17 s desde la salida; ahora ~11 s.

Sin probar:
- Móvil real (iOS Safari) y el × del bocadillo de `/juego` con el dedo (sin e2e: está en el lienzo).
- El viaje desde todos los puntos del mapa (sólo desde la salida y cerca de la isla).

## 2026-09-29 — plan 002 T30: última pasada de la demo y preparación del despliegue

La versión de prueba entera, repasada de punta a punta en móvil, y lo que Hernán necesita para desplegarla él mismo en Vercel. No se ha desplegado nada.

Qué existe:
- Despliegue sin variables de entorno: `pnpm build` pasa con el entorno vacío; la analítica queda apagada sin `NEXT_PUBLIC_POSTHOG_KEY` (los eventos sólo se apuntan en `window.__boiaAnalytics`); el arte sale del repo por `/api/art` (D-16) también en producción: `next.config.ts` ya metía `art/**` en la traza de la función (`outputFileTracingIncludes`, 23 MB, ningún archivo pasa de 1,6 MB) y ahora la respuesta lleva `s-maxage=86400` para que la CDN de Vercel la guarde y la función no se invoque por cada sprite. Los `.glb` de `/mar` salen por el mismo camino. Sin `vercel.json`: bastan los ajustes del proyecto (Root Directory `apps/web`, archivos de fuera incluidos, Node 24, sin variables).
- `README.md` (nuevo): el repo en local y la sección «Desplegar la versión de prueba» (ajustes del proyecto en Vercel, `git push` o `vercel` / `vercel --prod` desde la raíz, y cómo comprobar el despliegue).
- e2e `apps/web/e2e/despliegue.spec.ts`: la traza de `/api/art` contiene todo `art/` (con los dos mundos, la entrada y el barco), `/api/art` sirve cada manifiesto e imagen esencial con su tipo y `s-maxage` y rechaza rutas fuera de `art/`, y sin clave de PostHog no sale ninguna petición de analítica.
- Grabación: `apps/web/e2e/record-demo.spec.ts` (sólo con `RECORD_DEMO=1`) → `docs/informes/img/p002-t30-demo-movil.webm`, el recorrido completo en móvil (360×640) sobre el main actual (con `/mar`).

### Guía de la demo (en el móvil, en este orden)

Abrir la URL de producción (o `pnpm demo` y la URL de la Wi-Fi que imprime). Todo es `muestra`; lo que se hace se guarda en ese navegador.
1. **Entrada**: el mini-mundo con las letras 3D «BOIA»; tocar «Zarpar». Aterriza en la bocana y aparece la landing.
2. **Landing**: «Tickets» abre «Elige tu evento» (el All Day, compra de prueba). «Explorar el universo»: la landing se aparta, la cámara se aleja y empieza `/juego` con el barco en el puerto (El Varadero). «Navegar en 3D» lleva a `/mar`, la vista 3D nueva (fuera del plan 002).
3. **Navegar**: el dedo en el mar es el joystick; el minimapa arriba; la primera boia está delante.
4. **La Boia Fiestera**: rumbo norte hasta su remanso; sube a bordo (aviso). Llevarla a su isla (la última, al norte) esquivando los cocodrilos: celebración y premio.
5. **Isla de evento** (el escenario del All Day): se abre su panel; «Comprar entrada» → confirmar (sandbox, rotulado) → «Mi Carnet»: crear el carnet con un apodo y ver el sello.
6. **Una botella**: en Mi Carnet, «Echar una botella», escribir (140 caracteres) y echarla; aparece junto al barco y se lee al tocarla. Sólo la ve su autor en esta versión (D-20).
7. **Un minijuego**: acercarse al Faro (Vigilancia del faro) o al Cañón (Cañón contra tiburones) y jugar hasta el final; «Volver al mar».
8. **Cambiar de mundo**: Menú (ancla) → Mundos → Acuarela; cambian islas, mar y barco sin recargar, y lo descubierto se conserva.
9. **Admin**: Menú → «Probar admin» → Eventos → nuevo evento en la isla de evento, estado «A la venta» → Guardar. Volver al juego y navegar a esa isla: el panel enseña el evento nuevo. «Volver a la muestra» deshace los cambios.
10. **Para curiosear**: náufrago con código de descuento, cofres, delfín, remolino, el circuito de El Freu, Puerto de Fotos, la tienda y los descuentos escondidos; logros, puntos y monedas en el Menú.
Para empezar de cero: borrar los datos del sitio en el navegador.

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint && pnpm build   # con el entorno vacío (env -i PATH HOME USER): exit 0; 60 archivos, 585 pruebas; landing 173,9 kB de 192 kB
E2E_PORT=3163 pnpm e2e --workers=2                       # exit 0; 93 pasadas, 19 omitidas (6,7 min)
RECORD_DEMO=1 E2E_PORT=3171 pnpm e2e record-demo.spec.ts --project=mobile --workers=1   # exit 0; 1 pasada (1,9 min), vídeo de 58 s, 1,3 MB
```

Desviaciones:
- `apps/web/e2e/*.spec.ts` nuevas: son las pruebas del despliegue y la grabación que pide el encargo (apps/web/** está en el alcance).
- Las pruebas de `packages/db` necesitan el PostgreSQL 17 local (D-17), que no estaba arrancado; se arrancó con `LC_ALL=en_US.UTF-8 pg_ctl -D /opt/homebrew/var/postgresql@17 start` (sin `LC_ALL` no arranca: «postmaster became multithreaded») y se paró al terminar.

Sin probar:
- Un despliegue real en Vercel (no se despliega en los encargos): que la función encuentre `art/` desde `apps/web` como en local, y las cabeceras de la CDN.
- iOS Safari real y móviles lentos.

## 2026-09-29 — plan 003 T32: decisión D-22 y borrador del catálogo de logros

Sólo documentos; no se toca código.

Qué hay:
- `docs/DECISIONES.md`: D-22 (Hernán, pendiente Álvaro) con los cinco puntos: `/mar` como vista 3D del mapa compartido (three.js sólo allí, corrige D-05 para esa ruta), planeta de agua sin costas con vuelta, cielo y estrellas (`/juego` conserva sus costas), botón «Entradas» siempre visible con viaje en turbo y checkout al llegar, diálogos y avisos de al menos 3 s con botón de cerrar (corrige los 1,5 s y 4 s de D-07), y logros que se reclaman con premio según el logro. Nueva pregunta P14 para Álvaro.
- `docs/spec/`: modificados REQ-MUN-001, REQ-MUN-011, REQ-AVE-002, REQ-IDE-024, REQ-IDE-025, REQ-IDE-026, REQ-IDE-031 y REQ-COM-035; nuevos REQ-MUN-038 (planeta de agua de `/mar`), REQ-ENT-040 (botón «Entradas» de `/mar`) y REQ-IDE-052 (premio según el logro). Filas en 09, tablas de 00-indice y glosario al día.
- `docs/propuestas/logros-catalogo.md`: borrador de 23 logros (escalones, 3 ocultos, uno o más por actividad), con señal existente o NUEVA, premio por tipo, qué pasa con los 10 logros de hoy (`boies-6` → `boies-3`) y 9 puntos abiertos para Hernán. Espera su aprobación antes de T36.

Comandos:
```
python3 tools/spec/check.py        # exit 0; 289 requisitos, 0 duplicados, centinelas 10/10
python3 tools/spec/test_check.py   # exit 0; 18 pruebas
```

Desviaciones:
- D-22 fija la regla de duración de T35 (+60 ms por carácter a partir del 50, tope 8 s) como valores de muestra, marcados `[provisional]` en REQ-AVE-002.
- El minimapa redondo de `/mar` (T34) no entra en D-22: no estaba entre los cinco puntos.

Sin probar:
- Nada que ejecutar más allá de la comprobación de la spec.

## 2026-09-29 — plan 002 T29: pulido esencial, presupuesto de la landing y una suite e2e que termina sola

Reducido a lo esencial tras dos intentos atascados. De sus ramas WIP se tomó sólo lo terminado y probado (landing, Playwright, minimapa); el sonido, WebKit, las specs de rendimiento y accesibilidad, el presupuesto de /juego y lo de `art/` se dejan fuera.

Qué cambia:
- Landing ≤ 192 kB gzip (`scripts/landing-budget.mjs`, presupuesto bajado de 1 MB a 192 kB; `pnpm build` falla si se pasa). El servidor resuelve la home (`resolveHome` en `lib/landing/resolve.ts`: bloques visibles, pie, secciones, panel de Tickets, ids comprables) y el cliente recibe esa vista ya resuelta; `resolve.ts` (y con él los esquemas de `@boia/contracts` y zod) sólo se carga con `import()` cuando llega el contenido del repositorio (`useLiveHome(initial, derive)`). `EventCard`, `HomeBlocks`, `TicketsPanel` reciben `buyable` en vez de llamar a `canBuy`. `/artistas` pasa sólo la lista de artistas.
- Playwright termina solo: `webServer` corre `node scripts/e2e-server.mjs <puerto>` (`next build` y `next start` como hijos directos de Node, sin pnpm por medio; reenvía señales y se para si Playwright desaparece) con `gracefulShutdown` SIGTERM. Antes, pnpm dejaba el `next-server` fuera del grupo y Playwright esperaba por él.
- Minimapa: `minimapProjection` nunca da escala negativa y `MapSvg` no pinta tamaños negativos (errores de SVG en consola al redimensionar).
- Accesibilidad de Pixi apagada (`packages/engine/src/pixi-app.ts`, `newApplication()` en juego, entrada y prueba de la esfera): ya no mete el `<button>` invisible «select to enable accessibility…» que era parada del tabulador en móvil, ni activa capas con Tab en escritorio. `extensions.remove(AccessibilitySystem)` no sirve (el renderer lo recoge de la cola de extensiones al cargar su chunk, después), así que se anula `_createTouchHook` (privado de Pixi; si Pixi lo renombra, la e2e lo detecta) y `activateOnTab = false`.
- Pruebas: `packages/engine/src/ui/minimap.test.ts` (huecos 0, menores que el margen y negativos), `blocks.test.ts` y `event-card.test.ts` adaptados, e2e nuevo en `juego-hud.spec.ts` (sin botón de accesibilidad de Pixi, sin errores «negative value» al pasar el viewport a 40×40 y volver).

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint          # exit 0; 59 archivos, 579 pruebas
pnpm build                                        # exit 0; landing 173,7 kB gzip de 192 kB
E2E_PORT=3261 timeout 1500 pnpm e2e --workers=2   # exit 0; 85 pasadas, 15 omitidas (6,0 min); termina sola, sin next-server en el puerto
```

Desviaciones:
- macOS no trae `timeout`: se usó un sustituto en Perl (mismo uso, sale con 124 si vence).

Sin probar:
- iOS Safari real (WebKit no está en la suite).

## 2026-09-29 — plan 002 T24: el mundo Acuarela en el juego y el cambio de mundo

`/juego` tiene dos mundos terminados sobre el mismo mapa: Arcilla (B05, el por defecto) y Acuarela (B02). Se cambia desde el Menú («Mundos») o como mundo activo del Admin. Nombres, textos, colores e historia son `muestra` [pendiente Álvaro, preguntas en `mundos/acuarela/diseno.md`].

Qué existe:
- Piel `acuarela` (`packages/world/src/worlds/acuarela/skin.ts`): arte de T19 (`art/mundos/acuarela/<lugar>/`) para cada lugar del mapa compartido, las mismas piezas que Arcilla en la carpeta de Acuarela; nombres de `mundos/acuarela/lugares.json` (sitios reales: La Explanada, Cala Cantalar, L'Albufereta, La Vila Joiosa, Altea, Tabarca, La Nao, Cap de la Nau, El Penyal, Cap de l'Horta, Torre de l'Illeta); bocadillos y textos de `diseno.md` (la noche de Sant Joan); mar turquesa de `lugares.json`, acento azul del casco B02, barco `acuarela`. La isla de evento `allday` conserva el nombre compartido. Los secretos van con marcador, como en Arcilla. Ningún lugar se mueve: posiciones, geometría y comportamientos son los del mapa (Faro y Cañón abren los mismos minijuegos; el minijuego toma la piel `wash` por el id del mundo).
- `place-art.ts`: la correspondencia lugar del mapa → pieza de arte, una sola para todos los mundos (`sharedPlaceAsset`, `sharedCoastArt`); Arcilla la usa también. El mundo `prueba` de T20 desaparece: `WORLD_REGISTRY` = Arcilla + Acuarela.
- Misión de la Fiestera: la de T21 (`rescueMissionOf`), que sale de los datos del mapa compartido (`params.mission`, cocodrilos de su zona, `params.missionDestination`), vale igual en Acuarela sin tocarla: mismo personaje, cocodrilos, radios y destino (Tabarca, el lugar `ultima`); la tripulante a bordo es la pieza `mundos/acuarela/fiestera#tripulante`, que `/juego` pone con `setCrewArt` al arrancar y al cambiar de mundo. Los bocadillos de la Fiestera en Acuarela son los de su skin (farolillos, Tabarca).
- Mover un lugar: `WorldRegistry.movePlace(id, x, y)` / `movePlace(map, …)` devuelve un registro nuevo con el lugar movido en el mapa, así en todos los mundos (lo que aplicará un `PlacePatch` del Admin).
- Entrada (T28): `apps/web/lib/intro/worlds.ts` tiene la entrada de `acuarela` (la misma que Arcilla: mismo mapa, mismo aterrizaje en la bocana y mismo encuadre del puerto), y `lib/intro/active.ts` mira también el mundo activo del Admin (`adminWorldId`), como `/juego`.
- Web: sección «Mundos» del Menú (`menu/sections/mundos.tsx`, 🌍, entre Descuentos y Barco): cada mundo con su nombre, su línea de historia y su barco (miniatura y nombre del catálogo de «Barco»); elegir cambia el mundo sin recargar (`game.setWorld`, el barco sigue donde está), lo guarda en `boia:mundo` y, si no se eligió barco en «Barco», pone el del mundo. «Barco» sigue cambiándolo (y entonces vale en todos los mundos). La barra del menú admite nueve iconos en 360 px (mínimo 34 px).
- Mundo activo del Admin, una sola fuente: el repositorio local (`repo.content.activeWorldId`). `world-choice.ts` exporta `adminWorldId()` y `setActiveWorld(id | null)` (que es la acción `setActiveWorld` del Admin de T26); `/juego` lo lee antes de arrancar el motor y aplica encima los cambios del Admin (`liveWorld` de T26, también al cambiar de mundo). Orden: `?mundo=`, elección del visitante, mundo activo, por defecto. El Admin de T26 ya no copia el mundo activo a `boia:mundo-activo` (`choiceStorage` fuera de `createAdminActions`): nadie la lee; la que quede en navegadores viejos se ignora.
- Pruebas: `packages/world/src/worlds/acuarela/acuarela.test.ts` (cada lugar tiene piel de Acuarela con arte existente, misma pieza que Arcilla, todo el catálogo usado, mismos sitios y comportamientos, mover un lugar lo mueve en los dos, nombres de lugares.json y nombre compartido de la isla de evento, Faro y Cañón), `packages/engine/src/mission/worlds.test.ts` (la misión de T21 es la misma en cada mundo salvo la tripulante, que existe en art/), `apps/web/app/juego/world-switch.test.ts` (lo descubierto, un premio «una vez» y un descuento en Arcilla siguen al pasar a Acuarela y al volver, sin volver a darse). e2e `apps/web/e2e/mundo-acuarela.spec.ts`: Menú → Mundos → Acuarela (cambia mundo y barco), a la isla de evento, recarga (sigue en Acuarela) y al náufrago con su código; móvil y escritorio.

Comandos (tras integrar T26, T21 y T28):
```
pnpm test && pnpm typecheck && pnpm lint                              # exit 0; 59 archivos, 578 pruebas
pnpm world:check                                                      # exit 0; arcilla y acuarela: 94 lugares, 0 sin skin
E2E_PORT=3245 pnpm e2e --workers=2 e2e/admin.spec.ts e2e/mundo-acuarela.spec.ts e2e/mundo-arcilla.spec.ts e2e/intro.spec.ts   # exit 0; 46 pasadas
E2E_PORT=3243 pnpm e2e --workers=2                                    # antes de integrar: exit 0; 80 pasadas, 14 omitidas
```

Desviaciones:
- `apps/web/e2e/mundo-acuarela.spec.ts` está fuera del alcance escrito: es la spec que pide el encargo.
- Fuera del alcance escrito, por la integración con T26 y T28 (orden del orquestador): `apps/web/lib/admin/actions.ts`, `apps/web/lib/admin/admin.test.ts` y `apps/web/app/admin/use-admin.ts` pierden la copia del mundo activo en `boia:mundo-activo`; `apps/web/lib/intro/worlds.ts` y `active.ts` (entrada de Acuarela y mundo activo del repositorio).
- Como en T20, Playwright se quedó esperando al `next-server` huérfano de su `webServer` tras terminar las pruebas; se paró a mano ese proceso (el del puerto de la prueba, de este worktree).

Sin probar:
- La misión entera de la Fiestera en Acuarela en e2e (la spec de T21 corre en el mundo por defecto); en Acuarela sólo con pruebas unitarias.
- Móviles reales: rendimiento del arte de Acuarela y el cambio de mundo en caliente.

## 2026-09-29 — plan 002 T28: EXPLORAR descubre el puerto y la aventura empieza allí

La entrada ya no es el mundo de muestra de plan 001: es el mundo activo (Arcilla por defecto) y aterriza en su punto de aterrizaje, la bocana de El Varadero. Al pulsar EXPLORAR la landing se aparta, la cámara se aleja un poco (de ×1,3 en móvil y ×1,45 en escritorio a la escala del juego, ×1) hasta el encuadre con el que empieza el juego —el barco en el anillo de salida, la primera boia delante y el mar abierto hacia el norte, camino de la Fiestera— y entonces la escena pasa a `/juego` (T12). Zoom, anclas, tamaño del mini-mundo y duración son `muestra` [pendiente Hernán/Álvaro en móvil real].

Qué existe:
- `packages/engine/src/intro/port.ts` (puro): `WorldIntro` (datos de entrada de un mundo: encuadre de llegada por ancho, trozo de mapa del mini-mundo y distancia de carga, duración y curva del alejamiento) con `validateWorldIntro`; `introConfigForWorld` (la configuración con el aterrizaje del mundo, su llegada y el barco en la salida mirando a su rumbo); `portReveal` / `portCamera` (la cámara con la que arranca el juego: centrada en el barco, sin bajar de la franja de tierra, `GAME_BOTTOM_LAND_PX` = `BOTTOM_LAND_PX` de `game.ts`, una prueba lo vigila); `revealCamera` (centro en línea recta, zoom en escala logarítmica); `shipViewFor`.
- `timeline.ts`: acto `explore` (`exploreFrame`). `controller.ts`: fases `exploring` y `explored`; `explore(vistaDelJuego)` se aleja y arranca el juego al pintar el último fotograma, una vez; sin escena o con movimiento reducido arranca ya (REQ-ENT-010); pestaña oculta a medias lo termina; salir de la landing a medias no arranca nada. La escena puede traer su propia configuración, geometría y alejamiento (`IntroSceneHandle.view`), que el controlador adopta al llegar.
- `world-geometry.ts`: el mini-mundo es un cuadrado del mapa centrado en el aterrizaje (`miniWorld.span`, 2400 u), no el mapa entero (Arcilla mide ~11 000 × 21 000 u: ni cabe en la textura ni su arte, 6 MB, en lo que dura la carga); `nearbyWorld` deja sólo los objetos y las costas cercanas; `worldIntroSetup` lo junta. `scene.ts` pinta las costas como el juego (`createWorldCoastView`, las tiras de Arcilla) y el mar con los colores del mundo.
- `apps/web/lib/intro/worlds.ts`: datos de entrada por mundo (`WORLD_INTROS`, con `DEFAULT_WORLD_INTRO` para los que no tienen) y los puntos del mapa con lo que dejó el Admin (`mapa:entrada`, `mapa:salida`, `mapa:puerto`, T26). `lib/intro/active.ts` (navegador): el mundo de `/juego` en este navegador (`?mundo=`, elegido, activo del Admin) con los cambios del Admin, y el estilo de barco que llevará. `lib/intro/load.ts` (servidor): la entrada del mundo por defecto, la ilustración ligera como las piezas junto al aterrizaje (el puerto) en vez de la isla de muestra, el barco de cada estilo en su vista de salida y la precarga sólo de lo cercano.
- `intro-stage.tsx`: EXPLORAR sube arriba, pone `html[data-explore]` (la landing se funde, `landing.css`), se aleja y al terminar cede la escena y navega; lleva `?mundo=` a `/juego` si la landing lo traía. Diagnóstico nuevo en `window.__boiaIntro`: `world`, `landingPoint` y `reveal` (inicio, fin, vista del juego, última cámara y dónde quedaron barco y puerto).
- `/juego` (arranque): el canvas cedido se enseña nada más montar, antes de que cargue el juego (antes se veía el fondo un momento); si se desmonta antes de arrancar, la escena vuelve a quedar en oferta.
- Pruebas: `packages/engine/src/intro/port.test.ts` (móvil y escritorio: EXPLORAR sólo aleja, termina en la cámara del juego con el barco en la salida del mundo activo y el puerto a la vista, arranca el juego una vez y después no pinta; vista del juego distinta de la escena; movimiento reducido; pestaña oculta; salir a medias; franja de tierra igual a la de `game.ts`; validación) y `apps/web/lib/intro/worlds.test.ts` (cada mundo registrado tiene entrada; el Admin mueve aterrizaje, salida y puerto y la entrada y el juego salen del mismo sitio; el encuadre del puerto de cada mundo enseña el puerto). e2e: `demo.spec.ts` comprueba en móvil y escritorio que la entrada es la del mundo activo, que el alejamiento se ve entero y acaba a escala de juego con barco y puerto en la vista, y que el juego arranca con el barco en la salida (minimapa), también por enlace directo a `/juego`; `intro.spec.ts` comprueba la ilustración del puerto con el motor bloqueado.

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint                      # exit 0; 53 archivos, 537 pruebas
E2E_PORT=3241 pnpm e2e --workers=2 e2e/demo.spec.ts           # exit 0; 8 pasadas
E2E_PORT=3251 pnpm e2e --workers=2                            # exit 0; 80 pasadas, 14 omitidas
```
Como en T20 y T26, al terminar la suite Playwright esperaba a un `next-server` huérfano del `webServer`: se paró a mano (el del puerto de la prueba, de este worktree) con todas las pruebas ya con resultado.

Desviaciones:
- El mini-mundo de la entrada es el puerto y su mar (un trozo de 2400 u del mapa), no el mapa entero: con Arcilla, el mapa entero no se ve en una esfera de móvil ni carga a tiempo. Es un dato por mundo (`miniWorld.span`).
- La llegada de la entrada queda más cerca que antes (×1,3 móvil, ×1,45 escritorio; antes ×0,72 y ×1) porque el juego va a ×1 sin zoom propio: para que EXPLORAR se aleje y el relevo no salte de escala, la llegada tiene que estar más cerca que el juego. `validateWorldIntro` exige zoom de llegada ≥ 1.
- Arreglo de paso en `scene.ts` (`release`): el mar cedido llegaba al juego desplazado a la cámara de la entrada; con las coordenadas de Arcilla quedaba fuera de la vista y en `/juego` adoptado se veía sólo el color de fondo, sin olas. Ahora se entrega en el origen, como lo pinta el juego.
- `apps/web/app/juego/demo-world.ts`: sólo el comentario (la entrada ya no usa el mundo de muestra).
- La ilustración ligera y la página estática usan el mundo por defecto sin cambios del Admin; el navegador recalcula la escena con los suyos. Si el Admin mueve el aterrizaje, la ilustración ligera (sólo sin motor) sigue en el sitio de muestra.

Sin probar:
- Móviles reales: tiempo de carga del arte del puerto y de las tiras de costa dentro del presupuesto de 2 s; la sensación del alejamiento.
- Con una skin temática del barco guardada, la entrada enseña la skin `base` y el juego la temática (cambia al pasar).
- Acuarela (T24) usa `DEFAULT_WORLD_INTRO` hasta que tenga su entrada propia.

## 2026-09-29 — plan 002 T21: misión de la Boia Fiestera, logros, puntos y monedas

La misión principal (REQ-AVE-005…011) y el sistema de logros (REQ-IDE-024…027) en `/juego`, sobre el repositorio local de T16. Textos, premios, tiempos y la lista de logros son `muestra` [pendiente Álvaro].

Qué existe:
- Motor, `@boia/engine/mission` (`packages/engine/src/mission/rescue.ts`, puro): `rescueMissionOf(world)` saca la misión de los datos del mapa, genérica por mundo (T24 la reutiliza para Acuarela sin tocarla): el personaje es el objeto con `params.mission` (`fiestera`, personaje `boia-fiestera`), los cocodrilos son los de categoría `cocodrilo` de su zona, el destino es el lugar con `params.missionDestination` (sin destino no hay misión). `RescueMission`: `loading` → `waiting` → `boarding` → `aboard` → `landing` → `delivered`. Con el barco a menos de `crocRadius` los cocodrilos se sumergen de uno en uno (el más cercano primero, cada 0,4 s) y al alejarse vuelven; en el radio de rescate y con todos abajo, ella sale del agua y sube al barco con un saltito (1 s) y pasa al slot TRIPULANTE; en el radio del destino, desde cualquier lado, baja (1,2 s) y se queda en el nicho de la isla (`params.missionDrop`). El destino se fija al rescatar y se guarda por id de lugar: sobrevive al cambio de mundo y a que el Admin cambie el de las partidas nuevas. `setWorld` pasa la misión a otro mundo sin perder paso ni destino.
- Motor: `WorldRuntime.moveObject(id, x, y, z)` (altura sólo visual) y `setObjectInteractive(id, on)` (sin choque, proximidad ni diálogo: la Fiestera subiendo y ya en su isla); `ObjectView` reproduce `sumergirse` (y al revés al emerger) con anillos de onda si el arte lo trae (los cocodrilos de T18); `Game.setCrewArt(asset)` dibuja la pieza `tripulante` del mundo (`mundos/<mundo>/fiestera#tripulante`, bailando) sobre `slot_passenger`, también al cambiar de barco; `GameOptions.onStep` (cada paso fijo) para guiones de la web; `hudLayout` tiene `balances` (saldos junto a Inicio, antes que los datos de depuración).
- Mapa (`packages/world/src/worlds/arcilla/map.ts`): la Fiestera pide ayuda desde el radio de los cocodrilos (4,0) y sube a bordo en el de rescate (2,6); `ultima` lleva `missionDrop` (el nicho, delante de la isla con altura) y `missionReward` (100 puntos y 100 monedas, muestra).
- Web: `apps/web/app/juego/mission.ts` guarda el paso con `progress.setMission('fiestera', …)` (destino y temporada por id, nunca coordenadas), concede el premio grande una vez para siempre (`mision:fiestera:entrega`) y los logros de rescate y entrega; avisos «Nueva tripulante a bordo · Boia Fiestera rescatada · Destino: última isla» y el de la fiesta, confeti (`celebration.tsx`), `fanfare()` en `sound.ts`. A bordo, la Fiestera reacciona en el aviso de cada isla nueva. Sin recordatorio permanente de misión. `?pasajera=1` sigue enseñando el slot sin misión.
- Web: `achievements.ts`: señales (boia, isla, secreto por categoría, tiempo a bordo, rescate, entrega, circuito, entrada) que dejan su huella por id de lugar en el progreso y conceden los logros del catálogo del repositorio (también secretos) cuya condición se cumple; `find_boia` del mapa es `find_buoy` del catálogo. El tiempo a bordo se apunta cada 15 s con la pestaña visible. Los logros del mundo ya no avisan por su cuenta: sólo avisa lo que el repositorio concede (uno a uno, 4 s, cola de T05). Saldos en el HUD (`balances.tsx`, `data-testid="saldos"`) y sección Logros del Menú con puntos, monedas, rango, lo conseguido y lo que falta (X/6 boies, minutos…).
- Pruebas: `packages/engine/src/mission/rescue.test.ts` (pasos en orden, cocodrilos uno a uno, sin rescate con uno arriba, inerte a bordo y entregada, destino guardado tras cambiar de mundo y de destino), `apps/web/app/juego/mission.test.ts` (con repositorio: premio una vez tras recargar, destino tras cambiar de mundo, texto del aviso), `achievements.test.ts` (cada logro del catálogo se concede una vez, no antes y no tras recargar; saldos separados), `hud-layout.test.ts` (saldos). e2e `apps/web/e2e/fiestera.spec.ts` (escritorio): rescate, recarga a bordo, entrega con celebración y logro, y otra visita sin premio repetido.

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint                               # exit 0; 53 archivos, 542 pruebas
E2E_PORT=3171 pnpm e2e --workers=2 e2e/fiestera.spec.ts --project=desktop   # 1 pasada
E2E_PORT=3174 pnpm e2e --workers=2                                     # exit 0; 80 pasadas, 14 omitidas
```

Desviaciones:
- Los radios de la Fiestera: su diálogo salta en el radio de los cocodrilos (4,0) en vez del de rescate, para que pida ayuda mientras se sumergen (REQ-AVE-005) y no se corte al subir a bordo.
- «Seis boies» no se puede conseguir todavía: el mapa sólo tiene una boia con `find_boia` (la del puerto). La lista es muestra.
- Como en T20, al terminar Playwright se quedó esperando a un `next-server` huérfano del puerto de la prueba; se paró a mano ese proceso tras tener todos los resultados.
- Sólo se formatearon con Prettier los archivos nuevos; los ya existentes que se tocaron no estaban formateados en main y se dejaron así para no mezclar cambios con T24.

Sin probar:
- Móviles reales. La misión entera sólo en escritorio (e2e); en móvil, lo mismo con el joystick.
- El cambio de mundo a mitad de misión sólo con pruebas unitarias (en la web el mundo `prueba` usa el arte de Arcilla; la tripulante de Acuarela llega con T24).
- El Admin fijando el destino de las partidas nuevas (REQ-AVE-011) funciona por datos (`params.missionDestination`), pero la pantalla y la migración auditada de partidas existentes son del Admin (T26 o después).

## 2026-09-29 — plan 002 T26: Admin de la demo con el botón «Probar admin»

`/admin` abre el Admin de la versión de prueba (D-20, REQ-ADM-039) sin login, con un aviso fijo arriba: es una demo y los cambios se quedan en este navegador. Se llega desde «Probar admin» en el pie de la landing y en el Menú de a bordo de `/juego`. Copy, números y arte, `muestra` [pendiente Álvaro].

Qué existe:
- Secciones de L1 (REQ-ADM-008), con ancla en la URL (`/admin#mundo`): Página principal (orden con ↑/↓, visible, programar desde/hasta, evento prioritario, titular y subtítulo, vista previa móvil y escritorio en un iframe de `/?intro=0`), Eventos (crear, editar, duplicar como borrador, los siete estados a mano con su nota, isla del evento, papelera y recuperar; «Islas y eventos» dice qué evento abre cada isla y sus recuerdos), Mundo (mapa compartido en miniatura con todos los lugares y los puntos del mapa; por lugar: posición, radio de proximidad, parámetros JSON y activo, «vale en todos los mundos»; por mundo: nombre con la pregunta «Solo en este mundo / En todos los mundos», textos del panel y oculto; salida, puerto y aterrizaje de la entrada), Artistas, Fotos y vídeos (fotos por URL y álbumes; vídeos, con Supabase), Logros y cosméticos (premios, activo, secreto, precios en monedas, umbrales de rango), Moderación (botellas con sus reportes, retirar con motivo, descartar reporte; retirar recompensas del libro con compensación), Textos y música (textos de la landing sin variables; música de cada mundo sólo lectura), Temporadas (mundo activo), Usuarios de administración e Integraciones (sólo lectura) y Auditoría y muestra (lista de la auditoría local, volver a la muestra por área o todo).
- `apps/web/lib/admin/`: `world.ts` (mapa compartido + cambios del repositorio, puro: `applyPlacePatches`, `applySkinPatches`, `linkIslandEvents`, `composeLiveWorld`; puntos del mapa con ids reservados `mapa:salida`, `mapa:puerto`, `mapa:entrada`; `params.proximityRadius` va a la geometría), `validate.ts` (`worldProblem`: ids que existen, dentro del mapa, mundo válido en cada mundo, salida/puerto/aterrizaje y teletransportes en el agua, inundación desde la salida como las pruebas del mar de T09/T20: ninguna isla corta el paso), `actions.ts` (`createAdminActions`: cada cambio pasa por `repo.admin` y su auditoría con autor `admin-demo`; un rechazo es `AdminError` con el motivo), `live-world.ts` (el mundo de `/juego` con los cambios), `dates.ts`, `copy.ts`.
- Evento ↔ isla: el evento lleva `islandId`; la isla abre el próximo evento vigente ligado a ella y vende sus entradas; sin evento vigente abre su panel de isla con sus recuerdos (eventos pasados o terminados), que ahora se listan en el panel de isla de `/juego`.
- La landing lee el repositorio: `LiveLanding` (cabecera, bloques, pie y Tickets) pinta la muestra del servidor y, al montar y con el navegador libre, `gameRepository()` (eventos, bloques, artistas, fotos, textos); sigue escuchando cambios. `main[data-contenido]` dice `muestra` o `repositorio`. `/artistas` igual. `lib/landing/sample-content.ts` sale ahora de la muestra de `@boia/store` (la isla del evento de primavera pasa de `isla-primavera` a `allday`). Textos del Admin sobre la landing con `lib/landing/texts.ts`.
- `/juego` juega el mundo con los cambios del Admin (`liveWorld` antes de arrancar el motor y al cambiar de mundo) y lee los eventos, bloques y fotos del repositorio (`liveContent()`), no de la muestra. El mundo activo del Admin se guarda también en `boia:mundo-activo`, la clave que ya lee `world-choice.ts` (T17).
- Pruebas: `apps/web/lib/admin/admin.test.ts` (el mapa de muestra pasa la validación; cambios inválidos rechazados con su motivo sin tocar nada ni la auditoría: isla sobre la salida, isla encima de un recogible, fuera del mapa, id inexistente, salida en tierra, isla que no admite eventos; un cambio válido vale en todos los mundos; la isla abre su evento vigente y sin él su panel con recuerdos; cada cambio escribe una entrada de auditoría; volver a la muestra deja home, mundo, pieles, textos y temporada como la muestra; renombrar en un mundo o en todos). e2e `apps/web/e2e/admin.spec.ts`: «Probar admin» desde el pie, crear un evento en la isla de evento, subir los artistas en la home, mover la isla (antes, moverla sobre la salida se rechaza por «tierra»), retirar una botella reportada; en la landing el evento y el orden nuevos, en `/juego` la brújula lleva a la isla en su sitio nuevo (mapa ampliado) y su panel abre el evento creado; el Menú de a bordo enlaza al Admin. Móvil y escritorio.

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint                      # exit 0; 51 archivos, 521 pruebas
E2E_PORT=3187 pnpm e2e --workers=2 e2e/admin.spec.ts          # exit 0; 2 pasadas
E2E_PORT=3193 pnpm e2e --workers=2                            # exit 0; 80 pasadas, 14 omitidas
node apps/web/scripts/landing-budget.mjs                      # 201,3 kB de 1024 kB, OK
```
Como en T20, al terminar la suite Playwright esperaba a un `next-server` huérfano del `webServer`: se paró a mano (el del puerto de la prueba, de este worktree) cuando todas las pruebas tenían resultado.

Desviaciones:
- Fuera del alcance escrito, por necesidad para «verlo en el mundo»: en `apps/web/app/juego/` además del botón del menú (`menu/onboard-menu.tsx`), `game-canvas.tsx` (mundo con cambios del Admin y eventos del repositorio) y `place-panels.tsx` (contenido del repositorio y recuerdos de la isla). Cambios pequeños; T21 y T24 tocan los mismos archivos.
- El reporte de la botella se siembra en `localStorage` en el e2e (reportar de verdad exige Carnet y navegar hasta la botella).
- «En todos los mundos» deja el mismo nombre propio en cada mundo registrado (el repositorio no guarda nombres comunes del mapa); un mundo que se registre después no lo hereda.
- La validación del mar replica en `lib/admin/validate.ts` los obstáculos sólidos del motor (`solidObstaclesOf`) y el radio del casco (13,5): `packages/engine` estaba fuera del alcance y su índice arrastra Pixi.
- El editor visual (arrastrar y soltar) queda para después, como pide el encargo.

Sin probar:
- Móviles reales. El aterrizaje de la entrada se guarda y se valida, pero la entrada todavía usa el mundo de muestra (T28).
- Ocultar el bloque del hero con la entrada en marcha: el script de arranque decide con la muestra del servidor.

## 2026-09-29 — plan 002 T20: el mundo Arcilla en el juego, con cada isla y encuentro

`/juego` ya no abre el mundo de muestra de plan 001: abre Arcilla (B05) sobre el mapa compartido sacado de `mundos/arcilla/mapa.json`. Textos, radios, premios, descuentos y nombres son `muestra` [pendiente Álvaro].

Qué existe:
- Mapa compartido (`packages/world/src/worlds/arcilla/map.ts`, id `boia-mapa`): cada lugar de mapa.json con su `source` (ruta en mapa.json o pieza de T18). `units.ts` pasa u_maq a unidades del motor. Puerto El Varadero con anillo de salida (spawn), escolleras, balizas, boia y WhatsApp; Cala del Alfar (isla secundaria con recuerdos), isla de evento `allday` (panel del evento, entradas y recuerdos; compra de T25), Puerto de Fotos (abre la galería `/#fotos`), isla tienda (enlace externo en otra pestaña), Última isla (Isla del Amanecer), Faro y Cañón con `start_minigame` (`faro`, `canon`), náufrago que pide que lo lleven y da un código de descuento, restos y cofres con descuentos escondidos y monedas, delfín, remolino, secretos sin brújula, botellas (`BOTTLE_SPOTS`), el circuito El Freu (salida, CP1, ruta segura / atajo, CP2, meta, semáforo, carteles y obstáculos) y costas con esquinas y borde de abajo (arriba abierto).
- Encuentro de la Fiestera sin lógica de misión: la Fiestera, la posidonia, los cocodrilos y las rocas son objetos del mundo; `moveObject` y `setObjectPresent` del runtime permiten que T21 los mueva y los oculte.
- Piel `arcilla` (`skin.ts`): arte de `art/mundos/arcilla/<lugar>/` pieza a pieza (sprites y losas de costa), nombres de `diseno.md`. Secretos y grada sin arte: marcador a propósito. `WORLD_REGISTRY` usa `arcilla` por defecto; `prueba` sigue para el cambio de mundo hasta T24. `SAMPLE_MAP` queda para pruebas y la entrada.
- Motor: colisión con varios círculos por objeto, vaivén (`params.patrol`), remolino (`params.swirl`), `@boia/engine/circuit` (carrera pura: cuenta atrás, arcos en orden, las dos ramas valen, se anula al abrir panel / ocultar pestaña / teletransportarse, caduca; récord local por circuito y versión que sólo mejora).
- Web: `world-progress.ts` lleva premios, descuentos y descubrimientos a `repo.progress` (el descuento se concede una vez, también tras recargar; el caducado se guarda y se enseña como caducado). `place-panels.tsx` (panel de evento, descuento con copiar de un toque, fotos, tienda), `circuit-hud.tsx` (cronómetro pequeño y récord), `encounters.ts` (delfín y remolino), sección Descuentos del Menú. Minimapa y brújula listan los lugares nuevos. `?cerca=<lugar>` empieza al sur de un lugar (pruebas y enlaces).
- Pruebas: `packages/world/src/worlds/arcilla/arcilla.test.ts` (cada lugar de mapa.json está en el mundo y en su sitio, costas, arte de cada lugar), `packages/engine/src/world/arcilla.test.ts` (ninguna isla corta el paso, la bocana está abierta, ningún teletransporte deja el barco en tierra), `encounters.test.ts`, `circuit/race.test.ts` (récord local), `apps/web/app/juego/world-progress.test.ts` (descuento una vez). e2e `apps/web/e2e/mundo-arcilla.spec.ts`: del puerto a cada tipo de lugar (isla de evento, náufrago, descuento, Fotos, tienda, salida del circuito), móvil y escritorio.

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint                              # exit 0; 50 archivos, 513 pruebas
E2E_PORT=3163 pnpm e2e --workers=2 e2e/mundo-arcilla.spec.ts          # 16 pasadas
E2E_PORT=3166 pnpm e2e --workers=2                                    # exit 0; 78 pasadas, 14 omitidas
```

Desviaciones:
- Fuera del alcance escrito, por necesidad: `apps/web/lib/repo.ts` (botellas de muestra en los sitios de botella del mapa), `apps/web/lib/intro/load.ts` y `packages/engine/src/intro/{scene,sphere-probe}.ts` (una costa sin `asset` único: la de Arcilla va por losas), y `apps/web/e2e/mundo-arcilla.spec.ts` (la spec que pide el encargo).
- `demo.spec.ts` y `tickets.spec.ts` (fuera del alcance escrito) cambian porque el mundo por defecto ya no es el de muestra: el barco por defecto es el del mundo (`arcilla`), y el tramo hasta la isla de evento empieza con `?cerca=` (tras EXPLORAR el juego adopta la superficie de la entrada pero juega Arcilla desde el anillo del puerto, lejos de la isla; que EXPLORAR descubra el puerto es de T28).
- En esta máquina, al terminar la suite Playwright se quedaba esperando a un `next-server` huérfano del `webServer`; se paró a mano ese proceso (el del puerto de la prueba) después de que todas las pruebas tuvieran resultado.
- Las pruebas e2e empiezan con `?cerca=<lugar>` y navegan hasta él: cruzar el mapa desde el puerto para cada lugar pasaría del minuto por lugar. Sólo la primera sale del anillo del puerto.

Sin probar:
- Móviles reales: rendimiento con todas las piezas de Arcilla en pantalla.
- El delfín y el remolino sólo con pruebas unitarias, no en e2e.

## 2026-09-29 — plan 002 T19: mundo Acuarela (B02), diseño y arte sobre el mapa compartido

El segundo mundo, Acuarela ilustrada, sobre el mismo mapa que Arcilla (D-20): mismos 19 ids, posiciones, huellas, anclajes y animaciones; cambian la isla, el hito, el nombre y la historia. Todo es `muestra`.

Qué existe:
- `mundos/acuarela/diseno.md`: concepto, historia (el cuaderno de viaje de una pintora de Cala Cantalar; la noche de Sant Joan, de la Explanada a la hoguera de Tabarca) y una sección por id del catálogo compartido (lugar real, papel, hito, historia, arte), paleta, cómo se pinta, decisiones y preguntas para Álvaro. Nombres de sitios reales de la costa de Alicante; `allday` (la única isla de evento) conserva el nombre compartido.
- `mundos/acuarela/lugares.json` (nombre, lugar real, hito, historia y anclajes por id), `tema.py` (estilo 02 del barco B02, ruido en píxeles de pantalla y periódico en las losas), `piezas.py` y `zonas/*.py` (las escenas de cada lugar).
- `mundos/acuarela/herramientas/cobertura.py`: por cada id de `tools/blender/lugares.json` comprueba entrada en `lugares.json`, sección en `diseno.md`, manifiesto e imágenes en `art/mundos/acuarela/<id>/`, y el nombre (igual al de arcilla en islas de evento, distinto en el resto). Sale con 1 si falta algo.
- `art/mundos/acuarela/<id>/`: 19 lugares, 116 imágenes, un `manifest.json` por lugar como en T18. La Fiestera a bordo es la pieza `tripulante` con `attach` al `slot_passenger` de `art/barco/estilos/acuarela` (B02).
- `tools/blender/mundo_acuarela.py` (el mundo, con `postprocess`: la pasada de acuarela sobre cada PNG, sin el velo exterior por las notas_render de B02) y `WORLDS` con `acuarela` en `render.py` y `mundos_arte.py`; `mundos_arte.py` admite un `postprocess(img, period)` opcional por mundo (en losas, sobre los tres periodos antes de recortar). `contact_sheet_mundo.py` conoce el mar y el barco de acuarela.

Comandos:
```
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/render.py -- --all --out tools/blender/out/t19a   # exit 0, 502 imágenes, ~300 s (acuarela ~126 s)
(el mismo con --out tools/blender/out/t19b) && diff -r tools/blender/out/t19a tools/blender/out/t19b             # exit 0: 556 archivos idénticos
diff -rq tools/blender/out/t19a art        # todos los PNG iguales a los del repo; sólo cambian 35 líneas sources_sha256 (ver desviaciones)
python3 tools/blender/check.py             # exit 0: 55 manifiestos, 504 imágenes; «mundo acuarela: 19 lugares válidos, 116 imágenes»
python3 mundos/acuarela/herramientas/cobertura.py   # exit 0: 19 lugares, 0 faltas
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/contact_sheet_mundo.py -- --mundo acuarela --out docs/informes/img/p002-t19-hoja-acuarela.png
pnpm test                                  # exit 0: 45 archivos, 478 pruebas
```
Hoja de contacto a escala de juego (dpr 2) sobre el mar del mundo: `docs/informes/img/p002-t19-hoja-acuarela.png`.

Desviaciones:
- Las `--all` se corrieron con `--out` en `tools/blender/out/` y no sobre `art/`: los manifiestos de `art/barco/**`, `art/mundos/arcilla/**` y los recursos viejos llevan un `sources_sha256` de antes (cambian `render.py` y `mundos_arte.py`), y regenerarlos habría tocado `art/mundos/arcilla/**`, fuera del alcance. Sus PNG salen idénticos; el próximo `--all` sobre `art/` sólo cambia esa línea.
- Costas: la junta entre los dos tramos de la Platja de Sant Joan se desplaza 2,2 u (`FASE_E`) para que no caiga en la costura de la losa (check.py la veía saltar 2,96 con límite 2,73), y las datileras del Postiguet miden 1,3 en vez de 1,85 (la copa tocaba el borde del agua de la losa de 288 px). Orilla, colisión y línea del mapa siguen dentro de lo que valida check.py.
- La geografía es libre: los sitios reales no están en su orden en la costa.

Sin probar:
- Nada carga todavía el arte de acuarela en el motor (T20). Cómo casan en el juego losas, esquinas y paseo sólo se ha visto en la hoja de contacto.
- Nombres, historia y lugares reales están pendientes de Álvaro (preguntas al final de `diseno.md`).

## 2026-09-29 — plan 002 T31: la entrada se ve en cada carga de `/`

La entrada (mini-mundo, letras 3D «BOIA», «Zarpar» y aterrizaje) ya no se ve sólo la primera vez: depende de la URL (D-21, pendiente Álvaro).

Qué existe:
- La puerta es `decideEntry({ pathname, search, hash, reducedMotion })` en `packages/engine/src/intro/entry.ts`, que el script de arranque serializa en línea. `/` a secas, en cada carga completa o recarga → entrada (o su variante quieta con movimiento reducido). Cualquier ancla, cualquier parámetro (`?menu=…`, `?intro=0`) o una ruta distinta de `/` → directa. Los parámetros de campaña (`utm_*`, `fbclid`, `gclid`, `msclkid`, `ttclid`, `igsh`, `igshid`) no cuentan. `?intro=1` la pide siempre («Ver la introducción» del pie).
- Sin marca de «ya la vio»: el script de arranque ya no lee ni escribe `boia.intro.v2` (la marca que quede en navegadores viejos se ignora).
- `mountMode(entry)` (mismo archivo) decide con qué modo arranca el montaje del hero: sólo reproduce la entrada que pidió el script de esta carga y nadie resolvió. Volver a `/` dentro de la app (Inicio del juego, enlaces internos) no ejecuta el script, encuentra la entrada ya resuelta o ninguna y entra directa. `intro-stage.tsx` la usa.
- D-21 en `docs/DECISIONES.md`; REQ-ENT-009 reescrito y REQ-ENT-001/008 sin «primera visita» en `docs/spec/02-entrada-y-landing.md` y en el índice `09-requisitos.md`.
- Pruebas: `entry.test.ts` (la URL decide, campaña, `?intro=1`, `mountMode`, una segunda carga con la marca vieja reproduce la entrada). e2e en `intro.spec.ts`: recarga y segunda carga de `/` reproducen la entrada; `/#tickets` y `/?menu=carnet` entran directas; «Ver la introducción» la repite; volver a `/` con Inicio desde `/juego` (tras EXPLORAR y tras cargar `/juego` directamente) no la repite ni recarga. Las pruebas de landing y tickets abren `/?intro=0`.

Comandos:
```
python3 tools/spec/check.py                                                   # exit 0
pnpm test && pnpm typecheck && pnpm lint                                      # exit 0; 45 archivos, 478 pruebas
E2E_PORT=3131 pnpm e2e --workers=2 e2e/landing.spec.ts e2e/intro.spec.ts e2e/demo.spec.ts e2e/tickets.spec.ts   # exit 0; 46 pasadas
```

Desviaciones:
- `docs/spec/09-requisitos.md` (fuera del alcance escrito) cambia en las filas de REQ-ENT-001, 002, 008 y 009: `check.py` exige que el índice repita la fuente y las marcas de cada definición.
- Por orden del orquestador (máquina compartida), sólo se corrieron las specs e2e de landing, intro, demo y tickets, no la suite entera.

Sin probar:
- Móviles reales y el navegador interno de Instagram (que añade sus parámetros): la lista de parámetros de campaña es una suposición razonable, no está medida.
- Atrás del navegador hacia `/` sin caché de página (bfcache) es una carga completa y reproduce la entrada; con caché, sigue donde estaba.

## 2026-09-29 — plan 002 T27: título 3D «BOIA» de la entrada, renderizado en Blender

El título del acto 2 ya no es texto plano: son las letras «BOIA» en 3D (extruidas, con bisel suave, cara naranja BOIA #F26A1B y cantos azul marino #12233F), que se mueven como el título de messenger.abeto.co. Todo es `muestra`.

Qué existe:
- `tools/blender/intro/titulo.py` (punto de entrada propio): cada letra es un texto de Blender (fuente integrada, engrosada) pasado a malla canónica. Se renderiza girada sobre su eje vertical de −24° a +24° en 17 pasos, con luz fija (clave arriba a la izquierda, contraluz y un relleno cálido): al girar, el bisel y la cara atrapan la luz. Todo sale en un solo render (cámara ortográfica y luz direccional; cada copia en su celda) de una hoja de 3128×704 px (fila = letra, columna = guiñada, celdas de 184×176).
- `art/intro/titulo/`: `letras.png` (1,58 MB, la que valida check.py), `letras.webp` (203 KB, la que pide la web) y `manifest.json` (kind `title-sheet`: rejilla, guiñada de cada columna, pivote, posición y ancho de cada letra en la palabra, generador con `sources_sha256`).
- `tools/blender/intro/check_titulo.py`, que `check.py` llama: rejilla = PNG, WebP del mismo tamaño, cada celda con su letra entera y margen transparente, centrada a guiñada ~0, el giro cambia la imagen, y el manifiesto es del `titulo.py` actual. Con `--diff` compara byte a byte con otra corrida.
- Motor (`packages/engine/src/intro/title.ts`, puro): `resolveTitleSheet` (manifiesto → hoja; si el texto de `copy.title` no es el de la hoja, no hay título 3D) y `titlePoses` (tiempo → pose de cada letra). Las letras suben una a una con rebote girando hacia la luz, luego se balancean, bambolean y giran cada una a su aire en un bucle de 6 s que cierra sin salto (armónicos enteros del periodo). Al pulsar «Zarpar» dan un saltito y se hunden una a una. Con movimiento reducido, un fotograma quieto.
- Configuración de la entrada **v3** (`entrada-mini-mundo-muestra-v3`): sección `title` con los tiempos y amplitudes de subida, reposo, salida y la guiñada del fotograma quieto.
- Web: `apps/web/lib/intro/title-canvas.ts` compone los recortes en un canvas 2D (sin WebGL; D-05). `intro-stage.tsx` pide la hoja **cuando el mini-mundo está listo** (no va en la precarga del arranque), y al decodificarla cambia el título a `data-title="3d"`. El texto «BOIA» sigue en el `<p>` para lectores de pantalla y como respaldo (sin hoja, o si llega ya aterrizando). `__boiaIntro.title` da `mode`, `requestedMs`, `loadedMs`, `draws` y la última `pose`.

Comandos:
```
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/intro/titulo.py      # ~17 s (Cycles en CPU), escribe art/intro/titulo/
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/intro/titulo.py -- --out tools/blender/out/rerun/intro/titulo
python3 tools/blender/intro/check_titulo.py --diff tools/blender/out/rerun                  # idénticos byte a byte
python3 tools/blender/check.py                                                              # exit 0; incluye intro/titulo
pnpm test && pnpm typecheck && pnpm lint                                                    # exit 0; 45 archivos, 474 pruebas (9 nuevas en title.test.ts)
E2E_PORT=3148 pnpm e2e --workers=2                                                          # exit 0; 60 pasadas, 14 omitidas (grabaciones y la prueba de T13)
pnpm build                                                                                  # ruta crítica de /: 168,5 kB gzip (límite de T14: 192); la hoja no entra
RECORD_TITLE=1 pnpm e2e record-titulo.spec.ts --workers=1                                   # grabaciones y capturas (GPU del Mac)
```
Grabaciones: `docs/informes/img/p002-t27-titulo-{movil,escritorio}.webm` (mini-mundo, subida, 5 s de reposo, «Zarpar» y salida). Capturas en reposo: `p002-t27-titulo-{movil,escritorio}.png`; fotograma quieto con movimiento reducido: `p002-t27-titulo-reducido-{movil,escritorio}.png`.

Desviaciones:
- **Cycles en CPU, no Eevee.** Con Eevee (GPU) dos corridas daban ±1 en uno o dos píxeles de la hoja, incluso sin SSS ni sombras. Cycles en CPU con semilla fija, 64 muestras y sin eliminador de ruido da los mismos píxeles. Además, el PNG que escribe Blender no salía igual byte a byte con los mismos píxeles (otro IDAT en una imagen tan grande): `titulo.py` relee el render y escribe el PNG él mismo con zlib. La WebP la escribe Blender y sí sale igual.
- La animación no está «horneada» en una secuencia de fotogramas: Blender da la luz del giro de cada letra (17 guiñadas) y la web pone la subida, el balanceo, el bamboleo y la salida con la pose de `titlePoses`. Así la hoja pesa 203 KB, el bucle cierra por construcción y el movimiento se ajusta en la configuración sin volver a renderizar.
- `packages/engine/src/world/swap.test.ts` (fuera del alcance escrito) leía como manifiesto cada carpeta de `art/` y fallaba con `art/intro/`: ahora se salta las carpetas sin `manifest.json` propio (una línea). Sin eso `pnpm test` no pasa.
- `render.py` no se toca: el título tiene su propio punto de entrada y `render.py -- --all` no lo regenera. `check.py` sólo gana la llamada a `check_titulo` (dos líneas y el comentario).
- La fuente es la integrada de Blender (Inter), engrosada con `offset`: no hay tipografía de BOIA todavía.

Sin probar:
- Móviles reales: nitidez (la hoja tiene la mayúscula a 112 px; en un móvil de densidad 3 se amplía ×1,6) y el coste del canvas en la pausa (4 `drawImage` por fotograma).
- Con movimiento reducido, si la hoja llega después de que el título termine de fundirse, el título plano cambia al 3D de golpe (sin fundido).

## 2026-09-29 — plan 002 T18: arte del mundo Arcilla (B05) desde la exploración de mundos

El arte de juego del mundo de arcilla, lugar a lugar, con la misma cámara (30°, D-13) y la misma densidad (88,2759 px/u) que el barco B05. Todo es `muestra`.

Qué existe:
- `art/mundos/arcilla/<lugar>/`: 19 lugares, 51 piezas y 116 PNG, con un `manifest.json` por lugar (kind `place`, `tools/blender/place.schema.json`). Cada pieza trae su imagen, `pivot_px`, `map_pos` y `offset_units` (unidades de la maqueta, relativas a `place.pos`), anclajes (con `anchors_doc`), huella, `hitbox_hint` y `proximity_hint`, el tipo de colisión (`bloquear`, `rebote`, `ralentizar`, `recoger`, `disparador` o `ninguna`), animaciones y variantes. Las losas llevan `tile` y las esquinas `corner`. `place` dice a qué entrada de mapa.json apunta, sus instancias, `event_island` y `shared_name`: el nombre compartido de las islas de evento, que es sólo `allday`.
- **Ids de lugar** (catálogo compartido `tools/blender/lugares.json`, con `ref` y `pos` a mapa.json). Otro mundo sólo tiene que dar arte a estos mismos ids:
  - `puerto`: El Varadero. Piezas: paseo central con muelle y caseta, `escollera_oeste`, `escollera_este`, `baliza_verde`, `baliza_roja`, `anillo` (spawn), `boia` (la de la entrada), `bocadillo` y `whatsapp`.
  - `cala`, `allday` (isla de evento, variantes `venta` y `recuerdo`), `fotos`, `tienda` y `ultima`: una isla por lugar.
  - `fiestera`: la Fiestera pidiendo ayuda (`pide`, 6 fotogramas), `cocodrilo_1..4` (`idle` 4, `sumergirse` 6, `emerger` = `reverse_of` sumergirse), `posidonia`, `roca_1..3` y `tripulante`: la Fiestera a bordo (`baile`, 6), con `attach` al `slot_passenger` de `art/barco/estilos/arcilla`.
  - `naufrago` (banco, náufrago y balsa), `restos` (variantes a, b y c; instancias = `zonas/marvivo/restos`), `cofres`, `botellas` (la botella de REQ-IDE-040), `delfin` (`salto`, 8) y `remolino` (`giro`, 8).
  - `circuito`: `salida`, `cp1`, `cp-s`, `cp-a`, `cp2` y `meta` (arcos con anclajes `pie_a`/`pie_b`), `semaforo`, `cartel`, `dents`, `freu`, `roca`, `medusa`, `cocodrilo` (variantes derecha/izquierda) y `boia_carril` (a y b).
  - `faro` y `canon`: islas de los minijuegos, con anclajes `linterna` y `boca`.
  - `costa_oeste` y `costa_este`: losas verticales de 640×768 px. `costa_sur`: el paseo, en losa horizontal de 768×288, y las piezas `esquina_oeste` y `esquina_este`, de 1008×768. Las losas llevan `shore_px`, `collision_px`, `outer_fill` y `map_line` (la línea de mapa.json en px). Las fases encajan con las esquinas: las laterales empiezan en y = −2,65 + n·17,40 y el paseo en x = −8,70 + n·8,70.
- mapa.json (misma estructura, sólo añadidos): `minijuegos` con `faro` (−10,5, −25,2; el antiguo solar L2) y `canon` (−9,0, −18,6), y `costas/costa_sur` (y = 27,8). `solares_l2` queda vacío. `herramientas/mapa.py` cuenta las islas de `minijuegos` como tierra. `validar.py` da 0 errores.
- `tools/blender/mundos_arte.py` (genérico: encuadre, cámara, render, losas de tres periodos con recorte del central y fundido a `outer_fill`, manifiestos) y `mundo_arcilla.py` (el mundo: escenas desde `mundos/arcilla/zonas/*.py`, piezas por nombre y distancia, y lo que no está en la maqueta: faro, cañón, losas, esquinas, fotogramas y tripulante). Para añadir un mundo: `mundo_<id>.py` y una entrada en `WORLDS` (render.py y mundos_arte.py).
- `render.py -- --all` renderiza también los mundos; `--mundo arcilla [--lugar cala]` hace sólo uno. `check.py` valida `art/mundos/<mundo>/`: un lugar por id del catálogo, referencias a mapa.json, la cámara y la densidad del barco del mundo, y cada pieza. `contact_sheet_mundo.py` saca la hoja de contacto.

Comandos:
```
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/render.py -- --all        # exit 0, 386 imágenes, ~170 s (Arcilla: 116 imágenes, ~83 s de render)
cp -R art tools/blender/out/run1 && (otra vez el mismo --all) && diff -r tools/blender/out/run1 art   # exit 0, 421 archivos idénticos
python3 tools/blender/check.py            # exit 0: 35 manifiestos, 386 imágenes; «mundo arcilla: 19 lugares válidos, 116 imágenes»
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/contact_sheet_mundo.py -- --mundo arcilla
python3 mundos/arcilla/herramientas/validar.py   # 0 errores
```
Hoja de contacto a escala de juego (48 px de eslora × densidad 2) sobre el mar del mundo: `docs/informes/img/p002-t18-hoja-arcilla.png`.

Desviaciones:
- **Reproducibilidad.** Con las piezas de la maqueta tal cual, dos corridas no daban los mismos bytes, por dos causas:
  - `bmesh` crea las caras de `create_uvsphere` en otro orden y con otro vértice inicial en cada sesión, así que cambia la diagonal con la que se dibuja cada cuadrilátero. `mundo_arcilla.py` sustituye `Builder.mk` por una copia que triangula por la diagonal más corta, orienta cada grupo de caras por el signo de su volumen y ordena vértices y caras. `mundos/arcilla/escena.py` no se toca.
  - La dispersión subsuperficial (SSS) de Eevee da ±1 en algunos píxeles de un render a otro. El arte de los mundos se renderiza sin SSS (`TemaJuego`): de media cambia unos 4 niveles y no se nota a escala de juego. El barco B05 la conserva.
- El sol, la luz y la hora son los de «día» del tema, que coinciden con el estudio del barco. Día y noche siguen siendo L2 (REQ-MUN-005).
- Los manifiestos existentes (`art/barco/**`, costa, islas, rocas, boia, planeta) llevan `sources_sha256` de antes de este cambio en `render.py`. Al regenerarlos sólo cambia esa línea; se dejan como estaban porque `art/barco/**` queda fuera del encargo. El próximo `--all` los pone al día sin tocar ningún PNG.
- El puerto de la maqueta ocupa todo el borde de abajo. Aquí la pieza `puerto` es el tramo central del paseo (x = ±6,4), con muelle, caseta, dos casitas y farolas; el resto del borde lo ponen las losas de `costa_sur`.
- La tripulante es una capa aparte que se dibuja encima del barco (imágenes `base/<dir>.png`, sin `_p`) en `slot_passenger`. No hay fotogramas nuevos en `art/barco/`.
- Los secretos (cueva, ánfora, campana, círculo de boies), la fila de boies del borde de arriba y la grada con el juez del circuito no tienen arte: no estaban en la lista.

Sin probar:
- Nada lo carga todavía en el motor (T17 y T20). Tampoco se ha probado cómo casan en el juego las losas con las esquinas y con el paseo del puerto: por ahora sólo se ha visto en la hoja de contacto.

Fuera del alcance, con permiso del orquestador: `packages/engine/src/world/swap.test.ts` leía como manifiesto cada carpeta de `art/` salvo `barco`, y con `art/mundos/` fallaba. Ahora también se salta `mundos`.

## 2026-09-29 — plan 002 T23: minijuegos, Vigilancia del faro y Cañón contra tiburones

Los dos minijuegos de REQ-AVE-035…039 (L1 por D-20) detrás de INICIAR_MINIJUEGO, con ids `faro` y `canon`. Reglas, números, textos y dibujo son `muestra`.

Qué existe:
- `packages/engine/src/minigames/` (`@boia/engine/minigames`, sin Pixi):
  - `faro.ts`: escena de noche. El haz sigue al dedo o al puntero, o gira con ←/→ (A/D). La bandera se reconoce tras `identifyS` de luz continua, con un anillo de progreso. Pirata: negra con calavera y huesos. Señuelo: oscura con rayas. Mercante: clara con banda diagonal. Así no depende sólo del color. ALARMA (botón, Espacio o Intro) sobre un pirata lo hace dar media vuelta. Sobre otro barco o sobre el mar vacío cuenta como falsa alarma. Un pirata que cruza se escapa. Fin: `goal` piratas (gana), o tiempo, `maxErrors` falsas alarmas o barcos agotados (pierde). La flota sale de la semilla.
  - `canon.ts`: se apunta arrastrando (el círculo de caída sigue al dedo y mide lo mismo que la salpicadura), con el puntero o con las flechas. Al soltar, con FUEGO o con Espacio sale una bola en arco, con sombra, que salpica. Los tiburones siguen patrones versionados (`SHARK_PATTERNS[1]`: recto, zigzag, círculo), se sumergen, cambian de rumbo y rebotan. Uno sumergido no se asusta; uno asustado huye entero, sin heridas, y otro ocupa su sitio. Fin: `goal` tiburones (gana), o tiempo o munición (pierde).
  - `session.ts`: `LocalSessionAuthority`, el «servidor» de la versión de prueba (REQ-AVE-038). La sesión guarda id, juego, versión, semilla, huella de la configuración, inicio y límites. Vive en memoria, así que recargar la invalida. Se liquida una sola vez (`replayed`). Anula la marca por abandono, pestaña oculta, cambio de configuración, otra semilla o versión, o una marca imposible. También si la duración pasa del límite, pasa del reloj real o es menor que el mínimo posible con esa semilla (`minPlausibleMs`: en el faro, la entrada en escena del pirata n-ésimo; en el cañón, vuelo más recargas).
  - `rewards.ts`: `grantMinigameReward`. Sólo concede con sesión válida y partida ganada. Lo hace con `grantWorldReward({ sourceRef: 'minigame:<id>', policy })` de `@boia/store`, así que la política `once`/`daily`/`season` e ids como `world_reward:minigame:faro@2026-09-29` son los del libro. `record_only` no concede. Los límites `maxPoints`/`maxCoins` acotan el premio. Guarda la marca personal (`boia.minijuegos.marcas`) sólo de partidas válidas. Políticas de muestra: faro diaria (15 puntos y 5 monedas), cañón por temporada (20 puntos y 8 monedas).
  - `controller.ts` (ciclo sin DOM: instrucciones, juego, pausa, final; paso fijo de 1/60 s; la pausa no cuenta) y `host.ts` (`mountMinigame`: capa a pantalla completa con instrucciones breves, estado en texto, aviso sin destellos, botón de acción grande, pausa, salida y volumen). El teclado no llega al mar. Respeta el movimiento reducido. Ocultar la pestaña pausa la partida y le quita el premio (se ve «sin premio»). También tiene sonido sintetizado y telemetría opcional (`onEvent`).
  - `skin.ts`: el estilo de cada mundo. `arcilla` en barro con contorno grueso, `acuarela` en aguadas sin contorno; otro mundo usa su mar y su acento.
  - `testing.ts` (`@boia/engine/minigames/testing`): jugadores automáticos y `playHeadless` para las pruebas.
- `packages/engine/package.json`: exports `./minigames` y `./minigames/testing`.
- `apps/web/app/juego/minigame-layer.tsx`, el punto de montaje. Muestra el panel de la isla (evento `minigame` con `available: true`: explica la actividad y abre con «Jugar»; se cierra al alejarse). También abre la ruta de prueba `/juego?minijuego=faro|canon` (se consume al salir) y monta la capa. Premios con `gameRepository().progress` (T22). `game-canvas.tsx` pasa `MINIGAME_REGISTRY` al motor como `runtime.minigames` y monta la capa: unas diez líneas.

Comandos:
```
pnpm test --filter minigames      # 25 pruebas del motor (finales de cada juego, sesión, semilla, duración, dibujo)
pnpm test --filter minigame-layer # 4 pruebas: once/daily/season con el repositorio local tras recargar
pnpm test && pnpm typecheck && pnpm lint
E2E_PORT=3123 pnpm e2e minijuegos # 3 specs × móvil y escritorio
```
En el navegador: `/juego?minijuego=faro` y `/juego?minijuego=canon`.

Desviaciones:
- Una alarma sobre el mar vacío cuenta como falsa alarma (REQ-AVE-036 no lo dice). Los escapes no cuentan como error, así que los cuatro finales del faro son alcanzables.
- Ocultar la pestaña no cierra la partida: la pausa y la deja seguir sin premio (REQ-AVE-038 invalida la marca; REQ-AVE-035 pide pausa).
- `record_only` guarda la marca en el dispositivo (`KeyValueStore`), no en `@boia/store`: el repositorio no tiene récord de puntuación, sólo de tiempo.
- La ruta de prueba es un parámetro de `/juego` (`?minijuego=`), no una página aparte, para que salir deje ver el mar de verdad.
- `apps/web/e2e/minijuegos.spec.ts` está fuera del alcance escrito, pero lo pide «Hecho cuando».

Sin probar:
- Todavía no hay islas Faro y Cañón en el mapa (las pone T20 con `start_minigame` y `gameId` `faro`/`canon`). El panel de la isla sólo está probado con el evento del motor en pruebas unitarias; en el navegador se ha probado sólo la ruta de prueba.
- Las skins de Arcilla y Acuarela sólo se han pintado en pruebas con un contexto falso: aún no hay mundos con esos ids en el registro.
- En un móvil real.
- Con la máquina cargada (load ~20), `pnpm e2e` con 5 workers da fallos de tiempo intermitentes en `intro.spec.ts` y `juego-hud.spec.ts`, que no tocan los minijuegos. Con `--workers=2` pasan.

## 2026-09-29 — plan 002 T25: entradas que dan el sello directamente

Compra de prueba sin ticketera (D-20, REQ-COM-035) sobre `@boia/store` (T16), todo en este navegador. Precios, textos y descuentos son `muestra`.

Qué existe:
- `apps/web/lib/ticketing/` (nuevo):
  - `adapter.ts`: `TicketingAdapter`, la interfaz del adaptador de D-06/REQ-COM-015. `start(eventId)` prepara la compra (id estable, precio, descuento, flujo `inline` o `redirect`). `confirm` es opcional: lo tiene sólo el sandbox; con una ticketera real confirma su webhook en el servidor. El comentario explica cómo encaja Fourvenues (`metadata.internal_id` = id de compra).
  - `sandbox.ts`: `createSandboxTicketing(repo)`. `start` rechaza eventos que no están a la venta (`not_on_sale`, también los finalizados). `confirm` llama a `purchases.confirmSandbox`, que da el sello una vez por id de compra (`duplicate` si se repite, `already_stamped` si otra compra del mismo evento ya lo dio). Después concede el logro de la entrada, buscado por su disparador `buy_ticket`, no por id.
  - `pricing.ts`: precios `muestra` por evento (25 € el All Day de primavera, 15 € la Noche de mayo, 20 € por defecto). `applicableDiscount` sólo aplica un descuento encontrado por el visitante, vigente ahora y de ese evento (o sin evento); si hay varios, el que más descuenta.
  - `checkout.tsx` + `checkout.css`: `SandboxCheckout`, un `<dialog>` modal, el mismo en la landing y en el mar. Muestra «Compra de prueba», el evento, el precio de muestra, el descuento (o «Sin descuento»), el total y el aviso de que no se cobra nada y todo queda en este navegador (REQ-IDE-051). Tras confirmar enseña el aviso: sello añadido, ya confirmado o ya tenías el sello, y el logro si es nuevo. Después, «Ver Mi Carnet». Escape y tocar fuera cierran sólo el checkout.
  - `notices.ts`: `purchaseNotices`, los avisos del mar (sello y logro) con ids estables. `copy.ts`: todos los textos.
  - `index.ts`: `ticketing()`, la ticketera que usa la web (hoy el sandbox). Ahí se enchufará la real.
- `apps/web/lib/repo.ts`: `gameRepository` y `seaWorld` salen de `app/juego/repo.ts`, que los reexporta. Motivo: la landing también los usa, y EXPLORAR navega sin recargar, así que la landing y /juego comparten el mismo repositorio con las mismas opciones.
- Landing (`(landing)/components/buy-button.tsx`): «Comprar entradas» en el evento prioritario, en los próximos y en el panel de Tickets.
  - Con JavaScript es un botón que carga el checkout y el repositorio al pulsar, fuera de la ruta crítica.
  - Sin JavaScript, o antes de hidratar, sigue siendo el enlace a la ticketera de muestra (REQ-ENT-017).
  - Sigue midiendo `ticket_click_out`. Sólo sale en eventos que se pueden comprar (`canBuy`): un evento finalizado nunca muestra compra.
- /juego: el panel de la isla de evento (`world-ui.tsx`) cambia el enlace «Entradas» por el botón «Comprar entrada» (`islandCanBuy`: sólo si el TICKET se activó y el evento está a la venta). En `game-canvas.tsx`, el checkout; al confirmar, los avisos del mar; «Ver Mi Carnet» abre el menú en Mi Carnet.

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint   # exit 0; 42 archivos, 436 pruebas
E2E_PORT=3134 pnpm e2e --workers=2         # exit 0; 54 pasan, 10 omitidas (las de siempre); e2e/tickets.spec.ts en móvil y escritorio
node apps/web/scripts/landing-budget.mjs   # 166,5 kB de 1024 kB: el checkout no entra en la ruta crítica
```

Desviaciones:
- Los precios no están en el evento, porque `@boia/contracts` no tiene precio y `packages/store` no se podía tocar. Viven en `lib/ticketing/pricing.ts` hasta que la ticketera o el Admin los den.
- El descuento no se escribe a mano: se aplica solo el mejor que el visitante haya encontrado. Un código tecleado no vale porque el repositorio exige que esté encontrado.
- Actualizados `e2e/landing.spec.ts` y `e2e/intro.spec.ts`: el clic de compra ya no abre una pestaña, abre el checkout.
  - La prueba «bundle del juego bloqueado» compra antes una vez en otra pestaña y no bloquea los chunks que esa compra carga: el checkout y `@boia/store` los comparte con /juego, así que no son «sólo del juego». Sigue bloqueando la página del juego y lo demás.
  - Los checkouts de las pruebas esperan hasta 20 s: se cargan al pulsar.
- Con todo el suite en paralelo y el Mac muy cargado (carga ~27, otras sesiones), fallaron por tiempo pruebas de `intro.spec.ts` y `juego-hud.spec.ts` que no tocan la compra. Con `--workers=2` pasa todo.
- El texto `event.buy.aria` de `lib/i18n/es.ts` («se abre la ticketera en otra pestaña») queda sólo para el enlace sin JavaScript; el botón usa el de `copy.ts`.

Sin probar:
- La landing sigue pintando eventos de `SAMPLE_CONTENT`, no del repositorio. Si el Admin marca un evento como finalizado, la landing seguirá mostrando el botón hasta que se conecte al repositorio. El checkout sí vuelve a mirar el estado en el repositorio y no deja comprar.
- En un móvil real: el `<dialog>` con el teclado en pantalla y el Atrás de Android (no cierra el checkout; lo cierra Escape o tocar fuera).

## 2026-09-29 — plan 002 T22: Mi Carnet y botellas

Mi Carnet (REQ-IDE-010…022) y botellas (REQ-IDE-040…044) sobre `@boia/store` (T16), todo en este navegador (D-20). Textos, avatares, números y el dibujo de la botella son `muestra`. Las 5 preguntas no: son las de v14 §44.1, textuales.

Qué existe:
- `apps/web` usa ya `@boia/store` (en `package.json` y `transpilePackages`). `app/juego/repo.ts`: `gameRepository()`, la única llamada de la web a `browserRepository`. Le pasa el validador del mar y las botellas de muestra recolocadas. `useRepoData` y `useRepoRevision` vuelven a leer con cada cambio.
- Menú de a bordo, sección 🪪 Mi Carnet (`menu/sections/carnet.tsx`):
  - sin Carnet, la invitación «Crear mi Carnet»;
  - el alta rápida pide apodo (invitado, sin email), avatar neutro o foto del dispositivo (reducida a 256 px en JPEG) y las 5 preguntas textuales, todas opcionales; antes de crear avisa de qué será público (REQ-IDE-013);
  - con Carnet, primero se ve como lo verán los demás: «Miembro de BOIA desde», rango, puntos, respuestas (pregunta pequeña y respuesta grande, sólo las contestadas), sellos como colección, logros, barco y cosméticos. Debajo, «Editar mi Carnet» y la botella propia;
  - REQ-IDE-051 (llegó con T15 al unir main): Carnet y botella dicen en pantalla que todo se guarda sólo en este navegador y que la botella sólo la ve quien la escribe. No hay botón «Compartir».
- `CarnetCard` (`juego/carnet/`) es la misma vista en el menú, en «VER SU CARNET» (hoja sobre el mar) y a pantalla completa en `/carnet` (el propio) y `/carnet/<id>` (cualquiera), la futura vista para compartir. `?menu=carnet` abre el menú en Mi Carnet. El barco del Carnet sale de la preferencia `barco` del repositorio, que `/juego` escribe al aplicar un estilo.
- Botellas:
  - en el HUD, una barra justo encima de la zona del joystick: ✉️ abre la botella propia y aparecen hasta dos botellas cercanas («Tu botella», «Botella de X»);
  - la propia se echa en un sitio de mar junto al barco (por la popa si se puede), se edita o se retira; hace falta Carnet; una sola activa (la segunda se rechaza con `conflict`, como en la spec), hasta 140 caracteres;
  - una encontrada se lee (el repositorio lo registra y la botella sigue en el mar), trae el apodo de su autor y «VER SU CARNET», y se puede reportar con un motivo opcional;
  - no dan puntos ni monedas.
- `packages/engine/src/bottles/` (`@boia/engine/bottles`, sin Pixi):
  - `sea.ts`: `bottleSpotProblem` (tierra = fuera de los límites con 32 u de margen, o a menos de 20 u de la colisión de un lugar), `bottlePositionValidator` para el repositorio, `findDropSpot` y `settleInSea`, que deja en el mar las botellas de muestra que no lo están (la primera, junto a la salida);
  - `finder.ts`: `nearbyBottles`, que las encuentra a 150 u y las suelta a 240 u;
  - `view.ts`: `BottleLayer`, en la capa de objetos, ordenada con el barco y cabeceando.
- `Game.setBottles(markers)` y `GameOptions.bottleAsset` (id del arte, configurable) en `game.ts`. `@boia/world`: `bottle.ts` (`BottleMarker`, `bottleObject`, `BOTTLE_PLACEHOLDER_ASSET`). Sin arte, la botella se dibuja por código.

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint   # exit 0; 40 archivos, 420 pruebas
E2E_PORT=3122 pnpm e2e                     # exit 0; 52 pasan, 10 omitidas (las de siempre); e2e/carnet.spec.ts en móvil y escritorio
```

Desviaciones:
- Pintar las botellas pedía un gancho en el motor fuera de `bottles/`: `setBottles` en `game.ts` (unas 20 líneas, sólo añade) y la entrada `./bottles` en `packages/engine/package.json`. Meterlas como objetos del mundo con `setWorld` habría reiniciado el runtime (diálogos y efectos) cada vez que se echa o se retira una botella.
- Las botellas de muestra de T16 tienen coordenadas del mapa de Arcilla y caen fuera del mapa de la demo. `repo.ts` las recoloca con `settleInSea`. Cuando T20 traiga el mapa de Arcilla, las que caigan en el mar se quedarán donde están.
- El encargo pedía una vista para compartir, pero REQ-IDE-051 (T15) prohíbe presentar nada como compartido en la versión de prueba. `/carnet/<id>` existe, sin botón de compartir y con el aviso de que todo queda en este navegador. En otro dispositivo el enlace dice «Carnet no encontrado».
- Al reportar, la botella sigue visible para quien la reporta. Retirarla para todo el mundo es cosa del Admin (`admin.removeBottle`).

Sin probar:
- Subir una foto del dispositivo (`createImageBitmap` + canvas): ni en pruebas ni a mano, y menos en móvil (HEIC de iOS, fotos grandes).
- Que el arte de T18 cargue con `bottleAsset`: sin arte, sólo se ha visto el dibujo por código.

## 2026-09-28 — plan 002 T15: decisión D-20 y spec de la versión de prueba

Sólo documentos. Las decisiones de Hernán del 2026-09-28 quedan como D-20 y la spec las recoge.

Qué existe:
- `docs/DECISIONES.md`: **D-20** (Hernán, pendiente Álvaro) con sus siete puntos: minijuegos, segundo mundo y temporadas como mundos adelantados de L2; todo en el navegador detrás de un repositorio hasta Supabase (cada botella sólo la ve quien la escribe); sello directo por sandbox; «Probar admin» sin login; «BOIA» en letras 3D de Blender; EXPLORAR muestra el puerto (El Varadero); un mapa compartido con skins y nombres por mundo. Lleva la lista «Para la versión final» y la nota de lo que falta aprobar. Notas fechadas en D-02, D-08 y D-19 que remiten a D-20. Preguntas nuevas para Álvaro: P10 (alcance), P11 (mundos, historias y nombres), P12 (letras 3D y puerto), P13 (enseñar la versión de prueba y enlaces reales).
- `docs/spec/`:
  - Cambian REQ-ENT-003 (letras 3D), REQ-ENT-012 (puerto tras Explorar), REQ-MUN-018 (mapa con puerto, Faro y Cañón), REQ-MUN-026 (arranca `faro` y `canon`), REQ-AVE-001 (primera boia en el puerto), REQ-AVE-010 (destino por ID de lugar) y REQ-ADM-032 (mundo activo como temporada; pierde `[provisional]`).
  - Pasan de L2 a L1 REQ-AVE-035 a REQ-AVE-039 (minijuegos). REQ-AVE-038 dice que en la versión de prueba se valida en el navegador.
  - Nuevos: REQ-MUN-035 a REQ-MUN-037 (mapa compartido, nombres por mundo, Arcilla y Acuarela) y, sólo para la versión de prueba, REQ-ARQ-025 (repositorio en el navegador), REQ-IDE-051 (invitado con apodo, botella propia), REQ-COM-035 (sello por sandbox) y REQ-ADM-039 («Probar admin»).
  - `00-indice.md`: reglas 4 y 5 de alcance para D-20, desviaciones nuevas y una tabla «Versión de prueba (D-20)». `08`: entidades de sesión de minijuego y de lugar/skin en L1. `11-glosario.md`: mapa compartido, lugar, mundo, skin de lugar, puerto de salida, Faro y Cañón, versión de prueba.

Comandos:
```
python3 tools/spec/check.py        # exit 0; 286 requisitos (antes 279): L1 256 · L2 28 · diferido 2; centinelas 10/10
python3 tools/spec/test_check.py   # exit 0; 18 pruebas
grep -n "D-20" docs/DECISIONES.md
```

Desviaciones:
- `check.py` sólo admite `L1`, `L2` y `diferido`, así que no hay alcance `L1-demo`: lo adelantado lleva `L1` con D-20 en la fuente y «Adelantado de L2 (D-20)» en las notas de 09. Lo que sólo vale para la versión de prueba lleva `L1`, empieza por «En la versión de prueba» y en las notas de 09 dice qué lo retira.
- Los requisitos de la versión final que D-20 aplaza (REQ-ARQ-002, REQ-ARQ-010, REQ-IDE-002, REQ-IDE-005, REQ-IDE-006, REQ-IDE-021, REQ-COM-017, REQ-ADM-002 a REQ-ADM-004) no se tocan: las excepciones van en requisitos aparte.
- Siguen en L2 duplicar temporadas (REQ-ADM-033) y configurar minijuegos desde el Admin (REQ-ADM-036): el plan 002 no los construye.

Sin probar:
- Nada que ejecutar más allá de las dos comprobaciones de la spec. `mundos/arcilla/diseno.md` todavía dice que Faro y Cañón son L2 (un solar vacío); no está en el alcance de este encargo.

## 2026-09-28 — plan 002 T16: repositorio local, persistencia en el navegador tras una interfaz sustituible

Una sola capa de datos para toda la demo, sin React: `packages/store` (`@boia/store`). Hoy guarda en el navegador (D-20); Supabase implementará la misma interfaz más adelante. API completa en `packages/store/README.md` y comentada en `src/repository.ts`.

Qué existe:
- `BoiaRepository` (`src/repository.ts`): `identity` (invitado sin email), `carnet`, `progress`, `purchases`, `bottles`, `content`, `admin`, más `status()`, `revision()` y `subscribe()`. Todo es asíncrono. `status`, `revision` y `subscribe` se pueden pasar sueltas (`useSyncExternalStore(repo.subscribe, repo.revision)`).
- `createLocalRepository(opts)` y `browserRepository(opts)`, uno por pestaña. En el servidor, `browserRepository` da uno nuevo en memoria en cada llamada. Opciones: `validate.bottlePosition`, `validate.placePatch` y `validate.skinPatch`, para que el motor o `@boia/world` rechacen tierra o lugares inválidos con su motivo. También `sample` (sustituir partes de la muestra, p. ej. las botellas con coordenadas del motor) y `now`.
- Libro con las reglas de T06 (`src/ledger.ts`):
  - ids estables elegidos por el repositorio: `world_reward:<sourceRef>[@día|@season:<mundo>]`, `achievement:<id>`, `cosmetic:<id>`, `stamp:<purchaseId>` y `compensation:<txId>`;
  - puntos y monedas derivados, nunca guardados ni asignables;
  - las compensaciones invierten la original una sola vez;
  - nunca hay saldo negativo;
  - al cargar, el libro se vuelve a pasar por las reglas, así que un libro retocado a mano no fabrica saldo.
- Recompensas con política `once`, `daily` (día de Europe/Madrid) o `season` (mundo activo). Los logros llevan el premio de su definición y, si la tiene, su cosmético. Los secretos no se ven hasta obtenerlos. Cosméticos con monedas y equipado por ranura; descubrimientos, descuentos encontrados (con estado vigente o caducado), misiones, récords locales, contadores y preferencias.
- Compra de prueba `purchases.confirmSandbox`: el sello entra una vez por id de compra y nunca dos por evento. Sólo se compra un evento a la venta. El descuento tiene que estar encontrado, vigente y ser de ese evento.
- Carnet: apodo de 2 a 30 caracteres, único sin distinguir mayúsculas; «Miembro desde»; foto como data URL con límite; las 5 preguntas en `@boia/contracts` (`CARNET_QUESTIONS`). Una prueba las compara con la migración de T06. `CarnetView` trae puntos, rango, logros, sellos y cosméticos. Tres miembros ficticios de muestra, con Carnet y botella.
- Botellas:
  - una activa por identidad; de 1 a 140 caracteres contados como Postgres;
  - hace falta Carnet para escribir y reportar;
  - leer no la quita y queda registrado; un reporte por persona;
  - retirada por moderación, también de las de muestra;
  - no dan puntos.
- Contenido con muestra más cambios del Admin, que siempre ganan. Áreas con id: `events`, `homeBlocks`, `artists`, `albums`, `photos`, `promotions`, `discounts`, `achievements`, `cosmetics` y `ranks`. Además, `places` (cambio compartido por id de lugar: x, y, params, enabled; vale en todos los mundos), `skins` (por mundo y lugar: nombre, textos, arte, oculto), `texts` y `activeWorld`. `content.home()` devuelve el `HomeContent` de `@boia/contracts`.
- Admin (`admin.*`):
  - operaciones: `upsert` validado (rechaza con motivo), papelera (`remove` y `restore`), `reorder`, `setPlace` y `setSkin` (mezclan con el cambio anterior), `setText`, `setActiveWorld`, moderación de botellas y reportes, y `compensate`;
  - `reset(area | 'all')` y `overridden(area)`;
  - auditoría local sólo de añadir, con autor `admin-demo`, fecha, motivo, antes y después.
- Almacenamiento (`src/storage.ts`, `src/migrations.ts`):
  - un documento JSON en `localStorage['boia.store']` con `schemaVersion` 1 y migraciones paso a paso (hoy ninguna);
  - si falla, sigue en memoria y lo dice con `status().issue` y `message` (textos `muestra`). Motivos: `unavailable`, `blocked`, `quota` (a mitad de visita), `corrupt` y `migration_failed` (se copia en `boia.store.backup` y se empieza de cero), y `newer_schema` (no se toca);
  - otra pestaña que cambia los datos provoca recarga y aviso con `external: true`.
- `@boia/contracts`: nuevos `carnet.ts` (preguntas, límites y `charLength`) y `progress.ts` (`LEDGER_KINDS`, `ACHIEVEMENT_TRIGGERS`, `BOTTLE_STATUSES` y `PURCHASE_STATUSES`; una prueba los compara con `Constants` de `@boia/db`). En `content.ts`: `albumSchema`, `discountSchema` y `discountStatus`.

Comandos:
```
pnpm test --filter store          # 5 archivos, 44 pruebas
pnpm test && pnpm typecheck && pnpm lint   # exit 0; tras unir T17: 37 archivos, 392 pruebas
```

Desviaciones:
- localStorage, no IndexedDB: el documento es pequeño, la lectura es síncrona y es lo que ya usa la demo.
- La muestra de contenido está copiada de `apps/web/lib/landing/sample-content.ts`, que la landing sigue usando hasta que lea de `@boia/store`. El evento de primavera va a la isla `allday` del mapa compartido, no a la `isla-primavera` del mundo de plan 001.
- Un logro se concede una vez por id, sea cual sea su versión (la base de datos lo permite por versión). Una compra del mismo evento con otro id no da segundo sello: devuelve `already_stamped` en vez de fallar, como haría la base de datos.
- `confirmSandbox` concede el sello, pero no el logro de entrada: eso lo decide quien llama (T25).
- Las posiciones de las botellas de muestra salen de `mapa.json` (u_maq × 24,87). Si el mapa del motor de T17 usa otro origen, se pasan otras con `sample.bottles`.
- `pnpm-lock.yaml` cambia por el paquete nuevo.

Sin probar:
- En un navegador real: el evento `storage` entre pestañas, Safari en modo privado y la cuota llena. En las pruebas se simulan con almacenamientos falsos.
- Nadie consume todavía el paquete. El primero tiene que añadir `@boia/store` a `apps/web/package.json` y a `transpilePackages`.

## 2026-09-28 — plan 002 T17: varios mundos en el motor

Un mapa compartido y varios mundos encima (D-20, Hernán). Todo es `muestra`.

Qué existe:
- `packages/world/src/worlds/`:
  - `map.ts`: `SharedMap` (id, bounds, `spawn`, `port`, `introLanding`, sectores, `places`) y `Place` (id estable, nombre común, categoría, posición, geometría, comportamientos y parámetros). La cabecera explica cómo pasa `mundos/arcilla/mapa.json` a este modelo (para T20).
  - `skin.ts`: `WorldSkin` (estilo de barco de `art/barco`, paleta del mar, acento de la interfaz, ranura de música, costa, `places` por id y `names`, los nombres propios del mundo) y `PlaceSkin` (asset, textos, bocadillos que sustituyen a los del DIÁLOGO, escala y `hidden: true`). Sin `asset`, el arte es `mundos/<mundo>/<lugar>`, es decir, `art/mundos/<mundo>/<lugar>/manifest.json`.
  - `compose.ts`: mapa + skin → el `WorldConfig` de siempre, con el id del lugar como id del objeto. Un lugar sin skin sale con `placeholder:sin-skin` (el motor lo pinta en magenta rayado con un «!») y mantiene su comportamiento. Una skin o un nombre de un lugar desconocido lanza `SkinError`, y también unos bocadillos para un lugar sin DIÁLOGO. `renamePlace(…, scope)`: `{ world }` pone el nombre propio de ese mundo; `'all'` cambia el común y quita los propios de todos.
  - `registry.ts`: `WorldRegistry` (valida al registrar y compone una sola vez; `get`, `resolve`, `list` para los selectores y `renamePlace`, que devuelve un registro nuevo). `catalog.ts`: `WORLD_REGISTRY` con `muestra` (por defecto, el mundo de plan 001, barco `muestra`) y `prueba` (mismo mapa, barco `acuarela`, otro mar, las rocas cambiadas y dos nombres propios; sólo para probar el cambio).
  - `selection.ts`: `WorldChoice` (`get`/`set`), `storedWorldChoice(storage, key)` y `activeWorld`. Orden: `?mundo=`, luego lo que eligió el visitante (`boia:mundo`), luego el mundo activo del Admin (`boia:mundo-activo`), luego el por defecto. Un id desconocido se salta. T16/T26 pueden respaldarlo con el repositorio sin cambiar la interfaz.
  - `check.ts` + `src/cli/world-check.ts`: `pnpm world:check`.
- `SAMPLE_WORLD` sigue exportado: ahora es el mundo `muestra` compuesto, idéntico al de antes salvo el nombre de las rocas («Roca»).
- Motor: `game.setWorld(config, { sea })` cambia de mundo en caliente. El barco sigue donde está y las recompensas siguen cobradas, porque hay un único `RewardStore` por partida y va por id de lugar. `GameOptions.sea` y `Water.setPalette` dan el mar de cada mundo. `DEV_ART_URL` acepta ids anidados (`mundos/a/b`).
- `/juego`: al montar elige el mundo con `world-choice.ts`. Si no hay estilo en la URL ni guardado, el barco es el del mundo. El root lleva `data-mundo`, `--mundo-acento`/`--mundo-sobre-acento` y el fondo del mar del mundo. Lo descubierto se guarda por id y sobrevive al cambio. `MenuContext.world` (`worlds`, `current`, `pending`, `choose`) queda listo para la sección «Mundos» de T24. Cambiar de mundo con el barco del mundo no lo guarda como elección.

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint   # exit 0; 32 archivos, 348 pruebas (antes 324)
pnpm world:check                           # exit 0; tabla por mundo (muestra y prueba, 7 lugares cada uno)
node --import ./packages/world/scripts/ts-resolve.mjs packages/world/src/cli/world-check.ts \
  --registro packages/world/src/worlds/fixtures/sin-skin.ts   # exit 1: prueba/isla-pequena-1 sin skin
E2E_PORT=3117 pnpm e2e                     # los specs de siempre
```
Para verlo: `/juego?mundo=prueba`. En desarrollo, `__boiaWorld('muestra')` en la consola cambia de mundo en caliente. Comprobado en el navegador (`next dev`, puerto 3121): el barco se queda en el mismo punto; cambian las rocas, el mar y el barco (acuarela ↔ muestra); la URL y `boia:mundo` se ponen al día; `boia:estilo-barco` no se toca; la consola queda sin errores.

Desviaciones:
- `world:check` corre con el TypeScript de Node 24 y un hook de resolución (`packages/world/scripts/ts-resolve.mjs`) para las importaciones sin extensión. En `packages/world` no puede haber sintaxis que no se pueda borrar sin más (parameter properties, enums).
- Si un lugar no tiene arte, `world:check` lo cuenta como fallo (`sin-arte`), igual que si no tiene skin, porque se ve con un marcador.
- Los nombres propios van en `WorldSkin.names`, aparte del arte: poner un nombre en un mundo no hace que el lugar pase a «con skin».

Sin probar:
- La entrada (T14) sigue pintando el mundo por defecto aunque el visitante haya elegido otro. `(landing)` no entra en el alcance: es de T27. `introLanding` está en el mapa, pero la configuración de la entrada todavía no lo lee.
- No hay música: la ranura `music` es sólo un dato.
- Lo que el runtime guarda por objeto y no pasa por el `RewardStore` se reinicia al cambiar de mundo: diálogos «una vez» ya vistos, recogibles ya cogidos, efectos. En la prueba, la boia tutorial vuelve a hablar. Lo que sí sobrevive son las recompensas y lo descubierto. Cuando T16/T20 guarden ese estado en el repositorio, sólo hace falta pasarlo por id.
- La primera pasada de `pnpm e2e` tuvo 3 fallos en escritorio por tiempo agotado, en la landing y la entrada, con la máquina a carga 64 por los encargos en paralelo. Repetida con `--workers=2`: exit 0, 50 pasadas y 10 omitidas.

## 2026-09-28 — plan 001 T14: intro «mini-mundo» en tres actos con botón y aterrizaje continuo

La entrada de T03 (planeta genérico → mar, automática) queda sustituida por la de D-19, con la opción A de T13: el mundo real enrollado en una esfera falsa de Pixi.

Qué existe:
- `packages/engine/src/intro/` (puro, en la ruta crítica):
  - `config.ts` v2 (`entrada-mini-mundo-muestra-v2`, todo `muestra`): textos («BOIA», «Zarpar», «Solo quiero ver las entradas», «Cargando»), tiempos de cada acto (aparición 2 s, aterrizaje 2 s, fundido reducido 0,4 s), giro (40 s por vuelta, 16° de inclinación), nubes (1,8× el giro del suelo), punto de aterrizaje en coordenadas del mundo (600, 760: la isla de evento), encuadres por ancho (mini-mundo, título, botón y llegada; la llegada es la de T03), textura de 2048 px y barco. **Avance automático de la pausa implementado y apagado** (`pause.autoAdvance.enabled: false`, 8 s).
  - `sphere.ts`: geometría y poses de la esfera (de la prueba de T13), con mar de relleno más allá de los polos (`SEA_PAD`).
  - `timeline.ts`: (config, geometría, vista, acto) → fotograma. `controller.ts`: `waiting → appearing → paused → landing → landed` (+ `destroyed`). La pausa sólo sale con `enter()` (botón o avance automático), «Saltar», Atrás/ancla o cambio de ruta. Pestaña oculta o rotación: la aparición acaba en la pausa y el aterrizaje en la landing.
  - `world-geometry.ts` (export nuevo `./intro/world-geometry`): la geometría a partir de un `WorldConfig`; fuera de la ruta crítica porque arrastra zod.
- `@boia/engine/intro/scene` (Pixi, bajo demanda): pinta una vez el mundo de la demo (mismo arte y costas que `/juego`) en una textura con mar arriba y abajo; un shader lo proyecta como planeta con luz, atmósfera y una capa de nubes procedural que gira más deprisa. Al final del aterrizaje (k ≈ 0) entra el mundo vivo (mar animado, boia, barco) en un cruce corto (del 90 al 97 % del acto). EXPLORAR le cede aplicación, canvas y mar a `/juego` como en T12.
- Web: `intro-stage.tsx` (capa de la entrada: boia dibujada y «Cargando», «BOIA», «Zarpar» con el foco, «Solo quiero ver las entradas» y «Saltar animación» desde el primer momento); `lib/intro/load.ts` (geometría, CSS de posiciones y precarga de las imágenes del mundo desde el script de arranque); marca de visto `boia.intro.v2`.
- Movimiento reducido: mini-mundo quieto, título y botón; al pulsar, fundido de 0,4 s; 0 movimientos de cámara.

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint   # exit 0; 30 archivos, 324 pruebas (antes 306)
pnpm e2e                                   # exit 0; 50 pasadas, 10 omitidas (4 de grabación, 6 de la prueba de T13)
pnpm build                                 # ruta crítica de /: 163,8 kB gzip (T13: 161,6; límite de la tarea 192)
RECORD_INTRO=1 pnpm e2e record.spec.ts --workers=1   # vídeos y storyboard con la GPU del Mac
```
Grabaciones y storyboard: `docs/informes/img/p001-t14-entrada-{movil,escritorio}.webm` y `docs/informes/img/p001-t14-storyboard-{movil,escritorio}.png`. Con la GPU del Mac (`next dev`): aparición 2,01 s, aterrizaje 2,00 s, fotograma más largo 33 ms en móvil y 19 ms en escritorio. `window.__boiaIntro` da `sceneReadyMs`, `appearedMs`, `playedMs`, `longestFrameMs`, `renderer` y las `k` del aterrizaje.

Qué tiene que mirar Hernán en los móviles reales (P6), con `/?intro=1`:
1. `__boiaIntro.sceneReadyMs` (o si sale «Cargando» y luego la landing ligera): con la escena nueva hay más que cargar (Pixi, arte del mundo y el pintado de la textura). Si en 4G pasa de 2 s (`loadBudgetMs`), la entrada no se verá; se sube el plazo en la configuración.
2. Fluidez del giro y del aterrizaje (`longestFrameMs`, tirones al entrar el mundo vivo), y que el shader compile (sin él sale la landing ligera).
3. Encuadres: «BOIA», mini-mundo y «Zarpar» sin solaparse en vertical; el enlace «Solo quiero ver las entradas» ocupa dos líneas a 360 px.
4. Nitidez de la textura al acercarse y el corte de la tierra en el mar de relleno más allá del polo (se ve un momento hacia la mitad del aterrizaje en escritorio).
5. Safari de iOS y navegadores internos (Instagram): traspaso a `/juego` con EXPLORAR.
6. Si hace falta el avance automático de la pausa: sólo es poner `enabled: true`.

Desviaciones:
- La escena pinta el barco como una sola vista quieta (la W de la ilustración ligera), no con `ShipSprite`: ahorra 26 imágenes en la carga crítica de la entrada. `/juego` sigue creando su barco en el spawn (como en T12).
- `IntroAssets` sólo resuelve la isla de evento y el barco de la ilustración ligera; `art/planeta/` ya no lo usa nadie (se deja, no se toca `art/`).
- El enlace «Solo quiero ver las entradas» cuenta en analítica como `tickets_panel_open` con `source: 'hero'` (el contrato no tiene otra fuente que encaje).
- `landing.spec.ts` (axe): además de los 600 ms, espera a que acaben las animaciones finitas; en la suite completa, con la escena cargando de fondo, falló una vez a mitad del fundido de artistas.
- La prueba de T13 (`/sphere-probe`, `sphere-probe*.ts`) se deja como estaba y sigue funcionando; se puede retirar en una limpieza.

Sin probar:
- Móviles reales (ver arriba). En `pnpm e2e` (SwiftShader, en paralelo) sólo se exige la duración mínima de cada tramo.
- Pixi añade en móvil su botón oculto de accesibilidad táctil («select to enable accessibility…»), también en `/juego`; la prueba de acciones visibles lo excluye.

## 2026-09-28 — plan 001 T13: intro «mini-mundo», decisión, spec y prueba de la esfera (A/B)

Elección: **opción A** (esfera falsa en Pixi sobre el mundo real). En el móvil emulado con la CPU ×4 y la GPU del Mac va a 60 fps en el giro y a 60 en el aterrizaje. Con WebGL por software (SwiftShader), la esfera sola va a 53,6 fps. El aterrizaje entero baja a 47,2 fps, pero no por la esfera: baja en el último 14 %, el cruce con el mundo vivo de Pixi. Es el mismo mundo que pintan `/juego` y la llegada de T03, y la opción B también acabaría en él. El JS del fotograma no pasa de 1,8 ms (p95) ni con la CPU ×4. Software y GPU sólo discrepan en ese total del aterrizaje; la recomendación es A.

Qué existe:
- **D-19** en `docs/DECISIONES.md` (Hernán, pendiente Álvaro): las cinco decisiones del §4 de la propuesta. Modifica REQ-ENT-001, 002, 003, 006 y 007. Siguen igual REQ-ENT-004, 005, 008 a 012 y la landing ligera. Pregunta nueva **P9** para Álvaro.
- Spec: REQ-ENT-001, 002, 003, 006 y 007 reescritos en `docs/spec/02-entrada-y-landing.md` con los mismos ID, citando D-19 en la fuente. REQ-ENT-003 lleva `[pendiente Álvaro]` por el texto del botón. También cambian:
  - el párrafo de la sección de entrada;
  - sus filas en `09-requisitos.md`;
  - una fila nueva en «Contradicciones resueltas» de `00-indice.md`;
  - la entrada del glosario;
  - REQ-PRO-004, donde «entrada automática» pasa a ser «entrada cinemática».
- La prueba (calidad de usar y tirar, pero en el repo):
  - `packages/engine/src/intro/sphere-probe-pose.ts`: pose pura. Tiene curvatura `k`, zoom, giro y el punto delantero de la esfera. El radio es `rho / k`, así que en k = 0 la proyección es la cámara plana del juego. El aterrizaje es la isla de evento con el encuadre de llegada de T03.
  - Sus 4 pruebas: `k` baja de 1 a 0 sin retroceder; el final es el encuadre de T03; la esfera coincide con el plano (< 0,5 px) cuando entra el mundo vivo.
  - `sphere-probe.ts` (Pixi): pinta una vez en una textura de 2048×1024 el `SAMPLE_WORLD` entero, con el arte, las costas y el barco de `/juego`. Un shader en una malla a pantalla completa la proyecta como planeta, con luz y atmósfera, y al final entra el mundo vivo encima.
  - Ruta `/sphere-probe` (`apps/web/app/sphere-probe/`): siempre en desarrollo; en `next start`, sólo con `BOIA_SPHERE_PROBE=1`, y si no da 404 (comprobado). `window.__sphereProbe` tiene `setMode`, `still(k)` y `measure(ms)`.
  - `apps/web/e2e/sphere-probe.spec.ts`: la medición y las capturas.

Números (`BOIA_SPHERE_PROBE=1 pnpm e2e sphere-probe.spec.ts --workers=1`, exit 0, 6 pasadas). El móvil es Pixel 5 emulado a 360×640 con resolución Pixi 2, o sea 720×1280 px. «GPU» es Chromium sin cabeza con ANGLE sobre Metal (Apple M3 Pro); «software» es el Chromium sin cabeza de siempre (SwiftShader).

| Vista | Modo | CPU | Giro | Aterrizaje | Del aterrizaje: esfera · cruce · vivo |
|---|---|---|---|---|---|
| móvil 360×640 | GPU | ×4 | 60,0 | 60,0 | 60 · 60 · 60 |
| móvil 360×640 | GPU | ×1 | 59,9 | 60,0 | 60 · 60 · 60 |
| móvil 360×640 | software | ×4 | 56,3 | 47,2 | 53,6 · 22,9 · 31,0 |
| móvil 360×640 | software | ×1 | 60,0 | 53,1 | 60 · 29,1 · 34,6 |
| escritorio 1280×720 | GPU | ×1 | 59,9 | 60,0 | 60 · 60 · 60 |
| escritorio 1280×720 | software | ×1 | 60,0 | 53,2 | 60 · 28,2 · 33,1 |

Capturas (GPU): `docs/informes/img/p001-t13-esfera-k1-{movil,escritorio}.png` (mini-mundo, k = 1) y `p001-t13-esfera-k05-{movil,escritorio}.png` (medio aterrizaje, k = 0,5).

Comandos:
```
python3 tools/spec/check.py && python3 tools/spec/test_check.py   # exit 0; 279 REQ, 18 pruebas
pnpm test && pnpm typecheck && pnpm lint   # exit 0; 30 archivos, 306 pruebas (antes 29 y 302)
pnpm e2e                                   # exit 0; 42 pasadas, 10 omitidas (4 de grabación, 6 de la prueba)
BOIA_SPHERE_PROBE=1 pnpm e2e sphere-probe.spec.ts --workers=1   # fps y capturas
pnpm dev, y abrir /sphere-probe            # verla girar y aterrizar en bucle (aparición 2 s, reposo 2 s, aterrizaje 2 s)
pnpm --filter @boia/web budget             # ruta crítica de /: 161,6 kB gzip (T12: 161,2)
```

Para T14 (visto en la prueba):
- Sin un pintado de calentamiento, SwiftShader se paraba unos 300 ms en el primer fotograma del cruce. Ya está en la prueba, como hizo T03.
- El cruce pinta dos capas a pantalla completa y es el tramo más caro por software. En ese momento la esfera y el plano coinciden a menos de 0,5 px, así que se puede cambiar sin cruce o acortarlo.
- La textura está al 79 % de la escala de juego y al final se ve algo blanda. El mundo vivo del final lo resuelve. `?tex=4096` prueba una textura mayor, pero no se ha medido.
- Con k < 1, más allá del polo reaparece el borde sur del mundo (la boia tutorial arriba en la captura k = 0,5 móvil). Estirar el borde o repetirlo en espejo se ven peor. Hay que rellenar la textura con mar.
- El mundo mide 1000 u de ancho, así que el planeta sale con un 62 % de tierra: un canal de mar entre dos franjas verdes. Es una decisión de encuadre para T14 y Álvaro.
- La prueba no tiene nubes, y el agua está quieta (t = 0) para que la textura y el mundo vivo coincidan.

Desviaciones:
- `packages/engine/package.json` tiene una exportación nueva, `./intro/sphere-probe`, porque la ruta necesita cargar la prueba y el motor sólo exporta lo que lista. No toca ningún bundle de producción.
- La ruta abre en `next start` con `BOIA_SPHERE_PROBE=1` para medir el build de producción, que es el que usan las e2e.

Sin probar:
- Móviles reales (P6). La emulación ralentiza la CPU, pero no la GPU. Un M3 Pro sobra para este shader: una lectura de textura y unas pocas funciones trigonométricas por píxel. En un móvil de gama media hay que medirlo.
- Safari de iOS y los navegadores internos de las apps.

## 2026-09-28 — plan 001 T12: demo de punta a punta con datos de muestra

Cómo abrir la demo:
1. En el ordenador: `pnpm demo` (o `PORT=3100 pnpm demo` si el 3000 está ocupado) y abrir la URL «En este ordenador» que imprime.
2. En el móvil, conectado a la misma Wi-Fi: abrir la URL «En el móvil (Wi-Fi)», por ejemplo `http://192.168.1.149:3000`. La primera carga de cada página compila unos segundos.
3. Ctrl+C lo para todo. Para ver otra vez la entrada: `/?intro=1`.

Qué existe:
- Recorrido completo sin Supabase ni correo: `/` reproduce la entrada y termina en la landing. Tickets abre el panel de muestra. EXPLORAR EL UNIVERSO entra en `/juego`, donde están el barco, la boia tutorial, las rocas, las costas y la isla de evento. Al acercarse a la isla se abre el panel del evento de muestra. Minimapa, brújula, menú y selector del barco funcionan.
- REQ-ENT-012, EXPLORAR sin reiniciar el mundo:
  - EXPLORAR navega sin recargar la página (`router.push`).
  - La escena de la entrada no se destruye: cede su aplicación Pixi, su canvas, su contexto WebGL y su mar vivo (`IntroScene.release()`, `lib/world-handoff.ts`).
  - `/juego` los adopta: `createGame({ surface })` vacía el escenario y pinta el mundo en el mismo canvas. No hay segunda entrada ni segundo canvas.
  - Sin JS, con Cmd/Ctrl-clic, con un enlace directo o si la escena no llegó a cargar, `/juego` arranca en limpio, como antes.
  - `data-world` en `/juego` vale `adoptado` o `nuevo`. `__boiaIntro.explored` dice si se exploró desde la landing.
- Sección «Barco» del menú (antes «Mi Barco», que tenía el selector de prueba de T11; `ship-style-selector.tsx` se borró):
  - Lista los 9 estilos de `art/barco/manifest.json`: el Toon actual y los 8 de exploración. Cada uno tiene una miniatura SE, un nombre (`estilo` de `docs/barcos/barcos.json`) y una muestra por grupo de `paleta`.
  - Del estilo elegido enseña su descripción (`aspecto`) y sus skins con miniatura. Hoy sólo el Toon tiene fiesta y noche.
  - `notas_render` quita skins: B01 sólo base, B05 sin temáticas, B06 sin fiesta. Cada regla sólo vale mientras su nota siga en el registro (`SKIN_RULES`).
  - La paleta se resuelve leyendo las constantes del script de Blender, como `guia_colores.py` (`lib/barco/python-constants.ts`). Una prueba la compara con el Python.
  - Elegir aplica el cambio al barco al momento, sin recargar (`Game.setShip`), y lo guarda en `boia:estilo-barco` y `boia:skin-barco`. `?estilo=` sigue mandando y se actualiza en la URL.
  - `data-ship-style` y `data-ship-skin` dicen lo que el motor aplicó.
- `/artistas`: los 26 artistas de v14 §18.1, de la A a la Z, con géneros y avatar neutro. Es una página estática: funciona sin JS y sin WebGL. «Ver todos los artistas» enlaza ahí; antes desplegaba una lista A–Z en la misma landing.
- `pnpm demo` (`apps/web/scripts/demo.mjs`):
  - Arranca `next dev` en 0.0.0.0 e imprime las URL local y de red. Si el puerto está ocupado, sale con 1 y lo dice.
  - Next corre en su propio grupo de procesos. Ctrl+C o SIGTERM matan el grupo entero.
  - `next.config.ts` admite 127.0.0.1 como origen de desarrollo.

Comandos:
```
pnpm test && pnpm typecheck && pnpm lint   # exit 0; 29 archivos, 302 pruebas (antes 27 y 273)
pnpm e2e                                   # exit 0; 42 pasadas y 4 omitidas (grabación). Spec nueva: e2e/demo.spec.ts
DEMO_SHOTS=1 pnpm e2e demo.spec.ts --workers=1   # regenera las capturas
PORT=3100 pnpm demo                        # probado: imprime localhost y la IP de la Wi-Fi; tras Ctrl+C no queda nada escuchando en 3100
pnpm --filter @boia/web budget             # ruta crítica de /: 161,2 kB gzip (antes 161,9)
```
Capturas en `docs/informes/img/p001-t12-<paso>-{movil,escritorio}.png`, con 8 pasos: `1-landing`, `2-tickets`, `3-juego`, `4-isla`, `5-barco-menu`, `6-barco-estilo`, `7-barco-skin` y `8-artistas`.

Desviaciones:
- La sección se llama «Barco», como pide la tarea; §19 la llama «Mi Barco». Mantiene el id `barco` y el icono ⛵.
- REQ-ENT-012: el barco del juego no es el mismo objeto Pixi que el barco de la escena de la entrada. Se conservan la aplicación, el canvas, el contexto WebGL y el mar. Compartir el objeto del barco exigiría fundir la escena de T03 con el motor de T04.
- La entrada y el juego tienen encuadres distintos: al entrar, el barco aparece en el spawn del mundo, no donde estaba en la landing.
- El estilo por defecto (Toon) no tiene entrada en `barcos.json`. Usa el rótulo del manifiesto y, como muestras, los colores de marca de `referencias.marca`. No lleva descripción.
- Se tocaron ficheros de otras tareas, con cambios pequeños:
  - `packages/engine/src/game.ts`: `surface`, `setShip` y `adoptedSurface`.
  - `packages/engine/src/intro/scene.ts`: `release`.
  - `packages/engine/src/ship-style.ts`: skins; también se exporta desde `@boia/engine/ui`.
  - `e2e/juego-hud.spec.ts`: el nombre de la sección.

Sin probar:
- Móviles reales en la Wi-Fi, y el traspaso de WebGL en Safari de iOS y en el navegador de Instagram. Se probó con Chromium sin cabeza a 360×640 táctil y 1280×720.
- La opinión de Álvaro sobre nombres, estilos y la lista de artistas (`status: muestra`).

## 2026-09-28 — plan 001 T03: entrada cinemática planeta → mar → landing

Qué existe:
- `packages/engine/src/intro/` (nuevo, `@boia/engine/intro`, puro y sin Pixi):
  - `config.ts`: configuración versionada de la entrada (REQ-ENT-015). Incluye duración (3 s), curva, fases en fracciones de la duración, encuadres por ancho de vista, variante reducida, barco, objetos de escena y copy «BOIA.PLANET». Tiene validador propio con mensajes por campo.
  - `assets.ts`: resuelve los manifiestos de `art/` (planeta, barco, islas, rocas, boia) en URL, pivotes y escalas de escena.
  - `timeline.ts`: función pura (config, geometría, vista, t) → fotograma. Tiene 4 tiempos: planeta con flotación y nubes que giran, acercamiento con zoom logarítmico y `easeInOutCubic`, revelación del mar y llegada. El último fotograma es el encuadre de la landing.
  - `controller.ts`: máquina de estados `idle → waiting → playing → landed`, más `destroyed`. Crea como mucho una escena en toda su vida, muestra la landing una sola vez y nunca arranca el juego. Saltar, interrumpir y destruir son idempotentes. Un fotograma no adelanta la secuencia más de 250 ms.
  - `entry.ts`: `decideEntry` y `bootScript`, un script en línea que decide la entrada antes del primer pintado.
- `@boia/engine/intro/scene` (Pixi, se carga bajo demanda): globo, banda de mar con máscara, nubes, isla, el mar vivo del juego (`Water`) y el mundo de la landing (isla de evento, isla pequeña, rocas, boia animada y barco con balanceo). Las texturas se precalientan en la GPU antes de empezar.
- La web:
  - `(landing)/components/intro-stage.tsx` (escena del hero, bucle de pintado, eventos de pestaña, rotación, Atrás y caché del navegador);
  - `lib/intro/load.ts` (lee los manifiestos al construir y genera el CSS de la ilustración ligera);
  - `lib/intro/bridge.ts` (`window.__boiaIntro` con diagnóstico y `onLanded`).
- El hero ocupa la pantalla entera también bajo la cabecera, con el contenido abajo sobre un velo. Sin motor o sin JS, el hero muestra el mar en CSS con la isla y el barco en `<img>`, en el mismo encuadre que el último fotograma.
- Cómo se entra según el caso:
  - Primera visita: cinemática sin clic, con «Saltar animación» (también Escape).
  - Visita posterior (`localStorage boia.intro.v1`) o enlace con `#…`: directo a la landing.
  - Movimiento reducido: escena quieta y fundido de 0,4 s.
  - `/?intro=1`, o «Ver la introducción» en el pie: la vuelve a reproducir.
  - Si la escena no está lista en 2 s, sale la landing ligera, y la escena entra luego de fondo. Si el motor falla, se queda la landing ligera.
- `landing_view` lleva `intro: played | skipped | none` y se emite cuando la landing se ve.

Comandos:
```
pnpm test        # exit 0, 27 archivos, 273 pruebas tras fusionar T04, T05 y T11. La máquina de estados está en packages/engine/src/intro/controller.test.ts
pnpm e2e         # exit 0, 34 pasadas y 4 omitidas (grabación), tras fusionar T04, T05 y T11. intro.spec.ts: primera visita sin clic, Saltar ×5 y Escape, pestaña oculta, Atrás, movimiento reducido (0 movimientos de cámara), bundle de la escena bloqueado (isla ilustrada y Tickets), recursos lentos, visita posterior, enlace directo y ?intro=1
pnpm build       # ruta crítica de /: 161,9 kB gzip (antes 155,2); Pixi y la escena no entran en ella
RECORD_INTRO=1 pnpm e2e record.spec.ts --workers=1   # regenera vídeos y storyboard (usa la GPU del Mac)
```
Grabaciones y storyboard (ENT 06): `docs/informes/img/p001-t03-entrada-{movil,escritorio}.webm` y `docs/informes/img/p001-t03-storyboard-{movil,escritorio}.png`.

Medida (build de producción, Chromium con la GPU del Mac, 5 primeras visitas por vista): la secuencia dura 3,01 s a ~60 fps, y la landing se ve entre 3,2 y 3,5 s después de cargar. En Chromium sin cabeza con WebGL por software (SwiftShader, lo que usa `pnpm e2e`) hay un tirón de ~0,9 s tras el primer fotograma, y el mar va a ~20 fps: por eso la e2e sólo exige la duración mínima.

Desviaciones:
- Se tocó `packages/engine/package.json`, fuera de `src/intro/**`: se añadieron las exportaciones `./intro` y `./intro/scene`. `index.ts` no cambia.
- `scene.ts` importa `Water` de `packages/engine/src/water.ts` sin tocarlo. Si T04 cambia su firma, habrá que ajustar la escena al fusionar.
- La ruta `/api/art` sirve con `max-age=3600` en producción y sigue con `no-store` en desarrollo, para que la precarga del planeta sirva.
- `e2e/landing.spec.ts` (de T02) abre sus páginas como visita posterior. La prueba sin WebGL ya no bloquea `/api/art`, porque la landing usa ese arte, y sólo exige que no se pida `/juego`.
- `<html suppressHydrationWarning>` en el layout raíz: el script de arranque marca `data-entry` y `data-intro` antes de hidratar.
- El título «BOIA.PLANET» va centrado encima del planeta, no superpuesto.

Sin probar (para Hernán en móviles reales, ENT 04 y 05, REQ-ENT-018, 021 y 022):
- La cinemática en iPhone y Android físicos, en vertical y horizontal, y dentro del navegador de Instagram. Hay que mirar fluidez, que no haya flashes al empezar, las áreas seguras y la ausencia de audio. En la consola, `window.__boiaIntro` da `playedMs`, `landedAtMs`, `longestFrameMs` y `slowFrames`.
- El plazo de 2 s en 4G real: si se agota a menudo, la cinemática no llegará a verse.
- Lector de pantalla durante la entrada.
- Dirección artística: composición, velo y encuadre móvil. Álvaro no la ha aprobado: la configuración es `status: muestra`.

## 2026-09-28 — plan 001 T05: minimapa, brújula, Menú de a bordo, ajustes y cola de avisos

Qué existe:
- `packages/engine/src/ui/` es la lógica del HUD, sin Pixi ni DOM. Se importa como `@boia/engine/ui`, una subruta nueva del paquete, para que la interfaz HTML no arrastre el motor:
  - `hud-layout.ts` (`hudLayout`): coloca cada elemento en px CSS. La fila superior lleva Inicio y los datos de depuración a la izquierda, y la brújula y el ancla a la derecha. El minimapa mide 96 px en móvil, sin pasar del 22 % del ancho, y 128 px desde 1024 px (D-07). La zona del joystick es el 45 % inferior de la pantalla: el HUD no entra nunca ahí. Hay 4 zonas seguras para el minimapa (arriba o en medio, a la izquierda o a la derecha) y se descartan las que no caben en el viewport. En horizontal, por ejemplo, desaparecen las de en medio. `snapMinimap` elige la zona más cercana al soltar. La zona se guarda en `boia.minimapa.zona`. Si la guardada no cabe, se usa la de arriba del mismo lado sin olvidar la preferencia.
  - `minimap.ts`: la proyección del motor (`worldToScreen`), que mete el mundo entero en el cuadrado, y `MinimapGesture`. Un toque corto amplía. 500 ms quieto activan el arrastre. Si el dedo se mueve antes, no pasa nada.
  - `discovery.ts`: los objetivos salen de los datos del mundo. Son las islas, las boies y todo punto con función (evento, entradas, guía, premio…); las rocas no cuentan. Un objetivo se descubre al entrar en su radio de proximidad, o en colisión + 160 u si no tiene. La brújula apunta al objetivo elegido y, si no hay ninguno, al más cercano sin descubrir. `?evento=<id>` señala la isla de ese evento.
  - `notifications.ts` (`NoticeQueue`): los avisos salen de uno en uno, 4 s cada uno, con 300 ms de pausa entre ellos, sin duplicados y como mucho 8 pendientes. Si el reloj salta (pestaña oculta), recorre la cola en orden y sólo suena lo que llega a verse.
  - `settings.ts`: idioma (sólo español publicado, D-03), música y efectos por separado (activación y volumen) y modo del teclado. Se guarda en `boia.ajustes` y se lee con tolerancia.
- Teclado (D-14, `input/controls.ts`): `KeyboardControls.mode` vale `screen` (por defecto) o `tank`. En tanque, arriba avanza por el rumbo, izquierda y derecha giran y abajo suelta. Girar sin acelerar da un empuje de 0,4. `readShipInput` recibe el rumbo. `createGame` acepta `keyboardMode`, `Game.setKeyboardMode` lo cambia en caliente y `GameStats` trae `heading`.
- `/juego`:
  - `minimap.tsx`: el minimapa se dibuja en SVG. Un toque abre el mapa ampliado con nombre y función de lo descubierto; lo no descubierto sale como «?». Tocar un sitio lo elige para la brújula. La pulsación larga lo arrastra y lo ajusta al soltar.
  - `hud-buttons.tsx`: brújula y ancla.
  - `notices.tsx`: aviso arriba, azul marino y naranja, con dos notas cortas. Sale con los logros y recompensas del mundo y al descubrir una isla. Cada aviso sale una vez por sesión.
  - `menu/`: Menú de a bordo con los 7 iconos de §19 y una separación antes de Controles y Ajustes. Cada sección es un módulo en `menu/sections/` y se registra con una línea en `sections/index.ts`.
    - Con contenido: Welcome Aboard (borrador), Logros (los de esta sesión), Controles (explicación y modo de teclado; el sitio del minimapa también se elige ahí) y Ajustes.
    - Esqueleto: Mi Carnet y Ranking.
    - Mi Barco: por ahora, sólo el selector de estilos de T11.
  - `sound.ts`: canales de música y efectos. El «plop» y el aviso respetan Ajustes.
- Todo el HUD lleva `data-hud`, y la capa lleva `data-joystick-top`. El e2e comprueba con ellos que nada toca la zona del joystick.

Comandos:
```
pnpm test                   # exit 0, 23 archivos, 235 pruebas (con T11 en main; T04 dejó 18 y 179)
pnpm test --filter engine/src/ui   # zonas seguras, posición guardada, cola de avisos, gesto, brújula, ajustes
pnpm typecheck && pnpm lint # exit 0
pnpm e2e                    # exit 0; spec nueva e2e/juego-hud.spec.ts (4 pruebas × móvil 360×640 y escritorio)
```

Desviaciones:
- Se tocaron dos ficheros fuera de `ui/` e `input/`, con cambios pequeños. En `packages/engine/src/game.ts`: la opción `keyboardMode`, `setKeyboardMode` y `heading` en las estadísticas. En `packages/engine/package.json`: la subruta `./ui`.
- El selector de estilos de prueba de T11 estaba abajo a la izquierda, dentro de la zona del joystick. Ahora está en la sección Mi Barco del menú y funciona igual (guarda el estilo y recarga con `?estilo=`). T12 lo sustituye.
- Descubrimientos y logros se guardan sólo en memoria: al recargar se pierden. Guardarlos es de T07. Las boies se descubren sin aviso; las islas, con aviso.
- En la fila superior, el aviso tapa Inicio, la brújula y el ancla durante 4 s. Tocarlo lo cierra.
- Con 320–360 px de ancho, los iconos del menú encogen hasta 36 px para que quepan los 7 y la separación.
- La zona del joystick (el 45 % inferior de la pantalla) es una decisión `muestra`. El joystick sigue naciendo donde toca el dedo (D-12).

Sin probar:
- Móviles reales. Se probó con Playwright sin cabeza (360×640 táctil y escritorio) y con capturas fuera del repo en `/tmp/orchestrator-attach/boia-planet-T05/`: menú, mapa, arrastre y aviso.
- La vibración al empezar el arrastre y el sonido en iOS, que necesita un gesto previo.
- La música: todavía no hay ninguna pista. El canal existe y obedece a Ajustes.

## 2026-09-28 — plan 001 T11: el barco en los 8 estilos de exploración, elegible en el juego

Qué existe:
- `tools/blender/ship_styles.py` envuelve los 8 estudios de `tools/blender/styles/NN_*.py` sin modificarlos: misma cámara (`rig.py`, 30°, D-13), la luz y el postproceso de cada estudio, un empty de balanceo, la pasajera de `ship.py` con materiales del estilo y los anclajes calculados de la geometría (`bow`/`wake_origin` en los extremos del casco en el agua, `mast_top` en el punto más alto, `slot_passenger` sobre la cubierta en un punto elegido por estilo). Nombre y descripción de cada estilo salen del registro `docs/barcos/barcos.json` (`estilo`, `aspecto`, id `B0N`).
- `art/barco/estilos/<id>/`: por estilo, la skin `base` con los mismos fotogramas que el barco actual (8 direcciones sin y con pasajera y 8 de balanceo `S_bob_N`, 24 PNG) y su `manifest.json` completo (`status: muestra`, `style: <id>`). Ids: `boceto-lapiz`, `acuarela`, `low-poly`, `semi-realista`, `arcilla`, `cartoon-30`, `cel-shaded`, `pixel-art`. Noche y fiesta siguen sólo en el estilo actual (`muestra`), cuyos 56 PNG no cambian.
- `art/barco/manifest.json` gana `style_label` y `style_variants` (id, label, barco, description, manifest). El esquema los admite; `check.py` valida cada estilo con las mismas reglas que el barco (skin base) y exige que no haya carpetas sin listar.
- Motor: `packages/engine/src/ship-style.ts` (`loadShipStyle`, `requestedShipStyle`, `resolveShipStyle`, `readShipStyleIndex`). `?estilo=<id>` gana; sin parámetro, el guardado en `localStorage` (`boia:estilo-barco`); un id desconocido vuelve al por defecto.
- `/juego`: selector de prueba abajo a la izquierda (`apps/web/app/juego/ship-style-selector.tsx`). Elegir un estilo lo guarda y recarga con `?estilo=<id>`, sin perder el resto de la URL (`?pasajera=1`, `?arte=marcadores`). Funciona sobre la vista de barco de T04: 8 direcciones, pasajera y fotogramas `bob` del manifiesto del estilo.
- Escala: T04 saca la escala de todo el mundo del manifiesto del barco. Para que un estilo no encoja o agrande el mundo, `loadShipStyle` le pone el `displayScale` del estilo por defecto. Todo sale de la misma cámara, así que cada remolcador se ve a su tamaño modelado: de 49 a 57 px de eslora, contra los 48 del barco actual.
- Hoja de contacto a escala de juego (la del motor; densidad 2) sobre agua: `docs/informes/img/p001-t11-barco-estilos.png`. Una fila por estilo (muestra arriba, luego el orden de arriba); en cada fila, las 8 direcciones sin y con pasajera.

Comandos:
```
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/render.py -- --all                          # exit 0, 270 imágenes
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/render.py -- --all --out tools/blender/out/rerun
diff -r art tools/blender/out/rerun              # sin salida, exit 0: 286 archivos idénticos
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/render.py -- --ship-style pixel-art        # un solo estilo
python3 tools/blender/check.py [--diff]          # exit 0, "16 manifiestos válidos, 270 imágenes"
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/contact_sheet_estilos.py                   # hoja de contacto
python3 tools/barcos/guia_colores.py --check     # exit 0, 0 referencias rotas (no se tocan los scripts de estilo)
```

Desviaciones:
- Reproducibilidad: `bmesh.ops` crea las mismas caras en distinto orden en cada proceso de Blender (arcilla y lápiz salían con 1 o 2 niveles de diferencia en unos pocos píxeles). `ship_styles.canonical_order()` ordena vértices, aristas y caras por geometría antes de renderizar, y con eso las dos corridas son idénticas byte a byte.
- Cambiar `render.py` cambia el `sources_sha256` de los manifiestos del mundo, pero no sus PNG. Como T11 no puede tocar `art/` fuera de `barco`, esos 7 manifiestos quedan con el hash anterior. El próximo `--all` que se commitee los pone al día. `check.py` no verifica ese hash.
- La pasajera está en la cubierta de proa, en un punto elegido por estilo para que se vea en las 8 direcciones. En semi-realista y pixel-art hubo que adelantarla porque la caseta la tapaba en NW. En lápiz es gris, como todo el estilo. En cartoon usa la paleta del estilo (rojo y crema).
- D-15 fija 48 px de eslora para el barco actual. Los remolcadores de exploración miden entre 49 y 57 px a la escala del mundo. Se prefirió no reescalarlos, para no romper la densidad compartida con el mundo.

Sin probar:
- En un teléfono real: se probó en el navegador de escritorio y con emulación de 375 px.
- La opinión de Álvaro sobre los estilos.
- Las texturas de pantalla de lápiz, acuarela y cartoon con el balanceo en movimiento.

## 2026-09-28 — plan 001 T04: catálogo de objetos y comportamientos v1, boia tutorial, isla de prueba

Qué existe:
- `packages/world/src/behaviors.ts`: el catálogo v1 de §48.3 con un esquema zod de parámetros por módulo, compartido por motor y editor. Son 13 tipos: `collision` (`mode`: block, bounce, brake, slow, boost; `intensity`, `duration`, `solid`), `proximity`, `dialogue` (líneas de 140 caracteres como máximo, con señal opcional `pulse_menu`/`pulse_minimap`; `interval` 1,5 s; `leaveReaction`; `once`), `collectible`, `reward` (`frequency`: once, session, season, repeatable), `content`, `ticket`, `checkpoint`, `teleport`, `spawn`, `achievement`, `decorative` y `start_minigame` (punto de extensión vacío). Los rangos son seguros (§48.8) y hay valores por defecto `muestra`. Las acciones llevan `on` opcional; si falta, se disparan al recoger, al entrar en proximidad o al contacto, por ese orden.
- `WorldObject.behaviors` sólo admite tipos del catálogo y exige la geometría que cada uno necesita. `WorldConfig.coast` nombra el arte de las costas. `WORLD_SCHEMA_VERSION` sigue en 0: los objetos de muestra de T06 ya usaban estos tipos, y `schema.test.ts` de `@boia/db` los sigue validando.
- `packages/world/src/art.ts`: contrato de los manifiestos del mundo de T01 (`sprite` y `tile`: pivote, anclajes, sugerencias, animaciones, variantes de costa). `sample-world.ts` contiene el mundo de muestra, que es sólo datos: spawn, boia tutorial con 7 líneas (borrador, pendiente Álvaro), 4 rocas (`roca-a`/`roca-b`, que rebotan o bloquean), una isla pequeña decorativa y la isla de evento (`isla-evento`, proximidad de 330 u, que abre el evento de muestra `ev-all-day-primavera`, más ticket y logro), con costas a ambos lados.
- `packages/engine/src/world/`:
  - `runtime.ts` (`WorldRuntime`): motor de comportamientos puro, sin Pixi. Da la física con efectos (`shipConfig`); en cada paso resuelve colisiones con restitución por objeto, contacto, recogida, proximidad con histéresis, diálogo, recompensas con clave de idempotencia, spawn con semilla y teletransporte a agua segura. Emite `WorldEvent`s. `MINIGAMES` está vacío.
  - `simulate.ts`: simulación sin render, con traza.
  - `visual.ts`: qué PNG, pivote y escala tiene cada objeto, y la escala del arte a partir del barco.
  - `assets.ts`, `object-view.ts`, `coast-view.ts` y `bubble.ts`: la parte Pixi. La boia tutorial usa su bucle `idle`. Las costas son losas repetidas cuya `collision_x_px` cae sobre el límite del mundo. El bocadillo se toca para avanzar y tiene un botón «Saltar».
- Barco: `SHIP_LENGTH` pasa a 48 (D-15) y el radio de colisión a 13,5. Todo el arte usa la escala del barco. En parado se balancea: con los fotogramas `bob` del manifiesto en la vista S y con ±0,9 px por código en el resto. El slot TRIPULANTE carga las imágenes `_p` y está oculto por defecto (`setPassenger`).
- `createGame` acepta `onWorldEvent`, `runtime` y `artUrl` (`null` = sin arte). `Game` expone `runtime`, `advanceDialogue`, `skipDialogue` y `setPassenger`. Espacio o Intro avanzan el bocadillo; Escape lo salta. La cámara no enseña más de 56 px de tierra bajo el borde inferior.
- `/juego`: marcadores de minimapa (96 px, como mucho el 22 % del ancho; 128 px en escritorio) y del ancla del menú, que pulsan cuando lo pide la boia. El panel del evento (HTML, no modal) se abre al acercarse a la isla y se cierra al alejarse o con ×; muestra el botón Entradas si el evento está a la venta. Cada bocadillo hace un «plop» sintetizado. `?pasajera=1` enseña la pasajera; `?arte=marcadores`, el mismo mundo sin arte.

Comandos:
```
pnpm test                 # exit 0, 18 archivos, 179 pruebas (antes 13 y 123)
pnpm test --filter engine # 8 archivos, 58 pruebas: runtime, sustitución de asset, visual
pnpm typecheck && pnpm lint   # exit 0
```
Pruebas nuevas:
- `runtime.test.ts`, una o varias por comportamiento: ralentizar quita su intensidad durante su duración y después se recupera; bloquear y rebotar; frenar; boost; la proximidad dispara entrada y salida una vez aunque el barco dude en el borde; el diálogo avanza a 1,5 s, se toca, se salta, reacciona al alejarse y respeta `once`; el recogible concede según `once`/`session`/`season`/`repeatable` a lo largo de tres sesiones; contenido, ticket y logro; checkpoint; teletransporte fuera de tierra; spawn con semilla; decorativo; minijuego no disponible.
- `swap.test.ts`: roca-a → roca-b, isla-pequena o marcador, y el mundo de muestra entero con arte o con marcadores. Se dibuja distinto y la traza es idéntica.
- `behaviors.test.ts` y `sample-world.test.ts`: validan contra los manifiestos reales de `art/`.

Desviaciones:
- «Snapshot de la traza»: la prueba de sustitución compara la traza del asset B con la del asset A en la misma ejecución, no con un archivo `.snap`. Así no se rompe cuando otra tarea ajusta la física.
- Los textos de `/juego` están en el componente, no en `apps/web/lib/i18n`, que queda fuera del alcance.
- `obstaclesFromWorld` ahora sólo cuenta los objetos con una COLISIÓN sólida del catálogo. Una geometría de colisión sin comportamiento ya no bloquea.
- La costa inferior se dibuja por código: T01 no tiene losa inferior.

Sin probar:
- Móviles reales. Se probó con Playwright sin cabeza (390×844 táctil y 1280×800): el toque en el bocadillo avanza, Espacio avanza, pulsan minimapa y ancla, el panel se abre a unos 5,6 s de salir y se cierra al alejarse o con ×, la pasajera y los marcadores funcionan, y no hay errores en consola. Capturas fuera del repo, en `/tmp/orchestrator-attach/boia-planet-T04/`.
- El sonido «plop» en iOS, que exige un gesto previo.
- Recompensas y logros sólo se emiten: nadie los guarda ni los muestra (T05 avisos; T07 progreso).

## 2026-09-28 — plan 001 T01: primer lote de arte del mundo desde Blender

Qué existe:
- `tools/blender/style.py` y `tools/blender/styles/muestra.py`: el estilo del barco (toon de 3 tonos, sombras violeta, contorno de casco invertido) y la paleta de muestra del mundo, sacados de `ship.py`. `render.py -- --style <nombre>` elige otro archivo de `styles/` con la misma API. Cambiar de estilo es volver a renderizar. Los `NN_*.py` de exploración siguen siendo scripts sueltos.
- `tools/blender/world.py`: recursos procedurales con la cámara del barco (30°, D-13) y su misma densidad (88,28 px por unidad), así que el motor les aplica la escala del barco. Un plano *holdout* a z=0 recorta lo que queda bajo el agua.
- `art/` tiene 7 recursos nuevos, cada uno con su `manifest.json` (`status: muestra`, `license: muestra interna`, `style`, generador y sha256 de las fuentes):
  - `isla-evento`: isla grande con escenario, hueco para el cartel y muelle decorativo;
  - `isla-pequena`: isla secundaria;
  - `boia-tutorial`: bucle `idle` de 12 fotogramas a 8 fps, con balanceo y farol que parpadea;
  - `roca-a` y `roca-b`;
  - `costa`: losas `izquierda` y `derecha`, que se repiten en vertical sin costura;
  - `planeta`: capas `globo`, `nubes`, `banda-mar` e `isla`.
- Cada manifiesto trae pivote, anclajes (rótulo, cartel, muelle, bocadillo, polo…), huella en polígono, `hitbox_hint` y `proximity_hint`. Las costas traen `shore_x_px`, `collision_x_px` y `outer_fill`.
- Contrato del mundo: `tools/blender/asset.schema.json`. El barco gana los campos `kind: ship` y `style`; sus 56 PNG no cambian byte a byte.
- `render.py -- --all` escribe todos los recursos; `--out` es ahora la raíz (cada recurso va en `<out>/<id>`) y `--only <id>` renderiza uno solo. `check.py` valida todas las carpetas de `art/`, exige las de `RESOURCES` de `render.py` y `--diff` compara por recurso.
- `tools/blender/contact_sheet.py` genera la hoja de contacto `docs/informes/img/p001-t01-hoja-mundo.png`, a escala de juego (48 px de eslora, D-15) y densidad 2.

Comandos:
```
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/render.py -- --all                          # exit 0, 78 imágenes, ~9 s
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/render.py -- --all --out tools/blender/out/rerun
diff -r art tools/blender/out/rerun              # sin salida, exit 0: 86 archivos idénticos
python3 tools/blender/check.py [--diff]          # exit 0, "8 manifiestos válidos, 78 imágenes", ~8 s
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/calibrate.py                                # ratio=1.9998
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/contact_sheet.py                            # hoja de contacto
```

Desviaciones:
- La isla de evento tiene un radio de 4,4 unidades. A escala de juego mide unos 250 px CSS de tierra y 320 px contando el agua somera. Es grande, pero cabe en un teléfono de 390 px.
- En el planeta, la isla se apoya en el polo norte del globo. Así, desde 30° se ve 2:1, igual que en el juego. La «banda de mar» es ese mismo globo visto de cerca, con la curvatura arriba. La capa `isla` es la isla de evento a media escala y con contorno doble.
- Las costas son sólo las laterales. No hay esquinas ni costa inferior.

Sin probar:
- El motor todavía no lee estos manifiestos: eso es T04 (mundo) y T03 (entrada).
- Las proporciones de la isla, la boia y las rocas frente al barco en un teléfono real.
- La opinión de Álvaro sobre estilo y paleta.

## 2026-09-28 — plan 001 T06: esquema Supabase, migraciones y RLS

Qué existe:
- `supabase/migrations/`: 7 migraciones de SQL plano, acumulativas, con prefijo de 14 cifras como la CLI de Supabase. Crean 26 tablas en `public`, todas con RLS:
  - `base`: esquema `private`, `staff_roles` (editor < admin < owner, protección del último propietario) y `audit_log` (sólo altas, con motivo vía `set_config('boia.audit_reason', …, true)`).
  - `identity`: `carnets` (apodo, avatar, `member_since`), `carnet_questions` con las 5 preguntas textuales de §44.1 y `carnet_answers`.
  - `events`: `seasons` (una activa), `islands`, `events` con los 7 estados de §49.4 (`draft, coming_soon, on_sale, sold_out, postponed, cancelled, finished`, los mismos nombres que `@boia/contracts`) e isla separada, y `event_secrets` para la secret location.
  - `world`: `world_objects` en borrador y `world_revisions` (draft/published, inmutables al publicarse); la versión activa es `seasons.active_world_revision_id`.
  - `home`: `home_blocks`, `home_revisions` y `site_settings.active_home_revision_id`.
  - `progress`: `achievements` (catálogo de triggers, `key` + `key_version`), `purchases` y `ledger_transactions` con id estable elegido por el servidor. Un disparador deriva `point_balances`, `coin_balances`, `season_points`, `user_achievements`, `stamps` y `user_cosmetics`; una corrección es una transacción `compensation`.
  - `bottles`: `bottles` (una activa por cuenta, 140 caracteres), `bottle_reads` y `bottle_reports`.
- Permisos: anon y authenticated nunca escriben saldos, roles, sellos, libro, auditoría, estados de compra ni `events.state`/`published_at`. Los derivados del libro no los escribe ni service_role. Los permisos del Admin exigen `aal2` (TOTP, D-10).
- `supabase/seeds/*.sql`: muestra (`is_sample`, slugs `muestra-…`). Hay una temporada, una isla, 4 eventos (a la venta, próximamente, finalizado en la misma isla y borrador), 3 objetos, un mundo publicado, 9 bloques de home y 4 logros. `supabase/sample/remove-sample.sql` la retira.
- `packages/db` (`@boia/db`):
  - `src/harness.ts`: crea y borra sólo bases `boia_planet_test*` y aplica shim, migraciones y datos; registra en `supabase_migrations.schema_migrations`.
  - `sql/supabase-shim.sql`: roles, `auth.uid()`/`auth.jwt()` y privilegios por defecto de Supabase.
  - `sql/fixtures/`: cuentas y libro de prueba.
  - `src/database.types.ts`: tipos generados con la forma de `supabase gen types`.
  - Pruebas: `rls.test.ts` y `schema.test.ts`.

Comandos:
```
pnpm db:test            # exit 0, 20 comprobaciones, 7 migraciones, ~2 s
pnpm test --filter db   # exit 0, 2 archivos, 46 pruebas
pnpm db:types           # regenera packages/db/src/database.types.ts (una prueba exige que esté al día)
pnpm test               # exit 0, 13 archivos, 123 pruebas (tras fusionar T02)
pnpm typecheck          # exit 0
```
`pnpm db:test` aplica todo a `boia_planet_test` vacía y comprueba RLS y permisos. Después siembra, retira la muestra y la repone, y comprueba que repetir migraciones y semillas no cambia nada. Por último, para cada corte k, aplica las migraciones y los datos hasta k y encima las migraciones nuevas, sin perder filas. Al terminar borra la base. Cada archivo de vitest usa su propia base `boia_planet_test_v<pid>_<aleatorio>`. `BOIA_PG_URL` cambia el servidor (por defecto `postgresql://localhost:5432/postgres`).

Desviaciones:
- El script raíz `test` traduce `--filter X` a un filtro de ruta de vitest (`/X/`). Antes, vitest rechazaba `--filter`.
- Las semillas están en `supabase/seeds/<versión>_*.sql`, no en `supabase/seed.sql`: cada una declara la migración que necesita. Con la CLI de Supabase: `[db.seed] sql_paths = ['./seeds/*.sql']`.
- Los roles `anon`, `authenticated` y `service_role` se crean en el servidor local si faltan y no se borran (NOLOGIN).
- Al fusionar T02, los enums `event_state` y `home_block_type` se alinearon con `EVENT_STATES` y `HOME_BLOCK_TYPES` de `@boia/contracts` (`coming_soon`, `store`, `footer`). Una prueba de `schema.test.ts` exige que sigan iguales.

Sin probar:
- Las migraciones contra un proyecto Supabase real (`boia-planet-dev`, P7). Tampoco PostgREST ni supabase-js con los tipos generados.
- `pg_cron` y las funciones auditadas de publicación y cambio de estado: son de T08 y T09.

## 2026-09-28 — plan 001 T02: landing por bloques, panel de Tickets y analítica

Qué existe:
- `packages/contracts` (nuevo, zod): los 7 estados de evento con su comportamiento en home y Tickets, el evento prioritario vigente, próximos eventos, 9 tipos de bloque de home (mostrar/ocultar, programación `showFrom`/`showUntil`, ids únicos), artistas, fotos, promociones y los 6 eventos del embudo (D-04). `purchase_confirmed` queda fuera del tipo del cliente.
- `apps/web/app/(landing)/`: la home ahora se pinta desde una lista tipada de bloques con datos de muestra (`apps/web/lib/landing/sample-content.ts`). Bloques: hero (BOIA UNDERGROUND MUSIC FESTIVAL, frase de §37.11, EXPLORAR EL UNIVERSO de 64 px con pulso del 4 % cada 3 s, Tickets de 48 px), evento prioritario, próximos eventos, fotos (marcadores con alt), los 26 artistas de §18.1 en tríos que rotan cada 5 s con botón de pausa y A–Z plegable, filosofía, tienda como enlace externo, contacto y pie con enlaces legales (`/legal/privacidad|condiciones|cookies`, textos pendientes). Un bloque oculto, fuera de programación o sin contenido no pinta nada.
- Panel de Tickets en HTML en `/#tickets`: evento destacado y los próximos a la venta, «Próximamente» si no hay nada. Funciona sin JavaScript (CSS `:target`); con JS hay foco, Escape, Atrás, fondo `inert` y analítica.
- i18n por claves: `apps/web/lib/i18n/es.ts` y `t()`. Sólo español.
- PostHog UE sin SDK (`apps/web/lib/analytics`): POST a `/i/v0/e/` sólo si existe `NEXT_PUBLIC_POSTHOG_KEY`. El id anónimo vive en memoria, sin cookies ni storage. Se emiten `landing_view`, `explore_start`, `tickets_panel_open` y `ticket_click_out`, que siempre quedan en `window.__boiaAnalytics`.
- Rotación de artistas: ventanas de 3 sobre un orden barajado con semilla fija, así servidor y cliente coinciden.

Comandos:
```
pnpm test     # exit 0, 77 pruebas (antes 42): rotación, renderizador de bloques, contratos
pnpm build    # exit 0; imprime la ruta crítica de / (scripts/landing-budget.mjs): 155,2 kB gzip de 1024
pnpm e2e      # exit 0, 10 pruebas (mobile 360×640 y desktop, Chromium): CTA y Tickets sobre el pliegue, panel sin WebGL ni bundle del juego, /#tickets, sin JS, axe 0 serios/críticos
pnpm lint && pnpm typecheck   # exit 0
```
La primera vez en una máquina: `pnpm --filter @boia/web exec playwright install chromium` (~94 MB). `pnpm e2e` construye y arranca `next start` en el puerto 3107.

Desviaciones:
- Se tocaron tres archivos fuera del alcance nombrado. En `vitest.config.ts`, `oxc.jsx.runtime: automatic`, porque Next exige `jsx: preserve` y sin eso las pruebas no pueden renderizar componentes. En `package.json` de la raíz, el script `e2e`. `apps/web/app/page.tsx` se borró porque lo sustituye `app/(landing)/page.tsx`.
- No se instaló `posthog-js`: su dependencia `core-js` tiene un script de build que pnpm 11 bloquea, y `pnpm install` salía con exit 1. En su lugar se llama directo a la API de captura. Pesa 0 kB y no hace falta banner de cookies.
- La ruta crítica cuenta los polyfills `nomodule` (38,6 kB), que los navegadores modernos no descargan. La cifra es conservadora.
- Mi Carnet y el control de sonido de la navegación (REQ-ENT-029) no están: llegan con T07 y T05.

Sin probar:
- El envío real a PostHog: no hay clave. Falta crear el proyecto UE y pasar `NEXT_PUBLIC_POSTHOG_KEY` con `pedir-token`.
- Móviles reales.
- Copy, enlaces oficiales, correo, tienda y ticketera son de muestra (`example.com`), pendientes de Álvaro.

## 2026-09-28 — plan 001 T00: «boia» con i en todo el repo

Qué existe:
- D-18 en `docs/DECISIONES.md`: grafía valenciana «boia» (femenino), plural «boies». La v14 (`docs/fuente/v14-maestro.md`) conserva la grafía con y como texto histórico.
- 17 archivos versionados cambiados (spec, DECISIONES, PLAN, prompt 01, informes 01 y 02, CLAUDE.md, skill `encargo`, docstrings de `tools/blender/ship.py`). Las rutas absolutas a la carpeta del proyecto ya dicen `/Users/heralc/Desktop/boia.planet`, antes de que Hernán renombre la carpeta al cerrar el plan 001.
- Formas derivadas adaptadas: el slug de la tarea `objetos-y-boia-tutorial` de `docs/PLAN.md` (antes con y).

Comandos:
```
git grep -I -i -n -E "bo[y]a" -- ':!docs/fuente/v14-maestro.md' ':!plans/'   # sin salida, exit 1
python3 tools/spec/check.py        # exit 0, 279 requisitos, centinelas 10/10
python3 tools/spec/test_check.py   # exit 0, 18 pruebas
python3 tools/blender/check.py     # exit 0, 56 imágenes
pnpm test                          # exit 0, 42 pruebas
```

Desviaciones:
- No se re-renderizó el barco: en `ship.py` sólo cambian un docstring y un comentario.
- `plans/001-demo-l1.md` sigue con la grafía con y (5 veces): el plan es del orquestador.

Sin probar:
- La skill `encargo` apunta a `/Users/heralc/Desktop/boia.planet`, que todavía no existe: hasta el renombrado, el `cd` de su paso 0 falla.

## 2026-09-28 — encargo 01: pipeline de arte del barco en Blender

Qué existe:
- Blender 5.2.2 LTS en `/Applications/Blender.app`, instalado con `brew install --cask blender`.
- `tools/blender/`: `rig.py` con la cámara y el render compartidos, `ship.py` con el barco procedural, `render.py` para el lote y el manifiesto, `calibrate.py`, `check.py` y `manifest.schema.json`.
- `art/barco/`: 56 PNG de 256×256 y `manifest.json`. Son 3 skins × 8 direcciones × con y sin pasajera, más 8 fotogramas de balanceo en base/S. Todo lleva estado `muestra`.
- `tools/viewer/index.html`: visor estático.
- `tools/blender/styles/NN_*.py`: 8 pruebas de estilo de la lámina de conceptos de Hernán, con sus hojas en `docs/informes/img/01-estilo-*.png`. Son exploración: no alimentan `art/`.

Comandos y cuánto tardan:
```
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/calibrate.py        # ~2 s; ratio=1.9998
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/render.py -- --all  # ~6 s de reloj, 56 imágenes
python3 tools/blender/check.py [--diff [DIR]]   # ~8 s; exit 0 y "56 imágenes, manifest válido"
python3 -m http.server 8080                     # desde la raíz; visor en http://localhost:8080/tools/viewer/
```
Para comprobar la reproducibilidad, se renderiza otra vez con `--out tools/blender/out/rerun` y después se corre `check.py --diff`. Hoy da 0 píxeles distintos y archivos idénticos byte a byte.

Desviaciones:
- La cámara va a 30° de elevación y no a 26,57°. Sólo 30° da la proporción 2:1 que mide la calibración; con 26,57° el cubo da 2,2355. D-13 lo confirma.
- El sol no proyecta sombras: con el contorno de casco invertido, todo quedaba en sombra.
- Se añadió el anclaje `bow` y el vector `bow_screen` al manifiesto.

Sin probar:
- El visor en teléfono real.
- La opinión de Álvaro sobre el diseño y el estilo.

Detalle: `docs/informes/2026-09-28-01-arte-barco-blender.md`.

## 2026-09-28 — encargo 02: spec v15 consolidada

**Existe ahora** (commits `75f7f61` y el que aplica D-13 a D-17):
- `docs/spec/` con 12 archivos: 279 REQ `REQ-<ÁREA>-<nnn>` (244 L1 · 33 L2 · 2 diferidos), definidos en 01–08 y listados en `09-requisitos.md` con fuente, alcance y criterio verificable. `docs/DECISIONES.md` prevalece; la v14 queda como fuente histórica.
- Para trabajar: leer `docs/spec/00-indice.md` y los archivos de área que nombre el encargo, y citar los requisitos por ID.
- Comandos: `python3 tools/spec/check.py` (exit 0, 0,05 s, «279 requisitos, 0 duplicados, centinelas 10/10») y `python3 tools/spec/test_check.py` (18 pruebas de mutación, OK, 1 s).

**Falta o no se probó**: 20 REQ `[provisional]` esperan al orquestador (18 de alcance que D-02 no nombra, 2 contradicciones nuevas); 24 `[pendiente Álvaro]`; 2 `[pendiente Hernán]` (dispositivos de referencia, P6). El estado de implementación por REQ (REQ-PRO-017) todavía no tiene archivo.

**Desviaciones**: 26.114 palabras por `wc -w`, por encima de las 12.000–18.000 esperables; centinelas 10/10 y no 7/7, porque la lista del prompt suma 10 cadenas; en 09 el texto es un título corto y la frase completa vive en el archivo del área; se añadió `tools/spec/test_check.py`. D-12 a D-17 llegaron durante la sesión y están aplicados. Detalle en `docs/informes/2026-09-28-02-spec-v15-consolidada.md`.

## 2026-09-28 — encargo 03: monorepo y motor base

**Existe ahora** (commit `b9dd060`):
- Monorepo pnpm: `apps/web` (Next 15.5), `packages/world` (esquema zod v0, proyección 2:1, contrato del manifiesto), `packages/engine` (PixiJS 8.21). TS 5.9 estricto, ESLint 9, Prettier, vitest 5.
- Comandos: `pnpm install` (13 s en frío), `pnpm test` (42 pasados, 0,3 s), `pnpm typecheck` (2,6 s), `pnpm lint` (2,0 s), `pnpm build` (20 s), `pnpm dev` (`0.0.0.0:3000`). Todos con exit 0.
- `/juego`: barco navegable con joystick que nace donde toca el primer dedo, drift con el segundo dedo o con Shift, flechas/WASD, agua animada, estela, costas laterales e inferior, borde superior abierto con corriente de vuelta y tres rocas. HUD con FPS, velocidad y drift.
- Lee los sprites del 01 (`art/barco/manifest.json`) a través de `/api/art/*`, que sólo sirve en desarrollo. Sin manifiesto, o con `?barco=provisional`, usa el barco dibujado por código.
- Medido: 120 FPS en el Mac; `/juego` pesa 287 kB de JS gzip + 114 kB de PNG.

**Falta o no se probó**: móviles reales (Hernán); arte en producción (Storage o copia a `public/`); skins distintas de `base`, pasajera y balanceo.

**Desviaciones**: cámara a 30° (26,57° es el ángulo de las aristas; con 26,57° no sale losa 2:1). Coordenadas de mundo alineadas con la pantalla sobre el plano del agua. Teclado como dirección de pantalla. Corriente de retorno pasado el borde superior (§49.7). Detalle en `docs/informes/2026-09-28-03-monorepo-y-motor-base.md`.
