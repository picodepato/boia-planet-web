import type { Deck } from '../../../tools/deck/src/deck.ts';

// Parte 4: el Carnet BOIA y el Ranking (~6 diapositivas, plan 018 T207).
// Hoy todo vive en el navegador de cada visitante (D-20): cada diapositiva
// dice qué cambia cuando se conecten las cuentas de usuario.
export const titulo = 'Carnet BOIA y Ranking';

export default function (d: Deck) {
  d.portadaParte({
    subtitulo: 'El carné de cada BOIERO, con sus sellos de fiesta, y la clasificación de los juegos',
    secciones: ['Carnet BOIA', 'Carnet público', 'Carnet de artista', 'Sello de la fiesta', 'Ranking'],
    notas: [
      'El Carnet es la identidad de cada persona en BOIA.PLANET: lo que ha vivido, no lo que tiene.',
      'Hoy todo se guarda en el navegador de cada uno: nadie más lo ve hasta que haya cuentas.',
    ],
  });

  // ── Carnet BOIA ──
  d.queEs({
    seccion: 'Carnet BOIA',
    titulo: 'Un carné de identidad para cada BOIERO',
    texto: [
      'Una tarjeta naranja del tamaño de un DNI. Delante: apodo, avatar, rango, puntos, «miembro desde» y un QR que abre su Carnet público. Detrás, como un pasaporte, un sello por cada fiesta.',
      'Debajo: editar, compartir, sus respuestas a las preguntas de BOIA, insignias, su barco y «Descargar mis datos». Se crea en un momento desde el mar o desde /carnet.',
    ],
    destacado: 'Hoy se guarda sólo en este navegador: con cuentas tendrá número de miembro y será de todos.',
    captura: 'carnet-anverso',
    notas: [
      'Los rangos van por puntos: Grumete, Marinera, Timonel y Capitana de la fiesta (nombres y cifras de muestra).',
      'El número de miembro sale con una raya: lo da el servidor cuando haya cuentas.',
      'La línea de letras de abajo imita la de un pasaporte.',
    ],
  });
  d.telefonos({
    seccion: 'Carnet BOIA',
    titulo: 'Los sellos, el Carnet de otros y el de artista',
    telefonos: [
      { captura: 'carnet-reverso', pie: 'Detrás: un sello por fiesta' },
      { captura: 'carnet-publico', pie: '/carnet/…: el Carnet de otro miembro' },
      { captura: 'carnet-artista', pie: 'Con el enlace de artistas, sello «ARTISTA»' },
    ],
    notas: [
      'Los sellos de la captura se pusieron para la foto; cada fiesta tendrá su propio diseño.',
      'El Carnet público nunca enseña el email; se puede reportar si algo está mal. Los de muestra llevan «MUESTRA».',
      'El de artista es igual, con el sello «ARTISTA» y «Carnet de artista».',
    ],
  });

  // ── Sello de la fiesta y cuentas ──
  d.queTiene({
    seccion: 'Sello de la fiesta',
    titulo: 'El QR de la fiesta y lo que traen las cuentas',
    puntos: [
      'En la fiesta hay un QR (puerta y barra): con la cámara del móvil se abre /sello y el sello cae en tu Carnet',
      'Sólo vale durante la fiesta, uno por persona, y suma puntos (hoy 50, de muestra)',
      'Con cuentas: entrar con el email (un código de 6 cifras) y «Escanear sello» dentro del Carnet',
      'Con cuentas: número de miembro, Carnet visible para todos, cerrar sesión y borrar la cuenta',
      '«Descargar mis datos» ya funciona: un archivo con lo tuyo y nada de nadie más',
      'Hoy, sin cuentas, /sello explica que hace falta la versión con cuentas',
    ],
    captura: 'sello',
    notas: [
      'Todo esto está hecho y probado con un servidor de pruebas; falta encenderlo en la web publicada.',
      'El QR de cada fiesta lo crea el Admin (Fiestas y QR) cuando haya cuentas.',
      'Sin cuentas, el sello sólo llega con la compra de prueba de la demo.',
    ],
  });

  // ── Ranking ──
  d.queTiene({
    seccion: 'Ranking',
    titulo: 'El Ranking: cuatro tablas',
    puntos: [
      'En /ranking (menú de la web) y en el menú del mar: el mismo panel',
      'Carrera: los mejores tiempos de Los Rápidos',
      'Cañón: una tabla por jefe final (Fantasma y Kraken)',
      'Castillo: 9 tablas, por dificultad (Tranquila, Normal, Tormenta) y duración (5, 7 y 10 min)',
      'Puntos: los de siempre; cuentan los puntos, nunca las monedas',
      'Cada fila abre el Carnet de esa persona; «Descubrir a un BOIERO» abre uno al azar',
    ],
    captura: 'ranking-carrera',
    notas: [
      'Hoy cada uno compite contra sí mismo y tres miembros de muestra: lo dice arriba del panel.',
      'Con cuentas, el ranking es de todos, con tu fila marcada aunque no estés arriba.',
      'Falta una pestaña de temporada: está esperando a decidir qué es una temporada.',
    ],
  });
  d.telefonos({
    seccion: 'Ranking',
    titulo: 'Cañón, Castillo y Puntos',
    telefonos: [
      { captura: 'ranking-canon', pie: 'Cañón: elige el jefe final' },
      { captura: 'ranking-castillo', pie: 'Castillo: 9 tablas en el desplegable' },
      { captura: 'ranking-puntos', pie: 'Puntos: la tabla de siempre' },
    ],
    notas: [
      'El desplegable del Castillo se ve abierto para la foto; en el móvil es el selector normal.',
      'Quien no tiene partida en una tabla sale abajo con «sin partida», sin puesto.',
      'Los miembros de muestra llevan la etiqueta «muestra»; con cuentas, las tablas son de personas reales.',
    ],
  });

  // ── Qué falta ──
  d.queFalta({
    seccion: 'Carnet BOIA y Ranking',
    items: [
      {
        texto: 'Conectar las cuentas de usuario en la web publicada: sellos por QR, Carnet visible y ranking de todos',
        etiqueta: 'necesario',
        quien: 'Hernán',
      },
      {
        texto: 'Arte final del Carnet y del sello de cada fiesta (hoy la tarjeta naranja es de muestra)',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Puntos de cada cosa, nombres y cifras de los rangos y límites contra trampas',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Aprobar los textos del Carnet, del sello y del ranking, y la privacidad con cuentas',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Decidir qué se manda a quien acepta noticias, cada cuánto y quién lo lleva',
        etiqueta: 'puede-esperar',
        quien: 'Álvaro',
      },
      {
        texto: 'Decidir qué es una temporada para abrir su ranking',
        etiqueta: 'puede-esperar',
        quien: 'Hernán',
      },
    ],
    notas: [
      'Lo primero son las cuentas: sin ellas el Carnet no sale del móvil de cada uno.',
      'El arte del Carnet y los puntos los decide Álvaro; el código ya acepta cambiarlos.',
    ],
  });

  d.preguntas({
    seccion: 'Carnet BOIA y Ranking',
    preguntas: [
      '¿Halloween (31 oct) sale ya con cuentas y sello por QR, o con la versión de prueba?',
      '¿Cuántos puntos vale cada cosa y cómo se llaman los rangos (hoy Grumete… Capitana de la fiesta)?',
      '¿Quién diseña el Carnet definitivo y el sello de cada fiesta?',
      '¿Qué hacemos con los emails de quien acepta noticias, y quién lo lleva?',
    ],
    propuestas: [
      'Un cartel «Sella tu Carnet» con el QR en la puerta y en la barra de cada fiesta.',
      'Pedir el Carnet en el móvil para los 2 € de taquilla: ya lleva apodo y QR.',
      'Un premio para el primero de cada tabla al cerrar la temporada (p. ej. una entrada).',
    ],
    notas: [
      'Las propuestas salen del código y de los documentos: son ideas, no decisiones; Hernán las revisa.',
      'Lo que se decida entra en la hoja de ruta de la parte 8.',
    ],
  });
}
