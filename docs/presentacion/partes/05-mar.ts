import type { Deck } from '../../../tools/deck/src/deck.ts';

// Provisional: la escribe T208 (plan 018). Fija el orden de las partes.
export const titulo = 'El océano';

export default function (d: Deck) {
  d.portadaParte({
    subtitulo: 'El mundo en 3D que se recorre en barco: islas, personajes, secretos y descuentos',
    notas: ['Portada de la parte.', 'La completa la tarea T208.'],
  });
  d.texto({
    titulo: 'Pendiente',
    texto: 'Esta parte está por escribir: la escribe la tarea T208.',
    notas: ['Diapositiva provisional.', 'Se quita al escribir la parte.'],
  });
}
