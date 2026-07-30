# Lead Generation

Finds, qualifies, and enriches prospective Reyse clients. This doc is written for a brand new Claude session (or Morgan) with zero memory of how this was built — read this alongside the "Lead Generation" section of the repo's `CLAUDE.md`, which covers the code map; this covers the "why" and "what changed."

## What it does, in one paragraph

You pick a UK region/town and a search phrase (or a broader web search instead of a map search), hit Search, and it finds candidate business websites, checks each one against Reyse's ideal-customer-profile with an AI call, and saves only the ones that pass as real leads — everything else (booking platforms, agencies, irrelevant businesses) is recorded too, but marked excluded so it never gets re-checked or shown again. From there you can enrich a lead (finds phone/email/Instagram/LinkedIn/Facebook/contact name and writes a one-line personalisation opener), which also automatically verifies the email and Instagram handle it found. Export to CSV when you're ready to actually reach out.

## Why this exists / prior art

The old `reyse` backend (GitHub: `morgankingreysecouk/reyse`, `apps/web/src/app/(super-admin)/super-admin/lead-gen/`) had a real, working version of this. Morgan's own assessment: "did what I wanted but nowhere near as well." A full research pass on that code (30 July 2026) found specific, fixable problems, not just "it could be nicer":

1. **Dedup barely existed.** The database's only uniqueness constraint was on the raw URL string, so `http://x.com`, `https://x.com`, and `https://www.x.com/` all created separate rows for the same business. Nothing stopped the exact same business resurfacing in a later search and re-costing an AI classification call.
2. **Email "verification" only checked MX records existed** — it answers "can this domain receive mail at all," not "does this specific mailbox exist." A catch-all domain (accepts every address, valid or not) read as verified regardless.
3. **A real, live bug**: the "blocked contacts" (do-not-contact) list was a second table, and the CSV export code never actually checked it — despite the UI's own copy claiming blocked contacts were "excluded from exports." They weren't.
4. Search ran off either Google Custom Search or (as a documented-weak fallback) Google Places with plain county-name text, no real coordinates. Everything (classification, enrichment) ran strictly one-at-a-time with fixed sleep delays and no retry logic, so a single transient timeout permanently failed a lead until someone clicked "re-enrich."

This rebuild (30 July 2026) fixes all four directly. See the code-map section of `CLAUDE.md` for exactly where.

## Ideal Customer Profile

Carried over from the old backend's `IDEAL_CUSTOMER_PROFILE.md`, unchanged in substance — this is what `src/lib/leadgen/icp.ts` grounds the classification AI call with (condensed) and what this doc preserves in full for reference.

**The one-line target:** an independent UK holiday rental owner who takes direct bookings through their own website and is missing guest enquiries due to slow (or no) response times.

**Owner profile:** UK-wide (England/Scotland/Wales) + international hosts with UK properties; 1-20 properties; books direct through their own site; established (6+ months) or actively building a direct-booking presence; has or is building a website.

**Best-fit property types:** holiday cottages/rural retreats, coastal/seaside properties, group holiday homes (8-20 person), self-catering villas, glamping/unique properties (Tier 1); urban short-stay apartments, B&Bs, luxury/boutique rentals, pet-friendly properties (Tier 2).

