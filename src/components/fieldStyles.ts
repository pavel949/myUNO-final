/** Shared chrome for Input, Textarea, and Select (doc 06 §3.1). */
export const fieldControlClass = `
  w-full px-16 py-12 rounded-sm
  bg-surface-paper border border-border-line
  text-body text-text-ink placeholder:text-text-stone-2 font-sans
  focus:border-brand-andaman focus:ring-2 focus:ring-brand-andaman focus:ring-offset-2 focus:outline-none
  disabled:bg-surface-paper disabled:text-text-stone-2 disabled:cursor-not-allowed
  transition-colors duration-micro
`.replace(/\s+/g, ' ').trim();

export function fieldControlWithError(error?: string, className?: string): string {
  return `${fieldControlClass} ${error ? 'border-state-error' : ''} ${className || ''}`.trim();
}
