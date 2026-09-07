import { z } from 'zod'

export const ProviderProfileSchema = z.object({
  name: z.string().min(1),
  taxNumber: z.string().optional(),
  managingDirector: z.string().optional(),
  email: z.string().email(),
  contacts: z.any().optional(),
  payout: z.object({
    bankName: z.string().min(1),
    accountNumber: z.string().min(1),
    routingNumber: z.string().min(1),
    beneficiaryName: z.string().optional(),
  }),
})

export const FlowersMetaSchema = z.object({
  bouquetVariantId: z.string(),
  vaseRequired: z.boolean().optional().default(false),
  cardMessage: z.string().max(500).optional(),
})

export const YachtMetaSchema = z.object({
  berthCount: z.number().int().min(1),
  captainIncluded: z.boolean().optional().default(false),
  fuelPolicy: z.string().optional(),
  cancellationWindowHours: z.number().int().optional(),
})

export const HomeMetaSchema = z.object({
  estimatedDurationMinutes: z.number().int().min(1),
  requiresAccessInstructions: z.boolean().optional().default(false),
})

export const BookingSchema = z.object({
  serviceId: z.string(),
  buyerId: z.string(),
  providerId: z.string(),
  scheduledFrom: z.string().optional().nullable(),
  scheduledTo: z.string().optional().nullable(),
  totalCents: z.number().int().min(0),
  currency: z.string().min(3).max(3),
})

export type ProviderProfileInput = z.infer<typeof ProviderProfileSchema>
export type FlowersMeta = z.infer<typeof FlowersMetaSchema>
export type YachtMeta = z.infer<typeof YachtMetaSchema>
export type HomeMeta = z.infer<typeof HomeMetaSchema>
export type BookingInput = z.infer<typeof BookingSchema>
