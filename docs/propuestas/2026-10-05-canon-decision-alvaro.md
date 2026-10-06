# Borrador para Álvaro · El Cañón «Que no pare la música», versión definitiva

Borrador para Hernán (plan 013, T156, 2026-10-05). **No está en `docs/DECISIONES.md`**: Hernán
lo enseña a Álvaro y, con su respuesta, lo pasa a una decisión (tal cual o con cambios). Recoge
lo construido en los planes 010–013 (betas 1–3 y la versión definitiva, en `main`), el diseño de
referencia ([2026-10-04-canon-survivors.md](2026-10-04-canon-survivors.md)) y las decisiones de
Hernán del 2026-10-05 (cabecera de `plans/013-canon-definitiva.md`). Todo lo que se enseña es
`muestra`: nombres, textos, cifras, premios, música y dibujos esperan su visto bueno.

Cómo probarlo: [guía de prueba de la versión definitiva](2026-10-05-canon-definitiva-guia-prueba.md).

---

## Qué es el Cañón ahora

El minijuego del Cañón ya no es la escena 2D de disparar a tiburones. Es **«Que no pare la
música»**, un juego tipo *Vampire Survivors* de **7 minutos** que se juega **en el mismo mar de
`/mar`**, donde está el barco: al empezar se apartan las líneas guía y lo interactivo del mundo,
y al acabar todo vuelve.

- **Historia** (`muestra`): la banda de **Los Aguafiestas** quiere apagar la fiesta del planeta
  BOIA y trae a la fauna del mar y a monstruos marinos. Hay que aguantar hasta que amanezca.
- **Cómo se juega**: sólo se mueve el barco; las armas disparan solas. Los enemigos sueltan
  notas musicales; con notas se sube de nivel y se elige 1 de 3 cartas (armas nuevas, vinilos
  que mejoran el barco, evoluciones). Si el agua a bordo llega al tope, el barco se inunda y la
  partida acaba.
- **Contenido**: 6 enemigos comunes con élites, 7 armas, 9 vinilos, 4 evoluciones, un botín de
  las élites, dos minibosses (el **Vecino Quejica** y el **Tiburón Martillo**) y dos bosses
  finales: el **Barco Pirata Fantasma** (acto 1) y el **Kraken** (acto 2).
- **Dos actos**: vencer al Barco Fantasma abre el acto 2. El **acto 3** (el Capitán Aguafiestas
  y el apagón) **no se construye en esta versión**: sale cerrado como «Próximamente» y queda
  para una versión posterior.
- **Tres dificultades**: Tranquila, Normal y Tormenta.
- **Medallas**: bronce = aguantar hasta las 7:00; plata = aguantar y vencer a los dos
  minibosses; oro = vencer al boss final (la partida acaba ahí, con un final especial).
- **Antes de jugar**, un pop-up para elegir acto y dificultad, con el ranking del boss final.
- **Al acabar**, una tarjeta con la medalla, tiempo, enemigos, notas, puntos, armas y vinilos,
  el puesto en el ranking y los logros.
- **Sonido** sintetizado en el propio código (sin archivos ni licencias) con volumen y silencio
  en la pausa; **accesible** con teclado, movimiento reducido y avisos para lectores de
  pantalla.
- En el móvil funciona en calidad `baja`; sin la etiqueta «BETA» desde esta versión.

---

## Qué necesita el visto bueno de Álvaro

### 1. Nombres y textos

- Nombre del modo, **«Que no pare la música»**, y la historia de **Los Aguafiestas**.
- Nombres de enemigos, bosses, armas, vinilos y evoluciones (los ve en la guía y jugando).
- Todos los textos de la interfaz del Cañón (`apps/web/lib/i18n/es-mar.ts`, claves
  `mar.canon.*` y `survivors.*`): cartas, avisos, tarjeta final, pop-up.

### 2. Premios por partida

Sustituyen al premio de la beta (150 puntos + 50 monedas una vez por temporada). **Cada medalla
se cobra una vez al día**, por separado; un oro cobra también la plata y el bronce del día que no
se tuvieran.

| Medalla | Puntos | Monedas |
|---|---|---|
| Bronce | 30 | 10 |
| Plata | 60 | 20 |
| Oro | 100 | 40 |

Un oro de primeras, un día: 190 puntos + 70 monedas. Antitrampas: un oro antes de que entre el
boss final (5:30) no vale; las partidas empezadas con un atajo de prueba o terminadas con
«Terminar partida» no pagan nada.

