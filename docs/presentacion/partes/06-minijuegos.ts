import type { Deck } from '../../../tools/deck/src/deck.ts';

// Parte 6: los tres minijuegos del mar (~9 diapositivas, plan 018 T209).
// Cada juego: qué es, cómo se ve jugando y qué premia; al final, cómo se
// llega a cada uno, qué falta y las preguntas. Las capturas salen de
// partidas de verdad, llevadas al momento de la foto con los atajos de
// prueba (que se quitan al publicar).
export const titulo = 'Minijuegos';

export default function (d: Deck) {
  d.portadaParte({
    subtitulo: 'Tres juegos dentro del mar: una carrera, una noche de supervivencia y una defensa',
    secciones: ['Los Rápidos', 'Cañón «Que no pare la música»', 'Defensa del Castillo', 'Cómo se llega y qué premia'],
    notas: [
      'Los tres se juegan en el mismo mar, con el mismo barco: no hay que cambiar de pantalla.',
      'Son la segunda vía para que la gente vuelva a la web entre fiesta y fiesta.',
      'Todo lo que se ve es de muestra: nombres, cifras y premios esperan el visto bueno de Álvaro.',
    ],
  });

  // ── Los Rápidos ──
  d.queEs({
    seccion: 'Los Rápidos',
    titulo: 'Una carrera de tres vueltas por el mar',
    texto: [
      'Un circuito marcado con 9 boias numeradas por el mapa. Al llegar a la salida, una tarjeta explica la carrera y pregunta; con «Empezar» hay semáforo y cuenta atrás.',
      'Tres vueltas pasando por las boias en orden, con flechas en el agua que impulsan y rampas que hacen saltar. Si te saltas una boia, la vuelta no cuenta; si te sales del circuito más de 5 s, se acaba.',
    ],
    destacado: 'En carrera el barco corre más (22 nudos en vez de 15) y se quitan las líneas guía.',
    captura: 'rapidos-oferta',
    notas: [
      'La salida es también la meta, junto al semáforo.',
      'Compites contra los tiempos de la tripulación de muestra y contra ti mismo.',
      'Fijaos: el botón «Menú» y el «!» tapan un trozo de la tarjeta; está en «qué falta».',
    ],
  });
  d.telefonos({
    seccion: 'Los Rápidos',
    titulo: 'En carrera y en la meta',
    telefonos: [
      { captura: 'rapidos-carrera', pie: 'Arriba: tiempo, vuelta y la boia que toca' },
      { captura: 'rapidos-meta', pie: 'Meta: medalla, récord, puesto y «Otra vez»' },
    ],
    notas: [
      'Medalla de oro, plata o bronce según el tiempo; la tarjeta dice cuánto falta para la siguiente.',
      '«Otra vez» corre contra un fantasma: tu mejor carrera, a tu lado.',
      'Acabarla da el logro «Primera regata»; bajar de 80 s, «Rápido», que regala la mascota «Tortuga turbo».',
    ],
  });

  // ── El Cañón ──
  d.queEs({
    seccion: 'Cañón «Que no pare la música»',
    titulo: 'Aguantar la noche contra un enjambre',
    texto: [
      'Un juego de supervivencia: oleadas de pirañas, medusas, gaviotas, cangrejos, piratas y peces espada van a por el barco. Tú sólo navegas; las armas disparan solas.',
      'Cada enemigo suelta notas musicales; con ellas subes de nivel y eliges una mejora. Si el agua a bordo llega al tope, el barco se hunde. Si aguantas 7 minutos, amanece y ganas.',
    ],
    destacado: 'Antes de jugar se eligen el acto (1 o 2) y la dificultad: Tranquila, Normal o Tormenta.',
    captura: 'canon-previa',
    notas: [
      'Se juega donde está el barco, en el mismo mar: el resto del mundo se aparta y vuelve igual al acabar.',
      'El acto 2 se abre al vencer al jefe final del acto 1; el acto 3 dice «Próximamente».',
      'El pop-up enseña el ranking contra el jefe final de ese acto.',
    ],
  });
  d.telefonos({
    seccion: 'Cañón «Que no pare la música»',
    titulo: 'Jugando: enjambre, mejoras y jefes',
    telefonos: [
      { captura: 'canon-partida', pie: 'Partida llena, con el Tiburón Martillo' },
      { captura: 'canon-carta', pie: 'Al subir de nivel: elige una de tres' },
      { captura: 'canon-kraken', pie: 'El Kraken, jefe final del acto 2' },
    ],
    notas: [
      'Arriba a la derecha, las armas y vinilos que llevas, con su nivel.',
      'La partida espera mientras eliges carta; se juega con el dedo o con el teclado.',
      'El botón «Derrota: sumergirse» de abajo es de prueba y se quita al publicar.',
    ],
  });
  d.queTiene({
    seccion: 'Cañón «Que no pare la música»',
    titulo: 'Jefes, armas, botín y medallas',
    puntos: [
      'Jefes: el Vecino Quejica (2:30), el Tiburón Martillo (4:30) y al final el Barco Pirata Fantasma o el Kraken',
      '7 armas (Cañón de agua, Subwoofer, Focos, Boyas, Confeti, Traca, Lluvia ácida) y 9 vinilos de música',
      'Las armas a tope evolucionan: El Drop, Muro de Sonido, Show de Láseres y Bola de Discoteca',
      'Botín que sueltan a veces los enemigos: imán de notas, la Llama y el salvavidas',
      'Medallas de bronce, plata y oro (el oro, venciendo al jefe final); cada una paga una vez al día',
      'Ranking por jefe final: una tabla del Fantasma y otra del Kraken',
    ],
    captura: 'canon-final',
    notas: [
      'Premio de muestra: bronce 30 puntos y 10 monedas, plata 60 y 20, oro 100 y 40.',
      'Una partida empezada con atajos de prueba nunca entra en el ranking, y la tarjeta lo dice.',
      'El sonido está hecho por la propia web (drum and bass): sin licencias que pagar.',
    ],
  });

  // ── Defensa del Castillo ──
  d.queEs({
    seccion: 'Defensa del Castillo',
    titulo: 'Defender el castillo de Santa Bárbara',
    texto: [
      'Un juego de defensa de torres: los enemigos del Cañón salen de un remolino y van por un camino de curvas hacia el castillo. Tú vuelas en avioneta y disparas.',
      'Con las monedas que ganas levantas islas del mar como torres: siete, las de las fiestas y lugares del mundo, y cada una ataca a su manera. Ibiza, además, da monedas cada 10 s.',
    ],
    destacado: '3 dificultades × 5, 7 o 10 minutos: 9 combinaciones, cada una con su medalla y su ranking.',
    captura: 'castillo-previa',
    notas: [
      'Cuanto más larga, más jefes: en la de 10 minutos llegan el Vecino, el Martillo, el Fantasma y el Kraken.',
      'Las islas se suben a nivel 3, se venden y se elige a quién disparan; el avión y el castillo también mejoran.',
      'La primera partida pregunta si quieres una guía con bocadillos cortos.',
    ],
  });
  d.telefonos({
    seccion: 'Defensa del Castillo',
    titulo: 'Islas como torres y una mascota de premio',
    telefonos: [
      { captura: 'castillo-partida', pie: 'Las siete islas puestas; Ibiza paga «+59»' },
      { captura: 'castillo-construir', pie: 'Construir: cada isla con su foto y precio' },
      { captura: 'castillo-final', pie: 'Victoria en Tormenta: desbloquea Cañoncito' },
    ],
    notas: [
      '×2 acelera la partida y «Llamar oleada» la adelanta a cambio de unas monedas.',
      'Ganar en cada dificultad da un logro; en Tormenta, la mascota «Cañoncito», y en Tormenta de 10 min, una estela.',
      'Hoy un jugador automático gana todas, también Tormenta: hay que decidir si se endurece.',
    ],
  });

  // ── Cómo se llega y qué premia ──
  d.hojaDeRuta({
    seccion: 'Cómo se llega y qué premia',
    titulo: 'Dónde está cada juego y qué da',
    columnas: ['Juego', 'Dónde está', 'Qué premia', 'Ranking'],
    anchos: [1.1, 1.6, 2.2, 1.3],
    filas: [
      [
        'Los Rápidos',
        'La salida, junto al semáforo',
        'Logros «Primera regata» y «Rápido» (con la mascota Tortuga turbo)',
        'Mejor tiempo',
      ],
      [
        'Cañón',
        "L'Illeta dels Banyets: panel de la isla y «Jugar»",
        'Puntos y monedas por medalla, una vez al día cada una',
        'Por jefe final: Fantasma y Kraken',
      ],
      [
        'Castillo',
        'Castillo de Santa Bárbara: panel y «Jugar»',
        'Un logro por dificultad; Cañoncito y la estela del vórtice',
        '9 tablas: 3 dificultades × 3 duraciones',
      ],
      [
        'Los tres',
        'Tablón del faro (Tabarca), minimapa y la ayuda «!»',
        'Hoy todo de muestra: cifras y premios los fija Álvaro',
        'También en /ranking de la web',
      ],
    ],
    notas: [
      'El Tablón del faro, cerca de la salida, explica los tres juegos y enseña tu mejor medalla.',
      'Desde el minimapa se elige navegar hasta el juego o ir directamente.',
      'Sin cuentas cada uno compite en su navegador contra tres miembros de muestra.',
    ],
  });

  // ── Qué falta ──
  d.queFalta({
    seccion: 'Los tres juegos',
    items: [
      {
        texto: 'Quitar los atajos de prueba: enlaces que empiezan partidas a medias y el botón «Derrota: sumergirse»',
        etiqueta: 'necesario',
        quien: 'Hernán',
      },
      {
        texto: 'Que el botón «Menú» y el «!» no tapen las tarjetas de la carrera en el móvil',
        etiqueta: 'necesario',
        quien: 'Hernán',
      },
      {
        texto: 'Aprobar los tres juegos: nombres, textos, el Vecino Quejica, las mascotas y el Castillo entero',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Fijar los premios: puntos y monedas por medalla y por logro, y los 80 s del logro «Rápido»',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Ajustes de juego: cómo se hunde el barco al perder en el Cañón y si el Castillo se endurece',
        etiqueta: 'puede-esperar',
        quien: 'Hernán',
      },
      {
        texto: 'Música de BOIA para los juegos (hoy la crea la propia web) y el acto 3 del Cañón',
        etiqueta: 'puede-esperar',
        quien: 'Álvaro y socios',
      },
    ],
    notas: [
      'Los atajos sólo funcionan con un código en la dirección, pero no deben salir en la versión final.',
      'Los rankings de todos llegan con las cuentas de usuario (parte 4).',
      'Las cifras se cambian en la configuración sin tocar los juegos.',
    ],
  });

  d.preguntas({
    seccion: 'Los tres juegos',
    preguntas: [
      '¿Os gustan los nombres «Los Rápidos», «Que no pare la música» y «Defensa del Castillo», y las mascotas?',
      '¿Los juegos dan sólo puntos y monedas, o también algo de verdad (un descuento, una consumición)?',
      '¿El Castillo se queda así (hoy se gana fácil, también en Tormenta) o lo hacemos más difícil?',
      '¿Salen los tres el primer día o abrimos uno nuevo cada cierto tiempo para tener novedades?',
    ],
    propuestas: [
      'Un reto semanal en el Tablón del faro (p. ej. «gana el Castillo en Tormenta») con un descuento de premio.',
      'Un botón «Compartir mi medalla» en la tarjeta final, con una imagen lista para Instagram.',
      'El jefe del acto 3 del Cañón inspirado en el cartel de una fiesta de BOIA.',
      'Una pantalla con el ranking de Los Rápidos en directo durante la fiesta.',
    ],
    notas: [
      'Las propuestas salen del código y de los documentos: son ideas, no decisiones; Hernán las revisa.',
      'Lo que se decida entra en la hoja de ruta de la parte 8.',
    ],
  });
}
