# ESLint Rule: `no-literal-ui-text` — Implementation Guide

## Status: Drafted, Not Yet Integrated

The `no-literal-ui-text` custom rule is defined in this directory but not yet active in ESLint configuration.

## What It Does

Enforces **doc 05 §1**: every user-facing string must be a content key (via `t()`), not hardcoded inline.

**Prevents:**
```jsx
<div>Hello</div>  ❌
<button>Click me</button>  ❌
```

**Allows:**
```jsx
<div>{t('greeting.hello')}</div>  ✅
<button>{t('action.click')}</button>  ✅
```

## Files

- **`no-literal-ui-text.js`** — The custom rule implementation
- **`plugin.js`** — Plugin wrapper (optional, if using plugin approach)

## How to Activate

Choose one approach:

### Approach 1: ESLint Flat Config (Recommended for Next.js 14+)

If migrating to ESLint's flat config (`eslint.config.js`), import and register the rule directly:

```javascript
// eslint.config.js
import noLiteralUiText from './.eslintrc-rules/no-literal-ui-text.js';

export default [
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'custom/no-literal-ui-text': 'warn',
    },
    plugins: {
      custom: {
        rules: {
          'no-literal-ui-text': noLiteralUiText,
        },
      },
    },
  },
];
```

### Approach 2: Custom ESLint Plugin Package

Create a proper npm package for the rule (e.g., `eslint-plugin-myuno`) and publish locally or to npm.

### Approach 3: External Custom Plugin

Use a tool like `eslint-plugin-local-rules` to load rules from a directory without wrapping them.

## Future Work (T-043 or Later)

This rule should be activated before reaching 100% production readiness. Until then:
- Manual code review enforces the rule (lint violations reported during PR review)
- Documentation serves as the enforcement mechanism

## Testing the Rule

Once integrated, test with:

```bash
npm run lint  # Should report violations
```

### Example Test Cases

Create `src/test/no-literal-ui-text.test.ts`:

```typescript
// Should fail:
export function BadComponent() {
  return <button>Click me</button>;  // ❌ hardcoded text
}

// Should pass:
export function GoodComponent() {
  return <button>{t('action.click')}</button>;  // ✅
}
```

Run ESLint on it and verify the rule catches the violation.

## Notes

- Rule uses AST analysis to detect `JSXText` nodes (React.FC children text).
- Currently whitelists technical attributes (className, id, etc.) but flags non-technical props.
- Can be extended to check string literals in other contexts (props, alt text, etc.).
- Should be "warn" initially (doesn't break build), escalated to "error" after codebase is updated.
