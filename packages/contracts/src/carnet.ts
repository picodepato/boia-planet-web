/**
 * Carnet BOIA: las 5 preguntas públicas y los límites de lo que escribe un
 * miembro (D-08, REQ-IDE-014). Las 5 de v14 §44.1 fueron sustituidas por la
 * decisión de Álvaro del 2026-10-14 (texto exacto, este orden). La quinta
 * (`buena-fiesta`) no cambia. Las cuatro anteriores (`cosa-mas-rara`,
 * `descubrimiento`, `obra`, `mejor-recuerdo`) quedan retiradas: sus
 * respuestas siguen guardadas, pero ya no se enseñan en ningún sitio.
 * Estas son las filas activas de `carnet_questions` (migración
 * `20261014100100_carnet_questions_v2.sql`; una prueba lo exige).
 */
export interface CarnetQuestion {
  id: string;
  /** Versión de la pregunta; editarla desde el Admin es L2 (REQ-IDE-016). */
  version: number;
  position: number;
  prompt: string;
}

export const CARNET_QUESTIONS: readonly CarnetQuestion[] = [
  {
    id: 'momento-quiero-estar',
    version: 1,
    position: 1,
    prompt: '¿Qué momento te hizo pensar «yo quiero estar en esto»?',
  },
  {
    id: 'cancion-en-repeat',
    version: 1,
    position: 2,
    prompt: '¿Cuál es la canción que tienes en repeat ahora mismo?',
  },
  {
    id: 'creando-tramando',
    version: 1,
    position: 3,
    prompt: '¿Qué estás creando o tramando estos días?',
  },
  {
    id: 'disco-entero',
    version: 1,
    position: 4,
    prompt: '¿Qué disco escucharías de principio a fin sin saltarte ninguna?',
  },
  {
    id: 'buena-fiesta',
    version: 1,
    position: 5,
    prompt: 'Completa la frase: una buena fiesta necesita siempre…',
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
  },
  {
    id: 'descubrimiento',
    version: 1,
    position: 12,
    prompt: '¿Cuál es el mejor descubrimiento musical que hiciste por casualidad?',
  },
  {
    id: 'obra',
    version: 1,
    position: 13,
    prompt: '¿Qué obra, fotografía, película, disco o pieza artística te cambió un poco la cabeza?',
  },
  {
    id: 'mejor-recuerdo',
    version: 1,
    position: 14,
    prompt: '¿Cuál es tu mejor recuerdo relacionado con la música?',
  },
];

export const RETIRED_CARNET_QUESTION_IDS: readonly string[] = RETIRED_CARNET_QUESTIONS.map(
  (q) => q.id,
);

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
