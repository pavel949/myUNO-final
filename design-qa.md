# Pricing desk design QA — 2026-10-21

final result: passed

Scope: local pricing workspace, not production readiness. Reference: selected first matrix concept (`exec-7272f7a9-0f6e-407c-8afd-3b15ae4ae96e.png`) and its calendar/scope refinement (`exec-611ee0ba-b3b1-4d72-aeaa-f2591cea50da.png`), plus the user's Airbnb multi-calendar references.

Compared the references with actual Chromium captures at 1440×1024, including selected dates and the edit inspector. Reviewed 390×844 mobile rendering. Captures and detailed verification are in [the evidence report](docs/evidence/pricing-desk-2026-10-21/README.md).

- Passed: warm ivory content surface, existing brand tokens/type, clear rate hierarchy, inline matrix selection, nightly/monthly switch, project/category/unit scope, two-view navigation, canonical price/occupancy grid and contextual date editor.
- Passed: visible primary apply action in desktop viewport; optional details no longer push it below the fold. Currency inputs use baht; source amounts remain satang. Annual periods and absolute dated edits are explicitly distinguished.
- Passed: keyboard-operable native controls, labels, focus states, table headers, selected-date states, errors/loading/retry/conflict, protected dirty state, viewport-contained horizontal grid scrolling and no mobile document overflow.
- Passed: real category-cell and dated batch saves, monthly preservation, canonical board parity and return navigation. No simulated saves or copied independent price calculation.
- Existing shell was preserved. Property photos were omitted rather than fabricating media for these canonical inventory rows. Existing source season codes have localized labels for standard BASE/HIGH/PEAK/LOW values; unknown custom source names remain unchanged.
- No outstanding P0/P1/P2 issue in the changed flow. P3: unchanged admin-shell navigation has existing mixed-language fallbacks in an empty local content registry, and the development overlay exposes the existing shared synchronous-cookie warning. This does not claim global admin-shell localization or production readiness.
