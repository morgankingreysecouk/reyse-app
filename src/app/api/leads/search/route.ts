import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeDomain, canonicalUrl } from "@/lib/leadgen/normalize";
import { searchPlaces, placesConfigured } from "@/lib/leadgen/places";
import { searchCustomSearch, customSearchConfigured } from "@/lib/leadgen/customSearch";
import { classifySite } from "@/lib/leadgen/classify";

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

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const params = request.nextUrl.searchParams;
  const mode = params.get("mode"); // "places" | "cse"
  const queryText = params.get("query");
  const collectionId = params.get("collectionId") || null;
  const lat = params.get("lat");
  const lng = params.get("lng");

  if (!queryText || (mode !== "places" && mode !== "cse")) {
    return new Response("Missing or invalid query/mode", { status: 400 });
  }
  if (mode === "places" && (!lat || !lng)) {
    return new Response("Places search requires lat/lng", { status: 400 });
  }
  if (mode === "places" && !placesConfigured()) {
    return new Response("GOOGLE_PLACES_API_KEY not set on this environment yet.", { status: 503 });
  }
  if (mode === "cse" && !customSearchConfigured()) {
    return new Response("GOOGLE_CUSTOM_SEARCH_KEY / GOOGLE_CUSTOM_SEARCH_CX not set on this environment yet.", { status: 503 });
  }

  const { stream, writer } = makeStream();

  (async () => {
    try {
      writer.send({ type: "status", message: `Searching "${queryText}"...` });

      let candidates: { name: string; url: string; domain: string; location: string | null }[];
      if (mode === "places") {
        const result = await searchPlaces({ query: queryText, lat: Number(lat), lng: Number(lng) });
        candidates = result.candidates;
        if (result.cappedTextSearch) {
          writer.send({
            type: "status",
            message: "Reached this month's Places search safety cap -- stopping here so it can never cost money. Resets next calendar month.",
          });
        } else if (result.cappedDetails) {
          writer.send({
            type: "status",
            message: "Reached this month's Places website-lookup safety cap -- some businesses were found but their websites couldn't be checked. Resets next calendar month.",
          });
        }
      } else {
        candidates = (await searchCustomSearch({ query: queryText })).map((c) => ({ ...c, location: null }));
      }

      writer.send({ type: "status", message: `Found ${candidates.length} candidate site(s), checking each...` });

      let saved = 0;
      let skipped = 0;

      for (const candidate of candidates) {
        if (request.signal.aborted) break;

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
              location: candidate.location,
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
          // double-click, or two overlapping runs) already saved this exact
          // domain between our alreadyKnown() check and this write. Treat it
          // as a dedup skip rather than letting one race crash the whole
          // remaining search.
          if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
            skipped++;
            writer.send({ type: "skipped", domain, name: candidate.name, reason: "Saved by a concurrent search just now." });
            continue;
          }
          throw err;
        }

        saved++;
        writer.send({ type: "classified", lead });
      }

      writer.send({
        type: "done",
        stats: { candidatesFound: candidates.length, saved, skippedDuplicates: skipped },
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
