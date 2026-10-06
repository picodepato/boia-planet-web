# Guía de prueba — Castillo v3, la Fiestera, arreglos de /mar y el Carnet de artista

> Para Hernán. El plan 016 hace la tercera vuelta a «Defensa del Castillo» (curvas en U más
> anchas, Ibiza 45/30/20 s y las de más pagan menos, +15 % de daño en cuatro islas, cámara
> que sigue al avión, sonido al mejorar el castillo, sin turbo en la arena), mueve la Boia
> Fiestera, arregla tres cosas de `/mar` y, añadido a mitad de plan, da los números de socio
> por orden de llegada, el enlace de artistas y el sello «ARTISTA». Quiere contestar: **¿se
> queda así el castillo y se puede enseñar?** Las respuestas van al final («Notas»). Las guías
> anteriores siguen valiendo para lo que no cambia:
> [v2 (plan 015)](2026-10-06-castillo-v2-guia-prueba.md),
> [v1 (plan 014)](2026-10-06-castillo-guia-prueba.md).

## Qué cambia

### El castillo (T181, T183; reglas versión 6)

- **Curvas en U más anchas**: dentro de cada U cabe la isla más grande y un 30 % más (radio
  135 → 150; 210 u de agua entre los bordes del carril). El camino crece muy poco; el paseo
  sigue en 44 s.
- **Ibiza**: cuesta 63 (antes 70), sus mejoras 45 y 60; paga 14 / 29 / 59 monedas cada 10 s,
  así que se devuelve en **45 s**, la mejora a 2 en **30 s** y la de 3 en **20 s**.
- **Las Ibizas de más pagan menos**, por orden de construcción: la primera el 100 %, la segunda
  el 70 %, la tercera y siguientes el 50 %. Si se vende la primera, las demás suben un puesto.
- **El dinero de Ibiza entra solo** (sin montón ni recoger). Cada pago sale como un **«+N»
  dorado grande** encima de la isla, del mismo tamaño en pantalla con cualquier zoom, por
  encima de todos los efectos y nunca tapado por el HUD.
- **La ficha de Ibiza** dice lo que paga **de verdad** esa isla y tiene un «¿Cómo paga?»
  plegable con dos líneas (cuánto paga cada 10 s; las de más pagan menos).
- **+15 % de daño** en Faro, Puerto, Nochevieja y Benidorm, a todos los niveles. Halloween,
  el Sonido e Ibiza, igual.
- **Cámara**: abierta del todo, como antes (fija en el centro, se mueve un poco con el
  avión). **Desde medio zoom hacia dentro el avión va siempre en el centro**; entre medias,
  una mezcla suave. Acercado, la vista puede pasar del borde de la arena.
- **Sonido propio al mejorar el castillo** (golpe de piedra y fanfarria corta, `muestra`).
- **Sin turbo en la arena**: el botón de turbo y la velocidad no salen mientras se juega al
  castillo. En el Cañón y en `/mar` siguen.

### La Boia Fiestera (T180)

- Navegando por la línea amarilla hacia el Puerto de Alicante, la Fiestera está **a la
  derecha de la línea, cerca, justo antes del Puerto** (en `[8,0, 16,5]`). La línea no cambia.
  Su zona y la del Puerto ya no se pisan; la boya «descubrir» pasó a `[2,0, 17,0]`.

### Arreglos de `/mar` (T184)

- Tras abrir y cerrar **«Mi Barco»** (con el botón, Escape o el menú), las **flechas** vuelven
  a mover el barco.
- En la guía del castillo, el bocadillo **«mover» apunta al avión** y el de **«ficha» a la
  isla** instalada, con su cola.
- Textos: «Primera regata» donde aún ponía «Por Los Rápidos»; «Rápido» tiene su propia línea
  de progreso (ya no la de «Rayo»).

### Carnet: números, enlace de artistas y sello (T186)

- **Nº de socio por orden de llegada**, la misma serie para artistas y socios, **sin huecos**
  (un alta fallida no gasta número). Los números de hoy no cambian.
- En **Admin → Socios**, «Cambiar nº» a un número **libre** (queda en la auditoría).
- **Un enlace de artistas** `/artista/<código>`, que se crea y se cambia desde Admin → Socios
  (el enlace se ve una sola vez). Quien crea su Carnet con él es artista; un código viejo o
  equivocado da un Carnet de socio normal, sin aviso.
- El Carnet de artista lleva un **sello de goma «ARTISTA»** arriba en el anverso, como los
  sellos de las fiestas (tinta oscura, `muestra` hasta que lo vea Álvaro).
- En **modo local** no hay número («—»); cualquier `/artista/<código>` marca el Carnet como
  artista (sólo para enseñarlo).

## Cómo probarlo rápido

En `pnpm dev`, o en la versión publicada con `dev=1`. Una partida con atajos nunca entra en el
ranking.

