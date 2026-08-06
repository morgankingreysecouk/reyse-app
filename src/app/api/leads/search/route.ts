import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeDomain, canonicalUrl } from "@/lib/leadgen/normalize";
import { searchPlaces, placesConfigured } from "@/lib/leadgen/places";
import { searchCustomSearch, customSearchConfigured } from "@/lib/leadgen/customSearch";
import { classifySite } from "@/lib/leadgen/classify";
import { cseCallsRemainingToday } from "@/lib/leadgen/usage";
import { UK_REGIONS, SEARCH_TERMS, type RegionPoint } from "@/lib/leadgen/searchTerms";

// Uses `net`/`dns`-adjacent modules transitively via shared lib code and
// holds a long-lived stream -- needs the real Node runtime, not edge.
export const runtime = "nodejs";

interface SseWriter {
  send(event: Record<string, unknown>): void;
  close(): void;
}

function makeStream(): { stream: ReadableStream; writer: SseWriter } {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController;
  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
    },
  });
  const writer: SseWriter = {
    send(event) {
      try {
        controllerRef.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      } catch {
        // Controller already closed (client disconnected) -- nothing to do.
      }
    },
    close() {
      try {
        controllerRef.close();
      } catch {
        // Already closed.
      }
    },
  };
  return { stream, writer };
}

// The dedup gate every candidate passes through before a classification call
// (money/quota) is ever spent on it. A domain that has EVER been saved --
// found before, excluded, contacted, doesn't matter -- is permanently
// remembered and skipped here, not just hidden in the UI afterward.
async function alreadyKnown(domain: string): Promise<boolean> {
  const existing = await db.lead.findUnique({ where: { domain }, select: { id: true } });
  return !!existing;
}

interface Candidate {
  name: string;
  url: string;
  domain: string;
  location: string | null;
}

