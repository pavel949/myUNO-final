# Homepage visual review — 2026-10-02

Evidence: supplied Android screenshots, current public production DOM and desktop rendering, source inspection, and the supplied App design system project (8)(1).zip. The reference uses IQI branding; myUNO retains its own identity and canonical operating model.

## Defects and changes

- Project card anchors rendered inline with zero height in production. Their absolutely positioned images and white text escaped the card and overlapped the collection introduction. Make the card a full-height block, retain a dark fallback surface, and give mobile cards explicit minimum heights.
- Use one project column on narrow screens, two from small screens, and the featured grid on desktop. Wrap price/action content.
- Service cards used two narrow mobile columns and a nonshrinking badge beside the title. Use one mobile column and stack/wrap the heading and badge.
- Reduce the washed-out hero overlay and restore photo saturation. Remove the desktop height cap so expanded search controls remain contained.
- Use two mobile search-mode columns, touch-sized wrapping project chips, and a bounded scroll region. Locations remain the primary selector.
- Reduce oversized owner/developer card minimum heights.

## Reference coverage and limits

| Reference area | Current coverage |
| --- | --- |
| Hero, intent search, project/stay/service sections, owner/developer entry points | Present; visual corrections included in this change |
| Rent/Buy filters, separate project selection, branded calendar | Implemented in PR 171; not yet on the inspected production homepage |
| Listing submission vs myUNO management request | Separate routes and private supplier settings implemented in PR 171 |
| Booking, client, guest, owner and operations journeys | Existing routes/modules; not verified end to end in this review |
| Video library, sourced market indicators, dedicated seller/investor portal | Not complete; homepage styling does not close these product gaps |
| All translations and real inventory/media | Incomplete: inspected production contains English fallback copy and illustrative seed media |

Do not import unsubstantiated Passport, legal verification, market statistics or inclusive-price promises from the reference. Service-specific photography requires real suitable media; stock residence photographs remain explicitly illustrative.

Validation: repository lint and production build passed; 16 focused discovery/calendar tests passed. Current production inspection confirmed the zero-height project-card defect. Updated deployed mobile rendering and authenticated/database-backed journeys still require runtime verification; passing a build is not full design/flow parity.
