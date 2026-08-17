/**
 * ESLint rule: no-literal-ui-text
 *
 * Enforces doc 05 §1: every user-facing string must be a content key,
 * not hardcoded inline. Prevents:
 *   <div>Hello</div>  ❌
 *   <button>Click me</button>  ❌
 *
 * Allows:
 *   <div>{t('greeting.hello')}</div>  ✅
 *   <button>{t('action.click')}</button>  ✅
 *   <div className="...">  ✅ (empty/non-text)
 *   a JSX comment expression  ✅
 *
 * NOTE: the JSX comment example above is described in prose on purpose. Writing
 * it literally puts a comment terminator inside this block comment, which ends
 * the comment early and leaves the rest of the file as a syntax error — the
 * whole rule then fails to load.
 *
 * STATUS: drafted, not wired. `.eslintrc.json` registers neither a plugin nor a
 * rules directory for it, so `npm run lint` never loads this file. See
 * IMPLEMENTATION_GUIDE.md before enabling it — turning it on surfaces existing
 * violations (the admin screens are not localized yet) and will fail the build
 * until those are either localized or scoped out.
 */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce that all user-facing text is from content layer (via t() keys), not hardcoded',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
  },

  create(context) {
    const sourceCode = context.sourceCode;

    return {
      JSXText(node) {
        // Ignore whitespace-only text
        if (!node.value || !node.value.trim()) {
          return;
        }

        // Ignore text in specific safe contexts (props, style objects, etc.)
        const parent = node.parent;
        if (!parent) return;

        // Skip if parent is JSXAttribute (e.g., <Component title="text" />)
        // — the rule targets JSX *children*, not props
        if (parent.type === 'JSXAttribute') {
          return;
        }

        // Report: literal text found as JSX child
        context.report({
          node,
          message: `Hardcoded text "${node.value.trim()}" found. Use content layer: wrap in t() call referencing a content key from doc 05. Example: {t('namespace.key')}`,
          fix(fixer) {
            // Provide a minimal fix suggestion: wrap in placeholder
            return fixer.replaceText(
              node,
              `{t('todo.key_not_yet_defined')}`
            );
          },
        });
      },

      // Also check string literals in JSX attributes that look like user-facing text
      // but exclude certain props (className, id, data-*, aria-*, etc.)
      JSXAttribute(node) {
        if (!node.value || node.value.type !== 'Literal') {
          return;
        }

        const attrName = node.name.name;
        // Allow technical attributes
        if (
          ['className', 'id', 'style', 'type', 'href', 'src', 'alt', 'placeholder', 'name', 'value'].includes(attrName) ||
          attrName.startsWith('data-') ||
          attrName.startsWith('aria-') ||
          attrName.startsWith('on')
        ) {
          return;
        }

        // For non-technical props that carry text, flag them
        const value = node.value.value;
        if (typeof value === 'string' && value.trim() && value.trim().length > 1) {
          context.report({
            node,
            message: `Hardcoded text in prop "${attrName}": "${value}". Move to content layer via a key.`,
          });
        }
      },
    };
  },
};
