// Condensed from IDEAL_CUSTOMER_PROFILE.md (carried over from the old
// backend, full doc at docs/lead-gen.md in this repo) -- the grounding both
// classify.ts and enrich.ts's personalisation prompt use so "high quality"
// means the same thing everywhere in this feature, not a vague AI guess.
export const ICP_SUMMARY = `Target: an independent UK holiday-let owner who takes direct bookings through their OWN website (not just Airbnb/Booking.com), typically 1-20 properties, self-managed or small-team.

Best-fit property types: holiday cottages, coastal/seaside rentals, group holiday homes (8-20 person), self-catering villas, glamping/unique stays, urban short-stay apartments, B&Bs, luxury/boutique rentals, pet-friendly properties.

Disqualifiers -- NOT a good lead even if independent:
- No real website of their own (a bare Airbnb/Booking.com listing page is not a website)
- Ultra-luxury/white-glove operations wanting every interaction personalised by a human
- Fully passive owners paying a full-service property management company for everything
- The site itself IS a booking platform/agency representing many unrelated owners, not a single owner's own properties`;
