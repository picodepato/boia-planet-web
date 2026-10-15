/**
 * `boia/no-loose-strings` (plan 032 T303): los textos de interfaz van por
 * clave en `apps/web/lib/i18n/` (CLAUDE.md), no sueltos en los componentes.
 * La regla falla en un componente (JSX) con:
 *
 * - texto escrito entre etiquetas (`<p>Hola</p>`), y
 * - un literal en un atributo que ve la persona (`aria-label`, `title`, `alt`,
 *   `placeholder`, `label`, `aria-description`, `aria-roledescription`).
 *
 * Una cadena sólo cuenta si lleva una palabra de verdad: al menos dos letras
 * seguidas. Quedan fuera los símbolos, números y puntuación (`·`, `×`, `—`,
 * `%`), que no se traducen. Lo que sea de verdad un literal que no se traduce
 * (un nombre propio, una unidad) se declara en `allow` (cadenas exactas) o con
 * `// eslint-disable-next-line boia/no-loose-strings -- motivo`.
 */
const VISIBLE_ATTRS = new Set([
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'title',
  'alt',
  'placeholder',
  'label',
]);

/** Una palabra de verdad; las direcciones (`https://…`) tampoco se traducen. */
const hasWord = (text) => !/^\s*https?:\/\//.test(text) && /\p{L}{2,}/u.test(text);

/** Los textos que una expresión puede dar tal cual: literales y ramas de `?:`, `&&`, `||`, `??`. */
function literalsOf(expr) {
  if (!expr) return [];
  if (expr.type === 'Literal') return typeof expr.value === 'string' ? [expr.value] : [];
  if (expr.type === 'TemplateLiteral') return [expr.quasis.map((q) => q.value.cooked).join('·')];
  if (expr.type === 'ConditionalExpression') {
    return [...literalsOf(expr.consequent), ...literalsOf(expr.alternate)];
  }
  if (expr.type === 'LogicalExpression')
    return [...literalsOf(expr.left), ...literalsOf(expr.right)];
  return [];
}

/** @type {import('eslint').Rule.RuleModule} */
export const noLooseStrings = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: { allow: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    messages: {
      text: 'Texto suelto en un componente: ponlo en apps/web/lib/i18n/ y usa t(clave) ({{text}}).',
      attr: 'Atributo «{{attr}}» con texto suelto: ponlo en apps/web/lib/i18n/ y usa t(clave) ({{text}}).',
    },
  },
  create(context) {
    const allow = new Set(context.options[0]?.allow ?? []);
    const short = (s) => JSON.stringify(s.trim().replace(/\s+/g, ' ').slice(0, 40));
    const loose = (s) => hasWord(s) && !allow.has(s.trim());
    return {
      JSXText(node) {
        if (loose(node.value)) {
          context.report({ node, messageId: 'text', data: { text: short(node.value) } });
        }
      },
      // `{'Hola'}`, `{ok ? 'Sí' : 'No'}`, `{x && 'Hola'}`, `{`Hola`}` como hijo.
      JSXExpressionContainer(node) {
        if (node.parent.type !== 'JSXElement' && node.parent.type !== 'JSXFragment') return;
        for (const text of literalsOf(node.expression)) {
          if (loose(text)) context.report({ node, messageId: 'text', data: { text: short(text) } });
        }
      },
      JSXAttribute(node) {
        const attr = node.name.type === 'JSXIdentifier' ? node.name.name : '';
        if (!VISIBLE_ATTRS.has(attr) || !node.value) return;
        const texts =
          node.value.type === 'Literal'
            ? literalsOf(node.value)
            : node.value.type === 'JSXExpressionContainer'
              ? literalsOf(node.value.expression)
              : [];
        for (const text of texts) {
          if (loose(text)) {
            context.report({ node, messageId: 'attr', data: { attr, text: short(text) } });
          }
        }
      },
    };
  },
};

export default { rules: { 'no-loose-strings': noLooseStrings } };
