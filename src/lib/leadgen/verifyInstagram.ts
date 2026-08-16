import type { LeadInstagramVerification } from "@/generated/prisma/client";

export interface InstagramVerifyResult {
  verification: LeadInstagramVerification;
  reason: string;
}

// Instagram doesn't offer a public API for this without app review/OAuth, so
// this is a best-effort unauthenticated check, same constraint the old
// backend had. The old version used a HEAD request and treated ANY network
// error as "probably fine, keep it" -- that's too generous: a 403 from
// Instagram's bot protection isn't evidence the profile exists. This is
// stricter: only a genuine 404 counts as INVALID, only a genuine 200 counts
// as VALID, and anything else (blocked, rate-limited, timed out) is left
// UNVERIFIED rather than guessed either way.
export async function verifyInstagram(profileUrl: string): Promise<InstagramVerifyResult> {
  let handle: string;
  try {
    handle = new URL(profileUrl).pathname.replace(/^\//, "").replace(/\/$/, "").split("/")[0] ?? "";
  } catch {
    return { verification: "UNVERIFIED", reason: "Not a valid URL." };
  }
  if (!handle) return { verification: "UNVERIFIED", reason: "No handle in URL." };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`https://www.instagram.com/${handle}/`, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      },
    });
    if (res.status === 404) return { verification: "INVALID", reason: "Instagram returned 404 -- handle does not exist." };
    if (res.status === 200) return { verification: "VALID", reason: "Instagram profile page loaded successfully." };
    return { verification: "UNVERIFIED", reason: `Instagram returned ${res.status} -- likely bot protection, not evidence either way.` };
  } catch {
    return { verification: "UNVERIFIED", reason: "Request to Instagram failed or timed out." };
  } finally {
    clearTimeout(timer);
  }
}
