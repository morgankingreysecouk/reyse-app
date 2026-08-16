// Shared homepage fetcher for classify.ts and enrich.ts -- one implementation
// of "get this site's HTML safely" rather than two copies that drift. Spoofs
// a crawler UA (many sites block a bare fetch/no-UA request outright) and
// enforces a hard timeout so one slow/dead site can't stall a whole batch.
const USER_AGENT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

export async function fetchHtml(url: string, timeoutMs = 8000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// One retry on transient failure (timeout, network blip, 5xx) -- the old
// backend's fetch had none at all, so a single slow response permanently
// marked a lead FAILED until a human clicked "re-enrich."
export async function fetchHtmlWithRetry(url: string, timeoutMs = 8000): Promise<string> {
  try {
    return await fetchHtml(url, timeoutMs);
  } catch {
    await new Promise((r) => setTimeout(r, 500));
    return fetchHtml(url, timeoutMs);
  }
}

export function extractText(html: string, maxChars = 6000): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const text = withoutScripts
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, maxChars);
}
