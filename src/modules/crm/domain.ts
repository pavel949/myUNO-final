import { CrmLifecycleStage, CrmOpportunityType } from '@prisma/client';

export function validateProbability(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error('invalid_probability');
  }
  return value;
}

export function lifecycleAfterWin(type: CrmOpportunityType): CrmLifecycleStage | null {
  if (type === 'purchase') return 'owner';
  if (type === 'sale') return 'former_client';
  if (type === 'rental') return 'guest';
  if (type === 'management') return 'owner';
  return null;
}

export function opportunityTypeForAudience(
  audience: 'owners' | 'developers' | 'buyers' | 'mc'
): CrmOpportunityType {
  if (audience === 'developers') return 'developer_advisory';
  if (audience === 'buyers') return 'purchase';
  return 'management';
}

export function parseLeadContact(contact: string): {
  email?: string;
  phone?: string;
  preferredChannel: 'email' | 'whatsapp' | 'manual';
} {
  const value = contact.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { email: value.toLowerCase(), preferredChannel: 'email' };
  }
  const phone = value.replace(/[^+\d]/g, '');
  if (/^\+?\d{7,15}$/.test(phone)) {
    return { phone, preferredChannel: 'whatsapp' };
  }
  return { preferredChannel: 'manual' };
}
