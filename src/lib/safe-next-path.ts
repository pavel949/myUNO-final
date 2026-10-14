/** Preserve local booking/workflow context without allowing an external redirect. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') ||
      value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const base = 'https://myuno.invalid';
    const url = new URL(value, base);
    if (url.origin !== base) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
