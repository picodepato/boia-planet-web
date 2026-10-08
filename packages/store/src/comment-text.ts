/**
 * El filtro de insultos de Las Calitas (plan 019 T222, decisión 16): lo de
 * las botellas (`textProblem`: enlaces, emails, teléfonos y la lista de
 * palabras de `private.blocked_words`) más una lista propia de insultos y
 * dos normalizaciones más para los trucos de siempre:
 *
 * - letras repetidas: «putaaaa», «gilipollaaas» (se comparan con las letras
 *   seguidas iguales juntadas en una, en el texto y en la lista);
 * - palabras deletreadas: «p.u.t.a», «p u t a», «p-u-t-a» (las letras sueltas
 *   separadas por espacios o signos se juntan).
 *
 * Es la copia en el navegador de `private.comment_text_problem`
 * (supabase/migrations/20261008100500_calitas.sql): aquí se avisa antes de
 * publicar; allí no pasa aunque se salte el navegador. La lista propia tiene
 * que ser la de la migración (lo comprueba `comment-text.test.ts`).
 */
import { BLOCKED_WORDS, type TextProblem, foldText, textProblem } from './bottle-text';

/** Lo más largo de un comentario de Las Calitas. */
export const COMMENT_MAX = 280;

/** Las de `private.comment_blocked_words`: insultos que no están en la lista común. muestra */
export const COMMENT_EXTRA_WORDS: readonly string[] = [
  'mamon',
  'mamona',
  'mamones',
  'cretino',
  'cretina',
  'tarado',
  'tarada',
  'soplapollas',
  'comemierda',
  'malnacido',
  'malnacida',
  'putero',
  'zorron',
  'cerdo asqueroso',
  'cerda asquerosa',
  'muerete',
  'basura humana',
  'escoria',
];

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  $: 's',
};

/** Las letras seguidas iguales, en una (`private.squeeze_letters`). */
export function squeezeLetters(text: string): string {
  return text.replace(/([a-z])\1+/g, '$1');
}

/** Las letras sueltas separadas por espacios o signos, juntas (`private.join_spelled`). */
export function joinSpelled(text: string): string {
  return text.replace(/(?<![a-z0-9_])([a-z])[^a-z0-9_]+(?=[a-z](?![a-z0-9_]))/g, '$1');
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (w: string) =>
  new RegExp(`(^|[^a-z0-9_])${w.split(' ').map(escape).join('\\s+')}(?![a-z0-9_])`);
const ALL_WORDS = [...BLOCKED_WORDS, ...COMMENT_EXTRA_WORDS];
const PLAIN = ALL_WORDS.map(wordRe);
const SQUEEZED = ALL_WORDS.map((w) => wordRe(squeezeLetters(w)));

/**
 * Qué tiene de prohibido un comentario, o null si nada: lo de las botellas y,
 * después, los insultos con las letras deletreadas o repetidas.
 */
export function commentProblem(text: string): TextProblem | null {
  const base = textProblem(text);
  if (base) return base;
  const w = [...foldText(text)].map((c) => LEET[c] ?? c).join('');
  const spelled = joinSpelled(w);
  const squeezed = squeezeLetters(spelled);
  if (PLAIN.some((re) => re.test(spelled)) || SQUEEZED.some((re) => re.test(squeezed))) {
    return 'offensive';
  }
  return null;
}
