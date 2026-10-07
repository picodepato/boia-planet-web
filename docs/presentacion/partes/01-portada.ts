import type { Deck } from '../../../tools/deck/src/deck.ts';

// Parte 1: portada, resumen y estado (plan 018 T211). Qué es BOIA.PLANET, cómo
// se lee la presentación, el mapa de las partes y dónde está hoy la versión
// de prueba, con su QR.
export const titulo = 'Portada y resumen';

/** La versión de prueba publicada (temporal hasta el dominio definitivo). */
const PRUEBA = 'https://boia-planet-roan.vercel.app';

export default function (d: Deck) {
  d.portada({
    antetitulo: 'Presentación para los socios de BOIA',
    titulo: 'BOIA.PLANET',
    subtitulo: 'Qué hay y qué falta para salir',
    fecha: 'Octubre de 2026',
    notas: [
      'Repasamos la web entera, sección a sección, tal y como está hoy.',
      'En cada sección: qué es, qué tiene, qué falta para salir y vuestras preguntas.',
      'El objetivo: saber qué nos separa de publicarla cuanto antes.',
    ],
  });

  d.queEs({
    seccion: 'Qué es',
    titulo: 'BOIA.PLANET: la web-universo de BOIA',
    texto: [
      'Es la web de BOIA, el colectivo de eventos musicales de Alicante. Tiene dos caminos para que la gente acabe en nuestras fiestas.',
      'Uno, directo: «Entradas» abre los eventos a la venta desde la primera pantalla.',
      'Otro, jugando: «Zarpar» lleva a un planeta de agua en 3D que se recorre en barco, con una isla por evento, minijuegos, descuentos escondidos y el Carnet BOIA con sus sellos.',
    ],
    destacado: 'Dos formas de convertir: comprar la entrada ya, o zarpar, jugar y volver con un descuento.',
    captura: '02-landing/hero',
    notas: [
      'Casi todo el público entra desde el móvil: por eso todas las capturas son de móvil.',
      'El mundo 3D no sustituye a la compra: la refuerza y hace que la gente vuelva.',
      'Detrás hay un Admin para cambiar eventos, textos y el mar sin tocar código.',
    ],
  });

  d.hojaDeRuta({
    seccion: 'Mapa',
    titulo: 'Lo que vamos a ver',
    columnas: ['Parte', 'Qué veremos'],
    anchos: [1, 3.2],
    filas: [
      ['1 · Portada y resumen', 'Qué es la web, cómo se lee esta presentación y dónde está hoy'],
      ['2 · Landing', 'La primera pantalla: el planeta, las entradas y todo BOIA en un solo scroll'],
      ['3 · Páginas', 'Eventos, artistas, fotos, tienda y legales, cada una con su enlace'],
      ['4 · Carnet BOIA y Ranking', 'El carné de cada BOIERO con sus sellos de fiesta y las clasificaciones'],
      ['5 · El océano', 'El mundo 3D en barco: islas, personajes, secretos y descuentos'],
      ['6 · Minijuegos', 'Los Rápidos, el Cañón y el Castillo'],
      ['7 · Admin', 'El panel del equipo para cambiar la web y el mar'],
      ['8 · Hoja de ruta', 'Todo lo necesario para salir, quién lo hace y qué decidimos hoy'],
    ],
    notas: [
      'Ocho partes; las del medio recorren la web pantalla a pantalla.',
      'Al final de cada sección paramos para preguntas y propuestas.',
      'La parte 8 junta en una lista todo lo que falta para publicar.',
    ],
  });

  d.texto({
    seccion: 'Cómo se lee',
    titulo: 'Cómo se lee cada parte',
    texto: 'Cada sección sigue los mismos cuatro pasos, para que sea fácil comparar:',
    puntos: [
      'Qué es: para qué sirve la sección, en una frase.',
      'Qué tiene: lo que ya funciona, con capturas del móvil.',
      'Qué falta: cada cosa marcada «Necesario para salir» o «Puede esperar», y quién la hace.',
      'Preguntas y propuestas: dudas para Álvaro y los socios, y mejoras que propone el equipo.',
    ],
    notas: [
      '«Necesario para salir» (naranja): sin eso no publicamos.',
      '«Puede esperar» (violeta): se puede hacer después de salir.',
      'Las propuestas son ideas del equipo: se aceptan, se cambian o se descartan.',
    ],
  });

  d.texto({
    seccion: 'Estado',
    titulo: 'Dónde está hoy: la versión de prueba',
    texto:
      'La web entera ya está publicada en una dirección de prueba, hasta tener el dominio definitivo. Podéis abrirla ahora con este QR.',
    puntos: [
      'Todo vive en el navegador de quien la visita: sin cuentas de usuario ni datos compartidos.',
      'El contenido es de muestra: fechas, textos, fotos y enlaces inventados o sin aprobar.',
      'No se cobra nada: la compra de entradas es de prueba.',
      'Para salir hace falta el contenido real, encender las cuentas y el visto bueno de Álvaro.',
    ],
    qr: PRUEBA,
    notas: [
      'Abridla en el móvil mientras hablamos: es la misma web que enseñan las capturas.',
      'Lo que guardéis (puntos, Carnet, partidas) se queda en vuestro móvil, nadie más lo ve.',
      'Las cuentas de usuario ya están hechas y probadas aparte; falta encenderlas en la web publicada.',
    ],
  });
}