### 3. Logros

| id | Nombre | Pide | Premio |
|---|---|---|---|
| `canon-zarpa` (nuevo) | Zafarrancho | jugar una partida | 20 pts + 10 monedas |
| `canon` (el de siempre) | Hasta que amanezca | aguantar una partida (bronce o más) | 60 pts + 30 monedas |
| `canon-fantasma` (nuevo) | Exorcista | vencer al Barco Fantasma | 80 pts + bandera fantasma |
| `canon-kraken` (nuevo) | Rompetentáculos | vencer al Kraken | 120 pts + mascota minikraken |
| `canon-tormenta` (nuevo, oculto) | Ojo del huracán | vencer al Kraken en Tormenta | 150 pts + 50 monedas |

- **Cambio de `guardacostas`**: ahora pide *ganar el Faro y jugar una partida del Cañón* (antes,
  ganarla), para que nadie se quede sin el barco Cel-shaded por su dispositivo.
- Del diseño original **se quitan** `canon-capitan` y el barco «El Apagón» (eran del acto 3).

### 4. La mascota minikraken

Una categoría nueva en Mi Barco, **«Mascota»** (activar y desactivar; preparada para más). La
primera es el **minikraken**, que se gana con «Rompetentáculos»: un pulpito morado con una franja
naranja BOIA que va en la popa del barco en todo `/mar` (navegando, en las carreras y en el
Cañón), se mece y saluda con un tentáculo cerca de las islas. **No ayuda a jugar.** Falta
revisar su forma, colores, tamaño y sitio en cada barco.

### 5. El ranking por boss

Una tabla por boss final (Barco Fantasma y Kraken). Puntos de partida = enemigos × 10 + notas × 5
+ medalla (bronce 2 000, plata 4 000, oro 8 000) + 100 por cada segundo que faltara para el
amanecer al vencer al boss final, todo × dificultad (Tranquila 0,75, Normal 1, Tormenta 1,5).
Sin cuenta, se compite con la tripulación de muestra y el mejor propio del navegador; con cuenta,
ranking global (pendiente de aplicar su migración en Supabase). Fórmula, cifras y tripulación de
muestra: `muestra`.

### 6. La música

Hoy todo el sonido es **sintetizado** (`muestra`): efectos, un bucle tipo drum and bass durante la
batalla, una variante más pesada con los bosses y, al acabar, vuelve el ambiente del mar. Queda
hecho el hueco para **pistas reales de BOIA**: Álvaro decide si las hay, cuáles y con qué
derechos.

### 7. Cambios de requisitos

Los criterios de la spec describen el cañón 2D antiguo. Se propone:

- **REQ-AVE-037 «Cañón contra tiburones»** → «Que no pare la música». Criterios nuevos: una
  partida de 7:00 en el mar de `/mar` con el barco como único mando; enemigos, armas, vinilos y
  cartas; dos minibosses y un boss final por acto (dos actos); bronce, plata y oro; pausa con
  «Terminar partida»; control táctil y con teclado; en calidad `baja` en el móvil. Los enemigos
  vencidos **se sumergen** (por defecto, sin heridas visibles, como pide hoy el REQ); el estilo
  «puf» queda como opción oculta y no cambia el REQ.
- **REQ-AVE-038 «Sesiones de minijuego validadas»**: `won` (lo que alimenta `win_minigame`, el
  logro `canon` y `guardacostas`) = **bronce o más**; premio **por medalla, una vez al día cada
  una**; en el Cañón se valida el **tiempo activo** (las pausas no cuentan; más de 5 min seguidos
  en pausa abandona la partida).
- **REQ-AVE-039 «Accesibilidad de los minijuegos»**: la revisión del Cañón (movimiento reducido,
  sin audio, teclado, áreas táctiles, avisos visibles) está escrita en la guía de prueba; el Faro
  2D sigue pendiente de su rediseño.

### 8. Los atajos de prueba

Los atajos de desarrollo (`t=`, `acto=`, `armas=`…) siguen funcionando en la versión de prueba
con `?dev=1`, pero una partida empezada con un atajo **nunca** paga, desbloquea logros ni entra
en el ranking. Antes de publicar de verdad se puede decidir quitarlos.

---

## Qué no cambia sin Álvaro

Hasta su respuesta todo sigue `muestra` y la versión de prueba sigue como está: nombres, cifras,
premios, mascota y música se pueden cambiar en la configuración sin tocar el juego.
