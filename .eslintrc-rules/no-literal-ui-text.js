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
 * STATUS: wired in. `.eslintrc.json` registers this via `eslint-plugin-local-rules`
 * (`eslint-local-rules.js` at the repo root re-exports this file) as
 * `local-rules/no-literal-ui-text`, set to "error". See IMPLEMENTATION_GUIDE.md
 * for the wiring details.
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

        const trimmed = node.value.trim();

        // A separator glyph or symbol — "·", "→", "%", "0%", "3 3" — carries no
        // language to translate; it is punctuation/digits, not prose. Anything
        // with an actual letter still gets caught, in any script (RU/EN/TH/中文).
        if (!/\p{L}/u.test(trimmed)) {
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
        // NOTE: no `fix()` here on purpose. Auto-replacing with a placeholder
        // key (e.g. `{t('todo.key_not_yet_defined')}`) is not a safe autofix —
        // it would silently swap real UI text for a broken, undefined key.
        // A human must pick the real content key (doc 05 §1).
        context.report({
          node,
          message: `Hardcoded text "${node.value.trim()}" found. Use content layer: wrap in t() call referencing a content key from doc 05. Example: {t('namespace.key')}`,
        });
      },

      // Also check string literals in JSX attributes that look like user-facing text
      // but exclude certain props (className, id, data-*, aria-*, etc.)
      JSXAttribute(node) {
        if (!node.value || node.value.type !== 'Literal') {
          return;
        }

        const attrName = node.name.name;
        // Allow technical attributes: DOM/React plumbing, and the SVG
        // presentation/geometry attributes every chart and icon in this
        // codebase sets directly (viewBox, d, stroke-*, text-anchor, ...) —
        // none of these are language a reader translates, they're drawing
        // instructions and are legitimately literal.
        const TECHNICAL_ATTRS = new Set([
          'className', 'id', 'htmlFor', 'style', 'type', 'href', 'src', 'alt', 'placeholder', 'name', 'value',
          'basePath',
          'role', 'tabIndex', 'rel', 'target', 'method', 'action', 'encType', 'autoComplete',
          'variant', 'size',
          // SVG
          'fill', 'stroke', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin', 'strokeDasharray',
          'viewBox', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width',
          'height', 'points', 'transform', 'preserveAspectRatio', 'textAnchor', 'dominantBaseline',
          'gradientUnits', 'offset', 'stopColor', 'stopOpacity', 'clipPath', 'clipRule', 'fillRule',
          'xmlns', 'xmlnsXlink', 'gradientTransform', 'spreadMethod', 'markerWidth', 'markerHeight',
          'markerUnits', 'orient', 'refX', 'refY', 'patternUnits', 'patternContentUnits',
        ]);
        if (
          TECHNICAL_ATTRS.has(attrName) ||
          attrName.startsWith('data-') ||
          attrName.startsWith('aria-') ||
          attrName.startsWith('on')
        ) {
          return;
        }

        const value = node.value.value;
        if (typeof value !== 'string') return;
        const trimmed = value.trim();
        if (!trimmed || trimmed.length <= 1) return;

        // A value with no letters (a glyph, a number, a CSS/SVG shorthand like
        // "3 3" or "0 0 24 24") is not prose a reader needs translated.
        if (!/\p{L}/u.test(trimmed)) return;

        context.report({
          node,
          message: `Hardcoded text in prop "${attrName}": "${value}". Move to content layer via a key.`,
        });
      },
    };
  },
};
