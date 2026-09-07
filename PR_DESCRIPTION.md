# Initial PR: services marketplace scaffold

This branch adds the initial scaffold for the Services marketplace module:

- Prisma schema snippet to merge (see prisma/README_SERVICES.md)
- API routes for services, orders, and Stripe webhooks
- Business logic for booking and availability
- Stripe payment adapter (immediate capture)
- UI components (Listing, BookingWidget)
- Seed script and taxonomy matrix (first 10 industries)
- Docs and .env.example additions

I will follow up with more complete unit and integration tests, UI polish, and industry-specific miniapps. Please run the migration and seed script in a dev environment before testing.
