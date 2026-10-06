import { ACHIEVEMENT_TRIGGERS, type AchievementTrigger, CARNET_QUESTIONS } from '@boia/contracts';
import type { JsonValue } from '@boia/store';
import { t } from '../i18n';

/**
 * Condiciones de logro que el Admin puede elegir (REQ-ADM-021): el catálogo
 * cerrado de disparadores de `@boia/contracts` y, para cada uno, sus
 * parámetros con su tipo y su rango seguro, los mismos que lee el juego
 * (`lib/mundo/achievements.ts`). Sin constructor de lógica libre: sólo se
 * elige un disparador y se rellenan sus casillas.
 */

export const TRIGGER_LABELS: Record<AchievementTrigger, string> = {
  visit_island: t('admin.achievements.visitarIslas'),
  find_buoy: t('admin.achievements.encontrarBoies'),
  collect_objects: t('admin.achievements.recogerObjetos'),
  complete_circuit: t('admin.achievements.completarElCircuito'),
  time_played: t('admin.achievements.tiempoJugado'),
  buy_ticket: t('event.buy'),
  rescue_character: t('admin.achievements.rescatarAUnPersonaje'),
  deliver_character: t('admin.achievements.entregarAUnPersonaje'),
  win_minigame: t('admin.achievements.ganarUnMinijuego'),
  complete_encounter: t('admin.achievements.terminarUnEncuentro'),
  read_bottle: t('admin.achievements.leerBotellas'),
  throw_bottle: t('admin.achievements.echarUnaBotella'),
  create_carnet: t('admin.achievements.hacerseElCarnet'),
  answer_question: t('admin.achievements.contestarPreguntasDelCarnet'),
  visit_world: t('admin.achievements.navegarEnMundos'),
  play_minigame: t('admin.achievements.jugarUnMinijuego'),
  defeat_boss: t('admin.achievements.vencerAUnBoss'),
};

/** De dónde salen las opciones de un parámetro de elección. */
export type ChoiceSource = 'circuits' | 'games' | 'worlds';

export type TriggerParam =
  | { key: string; label: string; kind: 'int'; min: number; max: number; optional?: boolean }
  | { key: string; label: string; kind: 'text'; optional?: boolean }
  | { key: string; label: string; kind: 'choice'; source: ChoiceSource; optional?: boolean };

const count = (max: number, label = t('admin.achievements.cuantasVeces')): TriggerParam => ({
  key: 'count',
  label,
  kind: 'int',
  min: 1,
  max,
});

/** Parámetros de cada disparador, con su rango (REQ-ADM-013). */
export const TRIGGER_PARAMS: Record<AchievementTrigger, readonly TriggerParam[]> = {
  visit_island: [count(50, t('admin.achievements.islasDistintas'))],
  find_buoy: [count(50, t('admin.achievements.boiesDistintas'))],
  collect_objects: [
    {
      key: 'category',
      label: t('admin.achievements.categoriaVacioCualquiera'),
      kind: 'text',
      optional: true,
    },
    count(500, t('admin.achievements.objetos')),
  ],
  complete_circuit: [
    {
      key: 'circuit',
      label: t('admin.achievements.circuitoVacioCualquiera'),
      kind: 'choice',
      source: 'circuits',
      optional: true,
    },
    {
      key: 'maxMs',
      label: t('admin.achievements.tiempoMaximoMsOpcional'),
      kind: 'int',
      min: 1000,
      max: 3_600_000,
      optional: true,
    },
    { key: 'via', label: t('admin.achievements.pasandoPorElArco'), kind: 'text', optional: true },
  ],
  time_played: [
    { key: 'minutes', label: t('admin.achievements.minutos'), kind: 'int', min: 1, max: 1440 },
  ],
  buy_ticket: [count(50, t('admin.achievements.entradasDeEventosDistintos'))],
  rescue_character: [
    {
      key: 'character',
      label: t('admin.achievements.personajeVacioCualquiera'),
      kind: 'text',
      optional: true,
    },
    { ...count(20), optional: true },
  ],
  deliver_character: [
    {
      key: 'character',
      label: t('admin.achievements.personajeVacioCualquiera'),
      kind: 'text',
      optional: true,
    },
    { ...count(20), optional: true },
  ],
  win_minigame: [
    {
      key: 'game',
      label: t('admin.achievements.minijuegoVacioCualquiera'),
      kind: 'choice',
      source: 'games',
      optional: true,
    },
    { ...count(20, t('admin.achievements.minijuegosDistintos')), optional: true },
    // El castillo (plan 015 T176): ganar en esa dificultad y, si se pide, con esa duración.
    {
      key: 'difficulty',
      label: t('admin.achievements.dificultadVacioCualquiera'),
      kind: 'text',
      optional: true,
    },
    {
      key: 'runMin',
      label: t('admin.achievements.duracionMinOpcional'),
      kind: 'int',
      min: 1,
      max: 60,
      optional: true,
    },
    // Guardacostas (T153): ganar el juego de arriba y jugar una partida de este.
    {
      key: 'played',
      label: t('admin.achievements.yJugarAOtro'),
      kind: 'choice',
      source: 'games',
      optional: true,
    },
  ],
  play_minigame: [
    {
      key: 'game',
      label: t('admin.achievements.minijuegoVacioCualquiera'),
      kind: 'choice',
      source: 'games',
      optional: true,
    },
    { ...count(20, t('admin.achievements.minijuegosDistintos')), optional: true },
  ],
  defeat_boss: [
    {
      key: 'boss',
      label: t('admin.achievements.bossVacioCualquiera'),
      kind: 'text',
      optional: true,
    },
    {
      key: 'difficulty',
      label: t('admin.achievements.dificultadVacioCualquiera'),
      kind: 'text',
      optional: true,
    },
    { ...count(20, t('admin.achievements.bossesDistintos')), optional: true },
  ],
  complete_encounter: [
    {
      key: 'encounter',
      label: t('admin.achievements.encuentroVacioCualquiera'),
      kind: 'text',
      optional: true,
    },
    { ...count(20), optional: true },
  ],
  read_bottle: [count(100, t('admin.achievements.botellas'))],
  throw_bottle: [count(100, t('admin.achievements.botellas'))],
  create_carnet: [],
  answer_question: [count(CARNET_QUESTIONS.length, t('admin.achievements.preguntas'))],
  visit_world: [
    {
      key: 'world',
      label: t('admin.achievements.mundoVacioCualquiera'),
      kind: 'choice',
      source: 'worlds',
      optional: true,
    },
    { ...count(20, t('admin.achievements.mundosDistintos')), optional: true },
  ],
};

