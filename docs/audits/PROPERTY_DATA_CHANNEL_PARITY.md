# PROPERTY DATA CHANNEL PARITY MATRIX
**Repository:** `pavel949/myUNO-final`
**Domain:** Channel Parity & Adapter Mapping

---

## 1. Parity Matrix

| Domain / Field | Canonical Field | Airbnb | Booking.com | Agoda | Direct Booking | Thai Portals (DDProperty / FazWaz) | Gap & Adapter Mapping |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Developer Name** | `Organization.name` / `tradingName` | N/A | N/A | N/A | Footer / About | Developer / Branding filter | Mapped via Project Developer Org. |
| **Project Name** | `Project.name` | Listing Title / Complex | Building Name | Property Name | Project Name | Project / Building | Direct 1:1 mapping. |
| **Accommodation Type**| `Unit.categoryKey` / `unitType` | Property Type | Accommodation Type | Property Type | Unit Type | Property Type | Standardized taxonomy adapter. |
| **Privacy Type** | `Unit.privacyType` | Entire Place / Private Room | Room Type | Room Type | Entire Place / Room | N/A | Mapped to Airbnb privacy taxonomy. |
| **Bedrooms & Sleeping**| `Unit.bedrooms` + `SleepingSpace` | Bedroom breakdown + Bed Types | Bed Configuration | Room Bed Config | Sleeping Layout | Bedrooms Count | Array of sleeping spaces mapped to channel schemas. |
| **Max Capacity** | `Unit.maxGuests` | Max Guests | Occupancy | Max Occupancy | Max Guests | N/A | Direct integer mapping. |
| **Unit Areas** | `usableAreaSqm` / `outdoorAreaSqm` | Sq Meters (optional) | Room Size (sqm) | Room Size (sqm) | Usable Area (sqm) | Usable Area & Land Size (sqm) | Standardized in SI (sqm). |
| **Amenities & Features**| `amenityKeys` + `unitFeatures` | Airbnb Amenity IDs | Facility Codes | Amenity Codes | Amenity Badges | Portal Amenities | Adapter translates canonical keys to channel codes. |
| **Accessibility** | `accessibilityFacts` | Accessibility Features | Accessible Facilities | Accessibility Features | Accessibility Info | N/A | Canonical keys mapped to channel accessibility tags. |
| **Safety Facts** | `safetyFacts` | Safety Devices | Safety & Security | Safety Equipment | Guest Safety | N/A | Channel-specific safety requirement mapping. |
| **House Rules** | `CommercialOffering.rules` | House Rules | Policies | Good to Know | Stay Rules | Rental Terms | Derived from Commercial Offering. |
| **Ownership Tenure** | `CommercialOffering.tenure` | N/A | N/A | N/A | N/A | Freehold / Leasehold / Foreign Quota | Thai portal specific tenure mapping. |
| **Licence / Registration**| `RegulatoryCredential` | Registration / Licence No. | STR Licence ID | Registration ID | Public Notice | N/A | Derived from active regulatory credentials. |
