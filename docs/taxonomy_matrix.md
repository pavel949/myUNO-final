# Taxonomy matrix — first 10 life situations & industry flows

This matrix lists the first 10 industries / life situations we will seed, with attributes for discovery, booking, calendar needs, concierge escalation, and special meta fields. Each entry is designed so discovery, search filters, and booking flows behave like Klook/Viator for experiences and leaders for verticals like flowers and yachts.

1) Flowers & Same-Day Delivery
- Discovery tags: occasion (birthday, funeral, anniversary), deliveryWindow, recipientLocation
- Booking flow: choose bouquet (catalog), choose delivery date/time window, add recipient details, confirm
- Calendar: delivery windows; no multi-day calendar
- Concierge: low — only for high-value or custom arrangements
- Meta: { bouquetVariantId, vaseRequired, cardMessage }

2) Yacht Charter
- Discovery tags: capacity, duration, amenities, harbor
- Booking flow: inquiry -> availability check with provider -> quote -> deposit/booking
- Calendar: multi-day availability + seasonal rules
- Concierge: high — concierge handles itinerary, provisioning
- Meta: { berthCount, captainIncluded, fuelPolicy, cancellationWindow }

3) Home Services (Plumbing, Electric, Cleaning)
- Discovery tags: serviceType, urgency, locationRadius
- Booking flow: select service + add address + choose time slot + confirm
- Calendar: slot booking, provider capacity per slot
- Concierge: medium — escalate on complex or recurring jobs
- Meta: { estimatedDurationMinutes, requiresAccessInstructions }

4) Tours & Experiences
- Discovery tags: language, duration, groupSize, startPoint
- Booking flow: choose date, choose ticket qty, immediate payment
- Calendar: date-based availability
- Concierge: medium — assists on custom requests
- Meta: { meetingPoint, voucherPolicy }

5) Transfers (Airport/Point-to-Point)
- Discovery tags: vehicleType, passengerCount, luggageCount
- Booking flow: pick pickup/dropoff, time or flight number, immediate payment
- Calendar: time-based slot
- Concierge: medium — monitor flight delays
- Meta: { flightNumber, pickupTerminal }

6) Catering & Events
- Discovery tags: cuisine, guestCount, serviceStyle
- Booking flow: inquiry -> menu selection -> quote -> deposit
- Calendar: multi-day booking and setup windows
- Concierge: high — events coordinator
- Meta: { guestEstimate, menuSelections, venueAccess }

7) Health & Wellness (Therapy, Massage)
- Discovery tags: therapist, duration, modality
- Booking flow: date/time slot, practitioner selection, intake form
- Calendar: slot booking, practitioner availability
- Concierge: medium — for special accommodations
- Meta: { intakeFormId, requiredEquipment }

8) Private Chef / In-Home Dining
- Discovery tags: cuisine, partySize, dietaryRestrictions
- Booking flow: inquiry -> menu selection -> availability -> deposit
- Calendar: date-based with prep windows
- Concierge: high — menu planning and groceries
- Meta: { menuId, dietaryRestrictions }

9) Luxury Goods Rental (Cars, Watches)
- Discovery tags: model, rentalDuration, delivery/collection
- Booking flow: availability check, deposit, ID/KYC for high value
- Calendar: multi-day rentals
- Concierge: high — delivery logistics
- Meta: { modelYear, securityDepositCents }

10) Personal Assistance / Errands
- Discovery tags: taskType, estimatedDuration, location
- Booking flow: select slot, provide task details, confirm
- Calendar: short slot bookings
- Concierge: medium-high — for complex errands or subscriptions
- Meta: { taskInstructions, accessNotes }

General booking rules for all industries:
- All bookings create a ServiceOrder and ServiceOrderEvent entries
- Bookings snapshot price and commissionCents
- Providers must have ProviderProfile with payout instructions before accepting bookings
- For high-touch industries (yacht, events, catering, private chef), booking is inquiry-first (PENDING -> QUOTE -> PAID)
- For commodity services (flowers, transfers, tours) support immediate capture

Concierge & inquiries
- Any booking can be marked as 'needs_concierge' by provider or consumer. That triggers a ticket in the comms/ticketing system and assigns to concierge queue.
- The concierge can convert inquiry to booked order with admin tools.

This matrix will be seeded into ServiceTaxonomy and a handful of sample Service.meta JSONs via the seed script.
