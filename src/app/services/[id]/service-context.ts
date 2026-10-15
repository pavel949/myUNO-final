/** Preserve the caller's chosen context through authentication. The server still authorizes it. */
export function serviceContextPath(serviceId: string, context: { bookingId?: string | null; projectId?: string | null; unitId?: string | null }): string {
  const query = new URLSearchParams();
  for (const key of ['bookingId', 'projectId', 'unitId'] as const) {
    if (context[key]) query.set(key, context[key]!);
  }
  return `/services/${encodeURIComponent(serviceId)}${query.size ? `?${query}` : ''}`;
}
