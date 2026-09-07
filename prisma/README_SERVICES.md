# Services module - design notes and integration

This file documents the initial services module add and contains the Prisma model snippets that must be applied to your existing Prisma schema. To apply:

1. Merge the models below into your primary prisma/schema.prisma.
2. Run: npx prisma generate && npx prisma migrate dev --name add_services_module

---

Add the following Prisma models (append to schema.prisma):

```prisma
model ProviderProfile {
  id              String   @id @default(cuid())
  identityId      String   @unique
  name            String
  taxNumber       String?
  managingDirector String?
  email           String
  contacts        Json?
  payoutEncrypted String
  kycStatus       ProviderKycStatus @default(PENDING)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum ProviderKycStatus { PENDING VERIFIED REJECTED SUSPENDED }

model ServiceTaxonomy {
  id        String   @id @default(cuid())
  industry  String
  category  String
  slug      String   @unique
  parentId  String?
  meta      Json?
}

model Service {
  id             String   @id @default(cuid())
  providerId     String
  projectId      String
  taxonomyId     String?
  titleKey       String
  descriptionKey String
  meta           Json?
  priceCents     Int
  currency       String
  unit           String
  active         Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model ServiceAvailability {
  id        String   @id @default(cuid())
  serviceId String
  from      DateTime
  to        DateTime
  qty       Int?
}

enum OrderState { DRAFT PENDING_PAYMENT PAID CONFIRMED IN_PROGRESS COMPLETED CANCELLED REFUNDED DISPUTED }

model ServiceOrder {
  id             String    @id @default(cuid())
  serviceId      String
  buyerId        String
  providerId     String
  state          OrderState @default(DRAFT)
  scheduledFrom  DateTime?
  scheduledTo    DateTime?
  totalCents     Int
  currency       String
  commissionCents Int
  paymentRef     String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}

model ServiceOrderEvent {
  id         String   @id @default(cuid())
  orderId    String
  actorId    String
  type       String
  data       Json?
  createdAt  DateTime @default(now())
}

model ServiceReview {
  id         String   @id @default(cuid())
  serviceId  String
  reviewerId String
  rating     Int
  textKey    String?
  createdAt  DateTime @default(now())
}

model ServiceDispute {
  id        String @id @default(cuid())
  orderId   String
  ticketId  String?
  state     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```
