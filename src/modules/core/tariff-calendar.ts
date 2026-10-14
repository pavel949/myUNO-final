/** Editor-only calendar transformation. It emits the explicit annual windows
 * the existing tariff calculator already reads; it never calculates money. */
export type AnnualWindow = { start: string; end: string };
const MONTH_LENGTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const DAYS = MONTH_LENGTHS.flatMap((length, month) => Array.from({ length }, (_, day) =>
  `${String(month + 1).padStart(2, '0')}-${String(day + 1).padStart(2, '0')}`));
const valid = (day: string) => DAYS.includes(day);
const contains = (day: string, window: AnnualWindow) => window.start <= window.end
  ? window.start <= day && day <= window.end : day >= window.start || day <= window.end;

export function remainingAnnualWindows(seasons: Array<{ windows: AnnualWindow[] }>, selected: number): AnnualWindow[] {
  if (!Number.isInteger(selected) || selected < 0 || selected >= seasons.length) throw new Error('invalid_dates');
  const exceptions = seasons.filter((_, index) => index !== selected);
  for (const season of exceptions) {
    if (!Array.isArray(season.windows) || !season.windows.length || season.windows.some(window =>
      !window || !valid(window.start) || !valid(window.end))) throw new Error('invalid_dates');
  }
  const windows: AnnualWindow[] = [];
  let current: AnnualWindow | null = null;
  for (const day of DAYS) {
    const hits = exceptions.filter(season => season.windows.some(window => contains(day, window)));
    if (hits.length > 1) throw new Error('conflicting_dates');
    if (hits.length === 0) {
      if (current) current.end = day;
      else { current = { start: day, end: day }; windows.push(current); }
    } else current = null;
  }
  if (!windows.length) throw new Error('no_remaining_dates');
  return windows;
}
