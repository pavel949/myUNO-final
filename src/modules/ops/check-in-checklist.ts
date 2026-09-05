/** Staff check-in inspection checklist item codes (doc 07 F-OPS-1). */
export const CHECK_IN_CHECKLIST_ITEMS = [
  'entry',
  'living',
  'kitchen',
  'bedrooms',
  'bathrooms',
  'appliances',
] as const;

export type CheckInChecklistItem = (typeof CHECK_IN_CHECKLIST_ITEMS)[number];

export function formatCheckInChecklistNotes(
  checked: CheckInChecklistItem[],
  notes: string
): string {
  const checklistLine =
    checked.length > 0 ? `Checklist: ${checked.join(', ')}` : 'Checklist: (none checked)';
  const trimmed = notes.trim();
  return trimmed ? `${checklistLine}\n${trimmed}` : checklistLine;
}
