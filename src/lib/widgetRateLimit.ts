// Best-effort per-IP-per-client rate limiter for the public widget message
// endpoint -- ported from Reyse-Website's api/_lib/rateLimit.ts (same
// sliding-window approach, same honest limitations), adapted from Vercel's
// VercelRequest to Next's NextRequest and keyed by widgetKey too, not just
// IP, so one client's traffic can never eat into another's allowance.
//
// One real improvement over the ported original: reyse-app runs as a single
// persistent Railway process (not Vercel's per-instance, cold-start-reset
// serverless functions), so this in-memory map actually holds for the
// process's whole lifetime instead of resetting constantly -- more reliable
// for free, not just a like-for-like port.

const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  return ip || "unknown";
}

// Returns true if this request should be rejected. `limit` is the maximum
// number of requests allowed per widgetKey+IP pair in the trailing 60-second
// window.
export function isWidgetRateLimited(request: Request, widgetKey: string, limit: number): boolean {
  const key = `${widgetKey}:${clientIp(request)}`;
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }

  recent.push(now);
  hits.set(key, recent);

  // Opportunistic cleanup so the map doesn't grow unbounded over the
  // process's long lifetime -- cheap, only runs a small fraction of calls.
  if (hits.size > 5000 && Math.random() < 0.01) {
    for (const [k, timestamps] of hits) {
      const fresh = timestamps.filter((t) => t > cutoff);
      if (fresh.length === 0) hits.delete(k);
      else hits.set(k, fresh);
    }
  }

  return false;
}
