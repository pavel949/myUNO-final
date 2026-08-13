# Ignatev Estate Property Operating System

Proprietary digital core for **Ignatev Estate Co., Ltd.** and the **myUNO** operating standard on Phuket.

The platform connects the complete commercial lifecycle of a real-estate asset:

`inquiry → stay → purchase → ownership → operation → sale`

It is not a generic CRM, an OTA clone, or a collection of disconnected dashboards. The same identity, asset, commercial history, consent record, booking, operating event, and owner mandate remain linked throughout the relationship.

## Product surfaces

| Surface | Primary user | Purpose |
|---|---|---|
| **Stay** | Guest | Direct booking, payment, pre-arrival, in-stay service, extension and repeat stay |
| **Owners** | Owner or developer | Asset review, mandate, reporting, compliance and performance visibility |
| **Buy** | Buyer | Verified managed inventory and a controlled purchase process |
| **Operations** | Internal team | Properties, units, reservations, tasks, service, incidents and owner reporting |
| **CRM** | Commercial team | One relationship record across guest, buyer, owner, seller and partner journeys |

## Core architecture

- **Next.js 14 and TypeScript** for public, guest, owner and administration surfaces.
- **PostgreSQL and Prisma** as the system of record.
- **Identity as Party ID**: a person is stored once and may move from guest to buyer, owner and seller without duplicate profiles.
- **Modular monolith first**: clear domain boundaries without premature microservices.
- **API and event-ready design** for channel managers, payments, messaging, analytics and AI workers.
- **Human approval for consequential actions**: pricing overrides, refunds, contracts, legal statements and outbound commitments.

## Business domains

```text
src/modules/
├── crm/              identity, lifecycle, opportunities, activity and attribution
├── inventory/        projects, units, availability and restrictions
├── reservations/     quotes, holds, bookings and stay lifecycle
├── revenue/          rates, fees, commissions and performance logic
├── operations/       tasks, service requests, inspections and incidents
├── owner/            mandates, reports and asset performance
├── distribution/     direct demand, OTA/channel connections and partner supply
├── compliance/       consent, audit trail and operating controls
└── integrations/     payment, messaging and external adapters
```

The CRM foundation added in this branch includes:

- lifecycle profiles for contacts, guests, prospects, buyers, owners and sellers;
- opportunity pipelines for rental, purchase, sale, management, developer advisory, capex and compliance;
- tasks and commercial activities;
- consent records and source attribution;
- conversion of public website inquiries into the internal CRM;
- support for rental demand fulfilled by an approved external partner when no managed unit matches;
- an initial administration pipeline at `/app/admin/crm`.

## Asset and brand coverage

The data model supports four operating situations without splitting them into separate systems:

1. Several managed units in a condominium.
2. All units in a condominium or residence.
3. All villas in a branded or unbranded complex.
4. A complete hotel or resort that keeps its own asset brand and may use **Managed by myUNO** as an endorsement.

Brand visibility is a contractual and operational attribute of the managed scope. It is not inferred merely because an asset exists in the database.

## Demand outside managed inventory

A request is never discarded merely because the required property is not directly managed. It enters the same CRM and follows one of three paths:

1. Match against managed inventory first.
2. Match against approved partner supply with disclosed responsibility and commission.
3. Retain as qualified unmet demand and use the evidence to acquire the right asset or owner mandate.

Partner properties are not presented as managed by myUNO. Service responsibility, data permissions, pricing source, commission and complaint ownership must be explicit.

## Repository policy

This repository is the target product and the sole production system of record. Other repositories may donate reviewed components, but their schemas and authentication models are not merged wholesale.

Recommended donor roles:

- **OFFPLAN** — verified property catalogue and ClearView-style evidence patterns.
- **farang-marketplace** — selected lead intake and commercial workflow patterns.
- **MyUNO-Capital** — selected AI analysis patterns after security and data review.

Every imported component must pass an architecture, licensing, security and data-ownership review.

## Documentation

- [Architecture decisions](docs/01_architecture_decisions.md)
- [Data model](docs/02_data_model.md)
- [Security and privacy](docs/12_security_privacy.md)
- [Operating flows](docs/07_flows.md)
- [Technical specification](docs/14_tech_spec.md)
- [Build plan](docs/16_build_plan.md)
- [CRM and commercial system](docs/17_crm_and_commercial_system.md)
- [Target platform architecture](docs/18_platform_architecture.md)

## Local development

```bash
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

The application requires PostgreSQL. Use a separate test database through `DATABASE_URL_TEST`; integration tests intentionally refuse to run against a non-test database.

Useful checks:

```bash
npx prisma validate
npm run lint
npm test
npm run build
```

## Security and governance baseline

- no secrets or production personal data in Git;
- role-based access and least privilege;
- explicit consent and purpose tracking;
- immutable audit events for material actions;
- idempotency for payment and booking writes;
- AI-generated recommendations remain traceable to source data;
- accounting remains an external specialist system and receives approved exports or integrations.

## Current status

This is an active product foundation. The CRM domain is the first part of the unified commercial system; production rollout still requires environment configuration, database migration review, access-control verification, payment/channel credentials, observability and deployment approval.

## Ownership

Proprietary software of Ignatev Estate Co., Ltd. All rights reserved.
