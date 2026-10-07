import type { Deck } from '../../../tools/deck/src/deck.ts';

// Provisional: la escribe T209 (plan 018). Fija el orden de las partes.
export const titulo = 'Minijuegos';

export default function (d: Deck) {
  d.portadaParte({
    subtitulo: 'Los Rápidos, el Cañón y la Defensa del Castillo',
    notas: ['Portada de la parte.', 'La completa la tarea T209.'],
  });
  d.texto({
    titulo: 'Pendiente',
    texto: 'Esta parte está por escribir: la escribe la tarea T209.',
    notas: ['Diapositiva provisional.', 'Se quita al escribir la parte.'],
  });
}
