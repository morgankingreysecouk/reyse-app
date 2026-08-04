import { db } from "@/lib/db";

const MAX_FEEDBACK_ENTRIES = 20;

// Compact digest of Morgan's own ratings/notes from the history page, fed
// into every new generation so it actually acts on what he said about past
// posts, not just stores it for his own records. Pulled fresh on every
// generation call (not cached or batched into some periodic job), so
// feedback left minutes ago shapes the very next post generated -- that
// immediacy is the whole point Morgan asked for.
export async function getRecentFeedback(): Promise<string> {
  const rated = await db.socialPost.findMany({
    where: { rating: { not: null }, deletedAt: null },
    orderBy: { ratedAt: "desc" },
    take: MAX_FEEDBACK_ENTRIES,
    select: { rating: true, ratingNote: true, pillar: true, platform: true, caption: true },
  });

  if (rated.length === 0) return "";

  const lines = rated.map((p) => {
    const snippet = p.caption.slice(0, 70).replace(/\s+/g, " ").trim();
    const ellipsis = p.caption.length > 70 ? "..." : "";
    const note = p.ratingNote?.trim() ? ` -- Morgan's note: "${p.ratingNote.trim()}"` : "";
    return `- [${p.rating}/10, ${p.pillar}, ${p.platform}] "${snippet}${ellipsis}"${note}`;
  });

  return `MORGAN'S FEEDBACK ON RECENT POSTS (most recent first) -- this is real signal from the person you're writing for, not background reading. Genuinely act on it: don't repeat the pattern in anything rated low, lean into whatever's been rated high. A number with no note is still real signal even without an explanation of why.
${lines.join("\n")}`;
}
