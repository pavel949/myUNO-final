# DEVELOPER DATA MODEL AUDIT
**Repository:** `pavel949/myUNO-final`
**Domain:** Developer Information & Relationship Mapping

---

## 1. Audit Matrix: Developer Information

| Developer Field | Existing Representation | Target Canonical Model | Public / Internal | Source / Provenance | Gap Identified |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Developer Identity** | Unstructured or missing | `Organization(orgType='developer')` | Public | Official / Developer | Previously no explicit developer entity in schema. |
| **Legal Entity Name** | `Organization.name` | `Organization.legalName` | Internal/Admin | Registration Document | Needed distinct legal name vs. brand name. |
| **Brand / Trading Name**| Unstructured | `Organization.tradingName` | Public | Developer Provided | Needed marketing brand representation. |
| **Logo & Media** | Missing on Organization | `Organization.logoMediaId` | Public | Uploaded Media Asset | Needed logo media linkage. |
| **Website & Contact** | `contactEmail`, `contactPhone` | `Organization.website`, `officeAddress`, `hqCountry` | Public/Internal | Official Website | Needed headquarters and website fields. |
| **Company Registration** | None | `Organization.registrationNumber`, `taxIdentifier` | Internal (RBAC) | Corporate Filing | Sensitive identity details required RBAC protection. |
| **Group Affiliation** | None | `Organization.parentOrganizationId` | Public | Corporate Filings | Group/parent corporate hierarchy support. |
| **Track Record** | None | `Organization.developerTrackRecord` (JSON: completed, active, total units, asset classes) | Public (if verified) | Verification Audit | Prevented unverified claims from being presented as verified facts. |
| **Verification Status** | None | `Organization.developerVerification` (`verified`, `developer_provided`, `unverified`) | Internal | Verification Audit | Required distinction between self-reported and verified metrics. |
| **Project Relationship**| `Organization.projectId` (1:1) | `ProjectOrganizationRole` (M:N role table) | Public / Internal | Management Contract | Allowed 1 developer to own multiple projects and 1 project to have multiple org roles (developer, operator, juristic). |
| **CRM Connection** | `ProspectingAccount` / `CrmProfile` | `CrmProfile.identityId` / `ProspectingAccount` linked to Developer Org | Internal | CRM System | Seamless bridge between CRM prospecting and property facts. |

---

## 2. Organization-Project Relational Architecture

Instead of duplicating developer information or adding nullable columns (`developerId`, `operatorId`, `juristicId`) on `Project`, we utilize `ProjectOrganizationRole`:

```text
Organization (Developer Entity)
      │
      ▼
ProjectOrganizationRole ──(roleKey: developer, operator, juristic_person, contractor, architect)
      │
      ▼
Project (Canonical Property Asset)
```

This allows:
- **Zero Data Duplication:** Updating developer contact or logo updates all child projects automatically.
- **Multiple Roles:** An organization can be both Developer and Operator for a project.
- **Role Progression & History:** `effectiveFrom` and `effectiveTo` track management changes over time.
