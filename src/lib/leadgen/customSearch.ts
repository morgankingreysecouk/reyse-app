import { normalizeDomain } from "./normalize";
import { incrementUsage, cseCallsRemainingToday } from "./usage";
import { PLATFORM_EXCLUSIONS } from "./searchTerms";

export interface SearchCandidate {
  name: string;
  url: string;
  domain: string;
}

// GOOGLE_CUSTOM_SEARCH_CX -- not GOOGLE_CSE_ID -- matches the variable name
// already sitting in this Railway project from the old backend (named after
// Google's own API parameter, "cx", rather than "CSE ID"). Kept as the
// existing name deliberately so nothing needs adding/renaming in Railway.
const CSE_KEY = () => process.env.GOOGLE_CUSTOM_SEARCH_KEY;
const CSE_ID = () => process.env.GOOGLE_CUSTOM_SEARCH_CX;

export function customSearchConfigured(): boolean {
  return !!(CSE_KEY() && CSE_ID());
}

interface CseItem {
  title: string;
  link: string;
}
interface CseResponse {
  items?: CseItem[];
  error?: { message?: string };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Broader web-search channel, complementing Places -- catches independent
// sites that don't have a Google Business/Maps listing at all. Genuinely
// free: 100 queries/day, no billing account required. Each query returns up
// to 10 results; pagination via `start` up to Google's own 100-result cap
// per query, same as the old backend, but this respects the *daily* free
// quota rather than just the per-call cap, so it won't silently start
// costing money once the free 100 is used up today.
export interface CustomSearchResult {
  candidates: SearchCandidate[];
  // Non-null if a page request itself failed -- see the matching field on
  // PlacesSearchResult for why this exists: without it, a broken key and a
  // genuinely empty result set are indistinguishable, and whatever
  // candidates an earlier page in the same call already turned up would
  // otherwise be silently discarded by throwing.
  error: string | null;
}

export async function searchCustomSearch(params: {
  query: string;
  maxResults?: number;
}): Promise<CustomSearchResult> {
  const key = CSE_KEY();
  const cx = CSE_ID();
  if (!key || !cx) throw new Error("GOOGLE_CUSTOM_SEARCH_KEY / GOOGLE_CUSTOM_SEARCH_CX not set");

  const exclusions = PLATFORM_EXCLUSIONS.map((d) => `-site:${d}`).join(" ");
  const fullQuery = `${params.query} ${exclusions}`;

  const candidates: SearchCandidate[] = [];
  const seenDomains = new Set<string>();
  const maxResults = params.maxResults ?? 30;
  let error: string | null = null;

  let start = 1;
  while (candidates.length < maxResults && start <= 91) {
    const remaining = await cseCallsRemainingToday();
    if (remaining <= 0) break;

    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", key);
    url.searchParams.set("cx", cx);
    url.searchParams.set("q", fullQuery);
    url.searchParams.set("start", String(start));

    const res = await fetch(url.toString());
    await incrementUsage("cseCalls");
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      error = `Custom Search HTTP ${res.status}${bodyText ? ` -- ${bodyText.slice(0, 300)}` : ""}`;
      break;
    }
    const data = (await res.json()) as CseResponse;
    if (data.error) {
      error = `Custom Search error: ${data.error.message ?? "unknown"}`;
      break;
    }

    const items = data.items ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      const domain = normalizeDomain(item.link);
      if (!domain || seenDomains.has(domain)) continue;
      seenDomains.add(domain);
      candidates.push({ name: item.title, url: item.link, domain });
    }

    start += 10;
    await sleep(150);
  }

  return { candidates, error };
}