| Atajo | Qué mirar |
|---|---|
| `/mar?minijuego=castillo&islas=1&t=150` | Las siete islas puestas: el «+N» de Ibiza cada 10 s; tocar Ibiza → «¿Cómo paga?» |
| `/mar?minijuego=castillo&monedas=500` | Construir tres Ibizas seguidas: la ficha de cada una dice 14 / 10 / 7 a nivel 1 |
| `/mar?minijuego=castillo&dificultad=tormenta&duracion=10&t=505&islas=1` | El final de 10 min en Tormenta con las islas más fuertes |
| `/mar?minijuego=castillo&oferta=1` | La guía: «mover» y «ficha» apuntan al avión y a la isla |
| `/artista/prueba` | Crear el Carnet en local → sale el sello «ARTISTA» |

Recorridos:

1. **La Fiestera**: `/mar`, seguir la línea amarilla hacia el Puerto de Alicante; antes de
   llegar, la Fiestera queda a la derecha.
2. **Mi Barco y flechas**: menú → Mi Barco → cerrar; las flechas mueven el barco.
3. **Cámara del castillo**: en una partida, acercar poco a poco con la rueda o el pellizco:
   desde medio zoom el avión se queda en el centro; mandarlo lejos tocando el agua.
4. **Mejorar el castillo**: suena su sonido. El turbo y la velocidad no están; al salir, vuelven.
5. **Carnet de artista** (con cuentas; la migración ya está en `boia-planet-dev`): Admin → Socios → «Enlace de
   artistas» → crear; abrir el enlace en otra sesión y crear un Carnet; «Cambiar nº» a uno libre
   y a uno ocupado (lo rechaza).

## Equilibrio medido (T185, reglas versión 6, todo dentro)

**El bot** (`buildingBot`, la construcción sencilla), vida del castillo al final, 6 semillas:

| | 5 min | 7 min | 10 min |
|---|---|---|---|
| **Tranquila** | 6/6 oro, 100 % | 6/6 oro, 100 % | 6/6 oro, 100 % |
| **Normal** | 6/6 oro, 100 % | 6/6 oro, 100 % | 6/6 oro, 100 % |
| **Tormenta** | 6/6 oro, 100 % | 6/6 oro, 100 % | 6/6 oro, 100 % |

Antes (plan 015): Normal 26–73 %; Tormenta 5 min 0/6, 7 min 3/6, 10 min 6/6 (1–33 %). Es lo
que eligió Hernán en T181 (islas más fuertes, enemigos igual).

**Una sola isla (+ Ibiza) repetida**, semilla 7, vida al final (F = cae, en s):

| Isla | Normal 5 / 7 / 10 | Tormenta 5 / 7 / 10 |
|---|---|---|
| Faro | 100 / 75 / 100 | 63 / 100 / 100 |
| Nochevieja | 100 / 100 / 100 | 63 / 100 / 100 |
| Halloween | 100 / 50 / 25 | 63 / 63 / F 508 |
| Puerto | 100 / 100 / 100 | 100 / 100 / 100 |
| Isla del Sonido | 67 / 50 / F 508 | 34 / F 319 / F 508 |
| Benidorm | 100 / 100 / 100 | 100 / 100 / 100 |

- **Sin Ibiza** no llega el dinero: cae en Normal (188–193 s) y Tormenta (153–163 s); en
  Tranquila gana.
- Lo que cambia de lado: ahora las islas que suben (Puerto, Benidorm) **solas aguantan
  Tormenta al 100 %**, y las fuertes de antes (Halloween, el Sonido) son las que caen solas.

## Rendimiento en `baja` (T183)

Pico de 10 min en Tormenta con las siete islas a nivel 3 y los «+N» nuevos: p95 33,4 ms
(como el plan 015), también con la CPU a 4×.

## Qué contestar

1. ¿Las U más anchas se ven mejor? ¿Cabe bien una isla dentro?
2. ¿Se lee bien el «+N» dorado de Ibiza? ¿Molesta con muchas Ibizas?
3. ¿Se entiende el «¿Cómo paga?» de la ficha y que la 2.ª y la 3.ª paguen menos?
4. **El bot gana todo al 100 %, también Tormenta, y Puerto o Benidorm solos aguantan
   Tormenta.** ¿Se queda así (Tormenta sigue siendo difícil para una persona, como dijo
   Hernán), o se sube algo la vida de los enemigos en Normal y Tormenta?
5. ¿La cámara que sigue al avión al acercar va bien en el móvil? ¿Marea?
6. ¿El sonido del castillo gusta? ¿Se echa de menos el turbo en la arena?
7. ¿La Fiestera queda bien a la derecha de la línea, antes del Puerto?
8. ¿El sello «ARTISTA» y el enlace de artistas sirven así para enseñárselo a Álvaro?
9. ¿Listo para enseñar el castillo a Álvaro (con el borrador del plan 015)?

## Lo que hace Hernán

- Hecho el 2026-10-06: las migraciones `20261006100500_castle_config_v6.sql` y
  `20261006100600_member_numbers_artist_link.sql` están aplicadas en `boia-planet-dev`;
  `pnpm db:types:dev` no cambió nada y `pnpm test:supabase` dio 93/93.
- Queda crear el enlace de artistas real desde Admin → Socios (y aplicar las dos migraciones
  en producción cuando se publique con cuentas).

## Notas
