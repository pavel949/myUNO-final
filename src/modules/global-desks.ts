import { getDestination, getDestinationDesk, type DestinationDeskConfig } from '@/modules/destinations';

export const GLOBAL_DESKS: readonly DestinationDeskConfig[] = getDestination().desks;

export type GlobalDeskSlug = string;

export function getGlobalDesk(slug: string) {
  return getDestinationDesk(slug);
}
