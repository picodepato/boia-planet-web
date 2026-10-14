/**
 * Carnet BOIA: las preguntas públicas y los límites de lo que escribe un
 * miembro (D-08, REQ-IDE-014). Las 5 de v14 §44.1 fueron sustituidas por la
 * decisión de Álvaro del 2026-10-14 (texto exacto, este orden). La quinta
 * (`buena-fiesta`) no cambia. Las cuatro anteriores (`cosa-mas-rara`,
 * `descubrimiento`, `obra`, `mejor-recuerdo`) quedan retiradas: sus
 * respuestas siguen guardadas, pero ya no se enseñan en ningún sitio.
 *
 * Cada miembro ve 5 (plan 030 T294, Álvaro 2026-10-14): los ARTISTAS (Carnet
 * creado con el enlace de artistas, `carnets.is_artist`) tienen esas 5 tal
 * cual; el resto del público cambia la primera por `dia-siguiente`. Las
 * preguntas 2–5 son de todos (`audience: 'all'`).
 * Estas son las filas activas de `carnet_questions` (migraciones
 * `20261014100100_carnet_questions_v2.sql` y
 * `20261015100100_carnet_questions_audience.sql`; una prueba lo exige).
 */

/** A quién se le hace una pregunta: a todos, sólo a artistas o sólo al público. */
export type CarnetQuestionAudience = 'all' | 'artist' | 'public';
export const CARNET_QUESTION_AUDIENCES: readonly CarnetQuestionAudience[] = [
  'all',
  'artist',
  'public',
];

export interface CarnetQuestion {
  id: string;
  /** Versión de la pregunta; editarla desde el Admin es L2 (REQ-IDE-016). */
  version: number;
  /** Orden dentro de lo que ve cada miembro (artista y público comparten la 1). */
  position: number;
  prompt: string;
  audience: CarnetQuestionAudience;
}

/** Cuántas preguntas ve cada miembro (artista o público). */
export const CARNET_QUESTIONS_PER_MEMBER = 5;

/**
 * Todas las preguntas activas, de los dos públicos, por posición (y, en la
 * misma posición, la de artistas antes que la del público). Para enseñar
 * las de un miembro, `carnetQuestionsFor`.
 */
export const CARNET_QUESTIONS: readonly CarnetQuestion[] = [
  {
    id: 'momento-quiero-estar',
    version: 1,
    position: 1,
    prompt: '¿Qué momento te hizo pensar «yo quiero estar en esto»?',
    audience: 'artist',
  },
  {
    id: 'dia-siguiente',
    version: 1,
    position: 1,
    prompt: 'Completa la frase: al día siguiente de una fiesta yo…',
    audience: 'public',
  },
  {
    id: 'cancion-en-repeat',
    version: 1,
    position: 2,
    prompt: '¿Cuál es la canción que tienes en repeat ahora mismo?',
    audience: 'all',
  },
  {
    id: 'creando-tramando',
    version: 1,
    position: 3,
    prompt: '¿Qué estás creando o tramando estos días?',
    audience: 'all',
  },
  {
    id: 'disco-entero',
    version: 1,
    position: 4,
    prompt: '¿Qué disco escucharías de principio a fin sin saltarte ninguna?',
    audience: 'all',
  },
  {
    id: 'buena-fiesta',
    version: 1,
    position: 5,
    prompt: 'Completa la frase: una buena fiesta necesita siempre…',
    audience: 'all',
  },
];

/**
 * Preguntas retiradas el 2026-10-14 (las de v14 §44.1 que cambiaron): sus
 * respuestas se conservan y no se enseñan en el Carnet; la moderación del
 * Admin las sigue viendo, marcadas como retiradas. Ya no se pueden contestar.
 */
export const RETIRED_CARNET_QUESTIONS: readonly CarnetQuestion[] = [
  {
    id: 'cosa-mas-rara',
    version: 1,
    position: 11,
    prompt: '¿Cuál ha sido la cosa más rara que has visto pasar en una fiesta o festival?',
    audience: 'all',
  },
  {
    id: 'descubrimiento',
    version: 1,
    position: 12,
    prompt: '¿Cuál es el mejor descubrimiento musical que hiciste por casualidad?',
    audience: 'all',
  },
  {
    id: 'obra',
    version: 1,
    position: 13,
    prompt: '¿Qué obra, fotografía, película, disco o pieza artística te cambió un poco la cabeza?',
    audience: 'all',
  },
  {
    id: 'mejor-recuerdo',
    version: 1,
    position: 14,
    prompt: '¿Cuál es tu mejor recuerdo relacionado con la música?',
    audience: 'all',
  },
];

export const RETIRED_CARNET_QUESTION_IDS: readonly string[] = RETIRED_CARNET_QUESTIONS.map(
  (q) => q.id,
);

/** El público de un miembro: `artist` si su Carnet es de artista; si no, `public`. */
export function carnetAudienceOf(isArtist: boolean | null | undefined): 'artist' | 'public' {
  return isArtist ? 'artist' : 'public';
}

/** ¿Se le hace esta pregunta a un miembro de ese público? */
export function isQuestionFor(
  q: Pick<CarnetQuestion, 'audience'>,
  isArtist: boolean | null | undefined,
): boolean {
  return q.audience === 'all' || q.audience === carnetAudienceOf(isArtist);
}

/**
 * Las 5 preguntas de un miembro, en su orden: un artista, las de
 * `artist` y `all`; el resto, las de `public` y `all`.
 */
export function carnetQuestionsFor(
  isArtist: boolean | null | undefined,
  questions: readonly CarnetQuestion[] = CARNET_QUESTIONS,
): readonly CarnetQuestion[] {
  return questions.filter((q) => isQuestionFor(q, isArtist));
}

/**
 * Si la respuesta a `questionId` se enseña en el Carnet de un miembro:
 * `shown`; `retired`, si la pregunta se retiró; `other_audience`, si es
 * activa pero de otro público (p. ej. la 1 de artistas en un Carnet que no
 * es de artista). Las dos últimas sólo las ve la moderación del Admin.
 */
export function carnetAnswerVisibility(
  questionId: string,
  isArtist: boolean | null | undefined,
): 'shown' | 'retired' | 'other_audience' {
  if (carnetQuestionsFor(isArtist).some((q) => q.id === questionId)) return 'shown';
  if (CARNET_QUESTIONS.some((q) => q.id === questionId)) return 'other_audience';
  return 'retired';
}

/** Apodo: 2 a 30 caracteres, sin espacios al principio ni al final (tabla `carnets`). */
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 30;
/** Respuesta del Carnet: 1 a 500 caracteres (tabla `carnet_answers`). */
export const CARNET_ANSWER_MAX = 500;
/** Botella: 1 a 140 caracteres (REQ-IDE-040, tabla `bottles`). */
export const BOTTLE_MESSAGE_MAX = 140;
/**
 * Botellas activas a la vez en el mar, las de muestra incluidas (decisión
 * 2026-10-02): una nueva quita la más antigua. Una por persona.
 */
export const BOTTLES_IN_SEA_MAX = 10;
/** Motivo de un reporte de botella (tabla `bottle_reports`). */
export const BOTTLE_REPORT_REASON_MAX = 280;

/**
 * Longitud como la cuenta Postgres (`char_length`): puntos de código, no
 * unidades UTF-16. Un emoji cuenta 1, no 2.
 */
export function charLength(s: string): number {
  return [...s].length;
}