**Disqualifiers — do not target:**
- No website of their own (a bare Airbnb/Booking.com listing isn't a website)
- Ultra-luxury/white-glove operations wanting every interaction personalised by a human
- Fully passive owners paying a full-service property management company for everything
- Tech-averse owners resistant to any website changes or automation
- Very low enquiry volume (fewer than ~3/week) — the problem isn't big enough yet

**Buying triggers worth noting when reviewing a lead:** just launched/redesigned their website, publicly expressing frustration about missed enquiries, growing their property portfolio, running social media without converting it into bookings, or a peak season (summer/Christmas) approaching.

## How search actually works

Two independent channels feed the same pipeline and the same dedup gate — pick either per search, or run both over time to cover more ground.

- **Map search** (`src/lib/leadgen/places.ts`): Google Places Text Search biased to a real lat/lng + radius, then a Place Details call per result to get its website (Places doesn't return a website in the base search response). Coordinates come from `src/lib/leadgen/searchTerms.ts`'s `UK_REGIONS` — a maintained list of real UK holiday-let hotspots grouped by region, not an algorithmically generated grid. Needs `GOOGLE_PLACES_API_KEY` and a billing-enabled Google Cloud project.
- **Web search** (`src/lib/leadgen/customSearch.ts`): Google Custom Search JSON API, free up to 100 queries/day (no billing card), searching the phrase plus the selected town name with known platforms (Airbnb, Booking.com, Sykes, etc.) excluded from the query itself. Needs `GOOGLE_CUSTOM_SEARCH_KEY` and `GOOGLE_CUSTOM_SEARCH_CX` (both already present on the Railway service, carried over from the old backend — confirmed 30 July 2026).

Search phrases (`SEARCH_TERMS` in the same file) span the ICP's Tier 1/2 property types — holiday cottages, self-catering, glamping, luxury rentals, pet-friendly, group accommodation, and more — not one phrase reworded seven ways.

Every candidate goes through the dedup gate (`alreadyKnown()` in `src/app/api/leads/search/route.ts`) *before* the classification AI call fires — a domain that's ever been saved, for any reason, is skipped, not re-checked.

## Classification and enrichment

Classification (`src/lib/leadgen/classify.ts`) is one Claude Haiku call reading the candidate's homepage text against the ICP above, returning `INDEPENDENT` / `PLATFORM` / `IRRELEVANT` plus a short reason. It's instructed to prefer `IRRELEVANT` when genuinely unsure — a false "this is a good lead" costs more than a missed one. Only `INDEPENDENT` leads show up as active by default; `PLATFORM`/`IRRELEVANT` are saved (so they're remembered for dedup) but excluded from view.

Enrichment (`src/lib/leadgen/enrich.ts`) is regex-first (cheap, no AI needed for the common case), falling back to a same-site contact page, then a Claude Haiku call only to fill genuine gaps — never inventing a value that isn't really there. It also writes one short, genuine personalisation line for an outreach message's opening (never mentions Reyse or AI, never invents a fact).

## Verification

- **Email**: MX lookup always runs. On top of that, a best-effort raw SMTP probe (no email actually sent — it stops before the `DATA` command) checks whether the specific mailbox is accepted, and separately probes a random nonexistent address at the same domain to detect a catch-all domain (one that accepts everything). Three real outcomes: `VALID` (mailbox confirmed), `INVALID` (mailbox or domain rejected), `RISKY` (domain exists but the specific mailbox couldn't be confirmed — either it's a catch-all, or the SMTP probe couldn't run at all, e.g. if Railway blocks outbound port 25). **This was unconfirmed at build time** — check a real lead's `emailVerification` after deploy to see whether the probe actually ran.
- **Instagram**: an unauthenticated fetch to the profile URL. Only a genuine 404 counts as invalid, only a genuine 200 counts as valid; anything else (Instagram's bot protection blocking the request, a timeout) stays unverified rather than guessing.

## What's deliberately not built

Outreach/sequence tracking (the old tool's 7-step, 11-day DM/email/SMS cadence tracker) — Morgan's explicit steer for this rebuild. Leads have a simple excluded/active state and nothing else; no cadence tooling, no "today's tasks" panel. Revisit if/when he asks for it.

## Troubleshooting

- **"GOOGLE_PLACES_API_KEY not set" / map search returns 503**: expected until the key is added to this Railway service — see the Env vars list in `CLAUDE.md`'s Lead Generation section. The Custom Search pair (`GOOGLE_CUSTOM_SEARCH_KEY` / `GOOGLE_CUSTOM_SEARCH_CX`) is already set, so web search should work without this.
- **Emails never land on `VALID`, always `RISKY`**: likely means outbound port 25 is blocked on this host, so the SMTP probe can't connect and it's correctly falling back rather than guessing. Confirm by checking server logs for the SMTP connection attempt; if it's always timing out, that confirms the block and the ceiling here is legitimately MX-only, same as the old tool, until/unless a different verification approach is worth adding.
- **A lead you know is independent got saved as `PLATFORM`/`IRRELEVANT`**: check `classificationReason` on the row — the AI's homepage-only read can misjudge a site whose "who we are" signal is on a subpage, or a JS-heavy site with near-empty server-rendered HTML (this fetch doesn't render JavaScript). Manually flip it back with `excluded: false` via a `PATCH /api/leads/[id]`.
