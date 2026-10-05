/**
 * Place search for the homepage finder: one box for areas and complexes.
 *
 * Matching is done on a normalised form of both the option name and the query,
 * so a Cyrillic query reaches a Latin name ("легендари" finds "The Title
 * Legendary") and a Latin query reaches a localised area name ("Layan" finds
 * "Лаян"). Both sides resolve to the same option id — no aliases are stored.
 */

export type PlaceKind = 'area' | 'project';

export interface PlaceOption {
  kind: PlaceKind;
  id: string;
  name: string;
  /** Canonical area slug for areas; used to build the downstream filter. */
  slug?: string;
  /** Area display name for a project, matched as a weaker signal. */
  areaName?: string | null;
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function normalizePlaceText(value: string): string {
  const latin = value
    .toLocaleLowerCase('en')
    .replace(/[а-яё]/g, (ch) => CYRILLIC_TO_LATIN[ch] ?? ch)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return latin
    .replace(/[^a-z0-9฀-๿一-鿿]+/g, ' ')
    .trim()
    .replace(/^the /, '')
    .replace(/\s+/g, ' ')
    // Latin "y" and "i" are interchangeable when a Russian speaker transliterates
    // by ear ("легендари" for "Legendary"); fold them so both reach one option.
    .replace(/y/g, 'i');
}

function score(option: PlaceOption, query: string): number {
  const name = normalizePlaceText(option.name);
  if (name === query) return 100;
  if (name.startsWith(query)) return 80;
  if (name.split(' ').some((word) => word.startsWith(query))) return 70;
  if (name.includes(query)) return 50;
  const area = option.areaName ? normalizePlaceText(option.areaName) : '';
  if (area && area.includes(query)) return 20;
  return 0;
}

/** Areas first, then complexes; within a kind, best match first. */
export function matchPlaces(options: readonly PlaceOption[], rawQuery: string, limit = 8): PlaceOption[] {
  const query = normalizePlaceText(rawQuery);
  const kindRank = (kind: PlaceKind) => (kind === 'area' ? 0 : 1);
  if (!query) {
    return [...options]
      .sort((a, b) => kindRank(a.kind) - kindRank(b.kind))
      .slice(0, limit);
  }
  return options
    .map((option) => ({ option, value: score(option, query) }))
    .filter((entry) => entry.value > 0)
    .sort(
      (a, b) =>
        b.value - a.value ||
        kindRank(a.option.kind) - kindRank(b.option.kind) ||
        a.option.name.localeCompare(b.option.name)
    )
    .slice(0, limit)
    .map((entry) => entry.option);
}
