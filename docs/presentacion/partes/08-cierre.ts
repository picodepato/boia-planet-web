import type { Deck } from '../../../tools/deck/src/deck.ts';

// Provisional: la escribe T211 (plan 018). Fija el orden de las partes.
export const titulo = 'Hoja de ruta para salir';

export default function (d: Deck) {
  d.portadaParte({
    subtitulo: 'Todo lo necesario para publicar, quién lo hace y qué decidimos hoy',
    notas: ['Portada de la parte.', 'La completa la tarea T211.'],
  });
  d.texto({
    titulo: 'Pendiente',
    texto: 'Esta parte está por escribir: la escribe la tarea T211.',
    notas: ['Diapositiva provisional.', 'Se quita al escribir la parte.'],
  });
}
