# Design execution plan (working document)

This document turns the completed design system spec (`docs/06_design_system.md`) into an execution queue that can be implemented, reviewed, and shipped in small safe increments.

## Scope

- Source of truth for visual language: `docs/06_design_system.md`
- Source of truth for pages and flows: `docs/07_flows.md`, `docs/08_pages.md`
- This file tracks *execution order* and *delivery status*.

## Execution rules

1. Do not invent new colors, typography, spacing, or components outside the design system.
2. Keep copy in content keys (`getLabels`/`t`) and avoid inline UI text.
3. Ship in vertical slices with verification after each slice.
4. Prefer low-risk UI polish that improves clarity before structural UI rewrites.

## Queue

### D-01 · Login surface polish (done)

Goal: keep current auth flow, improve first impression and clarity.

Delivered in this pass:
- Better login card layout and spacing for mobile/desktop balance.
- Stronger visual hierarchy in heading/subtitle spacing.
- Clear error mapping for known auth failures (`invalid_credentials`, `rate_limited`).
- Inline form-level error block for visibility.

### D-02 · Admin shell visual consistency (pending)

Goal: align admin cards/tables/nav rhythm with the documented tokens and spacing scale.

Planned:
- Normalize section spacing (`16/24/32`) and card paddings.
- Standardize table empty/loading/error states.
- Align tile hover/elevation behavior.

### D-03 · Browse/listing card consistency (pending)

Goal: ensure listing cards share one visual contract across public browsing surfaces.

Planned:
- Consistent media ratio and title/meta stack.
- Shared price/rating row treatment.
- Consistent skeleton and empty states.

### D-04 · Form UX consistency (pending)

Goal: unify labels, help text, errors, and button rhythm across auth/admin/service forms.

Planned:
- Field spacing and required marker consistency.
- Error placement and tone consistency.
- Submit/loading button behavior consistency.

## Verification checklist (run on each design slice)

- [ ] Mobile viewport sanity check
- [ ] Desktop viewport sanity check
- [ ] Keyboard focus visibility
- [ ] Empty/loading/error state checks
- [ ] No broken content keys
- [ ] Lint/typecheck/tests relevant to edited surface
