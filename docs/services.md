# Services Module

This module adds the marketplace for services with industry-aware taxonomy, booking, orders, and provider profiles.

What is included in this PR branch (scaffold):
- Prisma schema snippet (prisma/README_SERVICES.md)
- API routes: /api/services, /api/orders, /api/webhooks/stripe
- Business logic: booking, availability, order events
- Stripe payment adapter (immediate capture)
- UI components: Listing, BookingWidget
- Seed script and taxonomy matrix

Environment variables added (update your .env):
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
- SERVICES_COMMISSION_PCT (default 10)
- SERVICES_ENCRYPTION_KEY (used to encrypt payout instructions)

Run & dev notes:
- Merge Prisma changes then run migrations
- Add Stripe keys for payment flows
- Seed sample taxonomy with: node scripts/seed-services.ts
