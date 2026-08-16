import { db } from "@/lib/db";

// Google Custom Search's free tier is a hard 100 queries/day -- once that's
// gone for the day, further calls start costing money, so this cap keeps
// the free-tier promise honest rather than silently spending.
export const CSE_DAILY_FREE_LIMIT = 100;

// Google Places (New) free tiers reset monthly, against the Cloud Billing
// account's own cycle -- a date this app has no way to know. Rather than
// track the exact real free allowance (Text Search Pro: 5,000/month, Place
// Details Enterprise: 1,000/month) and risk a mismatch putting a call on
// the wrong side of it, these caps sit deliberately below the real
// allowance as a safety margin. Morgan was explicit this must never cost
// money -- hitting a cap stops that call type for the rest of the month,
// full stop, rather than ever letting a call through that might be billed.
export const PLACES_TEXT_SEARCH_MONTHLY_CAP = 4000;
export const PLACES_DETAILS_MONTHLY_CAP = 800;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function thisMonth(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

async function getOrCreateToday() {
  const date = today();
  return db.leadSearchUsage.upsert({
    where: { date },
    create: { date },
    update: {},
  });
}

async function getOrCreateThisMonth() {
  const month = thisMonth();
  return db.leadPlacesMonthlyUsage.upsert({
    where: { month },
    create: { month },
    update: {},
  });
}

export async function getUsageToday() {
  return getOrCreateToday();
}

export async function incrementUsage(field: "placesCalls" | "cseCalls" | "classifyCalls", by = 1) {
  const date = today();
  await db.leadSearchUsage.upsert({
    where: { date },
    create: { date, [field]: by },
    update: { [field]: { increment: by } },
  });
}

export async function cseCallsRemainingToday(): Promise<number> {
  const usage = await getOrCreateToday();
  return Math.max(0, CSE_DAILY_FREE_LIMIT - usage.cseCalls);
}

export async function placesTextSearchCallsRemainingThisMonth(): Promise<number> {
  const usage = await getOrCreateThisMonth();
  return Math.max(0, PLACES_TEXT_SEARCH_MONTHLY_CAP - usage.textSearchCalls);
}

export async function placeDetailsCallsRemainingThisMonth(): Promise<number> {
  const usage = await getOrCreateThisMonth();
  return Math.max(0, PLACES_DETAILS_MONTHLY_CAP - usage.placeDetailsCalls);
}

export async function incrementPlacesUsage(field: "textSearchCalls" | "placeDetailsCalls", by = 1) {
  const month = thisMonth();
  await db.leadPlacesMonthlyUsage.upsert({
    where: { month },
    create: { month, [field]: by },
    update: { [field]: { increment: by } },
  });
  // Keep the informational daily log in sync too, for the existing
  // per-day visibility this app already had.
  await incrementUsage("placesCalls", by);
}
