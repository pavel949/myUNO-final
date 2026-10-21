/** Historical five-category demo data is never a production tariff source. */
export function assertLegacyLayantaraSeedEnvironment(nodeEnv: string | undefined): void {
  if (nodeEnv !== 'test' && nodeEnv !== 'development') {
    throw new Error('Legacy Layantara seed is development/test only. Use the reviewed 39-villa, 8-category catalogue and CommercialOffering tariff grids; never reseed production.');
  }
}
