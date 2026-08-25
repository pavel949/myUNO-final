# ESLint Rule: `no-literal-ui-text` — Implementation Guide

## Status: Wired In (Active, `error` level)

The `no-literal-ui-text` custom rule is active in ESLint configuration via
`eslint-plugin-local-rules` (see "How It's Wired" below).

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

## How It's Wired

This repo uses ESLint 8's legacy `.eslintrc.json` config (no flat config), so
the rule is wired via **Approach 3**: the `eslint-plugin-local-rules` package
(devDependency), which loads rule objects from a well-known local file
without requiring a full npm package.

- `eslint-local-rules.js` (repo root) re-exports `no-literal-ui-text.js` in
  the flat `{ruleName: ruleDef}` shape the plugin expects.
- `.eslintrc.json` adds `"plugins": ["local-rules"]` and sets
  `"local-rules/no-literal-ui-text": "error"`.

Run `npx eslint . --max-warnings 0` to see it in effect.

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
