import { normalizeDomain } from "./normalize";
import { incrementUsage } from "./usage";

export interface PlaceCandidate {
  name: string;
  url: string;
  domain: string;
  location: string | null;
}

const PLACES_KEY = () => process.env.GOOGLE_PLACES_API_KEY;

export function placesConfigured(): boolean {
  return !!PLACES_KEY();
}

interface TextSearchResult {
  place_id: string;
  name: string;
  formatted_address?: string;
}

interface TextSearchResponse {
  results: TextSearchResult[];
  next_page_token?: string;
  status: string;
  error_message?: string;
}

interface DetailsResponse {
  result?: { website?: string };
  status: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Real map search: Places Text Search biased to a lat/lng + radius (not a
// free-text place name the API has to re-geocode itself, which is what the
// old backend's Places fallback did). Text Search doesn't return a
// business's website in the base response, so each candidate needs a
// follow-up Details call -- that's the real cost driver, so results with no
// website are dropped before that call ever fires where possible (Details
// is called per place_id regardless since Text Search alone can't tell us
// whether a website exists).
export async function searchPlaces(params: {
  query: string;
  lat: number;
  lng: number;
  radiusMeters?: number;
  maxPages?: number;
}): Promise<PlaceCandidate[]> {
  const key = PLACES_KEY();
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY not set");

  const radius = params.radiusMeters ?? 20000;
  const maxPages = params.maxPages ?? 2;
  const candidates: PlaceCandidate[] = [];
  const seenPlaceIds = new Set<string>();

  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    if (pageToken) {
      url.searchParams.set("pagetoken", pageToken);
    } else {
      url.searchParams.set("query", params.query);
      url.searchParams.set("location", `${params.lat},${params.lng}`);
      url.searchParams.set("radius", String(radius));
      url.searchParams.set("region", "uk");
    }
    url.searchParams.set("key", key);

    // Google requires a short delay before a next_page_token becomes valid.
    if (pageToken) await sleep(2000);

    const res = await fetch(url.toString());
    await incrementUsage("placesCalls");
    if (!res.ok) break;
    const data = (await res.json()) as TextSearchResponse;
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(`Places Text Search error: ${data.status}${data.error_message ? ` -- ${data.error_message}` : ""}`);
    }

    for (const result of data.results ?? []) {
      if (seenPlaceIds.has(result.place_id)) continue;
      seenPlaceIds.add(result.place_id);

      const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      detailsUrl.searchParams.set("place_id", result.place_id);
      detailsUrl.searchParams.set("fields", "website");
      detailsUrl.searchParams.set("key", key);

      const detailsRes = await fetch(detailsUrl.toString());
      await incrementUsage("placesCalls");
      if (!detailsRes.ok) continue;
      const details = (await detailsRes.json()) as DetailsResponse;
      const website = details.result?.website;
      if (!website) continue;

      const domain = normalizeDomain(website);
      if (!domain) continue;

      candidates.push({
        name: result.name,
        url: website,
        domain,
        location: result.formatted_address ?? null,
      });

      await sleep(100);
    }

    if (!data.next_page_token) break;
    pageToken = data.next_page_token;
  }

  return candidates;
}