// One town + one search phrase. A whole-county run is every point in the
// region crossed with every phrase in SEARCH_TERMS -- Morgan's explicit
// call (5 Aug 2026) was "every phrase, every town" for maximum coverage over
// a manual per-town/per-phrase search, knowing that costs roughly 14x more
// of the monthly safety-cap allowance per county than a single search did.
// Safe to run this large regardless: searchPlaces/searchCustomSearch already
// check the real usage caps before every single call they make, so this
// loop can never push past them -- it can only find out sooner.
async function runOneCombo(
  mode: "places" | "cse",
  point: RegionPoint,
  term: string
): Promise<{ candidates: Candidate[]; cappedMessage: string | null }> {
  if (mode === "places") {
    const result = await searchPlaces({ query: term, lat: point.lat, lng: point.lng });
    const cappedMessage = result.cappedTextSearch
      ? "Reached this month's Places search safety cap -- stopping here so it can never cost money. Resets next calendar month."
      : result.cappedDetails
        ? "Reached this month's Places website-lookup safety cap -- stopping here so it can never cost money. Resets next calendar month."
        : null;
    return { candidates: result.candidates, cappedMessage };
  }

  const remaining = await cseCallsRemainingToday();
  if (remaining <= 0) {
    return {
      candidates: [],
      cappedMessage: "Reached today's free web-search limit (100/day) -- stopping here so it can never cost money. Resets tomorrow.",
    };
  }
  const candidates = (await searchCustomSearch({ query: `${term} ${point.name}` })).map((c) => ({ ...c, location: null }));
  return { candidates, cappedMessage: null };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const params = request.nextUrl.searchParams;
  const mode = params.get("mode"); // "places" | "cse"
  const regionName = params.get("region");
  const collectionId = params.get("collectionId") || null;

  if (!regionName || (mode !== "places" && mode !== "cse")) {
    return new Response("Missing or invalid region/mode", { status: 400 });
  }
  const region = UK_REGIONS.find((r) => r.name === regionName);
  if (!region) return new Response("Unknown region -- pick one from the list.", { status: 400 });

  if (mode === "places" && !placesConfigured()) {
    return new Response("GOOGLE_PLACES_API_KEY not set on this environment yet.", { status: 503 });
  }
  if (mode === "cse" && !customSearchConfigured()) {
    return new Response("GOOGLE_CUSTOM_SEARCH_KEY / GOOGLE_CUSTOM_SEARCH_CX not set on this environment yet.", { status: 503 });
  }

  const { stream, writer } = makeStream();

  (async () => {
    try {
      const combos: { point: RegionPoint; term: string }[] = [];
      for (const point of region.points) {
        for (const term of SEARCH_TERMS) combos.push({ point, term });
      }

      writer.send({
        type: "status",
        message: `Searching all of ${region.name}: ${region.points.length} towns x ${SEARCH_TERMS.length} phrases (${combos.length} searches). This can take a while.`,
      });

      let candidatesFound = 0;
      let saved = 0;
      let skipped = 0;
      let combosRun = 0;

      comboLoop: for (const { point, term } of combos) {
        if (request.signal.aborted) break;
        combosRun++;

        writer.send({
          type: "status",
          message: `[${combosRun}/${combos.length}] ${point.name} -- "${term}"`,
        });

        const { candidates, cappedMessage } = await runOneCombo(mode, point, term);
        candidatesFound += candidates.length;

        for (const candidate of candidates) {
          if (request.signal.aborted) break comboLoop;

          const domain = normalizeDomain(candidate.url) ?? candidate.domain;
          if (await alreadyKnown(domain)) {
            skipped++;
            writer.send({ type: "skipped", domain, name: candidate.name, reason: "Already known from a previous search." });
            continue;
          }

          let classification: "INDEPENDENT" | "PLATFORM" | "IRRELEVANT" | "ERROR";
          let classificationReason: string;
          try {
            const result = await classifySite(candidate.url);
            classification = result.classification;
            classificationReason = result.reason;
          } catch (err) {
            classification = "ERROR";
            classificationReason = err instanceof Error ? err.message : "Homepage unreachable.";
          }

          // ERROR (homepage unreachable at classification time) is NOT
          // excluded -- only a genuine PLATFORM/IRRELEVANT verdict is. A site
          // that happened to be down during this search might be a perfectly
          // good independent lead; permanently hiding it (the dedup gate
          // above means its domain can never be re-classified later) would
          // silently lose a real lead to a transient blip. It stays visible,
          // clearly badged, so a human can judge it.
          const isDisqualified = classification === "PLATFORM" || classification === "IRRELEVANT";

          let lead;
          try {
            lead = await db.lead.create({
              data: {
                domain,
                url: canonicalUrl(domain),
                name: candidate.name,
                location: candidate.location ?? point.name,
                source: mode === "places" ? "PLACES" : "CUSTOM_SEARCH",
                classification,
                classificationReason,
                collectionId,
                excluded: isDisqualified,
                excludedReason: isDisqualified ? classificationReason : null,
              },
            });
          } catch (err) {
            // Unique constraint on `domain` -- another concurrent search (a
            // double-click, or two overlapping runs, or the same business
            // turning up under a different town/phrase combo later in this
            // same run) already saved this exact domain. Treat it as a
            // dedup skip rather than letting one race crash the whole run.
            if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
              skipped++;
              writer.send({ type: "skipped", domain, name: candidate.name, reason: "Saved earlier in this same run." });
              continue;
            }
            throw err;
          }

          saved++;
          writer.send({ type: "classified", lead });
        }

        if (cappedMessage) {
          writer.send({ type: "capped", message: cappedMessage });
          break;
        }
      }

      writer.send({
        type: "done",
        stats: { candidatesFound, saved, skippedDuplicates: skipped, combosRun, combosTotal: combos.length },
      });
    } catch (err) {
      writer.send({ type: "error", message: err instanceof Error ? err.message : "Search failed." });
    } finally {
      writer.close();
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
