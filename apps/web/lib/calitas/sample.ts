/**
 * Los comentarios de muestra de Las Calitas (plan 019 T222): lo que se lee
 * en modo local (D-20), junto con los tuyos. Apodos, textos y votos son
 * `muestra`, a falta de los de verdad.
 */
export interface SampleComment {
  id: string;
  parentId: string | null;
  author: string;
  body: string;
  /** Votos que ya tiene (a favor menos en contra). */
  score: number;
  createdAt: string;
}

export const SAMPLE_COMMENTS: readonly SampleComment[] = [
  {
    id: 'muestra-calitas-1',
    parentId: null,
    author: 'Marina del Postiguet',
    body: '¿Quién se viene al próximo ALL DAY BOIA? Yo ya tengo mi Carnet listo.',
    score: 12,
    createdAt: '2026-10-07T18:20:00.000Z',
  },
  {
    id: 'muestra-calitas-2',
    parentId: 'muestra-calitas-1',
    author: 'Kike Boia',
    body: '¡Yo! Nos vemos junto a la cabina.',
    score: 4,
    createdAt: '2026-10-07T18:45:00.000Z',
  },
  {
    id: 'muestra-calitas-3',
    parentId: null,
    author: 'Lucía Tabarca',
    body: 'He encontrado la Boia Fiestera a la primera. Pista: mirad cerca de los cocodrilos.',
    score: 8,
    createdAt: '2026-10-06T21:05:00.000Z',
  },
  {
    id: 'muestra-calitas-4',
    parentId: 'muestra-calitas-3',
    author: 'Pau del Raval',
    body: 'Gracias, ¡a mí me costó media hora!',
    score: 2,
    createdAt: '2026-10-06T22:10:00.000Z',
  },
  {
    id: 'muestra-calitas-5',
    parentId: null,
    author: 'Nora Explanada',
    body: 'El atardecer desde el Puig Campana en el mar es una pasada. Id a verlo.',
    score: 5,
    createdAt: '2026-10-05T19:30:00.000Z',
  },
  {
    id: 'muestra-calitas-6',
    parentId: null,
    author: 'Dani Benidorm',
    body: 'Propuesta: una fiesta en la playa para cerrar el verano el año que viene.',
    score: 3,
    createdAt: '2026-10-04T12:00:00.000Z',
  },
];
