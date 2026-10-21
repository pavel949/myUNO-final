/** Founder-granted intake rights, separate from daily operations and publication. */
export const OPERATING_CREATION_CAPABILITIES = ['create_unit', 'create_complex'] as const;
export type OperatingCreationCapability = typeof OPERATING_CREATION_CAPABILITIES[number];

export function isOperatingCreationCapability(value: string): value is OperatingCreationCapability {
  return (OPERATING_CREATION_CAPABILITIES as readonly string[]).includes(value);
}
