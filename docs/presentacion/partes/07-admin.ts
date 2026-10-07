import type { Deck } from '../../../tools/deck/src/deck.ts';

// Provisional: la escribe T210 (plan 018). Fija el orden de las partes.
export const titulo = 'Admin';

export default function (d: Deck) {
  d.portadaParte({
    subtitulo: 'El panel para cambiar la web sin tocar código',
    notas: ['Portada de la parte.', 'La completa la tarea T210.'],
  });
  d.texto({
    titulo: 'Pendiente',
    texto: 'Esta parte está por escribir: la escribe la tarea T210.',
    notas: ['Diapositiva provisional.', 'Se quita al escribir la parte.'],
  });
}
