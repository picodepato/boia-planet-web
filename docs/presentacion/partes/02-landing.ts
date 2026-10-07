import type { Deck } from '../../../tools/deck/src/deck.ts';

// Parte 2: la landing (~10 diapositivas). El hero es el ejemplo de T204;
// T205 escribe el resto de secciones.
export const titulo = 'Landing';

export default function (d: Deck) {
  d.portadaParte({
    subtitulo:
      'Lo primero que ve quien entra: el planeta, las entradas y todo BOIA en un solo scroll',
    secciones: [
      'Hero',
      'Próximo evento',
      'Filosofía',
      'Artistas',
      'Fotos',
      'Tienda',
      'Contacto',
      'Pie',
    ],
    notas: [
      'La landing es la puerta de entrada y la que vende entradas.',
      'Es una sola página que se baja con el dedo: del planeta al mar y a cada sección.',
    ],
  });

  // ── Hero ──
  d.queEs({
    seccion: 'Hero',
    titulo: 'El hero: el planeta BOIA',
    texto: [
      'Al entrar aparece el planeta BOIA en 3D, con el nombre en grande y dos botones: «Zarpar», que lleva al océano para jugar y buscar descuentos, y «Entradas», que abre la compra.',
      'Al bajar con el dedo, la cámara se acerca al mar y empieza el resto de la página.',
    ],
    destacado: 'Las dos formas de convertir, en la primera pantalla: comprar o zarpar.',
    captura: 'hero',
    notas: [
      'Es la primera impresión: tiene que cargar rápido también en móviles normales.',
      'Si el móvil no puede con el 3D, se ve una imagen fija con los mismos botones.',
    ],
  });
  d.telefonos({
    seccion: 'Hero',
    titulo: 'Comprar sin salir del hero',
    telefonos: [
      { captura: 'hero', pie: 'En reposo: «Zarpar» y «Entradas»' },
      { captura: 'hero-entradas', pie: '«Entradas» abre el panel de eventos' },
    ],
    notas: [
      'El panel enseña los eventos a la venta y lleva a la ticketera.',
      'Hoy los enlaces de compra son de muestra.',
    ],
  });
  d.queFalta({
    seccion: 'Hero',
    items: [
      {
        texto: 'Aprobar el arte del hero: el planeta, los objetos 3D y la imagen fija',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Elegir la ticketera y poner los enlaces de compra reales en «Entradas»',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto: 'Aprobar la frase de las esquinas: «Música sin un único género…»',
        etiqueta: 'necesario',
        quien: 'Álvaro',
      },
      {
        texto:
          'Probarlo en móviles de verdad: scroll, batería, ahorro de datos y lector de pantalla',
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
      'Lo naranja es lo que hace falta sí o sí para publicar.',
      'La tipografía puede esperar: la que va ahora es casi igual.',
    ],
  });
  d.preguntas({
    seccion: 'Hero',
    preguntas: [
      '¿Os gusta el planeta como primera imagen, o preferís empezar con el cartel del próximo evento?',
      '¿Qué ticketera usamos: Fourvenues u otra? ¿Hay ya cuenta?',
    ],
    propuestas: [
      'Poner bajo «Entradas» la fecha del próximo evento, para que se vea sin abrir el panel.',
      'Medir cuánta gente pulsa «Zarpar» y cuánta «Entradas» en las primeras semanas.',
    ],
    notas: [
      'Las propuestas salen del código y de los documentos: son ideas, no decisiones.',
      'Apuntamos lo que se decida y entra en la hoja de ruta.',
    ],
  });
}
