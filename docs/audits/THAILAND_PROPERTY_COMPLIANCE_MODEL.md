# THAILAND PROPERTY COMPLIANCE MODEL
**Repository:** `pavel949/myUNO-final`
**Domain:** Jurisdictional Regulatory Requirements & Compliance Gating (Thailand Focus)

---

## 1. Compliance Requirements Matrix (Thailand)

| Requirement | Scope Level | Requirement Description | Target Credential Type | Commercial Blocking | Evidence Documents |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hotel Business Licence** | Project / Org | Registration under Hotel Act B.E. 2547 for commercial guest stays. | `hotel_business_license` | Blocks `short_term_stay` if required & no exemption exists. | Copy of Official License Document |
| **Accommodation Exemption / Notification** | Project / Unit | Official exemption / notification for small-scale accommodation (<4 rooms, <20 guests). | `accommodation_exemption` | Unblocks `short_term_stay` when active. | Notification Form / Receipt |
| **TM30 Guest Registration** | Stay / Unit | Immigration Act B.E. 2522 obligation to report foreign guests within 24 hours. | `tm30_filing` | Escalates ops ticket on failure. | Immigration Filing Receipt / Ref |
| **Permitted Building Use** | Project / Unit | Verification that property zoning/juristic regulations permit short-term or long-term operations. | `permitted_building_use` | Blocks onboarding if non-compliant. | Juristic Resolution / Building Permit |
| **Fire & Life Safety Audit** | Project / Unit | Fire extinguisher, smoke detectors, emergency evacuation signage verification. | `fire_safety_audit` | Blocks high-risk property go-live. | Inspection Checklist / Photo Evidence |
| **Insurance Policy** | Project / Unit | Commercial liability insurance coverage for stay or rental operations. | `insurance_policy` | Blocks commercial distribution if required. | Policy Certificate Document |
| **Title Deed & Ownership Audit** | Unit | Verification of title deed (Chanote / Nor Sor 4) and ownership tenure (Freehold / Foreign Quota / Leasehold). | `title_ownership_audit` | Blocks `sale` commercial listing if unverified. | Copy of Title Deed / Juristic Letter |

---

## 2. Regulatory Evaluation Logic

1. **Jurisdiction Detection:** Property location determines `jurisdictionCountry = 'TH'`.
2. **Rule Evaluation:**
   - Short-term accommodation requires either:
     - Active `hotel_business_license` credential OR
     - Active `accommodation_exemption` credential.
   - Sale listings require verified `title_ownership_audit`.
3. **Structured Non-Compliance Result:**
   ```json
   {
     "eligible": false,
     "reasons": ["REQUIRED_CREDENTIAL_MISSING"],
     "missingCredentials": ["hotel_business_license", "accommodation_exemption"]
   }
   ```