/**
 * Minijuegos registrados (T23). El minijuego del faro se quitó en el plan
 * 014 (T157); el Castillo entra con sus logros (plan 015 T176).
 */
export const MINIGAMES = ['canon', 'castillo'] as const;

export interface TriggerChoices {
  circuits: readonly string[];
  games: readonly string[];
  worlds: readonly string[];
}

const TEXT_PARAM = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Motivo por el que unos parámetros no valen para ese disparador, o null:
 * claves desconocidas, enteros fuera de rango, textos que no son claves y
 * opciones que no existen (un circuito o un mundo borrados).
 */
export function triggerParamsProblem(
  trigger: string,
  params: Record<string, JsonValue>,
  choices: TriggerChoices,
): string | null {
  if (!(ACHIEVEMENT_TRIGGERS as readonly string[]).includes(trigger)) {
    return t('admin.achievements.condicionDesconocida', { trigger });
  }
  const spec = TRIGGER_PARAMS[trigger as AchievementTrigger];
  for (const key of Object.keys(params)) {
    if (!spec.some((p) => p.key === key)) return t('admin.achievements.noEsUnParametro', { key });
  }
  for (const p of spec) {
    const v = params[p.key];
    if (v === undefined || v === null || v === '') {
      if (!p.optional) return t('admin.achievements.falta', { label: p.label });
      continue;
    }
    if (p.kind === 'int') {
      if (typeof v !== 'number' || !Number.isInteger(v))
        return t('admin.achievements.esUnNumeroEntero', { label: p.label });
      if (v < p.min || v > p.max) {
        return t('admin.achievements.fueraDeRangoEntre', {
          label: p.label,
          v,
          min: p.min,
          max: p.max,
        });
      }
    } else if (p.kind === 'text') {
      if (typeof v !== 'string' || !TEXT_PARAM.test(v)) {
        return t('admin.achievements.minusculasCifrasYGuiones', { label: p.label });
      }
    } else if (typeof v !== 'string' || !choices[p.source].includes(v)) {
      return t('admin.achievements.noExiste', { label: p.label, String: String(v) });
    }
  }
  return null;
}

/** Parámetros del formulario (todo texto) → parámetros guardados, sin los vacíos. */
export function paramsFromForm(
  trigger: AchievementTrigger,
  form: Readonly<Record<string, string>>,
): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  for (const p of TRIGGER_PARAMS[trigger]) {
    const raw = (form[p.key] ?? '').trim();
    if (!raw) continue;
    out[p.key] = p.kind === 'int' && /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
  }
  return out;
}
