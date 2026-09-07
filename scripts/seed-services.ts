#!/usr/bin/env node
/**
 * scripts/seed-services.ts
 * Seeds a small taxonomy and a demo provider/service. Run with: ts-node scripts/seed-services.ts
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const industries = [
    { industry: 'Flowers', category: 'Same-Day Delivery', slug: 'flowers-same-day' },
    { industry: 'Yacht', category: 'Charter', slug: 'yacht-charter' },
    { industry: 'Home', category: 'Home Services', slug: 'home-services' },
    { industry: 'Tours', category: 'Experiences', slug: 'tours-experiences' },
    { industry: 'Transfers', category: 'Airport Transfers', slug: 'transfers-airport' },
    { industry: 'Catering', category: 'Events', slug: 'catering-events' },
    { industry: 'Wellness', category: 'Health & Wellness', slug: 'wellness' },
    { industry: 'Chef', category: 'Private Chef', slug: 'private-chef' },
    { industry: 'Luxury', category: 'Rental', slug: 'luxury-rental' },
    { industry: 'PA', category: 'Personal Assistance', slug: 'personal-assistance' },
  ]

  for (const i of industries) {
    await prisma.serviceTaxonomy.upsert({ where: { slug: i.slug }, update: {}, create: { industry: i.industry, category: i.category, slug: i.slug } })
  }

  // demo provider
  const provider = await prisma.providerProfile.upsert({ where: { identityId: 'provider-demo' }, update: {}, create: { identityId: 'provider-demo', name: 'Demo Provider LLC', email: 'provider@example.com', payoutEncrypted: 'ENCRYPTED_PLACEHOLDER' } })

  // demo service
  const flowersTax = await prisma.serviceTaxonomy.findUnique({ where: { slug: 'flowers-same-day' } })
  if (flowersTax) {
    await prisma.service.upsert({ where: { id: 'demo-service-flowers' }, update: {}, create: { id: 'demo-service-flowers', providerId: provider.identityId, projectId: 'demo-project', taxonomyId: flowersTax.id, titleKey: 'services.flowers.birthday_bouquet', descriptionKey: 'services.flowers.birthday_desc', priceCents: 4500, currency: 'USD', unit: 'per_order' } })
  }

  console.log('Seeding complete')
}

main().catch((e) => { console.error(e); process.exit(1) })
