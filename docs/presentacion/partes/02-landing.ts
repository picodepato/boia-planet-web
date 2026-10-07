import type { Deck } from '../../../tools/deck/src/deck.ts';

// Parte 2: la landing (plan 018 T205). Dos secciones, cada una con su «qué
// falta» y sus «Preguntas y propuestas»: el hero con Entradas, y las bandas
// que suben al bajar (próximo evento, eventos, fotos, artistas, filosofía,
// tienda, contacto, pie y cabecera).
export const titulo = 'Landing';

export default function (d: Deck) {
  d.portadaParte({
    subtitulo:
      'Lo primero que ve quien entra: el planeta, las entradas y todo BOIA en un solo scroll',
    secciones: ['Hero', 'Entradas', 'Próximo evento', 'Fotos', 'Artistas', 'Filosofía', 'Tienda', 'Pie'],
    notas: [
      'La landing es la puerta de entrada y la que vende entradas.',
      'Es una sola página que se baja con el dedo: del planeta al mar y a cada sección.',
      'Dos bloques: el hero con la compra, y las secciones que suben al bajar.',
    ],
  });

  // ── Hero y Entradas ──
  d.queEs({
    seccion: 'Hero y Entradas',
    titulo: 'El hero: el planeta BOIA',
    texto: [
      'Al entrar aparece el planeta BOIA en 3D, con el nombre en grande y dos botones: «Zarpar», que lleva al océano a jugar, y «Entradas», que abre la compra.',
      'Bajo «Zarpar», la línea «Consigue descuentos» recuerda que en el mar hay códigos escondidos.',
      'Al bajar con el dedo, la cámara se zambulle en el mar y empieza el resto de la página.',
    ],
    destacado: 'Las dos formas de convertir, en la primera pantalla: comprar o zarpar.',
    captura: 'hero',
    notas: [
      'Es la primera impresión: tiene que cargar rápido también en móviles normales.',
      '«Consigue descuentos» tiene un destello suave cada 8 segundos.',
      'En las esquinas: «BOIA · Alicante», las coordenadas y la frase de BOIA.',
    ],
  });
  d.telefonos({
    seccion: 'Hero y Entradas',
    titulo: 'Entradas y la versión quieta',
    telefonos: [
      { captura: 'hero-entradas', pie: '«Entradas»: los tres eventos a la venta' },
      { captura: 'taquilla', pie: 'Halloween y Sonido: sólo en taquilla' },
      { captura: 'hero-quieto', pie: 'Sin animaciones: una imagen fija' },
    ],
    notas: [
      'Halloween y Sonido se pagan en la puerta: con el Carnet BOIA, 2 € menos.',
      'Nochevieja abre una compra de prueba: hoy no se cobra nada.',
      'Con «reducir movimiento», sin 3D o con poca memoria sale una imagen fija de Blender con los mismos botones.',
    ],
  });
  d.queFalta({
    seccion: 'Hero y Entradas',
    items: [
      {
        texto: 'Aprobar el arte del hero: el planeta, los objetos 3D y la imagen fija',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Elegir la ticketera y poner el enlace de compra real de cada evento',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto:
          'Confirmar horas y precios de Halloween, Sonido y Nochevieja, y el descuento de 2 € en taquilla',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto:
          'Aprobar los textos: la frase de las esquinas, «Consigue descuentos» y el aviso de taquilla',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto:
          'Probarlo en móviles de verdad (iPhone y Android): scroll, batería, datos y lector de pantalla',
        etiqueta: 'necesario',
        quien: 'Hernán',
      },
      {
        texto:
          'Comprar la licencia de la tipografía Druk Wide (mientras, va una libre muy parecida)',
        etiqueta: 'puede-esperar',
        quien: 'Álvaro',
      },
    ],
    notas: [
      'Lo naranja hace falta sí o sí para publicar; lo violeta puede llegar después.',
      'Hoy las horas, los precios y los enlaces de compra son de muestra.',
      'La tipografía puede esperar: la que va ahora es casi igual.',
    ],
  });
  d.preguntas({
    seccion: 'Hero y Entradas',
    preguntas: [
      '¿Os gusta el planeta como primera imagen, o preferís empezar con el cartel del próximo evento?',
      '¿Qué ticketera usamos: Fourvenues u otra? ¿Hay ya cuenta?',
      '¿Se entiende el aviso de taquilla? ¿Queréis poder activarlo desde el Admin?',
    ],
    propuestas: [
      'Poner bajo «Entradas» la fecha del próximo evento, para que se vea sin abrir el panel.',
      'Medir cuánta gente pulsa «Zarpar» y cuánta «Entradas» en las primeras semanas.',
      'Vigilar el peso antes de añadir más: la página ya está en 195 de los 200 kB que nos pusimos de tope.',
    ],
    notas: [
      'Las propuestas salen del código y de los documentos: son ideas, no decisiones.',
      'Hoy la taquilla se marca en el contenido, no en el Admin.',
      'Apuntamos lo que se decida y entra en la hoja de ruta.',
    ],
  });

  // ── Las secciones de la landing ──
  d.telefonos({
    seccion: 'Próximo evento y Fotos',
    titulo: 'Próximo evento, eventos y fotos',
    telefonos: [
      { captura: 'proximo-evento', pie: 'Próximo evento: Halloween, 31 de octubre' },
      { captura: 'eventos', pie: 'Los demás eventos a la venta' },
      { captura: 'fotos', pie: 'Fotos: una selección de la última vez' },
    ],
    notas: [
      'El próximo evento sale en grande; sin cartel, dice «Cartel próximamente».',
      'Cada evento tiene su botón de compra y su página.',
      'Las fotos son huecos de muestra; «Ver todas» y «Ir en barco» llevan a todas.',
    ],
  });
  d.queTiene({
    seccion: 'Artistas',
    titulo: 'Artistas: las personas detrás del sonido',
    puntos: [
      'Los 26 artistas de BOIA, de tres en tres: la lista va rotando sola cada 5 segundos',
      'Cada uno con sus géneros y, si lo tiene, su enlace a Spotify',
      'Botón para pausar la rotación y «Ver todos los artistas», que abre su página',
      '«Escúchalo en Spotify»: la lista de BOIA, un enlace normal sin reproductor',
      'Hoy los enlaces son de prueba y llevan la etiqueta «MUESTRA»',
    ],
    captura: 'artistas',
    notas: [
      'Punto de Hernán: falta el enlace real de cada artista (Spotify u otro).',
      'Sin foto: en la banda sólo sale el nombre; las fotos van en la página de artistas.',
      'La web no carga nada de Spotify: sólo enlaza.',
    ],
  });
  d.queEs({
    seccion: 'Filosofía y contacto',
    titulo: 'Filosofía y contacto',
    texto: [
      'La Filosofía va dentro de «Contacto»: dos párrafos y tres verbos, «Dar espacio», «Descubrir» y «Pertenecer».',
      'El texto es una versión corta del documento de Álvaro, escrita por el equipo. Está de muestra hasta que él lo lea.',
      'Debajo, los datos de contacto: el correo y el WhatsApp de BOIA, hoy de prueba.',
    ],
    destacado: 'Álvaro lo aprueba tal cual o lo cambia: es la voz de BOIA en la web.',
    captura: 'filosofia',
    notas: [
      'Punto de Hernán: la filosofía la aprueba Álvaro, tal cual o con cambios.',
      'El menú «Filosofía» lleva directamente aquí.',
      'Hoy el Admin no edita este texto: el cambio lo pone Hernán en el contenido.',
    ],
  });
  d.telefonos({
    seccion: 'Tienda, pie y cabecera',
    titulo: 'Tienda, pie y cabecera',
    telefonos: [
      { captura: 'tienda', pie: 'Tienda: sólo se vende en la fiesta' },
      { captura: 'pie', pie: 'Pie: Carnet, WhatsApp, redes y legales' },
      { captura: 'menu', pie: 'Menú: Carnet, Ranking, Sonido…' },
    ],
    notas: [
      'Tienda: camisetas, tote bags y pegatinas; cada una pasa tres fotos de muestra. «Comprar» manda a escribir por Instagram.',
      'Pie: el logo, la lista de Spotify, invitación al Carnet y al WhatsApp, redes, legales, «Ver la introducción» y «Probar admin».',
      'Cabecera: «Entradas» siempre a mano; con cuentas, «Cerrar sesión» junto al Carnet.',
    ],
  });
  d.queFalta({
    seccion: 'Secciones de la landing',
    items: [
      {
        texto: 'El enlace real de cada artista (Spotify u otro) y la lista de BOIA en Spotify',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Aprobar el texto de la Filosofía tal cual, o cambiarlo',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Fotos de los productos reales de la tienda (sola, otro ángulo y puesta)',
        etiqueta: 'necesario',
        quien: 'Álvaro y socios',
      },
      {
        texto: 'Enlaces reales: correo de contacto, WhatsApp, Instagram y TikTok',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'El cartel de BOIA Halloween (y luego los de Sonido y Nochevieja)',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Fotos de los 26 artistas y fotos reales de las fiestas pasadas',
        etiqueta: 'puede-esperar',
        quien: 'Álvaro',
      },
    ],
    notas: [
      'Todo esto entra sin tocar código: un archivo con los enlaces y una carpeta con las imágenes.',
      'Cada enlace de prueba lleva hoy la etiqueta «MUESTRA», que desaparece al poner el real.',
      'Sin fotos de artistas la banda funciona: sólo sale el nombre.',
    ],
  });
  d.preguntas({
    seccion: 'Secciones de la landing',
    preguntas: [
      '¿Quién hace las fotos de los productos de la tienda, y para cuándo?',
      '¿Qué artistas no tienen Spotify? ¿Enlazamos a Instagram o SoundCloud en su lugar?',
      '¿Dejamos «Probar admin» en el pie al publicar, o se quita?',
      '¿El orden de las secciones os parece bien: evento, fotos, artistas, tienda, contacto?',
    ],
    propuestas: [
      'Dejar que cada artista tenga otro enlace además de Spotify (hoy sólo hay uno).',
      'Poner un precio orientativo en la tienda, aunque se pague en la fiesta.',
      'Subir cinco o seis fotos buenas de un All Day pasado: dan más ganas que los huecos.',
    ],
    notas: [
      'Son propuestas del equipo: Hernán las revisa antes de hacer nada.',
      'Lo que se decida entra en la hoja de ruta de la parte 8.',
    ],
  });
}
