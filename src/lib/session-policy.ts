/** A signed token never overrides the current lifecycle state of an identity. */
export function mayHoldSession(status: string): boolean {
  return status === 'active';
}
