import type { Deck } from '../../../tools/deck/src/deck.ts';

// Provisional: la escribe T207 (plan 018). Fija el orden de las partes.
export const titulo = 'Carnet BOIA y Ranking';

export default function (d: Deck) {
  d.portadaParte({
    subtitulo: 'El Carnet con sus sellos, el sello de la fiesta y la clasificación',
    notas: ['Portada de la parte.', 'La completa la tarea T207.'],
  });
  d.texto({
    titulo: 'Pendiente',
    texto: 'Esta parte está por escribir: la escribe la tarea T207.',
    notas: ['Diapositiva provisional.', 'Se quita al escribir la parte.'],
  });
}
