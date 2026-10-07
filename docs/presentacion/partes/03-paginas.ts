import type { Deck } from '../../../tools/deck/src/deck.ts';

// Provisional: la escribe T206 (plan 018). Fija el orden de las partes.
export const titulo = 'Páginas';

export default function (d: Deck) {
  d.portadaParte({
    subtitulo: 'Eventos, artistas, fotos, tienda y legales: las páginas de la web',
    notas: ['Portada de la parte.', 'La completa la tarea T206.'],
  });
  d.texto({
    titulo: 'Pendiente',
    texto: 'Esta parte está por escribir: la escribe la tarea T206.',
    notas: ['Diapositiva provisional.', 'Se quita al escribir la parte.'],
  });
}
