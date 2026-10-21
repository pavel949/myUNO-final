import { PrismaClient } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { getDestination } from '@/modules/destinations';

export interface StandaloneServiceContext {
  kind: 'standalone';
  destinationKey: string;
  areaKey: string;
  address: string;
  recipientName: string;
  recipientPhone: string;
}
export interface StandaloneServiceOffer {
  serviceId: string;
  responsibleOrganizationId: string;
  responsibleOrganizationName?: string;
  destinationKey: string;
  areaKeys: string[];
  termsVersion: number;
  enabled: boolean;
  takeRatePct?: number;
}

export function parseStandaloneContext(value: unknown): StandaloneServiceContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Standalone service location is required');
  const data = value as Record<string, unknown>;
  const read = (key: string, min: number, max: number) => {
    const text = typeof data[key] === 'string' ? (data[key] as string).trim() : '';
    if (text.length < min || text.length > max) throw new Error(`Invalid service location: ${key}`);
    return text;
  };
  if (data.kind !== 'standalone') throw new Error('Invalid service location kind');
  return { kind: 'standalone', destinationKey: read('destinationKey', 1, 50), areaKey: read('areaKey', 1, 100), address: read('address', 8, 1000), recipientName: read('recipientName', 2, 120), recipientPhone: read('recipientPhone', 5, 40) };
}

/** Explicit supply permission; never infer coverage from a global card or a synthetic property. */
export async function getStandaloneServiceOffer(db: PrismaClient, serviceId: string): Promise<StandaloneServiceOffer | null> {
  const configured = await getConfig(db, 'services.standalone_offers', { fresh: true });
  if (!Array.isArray(configured)) return null;
  const matching = configured.filter(row => row && row.serviceId === serviceId && row.enabled === true);
  if (matching.length !== 1) return null;
  const offer = matching[0];
  if (offer.destinationKey !== getDestination().key || typeof offer.responsibleOrganizationId !== 'string' || !Number.isInteger(offer.termsVersion) || offer.termsVersion < 1 || !Array.isArray(offer.areaKeys) || !offer.areaKeys.length || offer.areaKeys.some(key => typeof key !== 'string' || !key)) return null;
  if (offer.takeRatePct !== undefined && (!Number.isFinite(offer.takeRatePct) || offer.takeRatePct < 0 || offer.takeRatePct > 100)) return null;
  const organization = await db.organization.findUnique({ where: { id: offer.responsibleOrganizationId }, select: { status: true, name: true } });
  return organization?.status === 'active' ? { ...offer, responsibleOrganizationName: organization.name } : null;
}

export async function validateStandaloneServiceContext(db: PrismaClient, serviceId: string, input: unknown) {
  const context = parseStandaloneContext(input);
  const offer = await getStandaloneServiceOffer(db, serviceId);
  if (!offer || context.destinationKey !== offer.destinationKey || !offer.areaKeys.includes(context.areaKey)) throw new Error('Service is not available at this location');
  const area = await db.area.findUnique({ where: { slug: context.areaKey }, select: { status: true } });
  if (!area || area.status !== 'live') throw new Error('Service area is not available');
  return { context, offer };
}

export function standaloneOrganizationId(context: unknown): string | undefined {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return undefined;
  const id = (context as Record<string, unknown>).responsibleOrganizationId;
  return typeof id === 'string' && id ? id : undefined;
}
