/**
 * Miembros ficticios de MUESTRA con su Carnet y su botella, para que leer
 * botellas y abrir «VER SU CARNET» funcione en la demo, donde las botellas
 * viven en el navegador de cada cual (D-20). Apodos, respuestas y mensajes
 * son inventados [pendiente Álvaro].
 *
 * Posiciones de las botellas: coordenadas de mundo del mapa compartido,
 * calculadas desde mundos/arcilla/mapa.json (u_maq × 24,87 u de motor) en
 * agua abierta entre lugares. Si el mapa del motor usa otro origen o escala,
 * quien crea el repositorio pasa las suyas (`sample.bottles` en las opciones).
 */

export interface SampleCrewMember {
  userId: string;
  nickname: string;
  avatarKey: string | null;
  memberSince: string;
  /** Respuestas por id de pregunta (CARNET_QUESTIONS). */
  answers: Record<string, string>;
  /** Escaparate estático del Carnet: no pasa por el libro de nadie. */
  showcase: {
    points: number;
    achievementIds: string[];
    stampEventIds: string[];
    cosmeticIds: string[];
    /**
     * Puntos de cada temporada (en la demo, cada mundo) para el ranking local
     * de temporada (REQ-IDE-053). Sin entrada, 0 en esa temporada.
     */
    seasonPoints?: Record<string, number>;
  };
}

export interface SampleBottle {
  id: string;
  userId: string;
  message: string;
  x: number;
  y: number;
  createdAt: string;
}

const U = 24.87;

export const SAMPLE_CREW: SampleCrewMember[] = [
  {
    userId: 'muestra-pulpo-sonico',
    nickname: 'Pulpo Sónico',
    avatarKey: 'avatar-neutro-1',
    memberSince: '2025-06-21T12:00:00+02:00',
    answers: {
      'cosa-mas-rara':
        'Un señor bailando con una sombrilla abierta toda la noche. Muestra, pero podría ser.',
      descubrimiento: 'Un directo de cumbia a las cinco de la tarde que no pensaba ver.',
      'buena-fiesta': 'Una persona que te presente a otra.',
    },
    showcase: {
      points: 240,
      seasonPoints: { arcilla: 90, acuarela: 40 },
      achievementIds: ['primera-boia', 'islas-3', 'entrada'],
      stampEventIds: ['ev-finalizado'],
      cosmeticIds: ['bandera-boia'],
    },
  },
  {
    userId: 'muestra-grumete-turron',
    nickname: 'Grumete Turrón',
    avatarKey: 'avatar-neutro-2',
    memberSince: '2026-06-20T18:30:00+02:00',
    answers: {
      obra: 'Un disco de ambient que escuché en un tren de noche.',
      'mejor-recuerdo': 'Amanecer en la playa después del primer All Day.',
    },
    showcase: {
      points: 70,
      seasonPoints: { arcilla: 70 },
      achievementIds: ['primera-boia'],
      stampEventIds: [],
      cosmeticIds: [],
    },
  },
  {
    userId: 'muestra-la-del-castillo',
    nickname: 'La del Castillo',
    avatarKey: null,
    memberSince: '2025-09-12T21:00:00+02:00',
    answers: {
      'cosa-mas-rara': 'Una paella para doscientas personas a las tres de la mañana.',
      descubrimiento: 'Hard groove, por equivocarme de escenario.',
      obra: 'Las fotos de la Explanada de los años setenta.',
      'mejor-recuerdo': 'Cantar con desconocidos en la Cala.',
      'buena-fiesta': 'Agua, sombra y alguien que se atreva a bailar primero.',
    },
    showcase: {
      points: 610,
      seasonPoints: { arcilla: 150, acuarela: 220 },
      achievementIds: ['primera-boia', 'carnet', 'islas-3', 'entrada', 'fiestera-entregada'],
      stampEventIds: ['ev-finalizado'],
      cosmeticIds: ['bandera-fiestera', 'estela-naranja'],
    },
  },
];

export const SAMPLE_BOTTLES: SampleBottle[] = [
  {
    id: 'botella-muestra-1',
    userId: 'muestra-pulpo-sonico',
    message: 'Si lees esto: la Boia Fiestera odia las prisas. Rodea a los cocodrilos despacio.',
    x: 0 * U,
    y: 22 * U,
    createdAt: '2026-09-01T12:00:00+02:00',
  },
  {
    id: 'botella-muestra-2',
    userId: 'muestra-grumete-turron',
    message: 'Mi primera botella. Nos vemos en el All Day, saluda si ves un barco de arcilla.',
    x: -8 * U,
    y: 2 * U,
    createdAt: '2026-09-10T19:00:00+02:00',
  },
  {
    id: 'botella-muestra-3',
    userId: 'muestra-la-del-castillo',
    message: 'Detrás de la Isla de Benidorm hay algo brillando. No digo más.',
    x: 2 * U,
    y: -8 * U,
    createdAt: '2026-09-20T23:00:00+02:00',
  },
];
