import { getLabels } from '@/lib/i18n';
import { ADMINISTRATION_DEFAULTS, ADMINISTRATION_DRAFTS } from '@/modules/content/administration.seed';

export async function getAdministrationLabels(): Promise<Record<string, string>> {
  const registered = await getLabels(ADMINISTRATION_DEFAULTS, undefined, ADMINISTRATION_DRAFTS);
  return Object.fromEntries(Object.entries(registered).map(([key, value]) => [key.slice('administration.'.length), value]));
}
