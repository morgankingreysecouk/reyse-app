import { db } from "@/lib/db";
import type { CalendarBlockSource } from "@/generated/prisma/client";

export interface CalendarEventInput {
  externalUid: string;
  startDate: Date;
  endDate: Date;
}

export interface BlockSyncResult {
  upserted: number;
  unchanged: number;
  deleted: number;
}

// Shared by ical.ts and google.ts -- both need the exact same "upsert on
// externalUid, delete whatever's no longer in the fetched set" diff
// against CalendarBlock for their own import source, so this is one
// function rather than two near-duplicate implementations. Skips writing
// (and therefore bumping updatedAt) for a block whose dates haven't
// actually changed since the last sync -- verified directly in the
// credential-free runbook, not just assumed.
export async function syncCalendarBlocks(
  propertyId: string,
  source: CalendarBlockSource,
  events: CalendarEventInput[],
): Promise<BlockSyncResult> {
  const existing = await db.calendarBlock.findMany({ where: { propertyId, source } });
  const existingByUid = new Map(existing.map((b) => [b.externalUid, b]));
  const incomingUids = new Set(events.map((e) => e.externalUid));

  let upserted = 0;
  let unchanged = 0;
  for (const event of events) {
    const current = existingByUid.get(event.externalUid);
    if (current && current.startDate.getTime() === event.startDate.getTime() && current.endDate.getTime() === event.endDate.getTime()) {
      unchanged++;
      continue;
    }
    await db.calendarBlock.upsert({
      where: { propertyId_externalUid: { propertyId, externalUid: event.externalUid } },
      create: { propertyId, source, externalUid: event.externalUid, startDate: event.startDate, endDate: event.endDate },
      update: { startDate: event.startDate, endDate: event.endDate },
    });
    upserted++;
  }

  // Anything of this source no longer in the fetched set is gone from the
  // real calendar (a cancellation) -- delete it so the dates free up.
  // Never touches blocks from a different source (e.g. REYSE_BOOKING),
  // since those aren't part of what this particular sync fetched.
  const toDelete = existing.filter((b) => !incomingUids.has(b.externalUid));
  if (toDelete.length > 0) {
    await db.calendarBlock.deleteMany({ where: { id: { in: toDelete.map((b) => b.id) } } });
  }

  return { upserted, unchanged, deleted: toDelete.length };
}
