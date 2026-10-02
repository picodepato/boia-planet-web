/**
 * Carnet BOIA: las 5 preguntas públicas y los límites de lo que escribe un
 * miembro. Las preguntas son las de v14 §44.1, textuales (D-08, REQ-IDE-014):
 * no son muestra. Son las mismas filas que siembra
 * `supabase/migrations/20260928100100_identity.sql` (una prueba lo exige).
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
    id: 'cosa-mas-rara',
    version: 1,
    position: 1,
    prompt: '¿Cuál ha sido la cosa más rara que has visto pasar en una fiesta o festival?',
  },
  {
    id: 'descubrimiento',
    version: 1,
    position: 2,
    prompt: '¿Cuál es el mejor descubrimiento musical que hiciste por casualidad?',
  },
  {
    id: 'obra',
    version: 1,
    position: 3,
    prompt: '¿Qué obra, fotografía, película, disco o pieza artística te cambió un poco la cabeza?',
  },
  {
    id: 'mejor-recuerdo',
    version: 1,
    position: 4,
    prompt: '¿Cuál es tu mejor recuerdo relacionado con la música?',
  },
  {
    id: 'buena-fiesta',
    version: 1,
    position: 5,
    prompt: 'Completa la frase: una buena fiesta necesita siempre…',
  },
];

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
