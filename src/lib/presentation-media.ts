/**
 * Presentation-only imagery used while canonical Project/Service media is absent.
 *
 * This is deliberately not a property/service data source. Domain cover media
 * always wins. These licensed editorial placeholders keep public discovery
 * surfaces visually complete until an admin uploads the real cover image.
 */
const PROJECT_FALLBACKS = [
  'https://images.unsplash.com/photo-1774280960001-ce8169cfc38f?auto=format&fit=crop&fm=jpg&q=82&w=2400',
  'https://images.unsplash.com/photo-1759805583363-87fdee48b581?auto=format&fit=crop&fm=jpg&q=82&w=2400',
] as const;

const SERVICE_FALLBACKS = [
  'https://images.unsplash.com/photo-1759805583363-87fdee48b581?auto=format&fit=crop&fm=jpg&q=82&w=1800',
  'https://images.unsplash.com/photo-1774280960001-ce8169cfc38f?auto=format&fit=crop&fm=jpg&q=82&w=1800',
] as const;

function stableIndex(id: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % length;
}

export function projectPresentationImage(projectId: string, coverUrl: string | null): { src: string; illustrative: boolean } {
  if (coverUrl) return { src: coverUrl, illustrative: false };
  return { src: PROJECT_FALLBACKS[stableIndex(projectId, PROJECT_FALLBACKS.length)], illustrative: true };
}

export function servicePresentationImage(serviceId: string, coverUrl: string | null): { src: string; illustrative: boolean } {
  if (coverUrl) return { src: coverUrl, illustrative: false };
  return { src: SERVICE_FALLBACKS[stableIndex(serviceId, SERVICE_FALLBACKS.length)], illustrative: true };
}
