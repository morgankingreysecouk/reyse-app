import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { enrichLead } from "@/lib/leadgen/enrich";
import type { Lead, Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";

// How many leads get enriched at once. The old backend did this one at a
// time with a fixed sleep between each -- for a real batch that meant tens
// of minutes of wall-clock time for a few hundred leads. A small concurrency
// pool is the fix without hammering target sites or the Anthropic API into
// rate limits.
const CONCURRENCY = 4;

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>, concurrency: number): Promise<void> {
  let index = 0;
  async function next(): Promise<void> {
    const i = index++;
    if (i >= items.length) return;
    await worker(items[i]!);
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
}

function makeStream() {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController;
  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
    },
  });
  return {
    stream,
    send(event: Record<string, unknown>) {
      try {
        controllerRef.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      } catch {
        // Client disconnected.
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
}

// Re-fetches homepage + regex/AI extraction + email/Instagram verification
// for one or more leads, streamed as SSE progress. force=true re-enriches
// leads that already have a status, not just PENDING ones (the "re-enrich"
// action) -- one retry on a transient failure already happens inside
// enrichLead itself, this is the manual "try again later" path on top of that.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const params = request.nextUrl.searchParams;
  const leadId = params.get("leadId");
  const collectionId = params.get("collectionId");
  const force = params.get("force") === "true";

  const where: Prisma.LeadWhereInput = { excluded: false, classification: "INDEPENDENT" };
  if (leadId) where.id = leadId;
  if (collectionId) where.collectionId = collectionId;
  if (!force) where.enrichmentStatus = "PENDING";

  const leads = await db.lead.findMany({ where });
  if (leads.length === 0) {
    return new Response("No matching leads to enrich.", { status: 404 });
  }

  const { stream, send, close } = makeStream();

  (async () => {
    send({ type: "status", message: `Enriching ${leads.length} lead(s)...` });
    let done = 0;

    await runPool(
      leads,
      async (lead: Lead) => {
        // A disconnected client (closed tab, navigated away) shouldn't
        // still burn Anthropic API cost and outbound fetches for leads not
        // yet started -- work already in flight for other leads in the
        // pool still finishes, this just stops starting new ones.
        if (request.signal.aborted) return;
        try {
          const result = await enrichLead({ url: lead.url, domain: lead.domain, name: lead.name });
          const updated = await db.lead.update({
            where: { id: lead.id },
            data: { ...result, enrichedAt: new Date() },
          });
          done++;
          send({ type: "progress", lead: updated, done, total: leads.length });
        } catch (err) {
          done++;
          send({
            type: "progress-error",
            leadId: lead.id,
            message: err instanceof Error ? err.message : "Enrichment failed.",
            done,
            total: leads.length,
          });
        }
      },
      CONCURRENCY,
    );

    send({ type: "done", total: leads.length });
    close();
  })();

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
