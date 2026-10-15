/** A description can move independently while the canonical title stays editable.
 * Null means a legacy unit: retain the original suffix-only derivation. Never
 * infer a new pointer, copy text, or fall back from an explicit missing key.
 */
export function resolveUnitMarketingTitleKey(unit: {
  marketingTitleKey?: string | null;
  descriptionKey?: string | null;
}): string | null {
  return unit.marketingTitleKey ??
    (unit.descriptionKey ? unit.descriptionKey.replace(/\.description$/, '.title') : null);
}
