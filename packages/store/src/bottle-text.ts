/**
 * El filtro de texto de las botellas globales (plan 008, decisión 12,
 * REQ-IDE-044 «sin mensajes privados»): sin enlaces, emails, teléfonos ni
 * palabras ofensivas. Es la copia en el navegador de `private.text_problem`
 * (supabase/migrations/20261003100000_accounts.sql), que hace de guarda en
 * la base: aquí se avisa antes de mandar nada, allí no pasa aunque se salte
 * el navegador. Las dos listas de palabras tienen que ser la misma (lo
 * comprueba `bottle-text.test.ts` contra la migración).
 */

export type TextProblem = 'link' | 'email' | 'phone' | 'offensive';

/** Las de `private.blocked_words`, sin tildes ni eñes. */
export const BLOCKED_WORDS: readonly string[] = [
  'puta',
  'puto',
  'putas',
  'putos',
  'hijoputa',
  'hijaputa',
  'hdp',
  'gilipollas',
  'gilipolla',
  'cabron',
  'cabrona',
  'cabrones',
  'mierda',
  'polla',
  'pollas',
  'zorra',
  'zorras',
  'maricon',
  'maricones',
  'marica',
  'bollera',
  'subnormal',
  'retrasado',
  'retrasada',
  'mongolo',
  'mongola',
  'imbecil',
  'idiota',
  'capullo',
  'follar',
  'folla',
  'joder',
  'jodete',
  'chupamela',
  'pendejo',
  'pendeja',
  'malparido',
  'gonorrea',
  'negrata',
  'sudaca',
  'moro de mierda',
  'panchito',
  'nazi',
  'nazis',
  'hitler',
  'violador',
  'violacion',
  'pederasta',
  'fuck',
  'fucker',
  'fucking',
  'shit',
  'bitch',
  'cunt',
  'dick',
  'cock',
  'pussy',
  'whore',
  'slut',
  'nigger',
  'nigga',
  'faggot',
  'fag',
  'retard',
  'rape',
  'rapist',
];

const ACCENTS = 'áàâäéèêëíìîïóòôöúùûüñç';
const PLAIN = 'aaaaeeeeiiiioooouuuunc';
const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  $: 's',
};

/** En minúsculas, sin tildes ni eñes (`private.fold_text`). */
export function foldText(text: string): string {
  let out = '';
  for (const ch of text.toLowerCase()) {
    const i = ACCENTS.indexOf(ch);
    out += i >= 0 ? PLAIN[i] : ch;
  }
  return out;
}

const EMAIL =
  /[a-z0-9._%+-]+\s*(@|\(at\)|\[at\]|\(arroba\)|\[arroba\])\s*[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/;
const LINK =
  /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|es|net|org|io|me|app|link|ly|co|info|xyz|gg|tv|eu|cat|dev|site|online|shop|store|club|live|fm|to|be|it|fr|de|uk)\b|\b(t\.me|wa\.me|bit\.ly)\b)/;
/** Siete cifras o más seguidas, admitiendo espacios, puntos, guiones y paréntesis. */
const PHONE = /[0-9]([\s.()-]*[0-9]){6,}/;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORDS = BLOCKED_WORDS.map(
  (w) => new RegExp(`(^|[^a-z0-9_])${w.split(' ').map(escape).join('\\s+')}(?![a-z0-9_])`),
);

/** Qué tiene de prohibido un texto, o null si nada (el mismo orden que en la base). */
export function textProblem(text: string): TextProblem | null {
  const t = foldText(text);
  if (EMAIL.test(t)) return 'email';
  if (LINK.test(t)) return 'link';
  if (PHONE.test(t)) return 'phone';
  const w = [...t].map((c) => LEET[c] ?? c).join('');
  if (WORDS.some((re) => re.test(w))) return 'offensive';
  return null;
}
