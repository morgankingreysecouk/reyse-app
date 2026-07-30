import { db } from "@/lib/db";

// Google Custom Search's free tier is a hard 100 queries/day -- once that's
// gone for the day, further calls start costing money, so this cap keeps
// the free-tier promise honest rather than silently spending. Places has no
// comparable daily free count (it draws down the $200/month credit
// continuously), so it isn't capped here -- see places.ts for its own
// lighter per-run guard instead.
export const CSE_DAILY_FREE_LIMIT = 100;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getOrCreateToday() {
  const date = today();
  return db.leadSearchUsage.upsert({
    where: { date },
    create: { date },
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
