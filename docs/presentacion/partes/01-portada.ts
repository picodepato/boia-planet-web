import type { Deck } from '../../../tools/deck/src/deck.ts';

// Parte 1: portada, resumen y estado (~4 diapositivas). T211 escribe el resto.
export const titulo = 'Portada y resumen';

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
  d.texto({
    titulo: 'Pendiente: resumen y estado',
    texto:
      'Aquí irán qué es BOIA.PLANET, el mapa de la presentación y dónde está hoy la versión de prueba.',
    notas: [
      'Diapositiva provisional: la escribe la tarea T211.',
      'Se quita al escribir la parte 1.',
    ],
  });
}
