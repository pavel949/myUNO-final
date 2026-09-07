# CANONICAL PROPERTY DATA AUDIT
**Repository:** `pavel949/myUNO-final`
**Domain:** Property Facts, Developer Information, Commercial Offerings, Jurisdictional Compliance

---

## 1. Executive Summary & Audit Scope

This document provides the foundational audit of existing entity models in myUNO (`Project`, `Unit`, `Organization`, `ComplianceRecord`, `CrmProfile`, `IntegrationAccount`, etc.) to establish the canonical 3-layer property data architecture:
1. **Layer 1 — Property Facts:** Physical asset reality (Project/Property, Developer/Organization relationships, Unit/Accommodation physical facts, facilities, sleeping arrangements, areas, features, views).
2. **Layer 2 — Commercial / Listing Facts:** How the asset is booked (short-term), rented (long-term), or sold (sales listing) across channels without creating parallel property records.
3. **Layer 3 — Jurisdictional Compliance:** Required permits, licences, exemptions, registrations, and regulatory compliance that gate commercial eligibility.

---

## 2. Audit of Existing Entities & Data Structures

| Entity | Current Schema State | Gap / Redundancy | Target Canonical Model |
| :--- | :--- | :--- | :--- |
| **Project** | Basic identity fields (`name`, `slug`, `address`, `latitude`, `longitude`, `timezone`, `amenityKeys`, `defaultCurrency`). | Lacks developer linkage, construction/lifecycle facts, land area, building count, facilities taxonomy, and hospitality operational configuration. | Extend `Project` with physical development facts, facilities taxonomy, hospitality config, and relational org role links. |
| **Organization** | Basic entity (`name`, `orgType`, `contactEmail`, `contactPhone`, `projectId`). | Single optional `projectId` FK prevents a developer from owning/operating multiple projects or holding explicit roles (developer, operator, juristic_person, etc.). | Model explicit `ProjectOrganizationRole` join entity (`projectId`, `organizationId`, `roleKey`, `effectiveFrom`, `effectiveTo`, `primary`, `provenance`). Extend `Organization` for full developer profile. |
| **Unit** | Physical + short-term stay facts mixed (`bedrooms`, `bathrooms`, `maxGuests`, `sizeSqm`, `baseNightlyThb`, `instantBook`, `minNights`, `permittedUseConfirmedAt`). | Lacks structured sleeping layout (beds/bedrooms), usable vs. outdoor/plot area breakdown, features, accessibility, views, furnishing details, and separation of commercial offerings. | Retain `Unit` as canonical accommodation record; add `SleepingSpace` & `Bed` entities; store granular areas, views, accessibility, features; decouple commercial pricing into `CommercialOffering`. |
| **ComplianceRecord** | Basic unit-scoped record (`unitId`, `recordType`, `status`, `expiresOn`, `verifiedAt`). | Scope restricted to `Unit` only. Cannot handle Project-level or Developer/Operator-level credentials (e.g., Hotel Business Licence, Building Permits, TM30 operator filing). | Introduce global `RegulatoryCredential` model attaching to `Organization`, `Project`, or `Unit` under a `Jurisdiction`. |
| **Integrations** | `IntegrationAccount` scoped to platform, project, or unit. | Lacks channel-specific listing mapping / sync state abstraction for listings (Airbnb, Booking.com, Agoda, Thai portals). | Introduce `ChannelMapping` tied to `CommercialOffering`. |

---

## 3. Canonical Architecture Alignment Strategy

1. **No Parallel Property Databases:** Airbnb, Booking.com, Agoda, Sales Portals, and PMS read from the SAME canonical `Project` and `Unit` graph.
2. **Developer Inheritance:** Developer profiles belong to `Organization`. Projects reference `Organization` via `ProjectOrganizationRole(roleKey='developer')`. Units inherit Project/Developer facts dynamically.
3. **Commercial Offering Decoupling:** Physical Facts (beds, size, amenities) stay in `Unit`. Stays, rents, and sales live in `CommercialOffering`.
4. **Jurisdictional Compliance Gating:** Compliance credentials evaluate against rules in `CommercialEligibilityEngine` to determine if an asset can go live on any given channel or offering type.
