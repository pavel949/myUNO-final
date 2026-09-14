# INVENTORY AND RATE SCOPE AUDIT
**Repository:** `pavel949/myUNO-final`
**Domain:** Multi-Inventory Revenue, Tariff, Stay Rules, Tax & Quotation Engine

---

## 1. Inventory Scope Matrix

| Inventory Case | Current Support | Booking Model | Pricing Scope | Availability Model | Gap | Action Taken |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Single Condo** | Direct Unit | Specific Unit | Unit Nightly Tariff | Unit Blocked Dates | None | Supported natively via `Unit`. |
| **Standalone Villa** | Direct Unit | Specific Unit | Unit Seasonal Rates | Unit Calendar | None | Supported natively via `Unit`. |
| **Resort Individual Villa** | Direct Unit | Specific Unit | Unit Override or Category Base | Unit Calendar | None | Supported via `Unit` with `InventoryCategory` inheritance. |
| **Resort Villa Category** | Category Pool | Category First | Category Base Tariff | Category Capacity Count | Needed Category Inventory model | Added `InventoryCategory` and capacity resolution engine. |
| **Hotel Room Category** | Pooled Category | Room Category | Category Rate Grid | Capacity - (Booked + Maintenance) | Needed Room Category support | Created `InventoryCategory` & capacity reduction on maintenance. |
| **Hotel Specific Room** | Direct Room | Specific Room | Room Override | Room Calendar | None | Supported via specific `Unit` under Hotel `Project`. |
| **Mixed Project** | Hybrid | Category or Specific | Inherited or Overridden | Unified Capacity + Unit Calendar | Needed hybrid resolution | Enabled `resolveEffectiveStayOffer` to handle both modes. |
| **Multi-Unit Future Booking** | Multi-Line Quote | Multi-Unit Quote | Line Item Accommodation | Combined Inventory Pool | Multi-unit line quotation support | Supported via `EffectiveStayOffer` line calculation. |

---

## 2. Rate Scope Hierarchy Resolution

The Revenue Engine resolves commercial tariffs and stay rules in strict downward precedence:

```text
Platform Defaults (e.g. Thailand 7% VAT)
    ↓
Organization Defaults
    ↓
Project Defaults (Currency, Base Rules)
    ↓
Inventory Category (Category Tariff, Min Stay)
    ↓
Specific Unit (Unit Premium Overrides)
    ↓
Rate Plan (BAR, Non-Refundable -10%, Weekly -15%)
    ↓
Season / Specific Date Override
```

Every quote provides **Pricing Source Traceability**, logging the exact source of every night's tariff.
