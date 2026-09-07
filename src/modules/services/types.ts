export type ID = string

export interface ProviderProfileDTO {
  id?: ID
  identityId: ID
  name: string
  taxNumber?: string
  managingDirector?: string
  email: string
  contacts?: Record<string, any>
  // payoutEncrypted will be stored encrypted; shape:
  // { bankName, accountNumber, routingNumber, beneficiary }
}

export interface ServiceDTO {
  id?: ID
  providerId: ID
  projectId: ID
  taxonomyId?: ID
  titleKey: string
  descriptionKey: string
  meta?: Record<string, any>
  priceCents: number
  currency: string
  unit?: string
  active?: boolean
}

export type OrderState =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'DISPUTED'

export interface ServiceOrderDTO {
  id?: ID
  serviceId: ID
  buyerId: ID
  providerId: ID
  state?: OrderState
  scheduledFrom?: string
  scheduledTo?: string
  totalCents: number
  currency: string
  commissionCents?: number
  paymentRef?: string
}
