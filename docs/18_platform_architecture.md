# 18 · Ignatev Estate Property Operating System

## Product definition

This repository is the proprietary digital core of Ignatev Estate and the
myUNO operating standard. It is one modular monolith and one PostgreSQL source
of truth for commercial relationships, assets, stays, operations and owner
reporting.

## Domains

| Domain | Owns |
|---|---|
| Core | Party identity, roles, permissions and audit. |
| CRM | Contacts, demand, opportunities, activities, consent and attribution. |
| Assets | Projects, buildings/complexes, units, ownership and mandates. |
| Stay | Availability, pricing, booking, payment status and guest journey. |
| Operations | Mobilisation, service delivery, maintenance, TM30 and compliance. |
| Finance | Operational ledger, NOP and owner statements; statutory accounting remains external. |
| Distribution | Direct website, agents and external channel adapters. |
| Intelligence | ClearView, provenance, analytics and governed AI assistance. |

## Brand and operational scope

The data model must support four operating situations without changing systems:

1. several units in one condominium;
2. all units or all villas in a complex;
3. a whole resort under myUNO;
4. a branded hotel operated by Ignatev Estate with myUNO as an endorsed
   operating standard.

Brand presentation is configuration. Operational responsibility is determined
by mandate and engagement records, never inferred from a logo.

## Repository strategy

`myUNO-final` is the only product core. `OFFPLAN`, `farang-marketplace`,
`Phuket-Offer-Flow`, `check-in-page` and other repositories are reference or
donor repositories. Code may be ported only after domain, security, licence and
test review; their independent databases must never become parallel sources of
truth.

## Build order

1. CRM foundation and lead capture.
2. Asset/ownership/mandate normalization.
3. Production direct-booking flow and payment provider.
4. Operations board and owner reporting.
5. Distribution adapters and partner inventory.
6. ClearView/provenance integration.
7. Governed AI workflows and evaluation.

