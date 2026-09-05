/** Official Thailand immigration TM30 online notification portal (doc 07 F-OPS-2). */
export const TM30_IMMIGRATION_PORTAL_URL = 'https://tm30.immigration.go.th/';

export function buildTm30AddressBlock(parts: {
  unitName: string;
  addressSupplement?: string | null;
  projectAddress?: string | null;
}): string {
  return [parts.unitName, parts.addressSupplement, parts.projectAddress]
    .filter((line) => typeof line === 'string' && line.trim().length > 0)
    .join('\n');
}
